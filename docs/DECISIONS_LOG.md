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
