// Vizuális köntös / design téma alkalmazása — docs/architecture/DATA_MODEL.md
// 8. szakasz. A design_themes.design_tokens egy szabad kulcs-érték jsonb
// (bővíthető séma-módosítás nélkül); ez a modul oldja fel futásidőben és
// alakítja CSS custom property-kké.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// Ugyanaz a készlet, mint a seed (supabase/migrations/20260808123000_design_themes.sql)
// — végső biztonsági háló, ha a DB-ből valamiért nem töltődne be egy design téma sem.
export const defaultTokens: Record<string, string> = {
	'--cabinet': '#150e2c',
	'--cabinet-2': '#211640',
	'--cabinet-3': '#2c1d54',
	'--marquee': '#f5f0ff',
	'--marquee-dim': '#a79bc9',
	'--cyan': '#35e7ff',
	'--magenta': '#ff3e9a',
	'--power': '#b6ff3e',
	'--danger': '#ff5a36',
	'--coin': '#ffd23e',
	'--violet': '#9b5cff',
	font_display: '"Press Start 2P", monospace',
	font_led: '"Silkscreen", monospace',
	font_body: '"Inter", sans-serif'
};

// A design_tokens kulcsai néha már "--"-vel kezdődnek (színek), néha nem
// (font_display/font_led/font_body) — ez normalizálja mindkettőt egységes
// `--kebab-case` CSS custom property névre, hogy a stíluslapokban egyetlen
// névkonvenciót kelljen ismerni (`var(--font-display)`, nem `var(--font_display)`).
function cssVarName(key: string): string {
	const bare = key.startsWith('--') ? key.slice(2) : key;
	return `--${bare.replace(/_/g, '-')}`;
}

export function resolveTokens(
	themeTokens: Record<string, string> | null | undefined
): Record<string, string> {
	return { ...defaultTokens, ...(themeTokens ?? {}) };
}

// Inline style attribútumként használható CSS custom property lista — a
// gyökér elemre kerül, minden alatta lévő komponens `var(--cyan)` stb.
// hivatkozással automatikusan a kiválasztott téma értékét kapja.
export function tokensToCssText(tokens: Record<string, string>): string {
	return Object.entries(tokens)
		.map(([key, value]) => `${cssVarName(key)}: ${value};`)
		.join(' ');
}

// A host/csapat/TV felület ugyanazt a feloldási sorrendet követi
// (DATA_MODEL.md 8. szakasz): games.design_theme_id → az adott
// design_themes sor; ha üres, az is_default=true sor; ha az sincs
// (elvileg nem fordulhat elő), a hardcode-olt defaultTokens.
export async function getActiveTokens(
	supabase: SupabaseClient<Database>,
	designThemeId: string | null
): Promise<Record<string, string>> {
	const query = designThemeId
		? supabase.from('design_themes').select('design_tokens').eq('id', designThemeId).maybeSingle()
		: supabase.from('design_themes').select('design_tokens').eq('is_default', true).maybeSingle();

	const { data } = await query;
	return resolveTokens((data?.design_tokens as Record<string, string> | null) ?? null);
}
