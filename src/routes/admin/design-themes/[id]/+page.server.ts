import { error as kitError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseDesignThemeForm } from '$lib/server/design-themes';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: designTheme } = await supabase
		.from('design_themes')
		.select('id, title, is_default, design_tokens')
		.eq('id', params.id)
		.single();

	if (!designTheme) {
		kitError(404, 'A design téma nem található.');
	}

	return { designTheme };
};

export const actions: Actions = {
	update: async ({ request, params, locals: { supabase } }) => {
		const formData = await request.formData();
		const parsed = parseDesignThemeForm(formData);
		if ('error' in parsed) {
			return fail(400, { error: parsed.error });
		}

		const { error } = await supabase.from('design_themes').update(parsed).eq('id', params.id);
		if (error) {
			return fail(400, { error: error.message });
		}

		redirect(303, '/admin/design-themes');
	},

	delete: async ({ params, locals: { supabase } }) => {
		const { data: theme } = await supabase
			.from('design_themes')
			.select('is_default')
			.eq('id', params.id)
			.single();

		if (theme?.is_default) {
			return fail(400, {
				error: 'Az alapértelmezett témát nem törölheted — előbb jelölj ki egy másikat.'
			});
		}

		const { error } = await supabase.from('design_themes').delete().eq('id', params.id);
		if (error) {
			return fail(400, { error: error.message });
		}

		redirect(303, '/admin/design-themes');
	}
};
