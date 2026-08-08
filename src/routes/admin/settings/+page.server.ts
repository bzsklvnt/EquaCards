import { error as kitError, fail } from '@sveltejs/kit';
import type { Json } from '$lib/types/database.types';
import type { Actions, PageServerLoad } from './$types';

// Csak super_admin (role_id = 1) — ugyanaz a route-szintű szűkítés, mint
// a /admin/users-nél.
export const load: PageServerLoad = async ({ parent, locals: { supabase } }) => {
	const { profile } = await parent();
	if (profile.role_id !== 1) {
		kitError(403, 'Csak a rendszergazda módosíthatja a globális beállításokat.');
	}

	// Szándékosan nincs hardcode-olt kulcs-lista — bármi, ami az
	// app_settings táblában van, automatikusan megjelenik itt (lásd
	// docs/features/app-settings.md).
	const { data: settings } = await supabase
		.from('app_settings')
		.select('key, value, updated_at')
		.order('key');

	return { settings: settings ?? [] };
};

export const actions: Actions = {
	update: async ({ request, locals: { supabase, safeGetSession } }) => {
		const formData = await request.formData();
		const key = formData.get('key') as string;
		const valueType = formData.get('value_type') as string;
		const raw = formData.get('value') as string | null;

		if (!key) {
			return fail(400, { error: 'Hiányzó kulcs.' });
		}

		let value: Json;
		try {
			switch (valueType) {
				case 'number': {
					const n = Number(raw);
					if (Number.isNaN(n)) throw new Error('Érvénytelen szám.');
					value = n;
					break;
				}
				case 'boolean':
					value = raw === 'true';
					break;
				case 'json':
					value = JSON.parse(raw ?? 'null');
					break;
				default:
					value = raw ?? '';
			}
		} catch {
			return fail(400, { error: 'Érvénytelen érték formátum.', key });
		}

		const { user } = await safeGetSession();
		const { error } = await supabase
			.from('app_settings')
			.update({ value, updated_at: new Date().toISOString(), updated_by: user?.id })
			.eq('key', key);

		if (error) {
			return fail(400, { error: error.message, key });
		}

		return { success: true, key };
	}
};
