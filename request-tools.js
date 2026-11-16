// Extra request details use the existing description field, so existing clients
// and server-side matching continue to read the same request shape.
function requestFieldDefinitions(category){
  const group=categoryGroup(category)?.[1];
  if(group==='Недвижимость')return [
    ['intent','Что нужно','select',['Купить','Снять на длительный срок','Снять посуточно']],
    ['district','Район или ориентир','text'],['area','Площадь от, м²','number'],
    ['rooms','Количество комнат','text']];
  if(group==='Работа')return [
    ['role','Ваша цель','select',['Ищу работу','Ищу сотрудника']],
    ['schedule','График','select',['Полный день','По сменам','Гибкий график','Удалённо','Подработка']],
    ['position','Должность или специализация','text']];
  if(group==='Услуги')return [
    ['task','Что нужно сделать','text'],['location','Где выполнить','text'],
    ['deadline','Желаемый срок','date']];
  const fields=[['condition','Состояние','select',['Новое','Б/у','Не имеет значения']],
    ['delivery','Получение','select',['Самовывоз','Доставка','Любой вариант']]];
  if(['Электроника','Компьютеры','Авто','Бытовая техника','Инструменты','Сад','Бизнес и оборудование'].includes(group))fields.unshift(['model','Модель','text']);
  if(group==='Электроника'||group==='Компьютеры')fields.push(['specs','Память и важные характеристики','text']);
  if(group==='Авто')fields.push(['year','Год выпуска от','number'],['mileage','Пробег до, км','number']);
  if(isCarModelCategory(category))return [['model','Модель','text'],['generation','Поколение','text'],['year','Год выпуска от','number'],['mileage','Пробег до, км','number'],['gearbox','Коробка передач','select',['Механическая','Автоматическая','Робот','Вариатор','Не имеет значения']],...fields.filter(field=>!['model','year','mileage'].includes(field[0]))];
  if(isPhoneModelCategory(category)){fields.splice(1,0,['storage','Встроенная память','text']);for(const field of fields)if(field[0]==='specs')field[1]='Другие характеристики'}
  return fields;
}
function requestDetailFieldMarkup([key,label,type,options],category){
  return `<label class="fieldset" style="display:block"><span class="fieldlabel">${esc(label)}</span>${type==='select'?`<select class="field" name="detail_${key}"><option value="">Не указано</option>${options.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select>`:`<input class="field" name="detail_${key}" type="${type}" ${modelFieldAttributes(key,category)} ${type==='number'?'min="0" max="1000000000" step="1"':type==='text'?'maxlength="120"':''}>`}</label>`;
}
function requestDetailsMarkup(category,brand=''){
  if(!category)return '<p class="small muted">Выберите категорию — появятся подсказки для вашего желания.</p>';
  return '<p class="small muted">Уточните важное, чтобы получать подходящие предложения. Эти поля необязательные.</p>'+`<div data-request-brand>${brandFieldMarkup(category,brand)}</div>`+requestFieldDefinitions(category).map(field=>requestDetailFieldMarkup(field,category)).join('');
}
function refreshRequestFields(picker){
  const form=picker.closest('form');if(!form?.querySelector('[data-request-details]'))return;
  const category=picker.querySelector('[name="category"]').value;
  const details=form.querySelector('[data-request-details]');
  // Retain values shared by subcategories in the same main section.
  const group=categoryGroup(category)?.[1]||'';
  const previousCategory=details.querySelector('[name="detail_brand"]')?.dataset.category||'';
  const signature=JSON.stringify(requestFieldDefinitions(category));
  if(details.dataset.group!==group||details.dataset.fieldSignature!==signature){
    const previous=details.dataset.group===group?Object.fromEntries([...details.querySelectorAll('[name^="detail_"]')].map(field=>[field.name,field.value])):{};
    const sameKind=modelCategoryKind(previousCategory)===modelCategoryKind(category);
    details.innerHTML=requestDetailsMarkup(category);details.dataset.group=group;details.dataset.fieldSignature=signature;
    for(const [name,value] of Object.entries(previous)){
      if(!sameKind&&['detail_model','detail_generation','detail_storage'].includes(name))continue;
      const field=details.querySelector(`[name="${name}"]`);if(field)field.value=value;
    }
  }
  const brandHost=details.querySelector('[data-request-brand]');
  if(brandHost){
    const input=brandHost.querySelector('input');
    if(input?.dataset.category!==category){
      const previous=input?.value||'',known=brandsForCategory('').includes(canonicalBrand(previous));
      const keep=!known||brandsForCategory(category).includes(canonicalBrand(previous));
      brandHost.innerHTML=brandFieldMarkup(category,keep?previous:'');
    }
  }
  refreshRequestBudget(form);
}
function refreshRequestBudget(form){
  const category=form.querySelector('[name="category"]').value;
  const group=categoryGroup(category)?.[1];
  const intent=form.querySelector('[name="detail_intent"]')?.value;
  const label=group==='Работа'?'Зарплата в месяц, ₽':group==='Недвижимость'&&intent==='Снять на длительный срок'?'Бюджет в месяц до, ₽':group==='Недвижимость'&&intent==='Снять посуточно'?'Бюджет за сутки до, ₽':'Бюджет до, ₽';
  form.querySelector('[data-budget-label]').textContent=label;
}
function requestDescription(formData,category){
  const lines=[];
  const brand=String(formData.get('detail_brand')||'').trim();
  if(brand&&categoryHasBrand(category)){
    if(brand.length>80||/[\r\n]/.test(brand))throw Error('Проверьте название бренда (до 80 символов)');
    lines.push('Бренд / марка: '+canonicalBrand(brand));
  }
  for(const [key,label,type,options] of requestFieldDefinitions(category)){
    const value=String(formData.get('detail_'+key)||'').trim();if(!value)continue;
    if(value.length>120||(type==='select'&&!options.includes(value)))throw Error('Проверьте характеристики');
    if(key==='year'&&(Number(value)<1886||Number(value)>new Date().getFullYear()+1))throw Error('Проверьте год выпуска');
    if(type==='number'&&(!Number.isFinite(Number(value))||Number(value)<0||Number(value)>1000000000))throw Error('Проверьте числовые характеристики');
    if(type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Проверьте дату');
    lines.push(label+': '+value);
  }
  const intent=String(formData.get('detail_intent')||'');
  if(categoryGroup(category)?.[1]==='Работа')lines.push('Зарплата указана за месяц');
  else if(intent==='Снять на длительный срок')lines.push('Бюджет указан за месяц');
  else if(intent==='Снять посуточно')lines.push('Бюджет указан за сутки');
  const description=[lines.join('\n'),String(formData.get('description')||'').trim()].filter(Boolean).join('\n\n');
  if(description.length>2000)throw Error('Сократите подробности: вместе с характеристиками допускается 2000 символов');
  return description;
}
function requestFormMarkup(prefill={}){
  const category=isKnownCategory(prefill.category)?prefill.category:'';
  return `<form onsubmit="createRequest(event)" onchange="refreshRequestBudget(this)">
    <label class="fieldset" style="display:block"><span class="fieldlabel">Что вы ищете?</span><input class="field" name="title" maxlength="120" minlength="4" required placeholder="Например, ноутбук для учёбы" value="${esc(prefill.title||'')}"></label>
    <div class="fieldset"><span class="fieldlabel">Категория</span>${categoryPicker(category)}</div>
    <div data-request-details data-group="${esc(categoryGroup(category)?.[1]||'')}">${requestDetailsMarkup(category,prefill.brand)}</div>
    <label class="fieldset" style="display:block"><span class="fieldlabel" data-budget-label>Бюджет до, ₽</span><input class="field" type="number" min="1" max="1000000000" step="1" name="budget" required value="${esc(prefill.budget||'')}"></label>
    <label class="fieldset" style="display:block"><span class="fieldlabel">Город</span><input class="field" name="city" minlength="2" maxlength="100" required value="${esc(prefill.city||profile?.city||'')}"></label>
    <label class="fieldset" style="display:block"><span class="fieldlabel">Дополнительные пожелания</span><textarea class="field" name="description" maxlength="2000" placeholder="Что ещё важно?">${esc(prefill.description||'')}</textarea></label>
    ${requestPhotoEditorMarkup()}<p class="small muted">Характеристики войдут в описание. Общая длина — до 2000 символов.</p>
    <button class="btn block" type="submit">Опубликовать запрос</button></form>`;
}
function createWishFromSearch(source){
  const home=source==='home';
  const title=$(home?'homeFeedSearch':'search')?.value.trim()||'';
  const category=home?homeCategorySelectedV232:catalogFilterV2321.category;
  const city=home?$('homeCityV231')?.value.trim():catalogFilterV2321.city;
  if(!requireAuth())return;
  openRequest({title,category,city,brand:home?homeBrandFilter:catalogFilterV2321.brand,details:{model:home?homeModelFilter:catalogFilterV2321.model||''}});
}
function resetEmptySearch(source){
  if(source==='home'){resetHomeFiltersV231();return}
  $('search').value='';Object.assign(catalogFilterV2321,{category:'',city:'',brand:'',model:'',min:'',max:'',sort:'new'});renderCatalog();
}
function emptyWishMarkup(source){
  return `<div class="empty"><h3>Такого желания пока нет</h3><p>Расскажите, что ищете, — продавцы смогут предложить варианты.</p><div class="row" style="justify-content:center;flex-wrap:wrap"><button class="btn" onclick="createWishFromSearch('${source}')">Создать такое желание</button><button class="btn ghost" onclick="resetEmptySearch('${source}')">Сбросить фильтры</button></div></div>`;
}
let comparisonRequestId=null,comparisonOfferIds=new Set();
function toggleOfferComparison(input){
  if(input.checked&&comparisonOfferIds.size>=3){input.checked=false;toast('Можно сравнить до трёх предложений');return}
  input.checked?comparisonOfferIds.add(input.value):comparisonOfferIds.delete(input.value);
  const button=$('compareOffersButton');if(button){button.disabled=comparisonOfferIds.size<2;button.textContent='Сравнить ('+comparisonOfferIds.size+'/3)'}
}
function openOfferComparison(){
  const request=requests.find(r=>r.id===comparisonRequestId);
  if(!request||request.buyer_id!==user?.id)return;
  const selected=offers.filter(o=>o.request_id===request.id&&comparisonOfferIds.has(o.id));
  if(selected.length<2||selected.length>3)return;
  const row=(label,render)=>`<tr><th scope="row">${label}</th>${selected.map((o,i)=>`<td>${render(o,i)}</td>`).join('')}</tr>`;
  const deal=deals.find(d=>d.request_id===request.id);
  modal({title:'Сравнение предложений',body:`<p>${esc(request.title)} · бюджет ${money(request.budget)}</p><p class="small muted">Прокрутите таблицу в сторону, чтобы увидеть все предложения.</p><div style="overflow-x:auto"><table class="offer-comparison"><thead><tr><th scope="col">Условия</th>${selected.map((o,i)=>`<th scope="col">Продавец ${i+1}<br><button class="mini-link" onclick="showSeller('${o.seller_id}')">Профиль и отзывы →</button></th>`).join('')}</tr></thead><tbody>
    ${row('Цена',o=>`<strong>${money(o.price)}</strong>`)}
    ${row('Относительно бюджета',o=>Number(o.price)<=Number(request.budget)?'В пределах бюджета':'Выше на '+money(Number(o.price)-Number(request.budget)))}
    ${row('Характеристики и условия',o=>`<div style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(o.description)}</div>`)}
    ${row('Фотографии',o=>offerImages.some(img=>img.offer_id===o.id)?`<div class="photo-grid" id="gallery-${o.id}">Загрузка фото…</div>`:'Не добавлены')}
    ${row('Действия',o=>`<button class="btn ghost" onclick="openChat('${o.id}')">Переписка</button>${!deal&&request.status==='open'?`<button class="btn" style="margin-top:8px" onclick="selectOffer('${o.id}')">Выбрать продавца</button>`:''}`)}
    </tbody></table></div><button class="btn ghost block" style="margin-top:16px" onclick="showRequest('${request.id}')">Вернуться к предложениям</button>`});
  for(const offer of selected)loadOfferGallery(offer.id);
}
