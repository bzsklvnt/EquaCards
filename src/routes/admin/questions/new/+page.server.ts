import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	appendQuestionsToRound,
	insertQuestionTypeData,
	parseQuestionForm,
	validateQuestionForm
} from '$lib/server/questions';

// "+ Új kérdés ehhez a körhöz" (/admin/games/[id]) — ?round_id=… esetén a
// mentett kérdés azonnal a kör végére kerül, és visszairányítunk az estére.
export const load: PageServerLoad = async ({ url, locals: { supabase } }) => {
	const roundId = url.searchParams.get('round_id');
	const [{ data: themes }, { data: questionTypes }, { data: round }] = await Promise.all([
		supabase.from('themes').select('id, title').order('title'),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id'),
		roundId
			? supabase
					.from('rounds')
					.select('id, title, game_id, games(title)')
					.eq('id', roundId)
					.maybeSingle()
			: Promise.resolve({ data: null })
	]);

	return {
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		defaultThemeId: url.searchParams.get('theme_id') ?? undefined,
		round: round?.game_id
			? {
					id: round.id,
					title: round.title,
					game_id: round.game_id,
					game_title: round.games?.title ?? ''
				}
			: null
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const formData = await request.formData();
		const questionTypeId = Number(formData.get('question_type_id'));

		const { data: type } = await supabase
			.from('question_types')
			.select('code, min_options, max_options')
			.eq('id', questionTypeId)
			.single();

		if (!type) {
			return fail(400, { error: 'Érvénytelen kérdéstípus.' });
		}

		const parsed = parseQuestionForm(formData, type.code);
		const validationError = validateQuestionForm(parsed, type);
		if (validationError) {
			return fail(400, { error: validationError });
		}

		const { data: question, error } = await supabase
			.from('questions')
			.insert({
				theme_id: parsed.theme_id,
				question_type_id: parsed.question_type_id,
				prompt: parsed.prompt,
				image_url: parsed.image_url,
				points: parsed.points,
				points_multiplier: parsed.points_multiplier,
				time_limit_seconds: parsed.time_limit_seconds,
				points_decay: parsed.points_decay,
				created_by: user?.id
			})
			.select('id')
			.single();

		if (error || !question) {
			return fail(400, { error: error?.message ?? 'Nem sikerült létrehozni a kérdést.' });
		}

		const childError = await insertQuestionTypeData(supabase, question.id, parsed);
		if (childError) {
			await supabase.from('questions').delete().eq('id', question.id);
			return fail(400, { error: childError });
		}

		const roundId = formData.get('round_id') as string | null;
		if (roundId) {
			const { data: round } = await supabase
				.from('rounds')
				.select('game_id')
				.eq('id', roundId)
				.single();
			const { error: appendError } = await appendQuestionsToRound(supabase, roundId, [question.id]);
			if (!round || appendError) {
				return fail(400, {
					error: `A kérdés elmentve a kérdésbankba, de nem sikerült a körhöz adni: ${appendError ?? 'a kör nem található.'}`
				});
			}
			redirect(303, `/admin/games/${round.game_id}`);
		}

		redirect(303, '/admin/questions');
	}
};
