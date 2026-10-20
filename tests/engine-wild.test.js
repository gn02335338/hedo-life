import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer} from '../dist/engine.js';
import {applyWildOptions} from '../dist/wild-options.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const displayKeys=new Set(['text','detail','result','label','title','body','wing','choiceText','wild']);
function mechanics(value){
 if(Array.isArray(value))return value.map(mechanics);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!displayKeys.has(key)&&key!=='seed').map(([key,item])=>[key,mechanics(item)]));
 return value;
}
function assertWild(event,original){
 assert.equal(event.choices.length,original.choices.length,`${event.id}: choice count`);
 assert.deepEqual(mechanics(event),mechanics(original),`${event.id}: mechanics changed`);
 const wild=event.choices.filter(choice=>choice.wild&&choice.available!==false);
 assert.ok(wild.length>=1,`${event.id}: at least one available wild option`);
 for(const choice of wild){
  assert.ok(choice.text.trim().length>=8,`${event.id}: authored option text`);
  const index=event.choices.indexOf(choice),previous=original.choices[index];
  assert.notEqual(choice.text,previous.text,`${event.id}: wild option replaces copy`);
  if(choice.check)for(const branch of ['success','failure']){
   assert.ok(choice.check[branch].result.trim().length>=8,`${event.id}: complete ${branch} result`);
   assert.notEqual(choice.check[branch].result,previous.check[branch].result,`${event.id}: authored ${branch} result`);
  }
  else if(choice.draw)for(const [index,outcome]of choice.draw.outcomes.entries()){
   assert.ok(outcome.result.trim().length>=8,`${event.id}: complete draw result ${index}`);
   assert.notEqual(outcome.result,previous.draw.outcomes[index].result,`${event.id}: authored draw result ${index}`);
  }
  else assert.ok(choice.result.trim().length>=8,`${event.id}: complete result`);
 }
}

test('e12 has authored wild options for all 205 daily and four fantasy scenes without changing mechanics',()=>{
 assert.equal(EVENTS.length,205);assert.equal(FANTASY_EVENTS.length,4);
 const run=createRun('system','e12-wild-coverage');
 for(const source of [...EVENTS,...FANTASY_EVENTS]){
  const original=copy(source),next=applyWildOptions(source,{...run,eventId:source.id});
  assertWild(next,original);assert.deepEqual(source,original,`${source.id}: no shared-catalog mutation`);
 }
});

test('the wild copy layer leaves every published cohort untouched',()=>{
 for(const seed of ['original-run','e1-wild-old','e5-wild-old','e8-wild-old','e9-wild-old','e10-wild-old','e11-wild-old']){
  const run=createRun('system',seed),source=copy(EVENTS[0]);
  assert.deepEqual(applyWildOptions(source,run),source,seed);
 }
});

test('natural e11 checkpoint decisions keep the same mechanics and RNG under the e12 copy layer',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e11-routes.json',import.meta.url),'utf8'));
 let comparisons=0,seen=new Set();
 for(const route of fixtures){
  let previous=createRun(route.roleId,route.seed);
  for(const action of route.actions){
   if(action.type==='exit')previous=requestExit(previous);
   else if(action.type==='break')previous=requestBreak(previous);
   else if(action.type==='career')previous=requestCareer(previous);
   else{
    const modern={...copy(previous),seed:previous.seed.replace(/^e11-/,'e12-')};
    const oldEvent=getEvent(previous),newEvent=getEvent(modern);
    assertWild(newEvent,oldEvent);seen.add(newEvent.id);
    for(const [index,choice]of oldEvent.choices.entries())if(choice.available!==false){
     const oldAfter=applyChoice(previous,index),newAfter=applyChoice(modern,index);
     assert.deepEqual(mechanics(newAfter),mechanics(oldAfter),`${route.seed}/${oldEvent.id}/${index}: choice mechanics`);
     assert.deepEqual(mechanics(advance(newAfter)),mechanics(advance(oldAfter)),`${route.seed}/${oldEvent.id}/${index}: continuation mechanics`);
     comparisons++;
    }
    previous=advance(applyChoice(previous,action.index));
   }
  }
 }
 assert.ok(comparisons>300,`${comparisons} cross-cohort decisions`);
 for(const eventId of ['onboarding','education-scrutiny','salary-cut','crisis-boss','pip-review','career-review'])assert.ok(seen.has(eventId),`natural coverage: ${eventId}`);
});

test('dynamic notices, PIP, spending and career menus retain an available wild choice at constrained boundaries',()=>{
 const ids=['onboarding','education-review','education-scrutiny','salary-cut','salary-final','crisis-boss','paperwork','crisis-mood','pip-review','pip-passed','promotion-review','kind-break','kind-workday','self-care','exit-menu','career-exit','final-shortfall','career-review','career-duty-1','career-duty-2','career-duty-3','career-duty-4','rank-exit','career-step-down','story-exit'];
 const initial=createRun('system','e11-wild-dynamic');
 for(const id of ids)for(const cash of [0,6,12,20,100])for(const assignment of ['honest','assistant','swapped']){
  const duty=/^career-duty-(\d)$/.exec(id),rank=duty?Number(duty[1]):assignment==='assistant'?0:2;
  const old={...copy(initial),eventId:id,rank,assignment,turn:id==='crisis-boss'||id==='paperwork'?23:8,lastPromotion:1,resumeEventId:null,exitReturnEventId:EVENTS[0].id,breakReturnEventId:EVENTS[0].id,salaryCut:{from:90,to:60,reason:'education'},stats:Object.fromEntries(Object.keys(initial.stats).map(key=>[key,key==='cash'?cash:90])),flags:{...initial.flags,career_service:8,education_case_active:1,education_dispute:15,archive:4,promotions:1,evidence:4}};
  const modern={...copy(old),seed:'e12-wild-dynamic'};
  const oldEvent=getEvent(old),newEvent=getEvent(modern);assertWild(newEvent,oldEvent);
  assert.deepEqual(mechanics(newEvent),mechanics(oldEvent),`${id}/${cash}/${assignment}`);
 }
});
