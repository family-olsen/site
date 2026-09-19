-- =============================================================================
-- suporte_whatsapp — telefone (formato internacional, só dígitos, ex.:
-- 5511999999999) do operador da plataforma, usado pra montar o link de
-- WhatsApp que aparece na tela de Configurações da família ("Precisa de
-- ajuda?"). Fica em plan_limits (não em site_config) porque é configuração
-- do OPERADOR sobre como ser contatado — não é identidade visual do site,
-- e cada projeto/cliente pode ter um operador de suporte diferente no
-- futuro (revenda white-label). Editável só pelo operador, mesma RLS de
-- sempre; exposto a admin/editor só pelo número (via get_current_plan_limits,
-- já a "janela estreita" pra esse papel — não dá acesso à tabela em si).
-- =============================================================================
alter table public.plan_limits
  add column if not exists suporte_whatsapp text;

drop function if exists public.get_current_plan_limits();

create function public.get_current_plan_limits()
 returns table(
   plano text, pessoas_max integer, fotos_max integer, albuns_max integer,
   historias_max integer, eventos_max integer, livros_max integer,
   capitulos_max integer, documentos_max integer, videos_max integer,
   locais_max integer, fontes_max integer, foto_max_mb integer,
   documento_max_mb integer, suporte_whatsapp text
 )
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select plano, pessoas_max, fotos_max, albuns_max, historias_max, eventos_max,
         livros_max, capitulos_max, documentos_max, videos_max, locais_max, fontes_max,
         foto_max_mb, documento_max_mb, suporte_whatsapp
  from public.plan_limits
  where is_editor_or_admin() or is_operador()
  limit 1;
$function$;
