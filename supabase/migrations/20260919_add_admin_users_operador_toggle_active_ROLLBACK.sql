drop policy if exists "admin_users_operador_toggle_active" on public.admin_users;
revoke update (active) on public.admin_users from authenticated;
