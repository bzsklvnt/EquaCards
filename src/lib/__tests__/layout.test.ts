import { describe, expect, it } from 'vitest';
import {
	DEFAULT_LAYOUT,
	effectivePreset,
	layoutForSave,
	normalizeLayout,
	parseClock,
	parseYouTubeId,
	parseYouTubeStart,
	stagePreset,
	videoError
} from '$lib/questions/layout';
import {
	draftError,
	draftToFormData,
	effectiveReading,
	emptyDraft,
	questionNumbers,
	type Draft,
	type QuestionTypeInfo
} from '$lib/builder/model';
import { parseQuestionForm } from '$lib/questions/form';

const TYPES: QuestionTypeInfo[] = [
	{ id: 1, code: 'single_choice', label: 'Egy helyes', min_options: 2, max_options: 8 },
	{ id: 4, code: 'true_false', label: 'Igaz/hamis', min_options: 2, max_options: 2 },
	{ id: 6, code: 'info', label: 'Info', min_options: null, max_options: null }
];
const type = (code: string) => TYPES.find((t) => t.code === code)!;

describe('YouTube-link értelmezése', () => {
	it('felismeri a gyakori formákat', () => {
		const id = 'dQw4w9WgXcQ';
		for (const link of [
			`https://www.youtube.com/watch?v=${id}`,
			`https://youtu.be/${id}?t=42`,
			`youtube.com/shorts/${id}`,
			`https://www.youtube-nocookie.com/embed/${id}`,
			`https://m.youtube.com/watch?v=${id}&list=x`,
			id
		]) {
			expect(parseYouTubeId(link)).toBe(id);
		}
		expect(parseYouTubeId('https://vimeo.com/123')).toBeNull();
		expect(parseYouTubeId('nem link')).toBeNull();
	});

	it('kiolvassa a kezdőidőt', () => {
		expect(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=90')).toBe(90);
		expect(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ?t=1m30s')).toBe(90);
		expect(parseYouTubeStart('https://youtu.be/dQw4w9WgXcQ')).toBeNull();
	});

	it('perc:mp idő', () => {
		expect(parseClock('1:23')).toBe(83);
		expect(parseClock('45')).toBe(45);
		expect(parseClock('1:02:03')).toBe(3723);
		expect(parseClock('1:2x')).toBeNull();
	});

	it('a részlet legfeljebb 5 perc, a vége a kezdet után', () => {
		expect(videoError({ id: 'dQw4w9WgXcQ', start: 10, end: 30, gate: true })).toBeNull();
		expect(videoError({ id: 'dQw4w9WgXcQ', start: 30, end: 30, gate: true })).not.toBeNull();
		expect(videoError({ id: 'dQw4w9WgXcQ', start: 0, end: 301, gate: true })).not.toBeNull();
	});
});

describe('megjelenés', () => {
	it('hiányos / ismeretlen értékből az alapértelmezés', () => {
		expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
		expect(normalizeLayout({ preset: 'x', timer: 'corner', phone_cols: '2' })).toEqual({
			...DEFAULT_LAYOUT,
			timer: 'corner',
			phone_cols: 2
		});
	});

	it('az alapértelmezett megjelenés null-ként tárolódik', () => {
		expect(layoutForSave({ ...DEFAULT_LAYOUT })).toBeNull();
		expect(layoutForSave({ ...DEFAULT_LAYOUT, size: 'xl' })).not.toBeNull();
	});

	it('info diánál és videónál a saját elrendezés-készlet érvényes', () => {
		const left = { ...DEFAULT_LAYOUT, preset: 'image_left' as const };
		expect(effectivePreset(left, { info: false, video: false })).toBe('image_left');
		expect(effectivePreset(left, { info: true, video: false })).toBe('info_split');
		expect(effectivePreset(left, { info: false, video: true })).toBe('video_full');
		expect(stagePreset('image_left', false)).toBe('text');
		expect(stagePreset('image_left', true)).toBe('image_left');
	});
});

describe('magyarázó dia és videó a piszkozatban', () => {
	it('az info dia címmel menthető, válaszok nélkül', () => {
		const d: Draft = { ...emptyDraft(type('info'), null), prompt: 'Tudtad?', info_text: 'Szöveg' };
		expect(draftError(d, TYPES)).toBeNull();
		const parsed = parseQuestionForm(draftToFormData(d, TYPES), 'info');
		expect(parsed.info_text).toBe('Szöveg');
		expect(parsed.choiceOptions).toBeUndefined();
		expect(parsed.video).toBeNull();
		expect(draftError({ ...d, prompt: '' }, TYPES)).toBe('A dia címe kötelező.');
	});

	it('a videó és a megjelenés átmegy az űrlapon', () => {
		const d: Draft = {
			...emptyDraft(type('true_false'), null),
			prompt: 'Kérdés',
			layout: { ...DEFAULT_LAYOUT, phone_cols: 2 },
			video: { id: 'dQw4w9WgXcQ', start: 10, end: 28, gate: false }
		};
		const parsed = parseQuestionForm(draftToFormData(d, TYPES), 'true_false');
		expect(parsed.video).toEqual({ id: 'dQw4w9WgXcQ', start: 10, end: 28, gate: false });
		expect(parsed.layout?.phone_cols).toBe(2);
		expect(draftError({ ...d, video: { ...d.video!, end: 5 } }, TYPES)).not.toBeNull();
	});

	it('olvasási idő: a videó után induló válaszidőnél a klip hossza', () => {
		const d = emptyDraft(type('true_false'), null);
		expect(effectiveReading(d, 5)).toBe(5);
		expect(
			effectiveReading({ ...d, video: { id: 'dQw4w9WgXcQ', start: 10, end: 28, gate: true } }, 5)
		).toBe(18);
		expect(
			effectiveReading({ ...d, video: { id: 'dQw4w9WgXcQ', start: 10, end: 28, gate: false } }, 5)
		).toBe(5);
	});

	it('az info dia nem kap sorszámot', () => {
		const q = emptyDraft(type('true_false'), null);
		const i = emptyDraft(type('info'), null);
		const drafts = { a: q, b: i, c: q };
		expect(questionNumbers(['a', 'b', 'c'], drafts)).toEqual({
			numbers: { a: 1, b: null, c: 2 },
			total: 2
		});
	});
});
