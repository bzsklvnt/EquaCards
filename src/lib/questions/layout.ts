// Kérdésenkénti megjelenés (questions.layout), magyarázó dia és YouTube-videó
// melléklet — közös a szerkesztővel, a kivetítővel és a telefonnal.
// docs/features/question-layout.md.

export type LayoutPreset =
	| 'classic'
	| 'image_left'
	| 'image_right'
	| 'image_bg'
	| 'text'
	| 'video_full'
	| 'video_split'
	| 'info_split'
	| 'info_image';

export type QuestionLayout = {
	preset: LayoutPreset;
	/** Időzítő a kivetítőn. */
	timer: 'corner' | 'below' | 'big';
	/** „2. kör · 3 / 8” felirat. */
	counter: 'top' | 'bottom' | 'hidden';
	size: 'normal' | 'large' | 'xl';
	/** Válaszlapok a telefonon. */
	phone_cols: 1 | 2;
	/** A kérdés szövege a telefonon is. */
	phone_prompt: boolean;
};

/** A null (nem beállított) megjelenés — pontosan a korábbi kinézet. */
export const DEFAULT_LAYOUT: QuestionLayout = {
	preset: 'classic',
	timer: 'big',
	counter: 'top',
	size: 'normal',
	phone_cols: 1,
	phone_prompt: true
};

export const QUESTION_PRESETS: { value: LayoutPreset; label: string }[] = [
	{ value: 'classic', label: 'Klasszikus' },
	{ value: 'image_left', label: 'Kép balra' },
	{ value: 'image_right', label: 'Kép jobbra' },
	{ value: 'image_bg', label: 'Kép háttérben' },
	{ value: 'text', label: 'Csak szöveg' }
];
export const VIDEO_PRESETS: { value: LayoutPreset; label: string }[] = [
	{ value: 'video_full', label: 'Videó teljes' },
	{ value: 'video_split', label: 'Videó + kérdés' }
];
export const INFO_PRESETS: { value: LayoutPreset; label: string }[] = [
	{ value: 'info_split', label: 'Kép + szöveg' },
	{ value: 'info_image', label: 'Csak kép' }
];

const ALL_PRESETS = new Set<string>(
	[...QUESTION_PRESETS, ...VIDEO_PRESETS, ...INFO_PRESETS].map((p) => p.value)
);

function pick<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Bármilyen (akár hiányos vagy régi) jsonb-ből teljes, érvényes megjelenés. */
export function normalizeLayout(raw: unknown): QuestionLayout {
	const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return {
		preset: ALL_PRESETS.has(r.preset as string)
			? (r.preset as LayoutPreset)
			: DEFAULT_LAYOUT.preset,
		timer: pick(r.timer, ['corner', 'below', 'big'] as const, DEFAULT_LAYOUT.timer),
		counter: pick(r.counter, ['top', 'bottom', 'hidden'] as const, DEFAULT_LAYOUT.counter),
		size: pick(r.size, ['normal', 'large', 'xl'] as const, DEFAULT_LAYOUT.size),
		phone_cols: pick(Number(r.phone_cols), [1, 2] as const, DEFAULT_LAYOUT.phone_cols),
		phone_prompt: typeof r.phone_prompt === 'boolean' ? r.phone_prompt : true
	};
}

/** Az adott kérdésre ténylegesen érvényes elrendezés-készlet: info diánál és
 * videós kérdésnél a sajátjuk, egyébként a kérdés-készletek egyike. */
export function effectivePreset(
	layout: QuestionLayout,
	opts: { info: boolean; video: boolean }
): LayoutPreset {
	const p = layout.preset;
	if (opts.info) return p === 'info_image' ? 'info_image' : 'info_split';
	if (opts.video) return p === 'video_split' ? 'video_split' : 'video_full';
	return QUESTION_PRESETS.some((q) => q.value === p) ? p : 'classic';
}

/** A tárolandó érték: az alapértelmezettel azonos megjelenés null marad. */
export function layoutForSave(layout: QuestionLayout): QuestionLayout | null {
	const same = (Object.keys(DEFAULT_LAYOUT) as (keyof QuestionLayout)[]).every(
		(k) => layout[k] === DEFAULT_LAYOUT[k]
	);
	return same ? null : layout;
}

// ── YouTube ──────────────────────────────────────────────────────────────────

export const MAX_VIDEO_CLIP = 300;

export type QuestionVideo = { id: string; start: number; end: number; gate: boolean };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Videóazonosító egy YouTube-linkből (watch, youtu.be, shorts, embed, live)
 * vagy magából az azonosítóból; null, ha nem ismerhető fel. */
export function parseYouTubeId(input: string): string | null {
	const text = input.trim();
	if (VIDEO_ID.test(text)) return text;
	let url: URL;
	try {
		url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
	} catch {
		return null;
	}
	const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
	let id: string | null = null;
	if (host === 'youtu.be') {
		id = url.pathname.split('/')[1] ?? null;
	} else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
		if (url.pathname === '/watch') id = url.searchParams.get('v');
		else {
			const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
			id = m?.[1] ?? null;
		}
	}
	return id && VIDEO_ID.test(id) ? id : null;
}

/** A link „t=” / „start=” paramétere másodpercben (pl. 1m30s, 90). */
export function parseYouTubeStart(input: string): number | null {
	let url: URL;
	try {
		url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
	} catch {
		return null;
	}
	const t = url.searchParams.get('t') ?? url.searchParams.get('start');
	if (!t) return null;
	if (/^\d+$/.test(t)) return Number(t);
	const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
	if (!m || !m[0]) return null;
	return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** „1:30”, „90”, „1:02:03” → másodperc; null, ha érvénytelen. */
export function parseClock(value: string): number | null {
	const text = value.trim();
	if (!/^\d+(:\d{1,2}){0,2}$/.test(text)) return null;
	return text.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}

export function formatClock(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const h = Math.floor(s / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = String(s % 60).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

export function videoError(video: QuestionVideo | null): string | null {
	if (!video) return null;
	if (!VIDEO_ID.test(video.id)) return 'Érvénytelen YouTube-videó.';
	if (!Number.isInteger(video.start) || !Number.isInteger(video.end) || video.start < 0) {
		return 'A videó kezdete és vége egész másodperc legyen.';
	}
	if (video.end <= video.start) return 'A videó vége legyen később, mint a kezdete.';
	if (video.end - video.start > MAX_VIDEO_CLIP) {
		return `A videórészlet legfeljebb ${MAX_VIDEO_CLIP / 60} perc lehet.`;
	}
	return null;
}

export function normalizeVideo(raw: unknown): QuestionVideo | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	if (typeof r.id !== 'string' || !VIDEO_ID.test(r.id)) return null;
	return {
		id: r.id,
		start: Number(r.start) || 0,
		end: Number(r.end) || 0,
		gate: r.gate !== false
	};
}

export function youtubeThumbnail(id: string): string {
	return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Kép nélkül a képes elrendezések a „Csak szöveg” szerint jelennek meg. */
export function stagePreset(preset: LayoutPreset, hasImage: boolean): LayoutPreset {
	if (!hasImage && (preset === 'image_left' || preset === 'image_right' || preset === 'image_bg')) {
		return 'text';
	}
	if (!hasImage && preset === 'info_image') return 'info_split';
	return preset;
}
