-- =============================================================================
-- hero_livro_path / hero_arvore_path / hero_pessoas_path / hero_fotos_path —
-- as 4 fotos de capa da seção "Comece por aqui" da home pública (Livro,
-- Árvore, Pessoas, Arquivo), editáveis pela família (só papel "admin") na
-- tela de Configurações, mesmo padrão de logo_path/favicon_path já
-- existentes. Nulo = usa a foto padrão do modelo (Assents/inicio-web/*.webp,
-- fixa no HTML); com caminho salvo, resolve pra URL pública do bucket
-- "photos", igual logo/favicon. Nenhuma policy nova precisa — já são
-- colunas de site_config, que já é lido por todo mundo via can_view_site().
-- =============================================================================
alter table public.site_config
  add column if not exists hero_livro_path text,
  add column if not exists hero_arvore_path text,
  add column if not exists hero_pessoas_path text,
  add column if not exists hero_fotos_path text;
