// Original AI-workplace satire. AUTO_INCREMENT is ordinary database numbering;
// the joke is calling it an AI model, not treating the database feature as a bug.
const c=(text,result,delta,flags=[],wild=false)=>({text,detail:'',result,delta,flags,...(wild?{wild:true}:{})});

export const AI_EVENTS_V31=[{
 id:'ai31-auto-increment',title:'模型還沒載入，先把資料庫救回來。',
 era:'職業日常・AI 研發',roles:['ai'],minRules:31,minTurn:0,weight:1.4,
 speaker:'rick',sourceIds:['characterFiction'],
 body:'你以為今天終於能碰模型，瑞克卻傳來一張資料匯入失敗的截圖：「AI 壞了，幫忙修一下 DB。」錯誤訊息提到重複編號，專案資料夾裡卻找不到訓練程式。你問模型放哪裡，他說先把資料救回來，老闆等一下要看成果。',
 wing:'先讓資料進得去。這套 AI 每天都在成長，老闆很重視。',
 choices:[
  c('先查備份、資料表結構與匯入紀錄，確認編號從哪裡來。',
    '你比對後發現，匯入程式硬塞了重複的 id；主鍵本來就設了 AUTO_INCREMENT，根本不用它代填。修好匯入流程後，新資料一筆筆編號。你問 AI 模型在哪，瑞克指著那行設定：「這不就是 AI？」原來公司的 AI 是 Auto Increment。資料庫有自動編號，你的職涯沒有自動對焦。',
    {skill:8,trust:6,energy:-8,mood:-8},['evidence','handover_notes']),
  c('先核對匯入規則，讓程式別再自己亂填編號。',
    '你保留主鍵的 AUTO_INCREMENT，拿掉匯入時手填 id 的步驟，再補上檢查與測試。資料終於寫進去了，瑞克要你在週報寫「AI 恢復學習」。你看著只會往上加的編號：這裡的 AI，原來是 Auto Increment。你把真正的修正內容留在工單，免得下次又被叫來替流水號調模型。',
    {skill:7,trust:5,energy:-7,mood:-7},['evidence','archive']),
  c('替每一筆資料辦入職報到，請它們照號碼牌排隊。',
    '你拿紙箱做報到櫃檯，叫重複的 id 先別插隊，再把修好的匯入程式跑過一次。主鍵的 AUTO_INCREMENT 正常發號，瑞克當場宣布 AI 已經學會排隊。你這才懂，公司的 AI 是 Auto Increment；人類負責修 DB，人工智慧負責把 41 變成 42。紙箱最後被留下來，說下次展示還用得到。',
    {slack:8,trust:5,energy:-6,mood:5},['archive','evidence'],true)
 ]
}];
