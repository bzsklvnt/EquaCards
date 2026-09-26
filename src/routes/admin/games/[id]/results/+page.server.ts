import { error as kitError, fail } from '@sveltejs/kit';
import { reopenGameAction } from '$lib/server/games';
import type { Actions, PageServerLoad } from './$types';

// Fázis Q2 — részletes, körönkénti/kérdésenkénti eredmény-bontás
// KIZÁRÓLAG a kezelőfelületen. Ez a route a /admin fa alatt van, tehát a
// /admin/+layout.server.ts guard-ja (role_id in (1,2)) már eleve
// érvényesül rá — nincs szükség itt külön jogosultság-ellenőrzésre.
// KRITIKUS: ez a nézet SOSE kerülhet a /tv vagy /play felületre, sem a
// docs/architecture/REALTIME_PROTOCOL.md szerinti broadcast eseményekbe
// (round_leaderboard_reveal/final_leaderboard_reveal továbbra is csak
// top3/összesített rangsort tartalmaz) — lásd docs/features/staff-results.md.
//
// Az `answers` tábla RLS policy-ja (`answers_staff_all`, role_id in
// (1,2,3)) miatt ez a lekérdezés csapatra/kérdésre való szűkítés nélkül,
// az ÖSSZES csapat válaszát visszaadja — ez itt szándékos (a nézet célja
// pont ez), de kizárólag azért biztonságos, mert ez a route maga is
// staff-only.
export const load: PageServerLoad = async ({ depends, params, locals: { supabase } }) => {
	depends('app:page');
	// Egyetlen párhuzamos kör: minden lekérdezés az este azonosítójára szűr
	// (a körök kérdései és a válaszok beágyazva hozzák a típusadatokat).
	const [
		{ data: game },
		{ data: rounds },
		{ data: teams },
		{ data: roundQuestionRows },
		{ data: answerRows }
	] = await Promise.all([
		supabase.from('games').select('id, title, status, pin').eq('id', params.id).single(),
		supabase
			.from('rounds')
			.select('id, title, order_index')
			.eq('game_id', params.id)
			.order('order_index'),
		supabase.from('teams').select('id, name').eq('game_id', params.id).order('name'),
		supabase
			.from('round_questions')
			.select(
				'round_id, order_index, question_id, rounds!inner(game_id), questions(prompt, question_type_id, question_types(code), question_choice_options(id, question_id, option_text, is_correct, order_index), question_slider_config(question_id, correct_value), question_ordering_items(id, question_id, item_text, correct_position))'
			)
			.eq('rounds.game_id', params.id)
			.order('order_index'),
		supabase
			.from('answers')
			.select(
				'id, question_id, team_id, is_correct, points_awarded, answer_time_ms, answer_choice(answer_id, option_id), answer_choice_multi(answer_id, option_id), answer_slider(answer_id, value), answer_ordering(answer_id, item_id, position)'
			)
			.eq('game_id', params.id)
	]);

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	if ((rounds ?? []).length === 0 || !teams || teams.length === 0) {
		return { workspace: true, game, rounds: [], teams: teams ?? [] };
	}

	const roundQuestions = roundQuestionRows ?? [];
	const byOrder = <T extends { order_index?: number; correct_position?: number }>(a: T, b: T) =>
		(a.order_index ?? a.correct_position ?? 0) - (b.order_index ?? b.correct_position ?? 0);
	const choiceOptions = roundQuestions
		.flatMap((rq) => rq.questions?.question_choice_options ?? [])
		.sort(byOrder);
	const sliderConfigs = roundQuestions
		.map((rq) => rq.questions?.question_slider_config)
		.filter((c): c is NonNullable<typeof c> => !!c);
	const orderingItems = roundQuestions
		.flatMap((rq) => rq.questions?.question_ordering_items ?? [])
		.sort(byOrder);
	const answers = (answerRows ?? []).map((a) => ({
		id: a.id,
		question_id: a.question_id,
		team_id: a.team_id,
		is_correct: a.is_correct,
		points_awarded: a.points_awarded,
		answer_time_ms: a.answer_time_ms
	}));
	const answerChoices = (answerRows ?? []).flatMap((a) =>
		a.answer_choice ? [a.answer_choice].flat() : []
	);
	const answerChoicesMulti = (answerRows ?? []).flatMap((a) => a.answer_choice_multi ?? []);
	const answerSliders = (answerRows ?? []).flatMap((a) =>
		a.answer_slider ? [a.answer_slider].flat() : []
	);
	const answerOrderings = (answerRows ?? []).flatMap((a) => a.answer_ordering ?? []);

	// Segéd-indexek a JS-oldali összeállításhoz — egy-egy nagy, tömeges
	// lekérdezésből, N+1 kör-utazás nélkül.
	const optionTextById = new Map((choiceOptions ?? []).map((o) => [o.id, o.option_text]));
	const orderingTextById = new Map((orderingItems ?? []).map((i) => [i.id, i.item_text]));
	const teamNameById = new Map((teams ?? []).map((t) => [t.id, t.name]));

	const choicesByAnswer = new Map<string, string[]>();
	for (const c of answerChoices ?? []) {
		const arr = choicesByAnswer.get(c.answer_id) ?? [];
		arr.push(optionTextById.get(c.option_id) ?? '?');
		choicesByAnswer.set(c.answer_id, arr);
	}
	for (const c of answerChoicesMulti ?? []) {
		const arr = choicesByAnswer.get(c.answer_id) ?? [];
		arr.push(optionTextById.get(c.option_id) ?? '?');
		choicesByAnswer.set(c.answer_id, arr);
	}

	const sliderValueByAnswer = new Map((answerSliders ?? []).map((s) => [s.answer_id, s.value]));

	const orderingByAnswer = new Map<string, string[]>();
	for (const o of (answerOrderings ?? []).sort((a, b) => a.position - b.position)) {
		const arr = orderingByAnswer.get(o.answer_id) ?? [];
		arr.push(orderingTextById.get(o.item_id) ?? '?');
		orderingByAnswer.set(o.answer_id, arr);
	}

	function formatSubmittedAnswer(answerId: string, questionType: string): string {
		if (
			questionType === 'single_choice' ||
			questionType === 'true_false' ||
			questionType === 'multi_choice'
		) {
			return (choicesByAnswer.get(answerId) ?? []).join(', ') || '(nincs kiválasztott opció)';
		}
		if (questionType === 'slider') {
			const v = sliderValueByAnswer.get(answerId);
			return v === undefined ? '(nincs érték)' : String(v);
		}
		if (questionType === 'ordering') {
			const seq = orderingByAnswer.get(answerId);
			return seq && seq.length > 0 ? seq.join(' → ') : '(nincs sorrend)';
		}
		return '';
	}

	function correctAnswerText(questionId: string, questionType: string): string {
		if (
			questionType === 'single_choice' ||
			questionType === 'true_false' ||
			questionType === 'multi_choice'
		) {
			return (choiceOptions ?? [])
				.filter((o) => o.question_id === questionId && o.is_correct)
				.map((o) => o.option_text)
				.join(', ');
		}
		if (questionType === 'slider') {
			const config = (sliderConfigs ?? []).find((c) => c.question_id === questionId);
			return config ? String(config.correct_value) : '';
		}
		if (questionType === 'ordering') {
			return (orderingItems ?? [])
				.filter((i) => i.question_id === questionId)
				.map((i) => i.item_text)
				.join(' → ');
		}
		return '';
	}

	const answersByQuestion = new Map<string, NonNullable<typeof answers>>();
	for (const a of answers ?? []) {
		if (!a.question_id) continue;
		const arr = answersByQuestion.get(a.question_id) ?? [];
		arr.push(a);
		answersByQuestion.set(a.question_id, arr);
	}

	const roundsDetail = (rounds ?? []).map((round) => ({
		id: round.id,
		title: round.title,
		order_index: round.order_index,
		questions: (roundQuestions ?? [])
			.filter((rq) => rq.round_id === round.id)
			.map((rq) => {
				const questionType = rq.questions?.question_types?.code ?? '';
				const questionAnswers = answersByQuestion.get(rq.question_id) ?? [];
				return {
					question_id: rq.question_id,
					order_index: rq.order_index,
					prompt: rq.questions?.prompt ?? '',
					question_type: questionType,
					correct_answer: correctAnswerText(rq.question_id, questionType),
					teams: (teams ?? []).map((team) => {
						const a = questionAnswers.find((x) => x!.team_id === team.id);
						return {
							team_id: team.id,
							team_name: teamNameById.get(team.id) ?? team.name,
							submitted: !!a,
							submitted_answer: a ? formatSubmittedAnswer(a.id, questionType) : null,
							is_correct: a?.is_correct ?? null,
							points_awarded: a?.points_awarded ?? null,
							answer_time_ms: a?.answer_time_ms ?? null
						};
					})
				};
			})
	}));

	return { workspace: true, game, rounds: roundsDetail, teams: teams ?? [] };
};

export const actions: Actions = {
	// Lezárt este újranyitása az Eredmények fülről (reopenGameAction).
	reopen: async ({ request, locals: { supabase } }) => {
		const failure = await reopenGameAction(supabase, await request.formData());
		if (failure) return fail(400, failure);
		return { success: true, reopened: true };
	}
};
