// These conditions describe the fictional game, not an employee's real history.
const STORY_RULES=[
 {family:'second_offer',eligible:r=>(r.flags.offer_checked||0)>=2&&(r.flags.alumni_links||0)>=2&&r.stats.skill>=55,
  text:'新工作的條件都問清楚了，回簽錄取通知。',
  result:'你把薪資單位、工作內容和匯報對象再看一遍，請前同事幫忙確認後才回簽。這次的離職信有明確的下一站，沒有附上對 Wing 的改善建議。'},
 {family:'handover_author',eligible:r=>(r.flags.handover_notes||0)>=3&&(r.flags.archive||0)>=2,
  text:'把交接文件簽收，照約定的日期離開。',
  result:'你和接手人逐項確認文件與未完成事項，寫下支援截止日。說明書可以繼續補版，離職日沒有因此跟著延期。'},
 {family:'alumni_network',eligible:r=>(r.flags.alumni_links||0)>=3&&r.stats.trust>=60,
  text:'離職後的第一頓飯，約那些還會互相幫忙的人。',
  result:'你在前同事群組問誰晚上有空，沒有人請你先開會議。幾個工作機會和一份菜單同時傳來，你先回覆今晚想吃什麼。'},
 {family:'consultant',eligible:r=>r.assignment!=='assistant'&&r.rank>=(/^e(?:17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36)-/.test(r.seed||'')?5:2)&&(r.flags.consultant_offer||0)>=1,
  text:'顧問可以談，先把範圍與時數寫進合約。',
  result:'你把顧問安排逐項寫清楚，包含交付、時數與另外計費的項目。對方說這樣好像很見外，你說這樣才能合作久一點。'},
 {family:'merged_out',eligible:r=>(r.flags.merge_notice||0)>=1,
  text:'接受這次組織調整，把責任與交接列清楚。',
  result:'新的組織圖已經印好，你把未完成的事交給指定窗口。工作會怎麼分，是公司下一場會議的事；你沒有再把自己填回那個被刪掉的格子。'},
];
export function eligibleStoryEndings(run){return STORY_RULES.filter(rule=>rule.eligible(run)).map(rule=>rule.family);}
export function getStoryExit(run){
 return {id:'story-exit',kind:'career',speaker:'wing',era:'離場之前・自己選一句結尾',sourceIds:['departuresFiction'],
  title:'那些一起上過班的人，還留給你什麼？',
  body:'你翻過這段日子的訊息：有人幫你看過新機會，有人留下交接，有人離開後還會問你最近怎麼樣。組織圖以外，這些累積也可以成為下一步。',
  wing:'你們離開以後，還不是都會回來問以前的事。',
  choices:[...STORY_RULES.map(rule=>({text:rule.text,detail:'',result:rule.result,delta:{},effect:rule.family,flags:[],available:rule.eligible(run)})),
   {text:'先看別的選擇。',detail:'',result:'這些經歷先留著，你翻回自己的職涯頁，決定要用哪一段替這次人生收尾。',delta:{},effect:'rankHub',flags:[]}]
 };
}
