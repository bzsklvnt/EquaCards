-- Fázis Q6 — kép feltöltés kérdésekhez/válaszlehetőségekhez. A séma
-- (questions.image_url, question_choice_options.image_url) már a Fázis 2
-- óta létezik, csak nem volt hozzá tényleges tárolóhely/feltöltési út.
--
-- "question-images" Storage bucket: PUBLIKUS olvasás (a /play és /tv
-- felület is anon kliensként tölti be a képeket — ugyanaz a bizalmi
-- modell, mint a design_themes_select_anon-nál, docs/architecture/
-- DATA_MODEL.md 8. szakasz: ez tisztán vizuális adat, nincs benne
-- védendő), de ÍRÁS (upload/update/delete) csak super_admin/admin
-- (role_id in (1,2)) — ugyanaz a jogosultsági kör, mint a kérdésbank
-- CRUD-nál (questions_admin_all).
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "question_images_public_read" on storage.objects
  for select
  using (bucket_id = 'question-images');

create policy "question_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'question-images' and public.current_user_role_id() in (1, 2));

create policy "question_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'question-images' and public.current_user_role_id() in (1, 2))
  with check (bucket_id = 'question-images' and public.current_user_role_id() in (1, 2));

create policy "question_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'question-images' and public.current_user_role_id() in (1, 2));
