-- =============================================================================
-- Base pra site público/privado (etapa 1 de N — só cria estrutura, não muda
-- nenhuma regra de acesso existente ainda). site_config.is_private nasce
-- false, então can_view_site() sempre devolve true por enquanto — zero
-- mudança de comportamento no site ao vivo até a próxima etapa (que vai
-- condicionar as policies de leitura pública a essa função).
--
-- site_visitors é separado de admin_users de propósito: são conceitos
-- diferentes. admin_users = acesso ao PAINEL (pessoas/fotos/etc, RLS de
-- staff). site_visitors = acesso de LEITURA ao SITE PÚBLICO quando ele
-- estiver marcado como privado — nunca abre o painel admin. A criação de
-- verdade (Auth) passa por Edge Function com service role, igual
-- create-admin-user; RLS aqui só rege leitura/gestão da linha.
-- =============================================================================
create table public.site_visitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.site_visitors enable row level security;

create policy "site_visitors_admin_all" on public.site_visitors
  for all using (is_admin()) with check (is_admin());
create policy "site_visitors_self_read" on public.site_visitors
  for select using (user_id = auth.uid());

alter table public.site_config add column if not exists is_private boolean not null default false;

-- Usado dentro de CADA policy de leitura pública das tabelas de conteúdo
-- (people, photos, stories etc) — etapa seguinte. Site público (padrão) ou
-- staff (admin/editor/operador) ou usuário comum ativo: sempre passa.
-- Site privado + visitante anônimo ou não-cadastrado: bloqueia.
create or replace function public.can_view_site()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select
    coalesce((select is_private from public.site_config limit 1), false) = false
    or is_editor_or_admin()
    or is_operador()
    or exists (select 1 from public.site_visitors where user_id = auth.uid() and active = true);
$function$;
