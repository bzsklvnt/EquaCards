import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: game } = await supabase
		.from('games')
		.select('id, title, status, pin')
		.eq('id', params.id)
		.single();

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	const { data: rounds } = await supabase
		.from('rounds')
		.select('id, title, order_index')
		.eq('game_id', game.id)
		.order('order_index');

	const roundIds = (rounds ?? []).map((r) => r.id);

	const { data: teams } = await supabase
		.from('teams')
		.select('id, name')
		.eq('game_id', game.id)
		.order('name');

	if (roundIds.length === 0 || !teams || teams.length === 0) {
		return { game, rounds: [], teams: teams ?? [] };
	}

	const { data: roundQuestions } = await supabase
		.from('round_questions')
		.select(
			'round_id, order_index, question_id, questions(prompt, question_type_id, question_types(code))'
		)
		.in('round_id', roundIds)
		.order('order_index');

	const questionIds = (roundQuestions ?? []).map((rq) => rq.question_id);

	const [
		{ data: choiceOptions },
		{ data: sliderConfigs },
		{ data: orderingItems },
		{ data: answers }
	] = await Promise.all([
		supabase
			.from('question_choice_options')
			.select('id, question_id, option_text, is_correct, order_index')
			.in('question_id', questionIds)
			.order('order_index'),
		supabase
			.from('question_slider_config')
			.select('question_id, correct_value')
			.in('question_id', questionIds),
		supabase
			.from('question_ordering_items')
			.select('id, question_id, item_text, correct_position')
			.in('question_id', questionIds)
			.order('correct_position'),
		supabase
			.from('answers')
			.select('id, question_id, team_id, is_correct, points_awarded, answer_time_ms')
			.in('question_id', questionIds)
	]);

	const answerIds = (answers ?? []).map((a) => a.id);

	const [
		{ data: answerChoices },
		{ data: answerChoicesMulti },
		{ data: answerSliders },
		{ data: answerOrderings }
	] = await Promise.all([
		supabase.from('answer_choice').select('answer_id, option_id').in('answer_id', answerIds),
		supabase.from('answer_choice_multi').select('answer_id, option_id').in('answer_id', answerIds),
		supabase.from('answer_slider').select('answer_id, value').in('answer_id', answerIds),
		supabase
			.from('answer_ordering')
			.select('answer_id, item_id, position')
			.in('answer_id', answerIds)
	]);

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

	return { game, rounds: roundsDetail, teams: teams ?? [] };
};
