import {educationLabel} from './education.js';
import {isPatronageBenefitsV67} from './patronage-benefits-v67.js';

export const PATRONAGE_EVENTS_V67=Object.freeze(['patronage67-education','patronage67-pay-review','patronage67-smalltalk']);
const choice=(text,result,delta,flags=[],wild=false)=>({text,detail:'',result,delta,flags,effect:'patronage67Return',...(wild?{wild:true}:{})});
const event=(id,title,body,wing,choices,extra={})=>({id,title,body,wing,choices,kind:'career',speaker:'wing',era:'自己人待遇・原創職場諷刺',sourceIds:['characterFiction'],scope:'work',scene:'office_day',...extra});

// The engine reuses its suspended-scene return. These interludes never grant
// another salary, cash subsidy, appointment or new conversational context.
export function getPatronageEventV67(run,id){
 if(!isPatronageBenefitsV67(run)||!run.patronage||!PATRONAGE_EVENTS_V67.includes(id))throw new Error('Invalid patronage benefits event');
 const title=run.patronage.title,school=educationLabel(run.education),pay=run.pay;
 if(id==='patronage67-education')return event(id,'同一張畢業證書，今天突然有了格局。',
  `翅膀笑著問你哪裡畢業。你回答「${school}」，他這次沒有問你為什麼配領這份薪水，反而轉頭說：「我們的${title}，這叫跨領域人才。」希望把你的校系加進對外簡介，瑞克看著螢幕問自己要不要也補一句。原本可能被拿來挑毛病的學歷，今天忽然成了公司的選才眼光。`,
  '「學歷不是重點，我看的是潛力。你這種背景，就是要給舞台。」',[
   choice('簡介照實寫。順便把原本交辦給我的雜事分回去。','翅膀答應讓你先準備對外介紹，希望把幾項臨時交辦移走。瑞克說自己也能上台，你請他先把手上那通電話講完。畢業證書沒有換，今天終於不用靠它替所有雜事背書。',{mood:9,energy:7,boss:2,trust:-2},['patronage67_branding']),
   choice('既然是跨領域人才，請印表機替我的學位加蓋「自己人」浮水印。','印表機印出同一張簡介，右下角多了一隻替你認證的玩具鵝。翅膀說要有創意，瑞克問那隻鵝是什麼學校畢業的。你請他先尊重這間公司的推薦入學制度。',{mood:12,slack:3,boss:4,trust:-3},['patronage67_branding','archive'],true),
   choice('履歷先別加戲。我領的薪水照任用書，工作照說好的範圍。','你把學校、科系和職務範圍分成三欄。翅膀嫌你還是太認真，希望卻照著存檔，沒有拿出降薪通知。瑞克想插進來談自己的待遇，你順勢把下一段發言留給他。',{mood:7,energy:4,boss:-3,trust:3},['patronage67_branding','evidence'])
  ],{participants:['wing','hope','rick']});
 if(id==='patronage67-pay-review')return event(id,'薪資表沒改，保密音量先加大。',
  `希望請你核對${title}的待遇，月薪仍是${pay}K。她沒有帶降薪同意書，而是提醒特殊任用的補助和津貼都已列入紀錄，別拿去茶水間廣播。瑞克剛好在門口停下，問為什麼自己人還有新方案。公主抬起頭說：「Please do not add my budget to your family chart.」三個人看著同一張表，各自在算不同的帳。`,
  '「自己人的待遇不用每個人都知道，但你要記得是誰照顧你的。」',[
   choice('已生效的待遇寫清楚，津貼按規定入帳，別再附一整包雜事。','希望把月薪、一次補助和工作津貼分開核對，確認這場談話不會再發一次補助。你把額外交辦退回原負責人，瑞克盯著那條津貼規則看了很久，終於問出口：那他能不能也去做兩件事。',{mood:9,energy:6,boss:2,trust:-2},['patronage67_treatment','evidence']),
   choice('成立家譜薪酬委員會，任命玩具鵝當唯一不加班的委員。','玩具鵝面前放了薪資表，沒有銀行帳戶，也沒有多領第二筆任用補助。公主說：「Finally, someone with a clear scope.」瑞克問委員能不能接電話，你替牠在會議紀錄上寫下婉拒。',{mood:12,slack:3,boss:3,trust:-3},['patronage67_treatment','archive'],true),
   choice('薪資不拿來炫耀。也請別把我當成誰都能轉單的窗口。','你把待遇表收好，只留下負責範圍給同事看。希望沒有改月薪，公主也把原本想推過來的急單拿回去。瑞克還是不太高興，但這次少接的工作，總算不只是名片上的想像。',{mood:8,energy:8,trust:3,boss:-2},['patronage67_treatment','handover_notes'])
  ],{participants:['wing','hope','rick','princess']});
 return event(id,'今天不問你讀幾本，要問你坐哪裡。',
  `翅膀又笑著問起你的${school}。你正等著那句「有沒有在讀書」，他卻說晚點有訪客，想讓${title}坐在旁邊介紹公司。瑞克說自己比較熟悉翅膀的意思，公主已經把行事曆切成不開放預約。你的學歷今天不用接受審判，倒是忽然多了替老闆撐場面的用途。`,
  '「自己人不用一直考試。等一下坐我旁邊，讓大家知道我很會看人。」',[
   choice('可以露面，先講好只待這一段，後面的報告還給原負責人。','翅膀點頭，讓你介紹完就回座位。瑞克主動接上後半段，語氣很像終於搶回一支麥克風。你沒有被追問讀哪本書，也沒有因為坐得近，就多領一整晚的工作。',{mood:8,energy:6,boss:4,trust:-1},['patronage67_smalltalk']),
   choice('請玩具鵝先做學歷口試。牠通過，我就陪同出席。','玩具鵝對所有問題保持沉默，翅膀居然說這樣比較穩重。瑞克問牠憑什麼不用報學校，你說這是公司的高潛力人才，不方便透露太多。公主笑了一聲：「Outstanding interview.」',{mood:12,slack:3,boss:3,trust:-3},['patronage67_smalltalk','archive'],true),
   choice('今天不陪同。我把對外資料交好，自己人的休息時間也要排進去。','你交出簡介和常見問題，沒有坐進那場臨時加開的會議。翅膀嘀咕一句自己人也會挑時間，仍讓瑞克坐過去。學歷沒有被重新估價，月薪也照舊，你把省下的時間留給自己。',{mood:10,energy:8,boss:-4,trust:2},['patronage67_smalltalk','handover_notes'])
  ],{participants:['wing','rick','princess']});
}
