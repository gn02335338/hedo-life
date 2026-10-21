import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRun,getEvent,applyChoice,advance,canRequestBreak,requestBreak,getVerbalTargets,requestVerbal,replayRun,validRun} from '../dist/engine.js';
import {deriveAchievementsV32} from '../dist/achievements-v32.js';
import {simulate} from '../tests/find-routes-v3.mjs';

const record=(id,run)=>{
 if(!validRun(JSON.parse(JSON.stringify(run))))throw new Error(`Invalid achievement proof: ${id}`);
 const replayed=replayRun(run.roleId,run.seed,run.actions);
 if(JSON.stringify(replayed)!==JSON.stringify(run))throw new Error(`Achievement replay drift: ${id}`);
 return {id,roleId:run.roleId,seed:run.seed,actions:run.actions,expectedAchievements:deriveAchievementsV32(run)};
};
const score=run=>run.pendingFamily||run.completed?-100000:run.stats.mood*2+run.stats.energy*2+run.stats.cash*.35+run.stats.boss*.6+run.stats.trust*.4;
const choose=(run,index)=>advance(applyChoice(run,index));
function best(run){
 const event=getEvent(run),safe=event.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
 if(run.verbalContext){
  if(event.id==='verbal-v32-aftermath')return choose(run,3);
  if(event.id==='verbal-v2-warning')return choose(run,0);
  if(event.id==='verbal-v2-legal'||event.id==='verbal-v2-legal-result')return choose(run,0);
 }
 const preferred={onboarding:0,'kind-break':1,'kind-workday':1,'wealth-plan':3,'wealth-startup':2,'wealth-retire':3,'banquet-afterparty':0};
 if(preferred[event.id]!==undefined&&safe.some(({index})=>index===preferred[event.id]))return choose(run,preferred[event.id]);
 const options=safe.filter(({choice})=>!['mealOpen','mealPage','mealPick','wealthStartup','wealthRetire','wealthReturn','wealthBack','mealBack'].includes(choice.effect));
 const choices=(options.length?options:safe).map(({index})=>({index,score:score(applyChoice(run,index))})).sort((a,b)=>b.score-a.score);
 return choose(run,choices[0].index);
}
function prefixAt(roleId,seed,actions,test){
 let run=createRun(roleId,seed);
 for(const action of actions){
  if(test(run))return run;
  if(action.type==='choice')run=choose(run,action.index);
  else if(action.type==='break')run=requestBreak(run);
  else break;
 }
 return test(run)?run:null;
}
export function findAchievementMilestonesV32(){
 const found=new Map();
 const remember=(id,run)=>{if(!found.has(id)&&deriveAchievementsV32(run).includes(id))found.set(id,record(id,run));};
 const spoken=advance(requestVerbal(applyChoice(createRun('system','e32-badges-result-0'),0),undefined,2));
 remember('verbal-late-reply',spoken);
 for(let attempt=0;attempt<350&&(!found.has('verbal-pip-microphone')||!found.has('verbal-exit-team'));attempt++){
  for(const target of ['pip_fail','fired_signed']){
   const {route}=simulate('system',target,attempt,{seedPrefix:'e32'});
   const prefix=prefixAt(route.roleId,route.seed,route.actions,run=>!run.completed&&(target==='pip_fail'?getEvent(run)?.id==='pip-review':['crisis-boss','paperwork','dismissal-final'].includes(run.eventId)));
   if(!prefix)continue;
   const targets=getVerbalTargets(prefix);if(!targets.length)continue;
   const run=advance(requestVerbal(prefix,targets.length>1?'sonny':undefined,2));
   remember('verbal-pip-microphone',run);remember('verbal-exit-team',run);
  }
 }
 for(let attempt=0;attempt<350&&!found.has('verbal-many-ears');attempt++){
  let run=choose(createRun('system',`e32-badges-three-${attempt.toString(36)}`),0),targets=new Set();
  for(let step=0;step<120&&!run.completed&&!found.has('verbal-many-ears');step++){
   if(!run.verbalContext){
    const choices=getVerbalTargets(run),fresh=choices.find(id=>id!=='self'&&!targets.has(id));
    if(fresh){
     const next=advance(requestVerbal(run,choices.length>1?fresh:undefined,2));
     if(next!==run){run=next;targets.add(fresh);remember('verbal-many-ears',run);continue;}
    }
    if(canRequestBreak(run)&&(run.stats.mood<55||run.stats.energy<45)&&run.stats.cash>=8){run=requestBreak(run);continue;}
   }
   run=best(run);
  }
 }
 const missing=['verbal-late-reply','verbal-pip-microphone','verbal-exit-team','verbal-many-ears'].filter(id=>!found.has(id));
 if(missing.length)throw new Error(`Missing natural speech achievement proofs: ${missing.join(', ')}`);
 return {method:'Natural e32 seeds and canonical game actions only. Menus, speech and follow-up choices are replayed from createRun; no stats, targets, flags or RNG state are injected.',routes:[...found.values()]};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=findAchievementMilestonesV32();
 writeFileSync(new URL('../tests/fixtures/achievement-milestones-v32.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({routes:result.routes.length,achievements:[...new Set(result.routes.flatMap(route=>route.expectedAchievements))]}));
}
