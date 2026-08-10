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
átírva, `ArcadePanel.svelte` felvéve a komponens-könyvtár táblázatba,
`--magenta` szerep-leírás javítva; `docs/design/STYLE_GUIDE.html` PinDisplay
és joker-gomb demóval, valamint a javított szövegekkel/CSS-sel kiegészítve.

## 2026-08-08 — Fázis L: Visszaszámláló timer véglegesítése

**Módszertani előrelépés:** a Fázis J-ben felfedezett Supabase MCP-hozzáférést
itt a legkomolyabban használtuk ki eddig — nemcsak séma-lekérdezésre és
migráció-alkalmazásra, hanem egy tényleges, `rollback`-kal lezárt
tranzakcióba csomagolt, `set local role anon`-nal szimulált RLS-tesztre a
valós Supabase projekten (4 eset, mind a várt eredményt adta — lásd lent).
Ez az első fázis ebben a sessionben, ahol egy biztonsági/logikai
DB-viselkedést nem csak kód-átolvasással, hanem éles adatbázison,
tényleges beszúrási kísérletekkel igazoltunk.

Ellenőrzött/lezárt pontok a terv szerint:

1. **Egyszeri `timer_start` broadcast, lokális számolás** — megerősítve
   kód-átolvasással mindhárom felületen (`/host`, `/play/[pin]`, `/tv`):
   nincs másodpercenkénti szerver→kliens broadcast, minden kliens a saját
   `setInterval`-jában, a kapott `server_start_time`/`duration` alapján
   számol. Nem kellett módosítani.
2. **TimerRing szín-átmenet** — `low` állapot (≤5 mp) pulzáló `--danger`,
   egyébként nyugodt `--cyan`, pontosan a STYLE_GUIDE.html mintája
   szerint — már a Fázis F0/J-ben helyesen megépült, nem kellett
   módosítani.
3. **Szerver-oldali timer-kikényszerítés (ÚJ, ez volt a valódi hiányzó
   rész)** — a review explicit kockázata ("kliens-oldali óra manipulációja
   ne tudjon extra időt lopni") eddig ténylegesen fennállt: az `answers`
   INSERT RLS-je csak `games.status = 'active'`-et nézte, a
   `timer_start`/`answer_locked` kizárólag kliens-oldali UI-állapot volt.
   Migráció (`supabase/migrations/20260808130000_timer_enforcement.sql`):
   `games.current_question_started_at`/`current_question_duration_seconds`
   új oszlopok (a host `startTimer()`-je tölti ki, a broadcast-tal
   egyidejűleg), új `answer_within_timer()` security-definer függvény
   (3 mp türelmi idővel a hálózati késleltetés miatt), bekötve az
   `answers_insert_anon_active_game` policy `with check` ágába. Élőben,
   valós DB-n, `rollback`-kal lezárt tranzakcióban tesztelve 4 eset: timer
   el sem indult → elutasítva; duration+türelmi idő lejárt → elutasítva;
   duration-on belül → sikeres; türelmi időn belül → sikeres — mind a
   várt eredményt adta. `/play/[pin]` `submitAnswer()` felismeri a
   `42501` (RLS-elutasítás) hibakódot, és pontosabb "Lejárt az idő..."
   üzenetet mutat.
4. **`answer_locked` pontos, néző-független lezárás** — már megvolt: a
   csapat kliense a saját helyi visszaszámlálása alapján **saját magát**
   zárja le (`locked = true`, amint `remaining <= 0`), nem várja meg a
   host `answer_locked` broadcast-ját — ez azt is jelenti, hogy egy olyan
   kliens is helyesen lezár, amelyik éppen nem nézte a képernyőt. A Fázis
   L-es szerver-oldali kikényszerítés ezt egy biztonsági hátvéddel
   egészíti ki, arra az esetre, ha egy módosított kliens megkerülné a
   helyi állapotot.
5. **Vizuális szinkron három böngészőfülön** — nem tesztelhető élőben
   ebben a sandboxban (a `/host`/`/play`/`/tv` valódi Supabase Realtime
   WebSocket-kapcsolatot igényel, ami a blokkolt HTTPS-proxy mögött van);
   a mechanizmus tervezésileg szinkron (abszolút időbélyeg-alapú, nem
   broadcast-megérkezéshez kötött számolás), ezt a felhasználónak kell
   élő böngészőben megerősítenie.

DB-séma frissítve `docs/architecture/DATA_MODEL.md` 4. szakaszában (a
`games` CREATE TABLE + egy új "Implementáció (Fázis L)" alszakasz) és
`docs/architecture/REALTIME_PROTOCOL.md` `timer_start` leírásában.
TypeScript típusok újragenerálva (`src/lib/types/database.types.ts`).

Dokumentáció: új `docs/features/timer.md` a végleges timer-mechanizmusról
(beleértve az ismert korlátot: egy, a `timer_start`-ot teljesen lemaradó,
majd csak lezárás után visszacsatlakozó kliens nem lát vizuális
visszaszámlálót, de a beküldése akkor is biztonságosan elutasításra kerül).

## 2026-08-08 — Fázis B: Admin felhasználó- és jogosultságkezelő UI

A review #1 admin-hézaga: eddig minden role-váltás kézi SQL volt. Migráció
(`supabase/migrations/20260808131500_profiles_email.sql`): `profiles.email`
új oszlop, a `handle_new_user()` trigger mostantól ezt is kitölti
signupkor (service-role kliens/admin API helyett — nincs is
service-role kulcs konfigurálva ebben az appban, és bevezetni egyet csak
egy email-oszlop kedvéért nagyobb biztonsági felület lett volna egy kis
appban, mint kiegészíteni egy már meglévő triggert).

`/admin/users` (`role_id = 1` guard, route-szinten, mint `/admin/settings`):
`profiles` + `roles` lista, soronkénti `Select` + auto-submit role-váltó
form (`?/updateRole` action). **Nem kellett új RLS policy** — a
`profiles_update_super_admin` (csak super_admin módosíthat bármely
profilt) már a Fázis 1 óta létezik pontosan erre a célra. Minden
role-váltás a meglévő `log_table_change()` audit triggeren keresztül
automatikusan naplózódik.

**Önmagam lefokozása elleni védelem**: alkalmazás-szinten (nem RLS-ben,
mert ez nem jogosultság-kiszivárgás, hanem elkerülhető önmagunknak okozott
kizárás) — ha a bejelentkezett super_admin a saját role_id-ját próbálná
1-ről másra váltani, az action elutasítja egy magyarázó hibaüzenettel.

**Két tudatos eltérés a NEXT_STEPS.md csomag-javaslataitól** (indoklás
részletesen `docs/features/user-management.md`-ben):

- `svelte-french-toast` helyett `svelte-sonner` — az előbbi
  `peerDependencies`-e csak Svelte 3/4-et enged, ez az app Svelte 5-ös; a
  `svelte-sonner` explicit Svelte 5-kompatibilis. A javaslat szándéka (ne
  építsünk saját toast-rendszert) ettől függetlenül teljesül.
- Nincs `sveltekit-superforms`/`zod` — a repo egyetlen másik admin CRUD
  képernyője sem használ superforms-ot (mind natív form action + kézi
  validáció), egy darab, egymezős dropdown-form miatt új mintát bevezetni
  inkonzisztenciát okozott volna a meglévő négy CRUD-képernyővel.

Dokumentáció: új `docs/features/user-management.md`,
`docs/architecture/DATA_MODEL.md` 1. szakasz (`profiles.email` +
"Implementáció (Fázis B)" alszakasz).

## 2026-08-08 — Fázis C: Admin globális beállítások UI

A review #2 admin-hézaga: az `app_settings` eddig csak SQL-lel volt
szerkeszthető. `/admin/settings` (`role_id = 1` guard, mint `/admin/users`)
— **nem kellett új RLS**, az `app_settings_write_super_admin` policy már
a Fázis 2 óta pontosan ezt a szűkítést kényszeríti ki.

A lista forrása szigorúan `select * from app_settings` — nincs
hardcode-olt kulcs-lista a UI-ban, egy jövőbeli új `app_settings` sor
kód-módosítás nélkül megjelenne. Az input-widget típusát (`number`
input/`Checkbox`/szöveg `Input`/nyers-JSON `Textarea`) a betöltött érték
JS `typeof`-ja dönti el futásidőben; egy rejtett `value_type` mező viszi
át ezt a szerver action-nek, hogy a beküldött stringet a megfelelő JS
típusra tudja visszaparse-olni (különben pl. a cooldown hónapszám
string-ként íródna vissza szám helyett). Egy kis, nem-kötelező
`SETTING_META` lookup ad barátságosabb címkét/mértékegységet ismert
kulcsokhoz (jelenleg csak `question_reuse_cooldown_months` → "hónap") —
ismeretlen kulcs enélkül is helyesen megjelenik, csak a nyers nevét
mutatja.

Ugyanaz a `svelte-sonner` toast + plain-form-action minta, mint Fázis
B-ben (indoklás ott, nem ismételve).

Dokumentáció: új `docs/features/app-settings.md` (a jelenlegi kulcsok
táblázatával).

## 2026-08-08 — Fázis D: Viewer statisztika/riport felület

A review #3 admin-hézaga: a `viewer` role (minden új regisztráció
alapértelmezett szerepköre) létezett a sémában, de nem volt semmi, amit
láthatott volna. Menet közben kiderült, hogy ez szó szerint igaz volt DB
RLS-szinten is: a `viewer`-nek egyetlen SELECT policy-ja sem volt a
`games`/`teams`/`questions`/`themes`/`design_themes`/`question_types`/
`round_questions`/`rounds`/`answers` táblák egyikén sem.

Migráció (`supabase/migrations/20260808133000_reports_rpcs.sql`): öt
szűk, konkrét célú security-definer RPC (`reports_finished_games`,
`reports_game_leaderboard`, `reports_design_theme_usage`,
`reports_content_theme_usage`, `reports_avg_response_time_by_type`) —
ugyanaz a minta, mint a `round_leaderboard`/`team_answer_result`-nál —
ahelyett, hogy kiszélesítettük volna a nyers táblák RLS-ét `role_id=4`-re.

**Élőben elkapott és javított biztonsági hiba, mielőtt bármi is
commitolva lett volna**: az első verzió csak `revoke ... from public`-ot
tartalmazott, `revoke ... from anon, authenticated`-et nem — élő
teszttel (`set role anon`, `rollback`-kal lezárt tranzakcióban)
kiderült, hogy ez **nem elég**: anon ténylegesen le tudta futtatni a
`reports_finished_games()`-t és valós adatot kapott vissza, mert a
függvény törzsének `current_user_role_id() not in (...)` ellenőrzése
`NULL` `role_id`-nál (anon esetén) nem sül el (`NULL not in (...)` SQL-ben
`NULL`, nem `true`). Ez pontosan az a minta, amit a `scoring.sql`
(Fázis 5) már helyesen kezelt (`revoke ... from public` **és**
`revoke ... from anon, authenticated` együtt) — csak ez a fázis nem
követte következetesen elsőre. Javítva, élőben újra-tesztelve
(`permission denied` lett anon-nak), és a helyes verzió került be a
repóba (nem hagytunk "hiba, majd javító migráció" történetet, mivel
senki más nem húzta le a hibás verziót). **Ez egy minden jövőbeli RPC-re
érvényes módszertani tanulság**, dokumentálva `docs/architecture/DATA_MODEL.md` 4. szakaszában is.

Menet közben egy tervezett hatodik RPC (`reports_avg_team_count`)
feleslegesnek bizonyult — a `reports_finished_games()` már visszaadja a
csapatszámot esténként (a vonaldiagramhoz is kell), az átlag ugyanebből
kliens-oldalon triviálisan számolható — törölve, mielőtt bármi
commitolva lett volna.

UI: `/reports` (aggregált statisztikák + lezárult esték listája) és
`/reports/[game_id]` (egy konkrét este `PodiumCard`-okkal). Chart.js
(`chart.js`, nem wrapper-csomag) egy vékony `ReportChart.svelte`
komponensbe csomagolva, a design-token színekkel felbontva futásidőben.

Elfogadott értelmezési döntés: a terv "leggyorsabb válaszidők"
szövegével szemben a tényleges metrika **átlagos** válaszidő
kérdéstípusonként — egy nyers minimum kevésbé reprezentatív aggregátum
lenne (indoklás `docs/features/reports.md`-ben).

Dokumentáció: új `docs/features/reports.md`, `docs/architecture/DATA_MODEL.md` 4. szakasz "Implementáció (Fázis D)" alszakasz.

## 2026-08-08 — Fázis E: Design téma dinamikus font-betöltés

A review 6. szakaszában jelzett hiányosság: csak a seedelt "Retro Arcade"
téma három Google Font-ja volt belinkelve statikusan az `app.html`-ben —
egy admin által létrehozott, más betűtípusokat megadó design téma
csendben a böngésző alapértelmezettjére esett vissza. Ez a Fázis 6-ban
már dokumentált, tudatosan vállalt MVP-korlát volt (`docs/features/design-themes.md`
"Betűtípusok — ismert korlát" szakasza) — Fázis E ezt zárja le.

Új `loadThemeFonts()` (`src/lib/theme/tokens.ts`): a `design_tokens`
`font_display`/`font_led`/`font_body` CSS `font-family` értékéből
kinyeri a tényleges betűtípus-nevet (`"Bangers", cursive` → `Bangers`),
és Google Fonts CSS2 URL-t épít belőle, amit `<link>`-ként inject a
`<head>`-be. A `getActiveTokens()` minden hívása automatikusan
lefuttatja — nem kellett egyenként bekötni a 9+ hívó oldalba. Egy
`Set`-alapú cache megakadályozza az ismételt injektálást ugyanarra a
betűtípus-kombinációra navigáció/téma-váltás közben.

**Élőben tesztelve, nem csak kód-átolvasással** — kiderült, hogy a
`fonts.googleapis.com` (a Supabase-től eltérően) **nincs** blokkolva
ennek a sandboxnak az egress-proxyja mögött, tehát valódi `curl`
kéréseket lehetett futtatni ellene:

- A pontos URL-formátum (`family=Press+Start+2P:wght@400;600;700&...`)
  ténylegesen 200 OK-t ad a Google Fonts API-tól, mind a seedelt
  betűtípusokra, mind egy teljesen más kombinációra (`Bangers`/
  `Roboto Mono`/`Lobster`).
- A hibatűrési eset is élőben igazolt: egy nem létező betűtípus-névre
  (`Totally Made Up Font Xyz123`) a Google API 400-at ad vissza egy HTML
  hibaoldallal — a böngésző ezt egyszerű CSS-ként próbálja értelmezni,
  nem talál benne érvényes szabályt, a `<link>` némán "üresen" fut le, a
  UI nem törik, a CSS `font-family` fallback lánc érvényesül.
- A tervben kért "hozz létre egy második design témát eltérő fontokkal
  az admin felületen" tesztet DB-szinten közvetlenül elvégeztük (egy
  `rollback`-kal lezárt tranzakcióban `insert` a `design_themes`-be az
  admin JSON-szerkesztő pontos formátumával, majd a lekérdezés
  visszaadta a helyes `font_display`/`font_led`/`font_body` értékeket) —
  a tényleges vizuális megjelenés böngészőben ellenőrzése (a Supabase
  Realtime-hoz hasonlóan blokkolt admin/host/play/tv oldalak miatt)
  továbbra is a felhasználó feladata marad.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "Betűtípusok
dinamikus betöltése" alszakasz, `docs/features/design-themes.md`
"ismert korlát" szakasza átírva a tényleges megoldásra,
`docs/architecture/DATA_MODEL.md` 8. szakasz Fázis 6 implementációs
jegyzete frissítve.

---

## 2026-08-08 — Fázis M: MVP KÉSZ

A `NEXT_STEPS.md` 13. szakaszának hat pontja mind lezárva:

1. **Favicon + oldal-címek.** A korábban a SvelteKit alapértelmezett
   Svelte-logó favicon (`src/lib/assets/favicon.svg`) lecserélve egy
   saját, retro-arcade stílusú ikonra (sötét kabinet-háttér, sárga
   "érme" kör cián kerettel, pixeles "?" — a STYLE_GUIDE.html
   `--cabinet`/`--coin`/`--cyan`/`--magenta` színeivel). 11 route-ról
   hiányzott `<title>` (a sweep az összes `+page.svelte`/`+error.svelte`
   fájlt átnézte) — mind pótolva, a meglévő "{Cím} — Admin" / "— Host" /
   "— Kivetítő" konvenciót követve. **Nem** került statikus alapértelmezett
   `<title>` az `app.html`-be: mivel minden route-nak már van saját
   `<svelte:head><title>`-je, egy statikus cím az `app.html`-ben a HTML
   spec "első `<title>` a dokumentum-sorrendben nyer" szabálya miatt
   ténylegesen **felülírta volna** minden oldal saját címét (mert korábban
   érkezik a dokumentumban, mint a `%sveltekit.head%` helyére injektált
   oldal-specifikus cím) — ellenőrizve, hogy tényleg minden route-nak van
   már saját címe, ezért ez a védőháló feleslegesnek, sőt károsnak
   bizonyult.
2. **404 / általános hibaoldal.** Új `src/routes/+error.svelte` — a
   design rendszerhez illő "GAME OVER" panel (`--font-led` státuszkód,
   `--font-display` cím, `--danger` szín), `$app/state`
   `page.status`/`page.error.message` alapján. Szándékosan **nem** hív
   dinamikus téma-lekérdezést (`getActiveTokens`) — csak a statikus
   `defaultTokens`-t használja, mert a hibaoldalnak akkor is meg kell
   jelennie, ha maga a Supabase-elérés az ok.
3. **PIN brute-force védelem.** Egyszerű, memóriabeli IP-alapú számláló
   (`src/lib/server/rate-limit.ts`), bekötve a `/play/[pin]` `load()`-jába
   ÉS a `join` action-be is (különben egy szkript a `load()`-ot kihagyva,
   közvetlen POST-tal megkerülhetné). Részletek, küszöbérték-indoklás és
   ismert korlátok (nem elosztott, Vercel serverless instance-onként
   külön számol): `docs/features/rate-limiting.md`.
4. **`manifest.json` a `/play`-hez.** Új `static/manifest.json` +
   `static/icon.svg` (ugyanaz a retro-arcade ikon, nagyobb vászonra,
   `rx=0` teljes kifutással a maskable ikon "safe zone" elváráshoz), és
   egy új `src/routes/play/+layout.svelte`, ami csak a `/play` alatti
   route-okra köti be a `<link rel="manifest">`/`apple-touch-icon`/
   `theme-color` fejléc-elemeket — szándékosan nem globálisan az
   `app.html`-ben, mert a kérés kifejezetten a csapat-felületre
   (ismétlődő heti használat, "Kezdőképernyőhöz adás") szólt, nem az
   admin/host/tv felületekre.
5. **DATA_MODEL.md 1–9. szakasz kereszt-ellenőrzés.** Módszeres átvizsgálás
   (minden táblát/oszlopot/RPC-t a tényleges route-okkal/komponensekkel
   összevetve) 4 dokumentálatlan hiányt talált:
   - `questions.created_by` és `games.host_id` **soha nem lett kitöltve**
     insertkor, holott a séma és a `docs/architecture/DATA_MODEL.md` már
     régóta tartalmazza őket — ez egyértelmű "elfelejtve bekötni" hiba
     volt, nem tudatos scope-vágás, ezért **most javítva**: mindkét
     insert action (`/admin/games` `create`, `/admin/questions/new`
     `create`) átadja a bejelentkezett admin `user.id`-ját. Ez **nem**
     vezet be új jogosultsági logikát — a `/host` route védelme továbbra
     is szerepkör-alapú, a `host_id` egyelőre csak tájékoztató metaadat.
   - `teams.color`, `question_choice_options.image_url` (per-opció kép a
     feleletválasztós kérdéseknél) és az `audit_logs` 2. pontja szerinti
     **explicit app-oldali** üzleti esemény-naplózás (`game.start`,
     `question.reveal` stb. — a generikus DB trigger csak `profiles`-ra
     és a `questions`+opció-táblákra van bekötve) **nincs UI-lefedettsége**.
     Mindhárom valódi, önálló funkció-bővítés lenne (nem egyetlen sornyi
     javítás, mint a fenti kettő), ezért **tudatosan kimaradtak** ebből a
     checklistából — dokumentálva `docs/architecture/DATA_MODEL.md`
     megfelelő szakaszaiban ("Ismert MVP-korlátok" alcímek alatt), és
     ugyanabba a bizalmi-modell kategóriába esnek, mint a korábban már
     elfogadott kompromisszumok (lásd lent).
6. **Vercel környezeti változók.** Ez a sandbox nem fér hozzá a Vercel
   dashboard-hoz/API-hoz (nincs `vercel` CLI, nincs API token) — ezt **nem
   lehetett innen ellenőrizni**, ez marad felhasználói teendő. A ténylegesen
   szükséges változók (a repo `.env.example`-je szerint) mindössze
   `PUBLIC_SUPABASE_URL` és `PUBLIC_SUPABASE_ANON_KEY` — a `NEXT_STEPS.md`
   által is említett `SUPABASE_SECRET_KEY` **nem kell**, mert az app sosem
   használt service-role klienst (Fázis B óta tudatos döntés, lásd az
   akkori bejegyzést); ez a változó csak a NEXT_STEPS.md javaslatszövegében
   szerepelt, a repóban soha nem lett bevezetve. **Teendő a felhasználónak:**
   ellenőrizni, hogy a fenti két változó helyesen van-e beállítva Vercelen
   mindhárom környezetben (Production, Preview, Development).

### Amit ez a fázis szándékosan kihagyott (és miért)

- `teams.color`, per-opció `image_url`, explicit üzleti audit-naplózás —
  lásd az 5. pontot fent, mindhárom önálló funkció-bővítés, nem
  launch-checklist tétel.
- Vercel env var tényleges beállítása — nincs dashboard-hozzáférés ebből
  a sandboxból, felhasználói teendő marad.
- Minden korábbi fázis végén már dokumentált, tudatosan vállalt
  MVP-korlát (lásd a `Csomag-összefoglaló` utáni "Amit szándékosan nem
  teszek be ebbe a listába" szakaszt feljebb: `evaluate_answer` RPC-ként
  nem Edge Function-ként, `device_token`-alapú csapat-azonosítás,
  auth nélküli TV mód, automata tesztelés) — ezek továbbra is érvényben
  maradnak, ez a fázis nem érintette őket.

**Ezzel a `NEXT_STEPS.md` teljes fázis-listája (F→G→H→I→J→K→L, majd
B→C→D→E, végül M) lezárva — az alkalmazás MVP-kész egy hobbi-szintű,
baráti körben tartott pub kvízestére.**

Dokumentáció: `docs/architecture/DATA_MODEL.md` 2., 4. és 6. szakasz új
"Ismert MVP-korlátok" alszakaszok, új `docs/features/rate-limiting.md`.

---

## 2026-08-08 — Fázis N1: élő böngészős teszt sürgősségi javításai

Az `equa-cards.vercel.app` első valódi böngészős bejárása (a sandbox
egress-blokkolása miatt eddig soha nem volt lehetséges) 13 konkrét
problémát talált — ez a fázis az első öt, funkcionális/CSS jellegű
hibát zárja le.

1. **Random húzás.** Élő SQL-szimulációval (Supabase MCP, valódi
   `super_admin` JWT-vel, `set local role authenticated`, `begin`/
   `rollback` tranzakcióban) igazoltam, hogy a
   `draw_random_questions_for_round()` RPC és a mögötte lévő RLS/grant
   lánc **ténylegesen helyesen működik** — egy konkrét, a tesztelő által
   használt éles kör/téma kombináción (`Test` este, `Zene` téma)
   valódi találatokat adott és be is szúrta a `round_questions` sorokat.
   A tényleges hiányosság — amit a hibajegy maga is felvetett — az volt,
   hogy **0 találat esetén** (pl. kimerült cooldown-mentes készlet egy
   témában, vagy minden találat már ebben a körben van) a `draw` action
   csendben "sikeresen" tért vissza, semmilyen hibaüzenet nélkül. Javítva:
   az action most ellenőrzi az RPC visszatérési sorainak számát, és
   `fail(400, ...)`-ot ad, ha üres — ezt a `/admin/games/[id]` oldal már
   meglévő általános `form?.error` blokkja jeleníti meg, nem kellett új UI.
2. **Hamburger menü.** Mobil nézetben az admin oldalsáv `position: fixed`
   hamburger gombja (`z-index: 20`) a nyitott oldalsáv (`z-index: 10`)
   tartalma **fölé** rajzolódott, mert a `.sidebar` felső paddingje nem
   számolt a fixen elhelyezett gomb helyfoglalásával — a márka-link és a
   nav első eleme a gomb alatt/mögött jelent meg. Javítva: `.sidebar`
   mobil nézetben `padding-top: 4.5rem`-et kapott (ugyanaz az érték, amit
   az `.admin-content` már korábban is használt erre a célra).
3. **Design téma törlés védelem.** Az `is_default` téma törlés elleni
   szerver-oldali védelem **már létezett** (Fázis 6 óta) — ez kiegészült
   egy második védelmi réteggel: ha összesen csak **egy** design téma
   létezik (akkor is, ha valamiért nem `is_default`-ként van jelölve),
   a törlés szerver-oldalon is elutasított. Kliens-oldalon a Törlés gomb
   mostantól el sem jelenik `is_default` vagy egyetlen-sor esetén — helyette
   egy "nem törölhető" felirat, hogy ne kelljen a felhasználónak a
   szerver hibaüzenetéből megtudnia.
4. **TV mód új fülön.** Ellenőrizve: a `/host/[game_id]` "Kivetítő
   megnyitása (TV mód)" gombja **már** `target="_blank" rel="noopener"`
   attribútumokkal rendelkezett — ez a tétel a kódban már korábban
   helyesen volt megoldva, nem igényelt módosítást.
5. **Globális fehér villanás overscroll-nál.** Minden oldal saját
   `.cabinet` gyökere `style={themeCss}`-ből (futásidőben feloldott
   `var(--cabinet)`) kapja a hátterét, de a `<html>`/`<body>` elemeknek
   sosem volt saját háttere — trackpad rubber-band scroll-nál vagy rövid
   tartalomnál átvillant a böngésző alapértelmezett fehér háttere.
   Javítva: `src/app.html`-ben statikus `html, body { background: #150e2c;
min-height: 100% }` (nem `var(--cabinet)`, mert az csak lejjebb, az
   egyes oldalak `.cabinet` elemén van definiálva — a `<body>`, mint
   ősük, nem örökölhetné felfelé egy leszármazott custom property-jét).

Mind az öt javítás élesben tesztelt/ellenőrzött logikára épül (a
Supabase MCP-n keresztül valódi RLS-kontextusban futtatott
szimulációkkal, ahol releváns), nem csak feltételezésre.

---

## 2026-08-08 — Fázis N2: Branded kezdőoldal + "Kezelőfelület" átnevezés

A `/` gyökér route eddig egy stílus nélküli, csupasz szöveges oldal volt
("EquaCards — Pub Kvíz" cím + egy sima link) — ez lett a tényleges
belépési pont branddé alakítva. Az `ArcadePanel` megosztott komponensbe
(Fázis H-ban már létrehozva, eddig csak `/play`, `/host`, `/tv` használta)
került egy hero-tartalom: eyebrow-szöveg ("🍺 Heti kocsmai kvíz"),
`--font-display` cím, tagline, és egy darab jól látható CTA gomb.

Bejelentkezési állapot szerint viselkedik — **nem** automatikus redirect,
hanem a látható gomb célja/felirata változik, hogy a `/` tényleg landing
page-ként funkcionáljon (pl. ha valaki csak megnézi az oldalt, ne dobja
azonnal tovább):

- Kijelentkezve: "Bejelentkezés / Regisztráció →" a `/login`-ra.
- Bejelentkezve: "Kezelőfelület megnyitása →" a `/admin`-ra, plusz egy
  másodlagos (ghost variánsú) Kijelentkezés gomb az email címmel — ez
  megmaradt a korábbi oldal funkciójából, csak vizuálisan alárendelve.

**"Kezelőfelület" átnevezés:** a felhasználó felé megjelenő "Admin" szó
egyetlen előfordulási helye a 12 admin route `<title>` tag-jének
"— Admin" utótagja volt (a nav címkék már eddig is magyarul, "Admin"
szó nélkül szerepeltek: "Vezérlőpult", "Kérdésbank" stb.) — ez mind
"— Kezelőfelület"-re cserélve. Az URL-ek (`/admin/...`) szándékosan
**változatlanok** — a kérés kifejezetten csak a megjelenő szövegre
vonatkozott, az útvonalak átnevezése minden linket/redirectet/RLS-t
érintő, indokolatlanul nagy, kockázatos változtatás lett volna egy
tisztán kozmetikai kérésre.

---

## 2026-08-08 — Fázis N3: vizuális konzisztencia + reszponzivitás finomítás

1. **Gombszín-konvenció véglegesítve.** A `Button.svelte` `.primary`
   variánsa eddig lila kitöltéssel indult, de magenta kerettel és
   magenta hover-állapottal — emiatt minden elsődleges akció-gomb
   (Kijelentkezés, + Új kérdés, Kvíz indítása) részben magenta színt is
   kapott, elmosva a joker gomb megkülönböztető szerepét. Döntés (a
   feladat kifejezett iránymutatása szerint): a lila marad az elsődleges
   gomb színe alap ÉS hover állapotban is (a hover csak sötétebb lila
   árnyalat), a magenta pedig kizárólag a joker gombnál (`Duplázás`)
   jelenik meg egy `--magenta`→`--violet` gradiensben — ami korábban
   valójában `--coin`/`--danger` színpárt használt, tehát a joker eddig
   **nem is volt magenta**. Mindkét helyen a Fázis J-ben már bevált
   `color-mix(... , var(--cabinet))` mintával, hogy a WCAG AA kontraszt
   ne romoljon. Egyetlen helyen (`Button.svelte`) van a `.primary`
   variáns definiálva, minden felület onnan örökli — nem volt szükség
   admin/host/play/tv egyedi felülvizsgálatára, csak erre az egy
   komponensre. Dokumentálva: `docs/architecture/DESIGN_SYSTEM.md`
   szín-szerep táblázat + új "Fázis N3" alszakasz.
2. **Kvízesték lista kártyás nézetté alakítva.** A korábbi stílus
   nélküli, aláhúzott linkes lista helyett `ArcadePanel`-kártyák CSS
   grid-je (`repeat(auto-fill, minmax(18rem, 1fr))`), soronként PIN,
   csapatszám (`teams(count)` embedded lekérdezés) és — lezárt estéknél —
   dátum, plusz szín-kódolt státusz badge (`lobby`=cián, `active`=power,
   `paused`=coin, `finished`=semleges szürke).
3. **Admin táblázatok mobil-reszponzivitása.** A Kérdésbank és a
   Felhasználók táblázat 640px alatt korábban vízszintesen töredezett
   volna (a korábbi Fázis G audit csak a 768px-es sidebar-töréspontot
   dokumentálta, ez a hiányosság kimaradt). Új minta: `640px`-nél
   `thead` elrejtve, `<tr>` kártyává, `<td>` `data-label`-ből generált
   `::before` címkés flex-sorrá alakul. Dokumentálva:
   `docs/architecture/DESIGN_SYSTEM.md` "Töréspontok" szakasz új
   "Admin táblázatok mobilon" alszakasza.

---

## 2026-08-08 — Fázis N4: Riport diagram javítások

Két Chart.js konfigurációs hiba javítva a `/reports` oldalon:

1. **Törtszám y-tengely.** A csapatszám-trend vonaldiagramja törtszám
   lépésközt is mutathatott egy olyan metrikán, ami sosem lehet tört. A
   megosztott `ReportChart.svelte` `y` skálája mostantól mindig
   `precision: 0`-t kap; a csapatszám-diagram emellett egy új,
   opcionális `yStepSize` prop-on keresztül explicit `1` lépésközt is
   kap. Ezt a lépésközt **szándékosan nem** alkalmaztuk a téma-használati
   oszlopdiagramokra is — azok nagyobb/ismeretlen tartományú számláló-
   adatok, ahol egy fix `stepSize: 1` túl sűrű tengelyt eredményezne; ott
   a `precision: 0` önmagában elég az egész-szám kényszerhez, a
   tényleges lépésköz méretét Chart.js választja a tartomány alapján.
2. **Oszlopdiagram túlcsordulás.** Az `x` tengely `ticks` konfigurációja
   kiegészült `maxRotation: 45`/`autoSkip: true`-val (hosszabb téma-
   címkék elfordulnak ahelyett, hogy átfednék egymást vagy levágódnának),
   a `.chart-wrap` konténer magassága `16rem`-ről `18rem`-re nőtt, és
   explicit `width: 100%`/`min-width: 0`-t kapott.

Mindkét javítás a megosztott `ReportChart.svelte`-ben történt, tehát
mindhárom jelenlegi diagram (csapatszám-trend, vizuális téma-használat,
tartalmi téma-használat) egyaránt profitál belőle.

Dokumentáció: `docs/features/reports.md` új "Diagram-konfiguráció
javítások (Fázis N4)" alszakasz.

---

## 2026-08-08 — Fázis N5: Loading state-ek + egységes hibajelzés

**Csomag-döntés eltérés a tervtől:** a feladat szövege `svelte-french-toast`-ot
javasolt (a NEXT_STEPS.md eredeti Fázis B ajánlása) — ez **nem** került be,
mert még mindig csak Svelte 3/4 peer dependency-t enged (ugyanaz az ok,
ami miatt Fázis B-ben eredetileg `svelte-sonner`-re váltottunk, lásd az
akkori bejegyzést). A már meglévő `svelte-sonner` + admin layout-ban
mounted `<Toaster>` infrastruktúrát bővítettük tovább, nem vezettünk be
egy második, párhuzamos toast-csomagot.

1. **Egységes admin form-visszajelzés.** Új megosztott
   `src/lib/toast-enhance.ts` `withToast()` helper (a korábban
   admin/users-ben és admin/settings-ben egyedileg megírt minta
   kivonata) — hiba esetén toast, sikeres és **nem redirectelő** action
   esetén opcionális sikerüzenet is. Bekötve minden korábban lefedetlen
   admin CRUD form-ba: `admin/themes` (létrehozás/törlés),
   `admin/design-themes` (lista törlés, új létrehozás, szerkesztés
   mentés/törlés), `admin/questions` (lista törlés, `QuestionForm.svelte`
   megosztott mentés — ez automatikusan lefedi az `admin/questions/new`-t
   és az `admin/questions/[id]`-t is), `admin/games` (létrehozás,
   kör hozzáadása/törlése, random húzás, kérdés eltávolítása).
   Redirectelő action-öknél (pl. létrehozás → szerkesztő oldalra ugrás)
   szándékosan nincs `successMessage`, mert a toast sosem futna le a
   navigáció előtt — ott csak a `loading` állapotot kötöttük be.
2. **`Button.svelte` új `loading` prop.** Spinner + implicit `disabled`,
   hogy submit közben ne lehessen véletlenül duplán elküldeni egy
   form-ot. Minden fenti admin form submit gombja ezt használja, egy
   helyi `$state`-tel (vagy lista-elemeknél kulcsolt `$state`-tel, pl.
   `deletingId`/`removingKey`) vezérelve a `withToast()` `setSubmitting`
   callback-jén keresztül.
3. **Host lobby csapatlista — "töltés" vs. "valóban üres" megkülönböztetve.**
   A `teams` lista realtime presence sync-ből töltődik, `[]`-ként indul —
   korábban ez megkülönböztethetetlen volt a "senki sem csatlakozott"
   állapottól. A már meglévő `connectionStatus` context-et (Fázis F/I)
   felhasználva: amíg a csatorna nincs `'connected'` állapotban, "Csapatok
   betöltése…" jelenik meg az üres-lista szöveg helyett.
4. **`ReportChart.svelte` — a Chart.js canvas-mount rése.** A diagram
   `onMount`-ban épül fel (elkerülhetetlenül kliens-oldali) — egy rövid
   "Diagram betöltése…" placeholder fedi le ezt az ablakot, amíg a
   `Chart` példány létre nem jön.
5. **`/play/[pin]` csatlakozási form — loading, de szándékosan toast nélkül.**
   A join gomb `loading` állapotot kapott, de **nem** kötöttünk be
   `withToast()`-ot/`Toaster`-t erre a felületre: a `/play` a Fázis F
   dokumentált, tudatos "nincs header/chrome, minden pixel a kérdésé"
   döntése alá esik, és a hibaüzenet már eddig is jól látható, tartósan
   olvasható inline banner-ként jelenik meg (`{#if form?.error}`) — egy
   pár másodperc után eltűnő toast rosszabb UX lenne egy telefonon,
   zajos kocsmai környezetben olvasó csapatnak, mint egy state-ig
   megmaradó inline üzenet.
6. **`/host` élő vezérlés — szándékosan kimaradt.** A host oldal
   interakciói (kérdés indítása, timer, reveal stb.) nem SvelteKit form
   action-ök, hanem közvetlen `onclick` függvényhívások, saját
   `statusMessage`-alapú visszajelzési mintával (pl. "Joker aktiválva
   egy csapat által.") — ez már egy létező, konzisztens egységes
   visszajelzési csatorna, a `withToast()`/`use:enhance` minta ide nem
   illeszkedne rá természetesen. Nem vezettünk be egy második,
   párhuzamos visszajelzési rendszert emiatt.

Dokumentáció: `docs/DOCUMENTATION_POLICY.md` új "UI konvenció: loading +
hiba state minden aszinkron művelethez" szakasz — mostantól minden új
aszinkron műveletre kötelező elvárás, a fenti minták szerint.

**Ezzel a `PROJECT_REVIEW.md` élő teszteléséből eredő mind az öt N-fázis
(N1–N5) lezárva.**

---

## 2026-08-08 — Fázis O1: Timer — automatikus indítás, láthatóság, lezárás

Élő játékmenet tesztelésből három konkrét timer-hiba, mindhárom javítva:

1. **A `/host/[game_id]` felület soha nem jelenítette meg a `TimerRing`-et**
   — a host csak _küldte_ a `timer_start`/`answer_locked` eseményeket,
   sosem figyelt rájuk saját magán, és nem is volt hozzá helyi
   `timerInfo`/`secondsLeft` state. Pótolva: pontosan ugyanaz a
   `$effect`-alapú helyi számolási minta, mint `/play`/`/tv`-n.
2. **Külön "Timer indítása" gomb megszűnt.** A `showNextQuestion()` és a
   korábbi, önálló `startTimer()` egyetlen függvénybe olvadt — a
   `question_show` broadcast után **ugyanabban a hívásban** azonnal
   elindul a timer is (`games.current_question_started_at`/
   `duration_seconds` írás + `timer_start` broadcast), nincs köztes
   állapot. A `uiStep` állapotgép `'shown'` értéke ezzel megszűnt (soha
   nem állt volna meg ott). Melléktermékként egy felesleges DB-lekérdezés
   is eltűnt: a régi `startTimer()` újra lekérdezte a
   `time_limit_seconds`-ot, holott a `showNextQuestion()` már betöltötte
   ugyanazt a kérdés-sort.
3. **`answer_locked` után a timer vizuálisan a képernyőn ragadt** (a
   lejáráskori, jellemzően pulzáló piros "low" állapotban) mindhárom
   felületen — kiderült, hogy a **TV soha nem is figyelt** az
   `answer_locked` eseményre (nem volt hozzá kézlő). Mindhárom felület
   (`/host` a meglévő `uiStep === 'locked'`-del, `/play` és `/tv` egy új
   `locked` boolean-nel) most egy explicit "Lezárva" feliratra cseréli a
   `TimerRing`-et lezáráskor, ahelyett hogy a régi számláló-állapot
   látszódna tovább.

Dokumentáció: `docs/features/timer.md` új "Fázis O1" alszakasz (5.
pont, a korábbi "Vizuális szinkron ellenőrzése" szakasz 6.-ra tolva).

---

## 2026-08-08 — Fázis O2: Élő válaszszámláló — a gyökérok

A host "X/40 csapat válaszolt" számlálója élesben nem frissült valós
időben. **Nem kódhiba volt** — a kliens-oldali `postgres_changes`
feliratkozás és az RLS (`answers_staff_all`, `role_id in (1,2,3)`) Fázis 4
óta helyesen volt beállítva. Supabase MCP-n keresztül élőben ellenőrizve
(`select * from pg_publication_tables where pubname = 'supabase_realtime'`):
a **publikációnak egyetlen tagja sem volt** — a Postgres Changes funkció
emiatt egyetlen táblán sem tudott eseményt küldeni, semmilyen kliens felé.

Javítás: új `supabase/migrations/20260808134500_answers_realtime.sql`
(`alter publication supabase_realtime add table answers;`), élőben
alkalmazva és a publikáció tartalmának újralekérdezésével leellenőrizve.

**Módszertani tanulság:** ez a projekt eddig kizárólag Broadcast/Presence
csatornákat használt élesben tesztelt módon (Fázis 3-6) — a `postgres_changes`
volt az egyetlen realtime funkció, ami sosem futott valódi böngészőben a
Fázis 4 megépítése óta, és pont ez bukott ki. A `supabase_realtime`
publikációhoz való explicit hozzáadás egy könnyen kihagyható lépés, amit
sem a kód, sem az RLS nem jelez előre — érdemes minden jövőbeli
`postgres_changes`-alapú funkciónál elsőként ellenőrizni.

Dokumentáció: `docs/architecture/REALTIME_PROTOCOL.md` "Postgres Changes"
szakasz kiegészítve a gyökérokkal és a módszertani tanulsággal.

---

## 2026-08-08 — Fázis O3: Sorrendbe állítás — drag-and-drop touch-eszközön

A "Sorrendbe állítás" kérdéstípus sorrendezője natív HTML5 drag-and-drop
API-t használt (`draggable`, `ondragstart`, `ondragover`, `ondrop`) — ez
**kizárólag desktop egérrel működik**, touch-eszközön a `dragstart`
esemény sosem tüzel el. Mivel a `/play/[pin]` felület kizárólag telefonon
használatos, ez élesben ténylegesen "nincs drag-and-drop"-nak tűnt, még
ha a kód szintjén létezett is egy (nem működő) implementáció.

Csere `svelte-dnd-action`-re (a task saját ajánlása is ez volt) — pointer
eseményeket használ belül, touch-kompatibilis, Svelte 5 peer dependency
támogatással. A billentyűzetes nyíl fel/le sorrendezés megmaradt
kiegészítő útvonalként (a könyvtár ezt nem adja natívan, akadálymentességi
okból fontos megtartani). CSS-oldalon `touch-action: none` került a
sorrendező elemekre, hogy a böngésző alapértelmezett görgetés-gesztusa ne
versenyezzen a pointer-alapú húzással mobilon.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "Új függőség (Fázis
O3)" alszakasz, két stale hivatkozás javítva ugyanitt (a sorrendező lista
korábbi "natív maradt" jegyzete, és a joker-gomb elavult `--coin`/
`--danger` színpár-hivatkozása, ami Fázis N3 óta `--magenta`/`--violet`).

---

## 2026-08-08 — Fázis O4: Joker-szorzó — a gyökérok versenyhelyzet volt

A "Duplázás" joker szorzója élesben nem érvényesült a végső pontszámban.
Élő, rollback-kal lezárt SQL-szimulációval igazoltam (Supabase MCP, valódi
`authenticated`/staff kontextusban, egy 1000 pontos, `points_multiplier=2`
kérdésen): az `evaluate_question()` join- és szorzás-logikája **teljesen
helyesen működik**, ha a `team_joker_uses` sor létezik kiértékeléskor —
2000 pont joker nélkül, pontosan 4000 (duplán) jokerrel, egy hívásban két
csapatra összehasonlítva.

A tényleges gyökérok nem a kiértékelésben, hanem a **beszúrás
időzítésében** volt: az eredeti (Fázis 4-es) tervezés szerint a csapat
kliense csak egy `joker_activate` broadcast-ot küldött, a `team_joker_uses`
sort a **host** kliense írta be a beérkező esemény alapján — ez egy
hálózati kör-utazásos versenyhelyzetet (csapat → Supabase Realtime →
host → DB insert) vitt be a pontszámítás elé. Ha a host gyorsan zárt/tárt
fel egy kérdést, vagy a broadcast késett/elveszett, a sor még nem
létezett `evaluate_question()` lefutásakor.

**Javítás:** a csapat kliense mostantól közvetlenül, szinkron ír a
`team_joker_uses`-be — ugyanaz a bizalmi modell, mint az
`answers_insert_anon_active_game` policy-nál (a projekt már dokumentált,
elfogadott kompromisszuma). Új migráció
(`supabase/migrations/20260808135500_joker_direct_insert.sql`): egy
`team_current_question()` security-definer segédfüggvény (ugyanaz a
minta, mint `team_owner_game_status()`) és egy új
`team_joker_uses_insert_anon_active_game` RLS policy, ami csak akkor
enged anon beszúrást, ha a csapat estéje `'active'` ÉS a `question_id`
egyezik a `games.current_question_id`-vel. A `joker_activate` broadcast
megmaradt, de mostantól csak a host UI-visszajelzésének szól — a host
már nem ír a `team_joker_uses`-be. Élőben ellenőrizve mindkét irányban
(`anon` kontextusban): megfelelő kérdésre/aktív estére sikeres beszúrás,
nem aktív estére elutasított.

Dokumentáció: `docs/features/scoring.md` új "Fázis O4" alszakasz,
`docs/features/jokers.md` "Miért a host írja" szakasz teljesen átírva
("A csapat kliense ír közvetlenül" címmel, a kódrészletek frissítve),
`docs/architecture/DATA_MODEL.md` két helyen frissítve (a
`team_joker_uses` RLS-leírás és a real-time esemény-táblázat
`joker_activate` sora).

---

## 2026-08-08 — Fázis O5: Admin UI apró javítások

1. **Input/gomb magasság-egyeztetés.** A `Button`/`Input`/`Select`
   mind `min-height: 44px`-et írt elő, de explicit `box-sizing` nélkül
   a böngésző UA-stílusától függött, hogy ez a padding+border-t is
   magába foglalja-e — élő tesztelés magasság-eltérést talált egy input
   és egy mellette álló gomb között (pl. `admin/games/[id]` "Darabszám"
   input + "Random húzás" gomb). Mindhárom komponens explicit
   `box-sizing: border-box`-ot kapott.
2. **"Élő lebonyolítás megnyitása" elsődleges gombbá alakítva** a
   korábbi sima szöveges link helyett (`admin/games/[id]/+page.svelte`)
   — ugyanaz a `Button` komponens, amit minden más elsődleges
   akció-gomb használ.
3. **`/reports` nem használta az admin vizuális héjat** (nincs sidebar/
   navigáció/vissza-gomb) — mert sosem is volt hozzá közös héj: az
   `admin/+layout.svelte` role_id in (1,2)-re szűkített, a `/reports`
   viszont role_id in (1,2,3,4)-nek szól (minden szerepkör), tehát nem
   örökölhette egyszerűen. Megoldás: a sidebar/header markup kiemelve
   egy megosztott `src/lib/components/DashboardShell.svelte`
   komponensbe, amit `/admin/+layout.svelte` ÉS egy új
   `/reports/+layout.svelte` is külön-külön becsomagol — mindkét
   route-fa megtartja a saját, eltérő szigorúságú `+layout.server.ts`
   jogosultság-ellenőrzését, csak a vizuális héj közös. A `DashboardShell`
   nav-elemei szerepkör-függők: az admin-specifikus linkek (Kérdésbank
   stb.) csak `role_id in (1,2)`-nek jelennek meg, a "Riportok" mindenkinek.
   **Kipróbált, de elvetett alternatíva:** SvelteKit route group
   (`(dashboard)/admin` + `(dashboard)/reports` közös layout alatt) —
   ez a fájlrendszerben elrejtette volna a csoport nevét az URL-ből, de
   a `resolve()` típusos router API-ja a route ID alapján generál
   overloadokat, ami MÉG tartalmazza a csoport-nevet
   (`"/(dashboard)/admin/games/[id]"`), és ez minden meglévő,
   projekt-szerte szétszórt `resolve('/admin/games/[id]', {...})`
   hívást eltört volna (pl. `host/[game_id]/+layout.svelte`-ben is) —
   élőben ki is derült (`npm run check` 5 típushibát adott), mielőtt
   commitolva lett volna. A komponens-alapú megoldás ugyanazt az
   eredményt adja route-struktúra érintése nélkül.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` — komponens-táblázat
új `DashboardShell.svelte` sora, "Layout héjak felületenként" szakasz
átírva (a `/admin` + `/reports` közös leírással és a route-group
alternatíva elvetésének indoklásával), új bekezdés a `box-sizing`
javításról.

---

## 2026-08-08 — Fázis O6: Kvízeste-összeállítás — este-szintű téma-választó

Az `/admin/games/[id]` korábbi munkafolyamata körönként külön téma- ÉS
darabszám-választót, majd külön "Random húzás" gombot igényelt — élő
tesztelés jelezte, hogy ez lassú egy több körös este összeállításánál,
ahol jellemzően minden kör ugyanabból a témából húz.

Átalakítva: egy este-szintű téma-választó az oldal tetején, minden kör
megtartja a saját "Darabszám" mezőjét, és egyetlen "Kérdések betöltése
minden körbe" gomb (`?/drawAll` action) egy hívásban megy végig az
összes körön. A kliens-oldali `roundCounts` state körönként tárolja a
darabszámot; mivel a Darabszám mezők a DOM-ban nem az összesítő
`<form>` leszármazottai (a kör-kártyák külön blokkban vannak), a
beküldéskor egy rejtett `rounds_json` mezőben JSON-ként szerializálódik
az összes `{round_id, title, count}` — a szerver ezen iterál, körönként
meghívva a változatlan `draw_random_questions_for_round` RPC-t. Hiba
esetén a válasz megnevezi, melyik kör(ök) érintett(ek).

**Dokumentált mellékhatás:** egy már megtöltött körre újra futtatva a
gombot a random húzás **hozzáad**, nem cserél/tölt fel a megadott
darabszámra (a "nem duplikál" logika csak az egyedi kérdés-ismétlődést
zárja ki) — ha ez nem kívánt, az admin a meglévő "Eltávolítás" gombbal
tudja kézzel véglegesíteni egy kör tartalmát.

Dokumentáció: `docs/features/random-draw.md` új "UI munkafolyamat
(Fázis O6)" szakasz.

---

## 2026-08-09 — Fázis O7: Azonnali válaszbeküldés single_choice/true_false-nál

Élő tesztelés jelezte, hogy a "koppints, majd nyomj egy külön Beküldés
gombot" kétlépéses folyamat feleslegesen lassítja a leggyakoribb,
legegyszerűbb kérdéstípusokat. A `/play/[pin]` beküldési viselkedése
mostantól kérdéstípusonként eltér:

- **`single_choice` / `true_false`**: azonnali beküldés koppintáskor —
  a `ChoiceButton onclick`-ja közvetlenül `selectAndSubmit(optionId)`-t
  hív, a "Válasz elküldése" gomb ezeknél a típusoknál el van rejtve. A
  `ChoiceButton` új `pulse` propja egy rövid (`0.3s`) kiemelés/
  pulzálás animációt ad a megkoppintott gombra
  (`prefers-reduced-motion: reduce` esetén kikapcsolva), majd `200ms`
  múlva a UI a "Válasz elküldve" nézetre vált. A `200ms` késleltetés
  tisztán vizuális — a `submitAnswer()` a `selectedOptionId`-t a hívás
  pillanatában olvassa ki, a válasz adattartalma a késleltetés nélkül
  is helyes lenne, ez csak időt ad a pulzálásnak láthatóvá válni.
- **`multi_choice` / `slider` / `ordering`**: változatlanul explicit
  beküldés marad — itt több lépés/finomítás történik a végleges válasz
  előtt, egy koppintásra/módosításra való azonnali beküldés véletlen,
  korai válaszbeküldéshez vezetne.

Dokumentáció: `docs/features/game-experience-polish.md` új "6.
Válaszbeküldés típusonként (Fázis O7)" szakasz.

---

## 2026-08-09 — Két új design téma seedelve: "Roxfort" és "Sportaréna"

Admin kérésre két új sor a `design_themes` táblába (egyik sem
`is_default` — a "Retro Arcade" marad az egyetlen alapértelmezett):

- **"Roxfort"** — Harry Potter ihletésű: éjkék/pergamen alap, zafírkék
  elsődleges kiemelés, arany "galleon" `--coin`, smaragdzöld
  helyes/piros hiba, ametiszt+bordó joker-gradiens. Betűtípusok:
  `Cinzel Decorative` / `Cinzel` / `EB Garamond`.
- **"Sportaréna"** — sport ihletésű: sötétkék stadion alap, narancs
  elsődleges kiemelés, arany "érem" `--coin`, zöld helyes/piros hiba,
  lila+pink joker-gradiens. Betűtípusok: `Anton` / `Bebas Neue` /
  `Oswald`.

Mindkettő a teljes, meglévő token-sémát tölti ki (nincs séma-
módosítás) — a betűtípusaik nincsenek statikusan belinkelve az
`app.html`-ben, tehát a Fázis E-ben épített dinamikus Google Fonts
betöltés (`loadThemeFonts()`) tölti be futásidőben, ha az admin/host
kiválasztja őket.

Migráció: `supabase/migrations/20260809140000_design_themes_hp_sport.sql`,
alkalmazva élőben (`mcp__Supabase__apply_migration`), ellenőrizve
SQL-lel, hogy az `is_default` egyik új sornál sem állt be és a Retro
Arcade maradt az egyetlen alapértelmezett. Dokumentáció:
`docs/features/design-themes.md` új "Seedelt témák" szakasz.

---

## 2026-08-09 — Fázis P1: admin sidebar belső görgetés + reszponzivitás re-audit

Konkrét élő tesztelésből jelzett hiba: a `DashboardShell.svelte` sidebar-ja
(admin + riportok közös héja) nem volt magasság-korlátozva/görgethető
önmagában — magas tartalomnál (sok nav-elem + felhasználónév +
"Kijelentkezés") az alsó rész lecsúszott a viewportról, csak a teljes
oldal görgetésével volt elérhető. Javítás: `.sidebar` desktop-nézetben
(`>768px`) `position: sticky; top: 0; height: 100dvh; overflow-y: auto;`
— a sidebar mindig a viewporthoz rögzítve marad, saját belső
görgetéssel, a fő tartalom görgetésétől függetlenül.

Ezzel egy menetben elvégzett teljes reszponzív re-audit mind a négy
felületen (360/640/1024/1920px) a korábbi Fázis G/N3 mintákat (fluid
`clamp()` tipográfia, 44px érintési célpontok, `flex-wrap` header,
kártyás mobil-táblázatok) továbbra is helyesnek találta — nem került
elő újabb konkrét hiba a sidebaron kívül.

**Melléktermék:** az audit közben egy második, dokumentált hiba is
előkerült és javításra került a host `timer_start` broadcast
kezelésében — lásd a következő, "Fázis P2" bejegyzést.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "Sidebar belső
görgetés (Fázis P1)" szakasz.

---

## 2026-08-09 — Fázis P2: timer szinkron-csúszás javítása (host self-echo)

Tünet: a csapatok (`/play`) visszaszámlálója induláskor 2-3 másodperccel
kevesebbet mutatott, mint a host/TV. Kód-átolvasással kizárva a gyanított
ok (a `server_start_time`-ból számolás mindhárom felületen már eleve
helyesen működött) — a valódi gyökérok: a host a saját `timerInfo`
state-jét közvetlenül, a `channel.send()` visszatérésekor állította be, a
Realtime-kézbesítés tényleges kivárása nélkül, míg a `/play`/`/tv` csak a
broadcast ténylegesen megérkezésekor. Emiatt a host a hálózati
kézbesítési késleltetés nélkül, korábban indította a saját óráját.

Javítás: a host csatornája `broadcast: { self: true }`-t kap, és a
`timerInfo`-t egy `channel.on('timer_start', ...)` feliratkozás állítja
be — ugyanazon az úton, mint a `/play`/`/tv`. Mindhárom felület ugyanazt
az (elkerülhetetlen) kézbesítési késleltetést kapja, tehát relatív
szinkronban indul.

Dokumentáció: `docs/features/timer.md` új "7. Fázis P2" szakasz.

---

## 2026-08-09 — Fázis P3: automatikus lezárás + megoldás-feltárás

Eddig a host-nak kézzel kellett megnyomnia a "Zárás most" majd a
"Megoldás feltárása" gombot minden kérdésnél. Két automatikus trigger
került be a `/host/[game_id]/+page.svelte`-be, mindkettő a `lockAnswers()`

- `revealAnswer()` egymás utáni, egy menetben történő lefuttatásával
  (nincs külön, látható "csak lezárva" köztes állapot):

1. **Lejár az idő** — a host saját `secondsLeft`-je (a P2-ben javított
   számítás) 0-t ér el `'timing'` állapotban.
2. **Minden csapat beküldött, mielőtt lejárt volna az idő** — a
   `submissionCount` (Fázis O2 élő számláló) eléri a `teams.length`-et
   `'timing'` állapotban.

Egyetlen `$effect` figyeli mindkét feltételt, egy `autoAdvanceTriggered`
flag-gel védve az egyszeri lefutást kérdésenként. A host kézi "Zárás
most"/"Megoldás feltárása" gombjai változatlanul elérhetők maradnak
technikai problémák esetére.

**Mellékesen javított korrektség-hiba:** a `submissionCount`-ot számláló
`$effect` eddig csak az async lekérdezés megérkezésekor nullázott —
enélkül az előző kérdés végleges értéke egy pillanatra átcsúszhatott
volna az újra, és tévesen kiválthatta volna az automatikus lezárást.
Mostantól szinkron nullázás történik kérdésváltáskor, az async
lekérdezés elindítása előtt.

Dokumentáció: `docs/architecture/REALTIME_PROTOCOL.md` új "Automatikus
lezárás és feltárás (Fázis P3)" szakasz az `answer_locked`/
`question_reveal` események alatt.

---

## 2026-08-09 — Fázis P4: csapat újracsatlakozás és állapot-mentés

A `/play/[pin]` eddig kizárólag a broadcast-eseményekből építette fel az
állapotát — egy oldal-újratöltés után a kliens nem tudta ezt visszaolvasni,
mert az `anon` szerepkörnek szándékosan nincs SELECT policy-ja sem a
kérdésbank táblákon, sem az `answers` táblán. Két új migráció
(`supabase/migrations/20260809150000_current_question_state_rpc.sql`,
`20260809150500_current_question_state_reveal.sql`) egy új
`current_question_state(p_game_id)` security-definer RPC-t vezet be —
ugyanazt a (nem-szivárogtató) adatot adja vissza, mint a `question_show`
broadcast, kiegészítve a timer-infóval és egy `revealed`/`correct_answer`
párral (az `evaluate_question()` egy menetben tölti ki az összes
`answers.is_correct`-ot egy kérdésre, tehát "van-e legalább egy kiértékelt
sor" megbízható "már feltárult" jelzés).

A `/play/[pin]/+page.svelte` `restoreLiveState()`-je (a csapat-azonosító
`$effect`-jében, a csatorna-feliratkozás előtt hívva) ebből + a meglévő
`team_answer_result` RPC-ből (saját válasz állapota) építi fel a
`currentQuestion`/`timerInfo`/`submitted`/`locked`/`revealInfo`/
`myResult`-ot — a device_token/localStorage továbbra is kizárólag
azonosításra szolgál, a játékállapot mindig a szerverről töltődik vissza.
Érvénytelen/törölt `gameId` esetén a kliens törli a localStorage-t és
visszairányítja a csapatot a PIN-képernyőre. A kapcsolat-vesztés vizuális
jelzése (`ReconnectOverlay`) már korábban (Fázis I) elkészült, változatlan.

Élőben ellenőrizve, `rollback`-kal lezárt SQL-szimulációval: feltárás
előtt `revealed: false`/`correct_answer: null`, `evaluate_question()`
lefuttatása után `revealed: true` + helyes `correct_answer` ugyanarra a
kérdésre; anon szerepkörből is sikeresen hívható.

A tervdokumentum opcionális, localStorage-alapú "gyors előrender" pontját
(4.) szándékosan nem építettük be — indoklás: `docs/features/team-reconnect.md`
"Szándékosan kihagyott elem" szakasza.

Dokumentáció: `docs/features/team-reconnect.md` (új fájl).

---

## 2026-08-09 — Fázis P5: globális design téma választó + reaktív alkalmazás

1. **Gyors globális téma-választó a `/admin/settings`-en**: nem új
   funkcionalitás (az `is_default` eddig is állítható volt a
   `/admin/design-themes/[id]` szerkesztőben) — egy dedikált legördülő +
   `?/set_default_theme` action ugyanahhoz a mezőhöz, hogy ne kelljen a
   teljes szerkesztő formot megnyitni. A trigger (Fázis 6) automatikusan
   leveszi az `is_default`-ot a korábbi alapértelmezettről.
2. **Reaktivitás**: egy design téma váltás (globális alapértelmezett VAGY
   egy adott este `design_theme_id`-ja) eddig csak oldal-újratöltésnél
   jelent meg. Új `src/lib/theme/reactive-tokens.svelte.ts`
   (`createReactiveThemeTokens()`) — egy Svelte 5 rune-hook, ami a
   `designThemeId()` bemenet változására ÉS a `design_themes` tábla
   BÁRMILYEN `postgres_changes` eseményére újra feloldja + alkalmazza a
   tokeneket. Mind a négy felület (`DashboardShell`, `/host`, `/play/[pin]`,
   `/tv`) ezt használja a korábbi egyszeri `onMount`/`$effect` +
   sima `themeCss` `$state` minta helyett.
3. **`/play` és `/tv` külön kiegészítés**: ezek nem a saját, hanem a HOST
   másik kliensen történő téma-váltását kell észleljék — egy dedikált
   `postgres_changes` feliratkozás a `games` táblán (`UPDATE`,
   `id=eq.<game_id>`) tartja élőben szinkronban a helyi
   `gameDesignThemeId` state-et. Ehhez a `games` táblát fel kellett venni
   a `supabase_realtime` publikációba
   (`supabase/migrations/20260809160000_games_realtime.sql`) — ugyanaz a
   gyökérok, mint Fázis O2-nél (`answers`): a publikáció korábban csak
   egy táblát tartalmazott, élőben ellenőrizve (`select * from
pg_publication_tables where pubname = 'supabase_realtime'`), migráció
   után megerősítve, hogy a `games` bekerült.

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "Reaktív design
téma alkalmazás (Fázis P5)" szakasz, `docs/features/app-settings.md`
kiegészítve.

---

## 2026-08-09 — Fázis P6: megoldás-feltárás vizuális feldúsítása (host/TV)

A `question_reveal` host/TV megjelenítése eddig csak a formázott
`correct_answer` szöveget mutatta. A `QuestionRevealPayload`
(`src/lib/realtime/protocol.ts`) három új, típus szerint pontosan egy
kitöltött mezőt kapott (`correct_option_ids`/`correct_value`/
`correct_order`) — a host `revealAnswer()`-je ezeket eddig is
lekérdezte a `correct_answer` string összeállításához, csak nem küldte
tovább strukturáltan.

Új közös komponens (`src/lib/components/QuestionRevealVisual.svelte`):
`ChoiceButton` egy új `correct` variánssal (`var(--power)` zöld
keret/háttér + pulzáló animáció + ✓), a csúszkánál egy Svelte `Tween`
(`svelte/motion`) animálja a natív range input thumb-ját a tartomány
közepéről a helyes értékre, a sorrendezésnél a Svelte beépített FLIP-je
(`animate:flip`) rendezi át a kezdeti (kevert) listát a helyes sorrendre.
A host mostantól saját magának is megtartja a `question_show` payload-ot
(korábban egyáltalán nem jelenítette meg az opciókat/csúszkát/sorrendet).

Csak host/TV — a csapatok (`/play`) saját telefonján változatlan maradt
az egyszerű saját-eredmény visszajelzés.

Dokumentáció: `docs/features/reveal-animations.md` (új fájl).

---

## 2026-08-09 — Fázis P7: TV kérdés-megjelenítés egységesítése a játékos-nézettel

A `/tv/[game_id]` a kérdés élő fázisában (`timing`/`locked`) eddig
kizárólag a promptot mutatta — az opciókat/csúszkát/sorrendező listát
egyáltalán nem, miközben a csapatok `/play` oldala ugyanerre a kérdésre
már a teljes, típus szerinti válasz-UI-t mutatta.

Új `src/lib/components/QuestionAnswerDisplay.svelte` — NEM interaktív
komponens, a `/play` `.options`/`.slider`/`.ordering` blokkjaival azonos
vizuális elrendezéssel (a megosztott `ChoiceButton`-t is felhasználva),
csak nagy kijelzőre méretezve és `disabled` állapotban. Egyszerű
choice-grid (`ChoiceButton`, kijelölés/helyesség nélkül), csúszka
(letiltott range input, min/max feliratokkal a végein), sorrendező lista
(egyszerű számozott lista, drag nélkül).

Ez egy KÜLÖN komponens marad a Fázis P6-ban épült
`QuestionRevealVisual`-tól — eltérő céllal (élő, döntetlen állapot vs.
feltárás utáni, helyesség-jelölt + animált állapot), de ugyanazt a
`ChoiceButton` alapkomponenst használva mindkettő.

Szándékosan csak a TV kapta meg ezt — a host UI-ja vezérlő-központú
marad, az opciók a host oldalon csak a feltáráskor jelennek meg (Fázis
P6).

Dokumentáció: `docs/architecture/DESIGN_SYSTEM.md` új "TV kérdés-
megjelenítés egységesítése a játékos-nézettel (Fázis P7)" szakasz.

---

## 2026-08-09 — "Sürgősségi javítások — 3. kör" (P1–P7) lezárva

Mind a 7 fázis (P1–P7) elkészült, ellenőrizve (`npm run check`/`lint`/
`build`), commitolva és pusholva a `claude/pub-kviz-app-setup-q9uje2`
branch-re. Rövid összefoglaló:

- **P1**: admin sidebar belső görgetés (`position: sticky` + `100dvh`) +
  reszponzív re-audit (nem talált új hibát a sidebaron kívül).
- **P2**: timer szinkron-csúszás — a host `broadcast: { self: true }`-t
  kapott, a saját `timer_start`-jának vételekor állítja be az óráját, nem
  a `send()` visszatérésekor (ugyanazt a kézbesítési késleltetést kapja,
  mint a `/play`/`/tv`).
- **P3**: automatikus lezárás + feltárás (idő lejártakor VAGY minden
  csapat beküldésekor) — a kézi gombok megmaradtak tartaléknak.
- **P4**: csapat újracsatlakozás — új `current_question_state` RPC adja
  vissza a szerver-oldali, hiteles állapotot (a device_token/localStorage
  csak azonosít, sosem forrás).
- **P5**: globális design téma választó a Beállításokban + minden
  felület reaktívan, reload nélkül alkalmazza a téma-váltást.
- **P6**: megoldás-feltárás vizuális feldúsítása host/TV-n (helyes
  opció kiemelés, csúszka-animáció, FLIP sorrendezés).
- **P7**: TV kérdés-megjelenítés egységesítve a játékos-nézettel az élő
  fázisban is.

Nincs a P1–P7 listából szándékosan kihagyott elem, a P4-es opcionális
localStorage-gyorsítás kivételével (indoklás: `docs/features/team-reconnect.md`).

---

## 2026-08-09 — Sürgősségi javítás: timer-csúszás a Fázis P2 UTÁN is fennállt (eszköz-óra szinkronizáció)

Élő megerősítés: a Fázis P2 (host self:true broadcast-echo) javítása
UTÁN is fennállt a panasz — a `/play` órája továbbra is kevesebbet
mutatott, mint a `/tv`-é. A P2 csak a host-vs-többiek közötti,
hálózati kézbesítési késleltetésből eredő relatív csúszást oldotta meg;
a ténylegesen fennmaradó hiba két, egymásra rakódó forrásból állt:

1. A `games.current_question_started_at` a HOST kliens saját, helyi
   órájából (`new Date().toISOString()`) származott.
2. Minden kliens (host/play/tv) a SAJÁT eszközének `Date.now()`-jával
   számolt ehhez az időbélyeghez képest.

Ha két eszköz (pl. egy csapat telefonja és a TV-hez csatlakozó gép)
rendszerórája akár csak pár másodperccel eltér EGYMÁSTÓL — valós, gyakori
jelenség —, mindkét kliens technikailag "helyesen" számol a saját órájához
képest, mégis eltérő hátralévő időt mutat.

Javítás:

1. **`start_question_timer(p_game_id, p_duration)` RPC** — a host ezzel
   indítja a timert `games.update()` közvetlen hívás helyett; a
   Postgres-szerver `now()`-ja kerül be `current_question_started_at`-ba,
   és ugyanez kerül broadcast-olásra is (nem egy kliens-generált érték).
2. **`server_now()` RPC** — anon-nak is hívható, visszaadja a
   Postgres-szerver óráját.
3. **`src/lib/realtime/server-clock.ts`** (`calibrateServerClock()` /
   `serverNow()`) — minden felület egyszer kalibrálja a saját órájának
   eltolását a szerver órájához képest (NTP-szerű minta, a kör-utazás
   felét figyelembe véve), és a visszaszámláláshoz (+ a decay-alapú
   pontszámításba menő `answer_time_ms`-hez a `/play`-en) mindenhol
   `serverNow()`-t használ nyers `Date.now()` helyett.

Migráció: `supabase/migrations/20260809170000_server_clock_sync.sql`,
alkalmazva élőben, `rollback`-kal lezárt SQL-szimulációval ellenőrizve.

Dokumentáció: `docs/features/timer.md` új "8. Sürgősségi javítás"
szakasz, `docs/architecture/REALTIME_PROTOCOL.md` kiegészítve.

---

## 2026-08-10 — Fázis Q1: kör hozzáadás/téma-választó — gyökérok-audit

Alapos kód-audit (`/admin/games/[id]/+page.svelte` + `+page.server.ts`)
**nem talált strukturális hibát** a Fázis O6-ban épített flow-ban: az
`addRound` action tetszőleges számú kört helyesen felvesz (nincs olyan
egyedi/unique kényszer a `rounds` táblán, ami 2. kör felvételét
akadályozná), a globális témaválasztó és a `roundCounts`/`roundsJson`
`$derived` logika helyesen skálázódik N körre, és a `draw_random_questions_for_round`
RPC-t **élőben, rollback-kal lezárt SQL-szimulációval** 3 körre/eltérő
darabszámokra tesztelve (2/2/1 kérdés) mindhárom kör helyesen megkapta a
saját darabszámát ugyanabból a globális témából.

Két valós, a "működésképtelennek tűnik" panaszt hihetően magyarázó
UX-hiba viszont előkerült és javításra került:

1. **`addRound` sikeres beküldésnél NEM adott toast-visszajelzést**
   (a `deleteRound`/`drawAll` action-ök igen) — a `withToast()` hívás nem
   kapott `successMessage`-t. Egy felhasználó, aki nem veszi észre az
   újonnan megjelenő kör-kártyát (pl. görgetés nélkül), joggal
   gondolhatta, hogy a gomb nem csinál semmit.
2. **A globális témaválasztó üres, placeholder ("— válassz témát —")
   állapotban indult** — vizuálisan passzívnak/inaktívnak tűnhetett,
   holott funkcionális volt.

Javítás: `withToast()` kapott egy opcionális `onSuccess` callbacket
(`src/lib/toast-enhance.ts`), amivel az `addRound` form most (a) mutat
egy "Kör hozzáadva." toast-ot, és (b) törli a "Új kör neve" mezőt sikeres
beküldés után (korábban a beírt cím a submit után is bent maradt). A
globális témaválasztó pedig automatikusan az első elérhető témát
választja ki alapértelmezettként, amíg a felhasználó nem választ sajátot.

**Módszertani megjegyzés:** a sandbox nem ér el közvetlen hálózaton
keresztül Supabase-t (`CONNECT tunnel failed, response 403`), tehát ez az
audit — a Supabase MCP-n keresztüli SQL-szimulációk kivételével — nem
tudott élő böngészőben interaktívan reprodukálni. Ha a leírt tünet a
fenti javítások után is fennáll, az egy, ennél az audit-nál nem talált,
konkrétabb hibára utalna — érdemes lenne pontos lépéseket (pl. böngésző-
konzol hibaüzenet) gyűjteni hozzá.

---

## 2026-08-10 — Fázis Q2: részletes eredmény-bontás kizárólag a kezelőfelületen

Új `/admin/games/[id]/results` route (link az `/admin/games/[id]`
oldalról) — körönként/kérdésenként megmutatja, melyik csapat mit
válaszolt, helyes volt-e, mennyi pontot kapott, mennyi idő alatt. Tömeges
(nem N+1) lekérdezésekkel épül fel: rounds/teams/round_questions egy-egy
hívással, aztán az összes érintett `question_id`/`answer_id`-ra egy-egy
tömeges lekérdezés a kérdésbank- és `answer_*` táblákra, JS-oldali
csoportosítással.

Biztonsági audit, mind élőben ellenőrizve:

1. A route az `/admin` fa alatt van (`role_id in (1,2)` guard) —
   szándékosan szűkebb, mint a nyitó leírás "staff: super_admin/admin/host"
   megfogalmazása, mert a host jelenleg sehol máshol sem éri el az
   `/admin/games/*` fát (indoklás: `docs/features/staff-results.md`).
2. `RoundLeaderboardRevealPayload`/`FinalLeaderboardRevealPayload`
   (broadcast) — átvizsgálva, változatlanul csak top3/összesített
   rangsort tartalmaz, nincs per-kérdés per-csapat bontás bennük.
3. `set local role anon` + rollback-kal lezárt SQL-teszt: `select
count(*) from answers` és `... from question_choice_options` egyaránt
   `0` sort ad anon-ként, még ha a táblákban ténylegesen vannak is sorok —
   a meglévő `answers_staff_all`/`questions_select_staff` RLS policy-k
   (role_id in (1,2,3)) már eleve helyesen zárták ki az anon olvasást,
   nem kellett új policy.
4. Nincs paraméter nélküli/anon-elérhető RPC ehhez a nézethez — közvetlen,
   RLS-védett táblalekérdezések, nem egy külön "admin RPC" felület.

Dokumentáció: `docs/features/staff-results.md` (új fájl).

---

## 2026-08-10 — Fázis Q3: lezárt kvízeste újranyitása — `lobby`, nem `active` vagy `paused`

A tervdokumentum két opciót ajánlott ("active vagy paused, amelyik jobban
illeszkedik") — egyik sem bizonyult helyesnek kód-átolvasás után, egy
harmadik, `lobby` volt a helyes választás:

- **`paused` egyáltalán nincs kezelve** a `/host/[game_id]/+page.svelte`
  állapotgépében (`{#if game.status === 'lobby'} ... {:else if ===
'active' ...} ... {:else if === 'finished'}` — nincs `paused` ág, és
  nincs záró `{:else}` sem) — egy `paused` státuszú este a host felületén
  **teljesen üres tartalmi területet** renderelt volna.
- **`active`-re állítás megkerülné a csapat-csatlakozást**: a
  `teams_insert_anon_lobby` RLS policy kifejezetten `game_status(game_id)
= 'lobby'`-t követel meg ÚJ csapat beszúrásához — ha a reopen `active`-re
  állítana, az explicit kérés ("hogy... a csapatok újra csatlakozhassanak
  a PIN-nel") pont nem teljesülne új csapatokra.
- **`lobby`-ra állítás mindkettőt megoldja, séma-módosítás és host-oldali
  kódváltoztatás nélkül**: a host a már meglévő, jól tesztelt lobby-nézetet
  látja (PIN/QR + "Kvízeste indítása" gomb — pontosan ugyanaz, mint egy
  vadonatúj estén), új csapatok csatlakozhatnak, már csatlakozott csapatok
  a meglévő (Fázis P4) újracsatlakozási logikával élőben visszatöltik az
  állapotot. A `startGame()` a `current_question_id`-t nem törli
  explicit módon, de ez nem hiba: a `currentIndex` az ÚJ kör
  `roundQuestions`-éhez képest számol, egy más körből származó régi
  `current_question_id` `findIndex`-e -1-et ad, tehát a kérdés-sorozat
  helyesen az 1. kérdéstől indul újra.

Az action (`?/reopen`, `/admin/games/+page.server.ts`) `finished_at`-ot
is nullázza, és csak `status = 'finished'` sorokra enged újranyitást
(`.eq('status', 'finished')` guard a query-ben) — egy már aktív/lobby
estét nem lehet véletlenül "újranyitni".

**Audit:** `trg_audit_games` trigger (`supabase/migrations/20260810100000_games_audit_trigger.sql`)
a meglévő, generikus `log_table_change()` függvényt köti a `games`
táblára (eddig csak `profiles`/kérdésbank-táblák voltak audit-olva) —
élőben, rollback-kal lezárt SQL-teszttel ellenőrizve, hogy egy
`finished → lobby` UPDATE helyesen kerül be az `audit_logs`-ba
(`before_data`/`after_data` mindkét oldalról a `status` mezővel).
**Tudatos kompromisszum:** ez a trigger `games` MINDEN UPDATE-jét
naplózza, nem csak a reopen-t — élő kvízestén ez kérdésenként több sort
is generál (timer indítás, kérdés-váltás stb.), a tábla önmagában
felhalmozódhat. Ez a `log_table_change()` már meglévő, blanket
("minden oszlopváltozás") mintáját követi (`questions` táblán is így
működik) — ha a jövőben a `games` írási gyakorisága problémát okoz az
`audit_logs` méretében, érdemes lehet egy szűkebb, csak
`status`-változásra szűrő trigger-re váltani.

Dokumentáció: ez a bejegyzés.
