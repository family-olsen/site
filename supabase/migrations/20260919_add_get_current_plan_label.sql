-- =============================================================================
-- get_current_plan_label() — expõe só o NOME do plano (ex.: "historico"),
-- não os limites nem o uso, pra qualquer usuário logado (admin/editor/
-- operador) conseguir ver "qual plano este site tem" na tela de
-- Configurações, sem dar acesso de leitura à tabela plan_limits inteira
-- (que continua exclusiva do papel operador).
--
-- Retorna NULL pra quem não está autenticado ou não tem nenhum papel em
-- admin_users — testado via chave anon, confirmado que não vaza nada.
-- =============================================================================
create or replace function public.get_current_plan_label()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select plano from public.plan_limits
  where is_editor_or_admin() or is_operador()
  limit 1;
$function$;
