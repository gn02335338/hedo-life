import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
import * as E from '../dist/engine.js';
import {simulateCurrentV66,stepCurrentV66,advanceCurrentV66} from './find-current-endings-v66.mjs';
import {isLifeSystemsV72} from '../dist/life-systems-v72.js';

export const companySeedV72=(role,attempt)=>'e39-r72-n-'+createHash('sha256').update(`company72:${role}:${attempt}`).digest('hex').slice(0,22);
export const COMPANY_SEARCH_PROFILE_V72={id:'e39-r72-n',strategyVersion:1,method:'Legal target-guided preparation; company path is chosen by committed history and the canonical seeded draw, not a destination action.',seedFactory:(role,target,attempt)=>companySeedV72(role,attempt),isEnabled:isLifeSystemsV72,testSeed:isLifeSystemsV72,
 beforeStep(run,target,options){
  if(run.eventId==='finale')return advanceCurrentV66(E.applyChoice(run,0));
  if(run.companyContext)return advanceCurrentV66(E.applyChoice(run,run.stats.energy>3&&run.stats.cash>3?0:1));
  return stepCurrentV66(run,target,options);
 }};

export function companySampleV72(role,attempt){
 const run=simulateCurrentV66(role,'nasdaq',attempt,{profile:COMPANY_SEARCH_PROFILE_V72}).run;
 const replay=E.replayRun(run.roleId,run.seed,run.actions);
 if(!run.completed||!E.validRun(run)||JSON.stringify(replay)!==JSON.stringify(run))throw Error(`Invalid natural company sample ${run.seed}`);
 return run;
}

export function auditCompanyPathsV72(samples=10){
 const roles=['system','ai','mis','sales','bd','design','project','product','finance','accounting','hr','admin','executive'],lives=[];
 for(const role of roles)for(let attempt=0;attempt<samples;attempt++){
  const run=companySampleV72(role,attempt),d=run.companyDossierV72;
  lives.push({role,seed:run.seed,ending:run.endingId,path:d?.path||null,reasons:d?.reasons||[],turn:run.turn,actions:run.actions});
 }
 const reached=lives.filter(row=>row.path),paths=Object.fromEntries([...new Set(reached.map(row=>row.path))].map(id=>[id,reached.filter(row=>row.path===id).length]));
 return {method:'Natural starts and legal public actions only. A target-guided preparation policy favours survival and evidence and takes the offered company proposal; it never selects a destination, edits state or RNG, or retries a proposal. This is a strategy sample, not population probability or proof that all current endings are reached.',total:lives.length,canonical:lives.length,companyLives:reached.length,paths,lives};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const report=auditCompanyPathsV72(Number(process.argv[2]||10)),output=process.argv[3]||'artifacts/company-paths-v72.json';
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({total:report.total,canonical:report.canonical,companyLives:report.companyLives,paths:report.paths,output}));
}
