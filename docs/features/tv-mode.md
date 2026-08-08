# TV / kivetítő felület

## Cél

A `docs/architecture/DATA_MODEL.md` 7. szakaszában tervezett `/tv/[game_id]`
route: csak megjelenítés, nincs rajta vezérlő elem — külön eszközön/
böngészőben nyitva (projector/TV-hez csatlakoztatva), miközben a host a
sajátján vezérel. Így nem történhet baleset, hogy a host véletlenül a helyes
választ vagy admin-nézetet vetíti ki a reveal előtt.

## Hozzáférés — nincs role-alapú route guard

A TV kliens **ugyanazt az anon hozzáférési szintet** használja, mint a
csapat kliens (`/play/[pin]`) — nincs saját táblája/oszlopa, a
`games_select_anon` RLS policy-ra támaszkodik a lobby-képernyő
PIN/cím betöltéséhez, utána tisztán broadcast-alapú. Szándékosan nincs
`role_id in (1,2,3)` route guard rajta (szemben a `/host`-tal): a
`/tv/[game_id]` URL-je a `games.id` UUID-t tartalmazza, ami gyakorlatilag
nem kitalálható, és a megjelenített adat (kérdés-promptok, helyes válaszok,
ranglisták) ugyanaz, amit a csapatok a saját telefonjukon amúgy is látnak —
nincs a TV-n keresztül elérhető extra, védendő adat. Ez ugyanaz a "de facto
tulajdonjog egy ismert UUID-n keresztül" biztonsági szint, amit a projekt a
`team_answer_result`/`team_joker_uses` RPC-knél is következetesen alkalmaz
(lásd `docs/features/scoring.md`, `docs/features/jokers.md`).

## Képernyők

Broadcast-vezérelt állapotgép, prioritási sorrendben (a legutóbb érkezett,
legmagasabb prioritású esemény dönt):

1. **`final_leaderboard_reveal`** — teljes végeredmény, animált belépéssel.
2. **`round_leaderboard_reveal`** — kör-specifikus top 3.
3. **`question_reveal`** — a helyes válasz szövege (nagy betűkkel, nincs
   pontszám — a TV nem "tartozik" egyik csapathoz sem).
4. **`question_show`** + **`timer_start`** — nagy betűs prompt + nagy
   visszaszámláló szám (nincs válasz-UI, a TV csak megjelenít).
5. **lobby** (`game.status === 'lobby'`, amíg `game_started` be nem érkezik)
   — PIN + QR nagy méretben, élő csatlakozott-csapat lista Presence-szel.
6. Egyéb (aktív játék, de még nincs kérdés kiválasztva — pl. kör váltás
   közben) — egyszerű "Készülj!" közbenső képernyő.

A `game_finished` broadcast egy záró "Köszönjük a játékot!" képernyőre vált.

## Presence

Ugyanazt a `game:{game_id}` csatornát és Presence szinkront használja, mint
a host lobby nézete (`docs/architecture/REALTIME_PROTOCOL.md`) — a TV egy
saját, véletlen presence-kulccsal csatlakozik, de **nem** hív `track()`-et
(nem jelenik meg csapatként), csak `sync` eseményre figyel a lobby-képernyő
élő csapatszámlálójához/névlistájához.

## Vizuális köntös, animáció, hang

Ugyanazt a token-feloldást használja, mint a host/csapat felület
(`docs/features/design-themes.md`) — a `games.design_theme_id` a TV oldal
`+page.server.ts` load-jából érkezik, a token-készlet a kliens
`onMount`-jában oldódik fel egyszer. **Ismert korlát:** ha a host a TV
megnyitása UTÁN vált design témát, a TV nem frissül élőben (nincs rá
`postgres_changes`/broadcast feliratkozás) — a gyakorlatban ez nem probléma,
mivel a host a témát a lobby fázisban, a TV megnyitása előtt választja.

Svelte beépített `fly`/`fade` átmenetek animálják a képernyőváltásokat és a
ranglista-sorok staggered belépését; a hangeffektek
(`src/lib/audio/sfx.ts`) ugyanazok a szintetizált Web Audio hangok, mint a
csapat felületen (tick az utolsó 5 másodpercben, búgás a lejáratkor, "ding"
a feltáráskor, fanfár a ranglistáknál) — indoklás a hang-választásra:
`docs/DECISIONS_LOG.md` Fázis 6 bejegyzése.

## Elérés a hosttól

A host lobby nézete (`/host/[game_id]`, `status === 'lobby'`) egy "Kivetítő
megnyitása (TV mód)" linket ad, ami új lapon nyitja meg a `/tv/[game_id]`
route-ot.
