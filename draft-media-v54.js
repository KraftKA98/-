// Device-only blobs: private drafts are keyed by account and draft identity.
let draftDatabaseV54=null;
const draftMediaQueuesV54=new Map(),draftMediaSignaturesV54=new Map();
function openDraftDatabaseV54(){
 if(!globalThis.indexedDB)return Promise.reject(Error('Хранилище фотографий недоступно'));
 if(!draftDatabaseV54)draftDatabaseV54=new Promise((resolve,reject)=>{const request=indexedDB.open('hochu-device-drafts-v54',1);request.onupgradeneeded=()=>request.result.createObjectStore('media',{keyPath:'key'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||Error('Хранилище фотографий недоступно'));request.onblocked=()=>reject(Error('Закройте старую вкладку для сохранения фото'))}).catch(e=>{draftDatabaseV54=null;throw e});
 return draftDatabaseV54;
}
async function draftMediaTransactionV54(mode,action){const db=await openDraftDatabaseV54();return new Promise((resolve,reject)=>{const tx=db.transaction('media',mode),request=action(tx.objectStore('media'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||request.error||Error('Не удалось сохранить фото'));tx.onabort=()=>reject(tx.error||Error('Сохранение фото прервано'))})}
function queueDraftMediaV54(key,job){const previous=draftMediaQueuesV54.get(key)||Promise.resolve();const next=previous.catch(()=>{}).then(job);draftMediaQueuesV54.set(key,next);next.finally(()=>{if(draftMediaQueuesV54.get(key)===next)draftMediaQueuesV54.delete(key)}).catch(()=>{});return next}
function persistDraftMediaV54(kind,b){
 const state=b.state,files=(kind==='wish'?orderedRequestItemsV54(state).filter(x=>x.kind==='new').map(x=>x.item.file):state.photos.map(p=>p.file)),id=state.id||state.token,key=draftKeyV52(kind,b.actor),signature=JSON.stringify([id,files.map(f=>[f.name,f.size,f.lastModified])]);
 const show=text=>{if(!b.done&&user?.id===b.actor&&b.form.isConnected)b.status.textContent=text};
 if(draftMediaSignaturesV54.get(key)===signature){show('Текст и фото черновика сохраняются на этом устройстве.');return}
 draftMediaSignaturesV54.set(key,signature);show('Текст сохранён. Сохраняем фото на устройстве…');
 void queueDraftMediaV54(key,()=>draftMediaTransactionV54('readwrite',store=>store.put({key,id,files,updated:Date.now()}))).then(()=>{if(draftMediaSignaturesV54.get(key)===signature)show('Текст и фото черновика сохранены на этом устройстве.')}).catch(()=>{if(draftMediaSignaturesV54.get(key)===signature)draftMediaSignaturesV54.delete(key);show('Текст сохранён, но фото не удалось сохранить на устройстве. После перезагрузки выберите их заново.')});
}
function deleteDraftMediaV54(kind,actor){const key=draftKeyV52(kind,actor);draftMediaSignaturesV54.delete(key);void queueDraftMediaV54(key,()=>draftMediaTransactionV54('readwrite',store=>store.delete(key))).catch(()=>{})}
const restoreDraftBaseV54=restoreLocalDraftV52;
restoreLocalDraftV52=async function(b,kind,saved){
 const fingerprint=JSON.stringify(draftFieldsV52(b.form)),state=b.state,actor=b.actor;let record;
 try{await(draftMediaQueuesV54.get(draftKeyV52(kind,actor))||Promise.resolve());record=await draftMediaTransactionV54('readonly',store=>store.get(draftKeyV52(kind,actor)))}catch{record=null}
 if(b.done||user?.id!==actor||!b.form.isConnected||(kind==='wish'?requestEditorState:crowdDraftV43)!==state)return false;
 if(JSON.stringify(draftFieldsV52(b.form))!==fingerprint){b.status.textContent='Форма изменилась. Нажмите «Продолжить черновик» ещё раз, если хотите заменить введённые поля.';return false}
 if(record?.id===saved.id&&Array.isArray(record.files))localDraftPhotosV52.set(draftKeyV52(kind,actor),record.files.filter(f=>f instanceof Blob&&f.size>0));
 restoreDraftBaseV54(b,kind,saved);
 b.status.textContent='Черновик восстановлен'+(record?.files?.length?' вместе с фото.':'.')+' Проверьте его перед публикацией.';
 return true;
};
function orderedRequestItemsV54(state){
 const items=[...state.keep.map(path=>({key:'keep:'+path,kind:'keep',path})),...state.files.map(item=>({key:item.mediaKeyV54||(item.mediaKeyV54=crypto.randomUUID()),kind:'new',item}))],map=new Map(items.map(x=>[x.key,x]));
 const keys=[...(state.photoOrderV54||[]).filter(k=>map.has(k)),...items.map(x=>x.key).filter(k=>!(state.photoOrderV54||[]).includes(k))];state.photoOrderV54=keys;return keys.map(k=>map.get(k));
}
function photoOrderButtonsV54(kind,index,total){return `<div class="photo-order-v54">${index===0?'<span>Обложка</span>':`<button type="button" class="mini-link" onclick="moveDraftPhotoV54('${kind}',${index},-${index})">На обложку</button>`}<button type="button" aria-label="Переместить фото левее" onclick="moveDraftPhotoV54('${kind}',${index},-1)" ${index===0?'disabled':''}>‹</button><button type="button" aria-label="Переместить фото правее" onclick="moveDraftPhotoV54('${kind}',${index},1)" ${index===total-1?'disabled':''}>›</button></div>`}
function requestPhotoDraftMarkupV54(state){const items=orderedRequestItemsV54(state);return items.map((p,i)=>`<div class="request-photo-item ordered-photo-v54">${p.kind==='keep'?`<img data-request-photo="${esc(p.path)}" alt="Фото ${i+1}" hidden>`:`<img src="${esc(p.item.url)}" alt="Фото ${i+1}">`}<button type="button" class="request-photo-remove" aria-label="Убрать фото ${i+1}" onclick="removeOrderedPhotoV54(${i})">×</button>${photoOrderButtonsV54('wish',i,items.length)}</div>`).join('')}
function removeOrderedPhotoV54(index){const state=requestEditorState;if(!state||state.busy)return;const p=orderedRequestItemsV54(state)[index];if(p)removeRequestPhoto(p.kind==='keep'?'keep':'new',p.kind==='keep'?state.keep.indexOf(p.path):state.files.indexOf(p.item))}
function moveDraftPhotoV54(kind,index,delta){const state=kind==='wish'?requestEditorState:crowdDraftV43;if(!state||state.busy)return;const items=kind==='wish'?orderedRequestItemsV54(state):state.photos,to=index+delta;if(to<0||to>=items.length||index===to)return;const [item]=items.splice(index,1);items.splice(to,0,item);if(kind==='wish'){state.photoOrderV54=items.map(x=>x.key);state.files=items.filter(x=>x.kind==='new').map(x=>x.item);renderRequestPhotoDraft()}else{state.photos=items;renderCrowdDraftV43()}}
function orderedRequestPathsV54(state,uploaded){return orderedRequestItemsV54(state).map(x=>x.kind==='keep'?x.path:uploaded.get(x.item)).filter(Boolean)}
async function cleanRequestUploadsV54(state){const paths=[...new Set([...(state.uploadedV54?.values()||[]),...(state.files||[]).map(p=>p.uploadPathV54).filter(Boolean)])];if(!paths.length||!db||user?.id!==state.actorV54)return;try{const{data,error}=await db.from('requests').select('image_paths').eq('id',state.id).maybeSingle();if(error||user?.id!==state.actorV54)return;const keep=new Set(data?.image_paths||[]),orphans=paths.filter(p=>!keep.has(p));if(orphans.length)await db.storage.from('hochu-request-images').remove(orphans)}catch{}}
const offerMediaFormsV54=new Set();
function offerPhotoEntryV54(file){return{file,url:URL.createObjectURL(file),path:null,uploaded:false,attached:false,skip:false,error:''}}
function chooseOfferPhotosV54(input){const form=input.form;let state=form.offerMediaV54;if(state?.id)return;if(state)for(const p of state.files)URL.revokeObjectURL(p.url);state=form.offerMediaV54={files:Array.from(input.files||[]).map(offerPhotoEntryV54),id:null,busy:false};offerMediaFormsV54.add(form);renderOfferPhotosV54(form)}
function renderOfferPhotosV54(form){const state=form.offerMediaV54;if(!state)return;let host=form.querySelector('[data-offer-photo-preview-v54]');if(!host){host=document.createElement('div');host.dataset.offerPhotoPreviewV54='';host.className='offer-photo-preview-v54';form.querySelector('[name=photos]').insertAdjacentElement('afterend',host)}host.innerHTML=state.files.map((p,i)=>`<figure><img src="${esc(p.url)}" alt="Фото предложения ${i+1}"><figcaption>${esc(p.file.name)} · ${p.skip?'Пропущено':p.attached?'Загружено':p.error?'Ошибка загрузки':'Готово к отправке'}</figcaption>${!p.attached?`<button type="button" class="mini-link" ${state.busy?'disabled':''} onclick="removeOfferPhotoV54(this.form,${i})">${state.id?'Не загружать':'Убрать'}</button>`:''}</figure>`).join('')}
function removeOfferPhotoV54(form,index){const s=form.offerMediaV54,p=s?.files[index];if(!p||s.busy||p.attached)return;if(s.id)p.skip=true;else{s.files.splice(index,1);URL.revokeObjectURL(p.url)}renderOfferPhotosV54(form)}
async function sendOfferWithPhotosV54(event,id){
 event.preventDefault();const form=event.target;if(!requireAuth()||!form.reportValidity()||!startAction('offer:'+id))return;const stamp=accountStampV29(),actor=user.id;
 let state=form.offerMediaV54;if(!state){state=form.offerMediaV54={files:Array.from(form.querySelector('[name=photos]').files||[]).map(offerPhotoEntryV54),id:null,busy:false};offerMediaFormsV54.add(form)}
 const controls=[...form.elements].map(el=>[el,el.disabled]),feedback=beginSubmitV52(form,state.id?'Догружаем фото…':'Отправляем…');state.busy=true;controls.forEach(([el])=>el.disabled=true);
 try{
  if(!state.id){if(myOfferForRequest(id))throw Error('Предложение уже отправлено. Откройте чат');if(state.files.length>5)throw Error('Можно добавить до пяти фотографий');state.files.forEach(p=>validateImage(p.file,5));const f=new FormData();for(const [el]of controls)if(el.name&&el.type!=='file')f.set(el.name,el.value);const{data,error}=await db.from('offers').insert({request_id:id,seller_id:actor,price:Number(f.get('price')),valid_until:typeof offerExpiryValueV55==='function'?offerExpiryValueV55(form):null,description:offerDescription(f,requests.find(r=>r.id===id)?.category)}).select('id').single();if(error)throw error;state.id=data.id}
  if(!accountCurrentV29(stamp)||!form.isConnected)return;
  let failed=0;
  for(const p of state.files){if(p.attached||p.skip)continue;p.path ||=actor+'/'+state.id+'/'+crypto.randomUUID()+'.'+imageExt(p.file);try{
   if(!p.uploaded){const result=await uploadFileV54('hochu-offer-images',p.path,p.file,form);if(result.error){const probe=await db.storage.from('hochu-offer-images').createSignedUrl(p.path,30);if(probe.error)throw result.error;showUploadProgressV54(form,p.file.name,p.file.size,p.file.size,'done')}p.uploaded=true}
   if(!accountCurrentV29(stamp)||!form.isConnected)return;
   const existing=await db.from('offer_images').select('id').eq('offer_id',state.id).eq('path',p.path).maybeSingle();if(existing.error)throw existing.error;if(!existing.data){const result=await db.from('offer_images').insert({offer_id:state.id,path:p.path});if(result.error)throw result.error}p.attached=true;p.error='';
  }catch(e){p.error=e.message||'Не загрузилось фото';failed++}renderOfferPhotosV54(form)}
  if(failed)throw Error('Предложение уже отправлено. Не загрузилось фото: '+failed+'. Повторная отправка догрузит только оставшиеся файлы; цену и условия уже отправленного предложения менять нельзя.');
  if(!accountCurrentV29(stamp)||!form.isConnected)return;state.sent=true;closeModal();await refreshAll();navigate('inbox');toast('Предложение отправлено'+(state.files.some(p=>p.skip)?' без пропущенных фото':''));
 }catch(error){if(accountCurrentV29(stamp)&&form.isConnected){failSubmitV52(form,error.message||'Не удалось отправить');toast(error.message||'Не удалось отправить')}}
 finally{state.busy=false;endSubmitV52(feedback,!state.sent);for(const[el,disabled]of controls)if(el.isConnected)el.disabled=state.id&&el.type!=='submit'&&el.tagName!=='BUTTON'?true:disabled;renderOfferPhotosV54(form);endAction('offer:'+id)}
}
function cleanupOfferMediaV54(){for(const form of offerMediaFormsV54)if(!form.isConnected){for(const p of form.offerMediaV54?.files||[])URL.revokeObjectURL(p.url);offerMediaFormsV54.delete(form)}}
