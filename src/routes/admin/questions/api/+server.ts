import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Draft } from '$lib/builder/model';
import { appendQuestionsToRound, saveDraft } from '$lib/server/questions';
import { loadDrafts, loadUsage } from '$lib/server/builder';
import { requireStaff } from '$lib/server/auth';

// A kérdésbank műveletei (betöltés, automatikus mentés, duplikálás, törlés,
// hozzáadás egy kör végére) — docs/features/admin-workspace.md. A kezelő
// saját kliensén fut, az RLS (role_id 1–2) érvényesül.

type Body =
	| { op: 'load'; id: string }
	| { op: 'save'; draft: Draft }
	| { op: 'duplicate'; id: string }
	| { op: 'delete'; id: string }
	| { op: 'addToRound'; question_id: string; round_id: string };

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase } = locals;
	const [, body] = await Promise.all([
		requireStaff(locals, [1, 2]),
		request.json() as Promise<Body>
	]);

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
			const saved = await saveDraft(supabase, body.draft);
			if ('error' in saved) return json({ error: saved.error }, { status: 400 });
			return json({ id: saved.id });
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
			// Lejátszott kérdés archiválódik (a korábbi estek eredményei megmaradnak),
			// a többi törlődik — admin_delete_question().
			const { data: outcome, error: deleteError } = await supabase.rpc('admin_delete_question', {
				p_question_id: body.id
			});
			if (deleteError) return json({ error: deleteError.message }, { status: 400 });
			return json({ ok: true, archived: outcome === 'archived' });
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
