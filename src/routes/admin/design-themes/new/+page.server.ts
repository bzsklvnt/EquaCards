import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Új téma a Vizuális témák oldalon (docs/features/admin-workspace.md).
export const load: PageServerLoad = () => {
	redirect(303, '/admin/design-themes?new=1');
};
