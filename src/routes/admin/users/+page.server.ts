import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Csak super_admin (role_id = 1) — az /admin layout guard-ja (1,2) tágabb,
// ez a szűkítés ide, a route-hoz kötve tartozik. Teljes megvalósítás:
// Fázis B (lásd NEXT_STEPS.md), egyelőre csak a route-guard + placeholder.
export const load: PageServerLoad = async ({ parent }) => {
	const { profile } = await parent();
	if (profile.role_id !== 1) {
		kitError(403, 'Csak a rendszergazda kezelheti a felhasználókat.');
	}
	return {};
};
