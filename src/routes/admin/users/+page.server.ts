import { error as kitError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Csak super_admin (role_id = 1) — az /admin layout guard-ja (1,2) tágabb,
// ez a szűkítés ide, a route-hoz kötve tartozik.
export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const { profile } = await parent();
	if (profile.role_id !== 1) {
		kitError(403, 'Csak a rendszergazda kezelheti a felhasználókat.');
	}

	const { data: users } = await supabase
		.from('profiles')
		.select('id, display_name, email, role_id, created_at')
		.order('created_at');

	const { data: roles } = await supabase.from('roles').select('id, code, label').order('id');

	return { users: users ?? [], roles: roles ?? [] };
};

export const actions: Actions = {
	updateRole: async ({ request, locals: { supabase, safeGetSession } }) => {
		const formData = await request.formData();
		const userId = formData.get('user_id') as string;
		const roleId = Number(formData.get('role_id'));

		if (!userId || !roleId) {
			return fail(400, { error: 'Hiányzó adat.' });
		}

		const { user } = await safeGetSession();
		if (user?.id === userId && roleId !== 1) {
			return fail(400, { error: 'Nem veheted el a saját rendszergazda jogosultságodat.' });
		}

		const { error } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
		if (error) {
			return fail(400, { error: error.message });
		}

		return { success: true };
	}
};
