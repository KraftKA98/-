const carBrandByName=new Map(carBrandDirectory.map(record=>[record.name,record]));
categoryBrands['Авто']=[...new Set([...categoryBrands['Авто'],...carBrandByName.keys()])];
const commercialOrMotorcycleMakes=new Set(['BeiBen','Berliet','BharatBenz','Brammo','CAMC','DAF','DINA','Eicher','ERF','FAW Jiefang','Foden','Freightliner','Golden Dragon','Higer','Hino','Hongyan','IC Bus','IH','International','Irizar','Jawa','КАМАЗ','Kenworth','King Long','KTM','Leyland','Mack','MAN','МАЗ','Navistar','Nikola','Paccar','Pegaso','Peterbilt','Polaris','Scania','Setra','Shacman','Sinotruk','Sisu','Sterling','UD','Western Star','Workhorse','Yutong','Zhongtong']);
subcategoryBrands['Легковые автомобили']=[...new Set([...carBrandByName.keys(), 'Москвич','Aurus','Belgee','Tank','Voyah','Evolute','Sollers'])].filter(name=>!commercialOrMotorcycleMakes.has(name));
subcategoryBrands['Аренда транспорта']=subcategoryBrands['Легковые автомобили'];
Object.assign(brandAliases,{
  'Acura':['Акура'],'Alfa Romeo':['Альфа Ромео'],'Alpina':['Альпина'],'Alpine':['Альпин'],
  'Aston Martin':['Астон Мартин'],'Audi':['Ауди'],'Bentley':['Бентли'],'Bugatti':['Бугатти'],
  'Buick':['Бьюик'],'BYD':['Бид','Би Вай Ди'],'Cadillac':['Кадиллак'],'Chevrolet':['Шевроле'],
  'Chrysler':['Крайслер'],'Citroën':['Citroen','Ситроен'],'Cupra':['Купра'],'Dacia':['Дачия'],
  'Daewoo':['Дэу','Деу'],'Daihatsu':['Дайхатсу'],'Datsun':['Датсун'],'Dodge':['Додж'],
  'Dongfeng':['Донгфенг','Дунфэн'],'EXEED':['Exeed','Эксид'],'FAW':['ФАВ'],
  'Ferrari':['Феррари'],'Fiat':['Фиат'],'Ford':['Форд'],'Foton':['Фотон'],
  'GAC':['GAC Group','ГАК'],'Genesis':['Генезис'],'Great Wall':['Грейт Волл'],
  'Honda':['Хонда'],'Hongqi':['Хончи'],'Hummer':['Хаммер'],'Infiniti':['Инфинити'],
  'Isuzu':['Исузу'],'JAC':['Джак'],'Jaguar':['Ягуар'],'Jeep':['Джип'],
  'Jetour':['Джетур'],'Jetta':['Джетта'],'JAECOO':['Jaecoo','Джейку'],
  'Lamborghini':['Ламборгини'],'Land Rover':['Ленд Ровер','Лэнд Ровер'],
  'Lexus':['Лексус'],'Li Auto':['Lixiang','Лисян','Ли Сян'],'Lifan':['Лифан'],
  'Lincoln':['Линкольн'],'Lotus':['Лотус'],'Lynk & Co':['Линк энд Ко'],
  'Maserati':['Мазерати'],'Mazda':['Мазда'],'McLaren':['Макларен'],'MINI':['Mini','Мини'],
  'Mitsubishi':['Митсубиси','Мицубиси'],'Nissan':['Ниссан'],'OMODA':['Omoda','Омода'],
  'Opel':['Опель'],'Peugeot':['Пежо'],'Porsche':['Порше'],'Rolls-Royce':['Роллс-Ройс','Роллс Ройс'],
  'SEAT':['Seat','Сеат'],'Smart':['Смарт'],'SsangYong':['Ссангйонг','Санг Енг'],
  'Subaru':['Субару'],'Suzuki':['Сузуки'],'Tesla':['Тесла'],'Volvo':['Вольво'],
  'Wey':['WEY','Вей'],'XPeng':['XPENG','Сяопэн'],'Zeekr':['Зикр','Зикер'],
  'ГАЗ':['GAZ'],'УАЗ':['UAZ'],'КАМАЗ':['Kamaz'],'МАЗ':['MAZ'],'ЗАЗ':['ZAZ'],
  'BAIC':['BAIC Motor','БАИК'],'AITO':['Аито'],'Avatr':['Аватр'],
  'KGM':['КГМ'],'GMC':['Джи Эм Си']
});
let carLogoBundle=null,carLogoLoading=null;
function loadCarLogos(){
  if(!carLogoLoading)carLogoLoading=fetch('./car-logos.json').then(response=>{
    if(!response.ok)throw Error('Logo bundle unavailable');return response.json();
  }).then(bundle=>{carLogoBundle=bundle;applyCarLogos();return true}).catch(()=>{carLogoLoading=null;return false});
  return carLogoLoading;
}
function applyCarLogos(){
  if(!carLogoBundle)return;
  document.querySelectorAll('[data-car-logo]').forEach(host=>{
    if(host.dataset.logoReady||host.dataset.logoLoading)return;
    const source=carLogoBundle[host.dataset.carLogo];
    if(typeof source!=='string'||!/^data:image\/(?:png|svg\+xml);base64,/.test(source))return;
    host.dataset.logoLoading='true';
    const image=document.createElement('img');image.alt='';image.decoding='async';
    image.addEventListener('load',()=>{host.replaceChildren(image);host.dataset.logoReady='true'});
    image.addEventListener('error',()=>{delete host.dataset.logoLoading});
    image.src=source;
  });
}
function carBrandBadge(brand,category){
  if(categoryGroup(category)?.[1]!=='Авто'||['Водный транспорт','Мотоциклы и мототехника'].includes(category))return '';
  const record=carBrandByName.get(canonicalBrand(brand));if(!record)return '';
  loadCarLogos().then(()=>applyCarLogos());
  return `<span class="car-brand-badge" role="img" aria-label="${categoryEscape(record.name)}" data-car-logo="${categoryEscape(record.slug)}">${categoryEscape(record.name.slice(0,2))}</span>`;
}
function requestCarBadge(request){
  const brand=String(request.description||'').match(/^Бренд \/ марка:\s*(.+)$/m)?.[1];
  return brand?carBrandBadge(brand,request.category):'';
}
