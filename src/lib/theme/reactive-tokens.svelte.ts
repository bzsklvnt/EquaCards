// Fázis P5 — a design téma alkalmazása korábban egyszeri feloldás volt
// (onMount / a games.design_theme_id-t figyelő $effect egyszeri lefutása):
// egy design téma váltás (akár a globális alapértelmezett, akár egy adott
// este design_theme_id-ja) csak oldal-újratöltésnél jelent meg. Ez a modul
// egy újrafelhasználható, reaktív Svelte 5 hookot ad — a getActiveTokens()
// eredményét (docs/architecture/DATA_MODEL.md 8. szakasz) automatikusan
// újra feloldja és alkalmazza, amikor:
//   1. a hívó által megadott designThemeId getter értéke megváltozik
//      (pl. a host átvált egy másik témára az adott estén), VAGY
//   2. a design_themes tábla bármelyik sora változik (pl. egy admin
//      átállítja a globális alapértelmezettet a /admin/settings oldalon,
//      vagy szerkeszti egy meglévő téma token-készletét) — az adatbázis
//      ilyenkor broadcastot küld a `design_themes` csatornára, amire minden
//      nyitott felület (host, csapat, TV) feliratkozik, és újra feloldja a
//      tokeneket, reload nélkül.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { defaultTokens, getActiveTokens, tokensToCssText } from './tokens';

export function createReactiveThemeTokens(
	supabase: SupabaseClient<Database>,
	designThemeId: () => string | null
) {
	let css = $state(tokensToCssText(defaultTokens));

	function resolve(themeId: string | null) {
		getActiveTokens(supabase, themeId).then((tokens) => {
			css = tokensToCssText(tokens);
		});
	}

	$effect(() => {
		const themeId = designThemeId();
		resolve(themeId);

		// Egy téma színeinek módosításakor az adatbázis broadcastot küld a
		// `design_themes` csatornára (trg_broadcast_design_themes) — ekkor újra
		// feloldjuk a tokeneket. A tábla kicsi, nem éri meg finomabban szűrni.
		const channel = supabase
			.channel('design_themes')
			.on('broadcast', { event: 'changed' }, () => resolve(themeId))
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	});

	return {
		get css() {
			return css;
		}
	};
}
