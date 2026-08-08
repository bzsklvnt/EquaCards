import { error as kitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const REPORT_ROLE_IDS = [1, 2, 3, 4];

export const load: PageServerLoad = async ({ params, locals: { safeGetSession, supabase } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, '/login');
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('role_id, display_name')
		.eq('id', user.id)
		.single();

	if (!profile || !REPORT_ROLE_IDS.includes(profile.role_id)) {
		kitError(403, 'Nincs jogosultságod ehhez az oldalhoz.');
	}

	// A viewer szerepkörnek nincs közvetlen SELECT joga a games táblán,
	// ezért a cím/dátum is a lezárt-esték RPC-ből jön, nem egy külön
	// `.from('games')` hívásból.
	const [{ data: games }, { data: leaderboard }] = await Promise.all([
		supabase.rpc('reports_finished_games'),
		supabase.rpc('reports_game_leaderboard', { p_game_id: params.game_id })
	]);

	const game = games?.find((g) => g.id === params.game_id);
	if (!game) {
		kitError(404, 'Az este nem található, vagy még nem zárult le.');
	}

	return { profile, game, leaderboard: leaderboard ?? [] };
};
