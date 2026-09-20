-- =============================================================================
-- Permite ao operador LISTAR os usuários da família (admin_users) — hoje só
-- existe leitura da própria linha (admin_users_self_read) e escrita irrestrita
-- pro papel admin (admin_users_admin_write). O operador precisa enxergar a
-- lista pra mostrar na tela "Usuários" quem já foi cadastrado — a CRIAÇÃO em
-- si não passa por aqui (RLS não alcança auth.users), é feita por uma Edge
-- Function com a service role key, nunca pelo navegador.
-- =============================================================================
create policy "admin_users_operador_read" on public.admin_users
  for select using (is_operador());
