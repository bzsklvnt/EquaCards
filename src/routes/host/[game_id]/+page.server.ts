import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: game } = await supabase
		.from('games')
		.select('id, title, pin, status')
		.eq('id', params.game_id)
		.single();

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	return { game };
};
