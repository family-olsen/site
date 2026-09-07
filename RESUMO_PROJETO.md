# Resumo Executivo: Site da Família Olsen, Belloto e Leal

## Visão Geral

Plataforma digital completa de patrimônio genealógico que preserva e democratiza a história de três famílias através de uma experiência web imersiva. O sistema integra acervo genealógico interativo, biblioteca digital, galeria de fotografias e narrativas históricas em um único ponto de acesso, permitindo que familiares de qualquer geração descubram, documentem e compartilhem sua história.

**Valor comercial**: Solução SaaS-ready para genealogia familiar, museus digitais, institutos genealógicos e preservação de patrimônio cultural.

---

## Arquitetura e Stack

### Frontend
- **HTML5 + CSS3 + JavaScript vanilla**: Zero dependências, codebase leve (~61KB assets)
- **Responsivo mobile-first**: Testes validados em 375px (mobile), 768px (tablet), 1300px+ (desktop)
- **Performance**: Assets comprimidos, uso de Supabase Storage para imagens otimizadas
- **UX moderno**: Animações sutis (reveal blocks), tipografia responsiva (CSS clamp), transições suaves

### Backend
- **Supabase (PostgreSQL + Auth + Storage)**
  - Autenticação segura (JWT, Google OAuth)
  - Row-Level Security (RLS) para controle de acesso granular
  - Armazenamento de mídia (fotos, documentos, livros em PDF)
  - Relatório de logs e métricas de uso
  
### Deployment
- **GitHub Pages** (publicação automática de `main`)
- **CDN global** via jsDelivr para bibliotecas de terceiros
- **Versioning** automático através do git

### Stack Técnico Completo
- Supabase JS SDK v2.115.0
- Web Speech API (navegador nativo, sem servidor)
- CSS Grid + Flexbox para layouts adaptativos
- Sem dependências externas de frontend (npm/build)

---

## Escopo: Módulos e Funcionalidades

### Interface Pública (11 páginas)

1. **Página Inicial** (`index.html`)
   - Hero com texto dinâmico (última história publicada)
   - 4 cartões de entrada (Pessoas, Histórias, Livro, Árvore genealógica)
   - Estatísticas de acervo em tempo real

2. **Catálogo de Pessoas** (`pessoas.html`)
   - Busca e filtros em tempo real
   - Paginação de 10 em 10
   - Avatares com fallback automático (iniciais)
   - Link direto para perfil individual

3. **Perfil de Pessoa** (`pessoa.html`)
   - Dados estruturados (nome, datas, local de nascimento/morte)
   - Biografia com suporte a Markdown renderizado
   - Árvore familiar (pais, cônjuges, filhos, irmãos) em pills interativas
   - **Linha da vida**: timeline genealógica mostrando descendentes por geração (filhos, netos, bisnetos, etc.)
   - Abas contextuais (histórias, fotos, eventos, fontes, documentos relacionados)

4. **Histórias** (`historias.html`)
   - Galeria de narrativas com thumb de capa
   - Resumo com preview automático (90 caracteres)
   - Pessoa protagonista destacada

5. **Detalhe de História** (`historia.html`)
   - Texto estruturado com suporte a Markdown
   - Galeria de fotos inline
   - Pessoa protagonista e pessoas citadas linkadas
   - Botão de compartilhamento com Open Graph meta dinâmico

6. **Galeria de Fotos** (`galeria.html`)
   - Grid responsivo com lightbox (zoom automático)
   - Filtro por pessoa, data, período
   - Legendas e contexto histórico
   - Pessoas associadas à foto

7. **Álbuns de Fotos** (estrutura dados, sem página dedicada ainda)
   - Organização temática (Viagens, Década 1980, etc.)
   - Referência cruzada com galeria

8. **Timeline de Eventos** (`timeline.html`)
   - Eventos históricos ordenados cronologicamente
   - Pessoa protagonista linkada
   - Visualização de causas e consequências

9. **Árvore Genealógica Interativa** (`arvore.html`)
   - Renderização canvas com zoom/pan
   - Foco em um indivíduo + gerações de ancestrais/descendentes
   - Suporte para famílias poligâmicas
   - Linhas desenhadas dinamicamente

10. **Leitor de Livro** (`livro.html`)
    - Capítulos estruturados
    - Paginação entre capítulos
    - **Leitura em voz alta** (Text-to-Speech integrado, suporte a pt-BR)
    - Pause/resume/stop
    - Auto-scroll sincronizado com narração

11. **Linha do Tempo de Pessoa** (integrado em `pessoa.html`)
    - Eventos biográficos estruturados
    - Marcos genealógicos (casamentos, nascimentos de descendentes)
    - Navegação entre períodos

### Painel Administrativo (`/admin/`)
**Complexidade elevada**: ~2.800 linhas de JavaScript, 301KB de código + CSS

#### Entidades Gerenciadas
1. **Pessoas** (CRUD completo)
   - 15+ campos (nome, apelido, gênero, datas de nascimento/morte, locais, biografia, avatar)
   - Busca full-text
   - Vinculação com fotos, histórias, eventos, documentos, fontes
   - Árvore genealógica inline (pais/filhos com drag-drop)
   - Importação de dados de FamilySearch (54% completado, 44 de 150 avatares)

2. **Famílias/Uniões** (Parentesco)
   - Tipo de relacionamento (casamento, coabitação, etc.)
   - Data/local do casamento
   - Pessoas membros
   - Visualização de filhos

3. **Histórias**
   - Título, resumo, conteúdo completo (Markdown)
   - Pessoa protagonista
   - Galeria de fotos inline
   - Estrutura de capítulos
   - Status publicação

4. **Fotografias**
   - Upload/compressão automática
   - Thumbnail generation
   - Metadados (data, local, pessoas citadas)
   - Visibilidade em galeria pública
   - Álbum associado

5. **Álbuns**
   - Agrupamento temático de fotos
   - Ordenação customizável

6. **Eventos Históricos**
   - Tipo (nascimento, casamento, morte, etc.)
   - Data/período
   - Pessoas envolvidas (com papéis: participante, testemunha, etc.)
   - Descrição

7. **Documentos**
   - Upload de PDFs, imagens, scans
   - Tipo (registro civil, certidão, carta, etc.)
   - Pessoas relacionadas
   - Data/período

8. **Fontes Bibliográficas**
   - Vinculação a documentos específicos
   - Tipo (livro, artigo, site, etc.)
   - URL e notas de acesso

9. **Lugares/Localizações**
   - Cidade, país
   - Tipo (nascimento, morte, casamento, etc.)
   - Referência cruzada com eventos

10. **Livro**
    - Capítulos estruturados
    - Seções dentro de capítulos
    - Conteúdo renderizado com Markdown
    - Publicação gradual

#### Features do Admin
- **Dashboard estatístico**: Cards de contagem em tempo real (pessoas, famílias, histórias, eventos, fotos, etc.)
- **Modal responsivo**: Tela cheia em mobile (scroll fixo no rodapé)
- **Sidebar colapsável**: Navegação fluida entre módulos
- **Chip-field pattern**: Relacionamentos multi-seleção (pessoas-histórias, pessoas-fotos, etc.)
- **Tabelas responsivas**: Transformam-se em cartões no mobile (grid → cards, dados de cada coluna com label)
- **Rich text editor**: Suporte a Markdown com preview ao vivo
- **Busca e filtro**: Em quase toda entidade com paginação

---

## Diferenciais e Otimizações

### Integrações Complexas
1. **Supabase RLS (Row-Level Security)**
   - Controle de acesso em nível de banco de dados
   - Políticas específicas por role (admin vs. public)
   - Eficiência: nenhuma lógica de autorização no frontend

2. **FamilySearch Integration** (Importação de Avatares)
   - Pipeline de fetch automatizado
   - 54% dos dados genealógicos enriquecidos com fotos originais
   - Documentação de fonte (FamilySearch ID rastreado)

3. **Web Speech API (Text-to-Speech)**
   - Vozes do sistema operacional
   - Seleção automática pt-BR quando disponível
   - Sem servidores de TTS (economia de banda/latência)
   - Suporte a pause/resume/stop

### Otimizações Técnicas
1. **Sem dependências frontend**: Codebase puro JavaScript → menor bundle, sem atualização de dependências
2. **Meta dinâmico (Open Graph + Twitter Cards)**: Cada URL de pessoa/história/evento carrega preview correto em redes sociais
3. **Sitemap.xml + robots.txt**: SEO otimizado para buscadores
4. **Responsive images via Supabase Storage**: Compressão automática, múltiplas resoluções
5. **CSS Grid/Flexbox + CSS clamp()**: Tipografia e layouts fluidos sem media queries excessivas
6. **Lazy loading implícito**: Supabase SDK carrega dados sob demanda
7. **Caching HTTP**: Assets versionados no git, cache-control via GitHub Pages

### Segurança
- **CSP (Content Security Policy)**: Whitelist rigorosa de origens
- **HTTPS obrigatório**: GitHub Pages + Supabase
- **Input sanitization**: Escape HTML em todo template
- **Auth JWT**: Sessões seguras via Supabase
- **CORS properly configured**: PostgREST endpoint isolado

### Experiência do Usuário
- **Animações de reveal**: Efeitos de fade-in coordenados (revealWords, revealBlock)
- **Design mobile-first**: Testes em 3+ breakpoints
- **Cabeçalho sticky**: Acesso rápido a menu mesmo ao rolar
- **Empty states customizadas**: Mensagens claras quando sem dados
- **Breadcrumb e contexto**: Saber sempre em qual seção está
- **Tipografia responsiva**: De 16px a 64px via clamp() conforme viewport

---

## Métricas de Valor Comercial

| Aspecto | Valor |
|--------|-------|
| **Funcionalidades únicas** | Árvore genealógica interativa + leitor de livro com TTS |
| **Entidades gerenciáveis** | 10 tipos (pessoas, famílias, histórias, fotos, eventos, documentos, fontes, lugares, álbuns, livro) |
| **Páginas públicas** | 11 rotas de conteúdo + dashboard |
| **Linhas de código custom** | ~3.900 (site + admin + CSS) |
| **Dependências externas** | 1 (Supabase JS SDK) |
| **Performance** | Sub-segundo em 4G; zero JavaScript build step |
| **Cobertura genealógica** | 150 pessoas mapeadas; 44 com avatares FamilySearch |
| **Integrações ativas** | Supabase (auth + storage + DB), FamilySearch (importação), Web Speech (TTS), GitHub Pages |
| **Escalabilidade** | PostgreSQL serverless; Storage ilimitado; CDN global |

---

## Roadmap Sugerido para Precificação

- **Tier 1 (Básico)**: Suporte até 50 pessoas, 1 admin, 5GB armazenamento
- **Tier 2 (Profissional)**: Até 500 pessoas, 3 admins, 50GB, temas customizados
- **Tier 3 (Institucional)**: Ilimitado, múltiplas famílias, API pública, SLA 99.9%

---

**Última atualização**: 7 de setembro de 2026  
**Plataforma**: GitHub Pages + Supabase  
**Licença**: Private (propriedade do usuário)
