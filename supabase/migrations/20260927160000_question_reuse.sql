-- Újrajátszható kérdések (docs/features/question-reuse.md): egy már
-- lejátszott kérdés másik estén (akár egyszerre két helyszínen) újra
-- játszható. Eddig a kiértékelés és a „feltárva” állapot a kérdés ÖSSZES
-- korábbi válaszát nézte, nem csak az aktuális estéét.

-- 1. Kiértékelés estére szűrve. A régi, egyparaméteres változat helyett
-- (a p_game_id nélküli hívás a korábbi viselkedést adja).
drop function if exists public.host_reveal(uuid);
drop function if exists public.evaluate_question(uuid);

create or replace function public.evaluate_question(p_question_id uuid, p_game_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question record;
  v_n_correct int;
  v_answer record;
  v_correct_selected int;
  v_wrong_count int;
  v_ratio numeric;
  v_is_correct boolean;
  v_decay numeric;
  v_joker_mult numeric;
  v_points integer;
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select q.id, q.points, q.points_multiplier, q.points_decay, q.time_limit_seconds, qt.code as type_code
    into v_question
    from questions q
    join question_types qt on qt.id = q.question_type_id
    where q.id = p_question_id;

  if not found then
    raise exception 'question_not_found';
  end if;

  if v_question.type_code = 'multi_choice' then
    select count(*) into v_n_correct
      from question_choice_options
      where question_id = p_question_id and is_correct;
  end if;

  -- Csak a megadott este válaszai (ha meg van adva): két helyszín egyszerre is
  -- játszhatja ugyanazt a kérdést, az egyik feltárása a másikat nem érinti.
  for v_answer in
    select a.id, a.team_id, a.answer_time_ms
      from answers a
      where a.question_id = p_question_id and a.is_correct is null
        and (p_game_id is null or a.game_id = p_game_id)
  loop
    v_is_correct := false;
    v_ratio := 0;

    if v_question.type_code in ('single_choice', 'true_false') then
      select coalesce(qco.is_correct, false) into v_is_correct
        from answer_choice ac
        join question_choice_options qco on qco.id = ac.option_id
        where ac.answer_id = v_answer.id;

    elsif v_question.type_code = 'multi_choice' then
      select coalesce(count(*) filter (where qco.is_correct), 0),
             coalesce(count(*) filter (where not qco.is_correct), 0)
        into v_correct_selected, v_wrong_count
        from answer_choice_multi acm
        join question_choice_options qco on qco.id = acm.option_id
        where acm.answer_id = v_answer.id;

      if v_wrong_count > 0 or v_n_correct is null or v_n_correct = 0 then
        v_ratio := 0;
      elsif v_correct_selected = v_n_correct then
        v_ratio := 1;
      else
        v_ratio := v_correct_selected::numeric / v_n_correct;
      end if;

      v_is_correct := (v_ratio = 1);

    elsif v_question.type_code = 'slider' then
      select coalesce(abs(asl.value - qsc.correct_value) <= qsc.tolerance, false) into v_is_correct
        from answer_slider asl
        join question_slider_config qsc on qsc.question_id = p_question_id
        where asl.answer_id = v_answer.id;

    elsif v_question.type_code = 'ordering' then
      select exists (select 1 from answer_ordering ao where ao.answer_id = v_answer.id)
        and not exists (
          select 1
            from answer_ordering ao
            join question_ordering_items qoi on qoi.id = ao.item_id
            where ao.answer_id = v_answer.id
              and ao.position <> qoi.correct_position
        )
        into v_is_correct;
    end if;

    v_is_correct := coalesce(v_is_correct, false);
    if v_question.type_code != 'multi_choice' then
      v_ratio := case when v_is_correct then 1 else 0 end;
    end if;

    if v_question.points_decay and v_question.time_limit_seconds > 0 and v_answer.answer_time_ms is not null then
      v_decay := greatest(0.5, 1 - 0.5 * least(1.0, v_answer.answer_time_ms::numeric / (v_question.time_limit_seconds * 1000)));
    else
      v_decay := 1;
    end if;

    v_joker_mult := case
      when exists (
        select 1 from team_joker_uses tju
          where tju.team_id = v_answer.team_id
            and tju.question_id = p_question_id
            and tju.joker_type = 'double_points'
      ) then 2
      else 1
    end;

    v_points := round(v_question.points * v_decay * v_ratio * v_question.points_multiplier * v_joker_mult);

    update answers
      set is_correct = v_is_correct,
          points_awarded = v_points
      where id = v_answer.id;

    update teams
      set total_score = total_score + v_points
      where id = v_answer.team_id;
  end loop;
end;
$$;

revoke all on function public.evaluate_question(uuid, uuid) from public, anon;
grant execute on function public.evaluate_question(uuid, uuid) to authenticated;


create or replace function public.host_reveal(p_question_id uuid, p_game_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_options jsonb;
  v_slider numeric;
  v_ordering jsonb;
begin
  perform public.evaluate_question(p_question_id, p_game_id);

  select qt.code into v_code
    from questions q join question_types qt on qt.id = q.question_type_id
    where q.id = p_question_id;

  if v_code in ('single_choice', 'multi_choice', 'true_false') then
    select jsonb_agg(jsonb_build_object('id', id, 'option_text', option_text, 'is_correct', is_correct)
                     order by order_index)
      into v_options from question_choice_options where question_id = p_question_id;
  elsif v_code = 'slider' then
    select correct_value into v_slider from question_slider_config where question_id = p_question_id;
  elsif v_code = 'ordering' then
    select jsonb_agg(jsonb_build_object('id', id, 'item_text', item_text) order by correct_position)
      into v_ordering from question_ordering_items where question_id = p_question_id;
  end if;

  return jsonb_build_object('options', v_options, 'correct_value', v_slider, 'ordering', v_ordering);
end;
$$;
revoke all on function public.host_reveal(uuid, uuid) from public, anon;
grant execute on function public.host_reveal(uuid, uuid) to authenticated;

-- 2. Állapot-visszatöltés: a „feltárva” és a helyes válasz csak ennek az
-- estének a válaszaiból.
create or replace function public.current_question_state(p_game_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_game record;
  v_question record;
  v_round_title text;
  v_order_index int;
  v_total int;
  v_options jsonb;
  v_slider jsonb;
  v_ordering jsonb;
  v_revealed boolean;
  v_correct_answer text;
begin
  select status, current_question_id, current_round_id,
         current_question_started_at, current_question_duration_seconds,
         current_question_reading_seconds
    into v_game
    from games
    where id = p_game_id;

  if v_game is null or v_game.current_question_id is null then
    return jsonb_build_object('question_id', null);
  end if;

  select q.id, q.prompt, q.image_url, q.image_pixelate, q.time_limit_seconds, qt.code,
         q.layout, q.info_text, q.video_id, q.video_start, q.video_end, q.video_gate
    into v_question
    from questions q
    join question_types qt on qt.id = q.question_type_id
    where q.id = v_game.current_question_id;

  select r.title into v_round_title from rounds r where r.id = v_game.current_round_id;

  select x.pos into v_order_index
    from (
      select rq.question_id, row_number() over (order by rq.order_index) - 1 as pos
        from round_questions rq
        join questions q on q.id = rq.question_id
        join question_types qt on qt.id = q.question_type_id
        where rq.round_id = v_game.current_round_id and qt.code <> 'info'
    ) x
    where x.question_id = v_game.current_question_id;

  select count(*) into v_total
    from round_questions rq
    join questions q on q.id = rq.question_id
    join question_types qt on qt.id = q.question_type_id
    where rq.round_id = v_game.current_round_id and qt.code <> 'info';

  if v_question.code in ('single_choice', 'multi_choice', 'true_false') then
    select jsonb_agg(
             jsonb_build_object('id', id, 'option_text', option_text, 'image_url', image_url)
             order by order_index
           )
      into v_options
      from question_choice_options
      where question_id = v_question.id;
  elsif v_question.code = 'slider' then
    select jsonb_build_object('min_value', min_value, 'max_value', max_value, 'step', step)
      into v_slider
      from question_slider_config
      where question_id = v_question.id;
  elsif v_question.code = 'ordering' then
    select jsonb_agg(jsonb_build_object('id', id, 'item_text', item_text) order by item_text)
      into v_ordering
      from question_ordering_items
      where question_id = v_question.id;
  end if;

  -- Csak ennek az estének a válaszai: ugyanaz a kérdés más estén is elhangozhatott.
  select exists (
    select 1 from answers
    where question_id = v_game.current_question_id and game_id = p_game_id
      and is_correct is not null
  ) into v_revealed;

  if v_revealed then
    if v_question.code in ('single_choice', 'multi_choice', 'true_false') then
      select string_agg(option_text, ', ' order by order_index) into v_correct_answer
        from question_choice_options
        where question_id = v_question.id and is_correct;
    elsif v_question.code = 'slider' then
      select correct_value::text into v_correct_answer
        from question_slider_config
        where question_id = v_question.id;
    elsif v_question.code = 'ordering' then
      select string_agg(item_text, ' → ' order by correct_position) into v_correct_answer
        from question_ordering_items
        where question_id = v_question.id;
    end if;
  end if;

  return jsonb_build_object(
    'question_id', v_question.id,
    'question_type', v_question.code,
    'round_title', coalesce(v_round_title, ''),
    'prompt', v_question.prompt,
    'image_url', v_question.image_url,
    'image_pixelate', v_question.image_pixelate,
    'time_limit_seconds', coalesce(v_question.time_limit_seconds, 30),
    'order_index', coalesce(v_order_index, 0) + 1,
    'total_questions', coalesce(v_total, 0),
    'options', v_options,
    'slider', v_slider,
    'ordering_items', v_ordering,
    'layout', v_question.layout,
    'info_text', v_question.info_text,
    'video', case when v_question.video_id is null then null else jsonb_build_object(
      'id', v_question.video_id, 'start', v_question.video_start, 'end', v_question.video_end,
      'gate', v_question.video_gate) end,
    'server_start_time', v_game.current_question_started_at,
    'duration', v_game.current_question_duration_seconds,
    'reading_seconds', coalesce(v_game.current_question_reading_seconds, 0),
    'revealed', v_revealed,
    'correct_answer', v_correct_answer
  );
end;
$$;

-- 3. Pihentetés kapcsolható: 0 hónap = nincs pihentetés (ez az alap).
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
        coalesce(v_cooldown_months, 0) <= 0
        or q.last_used_at is null
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


update app_settings set value = '0'::jsonb where key = 'question_reuse_cooldown_months';
