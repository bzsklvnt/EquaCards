import type { QuestionStandingsRow } from './protocol';

// Köri állás számítása (host) és a csapat szomszédainak kikeresése (telefon)
// — docs/architecture/REALTIME_PROTOCOL.md, question_standings_reveal /
// round_standings_update.

export type ScoreRow = { team_id: string; name: string; score: number };

/** Holtversenyben azonos helyezés (1, 2, 2, 4 …); az előző álláshoz képest
 * helyezés-változás és az utolsó kérdésnél szerzett pont. */
export function rankRows(
	rows: ScoreRow[],
	previous: Record<string, { rank: number; score: number }> = {}
): QuestionStandingsRow[] {
	const sorted = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'hu'));
	return sorted.map((row) => {
		const rank = 1 + sorted.filter((other) => other.score > row.score).length;
		const before = previous[row.team_id];
		return {
			team_id: row.team_id,
			name: row.name,
			score: row.score,
			rank,
			prev_rank: before?.rank ?? null,
			gained: row.score - (before?.score ?? 0)
		};
	});
}

export type Neighbourhood = {
	me: QuestionStandingsRow;
	ahead: QuestionStandingsRow | null;
	behind: QuestionStandingsRow | null;
	total: number;
};

/** A csapat saját sora, az előtte (jobb helyen) és a mögötte álló csapat. */
export function neighbours(
	rows: QuestionStandingsRow[],
	teamId: string | null | undefined
): Neighbourhood | null {
	if (!teamId) return null;
	const sorted = [...rows].sort((a, b) => a.rank - b.rank || b.score - a.score);
	const index = sorted.findIndex((r) => r.team_id === teamId);
	if (index === -1) return null;
	return {
		me: sorted[index],
		ahead: index > 0 ? sorted[index - 1] : null,
		behind: index < sorted.length - 1 ? sorted[index + 1] : null,
		total: sorted.length
	};
}
