import {ACTIVITY_META_V44} from './activities-v44.js';

const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const phaseName=id=>id==='basketball'?'下班球局':ACTIVITY_META_V44[id].name;
const legacyBanquetStages=Object.freeze(['banquet-welcome','banquet-draw','banquet-afterparty']);
const copy=Object.freeze({
 arm:{start:'你來到比賽桌邊。先把規則講清楚，再進入下一幕。',end:'賽事和賽後聲明都告一段落。這是本場最後一幕的結果。'},
 diet:{start:'你已加入減肥比賽。先選自己的參賽步調，再面對接下來的午餐與紀錄。',end:'這幾輪的習慣紀錄已結算，減肥比賽到此收尾。'},
 roadshow:{start:'你已來到展示現場。先安排展位，再接待提問，最後整理名單與承諾。',end:'最後一批名單與承諾已有交代，這場 Roadshow 收攤了。'},
 dinner:{start:'公司聚餐開始了。先安排座位，接著點餐，最後再決定怎麼散場。',end:'最後一輪點餐與散場安排已有結果，這頓聚餐到此結束。'},
 banquet:{start:'你已入席，尾牙正式開始。搶麥、抽獎與散場續攤，今晚一幕一幕來。',end:'抽獎與散場續攤都已有結果，今晚尾牙到此收尾。'},
 basketball:{start:'你已來到球場。先暖身分隊，再上場打球，今晚最後一波打完就收。',end:'最後一波已有結果，今晚球局到此結束。'},
 review:{start:'你已抵達審查現場。先核對資料，再回答追問，最後確認承諾與修正。',end:'最後一輪追問與修正已有交代，這場審查到此結束。'}
});

// Read only what has happened. A final-stage prompt is still in progress until
// its answer has a committed done outcome; merely viewing it reveals no result.
export function activityPhaseV52(run,event){
 let id,stage,total,legacy=false;
 if(event?.kind==='activity'&&event.activity&&run?.activityContext){
  ({id,stage,total}=event.activity);
  const context=run.activityContext;
  if(!ACTIVITY_META_V44[id]||context.id!==id||context.stage!==stage||event.id!==`activity44-${id}-${stage}`)return null;
  total=total??ACTIVITY_META_V44[id].stages;
  if(total!==ACTIVITY_META_V44[id].stages)return null;
 }else if(event?.kind==='banquet'&&run?.banquetReturnEventId){
  id='banquet';stage=legacyBanquetStages.indexOf(event.id);total=legacyBanquetStages.length;legacy=true;
 }else return null;
 if(!Number.isInteger(stage)||stage<0||stage>=total)return null;
 const row=run.history?.at(-1),sameRow=run.pending&&row?.eventId===event.id;
 const committed=legacy?sameRow&&row.kind==='banquet'&&run.pendingEffect==='banquetFinish':
  sameRow&&row.kind==='activity'&&row.activityOutcome?.id===id&&row.activityOutcome.stage===stage&&row.activityOutcome.done===true;
 const phase=run.pending?(committed&&stage===total-1?'end':'result'):stage===0?'start':'progress';
 const name=phaseName(id);
 const title=phase==='start'?`${name}開始`:phase==='end'?`${name}結束`:phase==='result'?`${name}・本幕結果`:`${name}進行中`;
 const body=phase==='start'?copy[id].start:phase==='end'?copy[id].end:phase==='result'?'剛才這一幕的回應已有結果，活動還沒結束。接著看下一幕。':`你仍在同一場${name}裡，繼續回應眼前這一幕。`;
 return {id,name,stage,total,phase,title,body,legacy};
}

export function activityPhaseNoticeHTMLV52(run,event){
 const phase=activityPhaseV52(run,event);
 if(!phase)return'';
 return `<div class="activity-phase-notice activity-phase-${phase.phase}" aria-label="${escape(phase.name)}狀態"${phase.phase==='end'?' role="status"':''}><span class="activity-phase-label">${phase.phase==='start'?'活動開始':phase.phase==='end'?'活動結束':phase.phase==='result'?'本幕已回應':'活動進行中'}</span><b>${escape(phase.title)}</b><p>${escape(phase.body)}</p></div>`;
}

const blockedReturn=run=>run.pending||run.completed||run.pendingFamily||[
 'treatsContext','activityContext','activityInvitationContext','hiddenEncounterContext','chapterContext','companyContext','rageContext','verbalContext',
 'patronageReplyContext','patronageContext','raiseContext','mealContext','personnelPending','resumeEventId','exitReturnEventId',
 'breakReturnEventId','banquetReturnEventId','meltdownReturnEventId','wealthReturnEventId'
].some(key=>!!run[key])||['open','queued'].includes(run.salaryAdvice?.status)||['mood','energy','cash'].some(key=>run.stats?.[key]<=0);

// The immediate return is identified by the last recorded choice, not by a
// sticky flag. Starting any other action, workday or interruption hides it.
export function activityReturnNoticeHTMLV52(run,event){
 if(!run||blockedReturn(run)||!['daily','fantasy','work-gap'].includes(event?.kind))return'';
 const row=run.history?.at(-1),action=run.actions?.at(-1);
 if(!row||row.turn!==run.turn||action?.type!=='choice'||action.eventId!==row.eventId||action.index!==row.choiceIndex)return'';
 let id=null;
 if(row.kind==='activity'&&row.activityOutcome?.done===true){
  const outcome=row.activityOutcome,meta=ACTIVITY_META_V44[outcome.id];
  if(meta&&outcome.stage===meta.stages-1&&row.eventId===`activity44-${outcome.id}-${outcome.stage}`)id=outcome.id;
 }else if(row.kind==='banquet'&&row.eventId==='banquet-afterparty')id='banquet';
 if(!id)return'';
 const name=phaseName(id);
 const body=event.kind==='work-gap'?'活動結果已記下。先留在工作空檔，下一件事還沒開始。':'活動結果已記下。現在回到活動前尚未處理的那一幕，繼續原本的選擇。';
 return `<aside class="activity-return-notice" role="status" aria-label="活動已結束"><span aria-hidden="true">✓</span><div><b>${escape(name)}已結束</b><p>${escape(body)}</p></div></aside>`;
}
