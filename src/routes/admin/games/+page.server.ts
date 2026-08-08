import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function generatePin(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: games } = await supabase
		.from('games')
		.select('id, title, status, created_at')
		.order('created_at', { ascending: false });

	return { games: games ?? [] };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A kvízeste neve kötelező.' });
		}

		const { data: game, error } = await supabase
			.from('games')
			.insert({ title, pin: generatePin() })
			.select('id')
			.single();

		if (error || !game) {
			return fail(400, { error: error?.message ?? 'Nem sikerült létrehozni a kvízestét.' });
		}

		redirect(303, `/admin/games/${game.id}`);
	}
};
