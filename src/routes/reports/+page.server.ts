import type { PageServerLoad } from './$types';

// Fázis O5 — a bejelentkezés + profil-lekérdezés + szerepkör-ellenőrzés
// a szülő +layout.server.ts dolga (közös a [game_id] aloldallal).
export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const { profile } = await parent();

	// Minden adat security-definer RPC-ken keresztül jön — a viewer
	// szerepkörnek nincs (és nem is kell, hogy legyen) közvetlen SELECT
	// joga a games/teams/questions/themes stb. táblákon. Részletek:
	// docs/features/reports.md.
	const [finishedGames, designThemeUsage, contentThemeUsage, avgResponseTimes] = await Promise.all([
		supabase.rpc('reports_finished_games'),
		supabase.rpc('reports_design_theme_usage'),
		supabase.rpc('reports_content_theme_usage'),
		supabase.rpc('reports_avg_response_time_by_type')
	]);

	return {
		profile,
		finishedGames: finishedGames.data ?? [],
		designThemeUsage: designThemeUsage.data ?? [],
		contentThemeUsage: contentThemeUsage.data ?? [],
		avgResponseTimes: avgResponseTimes.data ?? []
	};
};
