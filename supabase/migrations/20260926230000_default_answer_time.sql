-- Alap válaszidő új kérdéshez (Beállítások › Játék) — docs/features/admin-workspace.md.
insert into app_settings (key, value)
values ('question_default_time_seconds', '30'::jsonb)
on conflict (key) do nothing;
