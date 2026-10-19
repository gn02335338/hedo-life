import { ROLES, ROLE_MAP } from './roles.js';
import { EVENTS, FANTASY_EVENTS } from './events.js';
import { ENDINGS } from './endings.js';
import { rollEducation, educationLabel } from './education.js';
export const VERSION = 3;
export const MAX_TURNS = 24;
export const STAT_LABELS = { energy:'體力', cash:'存款', trust:'同事情義', dream:'大餅信仰', boss:'老闆心情', mood:'自己心情', skill:'工作能力', slack:'偷懶能力', lick:'舔老闆能力' };
export const STAT_KEYS = Object.keys(STAT_LABELS);
const clamp = n => Math.max(0,Math.min(100,n));
// Only prefixed new runs opt into the occasional chat. Published v3 seeds retain their original scheduling and RNG consumption.
const occasionalEducation = run => run.seed.startsWith('e1-');
const hash = value => {let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0||1;};
function roll(run){let x=run.rng;x^=x<<13;x^=x>>>17;x^=x<<5;run.rng=x>>>0||1;return run.rng/4294967296;}
function flag(run,name,n=1){run.flags[name]=(run.flags[name]||0)+n;}
const c=(text,detail,result,delta={},effect=null,flags=[])=>({text,detail,result,delta,effect,flags});
const e=(id,title,body,wing,choices,kind='crisis',speaker=null)=>({id,title,body,wing,speaker:speaker||({'crisis-boss':'exit-team',paperwork:'exit-team','pip-review':'hope','pip-passed':'hope','salary-cut':'hope','salary-final':'hope'}[id]||'wing'),choices,kind,era:kind==='career'?'人事異動':'突發人事事件',sourceIds:[]});
export function jobTitle(run){const role=ROLE_MAP[run.actualRoleId];return run.assignment==='assistant'?role.assistantTitle:role.ladder[Math.min(run.rank,role.ladder.length-1)];}
export function bossLabel(n){return n<=12?'準備找你談談':n<30?'看誰都不順眼':n<60?'今天還算陰天':n<85?'龍心尚可':'聖眷正濃';}
export function createRun(roleId,seed=Date.now()){
 const role=ROLE_MAP[roleId];if(!role)throw new Error('Unknown role');
 const run={version:VERSION,seed:String(seed).slice(0,32),rng:hash(String(seed).slice(0,32)),roleId,actualRoleId:roleId,assignment:'honest',rank:0,pay:role.pay,offerPay:role.pay,basePay:role.pay,stats:{...role.stats},abilityDice:{},education:null,educationReviewed:false,salaryCutOffered:false,salaryCut:null,actions:[],flags:{},turn:0,eventId:'onboarding',seen:[],history:[],pending:false,completed:false,endingId:null,pendingEffect:null,pendingFamily:null,pip:null,pipCount:0,lastPromotion:-5,crisisCooldown:0,resumeEventId:null,exitReturnEventId:null,lastWeather:null};
 for(const key of ['skill','slack','lick']){const dice=Array.from({length:3},()=>1+Math.floor(roll(run)*6));run.abilityDice[key]=dice;run.stats[key]=25+(dice.reduce((a,b)=>a+b,0)-3)*4;}
 run.education=rollEducation(()=>roll(run));run.stats.boss=clamp(run.stats.boss+run.education.wingBias);
 run.offerPay=role.payRange[0]+Math.floor(roll(run)*(role.payRange[1]-role.payRange[0]+1));run.pay=run.offerPay;run.basePay=run.offerPay;
 const r=roll(run);
 if(role.assignmentTable){let total=0;for(const row of role.assignmentTable){total+=row.weight;if(r<total){run.actualRoleId=row.actualRoleId;run.assignment=row.assignment;break;}}}
 else if(r<role.swapChance){run.actualRoleId=role.swapTo;run.assignment='swapped';}else if(r<role.swapChance+role.assistantChance)run.assignment='assistant';
 if(run.assignment==='swapped'){flag(run,'bait_switch');run.stats.mood-=14;}
 if(run.assignment==='assistant'){flag(run,'assistant');if(run.actualRoleId!==roleId)flag(run,'bait_switch');run.pay=Math.round(run.offerPay*.78);run.stats.mood-=18;}
 return run;
}
function skillChoice(run,text,detail,condition,yes,no,effect,yesDelta={},noDelta={}){
 const ability=/肯定|金句|遠見|舔/.test(text)?run.stats.lick:run.stats.skill;
 const chance=Math.max(.1,Math.min(.92,.12+ability*.006+run.stats.boss*.001+(condition?.18:0)));
 const failedEffect=['pipPassed','pip_fail'].includes(effect)?'pip_fail':null;
 return {...c(text,detail,yes,yesDelta,effect),check:{chance,success:{result:yes,delta:yesDelta,effect:effect==='pip_fail'?'pipPassed':effect},failure:{result:no,delta:noDelta,effect:failedEffect}}};
}
export function getEvent(run){
 if(!run||run.completed)return null;
 const role=ROLE_MAP[run.roleId],actual=ROLE_MAP[run.actualRoleId],s=run.stats,f=run.flags;
 switch(run.eventId){
 case 'onboarding':{
 const unchanged=run.assignment==='honest';
 const title=unchanged?'職稱沒改，工作另議。':'錄取通知是真的，職稱另議。';
 const body=unchanged?`你應徵的是「${role.name}」，報到後的實際職稱也是「${jobTitle(run)}」；這次沒有被改派。你剛鬆一口氣，Wing補一句：「工作內容本來就要有彈性。」職稱保住了，桌上那張JD卻從這刻開始具有文學價值。`:run.assignment==='swapped'?`你應徵的是「${role.name}」，報到時卻被改派為「${jobTitle(run)}」；這就是你現在的實際職稱。${run.roleId==='ai'?'模型沒看到，CRUD與資料庫密碼倒是給得很齊。AI的A，原來是Anything。':'面試聊的專業，報到當天變成「你應該也會吧」。'}Wing把這叫跨領域，你把這叫掛羊頭賣狗肉。`:`你應徵的是「${role.name}」，報到時的實際職稱卻被改成「${jobTitle(run)}」。不是暫時幫忙，是直接用助理職稱任用。今天先訂便當、整理Excel、幫忙貼發票；你的專業等公司上市後再說。連遊戲月薪都從${run.offerPay}K縮成${run.pay}K。`;
 return e('onboarding',title,body,'「職稱只是名字，你不要把自己的格局做小了。」',[
 c('先坐下。房租不接受我的尊嚴付款。','接受目前分工，開始累積能力。','你坐進座位。桌子沒有名字，鍋倒是已經幫你訂製好了。',{mood:-5,skill:5,cash:5},null,['endure']),
 skillChoice(run,'拿錄取信，把工作範圍問清楚。',`協商條件：工作能力 ≥ 65（目前 ${s.skill}）`,s.skill>=65,unchanged?'你拿錄取信逐項確認工作範圍。職稱維持不變，Wing倒是記住了你「很有想法」。':'你把差異逐項攤開，這次談回了錄取時的職務。代價是Wing記住了你「很有想法」。',unchanged?'你問得很具體，他回得很宏觀。職稱沒變，工作範圍也沒講清楚，卻先拿到一個「不好帶」的評語。':'你問得很具體，他回得很宏觀。職務沒換回來，卻先拿到一個「不好帶」的評語。','restoreJob',{boss:-14,mood:8},{boss:-20,mood:-8}),
 c('蛤？那我先走，這份JD留給平行宇宙。','第一天也可以直接結局。','椅子還沒坐熱，你已經完成離職交接：把門關上。',{mood:20},'ragequit')
 ],'onboarding');}
 case 'education-review':{
 const ed=run.education;
 const reaction=ed.schoolId==='ntu'&&ed.degree!=='EMBA'&&ed.field==='stem'?'Wing一聽到「臺灣大學」，笑容突然多了一層認證：「台大的喔？那應該很會讀書。」同一張椅子上的你，前途忽然被重新估價。':ed.degree==='EMBA'?'聽到EMBA，Wing笑著補一句：「我說的讀書，不是你以為的那種讀書。」你發現同一張文憑，可以依照他的心情改變單位。':['humanities','business'].includes(ed.field)?'你才講完科系，Wing就接話：「你這個背景，平常到底有沒有在讀書？」你想說讀完才有畢業證書，但他的問題顯然不接受字面回答。':ed.sector==='private'?'校名一說出口，Wing先露出一個很會讓人理解的表情，再問你最近讀了什麼書。你開始懷疑這裡的書，封面是不是都要印同一間大學。':'Wing聽完點點頭：「學歷不能代表什麼，重點是你有沒有一直讀書。」下一秒，他又問起別人的學校。';
 return e('education-review','一個看起來很普通的問題。',`工作聊到一半，Wing忽然笑著問：「你哪裡畢業的？」語氣很像普通閒聊。你照實回答：「${educationLabel(ed)}。」${reaction}`,'「不要只會做事。人不讀書，格局就會卡在那裡。」',[
 c('先聽著，回去把真正需要的知識補上。','','你翻開的是技術文件。他要的是哪本書，你決定暫時不要通靈。',{skill:7,boss:3,mood:-4},'educationDone'),
 c('書有讀。也想知道這件事跟交付有什麼關係。','','問題很合理，會議很安靜。Wing說你太愛辯，你把這句話記在讀書筆記旁邊。',{mood:9,boss:-15,trust:5},'educationDone',['evidence']),
 c('您推薦的那本，我已經放進待讀清單了。','','清單有建立，書不一定有買。Wing點點頭，這場讀書會暫時驗收了語氣。',{lick:7,boss:10,slack:3,dream:-4},'educationDone')
 ],'career');}
 case 'salary-cut':{
 const cut=run.salaryCut;
 const negotiation=skillChoice(run,'把交付紀錄和錄取條件攤開，重新談。','',s.skill>=65&&s.boss>=30,'Hope說會再協調。幾封往來之後，這次降薪撤回，工作清單倒是一項也沒有少。','Hope轉達：「Wing覺得這就是你的價值。」你得到的回覆，跟問題一樣長。','salaryRescind',{mood:8,boss:-7},{mood:-8,boss:-4});
 negotiation.check.failure.effect='salaryFinal';
 return e('salary-cut','試用期結束，薪水也想跟著結束。',`Hope約你談薪資。Wing本人不在，評語已先到：「我覺得你不值這個價。」原本的遊戲月薪${cut.from}K，現在要調成${cut.to}K。試用期證明你能做，下一步是證明你能便宜做。`,'「公司有公司的考量。你也可以想想，要不要繼續一起努力。」',[
 c('先留下。房租沒有試用期。','','你接受新數字，工作量維持原價。薪資單會調整，交辦訊息完全不用。',{mood:-18,boss:12},'salaryAccept',['endure']),
 c('那就不用繼續了。我的履歷還有下一頁。','','你把新薪資單推回去。既然價值談不攏，這場合作就停在原本的價格。',{mood:20},'ragequit'),
 negotiation
 ],'career');}
 case 'salary-final':return e('salary-final','回覆收到了，選擇還是你的。',`Hope轉達調薪方案不變：${run.salaryCut.from}K改成${run.salaryCut.to}K。Wing沒有出席，卻已經替會議寫好結論。你現在要替自己寫下一句。`,'「今天可以給個答覆嗎？大家都還有工作要處理。」',[
 c('暫時留下，把這筆帳記著。','','你選擇先保留收入。加班表沒有打折，求職網站的分頁開始常駐。',{mood:-14,boss:10},'salaryAccept',['archive']),
 c('不接受。那今天就到這裡。','','對方問你是不是太衝動，你說這不是已經想過的方案嗎。這次，主詞是你。',{mood:20},'ragequit')
 ],'career');
 case 'crisis-boss':return e('crisis-boss','老闆心情見底。你的門禁也是。','Wing沒有出現。法務長Erich、行政長JenJen和MIS Sonny在會議室等你：一位翻文件，一位確認交接，一位等著收帳號。口頭上是公司叫你走，推來的表格卻寫「自願離職」。','「你簽一下，大家好聚好散。這是為你好。」',[
 c('算了，簽下去。只想趕快離開。','被開除／簽自願離職路線。','你簽了。系統的最後一行不是「被叫走」，是「個人生涯規劃」。',{},'fired_signed'),
 c('不簽。先把這到底算什麼講清楚。','進入書面離場分支，可走未經PIP資遣。','Erich說公司已經很有誠意，JenJen把表格往前推，Sonny看了一眼時間。你第一次覺得，慢一點也有用。',{boss:-3,mood:4},'paperwork',['evidence']),
 c('不是說績效？那就把PIP目標寫下來。','進入3個工作回合的PIP，不保證過關。','Hope寄來改善計畫。Wing沒有抄送你，只把意見交給HR長轉述。目標看似三項，真正那項叫「改善他對你的看法」。',{boss:35,mood:-8},'startPip',['evidence'])
 ]);
 case 'paperwork':return e('paperwork','同一個離場，三種公司說法。','自願離職書沒有簽成，三件套開始輪流解釋。Erich談文字，JenJen談時間，Sonny問筆電在哪裡。Wing仍然不在場，大家卻都能精準代言他的心情。','「程序不用搞那麼複雜吧？你是不是不信任公司？」',[
 c('拒簽到底，把來回紀錄留好。','開除／拒簽自願離職結局。','你帶走的是書面往來與自己的版本。故事沒有被那張空白表格全部改寫。',{mood:12},'fired_refused',['evidence']),
 c('既然說組織調整，就照資遣名義離場。','未走PIP的資遣結局。','這一局沒有改善期，也沒有準備演出。上一封信還在催進度，下一封已經要你交接。',{},'layoff'),
 c('願意做PIP，但目標和期限先寫清楚。','改走有PIP的支線；3回合後評核。','Hope接手主持PIP，交給你一張自評表。現在，工作除了原本的工作，還多了一份證明自己有在工作的工作。',{boss:35,mood:-5},'startPip',['evidence'])
 ]);
 case 'crisis-mood':return e('crisis-mood','你的心情，已讀不回。','訊息通知再響一次，你開始認真研究窗外的天空。體力還能撐，心情已經把離職信寫到第三版。今天還要不要演「我很好」？','「這點壓力都受不了，以後怎麼跟我敲鐘？」',[
 c('幹，我不幹了。','自己受不了離職，現在就結局。','你第一次沒有替老闆的句子找台階。他的夢想留在群組，你的人生先下線。',{mood:30},'ragequit'),
 c('花一點存款，休息到能分清自己和工作。','存款 −12，心情 +38，體力 +20。','你把通知關掉。休息不是他的恩惠，是你替自己留下的操作空間。',{cash:-12,mood:38,energy:20},'resume'),
 c('先開省電模式。這個薪水，配這個演技。','練習偷懶，降低投入；仍會惹老闆不爽。','你把「正在處理」設成快捷鍵。不是事情做不完，是情緒不能再免費供應。',{mood:24,slack:15,boss:-5,dream:-12},'resume')
 ]);
 case 'pip-review':{
 const evidence=f.evidence||0;const proof=s.skill>=65&&evidence>=2;const favor=s.lick>=65&&s.boss>=25;
 return e('pip-review','PIP評核：問題改善了，老闆呢？',`改善期走完了。你交出成果、時間線和紀錄，HR長Hope主持評核，先請你替自己打分。Wing依舊沒有出現，意見卻比在場的人還多。你交的是工作成果，對方準備的是另一份評分標準。`,'「你自己打幾分？不要拿工作完成當藉口。」',[
 skillChoice(run,'逐條對照目標，用成果和紀錄答辯。',`需要工作能力 ≥65、紀錄 ≥2（${s.skill}／${evidence}）`,proof,'Hope把交付紀錄一條條確認完，又接了一通你聽不到內容的電話。PIP過了，Wing的不滿沒有撤回。','Hope說理解你的努力，接著把理解放到一旁。表格最後一格，仍被填上「未達改善目標」。',proof?'pipPassed':'pip_fail',{},{}),
 skillChoice(run,'先肯定他的遠見，再解釋自己的改善。',`需要舔老闆 ≥65、老闆心情 ≥25（${s.lick}／${s.boss}）`,favor,'整份報告以「感謝Wing與Hope」開場。Hope說會協助轉達，這次轉達的效率異常良好。','你剛說完「感謝指導」，Hope回覆這不是她想聽的答案。看來今天的評分表，連感謝都要附佐證。',favor?'pipPassed':'pip_fail',{lick:5},{mood:-5}),
 c('不演了。讓這份PIP走到它想去的地方。','有走PIP、評核後資遣結局。','你沒有再補第十七版改善報告。這齣戲的最後一幕，終於不用加班演。',{},'pip_fail')
 ]);}
 case 'pip-passed':return e('pip-passed','PIP過了。恭喜，你還在禾多。','Hope寄來通過通知，只有一行。接下來是冷臉、跳過你的會議邀請，以及照樣準時出現的工作單。Wing沒有參加任何一場PIP，卻沒有漏掉任何一次不滿。','「讓你過，不代表我滿意。你自己要有自覺。」',[
 c('過關是證明，離開是決定。','PIP過關後主動離職結局。','你用成果證明能做，再用離職證明可以不做。這兩件事完全不衝突。',{mood:25},'pip_exit'),
 c('留下，但把每件事寫進紀錄。','繼續遊戲；重設怒氣警報。','你把感謝詞刪掉，留下日期、要求和交付。檔案夾開始長得像小型史冊。',{boss:45,mood:24,energy:12},'finishPip',['archive','evidence']),
 c('留下，順便學會什麼時候該裝忙。','繼續遊戲，強化偷懶與討好。','你有了兩份工作：一份解決問題，一份解決老闆看到問題時的心情。',{boss:50,mood:20,slack:15,lick:15},'finishPip')
 ]);
 case 'promotion-review':{
 const capable=s.skill>=65&&s.boss>=45;const flattering=s.lick>=65&&s.boss>=60;
 return e('promotion-review','恭喜升遷。加多少工作？',`你目前是${jobTitle(run)}，遊戲月薪${run.pay}K。Wing說公司會看見你的付出，手上已經拿著下一張組織圖。你決定怎麼拿這個職稱？`,'「不要先問加多少錢，先想你能多扛多少責任。」',[
 skillChoice(run,run.assignment==='assistant'?'用實績換回正式職務。':'拿成果談職級和薪資。',`工作能力 ≥65、老闆心情 ≥45（${s.skill}／${s.boss}）`,capable,'你把交付換成新的職稱和一點薪水。恭喜，現在可以用更高的職級接同一口鍋。','成果是真的，「下次一定」也說得很真。這次只有責任增加，職稱還在審核。','promote',{energy:-5,mood:6,cash:8},{mood:-9,boss:-5}),
 skillChoice(run,'把他的話做成金句，附在升遷簡報首頁。',`舔老闆 ≥65、老闆心情 ≥60（${s.lick}／${s.boss}）`,flattering,'你的簡報只有七頁，Wing的名字出現十八次。組織圖當場動了。','你以為是在表忠，他覺得你在套招。「你以為這樣就能升？」','promote',{lick:8,trust:-10,boss:8,cash:6},{mood:-6,boss:-8}),
 c('先不要升。我只想把下班時間保住。','心情與體力回復；偷懶能力增加。','你禮貌拒絕了「被更多人找到」的權利。公司少一位主管，你多一個晚上。',{mood:12,energy:10,slack:10,boss:-6},'declinePromotion')
 ],'career');}
 case 'exit-menu':return e('exit-menu','今天，想怎麼離開？',`第${run.turn+1}個工作回合，${jobTitle(run)}，心情${s.mood}。你不需要等到敲鐘，才有權把這段人生結束。這裡沒有「再撐一下就好了」的系統提示。`,'「你走了，外面也不一定比較好喔。」',[
 c('那是外面的事。我現在選擇離職。','結束本局；保留已收集的結局。','你沒有為他的預言留下來驗證。門外有很多問題，但至少不是這一個。',{mood:20},f.pip_passed?'pip_exit':'ragequit'),
 c('有些事想做完，再把門帶上。','檢視升官、摸魚、舔王、史官等職涯結局。','你把這段經歷攤開，決定要用什麼頭銜替自己蓋章。',{},'careerExit'),
 c('先回座位。我還有一個選擇沒做。','返回原事件，不消耗回合。','你把離職信存成草稿。它在，就已經不一樣。',{},'return')
 ],'career');
 case 'career-exit':return e('career-exit','最後一天，想留下一點什麼？','交接清單寫完了，但你的故事還差最後一句。你看了一眼座位、訊息和名片，決定這次由自己收尾。','「有些人只會做事，有些人知道誰在看。」',[
 {...c(run.roleId==='executive'?'收起那張主管名片，結束這場角色扮演。':'把最後一份交辦完成，收拾自己的桌子。',run.roleId==='executive'?'職稱仍是主管，決策卻已經繞過你。':'目前實際職務為助理。','職缺頁還在寫專業人才。你用整段人生，補完了它沒寫的「其他交辦」。',{},'assistant'),available:run.assignment==='assistant'||(run.roleId==='executive'&&run.turn>=4&&s.boss<45)},
 {...c('帶著新名片，去找下一張辦公桌。','至少成功升遷1次。','你拿到新的頭銜，留下上一張名片當作工作量還正常時的考古證據。',{},'promotion'),available:run.rank>=1},
 {...c('把所有通知調成勿擾，留下生活的分頁。','偷懶能力 ≥65。','你沒讓公司成為人生，倒是讓公司付了你一部分人生的錢。',{},'slacker'),available:s.slack>=65},
 {...c('把最後一篇感謝文寫得讓他滿意。','舔老闆 ≥75、老闆心情 ≥65。','組織圖終於畫對了：所有箭頭都指向你嘴裡的Wing。',{},'sycophant'),available:s.lick>=75&&s.boss>=65},
 {...c('把離場經歷寫下來，留給下一個人。','累積至少4次史冊紀錄。','你把檔案封存。幾年後有人說你誇張，旁邊的人補一句：沒有，他還寫得太客氣。',{},'historian'),available:(f.archive||0)>=4},
 c('不需要再證明什麼。我先走了。','主動離職結局。','你不是沒撐到最後。你只是決定，最後一天就是今天。',{mood:20},f.pip_passed?'pip_exit':'ragequit'),
 ...(run.turn<MAX_TURNS?[c('還有一件事沒做，我先回座位。','返回原事件。','你還有自己的小計畫，暫時不讓Wing知道。',{},'return')]:[])
 ],'career');
 case 'final-shortfall':return e('final-shortfall','敲鐘前，先別把自己敲壞。','敲鐘的行程一改再改，收購消息又換了一個日期。大家口中的下一站一直很近，你看著沒有訂好的機票，開始想自己究竟還要等什麼。','「先把新聞稿寫好，條件以後再補。」',[
 c('新聞稿你寫，我去過人生。','選擇現在已解鎖的職涯結局。','你關掉那份尚未上市的上市簡報。至少自己的人生，今天可以交付。',{},'careerExit'),
 c('離職。我的夢，換個地方做。','主動離職結局。','這一次你沒有把「再等等」存成明年的計畫。',{},'ragequit'),
 {...c('這段先記起來。史冊要加頁了。','需要4次以上史冊紀錄。','目標沒有達成，但材料非常豐富。史官的業績，從來不靠公司掛牌。',{},'historian'),available:(f.archive||0)>=4}
 ],'career');
 }
 const event=EVENTS.find(e=>e.id===run.eventId)||FANTASY_EVENTS.find(e=>e.id===run.eventId);
 if(!event)throw new Error(`Unknown event ${run.eventId}`);
 if(event===FANTASY_EVENTS[3])return {...event,kind:'fantasy',choices:[...event.choices,c('不去交易所。我的人生另有用途。','選擇職涯、離職或隱藏結局。','你從口袋裡拿出那張舊清單，翻到背面。空白，剛好可以寫自己的。',{},'careerExit')]};
 return {...event,speaker:event.speaker||'wing',kind:FANTASY_EVENTS.includes(event)?'fantasy':'daily'};
}
const WEATHER=[{text:'Wing看完官網英文，決定對全世界不爽。',delta:-9},{text:'他剛開完別人的會，你負責承受餘震。',delta:-7},{text:'今天不知道誰先拍對馬屁，辦公室暫時放晴。',delta:6},{text:'Wing想到掛牌願景，暫時看誰都像未來股東。',delta:7},{text:'公司沒發生什麼事，老闆也先沒有。',delta:0},{text:'一個未回覆的訊息，讓今天變成臨時考核。',delta:-5}];
function nextNormal(run){
 if(run.turn>=20&&run.turn<MAX_TURNS)return FANTASY_EVENTS[run.turn-20].id;
 if(run.turn>=MAX_TURNS)return 'career-exit';
 let pool=EVENTS.filter(ev=>!run.seen.includes(ev.id)&&(ev.minTurn??0)<=run.turn&&(ev.maxTurn??99)>=run.turn&&(!ev.roles||ev.roles.includes(run.actualRoleId)||ev.roles.includes(run.roleId)));
 if(!pool.length)pool=EVENTS.filter(ev=>!ev.roles||ev.roles.includes(run.actualRoleId)||ev.roles.includes(run.roleId));
 const weighted=pool.map(ev=>({ev,w:(ev.weight||1)*(ev.roles?2:1)}));let n=roll(run)*weighted.reduce((v,x)=>v+x.w,0);for(const {ev,w}of weighted){n-=w;if(n<=0)return ev.id;}return pool.at(-1).id;
}
function finish(run,family){run.endingId=`${family}-${run.roleId}`;if(!ENDINGS.some(e=>e.id===run.endingId))throw new Error(`Unknown ending ${run.endingId}`);run.completed=true;run.pending=false;run.pendingFamily=null;run.pendingEffect=null;run.eventId=null;return run;}
export function endingEligibility(run,target){const s=run.stats;const common=s.energy>=20&&s.cash>=30&&s.skill>=65&&s.trust>=55;
 if(target==='nasdaq')return common&&s.dream>=70;
 if(target==='taiwan')return common&&s.dream>=45;
 if(target==='acquired')return s.energy>=15&&s.cash>=20&&s.skill>=70&&s.trust>=45;
 return false;
}
export function applyChoice(run,index){
 if(run.completed||run.pending)return run;
 const event=getEvent(run),originalChoice=event.choices[index];if(!Number.isInteger(index)||!originalChoice||originalChoice.available===false)throw new Error('Unavailable choice');
 const next=structuredClone(run);const before={...run.stats};next.lastWeather=null;
 next.actions.push({type:'choice',eventId:event.id,index});
 let chanceOutcome=null,choice=originalChoice;
 if(choice.check){const passed=roll(next)<choice.check.chance;choice={...choice,...choice.check[passed?'success':'failure']};chanceOutcome=passed?'success':'setback';}
 for(const k of STAT_KEYS)next.stats[k]=clamp(next.stats[k]+(choice.delta[k]||0));
 for(const name of choice.flags||[])flag(next,name);
 let result=choice.result;let effect=choice.effect;
 if(event.kind==='daily'||event.kind==='fantasy'){
  // A chosen action is resolved only here. Capability shifts the odds; neither good intent nor a high stat guarantees the outcome.
  const specialty=(choice.delta.lick||0)>0?'lick':(choice.delta.slack||0)>0?'slack':'skill';
  const luck=roll(next),capability=before[specialty],goodChance=.13+capability*.0014,badChance=.28-before.slack*.0012;
  if(luck<goodChance){
   chanceOutcome='lucky';const bonus=specialty==='lick'?{boss:9,mood:3}:specialty==='slack'?{energy:7,mood:5}:{skill:4,boss:5,mood:3};
   for(const [key,value]of Object.entries(bonus))next.stats[key]=clamp(next.stats[key]+value);
   result+=specialty==='lick'?' 恰好，這句話踩中他今天想聽的版本。對方自己替你把後半段補成了優點。':specialty==='slack'?' 剛好有人把會議延後，你安靜回收了一小段人生。今天的省電模式，沒有被發現。':' 剛好有人替你的成果說了一句話。事情本身沒變，待遇突然順了一點。';
  }else if(luck>1-badChance){
   chanceOutcome='setback';const extra=specialty==='lick'?{boss:-10,trust:-4}:specialty==='slack'?{boss:-9,mood:-4}:{energy:-6,mood:-5,boss:-4};
   for(const [key,value]of Object.entries(extra))next.stats[key]=clamp(next.stats[key]+value);
   result+=specialty==='lick'?' 不巧，他今天把稱讚聽成了敷衍。你說同一句話，得到跟上次相反的表情。':specialty==='slack'?' 不巧，那扇門就在你最不像在忙的時候打開。你和老闆完成了一次不必要的眼神交接。':' 不巧，臨時插進來的交辦把原定節奏打散。沒有人改期限，只有你重新排時間。';
  }else chanceOutcome='ordinary';
  const weather=WEATHER[Math.floor(roll(next)*WEATHER.length)];next.stats.boss=clamp(next.stats.boss+weather.delta);next.lastWeather={...weather};
  if(next.roleId==='executive'&&next.turn<=6){next.stats.boss=clamp(next.stats.boss-12);next.stats.trust=clamp(next.stats.trust-3);next.lastWeather.text+=' 空降蜜月退潮，連「新氣象」都開始聽起來像罪名。';next.lastWeather.delta-=12;}
  if(next.assignment==='assistant'){next.stats.mood=clamp(next.stats.mood-2);}
  if(next.turn>0&&next.turn%4===0){const income=Math.max(4,Math.round(next.pay/10));next.stats.cash=clamp(next.stats.cash+income);result+=` 本期遊戲薪資入帳，存款 +${income}。`;}
  if(next.pip?.active)next.pip.remaining=Math.max(0,next.pip.remaining-1);
 }
 if(effect==='restoreJob'){next.actualRoleId=next.roleId;next.assignment='honest';next.pay=next.offerPay;next.basePay=next.offerPay;}
 if(effect==='promote'){
  if(next.assignment==='assistant'){next.assignment='honest';next.rank=0;next.pay=Math.max(next.pay,rolePay(next));result+=' 助理轉正；';}else{next.rank=Math.min(4,next.rank+1);next.pay=Math.max(next.pay+5,rolePay(next));}next.lastPromotion=next.turn;flag(next,'promotions');result+=` 職稱變更：${jobTitle(next)}。遊戲月薪 ${next.pay}K。`;
 }
 if(event.id==='promotion-review')next.lastPromotion=next.turn;
 if(effect==='startPip'){next.pip={active:true,remaining:3};next.pipCount++;next.crisisCooldown=3;next.stats.boss=Math.max(35,next.stats.boss);}
 if(effect==='pipPassed'){next.pip={active:false,remaining:0};flag(next,'pip_passed');}
 if(effect==='finishPip'){next.pip=null;next.crisisCooldown=3;}
 if(effect==='educationDone')next.educationReviewed=true;
 if(effect==='salaryAccept'){next.pay=next.salaryCut.to;next.basePay=Math.round(next.pay/(1+next.rank*.15));next.salaryCut.status='accepted';flag(next,'pay_cut');result+=` 遊戲月薪變更為${next.pay}K。`;}
 if(effect==='salaryRescind')next.salaryCut.status='rescinded';
 let family=ENDINGS.some(e=>e.family===effect)?effect:null;
 if(!family&&next.stats.cash<=0)family='broke';
 if(!family&&next.stats.energy<=0)family='burnout';
 if(!family&&choice.flags?.some(x=>['final_global','final_taiwan','final_acquire'].includes(x))){const goal=choice.flags.includes('final_global')?'nasdaq':choice.flags.includes('final_taiwan')?'taiwan':'acquired';if(endingEligibility(next,goal))family=goal;else effect='shortfall';}
 if(event.id==='onboarding'&&index<2)result+=` 目前實際職稱：${jobTitle(next)}。遊戲月薪 ${next.pay}K。`;
 next.history.push({eventId:event.id,kind:event.kind,title:event.title,body:event.body,wing:event.wing||'',speaker:event.speaker||'wing',sourceIds:event.sourceIds||[],turn:next.turn,choiceIndex:index,choiceText:choice.text,result,chanceOutcome,delta:Object.fromEntries(STAT_KEYS.map(k=>[k,next.stats[k]-before[k]])),weather:next.lastWeather,jobTitle:jobTitle(next),pay:next.pay});
 next.pending=true;next.pendingEffect=effect;next.pendingFamily=family;return next;
}
function rolePay(run){return Math.round(run.basePay*(1+run.rank*.15));}
export function advance(run){
 if(!run.pending||run.completed)return run;
 const next=structuredClone(run);const last=next.history.at(-1),effect=next.pendingEffect;next.pending=false;next.pendingEffect=null;
 if(next.pendingFamily)return finish(next,next.pendingFamily);
 if(effect==='paperwork'){next.eventId='paperwork';return next;}
 if(effect==='pipPassed'){next.eventId='pip-passed';return next;}
 if(effect==='salaryFinal'){next.eventId='salary-final';return next;}
 if(effect==='shortfall'){next.eventId='final-shortfall';next.turn=MAX_TURNS;return next;}
 if(effect==='careerExit'){next.eventId='career-exit';return next;}
 if(effect==='return'&&next.exitReturnEventId){next.eventId=next.exitReturnEventId;next.exitReturnEventId=null;return next;}
 const normal=['daily','fantasy','onboarding'].includes(last.kind);
 if(normal){if(!next.seen.includes(last.eventId))next.seen.push(last.eventId);next.turn++;if(next.crisisCooldown>0)next.crisisCooldown--;}
 if(['return','resume','finishPip','startPip','promote','declinePromotion','educationDone','salaryAccept','salaryRescind'].includes(effect)&&next.resumeEventId){next.eventId=next.resumeEventId;next.resumeEventId=null;}else if(normal)next.eventId=nextNormal(next);
 else if(last.kind==='career'||last.kind==='crisis'){next.eventId=next.resumeEventId||nextNormal(next);next.resumeEventId=null;}
 if(effect==='return')return next;
 if(normal&&!occasionalEducation(next)&&!next.educationReviewed){next.resumeEventId=next.eventId;next.eventId='education-review';return next;}
 if(next.pip?.active&&next.pip.remaining===0){next.resumeEventId=next.eventId;next.eventId='pip-review';return next;}
 if(next.stats.mood<=12&&next.eventId!=='crisis-mood'){next.resumeEventId=next.eventId;next.eventId='crisis-mood';return next;}
 if(next.stats.boss<=12&&!next.pip?.active&&next.crisisCooldown===0){next.resumeEventId=next.eventId;next.eventId='crisis-boss';return next;}
 if(normal&&!next.pip?.active&&!next.salaryCutOffered&&next.turn>=5&&next.turn<18&&next.stats.boss<55&&roll(next)<.3){
  const percent=15+Math.floor(roll(next)*21);next.salaryCutOffered=true;next.salaryCut={percent,from:next.pay,to:Math.max(20,Math.round(next.pay*(1-percent/100))),status:'pending'};next.resumeEventId=next.eventId;next.eventId='salary-cut';return next;
 }
 if(normal&&!next.pip?.active&&next.turn<20&&next.turn-next.lastPromotion>=4&&(next.turn%6===0||next.stats.boss>=90)&&(next.rank<4)) {next.resumeEventId=next.eventId;next.eventId='promotion-review';return next;}
 if(normal&&occasionalEducation(next)&&!next.educationReviewed&&next.turn>=5&&next.turn<=16&&!next.pip&&!next.resumeEventId&&!next.exitReturnEventId&&getEvent(next)?.kind==='daily'&&roll(next)<.1){next.resumeEventId=next.eventId;next.eventId='education-review';}
 return next;
}
export function requestExit(run){if(!run||run.pending||run.completed)return run;if(['exit-menu','career-exit'].includes(run.eventId))return run;const next=structuredClone(run);next.actions.push({type:'exit'});next.exitReturnEventId=next.eventId;next.eventId='exit-menu';return next;}
export function replayRun(roleId,seed,actions){
 if(typeof seed!=='string'||seed.length>32||!Array.isArray(actions)||actions.length>300)throw new Error('Invalid replay');
 let run=createRun(roleId,seed);
 for(const action of actions){
  if(!action||typeof action!=='object'||run.completed)throw new Error('Invalid replay action');
  if(action.type==='exit'){const next=requestExit(run);if(next===run)throw new Error('Duplicate exit');run=next;}
  else if(action.type==='choice'){
   if(action.eventId!==run.eventId||!Number.isInteger(action.index))throw new Error('Replay event mismatch');
   run=advance(applyChoice(run,action.index));
  }else throw new Error('Unknown replay action');
 }
 return run;
}
export function validRun(run){
 try {
  if(!run||run.version!==VERSION||!ROLE_MAP[run.roleId]||!ROLE_MAP[run.actualRoleId]||typeof run.seed!=='string'||run.seed.length>32||!Number.isInteger(run.rng)||run.rng<=0||run.rng>4294967295)return false;
  if(!['honest','swapped','assistant'].includes(run.assignment)||!Number.isInteger(run.rank)||run.rank<0||run.rank>4||!Number.isFinite(run.pay)||run.pay<1||run.pay>500||!Number.isInteger(run.turn)||run.turn<0||run.turn>MAX_TURNS)return false;
  if(run.roleId==='executive'&&(run.actualRoleId!=='executive'||run.assignment!=='honest'))return false;
  if(!Number.isInteger(run.offerPay)||run.offerPay<1||run.offerPay>300||!Number.isInteger(run.basePay)||run.basePay<1||run.basePay>300)return false;
  if(!run.education||typeof run.education.school!=='string'||typeof run.education.department!=='string'||!['學士','碩士','EMBA'].includes(run.education.degree)||!['public','private','overseas'].includes(run.education.sector)||!Number.isInteger(run.education.wingBias))return false;
  if(!run.abilityDice||!['skill','slack','lick'].every(k=>Array.isArray(run.abilityDice[k])&&run.abilityDice[k].length===3&&run.abilityDice[k].every(n=>Number.isInteger(n)&&n>=1&&n<=6)))return false;
  if(typeof run.educationReviewed!=='boolean'||typeof run.salaryCutOffered!=='boolean'||!Array.isArray(run.actions)||run.actions.length>300)return false;
  if(!run.actions.every(a=>a&&typeof a==='object'&&(a.type==='exit'||(a.type==='choice'&&typeof a.eventId==='string'&&Number.isInteger(a.index)&&a.index>=0&&a.index<10))))return false;
  if(run.salaryCut&&(!Number.isInteger(run.salaryCut.from)||!Number.isInteger(run.salaryCut.to)||run.salaryCut.to<1||run.salaryCut.to>run.salaryCut.from||!Number.isInteger(run.salaryCut.percent)||!['pending','accepted','rescinded'].includes(run.salaryCut.status)))return false;
  if(!run.stats||!STAT_KEYS.every(k=>Number.isFinite(run.stats[k])&&run.stats[k]>=0&&run.stats[k]<=100))return false;
  if(!run.flags||Array.isArray(run.flags)||typeof run.flags!=='object'||!Object.values(run.flags).every(n=>Number.isInteger(n)&&n>=0&&n<=500))return false;
  if(!Array.isArray(run.history)||run.history.length>300||!Array.isArray(run.seen)||typeof run.pending!=='boolean'||typeof run.completed!=='boolean'||!Number.isInteger(run.pipCount)||run.pipCount<0||!Number.isInteger(run.crisisCooldown))return false;
  if(run.pip&&(!Number.isInteger(run.pip.remaining)||run.pip.remaining<0||run.pip.remaining>3||typeof run.pip.active!=='boolean'))return false;
  if(run.completed){if(run.pending||run.eventId!==null||!ENDINGS.some(e=>e.id===run.endingId&&e.roleId===run.roleId))return false;}else {if(typeof run.eventId!=='string'||!getEvent(run))return false;}
  if(run.pending&&!run.history.length)return false;
  if(run.pendingFamily!==null&&!ENDINGS.some(e=>e.id===`${run.pendingFamily}-${run.roleId}`))return false;
  return run.history.every(h=>h&&typeof h.eventId==='string'&&typeof h.title==='string'&&typeof h.choiceText==='string'&&typeof h.result==='string'&&Array.isArray(h.sourceIds)&&h.delta&&STAT_KEYS.every(k=>Number.isFinite(h.delta[k])&&Math.abs(h.delta[k])<=100));
 }catch{return false;}
}
