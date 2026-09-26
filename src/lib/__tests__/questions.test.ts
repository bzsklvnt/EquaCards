import { describe, expect, it } from 'vitest';
import { draftError, draftToFormData, emptyDraft, type QuestionTypeInfo } from '$lib/builder/model';
import { parseQuestionForm } from '$lib/questions/form';

const TYPES: QuestionTypeInfo[] = [
	{ id: 1, code: 'single_choice', label: 'Egy helyes', min_options: 2, max_options: 8 },
	{ id: 2, code: 'multi_choice', label: 'Több helyes', min_options: 2, max_options: 8 },
	{ id: 3, code: 'true_false', label: 'Igaz/hamis', min_options: 2, max_options: 2 },
	{ id: 4, code: 'slider', label: 'Csúszka', min_options: null, max_options: null },
	{ id: 5, code: 'ordering', label: 'Sorrend', min_options: null, max_options: null }
];
const type = (code: string) => TYPES.find((t) => t.code === code)!;

describe('kérdés-piszkozat ellenőrzése (kliens és szerver közös szabályai)', () => {
	it('üres kérdésszöveg nem menthető', () => {
		const d = emptyDraft(type('true_false'), null);
		expect(draftError(d, TYPES)).toBe('A kérdés szövege kötelező.');
	});

	it('kitöltött igaz/hamis kérdés menthető', () => {
		const d = { ...emptyDraft(type('true_false'), null), prompt: 'A Föld gömbölyű.' };
		expect(draftError(d, TYPES)).toBeNull();
	});

	it('helyes opció nélkül nem menthető', () => {
		const d = {
			...emptyDraft(type('single_choice'), null),
			prompt: 'Kérdés',
			options: [
				{ text: 'A', image_url: null, is_correct: false },
				{ text: 'B', image_url: null, is_correct: false }
			]
		};
		expect(draftError(d, TYPES)).toBe('Legalább egy helyes opciót ki kell jelölni.');
	});

	it('a csúszka helyes értéke a tartományon belül kell legyen', () => {
		const d = {
			...emptyDraft(type('slider'), null),
			prompt: 'Hány?',
			slider: { min_value: 0, max_value: 10, step: 1, correct_value: 20, tolerance: 0 }
		};
		expect(draftError(d, TYPES)).toBe('A helyes értéknek a min-max tartományon belül kell lennie.');
	});

	it('a válaszidő 5 és 600 mp között érvényes', () => {
		const d = {
			...emptyDraft(type('true_false'), null),
			prompt: 'Q',
			time_limit_seconds: 2
		};
		expect(draftError(d, TYPES)).toMatch(/válaszidő/);
	});

	it('a mentésre küldött opciók sorszáma stabil (a szerver ez alapján frissít helyben)', () => {
		const d = {
			...emptyDraft(type('multi_choice'), null),
			prompt: 'Q',
			options: [
				{ text: 'A', image_url: null, is_correct: true },
				{ text: 'B', image_url: null, is_correct: false },
				{ text: 'C', image_url: null, is_correct: true }
			]
		};
		const parsed = parseQuestionForm(draftToFormData(d, TYPES), 'multi_choice');
		expect(parsed.choiceOptions?.map((o) => [o.order_index, o.is_correct])).toEqual([
			[0, true],
			[1, false],
			[2, true]
		]);
	});

	it('a sorrend-elemek helyes pozíciója 1-től számozott', () => {
		const d = { ...emptyDraft(type('ordering'), null), prompt: 'Q', ordering: ['x', 'y'] };
		const parsed = parseQuestionForm(draftToFormData(d, TYPES), 'ordering');
		expect(parsed.orderingItems).toEqual([
			{ item_text: 'x', correct_position: 1 },
			{ item_text: 'y', correct_position: 2 }
		]);
	});
});
