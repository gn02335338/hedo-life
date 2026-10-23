import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {ROLES} from '../dist/roles.js';
const perRole=Math.max(4,Number(process.argv[2])||6),ids=['jack-drinks','company-tea','birthday-cake'],rows=[],errors=[];
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

for(const role of ROLES){
 for(let index=0;index<perRole;index++){
  const seed='e39-r61-n-'+createHash('sha256').update(`office-v61-independent-${role.id}-${index}`).digest('hex').slice(0,22);
  let run=E.enableActivitySchedule(E.createRun(role.id,seed)),steps=0,rests=0,active=null;
  const visits=new Map(),opened=[],completed=[];
  try{
   while(!run.completed&&steps++<420&&run.actions.length<285){
    if(run.pending){
     const before=run;run=E.advance(run);
     if(before.treatsContext){
      for(const key of ['turn','pay','rank','pip','pipCount'])if(JSON.stringify(run[key])!==JSON.stringify(before[key]))throw Error(`interlude changed ${key}`);
      for(const key of ['cash','energy'])if(run.stats[key]!==before.stats[key])throw Error(`interlude continuation changed ${key}`);
      if(!run.treatsContext){completed.push({id:before.treatsContext.id,turn:run.turn});active=null;}
     }
     continue;
    }
    if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
    if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
    const event=E.getEvent(run);
    if(run.activityInvitationContext){run=E.applyChoice(run,1);continue;}
    if(run.treatsContext){
     const {id,stage}=run.treatsContext;
     if(!active){
      if(opened.some(row=>row.id===id))throw Error(`repeated office story ${id}`);
      if(run.pip?.active||run.activityContext||run.activityInvitationContext||run.breakReturnEventId||E.isWorkGapOpenV50(run))throw Error('office story interrupted another flow');
      opened.push({id,turn:run.turn});active={id,stage};
     }
     if(active.id!==id)throw Error('office story context changed mid-flow');
     const before=run;run=E.applyChoice(run,0);
     for(const key of ['turn','pay','rank','pip','pipCount'])if(JSON.stringify(run[key])!==JSON.stringify(before[key]))throw Error(`office choice changed ${key}`);
     for(const key of ['cash','energy'])if(run.stats[key]!==before.stats[key])throw Error(`office choice charged ${key}`);
     continue;
    }
    if(run.shareholderContext){run=E.applyChoice(run,run.shareholderContext.stage==='offer'?2:0);continue;}
    if(E.isWorkGapOpenV50(run)){
     if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);rests++;continue;}
     run=E.applyChoice(run,0);continue;
    }
    visits.set(event.id,(visits.get(event.id)||0)+1);run=E.applyChoice(run,choose(run,'balanced',visits));
   }
   if(run.pending)run=E.advance(run);
   if(!run.completed)throw Error('life did not finish within the action budget');
   if(!E.validRun(run))throw Error('invalid canonical final state');
   if(JSON.stringify(E.replayRun(role.id,seed,run.actions))!==JSON.stringify(run))throw Error('final exact replay mismatch');
   rows.push({roleId:role.id,index,seed,opened,completed,storyCount:completed.length,rests,turns:run.turn,actions:run.actions.length,endingId:run.endingId,companyTeaCancelled:!!run.flags.treats61_company_tea_cancelled});
  }catch(error){errors.push({roleId:role.id,index,seed,message:error.message,lastEvent:run.eventId,actions:run.actions});}
 }
 console.log(JSON.stringify({roleId:role.id,runs:rows.filter(row=>row.roleId===role.id).length,stories:Object.fromEntries(ids.map(id=>[id,rows.filter(row=>row.roleId===role.id&&row.completed.some(item=>item.id===id)).length])),errors:errors.filter(row=>row.roleId===role.id).length}));
}
const byRole=ROLES.map(role=>({roleId:role.id,runs:rows.filter(row=>row.roleId===role.id).length,stories:Object.fromEntries(ids.map(id=>[id,rows.filter(row=>row.roleId===role.id&&row.completed.some(item=>item.id===id)).length]))}));
const report={method:'13 requested jobs × independent fresh r61 normal profiles, real canonical createRun and public actions. Work choices use only visible text/availability/current stats. All office stories choose their first response; warning gaps use affordable rest; other calendar activities are declined to isolate interlude timing. No outcome preview or state injection. Checks every interlude for cash/energy/pay/rank/day/PIP conservation, repeated stories and interrupted activities/rest/PIP. Each complete life passes validRun and exact replay.',runs:rows.length,byRole,totals:Object.fromEntries(ids.map(id=>[id,rows.filter(row=>row.completed.some(item=>item.id===id)).length])),rows,errors};
mkdirSync(new URL('../artifacts/',import.meta.url),{recursive:true});writeFileSync(new URL('../artifacts/v61-office-treats-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));if(errors.length)process.exitCode=1;
