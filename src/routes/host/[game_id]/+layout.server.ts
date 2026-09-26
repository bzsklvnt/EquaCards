import { error as kitError } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals: { supabase } }) => {
	const [{ data: game }, { data: rounds }, { data: designThemes }] = await Promise.all([
		supabase
			.from('games')
			.select(
				'id, title, pin, status, current_round_id, current_question_id, design_theme_id, join_requires_code'
			)
			.eq('id', params.game_id)
			.single(),
		supabase
			.from('rounds')
			.select('id, title, order_index')
			.eq('game_id', params.game_id)
			.order('order_index'),
		supabase.from('design_themes').select('id, title').order('title')
	]);

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	return { game, rounds: rounds ?? [], designThemes: designThemes ?? [] };
};
