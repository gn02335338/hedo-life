import {getCompanyEventV32} from './company-v32.js';

export const COMPANY_ENDING_IDS_V39=Object.freeze(['company_closed','company_stagnation','company_taiwan_exit','company_wage_arrears','company_shell_brand','company_restructured']);
export const COMPANY_FINALE_LABELS_V39=Object.freeze({
 company_closed:'公司停止營運，員工收到離場通知',
 company_stagnation:'公司繼續營運，掛牌與成長仍未發生',
 company_taiwan_exit:'台灣團隊遭資遣，工作轉交越南遠端團隊',
 company_wage_arrears:'月薪未按期入帳，員工仍在等待正式處理',
 company_shell_brand:'品牌被留下，原團隊遭資遣、服務轉外包',
 company_restructured:'公司縮編後繼續營運，你留任但資源縮水'
});
const employment=Object.freeze({
 company_closed:{kind:'company-exit',label:'公司停業，你收到公司離場通知',explanation:'公司停止營運並要求員工交接離場。這次不是你自願提出離職，掛牌計畫也沒有實現。'},
 company_stagnation:{kind:'employed',label:'你仍在職，公司停在原地營運',explanation:'沒有掛牌、沒有收購，也沒有你的離職通知。公司仍照原本的規模接案，願景繼續延期。'},
 company_taiwan_exit:{kind:'company-exit',label:'台灣團隊遭資遣，你也在離場名單',explanation:'公司決定裁撤台灣團隊，把原有工作交接給越南遠端同事。這是公司的用人與成本決策，不是任何國籍員工的過錯。'},
 company_wage_arrears:{kind:'wage-dispute',label:'你仍在職，薪資延遲與爭議待處理',explanation:'應領月薪沒有按期入帳，你留下薪資與工時紀錄並要求正式說明。這個收尾沒有宣告自願離職、資遣或任何法律程序的勝負。'},
 company_shell_brand:{kind:'company-exit',label:'原團隊遭資遣，招牌與外包服務留下',explanation:'公司保留品牌，把服務交給承包窗口，並通知原團隊交接離場。對外網站還在，不代表你的原任職仍在。'},
 company_restructured:{kind:'employed',label:'縮編後你留任，預算與支援縮水',explanation:'公司沒有停止營運，也沒有在這段收尾通知你離場。你仍領原約定月薪，能用的人力與工具卻變少了。'}
});
export function companyFinaleEmploymentV39(family){const row=employment[family];return row?{...row}:null;}
const risks={market:[18,30,16,18,8,10],buyer:[12,15,20,10,28,15],vietnam:[10,15,30,15,10,20]};
const results={
 company_closed:'掛牌時程還掛在牆上，公司先寄出停止營運通知。你收到交接與離場安排，沒有把公司的決定簽成自己突然想休息；最後一場全員會議，終於不用再承諾下季成長。',
 company_stagnation:'簡報又換了一版，公司卻仍靠原本的案子過日子。沒有人通知你離職，你繼續上班、領原約定月薪；敲鐘日期改成「再看看」，日曆比事業先翻了一頁。',
 company_taiwan_exit:'公司通知裁撤台灣團隊，你也在資遣名單裡。原有工作交接給越南遠端同事，兩邊一起問期限和負責窗口；高層把決定叫做成本優化，細節仍得由收通知的人補齊。',
 company_wage_arrears:'發薪日過了，入帳通知沒有來，工作訊息倒準時得很。你仍在職，先保留工時與薪資紀錄、要求正式說明；這次沒有用一句「共體時艱」，替尚未領到的月薪結案。',
 company_shell_brand:'公司的招牌與網站都留下了，原團隊卻收到資遣與交接通知。服務改由外包窗口接手，你交還帳號權限；首頁仍寫歡迎加入，這回沒有替員工保留座位。',
 company_restructured:'公司縮編後繼續營運，你留任，原約定月薪也還在。預算、人手與工具先各少一截，工作清單卻沒跟著減肥；你把能做和做不了的項目攤開，請願景也挑幾件親自下場。'
};
export function getCompanyEventV39(run){
 const event=getCompanyEventV32(run),route=run.companyContext.route,s=run.stats;
 // This is a fictional governance risk draw, not a judgment about the remote
 // team's nationality. Every plan retains both its original and new outcomes.
 const share=Math.max(24,Math.min(48,28+(s.cash<25?8:0)+(s.trust<35?6:0)+(s.dream>s.skill+20?6:0)));
 return {...event,body:`${event.body} 這些計畫仍可能停在日常營運、資金缺口或組織調整，不能只因簡報翻到最後，就先把成功填進結果。`,choices:event.choices.map(choice=>{
  if(!choice.draw)return choice;
  const total=choice.draw.outcomes.reduce((sum,outcome)=>sum+outcome.weight,0);
  const newOutcomes=COMPANY_ENDING_IDS_V39.map((family,index)=>({weight:total*share*risks[route][index]/100,label:COMPANY_FINALE_LABELS_V39[family],result:results[family],delta:{},effect:family,flags:[`company39_finish_${family}`]}));
  return {...choice,draw:{...choice.draw,outcomes:[...choice.draw.outcomes.map(outcome=>({...outcome,weight:outcome.weight*(100-share)})),...newOutcomes]}};
 })};
}
