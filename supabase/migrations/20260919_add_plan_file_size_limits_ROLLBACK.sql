drop function if exists public.get_current_plan_limits();

create function public.get_current_plan_limits()
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

alter table public.plan_limits
  drop column if exists foto_max_mb,
  drop column if exists documento_max_mb;
