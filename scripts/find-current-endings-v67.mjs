import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isPatronageBenefitsV67} from '../dist/patronage-benefits-v67.js';
import {simulateCurrentV66,findCurrentEndingsV66,currentEndingFixtureV66,currentSourceSha256V66,stepCurrentV66,advanceCurrentV66} from './find-current-endings-v66.mjs';
import * as E from '../dist/engine.js';
import {COMPANY_ENDING_IDS_V39} from '../dist/company-v39.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';

export const CURRENT_ENDING_SEARCH_VERSION_V67=2;
export const CURRENT_ENDING_METHOD_V67='Current r67 starts with the app activity calendar and automatic catch-up hooks. Public actions only, no state or RNG injection; each completed life passes canonical replay and save validation. Ordinary starts remain ordinary unless the player earns and accepts a special appointment. 目標導向合法操作，不代表一般玩家隨機就能碰齊。';
export const currentSeedV67=(role,target,attempt)=>'e39-r67-n-'+createHash('sha256').update(`current67:${role}:${target}:${attempt}`).digest('hex').slice(0,22);
export function stepCurrentV67(run,target,options={}){
 const handled=stepCurrentV66(run,target,options);if(handled)return handled;
 const event=E.getEvent(run);
 if(event?.kind!=='company'||!COMPANY_ENDING_IDS_V39.includes(target)&&!COMPANY_ENDING_IDS_V32.includes(target)&&target!=='acquired')return null;
 const available=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
 if(!available.length)throw new Error(`No available public company response: ${event.id}`);
 const exact=available.find(({index})=>E.applyChoice(run,index).pendingFamily===target),draws=available.filter(({choice})=>choice.draw);
 const selected=exact||(draws.length?draws[(options.attempt||0)%draws.length]:available.at(-1));
 return advanceCurrentV66(E.applyChoice(run,selected.index));
}
const PROFILE_V67=Object.freeze({id:'e39-r67-n',strategyVersion:CURRENT_ENDING_SEARCH_VERSION_V67,method:CURRENT_ENDING_METHOD_V67,seedFactory:currentSeedV67,isEnabled:isPatronageBenefitsV67,testSeed:seed=>/^e39-r67-n-[0-9a-f]{22}$/.test(seed||''),beforeStep:stepCurrentV67});
export const currentSourceSha256V67=currentSourceSha256V66;
export const simulateCurrentV67=(role,target,attempt)=>simulateCurrentV66(role,target,attempt,{profile:PROFILE_V67});
export const findCurrentEndingsV67=(options={})=>findCurrentEndingsV66({...options,profile:PROFILE_V67});
export const currentEndingFixtureV67=report=>{
 if(report?.profile!==PROFILE_V67.id||report?.strategyVersion!==CURRENT_ENDING_SEARCH_VERSION_V67)throw new Error('Invalid r67 proof profile or strategy');
 return currentEndingFixtureV66(report,{profile:PROFILE_V67});
};

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=name=>{const prefix=`--${name}=`;return process.argv.find(value=>value.startsWith(prefix))?.slice(prefix.length);};
 const output=arg('output')||'artifacts/current-endings-v67.json',resume=arg('resume'),fixture=arg('fixture'),attempts=arg('attempts');
 mkdirSync(dirname(output),{recursive:true});
 const checkpoint=report=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const report=findCurrentEndingsV67({onCheckpoint:checkpoint,discardDriftedResume:process.argv.includes('--discard-drifted-resume'),maxAttempts:attempts===undefined?100:Number(attempts),...(arg('roles')?{roles:arg('roles').split(',')}:{}),...(arg('families')?{families:arg('families').split(',')}:{}),...(resume?{resume:JSON.parse(readFileSync(resume,'utf8'))}:{})});
 checkpoint(report);console.log(JSON.stringify({complete:report.complete,expected:report.expected,found:report.found,missing:report.missing}));
 if(report.complete&&fixture){mkdirSync(dirname(fixture),{recursive:true});writeFileSync(fixture,JSON.stringify(currentEndingFixtureV67(report),null,2)+'\n');}
 if(!report.complete)process.exitCode=1;
}
