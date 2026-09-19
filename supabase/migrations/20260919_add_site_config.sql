-- =============================================================================
-- site_config — identidade visual do site (logo, título, paleta de cores),
-- editável pela família (só o papel "admin", não "editor" nem "operador")
-- na tela de Configurações. Diferente de plan_limits (que é infraestrutura/
-- comercial e só o operador vê), isto é conteúdo público: qualquer visitante
-- do site precisa poder ler esta linha sem estar logado, pra o logo/cor
-- carregar em toda página pública. Por isso a política de SELECT é aberta
-- (true) — não tem nada sensível aqui, é literalmente o que já aparece pra
-- qualquer um que visita o site.
--
-- color_preset guarda qual predefinição está ativa ('default'|'vinho'|
-- 'esmeralda'|'azul'|'terracota'|'ardosia'|'personalizado'); color_bg/bg2/
-- text/muted/accent sempre guardam os 5 valores RESOLVIDOS (mesmo quando
-- um preset foi escolhido, copiamos os valores fixos do preset pra cá) —
-- assim o site público só precisa ler esta linha e aplicar, sem precisar
-- conhecer a tabela de predefinições (que só existe no JS do admin/site).
-- Quando color_preset='default', o site não aplica nenhuma sobreposição —
-- usa as variáveis já fixas em css/site.css, garantindo zero mudança visual
-- pra quem nunca mexeu nisso.
-- =============================================================================
create table public.site_config (
  id uuid primary key default gen_random_uuid(),
  logo_path text,
  site_title text not null default 'Olsen · Belloto · Leal',
  color_preset text not null default 'default'
    check (color_preset in ('default','vinho','esmeralda','azul','terracota','ardosia','personalizado')),
  color_bg text, color_bg2 text, color_text text, color_muted text, color_accent text,
  updated_at timestamptz not null default now()
);

alter table public.site_config enable row level security;

create policy "site_config_select_public" on public.site_config
  for select using (true);

create policy "site_config_write_admin" on public.site_config
  for all using (is_admin()) with check (is_admin());

insert into public.site_config (site_title, color_preset) values ('Olsen · Belloto · Leal', 'default');
