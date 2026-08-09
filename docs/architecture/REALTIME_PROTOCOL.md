# Realtime Protocol

> **STATUS: IN PROGRESS.** Filled in incrementally as each phase introduces or
> changes broadcast events — see `docs/DOCUMENTATION_POLICY.md`.

## Channels

- `game:{game_id}` — Supabase Realtime channel (broadcast + presence) egy adott
  kvízeste minden résztvevője (csapatok, host) között. A csapat/host kliens a
  játszott/vezetett game_id-jával csatlakozik hozzá.

## Payload típusok

A broadcast payloadok TypeScript típusai egy helyen élnek:
`src/lib/realtime/protocol.ts` — host és csapat oldal egyaránt onnan
importálja őket, hogy a payload-alak ne duplikálódjon/csússzon szét.

## Events

| Esemény                    | Küldő       | Payload                                      | Fázis |
| -------------------------- | ----------- | -------------------------------------------- | ----- |
| `team_joined`              | csapat      | `{team_id, name}`                            | 3     |
| `game_started`             | host        | `{}`                                         | 4     |
| `question_show`            | host        | `QuestionShowPayload` (lásd lent)            | 4     |
| `timer_start`              | host        | `{question_id, duration, server_start_time}` | 4     |
| `joker_activate`           | csapat      | `{team_id, question_id, joker_type}`         | 4     |
| `answer_locked`            | host / auto | `{question_id}`                              | 4     |
| `question_reveal`          | host        | `QuestionRevealPayload` (lásd lent)          | 4     |
| `game_finished`            | host        | `{}`                                         | 4     |
| `round_leaderboard_reveal` | host        | `RoundLeaderboardRevealPayload` (lásd lent)  | 5     |
| `final_leaderboard_reveal` | host        | `FinalLeaderboardRevealPayload` (lásd lent)  | 5     |

### `team_joined` (Fázis 3)

- **Küldő:** csapat kliens (`/play/[pin]`), sikeres csatlakozás (a `teams`
  sor beszúrása) után.
- **Kliens teendő:** a Presence-szel már úgyis élőben szinkronban lévő
  listát nem ez frissíti (arra a Presence `sync` eseménye szolgál), ez egy
  kiegészítő, egyszeri "csatlakozott" jelzés (pl. jövőbeli fázisban
  toast/hangeffekt).

### `game_started` (Fázis 4)

- **Küldő:** host (`/host/[game_id]`), a "Kvíz indítása" gombra kattintva,
  miután a `games.status`-t `'active'`-re és a `current_round_id`-t az
  első körre állította.
- **Payload:** `{}`
- **Kliens teendő:** csapat oldal — jelenleg nincs külön kezelve (a
  csapat felület a `question_show` eseményre vált be az első kérdésnél,
  addig a "várj, amíg a kvízmester elindítja" szöveg látszik).

### `question_show` (Fázis 4)

- **Küldő:** host, "Következő kérdés" gomb.
- **Payload** (`QuestionShowPayload`):
  ```ts
  {
    question_id: string;
    question_type: string; // question_types.code
    round_title: string;
    prompt: string;
    image_url: string | null;
    time_limit_seconds: number;
    order_index: number;
    total_questions: number;
    options?: { id: string; option_text: string }[]; // single_choice | multi_choice | true_false
    slider?: { min_value: number; max_value: number; step: number };
    ordering_items?: { id: string; item_text: string }[]; // véletlenszerűen összekevert sorrendben
  }
  ```
  **FONTOS:** szándékosan nincs benne `is_correct` / `correct_value` /
  `correct_position` — ezek csak a `question_reveal`-ben jelennek meg. Az
  `ordering_items` sorrendjét a host kliense Fisher-Yates-sel megkeveri,
  mielőtt broadcastolja, hogy a `question_ordering_items` beszúrási sorrendje
  (ami történetesen egybeeshetne a helyes sorrenddel) sose szivárogjon ki.
- **Kliens teendő:** csapat — típusonkénti válasz-UI renderelése
  (`src/routes/play/[pin]/+page.svelte`): gombrács (`single_choice` /
  `multi_choice` / `true_false`), csúszka (`slider`), drag-and-drop lista
  (`ordering`). TV (Fázis 6, `/tv/[game_id]`) — nagy betűs prompt
  megjelenítése, válasz-UI nélkül (a TV csak megjelenít).

### `timer_start` (Fázis 4)

- **Küldő:** host, "Timer indítása" gomb.
- **Payload:** `{question_id, duration, server_start_time}`
- **Kliens teendő:** csapat — helyi visszaszámlálás a `server_start_time +
duration` alapján; ha lejár, a kliens **saját magát zárja le** (nem várja
  meg az `answer_locked` broadcastot — az csak a hoszt "zárás most" korai
  lezárására szolgál). TV — ugyanaz a helyi visszaszámlálás, nagy kijelzős
  számmal.
- **Fázis L:** a broadcast-tal egyidejűleg a host ugyanezt a
  `duration`/`server_start_time` párt a `games.current_question_duration_seconds`/
  `current_question_started_at` oszlopokba is beírja — ez a kliens-oldali
  önzárás mellett egy szerver-oldali (RLS-szintű) kikényszerítés alapja,
  hogy egy módosított kliens ne tudjon a lejárat után válaszolni. Részletek:
  `docs/features/timer.md`.
- **Sürgősségi javítás:** a `server_start_time` mostantól a
  `start_question_timer()` RPC-n keresztül a Postgres-szerver `now()`-ja
  (nem a host kliens saját órája), és minden felület a `serverNow()`
  segédfüggvénnyel (`src/lib/realtime/server-clock.ts`) kalibrált,
  eszköz-független órát használ a hátralévő idő számításához — lásd
  `docs/features/timer.md` "8. Sürgősségi javítás" szakasza.

### `joker_activate` (Fázis 4)

- **Küldő:** csapat kliens, "Duplázás" gomb.
- **Payload:** `{team_id, question_id, joker_type}`
- **Kliens teendő:** host — beírja a `team_joker_uses`-be. Részletek:
  `docs/features/jokers.md`.

### `answer_locked` (Fázis 4, automatikus trigger: Fázis P3)

- **Küldő:** host, "Zárás most" gomb (kézi, korai zárás), VAGY
  automatikusan (lásd "Automatikus lezárás és feltárás" lent).
- **Payload:** `{question_id}`
- **Kliens teendő:** csapat — input letiltása (ha még nem tiltotta le a
  saját helyi visszaszámlálása).

### `question_reveal` (Fázis 4, automatikus trigger: Fázis P3)

- **Küldő:** host, "Megoldás feltárása" gomb (kézi), VAGY automatikusan
  (lásd "Automatikus lezárás és feltárás" lent).
- **Payload** (`QuestionRevealPayload`):
  ```ts
  {
  	question_id: string;
  	correct_answer: string;
  }
  ```
  Egyetlen, előre formázott, emberi olvasásra kész string (pl.
  `"A, C"`, `"42"`, `"Elem1 → Elem2 → Elem3"`). **Szándékosan NINCS benne
  pontszám Fázis 5-ben sem** — ez a payload mindenkihez eljut ugyanazon a
  csatornán, a csapatok pontja viszont csak a sajátjuké lehet (section 5
  tervezési elve: kérdésenként senki sem lát folyamatos rangsort/mást
  pontját). A host a broadcast előtt meghívja az `evaluate_question` RPC-t
  (`docs/features/scoring.md`), ami kitölti az `answers.is_correct`/
  `points_awarded`-et; a csapat kliens ezután **külön, saját** hívással
  (`team_answer_result(team_id, question_id)` RPC) kérdezi le a saját
  eredményét — ez nem lehetne sima anon SELECT policy, mert egy `using`
  policy nem tudna a lekérdezés WHERE-jében megadott `team_id`-hoz kötni
  (nincs auth session, amiből az RLS a "sajátot" levezetné).
- **Kliens teendő:** csapat — helyes válasz megjelenítése, majd a
  `team_answer_result` válasza alapján saját helyes/helytelen + pontszám
  kiírása.

#### Automatikus lezárás és feltárás (Fázis P3)

Korábban a host-nak kézzel kellett megnyomnia a "Zárás most" majd a
"Megoldás feltárása" gombot minden kérdésnél. `/host/[game_id]/+page.svelte`
mostantól két esetben automatikusan, host-interakció nélkül végigviszi
mindkét lépést (`lockAnswers()` majd rögtön `revealAnswer()`, tehát nincs
külön, látható "csak lezárva" köztes állapot):

1. **Lejár az idő** — a host saját `secondsLeft`-je (a P2-ben javított,
   `timer_start` broadcast-ra feliratkozó számítás) eléri a 0-t, amíg
   `uiStep === 'timing'`.
2. **Minden csapat beküldött, mielőtt lejárt volna az idő** — a
   `submissionCount` (élő számláló, Fázis O2, `postgres_changes` az
   `answers` táblán) eléri a `teams.length`-et (presence-alapú, élő
   csapatlista), amíg `uiStep === 'timing'`.

Mindkét feltételt egyetlen `$effect` figyeli, egy `autoAdvanceTriggered`
flag-gel védve, hogy csak egyszer induljon el kérdésenként (az effect a
`secondsLeft` 250ms-os ketyegése és a `submissionCount` élő frissülése
miatt gyakran újrafut, amíg `'timing'` állapotban vagyunk). A flag minden
`uiStep !== 'timing'` állapotban (tehát minden új kérdés kezdetekor)
visszaáll `false`-ra.

**A host kézi "Zárás most"/"Megoldás feltárása" gombjai változatlanul
elérhetők maradnak** — ha a host korábban, kézzel zár/tár fel (pl.
technikai probléma miatt), az normálisan kilép a `'timing'` állapotból, az
automatika nem fut le másodszor.

**Fontos korrektség-részlet:** a `submissionCount`-ot számláló `$effect`
mostantól szinkron módon 0-ra állítja a számlálót minden kérdésváltáskor,
mielőtt az új darabszám async lekérdezése megérkezne — enélkül az előző
kérdés végleges (esetleg "mindenki válaszolt") értéke egy pillanatra
átcsúszhatott volna az új kérdésre, és tévesen kiválthatta volna az
automatikus lezárást, mielőtt bárki válaszolt volna az újra.

### `round_leaderboard_reveal` (Fázis 5)

- **Küldő:** host, "Kör eredményének feltárása" gomb — csak a kör utolsó
  kérdésének feltárása után jelenik meg, a "Következő kör" gomb helyett.
- **Payload** (`RoundLeaderboardRevealPayload`):
  ```ts
  {
  	round_id: string;
  	round_title: string;
  	top3: Array<{ team_id: string; name: string; round_score: number; rank: number }>;
  }
  ```
  A `round_leaderboard(round_id, limit)` staff-only RPC-ből (`docs/features/scoring.md`)
  számolva — csak a kör-specifikus top 3, NEM az össz-pontszám (section 5
  tervezési elve).
- **Kliens teendő:** csapat/TV — teljes képernyős top 3 lista, saját csapat
  kiemelve; a host is megjeleníti (nem csak broadcastol). A csapat oldalon
  ez marad látszódva a következő `question_show`-ig.

### `final_leaderboard_reveal` (Fázis 5)

- **Küldő:** host, "Végeredmény feltárása" gomb — csak az utolsó kör utolsó
  kérdésének (és a hozzá tartozó kör-ranglistának) feltárása után.
- **Payload** (`FinalLeaderboardRevealPayload`):
  ```ts
  {
  	standings: Array<{ team_id: string; name: string; total_score: number; rank: number }>;
  }
  ```
  A `teams.total_score`-ból, `order by total_score desc` — nincs `round_id`
  szűrés, nincs `limit`, mindenki szerepel.
- **Kliens teendő:** csapat/TV — teljes végeredmény lista, saját csapat
  kiemelve.

### `game_finished` (Fázis 4)

- **Küldő:** host, "Játék lezárása" gomb (a `final_leaderboard_reveal` utáni
  lépés).
- **Payload:** `{}`
- **Kliens teendő:** csapat — nincs külön kezelése, a felület a
  `final_leaderboard_reveal`-en marad. TV — záró "Köszönjük a játékot!"
  képernyőre vált.

## Presence (Fázis 3)

A `game:{game_id}` csatorna Presence funkciója tartja élőben szinkronban,
mely csapatok vannak éppen csatlakozva — ez a host lobby nézet
(`/host/[game_id]`) élő csapatlistájának forrása, nem egy DB-lekérdezés.

**Csapat oldal** (`/play/[pin]`), sikeres csatlakozás után:

```ts
const channel = supabase.channel(`game:${gameId}`, {
	config: { presence: { key: teamId } }
});

channel.subscribe(async (status) => {
	if (status === 'SUBSCRIBED') {
		await channel.track({ team_id: teamId, name: teamName });
	}
});
```

**Host oldal** (`/host/[game_id]`), a lobby nézet betöltésekor:

```ts
const channel = supabase.channel(`game:${gameId}`, {
	config: { presence: { key: crypto.randomUUID() } } // a host saját kulcsa, nem kerül megjelenítésre
});

channel.on('presence', { event: 'sync' }, () => {
	const state = channel.presenceState<{ team_id: string; name: string }>();
	const teams = Object.values(state).flat(); // minden csatlakozott csapat aktuális állapota
});

channel.subscribe();
```

A Presence kulcsa csapat oldalon a `team_id` (így egy csapat egyetlen
bejegyzésként jelenik meg még akkor is, ha véletlenül több lapon van nyitva —
az utolsó `track()` felülírja az előzőt ugyanazon a kulcson), host oldalon egy
véletlen, csak a saját kapcsolatot azonosító kulcs (a host nem jelenik meg
csapatként a listában).

**TV oldal** (`/tv/[game_id]`, Fázis 6) ugyanezt a mintát követi, mint a
host: véletlen presence-kulccsal csatlakozik, `track()`-et nem hív (nem
jelenik meg csapatként), csak a `sync` eseményre figyel a lobby-képernyő élő
csapatszámlálójához/névlistájához.

## Postgres Changes (Fázis 4)

A host felület élő beküldési számlálója (`/host/[game_id]`) egy
`postgres_changes` feliratkozással figyeli az `answers` tábla INSERT
eseményeit, az aktuális `question_id`-ra szűrve:

```ts
supabase
	.channel(`answers:${questionId}`)
	.on(
		'postgres_changes',
		{ event: 'INSERT', schema: 'public', table: 'answers', filter: `question_id=eq.${questionId}` },
		() => {
			submissionCount++;
		}
	)
	.subscribe();
```

Ez a `answers_staff_all` RLS policy alapján működik (a host `authenticated`,
`role_id in (1,2,3)`) — a csapatoknak (`anon`) nincs SELECT joguk az
`answers`-en, tehát ők nem tudnának hasonló feliratkozást használni (ez
szándékos, lásd lent).

**Élő tesztelésből (Fázis O2): a számláló nem frissült.** A kliens-oldali
feliratkozás és az RLS is helyesen volt beállítva Fázis 4 óta — a
tényleges gyökérok az volt, hogy a `supabase_realtime` publikációnak
(`select * from pg_publication_tables where pubname = 'supabase_realtime'`)
**egyetlen tagja sem volt**. A Postgres Changes funkció a Supabase-ben erre
a publikációra épül (ez felel meg a dashboard "Database → Replication"
tábla-kapcsolóinak) — enélkül egyetlen táblán sem tud eseményt küldeni,
függetlenül attól, hogy a `.on('postgres_changes', ...)` feliratkozás
és az RLS mennyire helyes. Javítva: `supabase/migrations/20260808134500_answers_realtime.sql`
(`alter publication supabase_realtime add table answers;`), élőben
alkalmazva és leellenőrizve (a publikáció tagjai közt most már szerepel
az `answers`). **Módszertani tanulság minden jövőbeli `postgres_changes`
feliratkozáshoz**: az RLS és a kliens-oldali kód helyessége nem elég —
a táblát explicit hozzá kell adni a `supabase_realtime` publikációhoz is,
ez egy külön, könnyen kihagyható lépés.

## RLS-szint hozzáférés anonim (nem authentikált) klienseknek

A csapatok nem Supabase Auth session-nel csatlakoznak — a `device_token`
(kliens oldalon generált, `localStorage`-ban tárolt) adja az "azonosítást",
nem RLS-alapú sor-tulajdonlás. Ennek megfelelően:

- `games`: `anon` bármilyen nem `'finished'` sort láthat (PIN feloldáshoz
  és az újracsatlakozáshoz egyaránt — lásd lent).
- `teams`: `anon` beszúrhat, ha a cél `games` sor `status = 'lobby'`; olvashat
  minden nem `'finished'` játékhoz tartozó csapatot.
- `answers` / `answer_choice` / `answer_choice_multi` / `answer_slider` /
  `answer_ordering`: `anon` csak **beszúrhat** (ha a játék `'active'`),
  **nem olvashat** — szándékosan, hogy kérdésenként senki se lássa a
  többiek válaszát/pontját a feltárás előtt. A kliens az insert
  sikerességét használja "elküldve" visszajelzésnek, saját maga generált
  `id`-val az `answers` sorhoz (`crypto.randomUUID()`), hogy a
  típusonkénti gyerektáblákba is tudjon írni anélkül, hogy vissza kellene
  olvasnia a szülő sort.
- `team_joker_uses`: `anon` csak **olvashat** (hogy a saját kliense el
  tudja dönteni, elhasználta-e már a jokerét); a beszúrást a host végzi.

**Ismert, technikai csapda cross-table RLS policy-knál:** egy policy
`exists (select 1 from más_tábla ...)` alakú feltétele MAGA IS a
hivatkozott tábla RLS-e alá esik az adott szerepkörben — ha azon a
táblán nincs (vagy szűkebb) SELECT policy az adott szerepkörnek, az
`exists` mindig hamisat ad, még helyes adatokra is. Emiatt minden
cross-table anon ellenőrzés egy `security definer` segédfüggvényen
keresztül fut (`game_status()`, `answer_owner_game_active()`,
`team_owner_game_status()` — mind Fázis 4), amely megkerüli az RLS-t a
belső lekérdezésnél. Ez a hiba Fázis 3-ban két helyen (`teams` insert/
select policy) csendben, észrevétlenül hibásan viselkedett — Fázis 4
javította (`supabase/migrations/20260808113233_fix_anon_rls_gaps.sql`).

**Mid-game újracsatlakozás:** a `games` anon SELECT policy Fázis 3-ban
csak `status = 'lobby'`-ra engedett olvasást — ez azt jelentette, hogy egy
már csatlakozott csapat egy oldal-újratöltés (pl. háttérbe került mobil
böngészőlap) után "nem található" hibát kapott, ha a host időközben
elindította a játékot. Fázis 4 kiszélesítette `'finished'`-en kívül
mindenre; a `/play/[pin]` szerver-oldali PIN-feloldás (ami eldönti,
felajánlható-e egy ÚJ csatlakozás) továbbra is csak `'lobby'`-t enged, a
kliens oldal viszont — ha `localStorage`-ban van mentett csatlakozás —
ettől függetlenül le tudja kérdezni az este címét bármilyen nem
`'finished'` állapotban.

Részletek: `docs/architecture/DATA_MODEL.md` 4. szakasz, "Implementáció
(Fázis 3, Fázis 4)".
