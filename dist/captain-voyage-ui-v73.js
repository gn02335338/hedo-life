import {isCaptainVoyageV73} from './captain-profile-v73.js';
import {captainVoyagePhaseV73,isCaptainVoyageOutcomeV73} from './captain-voyage-v73.js';

export function captainVoyageHTMLV73(run,event){
 const state=captainVoyagePhaseV73(run,event);if(!state)return '';
 const body=state.phase==='end'?'這趟私人行程到此收尾，接著回到原本進度；工作與職稱都還在。':state.phase==='result'?'剛才的回應已經記下，下一幕接著看。':state.phase==='start'?'船票是私人邀約。要不要上船，由你自己回覆。':state.stage===state.total-1?'這是最後一幕，回覆後這趟行程就收尾。':`私人航程第 ${state.stage+1}／${state.total} 幕。下一站選完才揭曉。`;
 return `<aside class="activity-phase-notice activity-phase-${state.phase} captain-voyage-phase" aria-label="船長私人航程狀態"${state.phase==='end'?' role="status"':''}><span class="activity-phase-label">${state.label}</span><b>${state.phase==='end'?'已經靠岸':state.phase==='start'?'船長的上船邀約':state.phase==='result'?'這一幕已有結果':`這趟還在進行・第 ${state.stage+1} 幕`}</b><p>${body}</p></aside>`;
}
export function captainVoyageReturnHTMLV73(run,event){
 if(!isCaptainVoyageV73(run)||run.pending||run.completed||run.captainVoyageContext||!['daily','fantasy','work-gap'].includes(event?.kind))return '';
 const row=run.history?.at(-1);if(!isCaptainVoyageOutcomeV73(run,row)||!['finished','refused','left','kicked'].includes(row.captainVoyageOutcome.decision))return '';
 return '<aside class="activity-return-notice" role="status"><span aria-hidden="true">✓</span><div><b>私人航程已收尾</b><p>接著回到原本的安排；這趟沒有多算工作回合。</p></div></aside>';
}
export function captainVoyageStatusHTMLV73(run){
 if(!isCaptainVoyageV73(run)||!run.flags?.captain73_joined)return '';
 return `<div class="personnel-status captain-crew-status"><b>船員圈圈</b><p>${run.captainVoyageContext?'這趟已上船，仍可選擇先下船。':'這局一起出航過，航程已經靠岸。'}</p></div>`;
}
export function captainVoyageLegacyNoticeV73(run){
 return /^e39-r72-[nsd]-[0-9a-f]{22}$/.test(run?.seed||'')?'<aside class="rules-notice life-rules-notice"><p>新版加入船長的私人邀約。想遇到新航線，可以從重新應徵開始。</p><button class="text-button" data-action="new">重新應徵，看看新航線 ↗</button></aside>':'';
}
