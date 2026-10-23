import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import * as E from '../dist/engine.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {DIET_TEAMS_V65} from '../dist/diet-v65.js';

// Natural witnesses only: lookahead selects public answers without altering a
// life, its resources, invitation calendar, RNG, relationships or contexts.
const routes=new Map(),roles=['system','project','bd','sales','design','admin','ai','hr'];
const required=['camel-invitation','camel-play-0','camel-finish','camel-return','camel-completed','camel-departure',...DIET_TEAMS_V65.map(team=>`diet-play-${team.id}`),...CAST_IDS_V65.map(id=>`cast-${id}`),'blockchain-0','blockchain-3','blockchain-return','blockchain-departure'];
const event=run=>E.getEvent(run),choose=(run,index)=>E.advance(E.applyChoice(run,index));
const save=(id,run,before=null,extra={})=>{if(!routes.has(id))routes.set(id,{id,roleId:run.roleId,seed:run.seed,actions:run.actions,...(before?{beforeActions:before.actions}:{}),...extra});};
const options=run=>(event(run).choices||[]).map((choice,index)=>({choice,index})).filter(row=>row.choice.available!==false);
const score=run=>run.completed||run.chapterContext||run.pendingFamily?-1e6:Math.min(run.stats.energy,run.stats.mood)*5+run.stats.energy+run.stats.mood+run.stats.cash*.6+Math.min(run.stats.boss,65)*.8+run.stats.trust*.2-(run.pip?.active?100:0);
const input={diet:{kind:'diet',days:Array.from({length:7},(_,i)=>({meal:i%2,exercise:[2,5].includes(i)?2:i%2}))},arm:{kind:'arm',mode:'steady',taps:Array.from({length:8},(_,i)=>500+i*1000)},roadshow:{kind:'roadshow',matches:[0,1,2,1,0,2]},dinner:{kind:'dinner',plates:[0,1,2,0,1,1]},banquet:{kind:'banquet',beats:Array.from({length:12},(_,i)=>500+i*600)},basketball:{kind:'basketball',moves:[0,2,1,2,0]},review:{kind:'review',evidence:[0,1,2,0]}};
function finishLife(source){
 let run=source;if(E.isWorkGapOpenV50(run))run=E.applyChoice(run,0);
 run=E.requestExit(run);if(event(run).id==='exit-menu')run=choose(run,0);
 for(let i=0;i<8&&!run.completed;i++){
  const candidates=options(run).map(row=>({...row,after:choose(run,row.index)}));
  if(!candidates.length)break;run=(candidates.find(row=>row.after.completed)||candidates.sort((a,b)=>score(b.after)-score(a.after))[0]).after;
 }
 return run;
}
function camel(invitation){
 if(routes.has('camel-invitation'))return;save('camel-invitation',invitation);
 for(const index of [1,2])save(`camel-decline-${index}`,choose(invitation,index),invitation,{index});
 const setup=choose(invitation,0);save('camel-setup',setup,invitation,{index:0});
 for(const index of [0,1,2])save(`camel-setup-${index}`,choose(setup,index),setup,{index});
 let run=choose(setup,0),departureSource=null;
 for(let round=0;round<6;round++){
  save(`camel-play-${round}`,run);
  const played={kind:'camel',move:round%3,prediction:[2,1,0]},after=E.advance(E.applyActivityPlay(run,played));
  save(`camel-round-${round+1}`,after,run,{input:played});run=after;if(round===1)departureSource=run;
 }
 save('camel-finish',run);const returned=choose(run,0);save('camel-return',returned,run,{index:0});
 const completed=finishLife(returned);if(completed.completed)save('camel-completed',completed);
 save('camel-departure',E.advance(E.requestEventDepartureV63(departureSource)),departureSource);
}
function diet(invitation){
 if(routes.has(`diet-play-${DIET_TEAMS_V65[0].id}`))return;save('diet-invitation',invitation);
 const setup=choose(invitation,0);save('diet-setup',setup,invitation,{index:0});
 for(const [index,team]of DIET_TEAMS_V65.entries()){
  const play=choose(setup,index);save(`diet-play-${team.id}`,play,setup,{index});
  const finish=E.advance(E.applyActivityPlay(play,input.diet));save(`diet-finish-${team.id}`,finish,play,{input:input.diet});
  save(`diet-return-${team.id}`,choose(finish,0),finish,{index:0});
 }
}
function blockchain(source){
 if(routes.has('blockchain-0'))return;let run=source;
 for(let stage=0;stage<4;stage++){
  save(`blockchain-${stage}`,run);for(const index of [0,1,2])save(`blockchain-${stage}-choice-${index}`,choose(run,index),run,{index});run=choose(run,stage===2?1:0);
 }
 save('blockchain-return',run);save('blockchain-departure',E.advance(E.requestEventDepartureV63(source)),source);
 const completed=finishLife(run);if(completed.completed)save('blockchain-completed',completed);
}
function inspect(run){
 if(run.activityInvitationContext?.id==='camel')camel(run);
 if(run.activityInvitationContext?.id==='diet')diet(run);
 if(run.blockchainContext?.stage===0)blockchain(run);
 const match=event(run).id?.match(/^cast65-([a-z]+)-/);if(match&&!routes.has(`cast-${match[1]}`)){
  save(`cast-${match[1]}`,run);for(const index of [0,1,2])save(`cast-${match[1]}-choice-${index}`,choose(run,index),run,{index});
 }
}
function life(attempt,role){
 const seed='e39-r65-n-'+createHash('sha256').update(`expansion65-${role}-${attempt}`).digest('hex').slice(0,22);let run=E.enableActivitySchedule(E.createRun(role,seed));
 for(let step=0;step<160&&!run.completed&&run.actions.length<265;step++){
  if(E.canRequestSalaryAdvice(run))run=E.requestSalaryAdvice(run);
  if(E.canRequestActivityInvitation(run))run=E.requestActivityInvitation(run);
  inspect(run);
  if(run.activityInvitationContext){run=choose(run,1);continue;}
  if(E.isWorkGapOpenV50(run)){
   if(E.canRequestBreak(run)&&run.stats.cash>=8){run=E.requestBreak(run);continue;}run=E.applyChoice(run,0);continue;
  }
  const play=E.getActivityPlayV55(run);if(play){run=E.advance(E.applyActivityPlay(run,play.id==='camel'?{kind:'camel',move:0,prediction:play.prediction||[0,1,2]}:input[play.id]));continue;}
  let choices=options(run);if(!choices.length)break;
  if(event(run).id==='kind-break'){run=choose(run,choices.find(row=>row.choice.effect==='kindDecline')?.index??0);continue;}
  if(event(run).id==='kind-workday'){run=choose(run,choices.find(row=>row.choice.effect==='kindWorkDecline')?.index??0);continue;}
  if(run.shareholderContext?.stage==='offer'){run=choose(run,2);continue;}
  if(event(run).id==='self-care')choices=choices.filter(row=>row.choice.effect==='finishBreak');
  const candidates=choices.map(row=>({...row,after:choose(run,row.index)}));if(!candidates.length)break;
  run=candidates.sort((a,b)=>score(b.after)-score(a.after))[0].after;
 }
}
const maximum=Math.max(1,Number(process.argv[2]||120));
for(let attempt=0;attempt<maximum&&required.some(id=>!routes.has(id));attempt++){
 for(const role of roles)life(attempt,role);
 console.log(JSON.stringify({attempt:attempt+1,routes:routes.size,missing:required.filter(id=>!routes.has(id))}));
}
const missing=required.filter(id=>!routes.has(id));if(missing.length)throw Error(`Missing expansion65 natural routes: ${missing.join(', ')}`);
for(const row of routes.values())for(const actions of [row.beforeActions,row.actions].filter(Boolean)){const run=E.replayRun(row.roleId,row.seed,actions);if(!E.validRun(run))throw Error(`Noncanonical ${row.id}`);}
writeFileSync(new URL('../tests/fixtures/expansion-v65.json',import.meta.url),JSON.stringify({method:'Natural r65 createRun lives and bounded public-choice lookahead. No injected state, resources, calendar, RNG, history, relationship or outcomes.',required,routes:[...routes.values()]},null,2)+'\n');
console.log(JSON.stringify({routes:routes.size,missing}));
