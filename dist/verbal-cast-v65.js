import {CAST_IDS_V65,CAST_PROFILES_V65,isCastV65} from './cast-v65.js';

// Fictional spoken criticism follows the visible scene, never a character's
// unrelated biography or a guessed motive. Outcomes remain the engine's draw.
const topics=[
 [/門禁|回鍋|入職|報到|交接|舊系統|版本沿革/,['幹，這次的工作、權限和交接先講清楚。熟面孔不是萬用附件，別一句以前就這樣，把現在沒人確認的東西全塞回來。','靠北，剛才確認過的範圍就留著。別一轉頭又拿以前那版當規定，然後叫做事的人自己想辦法記得。']],
 [/考核|主管職|全才|設計|評圖|按鈕|稿子|主畫面/,['幹，決定權、規格和驗收標準拿出來。綽號不能簽核，臉色也不是測試結果；少把沒講清楚的需求包成別人不夠配合。','靠北，哪裡不同就指出來，哪一版過了就留紀錄。不要每次做到最後，又拿一句感覺不對讓所有人重新投胎。']],
 [/區塊鏈|投資|高粱|酒櫃|募資|新事業/,['幹，誰用、誰付、交什麼，至少講成能核對的話。白板畫再多箭頭也不會自己入帳，別拿我的工時替一句好機會站台。','靠北，剛才問的條件還沒回答，別再加一輪名詞。想法可以慢慢談，工作跟個人的錢都不是聽完就自動同意。']],
 [/排程|專案|催件|交付|會議|問號|需求|工時/,['幹，新工作進來要哪一件先停，直接講。行事曆不是壓縮檔，你們每次都說順便，最後只剩做事的人他媽沒有明天。','靠北，剛才排好的順序就別裝沒看見。要改就把影響一起認，少讓每一包臨時交辦都假裝只占一句話的時間。']],
 [/活動|訓練|福委|主持|Outdoor|問卷|日本|冷凍/,['幹，人數、流程和負責人說清楚。活動不是你們心情好就加人，心情差就換人的猜謎節目；少叫現場的人替每個空白格表演懂事。','靠北，剛才誰答應什麼就照原話留著。別把問卷當效忠書，把幫忙當全包，最後還說大家只是來玩。']],
 [/客戶|業務|報價|挖角|合作|同學|簡介/,['幹，客戶到底要什麼、我們答應哪段，講完整。合照跟同學交情不會替工程師寫完規格，別把每句客氣都翻成我的交期。','靠北，拿出剛才那份條件核對。別在客戶前面什麼都敢送，轉身又問做事的人為什麼不會自己生出來。']]
];
const fallback=['幹，要誰做哪段、怎麼算完成，先講成人聽得懂的話。少讓一句沒講完的交辦占掉整天，還怪別人沒有讀心術。','靠北，剛才的問題還是那一題。要改就明講哪裡改，別換個口氣就當自己已經回答。'];
const privateLines=['幹，這是下班吃飯，不是免費加開的工作會議。想聊什麼先問本人，別把我的晚上拿去補白天沒講清楚的那一包。','靠北，剛才都說是私下安排了。誰要去、誰付哪一份就照本人意思，少替別人把不同意改成隨便都可以。'];
export function castVerbalLineV65(run,event,target,phase='event'){
 if(!isCastV65(run)||!CAST_IDS_V65.includes(target))return null;
 const at=phase==='result'?1:0,text=[event?.title,event?.body,event?.wing].join(' '),privateScene=event?.privateContext===true||event?.scope==='private'||event?.id===`meal-with-${target}`;
 // Design/project details outrank a metaphorical "報到" or "交接" in the
 // heading. A real onboarding or return still falls back to that last topic.
 const topicOrder=[...topics.slice(1),topics[0]];
 const lines=privateScene?privateLines:topicOrder.find(([pattern])=>pattern.test(text))?.[1]||fallback;
 return `${CAST_PROFILES_V65[target].name}，${lines[at]}`;
}
const reactions={
 zoe:{ignored:'201把流程表放回桌上，說先把活動辦完。你的火氣沒被接走，該確認的人數與分工卻還在。',relationship:'201收起原本能當面問的口氣，後續只寄正式通知。這次沒有誰宣布解凍，兩人的對話先少了幾度。',retort:'201反問，不滿的流程就指哪一條，為什麼連她也變成你要臨場處理的情緒。麥克風沒開，旁邊的人仍然聽見了。',support:'同事拿來原本的分工表，指出確實有一段沒說清楚。201把它記下來，沒有因此同意你剛才每一個字。'},
 action:{ignored:'順哥把筆放下，說條件可以繼續問。你那句重話沒有變成投資決定，白板上的問題也還沒被回答。',relationship:'順哥不再找你隨口聊方向，後續每次都先要求正式資料。酒櫃還在原位，原本能多問一句的空間先縮小了。',retort:'順哥回你，有疑問就拿具體問題出來，別每次都只剩口氣。你要條件，他要方案，雙方仍欠一份能往下談的資料。',support:'旁邊有人接著問付費者和交付內容，順哥終於把箭頭旁的空格補上。難聽的話沒有變好聽，真正的問題倒是被多人一起留下。'},
 hester:{ignored:'海姐把客戶紀錄推回來，先請你看原來的條件。她沒有接你的罵，這個案子也沒有因此自動改範圍。',relationship:'海姐改用正式窗口與你聯繫，原本能直接問的細節得再排一次會。你留下了不滿，兩邊卻多了一道往返。',retort:'海姐反問你要的是把案子講清楚，還是先把眼前的人罵一遍。客戶問題沒有少，現場又多了口氣需要解釋。',support:'同事打開原始客戶訊息，幫忙對上你問的範圍。海姐同意先核對，但也把剛才那句重話另外記住。'},
 simon:{ignored:'丁哥把設計稿轉回原頁，說要討論就指出實際哪一格。那句罵沒有替任何按鈕補出功能，也沒有替誰新增權限。',relationship:'丁哥不再口頭幫你看一眼，後續都要先交完整需求。全才副理仍是綽號，兩人能一起解問題的耐性卻少了一截。',retort:'丁哥當場回嗆，既然知道規格不能靠猜，為什麼說話又先把他當成問題。兩人都在要求被看見，稿子卻先被晾在旁邊。',support:'同事把實際操作步驟重跑一次，確認卡住的地方。丁哥拿筆標出修法，沒有讓誰的情緒替代今天的驗收。'},
 james:{ignored:'詹姆士說這次的條件可以重新核對，先不要替他把以前每一次都算進來。你罵完，工作仍等著同一份確認。',relationship:'詹姆士不再主動補你不知道的舊背景，往後只回答正式被問的部分。你少了一個熟悉系統的人願意順手多講兩句。',retort:'詹姆士反問，自己回來工作還得不斷替過去的進出答辯嗎。你的工作爭點還在，卻也得先把不必要的猜測收回來。',support:'同事拿出這次的工作與權限資料，請大家照當前版本確認。詹姆士補上缺的一段，沒有替任何人承諾下一次會待多久。'},
 johnny:{ignored:'強尼把排程留在眼前，請你先看真正衝突的那幾格。你的罵聲沒多出人手，事情仍需要有人決定先後。',relationship:'強尼不再替你口頭多擋一件交辦，後續全照表單走。你不用再猜他有沒有聽見，因為每一封回信都冷得很清楚。',retort:'強尼回你，他也被同一批臨時交辦追著跑，不是你拿來發洩的排程欄。你們差點把原本同一邊的工作壓力吵成彼此的錯。',support:'同事把重疊的工時標出來，讓強尼拿著完整影響回去問優先序。事情終於有了共同紀錄，剛才難聽的說法卻沒有被洗掉。'}
};
export function castVerbalReactionsV65(target){
 const p=CAST_PROFILES_V65[target];if(!p)return {};
 return {...reactions[target],personnel:`${p.name}要求把原話與工作安排分開留下，並找人事窗口確認後續。這句要求不等於你已經自願離職，接下來收到什麼正式通知仍得看清楚。`,legal:`${p.name}保留原話與在場經過，要求正式釐清。原本的工作爭點與說話方式分開處理，沒有誰只因職稱或音量就已經勝訴。`};
}
export function castVerbalVoiceV65(target,origin,phase){return {name:CAST_PROFILES_V65[target]?.name||'對方',...castVerbalReactionsV65(target)};}
export function withCastVerbalScenarioV65(event,run){
 const context=run?.verbalContext;if(!isCastV65(run)||!CAST_IDS_V65.includes(context?.target))return event;
 const voice=castVerbalReactionsV65(context.target);
 if(context.stage!=='release')return event;
 // The committed spoken line already has its own history/UI field. Returning
 // only the reaction avoids repeating the full insult in the outcome body.
 return {...event,choices:event.choices.map(choice=>({...choice,...(choice.draw?{draw:{...choice.draw,outcomes:choice.draw.outcomes.map(outcome=>voice[outcome.verbalKind]?{...outcome,result:voice[outcome.verbalKind]}:outcome)}}:{})}))};
}
