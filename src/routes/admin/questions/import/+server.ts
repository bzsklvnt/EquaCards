import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Draft } from '$lib/builder/model';
import { saveDraft } from '$lib/server/questions';
import { requireStaff } from '$lib/server/auth';

// A CSV-import mentése (docs/features/question-import.md): előbb a hiányzó
// témák, utána a kérdések kötegenként. Minden kérdést a kézi mentéssel azonos
// szerveroldali ellenőrzés és admin_save_question() ment; az import mindig új
// kérdést hoz létre (a kliens által küldött azonosítót figyelmen kívül hagyja).

const MAX_BATCH = 50;

type Body = { op: 'themes'; titles: string[] } | { op: 'save'; drafts: Draft[] };

export const POST: RequestHandler = async ({ request, locals }) => {
	const { supabase } = locals;
	const [, body] = await Promise.all([
		requireStaff(locals, [1, 2]),
		request.json() as Promise<Body>
	]);

	if (body.op === 'themes') {
		// Kis- és nagybetűtől függetlenül egyedi nevek.
		const unique = new Map<string, string>();
		for (const t of body.titles.map((t) => t.trim()).filter(Boolean)) {
			if (!unique.has(t.toLocaleLowerCase('hu'))) unique.set(t.toLocaleLowerCase('hu'), t);
		}
		const titles = [...unique.values()].slice(0, 200);
		const { data: existing } = await supabase.from('themes').select('id, title');
		const byTitle = new Map((existing ?? []).map((t) => [t.title.toLocaleLowerCase('hu'), t.id]));
		const map: Record<string, string> = {};
		const missing: string[] = [];
		for (const title of titles) {
			const id = byTitle.get(title.toLocaleLowerCase('hu'));
			if (id) map[title] = id;
			else missing.push(title);
		}
		if (missing.length > 0) {
			const { data: created, error } = await supabase
				.from('themes')
				.insert(missing.map((title) => ({ title })))
				.select('id, title');
			if (error) return json({ error: error.message }, { status: 400 });
			for (const t of created ?? []) map[t.title] = t.id;
		}
		return json({ map });
	}

	if (body.op === 'save') {
		if (!Array.isArray(body.drafts) || body.drafts.length > MAX_BATCH) {
			return json({ error: `Egyszerre legfeljebb ${MAX_BATCH} kérdés küldhető.` }, { status: 400 });
		}
		const results: ({ id: string } | { error: string })[] = [];
		// Sorban: a hibás kérdés a többit nem akasztja meg.
		for (const draft of body.drafts) {
			results.push(await saveDraft(supabase, { ...draft, id: null }));
		}
		return json({ results });
	}

	return json({ error: 'Ismeretlen művelet.' }, { status: 400 });
};
