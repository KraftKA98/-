// Bound DOM work while preserving complete filtering and all readable records.
const catalogWindowsV62=new Map();
function catalogMarkupV62(rows,kind,card){const signature=JSON.stringify([accountStampV29(),kind,filterStateV54('catalog')]);let state=catalogWindowsV62.get(kind);if(!state||state.signature!==signature){state={signature,limit:40};catalogWindowsV62.set(kind,state)}return rows.slice(0,state.limit).map(card).join('')+(rows.length>state.limit?`<div class="empty"><p>Показано ${Math.min(state.limit,rows.length)} из ${rows.length}</p><button class="btn ghost" type="button" onclick="moreCatalogV62('${kind}')">Показать ещё</button></div>`:'')}
function moreCatalogV62(kind){if(kind!==catalogKindV60)return;const state=catalogWindowsV62.get(kind);if(state)state.limit+=40;renderCatalog()}
