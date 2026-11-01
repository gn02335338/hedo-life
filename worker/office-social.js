import { ApiError, json, readJson, tokenHash } from './http.js';
import { CHARACTER_IDS } from '../dist/character-stats.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN=/^[a-f0-9]{64}$/;
const PRIVATE={'Vary':'Authorization, Cookie','Cross-Origin-Resource-Policy':'same-origin'};
export const OFFICE_SOCIAL_LIMITS=Object.freeze({leaseMs:90000,messageTtlMs:6*3600000,encounterGraceMs:5*60000,inboxPerMember:200,dedupePerMember:1000,receiptsPerMember:10000,receiptTtlMs:7*86400000,receiptsGlobal:200000,conversationsGlobal:10000});
const response=(body,status=200)=>json(body,status,PRIVATE);
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(400,'invalid_office_social','請確認社交設定與收件資料格式。');}
function text(value,max=500){if(typeof value!=='string'||!value.trim()||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))fail(400,'invalid_office_message','請輸入長度符合限制的純文字。');return value.trim();}
function uuid(value){if(typeof value!=='string'||!UUID.test(value))fail(400,'invalid_office_submission','請使用有效的操作識別碼。');return value.toLowerCase();}
const iso=value=>value==null?null:new Date(value).toISOString();
const publicMessage=row=>({id:row.id,memberId:row.member_id,text:row.text,recipientId:row.recipient_id,replyToId:row.reply_to_id||null,conversationId:row.conversation_id||null,turnIndex:row.turn_index||0,automated:Boolean(row.automated),createdAt:row.created_at});

export class OfficeSocialStore{
 constructor(sql,storage,{now=()=>Date.now(),assertApproved,mutation,limit}={}){
  this.sql=sql;this.storage=storage;this.now=now;this.assertApproved=assertApproved;this.mutation=mutation;this.limit=limit;
  const columns=new Set(sql.exec('PRAGMA table_info(office_members)').toArray().map(row=>row.name));
  for(const [name,value]of [['social_auto_reply',0],['social_auto_activities',0],['social_max_turns',4],['social_cooldown_seconds',60]])if(!columns.has(name))sql.exec(`ALTER TABLE office_members ADD COLUMN ${name} INTEGER NOT NULL DEFAULT ${value}`);
  const messages=new Set(sql.exec('PRAGMA table_info(office_messages)').toArray().map(row=>row.name));
  for(const [name,type]of [['reply_to_id','TEXT'],['conversation_id','TEXT'],['turn_index','INTEGER NOT NULL DEFAULT 0'],['automated','INTEGER NOT NULL DEFAULT 0']])if(!messages.has(name))sql.exec(`ALTER TABLE office_messages ADD COLUMN ${name} ${type}`);
  sql.exec(`CREATE TABLE IF NOT EXISTS office_social_conversations(id TEXT PRIMARY KEY,pair_key TEXT NOT NULL,turns INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS office_social_pair ON office_social_conversations(pair_key,created_at);
   CREATE INDEX IF NOT EXISTS office_social_expiry ON office_social_conversations(expires_at);
   CREATE TABLE IF NOT EXISTS office_social_turns(conversation_id TEXT NOT NULL,member_id TEXT NOT NULL,last_reply_at INTEGER NOT NULL,PRIMARY KEY(conversation_id,member_id));
   CREATE TABLE IF NOT EXISTS office_inbox(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,type TEXT NOT NULL,sender_id TEXT,payload_json TEXT NOT NULL,conversation_id TEXT,source_message_id TEXT,expires_at INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'pending',lease_hash TEXT,lease_until INTEGER,created_at INTEGER NOT NULL,result_message_id TEXT);
   CREATE INDEX IF NOT EXISTS office_inbox_owner ON office_inbox(member_id,created_at);
   CREATE TABLE IF NOT EXISTS office_inbox_dedupe(member_id TEXT NOT NULL,source_key TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(member_id,source_key));
   CREATE TABLE IF NOT EXISTS office_social_receipts(member_id TEXT NOT NULL,submission_id TEXT NOT NULL,fingerprint TEXT NOT NULL,result_json TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(member_id,submission_id));
   CREATE INDEX IF NOT EXISTS office_social_receipt_expiry ON office_social_receipts(created_at);`);
 }
 preferences(memberId){const row=this.assertApproved(memberId);return{autoReply:Boolean(row.social_auto_reply),autoActivities:Boolean(row.social_auto_activities),maxTurns:row.social_max_turns||4,cooldownSeconds:row.social_cooldown_seconds||60};}
 setPreferences(memberId,body){
  fields(body,['autoReply','autoActivities','maxTurns','cooldownSeconds']);
  if(typeof body.autoReply!=='boolean'||typeof body.autoActivities!=='boolean'||!Number.isInteger(body.maxTurns)||body.maxTurns<1||body.maxTurns>6||!Number.isInteger(body.cooldownSeconds)||body.cooldownSeconds<30||body.cooldownSeconds>3600)fail(400,'invalid_office_preferences','自動回覆與活動需明確開啟，回合數為 1–6，冷卻為 30–3600 秒。');
  this.mutation(memberId,()=>{const member=this.assertApproved(memberId);if(member.kind!=='agent'&&(body.autoReply||body.autoActivities))fail(400,'office_agent_preferences','自動回覆與自動活動只供 Agent 座位使用；真人可手動互動。');
   this.sql.exec('UPDATE office_members SET social_auto_reply=?,social_auto_activities=?,social_max_turns=?,social_cooldown_seconds=? WHERE id=?',Number(body.autoReply),Number(body.autoActivities),body.maxTurns,body.cooldownSeconds,memberId);
   if(!body.autoReply)this.sql.exec("UPDATE office_inbox SET state='pending',lease_hash=NULL,lease_until=NULL WHERE member_id=? AND type IN ('message','encounter') AND state='leased'",memberId);
   if(!body.autoActivities)this.sql.exec("UPDATE office_inbox SET state='pending',lease_hash=NULL,lease_until=NULL WHERE member_id=? AND type LIKE 'activity-%' AND state='leased'",memberId);
  });return{socialPreferences:this.preferences(memberId)};
 }
 cleanupConversations(){
  const now=this.now();
  // Expired threads cannot remain leased or be revived from retained history.
  this.sql.exec('DELETE FROM office_inbox WHERE conversation_id IN (SELECT id FROM office_social_conversations WHERE expires_at<=?)',now);
  this.sql.exec('DELETE FROM office_social_turns WHERE conversation_id IN (SELECT id FROM office_social_conversations WHERE expires_at<=?)',now);
  this.sql.exec('DELETE FROM office_social_conversations WHERE expires_at<=?',now);
 }
 cleanupReceipts(){this.sql.exec('DELETE FROM office_social_receipts WHERE created_at<=?',this.now()-OFFICE_SOCIAL_LIMITS.receiptTtlMs);}
 cleanup(memberId){const now=this.now();this.cleanupConversations();this.cleanupReceipts();this.sql.exec('DELETE FROM office_inbox WHERE member_id=? AND expires_at<=?',memberId,now);this.sql.exec('DELETE FROM office_inbox_dedupe WHERE member_id=? AND expires_at<=?',memberId,now);this.sql.exec("UPDATE office_inbox SET state='pending',lease_hash=NULL,lease_until=NULL WHERE member_id=? AND state='leased' AND lease_until<=?",memberId,now);}
 item(row){return{id:row.id,type:row.type,senderId:row.sender_id,payload:JSON.parse(row.payload_json),expiresAt:iso(row.expires_at),state:row.state,leaseExpiresAt:iso(row.lease_until)};}
 deliver(memberId,{key,type,senderId=null,payload,expiresAt,conversationId=null,sourceMessageId=null}){
  if(!this.sql.exec("SELECT id FROM office_members WHERE id=? AND admission_status='approved'",memberId).toArray().length)return null;
  const now=this.now(),expiry=typeof expiresAt==='string'?Date.parse(expiresAt):expiresAt;
  if(!Number.isFinite(expiry)||expiry<=now||typeof key!=='string'||key.length>240)return null;
  this.cleanup(memberId);if(this.sql.exec('SELECT source_key FROM office_inbox_dedupe WHERE member_id=? AND source_key=?',memberId,key).toArray().length)return null;
  const content=JSON.stringify(payload);if(new TextEncoder().encode(content).length>16384)return null;
  const id=crypto.randomUUID();this.sql.exec('INSERT INTO office_inbox(id,member_id,type,sender_id,payload_json,conversation_id,source_message_id,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)',id,memberId,type,senderId,content,conversationId,sourceMessageId,expiry,now);
  this.sql.exec('INSERT INTO office_inbox_dedupe(member_id,source_key,expires_at,created_at) VALUES(?,?,?,?)',memberId,key,expiry+86400000,now);
  this.sql.exec('DELETE FROM office_inbox WHERE member_id=? AND id NOT IN (SELECT id FROM office_inbox WHERE member_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200)',memberId,memberId);
  this.sql.exec('DELETE FROM office_inbox_dedupe WHERE member_id=? AND rowid NOT IN (SELECT rowid FROM office_inbox_dedupe WHERE member_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1000)',memberId,memberId);return id;
 }
 deliverActivity(memberId,invitation){if(!invitation||!['activity-invitation','activity-turn'].includes(invitation.type))return null;return this.deliver(memberId,{key:invitation.id,type:invitation.type,senderId:invitation.senderId??null,payload:invitation.payload,expiresAt:invitation.expiresAt});}
 conversation(id,pairKey,expiresAt=this.now()+OFFICE_SOCIAL_LIMITS.messageTtlMs){
  let row=this.sql.exec('SELECT * FROM office_social_conversations WHERE id=?',id).toArray()[0];
  if(!row){
   this.cleanupConversations();
   if(this.sql.exec('SELECT COUNT(*) AS n FROM office_social_conversations').one().n>=OFFICE_SOCIAL_LIMITS.conversationsGlobal)fail(503,'office_conversation_capacity','目前的對話紀錄暫時已滿，請稍後重試。');
   const now=this.now();this.sql.exec('INSERT INTO office_social_conversations(id,pair_key,created_at,expires_at) VALUES(?,?,?,?)',id,pairKey,now,expiresAt);
   row=this.sql.exec('SELECT * FROM office_social_conversations WHERE id=?',id).one();
  }
  return row;
 }
 limitFor(memberId,senderId){let maximum=this.preferences(memberId).maxTurns;if(senderId&&!CHARACTER_IDS.includes(senderId)){const other=this.sql.exec("SELECT social_max_turns FROM office_members WHERE id=? AND admission_status='approved'",senderId).toArray()[0];if(other)maximum=Math.min(maximum,other.social_max_turns||4);}return Math.min(6,maximum);}
 checkTurn(memberId,conversationId,senderId){
  const row=this.sql.exec('SELECT * FROM office_social_conversations WHERE id=?',conversationId).toArray()[0];
  if(!row||row.expires_at<=this.now())fail(409,'office_conversation_expired','這段對話已結束，請等候新的邀請。');
  if(row.turns>=this.limitFor(memberId,senderId))fail(409,'office_conversation_limit','這段對話已達回合上限，請停下來等候真人開啟新段。');
  const previous=this.sql.exec('SELECT last_reply_at FROM office_social_turns WHERE conversation_id=? AND member_id=?',conversationId,memberId).toArray()[0],wait=previous?previous.last_reply_at+this.preferences(memberId).cooldownSeconds*1000-this.now():0;
  if(wait>0){const error=new ApiError(429,'office_social_cooldown','請稍等這段對話的冷卻時間。');error.retryAfter=Math.ceil(wait/1000);throw error;}return row;
 }
 sourceAllowed(senderId){return senderId===null||CHARACTER_IDS.includes(senderId)||this.sql.exec("SELECT id FROM office_members WHERE id=? AND admission_status='approved'",senderId).toArray().length>0;}
 deliverMessage(row){
  if(!row.recipient_id||row.recipient_id===row.member_id||CHARACTER_IDS.includes(row.recipient_id))return;
  const sender=this.sql.exec("SELECT id,name,kind FROM office_members WHERE id=? AND admission_status='approved'",row.member_id).toArray()[0];if(!sender)return;
  const expiry=Date.parse(row.created_at)+OFFICE_SOCIAL_LIMITS.messageTtlMs;
  if(expiry<=this.now())return;
  const conversationId=row.conversation_id||'legacy-message:'+row.id;
  if(row.conversation_id){const conversation=this.sql.exec('SELECT expires_at FROM office_social_conversations WHERE id=?',conversationId).toArray()[0];if(!conversation||conversation.expires_at<=this.now())return;}
  else this.conversation(conversationId,[row.member_id,row.recipient_id].sort().join(':'),expiry);
  this.deliver(row.recipient_id,{key:'message:'+row.id,type:'message',senderId:row.member_id,payload:{message:publicMessage(row),sender,messages:this.sql.exec("SELECT x.* FROM office_messages x JOIN office_members m ON m.id=x.member_id WHERE x.conversation_id=? AND m.admission_status='approved' ORDER BY x.rowid DESC LIMIT 6",conversationId).toArray().reverse().map(publicMessage),conversation:{id:conversationId,turnIndex:row.turn_index||0,maxTurns:this.limitFor(row.recipient_id,row.member_id)}},expiresAt:Date.parse(row.created_at)+OFFICE_SOCIAL_LIMITS.messageTtlMs,conversationId,sourceMessageId:row.id});
 }
 sync(memberId,encounters=[]){
  this.cleanup(memberId);
  const rows=this.sql.exec("SELECT x.* FROM office_messages x JOIN office_members m ON m.id=x.member_id WHERE x.recipient_id=? AND m.admission_status='approved' ORDER BY x.rowid DESC LIMIT 100",memberId).toArray();for(const row of rows)this.deliverMessage(row);
  for(const encounter of encounters){if(encounter.recipientId!==memberId||!CHARACTER_IDS.includes(encounter.speakerId))continue;
   const sender=encounter.participants.find(person=>person.id===encounter.speakerId);if(!sender)continue;
   const expiry=Date.parse(encounter.endsAt)+OFFICE_SOCIAL_LIMITS.encounterGraceMs;if(!Number.isFinite(expiry)||expiry<=this.now())continue;
   const id='encounter:'+encounter.id+':'+memberId;this.conversation(id,[memberId,encounter.speakerId].sort().join(':'),expiry);
   this.deliver(memberId,{key:id,type:'encounter',senderId:encounter.speakerId,payload:{encounter,sender:{id:sender.id,name:sender.name,kind:'character'},conversation:{id,turnIndex:0,maxTurns:this.limitFor(memberId,encounter.speakerId)}},expiresAt:Date.parse(encounter.endsAt)+OFFICE_SOCIAL_LIMITS.encounterGraceMs,conversationId:id});
  }
 }
 inbox(memberId){this.assertApproved(memberId);this.cleanup(memberId);return{items:this.sql.exec("SELECT * FROM office_inbox WHERE member_id=? ORDER BY CASE state WHEN 'pending' THEN 0 WHEN 'leased' THEN 1 ELSE 2 END,created_at DESC,rowid DESC LIMIT 50",memberId).toArray().filter(row=>this.sourceAllowed(row.sender_id)).map(row=>this.item(row)),socialPreferences:this.preferences(memberId),serverTime:iso(this.now())};}
 receipt(memberId,submissionId,fingerprint){
  if(!submissionId)return null;this.assertApproved(memberId);
  const row=this.sql.exec('SELECT fingerprint,result_json,created_at FROM office_social_receipts WHERE member_id=? AND submission_id=?',memberId,submissionId).toArray()[0];if(!row)return null;
  if(row.created_at+OFFICE_SOCIAL_LIMITS.receiptTtlMs<=this.now()){this.sql.exec('DELETE FROM office_social_receipts WHERE member_id=? AND submission_id=?',memberId,submissionId);return null;}
  if(row.fingerprint!==fingerprint)fail(409,'office_submission_conflict','這個操作識別碼已用於其他內容，請保留原本操作。');return{...JSON.parse(row.result_json),duplicate:true};
 }
 saveReceipt(memberId,submissionId,fingerprint,result){
  if(!submissionId)return;this.cleanupReceipts();
  if(this.sql.exec('SELECT COUNT(*) AS n FROM office_social_receipts WHERE member_id=?',memberId).one().n>=OFFICE_SOCIAL_LIMITS.receiptsPerMember||this.sql.exec('SELECT COUNT(*) AS n FROM office_social_receipts').one().n>=OFFICE_SOCIAL_LIMITS.receiptsGlobal)fail(503,'office_receipt_capacity','操作紀錄暫時已滿，請稍後重試。');
  // Receipts retain only the public result, never a repeated invitation payload.
  const compact={...result};if(compact.item){const{payload,...summary}=compact.item;compact.item=summary;}
  this.sql.exec('INSERT INTO office_social_receipts(member_id,submission_id,fingerprint,result_json,created_at) VALUES(?,?,?,?,?)',memberId,submissionId,fingerprint,JSON.stringify(compact),this.now());
 }
 validateMessage(body){fields(body,['text','recipientId','replyToId','submissionId']);if(body.recipientId===null)fail(400,'invalid_office_recipient','請選擇公開角色或目前已核准的辦公室成員。');return{text:text(body.text),recipientId:body.recipientId===undefined?null:body.recipientId,replyToId:body.replyToId===undefined?null:uuid(body.replyToId),submissionId:body.submissionId===undefined?null:uuid(body.submissionId)};}
 recipient(value){if(value===null)return null;if(typeof value!=='string'||!CHARACTER_IDS.includes(value)&&(!UUID.test(value)||!this.sql.exec("SELECT id FROM office_members WHERE id=? AND admission_status='approved'",value.toLowerCase()).toArray().length))fail(400,'invalid_office_recipient','請選擇公開角色或目前已核准的辦公室成員。');return CHARACTER_IDS.includes(value)?value:value.toLowerCase();}
 commitMessage(memberId,input,{automated=false,conversationId=null,sourceMessageId=null,sourceSenderId=null}={}){
  const member=this.assertApproved(memberId),now=this.now();let recipient=this.recipient(input.recipientId),replyToId=input.replyToId,parent=null;
  if(replyToId){parent=this.sql.exec("SELECT x.* FROM office_messages x JOIN office_members m ON m.id=x.member_id WHERE x.id=? AND m.admission_status='approved'",replyToId).toArray()[0];if(!parent)fail(404,'office_reply_missing','原本的公開留言已無法使用。');if(recipient!==null&&recipient!==parent.member_id)fail(400,'office_reply_recipient','回覆對象需與原留言的發話者一致。');recipient=parent.member_id;if(member.kind==='agent'&&Date.parse(parent.created_at)+OFFICE_SOCIAL_LIMITS.messageTtlMs<=now)fail(409,'office_conversation_expired','這段對話已結束，請等候新的邀請。');if(member.kind==='agent'&&parent.recipient_id!==memberId)fail(403,'office_reply_owner','請只回覆傳給自己的對話。');}
  if(sourceSenderId!==null){recipient=this.recipient(sourceSenderId);replyToId=sourceMessageId;}
  const pairKey=[memberId,recipient||'public'].sort().join(':'),newId=crypto.randomUUID();
  if(member.kind==='human')conversationId=newId;
  else if(!conversationId)conversationId=parent?.conversation_id||null;
  if(member.kind==='agent'&&!conversationId&&recipient&&!CHARACTER_IDS.includes(recipient)){conversationId=this.sql.exec('SELECT id FROM office_social_conversations WHERE pair_key=? AND expires_at>? ORDER BY created_at DESC,rowid DESC LIMIT 1',pairKey,now).toArray()[0]?.id||null;}
  let conversation;
  if(conversationId&&member.kind==='agent'){
   conversation=this.sql.exec('SELECT * FROM office_social_conversations WHERE id=?',conversationId).toArray()[0];
   if(!conversation||conversation.expires_at<=now)fail(409,'office_conversation_expired','這段對話已結束，請等候新的邀請。');
  }else conversation=this.conversation(conversationId||newId,pairKey);
  let turnIndex=0;if(member.kind==='agent'&&recipient){this.checkTurn(memberId,conversation.id,recipient);turnIndex=conversation.turns+1;this.sql.exec('UPDATE office_social_conversations SET turns=? WHERE id=?',turnIndex,conversation.id);this.sql.exec('INSERT INTO office_social_turns(conversation_id,member_id,last_reply_at) VALUES(?,?,?) ON CONFLICT(conversation_id,member_id) DO UPDATE SET last_reply_at=excluded.last_reply_at',conversation.id,memberId,now);}
  this.limit('message:'+memberId,10);
  this.sql.exec('INSERT INTO office_messages(id,member_id,text,recipient_id,reply_to_id,conversation_id,turn_index,automated,created_at) VALUES(?,?,?,?,?,?,?,?,?)',newId,memberId,input.text,recipient,replyToId,conversation.id,turnIndex,Number(automated),iso(now));
  this.sql.exec('DELETE FROM office_messages WHERE rowid NOT IN (SELECT rowid FROM office_messages ORDER BY rowid DESC LIMIT 500)');
  const row=this.sql.exec('SELECT * FROM office_messages WHERE id=?',newId).one();this.deliverMessage(row);
  if(parent)this.sql.exec("UPDATE office_inbox SET state='handled',lease_hash=NULL,lease_until=NULL,result_message_id=? WHERE member_id=? AND source_message_id=? AND state!='handled'",newId,memberId,parent.id);
  return{message:publicMessage(row),duplicate:false};
 }
 async postMessage(memberId,body){this.assertApproved(memberId);const input=this.validateMessage(body),fingerprint=await tokenHash(JSON.stringify({op:'message',...input}));const old=this.receipt(memberId,input.submissionId,fingerprint);if(old)return old;return this.mutation(memberId,()=>{const retry=this.receipt(memberId,input.submissionId,fingerprint);if(retry)return retry;const result=this.commitMessage(memberId,input);this.saveReceipt(memberId,input.submissionId,fingerprint,result);return result;});}
 getItem(memberId,id){uuid(id);const row=this.sql.exec('SELECT * FROM office_inbox WHERE id=? AND member_id=?',id,memberId).toArray()[0];if(!row||row.expires_at<=this.now()||!this.sourceAllowed(row.sender_id))fail(404,'office_inbox_missing','找不到可處理的收件項目。');return row;}
 optedIn(memberId,row){const pref=this.preferences(memberId),activity=row.type.startsWith('activity-');if(!(activity?pref.autoActivities:pref.autoReply))fail(403,'office_social_opt_in','請先明確開啟對應的自動回覆或活動設定。');return pref;}
 async claim(memberId,id,body){fields(body,[]);this.assertApproved(memberId);const leaseToken=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),hash=await tokenHash(leaseToken);return this.mutation(memberId,()=>{const row=this.getItem(memberId,id);this.optedIn(memberId,row);if(row.state==='handled')fail(409,'office_inbox_handled','這個項目已處理完成。');if(row.state==='leased'&&row.lease_until>this.now())fail(409,'office_inbox_leased','這個項目正在處理中，請勿重複啟動模型。');if(!row.type.startsWith('activity-'))this.checkTurn(memberId,row.conversation_id,row.sender_id);const until=Math.min(row.expires_at,this.now()+OFFICE_SOCIAL_LIMITS.leaseMs);this.sql.exec("UPDATE office_inbox SET state='leased',lease_hash=?,lease_until=? WHERE id=?",hash,until,row.id);return{item:this.item({...row,state:'leased',lease_until:until}),leaseToken,leaseExpiresAt:iso(until)};});}
 async resolve(memberId,id,body,reply){
  fields(body,reply?['leaseToken','text','submissionId']:['leaseToken','submissionId']);this.assertApproved(memberId);if(typeof body.leaseToken!=='string'||!TOKEN.test(body.leaseToken))fail(400,'invalid_office_lease','請使用這次領取的私有租約。');
  const submissionId=uuid(body.submissionId),message=reply?text(body.text):null,fingerprint=await tokenHash(JSON.stringify({op:reply?'reply':'ack',id,text:message})),leaseHash=await tokenHash(body.leaseToken);
  const old=this.receipt(memberId,submissionId,fingerprint);if(old)return old;
  return this.mutation(memberId,()=>{const retry=this.receipt(memberId,submissionId,fingerprint);if(retry)return retry;const row=this.getItem(memberId,id);if(row.state!=='leased'||row.lease_until<=this.now()||row.lease_hash!==leaseHash)fail(409,'office_lease_expired','租約已過期或已更新，請重新讀取收件匣。');
   let sent={};if(reply){this.optedIn(memberId,row);if(row.type.startsWith('activity-'))fail(400,'office_activity_reply','請使用活動工具，再確認處理完成。');this.checkTurn(memberId,row.conversation_id,row.sender_id);sent=this.commitMessage(memberId,{text:message,recipientId:row.sender_id,replyToId:null,submissionId:null},{automated:true,conversationId:row.conversation_id,sourceMessageId:row.source_message_id,sourceSenderId:row.sender_id});}
   this.sql.exec("UPDATE office_inbox SET state='handled',lease_hash=NULL,lease_until=NULL,result_message_id=? WHERE id=?",sent.message?.id||null,row.id);const item=this.item({...row,state:'handled',lease_until:null}),result={...sent,item,duplicate:false};this.saveReceipt(memberId,submissionId,fingerprint,result);return result;
  });
 }
 async fetch(request,office){const path=new URL(request.url).pathname,member=await office.identify(request,true);
  if(path==='/api/office/social-preferences'&&request.method==='GET')return response({socialPreferences:this.preferences(member.id)});
  if(path==='/api/office/social-preferences'&&request.method==='POST')return response(this.setPreferences(member.id,await readJson(request,{maxBytes:1024})));
  if(path==='/api/office/inbox'&&request.method==='GET'){this.sync(member.id,office.currentEncounters());if(office.activities){const invitations=office.activities.invitations(member.id);if(Array.isArray(invitations))for(const invitation of invitations)this.deliverActivity(member.id,invitation);}return response({...this.inbox(member.id),activities:office.activities?.snapshot(member.id)||null});}
  const action=/^\/api\/office\/inbox\/([^/]+)\/(claim|reply|ack)$/.exec(path);if(action&&request.method==='POST'){const body=await readJson(request,{maxBytes:4096});return response(action[2]==='claim'?await this.claim(member.id,action[1],body):await this.resolve(member.id,action[1],body,action[2]==='reply'));}
  fail(405,'office_social_method','這個社交端點不接受此操作。');
 }
}
