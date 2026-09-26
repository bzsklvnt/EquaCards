import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Témák (a kérdések kategóriái) — lista · részlet (név, kérdések) · műveletek.
// docs/features/admin-workspace.md.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ data: themes }, { data: questions }] = await Promise.all([
		supabase.from('themes').select('id, title').order('title'),
		supabase
			.from('questions')
			.select('id, prompt, theme_id, last_used_at, question_types(code)')
			.not('theme_id', 'is', null)
			.order('created_at', { ascending: false })
	]);

	return {
		themes: (themes ?? []).map((t) => {
			const own = (questions ?? []).filter((q) => q.theme_id === t.id);
			return {
				id: t.id,
				title: t.title,
				count: own.length,
				fresh: own.filter((q) => !q.last_used_at).length,
				questions: own.slice(0, 60).map((q) => ({
					id: q.id,
					prompt: q.prompt,
					type_code: q.question_types?.code ?? ''
				}))
			};
		})
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A téma neve kötelező.' });
		}

		const { data: created, error } = await supabase
			.from('themes')
			.insert({ title })
			.select('id')
			.single();
		if (error || !created) {
			return fail(400, { error: error?.message ?? 'Nem sikerült.' });
		}
		return { success: true, createdId: created.id };
	},

	update: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const title = (formData.get('title') as string)?.trim();
		if (!id) return fail(400, { error: 'Hiányzó téma.' });
		if (!title) return fail(400, { error: 'A téma neve kötelező.' });
		const { error } = await supabase.from('themes').update({ title }).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

	delete: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { error } = await supabase.from('themes').delete().eq('id', id);
		if (error) {
			return fail(400, { error: error.message });
		}
		return { success: true };
	}
};
