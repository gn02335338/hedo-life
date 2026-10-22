import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {adminLoginHTML,privateArchiveHTML,createAdminArchiveUI} from '../dist/admin-archive-ui-v41.js';
import {characterBookHTML} from '../dist/character-book.js';

const csrf='c'.repeat(64),password='test-only-ui-password-never-render';
const session=()=>({authenticated:true,csrfToken:csrf,expiresAt:new Date(Date.now()+4*60*60*1000).toISOString()});
const record=()=>({version:1,updatedAt:'2026-01-01T00:00:00.000Z',card:{name:'PRIVATE_DUMMY_NAME',title:'PRIVATE_DUMMY_TITLE',alias:'PRIVATE_DUMMY_ALIAS',description:'PRIVATE_DUMMY_DESCRIPTION',portraitUrl:'/api/admin/portrait',stories:[{title:'PRIVATE_DUMMY_STORY',body:'PRIVATE_DUMMY_BODY',choices:[{text:'A synthetic choice',result:'UNREVEALED_TEST_RESULT'},{text:'Another synthetic choice',result:'OTHER_UNREVEALED_TEST_RESULT'}]}]}});
const response=(body,status=200)=>Response.json(body,{status});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness(handler,options={}){
 const listeners=new Map(),calls=[],renders=[];let html='',details=[];
 const dialog={open:false,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},
  querySelector(selector){if(selector==='[data-private-archive]'&&html.includes('data-private-archive'))return {remove(){html='';}};return null;},
  querySelectorAll(selector){return selector==='.private-story-list details'?details:[];}
 };
 const openDialog=value=>{dialog.open=true;html=value;details=Array.from(value.matchAll(/<details>/g),()=>({open:false}));renders.push(value);};
 const ui=createAdminArchiveUI({dialog,openDialog,...options,fetcher:async(path,options)=>{calls.push({path,options});return handler(path,options,calls.length);}});
 const dispatch=async(type,event)=>{for(const fn of listeners.get(type)||[])await fn(event);};
 const submit=value=>{const input=typeof value==='object'?value:{value},target={matches:selector=>selector==='[data-private-login]',querySelector:()=>input};const pending=dispatch('submit',{target,preventDefault(){}});return {input,pending};};
 const logout=()=>dispatch('click',{target:{closest:selector=>selector==='[data-private-logout]'?{}:null}});
 const answer=(story,choice)=>dispatch('click',{target:{closest:selector=>selector==='[data-private-story]'?{dataset:{privateStory:String(story),privateAnswer:String(choice)}}:null}});
 const close=async()=>{dialog.open=false;await dispatch('close',{});};
 return {ui,dialog,calls,renders,submit,logout,answer,close,html:()=>html,details:()=>details};
}
const authenticated=()=>harness(async(path)=>path==='/api/admin/session'?response(session()):path==='/api/admin/archive'?response(record()):response({authenticated:false}));

test('public character slot and sign-in HTML contain only a generic question mark, with no private image or prefilled credentials',()=>{
 const publicHTML=characterBookHTML(),slot=publicHTML.match(/<article class="character-card private-sealed-card"[\s\S]*?<\/article>/)?.[0];
 assert.ok(slot);assert.match(slot,/<h3>公司神秘人物<\/h3>/);assert.match(slot,/<div class="private-sealed-symbol" aria-hidden="true">\?<\/div>/);
 assert.doesNotMatch(slot,/<img|\/api\/admin\/portrait|data-character-id|PRIVATE_DUMMY|封存|SEALED ARCHIVE|管理員登入|admin-archive/);
 assert.doesNotMatch(publicHTML,/data-action="admin-archive"/);
 const login=adminLoginHTML();assert.match(login,/type="password"/);assert.doesNotMatch(login,/value=|\/api\/admin\/portrait|PRIVATE_DUMMY|UNREVEALED/);
 const source=readFileSync(new URL('../dist/admin-archive-ui-v41.js',import.meta.url),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|indexedDB|document\.cookie/);
 assert.doesNotMatch(source,/PRIVATE_DUMMY|test-only-ui-password/);
});

test('signed-out, unavailable and failed session checks never fetch an archive or put a portrait in the DOM',async()=>{
 for(const status of [401,403,503]){
  const h=harness(async()=>response({error:'synthetic',message:password},status));await h.ui.open();
  assert.deepEqual(h.calls.map(c=>c.path),['/api/admin/session']);assert.match(h.html(),/data-private-login/);assert.doesNotMatch(h.html(),/<img|PRIVATE_DUMMY|test-only-ui-password/);
 }
});

test('password is sent once only to login, immediately cleared, never rendered or written to browser storage',async()=>{
 let h;h=harness(async(path,options)=>{
  if(path==='/api/admin/session')return response({},401);
  if(path==='/api/admin/login'){assert.equal(h.input.value,'');assert.deepEqual(JSON.parse(options.body),{password});return response(session());}
  return response(record());
 });
 const old=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Private password must not touch storage');}});
 try{
  await h.ui.open();const input={value:password};h.input=input;
  // Keep the exact input object visible to the request assertion, after the
  // component synchronously clears it and before its asynchronous response.
  const submission=h.submit(input);assert.equal(submission.input.value,'');await submission.pending;
  assert.equal(h.calls.filter(c=>c.path==='/api/admin/login').length,1);assert.match(h.html(),/PRIVATE_DUMMY_NAME/);
  assert.ok(h.renders.every(html=>!html.includes(password)));
  const login=h.calls.find(c=>c.path==='/api/admin/login');assert.equal(login.options.credentials,'same-origin');assert.equal(login.options.cache,'no-store');assert.equal(login.options.headers['X-Admin-Intent'],'private-archive');
  assert.equal(login.options.headers.Cookie,undefined);assert.equal(login.options.headers.Authorization,undefined);
 }finally{if(old)Object.defineProperty(globalThis,'localStorage',old);else delete globalThis.localStorage;}
});

test('authenticated content is escaped, rejects remote portrait URLs and reveals only the clicked choice outcome',async()=>{
 const raw='<img src=x onerror="alert(1)"><script>synthetic</script>',payload=record();
 Object.assign(payload.card,{name:raw,title:raw,alias:raw,description:raw,portraitUrl:'https://foreign.example/private.png'});
 Object.assign(payload.card.stories[0],{title:raw,body:raw});Object.assign(payload.card.stories[0].choices[0],{text:raw,result:raw+'UNREVEALED_TEST_RESULT'});
 const initial=privateArchiveHTML(payload);assert.ok(!initial.includes(raw));assert.match(initial,/&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);assert.doesNotMatch(initial,/<script|<iframe|https:\/\/foreign|UNREVEALED_TEST_RESULT/);
 assert.equal([...initial.matchAll(/<img\s/g)].length,1);assert.match(initial,/src="\/api\/admin\/portrait"/);
 const h=authenticated();await h.ui.open();assert.doesNotMatch(h.html(),/UNREVEALED_TEST_RESULT/);await h.answer(0,0);assert.match(h.html(),/UNREVEALED_TEST_RESULT/);assert.ok(!h.html().includes('OTHER_UNREVEALED_TEST_RESULT'));assert.equal(h.details()[0].open,true);
 assert.equal(h.calls.length,2,'private toy choices do not write public game proofs or stats');
});

test('logout uses a session-bound CSRF header and clears private markup and answers',async()=>{
 const h=authenticated();await h.ui.open();await h.answer(0,0);await h.logout();
 const logout=h.calls.find(c=>c.path==='/api/admin/logout');assert.ok(logout);assert.equal(logout.options.method,'POST');assert.equal(logout.options.headers['X-CSRF-Token'],csrf);assert.equal(logout.options.credentials,'same-origin');assert.equal(logout.options.cache,'no-store');assert.equal(logout.options.body,'{}');
 assert.match(h.html(),/data-private-login/);assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|UNREVEALED|\/api\/admin\/portrait/);
});

test('failed or expired logout still clears private content rather than keeping it visible behind an error',async()=>{
 for(const status of [401,503]){
  const h=harness(async path=>path==='/api/admin/session'?response(session()):path==='/api/admin/archive'?response(record()):response({},status));
  await h.ui.open();await h.logout();assert.match(h.html(),/data-private-login/);assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|UNREVEALED|\/api\/admin\/portrait/);
 }
});

test('closing destroys private DOM and a late session, login or archive response cannot reopen it',async()=>{
 for(const delayed of ['session','login','archive']){
  const pending=deferred();const h=harness(async path=>{
   if(path==='/api/admin/session')return delayed==='session'?pending.promise:delayed==='login'?response({},401):response(session());
   if(path==='/api/admin/login')return pending.promise;
   return pending.promise;
  });
  const opening=h.ui.open();let completion=opening;
  if(delayed==='login'){await opening;completion=h.submit(password).pending;}
  // Let session->archive navigation reach its deferred response.
  if(delayed==='archive')await new Promise(resolve=>setImmediate(resolve));
  await h.close();assert.equal(h.html(),'');pending.resolve(delayed==='archive'?response(record()):response(session()));await completion;
  assert.equal(h.dialog.open,false);assert.equal(h.html(),'');assert.ok(h.renders.every(html=>!html.includes('PRIVATE_DUMMY')));
 }
 const h=authenticated();await h.ui.open();assert.match(h.html(),/PRIVATE_DUMMY/);await h.close();assert.equal(h.html(),'');
});

function fakeClock(){
 let now=Date.parse('2026-01-01T00:00:00.000Z'),next=0;const tasks=new Map();
 return {now:()=>now,setTimeout(callback,delay){const id=++next;tasks.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>tasks.delete(id),
  advance(ms,{fire=true}={}){now+=ms;if(fire)for(const [id,task]of [...tasks])if(task.at<=now){tasks.delete(id);task.callback();}},pending:()=>tasks.size};
}
function lifecycleTarget(){
 const listeners=new Map();return {addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);},
  dispatch(type){for(const callback of listeners.get(type)||[])callback({type});},count:type=>(listeners.get(type)||[]).length};
}
const clockSession=clock=>({authenticated:true,csrfToken:csrf,expiresAt:new Date(clock.now()+1000).toISOString()});

test('session deadline clears the open private DOM, replies and timer, including suspended-timer clicks',async()=>{
 for(const fire of [true,false]){
  const clock=fakeClock(),h=harness(async path=>path==='/api/admin/session'?response(clockSession(clock)):response(record()),{clock});
  await h.ui.open();await h.answer(0,0);assert.match(h.html(),/UNREVEALED_TEST_RESULT/);assert.equal(clock.pending(),1);
  clock.advance(1000,{fire});if(!fire)await h.answer(0,1);
  assert.match(h.html(),/data-private-login/);assert.match(h.html(),/工作階段已到期/);
  assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|UNREVEALED|\/api\/admin\/portrait/);assert.equal(clock.pending(),0);assert.equal(h.calls.length,2);
 }
 const clock=fakeClock(),pending=deferred();const h=harness(async path=>path==='/api/admin/session'?response(clockSession(clock)):pending.promise,{clock});
 const opening=h.ui.open();await new Promise(resolve=>setImmediate(resolve));clock.advance(1000);
 pending.resolve(response(record()));await opening;assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|\/api\/admin\/portrait/);
});

test('pagehide removes private content before caching, and pageshow revalidates only the still-open archive',async()=>{
 for(const closeBeforeRestore of [true,false]){
  const clock=fakeClock(),lifecycle=lifecycleTarget();let sessions=0;
  const h=harness(async path=>path==='/api/admin/session'?++sessions===1?response(clockSession(clock)):response({},401):response(record()),{clock,lifecycle});
  await h.ui.open();await h.answer(0,0);assert.equal(clock.pending(),1);lifecycle.dispatch('pagehide');
  assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|UNREVEALED|\/api\/admin\/portrait/);assert.equal(clock.pending(),0);
  if(closeBeforeRestore)await h.close();lifecycle.dispatch('pageshow');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(sessions,closeBeforeRestore?1:2);assert.equal(h.calls.filter(c=>c.path==='/api/admin/archive').length,1);
  assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|UNREVEALED|\/api\/admin\/portrait/);lifecycle.dispatch('pageshow');
  await new Promise(resolve=>setImmediate(resolve));assert.equal(sessions,closeBeforeRestore?1:2);
  assert.equal(lifecycle.count('pagehide'),1);assert.equal(lifecycle.count('pageshow'),1);
 }
});

test('malformed or already-expired session responses never fetch or render private content',async()=>{
 const clock=fakeClock();for(const body of [{authenticated:true,csrfToken:csrf},{...clockSession(clock),expiresAt:new Date(clock.now()).toISOString()},{...clockSession(clock),csrfToken:'not-a-csrf-token'}]){
  const h=harness(async()=>response(body),{clock});await h.ui.open();assert.equal(h.calls.length,1);assert.match(h.html(),/data-private-login/);
  assert.doesNotMatch(h.html(),/PRIVATE_DUMMY|\/api\/admin\/portrait/);assert.equal(clock.pending(),0);
 }
});
