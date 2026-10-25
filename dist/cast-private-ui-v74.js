import {isCastV74} from './cast-profile-v74.js';

export const isCastPrivateSceneV74=(run,event)=>isCastV74(run)&&event?.requiresCastV74===true&&event.kind==='private-social'&&event.scope==='private';
export function castPrivateNoticeV74(run,event){
 if(!isCastPrivateSceneV74(run,event))return '';
 const done=run.pending===true&&run.history?.at(-1)?.eventId===event.id;
 return `<aside class="activity-phase-notice activity-phase-${done?'end':'start'}" aria-label="私人小聚狀態"${done?' role="status"':''}><span class="activity-phase-label">PRIVATE TIME / 私人小聚</span><b>${done?'這段小聚已收尾':'私人小聚開始'}</b><p>${done?'這次回覆已經記下，接著回到原本的安排；這段不另算工作回合。':'這是工作以外的碰面。可以參與，也可以從選項離開這個場合。'}</p></aside>`;
}
export function castPrivateReturnV74(run,event){
 if(!isCastV74(run)||run.pending||run.completed||!['daily','fantasy','work-gap'].includes(event?.kind))return '';
 const row=run.history?.at(-1);
 if(row?.kind!=='private-social'||!/^cast74-(?:wine|peter|tony|henry|mia)-/.test(row.eventId||''))return '';
 return '<aside class="activity-return-notice" role="status"><span aria-hidden="true">✓</span><div><b>小聚結束，回到原本的安排</b><p>剛才的交情與選擇已記下，工作回合沒有多算。</p></div></aside>';
}
