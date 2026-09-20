drop index if exists public.site_visitors_login_key;
alter table public.site_visitors drop column if exists login;
