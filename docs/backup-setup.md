# Como configurar o backup automático (banco + fotos/documentos)

Runbook de como montar o backup mensal do zero pra um cliente novo do
Legado Digital. Guarda o passo a passo E as pegadinhas que já
descobrimos, pra não perder tempo redescobrindo.

O resultado final: todo dia 1 do mês (ou quando você rodar manualmente
pela aba Actions do GitHub), um workflow baixa o banco inteiro
(`pg_dump`) e todos os arquivos dos buckets de Storage, e sobe tudo
pro Google Drive do cliente. De graça, sem plano pago em nenhum dos
três serviços (Supabase, GitHub, Google).

## Por que não dá pra simplificar mais

**Por que não commitar o dump no próprio repositório GitHub?**
Se o repositório for público (como este), um dump completo do banco
expõe todo mundo cadastrado, inclusive registros marcados como
privados/não publicados — o dump ignora toda regra de RLS. Por isso o
backup vai pro Drive, não pro Git.

**Por que não usar uma conta de serviço do Google (service account)
pra subir pro Drive?**
Já tentamos. Contas de serviço não têm cota de armazenamento própria
em contas Google **pessoais** (sem Google Workspace) — dá erro
`storageQuotaExceeded` até tentando criar arquivo numa pasta
compartilhada como Editor. Isso só funcionaria com um "Shared Drive"
do Workspace, que não existe em conta pessoal. A solução é autenticar
como o usuário de verdade via OAuth (o cliente autoriza uma vez, e o
token fica salvo — não precisa logar de novo depois).

**Por que o `pg_dump` do runner do GitHub Actions falha direto?**
O Ubuntu do runner vem com `postgresql-client` 16 por padrão, mas o
Supabase roda Postgres 17 — `pg_dump` recusa rodar contra um servidor
mais novo que ele mesmo (`aborting because of server version
mismatch`). E se o script não tiver `set -euo pipefail`, esse erro
fica escondido: o `pg_dump | gzip` "funciona" porque o gzip comprime
um fluxo vazio e sai com sucesso, gerando um backup de 20 bytes que
parece válido no log do Actions. Verifique sempre baixando o arquivo e
conferindo o tamanho/conteúdo, não só o status verde do workflow.

## Passo a passo (por cliente novo)

### 1. Pegar a connection string do banco (Supabase)

No projeto do cliente: **Project Settings → Database → Connect →
Direct → Connection Method: Session pooler** (não "Direct connection"
— essa é IPv6-only e o GitHub Actions só alcança IPv4). Clique em
"Reset database password" pra gerar uma senha nova e visível (a
original não é recuperável). Copie a connection string inteira, já
com a senha.

Isso vira o secret `DATABASE_URL` no repositório do cliente (Settings
→ Secrets and variables → Actions → New repository secret).

### 2. Criar o projeto no Google Cloud

Em [console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate),
criar um projeto novo (ex.: `legado-digital-backups-<cliente>`).

### 3. Ativar a API do Google Drive

`console.cloud.google.com/apis/library/drive.googleapis.com` → botão
Ativar (com o projeto certo selecionado no topo).

### 4. Configurar a tela de consentimento OAuth

`console.cloud.google.com/apis/credentials/consent`:
- Tipo de usuário: **Externo** (contas pessoais não têm "Interno").
- Nome do app, e-mail de suporte, e-mail de contato: pode usar o
  e-mail do próprio cliente.
- **Público-alvo → Usuários de teste → Add users**: adicionar o
  e-mail da conta Google do cliente aqui. Sem isso, a autorização
  falha com `Erro 403: access_denied` mesmo logando na conta certa.

### 5. Criar o cliente OAuth (tipo Desktop)

`console.cloud.google.com/apis/credentials` → Criar credenciais → ID
do cliente OAuth → **Tipo: App para computador** (não "Web" — esse
tipo não pede URL de redirecionamento e funciona com
`rclone authorize`).

A chave secreta só aparece **uma vez**, na hora de criar. Se perder,
não tem como recuperar — só apagar o cliente e criar outro (o botão
"Baixar o JSON" ajuda a não perder). Guarda os dois valores
(`client_id` e `client_secret`) como secrets no repo:
`GDRIVE_CLIENT_ID` e `GDRIVE_CLIENT_SECRET`.

⚠️ **Cuidado**: o arquivo `.json` baixado às vezes cai direto na pasta
do projeto (não no Downloads) — sempre confira e apague depois de
copiar o conteúdo, nunca deixe esse arquivo no repositório. O
`.gitignore` já tem um padrão (`client_secret_*.json`) protegendo
contra commit acidental, mas vale checar.

### 6. Criar e compartilhar a pasta no Drive

Na conta do cliente, criar uma pasta (ex.: "Backups do Site") em
`drive.google.com`. Pegar o ID da pasta pela URL
(`drive.google.com/drive/folders/<ID>`) — não precisa compartilhar
com ninguém, é a própria conta do dono que vai autorizar o acesso no
próximo passo.

### 7. Autorizar o rclone (uma vez, localmente)

Baixar o rclone (`downloads.rclone.org`) numa máquina com navegador —
pode ser a sua, não precisa ser a do cliente. Rodar:

```powershell
rclone authorize "drive" "<client_id>" "<client_secret>"
```

Abre o navegador pedindo login — **usar a conta do cliente**, não a
sua. Depois de clicar "Permitir", o terminal mostra um bloco JSON
(`{"access_token":...}`). Isso vira o secret `GDRIVE_TOKEN`.

### 8. Ajustar o workflow

Copiar `.github/workflows/backup-database.yml` deste projeto pro
repositório do cliente novo, e trocar:
- `root_folder_id` (linha dentro de "Configurar acesso ao Google
  Drive") pelo ID da pasta do passo 6.
- Nome do arquivo de backup (`olsenbellotoleal-...`) pelo nome do
  cliente, se quiser deixar mais identificável.
- As URLs/chave do Supabase no passo "Baixar fotos e documentos do
  Storage" (`SUPABASE_URL` e `SUPABASE_KEY` — essa é a chave
  *publishable*, pública por natureza, pode ficar direto no YAML).

### 9. Testar

Aba **Actions** do repositório → workflow "Backup do banco de dados e
do Storage" → **Run workflow**. Depois, baixar o arquivo gerado da
pasta do Drive e conferir de verdade (não só confiar no ✅):

```bash
gzip -t arquivo.sql.gz          # integridade
zcat arquivo.sql.gz | wc -c     # tem que ser bem maior que 0
zcat arquivo.sql.gz | grep "CREATE TABLE" | wc -l   # deve bater com o numero de tabelas do schema
```

## Segredos que o repositório do cliente precisa ter

| Secret | De onde vem |
|---|---|
| `DATABASE_URL` | Supabase → Database → Session pooler |
| `GDRIVE_CLIENT_ID` | Google Cloud → Credenciais → cliente OAuth (não sensível) |
| `GDRIVE_CLIENT_SECRET` | Google Cloud → Credenciais → cliente OAuth |
| `GDRIVE_TOKEN` | `rclone authorize` rodado localmente |

Também existe o workflow separado `.github/workflows/keep-supabase-awake.yml`
(mantém o projeto Supabase acordado no plano free, que pausa sozinho
depois de 7 dias sem uso) — esse só precisa da chave *publishable* do
projeto, já embutida no arquivo, sem secret adicional.
