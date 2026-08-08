# Pub Kvíz App — Terv (v2)

Valós idejű, csapat-alapú kvízrendszer vendéglátóegység számára, 40 fős kvízestékhez.

**Stack:** SvelteKit + Supabase (Postgres + Realtime + Auth)
**Csatlakozás:** QR kód + PIN kód, saját telefonon
**Real-time:** Supabase Broadcast (host → csapatok vezérlés) + Postgres Changes (válaszok → host)
**Felületek:** Admin (kérdésbank + felhasználók) · Host (élő lebonyolítás) · Csapat (játék)

---

## 1. Jogosultsági rendszer

```sql
create table roles (
  id smallint primary key,
  code text unique not null,             -- super_admin | admin | host | viewer
  label text not null
);

insert into roles (id, code, label) values
  (1, 'super_admin', 'Rendszergazda'),
  (2, 'admin', 'Kérdésbank kezelő'),
  (3, 'host', 'Kvízmester (élő lebonyolítás)'),
  (4, 'viewer', 'Csak megtekintés');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role_id smallint references roles(id) not null default 4,
  created_at timestamptz default now()
);
```

- `super_admin`: mindent lát/ír, felhasználókat is kezelheti (role kiosztás), globális beállításokat módosíthat
- `admin`: kérdésbank, körök, kérdéstípusok CRUD — de nem oszthat ki jogosultságot, globális beállítást nem módosíthat
- `host`: futtathat kvízestét meglévő kérdésbankból, de nem szerkesztheti a kérdéseket
- `viewer`: statisztikák/eredmények megtekintése (pl. tulajdonos)

RLS minden admin-jellegű táblán (`themes`, `questions`, `rounds`, `round_questions`, `question_types`, opció-táblák) `role_id in (1,2)`-re épül; `games` indítás/vezérlés `role_id in (1,2,3)`-ra.

### Implementáció (Fázis 1, `supabase/migrations/20260807234850_roles_profiles_audit.sql`)

A fenti terven felül a megvalósítás a következőket vezette be, mert a működéshez szükségesek voltak, de a tervben nem szerepeltek explicit SQL-ként:

- **`handle_new_user()` trigger** az `auth.users`-en: minden új regisztrációnál automatikusan létrehoz egy `profiles` sort `role_id = 4` (viewer) alapértelmezéssel. Az első `super_admin`-t emiatt kézzel kell felléptetni: `update profiles set role_id = 1 where id = '<uuid>';`
- **`current_user_role_id()` segédfüggvény** (`security definer`, csak `authenticated`-nek grantelve): a bejelentkezett felhasználó `role_id`-ját adja vissza, hogy a `profiles`/`audit_logs` RLS szabályok ne okozzanak rekurzív policy-kiértékelést a `profiles` táblán saját magán.
- **Konkrét RLS policy-k** a `roles`/`profiles`/`audit_logs` táblákon a fenti szöveges szabály alapján: mindenki olvashatja a saját profilját és a `roles` referenciatáblát; `role_id in (1,2)` olvashatja az összes profilt; csak `super_admin` (1) módosíthat bármely profilt (pl. role kiosztás), egy felhasználó a sajátját szerkesztheti, de a `role_id`-t nem tudja saját magának módosítani.
- A `handle_new_user`/`log_table_change` trigger-függvényeken és a `current_user_role_id()`-n a public/anon RPC-elérés le van tiltva (`revoke execute ... from anon, authenticated`, `current_user_role_id`-nál csak `authenticated`-nek visszaadva) — a Supabase security advisor ezt jelezte, mivel alapból minden új public-séma függvényre EXECUTE jogot ad `anon`/`authenticated`-nek is.

### Globális beállítások (superadmin szerkeszti)

Egyetlen kulcs-érték tábla azoknak a beállításoknak, amiket a superadmin utólag, kód nélkül módosíthat — elsőként a kérdés-újrafelhasználási hűtési idő (lásd 2. szakasz), de bármi bővíthető ide később séma-módosítás nélkül.

```sql
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
  ('question_reuse_cooldown_months', '6');   -- superadmin ezt módosítja az admin felületen
```

RLS: mindenki olvashatja (kell a random-válogatás lekérdezéshez), csak `role_id = 1` (super_admin) írhatja.

---

## 2. Kérdésbank — normalizált, típusonként külön opció-tábla, témával cimkézve

```sql
-- Téma/kategória cimke — nagy, összesített kérdésbankon belül ezzel szűrsz.
-- FONTOS: ez tisztán tartalmi kategória, NEM vizuális köntös — a vizuális témák
-- külön táblában élnek (lásd 8. szakasz), hogy ne kelljen egy "Sport" tartalmi
-- kérdéscsokorhoz kötelezően "Sport" kinézetet társítani.
create table themes (
  id uuid primary key default gen_random_uuid(),
  title text unique not null             -- pl. "Sport", "Sex and the City", "Zene - 90-es évek"
);

-- Referencia tábla: milyen kérdéstípusok léteznek, admin felületen bővíthető
create table question_types (
  id smallint primary key,
  code text unique not null,             -- single_choice | multi_choice | slider | true_false | ordering
  label text not null,
  min_options smallint,                  -- pl. multi_choice: 6
  max_options smallint,                  -- pl. multi_choice: 8
  description text
);

insert into question_types (id, code, label, min_options, max_options, description) values
  (1, 'single_choice', 'Feleletválasztós (1 helyes)', 4, 4, 'Klasszikus 4 opciós, 1 helyes válasz'),
  (2, 'multi_choice', 'Több helyes válasz', 6, 8, '6-8 opció, több is jelölhető/helyes'),
  (3, 'slider', 'Csúszka (szám becslés)', null, null, 'Numerikus érték becslése tartományon belül'),
  (4, 'true_false', 'Igaz / Hamis', 2, 2, 'Fix két opció'),
  (5, 'ordering', 'Sorrendbe állítás', null, null, 'Elemek helyes sorrendbe rendezése');

-- Kérdés törzs — a nagy, összesített bank; a theme_id a kategória-cimke
create table questions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id),
  question_type_id smallint references question_types(id) not null,
  prompt text not null,
  image_url text,
  points integer default 1000,
  points_multiplier numeric default 1,   -- admin állítja: 2 = dupla pontos kérdés
  time_limit_seconds integer default 30,
  points_decay boolean default true,
  last_used_at timestamptz,              -- legutóbb mikor játszották le (cooldown-szűréshez)
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Kérdés ↔ kör kapcsolat: sok-a-sokhoz, hogy egy kérdés több estén (körben) is felhasználható legyen
create table round_questions (
  round_id uuid references rounds(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  order_index integer not null,
  used_at timestamptz default now(),      -- ebben a körben mikor játszották
  primary key (round_id, question_id)
);

-- Trigger: valahányszor egy kérdés bekerül egy körbe, frissül a last_used_at,
-- így a random-válogatás lekérdezés nem kell join-oljon a round_questions-re minden egyes híváskor
create or replace function update_question_last_used()
returns trigger as $$
begin
  update questions set last_used_at = NEW.used_at where id = NEW.question_id;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_update_question_last_used
  after insert on round_questions
  for each row execute function update_question_last_used();

-- single_choice / multi_choice / true_false közös opció-tábla
create table question_choice_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  option_text text not null,
  image_url text,
  is_correct boolean not null default false,
  order_index integer not null
);

-- slider típushoz
create table question_slider_config (
  question_id uuid primary key references questions(id) on delete cascade,
  min_value numeric not null,
  max_value numeric not null,
  step numeric not null default 1,
  correct_value numeric not null,
  tolerance numeric not null default 0    -- +/- ennyi eltérés még elfogadott
);

-- ordering típushoz
create table question_ordering_items (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  item_text text not null,
  correct_position smallint not null
);
```

**Hogyan működik a témázás + random válogatás gyakorlatban:**

1. Felviszed a kérdést a nagy, összesített bankba, és rákötöd egy `theme_id`-t (pl. "Sport"). `last_used_at` egyelőre `null` — sosem játszották még.
2. Egy kvízeste összeállításakor a rendszer a `theme_id` szerint szűrt kérdések közül **random választ**, de csak azok közül, amiket vagy sosem használtak, vagy a `question_reuse_cooldown_months` beállításnál régebben:

```sql
select q.*
from questions q, app_settings s
where q.theme_id = '<sport-theme-id>'
  and s.key = 'question_reuse_cooldown_months'
  and (
    q.last_used_at is null
    or q.last_used_at < now() - ((s.value #>> '{}')::int || ' months')::interval
  )
order by random()
limit 8;
```

3. A kiválasztott kérdéseket beszúrod a `round_questions`-be a célkörhöz — ez automatikusan frissíti a `last_used_at`-et a triggeren keresztül, tehát a kérdés a beállított hónapszámig kiesik a következő random húzásokból, utána viszont újra elérhető.
4. A superadmin bármikor módosíthatja az `app_settings`-ben a hónapszámot — nincs hozzá kód-változtatás, csak egy admin felületi mező.
5. **Dupla pontos kérdés:** a kérdésbank összeállítója a `points_multiplier` mezőt `2`-re állítja egy adott kérdésnél — ez a kérdés alap `points` értékét duplázza, függetlenül attól, hogy a csapat használ-e jokert (lásd 4. szakasz). A mező szám (nem boolean), így később háromszoros vagy más szorzó is bevezethető séma-módosítás nélkül.

**Miért így:** minden kérdéstípus saját táblában tárolja az opcióit → DB szinten kikényszeríthető a `min_options`/`max_options` (pl. constraint vagy trigger ellenőrzi, hogy `multi_choice`-nál 6-8 sor legyen a `question_choice_options`-ban), az admin felület pedig típusonként más szerkesztő komponenst renderel, ahelyett hogy egy laza jsonb mezőt kellene validálnia kliens oldalon.

**Igaz/Hamis** a `question_choice_options`-t használja fixen 2 sorral ("Igaz" / "Hamis") — nem kell külön tábla.

### Implementáció (Fázis 2, `supabase/migrations/20260808001114_question_bank.sql`)

- **`games`/`rounds` előrehozva Fázis 3-ból:** a `round_questions.round_id`
  FK-ja miatt a `games`/`rounds` táblák (4. szakasz) minimális
  oszlopkészlettel már itt létrejöttek — enélkül a `round_questions` nem
  lenne létrehozható. Fázis 3 erre építi rá a valós PIN/QR/lobby folyamatot,
  a `teams` táblát, és a `games.pin`-re tervezett részleges unique
  indexet (a jelenlegi `pin` oszlop egyszerű `unique not null`).
- **`draw_random_questions_for_round(p_theme_id, p_round_id, p_count)`**
  függvény valósítja meg a fenti random-húzás lekérdezést, kiegészítve egy
  "már ebben a körben van" kizárással (ismételt húzásnál ne próbáljon
  duplikátumot beszúrni a `round_questions` elsődleges kulcsa ellen) —
  részletek: `docs/features/random-draw.md`.
- RLS: `themes`/`question_types`/`questions`/`round_questions`/opció-táblák
  `role_id in (1,2)`-re (a fenti szöveges szabály szerint); `games`/`rounds`
  `role_id in (1,2,3)`-ra (host is vezérelheti). Az `app_settings` "mindenki
  olvashatja" szabályát `authenticated`-re értelmeztük (nem `anon`-ra),
  ugyanúgy, ahogy a Fázis 1 `profiles`/`roles` szabályainál.

---

## 3. Válaszok — normalizálva, típusonként külön tábla (valódi FK-kkal)

A `question_choice_options` / `question_slider_config` / `question_ordering_items` normalizált mintáját követve a válaszoknál is típusonként külön tábla van, valódi idegen kulcsokkal — nem szabad-formátumú jsonb, hogy a DB maga zárja ki az érvénytelen adatot (pl. nem létező vagy másik kérdéshez tartozó opció mentését).

```sql
-- Közös törzs, típus-független
create table answers (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  submitted_at timestamptz default now(),
  is_correct boolean,
  points_awarded integer default 0,
  answer_time_ms integer,
  unique (question_id, team_id)
);

-- single_choice / true_false
create table answer_choice (
  answer_id uuid primary key references answers(id) on delete cascade,
  option_id uuid not null references question_choice_options(id)
);

-- multi_choice
create table answer_choice_multi (
  answer_id uuid references answers(id) on delete cascade,
  option_id uuid references question_choice_options(id),
  primary key (answer_id, option_id)
);

-- slider
create table answer_slider (
  answer_id uuid primary key references answers(id) on delete cascade,
  value numeric not null
);

-- ordering
create table answer_ordering (
  answer_id uuid references answers(id) on delete cascade,
  item_id uuid references question_ordering_items(id),
  position smallint not null,
  primary key (answer_id, item_id)
);
```

| Típus                      | Tábla                 | Kiértékelés                                                                 |
| -------------------------- | --------------------- | --------------------------------------------------------------------------- |
| single_choice / true_false | `answer_choice`       | join `question_choice_options.is_correct` mezőre                            |
| multi_choice               | `answer_choice_multi` | lásd lent — nem egyszerű halmazegyezés, hanem 3 fokozatú szabály            |
| slider                     | `answer_slider`       | `abs(value - correct_value) <= tolerance`                                   |
| ordering                   | `answer_ordering`     | a `position`-ök egyeznek-e a `question_ordering_items.correct_position`-nel |

**Előnyök a jsonb-hez képest:**

- `option_id` valódi FK — nem menthető nem létező vagy másik kérdéshez tartozó opció, a DB elutasítja beszúráskor
- A kiértékelés egyszerű joinnal történik, nem string-kulcsokra hagyatkozó jsonb-parszolással
- Analitika (pl. "melyik opciót hányan választották") triviális `group by`-jal
- A típus-shape maga a séma kényszeríti ki, nem az app kód fegyelme

A kiértékelő logika egy közös Edge Function-be kerül (`evaluate_answer`), ami `question_type_id` alapján a megfelelő child táblába ír és számolja a pontot (decay-jal) — az `answers` törzsrekord `is_correct`/`points_awarded` mezőit ez tölti ki a join eredménye alapján.

**`multi_choice` kiértékelési szabály (3 fokozat):**

Legyen `N` a kérdéshez tartozó helyes opciók száma (`question_choice_options` ahol `is_correct = true`), a csapat beküldött opció-halmaza pedig `S` (`answer_choice_multi` sorai).

```
helyesen_bejelölt = |S ∩ helyes_opciók|
rosszul_bejelölt  = |S \ helyes_opciók|

ha rosszul_bejelölt > 0:              arány = 0        -- akár egy rossz jelölés is nullázza a pontot
különben ha helyesen_bejelölt = N:    arány = 1         -- mindet eltalálta, nincs rossz jelölés → teljes pont
különben:                              arány = helyesen_bejelölt / N   -- arányos részpont, ha nincs rossz jelölés, de nem mindet találta el
```

`is_correct = true` csak akkor, ha `arány = 1` (a ranglistán/reveal képernyőn ez számít "helyes válasznak"); a `points_awarded` viszont az arányos pontot is megkapja, tehát egy részben eltalált válasz is termel pontot, de nem jelenik meg zöld pipával.

**Pontszámítás a két szorzóval kombinálva (minden típusra, a `multi_choice` az `arány`-t is beleszámítja):**

```
alap_pont = points * (decay szorzó, ha points_decay = true) * (arány, csak multi_choice-nál, egyébként 1)
kérdés_szorzó = questions.points_multiplier            -- admin állítja, pl. 2 = dupla pontos kérdés
joker_szorzó  = 2, ha a csapat használt jokert erre a question_id-ra, egyébként 1

points_awarded = alap_pont * kérdés_szorzó * joker_szorzó
```

Vagyis ha egy admin által dupla pontosra állított kérdésen a csapat még a jokerét is bedobja, a végén 4x pontot kap — ezt az `evaluate_answer` egyetlen join-nal el tudja dönteni: `left join team_joker_uses on team_id = answers.team_id and question_id = answers.question_id`.

### Implementáció (Fázis 4, `supabase/migrations/20260808111917_answers_joker.sql`)

- Az `answers`/`answer_choice`/`answer_choice_multi`/`answer_slider`/
  `answer_ordering` táblák a fenti terv szerint jöttek létre.
  `is_correct`/`points_awarded` egyelőre kitöltetlen marad (`null`/`0`) —
  ezeket az `evaluate_answer` Edge Function tölti majd ki Fázis 5-ben, a
  fenti képlet szerint.
- **RLS: `anon` csak beszúrhat, nem olvashat.** Ez szándékos, és
  szigorúbb, mint amit egy egyszerű "csak a sajátomat lássam" szabály
  adna — mivel a csapatoknak nincs Supabase auth session-jük (csak
  `device_token`), RLS-szinten nem lehetne "csak a saját válaszod"
  szabályt kikényszeríteni; a "senki se olvashatja" az egyetlen módja
  annak, hogy a section 5 tervezési elve (kérdésenként senki sem lát
  folyamatos rangsort) ne bukjon meg azon, hogy bármelyik csapat
  lekérdezhetné a többiek `answers` sorait. A kliens ezért `.insert()`
  hívást használ `.select()` nélkül (a sikeres beszúrás hiánytalan
  hibaválasza az "elküldve" visszajelzés), és saját maga generálja az
  `answers.id`-t (`crypto.randomUUID()`), hogy a típusonkénti
  gyerektáblákba is tudjon írni a szülő sor visszaolvasása nélkül.
- **Cross-table RLS csapda:** az `answer_choice`/stb. insert policy-k
  eredetileg `exists (select 1 from answers a where ...)` alakú
  ellenőrzést használtak — ez viszont maga is az `answers` tábla RLS-e
  alá esett volna anon szerepkörben, ahol nincs SELECT policy, tehát az
  `exists` mindig hamisat adott volna. Megoldás: `answer_owner_game_active()`
  security definer segédfüggvény, ami megkerüli az RLS-t a belső
  lekérdezésnél (ugyanaz a minta, mint a `game_status()`/
  `current_user_role_id()` korábbi fázisokban). Ugyanez a hiba két helyen
  a Fázis 3 `teams` RLS-ben is előfordult, csak ott Fázis 4-ig
  észrevétlen maradt — javítva:
  `supabase/migrations/20260808113233_fix_anon_rls_gaps.sql`.
- **`team_joker_uses`:** `anon` csak olvashat (hogy a saját kliense el
  tudja dönteni, elhasználta-e már a jokerét), a beszúrást a host végzi a
  `joker_activate` broadcast fogadásakor — részletek:
  `docs/features/jokers.md`.
- **Fázis 2 hiba javítva:** a host (`role_id = 3`) eddig egyáltalán nem
  fért hozzá a kérdésbankhoz (`questions`/opció-táblák/`round_questions`/
  `themes`/`question_types`), pedig a DATA_MODEL.md 1. szakasza szerint
  futtathat estét meglévő kérdésbankból — ehhez olvasnia kell tudnia a
  kérdéseket. Kiegészítő select-only RLS policy-k kerültek `role_id in
(1,2,3)`-ra a meglévő admin `for all` (1,2) policy-k mellé.

### Implementáció (Fázis 5, `supabase/migrations/20260808115203_scoring.sql`)

- **`evaluate_question(p_question_id uuid)`** security definer RPC zárja le
  a fenti "Pontszámítás a két szorzóval kombinálva" képletet — a
  DATA_MODEL.md eredetileg "Edge Function"-t irányzott elő
  (`evaluate_answer`), a tényleges implementáció RPC lett helyette
  (indoklás, decay-képlet dokumentált döntése, teljes leírás:
  `docs/features/scoring.md`).
- **`team_answer_result(p_team_id, p_question_id)`** RPC adja vissza egy
  csapat saját kiértékelt eredményét — nem sima anon SELECT policy, mert
  RLS nem tud a lekérdezés paramétereihez kötni auth session nélkül
  (részletek: `docs/features/scoring.md`).
- **`round_leaderboard(p_round_id, p_limit)`** staff-only RPC az 5. szakasz
  kör-specifikus top N lekérdezéséhez, `teams`-ből indulva (nem
  `answers`-ből), hogy a 0 pontos csapatok is szerepeljenek.
- **Fázis 2 hiba javítva** (`20260808115901_fix_audit_log_entity_id.sql`):
  a `log_table_change()` audit trigger `coalesce(NEW.id, OLD.id)` típusos
  rekordmező-hozzáférést használt, ami runtime hibával elszállt minden
  olyan táblán, aminek NEM "id" az elsődleges kulcs oszlopa —
  `question_slider_config`-nál (PK: `question_id`) ez azt jelentette, hogy
  bármilyen INSERT/UPDATE/DELETE erre a táblára (tehát egy slider típusú
  kérdés admin felületen történő létrehozása/szerkesztése) eddig hibázott.
  A sandbox HTTPS-blokkolása miatt Fázis 2-ben ez nem derült ki élő
  böngészős teszttel; a Fázis 5-ös SQL-tesztfixturák felvitelekor bukott
  ki. Javítás: `to_jsonb(...)->>'id'` szöveges kiolvasás, ami hiányzó mező
  esetén null-t ad típushiba helyett.

---

## 4. `games` / `teams` / `rounds` (visszaállítva az eredeti, egyszerű felépítésre)

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  title text not null,
  status text not null default 'lobby',  -- lobby | active | paused | finished
  design_theme_id uuid references design_themes(id),  -- opcionális, lásd 8. szakasz (migrációs sorrend: design_themes előbb jön létre, lásd supabase_setup.sql)
  current_round_id uuid references rounds(id),
  current_question_id uuid references questions(id),
  current_question_started_at timestamptz,     -- Fázis L, lásd docs/features/timer.md
  current_question_duration_seconds integer,   -- Fázis L, lásd docs/features/timer.md
  host_id uuid references profiles(id),
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  name text not null,
  color text,
  device_token text not null,
  total_score integer default 0,
  joined_at timestamptz default now(),
  unique (game_id, name)
);

-- Csapat-joker: melyik kérdésen duplázott egy csapat. Egy csapat egy estén egyszer élhet vele.
create table team_joker_uses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  joker_type text not null default 'double_points',  -- bővíthető később más joker típusokkal, séma-módosítás nélkül
  used_at timestamptz default now(),
  unique (team_id, joker_type)   -- egy csapat egy adott jokerből csak egyet élhet fel egy estén (a teams sor eleve game-hez kötött)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  title text not null,
  order_index integer not null
);
```

Ez marad a legegyszerűbb: egy este = `games` sor, amihez körök tartoznak. A témázás **nem itt**, hanem a kérdésbanknál történik (lásd lent) — így a `games`/`rounds` felépítés nem bonyolódik, csak a kérdésbank kap egy kategória-cimkét.

**Hogyan működik a csapat-joker:** amíg egy kérdés aktív (a `timer_start` és `answer_locked` között), a csapat a saját felületén megnyomhat egy "Duplázás" gombot — ez egy `broadcast` eseményt küld (`joker_activate`), amit a host/backend `team_joker_uses`-be ír a `question_id`-vel. Az `unique (team_id, joker_type)` constraint miatt ez csak egyszer sikerülhet egy csapatnak egy estén — ha már felhasználta, a gomb a kliens oldalon eltűnik/inaktívvá válik (ezt a `team_joker_uses` lekérdezéséből lehet eldönteni betöltéskor).

### Implementáció (Fázis 3, `supabase/migrations/20260808105851_teams_join_flow.sql`)

- **`teams`** létrejött a fenti terv szerint (`team_joker_uses` még nem — az Fázis 4 scope-ja, a joker gombbal együtt).
- **`games.pin` részleges unique indexe:** a Fázis 2-ben létrehozott sima `unique` constraint (`games_pin_key`) helyett `games_pin_active_key` — csak `status <> 'finished'` sorokra kényszeríti ki az egyediséget, így egy lezárt kvízeste PIN-je később újra kiosztható. Ellenőrizve: két egyszerre aktív este nem kaphat azonos PIN-t, de egy `finished` este PIN-je szabadon újrafelhasználható.
- **RLS anonim (nem authentikált) csapat-klienseknek** — a csapatok `device_token`-nel (nem Supabase auth session-nel) azonosítják magukat, lásd `docs/architecture/REALTIME_PROTOCOL.md`:
  - `games`: `anon` csak `status = 'lobby'` sorokat láthat (PIN feloldáshoz a `/play/[pin]` csatlakozáskor).
  - `teams`: `anon` beszúrhat, ha a cél `games.status = 'lobby'`; olvashat minden nem `'finished'` játékhoz tartozó csapatot.
  - `teams_staff_all`: `role_id in (1,2,3)` (super_admin/admin/host) mindent lát/kezel — ugyanaz a kör, mint a `games`/`rounds` RLS-nél.
- **Ismert korlátozás (Fázis 4-ben javítva):** mivel az anon `games` SELECT
  csak `status = 'lobby'`-ra engedett, egy csapat nem tudott a PIN-en
  keresztül újracsatlakozni, ha a host már elindította az estét.

### Implementáció (Fázis 4, `supabase/migrations/20260808111917_answers_joker.sql` + `20260808113233_fix_anon_rls_gaps.sql`)

- **`team_joker_uses`** létrejött (lásd 3. szakasz implementációs
  jegyzete + `docs/features/jokers.md`).
- **Két RLS-hiba javítva a Fázis 3 `teams` policy-kban:**
  `teams_select_anon_active_game` és `teams_insert_anon_lobby` egy
  `exists (select 1 from games g where ...)` alakú ellenőrzést
  használtak, ami maga is a `games` tábla (akkori, `status = 'lobby'`-ra
  szűkített) RLS-e alá esett anon szerepkörben — emiatt a csapat-olvasás
  bármilyen nem-lobby (`active`/`paused`) estén hamisan mindig
  elutasított volt (a beszúrás policy-ja véletlenül helyesen működött,
  mert a kikényszerített állapot maga is `'lobby'` volt). Javítva a
  `game_status()` security definer segédfüggvénnyel.
- **Mid-game újracsatlakozás megoldva:** a `games` anon SELECT policy
  (`games_select_anon_lobby` → átnevezve `games_select_anon`)
  kiszélesítve `status <> 'finished'`-re. A `/play/[pin]` szerver-oldali
  PIN-feloldás (ami eldönti, felajánlható-e egy ÚJ csatlakozás) továbbra
  is csak `'lobby'`-ban ad vissza sort; egy már csatlakozott csapat
  (`localStorage` alapján) viszont a kliens oldalon, bármilyen nem
  `'finished'` állapotra újra le tudja kérdezni az este címét — lásd
  `docs/architecture/REALTIME_PROTOCOL.md`.

### Implementáció (Fázis L, `supabase/migrations/20260808130000_timer_enforcement.sql`)

- **`games.current_question_started_at` / `current_question_duration_seconds`
  új oszlopok** — a host `startTimer()`-je írja be, pontosan a
  `timer_start` broadcast-tal egyidejűleg, ugyanazzal a
  `server_start_time`/`duration` értékpárral.
- **Szerver-oldali timer-kikényszerítés az `answers` INSERT RLS-en**: a
  korábbi, csak `games.status = 'active'`-et ellenőrző `with check` ág
  kiegészült egy `answer_within_timer()` security-definer függvénnyel,
  ami elutasítja a beszúrást, ha a timer nem indult el, vagy a
  `duration` (+ 3mp türelmi idő) már lejárt. Részletek, indoklás és élő
  SQL-szimulációval igazolt tesztesetek: `docs/features/timer.md`.

---

## 5. Real-time protokoll (Broadcast csatorna: `game:{game_id}`)

**Feszültségkeltés miatt (jellemzően 3 kör egy estén) az összesített pontszám NEM látszik folyamatosan.** Kérdésenként csak a saját csapat pontja jelenik meg (`question_reveal`), a rangsor csak **kör végén, csak a top 3-mal**, a teljes, mindenkit tartalmazó végeredmény pedig csak az **utolsó kör top 3-a után**, a játék legvégén.

| Esemény                    | Küldő       | Payload                                                                                           | Kliens teendő                                                                          |
| -------------------------- | ----------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `team_joined`              | csapat      | `{team_id, name}`                                                                                 | host: lobby lista frissítése                                                           |
| `game_started`             | host        | `{}`                                                                                              | csapatok: lobby → várakozó képernyő                                                    |
| `question_show`            | host        | `{question_id, question_type, round_title, prompt, options/config, order_index, total_questions}` | csapatok: típus-specifikus válaszfelület renderelése                                   |
| `timer_start`              | host        | `{question_id, duration, server_start_time}`                                                      | csapatok: lokális visszaszámlálás                                                      |
| `joker_activate`           | csapat      | `{team_id, question_id, joker_type}`                                                              | host: rögzíti `team_joker_uses`-be, visszajelzés a csapatnak (siker/már felhasznált)   |
| `answer_locked`            | host / auto | `{question_id}`                                                                                   | csapatok: input letiltása                                                              |
| `question_reveal`          | host        | `{question_id, correct_answer, points_awarded}`                                                   | csapatok: helyes válasz + **csak a saját** kapott pontszám — nincs benne rangsor       |
| `round_leaderboard_reveal` | host        | `{round_id, round_title, top3: [{team_id, name, round_score, rank}]}`                             | mindenki (TV is): a **kör végén** csak a kör-specifikus top 3, nem az össz-pontszám    |
| `final_leaderboard_reveal` | host        | `{standings: [{team_id, name, total_score, rank}]}`                                               | mindenki: a **teljes, végleges** rangsor, mindenkivel, csak az utolsó kör top 3-a után |
| `game_finished`            | host        | `{}`                                                                                              | csapatok: végeredmény képernyőn marad, játék lezárva                                   |

**Kör-specifikus top 3 lekérdezése** (nem igényel új oszlopot, a meglévő `round_questions` kapcsolatból számolható):

```sql
select t.id, t.name, sum(a.points_awarded) as round_score
from answers a
join round_questions rq on rq.question_id = a.question_id and rq.round_id = :round_id
join teams t on t.id = a.team_id
where a.game_id = :game_id
group by t.id, t.name
order by round_score desc
limit 3;
```

A `final_leaderboard_reveal` ugyanezt számolja `round_id` szűrés nélkül, `limit` nélkül, `teams.total_score` alapján (ami amúgy is a kumulált pontszám).

Timer-minta (server_start_time + lokális visszaszámlálás + szerver-oldali validáció beküldésnél) — változatlan a korábbi döntéshez képest.

### Implementáció (Fázis 5)

A fenti kör-specifikus top N lekérdezés `round_leaderboard(p_round_id,
p_limit)` staff-only RPC-ként valósult meg, egy eltéréssel a fenti mintától:
`teams`-ből indul `left join`-nal `answers`-re (nem `answers`-ből `join`-nal
`teams`-re), hogy a 0 pontos vagy egyáltalán nem válaszoló csapatok is
szerepeljenek az összesítésben — enélkül egy csapat, aki egyszer sem
válaszolt a körben, ki sem szerepelne a rangsorban. A `final_leaderboard_reveal`-hez
nem kellett külön RPC, mivel a `teams.total_score`-t az `evaluate_question`
(3. szakasz) már folyamatosan karbantartja — a host kliens egyszerű
`order by total_score desc` lekérdezéssel jut hozzá. Részletek:
`docs/features/scoring.md`.

---

## 6. Audit log (ki mit csinált mikor)

Egy generikus, bővíthető napló-tábla — nem táblánként külön logger, hanem egy közös hely mindennek, amit később bővíthetsz anélkül, hogy a séma megváltozna.

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),      -- ki csinálta (null = rendszer/anonim csapat akció)
  action text not null,                        -- pl. 'question.create', 'game.start', 'role.change'
  entity_type text not null,                   -- pl. 'question', 'game', 'profile', 'answer'
  entity_id uuid,                               -- az érintett rekord id-ja
  before_data jsonb,                            -- állapot módosítás előtt (update/delete esetén)
  after_data jsonb,                             -- állapot módosítás után (insert/update esetén)
  metadata jsonb,                                -- szabad kiegészítő infó: ip, user_agent, game_id kontextus stb.
  created_at timestamptz default now()
);

create index idx_audit_logs_entity on audit_logs (entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs (actor_id, created_at desc);
create index idx_audit_logs_action on audit_logs (action, created_at desc);
```

**Két forrásból töltődik, és mindkettő ugyanabba a táblába ír:**

1. **Generikus DB trigger** — admin-jellegű CRUD táblákhoz (`questions`, `question_choice_options`, `profiles`/role-változás, stb.), hogy az adatmódosítás sose maradjon lekövetetlen, akkor sem, ha valaki közvetlenül az adatbázison keresztül nyúl hozzá:

```sql
create or replace function log_table_change()
returns trigger as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),   -- pl. 'questions.update'
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) end
  );
  return coalesce(NEW, OLD);
end;
$$ language plpgsql security definer;

-- Példa bekötés (később bármelyik táblára ráköthető, séma bővítés nélkül):
create trigger trg_audit_questions
  after insert or update or delete on questions
  for each row execute function log_table_change();
```

2. **Explicit app-oldali insert** — üzleti eseményekhez, amik nem egyszerű CRUD-ok (pl. `game.start`, `question.reveal`, `role.change` egy dedikált admin action gombból), ahol a `metadata` mezőbe kontextust is érdemes tenni (pl. `{game_id, pin}`).

**Miért ez a felépítés a jó "később fejleszthető" szempontból:**

- Új entitás naplózásához **nem kell séma-módosítás** — csak egy új trigger bekötés vagy egy új `insert into audit_logs(...)` hívás.
- Az `action` és `entity_type` szabad szöveg, tehát új eseménytípusokat bármikor bevezethetsz visszamenőleges kompatibilitás törése nélkül (ha később szigorítani akarod, rátehetsz egy `check` constraintet vagy egy referencia táblát, hasonlóan a `question_types` mintához).
- `before_data`/`after_data` jsonb-ben tárolja a teljes rekordot, így visszaállítható/diff-elhető, ha valaha kellene "ki törölte ezt a kérdést" típusú vizsgálat.
- RLS: `audit_logs`-t csak `super_admin` olvashatja; írás kizárólag a trigger/service-role útján történik, kliens sosem ír bele közvetlenül.

---

## 7. Négy felület

### Admin felület (`/admin`)

- Felhasználók + jogosultságok kezelése (csak `super_admin`)
- **Globális beállítások** (csak `super_admin`): pl. kérdés-újrafelhasználási cooldown hónapban (`app_settings`)
- **Kérdésbank CRUD:** kérdés felvitele/szerkesztése, `theme_id` cimkével kategorizálva, típusonként dedikált szerkesztő űrlap (pl. `multi_choice`-nál 6-8 opció mező dinamikusan, `slider`-nél min/max/tolerancia csúszka)
- **Estekonstrukció:** "Random húzás" gomb egy adott témára — a rendszer a cooldown-on kívüli kérdések közül automatikusan válogat, amit még finomíthatsz kézzel, mielőtt beszúrod a kör `round_questions` listájába. Bármelyik kérdésnél kipipálható a **"Dupla pontos kérdés"** (`points_multiplier = 2`)
- Témák (`themes`) és kérdéstípusok (`question_types`) karbantartása — tisztán tartalmi kategorizálás
- **Külön "Vizuális témák" menüpont:** `design_themes` CRUD (szín/font token szerkesztő, "alapértelmezett" jelölő) — nincs kapcsolat a tartalmi témákkal
- Korábbi kvízesték statisztikái, riportok

### Host felület (`/host/[game_id]`)

- Este indításakor **vizuális téma választása** a `design_themes` közül (nem kötelező — üresen hagyva az alapértelmezett érvényes), teljesen függetlenül attól, milyen tartalmi témájú kérdések futnak aznap
- Lobby: csatlakozott csapatok élő listája (Presence), QR + PIN
- Kör/kérdés vezérlő: "Következő kérdés", "Timer indítás", "Válaszok lezárása", "Megoldás feltárása"
- Élő beküldési számláló — Postgres Changes az `answers` táblán, jelezve azt is, ha egy csapat jokert használt az adott kérdésen
- Ranglista **csak kör végén** (top 3), a teljes összesítés csak az utolsó kör után — nincs folyamatos össz-pontszám kijelzés, hogy megmaradjon a feszültség
- **Nem** szerkeszthet kérdéseket/témákat itt — csak a már beosztott estét futtatja

### Csapat felület (`/play/[pin]`)

- Csatlakozás: PIN/QR → csapatnév → `device_token` localStorage-ban
- Várakozó képernyő
- Típus-specifikus válaszkomponensek: gombrács (choice), csúszka (slider), drag-and-drop lista (ordering)
- **"Duplázás" joker gomb** aktív kérdés közben — egyszer használható egy estén, utána inaktívvá válik (`team_joker_uses` alapján)
- Visszajelzés: helyes/helytelen, saját kapott pontszám (jelezve, ha szorzó érvényesült) — **nincs folyamatos rangsor**, csak kör végén a top 3

### TV / kivetítő felület (`/tv/[game_id]`) — **döntés: külön route, nem a host felület tabja**

- Csak megjelenítés, nincs rajta vezérlő elem — feliratkozik ugyanarra a `game:{game_id}` broadcast csatornára, mint a host és a csapatok
- Külön eszközön/böngészőben nyitva (projector/TV-hez csatlakoztatva), miközben a host a sajátján vezérel — így nem történhet baleset, hogy a host véletlenül a helyes választ vagy admin-nézetet vetíti ki a reveal előtt
- QR + PIN nagy méretben a lobby fázisban, aktív kérdésnél nagy betűs prompt + timer; kör végén top 3 animált reveal (`round_leaderboard_reveal`); a legvégén teljes végeredmény (`final_leaderboard_reveal`)
- Nem igényel saját táblát/oszlopot — pusztán egy read-only kliens, ami a meglévő broadcast eseményekre (`question_show`, `timer_start`, `question_reveal`, `round_leaderboard_reveal`, `final_leaderboard_reveal`) hallgat

### Implementáció (Fázis 6)

A `/tv/[game_id]` route ugyanazt az anon hozzáférési szintet használja, mint
a csapat kliens — nincs saját role-alapú route guard, a `games_select_anon`
RLS policy-ra támaszkodik. Broadcast-vezérelt állapotgép (lobby → kérdés +
timer → feltárás → kör-/végeredmény → lezárva), Presence a lobby-képernyő
élő csapatszámlálójához (a TV nem `track()`-el, csak `sync`-re figyel).
Részletek, beleértve a hozzáférési döntés indoklását:
`docs/features/tv-mode.md`.

---

## 8. Vizuális köntös / design téma rendszer

**Külön tábla, független a tartalmi `themes`-től.** Egy design téma (pl. "Retro Arcade") és egy tartalmi téma (pl. "Sport") két teljesen független dolog — egy estén bármelyik design témát bármelyik tartalmi kérdéscsokorral párosíthatod, nincs kényszerkapcsolat. Több alapértelmezett design téma is lesz, amik közül választhatsz.

```sql
create table design_themes (
  id uuid primary key default gen_random_uuid(),
  title text unique not null,             -- pl. "Retro Arcade", "Kocsmai Krétatábla"
  design_tokens jsonb not null,           -- a teljes CSS változó-készlet ehhez a témához, lásd lent
  is_default boolean not null default false,
  created_at timestamptz default now()
);

-- DB-szinten kikényszerítve: egyszerre csak EGY design téma lehet az alapértelmezett
create unique index idx_design_themes_default on design_themes (is_default) where is_default = true;

-- Ha egy admin egy másik témát jelöl alapértelmezettnek, a régi automatikusan leváltódik —
-- nem kell a UI-nak külön "előbb kapcsold ki a régit" logikát implementálnia
create or replace function enforce_single_default_design_theme()
returns trigger as $$
begin
  if NEW.is_default then
    update design_themes set is_default = false where id != NEW.id and is_default = true;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_single_default_design_theme
  before insert or update on design_themes
  for each row execute function enforce_single_default_design_theme();

-- Első seed: a jóváhagyott retro arcade stílusterv, alapértelmezettként megjelölve
insert into design_themes (title, design_tokens, is_default) values (
  'Retro Arcade',
  '{
    "--cabinet": "#150E2C",
    "--cabinet-2": "#211640",
    "--cabinet-3": "#2C1D54",
    "--marquee": "#F5F0FF",
    "--marquee-dim": "#A79BC9",
    "--cyan": "#35E7FF",
    "--magenta": "#FF3E9A",
    "--power": "#B6FF3E",
    "--danger": "#FF5A36",
    "--coin": "#FFD23E",
    "--violet": "#9B5CFF",
    "font_display": "Press Start 2P",
    "font_led": "Silkscreen",
    "font_body": "Inter"
  }'::jsonb,
  true
);
```

**Miért `design_tokens not null` (teljes készlet, nem csak felülírás):** a korábbi tervben ("felülíró kulcsok" a tartalmi `themes` táblán) hosszú távon hibaforrás lett volna — ha a kódban a hardcode-olt alap token-készlet valaha megváltozik, egy csak-felülírést tároló régi téma csendben, észrevétlenül más színt kapna. Egy önálló, teljes token-készletet tároló `design_themes` sor **stabil, önmagában értelmezhető** — nem függ a kód aktuális állapotától.

```sql
-- games tábla: a design_theme_id FÜGGETLEN a tartalmi témától, opcionális
-- (ha üres, az is_default=true design téma érvényes)
design_theme_id uuid references design_themes(id)
```

**Hogyan alkalmazódik futásidőben:**

```ts
// src/lib/theme/tokens.ts
export const defaultTokens = {/* ugyanaz a készlet, mint a seed — végső biztonsági háló */};

export function resolveTokens(designThemeTokens: Record<string, string> | null) {
	return { ...defaultTokens, ...(designThemeTokens ?? {}) };
}
```

```ts
// A host/csapat/TV betöltéskor:
// 1. Ha games.design_theme_id ki van töltve → az ahhoz tartozó design_themes.design_tokens
// 2. Ha nincs kitöltve → a design_themes sor, ahol is_default = true
// 3. Ha az sincs (elvileg nem fordulhat elő, de védőháló) → a kódban hardcode-olt defaultTokens
async function getActiveTokens(gameDesignThemeId: string | null) {
	const theme = gameDesignThemeId
		? await fetchDesignTheme(gameDesignThemeId)
		: await fetchDefaultDesignTheme();
	return resolveTokens(theme?.design_tokens ?? null);
}
```

A kapott objektum **inline style-ként kerül a gyökér elemre**, így minden alul lévő komponens, ami `var(--cyan)`-t használ, automatikusan a kiválasztott téma színét kapja, séma- vagy komponens-módosítás nélkül.

**Mit ad ez a felépítés:**

- Egy design téma **teljesen független** attól, milyen tartalmi témájú (`themes`) kérdésekkel fut az este — a host bármelyik design témát választhatja bármelyik tartalmi kérdéscsokorhoz, vagy maradhat az alapértelmezettnél
- Több alapértelmezett design téma lesz a `design_themes` táblában (most csak a Retro Arcade van seedelve, de a tábla eleve úgy készült, hogy bármikor bővíthető legyen újakkal, admin CRUD-on keresztül)
- A "melyik az alapértelmezett" kérdés **DB-szinten** garantáltan egyértelmű (részleges unique index + trigger), nem app-oldali fegyelemre bízott szabály
- Az admin felületen ez egy önálló "Vizuális témák" menüpont, elkülönítve a tartalmi "Témák" (kérdés-cimkék) szerkesztőjétől — a kettőt nem szabad összekeverni a UI-ban sem

### Implementáció (Fázis 6, `supabase/migrations/20260808123000_design_themes.sql`)

- A `design_themes` tábla, a `enforce_single_default_design_theme()` trigger
  és a Retro Arcade seed a fenti terv szerint jött létre. `games.design_theme_id`
  `alter table`-lel került fel (a `games` már Fázis 2 óta létezik).
- RLS: `role_id in (1,2)` teljes CRUD, `role_id in (1,2,3)` (host) csak
  olvas, `anon` (csapat + TV) is olvashat — a `design_tokens` tisztán
  vizuális adat, nincs benne védendő tartalom.
- A token feloldás (`games.design_theme_id` → `design_themes` sor → ha
  üres, `is_default = true` sor → ha az sincs, hardcode-olt fallback) és a
  CSS custom property-vé alakítás (`src/lib/theme/tokens.ts`) a host, a
  csapat és a TV felület mindegyikén ugyanúgy fut. Az admin CRUD
  (`/admin/design-themes`) a token-készletet szabad JSON-ként szerkeszti,
  nem fix mezőkkel — részletek, beleértve a betűtípus-betöltés ismert
  korlátját: `docs/features/design-themes.md`.

---

## 9. MVP fázisok

1. **Jogosultság + admin váz** — `roles`/`profiles`, auth, admin route védelem, `audit_logs` tábla + generikus trigger függvény bekötve a `profiles`/role-változásokra
2. **Kérdésbank CRUD** — `themes`, `question_types` + normalizált opció-táblák, `app_settings` (cooldown), `round_questions` join tábla + `last_used_at` trigger, típusonkénti admin űrlapok, audit trigger bekötve a kérdés-táblákra
3. **Csatlakozási flow** — PIN/QR, csapat regisztráció, lobby Presence
4. **Kérdés lebonyolítás** — broadcast protokoll, timer, típusonkénti válasz-UI + `evaluate_answer` Edge Function (normalizált `answer_choice`/`answer_choice_multi`/`answer_slider`/`answer_ordering` táblákba ír)
5. **Pontozás + ranglista** — decay-alapú pontszámítás, `points_multiplier` és `team_joker_uses` kombinált szorzó, élő leaderboard
6. **Polírozás** — hangeffektek, animációk, "TV mód" nagy kijelzőre

---

## Nyitott kérdések

- Hány kör/kérdés egy tipikus estén (kérdésbank UI méretezéséhez)?
