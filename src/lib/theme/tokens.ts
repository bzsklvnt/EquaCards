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

// Egy CSS font-family értékből ("\"Press Start 2P\", monospace") kiszedi a
// tényleges betűtípus nevét ("Press Start 2P") — ez az első, vessző előtti
// darab, az idézőjeleket levágva.
function extractFontFamilyName(fontFamilyValue: string): string | null {
	const first = fontFamilyValue
		.split(',')[0]
		?.trim()
		.replace(/^["']|["']$/g, '');
	return first || null;
}

// Melyik betűtípus-készletekre injektáltunk már <link>-et — ne töltsük be
// kétszer ugyanazt a Google Fonts kombinációt navigáció/téma-váltás közben.
const loadedFontSets = new Set<string>();

// Fázis E: eddig csak a seedelt "Retro Arcade" téma 3 fontja volt belinkelve
// statikusan az app.html-ben — egy admin által létrehozott, más fontokat
// használó design téma csendben a böngésző alap sans-serif/monospace-ára
// esett vissza. Ez a függvény a design_tokens font_display/font_led/
// font_body kulcsaiból futásidőben épít egy Google Fonts CSS2 URL-t, és
// <link>-ként injektálja a <head>-be, ha még nem történt meg ugyanezekkel a
// betűtípusokkal. Hibatűrő: ha egy betűtípus nem létezik a Google Fonts-on,
// a <link> egyszerűen nem alkalmaz semmit, és a meglévő CSS font-family
// fallback lánc (pl. ", monospace") már eleve gondoskodik a visszaesésről —
// nincs szükség extra try/catch-re a betöltés sikerességének ellenőrzéséhez.
export function loadThemeFonts(tokens: Record<string, string>): void {
	if (typeof document === 'undefined') return;

	const names = [
		...new Set(
			['font_display', 'font_led', 'font_body']
				.map((key) => tokens[key])
				.filter((value): value is string => !!value)
				.map(extractFontFamilyName)
				.filter((name): name is string => !!name)
		)
	];

	if (names.length === 0) return;

	const cacheKey = [...names].sort().join('|');
	if (loadedFontSets.has(cacheKey)) return;
	loadedFontSets.add(cacheKey);

	const familyParams = names
		.map((name) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;600;700`)
		.join('&');

	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.href = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
	document.head.appendChild(link);
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
	const tokens = resolveTokens((data?.design_tokens as Record<string, string> | null) ?? null);
	loadThemeFonts(tokens);
	return tokens;
}
