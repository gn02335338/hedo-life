import test from 'node:test';
import assert from 'node:assert/strict';
import {CARD_CATALOG,CARD_MAP,STAGES,STARTER_IDS} from '../dist/cards/catalog.js';
import {createCardState,projectCardState,applyCardAction,grantLifeTickets,lifeTicketReward,eventPower,CardRuleError} from '../dist/cards/rules.js';
const initial=()=>createCardState('cards-test-seed');
test('cards have unique catalog identities, 29 public portraits, and all rarity/banner combinations',()=>{
 assert.equal(CARD_CATALOG.length,65);assert.equal(new Set(CARD_CATALOG.map(c=>c.id)).size,65);
 assert.equal(CARD_CATALOG.filter(c=>c.kind==='character').length,29);
 assert.ok(!CARD_CATALOG.some(c=>c.id.includes('fish')||c.id.includes('hidden')));
 for(const kind of ['character','item','event'])for(const rarity of ['N','R','SSR'])assert.ok(CARD_CATALOG.some(c=>c.kind===kind&&c.rarity===rarity));
});
test('starter cards can fill a deck without drawing and public projection hides future RNG',()=>{
 const s=initial(),view=projectCardState(s);assert.equal(s.tickets,15);assert.deepEqual(Object.keys(s.collection),STARTER_IDS);assert.equal(view.seed,undefined);assert.equal(view.counter,undefined);view.collection['person-jack'].level=5;assert.equal(s.collection['person-jack'].level,1);
});
test('same server seed/actions reproduce draws while input states stay immutable',()=>{
 const old=initial(),a=applyCardAction(old,{type:'draw',count:10,banner:'all'}),b=applyCardAction(initial(),{type:'draw',count:10,banner:'all'});
 assert.deepEqual(a,b);assert.equal(old.totalDraws,0);assert.equal(a.totalDraws,10);assert.equal(a.tickets,5);assert.ok(a.lastResult.cards.some(c=>CARD_MAP[c.id].rarity!=='N'));
});
test('twentieth draw is SSR, resets pity, and does not bypass selected category',()=>{
 for(const banner of ['character','item','event']){const s=initial();s.drawPity=19;const out=applyCardAction(s,{type:'draw',count:1,banner});assert.equal(CARD_MAP[out.lastResult.cards[0].id].rarity,'SSR');assert.equal(CARD_MAP[out.lastResult.cards[0].id].kind,banner);assert.equal(out.drawPity,0);}
});
test('ten draws guarantee R or better across many seeds and cross-banner pity is shared',()=>{
 for(let i=0;i<250;i++){const s=createCardState(`ten-seed-${i}`),out=applyCardAction(s,{type:'draw',count:10,banner:i%2?'item':'character'});assert.ok(out.lastResult.cards.some(row=>CARD_MAP[row.id].rarity!=='N'));assert.equal(out.counter,20);}
 let s=initial();s.tickets=30;for(let i=0;i<20;i++){s=applyCardAction(s,{type:'draw',count:1,banner:['character','item','event'][i%3]});assert.ok(s.drawPity<20);}
});
test('duplicate cards grant rarity shards rather than extra deck slots',()=>{
 let s=initial();s.collection=Object.fromEntries(CARD_CATALOG.map(c=>[c.id,{copies:1,level:1}]));s=applyCardAction(s,{type:'draw',count:10,banner:'all'});assert.equal(s.shards,s.lastResult.cards.reduce((sum,c)=>sum+({N:2,R:6,SSR:18}[CARD_MAP[c.id].rarity]),0));assert.ok(s.lastResult.cards.every(c=>c.duplicate));
});
test('catalog rejects inherited properties and malformed choices without mutating prototypes',()=>{
 for(const cardId of ['constructor','__proto__','toString',null])for(const type of ['upgrade','craft'])assert.throws(()=>applyCardAction(initial(),{type,cardId}),CardRuleError);
 assert.equal(Object.prototype.level,undefined);assert.equal(Object.level,undefined);
 for(const action of [{type:'draw',count:100,banner:'all'},{type:'draw',count:1,banner:'missing'},{type:'draw',count:1,banner:'all',cheat:1},{type:'battle-turn',move:'strike',target:-1},{type:'unknown'}])assert.throws(()=>applyCardAction(initial(),action),CardRuleError);
});
test('deck requires three unique owned people and real owned item/event',()=>{
 const s=initial();assert.throws(()=>applyCardAction(s,{type:'set-deck',characters:['person-jack','person-jack','person-captain'],item:'item-badge',event:'event-drink'}),CardRuleError);
 assert.throws(()=>applyCardAction(s,{type:'set-deck',characters:['person-jack','person-captain','person-alice'],item:'item-badge',event:'event-drink'}),CardRuleError);
 const out=applyCardAction(s,{type:'set-deck',characters:['person-simon','person-annie_yu','person-captain'],item:'item-cup',event:'event-walk'});assert.deepEqual(out.deck,['person-simon','person-annie_yu','person-captain']);
});
test('crafting and upgrading consume finite shards, cap level, and cannot occur during battle',()=>{
 let s=initial();assert.throws(()=>applyCardAction(s,{type:'craft',cardId:'person-alice'}),CardRuleError);s.shards=200;s=applyCardAction(s,{type:'craft',cardId:'person-alice'});assert.equal(s.shards,130);assert.equal(s.collection['person-alice'].level,1);assert.throws(()=>applyCardAction(s,{type:'craft',cardId:'person-alice'}),CardRuleError);
 for(let i=0;i<4;i++)s=applyCardAction(s,{type:'upgrade',cardId:'person-alice'});assert.equal(s.collection['person-alice'].level,5);assert.equal(s.shards,80);assert.throws(()=>applyCardAction(s,{type:'upgrade',cardId:'person-alice'}),CardRuleError);
 s=applyCardAction(s,{type:'start-battle',stage:1});for(const action of [{type:'upgrade',cardId:'person-jack'},{type:'draw',count:1,banner:'all'},{type:'craft',cardId:'item-goose'}])assert.throws(()=>applyCardAction(s,action),CardRuleError);
});
test('battle gate, single-use event, cooldown and abandonment behave consistently',()=>{
 assert.throws(()=>applyCardAction(initial(),{type:'start-battle',stage:2}),CardRuleError);
 let s=applyCardAction(initial(),{type:'start-battle',stage:1});s=applyCardAction(s,{type:'battle-turn',move:'skill',target:0});assert.equal(s.battle.party[0].cooldown,3);assert.throws(()=>applyCardAction(s,{type:'battle-turn',move:'skill',target:0}),CardRuleError);s=applyCardAction(s,{type:'battle-turn',move:'event'});assert.equal(s.battle.eventUsed,true);assert.throws(()=>applyCardAction(s,{type:'battle-turn',move:'event'}),CardRuleError);s=applyCardAction(s,{type:'abandon-battle'});assert.equal(s.battle.status,'abandoned');assert.deepEqual(s.campaign.completed,[]);assert.equal(s.tickets,15);
});
test('each equipment card uses its printed strength and upgrades change the corresponding passive',()=>{
 for(const item of CARD_CATALOG.filter(c=>c.kind==='item')){
  let s=initial();s.collection[item.id]={copies:1,level:1};s.loadout.item=item.id;s=applyCardAction(s,{type:'start-battle',stage:1});const fighter=s.battle.party[0],card=CARD_MAP[fighter.id];
  if(item.effect==='heal')assert.equal(fighter.maxHp,card.hp+item.power,item.id);
  if(item.effect==='shield')assert.equal(fighter.shield,item.power,item.id);
  if(item.effect==='pressure')assert.equal(fighter.attack,card.attack+item.power,item.id);
  if(item.effect==='expose')assert.equal(s.battle.enemy.armor,Math.max(0,STAGES[0].armor-item.power),item.id);
  if(item.effect==='drain')assert.equal(s.battle.enemy.attack,Math.max(3,STAGES[0].attack-item.power),item.id);
  const upgraded=initial();upgraded.collection[item.id]={copies:1,level:5};upgraded.loadout.item=item.id;upgraded.campaign.completed=[1,2,3,4,5,6,7,8,9];const strong=applyCardAction(upgraded,{type:'start-battle',stage:10});
  if(item.effect==='heal')assert.ok(strong.battle.party[0].maxHp>fighter.maxHp);
  if(item.effect==='shield')assert.ok(strong.battle.party[0].shield>fighter.shield);
  if(item.effect==='pressure')assert.ok(strong.battle.party[0].attack>fighter.attack);
  if(item.effect==='focus'){const normal=applyCardAction(s,{type:'battle-turn',move:'skill',target:0});const comparison=initial();comparison.collection[item.id]={copies:1,level:5};comparison.loadout.item=item.id;const stronger=applyCardAction(applyCardAction(comparison,{type:'start-battle',stage:1}),{type:'battle-turn',move:'skill',target:0});assert.ok(stronger.battle.enemy.hp<normal.battle.enemy.hp);}
 }
});
function tacticalTurn(s){const b=s.battle;let actor=b.party.findIndex(p=>p.hp>0),move='strike';if(!b.eventUsed&&b.party.some(p=>p.hp/p.maxHp<.6))move='event';else if(b.party.some(p=>p.hp>0&&p.hp/p.maxHp<.6)&&b.party[1].hp>0&&!b.party[1].cooldown){actor=1;move='skill';}else if(b.enemy.armor>0&&b.party[0].hp>0&&!b.party[0].cooldown){actor=0;move='skill';}else if(b.round%3===0)move='guard';else{actor=b.party.findIndex(p=>p.hp>0&&!p.cooldown&&p.id!=='person-captain');if(actor>=0)move='skill';else actor=b.party.findIndex(p=>p.hp>0);}return applyCardAction(s,{type:'battle-turn',move,target:actor});}
test('every event gains a real mechanical improvement when upgraded, including cooldown, expose and weaken cards',()=>{
 for(const card of CARD_CATALOG.filter(c=>c.kind==='event'))for(const level of [1,5]){
  let s=initial();s.collection[card.id]={copies:1,level};s.loadout.event=card.id;s.campaign.completed=[1,2,3,4,5,6,7,8,9];s=applyCardAction(s,{type:'start-battle',stage:10});for(const p of s.battle.party){p.hp-=40;p.cooldown=2;}const power=eventPower(card,level),before=structuredClone(s.battle);const out=applyCardAction(s,{type:'battle-turn',move:'event'}).battle;
  assert.ok(eventPower(card,5)>eventPower(card,1),card.id);
  if(card.effect==='heal')assert.equal(out.party[1].hp,Math.min(before.party[1].maxHp,before.party[1].hp+power),card.id);
  if(card.effect==='shield')assert.equal(out.party[1].shield,before.party[1].shield+power,card.id);
  if(card.effect==='damage'||card.effect==='charge')assert.equal(out.enemy.hp,before.enemy.hp-(power>0?Math.max(1,power-before.enemy.armor):0),card.id);
  if(card.effect==='charge')assert.ok(out.party.every(p=>p.cooldown===0));
  if(card.effect==='expose')assert.equal(out.enemy.armor,Math.max(0,before.enemy.armor-power));
  if(card.effect==='weaken'){assert.equal(out.enemy.weaken,power);assert.equal(out.enemy.weakenTurns,2);}
 }
});
function finish(s,policy=tacticalTurn){while(s.battle.status==='active')s=policy(s);return s;}
test('all ten stages can be beaten with starter deck plus only first-win shard upgrades, no luck or life rewards',()=>{
 let s=initial(),expected=15;const rounds=[];for(let stage=1;stage<=10;stage++){s=finish(applyCardAction(s,{type:'start-battle',stage}));assert.equal(s.battle.status,'won',`stage ${stage}`);expected+=STAGES[stage-1].reward;assert.equal(s.tickets,expected);rounds.push(s.battle.round);for(const id of ['person-jack','person-captain','person-jonathan']){const e=s.collection[id];if(e.level<5&&s.shards>=e.level*5)s=applyCardAction(s,{type:'upgrade',cardId:id});}}
 assert.equal(s.totalDraws,0);assert.deepEqual(s.campaign.completed,[1,2,3,4,5,6,7,8,9,10]);assert.ok(rounds.at(-1)>rounds[0]);assert.ok(s.battle.party.some(p=>p.hp<p.maxHp));const before={tickets:s.tickets,shards:s.shards};s=finish(applyCardAction(s,{type:'start-battle',stage:1}));assert.equal(s.tickets,before.tickets);assert.equal(s.shards,before.shards);assert.equal(s.battle.reward,0);
});
test('basic attack alone does not effortlessly complete the campaign, and failed battles retain collection',()=>{
 let s=initial(),lost=false;const collection=structuredClone(s.collection);for(let stage=1;stage<=10;stage++){s=finish(applyCardAction(s,{type:'start-battle',stage}),s=>applyCardAction(s,{type:'battle-turn',move:'strike',target:s.battle.party.findIndex(p=>p.hp>0)}));if(s.battle.status==='lost'){lost=true;break;}}assert.equal(lost,true);assert.deepEqual(s.collection,collection);assert.ok(s.battle.round<=61);
});
test('pure support loops end after sixty turns rather than creating immortal stuck battles',()=>{
 let s=applyCardAction(initial(),{type:'start-battle',stage:1});s=finish(s,s=>applyCardAction(s,{type:'battle-turn',move:'guard',target:s.battle.party.findIndex(p=>p.hp>0)}));assert.equal(s.battle.status,'lost');assert.equal(s.battle.round,61);
});
test('life ticket grants require three actual work turns and stay bounded',()=>{
 assert.equal(lifeTicketReward(9999,0),0);assert.equal(lifeTicketReward(9999,2),0);assert.equal(lifeTicketReward(1000,3),2);assert.equal(lifeTicketReward(10000,1000),12);assert.throws(()=>lifeTicketReward(-1,3),CardRuleError);const old=initial(),out=grantLifeTickets(old,{runId:'verified-life',score:5000,workRounds:12});assert.equal(out.tickets,23);assert.equal(out.revision,1);assert.equal(old.tickets,15);
});
