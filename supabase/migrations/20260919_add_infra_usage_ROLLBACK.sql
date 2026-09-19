drop function if exists public.get_infra_usage();

alter table public.plan_limits
  drop column if exists db_max_mb,
  drop column if exists storage_max_mb;
