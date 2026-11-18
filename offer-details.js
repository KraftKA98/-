// Terms remain human-readable in offers.description; no schema changes are needed.
const offerTermChoices={availability:['В наличии','Под заказ','Ожидается поставка'],condition:['Новое','Б/у','Восстановленное','На запчасти'],delivery:['Самовывоз','Доставка','Самовывоз и доставка'],shipping:['Бесплатно','Фиксированная стоимость','По договорённости'],warranty:['Производителя','Продавца','Без гарантии']};
const offerTermLabels={availability:'Наличие',condition:'Состояние товара',delivery:'Получение товара',shipping:'Оплата доставки',shipping_cost:'Стоимость доставки, ₽',handover:'Срок передачи',handover_days:'Передача или выполнение в течение дней',warranty:'Гарантия',warranty_months:'Гарантия, месяцев'};
function offerGoodsCategory(category){return categoryHasBrand(category)&&categoryGroup(category)?.[1]!=='Услуги'&&category!=='Рыбы и аквариумы'}
function offerWarrantyCategory(category){return offerGoodsCategory(category)&&!['Продукты питания','Животные'].includes(categoryGroup(category)?.[1])}
function offerTermSelect(key,label){return `<label class="fieldset" style="display:block"><span class="fieldlabel">${esc(label)}</span><select class="field" name="offer_${key}" onchange="syncOfferTermFields(this.form)"><option value="">Не указано</option>${offerTermChoices[key].map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`}
function offerTermsMarkup(category){
 const goods=offerGoodsCategory(category),warranty=offerWarrantyCategory(category);
 return `<section class="offer-terms-form"><h3>Условия предложения</h3><p class="small muted">Заполните известные условия — покупателю будет проще сравнить варианты. Условия можно уточнить в переписке.</p>${goods?offerTermSelect('availability','Наличие')+offerTermSelect('condition','Состояние товара')+offerTermSelect('delivery','Получение товара')+`<div data-offer-shipping hidden>${offerTermSelect('shipping','Оплата доставки')}<label class="fieldset" data-offer-shipping-cost hidden><span class="fieldlabel">Стоимость доставки, ₽</span><input class="field" name="offer_shipping_cost" type="number" min="0" max="1000000000" step="1" disabled></label></div>`:''}<label class="fieldset" style="display:block"><span class="fieldlabel">${goods?'Когда готовы передать товар':'Срок выполнения / передачи'}</span><input class="field" name="offer_handover" maxlength="120" placeholder="Например, сегодня или в течение 3 дней"></label><label class="fieldset"><span class="fieldlabel">Передача или выполнение в течение, дней (необязательно)</span><input class="field" name="offer_handover_days" type="number" min="0" max="365" step="1"><span class="small muted">0 — сегодня. Срок указан продавцом; точную дату согласуйте в сделке.</span></label>${warranty?offerTermSelect('warranty','Гарантия')+`<label class="fieldset" data-offer-warranty-months hidden><span class="fieldlabel">Срок гарантии, месяцев</span><input class="field" name="offer_warranty_months" type="number" min="1" max="120" step="1" disabled><span class="small muted">Если срок пока неизвестен, оставьте пустым.</span></label>`:''}</section>`;
}
function syncOfferTermFields(form){
 if(!form)return;
 const delivery=form.elements.offer_delivery?.value||'',shipping=delivery.includes('Доставка')||delivery.includes('доставка');
 const group=form.querySelector('[data-offer-shipping]');
 if(group){group.hidden=!shipping;for(const input of group.querySelectorAll('select,input')){input.disabled=!shipping;if(!shipping)input.value=''}}
 const fixed=shipping&&form.elements.offer_shipping?.value==='Фиксированная стоимость',cost=form.querySelector('[data-offer-shipping-cost]');
 if(cost){cost.hidden=!fixed;const input=cost.querySelector('input');input.disabled=!fixed;input.required=fixed;if(!fixed)input.value=''}
 const warranty=form.elements.offer_warranty?.value||'',months=form.querySelector('[data-offer-warranty-months]');
 if(months){const show=['Производителя','Продавца'].includes(warranty);months.hidden=!show;months.querySelector('input').disabled=!show;if(!show)months.querySelector('input').value=''}
}
function offerSpecificationMarkup(category){
 const keys=modelCategoryKind(category)?isCarModelCategory(category)?['model','generation','year','mileage','gearbox']:['model','storage']:requestFieldDefinitions(category).some(f=>f[0]==='model')?['model']:[];
 if(requestFieldDefinitions(category).some(f=>f[0]==='size'))keys.push('size');
 return requestFieldDefinitions(category).filter(f=>keys.includes(f[0])).map(field=>requestDetailFieldMarkup([field[0],field[0]==='year'?'Год выпуска':field[0]==='mileage'?'Пробег, км':field[1],...field.slice(2)],category)).join('');
}
function offerDescription(formData,category){
 const terms={};
 for(const key of Object.keys(offerTermLabels)){
  const value=String(formData.get('offer_'+key)||'').trim();if(!value)continue;
  if(value.length>120||/[\r\n]/.test(value)||(offerTermChoices[key]&&!offerTermChoices[key].includes(value)))throw Error('Проверьте условия предложения');
  terms[key]=value;
 }
 if(!offerGoodsCategory(category))for(const key of ['availability','condition','delivery','shipping','shipping_cost'])delete terms[key];
 if(!offerWarrantyCategory(category))for(const key of ['warranty','warranty_months'])delete terms[key];
 if(!terms.delivery?.toLowerCase().includes('доставка')){delete terms.shipping;delete terms.shipping_cost}
 if(terms.shipping!=='Фиксированная стоимость')delete terms.shipping_cost;
 else if(terms.shipping_cost==null||!Number.isInteger(Number(terms.shipping_cost))||Number(terms.shipping_cost)<0||Number(terms.shipping_cost)>1e9)throw Error('Укажите стоимость доставки от 0 до 1 000 000 000 ₽');
 if(!['Производителя','Продавца'].includes(terms.warranty))delete terms.warranty_months;
 else if(terms.warranty_months&&(!Number.isInteger(Number(terms.warranty_months))||Number(terms.warranty_months)<1||Number(terms.warranty_months)>120))throw Error('Срок гарантии — от 1 до 120 месяцев');
 if(terms.handover_days!=null&&(!/^\d+$/.test(terms.handover_days)||Number(terms.handover_days)>365))throw Error('Срок — целое число от 0 до 365 дней');
 for(const [key,value] of formData)if(key.startsWith('detail_')&&/[\r\n]/.test(String(value)))throw Error('Характеристика должна занимать одну строку');
 for(const key of ['shipping_cost','warranty_months','handover_days'])if(terms[key]!=null)terms[key]=String(Number(terms[key]));
 const copy=new FormData();for(const [key,value] of formData)copy.append(key,value);
 // Generic descriptions already preserve brand/model/year for old clients.
 let body=descriptionWithBrand(copy,category);
 if(!modelCategoryKind(category)&&formData.get('detail_model')){
  const value=String(formData.get('detail_model')).trim();if(value.length>120)throw Error('Модель — до 120 символов');
  body='Модель: '+value+'\n'+body;
 }
 body=body.replace(/^Год выпуска от:/m,'Год выпуска:').replace(/^Пробег до, км:/m,'Пробег, км:');
 const lines=Object.entries(terms).map(([key,value])=>offerTermLabels[key]+': '+value);
 const text=[lines.length?'Условия предложения:\n'+lines.join('\n'):'',body].filter(Boolean).join('\n\n');
 if(text.length>2000)throw Error('Сократите описание и условия: вместе допускается 2000 символов');
 return text;
}
function offerTerms(offer){
 const text=String(offer.description||'');if(!text.startsWith('Условия предложения:\n'))return {};
 const block=text.split(/\r?\n\r?\n/)[0],terms={};
 for(const [key,label] of Object.entries(offerTermLabels)){
  const line=block.split(/\r?\n/).find(line=>line.startsWith(label+': '));if(!line)continue;
  const value=line.slice(label.length+2).trim();
  if(!value||value.length>120||(offerTermChoices[key]&&!offerTermChoices[key].includes(value)))continue;
  if(['shipping_cost','warranty_months','handover_days'].includes(key)&&(!/^\d+$/.test(value)||Number(value)>1e9||(key==='warranty_months'&&(Number(value)<1||Number(value)>120))||(key==='handover_days'&&Number(value)>365)))continue;
  terms[key]=value;
 }
 return terms;
}
function offerShippingCost(offer){
 const t=offerTerms(offer);
 if(t.delivery==='Самовывоз')return 0;
 if(!t.delivery?.toLowerCase().includes('доставка'))return null;
 if(t.shipping==='Бесплатно')return 0;
 if(t.shipping==='Фиксированная стоимость'&&t.shipping_cost!=null)return Number(t.shipping_cost);
 return null;
}
function offerWarrantyText(offer){const t=offerTerms(offer);return t.warranty?t.warranty+(t.warranty_months?' · '+t.warranty_months+' мес.':''):'Нужно уточнить'}
function offerDeliveryText(offer){
 const t=offerTerms(offer);if(!t.delivery)return 'Нужно уточнить';if(t.delivery==='Самовывоз')return 'Самовывоз';
 const cost=offerShippingCost(offer);return t.delivery+' · '+(cost===null?'стоимость нужно уточнить':cost===0?'доставка бесплатно':'доставка '+money(cost));
}
function offerTotalText(offer,category=''){if(category&&!offerGoodsCategory(category))return money(offer.price);const cost=offerShippingCost(offer);return cost===null?'Нужно уточнить доставку':money(Number(offer.price)+cost)+(offerTerms(offer).delivery==='Самовывоз'?' · самовывоз':' · с доставкой')}
function offerField(description,label){return String(description||'').split(/\r?\n/).find(line=>line.startsWith(label+': '))?.slice(label.length+2).trim()||''}
function offerFit(request,offer){
 const checks=[],term=offerTerms(offer),req=(label)=>offerField(request.description,label),actual=(label)=>offerField(offer.description,label);
 const add=(label,wanted,got,match)=>{if(!wanted)return;checks.push({label,state:got==null||got===''?'unknown':match(wanted,got)?'match':'mismatch',wanted:String(wanted),actual:String(got??'')})};
 add('Цена товара',String(request.budget),String(offer.price),(a,b)=>Number(b)<=Number(a));
 const brand=req('Бренд / марка'),model=req('Модель');
 add('Бренд',brand,actual('Бренд / марка'),(a,b)=>directoryNormalize(canonicalBrand(a))===directoryNormalize(canonicalBrand(b)));
 add('Модель',model,actual('Модель'),(a,b)=>modelKeyForBrand(a,brand)===modelKeyForBrand(b,brand));
 const condition=req('Состояние');if(condition!=='Не имеет значения')add('Состояние',condition,term.condition,(a,b)=>a===b);
 const delivery=req('Получение');if(delivery&&delivery!=='Любой вариант'){
  add('Получение',delivery,term.delivery,(a,b)=>b===a||b==='Самовывоз и доставка');
  if(delivery==='Доставка')add('Итого с доставкой',String(request.budget),term.delivery?.toLowerCase().includes('доставка')&&offerShippingCost(offer)!==null?String(Number(offer.price)+offerShippingCost(offer)):'',(a,b)=>Number(b)<=Number(a));
 }
 for(const [label,offerLabel,compare] of [['Год выпуска от','Год выпуска',(a,b)=>Number(b)>=Number(a)],['Пробег до, км','Пробег, км',(a,b)=>Number(b)<=Number(a)],['Встроенная память','Встроенная память',(a,b)=>modelSearchKey(a)===modelSearchKey(b)],['Поколение','Поколение',(a,b)=>directoryNormalize(a)===directoryNormalize(b)],['Коробка передач','Коробка передач',(a,b)=>a===b]]){
  const wanted=req(label);if(wanted==='Не имеет значения')continue;
  add(offerLabel,wanted,actual(offerLabel)||actual(label),compare);
 }
 return {checks,mismatch:checks.some(c=>c.state==='mismatch'),unknown:checks.some(c=>c.state==='unknown')};
}
function offerFitMarkup(request,offer){
 const fit=offerFit(request,offer),title=fit.mismatch?'Есть отличия от желания':fit.unknown?'Нужно уточнить условия':'Совпадает по указанным условиям';
 const icon={match:'✓',mismatch:'✕',unknown:'?'};
 return `<details class="offer-fit ${fit.mismatch?'has-difference':fit.unknown?'has-unknown':'has-match'}"><summary>${title}</summary><ul>${fit.checks.map(c=>`<li>${icon[c.state]} ${esc(c.label)}: ${c.state==='unknown'?'не указано':esc(c.actual)}${c.state==='mismatch'?' · нужно '+esc(c.wanted):''}</li>`).join('')}</ul><p class="small muted">Сравнение по заполненным полям. Свободный текст и достоверность условий проверяет покупатель.</p></details>`;
}
const offerReputations=new Map(),offerReputationPending=new Map(),offerSortByRequest=new Map();
function offerReputation(offer){return offerReputations.get(offer.seller_id)}
function offerRatingText(offer){const r=offerReputation(offer);return !r?'Загружаем рейтинг…':r.error?'Рейтинг недоступен':r.count?`⭐ ${r.average.toFixed(1)} / 5 · ${r.count} оценок`:'☆ Пока без оценок'}
async function loadOfferReputations(rows){
 const ids=[...new Set(rows.map(o=>o.seller_id))];
 for(let i=0;i<ids.length;i+=6)await Promise.all(ids.slice(i,i+6).map(id=>{
  const cached=offerReputations.get(id);if(cached&&Date.now()-cached.time<300000&&!cached.error)return;
  if(offerReputationPending.has(id))return offerReputationPending.get(id);
  const pending=(async()=>{try{
   const {data,error}=await db.rpc('hochu_seller_reputation_v18',{p_seller_id:id});if(error)throw error;
   if(!data||data.seller_id!==id)throw Error('Некорректный профиль');
   const count=Number(data.review_count),average=Number(data.average_rating);
   if(!Number.isInteger(count)||count<0||(count>0&&(!Number.isFinite(average)||average<1||average>5)))throw Error('Некорректный рейтинг');
   offerReputations.set(id,{count,average:count?average:null,name:String(data.display_name||'Продавец'),time:Date.now()});
  }catch(error){offerReputations.set(id,{error:true,time:Date.now()})}finally{offerReputationPending.delete(id)}})();
  offerReputationPending.set(id,pending);return pending;
 }));
}
function sortedRequestOffers(rows,sort){
 return [...rows].sort((a,b)=>{
  if(typeof offerSortValueV33==='function'&&['total','days'].includes(sort)){const x=offerSortValueV33(a,sort),y=offerSortValueV33(b,sort);if(x!==y)return x-y}
  if(sort==='price_asc'||sort==='price_desc'){const diff=Number(a.price)-Number(b.price);if(diff)return sort==='price_desc'?-diff:diff}
  if(sort==='rating'){
   const x=offerReputation(a),y=offerReputation(b),ax=x&&!x.error&&x.count?x.average:-1,ay=y&&!y.error&&y.count?y.average:-1;
   if(ax!==ay)return ay-ax;if(ax>=0&&x.count!==y.count)return y.count-x.count;
  }
  return new Date(b.created_at)-new Date(a.created_at)||String(a.id).localeCompare(String(b.id));
 });
}
let offerRatingTimer=null;
function scheduleOfferRatings(){if(offerRatingTimer!==null)return;offerRatingTimer=setTimeout(async()=>{offerRatingTimer=null;if(!db)return;const nodes=[...document.querySelectorAll("[data-offer-rating]")];const ids=new Set(nodes.map(n=>n.dataset.offerRating));await loadOfferReputations(offers.filter(o=>ids.has(o.seller_id)));for(const node of nodes)if(node.isConnected){const offer=offers.find(o=>o.seller_id===node.dataset.offerRating);if(offer)node.textContent=offerRatingText(offer)}},0)}
function detailedOfferCard(offer){
 scheduleOfferRatings();if(typeof schedulePriorV33==='function')schedulePriorV33();
 const request=requests.find(r=>r.id===offer.request_id),deal=deals.find(d=>d.request_id===offer.request_id),mine=request?.buyer_id===user?.id,count=offerImages.filter(i=>i.offer_id===offer.id).length;
 const t=offerTerms(offer),rep=offerReputation(offer);
 if(typeof compactOfferCardV34==='function')return compactOfferCardV34(offer,request,deal,mine);
 return `<article class="card detailed-offer" data-offer-id="${esc(offer.id)}"><div class="small muted">${esc(request?.title||'Заявка')}</div><button class="mini-link" onclick="showSeller('${offer.seller_id}')">${esc(rep?.name||'Профиль продавца')} →</button><p class="small" data-offer-rating="${esc(offer.seller_id)}">${esc(offerRatingText(offer))}</p>${savedSellerButtonMarkup(offer.seller_id)}${deal?.offer_id===offer.id?'<span class="chip green">✓ Выбранное предложение</span>':''}${typeof offerBadgesV33==='function'?offerBadgesV33(offer):''}<h3>${money(offer.price)}</h3><dl class="offer-term-list">${offerGoodsCategory(request?.category)?`<dt>Состояние</dt><dd>${esc(t.condition||'Нужно уточнить')}</dd><dt>Получение</dt><dd>${esc(offerDeliveryText(offer))}</dd>`:''}<dt>Итого</dt><dd>${esc(offerTotalText(offer,request?.category))}</dd><dt>Срок</dt><dd>${esc(typeof offerDaysTextV33==='function'?offerDaysTextV33(offer):t.handover||'Нужно уточнить')}</dd>${offerWarrantyCategory(request?.category)?`<dt>Гарантия</dt><dd>${esc(offerWarrantyText(offer))}</dd>`:''}</dl>${request?offerFitMarkup(request,offer):''}<details><summary>Описание продавца</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(offer.description||'Без описания')}</p></details>${count?`<div class="photo-grid" id="gallery-${offer.id}">Загрузка фото…</div>`:''}<div class="row" style="flex-wrap:wrap;margin-top:12px"><button class="btn ghost" onclick="clarifyOffer('${offer.id}')">Уточнить условия</button><button class="btn ghost" onclick="openChat('${offer.id}')">Переписка</button>${mine&&request.status==='open'&&!request.is_hidden&&!deal?`<button class="btn" data-auction-select="${offer.request_id}" onclick="selectOffer('${offer.id}')">Выбрать продавца</button>`:''}${deal?.offer_id===offer.id?`<button class="btn ghost" onclick="showDeal('${deal.id}')">Сделка</button>`:''}</div></article>`;
}
function drawDetailedRequestOffers(id,target){
 const disclosure=typeof captureCardsV34==='function'?captureCardsV34(target):[];
 const a=sortedRequestOffers(offers.filter(o=>o.request_id===id),offerSortByRequest.get(id)||'new'),mine=requests.find(r=>r.id===id)?.buyer_id===user?.id;
 comparisonOfferIds=new Set([...comparisonOfferIds].filter(key=>a.some(o=>o.id===key)));
 const compare=mine&&a.length>1,sort=offerSortByRequest.get(id)||'new';
 target.innerHTML=a.length?`<label class="fieldlabel">Порядок предложений<select class="field" aria-label="Порядок предложений" onchange="sortDetailedRequestOffers('${id}',this.value)">${[['new','Сначала новые'],['total','По известной итоговой сумме'],['days','По указанному сроку'],['price_asc','Цена товара: сначала ниже'],['price_desc','Цена товара: сначала выше'],['rating','По рейтингу продавца']].map(([value,label])=>`<option value="${value}" ${sort===value?'selected':''}>${label}</option>`).join('')}</select></label>${compare?`<p class="small muted">Отметьте 2–3 предложения для сравнения.</p><button id="compareOffersButton" class="btn block" style="margin-bottom:12px" onclick="openOfferComparison()" ${comparisonOfferIds.size<2?'disabled':''}>Сравнить (${comparisonOfferIds.size}/3)</button>`:''}`+a.map(o=>(compare?`<label class="row small" style="padding:8px 0"><input type="checkbox" value="${esc(o.id)}" ${comparisonOfferIds.has(o.id)?'checked':''} onchange="toggleOfferComparison(this)"> В сравнение · ${money(o.price)}</label>`:'')+detailedOfferCard(o)).join(''):'<div class="empty">Предложений пока нет</div>';
 if(typeof restoreCardsV34==='function')restoreCardsV34(target,disclosure);for(const o of a)loadOfferGallery(o.id);updateAuctionControls(id);
}
async function loadDetailedRequestOffers(id){
 const target=$('requestOffers');if(!target)return;if(!user){target.innerHTML='<p class="muted">Войди, чтобы увидеть свои предложения.</p>';return}
 target.dataset.requestId=id;
 if(comparisonRequestId!==id){comparisonRequestId=id;comparisonOfferIds=new Set()}
 drawDetailedRequestOffers(id,target);await loadOfferReputations(offers.filter(o=>o.request_id===id));
 if(target.isConnected&&target.dataset.requestId===id)drawDetailedRequestOffers(id,target);
}
function sortDetailedRequestOffers(id,sort){
 if(!['new','total','days','price_asc','price_desc','rating'].includes(sort))return;offerSortByRequest.set(id,sort);
 const host=$('requestOffers');if(host?.dataset.requestId===id)drawDetailedRequestOffers(id,host);
}
function detailedOfferComparisonMarkup(request,selected){
 const row=(label,render)=>`<tr class="${label==='Итого'?'comparison-total-v41':''}"><th scope="row">${label==='Итого'?'Полная стоимость':label}</th>${selected.map(o=>`<td>${render(o)}</td>`).join('')}</tr>`,deal=deals.find(d=>d.request_id===request.id);
 return `${auctionPanelMarkup(request)}<p>${esc(request.title)} · бюджет ${money(request.budget)}</p><p class="small muted">Сравните условия каждого продавца. Доставка показана отдельно от цены товара. Гарантия и сроки указаны продавцом.</p>${typeof comparisonMobileV33==='function'?comparisonMobileV33(request,selected):''}<div class="offer-comparison-scroll" role="region" tabindex="0" aria-label="Сравнение предложений"><table class="offer-comparison"><thead><tr><th scope="col">Условия</th>${selected.map((o,i)=>`<th scope="col">${esc(offerReputation(o)?.name||'Продавец '+(i+1))}<br><button class="mini-link" onclick="showSeller('${o.seller_id}')">Профиль и отзывы →</button></th>`).join('')}</tr></thead><tbody>${row('Отметки',o=>typeof offerBadgesV33==='function'?offerBadgesV33(o):'')}${row('Рейтинг',o=>esc(offerRatingText(o)))}${row('Цена товара',o=>`<strong>${money(o.price)}</strong>`)}${row('Цена относительно бюджета',o=>Number(o.price)<=Number(request.budget)?'В пределах бюджета':'Выше на '+money(Number(o.price)-Number(request.budget)))}${offerGoodsCategory(request.category)?row('Наличие',o=>esc(offerTerms(o).availability||'Нужно уточнить'))+row('Состояние',o=>esc(offerTerms(o).condition||'Нужно уточнить'))+row('Получение и доставка',o=>esc(offerDeliveryText(o))):''}${row('Итого',o=>esc(offerTotalText(o,request.category)))}${row('Срок передачи',o=>esc(typeof offerDaysTextV33==='function'?offerDaysTextV33(o):offerTerms(o).handover||'Нужно уточнить'))}${offerWarrantyCategory(request.category)?row('Гарантия',o=>esc(offerWarrantyText(o))):''}${row('Совпадение с желанием',o=>offerFitMarkup(request,o))}${row('Описание продавца',o=>`<div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(o.description)}</div>`)}${row('Фотографии',o=>offerImages.some(i=>i.offer_id===o.id)?`<div class="photo-grid" id="gallery-${o.id}">Загрузка фото…</div>`:'Не добавлены')}${row('Действия',o=>`<button class="btn ghost block" onclick="clarifyOffer('${o.id}')">Уточнить условия</button><button class="btn ghost block" onclick="openChat('${o.id}')">Переписка</button>${!deal&&request.status==='open'&&!request.is_hidden?`<button class="btn block" data-auction-select="${o.request_id}" onclick="selectOffer('${o.id}')">Выбрать продавца</button>`:''}`)}</tbody></table></div><button class="btn ghost block" style="margin-top:16px" onclick="showRequest('${request.id}')">Вернуться к предложениям</button>`;
}
async function openDetailedOfferComparison(){
 const request=requests.find(r=>r.id===comparisonRequestId);if(!user||!request||request.buyer_id!==user.id)return;
 const selected=offers.filter(o=>o.request_id===request.id&&comparisonOfferIds.has(o.id));if(selected.length<2||selected.length>3)return;
 modal({title:'Сравнение предложений',body:'<div id="offerComparisonDetails"></div>'});const host=$('offerComparisonDetails');if(!host)return;
 host.innerHTML=detailedOfferComparisonMarkup(request,selected);loadAuctionPanel(request.id);updateAuctionControls(request.id);$('modal').scrollTop=0;for(const o of selected)loadOfferGallery(o.id);
 await loadOfferReputations(selected);if(!host.isConnected)return;
 const scroll=host.querySelector('.offer-comparison-scroll')?.scrollLeft||0;host.innerHTML=detailedOfferComparisonMarkup(request,selected);host.querySelector('.offer-comparison-scroll').scrollLeft=scroll;loadAuctionPanel(request.id);updateAuctionControls(request.id);for(const o of selected)loadOfferGallery(o.id);
}
async function clarifyOffer(id){
 const offer=offers.find(o=>o.id===id),request=requests.find(r=>r.id===offer?.request_id);if(!offer||!request||!user)return;
 await openChat(id);
 if($('chatMessages')?.dataset.offerId!==id)return;
 const input=$('modal').querySelector('.chat-composer [name=body]');if(!input||input.value)return;
 const term=offerTerms(offer),questions=[];
 if(!term.condition&&offerGoodsCategory(request.category))questions.push('состояние товара');
 if(offerGoodsCategory(request.category)&&(!term.delivery||offerShippingCost(offer)===null))questions.push('способ получения и стоимость доставки');
 if(!term.handover&&term.handover_days==null)questions.push('срок передачи');
 if(!term.warranty&&offerWarrantyCategory(request.category))questions.push('условия гарантии');
 input.value='Здравствуйте! Подскажите, пожалуйста, '+(questions.length?questions.join(', '):'подробности вашего предложения')+'.';
 input.focus();
}
