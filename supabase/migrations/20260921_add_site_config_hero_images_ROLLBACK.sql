-- Desfaz 20260921_add_site_config_hero_images.sql
alter table public.site_config
  drop column if exists hero_livro_path,
  drop column if exists hero_arvore_path,
  drop column if exists hero_pessoas_path,
  drop column if exists hero_fotos_path;
