import {ENDINGS} from '../dist/endings.js';
import {fullCareer} from '../dist/career-api.js';
import {departureWays} from './departures.js';

const endingTypes=new Map(ENDINGS.map(ending=>[ending.id,ending.type]));
const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const bins=(ids,counts)=>ids.map(id=>({id,count:counts[id]||0}));

// This projection accepts a server-replayed, completed life, never a request
// body. It stores only rule/rank classifications and small derived counters.
export function deriveObservation(run){
 if(!run?.completed||!endingTypes.has(run.endingId))return null;
 const match=/^e([2-9]|[12]\d|3[01234567])-/.exec(run.seed),cohort=match?Number(match[1]):1;
 const history=run.history||[];
 const payCuts=history.reduce((total,row,index)=>total+Number(index>0&&Number.isFinite(row.pay)&&Number.isFinite(history[index-1]?.pay)&&row.pay<history[index-1].pay),0);
 const title=run.patronage?.title;
 return {
  rule_cohort:cohort,career_scheme:fullCareer(run)?'full8':'legacy5',final_rank:run.rank,
  appointment:title==='乾兒子'?'son':title==='乾女兒'?'daughter':null,
  pip_count:count(run.pipCount),promotions:count(run.flags?.promotions),pay_cuts:payCuts,
  mood_collapses:count(run.flags?.mood_crash_count),
 };
}

export class ObservationStore{
 constructor(sql){
  this.sql=sql;
  sql.exec(`CREATE TABLE IF NOT EXISTS run_observations (
   run_id TEXT PRIMARY KEY REFERENCES runs(id),
   rule_cohort INTEGER NOT NULL CHECK (rule_cohort >= 1),
   career_scheme TEXT NOT NULL CHECK (career_scheme IN ('full8','legacy5')),
   final_rank INTEGER NOT NULL CHECK (final_rank >= 0 AND final_rank <= 7),
   appointment TEXT CHECK (appointment IN ('son','daughter')),
   pip_count INTEGER NOT NULL CHECK (pip_count >= 0),
   promotions INTEGER NOT NULL CHECK (promotions >= 0),
   pay_cuts INTEGER NOT NULL CHECK (pay_cuts >= 0),
   mood_collapses INTEGER NOT NULL CHECK (mood_collapses >= 0),
   created_at TEXT NOT NULL
  )`);
 }

 record(runId,run,now=new Date().toISOString()){
  const observed=deriveObservation(run);if(!observed)return false;
  // A valid replay can still belong to a different historical branch. Both
  // caller-side action commitments and the original completion must agree.
  const saved=this.sql.exec('SELECT ending_id,role_id,actual_role_id,rank,salary,turns FROM runs WHERE id = ?',runId).toArray()[0];
  if(!saved||saved.ending_id!==run.endingId||saved.role_id!==run.roleId||saved.actual_role_id!==run.actualRoleId||saved.rank!==run.rank||saved.salary!==run.pay||saved.turns!==Math.min(run.turn+1,24))return false;
  this.sql.exec(`INSERT OR IGNORE INTO run_observations
   (run_id,rule_cohort,career_scheme,final_rank,appointment,pip_count,promotions,pay_cuts,mood_collapses,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,runId,observed.rule_cohort,observed.career_scheme,observed.final_rank,observed.appointment,observed.pip_count,observed.promotions,observed.pay_cuts,observed.mood_collapses,now);
  return true;
 }

 snapshot(){
  const sql=this.sql,total=sql.exec('SELECT COUNT(*) AS n FROM runs').one().n;
  const observations=sql.exec(`SELECT COUNT(*) AS n,MIN(created_at) AS since,
   COALESCE(SUM(pip_count > 0),0) AS pip,COALESCE(SUM(promotions > 0),0) AS promoted,
   COALESCE(SUM(pay_cuts > 0),0) AS payCut,COALESCE(SUM(mood_collapses > 0),0) AS collapse,
   COALESCE(SUM(appointment IS NOT NULL),0) AS appointed FROM run_observations`).one();
  const career=scheme=>{
   const rows=sql.exec('SELECT final_rank AS rank,COUNT(*) AS count FROM run_observations WHERE career_scheme = ? AND appointment IS NULL GROUP BY final_rank',scheme).toArray();
   return Array.from({length:scheme==='full8'?8:5},(_,rank)=>({rank,count:rows.find(row=>row.rank===rank)?.count||0}));
  };
  const special=Object.fromEntries(sql.exec('SELECT appointment AS id,COUNT(*) AS count FROM run_observations WHERE appointment IS NOT NULL GROUP BY appointment').toArray().map(row=>[row.id,row.count]));
  const endingCounts=sql.exec('SELECT ending_id AS id,COUNT(*) AS count FROM runs GROUP BY ending_id').toArray();
  const types={good:0,normal:0,bad:0,secret:0};
  for(const row of endingCounts){
   const type=endingTypes.get(row.id);if(Object.hasOwn(types,type))types[type]+=row.count;
  }
  const tenure=Object.fromEntries(sql.exec(`SELECT CASE WHEN turns <= 3 THEN '1-3' WHEN turns <= 7 THEN '4-7' WHEN turns <= 12 THEN '8-12' WHEN turns <= 19 THEN '13-19' ELSE '20-24' END AS id,COUNT(*) AS count FROM runs GROUP BY 1`).toArray().map(row=>[row.id,row.count]));
  const salaries=Object.fromEntries(sql.exec(`SELECT CASE WHEN salary < 30 THEN 'under30' WHEN salary < 50 THEN '30-49' WHEN salary < 80 THEN '50-79' WHEN salary < 120 THEN '80-119' ELSE '120plus' END AS id,COUNT(*) AS count FROM runs GROUP BY 1`).toArray().map(row=>[row.id,row.count]));
  const average=sql.exec('SELECT COALESCE(AVG(salary),0) AS n FROM runs').one().n;
  return {
   version:1,trackingSince:observations.since||null,recordedRuns:observations.n,unclassifiedRuns:Math.max(0,total-observations.n),
   career:{full8:career('full8'),legacy5:career('legacy5'),special:bins(['son','daughter'],special)},
   actualRoles:sql.exec('SELECT actual_role_id AS id,COUNT(*) AS count FROM runs GROUP BY actual_role_id ORDER BY count DESC,id').toArray(),
   reassignments:sql.exec('SELECT COUNT(*) AS n FROM runs WHERE role_id != actual_role_id').one().n,
   endingTypes:bins(['good','normal','bad','secret'],types),
   departureWays:departureWays(endingCounts),
   tenure:bins(['1-3','4-7','8-12','13-19','20-24'],tenure),
   salary:{average:Math.round(average*10)/10,bands:bins(['under30','30-49','50-79','80-119','120plus'],salaries)},
   experiences:{pip:observations.pip,promoted:observations.promoted,payCut:observations.payCut,collapse:observations.collapse,appointed:observations.appointed},
  };
 }
}
