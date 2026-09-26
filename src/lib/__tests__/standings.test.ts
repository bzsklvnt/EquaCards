import { describe, expect, it } from 'vitest';
import { neighbours, rankRows } from '$lib/realtime/standings';

describe('köri állás', () => {
	it('holtversenyben azonos helyezés, utána kihagyott hely', () => {
		const rows = rankRows([
			{ team_id: 'a', name: 'Alfa', score: 900 },
			{ team_id: 'b', name: 'Béta', score: 1200 },
			{ team_id: 'c', name: 'Cézár', score: 900 },
			{ team_id: 'd', name: 'Delta', score: 100 }
		]);
		expect(rows.map((r) => [r.team_id, r.rank])).toEqual([
			['b', 1],
			['a', 2],
			['c', 2],
			['d', 4]
		]);
	});

	it('helyezés-változás és szerzett pont az előző álláshoz képest', () => {
		const rows = rankRows([{ team_id: 'a', name: 'Alfa', score: 1500 }], {
			a: { rank: 3, score: 600 }
		});
		expect(rows[0]).toMatchObject({ rank: 1, prev_rank: 3, gained: 900 });
	});

	it('a csapat előtte és mögötte álló szomszédai', () => {
		const rows = rankRows([
			{ team_id: 'a', name: 'A', score: 3 },
			{ team_id: 'b', name: 'B', score: 2 },
			{ team_id: 'c', name: 'C', score: 1 }
		]);
		const n = neighbours(rows, 'b');
		expect(n?.ahead?.team_id).toBe('a');
		expect(n?.behind?.team_id).toBe('c');
		expect(n?.total).toBe(3);
	});
});
