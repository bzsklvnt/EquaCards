import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createPracticeGame,
	deleteGameAction,
	insertGameWithPin,
	reopenGameAction
} from '$lib/server/games';

// Kvízesték — lista · részlet · műveletek (docs/features/admin-workspace.md).
export const load: PageServerLoad = async ({ depends, locals: { supabase } }) => {
	depends('app:page');
	const { data: games } = await supabase
		.from('games')
		.select(
			'id, title, status, pin, created_at, finished_at, is_practice, scheduled_at, is_public, max_players, join_requires_code, venues(name, city), teams(count), team_registrations(headcount, status), rounds!rounds_game_id_fkey(id, title, order_index, round_questions(count))'
		)
		.order('scheduled_at', { ascending: false, nullsFirst: true })
		.order('created_at', { ascending: false });

	return {
		games: (games ?? []).map(({ team_registrations, rounds, teams, ...game }) => ({
			...game,
			teamCount: teams?.[0]?.count ?? 0,
			confirmedPlayers: (team_registrations ?? [])
				.filter((r) => r.status === 'confirmed')
				.reduce((sum, r) => sum + r.headcount, 0),
			confirmedTeams: (team_registrations ?? []).filter((r) => r.status === 'confirmed').length,
			waitlistTeams: (team_registrations ?? []).filter((r) => r.status === 'waitlist').length,
			rounds: (rounds ?? [])
				.map((r) => ({
					id: r.id,
					title: r.title,
					order_index: r.order_index,
					questions: r.round_questions?.[0]?.count ?? 0
				}))
				.sort((a, b) => a.order_index - b.order_index)
		}))
	};
};

export const actions: Actions = {
	// Végleges törlés — csak rendszergazda (deleteGameAction, RLS + RPC ellenőrzi).
	deleteGame: async ({ request, locals: { supabase } }) => {
		const result = await deleteGameAction(supabase, await request.formData());
		if ('error' in result) return fail(400, { error: result.error });
		return { success: true, deleted: result.title };
	},

	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { user } = await safeGetSession();
		const formData = await request.formData();
		const title = (formData.get('title') as string)?.trim();

		if (!title) {
			return fail(400, { error: 'A kvízeste neve kötelező.' });
		}

		const game = await insertGameWithPin(supabase, { title, host_id: user?.id });
		if ('error' in game) {
			return fail(400, { error: game.error });
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
