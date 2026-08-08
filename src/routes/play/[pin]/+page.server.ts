import { error as kitError, fail } from '@sveltejs/kit';
import { isRateLimited } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

// A PIN 6 jegyű (kb. 900 000 lehetőség) — szekvenciális találgatás elleni
// gát. IP-nkénti, memóriabeli számláló (lásd $lib/server/rate-limit.ts),
// mindkét belépési ponton (load ÉS a join action) érvényesítve, mert egy
// szkript közvetlenül POST-olhatna a ?/join action-re a load() kihagyásával.
const PIN_ATTEMPT_LIMIT = 20;
const PIN_ATTEMPT_WINDOW_MS = 60_000;
const RATE_LIMIT_MESSAGE = 'Túl sok próbálkozás, várj egy percet, mielőtt újra próbálkozol.';

export const load: PageServerLoad = async ({ params, locals: { supabase }, getClientAddress }) => {
	if (isRateLimited(getClientAddress(), PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_MS)) {
		kitError(429, RATE_LIMIT_MESSAGE);
	}

	const { data: game } = await supabase
		.from('games')
		.select('id, title, design_theme_id')
		.eq('pin', params.pin)
		.eq('status', 'lobby')
		.single();

	return { pin: params.pin, game };
};

export const actions: Actions = {
	join: async ({ request, params, locals: { supabase }, getClientAddress }) => {
		if (isRateLimited(getClientAddress(), PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_MS)) {
			return fail(429, { error: RATE_LIMIT_MESSAGE });
		}

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
			.select('id, title, design_theme_id')
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
