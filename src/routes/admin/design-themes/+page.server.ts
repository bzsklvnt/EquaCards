import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { parseDesignThemeForm } from '$lib/server/design-themes';
import { defaultTokens } from '$lib/theme/tokens';

// Vizuális témák — lista · élő előnézet (kivetítő + telefon) · színek és
// tokenek (automatikus mentés). docs/features/admin-workspace.md.
export const load: PageServerLoad = async ({ depends, locals: { supabase } }) => {
	depends('app:page');
	const { data: designThemes } = await supabase
		.from('design_themes')
		.select('id, title, is_default, design_tokens')
		.order('title');

	return {
		designThemes: (designThemes ?? []).map((t) => ({
			...t,
			design_tokens: (t.design_tokens ?? {}) as Record<string, string>
		}))
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const title = ((await request.formData()).get('title') as string)?.trim();
		if (!title) return fail(400, { error: 'A téma neve kötelező.' });
		// Az új téma a Letisztult alapkészletből indul, utána szabadon átszínezhető.
		const { data: created, error } = await supabase
			.from('design_themes')
			.insert({ title, is_default: false, design_tokens: defaultTokens })
			.select('id')
			.single();
		if (error || !created) return fail(400, { error: error?.message ?? 'Nem sikerült.' });
		return { success: true, createdId: created.id };
	},

	update: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Hiányzó téma.' });
		const parsed = parseDesignThemeForm(formData);
		if ('error' in parsed) return fail(400, { error: parsed.error });
		const { error } = await supabase.from('design_themes').update(parsed).eq('id', id);
		if (error) return fail(400, { error: error.message });
		return { success: true };
	},

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
		return { success: true };
	}
};
