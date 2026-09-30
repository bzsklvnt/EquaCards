import { describe, expect, it } from 'vitest';
import {
	applyFix,
	describeFix,
	promptKey,
	suggestionToDraft,
	suggestionUsable
} from '$lib/builder/ai';
import { computeIssues, draftWarnings } from '$lib/builder/issues';
import { emptyDraft, type Draft, type QuestionTypeInfo } from '$lib/builder/model';

const TYPES: QuestionTypeInfo[] = [
	{ id: 1, code: 'single_choice', label: 'Egy helyes', min_options: 2, max_options: 8 },
	{ id: 2, code: 'multi_choice', label: 'Több helyes', min_options: 2, max_options: 8 },
	{ id: 3, code: 'slider', label: 'Csúszka', min_options: null, max_options: null },
	{ id: 4, code: 'true_false', label: 'Igaz/hamis', min_options: 2, max_options: 2 }
];
const type = (code: string) => TYPES.find((t) => t.code === code)!;

function choice(prompt: string, options: string[], correct = 0): Draft {
	const d = emptyDraft(type('single_choice'), null);
	d.prompt = prompt;
	d.options = options.map((text, i) => ({ text, image_url: null, is_correct: i === correct }));
	return d;
}

describe('szabályalapú ellenőrzés', () => {
	it('jelzi a telefonhoz túl hosszú kérdést és választ', () => {
		const d = choice('K'.repeat(170), ['rövid', 'x'.repeat(50)]);
		const w = draftWarnings(d);
		expect(w.some((t) => t.includes('hosszú a kérdés'))).toBe(true);
		expect(w.some((t) => t.includes('hosszú válasz') && t.includes('B'))).toBe(true);
		// Rejtett kérdésszöveg (csak a kivetítőn) mellett a hossz nem gond.
		expect(
			draftWarnings({ ...d, layout: { ...d.layout, phone_prompt: false } }).some((t) =>
				t.includes('hosszú a kérdés')
			)
		).toBe(false);
	});

	it('jelzi az azonos válaszlehetőségeket', () => {
		expect(draftWarnings(choice('Mi?', ['Párizs', ' párizs ', 'Róma']))[0]).toContain('A–B');
		expect(draftWarnings(choice('Mi?', ['Párizs', 'Róma']))).toEqual([]);
	});

	it('jelzi, ha a körben minden helyes válasz ugyanazon a lapon van', () => {
		const drafts = Object.fromEntries(
			[0, 1, 2, 3].map((i) => {
				const d = choice(`Kérdés ${i}`, ['a', 'b', 'c'], 1);
				return [d.key, d];
			})
		);
		const issues = computeIssues(
			[{ id: 'r1', title: 'Kör', keys: Object.keys(drafts) }],
			drafts,
			TYPES,
			() => 0,
			() => false
		);
		expect(issues.some((i) => i.text.includes('ugyanazon a lapon (B)'))).toBe(true);
	});

	it('az AI-észrevételek AI-jelöléssel kerülnek a listába', () => {
		const d = choice('Mi?', ['a', 'b']);
		const issues = computeIssues(
			[{ id: 'r1', title: 'Kör', keys: [d.key] }],
			{ [d.key]: d },
			TYPES,
			() => 0,
			() => false,
			(k) => (k === d.key ? ['AI: rossz a helyes válasz.'] : [])
		);
		expect(issues.find((i) => i.ai)?.text).toContain('AI: rossz a helyes válasz.');
	});
});

describe('AI-javaslat', () => {
	it('csak szerkezetileg érvényes javaslat használható', () => {
		expect(
			suggestionUsable({
				type: 'single_choice',
				prompt: 'Mi Franciaország fővárosa?',
				options: [
					{ text: 'Párizs', correct: true },
					{ text: 'Lyon', correct: false }
				]
			})
		).toBe(true);
		expect(
			suggestionUsable({
				type: 'single_choice',
				prompt: 'Két helyes?',
				options: [
					{ text: 'a', correct: true },
					{ text: 'b', correct: true }
				]
			})
		).toBe(false);
		expect(
			suggestionUsable({
				type: 'slider',
				prompt: 'Hány méter?',
				slider: { min: 0, max: 100, step: 1, correct: 120, tolerance: 0 }
			})
		).toBe(false);
	});

	it('a javaslatból menthető piszkozat lesz a kör beállításaival', () => {
		const template = { time_limit_seconds: 45, points: 500, points_decay: false };
		const d = suggestionToDraft(
			{
				type: 'slider',
				prompt: 'Milyen magas az Eiffel-torony (m)?',
				slider: { min: 100, max: 500, step: 1, correct: 330, tolerance: 10 }
			},
			TYPES,
			template,
			'tema-1'
		)!;
		expect(d.type_code).toBe('slider');
		expect(d.slider.correct_value).toBe(330);
		expect(d.time_limit_seconds).toBe(45);
		expect(d.theme_id).toBe('tema-1');
		expect(d.id).toBeNull();
	});

	it('a duplikátumszűrés kis/nagybetű- és írásjel-független', () => {
		expect(promptKey('Mi a fővárosa?')).toBe(promptKey('mi a  FŐVÁROSA'));
	});
});

describe('AI-javítás átvétele', () => {
	it('átírja a kérdést, a válaszokat és a helyes választ', () => {
		const d = choice('Melyik a legnagyobb bolygó', ['Szaturnusz', 'Jupiter', 'Mars'], 0);
		const fix = {
			prompt: 'Melyik a Naprendszer legnagyobb bolygója?',
			option_texts: ['Szaturnusz', 'Jupiter', 'Mars'],
			correct_indexes: [1]
		};
		expect(describeFix(d, fix)).toContain('helyes: B');
		const next = applyFix(d, fix)!;
		expect(next.prompt).toBe('Melyik a Naprendszer legnagyobb bolygója?');
		expect(next.options.map((o) => o.is_correct)).toEqual([false, true, false]);
		expect(d.options[0].is_correct).toBe(true);
	});

	it('nem illő javítást nem alkalmaz', () => {
		const d = choice('Mi?', ['a', 'b']);
		expect(applyFix(d, { option_texts: ['x'] })).toBeNull();
		expect(applyFix(d, { correct_indexes: [0, 1] })).toBeNull();
		expect(applyFix(d, { correct_indexes: [5] })).toBeNull();
	});
});
