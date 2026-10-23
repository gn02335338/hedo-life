// Public badge descriptions stay out of locked cards. These projections read
// committed engine evidence only; they never draw luck or change a replay.
import {deriveActivityPlayV55} from './activity-play-v55.js';
import {deriveShareholderPlayV58} from './shareholders-v58.js';
import {isPatronageApplicationOutcomeV49} from './patronage-v49.js';
import {isPatronageOutcomeV43} from './character-stats.js';
import {isRecruitmentOutcomeV60} from './recruitment-v60.js';

const badge=(id,title,description,group)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`});
export const ACHIEVEMENTS_V60=Object.freeze([
 badge('stock-receipt','願景刷卡，收據留底。','真的付出認股款，取得自己的持股紀錄。願景還沒變現，帳戶已經先收到通知。','wallet'),
 badge('stock-heavy-bag','加碼的不是信心，是生活費。','一次投入五十格存款認股。簡報只有一份，你替那份簡報多留了一大筆錢。','wallet'),
 badge('stock-cash-before-vision','大企業請先，我的房租也很大。','面對員工認股邀請，明確選擇不付款。你沒有獲得股票，也沒有把生活費寄存在上市日期裡。','wallet'),
 badge('shareholder-own-chair','錢進得去，人也進得去。','付過認股款後，拒絕真真的勸退，核對資格並親自走進股東大會。這張椅子終於不用只替你的錢保留。','office'),
 badge('shareholder-proxy-chair','本人回工位，股票代出席。','認股之後接受真真的安排，沒有親自進場。錢仍留在公司，你先回去替公司把工作做完。','office'),
 badge('shareholder-first-objection','異議成立，願景請附檔。','在股東大會第一次拿對文件、對準矛盾的說法。對方終於得回答那張紙，不能只回答你的態度。','craft'),
 badge('shareholder-four-minutes','四個句號，終於有人簽收。','四輪攻防全都提出有效證據，並收好會議紀錄。沒有當場上市，至少四個問題都沒被願景蓋過去。','craft'),
 badge('shareholder-two-followups','這次的之後，各自有編號。','股東大會至少守住兩輪、但沒有全數拿下，最後留下待回覆事項。下次問進度，終於不用先重述人生。','office'),
 badge('shareholder-four-pass','全程在席，問題全留級。','四輪都明確保留發言，直到股東會結束。人親自來了，問題還是坐著等下一班。','office'),
 badge('shareholder-page-mismatch','異議三次，頁碼都在隔壁。','三次拿錯資料，被請去冷靜後收好會議紀錄。這場股東會輸了，工作和股票卻都還在。','office'),
 badge('shareholder-seven-files','七份附件，比股票有流動性。','靠追問補齊四份會場文件，加上原本三份，讓七份資料都進到自己手上。股票還不能賣，附件至少能傳。','craft'),
 badge('shareholder-back-to-work','股東散會，員工繼續。','親自走完股東會，收好紀錄後真的完成一個工作回合。剛才在問公司的錢，現在又要替公司做事。','office'),
 badge('play-arm-eight','八拍打完，阿福還在補充。','腕力互動選穩定八拍，八拍全部對上。你已收手，阿福的正式狀態說明還沒有收尾。','craft'),
 badge('play-arm-twenty-eight','手點二十八下，理由不設上限。','腕力互動中持續出力至少二十八次，撐過六秒以上並交出完整節奏。手可以計次，阿福的但書得另開一張表。','craft'),
 badge('play-arm-stop','計時器跑完，手沒有加班。','開始腕力互動後一次也沒出力，明確交出喊停紀錄。沒有開比就沒有輸贏，紙獎盃先別急著印。','office'),
 badge('play-diet-weekend','行事曆終於有飯，也有空。','減肥活動排好七天正餐，至少三天散步或伸展，週末也留一個休息日。這張表沒有把你當待修專案。','craft'),
 badge('play-road-six','六張名片，沒有自己長零。','Roadshow 的六位訪客全部分流到合適展位。問題有人接，路過的人不用被膨脹成商機。','craft'),
 badge('play-dinner-shared','比目魚有到，白飯不用兼職。','聚餐排出六道共享菜，三種菜色都有、沒有超出公司預算。每個盤子真的有東西，不必靠白飯扮演全席。','office'),
 badge('play-banquet-twelve','十二拍內，願景禁止插播。','First Love 互動十二拍全部接上。傑克和水蛇把副歌唱完，簡報這次沒有找到下一頁。','banquet'),
 badge('play-basket-five','傳球不用再跑一輪會簽。','球局五波全部對上空檔與配合。阿福繞他的路，歐文飛他的，你讓球先找到隊友。','craft'),
 badge('play-basket-sonny-bench','迷宮出口，在板凳那邊。','球局真的碰上阿福而受傷，接著選擇坐下補水、不再上場。理由讓他說完，自己的身體先帶離路線。','office'),
 badge('play-basket-owen-bench','飛天拐子，地面先停班。','球局真的碰上歐文而受傷，接著選擇坐下補水、不再上場。比分可以等，這回沒有拿瘀青換鬥志。','office'),
 badge('play-review-four','四題四份，雨傘不用答辯。','政府專案審查的四個問題全部放對佐證。正式結果仍待通知，這一輪至少不用請雨傘代答。','craft'),
 badge('kin-direct-son','職缺先保密，乾兒子先報到。','接受直接任用為乾兒子的錄取條件，完成報到。職稱確實登記了，瑞克的歡迎詞卻沒有排進流程。','career'),
 badge('kin-direct-daughter','組織圖多一格，親戚少一位。','接受直接任用為乾女兒的錄取條件，完成報到。這份任用沒有血緣證明，倒是先有一張新的工作證。','career'),
 badge('kin-offer-declined','這份親情，謝絕錄取。','拿到特殊任用邀請後，在報到時明確拒絕。工作證沒領，稱謂也沒有替你決定人生。','career'),
 badge('kin-rick-boundary','同是自己人，請先排隊。','以新任用身分面對瑞克的歡迎，要求把職責和界線寫清楚。多一個自己人，沒有自動多一個替他接電話的人。','office'),
 badge('kin-princess-english','Sure. Please put it in writing.','和公主完成英文對話，明確要求工作負責人與期限。英文沒有變簡單，至少這次的工作分配有了主詞。','craft'),
 badge('kin-application-approved','我錄取了，瑞克沒同意。','透過正式應徵流程獲得乾兒子或乾女兒任用，同時收到瑞克的冷臉。核准欄有簽名，同梯欄沒有掌聲。','career'),
 badge('kin-application-rejected','職缺沒上，黑名單先上。','正式應徵特殊任用卻遭拒絕，瑞克仍因此降低好感。工作沒有換到，競爭關係倒是先建好了。','career'),
 badge('kin-upward-applause','階級向上，語氣自動調整。','特殊任用後，對翅膀或董事長諂媚，真的得到正面回應。這次向上的音量，和對同事說話時不太一樣。','office'),
 badge('kin-downward-rebound','名片很大，對方照樣回嘴。','特殊任用後，對同事擺架子，卻當場被反嗆或被回報。自己人的身分沒有附全公司靜音權。','office')
]);

const committed=row=>Boolean(row&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&Number.isInteger(row.turn)&&row.turn>=0&&typeof row.result==='string'&&row.result.trim()&&typeof row.choiceText==='string'&&row.choiceText.trim()&&Array.isArray(row.breakdown));
const laterWork=(history,index)=>history.some((row,at)=>at>index&&committed(row)&&['daily','fantasy'].includes(row.kind)&&!row.verbalOutcome&&!row.recruitmentOutcome);
const strictKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const rawChoice=(run,row)=>run.actions.some(action=>action?.type==='choice'&&action.eventId===row.eventId&&action.index===row.choiceIndex);

// The verbal decision resolver records the original onboarding result, but its
// raw action names the explicit decision screen. Match that narrow alias to
// its own spoken origin and intervening canonical conversations; a decision in
// another scene, or a source row without a committed decision, proves nothing.
function recruitmentDecisionAlias(run,history,index,row){
 if(row.eventId!=='onboarding'||row.kind!=='onboarding'||row.speaker!=='wing'||![0,2].includes(row.choiceIndex)||!isRecruitmentOutcomeV60(run,row))return false;
 const labels={ignored:'對方沒有接招',relationship:'關係當場冷掉',retort:'原話反嗆回來',support:'有人補上前情',legal:'進入正式說明'};
 const aftermathChoices={'verbal-v32-aftermath':[3],'verbal-v2-legal':[0,1,2],'verbal-v2-legal-result':[0]};
 const verbalActions=run.actions.map((action,at)=>({action,at})).filter(item=>item.action?.type==='verbal');let speech=0;
 for(let sourceIndex=0;sourceIndex<index;sourceIndex++){
  const source=history[sourceIndex],proof=source?.verbalOutcome;
  if(proof?.version!==2)continue;
  const actual=verbalActions[speech++],action=actual?.action;
  if(!committed(source)||source.eventId!=='onboarding'||source.kind!=='onboarding'||source.choiceIndex!==3||source.turn!==row.turn||!strictKeys(proof,['version','kind','target','affinityDelta','origin','phase'])||proof.origin!=='onboarding'||proof.phase!=='event'||!Object.hasOwn(labels,proof.kind)||!['wing','hope','rick'].includes(proof.target)||source.speaker!==proof.target||!Number.isInteger(proof.affinityDelta)||proof.affinityDelta< -60||proof.affinityDelta>12||source.eventOutcome?.label!=='這句話說出口之後'||source.eventOutcome.result!==labels[proof.kind])continue;
  const actionKeys=Object.hasOwn(action||{},'target')?['type','eventId','phase','version','target']:['type','eventId','phase','version'];
  if(!strictKeys(action,actionKeys)||action.version!==2||action.eventId!=='onboarding'||action.phase!=='event'||(action.target??'wing')!==proof.target)continue;
  let decisionAt=actual.at+1;
  while(decisionAt<run.actions.length&&run.actions[decisionAt]?.type==='choice'&&Object.hasOwn(aftermathChoices,run.actions[decisionAt].eventId))decisionAt++;
  const decision=run.actions[decisionAt],between=run.actions.slice(actual.at+1,decisionAt),records=history.slice(sourceIndex+1,index);
  const sequence=proof.kind==='legal'?['verbal-v32-aftermath','verbal-v2-legal','verbal-v2-legal-result']:['verbal-v32-aftermath'];
  if(!strictKeys(decision,['type','eventId','index'])||decision.type!=='choice'||decision.eventId!=='verbal-v2-decision'||decision.index!==(row.choiceIndex===0?0:1)||between.length!==sequence.length||between.length!==records.length)continue;
  if(between.every((item,at)=>strictKeys(item,['type','eventId','index'])&&item.type==='choice'&&item.eventId===sequence[at]&&aftermathChoices[item.eventId].includes(item.index)&&committed(records[at])&&records[at].kind==='verbal'&&records[at].eventId===item.eventId&&records[at].choiceIndex===item.index&&records[at].turn===row.turn&&records[at].speaker===proof.target))return true;
 }
 return false;
}

function shareholderFacts(run,history){
 const actions=run.actions.filter(action=>action?.type==='shareholder-play'||action?.type==='choice'&&/^shareholder58-/.test(action.eventId||''));
 const facts=[];let cursor=0;
 for(const [index,row]of history.entries()){
  if(!/^shareholder58-/.test(row?.eventId||''))continue;
  const action=actions[cursor++],proof=row.shareholderOutcome;
  if(!committed(row)||row.kind!=='shareholder'||!strictKeys(proof,['version','stage','round','mode','done','label'])||proof.version!==1||!Number.isInteger(proof.round)||proof.round<0||proof.round>3||typeof proof.done!=='boolean'||typeof proof.label!=='string'||!proof.label||action?.eventId!==row.eventId||row.eventOutcome?.result!==proof.label||row.eventOutcome.label!==(proof.stage==='hearing'?'股東會攻防結果':'股東支線結果'))continue;
  if(proof.stage==='hearing'){
   if(row.eventId!==`shareholder58-hearing-${proof.round}`||action.type!=='shareholder-play'||action.version!==1||row.choiceIndex!==0)continue;
   try{const input=deriveShareholderPlayV58(action.input);if(proof.mode!==input.mode)continue;facts.push({row,index,proof,input});}catch{}
  }else if(['offer','gate','finish'].includes(proof.stage)&&row.eventId===`shareholder58-${proof.stage}`&&proof.mode==='choice'&&action.type==='choice'&&action.index===row.choiceIndex)facts.push({row,index,proof,input:null});
 }
 return facts;
}

function interactiveFacts(run,history){
 const actions=run.actions.filter(action=>action?.type==='activity-play');let cursor=0;const facts=[];
 for(const [index,row]of history.entries()){
  const evidence=row?.activityOutcome?.performance;if(evidence===undefined)continue;
  const action=actions[cursor++],activity=row.activityOutcome;
  if(!committed(row)||row.kind!=='activity'||row.choiceIndex!==1||activity.version!==1||activity.stage!==1||row.eventId!==`activity44-${activity.id}-1`||action?.version!==1||action.eventId!==row.eventId||action.index!==1||!strictKeys(evidence,['version','grade','score','summary','measures','injured','injuryTarget'])||evidence.version!==1||typeof evidence.injured!=='boolean'||row.eventOutcome?.label!=='活動結果'||row.eventOutcome.result!==activity.label)continue;
  try{
   const played=deriveActivityPlayV55(action.input,activity.id);
   if(evidence.grade!==played.grade||evidence.score!==played.score||evidence.summary!==played.summary||row.choiceText!==played.summary||JSON.stringify(evidence.measures)!==JSON.stringify(played.measures)||evidence.injured&&(!['sonny','owen'].includes(evidence.injuryTarget)||activity.label!=='這波碰撞，先下場休息')||!evidence.injured&&(evidence.injuryTarget!==null||activity.label==='這波碰撞，先下場休息')||activity.id!=='basketball'&&evidence.injured)continue;
   facts.push({row,index,id:activity.id,input:played.input,played,performance:evidence});
  }catch{}
 }
 return facts;
}

export function deriveAchievementsV60(run){
 if(!run||typeof run!=='object'||!Array.isArray(run.actions)||!Array.isArray(run.history))return [];
 const history=run.history,ids=new Set(),add=(id,yes)=>{if(yes)ids.add(id);};
 const stock=shareholderFacts(run,history),purchase=stock.find(item=>item.proof.stage==='offer'&&[0,1].includes(item.row.choiceIndex)&&item.proof.label==='認股款已支付'&&item.row.delta?.cash===-(item.row.choiceIndex===0?35:50));
 add('stock-receipt',purchase);add('stock-heavy-bag',purchase?.row.choiceIndex===1);
 add('stock-cash-before-vision',stock.some(item=>item.proof.stage==='offer'&&[2,3].includes(item.row.choiceIndex)&&item.proof.label==='這次沒有認股'&&item.row.delta?.cash===0));
 const admitted=purchase&&stock.find(item=>item.index>purchase.index&&item.proof.stage==='gate'&&[1,2].includes(item.row.choiceIndex)&&item.proof.label==='股東大會開始');
 add('shareholder-own-chair',admitted);
 add('shareholder-proxy-chair',purchase&&stock.some(item=>item.index>purchase.index&&item.proof.stage==='gate'&&item.row.choiceIndex===0&&item.proof.label==='你接受了勸退'));
 const hearing=admitted?stock.filter(item=>item.index>admitted.index&&item.proof.stage==='hearing'):[],successes=hearing.filter(item=>item.input.mode==='present'&&item.proof.label==='異議成立｜說法與附件對不上'),wins=new Set(successes.map(item=>item.proof.round)),finish=admitted&&stock.find(item=>item.index>admitted.index&&item.proof.stage==='finish'&&item.row.choiceIndex===0&&item.proof.label==='這場股東會已結束');
 add('shareholder-first-objection',successes.length>0);
 add('shareholder-four-minutes',finish&&wins.size===4);
 add('shareholder-two-followups',finish&&wins.size>=2&&wins.size<4);
 add('shareholder-four-pass',finish&&new Set(hearing.filter(item=>item.input.mode==='yield').map(item=>item.proof.round)).size===4);
 const mismatches=hearing.filter(item=>item.input.mode==='present'&&item.proof.label==='異議沒有對上這一句');
 add('shareholder-page-mismatch',finish&&mismatches.length===3&&mismatches.at(-1).proof.done);
 const clues=[[0,[0]],[1,[1]],[2,[0,1]],[3,[1,2]]];
 add('shareholder-seven-files',clues.every(([round,statements])=>hearing.some(item=>item.input.mode==='press'&&item.proof.round===round&&statements.includes(item.input.statement))));
 add('shareholder-back-to-work',finish&&laterWork(history,finish.index));

 const plays=interactiveFacts(run,history);
 for(const fact of plays){
  const {id,input,played,performance,index}=fact,m=played.measures;
  if(id==='arm'){
   add('play-arm-eight',input.mode==='steady'&&m.hits===8);
   add('play-arm-twenty-eight',input.mode==='tap'&&m.taps>=28&&m.span>=6000&&played.grade===2);
   add('play-arm-stop',input.mode==='tap'&&input.taps.length===0&&fact.row.activityOutcome.label==='你喊停，這場沒有開比');
  }
  if(id==='diet')add('play-diet-weekend',m.meals===7&&m.active>=3&&[5,6].some(day=>input.days[day].exercise===2));
  if(id==='roadshow')add('play-road-six',m.hits===6);
  if(id==='dinner')add('play-dinner-shared',m.fed===6&&m.variety===3&&m.cost<=m.budget);
  if(id==='banquet')add('play-banquet-twelve',m.hits===12);
  if(id==='basketball'){
   add('play-basket-five',m.hits===5);
   const rested=history.some((row,at)=>at>index&&committed(row)&&row.kind==='activity'&&row.eventId==='activity44-basketball-2'&&row.turn===fact.row.turn&&row.choiceIndex===1&&row.activityOutcome?.version===1&&row.activityOutcome.id==='basketball'&&row.activityOutcome.stage===2&&row.activityOutcome.done===true&&rawChoice(run,row));
   if(performance.injured&&rested)add(`play-basket-${performance.injuryTarget}-bench`,true);
  }
  if(id==='review')add('play-review-four',m.hits===4);
 }

 for(const [index,row]of history.entries()){
  if(!committed(row)||!rawChoice(run,row)&&!recruitmentDecisionAlias(run,history,index,row))continue;
  if(isRecruitmentOutcomeV60(run,row)){
   const outcome=row.recruitmentOutcome;
   add(`kin-direct-${outcome.variant}`,outcome.kind==='appointment'&&row.eventId==='onboarding'&&[0,1].includes(row.choiceIndex));
   add('kin-offer-declined',outcome.kind==='declined'&&row.eventId==='onboarding'&&row.choiceIndex===2);
   add('kin-rick-boundary',outcome.kind==='welcome'&&outcome.target==='rick'&&row.eventId==='recruitment60-rick'&&row.choiceIndex===0);
   add('kin-princess-english',outcome.kind==='welcome'&&outcome.target==='princess'&&row.eventId==='recruitment60-princess'&&row.choiceIndex===0);
  }
  if(isPatronageApplicationOutcomeV49(run,row)){
   add('kin-application-approved',row.patronageApplicationOutcome.result==='appointed');
   add('kin-application-rejected',row.patronageApplicationOutcome.result==='rejected');
  }
 }
 for(const row of history){
  if(!committed(row)||!isPatronageOutcomeV43(run,row)||!run.actions.some(action=>action?.type==='patronage-reply'&&action.version===1&&action.eventId===row.patronageOutcome.origin&&action.target===row.patronageOutcome.target))continue;
  const outcome=row.patronageOutcome;
  add('kin-upward-applause',outcome.mode==='flattery'&&outcome.reaction==='welcomed'&&outcome.affinityDelta>0);
  add('kin-downward-rebound',outcome.mode==='entitled'&&['retort','reported'].includes(outcome.reaction)&&outcome.affinityDelta<0);
 }
 return ACHIEVEMENTS_V60.filter(item=>ids.has(item.id)).map(item=>item.id);
}
