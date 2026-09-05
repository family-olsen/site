const { createClient } = supabase;
const sbClient = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function $(sel){return document.querySelector(sel)}
function photoUrl(path){return path?sbClient.storage.from('photos').getPublicUrl(path).data.publicUrl:''}
function avatarUrl(path){return photoUrl(path)}
function yearsLabel(p){
  const b=p.birth_date?p.birth_date.slice(0,4):null, d=p.death_date?p.death_date.slice(0,4):null;
  if(!b&&!d) return '';
  if(d) return `${b||'?'} — ${d}`;
  if(p.is_living===false) return `${b||'?'} —`;
  return `${b} — hoje`;
}
function initials(name){return (name||'?').trim().charAt(0).toUpperCase()}

/* ---------- Parentesco (leitura pública) ---------- */
const PERSON_FIELDS='id,full_name,birth_date,death_date,avatar_path,biography,gender,is_living';
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
      <a href="index.html" class="site-brand"><strong>Olsen · Belloto · Leal</strong><span>acervo da família</span></a>
      <nav class="site-nav">${nav}<button type="button" class="search-btn" id="openSearchBtn"><span class="search-dot"></span><span>Buscar</span></button></nav>
    </header>`);
  $('#openSearchBtn').addEventListener('click',openSearch);
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
function openLightbox(src,alt,meta){
  closeLightbox();
  const div=document.createElement('div');
  div.className='lightbox'; div.id='activeLightbox';
  div.innerHTML=`<button type="button" class="lightbox-close" aria-label="Fechar">×</button><img src="${escapeHtml(src)}" alt="${escapeHtml(alt||'')}"><p class="lightbox-caption"><span class="alt">${escapeHtml(alt||'')}</span><span class="meta">${escapeHtml(meta||'')}</span></p>`;
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
      ${showPagination?`<div class="cf-dots" id="cfDots">${slides.map((_,i)=>`<button type="button" class="cf-dot" data-dot="${i}" aria-label="Ir para foto ${i+1}"></button>`).join('')}</div>`:''}
    </div>`;

  const frame=root.querySelector('.cf-frame'), stage=root.querySelector('.cf-stage');
  const cards=[...root.querySelectorAll('.cf-card')];
  const captionEl=root.querySelector('#cfCaption'), dots=[...root.querySelectorAll('[data-dot]')];
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
    if(captionEl) captionEl.innerHTML=s.title?`<div class="title">${escapeHtml(s.title)}</div>${s.subtitle?`<div class="subtitle">${escapeHtml(s.subtitle)}</div>`:''}`:'';
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
  // 1 clique só navega até o cartão (não abre nada — evita a sensação de "ficar preso" na
  // foto); 2 cliques rápidos é que ampliam, do jeito que o usuário já espera de uma galeria.
  cards.forEach((card,i)=>{
    card.addEventListener('click',()=>{ if(moved) return; goTo(i); });
    card.addEventListener('dblclick',()=>{ goTo(i); if(onCardClick) onCardClick(slides[i],i); });
  });

  const measure=()=>{ width=cards[0]?.offsetWidth||0; paint(); };
  measure();
  new ResizeObserver(measure).observe(frame);
  renderCaption();
  return {goTo, nudge};
}
