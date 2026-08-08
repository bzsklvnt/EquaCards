-- Phase 2: kérdésbank CRUD + témák + random húzás + cooldown
-- Séma forrás: docs/architecture/DATA_MODEL.md 2. szakasz (+ app_settings az
-- 1. szakaszból, ide ütemezve a fázis-lista szerint).
--
-- games/rounds: a round_questions FK-ja miatt előre kell hoznunk a
-- docs/architecture/DATA_MODEL.md 4. szakaszából a games/rounds táblákat
-- (a terv ezeket Fázis 3-hoz ütemezte) — a minimális oszlopkészlettel, hogy
-- a round_questions egyáltalán létrehozható legyen. Fázis 3 ráépíti a valós
-- PIN/lobby folyamatot és a `teams` táblát; a `games.pin`-re tervezett
-- részleges unique index (csak aktív állapotokra) is Fázis 3 dolga marad.

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
  ('question_reuse_cooldown_months', '6');

alter table app_settings enable row level security;

create policy "app_settings_select_authenticated" on app_settings
  for select to authenticated
  using (true);

create policy "app_settings_write_super_admin" on app_settings
  for all to authenticated
  using (public.current_user_role_id() = 1)
  with check (public.current_user_role_id() = 1);

create table themes (
  id uuid primary key default gen_random_uuid(),
  title text unique not null
);

create table question_types (
  id smallint primary key,
  code text unique not null,
  label text not null,
  min_options smallint,
  max_options smallint,
  description text
);

insert into question_types (id, code, label, min_options, max_options, description) values
  (1, 'single_choice', 'Feleletválasztós (1 helyes)', 4, 4, 'Klasszikus 4 opciós, 1 helyes válasz'),
  (2, 'multi_choice', 'Több helyes válasz', 6, 8, '6-8 opció, több is jelölhető/helyes'),
  (3, 'slider', 'Csúszka (szám becslés)', null, null, 'Numerikus érték becslése tartományon belül'),
  (4, 'true_false', 'Igaz / Hamis', 2, 2, 'Fix két opció'),
  (5, 'ordering', 'Sorrendbe állítás', null, null, 'Elemek helyes sorrendbe rendezése');

-- Minimális games/rounds — lásd a fájl fejlécében lévő megjegyzést.
create table games (
  id uuid primary key default gen_random_uuid(),
  pin text unique not null,
  title text not null,
  status text not null default 'lobby',
  current_round_id uuid,
  current_question_id uuid,
  host_id uuid references profiles(id),
  created_at timestamptz default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references games(id) on delete cascade,
  title text not null,
  order_index integer not null
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid references themes(id),
  question_type_id smallint references question_types(id) not null,
  prompt text not null,
  image_url text,
  points integer default 1000,
  points_multiplier numeric default 1,
  time_limit_seconds integer default 30,
  points_decay boolean default true,
  last_used_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- games.current_round_id / current_question_id nem kaphattak inline FK-t a
-- games/rounds/questions táblák körkörös függősége miatt (games előbb jön
-- létre, mint rounds és questions) — most, hogy mindhárom tábla létezik, itt
-- pótoljuk a docs/architecture/DATA_MODEL.md 4. szakasza szerinti FK-kat.
alter table games
  add constraint games_current_round_id_fkey foreign key (current_round_id) references rounds(id),
  add constraint games_current_question_id_fkey foreign key (current_question_id) references questions(id);

create table round_questions (
  round_id uuid references rounds(id) on delete cascade,
  question_id uuid references questions(id) on delete cascade,
  order_index integer not null,
  used_at timestamptz default now(),
  primary key (round_id, question_id)
);

create or replace function public.update_question_last_used()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update questions set last_used_at = NEW.used_at where id = NEW.question_id;
  return NEW;
end;
$$;

create trigger trg_update_question_last_used
  after insert on round_questions
  for each row execute function public.update_question_last_used();

create table question_choice_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  option_text text not null,
  image_url text,
  is_correct boolean not null default false,
  order_index integer not null
);

create table question_slider_config (
  question_id uuid primary key references questions(id) on delete cascade,
  min_value numeric not null,
  max_value numeric not null,
  step numeric not null default 1,
  correct_value numeric not null,
  tolerance numeric not null default 0
);

create table question_ordering_items (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references questions(id) on delete cascade,
  item_text text not null,
  correct_position smallint not null
);

-- RLS — docs/architecture/DATA_MODEL.md 1. szakasz: "RLS minden
-- admin-jellegű táblán (themes, questions, rounds, round_questions,
-- question_types, opció-táblák) role_id in (1,2)-re épül; games
-- indítás/vezérlés role_id in (1,2,3)-ra."

alter table themes enable row level security;
alter table question_types enable row level security;
alter table questions enable row level security;
alter table round_questions enable row level security;
alter table question_choice_options enable row level security;
alter table question_slider_config enable row level security;
alter table question_ordering_items enable row level security;
alter table games enable row level security;
alter table rounds enable row level security;

create policy "themes_admin_all" on themes
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "question_types_admin_all" on question_types
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "questions_admin_all" on questions
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "round_questions_admin_all" on round_questions
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "question_choice_options_admin_all" on question_choice_options
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "question_slider_config_admin_all" on question_slider_config
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

create policy "question_ordering_items_admin_all" on question_ordering_items
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

-- games/rounds: super_admin/admin/host (1,2,3) — "indítás/vezérlés"
create policy "games_staff_all" on games
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "rounds_staff_all" on rounds
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

-- Audit trigger bekötve a questions + típusonkénti opció-táblákra
-- (docs/architecture/DATA_MODEL.md 6. szakasz mintája).

create trigger trg_audit_questions
  after insert or update or delete on questions
  for each row execute function public.log_table_change();

create trigger trg_audit_question_choice_options
  after insert or update or delete on question_choice_options
  for each row execute function public.log_table_change();

create trigger trg_audit_question_slider_config
  after insert or update or delete on question_slider_config
  for each row execute function public.log_table_change();

create trigger trg_audit_question_ordering_items
  after insert or update or delete on question_ordering_items
  for each row execute function public.log_table_change();

-- Random húzás: cooldown-on kívüli, adott témájú kérdések közül választ,
-- és beszúrja a kör round_questions listájába (docs/architecture/DATA_MODEL.md
-- 2. szakasz mintája alapján, kiegészítve a round-on belüli duplikátum-
-- kizárással, hogy az ismételt húzás ne próbáljon már beválogatott kérdést
-- újra beszúrni — az ütközne a round_questions elsődleges kulcsával).

create or replace function public.draw_random_questions_for_round(
  p_theme_id uuid,
  p_round_id uuid,
  p_count integer default 8
)
returns setof questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown_months integer;
  v_next_order integer;
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select (value #>> '{}')::int into v_cooldown_months
  from app_settings where key = 'question_reuse_cooldown_months';

  select coalesce(max(order_index), 0) into v_next_order
  from round_questions where round_id = p_round_id;

  return query
  with picked as (
    select q.id
    from questions q
    where q.theme_id = p_theme_id
      and (
        q.last_used_at is null
        or q.last_used_at < now() - (v_cooldown_months || ' months')::interval
      )
      and q.id not in (
        select rq.question_id from round_questions rq where rq.round_id = p_round_id
      )
    order by random()
    limit p_count
  ), numbered as (
    select id, row_number() over () as rn from picked
  ), inserted as (
    insert into round_questions (round_id, question_id, order_index)
    select p_round_id, numbered.id, v_next_order + numbered.rn
    from numbered
    returning question_id
  )
  select q.* from questions q join inserted on inserted.question_id = q.id;
end;
$$;

-- Postgres grants EXECUTE on new functions to the PUBLIC pseudo-role by
-- default *and* Supabase separately grants it directly to anon/authenticated
-- — both need revoking (see docs/architecture/DATA_MODEL.md Fázis 1
-- megjegyzése erről ugyanígy a log_table_change-nél).
revoke execute on function public.draw_random_questions_for_round(uuid, uuid, integer) from public;
revoke execute on function public.draw_random_questions_for_round(uuid, uuid, integer) from anon, authenticated;
grant execute on function public.draw_random_questions_for_round(uuid, uuid, integer) to authenticated;

revoke execute on function public.update_question_last_used() from public;
revoke execute on function public.update_question_last_used() from anon, authenticated;
