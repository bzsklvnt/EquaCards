import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { draftToFormData, type Draft, type QuestionTypeInfo } from '$lib/builder/model';
import {
	appendQuestionsToRound,
	createQuestionFromForm,
	parseQuestionForm,
	replaceQuestionTypeData,
	validateQuestionForm
} from '$lib/server/questions';
import { loadDrafts, loadUsage } from '$lib/server/builder';

// A kérdésbank műveletei (betöltés, automatikus mentés, duplikálás, törlés,
// hozzáadás egy kör végére) — docs/features/admin-workspace.md. A kezelő
// saját kliensén fut, az RLS (role_id 1–2) érvényesül.

type Body =
	| { op: 'load'; id: string }
	| { op: 'save'; draft: Draft }
	| { op: 'duplicate'; id: string }
	| { op: 'delete'; id: string }
	| { op: 'addToRound'; question_id: string; round_id: string };

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { user } = await safeGetSession();
	if (!user) error(401, 'Bejelentkezés szükséges.');
	const { data: profile } = await supabase
		.from('profiles')
		.select('role_id')
		.eq('id', user.id)
		.single();
	if (!profile || ![1, 2].includes(profile.role_id)) error(403, 'Nincs jogosultságod.');

	const body = (await request.json()) as Body;

	switch (body.op) {
		case 'load': {
			const [drafts, usage] = await Promise.all([
				loadDrafts(supabase, [body.id]),
				loadUsage(supabase, body.id)
			]);
			if (!drafts[0]) return json({ error: 'A kérdés nem található.' }, { status: 404 });
			return json({ draft: drafts[0], usage });
		}

		case 'save': {
			const { data: types } = await supabase
				.from('question_types')
				.select('id, code, label, min_options, max_options');
			const typeList = (types ?? []) as QuestionTypeInfo[];
			const formData = draftToFormData(body.draft, typeList);
			if (!body.draft.id) {
				const created = await createQuestionFromForm(supabase, formData, user.id);
				if ('error' in created) return json({ error: created.error }, { status: 400 });
				return json({ id: created.id });
			}
			const type = typeList.find((t) => t.code === body.draft.type_code);
			if (!type) return json({ error: 'Érvénytelen kérdéstípus.' }, { status: 400 });
			const parsed = parseQuestionForm(formData, type.code);
			const validationError = validateQuestionForm(parsed, type);
			if (validationError) return json({ error: validationError }, { status: 400 });
			const { error: updateError } = await supabase
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
				.eq('id', body.draft.id);
			if (updateError) return json({ error: updateError.message }, { status: 400 });
			const childError = await replaceQuestionTypeData(supabase, body.draft.id, parsed);
			if (childError) return json({ error: childError }, { status: 400 });
			return json({ id: body.draft.id });
		}

		case 'duplicate': {
			const { data: newId, error: dupError } = await supabase.rpc('admin_duplicate_question', {
				p_question_id: body.id
			});
			if (dupError || !newId) {
				return json({ error: dupError?.message ?? 'Nem sikerült másolni.' }, { status: 400 });
			}
			const [draft] = await loadDrafts(supabase, [newId]);
			return json({ id: newId, draft });
		}

		case 'delete': {
			const { error: deleteError } = await supabase.from('questions').delete().eq('id', body.id);
			if (deleteError) return json({ error: deleteError.message }, { status: 400 });
			return json({ ok: true });
		}

		case 'addToRound': {
			const result = await appendQuestionsToRound(supabase, body.round_id, [body.question_id]);
			if (result.error) return json({ error: result.error }, { status: 400 });
			if (result.added === 0) {
				return json({ error: 'A kérdés már szerepel abban a körben.' }, { status: 400 });
			}
			return json({ usage: await loadUsage(supabase, body.question_id) });
		}
	}

	return json({ error: 'Ismeretlen művelet.' }, { status: 400 });
};
