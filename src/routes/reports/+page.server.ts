import { error as kitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Minden authentikált staff szerepkör (super_admin/admin/host/viewer) —
// DATA_MODEL.md 1. szakasza szerint a viewer feladata pont a statisztikák/
// riportok megtekintése. Teljes megvalósítás: Fázis D (lásd NEXT_STEPS.md),
// egyelőre csak a route-guard + placeholder.
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

	return { profile };
};
