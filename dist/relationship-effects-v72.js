import {isLifeSystemsV72} from './life-systems-v72.js';
import {characterAffinity,deriveCharacterStats} from './character-stats.js';
import {PERSONAS,displayPersona} from './persona.js';
import {RELATIONSHIP_EVENTS_V72} from './events-relationships-v72.js';
import {CAST_RELATIONSHIP_VOICES_V74} from './cast-v74.js';

// These reactions are original office comedy. Each person has a distinct way
// of helping, refusing or passing responsibility; no demographic inference is
// made from portraits or from the player's generated character gender.
const voices=[
 ['wing','翅膀把確認條件寫進郵件，讓你照原本的範圍交付。','翅膀說這一輪先不追加，你少接了一場臨時考核。','翅膀不願確認條件，又把同一個問題丟回你桌上。','翅膀先追究你的語氣，原本能一句回答的事又談了一輪。','翅膀把尚未定案說成早就交代過，你得翻出原信把時間接回來。'],
 ['spencer','屎潘蛇替你確認一個能拍板的窗口，這次致詞有了附件。','屎潘蛇說明這段先照已確認的安排做，場上的人總算停止各自解釋。','屎潘蛇只說再研究，沒有讓你把條件說完。','屎潘蛇覺得你問得太細，你又多說了一輪事情真正卡在哪。','屎潘蛇把幾個未定條件留成一句方向，最後仍由你替大家把空格補回來。'],
 ['erich','法師替你圈出有用的附件與條款，這次說明不用從最後一頁猜。','法師先替你把需要確認的範圍講清楚，沒讓一份簽收自動長成三份承諾。','法師只回資料不足，沒有指出這輪到底少哪一份。','法師和你各抓一個不同的用詞，事情先停在定義上。','法師只轉出你回覆的最後一頁，少掉的前提又得由你補寄。'],
 ['sonny','阿福真的把設備紀錄找出來，這次理由後面跟著檔案。','阿福接下一輪設備確認，讓你不用一邊做事一邊接所有電話。','阿福先說不是他負責，那個窗口又繞回你這裡。','阿福花一段時間說明自己沒碰過什麼，你只能等說明結束再查事情。','阿福把「我早就提醒過」寄給翅膀，翅膀回你要補一份說明。',true],
 ['jenjen','真真替你找齊流程與窗口，今天不用再從座位數猜規定。','真真先擋下另一份臨時交辦，讓你把手上這份資料做完。','真真說流程還在走，沒接下你請她確認的那一段。','真真把你想確認的條件聽成不願配合，回信又多了幾段解釋。','真真把尚未回覆的項目抄給翅膀，翅膀追問進度，你得把原本等誰也寫回去。',true],
 ['rick','瑞克接起電話後，這次也把真正的需求轉給你，沒有只轉一句快點。','瑞克先替你回了一輪電話，讓你有時間把正在做的事收好。','瑞克把手機放下，說這段你自己看著處理。','瑞克覺得你不給他面子，談到最後還是沒多確認半個條件。','瑞克把你的半句話轉給翅膀，翅膀回了一個問號，完整說明又落到你身上。',true],
 ['kind','阿良這次把本人、時間和窗口一起留給你，沒有只留定位。','阿良替你接下一輪聯繫，讓你把手上的工作先收完。','阿良說等一下再回，等到你需要答案時人已經不在線。','阿良嫌你太計較細節，你花了比安排本身更久的時間確認安排。','阿良把舊定位當成完整交接傳出去，最後只有你得重新找人。'],
 ['hope','希望替你把用途與確認範圍放到表頭，這次不用先填完再猜。','希望先確認這只是一般工作核對，沒有讓談話越界成另一段考核。','希望回你先照流程，沒有回答這次到底需要確認什麼。','希望把一句待確認拆成好幾個觀察欄，你得逐一說明它們不是同一件事。','希望把尚待確認的欄位轉給翅膀，翅膀要求說明，你得把未定和拒絕重新分開。',true],
 ['jack','傑克替你找回原檔和寄送日期，資料終於不用靠誰嗓門大來定版。','傑克先接住一輪追問，讓你把附件整理好再說話。','傑克把自己那份紀錄收起來，說你這次先找原窗口。','傑克問你為什麼前後說法不同，你們多花一輪把真正的差異攤開。','傑克只把自己能證明的部分留下，你原以為有人會替你補的那段，得自己回頭追。'],
 ['meimei','水蛇替你補上客戶真正要驗證的條件，沒有再拿影片代替帳號。','水蛇先接下一輪客戶追問，讓你能把承諾和交付分開整理。','水蛇把客戶問題直接轉過來，沒有補上前面談過的條件。','水蛇覺得你在拆她的台，原本要對客戶的話先拿來互相解釋。','水蛇把展示時的答應留在簡報，還沒確認的期限則一起轉到你名下。'],
 ['helen','海倫替你把研究、產品和交付的範圍分清楚，少留一個要靠熬夜補的空格。','海倫擋住一件沒有拍板的追加，讓你先把已經答應的部分做完。','海倫說先找原決定人，沒有再替這輪需求補前提。','海倫和你對優先序看法不同，兩邊先花時間確認自己是不是在談同一個版本。','海倫把未確認的需求原樣退回，之前被你口頭接下的部分沒有跟著消失。'],
 ['sophie','紅茶替你把收據、時間和用途排好，稽核這次少了一道猜題。','紅茶先核完自己能確認的部分，沒有讓整份資料跟著等一句回覆。','紅茶只回缺件，你還得另外問缺的是哪一張。','紅茶覺得你把查核當成找碴，你們多講了一輪表格之外的火氣。','紅茶只保留能對到單據的說法，你以為已經講好的口頭例外又得重新說明。'],
 ['jonathan','強哥把測試條件與工時列給你，助理職稱這次沒有擋住真正的交接。','強哥接下自己能確認的測試，讓你不用替每一格結果先保證。','強哥提醒自己只是助理工程師，這段還得另外找能拍板的人。','強哥又把職稱拿出來，你們先爭論誰該回答，再繼續查問題。','強哥在回信裡留下助理的職責範圍，你原本以為他會代答的那段突然沒了窗口。'],
 ['owen','歐文替你補齊客戶背景和實際投入，這次名片後面有能接話的人。','歐文先替你接住一輪對外詢問，讓你把內部承諾確認完。','歐文說先往前談，沒有替你補上需要的條件。','歐文覺得你不夠積極，你又得把不能先答應的原因講一遍。','歐文的簡報收進你的成果，交接附件卻沒留下你的名字。'],
 ['sam','山姆把資料與驗證方法一起交給你，今天不用從串流字幕裡找交接。','山姆先把研究能回答的部分說清楚，沒有讓你替所有假設保證。','山姆把螢幕切回去，說這段你先自己看。','山姆不滿你追問基礎假設，事情暫時停在誰應該懂得更多。','山姆把研究限制留在附註，你先前答應過的產品效果又得自己對外澄清。'],
 ['cindy','辛蒂替你找到同一位拍板者，四個最新版終於有了一份結案條件。','辛蒂先把衝突的時程攤開，沒有讓你一個人替三個方向各留一晚。','辛蒂說你先整合看看，沒接下那個還缺決定人的問題。','辛蒂覺得你在拖進度，你們先花一輪把等待確認和沒有做事分開。','辛蒂把未回覆的窗口照表列出，你之前默默接下的延誤沒有自動退回去。'],
 ['professor','林老師看完附件後補了一個可驗證的條件，這次顧問意見有辦法接著做。','林老師把研究與交付分開說明，沒讓一個論點直接變成你下週的上線承諾。','林老師請你先補足資料，這半天沒有再替方案掛名。','林老師覺得問題定義還沒清楚，你們把時間花在重問題目。','林老師把研究限制寫得很清楚，簡報上原本放大的那段效果得由你收回來。'],
 ['annie_yu','安妮余替你確認客戶名單與真正的承接窗口，這次不必先猜叫的是哪位安妮。','安妮余先把一輪商務資料整理好，讓你能把重點帶進下一場會議。','安妮余說這段要再問歐文，沒有替別人的答應補上一個自己的保證。','安妮余覺得分工又被改掉，你們先花時間核對到底誰接下哪一段。','安妮余把未確認項目原樣轉回，你原以為已經有人處理的那格還是空著。'],
 ['princess','公主說「I checked the handoff. Here is the version we actually agreed on.」然後把正確檔案給你。','公主說「I will handle this part. Finish what you already promised.」這輪真的由她接住。','公主說「That is not what I agreed to take over.」這段沒有得到支援。','公主說「Please do not call this settled when we have not agreed.」你們得把條件重新談一遍。','公主留下「Please refer to the original agreement.」你原本以為能通融的那段，得自己回頭收好。'],
 ['joyce','914 把客戶狀況和真正的決策人一起交給你，這次不用拿合照猜進度。','914 先接下對外回覆，讓你把現在能承諾的內容整理完。','914 說先把結果做出來，沒有補你需要的背景。','914 覺得你在追究歸屬，你們先花一輪談名字才回到案子。','914 把成交寫進自己的回顧，原本需要一起承擔的交付卻留在你信箱。'],
 ['janet','Janet 把具體缺件列給你，這次核銷終於能照清單完成。','Janet 先確認已經齊備的單據，沒有讓整批資料一起等一句重寄。','Janet 只說不完整，沒有把缺件清單一起寄來。','Janet 覺得你在催她，三封信先拿來說明誰的口氣有問題。','Janet 把未補齊項目轉給翅膀，翅膀要你說明，你得再找一次那份始終沒收到的清單。',true],
 ['captain','船長把集合時間、負責人和真正的取餐安排一起傳來，這次星等不用你猜。','船長先替你接下一輪活動確認，讓你不用把午休拆成客服時段。','船長先回了其他訊息，你的那個確認仍停在未讀。','船長覺得你在挑她安排的毛病，你們又花一輪把口味和分工分開。','船長把集合訊息改了版本，沒有另外提醒你，最後得由你重新確認誰在哪裡等。'],
 ['zoe','201 替你把人數與流程核對好，這次掌聲沒有代替真正的分工。','201 接下一段主持，讓你有時間把自己的工作收尾。','201 說這輪先照名單走，沒接下你想另外確認的空格。','201 覺得你又在替她猜老闆的溫度，談話先偏離了真正的流程。','201 把活動責任照原名單留著，你口頭接過的那段沒有因為熟就被大家看見。'],
 ['action','順哥替你先問了對方有沒有資源，這次聯絡名單後面有投入條件。','順哥先接下一輪對外聯繫，讓你不用把每個人脈都當成今晚要交的報告。','順哥說機會先抓住，沒有補上人和錢到底從哪裡來。','順哥覺得你把構想看得太小，你又得把可用資源講回眼前這份表。','順哥把構想當成正在推進，你之前替大家保留的暫停條件沒有進簡報。'],
 ['hester','海姐把客戶真正要談的條件補給你，這次介紹不只剩一張名片。','海姐先回了一輪客戶問題，讓你把自己的承接範圍整理完。','海姐請你先找原窗口，沒有替這段合作多做一個保證。','海姐覺得你把問題帶偏，你們得先確認彼此真正要談的是哪一筆。','海姐把未承諾的條件留在附件，你先前口頭答應的版本得自己回頭解釋。'],
 ['simon','丁哥把設計差異和修改理由留給你，這次不必用第四個最新版猜結論。','丁哥接下一輪評圖確認，讓你不用替所有人的主觀各做一版。','丁哥請你先找能拍板的人，這次不再替模糊意見代做一稿。','丁哥覺得你又在拿考核開玩笑，原本的設計問題先繞到另一件事。','丁哥把各版決定人列回檔案，你原以為可以先略過的確認突然全有了名字。'],
 ['james','詹姆士把接手路徑一次交清楚，這次不用從第幾次回來猜檔案放哪裡。','詹姆士先替你接住一段交接，讓你把工作做完再數歡迎餐。','詹姆士說這輪不在自己的範圍，沒有再替空白欄位補人。','詹姆士覺得你每句話都在猜他何時走，工作先停在解釋自己還在。','詹姆士把交接照原範圍留好，你之前臨時接下的那段沒有跟著任何一次離場消失。'],
 ['johnny','強尼替你把排程和延期原因排在一起，這次進度不用只寫快好了。','強尼先接住一輪追問，讓你把真正能交的部分確認完。','強尼說時程沒有他能挪的空格，這段沒能替你接手。','強尼覺得你又替別人答應時間，你們先花一輪把日期的來處查清楚。','強尼把所有口頭承諾照原日期排上表，你替別人緩過的那一段也回到自己名下。'],
 ['alice','愛麗絲把真正的合作攻略整理給你，這次保底沒有拿來代替說明。','愛麗絲先接下一段確認，讓你把工作做完再決定要不要打開卡池。','愛麗絲把手機收起來，說這段需要你先問清楚自己的承諾。','愛麗絲覺得你拿交情替別人按了同意，談話先停在誰有權答應。','愛麗絲只保留那張沒有前後文的截圖，你得把原本說清楚的界線再補回群組。']
];
export const RELATIONSHIP_VOICES_V72=Object.freeze({...Object.fromEntries(voices.map(([id,help,cover,refusal,argument,backstab,report=false])=>[id,Object.freeze({help,cover,refusal,argument,backstab,report})])),...CAST_RELATIONSHIP_VOICES_V74});
const reactionNames={help:'有人遞來支援',cover:'有人替你接一輪',refusal:'這次不願配合',argument:'一句話又吵一輪',backstab:'交接裡多了一根刺'};
const contexts=['treatsContext','recruitmentContext','shareholderContext','activityInvitationContext','hiddenEncounterContext','activityContext','chapterContext','companyContext','rageContext','verbalContext','patronageReplyContext','patronageContext','raiseContext','mealContext','wealthReturnEventId','personnelPending'];
function safeWork(run){
 return isLifeSystemsV72(run)&&!run?.pending&&!run?.completed&&!run.pip?.active&&!run.flags?.floor_watch&&!run.pendingFamily&&!contexts.some(key=>run[key])&&run.salaryAdvice?.status!=='open'&&run.stats?.energy>15&&run.stats?.mood>12;
}
function workLedger(run){
 const seen=new Set();let count=0,lastPulse=-100,lastScene=-100;
 for(const row of run.history||[]){
  const key=`${row.turn}:${row.eventId}`;
  if(row.kind!=='daily'||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0||seen.has(key))continue;
  seen.add(key);count++;
  if(row.relationshipOutcome?.version===1)lastPulse=count;
  if(row.eventId?.startsWith('relationship72-'))lastScene=count;
 }
 return{count,lastPulse,lastScene};
}
export function relationshipTierV72(score){return score>=80?'close':score>=65?'trusted':score<=15?'hostile':score<=30?'strained':'ordinary';}
export function relationshipEventAllowedV72(run,event){
 if(!event?.requiresRelationshipV72)return true;
 if(!safeWork(run)||!event.relationshipRequirement||run.turn<(event.minTurn||0))return false;
 const {target,tone,threshold}=event.relationshipRequirement;
 if(!PERSONAS[target]||event.speaker!==target||event.roles&&!event.roles.includes(run.actualRoleId))return false;
 const ledger=workLedger(run);if(ledger.count<3||ledger.count-ledger.lastScene<4)return false;
 const score=characterAffinity(run,target).score;
 return tone==='warm'?score>=threshold:score<=threshold;
}
export function selectRelationshipEventV72(run,pool,draw){
 if(!safeWork(run))return null;
 const rows=pool.filter(event=>event.requiresRelationshipV72&&relationshipEventAllowedV72(run,event)&&!(run.seen||[]).includes(event.id));
 if(!rows.length||draw()>=.32)return null;
 return rows[Math.min(rows.length-1,Math.floor(draw()*rows.length))].id;
}
export function withRelationshipEventV72(run,event){
 // The authored events are selected as real IDs. Never overwrite an ordinary
 // job's title/answers while silently marking that unrelated job as completed.
 return event;
}
export function relationshipPulseV72(run,event,row,draw){
 if(!safeWork(run)||event?.kind!=='daily'||event.requiresRelationshipV72||event.context||!Number.isInteger(row?.choiceIndex)||row.choiceIndex<0||row.patronageOutcome||row.verbalOutcome||row.mealOutcome)return null;
 const target=event.speaker||'wing',voice=RELATIONSHIP_VOICES_V72[target];if(!voice)return null;
 const ledger=workLedger(run);if(ledger.count<2||ledger.count+1-ledger.lastPulse<3)return null;
 const stats=deriveCharacterStats(run).find(value=>value.id===target);if(!stats||stats.encounters<2)return null;
 const affinity=characterAffinity(run,target).score,tier=relationshipTierV72(affinity);
 if(tier==='ordinary')return null;
 const ticket=draw();let reaction;
 if(tier==='close')reaction=ticket<.42?'help':ticket<.62?'cover':null;
 else if(tier==='trusted')reaction=ticket<.28?'help':ticket<.42?'cover':null;
 else if(tier==='hostile')reaction=ticket<.27?'refusal':ticket<.48?'argument':ticket<.62?'backstab':null;
 else reaction=ticket<.23?'refusal':ticket<.39?'argument':ticket<.47?'backstab':null;
 if(!reaction)return null;
 const name=displayPersona(target)?.name||PERSONAS[target].name;
 const affinityDelta={help:2,cover:1,refusal:-1,argument:-2,backstab:-3}[reaction];
 const delta={help:{energy:7,mood:5,trust:2},cover:{energy:6,mood:4},refusal:{energy:-6,mood:-4},argument:{energy:-4,mood:-7,trust:-1},backstab:{energy:-7,mood:-7,trust:-3}}[reaction];
 if(target==='wing'&&['help','cover'].includes(reaction))delta.boss=reaction==='help'?3:2;
 if(reaction==='backstab'&&voice.report)delta.boss=-3;
 const flags=[`relationship72_${reaction}`,`relationship72_${reaction}_${target}`];
 if(reaction==='help'&&['jack','erich','professor','sophie','jonathan','johnny'].includes(target))flags.push('evidence');
 const reason=['close','trusted'].includes(tier)?'先前合作留下的信任，這次真的替你省下一段力氣。':'先前累積的嫌隙，這次讓原本的工作多了一段來回。';
 return{reaction,label:reactionNames[reaction],result:`【交情後續｜${name}：${reactionNames[reaction]}】${voice[reaction]} ${reason}`,delta:{...delta},flags,
  relationshipOutcome:{version:1,target,reaction,affinityDelta,origin:event.id,tier}};
}
export const relationshipEventIdsV72=Object.freeze(RELATIONSHIP_EVENTS_V72.map(event=>event.id));
