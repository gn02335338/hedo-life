import { createGame, startGame, stepGame, equipItem, discardItem, restartGame, getProgress, clearPendingInput } from './engine.js';
import { WORLD, SKILLS, RARITIES, BOSS_PROFILES } from './content.js';
import { createScene } from './scene.js';
import { createInput } from './input.js';
import { readProgress, writeProgress } from './progress.js';
import { createFeedback } from './feedback.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slots = { weapon: '武器', armor: '護甲', charm: '飾品' };
const itemArt = value => {
  const icons = { keyboard: 'weapon', mug: 'mug', hoodie: 'armor', helmet: 'helmet', badge: 'charm', lanyard: 'lanyard' };
  return `./assets/item-${typeof value === 'string' ? value : icons[value.baseId] || value.slot}.webp`;
};
const bossOrder = ['sonny', 'meimei', 'wing'];
let selectedItemId = null, bossStepsSignature = '';
const dialogs = [...document.querySelectorAll('dialog')];
const feedback = createFeedback();
let state, scene, input, previousTime = 0, uiTime = 0, saveSignature = '', resultShown = false, destroyed = false;
let lastHp = 0, lastKills = 0, lastItems = 0, lastLevel = 1, lastRoom = 0, lastMessage = '';
let toastTimeout;
let storage;
try { storage = window.localStorage; } catch { /* A private or restricted browser can still play. */ }
document.body.classList.add('is-ready');

function active() { return state?.status === 'playing' && !document.hidden && !dialogs.some(dialog => dialog.open); }
function clearControls({ keepFeedback = false } = {}) {
  input?.clear(); if (state) clearPendingInput(state);
  if (!keepFeedback) feedback.suspend();
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('visible'), 3000);
}
function persist(force = false) {
  if (!state) return;
  const p = getProgress(state);
  const signature = JSON.stringify(p);
  if (!force && signature === saveSignature) return;
  const saved = writeProgress(storage, p);
  saveSignature = signature;
  $('save-state').textContent = saved ? '進度已存於此瀏覽器' : '本次可遊玩 · 瀏覽器無法儲存';
}
function closeDialog(dialog) {
  dialog.close(); clearControls(); previousTime = performance.now();
  if ((state?.status === 'won' || state?.status === 'dead') && dialog !== $('result-dialog')) showResult();
  else if (active()) scene.canvas?.focus({ preventScroll: true });
}
function openDialog(dialog, { keepFeedback = false } = {}) {
  clearControls({ keepFeedback });
  for (const other of dialogs) if (other.open && other !== dialog) other.close();
  if (!dialog.open) dialog.showModal();
  persist();
}
for (const dialog of dialogs) {
  dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog !== $('result-dialog')) closeDialog(dialog); });
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog(dialog)));
  dialog.addEventListener('close', clearControls);
}

function showBag() { if (!state.inventory.some(item => item.id === selectedItemId)) selectedItemId = state.inventory.at(-1)?.id; renderInventory(); openDialog($('inventory-dialog')); }
$('bag-button').addEventListener('click', showBag);
$('help-button').addEventListener('click', () => openDialog($('help-dialog')));
$('pause-help').addEventListener('click', () => openDialog($('help-dialog')));
$('pause-button').addEventListener('click', () => { if (state?.status === 'playing') openDialog($('pause-dialog')); });
$('resume-button').addEventListener('click', () => closeDialog($('pause-dialog')));
$('result-bag').addEventListener('click', showBag);
$('sound-button').addEventListener('click', () => {
  feedback.unlock();
  const enabled = feedback.toggle();
  $('sound-button').setAttribute('aria-pressed', String(enabled));
  $('sound-button').setAttribute('aria-label', enabled ? '音效開啟' : '音效關閉');
  $('sound-button').textContent = enabled ? '音效 開' : '音效 關';
});

function begin() {
  if (!scene || !state) return;
  feedback.unlock();
  startGame(state); clearControls();
  $('intro').hidden = true;
  document.body.classList.remove('is-ready');
  previousTime = performance.now();
  scene.canvas?.focus({ preventScroll: true });
  toast('往地城深處前進。靠近戰利品即可拾取。');
  updateHud();
}
$('start-button').addEventListener('click', begin);
$('retry-button').addEventListener('click', () => {
  $('result-dialog').close();
  restartGame(state); resultShown = false;
  lastHp = state.player.hp; lastKills = 0; lastItems = 0; lastLevel = state.player.level; lastRoom = 0;
  begin(); persist(true);
});

function equippedItem(slot) {
  const item = state.equipped[slot];
  return typeof item === 'string' ? state.inventory.find(row => row.id === item) : item;
}
function describeItem(item) {
  return [['攻擊', item.attack], ['護甲', item.armor], ['生命', item.maxHp], ['精神恢復', item.energyRegen]]
    .filter(([, value]) => value > 0).map(([label, value]) => `${label} +${Number(value.toFixed(1))}`).join('　');
}
function comparison(item) {
  const current = equippedItem(item.slot);
  const rows = [['攻擊', 'attack'], ['護甲', 'armor'], ['生命', 'maxHp'], ['精神恢復', 'energyRegen']];
  return rows.map(([label, key]) => [label, Number(((item[key] || 0) - (current?.[key] || 0)).toFixed(1))])
    .filter(([, value]) => value !== 0).map(([label, value]) => `${label} ${value > 0 ? '+' : ''}${value}`).join(' ／ ') || '屬性相同';
}
function renderInventory() {
  if (!state) return;
  const p = state.player;
  $('bag-level').textContent = `LV. ${p.level}`;
  $('stat-list').innerHTML = [['攻擊', p.attack], ['護甲', p.armor], ['生命上限', p.maxHp], ['金幣', `${p.gold} G`]]
    .map(([label, value]) => `<p><span>${label}</span><strong>${escape(value)}</strong></p>`).join('');
  $('equipped-list').innerHTML = Object.keys(slots).map(slot => {
    const item = equippedItem(slot);
    return `<div class="equipment-slot"><img src="${itemArt(item || slot)}" alt="${escape(slots[slot])}"><div><strong>${escape(item?.name || `尚無${slots[slot]}`)}</strong><small>${item ? escape(describeItem(item)) : '尚未裝備'}</small></div></div>`;
  }).join('');
  if (!state.inventory.some(item => item.id === selectedItemId)) selectedItemId = state.inventory.at(-1)?.id;
  $('inventory-count').textContent = `${state.inventory.length} / 60`;
  $('empty-bag').hidden = state.inventory.length > 0;
  $('inventory-list').innerHTML = [...state.inventory].reverse().map(item => {
    const equipped = equippedItem(item.slot)?.id === item.id;
    return `<button class="item-tile ${escape(item.rarity)} ${equipped ? 'equipped' : ''} ${item.id === selectedItemId ? 'selected' : ''}" data-select="${escape(item.id)}" aria-label="${escape(item.name)}${equipped ? '，裝備中' : ''}" aria-pressed="${item.id === selectedItemId}"><img src="${itemArt(item)}" alt="">${equipped ? '<span>裝備中</span>' : ''}</button>`;
  }).join('');
  const item = state.inventory.find(item => item.id === selectedItemId);
  $('item-detail').hidden = !item;
  if (item) {
    const equipped = equippedItem(item.slot)?.id === item.id;
    const rarity = RARITIES[item.rarity] || RARITIES.common;
    $('item-detail').innerHTML = `<div class="item-detail-heading" style="--item-color:${rarity.color}"><img src="${itemArt(item)}" alt=""><div><small>${escape(rarity.name)}・${escape(slots[item.slot])}</small><h4>${escape(item.name)}</h4></div></div><p class="item-description">${escape(item.description)}</p><p class="item-stats">${escape(describeItem(item))}</p><p class="item-compare">${equipped ? '目前裝備中' : `相較目前裝備：${escape(comparison(item))}`}</p><div class="item-actions"><button data-equip="${escape(item.id)}" ${equipped ? 'disabled' : ''}>${equipped ? '已裝備' : '裝備此物品'}</button>${equipped ? '' : `<button data-discard="${escape(item.id)}" aria-label="丟棄${escape(item.name)}">丟棄</button>`}</div>`;
  }
}
$('inventory-dialog').addEventListener('click', event => {
  const selected = event.target.closest('[data-select]');
  const equip = event.target.closest('[data-equip]');
  const discard = event.target.closest('[data-discard]');
  if (selected) selectedItemId = selected.dataset.select;
  if (equip) equipItem(state, equip.dataset.equip);
  if (discard) discardItem(state, discard.dataset.discard);
  if (selected || equip || discard) {
    renderInventory(); updateHud();
    if (selected) $('inventory-list').querySelector(`[data-select="${CSS.escape(selectedItemId)}"]`)?.focus({ preventScroll: true });
    if (equip || discard) persist(true);
  }
});

function showResult() {
  if (!state || !['won', 'dead'].includes(state.status)) return;
  resultShown = true;
  const won = state.status === 'won';
  $('result-eyebrow').textContent = won ? 'CLOCK OUT. YOU EARNED IT.' : 'THE SHIFT IS NOT OVER';
  $('result-emblem').src = won ? './assets/item-charm.webp' : './assets/skill-potion.webp';
  $('result-title').textContent = won ? '今晚，準時下班。' : '你倒下了，需求沒有。';
  $('result-copy').textContent = won ? '阿福、水蛇與翅膀都已倒下。帶著戰利品回家，或挑戰更深一輪的加班地城。' : '已取得的等級、金幣與裝備都會保留。整理裝備，再給自己一次機會。';
  $('retry-button').textContent = won ? '下一輪加班地城' : '帶著裝備重新出發';
  const seconds = Math.max(0, Math.floor(state.stats.elapsed || 0));
  $('result-stats').innerHTML = [[state.stats.kills, '擊敗怪物'], [state.stats.itemsFound, '取得裝備'], [`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, '本輪時間']]
    .map(([value, label]) => `<div><strong>${escape(value)}</strong><span>${label}</span></div>`).join('');
  persist(true);
  // The final playing tick already consumed its events. Let those short tails
  // finish once; explicit pause/bag/blur/visibility/leave still stop them.
  openDialog($('result-dialog'), { keepFeedback: true });
  // A held attack key must not activate retry as soon as the fight ends.
  $('result-title').focus({ preventScroll: true });
}

function updateHud() {
  if (!state) return;
  const p = state.player;
  $('health-fill').style.clipPath = `inset(${100 - Math.max(0, p.hp / p.maxHp * 100)}% 0 0 0)`;
  $('energy-fill').style.clipPath = `inset(${100 - Math.max(0, p.energy / p.maxEnergy * 100)}% 0 0 0)`;
  $('health-text').textContent = Math.ceil(p.hp);
  $('health-max').textContent = `/ ${p.maxHp}`;
  $('energy-text').textContent = Math.floor(p.energy);
  $('mobile-energy').textContent = `精神 ${Math.floor(p.energy)}`;
  $('energy-max').textContent = `/ ${p.maxEnergy}`;
  $('level-text').textContent = `LV. ${p.level}`;
  $('level-badge').textContent = String(p.level).padStart(2, '0');
  $('gold-text').textContent = `${p.gold} G`;
  $('xp-fill').style.width = `${Math.min(100, p.xp / Math.max(1, p.xpNext) * 100)}%`;
  $('bag-count').textContent = state.inventory.length ? state.inventory.length : '';
  $('potion-text').textContent = `${p.potions ?? 3} 杯咖啡`;
  $('run-summary').textContent = `${state.stats.kills} 隻擊敗 · ${state.stats.itemsFound} 件戰利品`;
  const room = WORLD.rooms.find(row => row.id === state.room) || WORLD.rooms[0];
  $('room-name').textContent = room.name;
  $('floor-label').textContent = `加班地城 · 第 ${(state.wins || 0) + (state.status === 'won' ? 0 : 1)} 輪`;
  const remaining = state.enemies.filter(enemy => enemy.hp > 0 && enemy.room === state.room).length;
  const cleared = [1, 2, 3].filter(room => state.roomCleared?.[room]).length;
  const bossId = bossOrder[Math.max(0, (state.room || 1) - 1)];
  const profile = BOSS_PROFILES[bossId];
  $('quest-title').textContent = state.room === 0 ? '擊敗三位禾多關主' : state.roomCleared?.[state.room] ? '封印已解除' : `挑戰${profile.displayName}`;
  $('quest-copy').textContent = state.room === 0 ? '阿福、水蛇與翅膀，守在每一條下班路上。' : state.roomCleared?.[state.room] ? '收好戰利品，穿過開啟的門繼續深入。' : `${profile.title}。此區還有 ${remaining} 名敵人。`;
  if (state.room > 0 && state.defeatedBosses?.[bossId] && !state.roomCleared?.[state.room]) {
    $('quest-title').textContent = '清理關主留下的雜兵';
    $('quest-copy').textContent = `${profile.displayName}已敗。再擊退此區 ${remaining} 名雜兵，就能解除封印。`;
  }
  $('quest-progress').textContent = `${cleared} / 3 區已解放 · ${state.stats.kills} 名敵人倒下`;
  const steps = `${state.room}:${[1, 2, 3].map(room => Number(Boolean(state.roomCleared?.[room]))).join('')}`;
  if (steps !== bossStepsSignature) {
    bossStepsSignature = steps;
    $('boss-steps').innerHTML = bossOrder.map((id, index) => {
      const boss = BOSS_PROFILES[id], room = index + 1, done = state.roomCleared?.[room];
      return `<div class="boss-step ${state.room === room ? 'current' : ''} ${done ? 'cleared' : ''}"><img src="${escape(boss.portrait)}" alt=""><span><small>${room === 3 ? '最終魔王' : `第 ${room} 關`}</small>${escape(boss.displayName)}</span><b>${done ? '已擊敗' : state.room === room ? '挑戰中' : '未抵達'}</b></div>`;
    }).join('');
  }
  const availableBosses = state.enemies.filter(enemy => enemy.type === 'boss' && enemy.hp > 0 && enemy.room <= state.unlockedRoom);
  const boss = availableBosses.find(enemy => enemy.room === state.room)
    || availableBosses.find(enemy => enemy.active && Math.hypot(enemy.x - p.x, enemy.z - p.z) < 14);
  const showBoss = Boolean(boss && state.status === 'playing');
  $('boss-hud').hidden = !showBoss;
  document.body.classList.toggle('has-boss', showBoss);
  if (showBoss) {
    const info = BOSS_PROFILES[boss.bossId];
    $('boss-portrait').src = info.portrait;
    $('boss-portrait').alt = info.displayName;
    $('boss-name').textContent = info.displayName;
    $('boss-title').textContent = info.title;
    $('boss-fill').style.width = `${boss.hp / boss.maxHp * 100}%`;
    $('boss-percent').textContent = `${Math.ceil(boss.hp)} / ${boss.maxHp}`;
    $('boss-skill').textContent = boss.phase === 'windup' ? `即將施放：${boss.attackLabel || boss.telegraph?.label || '蓄力攻擊'}`
      : boss.phase === 'charge' ? '衝鋒中・向側邊閃避'
        : boss.phase === 'recovery' ? boss.comboTotal > 1 && boss.comboStep < boss.comboTotal ? '連招間隙・留意下一招' : '破綻出現・可以反擊'
          : boss.enraged ? info.phaseTaunts.enraged : info.phaseTaunts.normal;
  }
  document.querySelectorAll('[data-skill]').forEach(button => {
    const skill = button.dataset.skill, cooldown = state.cooldowns[skill] || 0;
    const noEnergy = p.energy < (SKILLS[skill].energy || 0);
    const noCharge = skill === 'potion' && p.potions <= 0;
    const queued = Boolean(state.skillBuffer?.[skill]);
    button.querySelector('.skill-cooldown').style.clipPath = `inset(0 0 ${100 - Math.min(1, cooldown / SKILLS[skill].cooldown) * 100}% 0)`;
    const label = button.querySelector('.cooldown-label');
    if (label) label.textContent = cooldown > 0 ? cooldown.toFixed(1) : noEnergy ? '精神不足' : noCharge ? '已用完' : '';
    button.classList.toggle('no-energy', noEnergy);
    button.classList.toggle('no-charge', noCharge);
    button.classList.toggle('cooling', cooldown > 0);
    button.classList.toggle('queued', queued);
    button.classList.toggle('resource-label', cooldown <= 0 && (noEnergy || noCharge));
    button.setAttribute('aria-label', `${SKILLS[skill].name}${cooldown > 0 ? `，冷卻 ${cooldown.toFixed(1)} 秒` : ''}${queued ? '，已預備' : ''}${noEnergy ? '，精神不足' : ''}${skill === 'potion' ? `，剩 ${p.potions} 杯` : ''}`);
  });
  if (state.status === 'playing') {
    if (p.hp < lastHp) { $('damage-flash').style.opacity = '.23'; setTimeout(() => { $('damage-flash').style.opacity = '0'; }, 110); }
    if (p.level > lastLevel) toast(`升到 LV. ${p.level}！生命回復，精神補滿。`);
    else if (state.stats.itemsFound > lastItems) toast('撿到新裝備，按 I 打開背包比較。');
    else if (state.room !== lastRoom) toast(`進入 ${room.name}`);
    const message = state.messages?.at(-1);
    const text = typeof message === 'string' ? message : message?.text;
    if (text && text !== lastMessage) { toast(text); lastMessage = text; }
  }
  lastHp = p.hp; lastKills = state.stats.kills; lastItems = state.stats.itemsFound; lastLevel = p.level; lastRoom = state.room;
  persist();
}

function frame(time) {
  if (destroyed) return;
  const dt = previousTime ? Math.min((time - previousTime) / 1000, .05) : 1 / 60;
  previousTime = time;
  if (active()) {
    const controls = input.read();
    const { x, z } = scene.movementToWorld(controls.x, controls.z);
    stepGame(state, { ...controls, x, z }, dt);
    feedback.consume(state);
  } else if (document.hidden || !['dead', 'won'].includes(state.status)) feedback.suspend();
  scene.update(state, active() || state.status === 'ready' ? dt : 0);
  uiTime += dt;
  if (uiTime > .09) { updateHud(); uiTime = 0; }
  if (['dead', 'won'].includes(state.status) && !resultShown) { clearControls({ keepFeedback: true }); showResult(); }
  requestAnimationFrame(frame);
}
function interrupt() {
  clearControls(); persist();
  if (state?.status === 'playing' && !dialogs.some(dialog => dialog.open)) openDialog($('pause-dialog'));
}
window.addEventListener('blur', interrupt);
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); previousTime = performance.now(); });
window.addEventListener('pagehide', event => { clearControls(); persist(true); if (!event.persisted) feedback.destroy(); });
window.addEventListener('resize', () => { clearControls(); previousTime = performance.now(); scene?.resize(); });
window.addEventListener('orientationchange', interrupt);

async function initialize() {
  const progress = readProgress(storage);
  state = createGame({ seed: Math.floor(Math.random() * 0xffffffff), progress });
  lastHp = state.player.hp; lastLevel = state.player.level;
  try {
    scene = await createScene({ container: $('scene') });
    input = createInput({
      canvas: scene.canvas, joystick: $('joystick'), joystickZone: $('joystick-zone'), knob: $('stick-knob'), buttons: $('skills'), isActive: active,
      onActionGesture: () => feedback.unlock(),
      onAim: (x, y) => scene.screenToWorld(x, y),
      onAction: action => { if (action === 'inventory') showBag(); if (action === 'pause') openDialog($('pause-dialog')); },
    });
    if (progress) { $('start-button').textContent = '帶著裝備繼續冒險'; $('intro-note').textContent = `LV. ${state.player.level} · ${state.inventory.length} 件裝備 · 已恢復本機進度`; }
    updateHud(); scene.update(state, 0);
    requestAnimationFrame(frame);
  } catch (error) {
    console.error('ARPG initialization failed:', error);
    $('fatal').hidden = false;
    $('fatal-copy').textContent = '此裝置目前無法啟用地城的 3D 圖形。請確認瀏覽器支援 WebGL，或改用其他瀏覽器再試。';
    scene?.destroy(); feedback.destroy(); destroyed = true;
  }
}
initialize();
