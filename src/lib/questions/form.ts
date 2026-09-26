// A kérdés-űrlap mezőinek értelmezése és ellenőrzése — KÖZÖS a szerverrel
// (kérdésbank, kvízösszerakó mentése) és a klienssel (az összerakó ugyanezzel
// dönti el, hogy egy piszkozat menthető-e). docs/features/quiz-builder.md.

export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 600;
export const MAX_READING = 120;

function parseOptionalInt(value: FormDataEntryValue | null): number | null {
	if (typeof value !== 'string' || value.trim() === '') return null;
	return Number(value);
}

export type QuestionTypeRow = {
	code: string;
	min_options: number | null;
	max_options: number | null;
};

export type ParsedQuestionForm = {
	theme_id: string | null;
	question_type_id: number;
	prompt: string;
	image_url: string | null;
	image_pixelate: boolean;
	points: number;
	points_multiplier: number;
	time_limit_seconds: number;
	points_decay: boolean;
	/** null = a globális alapérték (app_settings.question_reading_seconds). */
	reading_seconds: number | null;
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
		// Kép nélkül értelmetlen — ilyenkor mindig kikapcsolva mentjük.
		image_pixelate: formData.get('image_pixelate') === 'true' && !!formData.get('image_url'),
		points: Number(formData.get('points')),
		points_multiplier: Number(formData.get('points_multiplier')),
		time_limit_seconds: Number(formData.get('time_limit_seconds')),
		points_decay: formData.get('points_decay') === 'true',
		reading_seconds: parseOptionalInt(formData.get('reading_seconds'))
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
	if (
		!Number.isInteger(parsed.time_limit_seconds) ||
		parsed.time_limit_seconds < MIN_TIME_LIMIT ||
		parsed.time_limit_seconds > MAX_TIME_LIMIT
	) {
		return `A válaszidő ${MIN_TIME_LIMIT}–${MAX_TIME_LIMIT} mp közötti egész szám legyen.`;
	}
	if (
		parsed.reading_seconds !== null &&
		(!Number.isInteger(parsed.reading_seconds) ||
			parsed.reading_seconds < 0 ||
			parsed.reading_seconds > MAX_READING)
	) {
		return `Az olvasási idő 0–${MAX_READING} mp közötti egész szám legyen.`;
	}
	if (!Number.isFinite(parsed.points) || parsed.points < 0) {
		return 'A pontszám nem lehet negatív.';
	}
	if (!Number.isFinite(parsed.points_multiplier) || parsed.points_multiplier <= 0) {
		return 'A pont-szorzó pozitív szám legyen.';
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
