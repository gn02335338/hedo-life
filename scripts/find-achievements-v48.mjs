// Achievement witnesses are discovered from real games, then independently
// replayed from createRun. The finder never edits a game's state or RNG.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as E from '../dist/engine.js';
import {simulate} from '../tests/find-routes-v3.mjs';
import {ACHIEVEMENTS_V48,deriveAchievementsV48} from '../dist/achievements-v48.js';

const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const clone=value=>JSON.parse(JSON.stringify(value));
const forbiddenMenus=new Set(['mealOpen','mealPage','mealPick','wealthStartup','wealthRetire','wealthReturn','wealthBack','mealBack']);
const utility=run=>run.completed?-1e8:Math.min(run.stats.mood,run.stats.energy)*7+run.stats.mood+run.stats.energy+Math.min(run.stats.boss,65)*1.2+run.stats.cash*.5+run.stats.trust*.2-(run.pendingFamily?5e5:0)-(run.pip?.active?90:0)-(run.personnelPending?80:0)-(run.flags.floor_watch?180:0);
function best(run,prefer={}){
 const event=E.getEvent(run),options=event.choices.flatMap((choice,index)=>choice.available===false?[]:[index]);
 if(prefer[event.id]!==undefined&&options.includes(prefer[event.id]))return choose(run,prefer[event.id]);
 if(event.id==='verbal-v32-aftermath')return choose(run,3);
 if(event.id==='chapter-resolution'&&options.includes(0)&&!['burnout','broke'].includes(run.chapterContext?.family))return choose(run,0);
 if(/^meal-guests-/.test(event.id)){const cancel=options.find(index=>event.choices[index].effect==='mealCancel');if(cancel!==undefined)return choose(run,cancel);}
 let selected=null;
 for(const index of options.filter(index=>!forbiddenMenus.has(event.choices[index].effect))){
  try{const after=choose(run,index),value=utility(after);if(!selected||value>selected.value)selected={after,value};}catch{}
 }
 if(!selected)throw new Error(`No playable choice: ${run.seed}/${run.eventId}`);
 return selected.after;
}
function actionStep(run,action,following){
 const selected=Object.hasOwn(action,'target');
 if(action.type==='choice'){
  if(run.eventId!==action.eventId)throw Error(`Fixture drift ${run.seed}/${action.eventId}`);
  const pending=E.applyChoice(run,action.index);
  return ['rage','verbal'].includes(following?.type)&&following.phase==='result'?pending:E.advance(pending);
 }
 if(action.type==='rage')return E.advance(E.requestRage(run,selected?action.target:undefined));
 if(action.type==='verbal')return E.advance(E.requestVerbal(run,selected?action.target:undefined,action.version));
 const handlers={exit:E.requestExit,break:E.requestBreak,career:E.requestCareer,raise:E.requestRaise,'salary-advice':E.requestSalaryAdvice,'activity-schedule':E.enableActivitySchedule,'activity-invitation':E.requestActivityInvitation,'hidden-encounter':E.requestHiddenEncounter};
 if(handlers[action.type])return handlers[action.type](run);
 if(action.type==='activity')return E.requestActivity(run,action.activityId);
 if(action.type==='patronage-reply')return E.advance(E.requestPatronageReply(run,action.target));
 throw Error(`Unsupported canonical action ${action.type}`);
}

export function findAchievementMilestonesV48(){
 const wanted=new Set(ACHIEVEMENTS_V48.map(item=>item.id)),found=new Map(),candidates=[],pools=new Map();
 const remember=run=>{
  if(!run.completed&&!run.pending&&!run.verbalContext&&!run.rageContext&&!run.chapterContext){
   const event=E.getEvent(run),keys=[];
   if(/^(?:salary-|raise-)/.test(event.id))keys.push('salary');
   if(/^pip-/.test(event.id))keys.push('pip');
   if(['kind-break','kind-workday','banquet-afterparty'].includes(event.id)||/^meal-with-/.test(event.id))keys.push('private');
   if(event.speaker==='spencer')keys.push('board');
   if(event.id==='onboarding')keys.push('onboard');
   for(const key of keys){const pool=pools.get(key)||[];if(pool.length<18&&!pool.some(value=>value.seed===run.seed&&value.eventId===run.eventId)){pool.push(clone(run));pools.set(key,pool);}}
  }
  const ids=deriveAchievementsV48(run).filter(id=>wanted.has(id));
  if(!ids.some(id=>!found.has(id)))return;
  const entry={roleId:run.roleId,seed:run.seed,actions:clone(run.actions),expectedAchievements:ids};
  candidates.push(entry);for(const id of ids)if(!found.has(id))found.set(id,entry);
 };
 const replayPrefixes=route=>{let run=E.createRun(route.roleId,route.seed);remember(run);for(let i=0;i<route.actions.length;i++){run=actionStep(run,route.actions[i],route.actions[i+1]);remember(run);}return run;};
 const continueWork=(start,limit=16)=>{
  let run=start;for(let step=0;step<limit&&!run.completed&&run.actions.length<275;step++){
   remember(run);if(E.canRequestBreak(run)&&(run.stats.mood<50||run.stats.energy<45)&&run.stats.cash>10){run=best(E.requestBreak(run));continue;}
   run=best(run);
  }remember(run);return run;
 };

 // Existing public company proofs provide broad ordinary work/career history.
 const company=JSON.parse(readFileSync(new URL('../tests/fixtures/company-e39-routes.json',import.meta.url),'utf8')).routes;
 for(const route of company)replayPrefixes(route);

 // Repeated outbursts require subsequent real work, not an open aftermath.
 for(let attempt=0;attempt<12;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-badges-${attempt}`));
  for(let step=0;step<170&&!run.completed&&run.turn<23&&run.actions.length<250;step++){
   remember(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(E.canRequestBreak(run)&&(run.stats.mood<62||run.stats.energy<58)&&run.stats.cash>10){run=best(E.requestBreak(run));continue;}
   const event=E.getEvent(run);
   if(!run.verbalContext&&!run.rageContext&&!run.chapterContext&&!run.pip?.active&&['daily','fantasy'].includes(event.kind)&&E.canRequestVerbal(run)&&E.getVerbalTargets(run).some(id=>id!=='self'))run=E.advance(E.requestVerbal(run,undefined,2));
   else run=best(run);
  }remember(run);
 }

 // Actual violence has a specific aftermath; these paths settle it and then
 // play an ordinary work choice, rather than counting mere non-completion.
 for(let attempt=0;attempt<35;attempt++){
  let source=E.createRun('sales',`e39-badges-rage-${attempt}`);
  const released=E.requestRage(source);
  if(released.rageContext?.mode==='real'){
   let run=E.advance(released);remember(run);run=choose(run,0);remember(run);run=choose(run,1);remember(run);
   if(run.eventId==='chapter-resolution'){run=choose(run,0);remember(run);continueWork(run);}
  }
  source=choose(source,0);
  if(E.canRequestBreak(source)){
   let menu=E.requestBreak(source);
   if(menu.eventId==='kind-break'){
    const rage=E.requestRage(menu);if(rage.rageContext?.mode==='real'){
     let run=E.advance(rage);remember(run);run=choose(run,0);remember(run);run=choose(run,1);remember(run);continueWork(run);
    }
   }
  }
 }

 // Activities occur through the current calendar invitation protocol. Each
 // policy is an actual player response, including wild alternatives.
 for(let policy=0;policy<3;policy++)for(let attempt=0;attempt<18;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-test-${attempt}`));
  for(let step=0;step<140&&!run.completed&&run.turn<23&&run.actions.length<250;step++){
   remember(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),0);continue;}
   if(run.activityContext){const event=E.getEvent(run),indices=event.choices.flatMap((c,i)=>c.available===false?[]:[i]);run=choose(run,indices[policy%indices.length]);continue;}
   if(E.canRequestBreak(run)&&(run.stats.mood<60||run.stats.energy<50)&&run.stats.cash>10){run=best(E.requestBreak(run));continue;}
   run=best(run);
  }remember(run);
 }

 // Repeated, paid meal attempts retain their seeded accept/decline and table
 // atmosphere draws. Colleagues and leaders are invited with their real rules.
 const guests=['jack','meimei','wing','rick','kind','sonny'];
 for(let attempt=0;attempt<24;attempt++){
  let run=E.enableActivitySchedule(E.createRun('sales',`e39-cal46-meal48-${attempt}`)),menuRounds=0,interrupted=false;
  for(let step=0;step<180&&!run.completed&&run.turn<22&&run.actions.length<260;step++){
   remember(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(E.canRequestBreak(run)){run=E.requestBreak(run);continue;}
   if(run.eventId==='kind-break'){run=choose(run,1);continue;}
   if(run.eventId==='self-care'){
    const open=E.getEvent(run).choices.findIndex(c=>c.effect==='mealOpen'&&c.available!==false);
    if(open>=0&&run.stats.energy>22&&run.stats.cash>15){run=choose(run,open);menuRounds=0;continue;}
   }
   if(/^meal-guests-/.test(run.eventId)){
    const event=E.getEvent(run),target=guests[(attempt+Math.floor(run.turn/3))%guests.length];
    const pick=event.choices.findIndex(c=>c.mealTarget===target&&c.available!==false);
    if(pick>=0){run=choose(run,pick);menuRounds++;continue;}
    const other=event.choices.findIndex(c=>c.mealTarget&&c.available!==false);
    if(menuRounds<4&&other>=0){run=choose(run,other);menuRounds++;continue;}
    const page=event.choices.findIndex(c=>c.effect==='mealPage'&&c.available!==false);
    if(menuRounds<4&&page>=0){run=choose(run,page);menuRounds++;continue;}
    const cancel=event.choices.findIndex(c=>c.effect==='mealCancel');run=choose(run,cancel);continue;
   }
   if(run.eventId.startsWith('meal-with-')){
    if(!interrupted&&attempt%3===0&&E.canRequestVerbal(run)){interrupted=true;run=E.advance(E.requestVerbal(run,undefined,2));continue;}
    if(!interrupted&&attempt%3===1&&E.canRequestRage(run)){
     const released=E.requestRage(run);if(released.rageContext?.mode==='imagined'){interrupted=true;run=E.advance(released);continue;}
    }
    run=choose(run,attempt%2);continue;
   }
   run=best(run);
  }remember(run);
 }

 // Finite stress/recovery and spending policies make resource combinations
 // observable without manufacturing a crash or an approval.
 for(let policy=0;policy<7;policy++)for(let attempt=0;attempt<10;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-wallet${policy}-${attempt}`));
  for(let step=0;step<160&&!run.completed&&run.turn<23&&run.actions.length<250;step++){
   remember(run);const event=E.getEvent(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(run.eventId==='mood-collapse'){const desired=policy===1?1:0;run=choose(run,event.choices[desired]?.available===false?1:desired);continue;}
   if(run.eventId==='self-care'){
    const desired=policy===1?0:policy===2?3:policy===3?6:policy===4?5:policy===5?2:0;
    run=event.choices[desired]?.available!==false?choose(run,desired):best(run);continue;
   }
   if(run.eventId==='kind-break'){run=choose(run,1);continue;}
   if(policy>=2&&E.canRequestBreak(run)&&run.stats.cash>22){run=E.requestBreak(run);continue;}
   if(policy===2&&!run.verbalContext&&E.canRequestVerbal(run)&&['daily','fantasy'].includes(event.kind)&&run.turn%3===1){run=E.advance(E.requestVerbal(run,undefined,2));continue;}
   if(policy===4&&E.canRequestRaise(run)){run=E.requestRaise(run);continue;}
   if(policy<=1&&['daily','fantasy'].includes(event.kind)){
    const options=event.choices.flatMap((c,i)=>c.available===false?[]:[i]);let selected=null;
    for(const index of options){try{const next=choose(run,index),value=(next.completed||next.pendingFamily?-1e7:0)+next.stats.energy*2+next.stats.cash*.6+Math.min(next.stats.boss,50)*3-next.stats.mood*2-(next.personnelPending?120:0);if(!selected||value>selected.value)selected={next,value};}catch{}}
    run=selected.next;continue;
   }
   run=best(run);
  }remember(run);
 }
 // Existing route-search policies exercise genuine salary and PIP decisions.
 for(const target of ['pip_exit','cold_storage','promotion'])for(let attempt=0;attempt<12;attempt++){
  const {route}=simulate('system',target,attempt,{seedPrefix:'e39',raise:true});replayPrefixes(route);
 }

 // Interrupt specific real conversations, then finish every follow-up before
 // asking the engine for another work choice.
 for(const sources of pools.values())for(const source of sources){
  if(E.canRequestVerbal(source)){
   let run=E.advance(E.requestVerbal(source,undefined,2));remember(run);
   run=continueWork(run,24);
  }
  if(/^(?:salary-|raise-)/.test(source.eventId)&&E.canRequestRage(source)){
   const release=E.requestRage(source);
   if(release.rageContext?.mode==='real'){
    let run=choose(choose(E.advance(release),0),1);remember(run);
    if(run.eventId==='chapter-resolution'){run=choose(run,0);remember(run);continueWork(run,18);}
   }
  }
 }
 for(let attempt=0;attempt<30;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-mixed48-${attempt}`));
  for(let step=0;step<180&&!run.completed&&run.turn<22&&run.actions.length<260;step++){
   remember(run);const event=E.getEvent(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(E.canRequestBreak(run)&&(run.stats.mood<62||run.stats.energy<60)&&run.stats.cash>15){run=best(E.requestBreak(run));continue;}
   if(run.rageContext){
    const preferred={'rage-aftermath':0,'rage-legal':1,'rage-showdown':2,'rage-public':0};run=best(run,preferred);continue;
   }
   if(run.eventId==='chapter-resolution'){run=best(run);continue;}
   if(E.canRequestRage(run)&&['onboarding','daily','fantasy'].includes(event.kind)){
    run=E.advance(E.requestRage(run));remember(run);
    if(!run.rageContext&&E.canRequestVerbal(run)){run=E.advance(E.requestVerbal(run,undefined,2));remember(run);}
    continue;
   }
   run=best(run);
  }remember(run);
 }
 // Explore the two alternate private resolutions from already reached sources.
 for(const source of pools.get('private')||[])if(E.canRequestRage(source)){
  const released=E.requestRage(source);if(released.rageContext?.mode!=='real')continue;
  for(const first of [1,2]){
   let run=choose(E.advance(released),first);remember(run);run=choose(run,0);remember(run);continueWork(run,18);
  }
 }

 // Reuse actual PIP entries for two distinct paid rest choices. Neither
 // opening a menu nor a free cancellation is counted as a purchase.
 for(const source of pools.get('pip')||[]){
  let run=choose(source,0),bought=new Set();remember(run);
  for(let step=0;step<65&&!run.completed&&run.actions.length<260;step++){
   const event=E.getEvent(run);remember(run);
   if(E.canRequestBreak(run)&&bought.size<2){run=E.requestBreak(run);continue;}
   if(run.eventId==='kind-break'){run=choose(run,1);continue;}
   if(run.eventId==='self-care'){
    const index=bought.has(1)?5:1;if(event.choices[index]?.available!==false){run=choose(run,index);bought.add(index);continue;}
   }
   run=best(run);
  }remember(run);
 }
 // A declared unpaid leave must be followed by a later, real drink purchase.
 for(let attempt=0;attempt<20;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-unpaid48-${attempt}`)),unpaid=false;
  for(let step=0;step<140&&!run.completed&&run.turn<23&&run.actions.length<260;step++){
   remember(run);const event=E.getEvent(run);
   if(run.eventId==='mood-collapse'){run=choose(run,1);unpaid=true;continue;}
   if(unpaid&&E.canRequestBreak(run)){run=E.requestBreak(run);continue;}
   if(run.eventId==='kind-break'){run=choose(run,1);continue;}
   if(unpaid&&run.eventId==='self-care'&&event.choices[0].available!==false){run=choose(run,0);remember(run);break;}
   if(!unpaid&&['daily','fantasy'].includes(event.kind)){
    let winner=null;for(const [index,c]of event.choices.entries())if(c.available!==false){const next=choose(run,index),score=(next.completed||next.pendingFamily?-1e8:0)+next.stats.energy*2+Math.min(next.stats.boss,60)*3+next.stats.cash*.4-next.stats.mood*3-(next.personnelPending?130:0);if(!winner||score>winner.score)winner={next,score};}run=winner.next;continue;
   }
   run=best(run);
  }
 }
 // Boardroom speech is reached naturally after the onboarding outburst.
 for(let attempt=0;attempt<30;attempt++){
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-boss48-${attempt}`));
  run=E.advance(E.requestVerbal(run,undefined,2));
  for(let step=0;step<150&&!run.completed&&run.turn<23&&run.actions.length<260;step++){
   remember(run);const event=E.getEvent(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(E.canRequestBreak(run)&&(run.stats.mood<58||run.stats.energy<48)&&run.stats.cash>10){run=best(E.requestBreak(run));continue;}
   if(event.speaker==='spencer'&&E.canRequestVerbal(run)){run=E.advance(E.requestVerbal(run,undefined,2));continue;}
   run=best(run);
  }remember(run);
 }

 // Follow the same colleague across invitations. This proves reconciliation
 // with the actual recipient, rather than borrowing another person's dinner.
 for(let mode=0;mode<3;mode++)for(let attempt=0;attempt<35;attempt++){
  const goal=['meal-first-love-break','meal-after-insult','meal-after-dream'][mode];if(found.has(goal))break;
  let run=E.enableActivitySchedule(E.createRun('system',`e39-cal46-table${mode}-${attempt}`)),interrupted=false,pageTurns=0;
  for(let step=0;step<190&&!run.completed&&run.turn<22&&run.actions.length<270;step++){
   remember(run);if(found.has(goal))break;const event=E.getEvent(run);
   if(E.canRequestActivityInvitation(run)){run=choose(E.requestActivityInvitation(run),1);continue;}
   if(E.canRequestBreak(run)){run=E.requestBreak(run);continue;}
   if(run.eventId==='kind-break'){run=choose(run,1);continue;}
   if(run.eventId==='self-care'){
    if(run.stats.energy<25&&event.choices[1].available!==false){run=choose(run,1);continue;}
    const open=event.choices.findIndex(c=>c.effect==='mealOpen'&&c.available!==false);
    if(open>=0){run=choose(run,open);pageTurns=0;continue;}
   }
   if(/^meal-guests-/.test(run.eventId)){
    const ateJack=run.history.some(row=>row.mealOutcome?.target==='jack'),target=mode===0?(ateJack?'meimei':'jack'):'jonathan';
    const pick=event.choices.findIndex(c=>c.mealTarget===target&&c.available!==false);
    if(pick>=0){run=choose(run,pick);continue;}
    const seen=event.choices.some(c=>c.mealTarget===target),page=event.choices.findIndex(c=>c.effect==='mealPage'&&c.available!==false);
    if(!seen&&pageTurns<3&&page>=0){run=choose(run,page);pageTurns++;continue;}
    run=choose(run,event.choices.findIndex(c=>c.effect==='mealCancel'));continue;
   }
   if(/^meal-with-/.test(run.eventId)){
    if(mode===1&&!interrupted&&E.canRequestVerbal(run)){run=E.advance(E.requestVerbal(run,undefined,2));interrupted=true;continue;}
    if(mode===2&&!interrupted&&E.canRequestRage(run)){const released=E.requestRage(run);if(released.rageContext?.mode==='imagined'){run=E.advance(released);interrupted=true;continue;}}
    run=choose(run,0);continue;
   }
   run=best(run);
  }remember(run);
 }

 const routes=[];
 // Keep only useful witnesses, preferring a single route for multiple goals.
 const uncovered=new Set(wanted);
 while(uncovered.size){
  let selected=null,score=0;
  for(const candidate of candidates){const count=candidate.expectedAchievements.filter(id=>uncovered.has(id)).length;if(count>score||(count===score&&count>0&&candidate.actions.length<(selected?.actions.length??Infinity))){selected=candidate;score=count;}}
  if(!selected)break;
  const primary=selected.expectedAchievements.find(id=>uncovered.has(id));
  const run=E.replayRun(selected.roleId,selected.seed,selected.actions);
  if(!E.validRun(clone(run)))throw Error(`Invalid achievement proof ${primary}`);
  if(JSON.stringify(deriveAchievementsV48(run))!==JSON.stringify(selected.expectedAchievements))throw Error(`Achievement replay drift ${primary}`);
  routes.push({id:primary,...selected});for(const id of selected.expectedAchievements)uncovered.delete(id);
 }
 if(uncovered.size)throw Error(`Missing natural achievement proofs: ${[...uncovered].join(', ')}`);
 return {method:'Natural e39 createRun games and canonical actions only. Every witness is independently replayed; no stats, flags, history, context or RNG state is injected. Goals require their resolved actions and later work where applicable.',routes};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const result=findAchievementMilestonesV48();
 writeFileSync(new URL('../tests/fixtures/achievement-milestones-v48.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({routes:result.routes.length,achievements:[...new Set(result.routes.flatMap(route=>route.expectedAchievements))].length}));
}
