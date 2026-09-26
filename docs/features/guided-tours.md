# Oldalankénti bemutatók és Próbaeste

## Cél

A projekt átadásakor a kezelők (admin, kvízmester) önállóan meg tudják
tanulni a felületet: minden fontos oldalnak saját, lépésről lépésre
végigkattintható bemutatója van, és egy Próbaestén élesben, kockázat nélkül
kipróbálhatják az élő lebonyolítást.

## Döntések

- **Csak gombra indul** („Bemutató ▶”), semmi nem indul el magától, a
  bejelentkezést sem követjük.
- **„Megnézte” jelzés böngészőnként** (`localStorage`,
  `equacards:tour-seen:<id>`): amíg egy oldal bemutatóját nem nézték végig
  vagy nem zárták be, rózsaszín pont villog a gombon. Másik gépen/böngészőben
  újra jelez — szándékosan, adatbázis nélkül.
- **Könyvtár: `driver.js`** (MIT, kicsi, keretrendszer-független,
  billentyűzettel is vezérelhető) — nem saját megoldás.

## Felépítés

- `src/lib/tours/tours.ts` — az összes bemutató szövege, oldalanként. Egy
  lépés `element` mezője egy `data-tour="…"` jelölésű elemre mutat; ha nincs
  megadva, a buborék a képernyő közepén jelenik meg.
- `src/lib/tours/state.svelte.ts` — az oldal-komponens a
  `registerPageTour(() => 'azonosító')` hívással jelenti be a saját
  bemutatóját; a host oldal a játék állapotától függően
  (`host-lobby` / `host-live`).
- `src/lib/tours/run.ts` — elindítja a bemutatót; a futás pillanatában nem
  látható elemekhez tartozó lépéseket kihagyja (üres kör, mobilon elrejtett
  oldalsáv, épp nem futó visszaszámlálás), így a „3 / 7” számláló pontos.
- `src/lib/components/TourButton.svelte` — a gomb és a driver.js buborék
  letisztult kezelői stílusa (2026-09-26 óta; korábban Retro Arcade).

**Új lépés hozzáadása:** tegyél egy `data-tour="valami"` attribútumot a
kiemelendő natív elemre (komponens köré egy `<div>`/`<span>` kell, mert a
komponensek nem adják tovább az attribútumot), és vegyél fel egy lépést a
`tours.ts` megfelelő bemutatójába. Listában csak az első elemet jelöld
(`data-tour={i === 0 ? '…' : undefined}`).

## Bemutatók

| Azonosító             | Oldal                               | Lépések |
| --------------------- | ----------------------------------- | ------- |
| `dashboard`           | `/admin` — Első lépések, a menü     | 11      |
| `themes`              | `/admin/themes`                     | 3       |
| `questions`           | `/admin/questions`                  | 5       |
| `question-form`       | `/admin/questions/new`, `/[id]`     | 9       |
| `games`               | `/admin/games` (Próbaeste gombbal)  | 5       |
| `game-setup`          | `/admin/games/[id]`                 | 10      |
| `game-event`          | `/admin/games/[id]/event`           | 6       |
| `venues`              | `/admin/venues`                     | 2       |
| `host-lobby`          | `/host/[game_id]`, várakozás        | 8       |
| `host-live`           | `/host/[game_id]`, élő játék        | 7       |
| `results`             | `/admin/games/[id]/results`         | 4       |
| `design-themes`       | `/admin/design-themes`              | 4       |
| `design-theme-editor` | `/admin/design-themes/new`, `/[id]` | 4       |
| `users`               | `/admin/users`                      | 2       |
| `settings`            | `/admin/settings`                   | 3       |
| `reports`             | `/reports`                          | 2       |
| `report-detail`       | `/reports/[game_id]`                | 1       |

A csapatok telefonos felülete (`/play`) és a kivetítő (`/tv`) nem kap
bemutatót: nem kezelői oldalak, a host bemutatója egy-egy mondatban kitér
rájuk.

## Próbaeste

A Kvízesték oldalon a „Próbaeste létrehozása” gomb (`?/createPractice`,
`src/lib/server/games.ts`) létrehoz egy gyakorló estét 2 körrel:

- **Bemelegítő:** feleletválasztós, igaz/hamis, több helyes válaszos kérdés.
- **Képek és számok:** pixeles felfedésű zászlós kérdés, csúszka, sorrend.

A mintakérdések egy saját témába („Próbaeste – mintakérdések”) kerülnek,
és csak az első alkalommal jönnek létre; a további próbaesték ugyanezeket
használják. Így a gyakorlás nem érinti a valódi kérdések random-húzási
türelmi idejét. A próbaeste `games.is_practice = true`, ezért a riportok
(`reports_*` függvények, `supabase/migrations/20260925170000_games_is_practice.sql`)
kiszűrik; a Kvízesték listában „Próba” jelvény jelöli.
