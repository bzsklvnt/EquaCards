# Játékélmény polírozás (Fázis I)

## Cél

A Fázis 6-ban bevezetett átmenetek/animációk soha nem futottak valós
böngészőben (a sandbox HTTPS-blokkolása miatt — lásd
`docs/DECISIONS_LOG.md`), és a review 2. szakasza explicit hiányként
említette a hiányzó üres/hiba/betöltés-állapotokat. Ez a dokumentum az
ennek nyomán hozzáadott/finomított állapotokat és animációkat írja le.

## 1. Kérdés-váltás és reveal átmenetek

Ellenőrizve mindhárom élő felületen (`/host/[game_id]`, `/play/[pin]`,
`/tv/[game_id]`) — a `question_show`/`question_reveal` eseményekre már a
Fázis 6/H során felkerült a `fade`/`fly` Svelte transition mindhárom
helyen (kérdés-prompt `in:fly`, reveal-panel és ranglista `in:fade`,
ranglista-sorok `in:fly` staggerelt késleltetéssel). Fázis I-ben ezt csak
ellenőriztük és kódszinten átolvastuk — nem volt szükség változtatásra.

## 2. Ünneplő animáció (`canvas-confetti`)

Új modul: `src/lib/effects/confetti.ts` — a `canvas-confetti` csomagot
csomagolja egyetlen `fireWinnerConfetti()` függvénybe (két burst,
`{ y: 0.6 }` origóval). SSR-biztos (`typeof window === 'undefined'` őr),
mert a `/tv/[game_id]` és `/play/[pin]` is szerver-oldalon render-elődik
először.

Bekötve a `round_leaderboard_reveal`/`final_leaderboard_reveal`
broadcast-kezelőkbe, de **eltérő feltétellel** a két felületen:

- **`/tv/[game_id]`**: mindig elsül — ez a közös, publikus kijelző, a
  helyezéstől függetlenül mindenki ugyanazt nézi, tehát nincs
  "saját csapat" fogalom.
- **`/play/[pin]`**: csak akkor sül el, ha a **saját** csapat került az
  1. helyre (`top3[0].team_id === teamId` / `standings[0].team_id ===
teamId`) — pontosan a terv előírása szerint ("csak az 1. helyre kerülő
     csapatnál süljön el").

A `/host/[game_id]` kontroll-felület szándékosan nem kapott konfettit —
az a kvízmester munkaeszköze, nem a közönség/csapatok élménye.

## 3. Újracsatlakozás állapot

Új megosztott komponens: `src/lib/components/ReconnectOverlay.svelte` —
teljes képernyős, félig áttetsző overlay "Kapcsolat helyreállítása…"
szöveggel és egy `TimerRing` inaktív variánsával. Azért lett közös
komponens (nem csak `/play`-be vagy csak `/tv`-be írt egyedi kód), mert
mindkét felületen szó szerint ugyanaz a minta kellett — ez a "csak akkor
absztrahálunk, ha egy minta ténylegesen ismétlődik" elv konkrét pozitív
esete (lásd `docs/architecture/DESIGN_SYSTEM.md`).

`TimerRing.svelte` kapott egy új `inactive` propot: ilyenkor a számláló
szöveg eltűnik, a progress-kör szürkére (`--marquee-dim`) vált, és az SVG
egy végtelen `spin` animációval forog — ez adja a "dolgozik a
háttérben" vizuális jelzést, mivel újracsatlakozás közben nincs
értelmezhető hátralévő idő.

Mindkét felület (`/play/[pin]`, `/tv/[game_id]`) helyi `connectionStatus`
állapotot tart (`'connected' | 'reconnecting' | 'disconnected'`), a
Supabase Realtime channel `subscribe()` callback-jéből frissítve —
ugyanaz a minta, mint amit a `/host/[game_id]` már a Fázis F-ben
bevezetett `ConnectionStatusStore`-ja csinál a header jelzőjéhez, csak itt
nincs megosztott header, tehát nem context-en, hanem helyi `$state`-en
keresztül. Az overlay a `joined`/csatlakozott állapotnál jelenik meg
(`/play`), illetve mindig (`/tv`, ahol nincs "csatlakozás előtti" fázis).

## 4. Üres állapotok

- **Kérdésbank szűrő 0 találattal** (`/admin/questions`): a témaszűrő
  aktív, de nincs találat esetén "Nincs kérdés ebben a témában." +
  "Szűrő törlése" link — megkülönböztetve az általános "Még nincs
  kérdés." üzenettől (ami akkor jelenik meg, ha szűrő nélkül is üres a
  kérdésbank).
- **Lobby 0 csatlakozott csapattal** (`/host/[game_id]`): ez már a
  korábbi fázisokban megvolt ("Még senki sem csatlakozott.") — Fázis
  I-ben csak ellenőrizve, nem kellett hozzányúlni.
- **Riport oldal 0 lezárt estével**: **elhalasztva Fázis D-re.** A
  `/reports` oldal jelenleg egy szándékos placeholder (a tényleges
  lezárt-esték-listázás Fázis D feladata) — egy "0 találat" üres
  állapotot építeni egy még nem létező lista fölé értelmetlen munka
  lenne, ezt a valódi riport-implementáció részeként kell megépíteni.

## 5. Betöltés-állapotok

Két konkrét "villanás" (flash of unstyled content) esetet azonosítottunk
és javítottunk:

- **Vizuális köntös (theme) villanása minden felületen**: mind a 8
  helyen, ahol `themeCss` állapot létezik (`/`, `/login`, `/play`,
  `/play/[pin]`, `/host/[game_id]`, `/tv/[game_id]`, `/admin`
  (layout), `/reports`), a kezdőérték üres string (`''`) volt — ez azt
  jelentette, hogy az első render (amíg az async `getActiveTokens()`
  Supabase-hívás nem tér vissza) stílus nélküli, natív böngésző-alap
  színekkel jelent meg. Javítás: a kezdőérték most
  `tokensToCssText(defaultTokens)` — a `src/lib/theme/tokens.ts`-ben már
  létező, a seed-del megegyező hardcode-olt biztonsági háló —, tehát az
  első render már a helyes (alapértelmezett "Retro Arcade") színekkel
  történik, és csak akkor változik láthatóan, ha az adott `games` sorhoz
  ténylegesen egy **egyedi** (nem alapértelmezett) vizuális köntös van
  rendelve.
- **Host: kérdéslista betöltése** (`/host/[game_id]`): a `roundQuestions`
  a `onMount`-ban aszinkron töltődik be (illetve minden kör-váltáskor
  újra) — eddig ez alatt egy pillanatra "Kérdés 1 / 0" jellegű, hibásnak
  ható szöveg villant fel. Új ág: amíg `roundQuestions.length === 0` és
  `game.status === 'active'`, "Kérdések betöltése…" jelenik meg helyette.

## Módszertani megjegyzés

A sandbox HTTPS-blokkolása miatt (lásd `docs/DECISIONS_LOG.md` korábbi
fázisai) ez a fázis is kód-szintű maradt — `npm run check`/`lint`/`build`
ellenőrzéssel, élő böngészős vizuális/audio teszt nélkül. A konfetti, a
reconnect-overlay tényleges vizuális megjelenése és a színek villanásának
tényleges eltűnése a felhasználó éles böngészős ellenőrzésére vár.
