import { error as kitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// A TV/kivetítő felület read-only, ugyanolyan (anon) hozzáféréssel, mint a
// csapat kliens — nincs saját táblája/oszlopa (DATA_MODEL.md 7. szakasz), a
// games_select_anon RLS policy-ra támaszkodik. Nincs role-alapú route guard:
// a kivetítőt böngésző valaki legfeljebb a saját estéje (ismert game_id-ja)
// élő állapotát látja, ugyanaz a "de facto tulajdonjog egy ismert UUID-n
// keresztül" biztonsági szint, mint amit a projekt a csapat-oldalon is
// következetesen alkalmaz.
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// A PIN anonim módon csak ezen a függvényen át olvasható (a kivetítő a
	// csatlakozó QR-kódhoz használja) — docs/architecture/DATA_MODEL.md.
	const { data: rows } = await supabase.rpc('tv_game', { p_game_id: params.game_id });
	const game = rows?.[0];

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	return { game };
};
