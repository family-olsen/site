-- =============================================================================
-- Etapa 2: condiciona a leitura pública de TODO o conteúdo (pessoas, fotos,
-- histórias, livros, capítulos, eventos, documentos, fontes, lugares,
-- famílias, álbuns e as tabelas de ligação) a can_view_site() — mesma
-- condição de sempre (status='published' etc) MAIS essa checagem. Como
-- can_view_site() sempre devolve true enquanto site_config.is_private=false
-- (padrão), isso não muda NADA no site ao vivo agora — só prepara o terreno
-- pra quando o admin ligar o modo privado.
--
-- ALTER POLICY só troca a cláusula USING, não recria a policy (mais seguro
-- que DROP+CREATE — não há uma janela sem policy nenhuma no meio do caminho).
-- =============================================================================
alter policy "album_photos_public_read" on public.album_photos
  using ((EXISTS ( SELECT 1 FROM albums a WHERE ((a.id = album_photos.album_id) AND (a.status = 'published'::text)))) AND can_view_site());

alter policy "albums_public_read" on public.albums
  using ((status = 'published'::text) AND can_view_site());

alter policy "books_public_read" on public.books
  using ((status = 'published'::text) AND can_view_site());

alter policy "chapters_public_read" on public.chapters
  using (((status = 'published'::text) AND (EXISTS ( SELECT 1 FROM books b WHERE ((b.id = chapters.book_id) AND (b.status = 'published'::text))))) AND can_view_site());

alter policy "documents_public_read" on public.documents
  using ((status = 'published'::text) AND can_view_site());

alter policy "event_people_public_read" on public.event_people
  using (((EXISTS ( SELECT 1 FROM events e WHERE ((e.id = event_people.event_id) AND (e.status = 'published'::text)))) AND (EXISTS ( SELECT 1 FROM people p WHERE ((p.id = event_people.person_id) AND (p.is_public = true) AND (p.status = 'published'::text))))) AND can_view_site());

alter policy "events_public_read" on public.events
  using ((status = 'published'::text) AND can_view_site());

alter policy "family_units_public_read" on public.family_units
  using ((status = 'published'::text) AND can_view_site());

alter policy "people_public_read" on public.people
  using (((is_public = true) AND (status = 'published'::text)) AND can_view_site());

alter policy "photo_people_public_read" on public.photo_people
  using (((EXISTS ( SELECT 1 FROM photos ph WHERE ((ph.id = photo_people.photo_id) AND (ph.status = 'published'::text)))) AND (EXISTS ( SELECT 1 FROM people p WHERE ((p.id = photo_people.person_id) AND (p.is_public = true) AND (p.status = 'published'::text))))) AND can_view_site());

alter policy "photos_public_read" on public.photos
  using ((status = 'published'::text) AND can_view_site());

alter policy "places_public_read" on public.places
  using (((EXISTS ( SELECT 1 FROM people p WHERE (((p.birth_place_id = places.id) OR (p.death_place_id = places.id)) AND (p.is_public = true) AND (p.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM events e WHERE ((e.place_id = places.id) AND (e.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM photos ph WHERE ((ph.place_id = places.id) AND (ph.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM albums a WHERE ((a.place_id = places.id) AND (a.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM documents d WHERE ((d.place_id = places.id) AND (d.status = 'published'::text))))) AND can_view_site());

alter policy "sources_public_read" on public.sources
  using (((status = 'published'::text) AND ((show_in_videos = true) OR (show_on_home = true) OR (EXISTS ( SELECT 1 FROM (person_sources ps JOIN people p ON ((p.id = ps.person_id))) WHERE ((ps.source_id = sources.id) AND (p.is_public = true) AND (p.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM (event_sources es JOIN events e ON ((e.id = es.event_id))) WHERE ((es.source_id = sources.id) AND (e.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM (story_sources ss JOIN stories s ON ((s.id = ss.story_id))) WHERE ((ss.source_id = sources.id) AND (s.status = 'published'::text)))) OR (EXISTS ( SELECT 1 FROM (photo_sources ps JOIN photos p ON ((p.id = ps.photo_id))) WHERE ((ps.source_id = sources.id) AND (p.status = 'published'::text)))))) AND can_view_site());

alter policy "stories_public_read" on public.stories
  using ((status = 'published'::text) AND can_view_site());

alter policy "story_photos_public_read" on public.story_photos
  using (((EXISTS ( SELECT 1 FROM stories s WHERE ((s.id = story_photos.story_id) AND (s.status = 'published'::text)))) AND (EXISTS ( SELECT 1 FROM photos ph WHERE ((ph.id = story_photos.photo_id) AND (ph.status = 'published'::text))))) AND can_view_site());
