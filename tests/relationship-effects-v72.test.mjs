import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {PERSONAS} from '../dist/persona.js';
import {characterAffinity,deriveCharacterStats,isRelationshipOutcomeV72} from '../dist/character-stats.js';
import {RELATIONSHIP_EVENTS_V72} from '../dist/events-relationships-v72.js';
import {RELATIONSHIP_VOICES_V72,relationshipTierV72,relationshipEventAllowedV72,selectRelationshipEventV72,relationshipPulseV72} from '../dist/relationship-effects-v72.js';
import {directEntryV60} from '../dist/recruitment-v60.js';

const seed='e39-r72-n-'+'a'.repeat(22),copy=value=>structuredClone(value);
// These lightweight fixtures exercise projection and threshold math only.
// The separate integration witnesses below use real game actions throughout.
const unit=(target,amounts)=>({seed,roleId:'system',actualRoleId:'system',turn:7,rank:1,stats:{energy:70,mood:70,cash:70,boss:70},flags:{},seen:[],history:amounts.map((amount,index)=>({eventId:`unit-${index}`,kind:'daily',turn:index+1,speaker:target,choiceIndex:0,breakdown:[{source:'choice',delta:{[target==='wing'?'boss':'trust']:amount}}]}))});
const event=target=>({id:'unit-current',kind:'daily',speaker:target});
const outcome=(target='jack')=>({version:1,target,reaction:'help',affinityDelta:2,origin:'unit-current',tier:'trusted'});

test('sixteen threshold stories and twenty-nine original voices cover support, conflict and repair without revealing odds',()=>{
 assert.equal(RELATIONSHIP_EVENTS_V72.length,16);assert.equal(new Set(RELATIONSHIP_EVENTS_V72.map(row=>row.id)).size,16);
 assert.deepEqual(Object.keys(RELATIONSHIP_VOICES_V72),Object.keys(PERSONAS));
 for(const scene of RELATIONSHIP_EVENTS_V72){
  assert.equal(scene.requiresRelationshipV72,true);assert.equal(scene.requiresCareerV71,true);assert.equal(scene.choices.length,3);assert.equal(scene.choices[2].wild,true);
  assert.equal(new Set(scene.choices.map(choice=>choice.text)).size,3);assert.ok(scene.body.length>45);assert.ok(scene.choices.every(choice=>choice.result.length>25));
  assert.doesNotMatch(scene.choices.map(choice=>choice.text).join(' '),/成功率|機率|\d+%|好感[+−-]/);
 }
 for(const voice of Object.values(RELATIONSHIP_VOICES_V72))for(const kind of ['help','cover','refusal','argument','backstab'])assert.ok(voice[kind].length>15);
 const kind=RELATIONSHIP_EVENTS_V72.find(row=>row.id==='relationship72-kind-network');
 assert.ok(kind.choices[0].flags.includes('relationship72_kind_network'));assert.ok(!kind.choices[1].flags.includes('relationship72_kind_network'));
});

test('relationship tiers are bounded opportunity ranges rather than a guaranteed result',()=>{
 for(const [score,tier] of [[0,'hostile'],[15,'hostile'],[16,'strained'],[30,'strained'],[31,'ordinary'],[64,'ordinary'],[65,'trusted'],[79,'trusted'],[80,'close'],[100,'close']])assert.equal(relationshipTierV72(score),tier);
 const run=unit('jack',[7,7,7]),before=copy(run);
 assert.equal(relationshipPulseV72(run,event('jack'),{choiceIndex:0},()=>.9),null);
 assert.equal(relationshipPulseV72(run,event('jack'),{choiceIndex:0},()=>0).reaction,'help');
 assert.equal(relationshipPulseV72(run,event('jack'),{choiceIndex:0},()=>.35).reaction,'cover');
 assert.deepEqual(run,before);
});

test('every current person can help or refuse, while only explicitly reported backstabs affect Wing mood',()=>{
 for(const target of Object.keys(PERSONAS)){
  const warm=relationshipPulseV72(unit(target,[7,7,7]),event(target),{choiceIndex:0},()=>0);
  const cold=relationshipPulseV72(unit(target,[-12,-12,-12]),event(target),{choiceIndex:0},()=>.58);
  assert.equal(warm.relationshipOutcome.target,target);assert.equal(warm.reaction,'help');assert.ok(warm.delta.energy>0);
  assert.equal(cold.relationshipOutcome.target,target);assert.equal(cold.reaction,'backstab');assert.ok(cold.delta.energy<0);
  assert.equal(cold.delta.boss||0,RELATIONSHIP_VOICES_V72[target].report?-3:0);
  if(cold.delta.boss)assert.match(cold.result,/翅膀/);
 }
});

test('only committed pre-choice affinity counts and ordinary affinity consumes no extra random draw',()=>{
 const run=unit('jack',[0,0,0]);let draws=0;
 assert.equal(relationshipPulseV72(run,event('jack'),{choiceIndex:0,delta:{trust:99}},()=>{draws++;return 0;}),null);
 assert.equal(draws,0);
 const one=unit('jack',[12]);assert.equal(relationshipPulseV72(one,event('jack'),{choiceIndex:0},()=>0),null);
});

test('relationships cannot interrupt PIP, pending results, activities, meals, personnel or a collapsing resource',()=>{
 const base=unit('jack',[7,7,7]);
 for(const patch of [{seed:'e39-r71-n-'+'a'.repeat(22)},{pending:true},{completed:true},{pip:{active:true}},{activityContext:{}},{companyContext:{}},{mealContext:{}},{personnelPending:{}},{flags:{floor_watch:1}},{stats:{...base.stats,energy:15}},{stats:{...base.stats,mood:12}}]){
  const run={...base,...patch};assert.equal(relationshipPulseV72(run,event('jack'),{choiceIndex:0},()=>{throw Error('must not draw');}),null);
 }
 for(const kind of ['onboarding','career','company','self-care','activity','verbal'])assert.equal(relationshipPulseV72(base,{...event('jack'),kind},{choiceIndex:0},()=>0),null);
 assert.equal(relationshipPulseV72(base,event('jack'),{choiceIndex:0,verbalOutcome:{}},()=>0),null);
});

test('threshold selection checks actual affinity and role, has a cooldown, and never mutates a source or discloses future outcomes',()=>{
 const run=unit('jack',[7,7,7]),scene=RELATIONSHIP_EVENTS_V72.find(row=>row.speaker==='jack'),before=copy(run);
 assert.equal(relationshipEventAllowedV72(run,scene),true);assert.equal(selectRelationshipEventV72(run,[scene],()=>0),scene.id);
 assert.equal(selectRelationshipEventV72(run,[scene],()=>.9),null);assert.equal(relationshipEventAllowedV72({...run,seed:'e39-r71-n-'+'a'.repeat(22)},scene),false);
 const seen={...run,seen:[scene.id]};assert.equal(selectRelationshipEventV72(seen,[scene],()=>0),null);
 const recent={...run,history:[...run.history,{...run.history.at(-1),turn:6,eventId:scene.id}]};assert.equal(relationshipEventAllowedV72(recent,scene),false);
 assert.deepEqual(run,before);
});

test('typed relationship evidence adds affinity once to one encounter, without duplicating choice, weather or hit counters',()=>{
 const row={eventId:'unit-current',kind:'daily',speaker:'jack',choiceIndex:0,turn:3,result:'交情後續',breakdown:[{source:'choice',delta:{trust:5}},{source:'relationship',delta:{trust:2,energy:7}},{source:'weather',delta:{boss:12,trust:20}}],relationshipOutcome:outcome()};
 const run={seed,history:[row]};assert.equal(isRelationshipOutcomeV72(run,row),true);
 const result=deriveCharacterStats(run).find(person=>person.id==='jack');assert.equal(result.encounters,1);assert.equal(result.affinityGained,7);assert.equal(result.affinityLost,0);assert.equal(result.imaginedHits,0);assert.equal(result.realHits,0);
 assert.equal(deriveCharacterStats(run).find(person=>person.id==='wing').affinityGained,0);
 assert.equal(characterAffinity({...run,seed:'e39-r71-n-'+'a'.repeat(22)},'jack').score,55,'published cohorts retain the original choice-only projection');
 for(const changed of [{...outcome(),affinityDelta:99},{...outcome(),target:'wing'},{...outcome(),tier:'hostile'},{...outcome(),origin:'other'},{...outcome(),extra:true}]){
  const invalid={...row,relationshipOutcome:changed};assert.equal(isRelationshipOutcomeV72(run,invalid),false);assert.equal(deriveCharacterStats({seed,history:[invalid]}).find(person=>person.id==='jack').encounters,0);
 }
});

function canonical(run){assert.equal(E.validRun(run),true);assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run.pending?E.advance(run):run);}
let witnessCache;
function witnesses(){
 if(witnessCache)return witnessCache;
 const found={reactions:{}};
 for(let attempt=0;attempt<120&&(!found.help||!found.hostile||!found.scene||Object.keys(found.reactions).length<5);attempt++){
  const marker=attempt%2?'s':'d',value=`e39-r72-${marker}-`+attempt.toString(16).padStart(22,'0');
  let run=E.enableActivitySchedule(E.createRun(directEntryV60(value).roleId,value)),insulted=false;
  for(let step=0;step<160&&!run.completed&&run.actions.length<280;step++){
   const current=E.getEvent(run);
   if(current.requiresRelationshipV72){found.scene??=run;canonical(run);}
   if(current.kind==='daily'&&!run.pip?.active&&!current.requiresRelationshipV72){
    for(let index=0;index<current.choices.length;index++)if(current.choices[index].available!==false){
     const pending=E.applyChoice(run,index),pulse=pending.history.at(-1)?.relationshipOutcome;
     if(pulse){const kind=['help','cover'].includes(pulse.reaction)?'help':'hostile';found[kind]??={before:run,pending};found.reactions[pulse.reaction]??={before:run,pending};}
    }
    if(!insulted&&run.turn>=3&&(current.speaker||'wing')==='wing'&&E.canRequestVerbal(run)){
     const spoken=E.requestVerbal(run,undefined,2);if(spoken!==run){run=E.advance(spoken);insulted=true;continue;}
    }
   }
   if(E.isWorkGapOpenV50(run)&&E.canRequestBreak(run)&&(run.stats.energy<=30||run.stats.mood<=30)){run=E.requestBreak(run);continue;}
   if(E.getActivityPlayV55(run)){if(E.getEventDepartureV63(run)?.available){run=E.advance(E.requestEventDepartureV63(run));continue;}break;}
   if(E.getShareholderPlayV58(run)){run=E.advance(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));continue;}
   let index=0;
   if(current.kind==='activity-invitation')index=1;
   else if(current.id==='shareholder58-offer')index=2;
   else if(['kind-break','kind-workday'].includes(current.id))index=2;
   else if(current.id==='self-care'){
    index=current.choices.findIndex(choice=>/沒人叫醒的覺/.test(choice.text)&&choice.available!==false);
    if(index<0)index=current.choices.findIndex(choice=>choice.effect==='cancelBreak');
   }else if(['career-review','wealth-plan'].includes(current.id))index=2;
   else if(current.kind==='daily')index=current.choices.findIndex(choice=>choice.available!==false&&/核對|確認|範圍|紀錄|依據|交付|寫清楚|說清楚|原始|窗口/.test(choice.text));
   if(index<0||!current.choices[index]||current.choices[index].available===false)index=current.choices.findIndex(choice=>choice.available!==false);
   if(index<0)break;
   run=E.advance(E.applyChoice(run,index));
  }
 }
 if(!found.help||!found.hostile||!found.scene||Object.keys(found.reactions).length<5)throw Error('Missing naturally acquired relationship witnesses: '+JSON.stringify(Object.keys(found)));
 witnessCache=found;return found;
}

test('naturally acquired friendships and grudges produce visible support/conflict with exact canonical replay',()=>{
 const found=witnesses();
 assert.deepEqual(Object.keys(found.reactions).sort(),['argument','backstab','cover','help','refusal']);
 for(const [reaction,{before,pending}] of Object.entries(found.reactions)){
  const kind=['help','cover'].includes(reaction)?'help':'hostile',row=pending.history.at(-1);canonical(before);canonical(pending);
  const affinityBefore=characterAffinity(before,row.speaker).score;assert.ok(kind==='help'?affinityBefore>=65:affinityBefore<=30);
  assert.equal(isRelationshipOutcomeV72(pending,row),true);assert.match(row.result,/交情後續/);assert.ok(row.breakdown.some(part=>part.source==='relationship'));
  const old=deriveCharacterStats(before).find(person=>person.id===row.speaker),next=deriveCharacterStats(pending).find(person=>person.id===row.speaker);
  assert.equal(next.encounters,old.encounters+1);assert.equal(next.imaginedHits,old.imaginedHits);assert.equal(next.realHits,old.realHits);
  assert.ok(row.relationshipOutcome.affinityDelta*(kind==='help'?1:-1)>0);
 }
});

test('a naturally qualified relationship story keeps its own ID, reveals effects only after a real choice and can continue normally',()=>{
 const run=witnesses().scene,event=E.getEvent(run);canonical(run);
 assert.ok(event.id.startsWith('relationship72-'));assert.equal(event.requiresRelationshipV72,true);
 const before=copy(run),pending=E.applyChoice(run,0);canonical(pending);assert.equal(pending.history.at(-1).eventId,event.id);assert.equal(pending.history.at(-1).relationshipOutcome,undefined);
 const after=E.advance(pending);assert.ok(after.turn>=run.turn);assert.deepEqual(run,before);assert.equal(E.advance(after),after);
});
