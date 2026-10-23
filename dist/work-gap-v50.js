// A published seed keeps its original timing. New lives have a real pause
// between completed work scenes; the selected next scene stays unrevealed.
import {isRecruitmentV60} from './seed-profile-v60.js';
export const WORK_GAP_EVENT_V50='work-gap-v50';
export const isWorkGapV50=run=>isRecruitmentV60(run)||/^e39-cal46-kin49-g-/.test(typeof run==='string'?run:run?.seed||'');

export function workGapSurfaceSafeV50(run,source){
 if(!isWorkGapV50(run)||run.flags?.work_gap_open!==1||run.pending||run.completed||run.pendingFamily||!['daily','fantasy'].includes(source?.kind))return false;
 if(run.treatsContext||run.recruitmentContext||run.activityInvitationContext||run.hiddenEncounterContext||run.activityContext||run.patronageReplyContext||run.chapterContext||run.companyContext||run.rageContext||run.verbalContext||run.raiseContext||run.patronageContext||run.mealContext||run.personnelPending)return false;
 if(run.resumeEventId||run.exitReturnEventId||run.breakReturnEventId||run.banquetReturnEventId||run.meltdownReturnEventId||run.wealthReturnEventId||run.salaryAdvice?.status==='open'||run.salaryAdvice?.status==='queued')return false;
 return run.stats.mood>0&&run.stats.energy>0&&run.stats.cash>0;
}

export function getWorkGapEventV50(){
 return {
  id:WORK_GAP_EVENT_V50,kind:'work-gap',speaker:'self',era:'工作空檔',sourceIds:[],
  title:'先停一下，下一件事還沒開始。',
  body:'上一件事已告一段落。下一段工作還沒開始，先看看自己還撐不撐得住。想休息、吃飯或花點錢照顧自己，趁現在安排；一旦繼續上班，就得先把眼前的事處理完。',
  wing:'這一小段時間，先留給自己。',
  choices:[{text:'繼續上班',detail:'',result:'',delta:{},flags:[],effect:'workGapStart'}]
 };
}
