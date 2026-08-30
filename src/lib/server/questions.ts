import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

type QuestionTypeRow = {
	code: string;
	min_options: number | null;
	max_options: number | null;
};

export type ParsedQuestionForm = {
	theme_id: string | null;
	question_type_id: number;
	prompt: string;
	image_url: string | null;
	points: number;
	points_multiplier: number;
	time_limit_seconds: number;
	points_decay: boolean;
	choiceOptions?: {
		option_text: string;
		image_url: string | null;
		is_correct: boolean;
		order_index: number;
	}[];
	sliderConfig?: {
		min_value: number;
		max_value: number;
		step: number;
		correct_value: number;
		tolerance: number;
	};
	orderingItems?: { item_text: string; correct_position: number }[];
};

export function parseQuestionForm(
	formData: FormData,
	questionTypeCode: string
): ParsedQuestionForm {
	const base = {
		theme_id: (formData.get('theme_id') as string) || null,
		question_type_id: Number(formData.get('question_type_id')),
		prompt: ((formData.get('prompt') as string) ?? '').trim(),
		image_url: (formData.get('image_url') as string) || null,
		points: Number(formData.get('points')),
		points_multiplier: Number(formData.get('points_multiplier')),
		time_limit_seconds: Number(formData.get('time_limit_seconds')),
		points_decay: formData.get('points_decay') === 'true'
	};

	if (
		questionTypeCode === 'single_choice' ||
		questionTypeCode === 'multi_choice' ||
		questionTypeCode === 'true_false'
	) {
		const texts = formData.getAll('option_text') as string[];
		const images = formData.getAll('option_image_url') as string[];
		const correctIndexes = new Set(formData.getAll('correct_index').map(Number));
		return {
			...base,
			choiceOptions: texts.map((text, i) => ({
				option_text: text,
				image_url: images[i] || null,
				is_correct: correctIndexes.has(i),
				order_index: i
			}))
		};
	}

	if (questionTypeCode === 'slider') {
		return {
			...base,
			sliderConfig: {
				min_value: Number(formData.get('min_value')),
				max_value: Number(formData.get('max_value')),
				step: Number(formData.get('step')),
				correct_value: Number(formData.get('correct_value')),
				tolerance: Number(formData.get('tolerance'))
			}
		};
	}

	if (questionTypeCode === 'ordering') {
		const texts = formData.getAll('item_text') as string[];
		return {
			...base,
			orderingItems: texts.map((text, i) => ({ item_text: text, correct_position: i + 1 }))
		};
	}

	return base;
}

export function validateQuestionForm(
	parsed: ParsedQuestionForm,
	type: QuestionTypeRow
): string | null {
	if (!parsed.prompt) {
		return 'A kérdés szövege kötelező.';
	}

	if (parsed.choiceOptions) {
		const count = parsed.choiceOptions.length;
		if (type.min_options && count < type.min_options) {
			return `Legalább ${type.min_options} opció szükséges.`;
		}
		if (type.max_options && count > type.max_options) {
			return `Legfeljebb ${type.max_options} opció engedélyezett.`;
		}
		if (parsed.choiceOptions.some((o) => !o.option_text.trim())) {
			return 'Minden opciónak kell szöveget megadni.';
		}
		if (!parsed.choiceOptions.some((o) => o.is_correct)) {
			return 'Legalább egy helyes opciót ki kell jelölni.';
		}
	}

	if (parsed.sliderConfig) {
		const { min_value, max_value, correct_value } = parsed.sliderConfig;
		if (min_value >= max_value) {
			return 'A minimum értéknek kisebbnek kell lennie a maximumnál.';
		}
		if (correct_value < min_value || correct_value > max_value) {
			return 'A helyes értéknek a min-max tartományon belül kell lennie.';
		}
	}

	if (parsed.orderingItems) {
		if (parsed.orderingItems.length < 2) {
			return 'Legalább 2 elem szükséges a sorrendbe álltáshoz.';
		}
		if (parsed.orderingItems.some((o) => !o.item_text.trim())) {
			return 'Minden elemnek kell szöveget megadni.';
		}
	}

	return null;
}

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
