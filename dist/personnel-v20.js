// Original fictional personnel scenes. They are not descriptions of a legal
// entitlement or a promise that a real complaint will have a particular result.
export const PERSONNEL_SCENES=['dismissal-final','labor-claim','labor-mediation','floor-notice','watch-review','watch-future'];
export const WATCH_DAILY_IDS=['watch-empty-corridor','watch-invisible-invite','watch-exam-room'];
const c=(text,result,delta={},effect=null,flags=[])=>({text,detail:'',result,delta,effect,flags});
const o=(weight,label,result,delta,effect,flags=[])=>({weight,label,result,delta,effect,flags});
const draw=(text,label,outcomes)=>({...c(text,''),draw:{label,outcomes}});
const scene=(id,title,body,wing,choices,speaker='hope',kind='crisis')=>({id,title,body,wing,choices,speaker,kind,era:kind==='daily'?'三樓值班・五樓的空位':'人事異動・原創改編',sourceIds:['careerFiction']});
export function personnelSafe(run,event){return !run.pending&&!run.completed&&!run.raiseContext&&!run.rageContext&&!run.meltdownReturnEventId&&!run.resumeEventId&&!run.exitReturnEventId&&!run.breakReturnEventId&&!run.banquetReturnEventId&&['daily','fantasy'].includes(event?.kind);}
export function personnelDecision(run,reason,strength,drawValue){
 if(reason==='passed')return drawValue<.36?'freeze':null;
 if(reason==='post-pip'){
  if(drawValue<.65)return 'direct';
  if(drawValue<.95)return run.flags.floor_watch?'direct':'freeze';
  return run.pipCount<2&&run.turn<=20?'ordinary':'direct';
 }
 const chance=run.stats.boss<=3||strength>=22?.65:.25;
 return drawValue<chance?'direct':'ordinary';
}
export function freshPersonnelProvocation(run,event,choiceDelta){
 if(run.pip?.active||['crisis','self-care','rage','rage-world','banquet'].includes(event.kind)||PERSONNEL_SCENES.includes(event.id)||event.id.startsWith('pip-')||event.id==='paperwork')return null;
 const strength=-(choiceDelta.boss||0);if(strength<=0)return null;
 if(run.flags.post_pip_tolerance&&(run.stats.boss<=35||strength>=8))return {reason:'post-pip',strength,source:event.id};
 if(run.stats.boss+choiceDelta.boss<=12&&strength>=12)return {reason:'first',strength,source:event.id};
 return null;
}
export function watchNextEvent(run){
 if(run.turn>=24||(run.flags.floor_watch_days||0)>=(run.flags.watch_next_review||3))return 'watch-future';
 return WATCH_DAILY_IDS[(run.flags.floor_watch_days||0)%WATCH_DAILY_IDS.length];
}
export function getPersonnelEvent(run){
 switch(run.eventId){
 case 'pip-passed':return scene('pip-passed','PIP通過，耐心沒有續約。','希望寄來通過通知。你把目標逐項完成，翅膀沒有出席，也沒有因此重新喜歡你。留下來的人，還得面對接下來的安排；這張通知至少不能再說你沒有通過。','「讓你過，不代表之前的事我就忘了。」',[
  c('證明做得到就夠了，這次由我決定離開。','你保留通過紀錄，也保留離開的決定。這份改善計畫沒有替你決定下一份工作。',{mood:25},'pip_exit'),
  c('留下，把要求、交付和後續安排都記下來。','你沒有寄出感謝栽培，先存下通過通知。接下來的工作與座位，也要一項項對得上。',{mood:24,energy:12},'finishPip',['archive','evidence']),
  c('替通過通知買個相框，提醒自己真的有交作業。','相框先放抽屜，免得又被說太有空。你暫時留下，也開始練習把自己和公司的評語分開。',{mood:20,slack:12,energy:8},'finishPip')
 ]);
 case 'dismissal-final':return scene('dismissal-final','這次沒有改善期，只有離場時間。',`翅膀沒有出現。法師、Moon Dog與阿福把文件、交接清單和帳號停用時間放在同一張桌上。${run.flags.pip_passed?'你提醒他們PIP已經通過。法師說今天不是來重考，公司的決定已經下了。':'你問是否還有改善流程。對方回覆這次不安排PIP，先確認離場。'}這不是表格裡藏著第三次機會，接下來要決定的是你自己的紀錄與處理方式。`,'「這次沒有PIP方案。你的意見，可以另外留下。」',[
  c('先領書面通知、交接並離場。','你核對離場文件，沒有把公司叫你走改寫成自己突然想走。這次先離開現場，手上的紀錄仍留在自己這邊。',{mood:5},'layoff',['evidence','direct_exit']),
  c('不接受這個說法，整理資料向勞工局反映。','你把公司通知、薪資單與來回紀錄分開收好，決定反映這場爭議。今天沒有變成你自願離職，也沒有因為你提出異議就自動翻案。',{mood:-3},'laborClaim',['evidence','labor_report']),
  c('替「大家好聚好散」加一份附件：我要申請勞資調解。','你沒有替場面簽一張沒問題。文件袋封好，接下來把雙方說法放到另一張桌上談。',{mood:-2},'laborClaim',['evidence','labor_mediation_requested'])
 ],'exit-team');
 case 'labor-claim':return scene('labor-claim','離場通知之外，還有自己的版本。','你把工作通知、PIP紀錄、座位安排與薪資往來整理成時間線。這段遊戲的爭議會進入後續協商，結果還沒確定；你先決定要拿什麼去談。','「每一份都留日期，先把發生順序說清楚。」',[
  c('按時間整理事實和訴求，把不確定的部分另外標註。','你沒有替記不清楚的地方補台詞。通知與紀錄各自編號，下一次談話終於可以逐項對照。',{energy:-5,mood:-3},'laborMeeting',['evidence','archive']),
  c('請可靠的人陪著看資料，先把問題問完整。','對方沒有替你保證結果，先陪你把缺的資料列出來。你不必一個人同時扮演當事人、記錄員和安慰自己的人。',{energy:-4,trust:6,mood:3},'laborMeeting',['evidence']),
  c('做一份「本公司說法歷史版本」，請每次改口自己簽到。','你替每個版本標日期，最後仍把表情包放到附錄。桌上要談的內容留在前面，笑話留給下班後。',{energy:-4,mood:2,slack:4},'laborMeeting',['evidence','archive'])
 ],'self');
 case 'labor-mediation':{
 const evidence=Math.min(8,run.flags.evidence||0),settled=Math.min(72,34+evidence*4);
 return scene('labor-mediation','同一張桌子，終於不是只有公司能講話。','雙方把爭議與條件放上桌。法師仍然帶著文件，但這次你也帶了自己的時間線。有人願意談，不代表一定談得成；你能決定的是要不要接受眼前條件。','「把同意與不同意的地方分開，別用一句話包起來。」',[
  draw('逐項核對條件，確認能接受的內容。','這次協商的結果',[
   o(settled,'談成書面條件','幾輪來回後，雙方把這次能接受的安排寫成文件。你沒有在故事裡突然贏走整間公司，至少這次不是只帶走一句為你好。',{mood:12},'mediation_settled',['labor_settled']),
   o(100-settled,'本次沒有成立','這次沒有談成。你帶走會議紀錄與尚未解決的問題，沒有把未成立寫成自己沒事，也沒有假裝對方已經認錯。',{mood:-7},'mediation_pending',['labor_unresolved'])
  ]),
  c('條件仍不接受，留下未成立紀錄。','你沒有為了快點散場接受不清楚的條件。本次沒有成立，你把這一頁留好，再決定自己的下一步。',{mood:2},'mediation_pending',['labor_unresolved']),
  draw('把願景換算機搬上桌，請承諾先顯示單位。','這台機器算得出什麼',[
   o(38,'這次終於願意列項','計算機沒有幫你變出結果，逐項核對的問題倒是讓雙方把能談的部分列了出來。你只對最後確認的文字點頭。',{mood:8},'mediation_settled',['labor_settled']),
   o(62,'顯示結果仍是待確認','願景不能換算成雙方同意，這場仍然沒談成。你關掉計算機，把未確認項目一起帶走。',{mood:-4},'mediation_pending',['labor_unresolved'])
  ])
 ],'erich');}
 case 'floor-notice':return scene('floor-notice','辦公室在五樓，你的班表在三樓。','希望轉達翅膀的新安排：接下來去三樓看門。五樓的會議不再找你，原本的工作也被收走；薪水與名片暫時沒換，座位先被搬到沒有人需要你做事的地方。阿福來確認門禁，沒有人說這是升遷。','「先配合安排。公司沒有叫你離職，是你自己要想清楚。」',[
  c('先到三樓，把原職務與每天的安排都記下來。','你帶著原本的工作證坐到三樓。門沒有需要你開這麼多次，你把空白工時也逐日記在表上。',{mood:-17,energy:5},'watchStart',['evidence','archive']),
  c('請公司把調動原因、內容與期限寫清楚。','你問的不是三樓在哪裡，而是原本的工作為什麼不讓你做。希望說會再轉達，阿福暫時站在門邊等。',{mood:-8},'watchDispute',['evidence']),
  c('替三樓門口掛牌「策略性開門辦公室」，自己坐進去。','牌子沒有通過任何品牌審查。你坐下來，發現主管真的很會替沒有工作的人安排一整天上班。',{mood:-12,slack:8,energy:5},'watchStart',['archive']),
  c('這不是我接受的安排，整理資料申請調解。','你把座位調動與先前PIP的通知放在同一條時間線上，選擇走爭議處理，沒有先替公司寫成自己不適應。',{mood:-3},'laborClaim',['evidence','labor_report'])
 ],'hope');
 case 'watch-review':return scene('watch-review','問題在五樓，回答一直要你去三樓找。','希望帶回來的回覆只有「先配合」。你原本的職稱與薪水都還在，工作卻沒有跟著座位一起過來。對方不肯把期限講明，你要替自己決定下一步。','「安排已經通知了，先不要一直追問同一件事。」',[
  c('暫時配合，保留收入與完整的安排紀錄。','你沒有把暫時配合寫成認同。接下來每天發生什麼、沒有交辦什麼，都一起留下。',{mood:-8},'watchStart',['evidence']),
  c('不同意，帶著書面往來申請調解。','你把已問過與未被回答的項目列在一起，選擇讓這場爭議有另一份紀錄。',{mood:2},'laborClaim',['evidence','labor_report']),
  c('把門禁卡還回去，這次由我決定離職。','你不再等五樓給一個比較好聽的名字。通過PIP的紀錄帶走，三樓那張椅子留給公司的安排。',{mood:15},'pip_exit')
 ]);
 case 'watch-empty-corridor':return scene('watch-empty-corridor','今天的交付：門還在。','三樓沒有訪客，五樓也沒有交辦。你準時坐下，準時看著電梯燈亮，發現一整天沒有工作，和一整天不用工作，是兩種感覺。','「今天也在三樓，安排有照做。」',[
  c('把空下來的時間拿去練題，先照顧下一份履歷。','你做完一道題，門沒有因此變得比較難開。今天終於有一件事，是為了自己的下一站。',{skill:8,mood:-3,energy:5},null,['watch_study']),
  c('逐時記錄待命與沒有收到交辦的情況。','表格裡的空白也有日期。你沒有自己發明一個工作，替這次安排補上合理的外觀。',{trust:3,mood:-4,energy:7},null,['evidence','archive']),
  c('替門做季度績效：開關正常，從不要求你讀書。','門的考績順利通過。你比它需要更多休息，也比它更想離開這份班表。',{slack:9,mood:3,energy:8},null,['watch_study'])
 ],'self','daily');
 case 'watch-invisible-invite':return scene('watch-invisible-invite','五樓會議結束，你才知道今天有會。','水蛇下樓找一份資料，才發現你已經好幾天沒收到五樓的會議邀請。她問你現在負責什麼，你看了看旁邊的門。她停了一秒，把真正要問的工作問題說完。','「那份資料你還記得嗎？我不是來請你幫忙開門的。」',[
  c('把資料位置交代清楚，也記下自己已不在工作分配裡。','水蛇拿到正確的檔案位置。你把這次對話存好，沒有讓一聲謝謝替五樓補發那張邀請。',{skill:6,trust:8,mood:-4,energy:4},null,['evidence','meimei_met']),
  c('先把自己的作品集補完，下午再回覆她。','你把能帶走的成果整理出來。這次沒有在等誰記起你，回覆資料的時間也由自己排好。',{skill:8,mood:-2,energy:5},null,['watch_study']),
  c('宣布三樓分公司成立，請她帶一杯飲料當開幕花籃。','她帶來一杯飲料，沒有帶來一間真的分公司。你們在門邊聊完，今天至少有人叫的是你的名字。',{slack:8,trust:8,mood:7,energy:7},null,['meimei_met'])
 ],'meimei','daily');
 case 'watch-exam-room':return scene('watch-exam-room','門沒有新需求，你的考題有。','空白的工時表又多了一頁。你打開練習題，聽見樓上有人走動，忽然覺得自己的下一步不必一直等那部電梯。','「工作還沒回來，今天先把自己的問題做完。」',[
  c('把今天學會的東西寫成一份能展示的作品。','你收好能跑的成果。這幾天的座位不是你選的，時間至少有一部分重新用在自己身上。',{skill:10,mood:2,energy:3},null,['watch_study','handover_notes']),
  c('先把調動與待命紀錄備份，剩下的時間放空。','備份完成，通知仍然沒有響。你沒有替這場冷處理編一個自己很幸福的說法，但今天也不再把力氣全交出去。',{slack:8,mood:-2,energy:9},null,['evidence','archive']),
  c('讓門當面試官：第一題，離職原因請簡述。','門沒有追問你為什麼抗壓性不足。你把那段經歷講得簡短、具體，第一次沒有先替公司找台階。',{skill:6,mood:6,energy:6},null,['watch_study'])
 ],'self','daily');
 case 'watch-future':return scene('watch-future','三樓不是你的職涯終點。',`你已在三樓待命 ${run.flags.floor_watch_days||0} 個工作回合。薪水還會入帳，五樓卻仍沒有把工作交回來。你看著累積的紀錄、練習題和新的聯絡人，決定這段安排接下來要怎麼走。`,'「公司只說安排，你可以替自己決定打算。」',[
  c('帶著整理好的作品與紀錄，去找下一張辦公桌。','你沒有把看門寫成新專長。下一份履歷留下的是自己的成果，以及知道什麼時候該替自己開門。',{mood:12},'cold_storage'),
  draw('正式要求回原職務，請五樓給出明確回覆。','五樓這次的回信',[
   o(40,'工作交回來了','幾封往來後，原本的工作重新交回來。座位回五樓，先前的紀錄沒有刪掉，翅膀的耐心也沒有因此重新滿格。',{mood:10,trust:5},'watchRecall',['evidence']),
   o(60,'不再討論座位，改談離場','你要的是工作內容，對方卻改約離場談話。這次沒有再發一份改善表，文件與帳號停用時間先到了。',{mood:-12},'directDismissal',['evidence'])
  ]),
  {...c('先留住收入，繼續準備自己的下一步。','你把新的期限設給自己。三樓還是三樓，這次不用把往後的每一天都一起答應出去。',{mood:3,energy:4},'watchContinue'),available:run.turn<24},
  c('不再等調動說明，帶著紀錄申請調解。','你把沒有工作可做的每一天也放進時間線，選擇處理爭議，沒有把離場原因簡化成自己想休息。',{mood:2},'laborClaim',['evidence','labor_report'])
 ],'self','career');
 }
 throw new Error('Unknown personnel scene');
}
