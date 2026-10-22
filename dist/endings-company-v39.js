import {COMPANY_ENDING_IDS_V39} from './company-v39.js';

export const COMPANY_FAMILIES_V39=Object.freeze([
 {id:'company_closed',label:'公司停業',type:'bad',minRules:39,description:'最後一份全員通知，終於有確定的日期。'},
 {id:'company_stagnation',label:'願景延期，日常續約',type:'normal',minRules:39,description:'公司沒有起飛，也沒有消失，隔天仍要上班。'},
 {id:'company_taiwan_exit',label:'台灣團隊離場',type:'bad',minRules:39,description:'組織圖跨海更新，決策的代價落在員工身上。'},
 {id:'company_wage_arrears',label:'薪資單有數字，帳戶沒有',type:'bad',minRules:39,description:'願景照常更新，應領月薪卻還沒入帳。'},
 {id:'company_shell_brand',label:'招牌留任，人員離任',type:'bad',minRules:39,description:'網站繼續在線，原團隊已經不在。'},
 {id:'company_restructured',label:'公司瘦身，待辦增重',type:'normal',minRules:39,description:'你留下工作，少了幫手，願景仍維持原尺寸。'}
]);
const roles=[['system','系統工程師'],['ai','AI工程師'],['project','專案經理'],['product','產品經理'],['design','設計師'],['bd','商務開發'],['sales','業務'],['mis','MIS工程師'],['executive','高階主管'],['finance','財務專員'],['accounting','會計專員'],['hr','人資專員'],['admin','行政專員']];
const work={
 system:'服務、備份與維護窗口',ai:'資料、模型與部署限制',project:'時程、變更與尚未交付的範圍',product:'用戶需求、功能邊界與驗收條件',design:'設計原檔、規範與改稿紀錄',bd:'合作條件、授權與往來窗口',sales:'客戶合約、報價與交付承諾',mis:'設備、帳號與存取權限',executive:'團隊分工、實際授權與人力安排',finance:'資金餘額、付款與核准紀錄',accounting:'憑證、應收應付與月結資料',hr:'人事通知、任用條件與交接紀錄',admin:'採購、設備與接待承辦的清單'
};
const stories={
 company_closed:{title:'最後一次全員到齊',subtitle:'這回不是敲鐘，是關燈。',symbol:'閉',before:'這是公司走到盡頭的幻想結局。翅膀把停業說成戰略暫停，真真拿來的通知卻有確定日期。希望與法師說明交接，阿福照清單回收設備；沒有人再說下個月就會不一樣。',action:'你把該交接的事項逐項確認',after:'公司通知你離場，不是你忽然提出自願離職。你收好任職與通知紀錄，最後一位離開的人關了燈。那面上市背板靠在牆上，終於不用再改日期。'},
 company_stagnation:{title:'即將起飛，第不知道幾季',subtitle:'沒有上市，沒有倒閉，只有週一。',symbol:'續',before:'這條幻想時間線沒有鐘聲，也沒有戲劇性的最後一天。公司仍靠舊案與小額新單營運，翅膀每季都換一張成長曲線，曲線的右端則永遠在下一張投影片。',action:'你把能繼續做的工作拉回眼前',after:'你仍在職，薪水與工作關係沒有在這段收尾被取消。有人繼續等願景，有人開始安排自己的下一步。公司沒有成為傳奇，鬧鐘倒是很準時。'},
 company_taiwan_exit:{title:'交接完畢，台灣這邊登出',subtitle:'跨海留下的是工作，先被刪掉的是人力格子。',symbol:'海',before:'這是公司決定裁撤台灣團隊的幻想結局。翅膀用成本與組織效率說明，把原有工作轉交越南遠端同事。你們在線上一起核對交接，兩端都知道工作沒有變少，只是公司把承擔方式改了。',action:'你依公司通知整理並交接',after:'你也在台灣離場名單裡，這次是公司資遣。越南同事沒有替高層做這個決定，也不該替公司的安排承擔罵名。會議結束前，你們互相道謝，沒有替那份組織圖鼓掌。'},
 company_wage_arrears:{title:'發薪日，願景先匯到',subtitle:'帳戶沒有通知，群組倒是有三篇長文。',symbol:'欠',before:'這條幻想線走到發薪日，應領月薪卻沒有按期入帳。翅膀在群組談相信、談共體時艱，財務窗口仍拿不出可以核對的付款時間。你沒有把公司的資金問題改寫成自己的忠誠度測驗。',action:'你另存能確認的工作與往來資料',after:'你仍在職，但延遲薪資與爭議都未解決。你留下薪資、工時與正式回覆，尋求適當的諮詢與處理，不替任何程序預告勝負。故事停在錢還沒收到的那一天，不是自動替你簽下一封離職信。'},
 company_shell_brand:{title:'網站更新，團隊404',subtitle:'招牌還在上班，原本的人不用來了。',symbol:'殼',before:'這是品牌留下、原團隊離場的幻想結局。公司保留網站與產品名稱，把服務改交承包窗口。對外公告寫持續服務，內部通知則列出原團隊的交接與離場時間，兩份文件都沒有寫錯自己的目的。',action:'你將原先經手的內容交給指定窗口',after:'原任職在公司的離場通知下結束，不是你默默轉成無期限的免費外包。網站上的團隊照慢了一步才撤，你沒有再替那張照片提供售後服務。'},
 company_restructured:{title:'留下的人，再順便一下',subtitle:'編制縮小，待辦沒有跟著縮。',symbol:'縮',before:'這條幻想線沒有掛牌，也沒有停止營運。公司完成一輪縮編，你保住職位，支援人力與工具預算卻先走了。翅膀說小團隊更靈活，下一張需求單倒沒有因此少寫半行。',action:'你重排仍有資源能完成的事項',after:'你仍在職，約定月薪在這段故事裡沒有被更改；少的是人力、預算與隨時能接手的同事。你把做不到的範圍寫清楚，拒絕再讓順便兩字填滿每一個空缺。'}
};
export const COMPANY_ENDINGS_V39=Object.freeze(COMPANY_FAMILIES_V39.flatMap(family=>roles.map(([roleId,roleName])=>{
 const story=stories[family.id];
 return {id:`${family.id}-${roleId}`,family:family.id,roleId,minRules:39,type:family.type,title:`${story.title}｜${roleName}`,subtitle:story.subtitle,symbol:story.symbol,body:`${story.before}${story.action}：${work[roleId]}。${story.after}`,hint:'在新版公司的未來方案中，走完這次實際抽到的營運收尾。'};
})));
if(COMPANY_FAMILIES_V39.some(family=>!COMPANY_ENDING_IDS_V39.includes(family.id)))throw new Error('Unknown company finale');
