import {PATRONAGE_EVENT_V29,patronageEligibleV29,withPatronageEntryV29,getPatronageEventV29} from './patronage-v29.js';
import {isRecruitmentV60} from './seed-profile-v60.js';
import {isPatronageBenefitsV67,appointmentPayV67} from './patronage-benefits-v67.js';

// Existing lives keep their original invitations and deterministic outcomes.
// The calendar prefix remains intact so this rule also uses scheduled events.
export const isPatronageV49=run=>isRecruitmentV60(run)||/^e39-cal46-kin49-/.test(run?.seed||'');
export const PATRONAGE_REQUIREMENTS_V49=Object.freeze({lick:70,boss:65});
export function patronageEligibleV49(run){
 return patronageEligibleV29(run)&&(!isPatronageV49(run)||(run.stats.lick>=PATRONAGE_REQUIREMENTS_V49.lick&&run.stats.boss>=PATRONAGE_REQUIREMENTS_V49.boss));
}

export function withPatronageEntryV49(event,run){
 // Do not add a disabled teaser: this opening appears only when the player
 // has earned enough favour and the boss is in a receptive mood.
 if(isPatronageV49(run)&&event?.id==='career-review'&&!patronageEligibleV49(run))return event;
 return withPatronageEntryV29(event,run);
}

export function getPatronageEventV49(run){
 const event=getPatronageEventV29(run);
 if(!isPatronageV49(run))return event;
 return {...event,
  body:event.body.replace('你試著問希望，','翅膀最近幾次都很受用你的恭維，今天又難得和顏悅色。你趁著這個空檔問希望，')+(isPatronageBenefitsV67(run)?` 希望把條件寫清楚：若正式任用，月薪改為 ${appointmentPayV67(run,run.pay)}K，另給一次安家補助，之後每完成兩個工作回合發生活津貼；補助與津貼使用存款指數，上限仍是 100。尚未通過前，原職稱與薪資照舊。`:''),
  choices:event.choices.map(choice=>!choice.check?choice:{...choice,check:{...choice.check,
   success:{...choice.check.success,result:choice.check.success.result+' 瑞克把你的新名片翻過去，說座位已經很擠了。翅膀還在點頭，他卻先把你從自己的午餐名單劃掉；這份任用替你換來一張名片，也替你多了一個不肯讓位的對手。'},
   failure:{...choice.check.failure,result:choice.check.failure.result+' 瑞克等翅膀轉身，才壓低聲音問你是不是想搶他的位置。你連新職稱都沒拿到，倒先領到他的冷臉；往後再找他說話，不會像以前那麼好開口。'}
  }})
 };
}

// A committed application is a relationship event even when it is rejected.
// Cancelling the conversation is not an application and produces no evidence.
export function patronageApplicationOutcomeV49(run,effect){
 if(!isPatronageV49(run)||run.eventId!==PATRONAGE_EVENT_V29)return null;
 if(effect==='patronageAppoint')return {version:1,result:'appointed',target:'rick',affinityDelta:-18};
 if(effect==='patronageReject')return {version:1,result:'rejected',target:'rick',affinityDelta:-12};
 return null;
}

export function isPatronageApplicationOutcomeV49(run,row){
 const outcome=row?.patronageApplicationOutcome;
 return Boolean(isPatronageV49(run)&&row?.eventId===PATRONAGE_EVENT_V29&&row.kind==='career'&&row.speaker==='wing'&&[0,1].includes(row.choiceIndex)&&['verbalOutcome','mealOutcome','patronageOutcome','activityOutcome','hiddenOutcome'].every(key=>row[key]===undefined)&&outcome&&typeof outcome==='object'&&!Array.isArray(outcome)&&Object.keys(outcome).sort().join(',')==='affinityDelta,result,target,version'&&outcome.version===1&&outcome.target==='rick'&&(
  outcome.result==='appointed'&&outcome.affinityDelta===-18&&row.chanceOutcome==='success'||
  outcome.result==='rejected'&&outcome.affinityDelta===-12&&row.chanceOutcome==='setback'
 ));
}
