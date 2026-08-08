-- Javítás a Fázis 3 migrációhoz (20260808105851_teams_join_flow.sql): a
-- teams_select_anon_active_game / teams_insert_anon_lobby policy-k
-- `exists (select 1 from games g where g.id = game_id and g.status = ...)`
-- alakú ellenőrzést használtak — ez a subquery viszont MAGA IS a games
-- tábla RLS-e alá esik az anon szerepkörben, ahol a games_select_anon_lobby
-- policy csak `status = 'lobby'`-ra enged olvasást. A join-beszúrás
-- (teams_insert_anon_lobby) emiatt véletlenül helyesen működött, mert a
-- kikényszerített állapot maga is 'lobby' volt; a csapat-olvasás
-- (teams_select_anon_active_game) viszont bármilyen nem-lobby (active/
-- paused) estén hamisan mindig elutasított — ez csak Fázis 4-ben derült ki,
-- amikor a host/csapat oldal már aktív állapotú estéken próbált teams-t
-- olvasni. A game_status() security definer segédfüggvénnyel (Fázis 4)
-- kerüljük meg az RLS-t a games olvasásánál.

drop policy "teams_select_anon_active_game" on teams;
create policy "teams_select_anon_active_game" on teams
  for select to anon
  using (public.game_status(game_id) <> 'finished');

drop policy "teams_insert_anon_lobby" on teams;
create policy "teams_insert_anon_lobby" on teams
  for insert to anon
  with check (public.game_status(game_id) = 'lobby');

-- Fázis 4: a games_select_anon_lobby (csak status = 'lobby') miatt egy már
-- csatlakozott csapat, ha újratölti az oldalt azután, hogy a host elindította
-- az estét, "nem található" hibát kapott — a /play/[pin] szerver-oldali load
-- csak 'lobby' állapotú games sort talált. Kiszélesítve 'finished'-en kívül
-- mindenre, hogy egy már csatlakozott csapat (localStorage alapján) a kliens
-- oldalon újra le tudja kérdezni az este címét, miközben az új csatlakozás
-- (join form megjelenítése + teams insert) továbbra is csak 'lobby'-ban
-- engedélyezett — lásd src/routes/play/[pin]/+page.svelte.
drop policy "games_select_anon_lobby" on games;
create policy "games_select_anon" on games
  for select to anon
  using (status <> 'finished');
