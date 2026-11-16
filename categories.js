// Category names are persisted as text. Keep existing names stable for old requests
// and server-side subscription matching; each new subcategory has a unique name.
const categoryTree = [
  ['📱','Электроника',['Телефоны и аксессуары','Планшеты и электронные книги','Аудио и видео','Фотоаппараты и объективы','Игры и приставки']],
  ['🚗','Авто',['Легковые автомобили','Мотоциклы и мототехника','Грузовики и спецтехника','Водный транспорт','Аренда транспорта']],
  ['🔧','Запчасти и аксессуары',['Автозапчасти','Шины и диски','Автоэлектроника','Масла и автохимия','Аксессуары для транспорта']],
  ['🏠','Недвижимость',['Квартиры','Комнаты','Дома и дачи','Земельные участки','Гаражи и машиноместа','Коммерческая недвижимость','Аренда жилья на длительный срок']],
  ['💼','Работа',['Ищу работу','Ищу сотрудника','Подработка','Удалённая работа']],
  ['🛠️','Услуги',['Ремонт и отделка','Строительство домов','Уборка','Грузоперевозки и переезды','Ремонт техники','Автосервис','Обучение и репетиторы','IT и дизайн','Деловые услуги','Красота и уход — услуги','Организация мероприятий','Бытовая помощь']],
  ['👕','Одежда',['Женская одежда','Мужская одежда','Обувь','Сумки и аксессуары','Часы и украшения']],
  ['🧸','Детские товары',['Детская одежда и обувь','Игрушки','Коляски и автокресла','Детская мебель','Товары для кормления и ухода','Товары для школы']],
  ['💄','Красота',['Косметика','Парфюмерия','Приборы для ухода','Товары для здоровья']],
  ['🛋️','Мебель',['Диваны и кресла','Кровати и матрасы','Шкафы и комоды','Столы и стулья','Кухонные гарнитуры','Декор и интерьер']],
  ['🧺','Бытовая техника',['Холодильники','Стиральные машины','Техника для кухни','Пылесосы и уборочная техника','Климатическая техника']],
  ['🏡','Для дома и дачи',['Посуда и кухонные принадлежности','Текстиль','Освещение','Хозяйственные товары']],
  ['🧱','Стройматериалы',['Отделочные материалы','Пиломатериалы','Окна и двери','Сантехника','Электрика','Крепёж и строительные смеси']],
  ['🧰','Инструменты',['Электроинструменты','Ручные инструменты','Измерительные инструменты','Станки и мастерская']],
  ['🌿','Сад',['Растения и семена','Садовая техника','Садовый инвентарь','Теплицы и парники','Товары для благоустройства']],
  ['💻','Компьютеры',['Ноутбуки','Настольные компьютеры','Комплектующие','Мониторы','Периферия','Оргтехника и расходные материалы']],
  ['⚽','Спорт',['Велосипеды','Тренажёры и фитнес','Спортивная экипировка','Зимний спорт','Туризм и походы','Водный спорт']],
  ['🎸','Хобби и отдых',['Книги и журналы','Музыкальные инструменты','Коллекционирование','Рукоделие и творчество','Настольные игры','Рыболовные принадлежности']],
  ['🐾','Животные',['Собаки','Кошки','Птицы','Рыбы и аквариумы','Другие питомцы','Корма и товары для животных']],
  ['🏭','Бизнес и оборудование',['Готовый бизнес','Торговое оборудование','Оборудование для общепита','Производственное оборудование','Оборудование для салонов','Офисное оборудование']],
  ['🧳','Путешествия',['Жильё посуточно','Отели и гостевые дома','Экскурсии','Туры и поездки']],
  ['🥕','Продукты питания',['Фермерские продукты','Овощи и фрукты','Кондитерские изделия','Бакалея','Напитки']],
  ['📦','Другое',[]]
];
const cats = categoryTree.map(([icon,name]) => [icon,name]);
function categoryGroup(value){return categoryTree.find(([,name,children]) => name===value||children.includes(value))}
function categoryMatches(value,filter){return !filter||value===filter||!!categoryTree.find(([,name,children])=>name===filter&&children.includes(value))}
function isKnownCategory(value){return !!categoryGroup(value)}
function categoryIcon(value){return categoryGroup(value)?.[0]||'✨'}
function categoryEscape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function categoryOption(value,label,selected){return `<option value="${categoryEscape(value)}"${value===selected?' selected':''}>${categoryEscape(label)}</option>`}
function categoryOptions(selected='',all=false){
  const parent=categoryGroup(selected)?.[1]||'';
  return categoryOption('',all?'Все категории':'Выберите категорию',parent)+categoryTree.map(([icon,name])=>categoryOption(name,icon+' '+name,parent)).join('');
}
function subcategoryOptions(parent,selected='',all=false){
  const group=categoryTree.find(([,name])=>name===parent);
  if(!group)return '';
  return categoryOption(parent,all?'Весь раздел':'Без уточнения',selected)+group[2].map(child=>categoryOption(child,child,selected)).join('');
}
function categoryPicker(selected='',all=false,onchange=''){
  const group=categoryGroup(selected),parent=group?.[1]||'';
  const show=!!group?.[2].length;
  return `<div class="category-picker" style="width:100%" data-all="${all}" data-onchange="${categoryEscape(onchange)}">
    <input type="hidden" class="category-value" name="category" value="${categoryEscape(selected)}">
    <select class="field" name="categoryParent" aria-label="Основная категория" ${all?'':'required'} onchange="changeCategoryPicker(this,true)">${categoryOptions(selected,all)}</select>
    <label class="category-child" ${show?'':'hidden'} style="margin-top:12px"><span class="fieldlabel">Подкатегория</span>
      <select class="field" name="categoryChild" aria-label="Подкатегория" ${show?'':'disabled'} onchange="changeCategoryPicker(this,false)">${subcategoryOptions(parent,selected,all)}</select>
    </label>
  </div>`;
}
function changeCategoryPicker(select,parentChanged){
  const picker=select.closest('.category-picker'),all=picker.dataset.all==='true';
  const parent=picker.querySelector('[name="categoryParent"]').value;
  const child=picker.querySelector('[name="categoryChild"]');
  if(parentChanged){
    const group=categoryTree.find(([,name])=>name===parent),show=!!group?.[2].length;
    child.innerHTML=subcategoryOptions(parent,parent,all);
    child.disabled=!show;
    picker.querySelector('.category-child').hidden=!show;
  }
  const value=parentChanged?parent:child.value;
  picker.querySelector('.category-value').value=value;
  const callback=picker.dataset.onchange;
  if(callback==='setHomeCategoryV232')setHomeCategoryV232(value);
  if(callback==='chooseCatalogCategoryV2321')chooseCatalogCategoryV2321(value);
}
