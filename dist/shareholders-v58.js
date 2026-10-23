// A new seed cohort owns this interlude. Historical replays never enter it.
import {isRecruitmentV60} from './seed-profile-v60.js';
export const isShareholderV58=run=>isRecruitmentV60(run)||/^e39-cal46-kin49-g-e-s-m-h-[a-f0-9]{6}$/.test(typeof run==='string'?run:run?.seed||'');
export const SHAREHOLDER_CAST_V58=Object.freeze(['wing','spencer','erich','jenjen','janet','sonny']);
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;};
const option=(text,available=true)=>({text,available,result:'',delta:{}});
const initialEvidence=['receipt','notice','risk'];
const EVIDENCE=Object.freeze({
 receipt:{title:'認股收據',body:'你已支付認股款；收據列有姓名、日期與股數。付款是真的，不代表公司已經上市。'},
 notice:{title:'股東會通知',body:'通知列有時間、地點，並請持股者攜帶身分與持股證明。沒有寫「必須先由行政核准發問」。'},
 risk:{title:'認股風險附件',body:'股份尚未公開交易，上市時程未定，也沒有保證買回條款。那頁小字沒有跟著簡報一起放大。'},
 investment:{title:'投資意向進度表',body:'簡報提到的兩家企業，在進度表中均為「意向洽談，待審查與撥款」，沒有已入帳金額。'},
 receivables:{title:'應收帳款帳齡表',body:'本期營收含尚未收回的應收款。帳齡表列有逾期項目；期末現金餘額與應收總額分列。'},
 roster:{title:'報到名冊影本',body:'名冊已記下你的持股與報到時間。行政補填表單是聯絡資料，通知上並未把它列成出席資格。'},
 minutes:{title:'議事紀錄草稿',body:'草稿把「詢問上市時程」寫成「全體同意公司不必再說明」。你尚未同意這段摘要。'}
});
const ROUNDS=Object.freeze([
 {speaker:'wing',title:'第一輪｜大企業入股，到底入了哪裡？',roundLabel:'投資說法',body:'翅膀把簡報停在一排企業標誌。屎潘蛇在旁邊點頭，傑克翻開筆記，先替自己那張認股收據嘆了一口氣。',wing:'大企業都來了，你們還在問這些細節，是不是格局太小？',
  statements:['兩家企業都表達投資意向，所以資金已經到位。','認股款收到了，公司的願景也一起向前。','上市不是我一個人說了算，你們先相信專業。'],
  press:['你追問是意向、簽約還是撥款。翅膀說「不要摳字眼」，法師卻把投資意向進度表推到桌邊。上面兩欄都還沒填入帳金額。','傑克把自己的收據攤開：「我的款是真的出去，公司的款有沒有進來，是另一欄。」屎潘蛇請大家先按議程。','你問上市需要哪些條件，翅膀答「團隊要有信心」。傑克低聲說，信心目前沒有證券代號。'],
  clues:{0:'investment'},target:0,proof:'investment',hint:'先把「有意願」跟「有匯款」分成兩句。',success:'你把進度表放到「資金已到位」旁邊。翅膀改口說那是合作方向，屎潘蛇請紀錄註明目前仍在洽談。願景第一次被迫加上狀態欄。'},
 {speaker:'janet',title:'第二輪｜帳上很好看，錢在哪裡？',roundLabel:'帳務核對',body:'Janet 接手財務說明，螢幕上的營收線往上，傑克的嘴角往下。你手上的報表只有總數，還缺那張大家不太想翻的附件。',wing:'報表都有寫。不要把個人的焦慮變成公司的問題。',
  statements:['營收增加，代表同樣多的現金已經可以自由運用。','尚未收回的款項列在應收帳款，附件另外有帳齡。','認股款怎麼使用，照核定預算執行。'],
  press:['你問營收與現金是不是同一欄。Janet 說「做帳不是聊天」，傑克便把問題抄成兩欄，請她各填一個數字。','你請她打開帳齡附件。逾期項目和期末現金分開列出，Janet 提醒你不要只截對自己有利的半頁。','你要求用途明細，她答覆還要彙整。阿福看了一眼投影機，解釋剛才附件沒開是轉接頭挑人。'],
  clues:{1:'receivables'},target:0,proof:'receivables',hint:'營收、應收、現金，三個名字都帶錢，卻不住同一個抽屜。',success:'帳齡表被你放在營收線旁邊。Janet 承認部分仍未收款，補充說明將另列現金與應收。傑克在筆記寫下：今天至少沒有把同一筆錢花兩次。'},
 {speaker:'jenjen',title:'第三輪｜進得了會場，能不能開口？',roundLabel:'出席與發言',body:'真真說下一題前先補行政資料，阿福把麥克風收遠了一點。傑克把你的通知壓在桌上，避免它跟著發言權一起被收走。',wing:'大家都很忙。沒有先完成行政確認，今天就先聽，不要發問。',
  statements:['補聯絡資料可以會後處理。','你沒先取得行政同意，所以今天沒有出席資格。','阿福說麥克風可能會沒電，先不要一直拿。'],
  press:['真真說資料是為了後續寄送；你請她在紙上區分「聯絡用途」與「股東資格」。她把報到名冊影本拿了過來。','你請真真指出哪一份通知有這條規定。她翻回名冊，確認你已完成持股核對與報到。阿福補一句：「剛剛麥克風不是我關的。」','你看著亮著的電量，提議先講完一句再換電池。阿福說那顆顯示不一定準，移動的迷宮這次改成音控版。'],
  clues:{0:'roster',1:'roster'},target:1,proof:'roster',hint:'先核對自己有沒有完成報到，再處理那張突然長出來的門票。',success:'報到名冊與「沒有出席資格」被放在同一張桌上。真真把說法改成會後補聯絡資料，阿福終於把麥克風推回來。你沒有提高音量，只是不再讓問題被音控。'},
 {speaker:'erich',title:'第四輪｜你問了問題，不等於你同意答案。',roundLabel:'紀錄攻防',body:'法師開始宣讀議事摘要，屎潘蛇看了一眼時間。傑克指著草稿某一行，筆尖停得比他的股票還久。',wing:'沒有其他意見的話，就照這份紀錄。請大家給公司一點空間。',
  statements:['未定的上市時程，會後另提供進度說明。','今天提出的問題應依原意記錄，會後再核對。','你剛才詢問上市時程，代表你同意公司不必再說明。'],
  press:['你問回覆日期，法師說要先跟承辦確認。屎潘蛇提議列一張待辦，不要把待辦講成承諾已經完成。','你要求先看摘要。法師把議事紀錄草稿遞過來，傑克圈出那句自己從來沒有同意過的話。','你請法師重念前半句，再重念結論。傑克把草稿轉向你：「這跳接，比我的上市日期還會跑。」'],
  clues:{1:'minutes',2:'minutes'},target:2,proof:'minutes',hint:'最後別只聽誰說了算，看看紙上替你同意了什麼。',success:'你指出草稿把提問寫成同意。法師刪去那行，將原問題與待回覆項目分開記載。屎潘蛇宣布本輪到此，傑克終於把筆從圈圈改成句號。'}
]);
const context=run=>{const c=run?.shareholderContext;if(!isShareholderV58(run)||!c||c.version!==1||!['offer','gate','hearing','finish'].includes(c.stage))throw new Error('Invalid shareholder context');return c;};
export function shareholderDueV58(run){
 if(!isShareholderV58(run)||run.flags?.shareholder58_meeting_seen)return null;
 if(!run.flags?.shareholder58_offer_seen){const due=3+hash(`${run.seed}:stock-offer`)%3;return run.turn>=due&&run.turn<=8&&run.stats.cash>=44?'offer':null;}
 if(run.flags.shareholder58_owned){const due=Math.max(6,run.flags.shareholder58_purchase_turn+2+hash(`${run.seed}:shareholder-meeting`)%3);return run.turn>=due&&run.turn<=15?'gate':null;}
 return null;
}
export function getShareholderStatusV58(run){
 if(!isShareholderV58(run)||!run.flags?.shareholder58_owned)return null;
 const declined=run.flags?.shareholder58_meeting_seen&&(!run.shareholderContext||run.shareholderContext.stage==='gate'&&run.pending&&run.shareholderContext.pendingStep?.next==='return');
 return {version:1,label:run.flags?.shareholder58_attended?'已親自出席股東會':declined?'已認股，這次未親自出席':run.shareholderContext?.stage==='gate'?'收到股東會通知，正在確認出席':'已認股，等候股東會安排',offered:!!run.flags?.shareholder58_offer_seen,paid:run.flags?.shareholder58_owned||0,qualified:!!run.flags?.shareholder58_owned,attended:!!run.flags?.shareholder58_attended,finished:!!run.flags?.shareholder58_finished,result:run.flags?.shareholder58_result||null};
}
export function getShareholderEventV58(run){
 const c=context(run),common={kind:'shareholder',era:'員工認股・股東會支線',scope:'work',scene:'office_day',sourceIds:['characterFiction'],cast:[...SHAREHOLDER_CAST_V58,'jack']};
 if(c.stage==='offer')return {...common,scene:'company_market',id:'shareholder58-offer',speaker:'wing',title:'大企業都入股了，就差你的生活費。',body:'翅膀突然宣布員工認股：「某幾家大企業都入股了，這種大好機會，不是每個人都有。」簡報把機會放到最大，把尚未上市、資金不易取回的附件放在最後。傑克在旁邊摸著自己的收據：「我已經認太多了。早知道拿去買正2，現在就財富自由了。」他把收據摺回口袋，說這次至少要把文件看完。',wing:'要好命就要把握機會。現在認股，以後才有位置坐。',choices:[option('認購一份。投入 35 存款指數，先看完風險附件再簽。',run.stats.cash>=44),option('認購加碼份。投入 50 存款指數，收據、股數都留一份。',run.stats.cash>=59),option('先不認股。生活費要能領回，願景先留在簡報裡。'),option('提議把願景拿去質押；銀行肯收，我再考慮。')]};
 if(c.stage==='gate')return {...common,scene:'hallway_gate',id:'shareholder58-gate',speaker:'jenjen',title:'你有股票，真真說你可以不用來。',body:'股東會通知到了。你帶著認股收據到門口，真真笑著說場地座位不多，「你們手上還有工作，我幫你帶委託書、代投票就好，不一定要本人來。」傑克站在你旁邊：「我的錢都坐裡面了，人還只能站外面？」門後有翅膀、屎潘蛇、法師、Janet 與阿福；能不能進去，現在等你表態。',wing:'位子不多。我幫你帶委託書、代投票，你回去忙吧。',choices:[option('那就麻煩你，我先回工作。'),option('我已認股，也收到通知。請核對資格，我要親自出席。'),option('把收據當通行證舉起來：錢能進門，付錢的人也要進門。')]};
 if(c.stage==='finish'){
  const summaries={minutes:['股東會結束｜願景終於附了待辦。','四輪問題都留下可核對的紀錄。錢沒有當場回來，上市也沒有突然成功，但「之後再說」終於被拆成誰回覆、回覆什麼。傑克收好影本：「早知道拿去買正2……算了，今天至少拿回四個句號。」'],followup:['股東會結束｜還有問題，這次有編號。','你守住幾項問題，也讓幾個說法沒有混過去。部分回覆仍待補件，傑克替它們編了號，避免下次又以全新願景重新介紹。股份仍未能變現，工作也還得繼續。'],adjourned:['股東會結束｜你坐進來了，答案還在外面。','你留在會場到散會，幾輪說明卻沒被追成能核對的答案。傑克沒有怪你，只把通知和收據疊好：「我現在最會的投資，是投入時間等。」散會餐敘說是「隨便點」，送到桌上的卻只有套餐。傑克看了一眼菜單：「原來選擇權也沒上市。」這場到此結束，你們回到原本的工作。'],ejected:['股東會結束｜發言先被請去冷靜。','連續幾次拿錯資料，會場開始只記得你的推論。屎潘蛇請你停止本輪發言，傑克陪你收好文件離場：「下次先對頁碼，再對幹。」這是股東會的失利，不是離職通知；持股和工作都還在。']};
  const [title,body]=summaries[c.result]||summaries.adjourned;return {...common,scene:'meeting',id:'shareholder58-finish',speaker:'jack',title,body,wing:'我認太多了。早知道……好，先回去上班。',choices:[option('收好這次紀錄，回去處理原本的工作。')]};
 }
 const round=ROUNDS[c.round];return {...common,scene:'meeting',id:`shareholder58-hearing-${c.round}`,kind:'shareholder-hearing',era:`股東大會進行中・第 ${c.round+1}／4 輪`,title:round.title,body:round.body,speaker:round.speaker,wing:round.wing,choices:[]};
}
export function getShareholderPlayV58(run){
 if(!run?.shareholderContext||!isShareholderV58(run)||run.pending||run.completed||run.shareholderContext.stage!=='hearing'||run.eventId!==`shareholder58-hearing-${run.shareholderContext.round}`)return null;
 const c=context(run),r=ROUNDS[c.round];if(!r)throw new Error('Invalid shareholder round');
 return {version:1,eventId:`shareholder58-hearing-${c.round}`,round:c.round,roundLabel:r.roundLabel,title:r.title,speaker:r.speaker,wing:r.wing,statements:r.statements.map((text,id)=>({id,text,pressed:c.pressed.includes(id)})),evidence:c.evidence.map(id=>({id,...EVIDENCE[id]})),credibility:c.credibility,pressure:c.pressure,jackHint:r.hint,feedback:c.feedback||null};
}
export function deriveShareholderPlayV58(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='evidence,mode,statement'||!['press','present','yield'].includes(input.mode)||!Number.isInteger(input.statement)||input.statement<0||input.statement>2||!(input.evidence===null||typeof input.evidence==='string'&&Object.hasOwn(EVIDENCE,input.evidence)))throw new Error('Invalid shareholder play input');
 if(input.mode!=='present'&&input.evidence!==null||input.mode==='present'&&input.evidence===null||input.mode==='yield'&&input.statement!==0)throw new Error('Invalid shareholder play input');
 return {...input};
}
export function createShareholderContextV58(stage,returnEventId){return {version:1,stage,returnEventId,round:0,pressed:[],evidence:[...initialEvidence],credibility:3,pressure:0,wins:0,feedback:null};}
export function resolveShareholderChoiceV58(run,index){
 const c=context(run),event=getShareholderEventV58(run);if(!Number.isInteger(index)||!event.choices[index]||event.choices[index].available===false)throw new Error('Unavailable shareholder choice');
 if(c.stage==='offer')return index<2?{label:'認股款已支付',result:`你逐頁看過附件，付出 ${index===0?35:50} 存款指數，拿到收據與持股紀錄。傑克提醒你保管好，別把認股當成隨時能領回的定存。股東會還沒開始，出席通知要等之後。`,cost:index===0?35:50,next:'return',purchase:true}:{label:'這次沒有認股',result:index===2?'你把生活費留在自己帳上。翅膀說機會不等人，你回答帳單也一樣。沒有認股，就沒有這次股東會的出席支線。':'你問銀行肯不肯收願景。翅膀說你太計較，傑克卻小聲問，如果真的能質押，能不能順便替他的那份問一下。你沒有付款，也沒有取得出席資格。',next:'return'};
 if(c.stage==='gate')return index===0?{label:'你接受了勸退',result:'你把資料交給真真，沒有走進會場。傑克停了一下，說自己還是想進去問。這次股東會沒有你的席位紀錄，認購的股票仍然留在名下。',next:'return'}:{label:'股東大會開始',result:index===1?'你把通知與收據放在桌上，請真真核對，不接受代為出席。傑克跟著補一句「我也親自來」。真真確認後帶你們入場，翅膀、屎潘蛇、法師、Janet、阿福都已就座，四輪問題從投資說法開始。':'你舉起收據，沒有把出席當成拜託。真真讓你放低紙張，確認資格後帶你與傑克入座。翅膀看了一眼那張收據，說既然來了，就照議程。股東大會正式開始。',next:'hearing'};
 if(c.stage==='finish')return {label:'這場股東會已結束',result:'你和傑克把資料各自收好，回到原本的工作。持股仍在，這場沒有多算一個工作日，也沒有替你決定離職。',next:'return',finished:true};
 throw new Error('Shareholder play input required');
}
export function resolveShareholderPlayV58(run,input){
 const p=deriveShareholderPlayV58(input),c=context(run);if(c.stage!=='hearing')throw new Error('Unavailable shareholder play');
 const r=ROUNDS[c.round];if(!r)throw new Error('Invalid shareholder round');
 if(p.mode==='press'){
  if(c.pressed.includes(p.statement))throw new Error('Statement already pressed');
  return {label:'追問這句證詞',choiceText:`追問：「${r.statements[p.statement]}」`,result:r.press[p.statement],advance:false,clue:r.clues[p.statement]||null,pressed:p.statement,credibility:c.credibility,pressure:c.pressure,wins:c.wins};
 }
 if(p.mode==='yield')return {label:'這一輪先保留問題',choiceText:'這輪先不舉證，把問題記下來。',result:'你沒有為了搶最後一句話亂丟證據，先把疑問留在筆記。對方接著往下講，傑克替這題畫一個待辦框；會場的節奏仍被主席帶著走。',advance:true,credibility:c.credibility,pressure:Math.min(4,c.pressure+1),wins:c.wins};
 if(!c.evidence.includes(p.evidence))throw new Error('Evidence not acquired');
 const correct=p.statement===r.target&&p.evidence===r.proof;
 return correct?{label:'異議成立｜說法與附件對不上',choiceText:`對「${r.statements[p.statement]}」出示《${EVIDENCE[p.evidence].title}》。`,result:r.success,advance:true,credibility:c.credibility,pressure:Math.max(0,c.pressure-1),wins:c.wins+1}:{label:'異議沒有對上這一句',choiceText:`對「${r.statements[p.statement]}」出示《${EVIDENCE[p.evidence].title}》。`,result:`法師把《${EVIDENCE[p.evidence].title}》推回來：「這份資料沒有直接推翻你指的那一句。」翅膀準備接話，傑克先壓低聲音：「別急著喊異議，先對句子跟頁碼。」這次舉證失去一格可信度。`,advance:false,credibility:c.credibility-1,pressure:Math.min(4,c.pressure+1),wins:c.wins};
}
export function shareholderResultV58(c){return c.credibility<=0?'ejected':c.wins===4?'minutes':c.wins>=2?'followup':'adjourned';}

export const validateShareholderInputV58=deriveShareholderPlayV58;
