// Public summaries and account-owned participation are deliberately separate caches.
const auctionFeedSummaries=new Map(),auctionFeedSeen=new Map(),auctionFeedLatest=new Map();
const auctionFeedFilters={home:{only:false,soon:false},catalog:{only:false,soon:false}};
let auctionFeedTimer=null,auctionFeedLoading=false,auctionFeedError='',auctionFeedSequence=0;
function auctionPublicIds(){return [...new Set(requests.filter(r=>r.status==='open'&&!r.is_hidden).map(r=>r.id))]}
function auctionFeedPhase(summary){return summary?.status==='active'&&auctionRemaining(summary)>0?'active':summary?.status==='active'?'ended':summary?.status||'none'}
function rememberAuctionSummary(state){
 const request=requests.find(r=>r.id===state.request_id),previous=auctionFeedSummaries.get(state.request_id),latest=auctionFeedLatest.get(state.request_id);
 if(latest&&Date.parse(latest)>Date.parse(state.server_now))return;auctionFeedLatest.set(state.request_id,state.server_now);
 if(!request||request.status!=='open'||request.is_hidden||!['active','ended'].includes(state.status)){auctionFeedSummaries.delete(state.request_id);return}
 if(previous&&Date.parse(previous.server_now)>Date.parse(state.server_now))return;
 auctionFeedSummaries.set(state.request_id,{request_id:state.request_id,status:state.status,best_price:state.best_price,offer_count:state.offer_count,min_step:state.min_step,ends_at:state.ends_at,server_now:state.server_now,clockOffset:state.clockOffset??Date.parse(state.server_now)-Date.now(),receivedAt:Date.now()});
}
function auctionFeedBadgeMarkup(request){
 if(request.status!=='open'||request.is_hidden)return '';const summary=auctionFeedSummaries.get(request.id);if(!summary)return '';
 const phase=auctionFeedPhase(summary);
 return `<div class="feed-auction-badge" data-feed-auction="${esc(request.id)}"><b>${phase==='active'?'🔻 Идут торги':'Торги завершены'}</b><span>${summary.best_price==null?'Ставок пока нет':'Лучшая цена: '+money(summary.best_price)}</span>${phase==='active'?`<span class="small" data-feed-auction-clock="${esc(request.id)}">До конца: ${auctionTimeText(auctionRemaining(summary))}</span>`:'<span class="small">Покупатель выбирает продавца</span>'}</div>`;
}
function auctionFeedMatches(request,source){const filter=auctionFeedFilters[source];if(!filter?.only)return true;const summary=auctionFeedSummaries.get(request.id);return auctionFeedPhase(summary)==='active'&&(!filter.soon||auctionRemaining(summary)<=86400000)}
function setAuctionFeedFilter(source,key,value){
 const f=auctionFeedFilters[source];if(!f||!['only','soon'].includes(key))return;f[key]=!!value;if(key==='soon'&&value)f.only=true;if(key==='only'&&!value)f.soon=false;
 source==='home'?renderHomeFeed():renderCatalog();scheduleAuctionFeedLoad();
}
function clearAuctionFeedFilters(source){const f=auctionFeedFilters[source];if(!f)return;f.only=false;f.soon=false;source==='home'?renderHomeFeed():renderCatalog()}
function renderAuctionFeedControls(source){
 const host=$(source==='home'?'homeAuctionTools':'catalogAuctionTools');if(!host)return;
 if(!host.dataset.ready){host.dataset.ready='true';host.innerHTML=`<div class="auction-feed-tools"><label><input type="checkbox" data-auction-only onchange="setAuctionFeedFilter('${source}','only',this.checked)"> Только активные торги</label><label><input type="checkbox" data-auction-soon onchange="setAuctionFeedFilter('${source}','soon',this.checked)"> Закончаются за 24 часа</label><button class="btn ghost" onclick="openMyAuctions()">Мои торги</button></div><p class="small muted" data-auction-feed-status role="status"></p>`}
 host.querySelector('[data-auction-only]').checked=auctionFeedFilters[source].only;host.querySelector('[data-auction-soon]').checked=auctionFeedFilters[source].soon;
 const message=host.querySelector('[data-auction-feed-status]');message.textContent=auctionFeedError?'Не удалось обновить статусы торгов. Нажмите ↻ или повторите позже.':auctionFeedLoading?'Обновляем статусы торгов…':auctionFeedFilters[source].only?'Фильтр действует на загруженные желания текущей ленты.':'';
}
function auctionFeedEmptyMarkup(source){
 if(!auctionFeedFilters[source]?.only)return emptyWishMarkup(source);
 if(auctionFeedLoading||(!auctionFeedError&&auctionPublicIds().some(id=>!auctionFeedSeen.has(id))))return '<div class="loader">Загружаем торги…</div>';
 return `<div class="empty"><p>${auctionFeedError?'Не удалось загрузить торги.':'Активных торгов по этим условиям в текущей ленте пока нет.'}</p><button class="btn ghost" onclick="clearAuctionFeedFilters('${source}')">Показать все желания</button>${auctionFeedError?'<button class="btn ghost" onclick="loadAuctionFeed(true)">Повторить</button>':''}</div>`;
}
function scheduleAuctionFeedLoad(){if(auctionFeedTimer!==null)return;auctionFeedTimer=setTimeout(()=>{auctionFeedTimer=null;loadAuctionFeed(false)},0)}
function redrawAuctionFeeds(){renderHomeFeed();renderCatalog()}
async function loadAuctionFeed(force=false){
 if(!db||auctionFeedLoading)return;const ids=auctionPublicIds().filter(id=>force||Date.now()-(auctionFeedSeen.get(id)||0)>15000);if(!ids.length)return;
 const sequence=++auctionFeedSequence;auctionFeedLoading=true;auctionFeedError='';renderAuctionFeedControls('home');renderAuctionFeedControls('catalog');
 let failed=false;
 try{
  for(let i=0;i<ids.length;i+=200){
   const batch=ids.slice(i,i+200),startedAt=Date.now(),{data,error}=await db.rpc('hochu_auction_feed_v245',{p_request_ids:batch});if(error)throw error;if(!Array.isArray(data))throw Error('Некорректная сводка торгов');
   if(sequence!==auctionFeedSequence)return;
   const byId=new Map(data.filter(s=>batch.includes(s.request_id)&&['active','ended'].includes(s.status)).map(s=>[s.request_id,s]));
   for(const id of batch){const previous=auctionFeedSummaries.get(id),next=byId.get(id);if(next)rememberAuctionSummary(next);else if(!previous||previous.receivedAt<=startedAt)auctionFeedSummaries.delete(id);auctionFeedSeen.set(id,Date.now())}
  }
 }catch(error){failed=true;auctionFeedError=error.message||'Ошибка загрузки';for(const id of ids)auctionFeedSeen.set(id,Date.now())}
 finally{if(sequence===auctionFeedSequence){auctionFeedLoading=false;redrawAuctionFeeds();if(failed)renderAuctionFeedControls('home')}}
}
const myAuctionLabels={all:'Все',leading:'Лидирую',outbid:'Цену перебили',ended:'Завершены',paused:'Приостановлены',selected:'Выбрали продавца'};
let myAuctionView={owner:null,filter:'all',offset:0,rows:[],counts:{},total:0,hasMore:false,loaded:false,loading:false,error:'',sequence:0};
function syncMyAuctionIdentity(){
 if(myAuctionView.owner===(user?.id||null))return;
 const sequence=myAuctionView.sequence+1;myAuctionView={owner:user?.id||null,filter:'all',offset:0,rows:[],counts:{},total:0,hasMore:false,loaded:false,loading:false,error:'',sequence};
 if($('myAuctionList'))renderMyAuctions();
}
function openMyAuctions(){if(!requireAuth())return;navigate('my-auctions')}
function chooseMyAuctionFilter(filter){if(!Object.hasOwn(myAuctionLabels,filter))return;myAuctionView.filter=filter;myAuctionView.offset=0;myAuctionView.rows=[];myAuctionView.loaded=false;loadMyAuctions()}
function changeMyAuctionPage(direction){if(myAuctionView.loading)return;myAuctionView.offset=Math.max(0,myAuctionView.offset+direction*30);myAuctionView.rows=[];myAuctionView.loaded=false;loadMyAuctions()}
function myAuctionTitle(row){return row.bucket==='selected'?(row.won?'Вас выбрали':'Выбран другой продавец'):myAuctionLabels[row.bucket]||'Мои торги'}
function myAuctionCard(row){
 const request=row.request,state=cachedAuction(row.request_id)||row.state,active=state.status==='active'&&auctionRemaining(state)>0;
 return `<article class="card my-auction-card" data-my-auction="${esc(row.request_id)}"><span class="chip ${row.bucket==='leading'?'green':''}">${esc(myAuctionTitle(row))}</span><h3>${esc(request?.title||'Желание скрыто')}</h3>${request?`<p class="small muted">${esc(request.category)} · ${esc(request.city)}</p>`:'<p class="small muted">Детали желания скрыты. Ваше предложение сохранено.</p>'}<dl class="offer-term-list"><dt>Ваша цена</dt><dd>${money(state.own_price)}</dd><dt>Лучшая цена</dt><dd>${state.best_price==null?'Нет доступной цены':money(state.best_price)}</dd></dl>${active?`<p class="auction-clock" data-my-auction-clock="${esc(row.request_id)}">${auctionTimeText(auctionRemaining(state))}</p>`:''}<p class="small muted">Срок: ${esc(new Date(state.ends_at).toLocaleString('ru-RU'))}${row.bucket==='ended'?'<br>Окончательный выбор делает покупатель.':''}</p><div class="row" style="flex-wrap:wrap">${active&&state.can_bid?`<button class="btn" data-my-auction-bid="${esc(row.request_id)}" onclick="openMyAuctionAction('${row.request_id}','bid')">Снизить цену</button>`:''}${request?`<button class="btn ghost" onclick="openMyAuctionAction('${row.request_id}','request')">Открыть желание</button>`:''}<button class="btn ghost" onclick="openMyAuctionAction('${row.request_id}','chat')">Переписка</button></div></article>`;
}
function renderMyAuctions(){
 const filters=$('myAuctionFilters'),host=$('myAuctionList'),pager=$('myAuctionPager'),status=$('myAuctionStatus');if(!host||!filters||!pager||!status)return;
 if(!user){filters.innerHTML='';pager.innerHTML='';status.textContent='';host.innerHTML='<div class="empty">Войдите, чтобы видеть свои торги.</div><button class="btn block" onclick="openAuth()">Войти</button>';return}
 filters.innerHTML=Object.entries(myAuctionLabels).map(([key,label])=>`<button class="btn ${myAuctionView.filter===key?'':'ghost'}" aria-pressed="${myAuctionView.filter===key}" onclick="chooseMyAuctionFilter('${key}')">${label} · ${Number(myAuctionView.counts[key])||0}</button>`).join('');
 status.textContent=myAuctionView.error?'Не удалось обновить торги: '+myAuctionView.error:myAuctionView.loading?'Обновляем торги…':`Найдено: ${myAuctionView.total}. Цены обновляются примерно раз в 15 секунд.`;
 host.innerHTML=myAuctionView.rows.length?myAuctionView.rows.map(myAuctionCard).join(''):myAuctionView.loading?'<div class="loader">Загружаем ваши торги…</div>':myAuctionView.error?'<button class="btn ghost" onclick="loadMyAuctions()">Повторить</button>':`<div class="empty">${myAuctionView.filter==='all'?'Вы ещё не участвовали в торгах. Найдите желание с меткой «Идут торги» и предложите цену.':'В этом разделе пока нет торгов.'}</div>`;
 pager.innerHTML=myAuctionView.loaded&&myAuctionView.total?`<button class="btn ghost" ${myAuctionView.offset===0||myAuctionView.loading?'disabled':''} onclick="changeMyAuctionPage(-1)">← Назад</button><span class="small">${Math.floor(myAuctionView.offset/30)+1} / ${Math.ceil(myAuctionView.total/30)}</span><button class="btn ghost" ${!myAuctionView.hasMore||myAuctionView.loading?'disabled':''} onclick="changeMyAuctionPage(1)">Дальше →</button>`:'';
}
async function loadMyAuctions(){
 syncMyAuctionIdentity();if(!user){renderMyAuctions();return}const owner=user.id,sequence=++myAuctionView.sequence,filter=myAuctionView.filter,offset=myAuctionView.offset;
 myAuctionView.loading=true;myAuctionView.error='';renderMyAuctions();
 try{
  const {data,error}=await db.rpc('hochu_my_auctions_v245',{p_filter:filter,p_limit:30,p_offset:offset});if(error)throw error;
  if(user?.id!==owner||myAuctionView.sequence!==sequence)return;
  if(!data||!Array.isArray(data.items)||!data.counts)throw Error('Некорректный список торгов');
  const rows=data.items;
  for(const row of rows){auctionStore(row.state,owner);if(row.is_hidden){const hidden=requests.find(r=>r.id===row.request_id);if(hidden)hidden.is_hidden=true}if(row.request){const existing=requests.find(r=>r.id===row.request_id);existing?Object.assign(existing,row.request):requests.push(row.request)}const own=offers.find(o=>o.id===row.own_offer.id);if(own)Object.assign(own,row.own_offer);else offers.push({...row.own_offer,description:''})}
  Object.assign(myAuctionView,{rows,counts:data.counts,total:Number(data.total)||0,hasMore:!!data.has_more,loaded:true});
  if(!rows.length&&offset>0&&myAuctionView.total>0){myAuctionView.offset=Math.floor((myAuctionView.total-1)/30)*30;myAuctionView.loading=false;return loadMyAuctions()}
 }catch(error){if(user?.id===owner&&myAuctionView.sequence===sequence)myAuctionView.error=auctionError(error)}
 finally{if(user?.id===owner&&myAuctionView.sequence===sequence){myAuctionView.loading=false;renderMyAuctions()}}
}
async function openMyAuctionAction(id,action){
 if(!requireAuth())return;const owner=user.id,row=myAuctionView.rows.find(r=>r.request_id===id);if(!row)return;
 try{
  if(action==='request'){
   const {data,error}=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision').eq('id',id).maybeSingle();if(error)throw error;if(!data||data.is_hidden)throw Error('Желание недоступно');if(user?.id!==owner)return;
   const existing=requests.find(r=>r.id===id);existing?Object.assign(existing,data):requests.push(data);showRequest(id);return;
  }
  const {data,error}=await db.from('offers').select('id,request_id,seller_id,price,description,created_at').eq('id',row.own_offer.id).maybeSingle();if(error)throw error;if(!data||data.seller_id!==owner)throw Error('Предложение недоступно');if(user?.id!==owner)return;
  const existing=offers.find(o=>o.id===data.id);existing?Object.assign(existing,data):offers.push(data);
  if(action==='bid')await openAuctionBid(data.id);else await openChat(data.id);
 }catch(error){toast(auctionError(error))}
}
setInterval(()=>{
 if(document.visibilityState!=='visible')return;
 let expired=false;
 for(const el of document.querySelectorAll('[data-feed-auction-clock]')){const summary=auctionFeedSummaries.get(el.dataset.feedAuctionClock);if(summary){const remaining=auctionRemaining(summary);el.textContent=remaining?'До конца: '+auctionTimeText(remaining):'Время истекло';if(!remaining)expired=true}}
 for(const el of document.querySelectorAll('[data-my-auction-clock]')){const state=cachedAuction(el.dataset.myAuctionClock);if(state){const remaining=auctionRemaining(state);el.textContent=remaining?auctionTimeText(remaining):'Время истекло';if(!remaining)for(const button of document.querySelectorAll('[data-my-auction-bid]'))if(button.dataset.myAuctionBid===state.request_id)button.disabled=true}}
 if(expired)redrawAuctionFeeds();
},1000);
setInterval(()=>{
 if(document.visibilityState!=='visible'||!db)return;
 if(mode==='home'||mode==='catalog')loadAuctionFeed(true);
 if(mode==='my-auctions'&&user&&!myAuctionView.loading)loadMyAuctions();
},15000);
