import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase }, url }) => {
	const themeFilter = url.searchParams.get('theme_id');

	let query = supabase
		.from('questions')
		.select('id, prompt, points, last_used_at, theme_id, themes(title), question_types(label)')
		.order('created_at', { ascending: false });

	if (themeFilter) {
		query = query.eq('theme_id', themeFilter);
	}

	const [{ data: questions }, { data: themes }] = await Promise.all([
		query,
		supabase.from('themes').select('id, title').order('title')
	]);

	return { questions: questions ?? [], themes: themes ?? [], themeFilter };
};

export const actions: Actions = {
	delete: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { error } = await supabase.from('questions').delete().eq('id', id);
		if (error) {
			return fail(400, { error: error.message });
		}
	}
};
