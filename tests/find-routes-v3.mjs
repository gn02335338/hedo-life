import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ROLES } from '../dist/roles.js';
import { FAMILIES, ENDINGS } from '../dist/endings.js';
import { careerEndingAvailable, careerReadiness } from '../dist/career-api.js';
import { CAREER_FAMILIES_V17 } from '../dist/career-v17.js';
import { eligibleStoryEndings } from '../dist/story-career.js';
import { wealthEligibilityV27 } from '../dist/wealth-exit-v27.js';

import { createRun, getEvent, applyChoice, advance, requestExit, requestBreak, canRequestBreak, canRequestCareer, requestCareer, requestRaise, canRequestRaise, requestRage, canRequestRage, getRageTargets, validRun } from '../dist/engine.js';

const WEALTH_GOALS=new Set(['venture_independent','venture_restart','retired_free','retired_flexible']);

export function replayRoute(route, verify = () => {}) {
  let run = createRun(route.roleId, route.seed);
  const checkpoint=()=>{run=JSON.parse(JSON.stringify(run));verify(run);};
  checkpoint();
  for (let position=0;position<route.actions.length;position++) {
    const action=route.actions[position];
    if (action.type === 'exit') run = requestExit(run);
    else if (action.type === 'break') run = requestBreak(run);
    else if (action.type === 'career') run = requestCareer(run);
    else if (action.type === 'raise') run = requestRaise(run);
    else if (action.type === 'rage') {
      run=Object.hasOwn(action,'target')?requestRage(run,action.target):requestRage(run);checkpoint();
      if(/^e(?:14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29)-/.test(route.seed))run=advance(run);
    }
    else {
      if (run.eventId !== action.eventId) throw new Error(`Replay drift: ${route.ending} ${run.eventId} != ${action.eventId}`);
      run = applyChoice(run, action.index);
      checkpoint();
      if(!(/^e(?:14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29)-/.test(route.seed)&&route.actions[position+1]?.type==='rage'&&route.actions[position+1].phase==='result'))run = advance(run);
    }
    checkpoint();
  }
  return run;
}

const safe = (value, minimum) => value < minimum ? (value-minimum)*8 : 0;
const evChoiceIndex=(event,effect)=>event.choices.findIndex(choice=>choice.effect===effect&&choice.available!==false);
function utility(run,target) {
  const s=run.stats, f=run.flags;
  let value=safe(s.energy,30)+safe(s.cash,12)+safe(s.mood,35);
  if (target!=='burnout') value+=Math.min(s.energy,65)*.5;
  if (target!=='broke') value+=Math.min(s.cash,55)*.35;
  value+=Math.min(s.mood,60)*.65;
  const personnelTarget=['cold_storage','mediation_settled','mediation_pending'].includes(target);
  const combat=['fired_signed','fired_refused','layoff','pip_fail','pip_exit'].includes(target)&&!run.pip&&!f.pip_passed
    ||personnelTarget&&!f.floor_watch&&!run.pip?.active;
  if(combat) value+=(100-s.boss)*2.8;
  else value+=safe(s.boss,28)+Math.min(s.boss,75)*.2;
  if(target==='pip_exit') value+=Math.min(s.skill,70)*2+Math.min(f.evidence||0,2)*18;
  if(target==='cold_storage')value+=Math.min(s.skill,72)*1.7+Math.min(f.evidence||0,3)*20+(f.pip_passed||0)*160+(f.floor_watch||0)*500+Math.min(f.floor_watch_days||0,3)*70;
  if(['mediation_settled','mediation_pending'].includes(target))value+=Math.min(s.skill,70)*1.4+Math.min(f.evidence||0,4)*25+(f.floor_watch||0)*100;
  if(target==='burnout') value=-s.energy*4+safe(s.cash,12)+safe(s.mood,28)+safe(s.boss,20);
  if(target==='broke') value=-s.cash*4-s.mood*.7-run.pay*Math.max(0,24-run.turn)/10+safe(s.energy,18)+safe(s.boss,20);
  if(target==='promotion') value+=Math.min(s.skill,65)*2+Math.min(s.boss,50)*2+(f.promotions||0)*200;
  if(target==='slacker') value+=Math.min(s.slack,65)*4;
  if(target==='sycophant') value+=Math.min(s.lick,75)*3+Math.min(s.boss,68)*3;
  if(target==='assistant'&&run.roleId==='executive')value+=Math.max(0,65-s.boss)*2+safe(s.boss,16);
  if(target==='historian') value+=Math.min(f.archive||0,4)*45;
  const careerRank=CAREER_FAMILIES_V17.indexOf(target);
  if(careerRank>=0||target==='consultant'){
    const rank=careerRank>=0?careerRank:5;
    value+=Math.min(run.rank,rank)*180+Math.min(s.skill,90)*1.8+Math.min(s.trust,75)*1.2+Math.min(s.boss,82)*1.6+safe(s.boss,42);
    if(run.assignment==='assistant')value+=rank===0?200:-200;
    if(run.rank===rank&&careerEndingAvailable(run))value+=150;
  }
  if(target==='second_offer')value+=Math.min(f.offer_checked||0,2)*100+Math.min(f.alumni_links||0,2)*95+Math.min(s.skill,60);
  if(target==='handover_author')value+=Math.min(f.handover_notes||0,3)*100+Math.min(f.archive||0,2)*95;
  if(target==='alumni_network')value+=Math.min(f.alumni_links||0,3)*120+Math.min(s.trust,70)*2;
  if(target==='consultant')value+=Math.min(f.consultant_offer||0,1)*180;
  if(target==='merged_out')value+=Math.min(f.merge_notice||0,1)*220;
  if(WEALTH_GOALS.has(target)){
    const threshold=target.startsWith('venture_')?75:90;
    value+=safe(s.cash,threshold)+Math.min(s.cash,threshold)*3+Math.min(s.energy,65)*.6+Math.min(s.mood,60)*.7+Math.min(s.boss,55)*.6;
  }
  if(['nasdaq','taiwan','acquired'].includes(target)) {
    value+=safe(s.energy,26)+safe(s.cash,38)+safe(s.trust,60)+safe(s.skill,target==='acquired'?76:70)+safe(s.dream,target==='nasdaq'?76:target==='taiwan'?50:0);
    value+=Math.min(s.energy,70)+Math.min(s.cash,65)+Math.min(s.trust,80)+Math.min(s.skill,85)+(target!=='acquired'?Math.min(s.dream,90):0);
  }
  return value;
}

function simulateRage(roleId,target,attempt,seedPrefix='e29') {
  const seed=`${seedPrefix}-${roleId}-r${FAMILIES.findIndex(f=>f.id===target).toString(36)}-${attempt.toString(36)}`;
  let start=advance(requestRage(createRun(roleId,seed)));
  let fallback=start;
  function search(run,depth){
    if(run.completed){fallback=run;return run.endingId===`${target}-${roleId}`?run:null;}
    if(depth<=0||!run.eventId.startsWith('rage-'))return null;
    const event=getEvent(run);
    for(let index=0;index<event.choices.length;index++)if(event.choices[index].available!==false){
      const found=search(advance(applyChoice(run,index)),depth-1);if(found)return found;
    }
    return null;
  }
  const run=search(start,4)||fallback;
  return {run,route:{roleId,seed,target,actions:run.actions,ending:run.endingId,turns:run.turn,stats:run.stats,flags:run.flags,assignment:run.assignment,rank:run.rank}};
}

export function simulate(roleId,target,attempt,{raise=false,seedPrefix='e29'}={}) {
  if(target.startsWith('rage_'))return simulateRage(roleId,target,attempt,seedPrefix);
  const seed=`${seedPrefix}-${roleId}-${FAMILIES.findIndex(f=>f.id===target).toString(36)}-${attempt.toString(36)}`;
  let run=createRun(roleId,seed),actions=[],openedRaise=false;
  let chooserState=(attempt+1)*17713+target.length*39977;
  const noise=()=>{chooserState^=chooserState<<13;chooserState^=chooserState>>>17;chooserState^=chooserState<<5;return (chooserState>>>0)/4294967296;};
  const choose=index=>{actions.push({type:'choice',eventId:run.eventId,index});run=advance(applyChoice(run,index));};
  const leave=()=>{actions.push({type:'exit'});run=requestExit(run);};
  const targetRank=CAREER_FAMILIES_V17.indexOf(target);
  const desiredRank=()=>targetRank>=0?targetRank:target==='consultant'?5:target==='promotion'?Math.max(1,run.rank+((run.flags.promotions||0)>0?0:1)):0;
  const careerTarget=()=>targetRank>=0?((run.rank===targetRank&&careerEndingAvailable(run))||(run.rank>targetRank&&run.rank>=4&&!run.resumeEventId)):eligibleStoryEndings(run).includes(target)?true:target==='assistant'?(run.assignment==='assistant'||(run.roleId==='executive'&&run.turn>=4&&run.stats.boss<45)):target==='promotion'?run.rank>=1&&(run.flags.promotions||0)>0:target==='slacker'?run.stats.slack>=65:target==='sycophant'?run.stats.lick>=75&&run.stats.boss>=65:target==='historian'?(run.flags.archive||0)>=4:false;
  const effectIndex=effect=>evChoiceIndex(getEvent(run),effect);
  for(let step=0;step<150&&!run.completed;step++) {
    if(raise&&!openedRaise&&canRequestRaise(run)){actions.push({type:'raise'});run=requestRaise(run);openedRaise=true;continue;}
    if(canRequestBreak(run)&&(run.stats.mood<45||run.stats.energy<35)&&run.stats.cash>=8&&!['broke','burnout'].includes(target)){
      const menu=requestBreak(run),plans=[];
      const inspect=(candidate,prefix=[])=>{
        for(const [index,choice]of getEvent(candidate).choices.entries()){
          if(choice.available===false)continue;
          if(choice.effect==='finishBreak')plans.push({indices:[...prefix,index],score:utility(applyChoice(candidate,index),target)});
          // An unaffordable or unwanted surprise invitation must not prevent
          // the finder from using the ordinary self-care choices behind it.
          if(choice.effect==='kindDecline'&&prefix.length===0){
            const declined=advance(applyChoice(candidate,index));
            if(declined.eventId==='self-care')inspect(declined,[index]);
          }
        }
      };
      inspect(menu);
      const best=plans.sort((a,b)=>b.score-a.score)[0];
      if(best&&best.score>utility(run,target)){actions.push({type:'break'});run=menu;for(const index of best.indices)choose(index);continue;}
    }
    if(canRequestCareer(run)&&target!=='assistant'&&targetRank!==0&&(run.rank<desiredRank()||(run.assignment==='assistant'&&desiredRank()>0))){
      const menu=requestCareer(run),review=getEvent(menu);
      // Read eligibility from the real review rather than maintaining another
      // set of rank-specific merit / politics thresholds in this finder.
      const canApply=review.choices.some(choice=>choice.check&&choice.available!==false);
      const training=evChoiceIndex(review,'careerTrain');
      const usefulTraining=training>=0&&utility(applyChoice(menu,training),target)>utility(run,target);
      if(careerReadiness(run).ready||canApply||usefulTraining){actions.push({type:'career'});run=menu;continue;}
    }
    const ev=getEvent(run);
    if(ev.id==='patronage-application'){choose(2);continue;} // Ordinary ending witnesses keep the professional career path.
    if(raise&&run.eventId.startsWith('raise-')){
      const options=ev.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false&&choice.effect!=='raiseCancel')
        .map(({index})=>({index,preview:applyChoice(run,index)})).sort((a,b)=>a.preview.stats.boss-b.preview.stats.boss);
      choose(options[0].index);continue;
    }
    if(target==='ragequit'&&run.eventId==='onboarding'){choose(2);continue;}
    if(run.eventId==='kind-workday'){
      const options=ev.choices.map((c,i)=>({c,i})).filter(({c})=>c.available!==false);
      const best=options.map(({i})=>{const preview=applyChoice(run,i);return{i,score:utility(preview,target)+(preview.pendingFamily?(preview.pendingFamily===target?10000:-10000):0)};}).sort((a,b)=>b.score-a.score)[0];
      choose(best.i);continue;
    }
    if(run.eventId==='dismissal-final'){
      choose(['mediation_settled','mediation_pending'].includes(target)?1:0);continue;
    }
    if(run.eventId==='labor-claim'){choose(0);continue;}
    if(run.eventId==='labor-mediation'){
      const options=ev.choices.map((choice,index)=>({choice,index})).filter(({choice})=>choice.available!==false);
      const exact=options.find(({index})=>applyChoice(run,index).pendingFamily===target);
      choose(exact?.index??0);continue;
    }
    if(run.eventId==='floor-notice'){
      choose(['mediation_settled','mediation_pending'].includes(target)?3:run.stats.mood<35?2:0);continue;
    }
    if(run.eventId==='watch-review'){
      choose(['mediation_settled','mediation_pending'].includes(target)?1:0);continue;
    }
    if(run.eventId==='watch-future'){
      choose(target==='cold_storage'?0:['mediation_settled','mediation_pending'].includes(target)?3:1);continue;
    }
    if(run.eventId==='wealth-plan'){
      const effect=target.startsWith('venture_')?'wealthStart':target.startsWith('retired_')?'wealthRetire':'wealthReturn',index=effectIndex(effect);
      choose(index>=0?index:effectIndex('wealthReturn'));continue;
    }
    if(['wealth-startup','wealth-retire'].includes(run.eventId)){
      const direct=ev.choices.findIndex((choice,index)=>choice.available!==false&&applyChoice(run,index).pendingFamily===target);
      if(direct>=0){choose(direct);continue;}
      const back=effectIndex('wealthBack');
      if(back>=0){choose(back);continue;}
    }
    const wealthGoal=WEALTH_GOALS.has(target);
    if(wealthGoal&&['exit-menu','rank-exit','career-exit'].includes(run.eventId)){
      const entry=effectIndex('wealthPlan');if(entry>=0){choose(entry);continue;}
    }
    const wealthReady=wealthGoal?wealthEligibilityV27(run):null;
    if(wealthReady&&(target.startsWith('venture_')?wealthReady.startup:wealthReady.retirement)&&['daily','fantasy'].includes(ev.kind)){leave();continue;}
    if(run.eventId==='rank-exit'){
      const direct=effectIndex(target);
      if(direct>=0){choose(direct);continue;}
      if(targetRank>=0){
        const down=effectIndex('careerStepDown'),back=effectIndex('return');
        if(run.rank>targetRank&&down>=0){choose(down);continue;}
        choose(back>=0?back:effectIndex(run.flags.pip_passed?'pip_exit':'ragequit'));continue;
      }
      choose(effectIndex(eligibleStoryEndings(run).includes(target)?'storyCareer':'legacyCareer'));continue;
    }
    if(run.eventId==='career-step-down'){
      choose(effectIndex(targetRank===4?'careerDemoteDeputy':'careerDemoteStaff'));continue;
    }
    if(run.eventId==='story-exit'){
      const direct=effectIndex(target);choose(direct>=0?direct:effectIndex('rankHub'));continue;
    }
    if(careerTarget()&&!['exit-menu','career-exit','career-review','onboarding'].includes(run.eventId)){leave();continue;}
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
      choose(target==='fired_refused'?0:target==='layoff'||ev.choices[2].available===false?1:2);continue;
    }
    if(run.eventId==='pip-review'){
      if(target==='pip_fail'){choose(2);continue;}
      const pass=ev.choices.findIndex((c,i)=>applyChoice(run,i).pendingEffect==='pipPassed');
      choose(pass>=0?pass:2);continue;
    }
    if(run.eventId==='pip-passed') {choose(target==='pip_exit'?0:1);continue;}
    if(run.eventId==='crisis-mood'){
      const paid=ev.choices[1].available!==false;
      choose(paid&&(target!=='burnout'||run.stats.energy<15)?1:2);continue;
    }
    if(run.eventId==='mood-collapse'){
      const best=ev.choices.map((choice,index)=>({choice,index})).filter(({choice,index})=>choice.available!==false&&index<2)
        .map(({index})=>({index,score:utility(applyChoice(run,index),target)})).sort((a,b)=>b.score-a.score)[0];
      choose(best?.index??2);continue;
    }
    if(run.eventId==='final-shortfall'){choose(0);continue;}
    if(run.eventId==='salary-cut'){choose(target==='broke'?0:applyChoice(run,2).pendingEffect==='salaryRescind'?2:0);continue;}
    if(run.eventId==='salary-final'){choose(0);continue;}
    if(run.eventId==='promotion-review'){
      if(target==='broke'){const rejected=ev.choices.findIndex((c,i)=>c.check&&applyChoice(run,i).pendingEffect!=='promote');choose(rejected>=0?rejected:2);continue;}
      const pass=ev.choices.findIndex((c,i)=>applyChoice(run,i).pendingEffect==='promote');
      choose(pass>=0&&target!=='assistant'?pass:2);continue;
    }
    if(run.eventId==='career-review'){
      const desired=desiredRank();
      const needsPromotion=target!=='assistant'&&targetRank!==0&&(run.assignment==='assistant'?desired>0:run.rank<desired);
      const pass=ev.choices.findIndex((c,i)=>c.available!==false&&c.check&&['careerPromote','careerRegularize'].includes(applyChoice(run,i).pendingEffect));
      if(needsPromotion&&pass>=0){choose(pass);continue;}
      const candidates=needsPromotion?[2,3]:[3,2];
      const best=candidates.map(i=>({i,score:utility(applyChoice(run,i),target)})).sort((a,b)=>b.score-a.score)[0];
      choose(best.i);continue;
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
    if(!ENDINGS.some(ending=>ending.id===desired))continue;
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
    method:'Target-guided deterministic route search; every witness begins at createRun(roleId, seed), uses only applyChoice/advance/requestExit/requestBreak/requestCareer/requestRage, and is replayed with JSON-compatible save validation. No stats, roles, flags, events, rank or RNG state are injected.',
    choiceIndexBase:0,complete:found.size===ENDINGS.length,expected:ENDINGS.length,found:found.size,
    sourceSha256:Object.fromEntries(['patronage-v29','events-gender-v29','events-backoffice-v28','roles-v28','endings-backoffice-v28','wealth-exit-v27','endings-wealth-v27','events-quiz26-a','events-quiz26-b','meltdown-v25','meals-v25','salary-advice-v24','events-colleagues-v23','rage-v23','events-chronicle-v22','rage-v22','events-commercial-v21','events-design-v21','events-professions-v21','work-events-v21','engine','persona','rage-participants','rage-v16','rage-v20','events-jack','events-meimei-v20','copy-v15','events-advisor','rage','rage-v14','endings-rage','banquet','roles','education','education-risk','events','events-images','image-scenes-wing','events-video','copy-edits','engine-copy','wild-options','wild-base','wild-expanded','kind-break','career','career-api','career-v17','onboarding-v17','story-career','endings','endings-career','endings-career-v17','endings-personnel-v20','endings-stories','events-departures','resources-v18','relationships-v18','meltdown-v18','achievements-v18','salary-raise-v19','personnel-v20'].map(x=>[x,hash(x)])),
    missing:ENDINGS.filter(e=>!found.has(e.id)).map(e=>e.id),attempts,
    routes:ENDINGS.filter(e=>found.has(e.id)).map(e=>found.get(e.id))
  };
}

export function collectPersonnelWitnesses(report,{maxExtraAttempts=250}={}){
  const found=new Map(),families=new Set(['cold_storage','mediation_settled','mediation_pending']);
  const record=(id,run,actions,route)=>{
    if(found.has(id))return;
    if(!validRun(run))throw new Error(`Invalid personnel witness ${id}`);
    found.set(id,{id,roleId:route.roleId,seed:route.seed,actions:JSON.parse(JSON.stringify(actions)),
      ...(run.completed?{ending:run.endingId}:{}),expected:{eventId:run.eventId,endingId:run.endingId,turn:run.turn,pipCount:run.pipCount,floorWatch:run.flags.floor_watch||0,floorDays:run.flags.floor_watch_days||0}});
  };
  const inspect=(run,actions,route,meta={})=>{
    if(run.eventId==='dismissal-final')record(run.flags.pip_passed?'direct-after-pip':'direct-without-pip',run,actions,route);
    if(run.eventId==='floor-notice'&&meta.source)record(meta.source==='pip-passed'?'floor-after-pip':'floor-after-provocation',run,actions,route);
    if(run.eventId==='pip-passed')record('pip-passed-notice',run,actions,route);
    if(meta.source==='pip-passed'&&meta.effect==='finishPip'&&!run.flags.floor_watch&&!['floor-notice','mood-collapse'].includes(run.eventId))record('passed-back-at-work',run,actions,route);
    if(run.eventId==='watch-review')record('watch-dispute',run,actions,route);
    if(run.eventId==='watch-future')record('watch-three-days',run,actions,route);
    if(run.pipCount===2&&run.pip?.active)record('rare-second-pip',run,actions,route);
    if(meta.effect==='watchContinue')record('watch-continue',run,actions,route);
    if(meta.effect==='watchRecall')record('watch-recalled',run,actions,route);
    if(meta.effect==='directDismissal'&&meta.source==='watch-future')record('watch-dismissed',run,actions,route);
    if(!run.raiseContext&&['dismissal-final','floor-notice','crisis-boss'].includes(run.eventId)&&run.history.some(item=>item.eventId.startsWith('raise-')))record('raise-to-personnel',run,actions,route);
    if(run.eventId==='mood-collapse'&&(run.personnelPending||['dismissal-final','floor-notice','crisis-boss'].includes(run.meltdownReturnEventId)))record('meltdown-with-personnel',run,actions,route);
  };
  const visit=route=>{
    let run=createRun(route.roleId,route.seed),actions=[];
    for(let index=0;index<route.actions.length;index++){
      if(getEvent(run)?.speaker==='meimei'&&canRequestRage(run)){
        const raging=requestRage(run),mode=raging.rageContext?.mode;
        if(['imagined','real'].includes(mode))record(`meimei-rage-${mode}`,advance(raging),[...actions,raging.actions.at(-1)],route);
      }
      const action=route.actions[index];actions.push(action);
      if(action.type==='choice'){
        const pending=applyChoice(run,action.index);
        if(pending.personnelPending&&canRequestRage(pending)){
          const raging=requestRage(pending);
          if(raging.rageContext?.mode==='imagined'){
            const dreamed=advance(raging),dreamActions=[...actions,raging.actions.at(-1)];
            record('dream-result-restores-personnel',dreamed,dreamActions,route);
          }
        }
        run=route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'?pending:advance(pending);
        inspect(run,actions,route,{source:action.eventId,effect:pending.pendingEffect});
      }else if(action.type==='rage')run=advance(Object.hasOwn(action,'target')?requestRage(run,action.target):requestRage(run));
      else run=({exit:requestExit,break:requestBreak,career:requestCareer,raise:requestRaise})[action.type](run);
      inspect(run,actions,route);
      if(['floor-notice','watch-review','watch-future'].includes(run.eventId)&&!run.pending){
        for(const [choiceIndex,choice]of getEvent(run).choices.entries())if(choice.available!==false){
          const pending=applyChoice(run,choiceIndex),fork=advance(pending);
          inspect(fork,[...actions,{type:'choice',eventId:run.eventId,index:choiceIndex}],route,{source:run.eventId,effect:pending.pendingEffect});
        }
      }
    }
    if(run.completed&&families.has(run.endingId.slice(0,-route.roleId.length-1)))record(`ending-${run.endingId}`,run,actions,route);
  };
  for(const route of report.routes)visit(route);
  const extras=['raise-to-personnel','rare-second-pip','meltdown-with-personnel','floor-after-provocation','dream-result-restores-personnel'];
  for(let attempt=0;attempt<maxExtraAttempts&&extras.some(id=>!found.has(id));attempt++){
    for(const raise of [false,true])visit(simulate('system','cold_storage',attempt,{raise}).route);
  }
  for(const witness of found.values()){
    const replay=replayRoute(witness,state=>{if(!validRun(state))throw new Error(`Invalid saved personnel witness ${witness.id}`);});
    if(replay.eventId!==witness.expected.eventId||replay.endingId!==witness.expected.endingId)throw new Error(`Personnel replay drift ${witness.id}`);
  }
  return {method:'Natural createRun seeds and canonical game actions only; no state injection. Prefixes and alternate choices are replayed from the beginning, including salary talks and dream interruption.',routes:[...found.values()]};
}

export function collectRageGroupWitnesses(report){
 const found=new Map();
 const finish=(run,depth=5)=>{
  if(run.completed)return run;if(!depth)return null;
  for(const [index,choice]of getEvent(run).choices.entries())if(choice.available!==false){
   const result=finish(advance(applyChoice(run,index)),depth-1);if(result)return result;
  }
  return null;
 };
 const inspect=run=>{
  if(!canRequestRage(run)||getRageTargets(run).length!==3)return;
  for(const target of getRageTargets(run)){
   const raging=requestRage(run,target);if(raging===run)throw new Error(`Unavailable group target ${target}`);
   const {phase,mode}=raging.rageContext,id=`${phase}-${target}-${mode}`;
   if(found.has(id))continue;
   const after=advance(raging),completed=finish(after);if(!completed)throw new Error(`No continuation for ${id}`);
   found.set(id,{id,roleId:run.roleId,seed:run.seed,phase,target,mode,baseActions:raging.actions.slice(0,-1),actions:raging.actions,completionActions:completed.actions,
    expected:{eventId:after.eventId,turn:after.turn,endingId:after.endingId,completed:after.completed}});
  }
 };
 for(const route of report.routes){
  let run=createRun(route.roleId,route.seed);
  for(let index=0;index<route.actions.length;index++){
   inspect(run);const action=route.actions[index];
   if(action.type==='choice'){
    run=applyChoice(run,action.index);inspect(run);
    if(!(route.actions[index+1]?.type==='rage'&&route.actions[index+1].phase==='result'))run=advance(run);
   }else if(action.type==='rage')run=advance(Object.hasOwn(action,'target')?requestRage(run,action.target):requestRage(run));
   else run=({exit:requestExit,break:requestBreak,career:requestCareer,raise:requestRaise})[action.type](run);
   if(found.size===12)break;
  }
  if(found.size===12)break;
 }
 if(found.size!==12)throw new Error(`Incomplete natural group witnesses: ${[...found.keys()].join(',')}`);
 const routes=[...found.values()].sort((a,b)=>a.id.localeCompare(b.id));
 for(const route of routes){
  const after=replayRoute(route,state=>{if(!validRun(state))throw new Error(`Invalid group witness ${route.id}`);});
  if(after.eventId!==route.expected.eventId||after.turn!==route.expected.turn)throw new Error(`Group replay drift ${route.id}`);
  const completed=replayRoute({...route,actions:route.completionActions},state=>{if(!validRun(state))throw new Error(`Invalid group completion ${route.id}`);});
  if(!completed.completed)throw new Error(`Incomplete group continuation ${route.id}`);
 }
 return {method:'Natural createRun prefixes and explicit in-scene rage actions only; no state injection. Every event/result, target and imagined/real branch has a valid replay and ending continuation.',routes};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=findRoutes({maxAttempts:Number(process.argv[2])||3000,onProgress:p=>{if(!p.found||p.family==='historian')console.log(JSON.stringify(p));}});
  writeFileSync(new URL('../research/reachability-v3.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  if(report.complete&&process.argv.includes('--personnel')){
    const witnesses=collectPersonnelWitnesses(report);
    writeFileSync(new URL('./fixtures/personnel-routes-v20.json',import.meta.url),JSON.stringify(witnesses,null,2)+'\n');
    console.log(JSON.stringify({personnelWitnesses:witnesses.routes.length,features:witnesses.routes.filter(route=>!route.id.startsWith('ending-')).map(route=>route.id)}));
  }
  if(report.complete&&process.argv.includes('--rage-group')){
    const witnesses=collectRageGroupWitnesses(report);
    writeFileSync(new URL('./fixtures/rage-group-routes.json',import.meta.url),JSON.stringify(witnesses,null,2)+'\n');
    console.log(JSON.stringify({rageGroupWitnesses:witnesses.routes.length}));
  }
  console.log(JSON.stringify({complete:report.complete,found:report.found,expected:report.expected,missing:report.missing}));
  if(!report.complete)process.exitCode=1;
}
