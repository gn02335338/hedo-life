import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import * as E from '../dist/engine.js';
import {directEntryV60} from '../dist/recruitment-v60.js';
import {ENDINGS} from '../dist/endings.js';
import {characterAffinity,deriveCharacterStats} from '../dist/character-stats.js';
import {PATRONAGE_EXCLUDED_DAILY_IDS_V67} from '../dist/patronage-benefits-v67.js';

export const PLAYER_AUDIT_METHOD_V68='Four non-oracle policies play the same seed-derived direct appointment worlds. The selector sees only current text, available controls and currently visible stats; no choice result, delta, check, draw, engine RNG, state injection or branch preview is used. Exactly one public operation is committed after each decision. These deterministic policy samples are not human-population probabilities. Completion, early departure, day-20 fantasy entry and major company success are reported separately.';
export const PLAYER_POLICIES_V68=Object.freeze(['random','careful','authority','reckless']);
const sourceSnapshotV68=()=>Object.fromEntries(readdirSync(new URL('../dist/',import.meta.url)).filter(name=>name.endsWith('.js')).sort().map(name=>[name,createHash('sha256').update(readFileSync(new URL(`../dist/${name}`,import.meta.url))).digest('hex')]));
const loadedSourceSha256=sourceSnapshotV68();
const policyNotes={
 random:'Accept the special job, then uniformly choose available narrative replies. At a warning gap, randomly rest or continue; activity invitations and minigames are also random. No optional aggression or authority interruption.',
 careful:'Accept the special job, favour clear scope/evidence in the currently visible text, reserve living money, rest when warned, avoid loans and voluntary early departure, and attempt a company plan at the final presentation. Mini-game inputs use the displayed instructions, never hidden scores.',
 authority:'The careful policy plus one available special-title reply each work turn, addressed to a randomly selected person actually present. Private/rival reactions are not prefiltered or predicted.',
 reckless:'Accept the special job, choose high-cost/all-in purchases when visible, spend on the expensive rest package, and frequently initiate an available insult or hit. Those decisions keep their actual randomly generated consequences.'
};
const majorCompanyFamilies=new Set(['nasdaq','taiwan','acquired','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark']);
const companyPlanFamilies=new Set([...majorCompanyFamilies,'nasdaq_failed','taiwan_failed','company_closed','company_stagnation','company_taiwan_exit','company_wage_arrears','company_shell_brand','company_restructured']);
const endingMap=new Map(ENDINGS.map(row=>[row.id,row]));
const average=(rows,key)=>rows.length?Math.round(rows.reduce((sum,row)=>sum+(row[key]||0),0)/rows.length*100)/100:0;
const percent=(n,total)=>total?Math.round(n/total*1000)/10:0;
const seedFor=(gender,index,profile)=>`e39-r${profile}-${gender==='male'?'s':'d'}-`+createHash('sha256').update(`nonoracle-patronage68:${gender}:${index}`).digest('hex').slice(0,22);
function policyRandom(policy,gender,index){
 let state=parseInt(createHash('sha256').update(`policy68:${policy}:${gender}:${index}`).digest('hex').slice(0,8),16)||1;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
}
const randomItem=(rows,rng)=>rows[Math.floor(rng()*rows.length)];
const available=view=>view.choices.filter(row=>row.available);

// The decision boundary deliberately strips every hidden outcome field.
// Even a future change to getEvent's metadata cannot leak a result to policy.
export function visibleViewV68(run,event){
 return Object.freeze({id:event.id,kind:event.kind,title:event.title||'',body:event.body||'',spoken:event.wing||'',speaker:event.speaker||null,
  stats:Object.freeze({...run.stats}),choices:Object.freeze(event.choices.map((choice,index)=>Object.freeze({index,text:choice.text||'',available:choice.available!==false}))) });
}

export function advancePlayerV68(run){
 const navigation=['mealOpen','mealPage','mealCancel'].includes(run.pendingEffect)&&!run.pendingFamily;
 const skip=run.treatsContext||run.departureContext||run.blockchainContext||navigation;
 let next=E.advance(run);
 if(!skip&&!next.completed){
  next=E.requestSalaryAdvice(next);next=E.enableActivitySchedule(next);
  if(E.canRequestActivityInvitation(next))next=E.requestActivityInvitation(next);
  next=E.requestHiddenEncounter(next);
 }
 return next;
}
const spendCost=choice=>Number(/花費\s*(\d+)\s*存款/.exec(choice.text)?.[1]||0);
const pickText=(choices,pattern)=>choices.find(choice=>pattern.test(choice.text));
function sensibleChoice(view,rng){
 const choices=available(view);
 if(view.id==='work-gap-v50')return choices[0];
 if(view.id==='self-care'){
  const {cash,mood,energy}=view.stats,paid=choices.filter(choice=>spendCost(choice)>0&&cash-spendCost(choice)>=8);
  const weekend=pickText(paid,/一整個週末/),sleep=pickText(paid,/沒人叫醒的覺/),drink=pickText(paid,/飲料/);
  if(mood<=30&&energy<=30&&weekend&&cash>=45)return weekend;
  if(energy<=30&&sleep)return sleep;
  if(mood<=30&&drink)return drink;
  return pickText(choices,/先把錢留著|先不花|回去處理/)||choices.at(-1);
 }
 if(view.id==='kind-break'||view.id==='kind-workday')return pickText(choices,/先不要|不去|不跟|不想|不需要|不用|不適合|拒絕|先忙|這次不|太髒|我先回/)||choices.at(-1);
 if(view.id==='shareholder58-offer')return pickText(choices,/先不認股/)||choices[0];
 if(/^meal-guests-/.test(view.id))return pickText(choices,/取消|自己休息|回去|先不約/)||choices.at(-1);
 if(view.id==='finale')return randomItem(choices.filter(choice=>/掛牌計畫|買方名單|越南團隊/.test(choice.text)),rng)||choices[0];
 if(view.kind==='company')return randomItem(choices.filter(choice=>!/先回簡報桌/.test(choice.text)),rng)||choices[0];
 if(view.id==='chapter-resolution')return pickText(choices,/繼續上班/)||choices[0];
 if(view.id==='mood-collapse')return pickText(choices,/花.*存款|休整|休養/)||pickText(choices,/無薪假/)||choices[0];
 if(view.id==='mood-self-destruct')return pickText(choices,/休整|休養|無薪假/)||choices[0];
 if(['rank-exit','career-exit','story-exit','exit-menu'].includes(view.id))return choices[0];
 let scored=choices.map(choice=>{
  const text=choice.text;
  let score=0;
  if(/核對|確認|寫清楚|說清楚|具體|範圍|分清|紀錄|依據|交付|對齊|實際|補件|限制|責任|先講|留一份/.test(text))score+=3;
  if(/離職|離開這份|今天就到|今天就走|現在就走|先走|不做了|立刻走|回去重新考慮|我今天就離開/.test(text))score-=15;
  if(/全押|all in|信貸|整包接|先答應|照單全收|無條件|全部先|全都可以/.test(text))score-=8;
  if(/先回.*工作|先回座位|先回去|繼續上班/.test(text))score+=1;
  if(/不保證|不代簽|沒有確認|不要承諾|先不答應|先不認/.test(text))score+=2;
  return {choice,score,tie:rng()};
 });
 scored.sort((a,b)=>b.score-a.score||a.tie-b.tie);return scored[0]?.choice;
}
function recklessChoice(view,rng){
 const choices=available(view);
 if(view.id==='self-care')return [...choices].filter(choice=>spendCost(choice)>0).sort((a,b)=>spendCost(b)-spendCost(a))[0]||pickText(choices,/先把錢留著|先不花|回去處理/)||choices.at(-1);
 const expensive=pickText(choices,/all in|全押|信貸|全部.*錢|認購加碼|跟去|暗黑|硬切|衝進|直接簽|全.*答應/);
 if(expensive)return expensive;
 if(view.id==='finale')return randomItem(choices.filter(choice=>/掛牌計畫|買方名單|越南團隊/.test(choice.text)),rng)||randomItem(choices,rng);
 if(view.kind==='company')return randomItem(choices.filter(choice=>!/先回簡報桌/.test(choice.text)),rng)||randomItem(choices,rng);
 return randomItem(choices,rng);
}

// Inputs are chosen from instructions currently shown by the mini-game.
// The driver never calls a scoring, resolution or outcome helper to compare.
function activityInput(play,policy,rng){
 const sensible=policy==='careful'||policy==='authority',id=play.id;
 if(id==='arm')return {kind:id,mode:'steady',taps:play.steadyTimes.map(n=>Math.max(0,Math.min(8000,n+Math.floor((rng()-.5)*(sensible?300:900))))).sort((a,b)=>a-b)};
 if(id==='banquet')return {kind:id,beats:[...new Set(play.beatTimes.map(n=>Math.max(0,Math.min(7800,n+Math.floor((rng()-.5)*(sensible?350:900))))))].sort((a,b)=>a-b)};
 if(id==='diet')return {kind:id,days:Array.from({length:7},(_,i)=>({meal:sensible?i%2:Math.floor(rng()*3),exercise:sensible?i%3:Math.floor(rng()*3)}))};
 if(id==='dinner')return {kind:id,plates:sensible?[0,1,2,0,1,1]:Array.from({length:6},()=>Math.floor(rng()*4))};
 if(id==='roadshow')return {kind:id,matches:play.cards.map(card=>sensible?/聯絡|名片|誰能約|下一次討論/.test(card)?2:/限制|沒.*測|範圍|全面上線/.test(card)?1:0:Math.floor(rng()*3))};
 if(id==='review')return {kind:id,evidence:play.cards.map(card=>sensible?/合法|授權|同意/.test(card)?1:/經費|人力|工時/.test(card)?2:0:Math.floor(rng()*3))};
 if(id==='basketball')return {kind:id,moves:play.cards.map(card=>policy==='reckless'?1:sensible?/外線|外圍/.test(card)?2:/眼前出現空檔/.test(card)?1:0:Math.floor(rng()*3))};
 if(id==='camel'){
  const prediction=play.prediction||[0,1,2].map(value=>({value,tie:rng()})).sort((a,b)=>a.tie-b.tie).map(row=>row.value);
  const leader=[...play.board].sort((a,b)=>b.position-a.position)[0]?.stack.at(-1)||0;
  return {kind:id,prediction,move:sensible&&rng()<.6?leader:Math.floor(rng()*3)};
 }
 throw new Error(`Missing visible-input policy for ${id}`);
}

function selectDecision(run,view,policy,rng){
 if(view.id==='onboarding')return {type:'choice',index:0,reason:'accept the offered special appointment'};
 if(E.isWorkGapOpenV50(run)){
  const warning=run.stats.energy<=30||run.stats.mood<=30;
  if(E.canRequestBreak(run)&&warning&&(policy!=='random'||rng()<.5))return {type:'break',reason:'visible warning interval'};
 }
 if(policy==='authority'&&E.canRequestPatronageReply(run))return {type:'authority',target:randomItem(E.getPatronageReplyTargets(run),rng),reason:'use the currently available special-title reply'};
 if(policy==='reckless'){
  if(E.canRequestVerbal(run)&&rng()<.3)return {type:'verbal',reason:'initiate a visible insult'};
  if(E.canRequestRage(run)&&rng()<.18)return {type:'rage',reason:'choose the visible hit button'};
 }
 const play=E.getActivityPlayV55(run);
 if(play){
  if(policy==='random'&&rng()<.25&&E.getEventDepartureV63(run)?.available)return {type:'event-departure',reason:'randomly leave the displayed activity'};
  return {type:'activity-play',input:activityInput(play,policy,rng),reason:'play the displayed interactive activity'};
 }
 const shareholder=E.getShareholderPlayV58(run);
 if(shareholder){
  const open=shareholder.statements.filter(row=>!row.pressed);
  if(policy==='reckless'&&shareholder.evidence.length)return {type:'shareholder-play',input:{mode:'present',statement:Math.floor(rng()*3),evidence:randomItem(shareholder.evidence,rng).id},reason:'guess an evidence objection'};
  if(open.length&&rng()<.3)return {type:'shareholder-play',input:{mode:'press',statement:randomItem(open,rng).id,evidence:null},reason:'ask about a currently unpressed statement'};
  return {type:'shareholder-play',input:{mode:'yield',statement:0,evidence:null},reason:'keep the question on record'};
 }
 const choices=available(view);
 if(!choices.length)throw new Error(`No visible choices ${view.id}`);
 const choice=policy==='random'?randomItem(choices,rng):policy==='reckless'?recklessChoice(view,rng):sensibleChoice(view,rng);
 return {type:'choice',index:choice.index,reason:policy==='random'?'uniform available reply':policy==='reckless'?'spending/risk preference from current wording':'scope, evidence and self-care preference from current wording'};
}
function commitDecision(run,decision){
 if(decision.type==='break')return E.requestBreak(run);
 if(decision.type==='authority')return advancePlayerV68(E.requestPatronageReply(run,decision.target));
 if(decision.type==='verbal')return advancePlayerV68(E.requestVerbal(run,undefined,2));
 if(decision.type==='rage')return advancePlayerV68(E.requestRage(run));
 if(decision.type==='activity-play')return advancePlayerV68(E.applyActivityPlay(run,decision.input));
 if(decision.type==='shareholder-play')return advancePlayerV68(E.applyShareholderPlay(run,decision.input));
 if(decision.type==='event-departure')return advancePlayerV68(E.requestEventDepartureV63(run));
 return advancePlayerV68(E.applyChoice(run,decision.index));
}

export function simulatePlayerV68({gender='male',index=0,policy='careful',profile=67,maxDecisions=240}={}){
 if(!['male','female'].includes(gender)||!PLAYER_POLICIES_V68.includes(policy)||![67,68,69].includes(profile))throw new Error('Invalid player policy/profile');
 const seed=seedFor(gender,index,profile),entry=directEntryV60(seed),rng=policyRandom(policy,gender,index);
 if(!entry)throw new Error(`The r${profile} direct-entry cohort is not enabled`);
 let run=E.enableActivitySchedule(E.createRun(entry.roleId,seed)),work=0,reachedFantasy=false,steps=0;
 const decisions=[],authority=[],workIds=new Set();
 for(;steps<maxDecisions&&!run.completed&&run.actions.length<286;steps++){
  if(run.pending){run=advancePlayerV68(run);continue;}
  const event=E.getEvent(run),view=visibleViewV68(run,event);
  if(E.getEvent(run,true)?.kind==='fantasy'&&run.turn>=20)reachedFantasy=true;
  const decision=selectDecision(run,view,policy,rng),before=run;
  run=commitDecision(run,decision);
  if(run===before)throw new Error(`Unavailable chosen control ${seed}/${view.id}/${decision.type}`);
  const added=run.history.slice(before.history.length);
  const row=added.at(-1);
  if(row&&['daily','fantasy'].includes(row.kind)&&!row.verbalOutcome&&row.departureOutcome?.completed!==false&&run.turn===before.turn+1){
   const key=`${row.turn}:${row.eventId}`;if(!workIds.has(key)){work++;workIds.add(key);}
  }
  for(const part of added)if(part.patronageOutcome)authority.push({target:part.patronageOutcome.target,reaction:part.patronageOutcome.reaction,mode:part.patronageOutcome.mode,mood:part.delta.mood,energy:part.delta.energy,trust:part.delta.trust,affinity:part.patronageOutcome.affinityDelta,origin:part.patronageOutcome.origin});
  decisions.push({turn:before.turn,eventId:view.id,type:decision.type,...(decision.type==='choice'?{index:decision.index,text:view.choices[decision.index].text}:{}),reason:decision.reason,before:{cash:before.stats.cash,mood:before.stats.mood,energy:before.stats.energy,boss:before.stats.boss},after:{cash:run.stats.cash,mood:run.stats.mood,energy:run.stats.energy,boss:run.stats.boss}});
 }
 const replay=E.replayRun(run.roleId,run.seed,run.actions);
 if(!E.validRun(run)||JSON.stringify(replay)!==JSON.stringify(run))throw new Error(`Noncanonical player life ${seed}/${policy}`);
 const ending=endingMap.get(run.endingId),post=run.patronage?run.history.slice(run.patronage.historyIndex+1):[];
 const characters=deriveCharacterStats(run),met=characters.filter(row=>row.encounters>0),affinity=Object.fromEntries(met.map(row=>[row.id,characterAffinity(run,row.id).score]));
 return {gender,index,policy,profile,roleId:run.roleId,seed,actions:run.actions,completed:run.completed,censored:!run.completed,endingId:run.endingId,endingFamily:ending?.family||null,endingType:ending?.type||null,companyPlanEnding:!!ending&&companyPlanFamilies.has(ending.family),majorCompanySuccess:!!ending&&majorCompanyFamilies.has(ending.family),majorCompanyGood:!!ending&&majorCompanyFamilies.has(ending.family)&&ending.type==='good',reachedFantasy,earlyExit:run.completed&&!reachedFantasy,badEnding:ending?.type==='bad',work,turn:run.turn,pay:run.pay,cash:run.stats.cash,mood:run.stats.mood,energy:run.stats.energy,pipCount:run.pipCount||0,pipFailed:ending?.family==='pip_fail',cashFailure:ending?.family==='broke',collapses:run.flags.mood_crash_count||0,breaks:run.actions.filter(row=>row.type==='break').length,cashSpent:run.flags.cash_spent_total||0,oldPersonalReviewIds:post.filter(row=>['education-review','education-scrutiny','salary-cut','salary-final',...PATRONAGE_EXCLUDED_DAILY_IDS_V67].includes(row.eventId)).map(row=>row.eventId),charactersMet:met.length,meanMetAffinity:met.length?Object.values(affinity).reduce((n,v)=>n+v,0)/met.length:50,lowAffinityCharacters:Object.values(affinity).filter(v=>v<=20).length,wingAffinity:characterAffinity(run,'wing').score,rickAffinity:characterAffinity(run,'rick').score,princessAffinity:characterAffinity(run,'princess').score,affinity,authority,decisions};
}

export function summarisePlayerV68(rows){
 const total=rows.length,count=key=>rows.filter(row=>row[key]).length,replies=rows.flatMap(row=>row.authority),reactions=Object.fromEntries(['obliged','retort','reported','welcomed'].map(id=>[id,replies.filter(row=>row.reaction===id).length]));
 const stats={lives:total,completed:count('completed'),censored:count('censored'),averageWork:average(rows,'work'),reachedFantasy:count('reachedFantasy'),reachedFantasyPercent:percent(count('reachedFantasy'),total),companyPlanEndings:count('companyPlanEnding'),majorCompanySuccess:count('majorCompanySuccess'),majorCompanyGood:count('majorCompanyGood'),majorCompanyGoodPercent:percent(count('majorCompanyGood'),total),earlyExit:count('earlyExit'),badEndings:count('badEnding'),pipLives:rows.filter(row=>row.pipCount>0).length,pipFailures:count('pipFailed'),cashFailures:count('cashFailure'),collapseLives:rows.filter(row=>row.collapses>0).length,totalCollapses:rows.reduce((n,row)=>n+row.collapses,0),averageBreaks:average(rows,'breaks'),averageCash:average(rows,'cash'),averageMood:average(rows,'mood'),averageEnergy:average(rows,'energy'),averagePay:average(rows,'pay'),averageCharactersMet:average(rows,'charactersMet'),averageMetAffinity:average(rows,'meanMetAffinity'),averageLowAffinityCharacters:average(rows,'lowAffinityCharacters'),averageWingAffinity:average(rows,'wingAffinity'),averageRickAffinity:average(rows,'rickAffinity'),averagePrincessAffinity:average(rows,'princessAffinity'),oldPersonalReviews:rows.reduce((n,row)=>n+row.oldPersonalReviewIds.length,0),authority:{replies:replies.length,reactions,cooperativePercent:percent(reactions.obliged+reactions.welcomed,replies.length),averageMood:average(replies,'mood'),averageEnergy:average(replies,'energy'),averageTrust:average(replies,'trust'),averageAffinity:average(replies,'affinity')},roleCounts:Object.fromEntries([...new Set(rows.map(row=>row.roleId))].sort().map(id=>[id,rows.filter(row=>row.roleId===id).length])),endingFamilies:Object.fromEntries([...new Set(rows.map(row=>row.endingFamily||'censored'))].sort().map(id=>[id,rows.filter(row=>(row.endingFamily||'censored')===id).length]))};
 return stats;
}

export function auditPlayersV68({samples=50,profile=67,onProgress=()=>{}}={}){
 const rows=[];
 for(const gender of ['male','female'])for(const policy of PLAYER_POLICIES_V68){
  for(let index=0;index<samples;index++)rows.push(simulatePlayerV68({gender,index,policy,profile}));
  onProgress({gender,policy,...summarisePlayerV68(rows.filter(row=>row.gender===gender&&row.policy===policy))});
 }
 const sourceChangedDuringAudit=JSON.stringify(loadedSourceSha256)!==JSON.stringify(sourceSnapshotV68());
 return {method:PLAYER_AUDIT_METHOD_V68,strategyVersion:2,profile:`e39-r${profile}-[sd]`,samplesPerGenderPolicy:samples,pairedInitialWorlds:samples*2,crossCohortCaveat:'The gender/index/entropy cells match across r67 and r68, but the new seed string naturally changes engine RNG, generated stats and professional record. Only the four policies within a single cohort share an identical initial world; do not describe cohort comparisons as matched RNG trials.',policyNotes,sourceSha256:loadedSourceSha256,sourceChangedDuringAudit,total:summarisePlayerV68(rows),byPolicy:Object.fromEntries(PLAYER_POLICIES_V68.map(policy=>[policy,summarisePlayerV68(rows.filter(row=>row.policy===policy))])),byGenderPolicy:Object.fromEntries(['male','female'].flatMap(gender=>PLAYER_POLICIES_V68.map(policy=>[`${gender}:${policy}`,summarisePlayerV68(rows.filter(row=>row.gender===gender&&row.policy===policy))]))),routes:rows};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=(name,fallback)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3)||fallback;
 const output=arg('output','artifacts/patronage-player-v68.json'),samples=Number(arg('samples','50')),profile=Number(arg('profile','67'));
 if(!Number.isSafeInteger(samples)||samples<1)throw new Error('samples must be a positive integer');
 const report=auditPlayersV68({samples,profile,onProgress:row=>console.log(JSON.stringify(row))});
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({output,method:report.method,total:report.total,byPolicy:report.byPolicy}));
}
