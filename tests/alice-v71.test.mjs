import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import {EVENTS} from '../dist/events.js';
import {PERSONAS} from '../dist/persona.js';
import {ALICE_EVENTS_V71} from '../dist/events-alice-v71.js';
import {isCareerContentV71} from '../dist/career-content-v71.js';
import {getMealEventV65} from '../dist/meals-cast-v65.js';
import {getMealEventV71,aliceInvitationProfileV71,getRageV71,withAliceVerbalScenarioV71} from '../dist/alice-interactions-v71.js';
import {deriveCharacterStats,isMealOutcomeV36} from '../dist/character-stats.js';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {patronageReplyLineV43,patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';

const seedFor=index=>'e39-r71-n-'+index.toString(16).padStart(22,'0');
const meal=(profile=71,page=3,guest=null)=>({seed:`e39-r${profile}-n-${'a'.repeat(22)}`,actualRoleId:'project',roleId:'project',rank:1,turn:5,stats:{cash:70,mood:60,energy:60,trust:50,boss:50},flags:{},history:[],eventId:guest?`meal-with-${guest}`:`meal-guests-${['a','b','c','d'][page]}`,mealContext:{origin:'self-care',page,guest}});
const canonical=run=>{assert.equal(E.validRun(run),true,run.eventId);assert.deepEqual(E.replayRun(run.roleId,run.seed,run.actions),run.pending?E.advance(run):run);};
let cache;
// Every witness is reached through real onboarding, work, warning gaps and
// invitation replies. Tests never inject moods, wallets, friends or RNG.
function witnesses(){
 if(cache)return cache;
 const found={paid:{}};
 for(let seed=0;seed<200;seed++){
  let run=E.enableActivitySchedule(E.createRun('hr',seedFor(seed)));
  for(let step=0;step<110&&!run.completed;step++){
   const event=E.getEvent(run);
   if(event.speaker==='alice'&&event.kind==='daily'){
    found.daily??=run;
    if(event.participants?.includes('captain'))found.group??=run;
    const hit=E.requestRage(run);found[hit.rageContext.mode]??={before:run,pending:hit};
   }
   if(E.canRequestBreak(run)){
    const br=E.requestBreak(run);let menu=br;
    if(menu.eventId==='kind-break')menu=E.advance(E.applyChoice(menu,2));
    if(menu.eventId==='self-care'&&menu.stats.cash>12){
     menu=E.advance(E.applyChoice(menu,E.getEvent(menu).choices.findIndex(choice=>choice.effect==='mealOpen')));
     for(let page=1;page<=3;page++)menu=E.advance(E.applyChoice(menu,E.getEvent(menu).choices.findIndex(choice=>choice.effect==='mealPage'&&choice.mealPage===page)));
     const index=E.getEvent(menu).choices.findIndex(choice=>choice.mealTarget==='alice'),pending=E.applyChoice(menu,index),after=E.advance(pending);
     if(after.eventId==='meal-with-alice'){
      found.accepted??={before:menu,pending,after};
      for(const reply of [0,1]){
       const paid=E.applyChoice(after,reply),reaction=paid.history.at(-1).mealOutcome.reaction;
       found.paid[reaction]??={before:after,pending:paid,after:E.advance(paid)};
      }
     }else found.declined??={before:menu,pending,after};
    }
    run=br;continue;
   }
   let index=event.id==='self-care'?(run.stats.cash>=12?1:event.choices.findIndex(choice=>choice.effect==='cancelBreak')):['kind-break','kind-workday'].includes(event.id)?2:['wealth-plan','career-review'].includes(event.id)?2:event.kind==='daily'?2:0;
   if(!event.choices[index]||event.choices[index].available===false)index=event.choices.findIndex(choice=>choice.available!==false);
   if(index<0)break;
   run=E.advance(E.applyChoice(run,index));
  }
  if(found.daily&&found.group&&found.imagined&&found.real&&found.accepted&&found.declined&&Object.keys(found.paid).length===3){cache=found;return found;}
 }
 throw Error('Missing naturally played Alice witness: '+JSON.stringify(Object.fromEntries(Object.entries(found).map(([key,value])=>[key,key==='paid'?Object.keys(value):!!value]))));
}

test('Alice has 33 distinct original daily stories, a neutral public portrait, wild replies and two explicit card invitations',()=>{
 assert.equal(ALICE_EVENTS_V71.length,33);assert.equal(new Set(ALICE_EVENTS_V71.map(event=>event.id)).size,33);assert.equal(new Set(ALICE_EVENTS_V71.map(event=>event.body)).size,33);
 assert.equal(PERSONAS.alice.name,'愛麗絲');assert.equal(PERSONAS.alice.image,'./assets/alice.png');assert.doesNotMatch(PERSONAS.alice.about,/偽娘|性別|男生|女生/);
 const invited=[];
 for(const event of ALICE_EVENTS_V71){assert.equal(EVENTS.includes(event),true);assert.equal(event.requiresCareerV71,true);assert.equal(event.speaker,'alice');assert.equal(event.choices.length,3);assert.equal(event.choices[2].wild,true);assert.equal(event.verbalLinesV71.length,2);for(const choice of event.choices)assert.ok(choice.result.length>20);if(event.choices[0].flags.includes('cards71_invited'))invited.push(event.id);}
 assert.deepEqual(invited,['alice71-first-pull','alice71-game-invite']);
});

test('strict fresh cohort gates keep historical event access, dinner pages and character evidence unchanged',()=>{
 assert.equal(isCareerContentV71(seedFor(0)),true);
 for(const suffix of ['e39-r70-n-'+ 'a'.repeat(22),'e39-r72-n-'+ 'a'.repeat(22),'e39-r71-n-'+ 'A'.repeat(22),'e39-r71-x-'+ 'a'.repeat(22),seedFor(0)+'x'])assert.equal(isCareerContentV71(suffix),false);
 for(const profile of [64,65,66,67,68,69,70])for(const page of [0,1,2,3]){
  const run=meal(profile,page);
  if(profile<65&&page===3){assert.throws(()=>getMealEventV71(run));assert.throws(()=>getMealEventV65(run));}
  else assert.deepEqual(getMealEventV71(run),getMealEventV65(run));
  const source=E.createRun('hr',run.seed),bad={...source,eventId:'alice71-first-pull'};assert.throws(()=>E.getEvent(bad),/Unknown event/);
  const row={eventId:'alice71-first-pull',kind:'daily',speaker:'alice',choiceIndex:0,turn:2,breakdown:[{source:'choice',delta:{trust:6}}]};
  assert.equal(deriveCharacterStats({...run,history:[row]}).find(person=>person.id==='alice').encounters,0);
 }
});

test('only fresh fourth-page menus append Alice without moving the six established invitations',()=>{
 const run=meal(),old=getMealEventV65(run),next=getMealEventV71(run);
 assert.deepEqual(next.choices.slice(0,6),old.choices.slice(0,6));assert.deepEqual(next.choices.slice(7),old.choices.slice(6));assert.equal(next.choices[6].mealTarget,'alice');assert.equal(next.choices[6].mealCost,12);assert.equal(next.privateContext,true);
 assert.ok(next.choices[6].draw.outcomes.every(outcome=>Object.keys(outcome.delta).length===0));assert.equal(getMealEventV71({...run,flags:{meal_invite_alice_day_5:1}}).choices[6].available,false);
 const dinner=getMealEventV71(meal(71,3,'alice'));for(const choice of dinner.choices.slice(0,2)){assert.deepEqual(choice.draw.outcomes.map(row=>row.mealOutcome.reaction),['warm','neutral','mine']);assert.ok(choice.draw.outcomes.every(row=>row.weight>0));assert.equal(choice.mealCost,12);}
});

test('natural accepted and refused invitations replay without charges or extra work/PIP turns and cannot reroll a refusal',()=>{
 const found=witnesses();
 for(const kind of ['accepted','declined']){
  const {before,pending,after}=found[kind];canonical(before);canonical(pending);canonical(after);
  assert.deepEqual(pending.stats,before.stats);for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(after[key],before[key]);
  assert.equal(after.stats.cash,before.stats.cash);assert.equal(after.mealContext.page,3);
 }
 const {after}=found.declined,index=E.getEvent(after).choices.findIndex(choice=>choice.mealTarget==='alice');assert.equal(E.getEvent(after).choices[index].available,false);assert.throws(()=>E.applyChoice(after,index),/Unavailable/);
});

test('all three naturally rolled dinner reactions debit one meal and update only verified Alice affinity',()=>{
 const found=witnesses();
 for(const reaction of ['warm','neutral','mine']){
  const {before,pending,after}=found.paid[reaction];canonical(pending);canonical(after);const row=pending.history.at(-1);
  assert.equal(isMealOutcomeV36(pending,row),true);assert.equal(row.mealOutcome.target,'alice');assert.equal(row.mealOutcome.reaction,reaction);assert.equal(pending.stats.cash,before.stats.cash-12);assert.equal(after.stats.cash,pending.stats.cash);assert.equal(after.mealContext,null);
  for(const key of ['turn','pay','pip','pipCount'])assert.deepEqual(after[key],before[key]);
  const old=deriveCharacterStats(before).find(person=>person.id==='alice'),now=deriveCharacterStats(after).find(person=>person.id==='alice');assert.equal(now.encounters,old.encounters+1);
  if(reaction==='warm')assert.ok(now.affinityGained>old.affinityGained);if(reaction==='mine')assert.ok(now.affinityLost>old.affinityLost);if(reaction==='neutral'){assert.equal(now.affinityGained,old.affinityGained);assert.equal(now.affinityLost,old.affinityLost);}
 }
});

test('natural Alice meetings support scene-aware speech, distinct dream/real hits and exact replay counters',()=>{
 const found=witnesses(),source=found.daily;canonical(source);assert.ok(E.getRageTargets(source).includes('alice'));assert.ok(E.getVerbalTargets(source).includes('alice'));
 const line=E.getVerbalLine(source,'alice');assert.match(line,/愛麗絲/);assert.match(line,/幹|靠北/);
 const spoken=E.requestVerbal(source,undefined,2);canonical(spoken);assert.equal(spoken.history.at(-1).speaker,'alice');assert.equal(spoken.history.at(-1).result.includes(line),false);
 for(const mode of ['imagined','real']){
  const {before,pending}=found[mode];canonical(pending);assert.equal(pending.rageContext.mode,mode);assert.equal(pending.history.at(-1).speaker,'alice');assert.equal(pending.stats.boss,before.stats.boss);
  const old=deriveCharacterStats(before).find(person=>person.id==='alice'),now=deriveCharacterStats(pending).find(person=>person.id==='alice');assert.equal(now.realHits-old.realHits,mode==='real'?1:0);assert.equal(now.imaginedHits-old.imaginedHits,mode==='imagined'?1:0);
  if(mode==='real')assert.equal(E.getEvent(E.advance(pending)).id,'rage-aftermath');
 }
 const friendly=E.applyChoice(source,0);assert.ok(aliceInvitationProfileV71(friendly).acceptChance>aliceInvitationProfileV71(source).acceptChance);
});

test('private Alice dinners keep spoken and physical disputes personal without automatically changing employment',()=>{
 const before=witnesses().accepted.after;
 const spoken=E.requestVerbal(before,undefined,2);canonical(spoken);assert.equal(spoken.history.at(-1).verbalOutcome.kind==='personnel',false);assert.equal(spoken.stats.boss,before.stats.boss);assert.match(spoken.history.at(-1).choiceText,/這頓飯|晚餐/);
 const hit=E.requestRage(before);canonical(hit);assert.equal(hit.stats.boss,before.stats.boss);const after=E.advance(hit);assert.equal(after.completed,false);if(hit.rageContext.mode==='real')assert.equal(E.getEvent(after).scope,'private');
});

test('naturally co-present Alice and captain each accept explicit interaction targets through the strict HTTP grammar',()=>{
 const run=witnesses().group;canonical(run);assert.deepEqual(E.getRageTargets(run),['alice','captain']);
 for(const target of ['alice','captain']){
  for(const next of [E.requestRage(run,target),E.requestVerbal(run,target,2)]){
   assert.equal(next.actions.at(-1).target,target);assert.equal(next.history.at(-1).speaker,target);canonical(next);
   assert.doesNotThrow(()=>validateCompletion({runId:'123e4567-e89b-42d3-a456-426614174000',roleId:next.roleId,seed:next.seed,actions:next.actions},ROLE_MAP));
  }
 }
 assert.equal(E.requestRage(run,'wing'),run);assert.equal(E.requestVerbal(run,'wing',2),run);
});

test('Alice voice wrappers retain outcome weights and numeric consequences and never affect an older life',()=>{
 const run={...meal(),rageContext:{target:'alice',eventId:'alice71-first-pull',phase:'event'},eventId:'rage-release'},release=getRageV71(run);assert.deepEqual(release.choices[0].draw.outcomes.map(row=>row.label),['腦內劇場','真的失控了']);assert.equal(release.choices[0].draw.outcomes.reduce((sum,row)=>sum+row.weight,0),100);
 const source={id:'alice71-first-pull',choices:[{draw:{outcomes:[{verbalKind:'ignored',weight:9,result:'original',delta:{mood:3},effect:'verbalV2Resolve'}]}}]},context={target:'alice',stage:'release'},wrapped=withAliceVerbalScenarioV71(source,{...meal(),verbalContext:context});assert.equal(wrapped.choices[0].draw.outcomes[0].weight,9);assert.deepEqual(wrapped.choices[0].draw.outcomes[0].delta,{mood:3});assert.equal(source.choices[0].draw.outcomes[0].result,'original');assert.equal(withAliceVerbalScenarioV71(source,{...meal(70),verbalContext:context}),source);
});

test('naturally appointed godsons and goddaughters can answer Alice once without an empty voice or broken continuation',()=>{
 for(const marker of ['s','d']){
  let source;
  for(let seed=0;seed<40&&!source;seed++){
   const value=`e39-r71-${marker}-`+seed.toString(16).padStart(22,'0');
   let run=E.enableActivitySchedule(E.createRun(directEntryV60(value).roleId,value));
   for(let step=0;step<130&&!run.completed;step++){
    const event=E.getEvent(run);
    if(event.speaker==='alice'&&E.canRequestPatronageReply(run)){source=run;break;}
    if(E.canRequestBreak(run)){run=E.requestBreak(run);continue;}
    let index=event.id==='self-care'?(run.stats.cash>=12?1:event.choices.findIndex(choice=>choice.effect==='cancelBreak')):['kind-break','kind-workday'].includes(event.id)?2:['wealth-plan','career-review'].includes(event.id)?2:event.kind==='daily'?2:0;
    if(!event.choices[index]||event.choices[index].available===false)index=event.choices.findIndex(choice=>choice.available!==false);
    if(index<0)break;run=E.advance(E.applyChoice(run,index));
   }
  }
  assert.ok(source,marker);canonical(source);const line=E.getPatronageReplyLine(source,'alice');assert.ok(line.length>15,marker);assert.match(line,/愛麗絲/);
  const pending=E.requestPatronageReply(source,'alice'),row=pending.history.at(-1);canonical(pending);
  assert.equal(row.speaker,'alice');assert.equal(row.patronageOutcome.target,'alice');assert.equal(row.patronageOutcome.version,2);assert.equal(row.choiceText,line);assert.equal(pending.history.length,source.history.length+1);
  const old=deriveCharacterStats(source).find(person=>person.id==='alice'),now=deriveCharacterStats(pending).find(person=>person.id==='alice');assert.equal(now.encounters,old.encounters+1);assert.equal(now.realHits,old.realHits);assert.equal(now.imaginedHits,old.imaginedHits);
  assert.equal(pending.actions.at(-1).target,'alice');assert.doesNotThrow(()=>validateCompletion({runId:'123e4567-e89b-42d3-a456-426614174000',roleId:pending.roleId,seed:pending.seed,actions:pending.actions},ROLE_MAP));
 }
});

test('Alice appointment voices are gated to r71 and private reactions remain around the dinner table',()=>{
 const work={id:'alice71-first-pull',kind:'daily',speaker:'alice'},privateScene={id:'meal-with-alice',kind:'self-care',privateContext:true,speaker:'alice'};
 for(const profile of [65,67,70,72]){const run=meal(profile);assert.equal(patronageReplyLineV43(run,work,'alice'),'');assert.deepEqual(patronageReplyOutcomesV43(run,work,'alice'),[]);}
 const run=meal(),line=patronageReplyLineV43(run,privateScene,'alice'),outcomes=patronageReplyOutcomesV43(run,privateScene,'alice');
 assert.ok(line.length>15);assert.match(line,/愛麗絲/);assert.equal(outcomes.length,4);assert.equal(new Set(outcomes.map(row=>row.result)).size,4);
 for(const row of outcomes){assert.ok(row.weight>0);assert.equal(row.delta.boss,undefined);assert.equal(row.effect,undefined);assert.ok(row.result.length>30);}
});
