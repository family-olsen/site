-- =============================================================================
-- Legado Digital — limites de plano
-- Adiciona: tabela plan_limits, papel "operador", função e triggers que
-- travam novos cadastros quando o plano atinge o limite de cada recurso.
--
-- Ponto de recuperação antes desta migration: tag git
-- "backup-antes-limites-de-plano-2026-09-19" + supabase/migrations/
-- 20260919_add_plan_limits_ROLLBACK.sql (desfaz exatamente isto).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela plan_limits — uma linha só por site (cada família tem o próprio
--    banco). NULL num campo *_max = sem limite nesse recurso (usado pelo
--    plano Personalizado até alguém preencher o número negociado).
-- -----------------------------------------------------------------------------
create table public.plan_limits (
  id uuid not null default gen_random_uuid(),
  plano text not null default 'historico',
  pessoas_max integer,
  fotos_max integer,
  albuns_max integer,
  historias_max integer,
  eventos_max integer,
  livros_max integer,
  capitulos_max integer,
  documentos_max integer,
  videos_max integer,
  locais_max integer,
  fontes_max integer,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.plan_limits add constraint plan_limits_pkey primary key (id);
alter table public.plan_limits add constraint plan_limits_plano_chk
  check (plano = any (array['autonomo','essencial','familia','ampliado','historico','personalizado']));

-- trigger de updated_at, mesmo padrão já usado no resto do banco
create trigger plan_limits_updated_at before update on public.plan_limits
  for each row execute function set_updated_at();

-- linha inicial: Legado Histórico (plano contratado deste site), com os
-- números exatos da tabela comercial oficial (TABELA_LIMITES_PLANOS.md)
insert into public.plan_limits
  (plano, pessoas_max, fotos_max, albuns_max, historias_max, eventos_max,
   livros_max, capitulos_max, documentos_max, videos_max, locais_max, fontes_max)
values
  ('historico', 1000, 2000, 80, 200, 1500, 10, 600, 100, 100, 500, 500);

-- -----------------------------------------------------------------------------
-- 2. Papel "operador" — só quem tem esse papel em admin_users lê/edita
--    plan_limits. Nem admin nem editor (a família) têm acesso a essa tabela
--    nem à tela de Configurações que vai lê-la.
-- -----------------------------------------------------------------------------
alter table public.admin_users drop constraint admin_users_role_chk;
alter table public.admin_users add constraint admin_users_role_chk
  check (role = any (array['admin','editor','viewer','operador']));

create or replace function public.is_operador()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and active = true and role = 'operador'
  );
$function$;

-- -----------------------------------------------------------------------------
-- 3. RLS de plan_limits
-- -----------------------------------------------------------------------------
alter table public.plan_limits enable row level security;

create policy "plan_limits_operador_all" on public.plan_limits
  as permissive for all to authenticated
  using (is_operador())
  with check (is_operador());

-- -----------------------------------------------------------------------------
-- 4. Função genérica de trava — usada por people, photos, albums, stories,
--    events, books, chapters, documents e places. Recebe o nome da coluna
--    de limite (em plan_limits) como argumento da trigger.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_plan_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  limit_col text := TG_ARGV[0];
  current_count integer;
  max_allowed integer;
begin
  execute format('select count(*) from public.%I', TG_TABLE_NAME) into current_count;
  execute format('select %I from public.plan_limits limit 1', limit_col) into max_allowed;
  if max_allowed is not null and current_count >= max_allowed then
    raise exception 'Limite do plano atingido. Seu plano atingiu o limite permitido para este tipo de conteúdo. Entre em contato com o administrador para avaliar um upgrade de plano.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

create trigger enforce_people_limit before insert on public.people
  for each row execute function enforce_plan_limit('pessoas_max');
create trigger enforce_photos_limit before insert on public.photos
  for each row execute function enforce_plan_limit('fotos_max');
create trigger enforce_albums_limit before insert on public.albums
  for each row execute function enforce_plan_limit('albuns_max');
create trigger enforce_stories_limit before insert on public.stories
  for each row execute function enforce_plan_limit('historias_max');
create trigger enforce_events_limit before insert on public.events
  for each row execute function enforce_plan_limit('eventos_max');
create trigger enforce_books_limit before insert on public.books
  for each row execute function enforce_plan_limit('livros_max');
create trigger enforce_chapters_limit before insert on public.chapters
  for each row execute function enforce_plan_limit('capitulos_max');
create trigger enforce_documents_limit before insert on public.documents
  for each row execute function enforce_plan_limit('documentos_max');
create trigger enforce_places_limit before insert on public.places
  for each row execute function enforce_plan_limit('locais_max');

-- -----------------------------------------------------------------------------
-- 5. sources é usada pra dois recursos comerciais diferentes ao mesmo tempo:
--    "Vídeos" (source_type='video') e "Fontes bibliográficas" (todo o resto).
--    Por isso tem função própria, em vez de usar a genérica acima.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_sources_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  current_count integer;
  max_allowed integer;
begin
  if new.source_type = 'video' then
    select count(*) into current_count from public.sources where source_type = 'video';
    select videos_max into max_allowed from public.plan_limits limit 1;
  else
    select count(*) into current_count from public.sources where source_type <> 'video';
    select fontes_max into max_allowed from public.plan_limits limit 1;
  end if;
  if max_allowed is not null and current_count >= max_allowed then
    raise exception 'Limite do plano atingido. Seu plano atingiu o limite permitido para este tipo de conteúdo. Entre em contato com o administrador para avaliar um upgrade de plano.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

create trigger enforce_sources_limit before insert on public.sources
  for each row execute function enforce_sources_limit();

-- Links externos: sempre ilimitados em todo plano (TABELA_LIMITES_PLANOS.md) —
-- de propósito, nenhuma trigger criada pra isso.
