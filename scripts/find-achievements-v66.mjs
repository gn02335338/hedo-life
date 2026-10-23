import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';
import{isActivityPlayV55}from'../dist/activity-play-v55.js';
import {ACHIEVEMENT_RULES_V66,deriveAchievementsV66} from '../dist/achievements-v66.js';
const catalog=ACHIEVEMENT_RULES_V66,story=catalog.filter(s=>['character','profession'].includes(s.kind)),wanted=new Map();
for(const spec of story)if(!wanted.has(spec.eventId))wanted.set(spec.eventId,spec);
const candidates=[],seen=new Set();
function visit(x,file){if(!x||typeof x!=='object')return;if(x.roleId&&typeof x.seed==='string'){for(const [field,actions]of Object.entries(x))if((field==='actions'||field.endsWith('Actions'))&&Array.isArray(actions)&&actions.every(a=>a&&typeof a.type==='string')){const key=createHash('sha256').update(x.roleId+x.seed+JSON.stringify(actions)).digest('hex');if(!seen.has(key)){seen.add(key);candidates.push({roleId:x.roleId,seed:x.seed,actions,file});}}return;}for(const v of Object.values(x))if(v&&typeof v==='object')visit(v,file);}
for(const file of readdirSync(new URL('../tests/fixtures/',import.meta.url)).filter(f=>f.endsWith('.json')&&f!=='achievement-milestones-v66.json'))try{visit(JSON.parse(readFileSync(new URL('../tests/fixtures/'+file,import.meta.url))),file);}catch{}
visit(JSON.parse(readFileSync(new URL('../research/reachability-v3.json',import.meta.url))),'reachability-v3');
const sources=new Map([...wanted.keys()].map(id=>[id,[]]));
for(const row of candidates)for(const [index,a]of row.actions.entries())if(a.type==='choice'&&sources.has(a.eventId)){const spec=wanted.get(a.eventId);if(spec.kind==='profession'&&spec.owner!==row.roleId)continue;const list=sources.get(a.eventId);list.push({...row,actions:row.actions.slice(0,index)});list.sort((a,b)=>a.actions.length-b.actions.length);if(list.length>20)list.length=20;}
// Current cast fixtures are unresolved public event prefixes, so their own
// event ID need not already occur as a choice in the transcript.
const currentCast=JSON.parse(readFileSync(new URL('../tests/fixtures/cast-v66.json',import.meta.url))).routes;
for(const [eventId,rows]of sources){const direct=currentCast.find(row=>row.id===eventId);if(direct)rows.unshift({...direct,file:'cast-v66-source'});}
const proofs=new Map(),covered=new Map();
function save(run,tag){const earned=deriveAchievementsV66(run);if(!earned.length)return;const key=createHash('sha256').update(run.roleId+run.seed+JSON.stringify(run.actions)).digest('hex');let needed=false;for(const id of earned){const prior=covered.get(id);if(!prior||prior.actions.length>run.actions.length){covered.set(id,{key,actions:run.actions});needed=true;}}if(needed)proofs.set(key,{id:tag,roleId:run.roleId,seed:run.seed,actions:run.actions,expected:earned});}
const sourceProofs=[],actorSources=new Map();
for(const [eventId,rows]of sources){const spec=wanted.get(eventId);for(const row of rows){try{const run=E.replayRun(row.roleId,row.seed,row.actions);if(run.pending||run.completed||E.isWorkGapOpenV50(run)||E.getEvent(run).id!==eventId||spec.kind==='profession'&&run.actualRoleId!==spec.owner)continue;sourceProofs.push({eventId,roleId:row.roleId,seed:row.seed,actions:row.actions});for(const index of [0,1,2])save(E.advance(E.applyChoice(run,index)),`${eventId}-${index}`);break;}catch{}}}
const sourceDone=new Set(sourceProofs.map(s=>s.eventId));
console.log(JSON.stringify({candidates:candidates.length,storySources:sourceProofs.length,storySourcesMissing:[...wanted.keys()].filter(id=>!sourceProofs.some(s=>s.eventId===id)),coverage:covered.size}));
const ordered=candidates.filter(row=>/achievement|rage|mood|salary|loan|departure|pip|meal|expansion|activity-play|routes-v58|v62|office-treats/.test(row.file)).sort((a,b)=>b.actions.length-a.actions.length);
for(const [i,row]of ordered.slice(0,Number(process.argv[2]||1800)).entries()){try{save(E.replayRun(row.roleId,row.seed,row.actions),`${row.file}-${i}`);}catch{}if(i%300===0)console.log(JSON.stringify({scan:i,coverage:covered.size}));}
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const options=run=>(E.getEvent(run).choices||[]).map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
const health=run=>run.completed?-10000:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.7+Math.min(run.stats.boss,65)*.8+run.stats.trust*.2-(run.pip?.active?50:0);
const inputs={diet:{kind:'diet',days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:[2,5].includes(i)?2:i%2}))},arm:{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)},roadshow:{kind:'roadshow',matches:[0,1,2,1,0,2]},dinner:{kind:'dinner',plates:[0,1,2,0,1,1]},banquet:{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)},basketball:{kind:'basketball',moves:[0,2,1,2,0]},review:{kind:'review',evidence:[0,1,2,0]}};
function progress(run){
 if(run.pending)return E.advance(run);
 if(E.isWorkGapOpenV50(run)){if(E.canRequestBreak(run)&&run.stats.cash>=12)return E.requestBreak(run);return E.applyChoice(run,0);}
 const play=E.getActivityPlayV55(run);if(play)return E.advance(E.applyActivityPlay(run,play.id==='camel'?{kind:'camel',move:0,prediction:play.prediction||[0,1,2]}:inputs[play.id]));
 const share=E.getShareholderPlayV58(run);if(share)return E.advance(E.applyShareholderPlay(run,{mode:'yield',statement:0,evidence:null}));
 if(run.activityInvitationContext)return choose(run,1);
 let list=options(run);if(E.getEvent(run).id==='self-care')list=list.filter(row=>row.choice.effect==='finishBreak');
 if(E.getEvent(run).id==='shareholder58-offer')list=list.filter(row=>row.index===2);
 const choices=list.map(row=>{try{return{...row,after:choose(run,row.index)}}catch{return null}}).filter(Boolean);if(!choices.length)return run;
 return choices.sort((a,b)=>health(b.after)-health(a.after))[0].after;
}
// Continue already natural meals, dreams and encounters through an actual
// next work choice. Context is always resolved with public engine actions.
for(const row of candidates.filter(row=>row.actions.some(a=>['rage','verbal'].includes(a.type)||a.type==='choice'&&a.eventId.startsWith('meal-with-'))).sort((a,b)=>Number(!a.actions.some(x=>x.eventId?.startsWith('meal-with-')))-Number(!b.actions.some(x=>x.eventId?.startsWith('meal-with-')))).slice(0,4000)){
 try{let run=E.replayRun(row.roleId,row.seed,row.actions),oldWork=run.history.filter(h=>['daily','fantasy'].includes(h.kind)).length;
  for(let step=0;step<20&&!run.completed;step++){const next=progress(run);if(next===run)break;run=next;if(run.history.filter(h=>['daily','fantasy'].includes(h.kind)).length>oldWork){save(run,`continued-${row.file}`);break;}}
 }catch{}
}
// All six genuinely different setup/finish combinations per activity use
// the same legal invitation, not injected contexts or claimed completion.
const activitySources=new Map();
for(const row of candidates)for(const [index,a]of row.actions.entries())if(a.type==='choice'&&/^activity44-(\w+)-0$/.test(a.eventId)){const id=a.eventId.match(/^activity44-(\w+)-0$/)[1];if(id==='diet'&&!/^e39-r(?:65|66)-/.test(row.seed))continue;if(isActivityPlayV55(row.seed)&&!activitySources.has(id))activitySources.set(id,{...row,actions:row.actions.slice(0,index)});}
for(const [id,row]of activitySources)try{
 const source=E.replayRun(row.roleId,row.seed,row.actions);
 for(const setup of [0,1,2]){let play=choose(source,setup);for(let step=0;step<8&&E.getActivityPlayV55(play);step++)play=progress(play);
  while(!play.completed&&play.activityContext&&E.getEvent(play).id!==`activity44-${id}-${id==='banquet'?3:2}`)play=choose(play,0);
  for(const finish of [0,1,2])save(choose(play,finish),`activity-${id}-${setup}-${finish}`);
 }
}catch(e){console.log('activity',id,e.message);}
// Search bounded fresh r65 lives for selected cast stories absent from old
// fixtures. The frozen older deck makes the search reproducible after r66.
for(let attempt=0;attempt<Number(process.argv[3]||36)&&sourceDone.size<wanted.size;attempt++){
 for(const role of ['system','project','bd','sales','design','admin','ai','hr','mis','product','finance','accounting','executive']){
  let run=E.enableActivitySchedule(E.createRun(role,'e39-r65-n-'+createHash('sha256').update(`achievement66-${role}-${attempt}`).digest('hex').slice(0,22)));
  for(let step=0;step<145&&!run.completed&&run.actions.length<270;step++){
   const current=E.getEvent(run),eventId=current.id,spec=wanted.get(eventId);
   if(current.kind==='daily'&&!E.isWorkGapOpenV50(run)&&!run.pending&&run.turn<15){const person=current.speaker||'wing',list=actorSources.get(person)||[];if(list.length<8&&!list.some(row=>row.seed===run.seed)){list.push({roleId:run.roleId,seed:run.seed,actions:run.actions});actorSources.set(person,list);}}
   if(spec&&!sourceDone.has(eventId)&&!E.isWorkGapOpenV50(run)&&(spec.kind!=='profession'||run.actualRoleId===spec.owner)){
    sourceDone.add(eventId);sourceProofs.push({eventId,roleId:run.roleId,seed:run.seed,actions:run.actions});for(const index of [0,1,2])save(choose(run,index),`${eventId}-${index}`);
   }
   if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
   const next=progress(run);if(next===run)break;run=next;
  }
  save(run,`fresh-${role}-${attempt}`);
 }
 console.log(JSON.stringify({fresh:attempt+1,sources:sourceDone.size,coverage:covered.size}));
}
// A public hit or spoken response is a separate committed action. Try it
// against naturally reached single speakers, then resolve the actual aftermath.
for(const source of sourceProofs){
 if(!/^e(?:1[89]|2[0-9]|3[0-9])-/.test(source.seed))continue;
 const base=E.replayRun(source.roleId,source.seed,source.actions),states=[base,...[0,1,2].map(i=>E.applyChoice(base,i))];
 for(const state of states)for(const kind of ['rage','verbal'])try{
  const attempted=kind==='rage'?E.requestRage(state):E.requestVerbal(state,undefined,2);if(attempted===state)continue;
  let run=E.advance(attempted);if(kind==='rage'&&run.rageContext?.mode==='real'&&E.getEventDepartureV63(run).available)run=E.advance(E.requestEventDepartureV63(run));let oldWork=run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length;
  for(let step=0;step<25&&!run.completed;step++){const next=progress(run);if(next===run)break;run=next;if(run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length>oldWork){save(run,`${kind}-continued-${source.eventId}`);break;}}
 }catch{}
}
// Targeted continuations exercise menus and missed-work consequences that
// do not appear in ordinary ending witnesses.
for(const source of sourceProofs.filter(row=>/^e39-r(?:63|65|66)-/.test(row.seed))){try{
 let run=E.replayRun(source.roleId,source.seed,source.actions);if(run.stats.boss<35)continue;
 const career=E.requestCareer(run);if(career!==run&&E.getEventDepartureV63(career).available)run=E.advance(E.requestEventDepartureV63(career));
 for(let missed=0;missed<2;missed++){
  for(let step=0;step<6&&(!['daily','fantasy'].includes(E.getEvent(run).kind)||E.isWorkGapOpenV50(run));step++)run=progress(run);
  if(!['daily','fantasy'].includes(E.getEvent(run).kind)||!E.getEventDepartureV63(run).available)break;
  run=E.advance(E.requestEventDepartureV63(run));save(run,'two-work-departures');
 }
 const spoken=E.requestVerbal(run,undefined,2);if(spoken!==run){run=E.advance(spoken);if(E.getEventDepartureV63(run).available){run=E.advance(E.requestEventDepartureV63(run));save(run,'different-departure-contexts');}}
}catch{}}
const expansion=JSON.parse(readFileSync(new URL('../tests/fixtures/expansion-v65.json',import.meta.url)));
const blockchain=expansion.routes.find(row=>row.id==='blockchain-2');if(blockchain){const run=E.replayRun(blockchain.roleId,blockchain.seed,blockchain.actions);save(E.advance(E.requestEventDepartureV63(run)),'blockchain-file-departure');}
const mealSources=new Map();
for(const row of candidates)if(/^e39-/.test(row.seed))for(const [index,a]of row.actions.entries())if(a.type==='choice'&&a.eventId==='meal-guests-d'&&!mealSources.has(row.seed))mealSources.set(row.seed,{...row,actions:row.actions.slice(0,index)});
for(const row of [...mealSources.values()].slice(0,160))try{
 let page=E.replayRun(row.roleId,row.seed,row.actions);const first=E.getEvent(page).choices.findIndex(c=>c.effect==='mealPage'&&c.mealPage===0);page=choose(page,first);
 for(let n=1;n<=2;n++){const index=E.getEvent(page).choices.findIndex(c=>c.effect==='mealPage'&&c.mealPage===n);page=choose(page,index);}
 for(const person of ['annie_yu','joyce','janet','captain']){
  const index=E.getEvent(page).choices.findIndex(c=>c.mealTarget===person&&c.available!==false);if(index<0)continue;const invited=choose(page,index);if(E.getEvent(invited).id!==`meal-with-${person}`)continue;
  for(const reply of [0,1]){let run=choose(invited,reply),work=run.history.filter(h=>['daily','fantasy'].includes(h.kind)).length;for(let step=0;step<20&&!run.completed;step++){run=progress(run);if(run.history.filter(h=>['daily','fantasy'].includes(h.kind)).length>work){save(run,'meal-cast-followup');break;}}}
 }
}catch{}
const careerSeen=new Set(),pipSeen=new Set();
for(const row of candidates)for(const [index,a]of row.actions.entries()){
 if(a.type!=='choice')continue;
 if(a.eventId==='career-review'&&['hr','executive'].includes(row.roleId)&&!covered.has(`step-${row.roleId}`))try{
  const key=row.seed+'/'+index;if(careerSeen.has(key))continue;careerSeen.add(key);const run=E.replayRun(row.roleId,row.seed,row.actions.slice(0,index));for(const choice of [0,1])if(E.getEvent(run).choices[choice]?.available!==false)save(choose(run,choice),'role-promotion');
 }catch{}
 if(['crisis-boss','paperwork'].includes(a.eventId)&&a.index===2&&/^e39-r(?:63|65|66)-/.test(row.seed))try{
  const key=row.seed+'/'+index;if(pipSeen.has(key))continue;pipSeen.add(key);const start=E.replayRun(row.roleId,row.seed,row.actions.slice(0,index+1));if(!start.pip?.active)continue;
  for(const misses of [1,2]){let run=start,done=0;
   for(let step=0;step<24&&run.pip?.active&&run.pip.remaining>0&&!run.completed;step++){
    if(done<misses&&['daily','fantasy'].includes(E.getEvent(run).kind)&&E.getEventDepartureV63(run).available&&!E.isWorkGapOpenV50(run)){run=E.advance(E.requestEventDepartureV63(run));done++;}else run=progress(run);
   }
   if(E.getEvent(run).id==='pip-review')for(const answer of [0,1])save(choose(run,answer),'pip-with-absence');
  }
 }catch{}
}
for(const proof of [...proofs.values()].filter(row=>row.actions.some(a=>a.type==='choice'&&/^salary-/.test(a.eventId)&&a.index===0)).slice(0,150))try{
 let run=E.replayRun(proof.roleId,proof.seed,proof.actions);for(let step=0;step<12&&!run.completed;step++){
  if(E.canRequestBreak(run)){const care=E.requestBreak(run);if(E.getEvent(care).id==='self-care'&&E.getEvent(care).choices[3]?.available!==false){save(choose(care,3),'backup-after-cut');break;}}
  run=progress(run);
 }
}catch{}
function inviteMeal(run,person){
 for(let step=0;step<32&&!run.completed;step++){
  if(E.canRequestBreak(run)){
   let menu=E.requestBreak(run),open=E.getEvent(menu).choices.findIndex(c=>c.effect==='mealOpen');if(open<0)return null;menu=choose(menu,open);
   for(let page=0;page<4;page++){
    const event=E.getEvent(menu),pick=event.choices.findIndex(c=>c.mealTarget===person&&c.available!==false);
    if(pick>=0){const invited=choose(menu,pick);return E.getEvent(invited).id===`meal-with-${person}`?invited:null;}
    const next=event.choices.findIndex(c=>c.effect==='mealPage'&&c.mealPage===page+1);if(next<0)return null;menu=choose(menu,next);
   }return null;
  }
  const next=progress(run);if(next===run)return null;run=next;
 }return null;
}
for(const [person,sources]of actorSources){
 for(const source of sources){if(covered.has(`ties-${person.replaceAll('_','-')}-three-stories`))break;
  const base=E.replayRun(source.roleId,source.seed,source.actions);
  for(const reply of [0,1,2])try{
   let run=E.applyChoice(base,reply),attempt=E.requestRage(run);if(attempt===run)continue;run=E.advance(attempt);
   if(run.rageContext?.mode==='real'&&E.getEventDepartureV63(run).available)run=E.advance(E.requestEventDepartureV63(run));
   const invited=inviteMeal(run,person);if(!invited)continue;
   for(const answer of [0,1]){let meal=choose(invited,answer);save(meal,'work-table-and-outburst');let work=meal.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length;
    for(let step=0;step<12&&!meal.completed;step++){meal=progress(meal);if(meal.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length>work){save(meal,'table-and-next-work');break;}}
   }
  }catch{}
 }
}
// A loan may be paid off later; the meal goal reads its historical balance,
// so the souvenir remains earned after the last instalment.
const loans=JSON.parse(readFileSync(new URL('../tests/fixtures/shareholder-all-in-v62.json',import.meta.url))).routes;
for(const source of loans.filter(row=>['first-payment','second-payment','paid-off'].includes(row.id)))try{
 const base=E.replayRun(source.roleId,source.seed,source.actions);
 for(const person of ['jack','sonny','kind']){const invited=inviteMeal(base,person);if(invited)for(const answer of [0,1])save(choose(invited,answer),'loan-dinner');}
 const raise=E.requestRaise(base);if(raise!==base){let run=raise;for(let step=0;step<5&&!run.completed&&run.raiseContext;step++)run=progress(run);save(run,'stock-and-real-raise');}
}catch{}
for(const [person,sources]of actorSources){
 if(covered.has(`ties-${person.replaceAll('_','-')}-real-work`))continue;
 for(const source of sources){if(covered.has(`ties-${person.replaceAll('_','-')}-real-work`))break;const base=E.replayRun(source.roleId,source.seed,source.actions);
  for(const state of [base,...[0,1,2].map(index=>E.applyChoice(base,index))])try{
   const attempt=E.requestRage(state);if(attempt===state||attempt.rageContext?.mode!=='real')continue;let run=E.advance(attempt);
   if(E.getEvent(run).id==='rage-aftermath')run=choose(run,0);
   if(E.getEvent(run).id==='rage-legal')run=choose(run,1);
   if(E.getEvent(run).id==='chapter-resolution'&&E.getEvent(run).choices[0]?.available!==false)run=choose(run,0);
   const old=run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length;
   for(let step=0;step<20&&!run.completed;step++){run=progress(run);if(run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length>old){save(run,'real-hit-responsibility-and-work');break;}}
  }catch{}
 }
}
function raisesFrom(base,label){
 const start=E.requestRaise(base);if(start===base)return;
 function walk(run,depth){if(run.pay>base.pay){save(run,label);return;}if(depth>4||run.completed||!run.raiseContext)return;for(const {choice,index}of options(run)){if(E.getEvent(run).id==='raise-request'&&index===3)continue;try{walk(choose(run,index),depth+1);}catch{}}}
 walk(start,0);
}
for(const source of loans.filter(row=>['first-payment','second-payment','paid-off'].includes(row.id)))try{raisesFrom(E.replayRun(source.roleId,source.seed,source.actions),'raise-on-stock-ledger');}catch{}
const pipFollowups=new Set();
for(const row of candidates)for(const [index,a]of row.actions.entries())if(a.type==='choice'&&a.eventId==='pip-review'&&/^e(?:2[0-9]|3[0-9])-/.test(row.seed)&&!pipFollowups.has(row.seed))try{
 let run=E.replayRun(row.roleId,row.seed,row.actions.slice(0,index+1));if(!run.history.some(h=>h.eventId==='pip-review'&&h.chanceOutcome==='success'))continue;pipFollowups.add(row.seed);
 for(let step=0;step<8&&!run.completed&&!E.canRequestRaise(run);step++)run=progress(run);
 raisesFrom(run,'raise-after-pip');
 if(/^e(?:3[6-9])-/.test(run.seed))for(const person of ['jack','sonny','kind']){const invited=inviteMeal(run,person);if(invited)for(const answer of [0,1])save(choose(invited,answer),'warm-meal-after-pip');}
}catch{}
for(let attempt=0;attempt<20&&!covered.has('finance-five-expenses');attempt++)try{
 let run=choose(E.createRun('executive',`e39-ach66-expenses-${attempt}`),0);
 for(const careIndex of [0,1,2,3,6]){
  for(let step=0;step<15&&!run.completed&&!E.canRequestBreak(run);step++)run=progress(run);
  if(!E.canRequestBreak(run))break;run=E.requestBreak(run);if(E.getEvent(run).choices[careIndex]?.available===false)break;run=choose(run,careIndex);save(run,'five-actual-care-purchases');
 }
}catch{}
const keep=new Set([...covered.values()].map(v=>v.key)),routes=[...proofs].filter(([key])=>keep.has(key)).map(([key,row])=>({...row,id:`proof-${routesId(key)}`}));
function routesId(key){return key.slice(0,14);}
const missing=catalog.filter(s=>!covered.has(s.id)).map(s=>({id:s.id,kind:s.kind,eventId:s.eventId,person:s.person,goal:s.goal}));
writeFileSync(new URL('../tests/fixtures/achievement-milestones-v66.json',import.meta.url),JSON.stringify({method:'Only natural public createRun/replay inputs; branches use the actual displayed event. No injected history, statistics, flags, RNG, roles or outcomes.',sources:sourceProofs,routes,missing},null,2)+'\n');
console.log(JSON.stringify({routes:routes.length,coverage:covered.size,missing:missing.length,groups:Object.fromEntries([...new Set(catalog.map(s=>s.kind))].map(kind=>[kind,catalog.filter(s=>s.kind===kind&&covered.has(s.id)).length]))}));
