import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ROLES} from '../dist/roles.js';
import {createRandomRecruiterV60} from '../dist/random-recruitment-v60.js';
import {directEntryV60,entryLabelV60} from '../dist/recruitment-v60.js';
import {recruitmentSeedV60} from '../dist/seed-profile-v60.js';

// Each four-roll session uses the same recruiter instance as the browser.
// Every candidate is created and validated by the production engine; the
// category draw is never injected as a patronage, salary or game-state field.
const count=Math.max(5000,Number(process.argv[2])||5000),seedSet=new Set(),rows=[],errors=[];
let word=0x605019;const random=()=>{word^=word<<13;word^=word>>>17;word^=word<<5;return(word>>>0)/4294967296;};
const recruiter=createRandomRecruiterV60(random);
for(let session=0;session<count;session++){
 const sessionRows=[];
 for(let reroll=0;reroll<4;reroll++){
  const selection=recruiter.draw();
  const seed=recruitmentSeedV60(createHash('sha256').update(`recruitment-v60-${session}-${reroll}`).digest('hex'),selection.kind);
  if(seedSet.has(seed))throw Error('Probe seed collision');seedSet.add(seed);
  try{
   const direct=directEntryV60(seed),roleId=selection.roleId??direct?.roleId;
   const run=E.createRun(roleId,seed);
   if(!E.validRun(run))throw Error('Invalid candidate');
   if(JSON.stringify(E.replayRun(roleId,seed,[]))!==JSON.stringify(run))throw Error('Candidate replay mismatch');
   sessionRows.push({selectionKind:selection.kind,roleId:run.roleId,actualRoleId:run.actualRoleId,label:entryLabelV60(run),gender:run.characterGender,seed});
  }catch(error){errors.push({session,reroll,kind:selection.kind,seed,message:error.message});}
 }
 rows.push({session,rolls:sessionRows});
}
const all=rows.flatMap(row=>row.rolls),initial=rows.flatMap(row=>row.rolls.slice(0,1));
const categories=list=>Object.fromEntries(['normal','executive','godson','goddaughter'].map(kind=>[kind,list.filter(row=>row.selectionKind===kind).length]));
const roleCounts=list=>Object.fromEntries(ROLES.map(role=>[role.id,list.filter(row=>row.roleId===role.id).length]));
const normal=all.filter(row=>row.selectionKind==='normal'),bagFailures=[];
for(let start=0;start+12<=normal.length;start+=12)if(new Set(normal.slice(start,start+12).map(row=>row.roleId)).size!==12)bagFailures.push(start);
const report={method:'Deterministic xorshift tickets exercise the actual shared recruiter across 5000 fresh sessions and their three rerolls. Each of 20000 unique 32-character profiles goes through real createRun, candidate validRun and exact zero-action replay. No stats, appointments or outcomes are supplied. Ordinary bag continuity is measured across rerolls and new sessions.',sessions:count,candidates:all.length,distinctSeeds:seedSet.size,initial:categories(initial),all:categories(all),roleCounts:roleCounts(all),normalRoleCounts:roleCounts(normal),ordinaryAdjacentRepeats:normal.slice(1).filter((row,i)=>row.roleId===normal[i].roleId).length,bagFailures,errors};
mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});
writeFileSync(new URL('../artifacts/v60-random-recruitment-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(errors.length||bagFailures.length||report.ordinaryAdjacentRepeats)process.exitCode=1;
