import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,getEvent} from '../dist/engine.js';
import {displayChronicleEvent,displayChronicleHistory} from '../dist/chronicle-scene-copy.js';

// These are display-boundary fixtures. No authored event, seed, replay action,
// or verified history is rewritten when a recollection's prose is corrected.
function event(id,cohort='e21'){
 const run=createRun('sales',`${cohort}-chronicle-copy`);
 run.eventId=id;
 if(id==='banquet-welcome')run.banquetReturnEventId='video-pizza-overtime';
 return getEvent(run);
}
function freeze(value){
 if(value&&typeof value==='object'){
  Object.freeze(value);
  for(const child of Object.values(value))freeze(child);
 }
 return value;
}
const proseKeys=new Set(['title','body','wing','text','detail','result','label','choiceText']);
function withoutProse(value){
 if(Array.isArray(value))return value.map(withoutProse);
 if(!value||typeof value!=='object')return value;
 return Object.fromEntries(Object.entries(value)
  .filter(([key,child])=>!(proseKeys.has(key)&&typeof child==='string'))
  .map(([key,child])=>[key,withoutProse(child)]));
}
function historyFor(ev,index,branch=null,suffix=''){
 const choice=ev.choices[index],outcome=branch===null?choice:choice.draw.outcomes[branch];
 return {
  eventId:ev.id,kind:ev.kind,title:ev.title,body:ev.body,wing:ev.wing,
  speaker:ev.speaker,sourceIds:[...ev.sourceIds],turn:12,
  choiceIndex:index,choiceText:choice.text,result:outcome.result+suffix,
  chanceOutcome:suffix?'lucky':null,
  delta:{boss:0,mood:7,energy:-4,cash:0,skill:3,slack:-1,lick:-1,trust:6,dream:0},
  breakdown:[
   {source:'choice',label:branch===null?'選擇結果':`${choice.draw.label}：${outcome.label}`,delta:{mood:5,trust:6}},
   {source:'rng',label:'臨場好運',delta:{mood:2,skill:3}},
  ],
  weather:{text:'會議晚了五分鐘，今天先照原本進度。',kind:'clear'},
  jobTitle:'業務專員',pay:52,
  ...(branch===null?{}:{eventOutcome:{label:choice.draw.label,result:outcome.label}}),
 };
}

test('chronicle corrections change prose without touching any game mechanics or frozen inputs',()=>{
 for(const cohort of ['e13','e16','e21'])for(const id of ['banquet-welcome','video-pizza-overtime']){
  const original=freeze(event(id,cohort)),before=JSON.stringify(original),shown=displayChronicleEvent(original);
  assert.equal(JSON.stringify(original),before,`${cohort} ${id}: canonical event is unchanged`);
  assert.deepEqual(withoutProse(shown),withoutProse(original),`${cohort} ${id}: mechanics are unchanged`);
  assert.equal(shown.speaker,original.speaker,'display correction does not alter direct-rage targeting');
  assert.equal(shown.choices.length,original.choices.length);
  assert.notEqual(shown.body,original.body,'the corrected recollection is actually shown');
 }
});

test('First Love is Jack and the sales manager’s duel, while the other banquet draws retain their stories',()=>{
 const original=event('banquet-welcome'),shown=displayChronicleEvent(original),song=shown.choices[1];
 assert.match(shown.body,/First\s*Love/i);
 assert.match(shown.body,/傑克|Jack/);
 assert.match(shown.body,/水蛇|美美|Meimei/);
 assert.match(song.text,/First\s*Love/i);
 assert.match([shown.body,song.text].join(' '),/決鬥|對決|對唱|較勁|PK/i);
 assert.doesNotMatch(song.draw.outcomes.map(row=>row.result).join(' '),/你已經站到台前|等到自己能開始唱/);
 assert.equal(song.draw.outcomes.length,2);
 for(const index of [0,2,3])assert.deepEqual(shown.choices[index],original.choices[index],`unrelated banquet choice ${index}`);
});

test('arm-wrestling recollection exposes the excuses and gives the player three distinct responses',()=>{
 const shown=displayChronicleEvent(event('video-pizza-overtime'));
 const text=[shown.body,shown.wing,...shown.choices.flatMap(choice=>[choice.text,choice.result])].join(' ');
 for(const motif of [/抽筋|拉到/,/三片|3片/,/披薩|pizza/i,/十秒|10秒/,/不錄|不能錄|不拍|不能拍|不要拍/,/手.*傷|弄傷|受傷/])assert.match(text,motif);
 assert.match(shown.choices[0].text,/計時|記時|秒/);
 assert.match(shown.choices[1].text,/披薩|記者會|理由/);
 assert.match(shown.choices[2].text,/冠軍|冠軍賽|頒獎/);
 assert.equal(new Set(shown.choices.map(choice=>choice.text)).size,3);
});

test('each First Love draw maps the selected reply, resolved result and ledger labels consistently',()=>{
 const original=event('banquet-welcome'),shown=displayChronicleEvent(original);
 for(const branch of [0,1]){
  const history=freeze(historyFor(original,1,branch)),before=JSON.stringify(history),displayed=displayChronicleHistory(history);
  assert.equal(JSON.stringify(history),before,'stored replay history is unchanged');
  assert.deepEqual(withoutProse(displayed),withoutProse(history));
  assert.equal(displayed.choiceText,shown.choices[1].text);
  assert.equal(displayed.result,shown.choices[1].draw.outcomes[branch].result);
  assert.deepEqual(displayed.eventOutcome,{
   label:shown.choices[1].draw.label,result:shown.choices[1].draw.outcomes[branch].label,
  });
  assert.equal(displayed.breakdown[0].label,`${displayed.eventOutcome.label}：${displayed.eventOutcome.result}`);
  assert.deepEqual(displayed.breakdown[1],history.breakdown[1],'unrelated luck label is untouched');
 }
});

test('all arm-wrestling choices preserve the committed daily randomness and numeric ledger',()=>{
 const original=event('video-pizza-overtime'),shown=displayChronicleEvent(original);
 const suffix=' 恰巧通知晚到了一步，這段已結算的臨場好運不能重新抽。';
 for(let index=0;index<original.choices.length;index++){
  const history=freeze(historyFor(original,index,null,suffix)),before=JSON.stringify(history),displayed=displayChronicleHistory(history);
  assert.equal(displayed.choiceText,shown.choices[index].text);
  assert.equal(displayed.result,shown.choices[index].result+suffix,'only the authored prefix changes');
  assert.equal(JSON.stringify(history),before);
  assert.deepEqual(withoutProse(displayed),withoutProse(history));
  assert.deepEqual(displayed.delta,history.delta);
  assert.deepEqual(displayed.breakdown,history.breakdown);
  assert.deepEqual(displayed.weather,history.weather);
 }
});

test('unknown outcomes, incomplete history and unrelated events acquire no invented resolution',()=>{
 const original=event('banquet-welcome');
 const unresolved=freeze({eventId:original.id,title:original.title,body:original.body});
 const shown=displayChronicleHistory(unresolved);
 for(const key of ['choiceText','choiceIndex','result','eventOutcome','breakdown'])assert.equal(Object.hasOwn(shown,key),false,key);
 const unknown=freeze({...historyFor(original,1,0),result:'歷史紀錄的獨立文字，不能猜測改寫。',eventOutcome:{label:'未知抽籤',result:'尚未有對應的結果'}});
 const unknownShown=displayChronicleHistory(unknown);
 assert.equal(unknownShown.result,unknown.result);
 assert.deepEqual(unknownShown.eventOutcome,unknown.eventOutcome);
 const ordinary=freeze(event('onboarding'));
 assert.deepEqual(displayChronicleEvent(ordinary),ordinary);
 const ordinaryHistory=freeze({...historyFor(original,0,0),eventId:'banquet-draw'});
 assert.deepEqual(displayChronicleHistory(ordinaryHistory),ordinaryHistory);
 assert.equal(displayChronicleEvent(null),null);
 assert.equal(displayChronicleHistory(null),null);
});

test('formatting a scene or journal twice is safe and never duplicates the resolved random suffix',()=>{
 const suffix=' 今天的運氣已經結算，請保留這一句。';
 for(const id of ['banquet-welcome','video-pizza-overtime']){
  const original=event(id),shown=freeze(displayChronicleEvent(original));
  assert.deepEqual(displayChronicleEvent(shown),shown,`${id} event is idempotent`);
  for(let index=0;index<original.choices.length;index++){
   const branches=original.choices[index].draw?.outcomes.map((_,i)=>i)||[null];
   for(const branch of branches){
    const history=historyFor(original,index,branch,suffix),displayed=freeze(displayChronicleHistory(history));
    assert.deepEqual(displayChronicleHistory(displayed),displayed,`${id} choice ${index}, branch ${branch}`);
    assert.equal(displayed.result.split(suffix).length,2,'committed suffix appears exactly once');
   }
  }
 }
});
