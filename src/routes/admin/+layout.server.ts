import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// role_id 1 = super_admin, 2 = admin — lásd docs/architecture/DATA_MODEL.md 1. szakasz
const ADMIN_ROLE_IDS = [1, 2];

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

	if (!profile || !ADMIN_ROLE_IDS.includes(profile.role_id)) {
		error(403, 'Nincs jogosultságod ehhez az oldalhoz.');
	}

	return { profile };
};
