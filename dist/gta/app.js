import { ROAD_LINES, WORLD_LIMIT, LOCATIONS, BUILDINGS, MISSIONS } from './world.js';
import { createVehicle, stepVehicle, createPedestrian, stepPedestrian } from './driving.js';
import { createFleet, stepFleet, findNearbyCar, takeCar, parkCar } from './fleet.js';
import { createCrowd, stepCrowd } from './crowd.js';
import { createAwareness, stepAwareness } from './awareness.js';
import { createVehicleDamageState, stepVehicleDamage } from './vehicle-damage.js';
import { createGameInput } from './input.js';
import { createPoliceState, reportCrime, stepPolice } from './police.js';
import { createCombatState, selectWeapon, startReload, stepCombat, applyDamage, getPoliceCombatants } from './combat.js';
import { freshProgress, loadProgress, saveProgress, completeMission } from './progress.js';
import { GARAGE_PALETTE, GARAGE_CATALOG, GARAGE_RULES, garageEligibility, quoteGarageAction, applyGarageAction, applyGarageCustomizations, getPerformanceProfile, claimRaceAchievements, claimDailyReward } from './garage.js';
import { PRIVATE_GARAGE_RULES, applyOwnershipAction } from './ownership.js';
import { isOwnedVehicle, ownedHealth, snapshotOwnedVehicles, retrieveOwnedVehicle, storeOwnedVehicle } from './ownership-session.js';
import { createCollectionPanel } from './collection-ui.js';
import { RACE_CATALOG, RACING_RULES } from './racing-catalog.js';
import { createRaceState, raceEligibility, startRace, stepRace, cancelRace, settleRace } from './racing.js';
import { createRacingPanel, raceTime } from './racing-ui.js';
import { deriveRacingRecords, personalBestSnapshot, raceSplitComparison, compareRaceResult } from './racing-records.js';
import { createRaceProof, appendRaceProof, finalizeRaceProof } from './racing-proof.js';
import { recordTime, recordDelta } from './racing-records-ui.js';
import { createLeaderboardClient } from './leaderboard-client.js';
import { racingCalendar, dailyChallenge } from './racing-calendar.js';
import { deriveDailyChallenge } from './daily-challenges.js';
import { weekRange } from './daily-ui.js';

const $ = id => document.getElementById(id);
const panel = $('panel');
const FOOT_SPAWN = Object.freeze({ x: 7, z: 32, heading: 0 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const setText = (id, value) => { const node = $(id); if (node.textContent !== value) node.textContent = value; };
const locationById = id => LOCATIONS.find(place => place.id === id);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let progress = storage ? loadProgress(storage) : freshProgress();
let actor = createPedestrian(FOOT_SPAWN);
let fleet = applyGarageCustomizations(createFleet(), progress), controlledId = null, transition = null, hasDriven = false;
let crowd = createCrowd(), awareness = createAwareness();
let vehicleDamage = createVehicleDamageState();
let police = createPoliceState(), pendingArrest = false;
let combat = createCombatState(), pendingDeath = false, aiming = false;
let combatants = [], lastWeaponHint = -10;
const WEAPON_LABELS = {unarmed:'徒手',pistol:'街頭手槍',smg:'輕型衝鋒槍'};
const WEAPON_ORDER = ['unarmed','pistol','smg'];
let scene, input, started = false, walking = true, cameraMode = 'chase';
let cameraYaw = 0, cameraPitch = .34, lookUntil = 0, quality = 'auto';
let accumulator = 0, needsRender = true;
const fixedStep = 1 / 60;
const touchControls = window.matchMedia('(pointer: coarse)');
const controlHint = (desktop, touch) => touchControls.matches ? touch : desktop;
let pendingJump = false;
let active = null, waypoint = null, lastImpact = -10, time = 0;
let race = createRaceState(), selectedRaceId = RACE_CATALOG[0].id;
let raceTab='daily',raceBeforeRecords=null,raceBest=null,raceSplit=null,raceProof=null,raceDailyGoal=null;
const rankingClient=createLeaderboardClient({storage}),raceUploadCandidates=new Map();
let rankingScope='personal',rankingStatus='idle',rankingData=null,rankingMine=null,rankingError='',rankingMineError='';
let rankingBusy=false,rankingMessage='',rankingPending=null,rankingPendingError='',rankingRequest=0;
let rankingPeriod='weekly',calendarOffset=null,calendarError='',calendarSync=null,calendarViewDay=null;
let lastFrame = 0, raf = 0, lastHud = 0, toastTimer;
let audio, tone, volume, sirenTone, sirenVolume, soundEnabled = false;
let restoreFocus = null;
let lastGaragePurchase = -Infinity;
let lastCollectionAction = -Infinity, ownedSaveTimer = null, ownedHealthDirty = false, collectionTab = progress.ownedVehicleIds.length ? 'owned' : 'shop';

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
}
function clearInput() {
  input?.clear();
  pendingJump = false; aiming = false;
}
function openPanel(title, eyebrow, content) {
  clearInput(); input?.unlock();
  restoreFocus = document.activeElement;
  $('panel-eyebrow').textContent = eyebrow;
  $('panel-body').replaceChildren();
  const heading = document.createElement('h2'); heading.id = 'panel-title'; heading.textContent = title;
  $('panel-body').append(heading, content);
  panel.dataset.kind = content.id === 'garage-panel' ? 'garage' : content.id === 'collection-panel' ? 'collection' : content.id === 'race-panel' ? 'racing' : '';
  if (!panel.open) panel.showModal();
  document.body.classList.add('paused');
  $('close-panel').focus();
  needsRender = true;
  if (volume && audio) volume.gain.setTargetAtTime(0, audio.currentTime, .08);
  if (sirenVolume && audio) sirenVolume.gain.setTargetAtTime(0, audio.currentTime, .08);
}
function el(tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text != null) node.textContent = text; return node;
}
function button(label, className, action) {
  const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', action); return node;
}
function targetPlace() {
  if (raceLive() && race.checkpoint) return {...race.checkpoint,id:'race-checkpoint',name:'第 '+(race.checkpointIndex+1)+' 個檢查點'};
  if (waypoint === 'racing') return locationById('racing');
  if (waypoint === 'collection') return locationById('collection');
  if (waypoint === 'owned-car') return fleet.find(isOwnedVehicle) || locationById('collection');
  if (!hasDriven) {
    const owned = fleet.find(isOwnedVehicle);
    if (owned) return owned;
    if (progress.ownedVehicleIds.length) return locationById('collection');
    const available = fleet.filter(car => !['burning', 'wreck'].includes(car.damageStage));
    const car = available.find(car => car.id === 'starter-sedan') || available.reduce((near, car) => !near || Math.hypot(car.x-actor.x,car.z-actor.z)<Math.hypot(near.x-actor.x,near.z-actor.z) ? car : near, null);
    return car ? { ...car, id:'first-car', name:car.name } : null;
  }
  if (waypoint === 'garage') return locationById('garage');
  if (active) return locationById(active.mission[active.stage === 'pickup' ? 'pickup' : 'dropoff']);
  return waypoint ? locationById(waypoint) : null;
}
function raceLive() { return race.phase === 'countdown' || race.phase === 'racing'; }
function raceCars() { return raceLive() ? race.rivals : []; }
function raceContext() {
  return {...garageContext(), busted:pendingArrest||police.phase==='busted', traffic:fleet,
    policeUnits:police.units,pedestrians:crowd,obstacles:BUILDINGS};
}
function raceDistance() { const start=RACE_CATALOG[0].start;return Math.hypot(actor.x-start.x,actor.z-start.z); }
function calendarNow() { return Date.now()+(calendarOffset||0); }
function currentRaceCalendar() { return racingCalendar(calendarNow()); }
function rankingPeriodOptions(calendar=currentRaceCalendar()) {
  return rankingPeriod==='alltime'?{}:{scope:'weekly',weekId:rankingPeriod==='previous'?calendar.previousWeekId:calendar.weekId};
}
function matchingPeriod(data,options) { return !data?false:options.scope==='weekly'?data.scope==='weekly'&&data.weekId===options.weekId:!data.scope||data.scope==='alltime'; }
async function refreshRaceCalendar(refresh=false) {
  if(calendarSync)return calendarSync;
  calendarSync=(async()=>{
    try {const data=await rankingClient.calendar({refresh});calendarOffset=data.serverNow-data.receivedAt;calendarError='';}
    catch {calendarError=calendarOffset===null?'賽季時間暫時無法同步，今日挑戰先依裝置時間。':'暫時無法同步，先沿用上次同步時間。';}
    refreshRacePanel();
  })().finally(()=>{calendarSync=null;});
  return calendarSync;
}
function navigateRace(id=selectedRaceId) {
  if(raceLive()){showRaces();return;}
  selectedRaceId=id;waypoint='racing';panel.close();updateHud();
  notify('發車區已標記。開自己的車前往，車頭朝東、停穩後報名。');
}
function renderRaces(message='',preserve=false) {
  if(!started||pendingDeath||pendingArrest||transition)return;
  const records=deriveRacingRecords(progress),calendar=currentRaceCalendar(),periodOptions=rankingPeriodOptions(calendar);
  calendarViewDay=calendar.dayId;
  const entries=RACE_CATALOG.map(item=>{
    return {id:item.id,title:item.name,description:item.description,route:item.route,length:item.distance,
      mode:item.type==='time-trial'?'TIME TRIAL / 計時':'STREET RACE / 街頭賽',limit:item.timeLimit,
      rewardLabel:(item.type==='time-trial'?'限時完賽':item.maxRank===1?'奪冠':'前 '+item.maxRank+' 名')+' +$'+item.reward,
      best:records.byRace[item.id].best?.elapsedMs/1000||null,
      eligible:raceEligibility(progress,item.id,raceContext())};
  });
  const wrap=createRacingPanel({entries,race,car:currentCar(),money:progress.money,message,
    onStart:beginRace,onNavigate:navigateRace,onCollection:()=>showCollection(),onGarage:()=>showGarage(),
    onRetire:()=>{abortRace('cancelled');panel.close();updateHud();},onResume:()=>panel.close(),
    tab:raceTab,records,raceId:selectedRaceId,
    daily:{daily:deriveDailyChallenge(progress,calendar.dayId),calendar,nowMs:calendarNow(),
      clockLabel:calendarOffset===null?'台北時間 · 使用裝置時間':calendarError?'台北時間 · 沿用上次同步':'台北時間 · 已同步伺服器',clockError:calendarError,
      onClaim:()=>{const result=claimDailyReward(progress,currentRaceCalendar().dayId);progress=result.progress;const saved=saveProgress(storage,progress);updateHud();renderRaces(result.message+(saved?'':' 瀏覽器無法儲存，請保留本頁。'),true);},
      onWeekly:()=>{raceTab='records';rankingScope='global';rankingPeriod='weekly';selectedRaceId=dailyChallenge(currentRaceCalendar().dayId).raceId;showRaces();},
      onRefresh:()=>refreshRaceCalendar(true)},
    board:{scope:rankingScope,period:rankingPeriod,periodLabel:rankingPeriod==='alltime'?'歷來最佳 · 不隨賽季重置':(rankingPeriod==='previous'?'上週 · ':'本週 · ')+weekRange(periodOptions.weekId)+' · 台北時間週一 00:00 換週',status:rankingStatus,
      data:rankingData?.raceId===selectedRaceId&&matchingPeriod(rankingData,periodOptions)?rankingData:null,mine:matchingPeriod(rankingMine,periodOptions)?rankingMine:null,
      error:rankingError,mineError:rankingMineError,pending:rankingPending,pendingError:rankingPendingError,busy:rankingBusy,
      message:rankingMessage,candidate:raceUploadCandidates.get(selectedRaceId)||null},
    onTab:tab=>{raceTab=tab;showRaces();},
    onSelectRace:id=>{selectedRaceId=id;rankingData=null;rankingError='';showRaces();},
    onScope:scope=>{rankingScope=scope;showRaces();},
    onPeriod:period=>{rankingPeriod=period;rankingData=null;rankingMine=null;rankingError='';rankingMessage='';showRaces();},
    onChallenge:id=>{raceTab='races';navigateRace(id);notify('已標記發車區。再次報名後，沿途比較個人最佳分段。');},
    onRefresh:async()=>{await refreshRaceCalendar(true);await loadRaceRankings(true);},onPublish:publishRaceResult,onRetry:()=>publishRaceResult(null),onWithdraw:id=>withdrawRaceResult(id,periodOptions),
    onClaim:()=>{const result=claimRaceAchievements(progress);progress=result.progress;const saved=saveProgress(storage,progress);updateHud();renderRaces((result.message||'成就獎金已領取。')+(saved?'':' 瀏覽器無法儲存，請保留本頁。'),true);}});
  if(preserve&&panel.open&&$('race-panel')) {
    const scroll=panel.scrollTop,focusId=document.activeElement?.id;
    $('race-panel').replaceWith(wrap);panel.scrollTop=scroll;
    if(focusId)$(focusId)?.focus({preventScroll:true});
    return;
  }
  openPanel('街頭賽事','AFTERHOURS / 把性能跑出來',wrap);
}
function showRaces(message='') {
  if(!started||pendingDeath||pendingArrest||transition)return;
  flushOwnedHealth(true);renderRaces(message);
  if(!raceLive())void refreshRaceCalendar().then(()=>{if(panel.open&&$('race-panel')&&raceTab==='records'&&!raceLive())return loadRaceRankings();});
}
function refreshRacePanel() { if(panel.open&&$('race-panel')&&!raceLive())renderRaces('',true); }
async function loadRaceRankings(refresh=false) {
  const request=++rankingRequest,id=selectedRaceId,global=rankingScope==='global',options=rankingPeriodOptions();
  rankingPendingError='';
  if(global){rankingStatus='loading';rankingError='';rankingMineError='';}
  refreshRacePanel();
  const [pending,board,mine]=await Promise.allSettled([rankingClient.pending(),global?rankingClient.board(id,{refresh,...options}):null,global?rankingClient.mine(options):null]);
  if(request!==rankingRequest)return;
  if(id!==selectedRaceId||global!==(rankingScope==='global')||JSON.stringify(options)!==JSON.stringify(rankingPeriodOptions())){
    if(panel.open&&$('race-panel')&&raceTab==='records'&&!raceLive())void loadRaceRankings(true);
    return;
  }
  rankingPending=pending.status==='fulfilled'?pending.value:null;
  rankingPendingError=pending.status==='rejected'?pending.reason.message:'';
  if(global){
    rankingStatus=board.status==='fulfilled'?'ready':'error';
    if(board.status==='fulfilled')rankingData=board.value;else rankingError=board.reason.message;
    if(mine.status==='fulfilled')rankingMine=mine.value;else rankingMineError=mine.reason.message;
  }
  refreshRacePanel();
}
async function publishRaceResult(id) {
  if(rankingBusy)return;
  const candidate=id?raceUploadCandidates.get(id):null;
  if(id&&!candidate)return;
  rankingBusy=true;rankingMessage='正在核對行駛紀錄…';refreshRacePanel();
  try {
    const result=await(id?rankingClient.submit({runId:candidate.runId,proof:candidate.proof}):rankingClient.retry());
    rankingMessage='成績已確認 · '+result.entry.driverCode+' · '+recordTime(result.entry.elapsedMs)+'。'+(result.weekly?(result.weekly.improved?'已更新 ':'已保留較快的 ')+weekRange(result.weekly.weekId)+' 週榜紀錄。':'這筆較早的紀錄只更新歷來榜。');
    selectedRaceId=result.entry.raceId;rankingScope='global';
    const calendar=currentRaceCalendar();rankingPeriod=result.weekly?.weekId===calendar.weekId?'weekly':result.weekly?.weekId===calendar.previousWeekId?'previous':'alltime';
  } catch(error){rankingMessage=error.message||'上榜暫時未完成，可稍後重試。';}
  finally {rankingBusy=false;await loadRaceRankings(true);}
}
async function withdrawRaceResult(id,options) {
  if(rankingBusy)return;
  rankingBusy=true;rankingMessage='正在撤下公開紀錄…';refreshRacePanel();
  const label=options.scope==='weekly'?weekRange(options.weekId)+' 週榜':'歷來榜';
  try {await rankingClient.withdraw(id,options);rankingMessage='已撤下'+label+'的這條賽道紀錄。其他榜單與個人進度仍保留。';}
  catch(error){rankingMessage=error.message||'撤榜尚未確認，請重試。';}
  finally{rankingBusy=false;await loadRaceRankings(true);}
}
function beginRace(id,expectedDay=null) {
  if(raceLive())return;
  const dayId=currentRaceCalendar().dayId;
  if(expectedDay&&expectedDay!==dayId){raceTab='daily';showRaces('每日目標已更新，請確認新目標後重新報名。');return;}
  const result=startRace(progress,id,crypto.randomUUID(),{...raceContext(),dailyDay:dayId});
  if(!result.ok){showRaces(result.message);return;}
  raceBeforeRecords=deriveRacingRecords(progress);raceBest=personalBestSnapshot(raceBeforeRecords,id);raceSplit=null;
  raceProof=createRaceProof(id,controlledId);
  raceDailyGoal=dailyChallenge(dayId);if(raceDailyGoal.raceId!==id)raceDailyGoal=null;
  race=result.state;selectedRaceId=id;waypoint=null;clearInput();actor={...actor,speed:0,steerAngle:0,yawVelocity:0};
  fleet=fleet.map(car=>car.id===controlledId?{...car,...actor}:car);
  panel.close();updateHud();notify('3 秒後起跑。依序穿過檢查點，Shift 可加速。');
}
function abortRace(reason='cancelled',announce=true) {
  if(!raceLive())return;
  race=cancelRace(race,reason);raceProof=null;raceSplit=null;raceDailyGoal=null;needsRender=true;
  if(announce)notify(race.result?.message||'本場已退出，沒有發放獎金。');
}
function showRaceResult() {
  const comparison=compareRaceResult(raceBeforeRecords||deriveRacingRecords(progress),race),proof=finalizeRaceProof(raceProof);
  raceProof=null;
  actor={...actor,speed:0,steerAngle:0,yawVelocity:0};
  fleet=fleet.map(car=>car.id===controlledId?{...car,...actor}:car);
  flushOwnedHealth();
  const completed=race.phase==='finished'||race.result?.reason==='lost',definition=RACE_CATALOG.find(item=>item.id===race.raceId);
  const dayId=currentRaceCalendar().dayId,result=settleRace(progress,race,{dayId});progress=result.progress;
  const achievements=result.ok?claimRaceAchievements(progress):{progress,reward:0,unlocked:[],pendingCount:0};progress=achievements.progress;
  const daily=result.ok?claimDailyReward(progress,dayId):{progress,reward:0};progress=daily.progress;
  if(result.ok&&proof)raceUploadCandidates.set(race.raceId,{runId:race.runId,proof,elapsedMs:Math.round(race.elapsed*1000)});
  const saved=saveProgress(storage,progress);needsRender=true;updateHud();
  const wrap=el('div','race-result');wrap.id='race-result';
  wrap.append(el('span','garage-eyebrow',completed?'FINISH LINE / 完成比賽':'RACE ENDED / 本場結束'),
    el('p','result-message',completed?(result.reward>0?'這一趟，性能換成了獎金。':'你通過了終點。下一場再挑戰獎金名次。'):race.result?.message||'本場未完成，沒有發放獎金。'));
  const stats=el('div','race-result-stats');
  for(const [label,value] of [['完賽時間',recordTime(race.elapsed*1000)],['名次',completed?String(race.rank):'DNF'],['賽事獎金','+$'+(result.reward||0)]]){
    const item=el('div','',label);item.append(el('strong','',value));stats.append(item);
  }
  wrap.append(stats);
  if(result.ok){
    const pb=el('div','race-result-pb'+(comparison.isPersonalBest?' is-best':''));pb.id='race-result-pb';
    pb.append(el('span','garage-eyebrow',comparison.isFirst?'FIRST RECORD / 第一個基準':comparison.isPersonalBest?'NEW PERSONAL BEST / 新個人最佳':'PERSONAL BEST / 繼續挑戰'),
      el('strong','',comparison.isFirst?'第一筆完賽紀錄已留下。':recordDelta(comparison.deltaMs)));
    if(comparison.previousBest)pb.append(el('small','','上一個最佳 '+recordTime(comparison.previousBest.elapsedMs)));wrap.append(pb);
  }
  if(achievements.unlocked.length){
    const bonus=el('div','race-result-achievements');bonus.id='race-result-achievements';bonus.append(el('strong','','成就獎勵 +$'+achievements.reward),el('p','',achievements.unlocked.map(item=>item.name).join(' · ')));wrap.append(bonus);
  }
  if(achievements.pendingCount)wrap.append(el('p','help-note','仍有成就待領取，可到成就頁查看。'));
  if(daily.reward){const bonus=el('div','race-result-daily');bonus.id='race-result-daily';bonus.append(el('span','garage-eyebrow','DAILY COMPLETE / 今日目標達成'),el('strong','','每日獎勵 +$'+daily.reward),el('p','',dailyChallenge(dayId).title+' · 今日獎金已領取，重賽可再挑戰最佳。'));wrap.append(bonus);}
  else if(result.ok&&raceDailyGoal){const state=deriveDailyChallenge(progress,dayId);wrap.append(el('p','help-note',raceDailyGoal.dayId!==dayId?'本場跨過每日更新時間，照常保留完賽與賽事獎金；可查看新的每日目標。':state.claimed?'今日獎勵已領取，這次仍會保存今日最佳。':state.claimable?'今日目標已達成，獎勵待領取；請至每日挑戰頁查看。':'距離每日目標：'+recordDelta(Math.round(race.elapsed*1000)-raceDailyGoal.targetMs)));}
  wrap.append(el('p','help-note',saved?'紀錄、獎金、成就與愛車已保存在這台裝置。':'瀏覽器目前無法儲存，這次變更只保留至本次遊玩結束。'));
  if(completed&&!result.ok&&result.message)wrap.append(el('p','help-note',result.message));
  const actions=el('div','race-result-actions');const leave=button('回到街頭 ↗','primary',()=>panel.close());leave.id='race-continue';
  const garage=button('導航去修車／改裝','secondary',()=>navigateGarage());garage.id='race-garage';
  const rankings=button('比較紀錄／匿名上榜','secondary',()=>{selectedRaceId=race.raceId;raceTab='records';rankingScope='global';showRaces();});rankings.id='race-result-rankings';
  actions.append(leave,garage,button('查看每日挑戰','secondary',()=>{raceTab='daily';showRaces();}),button('查看下一場賽事','secondary',()=>{raceTab='races';showRaces();}),rankings,button('查看成就','secondary',()=>{raceTab='achievements';showRaces();}));wrap.append(actions);
  openPanel(definition?.name||'街頭競速',completed?'RACE COMPLETE':'RACE ENDED',wrap);
}
function advanceRace(dt) {
  if(!raceLive())return;
  const before=race.phase,checkpoint=race.checkpointIndex;
  race=stepRace(race,{...raceContext(),traffic:[...fleet,...police.units]},dt);
  if(raceProof&&(race.phase==='racing'||race.phase==='finished'||race.result?.reason==='lost'))appendRaceProof(raceProof,race.elapsed,race.lastPlayer,actor.speed);
  if(checkpoint!==race.checkpointIndex)raceSplit=raceSplitComparison(race,raceBest);
  if(!raceLive()){showRaceResult();return;}
  if(before==='countdown'&&race.phase==='racing')notify('GO！下一個檢查點已標記。');
  else if(race.checkpointIndex!==checkpoint)notify('通過檢查點 '+race.checkpointIndex+' / '+RACE_CATALOG.find(item=>item.id===race.raceId).checkpoints.length+'。');
}
function targetDistance() {
  const target = targetPlace(); return target ? Math.hypot(actor.x - target.x, actor.z - target.z) : Infinity;
}
function garageDistance() {
  const location = locationById('garage');
  return Math.hypot(actor.x-location.x,actor.z-location.z);
}
function garageContext() {
  return { vehicle:currentCar(), player:actor, walking, controlledId, wantedLevel:police.level, transition, dead:combat.dead||pendingDeath||pendingArrest };
}
function collectionContext() {
  return { ...garageContext(), location:locationById('collection'), policeUnits:police.units, pedestrians:crowd };
}
function collectionDistance() {
  const place=locationById('collection');return Math.hypot(actor.x-place.x,actor.z-place.z);
}
function flushOwnedHealth(persist=false) {
  clearTimeout(ownedSaveTimer);ownedSaveTimer=null;
  const next=snapshotOwnedVehicles(progress,fleet);ownedHealthDirty ||= next!==progress;progress=next;
  if(persist&&ownedHealthDirty){const saved=saveProgress(storage,progress);if(saved)ownedHealthDirty=false;return saved;}
  return true;
}
function scheduleOwnedHealthSave() {
  if(ownedSaveTimer!==null)return;
  if(fleet.some(car=>isOwnedVehicle(car)&&progress.ownedVehicleHealth[car.id]!==ownedHealth(car))) {
    ownedSaveTimer=setTimeout(()=>flushOwnedHealth(true),1000);
  }
}
function navigateCollection() {
  waypoint='collection';panel.close();updateHud();
  notify(active?'已標記私人車庫，手上的委託仍保留。':'已標記私人車庫。可以步行前往，進入紫色服務區後辦理。');
}
function locateOwnedCar() {
  if(!fleet.some(isOwnedVehicle)){navigateCollection();return;}
  waypoint='owned-car';panel.close();updateHud();notify('已標記街上的愛車。走近車門即可上車。');
}
function handleCollectionAction(action) {
  if(raceLive()){showRaces('先完成或退出本場，才能更換愛車。');return;}
  if(performance.now()-lastCollectionAction<350)return;
  flushOwnedHealth();
  let result;
  const oldOwnedIds=fleet.filter(isOwnedVehicle).map(car=>car.id);
  if(action.kind==='retrieve')result=retrieveOwnedVehicle(progress,fleet,action.vehicleId,collectionContext());
  else if(action.kind==='store')result=storeOwnedVehicle(progress,fleet,collectionContext());
  else {
    if(action.kind==='recover'&&fleet.some(car=>car.id===action.vehicleId&&car.damageStage==='burning')){
      showCollection('先回到街頭，等火勢熄滅後再安排救援。');return;
    }
    result=applyOwnershipAction(progress,action,collectionContext());
  }
  if(!result.ok){showCollection(result.message,`${action.kind}:${action.vehicleId||''}`);return;}
  lastCollectionAction=performance.now();progress=result.progress;
  if(result.fleet){
    fleet=result.fleet;walking=result.walking;controlledId=result.controlledId;
    actor=walking?createPedestrian(result.player):actor;
    cameraYaw=actor.heading;cameraPitch=.34;clearInput();
    const cooldowns={...vehicleDamage.collisionCooldowns};for(const id of oldOwnedIds)delete cooldowns[id];
    vehicleDamage={...vehicleDamage,collisionCooldowns:cooldowns};
    if(waypoint==='owned-car')waypoint=null;
  }else if(action.kind==='recover'){
    fleet=fleet.filter(car=>car.id!==action.vehicleId);
    if(waypoint==='owned-car')waypoint=null;
    const cooldowns={...vehicleDamage.collisionCooldowns};delete cooldowns[action.vehicleId];vehicleDamage={...vehicleDamage,collisionCooldowns:cooldowns};
  }
  if(action.kind==='purchase')collectionTab='owned';
  const saved=saveProgress(storage,progress);needsRender=true;updateHud();
  showCollection(result.message+(saved?' 已保存在這台裝置。':' 瀏覽器無法儲存，這次變更僅保留至本次遊玩結束。'),`${action.kind}:${action.vehicleId||''}`);
}
function showCollection(message='',focusAction=null) {
  if(raceLive()){showRaces('比賽中不能收車或換車。先完成或退出本場。');return;}
  if(!started||pendingDeath||pendingArrest||transition)return;
  flushOwnedHealth(true);
  const scroll=panel.open&&panel.dataset.kind==='collection'?panel.scrollTop:0;
  const wrap=createCollectionPanel({progress,fleet,context:collectionContext(),tab:collectionTab,message,
    onAction:handleCollectionAction,onTab:tab=>{collectionTab=tab;showCollection('',`tab:${tab}`);},
    onNavigate:navigateCollection,onLocate:locateOwnedCar,onRepair:()=>showGarage(),onClose:()=>panel.close()});
  openPanel('私人車庫','BUY / COLLECT / DRIVE',wrap);panel.scrollTop=scroll;
  if(focusAction){
    const [kind,id]=focusAction.split(':');
    const target=kind==='tab'?wrap.querySelector(`[data-collection-tab="${id}"]`):wrap.querySelector(`[data-collection-action="${kind}"][data-vehicle-id="${id}"]`);
    if(target&&!target.disabled)target.focus({preventScroll:true});else if(message)$('collection-message').focus({preventScroll:true});
  }
}
function navigateGarage() {
  if(!hasDriven){panel.close();notify(controlHint('先走近車輛按 F，上車後再設定修車廠路標。','先走近車輛上車，再設定修車廠路標。'));return;}
  waypoint='garage';panel.close();updateHud();
  notify(active?'已標記修車廠，手上的委託仍保留。':'已標記修車廠。開進綠色服務格，停穩後進廠。');
}
function showGarage(message='',paintId=null,focusService=null) {
  if(raceLive()){showRaces('先完成或退出本場，再進廠修車與改裝。');return;}
  if(!started||pendingDeath||pendingArrest||transition)return;
  flushOwnedHealth(true);
  const car=currentCar(),eligible=garageEligibility(garageContext());
  const previousScroll=panel.open&&panel.dataset.kind==='garage'?panel.scrollTop:0;
  const wrap=el('div','garage-panel');wrap.id='garage-panel';
  const summary=el('div','garage-summary'),identity=el('div');
  identity.append(el('span','garage-eyebrow','HEDO CUSTOMS / 城市西側'),el('h3','',car?.name||'先帶一輛車來。'));
  identity.append(el('p','',car?'每輛車的車色與性能各自保留在這台裝置。':'坐進想改裝的車，沿地圖路標開進服務格。'));
  const balance=el('div','garage-wallet');balance.append(el('small','','可用基金'));
  const money=el('strong','','$ '+progress.money.toLocaleString('en-US'));money.id='garage-balance';balance.append(money);
  summary.append(identity,balance);wrap.append(summary);
  const status=el('p','garage-status'+(eligible.ok?' ready':''),eligible.ok?'已入位 · 可開始服務':eligible.message);
  status.id='garage-availability';wrap.append(status);
  const receipt=el('p','garage-receipt',message);receipt.id='garage-message';receipt.setAttribute('role','status');receipt.tabIndex=-1;receipt.hidden=!message;wrap.append(receipt);
  if(!eligible.ok){
    const route=button(`標記修車廠 · ${Math.round(garageDistance())} m ↗`,'garage-route',navigateGarage);route.id='garage-route';wrap.append(route);
    if(active&&waypoint==='garage')wrap.append(button('返回目前委託路線','text-btn',()=>{waypoint=null;panel.close();updateHud();}));
  }
  function serviceButton(label,action,key) {
    const quote=quoteGarageAction(progress,car,action);
    const transaction={...action,id:crypto.randomUUID()};
    const control=button(label,'garage-buy',()=>{
      if(performance.now()-lastGaragePurchase<350)return;
      const result=applyGarageAction(progress,currentCar(),transaction,garageContext());
      if(!result.ok){showGarage(result.message,paintId,key);return;}
      lastGaragePurchase=performance.now();control.disabled=true;
      progress=result.progress;
      fleet=fleet.map(item=>item.id===result.vehicle.id?{...result.vehicle,speed:0}:item);
      actor={...actor,speed:0,steerAngle:0,yawVelocity:0,impact:false,impactSpeed:0,impactVehicleId:null};
      if(result.clearCollisionCooldown){
        const cooldowns={...vehicleDamage.collisionCooldowns};delete cooldowns[result.vehicle.id];
        vehicleDamage={...vehicleDamage,collisionCooldowns:cooldowns};
      }
      const saved=saveProgress(storage,progress);
      needsRender=true;updateHud();
      const success=result.message+(!saved?' 瀏覽器無法儲存，這次改裝僅保留至本次遊玩結束。':' 已保存在這台裝置。');
      showGarage(success,paintId,key);
    });
    control.dataset.garageService=key;
    control.disabled=!eligible.ok||!quote.ok;
    control.title=!eligible.ok?eligible.message:!quote.ok?quote.message:label;
    return {control,quote};
  }
  if(car){
    const health=Math.floor(clamp(car.vehicleHealth??100,0,100));
    const repair=el('section','garage-repair'),info=el('div');
    info.append(el('span','garage-section-label','01 / 車體維護'),el('h3','','完整修復'),el('p','',`車況 ${health}% → 100% · 修復凹陷、刮痕與引擎冒煙`));
    const {control,quote}=serviceButton(health>=100?'車況完整':`修復車輛 · $${GARAGE_CATALOG.repair.price}`,{kind:'repair'},'repair');
    if(!quote.ok&&eligible.ok)info.append(el('small','garage-reason',quote.message));
    repair.append(info,control);wrap.append(repair);
    const selected=GARAGE_PALETTE.find(color=>color.id===paintId)||GARAGE_PALETTE.find(color=>color.id===progress.customizations?.[car.id]?.colorId)||GARAGE_PALETTE.find(color=>color.color===car.color)||GARAGE_PALETTE[0];
    paintId=selected.id;
    const paint=el('section','garage-paint');paint.append(el('span','garage-section-label','02 / 車身塗裝'));
    const heading=el('div','garage-paint-heading');heading.append(el('h3','','換個顏色，換種心情。'),el('span','',`每次 $${GARAGE_CATALOG.paint.price}`));paint.append(heading);
    const swatches=el('div','garage-swatches');swatches.setAttribute('aria-label','選擇車身顏色');
    for(const color of GARAGE_PALETTE){
      const option=button('','garage-swatch',()=>showGarage('',color.id,'paint:'+color.id));
      option.dataset.paintId=color.id;option.setAttribute('aria-pressed',String(color.id===selected.id));
      option.style.setProperty('--paint','#'+color.color.toString(16).padStart(6,'0'));
      option.append(el('i',''),el('span','',color.name));swatches.append(option);
    }
    paint.append(swatches);
    const preview=el('div','garage-paint-preview');preview.style.setProperty('--paint','#'+selected.color.toString(16).padStart(6,'0'));
    const chip=el('span','garage-preview-chip');chip.setAttribute('aria-hidden','true');preview.append(chip,el('span','',selected.name+' · 選色預覽'));
    const purchase=serviceButton(`換上${selected.name} · $${GARAGE_CATALOG.paint.price}`,{kind:'paint',value:selected.id},'paint');
    if(!purchase.quote.ok&&purchase.quote.reason==='same-color')purchase.control.textContent='目前車色';
    preview.append(purchase.control);paint.append(preview);wrap.append(paint);
    const tune=el('section','garage-tuning');tune.append(el('span','garage-section-label','03 / 性能調校'),el('h3','','每一次轉彎，都更順手。'));
    const grid=el('div','garage-upgrades');
    const descriptions={engine:'加速與極速每級 +12%',brakes:'煞車力道每級 +15%',handling:'轉向回應每級 +10%'};
    for(const [key,option] of Object.entries(GARAGE_CATALOG.upgrades)){
      const level=car.upgrades?.[key]||0,card=el('article','garage-upgrade');
      card.append(el('span','garage-level',`LEVEL ${level} / ${option.maxLevel}`),el('h4','',option.name+'升級'),el('p','',descriptions[key]));
      const bars=el('div','garage-level-bars');bars.setAttribute('aria-hidden','true');
      for(let i=0;i<option.maxLevel;i++)bars.append(el('i',i<level?'filled':''));card.append(bars);
      const {control,quote}=serviceButton(level>=option.maxLevel?'已達最高級':`升至 Lv.${level+1} · $${option.prices[level]}`,{kind:'upgrade',value:key},key);
      card.append(control);if(!quote.ok&&quote.reason==='insufficient-funds')card.append(el('small','garage-reason','基金不足'));grid.append(card);
    }
    tune.append(grid);
    const profile=getPerformanceProfile(car.upgrades);
    tune.append(el('p','garage-spec',`目前性能：一般極速 ${Math.round(profile.maxSpeed*3.6)} km/h · 加速模式 ${Math.round(profile.boostSpeed*3.6)} km/h`));wrap.append(tune);
  }
  wrap.append(el('p','garage-footnote','服務期間城市暫停。起火與報廢車輛無法進廠；改色不會清除通緝。'));
  const leave=button('完成，回到街頭 ↗','primary',()=>panel.close());leave.id='garage-leave';wrap.append(leave);
  openPanel('禾多修車廠','REPAIR / PAINT / PERFORMANCE',wrap);panel.scrollTop=previousScroll;
  if(focusService){
    const target=focusService.startsWith('paint:')?wrap.querySelector(`[data-paint-id="${focusService.slice(6)}"]`):wrap.querySelector(`[data-garage-service="${focusService}"]`);
    if(target&&!target.disabled)target.focus({preventScroll:true});else if(message)receipt.focus({preventScroll:true});
  }
}
function showJobs() {
  if(raceLive()){showRaces('委託已保留，先完成或退出本場賽事。');return;}
  const wrap = el('div');
  if (!hasDriven) {
    wrap.append(el('p', 'lede', controlHint('今天的委託散在整座城。可以到私人車庫買車，或走到路邊按 F 接手車輛，找到代步工具後再接同事來電。', '今天的委託散在整座城。可以到私人車庫買車，或走到路邊車旁點「搶車」，找到代步工具後再接同事來電。')));
    wrap.append(button('查看私人車庫／買車', 'primary', () => showCollection()));
    wrap.append(button('先去找車 ↗', 'secondary', () => panel.close()));
    openPanel('先搞定交通工具。', 'STREET START / 行人開局', wrap); return;
  }
  wrap.append(el('p', 'lede', controlHint('同事口中的「順便」，就是你的城市冒險。沒有倒數計時，停好車再按 E 交接。', '同事口中的「順便」，就是你的城市冒險。沒有倒數計時，停好車再點畫面中的取件／交付按鈕。')));
  if (police.level) wrap.append(el('p', 'help-note', '同事不想被捲進追捕。可以先接委託，甩開警察、解除通緝後才能交接。'));
  MISSIONS.forEach((mission, index) => {
    const done = progress.completed.includes(mission.id);
    const current = !done && index === progress.completed.length;
    const card = el('article', `job-card${current ? ' is-next' : ''}`);
    card.append(el('span', 'job-number', String(index + 1).padStart(2, '0')));
    const info = el('div');
    info.append(el('h3', '', mission.title));
    if (done || current) {
      info.append(el('p', '', mission.brief));
      info.append(el('small', '', `${mission.person} · ${locationById(mission.pickup).name} → ${locationById(mission.dropoff).name}`));
    } else info.append(el('p', '', '完成前一個委託後，同事會再聯絡你。'));
    card.append(info);
    if (done) card.append(el('span', 'job-state', '✓ 已完成'));
    else if (active?.mission.id === mission.id) card.append(button('繼續任務 ↗', 'primary', () => panel.close()));
    else if (current) card.append(button('接下委託 ↗', 'primary', () => {
      active = { mission, stage: 'pickup' }; waypoint = null;
      panel.close(); updateHud(); notify(`${mission.person}：${mission.brief}`);
    }));
    else card.append(el('span', 'job-state', '尚未來電'));
    wrap.append(card);
  });
  openPanel('同事來電', 'SIDE MISSIONS / 城市委託', wrap);
}
function equipWeapon(id) {
  if (!started || pendingDeath || pendingArrest || transition) return;
  combat=selectWeapon(combat,id);clearInput();
  if(id!=='unarmed'){cameraMode='chase';cameraPitch=.18;}
  updateHud();needsRender=true;
}
function cycleWeapon() {
  equipWeapon(WEAPON_ORDER[(WEAPON_ORDER.indexOf(combat.weaponId)+1)%WEAPON_ORDER.length]);
}
function reloadWeapon() {
  if(!started||panel.open||!walking||transition||combat.dead)return;
  const before=combat.reload;
  combat=startReload(combat);
  if(!before&&combat.reload)notify('正在換彈，先找掩護。');
  else if(combat.weaponId!=='unarmed'&&!combat.weapons[combat.weaponId]?.reserve)notify('備彈用完了。解除通緝後可回總部補給。');
  updateHud();focusGame();
}
function showWeapons() {
  if(raceLive()){showRaces('先完成或退出本場，再整理裝備。');return;}
  if(!started||pendingDeath||pendingArrest||transition)return;
  const wrap=el('div');
  wrap.append(el('p','lede','想安靜下班，或留下回音。開槍會升高通緝，警察也會反擊。'));
  const grid=el('div','weapon-grid');
  const descriptions={unarmed:'收起武器，自由移動。',pistol:'單發手槍 · 節制開火，留意備彈。',smg:'連發衝鋒槍 · 持續射擊，彈藥消耗更快。'};
  WEAPON_ORDER.forEach((id,index)=>{
    const card=button('', 'weapon-choice'+(combat.weaponId===id?' selected':''),()=>{equipWeapon(id);panel.close();});
    card.setAttribute('aria-pressed',String(combat.weaponId===id));
    card.append(el('kbd','',String(index+1)),el('strong','',WEAPON_LABELS[id]),el('p','',descriptions[id]));
    if(id!=='unarmed')card.append(el('span','weapon-ammo',combat.weapons[id].mag+' / '+combat.weapons[id].reserve+' 發'));
    else card.append(el('span','weapon-ammo','UNARMED'));
    grid.append(card);
  });
  wrap.append(grid);
  const distance=Math.hypot(actor.x-FOOT_SPAWN.x,actor.z-FOOT_SPAWN.z);
  const canSupply=police.level===0&&distance<=18;
  const supply=button('總部補給 · 恢復血量與彈藥','secondary',()=>{
    if(police.level||Math.hypot(actor.x-FOOT_SPAWN.x,actor.z-FOOT_SPAWN.z)>18)return;
    const id=combat.weaponId;combat=selectWeapon(createCombatState(),id);combatants=[];
    panel.close();updateHud();notify('補給完成。血量與彈藥已恢復。');
  });
  supply.disabled=!canSupply;
  wrap.append(supply,el('p','supply-note',police.level?'先解除通緝，才能回總部補給。':distance>18?'總部補給點距離 '+Math.round(distance)+' m；回到最初出發的路邊即可補給。':'你在總部補給範圍內。補給不會扣除城市基金。'));
  openPanel('隨身裝備','LOADOUT / 武器與補給',wrap);
}
function showHelp() {
  const wrap = el('div');
  wrap.append(el('p', 'lede', controlHint('你從行人開始。先靠近路邊或停等中的車，按 F 接手車輛；之後可以換車、下車探索，或按 J 接委託。', '你從行人開始。用左下搖桿靠近路邊或停等中的車，點「搶車」接手車輛；之後可以換車、下車探索，或點左上「委託」接任務。')));
  const grid = el('div', 'help-grid');
  for (const [label, key] of [['步行／駕駛', 'WASD / 方向鍵'], ['奔跑／加速', 'Shift'], ['跳躍／手煞車', 'Space'], ['搶車／上下車', 'F'], ['任務交接', 'E'], ['轉動視角', '滑鼠 / 右鍵拖曳'], ['武器選單／快速切換', 'Tab / Q'], ['徒手／手槍／衝鋒槍', '1 / 2 / 3'], ['射擊／瞄準', '滑鼠左鍵 / 右鍵'], ['鍵盤射擊／瞄準', 'X / Z'], ['換彈', 'R'], ['城市地圖', 'M'], ['同事委託', 'J'], ['街頭賽事', 'T'], ['私人車庫／買車', 'B'], ['修車廠／改裝', 'G'], ['切換視角', 'V / C'], ['回到路邊', 'H'], ['暫停／釋放滑鼠', 'Esc']]) {
    const row = el('div', '', label); row.append(el('kbd', '', key)); grid.append(row);
  }
  wrap.append(grid, el('p', 'help-note', '步行方向跟隨鏡頭，左右鍵直接橫移。點擊街景可鎖定滑鼠轉視角，也可按住右鍵拖曳。開車時 W 油門、S 煞車後倒車、A/D 轉向、Space 手煞車；放開方向鍵會自動回正。'));
  wrap.append(el('p', 'help-note', '手機左側搖桿移動，右半畫面拖曳轉視角；右下是跳躍／煞車和奔跑／加速。靠近慢車才會顯示搶車提示，停穩才可下車。'));
  wrap.append(el('h3','','別忘了，警察也會開槍。'));
  wrap.append(el('p','help-note','按 Tab 或「武器」選擇裝備，Q 快速切換。步行持槍時，先點街景鎖定滑鼠，再按左鍵射擊；右鍵或 Z 瞄準，X 也能射擊，R 換彈。手機點「瞄準」鎖定瞄準姿態，拖右側轉向，按住「射擊」開火。駕駛時會收起武器。'));
  wrap.append(el('p','help-note','開槍會升高通緝；兩星以上警方會武裝反擊。警員先瞄準再射擊，建物與其他車輛能擋住火線。血量低時先躲掩護，解除通緝後回總部，在武器選單補給。血量歸零會顯示 WASTED，可重生為滿血行人，補滿彈藥；委託、完成紀錄與基金都保留。'));
  wrap.append(el('p','help-note','附近路人聽到槍聲會驚嚇、沿人行道逃離，安靜一段時間後才恢復步行。車流會為行人與阻路車輛減速，在空間足夠時側移避讓；連續交火期間會保持戒備。'));
  wrap.append(el('p','help-note','車輛撞擊或中彈會損壞；瞄準車輛或坐進駕駛座，可查看車況。引擎冒煙代表車況危險，起火後會在三秒內爆炸，請立即下車並遠離。爆炸會波及附近車輛、驚動路人並引來警方；建物可以阻擋爆炸傷害，殘骸無法再駕駛。'));
  wrap.append(el('p','help-note','按 G 或左上「修車廠」查看服務並設定路標。解除通緝後，把車開進修車廠的綠色服務格、停穩再按 E 進廠；可花城市基金修復車身、換色，以及升級引擎、煞車與操控。修復 $90、換色 $60；每種性能最多兩級。起火與報廢車無法進廠，換色也不會解除通緝。'));
  wrap.append(el('h3', '', '搶得到車，也要甩得掉警察。'));
  wrap.append(el('p', 'help-note', '搶車或高速碰撞會增加通緝星數，撞上警車會引來更多警力。警車會沿街道追捕；紅藍標記是警車，搜索時的橘色圓圈是你最後被目擊的位置。繞過街角、利用建物遮住視線，持續避開警方搜索，星數才會逐顆下降。被看見或再次犯案會中斷倒數。'));
  wrap.append(el('p', 'help-note', '警車靠近時若停住，逮捕進度會上升；持續移動、拉開距離可中斷逮捕。被捕後車輛會被扣留，以行人返回總部，委託、完成紀錄與城市基金保留。通緝期間不能使用「回到路邊」或交接委託。'));
  wrap.append(el('p', 'help-note', '存檔保留已完成委託、城市基金的消費，以及每輛車的車色與升級。重新整理或回到路邊會以行人出發；重新找到那輛車，即可繼續使用改裝。車況與位置只屬於本次漫遊；原本的職涯存檔完全獨立。畫面卡頓時可按右上角 ◈ 切換省電畫質。'));
  wrap.append(el('h3','','留一個車位，給自己的下班路。'));
  wrap.append(el('p','help-note','B 或「車庫」開啟選購與收藏。可以步行到私人車庫，解除通緝後買車、取車或切換愛車。每款限一輛，共三個車位；開自己的車不會觸發失竊通緝。G 修車廠可為愛車改色與升級，每輛車各自保留。收存不會修復車況，報廢愛車可付 $120 救援；重開遊戲時所有愛車都在庫內保管。'));
  wrap.append(el('h3','','開自己的車，把獎金跑回來。'));
  wrap.append(el('p','help-note','T 或「賽事」查看三場街頭競速。開已購買的愛車到車庫前方發車區，無通緝、停穩後報名，三秒倒數後依序通過光圈。入門計時 $140、短途前兩名 $260、環城第一名 $420；可重賽。獎金會加入城市基金，可用於買車、修復與性能升級。改裝沿用真實駕駛性能；比賽中離車、報廢、死亡或被捕會中止且不發獎。暫停面板會凍結比賽。'));
  wrap.append(el('p','help-note','賽事中心另有「排行榜」與「成就」。個人最佳與分段差距會在下次競速時比較；8項成就各提供一次獎金。完賽後可自行上傳成績，以匿名車手代號加入全站時間榜，亦可撤下。斷線仍能跑賽事並保留本機紀錄；未確認的上榜操作可手動重試。'));
  wrap.append(el('p','help-note','「每日」會在台北時間 00:00 換目標，同日達標可領一次額外獎金。每週榜在週一 00:00 換週，可切換本週、上週與歷來；週次依伺服器首次收到成績的時間決定，重試不會改週。'));
  wrap.append(button('知道了，出發 ↗', 'primary', () => panel.close()));
  openPanel('你的城市操作手冊', 'HOW TO PLAY', wrap);
}
function showPause() {
  if (!started || panel.open) return;
  const wrap = el('div', 'pause-actions');
  wrap.append(el('p', 'lede', '引擎先休息，這座城市等你回來。'));
  wrap.append(button('繼續漫遊 ↗', 'primary', () => panel.close()));
  wrap.append(button('街頭賽事', 'secondary', () => showRaces()));
  wrap.append(button('同事委託', 'secondary', showJobs));
  wrap.append(button('城市地圖', 'secondary', showMap));
  wrap.append(button('武器與補給', 'secondary', showWeapons));
  wrap.append(button('私人車庫與買車', 'secondary', () => showCollection()));
  wrap.append(button('修車廠與改裝', 'secondary', () => showGarage()));
  wrap.append(button('操作說明', 'secondary', showHelp));
  wrap.append(button('結束本次漫遊，回到開場', 'secondary', () => {
    panel.close(); started = false;
    resetSession();
    $('hud').hidden = true; $('welcome').hidden = false;
    document.body.classList.remove('playing'); clearInput();
    $('start').focus();
  }));
  openPanel('先靠邊，喘口氣。', 'PAUSED / 已暫停', wrap);
}
function drawMap(canvas, full = false) {
  const context = canvas.getContext('2d'); if (!context) return;
  const size = canvas.width, margin = full ? 32 : 17;
  const scale = (size - margin * 2) / (WORLD_LIMIT * 2 + 6);
  const point = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
  context.fillStyle = '#142c35'; context.fillRect(0, 0, size, size);
  context.fillStyle = '#223c43';
  for (const building of BUILDINGS) {
    const [x, y] = point(building.x - building.w / 2, building.z - building.d / 2);
    context.fillRect(x, y, building.w * scale, building.d * scale);
  }
  context.strokeStyle = '#435958'; context.lineWidth = 12 * scale;
  for (const line of ROAD_LINES) {
    context.beginPath(); context.moveTo(...point(line, -WORLD_LIMIT)); context.lineTo(...point(line, WORLD_LIMIT)); context.stroke();
    context.beginPath(); context.moveTo(...point(-WORLD_LIMIT, line)); context.lineTo(...point(WORLD_LIMIT, line)); context.stroke();
  }
  context.strokeStyle = '#a2b29b35'; context.lineWidth = .8; context.setLineDash([2, 5]);
  for (const line of ROAD_LINES) {
    context.beginPath(); context.moveTo(...point(line, -WORLD_LIMIT)); context.lineTo(...point(line, WORLD_LIMIT)); context.stroke();
    context.beginPath(); context.moveTo(...point(-WORLD_LIMIT, line)); context.lineTo(...point(WORLD_LIMIT, line)); context.stroke();
  }
  context.setLineDash([]);
  const target = targetPlace();
  const course=raceLive()?RACE_CATALOG.find(item=>item.id===race.raceId):waypoint==='racing'?RACE_CATALOG.find(item=>item.id===selectedRaceId):null;
  if(course){context.strokeStyle='#ffc499';context.lineWidth=full?3:1.7;context.beginPath();course.route.forEach((p,i)=>context[i?'lineTo':'moveTo'](...point(p.x,p.z)));context.stroke();}
  for(const rival of raceCars()){const [rx,ry]=point(rival.x,rival.z);context.fillStyle='#ff9e88';context.beginPath();context.arc(rx,ry,full?5:3,0,Math.PI*2);context.fill();}
  for (const place of LOCATIONS) {
    const [x, y] = point(place.x, place.z);
    context.fillStyle = target?.id === place.id ? '#e5f45b' : '#9eaaa1';
    if(place.id==='garage'||place.id==='collection'){
      const width=full?10:6;context.fillStyle=target?.id===place.id?'#e5f45b':place.id==='collection'?'#c2acef':'#8fd5be';context.fillRect(x-width/2,y-width/2,width,width);
    }else{context.beginPath(); context.arc(x, y, full ? 5 : 3.2, 0, Math.PI * 2); context.fill();}
    if (full) {
      context.font = '15px system-ui'; context.textAlign = 'center';
      context.fillText(place.name, x, y - 12);
    }
  }
  if (target) {
    const [x, y] = point(target.x, target.z);
    context.strokeStyle = '#e5f45b'; context.lineWidth = 1.6;
    context.beginPath(); context.arc(x, y, full ? 13 : 8, 0, Math.PI * 2); context.stroke();
  }
  for (const car of fleet) {
    if (car.id === controlledId) continue;
    const [cx, cy] = point(car.x, car.z);
    context.fillStyle = car.damageStage==='wreck'?'#797883':car.damageStage==='burning'?'#ff8d74':car.owned?'#c2acef':car.stolen?'#f5ba51':'#90b8c0';
    context.fillRect(cx - 2, cy - 3, 4, 6);
  }
  if (police.phase === 'search' && police.lastKnown) {
    const [sx, sy] = point(police.lastKnown.x, police.lastKnown.z);
    context.strokeStyle = '#ffc36b'; context.fillStyle = '#ffc36b16';
    context.lineWidth = 1.3; context.setLineDash([4, 3]);
    context.beginPath(); context.arc(sx, sy, 20 * scale, 0, Math.PI * 2); context.fill(); context.stroke();
    context.setLineDash([]);
  }
  for (const unit of police.units) {
    const [px, py] = point(unit.x, unit.z);
    context.save(); context.translate(px, py); context.rotate(unit.heading);
    context.fillStyle = '#56c6ff'; context.strokeStyle = '#102635'; context.lineWidth = 1.5;
    context.beginPath(); context.moveTo(0, -6); context.lineTo(4, 5); context.lineTo(-4, 5); context.closePath(); context.stroke(); context.fill();
    context.fillStyle = '#ff6d76'; context.fillRect(-3, 1, 3, 3);
    context.restore();
  }
  const [x, y] = point(actor.x, actor.z);
  context.save(); context.translate(x, y); context.rotate(actor.heading);
  context.fillStyle = '#f5f5da'; context.strokeStyle = '#182c35'; context.lineWidth = 2;
  context.beginPath(); context.moveTo(0, -9); context.lineTo(6, 7); context.lineTo(0, 4); context.lineTo(-6, 7); context.closePath();context.stroke();context.fill();context.restore();
}
function showMap() {
  const wrap = el('div');
  wrap.append(el('p', 'lede', !hasDriven ? '黃色圓圈是路邊的轎車，白色箭頭是你的位置。先找到代步工具，再設定探索路標。' : active ? '黃色圓圈是目前導航地點。需要修車時可選修車廠，委託會保留。' : '選一個地點設定路標；沿著街道自由探索。白色箭頭是你的位置。'));
  const canvas = el('canvas', 'map-large'); canvas.width = 640; canvas.height = 640; canvas.setAttribute('aria-label', '禾多市完整地圖');
  wrap.append(canvas);
  wrap.append(el('p', 'map-legend', '△ 你的位置　 ■ 紫色：私人車庫／愛車　 ■ 薄荷綠：修車廠　 ● 黃色：委託／路標　 ◆ 紅藍：警車　 ◌ 橘色：最後目擊位置'));
  const list = el('div', 'map-locations');
  LOCATIONS.forEach(place => list.append(button(place.name, targetPlace()?.id === place.id ? 'selected' : '', () => {
    if(place.id==='racing'){showRaces();return;}
    if(raceLive()){showRaces('賽事進行中，路線已標記。');return;}
    if(place.id==='garage'){showGarage();return;}
    if(place.id==='collection'){showCollection();return;}
    if (!hasDriven) { notify('先走向黃色圓圈，接手路邊的轎車。'); panel.close(); return; }
    if (active) { notify('目前正在委託中，請先前往黃色交接點。'); panel.close(); return; }
    waypoint = place.id; panel.close(); updateHud(); notify(`路標已設為「${place.name}」。`);
  })));
  wrap.append(list); openPanel('禾多市漫遊圖', 'CITY MAP / 十個地點', wrap); drawMap(canvas, true);
}
function interact() {
  if (!started || panel.open || transition) return;
  if(raceLive()){showRaces();return;}
  if(raceDistance()<=8){showRaces();return;}
  if(collectionDistance()<=8){showCollection();return;}
  if(garageDistance()<=8){showGarage();return;}
  if(!active)return;
  const destination=locationById(active.mission[active.stage==='pickup'?'pickup':'dropoff']);
  if(Math.hypot(actor.x-destination.x,actor.z-destination.z)>11)return;
  if (police.level > 0) { notify('先甩開警察、解除通緝，再和同事交接。'); return; }
  if (Math.abs(actor.speed) >= 4) { notify('先煞停，再慢慢交接。'); return; }
  clearInput(); actor.speed = 0;
  if (walking) { actor.vx = 0; actor.vz = 0; }
  if (active.stage === 'pickup') {
    active.stage = 'dropoff';waypoint=null;
    notify(`已完成取件，接著前往${locationById(active.mission.dropoff).name}。`);
    updateHud(); return;
  }
  const mission = active.mission;
  const previous = progress.money;
  progress = completeMission(progress, mission.id);
  const saved = storage && saveProgress(storage, progress);
  active = null; waypoint = null; updateHud();
  const wrap = el('div');
  wrap.append(el('div', 'result-badge', '✓'), el('p', 'result-person', `${mission.person} 的訊息`), el('p', 'result-message', mission.completion));
  const reward = el('div', 'result-reward', '城市基金'); reward.append(el('strong', '', `+$ ${progress.money - previous}`)); wrap.append(reward);
  if (progress.completed.length === MISSIONS.length) wrap.append(el('p', 'lede', '六個委託都完成了。下班路線由你決定，整座城市仍然開放。'));
  if (!saved) wrap.append(el('p', 'help-note', '瀏覽器目前無法儲存。這次進度會保留在頁面中，關閉頁面後可能遺失。'));
  wrap.append(button('繼續漫遊 ↗', 'primary', () => panel.close()));
  if (progress.completed.length < MISSIONS.length) wrap.append(button('看看下一通來電', 'text-btn', showJobs));
  openPanel('順便，也是一門專業。', 'MISSION COMPLETE / 委託完成', wrap);
  $('welcome-save').textContent = `已完成 ${progress.completed.length} / ${MISSIONS.length} 個委託 · 本機進度`;
}
function currentCar() { return fleet.find(car => car.id === controlledId) || null; }
function nearbyCar() { return walking && !transition ? findNearbyCar(fleet, actor) : null; }
function nearbyUnavailableCar() {
  return walking&&!transition?fleet.find(car=>['burning','wreck'].includes(car.damageStage)&&Math.hypot(car.x-actor.x,car.z-actor.z)<5.5):null;
}
function vehicleBounds(car) {
  const sin = Math.abs(Math.sin(car.heading)), cos = Math.abs(Math.cos(car.heading));
  return {x:car.x,z:car.z,w:cos*2.05+sin*4.15,d:sin*2.05+cos*4.15,vehicleId:car.id};
}
function carObstacles(excludeId = controlledId) {
  return [...fleet, ...police.units, ...raceCars()].filter(car => car.id !== excludeId).map(vehicleBounds);
}
function touchingPolice(position) {
  // Include the swept vehicle radius and a tiny tolerance at the exact contact
  // boundary. A nearby patrol alone does not make a wall crash a police crash.
  return police.units.some(unit => {
    const bounds = vehicleBounds(unit), radius = 1.5 + 1e-6;
    return Math.abs(position.x-bounds.x)<=bounds.w/2+radius
      && Math.abs(position.z-bounds.z)<=bounds.d/2+radius;
  });
}
function safeExit(car) {
  const obstacles = [...BUILDINGS, ...carObstacles(car.id)];
  for (const [side, back] of [[-2.9,0],[2.9,0],[-2.9,3],[2.9,3],[0,3.4]]) {
    const x=car.x+Math.cos(car.heading)*side-Math.sin(car.heading)*back;
    const z=car.z+Math.sin(car.heading)*side+Math.cos(car.heading)*back;
    if (Math.abs(x) < WORLD_LIMIT-.6 && Math.abs(z) < WORLD_LIMIT-.6
      && !obstacles.some(b=>Math.abs(x-b.x)<b.w/2+.55&&Math.abs(z-b.z)<b.d/2+.55)) return {x,z,heading:car.heading};
  }
  return null;
}
function switchVehicle() {
  if (!started || panel.open || transition) return;
  if (!walking) {
    if (Math.abs(actor.speed) > 2.2) { notify(controlHint('先用 S 或手煞車停穩，再按 F 下車。', '先按住右下「手煞車」停穩，再點「下車」。')); return; }
    const car = currentCar(), to = car && safeExit(car);
    if (!car || !to) { notify('車門被擋住了，往前挪一點再下車。'); return; }
    abortRace('left-vehicle');
    actor.speed=0; fleet=parkCar(fleet,controlledId,actor);
    transition={carId:controlledId,kind:'exit',progress:0,duration:.55,from:{...actor},to};
  } else {
    const car=nearbyCar();
    if (!car) {
      const unavailable=nearbyUnavailableCar();
      notify(unavailable?unavailable.damageStage==='burning'?'車輛正在起火，無法上車！請立刻遠離。':'這輛車已報廢，請換一輛車。':controlHint('走近車門，等車停下來再按 F。', '走近車門，等車停下來再點「搶車」或「上車」。'));return;
    }
    if (actor.y > .15) { notify('落地後再接手車輛。'); return; }
    transition={carId:car.id,kind:car.occupied?'steal':'enter',progress:0,duration:car.occupied?1.1:.65,from:{...actor},wasStolen:car.stolen,wasOccupied:car.occupied};
    actor={...actor,speed:0,vx:0,vz:0};
    fleet=fleet.map(item=>item.id===car.id?{...item,speed:0}:item);
  }
  clearInput(); updateHud();
}
function finishTransition() {
  const action=transition, car=fleet.find(item=>item.id===action.carId);
  transition=null;
  if (!car) { walking=true;controlledId=null;actor=createPedestrian(FOOT_SPAWN);return; }
  if (action.kind!=='exit' && ['burning','wreck'].includes(car.damageStage)) {
    walking=true;controlledId=null;actor=createPedestrian(action.from);
    clearInput();updateHud();notify('這輛車已無法駕駛，先遠離車身。');return;
  }
  if (action.kind==='exit') {
    const to=safeExit(car);
    if (!to) {
      walking=false;controlledId=car.id;actor=createVehicle({...car,speed:0});
      clearInput();updateHud();notify('車門被擋住了，先挪開車再試一次。');return;
    }
    fleet=parkCar(fleet,car.id,actor);controlledId=null;walking=true;
    actor=createPedestrian(to);cameraPitch=.34;
  } else {
    fleet=takeCar(fleet,car.id);controlledId=car.id;walking=false;
    actor=createVehicle({...car,speed:0}); cameraPitch=.28;
    if (!car.owned && !action.wasStolen) {
      police=reportCrime(police,{type:'theft',position:{x:actor.x,z:actor.z}});
      notify(action.wasOccupied?'車主報警了！已接手 '+car.name+'，警車正在趕來。':'車輛失竊警報！已接手 '+car.name+'，警車正在趕來。');
    } else notify(car.owned?'開上自己的 '+car.name+'。一路順風。':'再次上車：'+car.name+'。');
    if(car.owned&&waypoint==='owned-car')waypoint=null;
    hasDriven=true;
  }
  clearInput();updateHud();
}
function resetSession() {
  race=createRaceState();raceProof=null;raceBest=null;raceSplit=null;raceBeforeRecords=null;raceDailyGoal=null;
  flushOwnedHealth(true);
  actor=createPedestrian(FOOT_SPAWN);fleet=applyGarageCustomizations(createFleet(),progress);controlledId=null;transition=null;
  crowd=createCrowd();awareness=createAwareness();
  vehicleDamage=createVehicleDamageState();
  walking=true;hasDriven=false;active=null;waypoint=null;police=createPoliceState();pendingArrest=false;lastImpact=-10;cameraYaw=0;cameraPitch=.34;accumulator=0;
  combat=createCombatState();combatants=[];pendingDeath=false;aiming=false;
  document.body.classList.add('on-foot');needsRender=true;
}
function reset() {
  if (!started || panel.open) return;
  if (police.level > 0) { notify('通緝中無法回到路邊。繞過街角、躲開警方視線，先甩掉追捕。'); return; }
  abortRace('cancelled');
  if (controlledId) fleet=parkCar(fleet,controlledId,actor);
  controlledId=null;transition=null;actor=createPedestrian(FOOT_SPAWN);walking=true;
  cameraYaw=0;cameraPitch=.34;clearInput();updateHud();
  notify('已回到總部路邊。車留在原處，委託仍保留；可以另找一輛車。');
}
function handleArrest() {
  if (pendingArrest||pendingDeath) return;
  abortRace('busted',false);
  pendingArrest=true;transition=null;actor.speed=0;
  if (walking) { actor.vx=0;actor.vz=0; }
  clearInput();
  const wrap=el('div');
  wrap.append(el('div','busted-stamp','BUSTED'),el('p','lede',controlledId?'警方包圍了車輛，這輛車被扣留了。你將以行人回到禾多總部路邊。':'你被警察攔下了。你將以行人回到禾多總部路邊。'));
  wrap.append(el('p','help-note',active?'手上的委託仍保留。找一輛代步工具，或徒步繼續送件；完成紀錄與城市基金不變。':'完成紀錄與城市基金仍保留。重新找車、接委託，或者先在街上走走。'));
  wrap.append(button('回到街頭 ↗','primary',()=>panel.close()));
  openPanel('這次，沒甩掉。','BUSTED / 遭到逮捕',wrap);
  updateHud();
}
function recoverFromArrest() {
  flushOwnedHealth(true);
  if (controlledId) fleet=fleet.filter(car=>car.id!==controlledId);
  if(waypoint==='owned-car'&&!fleet.some(isOwnedVehicle))waypoint='collection';
  controlledId=null;transition=null;pendingArrest=false;police=createPoliceState();
  actor=createPedestrian(FOOT_SPAWN);walking=true;cameraYaw=0;cameraPitch=.34;lastImpact=-10;
  combat=createCombatState();combatants=[];
  awareness={...awareness,threats:[]};
  clearInput();updateHud();
  notify('已返回總部路邊。通緝解除，委託和完成進度保留。');
}
function handleDeath() {
  if(pendingDeath)return;
  abortRace('dead',false);
  pendingDeath=true;pendingArrest=false;transition=null;
  actor.speed=0;if(walking){actor.vx=0;actor.vz=0;}
  clearInput();
  const wrap=el('div','death-content');
  wrap.append(el('div','wasted-stamp','WASTED'),el('p','lede','你倒下了，但今天的故事還沒結束。'));
  wrap.append(el('p','help-note','重生後回到總部路邊，以滿血行人重新出發，通緝解除、彈藥補滿。手上的委託、完成紀錄與城市基金都保留。'));
  wrap.append(button('重新出發 ↗','primary',()=>panel.close()));
  openPanel('這座城市，還有明天。','WASTED / 生命歸零',wrap);updateHud();
}
function recoverFromDeath() {
  flushOwnedHealth(true);
  if(controlledId)fleet=parkCar(fleet,controlledId,actor);
  controlledId=null;transition=null;pendingDeath=false;pendingArrest=false;
  actor=createPedestrian(FOOT_SPAWN);walking=true;police=createPoliceState();
  combat=createCombatState();combatants=[];cameraYaw=0;cameraPitch=.34;lastImpact=-10;
  awareness={...awareness,threats:[]};
  clearInput();updateHud();needsRender=true;
  notify('已重生。血量與彈藥恢復，委託和獎勵保留。');
}
function updateCombatHud() {
  const id=combat.weaponId,weapon=combat.weapons[id],armed=id!=='unarmed';
  const enabled=walking&&!transition&&!combat.dead&&!panel.open;
  document.body.dataset.weapon=id;
  document.body.dataset.aiming=String(aiming&&enabled);
  document.body.dataset.reloading=String(Boolean(combat.reload));
  document.body.dataset.health=combat.health<=30?'critical':'healthy';
  document.body.dataset.dead=String(combat.dead);
  setText('health-value',String(Math.ceil(combat.health)));
  $('health-bar').style.width=clamp(combat.health,0,100)+'%';
  $('health-meter').setAttribute('aria-valuenow',String(Math.ceil(combat.health)));
  setText('weapon-name',WEAPON_LABELS[id]);
  setText('ammo-mag',weapon?String(weapon.mag).padStart(2,'0'):'—');
  setText('ammo-reserve',weapon?String(weapon.reserve):'—');
  setText('ammo-hint',!walking?'駕駛中 · 武器已收起':!armed?controlHint('Tab 選武器 · Q 快速切換','點「武器」選擇裝備'):combat.reload?'換彈中…':!weapon.mag&&!weapon.reserve?'彈藥耗盡 · 回總部補給':controlHint('R 換彈 · 右鍵瞄準','瞄準 · 按住射擊'));
  const fraction=combat.reload?1-combat.reload.remaining/combat.reload.total:0;
  $('reload-progress').hidden=!combat.reload;
  $('reload-progress').setAttribute('aria-valuenow',String(Math.round(fraction*100)));
  $('reload-bar').style.width=clamp(fraction*100,0,100)+'%';
  $('fire').disabled=!enabled||!armed||Boolean(combat.reload);
  $('aim-toggle').disabled=!enabled||!armed;
  $('aim-toggle').setAttribute('aria-pressed',String(aiming));
  $('reload').disabled=!enabled||!armed||Boolean(combat.reload)||!weapon?.reserve;
  $('weapon-switch').disabled=Boolean(transition)||combat.dead;
}
function updateCombatEffects() {
  const crosshair=$('crosshair');
  if(!crosshair)return;
  const visible=started&&walking&&combat.weaponId!=='unarmed'&&!panel.open&&!transition&&!combat.dead;
  const point=scene?.projectAimPoint?.(combat.aimPoint);
  crosshair.hidden=!visible||Boolean(point&&!point.visible);
  if(point?.visible){crosshair.style.left=(point.x*100)+'%';crosshair.style.top=(point.y*100)+'%';}
  $('hit-marker').classList.toggle('visible',visible&&combat.hitMarker>0);
  if(point?.visible){$('hit-marker').style.left=(point.x*100)+'%';$('hit-marker').style.top=(point.y*100)+'%';}
  $('damage-vignette').style.opacity=String(combat.dead?0:Math.min(.65,combat.damageFlash||0));
}
function updateWantedHud() {
  const phase=police.phase,level=police.level;
  document.body.dataset.wanted=phase;
  setText('heat','★'.repeat(level)+'☆'.repeat(5-level));
  $('heat').setAttribute('aria-label','通緝 '+level+' 星');
  const arresting=police.arrestProgress>0;
  const labels={clear:'',dispatch:'警方出動',pursuit:'警方追捕',search:'警方搜索',busted:'遭到逮捕'};
  setText('heat-status',arresting&&phase!=='busted'?'即將被捕 · 快離開':labels[phase]||'');
  const hint=phase==='dispatch'?'警車正趕往現場':phase==='pursuit'?(arresting?'持續移動，拉開距離':'轉過街角，避開視線'):phase==='search'?'保持隱蔽 · '+Math.max(1,Math.ceil(police.searchRemaining))+' 秒降一星':phase==='busted'?'車輛將被扣留':'';
  setText('wanted-hint',hint);
  const meter=$('wanted-meter'),fraction=arresting?police.arrestProgress:police.escapeProgress;
  meter.hidden=!(arresting||phase==='search');
  meter.dataset.kind=arresting?'arrest':'escape';
  meter.setAttribute('aria-label',arresting?'逮捕進度':'解除一顆通緝星的進度');
  meter.setAttribute('aria-valuenow',Math.round(fraction*100));
  $('wanted-bar').style.width=Math.round(fraction*100)+'%';
  $('reset').disabled=level>0;
  $('reset').title=level>0?'通緝中無法回到路邊':'以行人回到總部路邊';
}
function updateHud() {
  const target=targetPlace(),distance=targetDistance(),car=currentCar(),near=nearbyCar();
  document.body.dataset.racing=String(raceLive());
  const garageRoute=hasDriven&&waypoint==='garage',nearGarage=garageDistance()<=8&&!transition;
  const streetOwned=fleet.find(isOwnedVehicle),collectionRoute=waypoint==='collection'||(!hasDriven&&progress.ownedVehicleIds.length&&!streetOwned);
  const ownedRoute=waypoint==='owned-car'||(!hasDriven&&streetOwned&&!collectionRoute),nearCollection=collectionDistance()<=8&&!transition;
  const unavailable=!near?nearbyUnavailableCar():null;
  document.body.classList.toggle('on-foot',walking);
  setText('money','$ '+progress.money.toLocaleString('en-US'));
  setText('completed',progress.completed.length+' / '+MISSIONS.length);
  setText('speed',walking?(actor.speed>5.4?'RUN':'WALK'):String(Math.round(Math.abs(actor.speed)*3.6)).padStart(3,'0'));
  setText('speed-unit',walking?'ON FOOT':'KM/H');
  setText('drive-mode',walking?'街頭行人':car?.name||'駕駛中');
  const label=transition?'接手中…':walking?(near?(near.occupied?'搶車':'上車'):unavailable?unavailable.damageStage==='burning'?'車輛起火':'車已報廢':'靠近車輛'):'下車';
  setText('vehicle-button-label',label);
  $('enter-exit').disabled=Boolean(transition)||(walking&&!near);
  $('vehicle-action').hidden=!near||Boolean(transition);
  if(near) $('vehicle-action').querySelector('span').textContent=(near.occupied?'搶走 ':'上車 · ')+near.name;
  updateWantedHud();
  updateCombatHud();
  updateVehicleHud(car,near||unavailable);
  const closest=LOCATIONS.reduce((best,place)=>Math.hypot(actor.x-place.x,actor.z-place.z)<Math.hypot(actor.x-best.x,actor.z-best.z)?place:best,LOCATIONS[0]);
  setText('district',closest.name);
  setText('mission-kicker',collectionRoute||ownedRoute?'MOTOR CLUB':!hasDriven?'STREET START':garageRoute?'HEDO CUSTOMS':active?active.mission.person+' 的委託':'OFF THE CLOCK');
  setText('mission-title',collectionRoute?'前往私人車庫':ownedRoute?'愛車正在等你。':!hasDriven?'先找一輛代步工具。':garageRoute?'前往禾多修車廠':active?active.mission.title:target?'前往'+target.name:progress.completed.length===MISSIONS.length?'今天，真的下班了。':'你的車，你的下班路。');
  setText('mission-detail',collectionRoute?controlHint('步行或開車到紫色服務區，按 E 買車或取出愛車。','走到紫色服務區，點「私人車庫」買車或取出愛車。'):ownedRoute?controlHint('沿路標走近愛車，按 F 上車，不會觸發失竊通緝。','沿路標走近愛車，點「上車」，不會觸發失竊通緝。'):!hasDriven?controlHint('B 查看私人車庫買車；也可走近街上的車，按 F 接手。','點「車庫」選購愛車；也可走近街上的車，點「搶車」。'):garageRoute?controlHint('開進綠色服務格，停穩後按 E 進廠。','開進綠色服務格，停穩後點「進廠改裝」。'):active?(active.stage==='pickup'?'先到':'送往')+target.name+controlHint('，停穩後按 E 交接。','，停穩後點取件／交付。'):target?'跟著小地圖的黃色圓圈，沿街道抵達。':controlHint('J 接委託 · B 私人車庫 · G 修車廠','點「委託」接任務，或到車庫收藏愛車。'));
  setText('mission-step',collectionRoute?(active?'委託保留 · 車庫繞道':`我的收藏 ${progress.ownedVehicleIds.length} / 3`):ownedRoute?'你的車，你的下班路。':!hasDriven?'步行 → 買車或接手街頭車輛':garageRoute?(active?'委託保留 · 修車繞道':'REPAIR / PAINT / TUNE'):active?(active.stage==='pickup'?'01 / 02 取件':'02 / 02 交付'):'自由漫遊');
  setText('mission-distance',target?Math.round(distance)+' m':closest.name);
  const missionPlace=active?locationById(active.mission[active.stage==='pickup'?'pickup':'dropoff']):null;
  const ready=missionPlace&&Math.hypot(actor.x-missionPlace.x,actor.z-missionPlace.z)<=11&&!transition;
  $('interact').hidden=!ready||raceLive();
  if(ready)$('interact').querySelector('span').textContent=police.level?'先解除通緝':Math.abs(actor.speed)>=4?'請先煞停':active.stage==='pickup'?'到點取件':'完成交付';
  $('garage-entry').hidden=!nearGarage||raceLive();
  $('collection-entry').hidden=!nearCollection||raceLive();
  $('race-entry').hidden=raceLive()||raceDistance()>8||Boolean(transition);
  if(nearCollection)$('collection-entry').querySelector('span').textContent=police.level?'先解除通緝':!walking&&Math.abs(actor.speed)>PRIVATE_GARAGE_RULES.maxSpeed?'停穩後進車庫':'私人車庫';
  if(nearGarage)$('garage-entry').querySelector('span').textContent=walking?'開車進廠':police.level?'先解除通緝':garageDistance()>GARAGE_RULES.radius?'開進服務格':Math.abs(actor.speed)>GARAGE_RULES.maxSpeed?'停穩後進廠':'進廠改裝';
  if(garageRoute&&garageDistance()<=GARAGE_RULES.radius){notify(controlHint('抵達修車廠。停穩後按 E 進廠。','抵達修車廠。停穩後點「進廠改裝」。'));waypoint=null;}
  else if(waypoint==='collection'&&collectionDistance()<=PRIVATE_GARAGE_RULES.radius){notify(controlHint('抵達私人車庫。按 E 辦理買車、取車或收車。','抵達私人車庫。點「私人車庫」辦理服務。'));waypoint=null;}
  else if(waypoint==='racing'&&raceDistance()<=RACING_RULES.startRadius){notify('抵達發車區。車頭朝東、停穩後按 E 報名。');waypoint=null;}
  else if(!active&&waypoint&&!garageRoute&&!collectionRoute&&distance<5){notify('抵達'+target.name+'。');waypoint=null;}
  $('race-live-delta').hidden=!raceLive()||!raceBest;
  $('race-live-daily').hidden=!raceLive()||!raceDailyGoal;
  if(raceLive()&&raceDailyGoal)setText('race-live-daily','每日目標 ≤ '+recordTime(raceDailyGoal.targetMs)+' · +$'+raceDailyGoal.reward);
  if(raceLive()){
    const definition=RACE_CATALOG.find(item=>item.id===race.raceId),count=definition.checkpoints.length;
    setText('mission-title',race.phase==='countdown'?Math.ceil(race.countdownRemaining)+' · 準備起跑':raceTime(race.elapsed)+' · '+race.rank+'/'+(race.rivals.length+1)+' 名');
    setText('mission-detail',definition.name+' · 檢查點 '+Math.min(count,race.checkpointIndex+1)+' / '+count);
    setText('mission-step',race.phase==='countdown'?'車頭朝東 · 等待綠燈':'剩餘 '+Math.max(0,Math.ceil(definition.timeLimit-race.elapsed))+' 秒');
    setText('mission-distance',Math.round(distance)+' m');
    if(raceBest){setText('race-live-delta',raceSplit?'第 '+(raceSplit.index+1)+' 段 · '+recordDelta(raceSplit.deltaMs):'最佳目標 '+recordTime(raceBest.elapsedMs));$('race-live-delta').dataset.ahead=String(Boolean(raceSplit&&raceSplit.deltaMs<=0));}
  }else if(waypoint==='racing'){setText('mission-title','前往街頭發車區');setText('mission-detail','開自己的車前往，停穩後報名。原廠車也能參加。');setText('mission-step','T 查看賽事 · E 報名');}
  setText('drive-hint',walking?(combat.weaponId==='unarmed'?'WASD 移動 · Shift 奔跑 · F 搶車 · Tab 武器':'左鍵／X 射擊 · 右鍵／Z 瞄準 · R 換彈 · Q 換武器'):'W 油門 · S 煞車／倒車 · A/D 轉向 · Space 手煞車 · F 下車');
  const brake=document.querySelector('[data-control="brake"]'),boost=document.querySelector('[data-control="boost"]');
  const brakeLabel=walking?'跳躍':'手煞車',boostLabel=walking?'奔跑 ↗':'加速 ↗';
  if(brake.textContent!==brakeLabel){brake.textContent=brakeLabel;brake.setAttribute('aria-label',brakeLabel);}
  if(boost.textContent!==boostLabel){boost.textContent=boostLabel;boost.setAttribute('aria-label',walking?'奔跑':'加速');}
  $('takeover-progress').hidden=!transition;
  if(transition){setText('takeover-label',transition.kind==='steal'?'打開車門，接手駕駛':transition.kind==='exit'?'下車':'上車');$('takeover-bar').style.width=transition.progress*100+'%';}
  drawMap($('minimap'));
}
function updateVehicleHud(car,near) {
  const aimed = walking && combat.weaponId!=='unarmed' && combat.aimPoint?.kind==='vehicle'
    ? [...fleet,...police.units].find(item=>item.id===combat.aimPoint.targetId) : null;
  const inspected = car || aimed || near;
  const status=$('vehicle-status');status.hidden=!inspected;
  if(!inspected)return;
  const stage=inspected.damageStage||'intact',health=clamp(inspected.vehicleHealth??100,0,100);
  status.dataset.stage=stage;
  const labels={intact:'車況良好',damaged:'車身受損',smoking:'引擎冒煙',burning:car?'起火 · 立即下車':'起火 · 立即遠離',wreck:'殘骸 · 無法駕駛'};
  setText('vehicle-condition',labels[stage]||labels.intact);
  setText('vehicle-health',stage==='burning'?Math.max(0,inspected.burnRemaining||0).toFixed(1)+'s':Math.floor(health)+'%');
  $('vehicle-health-meter').setAttribute('aria-label',inspected.name+' 車輛耐久');
  $('vehicle-health-meter').setAttribute('aria-valuenow',String(Math.floor(health)));
  $('vehicle-health-bar').style.width=health+'%';
}
function toggleSound() {
  if (!audio) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) { notify('這個瀏覽器目前不支援音效。'); return; }
    try {
      audio = new AudioContext(); tone = audio.createOscillator(); volume = audio.createGain();
      tone.type = 'triangle'; tone.frequency.value = 45; volume.gain.value = 0;
      tone.connect(volume); volume.connect(audio.destination); tone.start();
      sirenTone=audio.createOscillator();sirenVolume=audio.createGain();
      sirenTone.type='sine';sirenTone.frequency.value=650;sirenVolume.gain.value=0;
      sirenTone.connect(sirenVolume);sirenVolume.connect(audio.destination);sirenTone.start();
    } catch { notify('目前無法啟動音效。'); return; }
  }
  soundEnabled = !soundEnabled; audio.resume().catch(() => {});
  $('sound').setAttribute('aria-pressed', String(soundEnabled));
  $('sound').setAttribute('aria-label', soundEnabled ? '關閉遊戲音效' : '開啟遊戲音效');
  notify(soundEnabled ? '遊戲音效已開啟：引擎、警笛、射擊與爆炸。' : '遊戲音效已關閉。');
}
function playShot(policeShot=false) {
  if(!soundEnabled||!audio||panel.open||document.hidden)return;
  const voice=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  voice.type='triangle';voice.frequency.setValueAtTime(policeShot?140:190,now);
  voice.frequency.exponentialRampToValueAtTime(42,now+.075);
  gain.gain.setValueAtTime(policeShot ? .028 : .055,now);
  gain.gain.exponentialRampToValueAtTime(.0001,now+.09);
  voice.connect(gain);gain.connect(audio.destination);voice.start(now);voice.stop(now+.1);
  voice.onended=()=>{voice.disconnect();gain.disconnect();};
}
function playExplosion(position) {
  if(!soundEnabled||!audio||panel.open||document.hidden)return;
  const strength=clamp(1-Math.hypot(position.x-actor.x,position.z-actor.z)/80,0,1);
  if(!strength)return;
  const voice=audio.createOscillator(),gain=audio.createGain(),now=audio.currentTime;
  voice.type='sawtooth';voice.frequency.setValueAtTime(88,now);voice.frequency.exponentialRampToValueAtTime(24,now+.32);
  gain.gain.setValueAtTime(.065*strength,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.38);
  voice.connect(gain);gain.connect(audio.destination);voice.start(now);voice.stop(now+.4);
  voice.onended=()=>{voice.disconnect();gain.disconnect();};
}
function updateVehicleDamage(dt,hits,collisions) {
  const result=stepVehicleDamage(vehicleDamage,{vehicles:[...fleet,...police.units,...raceCars()],hits,collisions,player:actor,controlledId,obstacles:BUILDINGS},dt);
  vehicleDamage=result.state;
  fleet=result.vehicles.filter(car=>car.kind!=='police'&&car.kind!=='racer');
  if(raceLive())race={...race,rivals:result.vehicles.filter(car=>car.kind==='racer')};
  scheduleOwnedHealthSave();
  police={...police,units:result.vehicles.filter(car=>car.kind==='police').map(unit=>unit.damageStage==='wreck'&&!unit.disabled
    ? {...unit,disabled:true,disabledAt:police.time,siren:false,speed:0,route:[]} : unit)};
  if(result.playerDamage>0)combat=applyDamage(combat,result.playerDamage);
  const car=currentCar();
  if(car&&['burning','wreck'].includes(car.damageStage))actor={...actor,speed:0,steerAngle:0,yawVelocity:0};
  const events=[];
  for(const event of vehicleDamage.events){
    if(event.type==='vehicleBurning'&&event.vehicleId===controlledId)notify(controlHint('車輛起火！按 F 下車，立刻遠離車身。','車輛起火！點「下車」，立刻遠離車身。'));
    if(event.type==='vehicleExploded'){
      events.push({type:'explosion',position:event.position});
      police=reportCrime(police,{type:'explosion',position:event.position});
      playExplosion(event.position);
      if(Math.hypot(event.position.x-actor.x,event.position.z-actor.z)<70)notify('車輛爆炸！路人正在逃離，警方已接獲報案。');
    }
  }
  if(transition&&transition.kind!=='exit'&&fleet.some(car=>car.id===transition.carId&&['burning','wreck'].includes(car.damageStage))){
    actor=createPedestrian(transition.from);transition=null;walking=true;controlledId=null;clearInput();notify('車輛起火，無法上車！立刻遠離。');
  }
  return events;
}
function simulate(dt, controls) {
  if(pendingArrest||pendingDeath||panel.open)return;
  time += dt;
  fleet=stepFleet([...fleet,...police.units,...raceCars()],dt,{controlledId,reservedId:transition?.carId,player:walking?actor:null,pedestrians:crowd,threats:awareness.threats}).filter(car=>car.kind!=='police'&&car.kind!=='racer');
  if(!started){
    awareness=stepAwareness(awareness,[],dt);
    crowd=stepCrowd(crowd,dt,{vehicles:fleet});
    return;
  }
  const cityEvents=[],collisions=[];
  aiming=walking&&combat.weaponId!=='unarmed'&&!transition&&Boolean(controls.aiming);
  if(transition){
    transition.progress=Math.min(1,transition.progress+dt/transition.duration);
    if(transition.progress>=1)finishTransition();
  } else {
    const obstacles=[...BUILDINGS,...carObstacles()];
    if(walking){
      actor=stepPedestrian(actor,{forward:controls.forward*(aiming ? .58 : 1),right:controls.right*(aiming ? .58 : 1),cameraYaw,sprint:controls.sprint&&!aiming,jump:pendingJump},dt,obstacles);
      if(aiming||controls.fire)actor.heading=cameraYaw;
      pendingJump=false;
    } else {
      const disabled=['burning','wreck'].includes(currentCar()?.damageStage);
      actor=disabled?{...actor,speed:0,impact:false,impactSpeed:0}:stepVehicle(actor,{throttle:race.phase==='countdown'?0:controls.forward,steer:race.phase==='countdown'?0:controls.right,brake:race.phase==='countdown'||controls.brake,boost:race.phase!=='countdown'&&controls.sprint,tuning:currentCar()?.upgrades},dt,obstacles);
      fleet=fleet.map(car=>car.id===controlledId?{...car,...actor}:car);
      if(actor.impact)collisions.push({vehicleId:controlledId,otherId:actor.impactVehicleId,speed:actor.impactSpeed});
      if(actor.impact&&actor.impactSpeed>5&&time-lastImpact>2.5){
        const hitPolice=touchingPolice(actor);
        police=reportCrime(police,{type:hitPolice?'police-collision':'collision',position:{x:actor.x,z:actor.z}});
        combat=applyDamage(combat,Math.min(30,Math.max(0,(actor.impactSpeed-8)*1.5)));
        cityEvents.push({type:'collision',position:{x:actor.x,z:actor.z}});
        lastImpact=time;
        notify(hitPolice?'撞上警車！警方呼叫支援，通緝升高。':'碰撞引來報案！通緝升高，先離開現場。');
      }
      if(time>lookUntil&&Math.abs(actor.speed)>1.8){
        cameraYaw+=angleDelta(actor.heading,cameraYaw)*(1-Math.exp(-dt*2.6));
        cameraPitch+=(.28-cameraPitch)*(1-Math.exp(-dt*1.2));
      }
    }
  }
  const previousPhase=police.phase,previousLevel=police.level;
  const disabledUnitIds=[...Object.entries(combat.officers).filter(([,officer])=>officer.down).map(([id])=>id),...police.units.filter(unit=>unit.damageStage==='wreck').map(unit=>unit.id)];
  police=stepPolice(police,{player:actor,walking,obstacles:BUILDINGS,traffic:[...fleet,...raceCars()],disabledUnitIds,armedHostile:combat.hostile||police.level>=2},dt);
  const combatInput={player:actor,walking,controlledId,aiming,fire:!transition&&Boolean(controls.fire),aimYaw:cameraYaw,police,obstacles:BUILDINGS,traffic:[...fleet,...raceCars()],enabled:true};
  combat=stepCombat(combat,combatInput,dt);
  for(const event of combat.events){
    if(event.type==='crime')police=reportCrime(police,{type:event.crime,position:event.position});
    if(event.type==='shot')playShot(event.shooter==='police');
    if(event.type==='unitDown')notify('警員失去戰鬥能力。支援仍會到場，趁現在拉開距離。');
  }
  cityEvents.push(...updateVehicleDamage(dt,combat.events,collisions));
  combatants=getPoliceCombatants(police,combat,BUILDINGS,fleet);
  awareness=stepAwareness(awareness,[...cityEvents,...combat.events],dt);
  crowd=stepCrowd(crowd,dt,{threats:awareness.threats,vehicles:[...fleet,...police.units,...raceCars()],player:walking?actor:null});
  if(combat.dead){handleDeath();return;}
  if(police.phase==='busted'){handleArrest();return;}
  advanceRace(dt);
  if(panel.open)return;
  if(controls.fire&&walking&&combat.weaponId!=='unarmed'&&!combat.reload&&combat.weapons[combat.weaponId].mag===0&&time-lastWeaponHint>2.5){
    lastWeaponHint=time;reloadWeapon();
  }
  if(previousPhase!==police.phase){
    if(police.phase==='search')notify('警方正搜索最後目擊位置。保持隱蔽，通緝才會下降。');
    else if(police.phase==='pursuit')notify(previousPhase==='search'?'又被發現了！搜索倒數中斷，警方重新追捕。':police.seen?'警車發現你了！轉過街角，利用建物甩開視線。':'巡邏車已出動，正在趕往現場。');
    else if(police.phase==='clear'&&previousLevel>0)notify('成功甩掉警察！通緝解除，可以繼續接委託。');
  } else if(police.level<previousLevel&&police.level>0)notify('甩開了一部分警力。繼續躲藏，剩下 '+police.level+' 顆通緝星。');
}
function tick(now) {
  const dt=lastFrame?Math.min((now-lastFrame)/1000,.25):0;
  lastFrame=now;
  const paused=document.hidden||panel.open;
  if(!paused){
    const controls=input?.read()||{forward:0,right:0,sprint:false,brake:false,jump:false};
    pendingJump=pendingJump||controls.jump;
    accumulator+=dt;
    while(accumulator>=fixedStep){simulate(fixedStep,controls);accumulator-=fixedStep;}
  } else {accumulator=0;pendingJump=false;}
  if(scene&&!document.hidden&&(!paused||needsRender)){
    scene.update(actor,{time,dt:paused?0:dt,walking,controlledId,fleet:[...fleet,...police.units,...raceCars()],race:{active:raceLive(),countdown:race.phase==='countdown'?race.countdownRemaining:0,checkpoint:race.checkpoint,route:race.route},crowd,vehicleDamage,transition,cameraYaw,cameraPitch,lookActive:time<lookUntil,quality,night:false,target:targetPlace(),heat:police.level,cinematic:!started,cameraMode,selectedCarId:nearbyCar()?.id,combat,combatants,aiming,aimYaw:cameraYaw});
    needsRender=false;
  }
  updateCombatEffects();
  if(now-lastHud>100&&started&&!document.hidden){updateHud();lastHud=now;}
  if(audio&&volume){
    const audible=soundEnabled&&started&&!walking&&!paused;
    volume.gain.setTargetAtTime(audible ? .022+Math.min(Math.abs(actor.speed)/800,.03):0,audio.currentTime,.1);
    tone.frequency.setTargetAtTime(42+Math.abs(actor.speed)*3,audio.currentTime,.08);
    if(sirenTone&&sirenVolume){
      const distance=police.units.reduce((nearest,unit)=>unit.siren===false?nearest:Math.min(nearest,Math.hypot(unit.x-actor.x,unit.z-actor.z)),Infinity);
      const sirenAudible=soundEnabled&&started&&!paused&&police.level>0&&distance<75;
      sirenVolume.gain.setTargetAtTime(sirenAudible ? .018*(1-distance/90) : 0,audio.currentTime,.12);
      sirenTone.frequency.setTargetAtTime(650+220*Math.sin(time*5),audio.currentTime,.04);
    }
  }
  raf=requestAnimationFrame(tick);
}
function focusGame(){if(started&&!panel.open)$('city').querySelector('canvas')?.focus({preventScroll:true});}
$('start').addEventListener('click',()=>{
  if(!scene)return;
  started=true;clearInput();$('welcome').hidden=true;$('hud').hidden=false;
  document.body.classList.add('playing','on-foot');updateHud();focusGame();
  notify(controlHint('行人開局。WASD 移動，B 私人車庫買車／取車，F 上下車；Tab 選武器。', '左下搖桿移動，右側滑動轉視角。點「車庫」買車／取車，靠近車門可上車。'));
});
$('close-panel').addEventListener('click',()=>panel.close());
panel.addEventListener('close',()=>{
  document.body.classList.remove('paused');clearInput();lastFrame=performance.now();accumulator=0;needsRender=true;
  if(pendingDeath)recoverFromDeath();
  else if(pendingArrest)recoverFromArrest();
  if(started)focusGame();else if(restoreFocus?.isConnected&&!restoreFocus.closest('[hidden]'))restoreFocus.focus();
});
panel.addEventListener('click',event=>{if(event.target===panel){const box=panel.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)panel.close();}});
$('help').addEventListener('click',showHelp);$('welcome-help').addEventListener('click',showHelp);
$('races').addEventListener('click',()=>showRaces());$('race-entry').addEventListener('click',()=>showRaces());
$('jobs').addEventListener('click',showJobs);$('open-map').addEventListener('click',showMap);
$('garage-action').addEventListener('click',()=>showGarage());$('garage-entry').addEventListener('click',()=>showGarage());
$('collection-action').addEventListener('click',()=>showCollection());$('collection-entry').addEventListener('click',()=>showCollection());
$('pause').addEventListener('click',showPause);$('interact').addEventListener('click',interact);
$('enter-exit').addEventListener('click',switchVehicle);$('vehicle-action').addEventListener('click',switchVehicle);$('reset').addEventListener('click',reset);
$('weapon-switch').addEventListener('click',showWeapons);
$('reload').addEventListener('click',reloadWeapon);
$('aim-toggle').addEventListener('click',()=>{if(walking&&combat.weaponId!=='unarmed'&&!transition){input?.toggleAim();focusGame();}});
$('camera').addEventListener('click',()=>{cameraMode=cameraMode==='chase'?'aerial':'chase';needsRender=true;notify(cameraMode==='aerial'?'鳥瞰視角':'第三人稱視角');});
$('sound').addEventListener('click',toggleSound);
$('quality').addEventListener('click',()=>{
  quality=quality==='auto'?'low':quality==='low'?'high':'auto';needsRender=true;
  const labels={auto:'自動',low:'省電',high:'細緻'};
  $('quality').title='畫質：'+labels[quality];$('quality').setAttribute('aria-label','畫質 '+labels[quality]+'，點擊切換');
  notify('畫質：'+labels[quality]);focusGame();
});
for(const id of ['enter-exit','vehicle-action','reset','camera','sound'])$(id).addEventListener('click',focusGame);
document.addEventListener('visibilitychange',()=>{flushOwnedHealth(true);clearInput();accumulator=0;if(document.hidden&&started&&!panel.open)showPause();});
window.addEventListener('resize',()=>{scene?.resize();needsRender=true;});
window.addEventListener('pagehide',event=>{
  flushOwnedHealth(true);
  clearInput();input?.unlock();cancelAnimationFrame(raf);if(audio)audio.suspend().catch(()=>{});
  if(!event.persisted){scene?.dispose();input?.dispose();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){lastFrame=0;accumulator=0;needsRender=true;raf=requestAnimationFrame(tick);if(soundEnabled&&audio)audio.resume().catch(()=>{});}});

// Calendar refresh is confined to an open, paused race centre. Driving never
// waits on a network call or replays the progress ledger in its frame loop.
setInterval(()=>{
  if(document.hidden||!panel.open||!$('race-panel')||raceLive())return;
  const dayId=currentRaceCalendar().dayId;
  if(dayId!==calendarViewDay){
    rankingRequest+=1;rankingData=null;rankingMine=null;calendarViewDay=dayId;
    void refreshRaceCalendar(true).then(()=>{if(panel.open&&$('race-panel')&&raceTab==='records')return loadRaceRankings(true);});
    refreshRacePanel();
  } else if(raceTab==='daily')refreshRacePanel();
},30000);

if (progress.completed.length||progress.ownedVehicleIds.length) $('welcome-save').textContent = `已完成 ${progress.completed.length} / ${MISSIONS.length} 個委託 · ${progress.ownedVehicleIds.length} 輛愛車 · 本機進度`;
try {
  const { createCityScene } = await import('./scene.js');
  scene = await createCityScene({ container: $('city'), onReady: () => {} });
  const canvas = $('city').querySelector('canvas');
  if (canvas) {
    canvas.tabIndex = 0;
    input=createGameInput({canvas,joystick:$('move-stick'),knob:$('stick-knob'),lookPad:$('look-pad'),pedals:document.querySelectorAll('.pedals button'),fireButton:$('fire'),
      isActive:()=>started&&!panel.open&&!transition&&!document.hidden&&!combat.dead,isWalking:()=>walking,isArmed:()=>combat.weaponId!=='unarmed',
      onAction:action=>{const actions={vehicle:switchVehicle,interact,reset,reload:reloadWeapon,cycleWeapon,weapons:showWeapons,garage:()=>showGarage(),collection:()=>showCollection(),races:()=>showRaces(),unarmed:()=>equipWeapon('unarmed'),pistol:()=>equipWeapon('pistol'),smg:()=>equipWeapon('smg'),map:showMap,jobs:showJobs,camera:()=>$('camera').click(),pause:showPause};actions[action]?.();},
      onLook:(dx,dy)=>{cameraYaw+=dx*.003*(aiming ? .65 : 1);cameraPitch=clamp(cameraPitch+dy*.0022,.10,1.05);lookUntil=time+1.4;needsRender=true;},
      onUnlock:()=>{if(started&&!panel.open)showPause();}
    });
  }
  $('start').disabled = false; $('start-label').textContent = progress.completed.length ? '繼續城市漫遊' : '進入禾多市';
  raf = requestAnimationFrame(tick);
} catch (error) {
  $('error-message').textContent = '請使用支援 WebGL 的瀏覽器，並開啟硬體加速後重新載入。其他禾多人生模式仍可從首頁進入。';
  $('load-error').hidden = false; $('start-label').textContent = '城市暫時離線';
  console.error('Hedo GTA scene initialization failed:', error.message);
}
