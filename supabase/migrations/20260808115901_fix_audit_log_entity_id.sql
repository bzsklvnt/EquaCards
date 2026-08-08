-- Fázis 5 tesztelés közben talált Fázis 2 hiba javítása.
-- log_table_change() eredetileg `coalesce(NEW.id, OLD.id)`-vel próbálta
-- kiolvasni az entity_id-t — ez típusos rekordmező-hozzáférés, ami runtime
-- hibával elszáll ("record NEW has no field id") minden olyan táblán, aminek
-- NEM "id" az elsődleges kulcs oszlopa. A trg_audit_question_slider_config
-- trigger pont egy ilyen táblára van rákötve (question_slider_config PK-ja
-- `question_id`), tehát bármilyen INSERT/UPDATE/DELETE erre a táblára eddig
-- elszállt — vagyis egy slider típusú kérdés létrehozása/szerkesztése az
-- admin felületen jelenleg hibázik. A sandbox HTTPS-blokkolása miatt ez
-- Fázis 2-ben nem derült ki élő böngészős teszttel; most, a Fázis 5-ös
-- pontszámítás SQL-tesztfixturáinak felvitelekor bukott ki.
--
-- Javítás: `to_jsonb(...)->>'id'` szöveges kiolvasás, ami hiányzó mező esetén
-- egyszerűen null-t ad típushiba helyett — a teljes előtte/utána állapot
-- (a valódi elsődleges kulccsal együtt) továbbra is megvan a before_data/
-- after_data jsonb oszlopokban, csak az entity_id lesz null az ilyen
-- táblákra.
create or replace function public.log_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    coalesce(
      nullif(to_jsonb(NEW) ->> 'id', '')::uuid,
      nullif(to_jsonb(OLD) ->> 'id', '')::uuid
    ),
    case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('UPDATE', 'INSERT') then to_jsonb(NEW) end
  );
  return coalesce(NEW, OLD);
end;
$$;
