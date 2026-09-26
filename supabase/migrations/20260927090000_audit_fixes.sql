-- Kódaudit javításai (docs/DECISIONS_LOG.md, 2026-09-27). Az üzleti logika
-- (pontszámítás, időkeret, jogosultsági szintek) változatlan — a javítások
-- az adatintegritást, a csalás elleni védelmet és a sebességet érintik.

-- ---------------------------------------------------------------------------
-- 1. Adatjavítás: a "töröld és írd újra" mentés duplikált opciói (H1).
-- A válaszok által hivatkozott (eredeti) opció marad; az ugyanazon sorszámú,
-- nem hivatkozott másolatok törlődnek. Az egyetlen érintett kérdésnél a
-- legutóbbi szerkesztés tartalma megegyezik az eredetivel.
delete from question_choice_options o
where exists (
    select 1 from question_choice_options d
    where d.question_id = o.question_id
      and d.order_index = o.order_index
      and d.id <> o.id
      and (
        exists (select 1 from answer_choice ac where ac.option_id = d.id)
        or exists (select 1 from answer_choice_multi am where am.option_id = d.id)
      )
  )
  and not exists (select 1 from answer_choice ac where ac.option_id = o.id)
  and not exists (select 1 from answer_choice_multi am where am.option_id = o.id);

delete from question_ordering_items o
where exists (
    select 1 from question_ordering_items d
    where d.question_id = o.question_id
      and d.correct_position = o.correct_position
      and d.id <> o.id
      and exists (select 1 from answer_ordering ao where ao.item_id = d.id)
  )
  and not exists (select 1 from answer_ordering ao where ao.item_id = o.id);

-- ---------------------------------------------------------------------------
-- 2. Lejátszott kérdés archiválása törlés helyett (M3): a korábbi estek
-- válaszai és eredményei megmaradnak, a kérdés eltűnik a bankból.
alter table questions add column if not exists archived_at timestamptz;

-- Random húzás: archivált kérdés nem húzható (a törölt sem volt az).
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
    where q.theme_id = p_theme_id
      and q.archived_at is null
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

-- Törlés a kérdésbankból: ha a kérdésre már válaszoltak, archiválás, és a még
-- el nem indult estek köreiből kikerül (ahogy a törlés is kivette volna).
create or replace function public.admin_delete_question(p_question_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;
  if exists (select 1 from answers where question_id = p_question_id) then
    update questions set archived_at = now() where id = p_question_id and archived_at is null;
    delete from round_questions rq
      using rounds r, games g
      where rq.question_id = p_question_id
        and r.id = rq.round_id and g.id = r.game_id
        and g.started_at is null;
    return 'archived';
  end if;
  delete from questions where id = p_question_id;
  return 'deleted';
end;
$$;
revoke all on function public.admin_delete_question(uuid) from public, anon;
grant execute on function public.admin_delete_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Kérdés mentése egy tranzakcióban (H1, P4). A típusadatok HELYBEN
-- frissülnek (sorszám / helyes pozíció szerint), így a lejátszott kérdés
-- opcióinak azonosítója — és a rájuk hivatkozó válaszok — megmaradnak.
-- Változatlan sor nem íródik újra (az audit napló sem nő feleslegesen).
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
begin
  if public.current_user_role_id() not in (1, 2) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  if v_id is null then
    insert into questions (
      theme_id, question_type_id, prompt, image_url, image_pixelate, points,
      points_multiplier, time_limit_seconds, points_decay, reading_seconds, created_by
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
      auth.uid()
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
      reading_seconds = (p_question ->> 'reading_seconds')::int
    where id = v_id
      and (theme_id, question_type_id, prompt, image_url, image_pixelate, points,
           points_multiplier, time_limit_seconds, points_decay, reading_seconds)
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
           (p_question ->> 'reading_seconds')::int);
    if not exists (select 1 from questions where id = v_id) then
      raise exception 'question_not_found';
    end if;
  end if;

  -- Választós opciók
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

  -- Csúszka
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

  -- Sorba rendezés
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
revoke all on function public.admin_save_question(uuid, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_question(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Válasz és joker csak ellenőrzött csapatként (H2, H3, H4). A válaszidőt
-- a szerver méri (a kérdés kezdetétől), 0 és a válaszidő közé szorítva; a
-- válasz és a választott opció egy tranzakcióban íródik. Az időkeret
-- ugyanaz, mint eddig (answer_within_timer).
create or replace function public.submit_answer(
  p_team_id uuid,
  p_device_token text,
  p_question_id uuid,
  p_option_ids uuid[] default null,
  p_slider_value numeric default null,
  p_ordering uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
  v_game games%rowtype;
  v_type text;
  v_answer uuid;
  v_ms integer;
begin
  select * into v_team from teams where id = p_team_id;
  if v_team.id is null or v_team.device_token is distinct from p_device_token then
    raise exception 'invalid_team' using errcode = '42501';
  end if;
  select * into v_game from games where id = v_team.game_id;
  if v_game.status <> 'active' or not public.answer_within_timer(v_game.id, p_question_id) then
    raise exception 'time_up' using errcode = '42501';
  end if;

  select qt.code into v_type
    from questions q join question_types qt on qt.id = q.question_type_id
    where q.id = p_question_id;

  v_ms := greatest(0, least(
    v_game.current_question_duration_seconds * 1000,
    floor(extract(epoch from (now() - v_game.current_question_started_at)) * 1000)::integer
  ));

  begin
    insert into answers (game_id, question_id, team_id, answer_time_ms)
      values (v_game.id, p_question_id, v_team.id, v_ms)
      returning id into v_answer;
  exception when unique_violation then
    raise exception 'already_answered';
  end;

  if v_type in ('single_choice', 'true_false') then
    if coalesce(array_length(p_option_ids, 1), 0) > 0 then
      insert into answer_choice (answer_id, option_id)
        select v_answer, o.id from question_choice_options o
        where o.id = p_option_ids[1] and o.question_id = p_question_id;
    end if;
  elsif v_type = 'multi_choice' then
    insert into answer_choice_multi (answer_id, option_id)
      select distinct v_answer, o.id from question_choice_options o
      where o.id = any (coalesce(p_option_ids, '{}')) and o.question_id = p_question_id;
  elsif v_type = 'slider' then
    if p_slider_value is not null then
      insert into answer_slider (answer_id, value) values (v_answer, p_slider_value);
    end if;
  elsif v_type = 'ordering' then
    insert into answer_ordering (answer_id, item_id, position)
      select v_answer, i.id, x.pos::smallint
      from unnest(coalesce(p_ordering, '{}')) with ordinality as x(item_id, pos)
      join question_ordering_items i on i.id = x.item_id and i.question_id = p_question_id;
  end if;

  return v_answer;
end;
$$;
revoke all on function public.submit_answer(uuid, text, uuid, uuid[], numeric, uuid[]) from public;
grant execute on function public.submit_answer(uuid, text, uuid, uuid[], numeric, uuid[]) to anon, authenticated;

create or replace function public.use_joker(p_team_id uuid, p_device_token text, p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team teams%rowtype;
begin
  select * into v_team from teams where id = p_team_id;
  if v_team.id is null or v_team.device_token is distinct from p_device_token then
    raise exception 'invalid_team' using errcode = '42501';
  end if;
  if public.team_owner_game_status(p_team_id) <> 'active'
     or p_question_id is distinct from public.team_current_question(p_team_id) then
    raise exception 'joker_not_allowed' using errcode = '42501';
  end if;
  insert into team_joker_uses (team_id, question_id, joker_type)
    values (p_team_id, p_question_id, 'double_points');
end;
$$;
revoke all on function public.use_joker(uuid, text, uuid) from public;
grant execute on function public.use_joker(uuid, text, uuid) to anon, authenticated;

-- A közvetlen anonim írás/olvasás szigorítása a 20260927090500_audit_lockdown.sql-ben
-- (az új kliens élesítése után alkalmazva, hogy a futó verzió ne álljon le).

-- PIN → este (a /play csatlakozó oldal), és a kivetítő adatai (a PIN a QR-kódhoz kell;
-- a kivetítő linkje az este azonosítóját tartalmazza).
create or replace function public.game_by_pin(p_pin text)
returns table (id uuid, title text, design_theme_id uuid, status text, join_requires_code boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.title, g.design_theme_id, g.status, g.join_requires_code
  from games g where g.pin = btrim(p_pin) and g.status <> 'finished';
$$;
revoke all on function public.game_by_pin(text) from public;
grant execute on function public.game_by_pin(text) to anon, authenticated;

create or replace function public.tv_game(p_game_id uuid)
returns table (id uuid, title text, pin text, status text, design_theme_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.title, g.pin, g.status, g.design_theme_id from games g where g.id = p_game_id;
$$;
revoke all on function public.tv_game(uuid) from public;
grant execute on function public.tv_game(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Élő lépések egy hívásban (P6).
-- Következő kérdés: beállítja az aktuális kérdést és elindítja az időzítőt
-- (ugyanaz az olvasási idő-logika, mint a start_question()), és visszaadja a
-- csapatoknak kiküldendő adatokat (helyes válasz nélkül).
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
         qt.code
    into v_q
    from questions q join question_types qt on qt.id = q.question_type_id
    where q.id = p_question_id;
  if v_q.id is null then
    raise exception 'question_not_found';
  end if;

  v_duration := coalesce(v_q.time_limit_seconds, 30);
  v_reading := greatest(0, least(coalesce(
    v_q.reading_seconds,
    (select (s.value #>> '{}')::int from app_settings s where s.key = 'question_reading_seconds'),
    5
  ), 120));

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
    'server_start_time', v_started_at,
    'reading_seconds', v_reading
  );
end;
$$;
revoke all on function public.host_next_question(uuid, uuid) from public, anon;
grant execute on function public.host_next_question(uuid, uuid) to authenticated;

-- Felfedés: kiértékel (evaluate_question) és visszaadja a helyes választ.
create or replace function public.host_reveal(p_question_id uuid)
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
  perform public.evaluate_question(p_question_id);

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
revoke all on function public.host_reveal(uuid) from public, anon;
grant execute on function public.host_reveal(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Témaváltás élő értesítése a játékcsatornán (M5). A design_themes tábla
-- nincs a Realtime publikációban, és a games sort az anonim kliens már nem
-- olvashatja teljes egészében — ezért az adatbázis maga küld broadcastot.
create or replace function public.broadcast_game_theme()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.design_theme_id is distinct from old.design_theme_id then
    perform realtime.send(
      jsonb_build_object('design_theme_id', new.design_theme_id),
      'theme_changed', 'game:' || new.id::text, false
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_broadcast_game_theme on games;
create trigger trg_broadcast_game_theme after update of design_theme_id on games
  for each row execute function public.broadcast_game_theme();

create or replace function public.broadcast_design_themes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'design_themes', false);
  return null;
end;
$$;
drop trigger if exists trg_broadcast_design_themes on design_themes;
create trigger trg_broadcast_design_themes after insert or update or delete on design_themes
  for each statement execute function public.broadcast_design_themes();

-- ---------------------------------------------------------------------------
-- 7. Új fiók jogosultság nélkül (M1): a rendszergazda osztja ki a szerepkört.
insert into roles (id, code, label) values (0, 'pending', 'Jóváhagyásra vár')
  on conflict (id) do nothing;
alter table profiles alter column role_id set default 0;

-- ---------------------------------------------------------------------------
-- 8. Biztonsági figyelmeztetések (L1).
alter function public.server_now() set search_path = public;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. Indexek (P10, L3) — az est/kérdés szerinti lekérdezésekhez és a
-- kaszkád/idegen kulcs ellenőrzésekhez.
create index if not exists idx_answers_game on answers (game_id);
create index if not exists idx_answers_team on answers (team_id);
create index if not exists idx_rounds_game on rounds (game_id, order_index);
create index if not exists idx_round_questions_question on round_questions (question_id);
create index if not exists idx_qco_question on question_choice_options (question_id, order_index);
create index if not exists idx_qoi_question on question_ordering_items (question_id, correct_position);
create index if not exists idx_questions_theme on questions (theme_id);
create index if not exists idx_games_venue on games (venue_id);
create index if not exists idx_joker_question on team_joker_uses (question_id);
create index if not exists idx_registrations_team on team_registrations (team_id);
create index if not exists idx_answer_choice_option on answer_choice (option_id);
create index if not exists idx_answer_choice_multi_option on answer_choice_multi (option_id);
create index if not exists idx_answer_ordering_item on answer_ordering (item_id);

-- ---------------------------------------------------------------------------
-- 10. Átfedő jogosultsági szabályok összevonása (L3). Ugyanaz a hozzáférés:
-- az "ALL" szabály helyett külön insert/update/delete, az olvasást a meglévő
-- select szabály adja (ami a szűkebb kört is lefedi).
do $$
declare
  t text;
  v_expr text;
begin
  foreach t in array array['design_themes', 'question_choice_options', 'question_ordering_items',
                            'question_slider_config', 'question_types', 'questions',
                            'round_questions', 'themes'] loop
    v_expr := '(public.current_user_role_id() = any (array[1, 2]))';
    execute format('drop policy if exists %I on %I', t || '_admin_all', t);
    execute format('drop policy if exists %I on %I', t || '_admin_insert', t);
    execute format('drop policy if exists %I on %I', t || '_admin_update', t);
    execute format('drop policy if exists %I on %I', t || '_admin_delete', t);
    execute format('create policy %I on %I for insert to authenticated with check %s', t || '_admin_insert', t, v_expr);
    execute format('create policy %I on %I for update to authenticated using %s with check %s', t || '_admin_update', t, v_expr, v_expr);
    execute format('create policy %I on %I for delete to authenticated using %s', t || '_admin_delete', t, v_expr);
  end loop;
end;
$$;

drop policy if exists app_settings_write_super_admin on app_settings;
create policy app_settings_insert_super_admin on app_settings for insert to authenticated
  with check (public.current_user_role_id() = 1);
create policy app_settings_update_super_admin on app_settings for update to authenticated
  using (public.current_user_role_id() = 1) with check (public.current_user_role_id() = 1);
create policy app_settings_delete_super_admin on app_settings for delete to authenticated
  using (public.current_user_role_id() = 1);

drop policy if exists profiles_select_admin on profiles;
drop policy if exists profiles_select_own on profiles;
create policy profiles_select on profiles for select to authenticated
  using (id = (select auth.uid()) or public.current_user_role_id() = any (array[1, 2]));
drop policy if exists profiles_update_own on profiles;
drop policy if exists profiles_update_super_admin on profiles;
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.uid()) or public.current_user_role_id() = 1)
  with check (
    (id = (select auth.uid()) and role_id = public.current_user_role_id())
    or public.current_user_role_id() = 1
  );

-- ---------------------------------------------------------------------------
-- 11. Audit napló megőrzése (M7): 180 napnál régebbi sorok törlése naponta.
create or replace function public.purge_old_audit_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from audit_logs where created_at < now() - interval '180 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.purge_old_audit_logs() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'purge-old-audit-logs';
select cron.schedule('purge-old-audit-logs', '41 3 * * *', 'select public.purge_old_audit_logs()');

-- Név alapú csatlakozás függvényen át (ugyanaz a feltétel, mint a
-- teams_insert_anon_lobby szabályé) — a csapat sora az eszköz-token olvasása
-- nélkül jön vissza.
create or replace function public.join_with_name(p_pin text, p_name text, p_device_token text)
returns table (team_id uuid, team_name text, game_id uuid, game_title text, design_theme_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_game games%rowtype;
  v_team uuid;
begin
  if coalesce(btrim(p_device_token), '') = '' or coalesce(btrim(p_name), '') = '' then
    raise exception 'invalid_input';
  end if;
  select * into v_game from games where pin = btrim(p_pin) and status = 'lobby';
  if v_game.id is null then
    raise exception 'game_not_found';
  end if;
  if v_game.join_requires_code then
    raise exception 'code_required';
  end if;
  begin
    insert into teams (game_id, name, device_token)
      values (v_game.id, btrim(p_name), p_device_token)
      returning id into v_team;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return query select v_team, btrim(p_name), v_game.id, v_game.title, v_game.design_theme_id;
end;
$$;
revoke all on function public.join_with_name(text, text, text) from public;
grant execute on function public.join_with_name(text, text, text) to anon, authenticated;
