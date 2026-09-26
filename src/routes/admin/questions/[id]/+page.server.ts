import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A kérdés szerkesztése a kérdésbank vásznán történik (docs/features/admin-workspace.md).
export const load: PageServerLoad = ({ params }) => {
	redirect(303, `/admin/questions?id=${params.id}`);
};
