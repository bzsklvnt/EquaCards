-- Phase 3: csatlakozási flow (PIN/QR, lobby)
-- Séma forrás: docs/architecture/DATA_MODEL.md 4. szakasz (teams), a games.pin
-- részleges unique indexe a Fázis 3 prompt explicit kérése szerint.

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

alter table teams enable row level security;

-- games.pin: a Fázis 2-ben létrehozott sima `unique` helyett részleges unique
-- index, csak az aktív (nem befejezett) esteken — így egy lezárt kvízeste
-- PIN-je később újra kiosztható, nem fogy el a 6 jegyű PIN-tér.
alter table games drop constraint games_pin_key;
create unique index games_pin_active_key on games (pin) where status <> 'finished';

-- Csapatok anonim (nem authentikált) kliensről csatlakoznak PIN-en keresztül —
-- nincs Supabase auth session, a "jogosultságukat" a device_token (kliens
-- oldalon generált, localStorage-ban tárolt, kitalálhatatlan azonosító)
-- adja, nem RLS-alapú sor-tulajdonlás. Ez a séma szándéka (lásd 4. szakasz:
-- "device_token localStorage-ban") — 40 fős kvízeste MVP-hez ez az elfogadott
-- biztonsági szint, nem bank-alkalmazás.
create policy "games_select_anon_lobby" on games
  for select to anon
  using (status = 'lobby');

create policy "teams_insert_anon_lobby" on teams
  for insert to anon
  with check (
    exists (select 1 from games g where g.id = game_id and g.status = 'lobby')
  );

create policy "teams_select_anon_active_game" on teams
  for select to anon
  using (
    exists (select 1 from games g where g.id = game_id and g.status <> 'finished')
  );

-- Staff (super_admin/admin/host) mindent lát/kezel a teams táblán — ugyanaz a
-- kör, mint a games/rounds RLS-nél (docs/architecture/DATA_MODEL.md 1. szakasz:
-- "games indítás/vezérlés role_id in (1,2,3)-ra").
create policy "teams_staff_all" on teams
  for all to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));
