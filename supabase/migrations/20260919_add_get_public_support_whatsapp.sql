-- =============================================================================
-- get_public_support_whatsapp() — único número que qualquer visitante
-- ANÔNIMO pode ler (nem precisa estar logado). É de propósito: a tela de
-- login precisa mostrar "precisa de ajuda?" pra quem nem conseguiu entrar
-- ainda. Devolve só o telefone (nada mais de plan_limits é exposto aqui) —
-- mesma fonte que já alimenta o card "Precisa de ajuda?" dentro do painel
-- (get_current_plan_limits), então trocar o número em um lugar atualiza os
-- dois.
-- =============================================================================
create or replace function public.get_public_support_whatsapp()
 returns text
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select suporte_whatsapp from public.plan_limits limit 1;
$function$;
