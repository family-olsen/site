drop function if exists public.can_view_site();
alter table public.site_config drop column if exists is_private;
drop table if exists public.site_visitors;
