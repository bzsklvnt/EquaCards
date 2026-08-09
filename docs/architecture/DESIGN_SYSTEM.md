# Design System

> **STATUS: IN PROGRESS.** Started in the post-review "Fázis F0" (style guide +
> component library) — see `NEXT_STEPS.md` (repo gyökér) és
> `docs/DECISIONS_LOG.md` a fázisonkénti bővítésekért.

## Forrás

A tényleges design tokenek egyetlen forrása a `design_themes` tábla
(`docs/architecture/DATA_MODEL.md` 8. szakasz, `docs/features/design-themes.md`)
— jelen dokumentum és a `docs/design/STYLE_GUIDE.html` a jelenlegi
alapértelmezett ("Retro Arcade") téma vizuális referenciája, nem egy attól
független, kőbe vésett paletta. Ha a seed változik, ezeket is frissíteni kell.

Élő, böngészőben megnyitható referencia: `docs/design/STYLE_GUIDE.html`.

## Szín-szerepek

| Token                                       | Szerep                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| `--cyan`                                    | Elsődleges interaktív elem (kiválasztott állapot, fókusz-gyűrű, linkek) |
| `--power`                                   | Helyes válasz, pozitív visszajelzés, pontszám kiemelés                  |
| `--danger`                                  | Helytelen válasz, sürgető timer (utolsó 5 másodperc)                    |
| `--coin`                                    | PIN, rangsor-helyezés, kiemelt szám                                     |
| `--magenta`                                 | **Kizárólag** a joker gomb (`Duplázás`) — sehol máshol, lásd Fázis N3   |
| `--violet`                                  | Elsődleges gomb (`Button.svelte` `.primary`) — alap ÉS hover állapot is |
| `--cabinet` / `--cabinet-2` / `--cabinet-3` | Háttér-gradiens (sötéttől világosabb felé)                              |
| `--marquee`                                 | Elsődleges szöveg                                                       |
| `--marquee-dim`                             | Másodlagos szöveg, placeholder, inaktív elem                            |

**Szabály:** ne keveredjenek a szerepek — pl. `--danger` sose dekoratív
elem, csak hiba/sürgetés jelzésére. Ha egy komponensnek új szín-szerep
kellene, bővítsd ezt a táblázatot és a `design_themes` seedet együtt, ne
vezess be ad-hoc hex-kódot.

**Fázis N3 — véglegesített gomb-szín döntés:** élő böngészős teszt
jelezte, hogy az elsődleges akció-gombok (Kijelentkezés, + Új kérdés,
Kvíz indítása stb.) a `Button.svelte` `.primary` variánsán keresztül
lila kitöltést kaptak, miközben a hover-állapot és a keret magenta volt
— ez elmosta a határt a "sima elsődleges gomb" és a "joker, mint speciális
akció" között. Döntés: a lila (`--violet`) marad az elsődleges gomb
színe **alap ÉS hover állapotban is** (a hover csak sötétebb lila
árnyalat, nincs színváltás), a magenta (`--magenta`) pedig kizárólag a
joker gombnál jelenik meg, egy `--magenta`→`--violet` gradiensben
(`src/routes/play/[pin]/+page.svelte` `.joker-wrap`), hogy vizuálisan
azonnal megkülönböztethető legyen minden más elsődleges gombtól. A
joker korábban `--coin`/`--danger` színpárt használt — ez a pár mostantól
kizárólag a `--coin` "kiemelt szám" szerepére korlátozódik, a `--danger`
pedig a hiba/sürgetés szerepére.

## Tipográfia

| Token            | Betűtípus      | Használat                                            |
| ---------------- | -------------- | ---------------------------------------------------- |
| `--font-display` | Press Start 2P | **Rövid** címek/kérdések — sose hosszú próza         |
| `--font-led`     | Silkscreen     | Minden szám-jellegű kijelzés: timer, pontszám, PIN   |
| `--font-body`    | Inter          | Minden más: gombszöveg, leírások, form mezők, listák |

### Betűtípusok dinamikus betöltése (Fázis E)

A fenti három font a seedelt "Retro Arcade" témára statikusan be van
linkelve az `app.html`-ben (zéró-latenciás, nincs villanás az
alapértelmezett témánál). Egy admin által létrehozott **másik** design
téma viszont tetszőleges betűtípust megadhat a `design_tokens`
`font_display`/`font_led`/`font_body` kulcsaiban (`/admin/design-themes`
nyers JSON-szerkesztője) — ezekhez a `src/lib/theme/tokens.ts`
`loadThemeFonts()` függvénye épít futásidőben egy Google Fonts CSS2 URL-t
(kinyeri a tényleges betűtípus-nevet a CSS `font-family` értékből, pl.
`"Bangers", cursive` → `Bangers`), és `<link>`-ként injektálja a
`<head>`-be — a `getActiveTokens()` minden hívása automatikusan lefuttatja,
nem kell a hívó oldalaknak külön hívniuk. Egy `Set`-alapú cache
(`loadedFontSets`) megakadályozza, hogy ugyanaz a betűtípus-kombináció
többször is beinjektálódjon navigáció/téma-váltás közben.

**Hibatűrés**: ha egy megadott betűtípus nem létezik a Google Fonts-on, a
Google CSS2 API 400-at ad vissza (HTML hibaoldalt, nem érvényes CSS-t) —
élőben leellenőrizve (`curl`, mivel a `fonts.googleapis.com` — a
Supabase-től eltérően — nincs blokkolva ebben a sandboxban). A böngésző
ezt egyszerűen figyelmen kívül hagyja, és a CSS `font-family` lánc már
eleve ott lévő fallback tagja (pl. `, monospace`) érvényesül — nincs
szükség extra JS-oldali hibakezelésre.

A kártyaszerű felületek alap mintája: `var(--cabinet-2)` háttér,
`2px solid var(--violet)` keret, `1rem` lekerekítés, finom scanline
textúra (`repeating-linear-gradient` vízszintes csíkokkal, ~3.5%
opacitású fehér). Lásd `docs/design/STYLE_GUIDE.html` "Arcade panel"
szakasza az élő példáért. Két konkrét alkalmazása:

- **`ArcadePanel.svelte`** (Fázis K) — a kérdés-kártyát csomagolja be
  vele mindhárom élő felület (`/host`, `/play/[pin]`, `/tv`), pontosan a
  STYLE_GUIDE.html demójának megfelelően.
- **`PinDisplay.svelte`** — saját, hasonló de nem azonos implementáció
  (extra `box-shadow` glow), Fázis K-ban kapta meg a hiányzó
  scanline-t (korábban csak a keretet/hátteret örökölte az
  arcade-panel mintából).

**`PodiumCard.svelte` (ranglista-sor) szándékosan _nem_ az arcade-panel
mintát követi** — ezt a STYLE_GUIDE.html saját demója is így mutatja:
rangsor-alapú keretszín (`--marquee-dim` alapból, `--coin` a top 3-nál,
`--cyan` a sajátnál), scanline és `--violet` keret nélkül. Ez tudatos UX
döntés (a helyezés vizuálisan megkülönbözteti a sorokat), nem az
arcade-panel mintától való véletlen elkanyarodás.

## Komponens-könyvtár (`src/lib/components/`)

| Komponens                 | Props                                                                                                                                  | Jegyzet                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `Button.svelte`           | `variant` (`primary`\|`secondary`\|`danger`\|`ghost`), `type`, `disabled`, `href`, `onclick`, `children`                               | `href` esetén `<a>`-ként renderel, egyébként `<button>`-ként                                                                           |
| `ChoiceButton.svelte`     | `text`, `selected`, `disabled`, `onclick`                                                                                              | Egy/több-választós válasz-opció                                                                                                        |
| `TimerRing.svelte`        | `secondsLeft`, `duration`, `size`, `inactive`                                                                                          | SVG körvisszaszámláló, `low` (≤5 mp) pulzáló `--danger`, `inactive` szürke forgó "dolgozom" állapot                                    |
| `PinDisplay.svelte`       | `pin`, `qrDataUrl`, `joinUrl`                                                                                                          | PIN + QR + csatlakozási URL egy arcade panelben                                                                                        |
| `TeamChip.svelte`         | `name`, `own`                                                                                                                          | Csapatnév pill-jelvény, `own` kiemeli a sajátot                                                                                        |
| `PodiumCard.svelte`       | `rank`, `name`, `score`, `scoreLabel`, `own`                                                                                           | Ranglista-sor, top 3-nál érem-emoji                                                                                                    |
| `Input.svelte`            | `label`, `name`, `type`, `value` (bindable), `placeholder`, `required`, `maxlength`, `minlength`, `min`, `max`, `step`, `autocomplete` | Label + input, min. 44px magasság érintéshez                                                                                           |
| `Select.svelte`           | `label`, `name`, `value` (bindable), `required`, `children`, `onchange`                                                                | Label + select, `children` az `<option>` elemekhez                                                                                     |
| `Checkbox.svelte`         | `label`, `name`, `checked` (bindable), `value`, `onchange`                                                                             | Label + checkbox, `accent-color: var(--cyan)`                                                                                          |
| `Textarea.svelte`         | `label`, `name`, `value` (bindable), `placeholder`, `required`, `rows`, `spellcheck`, `monospace`                                      | `monospace` a `--font-led`-et alkalmazza (pl. JSON-szerkesztőknél)                                                                     |
| `ReconnectOverlay.svelte` | `message`                                                                                                                              | Teljes képernyős "Kapcsolat helyreállítása…" overlay `inactive` `TimerRing`-gel — `/play`, `/tv` (Fázis I)                             |
| `ArcadePanel.svelte`      | `children`                                                                                                                             | Generikus arcade-panel wrapper (keret + scanline) — a kérdés-kártyát csomagolja be `/host`, `/play/[pin]`, `/tv` (Fázis K)             |
| `DashboardShell.svelte`   | `profile`, `supabase`, `children`                                                                                                      | Sidebar/header héj (Fázis O5) — `/admin/+layout.svelte` ÉS `/reports/+layout.svelte` is ezt burkolja be, szerepkör-függő nav-elemekkel |

**Szándékosan nem lett belőlük komponens:** a `question_type_id` `<select>`
(a Svelte fordító csak egy literál, nem-absztrahált elemen tudja alkalmazni
a `bind:value` numerikus kényszerítését, egy generikus `Select` mögött ez
elveszne), az egyetlen `true_false` rádiógomb-pár (egyetlen előfordulás az
egész appban, nem éri meg absztrahálni), és a `/play/[pin]` csúszka/sorrendező
lista (szintén egyedi előfordulások). Alapelv: a könyvtárat csak akkor
bővítjük, ha egy minta ténylegesen ismétlődik — lásd Fázis H lezárása alább.

Minden komponens a legközelebbi `.cabinet` osztályú (vagy a design-token
`style` attribútumot hordozó) ős elemtől örökli a CSS custom property-ket —
nincs saját, beépített színkészletük, a `getActiveTokens()`/`tokensToCssText()`
(`src/lib/theme/tokens.ts`) alkalmazza őket a gyökér elemre.

**`min-height: 44px` + explicit `box-sizing: border-box` (Fázis O5):** a
`Button`/`Input`/`Select` mind `min-height: 44px`-et ír elő az érintési
célpont-mérethez, de explicit `box-sizing` nélkül a böngésző UA-stílustól
függ, hogy ez a padding+border-t is magába foglalja-e — élő tesztelés
egy input és egy mellette álló gomb közötti magasság-eltérést talált.
Mindhárom komponens mostantól explicit `box-sizing: border-box`-ot ír
elő, hogy a `min-height` garantáltan a teljes renderelt magasságot
jelentse, böngésző-alapértelmezéstől függetlenül.

## Fókusz és akadálymentesség

Minden interaktív komponens explicit `:focus-visible` stílust kap
(`outline: 3px solid var(--cyan)`), mert a sötét, neon-akcentú design
könnyen "eltünteti" a böngésző alapértelmezett fókusz-gyűrűjét. Az érintési
célpontok (gombok, checkbox, input) minimum 44×44px-esek.

## Layout héjak felületenként (Fázis F)

A `docs/architecture/DATA_MODEL.md` 7. szakaszának négy felülete eltérő
célra szabott layout-keretet kap:

- **`/admin` és `/reports`** (`src/lib/components/DashboardShell.svelte`,
  Fázis O5): perzisztens header + bal oldali sidebar navigáció
  (Kérdésbank, Témák, Vizuális témák, Kvízesték csak `role_id in (1,2)`-nek;
  Felhasználók/Beállítások csak `role_id = 1`-nek; Riportok mindenkinek,
  bejelentkezett szerepkörtől függetlenül). Mobilon (`≤768px`) a sidebar
  hamburger-menübe csukódik. `getActiveTokens(supabase, null)`
  alapértelmezett vizuális témát kap mindkét felület (nincs `games`
  sorhoz kötve, mint a host/csapat/TV).
  - **Miért megosztott komponens, nem egy közös route-fa:** a `/reports`
    (`role_id in (1,2,3,4)` — minden szerepkör) korábban egyáltalán nem
    használt semmilyen közös héjat (saját, csupasz oldal, navigáció és
    vissza-gomb nélkül — élő tesztelésből jelzett hiba). A logikus
    megoldásnak tűnő SvelteKit route group (`(dashboard)/admin` +
    `(dashboard)/reports` közös `+layout.svelte` alatt) **kipróbálva, de
    elvetve**: a route group a _fájlrendszerben_ elrejti a csoport nevét
    az URL-ből, de a `resolve()` típusos router API-ja a _route ID_
    alapján generálja az overloadokat, ami MÉG mindig tartalmazza a
    csoport-nevet (`"/(dashboard)/admin/games/[id]"`) — ez minden, a
    projektben szétszórt `resolve('/admin/games/[id]', {...})` hívást
    (pl. `/host/[game_id]/+layout.svelte`-ben is) eltört volna, vagy
    mindenhol a csoport-nevet kellett volna belekódolni egy belső
    implementációs részletként. A megosztott `DashboardShell` komponens
    (nem route-szintű layout, hanem `Button`/`ArcadePanel` mintájú
    UI-komponens, amit `/admin/+layout.svelte` ÉS `/reports/+layout.svelte`
    is `{@render children()}`-nel becsomagol) ugyanazt a vizuális
    eredményt adja route-struktúra érintése, és így egyetlen meglévő
    `resolve()` hívás módosítása nélkül. Mindkét route-fa megtartotta a
    saját `+layout.server.ts` jogosultság-ellenőrzését (admin: `(1,2)`,
    reports: `(1,2,3,4)`), csak a vizuális héjat osztják meg.
- **`/host/[game_id]`** (`src/routes/host/[game_id]/+layout.svelte`):
  minimális header — este címe, PIN-jelvény, kör/kérdés progress
  (`3. kör / N · Kérdés 4/8`, csak aktív játéknál), kapcsolat-állapot
  jelző (`connected`/`reconnecting`/`disconnected` — színes pötty +
  felirat), "Kilépés" link az admin este-oldalára. A `game`/`rounds`/
  `designThemes` betöltés a Fázis 4-ben a `+page.server.ts`-ben élt,
  Fázis F-ben átkerült a `+layout.server.ts`-be, mert a header
  ugyanezekre az adatokra támaszkodik (elkerülve a duplikált lekérdezést).
  A kör/kérdés progress és a kapcsolat-állapot viszont a page komponens
  saját, kliens-oldali állapota (`roundQuestions`, a channel
  `subscribe()` callback-je) — ezeket Svelte context hidalja át a page →
  layout irányba (`src/lib/realtime/connection-status.svelte.ts`,
  `src/lib/realtime/host-progress.svelte.ts`).
- **`/play/[pin]`**: **szándékosan nincs külön layout héj.** A terv
  "NINCS header, vagy csak egy vékony csík" opciói közül az utóbbit már
  eleve megvalósítja a meglévő, oldal-tetején lévő `<h1>{gameTitle}</h1>`
  — egy újabb layout-fájl bevezetése csak duplikálná ezt, funkcionális
  nyereség nélkül.
- **`/tv/[game_id]`**: **szándékosan nincs semmilyen header/chrome** — ez
  már eleve teljesen immerzív, a terv előírása szerint.

## Töréspontok és reszponzív konvenciók (Fázis G)

Egyetlen számszerű töréspont van jelenleg a kódban: az admin sidebar
`768px`-nél csukódik hamburger-menübe. A többi felület nem egyedi
töréspontokkal, hanem folyékony (fluid) technikákkal reszponzív:

- **`/play/[pin]`**: mobile-first, `max-width: 24rem`-es (384px) központi
  oszlop — ez eleve tisztán elfér 360px-es viewport-on is (a legkisebb
  elterjedt telefon-szélesség), nincs szüksége külön töréspontra. Minden
  interaktív elem (`ChoiceButton`, gombok, csúszka, sorrendező lista
  elemei) explicit `min-height: 44px`-et kap az érintési célpont-méret
  miatt; a csúszka `<input type="range">` thumb-ja is felnagyítva
  (`::-webkit-slider-thumb`/`::-moz-range-thumb`, 28px). A kérdés-prompt
  `clamp(1.1rem, 5vw, 1.5rem)`-mel skálázódik a szűkebb/tágabb telefon-
  szélességek között.
- **`/host/[game_id]`**: tablet/desktop-célú (`max-width: 32rem`-es
  központi oszlop a törzsben), de mivel nincs fix pixel-szélesség sehol,
  triviálisan nem törik el kisebb laptop-képernyőn sem. A header
  (Fázis F) `flex-wrap: wrap`-pel véd a keskenyebb ablakok ellen.
- **`/admin`**: desktop-first (adatbeviteli munka) — a sidebar `≤768px`-nél
  hamburger-menübe csukódik, háttér-elsötétítéssel (`.backdrop`) és
  automatikus záródással navigációkor (mindkettő Fázis G-ben pótolva).
- **`/tv/[game_id]`**: nagy kijelzőre optimalizált, `clamp()`-alapú fluid
  tipográfia (pl. a kérdés-prompt `clamp(1.5rem, 6vw, 4.5rem)`) — Fázis
  G-ben megemelve a korábbi, kisebb felső határokról, hogy 1920×1080-as
  kivetítőn, kb. 3-5 méteres távolságból is jól olvasható legyen.

**Módszertani megjegyzés:** a sandbox HTTPS-blokkolása miatt (lásd
`docs/DECISIONS_LOG.md` korábbi fázisai) ez az audit kód-szintű —
típusellenőrzéssel és a CSS szabályok kézi átolvasásával történt, nem élő
böngészős méréssel különböző képernyőméreteken. A tényleges vizuális
eredményt a felhasználónak kell ellenőriznie éles böngészőben.

### Admin táblázatok mobilon (Fázis N3 kiegészítés)

Az élő teszt megerősítette a fenti módszertani megjegyzés kockázatát: a
`768px`-es sidebar-töréspont **nem volt elég** — az admin `<table>`-ök
(Kérdésbank, Felhasználók) 640px alatt vízszintesen töredeztek. Új,
második töréspont: `640px`-nél a `thead` eltűnik, a `<tr>` kártyává
alakul (`.arcade-panel`-hez hasonló, de egyszerűbb border/padding), a
`<td>`-k pedig `data-label` attribútumból generált `::before` címkével
flex-sorokká válnak. A Kvízesték lista ennél is egyszerűbben oldja meg
ugyanezt: eleve sosem volt `<table>`, hanem `ArcadePanel`-kártyák CSS
grid-je (`repeat(auto-fill, minmax(18rem, 1fr))`), ami natívan egyetlen
oszlopra esik keskeny nézetben — nem igényelt külön mobil-specifikus
szabályt.

### Sidebar belső görgetés (Fázis P1)

Élő tesztelésből jelzett konkrét hiba: az admin sidebar (`DashboardShell.svelte`)
`display: flex` flex-elemként viselkedett a `.admin-shell` konténerben, saját
magasság-korlát és görgetés nélkül — ha a tartalma (nav linkek + felhasználó
neve + "Kijelentkezés") magasabb volt a viewportnál, a sidebar alsó része
lecsúszott a látható területről, és csak a TELJES OLDAL görgetésével volt
elérhető (a `.admin-content` és a sidebar együtt görgetett). Javítás: a
`.sidebar` desktop-nézetben (`>768px`) `position: sticky; top: 0; height:
100dvh; overflow-y: auto;`-t kap — így a sidebar mindig a viewport-hoz
rögzítve marad, saját belső görgetéssel, függetlenül attól, hogy a
`.admin-content` mennyire hosszú, és a nav mindig elérhető marad görgetés
közben is. (A `≤768px`-es mobil hamburger-nézet ettől függetlenül, saját
`position: fixed` + `overflow-y: auto` szabályával változatlanul működött
már korábban is — csak a desktop sidebar hiányzott ez a védelem.)

Az ezzel egy menetben elvégzett ismételt reszponzív átvizsgálás (360/640/
1024/1920px, mind a négy felület) a fenti G/N3 fázisokban lefektetett
mintákat (fluid `clamp()` tipográfia, 44px érintési célpontok, `flex-wrap`
header, kártyás mobil-táblázatok) továbbra is helyesnek találta — nem
került elő újabb konkrét hiba a sidebaron kívül. Ugyanaz a módszertani
megkötés érvényes, mint Fázis G-ben: ez kód-szintű átolvasás, nem élő
böngészős mérés (lásd fent) — a tényleges vizuális megerősítés a
felhasználó böngészős smoke-tesztjének feladata.

## Komponens-konzisztencia audit (Fázis H)

Végigfutva minden felületen (`/admin/*`, `/host/[game_id]`, `/play`,
`/play/[pin]`, `/tv/[game_id]`, `/login`, `/`), a nyers HTML-elemeket
(`<input>`, `<select>`, `<textarea>`, `<button>`, natív `<ol>/<li>`
ranglisták, kézzel írt PIN/QR panel, kézzel írt csapatnév-jelvények)
lecseréltük a komponens-könyvtárra, és minden hardcode-olt hex-színt
`var(--token)`-re. Konkrét eredmények:

- Az admin CRUD oldalak mindegyike (`themes`, `questions` + `[id]` +
  `new`, `games` + `[id]`, `design-themes` + `[id]` + `new`) és a
  `QuestionForm.svelte` most `Input`/`Select`/`Checkbox`/`Textarea`/
  `Button`-t használ natív elemek helyett.
- Eközben előkerült egy Fázis F-es regresszió: az admin al-oldalak egy
  része saját `<main>`-t is tartalmazott, miután a Fázis F-es
  `/admin/+layout.svelte` már burkolta őket egy `<main
class="admin-content">`-ba — duplikált landmark. Mind a 10 érintett
  oldalról eltávolítva az oldal-szintű `<main>`-t, a layout-é maradt az
  egyetlen.
- `/host/[game_id]` (a lobby/kontroll nézet): `PinDisplay`, `TeamChip`,
  `PodiumCard`, `Select`, `Button` mindenhol a korábbi kézzel írt PIN-doboz,
  csapatnév-lista és ranglista-`<ol>` helyett.
- `/play/[pin]`: `TimerRing` a szöveges visszaszámláló helyett,
  `ChoiceButton` az egy-/több-választós opciógomboknál, `PodiumCard` mindkét
  ranglista-nézetnél (kör és végeredmény), `Input`/`Button` a csatlakozási
  űrlapnál. A csúszka (`<input type="range">`) szándékosan natív maradt.
  A sorrendező lista drag-and-drop-ja Fázis O3-ban `svelte-dnd-action`-re
  cserélve — lásd "Új függőség (Fázis O3)" alább.
- `/tv/[game_id]`: `PinDisplay` a lobby PIN/QR/join-URL blokknál,
  `TeamChip` a csatlakozott csapatok listájánál, `PodiumCard` mindkét
  ranglista-nézetnél, `TimerRing` a nagy kijelzős visszaszámlálónál
  (`size={200}`, mert TV-n a `TimerRing` alapértelmezett 120px túl kicsi
  lenne). A `PodiumCard` betűméretét egy lokális `:global(.podium-card)`
  felülírás emeli TV-nézethez illő méretre (`clamp(1.1rem, 3vw, 2.25rem)`).
- `/login`: `Input`×3 (`displayName`/`email`/`password`), `Button` a
  submit és a mód-váltó (bejelentkezés ⇄ regisztráció) linkeknél. Emellett
  a korábbi, redundáns `createSupabaseBrowserClient()` hívást lecseréltük
  a gyökér `+layout.ts` által már biztosított `data.supabase`-re — ez
  eddig az egyetlen oldal volt, ami nem ezt a mintát követte.
- `/`: `Button` a kijelentkezés gombnál.

A joker-gomb (`/play/[pin]`) megtartotta a saját színkombinációját — ezt egy
`.joker-wrap :global(.btn)` CSS felülírás adja a megosztott `Button` primary
variánsára, mert ez egyetlen, kifejezetten figyelemfelkeltő elem, nem ér
meg egy önálló `Button`-variánst. (A tényleges színpár — `--coin`/`--danger`
→ `--magenta`/`--violet` gradiens — Fázis N3-ban frissült, lásd a
Szín-szerepek táblázat "Fázis N3" jegyzetét.)

Minden fájl `npm run check` (0 hiba/figyelmeztetés) és `npm run lint` +
`npm run build` ellenőrzéssel lezárva. Élő böngészős vizuális
ellenőrzés — a sandbox HTTPS-blokkolása miatt — továbbra sem történt itt;
ez a felhasználó feladata.

### Új függőség (Fázis O3)

`svelte-dnd-action` — a sorrendbe állítás (`ordering`) kérdéstípus
drag-and-drop-ja korábban natív HTML5 `draggable`/`dragstart`/`drop`
eseményekkel volt megoldva, ami **kizárólag desktop egérrel működik** —
touch-eszközön (a csapatok kivétel nélkül telefonon játszanak) a
`dragstart` esemény sosem tüzelt el, tehát élesben a sorrendezés
gyakorlatilag használhatatlan volt mobilon. A `svelte-dnd-action`
pointer-eseményeket használ belül, ami touch-on is helyesen viselkedik,
és a Svelte 5 peer dependency-t is támogatja (`^5.0.0-next.0`). A
billentyűzetes nyíl fel/le sorrendezés (akadálymentességi okból, a
könyvtár ezt nem adja natívan) megmaradt kiegészítő útvonalként.

## Kontraszt és fókusz-konvenciók (Fázis J)

**Módszertani megjegyzés — ez a fázis részben mégis élő böngészős volt.**
A `docs/design/STYLE_GUIDE.html` egy önálló statikus HTML fájl, nincs
Supabase-függősége — ezért (a korábbi fázisoktól eltérően, ahol a
Supabase-hívások miatt csak kód-szintű ellenőrzés volt lehetséges) ez
tényleges Chromiumban (Playwright, előre telepítve a sandboxban) futó
`axe-core` (4.13) ellenőrzés volt a stíluskönyvtár összes komponens-demóján.
A valódi `games`/`questions` adatot igénylő oldalak (`/host`, `/play/[pin]`,
`/tv`, `/admin/*`) továbbra sem tesztelhetők élőben itt.

**WCAG AA kontraszt-eredmény:** minden szín-szerep pár (`--marquee`,
`--marquee-dim`, `--cyan`, `--coin`, `--power`, `--danger`, `--magenta` a
`--cabinet`/`--cabinet-2`/`--cabinet-3` hátterek felett) megfelel a 4.5:1
küszöbnek — **egy kivétellel**: a `Button.svelte` `.primary` variánsa
(`--marquee` szöveg natúr `--violet` háttéren) csak 3.5:1-et adott, a
hover-állapota (natúr `--magenta`) 2.9:1-et, a `.danger` hover-állapota
(natúr `--danger`) 2.8:1-et — mindhárom a review által előre jelzett
kockázat konkrét beigazolódása. Javítás: a token maga (`--violet`,
`--magenta`, `--danger`) **változatlan maradt** (border/glow
felhasználásoknál a fényesebb szín jobban néz ki, és ott nincs
kontraszt-követelmény) — helyette a Button.svelte a kitöltés-színt
`color-mix(in srgb, var(--token) 65-80%, var(--cabinet[-2]))`-vel
sötétíti, kontextus-specifikusan. Az axe-core futás megerősítette: 1
violation → 0 violation a javítás után.

**Fókusz-állapot:** a könyvtár komponensei (`Button`, `ChoiceButton`,
`Checkbox`) explicit `outline: 3px solid var(--cyan)` `:focus-visible`
stílust kapnak a Fázis F0 óta; az `Input`/`Select` a natív outline-t
`border-color: var(--cyan)`-ra cseréli. Fázis J-ben ugyanezt pótoltuk a
könyvtáron kívül maradt natív elemeknél is: a `QuestionForm.svelte`
`question_type_id` `<select>`-je és a `true_false` rádiógombjai, illetve a
`/play/[pin]` csúszkája (`input[type='range']`) és a sorrendező lista
elemei (`<li>`) mind kaptak explicit `--cyan` `:focus-visible` gyűrűt.

**Sorrendező lista — billentyűzet-hozzáférés:** a drag-and-drop-only
sorrendező lista eddig **egyáltalán nem volt billentyűzettel elérhető**
(nincs `tabindex`, nincs keyboard handler) — ez egy teljes kérdés-típust
tett használhatatlanná képernyőolvasó/billentyűzet-only felhasználóknak.
Pótolva: `tabindex="0"` + `↑`/`↓` nyíl-kezelő minden `<li>`-n (a meglévő
`reorder(from, to)` függvényt hívja), `role="listbox"`/`role="option"` a
natív `<ol>`/`<li>` interaktívvá tételéhez (a Svelte a11y linter enélkül
hibát dobott — natúr `<li>`-re nem tehető keyboard handler), és egy
`aria-label`, ami a pozíciót és a kezelést is elmondja. A Svelte keyed
`{#each ... (item.id)}` blokk miatt a DOM-elem megmarad átrendezéskor,
tehát a fókusz természetesen követi a mozgatott elemet.

**Érintési célpontok:** a `/play/[pin]` végigellenőrizve — közben előkerült,
hogy a megosztott `Button.svelte` **soha nem kapott** `min-height: 44px`-et
(ez a Fázis G-ben a régi, natúr `<button>`-ökön explicit be volt állítva,
de amikor Fázis H-ban lecserélték őket a `Button` komponensre, ez a szabály
elveszett, és senki nem vette észre, mert vizuálisan a padding elég közel
volt hozzá). Pótolva: `min-height`/`min-width: 44px` a `.btn`-en — ez minden
felületet érint, ahol `Button`-t használnak. A csúszka thumb-ja
`28px`→`44px` (a Fázis G-ben csak részlegesen lett felnagyítva).

Dokumentáció-frissítés minden érintett helyen: `docs/design/STYLE_GUIDE.html`
(`.btn.primary` háttér + `min-height`/`min-width` a mirror CSS-ben is).
