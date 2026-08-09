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
//      vagy szerkeszti egy meglévő téma token-készletét) — mindkét eset
//      Postgres Changes eseményt vált ki, amire minden nyitott felület
//      (admin/riportok, host, csapat, TV) feliratkozik, és újra feloldja
//      a tokeneket, reload nélkül.
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

		// A design_themes tábla mérete elhanyagolható (néhány tucat sor) —
		// nem éri meg finomabban szűrni, hogy pontosan a jelenleg aktív
		// témát/az is_default sort érintette-e a változás; egyszerűbb és
		// ugyanolyan olcsó minden eseményre újra feloldani.
		const channel = supabase
			.channel('design_themes_reactive_tokens')
			.on('postgres_changes', { event: '*', schema: 'public', table: 'design_themes' }, () =>
				resolve(themeId)
			)
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
