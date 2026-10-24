import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as art from '../dist/illustrations-v38.js';
import * as artMap from '../dist/illustration-scenes-v38.js';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import * as characterStats from '../dist/character-stats.js';
import * as reportView from '../dist/ending-report-view.js';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {polishDreamText} from '../dist/copy-v15.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const allEvents=[...EVENTS,...FANTASY_EVENTS];
const pixel=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1cAAAAASUVORK5CYII=','base64'));
const imageResponse=()=>({ok:true,headers:new Headers({'content-type':'image/png'}),arrayBuffer:async()=>pixel.buffer});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function harness(mobile,{fetcher=async()=>imageResponse(),artTimeoutMs}={}){
 const nodes=new Map(),listeners=new Map(),calls={save:0,proof:0,downloads:[],blobs:[],requests:[],hidden:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},scrollIntoView(){},addEventListener(){},
   showModal(){this.open=true;},close(){this.open=false;},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...reportView,...art,polishDreamText,
  // Bind the actual art implementation, including its async same-origin export.
  embedEndingIllustration:(ending,options)=>art.embedEndingIllustration(ending,{...options,...(artTimeoutMs?{timeoutMs:artTimeoutMs}:{}),fetcher:async(...args)=>{calls.requests.push(args);return fetcher(...args);}}),
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},body:{append(){}},
   createElement(){return{href:'',download:'',click(){calls.downloads.push({href:this.href,name:this.download});},remove(){}};}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,Blob,
  URL:{createObjectURL(blob){calls.blobs.push(blob);return`blob:illustration-${calls.blobs.length}`;},revokeObjectURL(){}},
  setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context,{filename:'dist/app.js'});await tick();calls.save=0;calls.proof=0;
 return {calls,node,context,
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  collection(ids){context.fixtureIds=ids;vm.runInContext('unlocked=fixtureIds;collectionFilter.limit=1000;renderCollection()',context);return node('#ending-grid').innerHTML;},
  roles(){vm.runInContext('roleScreen()',context);return node('#main').innerHTML;},
  resume(candidate){context.fixtureRun=candidate;vm.runInContext('candidate=fixtureRun;rollScreen()',context);return node('#main').innerHTML;},
  download:()=>vm.runInContext('downloadCard()',context),
  fail(kind){const target={hidden:false,dataset:{illustration:kind},matches:()=>true,closest:()=>({classList:{add:flag=>calls.hidden.push(flag)}})};for(const callback of listeners.get('error')||[])callback({target});return target;},
 };
}

test('published scene maps and new authored events use the 42 produced plates, with a safe old-scene fallback',()=>{
 assert.equal(artMap.SCENE_PLATES_V38.length,42);
 assert.equal(new Set(artMap.SCENE_PLATES_V38).size,42);
 assert.equal(Object.keys(artMap.EVENT_SCENES_V38).length,865);
 assert.equal(Object.keys(artMap.DYNAMIC_SCENES_V38).length,93);
 for(const event of [...allEvents,...Object.keys(artMap.DYNAMIC_SCENES_V38).map(id=>({id,title:'眼前的故事'}))]){
  const before=JSON.stringify(event),item=art.sceneIllustration(event,{roleId:'design',people:['wing']});
  assert.ok(artMap.SCENE_PLATES_V38.includes(item.theme),event.id);
  assert.equal(item.src,`./assets/scenes/${item.theme}.webp`);
  const html=art.renderSceneIllustration(event,{roleId:'design',people:['wing']});
  assert.match(html,/width="960" height="540"/);assert.match(html,/loading="lazy" decoding="async"/);
  assert.equal(JSON.stringify(event),before);
 }
 assert.equal(art.sceneIllustration({id:'unrecognized-old-save'}).theme,'office_day');
 assert.equal(art.sceneIllustration({id:'../../secret'}).src,'./assets/scenes/office_day.webp');
 for(const event of allEvents.filter(event=>event.id.startsWith('cast66-'))){
  assert.ok(artMap.SCENE_PLATES_V38.includes(event.scene),event.id);
  assert.equal(art.sceneIllustration(event).theme,artMap.SCENE_ALIASES_V38[event.scene]||event.scene,event.id);
 }
});

test('illustration selection never examines future choices, outcomes or chance values',()=>{
 for(const event of allEvents){
  const visible={id:event.id,title:event.title};
  for(const key of ['choices','draw','outcomes','futureEnding','result'])Object.defineProperty(visible,key,{get(){throw new Error(`Unexpected future read ${key}`);}});
  const html=art.renderSceneIllustration(visible,{roleId:'sales'});
  assert.doesNotMatch(html,/assets\/endings|chance|probability|未來結局|獲勝|失敗率/);
 }
 const html=art.renderSceneIllustration({id:'onboarding',title:'<img src=x onerror=alert(1)>'},{people:['wing','../../raw-photo'],roleId:'../../private'});
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/raw-photo|private|data-scene-role/);
});

test('dream and reality are explicit current-result inputs, with no inference from previous rage flags',()=>{
 const event={id:'meeting-ten-minutes',title:'會議'};
 assert.equal(art.sceneIllustration(event,{flags:{rage_real_wing:1}}).mode,null);
 assert.equal(art.sceneIllustration(event,{reality:'imagined'}).theme,'dream_rage');
 assert.equal(art.sceneIllustration(event,{reality:'real'}).theme,'real_rage');
 assert.match(art.renderSceneIllustration(event,{reality:'imagined'}),/腦內夢境 · 現實沒有動手/);
 assert.match(art.renderSceneIllustration(event,{reality:'real'}),/現實失控 · 事情真的發生了/);
 assert.doesNotMatch(art.renderSceneIllustration(event),/illustration-imagined|illustration-real|現實沒有動手|事情真的發生了/);
});

test('private aftermath uses a police room only once the current scene reaches the station',()=>{
 assert.equal(art.sceneIllustration({id:'rage-legal',scope:'private'}).theme,'police_station');
 assert.equal(art.sceneIllustration({id:'rage-legal',scope:'private'},{reality:'real'}).theme,'police_station');
 assert.equal(art.sceneIllustration({id:'rage-legal',scope:'private'},{reality:'imagined'}).theme,'dream_rage');
 assert.equal(art.sceneIllustration({id:'kind-break',scope:'private'}).theme,'dark_invite');
 for(const id of ['rage-aftermath','rage-showdown','rage-public'])assert.equal(art.sceneIllustration({id,scope:'private'}).theme,'dinner');
 assert.equal(art.sceneIllustration({id:'rage-legal'}).theme,'legal');
});

test('all 883 ending images require an explicit unlock and use the existing ending role',()=>{
 assert.equal(endings.ENDINGS.length,883);
 const paths=new Set();
 for(const ending of endings.ENDINGS){
  assert.equal(art.renderEndingIllustration(ending),'');
  assert.equal(art.renderEndingIllustration(ending,{unlocked:false}),'');
  assert.equal(art.endingIllustrationPath(ending),null);
  const html=art.renderEndingIllustration(ending,{unlocked:true}),path=art.endingIllustrationPath(ending,{unlocked:true});
  assert.equal(path,`./assets/endings/${ending.id}.webp`);paths.add(path);
  assert.ok(html.includes(`data-ending-art-role="${ending.roleId}"`));
  assert.ok(html.includes(path));assert.match(html,/loading="lazy" decoding="async"/);
  assert.equal(art.endingIllustrationPath({...ending,roleId:'invalid'},{unlocked:true}),null);
 }
 assert.equal(paths.size,883);
 assert.equal(art.renderEndingIllustration({id:'../../private',title:'secret',roleId:'system'},{unlocked:true}),'');
});

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: every authored scene renders an original environment and current cast without altering the life`,async()=>{
  const app=await harness(mobile);
  for(const event of allEvents){
   const roleId=event.roles?.[0]||'system',cohort=event.minRules>=39?'e39':'e37';
   // New cast scenes require their real cohort. Rendering an art fixture does
   // not make the frozen e39 event pool eligible for unpublished characters.
   const seed=event.requiresCareerV71?'e39-r71-n-0000000000000000000000':event.requiresCastV66?'e39-r66-n-0000000000000000000000':event.requiresCastV65?'e39-r65-n-0000000000000000000000':`${cohort}-art-${event.id}`,run=engine.createRun(roleId,seed);
   run.actualRoleId=roleId;run.eventId=event.id;run.turn=12;
   if(event.requireGender)run.characterGender=event.requireGender;
   const before=JSON.stringify(run),html=app.render(run);
   assert.match(html,/class="story-illustration/);assert.match(html,/src="\.\/assets\/scenes\/[^"/]+\.webp"/);
   assert.ok(html.includes(`data-scene-role="${run.actualRoleId}"`));
   if(event.requiresCastV65||event.requiresCastV66)assert.equal(art.sceneIllustration(event).theme,event.scene,event.id);
   assert.doesNotMatch(html,/assets\/endings\//,'no future ending image in work scene');
   assert.equal(JSON.stringify(run),before,event.id);
  }
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });
 test(`${device}: locked cards have no spoiler image URL, alt, title or hidden background; all unlocked cards have their image`,async()=>{
  const app=await harness(mobile),locked=app.collection([]);
  assert.equal([...locked.matchAll(/ending-card locked/g)].length,883);
  assert.doesNotMatch(locked,/<img|assets\/endings|background|\balt=|\btitle=/);
  const unlocked=app.collection(endings.ENDINGS.map(ending=>ending.id));
  assert.equal([...unlocked.matchAll(/data-illustration="ending"/g)].length,883);
  for(const ending of endings.ENDINGS)assert.ok(unlocked.includes(`./assets/endings/${ending.id}.webp`));
  const one=endings.ENDINGS.find(ending=>ending.id==='vietnam_afterdark-hr'),mixed=app.collection([one.id]);
  assert.equal([...mixed.matchAll(/data-illustration="ending"/g)].length,1);
  assert.ok(mixed.includes(`./assets/endings/${one.id}.webp`));
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });
 test(`${device}: entry pictures reveal the applied-for role, while work pictures follow the actual reassignment`,async()=>{
  const app=await harness(mobile),candidate=engine.createRun('ai','e37-picture-bait');
  candidate.actualRoleId='system';candidate.assignment='swapped';
  assert.match(app.roles(),/story-illustration/);
  const resume=app.resume(candidate);assert.match(resume,/data-scene-role="ai"/);assert.doesNotMatch(resume,/data-scene-role="system"/);
  const work=app.render(candidate);assert.match(work,/data-scene-role="system"/);
  const target=app.fail('environment');assert.equal(target.hidden,true);assert.deepEqual(app.calls.hidden,['illustration-unavailable']);
  const avatar=app.fail('portrait');assert.equal(avatar.hidden,true);assert.equal(app.calls.hidden.length,1);
  assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
 });
}

test('certificate embeds a same-origin image as data, rejects non-images, and never requests locked artwork',async()=>{
 const ending=endings.ENDINGS[0],requests=[];
 const fetcher=async(...args)=>{requests.push(args);return imageResponse();};
 assert.equal(await art.embedEndingIllustration(ending,{fetcher}),'');assert.equal(requests.length,0);
 const data=await art.embedEndingIllustration(ending,{unlocked:true,fetcher});
 assert.match(data,/^data:image\/png;base64,/);assert.equal(requests.length,1);
 assert.equal(requests[0][0],`./assets/endings/${ending.id}.webp`);
 assert.equal(requests[0][1].credentials,'same-origin');
 assert.equal(await art.embedEndingIllustration(ending,{unlocked:true,fetcher:async()=>({ok:true,headers:new Headers({'content-type':'text/html'})})}), '');
 assert.equal(await art.embedEndingIllustration(ending,{unlocked:true,fetcher:async()=>{throw new Error('offline');}}),'');
});

test('certificate deadline covers stalled requests and body streams even if they ignore abort',async()=>{
 const ending=endings.ENDINGS[0];
 for(const phase of ['headers','body']){
  let signal;
  const fetcher=async(_path,options)=>{
   signal=options.signal;
   if(phase==='headers')return new Promise(()=>{});
   return {...imageResponse(),arrayBuffer:()=>new Promise(()=>{})};
  };
  const started=Date.now();
  assert.equal(await art.embedEndingIllustration(ending,{unlocked:true,fetcher,timeoutMs:10}),'',phase);
  assert.ok(Date.now()-started<1000,'stalled image returns to text export without an unbounded wait');
  assert.equal(signal.aborted,true,'the abandoned network transfer is cancelled when supported');
 }
 // No property of the supplied ending can override trusted export options.
 const endingWithUntrustedOption={...ending,get timeoutMs(){throw new Error('Do not read timeout from ending data');}};
 assert.match(await art.embedEndingIllustration(endingWithUntrustedOption,{unlocked:true,fetcher:async()=>imageResponse()}),/^data:image\/png;base64,/);
});

test('completed-life download includes its image, falls back offline, and captures the life at click time',async()=>{
 const routeFile=JSON.parse(await readFile(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
 const route=routeFile.routes[0],run=engine.replayRun(route.roleId,route.seed,route.actions);
 assert.equal(run.completed,true);
 const app=await harness(false);app.render(run);
 const before=JSON.stringify(run);await app.download();
 assert.equal(app.calls.downloads.length,1);
 const svg=await app.calls.blobs[0].text();assert.match(svg,/<image href="data:image\/png;base64,/);
 assert.doesNotMatch(svg,/<image href="\.\//);assert.match(svg,/回合收尾/);assert.doesNotMatch(svg,/回合離場/);assert.equal(JSON.stringify(run),before);
 const offline=await harness(true,{fetcher:async()=>{throw new Error('offline');}});offline.render(run);await offline.download();
 assert.equal(offline.calls.downloads.length,1);assert.doesNotMatch(await offline.calls.blobs[0].text(),/<image/);
 let release;const racing=await harness(false,{fetcher:()=>new Promise(resolve=>{release=resolve;})});racing.render(run);
 const pending=racing.download();racing.render(engine.createRun('design','e37-another-life'));release(imageResponse());await pending;
 assert.equal(racing.calls.downloads.length,1);
 assert.ok((await racing.calls.blobs[0].text()).includes(`月薪${run.pay}K`));
 assert.equal(app.calls.save+offline.calls.save+racing.calls.save,0);
 assert.equal(app.calls.proof+offline.calls.proof+racing.calls.proof,0);
});

test('a stalled image still downloads a text certificate and releases the lock for another download',async()=>{
 const {routes}=JSON.parse(await readFile(new URL('../research/reachability-v3.json',import.meta.url),'utf8'));
 const route=routes[0],run=engine.replayRun(route.roleId,route.seed,route.actions),before=JSON.stringify(run);
 let attempts=0;
 const app=await harness(false,{artTimeoutMs:10,fetcher:async()=>++attempts===1?new Promise(()=>{}):imageResponse()});
 app.render(run);await app.download();
 assert.equal(app.calls.downloads.length,1);assert.doesNotMatch(await app.calls.blobs[0].text(),/<image/);
 await app.download();assert.equal(app.calls.downloads.length,2);
 assert.match(await app.calls.blobs[1].text(),/<image href="data:image\/png;base64,/);
 assert.equal(attempts,2);assert.equal(JSON.stringify(run),before);
 assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);
});
