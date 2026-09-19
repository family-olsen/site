-- =============================================================================
-- ROLLBACK de 20260919_add_plan_limits.sql — desfaz exatamente o que aquela
-- migration criou, nesta ordem (triggers/functions antes das tabelas).
-- Não apaga nenhum dado de people/photos/etc — só remove a trava e a tabela
-- de configuração de plano.
-- =============================================================================

drop trigger if exists enforce_sources_limit on public.sources;
drop function if exists public.enforce_sources_limit();

drop trigger if exists enforce_people_limit on public.people;
drop trigger if exists enforce_photos_limit on public.photos;
drop trigger if exists enforce_albums_limit on public.albums;
drop trigger if exists enforce_stories_limit on public.stories;
drop trigger if exists enforce_events_limit on public.events;
drop trigger if exists enforce_books_limit on public.books;
drop trigger if exists enforce_chapters_limit on public.chapters;
drop trigger if exists enforce_documents_limit on public.documents;
drop trigger if exists enforce_places_limit on public.places;
drop function if exists public.enforce_plan_limit();

drop policy if exists "plan_limits_operador_all" on public.plan_limits;
drop table if exists public.plan_limits;

drop function if exists public.is_operador();

alter table public.admin_users drop constraint if exists admin_users_role_chk;
alter table public.admin_users add constraint admin_users_role_chk
  check (role = any (array['admin','editor','viewer']));
