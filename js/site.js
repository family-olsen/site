const { createClient } = supabase;
const sbClient = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function $(sel){return document.querySelector(sel)}
function photoUrl(path){return path?sbClient.storage.from('photos').getPublicUrl(path).data.publicUrl:''}
function avatarUrl(path){return photoUrl(path)}
function documentUrl(path){return path?sbClient.storage.from('documents').getPublicUrl(path).data.publicUrl:''}
function yearsLabel(p){
  const b=p.birth_date?p.birth_date.slice(0,4):null, d=p.death_date?p.death_date.slice(0,4):null;
  if(!b&&!d) return '';
  if(d) return `${b||'?'} — ${d}`;
  if(p.is_living===false) return `${b||'?'} —`;
  return `${b} — hoje`;
}
function initials(name){return (name||'?').trim().charAt(0).toUpperCase()}
// Atualiza título + meta description + Open Graph/Twitter depois que os dados de
// uma pessoa/história específica carregam — sem isso, todo link de pessoa.html ou
// historia.html compartilhado (WhatsApp etc.) mostra o mesmo título genérico da
// página, em vez do nome da pessoa/história de fato.
function setPageMeta({title,description,url}){
  document.title=title;
  const set=(sel,attr,val)=>{ if(!val) return; const el=document.querySelector(sel); if(el) el.setAttribute(attr,val); };
  set('meta[name="description"]','content',description);
  set('meta[property="og:title"]','content',title);
  set('meta[property="og:description"]','content',description);
  set('meta[name="twitter:title"]','content',title);
  set('meta[name="twitter:description"]','content',description);
  if(url){ set('meta[property="og:url"]','content',url); set('link[rel="canonical"]','href',url); }
}
function truncate(text,max){
  const t=(text||'').trim();
  if(t.length<=max) return t;
  return t.slice(0,max-1).replace(/\s+\S*$/,'')+'…';
}

/* ---------- Parentesco (leitura pública) ---------- */
const PERSON_FIELDS='id,full_name,nickname,birth_date,birth_date_precision,birth_place_id,death_date,death_date_precision,death_place_id,avatar_path,biography,gender,is_living';
async function fetchParents(personId){
  const {data}=await sbClient.from('parent_child_relationships').select(`parent_id,people!parent_child_relationships_parent_id_fkey(${PERSON_FIELDS})`).eq('child_id',personId);
  return (data||[]).map(r=>r.people).filter(Boolean);
}
async function fetchChildren(personId){
  const {data}=await sbClient.from('parent_child_relationships').select(`child_id,people!parent_child_relationships_child_id_fkey(${PERSON_FIELDS})`).eq('parent_id',personId);
  return (data||[]).map(r=>r.people).filter(Boolean);
}
async function fetchSiblings(parentIds,excludeId){
  const ids=[...new Set(parentIds.filter(Boolean))];
  if(!ids.length) return [];
  const {data}=await sbClient.from('parent_child_relationships').select(`child_id,people!parent_child_relationships_child_id_fkey(${PERSON_FIELDS})`).in('parent_id',ids);
  const map=new Map();
  (data||[]).forEach(r=>{ if(r.people&&r.people.id!==excludeId) map.set(r.people.id,r.people); });
  return [...map.values()];
}
async function fetchSpouses(personId){
  const {data:units}=await sbClient.from('family_unit_members').select('family_unit_id').eq('person_id',personId);
  const unitIds=(units||[]).map(u=>u.family_unit_id);
  if(!unitIds.length) return [];
  const {data}=await sbClient.from('family_unit_members').select(`person_id,people(${PERSON_FIELDS})`).in('family_unit_id',unitIds).neq('person_id',personId);
  const map=new Map();
  (data||[]).forEach(r=>{ if(r.people) map.set(r.people.id,r.people); });
  return [...map.values()];
}
// Como fetchSpouses, mas traz também a união em si (data/local do casamento) —
// usado só pela biografia automática, que precisa dessa informação extra sem
// arriscar mudar o formato de retorno que a árvore e o admin já esperam.
async function fetchMarriages(personId){
  const {data:units}=await sbClient.from('family_unit_members').select('family_unit_id').eq('person_id',personId);
  const unitIds=(units||[]).map(u=>u.family_unit_id);
  if(!unitIds.length) return [];
  const [{data:fus},{data:members}]=await Promise.all([
    sbClient.from('family_units').select('id,start_date,start_date_precision,place_id').in('id',unitIds),
    sbClient.from('family_unit_members').select(`family_unit_id,person_id,people(${PERSON_FIELDS})`).in('family_unit_id',unitIds).neq('person_id',personId)
  ]);
  const fuMap=new Map((fus||[]).map(f=>[f.id,f]));
  return (members||[]).filter(m=>m.people).map(m=>({spouse:m.people,...fuMap.get(m.family_unit_id)}));
}
// Desce a árvore a partir de uma pessoa, geração por geração (1=filhos,
// 2=netos, 3=bisnetos...), até maxGeracoes ou até não achar mais ninguém.
// Usado pela "linha da vida" do perfil pra saber quando cada descendente
// nasceu, sem ter que buscar um por um.
async function fetchDescendantsByGeneration(rootId,maxGeracoes){
  const out=[]; let currentIds=[rootId]; let gen=0;
  while(currentIds.length&&gen<maxGeracoes){
    gen++;
    const {data}=await sbClient.from('parent_child_relationships').select(`child_id,people!parent_child_relationships_child_id_fkey(${PERSON_FIELDS})`).in('parent_id',currentIds);
    const map=new Map();
    (data||[]).forEach(r=>{ if(r.people) map.set(r.people.id,r.people); });
    const kids=[...map.values()];
    if(!kids.length) break;
    kids.forEach(p=>out.push({person:p,generation:gen}));
    currentIds=kids.map(p=>p.id);
  }
  return out;
}
const GERACAO_PALAVRA={1:['filho','filha'],2:['neto','neta'],3:['bisneto','bisneta'],4:['tataraneto','tataraneta']};
function palavraGeracao(gen,pessoa){
  const par=GERACAO_PALAVRA[gen];
  if(!par) return `descendente (${gen}ª geração)`;
  return pessoa.gender==='female'?par[1]:par[0];
}
const EVENT_TYPE_LABEL={birth:'nascimento',marriage:'casamento',death:'falecimento',baptism:'batismo',immigration:'imigração',other:'evento'};
// Monta os marcos da "linha da vida" de uma pessoa — nascimento, casamento(s),
// eventos próprios datados, nascimento de filhos/netos/bisnetos... e
// falecimento, em ordem cronológica. Regra de corte: se sabemos a data da
// morte (ou ela ainda está viva), vai por DATA, sem limite de geração — só
// entra quem nasceu dentro do intervalo de vida dela. Se ela já morreu mas
// SEM data de morte registrada, não dá pra cortar por data, então usamos
// geração como critério de segurança: só filhos e netos.
async function buildLifeTimeline(person,marriages,ownEvents){
  const itens=[];
  if(person.birth_date) itens.push({data:person.birth_date,titulo:'Nasceu',tipo:'nascimento'});
  if(person.death_date) itens.push({data:person.death_date,titulo:'Faleceu',tipo:'falecimento'});
  (marriages||[]).forEach(m=>{
    if(m.start_date) itens.push({data:m.start_date,titulo:`Casou com ${(m.spouse.full_name||'').split(' ')[0]}`,tipo:'casamento',href:`pessoa.html?id=${m.spouse.id}`});
  });
  (ownEvents||[]).forEach(e=>{
    const d=e.event_date||e.start_date;
    if(d) itens.push({data:d,titulo:e.title,tipo:EVENT_TYPE_LABEL[e.event_type]||'evento'});
  });
  const dataCorte=person.death_date||null;
  const cortarPorGeracao=!person.death_date&&person.is_living===false;
  const maxGeracoes=cortarPorGeracao?2:8; // 8 é só um teto de segurança pro caso sem corte por data
  const descendentes=await fetchDescendantsByGeneration(person.id,maxGeracoes);
  descendentes.forEach(({person:p,generation:g})=>{
    if(!p.birth_date) return;
    if(dataCorte&&p.birth_date>dataCorte) return; // nasceu depois que ela morreu, não entra
    itens.push({data:p.birth_date,titulo:`Nasceu ${(p.full_name||'').split(' ')[0]}`,tipo:palavraGeracao(g,p),href:`pessoa.html?id=${p.id}`});
  });
  itens.sort((a,b)=>String(a.data).localeCompare(String(b.data)));
  return itens;
}
// checagem em lote (uma só vez por renderização, não uma consulta por cartão): pra decidir se vale
// a pena mostrar a setinha de expandir/lateral, ou se já dá pra saber de antemão que não tem nada
// pra mostrar (sem pai/mãe, sem filho, sem cônjuge registrado) e nem faz sentido exibir o botão.
async function fetchHasRelations(personIds){
  const ids=[...new Set(personIds)];
  if(!ids.length) return {parents:new Set(),children:new Set(),spouses:new Set()};
  const [{data:asChild},{data:asParent},{data:units}]=await Promise.all([
    sbClient.from('parent_child_relationships').select('child_id').in('child_id',ids),
    sbClient.from('parent_child_relationships').select('parent_id').in('parent_id',ids),
    sbClient.from('family_unit_members').select('person_id').in('person_id',ids)
  ]);
  return {
    parents:new Set((asChild||[]).map(r=>r.child_id)),
    children:new Set((asParent||[]).map(r=>r.parent_id)),
    spouses:new Set((units||[]).map(r=>r.person_id))
  };
}

/* ---------- Header / footer / navegação ---------- */
const NAV_ITEMS=[
  {href:'index.html',label:'Início'},
  {href:'historias.html',label:'Histórias'},
  {href:'livro.html',label:'Livro'},
  {href:'pessoas.html',label:'Pessoas'},
  {href:'arvore.html',label:'Árvore'},
  {href:'galeria.html',label:'Fotos'},
  {href:'timeline.html',label:'Linha do tempo'}
];
function currentPage(){return location.pathname.split('/').pop()||'index.html'}
function renderHeader(){
  const cur=currentPage();
  const nav=NAV_ITEMS.map(n=>`<a href="${n.href}" class="${n.href===cur?'active':''}">${escapeHtml(n.label)}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin',`
    <header class="site-header">
      <a href="index.html" class="site-brand"><img class="site-brand-icon" src="Assents/Logos-web/icon-96.webp" srcset="Assents/Logos-web/icon-96.webp 96w, Assents/Logos-web/icon-192.webp 192w" sizes="40px" width="40" height="40" alt="" loading="eager"><span class="site-brand-text"><strong>Olsen · Belloto · Leal</strong><span>acervo da família</span></span></a>
      <button type="button" class="menu-toggle" id="menuToggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="siteNav"><span></span><span></span><span></span></button>
      <nav class="site-nav" id="siteNav">${nav}<button type="button" class="search-btn" id="openSearchBtn"><span class="search-dot"></span><span>Buscar</span></button></nav>
    </header>`);
  $('#openSearchBtn').addEventListener('click',()=>{closeMobileMenu(); openSearch();});
  // menu hambúrguer — só aparece no mobile (CSS), aqui só liga o clique.
  const toggle=$('#menuToggle'), navEl=$('#siteNav');
  function closeMobileMenu(){ navEl.classList.remove('open'); toggle.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); }
  toggle.addEventListener('click',()=>{
    const open=navEl.classList.toggle('open');
    toggle.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
  });
  navEl.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMobileMenu));
  window.addEventListener('resize',()=>{ if(window.innerWidth>760) closeMobileMenu(); });
  // altura real do cabeçalho (ele é sticky top:0) numa variável CSS — usado por
  // quem precisar grudar algo logo abaixo dele (ex: hero da home, aside sticky
  // do livro). Sincroniza nessa hora e de novo se a janela mudar de tamanho
  // (o cabeçalho pode quebrar linha e mudar de altura no mobile).
  const headerEl=$('.site-header');
  function syncHeaderH(){ document.documentElement.style.setProperty('--hdr-h',(headerEl?.offsetHeight||0)+'px'); }
  syncHeaderH();
  window.addEventListener('resize',syncHeaderH);
  // marca do cabeçalho entra deslizando da esquerda (mesma linguagem de blur/subida
  // dos títulos, só que na horizontal) — roda em toda página, é aqui que o cabeçalho
  // é montado.
  if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    revealWords($('.site-brand strong'),{baseDelay:0,stagger:20,dir:'left'});
    revealBlock($('.site-brand-text > span'),260,{dir:'left'});
  }
}
function renderFooter(){
  document.body.insertAdjacentHTML('beforeend',`
    <footer class="site-footer">
      <span class="brand">Olsen · Belloto · Leal</span>
      <span class="note">Acervo privado da família, compartilhado publicamente com carinho. O conteúdo é mantido pelo painel administrativo da família.</span>
      <button type="button" id="footerSearchBtn">Buscar no acervo</button>
    </footer>`);
  $('#footerSearchBtn').addEventListener('click',openSearch);
}
document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){ closeSearch(); closeLightbox(); }
  if((e.key==='k'||e.key==='K')&&(e.metaKey||e.ctrlKey)){ e.preventDefault(); openSearch(); }
});

/* ---------- Lightbox ---------- */
function openLightbox(src,alt,meta,desc,pessoas){
  closeLightbox();
  const div=document.createElement('div');
  div.className='lightbox'; div.id='activeLightbox';
  const pessoasHtml=(pessoas&&pessoas.length)?`<span class="lightbox-pessoas">${pessoas.map(p=>`
    <a class="pill-person" href="pessoa.html?id=${p.id}">
      <span class="pill-avatar" style="${p.avatar_path?`background-image:url('${photoUrl(p.avatar_path)}')`:''}">${p.avatar_path?'':escapeHtml(initials(p.full_name))}</span>
      <span>${escapeHtml(p.full_name)}</span>
    </a>`).join('')}</span>`:'';
  div.innerHTML=`<button type="button" class="lightbox-close" aria-label="Fechar">×</button><img src="${escapeHtml(src)}" alt="${escapeHtml(alt||'')}"><div class="lightbox-caption"><span class="alt">${escapeHtml(alt||'')}</span><span class="meta">${escapeHtml(meta||'')}</span>${desc?`<span class="desc">${escapeHtml(desc)}</span>`:''}${pessoasHtml}</div>`;
  // só fecha clicando no fundo (fora da foto/legenda) ou no ×  — clicar na foto em si não fecha.
  div.addEventListener('click',(e)=>{ if(e.target===div) closeLightbox(); });
  div.querySelector('.lightbox-close').addEventListener('click',closeLightbox);
  document.body.appendChild(div);
}
function closeLightbox(){ $('#activeLightbox')?.remove(); }

/* ---------- Busca global ---------- */
let searchCache=null;
async function loadSearchIndex(){
  if(searchCache) return searchCache;
  const [people,stories,photos,events]=await Promise.all([
    sbClient.from('people').select('id,full_name,birth_date,death_date').limit(500),
    sbClient.from('stories').select('id,slug,title,summary').limit(500),
    sbClient.from('photos').select('id,title,caption,photo_date').limit(500),
    sbClient.from('events').select('id,title,event_date,event_type').limit(500)
  ]);
  const items=[];
  (people.data||[]).forEach(p=>items.push({tipo:'pessoa',titulo:p.full_name,sub:yearsLabel(p),go:`pessoa.html?id=${p.id}`}));
  (stories.data||[]).forEach(s=>items.push({tipo:'história',titulo:s.title,sub:s.summary||'',go:`historia.html?slug=${s.slug||s.id}`}));
  (photos.data||[]).forEach(p=>items.push({tipo:'foto',titulo:p.title,sub:p.caption||dateCell(p.photo_date),go:`galeria.html?foto=${p.id}`}));
  (events.data||[]).forEach(e=>items.push({tipo:'evento',titulo:e.title,sub:dateCell(e.event_date),go:`timeline.html?evento=${e.id}`}));
  searchCache=items;
  return items;
}
function dateCell(d){return d?String(d).slice(0,10):''}
function fullDateLabel(d){
  if(!d) return '';
  const [y,m,day]=String(d).slice(0,10).split('-').map(Number);
  if(!y||!m||!day) return '';
  return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
}
// "Nasceu em 12 de setembro de 1937, em Itápolis" — junta data e lugar quando os
// dois existem; usa só o que tiver quando falta um dos dois.
function eventLine(verbo,data,lugar){
  const d=fullDateLabel(data);
  if(d&&lugar) return `${verbo} em ${d}, em ${lugar}`;
  if(d) return `${verbo} em ${d}`;
  if(lugar) return `${verbo} em ${lugar}`;
  return '';
}

/* ---------- Biografia automática ----------
   Monta um parágrafo a partir só do que já está cadastrado (nascimento, pais e
   suas idades, casamento, filhos, falecimento) — sem inventar nada. É pensado
   pra ficar sempre em cima, com a biografia manual (histórias, detalhes que não
   cabem em campo nenhum) complementando embaixo. */
// "em 11 de maio de 1899" (data exata) ou "por volta de 1899" (só o ano, ou data aproximada).
function dataComPrecisao(data,precisao){
  if(!data) return '';
  if(!precisao||precisao==='exact') return `em ${fullDateLabel(data)}`;
  const ano=String(data).slice(0,4);
  if(precisao==='before') return `antes de ${ano}`;
  if(precisao==='after') return `depois de ${ano}`;
  return `por volta de ${ano}`;
}
// Diferença em anos entre duas datas, usando só o ano (suficiente pro texto) —
// devolve null se alguma data faltar ou o resultado não fizer sentido.
function diferencaEmAnos(dataMaisNova,dataMaisVelha){
  if(!dataMaisNova||!dataMaisVelha) return null;
  const anos=Number(String(dataMaisNova).slice(0,4))-Number(String(dataMaisVelha).slice(0,4));
  return (anos>=0&&anos<120)?anos:null;
}
function gerarBiografiaAutomatica({pessoa,pais,casamentos,filhos,placeName}){
  const nome=pessoa.full_name;
  const feminino=pessoa.gender==='female';
  const pronome=feminino?'Ela':'Ele';
  const localNasc=placeName(pessoa.birth_place_id);
  const localMorte=placeName(pessoa.death_place_id);
  const apelido=pessoa.nickname?`, também conhecid${feminino?'a':'o'} como ${pessoa.nickname}`:'';
  const paisComIdade=pais.filter(p=>p.birth_date);
  const frases=[];
  let contouNascimento=false;

  if(pessoa.birth_date&&paisComIdade.length){
    const partes=paisComIdade.map(p=>{
      const idade=diferencaEmAnos(pessoa.birth_date,p.birth_date);
      if(idade==null) return null;
      const aprox=p.birth_date_precision&&p.birth_date_precision!=='exact';
      const papel=p.gender==='female'?'sua mãe':'seu pai';
      return `${papel}, ${p.full_name}, tinha ${aprox?'cerca de ':''}${idade} anos`;
    }).filter(Boolean);
    let f=`Quando ${nome} nasceu ${dataComPrecisao(pessoa.birth_date,pessoa.birth_date_precision)}`;
    if(localNasc) f+=`, em ${localNasc}`;
    if(partes.length) f+=`, ${partes.join(' e ')}`;
    frases.push(f+apelido+'.');
    contouNascimento=true;
  } else if(pessoa.birth_date&&pais.length){
    let f=`${feminino?'Filha':'Filho'} de ${pais.map(p=>p.full_name).join(' e ')}, nasceu ${dataComPrecisao(pessoa.birth_date,pessoa.birth_date_precision)}`;
    if(localNasc) f+=`, em ${localNasc}`;
    frases.push(f+apelido+'.');
    contouNascimento=true;
  } else if(pessoa.birth_date){
    let f=`${nome} nasceu ${dataComPrecisao(pessoa.birth_date,pessoa.birth_date_precision)}`;
    if(localNasc) f+=`, em ${localNasc}`;
    frases.push(f+apelido+'.');
    contouNascimento=true;
  } else if(pais.length){
    frases.push(`${feminino?'Filha':'Filho'} de ${pais.map(p=>p.full_name).join(' e ')}${apelido}.`);
    contouNascimento=true;
  } else if(apelido){
    frases.push(`${nome} também é conhecid${feminino?'a':'o'} como ${pessoa.nickname}.`);
  }

  casamentos.forEach(c=>{
    let f=`${pronome} casou-se com ${c.spouse.full_name}`;
    const data=dataComPrecisao(c.start_date,c.start_date_precision);
    const local=placeName(c.place_id);
    if(data) f+=` ${data}`;
    if(local) f+=`, em ${local}`;
    frases.push(f+'.');
  });

  if(filhos.length){
    if(filhos.length<=2){
      const nomes=filhos.map(f=>f.full_name.split(' ')[0]).join(' e ');
      const rotulo=filhos.length===1?(filhos[0].gender==='female'?'1 filha':'1 filho'):`${filhos.length} filhos`;
      frases.push(`${casamentos.length?'Eles t':'T'}iveram pelo menos ${rotulo}, ${nomes}.`);
    } else {
      const m=filhos.filter(f=>f.gender==='male').length;
      const f=filhos.filter(f=>f.gender==='female').length;
      const outros=filhos.length-m-f;
      const partes=[];
      if(m) partes.push(`${m} filho${m>1?'s':''}`);
      if(f) partes.push(`${f} filha${f>1?'s':''}`);
      if(outros) partes.push(`${outros} filho${outros>1?'s':''} de gênero não informado`);
      // "3 filhos, 5 filhas e 1 filho..." — vírgula entre os itens do meio, "e" só
      // antes do último (evita "3 filhos e 5 filhas e 1..." quando há 3 partes).
      const lista=partes.length>1?partes.slice(0,-1).join(', ')+' e '+partes[partes.length-1]:partes[0];
      frases.push(`${casamentos.length?'Eles t':'T'}iveram pelo menos ${lista}.`);
    }
  }
  // Se não veio nenhum filho aqui, pode ser que realmente não tiveram — ou pode
  // ser que os filhos existem mas estão marcados como privados (não aparecem
  // pra o público). Como não dá pra saber a diferença com os dados públicos,
  // é mais seguro simplesmente não afirmar nada sobre filhos nesse caso.

  if(pessoa.death_date){
    const idade=diferencaEmAnos(pessoa.death_date,pessoa.birth_date);
    let f=`${pronome} faleceu ${dataComPrecisao(pessoa.death_date,pessoa.death_date_precision)}`;
    if(localMorte) f+=`, em ${localMorte}`;
    if(idade!=null){
      if(idade<12) f+=', ainda criança';
      else if(idade<25) f+=', ainda jovem';
      else f+=`, aos ${idade} anos`;
    }
    frases.push(f+'.');
  } else if(pessoa.is_living===false){
    frases.push('Já faleceu.');
  } else if(pessoa.is_living){
    frases.push(`Está ${feminino?'viva':'vivo'}.`);
  }

  return frases.join(' ');
}
async function openSearch(){
  closeSearch();
  const overlay=document.createElement('div');
  overlay.className='search-overlay'; overlay.id='activeSearch';
  overlay.innerHTML=`<div class="search-box">
    <div class="search-input-row"><input id="searchInput" placeholder="Busque uma pessoa, história, foto, ano…" autocomplete="off"><button type="button" class="search-esc" id="searchCloseBtn">Esc</button></div>
    <p class="search-summary" id="searchSummary">Carregando…</p>
    <div id="searchResults"></div>
  </div>`;
  overlay.addEventListener('click',(e)=>{ if(e.target===overlay) closeSearch(); });
  document.body.appendChild(overlay);
  $('#searchCloseBtn').addEventListener('click',closeSearch);
  const input=$('#searchInput');
  const items=await loadSearchIndex();
  const render=(q)=>{
    const t=q.trim().toLowerCase();
    const hits=t?items.filter(i=>(i.titulo+' '+i.sub).toLowerCase().includes(t)):items;
    $('#searchSummary').textContent=`${hits.length} resultados em pessoas, histórias, fotos e eventos`;
    const order=['pessoa','história','foto','evento'];
    const labels={pessoa:'Pessoas',história:'Histórias',foto:'Fotos',evento:'Eventos'};
    $('#searchResults').innerHTML=order.map(k=>{
      const group=hits.filter(h=>h.tipo===k);
      if(!group.length) return '';
      return `<section class="search-group"><h3>${labels[k]}</h3>${group.slice(0,8).map(h=>`<a class="search-result" href="${h.go}"><span><span class="search-result-title">${escapeHtml(h.titulo||'—')}</span><span class="search-result-sub">${escapeHtml(h.sub||'')}</span></span><span class="search-result-type">${k} ↗</span></a>`).join('')}</section>`;
    }).join('')||'<p class="empty-note">Nada encontrado.</p>';
  };
  render('');
  input.addEventListener('input',()=>render(input.value));
  setTimeout(()=>input.focus(),60);
}
function closeSearch(){ $('#activeSearch')?.remove(); }

/* ---------- Linhagens (calculado a partir da árvore, sem campo manual) ---------- */
const SURNAME_CONNECTORS=new Set(['de','da','do','dos','das','e']);
function surnameTokens(p){
  let raw=p.surname;
  if(!raw){
    const parts=(p.full_name||'').trim().split(/\s+/);
    raw=parts.slice(1).join(' ');
  }
  return [...new Set((raw||'').split(/\s+/).map(s=>s.trim()).filter(s=>s&&!SURNAME_CONNECTORS.has(s.toLowerCase())))];
}
async function computeLinhagens(){
  const {data:people}=await sbClient.from('people').select('id,full_name,surname,birth_date,death_date');
  if(!people||!people.length) return [];
  const groups=new Map();
  people.forEach(p=>{
    surnameTokens(p).forEach(tok=>{
      if(!groups.has(tok)) groups.set(tok,{nome:tok,pessoas:[],anos:[]});
      const g=groups.get(tok);
      g.pessoas.push(p);
      if(p.birth_date) g.anos.push(Number(p.birth_date.slice(0,4)));
      if(p.death_date) g.anos.push(Number(p.death_date.slice(0,4)));
    });
  });
  return [...groups.values()].sort((a,b)=>b.pessoas.length-a.pessoas.length).map(g=>{
    const anos=g.anos.sort((a,b)=>a-b);
    const periodo=anos.length?`${anos[0]} — ${anos[anos.length-1]>=new Date().getFullYear()-1?'hoje':anos[anos.length-1]}`:'—';
    return {nome:g.nome,periodo,contagem:`${g.pessoas.length} ${g.pessoas.length===1?'pessoa':'pessoas'}`,pessoas:g.pessoas};
  });
}

/* ---------- Árvore recursiva (estilo FamilySearch), somente leitura ---------- */
let expandedUp=new Set(), expandedDown=new Set(), expandedSide=new Set();
// preenchidos uma vez por renderização (fetchHasRelations) com quem tem pai/mãe, filho ou cônjuge
// de verdade — null enquanto ainda não foi calculado (aí o botão aparece normalmente, sem filtrar).
let hasParentsSet=null, hasChildrenSet=null, hasSpousesSet=null;
function expandBadge(dir,personId,expanded){
  // já sabemos que não tem pai/mãe (ou filho) registrado e não está aberto: não tem o que mostrar,
  // então nem exibe o botão — evita clicar em algo que sempre vai voltar vazio.
  const known=dir==='up'?hasParentsSet:hasChildrenSet;
  if(known&&!expanded&&!known.has(personId)) return '';
  const label=dir==='up'?'pais':'filhos';
  // seta (não "+/−") pra não parecer botão de cadastro/adicionar — é só expandir/recolher a árvore.
  const glyph=dir==='up'?(expanded?'▾':'▴'):(expanded?'▴':'▾');
  return `<button type="button" class="fam-expand-badge ${dir}" data-expand="${dir}" data-person="${personId}" aria-label="${expanded?'Ocultar':'Mostrar'} ${label}" aria-expanded="${expanded}">${glyph}</button>`;
}
// setinha lateral: em qualquer cartão que não seja o foco, revela o(s) cônjuge(s) dessa pessoa do
// lado — mas some se já soubermos que a pessoa não tem cônjuge registrado.
function sideExpandBadge(personId,expanded){
  if(hasSpousesSet&&!expanded&&!hasSpousesSet.has(personId)) return '';
  return `<button type="button" class="fam-side-badge" data-expand-side="${personId}" aria-label="${expanded?'Ocultar':'Mostrar'} cônjuge" aria-expanded="${expanded}">${expanded?'◂':'▸'}</button>`;
}
function famPagerHtml(kind,index,total,innerHtml,anc,extraHtml){
  if(total<=0) return '';
  // "anc" = o conteúdo pode crescer pra cima (ex.: cônjuge expandindo os próprios pais) — nesse caso
  // o cartão da pessoa tem que ficar colado embaixo do bloco pra não subir junto com a fileira ao lado.
  const ancCls=anc?' fam-branch-anc':'';
  const extra=extraHtml||'';
  // só 1 (nenhuma outra pra navegar): mostra a pessoa direto, sem setinhas ‹ › — elas não fariam nada
  // mesmo e ficavam parecendo quebradas, desabilitadas à toa. Somem sozinhas e voltam quando houver 2+.
  if(total<=1) return `<div class="fam-pager-wrap${ancCls}">${extra}${innerHtml}</div>`;
  const prevDisabled=index<=0?'disabled':'';
  const nextDisabled=index>=total-1?'disabled':'';
  return `<div class="fam-pager-wrap${ancCls}">
    ${extra}
    <div class="fam-pager-row">
      <button type="button" class="fam-pager-btn" data-pager="${kind}" data-dir="-1" ${prevDisabled} aria-label="${kind==='sibling'?'Irmão anterior':'Cônjuge anterior'}">‹</button>
      ${innerHtml}
      <button type="button" class="fam-pager-btn" data-pager="${kind}" data-dir="1" ${nextDisabled} aria-label="${kind==='sibling'?'Próximo irmão':'Próximo cônjuge'}">›</button>
    </div>
    <div class="fam-pager-count">${index+1}/${total}</div>
  </div>`;
}
function famAvatarHtml(p){
  if(p.avatar_path) return `<img class="fam-avatar" src="${photoUrl(p.avatar_path)}" alt="">`;
  return `<div class="fam-avatar-fallback">${escapeHtml(initials(p.full_name))}</div>`;
}
function genderClass(p){return p.gender==='male'?'gender-m':p.gender==='female'?'gender-f':''}
function livingBadge(p){
  if(p.is_living===false) return `<span class="fam-status deceased" title="Falecido(a)">✝</span>`;
  if(p.is_living===true) return `<span class="fam-status alive" title="Vivo(a)">●</span>`;
  return '';
}
function famCard(p,focusId,opts={}){
  const isFocus=p.id===focusId;
  const bloodAttr=opts.blood?' data-blood="1"':'';
  const spouseAttr=opts.spouse?' data-spouse="1"':'';
  const genderCls=genderClass(p);
  const inner=`${famAvatarHtml(p)}${livingBadge(p)}<div class="tc-name">${escapeHtml(p.full_name)}</div><div class="tc-years">${yearsLabel(p)}</div>`;
  if(isFocus) return `<div class="fam-card focus ${genderCls}" data-focus="${p.id}" data-blood="1" aria-current="true">${inner}</div>`;
  return `<button type="button" class="fam-card ${genderCls}"${bloodAttr}${spouseAttr} data-focus="${p.id}" aria-label="Ir para ${escapeHtml(p.full_name)}">${inner}</button>`;
}
// varre um ramo já montado (pais/avós OU filhos/netos, com ou sem cônjuge lateral revelado) e
// junta o id de cada pessoa que vai virar cartão — pra checar de uma vez só quem tem mais pai/mãe,
// filho ou cônjuge pra mostrar, antes de desenhar os botõezinhos.
function collectBranchIds(branch,out){
  if(!branch) return;
  out.add(branch.person.id);
  if(branch.parents) branch.parents.forEach(pb=>collectBranchIds(pb,out));
  if(branch.children) branch.children.forEach(cb=>collectBranchIds(cb,out));
  if(branch.spouses) branch.spouses.forEach(s=>out.add(s.id));
}
async function buildAncestorBranch(person){
  const expanded=expandedUp.has(person.id);
  let parents=null;
  if(expanded){
    const ps=await fetchParents(person.id);
    parents=[ps[0]?await buildAncestorBranch(ps[0]):null,ps[1]?await buildAncestorBranch(ps[1]):null];
  }
  return {person,expanded,parents};
}
async function buildDescendantBranch(person){
  const expanded=expandedDown.has(person.id);
  let children=null;
  if(expanded){
    const kids=await fetchChildren(person.id);
    children=await Promise.all(kids.map(k=>buildDescendantBranch(k)));
  }
  const sideExpanded=expandedSide.has(person.id);
  const spouses=sideExpanded?await fetchSpouses(person.id):null;
  return {person,expanded,children,sideExpanded,spouses};
}
function renderAncestorBranchHtml(branch,focusId){
  const {person,expanded,parents}=branch;
  let above='';
  if(expanded){
    const cells=(parents||[null,null]).filter(Boolean).map(pb=>`<div class="fam-branch fam-branch-anc">${renderAncestorBranchHtml(pb,focusId)}</div>`).join('');
    above=cells?`<div class="fam-ancestors">${cells}</div>`:'';
  }
  const node=`<div class="fam-node">${famCard(person,focusId)}${expandBadge('up',person.id,expanded)}</div>`;
  return above+node;
}
function renderDescendantBranchHtml(branch,focusId,opts={}){
  const {person,expanded,children,sideExpanded,spouses}=branch;
  // cônjuge revelado pela setinha lateral fica colado do lado da própria pessoa (não no fim da
  // fileira, junto de outros irmãos) — assim fica óbvio de quem é aquele cônjuge.
  const spouseCards=sideExpanded&&spouses&&spouses.length?spouses.map(s=>`<div class="fam-node fam-node-side">${famCard(s,focusId)}</div>`).join(''):'';
  const node=`<div class="fam-side-row"><div class="fam-node">${famCard(person,focusId,opts)}${expandBadge('down',person.id,expanded)}${sideExpandBadge(person.id,sideExpanded)}</div>${spouseCards}</div>`;
  let below='';
  if(expanded&&children&&children.length){
    below=`<div class="fam-descendants">${children.map(cb=>`<div class="fam-branch">${renderDescendantBranchHtml(cb,focusId)}</div>`).join('')}</div>`;
  }
  return node+below;
}
function renderSpouseBranchHtml(branch,focusId){
  const {person,expanded,parents}=branch;
  let above='';
  if(expanded){
    const cells=(parents||[null,null]).filter(Boolean).map(pb=>`<div class="fam-branch fam-branch-anc">${renderAncestorBranchHtml(pb,focusId)}</div>`).join('');
    above=cells?`<div class="fam-ancestors">${cells}</div>`:'';
  }
  const node=`<div class="fam-node">${famCard(person,focusId,{spouse:true})}${expandBadge('up',person.id,expanded)}</div>`;
  return above+node;
}
function drawPedLines(scale){
  const svg=$('#pedLines'); const container=$('#treeView');
  const parentsRow=$('#famParentsRow'), midRow=$('#famMidRow'), childrenRow=$('#famChildrenRow');
  if(!svg||!container||!parentsRow||!midRow||!childrenRow) return;
  const rect0=container.getBoundingClientRect(); const sc=scale||1;
  const local=el=>{const r=el.getBoundingClientRect(); return {x:(r.left-rect0.left)/sc,y:(r.top-rect0.top)/sc,w:r.width/sc,h:r.height/sc};};
  let paths='';
  const connectDown=(topEls,bottomEls)=>{
    const tops=topEls.filter(Boolean).map(local), bottoms=bottomEls.filter(Boolean).map(local);
    if(!tops.length||!bottoms.length) return;
    const topXs=tops.map(t=>t.x+t.w/2);
    const topY=Math.max(...tops.map(t=>t.y+t.h));
    const originX=(Math.min(...topXs)+Math.max(...topXs))/2;
    const midY=topY+28;
    const botXs=bottoms.map(b=>b.x+b.w/2);
    const botTopY=Math.min(...bottoms.map(b=>b.y));
    paths+=`<path d="M ${originX} ${topY} V ${midY}" fill="none" stroke="rgba(227,188,133,.35)" stroke-width="1.5"/>`;
    paths+=`<path d="M ${Math.min(...botXs,originX)} ${midY} H ${Math.max(...botXs,originX)}" fill="none" stroke="rgba(227,188,133,.35)" stroke-width="1.5"/>`;
    bottoms.forEach((b,i)=>{paths+=`<path d="M ${botXs[i]} ${midY} V ${botTopY}" fill="none" stroke="rgba(227,188,133,.35)" stroke-width="1.5"/>`;});
  };
  // .fam-node de um ramo "pra baixo" (filhos/netos) pode estar dentro de um .fam-side-row (quando
  // o cônjuge lateral dessa pessoa está revelado do lado dela) — tenta os dois caminhos.
  const directNode=b=>b&&b.querySelector(':scope > .fam-node, :scope > .fam-side-row > .fam-node');
  const focusEl=midRow.querySelector('.fam-card.focus');
  const parentTops=[...parentsRow.children].map(directNode);
  connectDown(parentTops,[...midRow.querySelectorAll('[data-blood="1"]')]);
  const childTops=[...childrenRow.children].map(directNode);
  connectDown([focusEl,...midRow.querySelectorAll('[data-spouse="1"]')],childTops);
  document.querySelectorAll('.fam-ancestors').forEach(anc=>{
    const ownerNode=anc.nextElementSibling;
    if(!ownerNode||!ownerNode.classList.contains('fam-node')) return;
    const tops=[...anc.children].map(directNode);
    connectDown(tops,[ownerNode]);
  });
  document.querySelectorAll('.fam-descendants').forEach(desc=>{
    let ownerNode=desc.previousElementSibling;
    if(ownerNode&&!ownerNode.classList.contains('fam-node')) ownerNode=ownerNode.querySelector(':scope > .fam-node');
    if(!ownerNode) return;
    const tops=[...desc.children].map(directNode);
    connectDown([ownerNode],tops);
  });
  svg.setAttribute('width',container.scrollWidth); svg.setAttribute('height',container.scrollHeight);
  svg.innerHTML=paths;
}

/* ---------- Carrossel coverflow (arraste, teclado, legenda) ---------- */
function initCoverflow(root,slides,opts={}){
  const {rotate=44,depth=.6,perspective=3,falloff=.56,fade=.1,gap=.05,loop=true,
    showCaption=true,showPagination=true,showNavigation=true,onCardClick=null,startIndex=0}=opts;
  const count=slides.length;
  if(!count){root.innerHTML='<p class="empty-note">Nenhuma foto publicada ainda.</p>';return null}

  root.innerHTML=`<div class="cf">
      <div class="cf-frame" tabindex="0">
        <div class="cf-stage">${slides.map((s,i)=>`<div class="cf-card" data-i="${i}"><img src="${s.src}" alt="${escapeHtml(s.alt||'')}" draggable="false"></div>`).join('')}</div>
        ${showNavigation?`<button type="button" class="cf-nav prev" aria-label="Anterior">‹</button><button type="button" class="cf-nav next" aria-label="Próxima">›</button>`:''}
      </div>
      ${showCaption?`<div class="cf-caption" id="cfCaption"></div>`:''}
      ${onCardClick?`<button type="button" class="cf-expand-btn" id="cfExpandBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>Ampliar foto</button>`:''}
      ${showPagination?`<div class="cf-dots" id="cfDots">${slides.map((_,i)=>`<button type="button" class="cf-dot" data-dot="${i}" aria-label="Ir para foto ${i+1}"></button>`).join('')}</div>`:''}
    </div>`;

  const frame=root.querySelector('.cf-frame'), stage=root.querySelector('.cf-stage');
  const cards=[...root.querySelectorAll('.cf-card')];
  const captionEl=root.querySelector('#cfCaption'), dots=[...root.querySelectorAll('[data-dot]')];
  const expandBtn=root.querySelector('#cfExpandBtn');
  // botão explícito, fora do carrossel arrastável — não depende de clique/duplo-clique
  // em cima do cartão, que às vezes não é reconhecido igual em todo mouse/touchpad.
  expandBtn?.addEventListener('click',()=>onCardClick(slides[selected],selected));
  frame.style.perspective=`calc(var(--cf-card) * ${perspective})`;
  stage.style.transformStyle='preserve-3d';

  let pos=startIndex,target=startIndex,width=0,raf=null,drag=null,selected=startIndex,moved=false;
  const indexAt=p=>((Math.round(p)%count)+count)%count;
  const clamp=p=>(loop?p:Math.max(0,Math.min(count-1,p)));

  function paint(){
    if(!width) return;
    const pitch=width*(1+gap);
    cards.forEach((card,i)=>{
      let offset=i-pos;
      if(loop){ offset=((offset%count)+count)%count; if(offset>count/2) offset-=count; }
      const distance=Math.abs(offset), ramp=Math.pow(distance,falloff);
      const tilt=Math.min(rotate*ramp,82)*Math.sign(offset);
      card.style.transform=`translateX(calc(-50% + ${offset*pitch}px)) translateZ(${-depth*width*ramp}px) rotateY(${-tilt}deg)`;
      const edge=loop?Math.min(1,Math.max(0,count/2-distance)):1;
      card.style.opacity=String(Math.max(0,1-fade*distance)*edge);
      card.style.zIndex=String(100-Math.round(distance));
    });
  }
  function renderCaption(){
    const s=slides[selected];
    if(captionEl) captionEl.innerHTML=s.title?`<div class="title">${escapeHtml(s.title)}</div>${s.subtitle?`<div class="subtitle">${escapeHtml(s.subtitle)}</div>`:''}${s.legenda?`<div class="legenda">${escapeHtml(s.legenda)}</div>`:''}`:'';
    dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===selected)));
  }
  function settle(t){
    if(raf!==null) cancelAnimationFrame(raf);
    target=t; selected=indexAt(t); renderCaption();
    const step=()=>{
      const remaining=target-pos;
      if(Math.abs(remaining)<.0004){ pos=target; paint(); raf=null; return }
      pos+=remaining*.16; paint(); raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
  }
  function goTo(i){ settle(clamp(loop?i+Math.round((target-i)/count)*count:i)) }
  function nudge(by){ settle(clamp(Math.round(target)+by)) }

  frame.addEventListener('pointerdown',e=>{
    // clique nos botões ‹ › não pode virar arraste — senão o pointer capture do frame
    // "sequestra" o clique e o botão nunca recebe o evento.
    if(e.target.closest('.cf-nav')) return;
    if(raf!==null){ cancelAnimationFrame(raf); raf=null }
    frame.setPointerCapture(e.pointerId);
    target=pos; moved=false;
    drag={id:e.pointerId,x:e.clientX,pos,v:0,t:performance.now()};
  });
  frame.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId) return;
    const pitch=width*(1+gap); if(!pitch) return;
    if(Math.abs(e.clientX-drag.x)>4) moved=true;
    const now=performance.now(), prev=pos;
    pos=clamp(drag.pos-(e.clientX-drag.x)/pitch);
    drag.v=((pos-prev)/Math.max(now-drag.t,1))*1000; drag.t=now;
    const i=indexAt(pos); if(i!==selected){ selected=i; renderCaption(); }
    paint();
  });
  const endDrag=e=>{
    if(!drag||drag.id!==e.pointerId) return;
    const carried=Math.max(-2,Math.min(2,drag.v*.18));
    drag=null;
    settle(clamp(Math.round(pos+carried)));
  };
  frame.addEventListener('pointerup',endDrag);
  frame.addEventListener('pointercancel',endDrag);
  frame.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft'){ e.preventDefault(); nudge(-1); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); nudge(1); }
  });
  root.querySelector('.cf-nav.prev')?.addEventListener('click',()=>nudge(-1));
  root.querySelector('.cf-nav.next')?.addEventListener('click',()=>nudge(1));
  dots.forEach(d=>d.addEventListener('click',()=>goTo(Number(d.dataset.dot))));
  // 1 clique já resolve: se a foto clicada já é a do centro, abre direto; se é uma foto do
  // lado, primeiro traz ela pro centro (aí um novo clique nela abre).
  // Importante: o clique é ouvido no frame (não em cada card) porque o pointer capture do
  // drag "sequestra" o alvo do evento de clique pro próprio frame — mesmo bug já visto nos
  // botões ‹ ›. Por isso descobrimos o card real por coordenada (elementFromPoint).
  frame.addEventListener('click',e=>{
    if(moved) return;
    if(e.target.closest('.cf-nav')) return;
    const hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cf-card');
    if(!hit) return;
    const i=Number(hit.dataset.i);
    if(i===selected){ if(onCardClick) onCardClick(slides[i],i); }
    else goTo(i);
  });
  // roda do mouse também gira o carrossel — um "clique" da roda passa uma foto por vez.
  let wheelCooldown=false;
  frame.addEventListener('wheel',e=>{
    e.preventDefault();
    if(wheelCooldown) return;
    wheelCooldown=true;
    setTimeout(()=>{ wheelCooldown=false; },220);
    nudge((e.deltaY||e.deltaX)>0?1:-1);
  },{passive:false});

  const measure=()=>{ width=cards[0]?.offsetWidth||0; paint(); };
  measure();
  new ResizeObserver(measure).observe(frame);
  renderCaption();
  return {goTo, nudge};
}

/* ---------- Carrossel empilhado (baralho de cartas, arrastável) ---------- */
function initStackedCarousel(root,slides,opts={}){
  const {onCardClick=null}=opts;
  const count=slides.length;
  if(!count){ root.innerHTML='<p class="empty-note">Nenhuma foto publicada ainda.</p>'; return null; }

  root.innerHTML=`<div class="cs-wrap"><div class="cs-stage">
    <div class="cs-drag"></div>
    ${slides.map((s,i)=>{
      const genderCls=s.gender==='male'?'gender-m':s.gender==='female'?'gender-f':'';
      const statusDot=s.isLiving===false?`<span class="cs-status deceased" title="Falecido(a)">✝</span>`:s.isLiving===true?`<span class="cs-status alive" title="Vivo(a)">●</span>`:'';
      return `<div class="cs-card ${genderCls}" data-i="${i}">
      ${s.src?`<img class="cs-img" src="${s.src}" alt="${escapeHtml(s.alt||'')}" draggable="false">`:`<div class="cs-fallback">${escapeHtml(initials(s.title||s.alt||'?'))}</div>`}
      <div class="cs-shade"></div>
      <div class="cs-gradient"></div>
      ${statusDot}
      ${s.badge?`<div class="cs-badge">${escapeHtml(s.badge)}</div>`:''}
      <div class="cs-text"><p class="cs-title">${escapeHtml(s.title||'')}</p>${s.nickname?`<p class="cs-nickname">"${escapeHtml(s.nickname)}"</p>`:''}${s.description?`<p class="cs-desc">${escapeHtml(s.description)}</p>`:''}</div>
    </div>`;
    }).join('')}
  </div></div>`;

  const dragEl=root.querySelector('.cs-drag');
  const cards=[...root.querySelectorAll('.cs-card')];

  function getConfig(){
    const w=window.innerWidth;
    if(w<640) return {xMul:90,yMul:20,rotMul:8,scaleRed:.06,sensitivity:180,distDiv:120,velDiv:500};
    if(w<1024) return {xMul:130,yMul:30,rotMul:10,scaleRed:.09,sensitivity:220,distDiv:160,velDiv:650};
    return {xMul:170,yMul:40,rotMul:12,scaleRed:.12,sensitivity:250,distDiv:200,velDiv:800};
  }
  let config=getConfig();
  window.addEventListener('resize',()=>{ config=getConfig(); paint(); });

  let progress=0, target=0, raf=null;

  function offsetFor(i){
    let diff=(i-progress)%count;
    if(diff>count/2) diff-=count;
    if(diff<-count/2) diff+=count;
    return diff;
  }
  // interpolação linear por trechos (equivalente ao useTransform([...pontos],[...valores]) do Motion)
  function lerpBreaks(v,xs,ys){
    if(v<=xs[0]) return ys[0];
    if(v>=xs[xs.length-1]) return ys[ys.length-1];
    for(let i=0;i<xs.length-1;i++){
      if(v>=xs[i]&&v<=xs[i+1]){ const t=(v-xs[i])/(xs[i+1]-xs[i]); return ys[i]+t*(ys[i+1]-ys[i]); }
    }
    return ys[ys.length-1];
  }

  function paint(){
    const half=count/2;
    cards.forEach((card,i)=>{
      const o=offsetFor(i), absO=Math.abs(o);
      const x=o*config.xMul;
      const rot=absO<0.05?0:o*config.rotMul;
      const y=absO<0.05?0:absO*config.yMul;
      const scale=1-absO*config.scaleRed;
      const opacity=lerpBreaks(o,[-half,-half+0.5,0,half-0.5,half],[0,1,1,1,0]);
      const shade=lerpBreaks(Math.max(-2,Math.min(2,o)),[-2,-0.5,0,0.5,2],[.5,.2,0,.2,.5]);
      const textOp=lerpBreaks(o,[-0.5,0,0.5],[0,1,0]);
      const z=Math.round(100-absO*10);
      card.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) rotate(${rot}deg) scale(${scale})`;
      card.style.opacity=String(Math.max(0,Math.min(1,opacity)));
      card.style.zIndex=String(z);
      card.querySelector('.cs-shade').style.opacity=String(Math.max(0,Math.min(1,shade)));
      card.querySelector('.cs-text').style.opacity=String(Math.max(0,Math.min(1,textOp)));
    });
  }
  paint();

  function settle(t){
    if(raf!==null) cancelAnimationFrame(raf);
    target=t;
    const step=()=>{
      const remaining=target-progress;
      if(Math.abs(remaining)<.001){ progress=target; paint(); raf=null; return; }
      progress+=remaining*.18;
      paint();
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
  }
  // acha o cartão visualmente na frente naquele ponto — os cartões têm pointer-events:none (a
  // camada de arrastar cobre tudo), então um clique precisa achar "na mão" quem está por baixo.
  function cardAtPoint(x,y){
    const sorted=[...cards].sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex));
    for(const card of sorted){
      const r=card.getBoundingClientRect();
      if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom) return card;
    }
    return null;
  }

  let dragState=null;
  dragEl.addEventListener('pointerdown',e=>{
    if(raf!==null){ cancelAnimationFrame(raf); raf=null; }
    dragEl.setPointerCapture(e.pointerId);
    dragState={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,startProgress:progress,v:0,t:performance.now()};
  });
  dragEl.addEventListener('pointermove',e=>{
    if(!dragState||dragState.id!==e.pointerId) return;
    const now=performance.now();
    const deltaX=e.clientX-dragState.lastX;
    progress+=(-deltaX)/config.sensitivity;
    const dt=Math.max(now-dragState.t,1);
    dragState.v=(deltaX/dt)*1000;
    dragState.lastX=e.clientX; dragState.t=now;
    paint();
  });
  const endDrag=e=>{
    if(!dragState||dragState.id!==e.pointerId) return;
    const dragDistance=e.clientX-dragState.startX;
    const totalMoved=Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY);
    const velocity=dragState.v;
    const distanceShift=-dragDistance/config.distDiv;
    const velocityShift=-velocity/config.velDiv;
    let totalShift=Math.round(distanceShift+velocityShift);
    totalShift=Math.max(-3,Math.min(3,totalShift));
    const startRounded=Math.round(dragState.startProgress);
    dragState=null;
    settle(startRounded+totalShift);
    // clique de verdade (quase sem arrastar) num cartão específico — vai direto pra ele.
    if(onCardClick&&totalMoved<6){
      const card=cardAtPoint(e.clientX,e.clientY);
      if(card){ const i=Number(card.dataset.i); onCardClick(slides[i],i); }
    }
  };
  dragEl.addEventListener('pointerup',endDrag);
  dragEl.addEventListener('pointercancel',endDrag);
  // roda do mouse também gira o baralho — um "clique" da roda passa uma pessoa por vez.
  let wheelCooldown=false;
  dragEl.addEventListener('wheel',e=>{
    e.preventDefault();
    if(wheelCooldown) return;
    wheelCooldown=true;
    setTimeout(()=>{ wheelCooldown=false; },220);
    const dir=(e.deltaY||e.deltaX)>0?1:-1;
    settle(Math.round(target)+dir);
  },{passive:false});

  return {settle,goTo:i=>settle(i)};
}

/* ---------- Hero com sequência de frames controlada pelo scroll ---------- */
// A seção .hero fica "grudada" (position:sticky) dentro de um wrapper mais alto
// (.hero-scrub). Enquanto o usuário rola por esse wrapper, calculamos o progresso
// (0 a 1) e desenhamos o frame correspondente num <canvas>. Quando o progresso
// chega a 1, o wrapper acaba, o sticky solta e a página passa a rolar normalmente.
function initHeroScrub(opts={}){
  const {frameCount=120,frameUrl=i=>`Assents/hero-frames-web/f${String(i).padStart(3,'0')}.webp`,
    scrubId='heroScrub',heroId='heroSection',canvasId='heroCanvas'}=opts;
  const scrub=document.getElementById(scrubId), hero=document.getElementById(heroId), canvas=document.getElementById(canvasId);
  if(!scrub||!hero||!canvas) return;
  const ctx=canvas.getContext('2d');

  // o cabeçalho também é sticky top:0 — o hero precisa grudar logo abaixo dele
  // (senão os dois disputam o topo da tela assim que a rolagem começa).
  const hdrEl=document.querySelector('.site-header');
  function syncHeaderH(){ document.documentElement.style.setProperty('--hdr-h',(hdrEl?.offsetHeight||0)+'px'); }
  syncHeaderH();

  const images=[];
  for(let i=1;i<=frameCount;i++){ const img=new Image(); img.src=frameUrl(i); images.push(img); }

  function draw(i){
    const img=images[i];
    if(!img||!img.complete||!img.naturalWidth) return;
    if(canvas.width!==img.naturalWidth||canvas.height!==img.naturalHeight){ canvas.width=img.naturalWidth; canvas.height=img.naturalHeight; }
    ctx.drawImage(img,0,0);
  }
  images[0].addEventListener('load',()=>draw(0));
  if(images[0].complete) draw(0);

  let current=-1,ticking=false;
  function update(){
    ticking=false;
    // o hero é a primeiríssima coisa da página (logo abaixo do cabeçalho), então o
    // scroll começa a "prender" nele a partir do topo — dá pra usar window.scrollY
    // direto: o trilho acaba quando a rolagem atinge (altura do wrapper - altura do hero).
    const total=scrub.offsetHeight-hero.offsetHeight;
    const progress=total>0?Math.min(1,Math.max(0,window.scrollY/total)):0;
    const idx=Math.min(frameCount-1,Math.floor(progress*(frameCount-1)+1e-6));
    if(idx!==current){ current=idx; draw(idx); }
  }
  window.addEventListener('scroll',()=>{ if(!ticking){ ticking=true; requestAnimationFrame(update); } },{passive:true});
  window.addEventListener('resize',()=>{ syncHeaderH(); update(); });
  update();
}

/* ---------- Revelação de texto ao carregar (palavra por palavra, com blur) ---------- */
// Quebra o texto de dentro de `el` em <span class="reveal-word"> por palavra, sem
// mexer em tags que já existam ali dentro (ex.: <em>) — só as caixas de texto puro
// são percorridas e substituídas. Cada span começa desfocado/invisível/deslocado e
// a classe .in (aplicada por revealWords) dispara a transição via CSS.
function wrapRevealWords(el){
  if(!el||el.dataset.revealWrapped) return [];
  el.dataset.revealWrapped='1';
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null);
  const textNodes=[]; let n;
  while(n=walker.nextNode()) textNodes.push(n);
  const words=[];
  textNodes.forEach(tn=>{
    if(!tn.textContent.trim()) return;
    const frag=document.createDocumentFragment();
    tn.textContent.split(/(\s+)/).forEach(part=>{
      if(part==='') return;
      if(/^\s+$/.test(part)){ frag.appendChild(document.createTextNode(part)); return; }
      const span=document.createElement('span');
      span.className='reveal-word';
      span.textContent=part;
      frag.appendChild(span);
      words.push(span);
    });
    tn.parentNode.replaceChild(frag,tn);
  });
  return words;
}
function revealWords(el,opts={}){
  if(!el) return [];
  const {baseDelay=0,stagger=35,dir=''}=opts;
  const words=wrapRevealWords(el);
  if(dir==='left') words.forEach(w=>w.classList.add('dir-left'));
  words.forEach((w,i)=>{ w.style.transitionDelay=(baseDelay+i*stagger)+'ms'; });
  // força o navegador a "commitar" o estado inicial (desfocado/invisível) antes de
  // ligar a classe que dispara a transição — sem isso as duas mudanças colapsam no
  // mesmo frame e a transição não roda. Mais confiável que requestAnimationFrame
  // duplo (que pode atrasar bastante numa aba fora de foco).
  void el.offsetHeight;
  words.forEach(w=>w.classList.add('in'));
  return words;
}
function revealBlock(el,delay=0,opts={}){
  if(!el) return;
  el.classList.add('reveal-block');
  if(opts.dir==='left') el.classList.add('dir-left');
  el.style.transitionDelay=delay+'ms';
  void el.offsetHeight;
  el.classList.add('in');
}

// Revela um grupo de elementos (blocos inteiros, sem quebrar em palavras) conforme
// eles entram na tela ao rolar — mesma linguagem visual (desfoca/sobe/foca) da Hero,
// só que disparada por scroll em vez de no carregamento. Usa IntersectionObserver:
// cada elemento só anima uma vez, na primeira vez que aparece.
function initScrollReveal(selector,opts={}){
  const els=[...document.querySelectorAll(selector)];
  if(!els.length||window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const {stagger=70,maxStagger=3}=opts;
  els.forEach(el=>el.classList.add('reveal-block'));
  void document.body.offsetHeight; // commita o estado escondido antes de observar
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      const i=els.indexOf(entry.target);
      entry.target.style.transitionDelay=(Math.min(i,maxStagger)*stagger)+'ms';
      entry.target.classList.add('in');
      io.unobserve(entry.target);
    });
  },{threshold:.15,rootMargin:'0px 0px -8% 0px'});
  els.forEach(el=>io.observe(el));
}

// Números que "contam" de 0 até o valor final quando entram na tela (uma vez só,
// via IntersectionObserver — mesma ideia do initScrollReveal). Zera o texto na hora
// (antes do primeiro paint) pra ninguém ver o valor final piscando antes de contar.
// Elementos com texto não-numérico (ex.: "—") ou valor 0 ficam como estão.
function initCountUp(selector,opts={}){
  const els=[...document.querySelectorAll(selector)];
  if(!els.length||window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const {duration=1400}=opts;
  const targets=new Map();
  els.forEach(el=>{
    const target=Number(el.textContent.replace(/\D/g,''));
    if(!target) return;
    targets.set(el,target);
    el.textContent='0';
  });
  if(!targets.size) return;
  function animate(el){
    const target=targets.get(el);
    const start=performance.now();
    function step(now){
      const t=Math.min(1,(now-start)/duration);
      const eased=1-Math.pow(1-t,3); // ease-out cúbico — acelera rápido, chega devagar
      el.textContent=String(Math.round(target*eased));
      if(t<1) requestAnimationFrame(step); else el.textContent=String(target);
    }
    requestAnimationFrame(step);
  }
  const io=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(!entry.isIntersecting) return;
      animate(entry.target);
      io.unobserve(entry.target);
    });
  },{threshold:.4});
  targets.forEach((_,el)=>io.observe(el));
}

// Cartão que inclina levemente seguindo o cursor, com um brilho suave por baixo do
// mouse — só liga em dispositivos com mouse de verdade (a CSS de .tilt-card já fica
// inerte sem hover:hover+pointer:fine; aqui a gente nem registra os listeners).
function initCardTilt(selector,opts={}){
  if(!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const {max=8,shadow=16}=opts;
  document.querySelectorAll(selector).forEach(card=>{
    card.classList.add('tilt-card');
    let raf=null;
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      const px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
      card.classList.add('tilting');
      if(raf) cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        card.style.setProperty('--tilt-rx',((px-.5)*max*2).toFixed(2)+'deg');
        card.style.setProperty('--tilt-ry',(-(py-.5)*max*2).toFixed(2)+'deg');
        card.style.setProperty('--tilt-mx',(px*100).toFixed(1)+'%');
        card.style.setProperty('--tilt-my',(py*100).toFixed(1)+'%');
        // sombra foge pro lado oposto do cursor — reforça a leitura de profundidade
        // mesmo em imagens "planas" (capturas de tela), onde a rotação sozinha
        // quase não se nota.
        card.style.setProperty('--tilt-sx',(-(px-.5)*shadow*2).toFixed(1)+'px');
        card.style.setProperty('--tilt-sy',(-(py-.5)*shadow*2).toFixed(1)+'px');
      });
    });
    card.addEventListener('pointerleave',()=>{
      card.classList.remove('tilting');
      card.style.setProperty('--tilt-rx','0deg');
      card.style.setProperty('--tilt-ry','0deg');
      card.style.setProperty('--tilt-sx','0px');
      card.style.setProperty('--tilt-sy','0px');
    });
  });
}
