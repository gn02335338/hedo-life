import {getVerbalAftermathV32,verbalSeverityV32} from './verbal-outcomes-v32.js';

// Published e32 lives keep their original draws. New lives let a reply be a
// reply: an ordinary exchange usually returns to the suspended decision.
const finaleRates=[
 [4,7,12],
 [18,30,45],
 [8,13,22]
];
const continuation=[
 {label:'話收回爭點，原本的事還得處理',result:'你收住追罵，把真正要問的條件逐條說完。對方沒有忽然變好相處；這場口角先停住，眼前沒處理完的事情也還在。'},
 {label:'又頂了一句，爭執暫時沒有再升級',result:'你又把話頂了回去。對方記住了這一句，旁邊的人也沒有替任何一邊鼓掌。這回沒有新的安排掉下來，仍得回頭處理眼前那件事。'},
 {label:'荒謬演出散場，事情仍在原地',result:'保溫杯沒有替你召來評審，辦公室倒是安靜了幾秒。你把杯子放回桌上，這段荒謬演出先收場，原本的條件仍等著一個正式答覆。'}
];

export function getVerbalAftermathV33(run){
 const event=getVerbalAftermathV32(run),context=run.verbalContext;
 const withdrawn=context.eventId==='onboarding'&&context.phase==='event'&&context.outcome==='personnel';
 if(withdrawn)return {...event,body:'翅膀剛才已把報到資料收回，這次任用已經撤回。你接下來說的話，會替這場口角留下最後一段紀錄；沒有新的錄取條件被端回桌上。'};
 const severity=verbalSeverityV32(run);
 return {...event,title:'話說重了，事情還有得接。',era:'口舌風波・當場回應',choices:event.choices.map((choice,index)=>{
  if(index>=3)return choice;
  const rate=finaleRates[index][severity-1],total=choice.draw.outcomes.reduce((sum,outcome)=>sum+outcome.weight,0);
  return {...choice,...(index===0?{text:'收住難聽的話，把要問的工作條件一項項說清楚。'}:{}),draw:{...choice.draw,outcomes:[
   ...choice.draw.outcomes.map(outcome=>({...outcome,weight:outcome.weight*rate})),
   {weight:total*(100-rate),...continuation[index],delta:{},effect:'verbalV32Continue',flags:[]}
  ]}};
 })};
}
