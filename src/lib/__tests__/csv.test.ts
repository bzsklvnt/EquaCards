import { describe, expect, it } from 'vitest';
import { CSV_TEMPLATE, parseCsv, readQuestionCsv } from '$lib/questions/csv';
import type { QuestionTypeInfo } from '$lib/builder/model';

const TYPES: QuestionTypeInfo[] = [
	{ id: 1, code: 'single_choice', label: 'Egy helyes', min_options: 4, max_options: 4 },
	{ id: 2, code: 'multi_choice', label: 'Több helyes', min_options: 6, max_options: 8 },
	{ id: 3, code: 'slider', label: 'Csúszka', min_options: null, max_options: null },
	{ id: 4, code: 'true_false', label: 'Igaz/hamis', min_options: 2, max_options: 2 },
	{ id: 5, code: 'ordering', label: 'Sorrend', min_options: null, max_options: null },
	{ id: 6, code: 'info', label: 'Info', min_options: null, max_options: null }
];
const read = (text: string) => readQuestionCsv(text, TYPES, { defaultTime: 30 });

describe('CSV értelmezése', () => {
	it('idézőjelek, beágyazott elválasztó és sortörés, BOM', () => {
		const rows = parseCsv('\uFEFFa;b\r\n"x;y";"sor1\nsor2"\r\n"idéz ""ő""";2\n');
		expect(rows).toEqual([
			['a', 'b'],
			['x;y', 'sor1\nsor2'],
			['idéz "ő"', '2']
		]);
	});

	it('vesszős fájlt is felismer', () => {
		expect(parseCsv('kérdés,helyes\nMi?,A')).toEqual([
			['kérdés', 'helyes'],
			['Mi?', 'A']
		]);
	});

	it('a mintafájl minden sora hibátlan', () => {
		const { rows, error } = read(CSV_TEMPLATE);
		expect(error).toBeNull();
		expect(rows).toHaveLength(5);
		for (const row of rows) expect(row.errors).toEqual([]);
		expect(rows.map((r) => r.draft?.type_code)).toEqual([
			'single_choice',
			'multi_choice',
			'true_false',
			'slider',
			'ordering'
		]);
		expect(rows[0].themeTitle).toBe('Földrajz');
		expect(rows[1].draft?.options.filter((o) => o.is_correct).map((o) => o.text)).toEqual([
			'Duna',
			'Tisza',
			'Rába',
			'Dráva'
		]);
		expect(rows[3].draft?.slider.correct_value).toBe(1849);
		expect(rows[4].draft?.ordering).toEqual([
			'Honfoglalás',
			'Mohácsi csata',
			'1848-as forradalom',
			'Rendszerváltás'
		]);
	});

	it('soronkénti hibák', () => {
		const { rows } = read(
			[
				'téma;típus;kérdés;A;B;C;D;helyes',
				'X;egy helyes;Kérdés;1;2;3;4;',
				'X;egy helyes;Kérdés;1;2;3;4;E',
				'X;valami;Kérdés;1;2;3;4;A',
				'X;egy helyes;;1;2;3;4;A',
				'X;egy helyes;Kérdés;1;2;3;;A'
			].join('\n')
		);
		expect(rows[0].errors[0]).toMatch(/Hiányzik a helyes/);
		expect(rows[1].errors[0]).toMatch(/nincs válasz/);
		expect(rows[2].errors[0]).toMatch(/Ismeretlen típus/);
		expect(rows[3].errors[0]).toMatch(/kérdés szövege kötelező/);
		expect(rows[4].errors[0]).toMatch(/Legalább 4 opció/);
		expect(rows.every((r) => r.draft === null)).toBe(true);
	});

	it('kérdés oszlop nélkül a fájl nem értelmezhető', () => {
		expect(read('a;b\n1;2').error).toMatch(/kérdés/);
	});

	it('a típus a kitöltésből is kikövetkeztethető', () => {
		const { rows } = read(['kérdés;helyes;min;max', 'Hány?;5;0;10', 'Igaz-e?;hamis;;'].join('\n'));
		expect(rows[0].draft?.type_code).toBe('slider');
		expect(rows[1].draft?.type_code).toBe('true_false');
		expect(rows[1].draft?.options[1].is_correct).toBe(true);
	});
});
