-- Kvízösszerakó (új szerkesztő) + olvasási idő + köri állás a csapatoknak.
-- docs/features/quiz-builder.md, docs/features/timer.md 6. szakasz.

-- 1. Olvasási idő: globális alap (app_settings) + kérdésenkénti felülírás.
alter table questions
  add column reading_seconds integer
  check (reading_seconds is null or reading_seconds between 0 and 120);

comment on column questions.reading_seconds is
  'Olvasási idő a válaszidő előtt (mp). NULL = az app_settings.question_reading_seconds alapérték.';

insert into app_settings (key, value)
values ('question_reading_seconds', '5'::jsonb)
on conflict (key) do nothing;

-- Élő állapot: mennyi olvasási idő előzte meg a current_question_started_at-et
-- (újracsatlakozáskor a kliens ebből rajzolja újra az olvasási fázist).
alter table games add column current_question_reading_seconds integer;

-- 2. Kérdésenként (a körben elfoglalt helyén) előre beállítható, hogy a host
-- felfedés után megmutassa-e a köri állást a kivetítőn.
alter table round_questions
  add column show_standings boolean not null default true;

-- 3. Kérdés indítása olvasási idővel. A válaszidő (current_question_started_at)
-- az olvasási idő VÉGÉN kezdődik, így a gyorsasági pontozás
-- (answer_time_ms a started_at-hez mérve) nem bünteti az olvasást.
create or replace function public.start_question(p_game_id uuid, p_duration integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reading integer;
  v_started_at timestamptz;
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if p_duration is null or p_duration < 1 then
    raise exception 'invalid_duration';
  end if;

  select coalesce(
           q.reading_seconds,
           (select (s.value #>> '{}')::int from app_settings s where s.key = 'question_reading_seconds'),
           5
         )
    into v_reading
    from games g
    left join questions q on q.id = g.current_question_id
    where g.id = p_game_id;

  if not found then
    raise exception 'game_not_found';
  end if;

  v_reading := greatest(0, least(coalesce(v_reading, 5), 120));

  update games
    set current_question_started_at = now() + v_reading * interval '1 second',
        current_question_duration_seconds = p_duration,
        current_question_reading_seconds = v_reading
    where id = p_game_id
    returning current_question_started_at into v_started_at;

  return jsonb_build_object('server_start_time', v_started_at, 'reading_seconds', v_reading);
end;
$$;

revoke all on function public.start_question(uuid, integer) from public, anon;
grant execute on function public.start_question(uuid, integer) to authenticated;

-- A host átugorhatja a hátralévő olvasási időt: a válaszidő azonnal indul.
create or replace function public.skip_question_reading(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started_at timestamptz;
  v_duration integer;
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  update games
    set current_question_started_at = least(current_question_started_at, now()),
        current_question_reading_seconds = 0
    where id = p_game_id and current_question_started_at is not null
    returning current_question_started_at, current_question_duration_seconds
      into v_started_at, v_duration;

  if not found then
    raise exception 'timer_not_started';
  end if;

  return jsonb_build_object('server_start_time', v_started_at, 'duration', v_duration);
end;
$$;

revoke all on function public.skip_question_reading(uuid) from public, anon;
grant execute on function public.skip_question_reading(uuid) to authenticated;

-- 4. Olvasási idő alatt nem lehet válaszolni (1 mp óraeltérés-tűréssel).
create or replace function public.answer_within_timer(p_game_id uuid, p_question_id uuid)
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
      and now() >= g.current_question_started_at - interval '1 second'
      and now() <= g.current_question_started_at
                    + (g.current_question_duration_seconds + 3) * interval '1 second'
  );
$$;

-- 5. Újracsatlakozás: a current_question_state az olvasási időt is visszaadja.
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

  select q.id, q.prompt, q.image_url, q.image_pixelate, q.time_limit_seconds, qt.code
    into v_question
    from questions q
    join question_types qt on qt.id = q.question_type_id
    where q.id = v_game.current_question_id;

  select r.title into v_round_title from rounds r where r.id = v_game.current_round_id;

  -- A kör sorrendjében elfoglalt hely (0-tól), nem a nyers order_index.
  select x.pos into v_order_index
    from (
      select rq.question_id, row_number() over (order by rq.order_index) - 1 as pos
        from round_questions rq
        where rq.round_id = v_game.current_round_id
    ) x
    where x.question_id = v_game.current_question_id;

  select count(*) into v_total
    from round_questions
    where round_id = v_game.current_round_id;

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
    'server_start_time', v_game.current_question_started_at,
    'duration', v_game.current_question_duration_seconds,
    'reading_seconds', coalesce(v_game.current_question_reading_seconds, 0),
    'revealed', v_revealed,
    'correct_answer', v_correct_answer
  );
end;
$$;

-- 6. A kör aktuális állása — nyilvános adat (a kivetítőn is látszik), a
-- csapat telefonja újracsatlakozáskor ebből tölti vissza a saját helyét.
-- Csak futó/szüneteltetett/lezárt estére ad adatot, és csak a már
-- kiértékelt válaszok pontjait számolja.
create or replace function public.current_round_standings(p_game_id uuid)
returns table (team_id uuid, name text, score bigint)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.name, coalesce(sum(a.points_awarded), 0)::bigint
    from games g
    join teams t on t.game_id = g.id
    left join answers a
      on a.team_id = t.id
      and a.is_correct is not null
      and a.question_id in (
        select rq.question_id from round_questions rq where rq.round_id = g.current_round_id
      )
    where g.id = p_game_id
      and g.status in ('active', 'paused', 'finished')
      and g.current_round_id is not null
    group by t.id, t.name
    order by 3 desc, t.name;
$$;

grant execute on function public.current_round_standings(uuid) to anon, authenticated;

-- 7. A kör teljes kérdéslistájának beállítása egy lépésben (átrendezés,
-- eltávolítás, beszúrás adott helyre, körök közötti mozgatás, visszavonás).
-- A meglévő sorok show_standings értéke megmarad.
create or replace function public.admin_set_round_questions(p_round_id uuid, p_question_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if not exists (select 1 from rounds where id = p_round_id) then
    raise exception 'round_not_found';
  end if;
  if (select count(*) from unnest(p_question_ids)) <> (select count(distinct x) from unnest(p_question_ids) x) then
    raise exception 'duplicate_question';
  end if;

  delete from round_questions
    where round_id = p_round_id
      and not (question_id = any (coalesce(p_question_ids, '{}')));

  update round_questions rq
    set order_index = x.ord - 1
    from unnest(p_question_ids) with ordinality as x(question_id, ord)
    where rq.round_id = p_round_id and rq.question_id = x.question_id;

  insert into round_questions (round_id, question_id, order_index)
    select p_round_id, x.question_id, x.ord - 1
      from unnest(p_question_ids) with ordinality as x(question_id, ord)
      where not exists (
        select 1 from round_questions rq
          where rq.round_id = p_round_id and rq.question_id = x.question_id
      );
end;
$$;

revoke all on function public.admin_set_round_questions(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_round_questions(uuid, uuid[]) to authenticated;

-- 8. Kérdés másolása (Ctrl+D a szerkesztőben): törzs + típusadatok.
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
    points_multiplier, time_limit_seconds, points_decay, reading_seconds, created_by
  )
  select theme_id, question_type_id, prompt, image_url, image_pixelate, points,
         points_multiplier, time_limit_seconds, points_decay, reading_seconds, auth.uid()
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

revoke all on function public.admin_duplicate_question(uuid) from public, anon;
grant execute on function public.admin_duplicate_question(uuid) to authenticated;
