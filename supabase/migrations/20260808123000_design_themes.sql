-- Phase 6: vizuális köntös / design téma rendszer
-- Séma forrás: docs/architecture/DATA_MODEL.md 8. szakasz.

create table design_themes (
  id uuid primary key default gen_random_uuid(),
  title text unique not null,
  design_tokens jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz default now()
);

create unique index idx_design_themes_default on design_themes (is_default) where is_default = true;

create or replace function public.enforce_single_default_design_theme()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if NEW.is_default then
    update design_themes set is_default = false where id != NEW.id and is_default = true;
  end if;
  return NEW;
end;
$$;

create trigger trg_single_default_design_theme
  before insert or update on design_themes
  for each row execute function public.enforce_single_default_design_theme();

insert into design_themes (title, design_tokens, is_default) values (
  'Retro Arcade',
  '{
    "--cabinet": "#150E2C",
    "--cabinet-2": "#211640",
    "--cabinet-3": "#2C1D54",
    "--marquee": "#F5F0FF",
    "--marquee-dim": "#A79BC9",
    "--cyan": "#35E7FF",
    "--magenta": "#FF3E9A",
    "--power": "#B6FF3E",
    "--danger": "#FF5A36",
    "--coin": "#FFD23E",
    "--violet": "#9B5CFF",
    "font_display": "\"Press Start 2P\", monospace",
    "font_led": "\"Silkscreen\", monospace",
    "font_body": "\"Inter\", sans-serif"
  }'::jsonb,
  true
);

-- games: opcionális, a tartalmi témától (`themes`) teljesen független
-- vizuális köntös-választás. A `games` már Fázis 2 óta létezik, ezért ALTER,
-- nem create table.
alter table games add column design_theme_id uuid references design_themes(id);

alter table design_themes enable row level security;

-- Admin/super_admin (1,2) szerkeszti a vizuális témákat — ugyanaz a kör, mint
-- a tartalmi `themes`-nél (DATA_MODEL.md 1. szakasz).
create policy "design_themes_admin_all" on design_themes
  for all to authenticated
  using (public.current_user_role_id() in (1, 2))
  with check (public.current_user_role_id() in (1, 2));

-- A host (role_id 3) is választhat vizuális témát a "Kvíz indítása" előtt
-- (DATA_MODEL.md 7. szakasz), tehát olvasnia kell tudnia a listát.
create policy "design_themes_select_staff" on design_themes
  for select to authenticated
  using (public.current_user_role_id() in (1, 2, 3));

-- A csapat és a TV kliens is anon — mindkettőnek fel kell tudnia oldania a
-- games.design_theme_id-t a tényleges token-készletre a megjelenítéshez.
-- A design_tokens tisztán vizuális adat (szín/font), nincs benne semmi, amit
-- védeni kellene privacy szempontból.
create policy "design_themes_select_anon" on design_themes
  for select to anon
  using (true);
