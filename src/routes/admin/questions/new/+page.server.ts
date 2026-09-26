import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Az új kérdés a kérdésbank vásznán készül (docs/features/admin-workspace.md).
export const load: PageServerLoad = () => {
	redirect(303, '/admin/questions?new=1');
};
