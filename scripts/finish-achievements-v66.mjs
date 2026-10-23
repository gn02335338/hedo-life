import{readFileSync,writeFileSync}from'node:fs';
import{createHash}from'node:crypto';
import*as E from'../dist/engine.js';
import{deriveAchievementsV66}from'../dist/achievements-v66.js';
const url=new URL('../tests/fixtures/achievement-milestones-v66.json',import.meta.url),fixture=JSON.parse(readFileSync(url)),missing=new Set(fixture.missing.map(row=>row.id));
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const available=run=>(E.getEvent(run).choices||[]).map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
const health=run=>run.completed?-100000:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash+Math.min(run.stats.boss,65)*.6-(run.pip?.active?40:0);
function progress(run){
 if(run.pending)return E.advance(run);if(E.isWorkGapOpenV50(run)){if(E.canRequestBreak(run)&&run.stats.cash>=12)return E.requestBreak(run);return E.applyChoice(run,0);}
 if(run.activityInvitationContext)return choose(run,1);
 let options=available(run);if(E.getEvent(run).id==='self-care')options=options.filter(row=>row.choice.effect==='finishBreak');
 if(run.shareholderContext?.stage==='offer')options=options.filter(row=>row.index===2);
 const rows=options.map(row=>{try{return{...row,after:choose(run,row.index)}}catch{return null}}).filter(Boolean);return rows.length?rows.sort((a,b)=>health(b.after)-health(a.after))[0].after:run;
}
function save(run,label){const expected=deriveAchievementsV66(run),newIds=expected.filter(id=>missing.has(id));if(!newIds.length)return false;
 for(const id of newIds)missing.delete(id);const id='proof-'+createHash('sha256').update(run.roleId+run.seed+JSON.stringify(run.actions)).digest('hex').slice(0,14);
 fixture.routes.push({id,roleId:run.roleId,seed:run.seed,actions:run.actions,expected});console.log(JSON.stringify({label,ids:newIds,remaining:[...missing]}));return true;
}
function aftermath(run){
 if(run.pending)run=E.advance(run);
 for(let step=0;step<12&&!run.completed&&(run.rageContext||run.verbalContext||run.chapterContext);step++){
  const e=E.getEvent(run);
  if(e.id==='rage-aftermath')run=choose(run,0);
  else if(e.id==='rage-legal')run=choose(run,1);
  else if(e.id==='chapter-resolution'&&e.choices[0]?.available!==false)run=choose(run,0);
  else run=progress(run);
 }return run;
}
function meal(run,person){
 for(let step=0;step<24&&!run.completed&&run.actions.length<290;step++){
  if(E.canRequestBreak(run)){
   let menu=E.requestBreak(run);if(E.getEvent(menu).id!=='self-care')menu=progress(menu);
   if(E.getEvent(menu).id!=='self-care')return null;
   const open=E.getEvent(menu).choices.findIndex(c=>c.effect==='mealOpen');if(open<0)return null;menu=choose(menu,open);
   for(let page=0;page<4;page++){
    const event=E.getEvent(menu),pick=event.choices.findIndex(c=>c.mealTarget===person&&c.available!==false);
    if(pick>=0){const invited=choose(menu,pick);return E.getEvent(invited).id===`meal-with-${person}`?invited:null;}
    const next=event.choices.findIndex(c=>c.effect==='mealPage'&&c.mealPage===page+1);if(next<0)return null;menu=choose(menu,next);
   }return null;
  }
  const next=progress(run);if(next===run)return null;run=next;
 }return null;
}
function workAfter(run,label){const count=run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length;
 for(let step=0;step<18&&!run.completed&&run.actions.length<295;step++){const next=progress(run);if(next===run)break;run=next;if(run.history.filter(h=>['daily','fantasy'].includes(h.kind)&&!h.verbalOutcome).length>count){save(run,label);return run;}}return run;
}
function scene(base){
 const person=E.getEvent(base).speaker||'wing',key=person.replaceAll('_','-');if(![...missing].some(id=>id.startsWith(`ties-${key}-`)))return;
 for(const state of [base,...available(base).slice(0,3).map(row=>E.applyChoice(base,row.index))]){
  if(person==='sam'&&missing.has('ties-sam-real-work'))try{const rage=E.requestRage(state);if(rage!==state&&rage.rageContext?.mode==='real')workAfter(aftermath(rage),'sam-real-aftermath');}catch{}
  if(!missing.has(`ties-${key}-three-stories`))continue;
  for(const kind of ['rage','verbal'])try{
   const chosen=kind==='rage'?E.requestRage(state):E.requestVerbal(state,undefined,2);if(chosen===state)continue;const after=aftermath(chosen),invited=meal(after,person);if(!invited)continue;
   for(const index of [0,1]){const paid=choose(invited,index);save(paid,`${person}-work-table-${kind}`);workAfter(paid,`${person}-table-next-work`);}
  }catch{}
 }
}
for(const source of fixture.sources.filter(row=>/^e(?:38|39)-/.test(row.seed))){try{const run=E.replayRun(source.roleId,source.seed,source.actions);scene(run);}catch{}}
for(let attempt=0;attempt<Number(process.argv[2]||100)&&missing.size;attempt++){
 for(const role of ['system','project','product','design','bd','sales','admin','accounting']){
  let run=E.createRun(role,`e39-ach66-last-${role}-${attempt}`);run=choose(run,0);
  for(const person of ['annie_yu','janet'])if(missing.has(`ties-${person.replaceAll('_','-')}-warm`))try{const invited=meal(run,person);if(invited)for(const reply of [0,1])workAfter(choose(invited,reply),`${person}-warm-paid-meal`);}catch{}
  for(let step=0;step<100&&!run.completed&&run.actions.length<250&&run.turn<19;step++){
   if(E.getEvent(run).kind==='daily'&&!E.isWorkGapOpenV50(run))scene(run);
   const next=progress(run);if(next===run)break;run=next;
  }
 }
 console.log(JSON.stringify({attempt:attempt+1,missing:[...missing]}));
}
fixture.missing=fixture.missing.filter(row=>missing.has(row.id));
writeFileSync(url,JSON.stringify(fixture,null,2)+'\n');
console.log(JSON.stringify({complete:missing.size===0,proved:750-missing.size,remaining:[...missing]}));
