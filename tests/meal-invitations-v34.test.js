import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS} from '../dist/persona.js';
import {ROLE_ORDER} from '../dist/roles.js';
import {MEAL_GUEST_IDS_V25,getMealV25} from '../dist/meals-v25.js';
import {invitationProfileV34,withMealInvitationsV34} from '../dist/meal-invitations-v34.js';

const base=(extra={})=>({seed:'e34-meal-invitation',actualRoleId:'design',roleId:'design',rank:1,turn:7,flags:{},history:[],stats:{cash:100},eventId:'meal-guests-a',mealContext:{origin:'self-care',page:0,guest:null},...extra});
const row=(speaker,delta={},extra={})=>({eventId:'ordinary-work',kind:'daily',turn:6,speaker,choiceIndex:0,breakdown:[{source:'choice',delta}],...extra});
const menu=(run=base())=>withMealInvitationsV34(getMealV25(run),run);

test('invitation access distinguishes all sixteen guests, unfamiliar colleagues and high-ranking managers',()=>{
 const run=base(),profiles=Object.fromEntries(MEAL_GUEST_IDS_V25.map(id=>[id,invitationProfileV34(run,id)]));
 assert.deepEqual(Object.keys(profiles),Object.keys(PERSONAS).filter(id=>id!=='professor'));
 assert.equal(profiles.professor,undefined,'the seventeenth guest uses only the new e37 invitation rules');
 assert.throws(()=>invitationProfileV34(run,'professor'),/Unknown meal guest/u);
 assert.equal(profiles.wing.acceptChance,.08);assert.equal(profiles.spencer.acceptChance,.06);
 for(const id of ['sonny','jonathan','sam','cindy'])assert.ok(profiles[id].acceptChance>=.40&&profiles[id].acceptChance<=.50,id);
 for(const id of ['erich','jenjen','rick','kind','hope','jack','meimei','sophie','owen'])assert.ok(profiles[id].acceptChance>=.12&&profiles[id].acceptChance<=.25,id);
 assert.equal(profiles.helen.sameDepartment,true);assert.equal(profiles.helen.seniority,'director');
 assert.ok(profiles.helen.acceptChance>invitationProfileV34(base({actualRoleId:'sales'}),'helen').acceptChance);
 for(const profile of Object.values(profiles)){assert.equal(profile.familiarity,0);assert.equal(profile.affinity,50);}
 assert.throws(()=>invitationProfileV34(run,'someone-else'),/Unknown meal guest/u);
});

test('department access follows the actual job after reassignment and covers all thirteen occupations',()=>{
 const expected={system:['jack','engineering'],ai:['jack','engineering'],mis:['sonny','it'],project:['cindy','project'],product:['helen','product'],design:['helen','product'],bd:['owen','business'],sales:['meimei','sales'],executive:['wing','leadership'],finance:['sophie','finance'],accounting:['sophie','finance'],hr:['hope','people'],admin:['jenjen','admin']};
 assert.deepEqual(Object.keys(expected).sort(),[...ROLE_ORDER].sort());
 for(const [role,[id,department]]of Object.entries(expected)){
  const profile=invitationProfileV34(base({actualRoleId:role,roleId:role==='system'?'sales':'system'}),id);
  assert.equal(profile.playerDepartment,department);assert.equal(profile.sameDepartment,true,role);
 }
 const promisedSales=base({roleId:'sales',actualRoleId:'system'});
 assert.equal(invitationProfileV34(promisedSales,'jack').sameDepartment,true);
 assert.equal(invitationProfileV34(promisedSales,'meimei').sameDepartment,false);
});

test('committed conversations build familiarity while large global stats, flags and unfinished rows do not',()=>{
 const stranger=base({stats:{cash:100,boss:100,trust:100},characters:[{id:'jack',encounters:999,affinityGained:999}],flags:{meal_guest_jack:99}});
 assert.equal(invitationProfileV34(stranger,'jack').familiarity,0);
 assert.equal(invitationProfileV34(stranger,'jack').affinity,50);
 const unresolved=base({history:[row('jack',{trust:12},{choiceIndex:-1})]});
 assert.deepEqual(invitationProfileV34(unresolved,'jack'),invitationProfileV34(base(),'jack'));
 const familiar=base({history:Array.from({length:6},()=>row('jack'))}),profile=invitationProfileV34(familiar,'jack');
 assert.equal(profile.familiarity,6);assert.equal(profile.affinity,50);assert.ok(profile.acceptChance>invitationProfileV34(stranger,'jack').acceptChance);
 assert.ok(profile.acceptChance>=.50&&profile.acceptChance<.70,'cross-department managers still have a barrier');
 const friendly=base({history:[row('jack',{trust:12})]});
 assert.equal(invitationProfileV34(friendly,'jack').familiarity,1);assert.equal(invitationProfileV34(friendly,'jack').affinity,62);
 assert.ok(invitationProfileV34(friendly,'jack').acceptChance>invitationProfileV34(base({history:[row('jack')]}),'jack').acceptChance);
});

test('familiar colleagues become easier to invite but neither high affinity nor a senior title guarantees a dinner',()=>{
 const friend=invitationProfileV34(base({history:Array.from({length:8},()=>row('cindy',{trust:12}))}),'cindy');
 assert.ok(friend.acceptChance>=.65&&friend.acceptChance<=.85);
 for(const id of ['wing','spencer']){
  const friendly=base({actualRoleId:'executive',rank:7,history:Array.from({length:12},()=>row(id,{boss:12,trust:12}))});
  const profile=invitationProfileV34(friendly,id);
  assert.ok(profile.acceptChance>invitationProfileV34(base(),id).acceptChance);
  assert.ok(profile.acceptChance<=(id==='wing'?.40:.30));
 }
 const ordinary=base({actualRoleId:'sales'}),senior=base({actualRoleId:'sales',rank:7});
 assert.ok(invitationProfileV34(senior,'helen').acceptChance>invitationProfileV34(ordinary,'helen').acceptChance);
});

test('imagined hits never create familiarity or rejection penalties; real hits damage the chance independently',()=>{
 const before=base(),dream=base({history:[row('jack',{trust:-99},{eventId:'rage-release',kind:'rage',eventOutcome:{result:'腦內劇場'}})]});
 assert.deepEqual(invitationProfileV34(dream,'jack'),invitationProfileV34(before,'jack'));
 const real=base({history:[row('jack',{}, {eventId:'rage-release',kind:'rage',eventOutcome:{result:'真的失控了'}})]});
 const profile=invitationProfileV34(real,'jack');
 assert.equal(profile.realHits,1);assert.equal(profile.familiarity,0);assert.equal(profile.affinity,25);
 assert.ok(profile.acceptChance<invitationProfileV34(before,'jack').acceptChance);
 const aftermath=base({history:[row('jack',{trust:99},{eventId:'rage-legal',kind:'rage-world'})]});
 assert.equal(invitationProfileV34(aftermath,'jack').familiarity,0);assert.equal(invitationProfileV34(aftermath,'jack').affinity,50);
});

test('a recent resolved insult further hurts the same person, without using Wing mood as everyone’s opinion',()=>{
 const insult=turn=>row('jack',{}, {kind:'verbal',eventId:'verbal-release',turn,verbalOutcome:{origin:'ordinary-work',target:'jack',kind:'relationship',affinityDelta:-12,phase:'event'}});
 const recent=base({seed:'e33-profile-only',history:[insult(6)]}),older=base({seed:'e33-profile-only',history:[insult(1)]});
 const a=invitationProfileV34(recent,'jack'),b=invitationProfileV34(older,'jack');
 assert.equal(a.familiarity,0);assert.equal(a.affinity,38);assert.equal(a.recentInsults,1);assert.equal(b.recentInsults,0);assert.ok(a.acceptChance<b.acceptChance);
 assert.deepEqual(invitationProfileV34(base({stats:{cash:100,boss:0}}),'jack'),invitationProfileV34(base({stats:{cash:100,boss:100}}),'jack'));
});

test('every invitation resolves a zero-cost seeded acceptance or refusal, with distinct authored replies and one attempt flag',()=>{
 const accepted=new Set(),declined=new Set(),listed=[];
 for(let page=0;page<2;page++){
  const run=base({eventId:page?'meal-guests-b':'meal-guests-a',mealContext:{origin:'self-care',page,guest:null}}),before=structuredClone(run);
  const source=getMealV25(run),sourceBefore=structuredClone(source),event=withMealInvitationsV34(source,run);
  assert.deepEqual(run,before);assert.deepEqual(source,sourceBefore);assert.equal(event.choices.length,source.choices.length+1);
  assert.match(event.body,/不一定會答應/u);assert.match(event.body,/同一天每人只問一次/u);
  for(const choice of event.choices.slice(0,8)){
   const id=choice.mealTarget;listed.push(id);assert.equal(choice.effect,'mealPick');assert.equal(choice.available,true);
   assert.deepEqual(choice.delta,{});assert.deepEqual(choice.flags,[]);assert.equal(choice.result,'');assert.equal(choice.detail,'');
   assert.ok(choice.text.includes(PERSONAS[id].name));assert.ok(choice.text.includes(`成行餐費 ${choice.mealCost} 存款`));assert.doesNotMatch(choice.text,/%|機率|答應赴約|今天約不到/u);
   assert.equal(choice.draw.outcomes.length,2);assert.equal(choice.draw.outcomes[0].weight,invitationProfileV34(run,id).acceptChance);
   assert.equal(choice.draw.outcomes.reduce((sum,outcome)=>sum+outcome.weight,0),1);
   for(const outcome of choice.draw.outcomes){assert.deepEqual(outcome.delta,{});assert.deepEqual(outcome.flags,[`meal_invite_${id}_day_7`]);assert.ok(outcome.result.length>30);assert.ok(outcome.weight>0&&outcome.weight<1);}
   const [yes,no]=choice.draw.outcomes;assert.equal(yes.effect,'mealPick');assert.equal(no.effect,'mealDeclined');
   accepted.add(yes.result);declined.add(no.result);
  }
  assert.equal(event.choices[8],source.choices[8]);assert.equal(event.choices[9],source.choices[9]);
 }
 assert.deepEqual(listed,MEAL_GUEST_IDS_V25);assert.equal(accepted.size,16);assert.equal(declined.size,16);
});

test('already asked and unaffordable guests stay visible but disabled, while cancellation remains free',()=>{
 const asked=menu(base({flags:{meal_invite_wing_day_7:1}}));assert.equal(asked.choices[0].available,false);assert.match(asked.choices[0].text,/今天已經問過/u);assert.equal(asked.choices[1].available,true);
 const nextDay=menu(base({turn:8,flags:{meal_invite_wing_day_7:1}}));assert.equal(nextDay.choices[0].available,true);
 const poor=menu(base({stats:{cash:0}}));assert.ok(poor.choices.slice(0,8).every(choice=>choice.available===false));
 for(const choice of poor.choices.slice(8,10)){assert.equal(choice.available,true);assert.deepEqual(choice.delta,{});assert.deepEqual(choice.flags,[]);assert.equal(choice.draw,undefined);}
 const exact=menu(base({stats:{cash:26}}));assert.equal(exact.choices[0].available,true);
});

test('mood-warning invitations disclose rejection and preserve a free way back to other support',()=>{
 const event=menu(base({mealContext:{origin:'crisis-mood',page:0,guest:null}}));
 assert.match(event.body,/喘口氣/u);assert.match(event.body,/也可以自己吃/u);
 const cancel=event.choices.find(choice=>choice.effect==='mealCancel');assert.equal(cancel.effect,'mealCancel');assert.equal(cancel.available,true);assert.equal(cancel.draw,undefined);assert.deepEqual(cancel.delta,{});
});

test('the solo fallback is guaranteed, affordable and distinct from a shared dinner',()=>{
 for(const page of [0,1]){
  const event=menu(base({eventId:page?'meal-guests-b':'meal-guests-a',mealContext:{origin:'self-care',page,guest:null}}));
  const solo=event.choices[10];assert.equal(solo.effect,'mealFinish');assert.equal(solo.draw,undefined);assert.equal(solo.check,undefined);
  assert.equal(solo.delta.cash,-8);assert.ok(solo.delta.mood>=22);assert.ok(solo.delta.energy>=12);
  assert.ok(solo.flags.includes('spend_mood'));assert.ok(solo.flags.includes('spend_solo'));assert.ok(!solo.flags.includes('meal_shared'));
  assert.equal(solo.mealTarget,undefined);assert.equal(solo.available,true);
 }
 assert.equal(menu(base({stats:{cash:8}})).choices[10].available,false,'leave at least one savings point instead of buying an instant broke ending');
 assert.equal(menu(base({stats:{cash:9}})).choices[10].available,true);
});

test('legacy menus and every non-menu event retain their exact object and RNG-free behavior',()=>{
 for(const seed of ['e25-frozen','e29-frozen','e33-frozen','e39-future','legacy']){
  const run=base({seed}),source=getMealV25(run),before=structuredClone(source);
  assert.equal(withMealInvitationsV34(source,run),source);assert.deepEqual(source,before);assert.ok(source.choices.every(choice=>choice.draw===undefined));
 }
 const meal={id:'meal-with-wing'},daily={id:'ordinary-work'};
 assert.equal(withMealInvitationsV34(meal,base()),meal);assert.equal(withMealInvitationsV34(daily,base()),daily);assert.equal(withMealInvitationsV34(null,base()),null);
});

test('e35 inherits current-life invitation relationships, seeded refusals and an affordable solo fallback',()=>{
 for(const page of [0,1]){
  const before=base({eventId:page?'meal-guests-b':'meal-guests-a',mealContext:{origin:'self-care',page,guest:null},history:[row('jack',{trust:8})]});
  const current={...before,seed:'e35-meal-invitation'};
  assert.deepEqual(invitationProfileV34(current,'jack'),invitationProfileV34(before,'jack'));
  assert.deepEqual(menu(current),menu(before));
  assert.ok(menu(current).choices.slice(0,8).every(choice=>choice.draw?.outcomes.length===2));
  assert.equal(menu(current).choices.at(-1).effect,'mealFinish');
  assert.equal(menu(current).choices.at(-1).delta.cash,-8);
 }
});


test('e36 inherits invitation access without charging or revealing its reaction before dinner',()=>{
 for(const page of [0,1]){
  const before=base({eventId:page?'meal-guests-b':'meal-guests-a',mealContext:{origin:'self-care',page,guest:null},history:[row('jack',{trust:8})]});
  const current={...before,seed:'e36-meal-invitation'};
  assert.deepEqual(invitationProfileV34(current,'jack'),invitationProfileV34(before,'jack'));
  assert.deepEqual(menu(current),menu(before));
  assert.ok(menu(current).choices.slice(0,8).every(choice=>choice.draw?.outcomes.length===2));
  assert.equal(menu(current).choices.at(-1).delta.cash,-8);
 }
});
