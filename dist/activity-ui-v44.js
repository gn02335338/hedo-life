import {ACTIVITY_IDS_V44,ACTIVITY_META_V44} from './activities-v44.js';

const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icons={arm:'✊',diet:'◒',roadshow:'↗',dinner:'♨',banquet:'✦',basketball:'◉',review:'▤'};
// Invitations are a presentation-only rotation. Looking, canceling or reloading
// must never consume the canonical RNG used to resolve actual game choices.
export function activitySuggestionV44(run){
 const ids=ACTIVITY_IDS_V44.filter(id=>!run.flags?.[`activity44_${id}`]&&!(id==='banquet'&&(run.flags?.banquet_attended||run.flags?.banquet_seen)));
 if(!ids.length)return null;
 let hash=2166136261;
 for(const char of `${run.seed}:${Math.floor(run.turn/2)}:${run.actualRoleId}`)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 return ids[hash%ids.length];
}

export function activityInvitationHTMLV44(run){
 const id=activitySuggestionV44(run);if(!id)return'';
 const activity=ACTIVITY_META_V44[id];
 return `<aside class="activity-invitation" aria-label="這回合的活動邀約"><span class="activity-symbol" aria-hidden="true">${icons[id]}</span><div><span class="eyebrow">OFF THE AGENDA / 今天還有這件事</span><b>${escape(activity.name)}</b><p>${escape(activity.teaser)}</p></div><button type="button" data-action="activity-menu">看看活動 <span aria-hidden="true">↗</span></button></aside>`;
}

export function activityPickerHTMLV44(run){
 return `<section data-activity-picker><span class="eyebrow">SIDE QUESTS / 不只有上班</span><h2 id="dialog-title">這次，你想參加哪一場？</h2><p class="dialog-lead">每場有自己的連續玩法。活動不另算工作日，也不重發薪水；每隔兩個工作回合可參加一場，同一場本局只玩一次。費用在花錢前列明，結果選完才揭曉。</p><div class="activity-picker-grid">${ACTIVITY_IDS_V44.map(id=>{
  const item=ACTIVITY_META_V44[id],done=!!run.flags?.[`activity44_${id}`]||id==='banquet'&&!!(run.flags?.banquet_attended||run.flags?.banquet_seen);
  return `<button type="button" class="activity-card" data-action="activity-start" data-activity-id="${id}" ${done?'disabled':''}><span class="activity-card-icon" aria-hidden="true">${icons[id]}</span><span class="activity-card-copy"><b>${escape(item.name)}</b><span>${escape(item.mechanic)}</span><small>${done?'這局已參加':`${item.stages} 幕活動`}</small></span><span aria-hidden="true">${done?'✓':'↗'}</span></button>`;
 }).join('')}</div><button type="button" class="text-button" data-action="activity-cancel">今天先不參加，回去工作</button></section>`;
}

export function activityProgressHTMLV44(run,event){
 const info=event?.activity;if(!info||!run.activityContext)return'';
 const revealed=run.pending?run.history.at(-1)?.activityOutcome:null;
 const score=revealed?.score??info.score,pressure=revealed?.pressure??info.pressure;
 const total=info.total??ACTIVITY_META_V44[info.id]?.stages??1,stage=info.stage+1;
 const meter=(label,value,max)=>`<div class="activity-meter"><span>${escape(label)} <b>${escape(value)}</b></span><div class="activity-meter-track"><i style="width:${Math.max(0,Math.min(100,(Number(value)||0)/(Number(max)||12)*100))}%"></i></div></div>`;
 return `<section class="activity-progress" aria-label="目前活動進度"><div class="activity-progress-heading"><span>${escape(ACTIVITY_META_V44[info.id]?.name||'活動進行中')}</span><b>第 ${stage} / ${total} 幕</b></div><ol aria-label="活動階段">${Array.from({length:total},(_,i)=>`<li class="${i<info.stage?'done':i===info.stage?'current':''}" ${i===info.stage?'aria-current="step"':''}><span>${i<info.stage?'✓':i+1}</span></li>`).join('')}</ol><p>${escape(info.mechanic)}</p><div class="activity-meters">${meter(info.scoreLabel,score,info.scoreMax)}${meter(info.pressureLabel,pressure,info.pressureMax)}</div><small>${run.pending?'這些是剛才已發生的變化。':'這些是本場已累積的狀態，下一個結果還沒揭曉。'} 本場先用這一幕的選項回應，結束後回到原本的工作。</small></section>`;
}
