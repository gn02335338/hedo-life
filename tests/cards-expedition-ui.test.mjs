import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCardState,applyCardAction,projectCardState} from '../dist/cards/rules.js';
import {renderExpeditionV72} from '../dist/cards/expedition-ui.js';

const start=()=>applyCardAction(createCardState('expedition-ui-new-player'),{type:'start-expedition',stage:1,archetype:'evidence'});
const battle=()=>applyCardAction(start(),{type:'expedition-room',choice:0});
test('a new collection exposes the adventure without charging tickets and keeps chapter locks',()=>{
 const state=createCardState('expedition-ui-lobby'),before=structuredClone(state),html=renderExpeditionV72(projectCardState(state));
 assert.match(html,/每回合 3 點行動/);assert.match(html,/data-exp-archetype="evidence"/);
 assert.match(html,/data-exp-start="1" >開始這輪/);assert.match(html,/data-exp-start="2" disabled/);
 assert.match(html,/關卡不花抽卡券/);assert.deepEqual(state,before);
});
test('battle renders a real hand, exact energy and public enemy intent while showing composition rather than draw order',()=>{
 const state=battle(),view=projectCardState(state),before=structuredClone(view),html=renderExpeditionV72(view);
 assert.match(html,/第 1 \/ 20 回合/);assert.match(html,/data-exp-end-turn/);
 assert.equal((html.match(/data-exp-play=/g)||[]).length,view.expedition.battle.hand.length);
 assert.match(html,new RegExp(`攻勢 ${view.expedition.battle.enemy.intent.damage}`));
 assert.match(html,/不代表抽牌順序/);assert.doesNotMatch(html,/drawPile|counter|futureRooms|futureRewards/);
 assert.deepEqual(view,before);
});
test('display uses effective discounted hand costs and blocks unaffordable plays',()=>{
 const view=projectCardState(battle());view.expedition.battle.energy=0;
 view.expedition.battle.hand=[{uid:'a',cardId:'base-strike',level:1,cost:0},{uid:'b',cardId:'base-strike',level:1,cost:2}];
 const html=renderExpeditionV72(view);
 assert.match(html,/data-exp-play="0"\s+aria-label="[^\"]*費用 0/);
 assert.match(html,/data-exp-play="1" disabled/);
});
test('a newer card unknown to a cached client gives a reload hint instead of crashing or playing blindly',()=>{
 const view=projectCardState(battle());view.expedition.battle.hand=[{uid:'future',cardId:'future-card-id',level:1,cost:0}];
 const html=renderExpeditionV72(view);assert.match(html,/牌面更新了/);assert.match(html,/請重新整理/);assert.match(html,/data-exp-play="0" disabled/);
});
test('adventure prose and enemy names cannot become executable HTML',()=>{
 const view=projectCardState(battle());view.expedition.battle.enemy.name='<img src=x onerror=alert(1)>';
 view.expedition.battle.log=['<script>window.bad=true</script>'];const html=renderExpeditionV72(view);
 assert.doesNotMatch(html,/<script>|<img src=x/);assert.match(html,/&lt;img src=x/);assert.match(html,/&lt;script&gt;/);
});
test('the browser sends card position intentions and keeps the legacy unfinished battle reachable',()=>{
 const source=readFileSync(new URL('../dist/cards/app.js',import.meta.url),'utf8');
 assert.match(source,/type:'expedition-play',handIndex:Number\(el.dataset.expPlay\)/);
 assert.match(source,/type:'expedition-end-turn'/);assert.match(source,/先把這場打完，或選擇撤退/);
 assert.doesNotMatch(source,/type:'expedition-play'[^\n}]*damage:/);
});

test('already settled rest and borrowed-card outcomes are visible before picking the next room',()=>{
 const view=projectCardState(start());view.expedition.room=2;view.expedition.log=['愛麗絲借你「強尼」。本輪打完要歸還，不加入永久收藏。'];
 const html=renderExpeditionV72(view);assert.match(html,/剛才這一站/);assert.match(html,/愛麗絲借你/);assert.match(html,/這一站告一段落/);
 view.expedition.phase='event';view.expedition.coins=5;view.expedition.event={title:'借牌',body:'先看看手頭資源。',choices:[{title:'借一張',cost:8},{title:'不借',cost:0}]};
 const event=renderExpeditionV72(view);assert.match(event,/data-exp-event="0" disabled/);assert.match(event,/data-exp-event="1" >/);
});
