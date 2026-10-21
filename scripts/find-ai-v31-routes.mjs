import {writeFileSync} from 'node:fs';
import {getEvent,applyChoice,advance,requestExit,replayRun,validRun} from '../dist/engine.js';
import {simulate,replayRoute} from '../tests/find-routes-v3.mjs';

const eventId='ai31-auto-increment',found=new Map();
const choose=(run,index)=>advance(applyChoice(run,index));
function finish(run,depth=12){
 if(run.completed)return run;if(depth<=0)return null;
 const leave=requestExit(run);if(leave!==run){const done=finish(leave,depth-1);if(done)return done;}
 const choices=getEvent(run).choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false)
  .map(({index})=>choose(run,index)).sort((a,b)=>{
   const score=state=>(state.completed?10000:0)+state.stats.mood*1.5+state.stats.energy+state.stats.cash*.3+state.stats.boss*.5;
   return score(b)-score(a);
  });
 for(const next of choices){const done=finish(next,depth-1);if(done)return done;}
 return null;
}
function inspect(run){
 if(run.pending||run.completed||run.eventId!==eventId||run.actualRoleId!=='ai')return;
 for(const [index,choice]of getEvent(run).choices.entries()){
  if(found.has(index)||choice.available===false)continue;
  const resolved=choose(run,index),done=finish(resolved);if(!done)continue;
  found.set(index,{id:`${eventId}-choice-${index}`,eventId,index,roleId:run.roleId,actualRoleId:run.actualRoleId,seed:run.seed,
   beforeActions:run.actions,actions:resolved.actions,completionActions:done.actions,endingId:done.endingId});
 }
}
const maxAttempts=Number(process.argv[2]||300);
for(let attempt=0;attempt<maxAttempts&&found.size<3;attempt++){
 const {route}=simulate('ai',['nasdaq','taiwan','acquired','slacker'][attempt%4],attempt,{seedPrefix:'e31'});replayRoute(route,inspect);
}
if(found.size!==3)throw new Error(`Missing natural AI responses: ${[0,1,2].filter(index=>!found.has(index)).join(', ')}`);
const routes=[...found.values()].sort((a,b)=>a.index-b.index);
for(const route of routes){
 const before=replayRun(route.roleId,route.seed,route.beforeActions),run=replayRun(route.roleId,route.seed,route.actions),done=replayRun(route.roleId,route.seed,route.completionActions);
 if(before.eventId!==eventId||before.actualRoleId!=='ai'||!validRun(run)||!validRun(done)||!done.completed||done.endingId!==route.endingId)throw new Error(`Invalid AI proof ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/ai-routes-v31.json',import.meta.url),JSON.stringify({
 method:'Three natural e31 AI-role responses, each reached from createRun and canonical choices, with complete continuations. No occupation, event, stat, flag, history, seed outcome or RNG state is injected.',eventId,routes
},null,2)+'\n');
console.log(JSON.stringify({events:1,choices:routes.length,routes:routes.length,missing:[]}));
