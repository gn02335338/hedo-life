import {getRageV39,rageTargetForV39} from './rage-cast-v39.js';
import {MEAL_GUEST_IDS_V39,MEAL_EVENTS_V39,mealPageIdV39,getMealEventV39} from './meals-cast-v39.js';
import {strongVerbalLineV39} from './verbal-lines-v39.js';
import {getCompanyEventV39} from './company-v39.js';
import {isPrivateSceneV39,privateReturnEffectV39,getPrivateRageV39,getPrivateVerbalScenarioV39} from './private-scenes-v39.js';
import {needsChapterResolutionV38,getChapterResolutionV38,withDepartureChoicesV38} from './chapters-v38.js';
import {getVerbalAftermathV33} from './verbal-outcomes-v33.js';
import {withMealInvitationsV34} from './meal-invitations-v34.js';
import {withMealReactionsV36} from './meal-reactions-v36.js';
import {isMealOutcomeV36,characterAffinity} from './character-stats.js';
import {PATRONAGE_REPLY_EVENT_V43,patronageReplyModeV43,patronageReplyLineV43,patronageReplyOutcomesV43} from './patronage-reply-v43.js';
import {MEAL_GUEST_IDS_V37,MEAL_EVENTS_V37,mealPageIdV37,getMealEventV37} from './professor-v37.js';
import {getRageV37,rageTargetForV37} from './rage-v37.js';
import {VERBAL_OUTCOME_EVENTS_V32,getVerbalAftermathV32,withVerbalAftermathV32} from './verbal-outcomes-v32.js';
import {COMPANY_EVENTS_V32,getCompanyEventV32,withCompanyEntryV32,companyEligibleV32} from './company-v32.js';
import {VERBAL_V2_EVENTS,getVerbalScenarioV2,verbalLineV2} from './verbal-scenario-v2.js';
import {VERBAL_EVENTS_V30,VERBAL_KINDS_V30,VERBAL_LEGAL_RESULTS_V30,getVerbalEventV30,verbalTargetsV30} from './verbal-v30.js';
import { ROLES, ROLE_MAP } from './roles.js';
import { EVENTS, FANTASY_EVENTS } from './events.js';
import { ENDINGS } from './endings.js';
import { rollEducation, educationLabel } from './education.js';
import { educationRisk, getEducationScrutiny } from './education-risk.js';
import { applyWildOptions } from './wild-options.js';
import { applyCopyV15 } from './copy-v15.js';
import { applyEventCopy, polishEngineText } from './engine-copy.js';
import { KIND_BREAK_CHANCE, KIND_WORKDAY_CHANCE, KIND_WORKDAY_COOLDOWN, getKindBreak } from './kind-break.js';
import { careerLevels, careerStage, careerMaxRank, careerReviewCutoff, legacyCareerRank, careerTitle, careerSalary, careerReadiness, careerReviewWait, careerInvitationEligible, getCareerReview, getCareerDuty, getRankExit, getCareerStepDown } from './career-api.js';
import { getStoryExit } from './story-career.js';
import { getRage } from './rage.js';
import { RAGE_WORLD_EVENTS, getRageV14, rageTargetFor } from './rage-v14.js';
import { getBanquet } from './banquet.js';
import { getRageV16, rageTargetForV16 } from './rage-v16.js';
import { PERSONAS, applyPersonaCopy, displayText, replayText } from './persona.js';
import { applyOnboardingV17 } from './onboarding-v17.js';
import { normalizeAbilitiesV18, abilityRebalanceV18, moodEnergyPulseV18, getSelfCareV18 } from './resources-v18.js';
import { scopedBossDeltaV18 } from './relationships-v18.js';
import { getMoodCollapseV18, getMoodWarningV18 } from './meltdown-v18.js';
import { RAISE_EVENTS, raiseAvailability, getRaiseEvent, workCount, raisePayCeiling } from './salary-raise-v19.js';
import { PERSONNEL_SCENES, WATCH_DAILY_IDS, personnelSafe, personnelDecision, freshPersonnelProvocation, watchNextEvent, getPersonnelEvent } from './personnel-v20.js';
import { getRageV20, rageTargetForV20 } from './rage-v20.js';
import { getRageV22, rageTargetForV22 } from './rage-v22.js';
import { getRageV23, rageTargetForV23 } from './rage-v23.js';
import { rageParticipantsFor } from './rage-participants.js';
import { selectWorkEventV21 } from './work-events-v21.js';
import { selectWorkEventV35 } from './work-events-v35.js';
import { getSalaryAdviceV24 } from './salary-advice-v24.js';
import { getMoodCollapseV25, getMoodSelfDestructV25, moodCollapseProfileV25 } from './meltdown-v25.js';
import { MEAL_GUEST_IDS_V25, MEAL_EVENTS_V25, withMealEntryV25, getMealV25, withMealRageCopyV25 } from './meals-v25.js';
import { PATRONAGE_EVENT_V29, patronageTitleV29, canKindDarkInviteV29, patronageWorkCountV29, patronageEligibleV29, withPatronageEntryV29, getPatronageEventV29, withGenderContextV29 } from './patronage-v29.js';
import { WEALTH_EVENTS_V27, wealthEligibilityV27, getWealthEventV27, withWealthEntryV27 } from './wealth-exit-v27.js';
export {raiseAvailability} from './salary-raise-v19.js';
export const VERSION = 3;
export const MAX_TURNS = 24;
export const STAT_LABELS = { energy:'體力', cash:'存款', trust:'同事情義', dream:'大餅信仰', boss:'翅膀心情', mood:'自己心情', skill:'工作能力', slack:'偷懶能力', lick:'舔老闆能力' };
export const STAT_KEYS = Object.keys(STAT_LABELS);
const clamp = n => Math.max(0,Math.min(100,n));
// Rule prefixes keep published seeds and queued completions on their original deterministic path.
const contentRules = run => run.seed.startsWith('e39-')?39:run.seed.startsWith('e38-')?38:run.seed.startsWith('e37-')?37:run.seed.startsWith('e36-')?36:run.seed.startsWith('e35-')?35:run.seed.startsWith('e34-')?34:run.seed.startsWith('e33-')?33:run.seed.startsWith('e32-')?32:run.seed.startsWith('e31-')?31:run.seed.startsWith('e30-')?30:run.seed.startsWith('e29-')?29:run.seed.startsWith('e28-')?28:run.seed.startsWith('e27-')?27:run.seed.startsWith('e26-')?26:run.seed.startsWith('e25-')?25:run.seed.startsWith('e24-')?24:run.seed.startsWith('e23-')?23:run.seed.startsWith('e22-')?22:run.seed.startsWith('e21-')?21:run.seed.startsWith('e20-')?20:run.seed.startsWith('e19-')?19:run.seed.startsWith('e18-')?18:run.seed.startsWith('e17-')?17:run.seed.startsWith('e16-')?16:run.seed.startsWith('e15-')?15:run.seed.startsWith('e14-')?14:run.seed.startsWith('e13-')?13:run.seed.startsWith('e12-')?12:run.seed.startsWith('e11-')?11:run.seed.startsWith('e10-')?10:run.seed.startsWith('e9-')?9:run.seed.startsWith('e8-')?8:run.seed.startsWith('e7-')?7:run.seed.startsWith('e6-')?6:run.seed.startsWith('e5-')?5:run.seed.startsWith('e4-')?4:run.seed.startsWith('e3-')?3:run.seed.startsWith('e2-')?2:1;
const mealEventIds=run=>contentRules(run)>=39?MEAL_EVENTS_V39:contentRules(run)>=37?MEAL_EVENTS_V37:MEAL_EVENTS_V25;
const mealGuestIds=run=>contentRules(run)>=39?MEAL_GUEST_IDS_V39:contentRules(run)>=37?MEAL_GUEST_IDS_V37:MEAL_GUEST_IDS_V25;
const mealPageId=(run,page)=>contentRules(run)>=39?mealPageIdV39(page):contentRules(run)>=37?mealPageIdV37(page):page===0?'meal-guests-a':'meal-guests-b';
const rules2 = run => contentRules(run)>=2;
const occasionalEducation = run => rules2(run)||run.seed.startsWith('e1-');
// Leave three full work scenes for improvement, then review before the finale.
const canStartPip = run => (contentRules(run)<10||run.turn<=MAX_TURNS-4)&&(contentRules(run)<20||(run.flags.hr_pip_allowed===1&&run.pipCount<2));
const hash = value => {let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0||1;};
function roll(run){let x=run.rng;x^=x<<13;x^=x>>>17;x^=x<<5;run.rng=x>>>0||1;return run.rng/4294967296;}
function flag(run,name,n=1){run.flags[name]=(run.flags[name]||0)+n;}
function salaryCutTarget(run,percent){return contentRules(run)>=25?Math.max(1,Math.min(run.pay-1,Math.round(run.pay*(1-percent/100)))):Math.max(20,Math.round(run.pay*(1-percent/100)));}
const c=(text,detail,result,delta={},effect=null,flags=[])=>({text,detail,result,delta,effect,flags});
const e=(id,title,body,wing,choices,kind='crisis',speaker=null)=>({id,title,body,wing,speaker:speaker||({'crisis-boss':'exit-team',paperwork:'exit-team','pip-review':'hope','pip-passed':'hope','salary-cut':'hope','salary-final':'hope'}[id]||'wing'),choices,kind,era:kind==='onboarding'?'入職報到':kind==='career'?'人事異動':'突發人事事件',sourceIds:[]});
const conversationalTarget=(run,event)=>contentRules(run)>=39?rageTargetForV39(event):contentRules(run)>=37?rageTargetForV37(event):contentRules(run)>=23?rageTargetForV23(event):contentRules(run)>=22?rageTargetForV22(event):contentRules(run)>=20?rageTargetForV20(event):contentRules(run)>=16?rageTargetForV16(event):rageTargetFor(event);
export function jobTitle(run){if(contentRules(run)>=29&&patronageTitleV29(run))return patronageTitleV29(run);if(contentRules(run)>=16)return displayText(careerTitle(run));if(contentRules(run)>=8)return careerTitle(run);const role=ROLE_MAP[run.actualRoleId];return run.assignment==='assistant'?role.assistantTitle:role.ladder[Math.min(run.rank,role.ladder.length-1)];}
export function bossLabel(n){return n<=12?'準備找你談談':n<30?'看誰都不順眼':n<60?'今天還算陰天':n<85?'龍心尚可':'聖眷正濃';}
export function createRun(roleId,seed=Date.now()){
 const role=ROLE_MAP[roleId];if(!role||role.minRules>contentRules({seed:String(seed).slice(0,32)}))throw new Error('Unknown role');
 const run={version:VERSION,seed:String(seed).slice(0,32),rng:hash(String(seed).slice(0,32)),roleId,actualRoleId:roleId,assignment:'honest',rank:0,pay:role.pay,offerPay:role.pay,basePay:role.pay,stats:{...role.stats},abilityDice:{},education:null,educationReviewed:false,salaryCutOffered:false,salaryCut:null,actions:[],flags:{},turn:0,eventId:'onboarding',seen:[],history:[],pending:false,completed:false,endingId:null,pendingEffect:null,pendingFamily:null,pip:null,pipCount:0,lastPromotion:-5,crisisCooldown:0,resumeEventId:null,exitReturnEventId:null,lastWeather:null};
 if(rules2(run)){run.lastBreakTurn=-1;run.breakReturnEventId=null;}
 if(contentRules(run)>=7)run.lastKindInviteTurn=-1;
 for(const key of ['skill','slack','lick']){const dice=Array.from({length:3},()=>1+Math.floor(roll(run)*6));run.abilityDice[key]=dice;run.stats[key]=25+(dice.reduce((a,b)=>a+b,0)-3)*4;}
 run.education=rollEducation(()=>roll(run),contentRules(run));run.stats.boss=clamp(run.stats.boss+run.education.wingBias);
 run.offerPay=role.payRange[0]+Math.floor(roll(run)*(role.payRange[1]-role.payRange[0]+1));run.pay=run.offerPay;run.basePay=run.offerPay;
 const r=roll(run);
 if(role.assignmentTable){let total=0;for(const row of role.assignmentTable){total+=row.weight;if(r<total){run.actualRoleId=row.actualRoleId;run.assignment=row.assignment;break;}}}
 else if(r<role.swapChance){run.actualRoleId=role.swapTo;run.assignment='swapped';}else if(r<role.swapChance+role.assistantChance)run.assignment='assistant';
 if(run.assignment==='swapped'){flag(run,'bait_switch');run.stats.mood-=14;}
 if(run.assignment==='assistant'){flag(run,'assistant');if(run.actualRoleId!==roleId)flag(run,'bait_switch');run.pay=Math.round(run.offerPay*.78);run.stats.mood-=18;}
 if(contentRules(run)>=8){if(contentRules(run)>=17){run.rank=roleId==='executive'?5:run.assignment==='assistant'?0:1;if(roleId==='executive')run.basePay=Math.round(run.offerPay/careerLevels(run)[5].payMultiplier);}else if(roleId==='executive'){run.rank=2;run.basePay=Math.round(run.offerPay/careerLevels(run)[2].payMultiplier);}run.flags.career_peak_rank=run.rank;}
 if(contentRules(run)>=9)run.flags.career_service=0;
 if(contentRules(run)>=10)run.flags.boss_crisis_armed=1;
 if(contentRules(run)>=11){run.flags.education_risk_due=2+Math.floor(roll(run)*3);run.flags.education_risk_checked=0;run.flags.education_dispute=0;run.flags.education_case_active=0;run.flags.education_outcome=0;}
 if(contentRules(run)>=13){run.rageContext=null;run.banquetReturnEventId=null;}
 if(contentRules(run)>=18){run.stats=normalizeAbilitiesV18(run.stats);run.meltdownReturnEventId=null;}
 if(contentRules(run)>=19)run.raiseContext=null;
 if(contentRules(run)>=20)run.personnelPending=null;
 if(contentRules(run)>=24)run.salaryAdvice=null;
 if(contentRules(run)>=25)run.mealContext=null;
 if(contentRules(run)>=27)run.wealthReturnEventId=null;
 if(contentRules(run)>=29){run.characterGender=roll(run)<.5?'male':'female';run.patronage=null;run.patronageContext=null;}
 if(contentRules(run)>=30){run.verbalContext=null;run.lastVerbalTurn=-1;}
 if(contentRules(run)>=32)run.companyContext=null;
 if(contentRules(run)>=38)run.chapterContext=null;
 return run;
}
function skillChoice(run,text,detail,condition,yes,no,effect,yesDelta={},noDelta={}){
 const ability=/肯定|金句|遠見|舔/.test(text)?run.stats.lick:run.stats.skill;
 const chance=Math.max(.1,Math.min(.92,.12+ability*.006+run.stats.boss*.001+(condition?.18:0)));
 const failedEffect=['pipPassed','pip_fail'].includes(effect)?'pip_fail':null;
 return {...c(text,detail,yes,yesDelta,effect),check:{chance,success:{result:yes,delta:yesDelta,effect:effect==='pip_fail'?'pipPassed':effect},failure:{result:no,delta:noDelta,effect:failedEffect}}};
}
function rawGetEvent(run){
 if(!run||run.completed)return null;
 if(contentRules(run)>=32&&COMPANY_EVENTS_V32.includes(run.eventId))return contentRules(run)>=39?getCompanyEventV39(run):getCompanyEventV32(run);
 if(contentRules(run)>=30&&VERBAL_EVENTS_V30.includes(run.eventId))return getVerbalEventV30(run);
 if(contentRules(run)>=29&&run.eventId===PATRONAGE_EVENT_V29)return getPatronageEventV29(run);
 if(WEALTH_EVENTS_V27.includes(run.eventId)){
  if(contentRules(run)<27||!run.wealthReturnEventId)throw new Error('Invalid wealth departure');
  return getWealthEventV27(run);
 }
 if(contentRules(run)>=20&&(PERSONNEL_SCENES.includes(run.eventId)||WATCH_DAILY_IDS.includes(run.eventId)||run.eventId==='pip-passed')){
  if((WATCH_DAILY_IDS.includes(run.eventId)||['watch-review','watch-future'].includes(run.eventId))&&!run.flags.floor_watch&&run.eventId!=='watch-review')throw new Error('Invalid floor assignment');
  return getPersonnelEvent(run);
 }
 const role=ROLE_MAP[run.roleId],actual=ROLE_MAP[run.actualRoleId],s=run.stats,f=run.flags,modern=rules2(run);
 switch(run.eventId){
 case 'meal-guests-c':case 'meal-with-professor':if(contentRules(run)<37||!run.mealContext)throw new Error('Invalid professor meal');return contentRules(run)>=39?getMealEventV39(run):getMealEventV37(run);
 case 'meal-guests-a':case 'meal-guests-b':
 case 'meal-with-annie_yu':case 'meal-with-princess':case 'meal-with-joyce':case 'meal-with-janet':case 'meal-with-captain':
 case 'meal-with-wing':case 'meal-with-spencer':case 'meal-with-erich':case 'meal-with-sonny':case 'meal-with-jenjen':case 'meal-with-rick':case 'meal-with-kind':case 'meal-with-hope':case 'meal-with-jack':case 'meal-with-meimei':case 'meal-with-helen':case 'meal-with-sophie':case 'meal-with-jonathan':case 'meal-with-owen':case 'meal-with-sam':case 'meal-with-cindy':if(contentRules(run)<25||!run.mealContext)throw new Error('Invalid meal');return contentRules(run)>=39?getMealEventV39(run):contentRules(run)>=37?getMealEventV37(run):withMealReactionsV36(withMealInvitationsV34(getMealV25(run),run),run);
 case 'low-pay-tip':if(contentRules(run)<24)throw new Error('Unknown salary advice');return getSalaryAdviceV24(run);
 case 'raise-request':case 'raise-response':case 'raise-confirmation':if(contentRules(run)<19)throw new Error('Unknown raise event');return getRaiseEvent(run);
 case 'rage-release':case 'rage-aftermath':case 'rage-legal':case 'rage-showdown':case 'rage-public':{
  if(contentRules(run)<14||!run.rageContext)throw new Error('Invalid rage world');
  if(contentRules(run)>=39&&isPrivateSceneV39(getEvent({...run,eventId:run.rageContext.eventId,rageContext:null})))return getPrivateRageV39(run);
  const event=contentRules(run)>=39?getRageV39(run):contentRules(run)>=37?getRageV37(run):contentRules(run)>=23?getRageV23(run):contentRules(run)>=22?getRageV22(run):contentRules(run)>=20?getRageV20(run):contentRules(run)>=16?getRageV16(run):getRageV14(run);
  return contentRules(run)>=25?withMealRageCopyV25(event,run):event;
 }
 case 'rage-menu':if(contentRules(run)<13||!run.rageContext)throw new Error('Invalid rage scene');return getRage(run);
 case 'banquet-welcome':case 'banquet-draw':case 'banquet-afterparty':if(contentRules(run)<13||!run.banquetReturnEventId)throw new Error('Invalid banquet');return getBanquet(run);
 case 'education-scrutiny':if(contentRules(run)<11||!f.education_case_active)throw new Error('Invalid education dispute');return getEducationScrutiny(run,jobTitle(run));
 case 'career-review':if(contentRules(run)<8)throw new Error('Unknown career event');return getCareerReview(run);
 case 'career-duty-5':case 'career-duty-6':case 'career-duty-7':if(contentRules(run)<17)throw new Error('Unknown career event');return getCareerDuty(run);
 case 'career-duty-1':case 'career-duty-2':case 'career-duty-3':case 'career-duty-4':if(contentRules(run)<8)throw new Error('Unknown career event');return getCareerDuty(run);
 case 'rank-exit':if(contentRules(run)<8)throw new Error('Unknown career event');return getRankExit(run);
 case 'career-step-down':if(contentRules(run)<8)throw new Error('Unknown career event');return getCareerStepDown(run);
 case 'story-exit':if(contentRules(run)<8)throw new Error('Unknown career event');return getStoryExit(run);
 case 'onboarding':{
 const unchanged=run.assignment==='honest';
 const title=unchanged?'職稱沒改，工作另議。':'錄取通知是真的，職稱另議。';
 const body=unchanged?`你應徵的是「${role.name}」，報到後的實際職稱也是「${jobTitle(run)}」；這次沒有被改派。你剛鬆一口氣，Wing補一句：「工作內容本來就要有彈性。」職稱保住了，桌上那張JD卻從這刻開始具有文學價值。`:run.assignment==='swapped'?`你應徵的是「${role.name}」，報到時卻被改派為「${jobTitle(run)}」；這就是你現在的實際職稱。${run.roleId==='ai'?'模型沒看到，CRUD與資料庫密碼倒是給得很齊。AI的A，原來是Anything。':'面試聊的專業，報到當天變成「你應該也會吧」。'}Wing把這叫跨領域，你把這叫掛羊頭賣狗肉。`:`你應徵的是「${role.name}」，報到時的實際職稱卻被改成「${jobTitle(run)}」。不是暫時幫忙，是直接用助理職稱任用。今天先訂便當、整理Excel、幫忙貼發票；你的專業等公司上市後再說。連遊戲月薪都從${run.offerPay}K縮成${run.pay}K。`;
 return e('onboarding',title,body,'「職稱只是名字，你不要把自己的格局做小了。」',[
 c('先坐下。房租不接受我的尊嚴付款。','接受目前分工，開始累積能力。','你坐進座位。桌子沒有名字，鍋倒是已經幫你訂製好了。',{mood:-5,skill:5,cash:5},null,['endure']),
 skillChoice(run,'拿錄取信，把工作範圍問清楚。',`協商條件：工作能力 ≥ 65（目前 ${s.skill}）`,s.skill>=65,unchanged?'你拿錄取信逐項確認工作範圍。職稱維持不變，Wing倒是記住了你「很有想法」。':'你把差異逐項攤開，這次談回了錄取時的職務。代價是Wing記住了你「很有想法」。',unchanged?'你問得很具體，他回得很宏觀。職稱沒變，工作範圍也沒講清楚，卻先拿到一個「不好帶」的評語。':'你問得很具體，他回得很宏觀。職務沒換回來，卻先拿到一個「不好帶」的評語。','restoreJob',{boss:-14,mood:8},{boss:-20,mood:-8}),
 c('蛤？那我先走，這份JD留給平行宇宙。','第一天也可以直接結局。','椅子還沒坐熱，你已經完成離職交接：把門關上。',{mood:20},'ragequit')
 ],'onboarding');}
 case 'education-review':{
 const ed=run.education;
 const reaction=ed.schoolId==='ntu'&&ed.degree!=='EMBA'&&ed.field==='stem'?'Wing一聽到「臺灣大學」，笑容突然多了一層認證：「台大的喔？那應該很會讀書。」同一張椅子上的你，前途忽然被重新估價。':ed.degree==='EMBA'?'聽到EMBA，Wing笑著補一句：「我說的讀書，不是你以為的那種讀書。」你發現同一張文憑，可以依照他的心情改變單位。':['humanities','business'].includes(ed.field)?'你才講完科系，Wing就接話：「你這個背景，平常到底有沒有在讀書？」你想說讀完才有畢業證書，但他的問題顯然不接受字面回答。':ed.sector==='private'?'校名一說出口，Wing先露出一個很會讓人理解的表情，再問你最近讀了什麼書。你開始懷疑這裡的書，封面是不是都要印同一間大學。':'Wing聽完點點頭：「學歷不能代表什麼，重點是你有沒有一直讀書。」下一秒，他又問起別人的學校。';
 return e('education-review','一個看起來很普通的問題。',`工作聊到一半，Wing忽然笑著問：「你哪裡畢業的？」語氣很像普通閒聊。你照實回答：「${educationLabel(ed)}。」${reaction}`,'「不要只會做事。人不讀書，格局就會卡在那裡。」',[
 c('先聽著，回去把真正需要的知識補上。','','你翻開的是技術文件。他要的是哪本書，你決定暫時不要通靈。',{skill:7,boss:3,mood:-4},'educationDone'),
 c('書有讀。也想知道這件事跟交付有什麼關係。','','問題很合理，會議很安靜。Wing說你太愛辯，你把這句話記在讀書筆記旁邊。',{mood:9,boss:-15,trust:5},'educationDone',['evidence']),
 c('您推薦的那本，我已經放進待讀清單了。','','清單有建立，書不一定有買。Wing點點頭，這場讀書會暫時驗收了語氣。',{lick:7,boss:10,slack:3,dream:-4},'educationDone')
 ],'career');}
 case 'salary-cut':{
 const cut=run.salaryCut;
 const negotiation=skillChoice(run,'把交付紀錄和錄取條件攤開，重新談。','',s.skill>=65&&s.boss>=30,'Hope說會再協調。幾封往來之後，這次降薪撤回，工作清單倒是一項也沒有少。','Hope轉達：「Wing覺得這就是你的價值。」你得到的回覆，跟問題一樣長。','salaryRescind',{mood:8,boss:-7},{mood:-8,boss:-4});
 negotiation.check.failure.effect='salaryFinal';
 return e('salary-cut','試用期結束，薪水也想跟著結束。',`Hope約你談薪資。Wing本人不在，評語已先到：「我覺得你不值這個價。」原本的遊戲月薪${cut.from}K，現在要調成${cut.to}K。試用期證明你能做，下一步是證明你能便宜做。`,'「公司有公司的考量。你也可以想想，要不要繼續一起努力。」',[
 c('先留下。房租沒有試用期。','','你接受新數字，工作量維持原價。薪資單會調整，交辦訊息完全不用。',{mood:-18,boss:12},'salaryAccept',['endure']),
 c('那就不用繼續了。我的履歷還有下一頁。','','你把新薪資單推回去。既然價值談不攏，這場合作就停在原本的價格。',{mood:20},'ragequit'),
 negotiation
 ],'career');}
 case 'salary-final':return e('salary-final','回覆收到了，選擇還是你的。',`Hope轉達調薪方案不變：${run.salaryCut.from}K改成${run.salaryCut.to}K。Wing沒有出席，卻已經替會議寫好結論。你現在要替自己寫下一句。`,'「今天可以給個答覆嗎？大家都還有工作要處理。」',[
 c('暫時留下，把這筆帳記著。','','你選擇先保留收入。加班表沒有打折，求職網站的分頁開始常駐。',{mood:-14,boss:10},'salaryAccept',['archive']),
 c('不接受。那今天就到這裡。','','對方問你是不是太衝動，你說這不是已經想過的方案嗎。這次，主詞是你。',{mood:20},'ragequit')
 ],'career');
 case 'crisis-boss':return e('crisis-boss','老闆心情見底。你的門禁也是。','Wing沒有出現。法務長Erich、行政長JenJen和MIS Sonny在會議室等你：一位翻文件，一位確認交接，一位等著收帳號。口頭上是公司叫你走，推來的表格卻寫「自願離職」。','「你簽一下，大家好聚好散。這是為你好。」',[
 c('算了，簽下去。只想趕快離開。','被開除／簽自願離職路線。','你簽了。系統的最後一行不是「被叫走」，是「個人生涯規劃」。',{},'fired_signed'),
 c('不簽。先把這到底算什麼講清楚。','進入書面離場分支，可走未經PIP資遣。','Erich說公司已經很有誠意，JenJen把表格往前推，Sonny看了一眼時間。你第一次覺得，慢一點也有用。',{boss:-3,mood:4},'paperwork',['evidence']),
 {...c('不是說績效？那就把PIP目標寫下來。','進入3個工作回合的PIP，不保證過關。','Hope寄來改善計畫。Wing沒有抄送你，只把意見交給HR長轉述。目標看似三項，真正那項叫「改善他對你的看法」。',{boss:modern?0:35,mood:-8},'startPip',['evidence']),...(contentRules(run)>=10?{available:canStartPip(run)}:{})}
 ]);
 case 'paperwork':return e('paperwork','同一個離場，三種公司說法。','自願離職書沒有簽成，三件套開始輪流解釋。Erich談文字，JenJen談時間，Sonny問筆電在哪裡。Wing仍然不在場，大家卻都能精準代言他的心情。','「程序不用搞那麼複雜吧？你是不是不信任公司？」',[
 c('拒簽到底，把來回紀錄留好。','開除／拒簽自願離職結局。','你帶走的是書面往來與自己的版本。故事沒有被那張空白表格全部改寫。',{mood:12},'fired_refused',['evidence']),
 c('既然說組織調整，就照資遣名義離場。','未走PIP的資遣結局。','這一局沒有改善期，也沒有準備演出。上一封信還在催進度，下一封已經要你交接。',{},'layoff'),
 {...c('願意做PIP，但目標和期限先寫清楚。','改走有PIP的支線；3回合後評核。','Hope接手主持PIP，交給你一張自評表。現在，工作除了原本的工作，還多了一份證明自己有在工作的工作。',{boss:modern?0:35,mood:-5},'startPip',['evidence']),...(contentRules(run)>=10?{available:canStartPip(run)}:{})}
 ]);
 case 'mood-collapse':if(contentRules(run)<18||!run.meltdownReturnEventId)throw new Error('Invalid mood collapse');return contentRules(run)>=25?getMoodCollapseV25(run):getMoodCollapseV18(run);
 case 'mood-self-destruct':if(contentRules(run)<25||!run.meltdownReturnEventId||!run.flags.mood_self_destruct)throw new Error('Invalid mood self-destruct');return getMoodSelfDestructV25(run);
 case 'crisis-mood':if(contentRules(run)>=18)return contentRules(run)>=25?withMealEntryV25(getMoodWarningV18(run)):getMoodWarningV18(run);return e('crisis-mood','你的心情，已讀不回。','訊息通知再響一次，你開始認真研究窗外的天空。體力還能撐，心情已經把離職信寫到第三版。今天還要不要演「我很好」？','「這點壓力都受不了，以後怎麼跟我敲鐘？」',[
 c('幹，我不幹了。','自己受不了離職，現在就結局。','你第一次沒有替老闆的句子找台階。他的夢想留在群組，你的人生先下線。',{mood:30},'ragequit'),
 {...c('花一點存款，休息到能分清自己和工作。','存款 −12，心情 +38，體力 +20。','你把通知關掉。休息不是他的恩惠，是你替自己留下的操作空間。',{cash:-12,mood:38,energy:20},'resume'),...(modern?{available:s.cash>=12}:{})},
 c('先開省電模式。這個薪水，配這個演技。','練習偷懶，降低投入；仍會惹老闆不爽。','你把「正在處理」設成快捷鍵。不是事情做不完，是情緒不能再免費供應。',{mood:24,slack:15,boss:-5,dream:-12},'resume')
 ]);
 case 'pip-review':{
 const evidence=f.evidence||0;const proof=s.skill>=65&&evidence>=2;const favor=s.lick>=65&&s.boss>=25;
 return e('pip-review','PIP評核：問題改善了，老闆呢？',`改善期走完了。你交出成果、時間線和紀錄，HR長Hope主持評核，先請你替自己打分。Wing依舊沒有出現，意見卻比在場的人還多。你交的是工作成果，對方準備的是另一份評分標準。`,'「你自己打幾分？不要拿工作完成當藉口。」',[
 skillChoice(run,'逐條對照目標，用成果和紀錄答辯。',`需要工作能力 ≥65、紀錄 ≥2（${s.skill}／${evidence}）`,proof,'Hope把交付紀錄一條條確認完，又接了一通你聽不到內容的電話。PIP過了，Wing的不滿沒有撤回。','Hope說理解你的努力，接著把理解放到一旁。表格最後一格，仍被填上「未達改善目標」。',proof?'pipPassed':'pip_fail',{},{}),
 skillChoice(run,'先肯定他的遠見，再解釋自己的改善。',`需要舔老闆 ≥65、老闆心情 ≥25（${s.lick}／${s.boss}）`,favor,'整份報告以「感謝Wing與Hope」開場。Hope說會協助轉達，這次轉達的效率異常良好。','你剛說完「感謝指導」，Hope回覆這不是她想聽的答案。看來今天的評分表，連感謝都要附佐證。',favor?'pipPassed':'pip_fail',{lick:5},{mood:-5}),
 c('不演了。讓這份PIP走到它想去的地方。','有走PIP、評核後資遣結局。','你沒有再補第十七版改善報告。這齣戲的最後一幕，終於不用加班演。',{},'pip_fail')
 ]);}
 case 'pip-passed':return e('pip-passed','PIP過了。恭喜，你還在禾多。','Hope寄來通過通知，只有一行。接下來是冷臉、跳過你的會議邀請，以及照樣準時出現的工作單。Wing沒有參加任何一場PIP，卻沒有漏掉任何一次不滿。','「讓你過，不代表我滿意。你自己要有自覺。」',[
 c('過關是證明，離開是決定。','PIP過關後主動離職結局。','你用成果證明能做，再用離職證明可以不做。這兩件事完全不衝突。',{mood:25},'pip_exit'),
 c('留下，但把每件事寫進紀錄。','繼續遊戲；重設怒氣警報。','你把感謝詞刪掉，留下日期、要求和交付。檔案夾開始長得像小型史冊。',{boss:modern?0:45,mood:24,energy:12},'finishPip',['archive','evidence']),
 c('留下，順便學會什麼時候該裝忙。','繼續遊戲，強化偷懶與討好。','你有了兩份工作：一份解決問題，一份解決老闆看到問題時的心情。',{boss:modern?0:50,mood:20,slack:15,lick:15},'finishPip')
 ]);
 case 'promotion-review':{
 const capable=s.skill>=65&&s.boss>=45;const flattering=s.lick>=65&&s.boss>=60;
 return e('promotion-review','恭喜升遷。加多少工作？',`你目前是${jobTitle(run)}，遊戲月薪${run.pay}K。Wing說公司會看見你的付出，手上已經拿著下一張組織圖。你決定怎麼拿這個職稱？`,'「不要先問加多少錢，先想你能多扛多少責任。」',[
 skillChoice(run,run.assignment==='assistant'?'用實績換回正式職務。':'拿成果談職級和薪資。',`工作能力 ≥65、老闆心情 ≥45（${s.skill}／${s.boss}）`,capable,'你把交付換成新的職稱和一點薪水。恭喜，現在可以用更高的職級接同一口鍋。','成果是真的，「下次一定」也說得很真。這次只有責任增加，職稱還在審核。','promote',{energy:-5,mood:6,cash:8},{mood:-9,boss:-5}),
 skillChoice(run,'把他的話做成金句，附在升遷簡報首頁。',`舔老闆 ≥65、老闆心情 ≥60（${s.lick}／${s.boss}）`,flattering,'你的簡報只有七頁，Wing的名字出現十八次。組織圖當場動了。','你以為是在表忠，他覺得你在套招。「你以為這樣就能升？」','promote',{lick:8,trust:-10,boss:8,cash:6},{mood:-6,boss:-8}),
 c('先不要升。我只想把下班時間保住。','心情與體力回復；偷懶能力增加。','你禮貌拒絕了「被更多人找到」的權利。公司少一位主管，你多一個晚上。',{mood:12,energy:10,slack:10,boss:-6},'declinePromotion')
 ],'career');}
 case 'kind-break':{
 if(contentRules(run)<6||!run.breakReturnEventId||!canKindDarkInviteV29(run))throw new Error('Invalid Kind break');
 return getKindBreak(run);}
 case 'kind-workday':{
 if(contentRules(run)<7||!run.breakReturnEventId||!canKindDarkInviteV29(run))throw new Error('Invalid Kind workday');
 return getKindBreak(run);}
 case 'self-care':{
 if(!modern||!run.breakReturnEventId)throw new Error('Invalid break');
 if(contentRules(run)>=18)return contentRules(run)>=25?withMealEntryV25(getSelfCareV18(run)):getSelfCareV18(run);
 return {...e('self-care','這筆錢，先花在自己身上。','行事曆的空白總會被公司填滿。你決定先替自己留一格，花的是遊戲存款，買回來的是一點能夠繼續選擇的心情。今天想怎麼對自己好一點？','通知先靜音。這次不用問公司的願景。',[
 {...c('買杯喜歡的飲料，散步到冰塊融化。','小小犒賞。','你走了一段沒有KPI的路。飲料喝完了，至少不是一整天都只有吞下去。',{cash:-6,mood:12,energy:4},'finishBreak'),available:s.cash>6},
 {...c('找朋友吃一頓，講講今天又怎麼了。','花一點錢，跟懂你的人吃飯。','朋友沒有叫你共體時艱，只問你要不要再點一道。這頓飯終於不需要靠願景吃飽。',{cash:-12,mood:23,energy:8,trust:3},'finishBreak'),available:s.cash>12},
 {...c('訂一個不開通知的晚上，認真休息。','比較花錢，但今天想好好喘口氣。','你讓自己吃飽、睡好，手機停在勿擾。世界沒有因此停止，這件事讓你非常滿意。',{cash:-20,mood:34,energy:18},'finishBreak'),available:s.cash>20},
 c('今天先把錢留著，回去處理原本的事。','','你沒有消費。想休息的念頭先存著，事情也還在原本的地方。',{},'cancelBreak')
 ],'self-care','self'),era:'下班自救'};}
 case 'exit-menu':return e('exit-menu','今天，想怎麼離開？',`第${run.turn+1}個工作回合，${jobTitle(run)}，心情${s.mood}。你不需要等到敲鐘，才有權把這段人生結束。這裡沒有「再撐一下就好了」的系統提示。`,'「你走了，外面也不一定比較好喔。」',[
 c('那是外面的事。我現在選擇離職。','結束本局；保留已收集的結局。','你沒有為他的預言留下來驗證。門外有很多問題，但至少不是這一個。',{mood:20},f.pip_passed?'pip_exit':'ragequit'),
 c('有些事想做完，再把門帶上。','檢視升官、摸魚、舔王、史官等職涯結局。','你把這段經歷攤開，決定要用什麼頭銜替自己蓋章。',{},'careerExit'),
 c('先回座位。我還有一個選擇沒做。','返回原事件，不消耗回合。','你把離職信存成草稿。它在，就已經不一樣。',{},'return')
 ],'career');
 case 'career-exit':return e('career-exit','最後一天，想留下一點什麼？','交接清單寫完了，但你的故事還差最後一句。你看了一眼座位、訊息和名片，決定這次由自己收尾。','「有些人只會做事，有些人知道誰在看。」',[
 {...c(run.roleId==='executive'?'收起那張主管名片，結束這場角色扮演。':'把最後一份交辦完成，收拾自己的桌子。',run.roleId==='executive'?'職稱仍是主管，決策卻已經繞過你。':'目前實際職務為助理。','職缺頁還在寫專業人才。你用整段人生，補完了它沒寫的「其他交辦」。',{},'assistant'),available:run.assignment==='assistant'||(run.roleId==='executive'&&run.turn>=4&&s.boss<45)},
 {...c('帶著新名片，去找下一張辦公桌。','至少成功升遷1次。','你拿到新的頭銜，留下上一張名片當作工作量還正常時的考古證據。',{},'promotion'),available:run.rank>=1&&(contentRules(run)<8||(f.promotions||0)>=1)},
 {...c('把所有通知調成勿擾，留下生活的分頁。','偷懶能力 ≥65。','你沒讓公司成為人生，倒是讓公司付了你一部分人生的錢。',{},'slacker'),available:s.slack>=65},
 {...c('把最後一篇感謝文寫得讓他滿意。','舔老闆 ≥75、老闆心情 ≥65。','組織圖終於畫對了：所有箭頭都指向你嘴裡的Wing。',{},'sycophant'),available:s.lick>=75&&s.boss>=65},
 {...c('把離場經歷寫下來，留給下一個人。','累積至少4次史冊紀錄。','你把檔案封存。幾年後有人說你誇張，旁邊的人補一句：沒有，他還寫得太客氣。',{},'historian'),available:(f.archive||0)>=4},
 c('不需要再證明什麼。我先走了。','主動離職結局。','你不是沒撐到最後。你只是決定，最後一天就是今天。',{mood:20},f.pip_passed?'pip_exit':'ragequit'),
 ...(run.turn<MAX_TURNS?[c('還有一件事沒做，我先回座位。','返回原事件。','你還有自己的小計畫，暫時不讓Wing知道。',{},'return')]:[])
 ],'career');
 case 'final-shortfall':return e('final-shortfall','敲鐘前，先別把自己敲壞。','敲鐘的行程一改再改，收購消息又換了一個日期。大家口中的下一站一直很近，你看著沒有訂好的機票，開始想自己究竟還要等什麼。','「先把新聞稿寫好，條件以後再補。」',[
 c('新聞稿你寫，我去過人生。','選擇現在已解鎖的職涯結局。','你關掉那份尚未上市的上市簡報。至少自己的人生，今天可以交付。',{},'careerExit'),
 c('離職。我的夢，換個地方做。','主動離職結局。','這一次你沒有把「再等等」存成明年的計畫。',{},'ragequit'),
 {...c('這段先記起來。史冊要加頁了。','需要4次以上史冊紀錄。','目標沒有達成，但材料非常豐富。史官的業績，從來不靠公司掛牌。',{},'historian'),available:(f.archive||0)>=4}
 ],'career');
 }
 const event=EVENTS.find(e=>e.id===run.eventId)||FANTASY_EVENTS.find(e=>e.id===run.eventId);
 if(!event||(event.minRules??0)>contentRules(run)||(contentRules(run)>=29&&event.requireGender&&event.requireGender!==run.characterGender))throw new Error(`Unknown event ${run.eventId}`);
 if(event===FANTASY_EVENTS[3])return {...event,kind:'fantasy',choices:[...event.choices,c('不去交易所。我的人生另有用途。','選擇職涯、離職或隱藏結局。','你從口袋裡拿出那張舊清單，翻到背面。空白，剛好可以寫自己的。',{},'careerExit')]};
 return {...event,speaker:event.speaker||'wing',kind:FANTASY_EVENTS.includes(event)?'fantasy':'daily'};
}
function getPublishedEvent(run){
 if(run?.verbalContext?.version===2&&(run.eventId===run.verbalContext.eventId||VERBAL_V2_EVENTS.includes(run.eventId)||contentRules(run)>=32&&VERBAL_OUTCOME_EVENTS_V32.includes(run.eventId))){const context=run.verbalContext;if(contentRules(run)>=32&&context.stage==='aftermath')return contentRules(run)>=33?getVerbalAftermathV33(run):getVerbalAftermathV32(run);const source=getEvent({...run,eventId:context.eventId,verbalContext:null});if(contentRules(run)>=39&&isPrivateSceneV39(source))return getPrivateVerbalScenarioV39(run,source);const event=getVerbalScenarioV2(run,source);return contentRules(run)>=32&&context.stage==='release'?withVerbalAftermathV32(event):event;}
 const base=withGenderContextV29(rawGetEvent(run),run),event=contentRules(run)>=32?withCompanyEntryV32(base,run,FANTASY_EVENTS[3].id):base;
 if(contentRules(run)>=32&&(COMPANY_EVENTS_V32.includes(event?.id)||event?.id===FANTASY_EVENTS[3].id))return event;
 if(contentRules(run)>=30&&VERBAL_EVENTS_V30.includes(event?.id))return event;
 if(contentRules(run)>=29&&event?.id===PATRONAGE_EVENT_V29)return event;
 if(contentRules(run)>=27&&WEALTH_EVENTS_V27.includes(event?.id))return event;
 if(contentRules(run)>=25&&(mealEventIds(run).includes(event?.id)||event?.id==='mood-self-destruct'))return event;
 if(contentRules(run)>=24&&event?.id==='low-pay-tip')return event;
 if(contentRules(run)>=20&&(PERSONNEL_SCENES.includes(event?.id)||WATCH_DAILY_IDS.includes(event?.id)||event?.id==='pip-passed'))return event;
 if(contentRules(run)>=19&&RAISE_EVENTS.includes(event?.id))return event;
 if(contentRules(run)>=18&&['mood-collapse','crisis-mood','self-care'].includes(event?.id))return event;
 if(contentRules(run)>=17&&(['career-review','rank-exit','career-step-down'].includes(event?.id)||event?.id.startsWith('career-duty-')))return withPatronageEntryV29(contentRules(run)>=27?withWealthEntryV27(event,run):event,run);
 const edited=event&&contentRules(run)>=5?applyEventCopy(event,run,{jobTitle,educationLabel}):event;
 const wild=edited&&contentRules(run)>=12?applyWildOptions(edited,run):edited;
 const copied=contentRules(run)>=15?applyCopyV15(wild,run):wild;
 const named=contentRules(run)>=16?applyPersonaCopy(copied):copied;
 const finalEvent=contentRules(run)>=17?applyOnboardingV17(named,run,{jobTitle,educationLabel}):named;
 return contentRules(run)>=27?withWealthEntryV27(finalEvent,run):finalEvent;
}
export function getEvent(run){
 if(run?.patronageReplyContext){
  const row=run.history[run.patronageReplyContext.historyIndex];
  return {id:PATRONAGE_REPLY_EVENT_V43,title:row.title,body:row.body,wing:'',speaker:row.speaker,kind:'patronage',era:'自己人發話',sourceIds:row.sourceIds,choices:[]};
 }
 if(contentRules(run)>=38&&run.eventId==='chapter-resolution')return getChapterResolutionV38(run);
 const event=withDepartureChoicesV38(getPublishedEvent(run),run);
 return contentRules(run)>=39&&isPrivateSceneV39(event)?{...event,scope:'private'}:event;
}
const WEATHER=[{text:'Wing看完官網英文，決定對全世界不爽。',delta:-9},{text:'他剛開完別人的會，你負責承受餘震。',delta:-7},{text:'今天不知道誰先拍對馬屁，辦公室暫時放晴。',delta:6},{text:'Wing想到掛牌願景，暫時看誰都像未來股東。',delta:7},{text:'公司沒發生什麼事，老闆也先沒有。',delta:0},{text:'一個未回覆的訊息，讓今天變成臨時考核。',delta:-5}];
function nextNormal(run){
 if(contentRules(run)>=20&&run.flags.floor_watch)return watchNextEvent(run);
 if(run.turn>=20&&run.turn<MAX_TURNS)return FANTASY_EVENTS[run.turn-20].id;
 if(run.turn>=MAX_TURNS)return contentRules(run)>=8?'rank-exit':'career-exit';
 const supported=ev=>(ev.minRules??0)<=contentRules(run)&&(!ev.requireGender||contentRules(run)>=29&&ev.requireGender===run.characterGender)&&(!ev.context||(ev.context==='pip'&&run.pip?.active&&run.pip.remaining>0))&&(contentRules(run)<8||((ev.minRank??0)<=legacyCareerRank(run)&&(ev.maxRank??4)>=legacyCareerRank(run)));
 const matchesRole=ev=>!ev.roles||ev.roles.includes(run.actualRoleId)||(contentRules(run)<21&&ev.roles.includes(run.roleId));
 let pool=EVENTS.filter(ev=>supported(ev)&&!run.seen.includes(ev.id)&&(ev.minTurn??0)<=run.turn&&(ev.maxTurn??99)>=run.turn&&matchesRole(ev));
 if(!pool.length)pool=EVENTS.filter(ev=>supported(ev)&&matchesRole(ev));
 if(contentRules(run)>=35)return selectWorkEventV35(run,pool,()=>roll(run),EVENTS);
 if(contentRules(run)>=21)return selectWorkEventV21(run,pool,()=>roll(run),EVENTS);
 const weighted=pool.map(ev=>({ev,w:(ev.weight||1)*(ev.roles?2:1)}));let n=roll(run)*weighted.reduce((v,x)=>v+x.w,0);for(const {ev,w}of weighted){n-=w;if(n<=0)return ev.id;}return pool.at(-1).id;
}
function rankCompatibleReturn(run,eventId){
 if(contentRules(run)<8)return eventId;
 const event=EVENTS.find(candidate=>candidate.id===eventId);
 return event&&((event.minRank??0)>legacyCareerRank(run)||(event.maxRank??4)<legacyCareerRank(run))?nextNormal(run):eventId;
}
function finish(run,family){if(contentRules(run)>=38){if(needsChapterResolutionV38(family)&&!run.flags.departure38_voluntary)throw new Error('Departure needs explicit confirmation');run.chapterContext=null;}run.endingId=`${family}-${run.roleId}`;if(!ENDINGS.some(e=>e.id===run.endingId&&(e.minRules||1)<=contentRules(run)))throw new Error(`Unknown ending ${run.endingId}`);run.completed=true;run.pending=false;run.pendingFamily=null;run.pendingEffect=null;run.eventId=null;if(rules2(run))run.breakReturnEventId=null;if(contentRules(run)>=13){run.rageContext=null;run.banquetReturnEventId=null;}if(contentRules(run)>=18)run.meltdownReturnEventId=null;if(contentRules(run)>=19)run.raiseContext=null;if(contentRules(run)>=20)run.personnelPending=null;if(contentRules(run)>=24)run.salaryAdvice=null;if(contentRules(run)>=25)run.mealContext=null;if(contentRules(run)>=27)run.wealthReturnEventId=null;if(contentRules(run)>=29)run.patronageContext=null;if(contentRules(run)>=30)run.verbalContext=null;if(contentRules(run)>=32)run.companyContext=null;return run;}
export function endingEligibility(run,target){if(contentRules(run)>=32&&['nasdaq','taiwan','acquired'].includes(target))return companyEligibleV32(run);const s=run.stats;const common=s.energy>=20&&s.cash>=30&&s.skill>=65&&s.trust>=55;
 if(target==='nasdaq')return common&&s.dream>=70;
 if(target==='taiwan')return common&&s.dream>=45;
 if(target==='acquired')return s.energy>=15&&s.cash>=20&&s.skill>=70&&s.trust>=45;
 return false;
}
export function applyChoice(run,index){
 if(run.completed||run.pending)return run;
 if(run.verbalContext?.version===2&&run.verbalContext.stage==='decision'){
  const event=getEvent(run),option=event.choices[index];if(!Number.isInteger(index)||!option||option.available===false||!Number.isInteger(option.sourceIndex))throw new Error('Unavailable verbal decision');
  const next=structuredClone(run),context=next.verbalContext;next.actions.push({type:'choice',eventId:event.id,index});next.verbalContext=null;next.eventId=context.eventId;
  const chosen=applyChoice(next,option.sourceIndex);chosen.actions.pop();return chosen;
 }

 const event=getEvent(run),originalChoice=event.choices[index];if(!Number.isInteger(index)||!originalChoice||originalChoice.available===false)throw new Error('Unavailable choice');
 const scenarioRelease=run.verbalContext?.version===2&&run.verbalContext.stage==='release';
 const next=structuredClone(run);const before={...run.stats},modern=rules2(run),breakdown=[];let spentThisChoice=0;next.lastWeather=null;
 const change=(source,label,delta)=>{const actual={};for(const [key,value]of Object.entries(delta)){const previous=next.stats[key];next.stats[key]=clamp(previous+value);if(next.stats[key]!==previous)actual[key]=next.stats[key]-previous;if(contentRules(next)>=18&&key==='cash'&&next.stats[key]<previous)spentThisChoice+=previous-next.stats[key];}if(modern&&Object.keys(actual).length)breakdown.push({source,label,delta:actual});};
 next.actions.push({type:'choice',eventId:event.id,index});
 let chanceOutcome=null,choice=originalChoice,eventOutcome=null;
 if(contentRules(run)>=4&&choice.draw){
  let ticket=roll(next)*choice.draw.outcomes.reduce((total,outcome)=>total+outcome.weight,0);
  const selected=choice.draw.outcomes.find(outcome=>(ticket-=outcome.weight)<0)||choice.draw.outcomes.at(-1);
  choice={...choice,...selected};eventOutcome={label:choice.draw.label,result:selected.label};
 }
 if(choice.check){const passed=roll(next)<choice.check.chance;choice={...choice,...choice.check[passed?'success':'failure']};chanceOutcome=passed?'success':'setback';}
 const choiceDelta=Object.fromEntries(STAT_KEYS.map(k=>[k,choice.delta[k]||0]));
 if(contentRules(next)>=18){choiceDelta.boss=scopedBossDeltaV18(event,choiceDelta.boss,{source:'choice',target:run.rageContext?.target,effect:choice.effect,result:choice.result});if(!['self-care','rage','rage-world',...(contentRules(next)>=30?['verbal']:[])].includes(event.kind)&&!['mood-collapse','crisis-mood',...(contentRules(next)>=25?['mood-self-destruct']:[])].includes(event.id))for(const key of ['mood','energy'])choiceDelta[key]=Math.round(choiceDelta[key]*1.35);}
 if(contentRules(next)>=20&&!scenarioRelease&&!(contentRules(next)>=30&&event.kind==='verbal')&&!(contentRules(next)>=39&&isPrivateSceneV39(event))){const provocation=freshPersonnelProvocation(run,event,choiceDelta);if(provocation&&(!next.personnelPending||provocation.reason==='post-pip'))next.personnelPending=provocation;}
 change('choice',eventOutcome?`${eventOutcome.label}：${eventOutcome.result}`:'選擇結果',choiceDelta);
 for(const name of choice.flags||[])flag(next,name);
 if(contentRules(next)>=13&&event.kind==='rage'&&originalChoice.rageTarget){flag(next,'rage_attempts');flag(next,`rage_target_${originalChoice.rageTarget}`);next.flags.rage_last_turn=next.turn+1;}
 let result=choice.result;let effect=choice.effect;
 if((event.kind==='daily'||event.kind==='fantasy')&&!(contentRules(next)>=32&&event.id===FANTASY_EVENTS[3].id&&['companyMarket','companyBuyer','companyVietnam','careerExit'].includes(effect))){
  // A chosen action is resolved only here. Capability shifts the odds; neither good intent nor a high stat guarantees the outcome.
  const specialty=(choice.delta.lick||0)>0?'lick':(choice.delta.slack||0)>0?'slack':'skill';
  const luck=roll(next),capability=before[specialty],goodChance=.13+capability*.0014,badChance=.28-before.slack*.0012;
  if(luck<goodChance){
   chanceOutcome='lucky';const bonus=specialty==='lick'?{boss:9,mood:3}:specialty==='slack'?{energy:7,mood:5}:{skill:4,boss:5,mood:3};
   if(contentRules(next)>=18&&bonus.boss)bonus.boss=scopedBossDeltaV18(event,bonus.boss,{source:'rng',result:choice.result});change('rng','臨場好運',bonus);
   result+=specialty==='lick'?' 恰好，這句話踩中他今天想聽的版本。對方自己替你把後半段補成了優點。':specialty==='slack'?' 剛好有人把會議延後，你安靜回收了一小段人生。今天的省電模式，沒有被發現。':' 剛好有人替你的成果說了一句話。事情本身沒變，待遇突然順了一點。';
  }else if(luck>1-badChance){
   chanceOutcome='setback';const extra=specialty==='lick'?{boss:-10,trust:-4}:specialty==='slack'?{boss:-9,mood:-4}:{energy:-6,mood:-5,boss:-4};
   if(contentRules(next)>=18&&extra.boss)extra.boss=scopedBossDeltaV18(event,extra.boss,{source:'rng',result:choice.result});change('rng','臨場變數',extra);
   result+=specialty==='lick'?' 不巧，他今天把稱讚聽成了敷衍。你說同一句話，得到跟上次相反的表情。':specialty==='slack'?' 不巧，那扇門就在你最不像在忙的時候打開。你和老闆完成了一次不必要的眼神交接。':' 不巧，臨時插進來的交辦把原定節奏打散。沒有人改期限，只有你重新排時間。';
  }else chanceOutcome='ordinary';
  const weather=WEATHER[Math.floor(roll(next)*WEATHER.length)];change('weather',contentRules(next)>=18?'翅膀今日天氣':'老闆今日天氣',{boss:weather.delta});next.lastWeather={...weather};
  if(next.roleId==='executive'&&next.turn<=6){change('parachute','空降蜜月退潮',{boss:-12,trust:-3});next.lastWeather.text+=' 空降蜜月退潮，連「新氣象」都開始聽起來像罪名。';next.lastWeather.delta-=12;}
  if(next.assignment==='assistant'&&!(contentRules(next)>=29&&next.patronage))change('assignment','職稱落差',{mood:-2});
  if(modern){
   const drain=contentRules(next)>=18?3+Math.floor(roll(next)*6):4+Math.floor(roll(next)*4);change('workday','又上了一天班',{mood:-drain});if(contentRules(next)>=29&&next.patronage)change('patronage-perk','特殊任用：少接一輪額外交辦',{mood:Math.min(3,drain-1),energy:2});
   if(next.pip?.active)change('pip-pressure','PIP額外壓力',{mood:-3});
   if(next.stats.energy<=25)change('fatigue','疲勞累積',{mood:-2});
   if(next.salaryCut?.status==='accepted')change('pay-cut','降薪後的悶氣',{mood:-2});
  }
  if(contentRules(next)>=18){const pulse=moodEnergyPulseV18(roll(next));change('volatility',pulse.label,pulse.delta);result+=' '+pulse.text;flag(next,pulse.delta.mood>0?'volatility_recovery':'volatility_shock');}
  if(contentRules(next)>=20&&WATCH_DAILY_IDS.includes(event.id))flag(next,'floor_watch_days');
  if(!(contentRules(next)>=20&&next.flags.floor_watch)&&!(contentRules(next)>=29&&next.patronage)&&contentRules(next)>=8&&(contentRules(next)>=17||next.assignment!=='assistant')){const stage=careerStage(next);flag(next,`career_work_${next.rank}`);change('career-pressure',`${stage.label}的${contentRules(next)>=17&&next.rank<4?'專業責任':'管理責任'}`,stage.pressure);}
  if(contentRules(next)>=9&&!(contentRules(next)>=20&&next.flags.floor_watch))flag(next,'career_service');
  // A continuing low mood is one dispute, not a new PIP every cooldown.
  // Only an actual workday outside PIP can establish a fresh recovery.
  if(contentRules(next)>=10&&!next.pip?.active&&next.stats.boss>=35)next.flags.boss_crisis_armed=1;
  if(next.turn>0&&next.turn%4===0){const income=Math.max(4,Math.round(next.pay/10)),previousCash=next.stats.cash;change('income','本期薪資入帳',{cash:income});result+=modern?` 本期遊戲薪資入帳，存款實際 +${next.stats.cash-previousCash}。`:` 本期遊戲薪資入帳，存款 +${income}。`;}
  if(next.pip?.active)next.pip.remaining=Math.max(0,next.pip.remaining-1);
 }
 if(modern&&effect==='finishBreak'){
  if(contentRules(next)>=7&&event.id==='kind-workday')next.lastBreakTurn=next.turn;
  const luck=roll(next),mood=luck<.25?3:luck>.8?-3:0;chanceOutcome=mood>0?'lucky':mood<0?'setback':'ordinary';
  // Apply recovery variance before the cap, so an almost-full mood meter cannot turn paid rest into a loss.
  change('rng',mood>0?'休息剛好對味':'休息的臨場感受',{mood:clamp(before.mood+(choice.delta.mood||0)+mood)-next.stats.mood});
  result+=mood>0?' 剛好碰上喜歡的歌，今天的小事意外地很對味。':mood<0?' 路上還是想到一點工作，休息沒有完全照劇本走，但這段時間仍然是你的。':' 沒有奇蹟，也沒有加班訊息。這樣的一段時間已經很有用。';
 }
 if(effect==='restoreJob'){next.actualRoleId=next.roleId;next.assignment='honest';if(contentRules(next)>=17&&next.rank===0){next.rank=1;next.flags.career_peak_rank=Math.max(next.flags.career_peak_rank,1);}next.pay=next.offerPay;next.basePay=contentRules(next)>=8?Math.round(next.offerPay/careerLevels(next)[next.rank].payMultiplier):next.offerPay;}
 if(contentRules(next)>=8&&['careerPromote','careerRegularize'].includes(effect)){
  const oldTitle=jobTitle(next),oldPay=next.pay;
  if(effect==='careerRegularize'){next.assignment=next.actualRoleId===next.roleId?'honest':'swapped';next.rank=contentRules(next)>=17?1:0;next.pay=Math.max(next.pay,careerSalary(next,next.rank));}
  else{next.rank=Math.min(careerMaxRank(next),next.rank+1);next.pay=Math.min(500,Math.max(next.pay+8,careerSalary(next)));}
  next.lastPromotion=next.turn;next.flags.career_peak_rank=Math.max(next.flags.career_peak_rank||0,next.rank);flag(next,'promotions');
  if(contentRules(next)>=18)next.flags.career_promoted_peak=Math.max(next.flags.career_promoted_peak||0,next.rank);
  if(contentRules(next)>=9)next.flags.career_service=0;
  result+=` 職稱變更：${oldTitle} → ${jobTitle(next)}。遊戲月薪 ${oldPay}K → ${next.pay}K。${careerLevels(next)[next.rank].responsibility}`;
 }
 if(contentRules(next)>=8&&['careerDemoteStaff','careerDemoteDeputy'].includes(effect)){
  const oldTitle=jobTitle(next),oldPay=next.pay;next.rank=effect==='careerDemoteStaff'?(contentRules(next)>=17?1:0):(contentRules(next)>=17?4:1);next.pay=Math.min(next.pay,careerSalary(next));next.lastPromotion=next.turn;
  if(contentRules(next)>=9)next.flags.career_service=0;
  result+=` 職稱變更：${oldTitle} → ${jobTitle(next)}。遊戲月薪 ${oldPay}K → ${next.pay}K。`;
 }
 if(effect==='promote'){
  if(next.assignment==='assistant'){next.assignment='honest';next.rank=0;next.pay=Math.max(next.pay,rolePay(next));result+=' 助理轉正；';}else{next.rank=Math.min(4,next.rank+1);next.pay=Math.max(next.pay+5,rolePay(next));}next.lastPromotion=next.turn;flag(next,'promotions');result+=` 職稱變更：${jobTitle(next)}。遊戲月薪 ${next.pay}K。`;
 }
 if(!scenarioRelease&&(event.id==='promotion-review'||event.id==='career-review'))next.lastPromotion=next.turn;
 if(contentRules(next)>=10&&!scenarioRelease&&event.id==='career-review'){
  flag(next,'career_reviews');
  next.flags.career_last_review_target=(run.assignment==='assistant'?(contentRules(run)>=17?1:0):Math.min(careerMaxRank(run),run.rank+1))+1;
  next.flags.career_last_review_result=effect==='careerTrain'?1:effect==='careerDefer'?2:['careerPromote','careerRegularize'].includes(effect)?4:3;
  if(effect==='careerDefer')next.flags.career_defer_until=next.turn+6;
 }
 if(effect==='startPip'){next.pip={active:true,remaining:3};next.pipCount++;next.crisisCooldown=3;if(!modern)next.stats.boss=Math.max(35,next.stats.boss);}
 if(effect==='pipPassed'){next.pip={active:false,remaining:0};flag(next,'pip_passed');if(contentRules(next)>=20){next.flags.post_pip_tolerance=1;next.personnelPending=null;}}
 if(effect==='finishPip'){next.pip=null;next.crisisCooldown=contentRules(next)>=9?6:3;if(contentRules(next)>=20)next.personnelPending={reason:'passed',strength:0,source:'pip-passed'};}
 if(effect==='educationDone')next.educationReviewed=true;
 if(contentRules(next)>=11&&effect==='educationResponse'){
  const reasons=next.flags.education_dispute;
  const dismissalChance=Math.min(.42,.2+((reasons&8)?.08:0)+((reasons&4)?.06:0)+(index===2?.08:index===1?-.06:0));
  const dismissal=roll(next)<dismissalChance;
  next.flags.education_outcome=dismissal?2:1;
  eventOutcome={label:'Wing的臨時決定',result:dismissal?'交給人事處理':'重新談薪資'};
  if(dismissal){effect='educationDismissal';result+=' 他說了一句「我覺得不適合」，人就走了。隔一會，Erich、JenJen和Sonny請你進會議室。';}
  else{
   const percent=18+Math.floor(roll(next)*19)+((reasons&8)?5:0);
   next.salaryCutOffered=true;next.salaryCut={percent,from:next.pay,to:salaryCutTarget(next,percent),status:'pending',reason:'education'};
   effect='educationSalary';result+=` Hope隨後傳來Wing的要求：遊戲月薪從${next.salaryCut.from}K改成${next.salaryCut.to}K。錄取條件才確認沒幾天，現在又要你確認能不能接受。`;
  }
 }
 if(contentRules(next)>=11&&['startPip','salaryAccept','salaryRescind'].includes(effect))next.flags.education_case_active=0;
 if(effect==='salaryAccept'){next.pay=next.salaryCut.to;next.basePay=Math.max(contentRules(next)>=25?1:0,Math.round(next.pay/(contentRules(next)>=8?careerLevels(next)[next.rank].payMultiplier:1+next.rank*.15)));next.salaryCut.status='accepted';flag(next,'pay_cut');result+=` 遊戲月薪變更為${next.pay}K。`;}
 if(effect==='salaryRescind')next.salaryCut.status='rescinded';
 if(contentRules(next)>=18&&effect==='moodUnpaidLeave'){const oldPay=next.pay;next.pay=Math.max(1,Math.round(next.pay*(contentRules(next)>=25?1-moodCollapseProfileV25(next).cut/100:.9)));next.basePay=Math.max(1,Math.round(next.pay/careerLevels(next)[next.rank].payMultiplier));result+=` 缺勤後的遊戲月薪：${oldPay}K → ${next.pay}K。`;if(contentRules(next)>=19&&next.raiseContext){const offer=next.raiseContext;offer.fromPay=next.pay;if(offer.offerPay!==null)offer.offerPay=Math.min(raisePayCeiling(next),Math.max(next.pay+1,Math.round(next.pay*(1+offer.percent/100))));result+=' 尚未確認的談薪方案也會按調整後的月薪重新核對。';}}
 if(contentRules(next)>=19&&!scenarioRelease&&RAISE_EVENTS.includes(event.id)){
  if(event.id==='raise-request'&&effect!=='raiseCancel'){flag(next,'raise_attempts');next.flags.raise_last_work=workCount(run);next.raiseContext.approach=['merit','politics','seal'][index];}
  if(effect==='raiseOffer'){const percent=4+Math.floor(roll(next)*8);next.raiseContext.outcome='offer';next.raiseContext.percent=percent;next.raiseContext.offerPay=Math.min(raisePayCeiling(next),Math.max(next.pay+1,Math.round(next.pay*(1+percent/100))));result+=` 提出的遊戲月薪方案：${next.pay}K → ${next.raiseContext.offerPay}K，尚未生效。`;}
  if(effect==='raisePromise')next.raiseContext.outcome='promise';
  if(effect==='raiseFury')next.raiseContext.outcome='fury';
  if(effect==='raiseOffset')next.raiseContext.outcome='offset';
  if(effect==='raiseGrant'){const from=next.pay;next.pay=next.raiseContext.offerPay;next.basePay=Math.max(1,Math.round(next.pay/careerLevels(next)[next.rank].payMultiplier));flag(next,'raises');result+=` 書面調薪生效：遊戲月薪 ${from}K → ${next.pay}K。職級維持${jobTitle(next)}，之後的薪資入帳會使用新月薪。`;}
 }
 if(contentRules(next)>=29&&['patronageAppoint','patronageReject'].includes(effect)){
  if(event.id!==PATRONAGE_EVENT_V29||!next.patronageContext)throw new Error('Invalid patronage result');
  flag(next,'patronage_attempts');
  if(effect==='patronageAppoint'){
   const fromPay=next.pay,appointedPay=Math.min(500,Math.max(fromPay+8,Math.round(fromPay*1.15))),title=next.characterGender==='female'?'乾女兒':'乾兒子';
   next.patronage={title,historyIndex:next.history.length,fromPay,appointedPay};next.pay=appointedPay;next.basePay=Math.min(300,Math.max(1,Math.round(next.pay/careerLevels(next)[next.rank].payMultiplier)));
   result+=` 正式任用：${jobTitle(run)} → ${title}；月薪 ${fromPay}K → ${appointedPay}K。原本的專業職級保留，之後薪資入帳使用新月薪，額外交辦壓力也會減輕。`;
  }
 }
 if(scenarioRelease){next.verbalContext.outcome=choice.verbalKind;next.lastVerbalTurn=next.turn;flag(next,'verbal_attempts');flag(next,`verbal_target_${next.verbalContext.target}`);}
 if(contentRules(next)>=30&&event.id==='verbal-release'){
  next.verbalContext.outcome=choice.verbalKind;next.lastVerbalTurn=next.turn;
  flag(next,'verbal_attempts');flag(next,`verbal_target_${next.verbalContext.target}`);
 }
 if(contentRules(next)>=30&&choice.verbalLegalResult)next.verbalContext.legalResult=choice.verbalLegalResult;
 if(contentRules(next)>=18){const correction=abilityRebalanceV18(before,next.stats);if(Object.values(correction).some(value=>value!==0)){change('ability-tradeoff','時間有限，三種本事互相擠壓',correction);flag(next,'resource_friction_count');}if(spentThisChoice>0)flag(next,'cash_spent_total',spentThisChoice);}
 let family=ENDINGS.some(e=>e.family===effect)?effect:null;
 if(contentRules(next)>=38&&event.id==='chapter-resolution'&&effect==='chapterExit')family=next.chapterContext.family;
 const rageWorld=contentRules(next)>=14&&(effect==='rageAftermath'||event.kind==='rage-world');
 if(!family&&!rageWorld&&next.stats.cash<=0)family='broke';
 if(!family&&!rageWorld&&next.stats.energy<=0)family='burnout';
 if(!family&&choice.flags?.some(x=>['final_global','final_taiwan','final_acquire'].includes(x))){const goal=choice.flags.includes('final_global')?'nasdaq':choice.flags.includes('final_taiwan')?'taiwan':'acquired';if(endingEligibility(next,goal))family=goal;else effect='shortfall';}
 if(event.id==='onboarding'&&index<2)result+=` 目前實際職稱：${jobTitle(next)}。遊戲月薪 ${next.pay}K。`;
 if(contentRules(run)>=5){result=polishEngineText(result);if(next.lastWeather)next.lastWeather.text=polishEngineText(next.lastWeather.text);}
 if(contentRules(run)>=16){result=replayText(result);if(next.lastWeather)next.lastWeather.text=replayText(next.lastWeather.text);}
 next.history.push({eventId:event.id,kind:event.kind,title:event.title,body:event.body,wing:event.wing||'',speaker:event.speaker||'wing',sourceIds:event.sourceIds||[],turn:next.turn,choiceIndex:scenarioRelease?run.verbalContext.sourceChoiceCount:index,choiceText:choice.text,result,chanceOutcome,delta:Object.fromEntries(STAT_KEYS.map(k=>[k,next.stats[k]-before[k]])),weather:next.lastWeather,jobTitle:jobTitle(next),pay:next.pay,...(modern?{breakdown}:{}),...(eventOutcome?{eventOutcome}:{}),...(contentRules(next)>=36&&choice.mealOutcome?{mealOutcome:{...choice.mealOutcome}}:{}),...(contentRules(next)>=30&&event.id==='verbal-release'?{verbalOutcome:{kind:choice.verbalKind,target:next.verbalContext.target,affinityDelta:choice.affinityDelta,origin:next.verbalContext.eventId,phase:next.verbalContext.phase}}:{}),...(scenarioRelease?{verbalOutcome:{version:2,kind:choice.verbalKind,target:next.verbalContext.target,affinityDelta:choice.affinityDelta,origin:next.verbalContext.eventId,phase:next.verbalContext.phase}}:{})});
 if(contentRules(next)>=24&&(!next.salaryAdvice||next.salaryAdvice.status==='queued')){
  if(next.pay>=30)next.salaryAdvice=null;
  else if(next.pay<run.pay)next.salaryAdvice={from:run.pay,to:next.pay,historyIndex:next.history.length-1,returnEventId:null,status:'queued'};
 }
 next.pending=true;next.pendingEffect=effect;next.pendingFamily=family;return next;
}
function rolePay(run){return Math.round(run.basePay*(1+run.rank*.15));}
function openPersonnel(run,decision){
 run.flags.hr_pip_allowed=decision==='ordinary'?1:0;
 run.flags.boss_crisis_armed=0;
 run.personnelPending=null;
 run.resumeEventId=run.eventId;
 run.eventId=decision==='freeze'?'floor-notice':decision==='direct'?'dismissal-final':'crisis-boss';
 return run;
}
function finishVerbalSourceV2(run,context,effect=null){
 const next=structuredClone(run),history=next.history;
 next.verbalContext=null;next.eventId=context.eventId;
 next.history=history.slice(0,context.historyLength+(context.phase==='event'?1:0));
 next.pending=true;next.pendingEffect=context.phase==='result'?context.pendingEffect:effect;next.pendingFamily=context.pendingFamily;
 const resumed=advance(next,{verbalV2:context.phase==='event'});resumed.history=history;return resumed;
}
function advanceVerbalScenarioV2(run,next,last,effect){
 const context=next.verbalContext;
 if(contentRules(next)>=32&&effect==='verbalV32Aftermath'){context.stage='aftermath';next.eventId='verbal-v32-aftermath';return next;}
 if(contentRules(next)>=32&&effect==='verbalV32Continue'){
  const original=context.outcome==='legal'?'verbalV2Legal':context.outcome==='personnel'?'verbalV2Personnel':'verbalV2Resolve';
  if(context.eventId==='onboarding'&&context.phase==='event'&&context.outcome==='personnel')return finish(next,'layoff');
  return advanceVerbalScenarioV2(run,next,last,original);
 }
 if(effect==='verbalV2Legal'){context.stage='legal';next.eventId='verbal-v2-legal';return next;}
 if(effect==='verbalV2LegalResult'){context.stage='legal-result';next.eventId='verbal-v2-legal-result';return next;}
 if(effect==='verbalV2Personnel'){
  if(next.flags.post_pip_tolerance||(context.target==='wing'&&next.stats.boss<=3)){
   if(['daily','fantasy'].includes(context.sourceKind)){if(!next.seen.includes(context.eventId))next.seen.push(context.eventId);next.turn++;if(next.crisisCooldown>0)next.crisisCooldown--;}
   next.verbalContext=null;next.resumeEventId=null;next.exitReturnEventId=null;next.breakReturnEventId=null;next.banquetReturnEventId=null;next.meltdownReturnEventId=null;next.raiseContext=null;next.salaryAdvice=null;next.mealContext=null;next.wealthReturnEventId=null;next.patronageContext=null;next.personnelPending=null;next.pip=null;next.flags.hr_pip_allowed=0;next.flags.boss_crisis_armed=0;next.eventId='dismissal-final';return next;
  }
  context.stage='warning';next.eventId='verbal-v2-warning';return next;
 }
 if(effect!=='verbalV2Resolve')throw new Error('Invalid verbal scenario transition');
 if(contentRules(next)>=39&&context.phase==='event'){
  const source=getEvent({...next,eventId:context.eventId,verbalContext:null});
  if(isPrivateSceneV39(source)){
   const close=privateReturnEffectV39(source,next);next.verbalContext=null;next.eventId=context.eventId;
   if(close){next.pending=true;next.pendingEffect=close;next.pendingFamily=null;return advance(next);}
   return next;
  }
 }
 if(context.phase==='result')return finishVerbalSourceV2(next,context);
 if(['daily','fantasy'].includes(context.sourceKind)||context.eventId==='onboarding'&&next.assignment==='honest')return finishVerbalSourceV2(next,context);
 if(context.eventId==='low-pay-tip')return finishVerbalSourceV2(next,context,'salaryAdviceReturn');
 if(context.eventId==='self-care')return finishVerbalSourceV2(next,context,'cancelBreak');
 if(context.eventId==='kind-break')return finishVerbalSourceV2(next,context,'kindDecline');
 if(context.eventId==='kind-workday')return finishVerbalSourceV2(next,context,'kindWorkDecline');
 if(mealEventIds(next).includes(context.eventId))return finishVerbalSourceV2(next,context,next.mealContext?.guest?'mealFinish':'mealCancel');
 if(WEALTH_EVENTS_V27.includes(context.eventId)){
  next.eventId=next.wealthReturnEventId;next.wealthReturnEventId=null;next.verbalContext=null;return next;
 }
 const banquetEffect={'banquet-welcome':'banquetDraw','banquet-draw':'banquetAfterparty','banquet-afterparty':'banquetFinish'}[context.eventId];
 if(banquetEffect){if(context.eventId==='banquet-welcome')flag(next,'banquet_attended');return finishVerbalSourceV2(next,context,banquetEffect);}
 context.stage='decision';next.eventId='verbal-v2-decision';return next;
}
function advanceCore(run,options={}){
 if(!run.pending||run.completed)return run;
 const next=structuredClone(run);const last=next.history.at(-1),effect=next.pendingEffect;next.pending=false;next.pendingEffect=null;
 if(contentRules(next)>=38&&last.eventId==='chapter-resolution'){
  const context=next.chapterContext;if(!context)throw new Error('Missing chapter context');
  if(effect==='chapterExit')return finish(next,context.family);
  if(effect!=='chapterContinue')throw new Error('Invalid chapter resolution');
  next.chapterContext=null;next.eventId=context.eventId;next.verbalContext=context.verbal;next.rageContext=context.rage;
  if(context.verbal?.version===2)return advanceVerbalScenarioV2(run,next,last,'verbalV2Resolve');
  if(context.rage){
   const rage=context.rage;next.eventId=rage.eventId;next.rageContext=null;
   if(rage.phase==='result'){
    const history=next.history;next.history=history.slice(0,rage.historyLength);next.pending=true;next.pendingEffect=rage.pendingEffect;next.pendingFamily=rage.pendingFamily;
    const resumed=advance(next);resumed.history=history;return resumed;
   }
   return next;
  }
  throw new Error('Unavailable chapter continuation');
 }
 if(next.pendingFamily){
  if(contentRules(next)>=38&&needsChapterResolutionV38(next.pendingFamily)){
   next.chapterContext={family:next.pendingFamily,historyIndex:next.history.length-1,actionIndex:next.actions.length,eventId:run.eventId,pendingEffect:effect??null,verbal:next.verbalContext,rage:next.rageContext};
   next.flags[`chapter38_${next.pendingFamily}`]=next.history.length;next.verbalContext=null;next.rageContext=null;
   next.pendingFamily=null;next.eventId='chapter-resolution';return next;
  }
  return finish(next,next.pendingFamily);
 }
 if(contentRules(next)>=32&&['companyMarket','companyBuyer','companyVietnam','companyBack'].includes(effect)){
  if(effect==='companyBack'){next.eventId=next.companyContext.returnEventId;next.companyContext=null;}
  else{const route={companyMarket:'market',companyBuyer:'buyer',companyVietnam:'vietnam'}[effect];next.companyContext={returnEventId:last.eventId,historyLength:next.history.length-1,route};next.eventId=`company-v32-${route}`;}
  return next;
 }
 if(next.verbalContext?.version===2)return advanceVerbalScenarioV2(run,next,last,effect);
 if(contentRules(next)>=30&&VERBAL_EVENTS_V30.includes(last.eventId)){
  const context=next.verbalContext;if(!context)throw new Error('Missing verbal conversation');
  if(effect==='verbalLegal'){next.eventId='verbal-legal';return next;}
  if(effect==='verbalLegalResult'){next.eventId='verbal-legal-result';return next;}
  if(effect==='verbalWarning'){
   if(next.flags.post_pip_tolerance||(context.target==='wing'&&next.stats.boss<=3)){
    // A new outburst after PIP does not create an endless new improvement loop.
    next.verbalContext=null;next.resumeEventId=null;next.exitReturnEventId=null;next.breakReturnEventId=null;next.banquetReturnEventId=null;next.meltdownReturnEventId=null;next.raiseContext=null;next.salaryAdvice=null;next.mealContext=null;next.wealthReturnEventId=null;next.patronageContext=null;next.personnelPending=null;next.pip=null;next.flags.hr_pip_allowed=0;next.flags.boss_crisis_armed=0;next.eventId='dismissal-final';return next;
   }
   next.eventId='verbal-warning';return next;
  }
  if(effect==='verbalReturn'){
   next.eventId=context.eventId;next.verbalContext=null;
   if(context.phase==='result'){
    const fullHistory=next.history;next.history=fullHistory.slice(0,context.historyLength);
    next.pending=true;next.pendingEffect=context.pendingEffect;next.pendingFamily=context.pendingFamily;
    const resumed=advance(next);resumed.history=fullHistory;return resumed;
   }
   return next;
  }
 }
 if(contentRules(next)>=29&&effect==='patronageApply'){
  if(last.eventId!=='career-review'||!patronageEligibleV29(next)||!next.resumeEventId)throw new Error('Invalid patronage entry');
  next.patronageContext={returnEventId:next.resumeEventId,origin:'career',historyLength:next.history.length};next.resumeEventId=null;
  flag(next,'patronage_offers');next.flags.patronage_last_offer_work=patronageWorkCountV29(next);next.eventId=PATRONAGE_EVENT_V29;return next;
 }
 if(contentRules(next)>=29&&last.eventId===PATRONAGE_EVENT_V29&&['patronageAppoint','patronageReject','patronageReturn'].includes(effect)){
  if(!next.patronageContext)throw new Error('Missing patronage return');
  next.eventId=next.patronageContext.returnEventId;next.patronageContext=null;return next;
 }
 if(contentRules(next)>=27&&['wealthPlan','wealthStart','wealthRetire','wealthBack','wealthReturn'].includes(effect)){
  if(effect==='wealthPlan'){
   const eligibility=wealthEligibilityV27(next);
   if(next.wealthReturnEventId||!['exit-menu','rank-exit','career-exit'].includes(last.eventId)||!eligibility.eligible)throw new Error('Invalid wealth entry');
   next.wealthReturnEventId=last.eventId;next.eventId='wealth-plan';
   if(eligibility.startup)next.flags.wealth_startup_notice=1;
   if(eligibility.retirement)next.flags.wealth_retire_notice=1;
   return next;
  }
  if(!next.wealthReturnEventId||!WEALTH_EVENTS_V27.includes(last.eventId))throw new Error('Missing wealth return');
  if(effect==='wealthReturn'){
   if(last.eventId!=='wealth-plan')throw new Error('Invalid wealth return');
   next.eventId=next.wealthReturnEventId;next.wealthReturnEventId=null;return next;
  }
  if(effect==='wealthBack'){
   if(!['wealth-startup','wealth-retire'].includes(last.eventId))throw new Error('Invalid wealth back');
   next.eventId='wealth-plan';return next;
  }
  const eligibility=wealthEligibilityV27(next);
  if(last.eventId!=='wealth-plan'||!(effect==='wealthStart'?eligibility.startup:eligibility.retirement))throw new Error('Unavailable wealth plan');
  next.eventId=effect==='wealthStart'?'wealth-startup':'wealth-retire';return next;
 }

 if(contentRules(next)>=25){
  if(effect==='moodSelfDestruct'){next.eventId='mood-self-destruct';return next;}
  if(effect==='mealOpen'){
   if(next.mealContext||!['self-care','crisis-mood'].includes(last.eventId))throw new Error('Invalid meal origin');
   next.mealContext={origin:last.eventId,page:0,guest:null};next.eventId='meal-guests-a';return next;
  }
  if(['mealPage','mealPick','mealCancel','mealFinish',...(contentRules(next)>=34?['mealDeclined']:[])].includes(effect)){
   const context=next.mealContext;if(!context)throw new Error('Missing meal context');
   const choice=getEvent(run).choices[last.choiceIndex];
   if(effect==='mealPage'){context.page=choice.mealPage;context.guest=null;next.eventId=mealPageId(next,context.page);return next;}
   if(effect==='mealDeclined'){context.guest=null;next.eventId=mealPageId(next,context.page);return next;}
   if(effect==='mealPick'){context.guest=choice.mealTarget;next.eventId=`meal-with-${context.guest}`;return next;}
   if(effect==='mealCancel'){next.eventId=context.origin;next.mealContext=null;return next;}
   const returnId=context.origin==='self-care'?next.breakReturnEventId:next.resumeEventId;
   if(!returnId)throw new Error('Missing meal return');
   next.eventId=returnId;if(context.origin==='self-care')next.breakReturnEventId=null;else next.resumeEventId=null;next.mealContext=null;return next;
  }
 }
 if(contentRules(next)>=24&&effect==='salaryAdviceReturn'){
  const advice=next.salaryAdvice;
  if(!advice||advice.status!=='open'||!advice.returnEventId)throw new Error('Missing salary advice return');
  next.eventId=advice.returnEventId;advice.returnEventId=null;advice.status='done';return next;
 }
 if(contentRules(next)>=20){
  if(['laborClaim','laborMeeting','watchDispute','directDismissal'].includes(effect)){
   next.personnelPending=null;next.flags.hr_pip_allowed=0;
   next.eventId={laborClaim:'labor-claim',laborMeeting:'labor-mediation',watchDispute:'watch-review',directDismissal:'dismissal-final'}[effect];return next;
  }
  if(effect==='watchStart'){
   if(!next.flags.floor_watch){next.flags.floor_watch=1;next.flags.floor_watch_days=0;next.flags.watch_next_review=3;}
   next.pip=null;next.personnelPending=null;next.resumeEventId=null;next.flags.hr_pip_allowed=0;
   next.eventId=watchNextEvent(next);return next;
  }
  if(effect==='watchRecall'){
   next.flags.floor_watch=0;next.resumeEventId=null;next.eventId=nextNormal(next);return next;
  }
  if(effect==='watchContinue'){
   next.flags.watch_next_review=(next.flags.floor_watch_days||0)+3;next.eventId=watchNextEvent(next);return next;
  }
 }
 if(contentRules(next)>=19&&RAISE_EVENTS.includes(last.eventId)){
  if(['raiseOffer','raisePromise','raiseFury','raiseOffset'].includes(effect)&&last.eventId!=='raise-confirmation'){next.raiseContext.view=next.raiseContext.outcome;next.eventId=last.eventId==='raise-request'?'raise-response':'raise-confirmation';return next;}
  const returnId=next.raiseContext.eventId;next.raiseContext=null;
  if(effect==='raiseCancel'){next.eventId=returnId;return next;}
  next.resumeEventId=returnId;
 }
 if(contentRules(next)>=18&&['moodRecover','moodUnpaidLeave'].includes(effect)){next.eventId=next.meltdownReturnEventId;next.meltdownReturnEventId=null;return next;}
 if(contentRules(next)>=14&&effect==='rageReturn'){
  const context=next.rageContext;next.eventId=context.eventId;next.rageContext=null;
  if(contentRules(next)>=39&&context.phase==='event'){const source=getEvent(next),close=isPrivateSceneV39(source)?privateReturnEffectV39(source,next):null;if(close){next.pending=true;next.pendingEffect=close;next.pendingFamily=null;return advance(next);}}
  if(context.phase==='result'){
   // Resume the already committed choice using its own history entry. The
   // intervening rage result must not replace the original transition kind.
   const fullHistory=next.history;next.history=fullHistory.slice(0,context.historyLength);
   next.pending=true;next.pendingEffect=context.pendingEffect;next.pendingFamily=context.pendingFamily;
   const resumed=advance(next);resumed.history=fullHistory;return resumed;
  }
  return next;
 }
 if(contentRules(next)>=13&&effect==='rageReturn'){next.eventId=next.rageContext.eventId;next.rageContext=null;return next;}
 if(contentRules(next)>=14&&['rageAftermath','rageLegal','rageShowdown','ragePublic'].includes(effect)){next.eventId={rageAftermath:'rage-aftermath',rageLegal:'rage-legal',rageShowdown:'rage-showdown',ragePublic:'rage-public'}[effect];return next;}
 if(contentRules(next)>=13&&effect==='banquetDraw'){next.eventId='banquet-draw';return next;}
 if(contentRules(next)>=13&&effect==='banquetAfterparty'){next.eventId='banquet-afterparty';return next;}
 if(contentRules(next)>=13&&effect==='banquetFinish'){next.eventId=rankCompatibleReturn(next,next.banquetReturnEventId);next.banquetReturnEventId=null;return next;}
 if(contentRules(next)>=8&&effect==='careerPromote'){next.eventId=`career-duty-${next.rank}`;return next;}
 if(contentRules(next)>=11&&['educationSalary','educationDismissal'].includes(effect)){next.eventId=effect==='educationSalary'?'salary-cut':'crisis-boss';if(contentRules(next)>=20&&effect==='educationDismissal'){next.eventId='dismissal-final';next.flags.hr_pip_allowed=0;next.personnelPending=null;}return next;}
 if(contentRules(next)>=8&&effect==='rankHub'){next.eventId='rank-exit';return next;}
 if(contentRules(next)>=8&&effect==='legacyCareer'){next.eventId='career-exit';return next;}
 if(contentRules(next)>=8&&effect==='storyCareer'){next.eventId='story-exit';return next;}
 if(contentRules(next)>=8&&effect==='careerStepDown'){next.eventId='career-step-down';return next;}
 if(contentRules(next)>=8&&['careerDemoteStaff','careerDemoteDeputy'].includes(effect)){const returnId=next.exitReturnEventId||next.resumeEventId||(next.turn>=MAX_TURNS?'rank-exit':nextNormal(next));next.eventId=rankCompatibleReturn(next,returnId);next.exitReturnEventId=null;if(returnId===next.resumeEventId)next.resumeEventId=null;return next;}
 if(contentRules(next)>=7&&effect==='kindWorkDecline'){next.eventId=next.breakReturnEventId;next.breakReturnEventId=null;return next;}
 if(contentRules(next)>=6&&effect==='kindDecline'){next.eventId='self-care';return next;}
 if(rules2(next)&&['finishBreak','cancelBreak'].includes(effect)){next.eventId=next.breakReturnEventId;next.breakReturnEventId=null;return next;}
 if(effect==='paperwork'){next.eventId='paperwork';return next;}
 if(effect==='pipPassed'){next.eventId='pip-passed';return next;}
 if(effect==='salaryFinal'){next.eventId='salary-final';return next;}
 if(effect==='shortfall'){next.eventId='final-shortfall';next.turn=MAX_TURNS;if(contentRules(next)>=10&&next.pip?.active&&next.pip.remaining===0){next.resumeEventId=next.eventId;next.eventId='pip-review';}return next;}
 if(effect==='careerExit'){next.eventId=contentRules(next)>=8?'rank-exit':'career-exit';if(contentRules(next)>=10&&next.pip?.active&&next.pip.remaining===0){next.resumeEventId=next.eventId;next.eventId='pip-review';}return next;}
 if(effect==='return'&&next.exitReturnEventId){next.eventId=next.exitReturnEventId;next.exitReturnEventId=null;return next;}
 const normal=['daily','fantasy','onboarding'].includes(last.kind);
 if(normal){if(!next.seen.includes(last.eventId))next.seen.push(last.eventId);next.turn++;if(next.crisisCooldown>0)next.crisisCooldown--;}
 if(['return','resume','finishPip','startPip','promote','declinePromotion','educationDone','salaryAccept','salaryRescind','careerRegularize','careerTrain','careerDefer','careerResume'].includes(effect)&&next.resumeEventId){next.eventId=rankCompatibleReturn(next,next.resumeEventId);next.resumeEventId=null;}else if(normal)next.eventId=nextNormal(next);
 else if(last.kind==='career'||last.kind==='crisis'){next.eventId=next.resumeEventId||nextNormal(next);next.resumeEventId=null;}
 if(effect==='return')return next;
 if(normal&&!occasionalEducation(next)&&!next.educationReviewed){next.resumeEventId=next.eventId;next.eventId='education-review';return next;}
 if(next.pip?.active&&next.pip.remaining===0){next.resumeEventId=next.eventId;next.eventId='pip-review';return next;}
 if(next.stats.mood<=12&&(contentRules(next)<18||next.stats.mood>0)&&next.eventId!=='crisis-mood'){next.resumeEventId=next.eventId;next.eventId='crisis-mood';return next;}
 // A private daily scene can consume its own scheduled turn, but its closing
 // conversation is not an extra trigger for a workplace personnel review.
 if(options.privateV39)return next;
 // One early assessment, never on onboarding or inside a modal/PIP. If the
 // ordinary boss dispute is already imminent, expose its specific cause first.
 if(contentRules(next)>=11&&last.kind==='daily'&&!next.flags.education_risk_checked){
  const risk=educationRisk(next);
  if(next.turn>=next.flags.education_risk_due||(next.turn>=2&&next.stats.boss<=12&&risk.eligible)){
   next.flags.education_risk_checked=1;
   if(next.turn<=4&&!next.pip?.active&&!next.salaryCutOffered&&!next.resumeEventId&&!next.exitReturnEventId&&!next.breakReturnEventId&&risk.eligible&&roll(next)<risk.chance){
    next.flags.education_dispute=risk.reasons;next.flags.education_case_active=1;next.flags.boss_crisis_armed=0;next.educationReviewed=true;
    next.resumeEventId=next.eventId;next.eventId='education-scrutiny';return next;
   }
  }
 }
 if(!options.verbalV2&&next.stats.boss<=12&&!next.pip?.active&&next.crisisCooldown===0&&(contentRules(next)<10||next.flags.boss_crisis_armed===1)){
  if(contentRules(next)<20){if(contentRules(next)>=10)next.flags.boss_crisis_armed=0;next.resumeEventId=next.eventId;next.eventId='crisis-boss';return next;}
  // A passed PIP is not restarted by weather or a meter that stayed low.
  // A fresh choice queues its own decision, after any current modal closes.
  if(!next.flags.post_pip_tolerance&&!next.personnelPending&&personnelSafe(next,getEvent(next)))return openPersonnel(next,personnelDecision(next,'first',0,roll(next)));
 }
 if(normal&&!next.pip?.active&&!next.salaryCutOffered&&(contentRules(next)<25||next.pay>1)&&next.turn>=5&&next.turn<18&&next.stats.boss<55&&roll(next)<.3){
  const percent=15+Math.floor(roll(next)*21);next.salaryCutOffered=true;next.salaryCut={percent,from:next.pay,to:salaryCutTarget(next,percent),status:'pending'};next.resumeEventId=next.eventId;next.eventId='salary-cut';return next;
 }
 if(!(contentRules(next)>=20&&next.flags.floor_watch)&&!(contentRules(next)>=29&&next.patronage)&&contentRules(next)>=8&&normal&&!next.pip?.active&&next.turn>=3&&next.turn<careerReviewCutoff(next)&&careerReviewWait(next)&&next.rank<careerMaxRank(next)&&(contentRules(next)<9||careerReadiness(next).ready)&&(contentRules(next)<10||careerInvitationEligible(next))){next.resumeEventId=next.eventId;next.eventId='career-review';return next;}
 if(contentRules(next)<8&&normal&&!next.pip?.active&&next.turn<20&&next.turn-next.lastPromotion>=4&&(next.turn%6===0||next.stats.boss>=90)&&(next.rank<4)) {next.resumeEventId=next.eventId;next.eventId='promotion-review';return next;}
 if(contentRules(next)>=8&&last.kind==='onboarding'&&next.roleId==='executive'&&!next.flags.career_initial_briefing){flag(next,'career_initial_briefing');next.resumeEventId=next.eventId;next.eventId=`career-duty-${contentRules(next)>=17?5:2}`;return next;}
 if(normal&&occasionalEducation(next)&&!next.educationReviewed&&next.turn>=5&&next.turn<=16&&!next.pip&&!next.resumeEventId&&!next.exitReturnEventId&&getEvent(next)?.kind==='daily'&&roll(next)<.1){next.resumeEventId=next.eventId;next.eventId='education-review';}
 // The party occupies one optional three-scene interlude, after urgent HR/PIP
 // notifications. It never spends a workday or replaces a PIP assessment.
 if(contentRules(next)>=13&&last.kind==='daily'&&next.turn>=10&&next.turn<=18&&!next.flags.banquet_seen&&!next.pip?.active&&!next.resumeEventId&&!next.exitReturnEventId&&!next.breakReturnEventId&&!next.banquetReturnEventId&&getEvent(next)?.kind==='daily'&&roll(next)<.36){
  next.flags.banquet_seen=1;next.banquetReturnEventId=next.eventId;next.eventId='banquet-welcome';return next;
 }
 if(canKindDarkInviteV29(next)&&contentRules(next)>=7&&last.kind==='daily'&&!run.resumeEventId&&!run.exitReturnEventId&&!run.breakReturnEventId&&!next.resumeEventId&&!next.exitReturnEventId&&!next.breakReturnEventId&&next.lastBreakTurn!==next.turn&&next.turn-next.lastKindInviteTurn>=KIND_WORKDAY_COOLDOWN&&getEvent(next)?.kind==='daily'&&roll(next)<KIND_WORKDAY_CHANCE){
  next.breakReturnEventId=next.eventId;next.eventId='kind-workday';next.lastKindInviteTurn=next.turn;
 }
 return next;
}
export function advance(run,options={}){
 if(run?.patronageReplyContext){
  if(!run.pending||run.completed)return run;
  const next=structuredClone(run);next.eventId=next.patronageReplyContext.eventId;
  delete next.patronageReplyContext;next.pending=false;next.pendingEffect=null;
  return next;
 }
 const privateV39=contentRules(run)>=39&&run.pending&&!run.rageContext&&!run.verbalContext&&isPrivateSceneV39(getEvent(run));
 const next=advanceCore(run,privateV39?{...options,privateV39:true}:options);
 // The new decision owns the screen until answered. Deferred exhaustion,
 // mood and personnel transitions run only after a real continuation.
 if(contentRules(next)>=38&&next.chapterContext)return next;
 if(run.verbalContext?.version===2)return next;
 if(contentRules(next)>=30&&next.verbalContext)return next;
 if(contentRules(next)>=18&&run.pending&&!next.pending&&!next.completed&&next.stats.mood===0&&!next.rageContext&&!next.meltdownReturnEventId&&next.eventId!=='mood-collapse'){next.meltdownReturnEventId=next.eventId;next.eventId='mood-collapse';flag(next,'mood_crash_count');}
 if(!options.verbalV2&&!privateV39&&run.pending&&contentRules(next)>=20&&next.personnelPending&&!next.pip?.active&&personnelSafe(next,getEvent(next))){const pending=next.personnelPending;next.personnelPending=null;const decision=personnelDecision(next,pending.reason,pending.strength,roll(next));if(decision)openPersonnel(next,decision);}
 if(run.pending&&contentRules(next)>=24&&next.salaryAdvice?.status==='queued'&&personnelSafe(next,getEvent(next))){
  if(next.pay>=30)next.salaryAdvice=null;
  else{next.salaryAdvice.returnEventId=next.eventId;next.salaryAdvice.status='open';next.eventId='low-pay-tip';}
 }
 if(run.pending&&contentRules(next)>=27&&!next.completed&&!next.pending&&!next.wealthReturnEventId&&!next.pip?.active&&next.stats.mood>12&&next.stats.energy>15&&['daily','fantasy'].includes(run.history.at(-1)?.kind)&&personnelSafe(next,getEvent(next))){
  const eligibility=wealthEligibilityV27(next);
  if((eligibility.startup&&!next.flags.wealth_startup_notice)||(eligibility.retirement&&!next.flags.wealth_retire_notice)){
   next.wealthReturnEventId=next.eventId;next.eventId='wealth-plan';
   if(eligibility.startup)next.flags.wealth_startup_notice=1;
   if(eligibility.retirement)next.flags.wealth_retire_notice=1;
  }
 }
 if(run.pending&&contentRules(next)>=29&&!next.pending&&!next.completed&&['daily','fantasy'].includes(run.history.at(-1)?.kind)&&personnelSafe(next,getEvent(next))&&patronageEligibleV29(next)&&roll(next)<.2){
  next.patronageContext={returnEventId:next.eventId,origin:'automatic',historyLength:next.history.length};flag(next,'patronage_offers');next.flags.patronage_last_offer_work=patronageWorkCountV29(next);next.eventId=PATRONAGE_EVENT_V29;
 }
 return next;
}
export function canRequestBreak(run){return !!(run&&!run.chapterContext&&!run.companyContext&&rules2(run)&&!(contentRules(run)>=30&&run.verbalContext)&&!run.pending&&!run.completed&&!(contentRules(run)>=14&&run.rageContext)&&run.lastBreakTurn!==run.turn&&!run.resumeEventId&&!run.exitReturnEventId&&!run.breakReturnEventId&&['daily','fantasy'].includes(getEvent(run)?.kind));}
export function requestBreak(run){if(!canRequestBreak(run))return run;const next=structuredClone(run);next.actions.push({type:'break'});next.lastBreakTurn=next.turn;next.breakReturnEventId=next.eventId;const invite=canKindDarkInviteV29(next)&&contentRules(next)>=6&&!(contentRules(next)>=7&&next.lastKindInviteTurn===next.turn)&&roll(next)<KIND_BREAK_CHANCE;next.eventId=invite?'kind-break':'self-care';if(invite&&contentRules(next)>=7)next.lastKindInviteTurn=next.turn;return next;}
export function canRequestCareer(run){return !!(run&&!run.chapterContext&&!run.companyContext&&!(contentRules(run)>=30&&run.verbalContext)&&!(contentRules(run)>=29&&run.patronage)&&contentRules(run)>=10&&!(contentRules(run)>=20&&run.flags.floor_watch)&&!run.pending&&!run.completed&&!(contentRules(run)>=14&&run.rageContext)&&!run.pip?.active&&!run.resumeEventId&&!run.exitReturnEventId&&!run.breakReturnEventId&&run.rank<careerMaxRank(run)&&run.turn>=3&&run.turn<careerReviewCutoff(run)&&careerReviewWait(run)&&['daily','fantasy'].includes(getEvent(run)?.kind));}
export function requestCareer(run){if(!canRequestCareer(run))return run;const next=structuredClone(run);next.actions.push({type:'career'});next.resumeEventId=next.eventId;next.eventId='career-review';return next;}
export function canRequestRaise(run){return !run?.chapterContext&&!run?.companyContext&&!(run&&contentRules(run)>=30&&run.verbalContext)&&raiseAvailability(run).allowed;}
export function requestRaise(run){if(!canRequestRaise(run))return run;const next=structuredClone(run);next.actions.push({type:'raise'});next.raiseContext={eventId:run.eventId,fromPay:run.pay,offerPay:null,percent:null,outcome:null,view:null,approach:null};next.eventId='raise-request';return next;}
export function canRequestSalaryAdvice(run){
 if(!run||run.chapterContext||run.companyContext||contentRules(run)<28||run.pending||run.completed||run.pendingFamily||run.salaryAdvice!==null||run.actions.length>=299||!Number.isInteger(run.pay)||run.pay>=30||run.pay<1||run.stats.mood<=0||run.stats.energy<=0)return false;
 if(run.verbalContext||run.patronageContext||run.mealContext||run.wealthReturnEventId||run.personnelPending||run.actions.some(action=>action.type==='salary-advice')||run.history.some(row=>row.eventId==='low-pay-tip'))return false;
 const first=run.history.find(row=>row.eventId==='onboarding'),anchor=run.history.at(-1);
 if(first?.eventId!=='onboarding'||first.kind!=='onboarding'||!([0,1].includes(first.choiceIndex)||first.verbalOutcome?.version===2&&first.verbalOutcome.phase==='event')||!Number.isInteger(first.pay)||first.pay<1||first.pay>=30||anchor?.pay!==run.pay||createRun(run.roleId,run.seed).pay>=30)return false;
 return personnelSafe(run,getEvent(run));
}
export function requestSalaryAdvice(run){
 if(!canRequestSalaryAdvice(run))return run;
 const next=structuredClone(run);next.actions.push({type:'salary-advice'});
 next.salaryAdvice={from:run.history.find(row=>row.eventId==='onboarding').pay,to:run.pay,historyIndex:run.history.length-1,returnEventId:run.eventId,status:'open',origin:'starting-pay'};
 next.eventId='low-pay-tip';return next;
}
// This optional action leaves the original scene and its choice indices intact.
// Published lives change only after explicitly choosing the new response.
export function canRequestPatronageReply(run){
 if(!run||contentRules(run)<29||!run.patronage||run.pending||run.completed||run.pendingFamily||run.patronageReplyContext||run.chapterContext||run.companyContext||run.rageContext||run.verbalContext||run.stats.mood<=0||run.stats.energy<=0||run.stats.cash<=0||run.actions.length>=299||run.flags.patronage_reply_last_turn===run.turn+1)return false;
 const event=getEvent(run);
 return !!event&&!['rage','rage-world','verbal','patronage'].includes(event.kind)&&!['self-care','exit-menu','rank-exit','career-exit','story-exit',...WEALTH_EVENTS_V27].includes(event.id)&&!/^meal-guests-/.test(event.id)&&verbalTargetsV30(event).some(id=>Object.hasOwn(PERSONAS,id));
}
export function getPatronageReplyTargets(run){return canRequestPatronageReply(run)?verbalTargetsV30(getEvent(run)).filter(id=>Object.hasOwn(PERSONAS,id)):[];}
export function getPatronageReplyLine(run,target){
 const targets=getPatronageReplyTargets(run);
 return targets.includes(target)?patronageReplyLineV43(run,getEvent(run),target):'';
}
export function requestPatronageReply(run,target){
 if(!getPatronageReplyTargets(run).includes(target))return run;
 const event=getEvent(run),next=structuredClone(run),before={...run.stats};
 const outcomes=patronageReplyOutcomesV43(run,event,target,{affinity:characterAffinity(run,target).score});
 let ticket=roll(next)*outcomes.reduce((total,outcome)=>total+outcome.weight,0);
 const selected=outcomes.find(outcome=>(ticket-=outcome.weight)<0)||outcomes.at(-1),breakdown=[];
 const change=(source,label,delta)=>{
  const actual={};for(const [key,value]of Object.entries(delta)){
   const previous=next.stats[key];next.stats[key]=['mood','energy'].includes(key)?Math.max(1,clamp(previous+value)):clamp(previous+value);
   if(next.stats[key]!==previous)actual[key]=next.stats[key]-previous;
  }
  if(Object.keys(actual).length)breakdown.push({source,label,delta:actual});
 };
 change('choice',`自己人發話之後：${selected.label}`,selected.delta);
 change('ability-budget','三頭馬車的取捨',abilityRebalanceV18(before,next.stats));
 next.actions.push({type:'patronage-reply',version:1,eventId:event.id,target});
 flag(next,'patronage_replies');next.flags.patronage_reply_last_turn=run.turn+1;
 const mode=patronageReplyModeV43(target),title=mode==='flattery'?'自己人的名片，先往上遞。':'你把自己人的名片，放到話前面。';
 next.history.push({eventId:PATRONAGE_REPLY_EVENT_V43,kind:'patronage',title,body:`你以${run.patronage.title}的身分向${PERSONAS[target].name}開口。這句話已經說出去了；原本的選擇還在，繼續後回到剛才的對話。`,wing:'',speaker:target,sourceIds:['characterFiction'],turn:run.turn,choiceIndex:0,choiceText:patronageReplyLineV43(run,event,target),result:selected.result,chanceOutcome:null,delta:Object.fromEntries(STAT_KEYS.map(key=>[key,next.stats[key]-before[key]])),weather:null,jobTitle:jobTitle(next),pay:next.pay,breakdown,eventOutcome:{label:'自己人發話之後',result:selected.label},patronageOutcome:{version:1,origin:event.id,target,mode,reaction:selected.reaction,affinityDelta:selected.affinityDelta}});
 next.patronageReplyContext={version:1,eventId:event.id,historyIndex:next.history.length-1};
 next.eventId=PATRONAGE_REPLY_EVENT_V43;next.pending=true;next.pendingEffect='patronageReplyReturn';return next;
}
export function canRequestVerbal(run){
 if(run?.patronageReplyContext)return false;
 if(!run||run.chapterContext||run.companyContext||contentRules(run)<30||run.completed||run.verbalContext||run.rageContext||run.pendingFamily||run.lastVerbalTurn===run.turn||run.stats.mood<=0||run.stats.energy<=0||run.stats.cash<=0)return false;
 const event=getEvent(run);
 return !!event&&!VERBAL_EVENTS_V30.includes(event.id)&&!['rage','rage-world','verbal'].includes(event.kind);
}
export function getVerbalTargets(run){return canRequestVerbal(run)?verbalTargetsV30(getEvent(run)):[];}
const spokenLine=(run,event,target,phase)=>contentRules(run)>=39?strongVerbalLineV39({event,target,run,phase,base:verbalLineV2(run,event,target,phase)}):verbalLineV2(run,event,target,phase);
export function getVerbalLine(run,target){
 if(!canRequestVerbal(run))return '';
 const event=getEvent(run),targets=getVerbalTargets(run),selected=target??targets[0];
 return targets.includes(selected)?spokenLine(run,event,selected,run.pending?'result':'event'):'';
}
export function requestVerbal(run,target,version){
 if(version!==undefined&&version!==2)return run;
 if(!canRequestVerbal(run))return run;
 if(contentRules(run)>=39&&version!==2&&isPrivateSceneV39(getEvent(run)))return run;
 if(version===2){
  const targets=getVerbalTargets(run);if(target!==undefined&&(targets.length<2||!targets.includes(target)))return run;
  const next=structuredClone(run),source=getEvent(run),phase=run.pending?'result':'event',selected=target??targets[0];
  const action={type:'verbal',phase,eventId:source.id,version:2};if(target!==undefined)action.target=target;next.actions.push(action);
  next.verbalContext={version:2,eventId:source.id,speaker:source.speaker||'wing',target:selected,phase,historyLength:run.history.length,pendingEffect:run.pendingEffect??null,pendingFamily:null,outcome:null,legalResult:null,line:spokenLine(run,source,selected,phase),sourceKind:source.kind,sourceChoiceCount:source.choices.length,stage:'release'};
  next.pending=false;next.pendingEffect=null;next.pendingFamily=null;
  const resolved=applyChoice(next,0);resolved.actions.pop();return resolved;
 }

 const targets=getVerbalTargets(run);
 if(target!==undefined&&(targets.length<2||!targets.includes(target)))return run;
 const next=structuredClone(run),event=getEvent(run),phase=run.pending?'result':'event';
 const action={type:'verbal',phase,eventId:event.id};if(target!==undefined)action.target=target;next.actions.push(action);
 next.verbalContext={eventId:event.id,speaker:event.speaker||'wing',target:target??targets[0],phase,historyLength:run.history.length,pendingEffect:run.pendingEffect??null,pendingFamily:null,outcome:null,legalResult:null};
 next.eventId='verbal-release';next.pending=false;next.pendingEffect=null;next.pendingFamily=null;
 const resolved=applyChoice(next,0);
 // The real spoken sentence is the action. Its hidden internal draw is not a
 // second player choice and cannot be submitted independently to the Worker.
 resolved.actions.pop();return resolved;
}
export function canRequestRage(run){
 if(run?.patronageReplyContext)return false;
 if(!(run&&!run.chapterContext&&!run.companyContext&&contentRules(run)>=13&&!run.completed&&!run.rageContext&&!(contentRules(run)>=30&&run.verbalContext)&&!run.pendingFamily))return false;
 if(contentRules(run)>=18&&run.stats.mood===0)return false;
 if(contentRules(run)>=14)return run.flags.rage_last_turn!==run.turn+1&&!!conversationalTarget(run,getEvent(run));
 return true;
}
export function getRageTargets(run){
 if(!canRequestRage(run)||contentRules(run)<14)return [];
 const event=getEvent(run);return rageParticipantsFor(event,conversationalTarget(run,event));
}
export function requestRage(run,target){
 if(!canRequestRage(run))return run;
 // Omitting a target preserves the exact published action and RNG path. An
 // explicit target is available only when more than one person is present.
 if(target!==undefined){const targets=getRageTargets(run);if(targets.length<2||!targets.includes(target))return run;}
 if(contentRules(run)>=14){
  const next=structuredClone(run),event=getEvent(run),phase=run.pending?'result':'event';
  const action={type:'rage',phase,eventId:event.id};if(target!==undefined)action.target=target;next.actions.push(action);
  next.rageContext={eventId:event.id,speaker:event.speaker,target:target??conversationalTarget(run,event),phase,historyLength:run.history.length,pendingEffect:run.pendingEffect??null,pendingFamily:run.pendingFamily,mode:'unresolved'};
  next.eventId='rage-release';next.pending=false;next.pendingEffect=null;next.pendingFamily=null;
  const resolved=applyChoice(next,0);
  // The direct button itself commits this result. Its internal choice is not
  // part of the public protocol and cannot be submitted separately.
  resolved.actions.pop();resolved.rageContext.mode=resolved.pendingEffect==='rageAftermath'?'real':'imagined';if(contentRules(resolved)>=20&&resolved.rageContext.mode==='real')resolved.personnelPending=null;return resolved;
 }
 // A revealed result has already committed its choice. Normalize the pending
 // transition exactly as replay does; opening rage cannot undo that decision.
 const current=run.pending?advance(run):run;if(current.completed)return run;
 const next=structuredClone(current);next.actions.push({type:'rage'});
 next.rageContext={eventId:next.eventId,speaker:getEvent(next)?.speaker||'wing'};next.eventId='rage-menu';return next;
}
export function requestExit(run){if(run?.chapterContext||run?.companyContext)return run;if(run&&contentRules(run)>=30&&run.verbalContext)return run;if(run&&contentRules(run)>=20&&PERSONNEL_SCENES.includes(run.eventId))return run;if(!run||run.pending||run.completed||(contentRules(run)>=13&&run.rageContext)||(contentRules(run)>=19&&run.raiseContext)||(contentRules(run)>=24&&run.salaryAdvice?.status==='open'))return run;if(['mood-collapse',...(contentRules(run)>=29?[PATRONAGE_EVENT_V29]:[]),...(contentRules(run)>=27?WEALTH_EVENTS_V27:[]),...(contentRules(run)>=25?['mood-self-destruct',...mealEventIds(run)]:[]),'exit-menu','career-exit','self-care','kind-break','kind-workday','rank-exit','story-exit','career-step-down'].includes(run.eventId))return run;const next=structuredClone(run);next.actions.push({type:'exit'});next.exitReturnEventId=next.eventId;next.eventId='exit-menu';return next;}
function replayActions(roleId,seed,actions,count=actions.length){
 if(typeof seed!=='string'||seed.length>32||!Array.isArray(actions)||actions.length>300)throw new Error('Invalid replay');
 let run=createRun(roleId,seed);
 for(let actionIndex=0;actionIndex<count;actionIndex++){
  const action=actions[actionIndex],following=actions[actionIndex+1];
  if(!action||typeof action!=='object'||run.completed)throw new Error('Invalid replay action');
  if(action.type==='exit'){const next=requestExit(run);if(next===run)throw new Error('Duplicate exit');run=next;}
  else if(action.type==='break'){const next=requestBreak(run);if(next===run)throw new Error('Unavailable break');run=next;}
  else if(action.type==='career'){const next=requestCareer(run);if(next===run)throw new Error('Unavailable career review');run=next;}
  else if(action.type==='raise'){if(Object.keys(action).some(key=>key!=='type'))throw new Error('Invalid raise action');const next=requestRaise(run);if(next===run)throw new Error('Unavailable raise');run=next;}
  else if(action.type==='salary-advice'){
   if(Object.keys(action).some(key=>key!=='type'))throw new Error('Invalid salary advice action');
   const next=requestSalaryAdvice(run);if(next===run)throw new Error('Unavailable salary advice');run=next;
  }
  else if(action.type==='patronage-reply'){
   if(Object.keys(action).sort().join(',')!=='eventId,target,type,version'||action.version!==1||action.eventId!==run.eventId||typeof action.target!=='string')throw new Error('Patronage reply mismatch');
   const next=requestPatronageReply(run,action.target);if(next===run)throw new Error('Unavailable patronage reply');run=advance(next);
  }
  else if(action.type==='verbal'){
   const selected=Object.hasOwn(action,'target');
   if(contentRules(run)<30||action.phase!==(run.pending?'result':'event')||action.eventId!==run.eventId||Object.keys(action).some(key=>!['type','phase','eventId','target',...(action.version===2?['version']:[])].includes(key))||(Object.hasOwn(action,'version')&&action.version!==2)||(selected&&typeof action.target!=='string'))throw new Error('Verbal conversation mismatch');
   const next=requestVerbal(run,selected?action.target:undefined,action.version);if(next===run)throw new Error('Unavailable verbal conversation');run=advance(next);
  }
  else if(action.type==='rage'){
   const selected=Object.hasOwn(action,'target');
   if(contentRules(run)>=14&&(action.phase!==(run.pending?'result':'event')||action.eventId!==run.eventId||Object.keys(action).some(key=>!['type','phase','eventId','target'].includes(key))||(selected&&typeof action.target!=='string')))throw new Error('Rage conversation mismatch');
   if(contentRules(run)<14&&selected)throw new Error('Unavailable rage target');
   const next=selected?requestRage(run,action.target):requestRage(run);if(next===run)throw new Error('Unavailable rage');run=contentRules(run)>=14?advance(next):next;
  }
  else if(action.type==='choice'){
   if(action.eventId!==run.eventId||!Number.isInteger(action.index))throw new Error('Replay event mismatch');
   if(contentRules(run)>=14&&run.eventId==='rage-release')throw new Error('Direct rage cannot be chosen separately');
   if(contentRules(run)>=30&&(run.eventId==='verbal-release'||run.verbalContext?.version===2&&run.verbalContext.stage==='release'))throw new Error('Direct verbal cannot be chosen separately');
   const chosen=applyChoice(run,action.index);
   run=contentRules(run)>=14&&(following?.type==='rage'||contentRules(run)>=30&&following?.type==='verbal')&&following.phase==='result'?chosen:advance(chosen);
  }else throw new Error('Unknown replay action');
 }
 return run;
}
export function replayRun(roleId,seed,actions){return replayActions(roleId,seed,actions);}
export function validRun(run){
 try {
  if(Array.isArray(run?.actions)&&run.actions.some(action=>action?.type==='patronage-reply')){
   const last=run.actions.at(-1),prefix=run.pending?replayActions(run.roleId,run.seed,run.actions,run.actions.length-1):null;
   let canonical;
   if(!run.pending)canonical=replayRun(run.roleId,run.seed,run.actions);
   else if(last.type==='patronage-reply')canonical=requestPatronageReply(prefix,last.target);
   else if(last.type==='choice')canonical=applyChoice(prefix,last.index);
   else if(last.type==='verbal')canonical=requestVerbal(prefix,last.target,last.version);
   else if(last.type==='rage')canonical=requestRage(prefix,last.target);
   else return false;
   // Validate grammar and availability even when the final pending action is
   // reconstructed without advancing its already committed result.
   if(run.pending)replayRun(run.roleId,run.seed,run.actions);
   const actual={...run};delete actual.runId;
   const equal=(a,b)=>{
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b)||Array.isArray(a)&&a.length!==b.length)return false;
    // JSON storage omits optional undefined object fields; it must still
    // preserve every actual value, array entry and committed reaction.
    const left=Object.keys(a).filter(key=>a[key]!==undefined),right=Object.keys(b).filter(key=>b[key]!==undefined);
    return left.length===right.length&&right.every(key=>Object.hasOwn(a,key)&&equal(a[key],b[key]));
   };
   return equal(actual,canonical);
  }
  if(run?.patronageReplyContext!==undefined||run?.eventId===PATRONAGE_REPLY_EVENT_V43||run?.history?.some(row=>row?.patronageOutcome!==undefined||row?.kind==='patronage'||row?.eventId===PATRONAGE_REPLY_EVENT_V43)||Object.keys(run?.flags||{}).some(key=>key.startsWith('patronage_reply_')||key==='patronage_replies'))return false;
  if(/^e(?:38|39)-/.test(run?.seed||'')&&run.chapterContext){
   const lastAction=run.actions?.at(-1),prefix=run.pending&&lastAction?.type==='choice'?replayRun(run.roleId,run.seed,run.actions.slice(0,-1)):null;
   const canonical=prefix?applyChoice(prefix,lastAction.index):replayRun(run.roleId,run.seed,run.actions),actual={...run};delete actual.runId;
   const equal=(a,b)=>a===b||Boolean(a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(key=>Object.hasOwn(a,key)&&equal(a[key],b[key])));
   return equal(actual,canonical);
  }
  if(contentRules(run)>=38&&run.chapterContext!==null)return false;
  if(!run||run.version!==VERSION||!ROLE_MAP[run.roleId]||!ROLE_MAP[run.actualRoleId]||typeof run.seed!=='string'||run.seed.length>32||!Number.isInteger(run.rng)||run.rng<=0||run.rng>4294967295)return false;
  if(ROLE_MAP[run.roleId].minRules>contentRules(run)||ROLE_MAP[run.actualRoleId].minRules>contentRules(run))return false;
  if(!['honest','swapped','assistant'].includes(run.assignment)||!Number.isInteger(run.rank)||run.rank<0||run.rank>careerMaxRank(run)||!Number.isFinite(run.pay)||run.pay<1||run.pay>500||!Number.isInteger(run.turn)||run.turn<0||run.turn>MAX_TURNS)return false;
  if(contentRules(run)>=17&&((run.assignment==='assistant')!==(run.rank===0)))return false;
  if(run.roleId==='executive'&&(run.actualRoleId!=='executive'||run.assignment!=='honest'))return false;
  if(!Number.isInteger(run.offerPay)||run.offerPay<1||run.offerPay>300||!Number.isInteger(run.basePay)||run.basePay<1||run.basePay>300)return false;
  if(!run.education||typeof run.education.school!=='string'||typeof run.education.department!=='string'||!['學士','碩士','EMBA'].includes(run.education.degree)||!['public','private','overseas'].includes(run.education.sector)||!Number.isInteger(run.education.wingBias))return false;
  if(!run.abilityDice||!['skill','slack','lick'].every(k=>Array.isArray(run.abilityDice[k])&&run.abilityDice[k].length===3&&run.abilityDice[k].every(n=>Number.isInteger(n)&&n>=1&&n<=6)))return false;
  if(typeof run.educationReviewed!=='boolean'||typeof run.salaryCutOffered!=='boolean'||!Array.isArray(run.actions)||run.actions.length>300)return false;
  if(!run.actions.every(a=>a&&typeof a==='object'&&(a.type==='exit'||(a.type==='break'&&rules2(run))||(a.type==='career'&&contentRules(run)>=10)||(a.type==='raise'&&contentRules(run)>=19&&Object.keys(a).every(key=>key==='type'))||(a.type==='salary-advice'&&contentRules(run)>=28&&Object.keys(a).every(key=>key==='type'))||(a.type==='rage'&&contentRules(run)>=13&&(contentRules(run)<14?!Object.hasOwn(a,'target'):(['event','result'].includes(a.phase)&&typeof a.eventId==='string'&&a.eventId.length<=100&&(!Object.hasOwn(a,'target')||(typeof a.target==='string'&&a.target.length<=100))&&Object.keys(a).every(key=>['type','phase','eventId','target'].includes(key)))))||(a.type==='verbal'&&contentRules(run)>=30&&['event','result'].includes(a.phase)&&typeof a.eventId==='string'&&a.eventId.length<=100&&(!Object.hasOwn(a,'target')||typeof a.target==='string')&&(!Object.hasOwn(a,'version')||a.version===2)&&Object.keys(a).every(key=>['type','phase','eventId','target',...(a.version===2?['version']:[])].includes(key)))||(a.type==='choice'&&typeof a.eventId==='string'&&Number.isInteger(a.index)&&a.index>=0&&a.index<(contentRules(run)>=34&&['meal-guests-a','meal-guests-b'].includes(a.eventId)?11:10)))))return false;
  if(rules2(run)&&(!Number.isInteger(run.lastBreakTurn)||run.lastBreakTurn< -1||run.lastBreakTurn>run.turn||!(run.breakReturnEventId===null||typeof run.breakReturnEventId==='string')))return false;
  if(contentRules(run)>=7&&(!Number.isInteger(run.lastKindInviteTurn)||run.lastKindInviteTurn< -1||run.lastKindInviteTurn>run.turn))return false;
  const currentEventId=contentRules(run)>=30&&run.verbalContext?(run.meltdownReturnEventId&&['mood-collapse','mood-self-destruct'].includes(run.verbalContext.eventId)?run.meltdownReturnEventId:run.verbalContext.eventId):contentRules(run)>=18&&run.meltdownReturnEventId?run.meltdownReturnEventId:contentRules(run)>=13&&run.rageContext?run.rageContext.eventId:run.eventId;
  if(contentRules(run)>=30){
   if(!Number.isInteger(run.lastVerbalTurn)||run.lastVerbalTurn< -1||run.lastVerbalTurn>run.turn)return false;
   const releases=run.history.filter(row=>row.eventId==='verbal-release'||row.verbalOutcome?.version===2);
   if(releases.length!==new Set(releases.map(row=>row.turn)).size||run.lastVerbalTurn!==(releases.at(-1)?.turn??-1))return false;
   const context=run.verbalContext;
   if(context?.version===2){
    if(Object.keys(context).sort().join(',')!=='eventId,historyLength,legalResult,line,outcome,pendingEffect,pendingFamily,phase,sourceChoiceCount,sourceKind,speaker,stage,target,version'||run.rageContext||context.pendingFamily!==null)return false;
    if(!['event','result'].includes(context.phase)||!['release','warning','legal','legal-result','decision',...(contentRules(run)>=32?['aftermath']:[])].includes(context.stage)||!VERBAL_KINDS_V30.includes(context.outcome)||!(context.legalResult===null||VERBAL_LEGAL_RESULTS_V30.includes(context.legalResult))||typeof context.line!=='string'||!context.line.trim()||context.line.length>1200)return false;
    if(!Number.isInteger(context.historyLength)||context.historyLength<0||context.historyLength>=run.history.length||!Number.isInteger(context.sourceChoiceCount)||context.sourceChoiceCount<1||context.sourceChoiceCount>12||!(context.pendingEffect===null||typeof context.pendingEffect==='string'))return false;
    const source=getEvent({...run,eventId:context.eventId,verbalContext:null}),action=run.actions.findLast(item=>item.type==='verbal'),selected=action&&Object.hasOwn(action,'target');
    if(!source||(source.speaker||'wing')!==context.speaker||source.kind!==context.sourceKind||['rage','rage-world','verbal'].includes(source.kind)||!action||action.version!==2||action.eventId!==context.eventId||action.phase!==context.phase)return false;
    if(contentRules(run)>=39&&isPrivateSceneV39(source)&&(context.outcome==='personnel'||!['release','legal','legal-result'].includes(context.stage)))return false;
    const targets=verbalTargetsV30(source);if(selected?(targets.length<2||!targets.includes(action.target)||context.target!==action.target):context.target!==targets[0])return false;
    if(context.phase==='result'&&(context.historyLength===0||run.history[context.historyLength-1]?.eventId!==context.eventId))return false;
    const row=run.history[context.historyLength],evidence=row?.verbalOutcome;
    if(row?.eventId!==context.eventId||row.choiceIndex!==context.sourceChoiceCount||row.choiceText!==context.line||evidence?.version!==2||evidence.kind!==context.outcome||evidence.target!==context.target||evidence.origin!==context.eventId||evidence.phase!==context.phase)return false;
    if(context.stage==='release'?(run.eventId!==context.eventId||!run.pending):run.eventId!==(context.stage==='aftermath'?'verbal-v32-aftermath':`verbal-v2-${context.stage}`))return false;
    if(context.stage==='warning'&&context.outcome!=='personnel'||['legal','legal-result'].includes(context.stage)&&context.outcome!=='legal'||context.stage==='legal-result'&&context.legalResult===null)return false;
   }else if(context!==null){
    if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).sort().join(',')!=='eventId,historyLength,legalResult,outcome,pendingEffect,pendingFamily,phase,speaker,target')return false;
    if(!VERBAL_EVENTS_V30.includes(run.eventId)||VERBAL_EVENTS_V30.includes(context.eventId)||run.rageContext||context.pendingFamily!==null||!['event','result'].includes(context.phase)||!VERBAL_KINDS_V30.includes(context.outcome)||!(context.legalResult===null||VERBAL_LEGAL_RESULTS_V30.includes(context.legalResult)))return false;
    if(!Number.isInteger(context.historyLength)||context.historyLength<0||context.historyLength>=run.history.length||!(context.pendingEffect===null||typeof context.pendingEffect==='string'))return false;
    const source=getEvent({...run,eventId:context.eventId,verbalContext:null});
    if(!source||(source.speaker||'wing')!==context.speaker||['rage','rage-world','verbal'].includes(source.kind))return false;
    if(contentRules(run)>=39&&isPrivateSceneV39(source))return false;
    const targets=verbalTargetsV30(source),action=run.actions.findLast(item=>item.type==='verbal'),selected=action&&Object.hasOwn(action,'target');
    if(!action||action.eventId!==context.eventId||action.phase!==context.phase)return false;
    if(selected?(targets.length<2||!targets.includes(action.target)||context.target!==action.target):context.target!==targets[0])return false;
    if(context.phase==='result'&&(context.historyLength===0||run.history[context.historyLength-1]?.eventId!==context.eventId))return false;
    const row=run.history[context.historyLength];
    if(row?.eventId!=='verbal-release'||row.verbalOutcome?.kind!==context.outcome||row.verbalOutcome?.target!==context.target||row.verbalOutcome?.origin!==context.eventId||row.verbalOutcome?.phase!==context.phase)return false;
    if(run.eventId==='verbal-warning'&&context.outcome!=='personnel'||['verbal-legal','verbal-legal-result'].includes(run.eventId)&&context.outcome!=='legal'||run.eventId==='verbal-legal-result'&&!VERBAL_LEGAL_RESULTS_V30.includes(context.legalResult))return false;
   }else if(VERBAL_EVENTS_V30.includes(run.eventId)||VERBAL_V2_EVENTS.includes(run.eventId)||contentRules(run)>=32&&VERBAL_OUTCOME_EVENTS_V32.includes(run.eventId))return false;
   for(const row of run.history){
    if(row.verbalOutcome?.version===2){
     const evidence=row.verbalOutcome;
     if(Object.keys(evidence).sort().join(',')!=='affinityDelta,kind,origin,phase,target,version'||evidence.origin!==row.eventId||evidence.target!==row.speaker||!VERBAL_KINDS_V30.includes(evidence.kind)||!(evidence.target==='self'||Object.hasOwn(PERSONAS,evidence.target))||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||!['event','result'].includes(evidence.phase)||!Number.isInteger(row.choiceIndex)||row.choiceIndex<1||row.choiceIndex>12||!['daily','fantasy','onboarding','verbal'].includes(row.kind)||evidence.phase==='result'&&row.kind!=='verbal')return false;
     if(evidence.target==='self'&&(evidence.affinityDelta!==0||['relationship','personnel','legal'].includes(evidence.kind)))return false;
    }else if(row.eventId==='verbal-release'){
     const evidence=row.verbalOutcome;
     if(row.kind!=='verbal'||row.choiceIndex!==0||!evidence||typeof evidence!=='object'||Object.keys(evidence).sort().join(',')!=='affinityDelta,kind,origin,phase,target'||!VERBAL_KINDS_V30.includes(evidence.kind)||evidence.target!==row.speaker||!(evidence.target==='self'||Object.hasOwn(PERSONAS,evidence.target))||!Number.isInteger(evidence.affinityDelta)||evidence.affinityDelta< -60||evidence.affinityDelta>12||typeof evidence.origin!=='string'||!['event','result'].includes(evidence.phase))return false;
     if(evidence.target==='self'&&(evidence.affinityDelta!==0||['relationship','personnel','legal'].includes(evidence.kind)))return false;
    }else if(row.verbalOutcome!==undefined)return false;
   }
  }
  if(contentRules(run)>=29){
   if(!['male','female'].includes(run.characterGender)||createRun(run.roleId,run.seed).characterGender!==run.characterGender)return false;
   const appointment=run.patronage,context=run.patronageContext,offers=run.flags.patronage_offers||0,attempts=run.flags.patronage_attempts||0;
   if(!Number.isInteger(offers)||offers<0||offers>2||!Number.isInteger(attempts)||attempts<0||attempts>offers)return false;
   if(offers>0&&(!Number.isInteger(run.flags.patronage_last_offer_work)||run.flags.patronage_last_offer_work<3||run.flags.patronage_last_offer_work>patronageWorkCountV29(run)))return false;
   const attemptsInHistory=run.history.filter(row=>row.eventId===PATRONAGE_EVENT_V29&&[0,1].includes(row.choiceIndex));
   if(attemptsInHistory.length!==attempts)return false;
   if(appointment!==null){
    if(!appointment||typeof appointment!=='object'||Array.isArray(appointment)||Object.keys(appointment).sort().join(',')!=='appointedPay,fromPay,historyIndex,title')return false;
    if(appointment.title!==(run.characterGender==='female'?'乾女兒':'乾兒子')||!Number.isInteger(appointment.historyIndex)||appointment.historyIndex<1||appointment.historyIndex>=run.history.length)return false;
    const row=run.history[appointment.historyIndex],previous=run.history[appointment.historyIndex-1];
    if(!Number.isInteger(appointment.fromPay)||appointment.fromPay<1||appointment.fromPay>500||appointment.appointedPay!==Math.min(500,Math.max(appointment.fromPay+8,Math.round(appointment.fromPay*1.15))))return false;
    if(previous?.pay!==appointment.fromPay||row?.eventId!==PATRONAGE_EVENT_V29||row.kind!=='career'||row.speaker!=='wing'||![0,1].includes(row.choiceIndex)||row.chanceOutcome!=='success'||row.jobTitle!==appointment.title||row.pay!==appointment.appointedPay)return false;
   }else if(attemptsInHistory.some(row=>row.chanceOutcome==='success'))return false;
   if(context!==null){
    if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).sort().join(',')!=='historyLength,origin,returnEventId'||!['automatic','career'].includes(context.origin)||typeof context.returnEventId!=='string'||context.returnEventId===PATRONAGE_EVENT_V29||!Number.isInteger(context.historyLength)||context.historyLength<1||context.historyLength>run.history.length)return false;
    if(currentEventId!==PATRONAGE_EVENT_V29||!['daily','fantasy'].includes(getEvent({...run,eventId:context.returnEventId,patronageContext:null})?.kind))return false;
    const entry=run.history[context.historyLength-1];
    if(context.origin==='career'?(entry.eventId!=='career-review'||entry.choiceIndex!==4):!['daily','fantasy'].includes(entry.kind))return false;
    if(run.resumeEventId||run.exitReturnEventId||run.breakReturnEventId||run.banquetReturnEventId||run.wealthReturnEventId||run.raiseContext||offers<1)return false;
   }else if(currentEventId===PATRONAGE_EVENT_V29)return false;
   if(!canKindDarkInviteV29(run)&&['kind-break','kind-workday'].includes(currentEventId))return false;
  }
  if(contentRules(run)>=24){
   const advice=run.salaryAdvice;
   if(advice?.origin==='starting-pay'){
    if(contentRules(run)<28||typeof advice!=='object'||Array.isArray(advice)||Object.keys(advice).sort().join(',')!=='from,historyIndex,origin,returnEventId,status,to'||!['open','done'].includes(advice.status))return false;
    const first=run.history.find(row=>row.eventId==='onboarding'),anchor=run.history[advice.historyIndex];
    if(!Number.isInteger(advice.from)||advice.from<1||advice.from>=30||!Number.isInteger(advice.to)||advice.to<1||advice.to>=30||!Number.isInteger(advice.historyIndex)||advice.historyIndex<0||advice.historyIndex>=run.history.length)return false;
    if(first?.eventId!=='onboarding'||first.kind!=='onboarding'||!([0,1].includes(first.choiceIndex)||first.verbalOutcome?.version===2&&first.verbalOutcome.phase==='event')||first.pay!==advice.from||anchor?.pay!==advice.to||createRun(run.roleId,run.seed).pay>=30)return false;
    if(run.actions.filter(action=>action.type==='salary-advice').length!==1)return false;
    const entryIndex=run.actions.findIndex(action=>action.type==='salary-advice'),entry=replayRun(run.roleId,run.seed,run.actions.slice(0,entryIndex));
    if(!canRequestSalaryAdvice(entry)||entry.history.length-1!==advice.historyIndex||entry.pay!==advice.to||entry.history.find(row=>row.eventId==='onboarding')?.pay!==advice.from||advice.status==='open'&&entry.eventId!==advice.returnEventId)return false;
    if(run.history.slice(0,advice.historyIndex+1).some(row=>row.eventId==='low-pay-tip'))return false;
    if(advice.status==='open'){
     if(run.pay!==advice.to||typeof advice.returnEventId!=='string'||advice.returnEventId==='low-pay-tip'||!['daily','fantasy'].includes(getEvent({...run,eventId:advice.returnEventId})?.kind)||currentEventId!=='low-pay-tip')return false;
     if(run.resumeEventId||run.exitReturnEventId||run.breakReturnEventId||run.banquetReturnEventId||run.raiseContext||run.mealContext||run.wealthReturnEventId||run.patronageContext)return false;
    }else if(advice.returnEventId!==null||currentEventId==='low-pay-tip'||!run.history.slice(advice.historyIndex+1).some(row=>row.eventId==='low-pay-tip'&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0))return false;
   }else if(advice!==null){
    if(!advice||typeof advice!=='object'||Array.isArray(advice)||Object.keys(advice).sort().join(',')!=='from,historyIndex,returnEventId,status,to')return false;
    if(!Number.isInteger(advice.from)||advice.from<2||advice.from>500||!Number.isInteger(advice.to)||advice.to<1||advice.to>=30||advice.to>=advice.from||!Number.isInteger(advice.historyIndex)||advice.historyIndex<1||advice.historyIndex>=run.history.length||!['queued','open','done'].includes(advice.status))return false;
    const before=run.history[advice.historyIndex-1],reduction=run.history[advice.historyIndex];
    if(before?.pay!==advice.from||reduction?.pay!==advice.to||!['salary-cut','salary-final','career-step-down','mood-collapse',...(contentRules(run)>=25?['mood-self-destruct']:[])].includes(reduction.eventId))return false;
    if(advice.status==='open'){
     if(typeof advice.returnEventId!=='string'||advice.returnEventId==='low-pay-tip'||!['daily','fantasy'].includes(getEvent({...run,eventId:advice.returnEventId})?.kind)||currentEventId!=='low-pay-tip')return false;
     if(run.resumeEventId||run.exitReturnEventId||run.breakReturnEventId||run.banquetReturnEventId||run.raiseContext)return false;
    }else{
     if(advice.returnEventId!==null||currentEventId==='low-pay-tip')return false;
     if(advice.status==='queued'&&run.pay>=30)return false;
     if(advice.status==='done'&&!run.history.some(row=>row.eventId==='low-pay-tip'))return false;
    }
   }else if(currentEventId==='low-pay-tip')return false;
  }
  if(contentRules(run)>=20){
   const pending=run.personnelPending;
   if(pending!==null){
    if(!pending||Array.isArray(pending)||Object.keys(pending).sort().join(',')!=='reason,source,strength'||!['first','post-pip','passed'].includes(pending.reason)||!Number.isInteger(pending.strength)||pending.strength<0||pending.strength>100||typeof pending.source!=='string'||!run.history.some(row=>row.eventId===pending.source))return false;
    if(pending.reason==='passed'&&(pending.source!=='pip-passed'||pending.strength!==0))return false;
    if(pending.reason==='post-pip'&&!run.flags.post_pip_tolerance)return false;
   }
   for(const key of ['floor_watch','post_pip_tolerance','hr_pip_allowed'])if(run.flags[key]!==undefined&&![0,1].includes(run.flags[key]))return false;
   if((run.flags.floor_watch_days||0)>24||(run.flags.watch_next_review||0)>27||run.pipCount>2)return false;
   if(WATCH_DAILY_IDS.includes(currentEventId)&&!run.flags.floor_watch)return false;
  }
  if(contentRules(run)>=19){
   const context=run.raiseContext;
   if(context!==null){
    if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).some(key=>!['eventId','fromPay','offerPay','percent','outcome','view','approach'].includes(key)))return false;
    if(typeof context.eventId!=='string'||RAISE_EVENTS.includes(context.eventId)||!['daily','fantasy'].includes(getEvent({...run,eventId:context.eventId})?.kind)||!RAISE_EVENTS.includes(currentEventId))return false;
    if(!Number.isInteger(context.fromPay)||context.fromPay<1||context.fromPay>500||!(context.offerPay===null||(Number.isInteger(context.offerPay)&&context.offerPay>context.fromPay&&context.offerPay<=raisePayCeiling(run))))return false;
    if(!(context.percent===null||(Number.isInteger(context.percent)&&context.percent>=4&&context.percent<=11))||![null,'offer','promise','fury','offset'].includes(context.outcome)||![null,'offer','promise','fury','offset'].includes(context.view)||![null,'merit','politics','seal'].includes(context.approach))return false;
    if(['offer','offset'].includes(context.outcome)&&context.offerPay===null)return false;
    if(currentEventId!=='raise-request'&&context.view===null)return false;
   }else if(RAISE_EVENTS.includes(currentEventId))return false;
   if((run.flags.raise_attempts??0)>3||(run.flags.raise_last_work??0)>workCount(run))return false;
  }
  if(contentRules(run)>=27){
   const returnId=run.wealthReturnEventId;
   if(!(returnId===null||typeof returnId==='string'))return false;
   if(returnId!==null){
    if(WEALTH_EVENTS_V27.includes(returnId)||!WEALTH_EVENTS_V27.includes(currentEventId))return false;
    const source=getEvent({...run,eventId:returnId,wealthReturnEventId:null});
    if(!source||!(['exit-menu','rank-exit','career-exit'].includes(returnId)||['daily','fantasy'].includes(source.kind)))return false;
   }else if(WEALTH_EVENTS_V27.includes(currentEventId))return false;
   for(const key of ['wealth_startup_notice','wealth_retire_notice'])if(run.flags[key]!==undefined&&![0,1].includes(run.flags[key]))return false;
  }
  if(contentRules(run)>=25){
   const context=run.mealContext;
   if(context!==null){
    if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).sort().join(',')!=='guest,origin,page'||!['self-care','crisis-mood'].includes(context.origin)||!(contentRules(run)>=37?[0,1,2]:[0,1]).includes(context.page)||!(context.guest===null||mealGuestIds(run).includes(context.guest)))return false;
    const expected=context.guest===null?mealPageId(run,context.page):`meal-with-${context.guest}`;
    if(currentEventId!==expected)return false;
    if(context.origin==='self-care'?(!run.breakReturnEventId||run.resumeEventId):(!run.resumeEventId||run.breakReturnEventId))return false;
    if(run.exitReturnEventId||run.raiseContext||run.banquetReturnEventId)return false;
   }else if(mealEventIds(run).includes(currentEventId))return false;
  }
  if(contentRules(run)>=18){if(!(run.meltdownReturnEventId===null||typeof run.meltdownReturnEventId==='string'))return false;if((['mood-collapse',...(contentRules(run)>=25?['mood-self-destruct']:[])].includes(contentRules(run)>=30&&run.verbalContext?run.verbalContext.eventId:run.eventId))!==(typeof run.meltdownReturnEventId==='string'))return false;if(['mood-collapse',...(contentRules(run)>=25?['mood-self-destruct']:[])].includes(run.meltdownReturnEventId))return false;if(run.meltdownReturnEventId&&!getEvent({...run,eventId:run.meltdownReturnEventId,meltdownReturnEventId:null}))return false;const total=run.stats.skill+run.stats.slack+run.stats.lick;if(total>180)return false;}
  if(rules2(run)&&run.breakReturnEventId!==null&&(!['self-care',...(contentRules(run)>=6?['kind-break']:[]),...(contentRules(run)>=7?['kind-workday']:[]),...(contentRules(run)>=25&&run.mealContext?.origin==='self-care'?mealEventIds(run):[])].includes(currentEventId)||!['daily','fantasy'].includes(getEvent({...run,eventId:run.breakReturnEventId})?.kind)))return false;
  if(contentRules(run)>=7&&currentEventId==='kind-workday'&&getEvent({...run,eventId:run.breakReturnEventId})?.kind!=='daily')return false;
  if(contentRules(run)>=13){
   if(contentRules(run)>=14){
    if(run.rageContext!==null){
     const context=run.rageContext;
     if(!context||typeof context!=='object'||!RAGE_WORLD_EVENTS.includes(run.eventId)||typeof context.eventId!=='string'||RAGE_WORLD_EVENTS.includes(context.eventId)||context.eventId==='rage-menu'||!['event','result'].includes(context.phase)||!['imagined','real'].includes(context.mode)||!Number.isInteger(context.historyLength)||context.historyLength<0||context.historyLength>=run.history.length||!(context.pendingEffect===null||typeof context.pendingEffect==='string')||context.pendingFamily!==null)return false;
     const source=getEvent({...run,eventId:context.eventId});
     if(!source||source.speaker!==context.speaker)return false;
     if(contentRules(run)>=39&&isPrivateSceneV39(source)&&run.pendingFamily!==null)return false;
     const action=run.actions.findLast(a=>a.type==='rage'),selected=action&&Object.hasOwn(action,'target');
     if(!action||action.eventId!==context.eventId||action.phase!==context.phase)return false;
     const defaultTarget=conversationalTarget(run,source),targets=rageParticipantsFor(source,defaultTarget);
     if(selected?(targets.length<2||!targets.includes(action.target)||context.target!==action.target):context.target!==defaultTarget)return false;
     if(context.phase==='result'&&(context.historyLength===0||run.history[context.historyLength-1]?.eventId!==context.eventId))return false;
     if(run.eventId!=='rage-release'&&context.mode!=='real')return false;
    }
    if((RAGE_WORLD_EVENTS.includes(run.eventId)&&!run.rageContext)||run.eventId==='rage-menu')return false;
   }else{
    if(run.rageContext!==null&&(!run.rageContext||typeof run.rageContext!=='object'||run.eventId!=='rage-menu'||typeof run.rageContext.eventId!=='string'||run.rageContext.eventId==='rage-menu'||typeof run.rageContext.speaker!=='string'||!getEvent({...run,eventId:run.rageContext.eventId})))return false;
    if(run.eventId==='rage-menu'&&!run.rageContext)return false;
   }
   if(run.banquetReturnEventId!==null&&(typeof run.banquetReturnEventId!=='string'||getEvent({...run,eventId:run.banquetReturnEventId})?.kind!=='daily'||!(['banquet-welcome','banquet-draw','banquet-afterparty'].includes(currentEventId)||['banquet-welcome','banquet-draw','banquet-afterparty'].includes(run.exitReturnEventId))))return false;
   if(['banquet-welcome','banquet-draw','banquet-afterparty'].includes(currentEventId)&&!run.banquetReturnEventId)return false;
   if(run.flags.rage_last_turn!==undefined&&(!Number.isInteger(run.flags.rage_last_turn)||run.flags.rage_last_turn<1||run.flags.rage_last_turn>run.turn+1))return false;
  }
  if(run.salaryCut&&(!Number.isInteger(run.salaryCut.from)||!Number.isInteger(run.salaryCut.to)||run.salaryCut.to<1||run.salaryCut.to>run.salaryCut.from||!Number.isInteger(run.salaryCut.percent)||!['pending','accepted','rescinded'].includes(run.salaryCut.status)))return false;
  if(!run.stats||!STAT_KEYS.every(k=>Number.isFinite(run.stats[k])&&run.stats[k]>=0&&run.stats[k]<=100))return false;
  if(!run.flags||Array.isArray(run.flags)||typeof run.flags!=='object'||!Object.entries(run.flags).every(([name,n])=>Number.isInteger(n)&&n>=0&&n<=(contentRules(run)>=18&&name==='cash_spent_total'?10000:500)))return false;
  if(contentRules(run)>=8&&(!Number.isInteger(run.flags.career_peak_rank)||run.flags.career_peak_rank<run.rank||run.flags.career_peak_rank>careerMaxRank(run)))return false;
  if(contentRules(run)>=9&&!Number.isInteger(run.flags.career_service))return false;
  if(contentRules(run)>=10&&![0,1].includes(run.flags.boss_crisis_armed))return false;
 if(contentRules(run)>=11&&(!Number.isInteger(run.flags.education_risk_due)||run.flags.education_risk_due<2||run.flags.education_risk_due>4||![0,1].includes(run.flags.education_risk_checked)||![0,1].includes(run.flags.education_case_active)||!Number.isInteger(run.flags.education_dispute)||run.flags.education_dispute<0||run.flags.education_dispute>15||![0,1,2].includes(run.flags.education_outcome)))return false;
  if(contentRules(run)>=32){
   const context=run.companyContext;
   if(context!==null){
    if(!context||typeof context!=='object'||Array.isArray(context)||Object.keys(context).sort().join(',')!=='historyLength,returnEventId,route'||!['market','buyer','vietnam'].includes(context.route)||context.returnEventId!==FANTASY_EVENTS[3].id||!Number.isInteger(context.historyLength)||context.historyLength<0||context.historyLength>=run.history.length||run.eventId!==`company-v32-${context.route}`||run.verbalContext||run.rageContext)return false;
    const row=run.history[context.historyLength];if(row.eventId!==context.returnEventId||row.kind!=='fantasy'||row.choiceIndex!==['market','buyer','vietnam'].indexOf(context.route))return false;
   }else if(COMPANY_EVENTS_V32.includes(run.eventId))return false;
  }
  if(!Array.isArray(run.history)||run.history.length>300||!Array.isArray(run.seen)||typeof run.pending!=='boolean'||typeof run.completed!=='boolean'||!Number.isInteger(run.pipCount)||run.pipCount<0||!Number.isInteger(run.crisisCooldown))return false;
  if(run.pip&&(!Number.isInteger(run.pip.remaining)||run.pip.remaining<0||run.pip.remaining>3||typeof run.pip.active!=='boolean'))return false;
  if(run.completed){if(run.pending||run.eventId!==null||!ENDINGS.some(e=>e.id===run.endingId&&e.roleId===run.roleId&&(e.minRules||1)<=contentRules(run)))return false;}else {if(typeof run.eventId!=='string'||!getEvent(run))return false;}
  if(run.pending&&!run.history.length)return false;
  if(run.pendingFamily!==null&&!ENDINGS.some(e=>e.id===`${run.pendingFamily}-${run.roleId}`&&(e.minRules||1)<=contentRules(run)))return false;
  if(run.history.some(row=>row.mealOutcome!==undefined&&!isMealOutcomeV36(run,row)||contentRules(run)>=36&&row.kind==='self-care'&&row.eventId===`meal-with-${row.speaker}`&&Object.hasOwn(PERSONAS,row.speaker)&&[0,1].includes(row.choiceIndex)&&!isMealOutcomeV36(run,row)))return false;
  if(run.history.some(h=>h?.eventOutcome&&(![h.eventOutcome.label,h.eventOutcome.result].every(v=>typeof v==='string'&&v.length<=100))))return false;
  return run.history.every(h=>h&&typeof h.eventId==='string'&&typeof h.title==='string'&&typeof h.choiceText==='string'&&typeof h.result==='string'&&Array.isArray(h.sourceIds)&&h.delta&&STAT_KEYS.every(k=>Number.isFinite(h.delta[k])&&Math.abs(h.delta[k])<=100)&&(!rules2(run)||(Array.isArray(h.breakdown)&&h.breakdown.every(part=>part&&typeof part.source==='string'&&typeof part.label==='string'&&part.delta&&Object.entries(part.delta).every(([k,v])=>STAT_KEYS.includes(k)&&Number.isFinite(v)&&Math.abs(v)<=100)))));
 }catch{return false;}
}
