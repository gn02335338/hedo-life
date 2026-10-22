import {activityPhaseV52,activityPhaseNoticeHTMLV52} from './activity-phases-v52.js';

const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Activity invitations now arrive as canonical story events. This view only
// displays progress after the player has answered the invitation.
export function activityProgressHTMLV44(run,event){
 const phase=activityPhaseV52(run,event);if(!phase)return'';
 const info=event?.activity;
 const phaseNotice=activityPhaseNoticeHTMLV52(run,event);
 const steps=`<ol aria-label="活動階段">${Array.from({length:phase.total},(_,i)=>`<li class="${i<phase.stage||phase.phase==='end'?'done':i===phase.stage?'current':''}" ${i===phase.stage?'aria-current="step"':''}><span>${i<phase.stage||phase.phase==='end'?'✓':i+1}</span></li>`).join('')}</ol>`;
 const heading=`<div class="activity-progress-heading"><span>${escape(phase.name)}</span><b>第 ${phase.stage+1} / ${phase.total} 幕</b></div>`;
 if(phase.legacy)return `<section class="activity-progress" aria-label="目前活動進度">${phaseNotice}${heading}${steps}<small>${phase.phase==='end'?'本場已經結束。繼續後回到原本尚未處理的事。':'這場尾牙還在進行，先回應眼前這一幕。'}</small></section>`;
 const revealed=run.pending?run.history.at(-1)?.activityOutcome:null;
 const score=revealed?.score??info.score,pressure=revealed?.pressure??info.pressure;
 const meter=(label,value,max)=>`<div class="activity-meter"><span>${escape(label)} <b>${escape(value)}</b></span><div class="activity-meter-track"><i style="width:${Math.max(0,Math.min(100,(Number(value)||0)/(Number(max)||12)*100))}%"></i></div></div>`;
 return `<section class="activity-progress" aria-label="目前活動進度">${phaseNotice}${heading}${steps}<p>${escape(info.mechanic)}</p><div class="activity-meters">${meter(info.scoreLabel,score,info.scoreMax)}${meter(info.pressureLabel,pressure,info.pressureMax)}</div><small>${run.pending?'這些是剛才已發生的變化。':'這些是本場已累積的狀態，下一個結果還沒揭曉。'} ${phase.phase==='end'?'本場已經結束。繼續後回到原本尚未處理的事；如果狀態已撐不住，會先處理。':'本場先用這一幕的選項回應，結束後回到原本的工作。'}</small></section>`;
}
