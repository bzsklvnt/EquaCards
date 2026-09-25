-- Várólista, lemondás és automatikus előléptetés a csapatregisztrációhoz
-- (docs/features/landing-and-registration.md).

-- 1. "Megjelenik a landing oldalon" — a korábbi registration_open név
--    félrevezető volt: a jelentkezés automatikusan nyitva van, amíg az este
--    nyilvános, még nem kezdődött el és váró állapotban van.
alter table public.games rename column registration_open to is_public;

-- 2. Jelentkezési állapot + személyes lemondási token
alter table public.team_registrations
  add column status text not null default 'confirmed'
    check (status in ('confirmed', 'waitlist', 'cancelled')),
  add column cancel_token uuid not null default gen_random_uuid(),
  add column cancelled_at timestamptz,
  add column promoted_at timestamptz;

create unique index team_registrations_cancel_token_key
  on public.team_registrations (cancel_token);

-- Lemondott csapat neve újra felhasználható
drop index public.team_registrations_game_name_key;
create unique index team_registrations_game_name_key
  on public.team_registrations (game_id, lower(team_name))
  where status <> 'cancelled';

-- 3. Belső segéd: a várólista első csapatát előlépteti, ha van szabad hely.
--    A hívó felelős a games sor zárolásáért (for update).
create or replace function public.promote_from_waitlist(p_game_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_confirmed integer;
  v_id uuid;
begin
  select max_teams into v_max from games where id = p_game_id;
  select count(*) into v_confirmed
    from team_registrations where game_id = p_game_id and status = 'confirmed';
  if v_max is not null and v_confirmed >= v_max then
    return null;
  end if;

  select id into v_id
    from team_registrations
    where game_id = p_game_id and status = 'waitlist'
    order by created_at
    limit 1
    for update;
  if v_id is null then
    return null;
  end if;

  update team_registrations set status = 'confirmed', promoted_at = now() where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.promote_from_waitlist(uuid) from public, anon, authenticated;

-- 4. Jelentkezés: betelt estén hiba helyett várólistára kerül
drop function public.register_team(uuid, text, integer, text, text, text, text);

create function public.register_team(
  p_game_id uuid,
  p_team_name text,
  p_headcount integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text default null,
  p_note text default null
)
returns table (id uuid, status text, cancel_token uuid, waitlist_position integer)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game record;
  v_confirmed integer;
  v_status text;
  v_name text := btrim(coalesce(p_team_name, ''));
  v_contact text := btrim(coalesce(p_contact_name, ''));
  v_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_row team_registrations%rowtype;
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

  select g.id, g.is_public, g.is_practice, g.status, g.scheduled_at, g.max_teams
    into v_game
    from games g
    where g.id = p_game_id
    for update;

  if v_game.id is null
     or not v_game.is_public
     or v_game.is_practice
     or v_game.status <> 'lobby'
     or v_game.scheduled_at is null
     or v_game.scheduled_at <= now() then
    raise exception 'registration_closed';
  end if;

  if exists (
    select 1 from team_registrations r
    where r.game_id = p_game_id and r.status <> 'cancelled'
      and lower(r.team_name) = lower(v_name)
  ) then
    raise exception 'name_taken';
  end if;

  select count(*) into v_confirmed
    from team_registrations r where r.game_id = p_game_id and r.status = 'confirmed';
  v_status := case
    when v_game.max_teams is not null and v_confirmed >= v_game.max_teams then 'waitlist'
    else 'confirmed'
  end;

  insert into team_registrations
    (game_id, team_name, headcount, contact_name, contact_email, contact_phone, note, consent_at, status)
  values
    (p_game_id, v_name, p_headcount, v_contact, v_email, v_phone, v_note, now(), v_status)
  returning * into v_row;

  return query
    select v_row.id, v_row.status, v_row.cancel_token,
           case when v_row.status = 'waitlist' then (
             select count(*)::integer from team_registrations r
             where r.game_id = p_game_id and r.status = 'waitlist' and r.created_at <= v_row.created_at
           ) end;
end;
$$;

-- 5. Lemondás a személyes linkkel (a token birtokosa maga a csapat).
--    Visszaadja az esetleg előléptetett csapat azonosítóját (NEM az adatait) —
--    az értesítő e-mailt a szerver küldi ki.
create or replace function public.registration_by_token(p_token uuid)
returns table (
  team_name text,
  status text,
  game_title text,
  scheduled_at timestamptz,
  venue_name text,
  can_cancel boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.team_name, r.status, g.title, g.scheduled_at, v.name,
         (r.status <> 'cancelled' and g.status = 'lobby'
          and (g.scheduled_at is null or g.scheduled_at > now()))
  from team_registrations r
  join games g on g.id = r.game_id
  left join venues v on v.id = g.venue_id
  where r.cancel_token = p_token;
$$;

create or replace function public.cancel_registration(p_token uuid)
returns table (cancelled_id uuid, promoted_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg team_registrations%rowtype;
  v_game record;
  v_promoted uuid;
begin
  select * into v_reg from team_registrations where cancel_token = p_token;
  if v_reg.id is null then
    raise exception 'not_found';
  end if;

  select g.id, g.status, g.scheduled_at into v_game from games g where g.id = v_reg.game_id for update;
  if v_reg.status = 'cancelled' then
    raise exception 'already_cancelled';
  end if;
  if v_game.status <> 'lobby' or (v_game.scheduled_at is not null and v_game.scheduled_at <= now()) then
    raise exception 'too_late';
  end if;

  update team_registrations set status = 'cancelled', cancelled_at = now() where id = v_reg.id;
  if v_reg.status = 'confirmed' then
    v_promoted := promote_from_waitlist(v_reg.game_id);
  end if;

  return query select v_reg.id, v_promoted;
end;
$$;

-- 6. Kezelői műveletek (a jogosultságot a függvény maga ellenőrzi)
create or replace function public.admin_cancel_registration(p_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg team_registrations%rowtype;
  v_promoted uuid;
begin
  if current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select * into v_reg from team_registrations where id = p_id;
  if v_reg.id is null or v_reg.status = 'cancelled' then
    return null;
  end if;
  perform 1 from games where id = v_reg.game_id for update;
  update team_registrations set status = 'cancelled', cancelled_at = now() where id = p_id;
  if v_reg.status = 'confirmed' then
    v_promoted := promote_from_waitlist(v_reg.game_id);
  end if;
  return v_promoted;
end;
$$;

-- Kézi előléptetés (pl. ha a kezelő megemelte a létszámkorlátot)
create or replace function public.admin_promote_registration(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  update team_registrations
    set status = 'confirmed', promoted_at = now()
    where id = p_id and status = 'waitlist';
  return found;
end;
$$;

-- 7. Landing: közelgő és elmúlt esték
drop function public.public_upcoming_events();

create function public.public_upcoming_events()
returns table (
  id uuid,
  title text,
  scheduled_at timestamptz,
  public_note text,
  max_teams integer,
  confirmed_teams bigint,
  waitlist_teams bigint,
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
         (select count(*) from team_registrations r where r.game_id = g.id and r.status = 'confirmed'),
         (select count(*) from team_registrations r where r.game_id = g.id and r.status = 'waitlist'),
         v.name, v.address, v.city, v.maps_url
  from games g
  left join venues v on v.id = g.venue_id
  where g.is_public
    and not g.is_practice
    and g.status = 'lobby'
    and g.scheduled_at is not null
    and g.scheduled_at > now()
  order by g.scheduled_at;
$$;

create or replace function public.public_past_events(p_limit integer default 12)
returns table (
  id uuid,
  title text,
  scheduled_at timestamptz,
  venue_name text,
  venue_city text,
  team_count bigint,
  winner_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.title, g.scheduled_at, v.name, v.city,
         (select count(*) from teams t where t.game_id = g.id),
         (select t.name from teams t where t.game_id = g.id and g.status = 'finished'
          order by coalesce(t.total_score, 0) desc, t.joined_at limit 1)
  from games g
  left join venues v on v.id = g.venue_id
  where g.is_public
    and not g.is_practice
    and g.scheduled_at is not null
    and (g.scheduled_at <= now() or g.status <> 'lobby')
  order by g.scheduled_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

-- A csatlakozáskor felajánlott nevek: csak a megerősített csapatok
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
  where r.game_id = p_game_id and g.status = 'lobby' and r.status = 'confirmed'
  order by lower(r.team_name);
$$;

-- A public_recent_winners-t a public_past_events kiváltja
drop function public.public_recent_winners(integer);

revoke execute on function public.register_team(uuid, text, integer, text, text, text, text) from public;
revoke execute on function public.registration_by_token(uuid) from public;
revoke execute on function public.cancel_registration(uuid) from public;
revoke execute on function public.admin_cancel_registration(uuid) from public, anon;
revoke execute on function public.admin_promote_registration(uuid) from public, anon;
revoke execute on function public.public_upcoming_events() from public;
revoke execute on function public.public_past_events(integer) from public;

grant execute on function public.register_team(uuid, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.registration_by_token(uuid) to anon, authenticated;
grant execute on function public.cancel_registration(uuid) to anon, authenticated;
grant execute on function public.admin_cancel_registration(uuid) to authenticated;
grant execute on function public.admin_promote_registration(uuid) to authenticated;
grant execute on function public.public_upcoming_events() to anon, authenticated;
grant execute on function public.public_past_events(integer) to anon, authenticated;
