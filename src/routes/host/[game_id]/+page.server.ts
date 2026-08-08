import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: game } = await supabase
		.from('games')
		.select('id, title, pin, status, current_round_id, current_question_id')
		.eq('id', params.game_id)
		.single();

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	const { data: rounds } = await supabase
		.from('rounds')
		.select('id, title, order_index')
		.eq('game_id', game.id)
		.order('order_index');

	return { game, rounds: rounds ?? [] };
};
