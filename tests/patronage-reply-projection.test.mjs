import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_IDS,CHARACTER_METRICS,deriveCharacterStats,characterAffinity,isPatronageOutcomeV43} from '../dist/character-stats.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {ROLE_MAP} from '../dist/roles.js';
import {validateCompletion,ApiError} from '../worker/http.js';

const reply=(target,affinityDelta=-18)=>({
 eventId:'patronage-reply',kind:'patronage',speaker:target,choiceIndex:0,
 eventOutcome:{label:'自己人發話之後',result:'對方回了嘴'},
 patronageOutcome:{version:1,origin:'some-work-scene',target,mode:['wing','spencer'].includes(target)?'flattery':'entitled',reaction:'retort',affinityDelta},
 // These unrelated team/boss numbers must not replace the resolved opinion.
 breakdown:[{source:'choice',delta:{boss:12,trust:12}},{source:'weather',delta:{boss:-9}}],
});
const life=(history,seed='e39-patronage-projection')=>({seed,history});
const empty=run=>assert.ok(deriveCharacterStats(run).every(row=>CHARACTER_METRICS.every(key=>row[key]===0)));
const proof=(action,seed='e39-patronage-envelope')=>({
 runId:'50abfbe0-fd37-498a-af91-d5542de39b87',roleId:'system',seed,actions:[action],
});
const action=()=>({type:'patronage-reply',version:1,eventId:'some-work-scene',target:'rick'});
const rejected=body=>assert.throws(()=>validateCompletion(body,ROLE_MAP),error=>error instanceof ApiError&&error.code==='invalid_actions');
// Legacy version-1 fixtures exercise their original 28-person public roster.
// Alice's strict r71 evidence and HTTP grammar are covered by the r71 tests.
const historicalTargets=CHARACTER_IDS.filter(id=>id!=='alice');

test('a patronage reply credits only its selected public character and never records a hit',()=>{
 assert.equal(historicalTargets.length,28);
 for(const target of historicalTargets){
  for(const reaction of ['obliged','retort','reported','welcomed']){
   const row=reply(target),seed=CAST_IDS_V65.includes(target)?'e39-r65-n-'+'a'.repeat(22):'e39-patronage-projection',run=life([{...row,patronageOutcome:{...row.patronageOutcome,reaction}}],seed);
   assert.equal(isPatronageOutcomeV43(run,run.history[0]),true,`${target}/${reaction}`);
   for(const current of deriveCharacterStats(run)){
    assert.equal(current.encounters,Number(current.id===target));
    assert.equal(current.affinityLost,current.id===target?18:0);
    assert.equal(current.affinityDownEvents,Number(current.id===target));
    for(const key of ['affinityGained','affinityUpEvents','imaginedHits','realHits'])assert.equal(current[key],0);
   }
  }
 }
 for(const target of CAST_IDS_V65){const row=reply(target),run=life([row]);assert.equal(isPatronageOutcomeV43(run,row),false);empty(run);}
});

test('patronage affinity respects score bounds and uses evidence rather than incidental trust or Wing weather',()=>{
 const run=life([reply('rick',-24),reply('rick',-24),reply('rick',-24),reply('rick',12),reply('spencer',12)]);
 const rick=deriveCharacterStats(run).find(row=>row.id==='rick');
 assert.equal(rick.encounters,4);assert.equal(rick.affinityLost,50);assert.equal(rick.affinityDownEvents,3);
 assert.equal(rick.affinityGained,12);assert.equal(characterAffinity(run,'rick').score,12);
 const spencer=deriveCharacterStats(run).find(row=>row.id==='spencer');
 assert.equal(spencer.encounters,1);assert.equal(spencer.affinityGained,12);
 const wing=deriveCharacterStats(run).find(row=>row.id==='wing');
 assert.ok(CHARACTER_METRICS.every(key=>wing[key]===0),'flattering the chairman is not a conversation with Wing');
 const maximum=life(Array.from({length:6},()=>reply('hope',12)));
 assert.equal(characterAffinity(maximum,'hope').score,100);
 assert.equal(deriveCharacterStats(maximum).find(row=>row.id==='hope').affinityUpEvents,5);
 const neutral=deriveCharacterStats(life([reply('wing',0)])).find(row=>row.id==='wing');
 assert.equal(neutral.encounters,1);assert.equal(neutral.affinityGained,0);assert.equal(neutral.affinityLost,0);
});

test('malformed patronage rows never fall back to trust, verbal, meal or rage projection',()=>{
 const base=reply('rick'),evidence=base.patronageOutcome;
 for(const row of [
  {...base,patronageOutcome:undefined},{...base,patronageOutcome:null},{...base,patronageOutcome:[]},
  {...base,eventId:'ordinary-work'},{...base,kind:'daily'},{...base,choiceIndex:1},{...base,speaker:'wing'},
  {...base,eventId:'rage-release',kind:'rage'}, {...base,speaker:'exit-team'},
  {...base,verbalOutcome:undefined},{...base,mealOutcome:undefined},
  {...base,eventOutcome:undefined},{...base,eventOutcome:{label:'not the committed reaction',result:'test'}},
  {...base,eventOutcome:{label:'自己人發話之後',result:''}},
  ...[
   {version:2},{origin:''},{origin:' '},{origin:'x'.repeat(101)},
   {target:'self'},{target:'missing'},{mode:'flattery'},{reaction:'personnel'},
   {affinityDelta:-25},{affinityDelta:13},{affinityDelta:.5},{affinityDelta:NaN},
   {unexpected:true},
  ].map(patch=>({...base,patronageOutcome:{...evidence,...patch}})),
 ])empty(life([row]));
 for(const target of ['wing','spencer']){
  const row=reply(target);empty(life([{...row,patronageOutcome:{...row.patronageOutcome,mode:'entitled'}}]));
 }
 for(const seed of ['e28-old','old','e40-unsupported'])empty(life([base],seed));
 for(let cohort=29;cohort<=39;cohort++)assert.equal(isPatronageOutcomeV43(life([base],`e${cohort}-supported`),base),true);
 const ordinary={eventId:'ordinary-work',kind:'daily',choiceIndex:0,speaker:'rick',breakdown:base.breakdown};
 assert.equal(deriveCharacterStats(life([ordinary])).find(row=>row.id==='rick').affinityGained,12,'legacy ordinary conversations retain their projection');
 empty(life([{...ordinary,patronageOutcome:undefined}],'e28-old'));
});

test('HTTP accepts exactly the versioned patronage reply action for public targets and supported cohorts',()=>{
 for(let cohort=29;cohort<=39;cohort++)for(const target of historicalTargets){
  const body=proof({...action(),target},`e${cohort}-supported`),accepted=validateCompletion(body,ROLE_MAP);
  assert.deepEqual(accepted.actions,body.actions);
 }
 for(const changed of [
  {version:0},{version:2},{version:'1'},{target:'self'},{target:'exit-team'},{target:'missing'},
  {eventId:''},{eventId:' '},{eventId:'x'.repeat(101)},{eventId:42},
  {phase:'event'},{affinityDelta:12},{patronage:{title:'乾兒子'}},
 ])rejected(proof({...action(),...changed}));
 for(const omitted of ['version','eventId','target']){
  const invalid=action();delete invalid[omitted];rejected(proof(invalid));
 }
 for(const seed of ['e28-old','e40-future','1','e290-typo'])rejected(proof(action(),seed));
});
