import { error as kitError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	parseQuestionForm,
	replaceQuestionTypeData,
	validateQuestionForm
} from '$lib/server/questions';
import { loadDrafts, readingDefault } from '$lib/server/builder';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [{ data: themes }, { data: questionTypes }, drafts, reading] = await Promise.all([
		supabase.from('themes').select('id, title').order('title'),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id'),
		loadDrafts(supabase, [params.id]),
		readingDefault(supabase)
	]);

	const draft = drafts[0];
	if (!draft) {
		kitError(404, 'A kérdés nem található.');
	}

	return {
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		draft,
		readingDefault: reading
	};
};

export const actions: Actions = {
	update: async ({ request, params, locals: { supabase } }) => {
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

		const { error } = await supabase
			.from('questions')
			.update({
				theme_id: parsed.theme_id,
				question_type_id: parsed.question_type_id,
				prompt: parsed.prompt,
				image_url: parsed.image_url,
				image_pixelate: parsed.image_pixelate,
				points: parsed.points,
				points_multiplier: parsed.points_multiplier,
				time_limit_seconds: parsed.time_limit_seconds,
				points_decay: parsed.points_decay,
				reading_seconds: parsed.reading_seconds
			})
			.eq('id', params.id);

		if (error) {
			return fail(400, { error: error.message });
		}

		const childError = await replaceQuestionTypeData(supabase, params.id, parsed);
		if (childError) {
			return fail(400, { error: childError });
		}

		redirect(303, '/admin/questions');
	},

	delete: async ({ params, locals: { supabase } }) => {
		const { error } = await supabase.from('questions').delete().eq('id', params.id);
		if (error) {
			return fail(400, { error: error.message });
		}

		redirect(303, '/admin/questions');
	}
};
