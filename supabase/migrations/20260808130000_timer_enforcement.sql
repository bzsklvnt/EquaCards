-- Fázis L: szerver-oldali timer-kikényszerítés. Eddig az answer_locked
-- kizárólag kliens-oldali UI-állapot volt (a submit gomb eltűnt), semmi
-- nem akadályozta meg DB-szinten, hogy egy módosított kliens a duration
-- lejárta után (vagy a timer_start broadcast előtt) is beszúrjon egy
-- answers sort. Lásd docs/features/timer.md.

alter table games
  add column current_question_started_at timestamptz,
  add column current_question_duration_seconds integer;

create or replace function answer_within_timer(p_game_id uuid, p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from games g
    where g.id = p_game_id
      and g.current_question_id = p_question_id
      and g.current_question_started_at is not null
      and g.current_question_duration_seconds is not null
      and now() <= g.current_question_started_at
                    + (g.current_question_duration_seconds + 3) * interval '1 second'
  );
$$;

revoke all on function answer_within_timer(uuid, uuid) from public;
grant execute on function answer_within_timer(uuid, uuid) to anon, authenticated;

drop policy if exists answers_insert_anon_active_game on answers;
create policy answers_insert_anon_active_game on answers
  for insert
  to anon
  with check (
    game_status(game_id) = 'active'
    and answer_within_timer(game_id, question_id)
  );
