# Decisions Log

Rövid, dátumozott bejegyzések minden lezárt fázisról: mi történt, és miért úgy
döntöttünk, ha volt választási helyzet. Lásd `docs/DOCUMENTATION_POLICY.md`.

---

## 2026-08-07 — Fázis 0: Projekt-váz + CI/CD + docs skeleton

Létrehozva: SvelteKit projekt (`sv create`, TypeScript, `adapter-auto`) Prettier +
ESLint add-onokkal, `@supabase/supabase-js` + `@supabase/ssr` csomagok és egy alap
szerver-oldali Supabase kliens (`src/lib/server/supabase.ts`, `src/hooks.server.ts`) —
maga az auth flow és a route guard Fázis 1-ben készül el. Husky + lint-staged
pre-commit hook (ESLint `--fix` + Prettier a stage-elt fájlokon). A teljes
`/src` route/lib mappaváz és a `supabase/migrations/` üres mappa. `docs/` skeleton
(`architecture/`, `features/`, `DOCUMENTATION_POLICY.md`, `DECISIONS_LOG.md`).
`.github/workflows/ci.yml` (lint + `svelte-check` + build, PR-onként `main`-re).
Gyökér `CLAUDE.md`.

Nyitott pont: a `docs/architecture/DATA_MODEL.md` egyelőre placeholder — a forrás
`PUB_QUIZ_APP_TERV.md` nem volt elérhető ebben a sessionben. Fázis 1 előtt pótolni
kell, mert minden további fázis prompt erre hivatkozik szakaszszám szerint.

## 2026-08-07 — DATA_MODEL.md véglegesítve

A `PUB_QUIZ_APP_TERV.md` tartalma bekerült a `docs/architecture/DATA_MODEL.md`-be
(teljes séma: jogosultságok, kérdésbank, válaszok, games/teams/rounds, real-time
protokoll séma-oldala, audit log, felület-áttekintés, MVP fázisok). A gyökérben lévő
`PUB_QUIZ_APP_TERV.md` törölve — a `docs/architecture/DATA_MODEL.md` az egyetlen
forrás igazság, nem tartunk két helyen duplikált másolatot. Fázis 1 innentől indítható.

## 2026-08-08 — Fázis 1: Jogosultság + admin váz + audit log

Migráció (`supabase/migrations/20260807234850_roles_profiles_audit.sql`):
`roles`/`profiles` a DATA_MODEL.md 1. szakasza szerint, `audit_logs` +
`log_table_change()` trigger a 6. szakasza szerint, rákötve a `profiles`
táblára. Ezen felül (nem volt explicit SQL a tervben, indoklás a
DATA_MODEL.md 1. szakaszának "Implementáció" alszakaszában): `handle_new_user()`
trigger az `auth.users`-en (automatikus `profiles` sor létrehozás, alap
`role_id = 4`), `current_user_role_id()` segédfüggvény a rekurzív RLS
elkerülésére, és konkrét RLS policy-k a `roles`/`profiles`/`audit_logs`
táblákon. A migrációt közvetlenül a Supabase MCP-n keresztül alkalmaztam az
éles (üres) `PubQuiz` projektre (`wnmgilblkdqunhpwoulj`); a security/performance
advisorok által jelzett problémákat (mutable search_path, anon/authenticated
RPC-elérés a trigger-függvényeken, `auth.uid()` újrakiértékelése soronként)
kijavítottam és belefésültem az egyetlen migrációs fájlba, mielőtt commitoltam
— nem hagytam a "hiba, majd 2 javító migráció" történetet a repóban, mivel ezt
még senki más nem húzta le.

Supabase auth: email/jelszó, `@supabase/ssr` szerinti szabványos SvelteKit
minta (`+layout.server.ts` + `+layout.ts` + `+layout.svelte` session-szinkron,
`src/lib/supabase.ts` böngésző-kliens). `/login` (bejelentkezés + regisztráció
egy oldalon, mód-váltóval), `/logout` (`+server.ts` POST action).
`/admin/+layout.server.ts` route guard: bejelentkezés nélkül `/login`-ra
irányít, `role_id` 1/2 (super_admin/admin) nélkül 403-at ad.

Az auth-folyamatot élő böngészőben csak részben tudtam tesztelni: ennek a
sandboxnak az egress-proxy szabályzata policy-szinten (403) blokkolja a
kimenő kapcsolatot a `*.supabase.co` felé, így a tényleges signup/login hívás
nem futott le helyben (ez a sandbox hálózati korlátja, nem a kódé — a Vercel
preview deploy nincs e mögött a proxy mögött, ott működnie kell). Amit
ellenőriztem: a build/lint/typecheck tiszta, a form action helyesen építi fel
és küldi a kérést (a hálózati hívás pontosan itt bukott el, kódszinten nem),
és a DB-oldalt közvetlenül SQL-lel (`pg_trigger`, `pg_policies`) + a Supabase
security/performance advisorokkal igazoltam vissza.

## 2026-08-08 — Fázis 2: Kérdésbank CRUD + témák + random húzás + cooldown

Migráció (`supabase/migrations/20260808001114_question_bank.sql`):
`themes`, `question_types` (+ seed), `questions`, `app_settings` (+ cooldown
seed), `question_choice_options`/`question_slider_config`/
`question_ordering_items`, `round_questions` + `last_used_at` trigger, audit
trigger a `questions` + a három opció-táblán, `draw_random_questions_for_round()`
RPC — mind a DATA_MODEL.md 2. szakasza alapján, dokumentálva a
`docs/features/random-draw.md`-ben.

Strukturális eltérés: a `round_questions.round_id` FK-ja miatt a `games`/
`rounds` táblákat (4. szakasz, eredetileg Fázis 3-ra ütemezve) előre kellett
hozni minimális oszlopkészlettel — enélkül a round_questions egyáltalán nem
lett volna létrehozható. Fázis 3 erre épít rá (PIN/QR/lobby, `teams` tábla,
a `games.pin` részleges unique indexe). A biztonsági/teljesítmény advisorok
által jelzett problémákat (PUBLIC + anon/authenticated RPC-elérés az új
`draw_random_questions_for_round`-on) ugyanúgy egyetlen migrációs fájlba
fésülve javítottam, mint Fázis 1-ben.

Admin felület: `/admin/themes` (CRUD), `/admin/questions` (lista + szűrés +
típusonkénti dinamikus űrlap öt kérdéstípushoz), `/admin/games` +
`/admin/games/[id]` (kvízeste/kör-előkészítés + Random húzás gomb).

A böngészős E2E tesztelés itt is a Fázis 1-nél leírt sandbox-hálózati
korlátba ütközött, ezért a `draw_random_questions_for_round` RPC-t,
a cooldown-szűrést, a duplikátum-kizárást és a `last_used_at` triggert
közvetlenül SQL-lel, valós teszt-adatokkal futtatva igazoltam vissza (majd
a teszt-adatokat és a hozzájuk tartozó audit_logs bejegyzéseket töröltem).

## 2026-08-08 — Terv frissítve: vizuális design téma rendszer

A felhasználó elküldte a terv frissített (v2) változatát egy önálló,
tartalmi témáktól (`themes`) független `design_themes` rendszerrel
(szín/font token-készlet, egyetlen alapértelmezett téma DB-szinten
kikényszerítve). Csak a diff került be a `docs/architecture/DATA_MODEL.md`-be
(új 8. szakasz, a régi "MVP fázisok" 9-re tolva, kisebb kiegészítések a
2/4/7. szakaszban) — implementáció még nem történt, ez egyelőre tisztán
tervezési frissítés.

## 2026-08-08 — Fázis 3: Csatlakozási flow (PIN/QR, lobby)

Migráció (`supabase/migrations/20260808105851_teams_join_flow.sql`): `teams`
tábla a DATA_MODEL.md 4. szakasza szerint; a Fázis 2-ben létrehozott sima
`unique` a `games.pin`-en lecserélve egy részleges unique indexre
(`games_pin_active_key`, csak `status <> 'finished'`-re), hogy egy lezárt
este PIN-je újra kiosztható legyen. RLS: `anon` (nem authentikált csapat-
kliensek) csak `status = 'lobby'` `games` sorokat láthatnak és csak azokhoz
csatlakozhatnak (`teams` insert); `teams_staff_all` a szokásos `role_id in
(1,2,3)` kör. Mindhárom szabályt (lobby-only látás, lobby-only join,
PIN-újrafelhasználás lezárt estén) közvetlenül SQL-lel, `set role anon`-nal
szimulálva igazoltam vissza, majd töröltem a teszt-adatokat.

`/play` (kézi PIN beírás) + `/play/[pin]` (csapatnév űrlap → `teams` insert,
`device_token` `localStorage`-ban, újratöltésnél a mentett adatból automatikus
"várakozás" képernyő). `/host/+layout.server.ts` új, önálló route guard
(`role_id in (1,2,3)`, tágabb, mint az `/admin` guard-ja) + `/host/[game_id]`
élő lobby: QR kód (kliens oldali `qrcode` csomaggal) + PIN, élő csapatlista
Supabase Presence-szel (`game:{game_id}` csatorna). A csapat csatlakozáskor
egy `team_joined` broadcast eseményt is küld — dokumentálva a
`docs/architecture/REALTIME_PROTOCOL.md`-ben a Presence-mintával együtt.

Ismert korlát Fázis 4-re halasztva: mivel a PIN-alapú `games` lekérdezés csak
`status = 'lobby'`-ra enged anon olvasást, egy csapat nem tud PIN-en keresztül
újracsatlakozni, ha a host már elindította az estét — a `localStorage`-ban
tárolt `team_id`/`game_id` alapú újracsatlakozás a tényleges játékmenet
UI-jával együtt épül meg.

## 2026-08-08 — Fázis 4: Kérdés lebonyolítás (broadcast, timer, válasz-UI, joker)

Migráció (`supabase/migrations/20260808111917_answers_joker.sql`): `answers`

- `answer_choice`/`answer_choice_multi`/`answer_slider`/`answer_ordering`
  (DATA_MODEL.md 3. szakasz), `team_joker_uses` (4. szakasz). `is_correct`/
  `points_awarded` egyelőre kitöltetlen — az `evaluate_answer` Edge Function
  Fázis 5-ös feladata.

Két valós hibát találtam és javítottam tesztelés közben, mindkettő ugyanaz a
hibaosztály: egy RLS policy `exists (select 1 from más_tábla ...)` alakú
ellenőrzése maga is a hivatkozott tábla RLS-e alá esik az adott
szerepkörben — ha ott nincs (vagy szűkebb) SELECT policy, az `exists` mindig
hamisat ad. (1) Az új `answer_choice`/stb. insert policy-k az `answers`
ellen próbáltak `exists`-elni, pedig az `answers`-en szándékosan nincs anon
select (mid-question privacy); (2) a Fázis 3 `teams_select_anon_active_game`/
`teams_insert_anon_lobby` a `games` ellen `exists`-elt, ami akkor még csak
`status = 'lobby'`-ra engedett olvasást — ez Fázis 3-ban észrevétlen maradt,
mert az akkori tesztek csak lobby-állapotú eseteket néztek. Mindkettőt
security definer segédfüggvényekkel javítottam (`answer_owner_game_active()`,
`team_owner_game_status()`, a Fázis 3 hibát egy külön követő migrációban:
`20260808113233_fix_anon_rls_gaps.sql`, mivel a Fázis 3 fájl már push-olva
volt). Mindezt `set role anon`-os SQL-szimulációval igazoltam vissza, valós
teszt-adatokkal, majd töröltem őket.

Ezzel egy időben lezártam a Fázis 3 dokumentációban nyitva hagyott
mid-game-újracsatlakozási hiányosságot is (nem csak elhalasztottam újra): a
`games` anon SELECT policy `status = 'lobby'`-ról `status <> 'finished'`-re
szélesült, így egy csapat oldal-újratöltés után (pl. háttérbe került mobil
lap) is látja az este címét, ha korábban már csatlakozott — a `/play/[pin]`
szerver-oldali PIN-feloldás (ami az ÚJ csatlakozást engedélyezi) továbbra is
csak lobby-ban ad vissza sort.

Host felület (`/host/[game_id]`) kiegészítve élő kérdés-vezérlővel: "Kvíz
indítása", "Következő kérdés"/"Timer indítása"/"Zárás most"/"Megoldás
feltárása" lineáris állapotgép, "Következő kör"/"Játék befejezése", élő
beküldési számláló (`postgres_changes` az `answers`-en). Mivel a host
`authenticated` és a Fázis 2 óta hiányzó `questions`-select jogot Fázis 4
pótolta rá (lásd lent), a vezérlő logika közvetlenül a host böngészőjéből,
SvelteKit action-ök nélkül éri el/írja a DB-t.

Csapat felület (`/play/[pin]`) kiegészítve típusonkénti válasz-UI-val
(gombrács, csúszka, HTML5 drag-and-drop sorrend-lista), helyi
visszaszámlálással (`timer_start` szerver-időbélyege alapján, önzáró), és a
"Duplázás" joker gombbal. A payload-típusok egy közös helyen élnek:
`src/lib/realtime/protocol.ts`.

Fázis 2 hiba javítva: a host (`role_id = 3`) eddig egyáltalán nem fért hozzá
a kérdésbankhoz, pedig a DATA_MODEL.md 1. szakasza szerint futtathat estét
meglévő kérdésbankból — kiegészítő select-only RLS policy-k `role_id in
(1,2,3)`-ra a `questions`/opció-táblák/`round_questions`/`themes`/
`question_types` mellé.

Dokumentáció: `docs/features/jokers.md` (joker-mechanika, beleértve az ismert
korlátot, hogy a host-nak online kell lennie a joker rögzítéséhez),
`docs/architecture/REALTIME_PROTOCOL.md` (teljes esemény-táblázat konkrét
payload-okkal, Postgres Changes szakasz, RLS csapda + újracsatlakozás
magyarázat), DATA_MODEL.md implementációs jegyzetek a 3. és 4. szakaszban.

## 2026-08-08 — Fázis 5: Pontszámítás + ranglista

Migráció (`supabase/migrations/20260808115203_scoring.sql`):
`evaluate_question(p_question_id)`, `team_answer_result(p_team_id,
p_question_id)`, `round_leaderboard(p_round_id, p_limit)` — a DATA_MODEL.md 3. és 5. szakaszának képletei szerint. Részletes leírás: `docs/features/scoring.md`.

**Tervtől eltérő döntés: Edge Function helyett Postgres RPC.** A
DATA_MODEL.md eredetileg egy `evaluate_answer` Edge Function-t irányzott elő.
Mivel ebben a sandboxban a kimenő HTTPS a `*.supabase.co` felé blokkolt, egy
ténylegesen deployolt Edge Function-t sem böngészőből, sem közvetlen HTTP-vel
nem lehetett volna tesztelni — csak "vakon" deployolni. A már bevált SQL/
`set role` tesztelési mintával (Fázis 3/4) viszont egy RPC függvény teljes
körűen, minden ágra kiterjedően tesztelhető. Funkcionálisan egyenértékű (a
host egyetlen `.rpc()` hívással indítja), nincs hidegindítás, és a logika a
jövőben is könnyen átemelhető Edge Function-be, ha valódi HTTP endpoint
válna szükségessé.

**Decay-képlet — a DATA_MODEL.md nem rögzítette, itt bevezetett döntés:**
lineáris decay 100%-ról (azonnali válasz) 50%-ra (a `time_limit_seconds`
lejártakor), utána 50%-on plafonozva.

**`team_answer_result` biztonsági indoklása:** mivel a csapatoknak nincs auth
session-jük, egy `using` RLS policy nem tudna a lekérdezés WHERE-jében
megadott `team_id`-hoz kötni — egy sima anon SELECT policy az `answers`-en
vagy semmit nem engedne, vagy `game_id` alapján (amit a csapat legitim módon
ismer) az ÖSSZES csapat válaszát kiadná. Az RPC ehelyett `team_id` +
`question_id` UUID-párra van paraméterezve, egyetlen sort ad vissza — ugyanaz
az "ismert UUID = de facto tulajdonjog" minta, mint a Fázis 4
`team_joker_uses_select_anon`-nál, nem új biztonsági kompromisszum.

**Fázis 2 hiba találva és javítva** (tesztfixturák felvitele közben,
`supabase/migrations/20260808115901_fix_audit_log_entity_id.sql`): a
`log_table_change()` audit trigger `coalesce(NEW.id, OLD.id)` típusos
rekordmező-hozzáférést használt, ami runtime hibával elszállt minden olyan
táblán, aminek NEM "id" az elsődleges kulcs oszlopa —
`question_slider_config`-nál (PK: `question_id`) ez azt jelentette, hogy
bármilyen írás erre a táblára (tehát egy slider típusú kérdés létrehozása/
szerkesztése az admin felületen) eddig hibázott éles környezetben. A sandbox
HTTPS-blokkolása miatt Fázis 2-ben ez nem derült ki élő böngészős teszttel.
Javítás: `to_jsonb(...)->>'id'` szöveges kiolvasás típushiba helyett.

**Verifikáció:** a szokásos módon `execute_sql` + `set role`/JWT-claim
szimulációval, valós adatbázis ellen, nem lokális mockkal. Egy teljes
tesztjátékot építettem fel (1 kérdés mind a 4 típusból, 2 csapat: "Fast" —
gyors/helyes válaszok, joker-használó egy kérdésen — és "Slow" —
lassú/részben hibás válaszok), minden típusra kézzel kiszámolt várt
pontszámmal, és az `evaluate_question` minden esetben pontosan azt adta
vissza (decay, `points_multiplier`, joker-szorzó, `multi_choice` parciális
pont és a rossz-jelölés-nullázza-a-pontot szabály mind egyezett). Külön
teszteltem: az anon szerepkör `42501`-gyel elutasítva az `evaluate_question`
és `round_leaderboard` hívásán (grant-szinten, nem csak a függvényen belüli
role-check miatt); kétszeri `evaluate_question` hívás idempotens (nem
duplázza a `teams.total_score`-t); `team_answer_result` csak a kért
`team_id`+`question_id` sorát adja vissza, nem létező párra üres eredményt.
A staff-jogosultság szimulációjához egy ideiglenes `auth.users`/`profiles`
teszt-sort hoztam létre (role_id=1), NEM a valós felhasználói fiókot
módosítva — minden teszt-adatot (játék, kérdések, csapatok, válaszok,
audit_logs bejegyzések, a teszt-profil) töröltem a végén; ellenőriztem, hogy
a valós `profiles` sor (`role_id = 4`) érintetlen maradt.

Host felület (`/host/[game_id]`): `revealAnswer()` a helyes válasz
összeállítása előtt meghívja az `evaluate_question` RPC-t. Egy kör utolsó
kérdésének feltárása után "Kör eredményének feltárása" gomb jelenik meg a
"Következő kérdés" helyett (`round_leaderboard` lekérdezés +
`round_leaderboard_reveal` broadcast + saját megjelenítés egy
`round_summary` UI-lépésben); az utolsó kör után hasonlóan "Végeredmény
feltárása" (`final_leaderboard_reveal`, `final_summary` lépés). Csak ezután
kattintható a tényleges "Következő kör"/"Játék lezárása" gomb.

Csapat felület (`/play/[pin]`): a `question_reveal` beérkezésekor lekéri a
saját pontját (`team_answer_result`), zöld/piros felirattal jelezve a
helyes/helytelen státuszt és a kapott pontot. A `round_leaderboard_reveal`/
`final_leaderboard_reveal` beérkezésekor teljes képernyős ranglista-nézetre
vált, saját csapat kiemelve.

**TV felület elhalasztva Fázis 6-ra:** a DATA_MODEL.md 9. szakasza szerint a
`/tv/[game_id]` kivetítő kifejezetten Fázis 6 ("Polírozás") scope-ja. A
leaderboard broadcast payloadok már most is alkalmasak arra, hogy egy
jövőbeli TV kliens minden backend-módosítás nélkül feliratkozzon rájuk.

Dokumentáció: `docs/features/scoring.md` (új — Edge Function vs. RPC
indoklás, decay-döntés, mindhárom RPC leírása), `docs/architecture/REALTIME_PROTOCOL.md`
(`round_leaderboard_reveal`/`final_leaderboard_reveal` tervezettből
implementáltra, `question_reveal` frissítve), DATA_MODEL.md implementációs
jegyzetek a 3. és 5. szakaszban.

## 2026-08-08 — Fázis 6: Polírozás (design témák, TV mód, animáció, hang)

A felhasználó a "Minden egyben" opciót választotta a Fázis 6 scope-jára: a
DATA_MODEL.md 9. szakaszának "hangeffektek, animációk, TV mód" listája
mellett a 8. szakaszban korábban csak megtervezett (nem implementált)
vizuális design téma rendszer is ebben a fázisban készült el, mivel a TV mód
és a host/csapat felület végleges köntöse ettől függ.

Migráció (`supabase/migrations/20260808123000_design_themes.sql`):
`design_themes` tábla + `enforce_single_default_design_theme()` trigger +
Retro Arcade seed a DATA_MODEL.md 8. szakasza szerint; `games.design_theme_id`
(`alter table`, mivel a `games` már létezik). RLS: admin/super_admin (1,2)
teljes CRUD, host (3) csak olvas, `anon` (csapat + TV) is olvas — a
`design_tokens` tisztán vizuális adat. Mindhárom szint + az egyetlen-
alapértelmezett trigger SQL-lel ellenőrizve (`set role`/JWT-claim
szimulációval), teszt-adatok törölve.

**Token-feloldás** (`src/lib/theme/tokens.ts`): `games.design_theme_id` → az
adott `design_themes` sor → ha üres, `is_default = true` sor → ha az sincs,
hardcode-olt fallback. A `design_tokens` kulcsai néha `--`-vel kezdődnek,
néha nem (`font_display` stb.) — egységes `--kebab-case` CSS custom
property névre normalizálva, hogy a stíluslapokban egyetlen konvenciót
kelljen ismerni. Alkalmazva a host, csapat és TV felület gyökér elemén
inline style-ként.

**Betűtípus-betöltés — tudatos MVP-korlát:** a seedelt téma három Google
Fontot vár el, ezek statikusan be vannak linkelve a `src/app.html`-ben. A
rendszer nem tölt be dinamikusan tetszőleges betűtípust a
`design_tokens`-ből — egy admin által felvitt, más betűtípust megadó téma a
böngésző alapértelmezettjére esik vissza. Egy teljesen dinamikus Google
Fonts betöltő külön feature lenne, nem indokolt egyetlen seedelt témánál.

Admin CRUD (`/admin/design-themes`): a token-készletet szabad JSON
textarea-val szerkeszti (nem fix mezőkkel) — szándékos, mert a
`design_tokens` séma explicit célja a séma-módosítás nélküli bővíthetőség,
amit egy fix-mezős form elvenne. Az alapértelmezett téma nem törölhető sem
a lista, sem a szerkesztő oldalról (mindkét delete action ellenőrzi).

**Hangeffektek — sandbox-korlát, tudatos döntés:** ebben a sandboxban nincs
mód valódi hangfájlokat beszerezni vagy tesztelni (nincs audio-asset
pipeline, a kimenő HTTPS is korlátozott). `src/lib/audio/sfx.ts` ezért Web
Audio API oszcillátorokkal generált, rövid szintetikus hangokat használ
(tick, lejárat-búgás, helyes/helytelen dallam, joker power-up, ranglista-
fanfár) — nulla extra asset, nulla hálózati függés. Ez konzisztens a projekt
korábbi, hasonló környezeti korlátokról szóló döntéseivel (pl. a Fázis 5-ös
Edge Function → RPC váltás).

**TV felület** (`/tv/[game_id]`): broadcast-vezérelt, prioritásos
állapotgép (final leaderboard → round leaderboard → reveal → kérdés+timer →
lobby → záró képernyő), ugyanazt az anon hozzáférési szintet használja, mint
a csapat kliens — **szándékosan nincs role-alapú route guard rajta**: az URL
a `games.id` UUID-t tartalmazza (nem kitalálható), és a megjelenített adat
ugyanaz, amit a csapatok a saját telefonjukon is látnak. Ugyanaz a "de facto
tulajdonjog egy ismert UUID-n keresztül" biztonsági szint, mint amit a
projekt a `team_answer_result`/`team_joker_uses` RPC-knél már korábban is
tudatosan elfogadott. Presence a lobby élő csapatszámlálójához (host-mintát
követve: nem `track()`-el). A host lobby nézete "Kivetítő megnyitása"
linket kapott.

**Animáció:** Svelte beépített `fly`/`fade`/`scale` átmenetek a
kérdésváltásnál, a feltárásnál és a ranglisták staggered belépésénél — host,
csapat és TV felületen egyaránt, nem igényelt külső animációs könyvtárat.

Ellenőrzés: `npm run check`/`build`/`lint` mind tiszta; a design_themes RLS
és a single-default trigger SQL-lel ellenőrizve valós adatbázis ellen
(teszt-adatok törölve). A böngészős animáció/hang/vizuális megjelenés
élőben ebben a sandboxban nem tesztelhető (HTTPS-blokk) — kódszinten
ellenőrizve (típusellenőrzés, build), valós böngészős kipróbálás a
felhasználó felelőssége marad, mint minden korábbi fázisban.

Dokumentáció: `docs/features/design-themes.md` (új), `docs/features/tv-mode.md`
(új), `docs/architecture/DATA_MODEL.md` implementációs jegyzetek a 7. és 8.
szakaszban, `docs/architecture/REALTIME_PROTOCOL.md` frissítve (TV Presence-
minta, TV kliens-teendők a `question_show`/`timer_start`/`game_finished`
eseményeknél).

## 2026-08-08 — Fázis F0: Style guide + komponens-könyvtár (NEXT_STEPS.md előfeltétele)

A `main`-re felkerült `NEXT_STEPS.md` (a `PROJECT_REVIEW.md` alapján írt
roadmap) F–L fázisai egy `docs/design/STYLE_GUIDE.html`-re és egy
"Fázis 3-ban létrehozott komponens-könyvtárra" hivatkoznak mint már meglévő
alapra — egyik sem létezett a repóban (a tényleges Fázis 3 a PIN/QR/lobby
flow volt, nem egy komponens-könyvtár; `src/lib/components/` eddig csak a
`QuestionForm.svelte`-t tartalmazta). Rákérdeztem a felhasználónál — a
válasz: építsem fel nulláról, a már meglévő `design_themes` token-rendszerre
(Retro Arcade paletta) alapozva, mint az F–L fázisok tényleges alapja.

`docs/design/STYLE_GUIDE.html`: önálló, statikus HTML referencia (nem
SvelteKit route) — színpaletta-szerepek táblázata, tipográfia-specimenek,
"arcade panel" minta (scanline textúra), és a komponens-könyvtár élő
demója. A tokenek hardcode-olva vannak benne a seed pontos értékeivel
(`supabase/migrations/20260808123000_design_themes.sql`) — ha a seed
változik, ezt is frissíteni kell, dokumentálva a fájl fejlécében.

`src/lib/components/`: `Button` (primary/secondary/danger/ghost, `href`
esetén linkként renderel), `ChoiceButton` (válasz-opció, selected állapot),
`TimerRing` (SVG körvisszaszámláló, `low` állapot ≤5 mp-nél pulzáló
`--danger`-re vált — ugyanaz a küszöb, mint a Fázis 6 `sfx.ts`
`playTick()`-jénél), `PinDisplay`, `TeamChip`, `PodiumCard` (top 3-nál
érem-emoji), plusz `Input`/`Select`/`Checkbox` form-primitívek (a Fázis H
és a leendő admin form-ok — B, C — előre láthatóan igényelni fogják).
Minden komponens a legközelebbi ős `.cabinet`/token-`style` elemtől örökli
a CSS custom property-ket, nincs saját beépített színkészletük.

`docs/architecture/DESIGN_SYSTEM.md` (új): szín-szerepek, tipográfia-
szabályok, arcade panel minta, komponens API-referencia — ez a dokumentum
bővül tovább a G/H/J fázisokban (töréspontok, konzisztencia-jegyzetek,
kontraszt/fókusz konvenciók).

## 2026-08-08 — Fázis F: Globális layout héjak felületenként

`/admin` (`src/routes/admin/+layout.svelte`): sidebar + hamburger-menü
mobilon, most már a Retro Arcade vizuális témával (`getActiveTokens(supabase,
null)` — az admin nincs `games` sorhoz kötve, mindig az alapértelmezett
témát kapja). A sidebar mutat a még meg nem épült Felhasználók/Beállítások/
Riportok oldalakra is (nem törött link, placeholder tartalom) — a
Felhasználók/Beállítások `role_id = 1`-re szűkítve jelenik meg a menüben
(a route-guard is ezt kényszeríti ki), a Riportok mindenkinek.

Három új placeholder route jött létre a sidebar linkjeihez:
`/admin/users`, `/admin/settings` (mindkettő `role_id = 1` guard-dal — az
`/admin` layout guard-ja 1,2-re tágabb, ez a szűkítés a route-hoz kötve
él), és `/reports` (önálló, top-level route, `role_id in (1,2,3,4)`
guard-dal — ez a `viewer` szerepkör egyetlen jelenleg elérhető felülete).
Mindhárom tényleges tartalma Fázis B/C/D feladata.

`/host/[game_id]`: minimális header (`+layout.svelte`) — este címe,
PIN-jelvény, kör/kérdés progress, kapcsolat-állapot jelző, "Kilépés" link.
A `game`/`rounds`/`designThemes` betöltés Fázis 4 óta a page saját
`load`-jában élt — Fázis F-ben átkerült a `+layout.server.ts`-be, mert a
header ugyanezt az adatot használja (a `[game_id]/+page.server.ts`
`git mv`-vel lett `+layout.server.ts`, elkerülve a duplikált DB-lekérdezést
és a történet elvesztését). A header viszont két adatra is rászorul, ami
kizárólag a page kliens-oldali állapotában létezik (a `roundQuestions`
lista hossza/indexe, illetve a realtime channel `subscribe()`
callback-jének állapota) — ezekhez Svelte context hidalja át a page → layout
irányt (`src/lib/realtime/connection-status.svelte.ts`,
`src/lib/realtime/host-progress.svelte.ts`), mivel SvelteKit-ben a layout
nem kaphat propot a gyerek page-től, csak context-en keresztül.

`/play/[pin]` és `/tv/[game_id]`: **tudatosan nem kaptak külön layout
héjat.** A terv mindkettőnél megengedi a "nincs header" opciót — a
csapat felület már eleve csak egy vékony `<h1>`-et mutat, a TV már eleve
teljesen immerzív. Egy újabb `+layout.svelte` bevezetése itt csak
duplikálná a meglévő megoldást, funkcionális nyereség nélkül.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` "Layout héjak
felületenként" szakasz.

## 2026-08-08 — Fázis G: Reszponzív audit

Kód-szintű audit (típusellenőrzés + CSS kézi átolvasás) mind a négy
felületen — a sandbox HTTPS-blokkolása miatt élő böngészős méréssel
nem lehetett ellenőrizni, ez a felhasználó feladata marad.

- `/play/[pin]` + `/play` (PIN-beviteli oldal): minden interaktív elem
  (válasz-gombok, csúszka, sorrendező lista, submit/joker gombok)
  explicit `min-height: 44px`-et kapott az érintési célpont-méret miatt —
  korábban a `padding`-re hagyatkoztak, ami a submit/joker gomboknál
  ~35px-es tényleges magasságot adott volna, a 44px ajánlás alatt. A
  csúszka thumb-ja felnagyítva touch-hoz. A PIN-beviteli oldal
  (`/play/+page.svelte`) korábban **egyáltalán nem kapott vizuális témát**
  (egyszerű böngésző-alap stílus volt) — ez a felhasználó első érintkezése
  az alkalmazással, ezért a reszponzív audit része lett a `main.cabinet`
  minta + touch-friendly gomb/input bevezetése is, konzisztensen a
  csatlakozás utáni oldallal.
- `/host/[game_id]`: gomb és select touch-célpont javítva (`min-height:
44px`), a header (Fázis F) `flex-wrap`-je már eleve véd keskenyebb
  ablakok ellen.
- `/admin`: a Fázis F-ben épült mobil hamburger-menü kiegészítve
  háttér-elsötétítéssel (kattintásra zár) és navigációkor automatikus
  záródással — korábban csak a hamburger gombbal lehetett bezárni.
- `/tv/[game_id]`: a `clamp()`-es fluid tipográfia felső határai
  megemelve (pl. a kérdés-prompt 3rem→4.5rem-re) — a terv explicit
  elvárása szerint 1920×1080-as kivetítőn, 3-5 méteres távolságból is
  olvashatónak kell lennie, a korábbi értékek ehhez képest óvatosak
  voltak.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` "Töréspontok és
reszponzív konvenciók" szakasz, a módszertani korlát (kód-szintű, nem élő
böngészős audit) explicit dokumentálásával.

## 2026-08-08 — Fázis H: Komponens-konzisztencia audit

Végigsöpörve minden felület minden oldala, a nyers HTML-elemek és
kézzel írt hex-színek helyett a Fázis F0-ban épült komponens-könyvtár
(`Button`, `ChoiceButton`, `TimerRing`, `PinDisplay`, `TeamChip`,
`PodiumCard`, `Input`, `Select`, `Checkbox`) és `var(--token)` hivatkozások.
Új komponens: `Textarea.svelte` (label + textarea, `monospace` prop a
`--font-led`-hez) — ez a Fázis H során ténylegesen ismétlődő mintaként
merült fel (kérdés-prompt, vizuális téma JSON-szerkesztő), ezért indokolt
volt bővíteni vele a könyvtárat, a `question_type_id` select-et és az
egyetlen `true_false` rádiógomb-párt viszont tudatosan nem absztraháltuk
(lásd `DESIGN_SYSTEM.md`).

Útközben előkerült egy Fázis F-es regresszió: 10 admin al-oldal duplikált
`<main>` landmarkot tartalmazott, mert saját `<main>`-jük megmaradt azután
is, hogy a Fázis F-es `/admin/+layout.svelte` már burkolta őket egy
`<main class="admin-content">`-ba. Javítva mind a 10 oldalon.

Emellett: `/login/+page.svelte` egy redundáns `createSupabaseBrowserClient()`
hívást használt a többi oldaltól eltérően (amik a gyökér `+layout.ts`
által biztosított `data.supabase`-t használják) — ez a Fázis H sweep alatt
került elő, most már ez az oldal is `data.supabase`-t használ.

Minden érintett fájl `npm run check` (0 hiba/figyelmeztetés), `npm run
lint` és `npm run build` ellenőrzéssel lezárva. Élő böngészős vizuális
ellenőrzés — a sandbox HTTPS-blokkolása miatt — itt sem történt, ez
továbbra is a felhasználó feladata marad.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` "Komponens-konzisztencia
audit (Fázis H)" szakasz + a komponens-könyvtár táblázat kiegészítve
`Textarea`-val és a hiányzó propokkal.

## 2026-08-08 — Fázis I: Játékélmény polírozás

Új függőség: `canvas-confetti` (+ `@types/canvas-confetti`) — kicsi,
függőségmentes, nincs értelme saját konfetti-rendszert építeni.

- **Konfetti**: `src/lib/effects/confetti.ts` (`fireWinnerConfetti()`),
  bekötve a `round_leaderboard_reveal`/`final_leaderboard_reveal`
  eseményekbe. `/tv/[game_id]`-n mindig elsül (publikus, közös kijelző);
  `/play/[pin]`-en csak akkor, ha a saját csapat lett az 1. helyezett —
  pontosan a terv előírása szerint.
- **Újracsatlakozás állapot**: új `ReconnectOverlay.svelte` komponens
  (megosztott, mert `/play/[pin]` és `/tv/[game_id]` szó szerint ugyanazt
  az UI-t igényelte), `TimerRing.svelte` új `inactive` propja (szürke,
  forgó, számláló-szöveg nélküli variáns). Mindkét felület helyi
  `connectionStatus` állapotot tart a channel `subscribe()`
  callback-jéből, ugyanazt a mintát követve, mint a `/host/[game_id]`
  Fázis F-es `ConnectionStatusStore`-ja (itt viszont nincs megosztott
  header, tehát nem context, hanem helyi `$state`).
- **Üres állapotok**: `/admin/questions` szűrő 0 találattal — "Nincs
  kérdés ebben a témában." + "Szűrő törlése" link, megkülönböztetve az
  általános "Még nincs kérdés."-től. A lobby 0-csapatos üres állapota már
  megvolt korábbi fázisokból. A riport-oldal "0 lezárt este" állapota
  **tudatosan elhalasztva Fázis D-re** — a `/reports` jelenleg placeholder,
  egy üres állapotot egy még nem létező lista fölé építeni értelmetlen
  munka lenne.
- **Betöltés-állapotok / villanás-javítás**: a `themeCss` kezdőértéke
  mind a 8 érintett fájlban (`/`, `/login`, `/play`, `/play/[pin]`,
  `/host/[game_id]`, `/tv/[game_id]`, `/admin` layout, `/reports`) `''`
  helyett `tokensToCssText(defaultTokens)` — az async `getActiveTokens()`
  Supabase-hívás visszatéréséig a helyes alapértelmezett színekkel
  render-el, nem stílus nélkül. `/host/[game_id]`: a `roundQuestions`
  betöltése alatt "Kérdések betöltése…" felirat a "Kérdés 1 / 0"-szerű
  villanás helyett.

Módszertani korlát (ismételten): a sandbox HTTPS-blokkolása miatt ez a
fázis is kód-szintű maradt — `npm run check`/`lint`/`build` ellenőrzéssel,
élő böngészős vizuális/audio teszt nélkül.

Dokumentáció: új `docs/features/game-experience-polish.md`,
`docs/architecture/DESIGN_SYSTEM.md` komponens-könyvtár táblázat
kiegészítve a `TimerRing` új `inactive` propjával és a
`ReconnectOverlay.svelte`-vel.

## 2026-08-08 — Fázis J: Akadálymentesség és kontraszt átvizsgálás

**Módszertani előrelépés:** kiderült, hogy a Supabase MCP szerver
(`mcp__Supabase__*` eszközök) **nem** a sandbox blokkolt HTTPS-proxyján
megy keresztül — külön, működő csatorna. Ez nem oldja fel az élő
böngészős tesztelés korlátját (egy böngészőben futó app JS-kódja
továbbra sem éri el a `*.supabase.co`-t innen), de élő DB-lekérdezést és
migráció-alkalmazást lehetővé tesz. Megerősítve: a `wnmgilblkdqunhpwoulj`
("PubQuiz") projekt a repo `.env`-jében szereplő éles projekt.
Emellett a `docs/design/STYLE_GUIDE.html` Supabase-mentes statikus
fájl — ezen egy tényleges Chromium + `axe-core` (Playwright, előre
telepítve a sandboxban) audit futott, nem csak kód-átolvasás.

- **Kontraszt (axe-core + kézi WCAG-számítás minden token-párra):** 1
  valódi hiba — `Button.svelte` `.primary` (natúr `--violet` háttér,
  3.5:1) — és két, csak kézi számítással előkerült hover-állapotbeli hiba
  (`.primary:hover` natúr `--magenta`, 2.9:1; `.danger:hover` natúr
  `--danger`, 2.8:1; a `/play/[pin]` joker-gomb saját hover-felülírása
  ugyanezt a hibát duplikálta). Javítás: a háttér-színt
  `color-mix(in srgb, var(--token) 65-80%, var(--cabinet[-2]))`-vel
  sötétítettük a Button.svelte-ben — a token maga változatlan (a
  border/glow felhasználásoknál a fényesebb szín marad). Axe-core
  megerősítette: 1 violation → 0 violation.
- **`/play/+page.svelte` (PIN-beviteli oldal):** menet közben kiderült,
  hogy ez volt az egyetlen oldal, ami Fázis H után is natúr
  `<input>`/`<button>`-t használt (a Fázis H-s összefoglalóban ez
  nyitott pontként szerepelt) — most átalakítva `Input`/`Button`-ra,
  ezzel automatikusan örökölve a kontraszt-javítást is. Az `Input.svelte`
  kapott két új propot (`inputmode`, `pattern`) a numerikus PIN-mezőhöz.
- **Fókusz-állapotok:** a könyvtáron kívül maradt natív elemek
  (`QuestionForm.svelte` `question_type_id` select + `true_false`
  rádiógombok, `/play/[pin]` csúszka + sorrendező lista) mind kaptak
  explicit `--cyan` `:focus-visible` gyűrűt.
- **Sorrendező lista — új billentyűzet-hozzáférés:** eddig kizárólag
  egérrel/érintéssel volt húzható-átrendezhető — egy teljes kérdés-típus
  volt elérhetetlen billentyűzettel. Pótolva: `tabindex="0"` + `↑`/`↓`
  nyíl-kezelő minden listaelemen (a meglévő `reorder()` függvényt hívja),
  `role="listbox"`/`role="option"` (a Svelte a11y linter natúr `<li>`-re
  nem enged keyboard handlert), `aria-label` a pozícióval és a kezeléssel.
- **Érintési célpontok:** a megosztott `Button.svelte` **soha nem
  kapott** `min-height`-et — ez Fázis G-ben a régi natúr `<button>`-ökön
  még megvolt, de Fázis H-ban a `Button` komponensre cserélve némán
  elveszett (padding vizuálisan elég közel volt hozzá, senki nem vette
  észre). Pótolva `min-height`/`min-width: 44px`-cel — minden felületet
  érinti. Csúszka thumb `28px` → `44px`.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "Kontraszt és
fókusz-konvenciók (Fázis J)" szakasz, `docs/design/STYLE_GUIDE.html`
frissítve a javított `.btn.primary` háttérrel és `min-height`/`min-width`-szel.

## 2026-08-08 — Fázis K: Vizuális QA a STYLE_GUIDE.html alapján

Tételes összevetés a `docs/design/STYLE_GUIDE.html` referencia és a
tényleges `src/lib/components/*` + `/admin`/`/host`/`/play`/`/tv`
implementáció között (kód-szintű, plusz a Fázis J-ben megismert
axe-core-os ellenőrzés magára a STYLE_GUIDE.html-re). Talált és javított
eltérések:

- **Hardcode-olt hex szín**: `QuestionForm.svelte` `.error { color:
#b91c1c }` — nem a token-rendszerből jött, `var(--danger)`-re cserélve.
  Ez volt az **egyetlen** hardcode-olt hex az egész `src/`-ben (ellenőrizve
  `grep`-pel).
- **Hiányzó scanline a PIN/QR panelen**: a `PinDisplay.svelte` csak a
  keretet/hátteret örökölte az "arcade panel" mintából, a scanline
  `::before` réteg soha nem került bele (Fázis F0-s mulasztás). Pótolva.
- **A kérdés-kártya sosem létezett ténylegesen**: a STYLE_GUIDE.html
  "Arcade panel" demója kifejezetten a kérdés-promptot mutatja be neon-
  kerettel + scanline-nal, de a valóságban `/host`, `/play/[pin]` és `/tv`
  a kérdés-promptot sosem csomagolta be semmilyen panelbe — csupasz
  szöveg volt a háttér-gradiensen. Új, megosztott `ArcadePanel.svelte`
  (mert a minta pontosan ugyanúgy ismétlődik mindhárom felületen — ez a
  "csak akkor absztrahálunk, ha tényleg ismétlődik" elv tankönyvi esete),
  bevezetve mindhárom helyen.
- **`--magenta` dokumentált szerepe elavult volt**: a színszerep-táblázat
  (STYLE_GUIDE.html + DESIGN_SYSTEM.md) még Fázis F0 óta "Joker,
  elsődleges gomb hover" feliratot viselt, de a joker gomb Fázis H óta
  ténylegesen `--coin`/`--danger` kombót használ (tudatos döntés,
  dokumentálva is volt a Fázis H bejegyzésben) — csak a szín-szerep
  táblázat nem lett frissítve. Javítva mindkét dokumentumban, és
  hozzáadva egy tényleges joker-gomb demó a STYLE_GUIDE.html-hez (eddig
  ez sem volt benne).
- **Hiányzó PinDisplay demó**: a STYLE_GUIDE.html "Komponensek"
  szakaszában soha nem volt `PinDisplay` demó (Button, ChoiceButton,
  TimerRing, TeamChip, PodiumCard igen) — pótolva.
- **`PodiumCard` vs. arcade-panel szöveg pontosítva**: az "Arcade panel"
  szakasz szövege (mindkét dokumentumban) korábban explicit
  "ranglista-kártya"-ként sorolta fel az arcade-panel egyik
  alkalmazásaként, holott a `PodiumCard` már a STYLE_GUIDE.html saját
  demójában is a rangsor-alapú keretszínezést használja (nem
  `--violet`/scanline). Ez nem kód-hiba, csak dokumentáció-pontatlanság
  volt — javítva, és explicit rögzítve, hogy ez tudatos UX döntés, nem
  elkanyarodás.

Axe-core megerősítette: a STYLE_GUIDE.html minden módosítás után is 0
violation. Az `ArcadePanel`/`PinDisplay` változtatások élő böngészős
vizuális hatását — a `/host`/`/play`/`/tv` oldalak Supabase-függősége
miatt — a felhasználónak kell ellenőriznie éles böngészőben.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` "Arcade panel" szakasz
átírva + `ArcadePanel.svelte` felvéve a komponens-könyvtár táblázatba,
`--magenta` szerep-leírás javítva; `docs/design/STYLE_GUIDE.html` PinDisplay

- joker-gomb demóval és a javított szövegekkel/CSS-sel kiegészítve.
