# Visszaszámláló timer

## Cél

Egyetlen `timer_start` broadcast (`server_start_time` + `duration`) indítja
a visszaszámlálót minden felületen — nincs másodpercenkénti szerver→kliens
broadcast, minden kliens saját maga számol lokálisan. Ez a dokumentum a
végleges mechanizmust írja le (Fázis L), a `docs/architecture/DATA_MODEL.md` 5. szakaszának (real-time protokoll) kiegészítéseként.

## 1. A visszaszámlálás mechanikája (`/host`, `/play/[pin]`, `/tv`)

Mindhárom felület ugyanazt a mintát követi:

```ts
$effect(() => {
	if (!timerInfo) return;
	const endTime = new Date(timerInfo.server_start_time).getTime() + timerInfo.duration * 1000;

	const tick = () => {
		const remaining = Math.max(0, Math.round((endTime - serverNow()) / 1000));
		secondsLeft = remaining;
		if (remaining <= 0) locked = true; // csak /play/[pin]-en
	};
	tick();
	const interval = setInterval(tick, 250);
	return () => clearInterval(interval);
});
```

`serverNow()` (`src/lib/realtime/server-clock.ts`) — **nem** sima
`Date.now()`, lásd a 8. szakaszt. Ez egy sürgősségi javítás eredménye
(korábban valóban `Date.now()`-t használt mindhárom felület).

- **Egyszeri broadcast, lokális számolás**: a `timer_start` payload csak
  egyszer érkezik (`{ question_id, duration, server_start_time }`) — nincs
  külön "tick" esemény. Minden kliens a saját rendszeróráját méri a kapott
  `server_start_time`-hoz képest, 250ms-onként újraszámolva a hátralévő
  másodperceket. Ez azt jelenti, hogy a három felület szinkronban fut
  **feltéve, hogy a kliens-eszközök rendszerórája nagyjából egyezik**
  (ami valós telefonokon/laptopokon NTP-vel gyakorlatilag mindig igaz) —
  nincs hálózati késleltetésből fakadó csúszás, mert nem a broadcast
  megérkezési ideje számít, hanem a benne lévő abszolút időbélyeg.
- **Önzáró kliens, nem csak broadcast-vezérelt**: a `/play/[pin]` csapat
  kliense a saját `remaining <= 0` számítása alapján **saját magát**
  zárja le (`locked = true`), nem várja meg feltétlenül a host külön
  `answer_locked` broadcast-ját. Ez azt jelenti, hogy egy olyan kliens is
  helyesen lezár, amelyik éppen nem figyelte a visszaszámlálót (pl.
  háttérbe került a böngészőlap) — amint újra aktívvá válik és a
  `tick()` lefut, azonnal negatív/nulla `remaining`-et számol.

## 2. TimerRing vizuális állapotok

`src/lib/components/TimerRing.svelte` — `low` állapot (`secondsLeft <= 5`)
pulzáló `--danger`-re vált nyugodt `--cyan`-ról, pontosan a
`docs/design/STYLE_GUIDE.html` "TimerRing" demójának `full`/`low`
mintája szerint. (Az `inactive` variáns — szürke, forgó, számláló-szöveg
nélküli — a Fázis I-ben épült `ReconnectOverlay`-hez, nem a normál
visszaszámláláshoz tartozik.)

## 3. Szerver-oldali timer-kikényszerítés (Fázis L, új)

**A probléma:** Fázis L előtt az `answer_locked`/`locked` kizárólag
kliens-oldali UI-állapot volt — a `answers` tábla `anon` INSERT RLS
policy-ja csak azt ellenőrizte, hogy `games.status = 'active'`, semmi mást.
Egy módosított kliens (vagy egy nyílt `fetch`/`curl` hívás a Supabase REST
API-ra közvetlenül) tetszőleges időpontban beszúrhatott volna egy választ,
függetlenül attól, hogy a timer valójában lejárt-e.

**A megoldás** (`supabase/migrations/20260808130000_timer_enforcement.sql`):

- A `games` tábla két új oszlopot kapott: `current_question_started_at`
  (`timestamptz`) és `current_question_duration_seconds` (`integer`) — ezt
  a host írja be **a `timer_start` broadcast-tal egy időben**
  (`startTimer()`, `/host/[game_id]/+page.svelte`), ugyanazzal a
  `server_start_time`/`duration` értékpárral, amit a broadcast is kap.
- Új `answer_within_timer(p_game_id, p_question_id)` security-definer
  SQL-függvény (ugyanaz a minta, mint a `game_status()`/
  `answer_owner_game_active()`): igaz, ha a `game.current_question_id`
  egyezik a beküldött `question_id`-vel, a timer el lett indítva, és
  `now() <= current_question_started_at + (duration + 3mp türelmi idő)`.
- Az `answers_insert_anon_active_game` RLS policy `with check` ága
  kiegészítve: `game_status(game_id) = 'active' and
answer_within_timer(game_id, question_id)`.
- **A gyerektáblákra (`answer_choice`/`answer_choice_multi`/
  `answer_slider`/`answer_ordering`) nem kellett külön ellenőrzés** — ezek
  csak egy már sikeresen beszúrt `answers` sorra hivatkozva írhatók
  (`answer_owner_game_active()`), tehát ha a szülő sor beszúrása elbukik a
  timer-ellenőrzésen, a gyerek-insert-eknek soha nincs mire hivatkozniuk.
- **3 másodperces türelmi idő**: szándékosan nem szigorú `<=` a pontos
  `duration`-re — a hálózati késleltetés (kliens → Supabase) miatt egy,
  a valós határidőn belül elindított beküldés is később érkezhet meg a
  szerverre. Ez ugyanaz a tolerancia-sáv, amit az 5. pont ("ne legyen
  másodperces csúszás 2-3 böngészőfül között") is elfogad.
- **Kliens-oldali visszajelzés**: a `/play/[pin]` `submitAnswer()`-je az
  RLS-elutasítást (`error.code === '42501'`) felismeri, és "Lejárt az idő,
  mielőtt a válaszod megérkezett volna." üzenetet mutat az általános hiba
  helyett.

**Élőben tesztelve** (nem csak kód-átolvasással) egy tranzakcióba
csomagolt, `rollback`-kal lezárt SQL-szimulációval a valós Supabase
projekten (`set local role anon`, 4 eset: timer el sem indult → elutasítva;
duration+türelmi idő lejárt → elutasítva; duration-on belül → sikeres;
türelmi időn belül, de duration után → sikeres) — mind a négy a várt
eredményt adta, majd a teszt-adatok `rollback`-kal eltűntek.

## 4. Ismert korlát

Ha egy csapat kliense a `timer_start` broadcast-ot **teljesen lemaradja**
(pl. a kérdés megjelenése és a timer indítása közötti pillanatban esik ki
a kapcsolata, majd csak a kérdés lezárása után csatlakozik vissza), nincs
helyi `timerInfo`-ja, tehát a UI-ja nem mutat visszaszámlálót és nem zár
látványosan — de a beküldés ettől függetlenül **biztonságosan elutasításra
kerül** a szerver-oldali `answer_within_timer()` ellenőrzésen, csak az
"idő lejárt" üzenet helyett az általános hibaüzenetet látja. Ez UX-hiányosság,
nem biztonsági rés — javítása (pl. a `games` sor közvetlen lekérdezése
csatlakozáskor a `current_question_started_at`/`duration` visszanyeréséhez)
egy jövőbeli finomítás, nem MVP-blokkoló.

## 5. Fázis O1 — élő tesztelésből: hiányzó host-timer, automatikus indítás, "lezárva" állapot

Élő böngészős teszt három konkrét hibát talált a fenti mechanizmusban:

1. **A `/host/[game_id]` felület egyáltalán nem jelenítette meg a
   `TimerRing`-et**, és nem is figyelt a `timer_start`/`answer_locked`
   eseményekre saját magán — csak elküldte őket. A host most a `/play`/`/tv`
   felületekkel megegyező mintát követi: saját `timerInfo`/`secondsLeft`
   state, ugyanaz a helyi `$effect`-alapú számolás, `TimerRing` renderelve
   a kérdés-kártya alatt.
2. **Külön "Timer indítása" gomb volt** a "Következő kérdés" és a timer
   tényleges elindítása között — ez felesleges, hibalehetőséget adó extra
   lépés volt (a host elfelejtheti megnyomni). A `showNextQuestion()` és a
   korábbi `startTimer()` egy függvénybe olvadt: a `question_show`
   broadcast elküldése után **azonnal**, ugyanabban a hívásban indul a
   timer (a `games.current_question_started_at`/`duration_seconds` írása +
   a `timer_start` broadcast) — nincs köztes UI-állapot, amiben a kérdés
   már látszik, de a timer még nem fut. Ezzel a `uiStep` állapotgép
   `'shown'` értéke is megszűnt (soha nem állt volna meg ott).
3. **`answer_locked` után a `TimerRing` hibásan a képernyőn maradt**,
   lefagyva a lejáráskori (jellemzően "low", pulzáló piros) állapotban —
   mindhárom felületen (`/host`, `/play/[pin]`, `/tv`) most egy explicit
   `locked` állapot (host-on a meglévő `uiStep === 'locked'`, play/tv-n új
   `locked` boolean, ami a TV-n korábban egyáltalán nem is létezett — a TV
   sosem figyelt az `answer_locked` eseményre) egy egyértelmű "Lezárva"
   feliratra cseréli a gyűrűt, ahelyett hogy a régi számláló-állapot
   látszódna tovább.

## 6. Vizuális szinkron ellenőrzése három böngészőfülön

A sandbox HTTPS-blokkolása miatt (lásd `docs/DECISIONS_LOG.md` korábbi
fázisai) ez a session nem tud három egyidejű böngészőfület nyitni a
`/host`/`/play`/`/tv` felületekre a valódi WebSocket Realtime kapcsolaton
keresztül — ez továbbra is a felhasználó feladata. A mechanizmus
tervezésileg szinkron (lásd 1. pont), és a szerver-oldali kikényszerítés
élőben, valós DB-n igazoltan működik — de a tényleges, szemmel látható
"nincs másodperces csúszás 2-3 fül között" ellenőrzést élő böngészőben
kell elvégezni.

## 7. Fázis P2 — a host 2-3 másodperccel "előrébb" járt, mint a csapatok/TV

**Tünet (élő tesztelésből):** a csapatok (`/play`) visszaszámlálója
induláskor 2-3 másodperccel kevesebbet mutatott, mint a host/TV
felületeken ugyanabban a pillanatban.

**Gyanított, de cáfolt ok:** az 1. pontban leírt mechanizmus (mindhárom
felület a kapott `server_start_time`-ból számol, nem a saját fogadási
pillanatától) kód-átolvasással ellenőrizve **helyesnek bizonyult**
mindhárom felületen — a `/play` és `/tv` a `timer_start`
broadcast-eseményben kapott `server_start_time`-ot használta, nem a saját
`Date.now()`-ját induláskor.

**A valódi gyökérok:** a `/host/[game_id]` a saját `timerInfo` state-jét
**nem** a `timer_start` broadcast tényleges kézbesítésekor állította be,
hanem közvetlenül, szinkron módon a `channel.send()` hívás visszatérése
után — tehát a hálózati Realtime-kézbesítési késleltetés (amíg a
broadcast ténylegesen eljut a csapatokhoz/TV-hez, jellemzően
100ms-2mp+ a Supabase Realtime infrastruktúrán át) **kizárólag a
csapatokat/TV-t érintette**, a host-ot nem — a host emiatt korábban
kezdte el a saját visszaszámlálását megjeleníteni, mint amikor a többiek
egyáltalán megkapták az eseményt.

**Javítás** (`/host/[game_id]/+page.svelte`): a host saját csatornája
mostantól `broadcast: { self: true }` konfigurációval jön létre, és a
`timerInfo`-t egy `channel.on('broadcast', { event: 'timer_start' }, ...)`
feliratkozás állítja be — **ugyanazon az úton**, mint a `/play`/`/tv`
teszi. Ezzel a host is ugyanazt a (elkerülhetetlen) Realtime-kézbesítési
késleltetést kapja, mint bárki más — a három felület relatív szinkronban
indul, nem csak mindegyik önmagában helyesen számol.

## 8. Sürgősségi javítás — a csúszás a Fázis P2 után is fennállt (eszköz-óra szinkronizáció)

**Tünet:** a Fázis P2 javítása után a felhasználó élőben megerősítette,
hogy a csapatok (`/play`) órája TOVÁBBRA IS kevesebbet mutatott, mint a
TV-é — annak ellenére, hogy a host-vs-többiek relatív csúszás (7. pont)
már javítva volt.

**A valódi gyökérok — két, egymásra rakódó hibaforrás:**

1. A `games.current_question_started_at` időbélyeg eddig a **host kliens
   saját, helyi óráján** (`new Date().toISOString()`, JS `Date.now()`)
   alapult, amit a host aztán mind a DB-be beírt, mind broadcast-olt.
2. Minden kliens (host, csapat, TV) a **saját eszközének** `Date.now()`-
   jával számolta ki a hátralévő időt ehhez az időbélyeghez képest.

Ha bármelyik két eszköz (pl. egy csapat telefonja és a TV-hez csatlakozó
gép/box) rendszerórája akár csak pár másodperccel eltér EGYMÁSTÓL — ami
valós, gyakori jelenség, nem minden eszköz NTP-pontos —, a két kliens
egymástól eltérő "hátralévő idő" értéket számol ki, még akkor is, ha
mindketten a broadcast-ot (majdnem) egyszerre kapták meg és technikailag
"helyesen" számolnak a SAJÁT órájukhoz képest. A Fázis P2 javítása ezt a
konkrét hibaforrást nem érintette (az a hálózati kézbesítési
késleltetésről szólt, nem az eszközök óráinak egymáshoz képesti
eltéréséről) — ezért maradt fenn a panasz.

**Javítás — szerver-oldali, tekintélyelvű óra + kliens-oldali kalibráció:**

1. **`start_question_timer(p_game_id, p_duration)` RPC**
   (`supabase/migrations/20260809170000_server_clock_sync.sql`) — a host
   ezt hívja a `games.update(...)` közvetlen hívás helyett. A függvény a
   Postgres-szerver `now()`-ját írja be `current_question_started_at`-ként,
   és ugyanazt adja is vissza — a host ezt az egyetlen, közös,
   tekintélyelvű időbélyeget broadcast-olja tovább, nem egy saját eszköz-
   generáltat.
2. **`server_now()` RPC** — kis, olcsó, `anon`-nak is hívható függvény,
   ami visszaadja a Postgres-szerver óráját.
3. **`src/lib/realtime/server-clock.ts` (`calibrateServerClock()` /
   `serverNow()`)** — minden felület (`/host`, `/play/[pin]`, `/tv`)
   `onMount`-jában egyszer meghívja a `calibrateServerClock()`-ot: ez egy
   NTP-szerű mérést végez (a `server_now()` hívás előtt/után mért saját
   `Date.now()`-okból megbecsüli a hálózati kör-utazás felét, és ehhez
   képest számítja ki, mennyivel tér el a saját órája a szerver órájától
   — `offsetMs`). A visszaszámláló `$effect`-ek (és a `submitAnswer()`
   `answer_time_ms` számítása, ami a pontszámítás decay-képletébe megy)
   mostantól **mindenhol** `serverNow()`-t (`Date.now() + offsetMs`)
   használnak nyers `Date.now()` helyett.

**Miért oldja meg ez a problémát véglegesen:** minden kliens ugyanahhoz a
KÖZÖS, szerver-oldali órához kalibrálja magát, függetlenül attól, hogy a
saját eszköze pontos-e. Két kliens hátralévő-idő számítása emiatt
legfeljebb a kalibráció saját hibahatárán (jellemzően pár tized
másodperc, a hálózati kör-utazás varianciájából) belül térhet el
egymástól — nem az eszközök óráinak akár többmásodperces eltérésén.

**Élőben ellenőrizve** (rollback-kal lezárt SQL-szimulációval): a
`start_question_timer()` UPDATE...RETURNING logikája helyesen írja be és
adja vissza a szerver `now()`-ját; a `server_now()` sikeresen hívható
`anon` szerepkörből is.
