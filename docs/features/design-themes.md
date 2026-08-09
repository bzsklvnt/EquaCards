# Vizuális köntös / design téma rendszer

## Cél

A `docs/architecture/DATA_MODEL.md` 8. szakaszában tervezett rendszer
implementációja: egy kvízeste vizuális köntöse (szín/font token-készlet)
teljesen független attól, milyen tartalmi témájú (`themes`) kérdésekkel fut —
a host bármelyik design témát bármelyik tartalmi kérdéscsokorhoz
választhatja, vagy maradhat az alapértelmezettnél.

## Adatmodell

```sql
create table design_themes (
  id uuid primary key default gen_random_uuid(),
  title text unique not null,
  design_tokens jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

create unique index idx_design_themes_default on design_themes (is_default) where is_default = true;
```

Az `enforce_single_default_design_theme()` trigger garantálja, hogy egyszerre
csak egy téma legyen `is_default = true` — ha egy admin egy másikat jelöl ki
alapértelmezettnek, a régi automatikusan leváltódik, nem kell a UI-nak
külön "előbb kapcsold ki a régit" logikát implementálnia. Ellenőrizve SQL-lel
(`supabase/migrations/20260808123000_design_themes.sql` alkalmazásakor): egy
második, `is_default = true`-val beszúrt téma valóban lekapcsolta az addigi
alapértelmezettet.

A `games.design_theme_id` (opcionális FK) köti egy estéhez a választott
témát — ha üres, az `is_default = true` design téma érvényes.

## RLS

- `design_themes_admin_all` (`role_id in (1,2)`): teljes CRUD, ugyanaz a kör,
  mint a tartalmi `themes`-nél.
- `design_themes_select_staff` (`role_id in (1,2,3)`): a host is olvashatja a
  listát, hogy választani tudjon belőle.
- `design_themes_select_anon` (`using (true)`): a csapat és a TV kliens is
  anon — mindkettőnek fel kell tudnia oldania a `games.design_theme_id`-t a
  tényleges token-készletre a megjelenítéshez. A `design_tokens` tisztán
  vizuális adat (szín/font), nincs benne semmi védendő.

Mindhárom RLS-szint ellenőrizve `execute_sql` + `set role`/JWT-claim
szimulációval: anon olvashat, host (role 3) olvashat de nem írhat (42501),
admin (role 2) ír.

## Token feloldás (`src/lib/theme/tokens.ts`)

```ts
export async function getActiveTokens(supabase, designThemeId: string | null) {
	// 1. games.design_theme_id → az adott design_themes sor
	// 2. ha üres → az is_default = true sor
	// 3. ha az sincs (elvileg nem fordulhat elő) → hardcode-olt defaultTokens
}
```

A `design_tokens` kulcsai néha `--`-vel kezdődnek (színek: `--cabinet`,
`--cyan`, ...), néha nem (`font_display`, `font_led`, `font_body`) — a
`cssVarName()` normalizálja mindkettőt egységes `--kebab-case` CSS custom
property névre (`--font-display` stb.), hogy a stíluslapokban egyetlen
névkonvenciót kelljen ismerni. A `tokensToCssText()` az eredményt inline
style-ként adja vissza, ami a gyökér elemre kerül
(`<main class="cabinet" style={themeCss}>`) — minden alul lévő komponens,
ami `var(--cyan)`-t használ, automatikusan a kiválasztott téma színét kapja.

Ezt a host (`/host/[game_id]`), a csapat (`/play/[pin]`) és a TV
(`/tv/[game_id]`) felület mindegyike ugyanígy alkalmazza.

## Betűtípusok — dinamikus betöltés (Fázis E)

A seedelt "Retro Arcade" téma három Google Font-ja (Press Start 2P,
Silkscreen, Inter) statikusan be van linkelve a `src/app.html`-ben
(zéró-latenciás, nincs villanás az alapértelmezett témánál). Egy admin
által felvitt **másik** téma más `font_display`/`font_led`/`font_body`
nevet is megadhat — ezeket a `getActiveTokens()` minden hívása
futásidőben, dinamikusan betölti Google Fonts-ról
(`src/lib/theme/tokens.ts` `loadThemeFonts()`), egy `<link>`-et
injektálva a `<head>`-be. Ha a megadott betűtípus nem létezik a Google
Fonts-on, a kérés 400-at ad vissza, a böngésző ezt figyelmen kívül
hagyja, és a CSS `font-family` fallback lánca érvényesül — nincs törött
UI. Részletek, a hibatűrés élő ellenőrzésével együtt:
`docs/architecture/DESIGN_SYSTEM.md` "Betűtípusok dinamikus betöltése"
szakasz.

## Admin felület (`/admin/design-themes`)

- Lista + "Új design téma" + szerkesztés/törlés (`[id]`).
- A token-készlet szerkesztése egy JSON textarea-val történik (nem
  fix-mezős űrlappal) — ez szándékos: a `design_tokens` séma explicit célja,
  hogy tetszőleges jövőbeli kulccsal bővíthető legyen séma-módosítás
  nélkül, egy fix-mezős admin form ezt a rugalmasságot elvenné. A textarea
  a Retro Arcade seed kulcskészletével van előtöltve új témánál, kliens
  oldali JSON.parse validációval (a "Létrehozás"/"Mentés" gomb inaktív
  érvénytelen JSON esetén).
- Az alapértelmezett téma nem törölhető (sem a lista, sem a szerkesztő
  oldalról) — előbb egy másikat kell alapértelmezettnek jelölni, különben a
  `games` sorok üres `design_theme_id`-jának feloldása megbukna.

## Host felület

A lobby nézetben (`/host/[game_id]`, `game.status === 'lobby'`) egy
legördülő lista jelenik meg a felvitt design témákkal — kiválasztáskor
azonnal frissíti a `games.design_theme_id`-t, és a token-készlet újra
feloldódik/alkalmazódik a host saját felületén is (élő előnézet).

## Seedelt témák

A "Retro Arcade" (alapértelmezett) mellett két további design téma van
seedelve (`supabase/migrations/20260809140000_design_themes_hp_sport.sql`,
egyik sem `is_default`):

- **"Roxfort"** — Harry Potter ihletésű köntös: éjkék/sötétgránát
  háttér (`--cabinet: #0F1A2E`), pergamen-krém szöveg
  (`--marquee: #F1E6C8`), zafírkék elsődleges kiemelés (`--cyan:
#4C74C9`), aranyszín "galleon" kiemelés (`--coin: #FFD700`),
  smaragdzöld helyes válasz (`--power: #2F8F5B`), vörös hiba/veszély
  (`--danger: #A61C21`), ametiszt lila + rózsaszín-bordó joker-gradiens
  (`--violet: #5B3A99` / `--magenta: #B33A5B`). Betűtípusok: `Cinzel
Decorative` (display), `Cinzel` (LED/timer — jó olvasható
  számjegyekkel), `EB Garamond` (törzsszöveg, régi könyv hatás).
- **"Sportaréna"** — sport ihletésű köntös: sötétkék stadion-háttér
  (`--cabinet: #0A1F3D`), fehér "eredményjelző" szöveg (`--marquee:
#FFFFFF`), élénk narancs elsődleges kiemelés (`--cyan: #FF6B00`),
  arany "érem" kiemelés (`--coin: #FFC300`), zöld helyes válasz
  (`--power: #23C16B`), piros hiba/veszély (`--danger: #E8112D`),
  élénk lila + neon pink joker-gradiens (`--violet: #5D3FD3` /
  `--magenta: #FF2D78`). Betűtípusok: `Anton` (display, kondenzált
  sport-fejléc), `Bebas Neue` (LED/timer — klasszikus mezszám-stílus),
  `Oswald` (törzsszöveg, kondenzált, jól olvasható).

Mindkettő ugyanazt a teljes token-készletet adja meg, mint a Retro
Arcade seed (lásd fent "Miért `design_tokens not null`") — nincs
részleges/felülíró téma. A `font_display`/`font_led`/`font_body`
értékei nem szerepelnek statikusan az `app.html`-ben, tehát a fenti
"Betűtípusok — dinamikus betöltés" szakasz szerint futásidőben,
Google Fonts-ról töltődnek be az első alkalmazáskor.
