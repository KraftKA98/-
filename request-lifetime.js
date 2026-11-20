let requestLifetimeClockOffset=0,requestLifetimeClockPending=null;
function requestLifetimeNow(){return Date.now()+requestLifetimeClockOffset}
function requestLifetimeExpired(request){return !!request?.expired_at||!!request?.expires_at&&Date.parse(request.expires_at)<=requestLifetimeNow()}
function requestIsCurrent(request){return !requestLifetimeExpired(request)}
function requestLifetimeFieldMarkup(days=30){return `<label class="fieldset"><span class="fieldlabel">Срок актуальности желания</span><select class="field" name="valid_for_days">${[7,14,30,90].map(n=>`<option value="${n}" ${Number(days)===n?'selected':''}>${n} дней</option>`).join('')}</select><span class="small muted">После окончания желание закроется для новых предложений. Его можно подтвердить и продлить.</span></label>`}
function requestLifetimeCreatedFields(days){return {valid_for_days:days,expires_at:new Date(requestLifetimeNow()+days*86400000).toISOString(),last_confirmed_at:new Date(requestLifetimeNow()).toISOString(),expired_at:null}}
function requestLifetimeBadge(request){
 if(deals.some(d=>d.request_id===request.id)||(typeof auctionFeedSummaries!=='undefined'&&auctionFeedSummaries.has(request.id)))return '';
 if(requestLifetimeExpired(request))return '<p class="small request-lifetime-expired">⌛ Срок актуальности истёк</p>';
 return request.expires_at?`<p class="small muted">Актуально до ${esc(new Date(request.expires_at).toLocaleDateString('ru-RU'))}</p>`:'';
}
function requestLifetimePanel(request){
 if(!request)return '';const mine=request.buyer_id===user?.id,deal=deals.some(d=>d.request_id===request.id);if(deal)return '';
 const expired=requestLifetimeExpired(request),renew=mine&&!request.is_hidden&&(request.status==='open'||!!request.expired_at);
 return `<section class="request-lifetime-panel"><b>${expired?'Срок актуальности истёк':request.expires_at?'Актуально до '+esc(new Date(request.expires_at).toLocaleString('ru-RU')):'Срок актуальности пока не задан'}</b>${request.last_confirmed_at?`<p class="small muted">Подтверждено ${esc(new Date(request.last_confirmed_at).toLocaleDateString('ru-RU'))}</p>`:''}${expired?'<p class="small muted">Новые предложения не принимаются. Владелец может подтвердить, что всё ещё ищет товар.</p>':''}${renew?`<button class="btn ghost block" onclick="openRequestLifetime('${request.id}')">${expired?'Всё ещё ищу — подтвердить':'Подтвердить / продлить'}</button>`:''}</section>`;
}
async function loadRequestLifetimeClock(){
 if(!db||requestLifetimeClockPending)return requestLifetimeClockPending;
 requestLifetimeClockPending=Promise.resolve().then(async()=>{try{const {data,error}=await db.rpc('hochu_request_clock_v248');if(!error&&Number.isFinite(Date.parse(data)))requestLifetimeClockOffset=Date.parse(data)-Date.now()}catch(error){}finally{requestLifetimeClockPending=null}});return requestLifetimeClockPending;
}
async function ensureCurrentRequestLifetime(id){
 const actor=user?.id;const {data,error}=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at,quantity').eq('id',id).maybeSingle();if(error)throw error;
 if(user?.id!==actor)throw Error('Аккаунт изменился');if(!data||data.status!=='open'||data.is_hidden||!requestIsCurrent(data))throw Error('Желание закрыто или срок его актуальности истёк');
 const item=requests.find(r=>r.id===id);item?Object.assign(item,data):requests.push(data);return data;
}
async function openRequestLifetime(id){
 if(!requireAuth())return;const owner=user.id;
 try{
  const {data:request,error}=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at,quantity').eq('id',id).maybeSingle();if(error)throw error;
  if(user?.id!==owner)return;if(!request||request.buyer_id!==owner||request.is_hidden)throw Error('Желание недоступно');
  modal({title:'Подтвердить актуальность',body:`<p>${esc(request.title)}</p>${requestLifetimeBadge(request)}<form id="requestLifetimeForm">${requestLifetimeFieldMarkup(request.valid_for_days||30)}<p class="small muted">Подтвердите, что всё ещё ищете товар. Срок будет не короче выбранного периода от сегодня. Полученные предложения сохранятся. Срок и шаг уже начатых торгов не меняются.</p><p role="alert" class="small"></p><button class="btn block" type="submit">Всё ещё ищу — подтвердить</button></form>`});
  const form=$('requestLifetimeForm');if(form)form.addEventListener('submit',event=>renewRequestLifetime(event,request));
 }catch(error){if(user?.id===owner)toast(error.message||'Не удалось открыть желание')}
}
async function renewRequestLifetime(event,request){
 event.preventDefault();const form=event.currentTarget;if(form.dataset.busy||!requireAuth())return;const owner=user.id,button=form.querySelector('[type=submit]'),alert=form.querySelector('[role=alert]');form.dataset.busy='true';button.disabled=true;
 try{
  const {data,error}=await db.rpc('hochu_request_renew_v248',{p_request_id:request.id,p_days:Number(new FormData(form).get('valid_for_days')),p_expected_revision:request.revision});if(error)throw error;
  if(user?.id!==owner)return;if(!data?.id)throw Error('Сервер не подтвердил продление');const item=requests.find(r=>r.id===data.id);item?Object.assign(item,data):requests.push(data);
  if(form.isConnected){closeModal();renderAll();showRequest(data.id)}toast('Актуальность подтверждена');
 }catch(error){if(form.isConnected&&user?.id===owner)alert.textContent=(error.message||'Не удалось продлить желание')+' Можно закрыть это окно и повторить после обновления.'}
 finally{delete form.dataset.busy;if(form.isConnected)button.disabled=false}
}
function requestLifetimeConstrainAuction(form,request){
 if(!form||!request.expires_at)return;const select=form.elements.hours;if(!select)return;const remaining=Date.parse(request.expires_at)-requestLifetimeNow();
 for(const option of select.options)option.disabled=Number(option.value)*3600000>remaining;
 if(select.selectedOptions[0]?.disabled){const first=[...select.options].find(o=>!o.disabled);if(first)select.value=first.value;else{form.querySelector('[type=submit]').disabled=true;const note=document.createElement('p');note.className='notice';note.textContent='Сначала продлите актуальность желания: до её окончания осталось меньше часа.';form.prepend(note)}}
}
async function openExpiredRequestNotification(id){
 if(!requireAuth()||!startAction('expiry-notice:'+id))return;const owner=user.id;
 try{
  const {data:n,error}=await db.from('notifications').select('id,recipient_id,request_id,request_event').eq('id',id).maybeSingle();if(error)throw error;if(user?.id!==owner)return;
  if(!n||n.recipient_id!==owner||n.request_event!=='request_expired')throw Error('Уведомление недоступно');
  let r=null;if(n.request_id){const result=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at,quantity').eq('id',n.request_id).maybeSingle();if(result.error)throw result.error;r=result.data}
  if(user?.id!==owner)return;
  if(r&&r.buyer_id===owner){const [a,b]=await Promise.all([db.from('offers').select('id,request_id,seller_id,price,description,created_at').eq('request_id',r.id),db.from('deals').select('id,request_id,offer_id,buyer_id,seller_id,status,selected_at,completed_at').eq('request_id',r.id)]);if(a.error)throw a.error;if(b.error)throw b.error;if(user?.id!==owner)return;const item=requests.find(q=>q.id===r.id);item?Object.assign(item,r):requests.push(r);offers=[...offers.filter(o=>o.request_id!==r.id),...(a.data||[])];deals=[...deals.filter(d=>d.request_id!==r.id),...(b.data||[])]}
  if(!await markAuctionNoticeRead(id,owner))return;
  if(!r||r.buyer_id!==owner)return toast('Желание уже недоступно');closeModal();showRequest(r.id);
 }catch(error){if(user?.id===owner)toast(error.message||'Не удалось открыть желание')}
 finally{endAction('expiry-notice:'+id)}
}
setInterval(()=>{if(db&&document.visibilityState==='visible'){loadRequestLifetimeClock().then(()=>{if(mode==='home'||mode==='catalog'){renderHomeFeed();renderCatalog()}})}},60000);
