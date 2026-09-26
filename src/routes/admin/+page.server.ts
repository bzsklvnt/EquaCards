import type { PageServerLoad } from './$types';

// Vezérlőpult: a következő esték a jelentkezési létszámmal.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
	const { data } = await supabase
		.from('games')
		.select(
			'id, title, status, scheduled_at, is_public, max_players, venues(name), team_registrations(headcount, status)'
		)
		.eq('is_practice', false)
		.neq('status', 'finished')
		.gte('scheduled_at', since)
		.order('scheduled_at')
		.limit(6);

	return {
		upcoming: (data ?? []).map(({ team_registrations, ...game }) => ({
			...game,
			confirmedPlayers: (team_registrations ?? [])
				.filter((r) => r.status === 'confirmed')
				.reduce((sum, r) => sum + r.headcount, 0),
			waitlistTeams: (team_registrations ?? []).filter((r) => r.status === 'waitlist').length
		}))
	};
};
