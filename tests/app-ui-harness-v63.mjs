import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as E from '../dist/engine.js';
import {mountActivityPlayV55} from '../dist/activity-play-ui-v55.js';

const appURL=new URL('../dist/app.js',import.meta.url),raw=readFileSync(appURL,'utf8');
const imports=[...raw.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];$/gm)].filter(row=>row[2]!=='./cloud.js');
const bindings=Object.assign({},...await Promise.all(imports.map(async row=>{
 const module=await import(new URL(row[2],appURL));return Object.fromEntries(row[1].split(',').map(name=>name.trim()).filter(Boolean).map(name=>{const [original,alias]=name.split(/\s+as\s+/);return [alias||original,module[original]];}));
})));
const source=raw.replace(/^import .*;\n/gm,'');
export const plain=value=>JSON.parse(JSON.stringify(value));
const tick=async()=>{for(let i=0;i<3;i++)await new Promise(resolve=>setImmediate(resolve));};

export async function createAppHarnessV63(mobile=false){
 const nodes=new Map(),listeners=new Map(),frames=new Map(),calls={departure:0,play:0,proof:0,complete:0,save:0},playCallbacks=[];
 const document={activeElement:null,hidden:false,querySelector:selector=>node(selector),addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(item=>item!==fn));},defaultView:{performance:{now:()=>0},requestAnimationFrame:fn=>{frames.set(1,fn);return 1;},cancelAnimationFrame:id=>frames.delete(id)}};
 const node=selector=>{
  if(!nodes.has(selector)){
   const events=new Map();nodes.set(selector,{innerHTML:'',textContent:'',open:false,events,ownerDocument:document,scrollTop:0,dataset:{},
    matches:query=>query===selector,contains(target){return target===this||Boolean(target?.dataset?.playCommand||target?.dataset?.shareholderCommand);},querySelector:node,querySelectorAll:()=>[],style:{},firstElementChild:{style:{}},classList:{add(){},remove(){},toggle(){}},
    focus(){document.activeElement=this;},scrollIntoView(){},setAttribute(){},addEventListener(type,fn){events.set(type,fn);},removeEventListener(type,fn){if(events.get(type)===fn)events.delete(type);},showModal(){this.open=true;},close(){this.open=false;events.get('close')?.({target:this});}
   });
  }return nodes.get(selector);
 };
 const context=vm.createContext({...bindings,crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},document,window:{scrollTo(){},matchMedia:()=>({matches:mobile})},
  requestEventDepartureV63(run){calls.departure++;return E.requestEventDepartureV63(run);},applyActivityPlay(run,input){calls.play++;return E.applyActivityPlay(run,input);},
  mountActivityPlayV55(options){playCallbacks.push(options.onCommit);return mountActivityPlayV55(options);},
  renderSceneIllustration:()=>'',renderEndingIllustration:()=>'',
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),createAdminArchiveUI:()=>({open(){}}),createLeaderboardUIV56:()=>({open(){},endingHTML:()=>''}),
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>{calls.complete++;return null;}}
 });
 vm.runInContext(source,context);await tick();calls.departure=0;calls.play=0;calls.proof=0;calls.complete=0;calls.save=0;
 const action=async(action,extra={})=>{
  const target={closest:selector=>selector==='[data-action]'||selector==='[data-departure-view]'&&extra.departureView!==undefined?{dataset:{action,...extra}}:null};
  for(const fn of listeners.get('click')||[])await fn({target,detail:1});await tick();
 };
 const leave=async view=>{
  if(view===undefined){const found=node('#main').innerHTML.match(/data-action="event-departure" data-departure-view="(\d+)"/);if(!found)throw Error('No rendered departure button');view=found[1];}
  await action('event-departure',{departureView:String(view)});
 };
 return {calls,playCallbacks,frames,context,document,node,action,leave,
  html:()=>node('#main').innerHTML,state:()=>vm.runInContext('run',context),revision:()=>vm.runInContext('gameViewRevision',context),
  render(run,focus=true){context.testingRun={...plain(run),runId:run.runId||webcrypto.randomUUID()};vm.runInContext(`run=testingRun;game(${focus})`,context);},
  choose(index){return vm.runInContext(`choose(${index})`,context);},
  clickPlay(command,value){const target={dataset:{playCommand:command,...(value===undefined?{}:{playValue:String(value)})},disabled:false};node('[data-activity-play-v55]').events.get('click')?.({target:{closest:()=>target},stopPropagation(){}});}
 };
}
