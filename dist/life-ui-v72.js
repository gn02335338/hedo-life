import {isLifeSystemsV72} from './life-systems-v72.js';
import {characterAffinity} from './character-stats.js';
import {PERSONAS,displayName} from './persona.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function relationshipHintV72(run,id){
 if(!isLifeSystemsV72(run)||!Object.hasOwn(PERSONAS,id))return '';
 const score=characterAffinity(run,id).score;
 const [tier,title,text]=score>=80?['close','關係親近','比較願意出手幫忙，也可能帶來新的牽線。']:score>=65?['warm','互相信任','合作與邀約較容易談成，仍得看場合。']:score<=15?['hostile','樑子已深','可能拒絕配合，或把衝突帶到別人面前。']:score<=30?['cold','彼此提防','同樣的請託，更容易被頂回來。']:['neutral','一般往來','合作看眼前的事，也會慢慢累積交情。'];
 return `<p class="relationship-hint relationship-${tier}"><b>${title}</b><span>${text}</span></p>`;
}
export function lifeRulesNoticeV72(run){
 if(!run||isLifeSystemsV72(run)||!/^e39-r(?:6[0-9]|7[01])-[nsd]-/.test(run.seed||''))return '';
 return '<aside class="rules-notice life-rules-notice"><p>新版把人物交情接進合作、衝突與公司走向。想玩這套判定，請從重新應徵開始。</p><button class="text-button" data-action="new">重新應徵，試試新玩法 ↗</button></aside>';
}
export function relationshipResultHTMLV72(run,row){
 if(!isLifeSystemsV72(run)||!row?.relationshipOutcome)return '';
 const outcome=row.relationshipOutcome,id=outcome.target||outcome.actor||outcome.person;
 if(!Object.hasOwn(PERSONAS,id))return '';
 const label=outcome.label||({help:'同事幫了一手',support:'同事幫了一手',cover:'同事替你擋了一下',argument:'合作起了摩擦',conflict:'合作起了摩擦',refusal:'對方不願配合',backstab:'消息被轉了出去',neutral:'這次照常往來'}[outcome.reaction||outcome.kind]);
 if(!label)return '';
 return `<p class="relationship-result"><span aria-hidden="true">↗</span><b>${esc(displayName(id))} · ${esc(label)}</b><small>這段反應會留下本局的交情與合作紀錄。</small></p>`;
}
