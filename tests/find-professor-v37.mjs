import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ROLES} from '../dist/roles.js';
import {PROFESSOR_EVENTS_V37} from '../dist/events-professor-v37.js';
import {createRun,getEvent,applyChoice,advance,requestBreak,canRequestBreak,requestRage,requestVerbal,replayRun,validRun} from '../dist/engine.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const resolve=(run,index)=>advance(applyChoice(run,index));
const chooseEffect=(run,effect)=>{const index=getEvent(run).choices.findIndex(c=>c.effect===effect&&c.available!==false);return index<0?null:resolve(run,index);};
const proof=(run,extra={})=>({roleId:run.roleId,seed:run.seed,actions:run.actions,stateHash:hash(run),...extra});

export function findProfessorWitnessesV37({maxSeeds=6000,onProgress=()=>{}}={}){
  const scenes=new Map(),meals=new Map(),rages=new Map(),verbals=new Map();let declined=null,accepted=null,attemptedSeeds=0;
  const rage=(source,kind,phase,beforeActions)=>{
    if([...['imagined','real']].every(mode=>rages.has(`${kind}/${phase}/${mode}`)))return;
    const pending=requestRage(source);if(pending===source)return;
    const mode=pending.rageContext.mode,run=advance(pending);assert.equal(validRun(run),true);
    const key=`${kind}/${phase}/${mode}`;
    if(!rages.has(key))rages.set(key,proof(run,{id:key,origin:kind,phase,mode,beforeActions}));
  };
  const verbal=(source,kind,phase,beforeActions)=>{
    if(['ignored','relationship','retort','support','personnel','legal'].every(outcome=>verbals.has(`${kind}/${phase}/${outcome}`)))return;
    const pending=requestVerbal(source,undefined,2);if(pending===source)return;
    const outcome=pending.verbalContext.outcome,run=advance(pending);assert.equal(validRun(run),true);
    const key=`${kind}/${phase}/${outcome}`;
    if(!verbals.has(key))verbals.set(key,proof(run,{id:key,origin:kind,phase,outcome,beforeActions}));
  };
  for(let attempt=0;attempt<maxSeeds;attempt++){
    attemptedSeeds++;
    let run=createRun(ROLES[attempt%ROLES.length].id,`e37-prof-proof-${attempt.toString(36)}`);
    run=resolve(run,0);
    if(canRequestBreak(run)){
      let care=requestBreak(run);
      if(care.eventId==='self-care'){
        let menu=chooseEffect(care,'mealOpen');menu=chooseEffect(menu,'mealPage');menu=chooseEffect(menu,'mealPage');
        assert.equal(menu.eventId,'meal-guests-c');assert.equal(validRun(menu),true);
        const invitation=applyChoice(menu,0),dinner=advance(invitation);
        if(invitation.pendingEffect==='mealDeclined')declined??=proof(dinner,{id:'professor-invitation-declined'});
        else{
          assert.equal(dinner.eventId,'meal-with-professor');accepted??=proof(dinner,{id:'professor-invitation-accepted'});
          for(const replyIndex of [0,1]){
            const paid=applyChoice(dinner,replyIndex),outcome=paid.history.at(-1).mealOutcome;
            assert.ok(outcome);const key=`${replyIndex}/${outcome.reaction}`,continued=advance(paid);
            if(!meals.has(key))meals.set(key,proof(continued,{id:key,replyIndex,reaction:outcome.reaction,beforeActions:dinner.actions}));
          }
          rage(dinner,'meal','event',dinner.actions);rage(applyChoice(dinner,0),'meal','result',dinner.actions);
          verbal(dinner,'meal','event',dinner.actions);verbal(applyChoice(dinner,0),'meal','result',dinner.actions);
        }
      }
    }
    for(let step=0;step<100&&!run.completed&&run.turn<12;step++){
      const event=getEvent(run);
      if(event.speaker==='professor'&&event.kind==='daily'){
        const beforeActions=run.actions;
        rage(run,'daily','event',beforeActions);rage(applyChoice(run,0),'daily','result',beforeActions);
        verbal(run,'daily','event',beforeActions);verbal(applyChoice(run,0),'daily','result',beforeActions);
        if(!scenes.has(event.id)){
          const next=resolve(run,0);assert.equal(validRun(next),true);
          scenes.set(event.id,proof(next,{id:event.id,beforeActions}));
        }
      }
      const index=event.choices.findIndex(c=>c.available!==false);if(index<0)break;
      run=resolve(run,index);
    }
    if(attempt%100===0)onProgress({attempt:attempt+1,scenes:scenes.size,meals:meals.size,rages:rages.size,verbals:verbals.size});
    if(scenes.size===30&&meals.size===6&&rages.size===8&&verbals.size===24&&accepted&&declined)break;
  }
  assert.equal(scenes.size,30,`Missing scenes: ${PROFESSOR_EVENTS_V37.map(e=>e.id).filter(id=>!scenes.has(id))}`);
  assert.equal(meals.size,6);assert.equal(rages.size,8);assert.equal(verbals.size,24);assert.ok(accepted&&declined);
  const report={version:37,method:'Ordinary seeded onboarding/work choices and first-workday invitations; outcomes are inspected only after committing actions, without editing state.',attemptedSeeds,scenes:[...scenes.values()],meals:[...meals.values()],rages:[...rages.values()],verbals:[...verbals.values()],accepted,declined};
  for(const route of [...report.scenes,...report.meals,...report.rages,...report.verbals,accepted,declined]){
    const run=replayRun(route.roleId,route.seed,route.actions);assert.equal(validRun(run),true,route.id);assert.equal(hash(run),route.stateHash,route.id);
  }
  return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const report=findProfessorWitnessesV37({maxSeeds:Number(process.argv[2]||6000),onProgress:row=>process.stdout.write(JSON.stringify(row)+'\n')});
  writeFileSync(new URL('./fixtures/professor-v37.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({attemptedSeeds:report.attemptedSeeds,scenes:report.scenes.length,meals:report.meals.length,rages:report.rages.length,verbals:report.verbals.length})+'\n');
}
