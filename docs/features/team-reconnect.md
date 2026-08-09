# Csapat újracsatlakozás és állapot-mentés (Fázis P4)

## Alapelv

A `device_token`/`localStorage` (`equacards:team:{pin}` kulcs alatt tárolt
`{teamId, teamName, gameId}` — lásd `docs/architecture/DATA_MODEL.md` 4.
szakasz) **kizárólag azonosításra szolgál** — melyik csapat ez. A tényleges
játékállapot (aktuális kérdés, beküldött-e már választ, feltárult-e már a
megoldás) **mindig a szerverről, élőben töltődik vissza**, sosem a
localStorage-ból rekonstruálva. Ez azért kritikus, mert ha a szerver
időközben továbblépett (a host új kérdést indított, lezárt vagy feltárt,
amíg a csapat le volt szakadva), egy helyi cache-elt állapot elavult, félrevezető
UI-t mutatna.

## Miért nem lehetett eddig ez a helyzet egyszerűen megoldható

A `/play/[pin]` kizárólag a `timer_start`/`question_show`/`answer_locked`/
`question_reveal` broadcast-eseményekből építette fel az állapotát. Egy
oldal-újratöltés után a kliens nem tudta ezt visszaolvasni, mert az `anon`
szerepkörnek **szándékosan nincs SELECT policy-ja** sem a kérdésbank
táblákon (`questions`, `question_choice_options`, `question_slider_config`,
`question_ordering_items` — nehogy egy csapat előre lekérdezhesse a
kérdésbankot), sem az `answers` táblán (senki se lásson mást, csak a saját
válaszát — `docs/architecture/DATA_MODEL.md` 5. szakasz tervezési elve).

## `current_question_state(p_game_id)` RPC

Új, `security definer` SQL-függvény
(`supabase/migrations/20260809150000_current_question_state_rpc.sql`,
kiegészítve: `20260809150500_current_question_state_reveal.sql`), `anon`-nak
is futtatható. A `games.current_question_id`-hez tartozó, **már élőben
kiküldött** kérdés adatait adja vissza JSON-ban — pontosan ugyanazt a
formát/tartalmat, mint a `question_show` broadcast payload-ja (`options`
csak `id`+`option_text`, **nincs benne `is_correct`**; `ordering_items` a
helyes sorrend elárulása nélkül). Ez nem szivárogtat semmit, amit egy
folyamatosan csatlakozva maradt csapat ne kapna meg amúgy is a
broadcast-on keresztül — csak a games sor `current_question_id`-jét oldja
fel, sosem egy tetszőleges/jövőbeli kérdést.

Emellett visszaadja:

- `server_start_time` / `duration` (`games.current_question_started_at`/
  `current_question_duration_seconds`, Fázis L timer-kikényszerítés) — a
  kliens ugyanazzal a mintával számolja a hátralévő időt, mint a
  `timer_start` broadcast fogadásakor (lásd `docs/features/timer.md`).
- `revealed` (boolean) — igaz, ha **legalább egy** `answers` sor
  `is_correct`-ja nem null erre a kérdésre. Az `evaluate_question()`
  (Fázis 5) egy tranzakcióban, egyetlen menetben tölti ki az ÖSSZES adott
  kérdéshez tartozó `answers.is_correct`-ot, tehát ez megbízható jelzés
  arra, hogy a host már feltárta a megoldást — anélkül, hogy bármelyik
  csapat saját válaszát kellene közvetlenül olvasni.
- `correct_answer` — csak akkor töltött ki, ha `revealed = true` (ugyanaz a
  formázás, mint a host `revealAnswer()`-jében: vesszővel felsorolt helyes
  opciók / szám / nyilas sorrend).

## Kliens-oldali visszaállítás (`restoreLiveState()`, `/play/[pin]/+page.svelte`)

A csapat-azonosító (`joined`) `$effect`-je — ami eddig csak a Realtime
csatornát iratkoztatta fel a JÖVŐBELI eseményekre — mostantól elsőként
meghívja a `restoreLiveState()`-et, ami:

1. Lekéri a `current_question_state`-et. Ha nincs aktív kérdés
   (`question_id: null`), a UI a normál "Várj, amíg a kvízmester
   elindítja a játékot…" lobby-állapotot mutatja.
2. Ha van aktív kérdés, felépíti a `currentQuestion`-t (ugyanolyan alakban,
   mint egy élő `question_show` broadcast), és beállítja a `timerInfo`-t —
   a meglévő, `server_start_time`-alapú `$effect` (Fázis P2) ebből
   automatikusan kiszámolja a helyes hátralévő időt, és `locked`-ra
   állítja magát, ha az már lejárt.
3. Meghívja a `team_answer_result(teamId, questionId)` RPC-t (Fázis 5,
   már létező) — ha van sor, a csapat már beküldött (`submitted = true`),
   függetlenül attól, hogy kiértékelték-e már.
4. Ha `revealed = true`: beállítja a `revealInfo`-t és a `myResult`-ot
   (a `team_answer_result` sorából — ha a csapat nem küldött választ,
   `myResult` üres marad, a UI a meglévő "Nem küldtél választ időben."
   ágat mutatja).
5. `ordering` típusnál a visszakapott elemeket a kliens **helyben
   megkeveri** (ugyanúgy, mint a host a `question_show` broadcast előtt) —
   a szerver szándékosan nem ad vissza konkrét megjelenítési sorrendet
   (a helyes sorrend `correct_position`-je nem szerepel a válaszban), így
   egy visszacsatlakozó csapat kezdő sorrendje nem feltétlenül egyezik a
   folyamatosan csatlakozva maradt csapatokéval — ez nem befolyásolja a
   pontozás korrektségét (a beküldött végső elem-pozíciók számítanak, nem
   a kezdő elrendezés).

## Érvénytelen/lejárt csatlakozás kezelése

Ha a `joined.gameId`-hez tartozó `games` sor lekérdezése nem talál sort
(törölt game, vagy egy régi, hibás localStorage bejegyzés), a kliens
törli a `localStorage`-t, `joined = null`-ra állítja, és a PIN-csatlakozási
képernyőre irányítja a csapatot egy "A csatlakozásod lejárt, csatlakozz
újra." üzenettel — nem marad egy törött, félig-csatlakozott állapotban.

## Vizuális visszajelzés kapcsolat-vesztéskor

A `ReconnectOverlay` komponens (Fázis I-ben épült) már korábban is
lefedte ezt: `{#if joined && connectionStatus !== 'connected'}` egy
"Kapcsolat helyreállítása…" felülréteget mutat, amíg a Supabase Realtime
csatorna `reconnecting`/`disconnected` állapotban van. Ez a fázis nem
módosított ezen — csak azt biztosítja, hogy a kapcsolat helyreállása UTÁN
a mögötte lévő UI-állapot is a valósággal szinkronban legyen (ne csak a
csatorna, hanem az általa vezérelt kérdés/válasz-állapot is).

## Szándékosan kihagyott elem: opcionális localStorage UX-gyorsítás

A tervdokumentum (P4, 4. pont) egy opcionális, "utolsó ismert állapot"
pillanatkép localStorage-beli tárolását is felvetette, amit a szerver-
válasz megérkezése ELŐTT azonnal meg lehetne jeleníteni (hogy ne
üres/loading képernyőt lásson a csapat az első pillanatban), majd a
szerver-válasz mindig felülírná. Ez a fázis **tudatosan nem építette be**:
a meglévő "Várj, amíg a kvízmester elindítja a játékot…" lobby-szöveg már
eleve nem üres/törött képernyő, tehát a `restoreLiveState()` async
lekérdezése alatti pillanat is értelmes állapotot mutat — egy második,
gyorsítás-célú cache-réteg hozzáadása a tervdokumentum saját szavai
szerint is csak "opcionális", nem forrás-értékű UX-finomítás lett volna,
ami extra komplexitást (két állapot-forrás szinkronban tartása) vezetett
volna be egy MVP méretű, baráti körben futó kvízeste éles kockázatához
képest aránytalanul. Ha a felhasználó élő teszteléskor mégis érezhető
villanást/üres pillanatot tapasztal, ez egy jövőbeli, önálló finomítás
lehet.

## Ismert korlát

Van egy szűk, elméleti versenyhelyzet: a `restoreLiveState()` aszinkron
lekérdezése és a Realtime csatorna feliratkozása közötti pillanatban, ha
a host pont akkor lép tovább (pl. `question_reveal`-t küld), a
korábban indított `restoreLiveState()` válasza — amikor megérkezik —
elméletileg felülírhatná a közben már megérkezett, frissebb broadcast
állapotot egy régebbivel. Ez rendkívül szűk időablak (tipikusan
milliszekundumok), és a KÖVETKEZŐ broadcast esemény (ami úgyis megérkezik,
hiszen a csatorna folyamatosan figyel) automatikusan korrigálja — nem
jelent tartós hibás állapotot vagy pontozási problémát (a szerver-oldali
`answer_within_timer()` RLS-ellenőrzés, Fázis L, továbbra is az egyetlen
tényleges forrás a beküldés érvényességére).
