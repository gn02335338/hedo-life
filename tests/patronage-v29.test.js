import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROLES} from '../dist/roles.js';
import {EVENTS} from '../dist/events.js';
import {GENDER_EVENTS_V29} from '../dist/events-gender-v29.js';
import {SOURCES} from '../dist/public-sources.js';
import {PERSONAS,displayText,replayText} from '../dist/persona.js';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun,jobTitle,STAT_KEYS,requestBreak,canRequestBreak,canRequestCareer,getRageTargets,requestRage,canRequestRage} from '../dist/engine.js';
import {normalizeAbilitiesV18} from '../dist/resources-v18.js';
import {patronageEligibleV29,patronageWorkCountV29} from '../dist/patronage-v29.js';
import {deriveAchievements} from '../dist/achievements.js';
import {simulate,replayRoute} from './find-routes-v3.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>advance(applyChoice(run,index));
const {routes,eventCount,choiceCount}=JSON.parse(readFileSync(new URL('./fixtures/patronage-routes-v29.json',import.meta.url),'utf8'));
const applications=routes.filter(route=>route.kind==='application');
const from=(route,actions=route.actions)=>replayRun(route.roleId,route.seed,actions);
const text=event=>[event.title,event.body,event.wing,...event.choices.flatMap(choice=>[choice.text,choice.result])].join(' ');

test('fictional character gender is seeded, save-safe, approximately balanced and never a penalty to ability dice or initial salary',()=>{
 const seen=new Map([['male',0],['female',0]]);
 for(const role of ROLES)for(let index=0;index<80;index++){
  const seed=`e29-gender-${role.id}-${index}`,run=createRun(role.id,seed);
  assert.deepEqual(createRun(role.id,seed),run);assert.deepEqual(replayRun(role.id,seed,[]),run);
  assert.equal(validRun(copy(run)),true);assert.ok(seen.has(run.characterGender));seen.set(run.characterGender,seen.get(run.characterGender)+1);
  assert.equal(run.patronage,null);assert.equal(run.patronageContext,null);
  const dice=Object.fromEntries(['skill','slack','lick'].map(key=>[key,25+(run.abilityDice[key].reduce((a,b)=>a+b,0)-3)*4]));
  const expected=normalizeAbilitiesV18({...run.stats,...dice});
  for(const key of ['skill','slack','lick'])assert.equal(run.stats[key],expected[key],`${role.id}/${run.characterGender}/${key}`);
  assert.ok(run.offerPay>=role.payRange[0]&&run.offerPay<=role.payRange[1]);
  assert.equal(validRun({...run,characterGender:'invented'}),false);assert.equal(validRun({...run,characterGender:undefined}),false);
  assert.equal(validRun({...run,patronage:{title:'乾兒子',historyIndex:0,fromPay:run.pay,appointedPay:run.pay+9}}),false);
 }
 const count=[...seen.values()].reduce((sum,value)=>sum+value,0);
 assert.ok(seen.get('male')/count>.42&&seen.get('male')/count<.58,JSON.stringify([...seen]));
 for(const cohort of ['legacy','e17','e25','e27','e28']){
  const old=createRun('sales',`${cohort}-gender-contract`);
  assert.equal(Object.hasOwn(old,'characterGender'),false);assert.equal(Object.hasOwn(old,'patronage'),false);assert.equal(Object.hasOwn(old,'patronageContext'),false);
 }
});

test('the 12 gender and protected-colleague stories keep outcomes hidden, include wild choices and retain public provenance',()=>{
 assert.equal(eventCount,12);assert.equal(choiceCount,36);assert.equal(GENDER_EVENTS_V29.length,12);
 for(const event of GENDER_EVENTS_V29){
  assert.ok(EVENTS.includes(event));assert.equal(event.minRules,29);assert.equal(event.choices.length,3);
  assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>SOURCES[id]));assert.ok(event.choices.some(choice=>choice.wild));
  for(const choice of event.choices){
   assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/);
   assert.ok(choice.result.length>15);assert.ok(Object.entries(choice.delta).every(([key,value])=>STAT_KEYS.includes(key)&&Number.isInteger(value)));
  }
 }
});

test('every new scene response has a natural role- and gender-qualified prefix and a complete continuation',()=>{
 const witnesses=routes.filter(route=>route.kind==='scene');assert.equal(witnesses.length,36);
 assert.deepEqual(witnesses.map(route=>route.id).sort(),GENDER_EVENTS_V29.flatMap(event=>event.choices.map((choice,index)=>`${event.id}-choice-${index}`)).sort());
 let boundaries=0;
 for(const route of witnesses){
  const before=from(route,route.beforeActions),event=getEvent(before);assert.equal(event.id,route.eventId);assert.equal(before.characterGender,route.characterGender);
  if(event.requireGender)assert.equal(before.characterGender,event.requireGender);if(event.roles)assert.ok(event.roles.includes(before.actualRoleId));
  const pending=applyChoice(before,route.index),resolved=advance(pending);assert.equal(pending.history.at(-1).choiceIndex,route.index);assert.equal(pending.history.at(-1).eventId,route.eventId);
  assert.deepEqual(from(route),resolved);assert.deepEqual(replayRoute(route,state=>{boundaries++;assert.equal(validRun(state),true,`${route.id}/${state.eventId}`);}),resolved);
  const ended=from(route,route.completionActions);assert.equal(ended.completed,true);assert.equal(ended.endingId,route.endingId);assert.equal(validRun(copy(ended)),true);
 }
 assert.ok(boundaries>400);
});

test('only an actual successful application grants the matching family title and an immediately recorded salary increase',()=>{
 assert.equal(applications.length,10);
 for(const gender of ['male','female'])for(const outcome of ['success','setback','declined']){
  const route=applications.find(row=>row.id===`application-${gender}-${outcome}`);assert.ok(route);
  const before=from(route,route.beforeActions),event=getEvent(before),snapshot=copy(before);
  assert.equal(event.id,'patronage-application');assert.equal(before.characterGender,gender);assert.equal(before.patronage,null);
  assert.ok(event.choices.some(choice=>choice.wild));for(const choice of event.choices)assert.doesNotMatch(choice.text,/成功率|機率|[%％]|[+-]\d+/);
  const pending=applyChoice(before,route.index),row=pending.history.at(-1),resolved=advance(pending);
  assert.deepEqual(before,snapshot);assert.equal(pending.turn,before.turn);assert.deepEqual(pending.pip,before.pip);
  assert.equal(pending.actions.length,before.actions.length+1);assert.equal(applyChoice(pending,route.index),pending);
  if(outcome==='success'){
   const title=gender==='male'?'乾兒子':'乾女兒';assert.equal(row.chanceOutcome,'success');assert.equal(pending.patronage.title,title);assert.equal(resolved.patronage.title,title);
   assert.equal(jobTitle(pending),title);assert.equal(jobTitle(resolved),title);assert.equal(row.jobTitle,title);
   assert.equal(pending.patronage.historyIndex,pending.history.length-1);assert.equal(pending.patronage.fromPay,before.pay);assert.equal(pending.patronage.appointedPay,pending.pay);
   assert.ok(pending.pay>=before.pay+8);assert.equal(pending.pay,Math.min(500,Math.max(before.pay+8,Math.round(before.pay*1.15))));
   assert.equal(row.pay,pending.pay);assert.equal(pending.actualRoleId,before.actualRoleId);assert.equal(pending.rank,before.rank);assert.equal(pending.assignment,before.assignment);
   assert.equal(canRequestCareer(resolved),false,'appointed status cannot simultaneously farm ordinary promotions');
   assert.equal(validRun({...resolved,patronage:{...resolved.patronage,title:gender==='male'?'乾女兒':'乾兒子'}}),false);
   assert.equal(validRun({...resolved,patronage:{...resolved.patronage,historyIndex:0}}),false);
   assert.equal(validRun({...resolved,patronage:{...resolved.patronage,fromPay:1}}),false);
  }else{
   assert.equal(pending.patronage,null);assert.equal(resolved.patronage,null);assert.equal(pending.pay,before.pay);assert.equal(jobTitle(resolved),jobTitle(before));
   assert.equal(row.chanceOutcome,outcome==='declined'?null:'setback');
  }
  assert.equal(resolved.patronageContext,null);assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(resolved)),true);assert.deepEqual(from(route),resolved);
 }
});

test('both formal and absurd application routes have real success and rejection proofs; a manual request closes without a second workday',()=>{
 for(const gender of ['male','female']){
  for(const outcome of ['success','setback']){
   const route=applications.find(row=>row.id===`application-${gender}-wild-${outcome}`);assert.ok(route);
   const before=from(route,route.beforeActions),pending=applyChoice(before,route.index);
   assert.equal(route.index,1);assert.equal(getEvent(before).choices[1].wild,true);assert.equal(pending.history.at(-1).chanceOutcome,outcome);
   assert.equal(Boolean(advance(pending).patronage),outcome==='success');
  }
  const route=routes.find(row=>row.id===`manual-${gender}`);assert.ok(route);
  const before=from(route,route.beforeActions),resolved=from(route);
  assert.equal(before.eventId,'patronage-application');assert.equal(before.patronageContext.origin,'career');
  assert.equal(before.history.at(-1).eventId,'career-review');assert.equal(before.history.at(-1).choiceIndex,4);
  assert.equal(resolved.patronage,null);assert.equal(resolved.patronageContext,null);assert.equal(resolved.turn,before.turn);assert.equal(resolved.rng,before.rng);
  assert.deepEqual(resolved.pip,before.pip);assert.equal(patronageWorkCountV29(resolved),patronageWorkCountV29(before));
  assert.equal(patronageEligibleV29(resolved),false,'declining cannot immediately reopen another appointment offer');
  assert.equal(resolved.flags.patronage_offers,before.flags.patronage_offers);
 }
});

test('appointment survives save/replay and later work really receives its new salary and separate perk ledger',()=>{
 for(const gender of ['male','female']){
  const route=routes.find(row=>row.id===`retention-${gender}`);assert.ok(route);
  const appointed=from(route,route.beforeActions),working=from(route);assert.ok(appointed.patronage);assert.ok(working.patronage);
  assert.equal(jobTitle(working),gender==='male'?'乾兒子':'乾女兒');assert.deepEqual(working.patronage,appointed.patronage);
  const appointmentIndex=appointed.patronage.historyIndex,subsequent=working.history.slice(appointmentIndex+1);
  assert.ok(subsequent.some(row=>['daily','fantasy'].includes(row.kind)));
  assert.ok(subsequent.some(row=>row.breakdown.some(part=>part.source==='patronage-perk')));
  assert.ok(subsequent.some(row=>row.breakdown.some(part=>part.source==='income')));
  for(const row of subsequent.filter(row=>['daily','fantasy'].includes(row.kind))){
   assert.ok(!row.breakdown.some(part=>['career-pressure','assignment'].includes(part.source)));
   const perk=row.breakdown.find(part=>part.source==='patronage-perk');
   if(perk){assert.ok((perk.delta.mood||0)>=0&&(perk.delta.mood||0)<=3);assert.ok((perk.delta.energy||0)>=0&&(perk.delta.energy||0)<=2);}
  }
  for(const row of subsequent.filter(row=>row.breakdown.some(part=>part.source==='income'))){
   const index=working.history.indexOf(row),previousCash=working.history.slice(0,index).reduce((value,part)=>value+part.delta.cash,createRun(route.roleId,route.seed).stats.cash);
   let cash=previousCash;
   for(const part of row.breakdown){
    if(part.source==='income')assert.equal(part.delta.cash,Math.min(100,cash+Math.max(4,Math.round(row.pay/10)))-cash);
    cash+=part.delta.cash||0;
   }
   assert.ok(previousCash>=0);
  }
  assert.equal(validRun(copy(working)),true);assert.deepEqual(replayRoute(route),working);
  assert.equal(from(route,route.completionActions).completed,true);
 }
});

test('women never receive a surprise or manual dark invitation, while the banquet and ordinary dinners still work',()=>{
 let women=0,workdays=0,breaks=0,banquets=0,meals=0;
 const forbid=event=>{assert.notEqual(event.id,'kind-workday');assert.notEqual(event.id,'kind-break');if(event.id==='banquet-afterparty'){banquets++;assert.doesNotMatch(text(event),/暗黑|四手聯彈|鋼琴/);}};
 for(let attempt=0;attempt<25;attempt++)for(const roleId of ['sales','bd','design','hr','admin']){
  const {route}=simulate(roleId,'nasdaq',attempt,{seedPrefix:'e29'});if(createRun(roleId,route.seed).characterGender!=='female')continue;
  women++;
  replayRoute(route,run=>{
   if(run.pending||run.completed)return;const event=getEvent(run);forbid(event);
   if(['daily','fantasy'].includes(event.kind))workdays++;
   if(canRequestBreak(run)){
    const rest=requestBreak(run);breaks++;assert.equal(rest.eventId,'self-care');assert.equal(validRun(copy(rest)),true);forbid(getEvent(rest));
    const meal=getEvent(rest).choices.findIndex(choice=>choice.effect==='mealOpen'&&choice.available!==false);
    if(meal>=0){
     const menu=choose(rest,meal),pick=getEvent(menu).choices.findIndex(choice=>choice.mealTarget==='kind'&&choice.available!==false);
     if(pick>=0){
      const table=choose(menu,pick);assert.equal(table.eventId,'meal-with-kind');assert.doesNotMatch(text(getEvent(table)),/暗黑|四手聯彈|鋼琴/);
      const response=getEvent(table).choices.findIndex(choice=>choice.effect==='mealFinish'&&choice.available!==false);
      if(response>=0){const paid=applyChoice(table,response),returned=advance(paid);meals++;assert.ok(paid.history.at(-1).delta.cash<0);assert.equal(validRun(copy(returned)),true);assert.notEqual(returned.eventId,'kind-workday');}
     }
    }
   }
  });
 }
 assert.ok(women>30);assert.ok(workdays>200);assert.ok(breaks>200);assert.ok(banquets>0);assert.ok(meals>100);
});

test('Rick displays as 瑞克 with 老闆乾兒子 as his role, while published replay wording stays frozen',()=>{
 assert.equal(PERSONAS.rick.name,'瑞克');assert.equal(PERSONAS.rick.title,'老闆乾兒子');
 assert.equal(displayText('Rick接了老闆電話。'),'瑞克接了老闆電話。');
 assert.equal(replayText('Rick接了老闆電話。'),'老闆乾兒子接了老闆電話。');
});

test('the application and two shared Rick conversations permit only their co-present targets before and after a real response',()=>{
 const groups={
  'patronage-application':['wing','hope','rick'],
  'rick29-protected-report':['rick','owen'],
  'rick29-pm-family-tree':['rick','cindy'],
 };
 for(const [eventId,targets]of Object.entries(groups)){
  const route=routes.find(row=>row.eventId===eventId&&row.index===0);assert.ok(route,eventId);
  const before=from(route,route.beforeActions),pending=applyChoice(before,0);
  for(const state of [before,pending]){
   assert.equal(canRequestRage(state),true);assert.deepEqual(getRageTargets(state),targets,eventId);
   for(const target of targets){
    const raging=requestRage(state,target),resolved=advance(raging);
    assert.notEqual(raging,state);assert.equal(raging.rageContext.target,target);assert.equal(raging.turn,state.turn);
    assert.deepEqual(raging.actions.at(-1),{type:'rage',phase:state.pending?'result':'event',eventId,target});
    assert.equal(validRun(copy(raging)),true,`${eventId}/${target}/pending`);assert.equal(validRun(copy(resolved)),true,`${eventId}/${target}/resolved`);
    assert.deepEqual(replayRun(state.roleId,state.seed,raging.actions),resolved);
    if(raging.rageContext.mode==='imagined')assert.deepEqual(resolved.patronage,state.patronage,'dream interruption preserves the appointment result that actually occurred');
   }
   assert.equal(requestRage(state,'sam'),state,'someone merely absent or mentioned elsewhere cannot be targeted');
  }
 }
});

let endingWitnesses;
function contemporaryEnding(id){
 endingWitnesses??=JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url),'utf8')).routes;
 const route=endingWitnesses.find(row=>row.ending===id);assert.ok(route,`natural ending proof ${id}`);assert.match(route.seed,/^e(?:29|30)-/);
 const run=replayRun(route.roleId,route.seed,route.actions);assert.equal(run.endingId,id);assert.equal(validRun(copy(run)),true);return {route,run};
}

test('e29 promotions retain eight-rank meanings and never mistake a senior specialist or a former executive for a newly promoted manager',()=>{
 const {run:senior}=contemporaryEnding('career_senior-system');
 assert.equal(senior.rank,2);assert.ok(senior.flags.promotions>0);assert.equal(senior.flags.career_promoted_peak,2);
 const badges=deriveAchievements(senior);assert.ok(badges.includes('promotion'));assert.ok(!badges.includes('manager'));assert.ok(!badges.includes('director'));
 const {route,run:executive}=contemporaryEnding('career_senior-executive'),initial=createRun(route.roleId,route.seed);
 assert.equal(initial.rank,5);assert.ok(!deriveAchievements(initial).includes('manager'));assert.ok(!deriveAchievements(initial).includes('director'));
 assert.equal(executive.rank,2);assert.equal(executive.flags.career_peak_rank,5);assert.equal(executive.flags.career_promoted_peak,2);assert.ok(executive.flags.promotions>0);
 const after=deriveAchievements(executive);assert.ok(after.includes('promotion'));assert.ok(!after.includes('manager'));assert.ok(!after.includes('director'));
});

test('all eight professional work badges remain attainable from real e29 career duties and completed work',()=>{
 const ranks=['assistant','staff','senior','principal','deputy','manager','director','chief'];
 for(const [rank,name]of ranks.entries()){
  const {route,run}=contemporaryEnding(`career_${name}-system`);
  assert.equal(run.rank,rank);assert.ok((run.flags[`career_work_${rank}`]||0)>=(rank<=1?3:2)||(rank>1&&(run.flags[`career_duty_${rank}`]||0)>0));
  assert.ok(deriveAchievements(run).includes(`rank-${name}-work`),`${name} badge follows real work or duties`);
  assert.deepEqual(replayRoute(route),run);
 }
});

test('e29 natural business and retirement departures still earn all four wealth badges only after the committed response',()=>{
 const wealthIds=['wealth-startup-success','wealth-startup-failure','wealth-goose-chairman','wealth-retired-free'];
 for(const [family,expected]of [['venture_independent',['wealth-startup-success']],['venture_restart',['wealth-startup-failure']],['retired_free',['wealth-retired-free']],['retired_flexible',[]]]){
  const {route,run}=contemporaryEnding(`${family}-system`),last=route.actions.at(-1),before=replayRun(route.roleId,route.seed,route.actions.slice(0,-1));
  assert.ok(['wealth-startup','wealth-retire'].includes(before.eventId));assert.equal(last.eventId,before.eventId);
  assert.deepEqual(deriveAchievements(before).filter(id=>wealthIds.includes(id)),[]);
  const pending=applyChoice(before,last.index);assert.deepEqual(advance(pending),run);
  assert.deepEqual(deriveAchievements(pending).filter(id=>wealthIds.includes(id)),expected,family);
  assert.deepEqual(deriveAchievements(run).filter(id=>wealthIds.includes(id)),expected,family);
  if(family==='retired_free'){
   const goose=applyChoice(before,2),retired=advance(goose);assert.equal(validRun(copy(goose)),true);assert.equal(validRun(copy(retired)),true);
   assert.equal(goose.history.at(-1).eventId,'wealth-retire');assert.equal(goose.history.at(-1).choiceIndex,2);
   assert.deepEqual(deriveAchievements(goose).filter(id=>wealthIds.includes(id)),['wealth-goose-chairman','wealth-retired-free']);
   assert.deepEqual(replayRun(retired.roleId,retired.seed,retired.actions),retired);
  }
 }
});

function naturalThreeDinners(){
 for(let attempt=0;attempt<30;attempt++){
  let run=createRun('sales',`e29-paid-dinners-${attempt}`),paid=0;
  for(let step=0;step<70&&!run.completed;step++){
   if(canRequestBreak(run)&&run.stats.cash>10){
    let rest=requestBreak(run);
    if(rest.eventId==='kind-break')rest=choose(rest,1);
    if(rest.eventId==='self-care'){
     const open=getEvent(rest).choices.findIndex(choice=>choice.effect==='mealOpen'&&choice.available!==false);
     if(open>=0){
      let table=choose(rest,open),guest=getEvent(table).choices.findIndex(choice=>choice.mealTarget==='sonny'&&choice.available!==false);
      if(guest>=0){
       table=choose(table,guest);const response=getEvent(table).choices.findIndex(choice=>choice.effect==='mealFinish'&&choice.available!==false);
       if(response>=0){
        const before=copy(table),pending=applyChoice(table,response);run=advance(pending);paid++;
        if(paid===3)return {before,pending,run};
        continue;
       }
      }
     }
    }
   }
   const event=getEvent(run);
   const preferred=event.id==='patronage-application'?2:event.id==='wealth-plan'?event.choices.findIndex(choice=>choice.effect==='wealthReturn'):null;
   if(preferred!==null&&preferred>=0){run=choose(run,preferred);continue;}
   const options=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
    .map(({index})=>choose(run,index)).sort((a,b)=>{
     const score=candidate=>(candidate.completed?-10000:0)+candidate.stats.mood*2+candidate.stats.energy*1.5+candidate.stats.cash+candidate.stats.boss;
     return score(b)-score(a);
    });
   run=options[0];
  }
 }
 throw new Error('No natural e29 three-dinner proof');
}

test('three paid meals in one natural e29 life still earn self-care, while browsing the third table has not earned it yet',()=>{
 const {before,pending,run}=naturalThreeDinners(),paid=state=>state.history.filter(row=>row.eventId.startsWith('meal-with-')&&row.delta.cash<0);
 assert.equal(paid(before).length,2);assert.ok(!deriveAchievements(before).includes('self-care'));
 assert.equal(paid(pending).length,3);assert.ok(deriveAchievements(pending).includes('self-care'));assert.ok(deriveAchievements(run).includes('self-care'));
 assert.equal(before.eventId,'meal-with-sonny');assert.equal(pending.stats.cash,before.stats.cash-10);
 assert.equal(validRun(copy(before)),true);assert.equal(validRun(copy(pending)),true);assert.equal(validRun(copy(run)),true);
 assert.deepEqual(replayRun(run.roleId,run.seed,run.actions),run);
});
