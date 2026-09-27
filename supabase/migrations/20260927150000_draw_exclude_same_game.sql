-- Egy kérdés egy estén csak egyszer szerepelhet: a random húzás az este
-- bármelyik körében már szereplő kérdést sem húzza (eddig csak az adott kör
-- kérdéseit zárta ki; a pihentetési idő 0 hónapnál duplikálhatott).
create or replace function public.draw_random_questions_for_round(p_theme_id uuid, p_round_id uuid, p_count integer default 8)
returns setof questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown_months integer;
  v_next_order integer;
  v_game_id uuid;
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select game_id into v_game_id from rounds where id = p_round_id;

  select (value #>> '{}')::int into v_cooldown_months
  from app_settings where key = 'question_reuse_cooldown_months';

  select coalesce(max(order_index), 0) into v_next_order
  from round_questions where round_id = p_round_id;

  return query
  with picked as (
    select q.id
    from questions q
    join question_types qt on qt.id = q.question_type_id
    where q.theme_id = p_theme_id
      and q.archived_at is null
      and qt.code <> 'info'
      and (
        q.last_used_at is null
        or q.last_used_at < now() - (v_cooldown_months || ' months')::interval
      )
      and q.id not in (
        select rq.question_id
          from round_questions rq
          join rounds r on r.id = rq.round_id
          where r.game_id = v_game_id
      )
    order by random()
    limit p_count
  ), numbered as (
    select id, row_number() over () as rn from picked
  ), inserted as (
    insert into round_questions (round_id, question_id, order_index)
    select p_round_id, numbered.id, v_next_order + numbered.rn
    from numbered
    returning question_id
  )
  select q.* from questions q join inserted on inserted.question_id = q.id;
end;
$$;
