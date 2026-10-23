import {isExpansionV66} from './expansion-profile-v66.js';
import {companyEligibleV32} from './company-v32.js';
export function withEmployeeAcquisitionV66(event,run){
 if(!isExpansionV66(run)||event?.id!=='company-v32-buyer'||run.companyContext?.route!=='buyer')return event;
 return {...event,body:`${event.body} 桌上另有一份以員工為主的交接與轉任方案；你可以把自己的任用安排單獨提出，不替任何人的董事席次下注。`,choices:[...event.choices,{
  text:'把員工轉任與交接條件另列一份，先談清楚自己的安排。',detail:'',available:companyEligibleV32(run),
  result:'買方與公司確認交易，你拿到新的任用條件，依書面安排結束原公司的全職任用、完成交接，再到收購方接續工作。翅膀的董事席次由買方另行處理；你沒有把自己的下一張名片綁在他能不能繼續坐主位上。',
  delta:{},effect:'acquired',flags:['company66_employee_transfer']
 }]};
}
const completedWork=run=>new Set((run.history||[]).filter(row=>row.kind==='daily'&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0).map(row=>`${row.turn}:${row.eventId}`)).size;
export function consultantInvitationAvailableV66(run){
 const s=run?.stats||{};
 return isExpansionV66(run)&&run.assignment!=='assistant'&&!run.patronage&&run.rank>=5&&completedWork(run)>=6&&s.energy>15&&s.cash>8&&s.skill>=55&&s.trust>=45&&!run.pip?.active&&!run.flags?.floor_watch&&!run.flags?.consultant_offer;
}
export function withConsultantInvitationV66(event,run){
 if(event?.id!=='rank-exit'||!consultantInvitationAvailableV66(run))return event;
 return {...event,body:`${event.body} 以你這段高階工作經歷，公司另外提出了外部顧問合作的邀約；這不是已經生效的任命，原本的全職工作仍在，範圍、時數與後續交接可以先拿出來談。`,choices:[...event.choices,{
  text:'把收到的外部顧問邀約攤開，先談範圍與時數。',detail:'',
  result:'你把公司的顧問邀約拆成工作範圍、時數、費用與交接問題，收下一份可繼續討論的方案。這次只是確認能談什麼，還沒有離職、加薪或變更任用；接著由你決定是否結束原全職工作，另簽有範圍的外部顧問合約。',
  delta:{},effect:'storyCareer',flags:['consultant_offer','consultant66_discussed','offer_checked']
 }]};
}
