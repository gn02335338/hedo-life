import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PERSONAS} from '../dist/persona.js';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats,characterHistoryChanges,characterAffinity} from '../dist/character-stats.js';
import {createRun,applyChoice,advance,requestBreak,requestCareer,requestRaise,requestExit,requestRage,replayRun,validRun} from '../dist/engine.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const fixture=name=>{
 const value=JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),'utf8'));
 return Array.isArray(value)?value:value.routes;
};
const rows=run=>Object.fromEntries(deriveCharacterStats(run).map(row=>[row.id,row]));
const history=(speaker,delta={},extra={})=>({eventId:'work',kind:'daily',speaker,choiceIndex:0,breakdown:[{source:'choice',delta}],...extra});
const methods={break:requestBreak,career:requestCareer,raise:requestRaise,exit:requestExit};

function directPlay(roleId,seed,actions,saved=false){
 let run=createRun(roleId,seed);
 const checkpoint=()=>{if(saved)run=copy(run);assert.equal(validRun(run),true,`${seed}/${run.eventId}`);};
 checkpoint();
 for(let index=0;index<actions.length;index++){
  const action=actions[index];
  if(action.type==='choice'){
   assert.equal(run.eventId,action.eventId);run=applyChoice(run,action.index);checkpoint();
   if(!(actions[index+1]?.type==='rage'&&actions[index+1].phase==='result'))run=advance(run);
  }else if(action.type==='rage'){run=requestRage(run);checkpoint();run=advance(run);}
  else{const before=run;run=methods[action.type](run);assert.notEqual(run,before);}
  checkpoint();
 }
 return run;
}

test('character projection always returns the seventeen public IDs and bounded integer metrics without accepting supplied totals',()=>{
 assert.deepEqual(CHARACTER_IDS,Object.keys(PERSONAS));assert.equal(CHARACTER_IDS.length,17);
 assert.deepEqual(CHARACTER_METRICS,['encounters','imaginedHits','realHits','affinityGained','affinityLost','affinityUpEvents','affinityDownEvents']);
 for(const value of [null,undefined,{},[],{history:null},{characters:[{id:'wing',realHits:999}],flags:{rage_real:999,rage_target_wing:999}}]){
  const result=deriveCharacterStats(value);assert.equal(result.length,17);
  for(const row of result){assert.deepEqual(Object.keys(row),['id',...CHARACTER_METRICS]);for(const key of CHARACTER_METRICS)assert.equal(row[key],0);}
  assert.deepEqual(characterHistoryChanges(value),[]);
 }
 const run=createRun('system','e20-characters-unresolved'),before=copy(run);
 assert.deepEqual(deriveCharacterStats(run),deriveCharacterStats({}));
 assert.deepEqual(characterAffinity(run,'wing'),{score:50,start:50,gained:0,lost:0});
 assert.deepEqual(characterAffinity(run,'unknown'),{score:50,start:50,gained:0,lost:0});
 assert.deepEqual(run,before);
});

test('the five added characters keep resolved conversations, dreams and real hits separate without changing historical rows',()=>{
 const ids=['sophie','jonathan','owen','sam','cindy'];
 const old={history:[history('wing',{boss:7}),history('helen',{trust:-4})]},oldBefore=copy(old);
 const base=rows(old);
 for(const id of ids){
  assert.deepEqual(base[id],{id,encounters:0,imaginedHits:0,realHits:0,affinityGained:0,affinityLost:0,affinityUpEvents:0,affinityDownEvents:0});
  const run={...old,history:[...old.history,
   history(id,{trust:5,boss:90}),
   history(id,{trust:-20,boss:-90},{eventId:'rage-release',kind:'rage',eventOutcome:{result:'腦內劇場'}}),
   history(id,{}, {eventId:'rage-release',kind:'rage',eventOutcome:{result:'真的失控了'}}),
   history(id,{trust:-20},{eventId:'rage-aftermath',kind:'rage-world'}),
  ]},before=copy(run),actual=rows(run);
  assert.deepEqual(actual[id],{id,encounters:4,imaginedHits:1,realHits:1,affinityGained:5,affinityLost:25,affinityUpEvents:1,affinityDownEvents:1});
  assert.deepEqual(characterAffinity(run,id),{score:30,start:50,gained:5,lost:25});
  for(const other of CHARACTER_IDS)if(other!==id)assert.deepEqual(actual[other],base[other],`${id} does not change ${other}'s counters`);
  assert.deepEqual(run,before,'the additive projection never edits a saved history');
 }
 assert.deepEqual(old,oldBefore);
});

test('affinity uses only resolved choice ledgers, keeps team trust distinct, and ignores weather and follow-up fiction',()=>{
 const run={history:[
  history('wing',{boss:-40,trust:40},{breakdown:[{source:'choice',delta:{boss:-40,trust:40}},{source:'weather',delta:{boss:90}},{source:'rng',delta:{boss:90}}]}),
  history('hope',{boss:40,trust:-4},{breakdown:[{source:'choice',delta:{boss:40,trust:-4}},{source:'rng',delta:{trust:90}},{source:'ability-tradeoff',delta:{trust:90}}]}),
  history('exit-team',{boss:-40,trust:20}),
  history('self',{boss:20,trust:20}),history('unknown',{boss:20,trust:20}),
  history('wing',{boss:-12},{choiceIndex:-1}),
  history('wing',{boss:-12},{eventId:'rage-release',kind:'rage',eventOutcome:{result:'腦內劇場'}}),
  history('hope',{trust:12},{eventId:'rage-release',kind:'rage',eventOutcome:{result:'真的失控了'}}),
  history('erich',{trust:-12},{eventId:'rage-legal',kind:'rage-world'}),
 ]},before=copy(run),result=rows(run),changes=characterHistoryChanges(run);
 assert.deepEqual(result.wing,{id:'wing',encounters:2,imaginedHits:1,realHits:0,affinityGained:0,affinityLost:12,affinityUpEvents:0,affinityDownEvents:1});
 assert.deepEqual(result.hope,{id:'hope',encounters:2,imaginedHits:0,realHits:1,affinityGained:0,affinityLost:29,affinityUpEvents:0,affinityDownEvents:2});
 for(const id of ['erich','jenjen','sonny']){
  assert.equal(result[id].encounters,id==='erich'?2:1);assert.equal(result[id].affinityGained,12);assert.equal(result[id].affinityUpEvents,1);
 }
 assert.deepEqual(changes.filter(change=>change.historyIndex===2).map(change=>change.id),['erich','jenjen','sonny']);
 assert.equal(changes.filter(change=>change.historyIndex===8)[0].affinityDelta,0);
 assert.deepEqual(characterAffinity(run,'hope'),{score:21,start:50,gained:0,lost:29});
 assert.deepEqual(run,before,'the projection never rewrites proof history or game RNG');
});

test('real-hit counts do not imply uncapped affinity loss and repeated zero deltas are not new down events',()=>{
 const real=history('spencer',{}, {eventId:'rage-release',kind:'rage',eventOutcome:{result:'真的失控了'}});
 const positive=history('spencer',{trust:99});
 const run={history:[real,real,real,real,positive,positive,positive,positive,positive,positive,positive,positive,positive,positive]};
 const row=rows(run).spencer;
 assert.equal(row.realHits,4);assert.equal(row.affinityLost,50);assert.equal(row.affinityDownEvents,2);
 assert.equal(row.affinityGained,100);assert.equal(row.affinityUpEvents,9);
 assert.deepEqual(characterAffinity(run,'spencer'),{score:100,start:50,gained:100,lost:50});
 assert.deepEqual(characterHistoryChanges(run).slice(0,4).map(change=>change.affinityDelta),[-25,-25,0,0]);
});

test('flags, prose, unresolved outcomes and old cartoon menus cannot be misread as imagined or actual hits',()=>{
 const run={flags:{rage_real:5,rage_imagined:5,rage_target_spencer:5},history:[
  history('spencer',{}, {result:'你真的出手了，也在腦內劇場醒來。'}),
  history('spencer',{}, {eventId:'rage-release',kind:'rage',eventOutcome:{label:'真的失控了',result:'普通結果'}}),
  history('spencer',{}, {eventId:'rage-release',kind:'rage',eventOutcome:{result:'腦內劇場'},choiceIndex:-1}),
  history('exit-team',{}, {eventId:'rage-release',kind:'rage',eventOutcome:{result:'真的失控了'}}),
  history('spencer',{}, {eventId:'rage-menu',kind:'rage',rageTarget:'spencer'}),
  {eventId:'legacy-work',kind:'daily',speaker:'rick',choiceIndex:0,delta:{trust:50,boss:50}},
 ]};
 for(const row of deriveCharacterStats(run)){assert.equal(row.imaginedHits,0);assert.equal(row.realHits,0);assert.equal(row.affinityGained,0);assert.equal(row.affinityLost,0);}
 assert.equal(rows(run).rick.encounters,1,'legacy rows without ledgers retain encounters without guessed affinity');
 assert.equal(rows(run).spencer.encounters,1,'only the ordinary resolved conversation proves an encounter here');
});

// Each descriptor is a real prefix of a checked-in natural route, followed by
// the normal rage action. No initial stat, target flag or RNG state is injected.
const targetWitnesses=[
 ['wing','imagined','achievement-routes-v18',0,0],['wing','real','achievement-routes-v18',1,2],
 ['spencer','imagined','achievement-routes-v18',0,10],['spencer','real','achievement-routes-v18',1,24],
 ['erich','imagined','achievement-routes-v18',6,25],['erich','real','personnel-routes-v20',2,13],
 ['sonny','imagined','achievement-routes-v18',0,2],['sonny','real','achievement-routes-v18',1,23],
 ['jenjen','imagined','achievement-routes-v18',1,1],['jenjen','real','achievement-routes-v18',1,28],
 ['rick','imagined','achievement-routes-v18',1,21],['rick','real','achievement-routes-v18',1,14],
 ['kind','imagined','achievement-routes-v18',1,20],['kind','real','achievement-routes-v18',2,6],
 ['hope','imagined','achievement-routes-v18',1,3],['hope','real','achievement-routes-v18',2,9],
 ['jack','imagined','achievement-routes-v18',3,1],['jack','real','achievement-routes-v18',8,32],
 ['meimei','imagined','personnel-routes-v20',1,2],['meimei','real','personnel-routes-v20',3,13],
];

test('all ten characters have natural imagined and real-hit proofs, including distinct Spencer and Water Snake attempts',()=>{
 const seen=new Set();
 for(const [id,mode,file,index,prefixLength]of targetWitnesses){
  const route=fixture(file)[index],prefix=route.actions.slice(0,prefixLength);
  const base=directPlay(route.roleId,route.seed,prefix),before=rows(base);
  const pending=requestRage(base);assert.notEqual(pending,base);assert.equal(pending.rageContext.target,id);assert.equal(pending.rageContext.mode,mode);
  assert.equal(validRun(copy(pending)),true);
  const run=advance(pending),saved=copy(run),canonical=replayRun(run.roleId,run.seed,run.actions),after=rows(run);
  assert.deepEqual(saved,canonical);assert.deepEqual(deriveCharacterStats(saved),deriveCharacterStats(canonical));
  assert.deepEqual(characterHistoryChanges(saved),characterHistoryChanges(canonical));
  const change=characterHistoryChanges(run).findLast(item=>item.id===id);
  assert.equal(after[id].encounters,before[id].encounters+1);
  assert.equal(after[id].imaginedHits,before[id].imaginedHits+(mode==='imagined'?1:0));
  assert.equal(after[id].realHits,before[id].realHits+(mode==='real'?1:0));
  assert.equal(change.affinityDelta,mode==='imagined'?0:-Math.min(25,characterAffinity(base,id).score));
  for(const other of CHARACTER_IDS)if(other!==id)assert.deepEqual(after[other],before[other],`${id}/${mode} does not hit bystanders`);
  const direct=directPlay(run.roleId,run.seed,run.actions),resaved=directPlay(run.roleId,run.seed,run.actions,true);
  assert.deepEqual(deriveCharacterStats(direct),deriveCharacterStats(resaved));assert.deepEqual(direct,canonical);
  seen.add(`${id}/${mode}`);
 }
 assert.equal(seen.size,20);
});

test('current personnel and published salary routes derive the same statistics after direct play, JSON save and replay',()=>{
 const current=fixture('personnel-routes-v20');
 const legacy=fixture('legacy-e19-routes').filter(route=>route.actions.some(action=>action.type==='raise')).slice(0,5);
 for(const route of [...current,...legacy]){
  const direct=directPlay(route.roleId,route.seed,route.actions),saved=directPlay(route.roleId,route.seed,route.actions,true);
  const canonical=replayRun(route.roleId,route.seed,route.actions),before=copy(canonical);
  assert.deepEqual(deriveCharacterStats(direct),deriveCharacterStats(saved));
  assert.deepEqual(deriveCharacterStats(saved),deriveCharacterStats(canonical));
  assert.deepEqual(characterHistoryChanges(saved),characterHistoryChanges(canonical));
  assert.deepEqual(canonical,before);assert.equal(validRun(saved),true);
  for(const id of CHARACTER_IDS){const affinity=characterAffinity(saved,id);assert.ok(affinity.score>=0&&affinity.score<=100);}
 }
});
