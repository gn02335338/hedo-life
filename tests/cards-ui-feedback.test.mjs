import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {CARD_CATALOG,CARD_MAP,STAGES,CARD_KINDS,RARITY_ODDS} from '../dist/cards/catalog.js';
import {getExpeditionCardMeta,getExpeditionItemPassive} from '../dist/cards/expedition.js';
import {renderExpeditionV72} from '../dist/cards/expedition-ui.js';
import {createCardState,projectCardState,applyCardAction,upgradeCost,craftCost,itemPower,eventPower,eventDescription} from '../dist/cards/rules.js';

const initial=()=>createCardState('cards-ui-feedback-test');
function ui(client){
 const root={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};
 const document={querySelector:()=>root,addEventListener(){}};
 const scope=vm.createContext({document,window:{scrollTo(){}},matchMedia:()=>({matches:true}),CARD_CATALOG,CARD_MAP,STAGES,CARD_KINDS,RARITY_ODDS,upgradeCost,craftCost,itemPower,eventPower,eventDescription,cardClient:client,renderExpeditionV72,getExpeditionCardMeta,getExpeditionItemPassive});
 const source=readFileSync(new URL('../dist/cards/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(`${source}\nglobalThis.testUI={connect,render,setState(value){state=value;},setTab(value){tab=value;},setLobby(value){expeditionLobby=value;},getReveal(){return reveal;},clearReveal(){reveal=null;}};`,scope);
 return{root,...scope.testUI};
}

test('upgraded event descriptions show their current effect in cards, loadout and battle',()=>{
 for(const card of CARD_CATALOG.filter(c=>c.kind==='event')){
  const level=3,power=eventPower(card,level),description=eventDescription(card,level);
  assert.ok(description.includes(String(power)),card.id);
  if(card.effect==='damage'||card.effect==='charge')assert.match(description,/基礎傷害（會扣除防禦）/);
 }
 const state=initial();state.collection['event-drink'].level=3;
 const app=ui({mode:'online',hasPending:false});app.setState(projectCardState(state));app.setTab('deck');app.render();
 assert.ok(app.root.innerHTML.includes(getExpeditionCardMeta('event-drink',3).text));
 const battle=applyCardAction(state,{type:'start-battle',stage:1});app.setState(projectCardState(battle));app.setTab('campaign');app.render();
 assert.match(app.root.innerHTML,/全隊各恢復最多 20 生命/);
});

test('battle feedback reports capped healing, armor-adjusted damage and actual defense reduction',()=>{
 const prepared=(id)=>{const state=initial();state.collection[id]={copies:1,level:2};state.loadout.event=id;return applyCardAction(state,{type:'start-battle',stage:1});};
 let state=prepared('event-drink');state.battle.party[0].hp-=3;state.battle.party[1].hp-=5;
 let out=applyCardAction(state,{type:'battle-turn',move:'event',target:0});
 assert.match(out.lastResult.notes[0],/全隊合計恢復 8 生命，每人最多 16/);
 state=prepared('event-minutes');state.battle.enemy.armor=7;
 out=applyCardAction(state,{type:'battle-turn',move:'event',target:0});
 assert.equal(state.battle.enemy.hp-out.battle.enemy.hp,19);assert.match(out.lastResult.notes[0],/造成 19 傷害/);
 state=prepared('event-test');state.battle.enemy.armor=2;
 out=applyCardAction(state,{type:'battle-turn',move:'event',target:0});
 assert.match(out.lastResult.notes[0],/敵方防禦 2 → 0/);
});

test('reconnecting after an uncertain committed draw reveals the reconciled cards once',async()=>{
 const before=initial(),after=applyCardAction(before,{type:'draw',count:1,banner:'all'});
 const app=ui({mode:'online',hasPending:true,async connect(){return projectCardState(after);}});
 app.setState(projectCardState(before));await app.connect();
 assert.equal(app.getReveal().recovered,true);assert.equal(app.getReveal().cards[0].id,after.lastResult.cards[0].id);
 assert.match(app.root.innerHTML,/最近一次已確認抽卡/);
 app.clearReveal();await app.connect();assert.equal(app.getReveal(),null,'a later ordinary refresh does not replay the same reveal');
});

test('reloading into a recent draw can show its confirmed result without executing another action',async()=>{
 const after=applyCardAction(initial(),{type:'draw',count:10,banner:'item'});
 let connects=0;
 const app=ui({mode:'online',hasPending:false,async connect(){connects++;return projectCardState(after);},action(){throw new Error('must not draw again');}});
 await app.connect();assert.equal(connects,1);assert.equal(app.getReveal().cards.length,10);assert.match(app.root.innerHTML,/最近一次已確認抽卡/);
});

test('a recovered later non-draw state does not invent or replay a draw result',async()=>{
 const state=applyCardAction(initial(),{type:'start-battle',stage:1});
 const app=ui({mode:'online',hasPending:true,async connect(){return projectCardState(state);}});
 await app.connect();assert.equal(app.getReveal(),null);
});

test('reconnect resumes an adventure started elsewhere even when the old tab was showing chapter selection',async()=>{
 const before=initial(),after=applyCardAction(before,{type:'start-expedition',stage:1,archetype:'slack'});
 let connects=0;const app=ui({mode:'online',hasPending:true,async connect(){connects++;return projectCardState(after);},action(){throw Error('reconnect must not restart');}});
 app.setState(projectCardState(after));app.setTab('campaign');app.setLobby(true);app.render();assert.match(app.root.innerHTML,/data-exp-room="0"/,'an active practice or cross-tab adventure must remain reachable');app.setState(projectCardState(before));await app.connect();
 assert.equal(connects,1);assert.match(app.root.innerHTML,/data-exp-room="0"/);assert.doesNotMatch(app.root.innerHTML,/data-exp-start=/);
});
