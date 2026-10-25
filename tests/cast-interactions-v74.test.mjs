import test from 'node:test';
import assert from 'node:assert/strict';
import {CAST_IDS_V74,CAST_PROFILES_V74,CAST_RELATIONSHIP_VOICES_V74} from '../dist/cast-v74.js';
import {PERSONAS} from '../dist/persona.js';
import {deriveCharacterStats,isMealOutcomeV36} from '../dist/character-stats.js';
import {MEAL_GUEST_IDS_V74,MEAL_EVENTS_V74,getMealEventV74,castInvitationProfileV74,castMealChatProfileV74} from '../dist/meals-cast-v74.js';
import {castVerbalLineV74,castVerbalReactionsV74,castPatronageVoiceV74,castPrivatePatronageV74,withCastRageCopyV74,withCastVerbalScenarioV74,isPrivateCastSceneV74} from '../dist/cast-interactions-v74.js';

// Isolated projection and menu fixtures. Canonical public action routes are
// separately replayed by cast-engine-v74; these rows do not claim gameplay.
const life=()=>({seed:'e39-r74-n-'+'a'.repeat(22),actualRoleId:'system',rank:1,turn:6,history:[],flags:{},stats:{cash:80,mood:70,energy:70,boss:50},eventId:'meal-guests-e',mealContext:{origin:'self-care',page:4,guest:null}});
const encounter=(id,n=0)=>({eventId:`cast74-${id}-fixture-${n}`,kind:'daily',speaker:id,turn:n+1,choiceIndex:0,breakdown:[{source:'choice',delta:{trust:8}},{source:'weather',delta:{trust:-99,boss:99}}]});

test('five brief character cards have portraits and all relationship voices without private allegations',()=>{
 assert.deepEqual(CAST_IDS_V74,['wine','peter','tony','henry','mia']);
 for(const id of CAST_IDS_V74){
  const p=CAST_PROFILES_V74[id];assert.equal(PERSONAS[id].name,p.name);assert.match(PERSONAS[id].image,new RegExp(`/avatars-v74/${id}\\.webp$`));
  assert.ok(p.about.length>20);assert.doesNotMatch(p.about,/性騷|小三|斷掌|女友|生命之水|大正妹|全才副理/);
  assert.deepEqual(Object.keys(CAST_RELATIONSHIP_VOICES_V74[id]).sort(),['argument','backstab','cover','help','refusal','report']);
 }
 assert.equal(new Set(MEAL_GUEST_IDS_V74).size,34);assert.equal(new Set(MEAL_EVENTS_V74).size,MEAL_EVENTS_V74.length);
});

test('fifth lunch menu asks once per day, shows concrete costs and keeps the answer hidden',()=>{
 const run=life(),before=structuredClone(run),event=getMealEventV74(run);
 assert.equal(event.id,'meal-guests-e');assert.equal(event.choices.filter(row=>row.mealTarget).length,5);
 for(const id of CAST_IDS_V74){
  const choice=event.choices.find(row=>row.mealTarget===id),cost=CAST_PROFILES_V74[id].cost;
  assert.match(choice.text,new RegExp(`${cost} 存款`));assert.doesNotMatch(choice.text,/%|機率|成功率|好感[+-]/);assert.equal(choice.detail,'');
  const answers=choice.draw.outcomes;assert.equal(answers.length,2);assert.equal(answers[0].effect,'mealPick');assert.equal(answers[1].effect,'mealDeclined');assert.ok(answers.every(row=>Object.keys(row.delta).length===0));
  assert.equal(answers[0].weight+answers[1].weight,1);
  assert.equal(getMealEventV74({...run,flags:{[`meal_invite_${id}_day_${run.turn}`]:1}}).choices.find(row=>row.mealTarget===id).available,false);
  assert.equal(getMealEventV74({...run,stats:{...run.stats,cash:cost-1}}).choices.find(row=>row.mealTarget===id).available,false);
 }
 assert.deepEqual(run,before);
});

test('unfamiliar directors refuse more often, familiarity helps, and actual hits make invitations worse',()=>{
 const run=life();assert.ok(castInvitationProfileV74(run,'henry').acceptChance<castInvitationProfileV74(run,'wine').acceptChance);
 assert.ok(castInvitationProfileV74({...run,actualRoleId:'sales'},'henry').acceptChance<castInvitationProfileV74(run,'henry').acceptChance);
 for(const id of CAST_IDS_V74){
  const ordinary=castInvitationProfileV74(run,id),familiar=castInvitationProfileV74({...run,history:Array.from({length:4},(_,i)=>encounter(id,i))},id);
  const hit={eventId:'rage-release',kind:'rage',speaker:id,turn:5,choiceIndex:0,eventOutcome:{result:'真的失控了'},breakdown:[]};
  const hostile=castInvitationProfileV74({...run,history:[hit]},id);
  assert.ok(familiar.acceptChance>ordinary.acceptChance);assert.ok(hostile.acceptChance<ordinary.acceptChance);assert.equal(hostile.realHits,1);
  assert.ok(ordinary.acceptChance>0&&familiar.acceptChance<1&&hostile.acceptChance>0);
  assert.throws(()=>castInvitationProfileV74({...run,seed:run.seed.replace('-r74-','-r73-')},id));
 }
});

test('every new dinner can be warm, neutral or awkward and projection uses typed affection once',()=>{
 for(const id of CAST_IDS_V74){
  const run={...life(),eventId:`meal-with-${id}`,mealContext:{origin:'self-care',page:4,guest:id}},event=getMealEventV74(run),before=structuredClone(run);
  assert.equal(event.privateContext,true);assert.equal(event.speaker,id);assert.equal(event.choices.length,3);assert.equal(event.choices[2].effect,'mealCancel');
  for(let replyIndex=0;replyIndex<2;replyIndex++){
   const choice=event.choices[replyIndex],profile=castMealChatProfileV74(run,id,replyIndex);
   assert.equal(choice.mealCost,CAST_PROFILES_V74[id].cost);assert.equal(choice.delta.cash,-choice.mealCost);assert.ok(choice.draw.outcomes.every(outcome=>outcome.delta.cash===choice.delta.cash));
   assert.ok(Math.abs(profile.warmChance+profile.neutralChance+profile.mineChance-1)<1e-9);
   for(const outcome of choice.draw.outcomes){
    const row={eventId:event.id,kind:'self-care',speaker:id,turn:run.turn,choiceIndex:replyIndex,mealOutcome:outcome.mealOutcome,eventOutcome:{label:'餐桌氣氛',result:outcome.label},breakdown:[{source:'choice',delta:{trust:99}},{source:'rng',delta:{trust:99}}]};
    const tracked={...run,history:[row]};assert.equal(isMealOutcomeV36(tracked,row),true);
    const result=deriveCharacterStats(tracked).find(person=>person.id===id);assert.equal(result.encounters,1);assert.equal(result.affinityGained,Math.max(0,outcome.mealOutcome.affinityDelta));assert.equal(result.affinityLost,Math.max(0,-outcome.mealOutcome.affinityDelta));
    assert.equal(deriveCharacterStats({...tracked,seed:tracked.seed.replace('-r74-','-r73-')}).find(person=>person.id===id).encounters,0);
   }
  }
  assert.deepEqual(run,before);
 }
});

test('current authored lines outrank generic persona criticism and private results omit duplicate quotes',()=>{
 const run=life(),event={id:'cast74-wine-current',speaker:'wine',requiresCastV74:true,verbalLinesV74:['這一幕先講清楚。','剛才那一幕照原話。'],participants:['wine','jack']};
 assert.equal(castVerbalLineV74(run,event,'wine'),'這一幕先講清楚。');assert.equal(castVerbalLineV74(run,event,'wine','result'),'剛才那一幕照原話。');
 assert.match(castVerbalLineV74(run,{...event,scope:'private'},'jack'),/^傑克，這一幕先講清楚。$/);
 const photo={...event,speaker:'henry',participants:['henry','jack'],scope:'private',verbalLinesV74:['老大，幹，照片傳群組先問本人。','老大，剛才那張照片不要再補傳。']};
 assert.equal(castVerbalLineV74(run,photo,'jack'),'傑克，幹，照片傳群組先問本人。');
 assert.equal(castVerbalLineV74(run,photo,'jack','result'),'傑克，剛才那張照片不要再補傳。');
 assert.equal(castVerbalLineV74({...run,seed:run.seed.replace('-r74-','-r73-')},event,'wine'),null);
 for(const target of ['wine','peter','tony','henry','mia','jack']){
  const active={...run,verbalContext:{target,stage:'release',eventId:event.id}},source={scope:'private',choices:[{draw:{outcomes:[{verbalKind:'ignored',result:'你說：「舊台詞」再重複一次。'},{verbalKind:'legal',result:'舊台詞'}]}}]};
  const transformed=withCastVerbalScenarioV74(source,active);assert.ok(transformed.choices[0].draw.outcomes.every(row=>!row.result.includes('舊台詞')));
  assert.match(transformed.choices[0].draw.outcomes[1].result,/私人爭議/);
 }
});

test('new rage dreams are explicit fantasies, actual hits stay actual, and free private scenes do not invent payment',()=>{
 const run=life(),base={id:'rage-release',scope:'private',choices:[{draw:{outcomes:[{label:'腦內劇場',result:''},{label:'真的失控了',result:''}]}}]};
 for(const target of CAST_IDS_V74){
  const source={...run,rageContext:{target,phase:'result',eventId:`cast74-${target}-fixture`}},event=withCastRageCopyV74(base,source);
  assert.doesNotMatch(event.body,/錢已經付/);assert.match(event.choices[0].draw.outcomes[0].result,/沒有挨打.*想像/);assert.match(event.choices[0].draw.outcomes[1].result,/真的出手/);
  assert.ok(castPatronageVoiceV74(target).line.includes(CAST_PROFILES_V74[target].name));assert.equal(castPrivatePatronageV74(target).length,4);
  assert.equal(castVerbalReactionsV74(target,{privateScene:true}).personnel,undefined);
 }
 assert.equal(isPrivateCastSceneV74(run,{id:'cast74-henry-fixture',requiresCastV74:true,scope:'private'}),true);
 assert.equal(isPrivateCastSceneV74(run,{id:'meal-with-henry',requiresCastV74:true,scope:'private'}),false);
});
