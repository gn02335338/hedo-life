import { rageTiming } from './rage-v14.js';

// This cohort edits words only. Older seeds keep their exact replay history;
// checks, draw weights, flags and state changes remain authored by the engine.
const IMAGINED = {
 wing:'你在腦內揮出一拳，Wing那句「格局」終於被打斷。他張嘴還想叫你讀書，你先把《怎麼跟人講話》放到他桌上，指定下次開會前交讀書心得。',
 spencer:'夢裡，你一拳把Spencer那句「家境不允許」打成「本日加碼」。他伸手摸口袋，卻只掏出另一張寫著預算不足的紙。連你的幻想，都差點被他砍了經費。',
 rick:'腦內的Rick被你打得轉了半圈，居然還沒醒。Wing的來電一響，他立刻站直說「您說得對」。你都已經在做夢了，竟然還得等他舔完這通電話。',
 hope:'夢裡，你揮出一拳，Hope當場抽出自評表接招，問這次情緒輸出有沒有可衡量的目標。你拿過那張表，替她填上「已超標，不接受複評」。',
 erich:'你在腦內揮出一拳，Erich還在解釋「扁」的定義。你請他直接講結論，他卻接著補充但書；都已經是你的夢了，會議竟然還是結束不了。',
 jenjen:'夢裡，你一拳把交接清單打成紙花。JenJen伸出手，請你離場前逐片清點、黏回原狀。你看著滿地紙屑，連想像中的離職都又多了一項交接。',
 sonny:'腦內的你剛擺好姿勢，Sonny先把整個辦公室切成登入頁。你對著「密碼錯誤」揮了三回合，才發現這個夢居然也要經過公司帳號驗證。',
 kind:'你在腦內追著阿良跑遍整棟樓。他每次都說「好啊，等你」，每次轉過彎，都只剩一架空鋼琴。你連在夢裡，都沒抓到這個答應過要留下來的人。'
};

const LEGACY_IMAGINED = {
 wing:'漫畫裡，你把Wing的「格局」對話框打成了直式。他張嘴還想叫你讀書，字幕卻先跳出「本書未附交付日期」。',
 spencer:'你想像自己一拳把「家境不允許」打成「本日加碼」。Spencer伸手摸口袋，口袋裡居然又掉出一個預算不足的對話框。',
 rick:'腦內的Rick被打得轉了半圈，仍然沒醒。Wing的來電一響，他立刻站直說「您說得對」，連漫畫都得先讓他接完。',
 hope:'你想像自己揮出一拳，Hope當場抽出自評表接招，問這次情緒輸出有沒有可衡量的目標。你替她在腦內填了「已超標」。',
 erich:'漫畫裡，Erich還在解釋「扁」的定義，對話框已被你壓成一條細線。最後一個但書仍不肯結束。',
 jenjen:'你想像一拳把交接清單打成紙花。JenJen伸出手，請你離場前逐片清點、黏回原狀。',
 sonny:'腦內的你剛擺好姿勢，Sonny先把畫面切成登入頁。你對著密碼錯誤提示框打了三回合，沒有人替你重設。',
 kind:'你在腦內追著阿良跑遍整棟樓。他每次都說「好啊，等你」，每次轉角都只剩一架沒有人的鋼琴。'
};

// Presentation only for already-saved e14 results. Do not write this replacement
// into replay history: historical payloads must continue to verify unchanged.
export function polishDreamText(text){
 if(typeof text!=='string')return text;
 let next=text;
 for(const [target,original] of Object.entries(LEGACY_IMAGINED))next=next.replace(original,IMAGINED[target]);
 return next.replace('發現這次沒有漫畫替你收尾。','這才發現自己真的動了手，眼前的會議也真的停了下來。');
}

function dreamTiming(context,run){
 const first=context.eventId==='onboarding';
 const opening=first&&context.target==='wing'?'夢裡的Wing還低頭翻員工名單：你連名字都沒報完，他完全不知道這股怨氣從哪裡來。 ':'';
 const moment=context.phase==='result'?'你剛才已經回答了，聽到那句回話，才在腦中把整場戲演完。':'對方話還沒講完，你已經在腦中演完了後半場。';
 let timing='對方才剛換一口氣，連你的沉默都還沒察覺。';
 switch(rageTiming(context.eventId)){
 case 'onboarding':timing='報到表還沒填完，公司的Wi-Fi也還沒連上，腦內的你倒是先替今天安排了壓軸。';break;
 case 'pip':timing='桌上真正的自評表還在，對方也還等著你替自己打分。';break;
 case 'salary':timing='新薪資單的數字還是一位也沒動。';break;
 case 'education':timing='Wing仍在講他的讀書論，等著你接話。';break;
 case 'banquet':timing='尾牙燈光一閃，舞台上仍在抽一個不含你的號碼。你剛才那場動作戲，連桌邊的人都沒有看到。';break;
 case 'exit':timing='夢裡那張自願離職書已經碎成雪花。桌上真正的紙仍是平的，簽名欄也還空著。';break;
 case 'kind':timing='你還沒在腦內追到阿良，他已經開始說晚上再約。現實和幻想裡，他消失的速度倒是一樣快。';break;
 }
 const late=run.turn>=20?' 上市簡報仍然開著，腦內的你倒是已經先替它敲了散場鐘。':'';
 return `${opening}${moment} 回過神，你的手還放在膝上，沒有真的動手。${timing}${late}`;
}

function educationCopy(event,run){
 const reasons=run.flags.education_dispute||0;
 const mismatch=!!(reasons&4),subject=!!(reasons&2),school=!!(reasons&1);
 const departmentComplaint=mismatch||(subject&&!school);
 const choices=event.choices.map(choice=>({...choice}));
 if(mismatch){
  choices[0].result=`你把最近的交付紀錄攤給他看。Wing卻又問了一次「你本科念什麼」，彷彿${run.education.department}幾個字，能把剛完成的工作全部刪掉。`;
 }else if(departmentComplaint){
  choices[0].result=run.education.degree==='EMBA'?'你把最近的交付紀錄攤給他看。他又把話題拉回EMBA，對已經做完的工作反而沒問幾句。':'你把最近的交付紀錄攤給他看。他仍抓著科系名稱不放，眼前做完的工作，抵不過畢業證書上的那一行字。';
 }
 // A complaint about the department needs a department joke. When both apply,
 // the explicit major mismatch in Wing's dialogue takes precedence.
 if(departmentComplaint){
  choices[1].text='馬上報考台大電機，找林澤教授當指導老師。';
  choices[1].result='你送出報考申請，又寫信詢問公司的顧問林澤教授能否指導。能不能錄取、教授收不收，仍要等回覆。Wing看到「台大電機」四個字就先點了頭，剛才那份工作紀錄卻仍然沒點開。';
 }
 const title=mismatch?event.title:subject&&!school?(run.education.degree==='EMBA'?'讀過EMBA，也不算他說的讀書。':'做得出來，還得念對科系。'):event.title;
 return {...event,title,choices};
}

export function applyCopyV15(event,run){
 if(!event||!/^e(?:15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32)-/.test(run?.seed||''))return event;
 if(event.id==='education-scrutiny')return educationCopy(event,run);
 if(event.id!=='rage-release')return event;
 const context=run.rageContext,target=context?.target;
 if(!IMAGINED[target])return event;
 return {...event,choices:event.choices.map(choice=>choice.draw?{
  ...choice,draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>{
   if(outcome.flags?.includes('rage_imagined'))return {...outcome,result:`${IMAGINED[target]} ${dreamTiming(context,run)}`};
   if(target==='hope')return {...outcome,result:outcome.result.replace('發現這次沒有漫畫替你收尾。','這才發現自己真的動了手，眼前的會議也真的停了下來。')};
   return outcome;
  })}
 }:choice)};
}
