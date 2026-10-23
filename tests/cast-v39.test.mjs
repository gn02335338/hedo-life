import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST_IDS_V39,CAST_PROFILES_V39} from '../dist/cast-v39.js';
import {CAST_EVENTS_V39} from '../dist/events-cast-v39.js';
import {EVENTS} from '../dist/events.js';
import {PERSONAS} from '../dist/persona.js';
import {ROLES} from '../dist/roles.js';
import {SOURCES} from '../dist/public-sources.js';
import {rageParticipantsFor} from '../dist/rage-participants.js';
import {getRageV39,rageTargetForV39} from '../dist/rage-cast-v39.js';
import {getMealEventV39,castInvitationProfileV39,castMealChatProfileV39,MEAL_GUEST_IDS_V39,MEAL_EVENTS_V39} from '../dist/meals-cast-v39.js';
import {castVerbalLineV39,castVerbalReactionsV39} from '../dist/verbal-cast-v39.js';

const expected=['annie_yu','princess','joyce','janet','captain'];
const profileRun=()=>({seed:'e39-pure-cast-profile',actualRoleId:'sales',rank:1,turn:4,rng:12345,history:[],flags:{},stats:{cash:80,mood:50,energy:70},eventId:'meal-guests-c',mealContext:{origin:'self-care',page:2,guest:null}});

test('the five additive public characters have thirty distinct playable work scenes each and retain occupational buckets',()=>{
 assert.deepEqual(CAST_IDS_V39,expected);assert.equal(Object.keys(PERSONAS).length,28);
 assert.equal(CAST_EVENTS_V39.length,150);assert.equal(EVENTS.filter(event=>!event.requiresCastV65&&!event.requiresCastV66).length,861,'the published pre-v65 deck stays intact');
 assert.equal(new Set(CAST_EVENTS_V39.map(event=>event.id)).size,150);
 assert.equal(new Set(CAST_EVENTS_V39.map(event=>event.choices.find(choice=>choice.wild).text)).size,150,'each scene has its own authored absurd response');
 const roleIds=new Set(ROLES.map(role=>role.id));
 for(const id of expected){
  const scenes=CAST_EVENTS_V39.filter(event=>event.speaker===id);
  assert.equal(scenes.length,30);assert.ok(scenes.filter(event=>!event.roles).length>=6,`${id}: colleagues outside the home department can meet them`);
  assert.ok(scenes.filter(event=>event.roles?.length===1).length>=6,`${id}: exclusive work remains distinct`);
  assert.equal(PERSONAS[id].image,`./assets/${id}.png`);assert.equal(PERSONAS[id].name,CAST_PROFILES_V39[id].name);
  for(const event of scenes){
   assert.ok(EVENTS.includes(event));assert.equal(event.minRules,39);assert.equal(event.choices.length,3);
   assert.ok(event.id.length<=100);assert.ok(event.body.length>30);assert.ok(event.wing.length>5);
   assert.ok(!event.roles||event.roles.every(role=>roleIds.has(role)),event.id);
   for(const source of event.sourceIds)assert.ok(Object.hasOwn(SOURCES,source),`${event.id}: known bibliography`);
   for(const choice of event.choices){assert.equal(choice.detail,'');assert.ok(choice.text&&choice.result);assert.doesNotMatch(choice.text+choice.result,/undefined|\[object Object\]/);}
   const participants=rageParticipantsFor(event,rageTargetForV39(event));
   assert.ok(participants.includes(id));assert.equal(new Set(participants).size,participants.length);assert.ok(participants.every(target=>Object.hasOwn(PERSONAS,target)));
   if(event.participants)assert.deepEqual(participants,event.participants,`${event.id}: only explicitly present people are selectable`);
  }
 }
 assert.match(PERSONAS.princess.about,/海外資訊背景.*資料探勘工程師/);
 assert.match(PERSONAS.annie_yu.about,/商務開發助理.*歐文/);
 assert.match(PERSONAS.joyce.about,/業務總監.*914/);
 for(const id of expected)assert.doesNotMatch(PERSONAS[id].about,/安妮林|多倫多|Joyce|同學|五千元|二十五個人/,'public introductions keep only broad occupational context');
});

test('all new guests share the third page, leave invitation costs uncharged and cannot be asked twice on the same workday',()=>{
 const run=profileRun(),before=JSON.stringify(run),menu=getMealEventV39(run);
 assert.equal(MEAL_GUEST_IDS_V39.length,22);assert.equal(menu.choices.length,9);assert.equal(JSON.stringify(run),before);
 assert.deepEqual(menu.choices.filter(choice=>choice.mealTarget).map(choice=>choice.mealTarget),['professor',...expected]);
 for(const id of expected){
  assert.ok(MEAL_EVENTS_V39.includes(`meal-with-${id}`));const invite=menu.choices.find(choice=>choice.mealTarget===id);
  assert.ok(invite.available);assert.deepEqual(invite.delta,{});assert.equal(invite.draw.outcomes.length,2);
  assert.ok(invite.draw.outcomes.every(row=>Object.keys(row.delta).length===0));
  const repeated=getMealEventV39({...run,flags:{[`meal_invite_${id}_day_${run.turn}`]:1}}).choices.find(choice=>choice.mealTarget===id);
  assert.equal(repeated.available,false);assert.match(repeated.text,/已經問過/);
  const poor=getMealEventV39({...run,stats:{...run.stats,cash:0}}).choices.find(choice=>choice.mealTarget===id);assert.equal(poor.available,false);
 }
});

test('cast dinner reactions depend on the guest and topic, remain seeded-choice data and never change Wing remotely',()=>{
 const run=profileRun();
 for(const id of expected){
  const profile=castInvitationProfileV39(run,id);assert.ok(profile.acceptChance>0&&profile.acceptChance<1);
  const sameRole={annie_yu:'bd',princess:'ai',joyce:'sales',janet:'accounting',captain:'hr'}[id];
  const same=castInvitationProfileV39({...run,actualRoleId:sameRole},id),different=castInvitationProfileV39({...run,actualRoleId:'design'},id);
  assert.ok(same.acceptChance>different.acceptChance,`${id}: department familiarity helps an invitation`);
  const dinnerRun={...run,eventId:`meal-with-${id}`,mealContext:{...run.mealContext,guest:id}},before=JSON.stringify(dinnerRun),event=getMealEventV39(dinnerRun);
  assert.equal(event.privateContext,true);assert.equal(event.speaker,id);assert.equal(JSON.stringify(dinnerRun),before);
  const ordinary=castMealChatProfileV39(run,id,0),wild=castMealChatProfileV39(run,id,1);assert.ok(wild.mineChance>ordinary.mineChance);
  for(const [index,choice] of event.choices.slice(0,2).entries()){
   assert.equal(choice.delta.cash,-CAST_PROFILES_V39[id].cost);assert.equal(choice.effect,'mealFinish');assert.equal(choice.draw.outcomes.length,3);
   assert.ok(Math.abs(choice.draw.outcomes.reduce((sum,row)=>sum+row.weight,0)-1)<1e-10);
   for(const row of choice.draw.outcomes){assert.equal(row.mealOutcome.target,id);assert.equal(row.mealOutcome.replyIndex,index);assert.equal(row.delta.boss,undefined);}
   assert.ok(choice.draw.outcomes.some(row=>row.mealOutcome.affinityDelta>0));assert.ok(choice.draw.outcomes.some(row=>row.mealOutcome.affinityDelta<0));
  }
 }
});

test('new character outbursts have different spoken lines and separate imagined/real outcomes without remote boss-mood changes',()=>{
 const spoken=new Set();
 for(const id of expected){
  const event=CAST_EVENTS_V39.find(scene=>scene.speaker===id),base={...profileRun(),eventId:'rage-release',rageContext:{target:id,eventId:event.id,phase:'event'}};
  const calm=getRageV39({...base,stats:{...base.stats,mood:80}}),hot=getRageV39({...base,stats:{...base.stats,mood:10}});
  const outcomes=hot.choices[0].draw.outcomes;assert.equal(calm.speaker,id);assert.equal(outcomes.length,2);
  assert.match(outcomes[0].result,/只發生在你的腦海/);assert.match(outcomes[1].result,/真的出手打到/);
  assert.ok(hot.choices[0].draw.outcomes[1].weight>calm.choices[0].draw.outcomes[1].weight);
  assert.ok(outcomes.every(row=>row.delta.boss===0));assert.deepEqual(outcomes.map(row=>row.effect),['rageReturn','rageAftermath']);
  for(const phase of ['event','result']){
   const line=castVerbalLineV39({event,target:id,run:base,phase});assert.match(line,/幹|他媽|靠北/);assert.ok(!spoken.has(line));spoken.add(line);
   const mealLine=castVerbalLineV39({event:{id:`meal-with-${id}`},target:id,run:base,phase});assert.notEqual(mealLine,line);assert.match(mealLine,/幹|他媽|靠北/);
  }
  assert.deepEqual(Object.keys(castVerbalReactionsV39(id)).sort(),['ignored','relationship','retort','support','personnel','legal'].sort());
 }
});

test('outbursts answer visible dialogue and keep leave, seating and private invitations in their own scenes',()=>{
 const leave=CAST_EVENTS_V39.find(event=>event.id==='cast39-captain-holiday-form');
 const seating=CAST_EVENTS_V39.find(event=>event.speaker==='captain'&&/十五個|十五人|十五位/.test(event.body));
 assert.ok(leave&&seating);
 for(const event of [leave,seating])for(const phase of ['event','result']){
  const line=castVerbalLineV39({event,target:'captain',phase});
  assert.ok(line.includes(`『${event.wing.replace(/[。！？!?]+$/u,'')}』`));
  assert.ok(!line.includes(event.title),'a narrative title is not attributed to the speaker');
  if(event===leave){assert.match(line,/假單|請假/);assert.doesNotMatch(line,/二十五|十五|椅子|座位|訂位/);}
  else assert.match(line,/幾個人|人數/);
 }
 const privateScenes=CAST_EVENTS_V39.filter(event=>event.speaker==='captain'&&event.privateContext);
 assert.equal(privateScenes.length,2);
 for(const phase of ['event','result'])assert.notEqual(...privateScenes.map(event=>castVerbalLineV39({event,target:'captain',phase})));
 for(const id of expected){
  const event=CAST_EVENTS_V39.find(scene=>scene.speaker===id);
  const before=JSON.stringify(event),first=castVerbalLineV39({event,target:id}),again=castVerbalLineV39({event,target:id});
  assert.equal(first,again,'preview and commitment consult the same visible scene without drawing RNG');
  assert.equal(JSON.stringify(event),before);
  assert.ok(first.includes(`『${event.wing.replace(/[。！？!?]+$/u,'')}』`));
  const secondary=castVerbalLineV39({event:{...event,speaker:'wing'},target:id});
  assert.match(secondary,/現場剛才那句『/);assert.doesNotMatch(secondary,/妳剛才說/);
 }
});

test('privilege and shifting-form scenes have authored resistance while preserving ordinary choice mechanics',()=>{
 const slugs={princess:['robot-review','support-night','pm-bridge','release-check'],janet:['white-team-budget','group-message','retroactive-kpi','signature-maze']};
 for(const [id,items] of Object.entries(slugs))for(const slug of items){
  const event=CAST_EVENTS_V39.find(scene=>scene.id===`cast39-${id}-${slug}`);assert.ok(event);
  assert.deepEqual(event.choices.map(choice=>choice.delta),[{skill:6,trust:5,energy:-7,mood:-2},{lick:6,trust:-4,energy:-8,mood:-5},{slack:7,trust:3,energy:-5,mood:5}]);
  assert.deepEqual(event.choices.map(choice=>choice.flags),[['evidence'],['loop'],['archive']]);
  assert.match(event.choices[0].result,id==='princess'?/公主|瑞克|主持人/:/Janet/);
  assert.doesNotMatch(event.choices[0].result,/事情沒有憑空變少|帶走可處理的一項|有了能回覆的範圍/);
 }
 for(const event of CAST_EVENTS_V39.filter(scene=>scene.speaker==='janet'&&(scene.roles?.length!==1)))
  assert.doesNotMatch([event.body,...event.choices.map(choice=>choice.result)].join(' '),/你做會計|你是行政|你的人資職稱|你這位行政|因為會計兩個字/);
});
