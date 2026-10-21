const KEY='hedo-anonymous-v1', QUEUE='hedo-sync-queue-v3', PROGRESS='hedo-achievement-queue-v1', CHARACTER_CACHE='hedo-character-cache-v1', MAX_QUEUE=500;
let token=null,queue=[],progress=[],ready=false,playerId=null,status='connecting',lastError='',storageError='';
let flushing=null,initializing=null,retryTimer=null,retryDelay=2000,snapshot=null,snapshotRevision=0;
let characterRows=[],charactersVerifiedAt=null,characterTrackingSince=null,characterCacheLoaded=false;
const confirmedProgress=new Map();
const listeners=new Set();
const pendingCount=()=>queue.length+progress.length;
const state=()=>({status,playerId,lastError:storageError||lastError,pending:pendingCount(),achievements:snapshot?.achievements||[],characters:structuredClone(characterRows),charactersVerifiedAt,characterTrackingSince});
function emit(){for(const fn of listeners)fn(state());}
try{
 token=localStorage.getItem(KEY);
 if(!/^[a-f0-9]{64}$/.test(token||'')){
  token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  localStorage.setItem(KEY,token);
 }
 const saved=JSON.parse(localStorage.getItem(QUEUE)||'[]');
 if(Array.isArray(saved))queue=saved; // Never truncate unsent runs on reload.
 const savedProgress=JSON.parse(localStorage.getItem(PROGRESS)||'[]');
 if(Array.isArray(savedProgress))progress=savedProgress;
}catch{token=null;status='local';storageError='此瀏覽器無法保存匿名同步資料，請保留目前頁面。';}
const legacyCharacterIds=['wing','spencer','erich','sonny','jenjen','rick','kind','hope','jack','meimei'];
const characterIds=[...legacyCharacterIds,'helen','sophie','jonathan','owen','sam','cindy','professor'];
const characterMetrics=['encounters','imaginedHits','realHits','affinityGained','affinityLost','affinityUpEvents','affinityDownEvents'];
function safeCharacterRows(value){
 if(!Array.isArray(value)||!value.length)return null;
 const rows=characterIds.map(id=>value.find(row=>row?.id===id));
 const valid=row=>row&&characterMetrics.every(key=>Number.isSafeInteger(row[key])&&row[key]>=0);
 // Verified older caches retain their original cast. Appended people remain
 // unknown until supplied; a missing new row is never a fabricated zero.
 if(rows.slice(0,legacyCharacterIds.length).some(row=>!valid(row))||rows.slice(legacyCharacterIds.length).some(row=>row!==undefined&&!valid(row)))return null;
 return rows.filter(Boolean).map(row=>({id:row.id,...Object.fromEntries(characterMetrics.map(key=>[key,row[key]]))}));
}
async function characterOwnerHash(){
 const bytes=new Uint8Array(token.match(/../g).map(byte=>parseInt(byte,16)));
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 return Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function loadCharacterCache(){
 if(characterCacheLoaded||!token)return;characterCacheLoaded=true;
 try{
  const saved=JSON.parse(localStorage.getItem(CHARACTER_CACHE)||'null');
  const rows=safeCharacterRows(saved?.characters);
  if(saved?.version===1&&saved.ownerHash===await characterOwnerHash()&&rows&&Number.isFinite(Date.parse(saved.verifiedAt))){characterRows=rows;charactersVerifiedAt=saved.verifiedAt;characterTrackingSince=typeof saved.trackingSince==='string'?saved.trackingSince:null;emit();}
 }catch{}
}
async function rememberSnapshot(data){
 snapshot=data;
 const rows=safeCharacterRows(data?.characters);
 if(!rows)return;
 characterRows=rows;charactersVerifiedAt=new Date().toISOString();characterTrackingSince=data.characterTrackingSince||data.trackingSince||characterTrackingSince;
 try{localStorage.setItem(CHARACTER_CACHE,JSON.stringify({version:1,ownerHash:await characterOwnerHash(),characters:characterRows,verifiedAt:charactersVerifiedAt,trackingSince:characterTrackingSince}));}catch{}
}
const proofKey=item=>JSON.stringify([item.roleId,item.seed,item.actions]);
function persist(){
 try{localStorage.setItem(QUEUE,JSON.stringify(queue));localStorage.setItem(PROGRESS,JSON.stringify(progress));storageError='';}
 catch{storageError='同步紀錄暫時無法存入瀏覽器；請保持此頁開啟並恢復連線。';}
}
async function api(path,body,method=body?'POST':'GET'){
 const response=await fetch(path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(7000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.message||data.error||'服務暫時無法連線'),{code:data.error,status:response.status,retryAfter:Number(response.headers.get('Retry-After'))||0});
 return data;
}
function scheduleRetry(error){
 if(retryTimer||!token)return;
 const delay=Math.min(60000,Math.max(retryDelay,(error?.retryAfter||0)*1000));
 retryDelay=Math.min(60000,retryDelay*2);
 retryTimer=setTimeout(()=>{retryTimer=null;void cloud.init();},delay);
}
function clearRetry(){if(retryTimer)clearTimeout(retryTimer);retryTimer=null;retryDelay=2000;}
function removeRun(runId){queue=queue.filter(item=>item.runId!==runId);persist();}
function removeProgress(item){progress=progress.filter(p=>p.runId!==item.runId||p.actions.length>item.actions.length);persist();}
async function flush(){
 if(flushing)return flushing;
 if(!ready||!pendingCount())return;
 flushing=(async()=>{
  let rejected=false;
  try{
   while(pendingCount()){
    const completing=queue.length>0,item=completing?queue[0]:progress[0];
    const remove=()=>completing?removeRun(item?.runId):removeProgress(item);
    try{const received=await api(completing?'/api/complete':'/api/achievements',item);snapshotRevision++;await rememberSnapshot(received);confirmedProgress.set(item.runId,proofKey(item));remove();if(completing)removeProgress(item);}
    catch(error){
     if([400,409,422].includes(error.status)){
      // Invalid old replays cannot be repaired by retrying. Their local ending
      // collection remains intact; let later valid runs reach the server.
      remove();rejected=true;continue;
     }
     if(error.status===401)ready=false;
     throw error;
    }
   }
   clearRetry();status='online';lastError=rejected?'部分舊紀錄無法驗證，已保留本機收藏；其他人生已同步。':'';
  }catch(error){
   status='pending';lastError='紀錄已留在此裝置，連線恢復後會再同步。';
   if(!error.status||error.status===401||error.status===429||error.status>=500)scheduleRetry(error);
  }finally{flushing=null;emit();}
 })();
 return flushing;
}
export const cloud={
 get state(){return state();},
 subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
 async init(){
  if(initializing)return initializing;
  if(!token){status='local';emit();return null;}
  initializing=(async()=>{
   await loadCharacterCache();
   try{
    const revision=snapshotRevision,received=await api('/api/player',{token});
    // A read started before an in-flight proof may arrive afterwards. It must
    // not replace the newer verified totals or the cache with its older view.
    if(revision===snapshotRevision)await rememberSnapshot(received);
    ready=true;playerId=snapshot.playerId;
    status='online';lastError='';emit();
    await flush();
    if(!pendingCount())clearRetry();
    return snapshot;
   }catch(error){
    ready=false;status=pendingCount()?'pending':'local';lastError='觀測站暫時無法連線，本機收藏照常保留。';
    if(!error.status||error.status===429||error.status>=500)scheduleRetry(error);
    emit();return null;
   }finally{initializing=null;}
  })();
  return initializing;
 },
 async complete(run){
  if(!run.completed||!Array.isArray(run.actions)||!run.runId)return;
  if(!queue.some(item=>item.runId===run.runId)){
   if(queue.length>=MAX_QUEUE){status='pending';lastError='已有500局等待同步，本局仍在本機收藏。請先恢復連線，再重試同步本局。';emit();return;}
   queue.push({runId:run.runId,roleId:run.roleId,seed:run.seed,actions:structuredClone(run.actions)});persist();
  }
  if(!ready){status='pending';emit();await this.init();}else{emit();await flush();}
 },
 async stats(){return api('/api/stats');},
 async characters(){return api('/api/characters');},
 async characterProgress(run){return this.achievementProgress(run);},
 async achievementProgress(run){
  if(!run?.runId||!Array.isArray(run.actions)||!run.actions.length)return null;
  const proof={runId:run.runId,roleId:run.roleId,seed:run.seed,actions:structuredClone(run.actions)};
  if(confirmedProgress.get(proof.runId)===proofKey(proof))return snapshot;
  const existing=progress.findIndex(p=>p.runId===proof.runId);
  if(existing>=0){if(progress[existing].actions.length<=proof.actions.length)progress[existing]=proof;}
  else{
   if(progress.length>=MAX_QUEUE){status='pending';lastError='成就已留在本機，請恢復連線再同步目前人生。';emit();return null;}
   progress.push(proof);
  }
  persist();
  if(!ready){status='pending';emit();await this.init();}else{emit();await flush();}
  return snapshot;
 },
 async feedbackConfig(){return api('/api/feedback-config');},
 async submitFeedback(payload){
  if(!ready)await this.init();
  if(!ready)throw new Error('無法建立匿名投稿身分，請先保留草稿，稍後再試。');
  return api('/api/feedback',payload);
 },
 async feedbackStatus(submissionId){
  if(!ready)await this.init();
  if(!ready)throw new Error('暫時無法查詢，請先保留這個分頁。');
  return api(`/api/feedback/${encodeURIComponent(submissionId)}`);
 },
 async retry(){return this.init();}
};
window.addEventListener('online',()=>{clearRetry();void cloud.init();});
