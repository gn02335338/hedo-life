import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ROLES} from '../dist/roles.js';
import {createRun,getEvent,applyChoice,advance,requestExit,requestBreak,requestCareer,requestRage,canRequestRage,validRun,replayRun,STAT_KEYS} from '../dist/engine.js';
import {ACHIEVEMENTS,deriveAchievements} from '../dist/achievements.js';
const copy=value=>JSON.parse(JSON.stringify(value));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sum=stats=>stats.skill+stats.slack+stats.lick;

test('all 314 e17 endings and direct rage modes retain 13197 direct and JSON checkpoints',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e17-routes.json',import.meta.url)));assert.equal(fixtures.length,318);let count=0;
 for(const route of fixtures)for(const saved of [false,true]){
  let run=createRun(route.roleId,route.seed),hashes=[];
  const check=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,route.seed+'/'+run.eventId);hashes.push(hash(run));};check();
  for(let index=0;index<route.actions.length;index++){
   const action=route.actions[index];
   if(action.type==='exit')run=requestExit(run);else if(action.type==='break')run=requestBreak(run);else if(action.type==='career')run=requestCareer(run);
   else if(action.type==='rage'){run=requestRage(run);check();run=advance(run);}
   else{run=applyChoice(run,action.index);check();if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);}
   check();
  }
  assert.deepEqual(hashes,saved?route.savedCheckpoints:route.directCheckpoints,route.ending);
  assert.equal(hash(run),saved?route.savedStateSha256:route.stateSha256,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);if(!saved)count+=hashes.length;
 }
 assert.equal(count,13197);
});

test('all 314 e18 endings and direct rage modes retain 14261 direct and JSON checkpoints',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./fixtures/legacy-e18-routes.json',import.meta.url)));assert.equal(fixtures.length,318);let count=0;
 for(const route of fixtures)for(const saved of [false,true]){
  let run=createRun(route.roleId,route.seed),hashes=[];
  const check=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,route.seed+'/'+run.eventId);hashes.push(hash(run));};check();
  for(let index=0;index<route.actions.length;index++){
   const action=route.actions[index];
   if(action.type==='exit')run=requestExit(run);else if(action.type==='break')run=requestBreak(run);else if(action.type==='career')run=requestCareer(run);
   else if(action.type==='rage'){run=requestRage(run);check();run=advance(run);}
   else{run=applyChoice(run,action.index);check();if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);}
   check();
  }
  assert.deepEqual(hashes,saved?route.savedCheckpoints:route.directCheckpoints,route.ending);
  assert.equal(hash(run),saved?route.savedStateSha256:route.stateSha256,route.ending);
  assert.deepEqual(replayRun(route.roleId,route.seed,route.actions),run);if(!saved)count+=hashes.length;
 }
 assert.equal(count,14261);
});

test('new ability rolls and resolved gains obey the shared budget and record real tradeoffs',()=>{
 for(const role of ROLES.filter(role=>(role.minRules||1)<28))for(let index=0;index<80;index++){
  const run=createRun(role.id,`e18-triad-${index}`);assert.ok(sum(run.stats)<=180);assert.equal(validRun(copy(run)),true);
  const pending=applyChoice(run,0);assert.ok(sum(pending.stats)<=180);assert.equal(validRun(copy(pending)),true);
  const gain=Object.entries(pending.stats).filter(([key,value])=>['skill','slack','lick'].includes(key)&&value>run.stats[key]);assert.ok(gain.length<=1);
  if(gain.length){const [focus,value]=gain[0],cost=Math.ceil((value-run.stats[focus])*.5);for(const key of ['skill','slack','lick'])if(key!==focus)assert.ok(pending.stats[key]<=Math.max(0,run.stats[key]-cost));}
  const last=pending.history.at(-1);for(const key of STAT_KEYS)assert.equal(last.breakdown.reduce((total,row)=>total+(row.delta[key]||0),0),last.delta[key],key);
 }
});

function collapse(){
 let run=createRun('system','e18-collapse-boundary');run={...run,eventId:'jack-notebook',stats:{...run.stats,mood:1,energy:85,cash:60,boss:65}};
 return {initial:run,pending:applyChoice(run,0),collapsed:advance(applyChoice(run,0))};
}
test('zero mood triggers an actual collapse once and every recovery preserves workday and PIP',()=>{
 const {initial,pending,collapsed}=collapse();assert.equal(pending.stats.mood,0);assert.equal(collapsed.eventId,'mood-collapse');assert.equal(collapsed.flags.mood_crash_count,1);assert.equal(validRun(copy(collapsed)),true);
 for(const zero of [pending,collapsed]){assert.equal(canRequestRage(zero),false);assert.equal(requestRage(zero),zero);}
 assert.ok(getEvent(collapsed).body.includes('不是腦內劇場'));assert.equal(advance(collapsed),collapsed);assert.equal(requestExit(collapsed),collapsed);
 for(const index of [0,1]){
  const pip={...copy(collapsed),pip:{active:true,remaining:2},pipCount:1},resolved=advance(applyChoice(pip,index));
  assert.notEqual(resolved.eventId,'mood-collapse');assert.equal(resolved.meltdownReturnEventId,null);assert.equal(resolved.turn,pip.turn);assert.deepEqual(resolved.pip,pip.pip);assert.equal(validRun(copy(resolved)),true);
  if(index===0){assert.equal(resolved.stats.cash,pip.stats.cash-18);assert.ok(resolved.stats.mood>=50);}
  else{assert.equal(resolved.pay,Math.round(pip.pay*.9));assert.equal(resolved.stats.cash,pip.stats.cash);}
 }
 assert.equal(initial.turn+1,collapsed.turn);assert.equal(validRun({...collapsed,meltdownReturnEventId:'invented'}),false);
 const quit=advance(applyChoice(collapsed,2));assert.equal(quit.completed,true);assert.equal(quit.endingId,'ragequit-system');assert.equal(quit.meltdownReturnEventId,null);
});

test('seven cash uses have different real effects, reject unaffordable choices and count actual expenses',()=>{
 const run={...createRun('system','e18-spend'),eventId:'self-care',breakReturnEventId:'jack-notebook',stats:{energy:30,cash:80,trust:40,dream:40,boss:65,mood:25,skill:60,slack:45,lick:40}};
 const event=getEvent(run);assert.equal(event.choices.length,8);
 for(let index=0;index<7;index++){
  const pending=applyChoice(run,index),done=advance(pending);assert.equal(validRun(copy(done)),true);assert.equal(done.eventId,'jack-notebook');assert.equal(done.turn,run.turn);
  assert.equal(pending.flags.cash_spent_total,run.stats.cash-pending.stats.cash);assert.ok(pending.flags.cash_spent_total>0);assert.ok(sum(done.stats)<=180);
 }
 const poor={...run,stats:{...run.stats,cash:7}};for(let index=0;index<7;index++)assert.throws(()=>applyChoice(poor,index));
 const left=advance(applyChoice(poor,7));assert.equal(left.stats.cash,7);assert.equal(left.flags.cash_spent_total,undefined);assert.equal(left.flags.resource_friction_count,undefined);
});

test('legacy e18 natural witnesses remain authoritative, bounded, and compatible with the expanded collection',()=>{
 assert.equal(ACHIEVEMENTS.length,250);const report={routes:JSON.parse(readFileSync(new URL('./fixtures/legacy-e18-routes.json',import.meta.url))).filter(route=>!route.ending.startsWith('feature-'))};assert.equal(report.routes.length,314);
 for(const route of report.routes){assert.ok(route.seed.startsWith('e18-'));const run=replayRun(route.roleId,route.seed,route.actions);assert.equal(run.endingId,route.ending);assert.equal(validRun(copy(run)),true);assert.ok(sum(run.stats)<=180);assert.ok(deriveAchievements(run).every(id=>ACHIEVEMENTS.some(item=>item.id===id)));}
});
