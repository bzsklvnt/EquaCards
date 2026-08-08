import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: themes } = await supabase.from('themes').select('id, title').order('title');

	return { themes: themes ?? [] };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A téma neve kötelező.' });
		}

		const { error } = await supabase.from('themes').insert({ title });
		if (error) {
			return fail(400, { error: error.message });
		}
	},

	delete: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { error } = await supabase.from('themes').delete().eq('id', id);
		if (error) {
			return fail(400, { error: error.message });
		}
	}
};
