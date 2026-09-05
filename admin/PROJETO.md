# Família Admin v2 — Histórico do projeto

Este arquivo documenta o que foi feito neste projeto, sessão a sessão, para que
qualquer LLM (ou pessoa) possa continuar o trabalho sem precisar redescobrir
o schema do banco ou os padrões de código já estabelecidos.

## Estado do projeto ao iniciar (herdado, não feito por IA)

Pasta `familia-admin-v2.1-login-diagnostico/`, projeto estático (sem build):

- `index.html` — shell do painel: tela de login + app com sidebar de 12 itens
- `js/config.js` — URL e chave **publishable** do Supabase (não é segredo sensível,
  é a chave pública de cliente)
- `js/admin.js` — toda a lógica em um arquivo só, sem módulos/bundler
- `css/admin.css` — estilo único, também sem pré-processador
- Backend: Supabase (projeto `igglfuatavmxabffaflb`), com Auth (email/senha) e
  Postgres. Controle de acesso via tabela `public.admin_users` (`user_id`,
  `role`, `active`) — só usuários cadastrados lá com `active=true` entram.
- Já funcionando: **Pessoas** (CRUD), **Famílias** (uniões + filhos) e
  **Genealogia** (árvore com zoom/pan).
- Os outros 9 itens do menu (Livro, Histórias, Fotos, Álbuns, Eventos, Vídeos,
  Documentos, Fontes, Configurações) eram só links sem conteúdo.

Não é um repositório git (`git init` nunca foi rodado nesta pasta).

## Sessão 1 — Módulo Histórias

Escolhido entre as opções restantes por não exigir upload de arquivo (Fotos/Álbuns
adiariam para depois, quando storage estivesse decidido).

### Descoberta de schema
O MCP do Supabase não tinha permissão para este projeto a partir desta sessão
(`ProtocolError: permission denied`). Sem acesso a `list_tables`, o schema real
foi descoberto **sondando a API REST com a chave publishable**:
- Um `select=coluna_falsa` retorna erro `42703 column does not exist` se a coluna
  não existe, e `200 []` se existe (mesmo em tabela vazia).
- Isso permite mapear colunas uma a uma sem precisar de acesso admin.

Resultado para `stories`: `id, title, slug, summary, content, status,
cover_photo_id, published_at, created_at, updated_at`.
Tabela de vínculo `story_people`: chave composta `story_id, person_id, role`
(sem `id` próprio) — mesmo padrão de `family_unit_members`.

### O que foi implementado
- Seção `#historias` com busca + filtro de status.
- Modal de história: título, slug (auto-gerado do título, editável), status,
  resumo, texto.
- Modal de "Pessoas na história": vincula pessoas com papel
  (Protagonista / Mencionado / Narrador).
- `published_at` preenchido automaticamente ao publicar, preservado em edições
  seguintes, zerado ao voltar pra rascunho.
- Contador de histórias no card do dashboard.

### Padrões de código estabelecidos (seguidos depois em tudo)
- `$(seletor)` é atalho pra `document.querySelector`.
- Cada entidade principal tem: `loadX()` (busca + guarda em variável global),
  `renderX()` (desenha tabela, trata estado vazio com empty-state e botão),
  `openXModal(item=null)` / `closeXModal()`, `saveX(e)` (upsert por presença de
  id oculto no form), `deleteX(id)` (com `confirm()`).
- Tabelas de vínculo N:N (pessoa↔história, pessoa↔foto, etc.) usam um modal
  secundário "gerenciar vínculos" com sub-lista + form de adicionar, chamado a
  partir de um botão na linha da tabela principal.
- `escapeHtml()` em todo texto injetado via `innerHTML`.
- Erros de banco aparecem inline no formulário (`showError`), nunca em `alert`
  exceto pra delete/erros inesperados de vínculo.
- `slugify()` normaliza (remove acento via unicode range `̀-ͯ`),
  minúsculas, troca não-alfanuméricos por hífen.

## Sessão 2 — Todos os módulos restantes ("faz tudo")

Implementados de uma vez: **Livro** (livros + capítulos), **Fotos**, **Álbuns**,
**Eventos**, **Documentos**, **Fontes**, **Lugares** (novo item de menu, não
pedido explicitamente mas necessário — é FK em Fotos/Álbuns/Eventos/Documentos)
e **Configurações** (tela simples com usuário/papel/projeto conectado).
"Vídeos" ficou de fora — não há tabela `videos` no banco.

### Descoberta de schema (mesma técnica da sessão 1)
Tabelas confirmadas existentes: `photos`, `albums`, `album_photos`, `events`,
`documents`, `sources`, `chapters`, `books`, `places`, `event_people`,
`photo_people`. (`media` e `tags` **não existem** — não inventar código para elas.)

Descobertas importantes que evitaram bugs:
- **`photos` não tem coluna para o arquivo original**, só `thumbnail_path`.
  Upload real de imagem não está implementado — o campo é só um caminho de texto
  que o usuário digita manualmente.
- **`chapters` não tem coluna de texto/conteúdo** (nem `content`, nem `body`,
  nem `text`) e **não existe tabela ligando capítulo↔história**. Ou seja, no
  schema atual um capítulo é só metadado de sumário (número, título, subtítulo,
  resumo, status) — não um editor de texto.
- `album_photos`, `event_people`, `photo_people` são chave composta sem `id`.
- Nenhuma coluna `*_type`/`status` tem CHECK/enum no Postgres (aceitam texto
  livre) — os valores usados (`draft`/`published`, `birth`/`marriage`/... etc.)
  são convenção do frontend, não restrição do banco.

Todas as descobertas foram feitas com scripts Node ad-hoc rodados contra a API
REST (arquivos temporários em pasta de scratchpad, não versionados). Ao final,
**todas as 23 queries de leitura e as 77 colunas de escrita foram validadas
contra o banco real** (status 200 / coluna existe) antes de dar como concluído.

### O que foi implementado
- **Lugares** (`places`): nome, tipo, cidade, país, lat/lng, descrição. Alimenta
  datalist usado por Fotos, Álbuns, Eventos e Documentos.
- **Fotos** (`photos` + `photo_people`): título, legenda, descrição, data, local,
  status, caminho da miniatura, mime type, largura/altura; modal de pessoas
  retratadas com papel (Retratado/Fotógrafo/Mencionado).
- **Álbuns** (`albums` + `album_photos`): título, data, local, descrição, status;
  modal de fotos do álbum com ordenação automática (`order_index` incremental).
- **Eventos** (`events` + `event_people`): título, tipo (nascimento/casamento/
  falecimento/batismo/imigração/outro), data (+ precisão), início/fim, local,
  status; modal de pessoas envolvidas com papel (Principal/Testemunha/Presente).
- **Documentos** (`documents`): título, tipo, data (+ precisão), local, status,
  caminho do arquivo, mime type.
- **Fontes** (`sources`): título, tipo, documento vinculado, URL, descrição,
  notas.
- **Livro** (`books` + `chapters`): CRUD de livros (título, subtítulo, slug,
  status, descrição) com modal de capítulos por livro — lista + form inline de
  adicionar/editar (número, título, subtítulo, resumo, status).
- **Configurações**: mostra e-mail da sessão, papel do `admin_users` e nome do
  projeto Supabase (extraído da URL) — somente leitura, sem forms.
- Dashboard: contadores de Fotos e Capítulos ligados aos dados reais (antes
  eram `0` fixo no HTML).

### CSS adicionado
`.modal-card.wide` (modal de capítulos, mais largo), `.inline-form` (separador
do form de capítulo dentro do modal), `.config-grid` (grid de 3 cards em
Configurações), `code` (estilo inline usado no hint de Configurações).

### Verificação feita antes de reportar concluído
1. `node --check js/admin.js` — sintaxe válida.
2. Contagem de `<section>`/`<div>` abertos vs. fechados no HTML — balanceado.
3. Todo `$('#id')` usado no JS confirmado existente no HTML (exceto elementos
   criados dinamicamente tipo `emptyAddFoo`, que são esperados).
4. **Todas as 23 queries `.from().select()`** rodadas de fato contra a API REST
   do Supabase (só leitura, com a chave publishable) — todas retornaram 200,
   inclusive os embeds aninhados tipo `photo_people(role,person_id,people(full_name))`.
5. **Todas as 77 colunas usadas nos payloads de insert/update** checadas uma a
   uma contra a API — todas existem.
6. Simulação de carregamento da página num DOM fake (Node, sem browser real):
   carrega `admin.js`, injeta um stub do client Supabase, dispara
   `DOMContentLoaded` e confirma que nenhum handler quebra por elemento nulo.

**O que não foi testado**: escrita real (insert/update/delete) fim a fim,
porque o RLS do Supabase bloqueia insert anônimo por design — só dá pra testar
logado no painel de verdade. Também não foi aberto num navegador real (só
simulação em Node); vale abrir e clicar antes de considerar 100% pronto.

## Decisões/limitações conhecidas para continuar depois

- **Upload de arquivo não existe.** Fotos e documentos guardam só um caminho de
  texto (`thumbnail_path` / `storage_path`) digitado manualmente. Para upload
  real seria preciso: criar bucket no Supabase Storage, definir políticas de
  acesso, e trocar o campo de texto por um `<input type="file">` + chamada
  `client.storage.from(bucket).upload(...)`.
- **Capítulos não têm corpo de texto no banco atual.** Se quiser que cada
  capítulo tenha um texto editável, é preciso rodar uma migration adicionando
  uma coluna (ex.: `content text`) em `chapters`, ou criar uma tabela de ligação
  capítulo↔história.
- **"Vídeos" não tem tabela no banco.** Se for implementar, primeiro decidir o
  schema (provavelmente similar a `photos`, com `storage_path`/`duration`/etc.)
  e criar a tabela via migration antes de escrever o frontend.
- O MCP do Supabase (`claude.ai Supabase`) não tem permissão neste projeto a
  partir desta máquina/sessão. Se isso for corrigido no futuro, dá pra usar
  `list_tables(verbose=true)` diretamente em vez da técnica de sondagem via REST.
- Projeto não é repositório git. Nenhum commit foi feito; todo o histórico de
  mudanças existe só como estado atual dos arquivos + este documento.

## Como validar rapidamente depois de qualquer mudança futura

```bash
node --check js/admin.js
```

Para checar se uma coluna existe numa tabela sem acesso ao MCP:
```bash
K='<chave publishable de js/config.js>'
U='<SUPABASE_URL de js/config.js>'
curl -s "$U/rest/v1/NOME_TABELA?select=NOME_COLUNA&limit=0" \
  -H "apikey: $K" -H "Authorization: Bearer $K"
# 200 [] => coluna existe. Erro 42703 => não existe.
```
