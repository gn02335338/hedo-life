import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROLES } from '../dist/roles.js';
import { FAMILIES, ENDINGS } from '../dist/endings.js';
import { createRun, getEvent, applyChoice, advance, requestExit, requestBreak, canRequestBreak, validRun } from '../dist/engine.js';

export function replayRoute(route, verify = () => {}) {
  let run = createRun(route.roleId, route.seed);
  const checkpoint=()=>{run=JSON.parse(JSON.stringify(run));verify(run);};
  checkpoint();
  for (const action of route.actions) {
    if (action.type === 'exit') run = requestExit(run);
    else if (action.type === 'break') run = requestBreak(run);
    else {
      if (run.eventId !== action.eventId) throw new Error(`Replay drift: ${route.ending} ${run.eventId} != ${action.eventId}`);
      run = applyChoice(run, action.index);
      checkpoint();
      run = advance(run);
    }
    checkpoint();
  }
  return run;
}

const safe = (value, minimum) => value < minimum ? (value-minimum)*8 : 0;
function utility(run,target) {
  const s=run.stats, f=run.flags;
  let value=safe(s.energy,18)+safe(s.cash,18)+safe(s.mood,20);
  if (target!=='burnout') value+=Math.min(s.energy,65)*.4;
  if (target!=='broke') value+=Math.min(s.cash,55)*.4;
  const combat=['fired_signed','fired_refused','layoff','pip_fail','pip_exit'].includes(target)&&!run.pip&&!f.pip_passed;
  if(combat) value+=(100-s.boss)*2.8;
  else value+=safe(s.boss,28)+Math.min(s.boss,75)*.2;
  if(target==='pip_exit') value+=Math.min(s.skill,70)*2+Math.min(f.evidence||0,2)*18;
  if(target==='burnout') value=-s.energy*4+safe(s.cash,12)+safe(s.mood,15)+safe(s.boss,20);
  if(target==='broke') value=-s.cash*4-s.mood*.7-run.pay*Math.max(0,24-run.turn)/10+safe(s.energy,18)+safe(s.boss,20);
  if(target==='promotion') value+=Math.min(s.skill,65)*2+Math.min(s.boss,50)*2+(f.promotions||0)*200;
  if(target==='slacker') value+=Math.min(s.slack,65)*4;
  if(target==='sycophant') value+=Math.min(s.lick,75)*3+Math.min(s.boss,68)*3;
  if(target==='assistant'&&run.roleId==='executive')value+=Math.max(0,65-s.boss)*2+safe(s.boss,16);
  if(target==='historian') value+=Math.min(f.archive||0,4)*45;
  if(['nasdaq','taiwan','acquired'].includes(target)) {
    value+=safe(s.energy,26)+safe(s.cash,38)+safe(s.trust,60)+safe(s.skill,target==='acquired'?76:70)+safe(s.dream,target==='nasdaq'?76:target==='taiwan'?50:0);
    value+=Math.min(s.energy,70)+Math.min(s.cash,65)+Math.min(s.trust,80)+Math.min(s.skill,85)+(target!=='acquired'?Math.min(s.dream,90):0);
  }
  return value;
}

export function simulate(roleId,target,attempt) {
  const seed=`e7-${roleId}-${target}-${attempt}`;
  let run=createRun(roleId,seed),actions=[];
  let chooserState=(attempt+1)*17713+target.length*39977;
  const noise=()=>{chooserState^=chooserState<<13;chooserState^=chooserState>>>17;chooserState^=chooserState<<5;return (chooserState>>>0)/4294967296;};
  const choose=index=>{actions.push({type:'choice',eventId:run.eventId,index});run=advance(applyChoice(run,index));};
  const leave=()=>{actions.push({type:'exit'});run=requestExit(run);};
  const careerTarget=()=>target==='assistant'?(run.assignment==='assistant'||(run.roleId==='executive'&&run.turn>=4&&run.stats.boss<45)):target==='promotion'?run.rank>=1:target==='slacker'?run.stats.slack>=65:target==='sycophant'?run.stats.lick>=75&&run.stats.boss>=65:target==='historian'?(run.flags.archive||0)>=4:false;
  for(let step=0;step<100&&!run.completed;step++) {
    if(canRequestBreak(run)&&run.stats.mood<30&&run.stats.cash>35&&!['broke','burnout'].includes(target)){
      const menu=requestBreak(run),options=getEvent(menu).choices.map((c,i)=>({c,i})).filter(({c})=>c.available!==false&&c.effect==='finishBreak');
      const best=options.map(({i})=>({i,score:utility(applyChoice(menu,i),target)})).sort((a,b)=>b.score-a.score)[0];
      if(best&&best.score>utility(run,target)){actions.push({type:'break'});run=menu;choose(best.i);continue;}
    }
    const ev=getEvent(run);
    if(target==='ragequit'&&run.eventId==='onboarding'){choose(2);continue;}
    if(run.eventId==='kind-workday'){
      const options=ev.choices.map((c,i)=>({c,i})).filter(({c})=>c.available!==false);
      const best=options.map(({i})=>{const preview=applyChoice(run,i);return{i,score:utility(preview,target)+(preview.pendingFamily?(preview.pendingFamily===target?10000:-10000):0)};}).sort((a,b)=>b.score-a.score)[0];
      choose(best.i);continue;
    }
    if(careerTarget()&&!['exit-menu','career-exit'].includes(run.eventId)){leave();continue;}
    if(run.eventId==='exit-menu'){choose(1);continue;}
    if(run.eventId==='career-exit'){
      const idx=ev.choices.findIndex(c=>c.effect===target&&c.available!==false);
      choose(idx>=0?idx:ev.choices.findIndex(c=>c.effect==='ragequit'||c.effect==='pip_exit'));continue;
    }
    if(run.eventId==='crisis-boss'){
      if(target==='fired_signed'){choose(0);continue;}
      if(['fired_refused','layoff','pip_fail','pip_exit'].includes(target)){choose(1);continue;}
      choose(1);continue;
    }
    if(run.eventId==='paperwork'){
      choose(target==='fired_refused'?0:target==='layoff'?1:2);continue;
    }
    if(run.eventId==='pip-review'){
      if(target==='pip_fail'){choose(2);continue;}
      const pass=ev.choices.findIndex((c,i)=>applyChoice(run,i).pendingEffect==='pipPassed');
      choose(pass>=0?pass:2);continue;
    }
    if(run.eventId==='pip-passed') {choose(target==='pip_exit'?0:1);continue;}
    if(run.eventId==='crisis-mood'){
      choose(ev.choices[1].available!==false&&(target==='broke'||run.stats.energy<25&&run.stats.cash>20)?1:2);continue;
    }
    if(run.eventId==='final-shortfall'){choose(0);continue;}
    if(run.eventId==='salary-cut'){choose(target==='broke'?0:applyChoice(run,2).pendingEffect==='salaryRescind'?2:0);continue;}
    if(run.eventId==='salary-final'){choose(0);continue;}
    if(run.eventId==='promotion-review'){
      if(target==='broke'){const rejected=ev.choices.findIndex((c,i)=>c.check&&applyChoice(run,i).pendingEffect!=='promote');choose(rejected>=0?rejected:2);continue;}
      const pass=ev.choices.findIndex((c,i)=>applyChoice(run,i).pendingEffect==='promote');
      choose(pass>=0&&target!=='assistant'?pass:2);continue;
    }
    const eligible=ev.choices.map((c,i)=>({c,i})).filter(({c})=>c.available!==false&&c.effect!=='ragequit'&&c.effect!=='careerExit');
    let best=null;
    for(const {c,i} of eligible){
      const preview=applyChoice(run,i);
      let score=utility(preview,target);
      if(preview.pendingFamily) score+=preview.pendingFamily===target?10000:-10000;
      const finalGoal={nasdaq:'final_global',taiwan:'final_taiwan',acquired:'final_acquire'}[target];
      if(finalGoal&&c.flags?.includes(finalGoal))score+=1000;
      if(c.flags?.some(x=>['final_global','final_taiwan','final_acquire'].includes(x))&&!c.flags.includes(finalGoal))score-=1000;
      const randomness=attempt<8?attempt*2:5+(attempt%15)*2;
      score+=(noise()-.5)*randomness;
      if(!best||score>best.score)best={index:i,score};
    }
    if(!best)break;
    choose(best.index);
  }
  return {run,route:{roleId,seed,target,actions,ending:run.endingId,turns:run.turn,stats:run.stats,flags:run.flags,assignment:run.assignment,rank:run.rank}};
}

export function findRoutes({maxAttempts=3000,onProgress=()=>{}}={}) {
  const found=new Map();const attempts=[];
  for(const role of ROLES) for(const family of FAMILIES){
    const desired=`${family.id}-${role.id}`;
    if(found.has(desired))continue;
    let attempt=0;
    for(;attempt<maxAttempts&&!found.has(desired);attempt++){
      const {run,route}=simulate(role.id,family.id,attempt);
      if(run.completed&&!found.has(run.endingId)){
        const replay=replayRoute(route,state=>{if(!validRun(state))throw new Error(`Invalid state in ${run.endingId} ${state.eventId}`);});
        if(replay.endingId!==run.endingId)throw new Error('Witness failed replay');
        found.set(run.endingId,route);
      }
    }
    attempts.push({roleId:role.id,family:family.id,attempts:attempt,found:found.has(desired)});
    onProgress({roleId:role.id,family:family.id,attempts:attempt,found:found.has(desired),total:found.size});
  }
  const hash=name=>createHash('sha256').update(readFileSync(new URL(`../dist/${name}.js`,import.meta.url))).digest('hex');
  return {
    method:'Target-guided deterministic route search; every witness begins at createRun(roleId, seed), uses only applyChoice/advance/requestExit/requestBreak, and is replayed with JSON-compatible save validation. No stats, roles, flags, events, rank or RNG state are injected.',
    choiceIndexBase:0,complete:found.size===ENDINGS.length,expected:ENDINGS.length,found:found.size,
    sourceSha256:Object.fromEntries(['engine','roles','education','events','events-images','image-scenes-wing','events-video','copy-edits','engine-copy','kind-break','endings'].map(x=>[x,hash(x)])),
    missing:ENDINGS.filter(e=>!found.has(e.id)).map(e=>e.id),attempts,
    routes:ENDINGS.filter(e=>found.has(e.id)).map(e=>found.get(e.id))
  };
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=findRoutes({maxAttempts:Number(process.argv[2])||3000,onProgress:p=>{if(!p.found||p.family==='historian')console.log(JSON.stringify(p));}});
  writeFileSync(new URL('../research/reachability-v3.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({complete:report.complete,found:report.found,expected:report.expected,missing:report.missing}));
  if(!report.complete)process.exitCode=1;
}
