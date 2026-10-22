// Public fictional composites. Shared IDs connect work, dinners and resolved
// interactions; private archive-only material does not belong in this module.
export const CAST_PROFILES_V39=Object.freeze({
 annie_yu:Object.freeze({name:'安妮余',title:'商務開發助理',department:'business',seniority:'colleague',cost:10,sensitivity:.01,
  about:'商務開發助理，主管是歐文。「馬丁幫我」很順口，歐文的新方向則需要多確認幾次。她是安妮余，不是公主；同名信件請先核對部門。',
  era:'BD助理・方向轉接台',flatter:['先答應幫忙，缺的條件晚點補。','回一句沒問題，替整包工作留位置。','先照主管最新一句排，前版當草稿。']}),
 princess:Object.freeze({name:'公主',title:'資料探勘工程師',department:'engineering',seniority:'colleague',cost:14,sensitivity:.04,
  about:'安妮林，辦公室叫她公主；不是BD的安妮余。翅膀的女兒，多倫多CS背景，心裡另有讀醫科的念頭。她想談程式，有人先談家譜，一場技術討論便多了好幾道不必要的前言。',
  era:'資料探勘・家譜不會跑測試',flatter:['先說翅膀應該會同意，測試稍後再補。','把討論改成稱讚背景，技術問題暫存。','先替方案蓋一個大家都懂的點頭。']}),
 joyce:Object.freeze({name:'914',title:'業務總監',department:'sales',seniority:'director',cost:16,sensitivity:.04,
  about:'Joyce，辦公室別稱914，業務總監，水蛇的同學；別跟BD那位同名Joyce認錯。升官後，原本一句話能聊完的事多了會議、副本和正式窗口。',
  era:'業務總監・同學請走正式窗口',flatter:['先把簡報寫成好消息，數字之後再追。','說這案一定沒問題，替承諾先占一格。','先照總監版本報喜，疑問留給下一場。']}),
 janet:Object.freeze({name:'Janet',title:'財會主管',department:'finance',seniority:'manager',cost:13,sensitivity:.03,
  about:'預算、核銷、臨時KPI都到她桌上，五千元也能走出比活動還長的簽核流程。表單改了一版又一版，少一格附件，明天就能再見面。',
  era:'財會現場・每一格都有人要補',flatter:['先讓格式過關，缺的依據晚點追。','把待確認寫成已處理，先交這一版。','先照最新口頭說法填，附件以後補。']}),
 captain:Object.freeze({name:'船長',title:'人資行政專員',department:'people',seniority:'colleague',cost:11,sensitivity:.02,
  about:'Gill，也叫吉兒，人資行政專員。選店、訂位、招募文案都能開出新航線；二十五個人和十五個位子，也能被她排成一趟需要大家發揮彈性的旅程。',
  era:'船長歷險・行政海域',flatter:['先回全船都可以，名單之後再數。','照船長最新航線出發，細節靠臨場。','先幫整間公司答應，再找人接舵。']})
});
export const CAST_IDS_V39=Object.freeze(Object.keys(CAST_PROFILES_V39));
const choice=(text,result,delta,flags,extra={})=>({text,detail:'',result,delta,flags,...extra});

export function castSceneV39(id,index,row){
 const [slug,title,body,wing,scope,proof,wild,wildResult,roles=[],participants=[],privateContext=false]=row;
 const p=CAST_PROFILES_V39[id],n=index%3;
 const practical=[`把${scope}說清楚，留下${proof}。`,`先核對${scope}，不要只轉傳一句話。`,`請當事人確認${scope}，以${proof}為準。`][n];
 const result=[`你和${p.name}把${scope}逐項對起來，${proof}留在共同紀錄。事情沒有憑空變少，至少下一次不用從誰記得哪一句重新開始。`,`你把${proof}攤開，缺的地方當場標註。${p.name}有了能回覆的範圍，你也不必替${scope}補一個沒人答應過的保證。`,`你沒有替${scope}猜答案，先把${proof}確認好。${p.name}帶走可處理的一項，剩下的仍列待確認，沒有一起塞回你口袋。`][n];
 const fawn=[`你很快把${scope}排進工作，${proof}卻還沒有人補。${p.name}回去追問時，收到的仍是剛才那句沒問題；最後缺的資料又繞回你桌上。`,`漂亮的回覆先送出去，${scope}也因此看起來已經有人負責。等人問起${proof}，你才發現自己的點頭被當成唯一附件。`,`你把${scope}照最新說法重排，前一版沒有消失，只是晚一點回來找你。${proof}仍然缺一角，今天的速度換成明天的重做。`][n];
 return {id:`cast39-${id}-${slug}`,speaker:id,title,body,wing,minRules:39,minTurn:1,weight:1.35,era:p.era,
  sourceIds:['castFictionV39','characterFiction'],...(roles.length?{roles}:{}),...(participants.length?{participants}:{}),...(privateContext?{privateContext:true}:{}),
  choices:[choice(practical,result,{skill:6,trust:5,energy:-7,mood:-2},['evidence']),choice(p.flatter[n],fawn,{lick:6,trust:-4,energy:-8,mood:-5},['loop']),choice(wild,wildResult,{slack:7,trust:3,energy:-5,mood:5},['archive'],{wild:true})]};
}
