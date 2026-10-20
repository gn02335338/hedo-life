import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';
import { ApiError, tokenHash } from './http.js';

const columns=CHARACTER_METRICS.join(', ');
const fields=CHARACTER_METRICS.map(name=>`${name} INTEGER NOT NULL DEFAULT 0 CHECK (${name} >= 0)`).join(', ');
const placeholders=CHARACTER_METRICS.map(()=>'?').join(', ');
const conflict=()=>new ApiError(409,'character_run_conflict','這個人生編號已有其他紀錄，請保留原本的遊戲進度。');
const empty=id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))});

// Proofs are replayed by the API before arriving here. Only hashes and derived
// counters persist; seeds, actions, dialogue and request bodies never do.
export class CharacterStore {
 constructor(sql,storage,now=new Date().toISOString()){
  this.sql=sql;this.storage=storage;
  sql.exec(`
   CREATE TABLE IF NOT EXISTS achievement_runs (
    id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
    role_id TEXT NOT NULL, seed_hash TEXT NOT NULL, created_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS character_runs (
    id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id),
    role_id TEXT NOT NULL, seed_hash TEXT NOT NULL, action_count INTEGER NOT NULL,
    action_hash TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
    ending_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS character_run_totals (
    run_id TEXT NOT NULL REFERENCES character_runs(id), character_id TEXT NOT NULL,
    ${fields}, PRIMARY KEY (run_id,character_id)
   );
   CREATE TABLE IF NOT EXISTS player_characters (
    player_id TEXT NOT NULL REFERENCES players(id), character_id TEXT NOT NULL,
    ${fields}, PRIMARY KEY (player_id,character_id)
   );
   CREATE TABLE IF NOT EXISTS global_characters (
    character_id TEXT PRIMARY KEY, ${fields}
   );
   CREATE TABLE IF NOT EXISTS character_meta (key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  sql.exec('INSERT OR IGNORE INTO character_meta (key,value) VALUES (?,?)','tracking_since',now);
 }

 progress(runId){return this.sql.exec('SELECT * FROM character_runs WHERE id = ?',runId).toArray()[0]||null;}

 async assertIdentity(playerId,runId,roleId,seed){
  const seedHash=await tokenHash(seed);
  const previous=this.progress(runId);
  const achievement=this.sql.exec('SELECT * FROM achievement_runs WHERE id = ?',runId).toArray()[0];
  const completed=this.sql.exec('SELECT player_id,role_id,ending_id FROM runs WHERE id = ?',runId).toArray()[0];
  if([previous,achievement].some(row=>row&&(row.player_id!==playerId||row.role_id!==roleId||row.seed_hash!==seedHash))||completed&&(completed.player_id!==playerId||completed.role_id!==roleId))throw conflict();
  return seedHash;
 }

 snapshot(playerId){
  const rows=this.sql.exec(`SELECT character_id AS id, ${columns} FROM player_characters WHERE player_id = ?`,playerId).toArray();
  return CHARACTER_IDS.map(id=>rows.find(row=>row.id===id)||empty(id));
 }

 global(){
  const rows=this.sql.exec(`SELECT character_id AS id, ${columns} FROM global_characters`).toArray();
  return {version:1,characters:CHARACTER_IDS.map(id=>rows.find(row=>row.id===id)||empty(id)),trackingSince:this.sql.exec('SELECT value FROM character_meta WHERE key = ?','tracking_since').one().value};
 }

 async record(playerId,runId,run,now=new Date().toISOString()){
  const seedHash=await tokenHash(run.seed),actionCount=run.actions.length,actionHash=await tokenHash(JSON.stringify(run.actions));
  const derived=deriveCharacterStats(run);
  const totals=CHARACTER_IDS.map(id=>{
   const row=derived.find(item=>item.id===id);
   if(!row||CHARACTER_METRICS.some(key=>!Number.isSafeInteger(row[key])||row[key]<0))throw new Error('Invalid derived character counters');
   return row;
  });
  // A concurrent request can commit while hashing an observed prefix. Retry
  // with its new length before the synchronous compare-and-update transaction.
  for(;;){
   const observed=this.progress(runId);
   const prefixHash=observed&&actionCount>observed.action_count?await tokenHash(JSON.stringify(run.actions.slice(0,observed.action_count))):null;
   let retry=false,result;
   this.storage.transactionSync(()=>{
    const previous=this.progress(runId);
    if((previous?.action_count??-1)!==(observed?.action_count??-1)||(previous?.action_hash??null)!==(observed?.action_hash??null)){retry=true;return;}
    const achievement=this.sql.exec('SELECT * FROM achievement_runs WHERE id = ?',runId).toArray()[0];
    const completed=this.sql.exec('SELECT player_id,role_id,ending_id FROM runs WHERE id = ?',runId).toArray()[0];
    if([previous,achievement].some(row=>row&&(row.player_id!==playerId||row.role_id!==run.roleId||row.seed_hash!==seedHash))||completed&&(completed.player_id!==playerId||completed.role_id!==run.roleId||run.completed&&completed.ending_id!==run.endingId)||previous?.completed&&run.completed&&previous.ending_id!==run.endingId)throw conflict();
    // Historical completions have no action commitment. A matching ending is
    // insufficient evidence of the old branch, so they are never backfilled.
    if(completed&&!previous)throw new ApiError(409,'character_history_unavailable','這局在角色統計啟用前已完成，無法補算原本的互動。');
    if(previous){
     if(actionCount<previous.action_count){result={recorded:false,duplicate:true,outdated:true};return;}
     if(actionCount===previous.action_count){if(actionHash!==previous.action_hash)throw conflict();result={recorded:false,duplicate:true,outdated:false};return;}
     if(previous.completed||prefixHash!==previous.action_hash)throw conflict();
    }
    if(!achievement)this.sql.exec('INSERT INTO achievement_runs (id,player_id,role_id,seed_hash,created_at) VALUES (?,?,?,?,?)',runId,playerId,run.roleId,seedHash,now);
    if(!previous)this.sql.exec('INSERT INTO character_runs (id,player_id,role_id,seed_hash,action_count,action_hash,completed,ending_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',runId,playerId,run.roleId,seedHash,actionCount,actionHash,Number(run.completed),run.endingId||null,now,now);
    else this.sql.exec('UPDATE character_runs SET action_count=?,action_hash=?,completed=?,ending_id=?,updated_at=? WHERE id=?',actionCount,actionHash,Number(run.completed),run.endingId||null,now,runId);
    const oldRows=this.sql.exec(`SELECT character_id AS id, ${columns} FROM character_run_totals WHERE run_id = ?`,runId).toArray();
    for(const row of totals){
     const old=oldRows.find(item=>item.id===row.id)||empty(row.id),values=CHARACTER_METRICS.map(key=>row[key]),delta=CHARACTER_METRICS.map(key=>row[key]-old[key]);
     this.sql.exec(`INSERT INTO character_run_totals (run_id,character_id,${columns}) VALUES (?,?,${placeholders}) ON CONFLICT(run_id,character_id) DO UPDATE SET ${CHARACTER_METRICS.map(key=>`${key}=excluded.${key}`).join(',')}`,runId,row.id,...values);
     if(!delta.some(value=>value!==0))continue;
     this.sql.exec('INSERT OR IGNORE INTO player_characters (player_id,character_id) VALUES (?,?)',playerId,row.id);
     this.sql.exec(`UPDATE player_characters SET ${CHARACTER_METRICS.map(key=>`${key}=${key}+?`).join(',')} WHERE player_id=? AND character_id=?`,...delta,playerId,row.id);
     this.sql.exec('INSERT OR IGNORE INTO global_characters (character_id) VALUES (?)',row.id);
     this.sql.exec(`UPDATE global_characters SET ${CHARACTER_METRICS.map(key=>`${key}=${key}+?`).join(',')} WHERE character_id=?`,...delta,row.id);
    }
    result={recorded:true,duplicate:false,outdated:false};
   });
   if(!retry)return result;
  }
 }
}
