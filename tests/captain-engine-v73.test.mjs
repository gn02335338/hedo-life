import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {characterAffinity,deriveCharacterStats} from '../dist/character-stats.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/captain-voyage-v73.json',import.meta.url),'utf8'));
const source=(f=fixture)=>E.replayRun(f.roleId,f.seed,f.actions);
const canonical=run=>{assert.equal(E.validRun(run),true,`${run.eventId} pending=${run.pending} ${run.pendingEffect}`);if(!run.pending)assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run);return run;};
const choose=(run,index=0)=>E.advance(canonical(E.applyChoice(run,index)));
const stages=f=>{let run=source(f),rows=[];for(let step=0;step<4&&run.captainVoyageContext;step++){rows.push(run);run=choose(run);}return rows;};
function settlePrivate(run){
 for(let step=0;step<10&&(run.rageContext||run.verbalContext);step++){
  canonical(run);run=run.pending?E.advance(run):choose(run,0);
 }
 assert.ok(!run.rageContext&&!run.verbalContext,'personal aftermath must finish');return canonical(run);
}

test('a real male life reaches a single captain invitation through paid meals and work, with no stat or RNG injection',()=>{
 const run=canonical(source()),affinity=characterAffinity(run,'captain'),stats=deriveCharacterStats(run).find(p=>p.id==='captain');
 assert.equal(run.characterGender,'male');assert.ok(affinity.score>=70);assert.ok(stats.encounters>=2);
 assert.equal(run.eventId,fixture.expected.eventId);assert.equal(run.turn,fixture.expected.turn);assert.equal(run.flags.captain73_offered,1);
 assert.equal(run.captainVoyageContext.stage,0);assert.equal(new Set(run.captainVoyageContext.episodes).size,2);assert.equal(run.pending,false);
 assert.ok(run.history.some(row=>row.mealOutcome?.target==='captain'));
});

test('declining and completing the voyage preserve the paused job, pay, workday and PIP accounting',()=>{
 const start=source(),origin=start.captainVoyageContext.returnEventId;
 const declined=canonical(choose(start,1));assert.equal(declined.captainVoyageContext,null);assert.equal(declined.flags.captain73_joined,0);assert.equal(declined.flags.captain73_done,1);
 assert.equal(declined.eventId,origin);assert.equal(declined.turn,start.turn);assert.equal(declined.pay,start.pay);assert.deepEqual(declined.pip,start.pip);assert.equal(declined.completed,false);
 let run=start;for(let step=0;step<4;step++)run=canonical(choose(run));
 assert.equal(run.captainVoyageContext,null);assert.equal(run.flags.captain73_done,1);assert.equal(run.flags.captain73_joined,1);
 assert.equal(run.turn,start.turn);assert.equal(run.pay,start.pay);assert.equal(run.stats.boss,start.stats.boss);assert.equal(run.eventId,origin);assert.deepEqual(run.pip,start.pip);
 assert.equal(run.history.filter(row=>row.kind==='captain-voyage').length,4);
 const after=canonical(choose(run));assert.equal(after.flags.captain73_offered,1);assert.equal(after.captainVoyageContext,null,'later work must not offer a second voyage');
});

test('directly leaving either the invitation or an underway voyage closes the private trip rather than employment',()=>{
 for(const start of [source(),choose(source())]){
  const origin=start.captainVoyageContext.returnEventId,descriptor=E.getEventDepartureV63(start);assert.equal(descriptor.available,true);assert.match(descriptor.label,/下船/);
  const pending=canonical(E.requestEventDepartureV63(start));assert.equal(pending.history.at(-1).departureOutcome.category,'captain-voyage');assert.equal(E.getEvent(pending).scope,'private');
  const out=canonical(E.advance(pending));assert.equal(out.eventId,origin);assert.equal(out.turn,start.turn);assert.equal(out.pay,start.pay);assert.equal(out.completed,false);assert.equal(out.captainVoyageContext,null);assert.equal(out.flags.captain73_joined,0);assert.equal(out.flags.captain73_done,1);
 }
});

test('a voyage excludes unrelated menus while retaining contextual private rage and spoken responses',()=>{
 const run=source();for(const fn of ['canRequestBreak','canRequestCareer','canRequestRaise','canRequestSalaryAdvice','canRequestPatronageReply','canRequestHiddenEncounter','canRequestActivityInvitation'])assert.equal(E[fn](run),false,fn);
 assert.equal(E.requestExit(run),run);assert.equal(E.canRequestRage(run),true);assert.equal(E.canRequestVerbal(run),true);
 assert.deepEqual(E.getRageTargets(run),['captain']);assert.deepEqual(E.getVerbalTargets(run),['captain']);
 assert.equal(E.getVerbalLine(run),E.getEvent(run).verbalLinesV73[0]);
});

test('imagined and actual private blows each complete their own aftermath without firing the player',()=>{
 const found=new Set();for(const state of stages()){
  const pending=canonical(E.requestRage(state)),mode=pending.rageContext.mode;if(found.has(mode))continue;found.add(mode);
  const out=settlePrivate(pending);assert.equal(out.turn,state.turn);assert.equal(out.pay,state.pay);assert.equal(out.stats.boss,state.stats.boss);assert.equal(out.completed,false);assert.equal(out.captainVoyageContext,null);assert.equal(out.flags.captain73_joined,0);
  if(mode==='real')assert.ok(out.history.some(row=>row.eventId==='rage-legal'));
 }
 assert.deepEqual([...found].sort(),['imagined','real']);
});

test('result-phase rage and verbal reactions resume the committed voyage choice exactly once',()=>{
 for(const action of ['rage','verbal']){
  const start=source(),pending=canonical(E.applyChoice(start,0)),before=pending.history.length;
  const interrupted=canonical(action==='rage'?E.requestRage(pending):E.requestVerbal(pending,undefined,2));
  const out=settlePrivate(interrupted);assert.equal(out.captainVoyageContext?.stage,1);assert.equal(out.turn,start.turn);assert.equal(out.pay,start.pay);assert.equal(out.completed,false);
  assert.equal(out.history.filter(row=>row.kind==='captain-voyage'&&row.captainVoyageOutcome.stage===0).length,1);assert.ok(out.history.length>before);assert.equal(out.captainVoyageContext.pendingStep,undefined);
  const next=canonical(choose(out));assert.equal(next.captainVoyageContext?.stage,2);
 }
});

test('natural legal-outburst and group-target witnesses keep the captain story private and replayable',()=>{
 const samples=[fixture,...fixture.alternates||[]];let legal=false,group=false;
 for(const f of samples)for(const state of stages(f)){
  if(E.getRageTargets(state).length===2){
   group=true;assert.deepEqual(new Set(E.getRageTargets(state)),new Set(['jack','captain']));assert.deepEqual(new Set(E.getVerbalTargets(state)),new Set(['jack','captain']));
   for(const target of ['jack','captain']){
    assert.equal(E.getVerbalLine(state,target),E.getEvent(state).verbalTargetsV73[target][0]);
    const out=settlePrivate(canonical(E.requestRage(state,target)));assert.equal(out.completed,false);assert.equal(out.stats.boss,state.stats.boss);
    const spoken=settlePrivate(canonical(E.requestVerbal(state,target,2)));assert.equal(spoken.completed,false);assert.equal(spoken.stats.boss,state.stats.boss);
   }
   assert.equal(E.requestRage(state,'wing'),state);assert.equal(E.requestVerbal(state,'wing',2),state);
  }
  for(const at of [state,E.applyChoice(state,0)]){
   const said=E.requestVerbal(at,undefined,2);if(said.verbalContext?.outcome!=='legal')continue;legal=true;
   const out=settlePrivate(canonical(said));assert.equal(out.turn,state.turn);assert.equal(out.pay,state.pay);assert.equal(out.stats.boss,state.stats.boss);assert.equal(out.completed,false);assert.ok(out.history.some(row=>row.eventId==='verbal-v2-legal'));
  }
 }
 assert.equal(legal,true,'a real public-action prefix reaches private legal consequences');assert.equal(group,true,'a real voyage includes Jack and captain together');
});

test('private aftermath cannot open rest, and forged trip state fails canonical replay',()=>{
 const start=source();const forged=structuredClone(start);forged.captainVoyageContext.episodes.reverse();assert.equal(E.validRun(forged),false);
 const fake=structuredClone(start);fake.history.push({kind:'captain-voyage',eventId:'fake',captainVoyageOutcome:{version:1,affinityDelta:999}});assert.equal(E.validRun(fake),false);
 // Exercise the actual private fight resource losses, rather than reducing a
 // meter by hand. Its personal aftermath is modal and never becomes a rest UI.
 let run=E.requestRage(start);while(run.rageContext){assert.equal(E.canRequestBreak(run),false);run=run.pending?E.advance(run):choose(run,0);}
 canonical(run);assert.equal(run.captainVoyageContext,null);assert.equal(run.completed,false);
});

test('an ordinary male HR employee can earn a ship invitation before late game without family salary or injected friendship',()=>{
 const normal=fixture.alternates?.find(row=>row.cases?.normal);assert.ok(normal,'keep a normal-employee witness as well as the family entry');
 const run=canonical(source(normal));assert.match(run.seed,/^e39-r73-n-/);assert.equal(run.characterGender,'male');assert.equal(run.patronage,null);assert.ok(run.pay<180);assert.ok(run.turn<=22);
 assert.ok(characterAffinity(run,'captain').score>=70);assert.ok(deriveCharacterStats(run).find(row=>row.id==='captain').encounters>=2);
 let out=run;for(let i=0;i<4;i++)out=canonical(choose(out));assert.equal(out.turn,run.turn);assert.equal(out.pay,run.pay);assert.equal(out.completed,false);assert.equal(out.captainVoyageContext,null);
});
