const auctionNoticeEvents=new Set(['auction_ended_buyer','auction_ended_seller','auction_choice_reminder']);
function notificationActionMarkup(notice){
 if(notice.request_event==='request_expired')return `<button class="btn ghost" onclick="openExpiredRequestNotification('${notice.id}')">Проверить актуальность</button>`;
 if(auctionNoticeEvents.has(notice.auction_event))return `<button class="btn ghost" onclick="openAuctionNotification('${notice.id}')">${notice.auction_event==='auction_ended_seller'?'Открыть моё предложение':'Открыть предложения'}</button>`;
 return notice.offer_id?`<button class="btn ghost" onclick="goFromNotification('${notice.offer_id}','${notice.id}')">Открыть переписку</button>`:notice.request_id?`<button class="btn ghost" onclick="goToMatchedRequest('${notice.request_id}','${notice.id}')">Открыть заявку</button>`:'';
}
function upsertAuctionNoticeRequest(request){const item=requests.find(r=>r.id===request.id);if(item)Object.assign(item,request);else requests.push(request)}
function upsertAuctionNoticeOffer(offer){const item=offers.find(o=>o.id===offer.id);if(item)Object.assign(item,offer);else offers.push(offer)}
async function markAuctionNoticeRead(id,owner){
 if(user?.id!==owner)return false;
 const {error}=await db.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('recipient_id',owner);if(error)throw error;
 if(user?.id!==owner)return false;await loadNotifications();return user?.id===owner;
}
async function openAuctionNotification(id){
 if(!requireAuth()||!startAction('auction-notice:'+id))return;const owner=user.id;
 try{
  const {data:notice,error}=await db.from('notifications').select('id,recipient_id,offer_id,request_id,auction_event').eq('id',id).maybeSingle();if(error)throw error;
  if(user?.id!==owner)return;
  if(!notice||notice.recipient_id!==owner||!auctionNoticeEvents.has(notice.auction_event))throw Error('Уведомление недоступно');
  if(!notice.request_id||(notice.auction_event==='auction_ended_seller'&&!notice.offer_id)){await markAuctionNoticeRead(id,owner);return toast('Итоги этих торгов уже недоступны')}
  if(notice.auction_event==='auction_ended_seller'){
   const {data:offer,error:offerError}=await db.from('offers').select('id,request_id,seller_id,price,description,created_at').eq('id',notice.offer_id).maybeSingle();if(offerError)throw offerError;
   if(user?.id!==owner)return;
   if(!offer||offer.seller_id!==owner||offer.request_id!==notice.request_id){await markAuctionNoticeRead(id,owner);return toast('Ваше предложение уже недоступно')}
   const [requestResult,dealResult,photoResult]=await Promise.all([
    db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at').eq('id',offer.request_id).maybeSingle(),
    db.from('deals').select('id,request_id,offer_id,buyer_id,seller_id,status,selected_at,completed_at').eq('request_id',offer.request_id),
    db.from('offer_images').select('id,offer_id,path,created_at').eq('offer_id',offer.id)
   ]);
   for(const result of [requestResult,dealResult,photoResult])if(result.error)throw result.error;
   if(user?.id!==owner)return;
   if(requestResult.data&&!requestResult.data.is_hidden)upsertAuctionNoticeRequest(requestResult.data);else requests=requests.filter(r=>r.id!==offer.request_id);
   upsertAuctionNoticeOffer(offer);deals=[...deals.filter(d=>d.request_id!==offer.request_id),...(dealResult.data||[])];offerImages=[...offerImages.filter(p=>p.offer_id!==offer.id),...(photoResult.data||[])];
   if(!await markAuctionNoticeRead(id,owner))return;closeModal();await openChat(offer.id);return;
  }
  const {data:request,error:requestError}=await db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at').eq('id',notice.request_id).maybeSingle();if(requestError)throw requestError;
  if(user?.id!==owner)return;
  if(!request||request.buyer_id!==owner){await markAuctionNoticeRead(id,owner);return toast('Это желание уже недоступно')}
  const [offerResult,dealResult]=await Promise.all([
   db.from('offers').select('id,request_id,seller_id,price,description,created_at').eq('request_id',request.id).order('created_at',{ascending:false}),
   db.from('deals').select('id,request_id,offer_id,buyer_id,seller_id,status,selected_at,completed_at').eq('request_id',request.id)
  ]);
  if(offerResult.error)throw offerResult.error;if(dealResult.error)throw dealResult.error;
  if(user?.id!==owner)return;const rows=offerResult.data||[],ids=rows.map(o=>o.id),oldIds=offers.filter(o=>o.request_id===request.id).map(o=>o.id);
  let photos=[];
  if(ids.length){const result=await db.from('offer_images').select('id,offer_id,path,created_at').in('offer_id',ids);if(result.error)throw result.error;photos=result.data||[]}
  if(user?.id!==owner)return;
  upsertAuctionNoticeRequest(request);offers=offers.filter(o=>o.request_id!==request.id);for(const offer of rows)upsertAuctionNoticeOffer(offer);
  deals=[...deals.filter(d=>d.request_id!==request.id),...(dealResult.data||[])];offerImages=[...offerImages.filter(p=>!ids.includes(p.offer_id)&&!oldIds.includes(p.offer_id)),...photos];
  if(!await markAuctionNoticeRead(id,owner))return;closeModal();showRequest(request.id);
  const target=$('requestOffers');if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView({block:'start'})}
 }catch(error){if(user?.id===owner)toast('Не удалось открыть итоги торгов: '+error.message)}
 finally{endAction('auction-notice:'+id)}
}
