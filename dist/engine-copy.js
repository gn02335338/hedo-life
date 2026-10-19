import { ROLE_MAP } from './roles.js';
import { EVENT_COPY } from './copy-edits.js';

// Copy is applied after the original event has computed its checks. Changing a
// sentence must not change which ability is checked, its odds, or its effects.
const textKeys=['text','detail','result','label'];
function textPatch(original,patch,keys=textKeys){
 const next={...original};
 for(const key of keys)if(typeof patch?.[key]==='string')next[key]=patch[key];
 return next;
}
function choicePatch(original,patch){
 let next=textPatch(original,patch);
 if(original.check){
  next.check={...original.check};
  for(const outcome of ['success','failure'])if(original.check[outcome])next.check[outcome]=textPatch(original.check[outcome],patch?.check?.[outcome],['result']);
 }
 if(original.draw){
  next.draw=textPatch(original.draw,patch?.draw,['label']);
  next.draw.outcomes=original.draw.outcomes.map((outcome,index)=>textPatch(outcome,patch?.draw?.outcomes?.[index],['label','result']));
 }
 return next;
}
function eventPatch(event,patch){
 const next=textPatch(event,patch,['title','body','wing']);
 next.choices=event.choices.map((choice,index)=>choicePatch(choice,patch?.choices?.[index]));
 return next;
}

function dynamicCopy(run,{jobTitle,educationLabel}){
 const role=ROLE_MAP[run.roleId];
 switch(run.eventId){
 case 'onboarding':{
  const unchanged=run.assignment==='honest';
  return {
   body:unchanged?`你應徵「${role.name}」，報到後的職稱也是「${jobTitle(run)}」，這次沒有改派。你剛鬆一口氣，Wing補了一句：「工作內容本來就要有彈性。」你再看一眼桌上的JD，原來那只是面試時的參考資料。`:run.assignment==='swapped'?`你應徵「${role.name}」，報到時卻被改派為「${jobTitle(run)}」。${run.roleId==='ai'?'模型沒看到，CRUD與資料庫密碼倒是給得很齊。AI的A，原來是Anything。':'面試聊過的專業，今天變成「你應該也會吧」。'}Wing說這叫跨領域，你想的是掛羊頭賣狗肉。`:`你應徵「${role.name}」，報到時卻改以「${jobTitle(run)}」任用。今天先訂便當、整理Excel、貼發票；問起面試談好的工作，得到的答案是等公司上市再說。遊戲月薪也從${run.offerPay}K縮成${run.pay}K。`,
   choices:{
    0:{text:'先坐下。房租不收尊嚴。',result:'你坐進座位。桌上還沒有名牌，待辦清單已經寫上你的名字。'},
    1:{check:{failure:{result:unchanged?'你逐項問工作範圍，他只回答要有彈性。事情沒問清楚，倒是先拿到「不好帶」的評語。':'你逐項問職務差異，他只回答要有彈性。工作沒換回來，倒是先拿到「不好帶」的評語。'}}},
    2:{text:'蛤？那我先走，這份JD留給下一位。'}
   }
  };
 }
 case 'education-review':{
  const ed=run.education;
  const reaction=ed.schoolId==='ntu'&&ed.degree!=='EMBA'&&ed.field==='stem'?'Wing一聽到「臺灣大學」，笑著接話：「台大的喔？那應該很會讀書。」剛才還算普通的閒聊，忽然像在替你重新評價。':ed.degree==='EMBA'?'聽到EMBA，Wing笑著補一句：「我說的讀書，不是你以為的那種讀書。」你看他一眼，決定先不問他到底指哪一種。':['humanities','business'].includes(ed.field)?'你才講完科系，Wing就接話：「你這個背景，平常到底有沒有在讀書？」你想說讀完才有畢業證書，但他看起來不是在等這個答案。':ed.sector==='private'?'校名一說出口，Wing的表情就變了，接著問你最近讀了什麼書。剛才問哪裡畢業，現在又像在考入學。':'Wing點點頭：「學歷不能代表什麼，重點是你有沒有一直讀書。」講完，他又問隔壁同事是哪間學校。';
  return {body:`工作聊到一半，Wing忽然笑著問：「你哪裡畢業的？」你以為只是閒聊，照實回答：「${educationLabel(ed)}。」${reaction}`,choices:{
   0:{result:'你回座位補技術文件。他到底想聽哪本書，你暫時不想猜。'},
   2:{result:'待讀清單確實有那本，書還沒買。Wing滿意地點點頭，這次看來不用考內容。'}
  }};
 }
 case 'salary-cut':return {
  body:`Hope約你談薪資。Wing本人不在，評語已先到：「我覺得你不值這個價。」原本的遊戲月薪${run.salaryCut.from}K，現在要調成${run.salaryCut.to}K。你通過了試用期，公司卻想把薪水重新試一次。`,
  choices:{1:{result:'你把新薪資單推回去。既然價格談不攏，這份工作就到這裡。'},2:{check:{failure:{result:'Hope轉達：「Wing覺得這就是你的價值。」你交的紀錄還攤在桌上，沒有人接著看。'}}}}
 };
 case 'salary-final':return {
  body:`Hope轉達，方案沒有改：遊戲月薪從${run.salaryCut.from}K降成${run.salaryCut.to}K。Wing沒出席，結論倒是早就定好了。現在只等你說留不留。`,
  choices:{1:{result:'對方問你是不是太衝動。你說考慮過了，不接受。談完，收東西。'}}
 };
 case 'crisis-boss':return {choices:{
  1:{result:'Erich說公司已經很有誠意，JenJen把表格往前推，Sonny看了一眼時間。你把手放回桌下，請他們先說清楚。'},
  2:{result:'Hope寄來改善計畫，轉述Wing的要求。表上列了三個工作目標，你看完還是不知道，做到什麼程度才算他滿意。'}
 }};
 case 'paperwork':return {choices:{
  0:{result:'你保留書面往來，表格也沒有簽。至少離開的原因，不會只剩公司填的那一版。'},
  1:{result:'這一局沒有PIP。上一封信還在催進度，下一封已經要你交接。'},
  2:{result:'Hope接手主持PIP，先給你一張自評表。原本的工作照做，另外每天還要花時間證明自己有做。'}
 }};
 case 'crisis-mood':return {
  body:'通知再響一次，你連點開都覺得煩。人還坐在辦公室，離職信已經寫到第三版。今天還要繼續裝沒事嗎？',
  choices:{0:{result:'你把離職信寄出去，沒有再補「感謝公司栽培」。群組還在談敲鐘，你先回家。'},1:{result:'你關掉通知，花一點存款讓自己休息。今天先不替工作操心。'},2:{result:'你把「正在處理」設成快捷鍵。薪水照領，額外的熱情暫停供應。'}}
 };
 case 'pip-review':return {
  body:'改善期走完了。你帶著成果、時間線和紀錄進會議室，HR長Hope先請你替自己打分。Wing依舊沒出現，Hope卻不時提起他的意見。你對照表上的目標，試著找出他到底在評哪一項。',
  choices:{0:{check:{failure:{result:'Hope說理解你的努力，接著在最後一格填上「未達改善目標」。你問是哪一項，她說是整體評估。'}}},1:{check:{success:{result:'報告以「感謝Wing與Hope」開場。Hope說會協助轉達，沒多久就帶回了通過的消息。'}}},2:{result:'你沒有再補第十七版改善報告。最後這場會議，終於準時結束。'}}
 };
 case 'pip-passed':return {
  title:'PIP過了。恭喜，你還在移動。',
  body:'Hope的通過通知只有一行。之後幾場會議沒邀你，交辦卻照樣準時送到。Wing沒有參加PIP評核，見到你時的臉色倒是一點也沒變。',
  choices:{0:{result:'該交的成果都交了，PIP也過了。你把通知存好，再寄出離職信。'},1:{result:'你刪掉感謝詞，只記日期、要求和交付。檔案夾裡的東西，開始夠寫一本小史冊。'},2:{result:'工作還是得做；老闆經過時，你也更會挑一個看起來很忙的畫面。'}}
 };
 case 'promotion-review':return {
  body:`你目前是${jobTitle(run)}，遊戲月薪${run.pay}K。Wing說公司看得見你的付出，接著攤開下一張組織圖。這次要怎麼跟他談？`,
  choices:{2:{result:'你婉拒了多管幾個人的機會。今晚沒有新群組要加，可以照原本的時間回家。'}}
 };
 case 'self-care':return {
  body:'上班夠煩了，今天想花一點遊戲存款，做件自己喜歡的事。行事曆先留一格，通知關掉。想怎麼休息？',
  choices:{0:{result:'你拿著飲料走了一圈，路上沒有人追進度。回來時冰塊融了一半，心情也鬆了一點。'},1:{result:'朋友沒叫你共體時艱，只問要不要再點一道。你邊吃邊講，這頓飯總算有人肯聽。'},2:{result:'你吃飽、睡好，手機整晚放在勿擾。隔天打開來看，原來少盯幾個小時，世界也沒停。'},3:{result:'你把消費頁關掉，錢先留著。回到座位，原本那件事還沒做完。'}}
 };
 case 'exit-menu':return {
  body:`第${run.turn+1}個工作回合，職稱是${jobTitle(run)}，心情剩${run.stats.mood}。你看著還沒完成的待辦，決定先想自己的事：今天要不要走？`,
  choices:{1:{result:'你回想這段日子做過的事，看看離開前還想完成哪一件。'},2:{result:'離職信先存草稿。回去把剛才那件事處理完，再決定要不要寄。'}}
 };
 case 'career-exit':return {
  body:'交接清單寫完了。你看一眼座位，關掉訊息，想想這段日子最後要怎麼收尾。',
  choices:{0:{result:'職缺頁還在徵專業人才。你收好交接清單，上面密密麻麻都是面試時沒提過的「其他交辦」。'},2:{text:'把所有通知調成勿擾，把時間留給生活。'},3:{result:'你寫完最後一篇感謝文。每一段都提到Wing，這次應該沒漏掉他。'},5:{result:'你把東西收好，決定今天就是最後一天。'},6:{result:'還有一件自己想做的事。你暫時回到座位，沒跟Wing多解釋。'}}
 };
 case 'final-shortfall':return {
  body:'敲鐘日期一改再改，收購消息也又延了一次。大家說下一站就到了，你看著還沒訂的機票，開始算自己究竟等了多久。',
  choices:{0:{text:'新聞稿留給你，我先走了。',result:'你關掉那份上市簡報。今天能確定完成的事，是自己的交接。'}}
 };
 case 'finale':return {choices:{3:{text:'不去交易所。我還有自己的打算。',result:'你收起那張舊清單，翻到背面，開始寫自己接下來想做的事。'}}};
 default:return null;
 }
}

// Only user-facing text is visited. IDs, source references, effects, numeric
// deltas, draw weights, and check probabilities retain their original values.
function renameChoice(choice){
 const next=textPatch(choice,Object.fromEntries(textKeys.filter(key=>typeof choice[key]==='string').map(key=>[key,choice[key].replaceAll('禾多','移動')])));
 if(next.check){next.check={...next.check};for(const outcome of ['success','failure'])if(next.check[outcome])next.check[outcome]={...next.check[outcome],result:next.check[outcome].result.replaceAll('禾多','移動')};}
 if(next.draw)next.draw={...next.draw,label:next.draw.label.replaceAll('禾多','移動'),outcomes:next.draw.outcomes.map(outcome=>({...outcome,label:outcome.label.replaceAll('禾多','移動'),result:outcome.result.replaceAll('禾多','移動')}))};
 return next;
}
export function applyEventCopy(event,run,context){
 if(!event)return event;
 let next=eventPatch(event,dynamicCopy(run,context));
 next=eventPatch(next,EVENT_COPY[event.id]);
 for(const key of ['title','body','wing'])if(typeof next[key]==='string')next[key]=next[key].replaceAll('禾多','移動');
 next.choices=next.choices.map(renameChoice);
 return next;
}

const RESULT_EDITS=[
 [' 助理轉正； 職稱變更：',' 助理轉正。職稱變更：'],
 [' 恰好，這句話踩中他今天想聽的版本。對方自己替你把後半段補成了優點。',' 剛好這句是他今天想聽的，他還替你補了幾句。'],
 [' 剛好有人把會議延後，你安靜回收了一小段人生。今天的省電模式，沒有被發現。',' 剛好會議延後，你多偷到一點空檔，也沒人來問。'],
 [' 剛好有人替你的成果說了一句話。事情本身沒變，待遇突然順了一點。',' 剛好有人替你的成果說了句好話，後面幾件事也談得順一點。'],
 [' 不巧，他今天把稱讚聽成了敷衍。你說同一句話，得到跟上次相反的表情。',' 不巧，他今天把稱讚聽成敷衍。同一句話，上次明明還笑得很開心。'],
 [' 不巧，那扇門就在你最不像在忙的時候打開。你和老闆完成了一次不必要的眼神交接。',' 不巧，老闆就在你最不像在忙的時候推門進來。四目相對，你只好先把分頁關掉。'],
 [' 不巧，臨時插進來的交辦把原定節奏打散。沒有人改期限，只有你重新排時間。',' 不巧，又插進一件臨時交辦。原本的期限沒改，你得重排自己的時間。'],
 ['今天不知道誰先拍對馬屁，辦公室暫時放晴。','不知道誰剛才拍對了馬屁，Wing今天臉色還不錯。'],
 ['公司沒發生什麼事，老闆也先沒有。','公司沒出什麼事，Wing也暫時沒來找事。'],
 [' 空降蜜月退潮，連「新氣象」都開始聽起來像罪名。',' 剛到職那幾天的客氣已經用完了。現在提「新氣象」，Wing只覺得你在嫌原本的人。'],
 [' 剛好碰上喜歡的歌，今天的小事意外地很對味。',' 路上剛好播到喜歡的歌，心情又好了一點。'],
 [' 路上還是想到一點工作，休息沒有完全照劇本走，但這段時間仍然是你的。',' 休息時還是忍不住想到工作，沒有完全放鬆，至少這段時間不用回訊息。'],
 [' 沒有奇蹟，也沒有加班訊息。這樣的一段時間已經很有用。',' 這段時間沒有加班訊息，光是這樣就休息到了。']
];
export function polishEngineText(text){
 let next=text.replaceAll('禾多','移動');
 for(const [before,after]of RESULT_EDITS)next=next.replaceAll(before,after);
 return next;
}
