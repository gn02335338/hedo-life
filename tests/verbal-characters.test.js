import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_IDS,deriveCharacterStats,characterAffinity} from '../dist/character-stats.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';

const release=(target,kind='relationship',affinityDelta=-35)=>({
 eventId:'verbal-release',kind:'verbal',speaker:target,choiceIndex:0,
 verbalOutcome:{kind,target,affinityDelta,origin:'onboarding',phase:'event'},
 breakdown:[{source:'choice',delta:{boss:-25,trust:8}}],
});
const life=(history,seed='e30-verbal-counter')=>({seed,history});

test('a historical spoken outburst can sharply reduce only the selected character affinity without recording a hit',()=>{
 for(const id of CHARACTER_IDS.filter(id=>id!=='alice')){
  const seed=CAST_IDS_V65.includes(id)?'e39-r65-n-'+'a'.repeat(22):'e30-verbal-counter';
  const run=life([release(id)],seed),rows=deriveCharacterStats(run),selected=rows.find(row=>row.id===id);
  assert.equal(selected.encounters,1);assert.equal(selected.affinityLost,35);assert.equal(selected.affinityDownEvents,1);
  assert.equal(characterAffinity(run,id).score,15);
  for(const row of rows){
   assert.equal(row.imaginedHits,0);assert.equal(row.realHits,0);
   if(row.id!==id)assert.equal(Object.entries(row).filter(([key])=>key!=='id').reduce((sum,[,value])=>sum+value,0),0);
  }
 }
 for(const id of CAST_IDS_V65)assert.ok(deriveCharacterStats(life([release(id)])).every(row=>row.encounters===0),'new people cannot acquire retroactive e30 conversations');
});

test('ignored words use their resolved relationship evidence rather than the incidental mood or team ledger',()=>{
 for(const kind of ['ignored','relationship','retort','support','personnel','legal']){
  const rows=deriveCharacterStats(life([release('rick',kind,0)])),row=rows.find(item=>item.id==='rick');
  assert.equal(row.encounters,1);assert.equal(row.affinityLost,0);assert.equal(row.affinityGained,0);
  assert.equal(row.affinityDownEvents,0);assert.equal(row.realHits,0);assert.equal(row.imaginedHits,0);
 }
});

test('large verbal relationship losses clamp to the remaining score and cannot invent extra loss events',()=>{
 const run=life([release('wing','relationship',-60),release('wing','retort',-35),release('wing','support',8)]);
 const row=deriveCharacterStats(run).find(item=>item.id==='wing');
 assert.equal(row.affinityLost,50);assert.equal(row.affinityDownEvents,1);assert.equal(row.affinityGained,8);
 assert.equal(characterAffinity(run,'wing').score,8);assert.equal(row.encounters,3);
});

test('malformed evidence, unknown targets and old cohorts cannot claim the new spoken-outburst projection',()=>{
 const base=release('wing');
 for(const row of [
  {...base,kind:'daily'}, {...base,choiceIndex:1}, {...base,verbalOutcome:null},
  {...base,verbalOutcome:{...base.verbalOutcome,target:'rick'}},
  {...base,verbalOutcome:{...base.verbalOutcome,affinityDelta:-61}},
  {...base,verbalOutcome:{...base.verbalOutcome,affinityDelta:13}},
  {...base,verbalOutcome:{...base.verbalOutcome,affinityDelta:-3.5}},
  {...base,verbalOutcome:{...base.verbalOutcome,kind:'forged'}},
  release('missing'),release('self'),
 ])assert.ok(deriveCharacterStats(life([row])).every(item=>item.encounters===0));
 assert.ok(deriveCharacterStats({seed:'e29-original',history:[base]}).every(item=>item.encounters===0));
 const ordinary=deriveCharacterStats(life([{...base,eventId:'ordinary',kind:'daily',verbalOutcome:undefined}])).find(item=>item.id==='wing');
 assert.equal(ordinary.affinityLost,12,'ordinary conversation retains its published per-choice cap');
});
