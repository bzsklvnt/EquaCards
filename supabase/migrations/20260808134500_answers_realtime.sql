-- Fázis O2 — élő tesztelés: a host "X/40 csapat válaszolt" élő számlálója
-- (docs/architecture/DATA_MODEL.md 7. szakasz, "Postgres Changes az
-- answers táblán") nem frissült valós időben. Kiderült: a supabase_realtime
-- publikációnak (select * from pg_publication_tables where pubname =
-- 'supabase_realtime') egyetlen tagja sem volt — a Postgres Changes
-- funkció emiatt egyetlen táblán sem tudott eseményt küldeni, függetlenül
-- attól, hogy a kliens-oldali feliratkozás és az RLS (answers_staff_all,
-- role_id in (1,2,3)) helyesen volt beállítva.
alter publication supabase_realtime add table answers;
