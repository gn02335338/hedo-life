import { ROAD_LINES, WORLD_LIMIT, LOCATIONS, BUILDINGS, MISSIONS } from './world.js';
import { createVehicle, stepVehicle, createPedestrian, stepPedestrian } from './driving.js';
import { createFleet, stepFleet, findNearbyCar, takeCar, parkCar } from './fleet.js';
import { createCrowd, stepCrowd } from './crowd.js';
import { createAwareness, stepAwareness } from './awareness.js';
import { createGameInput } from './input.js';
import { createPoliceState, reportCrime, stepPolice } from './police.js';
import { createCombatState, selectWeapon, startReload, stepCombat, applyDamage, getPoliceCombatants } from './combat.js';
import { freshProgress, loadProgress, saveProgress, completeMission } from './progress.js';

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
let fleet = createFleet(), controlledId = null, transition = null, hasDriven = false;
let crowd = createCrowd(), awareness = createAwareness();
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
let lastFrame = 0, raf = 0, lastHud = 0, toastTimer;
let audio, tone, volume, sirenTone, sirenVolume, soundEnabled = false;
let restoreFocus = null;

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
  if (!hasDriven) { const car = fleet.find(c => c.id === 'starter-sedan'); return car ? { ...car, id:'first-car', name:'路邊的轎車' } : null; }
  if (active) return locationById(active.mission[active.stage === 'pickup' ? 'pickup' : 'dropoff']);
  return waypoint ? locationById(waypoint) : null;
}
function targetDistance() {
  const target = targetPlace(); return target ? Math.hypot(actor.x - target.x, actor.z - target.z) : Infinity;
}
function showJobs() {
  const wrap = el('div');
  if (!hasDriven) {
    wrap.append(el('p', 'lede', controlHint('今天的委託散在整座城。先走到路邊的車旁，按 F 搶車，找到代步工具後再接同事來電。', '今天的委託散在整座城。用左下搖桿走到路邊車旁，點「搶車」，找到代步工具後再接同事來電。')));
    wrap.append(button('先去找車 ↗', 'primary', () => panel.close()));
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
  wrap.append(supply,el('p','supply-note',police.level?'先解除通緝，才能回總部補給。':distance>18?'總部補給點距離 '+Math.round(distance)+' m；回到最初出發的路邊即可補給。':'你在總部補給範圍內。補給不會扣除跑腿基金。'));
  openPanel('隨身裝備','LOADOUT / 武器與補給',wrap);
}
function showHelp() {
  const wrap = el('div');
  wrap.append(el('p', 'lede', controlHint('你從行人開始。先靠近路邊或停等中的車，按 F 接手車輛；之後可以換車、下車探索，或按 J 接委託。', '你從行人開始。用左下搖桿靠近路邊或停等中的車，點「搶車」接手車輛；之後可以換車、下車探索，或點左上「委託」接任務。')));
  const grid = el('div', 'help-grid');
  for (const [label, key] of [['步行／駕駛', 'WASD / 方向鍵'], ['奔跑／加速', 'Shift'], ['跳躍／手煞車', 'Space'], ['搶車／上下車', 'F'], ['任務交接', 'E'], ['轉動視角', '滑鼠 / 右鍵拖曳'], ['武器選單／快速切換', 'Tab / Q'], ['徒手／手槍／衝鋒槍', '1 / 2 / 3'], ['射擊／瞄準', '滑鼠左鍵 / 右鍵'], ['鍵盤射擊／瞄準', 'X / Z'], ['換彈', 'R'], ['城市地圖', 'M'], ['同事委託', 'J'], ['切換視角', 'V / C'], ['回到路邊', 'H'], ['暫停／釋放滑鼠', 'Esc']]) {
    const row = el('div', '', label); row.append(el('kbd', '', key)); grid.append(row);
  }
  wrap.append(grid, el('p', 'help-note', '步行方向跟隨鏡頭，左右鍵直接橫移。點擊街景可鎖定滑鼠轉視角，也可按住右鍵拖曳。開車時 W 油門、S 煞車後倒車、A/D 轉向、Space 手煞車；放開方向鍵會自動回正。'));
  wrap.append(el('p', 'help-note', '手機左側搖桿移動，右半畫面拖曳轉視角；右下是跳躍／煞車和奔跑／加速。靠近慢車才會顯示搶車提示，停穩才可下車。'));
  wrap.append(el('h3','','別忘了，警察也會開槍。'));
  wrap.append(el('p','help-note','按 Tab 或「武器」選擇裝備，Q 快速切換。步行持槍時，先點街景鎖定滑鼠，再按左鍵射擊；右鍵或 Z 瞄準，X 也能射擊，R 換彈。手機點「瞄準」鎖定瞄準姿態，拖右側轉向，按住「射擊」開火。駕駛時會收起武器。'));
  wrap.append(el('p','help-note','開槍會升高通緝；兩星以上警方會武裝反擊。警員先瞄準再射擊，建物與其他車輛能擋住火線。血量低時先躲掩護，解除通緝後回總部，在武器選單補給。血量歸零會顯示 WASTED，可重生為滿血行人，補滿彈藥；委託、完成紀錄與基金都保留。'));
  wrap.append(el('p','help-note','附近路人聽到槍聲會驚嚇、沿人行道逃離，安靜一段時間後才恢復步行。車流會為行人與阻路車輛減速，在空間足夠時側移避讓；連續交火期間會保持戒備。'));
  wrap.append(el('h3', '', '搶得到車，也要甩得掉警察。'));
  wrap.append(el('p', 'help-note', '搶車或高速碰撞會增加通緝星數，撞上警車會引來更多警力。警車會沿街道追捕；紅藍標記是警車，搜索時的橘色圓圈是你最後被目擊的位置。繞過街角、利用建物遮住視線，持續避開警方搜索，星數才會逐顆下降。被看見或再次犯案會中斷倒數。'));
  wrap.append(el('p', 'help-note', '警車靠近時若停住，逮捕進度會上升；持續移動、拉開距離可中斷逮捕。被捕後車輛會被扣留，以行人返回總部，委託、完成紀錄與跑腿基金保留。通緝期間不能使用「回到路邊」或交接委託。'));
  wrap.append(el('p', 'help-note', '存檔保留已完成委託。重新整理或回到路邊會以行人出發，不會免費送車；原本的職涯存檔完全獨立。畫面卡頓時可按右上角 ◈ 切換省電畫質。'));
  wrap.append(button('知道了，出發 ↗', 'primary', () => panel.close()));
  openPanel('你的城市操作手冊', 'HOW TO PLAY', wrap);
}
function showPause() {
  if (!started || panel.open) return;
  const wrap = el('div', 'pause-actions');
  wrap.append(el('p', 'lede', '引擎先休息，這座城市等你回來。'));
  wrap.append(button('繼續漫遊 ↗', 'primary', () => panel.close()));
  wrap.append(button('同事委託', 'secondary', showJobs));
  wrap.append(button('城市地圖', 'secondary', showMap));
  wrap.append(button('武器與補給', 'secondary', showWeapons));
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
  for (const place of LOCATIONS) {
    const [x, y] = point(place.x, place.z);
    context.fillStyle = target?.id === place.id ? '#e5f45b' : '#9eaaa1';
    context.beginPath(); context.arc(x, y, full ? 5 : 3.2, 0, Math.PI * 2); context.fill();
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
    context.fillStyle = car.stolen ? '#f5ba51' : '#90b8c0';
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
  wrap.append(el('p', 'lede', !hasDriven ? '黃色圓圈是路邊的轎車，白色箭頭是你的位置。先找到代步工具，再設定探索路標。' : active ? '黃色圓圈是目前委託的交接地點。白色箭頭是你的位置。' : '選一個地點設定路標；沿著街道自由探索。白色箭頭是你的位置。'));
  const canvas = el('canvas', 'map-large'); canvas.width = 640; canvas.height = 640; canvas.setAttribute('aria-label', '禾多市完整地圖');
  wrap.append(canvas);
  wrap.append(el('p', 'map-legend', '△ 你的位置　 ● 黃色：委託／路標　 ◆ 紅藍：警車　 ◌ 橘色：最後目擊位置'));
  const list = el('div', 'map-locations');
  LOCATIONS.forEach(place => list.append(button(place.name, targetPlace()?.id === place.id ? 'selected' : '', () => {
    if (!hasDriven) { notify('先走向黃色圓圈，接手路邊的轎車。'); panel.close(); return; }
    if (active) { notify('目前正在委託中，請先前往黃色交接點。'); panel.close(); return; }
    waypoint = place.id; panel.close(); updateHud(); notify(`路標已設為「${place.name}」。`);
  })));
  wrap.append(list); openPanel('禾多市漫遊圖', 'CITY MAP / 八個地點', wrap); drawMap(canvas, true);
}
function interact() {
  if (!started || panel.open || transition || !active) return;
  if (targetDistance() > 11) return;
  if (police.level > 0) { notify('先甩開警察、解除通緝，再和同事交接。'); return; }
  if (Math.abs(actor.speed) >= 4) { notify('先煞停，再慢慢交接。'); return; }
  clearInput(); actor.speed = 0;
  if (walking) { actor.vx = 0; actor.vz = 0; }
  if (active.stage === 'pickup') {
    active.stage = 'dropoff';
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
  const reward = el('div', 'result-reward', '跑腿基金'); reward.append(el('strong', '', `+$ ${progress.money - previous}`)); wrap.append(reward);
  if (progress.completed.length === MISSIONS.length) wrap.append(el('p', 'lede', '六個委託都完成了。下班路線由你決定，整座城市仍然開放。'));
  if (!saved) wrap.append(el('p', 'help-note', '瀏覽器目前無法儲存。這次進度會保留在頁面中，關閉頁面後可能遺失。'));
  wrap.append(button('繼續漫遊 ↗', 'primary', () => panel.close()));
  if (progress.completed.length < MISSIONS.length) wrap.append(button('看看下一通來電', 'text-btn', showJobs));
  openPanel('順便，也是一門專業。', 'MISSION COMPLETE / 委託完成', wrap);
  $('welcome-save').textContent = `已完成 ${progress.completed.length} / ${MISSIONS.length} 個委託 · 本機進度`;
}
function currentCar() { return fleet.find(car => car.id === controlledId) || null; }
function nearbyCar() { return walking && !transition ? findNearbyCar(fleet, actor) : null; }
function vehicleBounds(car) {
  const sin = Math.abs(Math.sin(car.heading)), cos = Math.abs(Math.cos(car.heading));
  return {x:car.x,z:car.z,w:cos*2.05+sin*4.15,d:sin*2.05+cos*4.15};
}
function carObstacles(excludeId = controlledId) {
  return [...fleet, ...police.units].filter(car => car.id !== excludeId).map(vehicleBounds);
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
    actor.speed=0; fleet=parkCar(fleet,controlledId,actor);
    transition={carId:controlledId,kind:'exit',progress:0,duration:.55,from:{...actor},to};
  } else {
    const car=nearbyCar();
    if (!car) { notify(controlHint('走近車門，等車停下來再按 F。', '走近車門，等車停下來再點「搶車」或「上車」。')); return; }
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
    if (!action.wasStolen) {
      police=reportCrime(police,{type:'theft',position:{x:actor.x,z:actor.z}});
      notify(action.wasOccupied?'車主報警了！已接手 '+car.name+'，警車正在趕來。':'車輛失竊警報！已接手 '+car.name+'，警車正在趕來。');
    } else notify('再次上車：'+car.name+'。');
    hasDriven=true;
  }
  clearInput();updateHud();
}
function resetSession() {
  actor=createPedestrian(FOOT_SPAWN);fleet=createFleet();controlledId=null;transition=null;
  crowd=createCrowd();awareness=createAwareness();
  walking=true;hasDriven=false;active=null;waypoint=null;police=createPoliceState();pendingArrest=false;lastImpact=-10;cameraYaw=0;cameraPitch=.34;accumulator=0;
  combat=createCombatState();combatants=[];pendingDeath=false;aiming=false;
  document.body.classList.add('on-foot');needsRender=true;
}
function reset() {
  if (!started || panel.open) return;
  if (police.level > 0) { notify('通緝中無法回到路邊。繞過街角、躲開警方視線，先甩掉追捕。'); return; }
  if (controlledId) fleet=parkCar(fleet,controlledId,actor);
  controlledId=null;transition=null;actor=createPedestrian(FOOT_SPAWN);walking=true;
  cameraYaw=0;cameraPitch=.34;clearInput();updateHud();
  notify('已回到總部路邊。車留在原處，委託仍保留；可以另找一輛車。');
}
function handleArrest() {
  if (pendingArrest||pendingDeath) return;
  pendingArrest=true;transition=null;actor.speed=0;
  if (walking) { actor.vx=0;actor.vz=0; }
  clearInput();
  const wrap=el('div');
  wrap.append(el('div','busted-stamp','BUSTED'),el('p','lede',controlledId?'警方包圍了車輛，這輛車被扣留了。你將以行人回到禾多總部路邊。':'你被警察攔下了。你將以行人回到禾多總部路邊。'));
  wrap.append(el('p','help-note',active?'手上的委託仍保留。找一輛代步工具，或徒步繼續送件；完成紀錄與跑腿基金不變。':'完成紀錄與跑腿基金仍保留。重新找車、接委託，或者先在街上走走。'));
  wrap.append(button('回到街頭 ↗','primary',()=>panel.close()));
  openPanel('這次，沒甩掉。','BUSTED / 遭到逮捕',wrap);
  updateHud();
}
function recoverFromArrest() {
  if (controlledId) fleet=fleet.filter(car=>car.id!==controlledId);
  controlledId=null;transition=null;pendingArrest=false;police=createPoliceState();
  actor=createPedestrian(FOOT_SPAWN);walking=true;cameraYaw=0;cameraPitch=.34;lastImpact=-10;
  combat=createCombatState();combatants=[];
  awareness={...awareness,threats:[]};
  clearInput();updateHud();
  notify('已返回總部路邊。通緝解除，委託和完成進度保留。');
}
function handleDeath() {
  if(pendingDeath)return;
  pendingDeath=true;pendingArrest=false;transition=null;
  actor.speed=0;if(walking){actor.vx=0;actor.vz=0;}
  clearInput();
  const wrap=el('div','death-content');
  wrap.append(el('div','wasted-stamp','WASTED'),el('p','lede','你倒下了，但今天的故事還沒結束。'));
  wrap.append(el('p','help-note','重生後回到總部路邊，以滿血行人重新出發，通緝解除、彈藥補滿。手上的委託、完成紀錄與跑腿基金都保留。'));
  wrap.append(button('重新出發 ↗','primary',()=>panel.close()));
  openPanel('這座城市，還有明天。','WASTED / 生命歸零',wrap);updateHud();
}
function recoverFromDeath() {
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
  document.body.classList.toggle('on-foot',walking);
  setText('money','$ '+progress.money.toLocaleString('en-US'));
  setText('completed',progress.completed.length+' / '+MISSIONS.length);
  setText('speed',walking?(actor.speed>5.4?'RUN':'WALK'):String(Math.round(Math.abs(actor.speed)*3.6)).padStart(3,'0'));
  setText('speed-unit',walking?'ON FOOT':'KM/H');
  setText('drive-mode',walking?'街頭行人':car?.name||'駕駛中');
  const label=transition?'接手中…':walking?(near?(near.occupied?'搶車':'上車'):'靠近車輛'):'下車';
  setText('vehicle-button-label',label);
  $('enter-exit').disabled=Boolean(transition)||(walking&&!near);
  $('vehicle-action').hidden=!near||Boolean(transition);
  if(near) $('vehicle-action').querySelector('span').textContent=(near.occupied?'搶走 ':'上車 · ')+near.name;
  updateWantedHud();
  updateCombatHud();
  const closest=LOCATIONS.reduce((best,place)=>Math.hypot(actor.x-place.x,actor.z-place.z)<Math.hypot(actor.x-best.x,actor.z-best.z)?place:best,LOCATIONS[0]);
  setText('district',closest.name);
  setText('mission-kicker',!hasDriven?'STREET START':active?active.mission.person+' 的委託':'OFF THE CLOCK');
  setText('mission-title',!hasDriven?'先找一輛代步工具。':active?active.mission.title:target?'前往'+target.name:progress.completed.length===MISSIONS.length?'今天，真的下班了。':'你的車，你的下班路。');
  setText('mission-detail',!hasDriven?controlHint('WASD 走向前方的轎車，靠近車門按 F 搶車。','左下搖桿移動，靠近轎車後點「搶車」。右側滑動轉視角。'):active?(active.stage==='pickup'?'先到':'送往')+target.name+controlHint('，停穩後按 E 交接。','，停穩後點取件／交付。'):target?'跟著小地圖的黃色圓圈，沿街道抵達。':controlHint('按 J 接委託；按 F 下車，隨時換一輛車。','點左上「委託」接任務；點「下車」探索，隨時換車。'));
  setText('mission-step',!hasDriven?'01 步行 → 02 搶車':active?(active.stage==='pickup'?'01 / 02 取件':'02 / 02 交付'):'自由漫遊');
  setText('mission-distance',target?Math.round(distance)+' m':closest.name);
  const ready=active&&distance<=11&&!transition;
  $('interact').hidden=!ready;
  if(ready)$('interact').querySelector('span').textContent=police.level?'先解除通緝':Math.abs(actor.speed)>=4?'請先煞停':active.stage==='pickup'?'到點取件':'完成交付';
  if(!active&&waypoint&&distance<10){notify('抵達'+target.name+'。');waypoint=null;}
  setText('drive-hint',walking?(combat.weaponId==='unarmed'?'WASD 移動 · Shift 奔跑 · F 搶車 · Tab 武器':'左鍵／X 射擊 · 右鍵／Z 瞄準 · R 換彈 · Q 換武器'):'W 油門 · S 煞車／倒車 · A/D 轉向 · Space 手煞車 · F 下車');
  const brake=document.querySelector('[data-control="brake"]'),boost=document.querySelector('[data-control="boost"]');
  const brakeLabel=walking?'跳躍':'手煞車',boostLabel=walking?'奔跑 ↗':'加速 ↗';
  if(brake.textContent!==brakeLabel){brake.textContent=brakeLabel;brake.setAttribute('aria-label',brakeLabel);}
  if(boost.textContent!==boostLabel){boost.textContent=boostLabel;boost.setAttribute('aria-label',walking?'奔跑':'加速');}
  $('takeover-progress').hidden=!transition;
  if(transition){setText('takeover-label',transition.kind==='steal'?'打開車門，接手駕駛':transition.kind==='exit'?'下車':'上車');$('takeover-bar').style.width=transition.progress*100+'%';}
  drawMap($('minimap'));
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
  notify(soundEnabled ? '遊戲音效已開啟：引擎、警笛與射擊。' : '遊戲音效已關閉。');
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
function simulate(dt, controls) {
  if(pendingArrest||pendingDeath)return;
  time += dt;
  fleet=stepFleet([...fleet,...police.units],dt,{controlledId,reservedId:transition?.carId,player:walking?actor:null,pedestrians:crowd,threats:awareness.threats}).filter(car=>car.kind!=='police');
  if(!started){
    awareness=stepAwareness(awareness,[],dt);
    crowd=stepCrowd(crowd,dt,{vehicles:fleet});
    return;
  }
  const cityEvents=[];
  aiming=walking&&combat.weaponId!=='unarmed'&&!transition&&Boolean(controls.aiming);
  if(transition){
    transition.progress=Math.min(1,transition.progress+dt/transition.duration);
    if(transition.progress>=1)finishTransition();
  } else {
    const obstacles=[...BUILDINGS,...carObstacles()];
    const speedBefore=actor.speed;
    if(walking){
      actor=stepPedestrian(actor,{forward:controls.forward*(aiming ? .58 : 1),right:controls.right*(aiming ? .58 : 1),cameraYaw,sprint:controls.sprint&&!aiming,jump:pendingJump},dt,obstacles);
      if(aiming||controls.fire)actor.heading=cameraYaw;
      pendingJump=false;
    } else {
      actor=stepVehicle(actor,{throttle:controls.forward,steer:controls.right,brake:controls.brake,boost:controls.sprint},dt,obstacles);
      fleet=fleet.map(car=>car.id===controlledId?{...car,...actor}:car);
      if(actor.impact&&Math.abs(speedBefore)>5&&time-lastImpact>2.5){
        const hitPolice=touchingPolice(actor);
        police=reportCrime(police,{type:hitPolice?'police-collision':'collision',position:{x:actor.x,z:actor.z}});
        combat=applyDamage(combat,Math.min(30,Math.max(0,(Math.abs(speedBefore)-8)*1.5)));
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
  const disabledUnitIds=Object.entries(combat.officers).filter(([,officer])=>officer.down).map(([id])=>id);
  police=stepPolice(police,{player:actor,walking,obstacles:BUILDINGS,traffic:fleet,disabledUnitIds,armedHostile:combat.hostile||police.level>=2},dt);
  const combatInput={player:actor,walking,aiming,fire:!transition&&Boolean(controls.fire),aimYaw:cameraYaw,police,obstacles:BUILDINGS,traffic:fleet,enabled:true};
  combat=stepCombat(combat,combatInput,dt);
  for(const event of combat.events){
    if(event.type==='crime')police=reportCrime(police,{type:event.crime,position:event.position});
    if(event.type==='shot')playShot(event.shooter==='police');
    if(event.type==='unitDown')notify('警員失去戰鬥能力。支援仍會到場，趁現在拉開距離。');
  }
  combatants=getPoliceCombatants(police,combat,BUILDINGS,fleet);
  awareness=stepAwareness(awareness,[...cityEvents,...combat.events],dt);
  crowd=stepCrowd(crowd,dt,{threats:awareness.threats,vehicles:[...fleet,...police.units],player:walking?actor:null});
  if(combat.dead){handleDeath();return;}
  if(police.phase==='busted'){handleArrest();return;}
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
    scene.update(actor,{time,dt:paused?0:dt,walking,controlledId,fleet:[...fleet,...police.units],crowd,transition,cameraYaw,cameraPitch,lookActive:time<lookUntil,quality,night:false,target:targetPlace(),heat:police.level,cinematic:!started,cameraMode,selectedCarId:nearbyCar()?.id,combat,combatants,aiming,aimYaw:cameraYaw});
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
  notify(controlHint('行人開局。WASD 移動，F 搶車；Tab 選武器，右鍵瞄準、左鍵射擊。', '左下搖桿移動，右側滑動轉視角。點「武器」選裝備，靠近車門可搶車。'));
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
$('jobs').addEventListener('click',showJobs);$('open-map').addEventListener('click',showMap);
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
document.addEventListener('visibilitychange',()=>{clearInput();accumulator=0;if(document.hidden&&started&&!panel.open)showPause();});
window.addEventListener('resize',()=>{scene?.resize();needsRender=true;});
window.addEventListener('pagehide',event=>{
  clearInput();input?.unlock();cancelAnimationFrame(raf);if(audio)audio.suspend().catch(()=>{});
  if(!event.persisted){scene?.dispose();input?.dispose();}
});
window.addEventListener('pageshow',event=>{if(event.persisted){lastFrame=0;accumulator=0;needsRender=true;raf=requestAnimationFrame(tick);if(soundEnabled&&audio)audio.resume().catch(()=>{});}});

if (progress.completed.length) $('welcome-save').textContent = `已完成 ${progress.completed.length} / ${MISSIONS.length} 個委託 · 本機進度`;
try {
  const { createCityScene } = await import('./scene.js');
  scene = await createCityScene({ container: $('city'), onReady: () => {} });
  const canvas = $('city').querySelector('canvas');
  if (canvas) {
    canvas.tabIndex = 0;
    input=createGameInput({canvas,joystick:$('move-stick'),knob:$('stick-knob'),lookPad:$('look-pad'),pedals:document.querySelectorAll('.pedals button'),fireButton:$('fire'),
      isActive:()=>started&&!panel.open&&!transition&&!document.hidden&&!combat.dead,isWalking:()=>walking,isArmed:()=>combat.weaponId!=='unarmed',
      onAction:action=>{const actions={vehicle:switchVehicle,interact,reset,reload:reloadWeapon,cycleWeapon,weapons:showWeapons,unarmed:()=>equipWeapon('unarmed'),pistol:()=>equipWeapon('pistol'),smg:()=>equipWeapon('smg'),map:showMap,jobs:showJobs,camera:()=>$('camera').click(),pause:showPause};actions[action]?.();},
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
