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
	const { data: game } = await supabase
		.from('games')
		.select('id, title, pin, status, design_theme_id')
		.eq('id', params.game_id)
		.single();

	if (!game) {
		kitError(404, 'A kvízeste nem található.');
	}

	return { game };
};
