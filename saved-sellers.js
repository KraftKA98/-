function newSavedSellerState(owner=null){return {owner,ids:new Set(),known:false,idsAt:0,attemptAt:0,idSeq:0,readPromise:null,version:0,busy:new Set(),rows:[],loaded:false,loading:false,listSeq:0,error:'',query:'',sort:'saved',visible:30}}
let savedSellerState=newSavedSellerState(),savedSellerTimer=null;
function syncSavedSellerIdentity(){
 const owner=user?.id||null;if(savedSellerState.owner===owner)return;
 savedSellerState=newSavedSellerState(owner);updateSavedSellerButtons();renderSavedSellers();
}
function savedSellerButtonMarkup(id){
 if(!/^[0-9a-f-]{36}$/i.test(String(id))||user?.id===id)return '';
 scheduleSavedSellerIds();const saved=savedSellerState.owner===user?.id&&savedSellerState.ids.has(id),busy=savedSellerState.busy.has(id);
 return `<button class="btn ghost saved-seller-button" data-saved-seller="${id}" aria-pressed="${saved}" ${busy?'disabled':''} onclick="setSavedSeller('${id}',${!saved},'${user?.id||''}')">${saved?'♥ Убрать из избранных':'♡ Сохранить продавца'}</button>`;
}
function updateSavedSellerButtons(){
 for(const button of document.querySelectorAll('[data-saved-seller]')){
  const id=button.dataset.savedSeller,saved=savedSellerState.owner===user?.id&&savedSellerState.ids.has(id),busy=savedSellerState.busy.has(id);
  button.hidden=user?.id===id;button.disabled=busy;button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-busy',String(busy));
  button.textContent=busy?'Сохраняем…':saved?'♥ Убрать из избранных':'♡ Сохранить продавца';button.setAttribute('onclick',`setSavedSeller('${id}',${!saved},'${user?.id||''}')`);
 }
}
function scheduleSavedSellerIds(){
 if(!user||!db||savedSellerTimer!==null)return;
 savedSellerTimer=setTimeout(()=>{savedSellerTimer=null;loadSavedSellerIds(false)},0);
}
async function loadSavedSellerIds(force=false){
 syncSavedSellerIdentity();if(!user||!db)return false;const state=savedSellerState,owner=user.id;
 if(!force&&Date.now()-state.attemptAt<30000)return state.known;if(state.readPromise&&!force)return state.readPromise;
 const sequence=++state.idSeq,version=state.version;state.attemptAt=Date.now();
 const pending=Promise.resolve().then(async()=>{
  try{
   const {data,error}=await db.from('saved_sellers').select('seller_id,created_at').eq('user_id',owner).order('created_at',{ascending:false}).limit(200);if(error)throw error;
   if(savedSellerState!==state||user?.id!==owner||state.idSeq!==sequence||state.version!==version)return false;
   state.ids=new Set((data||[]).map(r=>r.seller_id));state.known=true;state.idsAt=Date.now();return true;
  }catch(error){return false}
  finally{if(savedSellerState===state&&state.idSeq===sequence){state.readPromise=null;updateSavedSellerButtons()}}
 });state.readPromise=pending;return pending;
}
async function setSavedSeller(id,desired,expectedOwner=null){
 if(!requireAuth())return;syncSavedSellerIdentity();const state=savedSellerState,owner=user.id;
 if(expectedOwner!==null&&expectedOwner!==owner)return toast('Аккаунт изменился. Нажмите кнопку ещё раз');
 if(id===owner)return toast('Свой профиль сохранять не нужно');if(state.busy.has(id))return;
 state.busy.add(id);updateSavedSellerButtons();
 try{
  const result=desired?await db.from('saved_sellers').insert({user_id:owner,seller_id:id}):await db.from('saved_sellers').delete().eq('user_id',owner).eq('seller_id',id);
  if(result.error&&!(desired&&result.error.code==='23505'))throw result.error;
  if(savedSellerState!==state||user?.id!==owner)return;
  state.version++;state.idSeq++;state.readPromise=null;desired?state.ids.add(id):state.ids.delete(id);state.known=true;state.idsAt=Date.now();
  if(!desired)state.rows=state.rows.filter(row=>row.seller_id!==id);
  toast(desired?'Продавец сохранён':'Продавец удалён из избранных');
  if(mode==='saved-sellers')loadSavedSellers();
 }catch(error){if(savedSellerState===state&&user?.id===owner)toast(error.message||'Не удалось изменить избранных продавцов')}
 finally{if(savedSellerState===state&&user?.id===owner){state.busy.delete(id);updateSavedSellerButtons();loadSavedSellerIds(true)}}
}
function openSavedSellers(){if(!requireAuth())return;navigate('saved-sellers')}
function savedSellerRating(row){
 const count=Number(row.review_count),average=Number(row.average_rating);
 return count>0&&Number.isFinite(average)&&average>=1&&average<=5?`⭐ ${average.toFixed(1)} / 5 · ${count} оценок`:'☆ Пока без оценок';
}
function filteredSavedSellers(rows,query,sort){
 const tokens=directoryNormalize(query).split(' ').filter(Boolean),filtered=rows.filter(row=>tokens.every(token=>directoryNormalize([row.available?row.display_name:'Продавец недоступен',row.available?row.city:''].join(' ')).includes(token)));
 return filtered.sort((a,b)=>{
  if(sort==='name'){const difference=String(a.available?a.display_name:'Продавец недоступен').localeCompare(String(b.available?b.display_name:'Продавец недоступен'),'ru');if(difference)return difference}
  if(sort==='rating'){const score=row=>row.available&&Number(row.review_count)>0&&Number.isFinite(Number(row.average_rating))?Number(row.average_rating):-1,difference=score(b)-score(a);if(difference)return difference}
  return new Date(b.saved_at)-new Date(a.saved_at)||a.seller_id.localeCompare(b.seller_id);
 });
}
function savedSellerCard(row){
 const available=row.available===true,avatar=available&&row.avatar_path?`<img class="avatar" src="${esc(avatarURL(row.avatar_path))}" alt="" loading="lazy">`:'<div class="avatar" aria-hidden="true">👤</div>';
 return `<article class="card saved-seller-card" data-saved-seller-card="${row.seller_id}"><div class="row">${avatar}<div><h3>${esc(available?row.display_name||'Продавец':'Продавец недоступен')}</h3>${available?`<p class="small muted">📍 ${esc(row.city||'Город не указан')}</p>`:''}</div></div>${available?`<p>${esc(savedSellerRating(row))}</p><p class="small muted">Завершено сделок: ${Number(row.completed_deals)||0}${row.business_verified?' · ИП / компания проверены':''}</p>`:'<p class="small muted">Публичный профиль сейчас недоступен. Запись можно удалить из списка.</p>'}<div class="row saved-seller-actions">${available?`<button class="btn ghost" onclick="showSeller('${row.seller_id}')">Профиль и отзывы</button><button class="btn ghost" onclick="contactSellerV236('${row.seller_id}')">Написать</button>`:''}${savedSellerButtonMarkup(row.seller_id)}</div></article>`;
}
function filterSavedSellerList(){
 savedSellerState.query=$('savedSellerSearch')?.value||'';savedSellerState.sort=$('savedSellerSort')?.value||'saved';savedSellerState.visible=30;renderSavedSellers();
}
function moreSavedSellers(){savedSellerState.visible+=30;renderSavedSellers()}
function renderSavedSellers(){
 const host=$('savedSellerList'),status=$('savedSellerStatus'),more=$('savedSellerMore');if(!host||!status||!more)return;
 if(!user){host.innerHTML='<div class="empty">Войдите, чтобы видеть избранных продавцов.</div><button class="btn block" onclick="openAuth()">Войти</button>';status.textContent='';more.innerHTML='';return}
 if($('savedSellerSearch')&&$('savedSellerSearch').value!==savedSellerState.query)$('savedSellerSearch').value=savedSellerState.query;
 if($('savedSellerSort'))$('savedSellerSort').value=savedSellerState.sort;
 const rows=filteredSavedSellers(savedSellerState.rows,savedSellerState.query,savedSellerState.sort);
 status.textContent=savedSellerState.loading?'Обновляем список…':savedSellerState.error?'Не удалось обновить список: '+savedSellerState.error:`Сохранено ${savedSellerState.rows.length} из 200 · найдено ${rows.length}`;
 host.innerHTML=rows.length?rows.slice(0,savedSellerState.visible).map(savedSellerCard).join(''):savedSellerState.loading?'<div class="loader">Загружаем продавцов…</div>':savedSellerState.error?'<button class="btn ghost" onclick="loadSavedSellers()">Повторить</button>':savedSellerState.rows.length?'<div class="empty">По этому имени или городу продавцов не найдено.</div>':'<div class="empty">Избранных продавцов пока нет. Сохраните продавца из профиля или предложения.</div>';
 more.innerHTML=rows.length>savedSellerState.visible?'<button class="btn ghost block" onclick="moreSavedSellers()">Показать ещё</button>':'';updateSavedSellerButtons();
}
async function loadSavedSellers(){
 syncSavedSellerIdentity();if(!user){renderSavedSellers();return}const state=savedSellerState,owner=user.id,sequence=++state.listSeq,version=state.version;
 state.loading=true;state.error='';renderSavedSellers();
 try{
  const {data,error}=await db.rpc('hochu_saved_sellers_v247');if(error)throw error;
  if(savedSellerState!==state||user?.id!==owner||state.listSeq!==sequence||state.version!==version)return;
  if(!data||!Array.isArray(data.items))throw Error('Некорректный список продавцов');
  state.rows=data.items;state.loaded=true;state.ids=new Set(state.rows.map(row=>row.seller_id));state.known=true;state.idsAt=state.attemptAt=Date.now();state.idSeq++;state.readPromise=null;
 }catch(error){if(savedSellerState===state&&user?.id===owner&&state.listSeq===sequence)state.error=error.message||'Ошибка загрузки'}
 finally{if(savedSellerState===state&&user?.id===owner&&state.listSeq===sequence){state.loading=false;renderSavedSellers();updateSavedSellerButtons()}}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&db&&user){if(mode==='saved-sellers')loadSavedSellers();else loadSavedSellerIds(true)}});
