-- Kvízeste törlése — csak rendszergazda (super_admin, role_id = 1).
--
-- Eddig a games_staff_all (ALL, role 1–3) policy minden kezelőnek megengedte
-- a törlést is. Most a SELECT/INSERT/UPDATE marad 1–3-nak, a DELETE csak 1-nek.
-- A törlés tovagyűrűzik (on delete cascade): körök + kérdés-hozzárendelések,
-- csapatok, válaszok, jokerek, jelentkezések. A kérdések a kérdésbankban
-- maradnak. Futó (active/paused) estét nem lehet törölni.

drop policy "games_staff_all" on public.games;

create policy "games_staff_select" on public.games
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

create policy "games_staff_insert" on public.games
  for insert to authenticated
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "games_staff_update" on public.games
  for update to authenticated
  using (public.current_user_role_id() in (1, 2, 3))
  with check (public.current_user_role_id() in (1, 2, 3));

create policy "games_super_admin_delete" on public.games
  for delete to authenticated
  using (public.current_user_role_id() = 1);

-- Hibakódok: insufficient_privilege (42501), not_found, game_running.
create or replace function public.admin_delete_game(p_game_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
begin
  if current_user_role_id() <> 1 then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  select * into v_game from games where id = p_game_id for update;
  if v_game.id is null then
    raise exception 'not_found';
  end if;
  if v_game.status in ('active', 'paused') then
    raise exception 'game_running';
  end if;
  delete from games where id = p_game_id;
  return v_game.title;
end;
$$;

revoke execute on function public.admin_delete_game(uuid) from public, anon;
grant execute on function public.admin_delete_game(uuid) to authenticated;
