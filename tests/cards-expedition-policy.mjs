import {projectCardState} from '../dist/cards/rules.js';
import {getExpeditionCardMeta} from '../dist/cards/expedition.js';
// This policy reads the same projection as the browser. It never examines
// hidden draw order, future reward choices, seed or RNG counter.
export function expeditionPolicy(state){
 const r=projectCardState(state).expedition,b=r.battle;
 if(r.phase==='route'){let choice=0;if(r.room===1&&r.hp<r.maxHp*.7)choice=1;if(r.room===3&&r.hp<r.maxHp*.75)choice=1;return{type:'expedition-room',choice};}
 if(r.phase==='reward'){
  let choice=3,best=0;for(let i=0;i<r.rewardChoices.length;i++){const row=r.rewardChoices[i],card=getExpeditionCardMeta(row.cardId,row.level);const score=({expose:9,pressure:7,damage:7,shield:4,heal:r.hp<r.maxHp*.6?8:2,focus:5,charge:7,note:8,drain:6,weaken:6}[card.effect]||0)-card.cost;if(score>best){best=score;choice=i;}}
  return{type:'expedition-reward',choice};
 }
 if(r.phase==='rest'){const cardIndex=r.deck.findIndex(card=>card.cardId==='person-jack'&&card.level<5);return r.hp<r.maxHp*.8||r.coins<6||cardIndex<0?{type:'expedition-rest',choice:'heal'}:{type:'expedition-rest',choice:'upgrade',cardIndex};}
 if(r.phase==='event')return{type:'expedition-event',choice:r.coins>=8?0:1};
 if(r.phase==='battle'){
  let handIndex=-1,best=-Infinity;for(let i=0;i<b.hand.length;i++){
   const row=b.hand[i],card=getExpeditionCardMeta(row.cardId,row.level);if(row.cost>b.energy)continue;
   let damage=['pressure','damage','expose'].includes(card.effect)?card.power+b.enemy.exposed:card.kind==='character'?4+row.level-1:0;
   if(card.effect==='pressure'&&card.kind==='character'&&b.enemy.exposed)damage+=5;
   const block=card.effect==='shield'?Math.min(card.power,Math.max(0,b.enemy.intent.damage-r.block)):0;
   const healing=card.effect==='heal'?Math.min(card.power,r.maxHp-r.hp,30-b.healed):0;
   let score=damage+block*.85+healing*1.3+(card.effect==='expose'?8:0)+(['focus','charge','note'].includes(card.effect)?(b.energy>1?13:4):0)+(['drain','weaken'].includes(card.effect)?8:0)-row.cost*2;
   if(row.cardId==='person-jack')score+=8;if(damage>=b.enemy.hp+b.enemy.block)score+=100;if(card.effect==='burden')score=-5;
   if(score>best){best=score;handIndex=i;}
  }
  return handIndex>=0?{type:'expedition-play',handIndex}:{type:'expedition-end-turn'};
 }
 throw new Error('Unexpected adventure phase');
}
