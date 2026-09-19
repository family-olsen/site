-- =============================================================================
-- favicon_path — ícone da aba do navegador (favicon), separado do logo do
-- cabeçalho (que já existe em site_config.logo_path). Upload próprio porque
-- um bom favicon costuma ser uma versão simplificada/recortada do logo, não
-- o mesmo arquivo. Aplicado via JS trocando o href dos <link rel="icon">
-- depois que a página já carregou (navegadores modernos atualizam o ícone
-- da aba em tempo real com isso) — sem favicon_path configurado, mantém o
-- ícone estático já fixo no HTML de cada página.
-- =============================================================================
alter table public.site_config add column if not exists favicon_path text;
