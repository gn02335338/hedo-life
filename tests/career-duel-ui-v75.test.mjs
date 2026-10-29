import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../dist/engine.js';
import * as duel from '../dist/career-duel-v75.js';
import {displayPersona} from '../dist/persona.js';
import {mountIslandBrawl} from '../dist/island/brawl-ui.js';

const source=fs.readFileSync(new URL('../dist/career-duel-ui-v75.js',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'').replace('export function createCareerDuelUIV75','globalThis.createCareerDuelUIV75 = function');
const copy=value=>JSON.parse(JSON.stringify(value));
function ready(index=0){
 const seed='e39-r75-n-'+index.toString(16).padStart(22,'0');
 const run=E.enableActivitySchedule(E.createRun('system',seed));return E.advance(E.applyChoice(run,0));
}
function harness(initial=ready(),reducedMotion=false){
 let run=initial,screen='game',revision=1,dialogHTML='',pageHTML='';
 const listeners=[],calls={save:0,game:0,dispose:0,mounts:[]};
 const dialog={open:false,close(){this.open=false;},querySelector(selector){return this.open&&selector==='[data-duel-target-picker]'&&dialogHTML.includes('data-duel-target-picker')?{}:null;}};
 const doc={addEventListener(type,callback){if(type==='click')listeners.push(callback);},defaultView:{matchMedia:()=>({matches:reducedMotion})}};
 const context=vm.createContext({...E,...duel,displayPersona,structuredClone,
  mountIslandBrawl(options){calls.mounts.push(options);return {destroy(){calls.dispose++;}};}
 });
 vm.runInContext(source,context);
 const ui=context.createCareerDuelUIV75({document:doc,getRun:()=>run,setRun:value=>{run=value;},getScreen:()=>screen,getRevision:()=>revision,
  view(html,nextScreen){pageHTML=html;screen=nextScreen;revision++;},finishRecord(){calls.save++;},game(){calls.game++;},
  openDialog(html){dialogHTML=html;dialog.open=true;},dialog,main:{querySelector:selector=>selector==='[data-career-duel-arena]'?{}:null}
 });
 return {ui,calls,dialog,state:()=>run,html:()=>pageHTML,picker:()=>dialogHTML,
  replace(value){run=value;},screen(value){screen=value;},bumpRevision(){revision++;},
  click(action,target){for(const listener of listeners)listener({target:{closest:()=>({dataset:{action,duelTarget:target}})}});}
 };
}

test('the invitation control and multiplayer target picker reveal only present names and do not draw an outcome',()=>{
 const app=harness(),before=copy(app.state());
 for(let repeat=0;repeat<3;repeat++){
  const html=app.ui.controlHTML();assert.match(html,/發起單挑/);assert.match(html,/data-action="duel-invite"/);
  assert.doesNotMatch(html,/機率|醫院|警局|\d+%|對方接受|對方拒絕/);
 }
 app.click('duel-invite');assert.equal(app.dialog.open,true);
 assert.match(app.picker(),/公主/);assert.match(app.picker(),/瑞克/);
 assert.equal((app.picker().match(/data-duel-target="/g)||[]).length,2);
 assert.doesNotMatch(app.picker(),/data-duel-target="(?:wing|hidden-visitor)"/);
 assert.deepEqual(copy(app.state()),before);assert.equal(app.calls.save,0);
 app.click('duel-target','wing');assert.deepEqual(copy(app.state()),before);
 app.click('duel-cancel');assert.equal(app.dialog.open,false);assert.deepEqual(copy(app.state()),before);
 app.click('duel-invite');app.click('duel-target','princess');
 const pending=app.state();assert.equal(pending.pending,true);assert.equal(pending.duelContextV75.accepted,false);
 assert.equal(app.calls.save,1);assert.equal(app.calls.game,1);assert.equal(E.validRun(copy(pending)),true);
 app.click('duel-target','princess');assert.equal(app.state(),pending);assert.equal(app.calls.save,1);
});

test('the real arena mount exposes destroy and removes its global controls and animation frame',()=>{
 const globalListeners=new Map(),frames=new Map();let nextFrame=0,canceled=0;
 const events=owner=>({addEventListener(type,fn){const key=`${owner}:${type}`;if(!globalListeners.has(key))globalListeners.set(key,new Set());globalListeners.get(key).add(fn);},removeEventListener(type,fn){globalListeners.get(`${owner}:${type}`)?.delete(fn);}});
 const gradient={addColorStop(){}};
 const ctx=new Proxy({measureText:value=>({width:String(value).length*10}),createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},
  {get(target,key){return key in target?target[key]:()=>{};},set(target,key,value){target[key]=value;return true;}});
 let doc;
 const node=tag=>({tagName:tag.toUpperCase(),ownerDocument:doc,children:[],dataset:{},style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},
  textContent:'',hidden:false,clientWidth:960,clientHeight:540,
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}},
  addEventListener(){},removeEventListener(){},setAttribute(){},focus(){},
  getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}),
  querySelector(selector){return this.children.find(child=>child.tagName===selector.toUpperCase())||this.children.map(child=>child.querySelector(selector)).find(Boolean)||null;},
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);}
 });
 const view={...events('window'),devicePixelRatio:1,requestAnimationFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame(id){frames.delete(id);canceled++;}};
 doc={...events('document'),defaultView:view,createElement:node};
 const container=node('main'),model=duel.createCareerDuelModelV75({opponentId:'simon',seed:'mount-contract'});
 const arena=mountIslandBrawl({container,model,opponent:{id:'simon',name:'海姐',title:'同事',image:'/assets/simon.png'},onFinish(){}});
 assert.equal(typeof arena.destroy,'function');assert.equal(arena.dispose,undefined);
 assert.equal(container.children.length,1);assert.equal(frames.size,1);
 assert.ok([...globalListeners.values()].some(listeners=>listeners.size));
 arena.destroy();assert.equal(container.children.length,0);assert.equal(frames.size,0);
 assert.equal([...globalListeners.values()].reduce((count,listeners)=>count+listeners.size,0),0);
 const canceledOnce=canceled;arena.destroy();assert.equal(canceled,canceledOnce);
});

test('a canceled, stale or replaced picker cannot commit against another saved conversation',()=>{
 for(const change of [app=>app.bumpRevision(),app=>app.replace(copy(app.state())),app=>app.ui.dispose()]){
  const app=harness();app.click('duel-invite');const before=copy(app.state());change(app);app.click('duel-target','princess');
  assert.deepEqual(copy(app.state()),before);assert.equal(app.calls.save,0);
 }
 const app=harness(ready(1));app.screen('home');app.click('duel-invite');assert.equal(app.calls.save,0);
 app.screen('game');app.dialog.open=true;app.click('duel-invite');assert.equal(app.calls.save,0);
 app.dialog.open=false;app.click('duel-invite');
 assert.equal(app.state().duelContextV75.accepted,true);assert.equal(app.dialog.open,false);
 assert.equal(app.calls.save,1);assert.equal(app.ui.controlHTML(),'');
});

test('combat mounts only after the accepted result is continued and commits its raw proof once',()=>{
 const original=ready(1),invitation=E.requestDuelV75(original,'simon'),app=harness(invitation,true);
 assert.equal(app.ui.playScreen(),false);assert.equal(app.calls.mounts.length,0);
 const battle=E.advance(invitation);app.replace(battle);
 assert.equal(app.ui.playScreen(),true);assert.equal(app.calls.mounts.length,1);
 const arena=app.calls.mounts[0];assert.equal(arena.reducedMotion,true);
 assert.match(app.html(),/移動島實戰/);assert.ok(app.html().includes(battle.duelContextV75.sourceTitle));
 assert.equal(arena.model.getState().phase,'ready');assert.equal(app.state(),battle);
 arena.model.start();arena.model.forfeit();
 // Renderer outcome/summary arguments are untrusted presentation. Only its raw
 // inputs are sent to the canonical engine, which derives the actual loss.
 arena.onFinish('win',{damageDealt:999999},arena.model.getProof());
 const pending=app.state();assert.equal(pending.pending,true);assert.equal(pending.duelContextV75.outcome,'lose');
 assert.equal(pending.history.at(-1).duelOutcome.summary.damageDealt,0);
 assert.equal(pending.turn,original.turn);assert.equal(pending.pay,original.pay);
 assert.equal(app.calls.save,1);assert.equal(app.calls.game,1);assert.equal(E.validRun(copy(pending)),true);
 arena.onFinish('win',{},arena.model.getProof());assert.equal(app.state(),pending);assert.equal(app.calls.save,1);
});

test('leaving the combat page disposes its controls, and an old arena cannot settle a different view or run',()=>{
 const battle=E.advance(E.requestDuelV75(ready(1),'simon')),app=harness(battle);
 app.ui.playScreen();const arena=app.calls.mounts[0];arena.model.start();arena.model.forfeit();
 app.screen('home');app.ui.dispose();assert.equal(app.calls.dispose,1);app.ui.dispose();assert.equal(app.calls.dispose,1);
 arena.onFinish('lose',{},arena.model.getProof());assert.equal(app.state(),battle);assert.equal(app.calls.save,0);
 app.screen('game');app.replace(copy(battle));arena.onFinish('lose',{},arena.model.getProof());assert.equal(app.calls.save,0);
 assert.equal(app.ui.playScreen(),true);assert.equal(app.calls.mounts.length,2);
 assert.equal(app.calls.mounts[1].model.getState().phase,'ready');
 assert.equal(app.state().duelContextV75.seed,battle.duelContextV75.seed);
});

test('rare co-present targets retain the sealed persona and current-cast portraits use their shipped image paths',()=>{
 const hidden=E.requestHiddenEncounter(E.replayRun('system','e39-r75-n-00000000000000000000f3',[
  {type:'activity-schedule',version:1},{type:'choice',eventId:'onboarding',index:0},{type:'choice',eventId:'professor37-notebook-server',index:0}
 ]));
 const app=harness(hidden);app.click('duel-invite');
 assert.match(app.picker(),/魚酥姐/);assert.match(app.picker(),/翅膀/);
 assert.match(app.picker(),/data-duel-target="hidden-visitor"/);
 assert.doesNotMatch(app.picker(),/api\/admin|data-character-id="hidden-visitor"/);
 const wine=ready(9),wineInvite=E.requestDuelV75(wine,'wine');assert.equal(wineInvite.duelContextV75.accepted,true);
 const wineApp=harness(E.advance(wineInvite));wineApp.ui.playScreen();
 assert.equal(wineApp.calls.mounts[0].opponent.image,'/assets/avatars-v74/wine.webp');
});
