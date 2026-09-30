import { env } from '$env/dynamic/private';
import type {
	AiQuestion,
	Difficulty,
	ReviewFinding,
	SuggestedQuestion,
	SuggestType
} from '$lib/builder/ai';

// AI-segéd a kvízösszerakóhoz (docs/features/ai-assistant.md): kérdésjavaslat
// és kérdés-ellenőrzés a Claude API-val. A kulcs csak a szerveren él
// (ANTHROPIC_API_KEY), a böngészőbe soha nem kerül. A válasz szerkezetét egy
// kötelezően hívott „tool” sémája rögzíti, így mindig érvényes JSON jön vissza.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODELS_URL = 'https://api.anthropic.com/v1/models?limit=50';

// A modell: ANTHROPIC_MODEL, ha meg van adva; különben a Models API
// listájából a legújabb Opus (ha nincs, a legújabb modell). A lista
// legújabb-elöl rendezett; a választás a szerverpéldány élete alatt
// gyorsítótárazott, így nem kell kódot módosítani új modellnél.
let cachedModel: Promise<string> | null = null;

function resolveModel(key: string): Promise<string> {
	if (env.ANTHROPIC_MODEL) return Promise.resolve(env.ANTHROPIC_MODEL);
	cachedModel ??= (async () => {
		const res = await fetch(MODELS_URL, {
			headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
			signal: AbortSignal.timeout(10_000)
		});
		if (!res.ok) {
			throw new AiError(
				res.status === 401 ? 'Érvénytelen AI API-kulcs.' : 'Az AI-modellek listája nem érhető el.'
			);
		}
		const list = ((await res.json()) as { data?: { id: string }[] }).data ?? [];
		const pick = list.find((m) => m.id.includes('opus')) ?? list[0];
		if (!pick) throw new AiError('Nincs elérhető AI-modell.');
		return pick.id;
	})().catch((err) => {
		cachedModel = null;
		throw err instanceof AiError ? err : new AiError('Az AI szolgáltatás nem érhető el.');
	});
	return cachedModel;
}

export function aiEnabled(): boolean {
	return !!env.ANTHROPIC_API_KEY;
}

export class AiError extends Error {}

type Tool = { name: string; description: string; input_schema: Record<string, unknown> };

async function callTool<T>(opts: {
	system: string;
	user: string;
	tool: Tool;
	maxTokens?: number;
}): Promise<T> {
	const key = env.ANTHROPIC_API_KEY;
	if (!key) throw new AiError('Az AI nincs beállítva (ANTHROPIC_API_KEY hiányzik).');
	const model = await resolveModel(key);
	let res: Response;
	try {
		res = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': key,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model,
				max_tokens: opts.maxTokens ?? 8000,
				system: opts.system,
				messages: [{ role: 'user', content: opts.user }],
				tools: [opts.tool],
				tool_choice: { type: 'tool', name: opts.tool.name }
			}),
			signal: AbortSignal.timeout(110_000)
		});
	} catch (err) {
		throw new AiError(
			(err as Error).name === 'TimeoutError'
				? 'Az AI nem válaszolt időben, próbáld újra kevesebb kérdéssel.'
				: 'Az AI szolgáltatás nem érhető el.'
		);
	}
	const payload = (await res.json().catch(() => null)) as {
		content?: { type: string; name?: string; input?: unknown }[];
		error?: { message?: string };
	} | null;
	if (!res.ok) {
		const reason = payload?.error?.message ?? `HTTP ${res.status}`;
		throw new AiError(
			res.status === 401
				? 'Érvénytelen AI API-kulcs.'
				: res.status === 429 || res.status === 529
					? 'Az AI most túlterhelt, próbáld újra egy perc múlva.'
					: `AI hiba: ${reason}`
		);
	}
	const block = payload?.content?.find((c) => c.type === 'tool_use' && c.name === opts.tool.name);
	if (!block?.input) throw new AiError('Az AI nem adott értelmezhető választ.');
	return block.input as T;
}

// --- Közös típusok -----------------------------------------------------------

export type AiRoundContext = { title: string; questions: AiQuestion[] };

function describe(q: AiQuestion): string {
	const lines = [`[${q.type}] ${q.prompt}`];
	if (q.options?.length) {
		q.options.forEach((o, i) =>
			lines.push(`  ${String.fromCharCode(65 + i)}) ${o.text}${o.correct ? '  ✓' : ''}`)
		);
	}
	if (q.slider) {
		const s = q.slider;
		lines.push(
			`  csúszka ${s.min}–${s.max} (lépés ${s.step}), helyes: ${s.correct} ±${s.tolerance}`
		);
	}
	if (q.ordering?.length) lines.push(`  helyes sorrend: ${q.ordering.join(' → ')}`);
	if (q.info_text) lines.push(`  szöveg: ${q.info_text}`);
	return lines.join('\n');
}

function describeGame(title: string, rounds: AiRoundContext[]): string {
	return [
		`Kvízeste: ${title}`,
		...rounds.map(
			(r, i) =>
				`\n## ${i + 1}. kör: ${r.title} (${r.questions.length} kérdés)\n` +
				(r.questions.length ? r.questions.map(describe).join('\n') : '(még üres)')
		)
	].join('\n');
}

// --- Kérdésjavaslat ----------------------------------------------------------

const SUGGEST_TOOL: Tool = {
	name: 'kerdesek',
	description: 'A javasolt új kvízkérdések.',
	input_schema: {
		type: 'object',
		properties: {
			questions: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						type: {
							type: 'string',
							enum: ['single_choice', 'multi_choice', 'true_false', 'slider']
						},
						prompt: { type: 'string', description: 'A kérdés szövege magyarul.' },
						options: {
							type: 'array',
							description:
								'Választós kérdésnél 2–4 (legfeljebb 8) lehetőség; igaz/hamisnál pontosan „Igaz” és „Hamis”.',
							items: {
								type: 'object',
								properties: { text: { type: 'string' }, correct: { type: 'boolean' } },
								required: ['text', 'correct']
							}
						},
						slider: {
							type: 'object',
							description: 'Csak csúszkás (becslős, számos) kérdésnél.',
							properties: {
								min: { type: 'number' },
								max: { type: 'number' },
								step: { type: 'number' },
								correct: { type: 'number' },
								tolerance: { type: 'number' }
							},
							required: ['min', 'max', 'step', 'correct', 'tolerance']
						},
						note: {
							type: 'string',
							description: 'Egy mondat a kvízmesternek: forrás / miért ez a helyes válasz.'
						}
					},
					required: ['type', 'prompt']
				}
			}
		},
		required: ['questions']
	}
};

const TYPE_HINT: Record<SuggestType, string> = {
	mixed: 'vegyes típusú (főleg egy helyes válaszos, néha igaz/hamis vagy csúszkás becslés)',
	single_choice: 'egy helyes válaszos (4 lehetőség, pontosan 1 helyes)',
	multi_choice: 'több helyes válaszos (4–6 lehetőség, 2–3 helyes)',
	true_false: 'igaz/hamis',
	slider: 'csúszkás becslős (számos válasz, értelmes tartománnyal és tűréssel)'
};

const DIFFICULTY_HINT: Record<Difficulty, string> = {
	easy: 'könnyű (a legtöbb csapat tudja)',
	medium: 'közepes (a csapatok kb. fele tudja)',
	hard: 'nehéz (csak a jól felkészült csapatok tudják)'
};

export async function suggestQuestions(input: {
	gameTitle: string;
	rounds: AiRoundContext[];
	targetRound: number;
	count: number;
	type: SuggestType;
	difficulty: Difficulty;
	note: string;
}): Promise<SuggestedQuestion[]> {
	const target = input.rounds[input.targetRound];
	const result = await callTool<{ questions: SuggestedQuestion[] }>({
		system:
			'Magyar kocsmakvíz-szerkesztő vagy. Rövid, egyértelmű, tényszerűen ellenőrizhető ' +
			'kérdéseket írsz, amelyekre a helyes válasz biztosan helyes. A kérdés legfeljebb ' +
			'~120, egy válaszlehetőség legfeljebb ~40 karakter, hogy telefonon is kiférjen. ' +
			'A rossz válaszok hihetők legyenek. Csak a megadott kvízeste kérdéseit veheted ' +
			'figyelembe kontextusként: igazodj a körök témájához, stílusához és nehézségéhez, ' +
			'és egyik meglévő kérdést se ismételd meg (tartalmában sem).',
		user:
			describeGame(input.gameTitle, input.rounds) +
			`\n\n---\nFeladat: írj ${input.count} új, ${TYPE_HINT[input.type]} kérdést a(z) ` +
			`${input.targetRound + 1}. körbe („${target?.title ?? ''}”), ${DIFFICULTY_HINT[input.difficulty]} ` +
			'nehézséggel. Illeszkedjenek a kör témájához és a meglévő kérdések stílusához.' +
			(input.note.trim() ? `\nKülön kérés a kvízmestertől: ${input.note.trim()}` : ''),
		tool: SUGGEST_TOOL,
		maxTokens: 6000
	});
	return (result.questions ?? []).slice(0, input.count);
}

// --- Kérdés-ellenőrzés -------------------------------------------------------

const REVIEW_TOOL: Tool = {
	name: 'ellenorzes',
	description: 'A kérdésekben talált problémák. Hibátlan kérdéshez ne adj bejegyzést.',
	input_schema: {
		type: 'object',
		properties: {
			findings: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						key: { type: 'string', description: 'A kérdés azonosítója (a [#...] jelölésből).' },
						severity: {
							type: 'string',
							enum: ['error', 'warn', 'info'],
							description:
								'error: rossz / vitatható helyes válasz, több jó válasz; warn: nem egyértelmű, elírás; info: stílus.'
						},
						problem: { type: 'string', description: 'A probléma egy-két mondatban, magyarul.' },
						fix: {
							type: 'object',
							description:
								'Javasolt javítás; csak a változó mezőket add meg. Az option_texts a teljes lista, ugyanannyi elemmel.',
							properties: {
								prompt: { type: 'string' },
								option_texts: { type: 'array', items: { type: 'string' } },
								correct_indexes: {
									type: 'array',
									items: { type: 'integer' },
									description: '0-tól számozott indexek (A=0).'
								},
								slider_correct: { type: 'number' }
							}
						}
					},
					required: ['key', 'severity', 'problem']
				}
			}
		},
		required: ['findings']
	}
};

export async function reviewQuestions(input: {
	gameTitle: string;
	roundTitle: string;
	questions: (AiQuestion & { key: string })[];
}): Promise<ReviewFinding[]> {
	const keys = new Set(input.questions.map((q) => q.key));
	const result = await callTool<{ findings: ReviewFinding[] }>({
		system:
			'Magyar kocsmakvíz-lektor vagy. Ellenőrizd a kérdéseket: (1) a megjelölt helyes ' +
			'válasz tényszerűen helyes-e, (2) nincs-e másik szintén helyes válaszlehetőség, ' +
			'(3) egyértelmű-e a kérdés, (4) helyesírás, elütés, (5) túl hosszú-e telefonra ' +
			'(kérdés ~160, válasz ~45 karakter fölött). Csak valódi problémát jelezz, a ' +
			'hibátlan kérdéseket hagyd ki. Ha bizonytalan vagy egy tényben, jelezd warn szinten, ' +
			'és írd le, mit érdemes ellenőrizni.',
		user:
			`Kvízeste: ${input.gameTitle}\nKör: ${input.roundTitle}\n\n` +
			input.questions.map((q) => `[#${q.key}] ${describe(q)}`).join('\n\n'),
		tool: REVIEW_TOOL,
		maxTokens: 8000
	});
	return (result.findings ?? []).filter((f) => keys.has(f.key));
}
