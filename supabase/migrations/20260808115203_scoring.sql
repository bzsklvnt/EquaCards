-- Phase 5: pontszámítás + ranglista
-- Séma forrás: docs/architecture/DATA_MODEL.md 3. szakasz ("Pontszámítás a
-- két szorzóval kombinálva") és 5. szakasz (kör-/végeredmény lekérdezés).

-- evaluate_question(): a Fázis 4-ben beszúrt, még kiértékeletlen (is_correct
-- is null) answers sorokat zárja le egy adott kérdésre. A DATA_MODEL.md
-- eredetileg "Edge Function"-t irányzott elő erre a célra; itt security
-- definer Postgres RPC-ként valósult meg helyette — indoklás:
-- docs/DECISIONS_LOG.md Fázis 5 bejegyzése.
--
-- decay szorzó: a DATA_MODEL.md nem rögzíti a pontos képletet, csak hogy
-- "points_decay = true" esetén van decay. Itt bevezetett, dokumentált döntés:
-- lineáris decay 100%-ról (azonnali válasz) 50%-ra (a time_limit_seconds
-- lejártakor), utána 50%-on plafonozva — tehát a leglassabb, még időben
-- beérkező válasz is legalább az alap pontszám felét éri.
create or replace function public.evaluate_question(p_question_id uuid)
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

  for v_answer in
    select a.id, a.team_id, a.answer_time_ms
      from answers a
      where a.question_id = p_question_id and a.is_correct is null
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

revoke execute on function public.evaluate_question(uuid) from public;
revoke execute on function public.evaluate_question(uuid) from anon, authenticated;
grant execute on function public.evaluate_question(uuid) to authenticated;

-- team_answer_result(): egy csapat a saját (is_correct, points_awarded)
-- párját olvassa vissza egy adott kérdésre. Azért RPC és nem sima anon
-- SELECT policy az answers-en, mert egy `using` policy nem tud a lekérdezés
-- WHERE-ében megadott team_id-hoz kötni (nincs auth session/JWT, amiből a
-- "saját" team_id kiderülne) — anon SELECT policy esetén bármelyik csapat
-- kliens game_id szerint az ÖSSZES csapat válaszát lekérdezhetné, ami a
-- section 5 tervezési elvét (senki se lásson mást, csak a sajátját) sokkal
-- durvábban sértené, mint ez a függvény. Itt a hívónak konkrét team_id +
-- question_id UUID párost kell ismernie, és a válasz egyetlen sorra
-- korlátozott — ugyanaz az "ismert UUID = de facto tulajdonjog" minta, mint
-- a team_joker_uses_select_anon policy-nál (Fázis 4).
create or replace function public.team_answer_result(p_team_id uuid, p_question_id uuid)
returns table (is_correct boolean, points_awarded integer)
language sql
security definer
stable
set search_path = public
as $$
  select a.is_correct, a.points_awarded
    from answers a
    where a.team_id = p_team_id and a.question_id = p_question_id;
$$;

revoke execute on function public.team_answer_result(uuid, uuid) from public;
revoke execute on function public.team_answer_result(uuid, uuid) from anon, authenticated;
grant execute on function public.team_answer_result(uuid, uuid) to anon;

-- round_leaderboard(): kör-specifikus top N, DATA_MODEL.md 5. szakasz SQL
-- mintája alapján, kiegészítve, hogy a 0 pontos (vagy nem válaszoló)
-- csapatok is szerepeljenek az aggregálásban (left join teams-ből indulva,
-- nem answers-ből) — MVP méretben (néhány tucat csapat) ez nem teljesítmény
-- kérdés, csak korrektebb rangsor egyenlőség esetén.
create or replace function public.round_leaderboard(p_round_id uuid, p_limit int default 3)
returns table (team_id uuid, name text, round_score bigint)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if public.current_user_role_id() not in (1, 2, 3) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select t.id, t.name, coalesce(sum(a.points_awarded), 0) as round_score
    from teams t
    left join answers a
      on a.team_id = t.id
      and a.question_id in (select rq.question_id from round_questions rq where rq.round_id = p_round_id)
    where t.game_id = (select r.game_id from rounds r where r.id = p_round_id)
    group by t.id, t.name
    order by round_score desc
    limit p_limit;
end;
$$;

revoke execute on function public.round_leaderboard(uuid, int) from public;
revoke execute on function public.round_leaderboard(uuid, int) from anon, authenticated;
grant execute on function public.round_leaderboard(uuid, int) to authenticated;
