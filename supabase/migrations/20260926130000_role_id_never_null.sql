-- Biztonsági javítás: a current_user_role_id() eddig NULL-t adott vissza, ha a
-- bejelentkezett felhasználónak nem volt profiles sora (vagy anon hívó volt).
-- A függvényekben használt `if current_user_role_id() not in (1, 2, 3) then
-- raise ...` minta NULL-ra nem dob hibát (NULL NOT IN (...) = NULL, nem true),
-- így egy profil nélküli bejelentkezett felhasználó átjutott volna a
-- jogosultság-ellenőrzésen (11 függvényt érintett). 0-t visszaadva minden
-- `in (...)` / `not in (...)` ellenőrzés és RLS policy helyesen viselkedik.
create or replace function public.current_user_role_id()
returns smallint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role_id from public.profiles where id = auth.uid()), 0)::smallint;
$$;
