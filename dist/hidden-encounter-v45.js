import {hiddenStoryV66} from './hidden-stories-v66.js';
import {TYPHOON_STORY_V75,resolveTyphoonChoiceV75} from './typhoon-story-v75.js';
// Public original scenes for a rare fictional visitor. The administrator's
// separate archive, source material and portrait are never imported here.
export const HIDDEN_PERSONAS_V45=Object.freeze({'hidden-visitor':Object.freeze({name:'魚酥姐',title:'辦公室支援角色',image:'./assets/hidden-visitor.png',portrait:true,hidden:true,about:'偶爾出現，協助語言與辦公室日常安排的支援角色。'})});
export const HIDDEN_SCENE_COUNT_V45=8;
export const HIDDEN_PERSONAS=HIDDEN_PERSONAS_V45;
const rows=[
 {
  "title": "這段英文，誰負責中文以後的事？",
  "body": "產品簡介要英翻中。你才拿到第一稿，旁邊已經有人問，能不能順便讓文案看起來像一間快上市的公司。",
  "choices": [
   {
    "text": "先確認產品真的做得到哪些。",
    "result": "你把能驗證的功能留下，願景另外標示。翻譯沒有替程式碼偷偷加功能。"
   },
   {
    "text": "把上市願景翻成未來式，再加三層條件句。",
    "result": "你交出一段文法精準、承諾極少的文字。每個人都看得懂，卻沒人能拿它當明天已經完成。"
   },
   {
    "text": "原文先退回去，這不是翻譯能修好的規格。",
    "result": "你指出原稿缺少能核對的範圍，要求產品窗口補齊。今天少翻一段，後面少背一鍋。"
   }
  ]
 },
 {
  "title": "監視器沒有錄到需求變更。",
  "body": "畫面上，你半天都坐在同一張椅子。真正來回修改六次的需求，偏偏不在攝影機的視角裡。",
  "choices": [
   {
    "text": "把工單時間軸貼在工作紀錄。",
    "result": "畫面留給畫面，工作留給紀錄。你沒有試著靠椅子移動次數證明自己忙。"
   },
   {
    "text": "替每次需求變更在鏡頭前舉一次紙板。",
    "result": "你第一次舉板，大家才發現同一個下午其實已經改到第六版。紙板不能改善需求，但至少不再只有人頭會動。"
   },
   {
    "text": "詢問這次到底要確認出勤還是交付。",
    "result": "兩個問題終於分開。你回覆出勤，交付另由真正看得懂內容的人確認。"
   }
  ]
 },
 {
  "title": "魚酥分類學。",
  "body": "零食櫃分成已開封、未開封，還有不知道誰開封。你的資料表還沒這麼乾淨，餅乾卻先有了狀態欄。",
  "choices": [
   {
    "text": "幫每包留下開封日期。",
    "result": "規則總算能共用，不必每次都靠一位零食管理員記憶。"
   },
   {
    "text": "把魚酥做成辦公室第一個真正上線的資料產品。",
    "result": "你畫出三個欄位，分類表當天下午就能使用。旁邊的人終於看見一個不用再談願景的系統。"
   },
   {
    "text": "整理完就回原本工作。",
    "result": "你把幫忙範圍說清楚。魚酥歸位，不代表你從此兼任零食架構師。"
   }
  ]
 },
 {
  "title": "英文標點，中文責任。",
  "body": "一句英文少了逗點，中文卻多了一整段原稿沒有的保證。你問這一段是翻譯，還是新需求。",
  "choices": [
   {
    "text": "把原文與新增內容分欄。",
    "result": "翻譯、改寫與新承諾終於各有負責人。"
   },
   {
    "text": "用螢光筆把責任畫到比段落還亮。",
    "result": "整張紙只剩責任範圍在發光，大家很難再假裝那是自然長出的標點。"
   },
   {
    "text": "請提出保證的人自己確認。",
    "result": "你把那一段送回真正做決定的窗口，沒有替別人的口頭承諾補簽名。"
   }
  ]
 },
 {
  "title": "整理零食，也得有停止條件。",
  "body": "你幫忙把零食擺好，隔天卻收到新的分類要求。開封方向、袋口高度和看起來整不整齊，開始像設計評圖。",
  "choices": [
   {
    "text": "先約定做到哪裡算完成。",
    "result": "你留下一張簡單的擺放規則，整理不再無限往下一版延伸。"
   },
   {
    "text": "替零食櫃掛一張驗收凍結牌。",
    "result": "大家笑著收下你的紙牌，今天的餅乾先不用再進第三輪評審。"
   },
   {
    "text": "告知這次只支援一次。",
    "result": "你把協助與本職分開，沒有讓一句順手變成永久職務。"
   }
  ]
 },
 {
  "title": "鏡頭外的那一封信。",
  "body": "螢幕上看起來只是你在打字。那封信卻正在確認一句誰也不肯寫下來的安排。",
  "choices": [
   {
    "text": "把已確認與待回覆分開記。",
    "result": "你收好時間與版本，沒有請監視畫面代替對方回覆。"
   },
   {
    "text": "替待回覆欄設一個空氣董事會。",
    "result": "你畫出一排空椅子，每張都等一個決定。辦公室的沉默第一次有了座位表。"
   },
   {
    "text": "先回到能交付的部分。",
    "result": "你把卡住的事項列明，繼續做手上能完成的工作。"
   }
  ]
 },
 {
  "title": "一個人，三種職務。",
  "body": "上午有人說需要翻譯，下午改口要協助行銷，傍晚又問零食櫃是不是整理好了。三句話好像各自只占五分鐘。",
  "choices": [
   {
    "text": "列出時間與主次順序。",
    "result": "事情都有人提出，現在也得有人決定先做哪件。"
   },
   {
    "text": "替自己的行事曆做三張分身門禁卡。",
    "result": "卡片排成一列，大家終於看出同一個人不能同時坐在三個位置。"
   },
   {
    "text": "請窗口確認正式分工。",
    "result": "你要求把協作範圍講清楚，不用稱呼變一次就重新報到。"
   }
  ]
 },
 {
  "title": "翻譯稿的第八個最後版。",
  "body": "檔名已經寫著final，後面卻又接了兩個new。你問哪份是準備發布的版本，回答仍是先用最新那份。",
  "choices": [
   {
    "text": "建立單一確認連結。",
    "result": "版本留在同一個地方，誰改了什麼都能核對。"
   },
   {
    "text": "替每個final舉行一次小型告別式。",
    "result": "你把舊稿整齊封存，今天終於有人肯指定一份真的能發布的檔。"
   },
   {
    "text": "等正式確認再發。",
    "result": "你沒有為了快一分鐘，把後面的更正信全部先接下來。"
   }
  ]
 }
];
const verbalLines=[
 "幹，產品做不到就想靠翻譯上市，是要我把bug翻成市值膩？",
 "幹，鏡頭只會拍椅子不會看需求，想驗收就拿紀錄，別拿我當監視器螢幕保護程式。",
 "幹，魚酥都有狀態欄了，公司的需求還他媽活在口頭禪裡？",
 "幹，少一個逗點就多一張保證書，你們是在翻譯還是在偷塞合約？",
 "幹，一包零食改三版，餅乾都快被你們改到離職了，差不多就好吧？",
 "幹，鏡頭拍得到我打字，拍不到你們不敢寫下來的屁話，有種就回信啊？",
 "幹，一個人塞三份工作還裝成順手，你們怎麼不先把薪水也順手發三份？",
 "幹，final後面塞兩個new就叫最新版，這是在管版本還是在繁殖檔名？"
];
const c=(text,extra={})=>({text,detail:'',result:'',delta:{},flags:[],...extra});
export function getHiddenEncounterEventV45(run){
 const context=run?.hiddenEncounterContext,row=rows[context?.scene]||hiddenStoryV66(run,context?.scene);
 if(!context||context.version!==1||!row)throw new Error('Invalid hidden encounter');
 const base={id:`hidden45-${context.scene}-${context.stage}`,kind:'hidden',speaker:'hidden-visitor',hiddenCharacter:true,scope:'private',era:'意外相遇',sourceIds:['characterFiction'],scene:[0,1,3,5,6,7].includes(context.scene)?'office_day':'admin_coffee',wing:'',...(row===TYPHOON_STORY_V75?{participants:[...row.participants]}:{})};
 if(context.stage===1&&row===TYPHOON_STORY_V75)return {...base,title:'先停下推車，把賣場現場處理好。',body:context.incident==='real'?'剛才真的有人揮手，採買走道已經被推車和圍觀的人堵住。賣場人員請雙方分開，先確認傷勢與聯繫方式。':'話已經吵到旁邊的人都轉頭，賣場人員請雙方把音量放低、拉開距離。先說清楚實際發生的事，再繼續各自的採買。',choices:[c('請賣場人員協助分開，確認是否需要就醫。'),c('留下實際原話與經過，必要時再各自說明。'),c('先把衛生紙扶正，讓走道恢復通行。',{wild:true})]};
 if(context.stage===1)return {...base,title:'先把現場收拾好。',body:context.incident==='real'?'你剛才真的動了手，旁邊的人已經把雙方分開。原本的閒聊停了，先確認有沒有人受傷，再決定怎麼留下說明。':'話越說越重，旁邊的人請你們先分開。有個人提出要留下紀錄，這場私人爭執得先有個可以聯繫的處理方式。',choices:[c('請現場的人協助分開，確認彼此是否需要就醫。'),c('如果需要說明，就到派出所各自把經過說清楚。'),c('收起腦中的記者會麥克風，先把傾倒的杯子扶正。',{wild:true})]};
 return {...base,title:row.title,body:row.body,choices:[...row.choices.map((choice,index)=>c(choice.text,index===(row===TYPHOON_STORY_V75?2:1)?{wild:true}:{})),c(row.verbal||verbalLines[context.scene],{hiddenAction:'verbal'}),c('受不了了，扁他。',{hiddenAction:'rage'})]};
}
export function resolveHiddenEncounterChoiceV45(run,index,draw){
 const context=run.hiddenEncounterContext,row=rows[context.scene]||hiddenStoryV66(run,context.scene);
 if(!Number.isInteger(index)||draw<0||draw>=1||!row||![0,1].includes(context.stage))throw new Error('Invalid hidden choice');
 if(row===TYPHOON_STORY_V75)return resolveTyphoonChoiceV75(run,index,draw);
 if(context.stage===1){
  if(index<0||index>2)throw new Error('Unavailable hidden aftermath');
  return {mode:'aftermath',label:['先處理現場','留下個人爭議說明','收好場面'][index],result:[
   '你們拉開距離，請現場的人協助確認狀況與後續聯繫。該就醫的先就醫，不再靠補一句氣話處理。這場私人爭執沒有直接更改你的任職狀態。',
   '你們分開說明經過，把看見和推測分清楚。是否還要後續處理，依留下的紀錄與實際通知確認；這不是公司的人事離場程序。',
   '你先停下來，把杯子扶正，請旁邊的人協助保持距離。玩笑留在腦中，該確認的傷勢和聯繫方式仍一項一項留下。今天沒有把爭執變成新一場表演。'
  ][index],delta:{mood:draw<.35?3:-2,energy:-3},done:true};
 }
 if(index>=0&&index<=2)return {mode:'normal',label:draw<.25?'話剛好接上了':'短暫的辦公室插曲',result:row.choices[index].result,delta:{mood:draw<.25?10:5,energy:-2,...(index===1?{slack:4}:{skill:3})},done:true};
 if(index===3){const serious=draw>.87;return {mode:'verbal',label:serious?'私人爭議待說明':draw<.25?'對方沒有接話':'對方請你收斂',result:serious?'對方把話停下來，請旁邊的人一起留下經過。有人提到要另作說明，你們先拉開距離；原本那件小事已經不是現在要處理的重點。':draw<.25?'她看了你一眼，把手上的事收完，沒有接下那句話。你站了一會，才發現這場爆氣只剩自己還沒散場。':'她把東西放下，直接請你別把情緒往別人身上倒。旁邊的人讓你們先各自離開，這段關係沒有因為你講得很大聲就變好。',delta:{mood:draw<.25?5:-8,trust:-5,energy:-3},done:!serious,incident:serious?'verbal':null};}
 if(index===4){const real=draw<(run.stats.mood<=30?.5:.22);return real?{mode:'real',label:'真的失控了',result:'你的手真的揮了出去，桌邊的杯子倒下，旁邊的人立刻把雙方隔開。這不是想像，你得先面對眼前的狀況。',delta:{mood:-5,energy:-8,trust:-5},done:false,incident:'real'}:{mode:'imagined',label:'腦內劇場',result:'你在腦內揮了一拳，連餅乾盒都像慢動作飛了起來。你眨了一下眼，杯子還好好放在桌上，自己的手也沒有動。剛才只是想像；你深吸一口氣，回去面對原本的工作。',delta:{mood:8,energy:-2},done:true};}
 throw new Error('Unavailable hidden choice');
}
