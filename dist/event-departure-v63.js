import {isParticipationV63} from './participation-profile-v63.js';

export {isParticipationV63} from './participation-profile-v63.js';
const categories=['blockchain','gap','onboarding','activity','invitation','treats','shareholder','recruitment','hidden','meal','rest','salary','patronage','company','wealth','personnel','pip-review','pip-passed','collapse','chapter','rage','verbal','career','work','private'];
const personnel=new Set(['crisis-boss','paperwork','dismissal-final','labor-claim','labor-mediation','floor-notice','watch-review','watch-future','education-scrutiny']);
const knownTargets=new Set(['wing','spencer','erich','sonny','jenjen','rick','kind','hope','jack','meimei','helen','sophie','jonathan','owen','sam','cindy','professor','annie_yu','princess','joyce','janet','captain','hidden-visitor','zoe','action','hester','simon','james','johnny']);

export function eventDepartureCategoryV63(run,event){
 if(event?.id==='work-gap-v50')return 'gap';
 if(run?.blockchainContext)return 'blockchain';
 if(run?.activityInvitationContext)return 'invitation';
 if(run?.activityContext)return 'activity';
 if(run?.treatsContext)return 'treats';
 if(run?.shareholderContext)return 'shareholder';
 if(run?.recruitmentContext)return 'recruitment';
 if(run?.hiddenEncounterContext)return 'hidden';
 if(run?.verbalContext)return 'verbal';
 if(run?.rageContext)return 'rage';
 if(run?.chapterContext)return 'chapter';
 if(event?.id==='onboarding')return 'onboarding';
 if(['mood-collapse','mood-self-destruct'].includes(event?.id))return 'collapse';
 if(event?.id==='pip-review')return 'pip-review';
 if(event?.id==='pip-passed')return 'pip-passed';
 if(personnel.has(event?.id))return 'personnel';
 if(run?.mealContext)return 'meal';
 if(run?.raiseContext||run?.salaryAdvice?.status==='open'||/^salary-/.test(event?.id||''))return 'salary';
 if(run?.patronageContext)return 'patronage';
 if(run?.companyContext)return 'company';
 if(run?.wealthReturnEventId)return 'wealth';
 if(run?.breakReturnEventId||run?.meltdownReturnEventId||event?.id==='crisis-mood')return 'rest';
 if(['daily','fantasy'].includes(event?.kind))return 'work';
 if(event?.scope==='private'||run?.banquetReturnEventId)return 'private';
 return 'career';
}

export function eventDepartureDescriptorV63(run,event){
 const no=reason=>({available:false,label:'離開這個場合',detail:'',reason});
 if(!isParticipationV63(run))return no('這段人生保留原有規則。');
 if(run.completed)return no('這段人生已經結束。');
 if(run.pending||run.departureContext)return no('先看完已經發生的結果，再決定是否離開下一個場合。');
 if(run.pendingFamily)return no('收尾已經確定，不能用離開現場撤回。');
 if(!event||run.actions.length>=299)return no('先完成眼前已經開始的收尾。');
 const category=eventDepartureCategoryV63(run,event);
 const words={
  blockchain:['這輪我先退出，資料留給原負責人。','離開目前的跨部門計畫，不替尚未確認的工作點頭。'],
  gap:['結束這段空檔，回去上班。','只結束目前的空檔，下一件工作還沒作答。'],
  onboarding:['這份任用我不接受，現在離開。','拒絕這份任用，結束今天的報到。'],
  activity:['我先離場，這場不繼續了。','中止目前的活動；已發生的花費與經過會保留。'],
  invitation:['這場我不參加，先走了。','婉拒這次邀請，回到原本的安排。'],
  treats:['這段我先退場，你們繼續。','離開目前的點心場合，回去處理原本的事。'],
  shareholder:['文件我收好，現在先離場。','離開這場認股說明或股東會；持股、已付款項與債務照舊。'],
  recruitment:['介紹先到這裡，我回座位了。','結束這次入職介紹，不撤回已經確認的任用。'],
  hidden:['我先走了，改天再聊。','離開這次意外相遇。'],
  meal:['今天先不吃了，我先走。','取消尚未下單的飯局；已經發生的消費不退。'],
  rest:['先不安排了，我回去。','離開目前的休息安排，不購買還沒選的項目。'],
  salary:['這輪先不答應，我離開現場。','不接受尚未確認的新條件，保留目前已生效的薪資與書面爭議。'],
  patronage:['這份家譜先別替我填，我先走。','結束這輪特殊任用申請，不接受尚未成立的任用。'],
  company:['這輪簡報我先不跟，離開會場。','先退出這次公司計畫的討論，不替尚未決定的方案表態。'],
  wealth:['計畫先收起來，我現在離開。','關掉尚未確認的規劃，不投入新的創業或退休費用。'],
  personnel:['我不留在這裡談，請把通知寄給我。','離開談話現場；公司已發出的通知與待處理爭議不會撤回。'],
  'pip-review':['評核我不再答辯，先離開現場。','退出本次評核，不把缺席當作通過。'],
  'pip-passed':['通過通知我收到了，先離開這場談話。','結束這場談話，已確認的 PIP 紀錄仍然保留。'],
  collapse:['我決定離職，先把自己帶離這裡。','你已經無法繼續，這次明確結束任職，不把離場當成恢復心情。'],
  chapter:run.chapterContext&&['burnout','broke'].includes(run.chapterContext.family)?['我決定離職，現在離開公司。','確認結束任職；已經耗盡的資源不會因離開現場恢復。']:['這場風波先到這裡，我離開現場。','結束這次風波，不撤回已經發生的經過。'],
  rage:['我先離開現場，後續照通知處理。','先離開這場衝突；實際出手、費用與待處理責任都不會消失。'],
  verbal:['話說到這裡，我先離開。','結束這輪對話，已說的話與後續通知仍然保留。'],
  career:run.resumeEventId||run.exitReturnEventId?['這輪先不決定，我離開談話。','不接受尚未確認的人事條件，回到原本的安排。']:['我決定離職，現在離開公司。','明確結束任職，不再等待下一個公司計畫。'],
  work:['今天這件事我不接了，直接離開。','離開今天的工作場合，今天不算完成交付；這句話本身不是離職申請。'],
  private:['這攤我先走，你們繼續。','結束自己的參與；已經發生的花費與人情往來會保留。']
 };
 if(category==='activity'){
  const labels={camel:'這場駱駝我先下車，名牌還你。',arm:'手先收回來，這場我不比了。',diet:'這張排名表先別算我，我退出。',roadshow:'我先離場，這輪請另找人接手。',dinner:'我先離席，這桌你們慢慢吃。',banquet:'今晚先到這裡，我先走了。',basketball:'我下場了，這波請換人。',review:'這輪我先退出，後續請改用書面。'};
  words.activity=[labels[run.activityContext.id]||words.activity[0],'結束自己的參與，先前已發生的經過照常留下。'];
 }
 if(category==='treats')words.treats=[{ 'jack-drinks':'這杯先不用幫我算，我先走。','company-tea':'下午茶我先退場，你們繼續。','birthday-cake':'生日快樂，我先走了。'}[run.treatsContext.id],words.treats[1]];
 if(category==='shareholder')words.shareholder=[run.shareholderContext.stage==='offer'?'認股資料先還你，我不參加了。':run.shareholderContext.stage==='gate'?'今天我不入場，資料我自己收好。':'文件我收好，現在先離場。',words.shareholder[1]];
 if(category==='verbal'&&run.verbalContext.eventId==='onboarding'&&run.verbalContext.phase==='event')words.verbal=run.verbalContext.outcome==='personnel'?['任用通知我收到了，現在離開。','離開報到現場，保留公司撤回任用的通知。']:['這份任用我不接受，現在離開。','拒絕尚未完成的任用，結束今天的報到。'];
 const [label,detail]=words[category];return {available:true,label,detail,reason:''};
}

export function resolveEventDepartureV63(run,event,ticket){
 const descriptor=eventDepartureDescriptorV63(run,event);
 if(!descriptor.available||!Number.isFinite(ticket)||ticket<0||ticket>=1)throw new Error('Unavailable event departure');
 const category=eventDepartureCategoryV63(run,event),target=knownTargets.has(event.speaker)?event.speaker:null;
 let delta={},affinityDelta=0,result='你把話說清楚，拿起自己的東西離開。原本已經發生的經過留在紀錄裡，沒有因為你走出門就重來。';
 if(category==='work'){
  const furious=ticket>=.88,quiet=ticket<.22;
  delta={boss:furious?-22:quiet?-3:-11,trust:furious?-8:-3,mood:2};affinityDelta=target=== 'wing'?(furious?-12:quiet?0:-5):target?-3:0;
  result=quiet?'你直接收起東西，留下今天還沒交付的工作。這次沒有人當場追出來，但缺席還是留在紀錄上；你沒有提出離職，也沒有完成這一天的工作。':furious?'你轉身就走，翅膀隨後收到擅離的消息，當場要求人事記下來。這不是自願離職書，卻也不會被寫成完成交付；後續通知還得面對。':'你說今天不接了，走出工作現場。同事得重新安排眼前的交辦，翅膀也收到消息。這一天沒有工作收入、沒有完成交付，你仍然是這間公司的員工。';
  if(run.pip?.active)result+=' 這也是一個改善日：缺席記零分，期限照樣少一天，評核不會等你回來才開始。';
 }else if(category==='blockchain'){affinityDelta=target?-4:0;result='你明確表示退出這輪區塊鏈計畫，交還已整理的資料，把尚未同意的範圍分開。順哥重新安排剩下的待辦，沒有替你簽下免費兼任；這次離開的是計畫現場，原本的工作與已發生的經過仍保留。';}
 else if(category==='onboarding'){delta={mood:5};result='你明確表示不接受這份任用，把還沒收下的名片放回桌上。今天的報到到此結束，沒有替自己補簽任何新職稱或新薪資；這是你拒絕任用，並非公司資遣。';}
 else if(category==='gap')result='你結束這段空檔，準備接著處理下一件工作。還沒有新的選擇被作答，也沒有多算一個工作日。';
 else if(category==='activity'){
  affinityDelta=target?(ticket<.65?-2:-7):0;
  const reactions={camel:'你向丁哥說先走，把紙名牌還到桌上。已抽過的骰色與位置保留，沒有完成六輪就不補排名，也不把活動點換成現金。',arm:'你把手收回來，表示這場不比了。阿福立刻補一句「我本來也沒有要比」，彷彿退出名單才是今天真正的冠軍榜。',diet:'你請主辦把自己從排名裡移除。比賽少一位參賽者，正常吃飯並沒有一起被取消，也沒有人能再替你的便當打分數。',roadshow:'你告知現場需要換人，水蛇只好臨時接手這輪訪客。人沒有因為你離開就少來一批，後面的分工又得重排。',dinner:'你向同桌的人打聲招呼，先離席。大家繼續吃，你沒有把餐桌變成離職面談，也沒把已上桌的消費變成退款單。',banquet:'你拿好自己的東西，提早離開尾牙。麥克風還在傳，抽獎也不替你暫停；沒出發的續攤沒有收費，今晚先到這裡。',basketball:'你跟傑克說先下場，他招手叫候補補進來。阿福繼續當移動迷宮，歐文的拐子留給場上處理，你沒有再硬撐下一波碰撞。',review:'你表示這輪退出，請後續改用書面。窗口重新安排回覆人，沒有把你的空位寫成「審查通過」，還沒回答的問題仍留在清單上。'};
  result=(reactions[run.activityContext.id]||'你跟現場的人說先走，退出這場活動。')+' 先前的操作與花費照樣留下，這次沒有完成整場，也不會再重開同一場。';
  if(['roadshow','review'].includes(run.activityContext.id))delta={trust:ticket<.65?-3:-7,boss:ticket<.65?-2:-5};
 }else if(category==='invitation')result='你明確回覆這次不參加，對方把你從這次人數裡劃掉。你沒有出發、沒有付新的活動費用，回去接著處理原本的事。';
 else if(category==='treats'){
  affinityDelta=target?(ticket<.7?0:-4):0;result=run.treatsContext.id==='jack-drinks'?'你謝過傑克，說自己先走。尚未點的那杯沒有下單；若飲料已送到，傑克仍是請客的人，你沒有突然替強哥的滿料杯買單。這段請客到此為止。':run.treatsContext.id==='company-tea'?'你告知船長後先離開下午茶現場。已經拿錯的杯子不會復原，已公布的取消也不會撤回；還沒發生的事，則不替你補成在場目擊。你沒有拿走一筆下午茶退款。':'你向壽星們說先走，沒有再答應把分切或收拾接下來。合照與剛才已發生的經過留在原處，這場生日會沒有因為你離開就替你補上善後。';
 }else if(category==='shareholder')result=run.shareholderContext.stage==='offer'?'你把尚未簽署的認股資料放回桌上，離開說明現場。這次沒有認購、沒有新增借款，也沒有拿到這次股東會資格。':run.shareholderContext.stage==='gate'?'你告訴真真今天不入場，自己收好收據離開，沒有把委託投票當成自動同意。股份仍在名下，已付的認股款沒有退回。':'你收好手上的文件，告知主持人後離開會場。提出過的問題與已取得的文件仍在紀錄裡；尚未做完的攻防不算完成，股份、認股款與貸款也都還在。';
 else if(category==='recruitment'){affinityDelta=target?-6:0;result='你說介紹先到這裡，直接回座位。對方記住你沒把話聽完，剛才已生效的特殊任用與薪資卻沒有因此撤銷；今天也沒有多上一天班。';}
 else if(category==='hidden'){affinityDelta=target?-2:0;result='你收起話題，跟對方說先走。這次相遇到此為止，沒有替尚未答應的安排補上一句同意。';}
 else if(category==='meal'){affinityDelta=run.mealContext.guest?(ticket<.55?-2:-9):0;result=run.mealContext.guest?'你向對方說今天先不吃了，取消還沒送出的點餐。對方'+(ticket<.55?'點頭，讓你下次早點說。':'收起菜單，臉色比剛才冷了一點。')+'你沒有吃這餐，也沒有付尚未成立的餐費；之前已發生的消費不會倒回來。':'你關掉邀約名單，今天先不約人吃飯。沒有替任何人訂位，也沒有新增餐費。';}
 else if(category==='rest')result='你收起還沒確認的休息安排，離開這個場合。沒有購買新的項目，心情與體力也不會憑空補回來；這次已使用的空檔仍算用過。';
 else if(category==='salary'){affinityDelta=target?-3:0;result='你表示這輪不接受新的口頭條件，先離開談話。尚未確認的加薪沒有生效，未同意的降薪也沒有套上去；已生效的薪資與先前的爭議仍留著，離場不是替公司簽同意。';}
 else if(category==='patronage')result='你把申請話題停在這裡，先離開。沒有新名片，也沒有因為聽過說明就自動改稱呼；原本的職位與薪資照舊。';
 else if(category==='company')result='你先離開公司計畫的討論，沒有替尚未決定的方案點頭。簡報留在會場，你的任職沒有因為退出這輪說明而自動結束。';
 else if(category==='wealth')result='你把計畫收起來，暫時不作新的投入。尚未確認的創業或退休沒有開始，這輪也沒有多付一筆費用。';
 else if(category==='personnel')result=event.id==='dismissal-final'||event.id==='paperwork'?'你要求書面通知寄給自己，收好現有文件後離開。公司已經通知你離場，這次仍按公司要求離場記錄，沒有被改寫成你自願辭職。':event.id==='labor-claim'||event.id==='labor-mediation'?'你表示這輪先不談，留下聯絡方式後離開。爭議仍待處理，沒有成立新的和解，也沒有因為你走出會議室就撤銷原本的公司離場通知。':'你拒絕繼續留在這場人事談話，要求後續改用書面。希望沒有替你蓋上改善通過章，隨後改由離場窗口寄送正式通知；這不是你提出自願離職。';
 else if(category==='pip-review')result='你表示不再參與這輪評核，離開現場。沒有交出的答辯不會被算成通過，希望把缺席與本次評核結果一起留下；這次仍是走過 PIP 後由公司通知離場。';
 else if(category==='pip-passed')result='你收好已經確認的 PIP 通過通知，先離開談話現場。通過紀錄保留，後續工作與安排還得另外面對；這次沒有提出離職。';
 else if(category==='collapse')result='你明確提出離職，請窗口另約交接，先把自己帶離現場。你沒有假裝心情已經恢復，也不再為了回到同一張椅子多答應一輪工作。';
 else if(category==='chapter')result=['burnout','broke'].includes(run.chapterContext.family)?'你明確確認離職與後續交接，先離開公司。先前耗盡的資源與經過照樣保留，沒有把自己離開改成公司資遣。':'你收好這場風波的紀錄，先離開現場。事情已經發生，後續待辦也還在；你沒有另提離職，原本的任職照常。';
 else if(category==='rage'||category==='verbal'){
  affinityDelta=target?-4:0;result='你留下必要的聯絡方式，表示這輪先到這裡，再離開現場。已說的話、實際發生的衝突與已付費用都留在紀錄裡，沒有靠轉身就清掉；需要正式處理的部分仍待後續聯繫。';
  if(category==='verbal'&&run.verbalContext.eventId==='onboarding'&&run.verbalContext.phase==='event')result=run.verbalContext.outcome==='personnel'?'公司已撤回這次任用。你收好通知、留下聯絡方式後離開報到現場，沒有把公司的決定改寫成你自願辭職。剛才的原話與待處理說明仍留在紀錄裡。':'你明確表示不接受這份尚未完成的任用，離開報到現場。嗆過的話照樣留下，卻沒有替你換上一張已接受的新名片；今天是你決定不接這份工作。';
 }
 else if(category==='career')result=run.resumeEventId||run.exitReturnEventId?'你表示這輪先不接受新安排，離開談話，回到原本尚未完成的工作。名片與薪資沒有因為你聽過這份提案就改版。':'你明確提出離職與交接，結束這段任職。這次離開的是公司，不只是把一場會議留給別人。';
 else if(category==='private'){affinityDelta=target?(ticket<.6?-2:-7):0;result='你向同桌的人說先走，拿好自己的東西離場。沒出發的續攤不會收費，已經消費的部分也不會退款；這次結束的是這一攤，你沒有因此辭掉工作。';}
 // This marks a new missed workday caused by this action. Resuming an earlier
 // committed verbal/rage result may advance its existing day separately.
 const outcome={version:1,category,sourceEventId:event.id,sourceKind:event.kind,target,affinityDelta,status:'left',completed:false,workDaySpent:category==='work'};
 return {category,label:descriptor.label,result,delta,outcome};
}

export function isEventDepartureOutcomeV63(run,row){
 const x=row?.departureOutcome;
 return Boolean(isParticipationV63(run)&&row?.kind==='event-departure'&&row.choiceIndex===0&&x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join(',')==='affinityDelta,category,completed,sourceEventId,sourceKind,status,target,version,workDaySpent'&&x.version===1&&categories.includes(x.category)&&x.sourceEventId===row.eventId&&typeof x.sourceEventId==='string'&&typeof x.sourceKind==='string'&&(x.target===null||knownTargets.has(x.target))&&Number.isInteger(x.affinityDelta)&&x.affinityDelta>=-20&&x.affinityDelta<=0&&x.status==='left'&&x.completed===false&&x.workDaySpent===(x.category==='work'));
}

export function withDeparturePipReviewV63(event,run){
 if(!isParticipationV63(run)||event?.id!=='pip-review'||!(run.flags?.departure63_pip_missed>0))return event;
 const missed=Math.min(3,run.flags.departure63_pip_missed);
 return {...event,body:`${event.body} 這次改善期有 ${missed} 天擅離、沒有交付，已各記零分；現場的答辯不能替那些空白日補交。`,choices:event.choices.map(choice=>choice.check?{...choice,check:{...choice.check,chance:missed>=3?0:Math.max(0,choice.check.chance-missed*.2)}}:choice)};
}
