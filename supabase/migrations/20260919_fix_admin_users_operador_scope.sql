-- =============================================================================
-- CORREÇÃO: a migration anterior (20260919_add_admin_users_operador_toggle_
-- active.sql) tentou restringir o operador só à coluna "active" via GRANT
-- UPDATE (active) — mas testando ao vivo, descobri que "authenticated" já
-- tinha GRANT UPDATE de TABELA INTEIRA de antes (padrão do Supabase: GRANTs
-- amplos + RLS é quem de fato restringe). Ou seja, a restrição de coluna não
-- fazia nada — o operador conseguia mudar "role" também, não só "active".
-- Confirmado ao vivo: um usuário de teste teve o role trocado pra "operador"
-- através dessa brecha, e foi corrigido manualmente na hora.
--
-- Fix de verdade: um trigger BEFORE UPDATE que, quando quem está editando é
-- operador (e não admin), recusa a alteração se qualquer coisa ALÉM de
-- "active" mudar. RLS não enxerga coluna nenhuma (é só linha), então isso
-- precisa ser um trigger, não uma policy.
-- =============================================================================
create or replace function public.enforce_admin_users_operador_scope()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if is_operador() and not is_admin() then
    if new.role is distinct from old.role
       or new.display_name is distinct from old.display_name
       or new.email is distinct from old.email
       or new.user_id is distinct from old.user_id then
      raise exception 'Operador só pode ativar/desativar — não pode alterar papel, nome ou e-mail.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists admin_users_operador_scope_trigger on public.admin_users;
create trigger admin_users_operador_scope_trigger
  before update on public.admin_users
  for each row execute function public.enforce_admin_users_operador_scope();

-- A tentativa anterior de restringir por coluna não fazia efeito (GRANT de
-- tabela inteira já cobria tudo) — removida pra não sugerir uma proteção que
-- não existe de verdade. A proteção real agora é só o trigger acima.
revoke update (active) on public.admin_users from authenticated;
grant update on public.admin_users to authenticated;
