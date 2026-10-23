import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as E from '../dist/engine.js';

// Natural public-action witnesses, with no injected wallet, date, friendship,
// menu or RNG. Search may inspect alternatives only to find coverage proofs.
const routes=new Map(),copy=value=>JSON.parse(JSON.stringify(value));
const choose=(run,index)=>E.advance(E.applyChoice(run,index));
const options=run=>E.getEvent(run).choices.map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.3+Math.min(run.stats.boss,65)*.7+run.stats.trust*.2-(run.pip?.active?80:0);
const capture=(id,run,extra={})=>{if(!routes.has(id))routes.set(id,{id,roleId:run.roleId,seed:run.seed,actions:copy(run.actions),...extra});};
function next(run){
 const rows=options(run).map(row=>({...row,next:choose(run,row.index)})),id=E.getEvent(run).id;
 if(id==='kind-break')return rows.find(row=>row.choice.effect==='kindDecline')?.next;
 if(id==='kind-workday')return rows.find(row=>row.choice.effect==='kindWorkDecline')?.next;
 return rows.sort((a,b)=>score(b.next)-score(a.next))[0]?.next;
}
function thirdPage(run){
 let menu=run;
 for(let step=0;step<4&&menu.eventId!=='meal-guests-c';step++){
  const index=E.getEvent(menu).choices.findIndex(choice=>choice.effect==='mealPage'&&choice.mealPage===menu.mealContext.page+1);
  if(index<0)return null;menu=choose(menu,index);
 }
 return menu.eventId==='meal-guests-c'?menu:null;
}
const limit=Math.max(1,Number(process.argv[2])||240);
for(let attempt=0;attempt<limit;attempt++){
 const seed='e39-r62-n-'+createHash('sha256').update(`princess-dinner-${attempt}`).digest('hex').slice(0,22);
 let run=E.enableActivitySchedule(E.createRun(['system','ai','mis','bd','executive'][attempt%5],seed));
 for(let step=0;step<160&&!run.completed&&run.actions.length<260;step++){
  if(run.pending)run=E.advance(run);
  if(E.canRequestSalaryAdvice(run)){run=E.requestSalaryAdvice(run);continue;}
  if(E.canRequestActivityInvitation(run)){run=E.requestActivityInvitation(run);continue;}
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(run.treatsContext){run=choose(run,0);continue;}
  if(run.shareholderContext){run=choose(run,run.shareholderContext.stage==='offer'?2:0);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)){run=E.requestBreak(run);continue;}
   run=E.applyChoice(run,0);continue;
  }
  if(run.eventId==='self-care'){
   const open=E.getEvent(run).choices.findIndex(choice=>choice.effect==='mealOpen');
   const menu=open>=0?thirdPage(choose(run,open)):null;
   if(menu){
    const at=E.getEvent(menu).choices.findIndex(choice=>choice.mealTarget==='princess'),invite=E.getEvent(menu).choices[at];
    if(invite.available===false&&menu.stats.cash<52)capture('poor-menu',menu,{invitationIndex:at});
    if(invite.available!==false){
     capture('menu',menu,{invitationIndex:at});const invited=choose(menu,at);
     if(invited.eventId==='meal-with-princess'){
      capture('accepted',invited,{beforeActions:copy(menu.actions),index:at});
      capture('cancelled',choose(invited,2),{beforeActions:copy(invited.actions),index:2});
      for(const replyIndex of [0,1]){
       const pending=E.applyChoice(invited,replyIndex),paid=E.advance(pending),reaction=pending.history.at(-1).mealOutcome.reaction;
       capture(`paid-${replyIndex}-${reaction}`,paid,{beforeActions:copy(invited.actions),index:replyIndex});
       if(invited.stats.cash===52)capture('paid-exact-wallet',paid,{beforeActions:copy(invited.actions),index:replyIndex});
      }
      // Continue one real branch; subsequent low funds become affordability
      // witnesses rather than editing the same wallet in a test.
      run=choose(invited,0);continue;
     }
     capture('declined',invited,{beforeActions:copy(menu.actions),index:at});
    }
   }
   const drink=E.getEvent(run).choices.findIndex(choice=>choice.effect==='finishBreak'&&choice.available!==false&&/飲料|散步/.test(choice.text));
   if(drink>=0){run=choose(run,drink);continue;}
  }
  const after=next(run);if(!after||after===run)break;run=after;
 }
 if((attempt+1)%20===0)console.log(JSON.stringify({attempts:attempt+1,routes:[...routes.keys()]}));
 if(['menu','poor-menu','accepted','declined','cancelled','paid-exact-wallet',...['warm','neutral','mine'].flatMap(reaction=>[0,1].map(index=>`paid-${index}-${reaction}`))].every(id=>routes.has(id)))break;
}
for(const route of routes.values()){
 const run=E.replayRun(route.roleId,route.seed,route.actions);if(!E.validRun(run))throw Error(`Invalid Princess witness ${route.id}`);
 if(JSON.stringify(E.replayRun(run.roleId,run.seed,run.actions))!==JSON.stringify(run))throw Error(`Unstable Princess witness ${route.id}`);
}
for(const id of ['menu','poor-menu','accepted','declined','cancelled',...['warm','neutral','mine'].flatMap(reaction=>[0,1].map(index=>`paid-${index}-${reaction}`))])if(!routes.has(id))throw Error(`Missing Princess dinner witness ${id}`);
writeFileSync(new URL('../tests/fixtures/princess-dinner-v62.json',import.meta.url),JSON.stringify({method:'Natural fresh r62 createRun lives. Real warning gaps, break menus, page changes, Princess invitation RNG and paid chat RNG. No injected cash, mood, friendship, event, calendar or RNG. Every witness validates and replays exactly.',routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,exactWallet:routes.has('paid-exact-wallet')}));
