import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Csak super_admin (role_id = 1). Teljes megvalósítás: Fázis C (lásd
// NEXT_STEPS.md), egyelőre csak a route-guard + placeholder.
export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	if (profile.role_id !== 1) {
		kitError(403, 'Csak a rendszergazda módosíthatja a globális beállításokat.');
	}
	return {};
};
