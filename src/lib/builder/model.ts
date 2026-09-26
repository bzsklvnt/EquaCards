// A kvízösszerakó kliens-oldali modellje: egy kérdés "piszkozata" (Draft),
// annak űrlapadattá alakítása (ugyanaz a mezőkészlet, amit a kérdésbank
// űrlapja is küld — így a szerver ugyanazzal a parseQuestionForm /
// validateQuestionForm párossal ellenőriz), típusváltás és figyelmeztetések.
// docs/features/quiz-builder.md.

import {
	parseQuestionForm,
	validateQuestionForm,
	MIN_TIME_LIMIT,
	MAX_TIME_LIMIT
} from '$lib/questions/form';

export type QuestionTypeInfo = {
	id: number;
	code: string;
	label: string;
	min_options: number | null;
	max_options: number | null;
};

export type DraftOption = { text: string; image_url: string | null; is_correct: boolean };

export type SliderConfig = {
	min_value: number;
	max_value: number;
	step: number;
	correct_value: number;
	tolerance: number;
};

export type Draft = {
	/** Stabil kliens-kulcs: mentett kérdésnél maga az id. */
	key: string;
	/** null = még nem mentett (új) kérdés. */
	id: string | null;
	type_code: string;
	theme_id: string | null;
	prompt: string;
	image_url: string | null;
	image_pixelate: boolean;
	points: number;
	points_multiplier: number;
	time_limit_seconds: number;
	points_decay: boolean;
	/** null = globális alap (Beállítások). */
	reading_seconds: number | null;
	options: DraftOption[];
	slider: SliderConfig;
	ordering: string[];
};

/** A kérdésbank-fiók egy sora (loadBank). */
export type BankItem = {
	id: string;
	prompt: string;
	theme_id: string | null;
	type_code: string;
	has_image: boolean;
	created_at: string | null;
	/** Más (már elindított) estéken hányszor szerepelt, és a legutóbbi címe. */
	played_count: number;
	played_last: string | null;
};

/** A kérdésbank „Hol szerepel” listájának egy sora (loadUsage). */
export type QuestionUsage = {
	game_id: string;
	game_title: string;
	status: string;
	scheduled_at: string | null;
	round_title: string;
};

export const TYPE_ORDER = ['single_choice', 'multi_choice', 'true_false', 'slider', 'ordering'];

export const TYPE_SHORT: Record<string, string> = {
	single_choice: 'Egy helyes',
	multi_choice: 'Több helyes',
	true_false: 'Igaz / hamis',
	slider: 'Csúszka',
	ordering: 'Sorrend'
};

export const TIME_PRESETS = [10, 20, 30, 45, 60, 90];
export { MIN_TIME_LIMIT, MAX_TIME_LIMIT };

/** Kártyaszínek: ♠ ♥ ♦ ♣ — 5–8. lapnál világosabb árnyalat, a szám különbözteti meg. */
const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const SUIT_DARK = ['#1E5B4F', '#A3326B', '#9A5412', '#2F5D8C'];
const SUIT_LIGHT = ['#4F8578', '#B8527F', '#AE6C2A', '#4F78A3'];

export function suit(index: number): { symbol: string; color: string; label: string } {
	const i = index % 4;
	const symbol = SUIT_SYMBOLS[i];
	return {
		symbol,
		color: index < 4 ? SUIT_DARK[i] : SUIT_LIGHT[i],
		label: index < 4 ? symbol : `${symbol}${index + 1}`
	};
}

export function isChoiceType(code: string): boolean {
	return code === 'single_choice' || code === 'multi_choice' || code === 'true_false';
}

let localCounter = 0;
export function newLocalKey(): string {
	localCounter += 1;
	return `new-${Date.now().toString(36)}-${localCounter}`;
}

function blankOptions(count: number): DraftOption[] {
	return Array.from({ length: count }, () => ({ text: '', image_url: null, is_correct: false }));
}

const TRUE_FALSE = (correctTrue = true): DraftOption[] => [
	{ text: 'Igaz', image_url: null, is_correct: correctTrue },
	{ text: 'Hamis', image_url: null, is_correct: !correctTrue }
];

export function emptyDraft(
	type: QuestionTypeInfo,
	themeId: string | null,
	template?: Pick<Draft, 'time_limit_seconds' | 'points' | 'points_decay'>
): Draft {
	const draft: Draft = {
		key: newLocalKey(),
		id: null,
		type_code: type.code,
		theme_id: themeId,
		prompt: '',
		image_url: null,
		image_pixelate: false,
		points: template?.points ?? 1000,
		points_multiplier: 1,
		time_limit_seconds: template?.time_limit_seconds ?? 30,
		points_decay: template?.points_decay ?? true,
		reading_seconds: null,
		options: [],
		slider: { min_value: 0, max_value: 100, step: 1, correct_value: 50, tolerance: 0 },
		ordering: ['', '', '']
	};
	return convertDraft(draft, type);
}

/** Típusváltás: a kérdésszöveg, kép és beállítások maradnak; a válaszok a
 * legközelebbi formára igazodnak (a csúszka és a sorrend adatai megmaradnak a
 * piszkozatban, így visszaváltáskor sem vesznek el). */
export function convertDraft(draft: Draft, type: QuestionTypeInfo): Draft {
	const next: Draft = { ...draft, type_code: type.code, options: [...draft.options] };
	if (type.code === 'true_false') {
		const wasTf = draft.type_code === 'true_false' && draft.options.length === 2;
		next.options = wasTf ? draft.options : TRUE_FALSE(true);
	} else if (type.code === 'single_choice' || type.code === 'multi_choice') {
		const fromTf = draft.type_code === 'true_false';
		let options = fromTf ? [] : draft.options.map((o) => ({ ...o }));
		if (options.length === 0 && draft.type_code === 'ordering') {
			options = draft.ordering
				.filter((t) => t.trim())
				.map((text) => ({ text, image_url: null, is_correct: false }));
		}
		const min = type.min_options ?? 2;
		const max = type.max_options ?? Math.max(min, options.length);
		if (options.length > max) options = options.slice(0, max);
		if (options.length < min) options = [...options, ...blankOptions(min - options.length)];
		if (type.code === 'single_choice') {
			const first = options.findIndex((o) => o.is_correct);
			options = options.map((o, i) => ({ ...o, is_correct: i === first }));
		}
		next.options = options;
	} else if (type.code === 'ordering' && draft.ordering.every((t) => !t.trim())) {
		const fromOptions = draft.options.map((o) => o.text).filter((t) => t.trim());
		if (fromOptions.length >= 2 && draft.type_code !== 'true_false') next.ordering = fromOptions;
	}
	return next;
}

/** Ugyanazok a mezők, mint a kérdésbank űrlapján (QuestionEditor form módban). */
export function draftToFormData(draft: Draft, types: QuestionTypeInfo[]): FormData {
	const fd = new FormData();
	const type = types.find((t) => t.code === draft.type_code);
	fd.set('question_type_id', String(type?.id ?? ''));
	fd.set('theme_id', draft.theme_id ?? '');
	fd.set('prompt', draft.prompt);
	fd.set('image_url', draft.image_url ?? '');
	fd.set('image_pixelate', draft.image_pixelate ? 'true' : 'false');
	fd.set('points', String(draft.points));
	fd.set('points_multiplier', String(draft.points_multiplier));
	fd.set('time_limit_seconds', String(draft.time_limit_seconds));
	fd.set('points_decay', draft.points_decay ? 'true' : 'false');
	fd.set('reading_seconds', draft.reading_seconds === null ? '' : String(draft.reading_seconds));
	if (isChoiceType(draft.type_code)) {
		draft.options.forEach((o, i) => {
			fd.append('option_text', o.text);
			fd.append('option_image_url', o.image_url ?? '');
			if (o.is_correct) fd.append('correct_index', String(i));
		});
	} else if (draft.type_code === 'slider') {
		for (const [k, v] of Object.entries(draft.slider)) fd.set(k, String(v));
	} else if (draft.type_code === 'ordering') {
		for (const text of draft.ordering) fd.append('item_text', text);
	}
	return fd;
}

/** null = menthető; különben a (szerverrel azonos) hibaüzenet. */
export function draftError(draft: Draft, types: QuestionTypeInfo[]): string | null {
	const type = types.find((t) => t.code === draft.type_code);
	if (!type) return 'Ismeretlen kérdéstípus.';
	const parsed = parseQuestionForm(draftToFormData(draft, types), type.code);
	return validateQuestionForm(parsed, type);
}

/** Összehasonlításhoz (van-e mentetlen változás). */
export function draftSignature(draft: Draft): string {
	const { key: _key, id: _id, ...rest } = draft;
	void _key;
	void _id;
	return JSON.stringify(rest);
}

export function correctSuitIndex(draft: Draft): number | null {
	if (draft.type_code !== 'single_choice' && draft.type_code !== 'true_false') return null;
	const i = draft.options.findIndex((o) => o.is_correct);
	return i === -1 ? null : i;
}

export function effectiveReading(draft: Draft, globalDefault: number): number {
	return draft.reading_seconds ?? globalDefault;
}
