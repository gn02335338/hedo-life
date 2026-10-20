import {writeFileSync} from 'node:fs';
import {createRun,getEvent,applyChoice,advance,requestBreak,canRequestBreak,requestExit,replayRun,validRun} from '../dist/engine.js';
import {MEAL_GUEST_IDS_V25} from '../dist/meals-v25.js';

const found=new Map();
const choose=(run,index)=>advance(applyChoice(run,index));
function complete(run,depth=8){
 if(run.completed)return run;
 if(depth<=0)return null;
 const exit=requestExit(run);
 if(exit!==run){for(const [index,c] of getEvent(exit).choices.entries())if(c.available!==false){const next=choose(exit,index);if(next.completed)return next;}}
 for(const [index,c] of getEvent(run).choices.entries())if(c.available!==false){const next=complete(choose(run,index),depth-1);if(next)return next;}
 return null;
}
function record(id,run,{finish=false}={}){
 if(found.has(id))return;
 if(!validRun(run)||run.pending)throw new Error(`Invalid witness ${id}/${run.eventId}`);
 const canonical=replayRun(run.roleId,run.seed,run.actions);
 if(JSON.stringify(canonical)!==JSON.stringify(run))throw new Error(`Replay differs ${id}`);
 const ended=finish?complete(run):null;
 if(finish&&!ended)throw new Error(`No completion for ${id}`);
 found.set(id,{id,roleId:run.roleId,seed:run.seed,actions:run.actions,
  expected:{eventId:run.eventId,turn:run.turn,mood:run.stats.mood,crashes:run.flags.mood_crash_count||0,mealContext:run.mealContext},
  ...(ended?{completionActions:ended.actions}:{})});
}
function pick(run,guest){
 let index=getEvent(run).choices.findIndex(c=>c.mealTarget===guest);
 if(index<0){run=choose(run,getEvent(run).choices.findIndex(c=>c.effect==='mealPage'));index=getEvent(run).choices.findIndex(c=>c.mealTarget===guest);}
 if(index<0)throw new Error(`Missing guest ${guest}`);
 return choose(run,index);
}
function inspect(run){
 if(run.eventId==='mood-collapse'){
  const stage=Math.min(4,run.flags.mood_crash_count);record(`collapse-${stage}`,run);
  const exploded=choose(run,3);record(`self-destruct-${stage}`,exploded);
  for(const index of [0,1,2])if(getEvent(exploded).choices[index].available!==false)record(`self-destruct-${stage}-reply-${index}`,choose(exploded,index),{finish:true});
 }
 if(run.eventId==='self-care'&&!found.has('meal-guests')){
  const menu=choose(run,getEvent(run).choices.findIndex(c=>c.effect==='mealOpen'));record('meal-guests',menu);
  for(const guest of MEAL_GUEST_IDS_V25){
   const table=pick(menu,guest);record(`meal-with-${guest}`,table);
   for(const index of [0,1])if(getEvent(table).choices[index].available!==false)record(`meal-${guest}-reply-${index}`,choose(table,index),{finish:true});
  }
 }
 if(run.eventId==='crisis-mood'&&!found.has('meal-crisis-guests')){
  const menu=choose(run,getEvent(run).choices.findIndex(c=>c.effect==='mealOpen'));record('meal-crisis-guests',menu);
  record('meal-crisis-reply',choose(pick(menu,'jack'),0),{finish:true});
 }
}
for(let attempt=0;attempt<600&&!found.has('collapse-4');attempt++){
 let run=createRun(['system','design','sales'][attempt%3],`e25-mood-${attempt.toString(36)}`);
 for(let step=0;step<140&&!run.completed;step++){
  inspect(run);
  if(!validRun(run))throw new Error(`Invalid search state ${run.seed}/${run.eventId}`);
  const event=getEvent(run);
  if(canRequestBreak(run)&&(!found.has('meal-guests')||run.stats.energy<23)){
   run=requestBreak(run);continue;
  }
  let index;
  if(event.id==='mood-collapse')index=1;
  else if(event.id==='self-care')index=run.stats.energy<35?1:7;
  else if(event.id==='kind-break'||event.id==='kind-workday')index=1;
  else if(event.id==='crisis-mood')index=2;
  else if(event.id==='onboarding')index=0;
  else{
   const options=event.choices.map((c,index)=>({c,index})).filter(x=>x.c.available!==false).map(({index})=>{
    const pending=applyChoice(run,index),next=advance(pending);
    const end=next.completed?-10000:0;
    const score=end+Math.min(next.stats.energy,60)*1.2-next.stats.mood*(attempt%4===0?1.8:1)+Math.min(next.stats.cash,65)*.2+Math.min(next.stats.boss,50)*.5;
    return {index,score};
   }).sort((a,b)=>b.score-a.score);
   index=options[0]?.index;
  }
  if(index===undefined)break;
  run=choose(run,index);
 }
}
const required=['collapse-1','collapse-2','collapse-3','collapse-4','meal-guests','meal-crisis-guests',...MEAL_GUEST_IDS_V25.flatMap(id=>[`meal-with-${id}`,`meal-${id}-reply-0`,`meal-${id}-reply-1`])];
const missing=required.filter(id=>!found.has(id));
if(missing.length)throw new Error(`Missing natural witnesses: ${missing.join(', ')}`);
writeFileSync(new URL('../tests/fixtures/mood-meals-routes-v25.json',import.meta.url),JSON.stringify({method:'Natural e25 game actions from createRun; no state, stats, pay, role, flags, mood counters, events or RNG are injected.',routes:[...found.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:found.size,stages:4,guests:MEAL_GUEST_IDS_V25.length,missing}));
