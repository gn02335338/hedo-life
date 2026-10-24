import {createCardState,projectCardState,applyCardAction} from './rules.js';
export const PRACTICE_KEY='hodo-cards-practice-v1';
export const PENDING_KEY='hodo-cards-pending-v1';
const IDENTITY_KEY='hedo-anonymous-v1';
let token=null,owner=null,mode='online',practice=null;
const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key,value)=>{try{localStorage.setItem(key,value);}catch{throw new Error('瀏覽器無法保存紀錄；請開啟儲存權限後再開始。');}};
async function request(path,body){const response=await fetch(path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.message||data.error||'卡冊服務暫時無法連線。'),{status:response.status});return data;}
async function identity(){token=read(IDENTITY_KEY);if(!/^[a-f0-9]{64}$/.test(token||'')){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');write(IDENTITY_KEY,token);}const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));owner=Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');await request('/api/player',{token});}
function pending(){try{const value=JSON.parse(read(PENDING_KEY)||'null');return value?.owner===owner&&value.body?value:null;}catch{return null;}}
function clearPending(expectedOwner,requestId){try{const current=JSON.parse(read(PENDING_KEY)||'null');if(current?.owner===expectedOwner&&current.body?.requestId===requestId)localStorage.removeItem(PENDING_KEY);}catch{}}
export const cardClient={
 get mode(){return mode;},get hasPending(){return mode==='online'&&!!pending();},
 async connect(){await identity();const saved=pending();if(saved){try{const data=await request('/api/cards/action',saved.body);clearPending(saved.owner,saved.body.requestId);mode='online';return data.state;}catch(error){if([400,409,422].includes(error.status)){clearPending(saved.owner,saved.body.requestId);}else throw error;}}const data=await request('/api/cards');mode='online';return data.state;},
 async practice(){mode='practice';try{const saved=JSON.parse(read(PRACTICE_KEY)||'null');practice=saved?.version===1? saved:createCardState(`practice-${crypto.randomUUID()}`);}catch{practice=createCardState(`practice-${crypto.randomUUID()}`);}write(PRACTICE_KEY,JSON.stringify(practice));return projectCardState(practice);},
 async action(state,action){if(mode==='practice'){practice=applyCardAction(practice,action);write(PRACTICE_KEY,JSON.stringify(practice));return projectCardState(practice);}if(pending())throw new Error('上一個操作尚未確認，請先按「重新連線」。');const body={requestId:crypto.randomUUID(),revision:state.revision,action},operationOwner=owner;write(PENDING_KEY,JSON.stringify({owner:operationOwner,body}));try{const data=await request('/api/cards/action',body);clearPending(operationOwner,body.requestId);return data.state;}catch(error){if([400,409,422,429].includes(error.status)){clearPending(operationOwner,body.requestId);if(error.status===409)error.message='卡冊已在其他分頁更新，請重新連線讀取最新紀錄。';}throw error;}},
};
