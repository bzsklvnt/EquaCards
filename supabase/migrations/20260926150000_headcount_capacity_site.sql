-- Élesítés előtti kör (docs/features/landing-and-registration.md):
--   1. A létszámkorlát FŐBEN értendő (pl. 40 fő egy este), nem csapatban.
--   2. Egyetlen esemény nyilvános lekérdezése (eseményoldal).
--   3. Nyilvános oldal-adatok (üzemeltető, kapcsolat) az app_settings-ből.
--   4. "Letisztult" design téma, alapértelmezettként.
--   5. Adatmegőrzés: a jelentkezések az este után 30 nappal törlődnek.

-- 1. Létszámkorlát főben ------------------------------------------------------
alter table public.games rename column max_teams to max_players;
alter table public.games rename constraint games_max_teams_check to games_max_players_check;

-- A várólistát sorrendben nézi végig, és minden csapatot beenged, akinek a
-- létszáma még belefér (first-fit): egy nagy csapat nem tartja fel a mögötte
-- álló kisebbeket, de amint neki is felszabadul elég hely, ő jön először.
drop function public.promote_from_waitlist(uuid);

create function public.promote_from_waitlist(p_game_id uuid)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_used integer;
  v_ids uuid[] := '{}';
  r record;
begin
  select max_players into v_max from games where id = p_game_id;
  select coalesce(sum(headcount), 0) into v_used
    from team_registrations where game_id = p_game_id and status = 'confirmed';

  for r in
    select id, headcount from team_registrations
    where game_id = p_game_id and status = 'waitlist'
    order by created_at
    for update
  loop
    exit when v_max is not null and v_used >= v_max;
    if v_max is null or v_used + r.headcount <= v_max then
      update team_registrations set status = 'confirmed', promoted_at = now() where id = r.id;
      v_used := v_used + r.headcount;
      v_ids := v_ids || r.id;
    end if;
  end loop;

  return v_ids;
end;
$$;

revoke execute on function public.promote_from_waitlist(uuid) from public, anon, authenticated;

create or replace function public.register_team(
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
  v_used integer;
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

  select g.id, g.is_public, g.is_practice, g.status, g.scheduled_at, g.max_players
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

  select coalesce(sum(r.headcount), 0) into v_used
    from team_registrations r where r.game_id = p_game_id and r.status = 'confirmed';
  v_status := case
    when v_game.max_players is not null and v_used + p_headcount > v_game.max_players then 'waitlist'
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

drop function public.cancel_registration(uuid);

create function public.cancel_registration(p_token uuid)
returns table (cancelled_id uuid, promoted_ids uuid[])
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg team_registrations%rowtype;
  v_game record;
  v_promoted uuid[] := '{}';
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

drop function public.admin_cancel_registration(uuid);

create function public.admin_cancel_registration(p_id uuid)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_reg team_registrations%rowtype;
  v_promoted uuid[] := '{}';
begin
  if current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select * into v_reg from team_registrations where id = p_id;
  if v_reg.id is null or v_reg.status = 'cancelled' then
    return v_promoted;
  end if;
  perform 1 from games where id = v_reg.game_id for update;
  update team_registrations set status = 'cancelled', cancelled_at = now() where id = p_id;
  if v_reg.status = 'confirmed' then
    v_promoted := promote_from_waitlist(v_reg.game_id);
  end if;
  return v_promoted;
end;
$$;

-- A kezelő megemelte a létszámkorlátot: aki most belefér, bekerül.
create function public.admin_fill_from_waitlist(p_game_id uuid)
returns uuid[]
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  perform 1 from games where id = p_game_id for update;
  return promote_from_waitlist(p_game_id);
end;
$$;

-- 2. Nyilvános lekérdezések ----------------------------------------------------
drop function public.public_upcoming_events();

create function public.public_upcoming_events()
returns table (
  id uuid,
  title text,
  scheduled_at timestamptz,
  public_note text,
  max_players integer,
  confirmed_players bigint,
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
  select g.id, g.title, g.scheduled_at, g.public_note, g.max_players,
         (select coalesce(sum(r.headcount), 0) from team_registrations r where r.game_id = g.id and r.status = 'confirmed'),
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

-- Egy nyilvános este (közelgő vagy elmúlt) az eseményoldalhoz
create function public.public_event(p_id uuid)
returns table (
  id uuid,
  title text,
  scheduled_at timestamptz,
  public_note text,
  max_players integer,
  confirmed_players bigint,
  confirmed_teams bigint,
  waitlist_teams bigint,
  venue_name text,
  venue_address text,
  venue_city text,
  venue_maps_url text,
  registration_open boolean,
  is_past boolean,
  winner_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.title, g.scheduled_at, g.public_note, g.max_players,
         (select coalesce(sum(r.headcount), 0) from team_registrations r where r.game_id = g.id and r.status = 'confirmed'),
         (select count(*) from team_registrations r where r.game_id = g.id and r.status = 'confirmed'),
         (select count(*) from team_registrations r where r.game_id = g.id and r.status = 'waitlist'),
         v.name, v.address, v.city, v.maps_url,
         (g.status = 'lobby' and g.scheduled_at > now()),
         (g.scheduled_at <= now() or g.status <> 'lobby'),
         (select t.name from teams t where t.game_id = g.id and g.status = 'finished'
          order by coalesce(t.total_score, 0) desc, t.joined_at limit 1)
  from games g
  left join venues v on v.id = g.venue_id
  where g.id = p_id
    and g.is_public
    and not g.is_practice
    and g.scheduled_at is not null;
$$;

-- 3. Nyilvános oldal-adatok ----------------------------------------------------
insert into public.app_settings (key, value) values
  ('site_name', '"Kocsmakvízest"'),
  ('site_city', '""'),
  ('site_operator_name', '""'),
  ('site_contact_email', '""')
on conflict (key) do nothing;

create function public.public_site_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
  from app_settings
  where key like 'site\_%';
$$;

revoke execute on function public.cancel_registration(uuid) from public;
revoke execute on function public.admin_cancel_registration(uuid) from public, anon;
revoke execute on function public.admin_fill_from_waitlist(uuid) from public, anon;
revoke execute on function public.public_upcoming_events() from public;
revoke execute on function public.public_event(uuid) from public;
revoke execute on function public.public_site_info() from public;

grant execute on function public.cancel_registration(uuid) to anon, authenticated;
grant execute on function public.admin_cancel_registration(uuid) to authenticated;
grant execute on function public.admin_fill_from_waitlist(uuid) to authenticated;
grant execute on function public.public_upcoming_events() to anon, authenticated;
grant execute on function public.public_event(uuid) to anon, authenticated;
grant execute on function public.public_site_info() to anon, authenticated;

-- 4. Letisztult design téma, alapértelmezettként ---------------------------------
-- A --glow / --scanline / --panel-border / --field-* / --btn-primary* / --on-primary
-- tokenek a díszítéseket és a gomb-/mezőstílust vezérlik
-- (docs/architecture/DESIGN_SYSTEM.md); a régi témákban nincsenek meg, ott a
-- CSS fallback az arcade-os értéket adja.
insert into public.design_themes (title, is_default, design_tokens) values (
  'Letisztult',
  true,
  '{
    "--cabinet": "#F6F3EC",
    "--cabinet-2": "#FFFFFF",
    "--cabinet-3": "#F6F3EC",
    "--marquee": "#1C1B18",
    "--marquee-dim": "#5E5A52",
    "--cyan": "#1E5B4F",
    "--power": "#1F7A4D",
    "--danger": "#B3261E",
    "--coin": "#8A4B0B",
    "--violet": "#1E5B4F",
    "--magenta": "#A3326B",
    "--glow": "0",
    "--scanline": "transparent",
    "--panel-border": "#E4DED2",
    "--panel-border-width": "1px",
    "--field-border": "#D5CEC0",
    "--field-border-width": "1px",
    "--btn-primary": "#1E5B4F",
    "--btn-primary-hover": "#143F37",
    "--on-primary": "#FFFFFF",
    "font_display": "\"Fraunces\", Georgia, serif",
    "font_led": "\"Hanken Grotesk\", system-ui, sans-serif",
    "font_body": "\"Hanken Grotesk\", system-ui, sans-serif"
  }'::jsonb
);

update public.design_themes set title = 'Arcade (fun)' where title = 'Retro Arcade';

-- 5. Adatmegőrzés ---------------------------------------------------------------
create or replace function public.purge_old_registrations()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from team_registrations r
  using games g
  where g.id = r.game_id
    and coalesce(g.scheduled_at, g.created_at) < now() - interval '30 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.purge_old_registrations() from public, anon, authenticated;

create extension if not exists pg_cron;

select cron.schedule(
  'purge-old-registrations',
  '17 3 * * *',
  $$select public.purge_old_registrations()$$
);
