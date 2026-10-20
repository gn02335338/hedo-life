import { eligibleStoryEndings } from './story-career.js';
import { getCareerDuty } from './career.js';
import { applyPersonaCopy } from './persona.js';

// Only new e17 lives use these ranks. Published runs keep career.js unchanged.
export const CAREER_MAX_RANK_V17=7;
export const CAREER_MANAGER_RANK_V17=4;
export const CAREER_FAMILIES_V17=['career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief'];
export const CAREER_LEVELS_V17=[
 {rank:0,label:'助理',payMultiplier:.8,responsibility:'先熟悉工具、流程和交付，做過的工作也要記在自己名下。',pressure:{energy:0,mood:0}},
 {rank:1,label:'專業員工',payMultiplier:1,responsibility:'獨立完成自己的工作，遇到做不到的承諾也能說清楚。',pressure:{energy:0,mood:0}},
 {rank:2,label:'資深專業',payMultiplier:1.12,responsibility:'處理更難的問題，分享經驗；資深兩個字不代表全天候待命。',pressure:{energy:0,mood:-1}},
 {rank:3,label:'主任專業',payMultiplier:1.24,responsibility:'把關專業決策、協調交付，還沒領到主管權限就先守好工作邊界。',pressure:{energy:-1,mood:-1}},
 {rank:4,label:'副理',payMultiplier:1.4,responsibility:'開始帶小組、排工作，替同事承接第一輪追問。',pressure:{energy:-1,mood:-1}},
 {rank:5,label:'經理',payMultiplier:1.7,responsibility:'人力、績效與交付一起算在你頭上。',pressure:{energy:-1,mood:-2}},
 {rank:6,label:'總監',payMultiplier:2.15,responsibility:'協調部門與預算，替上面的承諾找到真正可行的做法。',pressure:{energy:-2,mood:-2}},
 {rank:7,label:'C-level',payMultiplier:2.7,responsibility:'列席高層會議，也要為簽下去的決定負責。',pressure:{energy:-2,mood:-3}}
];
export const CAREER_LADDERS_V17={
 system:['助理工程師','工程師','資深工程師','主任工程師','工程副理','工程經理','工程總監','技術長 CTO'],
 ai:['助理工程師','AI工程師','資深AI工程師','主任AI工程師','AI工程副理','AI工程經理','AI工程總監','人工智慧長 CAIO'],
 project:['專案助理','專案經理','資深專案經理','主任專案經理','專案管理副理','專案管理經理','專案管理總監','營運長 COO'],
 product:['產品助理','產品經理','資深產品經理','主任產品經理','產品副理','產品部經理','產品總監','產品長 CPO'],
 design:['助理設計師','設計師','資深設計師','主任設計師','設計副理','設計經理','設計總監','創意長 CCO'],
 bd:['商務開發助理','商務開發專員','資深商務開發專員','主任商務開發專員','商務開發副理','商務開發經理','商務開發總監','策略長 CSO'],
 sales:['業務助理','業務專員','資深業務專員','主任業務專員','業務副理','業務經理','業務總監','商務長 CCO'],
 mis:['助理工程師','MIS工程師','資深MIS工程師','主任MIS工程師','資訊副理','資訊經理','資訊總監','資訊長 CIO'],
 executive:['營運助理','營運企劃專員','資深營運企劃專員','主任營運企劃專員','營運副理','事業部經理','事業部總監','執行長 CEO']
};

const MIN_SERVICE=[2,2,3,3,3,3,4,0];
const MIN_TURN=[3,4,7,10,13,16,20,24];
const MERIT=[null,{skill:50,trust:30,boss:35},{skill:55,trust:35,boss:40},{skill:62,trust:40,boss:43},{skill:68,trust:45,boss:48},{skill:75,trust:50,boss:55},{skill:83,trust:60,boss:63},{skill:90,trust:70,boss:72}];
const POLITICS=[null,{lick:55,boss:55},{lick:60,boss:60},{lick:66,boss:64},{lick:72,boss:70},{lick:80,boss:78,skill:58,trust:35},{lick:87,boss:85,skill:70,trust:45},{lick:94,boss:92,skill:80,trust:55}];
const MERIT_CAP=[0,.90,.90,.84,.76,.65,.54,.44];
const POLITICS_CAP=[0,.90,.90,.82,.72,.61,.49,.38];
const HIGH_MERIT_PENALTY=[0,0,0,0,.03,.08,.16,.24];
const HIGH_POLITICS_PENALTY=[0,0,0,0,.04,.10,.19,.29];
const bounded=(number,min,max)=>Math.max(min,Math.min(max,number));
const c=(text,result,delta={},effect=null,flags=[])=>({text,detail:'',result,delta,effect,flags});
const scene=(id,title,body,choices,speaker='wing')=>({id,title,body,wing:'「職稱給你了，事情也請你一起接好。」',speaker,kind:'career',era:'職涯異動',sourceIds:['careerFiction'],choices});
const requirementsMet=(stats,requirements)=>Object.entries(requirements).every(([key,value])=>stats[key]>=value);
const canStepDown=run=>run.assignment!=='assistant'&&run.rank>=4&&!run.resumeEventId&&run.turn>=1&&run.turn<24;

export function careerRankV17(run){return run.rank;}
// Legacy systems that distinguish staff / deputy / manager / director / chief
// can use this view without confusing a senior professional with a manager.
export function legacyCareerRankV17(runOrRank){const rank=typeof runOrRank==='number'?runOrRank:runOrRank.rank;return rank<4?0:rank-3;}
export function careerTitleV17(run){return CAREER_LADDERS_V17[run.actualRoleId][run.rank];}
export function careerStageV17(run){return CAREER_LEVELS_V17[run.rank];}
export function careerInfoV17(run){
 const stage=careerStageV17(run);
 return {...stage,title:careerTitleV17(run),label:run.rank===0?'助理／待轉正':stage.label,assignment:run.assignment,nextTitle:CAREER_LADDERS_V17[run.actualRoleId][run.rank+1]||null};
}
export function careerSalaryV17(run,rank=run.rank){return Math.min(500,Math.max(1,Math.round(run.basePay*CAREER_LEVELS_V17[rank].payMultiplier)));}
export function careerEndingAvailableV17(run){
 if(run.rank<=1)return (run.flags[`career_work_${run.rank}`]||0)>=3||(run.flags.career_service||0)>=3;
 return (run.flags[`career_duty_${run.rank}`]||0)>0||(run.flags[`career_work_${run.rank}`]||0)>0;
}
export function careerReadinessV17(run){
 const target=Math.min(CAREER_MAX_RANK_V17,run.rank+1),service=run.flags.career_service||0,minService=MIN_SERVICE[run.rank],minTurn=MIN_TURN[run.rank];
 return {target,service,minService,minTurn,ready:run.rank<CAREER_MAX_RANK_V17&&service>=minService&&run.turn>=minTurn};
}
export function careerReviewWaitV17(run){return run.turn-run.lastPromotion>=(run.rank<=3?2:3)&&run.turn>=(run.flags.career_defer_until||0);}
export function careerInvitationEligibleV17(run){
 return /^e(?:17|18|19|20|21|22|23|24|25|26)-/.test(run.seed)&&run.turn>=3&&run.turn<24&&run.rank<CAREER_MAX_RANK_V17&&!run.pip?.active&&careerReviewWaitV17(run)&&careerReadinessV17(run).ready&&getCareerReviewV17(run).choices.slice(0,2).some(choice=>choice.available!==false);
}

export function getCareerReviewV17(run){
 const assistant=run.rank===0,target=Math.min(CAREER_MAX_RANK_V17,run.rank+1),s=run.stats,title=CAREER_LADDERS_V17[run.actualRoleId][target],management=target>=4;
 const healthy=run.rank<CAREER_MAX_RANK_V17&&!run.pip?.active&&s.energy>10&&s.mood>12&&careerReadinessV17(run).ready;
 const effect=assistant?'careerRegularize':'careerPromote';
 const checked=(choice,chance,available,success,failure)=>({...choice,available,check:{chance,success:{...success,effect},failure:{...failure,effect:null}}});
 const meritChance=bounded(.14+s.skill*.0038+s.boss*.002+s.trust*.0014-target*.02-HIGH_MERIT_PENALTY[target],.16,MERIT_CAP[target]);
 const politicsChance=bounded(.10+s.lick*.005+s.boss*.0025-target*.02-HIGH_POLITICS_PENALTY[target],.14,POLITICS_CAP[target]);
 const event=scene('career-review',assistant?'先把「助理」兩個字談掉。':management?'下一張名片，開始多一張人力表。':'專業多做一階，不是先變主管。',assistant?`你目前是${careerTitleV17(run)}，這次要談的是${title}。你把已能獨立完成的工作列出來；翅膀先問你夠不夠主動，彷彿助理薪水只是公司提供的修行環境。`:`你目前是${careerTitleV17(run)}，這次想談${title}。${management?'人力、預算和誰要替誰回話，都得一起談清楚。翅膀說職稱代表承擔，授權的部分則還在口頭規劃。':'這一階看的是解題、判斷和交付，不會因為名片多了兩個字，就自動長出管人的權限。翅膀問你能多扛多少，你把已經扛過的事情放上桌。'}`,[
  checked(c('拿實際交付和合作紀錄，談下一個職級。',''),meritChance,healthy&&requirementsMet(s,MERIT[target]),{result:assistant?`你把能獨立完成的工作講清楚，正式成為${title}。這回換掉的是職稱，不只是助理旁邊的小字。`:`你把做過的事情、專業判斷和同事回饋放在一起，談到了${title}。${management?'薪水會調整，帶人的責任也會真的送到桌上。':'新的職稱記下你的專業經歷；同事還是同事，不會突然變成你的部屬。'}`,delta:{skill:4,trust:4,boss:3,mood:6,energy:-4},flags:['promotion_merit']},{result:'資料看完，翅膀說還要再觀察。職稱沒變，你把他今天提出的要求記下來，免得下次又換一份考卷。',delta:{skill:2,mood:-7,boss:-5}}),
  checked(c('把他的方向整理成成果，爭取他點頭。',''),politicsChance,healthy&&requirementsMet(s,POLITICS[target]),{result:assistant?`翅膀很快理解了這份報告：都是他帶得好。你得到${title}的正式職稱，旁邊的同事替這場驗收交換了一個眼神。`:`你把翅膀的遠見放在第一頁，換到了${title}。${management?'組織圖往上挪了一格，願意跟你講真話的人少了幾個。':'專業職級往上了一階，茶水間有人問你那張投影片是不是也算技術債。'}`,delta:{lick:5,boss:5,trust:-8,mood:4,energy:-4},flags:['promotion_politics']},{result:'翅膀說你只會講漂亮話。這份稿上週還叫方向正確，今天先算你沒有掌握重點。',delta:{mood:-8,boss:-7,trust:-3}}),
  c(management?'把未來的主管椅先租給盆栽，自己去補帶人的本事。':'請影印機當口試委員，先把作品講到它不再卡紙。',management?'盆栽暫時坐得很穩。你找同事練習排工作、給回饋，也把哪些事不能靠加班解決記下來；新名片下次再談。':'影印機沒有投票權，但你把工作拆解、判斷和交付重新說了一遍。卡住的地方終於找到了，這次先把本事補上。',{skill:5,lick:2,trust:3,mood:-3,energy:-4},'careerTrain'),
  c('這次先不升。我想把現在的生活顧好。','你把這次評核留在這裡。現在的職稱還能做事，下班後的時間也值得留給自己。',{mood:10,energy:8,slack:6,boss:-3},'careerDefer')
 ]);
 const previous=run.flags.career_last_review_target===target+1?run.flags.career_last_review_result:0;
 if(!event.choices.slice(0,2).some(choice=>choice.available!==false)){
  event.title='先把本事和紀錄補齊，名片晚點印。';
  event.body=`你目前是${careerTitleV17(run)}，下一步想談${title}。${management?'帶人的經驗、交付紀錄和任期都還得對得上。':'先把專業判斷、獨立交付和實際工作經歷累積起來。'}今天可以補強，也可以先回原本的工作，不必每次都坐在這裡等一句再觀察。`;
  event.wing='「先證明自己。職稱的事，之後再談。」';
  if(previous===1)event.body+=' 上次練過的地方留著，這回挑還沒準備好的部分。';
  if(previous===2)event.body+=' 上次你說先不要，這次何時再談，仍由你決定。';
  if(previous===3)event.body+=' 上次的評語沒有替你做事，這回也不用只等他的評語。';
 }else if(previous===1){
  event.title='上次補過的功課，這回拿出來談。';
  event.body=`上次你先補本事，沒有急著印名片。又做了一段時間的${careerTitleV17(run)}，現在把新交付和合作紀錄攤開，重新談${title}。翅膀還是先問你能扛多少，這回你帶了可以核對的答案。`;
 }else if(previous===2){
  event.title='上次先不要，這次由你再決定。';
  event.body=`你前一次先把生活顧好。現在${title}又被放上桌，你目前仍是${careerTitleV17(run)}；要往前談，或繼續原本的安排，都可以自己選。`;
 }else if(previous===3){
  event.title='「再觀察」之後，你又多做了一段。';
  event.body=`上回談${title}，翅膀用一句再觀察收尾。你仍是${careerTitleV17(run)}，但這次多了新的交付和合作紀錄。資料放上桌，他若又談格局，至少不能說你只帶了上次那一份。`;
 }
 if(target>=5){event.body+=' 這一階還得看職缺與高層決定；任期、能力和成果到了，也不保證這次輪得到你。';event.wing='「坐過那張椅子，不代表下一張就有你的名字。」';}
 return event;
}

const PROFESSIONAL_DUTIES={
 1:{title:'正式職稱拿到了，工作也請正式算。',body:'你開始獨立接工作。隔壁有人說「這個順手幫一下」，翅膀則把順手理解成不用排時間。你先看看原本那份交付清單還剩多少空格。',choices:[
  ['把新工作排進清單，請他一起決定先後。','你把順手也算成工時。清單沒有變短，至少下次問進度時，大家看到的是同一張表。',{skill:5,trust:6,boss:-4,energy:-4},'evidence'],
  ['先幫同事拆開問題，讓他能自己接著做。','你沒有把整份工作吞下去。同事帶走做法，你也保住原本那件事的時間。',{skill:4,trust:8,energy:-5},'team_support'],
  ['替待辦清單辦入厝，請新工作自備一張椅子。','你在白板畫出新工作的座位，再問這張椅子要擠走哪一件。大家笑完，終於開始排順序。',{skill:3,trust:4,boss:-3,mood:4,energy:-4},'handover_notes']
 ]},
 2:{title:'「你比較資深」，後面通常沒有加人。',body:'同事帶著一個卡住的問題來找你。翅膀聽見後，順勢把整份救火工作塞過來，說資深就是要有解決問題的能力。你有經驗，並沒有因此多出第二雙手。',choices:[
  ['一起找出卡點，讓原本的負責人繼續接。','你把判斷過程講清楚，留下可以重做的步驟。同事學會了，資深這兩個字也沒有變成無限轉接專線。',{skill:6,trust:8,energy:-5},'team_support'],
  ['先確認影響範圍，把救火時間排進原定工作。','你接下需要專業判斷的部分，也把原本會延後的工作寫出來。翅膀不太愛看代價，但這次不能假裝它沒有發生。',{skill:5,trust:5,boss:-5,energy:-4},'evidence'],
  ['替自己架一座資深香爐：上香前請先附重現步驟。','紙做的香爐擺上桌，問題單旁邊多了重現步驟。拜過的人仍得一起查，神明今天也不包辦交付。',{skill:5,trust:4,boss:-4,mood:5,energy:-4},'handover_notes']
 ]},
 3:{title:'主任的「主」，先從專業主張開始。',body:'一個還沒驗證完的方案被放進對外簡報。翅膀說主任就是要能拍板，卻沒有給你改期限或調人力的權限。專業責任先到了，其他東西還在「公司會支持你」。',choices:[
  ['列出未驗證的部分，只對能確認的內容點頭。','你把判斷和依據寫在同一頁。簡報少了一點豪氣，後來的人多了一份知道哪些地方還不能碰的紀錄。',{skill:7,trust:7,boss:-7,energy:-5},'evidence'],
  ['找相關同事一起核對，留下可以追問的決定。','你找得到真的碰過這件事的人，沒有把主任理解成一個人猜完全部。交付多花了一輪確認，團隊少了一個隱藏炸點。',{skill:5,trust:9,boss:-3,energy:-6},'team_support'],
  ['把拍板做成一塊真的木板，請他先寫清楚承諾。','木板被你放在會議桌上，旁邊貼著期限、人力和驗證欄。翅膀嫌你有空做這個，你問那三欄是不是也有空補。',{skill:4,trust:6,boss:-6,mood:5,energy:-4},'board_minutes']
 ]}
};
const MANAGEMENT_WILD={
 4:['替排班表畫一扇任意門，請翅膀先示範怎麼補人。','門畫好了，人沒有從裡面走出來。你把缺口重新列回排班表，小組終於不用假裝主管會變出另一個自己。',{trust:7,boss:-6,skill:4,mood:4,energy:-4},'team_shield'],
 5:['替空白績效表辦招魂，先請具體事證現身。','你把缺的事證逐欄圈出來，連法事用的紅筆都準備好了。希望沒有召出紀錄，只能先把表帶回去補。',{trust:8,boss:-7,skill:4,mood:4,energy:-4},'evidence'],
 6:['拿空紙箱當新增人力，請簡報先教它上班。','紙箱坐進空位，沒有接走任何工作。你把它列進預算方案的展示頁，會議終於開始談要刪哪個承諾。',{trust:8,boss:-7,skill:5,mood:4,energy:-5},'team_shield'],
 7:['把願景印成登月證，請簽名的人一起登船。','你在每項未確認承諾後面留了決策者欄位。登月照還沒拍，先有人要求把航程和責任重新寫清楚。',{trust:7,boss:-8,skill:5,mood:4,energy:-5},'board_minutes']
};
export function getCareerDutyV17(run){
 const rank=Number(run.eventId.split('-').at(-1));
 if(!Number.isInteger(rank)||rank<1||rank>CAREER_MAX_RANK_V17||run.rank!==rank)throw new Error('Invalid career duty');
 if(rank<4){const duty=PROFESSIONAL_DUTIES[rank];return scene(run.eventId,duty.title,`你目前是${careerTitleV17(run)}。${duty.body}`,duty.choices.map(([text,result,delta,flag])=>c(text,result,delta,'careerResume',[`career_duty_${rank}`,flag])));}
 const oldRank=rank-3,oldRun={...run,rank:oldRank,assignment:'honest',eventId:`career-duty-${oldRank}`},event=applyPersonaCopy(getCareerDuty(oldRun));
 event.id=run.eventId;
 event.body=event.body.replace(/^你目前是[^。]+。/,`你目前是${careerTitleV17(run)}。`);
 event.choices=event.choices.map(choice=>({...choice,flags:choice.flags.map(flag=>flag===`career_duty_${oldRank}`?`career_duty_${rank}`:flag)}));
 const [text,result,delta,flag]=MANAGEMENT_WILD[rank];
 event.choices.push(c(text,result,delta,'careerResume',[`career_duty_${rank}`,flag]));
 return event;
}
export function getRankExitV17(run){
 const info=careerInfoV17(run);
 return scene('rank-exit','這張名片，想留在哪一頁？',`目前職稱是${info.title}，職級為${info.label}。這一階做過的工作，可以留成自己的故事；想繼續走，原本的工作也還在。`,[
  {...c(`以目前的${info.label}經歷，替這段人生收尾。`,'你把現在的職稱、做過的決定和留下的代價一起帶走。名片會換，這一段已經是你走過的路。',{},CAREER_FAMILIES_V17[run.rank]),available:careerEndingAvailableV17(run)},
  c('把名片攤成塔羅牌，翻翻其他職涯走向。','你把升遷、摸魚和那些忍很久的事情排成一列。牌面沒有替你決定，離場清單倒是整理出來了。',{},'legacyCareer'),
  {...c('有些離場的故事，想另外寫一頁。','你把這段時間收到的邀請、交接與合作記憶整理在一起。',{},'storyCareer'),available:eligibleStoryEndings(run).length>0},
  {...c('我想卸下管理職，換一種方式繼續工作。','你把想交回去的責任列出來。職稱和薪水會一起調整，這次先由你提出。',{},'careerStepDown'),available:canStepDown(run)},
  c('不需要別的頭銜了。我現在就走。','你決定離開。這次的最後一句，不用交給任何人代寫。',{mood:20},run.flags.pip_passed?'pip_exit':'ragequit'),
  ...(run.turn<24?[c('先回工作，我還有自己的打算。','你把這份清單留著，回去處理原本的事情。',{},'return')]:[])
 ]);
}
export function getCareerStepDownV17(run){
 return scene('career-step-down','這次，自己把椅子往後挪。','你想卸下管理責任，留下能繼續做事的位置。新薪資會按新職級調整；之後仍能重新準備升遷，現在先決定哪些責任不想再帶回家。',[
  {...c('交回管理權，回到專業員工的位置。',`你交回管理職稱，也交回一部分薪水。接下來先以${CAREER_LADDERS_V17[run.actualRoleId][1]}的身分工作，別人的績效表終於不再等你簽名。`,{energy:8,mood:10,boss:3,trust:5},'careerDemoteStaff',['career_step_down']),available:canStepDown(run)},
  {...c('退到副理，先顧好一個小組。',`你把部門層級的責任交回去，留下${CAREER_LADDERS_V17[run.actualRoleId][4]}的位置。薪水調低了，晚上的時間開始有機會調回來。`,{energy:6,mood:8,boss:3,trust:4},'careerDemoteDeputy',['career_step_down']),available:canStepDown(run)&&run.rank>4},
  c('先替主管椅貼上「暫停轉世」，回清單再想一想。','椅子沒有同意也沒有反對。你先記下想卸任的原因，這次還沒有變動。',{},'rankHub')
 ]);
}
