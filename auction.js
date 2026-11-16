// State contains only aggregate competition data and the signed-in seller's own bid.
const auctionStates=new Map(),auctionReads=new Map();
function auctionKey(id){return (user?.id||'guest')+':'+id}
function cachedAuction(id){return auctionStates.get(auctionKey(id))}
function auctionRemaining(state,now=Date.now()){return Math.max(0,Date.parse(state.ends_at)-(now+(state.clockOffset||0)))}
function auctionTimeText(ms){const sec=Math.ceil(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60);return h+' ч '+m+' мин '+sec%60+' с'}
function auctionSelectionAllowed(id){const state=cachedAuction(id);return !state||['none','ended'].includes(state.status)||(state.status==='active'&&auctionRemaining(state)===0)}
function auctionStore(state,owner=user?.id){
 if(!state||!['none','active','ended','closed','selected'].includes(state.status)||!state.request_id)throw Error('Не удалось проверить состояние торгов');
 const key=owner+':'+state.request_id,previous=auctionStates.get(key);
 if(previous&&Date.parse(previous.server_now)>Date.parse(state.server_now))return previous;
 const value={...state,clockOffset:Date.parse(state.server_now)-Date.now()};auctionStates.set(key,value);if(typeof rememberAuctionSummary==='function')rememberAuctionSummary(value);return value;
}
async function auctionRead(id){
 if(!user)throw Error('Войдите для участия в торгах');const owner=user.id,key=auctionKey(id);
 if(auctionReads.has(key))return auctionReads.get(key);
 const promise=(async()=>{try{
  const {data,error}=await db.rpc('hochu_auction_state_v244',{p_request_id:id});if(error)throw error;
  return auctionStore(data,owner);
 }finally{auctionReads.delete(key)}})();auctionReads.set(key,promise);return promise;
}
function auctionError(error){return ['PGRST202','42883'].includes(error.code)?'Обновите страницу: сервер торгов пока недоступен.':error.message||'Не удалось загрузить торги'}
function auctionPanelMarkup(request){return request&&user?`<section class="auction-panel" data-auction-panel data-request-id="${esc(request.id)}"><p class="small muted">Проверяем торги…</p></section>`:''}
function auctionPanelContent(request,state){
 const mine=request.buyer_id===user?.id;
 if(state.status==='none')return mine&&request.status==='open'&&!request.is_hidden&&!offers.some(o=>o.request_id===request.id)&&!deals.some(d=>d.request_id===request.id)?`<h3>Торги между продавцами</h3><p class="small muted">Продавцы смогут снижать цену. Выбор продавца — за вами после окончания торгов.</p><button class="btn ghost block" onclick="openAuctionSetup('${request.id}')">Включить торги</button>`:'';
 const active=state.status==='active'&&auctionRemaining(state)>0;
 const titles={active:'Идут торги',ended:'Торги завершены — выбор за покупателем',closed:'Приём ставок остановлен',selected:'Продавец выбран'};
 const title=state.status==='active'&&!active?'Время торгов истекло':titles[state.status];
 return `<h3>🔻 ${title}</h3><p><b>${state.best_price==null?'Ставок пока нет':'Лучшая цена: '+money(state.best_price)}</b></p><p class="small muted">Шаг снижения: ${money(state.min_step)} · предложений: ${Number(state.offer_count)||0}<br>До ${esc(new Date(state.ends_at).toLocaleString('ru-RU'))}</p>${active?`<p class="auction-clock" data-auction-clock="${request.id}">${auctionTimeText(auctionRemaining(state))}</p>`:''}${!mine&&state.own_price!=null?`<p>Ваша цена: ${money(state.own_price)} · ${state.is_leader?'Сейчас лучшая':'Есть цена ниже'}</p>`:''}${active&&state.can_bid?`<p class="small">Следующая цена — не выше ${money(state.max_next_price)}. Сравнивается цена предложения; доставка учитывается отдельно.</p><button class="btn block" data-auction-bid="${request.id}" onclick="${state.own_offer_id?`openAuctionBid('${state.own_offer_id}')`:`openOffer('${request.id}')`}">${state.own_offer_id?'Снизить свою цену':'Предложить цену'}</button>`:''}${active&&!mine&&Number(state.max_next_price)<1?'<p class="small muted">Достигнут минимальный уровень цены. Новую ставку сделать нельзя.</p>':''}${mine&&active?'<p class="small muted">Выбор продавца откроется после окончания торгов. Условия желания, срок и шаг зафиксированы.</p>':''}${mine&&!active&&state.status!=='selected'?'<p class="small muted">Сравните доставку, гарантию и рейтинг. Самая низкая цена не выбирается автоматически.</p>':''}<button class="btn ghost block" style="margin-top:8px" onclick="loadAuctionPanel('${request.id}')">Обновить торги</button>`;
}
function updateAuctionControls(id){
 const state=cachedAuction(id);
 for(const button of document.querySelectorAll('[data-auction-bid]'))if(button.dataset.auctionBid===id)button.disabled=!state||state.status!=='active'||auctionRemaining(state)===0;
 for(const button of document.querySelectorAll('[data-auction-select]'))if(button.dataset.auctionSelect===id){button.disabled=!auctionSelectionAllowed(id);button.title=button.disabled?'Выбор после окончания торгов':''}
 for(const button of document.querySelectorAll('[data-auction-edit]'))if(button.dataset.auctionEdit===id){button.disabled=!!state&&state.status!=='none';button.title=button.disabled?'Условия желания зафиксированы торгами':''}
}
async function reloadAuctionOffers(id,owner){
 const {data,error}=await db.from('offers').select('id,request_id,seller_id,price,description,created_at').eq('request_id',id).order('created_at',{ascending:false});if(error)throw error;
 if(user?.id!==owner)return;
 const previous=offers.filter(o=>o.request_id===id),changed=previous.length!==(data||[]).length||(data||[]).some(row=>previous.find(o=>o.id===row.id)?.price!==row.price);
 const fresh=(data||[]).map(row=>{const item=previous.find(o=>o.id===row.id);return item?Object.assign(item,row):row});
 offers=[...offers.filter(o=>o.request_id!==id),...fresh];
 for(const node of document.querySelectorAll('[data-auction-offer-price]')){const item=offers.find(o=>o.id===node.dataset.auctionOfferPrice);if(item)node.textContent=money(item.price)}
 const comparison=$('offerComparisonDetails');
 if(changed&&comparison?.isConnected&&comparisonRequestId===id){
  const request=requests.find(r=>r.id===id),selected=offers.filter(o=>o.request_id===id&&comparisonOfferIds.has(o.id));
  if(request&&selected.length>=2){const horizontal=comparison.querySelector('.offer-comparison-scroll')?.scrollLeft||0,vertical=$('modal').scrollTop;
   comparison.innerHTML=detailedOfferComparisonMarkup(request,selected);const panel=comparison.querySelector('[data-auction-panel]');if(panel)panel.innerHTML=auctionPanelContent(request,cachedAuction(id));
   comparison.querySelector('.offer-comparison-scroll').scrollLeft=horizontal;$('modal').scrollTop=vertical;for(const o of selected)loadOfferGallery(o.id);
  }
 }
 updateAuctionControls(id);
 const ids=(data||[]).map(o=>o.id);
 if(ids.length){const photos=await db.from('offer_images').select('id,offer_id,path,created_at').in('offer_id',ids);if(!photos.error&&user?.id===owner)offerImages=[...offerImages.filter(i=>!ids.includes(i.offer_id)),...(photos.data||[])]}
 const host=$('requestOffers');if(host?.dataset.requestId===id)await loadDetailedRequestOffers(id);
}
async function loadAuctionPanel(id){
 if(!user)return;const owner=user.id,panels=[...document.querySelectorAll('[data-auction-panel]')].filter(p=>p.dataset.requestId===id);
 try{
  const state=await auctionRead(id);if(user?.id!==owner)return;const request=requests.find(r=>r.id===id);if(!request)return;
  for(const panel of panels)if(panel.isConnected){panel.innerHTML=auctionPanelContent(request,state);panel.hidden=state.status==='none'&&!panel.innerHTML}
  updateAuctionControls(id);
  if(state.status!=='none'&&panels.some(p=>p.isConnected))await reloadAuctionOffers(id,owner);
 }catch(error){if(user?.id===owner)for(const panel of panels)if(panel.isConnected)panel.innerHTML=`<p class="small muted">${esc(auctionError(error))}</p><button class="btn ghost" onclick="loadAuctionPanel('${id}')">Повторить</button>`}
}
function openAuctionSetup(id){
 if(!requireAuth())return;const request=requests.find(r=>r.id===id);if(!request||request.buyer_id!==user.id)return;
 modal({title:'Включить торги',body:`<p>${esc(request.title)} · бюджет ${money(request.budget)}</p><form id="auctionSetupForm"><label class="fieldset"><span class="fieldlabel">Продолжительность</span><select class="field" name="hours"><option value="1">1 час</option><option value="6">6 часов</option><option value="24" selected>24 часа</option><option value="48">48 часов</option><option value="72">3 дня</option><option value="168">7 дней</option></select></label><label class="fieldset"><span class="fieldlabel">Минимальный шаг снижения, ₽</span><input class="field" name="step" type="number" min="0.01" max="${esc(Number(request.budget)-0.01)}" step="0.01" value="${Math.min(100,Math.max(0.01,Math.floor(Number(request.budget)/100)))}" required></label><p class="small muted">Включается до первого предложения. Первую цену ограничивает бюджет, следующие должны быть ниже лучшей минимум на шаг. После запуска срок, шаг и условия желания нельзя изменить. Выбрать продавца можно после окончания. Можно закрыть желание и остановить приём ставок.</p><p class="small muted">Соревнуются цены предложений. Доставка, состояние и гарантия сравниваются отдельно. Победитель не назначается автоматически.</p><p class="small" role="alert"></p><button type="submit" class="btn block">Начать торги</button></form>`});
 const form=$('auctionSetupForm');if(form)form.addEventListener('submit',event=>startRequestAuction(event,id));
}
async function startRequestAuction(event,id){
 event.preventDefault();const form=event.currentTarget;if(form.dataset.busy||!requireAuth())return;
 const owner=user.id,button=form.querySelector('[type=submit]'),alert=form.querySelector('[role=alert]');form.dataset.busy='true';button.disabled=true;alert.textContent='';
 try{
  const f=new FormData(form),{data,error}=await db.rpc('hochu_auction_start_v244',{p_request_id:id,p_hours:Number(f.get('hours')),p_min_step:Number(f.get('step'))});if(error)throw error;
  if(user?.id!==owner)return;auctionStore(data,owner);if(form.isConnected){closeModal();showRequest(id)}toast('Торги начались');
 }catch(error){if(form.isConnected)alert.textContent=auctionError(error)}finally{delete form.dataset.busy;if(form.isConnected)button.disabled=false}
}
async function openAuctionBidOrChat(offer){
 try{const state=await auctionRead(offer.request_id);if(state.status==='active'&&state.can_bid&&auctionRemaining(state)>0)return openAuctionBid(offer.id,state)}catch(error){}
 return openChat(offer.id);
}
async function openAuctionBid(id,provided){
 if(!requireAuth())return;const owner=user.id,offer=offers.find(o=>o.id===id&&o.seller_id===owner);if(!offer)return toast('Ваше предложение недоступно');
 try{
  const state=provided||await auctionRead(offer.request_id);if(user?.id!==owner)return;
  if(state.status!=='active'||!state.can_bid||auctionRemaining(state)===0||state.own_offer_id!==id)throw Error('Снижение цены сейчас недоступно. Обновите торги');
  modal({title:'Снизить свою цену',body:`<p>Ваша цена: ${money(state.own_price)}<br>Лучшая цена: ${money(state.best_price)}<br>Шаг: ${money(state.min_step)}</p><form id="auctionBidForm"><label class="fieldset"><span class="fieldlabel">Новая цена, ₽</span><input class="field" name="price" type="number" required min="1" max="${esc(state.max_next_price)}" step="0.01" value="${esc(state.max_next_price)}"></label><p class="small muted">Доставку, гарантию, фотографии и описание эта ставка не меняет. Вернуть прежнюю цену нельзя. До ${esc(new Date(state.ends_at).toLocaleString('ru-RU'))}.</p><p class="small" role="alert"></p><button type="submit" class="btn block">Подтвердить снижение</button><button type="button" class="btn ghost block" style="margin-top:8px" onclick="openAuctionBid('${id}')">Обновить лучшую цену</button></form>`});
  $('auctionBidForm')?.addEventListener('submit',event=>submitAuctionBid(event,offer,state.own_price));
 }catch(error){toast(auctionError(error))}
}
async function submitAuctionBid(event,offer,expected){
 event.preventDefault();const form=event.currentTarget;if(form.dataset.busy||!requireAuth())return;
 const owner=user.id,button=form.querySelector('[type=submit]'),alert=form.querySelector('[role=alert]');form.dataset.busy='true';button.disabled=true;alert.textContent='';
 try{
  const price=Number(new FormData(form).get('price'));
  if(!Number.isFinite(price)||price<1||price>1e9)throw Error('Проверьте новую цену');
  const {data,error}=await db.rpc('hochu_auction_lower_v244',{p_offer_id:offer.id,p_price:price,p_expected_price:expected});if(error)throw error;
  if(user?.id!==owner)return;auctionStore(data,owner);const item=offers.find(o=>o.id===offer.id);if(item)item.price=data.own_price;
  if(form.isConnected){closeModal();showRequest(offer.request_id)}loadNotifications().catch(()=>{});toast('Новая цена принята');
 }catch(error){if(form.isConnected)alert.textContent=auctionError(error)}finally{delete form.dataset.busy;if(form.isConnected)button.disabled=false}
}
async function loadAuctionOfferForm(id,form){
 const host=form?.querySelector('[data-auction-form]');if(!host)return;const owner=user?.id;
 try{
  const state=await auctionRead(id);if(!form.isConnected||user?.id!==owner)return;
  if(state.status==='none'){host.hidden=true;return}
  const active=state.status==='active'&&state.can_bid&&auctionRemaining(state)>0;
  host.innerHTML=active?`<b>Торги идут</b><p class="small">${state.best_price==null?'Первая ставка — не выше бюджета':'Лучшая цена: '+money(state.best_price)}. Ваша цена — не выше ${money(state.max_next_price)}. Шаг ${money(state.min_step)}.</p>`:'<p>Приём ставок остановлен. Обновите желание.</p>';
  form.querySelector('[type=submit]').disabled=!active;if(active){form.elements.price.max=state.max_next_price;form.elements.price.step='0.01'}
 }catch(error){if(host.isConnected)host.textContent='Не удалось проверить торги. При отправке сервер проверит допустимую цену.'}
}
setInterval(()=>{
 if(!user||document.visibilityState!=='visible')return;
 for(const el of document.querySelectorAll('[data-auction-clock]')){const state=cachedAuction(el.dataset.auctionClock);if(state){el.textContent=auctionTimeText(auctionRemaining(state));updateAuctionControls(state.request_id)}}
},1000);
setInterval(()=>{
 if(!user||!db||document.visibilityState!=='visible')return;
 const ids=new Set([...document.querySelectorAll('[data-auction-panel]')].map(p=>p.dataset.requestId));
 for(const id of ids)loadAuctionPanel(id);
},15000);
