import type { PageServerLoad } from './$types';
import { loadBank, questionDefaults } from '$lib/server/builder';

// Kérdésbank — lista · vászon · beállítások (docs/features/admin-workspace.md).
// A kijelölt kérdés részletei a ./api végponton töltődnek be.
export const load: PageServerLoad = async ({ depends, locals: { supabase } }) => {
	depends('app:page');
	const [bank, { data: themes }, { data: questionTypes }, { data: games }, defaults] =
		await Promise.all([
			loadBank(supabase),
			supabase.from('themes').select('id, title').order('title'),
			supabase
				.from('question_types')
				.select('id, code, label, min_options, max_options')
				.order('id'),
			supabase
				.from('games')
				.select(
					'id, title, status, scheduled_at, rounds!rounds_game_id_fkey(id, title, order_index)'
				)
				.neq('status', 'finished')
				.order('scheduled_at', { ascending: true, nullsFirst: false }),
			questionDefaults(supabase)
		]);

	return {
		bank,
		themes: themes ?? [],
		questionTypes: questionTypes ?? [],
		games: (games ?? [])
			.map((g) => ({
				id: g.id,
				title: g.title,
				rounds: (g.rounds ?? []).sort((a, b) => a.order_index - b.order_index)
			}))
			.filter((g) => g.rounds.length > 0),
		readingDefault: defaults.readingDefault,
		defaultTime: defaults.defaultTime
	};
};
