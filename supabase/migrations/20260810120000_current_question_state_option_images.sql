-- Fázis Q6 kiegészítés — a current_question_state() (Fázis P4, legutóbb
-- 20260809150500_current_question_state_reveal.sql-ben módosítva) az
-- opciókat eddig csak `id`/`option_text` mezőkkel adta vissza; egy
-- újracsatlakozó csapatnak/TV-nek emiatt a kép csak a `question_show`
-- broadcast-ból volt elérhető, egy reload/újracsatlakozás után nem. Ez a
-- migráció kizárólag az `options` jsonb_agg-hoz ad hozzá egy `image_url`
-- mezőt (a `question_choice_options.image_url` oszlop már a Fázis 2 óta
-- létezik) — a függvény többi része változatlan.
create or replace function public.current_question_state(p_game_id uuid)
returns jsonb
language plpgsql
security definer
stable
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
         current_question_started_at, current_question_duration_seconds
    into v_game
    from games
    where id = p_game_id;

  if v_game is null or v_game.current_question_id is null then
    return jsonb_build_object('question_id', null);
  end if;

  select q.id, q.prompt, q.image_url, q.time_limit_seconds, qt.code
    into v_question
    from questions q
    join question_types qt on qt.id = q.question_type_id
    where q.id = v_game.current_question_id;

  select r.title into v_round_title from rounds r where r.id = v_game.current_round_id;

  select rq.order_index into v_order_index
    from round_questions rq
    where rq.round_id = v_game.current_round_id and rq.question_id = v_game.current_question_id;

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
    'time_limit_seconds', coalesce(v_question.time_limit_seconds, 30),
    'order_index', coalesce(v_order_index, 0) + 1,
    'total_questions', coalesce(v_total, 0),
    'options', v_options,
    'slider', v_slider,
    'ordering_items', v_ordering,
    'server_start_time', v_game.current_question_started_at,
    'duration', v_game.current_question_duration_seconds,
    'revealed', v_revealed,
    'correct_answer', v_correct_answer
  );
end;
$$;
