import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {replayRun,getEvent,getVerbalLine,requestVerbal,applyChoice,validRun} from '../dist/engine.js';
import {verbalLineV2} from '../dist/verbal-scenario-v2.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {displayArmVerbalLineV51,displayArmVerbalHistoryV51,armVerbalTargetLabelV51} from '../dist/arm-verbal-copy-v51.js';

const SCENE='video-referee-committee';
const routes=JSON.parse(readFileSync(new URL('./fixtures/company-e39-routes.json',import.meta.url),'utf8')).routes;
const route=routes.find(row=>row.roleId==='finance'&&row.actions.some(action=>action.eventId===SCENE));
const source=()=>replayRun(route.roleId,route.seed,route.actions.slice(0,route.actions.findIndex(action=>action.eventId===SCENE)));
const context=phase=>({eventId:SCENE,target:'self',phase});
const natural=phase=>phase==='result'?applyChoice(source(),0):source();
const commit=phase=>requestVerbal(natural(phase),undefined,2);

test('the referee outburst addresses the competing countdowns in both phases without forecasting a result',()=>{
 const lines=[];
 for(const phase of ['event','result']){
  const run=natural(phase),canonical=getVerbalLine(run,'self'),before=JSON.stringify(run);
  const shown=displayArmVerbalLineV51(canonical,context(phase));lines.push(shown);
  assert.match(shown,/腕力/);assert.match(shown,/裁判|總指揮/);assert.match(shown,/幹|他媽|靠北/);
  assert.doesNotMatch(shown,/排程|進度|工時|待辦|資遣|離職|勝率|機率|成功率|[+-]\d+|[%％]|誰贏|獲勝|輸贏已定/);
  assert.equal(armVerbalTargetLabelV51(SCENE,'self'),'對現場開罵');
  assert.equal(displayArmVerbalLineV51(shown,context(phase)),shown);
  assert.equal(JSON.stringify(run),before,'a preview cannot mutate the selected scene or RNG');
 }
 assert.notEqual(lines[0],lines[1],'after-result dialogue does not repeat the before-choice prompt');
});

test('only the exact scene, self target and known canonical wording receive the correction',()=>{
 const old=getVerbalLine(source(),'self');
 for(const options of [
  {eventId:'other-scene',target:'self',phase:'event'},
  {eventId:SCENE,target:'sonny',phase:'event'},
  {eventId:SCENE,target:'wing',phase:'event'},
  {eventId:SCENE,target:'self',phase:'tomorrow'},
 ])assert.equal(displayArmVerbalLineV51(old,options),old);
 for(const line of ['原本的普通回答。','幹，這是另一句話。',null,undefined,7])assert.equal(displayArmVerbalLineV51(line,context('event')),line);
 for(const target of ['sonny','wing',undefined])assert.equal(armVerbalTargetLabelV51(SCENE,target),'');
 assert.equal(armVerbalTargetLabelV51('another-scene','self'),'');
});

test('an older scenario quote can be presented without changing its saved canonical evidence',()=>{
 const run=source(),event=getEvent(run),before=JSON.stringify(run);
 for(const phase of ['event','result']){
  const legacy=verbalLineV2(run,event,'self',phase);
  const shown=displayArmVerbalLineV51(legacy,context(phase));
  assert.match(shown,/腕力/);assert.notEqual(shown,legacy);
 }
 assert.equal(JSON.stringify(run),before);
});

test('committed speech uses the same quote as its preview while preserving reaction, RNG notes and numbers',()=>{
 for(const phase of ['event','result']){
  const run=natural(phase),pending=commit(phase),row=pending.history.at(-1),snapshot=JSON.stringify(pending);
  assert.equal(validRun(pending),true);
  const expected=polishVerbalHistoryV41(row),shown=displayArmVerbalHistoryV51(expected);
  assert.equal(shown.choiceText,displayArmVerbalLineV51(getVerbalLine(run,'self'),context(phase)));
  assert.equal(shown.body,expected.body);
  const oldReaction='你把這句話罵完整，空氣沒有回嘴。';
  const newReaction='你朝吵成一團的桌邊罵完，幾個人像沒聽見，繼續各喊各的。';
  assert.ok(expected.result.startsWith(oldReaction));
  const suffix=expected.result.slice(oldReaction.length);
  const oldWork=' 這場討論散了，你回到座位。交辦還沒做完，下一件差事已經在等。';
  const projectedSuffix=phase==='event'&&suffix.startsWith(oldWork)?' 場邊這段起鬨告一段落，你回去處理原本的工作。'+suffix.slice(oldWork.length):suffix;
  assert.equal(shown.result,newReaction+projectedSuffix,'same resolved reaction, followed by every original RNG note');
  assert.equal([shown.body,shown.choiceText,shown.result].join('').split(shown.choiceText).length-1,1);
  for(const key of Object.keys(row).filter(key=>!['choiceText','body','result','eventOutcome','breakdown'].includes(key)))assert.deepEqual(shown[key],row[key],key);
  assert.equal(shown.eventOutcome.label,row.eventOutcome.label);assert.equal(shown.eventOutcome.result,'現場照樣各喊各的');
  assert.deepEqual(shown.breakdown.map(({label,...part})=>part),row.breakdown.map(({label,...part})=>part));
  assert.equal(JSON.stringify(pending),snapshot);assert.equal(validRun(pending),true);
  assert.deepEqual(displayArmVerbalHistoryV51(shown),shown);
  assert.deepEqual(displayArmVerbalHistoryV51(row),shown,'an unpolished row follows the same projection');
 }
});

test('three known self reactions use scene wording while their evidence and all appended notes stay intact',()=>{
 const row=commit('event').history.at(-1),reactions={
  ignored:['你把這句話罵完整，空氣沒有回嘴。','你朝吵成一團的桌邊罵完，幾個人像沒聽見，繼續各喊各的。'],
  retort:['你連自己也一起罵了進去。話說完了，工作不會因為這句話自己做好。','你罵完才發現自己也跟著搶話，現在只是多了一個喊得特別大聲的觀眾。'],
  support:['旁邊有人抬頭看你，你把話收在自己這邊，沒有替任何人指名。','旁邊有人笑著點頭，你沒有點名誰，只把「先留一位裁判」又講了一次。'],
 };
 const tail=' 第17天：存款-12，心情+7。未知附加文字：「這一句不動。」';
 for(const phase of ['event','result'])for(const [kind,[original,replacement]] of Object.entries(reactions)){
  const sample={...row,verbalOutcome:{...row.verbalOutcome,phase,kind},choiceText:getVerbalLine(natural(phase),'self'),result:original+tail};
  const before=JSON.stringify(sample),shown=displayArmVerbalHistoryV51(sample);
  assert.equal(shown.result,replacement+tail);assert.deepEqual(shown.verbalOutcome,sample.verbalOutcome);
  assert.deepEqual(shown.delta,sample.delta);assert.deepEqual(shown.breakdown.map(({label,...part})=>part),sample.breakdown.map(({label,...part})=>part));
  assert.equal(JSON.stringify(sample),before);assert.deepEqual(displayArmVerbalHistoryV51(shown),shown);
 }
 const unfamiliar={...row,result:'不熟悉的反應開頭。'+reactions.ignored[0]+tail};
 assert.equal(displayArmVerbalHistoryV51(unfamiliar).result,unfamiliar.result,'never replace a phrase quoted later in an unknown reaction');
 const mismatched={...row,verbalOutcome:{...row.verbalOutcome,kind:'support'},result:reactions.ignored[0]+tail};
 assert.equal(displayArmVerbalHistoryV51(mismatched).result,mismatched.result,'an unrelated resolved branch is not relabelled');
});

test('resolved scene labels and the exact choice ledger agree with each reaction without changing evidence',()=>{
 const row=commit('event').history.at(-1),pairs={
  ignored:['對方沒有接招','現場照樣各喊各的'],
  retort:['原話反嗆回來','你也成了場邊總指揮'],
  support:['有人補上前情','旁邊有人跟著點頭'],
 };
 for(const [kind,[original,replacement]] of Object.entries(pairs)){
  const label=`這句話說出口之後：${original}`,sample={...row,verbalOutcome:{...row.verbalOutcome,kind},
   eventOutcome:{label:'這句話說出口之後',result:original,untouched:'保留額外欄位'},
   breakdown:[{source:'choice',label,delta:{mood:7,energy:-1},id:'choice-proof'},
    {source:'weather',label,delta:{boss:3}},
    {source:'choice',label:'未知選項：'+original,delta:{cash:-12}},
    {source:'choice',label:label+'附註',delta:{mood:-1}}]};
  const before=JSON.stringify(sample),shown=displayArmVerbalHistoryV51(sample);
  assert.deepEqual(shown.eventOutcome,{...sample.eventOutcome,result:replacement});
  assert.deepEqual(shown.breakdown[0],{...sample.breakdown[0],label:`這句話說出口之後：${replacement}`});
  for(let index=1;index<sample.breakdown.length;index++)assert.equal(shown.breakdown[index],sample.breakdown[index]);
  assert.equal(JSON.stringify(sample),before);assert.deepEqual(shown.verbalOutcome,sample.verbalOutcome);
  assert.deepEqual(displayArmVerbalHistoryV51(shown),shown);
  assert.equal(displayArmVerbalHistoryV51(shown),shown,'the second presentation does not clone or rewrite an already-shown row');
  for(const eventOutcome of [{label:'另一種結果',result:original},{label:'這句話說出口之後',result:'未知反應'},null]){
   const unknown={...sample,eventOutcome},kept=displayArmVerbalHistoryV51(unknown);
   assert.equal(kept.eventOutcome,eventOutcome);assert.equal(kept.breakdown,unknown.breakdown,'an unknown outcome does not authorize relabelling its ledger');
  }
 }
});

test('exact repeated leading speech is removed safely before replacing its independently rendered quote',()=>{
 const row=commit('event').history.at(-1),prefix=`你說：「${row.choiceText}」`;
 const duplicate={...row,body:prefix+prefix+'這是當場說出口的回應。',result:prefix+prefix+'旁人回你：「先讓一個人數。」 花費12、月薪72K，附加抽選文字照留。'};
 const before=JSON.stringify(duplicate),shown=displayArmVerbalHistoryV51(duplicate);
 assert.equal(shown.body,'這是當場說出口的回應。');
 assert.equal(shown.result,'旁人回你：「先讓一個人數。」 花費12、月薪72K，附加抽選文字照留。');
 assert.equal(JSON.stringify(duplicate),before);
 assert.deepEqual(displayArmVerbalHistoryV51(shown),shown);
 assert.deepEqual(displayArmVerbalHistoryV51(polishVerbalHistoryV41(duplicate)),shown);
 const someoneElse={...row,body:`阿福說：「${row.choiceText}」這不是玩家的前置引言。`,result:'你說：「不是同一句。」這段保留。'};
 const others=displayArmVerbalHistoryV51(someoneElse);
 assert.equal(others.body,someoneElse.body);assert.equal(others.result,someoneElse.result);
});

test('ordinary choices, named targets, unrelated origins and version 1 speech keep their original wording',()=>{
 const row=commit('event').history.at(-1);
 const variants=[
  null,
  {...row,verbalOutcome:undefined},
  {...row,eventId:'another-scene'},
  {...row,speaker:'sonny'},
  {...row,choiceText:'請大家只留一位裁判，其他人負責加油。'},
  {...row,verbalOutcome:{...row.verbalOutcome,target:'sonny'}},
  {...row,verbalOutcome:{...row.verbalOutcome,origin:'another-scene'}},
  {...row,verbalOutcome:{...row.verbalOutcome,phase:'tomorrow'}},
  {...row,eventId:'verbal-release',kind:'verbal',choiceText:'惡言相向',verbalOutcome:{kind:'ignored',target:'self',affinityDelta:0,origin:SCENE,phase:'event'}},
 ];
 for(const item of variants)assert.equal(displayArmVerbalHistoryV51(item),item);
 const ordinary=applyChoice(source(),0).history.at(-1);
 assert.equal(displayArmVerbalHistoryV51(ordinary),ordinary,'ordinary branch outcome and its actual choice remain intact');
});
