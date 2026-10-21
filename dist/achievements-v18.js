// Extra goals use resolved engine facts only. No client-supplied badge IDs,
// unrevealed choice results or external research are accepted as evidence.
import { resolvedRageAttempts } from './rage-achievements.js';
const badge=(id,title,description,group)=>Object.freeze({id,title,description,group,image:`./assets/achievements/${id}.svg`,...(id.startsWith('dream-')?{mode:'imagined'}:{})});
const roleGoals=[
 ['system','系統還活著，你也是。','以系統工程職務完成三個工作回合。維運清單上，記得也放一個自己。'],
 ['ai','今天真的有碰到 AI 嗎？','以 AI 工程職務完成三個工作回合。名片上的兩個字，終於有了工作經歷。'],
 ['project','排程先排進人生。','以專案管理職務完成三個工作回合。四個第一優先，至少你還記得先後。'],
 ['product','需求裡沒有這個需求。','以產品管理職務完成三個工作回合。你開始分得清使用者和坐在辦公室的人。'],
 ['design','這版先不要叫最終。','以設計職務完成三個工作回合。檔名的底線，已經比睡眠時間還長。'],
 ['bd','通訊錄不是公司資產。','以商務開發職務完成三個工作回合。牽線之外，也替自己留一條路。'],
 ['sales','成交之後才開始談條件。','以業務職務完成三個工作回合。產品、佣金和承諾，你已經各聽過一個版本。'],
 ['mis','重開機不能重開人生。','以 MIS 職務完成三個工作回合。全公司都有權限問題，只有你不能一句話核准。'],
 ['executive','椅子坐熱之前','以高階主管職務完成三個工作回合。授權還在路上，你先撐過了第一輪追問。']
];
const educationGoals=[
 ['private-proof','校名沒改，工作有做。','帶著私立大學學歷完成五個工作回合。校名不會替你交付，也不會讓你的成果消失。'],
 ['overseas-proof','時差不在履歷上。','帶著海外學歷完成五個工作回合。換了時區，沒有自動換掉辦公室的怪事。'],
 ['cross-field','文組也能把它修好。','以人文或商管背景，在工程職務完成五個工作回合。今天的問題，靠的是你真的去查。'],
 ['ntu-proof','台大之後，還是要上班。','帶著台大非 EMBA 學歷完成五個工作回合。校名讓他點頭，待辦還是得自己完成。'],
 ['emba-proof','括號不能替你做事。','帶著 EMBA 學歷完成五個工作回合。說完學位，還是得回到手上的工作。']
];
const rankGoals=[
 ['assistant-work','助理也有自己的版本。','以助理職級完成三個工作回合。交付是你做的，紀錄也請寫你的名字。'],
 ['staff-work','一個人的正常工作量','以專業員工職級完成三個工作回合。能獨立做事，不代表可以無限加單。'],
 ['senior-work','資深不是轉接專線。','在資深職級完成職務責任，或實際工作兩個回合。經驗可以分享，整份工作不用全吞。'],
 ['principal-work','主任有主張。','在主任職級完成職務責任，或實際工作兩個回合。這次拍板，記得連依據一起留下。'],
 ['deputy-work','小組真的有人要顧。','在副理職級完成職務責任，或實際工作兩個回合。排班表上的人，終於不只是格子。'],
 ['manager-work','簽名以前先看內容。','在經理職級完成職務責任，或實際工作兩個回合。你的名字，開始出現在別人的表格上。'],
 ['director-work','整合不會生出人力。','在總監職級完成職務責任，或實際工作兩個回合。把資源算清楚，比再說一次加油難。'],
 ['chief-work','首席也要接自己的信。','在 C-level 職級完成職務責任，或實際工作兩個回合。頭銜印好了，責任也真的寄來了。']
];
const extraGoals=[
 ['wallet-mood','情緒修繕費','花遊戲存款安排一次舒壓。這筆不是公司福利，是你決定替自己支出的預算。','wallet'],
 ['wallet-energy','身體沒有候補機。','花遊戲存款恢復一次體力。零件不能換，就先讓正在運轉的這一台休息。','wallet'],
 ['wallet-training','知識自己報帳。','花遊戲存款進修一次。這回讀的內容，至少由你決定。','wallet'],
 ['wallet-evidence','備份要有第二個地方。','花遊戲存款整理或備份一次紀錄。事情可能改口，資料不用跟著失憶。','wallet'],
 ['wallet-network','這桌不談願景。','花遊戲存款安排一次人脈聚會。有人聽你說完，也有人願意說自己的打算。','wallet'],
 ['wallet-sabbatical','勿擾，不是故障。','花遊戲存款安排一次完整休假。通知沒有回，不代表人生沒有在進行。','wallet'],
 ['wallet-thirty','這些錢真的會扣。','同一局累計支出三十格遊戲存款。錢真的花出去了，你也開始看懂每一次選擇的價錢。','wallet'],
 ['wallet-variety','預算不是只有忍耐。','同一局使用三種不同的付費安排。你開始替自己的生活編列項目。','wallet'],
 ['craft-skill','腦袋拿去做事了。','發生三次能力取捨後，工作能力達九十，另外兩項都不超過六十。時間真的有花向某一邊。','craft'],
 ['craft-slack','偷懶也要有技術。','發生三次能力取捨後，偷懶能力達九十，另外兩項都不超過六十。省下的力氣，記得自己用。','craft'],
 ['craft-lick','嘴比鍵盤更忙。','發生三次能力取捨後，舔老闆能力達九十，另外兩項都不超過六十。今天最熟練的輸出不在程式裡。','craft'],
 ['craft-tradeoff','今天練這個，就放掉一點那個。','同一局經歷八次能力取捨。做事、偷懶、討好，終於不是三條一起往上長的進度條。','craft'],
 ['mood-rebound','這口氣終於回來了。','一次已發生的事件讓心情回升至少二十五。你沒有突然愛上公司，只是比較像自己了。','craft'],
 ['energy-rebound','不是省電，是充電。','一次已發生的事件讓體力回升至少二十。醒來以後，先不用急著把電量交出去。','craft'],
 ['mood-shock','今天的火氣有聲音。','一次已發生的事件讓心情掉了至少二十。這回連進度條都藏不住你的表情。','craft'],
 ['mood-zero','情緒斷路器','心情歸零，觸發一次崩潰事件。這條線不是裝飾，越過以後，事情真的變了。','craft'],
 ['mood-zero-finish','把崩潰的那一天走完。','心情歸零崩潰後，完成這段人生。事情沒有自動復原，你仍把自己的後續走到了結尾。','craft'],
 ['pip-repeat','又是這份表。','同一局正式進入兩次 PIP。第二次打開附件，你已經認得它的字型。','career'],
 ['pip-dossier','改善表旁邊有一整本。','通過 PIP，並累積五次留證紀錄。你交的不只有自評，還有能逐項核對的事情。','career'],
 ['pip-finish','改善過了，故事由我收尾。','通過 PIP 後完成這段人生。通過一張表，沒有替你決定接下來要怎麼活。','career'],
 ['cut-and-work','便宜之後，工作照寄。','接受降薪後，再完成兩個工作回合。薪資單換了數字，交辦仍照原頻率抵達。','career'],
 ['cut-refusal','我的價格到這裡。','在降薪談話中拒絕新價格，選擇離開。房租很現實，你的選擇也一樣。','career'],
 ['hope-regular','關懷信的熟客','同一局回應希望四次。她記得你的欄位，你開始記得每一次來回的日期。','career'],
 ['evidence-five','請看附件，不用看臉。','同一局累積五次留證紀錄。下次有人說你沒講，至少不用只靠音量。','office'],
 ['archive-three','草稿開始像史冊。','同一局累積三次史冊紀錄。原本只想留個備忘，現在已經有了章節。','office'],
 ['shield-three','人力表裡有人的名字。','同一局三次替團隊擋住不合理的要求。事情沒突然變少，同事至少知道你有看見。','office'],
 ['support-three','同事不是耗材。','同一局三次實際支援同事。這次交付有人一起接，不必只在群組裡互道辛苦。','office'],
 ['minutes-three','願景也請簽名。','同一局留下三次正式決議紀錄。承諾寫到紙上，才知道誰願意把名字放旁邊。','office'],
 ['delegate-three','這句話，怎麼換你說了？','同一局三次把上面的壓力轉交團隊。你開始聽見自己的語氣，跟會議室裡那個人有點像。','office'],
 ['trust-ninety','大家還願意跟你講真話。','完成五個工作回合後，同事情義達九十。群組之外，仍有人願意把真正的版本告訴你。','office'],
 ['luck-streak','這次真的有被骰子照顧。','同一局累積三次順利或幸運結果。不是每件事都能控制，但今天確實有幾次站在你這邊。','office'],
 ['setback-streak','骰子今天也想開會。','同一局累積三次受挫結果。你沒有選錯所有事情，只是運氣這回也不太合作。','office'],
 ['rng-five','人生不是固定選單。','同一局看完五次隨機事件的結果。選項一樣，落下來的故事未必一樣。','office'],
 ['jack-notes','筆記本裡有人接力。','同一局三次跟著傑克整理紀錄。史冊不是突然長出來，是有人願意把事情記完整。','office'],
 ['office-explorer','題材怎麼還沒用完？','同一局完成十五個不同的日常或主線事件。工作證還是那張，辦公室已經換了好幾種荒謬。','office'],
 ['dream-wing','他還在講，你已經演完。','對翅膀的衝動在腦內演完。回過神，他還不知道剛才那場會議在你心裡怎麼收尾。','rage'],
 ['dream-spencer','董事長的夢中番外','對屎潘蛇的衝動在腦內演完。現場還在談願景，你先看完了一個只屬於自己的版本。','rage'],
 ['dream-rick','夢裡也要叫他起床。','對老闆乾兒子的衝動在腦內演完。對方沒有受傷，這次想像倒是一直醒著。','rage'],
 ['dream-hope','自評欄放不下這段。','對希望的衝動在腦內演完。改善計畫的附件裡，沒有你剛才那齣戲。','rage'],
 ['dream-erich','腦內暫不受理。','對法師的衝動在腦內演完。現場沒有新增案件，只有你自己知道剛才發生了什麼。','rage'],
 ['dream-jenjen','這張夢不用送簽。','對 Moon Dog 的衝動在腦內演完。流程沒有收到申請，你的想像已經跑完全程。','rage'],
 ['dream-sonny','內心工單已結案。','對阿福的衝動在腦內演完。帳號沒有因此多出權限，心裡倒是先清了一筆。','rage'],
 ['dream-kind','今晚只有腦內加演。','對阿良的衝動在腦內演完。沒有付續攤費，也沒有真的讓任何人上台。','rage'],
 ['dream-jack','這篇只有你能寫。','對傑克的衝動在腦內演完。他的筆記沒有這段，因為剛才的現場其實什麼也沒發生。','rage'],
 ['banquet-gift','小獎也能付錢。','尾牙抽到小獎。不能拿去敲鐘，至少真的能拿來過生活。','banquet'],
 ['banquet-dress','紅白之外還有粉紅。','參加尾牙的服裝猜謎。老闆乾兒子的配色有變，接話速度沒有。','banquet'],
 ['banquet-speech','菜還熱，願景也熱。','尾牙被臨時講話或工作插播。你帶著筷子出席，沒想到也要帶進度。','banquet'],
 ['banquet-staff','工作人員也要吃飯。','尾牙抽獎時先去幫忙發菜。舞台上的辛苦了，這次有一點真的送到人手上。','banquet'],
 ['banquet-supper','這碗麵沒有下次一定。','尾牙散場後，花自己的錢吃飯搭車。價錢和到家時間，終於都照約定發生。','banquet'],
 ['banquet-home','散場就是真的散場。','尾牙結束後直接回家。你沒有再領一份工作，也不用等誰從洗手間回來。','banquet'],
 ['banquet-complete','今年的年度大戲看完了。','走完尾牙進場、抽獎與散場三段。這一晚有沒有拿到獎，都有自己的完整版本。','banquet']
];
export const EXTRA_ACHIEVEMENTS=Object.freeze([
 ...roleGoals.map(([id,title,description])=>badge(`role-${id}`,title,description,'career')),
 ...educationGoals.map(([id,title,description])=>badge(`school-${id}`,title,description,'office')),
 ...rankGoals.map(([id,title,description])=>badge(`rank-${id}`,title,description,'career')),
 ...extraGoals.map(([id,title,description,group])=>badge(id,title,description,group))
]);

export function deriveExtraAchievements(run){
 if(!run||typeof run!=='object')return [];
 const history=Array.isArray(run.history)?run.history:[],flags=run.flags&&typeof run.flags==='object'?run.flags:{},stats=run.stats||{},education=run.education||{},ids=new Set();
 // Engine history is written after a choice resolves, including pending results.
 const resolved=history.filter(item=>item&&Number.isInteger(item.choiceIndex)&&item.choiceIndex>=0);
 const work=resolved.filter(item=>['daily','fantasy'].includes(item.kind));
 const add=(id,yes)=>{if(yes)ids.add(id);};
 if(work.length>=3&&roleGoals.some(([role])=>role===run.actualRoleId))add(`role-${run.actualRoleId}`,true);
 const educated=work.length>=5;
 add('school-private-proof',educated&&education.sector==='private');
 add('school-overseas-proof',educated&&education.sector==='overseas');
 add('school-cross-field',educated&&['humanities','business'].includes(education.field)&&['system','ai','mis'].includes(run.actualRoleId));
 add('school-ntu-proof',educated&&education.schoolId==='ntu'&&education.degree!=='EMBA');
 add('school-emba-proof',educated&&education.degree==='EMBA');
 if(/^e(?:17|18|19|20|21|22|23|24|25|26|27|28|29|30)-/.test(run.seed||''))rankGoals.forEach(([id],rank)=>add(`rank-${id}`,(flags[`career_work_${rank}`]||0)>=(rank<=1?3:2)||(rank>1&&(flags[`career_duty_${rank}`]||0)>0)));
 const spend=['mood','energy','training','evidence','network','sabbatical'];
 for(const kind of spend)add(`wallet-${kind}`,(flags[`spend_${kind}`]||0)>0);
 add('wallet-thirty',(flags.cash_spent_total||0)>=30);
 const paid=resolved.filter(item=>(item.delta?.cash||0)<0&&(item.kind==='self-care'||['crisis-mood','mood-collapse','banquet-afterparty',...(/^e(?:25|26|27|28|29|30)-/.test(run.seed||'')?['mood-self-destruct']:[])].includes(item.eventId)));
 const arrangements=new Set(paid.map(item=>['kind-break','kind-workday'].includes(item.eventId)?'kind-invitation':`${item.eventId}/${item.choiceIndex}`));
 add('wallet-variety',arrangements.size>=3);
 for(const skill of ['skill','slack','lick'])add(`craft-${skill}`,(flags.resource_friction_count||0)>=3&&stats[skill]>=90&&['skill','slack','lick'].filter(other=>other!==skill).every(other=>stats[other]<=60));
 add('craft-tradeoff',(flags.resource_friction_count||0)>=8);
 add('mood-rebound',resolved.some(item=>(item.delta?.mood||0)>=25));
 add('energy-rebound',resolved.some(item=>(item.delta?.energy||0)>=20));
 add('mood-shock',resolved.some(item=>(item.delta?.mood||0)<=-20));
 add('mood-zero',(flags.mood_crash_count||0)>0);
 add('mood-zero-finish',(flags.mood_crash_count||0)>0&&run.completed===true);
 add('pip-repeat',run.pipCount>=2);
 add('pip-dossier',(flags.pip_passed||0)>0&&(flags.evidence||0)>=5);
 add('pip-finish',(flags.pip_passed||0)>0&&run.completed===true);
 const accepted=resolved.findIndex(item=>['salary-cut','salary-final'].includes(item.eventId)&&item.choiceIndex===0);
 add('cut-and-work',(flags.pay_cut||0)>0&&accepted>=0&&resolved.slice(accepted+1).filter(item=>['daily','fantasy'].includes(item.kind)).length>=2);
 add('cut-refusal',resolved.some(item=>['salary-cut','salary-final'].includes(item.eventId)&&item.choiceIndex===1));
 add('hope-regular',resolved.filter(item=>item.speaker==='hope'&&item.kind!=='rage').length>=4);
 for(const [id,flag,amount]of [['evidence-five','evidence',5],['archive-three','archive',3],['shield-three','team_shield',3],['support-three','team_support',3],['minutes-three','board_minutes',3],['delegate-three','wing_delegate',3]])add(id,(flags[flag]||0)>=amount);
 add('trust-ninety',work.length>=5&&stats.trust>=90);
 add('luck-streak',resolved.filter(item=>['lucky','success'].includes(item.chanceOutcome)).length>=3);
 add('setback-streak',resolved.filter(item=>item.chanceOutcome==='setback').length>=3);
 add('rng-five',resolved.filter(item=>item.eventOutcome&&typeof item.eventOutcome.label==='string').length>=5);
 add('jack-notes',(flags.jack_notes||0)>=3);
 add('office-explorer',new Set(work.map(item=>item.eventId)).size>=15);
 // The outcome is stored on the actual release history entry. Combining the
 // global target and imagination flags would wrongly mix two separate attempts.
 const imagined=resolvedRageAttempts(run).filter(item=>item.mode==='imagined');
 for(const person of ['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack'])add(`dream-${person}`,imagined.some(item=>item.person===person));
 for(const [id,flag]of [['banquet-gift','banquet_gift'],['banquet-dress','banquet_dress'],['banquet-speech','banquet_speech'],['banquet-staff','banquet_staff'],['banquet-supper','banquet_selfcare'],['banquet-home','banquet_home']])add(id,(flags[flag]||0)>0);
 add('banquet-complete',['banquet-welcome','banquet-draw','banquet-afterparty'].every(id=>resolved.some(item=>item.eventId===id)));
 return EXTRA_ACHIEVEMENTS.filter(item=>ids.has(item.id)).map(item=>item.id);
}
