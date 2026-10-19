import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {EVENT_COPY} from '../dist/copy-edits.js';
import {applyEventCopy} from '../dist/engine-copy.js';
import {createRun,getEvent,applyChoice,advance,canRequestBreak,requestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
import {replayRoute} from './find-routes-v3.mjs';

const choose=(run,index)=>advance(applyChoice(run,index));
const withoutText=value=>{
 if(Array.isArray(value))return value.map(withoutText);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['title','body','wing','text','detail','result','label'].includes(key)).map(([key,entry])=>[key,withoutText(entry)]));
 return value;
};

test('published e4 routes retain their complete state after copy and video expansion',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e4-routes.json',import.meta.url),'utf8'));
 for(const fixture of fixtures){
  const run=replayRun(fixture.roleId,fixture.seed,fixture.actions);
  assert.equal(createHash('sha256').update(JSON.stringify(run)).digest('hex'),fixture.stateSha256,fixture.ending);
  const restored=replayRoute(fixture);
  assert.equal(createHash('sha256').update(JSON.stringify(restored)).digest('hex'),fixture.savedStateSha256,`${fixture.ending} saved`);
  assert.equal(validRun(JSON.parse(JSON.stringify(run))),true);
 }
});

test('copy edits leave mechanics intact, including sparse checks and weighted story outcomes',()=>{
 const id='test-text-only-merge';
 const original={id,title:'原標題',body:'原內文',wing:'原台詞',speaker:'wing',kind:'daily',choices:[
  {text:'原選項',detail:'原提示',result:'原結果',delta:{skill:5,boss:-2},effect:'resume',flags:['evidence'],available:false,check:{chance:.73,success:{result:'原成功',delta:{mood:9},effect:'finishPip'},failure:{result:'原失敗',delta:{mood:-8},effect:'pip_fail'}},draw:{label:'原抽籤',outcomes:[{weight:4,label:'原標籤',result:'原抽籤結果',delta:{cash:7},flags:['archive']},{weight:1,label:'另一標籤',result:'另一結果',delta:{cash:-2}}]}}
 ]};
 const snapshot=structuredClone(original);
 EVENT_COPY[id]={title:'新標題',choices:{0:{text:'新選項',result:'新結果',delta:{skill:999},effect:'forged',check:{chance:1,success:{result:'新成功',delta:{mood:999}}},draw:{label:'新抽籤',outcomes:{0:{label:'新標籤',result:'新抽籤結果',weight:999}}}}}};
 try{
  const copied=applyEventCopy(original,{eventId:id},{});
  assert.equal(copied.title,'新標題');assert.equal(copied.choices[0].text,'新選項');
  assert.equal(copied.choices[0].check.success.result,'新成功');
  assert.equal(copied.choices[0].check.failure.result,'原失敗');
  assert.equal(copied.choices[0].draw.outcomes[0].result,'新抽籤結果');
  assert.equal(copied.choices[0].draw.outcomes[1].result,'另一結果');
  assert.deepEqual(withoutText(copied),withoutText(original));
  assert.deepEqual(original,snapshot);
 }finally{delete EVENT_COPY[id];}
});

test('dynamic copy runs after ability checks and keeps recorded outcomes consistent',()=>{
 const initial=createRun('system','e4-copy-check');
 const cases=['onboarding','education-review','salary-cut','salary-final','crisis-boss','paperwork','crisis-mood','pip-review','pip-passed','promotion-review','self-care','exit-menu','career-exit','final-shortfall'];
 for(const eventId of cases){
  const legacy={...initial,eventId,turn:8,pip:{active:true,remaining:2},breakReturnEventId:EVENTS[0].id,salaryCut:{from:initial.pay,to:Math.max(20,Math.floor(initial.pay*.8)),percent:20,status:'pending'}};
  const modern={...legacy,seed:'e5-copy-check'};
  const before=JSON.stringify(legacy),oldEvent=getEvent(legacy),newEvent=getEvent(modern);
  assert.deepEqual(withoutText(newEvent),withoutText(oldEvent),eventId);
  assert.equal(JSON.stringify(legacy),before);
  assert.ok(!JSON.stringify(newEvent).includes('禾多'),eventId);
  for(let index=0;index<newEvent.choices.length;index++){
   if(newEvent.choices[index].available===false)continue;
   const oldResult=applyChoice(legacy,index),newResult=applyChoice(modern,index);
   assert.deepEqual(newResult.stats,oldResult.stats,`${eventId}:${index}`);
   assert.equal(newResult.rng,oldResult.rng);assert.equal(newResult.pendingEffect,oldResult.pendingEffect);
   assert.deepEqual(newResult.flags,oldResult.flags);assert.equal(newResult.pendingFamily,oldResult.pendingFamily);
  }
 }
});

test('published story copy changes neither choice math nor random-number consumption',()=>{
 const initial=createRun('system','e4-story-copy');
 for(const scene of [...EVENTS,...FANTASY_EVENTS].filter(event=>(event.minRules??0)<=4)){
  const legacy={...initial,eventId:scene.id,turn:4,pip:{active:true,remaining:2},stats:{...initial.stats,mood:80,boss:75,energy:85,cash:70}};
  const modern={...legacy,seed:'e5-story-copy'};
  const oldEvent=getEvent(legacy),newEvent=getEvent(modern);
  assert.deepEqual(withoutText(newEvent),withoutText(oldEvent),scene.id);
  for(let index=0;index<newEvent.choices.length;index++){
   if(newEvent.choices[index].available===false)continue;
   const oldResult=applyChoice(legacy,index),newResult=applyChoice(modern,index);
   assert.deepEqual(newResult.stats,oldResult.stats,`${scene.id}:${index}`);
   assert.equal(newResult.rng,oldResult.rng);
   assert.equal(newResult.pendingEffect,oldResult.pendingEffect);
   assert.equal(newResult.pendingFamily,oldResult.pendingFamily);
   assert.deepEqual(newResult.flags,oldResult.flags);
  }
 }
});

test('resolved checks and story draws record the revised branch text, not the unused base result',()=>{
 const checks=new Set(),draws=new Set();
 for(let i=0;i<80;i++){
  const initial=createRun('system',`e5-revised-branch-${i}`);
  const pip={...initial,eventId:'pip-review',flags:{evidence:2},stats:{...initial.stats,skill:80,boss:60,mood:80}};
  const check=getEvent(pip).choices[0].check;
  const reviewed=applyChoice(pip,0).history.at(-1);
  assert.equal(reviewed.result,check[reviewed.chanceOutcome==='success'?'success':'failure'].result);
  checks.add(reviewed.chanceOutcome);
  const lottery={...initial,eventId:'wing-message-lottery',turn:3,stats:{...initial.stats,mood:80,boss:75,energy:85,cash:70}};
  const event=getEvent(lottery),resolved=applyChoice(lottery,1).history.at(-1);
  const branch=event.choices[1].draw.outcomes.find(outcome=>outcome.label===resolved.eventOutcome.result);
  assert.ok(resolved.result.startsWith(branch.result));
  draws.add(branch.label);
 }
 assert.deepEqual([...checks].sort(),['setback','success']);
 assert.equal(draws.size,getEvent({...createRun('system','e5-branches'),eventId:'wing-message-lottery'}).choices[1].draw.outcomes.length);
});

test('video cohort stays out of older pools and e5 self-care replays naturally',()=>{
 const probe={...EVENTS[0],id:'test-rules5-only',minRules:5,weight:1e12};EVENTS.push(probe);
 try{
  for(const prefix of ['legacy','e1','e2','e3','e4']){
   const initial=createRun('system',`${prefix}-video-pool`);
   const run={...initial,eventId:EVENTS[0].id,turn:2,rank:4,educationReviewed:true,salaryCutOffered:true,stats:{...initial.stats,mood:90,energy:90,boss:90,cash:90}};
   assert.notEqual(choose(run,0).eventId,probe.id);
   assert.notEqual(choose({...run,seen:EVENTS.map(event=>event.id)},0).eventId,probe.id);
   assert.throws(()=>getEvent({...run,eventId:probe.id}),/Unknown event/);
  }
  let workday;
  for(let i=0;i<100;i++){
   const candidate=choose(createRun('system',`e5-video-break-${i}`),0);
   if(canRequestBreak(candidate)){workday=candidate;break;}
  }
  assert.ok(workday);assert.equal(workday.eventId,probe.id);
  const rested=choose(requestBreak(workday),0);
  assert.equal(rested.eventId,probe.id);assert.equal(rested.turn,workday.turn);
  const finished=choose(requestExit(rested),0);
  assert.equal(finished.completed,true);assert.equal(validRun(finished),true);
  assert.deepEqual(replayRun(finished.roleId,finished.seed,finished.actions),finished);
 }finally{EVENTS.pop();}
});
