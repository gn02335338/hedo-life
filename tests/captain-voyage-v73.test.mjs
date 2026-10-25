import test from 'node:test';
import assert from 'node:assert/strict';
import {isCaptainVoyageV73} from '../dist/captain-profile-v73.js';
import {CAPTAIN_EPISODE_IDS_V73,dueCaptainVoyageV73,createCaptainVoyageContextV73,getCaptainVoyageEventV73,resolveCaptainVoyageChoiceV73,isCaptainVoyageOutcomeV73,captainVoyagePhaseV73} from '../dist/captain-voyage-v73.js';
import {deriveCharacterStats} from '../dist/character-stats.js';

const copy=value=>structuredClone(value);
// Isolated rule/projection fixtures, not claimed as canonical game routes.
// The engine suite separately replays invitations earned by real public actions.
const life=(attempt=0)=>({seed:'e39-r73-n-'+attempt.toString(16).padStart(22,'0'),characterGender:'male',turn:7,stats:{cash:40,energy:80,mood:80,boss:50,trust:50},flags:{},history:[],rng:123456,seen:[]});
const affinity={score:70,encounters:2};
const eligible=()=>{for(let n=0;n<128;n++){const run=life(n);if(dueCaptainVoyageV73(run,affinity))return run;}throw Error('No eligible invitation sample');};
function scene(episode='boarding',stage){
 for(let n=0;n<128;n++){
  const run=life(n),context=createCaptainVoyageContextV73(run,'source-work');
  const selected=stage??(episode==='boarding'?0:episode==='harbor'?3:context.episodes.indexOf(episode)+1);
  if(selected<0||selected===0&&!['boarding'].includes(episode))continue;
  if(selected===1||selected===2){if(context.episodes[selected-1]!==episode)continue;}
  run.captainVoyageContext={...context,stage:selected};return run;
 }
 throw Error('Missing scene sample '+episode);
}
const rowFor=(run,index,ticket=.5)=>{const event=getCaptainVoyageEventV73(run),resolved=resolveCaptainVoyageChoiceV73(run,index,ticket);return {eventId:event.id,kind:event.kind,speaker:event.speaker,turn:run.turn,choiceIndex:index,choiceText:resolved.choiceText,result:resolved.result,captainVoyageOutcome:resolved.outcome,delta:{trust:99,boss:99},breakdown:[{source:'choice',delta:{trust:99,boss:99}},{source:'weather',delta:{trust:99,boss:99}}]};};

test('exact r73 and inherited r74 profiles enable the voyage, including both special entry markers',()=>{
 for(const profile of [73,74])for(const marker of ['n','s','d'])assert.equal(isCaptainVoyageV73('e39-r'+profile+'-'+marker+'-'+'a'.repeat(22)),true);
 for(const value of [null,undefined,'',life().seed+'a','e39-r72-n-'+'a'.repeat(22),'e39-r75-n-'+'a'.repeat(22),'e39-r73-x-'+'a'.repeat(22),'e39-r73-n-'+'A'.repeat(22),'e39-r73-n-'+'a'.repeat(21)])assert.equal(isCaptainVoyageV73(value),false);
 assert.equal(isCaptainVoyageV73(life()),true);
});

test('male character, real contact count, affection and safe resources are all required before the seeded invitation chance',()=>{
 const run=eligible(),before=copy(run);assert.equal(dueCaptainVoyageV73(run,affinity),true);
 for(const patch of [{seed:'e39-r72-n-'+'a'.repeat(22)},{characterGender:'female'},{characterGender:undefined},{flags:{} ,turn:2},{turn:23},{turn:NaN},{stats:undefined},{stats:{...run.stats,energy:39}},{stats:{...run.stats,mood:34}},{pending:true},{completed:true},{pendingFamily:'retired'},{pip:{active:true}},{flags:{floor_watch:1}},{flags:{captain73_offered:1}},{salaryAdvice:{status:'open'}}])assert.equal(dueCaptainVoyageV73({...run,...patch},affinity),false,JSON.stringify(patch));
 for(const supplied of [null,{}, {score:69,encounters:2},{score:100,encounters:1},{score:70},{score:Infinity,encounters:2},{score:70,encounters:2.5}])assert.equal(dueCaptainVoyageV73(run,supplied),false);
 for(const key of ['captainVoyageContext','treatsContext','blockchainContext','recruitmentContext','shareholderContext','activityInvitationContext','hiddenEncounterContext','activityContext','chapterContext','companyContext','rageContext','verbalContext','patronageReplyContext','patronageContext','raiseContext','mealContext','personnelPending','departureContext'])assert.equal(dueCaptainVoyageV73({...run,[key]:{}},affinity),false,key);
 assert.deepEqual(run,before);
});

test('the invitation is seeded, repeat reads consume no RNG, and affection never guarantees an offer',()=>{
 let low=0,high=0;
 for(let n=0;n<128;n++){
  const run=life(n),before=copy(run),normal=dueCaptainVoyageV73(run,affinity),close=dueCaptainVoyageV73(run,{score:100,encounters:8});
  for(let repeat=0;repeat<3;repeat++)assert.equal(dueCaptainVoyageV73(run,affinity),normal);
  if(normal)low++;if(close)high++;if(normal)assert.equal(close,true);
  assert.equal(dueCaptainVoyageV73({...run,flags:{captain73_offered:1}},{score:100,encounters:8}),false);
  assert.deepEqual(run,before);
 }
 assert.ok(low>0&&low<128);assert.ok(high>=low&&high<128);
});

test('each four-scene voyage chooses two different outings and exposes only the current scene',()=>{
 const seen=new Set(),plans=new Set();assert.equal(CAPTAIN_EPISODE_IDS_V73.length,5);
 for(let n=0;n<64;n++){
  const run=life(n),before=copy(run),context=createCaptainVoyageContextV73(run,'source-work');
  assert.equal(context.version,1);assert.equal(context.startTurn,run.turn);assert.equal(context.stage,0);assert.equal(context.returnEventId,'source-work');
  assert.equal(context.episodes.length,2);assert.equal(new Set(context.episodes).size,2);context.episodes.forEach(id=>{assert.ok(CAPTAIN_EPISODE_IDS_V73.includes(id));seen.add(id);});plans.add(context.episodes.join('/'));
  assert.deepEqual(createCaptainVoyageContextV73(run,'source-work'),context);assert.deepEqual(run,before);
 }
 assert.equal(seen.size,5);assert.ok(plans.size>5);
 for(const episode of ['boarding',...CAPTAIN_EPISODE_IDS_V73,'harbor']){
  const run=scene(episode),before=copy(run),event=getCaptainVoyageEventV73(run);
  assert.equal(event.kind,'captain-voyage');assert.equal(event.scope,'private');assert.equal(event.privateContext,true);assert.equal(event.captainVoyage.total,4);assert.equal(event.captainVoyage.episode,episode);
  assert.ok(event.choices.length>=3);assert.ok(event.choices.some(choice=>choice.wild));assert.ok(event.choices.some(choice=>/下船|不上船|自己的安排/.test(choice.text)));
  for(const choice of event.choices){assert.equal(choice.detail,'');assert.doesNotMatch(choice.text,/[+-]\d|\d+%|成功率|好感[+−-]|機率\s*[:：]/);}
  assert.doesNotMatch([event.body,event.wing,...event.choices.map(choice=>choice.text)].join(' '),/notion(?:\.com|\.so|-file-block)|https?:\/\/|\/Users\/|user:\/\/|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/);
  for(let i=0;i<3;i++)assert.deepEqual(getCaptainVoyageEventV73(run),event);assert.deepEqual(run,before);
 }
});

test('preview mutation cannot rewrite authored variants, and even broke players have a free way out',()=>{
 for(const episode of ['boarding',...CAPTAIN_EPISODE_IDS_V73,'harbor']){
  const run=scene(episode),original=copy(getCaptainVoyageEventV73(run)),changed=getCaptainVoyageEventV73(run);
  changed.choices[0].delta.mood=999;changed.choices[0].text='forged text';changed.verbalLinesV73[0]='forged voice';for(const lines of Object.values(changed.verbalTargetsV73))lines[0]='forged target voice';
  if(changed.choices[1]?.outcomes)changed.choices[1].outcomes[0].delta.mood=999;
  assert.deepEqual(getCaptainVoyageEventV73(run),original,episode);
  run.stats.cash=0;const poor=getCaptainVoyageEventV73(run);
  assert.ok(poor.choices.some(choice=>choice.available!==false),'must never strand an insolvent player');
  for(const [index,choice]of poor.choices.entries()){
   if(choice.available===false)assert.throws(()=>resolveCaptainVoyageChoiceV73(run,index,.5));
   else assert.ok((resolveCaptainVoyageChoiceV73(run,index,.5).delta.cash||0)>=0,'available choice may not charge nonexistent cash');
  }
 }
});

test('boarding accepts or declines explicitly, and every later scene can end the private trip without a job ending',()=>{
 const invite=scene(),before=copy(invite),yes=resolveCaptainVoyageChoiceV73(invite,0),no=resolveCaptainVoyageChoiceV73(invite,1),goose=resolveCaptainVoyageChoiceV73(invite,2);
 assert.equal(yes.joined,true);assert.equal(yes.done,false);assert.equal(yes.nextStage,1);assert.equal(yes.outcome.decision,'aboard');
 assert.equal(no.joined,false);assert.equal(no.done,true);assert.equal(no.outcome.decision,'refused');assert.equal(no.delta.cash,undefined);assert.equal(no.effect,undefined);assert.equal(no.family,undefined);
 assert.equal(goose.joined,true);assert.equal(goose.done,false);assert.deepEqual(invite,before);
 for(const episode of [...CAPTAIN_EPISODE_IDS_V73,'harbor']){
  const run=scene(episode),event=getCaptainVoyageEventV73(run),leave=event.choices.findIndex(choice=>/下船/.test(choice.text));assert.ok(leave>=0);
  const result=resolveCaptainVoyageChoiceV73(run,leave);assert.equal(result.done,true);assert.equal(result.joined,false);assert.equal(result.outcome.decision,'left');
  assert.equal(result.effect,undefined);assert.equal(result.family,undefined);assert.equal(result.delta.boss,undefined);assert.equal(result.luckDelta.boss,undefined);
 }
 for(const value of [-.1,1,NaN,Infinity])assert.throws(()=>resolveCaptainVoyageChoiceV73(invite,0,value));
 for(const index of [-1,.5,99])assert.throws(()=>resolveCaptainVoyageChoiceV73(invite,index));
});

test('restaurant banter can be laughed off or end only this trip, with consequences revealed after selection',()=>{
 const run=scene('dinner'),before=copy(run),event=getCaptainVoyageEventV73(run),good=resolveCaptainVoyageChoiceV73(run,1,.2),bad=resolveCaptainVoyageChoiceV73(run,1,.8);
 assert.equal(good.done,false);assert.equal(good.joined,true);assert.ok(good.outcome.affinityDelta>0);assert.match(good.outcome.result,/laughed$/);
 assert.equal(bad.done,true);assert.equal(bad.joined,false);assert.ok(bad.outcome.affinityDelta<0);assert.equal(bad.outcome.decision,'kicked');assert.match(bad.result,/工作還在/);
 assert.equal(event.choices[1].text,getCaptainVoyageEventV73(run).choices[1].text);assert.notEqual(good.result,bad.result);assert.deepEqual(run,before);
 assert.equal(bad.delta.boss,undefined);assert.equal(bad.luckDelta.boss,undefined);assert.equal(bad.effect,undefined);
});

test('typed voyage history changes one actual speaker once and never converts team trust or weather into extra affection',()=>{
 for(const episode of ['boarding',...CAPTAIN_EPISODE_IDS_V73,'harbor']){
  const run=scene(episode),row=rowFor(run,0),tracked={...run,history:[row]};
  assert.equal(isCaptainVoyageOutcomeV73(tracked,row),true,episode);
  const rows=deriveCharacterStats(tracked),target=rows.find(person=>person.id===row.speaker);
  assert.equal(target.encounters,1);assert.equal(target.affinityGained,Math.max(0,row.captainVoyageOutcome.affinityDelta));assert.equal(target.affinityLost,Math.max(0,-row.captainVoyageOutcome.affinityDelta));
  assert.equal(target.imaginedHits,0);assert.equal(target.realHits,0);assert.equal(rows.reduce((sum,value)=>sum+value.encounters,0),1);
  assert.equal(rows.find(person=>person.id==='wing').affinityGained,0);
  if(episode==='cola'){assert.equal(row.speaker,'jack');assert.equal(rows.find(person=>person.id==='captain').affinityGained,0);}
 }
});

test('forged, mixed, stale-cohort and skipped-scene metadata receive no voyage counters',()=>{
 const run=scene('dinner'),row=rowFor(run,1,.8),valid={...run,history:[row]};assert.equal(isCaptainVoyageOutcomeV73(valid,row),true);
 const o=row.captainVoyageOutcome;
 const variants=[{...row,captainVoyageOutcome:{...o,version:2}},{...row,captainVoyageOutcome:{...o,affinityDelta:999}},{...row,captainVoyageOutcome:{...o,target:'wing'}},{...row,captainVoyageOutcome:{...o,target:'__proto__'}},{...row,captainVoyageOutcome:{...o,decision:'aboard'}},{...row,captainVoyageOutcome:{...o,extra:true}},{...row,eventId:'captain73-3-harbor'},{...row,turn:row.turn+.5},{...row,choiceIndex:99},{...row,verbalOutcome:{kind:'ignored',target:'captain',affinityDelta:0}}];
 for(const changed of variants){const checked={...run,history:[changed]};assert.equal(isCaptainVoyageOutcomeV73(checked,changed),false);assert.equal(deriveCharacterStats(checked).reduce((sum,value)=>sum+value.encounters,0),0);}
 const old={...valid,seed:valid.seed.replace('-r73-','-r72-')};assert.equal(isCaptainVoyageOutcomeV73(old,row),false);assert.equal(deriveCharacterStats(old).reduce((sum,value)=>sum+value.encounters,0),0);
});

test('voyage phase stays in progress until the current result has actually committed a finish',()=>{
 const boarding=scene(),event=getCaptainVoyageEventV73(boarding);assert.equal(captainVoyagePhaseV73(boarding,event).phase,'start');
 const final=scene('harbor'),last=getCaptainVoyageEventV73(final);assert.equal(captainVoyagePhaseV73(final,last).phase,'progress');
 const pending={...final,pending:true,history:[rowFor(final,0)]};assert.equal(captainVoyagePhaseV73(pending,last).phase,'end');
 const refused={...boarding,pending:true,history:[rowFor(boarding,1)]};assert.equal(captainVoyagePhaseV73(refused,event).phase,'end');
 const stale={...pending,history:[rowFor(boarding,1)]};assert.equal(captainVoyagePhaseV73(stale,last).phase,'progress');
 const forged={...pending,history:[{...pending.history[0],captainVoyageOutcome:{...pending.history[0].captainVoyageOutcome,version:2}}]};assert.equal(captainVoyagePhaseV73(forged,last).phase,'progress');
 assert.equal(captainVoyagePhaseV73(boarding,{...event,id:'another-scene'}),null);
});
