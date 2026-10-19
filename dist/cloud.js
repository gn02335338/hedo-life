const KEY='hedo-anonymous-v1', QUEUE='hedo-sync-queue-v3', MAX_QUEUE=500;
let token=null,queue=[],ready=false,playerId=null,status='connecting',lastError='',storageError='';
let flushing=null,initializing=null,retryTimer=null,retryDelay=2000,snapshot=null;
const listeners=new Set();
const state=()=>({status,playerId,lastError:storageError||lastError,pending:queue.length});
function emit(){for(const fn of listeners)fn(state());}
try{
 token=localStorage.getItem(KEY);
 if(!/^[a-f0-9]{64}$/.test(token||'')){
  token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
  localStorage.setItem(KEY,token);
 }
 const saved=JSON.parse(localStorage.getItem(QUEUE)||'[]');
 if(Array.isArray(saved))queue=saved; // Never truncate unsent runs on reload.
}catch{token=null;status='local';storageError='此瀏覽器無法保存匿名同步資料，請保留目前頁面。';}
function persist(){
 try{localStorage.setItem(QUEUE,JSON.stringify(queue));storageError='';}
 catch{storageError='同步紀錄暫時無法存入瀏覽器；請保持此頁開啟並恢復連線。';}
}
async function api(path,body,method=body?'POST':'GET'){
 const response=await fetch(path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(7000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(data.error||'服務暫時無法連線'),{status:response.status,retryAfter:Number(response.headers.get('Retry-After'))||0});
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
async function flush(){
 if(flushing)return flushing;
 if(!ready||!queue.length)return;
 flushing=(async()=>{
  let rejected=false;
  try{
   while(queue.length){
    const item=queue[0];
    try{snapshot=await api('/api/complete',item);removeRun(item.runId);}
    catch(error){
     if([400,409,422].includes(error.status)){
      // Invalid old replays cannot be repaired by retrying. Their local ending
      // collection remains intact; let later valid runs reach the server.
      removeRun(item?.runId);rejected=true;continue;
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
   try{
    snapshot=await api('/api/player',{token});ready=true;playerId=snapshot.playerId;
    status='online';lastError='';emit();
    await flush();
    if(!queue.length)clearRetry();
    return snapshot;
   }catch(error){
    ready=false;status=queue.length?'pending':'local';lastError='觀測站暫時無法連線，本機收藏照常保留。';
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
 async retry(){return this.init();}
};
window.addEventListener('online',()=>{clearRetry();void cloud.init();});
