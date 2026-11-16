// Data is loaded before this module; brand normalization is available at runtime.
categoryBrands['Авто']=[...new Set([...categoryBrands['Авто'],...Object.keys(carModelDirectory)])];
subcategoryBrands['Легковые автомобили']=[...new Set([...subcategoryBrands['Легковые автомобили'],...Object.keys(carModelDirectory).filter(brand=>!commercialOrMotorcycleMakes.has(brand))])];
subcategoryBrands['Аренда транспорта']=subcategoryBrands['Легковые автомобили'];
subcategoryBrands['Телефоны и аксессуары']=[...new Set([...subcategoryBrands['Телефоны и аксессуары'],...Object.keys(phoneModelDirectory)])];
categoryBrands['Электроника']=[...new Set([...categoryBrands['Электроника'],...Object.keys(phoneModelDirectory)])];
for(const brand of Object.keys(phoneModelDirectory)){const record=productBrandByName.get(brand);if(record&&!record.groups.includes('Электроника'))record.groups.push('Электроника')}
function isCarModelCategory(category){return ['Авто','Легковые автомобили','Аренда транспорта'].includes(category)}
function isPhoneModelCategory(category){return category==='Телефоны и аксессуары'}
function modelCategoryKind(category){return isCarModelCategory(category)?'car':isPhoneModelCategory(category)?'phone':''}
function modelSearchKey(value){
  return directoryNormalize(value).replace(/галакси/g,'galaxy').replace(/айфон/g,'iphone').replace(/редми/g,'redmi').replace(/поко/g,'poco').replace(/камри/g,'camry').replace(/королла/g,'corolla').replace(/гранта/g,'granta').replace(/солярис/g,'solaris').replace(/лансер/g,'lancer').replace(/цивик/g,'civic').replace(/\+/g,'plus').replace(/[^\p{L}\p{N}]/gu,'');
}
function modelsForBrand(category,brand){
  const directory=isCarModelCategory(category)?carModelDirectory:isPhoneModelCategory(category)?phoneModelDirectory:null;
  if(!directory||!String(brand||'').trim())return {};
  const canonical=canonicalBrand(brand);
  const key=Object.keys(directory).find(name=>canonicalBrand(name)===canonical);
  return key?directory[key]:{};
}
function modelKeyForBrand(value,brand){
  let text=directoryNormalize(value);const canonical=canonicalBrand(brand);
  const prefixes=[canonical,...(brandAliases[canonical]||[])].map(directoryNormalize).filter(Boolean).sort((a,b)=>b.length-a.length);
  for(const prefix of prefixes)if(text.startsWith(prefix+' ')){text=text.slice(prefix.length).trim();break}
  return modelSearchKey(text);
}
function modelRecord(category,brand,model){
  const models=modelsForBrand(category,brand),key=Object.keys(models).find(name=>modelSearchKey(name)===modelSearchKey(model)||modelKeyForBrand(name,brand)===modelKeyForBrand(model,brand));
  return key?{name:key,value:models[key]}:null;
}
function searchModels(query,category,brand){
  const key=modelSearchKey(query),brandKey=modelKeyForBrand(query,brand);
  return Object.keys(modelsForBrand(category,brand)).filter(name=>modelSearchKey(name).includes(key)||modelKeyForBrand(name,brand).includes(brandKey)).sort((a,b)=>a.localeCompare(b,'ru',{numeric:true})).map(name=>({label:name,value:name,detail:''}));
}
function modelFieldAttributes(key,category){
  if(!modelCategoryKind(category))return '';
  const kind=key==='model'?'model':key==='generation'&&isCarModelCategory(category)?'generation':key==='storage'&&isPhoneModelCategory(category)?'storage':'';
  return kind?`data-directory="${kind}" data-category="${categoryEscape(category)}"`:'';
}
function modelFieldBrand(input){
  const scope=input.closest('#homeBrandField,#catalogBrandField')||input.closest('form');
  return scope?.querySelector('[name="filterBrand"],[name="detail_brand"]')?.value||'';
}
function modelFieldModel(input){return input.closest('form')?.querySelector('[name="detail_model"]')?.value||''}
function searchModelField(input,query){
  const category=directoryCategory(input),brand=modelFieldBrand(input),record=modelRecord(category,brand,modelFieldModel(input));
  if(input.dataset.directory==='model')return searchModels(query,category,brand);
  const values=input.dataset.directory==='generation'?(record?.value||[]):(record?.value?.storage||[]).map(size=>size+' ГБ');
  const key=modelSearchKey(query);
  return (Array.isArray(values)?values:[]).filter(value=>modelSearchKey(value).includes(key)).map(value=>({label:value,value,detail:''}));
}
function syncModelControls(brandInput,reset=false){
  const scope=brandInput.closest('#homeBrandField,#catalogBrandField')||brandInput.closest('form');if(!scope)return;
  const model=scope.querySelector('[name="detail_model"],[name="filterModel"]');
  if(!model||!modelCategoryKind(directoryCategory(model)))return;
  const key=directoryNormalize(canonicalBrand(brandInput.value));
  const previous=brandInput.dataset.observedModelBrand;
  if(reset&&previous!==undefined&&previous!==key){
    model.value='';model.dispatchEvent(new Event('change',{bubbles:true}));
    for(const field of scope.querySelectorAll('[name="detail_generation"],[name="detail_storage"]'))field.value='';
  }
  brandInput.dataset.observedModelBrand=key;
  model.disabled=!key&&!model.value.trim();model.placeholder=key?'Выберите модель или введите свою':'Сначала выберите бренд';
  const browse=model.closest('.directory-picker')?.querySelector('.directory-browse');if(browse)browse.disabled=model.disabled;
  syncModelDependents(model,false);
}
function syncModelDependents(input,reset=true){
  if(input.name!=='detail_model')return;
  const scope=input.closest('form');if(!scope)return;
  const key=modelSearchKey(input.value),previous=input.dataset.observedModel;
  for(const field of scope.querySelectorAll('[name="detail_generation"],[name="detail_storage"]')){
    if(reset&&previous!==undefined&&previous!==key)field.value='';
    field.disabled=input.disabled||!key;
    const browse=field.closest('.directory-picker')?.querySelector('.directory-browse');if(browse)browse.disabled=field.disabled;
    field.placeholder=field.disabled?'Сначала выберите модель':field.name==='detail_generation'?'Выберите поколение или укажите своё':'Выберите память или укажите свою';
  }
  input.dataset.observedModel=key;
}
let homeModelFilter='';
function modelFilterMarkup(category,brand,value='',source=''){
  if(!modelCategoryKind(category))return '';
  return `<label class="fieldset" style="display:block"><span class="fieldlabel">Модель</span><input class="field" name="filterModel" data-directory="model" data-category="${categoryEscape(category)}" maxlength="120" value="${categoryEscape(value)}" ${brand?'':'disabled'} placeholder="${brand?'Выберите модель или введите свою':'Сначала выберите бренд'}" oninput="updateModelFilter(this,'${source}')"></label>`;
}
function updateModelFilter(input,source){
  if(source==='home'){homeModelFilter=input.value;renderHomeFeed()}
  else if(catalogDraftV2321)catalogDraftV2321.model=input.value;
}
function modelMatchesRequest(request,filter,brand=''){
  if(!String(filter||'').trim())return true;
  const key=modelSearchKey(filter),actual=String(request.description||'').match(/^Модель:\s*(.+)$/m)?.[1];
  const requestBrand=String(request.description||'').match(/^Бренд \/ марка:\s*(.+)$/m)?.[1]||brand;
  if(actual){
    const expected=modelRecord(request.category,requestBrand,filter),found=modelRecord(request.category,requestBrand,actual);
    return expected?(found?.name===expected.name||modelKeyForBrand(actual,requestBrand)===modelKeyForBrand(filter,requestBrand)):modelSearchKey(actual).includes(key);
  }
  const text=directoryNormalize([request.title,request.description].join(' '));
  const escaped=directoryNormalize(filter).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?:$|[^\\p{L}\\p{N}])','u').test(text);
}
function genericModelMarkup(category){
  if(!modelCategoryKind(category))return '';
  const keys=isCarModelCategory(category)?['model','generation','year','mileage','gearbox']:['model','storage'];
  return requestFieldDefinitions(category).filter(field=>keys.includes(field[0])).map(field=>requestDetailFieldMarkup(field,category)).join('');
}
function genericModelDescription(formData,category){
  if(!modelCategoryKind(category))return '';
  const values=new FormData();
  for(const key of ['model','generation','year','mileage','gearbox','storage']){
    const value=formData.get('detail_'+key);if(value)values.set('detail_'+key,value);
  }
  return requestDescription(values,category);
}
