// Server-owned saved searches; no private search data is stored in localStorage.
function savedSearchWords(value){return directoryNormalize(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim()}
function savedSearchCriteria(source){
 const home=source==='home',f=home?{category:homeCategorySelectedV232,city:$('homeCityV231')?.value,brand:homeBrandFilter,model:homeModelFilter,min:$('homeMinV231')?.value,max:$('homeMaxV231')?.value}:catalogFilterV2321;
 const category=f.category||'',brand=canonicalBrand(String(f.brand||'').trim()),model=String(f.model||'').trim();
 const query=String($(home?'homeFeedSearch':'search')?.value||'').trim();
 const min=String(f.min??''),max=String(f.max??'');
 if([min,max].some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||Number(v)>1e9))||(min!==''&&max!==''&&Number(min)>Number(max)))throw Error('Проверь диапазон бюджета');
 if(model&&!brand)throw Error('Для сохранения модели выбери бренд');
 if(query.length>120)throw Error('Сократи поисковый запрос до 120 символов');
 const group=categoryGroup(category),record=modelRecord(category,brand,model);
 return {category,categories:category?(group?.[1]===category?[category,...group[2]]:[category]):[],query,query_keys:canonicalBrandIndex.has(directoryNormalize(query))?[...new Set([canonicalBrand(query),...(brandAliases[canonicalBrand(query)]||[])].map(savedSearchWords))]:[],city:String(f.city||'').trim(),brand,brand_keys:brand?[...new Set([brand,...(brandAliases[brand]||[])].map(savedSearchWords))]:[],model,model_keys:model?[...new Set([model,record?.name].filter(Boolean).flatMap(name=>[modelSearchKey(name),modelKeyForBrand(name,brand)]))]:[],min_budget:min===''?null:Number(min),max_budget:max===''?null:Number(max)};
}
function savedSearchSummary(s){return [s.category||'Все категории',s.query?'«'+s.query+'»':'',s.brand,s.model,s.city||'Все города',s.min_budget!=null?'от '+money(s.min_budget):'',s.max_budget!=null?'до '+money(s.max_budget):''].filter(Boolean).join(' · ')}
function openSaveSearch(source){
 if(!requireAuth())return;
 try{
  const criteria=savedSearchCriteria(source);
  const title=[criteria.brand,criteria.model,criteria.category,criteria.query].filter(Boolean).join(' · ').slice(0,80)||'Мой поиск';
  modal({title:'🔖 Сохранить поиск',body:`<form id="saveSearchForm"><label class="fieldlabel" for="savedSearchName">Название</label><input class="field" id="savedSearchName" name="name" maxlength="80" required value="${esc(title)}"><p class="small muted">${esc(savedSearchSummary(criteria))}</p><p>Сообщим в колокольчике о новых желаниях других покупателей по этим условиям.</p>${Object.values(catalogFilterV2321.details||{}).some(Boolean)&&source!=='home'?'<p class="notice small">Фильтры характеристик (размер, память, год, пробег и состояние) действуют в текущем каталоге и не входят в сохранённый поиск.</p>':''}${typeof auctionFeedFilters!=='undefined'&&auctionFeedFilters[source]?.only?'<p class="notice small">Сохраним категорию, текст, город, бренд, модель и бюджет. Фильтры торгов и срока окончания не входят в условия уведомлений.</p>':''}<p class="small muted">Учитываются условия, перечисленные выше. Модель сравнивается точно в заполненных характеристиках; старые описания ищем по тексту. Город — по введённому названию. Уже опубликованные желания можно посмотреть в результатах поиска.</p><p id="saveSearchError" class="small" role="alert"></p><button class="btn block" type="submit">Сохранить и включить уведомления</button></form>`});
  $('saveSearchForm').addEventListener('submit',event=>saveSearch(event,criteria));
 }catch(error){toast(error.message)}
}
async function saveSearch(event,criteria){
 event.preventDefault();const form=event.currentTarget;if(form.dataset.busy||!requireAuth())return;
 const owner=user.id,name=String(new FormData(form).get('name')||'').trim();if(!name)return;
 form.dataset.busy='true';form.querySelector('button').disabled=true;const errorHost=form.querySelector('[role=alert]');errorHost.textContent='';
 try{
  const {error}=await db.from('saved_searches').insert({user_id:owner,name,...criteria});if(error)throw error;
  if(user?.id!==owner)return;
  if(form.isConnected){closeModal();await openSavedSearches()}toast('Поиск сохранён. Уведомления включены');
 }catch(error){if(form.isConnected)errorHost.textContent=savedSearchError(error)}
 finally{delete form.dataset.busy;if(form.isConnected)form.querySelector('button').disabled=false}
}
function savedSearchError(error){return ['42P01','PGRST205','42883','PGRST202'].includes(error.code)?'Сохранённый поиск пока недоступен. Обнови страницу и повтори попытку.':error.message||'Не удалось выполнить действие. Попробуй ещё раз.'}
async function openSavedSearches(){
 if(!requireAuth())return;const owner=user.id;
 modal({title:'🔖 Сохранённые поиски',body:'<div id="savedSearchList" class="loader">Загрузка…</div>'});
 const host=$('savedSearchList');
 try{
  const {data,error}=await db.from('saved_searches').select('id,name,category,query,city,brand,model,min_budget,max_budget,enabled,created_at').eq('user_id',owner).order('created_at',{ascending:false});if(error)throw error;
  if(!host.isConnected||user?.id!==owner)return;
  host.innerHTML=`<p class="small muted">До 20 поисков в аккаунте. Уведомления о новых желаниях появятся в колокольчике, даже если поиск сохранён с другого устройства.</p>${data?.length?data.map(s=>`<article class="card"><b>${esc(s.name)}</b><p class="small muted" style="overflow-wrap:anywhere">${esc(savedSearchSummary(s))}</p><p class="small">${s.enabled?'🟢 Уведомления включены':'⏸ Уведомления на паузе'}</p><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn ghost" onclick="openSavedSearchResults('${s.id}')">Посмотреть желания</button><button class="btn ghost" onclick="changeSavedSearch(this,'${s.id}','${s.enabled?'pause':'resume'}')">${s.enabled?'Пауза':'Включить'}</button><button class="btn gray" onclick="changeSavedSearch(this,'${s.id}','delete')">Удалить</button></div></article>`).join(''):'<div class="empty">Поисков пока нет. Выбери условия в ленте или каталоге и нажми «Сохранить поиск».</div>'}`;
 }catch(error){if(host.isConnected)host.textContent=savedSearchError(error)}
}
async function changeSavedSearch(button,id,action){
 if(!requireAuth()||button.disabled)return;if(action==='delete'&&!confirm('Удалить сохранённый поиск?'))return;
 button.disabled=true;
 try{
  const operation=action==='delete'?db.from('saved_searches').delete():db.from('saved_searches').update({enabled:action==='resume'});
  const {error}=await operation.eq('id',id).eq('user_id',user.id);if(error)throw error;
  if(button.isConnected)await openSavedSearches();
 }catch(error){toast(savedSearchError(error));if(button.isConnected)button.disabled=false}
}
async function openSavedSearchResults(id){
 if(!requireAuth())return;const owner=user.id;
 modal({title:'Совпадения с поиском',body:'<div id="savedSearchResults" class="loader">Ищем желания…</div>'});const host=$('savedSearchResults');
 try{
  const {data,error}=await db.rpc('hochu_saved_search_results_v242',{p_search_id:id});if(error)throw error;
  if(!host.isConnected||user?.id!==owner)return;
  const rows=(data||[]).filter(requestIsCurrent);for(const row of rows){const i=requests.findIndex(r=>r.id===row.id);if(i<0)requests.push(row);else requests[i]=row}
  host.className='';host.innerHTML=`<button class="btn ghost block" onclick="openSavedSearches()">← Сохранённые поиски</button><p class="small muted">Найдено: ${rows.length}${rows.length===100?' · показаны последние 100':''}. Уведомления приходят о новых желаниях после сохранения поиска.</p>${rows.length?rows.map(requestCard).join(''):'<div class="empty">Пока нет подходящих желаний. Можно вернуться позже.</div>'}`;queueRequestPhotos();
 }catch(error){if(host.isConnected)host.textContent=savedSearchError(error)}
}
async function openMatchedNotification(requestId,notificationId){
 if(!requireAuth())return;
 try{
  const owner=user.id;
  const result=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at').eq('id',requestId).maybeSingle();if(result.error)throw result.error;
  if(user?.id!==owner)return;
  const {error}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',notificationId);if(error)throw error;
  await loadNotifications();
  if(!result.data||result.data.is_hidden||result.data.status!=='open')return toast('Это желание уже закрыто или недоступно');
  const i=requests.findIndex(r=>r.id===requestId);if(i<0)requests.push(result.data);else requests[i]=result.data;
  closeModal();showRequest(requestId);
 }catch(error){toast('Не удалось открыть желание: '+error.message)}
}
