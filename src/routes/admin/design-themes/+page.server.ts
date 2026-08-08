import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: designThemes } = await supabase
		.from('design_themes')
		.select('id, title, is_default')
		.order('title');

	return { designThemes: designThemes ?? [] };
};

export const actions: Actions = {
	delete: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { data: theme } = await supabase
			.from('design_themes')
			.select('is_default')
			.eq('id', id)
			.single();

		if (theme?.is_default) {
			return fail(400, {
				error: 'Az alapértelmezett témát nem törölheted — előbb jelölj ki egy másikat.'
			});
		}

		const { count } = await supabase
			.from('design_themes')
			.select('id', { count: 'exact', head: true });

		if ((count ?? 0) <= 1) {
			return fail(400, {
				error: 'Ez az utolsó design téma — legalább egynek léteznie kell.'
			});
		}

		const { error } = await supabase.from('design_themes').delete().eq('id', id);
		if (error) {
			return fail(400, { error: error.message });
		}
	}
};
