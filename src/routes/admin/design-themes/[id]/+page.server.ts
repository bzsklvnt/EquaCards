import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A szerkesztés a Vizuális témák oldalon történik (docs/features/admin-workspace.md).
export const load: PageServerLoad = ({ params }) => {
	redirect(303, `/admin/design-themes?id=${params.id}`);
};
