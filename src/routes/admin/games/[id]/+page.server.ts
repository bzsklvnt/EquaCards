import { error as kitError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { reopenGameAction } from '$lib/server/games';
import { loadBank, loadGameRoundQuestions, questionDefaults } from '$lib/server/builder';

// Kvízösszerakó — docs/features/quiz-builder.md. A szerkesztési műveletek a
// ./builder JSON végponton mennek (automatikus mentés, átrendezés,
// kérdésbank), ez a load csak a kezdőállapotot adja.
//
// Fázis Q4 óta érvényes: a kör/kérdés szerkesztés games.status-tól
// független (lezárt estén is szerkeszthető) — lásd docs/DECISIONS_LOG.md.
export const load: PageServerLoad = async ({ depends, params, locals: { supabase } }) => {
	depends('app:page');
	// Egy lépcsőben: a körök kérdései a teljes piszkozatokkal együtt jönnek
	// (loadGameRoundQuestions), nincs második, a kérdés-azonosítóktól függő kör.
	const [
		{ data: game },
		{ data: rounds },
		{ data: themes },
		roundQuestions,
		{ data: questionTypes },
		bank,
		defaults
	] = await Promise.all([
		supabase.from('games').select('id, title, status').eq('id', params.id).single(),
		supabase
			.from('rounds')
			.select('id, title, order_index')
			.eq('game_id', params.id)
			.order('order_index'),
		supabase.from('themes').select('id, title').order('title'),
		loadGameRoundQuestions(supabase, params.id),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id'),
		loadBank(supabase, params.id),
		questionDefaults(supabase)
	]);

	if (!game) kitError(404, 'A kvízeste nem található.');

	const rqRows = roundQuestions.rows;
	return {
		workspace: true,
		game,
		rounds: (rounds ?? []).map((r) => ({
			id: r.id,
			title: r.title,
			questionIds: rqRows.filter((q) => q.round_id === r.id).map((q) => q.question_id),
			hiddenStandings: rqRows
				.filter((q) => q.round_id === r.id && !q.show_standings)
				.map((q) => q.question_id)
		})),
		drafts: roundQuestions.drafts,
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		bank,
		readingDefault: defaults.readingDefault,
		defaultTime: defaults.defaultTime
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
