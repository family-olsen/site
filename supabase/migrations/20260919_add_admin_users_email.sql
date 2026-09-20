-- =============================================================================
-- Guarda o e-mail junto em admin_users (redundante com auth.users, de
-- propósito) — a tabela auth.users não é exposta via API pra ninguém, nem
-- pro operador, então sem isso a tela "Usuários" não teria como mostrar o
-- e-mail de cada login. A Edge Function create-admin-user já sabe o e-mail
-- no momento da criação e passa a gravar aqui; as 3 linhas que já existiam
-- são preenchidas uma vez, agora, direto de auth.users.
-- =============================================================================
alter table public.admin_users add column if not exists email text;

update public.admin_users au set email = u.email
from auth.users u
where au.user_id = u.id and au.email is null;
