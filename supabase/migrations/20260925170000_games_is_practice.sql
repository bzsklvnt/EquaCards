-- Próbaeste (docs/features/guided-tours.md): gyakorló kvízeste mintakérdésekkel,
-- a kezelő betanításához. A riportokba (lezárult esték, statisztikák) NEM
-- számíthat bele, ezért minden reports_* függvény kiszűri. A függvények
-- többi része változatlan a 20260808133000_reports_rpcs.sql-hez képest.
alter table public.games
  add column is_practice boolean not null default false;

create or replace function public.reports_finished_games()
returns table(id uuid, title text, finished_at timestamptz, team_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3, 4) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select g.id, g.title, g.finished_at, count(t.id) as team_count
  from games g
  left join teams t on t.game_id = g.id
  where g.status = 'finished' and not g.is_practice
  group by g.id, g.title, g.finished_at
  order by g.finished_at desc nulls last;
end;
$$;

create or replace function public.reports_game_leaderboard(p_game_id uuid)
returns table(team_id uuid, name text, total_score integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3, 4) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select t.id, t.name, coalesce(t.total_score, 0)
  from teams t
  join games g on g.id = t.game_id
  where t.game_id = p_game_id and g.status = 'finished' and not g.is_practice
  order by coalesce(t.total_score, 0) desc;
end;
$$;

create or replace function public.reports_avg_response_time_by_type()
returns table(question_type text, avg_seconds numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3, 4) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select qt.label, round(avg(a.answer_time_ms) / 1000.0, 1) as avg_seconds
  from answers a
  join questions q on q.id = a.question_id
  join question_types qt on qt.id = q.question_type_id
  join games g on g.id = a.game_id
  where g.status = 'finished' and not g.is_practice and a.answer_time_ms is not null
  group by qt.label
  order by avg(a.answer_time_ms);
end;
$$;

create or replace function public.reports_content_theme_usage()
returns table(title text, usage_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3, 4) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select th.title, count(*) as usage_count
  from round_questions rq
  join rounds r on r.id = rq.round_id
  join games g on g.id = r.game_id
  join questions q on q.id = rq.question_id
  join themes th on th.id = q.theme_id
  where g.status = 'finished' and not g.is_practice
  group by th.title
  order by count(*) desc;
end;
$$;

create or replace function public.reports_design_theme_usage()
returns table(title text, usage_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if current_user_role_id() not in (1, 2, 3, 4) then
    raise exception 'insufficient_privilege' using errcode = '42501';
  end if;

  return query
  select coalesce(dt.title, 'Alapértelmezett') as title, count(*) as usage_count
  from games g
  left join design_themes dt on dt.id = g.design_theme_id
  where g.status = 'finished' and not g.is_practice
  group by coalesce(dt.title, 'Alapértelmezett')
  order by count(*) desc;
end;
$$;
