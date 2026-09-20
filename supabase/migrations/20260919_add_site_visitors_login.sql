-- =============================================================================
-- Login "de usuário" pro usuário comum — não precisa ser um e-mail de
-- verdade (diferente de admin/editor/operador, onde o e-mail é obrigatório
-- porque é o identificador do Supabase Auth). O Auth continua exigindo um
-- e-mail por baixo dos panos; quando não tem um de verdade, sintetiza
-- "<login>@visitante.local" — a pessoa nunca vê isso, só usa o login dela
-- pra entrar. Se o admin também guardar o e-mail de verdade, os recursos
-- que dependem de e-mail (convite/reset) continuam funcionando; sem e-mail
-- real, só "definir senha temporária" fica disponível pra essa pessoa.
-- =============================================================================
alter table public.site_visitors add column if not exists login text;
create unique index if not exists site_visitors_login_key on public.site_visitors (lower(login));
