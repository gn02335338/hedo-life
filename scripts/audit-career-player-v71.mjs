import {createHash} from 'node:crypto';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as E from '../dist/engine.js';
import {EVENTS} from '../dist/events.js';
import {advancePlayerV68,visibleViewV68} from './audit-patronage-player-v68.mjs';

const roles=['sales','bd','design','project','product','finance','accounting','hr','admin','executive'];
const authored=new Map(EVENTS.map(event=>[event.id,event]));
const pick=(choices,pattern)=>choices.find(choice=>pattern.test(choice.text));
const cost=choice=>Number(/花費\s*(\d+)\s*存款/.exec(choice.text)?.[1]||0);
function decide(view,decisions=[]){
 const choices=view.choices.filter(choice=>choice.available);
 if(!choices.length)throw Error(`No available player reply ${view.id}`);
 if(view.id==='onboarding')return choices[0];
 if(view.id==='work-gap-v50')return choices[0];
 if(view.id==='self-care'){
  const affordable=choices.filter(choice=>cost(choice)>0&&cost(choice)<=view.stats.cash-4);
  if(view.stats.energy<=30)return pick(affordable,/沒人叫醒的覺/)||pick(affordable,/一整個週末/)||choices.at(-1);
  if(view.stats.mood<=30)return pick(affordable,/飲料/)||pick(affordable,/沒人叫醒的覺/)||choices.at(-1);
  return pick(choices,/先把錢留著|回去處理/)||choices.at(-1);
 }
 if(view.id==='kind-break'||view.id==='kind-workday')return pick(choices,/先不要|不去|不跟|不想|不用|拒絕|先忙|這次不|我先回/)||choices.at(-1);
 if(view.kind==='activity-invitation')return choices[1]||choices[0];
 if(view.id==='shareholder58-offer')return pick(choices,/先不認股/)||choices[0];
 if(view.id==='chapter-resolution')return pick(choices,/繼續上班/)||choices[0];
 if(['rank-exit','career-exit','story-exit','exit-menu'].includes(view.id))return choices[0];
 if(/^meal-guests-/.test(view.id))return pick(choices,/先不約|取消|回去/)||choices.at(-1);
 if(view.id==='wealth-plan'||view.id==='wealth-startup'||view.id==='wealth-retire')return choices[0];
 if(view.id==='finale')return decisions.some(row=>/^company-v32-/.test(row.eventId)&&row.text?.includes('先回簡報桌'))?pick(choices,/先決定自己的人生/)||choices[0]:pick(choices,/掛牌計畫/)||choices[0];
 if(view.kind==='company')return choices.find(choice=>!/先回簡報桌/.test(choice.text))||choices[0];
 const sorted=choices.map(choice=>{
  let score=0;
  if(/核對|確認|寫清楚|說清楚|具體|範圍|分清|紀錄|依據|交付|對齊|實際|補件|限制|責任|先講|留一份/.test(choice.text))score+=3;
  if(/離職|離開這份|今天就到|今天就走|現在就走|先走|不做了|回去重新考慮|我今天就離開/.test(choice.text))score-=15;
  if(/全押|all in|信貸|整包接|先答應|照單全收|無條件|全部先/.test(choice.text))score-=8;
  return {choice,score};
 }).sort((a,b)=>b.score-a.score||a.choice.index-b.choice.index);
 return sorted[0].choice;
}
export function auditCareerPlayersV71(samples=20){
 const lives=[];
 for(const role of roles){
  let accepted=0;
  for(let attempt=0;accepted<samples&&attempt<samples*20;attempt++){
   const seed='e39-r71-n-'+createHash('sha256').update(`career71-visible-policy:${role}:${attempt}`).digest('hex').slice(0,22);
   let run=E.createRun(role,seed);if(run.actualRoleId!==role)continue;
   run=E.enableActivitySchedule(run);const decisions=[];let steps=0;
   for(;steps<240&&!run.completed&&run.actions.length<285;steps++){
    if(run.pending){run=advancePlayerV68(run);continue;}
    const event=E.getEvent(run),view=visibleViewV68(run,event);
    if(E.isWorkGapOpenV50(run)&&E.canRequestBreak(run)&&(view.stats.energy<=30||view.stats.mood<=30)){
     run=E.requestBreak(run);decisions.push({turn:run.turn,eventId:view.id,action:'break'});continue;
    }
    if(E.getActivityPlayV55(run)){
     if(!E.getEventDepartureV63(run)?.available)throw Error('Unexpected non-departable activity in work policy');
     run=advancePlayerV68(E.requestEventDepartureV63(run));decisions.push({turn:run.turn,eventId:view.id,action:'leave-activity'});continue;
    }
    const shareholder=E.getShareholderPlayV58(run);
    if(shareholder){run=advancePlayerV68(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));continue;}
    const chosen=decide(view,decisions);decisions.push({turn:run.turn,eventId:view.id,action:'choice',index:chosen.index,text:chosen.text});
    run=advancePlayerV68(E.applyChoice(run,chosen.index));
   }
   const replay=E.replayRun(run.roleId,run.seed,run.actions);
   if(!E.validRun(run)||JSON.stringify(replay)!==JSON.stringify(run))throw Error(`Noncanonical career sample ${seed}`);
   const rows=run.history.filter(row=>row.kind==='daily'&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&!row.verbalOutcome&&!row.departureOutcome&&authored.has(row.eventId));
   const ids=rows.map(row=>row.eventId),exclusive=rows.filter(row=>authored.get(row.eventId).roles?.includes(role)).length,focus=rows.filter(row=>authored.get(row.eventId).careerFocusV71).length;
   if(new Set(ids).size!==ids.length)throw Error(`Repeated work scene ${seed}`);
   lives.push({role,seed,completed:run.completed,turn:run.turn,steps,daily:rows.length,professional:exclusive,focus,aliceMet:rows.some(row=>row.speaker==='alice'),speakers:new Set(rows.map(row=>row.speaker)).size,pip:run.pipCount,breaks:decisions.filter(row=>row.action==='break').length,endingId:run.endingId,decisions,actions:run.actions});accepted++;
  }
  if(accepted!==samples)throw Error(`Insufficient naturally assigned ${role} samples`);
 }
 const summaries=roles.map(role=>{
  const rows=lives.filter(row=>row.role===role),sum=key=>rows.reduce((total,row)=>total+row[key],0),daily=sum('daily');
  return {role,lives:rows.length,canonical:rows.length,completed:rows.filter(row=>row.completed).length,meanDays:+(sum('turn')/rows.length).toFixed(2),daily,professionalPercent:daily?+(sum('professional')/daily*100).toFixed(1):0,focusPercent:daily?+(sum('focus')/daily*100).toFixed(1):0,aliceLives:rows.filter(row=>row.aliceMet).length,meanSpeakers:+(sum('speakers')/rows.length).toFixed(2),pipLives:rows.filter(row=>row.pip>0).length,meanBreaks:+(sum('breaks')/rows.length).toFixed(2)};
 });
 return {method:'Twenty natural honest/assistant-assigned lives per actual non-engineering occupation. A fixed text-and-visible-stats policy accepts the job, favours scope/evidence, declines optional activity invitations, rests at warning gaps and never reads unchosen results, deltas, checks, draws or engine RNG. No state injection. Every final transcript is canonically replayed. This describes this policy sample, not human population probabilities.',total:lives.length,canonical:lives.length,repeatedDaily:0,summaries,lives};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const report=auditCareerPlayersV71(Number(process.argv[2]||20)),output=process.argv[3]||'artifacts/career-player-v71.json';
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.table(report.summaries);console.log(JSON.stringify({output,total:report.total,canonical:report.canonical,repeatedDaily:report.repeatedDaily}));
}
