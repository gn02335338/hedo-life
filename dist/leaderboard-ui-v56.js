import {ROLES, ROLE_MAP} from './roles.js';
import {displayOccupationTextV47} from './occupation-copy-v47.js';
import {deriveLeaderboardScoreV56, LEADERBOARD_METRICS_V56, SCORE_VERSION_V56, leaderboardEligibilityV56} from './leaderboard-score-v56.js';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text=value=>escapeHTML(displayOccupationTextV47(value));
const number=value=>Number.isFinite(value)?value.toLocaleString('zh-TW'):'—';
const bounded=(value,max=100)=>Math.min(max,Math.max(0,Number(value)||0));
const dateLabel=value=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString('zh-TW',{hour12:false}):'';
const roleLabel=id=>ROLE_MAP[id]?displayOccupationTextV47(ROLE_MAP[id].name):'職場旅人';
const metricList=()=>[{id:'overall',label:'綜合生存分數',unit:'分',max:10000},...LEADERBOARD_METRICS_V56.filter(metric=>metric.id!=='overall')];
const getMetric=id=>metricList().find(metric=>metric.id===id)||metricList()[0];
export const LEADERBOARD_CONSENT_V56='公開暱稱、職業、分數與完成工作回合，不公開結局與劇情';

export function normalizeLeaderboardNicknameV56(value){
 const name=String(value??'').normalize('NFKC').trim().replace(/\s+/gu,' ');
 if([...name].length<2||[...name].length>16||/[\p{Cc}\p{Cf}<>]/u.test(name)||/https?:|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/iu.test(name))throw new Error('暱稱請填 2–16 個字，不放連結、Email、控制字元或角括號。');
 return name;
}

function supportedBoard(response,metric,role){
 const max=getMetric(metric).max;
 return response?.version===1&&response.scoreVersion===SCORE_VERSION_V56&&response.metric===metric&&response.role===role&&
  Number.isSafeInteger(response.totalPlayers)&&response.totalPlayers>=0&&Array.isArray(response.entries)&&response.entries.length<=50&&
  response.entries.every(entry=>Number.isSafeInteger(entry?.rank)&&entry.rank>=1&&entry.rank<=50&&typeof entry.nickname==='string'&&
   Number.isFinite(entry.value)&&entry.value>=0&&entry.value<=max&&Number.isFinite(entry.total)&&entry.total>=0&&entry.total<=10000&&
   ROLE_MAP[entry.actualRoleId]&&Number.isSafeInteger(entry.turns)&&entry.turns>=0&&entry.turns<=23&&
   (role==='all'||entry.actualRoleId===role));
}

function scoreRulesHTML(open=false){return `<details class="lb-rules" ${open?'open':''}><summary>分數怎麼算？名次怎麼排？ <span aria-hidden="true">＋</span></summary><div class="lb-rules-content"><p>綜合分數滿分 10,000。能力 30%、身心狀態 15%、存款 10%、人際關係 10%、完成工作回合 20%、結局挑戰 15%。三種能力按合計值換算，合計 180 即達這組上限，保留專精與取捨。</p><p>完成工作只計真正推進的回合；翻選單、休息與活動內操作不會灌水。結局挑戰採固定分級，與當下全站人氣無關；尚未遇見的結局仍然保密。</p><p>各單項榜依該項數值排序，不把惡言相向或動手次數另外加進綜合分數。每個匿名玩家在每張榜只取符合篩選的最佳一局；同分同名次，下一名跳號（例如 1、1、3）。每張榜最多顯示 50 位，僅收本人主動留名且伺服器驗證通過的完整人生。</p><p>目前採第 ${number(SCORE_VERSION_V56)} 版計分。這是遊戲紀錄，不能用暱稱找回匿名身分；清除瀏覽器資料後，可能無法修改或撤下先前的留名。</p></div></details>`;}

function nicknameForm({scope='ending',index=0,draft={},listed=false,busy=false}={}){
 const field=`lb-name-${scope}-${index}`,consent=`lb-consent-${scope}-${index}`;
 return `<form class="lb-name-form" data-lb-form="${scope}" data-lb-index="${index}" novalidate><label class="lb-name-label" for="${field}">${listed?'修改這局的公開暱稱':'這段人生，要留下什麼名字？'}<input id="${field}" data-lb-name name="nickname" value="${escapeHTML(draft.nickname||'')}" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32" placeholder="2–16 個字，用化名就好" aria-describedby="${field}-hint ${field}-message" ${busy?'disabled':''}></label><p class="lb-name-hint" id="${field}-hint">不需要真名、帳號或 Email。${listed?'改名不會重算分數。':'不留名也能看完結局，收藏照常保留。'}</p><label class="lb-consent" for="${consent}"><input id="${consent}" data-lb-consent type="checkbox" ${draft.consent?'checked':''} ${busy?'disabled':''}><span>我同意${LEADERBOARD_CONSENT_V56}。</span></label><p class="lb-form-message ${draft.kind==='success'?'is-success':''}" id="${field}-message" role="status" aria-live="polite">${escapeHTML(draft.message||'')}</p><div class="lb-form-actions"><button class="primary" type="submit" ${busy?'disabled':''}>${busy?'正在驗證這段人生…':listed?'確認公開改名':'留名，加入排行榜'} <span aria-hidden="true">↗</span></button>${listed?`<button class="text-button" type="button" data-lb-command="withdraw" data-lb-scope="${scope}" data-lb-index="${index}" ${busy?'disabled':''}>撤下這局留名</button>`:scope==='ending'?`<button class="text-button" type="button" data-lb-command="skip" ${busy?'disabled':''}>這次不留名</button>`:''}</div></form>`;
}

export function endingLeaderboardHTMLV56(run,{draft={},entry=null,checking=false,mineKnown=false,rulesOpen=false}={}){
 if(!run?.completed)return '';
 const score=deriveLeaderboardScoreV56(run);if(!score)return '';
 const listed=Boolean(entry),busy=Boolean(draft.busy),eligibility=leaderboardEligibilityV56(run);
 return `<section class="lb-ending" data-leaderboard-ending aria-labelledby="lb-ending-title"><div class="lb-ending-header"><div><span class="eyebrow">ONE LIFE. YOUR NAME, IF YOU WANT.</span><h2 id="lb-ending-title">這局，值得留個名字。</h2><p>故事已經收尾。要不要上榜，由你決定。</p></div><div class="lb-total" aria-label="本局綜合分數 ${score.total} 分，滿分 10000"><strong>${number(score.total)}</strong><span>綜合分數 / 10,000</span></div></div><div class="lb-breakdown" aria-label="綜合分數組成">${score.breakdown.map(row=>`<div class="lb-score-row"><div><span>${text(row.label)}</span><b>${number(row.points)} <small>/ ${number(row.max)}</small></b></div><div class="lb-score-track" role="meter" aria-label="${text(row.label)}" aria-valuemin="0" aria-valuemax="${row.max}" aria-valuenow="${row.points}"><i style="width:${bounded(row.points/row.max*100)}%"></i></div></div>`).join('')}</div><div class="lb-score-notes"><span>完成工作 <b>${number(score.completedTurns)} 回合</b></span><span>結局挑戰 <b>${text(score.difficulty.label)}</b></span><span>計分 <b>第 ${number(score.scoreVersion)} 版</b></span></div><div class="lb-ending-optin" data-lb-ending-controls>${checking?'<p class="lb-quiet-status" role="status">正在確認這局是否已留名…</p>':''}${listed?`<p class="lb-listed-state"><span aria-hidden="true">✓</span> 這局已以「<b>${escapeHTML(entry.nickname)}</b>」留名。是否出現在前 50 名，依各榜與職業篩選而定。</p>`:''}${!mineKnown&&!checking?'<p class="lb-quiet-status">目前還不能確認留名狀態。你可以先看完故事，稍後再連線查詢。</p>':''}${!eligibility.eligible&&!listed?'<p class="lb-season-notice">本季採目前規則；開一段新人生即可參賽。這局仍可查看分數，結局與收藏照常保留。</p>':draft.skipped&&!listed?`<div class="lb-skipped"><p>${draft.kind==='success'?escapeHTML(draft.message):'這局先不公開，結局與收藏都還在。'}</p><button class="secondary" type="button" data-lb-command="unskip">我想留個名字 ↗</button></div>`:nicknameForm({draft,listed,busy})}${draft.withdrawConfirm?withdrawHTML('ending',0,busy):''}<button class="text-button lb-ending-board" type="button" data-lb-command="open">看看大家怎麼活下來 ↗</button></div>${scoreRulesHTML(rulesOpen)}</section>`;
}

function withdrawHTML(scope,index,busy){return `<div class="lb-withdraw-confirm" role="group" aria-label="確認撤下留名"><p>撤下這局的公開留名？本機結局、成就與匿名統計仍會保留。</p><div><button class="secondary" type="button" data-lb-command="withdraw-confirm" data-lb-scope="${scope}" data-lb-index="${index}" ${busy?'disabled':''}>${busy?'正在撤下…':'確認撤下'}</button><button class="text-button" type="button" data-lb-command="withdraw-cancel" data-lb-scope="${scope}" data-lb-index="${index}" ${busy?'disabled':''}>先保留</button></div></div>`;}

export function leaderboardHTMLV56({data=null,metric='overall',role='all',loading=false,error='',mine=[],mineKnown=false,mineLoading=false,mineError='',mineHasMore=false,mineOpen=false,rulesOpen=false,drafts=new Map()}={}){
 const selected=getMetric(metric),entries=Array.isArray(data?.entries)?data.entries:[],largest=Math.max(1,...entries.map(entry=>bounded(entry.value,Number.MAX_SAFE_INTEGER))),total=Number.isFinite(data?.totalPlayers)?data.totalPlayers:null;
 const rows=entries.map(entry=>`<li class="lb-rank-row ${entry.rank<=3?'lb-top-rank':''}"><span class="lb-rank" aria-label="第 ${entry.rank} 名">${String(entry.rank).padStart(2,'0')}</span><div class="lb-player"><span class="lb-role-symbol" aria-hidden="true">${text(ROLE_MAP[entry.actualRoleId]?.symbol||'移')}</span><div><h3>${escapeHTML(entry.nickname)}</h3><p>${text(roleLabel(entry.actualRoleId))}<span aria-hidden="true"> · </span>完成 ${number(entry.turns)} 回合</p></div></div><div class="lb-rank-value"><strong>${number(entry.value)}<small>${text(selected.unit||'')}</small></strong><span class="lb-rank-track" aria-hidden="true"><i style="width:${bounded(entry.value/largest*100)}%"></i></span>${metric==='overall'?'':`<span class="lb-secondary-score">綜合 ${number(entry.total)} 分</span>`}</div></li>`).join('');
 return `<section class="lb-board" data-leaderboard-board><div class="lb-heading"><div><span class="eyebrow">OFFICE SURVIVAL LEADERBOARD</span><h2 id="dialog-title">誰，把人生玩成了傳說？</h2><p class="dialog-lead">有人靠本事，有人靠嘴。這裡只收自願留名、已驗證的那一局。</p></div><div class="lb-board-mark" aria-hidden="true">↗</div></div><div class="lb-filters"><label for="lb-metric">想比什麼<select id="lb-metric" data-lb-filter="metric">${metricList().map(item=>`<option value="${item.id}" ${metric===item.id?'selected':''}>${text(item.label)}</option>`).join('')}</select></label><label for="lb-role">實際任職<select id="lb-role" data-lb-filter="role"><option value="all" ${role==='all'?'selected':''}>所有職業</option>${ROLES.map(item=>`<option value="${item.id}" ${role===item.id?'selected':''}>${text(roleLabel(item.id))}</option>`).join('')}</select></label><button class="secondary" type="button" data-lb-command="refresh" ${loading?'disabled':''}>${loading?'更新中…':'更新榜單 ↻'}</button></div><div class="lb-board-summary"><h3>${text(selected.label)}<span>${role==='all'?'全職業':text(roleLabel(role))}</span></h3><p>${total===null?'等待取得已留名人數':`${number(total)} 位匿名玩家符合此榜`} · 每人取最佳一局 · 前 50 名</p></div>${loading?'<p class="lb-loading" role="status">正在核對職場傳說…</p>':''}${error?`<p class="lb-error" role="status">${escapeHTML(error)} <button class="text-button" type="button" data-lb-command="refresh" ${loading?'disabled':''}>重新連線 ↻</button></p>`:''}${data?rows?`<ol class="lb-ranking" aria-label="${text(selected.label)}排行">${rows}</ol>`:`<div class="lb-empty"><span aria-hidden="true">?</span><h3>這張榜，第一個名字還沒出現。</h3><p>玩完一段人生，在結算畫面選擇留名，就有機會站上來。</p></div>`:!loading?'<p class="lb-empty-message">還沒取得榜單，先不替任何人編名次。</p>':''}${data?.updatedAt?`<p class="lb-updated">榜單取得時間 ${escapeHTML(dateLabel(data.updatedAt))} · 計分第 ${number(data.scoreVersion||SCORE_VERSION_V56)} 版</p>`:''}<details class="lb-my-entries" ${mineOpen?'open':''}><summary>我公開過的名字 <span>${mineKnown?`${mineHasMore?'已載入 ':''}${number(mine.length)} 局`:'尚未取得'}</span></summary><div>${mineLoading?'<p class="lb-quiet-status" role="status">正在查詢你的留名紀錄…</p>':''}${mineError?`<p class="lb-error" role="status">${escapeHTML(mineError)}</p>`:''}${mineKnown&&!mine.length?'<p class="lb-quiet-status">目前沒有公開留名。只有你在結算畫面確認送出，才會加入。</p>':''}${mine.map((entry,index)=>{const draft=drafts.get(entry.runId)||{};return `<article class="lb-mine-entry"><div class="lb-mine-heading"><h3>${escapeHTML(entry.nickname)}</h3><p>${text(roleLabel(entry.actualRoleId||entry.roleId))}${Number.isFinite(entry.total)?` · ${number(entry.total)} 分`:''}${Number.isFinite(entry.turns)?` · 完成 ${number(entry.turns)} 回合`:''}</p></div>${nicknameForm({scope:'mine',index,draft:{...draft,nickname:draft.nickname??entry.nickname},listed:true,busy:draft.busy})}${draft.withdrawConfirm?withdrawHTML('mine',index,draft.busy):''}</article>`;}).join('')}${mineHasMore?`<button class="secondary lb-more-mine" type="button" data-lb-command="mine-more" ${mineLoading?'disabled':''}>${mineLoading?'載入中…':'載入更多我的紀錄 ↓'}</button>`:''}<p class="lb-private-note">改名與撤下使用這個瀏覽器的匿名憑證，不需要額外登入。</p><button class="text-button" type="button" data-lb-command="mine-refresh" ${mineLoading?'disabled':''}>查詢我的留名 ↻</button></div></details>${scoreRulesHTML(rulesOpen)}<p class="lb-public-note">公開資料不含結局名稱、劇情、選擇內容或匿名玩家識別碼。暱稱由玩家自填，請勿冒用他人或填入個資。</p></section>`;
}

const defaultError=error=>error?.status===429?'留名操作有點密集，請稍後再試；剛才填的暱稱仍在。':error?.status===400||error?.status===422?'這次內容尚未通過驗證。請確認暱稱，並用完整的結算人生重試。':error?.status===409?'這局紀錄與已驗證版本不一致，沒有覆蓋原本的留名。':error?.status===401?'暫時無法確認匿名身分。請保留此瀏覽器資料，重新連線後再試。':'目前連線不穩，還不能確認結果。暱稱已保留在這個分頁；恢復連線後可重試同一局，不會重複刊登。';

export function createLeaderboardUIV56({dialog,openDialog,cloud,getRun=()=>null,getUnlocked=()=>[],document:documentOverride}={}){
 const doc=documentOverride||dialog?.ownerDocument||globalThis.document;
 const drafts=new Map();let data=null,metric='overall',role='all',loading=false,error='',mine=[],mineKnown=false,mineLoading=false,mineError='',mineHasMore=false,mineNextCursor=null,boardRequest=0,mineRequest=0,endingRoot=null;
 const visible=()=>Boolean(dialog?.open&&dialog.querySelector('[data-leaderboard-board]'));
 const draftFor=runId=>{if(!drafts.has(runId))drafts.set(runId,{nickname:'',consent:false,message:'',kind:'',busy:false,skipped:false,touched:false});return drafts.get(runId);};
 const currentRun=()=>{const state=getRun();return state?.completed&&state.runId?state:null;};
 const listedEntry=runId=>mine.find(entry=>entry.runId===runId)||null;
 function renderBoard({focus=false,focusId=''}={}){
  if(!focus&&!visible())return;const scroll=dialog.scrollTop,activeId=focusId||doc?.activeElement?.id;
  // A refresh, rename or withdraw rebuilds the dialog. Keep the section the
  // player is using open so its result/confirmation cannot disappear below it.
  const mineOpen=visible()&&Boolean(dialog.querySelector('.lb-my-entries')?.open),rulesOpen=visible()&&Boolean(dialog.querySelector('.lb-rules')?.open);
  openDialog(leaderboardHTMLV56({data,metric,role,loading,error,mine,mineKnown,mineLoading,mineError,mineHasMore,mineOpen,rulesOpen,drafts}));
  if(!focus){dialog.scrollTop=scroll;if(activeId)dialog.querySelector(`#${activeId}`)?.focus({preventScroll:true});}
 }
 function renderEnding(){
  const state=currentRun();if(!state||!endingRoot?.isConnected)return;
  const container=endingRoot.parentNode;if(!container)return;const activeId=doc?.activeElement?.id,rulesOpen=Boolean(endingRoot.querySelector('.lb-rules')?.open);
  const html=endingLeaderboardHTMLV56(state,{draft:draftFor(state.runId),entry:listedEntry(state.runId),checking:mineLoading,mineKnown,rulesOpen});
  endingRoot.outerHTML=html;endingRoot=container.querySelector('[data-leaderboard-ending]');
  if(activeId&&endingRoot?.querySelector(`#${activeId}`))endingRoot.querySelector(`#${activeId}`).focus({preventScroll:true});
 }
 function renderAll(){renderBoard();renderEnding();}
 function invalidateEarlierMineReads(){
  // A mutation acknowledgement is newer than every read already in flight.
  // Neither an old snapshot nor its finally block may replace that state.
  mineRequest++;mineLoading=false;mineError='';
 }
 async function loadMine({more=false}={}){
  if(more&&(!mineHasMore||!mineNextCursor||mineLoading))return false;
  const after=more?mineNextCursor:null,request=++mineRequest;mineLoading=true;mineError='';renderAll();
  try{if(typeof cloud?.myLeaderboard!=='function')throw new Error('offline');const response=await cloud.myLeaderboard({after});if(request!==mineRequest)return false;
   const rows=Array.isArray(response)?response:response?.entries;if(!Array.isArray(rows)||rows.some(entry=>typeof entry?.runId!=='string'||typeof entry.nickname!=='string'))throw new Error('invalid');
   mine=more?[...mine,...rows.filter(entry=>!mine.some(old=>old.runId===entry.runId))]:rows;mineKnown=true;mineHasMore=response?.hasMore===true;mineNextCursor=typeof response?.nextCursor==='string'?response.nextCursor:null;for(const entry of rows){const draft=draftFor(entry.runId);if(!draft.touched)draft.nickname=entry.nickname;}return true;
  }catch{if(request===mineRequest)mineError='暫時查不到個人留名紀錄。已公開的名字不會因此撤下，也不會自動新增。';return false;}
  finally{if(request===mineRequest){mineLoading=false;renderAll();}}
 }
 async function loadBoard(){
  const request=++boardRequest,requestedMetric=metric,requestedRole=role;loading=true;error='';renderBoard();
  try{if(typeof cloud?.leaderboard!=='function')throw new Error('offline');const response=await cloud.leaderboard({metric:requestedMetric,role:requestedRole});if(request!==boardRequest)return;
   if(!supportedBoard(response,requestedMetric,requestedRole))throw new Error('invalid');
   data=response;
  }catch{if(request===boardRequest)error='排行榜目前連不上。畫面若有舊榜單，仍是上一次取得的紀錄。';}
  finally{if(request===boardRequest){loading=false;renderBoard();}}
 }
 function contextFor(scope,index){
  if(scope==='mine'){const entry=mine[Number(index)];return entry?{runId:entry.runId,entry,run:null,draft:draftFor(entry.runId)}:null;}
  const state=currentRun();return state?{runId:state.runId,entry:listedEntry(state.runId),run:state,draft:draftFor(state.runId)}:null;
 }
 function readForm(form,context){context.draft.nickname=form.querySelector('[data-lb-name]')?.value||'';context.draft.consent=Boolean(form.querySelector('[data-lb-consent]')?.checked);context.draft.touched=true;}
 async function send(context){
  if(!context||context.draft.busy)return;const draft=context.draft;
  if(context.run&&!leaderboardEligibilityV56(context.run).eligible){draft.message='本季採目前規則；開一段新人生即可參賽。';draft.kind='error';renderAll();return;}
  try{draft.nickname=normalizeLeaderboardNicknameV56(draft.nickname);}catch(validation){draft.message=validation.message;draft.kind='error';renderAll();return;}
  if(!draft.consent){draft.message='公開前，請先勾選同意：暱稱、職業、分數與完成工作回合會讓所有人看見。';draft.kind='error';renderAll();return;}
  draft.busy=true;draft.message='正在重播並驗證本局，完成後才會公開。';draft.kind='';renderAll();
  try{
   if(typeof cloud?.submitLeaderboard!=='function')throw new Error('offline');
   // Previously submitted rows may be renamed without preserving every old
   // life in local storage. This is an authenticated metadata update only.
   const proof=context.run||{runId:context.runId};let response;
   if(context.run)response=await cloud.submitLeaderboard(proof,draft.nickname);
   else{if(typeof cloud?.renameLeaderboard!=='function')throw new Error('offline');response=await cloud.renameLeaderboard(context.runId,draft.nickname);}
   const canonical=response?.entry,acknowledged=response?.version===1&&response?.published===true&&canonical?.runId===context.runId&&canonical?.nickname===draft.nickname;
   if(acknowledged){invalidateEarlierMineReads();mine=[...mine.filter(entry=>entry.runId!==context.runId),canonical];mineKnown=true;}
   const confirmed=acknowledged||await loadMine(),entry=listedEntry(context.runId);
   if(confirmed&&entry&&entry.nickname===draft.nickname){draft.message='留名已確認。各榜採每位匿名玩家的最佳一局，名字不一定出現在每張榜。';draft.kind='success';draft.consent=false;draft.skipped=false;draft.withdrawConfirm=false;}
   else{draft.message='送出已回應，但暫時還沒查到最新留名。請先查詢狀態，不必急著重複送出。';draft.kind='error';}
   if(visible())void loadBoard();
  }catch(problem){draft.message=defaultError(problem);draft.kind='error';}
  finally{draft.busy=false;renderAll();}
 }
 async function withdraw(context){
  if(!context||context.draft.busy)return;const draft=context.draft;draft.busy=true;draft.message='正在撤下公開留名…';draft.kind='';renderAll();
  try{if(typeof cloud?.removeLeaderboard!=='function')throw new Error('offline');const response=await cloud.removeLeaderboard(context.runId),acknowledged=response?.version===1&&response?.removed===true&&response?.runId===context.runId;if(acknowledged){invalidateEarlierMineReads();const deletingCursor=listedEntry(context.runId)?.entryId===mineNextCursor;mine=mine.filter(entry=>entry.runId!==context.runId);if(deletingCursor){mineNextCursor=null;mineHasMore=false;void loadMine();}}const confirmed=acknowledged||await loadMine();
   if(confirmed&&!listedEntry(context.runId)){draft.message='已確認撤下這局留名。故事、成就與匿名統計仍保留。';draft.kind='success';draft.consent=false;draft.withdrawConfirm=false;draft.skipped=true;}
   else{draft.message='撤下操作已回應，但暫時還不能確認最新狀態。請稍後查詢。';draft.kind='error';}if(visible())void loadBoard();
  }catch(problem){draft.message=defaultError(problem);draft.kind='error';}
  finally{draft.busy=false;renderAll();}
 }
 doc?.addEventListener('input',event=>{const form=event.target.closest?.('[data-lb-form]');if(!form)return;const context=contextFor(form.dataset.lbForm,form.dataset.lbIndex);if(!context||context.draft.busy)return;readForm(form,context);if(event.target.hasAttribute?.('data-lb-name')){context.draft.consent=false;const checkbox=form.querySelector('[data-lb-consent]');if(checkbox)checkbox.checked=false;}context.draft.message='';context.draft.kind='';const message=form.querySelector('[role="status"]');if(message)message.textContent='';});
 doc?.addEventListener('change',event=>{
  const filter=event.target.dataset?.lbFilter;if(filter&&visible()){const value=event.target.value;if(filter==='metric'&&metricList().some(item=>item.id===value))metric=value;else if(filter==='role'&&(value==='all'||ROLE_MAP[value]))role=value;else return;data=null;void loadBoard();return;}
  const form=event.target.closest?.('[data-lb-form]');if(form){const context=contextFor(form.dataset.lbForm,form.dataset.lbIndex);if(context&&!context.draft.busy)readForm(form,context);}
 });
 doc?.addEventListener('submit',event=>{const form=event.target.closest?.('[data-lb-form]');if(!form)return;event.preventDefault();const context=contextFor(form.dataset.lbForm,form.dataset.lbIndex);if(context&&!context.draft.busy){readForm(form,context);void send(context);}});
 doc?.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-lb-command]');if(!button)return;event.preventDefault();const command=button.dataset.lbCommand;
  if(command==='open'){void api.open();return;}if(command==='refresh'){void loadBoard();return;}if(command==='mine-refresh'){void loadMine();return;}if(command==='mine-more'){void loadMine({more:true});return;}
  const context=contextFor(button.dataset.lbScope||'ending',button.dataset.lbIndex||0);if(!context||context.draft.busy)return;
  if(command==='skip'){context.draft.skipped=true;context.draft.consent=false;renderEnding();}
  if(command==='unskip'){context.draft.skipped=false;renderEnding();endingRoot?.querySelector('[data-lb-name]')?.focus();}
  if(command==='withdraw'||command==='withdraw-cancel'){context.draft.withdrawConfirm=command==='withdraw';renderAll();}
  if(command==='withdraw-confirm')void withdraw(context);
 });
 const api={
  async open(){renderBoard({focus:true});await Promise.allSettled([loadBoard(),loadMine()]);},
  endingHTML(state){const draft=state?.runId?draftFor(state.runId):{};return endingLeaderboardHTMLV56(state,{draft,entry:listedEntry(state?.runId),checking:mineLoading,mineKnown});},
  mountEnding(root=doc){endingRoot=root?.querySelector?.('[data-leaderboard-ending]')||null;if(endingRoot&&currentRun())void loadMine();},
 };
 return api;
}
