import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import {isKindRecoveryV70,KIND_RECOVERY_ENERGY_V70} from '../dist/kind-recovery-v70.js';
import {KIND_BREAK_COST} from '../dist/kind-break.js';

// Discovered through createRun + public actions. These short witnesses never
// inject resources, PIP, employment, flags, event IDs, history or engine RNG.
const routes={
 rest:{role:'system',seed:'e39-r70-n-ba883a8d2ed24a9bb2d390',steps:['activity-schedule',['onboarding',0],['jonathan-today-release',0],['job-system-rollback',0],'break',['self-care',1],['work-gap-v50',0],['system-backup',2],['career-review',0],['career-duty-2',0],['shareholder58-offer',2],['q26-interview-privacy',0],['cast39-joyce-leaving-window',1],['education-review',2],['cast65-zoe-outdoor-mic',1],['career-review',0],['career-duty-3',1],'break']},
 work:{role:'design',seed:'e39-r70-s-b80406917c057a0291c778',steps:['activity-schedule',['onboarding',0],['recruitment60-rick',2],['recruitment60-princess',2],['professor37-university-brand-frame',0],['cast35-cindy-big-pm-font',2],['shareholder58-offer',2],['dp-one-year-lecture',0],['patronage67-education',1],['cast66-simon-button-verb',0],['patronage67-pay-review',1],['design-v21-responsive-banner',0]]},
 capped:{role:'sales',seed:'e39-r70-s-1aa238dd1acf0b5aaad5ac',steps:['activity-schedule',['onboarding',0],['recruitment60-rick',2],['recruitment60-princess',2],['cast35-owen-cash-is-not-contract',2],['patronage67-education',0],['cast35-helen-contact-triage',2],['meeting-chair-host',2],['shareholder58-offer',2],['sales21-demo-operator',2],['patronage67-pay-review',0],['sales21-commission-proof',2],['cast65-james-exit-rumor',2],['wealth-plan',2],['sales21-renewal-denominator',2]]},
 pip:{role:'system',seed:'e39-r70-s-f17fc62ae156688d27ed5f',steps:['activity-schedule',['onboarding',0],['recruitment60-rick',2],['recruitment60-princess',2],['cast39-princess-local-path',1],['cast66-johnny-not-done-label',1],['patronage67-education',1],['cast39-janet-wine-club-agenda',1],['treats61-jack-drinks-0',2],['treats61-jack-drinks-1',1],['treats61-jack-drinks-2',2],['jonathan-today-release',1],['patronage67-pay-review',1],['shareholder58-offer',2],['job-system-rollback',1],['treats61-company-tea-0',2],['treats61-company-tea-1',0],['treats61-company-tea-2',2],['cast66-james-desk-drawer',1],['wealth-plan',2],'break',['self-care',1],['work-gap-v50',0],['wing-ranked-architecture',0],['blockchain65-0',0],['blockchain65-1',0],['blockchain65-2',0],['blockchain65-3',0],['professor37-research-service-shift',0],'break',['self-care',1],['work-gap-v50',0],['cast35-sophie-readonly-approval',0],['system-printer',2],['wealth-plan',2],'break',['self-care',1],['work-gap-v50',0],['jack-api-budget',1],'break',['self-care',1],['work-gap-v50',0],['cast35-kind-cache-purge',0],'break',['self-care',1],['work-gap-v50',0],['q26-interview-privacy',0],['kind-workday',1],['cast35-jonathan-js-timeline',0],'break',['kind-break',1],['self-care',1],['work-gap-v50',0],['meimei-birthday-host',1],['crisis-boss',2],['crisis-mood',2],'break']},
 oldRest:{role:'system',seed:'e39-r69-n-ba883a8d2ed24a9bb2d390',steps:['activity-schedule',['onboarding',0],['system-printer',2],['cast39-princess-handoff-window',1],['treats61-jack-drinks-0',2],['treats61-jack-drinks-1',1],['treats61-jack-drinks-2',2],['cast35-sophie-readonly-approval',0],['education-scrutiny',0],['salary-cut',2],['cast66-action-decline-investment',1],'break'],digests:['f53a50ba080ad13d345c619d08a03302c26e10c1a61e1ad9ffcb666326ab14dc','0524d6c36c91bcefc412c515c23c05212ccb4d9af1c297b5daf20df3594ca996','49ab2b6ef10932d8920ab19d4550b4201488bc6d5615755f6d3eff07f57f5f43']},
 oldWork:{role:'hr',seed:'e39-r69-s-b80406917c057a0291c778',steps:['activity-schedule',['onboarding',0],['recruitment60-rick',2],['recruitment60-princess',2],['hr28-admin-half-day',2],['kind-workday',1],['cast39-captain-exit-checklist',2],['cast35-spencer-assistant-scope',2],['cast66-hester-headcount-myth',0]],digests:['fa7b230acf6369b8671ff73d749f6f4ff11508a76656ae08fd0f9ac6c1c53b6c','644e328fbcabd0d8eabff912dac553503a3ca2faad41c76596a924925d38be2e','9d76efd04a6dea5338644979feae72fb2ebb336b8d9feb5b6853cdf65bcca4ef']}
};
const clone=value=>structuredClone(value);
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const source=id=>{
 const route=routes[id];let run=E.createRun(route.role,route.seed);
 for(const step of route.steps){
  if(step==='activity-schedule')run=E.enableActivitySchedule(run);
  else if(step==='break'){assert.equal(E.canRequestBreak(run),true);run=E.requestBreak(run);}
  else{assert.equal(E.getEvent(run).id,step[0]);run=choose(run,step[1]);}
 }
 assert.equal(E.validRun(run),true);return run;
};
const canonical=run=>{
 const saved=JSON.parse(JSON.stringify(run));assert.equal(E.validRun(saved),true);
 assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run.pending?E.advance(saved):saved);
};
const employment=run=>Object.fromEntries(['turn','pay','basePay','offerPay','rank','actualRoleId','assignment','pip','patronage','personnelPending','recruitmentContext'].map(key=>[key,run[key]]));
function ledger(before,pending){
 const row=pending.history.at(-1),total=Object.fromEntries(E.STAT_KEYS.map(key=>[key,0]));
 for(const part of row.breakdown)for(const [key,value]of Object.entries(part.delta))total[key]+=value;
 assert.deepEqual(total,row.delta);
 for(const key of E.STAT_KEYS)assert.equal(row.delta[key],pending.stats[key]-before.stats[key],key);
 assert.equal(row.breakdown.filter(part=>part.delta.cash).length,1);
 assert.equal(row.breakdown.find(part=>part.delta.cash).source,'choice');
 assert.equal(row.delta.cash,-KIND_BREAK_COST);
 assert.ok(row.breakdown.every(part=>!['income','workday','pip-pressure','patronage-allowance','patronage-appointment'].includes(part.source)));
}

test('only exact fresh r70 profiles opt into dual-resource recovery',()=>{
 for(const marker of ['n','s','d']){
  const seed=`e39-r70-${marker}-`+'ab'.repeat(11);
  assert.equal(isKindRecoveryV70(seed),true);assert.equal(isKindRecoveryV70({seed}),true);
 }
 for(const seed of [undefined,null,'','e39-r69-n-'+'a'.repeat(22),'e39-r74-s-'+'a'.repeat(22),'e39-r70-n-'+'a'.repeat(21),'e39-r70-n-'+'a'.repeat(23),'e39-r70-x-'+'a'.repeat(22),'e39-r70-s-'+'A'.repeat(22),'e39-r70-d-'+'g'.repeat(22),'e39-r70-d-'+'a'.repeat(22)+'-extra'])assert.equal(isKindRecoveryV70(seed),false);
 assert.equal(KIND_RECOVERY_ENERGY_V70,45);
});

test('a low-energy rest detour and a spontaneous workday outing restore both resources and clear the warning',()=>{
 for(const id of ['rest','work']){
  const menu=source(id),before=clone(menu),view=E.getEvent(menu);
  assert.equal(menu.eventId,id==='rest'?'kind-break':'kind-workday');
  assert.ok(menu.stats.energy>0&&menu.stats.energy<=30);assert.ok(menu.stats.mood<100);assert.ok(menu.stats.cash>KIND_BREAK_COST);
  assert.equal(view.choices[0].available,true);
  const pending=E.applyChoice(menu,0),returned=E.advance(pending),row=pending.history.at(-1);
  assert.deepEqual(menu,before);assert.equal(pending.pending,true);assert.equal(pending.pendingEffect,'finishBreak');
  assert.equal(pending.stats.energy,before.stats.energy+45);assert.ok(pending.stats.energy>30);
  assert.ok(pending.stats.mood>before.stats.mood);
  assert.ok([52,55,58].some(gain=>pending.stats.mood===Math.min(100,before.stats.mood+gain)));
  assert.deepEqual(returned.stats,pending.stats);assert.deepEqual(employment(pending),employment(before));assert.deepEqual(employment(returned),employment(before));
  assert.equal(pending.history.length,before.history.length+1);assert.deepEqual(pending.history.slice(0,-1),before.history);
  assert.equal(row.eventId,menu.eventId);assert.equal(row.kind,'self-care');assert.equal(row.speaker,'kind');assert.equal(row.weather,null);
  assert.equal(pending.flags.kind_relaxed,(before.flags.kind_relaxed||0)+1);
  assert.equal(returned.eventId,before.breakReturnEventId);assert.equal(returned.breakReturnEventId,null);assert.equal(returned.lastBreakTurn,before.turn);
  assert.equal(returned.completed,false);ledger(before,pending);canonical(menu);canonical(pending);canonical(returned);
  assert.equal(E.applyChoice(pending,0),pending);assert.equal(E.applyChoice(pending,1),pending);
  assert.equal(E.requestBreak(pending),pending);assert.equal(E.requestBreak(returned),returned);
  assert.equal(E.canRequestBreak(returned),false);
 }
});

test('refusing either invitation remains free and permits a cheaper ordinary sleep without another workday',()=>{
 for(const id of ['rest','work'])for(const index of [1,2]){
  const menu=source(id),pending=E.applyChoice(menu,index),declined=E.advance(pending);
  assert.deepEqual(pending.stats,menu.stats);assert.deepEqual(declined.stats,menu.stats);
  assert.equal(pending.rng,menu.rng);assert.equal(declined.rng,menu.rng);
  assert.deepEqual(employment(declined),employment(menu));canonical(pending);canonical(declined);
  const ordinary=id==='rest'?declined:E.requestBreak(declined);
  assert.equal(ordinary.eventId,'self-care');assert.equal(ordinary.rng,declined.rng);
  assert.equal(ordinary.turn,menu.turn);
  const sleep=E.getEvent(ordinary).choices.findIndex(choice=>choice.effect==='finishBreak'&&choice.delta.energy===42);
  assert.ok(sleep>=0);assert.equal(E.getEvent(ordinary).choices[sleep].available,true);
  const rested=choose(ordinary,sleep);
  assert.equal(rested.stats.cash,menu.stats.cash-12);assert.equal(rested.stats.energy,menu.stats.energy+42);
  assert.ok(rested.stats.energy>30);assert.equal(rested.turn,menu.turn);assert.deepEqual(rested.pip,menu.pip);
  assert.equal(rested.lastBreakTurn,menu.turn);assert.equal(E.canRequestBreak(rested),false);canonical(ordinary);canonical(rested);
 }
});

test('naturally near-full resources clamp accurately, including an existing PIP without advancing its countdown',()=>{
 for(const id of ['capped','pip']){
  const menu=source(id),pending=E.applyChoice(menu,0),returned=E.advance(pending),row=pending.history.at(-1);
  assert.ok(menu.stats.energy>55);assert.equal(pending.stats.energy,100);assert.equal(row.delta.energy,100-menu.stats.energy);
  assert.ok(pending.stats.mood>menu.stats.mood);assert.ok(pending.stats.mood<=100);
  assert.deepEqual(employment(returned),employment(menu));assert.equal(returned.stats.cash,menu.stats.cash-36);
  if(id==='pip'){assert.equal(menu.pip.active,true);assert.equal(menu.pip.remaining,3);assert.equal(returned.pip.remaining,3);}
  ledger(menu,pending);canonical(menu);canonical(pending);canonical(returned);
 }
});

test('published r69 invitations preserve complete pending and returned states with their original energy gain',()=>{
 for(const id of ['oldRest','oldWork']){
  const menu=source(id),pending=E.applyChoice(menu,0),returned=E.advance(pending);
  assert.equal(pending.stats.energy-menu.stats.energy,10);
  assert.deepEqual([menu,pending,returned].map(digest),routes[id].digests);
  canonical(menu);canonical(pending);canonical(returned);
 }
});
