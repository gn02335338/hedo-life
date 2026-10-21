// A fictional conversation, triggered by an accepted pay reduction. The wage
// reference concerns normal working hours, not a promise about a real dispute.
const choice=(text,result,delta={},flags=[])=>({text,detail:'',result,delta,effect:'salaryAdviceReturn',flags});

export function getSalaryAdviceV24(run){
 const advice=run.salaryAdvice;
 if(!advice||advice.status!=='open'||!advice.returnEventId)throw new Error('Missing salary advice');
 if(advice.origin==='starting-pay')return {
  id:'low-pay-tip',title:'法師看了一眼你的錄取條件。',
  body:`法師在茶水間叫住你：「報到時就是${advice.from}K？${advice.to===advice.from?'這個數字不是被降下來，是一開始就開這樣。':`現在月薪是${advice.to}K，也先把原本的條件留著。`}」你以為他又要替公司解釋，他卻提醒：2026年正常工時的全時月薪，最低工資是29,500元。先核對約定月薪、實際工時與給付，兼職、請假扣款與實領金額要分開看；確認工資有問題，可以向勞工局諮詢、申訴或申請調解，必要時再考慮訴訟。這次沒有降薪通知，錄取條件與薪資單就是要先留好的那幾張。`,
  wing:'「助理也是工作，不是薪水隨便寫。錄取條件先收好，必要時可以告公司。只是給你一個小建議，別把我的名字寫成公司立場。」',
  speaker:'erich',kind:'crisis',era:'起薪條件・私下提醒',sourceIds:['minimumWage2026','characterFiction'],
  choices:[
   choice('把錄取條件、報到文件與薪資單按日期收好。','你把約定條件、實際工時與給付紀錄分開整理。這份起薪不是你自己拿筆改的，留底的理由也不必等公司再砍一次才成立。',{mood:4},['evidence','archive']),
   choice('先記下起薪與工時，下班向勞工局諮詢。','你記下報到時談好的待遇與實際工作安排，準備先問清楚。法師提醒你別只截一個數字；這次他的但書，終於有幫你把問題補完整。',{mood:5,trust:2},['evidence']),
   {...choice('讓計算機戴上法官假髮，傳喚這張錄取通知。','你把錄取條件放到計算機面前，替它接上一撮紙做的假髮。法師看完只說：「道具收好，文件也收好。」你把真正能用的那份另存一個備份。',{mood:7},['evidence']),wild:true}
  ]
 };
 return {
  id:'low-pay-tip',title:'法師把降薪通知翻到數字那一頁。',
  body:`法師在茶水間叫住你：「${advice.from}K改成${advice.to}K？這張先別丟。」你以為他又要替公司解釋，他卻提醒：2026年正常工時的全時月薪，最低工資是29,500元。先分清楚約定月薪、請假扣款與實領金額，兼職也得核對工時；確認工資有問題，可以向勞工局諮詢、申訴或申請調解，必要時再考慮訴訟。這次他沒叫你簽名，只叫你留底。`,
  wing:'「你這張降薪通知先收好，必要時可以告公司。只是給你一個小建議，別把我的名字寫成公司立場。」',
  speaker:'erich',kind:'crisis',era:'薪資異動・私下提醒',
  sourceIds:['minimumWage2026','characterFiction'],
  choices:[
   choice('把錄取條件、降薪通知和薪資單按日期收好。','你把約定條件與實際給付分開整理，連同出勤紀錄一起備份。以前存這些是怕被說沒做好，今天終於有一份是替自己留的。',{mood:4},['evidence','archive']),
   choice('先列問題，下班向勞工局諮詢怎麼處理。','你在手機記下工時、薪資與降薪經過，準備先問清楚。法師看了一眼，提醒你連原本談好的條件也帶著；這次他的但書，終於不只是替公司留路。',{mood:5,trust:2},['evidence']),
   {...choice('讓計算機穿法袍出庭，請降薪通知接受交叉詰問。','你替計算機畫了件法袍，讓它對著薪資單按出差額。法師補一句：「它能幫你算，不能幫你蒐證。」你收起這位不會說話的律師，把真正的通知備份到自己手上。',{mood:7},['evidence']),wild:true}
  ]
 };
}
