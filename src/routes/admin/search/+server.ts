import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireStaff } from '$lib/server/auth';

// A Ctrl+K parancspaletta keresése: kvízesték, kérdések, helyszínek, témák.
// A kezelő saját kliensével (RLS) — docs/features/admin-workspace.md.
export const GET: RequestHandler = async ({ url, locals }) => {
	const { supabase } = locals;
	await requireStaff(locals, [1, 2]);

	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	if (q.length < 2) return json({ results: [] });
	const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;

	const [games, questions, venues, themes] = await Promise.all([
		supabase
			.from('games')
			.select('id, title, scheduled_at, status')
			.ilike('title', pattern)
			.order('created_at', { ascending: false })
			.limit(6),
		supabase
			.from('questions')
			.select('id, prompt')
			.is('archived_at', null)
			.ilike('prompt', pattern)
			.limit(6),
		supabase.from('venues').select('id, name, city').ilike('name', pattern).limit(4),
		supabase.from('themes').select('id, title').ilike('title', pattern).limit(4)
	]);

	return json({
		results: [
			...(games.data ?? []).map((g) => ({
				group: 'Kvízesték',
				kind: 'game',
				id: g.id,
				title: g.title,
				sub: g.status
			})),
			...(questions.data ?? []).map((x) => ({
				group: 'Kérdések',
				kind: 'question',
				id: x.id,
				title: x.prompt,
				sub: 'Kérdésbank'
			})),
			...(venues.data ?? []).map((v) => ({
				group: 'Helyszínek',
				kind: 'venue',
				id: v.id,
				title: v.name,
				sub: v.city ?? ''
			})),
			...(themes.data ?? []).map((t) => ({
				group: 'Témák',
				kind: 'theme',
				id: t.id,
				title: t.title,
				sub: 'Téma'
			}))
		]
	});
};
