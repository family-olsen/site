-- =============================================================================
-- contato_whatsapp — WhatsApp da FAMÍLIA/administradora deste site
-- especificamente (não o do operador da plataforma, que é
-- plan_limits.suporte_whatsapp, nem o do "construtor do site", que fica
-- fixo no código de contato.html). Usado no botão "Você é da família" da
-- página de contato pública, pra quem tem uma história/foto pra contribuir
-- falar direto com quem administra ESTE acervo. Editável só pelo admin,
-- mesma RLS já existente de site_config (leitura pública, escrita admin).
-- =============================================================================
alter table public.site_config
  add column if not exists contato_whatsapp text;

-- Este site (Olsen · Belloto · Leal) já usava esse número fixo no código —
-- preenche a linha existente com o mesmo valor, pra não quebrar o botão
-- "Você é da família" até a família trocar se quiser. Não vira um DEFAULT
-- da coluna (fica null pra sites novos, que devem configurar o seu próprio).
update public.site_config set contato_whatsapp='5541997224176';
