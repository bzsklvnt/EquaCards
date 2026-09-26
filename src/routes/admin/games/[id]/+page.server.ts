import { error as kitError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { reopenGameAction } from '$lib/server/games';
import { loadBank, loadDrafts, readingDefault } from '$lib/server/builder';

// Kvízösszerakó — docs/features/quiz-builder.md. A szerkesztési műveletek a
// ./builder JSON végponton mennek (automatikus mentés, átrendezés,
// kérdésbank), ez a load csak a kezdőállapotot adja.
//
// Fázis Q4 óta érvényes: a kör/kérdés szerkesztés games.status-tól
// független (lezárt estén is szerkeszthető) — lásd docs/DECISIONS_LOG.md.
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [
		{ data: game },
		{ data: rounds },
		{ data: themes },
		{ data: rqRows },
		{ data: questionTypes },
		bank,
		reading
	] = await Promise.all([
		supabase.from('games').select('id, title, status').eq('id', params.id).single(),
		supabase
			.from('rounds')
			.select('id, title, order_index')
			.eq('game_id', params.id)
			.order('order_index'),
		supabase.from('themes').select('id, title').order('title'),
		supabase
			.from('round_questions')
			.select('round_id, question_id, order_index, show_standings, rounds!inner(game_id)')
			.eq('rounds.game_id', params.id)
			.order('order_index'),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id'),
		loadBank(supabase, params.id),
		readingDefault(supabase)
	]);

	if (!game) kitError(404, 'A kvízeste nem található.');

	const questionIds = [...new Set((rqRows ?? []).map((r) => r.question_id))];
	const drafts = await loadDrafts(supabase, questionIds);

	return {
		workspace: true,
		game,
		rounds: (rounds ?? []).map((r) => ({
			id: r.id,
			title: r.title,
			questionIds: (rqRows ?? []).filter((q) => q.round_id === r.id).map((q) => q.question_id),
			hiddenStandings: (rqRows ?? [])
				.filter((q) => q.round_id === r.id && !q.show_standings)
				.map((q) => q.question_id)
		})),
		drafts,
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		bank,
		readingDefault: reading
	};
};

export const actions: Actions = {
	// Lezárt este újranyitása az este saját oldaláról (reopenGameAction).
	reopen: async ({ request, locals: { supabase } }) => {
		const failure = await reopenGameAction(supabase, await request.formData());
		if (failure) return fail(400, failure);
		return { success: true, reopened: true };
	}
};
