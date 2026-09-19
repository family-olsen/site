-- =============================================================================
-- Limites de TAMANHO de arquivo (não confundir com os limites de QUANTIDADE
-- já cobertos por plan_limits.fotos_max/documentos_max etc.). O documento
-- comercial define um padrão técnico único (10 MB fotos, 5 MB documentos/
-- outros arquivos) que vale pra qualquer plano — mas o operador pode
-- personalizar por site quando negociado. Ficam na mesma linha de
-- plan_limits, editáveis sempre (não travam atrás do seletor "Personalizado"
-- como os limites de quantidade — são um eixo de configuração separado).
-- =============================================================================
alter table public.plan_limits
  add column if not exists foto_max_mb integer not null default 10,
  add column if not exists documento_max_mb integer not null default 5;

-- get_current_plan_limits() precisa devolver os dois novos campos também,
-- pra admin/editor conseguirem validar o tamanho no navegador com o valor
-- real do plano (client-side check é só UX; quem faz a validação de
-- verdade continua sendo o Storage/trigger, mas isso é P2 futuro).
drop function if exists public.get_current_plan_limits();

create function public.get_current_plan_limits()
 returns table(
   plano text, pessoas_max integer, fotos_max integer, albuns_max integer,
   historias_max integer, eventos_max integer, livros_max integer,
   capitulos_max integer, documentos_max integer, videos_max integer,
   locais_max integer, fontes_max integer, foto_max_mb integer,
   documento_max_mb integer
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select plano, pessoas_max, fotos_max, albuns_max, historias_max, eventos_max,
         livros_max, capitulos_max, documentos_max, videos_max, locais_max, fontes_max,
         foto_max_mb, documento_max_mb
  from public.plan_limits
  where is_editor_or_admin() or is_operador()
  limit 1;
$function$;
