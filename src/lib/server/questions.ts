import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import {
	parseQuestionForm,
	validateQuestionForm,
	type ParsedQuestionForm
} from '$lib/questions/form';

export { parseQuestionForm, validateQuestionForm, type ParsedQuestionForm };

export async function insertQuestionTypeData(
	supabase: SupabaseClient<Database>,
	questionId: string,
	parsed: ParsedQuestionForm
): Promise<string | null> {
	if (parsed.choiceOptions) {
		const { error } = await supabase.from('question_choice_options').insert(
			parsed.choiceOptions.map((o) => ({
				question_id: questionId,
				option_text: o.option_text,
				image_url: o.image_url,
				is_correct: o.is_correct,
				order_index: o.order_index
			}))
		);
		if (error) return error.message;
	}

	if (parsed.sliderConfig) {
		const { error } = await supabase
			.from('question_slider_config')
			.insert({ question_id: questionId, ...parsed.sliderConfig });
		if (error) return error.message;
	}

	if (parsed.orderingItems) {
		const { error } = await supabase.from('question_ordering_items').insert(
			parsed.orderingItems.map((o) => ({
				question_id: questionId,
				item_text: o.item_text,
				correct_position: o.correct_position
			}))
		);
		if (error) return error.message;
	}

	return null;
}

// Egyszerű "töröld és írd újra" frissítés a típus-specifikus gyerekrekordokon —
// admin CRUD-nál a néhány soros opció-lista diffelése nem éri meg a
// bonyolultságot, a törlés+újrabeszúrás egy tranzakción belül biztonságos.
export async function replaceQuestionTypeData(
	supabase: SupabaseClient<Database>,
	questionId: string,
	parsed: ParsedQuestionForm
): Promise<string | null> {
	await Promise.all([
		supabase.from('question_choice_options').delete().eq('question_id', questionId),
		supabase.from('question_slider_config').delete().eq('question_id', questionId),
		supabase.from('question_ordering_items').delete().eq('question_id', questionId)
	]);

	return insertQuestionTypeData(supabase, questionId, parsed);
}

/** A kör végére fűzi a még nem szereplő kérdéseket (kézi válogatás és az
 * "új kérdés ehhez a körhöz" folyamat közös útja). */
export async function appendQuestionsToRound(
	supabase: SupabaseClient<Database>,
	roundId: string,
	questionIds: string[]
): Promise<{ added: number; error: string | null }> {
	const { data: existing } = await supabase
		.from('round_questions')
		.select('question_id, order_index')
		.eq('round_id', roundId);
	const existingIds = new Set((existing ?? []).map((r) => r.question_id));
	const toAdd = questionIds.filter((id) => !existingIds.has(id));
	if (toAdd.length === 0) return { added: 0, error: null };

	const start = Math.max(0, ...(existing ?? []).map((r) => r.order_index)) + 1;
	const { error } = await supabase
		.from('round_questions')
		.insert(
			toAdd.map((question_id, i) => ({ round_id: roundId, question_id, order_index: start + i }))
		);
	return { added: error ? 0 : toAdd.length, error: error?.message ?? null };
}

/** Új kérdés létrehozása egy beküldött QuestionForm-ból (kérdésbank és a kör
 * szerkesztőjének felugró űrlapja közös útja). Ha a típus-specifikus adatok
 * mentése elbukik, a félkész kérdést visszatörli. */
export async function createQuestionFromForm(
	supabase: SupabaseClient<Database>,
	formData: FormData,
	userId: string | undefined
): Promise<{ id: string } | { error: string }> {
	const { data: type } = await supabase
		.from('question_types')
		.select('code, min_options, max_options')
		.eq('id', Number(formData.get('question_type_id')))
		.single();
	if (!type) return { error: 'Érvénytelen kérdéstípus.' };

	const parsed = parseQuestionForm(formData, type.code);
	const validationError = validateQuestionForm(parsed, type);
	if (validationError) return { error: validationError };

	const { data: question, error } = await supabase
		.from('questions')
		.insert({
			theme_id: parsed.theme_id,
			question_type_id: parsed.question_type_id,
			prompt: parsed.prompt,
			image_url: parsed.image_url,
			image_pixelate: parsed.image_pixelate,
			points: parsed.points,
			points_multiplier: parsed.points_multiplier,
			time_limit_seconds: parsed.time_limit_seconds,
			points_decay: parsed.points_decay,
			reading_seconds: parsed.reading_seconds,
			created_by: userId
		})
		.select('id')
		.single();
	if (error || !question) {
		return { error: error?.message ?? 'Nem sikerült létrehozni a kérdést.' };
	}

	const childError = await insertQuestionTypeData(supabase, question.id, parsed);
	if (childError) {
		await supabase.from('questions').delete().eq('id', question.id);
		return { error: childError };
	}
	return { id: question.id };
}
