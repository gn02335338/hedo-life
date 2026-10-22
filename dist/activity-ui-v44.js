import {ACTIVITY_META_V44} from './activities-v44.js';

const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
// Activity invitations now arrive as canonical story events. This view only
// displays progress after the player has answered the invitation.
export function activityProgressHTMLV44(run,event){
 const info=event?.activity;if(!info||!run.activityContext)return'';
 const revealed=run.pending?run.history.at(-1)?.activityOutcome:null;
 const score=revealed?.score??info.score,pressure=revealed?.pressure??info.pressure;
 const total=info.total??ACTIVITY_META_V44[info.id]?.stages??1,stage=info.stage+1;
 const armPhase=info.id==='arm'?`<div class="activity-phase-notice" aria-label="腕力大賽狀態"><b>${run.pending?'腕力大賽・本幕結果':info.stage===0?'腕力大賽開始':'腕力大賽進行中'}</b><p>${run.pending?'剛才這一幕的回應已經發生，接著看下一步。':info.stage===0?'你來到比賽桌邊。先把規則講清楚，再進入下一幕。':'你仍在同一場腕力大賽裡，繼續回應眼前這一幕。'}</p></div>`:'';
 const meter=(label,value,max)=>`<div class="activity-meter"><span>${escape(label)} <b>${escape(value)}</b></span><div class="activity-meter-track"><i style="width:${Math.max(0,Math.min(100,(Number(value)||0)/(Number(max)||12)*100))}%"></i></div></div>`;
 return `<section class="activity-progress" aria-label="目前活動進度">${armPhase}<div class="activity-progress-heading"><span>${escape(ACTIVITY_META_V44[info.id]?.name||'活動進行中')}</span><b>第 ${stage} / ${total} 幕</b></div><ol aria-label="活動階段">${Array.from({length:total},(_,i)=>`<li class="${i<info.stage?'done':i===info.stage?'current':''}" ${i===info.stage?'aria-current="step"':''}><span>${i<info.stage?'✓':i+1}</span></li>`).join('')}</ol><p>${escape(info.mechanic)}</p><div class="activity-meters">${meter(info.scoreLabel,score,info.scoreMax)}${meter(info.pressureLabel,pressure,info.pressureMax)}</div><small>${run.pending?'這些是剛才已發生的變化。':'這些是本場已累積的狀態，下一個結果還沒揭曉。'} 本場先用這一幕的選項回應，結束後回到原本的工作。</small></section>`;
}
