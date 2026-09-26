import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createPracticeGame, generatePin, reopenGameAction } from '$lib/server/games';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: games } = await supabase
		.from('games')
		.select(
			'id, title, status, pin, created_at, finished_at, is_practice, scheduled_at, is_public, max_players, venues(name), teams(count), team_registrations(headcount, status)'
		)
		.order('scheduled_at', { ascending: false, nullsFirst: true })
		.order('created_at', { ascending: false });

	return {
		games: (games ?? []).map(({ team_registrations, ...game }) => ({
			...game,
			confirmedPlayers: (team_registrations ?? [])
				.filter((r) => r.status === 'confirmed')
				.reduce((sum, r) => sum + r.headcount, 0),
			waitlistTeams: (team_registrations ?? []).filter((r) => r.status === 'waitlist').length
		}))
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A kvízeste neve kötelező.' });
		}

		const { data: game, error } = await supabase
			.from('games')
			.insert({ title, pin: generatePin(), host_id: user?.id })
			.select('id')
			.single();

		if (error || !game) {
			return fail(400, { error: error?.message ?? 'Nem sikerült létrehozni a kvízestét.' });
		}

		// Létrehozás után először az esemény adatai (időpont, helyszín, létszám).
		redirect(303, `/admin/games/${game.id}/event`);
	},

	// Próbaeste: 2 kör mintakérdésekkel a kezelő betanításához (riportokból kiszűrve).
	createPractice: async ({ locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const result = await createPracticeGame(supabase, user?.id);
		if ('error' in result) {
			return fail(400, { error: result.error });
		}
		redirect(303, `/admin/games/${result.gameId}`);
	},

	// Fázis Q3 — újranyitás, lásd reopenGameAction() ($lib/server/games.ts).
	reopen: async ({ request, locals: { supabase } }) => {
		const failure = await reopenGameAction(supabase, await request.formData());
		if (failure) return fail(400, failure);
		return { success: true, reopened: true };
	}
};
