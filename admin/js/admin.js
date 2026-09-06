const { createClient } = supabase;
const client = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);
const $ = s => document.querySelector(s);
const loginView=$('#loginView'), appView=$('#appView'), modal=$('#personModal'), familyModal=$('#familyModal'), childrenModal=$('#childrenModal'), linkChildrenModal=$('#linkChildrenModal'), relModal=$('#relModal'), storyModal=$('#storyModal'), storyPeopleModal=$('#storyPeopleModal'), bookModal=$('#bookModal'), chaptersModal=$('#chaptersModal'), photoModal=$('#photoModal'), photoPeopleModal=$('#photoPeopleModal'), albumModal=$('#albumModal'), albumPhotosModal=$('#albumPhotosModal'), eventModal=$('#eventModal'), eventPeopleModal=$('#eventPeopleModal'), documentModal=$('#documentModal'), sourceModal=$('#sourceModal'), placeModal=$('#placeModal'), confirmDeleteModal=$('#confirmDeleteModal');
let role=null, people=[], families=[], stories=[], activeStoryId=null, currentStoryPeople=[], places=[], photos=[], albums=[], events=[], documents=[], sources=[], books=[], currentChapters=[], currentPhotoPeople=[], currentEventPeople=[], currentAlbumPhotos=[], activePhotoId=null, activeAlbumId=null, activeEventId=null, activeBookId=null, placesLabelMap=new Map(), photosLabelMap=new Map(), documentsLabelMap=new Map(), peopleOptions=[], activeFamilyId=null, currentChildrenMap=new Map(), currentFocusId=null, relMode=null, relTargetId=null, relTargetFamilyUnits=[], reopenRelModeAfterPersonSave=null, peopleLabelMap=new Map(), storiesQuickLabelMap=new Map(), photoQuickPeople=[], photoQuickStories=[], storyQuickPeople=[], albumsQuickLabelMap=new Map(), photoQuickAlbums=[], chapterQuickPhotos=[], reopenChaptersAfterPhotoSave=false, storyQuickPhotos=[], reopenStoryAfterPersonSave=false, reopenStoryAfterPhotoSave=false, eventQuickPeople=[], eventQuickDocuments=[], sourceQuickStories=[], sourceQuickChapters=[], reopenEventAfterPersonSave=false, reopenEventAfterPhotoSave=false, placeShortcutTarget=null, sourcesQuickLabelMap=new Map(), storyQuickSources=[], eventQuickSources=[], chapterQuickSources=[], reopenStoryAfterSourceSave=false, reopenEventAfterSourceSave=false, reopenChaptersAfterSourceSave=false, chaptersQuickLabelMap=new Map(), eventsQuickLabelMap=new Map(), pendingDocumentUpload=null, documentQuickPeople=[], documentQuickStories=[], documentQuickChapters=[], documentQuickEvents=[], reopenDocumentAfterPersonSave=false, peoplePage=1, pendingLinkChildren=[], pendingLinkFamilyId=null, familiesPage=1, booksPage=1, storiesPage=1, photosPage=1, albumsPage=1, eventsPage=1, documentsPage=1, sourcesPage=1, placesPage=1;

/* ---------- Pré-visualização da biografia automática ----------
   Mesmo gerador de texto usado em pessoa.html (js/site.js) — duplicado aqui de
   propósito: o admin usa o cliente já autenticado (`client`, com acesso total
   via RLS de admin), então pra mostrar exatamente o que o PÚBLICO vai ver, as
   consultas de pai/mãe/cônjuge/filhos abaixo filtram manualmente por
   is_public=true e status='published' — reproduzindo a política pública sem
   precisar de um segundo cliente Supabase anônimo na mesma página. */
function fullDateLabelAdmin(d){
  if(!d) return '';
  const [y,m,day]=String(d).slice(0,10).split('-').map(Number);
  if(!y||!m||!day) return '';
  return new Date(y,m-1,day).toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'});
}
function dataComPrecisaoAdmin(data,precisao){
  if(!data) return '';
  if(!precisao||precisao==='exact') return `em ${fullDateLabelAdmin(data)}`;
  const ano=String(data).slice(0,4);
  if(precisao==='before') return `antes de ${ano}`;
  if(precisao==='after') return `depois de ${ano}`;
  return `por volta de ${ano}`;
}
function diferencaEmAnosAdmin(dataMaisNova,dataMaisVelha){
  if(!dataMaisNova||!dataMaisVelha) return null;
  const anos=Number(String(dataMaisNova).slice(0,4))-Number(String(dataMaisVelha).slice(0,4));
  return (anos>=0&&anos<120)?anos:null;
}
function gerarBiografiaAutomaticaAdmin({pessoa,pais,casamentos,filhos,placeName}){
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
      const idade=diferencaEmAnosAdmin(pessoa.birth_date,p.birth_date);
      if(idade==null) return null;
      const aprox=p.birth_date_precision&&p.birth_date_precision!=='exact';
      const papel=p.gender==='female'?'sua mãe':'seu pai';
      return `${papel}, ${p.full_name}, tinha ${aprox?'cerca de ':''}${idade} anos`;
    }).filter(Boolean);
    let f=`Quando ${nome} nasceu ${dataComPrecisaoAdmin(pessoa.birth_date,pessoa.birth_date_precision)}`;
    if(localNasc) f+=`, em ${localNasc}`;
    if(partes.length) f+=`, ${partes.join(' e ')}`;
    frases.push(f+apelido+'.');
    contouNascimento=true;
  } else if(pessoa.birth_date&&pais.length){
    let f=`${feminino?'Filha':'Filho'} de ${pais.map(p=>p.full_name).join(' e ')}, nasceu ${dataComPrecisaoAdmin(pessoa.birth_date,pessoa.birth_date_precision)}`;
    if(localNasc) f+=`, em ${localNasc}`;
    frases.push(f+apelido+'.');
    contouNascimento=true;
  } else if(pessoa.birth_date){
    let f=`${nome} nasceu ${dataComPrecisaoAdmin(pessoa.birth_date,pessoa.birth_date_precision)}`;
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
    const data=dataComPrecisaoAdmin(c.start_date,c.start_date_precision);
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
      const lista=partes.length>1?partes.slice(0,-1).join(', ')+' e '+partes[partes.length-1]:partes[0];
      frases.push(`${casamentos.length?'Eles t':'T'}iveram pelo menos ${lista}.`);
    }
  }

  if(pessoa.death_date){
    const idade=diferencaEmAnosAdmin(pessoa.death_date,pessoa.birth_date);
    let f=`${pronome} faleceu ${dataComPrecisaoAdmin(pessoa.death_date,pessoa.death_date_precision)}`;
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
const PESSOA_PUBLICA_FIELDS='id,full_name,nickname,gender,is_living,birth_date,birth_date_precision,birth_place_id,death_date,death_date_precision,death_place_id';
async function carregarPreviewBiografia(personId){
  const box=$('#biographyAutoPreview');
  if(!personId){ box.hidden=true; box.innerHTML=''; return; }
  const publicos=(q)=>q.eq('is_public',true).eq('status','published');
  const [{data:pessoa},{data:paisRows},{data:filhosRows},{data:unidades}]=await Promise.all([
    publicos(client.from('people').select(PESSOA_PUBLICA_FIELDS).eq('id',personId)).maybeSingle(),
    client.from('parent_child_relationships').select(`people!parent_child_relationships_parent_id_fkey(${PESSOA_PUBLICA_FIELDS},is_public,status)`).eq('child_id',personId),
    client.from('parent_child_relationships').select(`people!parent_child_relationships_child_id_fkey(${PESSOA_PUBLICA_FIELDS},is_public,status)`).eq('parent_id',personId),
    client.from('family_unit_members').select('family_unit_id').eq('person_id',personId)
  ]);
  if(!pessoa){ box.hidden=true; box.innerHTML=''; return; }
  const pais=(paisRows||[]).map(r=>r.people).filter(p=>p&&p.is_public&&p.status==='published');
  const filhos=(filhosRows||[]).map(r=>r.people).filter(p=>p&&p.is_public&&p.status==='published');
  const unitIds=(unidades||[]).map(u=>u.family_unit_id);
  // o filtro is_public/status do cônjuge é feito em JS depois de trazer os dados —
  // o Supabase não deixa encadear .eq() numa coluna de tabela relacionada (people)
  // dentro de um select() aninhado como esse, só na tabela raiz da consulta.
  let casamentos=[];
  if(unitIds.length){
    const [{data:fus},{data:membros}]=await Promise.all([
      client.from('family_units').select('id,start_date,start_date_precision,place_id').in('id',unitIds),
      client.from('family_unit_members').select(`family_unit_id,people(${PESSOA_PUBLICA_FIELDS},is_public,status)`).in('family_unit_id',unitIds).neq('person_id',personId)
    ]);
    const fuMap=new Map((fus||[]).map(f=>[f.id,f]));
    casamentos=(membros||[]).filter(m=>m.people&&m.people.is_public&&m.people.status==='published').map(m=>({spouse:m.people,...fuMap.get(m.family_unit_id)}));
  }
  const placeName=(pid)=>pid?labelFromMap(placesLabelMap,pid):'';
  const texto=gerarBiografiaAutomaticaAdmin({pessoa,pais,casamentos,filhos,placeName});
  if(!texto){ box.hidden=true; box.innerHTML=''; return; }
  box.hidden=false;
  box.innerHTML=`<b>Pré-visualização automática (o que aparece publicamente)</b>${escapeHtml(texto)}`;
}

function showError(el,msg){el.textContent=msg||''}
let confirmDeleteResolver=null;
function confirmDelete(title,message){
  $('#confirmDeleteTitle').textContent=title;
  $('#confirmDeleteMessage').textContent=message;
  confirmDeleteModal.classList.add('open');
  return new Promise(resolve=>{confirmDeleteResolver=resolve;});
}
function resolveConfirmDelete(result){
  confirmDeleteModal.classList.remove('open');
  if(confirmDeleteResolver){confirmDeleteResolver(result); confirmDeleteResolver=null;}
}
function fullNameFrom(given,surname){return [given,surname].map(v=>(v||'').trim()).filter(Boolean).join(' ')}
function updateFullNamePreview(){
  const name=fullNameFrom($('#givenName').value,$('#surname').value);
  $('#fullNamePreview').textContent='Nome completo: '+(name||'—');
}
function avatarUrl(path){return path?client.storage.from('photos').getPublicUrl(path).data.publicUrl:''}
let pendingAvatarUpload=null;
async function processAvatarFile(file){
  const bitmap=await createImageBitmap(file);
  const {blob}=await drawToBlob(bitmap,320,0.85);
  bitmap.close?.();
  return blob;
}
async function onPersonAvatarChange(e){
  const file=e.target.files[0];
  if(!file) return;
  pendingAvatarUpload=null;
  if(file.size>MAX_IMAGE_SOURCE_BYTES){
    $('#personAvatarHint').textContent=`Arquivo muito grande (máx. ${humanSize(MAX_IMAGE_SOURCE_BYTES)}).`;
    e.target.value=''; return;
  }
  $('#personAvatarHint').textContent='Processando imagem...';
  try{
    const blob=await processAvatarFile(file);
    pendingAvatarUpload=blob;
    $('#personAvatarPreview').innerHTML=`<img src="${URL.createObjectURL(blob)}" alt="">`;
    $('#personAvatarHint').textContent=`Pronto (${(blob.size/1024).toFixed(0)} KB).`;
  }catch(err){
    $('#personAvatarHint').textContent='Erro ao processar imagem: '+err.message;
  }
}
function openModal(person=null){
  $('#formError').textContent='';
  $('#personId').value=person?.id||'';
  $('#formTitle').textContent=person?'Editar pessoa':'Nova pessoa';
  $('#nickname').value=person?.nickname||'';
  $('#givenName').value=person?.given_name||''; $('#surname').value=person?.surname||'';
  $('#birthDate').value=person?.birth_date||''; $('#deathDate').value=person?.death_date||'';
  $('#personBirthPlace').value=person?.birth_place_id?labelFromMap(placesLabelMap,person.birth_place_id):'';
  $('#personDeathPlace').value=person?.death_place_id?labelFromMap(placesLabelMap,person.death_place_id):'';
  $('#personGender').value=person?.gender||'';
  $('#personLivingStatus').value=person?(person.is_living===false?'deceased':(person.is_living===true?'alive':'')):'';
  $('#biography').value=person?.biography||''; $('#isPublic').checked=person?.is_public ?? true;
  updateFullNamePreview();
  pendingAvatarUpload=null; $('#personAvatarFile').value='';
  $('#personAvatarPreview').innerHTML=person?.avatar_path?`<img src="${avatarUrl(person.avatar_path)}" alt="">`:'sem foto';
  $('#personAvatarHint').textContent='Opcional — aparece na árvore genealógica e na listagem.';
  modal.classList.add('open');
  $('#biographyAutoPreview').hidden=true; $('#biographyAutoPreview').innerHTML='';
  carregarPreviewBiografia(person?.id).catch(()=>{});
}
function closeModal(){
  modal.classList.remove('open');
  if(reopenStoryAfterPersonSave){reopenStoryAfterPersonSave=false; storyModal.classList.add('open');}
  if(reopenEventAfterPersonSave){reopenEventAfterPersonSave=false; eventModal.classList.add('open');}
  if(reopenDocumentAfterPersonSave){reopenDocumentAfterPersonSave=false; documentModal.classList.add('open');}
}

async function ensureAdmin(){
  const {data:{user}}=await client.auth.getUser();
  if(!user) return false;
  const {data,error}=await client.from('admin_users').select('role,display_name,active').eq('user_id',user.id).maybeSingle();
  if(error || !data || !data.active){await client.auth.signOut(); throw new Error('Usuário autenticado sem permissão no painel.');}
  role=data.role; $('#roleBadge').textContent=data.role.toUpperCase(); $('#userEmail').textContent=user.email||'';
  return true;
}
async function loadPeople(){
  const q=$('#searchPeople').value.trim();
  let query=client.from('people').select('id,full_name,given_name,surname,nickname,birth_date,death_date,birth_place_id,death_place_id,biography,is_public,is_living,status,updated_at,avatar_path,gender').order('full_name',{ascending:true});
  if(q) query=query.ilike('full_name',`%${q}%`);
  const {data,error}=await query;
  if(error){$('#peopleTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  people=data||[]; $('#peopleCount').textContent=people.length; peoplePage=1; renderPeople();
}
function avatarThumb(p){
  if(p.avatar_path) return `<img class="thumb-avatar" src="${avatarUrl(p.avatar_path)}" alt="">`;
  const initial=(p.full_name||'?').trim().charAt(0).toUpperCase();
  return `<div class="thumb-avatar-fallback">${escapeHtml(initial)}</div>`;
}
function renderPeople(){
  $('#peoplePagination').innerHTML='';
  if(!people.length){$('#peopleTable').innerHTML='<div class="empty-state small"><div class="empty-icon">◎</div><h4>Nenhuma pessoa encontrada</h4><p>Cadastre a primeira pessoa da família.</p><button class="primary" id="emptyAdd">+ Nova pessoa</button></div>';$('#emptyAdd')?.addEventListener('click',()=>openModal());return}
  const pageSize=Number($('#peoplePageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(people.length/pageSize));
  if(peoplePage>totalPages) peoplePage=totalPages;
  if(peoplePage<1) peoplePage=1;
  const start=(peoplePage-1)*pageSize;
  const pageItems=people.slice(start,start+pageSize);
  $('#peopleTable').innerHTML='<table><thead><tr><th>Nome</th><th>Nascimento</th><th>Falecimento</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(p=>`<tr><td><div class="thumb-cell">${avatarThumb(p)}<strong>${escapeHtml(p.full_name)}</strong></div></td><td>${p.birth_date||'—'}</td><td>${p.death_date||'—'}</td><td><span class="status">${escapeHtml(p.status)}</span></td><td class="actions"><button data-edit="${p.id}">Editar</button><button data-delete="${p.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(people.find(p=>p.id===b.dataset.edit)));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deletePerson(b.dataset.delete));
  if(totalPages>1){
    $('#peoplePagination').innerHTML=`<button type="button" class="secondary" id="peoplePrevPage"${peoplePage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${peoplePage} de ${totalPages} (${people.length} pessoas)</span><button type="button" class="secondary" id="peopleNextPage"${peoplePage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#peoplePrevPage')?.addEventListener('click',()=>{peoplePage--; renderPeople();});
    $('#peopleNextPage')?.addEventListener('click',()=>{peoplePage++; renderPeople();});
  }
}
async function savePerson(e){
  e.preventDefault(); showError($('#formError'),'');
  const id=$('#personId').value;
  const givenName=$('#givenName').value.trim();
  if(!givenName){showError($('#formError'),'Informe o nome.');return}
  if(!$('#personGender').value){showError($('#formError'),'Selecione o gênero (masculino ou feminino).');return}
  if(!$('#personLivingStatus').value){showError($('#formError'),'Informe se a pessoa está viva ou falecida.');return}
  const birthPlaceRaw=$('#personBirthPlace').value.trim();
  const birthPlaceId=birthPlaceRaw?await resolveOrCreatePlace($('#personBirthPlace')):'';
  if(birthPlaceRaw&&!birthPlaceId){showError($('#formError'),'Local de nascimento não encontrado — selecione um da lista ou cadastre em Lugares.');return}
  const deathPlaceRaw=$('#personDeathPlace').value.trim();
  const deathPlaceId=deathPlaceRaw?await resolveOrCreatePlace($('#personDeathPlace')):'';
  if(deathPlaceRaw&&!deathPlaceId){showError($('#formError'),'Local de falecimento não encontrado — selecione um da lista ou cadastre em Lugares.');return}
  const payload={full_name:fullNameFrom(givenName,$('#surname').value),nickname:$('#nickname').value.trim()||null,given_name:givenName||null,surname:$('#surname').value.trim()||null,birth_date:$('#birthDate').value||null,death_date:$('#deathDate').value||null,birth_place_id:birthPlaceId||null,death_place_id:deathPlaceId||null,gender:$('#personGender').value||null,is_living:$('#personLivingStatus').value==='alive',biography:$('#biography').value.trim()||null,is_public:$('#isPublic').checked,status:$('#isPublic').checked?'published':'draft'};
  const existing=id?people.find(p=>p.id===id):null;
  let oldAvatarPath=null;
  if(pendingAvatarUpload){
    const uid=crypto.randomUUID();
    const avPath=`avatars/${uid}.webp`;
    const up=await client.storage.from('photos').upload(avPath,pendingAvatarUpload,{contentType:'image/webp'});
    if(up.error){showError($('#formError'),'Falha no upload da foto: '+up.error.message);return}
    payload.avatar_path=avPath;
    if(existing?.avatar_path) oldAvatarPath=existing.avatar_path;
  }
  let newId=null, error;
  if(id){
    ({error}=await client.from('people').update(payload).eq('id',id));
  } else {
    const res=await client.from('people').insert(payload).select('id').single();
    error=res.error; newId=res.data?.id;
  }
  if(error){showError($('#formError'),error.message);return}
  if(oldAvatarPath) await client.storage.from('photos').remove([oldAvatarPath]);
  if(!id&&newId&&reopenStoryAfterPersonSave){
    storyQuickPeople.push({id:newId,full_name:payload.full_name,role:$('#storyQuickRole').value||'main'});
    renderStoryChips();
  }
  if(!id&&newId&&reopenEventAfterPersonSave){
    eventQuickPeople.push({id:newId,full_name:payload.full_name,role:$('#eventQuickRole').value||'subject'});
    renderEventChips();
  }
  if(!id&&newId&&reopenDocumentAfterPersonSave){
    documentQuickPeople.push({id:newId,full_name:payload.full_name});
    renderDocumentChips();
  }
  closeModal(); showToast(id?'Pessoa atualizada.':'Pessoa cadastrada.'); await loadPeople(); await loadPeopleOptions(); fillFocusSelect();
  if(reopenRelModeAfterPersonSave){
    const mode=reopenRelModeAfterPersonSave; reopenRelModeAfterPersonSave=null;
    openRelModal(mode);
    if(newId) $('#relPersonSelect').value=labelForId(newId);
  }
}
async function deletePerson(id){
  const person=people.find(p=>p.id===id);
  if(!await confirmDelete(`Excluir "${person?.full_name||'esta pessoa'}"?`,'Histórias, fotos, eventos e relações de parentesco vinculados a esta pessoa também podem ser afetados. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('people').delete().eq('id',id);
  if(error){alert(error.message);return}
  if(person?.avatar_path) await client.storage.from('photos').remove([person.avatar_path]);
  showToast('Pessoa excluída.');
  await loadPeople(); await loadPeopleOptions(); fillFocusSelect();
  await loadTree(currentFocusId===id?(peopleOptions[0]?.id||null):currentFocusId);
}

async function loadPeopleOptions(){
  const {data,error}=await client.from('people').select('id,full_name,birth_date').order('full_name',{ascending:true});
  if(!error) peopleOptions=data||[];
  fillPeopleDatalist();
}
function personLabel(p){return p.full_name+(p.birth_date?` (${p.birth_date.slice(0,4)})`:'')}
function labelForId(id){const p=peopleOptions.find(x=>x.id===id); return p?personLabel(p):''}
function fillPeopleDatalist(excludeId){
  peopleLabelMap=new Map();
  $('#peopleList').innerHTML=peopleOptions.filter(p=>p.id!==excludeId).map(p=>{
    let label=personLabel(p);
    if(peopleLabelMap.has(label)) label=`${label} · ${p.id.slice(0,8)}`;
    peopleLabelMap.set(label,p.id);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join('');
}
function resolvePersonId(inputEl){return peopleLabelMap.get(inputEl.value.trim())||''}
function relLabel(t){return t==='marriage'?'Casamento':t==='union'?'União estável':'Outro'}

async function loadFamilies(){
  const {data,error}=await client.from('family_units').select('id,relationship_type,status,start_date,end_date,notes,family_unit_members(role,person_id,people(id,full_name))').order('created_at',{ascending:false});
  if(error){$('#familiesTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  families=data||[]; $('#familiesCount').textContent=families.length; renderFamilies();
}
function renderFamilies(){
  $('#familiesPagination').innerHTML='';
  const q=$('#searchFamilies').value.trim().toLowerCase();
  const list=q?families.filter(f=>(f.family_unit_members||[]).some(m=>(m.people?.full_name||'').toLowerCase().includes(q))):families;
  if(!list.length){$('#familiesTable').innerHTML=q?'<div class="empty-state small"><div class="empty-icon">♥</div><h4>Nenhuma união encontrada</h4><p>Tente buscar por outro nome.</p></div>':'<div class="empty-state small"><div class="empty-icon">♥</div><h4>Nenhuma união cadastrada</h4><p>Cadastre a primeira união familiar.</p><button class="primary" id="emptyAddFamily">+ Nova união</button></div>';$('#emptyAddFamily')?.addEventListener('click',()=>openFamilyModal());return}
  const pageSize=Number($('#familiesPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(familiesPage>totalPages) familiesPage=totalPages;
  if(familiesPage<1) familiesPage=1;
  const start=(familiesPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#familiesTable').innerHTML='<table><thead><tr><th>União</th><th>Tipo</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(f=>{
    const names=(f.family_unit_members||[]).map(m=>m.people?.full_name).filter(Boolean).join(' & ')||'—';
    return `<tr><td><strong>${escapeHtml(names)}</strong></td><td>${relLabel(f.relationship_type)}</td><td><span class="status">${escapeHtml(f.status)}</span></td><td class="actions"><button data-children="${f.id}">Filhos</button><button data-edit-family="${f.id}">Editar</button><button data-delete-family="${f.id}" class="danger-text">Excluir</button></td></tr>`;
  }).join('')+'</tbody></table>';
  document.querySelectorAll('[data-children]').forEach(b=>b.onclick=()=>openChildrenModal(b.dataset.children));
  document.querySelectorAll('[data-edit-family]').forEach(b=>b.onclick=()=>openFamilyModal(families.find(f=>f.id===b.dataset.editFamily)));
  document.querySelectorAll('[data-delete-family]').forEach(b=>b.onclick=()=>deleteFamily(b.dataset.deleteFamily));
  if(totalPages>1){
    $('#familiesPagination').innerHTML=`<button type="button" class="secondary" id="familiesPrevPage"${familiesPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${familiesPage} de ${totalPages} (${list.length} uniões)</span><button type="button" class="secondary" id="familiesNextPage"${familiesPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#familiesPrevPage')?.addEventListener('click',()=>{familiesPage--; renderFamilies();});
    $('#familiesNextPage')?.addEventListener('click',()=>{familiesPage++; renderFamilies();});
  }
}
function openFamilyModal(family=null){
  $('#familyFormError').textContent='';
  $('#familyId').value=family?.id||'';
  $('#familyFormTitle').textContent=family?'Editar união':'Nova união';
  fillPeopleDatalist();
  const members=family?.family_unit_members||[];
  $('#partnerA').value=members[0]?.person_id?labelForId(members[0].person_id):'';
  $('#partnerB').value=members[1]?.person_id?labelForId(members[1].person_id):'';
  $('#relationshipType').value=family?.relationship_type||'marriage';
  $('#familyStatus').value=family?.status||'published';
  $('#unionStart').value=family?.start_date||'';
  $('#unionEnd').value=family?.end_date||'';
  $('#familyNotes').value=family?.notes||'';
  familyModal.classList.add('open');
}
function closeFamilyModal(){familyModal.classList.remove('open'); fillPeopleDatalist();}
async function saveFamily(e){
  e.preventDefault(); showError($('#familyFormError'),'');
  const id=$('#familyId').value;
  const partnerARaw=$('#partnerA').value.trim(), partnerBRaw=$('#partnerB').value.trim();
  if(!partnerARaw){showError($('#familyFormError'),'Selecione ao menos uma pessoa.');return}
  const partnerA=resolvePersonId($('#partnerA'));
  if(!partnerA){showError($('#familyFormError'),'Pessoa A não encontrada — selecione uma da lista.');return}
  const partnerB=partnerBRaw?resolvePersonId($('#partnerB')):'';
  if(partnerBRaw && !partnerB){showError($('#familyFormError'),'Pessoa B não encontrada — selecione uma da lista.');return}
  if(partnerB && partnerB===partnerA){showError($('#familyFormError'),'Selecione duas pessoas diferentes.');return}
  const payload={relationship_type:$('#relationshipType').value,status:$('#familyStatus').value,start_date:$('#unionStart').value||null,end_date:$('#unionEnd').value||null,notes:$('#familyNotes').value.trim()||null};
  let familyUnitId=id;
  if(id){
    const {error}=await client.from('family_units').update(payload).eq('id',id);
    if(error){showError($('#familyFormError'),error.message);return}
    const {error:delErr}=await client.from('family_unit_members').delete().eq('family_unit_id',id);
    if(delErr){showError($('#familyFormError'),delErr.message);return}
  } else {
    const {data,error}=await client.from('family_units').insert(payload).select('id').single();
    if(error){showError($('#familyFormError'),error.message);return}
    familyUnitId=data.id;
  }
  const members=[{family_unit_id:familyUnitId,person_id:partnerA,role:'partner'}];
  if(partnerB) members.push({family_unit_id:familyUnitId,person_id:partnerB,role:'partner'});
  const {error:memErr}=await client.from('family_unit_members').insert(members);
  if(memErr){showError($('#familyFormError'),memErr.message);return}
  closeFamilyModal(); showToast(id?'União atualizada.':'União cadastrada.'); await loadFamilies(); await loadTree(currentFocusId);
  if(partnerB) await maybeOfferLinkChildren(familyUnitId,partnerA,partnerB);
}
// Quando uma união fica com as duas pessoas e uma delas já tem filho(a) cadastrado(a) em outro
// vínculo, pergunta se quer vincular esse(s) filho(a/s) à pessoa que acabou de entrar na união —
// nunca vincula sozinho, e o que for aceito pode ser desfeito depois em "Filhos" (botão Remover).
async function maybeOfferLinkChildren(familyUnitId,partnerA,partnerB){
  const {data:rels}=await client.from('parent_child_relationships').select('parent_id,child_id,people!parent_child_relationships_child_id_fkey(full_name)').in('parent_id',[partnerA,partnerB]);
  if(!rels||!rels.length) return;
  const byChild=new Map();
  rels.forEach(r=>{
    if(!byChild.has(r.child_id)) byChild.set(r.child_id,{name:r.people?.full_name||'—',parents:new Set()});
    byChild.get(r.child_id).parents.add(r.parent_id);
  });
  const [{data:pA},{data:pB}]=await Promise.all([
    client.from('people').select('full_name').eq('id',partnerA).maybeSingle(),
    client.from('people').select('full_name').eq('id',partnerB).maybeSingle()
  ]);
  const nameA=pA?.full_name||'esta pessoa', nameB=pB?.full_name||'esta pessoa';
  const candidates=[];
  byChild.forEach((info,childId)=>{
    const hasA=info.parents.has(partnerA), hasB=info.parents.has(partnerB);
    if(hasA&&!hasB) candidates.push({childId,childName:info.name,missingParentId:partnerB,missingParentName:nameB,existingParentName:nameA,checked:false});
    else if(hasB&&!hasA) candidates.push({childId,childName:info.name,missingParentId:partnerA,missingParentName:nameA,existingParentName:nameB,checked:false});
  });
  if(!candidates.length) return;
  pendingLinkChildren=candidates; pendingLinkFamilyId=familyUnitId;
  renderLinkChildrenList();
  linkChildrenModal.classList.add('open');
}
function renderLinkChildrenList(){
  $('#linkChildrenError').textContent='';
  $('#linkChildrenList').innerHTML=pendingLinkChildren.length
    ?'<table><thead><tr><th></th><th>Filho(a)</th><th>Já é filho(a) de</th><th>Vincular também a</th></tr></thead><tbody>'+pendingLinkChildren.map((c,i)=>`<tr><td><input type="checkbox" data-link-child="${i}" ${c.checked?'checked':''}></td><td>${escapeHtml(c.childName)}</td><td>${escapeHtml(c.existingParentName)}</td><td>${escapeHtml(c.missingParentName)}</td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nada pra vincular.</p>';
  document.querySelectorAll('[data-link-child]').forEach(cb=>{cb.onchange=()=>{pendingLinkChildren[Number(cb.dataset.linkChild)].checked=cb.checked;};});
}
function closeLinkChildrenModal(){linkChildrenModal.classList.remove('open'); pendingLinkChildren=[]; pendingLinkFamilyId=null;}
async function confirmLinkChildren(){
  const selected=pendingLinkChildren.filter(c=>c.checked);
  if(!selected.length){closeLinkChildrenModal();return}
  const rows=selected.map(c=>({parent_id:c.missingParentId,child_id:c.childId,family_unit_id:pendingLinkFamilyId,relationship_type:'biological',role:'parent'}));
  const {error}=await client.from('parent_child_relationships').insert(rows);
  if(error){showError($('#linkChildrenError'),error.message);return}
  showToast(`${selected.length} vínculo(s) de filiação criado(s). Pode desfazer em "Filhos" se precisar.`);
  closeLinkChildrenModal();
  await loadTree(currentFocusId);
}
async function deleteFamily(id){
  const fam=families.find(f=>f.id===id);
  const famNames=(fam?.family_unit_members||[]).map(m=>m.people?.full_name).filter(Boolean).join(' & ')||'esta união';
  if(!await confirmDelete(`Excluir "${famNames}"?`,'Vínculos de filiação ligados a esta união também serão removidos. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('family_units').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('União excluída.'); await loadFamilies(); await loadTree(currentFocusId);
}

async function openChildrenModal(familyId){
  activeFamilyId=familyId;
  const family=families.find(f=>f.id===familyId);
  const names=(family?.family_unit_members||[]).map(m=>m.people?.full_name).filter(Boolean).join(' & ')||'União';
  $('#childrenFamilyLabel').textContent=names;
  $('#childrenError').textContent='';
  $('#childSelect').value='';
  fillPeopleDatalist();
  await loadChildren();
  childrenModal.classList.add('open');
}
function closeChildrenModal(){childrenModal.classList.remove('open'); fillPeopleDatalist();}
async function loadChildren(){
  const {data,error}=await client.from('parent_child_relationships').select('child_id,people!parent_child_relationships_child_id_fkey(full_name)').eq('family_unit_id',activeFamilyId);
  if(error){$('#childrenList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentChildrenMap=new Map();
  (data||[]).forEach(r=>{if(!currentChildrenMap.has(r.child_id)) currentChildrenMap.set(r.child_id,r.people?.full_name||'—')});
  const entries=[...currentChildrenMap.entries()];
  $('#childrenList').innerHTML=entries.length
    ?'<table><thead><tr><th>Filho(a)</th><th></th></tr></thead><tbody>'+entries.map(([cid,name])=>`<tr><td>${escapeHtml(name)}</td><td class="actions"><button data-remove-child="${cid}" class="danger-text">Remover</button></td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nenhum filho vinculado ainda.</p>';
  document.querySelectorAll('[data-remove-child]').forEach(b=>b.onclick=()=>removeChild(b.dataset.removeChild));
}
async function addChild(){
  $('#childrenError').textContent='';
  const raw=$('#childSelect').value.trim();
  if(!raw){showError($('#childrenError'),'Selecione uma pessoa.');return}
  const childId=resolvePersonId($('#childSelect'));
  if(!childId){showError($('#childrenError'),'Pessoa não encontrada — selecione uma da lista.');return}
  if(currentChildrenMap.has(childId)){showError($('#childrenError'),'Essa pessoa já está vinculada como filho(a) desta união.');return}
  const family=families.find(f=>f.id===activeFamilyId);
  const parents=[...new Set((family?.family_unit_members||[]).map(m=>m.person_id))];
  if(!parents.length){showError($('#childrenError'),'Esta união não tem pessoas vinculadas.');return}
  if(parents.includes(childId)){showError($('#childrenError'),'Essa pessoa já faz parte da união.');return}
  const rows=parents.map(pid=>({parent_id:pid,child_id:childId,family_unit_id:activeFamilyId,relationship_type:'biological',role:'parent'}));
  const {error}=await client.from('parent_child_relationships').insert(rows);
  if(error){showError($('#childrenError'),error.message);return}
  $('#childSelect').value='';
  await loadChildren(); await loadTree(currentFocusId);
}
async function removeChild(childId){
  if(!confirm('Remover este vínculo de filiação?')) return;
  const {error}=await client.from('parent_child_relationships').delete().eq('family_unit_id',activeFamilyId).eq('child_id',childId);
  if(error){alert(error.message);return} await loadChildren(); await loadTree(currentFocusId);
}

function fillFocusSelect(){
  if(currentFocusId && peopleOptions.some(p=>p.id===currentFocusId)) $('#focusPersonSelect').value=labelForId(currentFocusId);
}
function yearsLabel(p){
  const b=p.birth_date?p.birth_date.slice(0,4):null, d=p.death_date?p.death_date.slice(0,4):null;
  if(!b && !d) return '';
  return d?`${b||'?'}–${d}`:`${b} —`;
}
function famAvatarHtml(p){
  const genderCls=p.gender==='male'?'gender-m':p.gender==='female'?'gender-f':'';
  if(p.avatar_path) return `<img class="fam-avatar ${genderCls}" src="${avatarUrl(p.avatar_path)}" alt="">`;
  const initial=(p.full_name||'?').trim().charAt(0).toUpperCase();
  return `<div class="fam-avatar-fallback">${escapeHtml(initial)}</div>`;
}
function famCard(p,opts={}){
  const isFocus=p.id===currentFocusId;
  const bloodAttr=opts.blood?' data-blood="1"':'';
  const spouseAttr=opts.spouse?' data-spouse="1"':'';
  if(isFocus) return `<div class="fam-card focus" data-focus="${p.id}" data-blood="1" aria-current="true">${famAvatarHtml(p)}<div class="tc-name">${escapeHtml(p.full_name)}</div><div class="tc-years">${yearsLabel(p)}</div></div>`;
  return `<button type="button" class="fam-card"${bloodAttr}${spouseAttr} data-focus="${p.id}" aria-label="Ir para ${escapeHtml(p.full_name)}">${famAvatarHtml(p)}<div class="tc-name">${escapeHtml(p.full_name)}</div><div class="tc-years">${yearsLabel(p)}</div></button>`;
}
function famAdd(mode,target,label){
  return `<button type="button" class="fam-add" data-add="${mode}" data-target="${target||''}">+ ${label}</button>`;
}
async function fetchParents(personId){
  if(!personId) return [null,null];
  const {data}=await client.from('parent_child_relationships').select('parent_id,people!parent_child_relationships_parent_id_fkey(id,full_name,birth_date,death_date,avatar_path,gender)').eq('child_id',personId);
  const arr=(data||[]).map(r=>r.people).filter(Boolean);
  return [arr[0]||null,arr[1]||null];
}
async function fetchSiblings(parentIds,excludeId){
  const ids=[...new Set(parentIds.filter(Boolean))];
  if(!ids.length) return [];
  const {data}=await client.from('parent_child_relationships').select('child_id,people!parent_child_relationships_child_id_fkey(id,full_name,birth_date,death_date,avatar_path,gender)').in('parent_id',ids);
  const map=new Map();
  (data||[]).forEach(r=>{if(r.people && r.people.id!==excludeId) map.set(r.people.id,r.people);});
  return [...map.values()];
}
function unlinkBadge(mode,personId,personName,targetId,extra){
  const labels={parent:'de pai/mãe',child:'de filho(a)',spouse:'de cônjuge'};
  return `<button type="button" class="fam-unlink" data-unlink="${mode}" data-unlink-person="${personId}" data-unlink-name="${escapeHtml(personName||'')}" data-unlink-target="${targetId||''}" data-unlink-extra="${extra||''}" aria-label="Desfazer vínculo ${labels[mode]||''} com ${escapeHtml(personName||'esta pessoa')}" title="Desfazer vínculo (não exclui a pessoa)">×</button>`;
}
let expandedUp=new Set(), expandedDown=new Set();
function expandBadge(dir,personId,expanded){
  const label=dir==='up'?'pais':'filhos';
  return `<button type="button" class="fam-expand-badge ${dir}" data-expand="${dir}" data-person="${personId}" aria-label="${expanded?'Ocultar':'Mostrar'} ${label}" aria-expanded="${expanded}">${expanded?'−':'+'}</button>`;
}
async function buildAncestorBranch(person){
  const expanded=expandedUp.has(person.id);
  let parents=null;
  if(expanded){
    const [p0,p1]=await fetchParents(person.id);
    parents=[p0?await buildAncestorBranch(p0):null,p1?await buildAncestorBranch(p1):null];
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
  return {person,expanded,children};
}
function renderAncestorBranchHtml(branch,childOfId){
  const {person,expanded,parents}=branch;
  let above='';
  if(expanded){
    const cells=(parents||[null,null]).map(pb=>pb?`<div class="fam-branch">${renderAncestorBranchHtml(pb,person.id)}</div>`:`<div class="fam-branch"><div class="fam-node">${famAdd('parent',person.id,'Adicionar pai/mãe')}</div></div>`).join('');
    above=`<div class="fam-ancestors">${cells}</div>`;
  }
  const unlink=childOfId?unlinkBadge('parent',person.id,person.full_name,childOfId):'';
  const node=`<div class="fam-node">${famCard(person)}${expandBadge('up',person.id,expanded)}${unlink}</div>`;
  return above+node;
}
function renderSpouseBranchHtml(branch,focusId){
  const {person,expanded,parents}=branch;
  let above='';
  if(expanded){
    const cells=(parents||[null,null]).map(pb=>pb?`<div class="fam-branch">${renderAncestorBranchHtml(pb,person.id)}</div>`:`<div class="fam-branch"><div class="fam-node">${famAdd('parent',person.id,'Adicionar pai/mãe')}</div></div>`).join('');
    above=`<div class="fam-ancestors">${cells}</div>`;
  }
  const node=`<div class="fam-node">${famCard(person,{spouse:true})}${expandBadge('up',person.id,expanded)}${unlinkBadge('spouse',person.id,person.full_name,focusId,person.family_unit_id)}</div>`;
  return above+node;
}
function renderDescendantBranchHtml(branch,parentOfId){
  const {person,expanded,children}=branch;
  const unlink=parentOfId?unlinkBadge('child',person.id,person.full_name,parentOfId):'';
  const node=`<div class="fam-node">${famCard(person)}${expandBadge('down',person.id,expanded)}${unlink}</div>`;
  let below='';
  if(expanded){
    const cells=(children&&children.length)?children.map(cb=>`<div class="fam-branch">${renderDescendantBranchHtml(cb,person.id)}</div>`).join(''):`<div class="fam-branch"><div class="fam-node">${famAdd('child',person.id,'Adicionar filho')}</div></div>`;
    below=`<div class="fam-descendants">${cells}</div>`;
  }
  return node+below;
}
async function renderPedigree(focus,parents,spouses,children,siblings){
  if(!focus){$('#treeView').innerHTML='<p class="hint">Pessoa não encontrada.</p>';return}
  const [p0,p1]=parents;
  const [p0Branch,p1Branch]=await Promise.all([p0?buildAncestorBranch(p0):null,p1?buildAncestorBranch(p1):null]);
  const parentsRow=`<div class="fam-row" id="famParentsRow">
    <div class="fam-branch">${p0Branch?renderAncestorBranchHtml(p0Branch,focus.id):`<div class="fam-node">${famAdd('parent',focus.id,'Adicionar pai/mãe')}</div>`}</div>
    <div class="fam-branch">${p1Branch?renderAncestorBranchHtml(p1Branch,focus.id):`<div class="fam-node">${famAdd('parent',focus.id,'Adicionar pai/mãe')}</div>`}</div>
  </div>`;
  const siblingCards=siblings.map(s=>famCard(s,{blood:true})).join('');
  const spouseBranches=await Promise.all(spouses.map(s=>expandedUp.has(s.id)?buildAncestorBranch(s):Promise.resolve({person:s,expanded:false,parents:null})));
  const spouseCards=spouseBranches.map(sb=>`<div class="fam-branch">${renderSpouseBranchHtml(sb,focus.id)}</div>`).join('');
  const midRow=`<div class="fam-row" id="famMidRow">${siblingCards}${famCard(focus)}${spouseCards}${famAdd('spouse',focus.id,'Adicionar cônjuge')}</div>`;
  const childBranches=await Promise.all(children.map(c=>buildDescendantBranch(c)));
  const childrenRow=`<div class="fam-row" id="famChildrenRow">${childBranches.map(cb=>`<div class="fam-branch">${renderDescendantBranchHtml(cb,focus.id)}</div>`).join('')}${famAdd('child',focus.id,'Adicionar filho')}</div>`;
  $('#treeView').innerHTML=`<svg class="ped-lines" id="pedLines"></svg><div class="fam-tree">${parentsRow}${midRow}${childrenRow}</div>`;
  document.querySelectorAll('[data-focus]').forEach(el=>{
    if(el.dataset.focus===focus.id) return;
    el.addEventListener('click',()=>loadTree(el.dataset.focus));
  });
  document.querySelectorAll('[data-add]').forEach(el=>{
    el.addEventListener('click',()=>openRelModal(el.dataset.add,el.dataset.target));
  });
  document.querySelectorAll('[data-unlink]').forEach(el=>{
    el.addEventListener('click',()=>removeRelationship(el.dataset.unlink,el.dataset.unlinkPerson,el.dataset.unlinkName,el.dataset.unlinkTarget,el.dataset.unlinkExtra));
  });
  document.querySelectorAll('[data-expand]').forEach(el=>{
    el.addEventListener('click',()=>{
      const set=el.dataset.expand==='up'?expandedUp:expandedDown;
      if(set.has(el.dataset.person)) set.delete(el.dataset.person); else set.add(el.dataset.person);
      loadTree(currentFocusId,{keepExpand:true});
    });
  });
  requestAnimationFrame(drawPedLines);
}
function drawPedLines(){
  const svg=$('#pedLines'); const container=$('#treeView');
  const parentsRow=$('#famParentsRow'), midRow=$('#famMidRow'), childrenRow=$('#famChildrenRow');
  if(!svg||!container||!parentsRow||!midRow||!childrenRow) return;
  const rect0=container.getBoundingClientRect(), scale=zoomScale||1;
  const local=el=>{const r=el.getBoundingClientRect(); return {x:(r.left-rect0.left)/scale,y:(r.top-rect0.top)/scale,w:r.width/scale,h:r.height/scale};};
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
    paths+=`<path d="M ${originX} ${topY} V ${midY}" fill="none" stroke="#c7cee0" stroke-width="1.5"/>`;
    paths+=`<path d="M ${Math.min(...botXs,originX)} ${midY} H ${Math.max(...botXs,originX)}" fill="none" stroke="#c7cee0" stroke-width="1.5"/>`;
    bottoms.forEach((b,i)=>{paths+=`<path d="M ${botXs[i]} ${midY} V ${botTopY}" fill="none" stroke="#c7cee0" stroke-width="1.5"/>`;});
  };
  const focusEl=midRow.querySelector('.fam-card.focus');
  const parentTops=[parentsRow.children[0]?.querySelector(':scope > .fam-node'),parentsRow.children[1]?.querySelector(':scope > .fam-node')];
  connectDown(parentTops,[...midRow.querySelectorAll('[data-blood="1"]')]);
  const childTops=[...childrenRow.children].map(b=>b.querySelector(':scope > .fam-node'));
  connectDown([focusEl,...midRow.querySelectorAll('[data-spouse="1"]')],childTops);
  document.querySelectorAll('.fam-ancestors').forEach(anc=>{
    const ownerNode=anc.nextElementSibling;
    if(!ownerNode||!ownerNode.classList.contains('fam-node')) return;
    const tops=[...anc.children].map(b=>b.querySelector(':scope > .fam-node'));
    connectDown(tops,[ownerNode]);
  });
  document.querySelectorAll('.fam-descendants').forEach(desc=>{
    const ownerNode=desc.previousElementSibling;
    if(!ownerNode||!ownerNode.classList.contains('fam-node')) return;
    const tops=[...desc.children].map(b=>b.querySelector(':scope > .fam-node'));
    connectDown([ownerNode],tops);
  });
  svg.setAttribute('width',container.scrollWidth); svg.setAttribute('height',container.scrollHeight);
  svg.innerHTML=paths;
}
async function fetchFamilyUnitsForPerson(personId){
  const {data}=await client.from('family_unit_members').select('family_unit_id').eq('person_id',personId);
  const unitIds=[...new Set((data||[]).map(r=>r.family_unit_id))];
  if(!unitIds.length) return [];
  const {data:members}=await client.from('family_unit_members').select('family_unit_id,person_id,people(full_name)').in('family_unit_id',unitIds);
  const map=new Map();
  (members||[]).forEach(m=>{
    if(!map.has(m.family_unit_id)) map.set(m.family_unit_id,[]);
    map.get(m.family_unit_id).push({id:m.person_id,name:m.people?.full_name||'—'});
  });
  return unitIds.map(id=>{
    const mem=map.get(id)||[];
    return {id, memberIds:mem.map(m=>m.id), label:mem.map(m=>m.name).join(' & ')||'União'};
  });
}
async function openRelModal(mode,targetId){
  relMode=mode;
  relTargetId=(mode==='parent'||mode==='child')?(targetId||currentFocusId):currentFocusId;
  $('#relModalError').textContent='';
  const titles={parent:'Adicionar pai/mãe',child:'Adicionar filho(a)',spouse:'Adicionar cônjuge'};
  $('#relModalTitle').textContent=titles[mode]||'Adicionar';
  $('#relPersonSelect').value='';
  fillPeopleDatalist(relTargetId);
  relTargetFamilyUnits=[];
  $('#relFamilyField').classList.add('hidden'); $('#relFamilySelect').innerHTML='';
  if(mode==='child'){
    relTargetFamilyUnits=await fetchFamilyUnitsForPerson(relTargetId);
    if(relTargetFamilyUnits.length>1){
      $('#relFamilySelect').innerHTML=relTargetFamilyUnits.map(u=>`<option value="${u.id}">${escapeHtml(u.label)}</option>`).join('')+'<option value="">Nenhuma união específica</option>';
      $('#relFamilyField').classList.remove('hidden');
    }
  }
  relModal.classList.add('open');
}
function closeRelModal(){relModal.classList.remove('open'); fillPeopleDatalist();}
async function confirmRel(){
  $('#relModalError').textContent='';
  const raw=$('#relPersonSelect').value.trim();
  if(!raw){showError($('#relModalError'),'Selecione uma pessoa.');return}
  const personId=resolvePersonId($('#relPersonSelect'));
  if(!personId){showError($('#relModalError'),'Pessoa não encontrada — selecione uma da lista.');return}
  let error, newSpouseFamilyUnitId=null;
  if(relMode==='child'){
    let memberIds=[relTargetId], familyUnitId=null;
    if(relTargetFamilyUnits.length>1){
      const chosen=$('#relFamilySelect').value;
      const unit=chosen?relTargetFamilyUnits.find(u=>u.id===chosen):null;
      if(unit){memberIds=unit.memberIds; familyUnitId=unit.id;}
    } else if(relTargetFamilyUnits.length===1){
      memberIds=relTargetFamilyUnits[0].memberIds; familyUnitId=relTargetFamilyUnits[0].id;
    }
    const rows=[...new Set(memberIds)].map(pid=>({parent_id:pid,child_id:personId,family_unit_id:familyUnitId,relationship_type:'biological',role:'parent'}));
    ({error}=await client.from('parent_child_relationships').insert(rows));
  } else if(relMode==='parent'){
    ({error}=await client.from('parent_child_relationships').insert({parent_id:personId,child_id:relTargetId,relationship_type:'biological',role:'parent'}));
  } else if(relMode==='spouse'){
    const {data,error:unitErr}=await client.from('family_units').insert({relationship_type:'marriage',status:'published'}).select('id').single();
    if(unitErr){error=unitErr}
    else{
      ({error}=await client.from('family_unit_members').insert([{family_unit_id:data.id,person_id:currentFocusId,role:'partner'},{family_unit_id:data.id,person_id:personId,role:'partner'}]));
      if(!error) newSpouseFamilyUnitId=data.id;
    }
  }
  if(error){showError($('#relModalError'),error.message);return}
  const spousePartnerA=currentFocusId;
  closeRelModal();
  await loadFamilies();
  await loadTree(currentFocusId);
  // mesma pergunta de "vincular filhos já cadastrados" também quando o cônjuge é adicionado
  // por aqui (atalho + Adicionar cônjuge na árvore), não só pelo formulário de Famílias.
  if(newSpouseFamilyUnitId) await maybeOfferLinkChildren(newSpouseFamilyUnitId,spousePartnerA,personId);
}
async function removeRelationship(mode,personId,personName,targetId,extra){
  const msgs={
    parent:`Desfazer o vínculo de parentesco: ${personName||'esta pessoa'} deixará de aparecer como pai/mãe aqui. O cadastro da pessoa NÃO é excluído — para isso, use a aba Pessoas.`,
    child:`Desfazer o vínculo de parentesco: ${personName||'esta pessoa'} deixará de aparecer como filho(a) aqui. O cadastro da pessoa NÃO é excluído — para isso, use a aba Pessoas.`,
    spouse:`Desfazer a união com ${personName||'esta pessoa'}? Apenas o vínculo de cônjuge é apagado — o cadastro das pessoas NÃO é excluído.`
  };
  if(!confirm(msgs[mode]||'Remover este vínculo?')) return;
  let error;
  if(mode==='parent'){
    ({error}=await client.from('parent_child_relationships').delete().eq('parent_id',personId).eq('child_id',targetId));
  } else if(mode==='child'){
    ({error}=await client.from('parent_child_relationships').delete().eq('parent_id',targetId).eq('child_id',personId));
  } else if(mode==='spouse'){
    if(!extra){showError($('#relModalError'),'');alert('Não foi possível identificar a união.');return}
    await client.from('family_unit_members').delete().eq('family_unit_id',extra);
    ({error}=await client.from('family_units').delete().eq('id',extra));
  }
  if(error){alert(error.message);return}
  await loadFamilies();
  await loadTree(currentFocusId,{keepExpand:true});
}
async function fetchChildren(personId){
  const {data}=await client.from('parent_child_relationships').select('child_id,people!parent_child_relationships_child_id_fkey(id,full_name,birth_date,death_date,avatar_path,gender)').eq('parent_id',personId);
  return (data||[]).map(r=>r.people).filter(Boolean);
}
async function loadTree(personId,opts={}){
  if(!personId){$('#treeView').innerHTML='<div class="empty-state small"><div class="empty-icon">◎</div><h4>Nenhuma pessoa cadastrada</h4><p>Cadastre pessoas para visualizar a árvore.</p></div>';return}
  if(!opts.keepExpand){expandedUp=new Set(); expandedDown=new Set();}
  currentFocusId=personId;
  fillFocusSelect();
  const {data:focus}=await client.from('people').select('id,full_name,birth_date,death_date,avatar_path,gender').eq('id',personId).maybeSingle();
  const [childRes,unitsRes,parents]=await Promise.all([
    client.from('parent_child_relationships').select('child_id,people!parent_child_relationships_child_id_fkey(id,full_name,birth_date,death_date,avatar_path,gender)').eq('parent_id',personId),
    client.from('family_unit_members').select('family_unit_id').eq('person_id',personId),
    fetchParents(personId)
  ]);
  let spouseRows=[];
  const unitIds=(unitsRes.data||[]).map(u=>u.family_unit_id);
  if(unitIds.length){
    const {data}=await client.from('family_unit_members').select('family_unit_id,person_id,people(id,full_name,birth_date,death_date,avatar_path,gender)').in('family_unit_id',unitIds).neq('person_id',personId);
    spouseRows=data||[];
  }
  const siblings=await fetchSiblings([parents[0]?.id,parents[1]?.id],personId);
  const children=(childRes.data||[]).map(r=>r.people).filter(Boolean);
  const spouses=spouseRows.filter(r=>r.people).map(r=>({...r.people,family_unit_id:r.family_unit_id}));
  await renderPedigree(focus,parents,spouses,children,siblings);
}
function initGenealogyView(){
  const id=(currentFocusId && peopleOptions.some(p=>p.id===currentFocusId))?currentFocusId:peopleOptions[0]?.id;
  loadTree(id);
}

let zoomScale=1, panX=0, panY=0, isPanning=false, panOrigin={x:0,y:0}, panStartOffset={x:0,y:0};
function applyZoom(){$('#treeZoomWrap').style.transform=`translate(${panX}px,${panY}px) scale(${zoomScale})`; $('#zoomResetBtn').textContent=Math.round(zoomScale*100)+'%';}
function setZoom(delta){zoomScale=Math.min(1.6,Math.max(0.5,+(zoomScale+delta).toFixed(2))); applyZoom();}
function resetZoom(){zoomScale=1; panX=0; panY=0; applyZoom();}
// Proteção contra tentativas repetidas de login em sequência (bot/força bruta
// batendo direto na API). A defesa de verdade é o rate limit do próprio
// Supabase Auth no servidor — isso aqui só cria fricção no navegador.
let loginFailStreak=0, loginBlockedUntil=0;
async function login(e){
  if(e) e.preventDefault();
  showError($('#loginError'),'');
  const agora=Date.now();
  if(agora<loginBlockedUntil){
    showError($('#loginError'),`Muitas tentativas — aguarde ${Math.ceil((loginBlockedUntil-agora)/1000)}s.`);
    return;
  }
  const email=$('#email').value.trim();
  const password=$('#password').value;
  if(!email || !password){showError($('#loginError'),'Informe e-mail e senha.');return}
  const button=document.querySelector('#loginForm button[type="submit"]');
  button.disabled=true; button.textContent='Entrando...';
  try{
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if(error){
      loginFailStreak++;
      if(loginFailStreak>=3) loginBlockedUntil=Date.now()+Math.min(30000,2000*2**(loginFailStreak-3));
      showError($('#loginError'),`Falha no login: ${error.message}`);return}
    loginFailStreak=0;
    if(!data?.session){showError($('#loginError'),'O Supabase não retornou uma sessão. Verifique o usuário e a configuração do Auth.');return}
    await ensureAdmin();
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    await loadPeople();
    await loadPeopleOptions();
    await loadFamilies();
    await loadStories();
    await loadAcervo();
    initGenealogyView();
  }catch(err){
    showError($('#loginError'),`Erro inesperado: ${err?.message || err}`);
    console.error(err);
  }finally{
    button.disabled=false; button.textContent='Entrar';
  }
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
async function boot(){
  if(window.SUPABASE_PUBLISHABLE_KEY.includes('COLOQUE_AQUI')){showError($('#loginError'),'Configure a chave publishable do Supabase em js/config.js antes de entrar.');return}
  const {data:{session}}=await client.auth.getSession();
  if(session){try{await ensureAdmin();loginView.classList.add('hidden');appView.classList.remove('hidden');await loadPeople();await loadPeopleOptions();await loadFamilies();await loadStories();await loadAcervo();initGenealogyView()}catch(e){showError($('#loginError'),e.message)}}
}
document.addEventListener('DOMContentLoaded',()=>{
  $('#loginForm').addEventListener('submit',login);
  $('#personForm').addEventListener('submit',savePerson);
  $('#givenName').addEventListener('input',updateFullNamePreview);
  $('#surname').addEventListener('input',updateFullNamePreview);
  $('#familyForm').addEventListener('submit',saveFamily);
  $('#storyForm').addEventListener('submit',saveStory);
  $('#bookForm').addEventListener('submit',saveBook);
  $('#chapterForm').addEventListener('submit',saveChapter);
  $('#photoForm').addEventListener('submit',savePhoto);
  $('#albumForm').addEventListener('submit',saveAlbum);
  $('#eventForm').addEventListener('submit',saveEvent);
  $('#documentForm').addEventListener('submit',saveDocument);
  $('#sourceForm').addEventListener('submit',saveSource);
  $('#placeForm').addEventListener('submit',savePlace);
});
$('#newPersonBtn').onclick=()=>openModal();$('#closeModal').onclick=closeModal;$('#cancelForm').onclick=closeModal;$('#refreshPeople').onclick=loadPeople;
$('#personAvatarFile').addEventListener('change',onPersonAvatarChange);
$('#searchPeople').addEventListener('input',()=>loadPeople());$('#logoutBtn').onclick=async()=>{await client.auth.signOut();location.reload()};
$('#peoplePageSize').addEventListener('change',()=>{peoplePage=1; renderPeople();});
$('#newFamilyBtn').onclick=()=>openFamilyModal();$('#closeFamilyModal').onclick=closeFamilyModal;$('#cancelFamilyForm').onclick=closeFamilyModal;$('#refreshFamilies').onclick=loadFamilies;
$('#searchFamilies').addEventListener('input',()=>{familiesPage=1; renderFamilies();});
$('#familiesPageSize').addEventListener('change',()=>{familiesPage=1; renderFamilies();});
$('#closeChildrenModal').onclick=closeChildrenModal;$('#addChildBtn').onclick=addChild;
$('#closeLinkChildrenModal').onclick=closeLinkChildrenModal;$('#linkChildrenSkip').onclick=closeLinkChildrenModal;$('#linkChildrenConfirm').onclick=confirmLinkChildren;
$('#newStoryBtn').onclick=()=>openStoryModal();$('#closeStoryModal').onclick=closeStoryModal;$('#cancelStoryForm').onclick=closeStoryModal;$('#refreshStories').onclick=loadStories;
$('#storyQuickPersonAdd').onclick=addStoryQuickPerson;
$('#storyQuickPerson').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addStoryQuickPerson();}});
$('#storyQuickPhotoAdd').onclick=addStoryQuickPhoto;
$('#storyQuickPhoto').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addStoryQuickPhoto();}});
wireRichTextEditor($('#storyContent'),document.querySelector('#storyForm .rt-toolbar'));
['personBirthPlace','personDeathPlace','storyPlace','photoPlace','albumPlace','eventPlace','documentPlace','sourcePlace'].forEach(id=>{
  const el=$('#'+id); if(el) wirePlaceAutocomplete(el);
});
$('#searchStories').addEventListener('input',()=>{storiesPage=1; renderStories();});$('#filterStoryStatus').addEventListener('change',()=>{storiesPage=1; renderStories();});
$('#storiesPageSize').addEventListener('change',()=>{storiesPage=1; renderStories();});
$('#closeStoryPeopleModal').onclick=closeStoryPeopleModal;$('#addStoryPersonBtn').onclick=addStoryPerson;
$('#newBookBtn').onclick=()=>openBookModal();$('#closeBookModal').onclick=closeBookModal;$('#cancelBookForm').onclick=closeBookModal;$('#refreshBooks').onclick=loadBooks;
$('#searchBooks').addEventListener('input',()=>{booksPage=1; renderBooks();});
$('#booksPageSize').addEventListener('change',()=>{booksPage=1; renderBooks();});
$('#newPhotoBtn').onclick=()=>openPhotoModal();$('#closePhotoModal').onclick=closePhotoModal;$('#cancelPhotoForm').onclick=closePhotoModal;$('#refreshPhotos').onclick=loadPhotos;
$('#searchPhotos').addEventListener('input',()=>{photosPage=1; renderPhotos();});$('#filterPhotoStatus').addEventListener('change',()=>{photosPage=1; renderPhotos();});
$('#photosPageSize').addEventListener('change',()=>{photosPage=1; renderPhotos();});
$('#photoFile').addEventListener('change',onPhotoFileChange);
$('#photoQuickPersonAdd').onclick=addPhotoQuickPerson;
$('#photoQuickStoryAdd').onclick=addPhotoQuickStory;
$('#photoQuickAlbumAdd').onclick=addPhotoQuickAlbum;
$('#photoQuickPerson').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addPhotoQuickPerson();}});
$('#photoQuickStory').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addPhotoQuickStory();}});
$('#photoQuickAlbum').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addPhotoQuickAlbum();}});
$('#newAlbumBtn').onclick=()=>openAlbumModal();$('#closeAlbumModal').onclick=closeAlbumModal;$('#cancelAlbumForm').onclick=closeAlbumModal;$('#refreshAlbums').onclick=loadAlbums;
$('#searchAlbums').addEventListener('input',()=>{albumsPage=1; renderAlbums();});
$('#albumsPageSize').addEventListener('change',()=>{albumsPage=1; renderAlbums();});
$('#newEventBtn').onclick=()=>openEventModal();$('#closeEventModal').onclick=closeEventModal;$('#cancelEventForm').onclick=closeEventModal;$('#refreshEvents').onclick=loadEvents;
$('#eventQuickPersonAdd').onclick=addEventQuickPerson;
$('#eventQuickPerson').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addEventQuickPerson();}});
$('#eventQuickPersonNew').addEventListener('click',(e)=>{e.preventDefault(); reopenEventAfterPersonSave=true; eventModal.classList.remove('open'); openModal();});
$('#eventQuickPhotoNew').addEventListener('click',(e)=>{e.preventDefault(); reopenEventAfterPhotoSave=true; eventModal.classList.remove('open'); openPhotoModal();});
$('#eventQuickPlaceNew').addEventListener('click',(e)=>{e.preventDefault(); openPlaceShortcut(eventModal,'eventPlace');});
$('#eventQuickSourceAdd').onclick=addEventQuickSource;
$('#eventQuickSource').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addEventQuickSource();}});
$('#eventQuickSourceNew').addEventListener('click',(e)=>{e.preventDefault(); reopenEventAfterSourceSave=true; eventModal.classList.remove('open'); openSourceModal();});
$('#eventQuickDocumentAdd').onclick=addEventQuickDocument;
$('#eventQuickDocument').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addEventQuickDocument();}});
$('#sourceQuickPlaceNew').addEventListener('click',(e)=>{e.preventDefault(); openPlaceShortcut(sourceModal,'sourcePlace');});
$('#sourceQuickStoryAdd').onclick=addSourceQuickStory;
$('#sourceQuickStory').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addSourceQuickStory();}});
$('#sourceQuickChapterAdd').onclick=addSourceQuickChapter;
$('#sourceQuickChapter').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addSourceQuickChapter();}});
$('#searchEvents').addEventListener('input',()=>{eventsPage=1; renderEvents();});$('#filterEventType').addEventListener('change',()=>{eventsPage=1; renderEvents();});
$('#eventsPageSize').addEventListener('change',()=>{eventsPage=1; renderEvents();});
$('#newDocumentBtn').onclick=()=>openDocumentModal();$('#closeDocumentModal').onclick=closeDocumentModal;$('#cancelDocumentForm').onclick=closeDocumentModal;$('#refreshDocuments').onclick=loadDocuments;
$('#documentFile').addEventListener('change',onDocumentFileChange);
$('#documentQuickPersonAdd').onclick=addDocumentQuickPerson;
$('#documentQuickPerson').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addDocumentQuickPerson();}});
$('#documentQuickPersonNew').addEventListener('click',(e)=>{e.preventDefault(); reopenDocumentAfterPersonSave=true; documentModal.classList.remove('open'); openModal();});
$('#documentQuickStoryAdd').onclick=addDocumentQuickStory;
$('#documentQuickStory').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addDocumentQuickStory();}});
$('#documentQuickChapterAdd').onclick=addDocumentQuickChapter;
$('#documentQuickChapter').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addDocumentQuickChapter();}});
$('#documentQuickEventAdd').onclick=addDocumentQuickEvent;
$('#documentQuickEvent').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addDocumentQuickEvent();}});
$('#searchDocuments').addEventListener('input',()=>{documentsPage=1; renderDocuments();});$('#filterDocumentType').addEventListener('change',()=>{documentsPage=1; renderDocuments();});
$('#documentsPageSize').addEventListener('change',()=>{documentsPage=1; renderDocuments();});
$('#newSourceBtn').onclick=()=>openSourceModal();$('#closeSourceModal').onclick=closeSourceModal;$('#cancelSourceForm').onclick=closeSourceModal;$('#refreshSources').onclick=loadSources;
$('#searchSources').addEventListener('input',()=>{sourcesPage=1; renderSources();});
$('#sourcesPageSize').addEventListener('change',()=>{sourcesPage=1; renderSources();});
$('#newPlaceBtn').onclick=()=>openPlaceModal();$('#closePlaceModal').onclick=closePlaceModal;$('#cancelPlaceForm').onclick=closePlaceModal;$('#refreshPlaces').onclick=loadPlaces;
$('#searchPlaces').addEventListener('input',()=>{placesPage=1; renderPlaces();});
$('#placesPageSize').addEventListener('change',()=>{placesPage=1; renderPlaces();});
$('#closeChaptersModal').onclick=closeChaptersModal;$('#cancelChapterEdit').onclick=resetChapterForm;
wireRichTextEditor($('#chapterContent'),document.querySelector('#chapterForm .rt-toolbar'));
$('#chapterQuickPhotoAdd').onclick=addChapterQuickPhoto;
$('#chapterQuickPhoto').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addChapterQuickPhoto();}});
$('#chapterQuickPhotoNew').addEventListener('click',(e)=>{e.preventDefault(); reopenChaptersAfterPhotoSave=true; chaptersModal.classList.remove('open'); openPhotoModal();});
$('#chapterQuickSourceAdd').onclick=addChapterQuickSource;
$('#chapterQuickSource').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addChapterQuickSource();}});
$('#chapterQuickSourceNew').addEventListener('click',(e)=>{e.preventDefault(); reopenChaptersAfterSourceSave=true; chaptersModal.classList.remove('open'); openSourceModal();});
$('#storyQuickPersonNew').addEventListener('click',(e)=>{e.preventDefault(); reopenStoryAfterPersonSave=true; storyModal.classList.remove('open'); openModal();});
$('#storyQuickPhotoNew').addEventListener('click',(e)=>{e.preventDefault(); reopenStoryAfterPhotoSave=true; storyModal.classList.remove('open'); openPhotoModal();});
$('#storyQuickSourceAdd').onclick=addStoryQuickSource;
$('#storyQuickSource').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); addStoryQuickSource();}});
$('#storyQuickSourceNew').addEventListener('click',(e)=>{e.preventDefault(); reopenStoryAfterSourceSave=true; storyModal.classList.remove('open'); openSourceModal();});
$('#closePhotoPeopleModal').onclick=closePhotoPeopleModal;$('#addPhotoPersonBtn').onclick=addPhotoPerson;
$('#closeAlbumPhotosModal').onclick=closeAlbumPhotosModal;$('#addAlbumPhotoBtn').onclick=addAlbumPhoto;
$('#closeEventPeopleModal').onclick=closeEventPeopleModal;$('#addEventPersonBtn').onclick=addEventPerson;
$('#focusPersonSelect').addEventListener('input',(e)=>{const id=peopleLabelMap.get(e.target.value.trim()); if(id) loadTree(id);});
$('#closeRelModal').onclick=closeRelModal;$('#cancelRelModal').onclick=closeRelModal;$('#confirmRelBtn').onclick=confirmRel;
$('#relNewPersonLink').addEventListener('click',(e)=>{e.preventDefault(); reopenRelModeAfterPersonSave=relMode; closeRelModal(); openModal();});
$('#zoomInBtn').onclick=()=>setZoom(0.1);$('#zoomOutBtn').onclick=()=>setZoom(-0.1);$('#zoomResetBtn').onclick=()=>resetZoom();
const treeViewport=$('#treeViewport');
// Ctrl/Cmd + roda = zoom; sem Ctrl, a roda rola a página normalmente
// (mesmo padrão do site público).
treeViewport.addEventListener('wheel',(e)=>{
  if(!(e.ctrlKey||e.metaKey)) return;
  e.preventDefault(); setZoom(e.deltaY<0?0.08:-0.08);
},{passive:false});
treeViewport.addEventListener('mousedown',(e)=>{isPanning=true; panOrigin={x:e.clientX,y:e.clientY}; panStartOffset={x:panX,y:panY}; treeViewport.classList.add('panning');});
window.addEventListener('mousemove',(e)=>{if(!isPanning) return; panX=panStartOffset.x+(e.clientX-panOrigin.x); panY=panStartOffset.y+(e.clientY-panOrigin.y); applyZoom();});
window.addEventListener('mouseup',()=>{isPanning=false; treeViewport.classList.remove('panning');});
treeViewport.addEventListener('touchstart',(e)=>{if(e.touches.length!==1) return; const t=e.touches[0]; isPanning=true; panOrigin={x:t.clientX,y:t.clientY}; panStartOffset={x:panX,y:panY}; treeViewport.classList.add('panning');},{passive:true});
treeViewport.addEventListener('touchmove',(e)=>{if(!isPanning||e.touches.length!==1) return; const t=e.touches[0]; panX=panStartOffset.x+(t.clientX-panOrigin.x); panY=panStartOffset.y+(t.clientY-panOrigin.y); applyZoom();},{passive:true});
treeViewport.addEventListener('touchend',()=>{isPanning=false; treeViewport.classList.remove('panning');});

$('#closeConfirmDeleteModal').onclick=()=>resolveConfirmDelete(false);
$('#cancelConfirmDelete').onclick=()=>resolveConfirmDelete(false);
$('#confirmDeleteBtn').onclick=()=>resolveConfirmDelete(true);

/* ---------- Menu mobile ---------- */
const sidebarEl=document.querySelector('.sidebar'), sidebarScrim=$('#sidebarScrim'), mobileMenuBtn=$('#mobileMenuBtn');
function toggleSidebar(open){
  const willOpen=open ?? !sidebarEl.classList.contains('open');
  sidebarEl.classList.toggle('open',willOpen);
  sidebarScrim.classList.toggle('visible',willOpen);
  mobileMenuBtn.setAttribute('aria-expanded',String(willOpen));
}
mobileMenuBtn.addEventListener('click',()=>toggleSidebar());
sidebarScrim.addEventListener('click',()=>toggleSidebar(false));

/* ---------- Menu retrátil (desktop) ---------- */
const navIconMap={dashboard:'DA',pessoas:'PE',familias:'FA',genealogia:'GE',livro:'LI',historias:'HI',fotos:'FO',albuns:'AL',eventos:'EV',documentos:'DO',fontes:'FN',lugares:'LU',configuracoes:'CO'};
document.querySelectorAll('.nav-item').forEach(a=>{
  const id=a.getAttribute('href').slice(1);
  const label=a.textContent;
  a.innerHTML=`<span class="nav-icon">${navIconMap[id]||label.slice(0,2).toUpperCase()}</span><span class="nav-label">${label}</span>`;
  a.title=label;
});
const sidebarCollapseBtn=$('#sidebarCollapseBtn');
function setSidebarCollapsed(collapsed){
  sidebarEl.classList.toggle('collapsed',collapsed);
  sidebarCollapseBtn.setAttribute('aria-expanded',String(!collapsed));
  sidebarCollapseBtn.textContent=collapsed?'›':'‹';
  sidebarCollapseBtn.title=collapsed?'Expandir menu':'Recolher menu';
  sidebarCollapseBtn.setAttribute('aria-label',sidebarCollapseBtn.title);
  try{localStorage.setItem('sidebarCollapsed',collapsed?'1':'0')}catch{}
}
sidebarCollapseBtn.addEventListener('click',()=>setSidebarCollapsed(!sidebarEl.classList.contains('collapsed')));
try{ if(localStorage.getItem('sidebarCollapsed')==='1') setSidebarCollapsed(true); }catch{}

/* ---------- Destaque da seção atual no menu (scroll-spy) ---------- */
const navMap=new Map([...document.querySelectorAll('.nav-item')].map(a=>[a.getAttribute('href').slice(1),a]));
function setActiveNav(id){
  document.querySelectorAll('.nav-item.active').forEach(a=>a.classList.remove('active'));
  navMap.get(id)?.classList.add('active');
}
document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',()=>{toggleSidebar(false); setActiveNav(a.getAttribute('href').slice(1));}));
const sectionSpy=new IntersectionObserver((entries)=>{
  const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
  if(visible.length) setActiveNav(visible[0].target.id);
},{rootMargin:'-10% 0px -75% 0px',threshold:0});
document.querySelectorAll('.panel[id]').forEach(s=>sectionSpy.observe(s));

/* ---------- Aviso de confirmação (toast) ---------- */
let toastTimer=null;
function showToast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

/* ---------- Acessibilidade de modais: foco automático, Tab-trap, Esc, clique fora ---------- */
let lastFocusedBeforeModal=null;
function focusableIn(container){
  return [...container.querySelectorAll('input,select,textarea,button,a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled && el.offsetParent!==null);
}
function initialFocusIn(container){
  const field=container.querySelector('input:not([type="hidden"]):not(.modal-close),select,textarea');
  if(field && !field.disabled && field.offsetParent!==null) return field;
  return focusableIn(container).find(el=>!el.classList.contains('modal-close'))||focusableIn(container)[0];
}
document.querySelectorAll('.modal').forEach(m=>{
  m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
  const h2=m.querySelector('h2');
  if(h2){ if(!h2.id) h2.id=m.id+'Title'; m.setAttribute('aria-labelledby',h2.id); }
  m.querySelector('.modal-close')?.setAttribute('aria-label','Fechar');
  // Clicar fora (no fundo) NÃO fecha o modal — evita perder o cadastro em andamento por engano.
  // O modal só fecha pelo botão × (modal-close) ou por Cancelar.
});
document.addEventListener('keydown',(e)=>{
  const openModal=document.querySelector('.modal.open');
  if(!openModal) return;
  if(e.key==='Escape'){ openModal.querySelector('.modal-close')?.click(); return; }
  if(e.key!=='Tab') return;
  const focusable=focusableIn(openModal.querySelector('.modal-card'));
  if(!focusable.length) return;
  const first=focusable[0], last=focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});
new MutationObserver((mutations)=>{
  for(const mut of mutations){
    const el=mut.target;
    if(!(el instanceof Element) || !el.classList.contains('modal')) continue;
    if(el.classList.contains('open')){
      lastFocusedBeforeModal=document.activeElement;
      const card=el.querySelector('.modal-card');
      (initialFocusIn(card)||card)?.focus();
    } else if(lastFocusedBeforeModal){
      lastFocusedBeforeModal.focus();
      lastFocusedBeforeModal=null;
    }
  }
}).observe(document.body,{attributes:true,attributeFilter:['class'],subtree:true});

/* ---------- Recalcular linhas da árvore ao redimensionar/rotacionar ---------- */
let pedResizeTimer=null;
window.addEventListener('resize',()=>{
  clearTimeout(pedResizeTimer);
  pedResizeTimer=setTimeout(()=>{ if(document.getElementById('pedLines')) drawPedLines(); },150);
});

boot();
window.addEventListener('error', (event) => {
  const el=document.querySelector('#loginError');
  if(el && !el.textContent) el.textContent='Erro de JavaScript: '+(event.message||'verifique o Console do navegador.');
});
window.addEventListener('unhandledrejection', (event) => {
  const el=document.querySelector('#loginError');
  if(el && !el.textContent) el.textContent='Erro: '+(event.reason?.message||event.reason||'falha inesperada');
});

function slugify(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)}
function storyRoleLabel(r){const map={main:'Protagonista',character:'Personagem',mentioned:'Mencionado',witness:'Testemunha',author:'Narrador',other:'Outro'}; return map[r]||(r||'—')}
async function loadStories(){
  const {data,error}=await client.from('stories').select('id,title,slug,summary,content,status,place_id,published_at,updated_at,story_people(role,person_id,people(id,full_name)),story_photos(photo_id,order_index,photos(id,title)),story_sources(source_id,notes,sources(id,title))').order('updated_at',{ascending:false});
  if(error){$('#storiesTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  stories=data||[]; $('#storiesCount').textContent=stories.length;
  fillDatalist('#storiesQuickList',stories,'title',storiesQuickLabelMap);
  renderStories();
}
function renderStories(){
  $('#storiesPagination').innerHTML='';
  const q=$('#searchStories').value.trim().toLowerCase();
  const st=$('#filterStoryStatus').value;
  const list=stories.filter(s=>(!q||(s.title||'').toLowerCase().includes(q))&&(!st||s.status===st));
  if(!list.length){$('#storiesTable').innerHTML=(q||st)?'<div class="empty-state small"><div class="empty-icon">✎</div><h4>Nenhuma história encontrada</h4><p>Ajuste a busca ou o filtro de status.</p></div>':'<div class="empty-state small"><div class="empty-icon">✎</div><h4>Nenhuma história cadastrada</h4><p>Registre o primeiro relato da família.</p><button class="primary" id="emptyAddStory">+ Nova história</button></div>';$('#emptyAddStory')?.addEventListener('click',()=>openStoryModal());return}
  const pageSize=Number($('#storiesPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(storiesPage>totalPages) storiesPage=totalPages;
  if(storiesPage<1) storiesPage=1;
  const start=(storiesPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#storiesTable').innerHTML='<table><thead><tr><th>Título</th><th>Pessoas</th><th>Atualizada</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(s=>{
    const names=(s.story_people||[]).map(m=>m.people?.full_name).filter(Boolean);
    const shown=names.slice(0,2).join(', ')+(names.length>2?` +${names.length-2}`:'');
    return `<tr><td><strong>${escapeHtml(s.title||'—')}</strong>${s.summary?`<br><small>${escapeHtml(s.summary.slice(0,90))}${s.summary.length>90?'…':''}</small>`:''}</td><td>${escapeHtml(shown||'—')}</td><td>${(s.updated_at||'').slice(0,10)||'—'}</td><td><span class="status">${escapeHtml(s.status||'—')}</span></td><td class="actions"><button data-story-people="${s.id}">Pessoas</button><button data-edit-story="${s.id}">Editar</button><button data-delete-story="${s.id}" class="danger-text">Excluir</button></td></tr>`;
  }).join('')+'</tbody></table>';
  document.querySelectorAll('[data-story-people]').forEach(b=>b.onclick=()=>openStoryPeopleModal(b.dataset.storyPeople));
  document.querySelectorAll('[data-edit-story]').forEach(b=>b.onclick=()=>openStoryModal(stories.find(s=>s.id===b.dataset.editStory)));
  document.querySelectorAll('[data-delete-story]').forEach(b=>b.onclick=()=>deleteStory(b.dataset.deleteStory));
  if(totalPages>1){
    $('#storiesPagination').innerHTML=`<button type="button" class="secondary" id="storiesPrevPage"${storiesPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${storiesPage} de ${totalPages} (${list.length} histórias)</span><button type="button" class="secondary" id="storiesNextPage"${storiesPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#storiesPrevPage')?.addEventListener('click',()=>{storiesPage--; renderStories();});
    $('#storiesNextPage')?.addEventListener('click',()=>{storiesPage++; renderStories();});
  }
}
function openStoryModal(story=null){
  $('#storyFormError').textContent='';
  $('#storyId').value=story?.id||'';
  $('#storyFormTitle').textContent=story?'Editar história':'Nova história';
  $('#storyTitle').value=story?.title||'';
  $('#storySlug').value=story?.slug||'';
  $('#storyStatus').value=story?.status||'published';
  $('#storyPlace').value=story?.place_id?labelFromMap(placesLabelMap,story.place_id):'';
  $('#storySummary').value=story?.summary||'';
  $('#storyContent').innerHTML=story?.content||'';
  storyQuickPeople=(story?.story_people||[]).map(sp=>({id:sp.person_id,full_name:sp.people?.full_name||'',role:sp.role}));
  storyQuickPhotos=(story?.story_photos||[]).map(sp=>({id:sp.photo_id,title:sp.photos?.title||''}));
  storyQuickSources=(story?.story_sources||[]).map(ss=>({id:ss.source_id,title:ss.sources?.title||''}));
  $('#storyQuickPerson').value=''; $('#storyQuickRole').value='main'; $('#storyQuickPhoto').value=''; $('#storyQuickSource').value='';
  fillPeopleDatalist();
  renderStoryChips();
  storyModal.classList.add('open');
}
function closeStoryModal(){storyModal.classList.remove('open')}
function renderStoryChips(){
  $('#storyPeopleChips').innerHTML=storyQuickPeople.map(p=>`<span class="chip">${escapeHtml(p.full_name)} · ${escapeHtml(storyRoleLabel(p.role))}<button type="button" data-remove-sqp="${p.id}">×</button></span>`).join('');
  $('#storyPhotoChips').innerHTML=storyQuickPhotos.map(p=>`<span class="chip">${escapeHtml(p.title)}<button type="button" data-remove-sqph="${p.id}">×</button></span>`).join('');
  $('#storySourceChips').innerHTML=storyQuickSources.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-sqs2="${s.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-sqp]').forEach(b=>b.onclick=()=>{storyQuickPeople=storyQuickPeople.filter(p=>p.id!==b.dataset.removeSqp); renderStoryChips();});
  document.querySelectorAll('[data-remove-sqph]').forEach(b=>b.onclick=()=>{storyQuickPhotos=storyQuickPhotos.filter(p=>p.id!==b.dataset.removeSqph); renderStoryChips();});
  document.querySelectorAll('[data-remove-sqs2]').forEach(b=>b.onclick=()=>{storyQuickSources=storyQuickSources.filter(s=>s.id!==b.dataset.removeSqs2); renderStoryChips();});
}
function addStoryQuickSource(){
  const raw=$('#storyQuickSource').value.trim();
  if(!raw) return;
  const id=sourcesQuickLabelMap.get(raw);
  if(!id){showError($('#storyFormError'),'Fonte não encontrada — selecione uma da lista.');return}
  showError($('#storyFormError'),'');
  if(!storyQuickSources.some(s=>s.id===id)){
    storyQuickSources.push({id,title:raw});
    renderStoryChips();
  }
  $('#storyQuickSource').value='';
}
function addStoryQuickPhoto(){
  const raw=$('#storyQuickPhoto').value.trim();
  if(!raw) return;
  const id=photosLabelMap.get(raw);
  if(!id){showError($('#storyFormError'),'Foto não encontrada — selecione uma da lista.');return}
  showError($('#storyFormError'),'');
  if(!storyQuickPhotos.some(p=>p.id===id)){
    storyQuickPhotos.push({id,title:raw});
    renderStoryChips();
  }
  $('#storyQuickPhoto').value='';
}
function addStoryQuickPerson(){
  const raw=$('#storyQuickPerson').value.trim();
  if(!raw) return;
  const id=resolvePersonId($('#storyQuickPerson'));
  if(!id){showError($('#storyFormError'),'Pessoa não encontrada — selecione uma da lista.');return}
  const role=$('#storyQuickRole').value;
  showError($('#storyFormError'),'');
  const already=storyQuickPeople.find(p=>p.id===id);
  if(already){ already.role=role; }
  else { storyQuickPeople.push({id,full_name:peopleOptions.find(p=>p.id===id)?.full_name||labelForId(id),role}); }
  renderStoryChips();
  $('#storyQuickPerson').value='';
}
async function saveStory(e){
  e.preventDefault(); showError($('#storyFormError'),'');
  const id=$('#storyId').value;
  const title=$('#storyTitle').value.trim();
  if(!title){showError($('#storyFormError'),'Informe o título.');return}
  const status=$('#storyStatus').value;
  const slug=slugify($('#storySlug').value.trim()||title);
  if(!slug){showError($('#storyFormError'),'Não foi possível gerar um endereço (slug). Informe um manualmente.');return}
  const existing=id?stories.find(s=>s.id===id):null;
  const placeRaw=$('#storyPlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#storyPlace')):'';
  if(placeRaw&&!placeId){showError($('#storyFormError'),'Local não encontrado — selecione um da lista ou cadastre em Lugares.');return}
  const payload={title,slug,summary:$('#storySummary').value.trim()||null,content:nn(sanitizeRichHtml($('#storyContent').innerHTML)),status,place_id:placeId||null};
  payload.published_at=status==='published'?(existing?.published_at||new Date().toISOString()):null;
  let error, storyId=id;
  if(id){({error}=await client.from('stories').update(payload).eq('id',id));}
  else {const res=await client.from('stories').insert(payload).select('id').single(); error=res.error; storyId=res.data?.id;}
  if(error){showError($('#storyFormError'),error.code==='23505'?'Já existe uma história com esse endereço (slug). Escolha outro.':error.message);return}
  if(storyId){
    const origPeople=new Map((existing?.story_people||[]).map(sp=>[sp.person_id,sp.role]));
    const curPeople=new Map(storyQuickPeople.map(p=>[p.id,p.role]));
    const removePeople=[...origPeople.keys()].filter(pid=>!curPeople.has(pid));
    const addOrChangePeople=[...curPeople.entries()].filter(([pid,role])=>origPeople.get(pid)!==role);
    if(removePeople.length) await client.from('story_people').delete().eq('story_id',storyId).in('person_id',removePeople);
    for(const [pid,role] of addOrChangePeople){
      if(origPeople.has(pid)) await client.from('story_people').update({role}).eq('story_id',storyId).eq('person_id',pid);
      else await client.from('story_people').insert({story_id:storyId,person_id:pid,role});
    }
    const origPhotos=new Set((existing?.story_photos||[]).map(sp=>sp.photo_id));
    const curPhotos=new Set(storyQuickPhotos.map(p=>p.id));
    const removePhotos=[...origPhotos].filter(pid=>!curPhotos.has(pid));
    const addPhotos=storyQuickPhotos.filter(p=>!origPhotos.has(p.id));
    if(removePhotos.length) await client.from('story_photos').delete().eq('story_id',storyId).in('photo_id',removePhotos);
    if(addPhotos.length){
      const maxOrder=Math.max(0,...(existing?.story_photos||[]).map(sp=>sp.order_index||0));
      await client.from('story_photos').insert(addPhotos.map((p,i)=>({story_id:storyId,photo_id:p.id,order_index:maxOrder+1+i})));
    }
    const origSources=new Set((existing?.story_sources||[]).map(ss=>ss.source_id));
    const curSources=new Set(storyQuickSources.map(s=>s.id));
    const removeSources=[...origSources].filter(sid=>!curSources.has(sid));
    const addSources=storyQuickSources.filter(s=>!origSources.has(s.id));
    if(removeSources.length) await client.from('story_sources').delete().eq('story_id',storyId).in('source_id',removeSources);
    if(addSources.length) await client.from('story_sources').insert(addSources.map(s=>({story_id:storyId,source_id:s.id})));
  }
  closeStoryModal(); showToast(id?'História atualizada.':'História cadastrada.'); await loadStories();
}
async function deleteStory(id){
  const story=stories.find(s=>s.id===id);
  if(!await confirmDelete(`Excluir "${story?.title||'esta história'}"?`,'Os vínculos com pessoas também serão removidos. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('stories').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('História excluída.'); await loadStories();
}
async function openStoryPeopleModal(storyId){
  activeStoryId=storyId;
  const story=stories.find(s=>s.id===storyId);
  $('#storyPeopleLabel').textContent=story?.title||'História';
  $('#storyPeopleError').textContent='';
  $('#storyPersonSelect').value='';
  fillPeopleDatalist();
  await loadStoryPeople();
  storyPeopleModal.classList.add('open');
}
function closeStoryPeopleModal(){storyPeopleModal.classList.remove('open'); fillPeopleDatalist();}
async function loadStoryPeople(){
  const {data,error}=await client.from('story_people').select('person_id,role,people(full_name)').eq('story_id',activeStoryId);
  if(error){$('#storyPeopleList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentStoryPeople=data||[];
  $('#storyPeopleList').innerHTML=currentStoryPeople.length
    ?'<table><thead><tr><th>Pessoa</th><th>Papel</th><th></th></tr></thead><tbody>'+currentStoryPeople.map(r=>`<tr><td>${escapeHtml(r.people?.full_name||'—')}</td><td>${escapeHtml(storyRoleLabel(r.role))}</td><td class="actions"><button data-remove-story-person="${r.person_id}" data-role="${escapeHtml(r.role||'')}" class="danger-text">Remover</button></td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nenhuma pessoa vinculada ainda.</p>';
  document.querySelectorAll('[data-remove-story-person]').forEach(b=>b.onclick=()=>removeStoryPerson(b.dataset.removeStoryPerson,b.dataset.role));
}
async function addStoryPerson(){
  $('#storyPeopleError').textContent='';
  const raw=$('#storyPersonSelect').value.trim();
  if(!raw){showError($('#storyPeopleError'),'Selecione uma pessoa.');return}
  const personId=resolvePersonId($('#storyPersonSelect'));
  if(!personId){showError($('#storyPeopleError'),'Pessoa não encontrada — selecione uma da lista.');return}
  const role=$('#storyPersonRole').value;
  if(currentStoryPeople.some(r=>r.person_id===personId&&r.role===role)){showError($('#storyPeopleError'),'Essa pessoa já está vinculada com esse papel.');return}
  const {error}=await client.from('story_people').insert({story_id:activeStoryId,person_id:personId,role});
  if(error){showError($('#storyPeopleError'),error.message);return}
  $('#storyPersonSelect').value='';
  await loadStoryPeople(); await loadStories();
}
async function removeStoryPerson(personId,role){
  if(!confirm('Remover esta pessoa da história?')) return;
  const {error}=await client.from('story_people').delete().eq('story_id',activeStoryId).eq('person_id',personId).eq('role',role);
  if(error){alert(error.message);return} await loadStoryPeople(); await loadStories();
}

/* ===== Acervo: lugares, fotos, álbuns, eventos, documentos, fontes, livro ===== */

function optionLabel(row,nameField){return row[nameField]||'—'}
function fillDatalist(elId,rows,nameField,map){
  map.clear();
  $(elId).innerHTML=rows.map(r=>{
    let label=optionLabel(r,nameField);
    if(map.has(label)) label=`${label} · ${String(r.id).slice(0,8)}`;
    map.set(label,r.id);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join('');
}
function resolveFrom(map,inputEl){return map.get(inputEl.value.trim())||''}
/* ---------- Busca de cidades (Brasil e mundo) via Nominatim/OpenStreetMap ---------- */
let nominatimResultsMap=new Map(), nominatimDebounceTimer=null;
async function searchNominatim(query){
  const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
  try{
    const res=await fetch(url);
    if(!res.ok) return [];
    const data=await res.json();
    return data.map(r=>{
      const a=r.address||{};
      const city=a.city||a.town||a.village||a.municipality||a.county||(r.name||'').split(',')[0]||'';
      const state=a.state||a.region||'';
      const country=a.country||'';
      const label=[city,state,country].filter(Boolean).join(', ');
      return {label,city,state,country,lat:Number(r.lat),lon:Number(r.lon)};
    }).filter(r=>r.city&&r.label);
  }catch{ return []; }
}
function clearNominatimOptions(){
  document.querySelectorAll('#placesList option[data-remote]').forEach(o=>o.remove());
}
function wirePlaceAutocomplete(inputEl){
  inputEl.addEventListener('input',()=>{
    const q=inputEl.value.trim();
    clearTimeout(nominatimDebounceTimer);
    if(q.length<3||placesLabelMap.has(q)){clearNominatimOptions();return}
    nominatimDebounceTimer=setTimeout(async ()=>{
      const results=await searchNominatim(q);
      clearNominatimOptions();
      const datalist=$('#placesList');
      results.forEach(r=>{
        if(placesLabelMap.has(r.label)) return;
        nominatimResultsMap.set(r.label,r);
        const opt=document.createElement('option');
        opt.value=r.label; opt.dataset.remote='1';
        datalist.appendChild(opt);
      });
    },400);
  });
}
async function resolveOrCreatePlace(inputEl){
  const raw=inputEl.value.trim();
  if(!raw) return '';
  const existingId=placesLabelMap.get(raw);
  if(existingId) return existingId;
  const remote=nominatimResultsMap.get(raw);
  if(!remote) return '';
  const payload={name:raw,place_type:'city',city:remote.city||null,state_province:remote.state||null,country:remote.country||null,latitude:Number.isFinite(remote.lat)?remote.lat:null,longitude:Number.isFinite(remote.lon)?remote.lon:null};
  const res=await client.from('places').insert(payload).select('id').single();
  if(res.error||!res.data) return '';
  places.push({...payload,id:res.data.id});
  placesLabelMap.set(raw,res.data.id);
  return res.data.id;
}
function labelFromMap(map,id){for(const [k,v] of map) if(v===id) return k; return ''}
function statusCell(s){return `<span class="status">${escapeHtml(s||'—')}</span>`}
function dateCell(d){return d?String(d).slice(0,10):'—'}
function nn(v){const s=String(v??'').trim(); return s===''?null:s}
function numOrNull(v){const s=String(v??'').trim(); if(s==='') return null; const n=Number(s); return Number.isFinite(n)?n:null}
function pubAt(status,existing){return status==='published'?(existing?.published_at||new Date().toISOString()):null}
function dbErr(el,error){showError(el,error.code==='23505'?'Já existe um registro com esse valor único (ex.: slug). Escolha outro.':error.message)}

/* ---------- Editor de texto simples (negrito/itálico) ---------- */
function sanitizeRichHtml(html){
  const blockAllowed={P:1,BR:1,UL:1,OL:1,LI:1};
  const tmp=document.createElement('div'); tmp.innerHTML=html||'';
  const styleAttr=el=>(el.getAttribute&&el.getAttribute('style')||'').toLowerCase();
  function isBold(el){
    const s=styleAttr(el);
    if(/(?:^|;)\s*(?:mso-bidi-)?font-weight\s*:\s*(normal|[1-5]00)\b/.test(s)) return false;
    if(el.tagName==='B'||el.tagName==='STRONG') return true;
    return /(?:^|;)\s*(?:mso-bidi-)?font-weight\s*:\s*(bold|bolder|[6-9]00)\b/.test(s);
  }
  function isItalic(el){
    const s=styleAttr(el);
    if(/(?:^|;)\s*(?:mso-bidi-)?font-style\s*:\s*normal\b/.test(s)) return false;
    if(el.tagName==='I'||el.tagName==='EM') return true;
    return /(?:^|;)\s*(?:mso-bidi-)?font-style\s*:\s*(italic|oblique)\b/.test(s);
  }
  function clean(node){
    [...node.childNodes].forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE) return;
      if(child.nodeType!==Node.ELEMENT_NODE){ child.remove(); return; }
      const bold=isBold(child), italic=isItalic(child);
      clean(child);
      if(blockAllowed[child.tagName]){
        [...child.attributes].forEach(a=>child.removeAttribute(a.name));
        return;
      }
      if(bold||italic){
        const inner=document.createElement(bold?'b':'i');
        while(child.firstChild) inner.appendChild(child.firstChild);
        if(bold&&italic){const em=document.createElement('i'); while(inner.firstChild) em.appendChild(inner.firstChild); inner.appendChild(em);}
        child.replaceWith(inner);
        return;
      }
      while(child.firstChild) node.insertBefore(child.firstChild,child);
      child.remove();
    });
  }
  clean(tmp);
  return tmp.innerHTML;
}
function wireRichTextEditor(el,toolbarEl){
  toolbarEl.querySelectorAll('[data-cmd]').forEach(btn=>{
    btn.addEventListener('mousedown',e=>e.preventDefault());
    btn.addEventListener('click',()=>{el.focus(); document.execCommand(btn.dataset.cmd,false,null);});
  });
  el.addEventListener('paste',e=>{
    e.preventDefault();
    const html=e.clipboardData?.getData('text/html');
    const text=e.clipboardData?.getData('text/plain')||'';
    const insert=html?sanitizeRichHtml(html):escapeHtml(text).replace(/\n/g,'<br>');
    document.execCommand('insertHTML',false,insert);
  });
}

/* ---------- Lugares ---------- */
async function loadPlaces(){
  const {data,error}=await client.from('places').select('id,name,description,place_type,city,country,latitude,longitude,updated_at').order('name',{ascending:true});
  if(error){$('#placesTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  places=data||[]; $('#placesCount').textContent=places.length; fillDatalist('#placesList',places,'name',placesLabelMap); renderPlaces();
}
function placeTypeLabel(t){return ({city:'Cidade',church:'Igreja',cemetery:'Cemitério',farm:'Fazenda/sítio',address:'Endereço',other:'Outro'})[t]||t||'—'}
function renderPlaces(){
  $('#placesPagination').innerHTML='';
  const q=$('#searchPlaces').value.trim().toLowerCase();
  const list=q?places.filter(p=>(p.name||'').toLowerCase().includes(q)):places;
  if(!list.length){$('#placesTable').innerHTML=q?'<div class="empty-state small"><div class="empty-icon">◍</div><h4>Nenhum lugar encontrado</h4><p>Tente buscar por outro nome.</p></div>':'<div class="empty-state small"><div class="empty-icon">◍</div><h4>Nenhum lugar cadastrado</h4><p>Cadastre cidades e locais para usar em fotos e eventos.</p><button class="primary" id="emptyAddPlace">+ Novo lugar</button></div>';$('#emptyAddPlace')?.addEventListener('click',()=>openPlaceModal());return}
  const pageSize=Number($('#placesPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(placesPage>totalPages) placesPage=totalPages;
  if(placesPage<1) placesPage=1;
  const start=(placesPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#placesTable').innerHTML='<table><thead><tr><th>Nome</th><th>Tipo</th><th>Cidade</th><th>País</th><th></th></tr></thead><tbody>'+pageItems.map(p=>`<tr><td><strong>${escapeHtml(p.name||'—')}</strong></td><td>${escapeHtml(placeTypeLabel(p.place_type))}</td><td>${escapeHtml(p.city||'—')}</td><td>${escapeHtml(p.country||'—')}</td><td class="actions"><button data-edit-place="${p.id}">Editar</button><button data-delete-place="${p.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-edit-place]').forEach(b=>b.onclick=()=>openPlaceModal(places.find(p=>p.id===b.dataset.editPlace)));
  document.querySelectorAll('[data-delete-place]').forEach(b=>b.onclick=()=>deletePlace(b.dataset.deletePlace));
  if(totalPages>1){
    $('#placesPagination').innerHTML=`<button type="button" class="secondary" id="placesPrevPage"${placesPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${placesPage} de ${totalPages} (${list.length} lugares)</span><button type="button" class="secondary" id="placesNextPage"${placesPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#placesPrevPage')?.addEventListener('click',()=>{placesPage--; renderPlaces();});
    $('#placesNextPage')?.addEventListener('click',()=>{placesPage++; renderPlaces();});
  }
}
function openPlaceModal(place=null){
  $('#placeFormError').textContent='';
  $('#placeId').value=place?.id||'';
  $('#placeFormTitle').textContent=place?'Editar lugar':'Novo lugar';
  $('#placeName').value=place?.name||'';
  $('#placeType').value=place?.place_type||'city';
  $('#placeCity').value=place?.city||'';
  $('#placeCountry').value=place?.country||'';
  $('#placeLat').value=place?.latitude??'';
  $('#placeLng').value=place?.longitude??'';
  $('#placeDescription').value=place?.description||'';
  placeModal.classList.add('open');
}
function closePlaceModal(){
  placeModal.classList.remove('open');
  if(placeShortcutTarget){
    const target=placeShortcutTarget; placeShortcutTarget=null;
    target.modal.classList.add('open');
  }
}
function openPlaceShortcut(modalEl,inputId){
  placeShortcutTarget={modal:modalEl,inputId};
  modalEl.classList.remove('open');
  openPlaceModal();
}
async function savePlace(e){
  e.preventDefault(); showError($('#placeFormError'),'');
  const id=$('#placeId').value;
  const name=$('#placeName').value.trim();
  if(!name){showError($('#placeFormError'),'Informe o nome do lugar.');return}
  const payload={name,place_type:$('#placeType').value,city:nn($('#placeCity').value),country:nn($('#placeCountry').value),latitude:numOrNull($('#placeLat').value),longitude:numOrNull($('#placeLng').value),description:nn($('#placeDescription').value)};
  let error, newPlaceId=null;
  if(id){({error}=await client.from('places').update(payload).eq('id',id));}
  else {const res=await client.from('places').insert(payload).select('id').single(); error=res.error; newPlaceId=res.data?.id;}
  if(error){dbErr($('#placeFormError'),error);return}
  if(!id&&newPlaceId&&placeShortcutTarget){
    $('#'+placeShortcutTarget.inputId).value=name;
    placesLabelMap.set(name,newPlaceId);
    places.push({...payload,id:newPlaceId});
  }
  closePlaceModal(); showToast(id?'Lugar atualizado.':'Lugar cadastrado.'); await loadPlaces();
}
async function deletePlace(id){
  const place=places.find(p=>p.id===id);
  if(!await confirmDelete(`Excluir "${place?.name||'este lugar'}"?`,'Registros que o referenciam (fotos, eventos, documentos) podem ser afetados. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('places').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Lugar excluído.'); await loadPlaces();
}

/* ---------- Fotos ---------- */
let pendingPhotoUpload=null;
function photoPublicUrl(path){return path?client.storage.from('photos').getPublicUrl(path).data.publicUrl:''}
function documentPublicUrl(path){return path?client.storage.from('documents').getPublicUrl(path).data.publicUrl:''}
// Limites de upload — fotos/avatares são recomprimidos em webp de qualquer forma,
// mas um arquivo-origem gigante ainda trava o navegador ao decodificar; PDFs não
// passam por nenhuma compressão, então o teto vale pro arquivo final também.
const MAX_IMAGE_SOURCE_BYTES=25*1024*1024, MAX_DOCUMENT_BYTES=20*1024*1024;
function humanSize(bytes){return (bytes/1024/1024).toFixed(0)+'MB'}
async function looksLikePdf(file){
  const bytes=new Uint8Array(await file.slice(0,5).arrayBuffer());
  return String.fromCharCode(...bytes)==='%PDF-';
}
function scaledSize(w,h,max){if(w<=max&&h<=max) return {w,h}; const scale=w>h?max/w:max/h; return {w:Math.round(w*scale),h:Math.round(h*scale)}}
function drawToBlob(bitmap,maxDim,quality){
  const {w,h}=scaledSize(bitmap.width,bitmap.height,maxDim);
  const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h;
  canvas.getContext('2d').drawImage(bitmap,0,0,w,h);
  return new Promise(resolve=>canvas.toBlob(blob=>resolve({blob,w,h}),'image/webp',quality));
}
async function processImageFile(file){
  const bitmap=await createImageBitmap(file);
  const opt=await drawToBlob(bitmap,1600,0.82);
  const thumb=await drawToBlob(bitmap,400,0.75);
  bitmap.close?.();
  return {optimizedBlob:opt.blob,thumbBlob:thumb.blob,width:opt.w,height:opt.h};
}
async function loadPhotos(){
  const {data,error}=await client.from('photos').select('id,title,caption,description,status,hide_from_gallery,place_id,optimized_path,thumbnail_path,mime_type,width,height,file_size_bytes,photo_date,updated_at,photo_people(role,person_id,people(id,full_name)),story_photos(story_id,order_index,stories(id,title)),album_photos(album_id,order_index,albums(id,title))').order('updated_at',{ascending:false});
  if(error){$('#photosTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  photos=data||[]; $('#photosCount').textContent=photos.length;
  fillDatalist('#photosList',photos,'title',photosLabelMap); renderPhotos();
}
function renderPhotos(){
  $('#photosPagination').innerHTML='';
  const q=$('#searchPhotos').value.trim().toLowerCase();
  const st=$('#filterPhotoStatus').value;
  const list=photos.filter(p=>(!q||(p.title||'').toLowerCase().includes(q))&&(!st||p.status===st));
  if(!list.length){$('#photosTable').innerHTML=(q||st)?'<div class="empty-state small"><div class="empty-icon">▣</div><h4>Nenhuma foto encontrada</h4><p>Ajuste a busca ou o filtro.</p></div>':'<div class="empty-state small"><div class="empty-icon">▣</div><h4>Nenhuma foto cadastrada</h4><p>Cadastre a primeira foto do acervo.</p><button class="primary" id="emptyAddPhoto">+ Nova foto</button></div>';$('#emptyAddPhoto')?.addEventListener('click',()=>openPhotoModal());return}
  const pageSize=Number($('#photosPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(photosPage>totalPages) photosPage=totalPages;
  if(photosPage<1) photosPage=1;
  const start=(photosPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#photosTable').innerHTML='<table><thead><tr><th>Foto</th><th>Pessoas</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(p=>{
    const names=(p.photo_people||[]).map(m=>m.people?.full_name).filter(Boolean);
    const shown=names.slice(0,2).join(', ')+(names.length>2?` +${names.length-2}`:'');
    const thumb=p.thumbnail_path?`<img src="${photoPublicUrl(p.thumbnail_path)}" alt="">`:'<div class="thumb-empty"></div>';
    return `<tr><td><div class="thumb-cell">${thumb}<div><strong>${escapeHtml(p.title||'—')}</strong>${p.caption?`<br><small>${escapeHtml(p.caption.slice(0,80))}</small>`:''}</div></div></td><td>${escapeHtml(shown||'—')}</td><td>${dateCell(p.photo_date)}</td><td>${statusCell(p.status)}${p.hide_from_gallery?' <span class="status" title="Não aparece no carrossel da Galeria pública">oculta da galeria</span>':''}</td><td class="actions"><button data-photo-people="${p.id}">Pessoas</button><button data-edit-photo="${p.id}">Editar</button><button data-delete-photo="${p.id}" class="danger-text">Excluir</button></td></tr>`;
  }).join('')+'</tbody></table>';
  document.querySelectorAll('[data-photo-people]').forEach(b=>b.onclick=()=>openPhotoPeopleModal(b.dataset.photoPeople));
  document.querySelectorAll('[data-edit-photo]').forEach(b=>b.onclick=()=>openPhotoModal(photos.find(p=>p.id===b.dataset.editPhoto)));
  document.querySelectorAll('[data-delete-photo]').forEach(b=>b.onclick=()=>deletePhoto(b.dataset.deletePhoto));
  if(totalPages>1){
    $('#photosPagination').innerHTML=`<button type="button" class="secondary" id="photosPrevPage"${photosPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${photosPage} de ${totalPages} (${list.length} fotos)</span><button type="button" class="secondary" id="photosNextPage"${photosPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#photosPrevPage')?.addEventListener('click',()=>{photosPage--; renderPhotos();});
    $('#photosNextPage')?.addEventListener('click',()=>{photosPage++; renderPhotos();});
  }
}
function openPhotoModal(photo=null){
  $('#photoFormError').textContent='';
  $('#photoId').value=photo?.id||'';
  $('#photoFormTitle').textContent=photo?'Editar foto':'Nova foto';
  $('#photoTitle').value=photo?.title||'';
  $('#photoDate').value=photo?.photo_date||'';
  $('#photoPlace').value=photo?.place_id?labelFromMap(placesLabelMap,photo.place_id):'';
  $('#photoStatus').value=photo?.status||'published';
  $('#photoCaption').value=photo?.caption||'';
  $('#photoDescription').value=photo?.description||'';
  $('#photoHideFromGallery').checked=photo?.hide_from_gallery||false;
  pendingPhotoUpload=null; $('#photoFile').value='';
  $('#photoPreview').innerHTML=photo?.thumbnail_path?`<img src="${photoPublicUrl(photo.thumbnail_path)}" alt="">`:'';
  $('#photoUploadHint').textContent=photo?'Selecione uma imagem só se quiser substituir a atual.':'Selecione uma imagem — ela será otimizada e uma miniatura será gerada automaticamente no navegador.';
  photoQuickPeople=(photo?.photo_people||[]).map(pp=>({id:pp.person_id,full_name:pp.people?.full_name||''}));
  photoQuickStories=(photo?.story_photos||[]).map(sp=>({id:sp.story_id,title:sp.stories?.title||''}));
  photoQuickAlbums=(photo?.album_photos||[]).map(ap=>({id:ap.album_id,title:ap.albums?.title||''}));
  $('#photoQuickPerson').value=''; $('#photoQuickStory').value=''; $('#photoQuickAlbum').value='';
  renderPhotoChips();
  photoModal.classList.add('open');
}
function closePhotoModal(){
  photoModal.classList.remove('open');
  if(reopenChaptersAfterPhotoSave){reopenChaptersAfterPhotoSave=false; chaptersModal.classList.add('open');}
  if(reopenStoryAfterPhotoSave){reopenStoryAfterPhotoSave=false; storyModal.classList.add('open');}
  if(reopenEventAfterPhotoSave){reopenEventAfterPhotoSave=false; eventModal.classList.add('open');}
}
function renderPhotoChips(){
  $('#photoPeopleChips').innerHTML=photoQuickPeople.map(p=>`<span class="chip">${escapeHtml(p.full_name)}<button type="button" data-remove-qp="${p.id}">×</button></span>`).join('');
  $('#photoStoryChips').innerHTML=photoQuickStories.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-qs="${s.id}">×</button></span>`).join('');
  $('#photoAlbumChips').innerHTML=photoQuickAlbums.map(a=>`<span class="chip">${escapeHtml(a.title)}<button type="button" data-remove-qa="${a.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-qp]').forEach(b=>b.onclick=()=>{photoQuickPeople=photoQuickPeople.filter(p=>p.id!==b.dataset.removeQp); renderPhotoChips();});
  document.querySelectorAll('[data-remove-qs]').forEach(b=>b.onclick=()=>{photoQuickStories=photoQuickStories.filter(s=>s.id!==b.dataset.removeQs); renderPhotoChips();});
  document.querySelectorAll('[data-remove-qa]').forEach(b=>b.onclick=()=>{photoQuickAlbums=photoQuickAlbums.filter(a=>a.id!==b.dataset.removeQa); renderPhotoChips();});
}
function addPhotoQuickPerson(){
  const raw=$('#photoQuickPerson').value.trim();
  if(!raw) return;
  const id=resolvePersonId($('#photoQuickPerson'));
  if(!id){showError($('#photoFormError'),'Pessoa não encontrada — selecione uma da lista.');return}
  showError($('#photoFormError'),'');
  if(!photoQuickPeople.some(p=>p.id===id)){
    photoQuickPeople.push({id,full_name:peopleOptions.find(p=>p.id===id)?.full_name||labelForId(id)});
    renderPhotoChips();
  }
  $('#photoQuickPerson').value='';
}
function addPhotoQuickStory(){
  const raw=$('#photoQuickStory').value.trim();
  if(!raw) return;
  const id=storiesQuickLabelMap.get(raw);
  if(!id){showError($('#photoFormError'),'História não encontrada — selecione uma da lista.');return}
  showError($('#photoFormError'),'');
  if(!photoQuickStories.some(s=>s.id===id)){
    photoQuickStories.push({id,title:raw});
    renderPhotoChips();
  }
  $('#photoQuickStory').value='';
}
function addPhotoQuickAlbum(){
  const raw=$('#photoQuickAlbum').value.trim();
  if(!raw) return;
  const id=albumsQuickLabelMap.get(raw);
  if(!id){showError($('#photoFormError'),'Álbum não encontrado — selecione um da lista ou cadastre em Álbuns.');return}
  showError($('#photoFormError'),'');
  if(!photoQuickAlbums.some(a=>a.id===id)){
    photoQuickAlbums.push({id,title:raw});
    renderPhotoChips();
  }
  $('#photoQuickAlbum').value='';
}
async function onPhotoFileChange(e){
  const file=e.target.files[0];
  if(!file) return;
  pendingPhotoUpload=null;
  if(file.size>MAX_IMAGE_SOURCE_BYTES){
    $('#photoUploadHint').textContent=`Arquivo muito grande (máx. ${humanSize(MAX_IMAGE_SOURCE_BYTES)}).`;
    e.target.value=''; return;
  }
  $('#photoUploadHint').textContent='Processando imagem...';
  try{
    const result=await processImageFile(file);
    pendingPhotoUpload=result;
    $('#photoPreview').innerHTML=`<img src="${URL.createObjectURL(result.optimizedBlob)}" alt="">`;
    $('#photoUploadHint').textContent=`Pronto: ${result.width}×${result.height}px, ${(result.optimizedBlob.size/1024).toFixed(0)} KB otimizada + miniatura.`;
  }catch(err){
    $('#photoUploadHint').textContent='Erro ao processar imagem: '+err.message;
  }
}
async function savePhoto(e){
  e.preventDefault(); showError($('#photoFormError'),'');
  const id=$('#photoId').value;
  const title=$('#photoTitle').value.trim();
  if(!title){showError($('#photoFormError'),'Informe o título da foto.');return}
  if(!id && !pendingPhotoUpload){showError($('#photoFormError'),'Selecione uma imagem.');return}
  // Se a pessoa digitou uma coleção mas esqueceu de clicar em "Adicionar", resolve automaticamente antes de validar.
  const pendingAlbumRaw=$('#photoQuickAlbum').value.trim();
  if(pendingAlbumRaw){
    const pendingAlbumId=albumsQuickLabelMap.get(pendingAlbumRaw);
    if(pendingAlbumId){
      if(!photoQuickAlbums.some(a=>a.id===pendingAlbumId)) photoQuickAlbums.push({id:pendingAlbumId,title:pendingAlbumRaw});
      $('#photoQuickAlbum').value=''; renderPhotoChips();
    } else if(!photoQuickAlbums.length){
      showError($('#photoFormError'),'Coleção "'+pendingAlbumRaw+'" não encontrada — selecione uma da lista ou clique em Adicionar.');
      return;
    }
  }
  if(!photoQuickAlbums.length){showError($('#photoFormError'),'A foto precisa pertencer a pelo menos uma coleção. Digite o nome do álbum no campo "Coleção" e clique em Adicionar.');return}
  const placeRaw=$('#photoPlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#photoPlace')):'';
  if(placeRaw&&!placeId){showError($('#photoFormError'),'Lugar não encontrado — selecione um da lista ou cadastre em Lugares.');return}
  const payload={title,caption:nn($('#photoCaption').value),description:nn($('#photoDescription').value),status:$('#photoStatus').value,photo_date:nn($('#photoDate').value),place_id:placeId||null,hide_from_gallery:$('#photoHideFromGallery').checked};
  const existing=id?photos.find(p=>p.id===id):null;
  let oldPaths=null;
  if(pendingPhotoUpload){
    const uid=crypto.randomUUID();
    const optPath=`optimized/${uid}.webp`, thumbPath=`thumbnails/${uid}.webp`;
    const up1=await client.storage.from('photos').upload(optPath,pendingPhotoUpload.optimizedBlob,{contentType:'image/webp'});
    if(up1.error){showError($('#photoFormError'),'Falha no upload: '+up1.error.message);return}
    const up2=await client.storage.from('photos').upload(thumbPath,pendingPhotoUpload.thumbBlob,{contentType:'image/webp'});
    if(up2.error){showError($('#photoFormError'),'Falha no upload da miniatura: '+up2.error.message);return}
    payload.optimized_path=optPath; payload.thumbnail_path=thumbPath; payload.mime_type='image/webp';
    payload.width=pendingPhotoUpload.width; payload.height=pendingPhotoUpload.height;
    payload.file_size_bytes=pendingPhotoUpload.optimizedBlob.size;
    if(existing) oldPaths={optimized:existing.optimized_path,thumbnail:existing.thumbnail_path};
  }
  let error, photoId=id;
  if(id){({error}=await client.from('photos').update(payload).eq('id',id));}
  else {const res=await client.from('photos').insert(payload).select('id').single(); error=res.error; photoId=res.data?.id;}
  if(error){dbErr($('#photoFormError'),error);return}
  if(oldPaths&&(oldPaths.optimized||oldPaths.thumbnail)){
    await client.storage.from('photos').remove([oldPaths.optimized,oldPaths.thumbnail].filter(Boolean));
  }
  if(photoId){
    const origPeople=new Set((existing?.photo_people||[]).map(pp=>pp.person_id));
    const curPeople=new Set(photoQuickPeople.map(p=>p.id));
    const removePeople=[...origPeople].filter(pid=>!curPeople.has(pid));
    const addPeople=photoQuickPeople.filter(p=>!origPeople.has(p.id));
    if(removePeople.length) await client.from('photo_people').delete().eq('photo_id',photoId).in('person_id',removePeople);
    if(addPeople.length) await client.from('photo_people').insert(addPeople.map(p=>({photo_id:photoId,person_id:p.id,role:'subject'})));
    const origStories=new Set((existing?.story_photos||[]).map(sp=>sp.story_id));
    const curStories=new Set(photoQuickStories.map(s=>s.id));
    const removeStories=[...origStories].filter(sid=>!curStories.has(sid));
    const addStories=photoQuickStories.filter(s=>!origStories.has(s.id));
    if(removeStories.length) await client.from('story_photos').delete().eq('photo_id',photoId).in('story_id',removeStories);
    if(addStories.length){
      // order_index é único por HISTÓRIA (story_id, order_index) — o "próximo número" tem que vir
      // da própria história de destino, não da lista de histórias que esta foto já tinha. Senão dá
      // choque de chave duplicada quando a história de destino já tem outras fotos na mesma posição.
      for(const s of addStories){
        const {data:mx}=await client.from('story_photos').select('order_index').eq('story_id',s.id).order('order_index',{ascending:false}).limit(1);
        const nextOrder=(mx?.[0]?.order_index||0)+1;
        const {error:insErr}=await client.from('story_photos').insert({photo_id:photoId,story_id:s.id,order_index:nextOrder});
        if(insErr){showError($('#photoFormError'),`Falha ao vincular à história "${s.title}": ${insErr.message}`);return}
      }
    }
    const origAlbums=new Set((existing?.album_photos||[]).map(ap=>ap.album_id));
    const curAlbums=new Set(photoQuickAlbums.map(a=>a.id));
    const removeAlbums=[...origAlbums].filter(aid=>!curAlbums.has(aid));
    const addAlbums=photoQuickAlbums.filter(a=>!origAlbums.has(a.id));
    if(removeAlbums.length) await client.from('album_photos').delete().eq('photo_id',photoId).in('album_id',removeAlbums);
    if(addAlbums.length){
      // mesma lógica: order_index é único por COLEÇÃO (album_id, order_index), tem que consultar
      // o máximo da coleção de destino, não da lista de coleções que esta foto já tinha.
      for(const a of addAlbums){
        const {data:mx}=await client.from('album_photos').select('order_index').eq('album_id',a.id).order('order_index',{ascending:false}).limit(1);
        const nextOrder=(mx?.[0]?.order_index||0)+1;
        const {error:insErr}=await client.from('album_photos').insert({photo_id:photoId,album_id:a.id,order_index:nextOrder});
        if(insErr){showError($('#photoFormError'),`Falha ao vincular à coleção "${a.title}": ${insErr.message}`);return}
      }
    }
  }
  if(!id&&photoId&&reopenChaptersAfterPhotoSave){
    chapterQuickPhotos.push({id:photoId,title});
    renderChapterPhotoChips();
  }
  if(!id&&photoId&&reopenStoryAfterPhotoSave){
    storyQuickPhotos.push({id:photoId,title});
    renderStoryChips();
  }
  if(!id&&photoId&&reopenEventAfterPhotoSave){
    $('#eventPhotoSelect').value=title;
  }
  closePhotoModal(); showToast(id?'Foto atualizada.':'Foto cadastrada.'); await loadPhotos();
}
async function deletePhoto(id){
  const photo=photos.find(p=>p.id===id);
  if(!await confirmDelete(`Excluir "${photo?.title||'esta foto'}"?`,'A imagem otimizada e a miniatura também serão apagadas do armazenamento. Os vínculos com álbuns e pessoas serão removidos. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('photos').delete().eq('id',id);
  if(error){alert(error.message);return}
  if(photo){await client.storage.from('photos').remove([photo.optimized_path,photo.thumbnail_path].filter(Boolean));}
  showToast('Foto excluída.'); await loadPhotos();
}
async function openPhotoPeopleModal(photoId){
  activePhotoId=photoId;
  $('#photoPeopleLabel').textContent=photos.find(p=>p.id===photoId)?.title||'Foto';
  $('#photoPeopleError').textContent=''; $('#photoPersonSelect').value='';
  fillPeopleDatalist();
  await loadPhotoPeople();
  photoPeopleModal.classList.add('open');
}
function closePhotoPeopleModal(){photoPeopleModal.classList.remove('open'); fillPeopleDatalist();}
function photoRoleLabel(r){return ({subject:'Retratado',photographer:'Fotógrafo',mentioned:'Mencionado'})[r]||r||'—'}
async function loadPhotoPeople(){
  const {data,error}=await client.from('photo_people').select('person_id,role,people(full_name)').eq('photo_id',activePhotoId);
  if(error){$('#photoPeopleList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentPhotoPeople=data||[];
  $('#photoPeopleList').innerHTML=currentPhotoPeople.length
    ?'<table><thead><tr><th>Pessoa</th><th>Papel</th><th></th></tr></thead><tbody>'+currentPhotoPeople.map(r=>`<tr><td>${escapeHtml(r.people?.full_name||'—')}</td><td>${escapeHtml(photoRoleLabel(r.role))}</td><td class="actions"><button data-rm-photo-person="${r.person_id}" data-role="${escapeHtml(r.role||'')}" class="danger-text">Remover</button></td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nenhuma pessoa vinculada ainda.</p>';
  document.querySelectorAll('[data-rm-photo-person]').forEach(b=>b.onclick=()=>removePhotoPerson(b.dataset.rmPhotoPerson,b.dataset.role));
}
async function addPhotoPerson(){
  showError($('#photoPeopleError'),'');
  const raw=$('#photoPersonSelect').value.trim();
  if(!raw){showError($('#photoPeopleError'),'Selecione uma pessoa.');return}
  const personId=resolvePersonId($('#photoPersonSelect'));
  if(!personId){showError($('#photoPeopleError'),'Pessoa não encontrada — selecione uma da lista.');return}
  const role=$('#photoPersonRole').value;
  if(currentPhotoPeople.some(r=>r.person_id===personId&&r.role===role)){showError($('#photoPeopleError'),'Essa pessoa já está vinculada com esse papel.');return}
  const {error}=await client.from('photo_people').insert({photo_id:activePhotoId,person_id:personId,role});
  if(error){showError($('#photoPeopleError'),error.message);return}
  $('#photoPersonSelect').value='';
  await loadPhotoPeople(); await loadPhotos();
}
async function removePhotoPerson(personId,role){
  if(!confirm('Remover esta pessoa da foto?')) return;
  const {error}=await client.from('photo_people').delete().eq('photo_id',activePhotoId).eq('person_id',personId).eq('role',role);
  if(error){alert(error.message);return} await loadPhotoPeople(); await loadPhotos();
}

/* ---------- Álbuns ---------- */
async function loadAlbums(){
  const {data,error}=await client.from('albums').select('id,title,description,status,place_id,cover_photo_id,album_date,updated_at,album_photos(photo_id,order_index)').order('updated_at',{ascending:false});
  if(error){$('#albumsTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  albums=data||[]; $('#albumsCount').textContent=albums.length; fillDatalist('#albumsQuickList',albums,'title',albumsQuickLabelMap); renderAlbums();
}
function renderAlbums(){
  $('#albumsPagination').innerHTML='';
  const q=$('#searchAlbums').value.trim().toLowerCase();
  const list=q?albums.filter(a=>(a.title||'').toLowerCase().includes(q)):albums;
  if(!list.length){$('#albumsTable').innerHTML=q?'<div class="empty-state small"><div class="empty-icon">▤</div><h4>Nenhum álbum encontrado</h4><p>Tente buscar por outro título.</p></div>':'<div class="empty-state small"><div class="empty-icon">▤</div><h4>Nenhum álbum cadastrado</h4><p>Agrupe fotos em coleções.</p><button class="primary" id="emptyAddAlbum">+ Novo álbum</button></div>';$('#emptyAddAlbum')?.addEventListener('click',()=>openAlbumModal());return}
  const pageSize=Number($('#albumsPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(albumsPage>totalPages) albumsPage=totalPages;
  if(albumsPage<1) albumsPage=1;
  const start=(albumsPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#albumsTable').innerHTML='<table><thead><tr><th>Título</th><th>Fotos</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(a=>`<tr><td><strong>${escapeHtml(a.title||'—')}</strong></td><td>${(a.album_photos||[]).length}</td><td>${dateCell(a.album_date)}</td><td>${statusCell(a.status)}</td><td class="actions"><button data-album-photos="${a.id}">Fotos</button><button data-edit-album="${a.id}">Editar</button><button data-delete-album="${a.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-album-photos]').forEach(b=>b.onclick=()=>openAlbumPhotosModal(b.dataset.albumPhotos));
  document.querySelectorAll('[data-edit-album]').forEach(b=>b.onclick=()=>openAlbumModal(albums.find(a=>a.id===b.dataset.editAlbum)));
  document.querySelectorAll('[data-delete-album]').forEach(b=>b.onclick=()=>deleteAlbum(b.dataset.deleteAlbum));
  if(totalPages>1){
    $('#albumsPagination').innerHTML=`<button type="button" class="secondary" id="albumsPrevPage"${albumsPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${albumsPage} de ${totalPages} (${list.length} álbuns)</span><button type="button" class="secondary" id="albumsNextPage"${albumsPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#albumsPrevPage')?.addEventListener('click',()=>{albumsPage--; renderAlbums();});
    $('#albumsNextPage')?.addEventListener('click',()=>{albumsPage++; renderAlbums();});
  }
}
function openAlbumModal(album=null){
  $('#albumFormError').textContent='';
  $('#albumId').value=album?.id||'';
  $('#albumFormTitle').textContent=album?'Editar álbum':'Novo álbum';
  $('#albumTitle').value=album?.title||'';
  $('#albumDate').value=album?.album_date||'';
  $('#albumPlace').value=album?.place_id?labelFromMap(placesLabelMap,album.place_id):'';
  $('#albumStatus').value=album?.status||'published';
  $('#albumDescription').value=album?.description||'';
  albumModal.classList.add('open');
}
function closeAlbumModal(){albumModal.classList.remove('open')}
async function saveAlbum(e){
  e.preventDefault(); showError($('#albumFormError'),'');
  const id=$('#albumId').value;
  const title=$('#albumTitle').value.trim();
  if(!title){showError($('#albumFormError'),'Informe o título do álbum.');return}
  const placeRaw=$('#albumPlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#albumPlace')):'';
  if(placeRaw&&!placeId){showError($('#albumFormError'),'Lugar não encontrado — selecione um da lista.');return}
  const payload={title,description:nn($('#albumDescription').value),status:$('#albumStatus').value,album_date:nn($('#albumDate').value),place_id:placeId||null};
  let error;
  if(id){({error}=await client.from('albums').update(payload).eq('id',id));}
  else {({error}=await client.from('albums').insert(payload));}
  if(error){dbErr($('#albumFormError'),error);return}
  closeAlbumModal(); showToast(id?'Álbum atualizado.':'Álbum cadastrado.'); await loadAlbums();
}
async function deleteAlbum(id){
  const album=albums.find(a=>a.id===id);
  if(!await confirmDelete(`Excluir "${album?.title||'este álbum'}"?`,'As fotos continuam no acervo — apenas o agrupamento é removido. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('albums').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Álbum excluído.'); await loadAlbums();
}
async function openAlbumPhotosModal(albumId){
  activeAlbumId=albumId;
  $('#albumPhotosLabel').textContent=albums.find(a=>a.id===albumId)?.title||'Álbum';
  $('#albumPhotosError').textContent=''; $('#albumPhotoSelect').value='';
  await loadAlbumPhotos();
  albumPhotosModal.classList.add('open');
}
function closeAlbumPhotosModal(){albumPhotosModal.classList.remove('open')}
async function loadAlbumPhotos(){
  const {data,error}=await client.from('album_photos').select('photo_id,order_index,photos(title,photo_date)').eq('album_id',activeAlbumId).order('order_index',{ascending:true});
  if(error){$('#albumPhotosList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentAlbumPhotos=data||[];
  $('#albumPhotosList').innerHTML=currentAlbumPhotos.length
    ?'<table><thead><tr><th>#</th><th>Foto</th><th>Data</th><th></th></tr></thead><tbody>'+currentAlbumPhotos.map(r=>`<tr><td>${r.order_index??'—'}</td><td>${escapeHtml(r.photos?.title||'—')}</td><td>${dateCell(r.photos?.photo_date)}</td><td class="actions"><button data-rm-album-photo="${r.photo_id}" class="danger-text">Remover</button></td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nenhuma foto neste álbum ainda.</p>';
  document.querySelectorAll('[data-rm-album-photo]').forEach(b=>b.onclick=()=>removeAlbumPhoto(b.dataset.rmAlbumPhoto));
}
async function addAlbumPhoto(){
  showError($('#albumPhotosError'),'');
  const raw=$('#albumPhotoSelect').value.trim();
  if(!raw){showError($('#albumPhotosError'),'Selecione uma foto.');return}
  const photoId=resolveFrom(photosLabelMap,$('#albumPhotoSelect'));
  if(!photoId){showError($('#albumPhotosError'),'Foto não encontrada — selecione uma da lista.');return}
  if(currentAlbumPhotos.some(r=>r.photo_id===photoId)){showError($('#albumPhotosError'),'Essa foto já está neste álbum.');return}
  const next=currentAlbumPhotos.reduce((m,r)=>Math.max(m,Number(r.order_index)||0),0)+1;
  const {error}=await client.from('album_photos').insert({album_id:activeAlbumId,photo_id:photoId,order_index:next});
  if(error){showError($('#albumPhotosError'),error.message);return}
  $('#albumPhotoSelect').value='';
  await loadAlbumPhotos(); await loadAlbums();
}
async function removeAlbumPhoto(photoId){
  if(!confirm('Remover esta foto do álbum?')) return;
  const {error}=await client.from('album_photos').delete().eq('album_id',activeAlbumId).eq('photo_id',photoId);
  if(error){alert(error.message);return} await loadAlbumPhotos(); await loadAlbums();
}

/* ---------- Eventos ---------- */
function eventTypeLabel(t){return ({birth:'Nascimento',marriage:'Casamento',death:'Falecimento',baptism:'Batismo',immigration:'Imigração',other:'Outro'})[t]||t||'—'}
async function loadEvents(){
  const {data,error}=await client.from('events').select('id,title,description,status,event_type,event_date,start_date,end_date,date_precision,place_id,photo_id,updated_at,event_people(role,person_id,people(full_name)),event_sources(source_id,notes,sources(id,title)),event_documents(document_id,documents(id,title))').order('event_date',{ascending:false,nullsFirst:false});
  if(error){$('#eventsTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  events=data||[]; $('#eventsCount').textContent=events.length;
  eventsQuickLabelMap=new Map();
  $('#eventsQuickList').innerHTML=events.map(ev=>{
    let label=eventQuickLabel(ev);
    if(eventsQuickLabelMap.has(label)) label=`${label} · ${ev.id.slice(0,8)}`;
    eventsQuickLabelMap.set(label,ev.id);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join('');
  renderEvents();
}
function eventQuickLabel(e){const y=(e.event_date||e.start_date||'').slice(0,4); return e.title+(y?` (${y})`:'')}
function renderEvents(){
  $('#eventsPagination').innerHTML='';
  const q=$('#searchEvents').value.trim().toLowerCase();
  const tp=$('#filterEventType').value;
  const list=events.filter(e=>(!q||(e.title||'').toLowerCase().includes(q))&&(!tp||e.event_type===tp));
  if(!list.length){$('#eventsTable').innerHTML=(q||tp)?'<div class="empty-state small"><div class="empty-icon">◷</div><h4>Nenhum evento encontrado</h4><p>Ajuste a busca ou o filtro.</p></div>':'<div class="empty-state small"><div class="empty-icon">◷</div><h4>Nenhum evento cadastrado</h4><p>Monte a linha do tempo da família.</p><button class="primary" id="emptyAddEvent">+ Novo evento</button></div>';$('#emptyAddEvent')?.addEventListener('click',()=>openEventModal());return}
  const pageSize=Number($('#eventsPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(eventsPage>totalPages) eventsPage=totalPages;
  if(eventsPage<1) eventsPage=1;
  const start=(eventsPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#eventsTable').innerHTML='<table><thead><tr><th>Evento</th><th>Tipo</th><th>Data</th><th>Pessoas</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(e=>{
    const names=(e.event_people||[]).map(m=>m.people?.full_name).filter(Boolean);
    const shown=names.slice(0,2).join(', ')+(names.length>2?` +${names.length-2}`:'');
    return `<tr><td><strong>${escapeHtml(e.title||'—')}</strong></td><td>${escapeHtml(eventTypeLabel(e.event_type))}</td><td>${dateCell(e.event_date||e.start_date)}</td><td>${escapeHtml(shown||'—')}</td><td>${statusCell(e.status)}</td><td class="actions"><button data-event-people="${e.id}">Pessoas</button><button data-edit-event="${e.id}">Editar</button><button data-delete-event="${e.id}" class="danger-text">Excluir</button></td></tr>`;
  }).join('')+'</tbody></table>';
  document.querySelectorAll('[data-event-people]').forEach(b=>b.onclick=()=>openEventPeopleModal(b.dataset.eventPeople));
  document.querySelectorAll('[data-edit-event]').forEach(b=>b.onclick=()=>openEventModal(events.find(e=>e.id===b.dataset.editEvent)));
  document.querySelectorAll('[data-delete-event]').forEach(b=>b.onclick=()=>deleteEvent(b.dataset.deleteEvent));
  if(totalPages>1){
    $('#eventsPagination').innerHTML=`<button type="button" class="secondary" id="eventsPrevPage"${eventsPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${eventsPage} de ${totalPages} (${list.length} eventos)</span><button type="button" class="secondary" id="eventsNextPage"${eventsPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#eventsPrevPage')?.addEventListener('click',()=>{eventsPage--; renderEvents();});
    $('#eventsNextPage')?.addEventListener('click',()=>{eventsPage++; renderEvents();});
  }
}
function openEventModal(ev=null){
  $('#eventFormError').textContent='';
  $('#eventId').value=ev?.id||'';
  $('#eventFormTitle').textContent=ev?'Editar evento':'Novo evento';
  $('#eventTitle').value=ev?.title||'';
  $('#eventType').value=ev?.event_type||'birth';
  $('#eventDate').value=ev?.event_date||'';
  $('#eventPrecision').value=ev?.date_precision||'exact';
  $('#eventStart').value=ev?.start_date||'';
  $('#eventEnd').value=ev?.end_date||'';
  $('#eventPlace').value=ev?.place_id?labelFromMap(placesLabelMap,ev.place_id):'';
  $('#eventStatus').value=ev?.status||'published';
  $('#eventDescription').value=ev?.description||'';
  $('#eventPhotoSelect').value=ev?.photo_id?labelFromMap(photosLabelMap,ev.photo_id):'';
  eventQuickPeople=(ev?.event_people||[]).map(ep=>({id:ep.person_id,full_name:ep.people?.full_name||'',role:ep.role}));
  eventQuickSources=(ev?.event_sources||[]).map(es=>({id:es.source_id,title:es.sources?.title||''}));
  eventQuickDocuments=(ev?.event_documents||[]).map(ed=>({id:ed.document_id,title:ed.documents?.title||''}));
  $('#eventQuickPerson').value=''; $('#eventQuickRole').value='subject'; $('#eventQuickSource').value=''; $('#eventQuickDocument').value='';
  fillPeopleDatalist();
  renderEventChips();
  eventModal.classList.add('open');
}
function closeEventModal(){eventModal.classList.remove('open')}
function renderEventChips(){
  $('#eventPeopleChips').innerHTML=eventQuickPeople.map(p=>`<span class="chip">${escapeHtml(p.full_name)} · ${escapeHtml(eventRoleLabel(p.role))}<button type="button" data-remove-evqp="${p.id}">×</button></span>`).join('');
  $('#eventSourceChips').innerHTML=eventQuickSources.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-evqs="${s.id}">×</button></span>`).join('');
  $('#eventDocumentChips').innerHTML=eventQuickDocuments.map(d=>`<span class="chip">${escapeHtml(d.title)}<button type="button" data-remove-evqd="${d.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-evqp]').forEach(b=>b.onclick=()=>{eventQuickPeople=eventQuickPeople.filter(p=>p.id!==b.dataset.removeEvqp); renderEventChips();});
  document.querySelectorAll('[data-remove-evqs]').forEach(b=>b.onclick=()=>{eventQuickSources=eventQuickSources.filter(s=>s.id!==b.dataset.removeEvqs); renderEventChips();});
  document.querySelectorAll('[data-remove-evqd]').forEach(b=>b.onclick=()=>{eventQuickDocuments=eventQuickDocuments.filter(d=>d.id!==b.dataset.removeEvqd); renderEventChips();});
}
function addEventQuickSource(){
  const raw=$('#eventQuickSource').value.trim();
  if(!raw) return;
  const id=sourcesQuickLabelMap.get(raw);
  if(!id){showError($('#eventFormError'),'Fonte não encontrada — selecione uma da lista.');return}
  showError($('#eventFormError'),'');
  if(!eventQuickSources.some(s=>s.id===id)){
    eventQuickSources.push({id,title:raw});
    renderEventChips();
  }
  $('#eventQuickSource').value='';
}
function addEventQuickDocument(){
  const raw=$('#eventQuickDocument').value.trim();
  if(!raw) return;
  const id=resolveFrom(documentsLabelMap,$('#eventQuickDocument'));
  if(!id){showError($('#eventFormError'),'Documento não encontrado — selecione um da lista.');return}
  showError($('#eventFormError'),'');
  if(!eventQuickDocuments.some(d=>d.id===id)){
    eventQuickDocuments.push({id,title:raw});
    renderEventChips();
  }
  $('#eventQuickDocument').value='';
}
function addEventQuickPerson(){
  const raw=$('#eventQuickPerson').value.trim();
  if(!raw) return;
  const id=resolvePersonId($('#eventQuickPerson'));
  if(!id){showError($('#eventFormError'),'Pessoa não encontrada — selecione uma da lista.');return}
  const role=$('#eventQuickRole').value;
  showError($('#eventFormError'),'');
  const already=eventQuickPeople.find(p=>p.id===id);
  if(already){ already.role=role; }
  else { eventQuickPeople.push({id,full_name:peopleOptions.find(p=>p.id===id)?.full_name||labelForId(id),role}); }
  renderEventChips();
  $('#eventQuickPerson').value='';
}
async function saveEvent(e){
  e.preventDefault(); showError($('#eventFormError'),'');
  const id=$('#eventId').value;
  const title=$('#eventTitle').value.trim();
  if(!title){showError($('#eventFormError'),'Informe o título do evento.');return}
  const start=$('#eventStart').value, end=$('#eventEnd').value;
  if(start&&end&&end<start){showError($('#eventFormError'),'A data de fim não pode ser anterior à de início.');return}
  const placeRaw=$('#eventPlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#eventPlace')):'';
  if(placeRaw&&!placeId){showError($('#eventFormError'),'Lugar não encontrado — selecione um da lista.');return}
  const photoRaw=$('#eventPhotoSelect').value.trim();
  const eventPhotoId=photoRaw?resolveFrom(photosLabelMap,$('#eventPhotoSelect')):'';
  if(photoRaw&&!eventPhotoId){showError($('#eventFormError'),'Foto não encontrada — selecione uma da lista.');return}
  const existing=id?events.find(ev=>ev.id===id):null;
  const payload={title,description:nn($('#eventDescription').value),status:$('#eventStatus').value,event_type:$('#eventType').value,event_date:nn($('#eventDate').value),date_precision:$('#eventPrecision').value,start_date:nn(start),end_date:nn(end),place_id:placeId||null,photo_id:eventPhotoId||null};
  let error, eventId=id;
  if(id){({error}=await client.from('events').update(payload).eq('id',id));}
  else {const res=await client.from('events').insert(payload).select('id').single(); error=res.error; eventId=res.data?.id;}
  if(error){dbErr($('#eventFormError'),error);return}
  if(eventId){
    const origPeople=new Map((existing?.event_people||[]).map(ep=>[ep.person_id,ep.role]));
    const curPeople=new Map(eventQuickPeople.map(p=>[p.id,p.role]));
    const removePeople=[...origPeople.keys()].filter(pid=>!curPeople.has(pid));
    const addOrChangePeople=[...curPeople.entries()].filter(([pid,role])=>origPeople.get(pid)!==role);
    if(removePeople.length) await client.from('event_people').delete().eq('event_id',eventId).in('person_id',removePeople);
    for(const [pid,role] of addOrChangePeople){
      if(origPeople.has(pid)) await client.from('event_people').update({role}).eq('event_id',eventId).eq('person_id',pid);
      else await client.from('event_people').insert({event_id:eventId,person_id:pid,role});
    }
    const origSources=new Set((existing?.event_sources||[]).map(es=>es.source_id));
    const curSources=new Set(eventQuickSources.map(s=>s.id));
    const removeSources=[...origSources].filter(sid=>!curSources.has(sid));
    const addSources=eventQuickSources.filter(s=>!origSources.has(s.id));
    if(removeSources.length) await client.from('event_sources').delete().eq('event_id',eventId).in('source_id',removeSources);
    if(addSources.length) await client.from('event_sources').insert(addSources.map(s=>({event_id:eventId,source_id:s.id})));
    const origDocuments=new Set((existing?.event_documents||[]).map(ed=>ed.document_id));
    const curDocuments=new Set(eventQuickDocuments.map(d=>d.id));
    const removeDocuments=[...origDocuments].filter(did=>!curDocuments.has(did));
    const addDocuments=eventQuickDocuments.filter(d=>!origDocuments.has(d.id));
    if(removeDocuments.length) await client.from('event_documents').delete().eq('event_id',eventId).in('document_id',removeDocuments);
    if(addDocuments.length) await client.from('event_documents').insert(addDocuments.map(d=>({event_id:eventId,document_id:d.id})));
  }
  closeEventModal(); showToast(id?'Evento atualizado.':'Evento cadastrado.'); await loadEvents();
}
async function deleteEvent(id){
  const ev=events.find(e=>e.id===id);
  if(!await confirmDelete(`Excluir "${ev?.title||'este evento'}"?`,'Os vínculos com pessoas também serão removidos. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('events').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Evento excluído.'); await loadEvents();
}
function eventRoleLabel(r){return ({subject:'Principal',participant:'Presente',witness:'Testemunha',organizer:'Organizador',parent:'Pai/Mãe',spouse:'Cônjuge',child:'Filho(a)',other:'Outro',attendee:'Presente'})[r]||r||'—'}
async function openEventPeopleModal(eventId){
  activeEventId=eventId;
  $('#eventPeopleLabel').textContent=events.find(e=>e.id===eventId)?.title||'Evento';
  $('#eventPeopleError').textContent=''; $('#eventPersonSelect').value='';
  fillPeopleDatalist();
  await loadEventPeople();
  eventPeopleModal.classList.add('open');
}
function closeEventPeopleModal(){eventPeopleModal.classList.remove('open'); fillPeopleDatalist();}
async function loadEventPeople(){
  const {data,error}=await client.from('event_people').select('person_id,role,notes,people(full_name)').eq('event_id',activeEventId);
  if(error){$('#eventPeopleList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentEventPeople=data||[];
  $('#eventPeopleList').innerHTML=currentEventPeople.length
    ?'<table><thead><tr><th>Pessoa</th><th>Papel</th><th></th></tr></thead><tbody>'+currentEventPeople.map(r=>`<tr><td>${escapeHtml(r.people?.full_name||'—')}</td><td>${escapeHtml(eventRoleLabel(r.role))}</td><td class="actions"><button data-rm-event-person="${r.person_id}" data-role="${escapeHtml(r.role||'')}" class="danger-text">Remover</button></td></tr>`).join('')+'</tbody></table>'
    :'<p class="hint">Nenhuma pessoa vinculada ainda.</p>';
  document.querySelectorAll('[data-rm-event-person]').forEach(b=>b.onclick=()=>removeEventPerson(b.dataset.rmEventPerson,b.dataset.role));
}
async function addEventPerson(){
  showError($('#eventPeopleError'),'');
  const raw=$('#eventPersonSelect').value.trim();
  if(!raw){showError($('#eventPeopleError'),'Selecione uma pessoa.');return}
  const personId=resolvePersonId($('#eventPersonSelect'));
  if(!personId){showError($('#eventPeopleError'),'Pessoa não encontrada — selecione uma da lista.');return}
  const role=$('#eventPersonRole').value;
  if(currentEventPeople.some(r=>r.person_id===personId&&r.role===role)){showError($('#eventPeopleError'),'Essa pessoa já está vinculada com esse papel.');return}
  const {error}=await client.from('event_people').insert({event_id:activeEventId,person_id:personId,role});
  if(error){showError($('#eventPeopleError'),error.message);return}
  $('#eventPersonSelect').value='';
  await loadEventPeople(); await loadEvents();
}
async function removeEventPerson(personId,role){
  if(!confirm('Remover esta pessoa do evento?')) return;
  const {error}=await client.from('event_people').delete().eq('event_id',activeEventId).eq('person_id',personId).eq('role',role);
  if(error){alert(error.message);return} await loadEventPeople(); await loadEvents();
}

/* ---------- Documentos ---------- */
function documentTypeLabel(t){return ({birth_record:'Registro de nascimento',death_record:'Registro de óbito',marriage_record:'Registro de casamento',baptism_record:'Registro de batismo',immigration_record:'Registro de imigração',certificate:'Certidão',letter:'Carta',map:'Mapa',photo_scan:'Foto/digitalização',pdf:'PDF',other:'Outro'})[t]||t||'—'}
async function loadDocuments(){
  const {data,error}=await client.from('documents').select('id,title,description,status,document_type,document_date,date_precision,place_id,storage_path,mime_type,file_size_bytes,updated_at,document_people(person_id,people(id,full_name)),story_documents(story_id,stories(id,title)),chapter_documents(chapter_id,chapters(id,chapter_number,title,subtitle)),event_documents(event_id,events(id,title,event_date,start_date))').order('updated_at',{ascending:false});
  if(error){$('#documentsTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  documents=data||[]; $('#documentsCount').textContent=documents.length; fillDatalist('#documentsList',documents,'title',documentsLabelMap); renderDocuments();
}
function renderDocuments(){
  $('#documentsPagination').innerHTML='';
  const q=$('#searchDocuments').value.trim().toLowerCase();
  const tp=$('#filterDocumentType').value;
  const list=documents.filter(d=>(!q||(d.title||'').toLowerCase().includes(q))&&(!tp||d.document_type===tp));
  if(!list.length){$('#documentsTable').innerHTML=(q||tp)?'<div class="empty-state small"><div class="empty-icon">▥</div><h4>Nenhum documento encontrado</h4><p>Ajuste a busca ou o filtro.</p></div>':'<div class="empty-state small"><div class="empty-icon">▥</div><h4>Nenhum documento cadastrado</h4><p>Registre certidões, cartas e outros registros.</p><button class="primary" id="emptyAddDocument">+ Novo documento</button></div>';$('#emptyAddDocument')?.addEventListener('click',()=>openDocumentModal());return}
  const pageSize=Number($('#documentsPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(documentsPage>totalPages) documentsPage=totalPages;
  if(documentsPage<1) documentsPage=1;
  const start=(documentsPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#documentsTable').innerHTML='<table><thead><tr><th>Título</th><th>Tipo</th><th>Data</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(d=>`<tr><td><strong>${escapeHtml(d.title||'—')}</strong>${d.storage_path?`<br><small>${escapeHtml(d.storage_path)}</small>`:''}</td><td>${escapeHtml(documentTypeLabel(d.document_type))}</td><td>${dateCell(d.document_date)}</td><td>${statusCell(d.status)}</td><td class="actions"><button data-edit-document="${d.id}">Editar</button><button data-delete-document="${d.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-edit-document]').forEach(b=>b.onclick=()=>openDocumentModal(documents.find(d=>d.id===b.dataset.editDocument)));
  document.querySelectorAll('[data-delete-document]').forEach(b=>b.onclick=()=>deleteDocument(b.dataset.deleteDocument));
  if(totalPages>1){
    $('#documentsPagination').innerHTML=`<button type="button" class="secondary" id="documentsPrevPage"${documentsPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${documentsPage} de ${totalPages} (${list.length} documentos)</span><button type="button" class="secondary" id="documentsNextPage"${documentsPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#documentsPrevPage')?.addEventListener('click',()=>{documentsPage--; renderDocuments();});
    $('#documentsNextPage')?.addEventListener('click',()=>{documentsPage++; renderDocuments();});
  }
}
function openDocumentModal(doc=null){
  $('#documentFormError').textContent='';
  $('#documentId').value=doc?.id||'';
  $('#documentFormTitle').textContent=doc?'Editar documento':'Novo documento';
  $('#documentTitle').value=doc?.title||'';
  $('#documentType').value=doc?.document_type||'certificate';
  $('#documentDate').value=doc?.document_date||'';
  $('#documentPrecision').value=doc?.date_precision||'exact';
  $('#documentPlace').value=doc?.place_id?labelFromMap(placesLabelMap,doc.place_id):'';
  $('#documentStatus').value=doc?.status||'published';
  $('#documentDescription').value=doc?.description||'';
  pendingDocumentUpload=null; $('#documentFile').value='';
  const isImg=(doc?.mime_type||'').startsWith('image/');
  $('#documentPreview').innerHTML=doc?.storage_path?(isImg?`<img src="${documentPublicUrl(doc.storage_path)}" alt="">`:`<a href="${documentPublicUrl(doc.storage_path)}" target="_blank" rel="noopener">Abrir arquivo atual</a>`):'';
  $('#documentUploadHint').textContent=doc?'Selecione um arquivo só se quiser substituir o atual.':'Selecione um PDF ou uma imagem — imagens são otimizadas automaticamente para economizar espaço.';
  documentQuickPeople=(doc?.document_people||[]).map(dp=>({id:dp.person_id,full_name:dp.people?.full_name||''}));
  documentQuickStories=(doc?.story_documents||[]).map(sd=>({id:sd.story_id,title:sd.stories?.title||''}));
  documentQuickChapters=(doc?.chapter_documents||[]).map(cd=>({id:cd.chapter_id,title:cd.chapters?chapterQuickLabel(cd.chapters):''}));
  documentQuickEvents=(doc?.event_documents||[]).map(ed=>({id:ed.event_id,title:ed.events?eventQuickLabel(ed.events):''}));
  $('#documentQuickPerson').value=''; $('#documentQuickStory').value=''; $('#documentQuickChapter').value=''; $('#documentQuickEvent').value='';
  fillPeopleDatalist();
  renderDocumentChips();
  documentModal.classList.add('open');
}
function closeDocumentModal(){documentModal.classList.remove('open')}
function renderDocumentChips(){
  $('#documentPeopleChips').innerHTML=documentQuickPeople.map(p=>`<span class="chip">${escapeHtml(p.full_name)}<button type="button" data-remove-dqp="${p.id}">×</button></span>`).join('');
  $('#documentStoryChips').innerHTML=documentQuickStories.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-dqs="${s.id}">×</button></span>`).join('');
  $('#documentChapterChips').innerHTML=documentQuickChapters.map(c=>`<span class="chip">${escapeHtml(c.title)}<button type="button" data-remove-dqc="${c.id}">×</button></span>`).join('');
  $('#documentEventChips').innerHTML=documentQuickEvents.map(e=>`<span class="chip">${escapeHtml(e.title)}<button type="button" data-remove-dqe="${e.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-dqp]').forEach(b=>b.onclick=()=>{documentQuickPeople=documentQuickPeople.filter(p=>p.id!==b.dataset.removeDqp); renderDocumentChips();});
  document.querySelectorAll('[data-remove-dqs]').forEach(b=>b.onclick=()=>{documentQuickStories=documentQuickStories.filter(s=>s.id!==b.dataset.removeDqs); renderDocumentChips();});
  document.querySelectorAll('[data-remove-dqc]').forEach(b=>b.onclick=()=>{documentQuickChapters=documentQuickChapters.filter(c=>c.id!==b.dataset.removeDqc); renderDocumentChips();});
  document.querySelectorAll('[data-remove-dqe]').forEach(b=>b.onclick=()=>{documentQuickEvents=documentQuickEvents.filter(ev=>ev.id!==b.dataset.removeDqe); renderDocumentChips();});
}
function addDocumentQuickPerson(){
  const raw=$('#documentQuickPerson').value.trim();
  if(!raw) return;
  const id=resolvePersonId($('#documentQuickPerson'));
  if(!id){showError($('#documentFormError'),'Pessoa não encontrada — selecione uma da lista.');return}
  showError($('#documentFormError'),'');
  if(!documentQuickPeople.some(p=>p.id===id)){
    documentQuickPeople.push({id,full_name:peopleOptions.find(p=>p.id===id)?.full_name||labelForId(id)});
    renderDocumentChips();
  }
  $('#documentQuickPerson').value='';
}
function addDocumentQuickStory(){
  const raw=$('#documentQuickStory').value.trim();
  if(!raw) return;
  const id=storiesQuickLabelMap.get(raw);
  if(!id){showError($('#documentFormError'),'História não encontrada — selecione uma da lista.');return}
  showError($('#documentFormError'),'');
  if(!documentQuickStories.some(s=>s.id===id)){
    documentQuickStories.push({id,title:raw});
    renderDocumentChips();
  }
  $('#documentQuickStory').value='';
}
function addDocumentQuickChapter(){
  const raw=$('#documentQuickChapter').value.trim();
  if(!raw) return;
  const id=chaptersQuickLabelMap.get(raw);
  if(!id){showError($('#documentFormError'),'Capítulo não encontrado — selecione um da lista.');return}
  showError($('#documentFormError'),'');
  if(!documentQuickChapters.some(c=>c.id===id)){
    documentQuickChapters.push({id,title:raw});
    renderDocumentChips();
  }
  $('#documentQuickChapter').value='';
}
function addDocumentQuickEvent(){
  const raw=$('#documentQuickEvent').value.trim();
  if(!raw) return;
  const id=eventsQuickLabelMap.get(raw);
  if(!id){showError($('#documentFormError'),'Evento não encontrado — selecione um da lista.');return}
  showError($('#documentFormError'),'');
  if(!documentQuickEvents.some(e=>e.id===id)){
    documentQuickEvents.push({id,title:raw});
    renderDocumentChips();
  }
  $('#documentQuickEvent').value='';
}
async function onDocumentFileChange(e){
  const file=e.target.files[0];
  if(!file) return;
  pendingDocumentUpload=null;
  const isPdf=file.type==='application/pdf', isImage=file.type.startsWith('image/');
  if(!isPdf&&!isImage){
    $('#documentUploadHint').textContent='Envie um arquivo PDF ou uma imagem (jpg, png, webp).';
    e.target.value='';
    return;
  }
  if(file.size>(isImage?MAX_IMAGE_SOURCE_BYTES:MAX_DOCUMENT_BYTES)){
    $('#documentUploadHint').textContent=`Arquivo muito grande (máx. ${humanSize(isImage?MAX_IMAGE_SOURCE_BYTES:MAX_DOCUMENT_BYTES)}).`;
    e.target.value='';
    return;
  }
  // A extensão/MIME que o navegador reporta é só um rótulo — quem escolhe o
  // arquivo pode renomear qualquer coisa pra .pdf. Confere a assinatura real
  // dos primeiros bytes antes de aceitar, pra não guardar lixo com Content-Type
  // de PDF que na verdade é outro tipo de arquivo.
  if(isPdf && !(await looksLikePdf(file))){
    $('#documentUploadHint').textContent='Arquivo não parece ser um PDF válido.';
    e.target.value='';
    return;
  }
  $('#documentUploadHint').textContent='Processando arquivo...';
  try{
    if(isImage){
      const result=await processImageFile(file);
      pendingDocumentUpload={blob:result.optimizedBlob,mime:'image/webp',ext:'webp',isImage:true};
      $('#documentPreview').innerHTML=`<img src="${URL.createObjectURL(result.optimizedBlob)}" alt="">`;
      $('#documentUploadHint').textContent=`Pronto: ${result.width}×${result.height}px, ${(result.optimizedBlob.size/1024).toFixed(0)} KB (imagem otimizada).`;
    } else {
      pendingDocumentUpload={blob:file,mime:'application/pdf',ext:'pdf',isImage:false};
      $('#documentPreview').innerHTML='';
      $('#documentUploadHint').textContent=`PDF selecionado: ${file.name} (${(file.size/1024).toFixed(0)} KB).`;
    }
  }catch(err){
    $('#documentUploadHint').textContent='Erro ao processar arquivo: '+err.message;
  }
}
async function saveDocument(e){
  e.preventDefault(); showError($('#documentFormError'),'');
  const id=$('#documentId').value;
  const title=$('#documentTitle').value.trim();
  if(!title){showError($('#documentFormError'),'Informe o título do documento.');return}
  if(!id && !pendingDocumentUpload){showError($('#documentFormError'),'Selecione um arquivo (PDF ou imagem).');return}
  const placeRaw=$('#documentPlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#documentPlace')):'';
  if(placeRaw&&!placeId){showError($('#documentFormError'),'Lugar não encontrado — selecione um da lista.');return}
  const payload={title,description:nn($('#documentDescription').value),status:$('#documentStatus').value,document_type:$('#documentType').value,document_date:nn($('#documentDate').value),date_precision:$('#documentPrecision').value,place_id:placeId||null};
  const existing=id?documents.find(d=>d.id===id):null;
  let oldPath=null;
  if(pendingDocumentUpload){
    const uid=crypto.randomUUID();
    const path=`docs/${uid}.${pendingDocumentUpload.ext}`;
    const up=await client.storage.from('documents').upload(path,pendingDocumentUpload.blob,{contentType:pendingDocumentUpload.mime});
    if(up.error){showError($('#documentFormError'),'Falha no upload: '+up.error.message);return}
    payload.storage_path=path; payload.mime_type=pendingDocumentUpload.mime; payload.file_size_bytes=pendingDocumentUpload.blob.size;
    if(existing?.storage_path) oldPath=existing.storage_path;
  }
  let error, documentId=id;
  if(id){({error}=await client.from('documents').update(payload).eq('id',id));}
  else {const res=await client.from('documents').insert(payload).select('id').single(); error=res.error; documentId=res.data?.id;}
  if(error){dbErr($('#documentFormError'),error);return}
  if(oldPath) await client.storage.from('documents').remove([oldPath]);
  if(documentId){
    const origPeople=new Set((existing?.document_people||[]).map(dp=>dp.person_id));
    const curPeople=new Set(documentQuickPeople.map(p=>p.id));
    const removePeople=[...origPeople].filter(pid=>!curPeople.has(pid));
    const addPeople=documentQuickPeople.filter(p=>!origPeople.has(p.id));
    if(removePeople.length) await client.from('document_people').delete().eq('document_id',documentId).in('person_id',removePeople);
    if(addPeople.length) await client.from('document_people').insert(addPeople.map(p=>({document_id:documentId,person_id:p.id})));
    const origStories=new Set((existing?.story_documents||[]).map(sd=>sd.story_id));
    const curStories=new Set(documentQuickStories.map(s=>s.id));
    const removeStories=[...origStories].filter(sid=>!curStories.has(sid));
    const addStories=documentQuickStories.filter(s=>!origStories.has(s.id));
    if(removeStories.length) await client.from('story_documents').delete().eq('document_id',documentId).in('story_id',removeStories);
    if(addStories.length) await client.from('story_documents').insert(addStories.map(s=>({document_id:documentId,story_id:s.id})));
    const origChapters=new Set((existing?.chapter_documents||[]).map(cd=>cd.chapter_id));
    const curChapters=new Set(documentQuickChapters.map(c=>c.id));
    const removeChapters=[...origChapters].filter(cid=>!curChapters.has(cid));
    const addChapters=documentQuickChapters.filter(c=>!origChapters.has(c.id));
    if(removeChapters.length) await client.from('chapter_documents').delete().eq('document_id',documentId).in('chapter_id',removeChapters);
    if(addChapters.length) await client.from('chapter_documents').insert(addChapters.map(c=>({document_id:documentId,chapter_id:c.id})));
    const origEvents=new Set((existing?.event_documents||[]).map(ed=>ed.event_id));
    const curEvents=new Set(documentQuickEvents.map(e=>e.id));
    const removeEvents=[...origEvents].filter(eid=>!curEvents.has(eid));
    const addEvents=documentQuickEvents.filter(e=>!origEvents.has(e.id));
    if(removeEvents.length) await client.from('event_documents').delete().eq('document_id',documentId).in('event_id',removeEvents);
    if(addEvents.length) await client.from('event_documents').insert(addEvents.map(e=>({document_id:documentId,event_id:e.id})));
  }
  closeDocumentModal(); showToast(id?'Documento atualizado.':'Documento cadastrado.'); await loadDocuments();
}
async function deleteDocument(id){
  const doc=documents.find(d=>d.id===id);
  if(!await confirmDelete(`Excluir "${doc?.title||'este documento'}"?`,'O arquivo também será apagado do armazenamento. Fontes que o referenciam podem ser afetadas. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('documents').delete().eq('id',id);
  if(error){alert(error.message);return}
  if(doc?.storage_path) await client.storage.from('documents').remove([doc.storage_path]);
  showToast('Documento excluído.'); await loadDocuments(); await loadSources();
}

/* ---------- Fontes ---------- */
function sourceTypeLabel(t){return ({document:'Documento',book:'Livro',interview:'Entrevista',website:'Site',video:'Vídeo',photo:'Foto',oral_history:'História oral',family_memory:'Memória de família',archive:'Arquivo público',unverified:'Não verificado',reconstruction:'Reconstrução',other:'Outro'})[t]||t||'—'}
async function loadSources(){
  const {data,error}=await client.from('sources').select('id,title,description,notes,source_type,url,document_id,place_id,updated_at,documents(title),story_sources(story_id,stories(title)),chapter_sources(chapter_id,chapters(chapter_number,title,subtitle))').order('updated_at',{ascending:false});
  if(error){$('#sourcesTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  sources=data||[]; $('#sourcesCount').textContent=sources.length; fillDatalist('#sourcesQuickList',sources,'title',sourcesQuickLabelMap); renderSources();
}
function renderSources(){
  $('#sourcesPagination').innerHTML='';
  const q=$('#searchSources').value.trim().toLowerCase();
  const list=q?sources.filter(s=>(s.title||'').toLowerCase().includes(q)):sources;
  if(!list.length){$('#sourcesTable').innerHTML=q?'<div class="empty-state small"><div class="empty-icon">▧</div><h4>Nenhuma fonte encontrada</h4><p>Tente buscar por outro título.</p></div>':'<div class="empty-state small"><div class="empty-icon">▧</div><h4>Nenhuma fonte cadastrada</h4><p>Registre a procedência das informações.</p><button class="primary" id="emptyAddSource">+ Nova fonte</button></div>';$('#emptyAddSource')?.addEventListener('click',()=>openSourceModal());return}
  const pageSize=Number($('#sourcesPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(sourcesPage>totalPages) sourcesPage=totalPages;
  if(sourcesPage<1) sourcesPage=1;
  const start=(sourcesPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#sourcesTable').innerHTML='<table><thead><tr><th>Título</th><th>Tipo</th><th>Documento</th><th>Link</th><th></th></tr></thead><tbody>'+pageItems.map(s=>`<tr><td><strong>${escapeHtml(s.title||'—')}</strong></td><td>${escapeHtml(sourceTypeLabel(s.source_type))}</td><td>${escapeHtml(s.documents?.title||'—')}</td><td>${s.url?`<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">abrir</a>`:'—'}</td><td class="actions"><button data-edit-source="${s.id}">Editar</button><button data-delete-source="${s.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-edit-source]').forEach(b=>b.onclick=()=>openSourceModal(sources.find(s=>s.id===b.dataset.editSource)));
  document.querySelectorAll('[data-delete-source]').forEach(b=>b.onclick=()=>deleteSource(b.dataset.deleteSource));
  if(totalPages>1){
    $('#sourcesPagination').innerHTML=`<button type="button" class="secondary" id="sourcesPrevPage"${sourcesPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${sourcesPage} de ${totalPages} (${list.length} fontes)</span><button type="button" class="secondary" id="sourcesNextPage"${sourcesPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#sourcesPrevPage')?.addEventListener('click',()=>{sourcesPage--; renderSources();});
    $('#sourcesNextPage')?.addEventListener('click',()=>{sourcesPage++; renderSources();});
  }
}
function openSourceModal(src=null){
  $('#sourceFormError').textContent='';
  $('#sourceId').value=src?.id||'';
  $('#sourceFormTitle').textContent=src?'Editar fonte':'Nova fonte';
  $('#sourceTitle').value=src?.title||'';
  $('#sourceType').value=src?.source_type||'document';
  $('#sourceDocument').value=src?.document_id?labelFromMap(documentsLabelMap,src.document_id):'';
  $('#sourcePlace').value=src?.place_id?labelFromMap(placesLabelMap,src.place_id):'';
  $('#sourceUrl').value=src?.url||'';
  $('#sourceDescription').value=src?.description||'';
  $('#sourceNotes').value=src?.notes||'';
  sourceQuickStories=(src?.story_sources||[]).map(ss=>({id:ss.story_id,title:ss.stories?.title||''}));
  sourceQuickChapters=(src?.chapter_sources||[]).map(cs=>({id:cs.chapter_id,title:cs.chapters?chapterQuickLabel(cs.chapters):''}));
  $('#sourceQuickStory').value=''; $('#sourceQuickChapter').value='';
  renderSourceChips();
  sourceModal.classList.add('open');
}
function renderSourceChips(){
  $('#sourceStoryChips').innerHTML=sourceQuickStories.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-sqs="${s.id}">×</button></span>`).join('');
  $('#sourceChapterChips').innerHTML=sourceQuickChapters.map(c=>`<span class="chip">${escapeHtml(c.title)}<button type="button" data-remove-sqc="${c.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-sqs]').forEach(b=>b.onclick=()=>{sourceQuickStories=sourceQuickStories.filter(s=>s.id!==b.dataset.removeSqs); renderSourceChips();});
  document.querySelectorAll('[data-remove-sqc]').forEach(b=>b.onclick=()=>{sourceQuickChapters=sourceQuickChapters.filter(c=>c.id!==b.dataset.removeSqc); renderSourceChips();});
}
function addSourceQuickStory(){
  const raw=$('#sourceQuickStory').value.trim();
  if(!raw) return;
  const id=storiesQuickLabelMap.get(raw);
  if(!id){showError($('#sourceFormError'),'História não encontrada — selecione uma da lista.');return}
  showError($('#sourceFormError'),'');
  if(!sourceQuickStories.some(s=>s.id===id)){
    sourceQuickStories.push({id,title:raw});
    renderSourceChips();
  }
  $('#sourceQuickStory').value='';
}
function addSourceQuickChapter(){
  const raw=$('#sourceQuickChapter').value.trim();
  if(!raw) return;
  const id=chaptersQuickLabelMap.get(raw);
  if(!id){showError($('#sourceFormError'),'Capítulo não encontrado — selecione um da lista.');return}
  showError($('#sourceFormError'),'');
  if(!sourceQuickChapters.some(c=>c.id===id)){
    sourceQuickChapters.push({id,title:raw});
    renderSourceChips();
  }
  $('#sourceQuickChapter').value='';
}
function closeSourceModal(){
  sourceModal.classList.remove('open');
  if(reopenStoryAfterSourceSave){reopenStoryAfterSourceSave=false; storyModal.classList.add('open');}
  if(reopenEventAfterSourceSave){reopenEventAfterSourceSave=false; eventModal.classList.add('open');}
  if(reopenChaptersAfterSourceSave){reopenChaptersAfterSourceSave=false; chaptersModal.classList.add('open');}
}
async function saveSource(e){
  e.preventDefault(); showError($('#sourceFormError'),'');
  const id=$('#sourceId').value;
  const title=$('#sourceTitle').value.trim();
  if(!title){showError($('#sourceFormError'),'Informe o título da fonte.');return}
  const docRaw=$('#sourceDocument').value.trim();
  const docId=docRaw?resolveFrom(documentsLabelMap,$('#sourceDocument')):'';
  if(docRaw&&!docId){showError($('#sourceFormError'),'Documento não encontrado — selecione um da lista.');return}
  const placeRaw=$('#sourcePlace').value.trim();
  const placeId=placeRaw?await resolveOrCreatePlace($('#sourcePlace')):'';
  if(placeRaw&&!placeId){showError($('#sourceFormError'),'Local não encontrado — selecione um da lista ou cadastre em Lugares.');return}
  const existing=id?sources.find(s=>s.id===id):null;
  const payload={title,description:nn($('#sourceDescription').value),notes:nn($('#sourceNotes').value),source_type:$('#sourceType').value,url:nn($('#sourceUrl').value),document_id:docId||null,place_id:placeId||null};
  let error, newSourceId=null;
  if(id){({error}=await client.from('sources').update(payload).eq('id',id));}
  else {const res=await client.from('sources').insert(payload).select('id').single(); error=res.error; newSourceId=res.data?.id;}
  if(error){dbErr($('#sourceFormError'),error);return}
  const sourceRowId=id||newSourceId;
  if(sourceRowId){
    const origStories=new Set((existing?.story_sources||[]).map(ss=>ss.story_id));
    const curStories=new Set(sourceQuickStories.map(s=>s.id));
    const removeStories=[...origStories].filter(sid=>!curStories.has(sid));
    const addStories=sourceQuickStories.filter(s=>!origStories.has(s.id));
    if(removeStories.length) await client.from('story_sources').delete().eq('source_id',sourceRowId).in('story_id',removeStories);
    if(addStories.length) await client.from('story_sources').insert(addStories.map(s=>({source_id:sourceRowId,story_id:s.id})));
    const origChapters=new Set((existing?.chapter_sources||[]).map(cs=>cs.chapter_id));
    const curChapters=new Set(sourceQuickChapters.map(c=>c.id));
    const removeChapters=[...origChapters].filter(cid=>!curChapters.has(cid));
    const addChapters=sourceQuickChapters.filter(c=>!origChapters.has(c.id));
    if(removeChapters.length) await client.from('chapter_sources').delete().eq('source_id',sourceRowId).in('chapter_id',removeChapters);
    if(addChapters.length) await client.from('chapter_sources').insert(addChapters.map(c=>({source_id:sourceRowId,chapter_id:c.id})));
  }
  if(!id&&newSourceId){
    if(reopenStoryAfterSourceSave){storyQuickSources.push({id:newSourceId,title}); renderStoryChips();}
    if(reopenEventAfterSourceSave){eventQuickSources.push({id:newSourceId,title}); renderEventChips();}
    if(reopenChaptersAfterSourceSave){chapterQuickSources.push({id:newSourceId,title}); renderChapterPhotoChips();}
  }
  closeSourceModal(); showToast(id?'Fonte atualizada.':'Fonte cadastrada.'); await loadSources();
}
async function deleteSource(id){
  const src=sources.find(s=>s.id===id);
  if(!await confirmDelete(`Excluir "${src?.title||'esta fonte'}"?`,'Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('sources').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Fonte excluída.'); await loadSources();
}

/* ---------- Livro e capítulos ---------- */
function distinctChapterCount(book){return new Set((book.chapters||[]).map(c=>c.chapter_number)).size}
async function loadBooks(){
  const {data,error}=await client.from('books').select('id,title,subtitle,slug,description,status,published_at,updated_at,chapters(id,chapter_number)').order('updated_at',{ascending:false});
  if(error){$('#booksTable').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  books=data||[]; $('#chaptersCount').textContent=books.reduce((n,b)=>n+distinctChapterCount(b),0); renderBooks();
}
function renderBooks(){
  $('#booksPagination').innerHTML='';
  const q=$('#searchBooks').value.trim().toLowerCase();
  const list=q?books.filter(b=>(b.title||'').toLowerCase().includes(q)):books;
  if(!list.length){$('#booksTable').innerHTML=q?'<div class="empty-state small"><div class="empty-icon">▦</div><h4>Nenhum livro encontrado</h4><p>Tente buscar por outro título.</p></div>':'<div class="empty-state small"><div class="empty-icon">▦</div><h4>Nenhum livro cadastrado</h4><p>Crie o livro principal da família.</p><button class="primary" id="emptyAddBook">+ Novo livro</button></div>';$('#emptyAddBook')?.addEventListener('click',()=>openBookModal());return}
  const pageSize=Number($('#booksPageSize').value)||10;
  const totalPages=Math.max(1,Math.ceil(list.length/pageSize));
  if(booksPage>totalPages) booksPage=totalPages;
  if(booksPage<1) booksPage=1;
  const start=(booksPage-1)*pageSize;
  const pageItems=list.slice(start,start+pageSize);
  $('#booksTable').innerHTML='<table><thead><tr><th>Título</th><th>Capítulos</th><th>Seções</th><th>Status</th><th></th></tr></thead><tbody>'+pageItems.map(b=>`<tr><td><strong>${escapeHtml(b.title||'—')}</strong>${b.subtitle?`<br><small>${escapeHtml(b.subtitle)}</small>`:''}</td><td>${distinctChapterCount(b)}</td><td>${(b.chapters||[]).length}</td><td>${statusCell(b.status)}</td><td class="actions"><button data-book-chapters="${b.id}">Capítulos</button><button data-edit-book="${b.id}">Editar</button><button data-delete-book="${b.id}" class="danger-text">Excluir</button></td></tr>`).join('')+'</tbody></table>';
  document.querySelectorAll('[data-book-chapters]').forEach(b=>b.onclick=()=>openChaptersModal(b.dataset.bookChapters));
  document.querySelectorAll('[data-edit-book]').forEach(b=>b.onclick=()=>openBookModal(books.find(x=>x.id===b.dataset.editBook)));
  document.querySelectorAll('[data-delete-book]').forEach(b=>b.onclick=()=>deleteBook(b.dataset.deleteBook));
  if(totalPages>1){
    $('#booksPagination').innerHTML=`<button type="button" class="secondary" id="booksPrevPage"${booksPage<=1?' disabled':''}>‹ Anterior</button><span class="page-info">Página ${booksPage} de ${totalPages} (${list.length} livros)</span><button type="button" class="secondary" id="booksNextPage"${booksPage>=totalPages?' disabled':''}>Próxima ›</button>`;
    $('#booksPrevPage')?.addEventListener('click',()=>{booksPage--; renderBooks();});
    $('#booksNextPage')?.addEventListener('click',()=>{booksPage++; renderBooks();});
  }
}
function openBookModal(book=null){
  $('#bookFormError').textContent='';
  $('#bookId').value=book?.id||'';
  $('#bookFormTitle').textContent=book?'Editar livro':'Novo livro';
  $('#bookTitle').value=book?.title||'';
  $('#bookSubtitle').value=book?.subtitle||'';
  $('#bookSlug').value=book?.slug||'';
  $('#bookStatus').value=book?.status||'published';
  $('#bookDescription').value=book?.description||'';
  bookModal.classList.add('open');
}
function closeBookModal(){bookModal.classList.remove('open')}
async function saveBook(e){
  e.preventDefault(); showError($('#bookFormError'),'');
  const id=$('#bookId').value;
  const title=$('#bookTitle').value.trim();
  if(!title){showError($('#bookFormError'),'Informe o título do livro.');return}
  const slug=slugify($('#bookSlug').value.trim()||title);
  if(!slug){showError($('#bookFormError'),'Não foi possível gerar um endereço (slug). Informe um manualmente.');return}
  const status=$('#bookStatus').value;
  const existing=id?books.find(b=>b.id===id):null;
  const payload={title,subtitle:nn($('#bookSubtitle').value),slug,description:nn($('#bookDescription').value),status,published_at:pubAt(status,existing)};
  let error, newBookId=null;
  if(id){({error}=await client.from('books').update(payload).eq('id',id));}
  else {const res=await client.from('books').insert(payload).select('id').single(); error=res.error; newBookId=res.data?.id;}
  if(error){dbErr($('#bookFormError'),error);return}
  closeBookModal(); await loadBooks();
  if(newBookId){showToast('Livro cadastrado. Agora adicione o Capítulo 1.'); await openChaptersModal(newBookId);}
  else {showToast('Livro atualizado.');}
}
async function deleteBook(id){
  const book=books.find(b=>b.id===id);
  if(!await confirmDelete(`Excluir "${book?.title||'este livro'}"?`,'Os capítulos vinculados também serão removidos. Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('books').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Livro excluído.'); await loadBooks();
}
async function openChaptersModal(bookId){
  activeBookId=bookId;
  $('#chaptersBookLabel').textContent=books.find(b=>b.id===bookId)?.title||'Livro';
  resetChapterForm();
  await loadChapters();
  const last=currentChapters[currentChapters.length-1];
  if(last){$('#chapterNumber').value=last.chapter_number??''; $('#chapterTitle').value=last.title||'';}
  chaptersModal.classList.add('open');
}
function closeChaptersModal(){chaptersModal.classList.remove('open')}
function resetChapterForm(opts={}){
  $('#chapterId').value='';
  if(!opts.keepGroup){$('#chapterNumber').value=''; $('#chapterTitle').value='';}
  $('#chapterSubtitle').value=''; $('#chapterStatus').value='published'; $('#chapterSummary').value='';
  $('#chapterContent').innerHTML='';
  chapterQuickPhotos=[]; $('#chapterQuickPhoto').value='';
  chapterQuickSources=[]; $('#chapterQuickSource').value='';
  renderChapterPhotoChips();
  $('#saveChapterBtn').textContent='Adicionar capítulo';
  $('#chaptersError').textContent='';
}
function renderChapterPhotoChips(){
  $('#chapterPhotoChips').innerHTML=chapterQuickPhotos.map(p=>`<span class="chip">${escapeHtml(p.title)}<button type="button" data-remove-cqp="${p.id}">×</button></span>`).join('');
  $('#chapterSourceChips').innerHTML=chapterQuickSources.map(s=>`<span class="chip">${escapeHtml(s.title)}<button type="button" data-remove-cqs="${s.id}">×</button></span>`).join('');
  document.querySelectorAll('[data-remove-cqp]').forEach(b=>b.onclick=()=>{chapterQuickPhotos=chapterQuickPhotos.filter(p=>p.id!==b.dataset.removeCqp); renderChapterPhotoChips();});
  document.querySelectorAll('[data-remove-cqs]').forEach(b=>b.onclick=()=>{chapterQuickSources=chapterQuickSources.filter(s=>s.id!==b.dataset.removeCqs); renderChapterPhotoChips();});
}
function addChapterQuickSource(){
  const raw=$('#chapterQuickSource').value.trim();
  if(!raw) return;
  const id=sourcesQuickLabelMap.get(raw);
  if(!id){showError($('#chaptersError'),'Fonte não encontrada — selecione uma da lista.');return}
  showError($('#chaptersError'),'');
  if(!chapterQuickSources.some(s=>s.id===id)){
    chapterQuickSources.push({id,title:raw});
    renderChapterPhotoChips();
  }
  $('#chapterQuickSource').value='';
}
function addChapterQuickPhoto(){
  const raw=$('#chapterQuickPhoto').value.trim();
  if(!raw) return;
  const id=photosLabelMap.get(raw);
  if(!id){showError($('#chaptersError'),'Foto não encontrada — selecione uma da lista ou cadastre uma nova.');return}
  showError($('#chaptersError'),'');
  if(!chapterQuickPhotos.some(p=>p.id===id)){
    chapterQuickPhotos.push({id,title:raw});
    renderChapterPhotoChips();
  }
  $('#chapterQuickPhoto').value='';
}
async function loadChapters(){
  const {data,error}=await client.from('chapters').select('id,title,subtitle,summary,content,status,chapter_number,published_at,created_at,chapter_photos(photo_id,order_index,photos(id,title)),chapter_sources(source_id,notes,sources(id,title))').eq('book_id',activeBookId).order('chapter_number',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true});
  if(error){$('#chaptersList').innerHTML=`<div class="error box">${escapeHtml(error.message)}</div>`;return}
  currentChapters=data||[];
  renderChaptersGrouped();
}
function renderChaptersGrouped(){
  if(!currentChapters.length){$('#chaptersList').innerHTML='<p class="hint">Nenhum capítulo neste livro ainda.</p>';return}
  const chapterGroups=new Map();
  currentChapters.forEach(c=>{
    const chNum=c.chapter_number??'—';
    if(!chapterGroups.has(chNum)) chapterGroups.set(chNum,new Map());
    const titleMap=chapterGroups.get(chNum);
    const titleKey=c.title||'—';
    if(!titleMap.has(titleKey)) titleMap.set(titleKey,[]);
    titleMap.get(titleKey).push(c);
  });
  let html='';
  chapterGroups.forEach((titleMap,chNum)=>{
    html+=`<div class="chapter-group"><h4 class="chapter-group-title">Capítulo ${escapeHtml(String(chNum))}</h4>`;
    titleMap.forEach((rows,titleText)=>{
      html+=`<div class="title-group"><h5 class="title-group-title">${escapeHtml(titleText)}</h5><table><tbody>`+
        rows.map(c=>`<tr><td>${c.subtitle?escapeHtml(c.subtitle):'<em>(sem subtítulo)</em>'}</td><td>${statusCell(c.status)}</td><td class="actions"><button data-edit-chapter="${c.id}">Editar</button><button data-rm-chapter="${c.id}" class="danger-text">Excluir</button></td></tr>`).join('')+
        '</tbody></table></div>';
    });
    html+='</div>';
  });
  $('#chaptersList').innerHTML=html;
  document.querySelectorAll('[data-edit-chapter]').forEach(b=>b.onclick=()=>editChapter(b.dataset.editChapter));
  document.querySelectorAll('[data-rm-chapter]').forEach(b=>b.onclick=()=>deleteChapter(b.dataset.rmChapter));
}
function editChapter(id){
  const c=currentChapters.find(x=>x.id===id); if(!c) return;
  $('#chapterId').value=c.id; $('#chapterNumber').value=c.chapter_number??'';
  $('#chapterTitle').value=c.title||''; $('#chapterSubtitle').value=c.subtitle||'';
  $('#chapterStatus').value=c.status||'draft'; $('#chapterSummary').value=c.summary||'';
  $('#chapterContent').innerHTML=c.content||'';
  chapterQuickPhotos=(c.chapter_photos||[]).map(cp=>({id:cp.photo_id,title:cp.photos?.title||''}));
  chapterQuickSources=(c.chapter_sources||[]).map(cs=>({id:cs.source_id,title:cs.sources?.title||''}));
  $('#chapterQuickPhoto').value=''; $('#chapterQuickSource').value='';
  renderChapterPhotoChips();
  $('#saveChapterBtn').textContent='Salvar capítulo';
}
async function saveChapter(e){
  e.preventDefault(); showError($('#chaptersError'),'');
  const id=$('#chapterId').value;
  const title=$('#chapterTitle').value.trim();
  if(!title){showError($('#chaptersError'),'Informe o título do capítulo.');return}
  const status=$('#chapterStatus').value;
  const existing=id?currentChapters.find(c=>c.id===id):null;
  let num=numOrNull($('#chapterNumber').value);
  if(num===null&&!id) num=currentChapters.reduce((m,c)=>Math.max(m,Number(c.chapter_number)||0),0)+1;
  const payload={book_id:activeBookId,title,subtitle:nn($('#chapterSubtitle').value),summary:nn($('#chapterSummary').value),content:nn(sanitizeRichHtml($('#chapterContent').innerHTML)),status,chapter_number:num,published_at:pubAt(status,existing)};
  let error, chapterId=id;
  if(id){({error}=await client.from('chapters').update(payload).eq('id',id));}
  else {const res=await client.from('chapters').insert(payload).select('id').single(); error=res.error; chapterId=res.data?.id;}
  if(error){dbErr($('#chaptersError'),error);return}
  if(chapterId){
    const origPhotos=new Set((existing?.chapter_photos||[]).map(cp=>cp.photo_id));
    const curPhotos=new Set(chapterQuickPhotos.map(p=>p.id));
    const removePhotos=[...origPhotos].filter(pid=>!curPhotos.has(pid));
    const addPhotos=chapterQuickPhotos.filter(p=>!origPhotos.has(p.id));
    if(removePhotos.length) await client.from('chapter_photos').delete().eq('chapter_id',chapterId).in('photo_id',removePhotos);
    if(addPhotos.length){
      const maxOrder=Math.max(0,...(existing?.chapter_photos||[]).map(cp=>cp.order_index||0));
      await client.from('chapter_photos').insert(addPhotos.map((p,i)=>({chapter_id:chapterId,photo_id:p.id,order_index:maxOrder+1+i})));
    }
    const origSources=new Set((existing?.chapter_sources||[]).map(cs=>cs.source_id));
    const curSources=new Set(chapterQuickSources.map(s=>s.id));
    const removeSources=[...origSources].filter(sid=>!curSources.has(sid));
    const addSources=chapterQuickSources.filter(s=>!origSources.has(s.id));
    if(removeSources.length) await client.from('chapter_sources').delete().eq('chapter_id',chapterId).in('source_id',removeSources);
    if(addSources.length) await client.from('chapter_sources').insert(addSources.map(s=>({chapter_id:chapterId,source_id:s.id})));
  }
  resetChapterForm({keepGroup:true}); showToast(id?'Capítulo atualizado.':'Capítulo cadastrado.'); await loadChapters(); await loadBooks(); await loadAllChapters();
}
async function deleteChapter(id){
  const chap=currentChapters.find(c=>c.id===id);
  if(!await confirmDelete(`Excluir "${chap?.title||'este capítulo'}"?`,'Esta ação não pode ser desfeita.')) return;
  const {error}=await client.from('chapters').delete().eq('id',id);
  if(error){alert(error.message);return} showToast('Capítulo excluído.'); resetChapterForm(); await loadChapters(); await loadBooks(); await loadAllChapters();
}

/* ---------- Configurações ---------- */
function renderConfig(){
  $('#cfgRole').textContent=role?String(role).toUpperCase():'—';
  $('#cfgEmail').textContent=$('#userEmail').textContent||'—';
  try{$('#cfgProject').textContent=new URL(window.SUPABASE_URL).hostname.split('.')[0];}catch{$('#cfgProject').textContent='—';}
}

/* ---------- Carga geral ---------- */
async function loadAcervo(){
  await loadPlaces();
  await Promise.all([loadPhotos(),loadDocuments()]);
  await Promise.all([loadAlbums(),loadEvents(),loadSources(),loadBooks(),loadAllChapters()]);
  renderConfig();
}
function chapterQuickLabel(c){return `Cap. ${c.chapter_number} — ${c.title}${c.subtitle?' · '+c.subtitle:''}`}
async function loadAllChapters(){
  const {data,error}=await client.from('chapters').select('id,chapter_number,title,subtitle').order('chapter_number',{ascending:true});
  if(error) return;
  chaptersQuickLabelMap=new Map();
  $('#chaptersQuickList').innerHTML=(data||[]).map(c=>{
    let label=chapterQuickLabel(c);
    if(chaptersQuickLabelMap.has(label)) label=`${label} · ${c.id.slice(0,8)}`;
    chaptersQuickLabelMap.set(label,c.id);
    return `<option value="${escapeHtml(label)}"></option>`;
  }).join('');
}
