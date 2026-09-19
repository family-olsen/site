-- =============================================================================
-- get_current_plan_limits() — como get_current_plan_label(), mas devolve
-- todos os 11 limites numéricos do plano (não só o nome). Continua sem
-- expor a tabela plan_limits em si: qualquer staff logado (admin/editor/
-- operador) pode chamar isto pra saber "quanto falta", mas só o papel
-- operador consegue de fato ler/editar a tabela plan_limits (ver
-- 20260919_add_plan_limits.sql). Usado pelo dashboard do admin/editor pra
-- mostrar limite + % usado dentro de cada cartão de contagem.
-- =============================================================================
create or replace function public.get_current_plan_limits()
 returns table(
   plano text, pessoas_max integer, fotos_max integer, albuns_max integer,
   historias_max integer, eventos_max integer, livros_max integer,
   capitulos_max integer, documentos_max integer, videos_max integer,
   locais_max integer, fontes_max integer
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select plano, pessoas_max, fotos_max, albuns_max, historias_max, eventos_max,
         livros_max, capitulos_max, documentos_max, videos_max, locais_max, fontes_max
  from public.plan_limits
  where is_editor_or_admin() or is_operador()
  limit 1;
$function$;
