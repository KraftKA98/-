const productBrandByName=new Map(productBrandDirectory.map(record=>[record.name,record]));
categoryBrands['Другое']=[...new Set(Object.entries(categoryBrands).filter(([group])=>!['Авто','Услуги','Другое'].includes(group)).flatMap(([,brands])=>brands))];
let productLogoBundle=null,productLogoLoading=null;
function loadProductLogos(){
  if(!productLogoLoading)productLogoLoading=fetch('./product-logos.json').then(response=>{
    if(!response.ok)throw Error('Product logo bundle unavailable');return response.json();
  }).then(bundle=>{productLogoBundle=bundle;applyProductLogos();return true}).catch(()=>{productLogoLoading=null;return false});
  return productLogoLoading;
}
function applyProductLogos(){
  if(!productLogoBundle)return;
  document.querySelectorAll('[data-product-logo]').forEach(host=>{
    if(host.dataset.logoReady||host.dataset.logoLoading)return;
    const source=productLogoBundle[host.dataset.productLogo];
    if(typeof source!=='string'||!/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,/.test(source))return;
    host.dataset.logoLoading='true';
    const image=document.createElement('img');image.alt='';image.decoding='async';
    image.addEventListener('load',()=>{host.replaceChildren(image);host.dataset.logoReady='true';host.classList.remove('is-monogram')});
    image.addEventListener('error',()=>{delete host.dataset.logoLoading});image.src=source;
  });
}
function brandInitials(name){
  const words=String(name).match(/[\p{L}\p{N}]+/gu)||[];
  return (words.length>1?words[0][0]+words[1][0]:words[0]?.slice(0,2)||'?').toLocaleUpperCase('ru');
}
function brandBadge(brand,category){
  if(!String(brand||'').trim()||(!categoryHasBrand(category)&&category))return '';
  const name=canonicalBrand(brand),group=categoryGroup(category)?.[1]||'';
  if(group==='Авто'){
    const carBadge=carBrandBadge(name,category);if(carBadge)return carBadge;
  }
  const candidate=productBrandByName.get(name);
  const record=candidate&&(!group||group==='Другое'||candidate.groups.includes(group))?candidate:null;
  const monogram=brandInitials(name);
  if(record){
    loadProductLogos().then(()=>applyProductLogos());
    return `<span class="car-brand-badge product-brand-badge is-monogram" role="img" aria-label="${categoryEscape(name)}" data-product-logo="${categoryEscape(record.id)}">${categoryEscape(monogram)}</span>`;
  }
  return `<span class="car-brand-badge product-brand-badge is-monogram" role="img" aria-label="${categoryEscape(name)} — инициалы бренда">${categoryEscape(monogram)}</span>`;
}
function requestBrandBadge(request){
  const brand=String(request.description||'').match(/^Бренд \/ марка:\s*(.+)$/m)?.[1];
  return brand?brandBadge(brand,request.category):'';
}
function refreshGenericBrandFields(picker){
  const host=picker.closest('form')?.querySelector('[data-generic-brand]');if(!host)return;
  const category=picker.querySelector('[name="category"]').value;
  const previous=host.querySelector('input')?.value||'';
  const keep=brandsForCategory(category).includes(canonicalBrand(previous));
  host.innerHTML=category&&categoryHasBrand(category)?brandFieldMarkup(category,keep?previous:'')+genericModelMarkup(category):'';
}
function descriptionWithBrand(formData,category,limit=2000){
  const brand=String(formData.get('detail_brand')||'').trim();
  if(brand.length>80||/[\r\n]/.test(brand))throw Error('Проверьте название бренда (до 80 символов)');
  const prefix=brand&&categoryHasBrand(category)?'Бренд / марка: '+canonicalBrand(brand):'';
  const metadata=[prefix,genericModelDescription(formData,category)].filter(Boolean).join('\n');
  const text=[metadata,String(formData.get('description')||'').trim()].filter(Boolean).join('\n\n');
  if(text.length>limit)throw Error('Сократите описание вместе с брендом до '+limit+' символов');
  return text;
}
