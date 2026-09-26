-- Kérdésenkénti megjelenés, magyarázó dia (Info) és YouTube-videó melléklet
-- — docs/features/question-layout.md. A pontszámítás és az időkeret-logika
-- változatlan: a videós kérdés a meglévő olvasási idővel dolgozik.

-- 1. Új oszlopok -------------------------------------------------------------
alter table questions
  add column if not exists layout jsonb,
  add column if not exists info_text text,
  add column if not exists video_id text,
  add column if not exists video_start integer,
  add column if not exists video_end integer,
  add column if not exists video_gate boolean not null default true;

alter table questions drop constraint if exists questions_video_check;
alter table questions add constraint questions_video_check check (
  video_id is null
  or (
    video_id ~ '^[A-Za-z0-9_-]{11}$'
    and video_start is not null and video_end is not null
    and video_start >= 0 and video_end > video_start and video_end - video_start <= 300
  )
);

comment on column questions.layout is
  'Megjelenés (null = Klasszikus): {preset, timer, counter, size, phone_cols, phone_prompt}';
comment on column questions.video_gate is
  'Videós kérdésnél: igaz = a válaszidő a klip végén indul (olvasási idő = klip hossza)';

-- 2. Info kérdéstípus (magyarázó dia: nincs válasz, időzítő és pont) ---------
insert into question_types (id, code, label, description, min_options, max_options)
values (6, 'info', 'Info / magyarázó dia', 'Csak megjelenik a kivetítőn — nincs válasz és pont', null, null)
on conflict (id) do nothing;

-- 3. Mentés: az új mezőkkel bővítve -----------------------------------------
create or replace function public.admin_save_question(
  p_question_id uuid,
  p_question jsonb,
  p_options jsonb default null,
  p_slider jsonb default null,
  p_ordering jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_question_id;
  v_opt jsonb;
  v_item jsonb;
  v_layout jsonb := case when jsonb_typeof(p_question -> 'layout') = 'object' then p_question -> 'layout' end;
  v_video text := nullif(p_question ->> 'video_id', '');
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if v_id is null then
    insert into questions (
      theme_id, question_type_id, prompt, image_url, image_pixelate, points,
      points_multiplier, time_limit_seconds, points_decay, reading_seconds, created_by,
      layout, info_text, video_id, video_start, video_end, video_gate
    ) values (
      nullif(p_question ->> 'theme_id', '')::uuid,
      (p_question ->> 'question_type_id')::smallint,
      p_question ->> 'prompt',
      nullif(p_question ->> 'image_url', ''),
      coalesce((p_question ->> 'image_pixelate')::boolean, false),
      (p_question ->> 'points')::int,
      (p_question ->> 'points_multiplier')::numeric,
      (p_question ->> 'time_limit_seconds')::int,
      coalesce((p_question ->> 'points_decay')::boolean, true),
      (p_question ->> 'reading_seconds')::int,
      auth.uid(),
      v_layout,
      nullif(p_question ->> 'info_text', ''),
      v_video,
      case when v_video is null then null else (p_question ->> 'video_start')::int end,
      case when v_video is null then null else (p_question ->> 'video_end')::int end,
      coalesce((p_question ->> 'video_gate')::boolean, true)
    )
    returning id into v_id;
  else
    update questions set
      theme_id = nullif(p_question ->> 'theme_id', '')::uuid,
      question_type_id = (p_question ->> 'question_type_id')::smallint,
      prompt = p_question ->> 'prompt',
      image_url = nullif(p_question ->> 'image_url', ''),
      image_pixelate = coalesce((p_question ->> 'image_pixelate')::boolean, false),
      points = (p_question ->> 'points')::int,
      points_multiplier = (p_question ->> 'points_multiplier')::numeric,
      time_limit_seconds = (p_question ->> 'time_limit_seconds')::int,
      points_decay = coalesce((p_question ->> 'points_decay')::boolean, true),
      reading_seconds = (p_question ->> 'reading_seconds')::int,
      layout = v_layout,
      info_text = nullif(p_question ->> 'info_text', ''),
      video_id = v_video,
      video_start = case when v_video is null then null else (p_question ->> 'video_start')::int end,
      video_end = case when v_video is null then null else (p_question ->> 'video_end')::int end,
      video_gate = coalesce((p_question ->> 'video_gate')::boolean, true)
    where id = v_id
      and (theme_id, question_type_id, prompt, image_url, image_pixelate, points,
           points_multiplier, time_limit_seconds, points_decay, reading_seconds,
           layout, info_text, video_id, video_start, video_end, video_gate)
          is distinct from
          (nullif(p_question ->> 'theme_id', '')::uuid,
           (p_question ->> 'question_type_id')::smallint,
           p_question ->> 'prompt',
           nullif(p_question ->> 'image_url', ''),
           coalesce((p_question ->> 'image_pixelate')::boolean, false),
           (p_question ->> 'points')::int,
           (p_question ->> 'points_multiplier')::numeric,
           (p_question ->> 'time_limit_seconds')::int,
           coalesce((p_question ->> 'points_decay')::boolean, true),
           (p_question ->> 'reading_seconds')::int,
           v_layout,
           nullif(p_question ->> 'info_text', ''),
           v_video,
           case when v_video is null then null else (p_question ->> 'video_start')::int end,
           case when v_video is null then null else (p_question ->> 'video_end')::int end,
           coalesce((p_question ->> 'video_gate')::boolean, true));
    if not exists (select 1 from questions where id = v_id) then
      raise exception 'question_not_found';
    end if;
  end if;

  for v_opt in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    update question_choice_options set
        option_text = v_opt ->> 'option_text',
        image_url = nullif(v_opt ->> 'image_url', ''),
        is_correct = coalesce((v_opt ->> 'is_correct')::boolean, false)
      where question_id = v_id
        and order_index = (v_opt ->> 'order_index')::int
        and (option_text, image_url, is_correct) is distinct from
            (v_opt ->> 'option_text', nullif(v_opt ->> 'image_url', ''),
             coalesce((v_opt ->> 'is_correct')::boolean, false));
    if not exists (
      select 1 from question_choice_options
      where question_id = v_id and order_index = (v_opt ->> 'order_index')::int
    ) then
      insert into question_choice_options (question_id, option_text, image_url, is_correct, order_index)
        values (v_id, v_opt ->> 'option_text', nullif(v_opt ->> 'image_url', ''),
                coalesce((v_opt ->> 'is_correct')::boolean, false), (v_opt ->> 'order_index')::int);
    end if;
  end loop;
  begin
    delete from question_choice_options
      where question_id = v_id
        and order_index not in (
          select (e ->> 'order_index')::int from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) e
        );
  exception when foreign_key_violation then
    raise exception 'option_in_use';
  end;

  if p_slider is null then
    delete from question_slider_config where question_id = v_id;
  else
    insert into question_slider_config (question_id, min_value, max_value, step, correct_value, tolerance)
      values (v_id, (p_slider ->> 'min_value')::numeric, (p_slider ->> 'max_value')::numeric,
              (p_slider ->> 'step')::numeric, (p_slider ->> 'correct_value')::numeric,
              (p_slider ->> 'tolerance')::numeric)
    on conflict (question_id) do update set
      min_value = excluded.min_value, max_value = excluded.max_value, step = excluded.step,
      correct_value = excluded.correct_value, tolerance = excluded.tolerance
    where (question_slider_config.min_value, question_slider_config.max_value, question_slider_config.step,
           question_slider_config.correct_value, question_slider_config.tolerance)
          is distinct from
          (excluded.min_value, excluded.max_value, excluded.step, excluded.correct_value, excluded.tolerance);
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_ordering, '[]'::jsonb)) loop
    update question_ordering_items set item_text = v_item ->> 'item_text'
      where question_id = v_id
        and correct_position = (v_item ->> 'correct_position')::smallint
        and item_text is distinct from v_item ->> 'item_text';
    if not exists (
      select 1 from question_ordering_items
      where question_id = v_id and correct_position = (v_item ->> 'correct_position')::smallint
    ) then
      insert into question_ordering_items (question_id, item_text, correct_position)
        values (v_id, v_item ->> 'item_text', (v_item ->> 'correct_position')::smallint);
    end if;
  end loop;
  begin
    delete from question_ordering_items
      where question_id = v_id
        and correct_position not in (
          select (e ->> 'correct_position')::smallint from jsonb_array_elements(coalesce(p_ordering, '[]'::jsonb)) e
        );
  exception when foreign_key_violation then
    raise exception 'option_in_use';
  end;

  return v_id;
end;
$$;

-- 4. Másolás: az új mezőkkel -------------------------------------------------
create or replace function public.admin_duplicate_question(p_question_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new uuid;
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  insert into questions (
    theme_id, question_type_id, prompt, image_url, image_pixelate, points,
    points_multiplier, time_limit_seconds, points_decay, reading_seconds, created_by,
    layout, info_text, video_id, video_start, video_end, video_gate
  )
  select theme_id, question_type_id, prompt, image_url, image_pixelate, points,
         points_multiplier, time_limit_seconds, points_decay, reading_seconds, auth.uid(),
         layout, info_text, video_id, video_start, video_end, video_gate
    from questions where id = p_question_id
  returning id into v_new;

  if v_new is null then
    raise exception 'question_not_found';
  end if;

  insert into question_choice_options (question_id, option_text, image_url, is_correct, order_index)
    select v_new, option_text, image_url, is_correct, order_index
      from question_choice_options where question_id = p_question_id;
  insert into question_slider_config (question_id, min_value, max_value, step, correct_value, tolerance)
    select v_new, min_value, max_value, step, correct_value, tolerance
      from question_slider_config where question_id = p_question_id;
  insert into question_ordering_items (question_id, item_text, correct_position)
    select v_new, item_text, correct_position
      from question_ordering_items where question_id = p_question_id;

  return v_new;
end;
$$;

-- 5. Random húzás: magyarázó dia nem húzható --------------------------------
create or replace function public.draw_random_questions_for_round(p_theme_id uuid, p_round_id uuid, p_count integer default 8)
returns setof questions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown_months integer;
  v_next_order integer;
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

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
        select rq.question_id from round_questions rq where rq.round_id = p_round_id
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

-- 6. Élő játék: következő kérdés ---------------------------------------------
-- Info dia: nincs időzítő (a válaszadás így eleve zárva). Videó, ha a
-- válaszidő a klip végén indul: az olvasási idő = a klip hossza.
create or replace function public.host_next_question(p_game_id uuid, p_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q record;
  v_reading integer;
  v_started_at timestamptz;
  v_duration integer;
  v_options jsonb;
  v_slider jsonb;
  v_ordering jsonb;
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  select q.id, q.prompt, q.image_url, q.image_pixelate, q.time_limit_seconds, q.reading_seconds,
         q.layout, q.info_text, q.video_id, q.video_start, q.video_end, q.video_gate, qt.code
    into v_q
    from questions q join question_types qt on qt.id = q.question_type_id
    where q.id = p_question_id;
  if v_q.id is null then
    raise exception 'question_not_found';
  end if;

  if v_q.code = 'info' then
    update games
      set current_question_id = p_question_id,
          current_question_started_at = null,
          current_question_duration_seconds = null,
          current_question_reading_seconds = null
      where id = p_game_id;
    if not found then
      raise exception 'game_not_found';
    end if;
    return jsonb_build_object(
      'question_id', v_q.id, 'prompt', v_q.prompt, 'image_url', v_q.image_url,
      'image_pixelate', false, 'time_limit_seconds', 0, 'layout', v_q.layout,
      'info_text', v_q.info_text, 'server_start_time', null, 'reading_seconds', 0
    );
  end if;

  v_duration := coalesce(v_q.time_limit_seconds, 30);
  if v_q.video_id is not null and v_q.video_gate then
    v_reading := greatest(0, least(v_q.video_end - v_q.video_start, 300));
  else
    v_reading := greatest(0, least(coalesce(
      v_q.reading_seconds,
      (select (s.value #>> '{}')::int from app_settings s where s.key = 'question_reading_seconds'),
      5
    ), 120));
  end if;

  update games
    set current_question_id = p_question_id,
        current_question_started_at = now() + v_reading * interval '1 second',
        current_question_duration_seconds = v_duration,
        current_question_reading_seconds = v_reading
    where id = p_game_id
    returning current_question_started_at into v_started_at;
  if v_started_at is null then
    raise exception 'game_not_found';
  end if;

  if v_q.code in ('single_choice', 'multi_choice', 'true_false') then
    select jsonb_agg(jsonb_build_object('id', id, 'option_text', option_text, 'image_url', image_url)
                     order by order_index)
      into v_options from question_choice_options where question_id = p_question_id;
  elsif v_q.code = 'slider' then
    select jsonb_build_object('min_value', min_value, 'max_value', max_value, 'step', step)
      into v_slider from question_slider_config where question_id = p_question_id;
  elsif v_q.code = 'ordering' then
    select jsonb_agg(jsonb_build_object('id', id, 'item_text', item_text))
      into v_ordering from question_ordering_items where question_id = p_question_id;
  end if;

  return jsonb_build_object(
    'question_id', v_q.id,
    'prompt', v_q.prompt,
    'image_url', v_q.image_url,
    'image_pixelate', v_q.image_pixelate,
    'time_limit_seconds', v_duration,
    'options', v_options,
    'slider', v_slider,
    'ordering_items', v_ordering,
    'layout', v_q.layout,
    'video', case when v_q.video_id is null then null else jsonb_build_object(
      'id', v_q.video_id, 'start', v_q.video_start, 'end', v_q.video_end, 'gate', v_q.video_gate) end,
    'server_start_time', v_started_at,
    'reading_seconds', v_reading
  );
end;
$$;

-- 7. Állapot-visszatöltés (telefon, kivetítő): az új mezők, és a kérdésszám
-- az info diák nélkül számol.
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

  select exists (
    select 1 from answers
    where question_id = v_game.current_question_id and is_correct is not null
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
