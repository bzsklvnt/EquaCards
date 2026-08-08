import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { parseDesignThemeForm } from '$lib/server/design-themes';

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const parsed = parseDesignThemeForm(formData);
		if ('error' in parsed) {
			return fail(400, { error: parsed.error });
		}

		const { error } = await supabase.from('design_themes').insert(parsed);
		if (error) {
			return fail(400, { error: error.message });
		}

		redirect(303, '/admin/design-themes');
	}
};
