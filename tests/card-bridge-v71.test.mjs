import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cardInvitationHTMLV71,createCardBridgeV71} from '../dist/card-bridge-v71.js';

const completed=()=>({runId:'run-a',roleId:'sales',seed:'seed-a',actions:[{type:'choice',index:0}],completed:true});
function scene(){
 const button={disabled:false,textContent:''},status={textContent:''},panel={outerHTML:''};
 return{button,status,panel,document:{querySelector(selector){return selector.includes('claim-status')?status:selector.startsWith('[data-action')?button:panel;}}};
}
test('Alice invitation appears only after a resolved accepted scene and opens a separate card room',()=>{
 const run={pending:true,flags:{cards71_invited:true}};
 const html=cardInvitationHTMLV71(run,{eventId:'alice71-game-invite',choiceIndex:0});
 assert.match(html,/href="\/cards\/" target="_blank"/);
 assert.equal(cardInvitationHTMLV71({...run,pending:false},{eventId:'alice71-game-invite',choiceIndex:0}),'');
 assert.equal(cardInvitationHTMLV71({...run,flags:{}},{eventId:'alice71-game-invite',choiceIndex:0}),'');
 assert.equal(cardInvitationHTMLV71(run,{eventId:'onboarding'}),'');
});
test('claim sends proof once, exposes the server award and prevents duplicate clicks',async()=>{
 const run=completed(),ui=scene();let calls=0,resolve;
 const bridge=createCardBridgeV71({cloud:{claimCards(proof){calls++;assert.deepEqual(proof,run);return new Promise(done=>{resolve=done;});}},getRun:()=>run,getScreen:()=> 'ending',document:ui.document});
 const pending=bridge.claim();assert.equal(ui.button.disabled,true);assert.equal(await bridge.claim(),false);
 resolve({ticketsAwarded:7,duplicate:false});await pending;
 assert.equal(calls,1);assert.match(ui.panel.outerHTML,/獲得 7 張/);assert.match(ui.panel.outerHTML,/本局已核對/);
 assert.equal(await bridge.claim(),false);assert.equal(calls,1);
});
test('a delayed response cannot overwrite a different life or a different screen',async()=>{
 let run=completed(),screen='ending',resolve;const ui=scene();
 const bridge=createCardBridgeV71({cloud:{claimCards(){return new Promise(done=>{resolve=done;});}},getRun:()=>run,getScreen:()=>screen,document:ui.document});
 const request=bridge.claim();run={...completed(),runId:'run-b'};screen='home';resolve({ticketsAwarded:4});await request;
 assert.equal(ui.panel.outerHTML,'');
});
test('network failure supports a safe explicit retry and a zero-turn result is never called a prize',async()=>{
 const run=completed(),ui=scene();let calls=0;
 const bridge=createCardBridgeV71({cloud:{async claimCards(){if(++calls===1)throw new Error('offline');return {ticketsAwarded:0};}},getRun:()=>run,getScreen:()=> 'ending',document:ui.document});
 assert.equal(await bridge.claim(),false);assert.equal(ui.button.disabled,false);assert.match(ui.status.textContent,/不會重複發券/);
 await bridge.claim();assert.match(ui.panel.outerHTML,/沒有新增卡券/);assert.match(ui.panel.outerHTML,/至少完成 3 個工作回合/);
});
test('unfinished career has no claim panel or claim request',async()=>{
 const run={...completed(),completed:false};
 const bridge=createCardBridgeV71({cloud:{claimCards(){throw new Error('must not request');}},getRun:()=>run,getScreen:()=> 'game'});
 assert.equal(bridge.endingHTML(run),'');assert.equal(await bridge.claim(),false);
});
test('home, ending and same-origin migration expose the new card game',async()=>{
 const [app,index,migration]=await Promise.all(['../dist/app.js','../dist/index.html','../worker/domain-migration.js'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
 assert.match(app,/home-game-card cards.*href="\/cards\/"/);
 assert.match(app,/cardBridgeV71\.endingHTML\(run\)/);
 assert.match(app,/cardInvitationHTMLV71\(run,last\)/);
 assert.match(index,/card-bridge-v71\.css/);
 assert.match(migration,/'\/cards\/index.html'/);
});
