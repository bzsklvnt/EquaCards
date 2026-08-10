import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

function generatePin(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data: games } = await supabase
		.from('games')
		.select('id, title, status, pin, created_at, finished_at, teams(count)')
		.order('created_at', { ascending: false });

	return { games: games ?? [] };
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

		redirect(303, `/admin/games/${game.id}`);
	},

	// Fázis Q3 — a "Kvízeste újranyitása" a games.status-t 'lobby'-ra
	// állítja vissza (nem 'active'-re és nem 'paused'-re — lásd
	// docs/DECISIONS_LOG.md a döntés indoklásáért), és törli a
	// finished_at-ot. A trg_audit_games trigger (Fázis Q3 migráció)
	// automatikusan naplózza ezt a games.update-et az audit_logs-ba, nincs
	// itt külön teendő hozzá.
	reopen: async ({ request, locals: { supabase } }) => {
		const formData = await request.formData();
		const gameId = formData.get('game_id') as string;

		if (!gameId) {
			return fail(400, { error: 'Hiányzó kvízeste azonosító.' });
		}

		const { error } = await supabase
			.from('games')
			.update({ status: 'lobby', finished_at: null })
			.eq('id', gameId)
			.eq('status', 'finished');

		if (error) {
			return fail(400, { error: error.message });
		}

		return { success: true, reopened: true };
	}
};
