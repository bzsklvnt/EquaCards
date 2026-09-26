import { error as kitError, fail } from '@sveltejs/kit';
import { recordFailure, tooManyFailures } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

// A PIN 6 jegyű (kb. 900 000 lehetőség) — szekvenciális találgatás elleni
// gát. IP-nkénti, memóriabeli számláló (lásd $lib/server/rate-limit.ts),
// mindkét belépési ponton (load ÉS a join action) érvényesítve, mert egy
// szkript közvetlenül POST-olhatna a ?/join action-re a load() kihagyásával.
// Csak a SIKERTELEN próbálkozás (nem létező PIN, rossz csapatkód) számít: egy
// kocsmában minden telefon ugyanazzal a nyilvános IP-vel érkezik, a sikeres
// csatlakozások így nem fogyasztják el egymás elől a keretet.
const PIN_ATTEMPT_LIMIT = 20;
const PIN_ATTEMPT_WINDOW_MS = 60_000;
const RATE_LIMIT_MESSAGE = 'Túl sok próbálkozás, várj egy percet, mielőtt újra próbálkozol.';

export const load: PageServerLoad = async ({ params, locals: { supabase }, getClientAddress }) => {
	const ip = getClientAddress();
	if (tooManyFailures(ip, PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_MS)) {
		kitError(429, RATE_LIMIT_MESSAGE);
	}

	// A PIN nem olvasható közvetlenül a games táblából (anonim módon) — a
	// game_by_pin() függvény csak a megadott PIN-hez tartozó estét adja vissza.
	const { data: rows } = await supabase.rpc('game_by_pin', { p_pin: params.pin });
	const found = rows?.[0] ?? null;
	if (!found) recordFailure(ip, PIN_ATTEMPT_WINDOW_MS);

	// Csapatkódos estén (docs/features/landing-and-registration.md "Csapatkód")
	// a kóddal a játék indulása után is lehet csatlakozni / másik telefonról
	// visszalépni; név alapján csak a váró állapotban, kód nélküli estén.
	const joinMode: 'code' | 'name' | null = !found
		? null
		: found.join_requires_code
			? 'code'
			: found.status === 'lobby'
				? 'name'
				: null;
	const game =
		joinMode && found
			? { id: found.id, title: found.title, design_theme_id: found.design_theme_id }
			: null;

	// Név alapú csatlakozásnál a jelentkezett (megerősített) csapatok nevei
	// egy koppintással kiválaszthatók.
	const { data: registered } =
		game && joinMode === 'name'
			? await supabase.rpc('registered_team_names', { p_game_id: game.id })
			: { data: null };

	return {
		pin: params.pin,
		game,
		joinMode,
		registeredNames: (registered ?? []).map((r) => r.team_name)
	};
};

const JOIN_CODE_ERRORS: Record<string, string> = {
	invalid_code:
		'Ez a csapatkód nem érvényes erre az estére. A kódot a visszaigazoló e-mailben találod — helyszíni csapatként kérd a kvízmestertől.',
	game_not_found: 'A PIN nem található, vagy az este már véget ért.',
	game_closed: 'Az este már véget ért.',
	invalid_input: 'Hiányzó eszközazonosító, próbáld újra.'
};

export const actions: Actions = {
	joinCode: async ({ request, params, locals: { supabase }, getClientAddress }) => {
		const ip = getClientAddress();
		if (tooManyFailures(ip, PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_MS)) {
			return fail(429, { error: RATE_LIMIT_MESSAGE });
		}

		const formData = await request.formData();
		const code = ((formData.get('code') as string) ?? '').trim().toUpperCase();
		const deviceToken = formData.get('device_token') as string;
		if (!/^[A-Z0-9]{6}$/.test(code)) {
			return fail(400, { error: 'A csapatkód 6 karakter (betűk és számok).' });
		}

		const { data, error } = await supabase.rpc('join_with_code', {
			p_pin: params.pin,
			p_code: code,
			p_device_token: deviceToken ?? ''
		});
		const row = data?.[0];
		if (error || !row) {
			recordFailure(ip, PIN_ATTEMPT_WINDOW_MS);
			const key = Object.keys(JOIN_CODE_ERRORS).find((k) => error?.message.includes(k));
			return fail(400, { error: key ? JOIN_CODE_ERRORS[key] : 'Nem sikerült csatlakozni.' });
		}

		return {
			success: true as const,
			team: { id: row.team_id, name: row.team_name },
			game: { id: row.game_id, title: row.game_title, design_theme_id: row.design_theme_id }
		};
	},

	join: async ({ request, params, locals: { supabase }, getClientAddress }) => {
		const ip = getClientAddress();
		if (tooManyFailures(ip, PIN_ATTEMPT_LIMIT, PIN_ATTEMPT_WINDOW_MS)) {
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

		const { data, error } = await supabase.rpc('join_with_name', {
			p_pin: params.pin,
			p_name: name,
			p_device_token: deviceToken
		});
		const row = data?.[0];
		if (error || !row) {
			const message = error?.message ?? '';
			if (message.includes('name_taken')) {
				return fail(400, {
					error: 'Ez a csapatnév már foglalt ebben a kvízestén, válassz másikat.'
				});
			}
			if (message.includes('code_required')) {
				return fail(400, { error: 'Erre az estére csak csapatkóddal lehet csatlakozni.' });
			}
			recordFailure(ip, PIN_ATTEMPT_WINDOW_MS);
			return fail(400, { error: 'A PIN nem található, vagy a játék már elindult.' });
		}

		const team = { id: row.team_id, name: row.team_name };
		const game = { id: row.game_id, title: row.game_title, design_theme_id: row.design_theme_id };
		return { success: true as const, team, game };
	}
};
