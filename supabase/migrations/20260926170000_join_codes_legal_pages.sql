-- Csapatkód a csatlakozáshoz + Impresszum adatai
-- (docs/features/landing-and-registration.md "Csapatkód").
--
-- 1. Minden jelentkezés kap egy 6 karakteres csapatkódot (a visszaigazoló
--    e-mailben megy ki). Ha az estén be van kapcsolva a `join_requires_code`,
--    csak ezzel a kóddal lehet csatlakozni — a PIN önmagában nem elég. A kód
--    a játék indulása után is érvényes: késve érkező csapat csatlakozhat, egy
--    már csatlakozott csapat pedig másik telefonról visszaléphet vele.
-- 2. Helyszíni (előzetes jelentkezés nélküli) csapatnak a kezelő generál kódot.

-- Egyértelmű karakterek (nincs 0/O, 1/I/L), 31^6 ≈ 887 millió lehetőség. Az
-- oszlop alapértéke hívja, ezért a végrehajtási jog marad (ártalmatlan).
create or replace function public.generate_join_code()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (floor(random() * 31) + 1)::int, 1), '')
  from generate_series(1, 6);
$$;

alter table public.team_registrations
  add column join_code text not null default public.generate_join_code()
    check (join_code ~ '^[A-Z0-9]{6}$'),
  add column team_id uuid references public.teams(id) on delete set null;

create unique index team_registrations_game_join_code_key
  on public.team_registrations (game_id, join_code);

alter table public.games
  add column join_requires_code boolean not null default true;

-- A próbaestéken a szabad (név alapú) csatlakozás marad
update public.games set join_requires_code = false where is_practice;

-- register_team: a csapatkódot is visszaadja
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
returns table (id uuid, status text, cancel_token uuid, waitlist_position integer, join_code text)
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
           ) end,
           v_row.join_code;
end;
$$;

-- Csatlakozás csapatkóddal (anon). Hibakódok: game_not_found, invalid_code,
-- game_closed, name_taken.
create or replace function public.join_with_code(p_pin text, p_code text, p_device_token text)
returns table (
  team_id uuid,
  team_name text,
  game_id uuid,
  game_title text,
  design_theme_id uuid,
  rejoined boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_reg team_registrations%rowtype;
  v_team_id uuid;
  v_rejoined boolean := false;
begin
  if coalesce(btrim(p_device_token), '') = '' then
    raise exception 'invalid_input';
  end if;

  select * into v_game from games
    where pin = btrim(p_pin) and status <> 'finished'
    for update;
  if v_game.id is null then
    raise exception 'game_not_found';
  end if;

  select * into v_reg from team_registrations r
    where r.game_id = v_game.id
      and r.join_code = upper(btrim(coalesce(p_code, '')))
      and r.status = 'confirmed'
    for update;
  if v_reg.id is null then
    raise exception 'invalid_code';
  end if;

  -- Már csatlakozott: visszalépés (pl. másik telefonról)
  if v_reg.team_id is not null and exists (select 1 from teams t where t.id = v_reg.team_id) then
    update teams set device_token = p_device_token where id = v_reg.team_id;
    v_team_id := v_reg.team_id;
    v_rejoined := true;
  else
    if v_game.status not in ('lobby', 'active', 'paused') then
      raise exception 'game_closed';
    end if;
    -- Ha a csapat még kód nélkül, ugyanezzel a névvel lépett be, azt vesszük át
    select t.id into v_team_id from teams t
      where t.game_id = v_game.id and lower(t.name) = lower(v_reg.team_name);
    if v_team_id is not null then
      update teams set device_token = p_device_token where id = v_team_id;
      v_rejoined := true;
    else
      insert into teams (game_id, name, device_token)
        values (v_game.id, v_reg.team_name, p_device_token)
        returning id into v_team_id;
    end if;
    update team_registrations set team_id = v_team_id where id = v_reg.id;
  end if;

  return query
    select t.id, t.name, v_game.id, v_game.title, v_game.design_theme_id, v_rejoined
    from teams t where t.id = v_team_id;
end;
$$;

-- Helyszíni csapat: a kezelő vesz fel (a létszámkorláttól függetlenül).
create or replace function public.admin_add_walkin(p_game_id uuid, p_team_name text, p_headcount integer)
returns table (id uuid, join_code text)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_team_name, ''));
begin
  if current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 or p_headcount is null or p_headcount not between 1 and 12 then
    raise exception 'invalid_input';
  end if;
  if exists (
    select 1 from team_registrations r
    where r.game_id = p_game_id and r.status <> 'cancelled' and lower(r.team_name) = lower(v_name)
  ) then
    raise exception 'name_taken';
  end if;

  return query
    insert into team_registrations
      (game_id, team_name, headcount, contact_name, contact_email, consent_at, status, note)
    values
      (p_game_id, v_name, p_headcount, 'Helyszíni csapat', '', now(), 'confirmed', 'Helyszínen felvéve')
    returning team_registrations.id, team_registrations.join_code;
end;
$$;

revoke execute on function public.register_team(uuid, text, integer, text, text, text, text) from public;
revoke execute on function public.join_with_code(text, text, text) from public;
revoke execute on function public.admin_add_walkin(uuid, text, integer) from public, anon;

grant execute on function public.register_team(uuid, text, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.join_with_code(text, text, text) to anon, authenticated;
grant execute on function public.admin_add_walkin(uuid, text, integer) to authenticated;

-- 3. Impresszum (Ekertv. 4. §) — a rendszergazda a Beállításokban tölti ki
insert into public.app_settings (key, value) values
  ('site_address', '""'),
  ('site_tax_number', '""'),
  ('site_registration', '""')
on conflict (key) do nothing;

