// A kvízestek létszámkorlátja FŐBEN értendő (games.max_players), a
// jelentkezés pedig csapatonként történik a létszámmal együtt — lásd
// docs/features/landing-and-registration.md.
export type CapacityInput = {
	max_players: number | null;
	confirmed_players: number;
	confirmed_teams: number;
	waitlist_teams: number;
};

export type Capacity = {
	tone: 'open' | 'low' | 'full';
	remaining: number | null;
	percent: number;
	/** pl. "28 / 40 fő" vagy "Még 4 hely" vagy "Telt ház" */
	headline: string;
	detail: string;
};

// Ennyi szabad hely alatt jelezzük, hogy fogy a hely.
const LOW_THRESHOLD = 8;

export function describeCapacity(e: CapacityInput): Capacity {
	const teams = `${e.confirmed_teams} csapat`;
	if (!e.max_players) {
		return {
			tone: 'open',
			remaining: null,
			percent: 0,
			headline: `${e.confirmed_players} fő jelentkezett`,
			detail: teams
		};
	}

	const remaining = Math.max(e.max_players - e.confirmed_players, 0);
	const percent = Math.min(100, Math.round((e.confirmed_players / e.max_players) * 100));
	if (remaining === 0) {
		return {
			tone: 'full',
			remaining,
			percent: 100,
			headline: 'Telt ház',
			detail: e.waitlist_teams
				? `${e.waitlist_teams} csapat várólistán`
				: 'várólistára lehet jelentkezni'
		};
	}
	return {
		tone: remaining <= LOW_THRESHOLD ? 'low' : 'open',
		remaining,
		percent,
		headline:
			remaining <= LOW_THRESHOLD
				? `Még ${remaining} hely`
				: `${e.confirmed_players} / ${e.max_players} fő`,
		detail: teams
	};
}
