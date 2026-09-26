import type { PageServerLoad } from './$types';

// Vezérlőpult: a következő esték a jelentkezési létszámmal és néhány
// összesítő szám — docs/features/admin-workspace.md.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
	const [{ data }, { count: questionCount }, { count: freshCount }, { data: live }] =
		await Promise.all([
			supabase
				.from('games')
				.select(
					'id, title, status, scheduled_at, is_public, max_players, venues(name), team_registrations(headcount, status)'
				)
				.eq('is_practice', false)
				.neq('status', 'finished')
				.gte('scheduled_at', since)
				.order('scheduled_at')
				.limit(8),
			supabase.from('questions').select('id', { count: 'exact', head: true }),
			supabase
				.from('questions')
				.select('id', { count: 'exact', head: true })
				.is('last_used_at', null),
			supabase.from('games').select('id, title').in('status', ['active', 'paused']).limit(3)
		]);

	return {
		upcoming: (data ?? []).map(({ team_registrations, ...game }) => ({
			...game,
			confirmedPlayers: (team_registrations ?? [])
				.filter((r) => r.status === 'confirmed')
				.reduce((sum, r) => sum + r.headcount, 0),
			confirmedTeams: (team_registrations ?? []).filter((r) => r.status === 'confirmed').length,
			waitlistTeams: (team_registrations ?? []).filter((r) => r.status === 'waitlist').length
		})),
		questionCount: questionCount ?? 0,
		freshCount: freshCount ?? 0,
		live: live ?? []
	};
};
