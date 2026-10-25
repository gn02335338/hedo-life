import test from 'node:test';
import assert from 'node:assert/strict';
import {createCardState,applyCardAction,projectCardState,CardRuleError} from '../dist/cards/rules.js';
import {getExpeditionCardMeta,getExpeditionItemPassive,EXPEDITION_ARCHETYPES,EXPEDITION_RELICS} from '../dist/cards/expedition.js';
import {CARD_CATALOG} from '../dist/cards/catalog.js';
import {expeditionPolicy} from './cards-expedition-policy.mjs';
const initial=(seed='visible-adventure-evidence-0')=>createCardState(seed);
const start=(state=initial(),archetype='evidence',stage=1)=>applyCardAction(state,{type:'start-expedition',stage,archetype});
const enter=state=>applyCardAction(state,{type:'expedition-room',choice:0});
const combatWitness=()=>{for(let i=0;i<100;i++){const s=enter(start(initial('natural-hand-'+i))),hand=s.expedition.battle.hand;if(hand.some(c=>c.cardId==='person-jack')&&hand.some(c=>c.cardId==='base-strike')&&hand.some(c=>getExpeditionCardMeta(c.cardId,c.level).effect==='shield'))return s;}throw Error('No natural hand witness');};
const finish=state=>{let moves=0;while(state.expedition.status==='active'&&moves++<500)state=applyCardAction(state,expeditionPolicy(state));assert.ok(moves<500,'adventures always reach a bounded ending');return state;};
const checkProjection=state=>{
 const projected=projectCardState(state),json=JSON.stringify(projected);
 assert.equal(projected.seed,undefined);assert.equal(projected.counter,undefined);assert.equal(projected.expedition.nextUid,undefined);assert.doesNotMatch(json,/drawPile|nextRewards|futureRooms/);
 if(projected.expedition.battle){const b=projected.expedition.battle;assert.equal(b.drawComposition.length,b.drawCount);assert.equal(b.discardCount,b.discard.length);assert.ok(b.hand.every(row=>Number.isInteger(row.cost)&&row.cost>=0));assert.equal(b.maxTurns,20);assert.ok(b.energy<=b.maxEnergy,'refund capacity is reflected in the meter');}
 return projected;
};
test('new adventure is additive, starts thirteen cards and preserves every permanent collection value',()=>{
 const old=initial(),snapshot=structuredClone(old),s=start(old),run=s.expedition;
 assert.deepEqual(old,snapshot);assert.equal(s.version,1);assert.equal(s.revision,1);assert.equal(run.version,2);assert.equal(run.deck.length,13);assert.equal(run.phase,'route');assert.equal(run.totalRooms,5);assert.equal(run.coins,10);assert.equal(run.room,0);
 for(const key of ['collection','deck','loadout','tickets','shards','campaign','drawPity','totalDraws','battle'])assert.deepEqual(s[key],old[key]);
 assert.equal(new Set(Object.keys(EXPEDITION_ARCHETYPES)).size,3);assert.equal(Object.keys(EXPEDITION_RELICS).length,6);checkProjection(s);
});
test('all three archetypes have distinct passive rules and starting signatures without changing deck size',()=>{
 const ids=new Set();for(const archetype of Object.keys(EXPEDITION_ARCHETYPES)){const s=start(initial(),archetype);ids.add(s.expedition.deck[6].cardId);assert.equal(s.expedition.deck.length,13);assert.ok(getExpeditionCardMeta(s.expedition.deck[6].cardId));}assert.equal(ids.size,3);
});
test('a hand uses energy, several cards can be played before the opponent acts, and shield lasts one enemy action',()=>{
 let s=combatWitness(),view=checkProjection(s);assert.equal(view.expedition.battle.hand.length,5);assert.equal(view.expedition.battle.energy,3);const hp=s.expedition.hp;
 let handIndex=view.expedition.battle.hand.findIndex(row=>row.cardId==='person-jack');assert.ok(handIndex>=0);s=applyCardAction(s,{type:'expedition-play',handIndex});assert.equal(s.expedition.hp,hp);assert.equal(s.expedition.battle.energy,2);assert.ok(s.expedition.battle.enemy.exposed>=3);assert.equal(s.expedition.battle.turn,1);
 view=checkProjection(s);handIndex=view.expedition.battle.hand.findIndex(row=>getExpeditionCardMeta(row.cardId,row.level).effect==='shield');if(handIndex>=0){s=applyCardAction(s,{type:'expedition-play',handIndex});assert.ok(s.expedition.block>0);}
 s=applyCardAction(s,{type:'expedition-end-turn'});assert.equal(s.expedition.battle.turn,2);assert.equal(s.expedition.block,0);assert.equal(s.expedition.battle.energy,3);assert.ok(s.expedition.hp<=hp);assert.equal(s.expedition.battle.hand.length,5);
});
test('public state reveals composition rather than future draw order and remains immutable',()=>{
 const s=enter(start()),before=structuredClone(s),view=checkProjection(s),ordered=view.expedition.battle.drawComposition;
 assert.deepEqual(ordered,[...ordered].sort((a,b)=>a.cardId.localeCompare(b.cardId)||a.uid.localeCompare(b.uid)));
 view.expedition.battle.hand[0].level=5;view.expedition.deck.length=0;assert.deepEqual(s,before);
});
test('exposing a target before attacking creates a real sequence advantage',()=>{
 const s=combatWitness();const jack=s.expedition.battle.hand.findIndex(row=>row.cardId==='person-jack'),strike=s.expedition.battle.hand.findIndex(row=>row.cardId==='base-strike');assert.ok(jack>=0&&strike>=0);
 let a=applyCardAction(s,{type:'expedition-play',handIndex:jack});a=applyCardAction(a,{type:'expedition-play',handIndex:a.expedition.battle.hand.findIndex(row=>row.cardId==='base-strike')});
 let b=applyCardAction(s,{type:'expedition-play',handIndex:strike});b=applyCardAction(b,{type:'expedition-play',handIndex:b.expedition.battle.hand.findIndex(row=>row.cardId==='person-jack')});assert.ok(a.expedition.battle.enemy.hp<b.expedition.battle.enemy.hp);
});
test('invalid intentions, wrong phases, inherited IDs and unavailable energy cannot alter progress',()=>{
 for(const action of [{type:'start-expedition',stage:0,archetype:'evidence'},{type:'start-expedition',stage:1,archetype:'constructor'},{type:'start-expedition',stage:2,archetype:'evidence'},{type:'start-expedition',stage:1,archetype:'evidence',tickets:999}])assert.throws(()=>applyCardAction(initial(),action),CardRuleError);
 const s=enter(start()),before=structuredClone(s);
 for(const action of [{type:'expedition-play',handIndex:-1},{type:'expedition-play',handIndex:10},{type:'expedition-play',handIndex:0,damage:999},{type:'expedition-reward',choice:0},{type:'expedition-room',choice:0},{type:'draw',count:1,banner:'all'},{type:'set-deck',characters:s.deck,item:s.loadout.item,event:s.loadout.event},{type:'start-battle',stage:1}])assert.throws(()=>applyCardAction(s,action),CardRuleError);
 assert.deepEqual(s,before);
});
test('active legacy battles survive and can finish or retreat without an implicit reset',()=>{
 const legacy=applyCardAction(initial(),{type:'start-battle',stage:1}),before=structuredClone(legacy);assert.throws(()=>start(legacy),CardRuleError);assert.deepEqual(legacy,before);
 const retreated=applyCardAction(legacy,{type:'abandon-battle'}),newRun=start(retreated);assert.equal(newRun.battle.status,'abandoned');assert.equal(newRun.expedition.status,'active');
});
test('rest, rewards, event borrowing and terminal rewards never mint permanent cards',()=>{
 let s=start(),moves=0,initialCards=structuredClone(s.collection),sawReward=false,sawRest=false,sawEvent=false;
 while(s.expedition.status==='active'&&moves++<500){const r=s.expedition;if(r.phase==='reward'){sawReward=true;assert.equal(r.rewardChoices.length,3);const tickets=s.tickets,shards=s.shards;s=applyCardAction(s,{type:'expedition-reward',choice:0});assert.equal(s.tickets,tickets);assert.equal(s.shards,shards);continue;}if(r.phase==='route'&&r.room===1){s=applyCardAction(s,{type:'expedition-room',choice:1});continue;}if(r.phase==='route'&&r.room===2){s=applyCardAction(s,{type:'expedition-room',choice:0});continue;}if(r.phase==='rest'){sawRest=true;s=applyCardAction(s,{type:'expedition-rest',choice:'upgrade',cardIndex:0});assert.ok(s.expedition.deck[0].level>initialCards[s.deck[0]].level);continue;}if(r.phase==='event')sawEvent=true;s=applyCardAction(s,expeditionPolicy(s));}
 assert.equal(sawReward,true);assert.equal(sawRest,true);assert.equal(sawEvent,true);assert.deepEqual(s.collection,initialCards);assert.equal(s.totalDraws,0);
});
test('all ten chapters have starter-only strategic witnesses for every archetype, and first wins cannot be farmed',()=>{
 const witnesses={evidence:0,slack:2,lick:0};
 for(const [archetype,seed]of Object.entries(witnesses)){
  let s=initial(`visible-adventure-${archetype}-${seed}`),expected=15;
  for(let stage=1;stage<=10;stage++){s=finish(start(s,archetype,stage));assert.equal(s.expedition.status,'won',`${archetype}/${stage}`);expected+=stage<4?3:stage<8?4:5;assert.equal(s.tickets,expected);assert.equal(s.expedition.reward.firstClear,true);checkProjection(s);for(const cardId of s.deck){const entry=s.collection[cardId];if(entry.level<5&&s.shards>=entry.level*5)s=applyCardAction(s,{type:'upgrade',cardId});}}
  assert.equal(s.totalDraws,0);assert.deepEqual(s.campaign.completed,[1,2,3,4,5,6,7,8,9,10]);const prior={tickets:s.tickets,shards:s.shards,collection:structuredClone(s.collection)};
  s=finish(start(s,archetype,1));assert.equal(s.expedition.status,'won');assert.deepEqual(s.expedition.reward,{tickets:0,shards:0,firstClear:false});assert.equal(s.tickets,prior.tickets);assert.equal(s.shards,prior.shards);assert.deepEqual(s.collection,prior.collection);
 }
});
test('blind first-affordable spam does not clear the entire campaign and all losses remain bounded',()=>{
 let s=initial('random-spam-seed-4'),lost=false;
 for(let stage=1;stage<=10;stage++){s=start(s,'evidence',stage);let actions=0;while(s.expedition.status==='active'&&actions++<500){const r=projectCardState(s).expedition,b=r.battle;const action=r.phase==='route'?{type:'expedition-room',choice:0}:r.phase==='reward'?{type:'expedition-reward',choice:0}:r.phase==='event'?{type:'expedition-event',choice:r.coins>=8?0:1}:r.phase==='rest'?{type:'expedition-rest',choice:'heal'}:b.hand.findIndex(row=>row.cost<=b.energy)>=0?{type:'expedition-play',handIndex:b.hand.findIndex(row=>row.cost<=b.energy)}:{type:'expedition-end-turn'};s=applyCardAction(s,action);}assert.ok(actions<500);if(s.expedition.status==='lost'){lost=true;assert.ok(s.expedition.battle.turn<=20);break;}for(const cardId of s.deck){const row=s.collection[cardId];if(row.level<5&&s.shards>=row.level*5)s=applyCardAction(s,{type:'upgrade',cardId});}}
 assert.equal(lost,true);
});
test('ending every turn cannot create an immortal stall and abandonment never awards completion',()=>{
 let s=enter(start());while(s.expedition.status==='active')s=applyCardAction(s,{type:'expedition-end-turn'});assert.equal(s.expedition.status,'lost');assert.ok(s.expedition.battle.turn<=20);assert.equal(s.tickets,15);assert.deepEqual(s.campaign.completed,[]);
 const abandoned=applyCardAction(start(initial()),{type:'abandon-expedition'});assert.equal(abandoned.expedition.status,'abandoned');assert.equal(abandoned.tickets,15);assert.deepEqual(abandoned.campaign.completed,[]);assert.throws(()=>applyCardAction(abandoned,{type:'expedition-room',choice:0}),CardRuleError);
});
test('a campaign witness uses three ordinary N colleagues and declines every SSR draft and loan',()=>{
 let s=applyCardAction(initial('no-ssr-start-2'),{type:'set-deck',characters:['person-captain','person-jonathan','person-annie_yu'],item:'item-cup',event:'event-drink'});
 for(let stage=1;stage<=10;stage++){
  s=start(s,'evidence',stage);let actions=0;
  while(s.expedition.status==='active'&&actions++<500){let action=expeditionPolicy(s);const r=s.expedition;
   if(r.phase==='reward'){let choice=3,best=-1;for(let i=0;i<r.rewardChoices.length;i++){const row=r.rewardChoices[i],card=getExpeditionCardMeta(row.cardId,row.level);if(card.rarity==='SSR')continue;const score=({expose:15,pressure:7,damage:8,shield:1,heal:1,focus:4,charge:7,note:5,drain:5,weaken:6}[card.effect]||0)-card.cost;if(score>best){best=score;choice=i;}}action={type:'expedition-reward',choice};}
   if(r.phase==='event'&&r.event.id==='alice')action={type:'expedition-event',choice:1};
   s=applyCardAction(s,action);assert.ok(s.expedition.deck.every(row=>getExpeditionCardMeta(row.cardId,row.level).rarity!=='SSR'));
  }
  assert.equal(s.expedition.status,'won','noSSR chapter '+stage);assert.ok(actions<500);
  for(const cardId of s.deck){const entry=s.collection[cardId];if(entry.level<5&&s.shards>=entry.level*5)s=applyCardAction(s,{type:'upgrade',cardId});}
 }
 assert.equal(s.totalDraws,0);assert.deepEqual(s.campaign.completed,[1,2,3,4,5,6,7,8,9,10]);
});

test('all eighteen equipped items provide their printed adventure passive, including expose and small focus items',()=>{
 const witness=combatWitness(),seed=witness.seed,baseline=enter(start(initial(seed)));
 for(const item of CARD_CATALOG.filter(card=>card.kind==='item'))for(const level of [1,5]){
  const input=initial(seed);input.collection[item.id]={copies:1,level};input.loadout.item=item.id;
  const s=enter(start(input)),run=s.expedition,b=run.battle,power=item.power+(level-1)*3;
  assert.ok(getExpeditionItemPassive(item.id,level).length>8,item.id);
  if(item.effect==='heal')assert.equal(run.maxHp,baseline.expedition.maxHp+Math.floor(power/2),item.id);
  if(item.effect==='shield')assert.equal(run.block,Math.round(power/2),item.id);
  if(item.effect==='expose')assert.equal(b.enemy.exposed,Math.max(1,Math.floor(power/4)),item.id);
  if(item.effect==='drain'){assert.equal(b.enemy.weak,Math.floor(power/3));assert.equal(b.enemy.weakTurns,2);assert.ok(b.enemy.intent.damage<baseline.expedition.battle.enemy.intent.damage,item.id);}
  if(['focus','pressure'].includes(item.effect)){
   const index=b.hand.findIndex(row=>row.cardId==='person-jack'),normalIndex=baseline.expedition.battle.hand.findIndex(row=>row.cardId==='person-jack');assert.ok(index>=0&&normalIndex>=0);
   const out=applyCardAction(s,{type:'expedition-play',handIndex:index}),normal=applyCardAction(baseline,{type:'expedition-play',handIndex:normalIndex});
   const bonus=Math.max(1,Math.floor(power/4));
   assert.ok(bonus>0,item.id);assert.equal(out.expedition.battle.enemy.hp,normal.expedition.battle.enemy.hp-bonus,item.id);
  }
 }
 assert.equal(getExpeditionItemPassive('constructor'), '');assert.equal(getExpeditionItemPassive('person-jack'), '');
});
