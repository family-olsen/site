# Família Admin v2

Painel administrativo do acervo da família, com Supabase Auth e CRUD real.

## Configuração
1. Abra `js/config.js`.
2. Mantenha a URL do projeto.
3. Confirme a chave **publishable** do Supabase.
4. Crie um usuário em Supabase Auth (email/senha).
5. Cadastre o UUID desse usuário em `public.admin_users` com `role='admin'` e `active=true`.
6. Abra `index.html` em um servidor web (Live Server ou `python -m http.server 5500`).

Não use `service_role` no frontend.

## Módulos
- **Pessoas** — cadastro, busca, biografia, publicação/rascunho.
- **Famílias** — uniões, tipo de relação e vínculo de filhos.
- **Genealogia** — árvore com foco, ancestrais, cônjuge e filhos; zoom e arraste.
- **Histórias** — relatos com resumo, texto, slug e pessoas vinculadas por papel.
- **Livro** — livros e seus capítulos (número, subtítulo, resumo, status).
- **Fotos** — acervo com legenda, data, local, dimensões e pessoas retratadas.
- **Álbuns** — coleções de fotos com ordenação.
- **Eventos** — linha do tempo (nascimento, casamento, falecimento...) com participantes.
- **Documentos** — certidões, cartas e registros, com caminho do arquivo.
- **Fontes** — procedência das informações, com link e documento vinculado.
- **Lugares** — cidades e locais usados por fotos, eventos e documentos.
- **Configurações** — usuário, papel e projeto conectado.

## Observações
- `status` usa `draft` / `published` em todo o painel; `published_at` é preenchido ao publicar.
- Fotos e documentos guardam apenas o **caminho** do arquivo (`thumbnail_path` / `storage_path`).
  O upload para o Supabase Storage ainda não está implementado.
- Os capítulos não têm campo de texto no banco: funcionam como sumário do livro.
