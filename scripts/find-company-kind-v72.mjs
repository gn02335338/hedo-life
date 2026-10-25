import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import * as E from '../dist/engine.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {characterAffinity} from '../dist/character-stats.js';
import {companyEvidenceV72} from '../dist/company-paths-v72.js';
import {simulateCurrentV66,stepCurrentV66,advanceCurrentV66} from './find-current-endings-v66.mjs';
import {isLifeSystemsV72} from '../dist/life-systems-v72.js';

const max=Number(process.argv[2]||200),output=process.argv[3]||'artifacts/company-kind-v72.json';
const found=new Map(),eligible=[],counters={samples:0,company:0,darkEligible:0,highKind:0};
for(let attempt=0;attempt<max&&found.size<2;attempt++){
 const marker=attempt%2?'d':'s',seed=`e39-r72-${marker}-`+createHash('sha256').update(`company72-kind-friends:${attempt}`).digest('hex').slice(0,22),role=directEntryV60(seed).roleId;
 let peak=50;
 const profile={id:`e39-r72-${marker}`,strategyVersion:1,method:'Public-action friendship-directed company route search',seedFactory:()=>seed,isEnabled:isLifeSystemsV72,testSeed:isLifeSystemsV72,
  beforeStep(run,target,options){
   const event=E.getEvent(run);peak=Math.max(peak,characterAffinity(run,'kind').score);
   const choose=index=>advanceCurrentV66(E.applyChoice(run,index)),pick=predicate=>event.choices.findIndex(choice=>choice.available!==false&&predicate(choice));
   if(event.id==='finale')return choose(0);
   if(run.companyContext)return choose(event.choices[0].available===false?1:0);
   if(E.isWorkGapOpenV50(run)&&E.canRequestBreak(run)&&characterAffinity(run,'kind').score<78&&run.stats.cash>=16)return E.requestBreak(run);
   if(['kind-break','kind-workday'].includes(event.id))return choose(event.choices[0].available!==false&&!run.flags.kind_relaxed?0:2);
   if(event.id==='self-care'){
    const invited=run.flags[`meal_invite_kind_day_${run.turn}`];
    if(!invited&&run.stats.energy>=16&&run.stats.cash>=16&&characterAffinity(run,'kind').score<78){const index=pick(choice=>choice.effect==='mealOpen');if(index>=0)return choose(index);}
   }
   if(event.id.startsWith('meal-guests-')){
    const invited=run.flags[`meal_invite_kind_day_${run.turn}`],kind=pick(choice=>choice.mealTarget==='kind');
    if(!invited&&kind>=0)return choose(kind);
    const page=pick(choice=>choice.effect==='mealPage'&&choice.mealPage===0);if(!invited&&page>=0)return choose(page);
    const cancel=pick(choice=>choice.effect==='mealCancel');if(cancel>=0)return choose(cancel);
   }
   if(event.id==='meal-with-kind')return choose(0);
   if(event.speaker==='kind'&&event.kind==='daily')return choose(0);
   return stepCurrentV66(run,target,options);
  }};
 const run=simulateCurrentV66(role,'nasdaq',attempt,{profile}).run,replay=E.replayRun(role,seed,run.actions);
 if(!E.validRun(run)||JSON.stringify(run)!==JSON.stringify(replay))throw Error('Noncanonical friend route');
 counters.samples++;if(peak>=68)counters.highKind++;
 if(run.companyDossierV72){
  counters.company++;const evidence=companyEvidenceV72(run);if(evidence.vietnamDarkEligible)counters.darkEligible++;
  const row={roleId:role,seed,peakKind:peak,kindAffinity:evidence.affinity.kind,evidence,ending:run.endingId,path:run.companyDossierV72.path,actions:run.actions};
  if(evidence.vietnamDarkEligible&&eligible.length<4)eligible.push(row);
  if(['vietnam_core','vietnam_afterdark'].includes(row.path)&&row.ending?.startsWith(row.path+'-')&&!found.has(row.path))found.set(row.path,row);
 }
 if(attempt%20===19)console.log(JSON.stringify({attempt:attempt+1,...counters,found:[...found.keys()]}));
}
const report={method:'Fresh family entries use only public onboarding, work, warning-gap rests, paid meals, real invitation responses and final company choices. The directed search attempts to befriend Kind and accepts the received company destination; it does not edit game state, RNG, affinity or company selection.',...counters,found:[...found.values()],eligible};
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...counters,found:[...found.keys()]}));
if(found.size<2)process.exitCode=1;
