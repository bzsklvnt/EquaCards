import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { draftToFormData, type Draft, type QuestionTypeInfo } from '$lib/builder/model';
import {
	parseQuestionForm,
	validateQuestionForm,
	type ParsedQuestionForm
} from '$lib/questions/form';

export { parseQuestionForm, validateQuestionForm, type ParsedQuestionForm };

type Client = SupabaseClient<Database>;

// A kérdéstípusok törzsadatok (öt sor, migrációval változnak) — instance-onként
// 10 percig memóriában, hogy a gyakori automatikus mentés ne kérdezze le újra.
let typesCache: { at: number; types: QuestionTypeInfo[] } | null = null;
const TYPES_TTL_MS = 10 * 60 * 1000;

export async function getQuestionTypes(supabase: Client): Promise<QuestionTypeInfo[]> {
	if (typesCache && Date.now() - typesCache.at < TYPES_TTL_MS) return typesCache.types;
	const { data } = await supabase
		.from('question_types')
		.select('id, code, label, min_options, max_options')
		.order('id');
	const types = (data ?? []) as QuestionTypeInfo[];
	if (types.length > 0) typesCache = { at: Date.now(), types };
	return types;
}

const SAVE_ERRORS: Record<string, string> = {
	option_in_use:
		'Ez a kérdés már szerepelt játékban, ezért a válaszlehetőségek száma nem csökkenthető. Másold le (Ctrl+D), és a másolatot szerkeszd.',
	question_not_found: 'A kérdés nem található.',
	insufficient_privilege: 'Nincs jogosultságod a kérdés mentéséhez.'
};

/** Kérdés mentése (új vagy meglévő) egyetlen tranzakcióban — az
 * admin_save_question() a típusadatokat helyben frissíti, így a lejátszott
 * kérdés opcióinak azonosítója (és a rájuk hivatkozó válaszok) megmaradnak. */
export async function saveParsedQuestion(
	supabase: Client,
	id: string | null,
	parsed: ParsedQuestionForm
): Promise<{ id: string } | { error: string }> {
	const { data, error } = await supabase.rpc('admin_save_question', {
		p_question_id: id,
		p_question: {
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
		},
		p_options: parsed.choiceOptions ?? undefined,
		p_slider: parsed.sliderConfig ?? undefined,
		p_ordering: parsed.orderingItems ?? undefined
	});
	if (error || !data) {
		const key = Object.keys(SAVE_ERRORS).find((k) => error?.message.includes(k));
		return { error: key ? SAVE_ERRORS[key] : (error?.message ?? 'Nem sikerült menteni.') };
	}
	return { id: data };
}

/** Egy szerkesztő-piszkozat ellenőrzése (a klienssel közös szabályokkal) és mentése. */
export async function saveDraft(
	supabase: Client,
	draft: Draft
): Promise<{ id: string } | { error: string }> {
	const types = await getQuestionTypes(supabase);
	const type = types.find((t) => t.code === draft.type_code);
	if (!type) return { error: 'Érvénytelen kérdéstípus.' };
	const parsed = parseQuestionForm(draftToFormData(draft, types), type.code);
	const validationError = validateQuestionForm(parsed, type);
	if (validationError) return { error: validationError };
	return saveParsedQuestion(supabase, draft.id ?? null, parsed);
}

/** A kör végére fűzi a még nem szereplő kérdéseket (kézi válogatás és az
 * "új kérdés ehhez a körhöz" folyamat közös útja). */
export async function appendQuestionsToRound(
	supabase: Client,
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
