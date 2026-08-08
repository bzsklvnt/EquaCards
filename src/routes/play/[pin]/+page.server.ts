import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const { data: game } = await supabase
		.from('games')
		.select('id, title')
		.eq('pin', params.pin)
		.eq('status', 'lobby')
		.single();

	return { pin: params.pin, game };
};

export const actions: Actions = {
	join: async ({ request, params, locals: { supabase } }) => {
		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();
		const deviceToken = formData.get('device_token') as string;

		if (!name) {
			return fail(400, { error: 'A csapatnév kötelező.' });
		}
		if (!deviceToken) {
			return fail(400, { error: 'Hiányzó eszközazonosító, próbáld újra.' });
		}

		const { data: game } = await supabase
			.from('games')
			.select('id, title')
			.eq('pin', params.pin)
			.eq('status', 'lobby')
			.single();

		if (!game) {
			return fail(400, { error: 'A PIN nem található, vagy a játék már elindult.' });
		}

		const { data: team, error } = await supabase
			.from('teams')
			.insert({ game_id: game.id, name, device_token: deviceToken })
			.select('id, name')
			.single();

		if (error || !team) {
			if (error?.code === '23505') {
				return fail(400, {
					error: 'Ez a csapatnév már foglalt ebben a kvízestén, válassz másikat.'
				});
			}
			return fail(400, { error: error?.message ?? 'Nem sikerült csatlakozni.' });
		}

		return { success: true as const, team, game };
	}
};
