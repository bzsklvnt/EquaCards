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
| `--magenta`                                 | Joker, elsődleges gomb hover-állapota                                   |
| `--violet`                                  | Gomb-kitöltés (elsődleges gomb alapállapota)                            |
| `--cabinet` / `--cabinet-2` / `--cabinet-3` | Háttér-gradiens (sötéttől világosabb felé)                              |
| `--marquee`                                 | Elsődleges szöveg                                                       |
| `--marquee-dim`                             | Másodlagos szöveg, placeholder, inaktív elem                            |

**Szabály:** ne keveredjenek a szerepek — pl. `--danger` sose dekoratív
elem, csak hiba/sürgetés jelzésére. Ha egy komponensnek új szín-szerep
kellene, bővítsd ezt a táblázatot és a `design_themes` seedet együtt, ne
vezess be ad-hoc hex-kódot.

## Tipográfia

| Token            | Betűtípus      | Használat                                            |
| ---------------- | -------------- | ---------------------------------------------------- |
| `--font-display` | Press Start 2P | **Rövid** címek/kérdések — sose hosszú próza         |
| `--font-led`     | Silkscreen     | Minden szám-jellegű kijelzés: timer, pontszám, PIN   |
| `--font-body`    | Inter          | Minden más: gombszöveg, leírások, form mezők, listák |

## Arcade panel

A kártyaszerű felületek (kérdés-kártya, ranglista-kártya, PIN/QR panel)
alap mintája: `var(--cabinet-2)` háttér, `2px solid var(--violet)` keret,
`1rem` lekerekítés, finom scanline textúra (`repeating-linear-gradient`
vízszintes csíkokkal, ~3.5% opacitású fehér). Lásd
`docs/design/STYLE_GUIDE.html` "Arcade panel" szakasza az élő példáért.

## Komponens-könyvtár (`src/lib/components/`)

| Komponens             | Props                                                                                                                                  | Jegyzet                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `Button.svelte`       | `variant` (`primary`\|`secondary`\|`danger`\|`ghost`), `type`, `disabled`, `href`, `onclick`, `children`                               | `href` esetén `<a>`-ként renderel, egyébként `<button>`-ként            |
| `ChoiceButton.svelte` | `text`, `selected`, `disabled`, `onclick`                                                                                              | Egy/több-választós válasz-opció                                         |
| `TimerRing.svelte`    | `secondsLeft`, `duration`, `size`                                                                                                      | SVG körvisszaszámláló, `low` állapot (≤5 mp) pulzáló `--danger`-re vált |
| `PinDisplay.svelte`   | `pin`, `qrDataUrl`, `joinUrl`                                                                                                          | PIN + QR + csatlakozási URL egy arcade panelben                         |
| `TeamChip.svelte`     | `name`, `own`                                                                                                                          | Csapatnév pill-jelvény, `own` kiemeli a sajátot                         |
| `PodiumCard.svelte`   | `rank`, `name`, `score`, `scoreLabel`, `own`                                                                                           | Ranglista-sor, top 3-nál érem-emoji                                     |
| `Input.svelte`        | `label`, `name`, `type`, `value` (bindable), `placeholder`, `required`, `maxlength`, `minlength`, `min`, `max`, `step`, `autocomplete` | Label + input, min. 44px magasság érintéshez                            |
| `Select.svelte`       | `label`, `name`, `value` (bindable), `required`, `children`, `onchange`                                                                | Label + select, `children` az `<option>` elemekhez                      |
| `Checkbox.svelte`     | `label`, `name`, `checked` (bindable), `value`, `onchange`                                                                             | Label + checkbox, `accent-color: var(--cyan)`                           |
| `Textarea.svelte`     | `label`, `name`, `value` (bindable), `placeholder`, `required`, `rows`, `spellcheck`, `monospace`                                      | `monospace` a `--font-led`-et alkalmazza (pl. JSON-szerkesztőknél)      |

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

## Fókusz és akadálymentesség

Minden interaktív komponens explicit `:focus-visible` stílust kap
(`outline: 3px solid var(--cyan)`), mert a sötét, neon-akcentú design
könnyen "eltünteti" a böngésző alapértelmezett fókusz-gyűrűjét. Az érintési
célpontok (gombok, checkbox, input) minimum 44×44px-esek.

## Layout héjak felületenként (Fázis F)

A `docs/architecture/DATA_MODEL.md` 7. szakaszának négy felülete eltérő
célra szabott layout-keretet kap:

- **`/admin`** (`src/routes/admin/+layout.svelte`): perzisztens header +
  bal oldali sidebar navigáció (Kérdésbank, Témák, Vizuális témák,
  Kvízesték, mindig; Felhasználók/Beállítások csak `role_id = 1`-nek;
  Riportok mindenkinek). A még meg nem épült oldalakra (Felhasználók,
  Beállítások, Riportok) is mutat — placeholder oldal, nem törött link
  (a tényleges megvalósítás: Fázis B/C/D). Mobilon (`≤768px`) a sidebar
  hamburger-menübe csukódik. Az admin felület is a
  `getActiveTokens(supabase, null)` alapértelmezett vizuális témát kapja
  (nincs `games` sorhoz kötve, mint a host/csapat/TV).
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
  űrlapnál. A csúszka (`<input type="range">`) és a sorrendező lista
  (drag-and-drop `<li>`-k) szándékosan natív maradt — lásd fent.
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

A joker-gomb (`/play/[pin]`) megtartotta a saját, `--coin`/`--danger`
színkombinációját — ezt egy `.joker-wrap :global(.btn)` CSS felülírás adja
a megosztott `Button` primary variánsára, mert ez egyetlen, kifejezetten
figyelemfelkeltő elem, nem ér meg egy önálló `Button`-variánst.

Minden fájl `npm run check` (0 hiba/figyelmeztetés) és `npm run lint` +
`npm run build` ellenőrzéssel lezárva. Élő böngészős vizuális
ellenőrzés — a sandbox HTTPS-blokkolása miatt — továbbra sem történt itt;
ez a felhasználó feladata.
