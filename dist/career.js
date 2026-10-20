import { eligibleStoryEndings } from './story-career.js';
// The e8 career track is separate from the published role ladders.
export const CAREER_FAMILIES=['career_staff','career_deputy','career_manager','career_director','career_chief'];
export const CAREER_LEVELS=[
 {rank:0,label:'專業員工',payMultiplier:1,responsibility:'把自己的工作做好，也把下班時間留一點給自己。',pressure:{energy:0,mood:0}},
 {rank:1,label:'副理',payMultiplier:1.25,responsibility:'開始帶人、排班，替小組承接第一輪追問。',pressure:{energy:0,mood:-1}},
 {rank:2,label:'經理',payMultiplier:1.6,responsibility:'人力、績效與交付一起算在你頭上。',pressure:{energy:-1,mood:-1}},
 {rank:3,label:'總監',payMultiplier:2.1,responsibility:'協調部門預算，替上面的承諾找到下面的人。',pressure:{energy:-1,mood:-2}},
 {rank:4,label:'C-level／副總',payMultiplier:2.7,responsibility:'列席高層會議，也要為簽下去的決定負責。',pressure:{energy:-2,mood:-2}}
];
export const CAREER_LADDERS={
 system:['系統工程師','系統工程副理','系統工程經理','技術總監','技術長 CTO'],
 ai:['AI工程師','AI研發副理','AI研發經理','AI研發總監','人工智慧長 CAIO'],
 project:['專案經理','專案管理副理','專案管理經理','專案管理總監','營運副總 COO'],
 product:['產品經理','產品副理','產品部經理','產品總監','產品長 CPO'],
 design:['設計師','設計副理','設計經理','創意總監','首席創意長 CCO'],
 bd:['商務開發','商務開發副理','商務開發經理','商務策略總監','策略長 CSO'],
 sales:['業務','業務副理','業務經理','業務總監','商務長 CCO'],
 mis:['MIS工程師','資訊副理','資訊經理','資訊總監','資訊長 CIO'],
 executive:['營運企劃專員','營運副理','空降事業部經理','事業部總監','營運副總 COO']
};
const ASSISTANT_TITLES={system:'助理工程師',ai:'助理工程師',project:'專案助理',product:'產品助理',design:'助理設計師',bd:'商務開發助理',sales:'業務助理',mis:'助理工程師',executive:'名義主管'};
const MERIT=[{skill:50,trust:30,boss:35},{skill:55,trust:35,boss:40},{skill:65,trust:45,boss:45},{skill:75,trust:50,boss:50},{skill:82,trust:60,boss:60}];
const POLITICS=[{lick:55,boss:55},{lick:60,boss:60},{lick:70,boss:65},{lick:80,boss:75},{lick:88,boss:82}];
const bounded=(number,min,max)=>Math.max(min,Math.min(max,number));
const c=(text,result,delta={},effect=null,flags=[])=>({text,detail:'',result,delta,effect,flags});
const scene=(id,title,body,choices,speaker='wing')=>({id,title,body,wing:'「職稱給你了，事情也請你一起接好。」',speaker,kind:'career',era:'職涯異動',sourceIds:['careerFiction'],choices});

export function careerTitle(run){return run.assignment==='assistant'?ASSISTANT_TITLES[run.actualRoleId]:CAREER_LADDERS[run.actualRoleId][run.rank];}
export function careerStage(run){return CAREER_LEVELS[run.rank];}
export function careerInfo(run){
 const stage=careerStage(run),assistant=run.assignment==='assistant';
 return {...stage,title:careerTitle(run),label:assistant?'助理／待轉正':stage.label,assignment:run.assignment,nextTitle:assistant?CAREER_LADDERS[run.actualRoleId][0]:(CAREER_LADDERS[run.actualRoleId][run.rank+1]||null)};
}
export function careerSalary(run,rank=run.rank){return Math.min(500,Math.max(1,Math.round(run.basePay*CAREER_LEVELS[rank].payMultiplier)));}
export function careerEndingAvailable(run){return run.assignment!=='assistant'&&(run.rank===0?run.turn>=3:(run.flags[`career_duty_${run.rank}`]||0)>0||(run.flags[`career_work_${run.rank}`]||0)>0);}

// Actual work in the current position is separate from the review cooldown.
// Published e8 runs keep their original schedule and check probabilities.
export function careerReadiness(run){
 const assistant=run.assignment==='assistant',target=assistant?0:Math.min(4,run.rank+1),service=run.flags.career_service||0;
 const minService=assistant?2:([2,3,4,5,0][run.rank]),minTurn=assistant?3:([4,8,13,18,24][run.rank]);
 return {target,service,minService,minTurn,ready:(assistant||run.rank<4)&&service>=minService&&run.turn>=minTurn};
}

// Manual preparation and automatic invitations share a workday cooldown.
// e9 and older never call these new invitation rules.
export function careerReviewWait(run){return run.turn-run.lastPromotion>=3&&run.turn>=(run.flags.career_defer_until||0);}
export function careerInvitationEligible(run){
 return /^e(?:10|11|12|16)-/.test(run.seed)&&run.turn>=3&&run.turn<20&&run.rank<4&&!run.pip?.active&&careerReviewWait(run)&&careerReadiness(run).ready&&getCareerReview(run).choices.slice(0,2).some(choice=>choice.available!==false);
}

export function getCareerReview(run){
 const assistant=run.assignment==='assistant',target=assistant?0:Math.min(4,run.rank+1),s=run.stats,balanced=/^e(?:9|10|11|12|16)-/.test(run.seed);
 const title=assistant?CAREER_LADDERS[run.actualRoleId][0]:CAREER_LADDERS[run.actualRoleId][target],merit=MERIT[target],politics=POLITICS[target];
 const healthy=(assistant||run.rank<4)&&!run.pip?.active&&s.energy>10&&s.mood>12&&(!balanced||careerReadiness(run).ready);
 const effect=assistant?'careerRegularize':'careerPromote';
 const check=(choice,chance,available,success,failure)=>({...choice,available,check:{chance,success:{...success,effect},failure:{...failure,effect:null}}});
 const event=scene('career-review',assistant?'先把「助理」兩個字談掉。':`下一張名片，多一層責任。`,assistant?`你目前是${careerTitle(run)}。這次評核要談的是轉回正式專業職，還不是升任主管。Wing把「先證明自己」說得很熟練；你把這段時間交付的工作攤在桌上。`:`你目前是${careerTitle(run)}，這次要談的是${title}。薪資、帶的人和要替誰說明，都會跟著變。Wing說他看重的是承擔，你知道承擔通常會比授權先到。`,[
  check(c('拿交付和合作紀錄，談下一個職級。',''),bounded(.12+s.skill*.0045+s.boss*.002+s.trust*.0015-target*.02-(balanced?(target===4?.22:target===3?.1:0):0),.18,balanced?(target===4?.55:target===3?.70:.88):.88),healthy&&Object.entries(merit).every(([key,value])=>s[key]>=value),{result:assistant?'交付紀錄攤開來，這次終於把助理兩個字拿掉。接下來要升什麼，是下一張考卷。':'你把做過的事情和同事的回饋放進同一份資料，換到了新的職級。薪水會調，責任也會照表寄來。',delta:{skill:4,trust:4,boss:3,mood:6,energy:-4},flags:['promotion_merit']},{result:'資料看過了，Wing說還要再觀察。職稱沒變，你至少把下一次要談的證據留下來。',delta:{skill:2,mood:-7,boss:-5}}),
  check(c('把他的方向寫成成績，讓他願意點頭。',''),bounded(.12+s.lick*.006+s.boss*.003-target*.025-(balanced?(target===4?.3:target===3?.15:0):0),.18,balanced?(target===4?.50:target===3?.68:.9):.9),healthy&&Object.entries(politics).every(([key,value])=>s[key]>=value),{result:assistant?'Wing對這份報告的理解十分順利：都是他帶得好。你得到正式職稱，同事則替這次驗收交換了一個眼神。':'你把Wing的遠見放在首頁，連你沒做過的部分都寫成他帶領的成果。組織圖動了，群組裡願意跟你講真話的人少了幾個。',delta:{lick:5,boss:5,trust:-8,mood:4,energy:-4},flags:['promotion_politics']},{result:'他說你只會講漂亮話。這份稿上週還叫作方向正確，今天先算你沒有掌握重點。',delta:{mood:-8,boss:-7,trust:-3}}),
  c('先補帶人的本事，下次帶著準備再來。','你找同事把交付、溝通和帶人的工作逐項補上。這次沒拿新名片，至少不是空著手等下一次評核。',balanced?{skill:5,lick:2,trust:3,mood:-3,energy:-4}:{skill:8,lick:4,trust:3,mood:-3,energy:-3},'careerTrain'),
  c('這次先不升。我想把現在的生活顧好。','你把這次評核留在這裡。少一張新名片，也少接一輪不是自己排進來的責任。',{mood:10,energy:8,slack:6,boss:-3},'careerDefer')
 ]);
 if(/^e(?:10|11|12|16)-/.test(run.seed)){
  const previous=run.flags.career_last_review_target===target+1?run.flags.career_last_review_result:0;
  if(!event.choices.slice(0,2).some(choice=>choice.available!==false)){
   event.title='先整理籌碼，不急著換名片。';
   event.body=`你目前是${careerTitle(run)}，下一步想談的是${title}。這次先把交付、合作和帶人的紀錄整理好；正式往下一階談，準備和工作經歷都得跟得上。今天可以補強，也可以先回去過自己的日子。`;
   event.wing='「先證明自己。職稱的事，之後再談。」';
   if(previous===1)event.body+=' 上次補過的地方先留著，這回挑還沒準備好的部分。';
   if(previous===2)event.body+=' 上次你說先不要，這次何時再準備，仍由你決定。';
   if(previous===3)event.body+=' 上次那句「再觀察」沒有替你做事，這回也不用只等他的評語。';
  }else if(previous===1){
   event.title='準備過的那份，這次拿出來談。';
   event.body=`上次你先補交付、合作和帶人的本事，沒有急著換名片。又做了一段時間的${careerTitle(run)}，現在把手上的紀錄攤開，重新談${title}。Wing還是先談責任，你這次沒有只帶著一句「我會努力」。`;
  }else if(previous===2){
   event.title='你上次說先不要，這次再問一次。';
   event.body=`前一次你把升遷擱著，先顧好現在的生活。過了一陣子，${title}又被放上桌。你目前仍是${careerTitle(run)}，這回要往前談，還是照原本的打算走，都可以自己選。`;
  }else if(previous===3){
   event.title='再觀察之後，還是你來準備。';
   event.body=`上回談${title}，Wing用一句「再觀察」收尾。這次你仍是${careerTitle(run)}，多了這段時間實際交付和合作的紀錄。新資料放上桌，他若又要談格局，至少不能說你只帶了上次那一份。`;
  }
 }
 if(balanced&&target>=3){event.body+=' 這一階還得等職缺與高層點頭，任期和成果夠了，也不保證這次輪得到你。';event.wing='「坐過那張椅子，不代表下一張就有你的名字。」';}
 return event;
}

const DUTIES={
 1:{title:'副理的第一件事：替誰把空格補上？',body:'小組排程缺了一個人。Wing說副理就是要補位，沒有說補的是人力還是自己的晚上。你剛拿到的新職稱，第一次被用在排班表上。',choices:[
  ['把不合理的期限寫出來，替同事擋一輪。','你把缺口和需要的人力一起說清楚。Wing不太喜歡這種報告，小組第一次知道有人願意替他們把話講完。',{trust:10,boss:-9,mood:5,energy:-6},'team_shield'],
  ['我來補，先讓大家今天能下班。','你把自己的名字填進空格。同事記得這份情，但副理的第一晚沒有跟著升級。',{trust:7,energy:-12,mood:-5,skill:5},'team_support'],
  ['照原期限往下交代，讓大家一起想辦法。','期限保住了，Wing點頭了。小組收到那句熟悉的「大家有彈性一點」，只是這次由你轉寄。',{boss:10,lick:6,trust:-12,mood:-5},'wing_delegate']
 ]},
 2:{title:'這張改善計畫，要填誰的名字？',body:'Hope寄來績效表，希望你給一個「需要改善」的名額。交付紀錄沒有這個結論，表格卻已經留好簽名處。經理的授權第一次完整出現，是請你替別人的決定署名。',choices:[
  ['先附實際交付，不替空白結論填名字。','你把工作紀錄一份份附上，讓「改善」必須先有具體內容。Hope把表退回來補件，Wing也終於知道你不是只有在填日期。',{trust:12,boss:-12,skill:5,energy:-7},'team_shield'],
  ['先讓當事人看過，連同異議一起記錄。','你沒有替誰保證結果，卻讓這張表第一次出現當事人的回答。簽名的位置還在，旁邊多了不能當作沒看過的文字。',{trust:8,boss:-5,energy:-5,mood:3},'evidence'],
  ['照上面的意思填，讓流程往下走。','表格很快交回去。Wing說你開始有管理者的樣子，辦公室有人從此只在郵件裡跟你說話。',{boss:12,lick:7,trust:-15,mood:-8},'wing_delegate']
 ]},
 3:{title:'總監會議，預算只剩減號。',body:'部門預算被砍，對外承諾維持原價。Wing要你交一份能立刻省錢的方案，還補一句不要讓團隊士氣受影響。你看著人力表，知道每個數字都會有人接到通知。',choices:[
  ['先刪沒人用的承諾，保住正在做事的人。','你把專案範圍、閒置訂閱和重複工作列成清單。簡報不夠漂亮，但團隊今天沒有因為一個總數失去座位。',{trust:12,boss:-10,skill:6,energy:-7},'team_shield'],
  ['把做不到的地方寫進預算決議，請上面選。','你把需求、人力與代價放在同一頁。會議多開了兩輪，至少最後的決定不再只有你的名字。',{trust:7,boss:-4,energy:-5,mood:3},'board_minutes'],
  ['保留承諾，把缺口攤給每一個人。','預算表平了，工作表往右多了幾欄。Wing說這就是效率，大家開始私下交換求職網站的連結。',{boss:12,lick:7,trust:-16,mood:-8},'wing_delegate']
 ]},
 4:{title:'名字放進高層名單，簽名也一起放。',body:'你的名字已列在高層名單。董事會資料同時寄來一份還沒核對完的承諾，Wing希望你先簽，說細節之後有人處理。坐進這張椅子之後，你終於看見「有人」最後會寫誰的名字。',choices:[
  ['先列出沒有確認的內容，再決定能簽什麼。','你把不確定的承諾逐項標出，請決策者連同風險一起確認。敲鐘照還沒有拍，會議紀錄已經多了幾個完整的名字。',{trust:10,boss:-12,skill:6,energy:-6},'board_minutes'],
  ['只簽已經驗證的部分，其他留待下一次。','你沒有替整份願景背書。Wing嫌你保守，會議室外的人倒是第一次知道這張職稱還能拿來說一句到此為止。',{trust:8,boss:-6,mood:6,energy:-4},'team_shield'],
  ['先讓願景過關，細節回部門再補。','你的簽名讓會議繼續，也讓承諾有了可以追問的負責人。Wing拍了拍你的肩，下一封信直接副本給所有主管。',{boss:14,lick:8,trust:-18,mood:-10},'wing_delegate']
 ]}
};
export function getCareerDuty(run){
 const rank=Number(run.eventId.split('-').at(-1)),duty=DUTIES[rank];
 if(!duty||run.rank!==rank)throw new Error('Invalid career duty');
 return scene(run.eventId,duty.title,`你目前是${careerTitle(run)}。${duty.body}`,duty.choices.map(([text,result,delta,flag])=>c(text,result,delta,'careerResume',[`career_duty_${rank}`,flag])),rank===2?'hope':'wing');
}
export function getRankExit(run){
 const info=careerInfo(run);
 return scene('rank-exit','這張名片，想留在哪一頁？',`目前職稱是${info.title}，職級為${info.label}。你可以把這一階的故事收好，也可以整理別的離場經歷。想繼續做下去，原本的工作仍在。`,[
  {...c(`以目前的${info.label}經歷，替這段人生收尾。`,'你把現在的職稱、做過的決定和留下的代價一起帶走。名片會換，這一段已經是你走過的路。',{},CAREER_FAMILIES[run.rank]),available:careerEndingAvailable(run)},
  c('翻開原本的職涯清單，看看還想留下什麼。','你把升遷、摸魚與那些累積已久的紀錄重新攤開。',{},'legacyCareer'),
  {...c('有些離場的故事，想另外寫一頁。','你把這段時間收到的邀請、交接與合作記憶整理在一起。',{},'storyCareer'),available:eligibleStoryEndings(run).length>0},
  {...c('我想卸下管理職，換一種方式繼續工作。','你先把想交回去的責任列出來。職稱和薪水會一起調整，這次先由你提出。',{},'careerStepDown'),available:run.assignment!=='assistant'&&run.rank>0&&!run.resumeEventId&&run.turn>=1&&run.turn<24},
  c('不需要別的頭銜了。我現在就走。','你決定離開。這次的最後一句，不用交給任何人代寫。',{mood:20},run.flags.pip_passed?'pip_exit':'ragequit'),
  ...(run.turn<24?[c('先回工作，我還有自己的打算。','你把這份清單留著，回去處理原本的事情。',{},'return')]:[])
 ]);
}
export function getCareerStepDown(run){
 return scene('career-step-down','這次，自己把椅子往後挪。','你想卸下管理責任，留下能繼續做事的位置。新薪資會按新職級調整，之後仍可以重新準備升遷；現在先決定，哪些責任不想再帶回家。',[
  {...c('交回管理權，回到專業員工的位置。','你交回管理職稱，也交回一部分薪水。接下來先把自己的工作做好，別人的績效表終於不再等你簽名。',{energy:8,mood:10,boss:3,trust:5},'careerDemoteStaff',['career_step_down']),available:run.assignment!=='assistant'&&run.rank>0&&!run.resumeEventId&&run.turn>=1&&run.turn<24},
  {...c('退到副理，先顧好一個小組。','你把部門層級的責任交回去，留下比較能看見人臉的小組。薪水調低了，晚上的時間開始有機會調回來。',{energy:6,mood:8,boss:3,trust:4},'careerDemoteDeputy',['career_step_down']),available:run.assignment!=='assistant'&&run.rank>1&&!run.resumeEventId&&run.turn>=1&&run.turn<24},
  c('先保留現在的職級，回離場清單想一想。','你把卸任的念頭先記下，這次還沒有變動。',{},'rankHub')
 ]);
}

export const CAREER_DAILY_EVENTS=[
 {id:'deputy-late-shift',minRules:8,minRank:1,maxRank:1,weight:3,title:'副理沒有代理人。',body:'小組有人請假，會議邀請自動多了一位你。Wing說這叫培養主管，你的行事曆看起來比較像正在填海。',wing:'「你現在是主管，要有補位的觀念。」',speaker:'wing',sourceIds:['careerFiction'],choices:[c('先調範圍，再決定誰需要留下。','你把缺的人力和能交的範圍寫清楚。Wing嫌你想太多，小組今天至少知道下班時間在哪裡。',{skill:6,trust:8,boss:-8,energy:-5},null,['team_shield']),c('我補，先讓其他人把手上的事做完。','你補上那一段空白。小組有人替你帶了晚餐，會議還是由你收尾。',{trust:7,energy:-10,mood:-4},null,['team_support']),c('先照期限走，我會替大家加油。','你把主管群組的原句轉到小組群組。沒有新增人力，但你在兩邊都完成了已讀。',{boss:9,lick:7,trust:-10,mood:-5},null,['wing_delegate'])]},
 {id:'manager-pip-signature',minRules:8,minRank:2,maxRank:2,weight:3,title:'改善計畫，改善誰的簽名速度？',body:'Hope把一份寫了一半的PIP寄給你，請你補上可衡量的目標。當事人的工作紀錄還沒附，主管簽名欄已經放好你的名字。',wing:'「主管最了解部屬，這部分就請你協助。」',speaker:'hope',sourceIds:['careerFiction'],choices:[c('把實際交付附上，請先說明差距。','你把目標和工作紀錄放在同一份信裡。這次來回的附件多了，沒有人能只靠一句態度不佳往下送。',{skill:7,trust:10,boss:-10,energy:-6},null,['evidence','team_shield']),c('和當事人一起把異議記完整。','你沒有保證流程的結果，只把原本沒被詢問的人拉回討論裡。這份紀錄至少有兩邊的聲音。',{trust:8,mood:3,boss:-5,energy:-4},null,['evidence','handover_notes']),c('照範本填完，先讓流程過關。','欄位齊了，簽名也齊了。Wing說你管理得很有效率，部門開始把重要的事改用私訊講。',{boss:11,lick:7,trust:-13,mood:-7},null,['wing_delegate'])]},
 {id:'director-budget-room',minRules:8,minRank:3,maxRank:3,weight:3,title:'總監的資源，就是再想辦法。',body:'預算被砍一輪，對外簡報卻新增兩個專案。Wing說你坐到總監就要會整合資源，你把所有資源加起來，最後還是只有原本那幾個人。',wing:'「不要每次都跟我要人，要先想怎麼做。」',speaker:'wing',sourceIds:['careerFiction'],choices:[c('把哪些承諾得延後，連同代價一起提出。','你把順序排出來，請上面挑要保哪幾件。會議沒有變輕鬆，部門的晚上至少少了一種不可能。',{skill:8,trust:9,boss:-9,energy:-6},null,['team_shield','board_minutes']),c('找其他主管互換資源，留下交換條件。','你把一次順手幫忙寫成可以核對的合作。事情推動了，還不用假裝每個部門都有無限人力。',{skill:5,trust:7,cash:-5,mood:3},null,['alumni_links']),c('對上說有機會，回去請大家再撐一段。','簡報維持原定日期，團隊多了一句主管也沒辦法。Wing的行事曆沒有變，你們的周末開始排工作。',{boss:12,lick:8,trust:-14,mood:-8},null,['wing_delegate'])]},
 {id:'chief-title-proofread',minRules:8,minRank:4,maxRank:4,weight:3,title:'都升到首席了，先校正大家的稱呼。',body:'高層群組有人把你的新職稱少打了兩個字。Wing立刻請行政更新簽名檔、名片和所有簡報，專案缺的那位同事則還在等補人核准。',wing:'「職稱要正確，對外才有一致的形象。」',speaker:'wing',sourceIds:['careerFiction'],choices:[c('名片可以改，缺的人力也請一起看。','你把職稱更新和人力需求放進同一份待辦。Wing只想先驗收字數，你還是留下了不能靠字級解決的那一欄。',{trust:10,skill:6,boss:-9,energy:-5},null,['team_shield','board_minutes']),c('先補完決議紀錄，不替沒確認的承諾簽名。','簽名檔寄出前，你把未確認的承諾逐項標記。會議多了一份附件，後面追問時不會只剩一個名字。',{trust:7,boss:-5,energy:-5,mood:4},null,['board_minutes','handover_notes']),c('請大家以新職稱稱呼，形象先到位。','所有簡報都更新了。你看起來比昨天更像高層，底下的人則比昨天更確定該把話留在私下。',{boss:13,lick:8,trust:-15,mood:-8},null,['wing_delegate'])]}
];
