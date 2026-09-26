-- Kódaudit, 2. lépés (H2): a válaszok és jokerek csak a submit_answer() /
-- use_joker() függvényen át írhatók, és a csapat eszköz-tokenje, valamint a
-- futó estek PIN-je nem olvasható anonim módon. Az új kliens (ami már ezeket
-- a függvényeket használja) élesítése után alkalmazva.

-- A közvetlen (anonim) beszúrás megszűnik — csak a fenti függvényeken át.
drop policy if exists answers_insert_anon_active_game on answers;
drop policy if exists answer_choice_insert_anon on answer_choice;
drop policy if exists answer_choice_multi_insert_anon on answer_choice_multi;
drop policy if exists answer_slider_insert_anon on answer_slider;
drop policy if exists answer_ordering_insert_anon on answer_ordering;
drop policy if exists team_joker_uses_insert_anon_active_game on team_joker_uses;
revoke insert on answers, answer_choice, answer_choice_multi, answer_slider, answer_ordering,
  team_joker_uses from anon;

-- A csapat eszköz-tokenje és a futó estek PIN-je nem olvasható anonim módon.
revoke select on teams from anon;
grant select (id, game_id, name, color, total_score, joined_at) on teams to anon;
revoke select on games from anon;
grant select (
  id, title, status, current_round_id, current_question_id, created_at, started_at,
  finished_at, design_theme_id, current_question_started_at, current_question_duration_seconds,
  is_practice, scheduled_at, venue_id, is_public, max_players, public_note, join_requires_code,
  current_question_reading_seconds
) on games to anon;

