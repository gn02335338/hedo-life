import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {ENDINGS} from '../dist/endings.js';
import {ROLES} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {isOnboardingDeclineV66} from '../dist/release-clarity-v66.js';
import {buildEndingTransition,renderEndingTransition} from '../dist/ending-transition-v40.js';
import {deriveDepartureWay} from '../worker/departures.js';

const declined=(role,seed)=>E.advance(E.applyChoice(E.enableActivitySchedule(E.createRun(role,seed)),2));
const ending=run=>ENDINGS.find(row=>row.id===run.endingId);

test('all thirteen current careers describe first-day refusal as unaccepted employment',()=>{
 for(const role of ROLES){
  const run=declined(role.id,'e39-r66-n-'+'a'.repeat(22)),copy=structuredClone(run);
  assert.equal(E.validRun(run),true);assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run);
  assert.equal(isOnboardingDeclineV66(run),true);assert.equal(run.turn,0);
  const view=buildEndingTransition(run,ending(run));assert.equal(view.employment.kind,'offer-declined');assert.equal(deriveDepartureWay(run),'other');
  assert.match(renderEndingTransition(run,ending(run)),/你沒有接受這份任用/);
  assert.deepEqual(run,copy,'classification is read-only');
 }
});

test('special son and daughter appointment refusals retain their professional record and ordinary ending ID',()=>{
 for(const kind of ['s','d']){
  const seed=`e39-r66-${kind}-`+'a'.repeat(22),entry=directEntryV60(seed),run=declined(entry.roleId,seed);
  assert.equal(run.history.at(-1).recruitmentOutcome.kind,'declined');assert.equal(isOnboardingDeclineV66(run),true);
  assert.equal(run.endingId,`ragequit-${entry.roleId}`);assert.equal(run.patronage,null);
  assert.equal(buildEndingTransition(run,ending(run)).employment.kind,'offer-declined');assert.equal(deriveDepartureWay(run),'other');
 }
});

test('uncommitted choices, unrelated exits and historical profiles do not acquire the new classification',()=>{
 const initial=E.enableActivitySchedule(E.createRun('system','e39-r66-n-'+'a'.repeat(22))),run=declined('system',initial.seed);
 for(const changed of [initial,E.applyChoice(initial,2),{...run,completed:false},{...run,turn:1},{...run,actions:run.actions.slice(0,-1)},{...run,history:[{...run.history.at(-1),choiceIndex:0}]}])assert.equal(isOnboardingDeclineV66(changed),false);
 const historical=declined('system','e39-r65-n-'+'a'.repeat(22));
 assert.equal(isOnboardingDeclineV66(historical),false);assert.equal(buildEndingTransition(historical,ending(historical)).employment.kind,'voluntary');assert.equal(deriveDepartureWay(historical),'voluntary');
});
