-- =============================================================================
-- Deixa o operador ativar/desativar um usuário pela tela "Usuários" — active
-- já É a trava de segurança de verdade (is_admin/is_operador/
-- is_editor_or_admin exigem active=true), só faltava o operador conseguir
-- mudar isso sem precisar editar a tabela direto no Supabase.
--
-- GRANT column-level (só a coluna active, não a linha toda) + RLS restrito a
-- is_operador() — mesmo que a coluna esteja liberada pra "authenticated" em
-- geral, a policy abaixo garante que só o operador de fato consegue fazer o
-- UPDATE surtir efeito (pra qualquer outro papel, a cláusula USING dá falso
-- e a operação não afeta nenhuma linha).
-- =============================================================================
grant update (active) on public.admin_users to authenticated;

create policy "admin_users_operador_toggle_active" on public.admin_users
  for update using (is_operador()) with check (is_operador());
