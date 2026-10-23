import { ROAD_LINES, WORLD_LIMIT, LOCATIONS, BUILDINGS, MISSIONS } from './world.js';
import { createVehicle, stepVehicle, createPedestrian, stepPedestrian } from './driving.js';
import { createFleet, stepFleet, findNearbyCar, takeCar, parkCar } from './fleet.js';
import { createGameInput } from './input.js';
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
let scene, input, started = false, walking = true, cameraMode = 'chase';
let cameraYaw = 0, cameraPitch = .34, lookUntil = 0, quality = 'auto';
let accumulator = 0, needsRender = true;
const fixedStep = 1 / 60;
const touchControls = window.matchMedia('(pointer: coarse)');
const controlHint = (desktop, touch) => touchControls.matches ? touch : desktop;
let pendingJump = false;
let active = null, waypoint = null, heat = 0, lastImpact = -10, time = 0;
let lastFrame = 0, raf = 0, lastHud = 0, toastTimer;
let audio, tone, volume, soundEnabled = false;
let restoreFocus = null;

function notify(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4500);
}
function clearInput() {
  input?.clear();
  pendingJump = false;
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
function showHelp() {
  const wrap = el('div');
  wrap.append(el('p', 'lede', controlHint('你從行人開始。先靠近路邊或停等中的車，按 F 接手車輛；之後可以換車、下車探索，或按 J 接委託。', '你從行人開始。用左下搖桿靠近路邊或停等中的車，點「搶車」接手車輛；之後可以換車、下車探索，或點左上「委託」接任務。')));
  const grid = el('div', 'help-grid');
  for (const [label, key] of [['步行／駕駛', 'WASD / 方向鍵'], ['奔跑／加速', 'Shift'], ['跳躍／手煞車', 'Space'], ['搶車／上下車', 'F'], ['任務交接', 'E'], ['轉動視角', '滑鼠 / 右鍵拖曳'], ['城市地圖', 'M'], ['同事委託', 'J'], ['切換視角', 'V / C'], ['回到路邊', 'R'], ['暫停／釋放滑鼠', 'Esc']]) {
    const row = el('div', '', label); row.append(el('kbd', '', key)); grid.append(row);
  }
  wrap.append(grid, el('p', 'help-note', '步行方向跟隨鏡頭，左右鍵直接橫移。點擊街景可鎖定滑鼠轉視角，也可按住右鍵拖曳。開車時 W 油門、S 煞車後倒車、A/D 轉向、Space 手煞車；放開方向鍵會自動回正。'));
  wrap.append(el('p', 'help-note', '手機左側搖桿移動，右半畫面拖曳轉視角；右下是跳躍／煞車和奔跑／加速。靠近慢車才會顯示搶車提示，停穩才可下車。目擊警戒會隨時間消退，目前沒有警車追捕。'));
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
  wrap.append(button('操作說明', 'secondary', showHelp));
  wrap.append(button('回到開場', 'secondary', () => {
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
function carObstacles(excludeId = controlledId) {
  return fleet.filter(car => car.id !== excludeId).map(car => {
    const sin = Math.abs(Math.sin(car.heading)), cos = Math.abs(Math.cos(car.heading));
    return {x:car.x,z:car.z,w:cos*2.05+sin*4.15,d:sin*2.05+cos*4.15};
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
    fleet=parkCar(fleet,car.id,actor);controlledId=null;walking=true;
    actor=createPedestrian(action.to);cameraPitch=.34;
  } else {
    fleet=takeCar(fleet,car.id);controlledId=car.id;walking=false;
    actor=createVehicle({...car,speed:0}); cameraPitch=.28;
    if (!action.wasStolen) {
      heat=Math.min(3,heat+(action.wasOccupied?1.5:.65));lastImpact=time;
      notify(action.wasOccupied?'車主跳下車：「欸！那是我的車！」已接手 '+car.name+'。':'已接手 '+car.name+'。');
    } else notify('再次上車：'+car.name+'。');
    if (!hasDriven) { hasDriven=true; setTimeout(()=> {if(started&&!panel.open&&hasDriven)notify(controlHint('現在有車了。按 J 接同事委託，或繼續在街上換車探索。', '現在有車了。點左上「委託」接同事來電，或繼續在街上換車探索。'));},3200); }
  }
  clearInput();updateHud();
}
function resetSession() {
  actor=createPedestrian(FOOT_SPAWN);fleet=createFleet();controlledId=null;transition=null;
  walking=true;hasDriven=false;active=null;waypoint=null;heat=0;cameraYaw=0;cameraPitch=.34;accumulator=0;
  document.body.classList.add('on-foot');needsRender=true;
}
function reset() {
  if (!started || panel.open) return;
  if (controlledId) fleet=parkCar(fleet,controlledId,actor);
  controlledId=null;transition=null;actor=createPedestrian(FOOT_SPAWN);walking=true;
  cameraYaw=0;cameraPitch=.34;clearInput();updateHud();
  notify('已回到總部路邊。車留在原處，委託仍保留；可以另找一輛車。');
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
  setText('heat','★'.repeat(Math.ceil(heat))+'☆'.repeat(3-Math.ceil(heat)));
  $('heat').setAttribute('aria-label','目擊警戒 '+Math.ceil(heat)+' 級');
  setText('heat-status',heat>0?'目擊警戒 · 逐漸消退':'');
  const closest=LOCATIONS.reduce((best,place)=>Math.hypot(actor.x-place.x,actor.z-place.z)<Math.hypot(actor.x-best.x,actor.z-best.z)?place:best,LOCATIONS[0]);
  setText('district',closest.name);
  setText('mission-kicker',!hasDriven?'STREET START':active?active.mission.person+' 的委託':'OFF THE CLOCK');
  setText('mission-title',!hasDriven?'先找一輛代步工具。':active?active.mission.title:target?'前往'+target.name:progress.completed.length===MISSIONS.length?'今天，真的下班了。':'你的車，你的下班路。');
  setText('mission-detail',!hasDriven?controlHint('WASD 走向前方的轎車，靠近車門按 F 搶車。','左下搖桿移動，靠近轎車後點「搶車」。右側滑動轉視角。'):active?(active.stage==='pickup'?'先到':'送往')+target.name+controlHint('，停穩後按 E 交接。','，停穩後點取件／交付。'):target?'跟著小地圖的黃色圓圈，沿街道抵達。':controlHint('按 J 接委託；按 F 下車，隨時換一輛車。','點左上「委託」接任務；點「下車」探索，隨時換車。'));
  setText('mission-step',!hasDriven?'01 步行 → 02 搶車':active?(active.stage==='pickup'?'01 / 02 取件':'02 / 02 交付'):'自由漫遊');
  setText('mission-distance',target?Math.round(distance)+' m':closest.name);
  const ready=active&&distance<=11&&!transition;
  $('interact').hidden=!ready;
  if(ready)$('interact').querySelector('span').textContent=Math.abs(actor.speed)>=4?'請先煞停':active.stage==='pickup'?'到點取件':'完成交付';
  if(!active&&waypoint&&distance<10){notify('抵達'+target.name+'。');waypoint=null;}
  setText('drive-hint',walking?'WASD 移動 · Shift 奔跑 · Space 跳躍 · F 搶車 · 滑鼠轉視角':'W 油門 · S 煞車／倒車 · A/D 轉向 · Space 手煞車 · F 下車');
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
    } catch { notify('目前無法啟動音效。'); return; }
  }
  soundEnabled = !soundEnabled; audio.resume().catch(() => {});
  $('sound').setAttribute('aria-pressed', String(soundEnabled));
  $('sound').setAttribute('aria-label', soundEnabled ? '關閉引擎音效' : '開啟引擎音效');
  notify(soundEnabled ? '引擎音效已開啟。' : '引擎音效已關閉。');
}
function simulate(dt, controls) {
  time += dt;
  fleet=stepFleet(fleet,dt,{controlledId,reservedId:transition?.carId,player:walking?actor:null});
  if(!started)return;
  if(transition){
    transition.progress=Math.min(1,transition.progress+dt/transition.duration);
    if(transition.progress>=1)finishTransition();
    return;
  }
  const obstacles=[...BUILDINGS,...carObstacles()];
  const speedBefore=actor.speed;
  if(walking){
    actor=stepPedestrian(actor,{forward:controls.forward,right:controls.right,cameraYaw,sprint:controls.sprint,jump:pendingJump},dt,obstacles);
    pendingJump=false;
  } else {
    actor=stepVehicle(actor,{throttle:controls.forward,steer:controls.right,brake:controls.brake,boost:controls.sprint},dt,obstacles);
    fleet=fleet.map(car=>car.id===controlledId?{...car,...actor}:car);
    if(actor.impact&&speedBefore>5&&time-lastImpact>2.5){
      heat=Math.min(3,heat+.5);lastImpact=time;
      notify(controlHint('碰撞！用 S 倒車，轉開方向再前進。', '碰撞！搖桿往下拉倒車，轉開方向再前進。'));
    }
    if(time>lookUntil&&Math.abs(actor.speed)>1.8){
      cameraYaw+=angleDelta(actor.heading,cameraYaw)*(1-Math.exp(-dt*2.6));
      cameraPitch+=(.28-cameraPitch)*(1-Math.exp(-dt*1.2));
    }
  }
  if(time-lastImpact>8)heat=Math.max(0,heat-dt/10);
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
    scene.update(actor,{time,dt:paused?0:dt,walking,controlledId,fleet,transition,cameraYaw,cameraPitch,lookActive:time<lookUntil,quality,night:false,target:targetPlace(),heat,cinematic:!started,cameraMode,selectedCarId:nearbyCar()?.id});
    needsRender=false;
  }
  if(now-lastHud>100&&started&&!document.hidden){updateHud();lastHud=now;}
  if(audio&&volume){
    const audible=soundEnabled&&started&&!walking&&!paused;
    volume.gain.setTargetAtTime(audible ? .022+Math.min(Math.abs(actor.speed)/800,.03):0,audio.currentTime,.1);
    tone.frequency.setTargetAtTime(42+Math.abs(actor.speed)*3,audio.currentTime,.08);
  }
  raf=requestAnimationFrame(tick);
}
function focusGame(){if(started&&!panel.open)$('city').querySelector('canvas')?.focus({preventScroll:true});}
$('start').addEventListener('click',()=>{
  if(!scene)return;
  started=true;clearInput();$('welcome').hidden=true;$('hud').hidden=false;
  document.body.classList.add('playing','on-foot');updateHud();focusGame();
  notify(controlHint('行人開局。WASD 移動，靠近前方轎車按 F 搶車；滑鼠可轉視角。', '左下搖桿移動，靠近轎車後點「搶車」；右側滑動轉視角。'));
});
$('close-panel').addEventListener('click',()=>panel.close());
panel.addEventListener('close',()=>{
  document.body.classList.remove('paused');clearInput();lastFrame=performance.now();accumulator=0;needsRender=true;
  if(started)focusGame();else if(restoreFocus?.isConnected&&!restoreFocus.closest('[hidden]'))restoreFocus.focus();
});
panel.addEventListener('click',event=>{if(event.target===panel){const box=panel.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)panel.close();}});
$('help').addEventListener('click',showHelp);$('welcome-help').addEventListener('click',showHelp);
$('jobs').addEventListener('click',showJobs);$('open-map').addEventListener('click',showMap);
$('pause').addEventListener('click',showPause);$('interact').addEventListener('click',interact);
$('enter-exit').addEventListener('click',switchVehicle);$('vehicle-action').addEventListener('click',switchVehicle);$('reset').addEventListener('click',reset);
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
    input=createGameInput({canvas,joystick:$('move-stick'),knob:$('stick-knob'),lookPad:$('look-pad'),pedals:document.querySelectorAll('.pedals button'),
      isActive:()=>started&&!panel.open&&!transition&&!document.hidden,isWalking:()=>walking,
      onAction:action=>{const actions={vehicle:switchVehicle,interact,reset,map:showMap,jobs:showJobs,camera:()=>$('camera').click(),pause:showPause};actions[action]?.();},
      onLook:(dx,dy)=>{cameraYaw+=dx*.003;cameraPitch=clamp(cameraPitch+dy*.0022,.10,1.05);lookUntil=time+1.4;needsRender=true;},
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
