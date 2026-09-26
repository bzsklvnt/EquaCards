import { error as kitError, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appendQuestionsToRound, createQuestionFromForm } from '$lib/server/questions';
import { reopenGameAction } from '$lib/server/games';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// Élő tesztből: a körönkénti round_questions lekérdezés korábban
	// soros N+1 kör-utazás volt (körönként egy), ami a Vercel ↔ Supabase
	// késleltetéssel érezhetően lassította az oldalt és a host "Kilépés"
	// navigációt. Most minden lekérdezés egyetlen párhuzamos körben fut.
	const [
		{ data: game },
		{ data: rounds },
		{ data: themes },
		{ data: rqRows },
		{ data: bank },
		{ data: questionTypes }
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
			.select('round_id, question_id, order_index, questions(prompt), rounds!inner(game_id)')
			.eq('rounds.game_id', params.id)
			.order('order_index'),
		supabase
			.from('questions')
			.select('id, prompt, theme_id, question_types(label)')
			.order('created_at', { ascending: false }),
		// A kör szerkesztőjének "Új kérdés" felugró űrlapjához
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id')
	]);

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	const roundQuestions: Record<
		string,
		{ question_id: string; order_index: number; prompt: string }[]
	> = {};
	for (const round of rounds ?? []) {
		roundQuestions[round.id] = [];
	}
	for (const rq of rqRows ?? []) {
		roundQuestions[rq.round_id]?.push({
			question_id: rq.question_id,
			order_index: rq.order_index,
			prompt: rq.questions?.prompt ?? ''
		});
	}

	return {
		game,
		rounds: rounds ?? [],
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		roundQuestions,
		bank: (bank ?? []).map((q) => ({
			id: q.id,
			prompt: q.prompt,
			theme_id: q.theme_id,
			type_label: q.question_types?.label ?? ''
		}))
	};
};

// Fázis Q4 — kör/kérdés szerkesztés games.status-tól függetlenül. Alapos
// audit (RLS: rounds_staff_all / round_questions_admin_all /
// draw_random_questions_for_round RPC, ez a fájl) nem talált SEHOL
// games.status-alapú korlátozást — sem lobby/active/paused/finished
// bármelyikén nem volt tiltás, tehát nem kellett feloldani semmit
// kódszinten. Élőben, rollback-kal lezárt SQL-szimulációval megerősítve:
// egy round_questions insert egy 'finished' állapotú este körére is
// hibátlanul lefut. Ez a megjegyzés szándékosan itt marad, hogy egy
// jövőbeli változtatás ne vezessen be véletlenül egy ilyen korlátozást —
// lásd docs/DECISIONS_LOG.md Fázis Q4 bejegyzését.
export const actions: Actions = {
	// Lezárt este újranyitása az este saját oldaláról (reopenGameAction).
	reopen: async ({ request, locals: { supabase } }) => {
		const failure = await reopenGameAction(supabase, await request.formData());
		if (failure) return fail(400, failure);
		return { success: true, reopened: true };
	},

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
	// körön. Szándékosan SOROS (nem Promise.all): a húzás a last_used_at
	// cooldown-szűrőre támaszkodik, amit a round_questions insert triggere
	// frissít — párhuzamos hívásoknál két kör ugyanazt a kérdést kaphatná.
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
	},

	clearRound: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const roundId = formData.get('round_id') as string;

		const { error } = await supabase.from('round_questions').delete().eq('round_id', roundId);
		if (error) {
			return fail(400, { error: error.message });
		}
	},

	// Kézi válogatás a kérdésbankból — a random húzás alternatívája.
	addQuestions: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const roundId = formData.get('round_id') as string;
		const questionIds = [...new Set(formData.getAll('question_id') as string[])];

		if (!roundId || questionIds.length === 0) {
			return fail(400, { error: 'Válassz legalább egy kérdést.' });
		}

		const result = await appendQuestionsToRound(supabase, roundId, questionIds);
		if (result.error) {
			return fail(400, { error: result.error });
		}
		if (result.added === 0) {
			return fail(400, { error: 'A kiválasztott kérdések már szerepelnek ebben a körben.' });
		}
	},

	// "+ Új kérdés ehhez a körhöz": a kör szerkesztőjében felugró űrlapból —
	// a kérdés a kérdésbankba mentődik, és azonnal a kör végére kerül, az
	// oldal elhagyása nélkül.
	createQuestion: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const formData = await request.formData();
		const roundId = formData.get('round_id') as string | null;
		if (!roundId) return fail(400, { error: 'Hiányzó kör.' });

		const created = await createQuestionFromForm(supabase, formData, user?.id);
		if ('error' in created) return fail(400, { error: created.error });

		const { error: appendError } = await appendQuestionsToRound(supabase, roundId, [created.id]);
		if (appendError) {
			return fail(400, {
				error: `A kérdés elmentve a kérdésbankba, de nem sikerült a körhöz adni: ${appendError}`
			});
		}
		return { success: true, questionCreated: true };
	}
};
