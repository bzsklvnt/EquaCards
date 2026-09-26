-- Csapatkód — kényszerítés az adatbázisban is: ha az estén csapatkód kell, az anon
--    kliens a teams táblába közvetlenül (név alapján) nem szúrhat be — csak a
--    join_with_code() függvényen keresztül lehet csatlakozni.
create or replace function public.game_accepts_name_join(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from games g
    where g.id = p_game_id and g.status = 'lobby' and not g.join_requires_code
  );
$$;

revoke execute on function public.game_accepts_name_join(uuid) from public;
grant execute on function public.game_accepts_name_join(uuid) to anon, authenticated;

drop policy "teams_insert_anon_lobby" on public.teams;
create policy "teams_insert_anon_lobby" on public.teams
  for insert to anon
  with check (public.game_accepts_name_join(game_id));
