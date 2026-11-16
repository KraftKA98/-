function directoryNormalize(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[’‘`]/g,"'").replace(/[‐‑–—]/g,'-').replace(/\s+/g,' ').trim()}
const cityNameCounts=new Map();
for(const [name] of russianCities){const key=directoryNormalize(name);cityNameCounts.set(key,(cityNameCounts.get(key)||0)+1)}
const citySearchIndex=russianCities.map(([name,region,aliases])=>({
  label:name,detail:region,value:cityNameCounts.get(directoryNormalize(name))>1?name+' ('+region+')':name,
  nameKey:directoryNormalize(name),key:directoryNormalize([name,region,...aliases].join(' '))
}));
function searchCities(query,limit=30){
  const key=directoryNormalize(query).replace(/[(),]/g,' ').replace(/\s+/g,' ').trim(),tokens=key.split(' ').filter(Boolean);
  return citySearchIndex.filter(city=>tokens.every(token=>city.key.includes(token)))
    .sort((a,b)=>(b.nameKey===key)-(a.nameKey===key)||(b.nameKey.startsWith(key))-(a.nameKey.startsWith(key))||a.label.localeCompare(b.label,'ru'))
    .slice(0,limit);
}
function canonicalBrand(value){
  const key=directoryNormalize(value);
  return Object.entries(brandAliases).find(([brand,aliases])=>[brand,...aliases].some(alias=>directoryNormalize(alias)===key))?.[0]||value;
}
function searchBrands(query,category,limit=30){
  const key=directoryNormalize(query);
  return brandsForCategory(category).filter(brand=>[brand,...(brandAliases[brand]||[])].some(alias=>directoryNormalize(alias).includes(key)))
    .sort((a,b)=>Number(directoryNormalize(b).startsWith(key))-Number(directoryNormalize(a).startsWith(key))||a.localeCompare(b,'ru'))
    .slice(0,limit).map(brand=>({label:brand,value:brand,detail:''}));
}
function brandMatchesRequest(request,filter){
  if(!directoryNormalize(filter))return true;
  const canonical=canonicalBrand(filter),aliases=[canonical,...(brandAliases[canonical]||[])].map(directoryNormalize);
  const structured=String(request.description||'').match(/^Бренд \/ марка:\s*(.+)$/m)?.[1];
  if(structured)return aliases.some(alias=>directoryNormalize(canonicalBrand(structured))===alias);
  const text=directoryNormalize([request.title,request.description].join(' '));
  return aliases.some(alias=>{
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    return new RegExp('(?:^|[^\\p{L}\\p{N}])'+escaped+'(?:$|[^\\p{L}\\p{N}])','u').test(text);
  });
}
function cityMatchesRequest(city,filter){return directoryNormalize(city).includes(directoryNormalize(filter))}
function requestSearchMatches(request,query){
  const key=directoryNormalize(query);if(!key)return true;
  const text=directoryNormalize([request.title,request.description,request.city,request.category].join(' '));
  if(text.includes(key))return true;
  const canonical=canonicalBrand(query);
  return directoryNormalize(canonical)!==key&&brandMatchesRequest(request,canonical);
}
let homeBrandFilter='';
function updateBrandFilter(input,source){
  if(source==='home'){homeBrandFilter=input.value;renderHomeFeed()}
  else if(catalogDraftV2321)catalogDraftV2321.brand=input.value;
}
function brandFieldMarkup(category,value='',source=''){
  if(!categoryHasBrand(category)&&category)return '';
  const name=source?'filterBrand':'detail_brand';
  return `<label class="fieldset" style="display:block"><span class="fieldlabel">Бренд / марка</span><input class="field" name="${name}" data-directory="brand" data-category="${categoryEscape(category)}" maxlength="80" placeholder="Начните вводить бренд" value="${categoryEscape(value)}" ${source?`oninput="updateBrandFilter(this,'${source}')"`:''}><span class="small muted">Можно выбрать из подсказок или указать свой бренд.</span></label>`;
}
function refreshBrandFilter(source){
  const home=source==='home',host=document.getElementById(home?'homeBrandField':'catalogBrandField');
  if(!host)return;
  const category=home?homeCategorySelectedV232:catalogDraftV2321?.category||'';
  const value=home?homeBrandFilter:catalogDraftV2321?.brand||'';
  host.innerHTML=brandFieldMarkup(category,value,source);
}
function directoryCategory(input){return input.dataset.category||input.closest('form')?.querySelector('[name="category"]')?.value||''}
let directorySequence=0;
function attachDirectory(input){
  if(input.dataset.directoryReady)return;
  input.dataset.directoryReady='true';
  const city=input.dataset.directory==='city';
  const wrapper=document.createElement('div');wrapper.className='directory-picker';
  input.before(wrapper);wrapper.append(input);
  const list=document.createElement('div');list.id='directory-options-'+(++directorySequence);list.className='directory-options';list.role='listbox';list.hidden=true;wrapper.append(list);
  input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',list.id);input.setAttribute('aria-expanded','false');input.autocomplete='off';
  if(!input.getAttribute('aria-label')&&!input.id)input.setAttribute('aria-label',city?'Город':'Бренд / марка');
  let results=[],active=-1;
  function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1}
  function highlight(){
    list.querySelectorAll('[role="option"]').forEach((option,i)=>{option.setAttribute('aria-selected',String(i===active));if(i===active){input.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'})}});
  }
  function choose(index){
    const chosen=results[index];if(!chosen)return;
    input.value=chosen.value;close();
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));close();
  }
  function draw(){
    results=city?searchCities(input.value):searchBrands(input.value,directoryCategory(input));active=-1;
    list.innerHTML=results.map((result,i)=>`<div role="option" aria-selected="false" id="${list.id}-${i}" data-option="${i}" class="directory-option"><strong>${categoryEscape(result.label)}</strong>${result.detail?`<span>${categoryEscape(result.detail)}</span>`:''}</div>`).join('')+`<div class="directory-hint" role="presentation">${results.length?(results.length===30?'Уточните название, чтобы сузить список.':'Выберите вариант из списка.'):'Совпадений нет. Можно ввести название вручную.'}</div>`;
    list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
    requestAnimationFrame(()=>{if(document.activeElement===input&&!list.hidden)list.scrollIntoView({block:'nearest'})});
  }
  input.addEventListener('focus',draw);input.addEventListener('input',draw);
  input.addEventListener('blur',close);
  list.addEventListener('mousedown',e=>e.preventDefault());
  list.addEventListener('click',e=>{const option=e.target.closest('[data-option]');if(option)choose(Number(option.dataset.option))});
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){if(!list.hidden){close();event.stopPropagation()}return}
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();if(list.hidden)draw();
      if(results.length){active=active<0?(event.key==='ArrowDown'?0:results.length-1):(active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;highlight()}
    }else if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();choose(active)}
    else if(event.key==='Tab')close();
  });
}
function initializeDirectories(root=document){
  const selector='input[name="city"],#homeCityV231,#catalogCityV2321,input[data-directory]';
  if(root.matches?.(selector)){if(!root.dataset.directory)root.dataset.directory='city';attachDirectory(root)}
  root.querySelectorAll?.(selector).forEach(input=>{if(!input.dataset.directory)input.dataset.directory='city';attachDirectory(input)});
}
document.addEventListener('DOMContentLoaded',()=>{
  initializeDirectories();
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)initializeDirectories(node)});
  observer.observe(document.body,{childList:true,subtree:true});
});
