-- Fázis O4 — élő tesztelés: a joker (Duplázás) szorzója nem érvényesült a
-- végső pontszámban. Az evaluate_question() SQL-logikája és a
-- team_joker_uses join élőben, rollback-kal lezárt szimulációval igazoltan
-- helyesen működik, HA a team_joker_uses sor létezik kiértékeléskor — a
-- tényleges gyökérok az eredeti (Fázis 4-es) tervezésben volt: a csapat
-- kliense nem írhatott közvetlenül a team_joker_uses-be (nincs neki anon
-- insert policy-ja), a beszúrást a host kliense végezte, a joker_activate
-- broadcast fogadásakor. Ez egy hálózati-kör-utazásos versenyhelyzetet
-- (csapat → Supabase Realtime → host → DB insert) vezetett be a
-- pontszámítás elé — ha a host gyorsan zár/tár fel, vagy a broadcast
-- késik/elveszik, a sor még nem létezik, amikor evaluate_question lefut.
--
-- Javítás: ugyanaz a bizalmi modell, amit az answers_insert_anon_active_game
-- policy már használ (docs/architecture/DATA_MODEL.md 3. szakasz, Fázis 4) —
-- a csapat kliense közvetlenül, szinkron módon írhat a team_joker_uses-be,
-- a games.current_question_id-hez kötve. A broadcast (joker_activate)
-- megmarad, de mostantól csak a host UI-visszajelzésére szolgál
-- ("Joker aktiválva egy csapat által."), nem a tényleges adatíráshoz.

create or replace function public.team_current_question(p_team_id uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select g.current_question_id
  from teams t join games g on g.id = t.game_id
  where t.id = p_team_id;
$$;

revoke execute on function public.team_current_question(uuid) from public;
revoke execute on function public.team_current_question(uuid) from anon, authenticated;
grant execute on function public.team_current_question(uuid) to anon, authenticated;

create policy "team_joker_uses_insert_anon_active_game" on team_joker_uses
  for insert to anon
  with check (
    public.team_owner_game_status(team_id) = 'active'
    and question_id = public.team_current_question(team_id)
  );
