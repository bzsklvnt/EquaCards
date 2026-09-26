// Vizuális köntös / design téma alkalmazása — docs/architecture/DATA_MODEL.md
// 8. szakasz. A design_themes.design_tokens egy szabad kulcs-érték jsonb
// (bővíthető séma-módosítás nélkül); ez a modul oldja fel futásidőben és
// alakítja CSS custom property-kké.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';

// A "Letisztult" alaptéma — ugyanaz a készlet, mint a seed
// (supabase/migrations/20260926150000_headcount_capacity_site.sql). A kezelői
// felület (DashboardShell, bejelentkezés, PIN-beíró) MINDIG ezt használja, a
// játékfelületek (host/csapat/TV) pedig akkor, ha az estére nincs más téma
// választva és a DB-ből nem töltődne be alapértelmezett.
export const defaultTokens: Record<string, string> = {
	'--cabinet': '#F6F3EC',
	'--cabinet-2': '#FFFFFF',
	'--cabinet-3': '#F6F3EC',
	'--marquee': '#1C1B18',
	'--marquee-dim': '#5E5A52',
	'--cyan': '#1E5B4F',
	'--power': '#1F7A4D',
	'--danger': '#B3261E',
	'--coin': '#8A4B0B',
	'--violet': '#1E5B4F',
	'--magenta': '#A3326B',
	'--glow': '0',
	'--scanline': 'transparent',
	'--panel-border': '#E4DED2',
	'--panel-border-width': '1px',
	'--field-border': '#D5CEC0',
	'--field-border-width': '1px',
	'--btn-primary': '#1E5B4F',
	'--btn-primary-hover': '#143F37',
	'--on-primary': '#FFFFFF',
	font_display: '"Fraunces", Georgia, serif',
	font_led: '"Hanken Grotesk", system-ui, sans-serif',
	font_body: '"Hanken Grotesk", system-ui, sans-serif'
};

// Díszítés-tokenek (DESIGN_SYSTEM.md): a régebbi témák (pl. "Arcade (fun)")
// nem tartalmazzák őket — ilyenkor a komponensek CSS fallbackje adja az
// arcade-os ragyogást/scanline-t, ezért ezeket NEM örökölheti a téma az
// alapértelmezettből.
const DECORATION_KEYS = new Set([
	'--glow',
	'--scanline',
	'--panel-border',
	'--panel-border-width',
	'--field-border',
	'--field-border-width',
	'--btn-primary',
	'--btn-primary-hover',
	'--on-primary'
]);

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
	if (!themeTokens) return defaultTokens;
	const base = Object.fromEntries(
		Object.entries(defaultTokens).filter(([key]) => !DECORATION_KEYS.has(key))
	);
	return { ...base, ...themeTokens };
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

// A saját domainről kiszolgált betűtípusok ($lib/assets/fonts/fonts.css) —
// ezekhez nem kell a Google Fonts.
const SELF_HOSTED_FONTS = new Set([
	'Fraunces',
	'Hanken Grotesk',
	'Inter',
	'Press Start 2P',
	'Silkscreen'
]);

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
				.filter((name): name is string => !!name && !SELF_HOSTED_FONTS.has(name))
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
