// Only committed, action-matched history earns these souvenirs. Ordinary
// source choices, dreams, actual hits and server-drawn reactions stay distinct.
import {ACHIEVEMENT_STORIES_V66} from './achievement-stories-v66.js';
import {EVENTS} from './events.js';
import {PERSONAS,displayPersona} from './persona.js';
import {ROLES} from './roles.js';
import {buildEndingReport} from './ending-report.js';
import {isMealOutcomeV36} from './character-stats.js';
import {resolvedRageAttempts} from './rage-achievements.js';
import {isEventDepartureOutcomeV63} from './event-departure-v63.js';
import {isOfficeTreatOutcomeV61} from './office-treats-v61.js';
import {isExpansionV65} from './expansion-profile-v65.js';
import {isExpansionV66} from './expansion-profile-v66.js';

const badge=spec=>Object.freeze({id:spec.id,title:spec.title,description:spec.description,group:spec.group,image:`./assets/achievements/${spec.id}.svg`,...(spec.mode?{mode:spec.mode}:{})});
const name=id=>displayPersona(id)?.name||'這位同事';
// This published catalog keeps its 28-person ID order. Later public cast
// additions receive their own additive catalog rather than moving old badges.
const people=Object.freeze(['wing','spencer','erich','sonny','jenjen','rick','kind','hope','jack','meimei','helen','sophie','jonathan','owen','sam','cindy','professor','annie_yu','princess','joyce','janet','captain','zoe','action','hester','simon','james','johnny']),roleName=id=>id==='design'?'產品設計':id==='executive'?'高階主管':ROLES.find(role=>role.id===id)?.name;
const socialKinds=[
 ['warm','飯桌翻到下一頁','和這位角色付費用餐，真的聊得很開，之後仍完成一個工作選擇。吃完這頓飯，工作群組之外也多了一點前情。','wallet','cup'],
 ['mine','便當旁邊還有雷','和這位角色付費用餐，真的踩到聊天雷區，之後仍完成一個工作選擇。便當收好了，那句說錯的話還在腦內加熱。','wallet','storm'],
 ['dream-work','腦內散場，工單繼續','在腦內對這位角色揮拳，回到現實後仍完成一個工作選擇。現場沒人挨打，待辦也沒有憑空消失。','rage','cloud','imagined'],
 ['real-work','這次的後續真的很多','真的對這位角色動手，處理當下後續後仍完成一個工作選擇。沒有把夢境算成實打，也沒把回工位當成責任消失。','rage','shield','real'],
 ['verbal-work','嗆完，交付仍有收件人','對這位角色開嗆，當場被忽略或有人補上前情，之後仍完成工作。這口氣沒有自動替你離職，也沒自動替你做事。','verbal','megaphone'],
 ['three-stories','工位、飯桌與心裡話','同一局完成這位角色主講的工作、正式付費飯局，還曾對他腦內出氣、實際出手或開嗆。三種場合各有紀錄，這段交情沒辦法只靠一張名片解釋。','stories','book']
];
const social=people.flatMap(person=>socialKinds.map(([kind,title,description,group,art,mode])=>({id:`ties-${person.replaceAll('_','-')}-${kind}`,title:`${name(person)}｜${title}`,description:`${name(person)}：${description}`,group,art,mode,kind:'social',person,goal:kind})));

const activities={
 arm:{name:'腕力大賽',plans:['先寫十秒和平手規則','先聽完他的出賽條件','用披薩盒寫規則白皮書'],ends:['保留比賽和聲明的紀錄','替理由伯開記者會','把紙獎盃頒完收隊'],art:'arm'},
 diet:{name:'三隊減肥比賽',plans:['加入強尼隊','加入安妮余隊','加入阿福隊'],ends:['核對自己的七天紀錄','退出公開排名','替蛋塔提名特別獎'],art:'calendar'},
 roadshow:{name:'Roadshow',plans:['準備展示與離線備案','先整理需求','請玩具鵝坐鎮展位'],ends:['交出同意聯絡的名單','核對待辦與承諾','把感謝狀和營收分開'],art:'booth'},
 dinner:{name:'公司聚餐',plans:['先確認每個人吃得到','坐在歐文旁邊看共享菜','替空椅子列編制'],ends:['核對大家是否吃飽','自付加點給同桌分享','替第三盤比目魚申請留職停薪'],art:'fish'},
 banquet:{name:'尾牙',plans:['替兩位主唱舉計分牌','把第二支麥遞給水蛇','用餐巾做搶麥擂台旗'],ends:['約阿良續攤並等到他消失','替阿良安排必須本人出席的續攤','自己吃碗麵再回家'],art:'mic'},
 basketball:{name:'下班球局',plans:['按體力暖身分隊','自付場地與飲水費','把主管職稱留在板凳'],ends:['照配合打完最後一球','主動換人休息','請助理工程師簽核最後一球'],art:'basketball'},
 review:{name:'政府專案審查',plans:['把主張先對上文件','先分好回答範圍','替雨傘列工作分解表'],ends:['留下成果與補件的責任人','先確認新增範圍','替再研究看看編待辦號碼'],art:'folder'},
 camel:{name:'真人駱駝大賽',plans:['核對紙名牌的疊堆規則','請阿福先寫賽前聲明','替玩具鵝掛代理證'],ends:['交回名牌與活動點','把阿福但書貼到名牌背面','任命玩具鵝駱駝理事長'],art:'camel'}
};
const paths=[[0,0],[0,1],[1,0],[1,2],[2,1],[2,2]];
const activity=Object.entries(activities).flatMap(([activityId,data])=>paths.map(([setup,finish],index)=>({id:`outing-${activityId}-${['one','two','three','four','five','six'][index]}`,title:`${data.name}｜${data.plans[setup]}，${data.ends[finish]}`,description:`先${data.plans[setup]}，真的提交現場互動，再${data.ends[finish]}。${activityId==='camel'?'六輪都要揭曉，提前退出不補名次。':activityId==='diet'?'七天行事曆真的交出，沒有替別人填身體資料。':'開場、操作與收尾各有紀錄，旁聽或中途離場不算完成這條路。'}`,kind:'activity',activityId,setup,finish,group:activityId==='banquet'?'banquet':'activities',art:data.art})));

const advanced=[
 ['finance-own-share','不是只有口頭大股東','付出認股款後，親自進場並完整走完股東會；付款紀錄和自己的發問，都確實留了下來。','wallet','receipt'],
 ['finance-loan-first','信貸第一期，願景沒有代扣','用信貸參加員工認股後，真的靠完成工作償還第一期。股東會、休息與離場都不拿來刷還款期數。','wallet','coins'],
 ['finance-loan-two','第二期照扣，上市照等','認股信貸已實際償還兩期。每一期都有完成工作作依據，沒有把觀看簡報當成薪資來源。','wallet','calendar'],
 ['finance-loan-four','四期帳單，比里程碑準時','認股信貸已實際償還四期。你等過幾次上市進度，還款欄倒是確實往前。','wallet','calendar'],
 ['finance-loan-paid','這次結清的不是願景','在仍有持股的這局，完整還清認股信貸。股份沒有因此自動變現，但這張借款帳單終於能收起來。','wallet','shield'],
 ['finance-loan-exit','門禁交了，帳單沒交出去','完成離場時，認股信貸仍有未償餘額。故事清楚保留這筆債，沒有用離職畫面把它擦掉。','wallet','door'],
 ['finance-cut-and-care','薪資打折，生活不清倉','接受降薪後，仍付費用過兩種不同的自我照顧安排。你調整帳本，也替自己保留不同的喘息方式。','wallet','wallet'],
 ['finance-raise-and-share','加薪有生效，認股有匯款','正式談薪實際提高月薪，也確實付出認股款。兩件事各有生效紀錄，不是把口頭承諾當現金，也不是把投資當成保證。','wallet','receipt'],
 ['finance-meal-after-loan','利息在走，晚餐照吃','認股信貸尚未還清時，仍付費和同事正式吃過一餐。餐費與還款分開記，聊天不會抵掉貸款。','wallet','cup'],
 ['finance-five-expenses','五種自救，不是一張報帳單','同一局實付五種不同的休息、進修、備份或飯局安排。每種都真的扣款，免費取消不湊數。','wallet','wallet'],
 ['finance-evidence-under-cut','薪水少了，備份還在','接受降薪後，實付存款備份工作紀錄。公司刪的是薪資欄，你沒有順便把自己的前後文刪掉。','wallet','folder'],
 ['finance-cheap-and-expensive','同一局，兩種餐費哲學','同一局正式付過低於二十格與至少二十格的餐費。吃到的是不同場合，不是用同一張單據改金額。','wallet','fish'],
 ...ROLES.map(role=>[`step-${role.id.replaceAll('_','-')}`,`${roleName(role.id)}｜下一階真的生效`,`實際以${roleName(role.id)}的職涯工作，透過已結算的升遷談話換到新職稱。起手就是主管、只開升遷選單或口頭說以後再談，都不算這一步。`,'professions','badge']),
 ['tradeoff-work','本事長了，掌聲不加班','一個已結算工作選擇真的提高工作能力，同時降低偷懶和舔老闆能力。三頭馬車這次確實拉扯，沒有只看最後一張高分表。','craft','laptop'],
 ['tradeoff-slack','省電模式，也有取捨','一個已結算工作選擇提高偷懶能力，同時降低工作與舔老闆能力。把時間留給自己，另外兩份履歷也如實記下代價。','craft','chair'],
 ['pip-three-deliveries','改善期的三張交付回條','同一期 PIP 真的完成三個工作回合，最後通過評核。沒有把休息、股東會或擅自離場算成改善成果。','career','folder'],
 ['pip-one-absence-pass','缺席一格，剩下的真的補上','同一期 PIP 有一次已記錄的事件離場，最後仍通過評核。缺席沒有被刪，通過也沒有拿假的工作回合補出來。','career','calendar'],
 ['pip-two-absence-fail','改善表有兩格空白','同一期 PIP 兩次擅自離開工作，最後評核未通過。不是看過兩張結果就算做了兩天工作。','career','door'],
 ['pip-floor-two','三樓第二天，門還是那扇','通過 PIP 後被調到看門勤務，確實完成兩個不同工作日的守候。離開當下事件不冒充值班，門也不替你寫考績。','career','door'],
 ['pip-pass-warm-meal','改善表收好，菜上桌了','通過 PIP 後，付費飯局真的聊得很開。這次的對話不用附績效評分，餐桌也沒有改善期限。','career','cup'],
 ['pip-pass-raise','改善過了，數字也能再談','通過 PIP 後，正式談薪獲得並接受有生效數字的加薪。公司不能只留下你被要求改善的那一頁。','career','coins'],
 ['leave-work-twice','今天的順便，先缺席兩次','同一局兩次明確離開工作事件。時間照樣過去，沒有多領兩天薪水，也沒有冒出兩份已交付成果。','office','door'],
 ['leave-three-kinds','退場，也有三種場合','同一局從三種不同場合明確離開。它們各自記錄結果，沒有把所有「先走」都翻譯成自願離職。','office','door'],
 ['leave-camel-midway','骰袋還有顏色，我先下車','駱駝比賽至少已揭曉兩輪、尚未六輪時離場。已發生的點數留下，沒擲的骰子沒有替你補完。','activities','camel'],
 ['leave-blockchain-files','這條鏈，我在送件後下車','區塊鏈計畫已正式處理報告與申請資料後，明確退出後續。送過的經過仍留著，沒有把離場寫成計畫成功上線。','office','folder'],
 ['leave-private-work','那晚先走，隔天還做事','從私人活動或飯局明確離場，之後仍完成工作。當晚的退出沒有自動變成隔天的人事通知。','office','calendar'],
 ['leave-before-appointment','名牌未領，自己先選門','尚未接受報到任用，就明確離開當下場合。這份紀錄是拒絕錄取安排，不是假裝入職後又領了一輪報到章。','office','badge'],
 ['tea-private-after-cancel','公司取消，傑克照樣請','公司下午茶已因拿錯杯被取消後，仍真的喝到傑克私下請的飲料。兩張訂單各有主人，沒有把他的請客算成公司恢復福利。','office','cup'],
 ['cake-back-to-work','蛋糕退冰，工作沒失憶','完整處理過生日蛋糕插曲後，確實完成另一個工作選擇。切蛋糕的那一段沒有偷算成多上一天班。','banquet','cake'],
 ['treat-three-stories','今天的茶水間，有三本史冊','同一局完整經歷傑克飲料、公司下午茶與生日蛋糕三段插曲。看過開場不算走完，取消其中一幕也不補發收尾。','office','cake']
].map(([id,title,description,group,art])=>({id,title,description,group,art,kind:'advanced'}));

export const ACHIEVEMENT_RULES_V66=Object.freeze([...ACHIEVEMENT_STORIES_V66,...social,...activity,...advanced].map(Object.freeze));
if(ACHIEVEMENT_RULES_V66.length!==750)throw Error(`Invalid v66 achievement count: ${ACHIEVEMENT_RULES_V66.length}`);
export const ACHIEVEMENTS_V66=Object.freeze(ACHIEVEMENT_RULES_V66.map(badge));
export const ACHIEVEMENT_COUNTS_V66=Object.freeze({characterStories:336,professionStories:156,relationships:168,activities:48,finance:12,careerAndAbilities:15,otherMilestones:15});
const authored=new Map(EVENTS.map(event=>[event.id,event]));
const isWork=row=>['daily','fantasy'].includes(row?.kind)&&!row.verbalOutcome&&!row.departureOutcome;
const ordinary=row=>row&&row.kind!=='event-departure'&&!row.verbalOutcome&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&typeof row.choiceText==='string'&&row.choiceText.trim()&&typeof row.result==='string'&&row.result.trim();
const laterWork=(history,index)=>history.some((row,at)=>at>index&&isWork(row));
const scopePrivate=id=>/^meal-|^activity44-(?:arm|diet|dinner|banquet|basketball|camel)-/.test(id||'')||['kind-workday','kind-break','banquet-afterparty'].includes(id);

export function deriveAchievementsV66(run){
 if(!/^e(?:12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||'')||!Array.isArray(run.history)||!Array.isArray(run.actions)||!run.history.length)return [];
 const report=buildEndingReport(run);if(!report.metadata.complete)return [];
 const history=run.history,normal=history.map((row,index)=>({row,index})).filter(({row})=>ordinary(row)&&isWork(row)),rage=resolvedRageAttempts(run).filter(item=>item.origin),meals=history.map((row,index)=>({row,index})).filter(({row})=>isMealOutcomeV36(run,row)&&row.delta.cash<0);
 const speechActions=run.actions.filter(action=>action.type==='verbal'),speeches=[];let speechCursor=0;
 for(const [index,row]of history.entries())if(row.verbalOutcome){const action=speechActions[speechCursor++],e=row.verbalOutcome;if(e.version===2&&action?.version===2&&row.speaker===e.target&&Object.hasOwn(PERSONAS,e.target)&&e.origin===action.eventId&&e.phase===action.phase&&(!Object.hasOwn(action,'target')||action.target===e.target)&&['ignored','relationship','retort','support','personnel','legal'].includes(e.kind)&&Number.isInteger(e.affinityDelta)&&row.eventOutcome?.label==='這句話說出口之後')speeches.push({index,e,row});}
 const plays=history.map((row,index)=>({row,index})).filter(({row})=>row.kind==='activity'&&row.activityOutcome?.version===1&&row.activityOutcome.stage===1&&row.activityOutcome.performance?.version===1);
 const stock=history.map((row,index)=>({row,index})).filter(({row})=>ordinary(row)&&row.kind==='shareholder'&&row.shareholderOutcome?.version===1),care=history.map((row,index)=>({row,index})).filter(({row})=>ordinary(row)&&row.kind==='self-care'&&row.delta.cash<0),cuts=history.map((row,index)=>({row,index})).filter(({row,index})=>ordinary(row)&&/^salary-/.test(row.eventId)&&row.pay<(history[index-1]?.pay??row.pay));
 const raises=history.map((row,index)=>({row,index})).filter(({row,index})=>ordinary(row)&&/^raise-/.test(row.eventId)&&row.pay>(history[index-1]?.pay??row.pay));
 const leaves=history.map((row,index)=>({row,index})).filter(({row})=>isEventDepartureOutcomeV63(run,row));
 const treats=history.map((row,index)=>({row,index})).filter(({row})=>isOfficeTreatOutcomeV61(run,row));
 const pipPassed=history.findIndex(row=>ordinary(row)&&row.eventId==='pip-review'&&row.chanceOutcome==='success'),pipFailed=history.findIndex(row=>ordinary(row)&&row.eventId==='pip-review'&&row.chanceOutcome==='setback');
 const earned=[];
 for(const spec of ACHIEVEMENT_RULES_V66){let yes=false;
  if(spec.kind==='character'||spec.kind==='profession')yes=normal.some(({row})=>row.eventId===spec.eventId&&row.choiceIndex===spec.choiceIndex&&row.speaker===spec.speaker&&(spec.kind!=='profession'||run.actualRoleId===spec.owner)&&(!authored.get(row.eventId)?.requiresCastV66||isExpansionV66(run)));
  else if(spec.kind==='social'){
   if(spec.goal==='warm'||spec.goal==='mine')yes=meals.some(({row,index})=>row.mealOutcome.target===spec.person&&row.mealOutcome.reaction===spec.goal&&laterWork(history,index));
   if(spec.goal==='dream-work'||spec.goal==='real-work')yes=rage.some(item=>item.person===spec.person&&item.mode===(spec.goal==='dream-work'?'imagined':'real')&&laterWork(history,item.historyIndex));
   if(spec.goal==='verbal-work')yes=speeches.some(item=>item.e.target===spec.person&&['ignored','support'].includes(item.e.kind)&&laterWork(history,item.index));
   if(spec.goal==='three-stories')yes=normal.some(item=>item.row.speaker===spec.person)&&meals.some(item=>item.row.mealOutcome.target===spec.person)&&(rage.some(item=>item.person===spec.person)||speeches.some(item=>item.e.target===spec.person));
  }else if(spec.kind==='activity'){
   const finish=history.findIndex(row=>ordinary(row)&&row.kind==='activity'&&row.activityOutcome?.id===spec.activityId&&row.activityOutcome.done===true&&row.choiceIndex===spec.finish);
   const setup=history.findIndex((row,index)=>index<finish&&ordinary(row)&&row.kind==='activity'&&row.activityOutcome?.id===spec.activityId&&row.activityOutcome.stage===0&&row.choiceIndex===spec.setup);
   const submitted=plays.filter(item=>item.index>setup&&item.index<finish&&item.row.activityOutcome.id===spec.activityId);
   yes=finish>=0&&setup>=0&&submitted.length>0&&(spec.activityId!=='camel'||submitted.length===6&&submitted.at(-1).row.activityOutcome.camel?.done===true)&&(spec.activityId!=='diet'||isExpansionV65(run));
  }else{
   const id=spec.id,purchase=stock.find(item=>item.row.shareholderOutcome.stage==='offer'&&item.row.delta.cash<0),loanPayments=history.flatMap(row=>row.breakdown||[]).filter(part=>part.source==='shareholder-loan'&&part.delta?.cash<0),loan=run.shareholderLoan,loanPaid=loanPayments.reduce((sum,part)=>sum-part.delta.cash,0);
   if(id==='finance-own-share')yes=!!purchase&&stock.some(item=>item.index>purchase.index&&item.row.shareholderOutcome.stage==='hearing')&&stock.some(item=>item.index>purchase.index&&item.row.shareholderOutcome.stage==='hearing'&&item.row.shareholderOutcome.round===3&&item.row.shareholderOutcome.done)&&stock.some(item=>item.index>purchase.index&&item.row.shareholderOutcome.stage==='finish');
   if(id==='finance-loan-first')yes=!!purchase&&loanPaid>=12;
   if(id==='finance-loan-two')yes=!!purchase&&loanPaid>=24;
   if(id==='finance-loan-four')yes=!!purchase&&loanPaid>=48;
   if(id==='finance-loan-paid')yes=!!purchase&&loanPayments.length>0&&loan?.remaining===0;
   if(id==='finance-loan-exit')yes=!!purchase&&loan?.remaining>0&&run.completed===true;
   if(id==='finance-cut-and-care')yes=cuts.some(cut=>new Set(care.filter(item=>item.index>cut.index).map(item=>`${item.row.eventId}/${item.row.choiceIndex}`)).size>=2);
   if(id==='finance-raise-and-share')yes=!!purchase&&raises.length>0;
   if(id==='finance-meal-after-loan')yes=!!purchase&&loan?.total>0&&meals.some(item=>item.index>purchase.index&&history.slice(0,item.index+1).flatMap(row=>row.breakdown||[]).filter(part=>part.source==='shareholder-loan').reduce((paid,part)=>paid-Math.min(0,part.delta?.cash||0),0)<loan.total);
   if(id==='finance-five-expenses')yes=new Set([...care,...meals].map(item=>`${item.row.eventId}/${item.row.choiceIndex}`)).size>=5;
   if(id==='finance-evidence-under-cut')yes=cuts.some(cut=>care.some(item=>item.index>cut.index&&item.row.eventId==='self-care'&&item.row.choiceIndex===3&&/備份/.test(item.row.choiceText)));
   if(id==='finance-cheap-and-expensive')yes=meals.some(item=>-item.row.delta.cash<20)&&meals.some(item=>-item.row.delta.cash>=20);
   if(id.startsWith('step-'))yes=run.actualRoleId===id.slice(5)&&history.some(row=>ordinary(row)&&row.eventId==='career-review'&&row.chanceOutcome==='success'&&/職稱變更/.test(row.result));
   if(id==='tradeoff-work')yes=normal.some(({row})=>row.delta.skill>0&&row.delta.slack<0&&row.delta.lick<0);
   if(id==='tradeoff-slack')yes=normal.some(({row})=>row.delta.slack>0&&row.delta.skill<0&&row.delta.lick<0);
   if(id.startsWith('pip-')){
    const review=pipPassed>=0?pipPassed:pipFailed,start=history.findLastIndex((row,index)=>index<review&&ordinary(row)&&['crisis-boss','paperwork'].includes(row.eventId)&&row.choiceIndex===2&&/PIP|改善/.test(row.result)),missed=leaves.filter(item=>item.index>start&&item.index<review&&item.row.departureOutcome.workDaySpent),delivered=normal.filter(item=>item.index>start&&item.index<review);
    if(id==='pip-three-deliveries')yes=pipPassed>=0&&start>=0&&delivered.length>=3&&missed.length===0;
    if(id==='pip-one-absence-pass')yes=pipPassed>=0&&start>=0&&missed.length===1;
    if(id==='pip-two-absence-fail')yes=pipFailed>=0&&start>=0&&missed.length===2;
    if(id==='pip-floor-two')yes=pipPassed>=0&&new Set(normal.filter(item=>item.index>pipPassed&&item.row.eventId.startsWith('watch-')).map(item=>item.row.turn)).size>=2;
    if(id==='pip-pass-warm-meal')yes=pipPassed>=0&&meals.some(item=>item.index>pipPassed&&item.row.mealOutcome.reaction==='warm');
    if(id==='pip-pass-raise')yes=pipPassed>=0&&raises.some(item=>item.index>pipPassed);
   }
   if(id==='leave-work-twice')yes=leaves.filter(item=>item.row.departureOutcome.category==='work').length>=2;
   if(id==='leave-three-kinds')yes=new Set(leaves.map(item=>item.row.departureOutcome.category)).size>=3;
   if(id==='leave-camel-midway')yes=leaves.some(item=>item.row.eventId==='activity44-camel-1'&&plays.filter(play=>play.index<item.index&&play.row.activityOutcome.id==='camel').length>=2&&!plays.some(play=>play.index<item.index&&play.row.activityOutcome.camel?.done));
   if(id==='leave-blockchain-files')yes=leaves.some(item=>item.row.departureOutcome.category==='blockchain'&&history.some((row,index)=>index<item.index&&row.blockchainOutcome?.stage===1));
   if(id==='leave-private-work')yes=leaves.some(item=>scopePrivate(item.row.departureOutcome.sourceEventId)&&laterWork(history,item.index));
   if(id==='leave-before-appointment')yes=leaves.some(item=>item.row.departureOutcome.category==='onboarding'&&run.completed===true);
   if(id==='tea-private-after-cancel'){const cancelled=treats.find(item=>item.row.treatsOutcome.id==='company-tea'&&item.row.treatsOutcome.stage===1);yes=!!cancelled&&treats.some(item=>item.index>cancelled.index&&item.row.treatsOutcome.id==='jack-drinks'&&item.row.treatsOutcome.done&&/^drinks-delivered-(?!none)/.test(item.row.treatsOutcome.result));}
   if(id==='cake-back-to-work')yes=treats.some(item=>item.row.treatsOutcome.id==='birthday-cake'&&item.row.treatsOutcome.done&&laterWork(history,item.index));
   if(id==='treat-three-stories')yes=['jack-drinks','company-tea','birthday-cake'].every(tale=>treats.some(item=>item.row.treatsOutcome.id===tale&&item.row.treatsOutcome.done&&item.row.treatsOutcome.accepted));
  }
  if(yes)earned.push(spec.id);
 }
 return earned;
}
