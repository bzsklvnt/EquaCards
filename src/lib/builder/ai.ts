// Az AI-segéd kliens- és szerveroldali közös része (docs/features/ai-assistant.md):
// a piszkozat tömör leírása az AI-nak, a javaslat piszkozattá alakítása és a
// javasolt javítás alkalmazása. Maga az API-hívás: $lib/server/ai.ts.

import { emptyDraft, isChoiceType, type Draft, type QuestionTypeInfo } from './model';

export type AiQuestion = {
	key?: string;
	type: string;
	prompt: string;
	options?: { text: string; correct: boolean }[];
	slider?: { min: number; max: number; step: number; correct: number; tolerance: number };
	ordering?: string[];
	info_text?: string;
};

export type SuggestType = 'mixed' | 'single_choice' | 'multi_choice' | 'true_false' | 'slider';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type SuggestedQuestion = {
	type: 'single_choice' | 'multi_choice' | 'true_false' | 'slider';
	prompt: string;
	options?: { text: string; correct: boolean }[];
	slider?: { min: number; max: number; step: number; correct: number; tolerance: number };
	note?: string;
};

export type ReviewFix = {
	prompt?: string;
	option_texts?: string[];
	correct_indexes?: number[];
	slider_correct?: number;
};

export type ReviewFinding = {
	key: string;
	severity: 'error' | 'warn' | 'info';
	problem: string;
	fix?: ReviewFix;
};

export function draftToAi(draft: Draft): AiQuestion {
	const q: AiQuestion = { key: draft.key, type: draft.type_code, prompt: draft.prompt };
	if (isChoiceType(draft.type_code)) {
		q.options = draft.options.map((o) => ({ text: o.text, correct: o.is_correct }));
	} else if (draft.type_code === 'slider') {
		const s = draft.slider;
		q.slider = {
			min: s.min_value,
			max: s.max_value,
			step: s.step,
			correct: s.correct_value,
			tolerance: s.tolerance
		};
	} else if (draft.type_code === 'ordering') {
		q.ordering = draft.ordering;
	} else if (draft.type_code === 'info') {
		q.info_text = draft.info_text;
	}
	return q;
}

/** Normalizált kérdésszöveg a duplikátumszűréshez. */
export function promptKey(text: string): string {
	return text
		.toLocaleLowerCase('hu')
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();
}

/** A javaslat szerkezeti ellenőrzése — a hibás javaslat nem kerül a listára. */
export function suggestionUsable(s: SuggestedQuestion): boolean {
	if (!s.prompt?.trim()) return false;
	if (s.type === 'slider') {
		const v = s.slider;
		return !!v && v.min < v.max && v.step > 0 && v.correct >= v.min && v.correct <= v.max;
	}
	const options = s.options ?? [];
	const correct = options.filter((o) => o.correct).length;
	if (options.length < 2 || options.length > 8 || options.some((o) => !o.text?.trim()))
		return false;
	if (s.type === 'true_false') return options.length === 2 && correct === 1;
	if (s.type === 'single_choice') return correct === 1;
	return correct >= 1;
}

export function suggestionToDraft(
	s: SuggestedQuestion,
	types: QuestionTypeInfo[],
	template: Parameters<typeof emptyDraft>[2],
	themeId: string | null
): Draft | null {
	const type = types.find((t) => t.code === s.type);
	if (!type || !suggestionUsable(s)) return null;
	const draft = emptyDraft(type, themeId, template);
	draft.prompt = s.prompt.trim();
	if (s.type === 'slider' && s.slider) {
		draft.slider = {
			min_value: s.slider.min,
			max_value: s.slider.max,
			step: s.slider.step,
			correct_value: s.slider.correct,
			tolerance: Math.max(0, s.slider.tolerance)
		};
	} else if (s.options) {
		draft.options = s.options.map((o) => ({
			text: o.text.trim(),
			image_url: null,
			is_correct: o.correct
		}));
	}
	return draft;
}

/** A javasolt javítás alkalmazása (csak ha illik a kérdésre); null = nem alkalmazható. */
export function applyFix(draft: Draft, fix: ReviewFix): Draft | null {
	const next: Draft = { ...draft, options: draft.options.map((o) => ({ ...o })) };
	let changed = false;
	if (fix.prompt?.trim() && fix.prompt.trim() !== draft.prompt) {
		next.prompt = fix.prompt.trim();
		changed = true;
	}
	if (isChoiceType(draft.type_code)) {
		if (fix.option_texts && fix.option_texts.length === next.options.length) {
			fix.option_texts.forEach((text, i) => {
				if (text.trim() && text.trim() !== next.options[i].text) {
					next.options[i].text = text.trim();
					changed = true;
				}
			});
		}
		const idx = fix.correct_indexes;
		if (
			idx &&
			idx.length > 0 &&
			idx.every((i) => Number.isInteger(i) && i >= 0 && i < next.options.length) &&
			(draft.type_code === 'multi_choice' || idx.length === 1)
		) {
			next.options.forEach((o, i) => {
				const correct = idx.includes(i);
				if (o.is_correct !== correct) changed = true;
				o.is_correct = correct;
			});
		}
	}
	if (draft.type_code === 'slider' && typeof fix.slider_correct === 'number') {
		const v = fix.slider_correct;
		if (v >= draft.slider.min_value && v <= draft.slider.max_value) {
			if (v !== draft.slider.correct_value) changed = true;
			next.slider = { ...draft.slider, correct_value: v };
		}
	}
	return changed ? next : null;
}

/** A javítás rövid, emberi leírása a gombhoz. */
export function describeFix(draft: Draft, fix: ReviewFix): string {
	const parts: string[] = [];
	if (fix.prompt?.trim() && fix.prompt.trim() !== draft.prompt)
		parts.push(`kérdés: „${fix.prompt.trim()}”`);
	if (fix.option_texts && fix.option_texts.length === draft.options.length) {
		fix.option_texts.forEach((t, i) => {
			if (t.trim() && t.trim() !== draft.options[i]?.text) {
				parts.push(`${String.fromCharCode(65 + i)}: „${t.trim()}”`);
			}
		});
	}
	if (fix.correct_indexes?.length) {
		parts.push(`helyes: ${fix.correct_indexes.map((i) => String.fromCharCode(65 + i)).join(', ')}`);
	}
	if (typeof fix.slider_correct === 'number') parts.push(`helyes érték: ${fix.slider_correct}`);
	return parts.join(' · ');
}
