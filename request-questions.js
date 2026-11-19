let questionsViewer='guest',questionReportView={owner:null,sequence:0,status:'new',offset:0,total:0};
function requestQuestionsMarkup(id){return `<section class="request-questions" data-request-questions="${id}"><h2>Вопросы и ответы</h2><div class="loader">Загружаем вопросы…</div></section>`}
function syncQuestionIdentity(){
 const viewer=user?.id||'guest';if(viewer===questionsViewer)return;questionsViewer=viewer;
 for(const host of document.querySelectorAll('[data-request-questions]')){host.innerHTML='<h2>Вопросы и ответы</h2><div class="loader">Обновляем доступ…</div>';loadRequestQuestions(host.dataset.requestQuestions)}
 const queue=$('questionReportsList');if(queue)queue.textContent='Аккаунт изменился. Откройте очередь заново.';
 questionReportView={owner:user?.id||null,sequence:questionReportView.sequence+1,status:'new',offset:0,total:0};
}
function questionCardMarkup(q,id){return `<article class="qa-card ${q.is_hidden?'qa-hidden':''}" id="question-${q.id}" data-question="${q.id}"><p class="small muted">${q.is_own?'Ваш вопрос':'Вопрос продавца'} · ${esc(new Date(q.created_at).toLocaleString('ru-RU'))}${q.is_hidden?' · Скрыт из публичного списка':''}</p><p class="qa-text">${esc(q.body)}</p>${q.answer?`<div class="qa-answer"><b>Ответ покупателя</b><p class="qa-text">${esc(q.answer)}</p><span class="small muted">${esc(new Date(q.answered_at).toLocaleString('ru-RU'))}</span></div>`:'<p class="small muted">Ответ пока не опубликован.</p>'}<div class="row qa-actions">${q.can_answer?`<button class="btn ghost" onclick="toggleQuestionReply('${q.id}')">Ответить</button>`:''}${q.can_hide?`<button class="btn gray" onclick="hideRequestQuestion('${q.id}','${id}',this)">Скрыть вопрос для всех</button>`:''}${q.can_report?`<button class="mini-link" onclick="openQuestionReport('${q.id}','${id}')">Пожаловаться</button>`:''}</div>${q.can_answer?`<form data-question-reply="${q.id}" hidden onsubmit="submitQuestionAnswer(event,'${q.id}','${id}')"><label class="fieldlabel">Публичный ответ</label><textarea class="field" name="answer_${q.id}" minlength="2" maxlength="1500" required></textarea><p class="small muted">Ответ увидят все. После публикации изменить его нельзя.</p><p class="small qa-error" role="alert"></p><button class="btn" type="submit">Опубликовать ответ</button></form>`:''}</article>`}
function questionSectionBody(data,id){return `<div class="row between"><h2>Вопросы и ответы</h2><button class="btn ghost" onclick="loadRequestQuestions('${id}')">↻ Обновить</button></div><p class="small muted">Вопросы видят все. Контакты и условия сделки — в личном чате.</p>${data.read_only?'<p class="small muted">Желание закрыто или неактуально: новые вопросы и ответы не принимаются.</p>':''}<div data-question-items>${data.items.length?data.items.map(q=>questionCardMarkup(q,id)).join(''):'<p class="empty">Вопросов пока нет.</p>'}</div>${data.can_ask?`<form data-question-ask onsubmit="submitRequestQuestion(event,'${id}')"><label class="fieldlabel">Что нужно уточнить?</label><textarea class="field" name="question_body" minlength="5" maxlength="500" required placeholder="Например, подойдёт доставка из другого города?"></textarea><p class="small muted">До 3 вопросов к желанию и 20 за сутки. Не публикуйте личные данные.</p><p class="small qa-error" role="alert"></p><button class="btn block" type="submit">Задать вопрос</button></form>`:!user&&!data.read_only?'<button class="btn ghost block" onclick="openAuth()">Войти и задать вопрос</button>':data.is_owner&&!data.read_only?'<p class="small muted">Ответьте продавцам здесь — ответ увидят все.</p>':''}`}
async function loadRequestQuestions(id,focusId=null,provided=null){
 const host=[...document.querySelectorAll('[data-request-questions]')].find(h=>h.dataset.requestQuestions===id);if(!host)return;
 const viewer=user?.id||'guest',sequence=(host.qaSequence||0)+1;host.qaSequence=sequence;
 try{
  const result=provided?{data:provided,error:null}:await db.rpc('hochu_questions_v249',{p_request_id:id});if(result.error)throw result.error;
  if(!host.isConnected||host.qaSequence!==sequence||(user?.id||'guest')!==viewer)return;
  if(!result.data||!Array.isArray(result.data.items))throw Error('Не удалось получить вопросы');
 const drafts=new Map([...host.querySelectorAll('textarea[name]')].map(field=>[field.name,field.value])),opened=new Set([...host.querySelectorAll('[data-question-reply]')].filter(f=>!f.hidden).map(f=>f.dataset.questionReply));
  host.qaData=result.data;host.innerHTML=questionSectionBody(result.data,id);
  for(const field of host.querySelectorAll('textarea[name]'))if(drafts.has(field.name))field.value=drafts.get(field.name);
  for(const form of host.querySelectorAll('[data-question-reply]'))if(opened.has(form.dataset.questionReply))form.hidden=false;
  if(focusId){const question=host.querySelector('[data-question="'+focusId+'"]');if(question){question.setAttribute('tabindex','-1');question.focus({preventScroll:true});question.scrollIntoView({block:'nearest'})}}
 }catch(error){if(host.isConnected&&host.qaSequence===sequence&&(user?.id||'guest')===viewer)host.innerHTML=`<h2>Вопросы и ответы</h2><p class="small muted">${esc(error.message||'Вопросы временно недоступны')}</p><button class="btn ghost" onclick="loadRequestQuestions('${id}')">Повторить</button>`}
}
function toggleQuestionReply(id){const form=[...document.querySelectorAll('[data-question-reply]')].find(f=>f.dataset.questionReply===id);if(form){form.hidden=!form.hidden;if(!form.hidden)form.querySelector('textarea').focus()}}
async function submitRequestQuestion(event,id){return submitQuestionText(event,'hochu_question_ask_v249',{p_request_id:id},'question_body',id)}
async function submitQuestionAnswer(event,qid,id){return submitQuestionText(event,'hochu_question_answer_v249',{p_question_id:qid},'answer_'+qid,id)}
async function submitQuestionText(event,rpc,params,field,id){
 event.preventDefault();const form=event.currentTarget;if(form.dataset.busy||!requireAuth())return;const actor=user.id,button=form.querySelector('[type=submit]'),alert=form.querySelector('[role=alert]');
 form.dataset.busy='true';button.disabled=true;alert.textContent='';
 try{
  const body=String(new FormData(form).get(field)||'').trim();const args={...params,[rpc==='hochu_question_ask_v249'?'p_body':'p_answer']:body};
  const {data,error}=await db.rpc(rpc,args);if(error)throw error;if(user?.id!==actor)return;
  if(form.isConnected){form.reset();await loadRequestQuestions(id,params.p_question_id||data)}toast(rpc==='hochu_question_ask_v249'?'Вопрос опубликован':'Ответ опубликован');
 }catch(error){if(form.isConnected&&user?.id===actor)alert.textContent=error.message||'Не удалось опубликовать'}finally{delete form.dataset.busy;if(form.isConnected)button.disabled=false}
}
async function hideRequestQuestion(qid,id,button){
 if(!requireAuth()||button.disabled)return;const actor=user.id;button.disabled=true;
 try{const {error}=await db.rpc('hochu_question_hide_v249',{p_question_id:qid});if(error)throw error;if(user?.id===actor&&button.isConnected)await loadRequestQuestions(id);if(user?.id===actor)toast('Вопрос скрыт из публичного списка')}catch(error){if(user?.id===actor)toast(error.message)}finally{if(button.isConnected)button.disabled=false}
}
function openQuestionReport(qid,id){
 if(!requireAuth())return;const actor=user.id;
 modal({title:'Жалоба на вопрос',body:`<form id="questionReportForm"><label class="fieldlabel">Причина</label><select class="field" name="reason">${['Спам','Оскорбления','Личные данные','Другое'].map(reason=>`<option>${reason}</option>`).join('')}</select><label class="fieldlabel">Пояснение для модератора</label><textarea class="field" name="details" maxlength="500"></textarea><p class="small muted">Жалоба видна только модераторам. Один вопрос можно пожаловаться один раз.</p><p class="small qa-error" role="alert"></p><button class="btn block" type="submit">Отправить жалобу</button></form>`});
 const form=$('questionReportForm');if(form)form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.dataset.busy||user?.id!==actor)return;const button=form.querySelector('[type=submit]');form.dataset.busy='true';button.disabled=true;
  try{const values=new FormData(form),{error}=await db.rpc('hochu_question_report_v249',{p_question_id:qid,p_reason:values.get('reason'),p_details:String(values.get('details')||'').trim()});if(error)throw error;if(user?.id===actor&&form.isConnected){closeModal();showRequest(id);toast('Жалоба отправлена модератору')}}catch(error){if(form.isConnected&&user?.id===actor)form.querySelector('[role=alert]').textContent=error.message}finally{delete form.dataset.busy;if(form.isConnected)button.disabled=false}
 });
}
function openQuestionReports(){
 if(!requireAuth()||!isAdmin)return toast('Доступ только модератору');questionReportView={owner:user.id,sequence:questionReportView.sequence+1,status:'new',offset:0,total:0};
 modal({title:'Жалобы на вопросы',body:'<label class="fieldlabel">Состояние жалобы<select class="field" id="questionReportStatus" onchange="loadQuestionReports(this.value,0)"><option value="new">Новые</option><option value="hidden">Вопрос скрыт</option><option value="dismissed">Отклонённые</option></select></label><div id="questionReportsList" class="loader">Загрузка…</div><div id="questionReportsPager" class="row between"></div>'});loadQuestionReports('new',0);
}
async function loadQuestionReports(status,offset){
 if(!user||!isAdmin)return;const actor=user.id,host=$('questionReportsList');if(!host)return;const sequence=++questionReportView.sequence;Object.assign(questionReportView,{status,offset});
 try{const {data,error}=await db.rpc('hochu_question_reports_v249',{p_status:status,p_offset:offset});if(error)throw error;if(!host.isConnected||user?.id!==actor||questionReportView.sequence!==sequence)return;
  if(!data||!Array.isArray(data.items))throw Error('Не удалось получить жалобы');questionReportView.total=Number(data.total)||0;
  host.className='';host.innerHTML=data.items.length?data.items.map(r=>`<article class="card"><b>${esc(r.title)}</b><p class="small muted">${esc(r.reason)} · ${esc(new Date(r.created_at).toLocaleString('ru-RU'))}${r.is_hidden?' · вопрос уже скрыт':''}</p><p class="qa-text">${esc(r.body)}</p>${r.answer?`<div class="qa-answer">Ответ: ${esc(r.answer)}</div>`:''}<p class="qa-text">Пояснение: ${esc(r.details||'Не указано')}</p>${r.status==='new'?`<div class="row qa-actions"><button class="btn" onclick="reviewQuestionReport('${r.id}','hide',this)">Скрыть вопрос</button><button class="btn ghost" onclick="reviewQuestionReport('${r.id}','dismiss',this)">Отклонить жалобу</button></div>`:'<p class="small muted">Жалоба рассмотрена</p>'}<button class="btn ghost" onclick="adminViewRequest('${r.request_id}')">Открыть желание</button></article>`).join(''):'<div class="empty">Жалоб в этом разделе нет</div>';
  $('questionReportsPager').innerHTML=`<button class="btn ghost" ${offset===0?'disabled':''} onclick="loadQuestionReports('${status}',${Math.max(0,offset-30)})">← Назад</button><span class="small">Всего: ${questionReportView.total}</span><button class="btn ghost" ${offset+30>=questionReportView.total?'disabled':''} onclick="loadQuestionReports('${status}',${offset+30})">Дальше →</button>`;
 }catch(error){if(host.isConnected&&user?.id===actor)host.textContent=error.message||'Не удалось загрузить жалобы'}
}
async function reviewQuestionReport(id,action,button){
 if(!user||!isAdmin||button.disabled)return;const actor=user.id;button.disabled=true;
 try{const {error}=await db.rpc('hochu_question_review_v249',{p_report_id:id,p_action:action});if(error)throw error;if(user?.id===actor&&button.isConnected)await loadQuestionReports(questionReportView.status,questionReportView.offset)}catch(error){if(user?.id===actor)toast(error.message)}finally{if(button.isConnected)button.disabled=false}
}
async function openQuestionNotification(id){
 if(!requireAuth()||!startAction('qa-notice:'+id))return;const actor=user.id;
 try{
  const {data:n,error}=await db.from('notifications').select('id,recipient_id,request_id,question_id,qa_event').eq('id',id).maybeSingle();if(error)throw error;if(user?.id!==actor)return;
  if(!n||n.recipient_id!==actor||!['question_asked','question_answered'].includes(n.qa_event))throw Error('Уведомление недоступно');
  if(!n.request_id||!n.question_id){await markAuctionNoticeRead(id,actor);return toast('Вопрос уже недоступен')}
  const [requestResult,qaResult]=await Promise.all([db.from('requests').select('id,buyer_id,title,description,category,city,budget,status,created_at,is_hidden,image_paths,revision,valid_for_days,expires_at,last_confirmed_at,expired_at').eq('id',n.request_id).maybeSingle(),db.rpc('hochu_questions_v249',{p_request_id:n.request_id})]);
  if(requestResult.error)throw requestResult.error;if(qaResult.error)throw qaResult.error;if(user?.id!==actor)return;
  if(!await markAuctionNoticeRead(id,actor))return;if(!requestResult.data)return toast('Желание недоступно');
  upsertAuctionNoticeRequest(requestResult.data);closeModal();showRequest(n.request_id);await loadRequestQuestions(n.request_id,n.question_id,qaResult.data);
 }catch(error){if(user?.id===actor)toast(error.message||'Не удалось открыть вопрос')}
 finally{endAction('qa-notice:'+id)}
}
setInterval(()=>{if(!db||document.visibilityState!=='visible')return;for(const host of document.querySelectorAll('[data-request-questions]'))if(!host.querySelector('textarea:focus')&&![...host.querySelectorAll('textarea')].some(f=>f.value.trim())&&!host.querySelector('[data-busy]'))loadRequestQuestions(host.dataset.requestQuestions)},30000);
