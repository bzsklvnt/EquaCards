// Kérdésbank-import CSV-ből (docs/features/question-import.md): a fájl
// értelmezése piszkozatokká, soronkénti hibákkal. Az ellenőrzés ugyanaz,
// mint a kézi mentésnél (draftError → parseQuestionForm/validateQuestionForm),
// a szerver mentéskor újra ellenőriz.

import {
	draftError,
	emptyDraft,
	type Draft,
	type DraftOption,
	type QuestionTypeInfo
} from '$lib/builder/model';

export const MAX_IMPORT_ROWS = 2000;

/** Letölthető minta — pontosvesszős, Excelből is így menthető (CSV UTF-8). */
export const CSV_TEMPLATE = [
	'téma;típus;kérdés;A;B;C;D;E;F;G;H;helyes;min;max;lépés;tűrés;idő;pont;kép',
	'Földrajz;egy helyes;Hány vármegyéje van Magyarországnak?;19;18;20;23;;;;;A;;;;;30;1000;',
	'Földrajz;több helyes;Melyik folyó folyik át Magyarországon?;Duna;Tisza;Rába;Visztula;Dráva;Elba;;;A,B,C,E;;;;;30;1000;',
	'Földrajz;igaz/hamis;A Balaton Közép-Európa legnagyobb tava.;;;;;;;;;igaz;;;;;20;1000;',
	'Történelem;csúszka;Melyik évben adták át a Lánchidat?;;;;;;;;;1849;1800;1900;1;0;30;1000;',
	'Történelem;sorrend;Állítsd időrendbe, a legkorábbival kezdve!;Honfoglalás;Mohácsi csata;1848-as forradalom;Rendszerváltás;;;;;;;;;;30;1000;'
].join('\r\n');

export type CsvRow = {
	/** A fájl sora (1 = fejléc). */
	line: number;
	themeTitle: string;
	/** A kérdés szövege és típusa a fájlból (hibás sornál is látszik). */
	prompt: string;
	typeCode: string | null;
	draft: Draft | null;
	errors: string[];
};

/** RFC 4180-szerű értelmezés: idézőjelek, "" escape, CRLF, BOM; az
 * elválasztó (; , tab) a fejlécből derül ki. */
export function parseCsv(text: string): string[][] {
	const src = text.replace(/^\uFEFF/, '');
	const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
	const counts = [';', ',', '\t'].map((d) => ({
		d,
		n: firstLine
			.split('"')
			.filter((_, i) => i % 2 === 0)
			.join('')
			.split(d).length
	}));
	const delimiter = counts.sort((a, b) => b.n - a.n)[0].d;

	const rows: string[][] = [];
	let row: string[] = [];
	let cell = '';
	let quoted = false;
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (quoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					cell += '"';
					i++;
				} else quoted = false;
			} else cell += c;
		} else if (c === '"' && cell === '') {
			quoted = true;
		} else if (c === delimiter) {
			row.push(cell);
			cell = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(cell);
			rows.push(row);
			row = [];
			cell = '';
		} else cell += c;
	}
	if (cell !== '' || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Kisbetű, ékezet és írásjel nélkül: „Válaszidő (mp)” → „valaszidomp”. */
export function normalizeKey(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '');
}

/** Duplikátum-kereséshez: kisbetű, egyszerűsített szóközök. */
export function normalizePrompt(value: string): string {
	return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

type Column =
	| 'theme'
	| 'type'
	| 'prompt'
	| 'correct'
	| 'min'
	| 'max'
	| 'step'
	| 'tolerance'
	| 'time'
	| 'points'
	| 'image'
	| `opt${number}`;

const LETTERS = 'abcdefgh';

function columnFor(header: string): Column | null {
	const k = normalizeKey(header);
	if (k === 'tema' || k === 'temakor' || k === 'kategoria') return 'theme';
	if (k === 'tipus' || k === 'kerdestipus') return 'type';
	if (k === 'kerdes' || k === 'kerdesszovege' || k === 'szoveg') return 'prompt';
	if (k === 'helyes' || k === 'helyesvalasz' || k === 'megoldas') return 'correct';
	if (k === 'min' || k === 'minimum') return 'min';
	if (k === 'max' || k === 'maximum') return 'max';
	if (k === 'lepes' || k === 'lepeskoz') return 'step';
	if (k === 'tures') return 'tolerance';
	if (k === 'ido' || k === 'valaszido' || k === 'idomp' || k === 'valaszidomp') return 'time';
	if (k === 'pont' || k === 'pontszam') return 'points';
	if (k === 'kep' || k === 'kepurl' || k === 'kephivatkozas') return 'image';
	const letter = k.match(/^(?:valasz)?([a-h])$/);
	if (letter) return `opt${LETTERS.indexOf(letter[1])}`;
	const num = k.match(/^valasz([1-8])$/);
	if (num) return `opt${Number(num[1]) - 1}`;
	return null;
}

const TYPE_ALIASES: Record<string, string> = {
	egyhelyes: 'single_choice',
	egy: 'single_choice',
	egyvalasz: 'single_choice',
	single: 'single_choice',
	singlechoice: 'single_choice',
	tobbhelyes: 'multi_choice',
	tobb: 'multi_choice',
	tobbvalasz: 'multi_choice',
	multi: 'multi_choice',
	multichoice: 'multi_choice',
	igazhamis: 'true_false',
	ih: 'true_false',
	truefalse: 'true_false',
	csuszka: 'slider',
	szam: 'slider',
	becsles: 'slider',
	slider: 'slider',
	sorrend: 'ordering',
	sorbarendezes: 'ordering',
	ordering: 'ordering'
};

function parseNumber(value: string): number | null {
	const t = value.trim().replace(/\s/g, '').replace(',', '.');
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : NaN;
}

function correctIndexes(value: string): number[] | null {
	const tokens = value
		.trim()
		.toLowerCase()
		.split(/[\s,;/+]+/)
		.filter(Boolean);
	const out: number[] = [];
	for (const t of tokens) {
		if (/^[a-h]$/.test(t)) out.push(LETTERS.indexOf(t));
		else if (/^[1-8]$/.test(t)) out.push(Number(t) - 1);
		else return null;
	}
	return out;
}

const TRUE_WORDS = new Set(['igaz', 'i', 'true', 'igen', 'a', '1']);
const FALSE_WORDS = new Set(['hamis', 'h', 'false', 'nem', 'b', '2']);

export function readQuestionCsv(
	text: string,
	types: QuestionTypeInfo[],
	defaults: { defaultTime: number }
): { rows: CsvRow[]; error: string | null } {
	const table = parseCsv(text);
	if (table.length < 2) {
		return { rows: [], error: 'A fájl üres, vagy csak fejléc van benne.' };
	}
	const columns = table[0].map(columnFor);
	if (!columns.includes('prompt')) {
		return {
			rows: [],
			error: 'Nem található „kérdés” oszlop a fejlécben. Használd a mintafájl fejlécét.'
		};
	}
	if (table.length - 1 > MAX_IMPORT_ROWS) {
		return {
			rows: [],
			error: `Egyszerre legfeljebb ${MAX_IMPORT_ROWS} kérdés importálható — oszd több fájlra.`
		};
	}

	const rows = table.slice(1).map((cells, index): CsvRow => {
		const line = index + 2;
		const get = (col: Column) => {
			const i = columns.indexOf(col);
			return i === -1 ? '' : (cells[i] ?? '').trim();
		};
		const errors: string[] = [];
		const options = Array.from({ length: 8 }, (_, i) => get(`opt${i}`));
		const lastFilled = options.reduce((last, o, i) => (o ? i : last), -1);
		const filled = options.slice(0, lastFilled + 1);
		const correctRaw = get('correct');

		let code: string | undefined;
		const typeRaw = normalizeKey(get('type'));
		if (typeRaw) {
			code = TYPE_ALIASES[typeRaw];
			if (!code) errors.push(`Ismeretlen típus: „${get('type')}”.`);
		} else if (get('min') || get('max')) code = 'slider';
		else if (filled.length === 0 && /^(igaz|hamis|i|h|true|false)$/i.test(correctRaw))
			code = 'true_false';
		else if ((correctIndexes(correctRaw)?.length ?? 0) > 1) code = 'multi_choice';
		else code = 'single_choice';

		const type = types.find((t) => t.code === code);
		if (!type) {
			if (errors.length === 0) errors.push('Ez a kérdéstípus nem érhető el.');
			return {
				line,
				themeTitle: get('theme'),
				prompt: get('prompt'),
				typeCode: null,
				draft: null,
				errors
			};
		}

		const time = parseNumber(get('time'));
		const points = parseNumber(get('points'));
		if (Number.isNaN(time)) errors.push('Az idő nem szám.');
		if (Number.isNaN(points)) errors.push('A pont nem szám.');

		const draft: Draft = {
			...emptyDraft(type, null, {
				time_limit_seconds: time ?? defaults.defaultTime,
				points: points ?? 1000,
				points_decay: true
			}),
			prompt: get('prompt'),
			image_url: get('image') || null
		};
		if (draft.image_url && !/^https:\/\//i.test(draft.image_url)) {
			errors.push('A kép hivatkozása https:// címmel kezdődjön.');
		}

		if (code === 'single_choice' || code === 'multi_choice') {
			if (filled.some((o) => !o)) errors.push('A válaszok között üres oszlop van.');
			const idx = correctIndexes(correctRaw);
			if (!correctRaw) errors.push('Hiányzik a helyes válasz (pl. A vagy A,C).');
			else if (!idx) errors.push(`A helyes válasz betűvel adható meg (pl. A,C): „${correctRaw}”.`);
			else if (idx.some((i) => i >= filled.length)) {
				errors.push('A helyes válasz olyan betűre mutat, amihez nincs válasz.');
			} else if (code === 'single_choice' && idx.length > 1) {
				errors.push('Egy helyes típusnál csak egy helyes válasz lehet.');
			}
			const correct = new Set(idx ?? []);
			draft.options = filled.map((text, i): DraftOption => ({
				text,
				image_url: null,
				is_correct: correct.has(i)
			}));
		} else if (code === 'true_false') {
			const word = correctRaw.toLowerCase();
			const trueFirst = TRUE_WORDS.has(word);
			if (!trueFirst && !FALSE_WORDS.has(word)) {
				errors.push('Igaz/hamis kérdésnél a helyes válasz „igaz” vagy „hamis”.');
			}
			draft.options = [
				{ text: options[0] || 'Igaz', image_url: null, is_correct: trueFirst },
				{ text: options[1] || 'Hamis', image_url: null, is_correct: !trueFirst }
			];
		} else if (code === 'slider') {
			const nums = {
				min_value: parseNumber(get('min')),
				max_value: parseNumber(get('max')),
				step: parseNumber(get('step')),
				correct_value: parseNumber(correctRaw),
				tolerance: parseNumber(get('tolerance'))
			};
			if (nums.min_value === null || nums.max_value === null || nums.correct_value === null) {
				errors.push('Csúszkánál kötelező a min, a max és a helyes érték.');
			}
			if (Object.values(nums).some((n) => Number.isNaN(n))) {
				errors.push('A csúszka értékei számok legyenek.');
			}
			draft.slider = {
				min_value: nums.min_value ?? 0,
				max_value: nums.max_value ?? 100,
				step: nums.step ?? 1,
				correct_value: nums.correct_value ?? 0,
				tolerance: nums.tolerance ?? 0
			};
		} else if (code === 'ordering') {
			if (filled.some((o) => !o)) errors.push('Az elemek között üres oszlop van.');
			draft.ordering = filled;
		}

		if (errors.length === 0) {
			const shared = draftError(draft, types);
			if (shared) errors.push(shared);
		}
		return {
			line,
			themeTitle: get('theme'),
			prompt: get('prompt'),
			typeCode: type.code,
			draft: errors.length ? null : draft,
			errors
		};
	});

	return { rows, error: null };
}
