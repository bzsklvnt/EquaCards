-- Landing oldal + csapatregisztráció egy konkrét kvízestére ("A" opció,
-- docs/features/landing-and-registration.md). Több helyszínre felkészítve.

-- 1. Helyszínek -------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  address text check (address is null or char_length(address) <= 160),
  city text check (city is null or char_length(city) <= 80),
  maps_url text check (maps_url is null or maps_url ~ '^https?://'),
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;

create policy "venues_admin_all" on public.venues
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

-- 2. Esemény-adatok a kvízestén ---------------------------------------------
-- registration_open: az este megjelenik a landing oldalon, és lehet rá
-- jelentkezni (a kezdésig, amíg van hely).
alter table public.games
  add column scheduled_at timestamptz,
  add column venue_id uuid references public.venues(id) on delete set null,
  add column registration_open boolean not null default false,
  add column max_teams integer check (max_teams is null or max_teams > 0),
  add column public_note text check (public_note is null or char_length(public_note) <= 1000);

-- 3. Csapatregisztrációk ----------------------------------------------------
-- Elérhetőségi adatokat tartalmaz: anon kliens SEMMILYEN módon nem olvashatja,
-- beszúrni is csak a register_team() függvényen keresztül lehet.
create table public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  team_name text not null check (char_length(team_name) between 1 and 40),
  headcount integer not null check (headcount between 1 and 12),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  contact_email text not null check (char_length(contact_email) <= 254),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 30),
  note text check (note is null or char_length(note) <= 500),
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index team_registrations_game_name_key
  on public.team_registrations (game_id, lower(team_name));

alter table public.team_registrations enable row level security;

create policy "team_registrations_staff_select" on public.team_registrations
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "team_registrations_staff_delete" on public.team_registrations
  for delete to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

-- 4. Nyilvános függvények a landing oldalhoz ---------------------------------
create or replace function public.public_upcoming_events()
returns table (
  id uuid,
  title text,
  scheduled_at timestamptz,
  public_note text,
  max_teams integer,
  registered_teams bigint,
  venue_name text,
  venue_address text,
  venue_city text,
  venue_maps_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.title, g.scheduled_at, g.public_note, g.max_teams,
         (select count(*) from team_registrations r where r.game_id = g.id),
         v.name, v.address, v.city, v.maps_url
  from games g
  left join venues v on v.id = g.venue_id
  where g.registration_open
    and not g.is_practice
    and g.status <> 'finished'
    and g.scheduled_at is not null
    and g.scheduled_at > now() - interval '3 hours'
  order by g.scheduled_at;
$$;

-- Atomikus jelentkezés: a games sort zárolja, így két egyidejű jelentkezés
-- sem lépheti túl a max_teams-et, és nem kaphat két csapat azonos nevet.
-- Hibakódok (a kliens ezekre képez magyar üzenetet): invalid_input,
-- registration_closed, event_full, name_taken.
create or replace function public.register_team(
  p_game_id uuid,
  p_team_name text,
  p_headcount integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text default null,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game record;
  v_count integer;
  v_name text := btrim(coalesce(p_team_name, ''));
  v_contact text := btrim(coalesce(p_contact_name, ''));
  v_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if char_length(v_name) not between 1 and 40
     or char_length(v_contact) not between 1 and 80
     or p_headcount is null or p_headcount not between 1 and 12
     or char_length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or (v_phone is not null and char_length(v_phone) > 30)
     or (v_note is not null and char_length(v_note) > 500) then
    raise exception 'invalid_input';
  end if;

  select id, registration_open, is_practice, status, scheduled_at, max_teams
    into v_game
    from games
    where id = p_game_id
    for update;

  if v_game.id is null
     or not v_game.registration_open
     or v_game.is_practice
     or v_game.status <> 'lobby'
     or v_game.scheduled_at is null
     or v_game.scheduled_at <= now() then
    raise exception 'registration_closed';
  end if;

  select count(*) into v_count from team_registrations where game_id = p_game_id;
  if v_game.max_teams is not null and v_count >= v_game.max_teams then
    raise exception 'event_full';
  end if;

  if exists (
    select 1 from team_registrations
    where game_id = p_game_id and lower(team_name) = lower(v_name)
  ) then
    raise exception 'name_taken';
  end if;

  insert into team_registrations
    (game_id, team_name, headcount, contact_name, contact_email, contact_phone, note, consent_at)
  values
    (p_game_id, v_name, p_headcount, v_contact, v_email, v_phone, v_note, now())
  returning id into v_id;

  return v_id;
end;
$$;

-- Csatlakozáskor a /play oldal felajánlja a regisztrált csapatneveket
-- (csak a név, semmi elérhetőség; csak váró állapotú estére).
create or replace function public.registered_team_names(p_game_id uuid)
returns table (team_name text)
language sql
stable
security definer
set search_path = public
as $$
  select r.team_name
  from team_registrations r
  join games g on g.id = r.game_id
  where r.game_id = p_game_id and g.status = 'lobby'
  order by lower(r.team_name);
$$;

-- A landing "Legutóbbi győztesek" blokkja: a lezárult, valódi esték
-- győztes csapata (a csapatnevek a kivetítőn is nyilvánosak voltak).
create or replace function public.public_recent_winners(p_limit integer default 5)
returns table (game_title text, finished_at timestamptz, team_name text, total_score integer)
language sql
stable
security definer
set search_path = public
as $$
  select g.title, g.finished_at, w.name, w.total_score
  from games g
  cross join lateral (
    select t.name, coalesce(t.total_score, 0) as total_score
    from teams t
    where t.game_id = g.id
    order by coalesce(t.total_score, 0) desc, t.joined_at
    limit 1
  ) w
  where g.status = 'finished' and not g.is_practice
  order by g.finished_at desc nulls last
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke execute on function public.public_upcoming_events() from public;
revoke execute on function public.register_team(uuid, text, integer, text, text, text, text) from public;
revoke execute on function public.registered_team_names(uuid) from public;
revoke execute on function public.public_recent_winners(integer) from public;

grant execute on function public.public_upcoming_events() to anon, authenticated;
grant execute on function public.register_team(uuid, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.registered_team_names(uuid) to anon, authenticated;
grant execute on function public.public_recent_winners(integer) to anon, authenticated;
