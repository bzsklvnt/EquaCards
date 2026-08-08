import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	insertQuestionTypeData,
	parseQuestionForm,
	validateQuestionForm
} from '$lib/server/questions';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [{ data: themes }, { data: questionTypes }] = await Promise.all([
		supabase.from('themes').select('id, title').order('title'),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id')
	]);

	return { themes: themes ?? [], questionTypes: questionTypes ?? [] };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase } }) => {
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
				points_decay: parsed.points_decay
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

		redirect(303, '/admin/questions');
	}
};
