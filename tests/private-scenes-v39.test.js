import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,requestBreak,canRequestBreak,requestVerbal,canRequestVerbal,getVerbalLine,getVerbalTargets,requestRage,canRequestRage,getRageTargets,replayRun,validRun} from '../dist/engine.js';
import {isPrivateSceneV39,getPrivateRageV39,getPrivateVerbalScenarioV39} from '../dist/private-scenes-v39.js';
import {MEAL_GUEST_IDS_V39} from '../dist/meals-cast-v39.js';
import {replayRoute,simulate} from './find-routes-v3.mjs';

const choose=(run,index)=>advance(applyChoice(run,index));
const clone=value=>JSON.parse(JSON.stringify(value));
const effect=(run,id)=>{const index=getEvent(run).choices.findIndex(choice=>choice.effect===id&&choice.available!==false);assert.ok(index>=0,`${run.eventId}/${id}`);return choose(run,index);};
const checked=run=>{assert.equal(validRun(clone(run)),true,`${run.seed}/${run.eventId}/${run.pending}`);return run;};
const noEmploymentChange=(run,source)=>{
 assert.equal(run.completed,false);assert.equal(run.pendingFamily,null);assert.equal(run.chapterContext,null);
 const originalTurn=source.pending&&['daily','fantasy'].includes(getEvent(source).kind)?1:0;
 assert.equal(run.turn,source.turn+originalTurn,'only an already committed daily source can finish its original scheduled turn');assert.deepEqual(run.pip,source.pip,'a private aftermath does not consume another PIP day');
 assert.equal(run.pipCount,source.pipCount);assert.equal(run.pay,source.pay);assert.equal(run.stats.boss,source.stats.boss,'a private disagreement does not change Wing mood');
 assert.equal(run.flags.departure38_voluntary,undefined);assert.equal(run.personnelPending,null);
 assert.ok(!['dismissal-final','crisis-boss','floor-notice','paperwork','pip-plan','chapter-resolution'].includes(run.eventId));
};

// Every source below comes from public actions. No stat, RNG, history, PIP or
// context value is injected to make a private branch happen.
const sources=[],keys=new Set(),mealGuests=new Set(),mealCounts=new Map(),realPaid=new Set();
const add=run=>{if(!isPrivateSceneV39(getEvent(run)))return;const key=`${run.eventId}/${run.pending}/${run.seed}`;if(keys.has(key))return;keys.add(key);sources.push(run);};
const privateDailyIds=['cast39-janet-wine-club-agenda','cast39-captain-lunch-route','cast39-captain-late-dinner'],privateDailies=new Map();
const addDaily=run=>{
 if(run.pending||!privateDailyIds.includes(run.eventId)||privateDailies.has(run.eventId))return;
 privateDailies.set(run.eventId,run);add(run);const pending=applyChoice(run,2);if(!pending.pendingFamily&&pending.stats.mood>0&&pending.stats.energy>0)add(pending);
};
for(let i=0;i<130;i++){
 let run=choose(createRun('sales',`e39-private-proof-${i}`),0);addDaily(run);if(!canRequestBreak(run))continue;
 run=requestBreak(run);if(run.eventId==='kind-break'){add(run);add(applyChoice(run,0));run=choose(run,1);}
 if(run.eventId!=='self-care')continue;
 if(i<10){add(run);add(applyChoice(run,0));}
 run=effect(run,'mealOpen');
 for(let page=0;page<3;page++){
  if(i<3)add(run);
  const event=getEvent(run);
  for(let index=0;index<event.choices.length;index++){
   const choice=event.choices[index];if(!choice.mealTarget||choice.available===false||(mealCounts.get(choice.mealTarget)||0)>=3&&realPaid.has(choice.mealTarget))continue;
   const pending=applyChoice(run,index),meal=advance(pending);
   if(meal.eventId!==`meal-with-${choice.mealTarget}`)continue;
   const paid=applyChoice(meal,0),real=canRequestRage(paid)&&requestRage(paid).rageContext?.mode==='real';
   if((mealCounts.get(choice.mealTarget)||0)>=3&&!real)continue;
   mealGuests.add(choice.mealTarget);mealCounts.set(choice.mealTarget,(mealCounts.get(choice.mealTarget)||0)+1);if(real)realPaid.add(choice.mealTarget);add(pending);add(meal);add(paid);
  }
  if(page<2){const index=event.choices.findIndex(choice=>choice.effect==='mealPage'&&choice.mealPage===page+1);assert.ok(index>=0);run=choose(run,index);}
 }
}
const company=JSON.parse(readFileSync(new URL('./fixtures/company-e39-routes.json',import.meta.url),'utf8'));
const extra=new Set();
for(const route of company.routes){
 replayRoute(route,state=>{addDaily(state);if(['kind-workday','banquet-afterparty'].includes(state.eventId)){const key=`${state.eventId}/${state.pending}`;if(!extra.has(key)){extra.add(key);add(state);}}});
 if(extra.size===4&&privateDailies.size===3)break;
}
let pipSources=0;
for(let i=0;i<80&&pipSources<6;i++){
 const {route}=simulate('sales','pip_fail',i,{seedPrefix:'e39'});
 replayRoute(route,state=>{if(pipSources>=6||!state.pip?.active||!canRequestBreak(state))return;const menu=requestBreak(state);add(menu);pipSources++;});
}

test('private classification covers real invitations, meals and afterparties without classifying ordinary workplace conversations',()=>{
 assert.deepEqual(mealGuests,new Set(MEAL_GUEST_IDS_V39),'all twenty-two guests have naturally accepted an invitation');
 for(const id of ['kind-break','kind-workday','banquet-afterparty','self-care','meal-guests-a','meal-guests-b','meal-guests-c'])assert.ok(sources.some(run=>run.eventId===id),id);
 assert.ok(sources.length>100);
 assert.deepEqual(new Set(privateDailies.keys()),new Set(privateDailyIds),'new private daily scenes use actual natural sources');
 assert.ok(pipSources>0,'private interruptions also cover real active PIP lives');
 for(const run of sources){checked(run);assert.equal(getEvent(run).scope,'private');assert.equal(isPrivateSceneV39(getEvent(run)),true);}
 assert.equal(isPrivateSceneV39(getEvent(createRun('sales','e39-private-classifier'))),false);
 assert.equal(isPrivateSceneV39({id:'ordinary-work',speaker:'kind'}),false,'a person is not automatically a private context');
 assert.equal(isPrivateSceneV39({id:'ordinary-work',title:'今晚開會喝咖啡'}),false,'loose keywords do not change employment semantics');
 assert.equal(isPrivateSceneV39(null),false);
});

test('private verbal results vary but never escalate to HR or terminate employment, including paid-choice interruptions',()=>{
 const kinds=new Set(),origins=new Set();let legal=0;
 for(const source of sources){
  if(!canRequestVerbal(source))continue;
  const before=JSON.stringify(source),line=getVerbalLine(source);assert.equal(JSON.stringify(source),before,'a preview draws nothing');
  assert.equal(requestVerbal(source),source,'the published legacy workplace v1 protocol cannot be used to create a private HR incident');
  let run=checked(requestVerbal(source,undefined,2));assert.notEqual(run,source);assert.equal(run.verbalContext.line,line);
  assert.equal(run.verbalContext.phase,source.pending?'result':'event');assert.equal(run.pendingFamily,null);
  kinds.add(run.verbalContext.outcome);origins.add(source.eventId);assert.notEqual(run.verbalContext.outcome,'personnel');
  run=checked(advance(run));
  if(run.verbalContext){
   assert.equal(run.verbalContext.stage,'legal');legal++;
   for(let index=0;index<getEvent(run).choices.length;index++){
    let result=checked(applyChoice(run,index));result=checked(advance(result));assert.equal(result.verbalContext.stage,'legal-result');
    result=checked(choose(result,0));assert.equal(result.verbalContext,null);noEmploymentChange(result,source);
    assert.equal(result.stats.cash,source.stats.cash);assert.deepEqual(replayRun(result.roleId,result.seed,result.actions),result);
   }
   run=checked(choose(choose(run,1),0));
  }
  assert.equal(run.verbalContext,null);noEmploymentChange(run,source);assert.equal(run.stats.cash,source.stats.cash,'the original payment is neither charged twice nor refunded');
  if(source.pending&&!['daily','fantasy'].includes(getEvent(source).kind))assert.equal(run.eventId,advance(source).eventId,'the exact committed source transition resumes once');
  if(!source.pending&&privateDailyIds.includes(source.eventId))assert.equal(run.eventId,source.eventId,'an unchosen private daily source stays available');
  assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);assert.equal(JSON.stringify(source),before);
 }
 assert.deepEqual(kinds,new Set(['ignored','relationship','retort','support','legal']));assert.ok(legal>0);
 assert.ok(origins.has('kind-break')&&origins.has('kind-workday')&&origins.has('banquet-afterparty'));
});

test('private imagined and actual hits have different personal consequences while both preserve job, PIP clock and committed expenses',()=>{
 let real=0,imagined=0;const branches=new Set(),paidGuests=new Set();
 for(const source of sources){
  if(!canRequestRage(source))continue;
  const before=JSON.stringify(source),pending=checked(requestRage(source));assert.notEqual(pending,source);
  assert.equal(pending.rageContext.phase,source.pending?'result':'event');assert.equal(pending.pendingFamily,null);
  const first=checked(advance(pending));
  if(!first.rageContext){
   imagined++;noEmploymentChange(first,source);assert.equal(first.stats.cash,source.stats.cash);
   assert.deepEqual(replayRun(first.roleId,first.seed,first.actions),first);
   if(source.pending&&!['daily','fantasy'].includes(getEvent(source).kind))assert.equal(first.eventId,advance(source).eventId);
  }else{
   real++;assert.equal(first.eventId,'rage-aftermath');
   for(let path=0;path<3;path++){
    const branch=checked(choose(first,path));branches.add(branch.eventId);assert.equal(getEvent(branch).scope,'private');
    for(let index=0;index<getEvent(branch).choices.length;index++){
     const choice=getEvent(branch).choices[index];if(choice.available===false)continue;
     const result=checked(choose(branch,index));assert.equal(result.rageContext,null);noEmploymentChange(result,source);
     assert.equal(result.stats.cash,source.stats.cash+(choice.delta.cash||0),'only the explicitly chosen personal bill can add another payment');
     if(source.pending){if(!['daily','fantasy'].includes(getEvent(source).kind))assert.equal(result.eventId,advance(source).eventId);if(source.eventId.startsWith('meal-with-'))paidGuests.add(source.eventId.slice(10));}
     if(!source.pending&&privateDailyIds.includes(source.eventId))assert.equal(result.eventId,source.eventId);
     assert.deepEqual(replayRun(result.roleId,result.seed,result.actions),result);
     assert.ok(result.flags.private39_resolved);
    }
   }
  }
  assert.equal(JSON.stringify(source),before);
 }
 assert.ok(real>10&&imagined>10);assert.deepEqual(branches,new Set(['rage-legal','rage-showdown','rage-public']));assert.ok(paidGuests.size>3,`real paid guests: ${[...paidGuests].join(',')}; real ${real}, imagined ${imagined}`);
});

test('personal aftermath factories preserve a last resource point instead of quietly converting an argument into a work-exhaustion finale',()=>{
 const source=sources.find(run=>run.eventId==='kind-break'&&!run.pending),started=requestRage(source);
 const run={...started,eventId:'rage-showdown',stats:{...started.stats,cash:1,mood:1,energy:1}};
 const event=getPrivateRageV39(run);assert.equal(event.choices[0].available,false);
 for(const choice of event.choices)for(const key of ['cash','mood','energy'])assert.ok(run.stats[key]+(choice.delta[key]||0)>=1);
 const verbal=requestVerbal(source,undefined,2),low={...verbal,stats:{...verbal.stats,cash:1,mood:1,energy:1}};
 for(const choice of getPrivateVerbalScenarioV39(low,getEvent(source)).choices)for(const outcome of choice.draw?.outcomes||[])for(const key of ['cash','mood','energy'])assert.ok(low.stats[key]+(outcome.delta[key]||0)>=1);
});

test('a private wine-club conversation stays personal for either co-present target, including Wing, before or after the original answer',()=>{
 const invitation=privateDailies.get('cast39-janet-wine-club-agenda');
 assert.deepEqual(new Set(getRageTargets(invitation)),new Set(['janet','wing']));assert.deepEqual(new Set(getVerbalTargets(invitation)),new Set(['janet','wing']));
 for(const source of [invitation,applyChoice(invitation,2)])for(const target of ['janet','wing'])for(const type of ['verbal','rage']){
  let run=type==='verbal'?requestVerbal(source,target,2):requestRage(source,target);checked(run);
  run=checked(advance(run));
  for(let step=0;step<6&&(run.verbalContext||run.rageContext);step++)run=checked(choose(run,0));
  assert.equal(run.verbalContext,null);assert.equal(run.rageContext,null);noEmploymentChange(run,source);
  assert.equal(run.history.filter(row=>row.eventId===invitation.eventId&&row.kind==='daily').length,source.history.filter(row=>row.eventId===invitation.eventId&&row.kind==='daily').length,'a side conversation never re-applies the original answer');
  if(!source.pending)assert.equal(run.eventId,source.eventId);
  assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
 }
});

test('private-only rewrites do not remove workplace consequences from a public onboarding outburst',()=>{
 const kinds=new Set();
 for(let i=0;i<180;i++){
  const source=createRun('sales',`e39-public-proof-${i}`);assert.equal(getEvent(source).scope,undefined);
  const pending=requestVerbal(source,undefined,2);kinds.add(pending.verbalContext.outcome);checked(pending);
 }
 assert.ok(kinds.has('personnel'));assert.ok(kinds.has('ignored')||kinds.has('relationship'));
});
