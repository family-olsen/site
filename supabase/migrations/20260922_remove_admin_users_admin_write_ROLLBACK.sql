create policy admin_users_admin_write on public.admin_users
  for all
  using (is_admin())
  with check (is_admin());
