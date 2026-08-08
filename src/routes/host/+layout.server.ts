import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

// role_id 1/2/3 = super_admin/admin/host — "games indítás/vezérlés" a
// docs/architecture/DATA_MODEL.md 1. szakasza szerint. Ez tágabb kör, mint az
// /admin guard-ja (1,2), mert a host (3) futtathat estét, de nem fér az
// admin kérdésbankhoz.
const HOST_ROLE_IDS = [1, 2, 3];

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

	if (!profile || !HOST_ROLE_IDS.includes(profile.role_id)) {
		error(403, 'Nincs jogosultságod ehhez az oldalhoz.');
	}

	return { profile };
};
