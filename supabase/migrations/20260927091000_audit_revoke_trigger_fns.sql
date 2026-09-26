-- Kódaudit, utolsó lépés: a csak triggerből futó broadcast-függvények és a
-- megszűnt anonim beszúrási szabályok segédfüggvénye nem hívható az API-ról.
revoke execute on function public.broadcast_game_theme() from public, anon, authenticated;
revoke execute on function public.broadcast_design_themes() from public, anon, authenticated;
revoke execute on function public.answer_owner_game_active(uuid) from public, anon;
