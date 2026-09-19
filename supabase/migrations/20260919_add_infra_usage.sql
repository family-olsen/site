-- =============================================================================
-- Uso REAL de infraestrutura (banco de dados + storage), diferente dos
-- limites de negócio (contagem de pessoas/fotos/etc, já cobertos em
-- plan_limits) e dos limites de tamanho de arquivo por upload. Aqui é o
-- espaço de fato ocupado no projeto Supabase, comparado ao teto do plano
-- de hospedagem contratado (ex.: Free tier = 500 MB banco / 1 GB storage).
-- Só o operador vê isso — é informação de infraestrutura, não de negócio,
-- e não faz sentido pra família ver "quantos MB o banco está usando".
-- db_max_mb/storage_max_mb são editáveis pelo operador porque cada site
-- pode estar num projeto Supabase de plano diferente (Free, Pro, etc.).
-- =============================================================================
alter table public.plan_limits
  add column if not exists db_max_mb integer not null default 500,
  add column if not exists storage_max_mb integer not null default 1024;

create or replace function public.get_infra_usage()
 returns table(db_bytes bigint, storage_bytes bigint, storage_by_bucket jsonb)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    pg_database_size(current_database()),
    (select coalesce(sum((metadata->>'size')::bigint),0) from storage.objects),
    (select coalesce(jsonb_object_agg(bucket_id, bytes), '{}'::jsonb) from (
       select bucket_id, coalesce(sum((metadata->>'size')::bigint),0) as bytes
       from storage.objects group by bucket_id
     ) t)
  where is_operador();
$function$;
