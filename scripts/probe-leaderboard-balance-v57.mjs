import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as E from '../dist/engine.js';
import { ROLES } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';
import { ACTIVITY_PLAY_CONTENT_V55 } from '../dist/activity-play-v55.js';

// Actual canonical public actions, not injected stats. Policy input is limited
// to revealed story, choice text/availability, current stats and visible role.
// No choice effects, deltas, future outcomes or engine RNG inform decisions.
const args=Object.fromEntries(process.argv.slice(2).reduce((out,value,index,all)=>{
 if(value.startsWith('--'))out.push([value.slice(2),all[index+1]]);return out;
},[]));
const N=Math.max(1,Number(args.runs)||12),out=resolve(args.out||'artifacts/v57-leaderboard-balance');
mkdirSync(out,{recursive:true});
const label=args.label||'baseline';
const scoreSource=resolve(args.score||'dist/leaderboard-score-v56.js');
const scoreText=readFileSync(scoreSource,'utf8').replace("'./endings.js'",JSON.stringify(pathToFileURL(resolve('dist/endings.js')).href));
writeFileSync(resolve(out,`score-${label}.mjs`),scoreText);
const {deriveLeaderboardScoreV56:score}=await import(pathToFileURL(resolve(out,`score-${label}.mjs`)));
const policies=(args.policies||'earlyquit,balanced,same0,same1,same2,verbalspam,ragespam,menuspam,trainspam').split(',');
const selectedRoles=args.roles?ROLES.filter(role=>args.roles.split(',').includes(role.id)):ROLES;
const PREFIX='e39-cal46-kin49-g-e-s-m-';
const familyById=new Map(ENDINGS.map(ending=>[ending.id,ending.family]));
const hash=text=>createHash('sha256').update(text).digest('hex');
const seeds=Array.from({length:N},(_,index)=>PREFIX+hash(`leaderboard-v57-paired-${index}`).slice(0,8));
const visible=run=>({roleId:run.roleId,actualRoleId:run.actualRoleId,assignment:run.assignment,rank:run.rank,turn:run.turn,pay:run.pay,stats:{...run.stats}});
const publicEvent=event=>({id:event.id,kind:event.kind,title:event.title,body:event.body,choices:event.choices.map((choice,index)=>({text:choice.text,index,available:choice.available!==false}))});
const patterns={
 work:/紀錄|記錄|核對|確認|驗證|測試|資料|證據|交付|條件|需求|範圍|流程|文件|交接|規格|備份|版本|維護|實際|逐條|報價|目標/g,
 polite:/感謝|肯定|遠見|願景|方向|相信|點頭|照做|掌聲|學習|先聽|先照|親自/g,
 rest:/散步|喝水|休息|下班|收工|睡|吃|關掉|靜音|勿擾|通知|輕鬆|省電|界線/g,
 team:/同事|團隊|大家|一起|互助|合作|當事人|聯絡|幫忙/g,
 leave:/離職|辭職|我先走|我現在走|不幹|離開公司|就到這|最後一天|替.*收尾|結束.*人生/g,
 provoke:/質問|嗆|反問|當場|不接受|要他|請他|反駁|到底|不讀書|不替/g
};
const hit=(text,pattern)=>(text.match(pattern)||[]).length;
function chooseText(event,run){
 const {stats:s}=run;
 return event.choices.filter(choice=>choice.available).map(choice=>{
  const k=Object.fromEntries(Object.entries(patterns).map(([key,re])=>[key,hit(choice.text,re)]));
  return {index:choice.index,score:k.work*1.3+k.team*1.2+k.polite*.7+k.rest*.6-k.provoke*.25-k.leave*30+(s.boss<32?k.polite*2.8:0)+(s.energy<30||s.mood<30?k.rest*2:0)};
 }).sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.index;
}
function choose(run,policy,visits){
 const event=publicEvent(E.getEvent(run)),v=visible(run),cs=event.choices.filter(choice=>choice.available),has=index=>cs.some(choice=>choice.index===index),first=(...indices)=>indices.find(has),s=v.stats;
 if(event.id==='onboarding')return policy==='earlyquit'?2:0;
 if(event.id==='work-gap-v50')return 0;
 if(event.id.startsWith('activity44-invite-'))return 0;
 if(event.id==='self-care')return s.energy<=30?first(1,5,0,7):s.mood<42?first(0,5,1,7):first(7,0);
 if(event.id==='kind-break'||event.id==='kind-workday')return first(2,1);
 if(event.id==='crisis-mood')return s.cash>8?first(1,2):first(2);
 if(event.id.startsWith('meal-guests-'))return cs.find(choice=>/自己買便當/.test(choice.text))?.index??cs.find(choice=>/^傳訊息/.test(choice.text))?.index??cs.find(choice=>/先不約/.test(choice.text))?.index??cs[0].index;
 if(event.id==='mood-collapse'||event.id==='mood-self-destruct')return first(0,1);
 if(event.id==='career-review')return policy==='trainspam'?first(2,3):first(0,1,2,3);
 if(event.id==='salary-cut')return first(2,0);
 if(event.id==='salary-final')return first(0);
 if(event.id==='education-scrutiny')return first(0,1);
 if(event.id==='education-review')return first(s.boss<35?2:0,0);
 if(event.id==='crisis-boss'||event.id==='paperwork')return first(2,1,0);
 if(event.id==='pip-review')return s.skill>=s.lick?first(0,1):first(1,0);
 if(event.id==='pip-passed')return first(1,2);
 if(event.id==='exit-menu')return first(2);
 if(event.id==='final-shortfall')return 0;
 if(event.id==='finale'&&(visits.get('finale')||0)>1)return 3;
 if(event.id==='rank-exit')return first(0,1,4);
 if(event.id==='career-exit')return first(1,2,3,4,0,5);
 if(event.id.startsWith('wealth-'))return first(0,1,2);
 if(event.id.startsWith('company-v32-'))return cs.find(choice=>!/回.*(?:簡報|上一|桌)|換.*方向/.test(choice.text))?.index??cs[0].index;
 if(['daily','fantasy'].includes(event.kind)&&/^same[012]$/.test(policy))return first(Number(policy.at(-1)),0,1,2);
 return chooseText(event,v)??cs[0]?.index;
}
const gameInput=id=>({
 arm:{kind:id,mode:'steady',taps:[...ACTIVITY_PLAY_CONTENT_V55.arm.steadyTimes]},
 diet:{kind:id,days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:i<5?i%2:2}))},
 roadshow:{kind:id,matches:[0,1,2,1,0,2]},
 dinner:{kind:id,plates:[0,0,1,1,1,2]},
 banquet:{kind:id,beats:[...ACTIVITY_PLAY_CONTENT_V55.banquet.beatTimes]},
 basketball:{kind:id,moves:[0,2,1,2,0]},
 review:{kind:id,evidence:[0,1,2,0]}
}[id]);
function hooks(run){
 if(E.canRequestSalaryAdvice(run))return E.requestSalaryAdvice(run);
 if(E.canRequestActivityInvitation(run))return E.requestActivityInvitation(run);
 const hidden=E.requestHiddenEncounter(run);return hidden;
}
const summary=rows=>{
 const ordered=key=>rows.map(row=>row[key]).sort((a,b)=>a-b),pct=(array,q)=>array[Math.floor((array.length-1)*q)]??null;
 const values=ordered('total'),work=ordered('workTurns');
 return {n:rows.length,completed:rows.filter(row=>row.completed).length,unfinished:rows.filter(row=>!row.completed).length,
  overall:{min:values[0],p25:pct(values,.25),median:pct(values,.5),p75:pct(values,.75),max:values.at(-1),mean:Math.round(values.reduce((a,b)=>a+b,0)/values.length)},
  workTurns:{min:work[0],median:pct(work,.5),max:work.at(-1),mean:Number((work.reduce((a,b)=>a+b,0)/work.length).toFixed(2))},
  families:rows.reduce((out,row)=>(out[row.family]=(out[row.family]||0)+1,out),{}),
  averageActions:Number((rows.reduce((sum,row)=>sum+row.actions,0)/rows.length).toFixed(2)),
  behavior:{verbal:Math.max(...rows.map(row=>row.metrics?.verbal||0)),realHits:Math.max(...rows.map(row=>row.metrics?.realHits||0)),imaginedHits:Math.max(...rows.map(row=>row.metrics?.imaginedHits||0)),menus:Math.max(...rows.map(row=>row.menuVisits))}
 };
};
const prior=args.resume?JSON.parse(readFileSync(resolve(args.resume),'utf8')):null;
if(prior&&prior.scoreHash!==hash(scoreText))throw Error('Cannot resume against a different scoring version');
const retry=new Set(prior?.errors.map(row=>`${row.roleId}/${row.policy}/${row.index}`));
const rows=prior?.rows||[],errors=[],reproductions=prior?JSON.parse(readFileSync(resolve(args.resume).replace(/\.json$/,'-reproductions.json'),'utf8')):[];
for(const role of selectedRoles){
 for(const policy of policies){
  for(let index=0;index<N;index++){
   if(prior&&!retry.has(`${role.id}/${policy}/${index}`))continue;
   const seed=seeds[index];let run=E.enableActivitySchedule(E.createRun(role.id,seed)),menuVisits=0,steps=0;
   const menuDone=new Set(),visits=new Map();
   try{
    while(!run.completed&&steps++<450&&run.actions.length<285){
     if(run.pending){run=hooks(E.advance(run));continue;}
     run=hooks(run);if(run.pending)continue;
     const play=E.getActivityPlayV55(run);
     if(play){run=E.applyActivityPlay(run,gameInput(play.id));continue;}
     if(E.isWorkGapOpenV50(run)){
      if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}
      run=E.applyChoice(run,0);continue;
     }
     if(policy==='verbalspam'&&E.canRequestVerbal(run)){run=E.requestVerbal(run,undefined,2);continue;}
     if(policy==='ragespam'&&E.canRequestRage(run)){run=E.requestRage(run);continue;}
     if(policy==='menuspam'&&!menuDone.has(run.turn)&&['daily','fantasy'].includes(E.getEvent(run).kind)){
      menuDone.add(run.turn);
      for(let loop=0;loop<3;loop++){
       const before=run,opened=E.requestExit(run);if(opened===run)break;
       run=E.advance(E.applyChoice(opened,2));menuVisits++;
       if(run.turn!==before.turn||run.completed)break;
      }
     }
     if(policy==='trainspam'&&E.canRequestCareer(run)){run=E.requestCareer(run);continue;}
     const chosenEvent=E.getEvent(run).id;visits.set(chosenEvent,(visits.get(chosenEvent)||0)+1);
     run=E.applyChoice(run,choose(run,policy,visits));
    }
    if(run.pending)run=E.advance(run);
    if(!E.validRun(run))throw Error('Invalid canonical final state');
    if(!run.completed)throw Error(`Unfinished at ${run.eventId} after ${steps} steps/${run.actions.length} actions`);
    const replay=E.replayRun(run.roleId,run.seed,JSON.parse(JSON.stringify(run.actions)));
    if(JSON.stringify(replay)!==JSON.stringify(run))throw Error('Canonical replay mismatch');
    const scored=score(run),row={roleId:role.id,actualRoleId:run.actualRoleId,policy,index,seed,completed:run.completed,total:scored.total,workTurns:scored.completedTurns,family:familyById.get(run.endingId),endingId:run.endingId,actions:run.actions.length,menuVisits,metrics:scored.metrics,breakdown:scored.breakdown,stats:run.stats};
    rows.push(row);
    if(index===0||scored.total>7000||policy==='earlyquit')reproductions.push({roleId:role.id,policy,index,seed,score:scored.total,workTurns:scored.completedTurns,endingId:run.endingId,actions:run.actions});
   }catch(error){errors.push({roleId:role.id,policy,index,seed,message:error.message,eventId:run.eventId,actions:run.actions});}
  }
  console.log(JSON.stringify({role:role.id,policy,...summary(rows.filter(row=>row.roleId===role.id&&row.policy===policy)),errors:errors.filter(row=>row.roleId===role.id&&row.policy===policy).length}));
 }
}
const pairs=[];
for(const policy of policies.filter(value=>value!=='balanced')){
 const against=rows.filter(row=>row.policy===policy).map(row=>({row,control:rows.find(other=>other.policy==='balanced'&&other.roleId===row.roleId&&other.index===row.index)})).filter(pair=>pair.control);
 pairs.push({policy,n:against.length,outscoredBalanced:against.filter(({row,control})=>row.total>control.total).length,meanDifference:Math.round(against.reduce((sum,{row,control})=>sum+row.total-control.total,0)/against.length),sameFinalStateAndScore:against.filter(({row,control})=>row.total===control.total&&JSON.stringify(row.stats)===JSON.stringify(control.stats)).length});
}
const report={createdAt:new Date().toISOString(),scoreSource,scoreHash:hash(scoreText),runsPerCell:N,method:{seedPrefix:PREFIX,pairedSeeds:seeds,policy:'Visible current stats and choice text/availability only. No postchoice lookahead, delta/check/result/RNG inspection or state injection. Each action commits once. Accepted mini-games use a fixed competent plan derived from displayed puzzle; no outcome is peeked.',rest:'Every available warning work gap chooses affordable rest. Dialogues remain uninterrupted.',menus:'Three exit menu open/cancel visits per work slot for menuspam, then ordinary balanced action. No altered stats.',career:'trainspam requests career whenever allowed and always chooses training. Other policies accept naturally offered reviews.',verification:'Every final run validRun and full replayRun exact JSON equality checked. Raw actions retained in ignored artifacts only.'},total:summary(rows),byPolicy:policies.map(policy=>({policy,...summary(rows.filter(row=>row.policy===policy))})),byRole:selectedRoles.map(role=>({roleId:role.id,...summary(rows.filter(row=>row.roleId===role.id))})),pairedAgainstBalanced:pairs,errors,rows};
writeFileSync(resolve(out,`${label}.json`),JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(out,`${label}-reproductions.json`),JSON.stringify(reproductions,null,2)+'\n');
console.log(JSON.stringify({report:resolve(out,`${label}.json`),total:report.total,byPolicy:report.byPolicy,pairedAgainstBalanced:pairs,errors:errors.length}));
if(errors.length)process.exitCode=1;
