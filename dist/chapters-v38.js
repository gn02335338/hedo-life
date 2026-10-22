import {displayText,displayChronicleHistory} from './persona.js';

// A solved argument is an episode, not a dismissal. These public ending IDs
// remain available when the player later explicitly chooses to leave.
export const CHAPTER_FAMILIES_V38=Object.freeze([
 'verbal_wing_concession','verbal_boardroom','verbal_rick_awake','verbal_hr_rewrite',
 'verbal_legal_letter','verbal_sonny_statement','verbal_kind_ghost',
 'verbal_colleague_solidarity','verbal_viral','verbal_mutual_mute','verbal_apology',
 'rage_legal','rage_defeated','rage_truce','rage_meme'
]);
export const RESOURCE_FAMILIES_V38=Object.freeze(['burnout','broke']);
export const COMPANY_FAMILIES_V38=Object.freeze(['nasdaq','taiwan','acquired','nasdaq_failed','taiwan_failed','google_board','google_ousted','buyer_board','buyer_ousted','vietnam_core','vietnam_afterdark','rage_coup']);
export const VOLUNTARY_FAMILIES_V38=Object.freeze(['ragequit','pip_exit','assistant','promotion','slacker','sycophant','historian','career_assistant','career_staff','career_senior','career_principal','career_deputy','career_manager','career_director','career_chief','second_offer','handover_author','alumni_network','consultant','rage_walkaway','cold_storage']);
const needsChoice=new Set([...CHAPTER_FAMILIES_V38,...RESOURCE_FAMILIES_V38]);
export const needsChapterResolutionV38=family=>needsChoice.has(family);
const c=(text,result,effect,extra={})=>({text,detail:'',result,delta:{},effect,flags:[],...extra});

export function getChapterResolutionV38(run){
 const context=run.chapterContext;
 if(!context||!needsChoice.has(context.family))throw new Error('Missing chapter resolution');
 const source=displayChronicleHistory(run.history[context.historyIndex]),resource=RESOURCE_FAMILIES_V38.includes(context.family);
 const leaving=run.pending&&run.pendingEffect==='chapterExit';
 const body=leaving?'你已明確提出離職，剛才的決定也已留下紀錄。接下來確認這段任職的收尾；不會再把你的去留交給另一輪抽籤。':resource
  ?context.family==='burnout'?'體力已經耗盡，這份工作無法再照原本的方式做下去。剛才的消耗已經發生；現在把離場的意思說清楚，不讓一個歸零數字替你簽離職書。':'存款已經耗盡，你無法再靠剩下的資源繼續這段生活。先把這份工作收尾，再安排下一步。這次沒有公司另發的資遣通知。'
  :'剛才那場風波有了收尾，但你還沒有離職，也沒有收到新的資遣通知。你可以回到尚未完成的工作安排；若想在這裡離開，也由你親自確認。';
 const leave='你明確提出離職，確認交接與離開這份工作的安排。先前那段風波留在履歷裡，最後離開的決定是你自己做的。';
 return {id:'chapter-resolution',kind:'career',speaker:source.speaker||'self',title:leaving?'離職的意思，你已經說清楚。':resource?'先把離場說清楚。':'這頁翻完了，你的人生還沒下班。',body,
  wing:'',era:leaving?'已確認離職':resource?'無法繼續・確認離職':'篇章收尾・仍在職',sourceIds:source.sourceIds||[],
  resolvedChapter:{title:source.title,result:source.result},
  choices:[
   resource?c('我決定離職，先把自己帶離這份工作。',leave,'chapterExit',{flags:['departure38_voluntary']}):c('這件事先收好，我繼續上班。','你保留剛才的紀錄，沒有交回門禁卡。這次結束的是一場風波，尚未完成的安排仍由你繼續決定。','chapterContinue',{available:run.stats.energy>0&&run.stats.cash>0}),
   c(resource?'請希望把離職日期與交接寫清楚，我確認後離開。':'我在這裡提出離職，帶著這段經歷離開。',leave,'chapterExit',{flags:['departure38_voluntary']})
  ]};
}

// Existing career menus already are departure decisions. State that in the
// committed text instead of silently treating a completed work goal as an exit.
export function withDepartureChoicesV38(event,run){
 if(!/^e(?:38|39)-/.test(run?.seed||'')||!event||!['exit-menu','career-exit','rank-exit','story-exit','final-shortfall'].includes(event.id))return event;
 return {...event,body:`${event.body} 確認下方的離場選擇就會正式結束這份工作；只看清單不算離職。`,choices:event.choices.map(choice=>{
  if(!VOLUNTARY_FAMILIES_V38.includes(choice.effect))return choice;
  if(choice.effect==='consultant')return {...choice,text:'確認離職、結束原全職任用，再談外部顧問合約。',result:`${choice.result} 你確認離職與交接，結束原本的全職任用；後續只依另外寫明範圍、時數與費用的外部顧問合約合作。`,flags:[...(choice.flags||[]),'departure38_voluntary']};
  return {...choice,text:`確認離職：${choice.text}`,result:`${choice.result} 你明確確認離職與交接，結束這份工作；這次不是公司要求你走。`,flags:[...(choice.flags||[]),'departure38_voluntary']};
 })};
}

export function chapterDepartureCopyV38(run,ending){
 if(!/^e(?:38|39)-/.test(run?.seed||'')||!run.completed||!ending||run.endingId!==ending.id||!run.flags?.departure38_voluntary)return ending;
 const milestone=CHAPTER_FAMILIES_V38.includes(ending.family);
 if(milestone){
  const memory={
   verbal_wing_concession:'那次爭執後，翅膀曾把工作條件寫下來。你當時沒有被開除，也沒有因為談清楚幾條要求，就決定永遠留下。',
   verbal_boardroom:'你曾讓屎潘蛇的願景會議留下不同意見。你沒有因此成為董事長，也沒有在那場會議被請出去。',
   verbal_rick_awake:'瑞克曾在那場衝突後掛掉電話，親自回應工作。那是他難得留下的一次交付，不是你的離職通知。',
   verbal_hr_rewrite:'希望曾重寫那份評核表，把公司應提供的條件也列進去。表格有了新版本，你的去留仍由後續的正式決定處理。',
   verbal_legal_letter:'那輪口角後，你曾把原話與經過整理成正式回覆。書信往來沒有替任何一方判定勝訴，也沒有替你簽離職書。',
   verbal_sonny_statement:'阿福曾被你追問到開了一場理由記者會。當時留下的是具名工作答覆，門禁卡仍在你手上。',
   verbal_kind_ghost:'阿良曾答應出現，再一次讓你自己等到散場。那個晚上結束的是等他的行程，還不是你的任期。',
   verbal_colleague_solidarity:'那場衝突裡，同事曾站出來補上前情。有人支持你，把事情說清楚，並不等於你必須為此一直留下。',
   verbal_viral:'你曾把那場口角改寫成虛構的職場作品，慢慢長出自己的舞台。創作可以繼續，原本的工作也需要一個清楚的句點。',
   verbal_mutual_mute:'你們曾約定改走書面與固定窗口。那時薪水照領，雙方少說幾句，事情仍然做得下去。',
   verbal_apology:'你曾收回過頭的用詞，把工作條件留在討論裡。道歉沒有把你和公司綁在一起，也沒有替你決定去留。',
   rage_legal:'失控之後，你曾將出手與工作爭議分開，交由正式窗口處理。要面對的後果沒有消失，去留也不能靠一場衝突含糊帶過。',
   rage_defeated:'你曾在真正出手後吃了虧，花時間與存款處理後續。那一次沒有成為反抗傳說，也沒有替你決定剩下的日子。',
   rage_truce:'協調後，你曾選擇留下，要求工作走正式窗口。那份停火約定讓你繼續過幾天班，沒有要求你永遠不能走。',
   rage_meme:'那場失控曾意外留下流傳的片段。你先面對後果，也曾看見工作以外的生活；任職關係仍需要自己說清楚。'
  }[ending.family];
  return {...ending,subtitle:'你自己決定離職，這段經歷留在上一頁。',body:`${memory} 後來，你明確提出離職、確認交接，離開這份工作。先前那場風波早已留下紀錄；這次，才是這段任職的最後一天。`,retrospectiveBody:displayText(ending.body)};
 }
 if(ending.family==='consultant')return {...ending,subtitle:'原本的全職任用結束了，合作另外寫進合約。',body:'你確認離職與交接，結束這份全職工作。後續若再提供協助，只依另訂的外部顧問合約確認範圍、時數與費用；沒有把原本無限待命的生活換一張名片延長。',retrospectiveBody:displayText(ending.body)};
 if(RESOURCE_FAMILIES_V38.includes(ending.family))return {...ending,body:`${displayText(ending.body)} 你沒有讓狀態歸零替自己簽字，而是明確向公司提出離職，確認離開這份工作。`};
 return {...ending,body:`${displayText(ending.body)} 你已確認離職與交接。這份工作到這裡結束，下一步由你自己決定。`};
}
