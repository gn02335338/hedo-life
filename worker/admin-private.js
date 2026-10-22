import {ApiError,errorResponse,json,readJson,tokenHash} from './http.js';

export const ADMIN_COOKIE='__Host-private_archive';
export const ADMIN_SESSION_MS=4*60*60*1000;
export const ADMIN_IMAGE_LIMIT=1024*1024;
export const ADMIN_TEXT_LIMIT=128*1024;
const RATE_MS=15*60*1000,HEX=/^[a-f0-9]{64}$/,encoder=new TextEncoder();
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"};
const fail=()=>new ApiError(401,'admin_required','請重新登入私人資料室。');
const invalid=()=>new ApiError(400,'invalid_private_archive','私人資料格式無法使用。');
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g),part=>parseInt(part,16));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const response=(body,status=200,extra={})=>json(body,status,{...headers,...extra});
const equal=(a,b)=>{if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i++)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;};
const cookie=(token,maxAge)=>`${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
function cookieToken(request){
 const values=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(ADMIN_COOKIE+'='));
 if(values.length!==1)return null;
 const value=values[0].slice(ADMIN_COOKIE.length+1);return HEX.test(value)?value:null;
}
function assertOrigin(request,write=false){
 const url=new URL(request.url);
 if(url.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new ApiError(403,'admin_origin','請從同一網站開啟私人資料室。');
 const origin=request.headers.get('Origin'),site=request.headers.get('Sec-Fetch-Site');
 if((write&&origin!==new URL(request.url).origin)||(origin!==null&&origin!==new URL(request.url).origin)||(site!==null&&!['same-origin','none'].includes(site)))throw new ApiError(403,'admin_origin','請從同一網站開啟私人資料室。');
}
function text(value,max,optional=false){
 if(optional&&value===undefined)return '';
 if(typeof value!=='string'||value.length>max||(!optional&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))throw invalid();
 return value.trim();
}
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw invalid();}
export function validatePrivateArchive(body){
 keys(body,['card','portrait']);keys(body.card,['name','title','alias','description','stories']);
 const c=body.card;if(!Array.isArray(c.stories)||c.stories.length>80)throw invalid();
 const card={name:text(c.name,100),title:text(c.title,160),alias:text(c.alias,100,true),description:text(c.description,4000,true),stories:c.stories.map(story=>{
  keys(story,['title','body','choices']);const row={title:text(story.title,160),body:text(story.body,6000)};
  if(story.choices!==undefined){if(!Array.isArray(story.choices)||story.choices.length>5)throw invalid();row.choices=story.choices.map(choice=>{keys(choice,['text','result']);return {text:text(choice.text,500),result:text(choice.result,2500)};});}
  return row;
 })};
 const cardJson=JSON.stringify(card);if(encoder.encode(cardJson).length>ADMIN_TEXT_LIMIT)throw invalid();
 keys(body.portrait,['mime','base64']);const {mime,base64}=body.portrait;
 if(!['image/png','image/webp'].includes(mime)||typeof base64!=='string'||base64.length>4*Math.ceil(ADMIN_IMAGE_LIMIT/3)||!base64.length||base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw invalid();
 let binary;try{binary=atob(base64);}catch{throw invalid();}
 const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));if(!bytes.length||bytes.length>ADMIN_IMAGE_LIMIT||btoa(binary)!==base64)throw invalid();
 const png=bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
 const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if((mime==='image/png'&&!png)||(mime==='image/webp'&&!webp))throw invalid();
 return {cardJson,mime,bytes};
}

export class AdminPrivateStore{
 constructor(sql,env,{now=()=>Date.now()}={}){
  this.sql=sql;this.env=env;this.now=now;
  sql.exec(`CREATE TABLE IF NOT EXISTS private_admin_sessions (token_hash TEXT PRIMARY KEY,csrf_hash TEXT NOT NULL,verifier_tag TEXT NOT NULL,expires_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS private_admin_attempts (bucket_hash TEXT PRIMARY KEY,count INTEGER NOT NULL,until_at INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS private_archive (id INTEGER PRIMARY KEY CHECK(id=1),card_json TEXT NOT NULL,portrait_mime TEXT NOT NULL,portrait BLOB NOT NULL,updated_at TEXT NOT NULL);`);
 }
 async configuration(){
  const raw=this.env.ADMIN_PASSWORD_VERIFIER;let config;
  try{config=JSON.parse(raw);}catch{throw new ApiError(503,'admin_unavailable','私人資料室暫時無法開啟。');}
  if(config?.v!==1||config.iterations!==100000||typeof config.salt!=='string'||!/^[a-f0-9]{32}$/.test(config.salt)||typeof config.hash!=='string'||!HEX.test(config.hash))throw new ApiError(503,'admin_unavailable','私人資料室暫時無法開啟。');
  return {...config,tag:await tokenHash(raw),key:await crypto.subtle.importKey('raw',encoder.encode(raw),{name:'HMAC',hash:'SHA-256'},false,['sign'])};
 }
 async signature(config,value){return hex(await crypto.subtle.sign('HMAC',config.key,encoder.encode(value)));}
 cleanup(){const now=this.now();this.sql.exec('DELETE FROM private_admin_sessions WHERE expires_at <= ?',now);this.sql.exec('DELETE FROM private_admin_attempts WHERE until_at <= ?',now);}
 async limitLogin(request,config){
  this.cleanup();const now=this.now();
  const client=await this.signature(config,'login-client:'+(request.headers.get('CF-Connecting-IP')||'unknown')),global=await this.signature(config,'login-global');
  for(const [bucket,limit]of [[client,5],[global,30]]){const old=this.sql.exec('SELECT count,until_at FROM private_admin_attempts WHERE bucket_hash = ?',bucket).toArray()[0];if(old&&old.count>=limit)throw new ApiError(429,'admin_retry','登入暫時無法完成，請稍後再試。');}
  for(const bucket of [client,global])this.sql.exec('INSERT INTO private_admin_attempts (bucket_hash,count,until_at) VALUES (?,?,?) ON CONFLICT(bucket_hash) DO UPDATE SET count=count+1',bucket,1,now+RATE_MS);
 }
 async login(request,config){
  assertOrigin(request,true);
  if(request.headers.get('X-Admin-Intent')!=='private-archive')throw new ApiError(403,'admin_origin','請從同一網站開啟私人資料室。');
  await this.limitLogin(request,config);const body=await readJson(request,{maxBytes:4096});
  const password=typeof body.password==='string'&&encoder.encode(body.password).length<=1024?body.password:'';
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  const derived=hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:unhex(config.salt),iterations:config.iterations},key,256));
  if(!password||!equal(derived,config.hash))throw fail();
  const old=cookieToken(request);if(old)this.sql.exec('DELETE FROM private_admin_sessions WHERE token_hash = ?',await tokenHash(old));
  const token=random(),csrfToken=await this.signature(config,'csrf:'+token),expiresAt=this.now()+ADMIN_SESSION_MS;
  this.sql.exec('INSERT INTO private_admin_sessions (token_hash,csrf_hash,verifier_tag,expires_at) VALUES (?,?,?,?)',await tokenHash(token),await tokenHash(csrfToken),config.tag,expiresAt);
  this.sql.exec('DELETE FROM private_admin_sessions WHERE token_hash NOT IN (SELECT token_hash FROM private_admin_sessions ORDER BY expires_at DESC,rowid DESC LIMIT 64)');
  return response({authenticated:true,csrfToken,expiresAt:new Date(expiresAt).toISOString()},200,{'Set-Cookie':cookie(token,ADMIN_SESSION_MS/1000)});
 }
 async authenticate(request,config){
  assertOrigin(request);this.cleanup();const token=cookieToken(request);if(!token)throw fail();
  const hash=await tokenHash(token),row=this.sql.exec('SELECT csrf_hash,verifier_tag,expires_at FROM private_admin_sessions WHERE token_hash = ?',hash).toArray()[0];
  if(!row||row.expires_at<=this.now()||!equal(row.verifier_tag,config.tag))throw fail();
  return {hash,csrfToken:await this.signature(config,'csrf:'+token),expiresAt:row.expires_at,csrfHash:row.csrf_hash};
 }
 async writeGuard(request,session){
  assertOrigin(request,true);const supplied=request.headers.get('X-CSRF-Token')||'';
  if(!HEX.test(supplied)||!equal(await tokenHash(supplied),session.csrfHash))throw new ApiError(403,'admin_csrf','請重新開啟私人資料室後再操作。');
 }
 archive(){
  const row=this.sql.exec('SELECT card_json,updated_at FROM private_archive WHERE id = 1').toArray()[0];
  return response({version:1,updatedAt:row?.updated_at||null,card:row?{...JSON.parse(row.card_json),portraitUrl:'/api/admin/portrait'}:null});
 }
 async fetch(request){
  try{
   const path=new URL(request.url).pathname,config=await this.configuration();
   if(path==='/api/admin/login'&&request.method==='POST')return await this.login(request,config);
   const session=await this.authenticate(request,config);
   if(path==='/api/admin/session'&&request.method==='GET')return response({authenticated:true,csrfToken:session.csrfToken,expiresAt:new Date(session.expiresAt).toISOString()});
   if(path==='/api/admin/logout'&&request.method==='POST'){await this.writeGuard(request,session);this.sql.exec('DELETE FROM private_admin_sessions WHERE token_hash = ?',session.hash);return response({authenticated:false},200,{'Set-Cookie':cookie('',0)});}
   if(path==='/api/admin/archive'&&request.method==='GET')return this.archive();
   if(path==='/api/admin/archive'&&request.method==='PUT'){
    await this.writeGuard(request,session);const body=await readJson(request,{maxBytes:4*Math.ceil(ADMIN_IMAGE_LIMIT/3)+ADMIN_TEXT_LIMIT+4096});
    const {cardJson,mime,bytes}=validatePrivateArchive(body),now=new Date(this.now()).toISOString();
    this.sql.exec('INSERT INTO private_archive (id,card_json,portrait_mime,portrait,updated_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET card_json=excluded.card_json,portrait_mime=excluded.portrait_mime,portrait=excluded.portrait,updated_at=excluded.updated_at',cardJson,mime,bytes.buffer,now);
    return this.archive();
   }
   if(path==='/api/admin/portrait'&&request.method==='GET'){
    const row=this.sql.exec('SELECT portrait_mime,portrait FROM private_archive WHERE id = 1').toArray()[0];if(!row)throw new ApiError(404,'private_portrait_unavailable','目前沒有私人圖片。');
    return new Response(row.portrait,{status:200,headers:{...headers,'Content-Type':row.portrait_mime}});
   }
   if(['/api/admin/login','/api/admin/session','/api/admin/logout','/api/admin/archive','/api/admin/portrait'].includes(path))throw new ApiError(405,'admin_method','這個端點不接受此操作。');
   throw new ApiError(404,'admin_not_found','找不到這個私人端點。');
  }catch(error){
   const failed=errorResponse(error),out=new Headers(failed.headers);
   for(const [key,value]of Object.entries(headers))out.set(key,value);
   if(failed.status===429)out.set('Retry-After','900');
   return new Response(failed.body,{status:failed.status,headers:out});
  }
 }
}
