import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// Minden authentikált staff szerepkör (super_admin/admin/host/viewer) —
// DATA_MODEL.md 1. szakasza szerint a viewer feladata pont a statisztikák/
// riportok megtekintése. Fázis O5 — kiemelve az egyes page.server.ts-ekből
// egy közös layoutba, hogy a /reports* fa is megkapja a DashboardShell-t
// (sidebar/header/vissza-navigáció) az admin route-okhoz hasonlóan.
const REPORT_ROLE_IDS = [1, 2, 3, 4];

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, supabase } }) => {
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
		error(403, 'Nincs jogosultságod ehhez az oldalhoz.');
	}

	return { profile };
};
