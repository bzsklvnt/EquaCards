import type { PageServerLoad } from './$types';
import { fetchAllRows, questionDefaults } from '$lib/server/builder';
import { getQuestionTypes } from '$lib/server/questions';

// Kérdésbank-import CSV-ből (docs/features/question-import.md). A duplikátum-
// figyelmeztetéshez a meglévő (nem archivált) kérdések szövege is betöltődik.
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [types, { data: themes }, defaults, existing] = await Promise.all([
		getQuestionTypes(supabase),
		supabase.from('themes').select('id, title').order('title'),
		questionDefaults(supabase),
		fetchAllRows((from, to) =>
			supabase
				.from('questions')
				.select('prompt, theme_id')
				.is('archived_at', null)
				.order('id')
				.range(from, to)
		)
	]);
	return {
		types,
		themes: themes ?? [],
		defaultTime: defaults.defaultTime,
		existing
	};
};
