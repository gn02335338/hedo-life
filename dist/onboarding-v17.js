import { ROLE_MAP } from './roles.js';
import { publishedDisplayText as displayText } from './persona.js';

// The engine opts new runs into this copy after computing checks and effects.
// The three openings share choice indices, but describe different decisions.
export function applyOnboardingV17(event,run,{jobTitle}){
 if(!event||event.id!=='onboarding')return event;
 const advertised=displayText(ROLE_MAP[run.roleId].name);
 const actualRole=displayText(ROLE_MAP[run.actualRoleId].name);
 const actual=displayText(typeof jobTitle==='function'?jobTitle(run):jobTitle);
 let copy;
 if(run.assignment==='honest'){
  copy={
   title:'名片印好了，工作先別問。',
   body:`你拿著「${advertised}」的錄取通知來報到，領到門禁卡，桌上放著一張「${actual}」的名片。翅膀介紹完座位，開始交代今天的工作：先整理開會資料，再看看哪裡需要支援。你正想問主要負責哪一塊，他已經講到第三件「順便幫忙」。`,
   wing:'「分工不用切那麼細，事情總要有人做。你先熟悉一下。」',
   choices:[
    {
     text:'先登入電腦，把今天交辦的事記下來。',
     detail:'從第一份待辦開始認識這份工作。',
     result:'你打開筆記，把交辦事項一項項記下來。第一頁還沒寫完，翅膀又想到兩件事；你只好把「熟悉環境」挪到明天。'
    },
    {
     text:'請他替「其他交辦事項」畫國界，順便訂入境規則。',
     detail:'拿錄取通知逐項確認工作範圍。',
     result:'你把每件「順便」都寫回工作清單，總算問到今天的優先順序。翅膀勾掉兩項，又看了你一眼：「你很會問喔。」',
     failure:'你拿筆準備畫工作範圍，翅膀先問：「我講這麼多，你還聽不懂？」國界沒畫成，你倒是先領到一句「新人不要想那麼多」。'
    },
    {
     text:'名片先別拆封，我想回去重新考慮。',
     detail:'趁報到流程還沒走完，結束這份工作。',
     result:'你把門禁卡放回桌上，說這份工作跟你想的不太合適。名片還完整包在膜裡，今天唯一不用再交接的，就是那包名片。'
    }
   ]
  };
 }else if(run.assignment==='swapped'){
  const mismatch=run.roleId==='ai'&&run.actualRoleId==='system'
   ?'模型還沒看到，資料庫帳密和舊系統維護清單倒是先到了。你問AI專案在哪裡，得到一句「這些先弄好，AI以後再說」。'
   :'面試談的那份工作還在錄取信裡，眼前的交接清單卻屬於另一個職缺。你指著兩邊的差異，翅膀只說這邊剛好比較缺人。';
  copy={
   title:'錄取信還在，工作換一份。',
   body:`你是來應徵「${advertised}」的，報到時卻被安排做${actualRole}的工作，實際職稱是「${actual}」。${mismatch}這不是請你幫忙一天，接下來的工作就照這份清單走。`,
   wing:'「人要有彈性。公司哪裡需要你，你就去哪裡發揮，不要被職稱綁住。」',
   choices:[
    {
     text:'先接工作，但把原本那封錄取信留好。',
     detail:'先照報到時的安排做，保留原本的任用條件。',
     result:'你收下交接清單，也把錄取信存了一份。第一份工作還沒交出去，求職網站倒是已經重新登入了。'
    },
    {
     text:'把錄取信當召喚陣，請他把原本的職缺叫回來。',
     detail:'要求回到面試談好的職務。',
     result:'你把面試紀錄和錄取通知攤在桌上，逐項問他哪裡改了。談到最後，翅膀同意讓你回到原本錄取的職務，只補了一句：「才第一天就這麼計較。」',
     failure:'你把錄取信攤開，翅膀卻說你太執著字面。原本的職缺沒被召回來，新工作的清單倒是又多了一頁。'
    },
    {
     text:'這不是我答應的工作，今天就到這裡。',
     detail:'不接受這份新的工作安排。',
     result:'你把新職務的交接清單還回去，請對方另找適合的人。翅膀還在講彈性，你已經走到門口，親自示範什麼叫不被座位綁住。'
    }
   ]
  };
 }else{
  copy={
   title:'「先從助理做起」，薪水也先改了。',
   body:`錄取通知上的職務是「${advertised}」，報到時卻改以「${actual}」任用。你再核對薪資，遊戲月薪也從談好的${run.offerPay}K變成${run.pay}K。交接清單上的工作沒比較少，薪資數字卻先縮水。你問這個助理安排會持續多久，翅膀看了一眼手機，像是這個問題不值得多花一分鐘。`,
   wing:'「先把助理做好，以後再談。你連基礎都還沒做，就一直問下一步？」',
   choices:[
    {
     text:'先算一下房租，接受這張助理名片。',
     detail:'按目前的助理職務與薪資留下。',
     result:'你按了一遍計算機，決定先保留這份收入。翅膀說新人肯學很好，接著把正式職缺那份工作清單也交給你參考。'
    },
    {
     text:'把錄取信做成超大立牌，要求按原條件任用。',
     detail:'把職務與薪資一起拿回桌上談。',
     result:'你連職稱和薪水一起攤開談。翅膀嫌你把事情搞得太大，最後仍同意按原錄取條件任用；那張助理名片暫時用不到了。',
     failure:'翅膀看完立牌，只回你「公司有公司的安排」。原本的條件沒談回來，立牌還得自己收，助理的第一項額外工作就這樣出現了。'
    },
    {
     text:'工作和薪水都換了，那我也換一家公司。',
     detail:'不接受助理職務與調整後的薪資。',
     result:'你把助理名片和新薪資條件放回桌上，說自己不接受。對方問你連試都不試嗎，你回頭看了一眼計算機：剛才已經算過了。'
    }
   ]
  };
 }
 return {...event,title:copy.title,body:copy.body,wing:copy.wing,choices:event.choices.map((choice,index)=>{
  const patch=copy.choices[index];
  if(!patch)return choice;
  const next={...choice,text:patch.text,detail:patch.detail,result:patch.result};
  if(choice.check){
   next.check={...choice.check};
   if(choice.check.success)next.check.success={...choice.check.success,result:patch.result};
   if(choice.check.failure)next.check.failure={...choice.check.failure,result:patch.failure||patch.result};
  }
  return next;
 })};
}
