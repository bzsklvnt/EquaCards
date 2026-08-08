-- Phase 4: kérdés lebonyolítás (broadcast, timer, válasz-UI, joker)
-- Séma forrás: docs/architecture/DATA_MODEL.md 3. és 4. szakasz.

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

create table answer_choice (
  answer_id uuid primary key references answers(id) on delete cascade,
  option_id uuid not null references question_choice_options(id)
);

create table answer_choice_multi (
  answer_id uuid references answers(id) on delete cascade,
  option_id uuid references question_choice_options(id),
  primary key (answer_id, option_id)
);

create table answer_slider (
  answer_id uuid primary key references answers(id) on delete cascade,
  value numeric not null
);

create table answer_ordering (
  answer_id uuid references answers(id) on delete cascade,
  item_id uuid references question_ordering_items(id),
  position smallint not null,
  primary key (answer_id, item_id)
);

create table team_joker_uses (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  joker_type text not null default 'double_points',
  used_at timestamptz default now(),
  unique (team_id, joker_type)
);

alter table answers enable row level security;
alter table answer_choice enable row level security;
alter table answer_choice_multi enable row level security;
alter table answer_slider enable row level security;
alter table answer_ordering enable row level security;
alter table team_joker_uses enable row level security;

-- Segédfüggvény: egy game.status lekérdezése RLS-t megkerülve, hogy az anon
-- insert policy-k ne igényeljenek külön "games status olvasás" jogot anon-nak
-- (ugyanaz a minta, mint a current_user_role_id() a Fázis 1-ben).
create or replace function public.game_status(p_game_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select status from games where id = p_game_id;
$$;

revoke execute on function public.game_status(uuid) from public;
revoke execute on function public.game_status(uuid) from anon, authenticated;
grant execute on function public.game_status(uuid) to anon, authenticated;

-- Segédfüggvények egy adott answers / teams sor "tulajdonos game_id"-jának
-- állapotát adják vissza, RLS-t megkerülve. FONTOS, hogy ne sima
-- `exists (select 1 from answers a where ...)` mintát használjunk az
-- answer_choice/stb. és a team_joker_uses insert/select policy-kban: az az
-- EXISTS aluldeklaráltan MAGA IS a hivatkozott tábla (answers / teams) RLS-e
-- alá esne az anon szerepkörben — az answers-en pedig szándékosan nincs anon
-- select policy (lásd lent), a teams-en pedig csak szűkebb feltétellel van,
-- így az EXISTS mindig hamisat adna vissza, még helyes adatokra is. A
-- security definer függvény ezt kerüli meg (ugyanaz a minta, mint a
-- game_status() illetve a current_user_role_id() a Fázis 1-ben).
create or replace function public.answer_owner_game_active(p_answer_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from answers a
    where a.id = p_answer_id and public.game_status(a.game_id) = 'active'
  );
$$;

revoke execute on function public.answer_owner_game_active(uuid) from public;
revoke execute on function public.answer_owner_game_active(uuid) from anon, authenticated;
grant execute on function public.answer_owner_game_active(uuid) to anon;

create or replace function public.team_owner_game_status(p_team_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select public.game_status(t.game_id) from teams t where t.id = p_team_id;
$$;

revoke execute on function public.team_owner_game_status(uuid) from public;
revoke execute on function public.team_owner_game_status(uuid) from anon, authenticated;
grant execute on function public.team_owner_game_status(uuid) to anon;

-- answers / answer_* : a csapatok (anon) csak BESZÚRHATNAK, nem
-- OLVASHATNAK — szándékosan nincs anon select policy. A section 5 tervezési
-- elve szerint kérdésenként senki sem lát folyamatos rangsort/eredményt;
-- ha anon SELECT-et adnánk az answers-re, bármelyik csapat lekérdezhetné a
-- többiek válaszát/pontját még a feltárás előtt. A kliens az insert
-- sikerességét (hiba nincs) használja "elküldve" visszajelzésnek, nem a
-- visszaolvasott sort — ehhez a supabase-js insert hívást `.select()`
-- nélkül kell hívni, hogy ne kelljen return=representation olvasás, és a
-- kliens maga generálja az answers.id-t (crypto.randomUUID()), hogy a
-- típusonkénti gyerektáblákba is tudjon írni anélkül, hogy vissza kellene
-- olvasnia a szülő sort.
create policy "answers_insert_anon_active_game" on answers
  for insert to anon
  with check (public.game_status(game_id) = 'active');

create policy "answers_staff_all" on answers
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "answer_choice_insert_anon" on answer_choice
  for insert to anon
  with check (public.answer_owner_game_active(answer_id));

create policy "answer_choice_staff_all" on answer_choice
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "answer_choice_multi_insert_anon" on answer_choice_multi
  for insert to anon
  with check (public.answer_owner_game_active(answer_id));

create policy "answer_choice_multi_staff_all" on answer_choice_multi
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "answer_slider_insert_anon" on answer_slider
  for insert to anon
  with check (public.answer_owner_game_active(answer_id));

create policy "answer_slider_staff_all" on answer_slider
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "answer_ordering_insert_anon" on answer_ordering
  for insert to anon
  with check (public.answer_owner_game_active(answer_id));

create policy "answer_ordering_staff_all" on answer_ordering
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

-- team_joker_uses: a csapat saját kliense csak OLVAS (hogy tudja, elhasználta-e
-- már a jokerét — docs/architecture/DATA_MODEL.md 4. szakasz), a beszúrást a
-- host/backend végzi a joker_activate broadcast fogadásakor, nem a csapat
-- kliense közvetlenül.
create policy "team_joker_uses_select_anon" on team_joker_uses
  for select to anon
  using (public.team_owner_game_status(team_id) <> 'finished');

create policy "team_joker_uses_staff_all" on team_joker_uses
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

-- Fázis 2 hiba javítása: a host (role_id = 3) eddig egyáltalán nem fért
-- hozzá a kérdésbankhoz, pedig a DATA_MODEL.md 1. szakasza szerint
-- "host: futtathat kvízestét meglévő kérdésbankból" — ehhez OLVASNIA kell
-- tudnia a kérdéseket (írnia továbbra sem szabad). A questions_admin_all
-- stb. "for all" policy-k (1,2) mellé egy kiegészítő select-only policy
-- kerül (1,2,3)-ra; több megengedő policy ugyanarra a parancsra OR-ral
-- kombinálódik, tehát ez nem szűkíti az admin/super_admin jogokat.
create policy "questions_select_staff" on questions
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "question_choice_options_select_staff" on question_choice_options
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "question_slider_config_select_staff" on question_slider_config
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "question_ordering_items_select_staff" on question_ordering_items
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "round_questions_select_staff" on round_questions
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "themes_select_staff" on themes
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "question_types_select_staff" on question_types
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));
