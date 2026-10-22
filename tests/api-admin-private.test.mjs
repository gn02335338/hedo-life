import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {AdminPrivateStore,ADMIN_COOKIE,ADMIN_SESSION_MS,ADMIN_IMAGE_LIMIT,validatePrivateArchive} from '../worker/admin-private.js';
import {AchievementStore} from '../worker/achievements.js';
import {CharacterStore} from '../worker/characters.js';
import {ObservationStore} from '../worker/observations.js';
import {FeedbackStore} from '../worker/feedback-store.js';
import {validateFeedback,validatePublisherToken} from '../worker/feedback.js';
import * as http from '../worker/http.js';
import {replayRun,VERSION,MAX_TURNS} from '../dist/engine.js';
import {ROLE_MAP} from '../dist/roles.js';
import {ENDINGS} from '../dist/endings.js';

const password='test-only-private-archive-passphrase';
const verifier=(value=password)=>{const salt=randomBytes(16);return JSON.stringify({v:1,iterations:100000,salt:salt.toString('hex'),hash:pbkdf2Sync(value,salt,100000,32,'sha256').toString('hex')});};
const source=readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'')
 .replace('export class HedoArchive','globalThis.HedoArchive=class HedoArchive').replace('export default','globalThis.worker=');
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG6cAAAAASUVORK5CYII=';
const payload=()=>({card:{name:'PRIVATE_SYNTHETIC_PERSON',title:'Private test title',alias:'Dummy alias',description:'Synthetic fixture; no actual identity.',stories:[{title:'Private synthetic episode',body:'A test-only office conversation.',choices:[{text:'Ask a test question.',result:'A private test answer.'}]}]},portrait:{mime:'image/png',base64:png}});
function harness(t,{configured=true}={}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON');let failQuery=null;
 const sql={exec(query,...args){
  if(failQuery&&query.includes(failQuery)){failQuery=null;throw Error('Synthetic private write failure');}
  let rows=[];if(!args.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query),values=args.map(value=>value instanceof ArrayBuffer?new Uint8Array(value):value);if(statement.columns().length)rows=statement.all(...values);else statement.run(...values);}
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const storage={sql,transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}},async getAlarm(){return null;},async setAlarm(){}};
 const env=configured?{ADMIN_PASSWORD_VERIFIER:verifier()}:{};
 const context=vm.createContext({DurableObject:class{constructor(ctx){this.ctx=ctx;}},replayRun,VERSION,MAX_TURNS,ROLE_MAP,ENDINGS,...http,
  AdminPrivateStore,validateFeedback,validatePublisherToken,FeedbackStore,AchievementStore,CharacterStore,ObservationStore,crypto,Response,Request,URL,Date});
 vm.runInContext(source,context);let archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},env);
 const call=async(path,{method='GET',body,cookie,csrf,origin,site,ip='192.0.2.10',intent=true,raw,base='https://game.example'}={})=>{
  const headers={'CF-Connecting-IP':ip};if(cookie)headers.Cookie=cookie;if(csrf)headers['X-CSRF-Token']=csrf;
  if(origin!==false)headers.Origin=origin||base;if(site)headers['Sec-Fetch-Site']=site;
  if(intent)headers['X-Admin-Intent']='private-archive';if(body!==undefined||raw!==undefined)headers['Content-Type']='application/json';
  return archive.fetch(new Request(base+path,{method,headers,body:raw??(body===undefined?undefined:JSON.stringify(body))}));
 };
 const login=async()=>{const response=await call('/api/admin/login',{method:'POST',body:{password}});assert.equal(response.status,200);return {cookie:response.headers.get('Set-Cookie').split(';')[0],body:await response.json(),response};};
 return {sql,env,call,login,reopen(){archive=new context.HedoArchive({storage,blockConcurrencyWhile:fn=>fn()},env);},failNext(query){failQuery=query;}};
}
const privateHeaders=response=>{assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(response.headers.get('Vary'),'Cookie');assert.equal(response.headers.get('Cross-Origin-Resource-Policy'),'same-origin');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);};

test('private endpoints fail closed before login or before server secret provisioning, including images',async t=>{
 for(const configured of [true,false]){const h=harness(t,{configured});for(const path of ['/api/admin/session','/api/admin/archive','/api/admin/portrait']){const response=await h.call(path);assert.equal(response.status,configured?401:503);privateHeaders(response);assert.doesNotMatch(await response.text(),/PRIVATE_SYNTHETIC_PERSON|salt|hash|verifier|base64/);}}
});

test('login uses a host-only HttpOnly cookie and stores only session, CSRF and client hashes',async t=>{
 const h=harness(t),auth=await h.login(),set=auth.response.headers.get('Set-Cookie');privateHeaders(auth.response);
 assert.match(set,new RegExp('^'+ADMIN_COOKIE+'=[a-f0-9]{64};'));for(const flag of ['Path=/','HttpOnly','Secure','SameSite=Strict','Max-Age=14400'])assert.ok(set.includes(flag));assert.doesNotMatch(set,/Domain=/i);
 assert.deepEqual(Object.keys(auth.body).sort(),['authenticated','csrfToken','expiresAt']);assert.match(auth.body.csrfToken,/^[a-f0-9]{64}$/);
 assert.ok(Date.parse(auth.body.expiresAt)>Date.now()+ADMIN_SESSION_MS-5000);
 const rows=JSON.stringify(h.sql.exec('SELECT * FROM private_admin_sessions').toArray());assert.ok(!rows.includes(auth.cookie.split('=')[1]));assert.ok(!rows.includes(auth.body.csrfToken));assert.ok(!rows.includes(password));
 const attempts=JSON.stringify(h.sql.exec('SELECT * FROM private_admin_attempts').toArray());assert.ok(!attempts.includes('192.0.2.10'));assert.doesNotMatch(attempts,/private-archive-passphrase/);
 h.reopen();const restored=await h.call('/api/admin/session',{cookie:auth.cookie});assert.equal(restored.status,200);assert.deepEqual(await restored.json(),auth.body);
});

test('login rejects missing/foreign Origin, cross-site Fetch Metadata and missing intent without creating a session',async t=>{
 const h=harness(t);for(const options of [{origin:false},{origin:'https://foreign.example'},{origin:'null'},{site:'cross-site'},{site:'same-site'},{intent:false},{base:'http://game.example'}]){
  const response=await h.call('/api/admin/login',{method:'POST',body:{password},...options});assert.equal(response.status,403);privateHeaders(response);
 }
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM private_admin_sessions').one().n,0);
});

test('persistent client and global login rate limits contain brute-force attempts without raw IPs',async t=>{
 const h=harness(t);let previous;
 for(let i=0;i<5;i++){const r=await h.call('/api/admin/login',{method:'POST',body:{password:i?'incorrect':null}});assert.equal(r.status,401);const text=await r.text();if(previous)assert.equal(text,previous);previous=text;}
 h.reopen();const limited=await h.call('/api/admin/login',{method:'POST',body:{password}});assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'900');
 for(let i=0;i<25;i++)assert.equal((await h.call('/api/admin/login',{method:'POST',body:{password:'incorrect'},ip:`198.51.100.${i}`})).status,401);
 assert.equal((await h.call('/api/admin/login',{method:'POST',body:{password},ip:'203.0.113.1'})).status,429);
 const rows=JSON.stringify(h.sql.exec('SELECT * FROM private_admin_attempts').toArray());assert.ok(!rows.includes('198.51.100'));assert.ok(!rows.includes('203.0.113'));
 h.sql.exec('UPDATE private_admin_attempts SET until_at=0');assert.equal((await h.call('/api/admin/login',{method:'POST',body:{password}})).status,200);
});

test('private card and portrait require cookie authentication, stay out of public aggregates and survive restart',async t=>{
 const h=harness(t),auth=await h.login(),body=payload();
 const imported=await h.call('/api/admin/archive',{method:'PUT',body,cookie:auth.cookie,csrf:auth.body.csrfToken});assert.equal(imported.status,200);privateHeaders(imported);
 const saved=await imported.json();assert.deepEqual(saved.card,{...body.card,portraitUrl:'/api/admin/portrait'});assert.match(saved.updatedAt,/Z$/);assert.ok(!JSON.stringify(saved).includes(png));
 h.reopen();const view=await h.call('/api/admin/archive',{cookie:auth.cookie});assert.deepEqual(await view.json(),saved);
 const image=await h.call('/api/admin/portrait',{cookie:auth.cookie});assert.equal(image.status,200);privateHeaders(image);assert.equal(image.headers.get('Content-Type'),'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(png,'base64'));
 for(const path of ['/api/stats','/api/characters']){const publicResponse=await h.call(path);assert.equal(publicResponse.status,200);assert.doesNotMatch(await publicResponse.text(),/PRIVATE_SYNTHETIC_PERSON|Private test title|private synthetic|private_admin|portraitUrl/);}
 for(const path of ['/api/admin/archive','/api/admin/portrait'])assert.equal((await h.call(path)).status,401);
});

test('write and logout require matching session-bound CSRF, exact Origin and a current session',async t=>{
 const h=harness(t),auth=await h.login(),other=await h.login();
 for(const options of [{},{csrf:'a'.repeat(64)},{csrf:other.body.csrfToken},{csrf:auth.body.csrfToken,origin:false},{csrf:auth.body.csrfToken,origin:'https://foreign.example'}]){
  for(const [method,path]of [['PUT','/api/admin/archive'],['POST','/api/admin/logout']])assert.equal((await h.call(path,{method,cookie:auth.cookie,body:payload(),...options})).status,403);
 }
 const logout=await h.call('/api/admin/logout',{method:'POST',cookie:auth.cookie,csrf:auth.body.csrfToken});assert.equal(logout.status,200);assert.match(logout.headers.get('Set-Cookie'),/Max-Age=0/);
 assert.equal((await h.call('/api/admin/session',{cookie:auth.cookie})).status,401);assert.equal((await h.call('/api/admin/session',{cookie:other.cookie})).status,200);
});

test('expired, forged, duplicated and old-verifier sessions cannot read protected content',async t=>{
 const h=harness(t),auth=await h.login();
 for(const value of [`${ADMIN_COOKIE}=${'f'.repeat(64)}`,`${auth.cookie}; ${auth.cookie}`,`${ADMIN_COOKIE}=not-a-token`])assert.equal((await h.call('/api/admin/archive',{cookie:value})).status,401);
 h.sql.exec('UPDATE private_admin_sessions SET expires_at=0');assert.equal((await h.call('/api/admin/archive',{cookie:auth.cookie})).status,401);
 const next=await h.login();h.env.ADMIN_PASSWORD_VERIFIER=verifier('different-test-only-passphrase');assert.equal((await h.call('/api/admin/session',{cookie:next.cookie})).status,401);
});

test('imports reject active image types, malformed or oversized content and preserve the prior atomic archive',async t=>{
 const h=harness(t),auth=await h.login(),body=payload();const write=body=>h.call('/api/admin/archive',{method:'PUT',body,cookie:auth.cookie,csrf:auth.body.csrfToken});
 assert.equal((await write(body)).status,200);const before=await (await h.call('/api/admin/archive',{cookie:auth.cookie})).text();
 const invalid=[{...body,portrait:{mime:'image/svg+xml',base64:Buffer.from('<svg/>').toString('base64')}},{...body,portrait:{mime:'image/webp',base64:png}},{...body,portrait:{mime:'image/png',base64:png+'!'}},{...body,portrait:{mime:'image/png',base64:Buffer.alloc(ADMIN_IMAGE_LIMIT+1).toString('base64')}},{...body,card:{...body.card,stories:Array(81).fill(body.card.stories[0])}},{...body,card:{...body.card,url:'https://foreign.example/private'}},{...body,card:{...body.card,description:'x'.repeat(4001)}}];
 for(const value of invalid){const response=await write(value);assert.ok([400,413].includes(response.status));privateHeaders(response);assert.equal(await (await h.call('/api/admin/archive',{cookie:auth.cookie})).text(),before);}
 h.failNext('INSERT INTO private_archive');assert.equal((await write({...body,card:{...body.card,name:'SHOULD_NOT_COMMIT'}})).status,503);assert.equal(await (await h.call('/api/admin/archive',{cookie:auth.cookie})).text(),before);
 const ordinary=await h.call('/api/player',{method:'POST',raw:JSON.stringify({token:'a'.repeat(64),extra:'x'.repeat(70000)})});assert.equal(ordinary.status,413,'larger private upload limit does not widen anonymous APIs');
});

test('empty private archive and missing portrait disclose no identity, unknown/method paths stay private',async t=>{
 const h=harness(t),auth=await h.login();assert.deepEqual(await (await h.call('/api/admin/archive',{cookie:auth.cookie})).json(),{version:1,updatedAt:null,card:null});
 assert.equal((await h.call('/api/admin/portrait',{cookie:auth.cookie})).status,404);
 for(const [path,method,status]of [['/api/admin/unknown','GET',404],['/api/admin/archive','DELETE',405]]){const r=await h.call(path,{method,cookie:auth.cookie});assert.equal(r.status,status);privateHeaders(r);}
 assert.equal(validatePrivateArchive(payload()).mime,'image/png');
});
