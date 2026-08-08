import { error as kitError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	parseQuestionForm,
	replaceQuestionTypeData,
	validateQuestionForm
} from '$lib/server/questions';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [{ data: themes }, { data: questionTypes }, { data: question }] = await Promise.all([
		supabase.from('themes').select('id, title').order('title'),
		supabase.from('question_types').select('id, code, label, min_options, max_options').order('id'),
		supabase.from('questions').select('*').eq('id', params.id).single()
	]);

	if (!question) {
		kitError(404, 'A kérdés nem található.');
	}

	const type = questionTypes?.find((t) => t.id === question.question_type_id);

	let choiceOptions, sliderConfig, orderingItems;
	if (
		type?.code === 'single_choice' ||
		type?.code === 'multi_choice' ||
		type?.code === 'true_false'
	) {
		const { data } = await supabase
			.from('question_choice_options')
			.select('option_text, is_correct')
			.eq('question_id', question.id)
			.order('order_index');
		choiceOptions = data ?? [];
	} else if (type?.code === 'slider') {
		const { data } = await supabase
			.from('question_slider_config')
			.select('min_value, max_value, step, correct_value, tolerance')
			.eq('question_id', question.id)
			.single();
		sliderConfig = data ?? undefined;
	} else if (type?.code === 'ordering') {
		const { data } = await supabase
			.from('question_ordering_items')
			.select('item_text, correct_position')
			.eq('question_id', question.id)
			.order('correct_position');
		orderingItems = data ?? [];
	}

	return {
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		question,
		choiceOptions,
		sliderConfig,
		orderingItems
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
				points: parsed.points,
				points_multiplier: parsed.points_multiplier,
				time_limit_seconds: parsed.time_limit_seconds,
				points_decay: parsed.points_decay
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
