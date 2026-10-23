import { ROLES, ROLE_MAP } from './roles.js';
import {isPatronageBenefitsV67} from './patronage-benefits-v67.js';
import { SOURCES } from './public-sources.js';
import { ENDINGS, FAMILIES } from './endings.js';
import { LEGACY_ENDINGS } from './legacy.js';
import { STAT_LABELS, MAX_TURNS, createRun, getEvent, applyChoice, advance, requestExit, requestBreak, canRequestBreak, requestCareer, canRequestCareer, requestRaise, canRequestRaise, raiseAvailability, requestRage, canRequestRage, getRageTargets, requestVerbal, canRequestVerbal, getVerbalTargets, getVerbalLine, requestSalaryAdvice, validRun, jobTitle, bossLabel } from './engine.js';
import { cloud } from './cloud.js';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, ACHIEVEMENT_GROUPS, LEGACY_RAGE_ACHIEVEMENTS, ACHIEVEMENT_RECORD_MAP, deriveAchievements } from './achievements.js';
import { renderAchievementBookV66, achievementPageV66 } from './achievement-book-v66.js';
import { createFeedbackUI } from './feedback.js';
import { careerInfo, careerLevels, careerLadder, careerMaxRank, careerReviewCutoff, careerReviewWait } from './career-api.js';
import { CAREER_LEVELS_V17, CAREER_FAMILIES_V17 } from './career-v17.js';
import { polishDreamText } from './copy-v15.js';
import { PERSONAS, displayPersona, displayText, displayChronicleEvent, displayChronicleHistory } from './persona.js';
import { displayOccupationTextV47 } from './occupation-copy-v47.js';
import { displayPrincessEventV47, displayPrincessHistoryV47, displayPrincessTextV47 } from './princess-english-v47.js';
import { HIDDEN_PERSONAS_V45 } from './hidden-encounter-v45.js';
import { requestHiddenEncounter } from './engine.js';
import { getEventDepartureV63, requestEventDepartureV63 } from './engine.js';
import { createCharacterBook } from './character-book.js';
import { characterHistoryChanges, characterAffinity } from './character-stats.js';
import { renderEndingReport } from './ending-report-view.js';
import { renderSceneIllustration, renderEndingIllustration, embedEndingIllustration } from './illustrations-v38.js';
import { renderEndingTransition } from './ending-transition-v40.js';
import { chapterDepartureCopyV38 } from './chapters-v38.js';
import { polishVerbalHistoryV41 } from './verbal-presentation-v41.js';
import { displayPlayerTitleV42, displayPlayerEventV42, displayPlayerHistoryV42, displayPlayerVerbalLineV42, displayPlayerEndingV42 } from './job-titles-v42.js';
import { createAdminArchiveUI } from './admin-archive-ui-v41.js';
import { canRequestPatronageReply, getPatronageReplyTargets, getPatronageReplyLine, requestPatronageReply } from './engine.js';
import { enableActivitySchedule, canRequestActivityInvitation, requestActivityInvitation } from './engine.js';
import { activityProgressHTMLV44 } from './activity-ui-v44.js';
import { isWorkGapOpenV50 } from './engine.js';
import { isWorkGapV50 } from './work-gap-v50.js';
import { isEnergyRestV53 } from './energy-rest-v53.js';
import { isEnergySafetyV54 } from './energy-safety-v54.js';
import { renderWorkGapHTMLV50 } from './work-gap-ui-v50.js';
import { armSceneContextHTMLV51, displayArmSceneEventV51, displayArmSceneHistoryV51 } from './arm-scene-ui-v51.js';
import { displayArmVerbalLineV51, displayArmVerbalHistoryV51, armVerbalTargetLabelV51 } from './arm-verbal-copy-v51.js';
import { displayContextVerbalLineV52, displayContextVerbalHistoryV52 } from './verbal-context-v52.js';
import { activityReturnNoticeHTMLV52, activityPhaseV52, activityPhaseNoticeHTMLV52 } from './activity-phases-v52.js';
import { getActivityPlayV55, applyActivityPlay } from './engine.js';
import { renderActivityPlayHTMLV55, mountActivityPlayV55 } from './activity-play-ui-v55.js';
import { createLeaderboardUIV56 } from './leaderboard-ui-v56.js';
import { getShareholderPlayV58, applyShareholderPlay } from './engine.js';
import { getShareholderStatusV58 } from './shareholders-v58.js';
import { shareholderGameHTMLV58, mountShareholderGameV58 } from './shareholders-ui-v58.js';
import { createRandomRecruiterV60 } from './random-recruitment-v60.js';
import { recruitmentSeedV60 } from './seed-profile-v60.js';
import { isLifeBalanceV62 } from './life-balance-v62.js';
import { directEntryV60, entryLabelV60 } from './recruitment-v60.js';
import { officeTreatPhaseV61, officeTreatPhaseHTMLV61, officeTreatNextLabelV61, officeTreatReturnHTMLV61 } from './office-treats-ui-v61.js';
import { renderCamelActivityResultV65 } from './activity-play-view-v65.js';
import {isOnboardingDeclineV66} from './release-clarity-v66.js';
// Existing saved-life UI harnesses intentionally supply only their historical
// imports. Artwork remains optional there; the dedicated art harness binds it.
const sceneArtHTML=(event,options)=>typeof renderSceneIllustration==='function'?renderSceneIllustration(event,options):'';
const endingArtHTML=(ending,options)=>typeof renderEndingIllustration==='function'?renderEndingIllustration(ending,options):'';
const playerTitle=(title,state=run)=>typeof displayPlayerTitleV42==='function'?displayPlayerTitleV42(title,state?.actualRoleId):title;
const shownJobTitle=state=>playerTitle(jobTitle(state),state);
const shownEvent=event=>{
 const contextual=typeof displayArmSceneEventV51==='function'?displayArmSceneEventV51(event):event;
 const shown=typeof displayPlayerEventV42==='function'?displayPlayerEventV42(displayChronicleEvent(contextual),run):displayChronicleEvent(contextual);
 return typeof displayPrincessEventV47==='function'?displayPrincessEventV47(shown,run):shown;
};
const shownHistory=row=>{
 const occasion=typeof displayArmSceneHistoryV51==='function'?displayArmSceneHistoryV51(row):row;
 const shown=typeof polishVerbalHistoryV41==='function'?polishVerbalHistoryV41(displayChronicleHistory(occasion)):displayChronicleHistory(occasion);
 const contextual=typeof displayArmVerbalHistoryV51==='function'?displayArmVerbalHistoryV51(shown):shown;
 const current=typeof displayContextVerbalHistoryV52==='function'?displayContextVerbalHistoryV52(contextual,{run,rawRow:row}):contextual;
 const titled=typeof displayPlayerHistoryV42==='function'?displayPlayerHistoryV42(current,run):current;
 return typeof displayPrincessHistoryV47==='function'?displayPrincessHistoryV47(titled,run):titled;
};
const shownVerbalLine=(state,target)=>{
 const raw=getVerbalLine(state,target),phase=state?.pending?'result':'event';
 const arm=typeof displayArmVerbalLineV51==='function'?displayArmVerbalLineV51(raw,{eventId:state?.eventId,target,phase}):raw;
 const contextual=typeof displayContextVerbalLineV52==='function'?displayContextVerbalLineV52(arm,{event:getEvent(state),target,run:state,phase}):arm;
 const line=typeof displayPlayerVerbalLineV42==='function'?displayPlayerVerbalLineV42(contextual,state):contextual;
 return typeof displayPrincessTextV47==='function'?displayPrincessTextV47(line,{target}):line;
};
const shownEnding=ending=>typeof displayPlayerEndingV42==='function'?displayPlayerEndingV42(ending):ending;
const endingCauseHTML=(state,ending,options)=>typeof renderEndingTransition==='function'?renderEndingTransition(state,ending,options):'';
// Presentation state stays outside the canonical life and its replay actions.
// A reloaded completed life opens its ending with the same causal explanation.
let endingReviewKey=null;
let activityPlayCleanupV55=null;
let shareholderCleanupV58=null;
const endingIdentity=state=>state?`${state.runId||state.seed}:${state.endingId}:${state.history.length}`:'';
const $=s=>document.querySelector(s),main=$('#main'),dialog=$('#dialog');
const escapeHTML=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uiText=(v='')=>typeof displayOccupationTextV47==='function'?displayOccupationTextV47(v):displayText(v);
const esc=(v='')=>escapeHTML(uiText(v));
const STORE='hedo-life-v3', REPO='https://github.com/gn02335338/hedo-life';
const feedbackUI=createFeedbackUI({dialog,openDialog,cloud,repo:REPO});
const characterBookUI=createCharacterBook({dialog,openDialog,cloud,getRun:()=>run});
const adminArchiveUI=typeof createAdminArchiveUI==='function'?createAdminArchiveUI({dialog,openDialog}):{open(){}};
const leaderboardUI=typeof createLeaderboardUIV56==='function'?createLeaderboardUIV56({dialog,openDialog,cloud,getRun:()=>run,getUnlocked:()=>unlocked}):{open(){},endingHTML(){return '';},mountEnding(){}};
const pad=n=>String(n).padStart(2,'0');
function randomSeed(kind='normal'){
 const entropy=typeof crypto.getRandomValues==='function'?Array.from(crypto.getRandomValues(new Uint8Array(11)),byte=>byte.toString(16).padStart(2,'0')).join(''):crypto.randomUUID().replaceAll('-','').slice(0,22);
 return typeof recruitmentSeedV60==='function'?recruitmentSeedV60(entropy,kind,67):`e39-r67-${({normal:'n',executive:'n',godson:'s',goddaughter:'d'})[kind]}-${entropy}`;
}
const randomRecruiter=typeof createRandomRecruiterV60==='function'?createRandomRecruiterV60():null;
const applicationTitle=state=>typeof entryLabelV60==='function'?entryLabelV60(state):ROLE_MAP[state.roleId].name;
const ENTRY_ROLES=[{id:'random',name:'隨機職業',symbol:'?',subtitle:'職缺先別問，骰子說了算。',description:'把履歷交給命運。這次坐哪張椅子，擲完才知道。'},...ROLES.filter(role=>role.id!=='executive')];
const PEOPLE={...Object.fromEntries(Object.entries(PERSONAS).map(([id,p])=>[id,typeof displayPersona==='function'?displayPersona(id):p])),...(typeof HIDDEN_PERSONAS_V45==='object'?HIDDEN_PERSONAS_V45:{}),self:{name:'你',title:'今天的主角',initial:'我'},'exit-team':{name:'法師 · 真真 · 阿福',title:'法務／行政／MIS',members:['erich','jenjen','sonny']}};
function careerTrack(){
 if(!/^e(?:8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 const info=careerInfo(run),levels=careerLevels(run),ladder=careerLadder(run).map(title=>playerTitle(title)),full=levels.length===8,legacyAssistant=!full&&run.assignment==='assistant';
 if(run.patronage)return `<div class="career-track patronage-track"><div class="career-current"><span>特別任命</span><b>${esc(shownJobTitle(run))}</b></div><p>原專業：${esc(ROLE_MAP[run.actualRoleId].name)}。一般升遷暫停，任職紀錄與已發生的事情照常保留。</p>${typeof isPatronageBenefitsV67==='function'&&isPatronageBenefitsV67(run)?'<p>任用時另領安家補助；每完成兩個工作回合再領生活津貼。補助與津貼使用存款指數，上限仍是 100。</p>':''}<button data-action="career-guide">查看原專業路線 ↗</button></div>`;
 return `<div class="career-track${full?' full-career':''}"><div class="career-current"><span>目前職級</span><b>${legacyAssistant?'待轉正':esc(full?playerTitle(info.title):info.label)}</b></div><ol aria-label="${full?'八':'五'}階職涯">${levels.map((level,index)=>`<li class="${!legacyAssistant&&index===run.rank?'current':''}" ${!legacyAssistant&&index===run.rank?'aria-current="step"':''}><i aria-hidden="true"></i><span>${full?`<small>LV.${index}</small>`:''}${esc(full?ladder[index]:level.label)}</span></li>`).join('')}</ol><p>${legacyAssistant?'先把實際工作做出成績，爭取回到正式職務，再往管理職前進。':esc(info.responsibility)}</p><button data-action="career-guide">看看職涯路線 ↗</button></div>`;
}
function careerGuide(){
 if(!/^e(?:8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return;
 const levels=careerLevels(run),ladder=careerLadder(run).map(title=>playerTitle(title)),full=levels.length===8,legacyAssistant=!full&&run.assignment==='assistant';
 const intro=full?'先從助理與正式專業職做起，再累積到資深、主任。這幾階看的是獨立交付與處理複雜問題的能力；升到副理後，才開始承擔人力、績效與部門決策。「專案經理」或「產品經理」是專業職稱，並不代表一入職就開始管人。':'專業職稱與管理職級分開看。「專案經理」或「產品經理」可以是普通專業員工，升上帶人、分配資源的職位後，才進入管理階梯。';
 const detail=full?'八階都有各自的工作責任。助理要先轉正；資深、主任仍以專業交付為主，副理以上才開始帶組與管理。高階主管從經理級開始，也能選擇卸下管理職。':'助理先爭取轉正；高階主管從經理級開始，也能選擇卸下管理職。每一階都有管理抉擇。';
 openDialog(`<h2 id="dialog-title">職稱變了，要扛的事也會變。</h2>${run.patronage?`<p class="dialog-lead">你目前的正式職位是${esc(shownJobTitle(run))}，不走一般升遷。以下保留原專業的八階路線供對照。</p>`:''}<p class="dialog-lead">${intro}</p><ol class="career-guide-list">${levels.map((level,index)=>`<li class="${index===run.rank&&!legacyAssistant?'current':''}" ${index===run.rank&&!legacyAssistant?'aria-current="step"':''}><span>${full?`LV.${index} · `:''}${esc(level.label)}</span><h3>${esc(ladder[index])}</h3><p>${esc(level.responsibility)}</p></li>`).join('')}</ol><p class="dialog-lead">${detail}升遷評核可用工作成果或討好老闆爭取，也能先補強能力。職級會影響薪資與日常負擔；結果和實際增減，仍然選完才揭曉。${/^e(?:9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'升遷要先累積目前職級的工作經歷，高階還要等名額與高層點頭；剛換名片，不能馬上再換一張。':''}</p><p class="small-note">${/^e(?:10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'工作證的「準備升遷」可主動談訓練與評核；還沒準備好時，不會反覆叫你去領同一份表格。':' '}${/^e(?:19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'「我要談加薪」另外計算，不會用掉升遷評核；正式談過後，要再上幾天班才能重談。':''}可以在工作證選擇離職，再決定如何結算職涯，不必等到最後一天。未玩到的結局依然保密。</p>`);
}
let run=null,unlocked=[],legacy=[],records={},achievements={},recentAchievements=null,achievementFilter='all',achievementToastTimer,screen='home',selectedRole='random',candidate=null,rerolls=0,storageAvailable=true,toastTimer,audioContext,audioGain,soundOn=false,collectionFilter={role:'all',status:'all',query:'',limit:24};
try{const saved=JSON.parse(localStorage.getItem(STORE)||'null'),v2=JSON.parse(localStorage.getItem('hedo-life-v2')||'null'),v1=JSON.parse(localStorage.getItem('hedo-life-v1')||'null');if(validRun(saved?.run))run=saved.run;unlocked=[...new Set([...(Array.isArray(saved?.unlocked)?saved.unlocked:[]),...(Array.isArray(v2?.unlocked)?v2.unlocked:[])])].filter(id=>ENDINGS.some(e=>e.id===id));achievements=readAchievementRecords(saved?.achievements);records=saved?.records&&typeof saved.records==='object'&&!Array.isArray(saved.records)?saved.records:{};legacy=[...new Set([...(Array.isArray(saved?.legacy)?saved.legacy:[]),...(Array.isArray(v2?.legacy)?v2.legacy:[]),...(Array.isArray(v1?.unlocked)?v1.unlocked:[])])].filter(id=>LEGACY_ENDINGS.some(e=>e.id===id));}catch{storageAvailable=false;}
function activeAchievementCount(){return ACHIEVEMENTS.filter(item=>Object.hasOwn(achievements,item.id)).length;}
function save(){try{localStorage.setItem(STORE,JSON.stringify({run,unlocked,legacy,records,achievements}));}catch{if(storageAvailable)toast('這個瀏覽器無法存檔，本局仍可繼續。');storageAvailable=false;}$('#collection-count').textContent=`${unlocked.length} / ${ENDINGS.length}`;$('#achievement-count').textContent=`${activeAchievementCount()} / ${ACHIEVEMENTS.length}`;}
function readAchievementRecords(value,source='local'){
 const result={};if(!value||typeof value!=='object'||Array.isArray(value))return result;
 for(const item of Object.values(ACHIEVEMENT_RECORD_MAP)){if(!Object.hasOwn(value,item.id))continue;const row=value[item.id],time=typeof row==='object'&&row?Date.parse(row.unlockedAt):NaN;if(!Number.isFinite(time))continue;result[item.id]={unlockedAt:new Date(time).toISOString(),source:source==='imported'?'imported':['local','verified','imported'].includes(row.source)?row.source:source};}
 return result;
}
function mergeVerifiedAchievements(rows){
 if(!Array.isArray(rows))return false;let changed=false;
 for(const row of rows){if(!row||!Object.hasOwn(ACHIEVEMENT_RECORD_MAP,row.id))continue;const time=Date.parse(row.unlockedAt);if(!Number.isFinite(time))continue;const unlockedAt=new Date(time).toISOString(),old=achievements[row.id];if(!old||old.source!=='verified'||old.unlockedAt!==unlockedAt){achievements[row.id]={unlockedAt,source:'verified'};changed=true;}}
 return changed;
}
function achievementProgressKey(){return run?`${run.runId||run.seed}:${run.actions.length}:${run.completed?'end':'play'}`:'';}
function syncAchievementProof(){if(!run?.runId||!deriveAchievements(run).length)return;void cloud.achievementProgress(run).then(data=>{if(mergeVerifiedAchievements(data?.achievements))save();}).catch(()=>{});}
function syncCharacterProof(){
 if(!run?.runId||!run.history?.length)return;
 characterBookUI.onRunChanged();
 void cloud.characterProgress(run).then(()=>characterBookUI.onSnapshot(cloud.state)).catch(()=>{});
}
function collectAchievements(notify=true){
 if(!run)return;const ids=deriveAchievements(run).filter(id=>!Object.hasOwn(achievements,id));if(!ids.length)return;
 const unlockedAt=new Date().toISOString();for(const id of ids)achievements[id]={unlockedAt,source:'local'};
 recentAchievements={key:achievementProgressKey(),ids};if(notify)showAchievementToast(ids);syncAchievementProof();
}
function achievementModeLabel(item){return item.mode==='real'?'現實出手':item.mode==='imagined'?'腦內夢境':item.mode==='mixed'?'夢境＋現實':'';}
function achievementModeHTML(item){const label=achievementModeLabel(item);return label?`<span class="achievement-mode ${item.mode}">${label}</span>`:'';}
function showAchievementToast(ids){
 const first=ACHIEVEMENT_MAP[ids[0]],panel=$('#achievement-toast');if(!first||!panel)return;clearTimeout(achievementToastTimer);panel.innerHTML=`<img src="${first.image}" alt=""><div><span>成就解鎖${ids.length>1?` · 共 ${ids.length} 枚`:''}${first.mode?` · ${achievementModeLabel(first)}`:''}</span><b>${esc(first.title)}</b></div><button data-action="achievements">翻開成就簿 ↗</button>`;panel.classList.add('visible');achievementToastTimer=setTimeout(()=>panel.classList.remove('visible'),6500);
}
function recentAchievementHTML(){
 if(recentAchievements?.key!==achievementProgressKey())return'';
 return `<section class="result-achievements" aria-label="這次解鎖的成就"><span class="ledger-label">這次也解鎖了</span><div>${recentAchievements.ids.map(id=>{const item=ACHIEVEMENT_MAP[id];return `<button data-action="achievements" class="result-achievement"><img src="${item.image}" alt=""><span><small>成就解鎖${item.mode?` · ${achievementModeLabel(item)}`:''}</small><b>${esc(item.title)}</b></span><span aria-hidden="true">↗</span></button>`;}).join('')}</div></section>`;
}
function unlockedAchievementCard(item,row,number,{legacy=false}={}){
 return `<article class="achievement-card unlocked${legacy?' legacy-rage-card':''}"><div class="achievement-art"><img src="${item.image}" alt="${esc(item.title)}原創成就插畫" loading="lazy"><span class="achievement-check" aria-hidden="true">✓</span></div><div class="achievement-card-copy"><span class="achievement-category">${legacy?'舊版暴走紀念':`${esc(ACHIEVEMENT_GROUPS[item.group])} · ${number}`}</span>${legacy?'':achievementModeHTML(item)}<h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><footer><time datetime="${esc(row.unlockedAt)}">${new Date(row.unlockedAt).toLocaleDateString('zh-TW')}</time><span>${row.source==='verified'?'已驗證同步':row.source==='imported'?'匯入收藏':'本機收藏'}</span></footer></div></article>`;
}
function legacyRageAchievementsHTML(){
 const collected=LEGACY_RAGE_ACHIEVEMENTS.filter(item=>Object.hasOwn(achievements,item.id));if(!collected.length)return'';
 return `<section class="legacy-rage-achievements" aria-labelledby="legacy-rage-heading"><h3 id="legacy-rage-heading">舊版暴走紀念</h3><p>這些章是舊版留下的收藏。當時夢境與現實共用部分條件，無法據此確認真的出手；原有日期與紀錄照常保留，不列入新版成就進度。</p><div class="achievement-grid">${collected.map(item=>unlockedAchievementCard(item,achievements[item.id],'',{legacy:true})).join('')}</div></section>`;
}
let achievementPageV66Index=0,achievementGroupV66='all';
function achievementBook(){
 if(typeof renderAchievementBookV66==='function'){
  const current=achievementPageV66({catalog:ACHIEVEMENTS,records:achievements,filter:achievementFilter,group:achievementGroupV66,page:achievementPageV66Index});achievementPageV66Index=current.page;
  openDialog(renderAchievementBookV66({catalog:ACHIEVEMENTS,records:achievements,groups:ACHIEVEMENT_GROUPS,filter:achievementFilter,group:achievementGroupV66,page:achievementPageV66Index,renderUnlocked:unlockedAchievementCard,legacyHTML:legacyRageAchievementsHTML()}));return;
 }
 const count=activeAchievementCount();openDialog(`<div class="achievement-heading"><div><span class="eyebrow">LITTLE VICTORIES, STRANGE MEMORIES.</span><h2 id="dialog-title">有些事，值得留一枚章。</h2></div><span class="achievement-total"><b>${count}</b> / ${ACHIEVEMENTS.length}</span></div><p class="dialog-lead">把上班途中那些特別的瞬間收好。夢裡出氣與現實出手分開收章。還沒拿到的成就，名字、圖案和條件都先保密。</p><div class="achievement-progress" role="meter" aria-label="已解鎖成就" aria-valuemin="0" aria-valuemax="${ACHIEVEMENTS.length}" aria-valuenow="${count}"><span style="width:${count/ACHIEVEMENTS.length*100}%"></span></div><div class="achievement-filters" role="group" aria-label="成就收藏狀態">${[['all','全部'],['unlocked','已解鎖'],['locked','未解鎖']].map(([id,label])=>`<button data-achievement-filter="${id}" aria-pressed="${achievementFilter===id}" class="${achievementFilter===id?'selected':''}">${label}</button>`).join('')}</div><p class="achievement-storage-note">成就先保存在這個瀏覽器，連線後以可重播紀錄驗證並同步。舊圖鑑照常保留；匯入的成就不會算進全站紀錄。</p><div class="achievement-grid">${ACHIEVEMENTS.filter(item=>achievementFilter==='all'||(achievementFilter==='unlocked')===Object.hasOwn(achievements,item.id)).map(item=>{
 const row=achievements[item.id],number=String(ACHIEVEMENTS.indexOf(item)+1).padStart(2,'0');
 return row?unlockedAchievementCard(item,row,number):`<article class="achievement-card locked" aria-label="第 ${number} 枚成就，尚未解鎖"><div class="achievement-art"><span aria-hidden="true">?</span></div><div class="achievement-card-copy"><span class="achievement-category">${number} / UNKNOWN</span><h3>???</h3><p>等那一天發生，再替它命名。</p></div></article>`;
 }).join('')||'<p class="empty-state">這裡還沒有收藏。先去過一天你的人生吧。</p>'}</div>${legacyRageAchievementsHTML()}`);
}
function hiddenActionControl(type){
 if(!run?.hiddenEncounterContext||run.pending)return'';
 const event=getEvent(run),index=event.choices.findIndex(choice=>choice.hiddenAction===type);
 if(index<0)return'';
 const choice=event.choices[index],verbal=type==='verbal';
 return `<button class="choice ${verbal?'verbal-trigger':'rage-trigger'}" data-choice="${index}" data-choice-view="${gameViewRevision+1}"><span class="${verbal?'verbal-icon':'rage-icon'}" aria-hidden="true">${verbal?'！':'✹'}</span><span class="choice-text ${verbal?'verbal-choice-text':''}">${verbal?`<b>惡言相向</b><span class="verbal-choice-line">「${esc(choice.line||choice.text)}」</span>`:'受不了了，扁他'}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
}
function rageControl(){
 if(run?.hiddenEncounterContext)return hiddenActionControl('rage');
 if(!/^e(?:13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 if(/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)){
  const event=getEvent(run);
  if(event.id==='mood-self-destruct')return'';
  if(event.id==='mood-collapse'){
   if(run.pending)return'';
   const index=event.choices.findIndex(choice=>choice.effect==='moodSelfDestruct');
   if(index<0)return'';
   return `<button class="choice rage-trigger self-destruct-trigger" data-choice="${index}" data-choice-view="${gameViewRevision+1}"><span class="rage-icon" aria-hidden="true">✹</span><span class="choice-text">受不了了，自爆</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
  }
  if(run.stats.mood===0&&!run.rageContext&&!run.pendingFamily)return '<button class="choice rage-trigger self-destruct-trigger" disabled title="先看完眼前結果，再面對這次失控。"><span class="rage-icon" aria-hidden="true">✹</span><span class="choice-text">受不了了，自爆</span><span class="choice-arrow" aria-hidden="true">↗</span></button>';
 }
 const available=canRequestRage(run),hint=run.blockchainContext?'先用這一幕的選項回應，或直接離開這次區塊鏈討論。':run.departureContext?'先看完這次離場的結果。':run.treatsContext?'先回應眼前的辦公室插曲，再繼續工作。':run.recruitmentContext?'先和眼前的人打完招呼，再繼續工作。':run.shareholderContext?'先完成眼前的認股或股東大會；會場攻防請用追問與舉證。':run.activityInvitationContext?'先用眼前的選項回覆這次活動邀約。':run.activityContext?'先完成目前活動；活動內請用這一幕的回應。':run.patronageReplyContext?'先看完自己人發話的結果。':/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)&&run.stats.mood===0?'心情已歸零，先處理這次真正的失控。':run.pendingFamily?'這段離場選擇已經確定，先把最後一幕看完。':run.verbalContext?'先把這段口舌風波處理完。':run.rageContext?'先看完這次暴走的後續。':!available&&getEvent(run)?.speaker==='self'?'眼前沒有人跟你說話，先把這個念頭放著。':!available?'今天已經出過這口氣，先繼續眼前的故事。':'';
 return `<button class="choice rage-trigger" data-action="rage" ${available?'':'disabled'} ${hint?`title="${hint}"`:''}><span class="rage-icon" aria-hidden="true">✹</span><span class="choice-text">受不了了，扁他</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
}
function verbalControl(){
 if(run?.hiddenEncounterContext)return hiddenActionControl('verbal');
 if(!/^e(?:30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 const allowed=canRequestVerbal(run),targets=allowed?getVerbalTargets(run):[],self=targets.length===1&&targets[0]==='self';
 const line=allowed&&targets.length===1?shownVerbalLine(run,targets[0]):'';
 const selfLabel=self&&typeof armVerbalTargetLabelV51==='function'?armVerbalTargetLabelV51(run.eventId,'self')||'對空氣開罵':'對空氣開罵';
 const reason=allowed?'':run.blockchainContext?'先用當場的回嘴選項，或直接離開這次區塊鏈討論。':run.departureContext?'先看完這次離場的結果。':run.treatsContext?'先回應眼前的辦公室插曲，再繼續工作。':run.recruitmentContext?'先和眼前的人打完招呼，再繼續工作。':run.shareholderContext?'先完成眼前的認股或股東大會；會場攻防請用追問與舉證。':run.activityInvitationContext?'先用眼前的選項回覆這次活動邀約。':run.activityContext?'先完成目前活動；活動內請用這一幕的回應。':run.patronageReplyContext?'先看完自己人發話的結果。':run.companyContext?'先確認眼前的公司方案，或從方案選單返回。':run.verbalContext?'先把這段口舌風波處理完。':run.rageContext?'先處理剛才動手的後續。':run.stats.mood===0?'先面對這次心情歸零。':run.pendingFamily?'這段離場已經確定，先看完最後的結果。':'這個工作回合已經嗆過，先繼續眼前的故事。';
 return `<button class="choice verbal-trigger" data-action="verbal" ${allowed?'':'disabled'} ${reason?`title="${esc(reason)}"`:''}><span class="verbal-icon" aria-hidden="true">！</span><span class="choice-text verbal-choice-text"><b>惡言相向${self?` · ${esc(selfLabel)}`:''}</b>${line?`<span class="verbal-choice-line">「${esc(line)}」</span>`:allowed&&targets.length>1?'<span class="verbal-choice-line">選一位在場的人，把話說出口。</span>':''}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
}
function patronageControl(){
 if(!run?.patronage||run.pending||run.completed||typeof canRequestPatronageReply!=='function')return'';
 const available=canRequestPatronageReply(run),targets=available?getPatronageReplyTargets(run):[];
 if(!available&&run.flags.patronage_reply_last_turn!==run.turn+1)return'';
 const target=targets.length===1?targets[0]:null,line=target?getPatronageReplyLine(run,target):'';
 const stance=target?(['wing','spencer'].includes(target)?'向上表忠':'擺點架子'):'';
 return `<button class="choice patronage-trigger" data-action="patronage-reply" ${available?'':'disabled'}${available?'':' title="這個工作回合已發過話，先繼續眼前的事。"'}><span class="patronage-icon" aria-hidden="true">♛</span><span class="choice-text"><b>自己人發話${stance?` · ${stance}`:''}</b><small class="patronage-role">${esc(run.patronage.title)}專屬回應</small>${line?`<span class="patronage-choice-line">「${esc(line)}」</span>`:available?'<span class="patronage-choice-line">選一位在場的人，拿自己人的名片開口。</span>':'<span class="patronage-choice-line">這回合已經發過話，先處理原本的事。</span>'}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
}
function collapseBanner(event){
 if(!/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed))return '<div class="collapse-banner" role="alert"><span aria-hidden="true">!</span><div><b>當場崩潰</b><p>不是腦內劇場，這次真的失控了。</p></div></div>';
 const stage=Math.min(4,Math.max(1,event.meltdownStage||run.flags.mood_crash_count||1)),count=run.flags.mood_crash_count||stage;
 const note=event.meltdownMode==='self-destruct'?'你把壓著的話公開說了出來。先處理這場情緒自爆的後續。':[
  '這次真的撐不住了，先想辦法把自己接住。',
  '上次的休整還沒完全緩過來，這次需要更多喘息。',
  '連撐住日常都開始費力，先替自己留一點空間。',
  '已經透支太多次。先處理眼前這一次，別再硬撐。',
 ][stage-1];
 return `<div class="collapse-banner meltdown-stage-${stage}" data-meltdown-stage="${stage}" role="alert"><span aria-hidden="true">!</span><div><b>第 ${count} 次心情歸零${event.meltdownMode==='self-destruct'?' · 情緒自爆':''}</b><p>${note}</p><ol class="meltdown-stage-track" aria-label="已經歷 ${count} 次心情歸零">${Array.from({length:stage},(_,index)=>`<li aria-hidden="true">${index+1}</li>`).join('')}</ol></div></div>`;
}
function choiceHTML({c,i},number){
 const guest=c.mealTarget&&Object.hasOwn(PERSONAS,c.mealTarget)?c.mealTarget:null;
 const text=typeof displayPrincessTextV47==='function'&&run?.verbalContext?.target==='princess'?displayPrincessTextV47(c.text,{target:'princess'}):c.text;
 const unavailableReason=/^e(?:34|35|36|37|38|39)-/.test(run.seed)&&guest&&run.flags[`meal_invite_${guest}_day_${run.turn}`]?'本工作回合已邀請過，下一個工作回合再問。':'存款不足，先選其他安排。';
 return `<button class="choice ${c.rageTarget?'rage-target-choice':''}${guest?' meal-guest-choice':''}" data-choice="${i}" data-choice-view="${gameViewRevision+1}"${guest?` data-meal-target="${guest}"`:''}${c.available===false?` disabled title="${unavailableReason}"`:''}>${guest?avatar(guest,'meal-choice-avatar'):c.rageTarget?avatar(c.rageTarget,'rage-choice-avatar'):''}<span class="choice-key">${pad(number+1)}</span><span class="choice-text">${esc(text)}${guest?`<small class="meal-guest-title">${escapeHTML(PEOPLE[guest].title)}</small>`:''}</span><span class="choice-arrow">↗</span></button>`;
}
let ragePickerContext=null,gameViewRevision=0;
function isRagePickerOpen(){return dialog.open&&$('#dialog-content').innerHTML.includes('data-rage-target-picker');}
function cancelRagePicker(){ragePickerContext=null;if(isRagePickerOpen())dialog.close();}
function commitRage(target){
 const nextRun=target===undefined?requestRage(run):requestRage(run,target);
 if(nextRun!==run){run=nextRun;finishRecord();game();}
}
function beginRage(){
 if(screen!=='game'||dialog.open||!run||!canRequestRage(run))return;
 const targets=getRageTargets(run).filter(id=>Object.hasOwn(PERSONAS,id));
 if(targets.length===1||/^e13-/.test(run.seed)){commitRage();return;}
 if(targets.length<2)return;
 ragePickerContext={run,runId:run.runId||null,seed:run.seed,actionsLength:run.actions.length,eventId:run.eventId,pending:run.pending,viewRevision:gameViewRevision,targets};
 openDialog(`<section class="rage-target-picker" data-rage-target-picker><span class="eyebrow">THEY ARE ALL RIGHT HERE.</span><h2 id="dialog-title">這次，你想對誰出手？</h2><p class="dialog-lead">眼前這幾位都在。選一個，或先把手收回來。</p><div class="rage-target-grid targets-${targets.length}">${targets.map(id=>`<button type="button" class="rage-person-card" data-action="rage-target" data-rage-target="${id}">${avatar(id,'rage-person-avatar')}<span class="rage-person-title">${escapeHTML(PEOPLE[id].title)}</span><b>${esc(PERSONAS[id].name)}</b><span class="rage-person-action">就他了 <span aria-hidden="true">↗</span></span></button>`).join('')}</div><button type="button" class="secondary rage-picker-cancel" data-action="rage-cancel">先收手，繼續對話 <span>←</span></button></section>`);
}
function confirmRageTarget(target){
 const context=ragePickerContext;if(!context||!isRagePickerOpen())return;
 const current=screen==='game'&&run===context.run&&(run.runId||null)===context.runId&&run.seed===context.seed&&run.actions.length===context.actionsLength&&run.eventId===context.eventId&&run.pending===context.pending&&gameViewRevision===context.viewRevision;
 if(!current||!canRequestRage(run)){cancelRagePicker();return;}
 const targets=getRageTargets(run);
 if(!context.targets.includes(target)||!targets.includes(target)||targets.length<2)return;
 ragePickerContext=null;dialog.close();commitRage(target);
}
let verbalPickerContext=null;
function isVerbalPickerOpen(){return dialog.open&&$('#dialog-content').innerHTML.includes('data-verbal-target-picker');}
function cancelVerbalPicker(){verbalPickerContext=null;if(isVerbalPickerOpen())dialog.close();}
function commitVerbal(target){
 const nextRun=requestVerbal(run,target,2);
 if(nextRun!==run){run=nextRun;finishRecord();game();}
}
function beginVerbal(){
 if(screen!=='game'||dialog.open||!run||!canRequestVerbal(run))return;
 const targets=getVerbalTargets(run);
 if(targets.length===1){commitVerbal();return;}
 if(targets.length<2)return;
 verbalPickerContext={run,runId:run.runId||null,seed:run.seed,actionsLength:run.actions.length,eventId:run.eventId,pending:run.pending,viewRevision:gameViewRevision,targets};
 openDialog(`<section class="rage-target-picker verbal-target-picker" data-verbal-target-picker><span class="eyebrow">WORDS CAN LEAVE A MARK.</span><h2 id="dialog-title">這句話，你想對誰說？</h2><p class="dialog-lead">選一位在場的人開嗆，也可以先把話吞回去。</p><div class="rage-target-grid targets-${targets.length}">${targets.map(id=>`<button type="button" class="rage-person-card verbal-person-card" data-action="verbal-target" data-verbal-target="${id}">${avatar(id,'rage-person-avatar')}<span class="rage-person-title">${escapeHTML(PEOPLE[id].title)}</span><b>${esc(PERSONAS[id].name)}</b><span class="verbal-target-line">「${esc(shownVerbalLine(run,id))}」</span><span class="rage-person-action">就對他說 <span aria-hidden="true">↗</span></span></button>`).join('')}</div><button type="button" class="secondary" data-action="verbal-cancel">先不說，回到故事 <span>←</span></button></section>`);
}
function confirmVerbalTarget(target){
 const context=verbalPickerContext;if(!context||!isVerbalPickerOpen())return;
 const current=screen==='game'&&run===context.run&&(run.runId||null)===context.runId&&run.seed===context.seed&&run.actions.length===context.actionsLength&&run.eventId===context.eventId&&run.pending===context.pending&&gameViewRevision===context.viewRevision;
 if(!current||!canRequestVerbal(run)){cancelVerbalPicker();return;}
 const targets=getVerbalTargets(run);
 if(!context.targets.includes(target)||!targets.includes(target)||targets.length<2)return;
 verbalPickerContext=null;dialog.close();commitVerbal(target);
}
let patronagePickerContext=null;
function isPatronagePickerOpen(){return dialog.open&&$('#dialog-content').innerHTML.includes('data-patronage-target-picker');}
function cancelPatronagePicker(){patronagePickerContext=null;if(isPatronagePickerOpen())dialog.close();}
function commitPatronageReply(target){
 const nextRun=requestPatronageReply(run,target);
 if(nextRun!==run){run=nextRun;finishRecord();game();}
}
function beginPatronageReply(){
 if(screen!=='game'||dialog.open||!canRequestPatronageReply(run))return;
 const targets=getPatronageReplyTargets(run);
 if(targets.length===1){commitPatronageReply(targets[0]);return;}
 if(targets.length<2)return;
 patronagePickerContext={run,actionsLength:run.actions.length,eventId:run.eventId,viewRevision:gameViewRevision,targets};
 openDialog(`<section class="rage-target-picker patronage-target-picker" data-patronage-target-picker><span class="eyebrow">自己人，也是分對象的。</span><h2 id="dialog-title">這張名片，要遞給誰看？</h2><p class="dialog-lead">對同事擺架子，對翅膀和董事長換一副口氣。先看要說的話，再決定要不要開口。</p><div class="rage-target-grid targets-${targets.length}">${targets.map(id=>`<button type="button" class="rage-person-card patronage-person-card" data-action="patronage-target" data-patronage-target="${id}">${avatar(id,'rage-person-avatar')}<span class="rage-person-title">${escapeHTML(PEOPLE[id].title)}</span><b>${esc(PERSONAS[id].name)}</b><small>${['wing','spencer'].includes(id)?'向上表忠':'擺點架子'}</small><span class="patronage-choice-line">「${esc(getPatronageReplyLine(run,id))}」</span><span class="rage-person-action">就對他說 <span aria-hidden="true">↗</span></span></button>`).join('')}</div><button type="button" class="secondary" data-action="patronage-cancel">先不擺，回去好好說話 <span>←</span></button></section>`);
}
function confirmPatronageTarget(target){
 const context=patronagePickerContext;if(!context||!isPatronagePickerOpen())return;
 const current=screen==='game'&&run===context.run&&run.actions.length===context.actionsLength&&run.eventId===context.eventId&&gameViewRevision===context.viewRevision;
 if(!current||!canRequestPatronageReply(run)){cancelPatronagePicker();return;}
 if(!context.targets.includes(target)||!getPatronageReplyTargets(run).includes(target))return;
 patronagePickerContext=null;dialog.close();commitPatronageReply(target);
}
function toast(t){clearTimeout(toastTimer);$('#toast').textContent=t;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function view(html,name,focus=true){if(shareholderCleanupV58){shareholderCleanupV58();shareholderCleanupV58=null;}if(activityPlayCleanupV55){activityPlayCleanupV55();activityPlayCleanupV55=null;}if(patronagePickerContext)cancelPatronagePicker();if(ragePickerContext)cancelRagePicker();if(verbalPickerContext)cancelVerbalPicker();gameViewRevision++;screen=name;main.innerHTML=html;const adminEntry=$('[data-action="admin-archive"]');if(adminEntry)adminEntry.hidden=name!=='home';if(focus){window.scrollTo({top:0,behavior:'instant'});main.focus({preventScroll:true});}}
function schoolHTML(r){const ed=r.education;return ed?`${esc(ed.school)}<small>${esc(ed.department)} · ${esc(ed.degree||'')}</small>`:'履歷保密中';}
function avatar(id,extra=''){
 const p=PEOPLE[id]||PEOPLE.wing;
 if(p.members)return `<span class="avatar avatar-group ${extra}" role="img" aria-label="法師、真真、阿福三件套動畫角色">${p.members.map(member=>`<span class="avatar portrait-avatar"><img src="${PEOPLE[member].image}" alt="" loading="lazy"></span>`).join('')}</span>`;
 return `<span class="avatar ${p.portrait?'portrait-avatar ':''}${extra}">${p.image?`<img src="${p.image}" alt="${esc(p.name)} 原創動畫角色" loading="lazy">`:`<span>${p.initial}</span>`}</span>`;
}
function home(focus=true){view(`<section class="home"><div class="hero"><div class="hero-copy"><span class="eyebrow pill">OFFICE LIFE, UNPREDICTABLE.</span><h1>你的前途，<br><span>隨機應變。</span></h1><p class="hero-desc">履歷靠骰子，未來靠選擇。<br>歡迎加入移動。這一次，你能待到哪一天？</p><div class="hero-actions"><button class="primary" data-action="new">擲出我的人生 <span>↗</span></button><button class="text-button" data-action="${run?'continue':'about'}">${run?(run.completed?'回看上次人生':'繼續上班'):'入職前先看看'} <span>→</span></button></div><button class="home-leaderboard-entry" data-action="leaderboard">看看誰把人生玩成了傳說 <span aria-hidden="true">↗</span></button><div class="hero-numbers"><div><b>${String(ROLES.length).padStart(2,'0')}</b><span>應徵職缺</span></div><div><b>${ENDINGS.length}</b><span>未知結局</span></div><div><b>∞</b><span>意料之外</span></div></div></div><div class="hero-stage" aria-label="翅膀與董事長屎潘蛇的遊戲角色"><span class="shape circle"></span><span class="shape ring"></span><span class="shape yellow"></span><div class="hero-person spencer"><img src="./assets/spencer.png" alt="屎潘蛇董事長原創動畫角色"><span>屎潘蛇 <small>董事長</small></span></div><div class="hero-person wing"><img src="./assets/wing.png" alt="翅膀執行長原創動畫角色"><span>翅膀 <small>執行長</small></span></div><div class="speech-bubble">「我們很重視人才。」<small>至於你算不算，明天再說。</small></div><div class="floating-dice" aria-hidden="true">⚄</div><span class="stage-note">FICTIONAL OFFICE UNIVERSE / V.03</span></div></div><div class="feature-strip"><div><span>01 / ROLL</span><h2>先骰履歷，再談理想。</h2><p>骰出能力、學歷和薪水，再決定怎麼過這段日子。</p></div><div><span>02 / CHOOSE</span><h2>選項沒有標準答案。</h2><p>同一句話，今天說沒事，明天說可能就被約談。</p></div><div><span>03 / DISCOVER</span><h2>下班的方式，玩過才知道。</h2><p>還沒玩到的結局先保密，問號等你自己打開。</p></div></div><div class="community-banner"><div><span class="eyebrow">THE STORY IS STILL BEING WRITTEN.</span><h2>還有哪個梗，老同事一定記得？</h2><p>把漏掉的梗、記憶與遊戲建議，交給「史冊補完計畫」。</p></div><button class="secondary" data-action="feedback">我來補一頁 <span>↗</span></button></div></section>`,'home',focus);}
function recruitmentSloganHTML(onboarding=false){return `<aside class="recruitment-slogan${onboarding?' onboarding-slogan':''}" aria-label="翅膀欽點的徵才標語"><span class="recruitment-slogan-label">${onboarding?'報到須知':'翅膀欽點・徵才標語'}</span><blockquote>${esc('要好命就不要來移動，')}<br>${esc('要計較就趁早離開這裡。')}</blockquote><p>${onboarding?'你又看到徵才頁那句話。現在它貼在報到桌前。':'還沒投履歷，老闆已經把期待說完了。'}</p><span class="recruitment-slogan-stamp" aria-hidden="true">翅膀<br>欽點</span></aside>`;}
function roleScreen(focus=true){view(`<section class="page roles-page"><div class="page-heading"><span class="eyebrow">STEP 01 / THE POSITION</span><h1>這次，你想應徵什麼？</h1><p class="page-lead">先選想做的工作。至於報到後做什麼，公司還有自己的想法。</p><div class="role-quickstart"><p>目前選擇 <b>${esc(ENTRY_ROLES.find(role=>role.id===selectedRole).name)}</b><small>${selectedRole==='random'?'想交給命運，直接開骰；想指定職缺，往下挑。':'準備好了就開骰，也可以繼續往下比較職缺。'}</small></p><button class="primary" data-action="roll">就用${esc(ENTRY_ROLES.find(role=>role.id===selectedRole).name)}，骰履歷 <span aria-hidden="true">↗</span></button></div></div>${recruitmentSloganHTML()}${sceneArtHTML({id:"role-selection",title:"職缺選擇"},{compact:true})}<div class="role-grid">${ENTRY_ROLES.map(r=>`<button class="role-card ${r.id===selectedRole?'selected':''}" data-role="${r.id}" aria-pressed="${r.id===selectedRole}"><span class="role-top"><span class="role-symbol">${esc(r.symbol)}</span><span class="check">${r.id===selectedRole?'✓':'↗'}</span></span><h2>${esc(r.name)}</h2><p class="role-subtitle">${esc(r.subtitle)}</p><p>${esc(r.description)}</p></button>`).join('')}</div><div class="role-bottom"><p>已選擇 <b>${esc(ENTRY_ROLES.find(role=>role.id===selectedRole).name)}</b><small>職缺說明是一種美好的想像。</small></p><button class="primary" data-action="roll">擲出我的履歷 <span>⚄</span></button></div></section>`,'roles',focus);}
function rollCandidate(fresh=false){
 if(fresh)rerolls=0;else rerolls++;
 const draw=selectedRole==='random'?(randomRecruiter?.draw()||{kind:'normal',roleId:ROLES[Math.floor(Math.random()*ROLES.length)].id}):{kind:'normal',roleId:selectedRole};
 const seed=randomSeed(draw.kind),entry=typeof directEntryV60==='function'?directEntryV60(seed):null;
 candidate=createRun(entry?.roleId||draw.roleId,seed);rollScreen();
}
function rollScreen(){const dice=['⚀','⚁','⚂','⚃','⚄','⚅'];view(`<section class="page roll-page"><div class="page-heading"><span class="eyebrow">STEP 02 / A LITTLE LUCK</span><h1>這張履歷，夠有前途吧？</h1><p class="page-lead">${selectedRole==='random'?`這次抽中「${esc(applicationTitle(candidate))}」。能力、學歷和薪水也骰好了。`:'能力、學歷和薪水都骰好了。'}報到後會不會照談好的走，再說。${applicationTitle(candidate)==='特別任用職缺'?'錄取通知只寫「特別任用」，正式名片要到報到時才拿得到。':''}</p></div>${sceneArtHTML({id:"resume-roll",title:"骰出這次的履歷"},{roleId:applicationTitle(candidate)==='特別任用職缺'?null:candidate.roleId,compact:true})}<div class="resume-card"><div class="resume-heading"><div><span class="eyebrow">CANDIDATE / ${esc(applicationTitle(candidate))}</span><h2>你的平行人生履歷</h2></div><span class="resume-stamp">READY<br>TO WORK</span></div><div class="dice-stats">${['skill','slack','lick'].map(k=>`<div class="dice-stat"><span>${STAT_LABELS[k]}</span><div class="dice-row" aria-label="骰子點數 ${(candidate.abilityDice?.[k]||[]).join('、')}">${(candidate.abilityDice?.[k]||[3,3,3]).map(d=>`<i>${dice[d-1]}</i>`).join('')}</div><b>${candidate.stats[k]}<small>/ 100</small></b></div>`).join('')}</div><div class="resume-details">${candidate.characterGender?`<div class="resume-gender"><span>⚄ 本局角色性別</span><h3>${candidate.characterGender==='female'?'女':'男'}</h3><small>履歷隨機設定，不代表玩家本人。</small></div>`:''}<div><span>🎓 抽中的學歷</span><h3>${schoolHTML(candidate)}</h3></div><div><span>✦ 面試談好的月薪</span><h3 class="offer-salary">${candidate.offerPay||candidate.pay}<small>K / 月</small></h3></div></div><p class="resume-fine">學歷與薪資皆為遊戲隨機設定，並非你的真實資料。${/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(candidate.seed)?'三種能力共用時間與精力，骰完後會一起分配。':'能力可以在故事裡成長。'}</p></div><div class="roll-actions"><button class="text-button" data-action="back-roles">← 換個職缺</button><button class="secondary" data-action="reroll" ${rerolls>=3?'disabled':''}>${rerolls>=3?'骰子今天下班了':`再擲一次 · 還有 ${3-rerolls} 次`} <span>↻</span></button><button class="primary" data-action="start">就這樣，報到吧 <span>↗</span></button></div></section>`,'roll');}
function stat(key,value){const danger=['boss','mood','energy','cash'].includes(key)&&value<=20;return `<div class="stat ${danger?'danger':''}"><div class="stat-top"><span>${STAT_LABELS[key]}</span><b>${value}</b></div><div class="stat-track" role="meter" aria-label="${STAT_LABELS[key]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}"><div class="stat-fill" style="width:${value}%"></div></div></div>`;}
const signed=n=>`${n>0?'+':''}${n}`;
const LUCK_LABELS={success:'⚄ 這次順利過關',setback:'⚄ 這次不太順',lucky:'⚄ 這次運氣站在你這邊',ordinary:'⚄ 行動判定：平常發揮'};
function deltaChips(delta={}){return Object.entries(STAT_LABELS).filter(([k])=>Number.isFinite(delta[k])&&delta[k]!==0).map(([k,label])=>`<span class="delta-chip ${delta[k]>0?'delta-up':'delta-down'}"><span>${label}</span><b>${signed(delta[k])}</b></span>`).join('');}
function characterOutcomeHTML(history){
 const historyIndex=run?.history.indexOf(history);if(historyIndex<0)return'';
 const changes=characterHistoryChanges(run).filter(change=>change.historyIndex===historyIndex);if(!changes.length)return'';
 return `<div class="character-outcomes" aria-label="這次角色互動">${changes.map(change=>`<button type="button" data-action="characters" data-character-id="${change.id}" class="character-change ${change.affinityDelta>0?'affinity-up':change.affinityDelta<0?'affinity-down':''}"><span>${esc(PERSONAS[change.id].name)}</span><b>${change.affinityDelta?`好感 ${signed(change.affinityDelta)}`:'好感沒有改變'}</b>${change.imaginedHits?'<small>幻想扁人 +1</small>':change.realHits?'<small>真的動手 +1</small>':''}<span aria-hidden="true">↗</span></button>`).join('')}</div>`;
}
function activityPlayResultHTMLV55(row,compact=false){
 const camel=typeof renderCamelActivityResultV65==='function'?renderCamelActivityResultV65(row,compact):'';if(camel)return camel;
 const p=row?.activityOutcome?.performance;
 if(!p||p.version!==1||![0,1,2].includes(p.grade)||!Number.isInteger(p.score)||p.score<0||p.score>100)return'';
 const names=['尚在磨合','有模有樣','穩穩發揮'];
 const plan=!compact&&row.activityOutcome.id==='diet'?run?.actions?.findLast(action=>action.type==='activity-play'&&action.eventId===row.eventId)?.input:null;
 const calendar=plan?.kind==='diet'?`<ol class="activity-play-calendar-result" aria-label="已提交的七天安排">${plan.days.map((day,i)=>`<li><b>第 ${i+1} 天</b><span>${['正常吃飯','正餐加點心','咖啡代替正餐'][day.meal]}</span><small>${['下樓散步','伸展一下','休息日'][day.exercise]}</small></li>`).join('')}</ol>`:'';
 return `<section class="activity-play-result" aria-label="已揭曉的互動表現"><div><span class="eyebrow">剛才的操作已結算</span><h3>${names[p.grade]}</h3></div><div class="activity-play-result-score"><b>${p.score}<small>/100</small></b><div role="meter" aria-label="這次互動表現" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.score}"><i style="width:${p.score}%"></i></div></div>${p.injured?'<p class="activity-play-injury">碰撞結果已揭曉：有些瘀青，接著留在場邊收隊。</p>':''}${calendar}</section>`;
}
function outcomeHTML(h,compact=false){const chips=deltaChips(h.delta),shown=shownHistory(h);return `${activityPlayResultHTMLV55(h,compact)}<div class="outcome-ledger ${compact?'compact':''}">${shown.eventOutcome?`<p class="luck-result">⚄ ${esc(shown.eventOutcome.label)}：${esc(shown.eventOutcome.result)}</p>`:''}${h.chanceOutcome?`<p class="luck-result">${LUCK_LABELS[h.chanceOutcome]||'⚄ 命運已揭曉'}</p>`:''}<span class="ledger-label">這次實際變化</span><div class="delta-list" aria-label="事件後數值變化">${chips||'<span class="delta-neutral">數值沒有改變。</span>'}</div>${shown.breakdown?.length?`<details class="effect-details"><summary>看看變化從哪裡來</summary><ul>${shown.breakdown.map(part=>`<li><span>${esc(part.label)}</span><div class="delta-list">${deltaChips(part.delta)||'<span class="delta-neutral">已達數值上下限，沒有額外變化。</span>'}</div></li>`).join('')}</ul><p>上方是整件事的合計；數值介於 0～100，達到上限或下限後不再增減。</p></details>`:''}${characterOutcomeHTML(h)}</div>`;}
// Outcome labels belong to an already committed history entry. Never infer the
// current scene from cumulative rage flags: a player can have both kinds.
function rageReality(history){if(history?.hiddenOutcome?.version===1&&['imagined','real'].includes(history.hiddenOutcome.mode))return history.hiddenOutcome.mode;if(history?.eventId!=='rage-release')return null;const result=history.eventOutcome?.result;return result==='腦內劇場'?'imagined':result==='真的失控了'?'real':null;}
function displayHistoryResult(history){const shown=shownHistory(history);return rageReality(history)?polishDreamText(shown.result):shown.result;}
function realityHTML(history,compact=false){if(history?.hiddenOutcome?.mode==='verbal'||history?.verbalOutcome?.version===2||history?.eventId==='verbal-release'&&history.kind==='verbal'&&history.verbalOutcome)return `<div class="reality-indicator reality-verbal ${compact?'compact':''}"><span class="reality-symbol" aria-hidden="true">！</span><div><b>真的說出口</b><span>這是口頭衝突，沒有動手</span></div></div>`;const reality=rageReality(history);if(!reality)return'';const imagined=reality==='imagined';return `<div class="reality-indicator reality-${reality} ${compact?'compact':''}"><span class="reality-symbol" aria-hidden="true">${imagined?'☾':'!'}</span><div><b>${imagined?'腦內夢境':'現實失控'}</b><span>${imagined?'現實沒有動手':'事情真的發生了'}</span></div>${imagined?'<span class="dream-sleep" aria-hidden="true">z z Z</span>':''}</div>`;}
function spokenLineHTML(history){return (history?.verbalOutcome?.version===2||history?.patronageOutcome?.version===1||history?.hiddenOutcome?.mode==='verbal')?`<blockquote class="spoken-line" aria-label="你說出口的話"><span>你說</span><p>「${esc(shownHistory(history).choiceText)}」</p></blockquote>`:'';}
function sourceLine(ids){const src=(ids||[]).map(id=>SOURCES[id]).filter(Boolean);return src.length?src.map(s=>s.url?`<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`:esc(s.title)).join(' · '):'原創職場平行宇宙';}
function speakerFor(event){if(event.speaker&&PEOPLE[event.speaker])return event.speaker;return 'wing';}
function visibleChoices(){
 const event=shownEvent(getEvent(run)),current=/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed),showUnavailable=current&&['mood-collapse','mood-self-destruct'].includes(event.id);
 return event.choices.map((c,i)=>({c,i})).filter(({c})=>!c.hiddenAction&&(c.available!==false||c.mealTarget||showUnavailable)&&!(c.effect==='moodSelfDestruct'&&current));
}
function isPersonnelNotice(state=run){return /^e(?:20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(state?.seed||'')&&['dismissal-final','labor-claim','labor-mediation','floor-notice','watch-review','watch-future'].includes(state.eventId);}
function personnelStatus(){
 if(!/^e(?:20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 const watching=!!run.flags.floor_watch,observed=!!run.flags.post_pip_tolerance;
 if(!watching&&!observed)return'';
 return `<div class="personnel-status ${watching?'floor-watch-status':'post-pip-status'}" role="note" aria-label="目前人事狀態">${watching?'<b>三樓看門中</b><span>辦公室在五樓・原職稱保留</span>':''}${observed?'<p>PIP 已通過・仍在觀察</p>':''}</div>`;
}
// Availability is a display-only projection of the same engine guards used on
// click. Reading these explanations never starts a scene or draws an outcome.
function actionAvailability(action,state=run){
 if(state?.blockchainContext)return {allowed:false,reason:'先處理眼前的區塊鏈計畫，或從事件選項離開會場。'};
 if(state?.departureContext)return {allowed:false,reason:'先看完這次離場的結果，再安排下一件事。'};
 if(state?.treatsContext)return {allowed:false,reason:'先把眼前的飲料、下午茶或生日插曲處理完，再回工作安排。'};
 if(state?.recruitmentContext)return {allowed:false,reason:'先和瑞克、公主打完招呼，再回工作安排。'};
 if(state?.activityInvitationContext)return {allowed:false,reason:'先回覆眼前的活動邀約，再安排其他事情。'};
 const allowed=action==='break'?canRequestBreak(state)&&!isPersonnelNotice(state):action==='career'?canRequestCareer(state)&&!isPersonnelNotice(state)&&!state.flags.floor_watch:canRequestRaise(state)&&!isPersonnelNotice(state)&&!state.flags.floor_watch;
 if(allowed)return {allowed:true,reason:''};
 const no=reason=>({allowed:false,reason});
 if(!state||state.completed)return no('這段人生已經結束。');
 if(state.pending)return no('先看完眼前結果，再回工作安排。');
 if(state.shareholderContext)return no('先把這段認股或股東大會談完，再回原本的工作安排。');
 if(state.hiddenEncounterContext)return no('先處理眼前的小插曲，再回原本的工作安排。');
 if(state.activityContext)return no('先完成目前活動，再回原本的工作安排。');
 if(state.chapterContext)return no('先決定繼續上班，或確認正式離職。');
 if(isPersonnelNotice(state))return no('先處理眼前的人事通知。');
 if(state.verbalContext)return no('先把這段口舌風波處理完。');
 if(state.companyContext)return no('先確認眼前的公司方案，或從方案選單返回。');
 if(state.patronageContext)return no('先把這次特殊職位的應徵談完。');
 if(action==='career'&&state.patronage)return no('目前是特殊任用，原專業升遷暫停。');
 if(action!=='break'&&state.flags.floor_watch)return no('三樓待命中，先確認目前的工作安排。');
 if(action==='raise')return raiseAvailability(state);
 if(state.rageContext)return no('先處理這段暴走的後續。');
 if(state.breakReturnEventId)return no('休息安排已打開，先完成眼前的選擇。');
 if(state.exitReturnEventId)return no('先把這次離職安排談完。');
 if(state.resumeEventId)return no('先處理眼前的通知，再回工作安排。');
 const event=getEvent(state);
 if(action==='break'){
  if(usesWorkGap(state)){
   if(!workGapIsOpen(state))return no(usesLifeBalance(state)?state.stats.energy>30&&state.stats.mood>30?'心情或體力降到警告範圍（30 以下）後，事情告一段落時就會出現休息空檔。':'心情或體力已進入警告。先完成眼前這段事情、看完結果，再到休息空檔安排恢復。':usesEnergyRest(state)?state.stats.energy>30?'體力降到警告範圍（30 以下）後，才會在事情告一段落時出現休息空檔。':'體力已進入警告。先回覆眼前的事件、看完結果，再到休息空檔安排恢復。':'先回覆眼前的事件、看完結果，再到工作空檔安排休息。');
   if(state.lastBreakTurn===state.turn)return no(usesLifeBalance(state)?'這段空檔已安排過一次。下一件工作告一段落時，心情或體力若仍在警告範圍，就會再出現休息空檔。':usesEnergyRest(state)?'這段空檔已安排過一次。繼續上班後，體力進入警告時才會再出現休息空檔。':'這段空檔已安排過休息，完成下一件工作後再安排。');
  }
  if(!['daily','fantasy','work-gap'].includes(event?.kind))return no(event?.kind==='onboarding'?'先完成報到；回到一般工作事件時才能安排休息。':'回到一般工作事件時，才能另外安排消費或休息。');
  if(state.lastBreakTurn===state.turn)return no('這個工作回合已安排過休息，下一個工作回合再安排。');
 }else{
  if(state.pip?.active)return no('先完成目前的 PIP，再準備升遷。');
  if(state.turn>=careerReviewCutoff(state))return no('本局的升遷評核已結束，先完成接下來的故事。');
  if(state.turn<3)return no('DAY 04 起，回到一般工作事件時可準備升遷。');
  if(!['daily','fantasy','work-gap'].includes(event?.kind))return no(event?.id==='career-review'?'升遷評核已打開，先從眼前的選項安排。':'回到一般工作事件時，才能另外準備升遷。');
  if(!careerReviewWait(state))return no(state.turn<(state.flags.career_defer_until||0)?'上次已延後評核，先完成這幾天的工作。':'上次評核後還沒隔夠工作日，先繼續累積成果。');
 }
 return no('先完成眼前的安排，再回工作證查看。');
}
function sidebarAction(action,label,status){
 const reasonId=`${action}-availability-reason`;
 return `<div class="sidebar-action${status.allowed?'':' unavailable'}"><button data-action="${action}" ${status.allowed?'':`disabled aria-describedby="${reasonId}" title="${esc(status.reason)}"`}>${label} ↗</button>${status.allowed?'':`<p class="action-availability-reason" id="${reasonId}">${esc(status.reason)}</p>`}</div>`;
}
function breakControl(){
 if(usesEnergyRest()&&!workGapIsOpen())return'';
 if(!/^e(?:[2-9]|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 return sidebarAction('break',/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'存款怎麼花':'花錢喘口氣',actionAvailability('break'));
}
function careerControl(){
 if(!/^e(?:10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||'')||run.rank>=careerMaxRank(run))return'';
 return sidebarAction('career','準備升遷',actionAvailability('career'));
}
function raiseControl(){
 if(!/^e(?:19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run?.seed||''))return'';
 return sidebarAction('raise','我要談加薪',actionAvailability('raise'));
}

function activityProgress(event){return typeof activityProgressHTMLV44==='function'?activityProgressHTMLV44(run,event):'';}
function eventDepartureControlV63(){
 if(!run||run.completed||typeof getEventDepartureV63!=='function')return'';
 const leave=getEventDepartureV63(run);if(!leave)return'';
 const detail=leave.available?leave.detail:leave.reason;
 return `<button type="button" class="choice event-departure-trigger" data-action="event-departure" data-departure-view="${gameViewRevision+1}" ${leave.available?'':`disabled title="${esc(leave.reason||'先看完眼前結果，再決定下一步。')}"`}><span class="event-departure-icon" aria-hidden="true">↩</span><span class="choice-text"><b>${esc(leave.label||'我先離開這裡。')}</b>${detail?`<small>${esc(detail)}</small>`:''}</span><span class="choice-arrow" aria-hidden="true">↗</span></button>`;
}
function leaveEventV63(expectedView=gameViewRevision){
 if(screen!=='game'||!run||dialog.open||expectedView!==gameViewRevision||typeof requestEventDepartureV63!=='function')return false;
 const nextRun=requestEventDepartureV63(run);if(nextRun===run)return false;
 run=nextRun;finishRecord();game();return true;
}
function activityReturnNotice(event){const treat=typeof officeTreatReturnHTMLV61==='function'?officeTreatReturnHTMLV61(run,event):'';return treat||(typeof activityReturnNoticeHTMLV52==='function'?activityReturnNoticeHTMLV52(run,event):'');}
function activityEndNotice(event){if(run?.pending&&typeof officeTreatPhaseV61==='function'&&officeTreatPhaseV61(run,event)?.phase==='end')return officeTreatPhaseHTMLV61(run,event);return run?.pending&&typeof activityPhaseV52==='function'&&activityPhaseV52(run,event)?.phase==='end'?activityPhaseNoticeHTMLV52(run,event):'';}
function activityNextLabel(event){const treat=typeof officeTreatNextLabelV61==='function'?officeTreatNextLabelV61(run,event):null;if(treat)return treat;if(typeof activityPhaseV52!=='function')return'繼續';const phase=activityPhaseV52(run,event);return phase?.phase==='end'?'回到原本的事':phase?'繼續活動':'繼續';}

function mobileWorkbar(){return `<div class="mobile-workbar"><button data-action="work-card">工作證與數值 ↑</button><span>心情 ${run.stats.mood} · 體力 ${run.stats.energy} · 存款 ${run.stats.cash}${run.pip?.active?` · PIP 剩 ${run.pip.remaining} 回合`:''}${/^e(?:20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)&&run.flags.floor_watch?' · 三樓看門中':''}</span></div>`;}
// This reads only current resources. It never evaluates choices, rolls RNG,
// changes the run, or interrupts a committed result with a new game action.
function resourceWarningHTML(){
 if(!run||run.completed||run.pendingFamily||['mood-collapse','mood-self-destruct'].includes(run.eventId))return'';
 const risks=['energy','mood'].filter(key=>run.stats[key]>0&&run.stats[key]<=30);
 if(!risks.length)return'';
 const warningRest=usesEnergyRest(),energyWarning=risks.includes('energy'),safeRest=usesEnergySafety(),moodRest=usesLifeBalance();
 const critical=risks.some(key=>run.stats[key]<=15),modern=/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed),canRest=canRequestBreak(run)&&!isPersonnelNotice(),event=getEvent(run);
 let advice;
 if(run.pending)advice=moodRest?(run.breakReturnEventId?'先看完這次安排的結果，再回到同一段空檔確認狀態。':'先看完這次結果。心情或體力仍在警告範圍時，事情告一段落後就會出現休息空檔；活動與人事談話會先完整結束。這回合若已休息過，要等下一件工作完成。'):warningRest?(run.breakReturnEventId?'先看完這次安排的結果，再回到同一段空檔確認狀態。':energyWarning?safeRest?'先看完這次結果。活動或人事談話會先完整結束，再到休息空檔恢復；若這回合已安排過休息，完成工作後才能再安排。':'先看完這次結果。工作回合結束時若仍在警告範圍，就會出現休息空檔；若還有人事通知，先處理完通知。':'先看完這次結果，留意接下來對心情的影響。休息空檔要等體力也降到警告範圍才會出現。'):usesWorkGap()?'先看完這次結果；事情告一段落、進入工作空檔後，再安排恢復狀態。':'先看完這次結果；回到可休息的工作事件時，再安排恢復狀態。';
 else if(run.rageContext)advice='先處理這段暴走的後續，這裡暫時不能另開休息。';
 else if(run.breakReturnEventId)advice='休息安排已經打開了。挑能照顧自己的活動，有些安排仍會耗體力。';
 else if(event.id==='crisis-mood')advice='先從眼前的選項處理自己的狀態，別急著回工作訊息。';
 else if(canRest)advice=run.stats.cash<(modern?8:7)?'存款不多，先確認買得起哪些安排，記得留生活費。':usesWorkGap()?'現在是工作空檔，可以先安排恢復體力或心情的活動；花費會從存款扣除。':'可以先安排休息，挑能恢復體力或心情的活動；花費會從存款扣除。';
 else if(run.lastBreakTurn===run.turn&&['daily','fantasy','work-gap'].includes(event.kind))advice=usesWorkGap()?'這段空檔已安排過休息。繼續上班前，先留意目前的狀態。':'這個工作回合已安排過休息，下個可休息的工作回合再安排。';
 else advice=moodRest?'心情或體力已進入警告。先完成眼前這段事情，告一段落後就能到休息空檔照顧自己，不必等另一項也見底。活動與人事談話會先完整結束。':warningRest?(energyWarning?safeRest?'體力已進入警告。先完成眼前這段活動或談話，回到休息空檔再安排恢復；已用過本回合的休息，則等工作完成。':'體力已進入警告。先完成眼前的工作回合，再到休息空檔安排恢復。':'心情已進入警告，先留意眼前的選擇；只有體力也降到 30 以下，事情告一段落後才會出現休息空檔。'):usesWorkGap()?'先處理眼前的事情，工作空檔才能另外安排休息；留意目前的心情與體力。':'目前不能另外安排休息。先留意眼前的選擇，回到可休息的工作事件再安排。';
 return `<section class="resource-warning ${critical?'critical':'caution'}" data-resource-warning role="alert" aria-atomic="true"><span class="resource-warning-icon" aria-hidden="true">!</span><div class="resource-warning-content"><b class="resource-warning-title">${critical?'快撐不住了，先顧自己。':'電量偏低，別只顧著上班。'}</b><ul>${risks.map(key=>`<li data-warning-stat="${key}"><b>${STAT_LABELS[key]}剩 ${run.stats[key]} / 100</b><span>${key==='energy'?'體力耗盡可能讓這段人生直接結束。':modern?'心情歸零會真正失控，記得留時間照顧自己。':'心情再降下去，會遇到情緒危機。'}</span></li>`).join('')}</ul><p>${advice}</p>${canRest?'<button type="button" class="resource-rest-button" data-action="break">查看休息安排 <span aria-hidden="true">↗</span></button>':''}</div></section>`;
}
function usesEnergySafety(state=run){return typeof isEnergySafetyV54==='function'?isEnergySafetyV54(state):/^e39-cal46-kin49-g-e-s-/.test(state?.seed||'');}
function usesLifeBalance(state=run){return typeof isLifeBalanceV62==='function'?isLifeBalanceV62(state):/^e39-r6[23567]-[nsd]-[0-9a-f]{22}$/.test(state?.seed||'');}
function usesEnergyRest(state=run){return typeof isEnergyRestV53==='function'?isEnergyRestV53(state):/^e39-cal46-kin49-g-e-/.test(state?.seed||'');}
function usesWorkGap(state=run){return typeof isWorkGapV50==='function'?isWorkGapV50(state):/^e39-cal46-kin49-g-/.test(state?.seed||'');}
function workGapIsOpen(state=run){return typeof isWorkGapOpenV50==='function'&&isWorkGapOpenV50(state);}
function gameSidebarHTML(ev){return `<aside class="game-sidebar${careerMaxRank(run)===7?' full-career-sidebar':''}" tabindex="-1"><div class="player-card"><div class="employee-line"><span class="eyebrow">MY WORK ID</span><span class="level">LV.${run.rank}</span></div><h2>${esc(shownJobTitle(run))}</h2><p class="job-origin">應徵：${esc(applicationTitle(run))}${run.assignment!=='honest'?` <span class="job-warning">${run.assignment==='assistant'?'實際職務':'職務異動'}</span>`:''}</p>${personnelStatus()}${careerTrack()}${shareholderHoldingHTMLV58()}<div class="salary-line"><span>月薪</span><b>${run.pay}<small>K</small></b></div><div class="education-mini">${schoolHTML(run)}${run.characterGender?`<p class="character-gender">角色性別：${run.characterGender==='female'?'女':'男'} · 本局設定</p>`:''}</div></div><div class="boss-panel ${run.stats.boss<=20?'angry':''}"><div class="boss-intro">${avatar('wing')}<div><b>翅膀</b><small>${bossLabel(run.stats.boss)}</small></div><span class="mood-dot"></span></div><div class="mood-stats">${stat('boss',run.stats.boss)}${stat('mood',run.stats.mood)}</div></div><div class="resource-stats">${['energy','cash','trust','dream'].map(k=>stat(k,run.stats[k])).join('')}</div><div class="skill-stats">${['skill','slack','lick'].map(k=>stat(k,run.stats[k])).join('')}</div>${run.pip?.active?`<div class="pip-status"><span>希望的改善計畫</span><b>剩 ${run.pip.remaining} 回合</b></div>`:''}<div class="sidebar-controls"><button data-action="guide">數值與運氣怎麼算？ ↗</button>${breakControl()}${careerControl()}${raiseControl()}<button data-action="characters">角色圖鑑 ↗</button><button data-action="journal">背鍋紀錄 ↗</button><button class="mobile-return-story" data-action="story">回到故事 ↓</button><button data-action="exit" ${run.pending||run.blockchainContext||run.departureContext||run.treatsContext||run.recruitmentContext||run.shareholderContext||run.hiddenEncounterContext||run.activityInvitationContext||run.activityContext||run.chapterContext||run.verbalContext||run.companyContext||run.patronageContext||run.raiseContext||run.salaryAdvice?.status==='open'||isPersonnelNotice()||['rage','rage-world','self-care'].includes(ev.kind)||['mood-collapse','mood-self-destruct','exit-menu','career-exit','rank-exit','story-exit','career-step-down','wealth-plan','wealth-startup','wealth-retire'].includes(ev.id)?'disabled':''}>我想離職了 ↗</button></div></aside>`;}
function workGapScreen(focus=true){
 const ev=getEvent(run),rest=actionAvailability('break'),nextChoice=ev.choices[0];
 view(`<section class="game-layout work-gap-layout">${gameSidebarHTML(ev)}${renderWorkGapHTMLV50({day:Math.min(run.turn+1,MAX_TURNS),stats:run.stats,warningRest:usesEnergyRest(),moodRest:usesLifeBalance(),restAllowed:rest.allowed,restReason:rest.reason,warningHTML:activityReturnNotice(ev)+resourceWarningHTML(),mobileWorkbarHTML:mobileWorkbar(),continueChoiceHTML:choiceHTML({c:nextChoice,i:0},0)}).replace('<div class="work-gap-continue">',eventDepartureControlV63()+'<div class="work-gap-continue">')}</section>`,'game',focus);
 if(focus&&window.matchMedia('(max-width:800px)').matches){const chapter=$('.chapter');chapter.scrollIntoView({block:'start',behavior:'instant'});chapter.focus({preventScroll:true});}
}
function shareholderHoldingHTMLV58(){
 const holding=typeof getShareholderStatusV58==='function'?getShareholderStatusV58(run):null;
 if(!holding)return '';
 const finance=holding.financing,loan=holding.loan;
 return `<section class="shareholder-holding-v58" aria-label="員工認股紀錄"><span class="eyebrow">EMPLOYEE SHARES</span><b>員工股東</b><p>已投入 ${Number(holding.paid)} 存款</p>${finance?`<small>自有存款全押 ${Number(finance.ownCash)} ＋信貸加碼 ${Number(finance.financedShares)}；另留 ${Number(finance.reserveCash)} 借款周轉。</small>`:''}${loan?`<p>認股信貸尚欠 <b>${Number(loan.remaining)}</b>／${Number(loan.total)}</p><small>已還 ${Number(loan.paid)}；每完成 4 個工作回合還 12，休息與股東會不另計期數。</small>${loan.remaining>0&&run.completed?'<small>離開公司不代表債務結清，剩餘信貸仍須償還。</small>':''}`:''}<small>${esc(holding.label|| (holding.attended?'曾出席股東大會':'等待股東大會通知'))}</small><small>未變現的股份不計入可用存款。</small></section>`;
}
function shareholderPlayScreenV58(focus=true){
 const ev=shownEvent(getEvent(run));
 view(`<section class="game-layout shareholder-layout-v58">${gameSidebarHTML(ev)}<article class="chapter shareholder-chapter-v58" tabindex="-1">${mobileWorkbar()}<div class="chapter-meta"><span>DAY ${pad(Math.min(run.turn+1,MAX_TURNS))} / 股東大會</span><span class="tag">證詞攻防</span></div>${resourceWarningHTML()}<h1 class="chapter-title">${esc(ev.title)}</h1><p class="chapter-body">${esc(ev.body)}</p>${shareholderGameHTMLV58(run)}${eventDepartureControlV63()}<p class="story-source">原創職場諷刺支線 · 人物對白與文件均為虛構改編</p></article></section>`,'game',focus);
 const revision=gameViewRevision,eventId=ev.id,seed=run.seed;
 shareholderCleanupV58=mountShareholderGameV58($('[data-shareholder-game-v58]'),{run,onPlay:input=>{
  if(screen!=='game'||dialog.open||gameViewRevision!==revision||run.seed!==seed||run.pending||run.completed||getEvent(run)?.id!==eventId||!getShareholderPlayV58(run))return false;
  const nextRun=applyShareholderPlay(run,input);if(nextRun===run)return false;
  run=nextRun;collectAchievements();syncCharacterProof();save();game();return true;
 }});
 if(focus&&window.matchMedia('(max-width:800px)').matches){const chapter=$('.chapter');chapter.scrollIntoView({block:'start',behavior:'instant'});chapter.focus({preventScroll:true});}
}
function activityPlayScreenV55(focus=true){
 const ev=shownEvent(getEvent(run)),person=speakerFor(ev),p=PEOPLE[person];
 view(`<section class="game-layout">${gameSidebarHTML(ev)}<article class="chapter activity-play-chapter" tabindex="-1">${mobileWorkbar()}<div class="chapter-meta"><span>DAY ${pad(Math.min(run.turn+1,MAX_TURNS))} / ${esc(ev.era)}</span><span class="tag">親自上場</span></div>${resourceWarningHTML()}<h1 class="chapter-title">${esc(ev.title)}</h1>${activityProgress(ev).replace("本場先用這一幕的選項回應，結束後回到原本的工作。","本幕在下方動手操作，交出紀錄後才揭曉結果。")}<p class="chapter-body">${esc(ev.body)}</p><div class="character-quote">${avatar(person,'quote-avatar')}<div><span class="speaker-name">${esc(p.name)} <small>${escapeHTML(p.title)} · 遊戲角色</small></span><p>${esc(ev.wing)}</p></div></div>${renderActivityPlayHTMLV55(run,ev)}${eventDepartureControlV63()}<p class="story-source">創作靈感 / ${sourceLine(ev.sourceIds)}</p></article></section>`,'game',focus);
 const revision=gameViewRevision,eventId=ev.id,seed=run.seed;
 activityPlayCleanupV55=mountActivityPlayV55({root:$('[data-activity-play-v55]'),run,event:ev,onCommit:input=>{
  if(screen!=='game'||dialog.open||gameViewRevision!==revision||run.seed!==seed||run.pending||run.completed||getEvent(run)?.id!==eventId||!getActivityPlayV55(run))return false;
  const nextRun=applyActivityPlay(run,input);if(nextRun===run)return false;
  run=nextRun;collectAchievements();syncCharacterProof();save();game();return true;
 }});
 if(focus&&window.matchMedia('(max-width:800px)').matches){const chapter=$('.chapter');chapter.scrollIntoView({block:'start',behavior:'instant'});chapter.focus({preventScroll:true});}
}
function game(focus=true){if(!run)return roleScreen();if(run.completed)return endingReviewKey===endingIdentity(run)?endingTransitionScreen():endingScreen();if(workGapIsOpen())return workGapScreen(focus);if(typeof getShareholderPlayV58==='function'&&typeof shareholderGameHTMLV58==='function'&&getShareholderPlayV58(run))return shareholderPlayScreenV58(focus);if(typeof getActivityPlayV55==='function'&&typeof renderActivityPlayHTMLV55==='function'&&getActivityPlayV55(run))return activityPlayScreenV55(focus);const current=shownEvent(getEvent(run)),last=run.history.at(-1),shownLast=shownHistory(last),ev=run.pending&&last?.eventId===current.id&&current.id!=='chapter-resolution'?{...current,title:shownLast.title,body:shownLast.body,wing:shownLast.wing??current.wing}:current,crisis=ev.kind==='crisis',person=speakerFor(ev),p=PEOPLE[person],choices=visibleChoices(),reality=run.pending?rageReality(last):null,collapse=['mood-collapse','mood-self-destruct'].includes(ev.id),newRules=/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed),resourceWarning=resourceWarningHTML(),zeroWarning=newRules&&run.pending&&run.stats.mood===0&&!collapse&&!reality&&!run.rageContext&&!run.pendingFamily&&!['rage','rage-world','self-care'].includes(ev.kind);view(`<section class="game-layout">${gameSidebarHTML(ev)}<article class="chapter${ev.hiddenCharacter?' hidden-character-chapter':''} ${crisis?'crisis-chapter':''}${collapse?' mood-collapse-chapter':''}${ev.id==='mood-self-destruct'?' self-destruct-chapter':''}" tabindex="-1">${mobileWorkbar()}${!/^e(?:[2-9]|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'<div class="rules-notice"><p>這局保留原本的玩法。新版心情消耗、花錢紓壓與更多史冊事件，從新人生開始。</p><button class="text-button" data-action="new">開一段新人生 ↗</button></div>':''}<div class="chapter-meta"><span>${crisis?'SOMETHING HAPPENED':`DAY ${pad(Math.min(run.turn+1,MAX_TURNS))} / ${esc(ev.era||'上班日常')}`}</span><span class="tag">${collapse?(ev.id==='mood-self-destruct'?'情緒自爆':'當場崩潰'):isPersonnelNotice()?'人事通知':reality==='imagined'?'腦內夢境':ev.kind==='rage-world'?'失控後的世界':ev.kind==='rage'?(/^e(?:14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'當場暴走':'卡通暴走'):ev.hiddenCharacter?'隱藏角色':ev.kind?.startsWith('shareholder')?'股東支線':ev.kind==='activity-invitation'?(run.activityInvitationContext?.id==='banquet'?'公司通知':'突發邀約'):ev.kind==='activity'?'活動進行中':ev.kind==='event-departure'?'事件離場':ev.kind==='blockchain'?'區塊鏈支線':ev.kind==='office-treat'?'辦公室插曲':ev.kind==='recruitment'?'特殊任用':ev.kind==='patronage'?'自己人發話':ev.kind==='verbal'?'口舌風波':ev.kind==='company'?'公司幻想線':ev.kind==='banquet'?'尾牙之夜':ev.id==='kind-workday'?'突然被揪':ev.kind==='self-care'?'喘口氣':ev.kind==='onboarding'?'報到日':ev.kind==='fantasy'?'平行未來':/^e(?:20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)&&run.flags.floor_watch?'三樓待命':ev.kind==='career'&&/^e(?:8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'職涯選擇':crisis?'臨時通知':'移動日常'}</span></div><div class="chapter-progress"><span style="width:${Math.min(100,(run.turn+1)/MAX_TURNS*100)}%"></span></div>${ev.hiddenCharacter?'<p class="private-scene-label">CHANCE MEETING / 偶然相遇</p>':ev.scope==='private'?'<p class="private-scene-label">PRIVATE TIME / 私人場合</p>':''}${!run.pending?resourceWarning:''}${collapse?collapseBanner(ev):''}${ev.hiddenCharacter?`<aside class="hidden-character-banner" aria-label="遇見隱藏角色"><span aria-hidden="true">✦</span><div><b>RARE ENCOUNTER / 隱藏角色</b><p>遇見${esc(p.name)}。公開圖鑑仍保留這個人的身分。</p></div></aside>`:''}${activityReturnNotice(ev)}<h1 class="chapter-title">${esc(ev.title)}</h1>${typeof armSceneContextHTMLV51==='function'?armSceneContextHTMLV51(run,ev):''}${activityProgress(ev)}${typeof officeTreatPhaseHTMLV61==='function'&&(!run.pending||officeTreatPhaseV61(run,ev)?.phase!=='end')?officeTreatPhaseHTMLV61(run,ev):''}${sceneArtHTML(ev,{roleId:run.actualRoleId,people:(['office-treat','event-departure','blockchain'].includes(ev.kind)||ev.kind==='activity'&&/^e39-r(?:63|65)-/.test(run.seed))?(ev.illustrationPeople||ev.participants||p?.members||[person]):p?.members||[person],reality})}<p class="chapter-body">${esc(ev.body)}</p>${ev.resolvedChapter?`<aside class="chapter-resolved-record"><span class="eyebrow">前一幕已經發生的結果</span><p>${esc(ev.resolvedChapter.result)}</p><small>這段經歷已記下；是否離職，仍由你決定。</small></aside>`:""}${ev.id==='onboarding'?recruitmentSloganHTML(true):''}${ev.id==='self-care'&&!run.pending?'<p class="self-care-availability-note" role="note">每個工作回合只能開啟一次休息安排；選擇先不花錢，也算使用這次安排。</p>':''}${ev.wing?`<div class="character-quote">${avatar(person,'quote-avatar')}<div><span class="speaker-name">${esc(p.name)} <small>${escapeHTML(p.title)} · 遊戲角色</small></span><p${person==='princess'?' lang="en"':''}>${esc(ev.wing)}</p>${ev.hiddenCharacter?'<span class="hidden-book-note">圖鑑身分保留 · ？？？</span>':`<button type="button" class="character-quote-link" data-action="characters" ${PERSONAS[person]?`data-character-id="${person}"`:""}>角色圖鑑 ↗${PERSONAS[person]?`<span>本局好感 ${characterAffinity(run,person).score}</span>`:""}</button>`}</div></div>`:''}${run.pending?`<div class="consequence${reality?` ${reality}-consequence`:``}" role="status"${reality?` aria-label="${reality==='imagined'?'腦內夢境結果':'現實失控結果'}"`:``}>${activityEndNotice(ev)}${realityHTML(last)}${spokenLineHTML(last)}${resourceWarning}<span class="eyebrow">AND THEN… / 結果是這樣的</span><p class="result-text">${esc(displayHistoryResult(last))}</p>${last.weather?`<p class="weather-note">☁ ${esc(last.weather.text)}</p>`:''}${outcomeHTML(last)}${recentAchievementHTML()}${zeroWarning?`<p class="mood-zero-warning" role="alert"><span aria-hidden="true">!</span>${run.activityContext?'心情已歸零，活動結束後要面對這次失控。':'心情已歸零，下一步要面對這次失控。'}</p>`:''}${reality==='imagined'?'<p class="dream-return-note"><b>睜開眼，還在原地。</b>剛才只發生在你的腦海，接著繼續面對眼前的事。</p>':''}<div class="result-footer"><span>${reality==='imagined'?'夢醒了，故事繼續。':'故事已記入這次人生'}</span><button class="primary" data-action="next">${reality==='imagined'?'回到現實':reality==='real'?'面對後續':activityNextLabel(ev)} <span>→</span></button></div></div><div class="rage-result-action">${eventDepartureControlV63()}${patronageControl()}${verbalControl()}${rageControl()}</div>`:`<div class="choices-label"><span>如果是你，會怎麼做？</span><small>想怎麼回，就怎麼回。</small></div><div class="choices ${ev.kind==='rage'?'rage-choices':''}${choices.some(({c})=>c.mealTarget)?' meal-choices':''}">${choices.map(choiceHTML).join('')}${eventDepartureControlV63()}${patronageControl()}${verbalControl()}${rageControl()}</div>`}${!/^e(?:14|15|16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'<p class="upgrade-inline">新的當場暴走與失控後續，從新人生開始。這局保留原本規則，符合條件的成就仍能補收。</p>':''}<p class="story-source">創作靈感 / ${sourceLine(ev.sourceIds)}</p></article></section>`,'game',focus);if(focus){if(window.matchMedia('(max-width:800px)').matches){const target=run.pending?$('.consequence'):$('.chapter');target.scrollIntoView({block:'start',behavior:'instant'});if(!run.pending)target.focus({preventScroll:true});}else if(run.pending)$('.consequence').scrollIntoView({block:'nearest',behavior:'instant'});}}
function endingTextForRun(ending){
 ending=shownEnding(ending);
 if(typeof chapterDepartureCopyV38==='function')ending=chapterDepartureCopyV38(run,ending);
 if(ending&&typeof isOnboardingDeclineV66==='function'&&isOnboardingDeclineV66(run))return {...ending,title:'名片先別拆，我沒有要接。',subtitle:'這份任用，到報到桌前為止。',body:'你看完實際職稱與交辦方式，決定不接受這份任用。名片留在桌上，尚未生效的條件也沒有簽下去。翅膀還在說機會難得，你已經走出門口；今天沒有開始受僱，這次結局記下的是拒絕這份工作。'};
 if(ending&&/^e39-r(?:63|65|66|67)-/.test(run?.seed||'')&&run.flags?.departure63_onboarding_declined&&ending.family==='ragequit'&&['onboarding','verbal'].includes(run.history?.at(-1)?.departureOutcome?.category))return {...ending,title:'名片先別拆，我沒有要接。',subtitle:'這次報到，由你提早喊停。',body:'你把還沒收下的名片留在桌上，說這份任用不接受。翅膀還準備繼續交代，你已經轉身走向門口。今天沒有完成報到，也沒有補簽別的職稱或薪資。這段人生停在你決定不留下的那一刻。'};
 if(!ending||!/^e(?:32|33|34|35|36|37|38|39)-/.test(run?.seed||'')||ending.family!=='taiwan')return ending;
 // The published generic Taiwan card stays intact for old saves/collections;
 // this cohort's actual company scene specifically resolves an OTC listing.
 return {...ending,subtitle:ending.subtitle.replaceAll('上市','上櫃'),body:ending.body.replaceAll('上市','上櫃')};
}
const types={good:'GOOD END',bad:'BAD END',normal:'ANOTHER LIFE',secret:'HIDDEN CHAPTER'};
function endingTransitionScreen(){
 const ending=ENDINGS.find(item=>item.id===run?.endingId),context=endingCauseHTML(run,ending);
 if(!context){endingReviewKey=null;return endingScreen();}
 view(`<section class="ending-transition-page"><div class="ending-transition-paper"><span class="ending-transition-day">DAY ${pad(Math.min(run.turn+1,MAX_TURNS))} / 最後一幕</span>${context}<div class="ending-transition-actions"><button class="primary" data-action="ending-continue">查看這次結局 <span>→</span></button><button class="text-button" data-action="journal">查看完整背鍋紀錄 ↗</button></div></div></section>`,'ending-transition');
}
function finishRecord(){collectAchievements();syncCharacterProof();if(run?.completed){if(!unlocked.includes(run.endingId)){unlocked.push(run.endingId);records[run.endingId]={turn:run.turn+1,job:jobTitle(run),pay:run.pay};toast(`一個問號，有了答案。${unlocked.length} / ${ENDINGS.length}`);}void cloud.complete(run);}save();}
function endingScreen(){const e=endingTextForRun(ENDINGS.find(e=>e.id===run?.endingId));if(!e)return home();view(`<section class="ending-page"><div class="ending-paper ${e.type==='bad'?'bad-ending':''}"><div class="ending-top"><span>THE MOVING LIFE / ${String(ENDINGS.findIndex(item=>item.id===e.id)+1).padStart(3,'0')}</span><span>已解鎖 ✓</span></div>${endingArtHTML(e,{unlocked:true})}<div class="ending-layout"><div><span class="ending-type">${types[e.type]}</span><h1>${esc(e.title)}</h1><p class="ending-subtitle">${esc(e.subtitle)}</p><p class="ending-body">${esc(e.body)}</p>${e.retrospectiveBody?`<details class="ending-retrospective"><summary>離職前的篇章回顧（當時仍在職）</summary><p>以下是離職前那一幕的紀錄，並非目前的任職狀態。</p><blockquote>${esc(e.retrospectiveBody)}</blockquote></details>`:""}</div><div class="ending-symbol" aria-hidden="true"><span>${esc(e.symbol||'終')}</span><small>YOUR STORY.<br>YOUR ENDING.</small></div></div>${endingCauseHTML(run,e,{compact:true})}<div class="ending-employment"><span>應徵 <b>${esc(applicationTitle(run))}</b></span><span>實際 <b>${esc(shownJobTitle(run))}</b></span><span>存活 <b>${Math.min(run.turn+1,MAX_TURNS)} 回合</b></span><span>月薪 <b>${run.pay}K</b></span></div>${renderEndingReport(run)}${shareholderHoldingHTMLV58()}</div>${recentAchievementHTML()}${leaderboardUI.endingHTML(run)}<div class="ending-actions"><button class="primary" data-action="new">重新應徵 <span>↻</span></button><button class="secondary" data-action="home">回到首頁 <span>⌂</span></button><button class="secondary" data-action="collection">翻開命運圖鑑 <span>↗</span></button><button class="text-button" data-action="download">下載人生紀錄 ↓</button></div><button class="text-button ending-achievements-link" data-action="achievements">翻開成就簿 · ${activeAchievementCount()} / ${ACHIEVEMENTS.length} ↗</button><button class="text-button ending-characters-link" data-action="characters">看看這局遇見的角色 ↗</button><p class="ending-note">每一種離開，都不必等到最後。你的下一次人生，還有 ${ENDINGS.length-unlocked.length} 個問號。</p><details class="review-run"><summary>回看這次人生的背鍋紀錄</summary>${journalHTML()}</details></section>`,'ending');leaderboardUI.mountEnding(main);}
function openDialog(html){if(patronagePickerContext&&!html.includes('data-patronage-target-picker'))patronagePickerContext=null;if(ragePickerContext&&!html.includes('data-rage-target-picker'))ragePickerContext=null;$('#dialog-content').innerHTML=html;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;}
function collection(){collectionFilter={role:'all',status:'all',query:'',limit:24};openDialog(`<h2 id="dialog-title">還沒遇見的，都先保密。</h2><p class="dialog-lead">${unlocked.length} / ${ENDINGS.length} 個問號已有答案。剩下的，留給下一次選擇。</p><div class="collection-controls"><label for="filter-role">應徵職業<select id="filter-role"><option value="all">全部職業</option>${ROLES.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></label><label for="filter-status">收藏狀態<select id="filter-status"><option value="all">全部</option><option value="unlocked">已收藏</option><option value="locked">未解鎖</option></select></label><label for="filter-query">搜尋已收藏的故事<input id="filter-query" type="search" placeholder="只搜尋你已解鎖的結局"></label></div><p id="collection-summary" class="collection-summary"></p><div class="collection-grid" id="ending-grid"></div><button class="load-more secondary" data-action="more-endings">再翻一頁 ↓</button>${legacy.length?`<details class="review-run"><summary>第一版收藏（${legacy.length}）</summary><div class="collection-grid">${LEGACY_ENDINGS.filter(e=>legacy.includes(e.id)).map(e=>`<article class="ending-card unlocked"><span class="number">FIRST EDITION</span><h3>${esc(e.title)}</h3><p>${esc(e.body)}</p></article>`).join('')}</div></details>`:''}`);renderCollection();}
function renderCollection(){const f=collectionFilter,list=ENDINGS.filter(e=>(f.role==='all'||e.roleId===f.role)&&(f.status==='all'||(f.status==='unlocked')===unlocked.includes(e.id))&&(!f.query||(unlocked.includes(e.id)&&uiText([shownEnding(e).title,shownEnding(e).body,shownEnding(e).subtitle].join(' ')).toLowerCase().includes(uiText(f.query).toLowerCase()))));$('#collection-summary').textContent=`${list.length} 張卡片 · 顯示 ${Math.min(f.limit,list.length)} 張`;$('#ending-grid').innerHTML=list.slice(0,f.limit).map(e=>{const yes=unlocked.includes(e.id),currentProof=yes&&run?.completed&&run.endingId===e.id;if(currentProof&&typeof chapterDepartureCopyV38==='function')e=chapterDepartureCopyV38(run,e);if(yes)e=shownEnding(e);return yes?`<article class="ending-card unlocked">${endingArtHTML(e,{unlocked:true,compact:true})}<div class="card-top"><span class="number">${String(ENDINGS.findIndex(item=>item.id===e.id)+1).padStart(3,'0')} / ${esc(ROLE_MAP[e.roleId].name)}</span><span>✓</span></div><h3>${esc(e.title)}</h3>${!currentProof?'<p class="collection-provenance">篇章收藏 · 不另推定離職方式</p>':''}<p>${esc(e.body)}</p></article>`:`<article class="ending-card locked" aria-label="未解鎖結局"><span class="unknown-number">${String(ENDINGS.findIndex(item=>item.id===e.id)+1).padStart(3,'0')}</span><span class="question-mark" aria-hidden="true">?</span><p>未完待續</p></article>`;}).join('')||'<p class="empty-state">已收藏的故事裡找不到這個關鍵字。</p>';$('.load-more').hidden=f.limit>=list.length;}
function journalHTML(){if(!run?.history.length)return'<p class="dialog-lead">還沒開始背鍋，這裡暫時空白。</p>';return`<ol class="journal-list">${run.history.map((h,i)=>{const shown=shownHistory(h);return`<li><span class="eyebrow">${pad(i+1)} / DAY ${h.turn+1}</span><h3>${esc(shown.title)}</h3>${realityHTML(h,true)}<p class="journal-choice">${esc(shown.choiceText)}</p><p>${esc(displayHistoryResult(h))}</p>${h.weather?`<p class="weather-note">☁ ${esc(h.weather.text)}</p>`:''}${outcomeHTML(h,true)}<small>${esc(shown.jobTitle)} · 月薪 ${h.pay}K</small></li>`;}).join('')}</ol>`;}
function about(){openDialog(`<h2 id="dialog-title">報到前，先看這幾件事。</h2><p class="dialog-lead">先選職缺，再骰履歷。工作、偷懶、舔功各有用途；有些事看能力，有些事真的要看運氣。</p><div class="rule-grid"><div><span>01</span><h3>先選擇，再揭曉</h3><p>相似的選擇也可能遇到不同結果。選完才會顯示實際數值增減與這次的運氣。</p></div><div><span>02</span><h3>上班會消耗心情</h3><p>心情與體力會隨上班消耗。體力降到警告範圍，事情告一段落後就有休息空檔，可以花存款恢復狀態。</p></div><div><span>03</span><h3>隨時可以離開</h3><p>工作證上有離職按鈕。想走的時候，就有離開的路線。</p></div><div><span>04</span><h3>問號留給自己解開</h3><p>最多24個工作回合。每一步自動存檔，解鎖的故事收進命運圖鑑，特別的瞬間留在成就簿。</p></div></div><p class="dialog-lead">學歷、薪水與人物偏見均是虛構遊戲設定；不同學校與科系不代表能力高低。老闆的偏見，是他的問題。</p>`);}
function statGuide(){
 const newRules=!run||/^e(?:18|19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed);
 const wingGuide=newRules?'只代表翅膀本人的心情，影響人事、協商與升遷。同事之間的衝突主要算同事情義與故事後續；消息真的傳到他那裡，才會有限度地影響這一格。腦內幻想不會改變他的心情，每天的隨機脾氣則另外計算。':'影響人事危機、協商與升遷，也會受當天隨機脾氣影響。PIP 不會自動讓他開心。';
 const latestRules=!run||/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed);
 const castGuide=!run||/^e(?:35|36|37|38|39)-/.test(run.seed)?'會兼顧目前職業與這局還沒碰過的人物，避免同一張臉接連出現。':'';
 const mealGuide=!run||/^e(?:36|37|38|39)-/.test(run.seed)?'<div><span>☕ / 飯局</span><h3>約得到，也要聊得來</h3><p>邀約會看這局的交情與部門，高層、外部顧問或不熟的人比較難約；被拒絕不收費，也能自己吃便當。坐下後，同一句玩笑會因對象、熟悉程度與聊天內容，抽到聊開、平常吃飯或踩雷的反應；熟人也可能誤會。正式選完才顯示結果與實際好感增減。好感與同事情義分開計算；邀約本身不加減，取消也不抽餐桌反應。</p></div>':/^e(?:34|35)-/.test(run.seed)?'<div><span>☕ / 飯局</span><h3>約得到，也要聊得來</h3><p>邀約會看這局的交情與部門，高層、外部顧問或不熟的人比較難約；被拒絕不收費，也能自己吃便當。正式用餐的回覆會影響對方好感，有些回覆會降低；結果揭曉後才更新，邀約本身不加減。</p></div>':'';
 const moodGuide=latestRules?'心情歸零會當場失控；反覆歸零會越來越難休整，先留時間和存款照顧自己。崩潰時可選擇公開宣洩，把壓著的話說出來，再處理後續。':newRules?'工作、突發狀況與休息都會讓心情明顯起伏。PIP、疲勞與降薪會加重壓力；歸零後會真的失控，不能再靠下一次對話假裝沒事。趁還能安排時，替自己留點休息。':'每次工作會消耗，低落時出現情緒危機。PIP、低體力與砍薪後的壓力會讓上班更難熬。';
 const wealthGuide=!run||/^e(?:27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?' 新人生存款達 75、完成 6 次工作後，可從離職選單規劃創業；存款達 90、完成 10 次工作後，還能考慮退休。選定方向後才揭曉後續，也可以先繼續上班。':'';
 const cashGuide=latestRules?'0～100 的遊戲資源點數，並非新臺幣。可以買飲料、補眠、上課、備份紀錄、約不同角色吃飯、安排週末或租練團室放空。選人時先看餐費，正式坐下才付錢。耗盡會離場；月薪決定定期入帳多少。':newRules?'0～100 的遊戲資源點數，並非新臺幣。可以買飲料、補眠、上課、備份紀錄、找人脈、安排週末或租練團室放空。耗盡會離場；月薪決定定期入帳多少。':'0～100 的遊戲資源點數，並非新臺幣。可以花來紓壓，耗盡也會離場；月薪決定定期入帳多少。';
 openDialog(`<h2 id="dialog-title">能力有什麼用？哪些事看運氣？</h2><p class="dialog-lead">選擇前不揭曉數值與判定。選擇後可看實際增減、運氣結果與變化明細；背鍋紀錄也會保留。</p><div class="guide-table"><table><caption>每個數值都有用途</caption><thead><tr><th scope="col">數值</th><th scope="col">會影響什麼</th></tr></thead><tbody><tr><th scope="row">翅膀心情</th><td>${wingGuide}</td></tr><tr><th scope="row">自己心情</th><td>${moodGuide}</td></tr><tr><th scope="row">體力</th><td>做事與救火的本錢，也會受當天狀況影響。耗盡會結束這段人生，能不能保留力氣也關係到後期能走多遠。${(!run||usesEnergySafety())?' 新人生從正常體力降進警告、還沒等到能休息的空檔時，會保留最後 1 點體力撐完這段流程；已有休息機會卻繼續硬撐，仍可能耗盡。':''}</td></tr><tr><th scope="row">存款</th><td>${cashGuide}${wealthGuide}</td></tr><tr><th scope="row">同事情義</th><td>與同事合作、互助會累積，部分後期路線需要這份交情。</td></tr><tr><th scope="row">大餅信仰</th><td>你對公司願景還抱著多少期待，會影響部分後期路線。</td></tr><tr><th scope="row">工作能力</th><td>影響協商、PIP 答辯、升遷及做事遇到好結果的機會；管理職還會看帶人與合作的累積，能力高也不保證成功。</td></tr><tr><th scope="row">偷懶能力</th><td>提高省電時遇到好運的機會，降低一般工作事件的倒楣機會，並影響職涯選擇。</td></tr><tr><th scope="row">舔老闆能力</th><td>影響討好型協商、升遷與相關選擇的成功機會，也影響職涯選擇。</td></tr></tbody></table></div>${newRules?'<div class="ability-budget-note"><span aria-hidden="true">⚖</span><div><h3>三頭馬車，總得放掉一條韁繩。</h3><p>工作、偷懶、舔功的總和最多 180。一次選擇若練高其中一項，另外兩項就會退步；花錢上課也一樣，要決定這段時間把心力放在哪裡。變化會在選完後列清楚，不能三項一起練滿。</p></div></div>':''}<div class="rule-grid"><div><span>⚄ / 入職</span><h3>每一局，重新發牌</h3><p>能力、學歷、科系和薪水都用骰的。職務也可能被改派，高階主管則直接迎接原職挑戰。</p></div><div><span>⚄ / 工作</span><h3>同樣的選擇，也有變數</h3><p>日常事件會抽取；${castGuide}選擇後會判定幸運、平常或不順，並抽出翅膀當天的脾氣。${newRules?'心情與體力也可能遇到特別累或意外順風的一天。':''}部分事件另有劇情抽籤，結果會在事後顯示。</p></div><div><span>⚄ / 人事</span><h3>能力影響機會</h3><p>協商、PIP 答辯及升遷會判定成敗；學歷閒聊、砍薪時機與幅度也會隨機變動。${!run||/^e(?:20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'不是每次人事衝突都有 PIP；若通知已經到眼前，先從當下的選項回應。':''}</p></div><div><span>${newRules?'$ / 存款':'☕ / 紓壓'}</span><h3>薪水也可以花在自己身上</h3><p>${newRules?`${(!run||usesLifeBalance())?'心情或體力降到警告範圍（30 以下），事情告一段落後就會出現「工作空檔」。可從「存款怎麼花」安排一次消費或休息；看完結果，仍回到同一段空檔，準備好再繼續上班。':usesEnergyRest()?'體力降到警告範圍（30 以下），事情告一段落後才會出現「工作空檔」。可從「存款怎麼花」安排一次消費或休息；看完結果，仍回到同一段空檔，準備好再繼續上班。':usesWorkGap()?'事情告一段落後，才能在「工作空檔」從「存款怎麼花」安排一次消費或休息；看完休息結果，會回到同一段空檔。':'一般工作事件中，每回合可從「存款怎麼花」安排一次消費或休息。'}補眠救體力，課程練工作，紀錄和人脈則替下一步留條路；買得起才會出現選項，花完記得留生活費。`:'一般工作事件中，每回合可花錢喘口氣一次。餐點、朋友與休息的療癒效果也有高低。'}阿良也可能在上班途中突然過來揪團，跟不跟由你決定。</p></div>${mealGuide}${!run||/^e(?:19|20|21|22|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)?'<div><span>$ / 談薪</span><h3>薪水，想另外談一次。</h3><p>完成三個工作回合後，可以在工作證按「我要談加薪」。談薪不花工作回合，也不占升遷評核；正式談過後，要再上五個工作回合才能重談，每局最多三次。正式開口前取消不算，PIP 或人事通知還沒處理完時，先把眼前的事走完。能不能談，按鈕會說明。</p></div>':''}</div><p class="small-note">在一般選項下方按「受不了了，扁他」。單人對話直接回應眼前跟你說話的人；多人同場會先讓你選一位，取消不算出手。心情、對象和時機都會影響後續，確認對象後才揭曉發生了什麼事。新版另有「惡言相向」，會真的對眼前的人開口；多人同場可先選人，沒人在場就罵空氣。一次工作回合只能開嗆一次，後果選完才揭曉，與動手分開記錄。尾牙也會在上班途中隨機登場。新版人生的口角還能走到專屬收尾；公司幻想線也會分出交易與掛牌的不同結果。舊局保留原規則，可開新人生體驗。</p>${run&&!newRules?'<p class="small-note">你目前這局沿用原規則，以保留進度。能力消長、心情歸零失控與新增存款用途，請從新人生體驗。</p>':''}`);
}
function sources(){openDialog(`<h2 id="dialog-title">這些故事，從哪裡來？</h2><p class="dialog-lead">本作是非官方職場諷刺遊戲。參考私人史冊的敘事與公開產品資料；角色台詞、因果、薪資與結局皆為創作，不是企業現況報告。</p><div class="sources-list">${Object.values(SOURCES).map((s,i)=>`<article class="source-item"><span class="number">${pad(i+1)}</span><div><h3>${s.url?`<a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`:esc(s.title)}</h3><p>${esc(s.summary||'私人史冊虛構敘事改編。')}</p></div></article>`).join('')}</div><p class="source-disclaimer">互動節奏參考 <a href="https://otherlife.icareu.tw/" target="_blank" rel="noopener noreferrer">地球轉生所</a> 與 <a href="https://1in8b.life/zh/" target="_blank" rel="noopener noreferrer">八十億分之一</a>；視覺色彩參考 <a href="https://www.avividai.com/" target="_blank" rel="noopener noreferrer">AviviD 官網</a>。未使用官方標誌或暗示官方製作。</p>`);}
function feedback(){feedbackUI.open();}
function privacy(){const state=cloud.state;openDialog(`<h2 id="dialog-title">你的收藏怎麼保存？</h2><p class="dialog-lead">不用註冊。這個瀏覽器會產生隨機匿名識別碼，讓你保留自己的結局與成就收藏。</p><div class="privacy-card"><h3>${state.playerId?`匿名玩家 ${esc(state.playerId.slice(0,8))}`:'本機收藏模式'}</h3><p>目前：${state.status==='online'?'已連接人生觀測站':state.status==='pending'?'等待同步':'收藏仍保存在這個瀏覽器'}</p>${state.lastError?`<p class="sync-notice">${esc(state.lastError)}</p>`:''}<p>遊戲紀錄保存匿名玩家、已驗證結局、遊戲職業、回合數、遊戲薪資與完成時間。另保存職級制度、離場職級、特殊任用，以及 PIP、升遷、月薪降低與崩潰的次數，供匿名統計；不保存本局角色性別。成就不必等到結局就能同步，另存成就編號與首次解鎖時間。驗證時暫時重播遊戲紀錄，並以種子的雜湊綁定本局編號；伺服器不保存原始選擇、種子或劇情。不要求姓名、Email、真實學歷，也不保存原始 IP。</p><p>只有你主動參與「史冊補完計畫」時，才會把填寫的文字送到私人投稿佇列，並建立公開的 GitHub Issue。佇列保存匿名玩家 ID、投稿編號、原文與處理狀態；成功開單後立即刪除站內原文，未成功的原文最多保留 30 天。公開 Issue 不含匿名玩家 ID 或遊戲紀錄。</p><p>投稿防濫用另保存短期連線雜湊，3 天內清理；不保存原始 IP。GitHub 上已公開的投稿仍會保留。</p><p>排行榜另採自願留名：只有在結算畫面勾選同意並送出，才會公開暱稱、應徵與實際職業、分數及完成工作回合。排行不公開結局名稱、劇情、選擇內容或匿名玩家 ID。留名紀錄保存經伺服器驗證的計分版本、單項數值與本局編號，以便排名、改名或撤下；不另存原始劇情與操作。你可在排行榜的「我公開過的名字」改名或撤下，撤下不影響匿名統計與本機收藏。</p><p>人生觀測站只顯示統計總數。清除瀏覽器資料後，無法靠姓名找回這個匿名身分；不同裝置會是不同玩家；也可能無法改名或撤下先前的公開留名。</p><div class="privacy-actions"><button class="secondary" data-action="sync">重新連線 ↻</button><button class="text-button" data-action="export-collection">匯出圖鑑 ↓</button><label class="text-button import-label">匯入圖鑑 ↑<input id="import-collection" type="file" accept="application/json,.json" hidden></label></div><p>匯出檔案包含故事與成就收藏，不含匿名登入憑證。跨網址或裝置可用匯出／匯入帶走收藏；匯入只加入本機，不增加全站統計，也不會自動標成已驗證。</p></div>`);}
function observatoryCount(value){return Number.isSafeInteger(value)&&value>=0?value:null;}
function observatoryModel(data){const value=data?.observatory;return value&&typeof value==='object'&&!Array.isArray(value)&&value.version===1&&observatoryCount(value.recordedRuns)!==null&&observatoryCount(value.unclassifiedRuns)!==null?value:null;}
function observatoryRows(value,definitions,key='id',limit=null,partition=true){
 if(!Array.isArray(value)||value.length!==definitions.length)return null;
 const rows=new Map();for(const row of value){if(!row||typeof row!=='object'||rows.has(row[key])||observatoryCount(row.count)===null||(limit!==null&&row.count>limit))return null;rows.set(row[key],row.count);}
 const result=definitions.map(row=>({...row,count:rows.get(row[key])}));
 if(result.some(row=>row.count===undefined)||(partition&&limit!==null&&result.reduce((sum,row)=>sum+row.count,0)>limit))return null;
 return result;
}
function observatoryRoleRows(value,total){
 if(!Array.isArray(value))return null;
 const definitions=ROLES.map(role=>({id:role.id,label:role.name})),ids=new Set(definitions.map(row=>row.id)),counts=new Map();
 for(const row of value){if(!row||!ids.has(row.id)||counts.has(row.id)||observatoryCount(row.count)===null)return null;counts.set(row.id,row.count);}
 return observatoryRows(definitions.map(row=>({id:row.id,count:counts.get(row.id)??0})),definitions,'id',total);
}
function observatoryPercent(count,total){return total>0?`${(count/total*100).toFixed(1)}%`:'—';}
function observatoryBars(rows,label,compact=false){
 if(!rows)return '<p class="observatory-no-data">這項分類資料尚未提供，暫不繪圖。</p>';
 const max=Math.max(1,...rows.map(row=>row.count));
 return `<div class="bar-chart${compact?' observatory-compact-bars':''}" role="img" aria-label="${esc(`${label}。${rows.map(row=>`${row.label}：${row.count}局`).join('，')}`)}">${rows.map(row=>`<div class="bar-row"><span>${esc(row.label)}</span><div><i style="width:${(row.count/max*100).toFixed(1)}%"></i></div><b>${row.count}</b></div>`).join('')}</div>`;
}
function observatoryPanel(title,rows,subtitle,note='',extraClass=''){
 return `<section class="chart-panel observatory-panel ${extraClass}"><div class="chart-heading"><h3>${esc(title)}</h3><span>${esc(subtitle)}</span></div>${observatoryBars(rows,title)}${note?`<p class="small-note">${esc(note)}</p>`:''}</section>`;
}
function departureStatsHTML(data){
 const total=observatoryCount(data?.totalRuns),model=observatoryModel(data);
 const definitions=[{id:'voluntary',label:'自行離職'},{id:'forced_signed',label:'被要求簽自願離職'},{id:'company_exit',label:'資遣／被要求離場'},{id:'pip_failed',label:'PIP 未通過離場'},{id:'pip_passed_exit',label:'PIP 通過後自行離職'},{id:'cold_storage',label:'冷凍調職後離場'},{id:'labor_dispute',label:'勞資爭議後離場'},{id:'burnout',label:'身心耗盡'},{id:'cash_exhausted',label:'存款耗盡'},{id:'startup',label:'離職創業'},{id:'retirement',label:'退休／彈性接案'},{id:'other',label:'未明確離職／其他收尾'},{id:'unclassified',label:'待分類'}];
 const candidate=total===null?null:observatoryRows(model?.departureWays,definitions,'id',total);
 const rows=candidate&&candidate.reduce((sum,row)=>sum+row.count,0)===total?candidate:null;
 const chart=rows?`<div class="observatory-departures" role="img" aria-label="${esc(`如何離職。${rows.map(row=>`${row.label}：${row.count}局，${observatoryPercent(row.count,total)}`).join('；')}`)}">${rows.map(row=>`<div class="observatory-departure-row"><div class="observatory-departure-heading"><span>${esc(row.label)}</span><b>${row.count}<small>局 · ${observatoryPercent(row.count,total)}</small></b></div><div class="observatory-departure-track" aria-hidden="true"><i style="width:${total?(row.count/total*100).toFixed(1):0}%"></i></div></div>`).join('')}</div>`:'<p class="observatory-no-data">離場方式分類尚未提供，暫不繪圖。</p>';
 return `<section class="chart-panel observatory-panel observatory-departure-panel"><div class="chart-heading"><h3>這份工作，怎麼結束的？</h3><span>如何離職 · 全站完成局數</span></div><p class="observatory-chart-intro">自己決定走，還是被請出去？看看大家最後怎麼收尾。完成一局不一定已經離職，仍在職或未明確離職的收尾會另外列出。</p>${total===0?'<p class="observatory-no-data">還沒有完成紀錄，暫不計算離場比例。</p>':''}${chart}<p class="small-note">依遊戲收尾路線分類，每局只計一次，比例以全站完成局數計算。被要求簽自願離職另列，不算自行離職；資遣／被要求離場可能曾走過 PIP。無法辨識的舊紀錄保留為待分類，不公開結局名稱。</p></section>`;
}
function careerStatsHTML(data){
 const model=observatoryModel(data);
 if(!model)return '<section class="chart-panel observatory-panel"><div class="chart-heading"><h3>離場時職級</h3><span>等待新版分類資料</span></div><p class="observatory-no-data">目前只有舊版結局彙總，無法分辨每局的八階、舊五階或特別任用。這裡先留白，不由結局路線猜職級。</p></section>';
 const full=observatoryRows(model.career?.full8,CAREER_LEVELS_V17.map((level,rank)=>({rank,label:level.label})),'rank',model.recordedRuns);
 const old=observatoryRows(model.career?.legacy5,[{rank:0,label:'基層／待轉正'},{rank:1,label:'副理'},{rank:2,label:'經理'},{rank:3,label:'總監'},{rank:4,label:'高層'}],'rank',model.recordedRuns);
 const special=observatoryRows(model.career?.special,[{id:'son',label:'乾兒子'},{id:'daughter',label:'乾女兒'}],'id',model.recordedRuns);
 const oldTotal=old?.reduce((sum,row)=>sum+row.count,0),specialHTML=special?`<div class="observatory-special-grid">${special.map(row=>`<div><span>${esc(row.label)}</span><b>${row.count}<small>局</small></b></div>`).join('')}</div>`:'<p class="observatory-no-data">特別任用分類尚未提供。</p>';
 return `<section class="chart-panel observatory-panel observatory-career"><div class="chart-heading"><h3>離場時職級</h3><span>八階職涯 · 各種離場都計入</span></div><p class="observatory-chart-intro">這局最後停在哪一階？資遣、離職、失控與其他離場都會計入，不只職涯結算路線。</p>${observatoryBars(full,'八階職涯離場時職級')}<div class="observatory-special"><h4>特別任用，另外一條路</h4>${specialHTML}<p class="small-note">乾兒子／乾女兒獨立計數，不塞進一般八階；也不代表升上 C-level。</p></div><details class="observatory-details observatory-legacy"><summary><span>舊版五階職涯</span><b>${oldTotal===undefined?'資料待補':`${oldTotal}局`}</b></summary><p class="small-note">依舊制原職級顯示；基層與待轉正助理合列，不換算成現在的八階。</p>${observatoryBars(old,'舊版五階離場時職級')}</details><p class="small-note">${model.unclassifiedRuns}局早期紀錄未留完整職級，沒有混入以上分類。</p></section>`;
}
function observatoryHTML(data){
 const model=observatoryModel(data);if(!model)return `<div class="observatory-scope"><b>新的分類圖表，還在等資料。</b><p>全站累計照常顯示；離場職級、實際職務與經歷分類尚未提供，不能把缺少資料當成零次。</p></div>${departureStatsHTML(data)}${careerStatsHTML(data)}`;
 const total=observatoryCount(data.totalRuns),scope=typeof model.trackingSince==='string'&&Number.isFinite(Date.parse(model.trackingSince))?`${new Date(model.trackingSince).toISOString().slice(0,10)}（UTC）`:'日期待確認';
 const scopeText=model.recordedRuns===0&&model.trackingSince===null?'尚無新的分類完成紀錄，新完成的人生會開始累積。':`職級與經歷分類自 ${scope}起採集，目前記下 ${model.recordedRuns}局。`;
 const actual=observatoryRoleRows(model.actualRoles,total);
 const types=observatoryRows(model.endingTypes,[{id:'good',label:'好結局'},{id:'normal',label:'一般結局'},{id:'bad',label:'壞結局'},{id:'secret',label:'隱藏類型'}],'id',total);
 const tenure=observatoryRows(model.tenure,[{id:'1-3',label:'1–3 回合'},{id:'4-7',label:'4–7 回合'},{id:'8-12',label:'8–12 回合'},{id:'13-19',label:'13–19 回合'},{id:'20-24',label:'20–24 回合'}],'id',total);
 const salary=observatoryRows(model.salary?.bands,[{id:'under30',label:'未滿30K'},{id:'30-49',label:'30–49K'},{id:'50-79',label:'50–79K'},{id:'80-119',label:'80–119K'},{id:'120plus',label:'120K 以上'}],'id',total);
 const payAverage=total>0&&Number.isFinite(model.salary?.average)&&model.salary.average>=0?`${model.salary.average.toFixed(1)}K`:'—';
 const reassigned=observatoryCount(model.reassignments),reassignKnown=total!==null&&reassigned!==null&&reassigned<=total;
 const experienceDefs=[{id:'pip',label:'進入 PIP'},{id:'promoted',label:'曾經升遷'},{id:'payCut',label:'月薪降低'},{id:'collapse',label:'心情崩潰'},{id:'appointed',label:'特別任用'}];
 const experiences=observatoryRows(experienceDefs.map(row=>({id:row.id,count:model.experiences?.[row.id]})),experienceDefs,'id',model.recordedRuns,false);
 const experienceHTML=experiences?`<div class="observatory-experiences">${experiences.map(row=>`<div><span>${esc(row.label)}</span><b>${observatoryPercent(row.count,model.recordedRuns)}</b><p>${row.count} / ${model.recordedRuns}局</p><div class="observatory-rate-track" aria-hidden="true"><i style="width:${model.recordedRuns?(row.count/model.recordedRuns*100).toFixed(1):0}%"></i></div></div>`).join('')}</div>`:'<p class="observatory-no-data">經歷分類資料尚未提供，暫不計算發生率。</p>';
 return `<div class="observatory-scope"><b>先看清楚，這些圖記了哪些人生。</b><p>${esc(scopeText)} ${model.unclassifiedRuns}局早期紀錄尚未分類。離場方式、實際職務、結局類型、任期與月薪圖涵蓋全站已完成局數。缺少的分類會留白，不補成零。</p></div>${departureStatsHTML(data)}${careerStatsHTML(data)}<section class="chart-panel observatory-panel observatory-roles"><div class="chart-heading"><h3>實際做了什麼工作？</h3><span>離場時實際職務 · 全站完成局數</span></div><div class="observatory-inline-metric"><span>應徵與實際職務不同</span><b>${reassignKnown?reassigned:'—'}<small>局 · ${reassignKnown?observatoryPercent(reassigned,total):'資料待補'}</small></b></div>${observatoryBars(actual,'離場時實際職務',true)}<p class="small-note">職務依離場紀錄分類；特別任用仍保留原專業，乾兒子／乾女兒另外列在職級圖。</p></section><div class="observatory-chart-grid">${observatoryPanel('這些人生，怎麼收尾？',types,'只看大類 · 全站完成局數','只顯示好／一般／壞／隱藏類型，不公開任何結局名稱。')}${observatoryPanel('上班多久才離開？',tenure,'工作回合 · 全站完成局數','休息、飯局和人事對話不另算工作回合。')}${observatoryPanel('離場時，月薪在哪個區間？',salary,`全站完成局數 · 平均 ${payAverage}`,'薪資為虛構遊戲數值，並非真實員工薪資；沒有樣本時不計平均。','observatory-salary')}</div><section class="chart-panel observatory-panel"><div class="chart-heading"><h3>上班期間，遇過哪些事？</h3><span>各項可以重疊 · 同局只計一次</span></div>${experienceHTML}<p class="small-note">每項比例的分母都是已採集完整分類的 ${model.recordedRuns}局，早期未分類紀錄不在分母裡。月薪降低包含降薪、無薪假或卸任等實際減薪。這是玩家遊玩結果，不是公司事件發生率。</p></section>`;
}
async function statistics(){
 openDialog('<h2 id="dialog-title">人生觀測站。</h2><p class="dialog-lead">看看大家怎麼入職、做到哪一階，最後又怎麼離開。結局名稱依然保密。</p><div id="stats-content" class="observatory" aria-live="polite"><p class="empty-state">正在整理大家的人生…</p></div>');
 try{
  const data=await cloud.stats();if(!$('#stats-content'))return;
  const count=key=>observatoryCount(data?.[key]),total=count('totalRuns'),roles=observatoryRoleRows(data?.roles,total);
  const days=(Array.isArray(data?.daily)?data.daily:[]).filter(row=>row&&typeof row.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(row.date)&&observatoryCount(row.count)!==null).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14),dayMax=Math.max(1,...days.map(row=>row.count));
  const average=Number.isFinite(data?.averageTurns)&&data.averageTurns>=0?data.averageTurns.toFixed(1):'—',model=observatoryModel(data),jobChart=observatoryPanel('大家從什麼職缺出發？',roles,'應徵職業 · 全站完成局數');
  $('#stats-content').innerHTML=`<div class="stat-tiles"><div><b>${count('players')??'—'}</b><span>匿名玩家</span></div><div><b>${total??'—'}</b><span>已完成的人生</span></div><div><b>${count('uniqueEndings')??'—'}<small> / ${ENDINGS.length}</small></b><span>大家遇見的結局</span></div><div><b>${total===0?'—':average}</b><span>平均任職回合</span></div></div>${total===0?'<p class="empty-state">還沒有人完成這段人生。第一份離場證明，等你寫下。</p>':''}${observatoryHTML(data)}${model?`<details class="observatory-details observatory-starting-roles"><summary><span>大家原本應徵什麼？</span><b>展開職缺分布</b></summary>${jobChart}</details>`:jobChart}<section class="chart-panel observatory-panel"><div class="chart-heading"><h3>最近的人生動態</h3><span>每日完成局數 · UTC</span></div>${days.length?`<div class="daily-chart" role="img" aria-label="${esc(days.map(row=>`${row.date}：${row.count}局`).join('，'))}">${days.map(row=>`<div title="${esc(row.date)}：${row.count}局"><b>${row.count}</b><span style="height:${Math.max(3,row.count/dayMax*110).toFixed(1)}px"></span><small>${esc(row.date.slice(5))}</small></div>`).join('')}</div>`:'<p class="empty-state">還沒有每日遊玩紀錄。</p>'}</section><p class="small-note">匿名玩家數不等於真實人數。所有圖表都是遊戲紀錄，不是員工或企業現況調查；未解鎖結局在這裡也保密。</p>`;
 }catch{if($('#stats-content'))$('#stats-content').innerHTML='<div class="empty-state"><h3>觀測站暫時休息。</h3><p>遊戲和本機圖鑑照常運作；連線恢復後會再同步。</p><button class="secondary" data-action="stats">重新整理 ↻</button></div>';}
}
let cardDownloading=false;
async function downloadCard(){
 if(cardDownloading||!run?.completed)return;
 const cardRun=structuredClone(run),e=endingTextForRun(ENDINGS.find(e=>e.id===cardRun.endingId));
 if(!e)return;
 cardDownloading=true;
 try{
  const art=typeof embedEndingIllustration==='function'?await embedEndingIllustration(e,{unlocked:true}):'';
  const imageOffset=art?460:0,lines=[],body=Array.from(uiText(e.body));
  while(body.length)lines.push(body.splice(0,23).join(''));
  const statBase=Math.max(810+imageOffset,320+imageOffset+lines.length*35+70),height=statBase+350;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}"><rect width="900" height="${height}" fill="#fff7fa"/><circle cx="820" cy="80" r="180" fill="#fbdce8"/><rect x="35" y="35" width="830" height="${height-70}" rx="28" fill="none" stroke="#e6256e" stroke-width="2"/>${art?`<image href="${art}" x="80" y="282" width="740" height="416" preserveAspectRatio="xMidYMid slice"/>`:''}<g fill="#14192d" font-family="sans-serif"><text x="80" y="110" font-size="20" letter-spacing="3">THE MOVING LIFE / 移動人生</text><text x="80" y="170" font-size="18" fill="#e6256e">${esc(types[e.type])}</text><text x="80" y="250" font-size="48" font-weight="700">${esc(e.title)}</text>${lines.map((l,i)=>`<text x="80" y="${330+imageOffset+i*35}" font-size="25">${esc(l)}</text>`).join('')}<text x="80" y="${statBase-35}" font-size="18">應徵 ${esc(ROLE_MAP[cardRun.roleId].name)} → 實際 ${esc(shownJobTitle(cardRun))}</text><line x1="80" y1="${statBase}" x2="820" y2="${statBase}" stroke="#e9bed0"/>${Object.entries(STAT_LABELS).map(([k,v],i)=>`<text x="${85+(i%3)*250}" y="${statBase+48+Math.floor(i/3)*55}" font-size="21">${v}　${cardRun.stats[k]}</text>`).join('')}<text x="80" y="${height-105}" font-size="18">第${Math.min(cardRun.turn+1,MAX_TURNS)}回合收尾 · 月薪${cardRun.pay}K</text><text x="80" y="${height-65}" font-size="13">非官方職場諷刺遊戲 · 人物對白與結局為虛構改編</text></g></svg>`;
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=`移動人生-${uiText(e.title)}.svg`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);toast('人生紀錄已下載。這份不用任何人簽名。');
 }finally{cardDownloading=false;}
}

async function toggleSound(){try{if(!audioContext){audioContext=new(window.AudioContext||window.webkitAudioContext)();audioGain=audioContext.createGain();audioGain.gain.value=0;audioGain.connect(audioContext.destination);[130.81,196,261.63,329.63].forEach((freq,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=freq;g.gain.value=.12/(i+1);o.connect(g);g.connect(audioGain);o.start();});}await audioContext.resume();soundOn=!soundOn;audioGain.gain.setTargetAtTime(soundOn?.055:0,audioContext.currentTime,.3);$('.sound-button').setAttribute('aria-pressed',soundOn);$('.sound-button').setAttribute('aria-label',soundOn?'關閉背景音效':'開啟背景音效');$('#sound-label').textContent=soundOn?'聲音開':'聲音關';}catch{toast('目前無法播放音效。');}}
const mealNavigationChoices=new WeakSet();
function choose(index,revision=gameViewRevision){
 if(screen!=='game'||run.pending||dialog.open||Number(revision)!==gameViewRevision)return false;
 if(typeof getShareholderPlayV58==='function'&&getShareholderPlayV58(run))return false;
 if(typeof getActivityPlayV55==='function'&&getActivityPlayV55(run))return false;
 const c=getEvent(run).choices[index];if(!c||c.available===false)return false;
 const leavingGap=usesWorkGap()&&c.effect==='workGapStart';
 const navigation=/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)&&(['mealOpen','mealPage','mealCancel'].includes(c.effect)||c.effect==='mealPick'&&!/^e(?:34|35|36|37|38|39)-/.test(run.seed));
 run=applyChoice(run,index);if(navigation&&!run.pendingFamily)run=advance(run);
 if(leavingGap){catchUpStartingSalaryAdvice();catchUpActivityInvitation();catchUpHiddenEncounter();}
 collectAchievements();syncCharacterProof();save();game();return true;
}
function catchUpActivityInvitation(){
 let changed=false;
 if(typeof enableActivitySchedule==='function'){const enabled=enableActivitySchedule(run);if(enabled!==run){run=enabled;changed=true;}}
 if(typeof canRequestActivityInvitation!=='function'||typeof requestActivityInvitation!=='function'||!canRequestActivityInvitation(run))return changed;
 const nextRun=requestActivityInvitation(run);if(nextRun===run)return changed;run=nextRun;return true;
}
function catchUpHiddenEncounter(){
 if(typeof HIDDEN_PERSONAS_V45!=='object'||typeof requestHiddenEncounter!=='function')return false;
 const nextRun=requestHiddenEncounter(run);if(nextRun===run)return false;run=nextRun;return true;
}
function catchUpStartingSalaryAdvice(){const nextRun=requestSalaryAdvice(run);if(nextRun===run)return false;run=nextRun;return true;}
function next(){if(screen!=='game'||!run?.pending||run.completed)return;const wasTreat=!!run.treatsContext,wasDeparture=!!run.departureContext,wasBlockchain=!!run.blockchainContext;run=advance(run);if(!wasTreat&&!wasDeparture&&!wasBlockchain){catchUpStartingSalaryAdvice();catchUpActivityInvitation();catchUpHiddenEncounter();}if(run.completed&&typeof renderEndingTransition==='function')endingReviewKey=endingIdentity(run);finishRecord();game();}
function newLife(){if(run&&!run.completed)openDialog(`<h2 id="dialog-title">重新擲一段人生？</h2><p class="dialog-lead">目前在第 ${run.turn+1} 回合。開始新局會取代這局進度；已收藏的故事都會保留。</p><div class="ending-actions"><button class="primary" data-action="confirm-new">選新職缺 →</button><button class="text-button" data-action="close-dialog">先保留這一局</button></div>`);else{selectedRole='random';roleScreen();}}
function readFilter(){collectionFilter.role=$('#filter-role').value;collectionFilter.status=$('#filter-status').value;collectionFilter.query=$('#filter-query').value.trim();collectionFilter.limit=24;renderCollection();}
document.addEventListener('click',event=>{const page=event.target.closest('[data-achievement-page]'),group=event.target.closest('[data-achievement-group]');if(!page&&!group)return;if(page){const value=Number(page.dataset.achievementPage);if(!Number.isInteger(value)||value<0||page.disabled)return;achievementPageV66Index=value;}if(group){if(group.dataset.achievementGroup!=='all'&&!Object.hasOwn(ACHIEVEMENT_GROUPS,group.dataset.achievementGroup))return;achievementGroupV66=group.dataset.achievementGroup;achievementPageV66Index=0;}achievementBook();$('#dialog-title')?.focus({preventScroll:true});});
let searchTimer;document.addEventListener('input',event=>{if(event.target.id==='filter-query'){clearTimeout(searchTimer);searchTimer=setTimeout(readFilter,120);}});document.addEventListener('change',event=>{if(event.target.id?.startsWith('filter-'))readFilter();});
document.addEventListener('click',async event=>{const rb=event.target.closest('[data-role]');if(rb){selectedRole=rb.dataset.role;roleScreen(false);$(`[data-role="${selectedRole}"]`).focus({preventScroll:true});return;}const af=event.target.closest('[data-achievement-filter]');if(af){achievementFilter=af.dataset.achievementFilter;achievementPageV66Index=0;achievementBook();$(`[data-achievement-filter="${achievementFilter}"]`).focus({preventScroll:true});return;}const cb=event.target.closest('[data-choice]');if(cb){if(event.detail>1||mealNavigationChoices.has(cb))return;const navigation=screen==='game'&&run&&!run.pending&&!run.completed&&/^e(?:25|26|27|28|29|30|31|32|33|34|35|36|37|38|39)-/.test(run.seed)&&(['mealOpen','mealPage','mealCancel'].includes(getEvent(run).choices[Number(cb.dataset.choice)]?.effect)||getEvent(run).choices[Number(cb.dataset.choice)]?.effect==='mealPick'&&!/^e(?:34|35|36|37|38|39)-/.test(run.seed));if(choose(Number(cb.dataset.choice),cb.dataset.choiceView===undefined?gameViewRevision:Number(cb.dataset.choiceView))&&navigation)mealNavigationChoices.add(cb);return;}const action=event.target.closest('[data-action]')?.dataset.action;if(!action)return;
 if(action==='home')home();if(action==='new')newLife();if(action==='confirm-new'){dialog.close();selectedRole='random';roleScreen();}if(action==='roll')rollCandidate(true);if(action==='reroll'&&rerolls<3)rollCandidate();if(action==='back-roles')roleScreen();if(action==='start'&&candidate){run=structuredClone(candidate);run.runId=crypto.randomUUID();candidate=null;catchUpActivityInvitation();save();game();}if(action==='continue'){const advice=catchUpStartingSalaryAdvice(),activity=catchUpActivityInvitation(),hidden=catchUpHiddenEncounter();if(advice||activity||hidden)finishRecord();game();}if(action==='next')next();if(action==='event-departure'&&!(event.detail>1))leaveEventV63(Number(event.target.closest('[data-departure-view]')?.dataset.departureView));if(action==='ending-continue'&&screen==='ending-transition'&&run?.completed&&endingReviewKey===endingIdentity(run)){endingReviewKey=null;endingScreen();}if(action==='exit'){run=requestExit(run);save();game();}if(action==='collection')collection();if(action==='achievements')achievementBook();if(action==='characters')void characterBookUI.open(event.target.closest('[data-action]')?.dataset.characterId||'all');if(action==='patronage-reply')beginPatronageReply();if(action==='patronage-target'){confirmPatronageTarget(event.target.closest('[data-action]')?.dataset.patronageTarget);return;}if(action==='patronage-cancel'){cancelPatronagePicker();return;}if(action==='verbal')beginVerbal();if(action==='verbal-target'){confirmVerbalTarget(event.target.closest('[data-action]')?.dataset.verbalTarget);return;}if(action==='verbal-cancel'){cancelVerbalPicker();return;}if(action==='rage')beginRage();if(action==='rage-target'){confirmRageTarget(event.target.closest('[data-action]')?.dataset.rageTarget);return;}if(action==='rage-cancel'){cancelRagePicker();return;}if(action==='more-endings'){collectionFilter.limit+=24;renderCollection();}if(action==='admin-archive'&&screen==='home')void adminArchiveUI.open();if(action==='sources')sources();if(action==='about')about();if(action==='guide')statGuide();if(action==='career-guide')careerGuide();if(action==='story'){const chapter=$('.chapter');chapter.scrollIntoView({block:'start',behavior:'instant'});chapter.focus({preventScroll:true});}if(action==='work-card'){const card=$('.game-sidebar');card.scrollIntoView({block:'start',behavior:'instant'});card.focus({preventScroll:true});}if(action==='career'){const nextRun=requestCareer(run);if(nextRun!==run){run=nextRun;save();game();}}if(action==='raise'&&!dialog.open){const nextRun=requestRaise(run);if(nextRun!==run){run=nextRun;save();game();}}if(action==='break'){const nextRun=requestBreak(run);if(nextRun!==run){run=nextRun;save();game();}}if(action==='feedback')feedback();if(action==='privacy')privacy();if(action==='stats')void statistics();if(action==='leaderboard')void leaderboardUI.open();if(action==='sync'){await syncCloud();toast(cloud.state.status==='online'?'已連接觀測站。':'目前仍是本機模式，收藏都還在。');privacy();}if(action==='journal')openDialog(`<h2 id="dialog-title">這次上班，發生過什麼事。</h2><p class="dialog-lead">選過的回覆、發生的結果和數值變化，都記在這裡。</p>${journalHTML()}`);if(action==='close-dialog')dialog.close();if(action==='download')await downloadCard();if(action==='sound')toggleSound();if(action==='export-collection')exportCollection();});
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||dialog.open||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;if(screen==='game'&&!run.pending&&/^[1-9]$/.test(event.key)){const picked=visibleChoices()[Number(event.key)-1];if(picked){event.preventDefault();choose(picked.i);}}});
dialog.addEventListener('close',()=>{ragePickerContext=null;patronagePickerContext=null;});dialog.addEventListener('cancel',()=>{ragePickerContext=null;patronagePickerContext=null;});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
let lastSyncNotice='';cloud.subscribe(s=>{characterBookUI.onSnapshot(s);if(mergeVerifiedAchievements(s.achievements))save();$('#cloud-status').textContent=s.status==='online'?'● 匿名紀錄已連線':s.status==='connecting'?'連接觀測站…':s.status==='pending'?`○ ${s.pending} 筆待同步`:'○ 本機收藏模式';$('#cloud-status').title=s.lastError||'';if(s.lastError&&s.lastError!==lastSyncNotice){lastSyncNotice=s.lastError;toast(s.lastError);}});
async function syncCloud(){const data=await cloud.init();syncCharacterProof();if(mergeVerifiedAchievements(data?.achievements))save();if(run?.runId&&deriveAchievements(run).some(id=>achievements[id]?.source!=='verified'))syncAchievementProof();if(data&&run?.completed)void cloud.complete(run);if(data?.unlocked){unlocked=[...new Set([...unlocked,...data.unlocked.filter(id=>ENDINGS.some(e=>e.id===id))])];save();}}
function exportCollection(){const blob=new Blob([JSON.stringify({format:'hedo-collection',version:3,unlocked,legacy,achievements},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='移動人生-我的圖鑑.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('圖鑑已匯出，檔案不含匿名登入金鑰。');}
document.addEventListener('change',async event=>{if(event.target.id!=='import-collection')return;const file=event.target.files?.[0];if(!file)return;try{if(file.size>500000)throw new Error();const data=JSON.parse(await file.text());if(data.format!=='hedo-collection'||!Array.isArray(data.unlocked))throw new Error();unlocked=[...new Set([...unlocked,...data.unlocked.filter(id=>ENDINGS.some(e=>e.id===id))])];legacy=[...new Set([...legacy,...(Array.isArray(data.legacy)?data.legacy:[]).filter(id=>LEGACY_ENDINGS.some(e=>e.id===id))])];const imported=readAchievementRecords(data.achievements,'imported');for(const [id,row]of Object.entries(imported)){if(!Object.hasOwn(achievements,id))achievements[id]={...row,source:'imported'};}save();toast('圖鑑與成就已匯入此瀏覽器。');}catch{toast('這不是可辨識的移動人生圖鑑檔案。');}event.target.value='';});
collectAchievements(false);save();home(false);void syncCloud();

// A missing illustration must never replace the readable story with a broken
// image icon, consume a choice, reroll a result or alter the saved life.
document.addEventListener('error',event=>{
 const image=event.target;
 if(!image?.matches?.('img[data-illustration]'))return;
 image.hidden=true;
 if(image.dataset.illustration!=='portrait')image.closest('figure')?.classList.add('illustration-unavailable');
},true);
