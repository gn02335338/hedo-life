// Presentation only. Authored English replaces this character's own speech;
// Chinese narration, player choices, RNG and canonical replay remain untouched.
// Do not walk choices/draw/outcomes here: unrevealed results are not UI input.
const DAILY_QUOTES = Object.freeze({
 'robot-review':['我那段先跳過好了，傑克知道大概在做什麼。',"Let's skip my part for now. Jack knows roughly what I am working on."],
 'variable-name':['要改命名就講規則，別先開學歷大會。',"If we are changing names, give me the rules. We do not need a degree-ranking session first."],
 'copilot-choice':['先看這個工具能不能幫到現在這一題。',"Let's see whether this tool actually helps with the problem in front of us."],
 'robot-answer':['客氣可以保留，不知道也要有地方講。',"It can stay polite, but it also needs a way to say it does not know."],
 'helpdesk-faces':['不管誰來問，回答標準可以一樣吧。',"Could we use the same standard for an answer, regardless of who asks?"],
 'file-family':['先找出哪一份真的參與了運算。',"First, find the version that actually went into the computation."],
 'demo-throne':['能不能先讓大家看它實際做得到什麼？',"Could we show everyone what it can actually do first?"],
 'medical-dream':['我只是說一個想法，不是同意接整間公司的病歷。',"I mentioned an idea. I did not volunteer to take the entire company's medical history."],
 'diploma-test':['我也想它直接過，但畫面沒答應。',"I would love it to pass too, but the test results disagree."],
 'handoff-window':['我可以補說明，不想當永久搜尋框。',"I can add documentation. I do not want to become a permanent search bar."],
 'row-number':['先別替序號頒智慧獎。',"Please do not give a row number an intelligence award just yet."],
 'sample-date':['樣本很新，不代表結論可以提早畢業。',"Fresh samples do not mean the conclusion gets to graduate early."],
 'validation-mirror':['先分開看，不然分數只是記性。',"Separate the datasets first. Otherwise, we are only scoring its memory."],
 'local-path':['它不是壞掉，是還沒說清楚住哪裡。',"It is not broken. We just have not told it where it lives."],
 'model-license':['先看清楚能怎麼用，再講怎麼賣。',"Read what we are allowed to use it for before deciding how to sell it."],
 'dad-said':['我沒有替他接這通授權。',"I have not been authorized to answer for him."],
 'answer-equality':['先看影響和資料，別先看人。',"Look at the impact and the information first, not the person asking."],
 'pm-bridge':['先不要卡在我這一頁啦，後面不是還很多嗎？',"Can we move past my slide? There is still plenty on the agenda."],
 'schema-promise':['系統不知道我們覺得這只是小改。',"The system does not know that we consider this a tiny change."],
 'support-night':['我晚上真的有事，你們先輪，之後再看吧。',"I really have plans tonight. You take this rotation, and we can sort mine out later."],
 'own-future':['我說想了解，沒有說這週就交一個新產品。',"I said I was curious. I did not promise a new product by the end of the week."],
 'data-owner':['我可以分析，不能分析還沒拿到的東西。',"I can analyze data. I cannot analyze data I have not received."],
 'masked-demo':['播一下也會被看見，先換展示資料。',"Even a brief demo is still visible. Replace the demo data first."],
 'model-weather':['模型沒有在鬧脾氣，我們先比資料。',"The model is not in a bad mood. Let's compare the data first."],
 'interview-background':['名字念完，不會自動知道誰適合。',"Reading out a name does not tell us who can do the job."],
 'approval-source':['問句請不要幫我寫成核准。',"Please do not turn my question into an approval."],
 'home-office':['工作要問就約工作時間，不要先替我排晚上的對話。',"Schedule work questions during work hours. Do not plan my conversations at home for me."],
 'medical-label':['先說這只是示範，不要替它長出沒驗證過的用途。',"Say clearly that it is a demo. Do not invent uses we have not validated."],
 'release-check':['我那個應該可以先過吧？真的有問題再補就好。',"Mine should be fine to go through first, right? We can fill in anything missing if it becomes a problem."],
 'work-own-name':['我做的那段寫我，別人的也照樣寫清楚。',"Put my name beside the work I did, and give everyone else the same credit."]
});
const SPECIAL_QUOTES = Object.freeze([
 ['你可以直接問我怎麼想，不用先猜我爸會怎麼說。',"You can ask what I think. You do not have to guess what my dad would say first."],
 ['先停一下。你現在要講的是哪件事？',"Stop for a moment. What exactly are we talking about?"]
]);
const QUOTES = Object.freeze([...Object.values(DAILY_QUOTES),...SPECIAL_QUOTES]);

// These are attributed clauses, rather than a whole-scene translation. This
// retains the Chinese narrator and other people in mixed-speaker encounters.
const ATTRIBUTED = Object.freeze([
 ['公主終於拿著飲料進來，看一眼議程，提議先略過自己那段。','公主終於拿著飲料進來，看一眼議程：「Let\'s skip my part for now.」'],
 ['公主問能不能用程式輔助工具','公主問：「Can I use a coding assistant for this?」'],
 ['公主指出來源空白','公主指著空白來源：「There is no source for that answer.」'],
 ['公主說同樣一個系統問題，有人問只拿到嗯嗯，換人來問卻能得到完整解釋。','公主說：「The same system issue gets a nod for one person and a full explanation for another.」'],
 ['她想補充限制，主持人又準備回到老闆的願景。','她才說：「Let me explain the limitations.」主持人又準備回到老闆的願景。'],
 ['公主說未來也想讀醫科','公主說：「I have thought about studying medicine.」'],
 ['她把紅色測試結果轉向你，問一份漂亮履歷能不能先別替程式宣布通過。','她把紅色測試結果轉向你：「Can we stop letting a good-looking CV declare that the code passed?」'],
 ['她把自己能回覆的時間列出來，問是不是打算把文件省成人名。','她把自己能回覆的時間列出來：「Are we replacing the documentation with my name?」'],
 ['公主想核對資料日期','公主先問：「What dates do these samples actually cover?」'],
 ['她反而先問是不是根本問了同一張考卷。','她反而先問：「Did we just give it the same exam twice?」'],
 ['她把使用條件打開，問你要不要先核對這句話是誰替對方同意的。','她把使用條件打開：「Who agreed that we could use it that way? Can we check?」'],
 ['她抬頭問是不是要她代替一個沒有出席的人回覆。','她抬頭問：「Am I supposed to answer for someone who is not even here?」'],
 ['她問你怎麼安排先後，旁邊有人又開始看來問的是誰。','她問：「How should we prioritize these requests?」旁邊有人又開始看來問的是誰。'],
 ['公主沒有反對，還問你能不能散會後順便幫她整理成同一份。','公主沒有反對，還問你：「Could you put my update into the same format after the meeting?」'],
 ['她問MIS窗口誰收到通知','她問MIS窗口：「Who was notified about this change?」'],
 ['她說晚上有自己的計畫','她說：「I already have plans tonight.」'],
 ['公主聊起下一步想學什麼','公主聊起：「Here is what I would like to learn next.」'],
 ['她問你要不要先找出到底哪一段條件變了。','她問：「Should we find out which conditions actually changed first?」'],
 ['她把候選人的作品放到最前面，問能不能先看大家實際做過什麼。','她把候選人的作品放到最前面：「Can we start with what each person has actually done?」'],
 ['說自己當時還在問資料哪裡來。','說：「I was still asking where the data came from.」'],
 ['她看那份清單，問這算不算公司把會議室搬進別人家。','她看那份清單：「Are we moving the company meeting room into someone\'s home now?」'],
 ['她提起自己的興趣，反而更不想讓一張標題超過能說明的範圍。','她提起自己的興趣：「That is exactly why the title should not claim more than this example can show.」'],
 ['她看你還沒收電腦，說這不就差一張圖','她看你還沒收電腦，說：「It is only one missing screenshot.」'],
 ['她問你能不能先列實際做過什麼的人，哪怕只是普通的一欄。','她問你：「Can we list who actually did what, even if it is just one ordinary column?」'],
 ['公主說不用演成這樣吧。','公主說：「Do we really need all this theatre?」'],
 ['公主先說回頭補給你','公主先說：「I will send you the update later.」'],
 ['公主喝完飲料，只補了一句差不多。','公主喝完飲料，只補了一句：「More or less.」'],
 ['公主說今晚不方便就是不方便','公主說：「When I say I am not available tonight, I mean it.」'],
 ['公主回了謝謝','公主回了：「Thanks.」'],
 ['公主說只是想先往下開','公主說：「I just wanted to move the meeting along.」'],
 ['公主只好回覆目前做到哪裡','公主只好回覆：「Here is what I have completed so far.」'],
 ['公主把幾句口頭近況傳給你','公主傳來幾句英文近況：「Here is the current status. These items are still pending.」'],
 ['公主回去追問時，收到的仍是剛才那句沒問題','公主回去追問：「Can you confirm the missing information?」收到的仍是剛才那句沒問題'],
 ['公主卻說要先確認資料範圍','公主卻說：「We need to confirm the data scope first.」'],
 // Meal invitations and all table reactions retain each branch's own mood.
 ['公主說最近想讀的東西很多，公司的問題卻總先繞去問背景。','公主說：「There is so much I want to read, but at work the conversation always circles back to my background.」'],
 ['公主回覆可以，想找一間能安靜吃完飯的店。','公主回覆：「Sure. Let\'s find somewhere we can finish a meal in peace.」'],
 ['公主說今天想自己休息，這次先不赴約。','公主說：「I would like some time to myself today. I will pass this time.」'],
 ['她把一件自己真的在意的事說完','公主說：「That is something I actually care about.」'],
 ['話題停在書、飯和最近睡得怎樣。','話題停在書、飯和最近睡得怎樣，公主說：「It is nice to talk without having to produce a career plan.」'],
 ['她卻聽成又要替她判斷適合哪條路。','她卻回：「Are you deciding which path I should take now, too?」'],
 ['公主笑了一下，照原本份量把飯吃完。','公主笑了一下：「Equal rice portions. Fair enough.」照原本份量把飯吃完。'],
 ['公主把雞蛋平分，說這個驗收她願意簽。','公主把雞蛋平分，說：「That is one acceptance test I am happy to sign.」'],
 ['公主說她今天其實不想再聽家譜。','公主說：「I really do not want another conversation about my family today.」'],
 // Verbal reactions. The co-worker's Chinese response in support stays intact.
 ['公主把畫面轉回錯誤紀錄，說她也想直接談程式，不想每次先解釋自己是誰的女兒。','公主把畫面轉回錯誤紀錄，說：「I would like to talk about the code, without having to explain whose daughter I am every time.」'],
 ['公主把測試畫面關小，說別把每個技術問題都講成她的背景。','公主把測試畫面關小，說：「Do not turn every technical issue into a discussion of my background.」'],
 ['公主指著出錯的那一行，問你是真的看過，還是也只記得她的家譜。','公主指著出錯的那一行，問：「Have you actually read this, or do you only remember my family tree?」'],
 ['公主也同意，這場難聽的話沒替誰保送過關','公主也說：「The same acceptance criteria for everyone. Agreed.」這場難聽的話沒替誰保送過關'],
 ['公主停止這輪對話，要求把原話與工作安排分開留下。','公主停止這輪對話：「Keep a record of what was said, separately from the work arrangements.」'],
 ['公主要求保留原話與在場經過。','公主要求：「Keep the exact words and a record of what happened here.」'],
 ['公主要求釐清剛才那句話。','公主要求：「Please clarify exactly what you meant by that.」'],
 ['公主把薪資條件放回兩人中間：「所以你現在怎麼決定？」','公主把薪資條件放回兩人中間：「So, what is your decision?」'],
 ['公主把話拉回任用條件：「那你接下來要怎麼做？」','公主把話拉回任用條件：「What are you going to do next?」'],
 ['公主把話題拉回眼前的安排，等你說接下來怎麼做。','公主把話題拉回眼前的安排：「What would you like to do next?」'],
 ['公主要求把剛才的話留下紀錄。','公主要求：「Please put what was just said on the record.」'],
 // Special appointment: work and private branches keep distinct consequences.
 ['公主把該補的內容列出來，順手把你提出的標準也留給你。','公主把該補的內容列出來：「These are the missing items. The same criteria apply to your part, too.」'],
 ['公主看你一眼，問今天是在看成果，還是在測誰的家譜比較新。','公主看你一眼，問：「Are we reviewing the work, or comparing how recently we joined the family tree?」'],
 ['公主請翅膀確認是不是由你改標準。','公主請翅膀確認：「Did you authorize this change in the acceptance criteria?」'],
 ['公主問你是不是連飯桌都要測誰的家譜比較新。','公主問你：「Are we comparing family trees at the dinner table now, too?」'],
 ['公主把話題轉去問旁邊的人，沒再等你決定節目。','公主轉去問旁邊的人：「What would you like to do next?」沒再等你決定節目。'],
 // Dream speech is English too; reality labels remain the narrator's Chinese.
 ['公主把白板上的家譜擦掉，請它拿出可重現步驟','公主把白板上的家譜擦掉，請它：「Show me the steps to reproduce this.」']
]);

export const PRINCESS_ENGLISH_COVERAGE_V47 = Object.freeze({
 dailyEventIds:Object.freeze(Object.keys(DAILY_QUOTES).map(slug=>`cast39-princess-${slug}`)),
 quoteCount:QUOTES.length,
 attributedClauseCount:ATTRIBUTED.length
});
const cnPunctuation=/[。！？!?]+$/u;
const isPrincess=context=>context?.speaker==='princess'||context?.target==='princess'||/(?:^|-)princess(?:-|$)/.test(String(context?.id||context?.eventId||''));

export function displayPrincessTextV47(value, context={}) {
 if(typeof value!=='string'||!value)return value;
 let text=value;
 // A selected player answer is not her line. Only a committed verbal action
 // can explicitly identify a quoted fragment inside that player's answer.
 if(context.field==='choiceText'&&context.quotedSpeaker!=='princess')return text;
 const princessContext=context.field==='wing'?context.speaker==='princess':isPrincess(context);
 // Referenced speech in the player's own Chinese insult remains a quotation.
 // A matching sentence spoken by any other actor is deliberately untouched.
 for(const [chinese,english] of QUOTES){
  for(const [left,right] of [['「','」'],['『','』'],['“','”']]){
   for(const candidate of [chinese,chinese.replace(cnPunctuation,'')]){
    if(princessContext||context.quotedSpeaker==='princess'){
     text=text.replaceAll(`${left}${candidate}${right}`,`${left}${english}${right}`);
    }else{
     for(const attribution of ['公主說：','公主說','公主問：','公主問','公主回覆：','公主回覆']){
      text=text.replaceAll(`${attribution}${left}${candidate}${right}`,`${attribution}${left}${english}${right}`);
     }
    }
   }
  }
 }
 // Only the character's quote card is entirely English.
 if(context.field==='wing'&&princessContext){
  const quote=QUOTES.find(([chinese])=>text===chinese);
  if(quote)text=quote[1];
 }
 for(const [chinese,english] of ATTRIBUTED){
  // In a mixed scene, an unlabelled 她 must never become Princess merely
  // because Princess is mentioned elsewhere. Explicit named clauses are safe.
  if(princessContext||chinese.includes('公主'))text=text.replaceAll(chinese,english);
 }
 return text;
}

function displayFields(source, fields, context={}, nested=[]){
 if(!source||typeof source!=='object')return source;
 // Copy descriptors rather than reading source getters. In particular, an
 // event's choices and draw outcomes remain the very same untouched objects.
 const descriptors=Object.getOwnPropertyDescriptors(source);
 for(const field of fields){
  const descriptor=descriptors[field];
  if(descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string'){
   descriptor.value=displayPrincessTextV47(descriptor.value,{...context,field});
  }
 }
 for(const [field,childFields] of nested){
  const descriptor=descriptors[field];
  if(descriptor&&Object.hasOwn(descriptor,'value')&&descriptor.value&&typeof descriptor.value==='object'){
   descriptor.value=displayFields(descriptor.value,childFields,context);
  }
 }
 return Object.defineProperties({},descriptors);
}

export function displayPrincessEventV47(event, run){
 if(!event||typeof event!=='object')return event;
 const context={id:event.id,speaker:event.speaker,target:run?.verbalContext?.target||run?.rageContext?.target};
 // Chapter records are already committed. Do not touch choice.result or draws.
 return displayFields(event,['title','body','wing'],context,[['resolvedChapter',['result']]]);
}

export function displayPrincessHistoryV47(row, run){
 if(!row||typeof row!=='object')return row;
 const context={id:row.eventId,speaker:row.speaker,target:row.verbalOutcome?.target||row.patronageOutcome?.target||run?.rageContext?.target,quotedSpeaker:row.verbalOutcome?.target==='princess'?'princess':undefined};
 return displayFields(row,['title','body','wing','choiceText','result'],context,[['eventOutcome',['label','result']]]);
}
