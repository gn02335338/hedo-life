// Original office satire, informed by the player's supplied joke. No private
// chronicle text, real salary record or identity belongs in the public game.
import {careerLevels} from './career-api.js';
import {EVENTS,FANTASY_EVENTS} from './events.js';
export const RAISE_EVENTS=Object.freeze(['raise-request','raise-response','raise-confirmation']);
export const workCount=run=>(run?.history||[]).filter(item=>['daily','fantasy'].includes(item.kind)&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0).length;
export const raisePayCeiling=run=>Math.min(500,Math.floor(300*careerLevels(run)[run.rank].payMultiplier));
export function raiseAvailability(run){
 const no=reason=>({allowed:false,reason});
 if(run&&/^e20-/.test(run.seed||'')&&run.flags.floor_watch)return no('三樓待命期間，先處理調動安排。');
 if(!run||!/^e(?:19|20)-/.test(run.seed||''))return no('談加薪從新人生開啟，這局保留原本規則。');
 if(run.completed)return no('這段人生已結束，薪水留給下一間公司談。');
 if(run.pending)return no('先看完眼前的結果，再開下一場談話。');
 if(run.raiseContext)return no('先把這次薪資談判談完。');
 if(run.rageContext||run.meltdownReturnEventId)return no('先處理眼前的失控與後續。');
 if(run.pip?.active)return no('改善計畫還沒結束，先把這段流程走完。');
 if(run.salaryCut?.status==='pending')return no('先確認目前的降薪方案，再談新的薪資。');
 if(run.resumeEventId||run.exitReturnEventId||run.breakReturnEventId||run.banquetReturnEventId)return no('先完成目前通知，再回工作證約談。');
 const ids=run.eventId;
 if(!ids||![...EVENTS,...FANTASY_EVENTS].some(event=>event.id===ids))return no('回到一般工作事件時，才能另外約談。');
 if(workCount(run)<3)return no('先完成三個工作回合，帶著實際交付再談。');
 if((run.flags.raise_attempts||0)>=3)return no('這局已正式談過三次薪資，先把力氣留給其他打算。');
 const elapsed=workCount(run)-(run.flags.raise_last_work||0);
 if(run.flags.raise_attempts&&elapsed<5)return no(`上次談薪後，再完成 ${5-elapsed} 個工作回合才能重談。`);
 if(run.pay>=raisePayCeiling(run))return no('目前薪資已到這個職級的遊戲上限，先把這張薪資單收好。');
 return {allowed:true,reason:'另外約一場薪資談話；不占升遷評核，也不額外推進工作日。'};
}
const c=(text,result,delta={},effect='raiseClose',flags=[])=>({text,detail:'',result,delta,effect,flags});
const out=(weight,label,result,delta,effect,flags=[])=>({weight,label,result,delta,effect,flags});
const drawn=(text,outcomes)=>({...c(text,''),draw:{label:'談薪的走向',outcomes}});
const scene=(id,title,body,wing,choices,speaker='wing')=>({id,title,body,wing,choices,speaker,kind:'career',era:'薪資談判・原創改編',sourceIds:['careerFiction']});
const approved='翅膀盯著你列的數字看了一會，終於叫希望把方案寄來。你沒有先慶祝，口頭上的「可以」，還得走到薪資單上才算數。';
const promise='他說下個季度一起看，接著開始講公司明年的願景。你問是哪一天，他又把「一起」講了一次；薪資欄還沒變，承諾先換了一種時態。';
const fury='翅膀把筆放下，聲音突然大了起來：「朕不給你的，你不能搶。」你帶來的是績效表，談到這裡，卻像在御書房犯上。';
const signed='希望寄來確認信，月薪、生效日與其他給付分開列好了。你逐項核對，這次拿到的是新的薪資數字，不是下一季再談的資格。';

function proposal(run){
 const s=run.stats;
 const chance=(base,ability)=>Math.max(8,Math.min(43,Math.round(base+ability*.16+s.boss*.15)));
 const weights=[chance(4,s.skill),chance(-1,s.lick),chance(-13,(s.skill+s.lick)/2)];
 const angry=Math.max(20,Math.min(65,Math.round(58-s.boss*.4+(run.pay>100?7:0))));
 const option=(text,index)=>drawn(text,[
  out(weights[index],'先提出書面方案',approved,{mood:5,energy:-3,boss:index===1?3:-2},'raiseOffer'),
  out(Math.max(8,100-weights[index]-Math.min(angry+(index===2?10:0),70)),'下個季度再說',promise,{mood:-9,energy:-3},'raisePromise'),
  out(Math.min(angry+(index===2?10:0),70),'你說調薪，他聽成奪權',fury,{boss:-26,mood:-19,energy:-5},'raiseFury',['raise_fury'])
 ]);
 return scene('raise-request','我想談的是薪水，怎麼變成忠誠度？',
  `你把最近的交付、接手的工作和原本談好的職責排在同一頁，約翅膀聊十分鐘。目前遊戲月薪是 ${run.pay}K，職稱是${run.history.at(-1)?.jobTitle||'現在這個職位'}。你還沒提要換名片，只想知道做完這些事，薪水能不能重新談。`,
  '「公司有公司的安排。你先說，你覺得自己值得多少？」',[
   option('把交付與新增職責攤開，提出調薪要求。',0),
   option('先把他的方向整理成成果，再談自己的薪資。',1),
   option('帶一張玉璽印泥墊，請他御批本季薪資。',2),
   c('資料先收好，這次還不正式開口。','你把資料帶回去，沒有留下新的薪資承諾，也沒有把這次算成正式談判。',{},'raiseCancel')
  ]);
}
function offerChoices(){return [
 drawn('請把月薪、生效日與年終條件分開寫清楚。',[
  out(80,'條件寫進確認信',signed,{mood:14,trust:4,boss:-2},'raiseGrant',['raise_written']),
  out(20,'加薪先從別處搬過來','希望補了一份說明：月薪數字可以調，其他給付要一起重算。你把兩張紙放在一起，發現「加」字好像只出現在信件標題。',{mood:-10,boss:-3},'raiseOffset',['raise_offset_seen'])
 ]),
 drawn('先答應新數字，其他細項晚點再問。',[
  out(35,'真的照新數字走',signed,{mood:12,boss:2},'raiseGrant',['raise_written']),
  out(65,'整包待遇沒有一起長大','你先答應了新月薪，希望才補上其他給付的調整表。數字確實多了一格，整包待遇卻像在玩蹺蹺板。你決定再看清楚，還沒正式接受。',{mood:-13,boss:-2},'raiseOffset',['raise_offset_seen'])
 ]),
 c('條件還不清楚，這次先不要簽。','你把未確認的欄位列回信裡，這次沒有改薪水。至少沒有讓一個「先這樣」替你答應後面的空白。',{mood:3,trust:3},'raiseClose',['raise_offer_declined'])
];}
function furyChoices(){return [
 c('我談的是工作報酬。請把不能調整的理由寫下來。','你把音量留給他，把問題留在紙上。他沒有加薪，你也沒有替「不能搶」簽一張認同書；談話紀錄帶回了自己的資料夾。',{boss:-7,mood:-8,trust:5},'raiseClose',['evidence','archive','raise_refused']),
 c('先停在這裡，等雙方能好好談時再說。','你沒有把這句話接成另一場吵架。薪水沒變，今天也不再多演一場感謝栽培；你把自己的話留在寄出的會議摘要裡。',{boss:2,mood:-5},'raiseClose',['evidence','raise_refused']),
 c('把薪資表收進證物袋：原來預算還得先過登基。','他說你態度有問題。你看著沒有變動的薪資欄，忽然很想知道「態度」究竟是哪一個會計科目。會議散場後，今天的氣氛還沒散。',{boss:-20,mood:4,trust:5},'raiseClose',['evidence','raise_refused'])
];}
export function getRaiseEvent(run){
 const context=run.raiseContext;if(!context)throw new Error('Missing raise conversation');
 if(run.eventId==='raise-request')return proposal(run);
 const offer=`${context.fromPay}K → ${context.offerPay}K`,outcome=context.view||context.outcome;
 if(run.eventId==='raise-response'){
  if(outcome==='offer')return scene('raise-response','數字寫下來之前，都先別鼓掌。',`希望轉達翅膀的方案，提出的遊戲月薪方案是 ${offer}。附件裡還有一句「其他給付一併檢視」。你把滑鼠停在回覆鈕上，想先確認這次究竟調了什麼。`,'「這是提出的方案，還要確認最後的書面條件。」',offerChoices(),'hope');
  if(outcome==='promise')return scene('raise-response','「下個季度」有日期嗎？','翅膀把這次談薪排進下個季度。你的交付日期都能精確到下午，他給你的日期卻只有季節。薪水尚未變動，你想再問清楚一次。','「公司會看到你的努力，不要什麼事都急著算錢。」',[
   drawn('請他給出調整日期與書面條件。',[out(35,'這次願意列數字',approved,{mood:5,boss:-3},'raiseOffer'),out(25,'日期問成了忠誠度',fury,{mood:-16,boss:-23},'raiseFury',['raise_fury']),out(40,'承諾仍停在口頭','你把日期欄留白，寄出談話摘要。下個季度沒有自動變成加薪，今天的薪資單也沒有先預支他的善意。',{mood:-7},'raiseClose',['evidence','raise_promise'])]),
   drawn('替「下個季度」辦戶籍登記，請他給個出生日期。',[out(20,'季度終於有了地址',approved,{mood:5,boss:-5},'raiseOffer'),out(40,'他說這也要寫下來',fury,{mood:-12,boss:-24},'raiseFury',['raise_fury']),out(40,'戶政事務所不受理願景','你替這句承諾建了行事曆，沒有替它建收入。提醒跳出來時，你至少還記得今天談過什麼。',{mood:-5,slack:3},'raiseClose',['evidence','raise_promise'])]),
   c('先回去工作，這句承諾自己留一份。','你沒有把口頭承諾算進存款。工作照做，求職網站的密碼也照常記得。',{mood:-6},'raiseClose',['evidence','raise_promise'])
  ]);
  if(outcome==='fury')return scene('raise-response','你說調薪，他聽成奪權。','「朕不給你的，你不能搶。」這句話落下來，會議室像忽然多了一張龍椅。你只約了十分鐘談薪水，現在還得決定要怎麼把自己從這場忠誠度考試帶出去。','「我有說過現在要給你嗎？」',furyChoices());
 }
 if(run.eventId==='raise-confirmation'){
  if(outcome==='offer')return scene('raise-confirmation','願景先放旁邊，這次核對薪資單。',`希望寄來月薪方案：${offer}。這一封終於列了生效日，其他給付也分開寫明；要不要接受，由你自己回覆。`,'「請確認這份書面方案，不是上一場會議的口頭版本。」',[
   c('確認條件，接受這份書面調薪。',signed,{mood:14,trust:3},'raiseGrant',['raise_written']),
   c('先不接受，這次談判到這裡。','你保留了方案，也保留回絕的權利。薪水仍照原本的走，不用為了一句「都幫你爭取了」就急著簽。',{mood:2},'raiseClose',['raise_offer_declined'])
  ],'hope');
  if(outcome==='fury')return scene('raise-confirmation','問到日期，反而被問態度。','你追問承諾何時生效，翅膀又把問題帶回你是不是太計較。談薪的資料還攤著，他的音量已經蓋過數字。','「朕不給你的，你不能搶。」',furyChoices());
  if(outcome==='offset')return scene('raise-confirmation','加薪沒有消失，只是從另一欄搬過來。',`月薪方案仍寫著 ${offer}，但這期其他給付要減少，折合 12 格遊戲存款。希望說這樣公司比較好處理。你翻回前一封信，確認自己原本提的不是薪資科目搬家。`,'「翅膀的意思是整體一起看，不能只看其中一欄。」',[
   c('不同意拿其他給付抵銷，這次先不調。','你要求各項條件分開談，沒有接受這份搬家的加薪。月薪維持原值，其他給付也沒有被你這封信先答應扣回。',{mood:4,trust:4,boss:-5},'raiseClose',['evidence','raise_offset_refused']),
   c('接受月薪調整，也接受這次其他給付減少。','月薪按書面方案增加，這期另外一筆給付也依新條件扣回。你真的改了月薪，同時承擔一次遊戲存款的損失；這次沒有把兩件事混成一個好消息。',{mood:3,cash:-12},'raiseGrant',['raise_written','raise_offset_accepted']),
   c('把兩張薪資表折成蹺蹺板，請她找出增加的那一邊。','希望把紙攤平，說還要再回去問。你把兩個版本都存好，這次沒有簽，也沒有把表格移動當成收入成長。',{mood:2,boss:-8},'raiseClose',['evidence','archive','raise_offset_refused'])
  ],'hope');
 }
 throw new Error('Invalid raise phase');
}
