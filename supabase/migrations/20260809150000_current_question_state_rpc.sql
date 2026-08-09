-- Fázis P4: csapat újracsatlakozás és állapot-mentés.
--
-- A /play/[pin] eddig KIZÁRÓLAG a `timer_start`/`question_show`/
-- `answer_locked`/`question_reveal` broadcast-eseményekből építette fel az
-- aktuális kérdés állapotát — egy oldal-újratöltés (böngészőlap bezárása,
-- kapcsolatvesztés) után a kliens nem tudta ezt sehonnan visszaolvasni,
-- mert az anon szerepkörnek szándékosan NINCS SELECT policy-ja sem a
-- `questions`/`question_choice_options`/`question_slider_config`/
-- `question_ordering_items` táblákon (a kérdésbankot nem szabad
-- előre/kívülről lekérdezni), sem az `answers` táblán (senki se lásson
-- mást, csak a saját válaszát — docs/architecture/DATA_MODEL.md 5.
-- szakasz). A `team_answer_result(team_id, question_id)` RPC (Fázis 5) már
-- megoldja a saját válasz visszaolvasását; ez a migráció a hiányzó másik
-- felét pótolja: a games.current_question_id-hez tartozó, MÁR ÉLŐBEN
-- KIKÜLDÖTT kérdés adatait adja vissza anon hívóknak is — ez nem szivárogtat
-- semmit, amit egy folyamatosan csatlakozva maradt csapat ne kapna meg
-- amúgy is a broadcast-on keresztül (a helyes válasz/is_correct/
-- correct_position NINCS benne, ugyanúgy, mint a `question_show`
-- broadcast payload-jában sem).
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
    select jsonb_agg(jsonb_build_object('id', id, 'option_text', option_text) order by order_index)
      into v_options
      from question_choice_options
      where question_id = v_question.id;
  elsif v_question.code = 'slider' then
    select jsonb_build_object('min_value', min_value, 'max_value', max_value, 'step', step)
      into v_slider
      from question_slider_config
      where question_id = v_question.id;
  elsif v_question.code = 'ordering' then
    -- Szándékosan NEM correct_position szerint rendezve (az elárulná a
    -- helyes sorrendet) — a kliens ezt a listát is megkeveri megjelenítés
    -- előtt, ugyanúgy, mint a host a `question_show` broadcast előtt.
    select jsonb_agg(jsonb_build_object('id', id, 'item_text', item_text) order by item_text)
      into v_ordering
      from question_ordering_items
      where question_id = v_question.id;
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
    'duration', v_game.current_question_duration_seconds
  );
end;
$$;

revoke execute on function public.current_question_state(uuid) from public;
revoke execute on function public.current_question_state(uuid) from anon, authenticated;
grant execute on function public.current_question_state(uuid) to anon;
