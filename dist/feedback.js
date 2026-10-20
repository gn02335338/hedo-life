const DRAFT_KEY='hedo-feedback-draft-v1';
export const FEEDBACK_CATEGORIES={
 memory:{label:'補一頁史冊',tag:'✎ / MEMORY',description:'一句台詞、一段職場橋段，或老同事才懂的笑點。',prefix:'[史冊靈感]'},
 suggestion:{label:'讓人生更好玩',tag:'✦ / IDEA',description:'新機制、角色、結局，或你想做出的離譜選擇。',prefix:'[遊戲建議]'},
 bug:{label:'這次真的不是命',tag:'⌁ / BUG',description:'卡關、按鈕失效、畫面異常。把問題交給我們。',prefix:'[問題回報]'}
};
export const FEEDBACK_NATURES=['個人回憶的摘要','聽說的故事（未查證）','純原創虛構橋段','公開新聞或產品資料'];
const FIELDS=['title','content','nature','choices','source','steps','expected','device'];
const LIMITS={title:80,content:6000,choices:2000,source:1000,steps:2000,expected:2000,device:200};
const TERMINAL_STATUSES=['failed','conflict','paused'];
const escapeHTML=(value='')=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const blankDraft=()=>Object.fromEntries(FIELDS.map(field=>[field,'']));
const meaningfulLength=value=>String(value||'').replace(/\s/gu,'').length;
export function safeIssueUrl(value){
 try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='github.com'&&!url.username&&!url.password&&!url.port&&/^\/gn02335338\/hedo-life\/issues\/\d+$/.test(url.pathname)&&!url.search&&!url.hash?url.href:null;}catch{return null;}
}
export function feedbackPayload(category,draft,submissionId){
 if(!Object.hasOwn(FEEDBACK_CATEGORIES,category))throw new Error('請先選擇投稿類型。');
 const clean=Object.fromEntries(FIELDS.map(key=>[key,String(draft[key]||'').trim()]));
 if(meaningfulLength(clean.title)<3)throw new Error('標題請至少寫 3 個字。');
 if(meaningfulLength(clean.content)<20)throw new Error('內容請至少寫 20 個字，讓我們看得懂情境與你的想法。');
 for(const [field,limit] of Object.entries(LIMITS))if(clean[field].length>limit)throw new Error('有欄位超過字數上限，請縮短後再送出。');
 if(category==='bug'&&(!clean.steps||!clean.expected))throw new Error('請填寫重現步驟，以及預期與實際結果。');
 if(category==='memory'&&!FEEDBACK_NATURES.includes(clean.nature))throw new Error('請選擇素材性質。');
 return {submissionId,category,title:clean.title,content:clean.content,...(category==='memory'?{nature:clean.nature,choices:clean.choices,source:clean.source}:{}),...(category==='bug'?{steps:clean.steps,expected:clean.expected,device:clean.device}:{}),website:'',acknowledged:true};
}
export function feedbackPreview(category,draft){
 const fields=category==='memory'?[['故事或經典橋段','content'],['素材性質','nature'],['你想讓玩家怎麼選？','choices'],['可公開的參考來源','source']]:category==='bug'?[['發生了什麼？','content'],['重現步驟','steps'],['預期與實際結果','expected'],['裝置與瀏覽器','device']]:[['你的點子／希望改變什麼','content']];
 return [`${FEEDBACK_CATEGORIES[category]?.prefix||''} ${String(draft.title||'').trim()||'（尚未填標題）'}`,...fields.filter(([,key])=>String(draft[key]||'').trim()).map(([label,key])=>`${label}\n${String(draft[key]).trim()}`)].join('\n\n');
}

// Drafts stay in this tab. Only an explicit form submission sends their text.
export function createFeedbackUI({dialog,openDialog,cloud,repo}){
 let category='memory',drafts=Object.fromEntries(Object.keys(FEEDBACK_CATEGORIES).map(key=>[key,blankDraft()])),submission=null,acknowledged=false,config=null,configError='',loading=false,busy=false,busyMode='',message='',pollTimer=null,pollsRemaining=12;
 let draftStorage=true;
 try{
  const saved=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null');
  if(saved?.version===1){
   if(Object.hasOwn(FEEDBACK_CATEGORIES,saved.category))category=saved.category;
   for(const key of Object.keys(drafts))for(const field of FIELDS)if(typeof saved.drafts?.[key]?.[field]==='string')drafts[key][field]=saved.drafts[key][field].slice(0,LIMITS[field]||100);
   if(saved.submission&&typeof saved.submission.id==='string'&&Object.hasOwn(FEEDBACK_CATEGORIES,saved.submission.payload?.category)&&saved.submission.payload?.submissionId===saved.submission.id){submission=saved.submission;category=submission.payload.category;}
  }
 }catch{draftStorage=false;}
 const visible=()=>dialog.open&&Boolean(dialog.querySelector('[data-feedback-root]'));
 const stopPolling=()=>{clearTimeout(pollTimer);pollTimer=null;};
 function persist(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify({version:1,category,drafts,submission}));draftStorage=true;}catch{draftStorage=false;}}
 function textField(name,label,{required=false,placeholder='',rows=4,input=false}={}){
  const id=`feedback-${name}`,attributes=`id="${id}" name="${name}" maxlength="${LIMITS[name]}" ${required?'required':''} ${submission?'disabled':''} autocomplete="off"`,value=drafts[category][name];
  return `<label class="feedback-field" for="${id}"><span>${label}${required?' <b aria-label="必填">必填</b>':' <small>選填</small>'}</span>${input?`<input ${attributes} value="${escapeHTML(value)}" placeholder="${escapeHTML(placeholder)}">`:`<textarea ${attributes} rows="${rows}" placeholder="${escapeHTML(placeholder)}">${escapeHTML(value)}</textarea>`}</label>`;
 }
 function statusHTML(){
  if(!submission)return '';
  const issueUrl=safeIssueUrl(submission.issueUrl);
  if(submission.status==='published'&&issueUrl)return `<section class="feedback-receipt" role="status"><span class="eyebrow">A NEW PAGE, THANK YOU.</span><h3>這一頁，已經公開。</h3><p>不必登入 GitHub，投稿已建立為公開 Issue。投稿會先整理，再決定是否改編。</p><a class="primary" href="${issueUrl}" target="_blank" rel="noopener noreferrer">查看公開的 Issue <span>↗</span></a><button class="text-button" type="button" data-feedback-action="new">再補一頁 →</button></section>`;
  if(TERMINAL_STATUSES.includes(submission.status)){
   const heading=submission.status==='failed'?'這次投稿已停止處理。':submission.status==='conflict'?'投稿編號與內容不一致。':'投稿箱暫時關閉。';
   return `<section class="feedback-pending" role="status"><h3>${heading}</h3><p>${submission.status==='failed'?'私人佇列的原文已到期清除，目前無法從這裡確認公開結果。':'目前無法確認這份內容是否已公開。'}請先到 GitHub 查看，避免重複投稿；這個分頁的草稿仍保留完整文字。</p>${submission.error?`<p class="feedback-error">${escapeHTML(submission.error)}</p>`:''}<div class="feedback-status-actions"><a class="secondary" href="${repo}/issues?q=${encodeURIComponent(submission.id)}" target="_blank" rel="noopener noreferrer">到 GitHub 查投稿 ↗</a><button class="text-button" type="button" data-feedback-action="copy">複製草稿 ↓</button><button class="text-button" type="button" data-feedback-action="edit">回到草稿重新編輯 →</button></div><p>重新送出會使用新的投稿編號，需要再次勾選公開確認；不會自動重送。</p>${submission.notice?`<p>${escapeHTML(submission.notice)}</p>`:''}</section>`;
  }
  const queued=['queued','processing'].includes(submission.status);
  return `<section class="feedback-pending" role="status"><h3>${busy?(busyMode==='status'?'正在查詢投稿結果…':'正在送出這一頁…'):queued?'收到，正在排隊建立公開 Issue。':'還沒確認是否建立成功。'}</h3><p>${queued?'需要等候背景工作處理，不用重填。可以先繼續遊戲，稍後回到這裡查詢結果。':'草稿與這次投稿編號都還在。重新查詢或重試會使用同一份內容，避免重複開 Issue。'}</p>${submission.error?`<p class="feedback-error">${escapeHTML(submission.error)}</p>`:''}<div class="feedback-status-actions"><button class="secondary" type="button" data-feedback-action="status" ${busy?'disabled':''}>查詢投稿結果 ↻</button>${!queued?`<button class="text-button" type="button" data-feedback-action="retry" ${busy?'disabled':''}>重試送出同一頁 →</button>`:''}</div></section>`;
 }
 function render({focus=false,receiptFocus=false}={}){
  if(!visible()&&!focus)return;
  const oldScroll=dialog.scrollTop,wasVisible=visible(),active=document.activeElement,activeId=active?.id,activeAction=active?.dataset?.feedbackAction;
  const published=submission?.status==='published'&&safeIssueUrl(submission.issueUrl),selected=FEEDBACK_CATEGORIES[category];
  openDialog(`<section data-feedback-root><h2 id="dialog-title">史冊補完計畫。</h2><p class="dialog-lead">不用 GitHub 帳號，在這裡補一頁就好。送出後，系統會替你建立公開 Issue，大家都能閱讀。</p><div class="feedback-categories" role="group" aria-label="投稿類型">${Object.entries(FEEDBACK_CATEGORIES).map(([key,item])=>`<button type="button" class="feedback-card ${key===category?'selected':''}" data-feedback-category="${key}" aria-pressed="${key===category}" ${submission?'disabled':''}><span>${item.tag}</span><h3>${item.label}</h3><p>${item.description}</p></button>`).join('')}</div><aside class="feedback-public-note"><b>這是一張公開的紙。</b><p>請用化名與自己的摘要，不要放姓名、聯絡方式、私人 Notion、完整聊天紀錄或未遮蔽的內部文件。內容會公開在 <a href="${repo}/issues" target="_blank" rel="noopener noreferrer">GitHub Issues ↗</a>，搜尋引擎也可能收錄。</p></aside>${statusHTML()}${published?'':`<form id="feedback-form" novalidate aria-label="${selected.label}"><label class="feedback-honeypot" aria-hidden="true">請保留空白<input name="website" type="text" tabindex="-1" autocomplete="off"></label><fieldset ${submission?'disabled':''}><legend class="sr-only">${selected.label}投稿內容</legend>${textField('title','這一頁叫什麼？',{required:true,input:true,placeholder:'至少 3 個字，讓我們知道你想補什麼'})}${textField('content',category==='memory'?'故事或經典橋段':category==='bug'?'發生了什麼？':'你的點子／希望改變什麼',{required:true,rows:6,placeholder:category==='memory'?'說說當時的情境、反差與笑點。請至少寫 20 個字。':category==='bug'?'卡在哪裡？畫面或操作出現什麼問題？請至少寫 20 個字。':'現在玩起來的感受，以及你希望看到的改變。請至少寫 20 個字。'})}${category==='memory'?`<label class="feedback-field" for="feedback-nature"><span>素材性質 <b aria-label="必填">必填</b></span><select id="feedback-nature" name="nature" required ${submission?'disabled':''}><option value="">請選擇</option>${FEEDBACK_NATURES.map(nature=>`<option ${drafts[category].nature===nature?'selected':''}>${nature}</option>`).join('')}</select></label>${textField('choices','你想讓玩家怎麼選？',{rows:3,placeholder:'幾個動作、不同反應，或一個腦洞大開的選項。'})}${textField('source','可公開的參考來源',{rows:2,placeholder:'只放原本就能公開的連結；沒有也沒關係。'})}`:''}${category==='bug'?`${textField('steps','重現步驟',{required:true,rows:3,placeholder:'例如：選了哪個職業、進到哪個畫面、按了哪個按鈕。'})}${textField('expected','預期與實際結果',{required:true,rows:3})}${textField('device','裝置與瀏覽器',{input:true,placeholder:'例如：iPhone / Safari、Windows / Chrome'})}`:''}</fieldset><details class="feedback-preview"><summary>送出前，看一下公開預覽</summary><p>以下內容會以文字公開；系統另附投稿編號，不會附上匿名玩家 ID 或遊戲紀錄。</p><pre id="feedback-preview-text"></pre></details>${!submission?`<label class="feedback-consent"><input id="feedback-acknowledged" type="checkbox" required ${acknowledged?'checked':''}><span>我已移除個資與私人原始文件，知道這份投稿會公開在 GitHub，並可作為遊戲創作素材。</span></label><p id="feedback-message" class="feedback-error" role="alert">${escapeHTML(message)}</p><div class="feedback-submit-row"><button class="primary" type="submit" ${busy||loading||config?.enabled!==true?'disabled':''}>公開送出到 GitHub <span>↗</span></button><span>${loading?'正在連接投稿箱…':config?.enabled===true?'送出前仍可修改，勾選後才會公開。':'投稿箱暫時無法連線，草稿仍可繼續寫。'}</span></div>`:''}</form>`}<p class="feedback-data-note">送出後，原文會暫存在私人投稿佇列；成功開 Issue 就刪除站內原文，未成功的最多保留 30 天。防止濫用另留短期連線雜湊，不保存原始 IP。公開的 Issue 仍會保留在 GitHub。</p><p class="feedback-draft-note">${draftStorage?'未送出的草稿只暫存在這個分頁；關閉視窗後可再打開續寫，關閉分頁後可能清除。':'此瀏覽器無法暫存草稿，請先自行保留文字，並保持目前頁面開啟。'}${submission?' 本次投稿編號會留在此分頁，供重新查詢結果。':''}</p>${configError?`<p class="feedback-error">${escapeHTML(configError)} <button type="button" class="text-button" data-feedback-action="config">重新連線 ↻</button></p>`:''}<p class="small-note">習慣使用 GitHub？也可以<a href="${repo}/issues/new/choose" target="_blank" rel="noopener noreferrer">自行開 Issue ↗</a>。投稿不代表內容已查證，也不會自動出現在遊戲裡。</p></section>`);
  const preview=dialog.querySelector('#feedback-preview-text');if(preview)preview.textContent=feedbackPreview(category,drafts[category]);
  if(wasVisible&&!focus){dialog.scrollTop=oldScroll;const replacement=activeId?dialog.querySelector(`#${activeId}`):activeAction?dialog.querySelector(`[data-feedback-action="${activeAction}"]`):null;if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});}
  if(receiptFocus){const receipt=dialog.querySelector('.feedback-pending,.feedback-receipt');if(receipt){receipt.setAttribute('tabindex','-1');receipt.scrollIntoView({block:'start',behavior:'instant'});receipt.focus({preventScroll:true});}}
 }
 function readDraft(form){for(const field of FIELDS){const input=form.elements.namedItem(field);if(input)drafts[category][field]=input.value;}persist();}
 function showMessage(value){message=value;const target=dialog.querySelector('#feedback-message');if(target)target.textContent=value;}
 async function loadConfig(){
  if(loading)return;loading=true;configError='';render();
  try{config=await cloud.feedbackConfig();if(config?.enabled!==true)configError='自動投稿暫時關閉；你可以保留草稿，稍後再試。';}
  catch{config=null;configError='投稿箱目前連不上，沒有送出任何文字。';}
  finally{loading=false;if(visible())render();}
 }
 function applyResponse(response){
  if(!submission)return;
  const issueUrl=safeIssueUrl(response?.issueUrl);
  if((response?.status==='published'||response?.status==='created')&&issueUrl){submission.status='published';submission.issueUrl=issueUrl;submission.error='';}
  else if(['queued','processing'].includes(response?.status)){submission.status=response.status;submission.error='';}
  else if(response?.status==='failed'){submission.status='failed';submission.error=response.message||'舊投稿已到期，無法再用同一個編號處理。';}
  else{submission.status='unknown';submission.error=response?.message||'服務尚未確認結果，請稍後查詢。';}
  persist();
 }
 function schedulePoll(){stopPolling();if(visible()&&pollsRemaining>0&&['queued','processing'].includes(submission?.status))pollTimer=setTimeout(()=>{pollsRemaining--;void checkStatus(true);},5000);}
 async function checkStatus(automatic=false){
  if(!submission||busy)return;const previousStatus=submission.status;busy=true;busyMode='status';if(!automatic){pollsRemaining=12;render({receiptFocus:true});}
  try{applyResponse(await cloud.feedbackStatus(submission.id));}
  catch(error){submission.error=error.status===404?'還查不到這次投稿；可用同一份內容重試送出。':'暫時查不到結果，內容已保留在這個分頁。';if(error.status===404)submission.status='unknown';persist();}
  finally{busy=false;busyMode='';const reveal=!automatic||(['queued','processing'].includes(previousStatus)&&['published','failed'].includes(submission?.status));if(visible()&&reveal)render({receiptFocus:true});schedulePoll();}
 }
 async function send(){
  if(!submission||busy||TERMINAL_STATUSES.includes(submission.status))return;stopPolling();busy=true;busyMode='submit';pollsRemaining=12;render({receiptFocus:true});
  try{applyResponse(await cloud.submitFeedback(submission.payload));}
  catch(error){
   if([400,413,422].includes(error.status)){submission=null;acknowledged=false;message='內容尚未送出。請檢查標題、內容字數與素材性質後再試。';}
   else if(error.status===409){submission.status='conflict';submission.error='原投稿編號的內容與這份草稿不符。請先查詢 GitHub 上的原投稿，再決定是否重新編輯送出。';}
   else if(error.status===503){submission.status='paused';submission.error=error.message||'自動投稿目前暫停。你可以先保留或編輯草稿，稍後再送。';config=null;}
   else{submission.status='unknown';submission.error=error.status===429?(error.message||'投稿已達上限，請稍後用同一份內容重試。'):'連線中斷，還不能確定是否建立成功。請先查詢，或重試送出同一頁。';}
   persist();
  }finally{busy=false;busyMode='';if(visible())render({receiptFocus:true});schedulePoll();}
 }
 dialog.addEventListener('input',event=>{
  const form=event.target.closest('#feedback-form');if(!form||submission)return;
  if(event.target.id==='feedback-acknowledged'){acknowledged=event.target.checked;return;}
  readDraft(form);acknowledged=false;const checkbox=form.querySelector('#feedback-acknowledged');if(checkbox)checkbox.checked=false;
  const preview=form.querySelector('#feedback-preview-text');if(preview)preview.textContent=feedbackPreview(category,drafts[category]);if(message)showMessage('');
 });
 dialog.addEventListener('change',event=>{if(event.target.id==='feedback-nature'&&!submission){const form=event.target.closest('form');readDraft(form);acknowledged=false;form.querySelector('#feedback-acknowledged').checked=false;form.querySelector('#feedback-preview-text').textContent=feedbackPreview(category,drafts[category]);}});
 dialog.addEventListener('submit',event=>{
  if(event.target.id!=='feedback-form')return;event.preventDefault();if(busy||submission||config?.enabled!==true)return;
  readDraft(event.target);
  try{
   const payload=feedbackPayload(category,drafts[category],crypto.randomUUID());
   payload.website=event.target.elements.namedItem('website')?.value||'';
   if(!event.target.querySelector('#feedback-acknowledged').checked){showMessage('公開前，請先勾選確認：你知道這份投稿會公開在 GitHub。');event.target.querySelector('#feedback-acknowledged').focus();return;}
   submission={id:payload.submissionId,payload,status:'unknown',issueUrl:null,error:''};message='';persist();void send();
  }catch(error){showMessage(error.message);}
 });
 dialog.addEventListener('click',event=>{
  const categoryButton=event.target.closest('[data-feedback-category]');
  if(categoryButton&&!submission){category=categoryButton.dataset.feedbackCategory;acknowledged=false;message='';persist();render();dialog.querySelector(`[data-feedback-category="${category}"]`)?.focus({preventScroll:true});return;}
  const action=event.target.closest('[data-feedback-action]')?.dataset.feedbackAction;
  if(action==='status')void checkStatus();
  if(action==='retry'&&!busy)void send();
  if(action==='config')void loadConfig();
  if(action==='copy'&&submission){const current=submission;void (async()=>{try{await navigator.clipboard.writeText(feedbackPreview(category,drafts[category]));if(submission===current)current.notice='草稿已複製，可以貼到自己的筆記保存。';}catch{if(submission===current)current.notice='目前無法自動複製，請展開下方公開預覽，選取文字後複製。';}persist();if(submission===current&&visible())render();})();}
  if(action==='edit'&&submission&&TERMINAL_STATUSES.includes(submission.status)&&!busy){stopPolling();submission=null;acknowledged=false;message='草稿已保留。請先確認 GitHub 上沒有重複投稿；修改後，再勾選公開確認送出。';persist();render();dialog.querySelector('#feedback-title')?.focus({preventScroll:true});if(!config)void loadConfig();}
  if(action==='new'&&submission?.status==='published'){drafts[category]=blankDraft();submission=null;acknowledged=false;message='';persist();render();dialog.querySelector('#feedback-title')?.focus({preventScroll:true});}
 });
 dialog.addEventListener('close',stopPolling);
 return {open(){stopPolling();render({focus:true,receiptFocus:Boolean(submission)});if(!config)void loadConfig();if(submission&&submission.status!=='published'&&!TERMINAL_STATUSES.includes(submission.status))void checkStatus();}};
}
