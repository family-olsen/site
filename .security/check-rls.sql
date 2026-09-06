-- 1) RLS está LIGADO em todas as tabelas públicas?
select relname as tabela, relrowsecurity as rls_ligado, relforcerowsecurity as rls_forcado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and relkind = 'r'
order by relname;

-- 2) Quais políticas existem, pra quem, e o que cada uma permite
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
