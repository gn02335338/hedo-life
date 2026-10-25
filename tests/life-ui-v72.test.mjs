import test from 'node:test';
import assert from 'node:assert/strict';
import {relationshipHintV72,lifeRulesNoticeV72,relationshipResultHTMLV72} from '../dist/life-ui-v72.js';
import {characterAffinity,isRelationshipOutcomeV72} from '../dist/character-stats.js';

const seed='e39-r72-n-'+'a'.repeat(22);
const historyFor=(id,amounts)=>amounts.map((amount,index)=>({eventId:`ui-unit-${index}`,kind:'daily',turn:index,choiceIndex:0,speaker:id,breakdown:[{source:'choice',delta:{[id==='wing'?'boss':'trust']:amount}}]}));
const life=(amounts=[])=>({seed,history:historyFor('jack',amounts),rng:1234});
const rowFor=(reaction='help',target='jack')=>({eventId:'ui-current',kind:'daily',choiceIndex:0,speaker:target,turn:4,result:'這是一段已在結果正文顯示的獨特完整情節。',breakdown:[{source:'choice',delta:{trust:6}}],relationshipOutcome:{version:1,target,reaction,affinityDelta:{help:2,cover:1,refusal:-1,argument:-2,backstab:-3}[reaction],origin:'ui-current',tier:['help','cover'].includes(reaction)?'trusted':'strained'}});

test('current relationship hints describe five evidence-derived tiers without choice answers or numerical odds',()=>{
 const cases=[[[12,12,6],'close','關係親近'],[[12,3],'warm','互相信任'],[[],'neutral','一般往來'],[[-12,-8],'cold','彼此提防'],[[-12,-12,-11],'hostile','樑子已深']];
 for(const [amounts,tier,label] of cases){
  const run=life(amounts),before=structuredClone(run),html=relationshipHintV72(run,'jack');
  assert.match(html,new RegExp(`relationship-${tier}`));assert.ok(html.includes(label));
  assert.doesNotMatch(html,/\d+%|成功率|必定|保證|選項|好感[+−-]\d/);
  assert.deepEqual(run,before);
 }
});

test('r73 keeps the existing personal relationship tiers and result badges',()=>{
 const old=life([12,12,6]),current={...old,seed:'e39-r73-n-'+'a'.repeat(22)},row=rowFor('help');
 assert.equal(relationshipHintV72(current,'jack'),relationshipHintV72(old,'jack'));
 assert.equal(relationshipResultHTMLV72(current,row),relationshipResultHTMLV72(old,row));
});

test('old lives and unknown/hidden character IDs do not receive current-tier or result UI',()=>{
 const row=rowFor();
 for(const old of ['e39-r71-n-'+'a'.repeat(22),'e39-r70-s-'+'a'.repeat(22),'e39-old-ui','e38-legacy','e39-r74-n-'+'a'.repeat(22)]){
  const run={...life([12,12,6]),seed:old};assert.equal(relationshipHintV72(run,'jack'),'');assert.equal(relationshipResultHTMLV72(run,row),'');
 }
 for(const id of ['missing','company-mystery','__proto__',null])assert.equal(relationshipHintV72(life(),'jack'===id?'missing':id),'');
 assert.equal(relationshipResultHTMLV72(life(),null),'');assert.equal(relationshipResultHTMLV72(life(),{relationshipOutcome:{target:'missing',reaction:'help'}}),'');
 assert.equal(relationshipResultHTMLV72(life(),{relationshipOutcome:{target:'jack',reaction:'unknown'}}),'');
});

test('all five canonical relationship reaction types have short name-specific badges without duplicating prose',()=>{
 for(const reaction of ['help','cover','refusal','argument','backstab']){
  const row=rowFor(reaction),run=life(),before=structuredClone({run,row});
  assert.equal(isRelationshipOutcomeV72(run,row),true);
  const html=relationshipResultHTMLV72(run,row);assert.match(html,/class="relationship-result"/);assert.match(html,/傑克/);
  assert.doesNotMatch(html,/這是一段已在結果正文顯示的獨特完整情節/);
  assert.doesNotMatch(html,/好感(?:上升|下降)|[+−-]\d+|成功率|機率|\d+%/);
  assert.deepEqual({run,row},before);
 }
 const professor=relationshipResultHTMLV72(life(),rowFor('help','professor'));assert.match(professor,/林老師/);assert.doesNotMatch(professor,/林澤教授|顧問教授/);
});

test('a hostile extra reaction is not falsely labelled as a net affinity decrease after a cooperative answer',()=>{
 const row=rowFor('backstab'),before={seed,history:historyFor('jack',[-12,-12])},after={...before,history:[...before.history,row]};
 assert.equal(characterAffinity(before,'jack').score,26);assert.equal(characterAffinity(after,'jack').score,29);
 const html=relationshipResultHTMLV72(after,row);assert.match(html,/消息被轉了出去/);assert.doesNotMatch(html,/好感下降|好感[−-]|減少|降低/);
});

test('badge text never treats result prose or a supplied label as executable markup',()=>{
 const row=rowFor('help');row.result='<img src=x onerror="alert(1)">';row.relationshipOutcome.label='<script>bad-label</script>';
 const html=relationshipResultHTMLV72(life(),row);
 assert.doesNotMatch(html,/<script|<img|onerror=/);
 if(html.includes('bad-label'))assert.match(html,/&lt;script&gt;bad-label&lt;\/script&gt;/);
});

test('the older-profile notice offers a fresh application without revealing destinations or outcomes',()=>{
 for(const profile of [60,65,66,67,68,69,70,71])for(const marker of ['n','s','d']){
  const html=lifeRulesNoticeV72({seed:`e39-r${profile}-${marker}-`+'a'.repeat(22)});assert.match(html,/data-action="new"/);assert.match(html,/重新應徵/);assert.match(html,/交情/);
  assert.doesNotMatch(html,/NASDAQ|上市|上櫃|越南|成功率|\d+%|company72/);
 }
 for(const run of [null,life(),{seed:'e38-old'},{seed:'unrelated'},{seed:'e39-r74-n-'+'a'.repeat(22)}])assert.equal(lifeRulesNoticeV72(run),'');
});
