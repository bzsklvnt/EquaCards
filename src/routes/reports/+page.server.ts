import { error as kitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Minden authentikált staff szerepkör (super_admin/admin/host/viewer) —
// DATA_MODEL.md 1. szakasza szerint a viewer feladata pont a statisztikák/
// riportok megtekintése.
const REPORT_ROLE_IDS = [1, 2, 3, 4];

export const load: PageServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
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
