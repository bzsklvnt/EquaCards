import { error as kitError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: game } = await supabase
		.from('games')
		.select('id, title, status')
		.eq('id', params.id)
		.single();

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	const [{ data: rounds }, { data: themes }] = await Promise.all([
		supabase
			.from('rounds')
			.select('id, title, order_index')
			.eq('game_id', game.id)
			.order('order_index'),
		supabase.from('themes').select('id, title').order('title')
	]);

	const roundQuestions: Record<
		string,
		{ question_id: string; order_index: number; prompt: string }[]
	> = {};

	for (const round of rounds ?? []) {
		const { data } = await supabase
			.from('round_questions')
			.select('question_id, order_index, questions(prompt)')
			.eq('round_id', round.id)
			.order('order_index');

		roundQuestions[round.id] = (data ?? []).map((rq) => ({
			question_id: rq.question_id,
			order_index: rq.order_index,
			prompt: rq.questions?.prompt ?? ''
		}));
	}

	return { game, rounds: rounds ?? [], themes: themes ?? [], roundQuestions };
};

export const actions: Actions = {
	addRound: async ({ request, params, locals: { supabase } }) => {
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A kör neve kötelező.' });
		}

		const { data: existing } = await supabase
			.from('rounds')
			.select('order_index')
			.eq('game_id', params.id)
			.order('order_index', { ascending: false })
			.limit(1);

		const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;

		const { error } = await supabase
			.from('rounds')
			.insert({ game_id: params.id, title, order_index: nextOrder });

		if (error) {
			return fail(400, { error: error.message });
		}
	},

	deleteRound: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const roundId = formData.get('round_id') as string;

		const { error } = await supabase.from('rounds').delete().eq('id', roundId);
		if (error) {
			return fail(400, { error: error.message });
		}
	},

	// Fázis O6 — a korábbi, körönkénti "válassz témát + Random húzás"
	// munkafolyamatot egyetlen, este-szintű téma-választó + egy összesített
	// gomb váltja fel; ez az action egy hívásban megy végig minden érintett
	// körön (a random húzás/cooldown lekérdezés maga változatlan, csak a
	// UI-triggerelés lett körönkéntiből egyetlen gombra vonva).
	drawAll: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const themeId = formData.get('theme_id') as string;
		const roundsJson = formData.get('rounds_json') as string;

		if (!themeId) {
			return fail(400, { error: 'Válassz témát a húzáshoz.' });
		}

		let roundsPayload: { round_id: string; title: string; count: number }[];
		try {
			roundsPayload = JSON.parse(roundsJson);
		} catch {
			return fail(400, { error: 'Hibás kör-adat, próbáld újra.' });
		}

		const errors: string[] = [];
		for (const { round_id, title, count } of roundsPayload) {
			const { data, error } = await supabase.rpc('draw_random_questions_for_round', {
				p_theme_id: themeId,
				p_round_id: round_id,
				p_count: count
			});

			if (error) {
				errors.push(`"${title}" kör: ${error.message}`);
			} else if (!data || data.length === 0) {
				errors.push(`"${title}" kör: nincs elérhető kérdés ebben a témában.`);
			}
		}

		if (errors.length > 0) {
			return fail(400, { error: errors.join(' ') });
		}
	},

	removeQuestion: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const roundId = formData.get('round_id') as string;
		const questionId = formData.get('question_id') as string;

		const { error } = await supabase
			.from('round_questions')
			.delete()
			.eq('round_id', roundId)
			.eq('question_id', questionId);

		if (error) {
			return fail(400, { error: error.message });
		}
	}
};
