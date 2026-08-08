-- Fázis B: /admin/users felhasználólistája megjeleníti az email címet is,
-- de a profiles tábla eddig nem tárolta (csak display_name/role_id) — az
-- auth.users.email a védett auth sémában van, service-role kulcs nélkül
-- nem érhető el az app szerver-oldali kliensével (nincs is ilyen kulcs
-- konfigurálva, lásd .env.example). Ahelyett, hogy bevezetnénk egy
-- service-role kliens + admin API hívást (nagyobb biztonsági felület egy
-- kis appban), egyszerűbb: a már meglévő handle_new_user() trigger
-- (Fázis 1) a signup pillanatában átmásolja az email-t is a public.profiles
-- táblába — ugyanaz a minta, mint a display_name-nél.

alter table profiles add column email text;

-- Egyszeri visszatöltés a már létező sorokra.
update profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email), new.email);
  return new;
end;
$$;
