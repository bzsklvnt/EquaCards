import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Fázis O5 — a bejelentkezés + profil-lekérdezés + szerepkör-ellenőrzés
// a szülő +layout.server.ts dolga, lásd reports/+page.server.ts jegyzete.
export const load: PageServerLoad = async ({ params, parent, locals: { supabase } }) => {
	const { profile } = await parent();

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
