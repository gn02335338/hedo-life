// New lives get these three interludes. Published r60 and older lives are frozen.
export const isOfficeTreatsV61=value=>/^e39-r(?:6[12356789]|7[012345])-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
export const OFFICE_TREAT_IDS_V61=Object.freeze(['jack-drinks','company-tea','birthday-cake']);
const hash=value=>{let result=2166136261;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619)>>>0;return result;};
const windows={'jack-drinks':[2,16],'company-tea':[4,15],'birthday-cake':[6,18]};
const pick=(text,result,delta,affinityDelta,code,extra={})=>({text,result,delta,affinityDelta,code,effect:null,detail:'',flags:[],...extra});
const stories={
 'jack-drinks':[
  {speaker:'jack',title:'飲料邀約｜傑克說，今天他請。',body:'傑克拿著訂飲料的手機，走過來問你要不要一杯：「今天我請，先選自己想喝的，不用替我做一份效益報告。」強哥還沒說要不要，已經先問能加幾種料。這是傑克自己請客，不是公司又公布了一項會看心情消失的福利。',wing:'要喝嗎？不喝也沒關係，這次不用欠我一張工單。',choices:[
   pick('好，謝謝。讓我看一下菜單。','你接受了邀請，傑克把菜單傳來。強哥已經開始逐項詢問加料，價格欄還沒輪到他發言。',{mood:2},3,'drinks-invited'),
   pick('謝謝，我今天不喝。這杯先省下來。','你婉拒飲料，傑克說好，沒有請你換成一份加班。強哥仍在旁邊研究菜單，你沒有下單，也沒有被收費。',{mood:2,trust:1},1,'drinks-declined',{done:true,accepted:false}),
   pick('先替菜單開需求訪談：這次我要當會說清楚甜度的甲方。','傑克把菜單轉給你，說今天可以直接填甜度，不用先做三個方向。你接受了邀請，準備把這杯飲料訂成不用返工的版本。',{mood:3,slack:1},2,'drinks-wild-invited',{wild:true})
  ]},
  {speaker:'jack',title:'飲料下單｜強哥的助理薪水，主管級配料。',body:'強哥終於決定：「最大杯，奶蓋、珍珠、布丁、椰果都加。」店員確認價格，他補一句自己只是助理工程師，說得像配料也能申請職等保護。傑克看著那杯塞得像資料倉儲的飲料，還是說這杯算他的。輪到你了，可以選想喝的，也可以現在說不喝。',wing:'他那杯我看到了。你選自己的，不用比誰的杯子比較像火鍋。',choices:[
   pick('一杯無糖茶，照自己平常喝的。','你點了無糖茶，沒有跟著替杯子擴編。強哥的滿料大杯照單送出，傑克確認兩種訂單都由他付款。',{mood:4},3,'drinks-order-tea',{plan:'tea'}),
   pick('一杯少糖奶茶，今天喝點喜歡的。','你點了喜歡的奶茶。強哥又核對一次每一種配料，傑克替整張訂單結帳，沒有把加料費分攤到你的存款。',{mood:5},3,'drinks-order-milk',{plan:'milk'}),
   pick('看完菜單還是不喝，我拿自己的水就好。','你改成不喝，傑克把你的那杯從訂單刪掉。強哥的滿料大杯沒有跟著減配，費用仍由傑克自己支付。',{mood:2,trust:1},1,'drinks-order-none',{plan:'none'}),
   pick('送出飲料規格書：無糖、少冰、不要在杯蓋新增需求。','傑克照你的規格訂了一杯茶，沒有替杯蓋加待辦。強哥的大杯則完成了所有加料驗收，整張單依然由傑克支付。',{mood:4,skill:1},2,'drinks-order-spec',{plan:'spec',wild:true})
  ]},
  {speaker:'jack',title:'飲料收尾｜付錢的人，今天真的有出現。',body:'飲料送到，傑克確認自己的付款紀錄，再把杯子分好。強哥先數配料，說少一樣就不是原本的需求。你沒有被要求補差額；有點飲料就拿自己的那杯，選了不喝就留著水。這次請客沒有變成部門公積金，也沒有變成你的請款單。',wing:'都到了。慢慢喝，今天的感謝不用寄副本給老闆。',choices:[
   pick('當面謝謝傑克，喝自己的那杯，或照原本決定喝水。','你向傑克道謝，把自己的飲料或水放回桌邊。強哥的大杯終於通過配料清點。這次傑克請客到此結束，你回去處理剛才暫停的工作。',{mood:4,trust:2},4,'drinks-thanked'),
   pick('先問清楚：這杯不會明天變加班募資吧？我不想喝完才補工時。','傑克說不用拿加班抵，他只是想請飲料。你把那個確認收好，也把欠人情和欠工時分開；這輪請客結束，原本的工作照原進度接回。',{mood:3,skill:1},2,'drinks-boundary'),
   pick('替強哥的滿料杯建組織圖，請布丁兼任珍珠的代理主管。','傑克看著紙上的配料組織圖笑了。強哥提醒代理主管不能少給一份料，杯子還沒喝完，職等爭議已經準備開下一場。請客到此收尾，你把工作留回真正的待辦。',{mood:5,slack:1},3,'drinks-goose-chart',{wild:true})
  ]}
 ],
 'company-tea':[
  {speaker:'captain',title:'公司下午茶開始｜評價只有一點五顆星。',body:'船長已經替公司排好今天的下午茶外送，群組裡正等口味回覆。你打開店家的 Google Maps 頁面：1.5 顆星，評論比餐點介紹還長。船長說這家看起來包裝很高級，訂單也已經送出。這場是公司排定的，你可以不喝，其他人的訂單仍然會到。',wing:'先核對份數好了。評論那邊……我們等送到再看。',choices:[
   pick('把 1.5 星頁面和訂單一起留著，先確認外送進度。','你把評價頁和已送出的訂單放在一起。船長看到 1.5 星，安靜了一下，決定先追到貨時間，不拿大家的下午繼續試手氣。',{skill:1,mood:-1},2,'tea-rating-read'),
   pick('我今天不喝，先幫忙把大家的杯名核對好。','你表明自己不喝，仍幫船長核對訂單。1.5 星沒有因為少一杯就升級，但至少名單上哪些人要喝，現在已經寫清楚。',{trust:2,mood:1},3,'tea-order-checked'),
   pick('請玩具鵝當評價翻譯，把五顆星空位標成待改善事項。','船長看著玩具鵝旁那張 1.5 星截圖，問是不是連點心也要走改善計畫。笑完訂單還在路上，你們先把取餐名單列好。',{slack:1,mood:2},1,'tea-goose-review',{wild:true})
  ]},
  {speaker:'wing',title:'下午茶插曲｜有人拿錯一杯，所有人少一季。',body:'外送箱剛拆開，有人沒看杯名，拿走了翅膀那杯。不是你下的指令，也沒有證據說是你拿的；翅膀回來找不到飲料，先把整個制度一起罵了。他宣布以後公司下午茶取消。船長站在箱子旁邊，手上還拿著那張標好名字的名單。',wing:'連一杯飲料都弄不好，以後不要再辦下午茶了。',choices:[
   pick('先核對杯名與剩餘訂單，不指認沒證據的人。','你把杯名與剩下的份數對起來，只確認確實拿錯了一杯，不替空白的領用紀錄填人名。翅膀沒有收回取消通知，公司下午茶仍被取消；這次沒有把別人的失誤硬寫成你的錯。',{skill:1,mood:-4,boss:-4},-4,'tea-cup-check'),
   pick('一杯拿錯，就把整群人的福利砍掉，這他媽算哪門子管理？','你把單杯誤拿和全公司的下午茶分開說。翅膀嫌你頂嘴，仍堅持取消；船長至少聽到有人沒有順著把責任丟到她一個人身上。',{trust:3,mood:-3,boss:-6},-6,'tea-no-blame'),
   pick('替空杯辦失物招領，只登記杯名，不替犯人開腦補戶籍。','你替剩下的杯子排好名字，沒有替不在場的人定罪。翅膀叫你別演，取消通知照發；玩具鵝被你安排守住名單，至少這回沒有輪到牠替全公司背鍋。',{slack:1,mood:1,boss:-7},-7,'tea-goose-counter',{wild:true})
  ]},
  {speaker:'captain',title:'公司下午茶結束｜取消的是公司那份。',body:'船長收到停止安排公司下午茶的通知，開始確認今天剩下的份數與款項。公司排定的下午茶接下來不再安排；同事自己請客是另一回事，傑克的私人飲料邀約沒有一起被沒收。桌上這箱先分清楚，不能讓一杯誤拿再長成別人墊錢。',wing:'這次我把通知和訂單留著。剩下的先處理好，不要再少一筆。',choices:[
   pick('一起確認取消範圍、杯名和款項，不替沒證據的人貼標籤。','你與船長把取消範圍寫清楚，今天的杯子按名字分完，款項照原訂單確認，沒有請任何同事私下吸收。公司下午茶到此結束；原本暫停的工作接著處理。',{trust:4,mood:2},5,'tea-responsible-close'),
   pick('幫船長收好通知，不把承辦人當成整件事的垃圾桶。','你幫船長把通知與份數收齊，沒有替錯拿的那杯發明一位代罪承辦人。下午茶沒有恢復，這輪善後至少沒有再多犧牲一個同事；接著回到原本的工作。',{trust:3,mood:2},3,'tea-organizer-close'),
   pick('將公司下午茶封存為歷史名詞，保留私人請客的營業執照。','你替「公司下午茶」畫了封存章，另外留一行「私人請客不在本次取消範圍」。船長笑了一下，把剩下的杯子分完。這場到此收尾，玩具鵝不用接任下一屆點心委員會。',{slack:1,mood:3},2,'tea-goose-close',{wild:true})
  ]}
 ],
 'birthday-cake':[
  {speaker:'jack',title:'同月慶生開始｜三個壽星，一個切蛋糕的人。',body:'翅膀、水蛇和傑克同月生日。因為翅膀愛吃冰淇淋蛋糕，船長特別買了一顆高級的；包裝很漂亮，蛋糕卻還沒退冰。三個人先合照、一起象徵性切了一刀；翅膀和水蛇拍完回去忙，最後留下傑克獨自分整顆。傑克壓了半天，蛋糕沒動，手腕先痛到停下來。他把刀放回盤邊，甩了甩手：「照片是三人合照，工作照只有我。」合照裡三頂生日帽，現場卻只有一個人在替鏡頭以外的工作加班。',wing:'這不是冰淇淋蛋糕，是還在試用期的水泥。先讓我的手下班好不好？',choices:[
   pick('先請傑克放下刀休息，大家一起想安全的分法。','你請傑克先休息，把刀留在盤邊，不再硬壓。你說先放著退冰，別再硬切，順便把其他人的名字補回分工表。',{trust:2,mood:2},4,'cake-pause-help'),
   pick('先看退冰建議，這顆高級蛋糕不用趕在照片裡吃完。','你請大家先等，不再叫傑克用手腕追進度。合照已經存好，蛋糕不用跟著鏡頭倒數。',{skill:1,mood:2},3,'cake-pause-wait'),
   pick('合照三個壽星，切蛋糕只剩一個，是慶生還是招廉價廚工？請玩具鵝照合照點名。','玩具鵝站到排班表旁邊，三個名字都在，刀卻先留在盤邊。傑克說至少這次名單沒有只剩他，你們先停下來處理退冰。',{slack:1,mood:3},3,'cake-pause-goose',{wild:true})
  ]},
  {speaker:'jack',title:'慶生進行中｜退冰不用算成傑克的績效。',body:'蛋糕仍硬，傑克已經不再硬切。先放著退冰，別再硬切；他把生日帽轉向旁邊，指著剛才合照的位子：「剛剛大家都很會切第一刀，第二刀怎麼只剩我有資格？」你們重新安排人手，這次不用再替鏡頭分工。',wing:'我可以分蛋糕，不用負責把冰山切成十二個部門。',choices:[
   pick('幫忙顧著退冰，能分時再一起分。','你和船長先讓蛋糕退冰，能分時再與傑克一起動手。他說生日願望本來很大，現在縮成有人幫忙拿盤子；這次至少真的有人接住。',{skill:1,trust:2,mood:2},5,'cake-plan-help',{plan:'help'}),
   pick('主動等到適合分切再領，不催傑克現在交付。','你請大家等一等，不要求傑克立刻交出每人一份。他把刀放下，說原來蛋糕也能延期，只有他的工作剛才沒有這個選項。',{trust:2,mood:3},3,'cake-plan-wait',{plan:'wait'}),
   pick('請玩具鵝主持退冰中場休息，真人輪班看說明。','玩具鵝站到蛋糕盒旁宣布中場休息，傑克把手放下來，問能不能連切蛋糕也外包給牠。你替牠領一張主持證，沒有領切工證，大家一起等蛋糕軟一點。',{slack:1,mood:4},4,'cake-plan-goose',{plan:'goose',wild:true})
  ]},
  {speaker:'jack',title:'同月慶生結束｜最後分的是蛋糕，不是傑克的手腕。',body:'蛋糕終於能分切，這回大家一起把它切好。傑克不用再獨自對付整顆，盤子和剩餘蛋糕也各有人收。翅膀、水蛇、傑克的合照還在群組裡，這次的收尾總算不只剩一位壽星。',wing:'照片可以三個人，善後也可以。今天終於有人證明了。',choices:[
   pick('幫忙把份數與保存安排好，讓壽星也坐下來吃。','你幫忙把份數分好，剩下的收妥。傑克終於拿自己的那一片坐下，不再一邊過生日一邊接整顆蛋糕的專案。這場慶生結束，接著回到原本的工作。',{trust:3,mood:3},4,'cake-close-share'),
   pick('把工具和桌面一起收好，這次不只負責合照。','你和同事一起收好工具與桌面，沒有把善後自動留給傑克。蛋糕分完，人也能各自回座位；同月慶生到此結束，工作照原進度繼續。',{skill:1,trust:2,mood:3},3,'cake-close-clean'),
   pick('請玩具鵝存檔這次慶生紀錄，附件加上真正的分工。','玩具鵝的會議紀錄只有一條：「合照三人，分工多人。」你們把剩餘蛋糕收好，傑克拿著自己的盤子離開產線。這場慶生正式收尾。',{slack:1,mood:4},4,'cake-close-goose',{wild:true})
  ]}
 ]
};
function current(run){const c=run?.treatsContext;if(!isOfficeTreatsV61(run)||!c||c.version!==1||!OFFICE_TREAT_IDS_V61.includes(c.id)||!Number.isInteger(c.stage)||c.stage<0||c.stage>2||typeof c.returnEventId!=='string')throw new Error('Invalid office treat context');return c;}
export function createOfficeTreatContextV61(id,returnEventId){if(!OFFICE_TREAT_IDS_V61.includes(id)||typeof returnEventId!=='string')throw new Error('Invalid office treat start');return {version:1,id,stage:0,returnEventId,plan:''};}
export function dueOfficeTreatV61(run){
 if(!isOfficeTreatsV61(run)||!Number.isInteger(run.turn)||run.turn<2||run.turn>18||!run.flags||!run.stats)return null;
 if(Number.isInteger(run.flags.treats61_last_turn)&&run.turn+1-run.flags.treats61_last_turn<2)return null;
 const pool=OFFICE_TREAT_IDS_V61.filter(id=>!run.flags[`treats61_seen_${id}`]&&run.turn>=windows[id][0]&&run.turn<=windows[id][1]&&!(id==='company-tea'&&(run.flags.treats61_company_tea_cancelled||run.eventId==='ceo-tea-drop')));
 if(!pool.length||hash(`${run.seed}:${run.turn}:office-treat`)/4294967296>=.23)return null;
 return pool[hash(`${run.seed}:${run.turn}:treat-kind`)%pool.length];
}
export function officeTreatDailyAllowedV61(run,event){return !isOfficeTreatsV61(run)||event?.id!=='quiz26-tea-reserved'&&!(run.flags?.treats61_company_tea_cancelled&&event?.id==='ceo-tea-drop');}
export function getOfficeTreatEventV61(run){
 const c=current(run),copy=stories[c.id][c.stage];return {id:`treats61-${c.id}-${c.stage}`,kind:'office-treat',era:c.stage===0?'辦公室點心・開始':c.stage===2?'辦公室點心・最後一幕':'辦公室點心・進行中',speaker:copy.speaker,title:copy.title,body:copy.body,wing:copy.wing,scope:'work',scene:c.id==='birthday-cake'?'banquet':'admin_coffee',sourceIds:['characterFiction'],illustrationPeople:c.id==='birthday-cake'&&c.stage===0?['wing','meimei','jack']:c.id==='jack-drinks'?['jack','jonathan']:c.id==='company-tea'&&c.stage===1?['captain','wing']:c.id==='birthday-cake'?['jack','captain']:['captain'],participants:c.id==='jack-drinks'?['jack','jonathan']:c.id==='birthday-cake'?['jack','captain']:c.stage===1?['wing','captain']:['captain'],officeTreat:{id:c.id,stage:c.stage,total:3},choices:copy.choices.map(choice=>({...choice}))};
}
export function resolveOfficeTreatChoiceV61(run,index,ticket=.5){
 if(!Number.isFinite(ticket)||ticket<0||ticket>=1)throw new Error('Invalid office treat luck');
 const c=current(run),copy=stories[c.id][c.stage],choice=copy.choices[index];if(!Number.isInteger(index)||!choice)throw new Error('Unavailable office treat choice');
 const accepted=choice.accepted!==false,done=choice.done===true||c.stage===2,plan=choice.plan||c.plan;
 const result=c.stage===2&&c.id==='jack-drinks'?`drinks-delivered-${plan}`:c.stage===2&&c.id==='birthday-cake'?`cake-shared-${plan}`:choice.code;
 return {choiceText:choice.text,result:choice.result,delta:{...choice.delta},luckDelta:{mood:Math.floor(ticket*3)-1},label:done?'這場點心事件已結束':c.stage===0&&c.id==='jack-drinks'?'飲料邀約已回覆':'這一幕已結算',plan,done,cancelCompanyTea:c.id==='company-tea'&&c.stage===0,outcome:{version:1,id:c.id,stage:c.stage,target:copy.speaker,affinityDelta:choice.affinityDelta,accepted,done,result}};
}
export function isOfficeTreatOutcomeV61(run,row){
 const o=row?.treatsOutcome;
 if(!isOfficeTreatsV61(run)||!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).sort().join(',')!=='accepted,affinityDelta,done,id,result,stage,target,version'||o.version!==1||!OFFICE_TREAT_IDS_V61.includes(o.id)||!Number.isInteger(o.stage)||o.stage<0||o.stage>2||row.eventId!==`treats61-${o.id}-${o.stage}`||row.kind!=='office-treat'||!Number.isInteger(row.choiceIndex)||row.verbalOutcome!==undefined||row.recruitmentOutcome!==undefined)return false;
 const copy=stories[o.id][o.stage],choice=copy.choices[row.choiceIndex];if(!choice||o.target!==copy.speaker||row.speaker!==copy.speaker||o.affinityDelta!==choice.affinityDelta||o.accepted!==(choice.accepted!==false)||o.done!==(choice.done===true||o.stage===2))return false;
 if(o.stage!==2)return o.result===choice.code;
 if(o.id==='company-tea')return o.result===choice.code;
 const prior=(run.history||[]).slice(0,(run.history||[]).indexOf(row)).findLast(item=>item?.kind==='office-treat'&&item.eventId===`treats61-${o.id}-1`),p=stories[o.id][1].choices[prior?.choiceIndex]?.plan;
 return !!p&&o.result===(o.id==='jack-drinks'?`drinks-delivered-${p}`:`cake-shared-${p}`);
}
export function officeTreatPhaseV61(run,event){
 if(!run?.treatsContext||!isOfficeTreatsV61(run)||event?.id!==`treats61-${run.treatsContext.id}-${run.treatsContext.stage}`)return null;
 const c=run.treatsContext,last=run.history?.at(-1),done=run.pending&&last?.eventId===event.id&&last.treatsOutcome?.done===true;
 return {id:c.id,stage:c.stage,total:3,phase:done?'end':c.stage===0?'start':'progress',label:done?'這場點心事件已結束':c.stage===0?'辦公室點心事件開始':'辦公室點心事件進行中',nextLabel:done?'回到原本的工作':'繼續這場點心事件'};
}
