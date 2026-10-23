// Achievements observe completed conversations. They never draw randomness,
// change a life, or accept badge IDs/cumulative flags as proof of an incident.
import {PERSONAS} from './persona.js';
import {resolvedRageAttempts} from './rage-achievements.js';
import {isMealOutcomeV36} from './character-stats.js';
import {MEAL_GUEST_IDS_V39} from './meals-cast-v39.js';

const badge=(id,title,description,group,mode)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`,...(mode?{mode}:{})});
export const ACHIEVEMENTS_V48=Object.freeze([
 badge('verbal-still-here-three','罵了三次，門禁還通。','同一局對人開嗆三次，之後又完成一個工作回合。門禁沒有替你講道理，至少今天還肯開門。','verbal'),
 badge('verbal-still-here-five','第五次了，人事還沒換鎖。','同一局對人開嗆五次，之後又完成一個工作回合。你沒有因此自動升職，待辦倒是一項沒少。','verbal'),
 badge('verbal-still-here-eight','本公司最難移除的功能','同一局對人開嗆八次，之後又完成一個工作回合。公司終於有一個經過反覆測試還在運作的東西。','verbal'),
 badge('verbal-no-audience','兩次開砲，無人收件。','同一局兩次對人開嗆都抽到「對方沒有接招」，之後還做完工作。你出了聲，現場卻很像沒有開喇叭。','verbal'),
 badge('verbal-echo-office','辦公室雙聲道','兩次開嗆都被當場反嗆，之後仍完成工作。雙方的音量有成長，辦公室坪數沒有。','verbal'),
 badge('verbal-witnesses','這次有人幫忙接話。','兩次開嗆都有人補上前情，之後仍完成工作。你沒有突然變得客氣，至少不用獨自重播整段經過。','verbal'),
 badge('verbal-three-agendas','每個議程都有我的原話。','在三個不同事件對人開嗆，之後仍完成工作。問題各有主旨，沒有全寄成一封情緒抒發。','verbal'),
 badge('verbal-both-bosses','老闆罵完，董事長請收件。','同一局對翅膀與屎潘蛇都開過嗆，之後仍完成工作。這次收件名單真的有寄到高層。','verbal'),
 badge('verbal-onboard-return','報到第一天，先試麥。','報到時對翅膀開嗆，任用仍完成，後來也做完工作。新人介紹講得有點大聲，但不是只來參觀。','verbal'),
 badge('verbal-salary-return','薪資會議加了音量條。','薪資或加薪談話中開嗆後，仍回去完成工作。數字怎麼談另有紀錄，今天沒有只留下分貝。','verbal'),
 badge('verbal-pip-return','改善口氣？先交付再說。','在 PIP 對話開嗆後，仍回去完成工作。表格可以記你的口氣，也得記你真的做過的事。','verbal'),
 badge('verbal-private-return','下班罵完，上班還是同事。','私人飯局或續攤時對人開嗆，後來仍完成工作。那晚的尷尬留在私下，沒有直接變成離職申請。','verbal'),
 badge('verbal-legal-return','逐字稿收好，打卡照常。','開嗆進入正式說明，走完這輪回覆後，又完成工作。程序仍有紀錄，門禁卡也還在。','verbal'),
 badge('verbal-warning-return','警告收到，附件已交。','開嗆後收到人事談話紀錄，選擇留下，之後完成工作。你沒有把一張警告單簽成離職書。','verbal'),
 badge('verbal-dream-to-words','手放好，這次用嘴。','先在腦內扁過某個人，後來真的對同一人開嗆。幻想沒有冒充現場，說出口的這句另算。','verbal'),
 badge('verbal-words-to-dream','嘴巴講完，腦內補演。','對某個人開嗆之後，又在腦內扁了同一人。現場已經夠吵，後面這場只在你心裡上映。','verbal'),
 badge('verbal-colleague-circuit','跨部門音量測試','同一局對三位不同的非董事長、非翅膀角色開嗆，之後仍完成工作。這張聯絡網的用途有點偏。','verbal'),
 badge('verbal-cold-shoulder','關係冷了，工單還熱。','兩次開嗆讓關係當場冷掉，之後仍完成工作。往來開始靠信，工作可沒有跟著冷藏。','verbal'),
 badge('rage-truce-return','停火後，居然還要上班。','真的動手後談成停火，明確選擇繼續任職，後來也做完工作。後續責任沒有消失，這份工作倒也沒當場消失。','rage','real'),
 badge('rage-private-return','這晚失控，隔天還有班。','私人場合真的動手，走完個人事故的收尾後又完成工作。那一晚得自己處理，公司沒有直接替你決定去留。','rage','real'),
 badge('rage-police-return','筆錄一份，工單一份。','私人場合真的動手，到派出所說明並收好紀錄，後來又完成工作。兩份文件都得面對，沒有互相抵銷。','rage','real'),
 badge('rage-medical-receipt','這張收據不能報公司。','私人場合真的動手，實付十二格存款處理這輪費用，之後又完成工作。原本的續攤預算，換了完全不想收藏的收據。','rage','real'),
 badge('rage-cup-off-duty','保溫杯終於下台。','私人場合真的動手，走完收據記者會、收好各自紀錄，後來又完成工作。杯子沒再當麥克風，你也終於肯散場。','rage','real'),
 badge('dream-trilogy','腦內連映三場','同一局三次衝動都留在腦內。觀眾只有自己，現場沒有因此多出三位受害者。','rage','imagined'),
 badge('dream-three-cast','腦內卡司持續擴編','同一局在腦內扁過三個不同角色。演員名單很長，現實裡沒有人因為這三場戲挨打。','rage','imagined'),
 badge('rage-dream-then-real','這次怎麼沒有醒？','對同一角色先有腦內想像，後來真的動手。第二次沒有沿用夢境的安全距離，得面對真正的後續。','rage','mixed'),
 badge('rage-real-then-dream','這次記得把手放好。','對同一角色真的動手之後，另一次衝動留在腦內。前一次的責任仍在，這一次沒有再把它加上一筆。','rage','mixed'),
 badge('rage-onboard-truce','試用期先試停火協議。','報到時真的對翅膀動手，經協調選擇留下，後來完成工作。名片還很新，檔案夾已經很厚。','rage','real'),
 badge('rage-salary-truce','薪水沒談完，先談停火。','薪資爭議時真的動手，經協調選擇留下，後來完成工作。後續不只要核對月薪，還得核對整場經過。','rage','real'),
 badge('rage-private-mediation','今晚不續攤，改約調解。','私人場合真的動手後，選擇列出雙方能確認的個人調解事項，後來仍完成工作。這次敲定的是後續聯繫，沒有宣布誰獲勝。','rage','real'),
 badge('meal-three-warm','這桌比開會有共識。','同一局吃到三次「聊得很開」。沒有誰主持，也沒人要求把開心改成可衡量的目標。','wallet'),
 badge('meal-two-mines','餐廳沒有標雷區。','同一局兩次用餐都不小心踩雷。菜單的辣度有寫，聊天的沒有。','wallet'),
 badge('meal-same-person-weather','同一張臉，兩種桌況。','和同一角色吃飯，有過聊得很開，也有過踩雷。你終於知道好感不是買餐券就固定附送。','wallet'),
 badge('meal-wing-warm','翅膀今天有好好吃飯。','成功和翅膀吃飯，餐桌結果是「聊得很開」。飯沒有自動變考卷，這頓算你運氣好。','wallet'),
 badge('meal-read-three','已讀回條吃到飽','同一局收到三次「今天約不到」。餐費沒扣，等待的滋味已經很完整。','wallet'),
 badge('meal-rain-check','改天真的有下一集。','曾被某個角色拒絕邀餐，後來真的和同一人坐下用餐。這句「改天」終於有餐具可以驗收。','wallet'),
 badge('meal-after-insult','剛才那句，配飯聊。','對某個角色開嗆後，後來和同一人吃到「聊得很開」。這餐是重新接話，沒有把前一句從紀錄刪掉。','wallet'),
 badge('meal-after-dream','夢裡出拳，現場夾菜。','腦內扁過某個角色，後來和同一人吃到「聊得很開」。筷子拿穩了，這一餐沒有重演。','wallet'),
 badge('meal-three-guests','今天不是同一桌主管。','同一局真正和三位不同角色用過餐。名單翻了幾頁，晚餐終於不只一種談法。','wallet'),
 badge('meal-first-love-break','兩位主唱都先吃飯。','同一局分別和傑克、水蛇正式吃過飯。First Love 可以慢點決鬥，主餐先別放冷。','wallet'),
 badge('care-second-repair','情緒維修，再開一張單。','同一局兩次心情崩潰後，都實付存款安排休整，並再次完成工作。第二次沒有比較便宜，你仍替自己留了預算。','craft'),
 badge('care-unpaid-drink','無薪假後，飲料還是我的。','因心情崩潰請無薪假之後，另一次花錢買喜歡的飲料。公司扣掉的是薪水，沒有代替你決定每天的口味。','wallet'),
 badge('care-raise-party','這杯用真的加薪付。','書面調薪實際增加月薪後，花錢照顧自己。休息、用餐、進修或備份紀錄，這筆預算不用再等「下個季度」。','career'),
 badge('career-cut-raise','先打折，後來談回來。','先接受降薪，後來透過正式談薪實際增加月薪。兩次數字各有紀錄，沒有把口頭安慰算成回補。','career'),
 badge('care-evidence-then-words','開嗆以前，備份已完成。','自費備份工作紀錄後，才對人開嗆。資料先收好，免得事後只剩自己記得。','verbal'),
 badge('care-words-then-evidence','罵完才想到買雲端。','對人開嗆後，再自費備份工作紀錄。這筆支出不能收回原話，至少前後文不必靠記憶補寫。','verbal'),
 badge('care-pip-two-ways','改善表之外，自救有兩欄。','正式 PIP 談話之後，分別花錢補眠和替自己安排休假。公司有改善計畫，你也替自己排了行程。','career'),
 badge('care-sixty','真正有執行的員工福利','同一局在照顧自己、進修、備份紀錄與正式飯局累計實付六十格存款。福利的企劃、出資和受益人，剛好都是你。','wallet'),
 badge('care-goose-three','這位主管連任三次。','同一局三次花錢請玩具鵝主持績效檢討。牠的回覆始終很短，需求也始終沒有追加。','wallet'),
 badge('career-cut-care','月薪打折，自救不撤單。','接受降薪後，仍實付存款照顧自己。休息、進修或備份紀錄，帳都要算清楚；你沒有把自己排成第一個刪除項。','career'),
 badge('activity-arm-whitepaper','十秒賽程，三輪附件。','完整走完腕力賽，先寫十秒規則、真的開比，最後把結果和聲明分開記。比賽可以很短，阿福的補充不行。','office'),
 badge('activity-diet-prize','有蛋塔，還有獎狀。','完整走完減肥活動並拿到紀錄組獎。獎狀核對的是事前選定的習慣紀錄，蛋塔沒有被沒收。','office'),
 badge('activity-diet-special','蛋塔被告，蛋塔獲獎。','完整走完減肥活動，替蛋塔拿到觀察特別獎。牠不是正賽冠軍，倒是終於不用繼續受審。','office'),
 badge('activity-diet-withdraw','退出排行榜，沒有退出午餐。','完整走完減肥活動，主動退出公開排名。散步還能繼續，便當不用再附辯護書。','office'),
 badge('activity-roadshow-limits','展場最稀有的贈品：實話。','完整走完 Roadshow，現場如實回答可驗證範圍，收攤只交有需求且同意聯絡的名單。名片沒有全被灌成營收。','office'),
 badge('activity-fish-share','第三盤不是願景。','公司聚餐最後自付存款，真的加點給同桌分享。這次有價格、有食物，也不用等明年的預算。','office'),
 badge('activity-banquet-ghost-return','阿良消失，我沒曠職。','尾牙散場約阿良續攤，等到他消失，之後仍完成工作。隔天人到公司的，是那個真的等過他的人。','banquet'),
 badge('activity-basketball-assist','助攻不用等主管簽核。','完整走完傑克的球局，成功把球傳給空檔同事。這次交付有人接，成果也有人看見。','office'),
 badge('activity-basketball-rest','換人不是績效改善。','完整走完傑克的球局，最後一波主動換人休息。你還是隊友，沒有因此被要求補一份自評。','office'),
 badge('activity-review-evidence','雨傘不再兼任專案負責人。','完整走完政府專案審查，最後留下可追的證據與待辦。正式結果仍待通知，責任人至少不再全靠眼神指定。','office')
]);

const known=person=>Object.hasOwn(PERSONAS,person||'');
const resolved=row=>row&&row.kind!=='event-departure'&&Number.isInteger(row.choiceIndex)&&row.choiceIndex>=0&&Number.isInteger(row.turn)&&row.turn>=0&&typeof row.result==='string'&&Boolean(row.result.trim())&&typeof row.choiceText==='string'&&Boolean(row.choiceText.trim())&&Array.isArray(row.breakdown);
const work=row=>resolved(row)&&['daily','fantasy'].includes(row.kind)&&!row.verbalOutcome;
const privateOrigin=id=>['kind-break','kind-workday','banquet-afterparty','self-care'].includes(id)||/^meal-(?:with-|guests-)/.test(id||'')||/^activity44-(?:arm|diet|dinner|banquet|basketball)-/.test(id||'');
const salaryOrigin=id=>/^(?:salary-|raise-)/.test(id||'');
const speechLabels=Object.freeze({ignored:'對方沒有接招',relationship:'關係當場冷掉',retort:'原話反嗆回來',support:'有人補上前情',personnel:'人事接手',legal:'進入正式說明'});
const safeSpeechKinds=new Set(['daily','fantasy','onboarding','verbal']);
const later=(rows,index,predicate)=>rows.findIndex((row,at)=>at>index&&predicate(row,at));

function speeches(run,history){
 const actions=(Array.isArray(run.actions)?run.actions:[]).filter(action=>action?.type==='verbal');let cursor=0;const proofs=[];
 for(const [index,row]of history.entries()){
  if(row?.verbalOutcome===undefined)continue;
  const action=actions[cursor++],proof=row.verbalOutcome;
  if(!resolved(row)||proof?.version!==2||!known(proof.target)||row.speaker!==proof.target||proof.origin!==row.eventId||!safeSpeechKinds.has(row.kind)||row.choiceIndex<1||!['event','result'].includes(proof.phase)||!Object.hasOwn(speechLabels,proof.kind)||row.eventOutcome?.label!=='這句話說出口之後'||row.eventOutcome.result!==speechLabels[proof.kind]||!Number.isInteger(proof.affinityDelta)||proof.affinityDelta< -60||proof.affinityDelta>12||action?.version!==2||action.eventId!==proof.origin||action.phase!==proof.phase||Object.hasOwn(action,'target')&&action.target!==proof.target)continue;
  if(proof.phase==='result'&&(row.kind!=='verbal'||!resolved(history[index-1])||history[index-1].eventId!==proof.origin))continue;
  proofs.push({...proof,index,row});
 }
 return proofs;
}

// A return requires a later *committed work choice*. An unfinished aftermath,
// completed=false, an ending ID or a global rage flag cannot prove survival.
export function deriveAchievementsV48(run){
 if(!/^e39-/.test(run?.seed||''))return [];
 const history=Array.isArray(run.history)?run.history:[],rows=history.map((row,index)=>({row,index})).filter(({row})=>resolved(row));
 const ids=new Set(),add=(id,yes)=>{if(yes)ids.add(id);},afterWork=index=>later(history,index,work)>=0;
 const spoken=speeches(run,history),surviving=spoken.filter(proof=>afterWork(proof.index));
 for(const [name,n] of [['three',3],['five',5],['eight',8]])add(`verbal-still-here-${name}`,surviving.length>=n);
 for(const [id,kind]of [['verbal-no-audience','ignored'],['verbal-echo-office','retort'],['verbal-witnesses','support'],['verbal-cold-shoulder','relationship']])add(id,surviving.filter(proof=>proof.kind===kind).length>=2);
 add('verbal-three-agendas',new Set(surviving.map(proof=>proof.origin)).size>=3);
 add('verbal-both-bosses',['wing','spencer'].every(target=>surviving.some(proof=>proof.target===target)));
 add('verbal-onboard-return',surviving.some(proof=>proof.origin==='onboarding'&&proof.phase==='event'&&proof.target==='wing'&&proof.kind!=='personnel'));
 add('verbal-salary-return',surviving.some(proof=>salaryOrigin(proof.origin)));
 add('verbal-pip-return',surviving.some(proof=>/^pip-/.test(proof.origin)));
 add('verbal-private-return',surviving.some(proof=>privateOrigin(proof.origin)));
 add('verbal-colleague-circuit',new Set(surviving.filter(proof=>!['wing','spencer'].includes(proof.target)).map(proof=>proof.target)).size>=3);
 const nextSpeechIndex=proof=>spoken.find(item=>item.index>proof.index)?.index??history.length;
 const speechFollowup=(proof,predicate)=>rows.find(({row,index})=>index>proof.index&&index<nextSpeechIndex(proof)&&predicate(row)&&afterWork(index));
 add('verbal-legal-return',surviving.some(proof=>proof.kind==='legal'&&speechFollowup(proof,row=>row.eventId==='verbal-v2-legal-result'&&row.kind==='verbal'&&row.speaker===proof.target&&row.choiceIndex===0)));
 add('verbal-warning-return',surviving.some(proof=>proof.kind==='personnel'&&speechFollowup(proof,row=>row.eventId==='verbal-v2-warning'&&row.kind==='verbal'&&row.speaker==='hope'&&[0,1].includes(row.choiceIndex))));
 const attempts=resolvedRageAttempts(run).filter(attempt=>attempt.origin&&resolved(history[attempt.historyIndex])&&history[attempt.historyIndex].eventOutcome?.label==='剛才發生了什麼');
 const dreams=attempts.filter(item=>item.mode==='imagined'),real=attempts.filter(item=>item.mode==='real');
 add('verbal-dream-to-words',spoken.some(proof=>dreams.some(attempt=>attempt.person===proof.target&&attempt.historyIndex<proof.index)));
 add('verbal-words-to-dream',dreams.some(attempt=>spoken.some(proof=>proof.target===attempt.person&&proof.index<attempt.historyIndex)));
 add('dream-trilogy',dreams.length>=3);add('dream-three-cast',new Set(dreams.map(attempt=>attempt.person)).size>=3);
 add('rage-dream-then-real',real.some(attempt=>dreams.some(dream=>dream.person===attempt.person&&dream.historyIndex<attempt.historyIndex)));
 add('rage-real-then-dream',dreams.some(dream=>real.some(attempt=>attempt.person===dream.person&&attempt.historyIndex<dream.historyIndex)));
 for(const attempt of real){
  const nextAttempt=attempts.find(item=>item.historyIndex>attempt.historyIndex)?.historyIndex??history.length;
  const follow=rows.filter(({index})=>index>attempt.historyIndex&&index<nextAttempt);
  if(privateOrigin(attempt.origin)){
   const closed=follow.find(({row})=>row.kind==='rage-world'&&row.speaker===attempt.person&&['rage-legal','rage-showdown','rage-public'].includes(row.eventId));
   if(!closed||!afterWork(closed.index))continue;
   add('rage-private-return',true);
   add('rage-police-return',closed.row.eventId==='rage-legal'&&follow.some(({row,index})=>index<closed.index&&row.eventId==='rage-aftermath'&&row.kind==='rage-world'&&row.speaker===attempt.person&&row.choiceIndex===0));
   add('rage-private-mediation',closed.row.eventId==='rage-legal'&&closed.row.choiceIndex===1);
   add('rage-medical-receipt',closed.row.eventId==='rage-showdown'&&closed.row.choiceIndex===0&&closed.row.delta?.cash===-12);
   add('rage-cup-off-duty',closed.row.eventId==='rage-public');
  }else{
   const truce=follow.find(({row})=>row.kind==='rage-world'&&(row.eventId==='rage-legal'&&row.choiceIndex===1||row.eventId==='rage-showdown'&&row.choiceIndex===2||row.eventOutcome?.label==='場面最後倒向哪邊'&&row.eventOutcome.result==='有人把會議叫停'));
   const resume=truce&&follow.find(({row,index})=>index>truce.index&&row.eventId==='chapter-resolution'&&row.kind==='career'&&row.choiceIndex===0);
   if(!resume||!afterWork(resume.index))continue;
   add('rage-truce-return',true);add('rage-onboard-truce',attempt.origin==='onboarding'&&attempt.person==='wing');add('rage-salary-truce',salaryOrigin(attempt.origin));
  }
 }
 const meals=rows.filter(({row})=>isMealOutcomeV36(run,row)&&(row.delta?.cash||0)<0),warm=meals.filter(({row})=>row.mealOutcome.reaction==='warm'),mines=meals.filter(({row})=>row.mealOutcome.reaction==='mine');
 const declines=rows.filter(({row})=>/^meal-guests-[abc]$/.test(row.eventId)&&row.kind==='self-care'&&row.eventOutcome?.label==='飯局邀請回覆'&&row.eventOutcome.result==='今天約不到');
 // Invitation rows use the player as speaker; the selected person belongs to
 // the canonical choice text, whose display aliases never alter saved history.
 const declinedTarget=row=>{const page=['meal-guests-a','meal-guests-b','meal-guests-c'].indexOf(row.eventId),id=MEAL_GUEST_IDS_V39[page*8+row.choiceIndex];return page>=0&&row.choiceIndex<8&&known(id)&&row.choiceText.startsWith(`傳訊息約${PERSONAS[id].name}吃飯（成行餐費 `)&&/成行餐費 \d+ 存款）$/.test(row.choiceText)?id:null;};
 add('meal-three-warm',warm.length>=3);add('meal-two-mines',mines.length>=2);
 add('meal-same-person-weather',warm.some(({row})=>mines.some(item=>item.row.speaker===row.speaker)));
 add('meal-wing-warm',warm.some(({row})=>row.speaker==='wing'));add('meal-read-three',declines.length>=3);
 add('meal-rain-check',declines.some(({row,index})=>{const who=declinedTarget(row);return who&&meals.some(meal=>meal.index>index&&meal.row.speaker===who);}));
 add('meal-after-insult',warm.some(meal=>spoken.some(proof=>proof.target===meal.row.speaker&&proof.index<meal.index)));
 add('meal-after-dream',warm.some(meal=>dreams.some(attempt=>attempt.person===meal.row.speaker&&attempt.historyIndex<meal.index)));
 add('meal-three-guests',new Set(meals.map(({row})=>row.speaker)).size>=3);add('meal-first-love-break',['jack','meimei'].every(id=>meals.some(({row})=>row.speaker===id)));
 const paid=rows.filter(({row})=>(row.delta?.cash||0)<0&&(row.eventId==='self-care'||isMealOutcomeV36(run,row)));
 const selfCare=(entry,index)=>entry.row.eventId==='self-care'&&entry.row.kind==='self-care'&&entry.row.choiceIndex===index&&(entry.row.delta?.cash||0)<0;
 const cuts=rows.filter(({row,index})=>['salary-cut','salary-final'].includes(row.eventId)&&row.kind==='career'&&row.choiceIndex===0&&Number.isInteger(row.pay)&&rows.some(item=>item.index<index&&item.row.pay>row.pay));
 const raises=rows.filter(({row,index})=>['raise-response','raise-confirmation'].includes(row.eventId)&&row.kind==='career'&&Number.isInteger(row.pay)&&row.pay>(history[index-1]?.pay||row.pay)&&(!row.eventOutcome||['條件寫進確認信','真的照新數字走'].includes(row.eventOutcome.result)));
 const recoveries=rows.filter(({row})=>['mood-collapse','mood-self-destruct'].includes(row.eventId)&&row.kind==='crisis'&&row.choiceIndex===0&&(row.delta?.cash||0)<0&&(row.delta?.mood||0)>0&&afterWork(history.indexOf(row)));
 const unpaid=rows.filter(({row})=>['mood-collapse','mood-self-destruct'].includes(row.eventId)&&row.kind==='crisis'&&row.choiceIndex===1&&(row.delta?.mood||0)>0);
 add('care-second-repair',recoveries.length>=2);
 add('care-unpaid-drink',unpaid.some(entry=>paid.some(item=>item.index>entry.index&&selfCare(item,0))));
 add('care-raise-party',raises.some(entry=>paid.some(item=>item.index>entry.index)));
 add('career-cut-raise',cuts.some(entry=>raises.some(item=>item.index>entry.index)));
 const backups=paid.filter(item=>selfCare(item,3));
 add('care-evidence-then-words',backups.some(entry=>spoken.some(proof=>proof.index>entry.index)));
 add('care-words-then-evidence',spoken.some(proof=>backups.some(entry=>entry.index>proof.index)));
 const pip=rows.filter(({row})=>/^pip-/.test(row.eventId)&&row.speaker==='hope');
 add('care-pip-two-ways',pip.some(entry=>[1,5].every(index=>paid.some(item=>item.index>entry.index&&selfCare(item,index)))));
 add('care-sixty',paid.reduce((sum,{row})=>sum-row.delta.cash,0)>=60);
 add('care-goose-three',paid.filter(item=>selfCare(item,6)).length>=3);
 add('career-cut-care',cuts.some(entry=>paid.some(item=>item.index>entry.index&&item.row.eventId==='self-care')));
 const activity=rows.filter(({row})=>row.kind==='activity'&&row.activityOutcome?.version===1&&row.eventId===`activity44-${row.activityOutcome.id}-${row.activityOutcome.stage}`&&row.eventOutcome?.label==='活動結果'&&row.eventOutcome.result===row.activityOutcome.label&&Number.isInteger(row.activityOutcome.stage)&&row.activityOutcome.stage>=0&&row.choiceIndex<=3);
 const stages=id=>activity.filter(({row})=>row.activityOutcome.id===id),complete=id=>{const group=stages(id),last=id==='banquet'?3:2;return Array.from({length:last+1},(_,index)=>index).every(stage=>group.some(({row})=>row.activityOutcome.stage===stage&&row.activityOutcome.done===(stage===last)));};
 const has=(id,stage,label,choice)=>stages(id).some(({row})=>row.activityOutcome.stage===stage&&(!label||row.activityOutcome.label===label)&&(choice===undefined||row.choiceIndex===choice));
 add('activity-arm-whitepaper',complete('arm')&&has('arm',0,'十秒規則寫定',0)&&has('arm',1,'比賽真的打完')&&has('arm',2,'結果和聲明都有位置',0));
 add('activity-diet-prize',complete('diet')&&has('diet',2,'紀錄組獲獎',0));
 add('activity-diet-special',complete('diet')&&has('diet',2,'蛋塔觀察特別獎',2));
 add('activity-diet-withdraw',complete('diet')&&has('diet',2,'自願退出公開排名',1));
 add('activity-roadshow-limits',complete('roadshow')&&has('roadshow',1,null,0)&&has('roadshow',2,null,0));
 add('activity-fish-share',complete('dinner')&&has('dinner',2,null,1)&&stages('dinner').some(({row})=>row.activityOutcome.stage===2&&row.delta?.cash===-4));
 add('activity-banquet-ghost-return',complete('banquet')&&stages('banquet').some(({row,index})=>row.activityOutcome.stage===3&&[0,1].includes(row.choiceIndex)&&row.activityOutcome.label==='阿良答應，人卻消失'&&afterWork(index)));
 add('activity-basketball-assist',complete('basketball')&&has('basketball',1,'這波打成了',0));
 add('activity-basketball-rest',complete('basketball')&&has('basketball',2,'換人也算完成這場',1));
 add('activity-review-evidence',complete('review')&&has('review',2,'帶著明確待辦離場'));
 return ACHIEVEMENTS_V48.filter(item=>ids.has(item.id)).map(item=>item.id);
}
