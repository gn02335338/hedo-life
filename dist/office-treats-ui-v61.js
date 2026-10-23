// Only the visible scene and its already committed row drive these labels.
// Future branches, choice effects and the next selected work scene stay hidden.
const names=Object.freeze({'jack-drinks':'傑克請飲料','company-tea':'公司下午茶','birthday-cake':'同月生日蛋糕'});
const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export function officeTreatPhaseV61(run,event){
 const meta=event?.officeTreat,context=run?.treatsContext;
 if(event?.kind!=='office-treat'||!meta||!context||!names[meta.id]||context.id!==meta.id||context.stage!==meta.stage||!Number.isInteger(meta.stage)||!Number.isInteger(meta.total)||meta.stage<0||meta.stage>=meta.total)return null;
 const row=run.history?.at(-1),outcome=row?.treatsOutcome;
 const resolved=run.pending&&row?.eventId===event.id&&row.kind==='office-treat'&&outcome?.version===1&&outcome.id===meta.id&&outcome.stage===meta.stage;
 const phase=resolved?(outcome.done===true?'end':'result'):meta.stage===0?'start':'progress';
 return {id:meta.id,name:names[meta.id],stage:meta.stage,total:meta.total,phase};
}
export function officeTreatPhaseHTMLV61(run,event){
 const state=officeTreatPhaseV61(run,event);if(!state)return'';
 const {name,phase,stage,total}=state;
 const label={start:'插曲開始',progress:'同一場插曲',result:'本幕已回應',end:'插曲結束'}[phase];
 const title=phase==='end'?`${name}結束`:phase==='start'?`${name}開始`:`${name}・第 ${stage+1} 幕`;
 const body=phase==='end'?'這段插曲的結果已記下，接著回到剛才的工作。':phase==='result'?'剛才的回應已有結果，接著看下一幕。':`這是第 ${stage+1}／${total} 幕。先回應眼前的事，結果選完才揭曉。`;
 return `<div class="activity-phase-notice activity-phase-${phase} office-treat-phase" aria-label="${escape(name)}狀態"${phase==='end'?' role="status"':''}><span class="activity-phase-label">${label}</span><b>${escape(title)}</b><p>${body}</p></div>`;
}
export function officeTreatNextLabelV61(run,event){
 const phase=officeTreatPhaseV61(run,event);
 return phase?.phase==='end'?'回到原本的事':phase?'繼續這段插曲':null;
}
export function officeTreatReturnHTMLV61(run,event){
 if(!run||run.pending||run.completed||run.pendingFamily||run.treatsContext||!['daily','fantasy','work-gap'].includes(event?.kind))return'';
 const row=run.history?.at(-1),outcome=row?.treatsOutcome,action=run.actions?.at(-1);
 if(row?.kind!=='office-treat'||outcome?.version!==1||outcome.done!==true||!names[outcome.id]||row.turn!==run.turn||action?.type!=='choice'||action.eventId!==row.eventId||action.index!==row.choiceIndex)return'';
 const detail=event.kind==='work-gap'?'事情告一段落，先留在工作空檔，再決定怎麼安排。':'接著處理插曲前的工作；這段對話沒有多算一個工作日。';
 return `<aside class="activity-return-notice" role="status" aria-label="辦公室插曲已結束"><span aria-hidden="true">✓</span><div><b>${escape(names[outcome.id])}已結束</b><p>${detail}</p></div></aside>`;
}
