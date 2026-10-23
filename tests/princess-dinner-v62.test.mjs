import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CAST_IDS_V39,CAST_PROFILES_V39} from '../dist/cast-v39.js';
import {getMealEventV39,castMealCostV39,castInvitationProfileV39,castMealChatProfileV39} from '../dist/meals-cast-v39.js';
import {PRINCESS_DINNER_COST_V62,getPrincessDinnerV62} from '../dist/princess-dinner-v62.js';
import {displayPrincessEventV47,displayPrincessHistoryV47} from '../dist/princess-english-v47.js';

const state=(profile=62,cash=80,guest=null)=>({seed:`e39-r${profile}-n-${'a'.repeat(22)}`,roleId:'system',actualRoleId:'system',rank:1,turn:4,stats:{cash,energy:60,mood:50,boss:50,trust:60,skill:70,slack:30,lick:30,dream:50},flags:{},history:[],mealContext:{origin:'self-care',page:2,guest},eventId:guest?`meal-with-${guest}`:'meal-guests-c'});
const invitation=run=>getMealEventV39(run).choices.find(choice=>choice.mealTarget==='princess');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('fresh Princess dinner costs 52, shown before inviting and before either table reply, while other guests retain their prices',()=>{
 assert.equal(PRINCESS_DINNER_COST_V62,52);assert.equal(CAST_PROFILES_V39.princess.cost,14,'the historical profile is frozen');
 for(const cash of [0,14,51,52,53,100]){
  const run=state(62,cash),choice=invitation(run);assert.equal(choice.mealCost,52);assert.match(choice.text,/成行餐費 52 存款/);assert.equal(choice.available,cash>=52);assert.deepEqual(choice.delta,{});
  const meal=getMealEventV39(state(62,cash,'princess'));
  for(const reply of meal.choices.slice(0,2)){assert.equal(reply.mealCost,52);assert.match(reply.text,/花費 52 存款/);assert.equal(reply.available,cash>=52);assert.equal(reply.delta.cash,-52);for(const outcome of reply.draw.outcomes)assert.equal(outcome.delta.cash,-52);}
  assert.equal(meal.choices[2].effect,'mealCancel');assert.equal(meal.choices[2].delta.cash||0,0);
 }
 for(const id of CAST_IDS_V39.filter(id=>id!=='princess')){
  assert.equal(castMealCostV39(state(),id),CAST_PROFILES_V39[id].cost);assert.deepEqual(getMealEventV39(state(62,80,id)),getMealEventV39(state(61,80,id)),id);
 }
 assert.throws(()=>castMealCostV39(state(),'missing'));
});

test('high restaurant prices do not guarantee acceptance, friendship or a good conversation, and refusal stays free',()=>{
 const current=state(),legacy=state(61),choice=invitation(current);
 assert.deepEqual(castInvitationProfileV39(current,'princess'),castInvitationProfileV39(legacy,'princess'));
 assert.ok(castInvitationProfileV39(current,'princess').acceptChance<.5,'an unfamiliar player can still be refused');
 assert.equal(choice.draw.outcomes.length,2);assert.deepEqual(choice.draw.outcomes.map(row=>row.effect),['mealPick','mealDeclined']);
 for(const outcome of choice.draw.outcomes)assert.equal(outcome.delta.cash||0,0,'accepting the invitation and refusing it both precede payment');
 for(const index of [0,1]){
  assert.deepEqual(castMealChatProfileV39(current,'princess',index),castMealChatProfileV39(legacy,'princess',index));
  const outcomes=getMealEventV39(state(62,80,'princess')).choices[index].draw.outcomes;
  assert.deepEqual(outcomes.map(row=>row.mealOutcome.reaction),['warm','neutral','mine']);assert.ok(outcomes.every(row=>row.weight>0));assert.ok(outcomes.find(row=>row.mealOutcome.reaction==='mine').mealOutcome.affinityDelta<0);
 }
 const repeated={...current,flags:{[`meal_invite_princess_day_${current.turn}`]:1}};assert.equal(invitation(repeated).available,false,'money cannot reroll a same-day refusal');
});

test('new restaurant scenes keep every Princess line in English, including invitation and all six revealed chat outcomes',()=>{
 const menu=state(),mealState=state(62,80,'princess'),meal=getMealEventV39(mealState),shown=displayPrincessEventV47(meal,mealState),han=/\p{Script=Han}/u;
 assert.equal(han.test(meal.wing),false);assert.equal(han.test(shown.wing),false);assert.match(meal.body,/52/);assert.match(meal.wing,/budget dinners/);assert.match(meal.choices[1].text,/精品|帳單/);
 const committed=(event,result,choiceText)=>({eventId:event.id,speaker:event.speaker,title:event.title,body:event.body,wing:event.wing,result,choiceText});
 const invitationChoice=invitation(menu),texts=[...invitationChoice.draw.outcomes.map(row=>row.result),...meal.choices.slice(0,2).flatMap(row=>row.draw.outcomes.map(outcome=>outcome.result))];
 for(const text of texts){const quotes=[...text.matchAll(/「([^」]+)」/gu)].map(match=>match[1]);assert.ok(quotes.length>0,text);assert.ok(quotes.every(quote=>!han.test(quote)),text);}
 for(const choice of meal.choices.slice(0,2))for(const outcome of choice.draw.outcomes){const before=committed(meal,outcome.result,choice.text),after=displayPrincessHistoryV47(before,mealState);assert.equal(after.result,outcome.result,'already-English new dialogue is not rewritten by legacy translation');assert.equal(after.choiceText,choice.text,'player responses retain the player voice');}
});

test('published r61 meal menus and dinner transcripts retain their exact pre-change hashes and 14-cost price',()=>{
 const run=state(61),mealRun=state(61,80,'princess');assert.equal(getPrincessDinnerV62(run),null);assert.equal(castMealCostV39(run,'princess'),14);assert.equal(invitation(run).mealCost,14);assert.equal(hash(getMealEventV39(run)),'4e7b8f50bf9e97392eccc8b25346ebb153357da145c28bed99c19b05f689ed36');assert.equal(hash(getMealEventV39(mealRun)),'0b879d60c342de427b310093413856a51fd534894a200f1cf89609cedeefb5b9');
 for(const profile of [60,61])assert.equal(castMealCostV39(state(profile),'princess'),14);
 assert.equal(getPrincessDinnerV62({seed:'e39-cal46-kin49-g-e-s-m-h-a1b2c3'}),null);
});
