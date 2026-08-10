-- Fázis Q3 — a kvízeste újranyitása (games.status finished → lobby)
-- érzékeny, ritka, kézi admin-művelet — nyoma kell maradjon, ki és mikor
-- nyitott újra egy estét. A log_table_change() trigger-függvény (Fázis 1)
-- már eleve generikus, újrahasznosítható (a kérdésbank-táblákon már
-- alkalmazva, Fázis 2) — a games táblára eddig egyszerűen nem volt
-- ráakasztva.
create trigger trg_audit_games
  after insert or update or delete on games
  for each row execute function public.log_table_change();
