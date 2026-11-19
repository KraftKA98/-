let requestEditorState=null;
const requestPhotoCache=new Map();
let requestPhotoRefreshQueued=false;
function clearRequestEditor(){
  if(requestEditorState?.busy)return false;
  for(const item of requestEditorState?.files||[])URL.revokeObjectURL(item.url);
  requestEditorState=null;return true;
}
function editableWish(request){return !!request&&request.buyer_id===user?.id&&request.status==='open'&&!request.is_hidden&&(typeof requestIsCurrent!=='function'||requestIsCurrent(request))&&!deals.some(deal=>deal.request_id===request.id)}
function requestPhotoPaths(request){return Array.isArray(request?.image_paths)?request.image_paths.filter(path=>typeof path==='string').slice(0,5):[]}
function requestPhotosMarkup(request,cover=false){
  const paths=requestPhotoPaths(request);if(!paths.length)return '';
  if(cover)return `<div class="request-cover"><img data-request-photo="${esc(paths[0])}" loading="lazy" alt="Фото к желанию" hidden><span class="chip">📷 ${paths.length}</span></div>`;
  return `<div class="request-photo-gallery">${paths.map(path=>`<a data-request-photo-link="${esc(path)}" target="_blank" rel="noopener" hidden><img data-request-photo="${esc(path)}" loading="lazy" alt="Фото к желанию" hidden></a>`).join('')}</div>`;
}
function queueRequestPhotos(){
  if(requestPhotoRefreshQueued)return;requestPhotoRefreshQueued=true;
  Promise.resolve().then(async()=>{
    requestPhotoRefreshQueued=false;if(!db)return;
    const viewer=user?.id||'guest';
    if(queueRequestPhotos.viewer!==viewer){requestPhotoCache.clear();queueRequestPhotos.viewer=viewer}
    const images=[...document.querySelectorAll('img[data-request-photo]')];
    const paths=[...new Set(images.map(image=>image.dataset.requestPhoto))];
    const missing=paths.filter(path=>(requestPhotoCache.get(path)?.expires||0)<Date.now());
    if(missing.length){
      try{
        const {data,error}=await db.storage.from('hochu-request-images').createSignedUrls(missing,3600);
        if(viewer!==(user?.id||'guest'))return;
        if(!error)for(const item of data||[])if(item.signedUrl&&!item.error)requestPhotoCache.set(item.path,{url:item.signedUrl,expires:Date.now()+3000000});
      }catch(error){console.warn('Фото желания временно недоступны')}
    }
    if(viewer!==(user?.id||'guest'))return;
    for(const image of document.querySelectorAll('img[data-request-photo]')){
      const record=requestPhotoCache.get(image.dataset.requestPhoto);if(!record||record.expires<Date.now())continue;
      image.src=record.url;image.hidden=false;
      const link=image.closest('a[data-request-photo-link]');if(link){link.href=record.url;link.hidden=false}
    }
  }).catch(()=>{});
}
function requestPhotoEditorMarkup(){
  return `<section class="fieldset"><span class="fieldlabel">Фото-примеры желания</span><p class="small muted">До 5 фотографий, каждая до 5 МБ. JPEG, PNG или WebP. Фото будут видны вместе с желанием.</p><label class="btn ghost request-photo-add">＋ Добавить фото<input type="file" accept="image/jpeg,image/png,image/webp" multiple data-request-photos onchange="addRequestPhotos(this)"></label><div id="requestPhotoDraft" class="request-photo-draft"></div><div id="requestEditorError" class="notice" role="alert" hidden></div></section>`;
}
function renderRequestPhotoDraft(){
  const host=$('requestPhotoDraft'),state=requestEditorState;if(!host||!state)return;
  host.innerHTML=state.keep.map((path,i)=>`<div class="request-photo-item"><img data-request-photo="${esc(path)}" alt="Прикреплённое фото" hidden><button type="button" class="request-photo-remove" aria-label="Убрать фото ${i+1}" onclick="removeRequestPhoto('keep',${i})">×</button></div>`).join('')+state.files.map((item,i)=>`<div class="request-photo-item"><img src="${esc(item.url)}" alt="Новое фото ${i+1}"><button type="button" class="request-photo-remove" aria-label="Убрать новое фото ${i+1}" onclick="removeRequestPhoto('new',${i})">×</button></div>`).join('');
  queueRequestPhotos();if(typeof updateWishGuidanceV32==='function')updateWishGuidanceV32();
}
function addRequestPhotos(input){
  const state=requestEditorState;if(!state||state.busy)return;
  const files=Array.from(input.files||[]);input.value='';
  try{
    if(files.length+state.keep.length+state.files.length>5)throw Error('Можно прикрепить не больше 5 фотографий');
    files.forEach(file=>{validateImage(file,5);if(!file.size)throw Error('Пустой файл нельзя загрузить')});
    for(const file of files)state.files.push({file,url:URL.createObjectURL(file)});
    renderRequestPhotoDraft();
  }catch(error){toast(error.message)}
}
function removeRequestPhoto(kind,index){
  const state=requestEditorState;if(!state||state.busy)return;
  if(kind==='keep')state.keep.splice(index,1);
  else{const [item]=state.files.splice(index,1);if(item)URL.revokeObjectURL(item.url)}
  renderRequestPhotoDraft();
}
function requestEditPrefill(request){
  const result={...request,details:{}};if(!isKnownCategory(request.category))return result;
  const blocks=String(request.description||'').split('\n\n'),lines=blocks[0].split('\n');
  const definitions=requestFieldDefinitions(request.category),notes=['Зарплата указана за месяц','Бюджет указан за месяц','Бюджет указан за сутки'];
  const details={};let brand='';
  for(const line of lines){
    if(notes.includes(line))continue;
    if(line.startsWith('Бренд / марка: ')){if(!categoryHasBrand(request.category))return result;brand=line.slice('Бренд / марка: '.length);continue}
    let definition=definitions.find(([,label])=>line.startsWith(label+': '));
    if(!definition&&line.startsWith('Память и важные характеристики: ')&&isPhoneModelCategory(request.category))definition=['specs','Память и важные характеристики','text'];
    if(!definition)return result;
    const [key,label,type,options]=definition,value=line.slice(label.length+2);
    if(type==='select'&&!options.includes(value))return result;
    details[key]=value;
  }
  if(!lines[0])return result;
  if(lines.includes('Бюджет указан за месяц')&&details.intent!=='Снять на длительный срок')return result;
  if(lines.includes('Бюджет указан за сутки')&&details.intent!=='Снять посуточно')return result;
  if(lines.includes('Зарплата указана за месяц')&&categoryGroup(request.category)?.[1]!=='Работа')return result;
  return {...result,brand,details,description:blocks.slice(1).join('\n\n')};
}
function openRequestEditor(id=null,prefill={}){
  if(!requireAuth())return;
  if(requestEditorState?.busy)return toast('Дождитесь сохранения');
  const original=id?requests.find(request=>request.id===id):null;
  if(id&&!editableWish(original))return toast('Редактировать можно своё активное желание до выбора продавца');
  const values=original?requestEditPrefill(original):prefill;
  let body=requestFormMarkup(values);
  if(original)body='<p class="small muted">Изменения увидят продавцы. Полученные предложения сохранятся со своими прежними условиями.</p>'+body.replace('Опубликовать желание','Сохранить изменения');
  modal({title:original?'Редактировать желание':'Новое желание',body});
  requestEditorState={id:original?.id||crypto.randomUUID(),original,revision:original?.revision||0,editing:!!original,keep:requestPhotoPaths(original),files:[],busy:false};
  const form=$('modal').querySelector('form');
  if(original&&!isKnownCategory(original.category)){
    const option=new Option(original.category,original.category,true,true);form.elements.categoryParent.add(option);form.elements.category.value=original.category;
  }
  for(const [key,value] of Object.entries(values.details||{})){const field=form.elements['detail_'+key];if(field)field.value=value}
  refreshRequestBudget(form);renderRequestPhotoDraft();if(typeof socialBindDraft==='function')socialBindDraft(form);if(typeof bindWishGuidanceV32==='function')bindWishGuidanceV32(form);if(typeof simplifyWishFormV36==='function')simplifyWishFormV36(form);addSharingFieldsV49(form,original?.id||null);
}
function validateRequestRecord(record,original){
  if(!isKnownCategory(record.category)&&record.category!==original?.category)throw Error('Выберите категорию');
  if(record.title.length<4||record.title.length>120||record.city.length<2||record.city.length>100||!Number.isFinite(record.budget)||record.budget<1||record.budget>1000000000)throw Error('Проверьте название, город и бюджет');
}
async function removeUnreferencedRequestPhotos(paths){
  if(!paths.length)return;
  try{const {error}=await db.storage.from('hochu-request-images').remove(paths);if(error)console.warn('Некоторые удалённые фото ещё находятся в хранилище')}catch(error){console.warn('Удаление файлов временно недоступно')}
}
async function submitRequestEditor(event){
  event.preventDefault();if(!requireAuth())return;
  const state=requestEditorState;if(!state||state.busy)return;
  const form=event.target,values=new FormData(form),actor=user.id;
  const record={id:state.id,buyer_id:actor,title:String(values.get('title')||'').trim(),category:String(values.get('category')||''),city:String(values.get('city')||'').trim(),budget:Number(values.get('budget')),description:''};
  const controlStates=[...form.elements].map(control=>[control,control.disabled]);
  let uploaded=[],createdNow=false;
  try{
    record.description=requestDescription(values,record.category);validateRequestRecord(record,state.original);if(!state.editing){record.valid_for_days=Number(values.get('valid_for_days')||30);if(![7,14,30,90].includes(record.valid_for_days))throw Error('Проверьте срок актуальности')}
    state.busy=true;for(const [control] of controlStates)control.disabled=true;
    if(!state.editing){
      const {error}=await db.from('requests').insert({...record,image_paths:[]});
      if(error)throw error;
      createdNow=true;state.editing=true;state.original={...record,...(typeof requestLifetimeCreatedFields==='function'?requestLifetimeCreatedFields(record.valid_for_days):{}),image_paths:[],revision:0,status:'open',is_hidden:false,created_at:new Date().toISOString()};
    }
    let failed=0;
    for(const item of state.files){
      const path=`${actor}/${record.id}/${crypto.randomUUID()}.${imageExt(item.file)}`;
      try{const {error}=await db.storage.from('hochu-request-images').upload(path,item.file,{contentType:item.file.type,upsert:false});if(error)throw error;uploaded.push(path)}catch(error){failed++}
    }
    if(failed&&!createdNow)throw Error(`Не загрузилось фото: ${failed}. Изменения не сохранены — повторите попытку.`);
    let saved=createdNow?state.original:null;
    if(!createdNow||uploaded.length){
      const {data,error}=await db.rpc('hochu_request_edit_v240',{p_request_id:record.id,p_expected_revision:state.revision,p_title:record.title,p_description:record.description,p_category:record.category,p_city:record.city,p_budget:record.budget,p_image_paths:[...state.keep,...uploaded]});
      if(error)throw error;saved=data;
      if(!saved?.id)throw Error('Сервер не подтвердил сохранение');
    }
    const removed=requestPhotoPaths(state.original).filter(path=>!state.keep.includes(path));
    await removeUnreferencedRequestPhotos(removed);
    const sharingWarning=await saveCreationSharingV49(saved.id,values,actor);if(user?.id!==actor)return;
    state.busy=false;if(typeof socialDraftPublished==='function')socialDraftPublished(state.id);closeModal();
    requests=requests.filter(request=>request.id!==saved.id);requests.unshift(saved);renderAll();
    await refreshAll();
    if(!requests.some(request=>request.id===saved.id))requests.unshift(saved);
    showRequest(saved.id);
    const message=(createdNow?'Желание опубликовано':'Изменения сохранены')+(failed?`. Не загрузилось фото: ${failed}. Их можно добавить через редактирование.`:'');
    if(failed){const notice=document.createElement('p');notice.className='notice';notice.textContent=message;$('modal').append(notice)}
    if(sharingWarning){const note=document.createElement('p');note.className='notice';note.setAttribute('role','alert');note.textContent=sharingWarning;$('modal').append(note)}
    toast(message);
  }catch(error){
    await removeUnreferencedRequestPhotos(uploaded);
    state.busy=false;
    const message=(createdNow?'Желание уже опубликовано, но фото не сохранены. Повторите сохранение. ':'')+(error.message||'Не удалось сохранить');
    const host=$('requestEditorError');if(host){host.textContent=message;host.hidden=false}
    if(createdNow){const button=form.querySelector('[type="submit"]');if(button)button.textContent='Сохранить изменения'}
    toast(message);
  }finally{state.busy=false;for(const [control,disabled] of controlStates)if(control.isConnected)control.disabled=disabled}
}
