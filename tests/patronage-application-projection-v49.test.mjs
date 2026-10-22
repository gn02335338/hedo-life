import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_METRICS,characterHistoryChanges,characterAffinity,deriveCharacterStats} from '../dist/character-stats.js';
import {isPatronageApplicationOutcomeV49} from '../dist/patronage-v49.js';

const seed='e39-cal46-kin49-projection';
const result=(outcome='appointed',choiceIndex=0)=>({
 eventId:'patronage-application',kind:'career',speaker:'wing',choiceIndex,
 chanceOutcome:outcome==='appointed'?'success':'setback',
 patronageApplicationOutcome:{version:1,result:outcome,target:'rick',affinityDelta:outcome==='appointed'?-18:-12},
 breakdown:[{source:'choice',delta:{boss:outcome==='appointed'?8:-12,trust:12}},{source:'weather',delta:{boss:20,trust:20}}],
});
const life=history=>({seed,history});
const metrics=(run,id)=>deriveCharacterStats(run).find(row=>row.id===id);

test('both application decisions make Rick less friendly on success and failure independently of Wing and team trust',()=>{
 for(const outcome of ['appointed','rejected'])for(const index of [0,1]){
  const row=result(outcome,index),run=life([row]),before=JSON.stringify(run),amount=outcome==='appointed'?18:12;
  assert.equal(isPatronageApplicationOutcomeV49(run,row),true);
  assert.deepEqual(characterHistoryChanges(run).map(change=>[change.id,change.affinityDelta]),[['wing',outcome==='appointed'?8:-12],['rick',-amount]]);
  const rick=metrics(run,'rick');assert.equal(rick.encounters,1);assert.equal(rick.affinityLost,amount);assert.equal(rick.affinityDownEvents,1);
  assert.equal(rick.affinityGained,0);assert.equal(rick.imaginedHits,0);assert.equal(rick.realHits,0);
  for(const person of deriveCharacterStats(run).filter(person=>!['wing','rick'].includes(person.id)))assert.ok(CHARACTER_METRICS.every(key=>person[key]===0));
  assert.equal(JSON.stringify(run),before);
 }
});

test('jealousy clamps at zero without inventing losses, extra hits or a new relationship starting point',()=>{
 const run=life(Array.from({length:5},()=>result())),rick=metrics(run,'rick');
 assert.equal(rick.encounters,5);assert.equal(rick.affinityLost,50);assert.equal(rick.affinityDownEvents,3);
 assert.equal(characterAffinity(run,'rick').score,0);assert.equal(rick.realHits,0);assert.equal(rick.imaginedHits,0);
});

test('withdrawal and previously published application histories do not retroactively lower Rick affinity',()=>{
 const cancel={eventId:'patronage-application',kind:'career',speaker:'wing',choiceIndex:2,chanceOutcome:null,breakdown:[{source:'choice',delta:{boss:0,trust:4}}]};
 assert.equal(metrics(life([cancel]),'rick').encounters,0);
 for(const previousSeed of ['e29-old','e39-before-gate','e39-cal46-old']){
  const row=result();delete row.patronageApplicationOutcome;
  const run={seed:previousSeed,history:[row]},rick=metrics(run,'rick');
  assert.ok(CHARACTER_METRICS.every(key=>rick[key]===0));
  assert.equal(metrics(run,'wing').affinityGained,8);
 }
});

test('malformed application evidence cannot fall back to ordinary trust or masquerade as another interaction',()=>{
 const row=result(),outcome=row.patronageApplicationOutcome;
 const invalid=[
  {...row,patronageApplicationOutcome:undefined},{...row,patronageApplicationOutcome:null},
  {...row,eventId:'ordinary-work'},{...row,kind:'daily'},{...row,speaker:'rick'},
  {...row,choiceIndex:2},{...row,chanceOutcome:'setback'},
  ...['verbalOutcome','mealOutcome','patronageOutcome','activityOutcome','hiddenOutcome'].map(key=>({...row,[key]:{version:1}})),
  ...[{version:2},{result:'rejected'},{target:'wing'},{affinityDelta:18},{affinityDelta:-12},{affinityDelta:-19},{extra:true}].map(patch=>({...row,patronageApplicationOutcome:{...outcome,...patch}})),
 ];
 for(const entry of invalid){
  assert.equal(isPatronageApplicationOutcomeV49(life([entry]),entry),false);
  assert.equal(metrics(life([entry]),'rick').affinityLost,0);
  assert.equal(metrics(life([entry]),'rick').encounters,0);
 }
 const forgedOld={seed:'e39-cal46-old',history:[row]};
 assert.equal(isPatronageApplicationOutcomeV49(forgedOld,row),false);
 assert.ok(deriveCharacterStats(forgedOld).every(person=>CHARACTER_METRICS.every(key=>person[key]===0)));
});
