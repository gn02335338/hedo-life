import { BRAWL_ARENA, createIslandBrawl } from './brawl.js';
import { drawBrawlCharacter } from './brawl-characters.js';
import { getBrawlProfile } from './brawl-roster.js';

// Original island artwork and controls. The arena never reads or writes saves.
const keyDirections = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
const keyActions = { KeyJ: 'attack', Space: 'dodge', KeyK: 'special', KeyL: 'throw' };
const keyCode = event => event.code || ({ w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD', j: 'KeyJ', k: 'KeyK', l: 'KeyL', p: 'KeyP', ' ': 'Space' }[event.key?.toLowerCase()] || event.key);
const swallow = event => { event.preventDefault(); event.stopImmediatePropagation?.(); event.stopPropagation?.(); };

/** One input owner per mounted fight. Losing focus or a pointer clears every
 * held action, and pulses are consumed once rather than once per render. */
export function bindIslandBrawlInput({ document: doc, window: view, pad, buttons, directionButtons = [], getPhase, onPause, onStart }) {
  const removers = [], keys = new Set(), held = new Map(), pulses = { dodge: false, special: false, throw: false, attack: false };
  let joystick = null, analog = { x: 0, y: 0 }, movePulse = { x: 0, y: 0 }, disposed = false;
  const listen = (target, type, handler, options) => { target.addEventListener(type, handler, options); removers.push(() => target.removeEventListener(type, handler, options)); };
  const clear = () => {
    keys.clear(); held.clear(); joystick = null; analog = { x: 0, y: 0 }; movePulse = { x: 0, y: 0 };
    for (const action of Object.keys(pulses)) pulses[action] = false;
    pad.style.setProperty('--brawl-stick-x', '0px'); pad.style.setProperty('--brawl-stick-y', '0px');
    for (const node of Object.values(buttons)) node.classList.remove('is-held');
    for (const node of directionButtons) node.classList.remove('is-held');
  };
  const pause = () => { clear(); if (getPhase() === 'playing') onPause(); };
  listen(doc, 'keydown', event => {
    const code = keyCode(event), phase = getPhase();
    // A not-yet-started bout follows the dialog's normal cancel behavior.
    if (code === 'Escape' && phase === 'ready') return;
    if (code === 'Escape' || code === 'KeyP') { swallow(event); pause(); return; }
    if (event.target?.closest?.('summary, [data-brawl-dossier]')) return;
    if (code === 'Enter' && phase === 'ready') { swallow(event); if (!event.repeat) onStart(); return; }
    if (!(code in keyDirections) && !(code in keyActions) && code !== 'Home') return;
    swallow(event);
    if (phase !== 'playing') return;
    if (code in keyDirections || code === 'KeyJ') {
      keys.add(code);
      if (code === 'KeyJ' && !event.repeat) pulses.attack = true;
      if (keyDirections[code] && !event.repeat) movePulse = { x: keyDirections[code][0], y: keyDirections[code][1] };
    }
    else if (keyActions[code] && !event.repeat) pulses[keyActions[code]] = true;
  }, true);
  listen(doc, 'keyup', event => {
    const code = keyCode(event);
    keys.delete(code);
    if (event.target?.closest?.('summary, [data-brawl-dossier]')) return;
    if (!(code in keyDirections) && !(code in keyActions)) return;
    swallow(event);
  }, true);
  const release = event => {
    if (held.has(event.pointerId)) { held.get(event.pointerId).node.classList.remove('is-held'); held.delete(event.pointerId); }
    if (joystick === event.pointerId) {
      joystick = null; analog = { x: 0, y: 0 };
      pad.style.setProperty('--brawl-stick-x', '0px'); pad.style.setProperty('--brawl-stick-y', '0px');
    }
  };
  listen(view, 'pointerup', release, true);
  listen(view, 'pointercancel', event => { release(event); clear(); }, true);
  const capture = (node, event) => { try { node.setPointerCapture(event.pointerId); } catch { /* A cancelled pointer is cleared by the window handler. */ } };
  for (const [action, node] of Object.entries(buttons)) {
    listen(node, 'pointerdown', event => {
      swallow(event); if (getPhase() !== 'playing') return;
      capture(node, event); node.classList.add('is-held'); held.set(event.pointerId, { action, node });
      pulses[action] = true;
    });
    listen(node, 'lostpointercapture', release);
    listen(node, 'click', event => {
      // Screen-reader and keyboard activation has no preceding pointerdown.
      if (event.detail === 0 && getPhase() === 'playing') { pulses[action] = true; }
    });
  }
  for (const node of directionButtons) {
    listen(node, 'pointerdown', event => {
      swallow(event); if (getPhase() !== 'playing') return;
      capture(node, event); node.classList.add('is-held');
      held.set(event.pointerId, { node, direction: node.dataset.brawlMove });
      const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[node.dataset.brawlMove];
      movePulse = { x: vector[0], y: vector[1] };
    });
    listen(node, 'lostpointercapture', release);
    listen(node, 'click', event => {
      if (event.detail !== 0 || getPhase() !== 'playing') return;
      const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[node.dataset.brawlMove];
      movePulse = { x: vector[0], y: vector[1] };
    });
  }
  const dragStick = event => {
    if (joystick !== event.pointerId) return;
    const rect = pad.getBoundingClientRect(), reach = Math.max(25, Math.min(rect.width, rect.height) * .32);
    let x = (event.clientX - rect.left - rect.width / 2) / reach, y = (event.clientY - rect.top - rect.height / 2) / reach;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    analog = { x, y }; pad.style.setProperty('--brawl-stick-x', `${x * 24}px`); pad.style.setProperty('--brawl-stick-y', `${y * 24}px`);
  };
  listen(pad, 'pointerdown', event => {
    if (event.target.closest?.('[data-brawl-move]')) return;
    swallow(event); if (getPhase() !== 'playing') return;
    joystick = event.pointerId; capture(pad, event); dragStick(event);
  });
  listen(pad, 'pointermove', event => { if (joystick === event.pointerId) { swallow(event); dragStick(event); } });
  listen(pad, 'lostpointercapture', release);
  listen(view, 'blur', pause);
  listen(doc, 'visibilitychange', () => { if (doc.hidden) pause(); });
  return {
    read() {
      let x = analog.x, y = analog.y, movementHeld = joystick !== null;
      for (const code of keys) if (keyDirections[code]) { x += keyDirections[code][0]; y += keyDirections[code][1]; }
      if ([...keys].some(code => code in keyDirections)) movementHeld = true;
      for (const value of held.values()) if (value.direction) {
        const vector = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[value.direction];
        x += vector[0]; y += vector[1]; movementHeld = true;
      }
      if (!movementHeld) { x += movePulse.x; y += movePulse.y; }
      const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
      const result = { x, y, ...pulses, attack: pulses.attack || keys.has('KeyJ') || [...held.values()].some(value => value.action === 'attack') };
      for (const action of Object.keys(pulses)) pulses[action] = false;
      movePulse = { x: 0, y: 0 };
      return result;
    },
    clear,
    destroy() { if (disposed) return; disposed = true; clear(); for (const remove of removers.splice(0)) remove(); },
  };
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function ellipse(ctx, x, y, rx, ry, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
function text(ctx, value, x, y, size, color, weight = 600, align = 'center') { ctx.font = `${weight} ${size}px "PingFang TC", "Noto Sans TC", sans-serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(value, x, y); }
function hex(ctx, x, y, radius, fill, stroke) {
  ctx.beginPath(); for (let i = 0; i < 6; i++) { const angle = Math.PI / 3 * i; const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function drawObstacle(ctx, obstacle) {
  const { x, y, radius: r, type } = obstacle;
  ellipse(ctx, x + 3, y + 5, r * 1.1, r * .48, '#25483d20');
  if (type === 'planter') {
    ctx.fillStyle = '#bc8967'; roundRect(ctx, x - r * .8, y - r * .55, r * 1.6, r * .75, 8); ctx.fill();
    ellipse(ctx, x, y - r * .55, r * .8, r * .36, '#d2a984');
    for (const [dx, dy, scale] of [[-.45, -.72, .62], [.35, -.93, .7], [0, -1.24, .7]]) ellipse(ctx, x + r * dx, y + r * dy, r * scale, r * scale * .8, dx < 0 ? '#719970' : '#87aa7d');
    return;
  }
  ctx.fillStyle = '#d1b891'; roundRect(ctx, x - r * .8, y - r * 1.05, r * 1.6, r * 1.25, 5); ctx.fill();
  ctx.fillStyle = '#e6d5b5'; roundRect(ctx, x - r * .8, y - r * 1.12, r * 1.6, r * .45, 4); ctx.fill();
  ctx.fillStyle = '#f7f0dc'; ctx.fillRect(x - r * .13, y - r * 1.12, r * .26, r * 1.3);
  text(ctx, '文件', x, y - r * .17, 14, '#8c7553', 500);
}
function drawEffect(ctx, effect, reducedMotion) {
  const ratio = Math.max(0, Math.min(1, effect.life / effect.maxLife)), progress = reducedMotion ? .4 : 1 - ratio;
  ctx.save(); ctx.globalAlpha = reducedMotion ? ratio * .65 : ratio; ctx.translate(effect.x, effect.y);
  if (effect.type === 'slash') {
    ctx.rotate(effect.angle || 0); ctx.strokeStyle = effect.owner === 'player' ? '#fdf7dc' : '#c27b50'; ctx.lineWidth = 8 * ratio + 2;
    ctx.beginPath(); ctx.arc(0, 0, effect.radius || 65, -.8 + progress * .25, .8 + progress * .25); ctx.stroke();
  } else if (effect.type === 'special') {
    ctx.strokeStyle = '#b58c3d'; ctx.lineWidth = 6 * ratio + 2; ctx.beginPath(); ctx.arc(0, 0, (effect.radius || 140) * (.5 + progress * .5), 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4 + progress; const radius = (effect.radius || 140) * (.6 + progress * .4); hex(ctx, Math.cos(angle) * radius, Math.sin(angle) * radius, 8 * ratio, '#e8cf80'); }
    text(ctx, '下班無雙', 0, -55 - progress * 24, 24, '#957337', 800);
  } else if (effect.type === 'dash') {
    ctx.rotate(effect.angle || 0); ctx.strokeStyle = '#9cbaa5'; ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-28 - progress * 20, -15 + i * 14); ctx.lineTo(8 - progress * 16, -15 + i * 14); ctx.stroke(); }
  } else if (['heal', 'guard', 'zone', 'skill'].includes(effect.type)) {
    ctx.strokeStyle = effect.color || (effect.type === 'heal' ? '#739e78' : '#b99158'); ctx.lineWidth = 4 * ratio + 1;
    ctx.beginPath(); ctx.arc(0, 0, (effect.radius || 50) * (.7 + progress * .3), 0, Math.PI * 2); ctx.stroke();
    if (effect.text) text(ctx, effect.text, 0, -45 - progress * 12, effect.type === 'heal' ? 24 : 16, effect.color || '#7a7950', 700);
  } else {
    ctx.strokeStyle = effect.type === 'pickup' ? '#8aa26b' : '#bb7952'; ctx.lineWidth = 3;
    const radius = (effect.radius || 24) * (.7 + progress * .7);
    for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .55, Math.sin(angle) * radius * .55); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke(); }
    if (effect.text) text(ctx, effect.text, 0, -36 - progress * 28, 25, '#8f553b', 800);
  }
  ctx.restore();
}
function drawSignatureWarning(ctx, actor, skill) {
  if (actor.telegraphRemaining <= 0 || !skill || actor.telegraphKind === 'cone') return;
  const colour = skill.color || '#b28a4e';
  ctx.save(); ctx.strokeStyle = colour; ctx.fillStyle = `${colour}30`; ctx.lineWidth = 2;
  if (actor.telegraphKind === 'line') {
    ctx.translate(actor.x, actor.y); ctx.rotate(actor.facing);
    const radius = actor.telegraphWidth;
    roundRect(ctx, -radius, -radius, actor.telegraphRange + radius * 2, radius * 2, radius); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(actor.telegraphRange - 12, 0); ctx.stroke();
  } else {
    const target = actor.telegraphKind === 'self' ? actor : actor.telegraphTarget;
    if (target) { ctx.beginPath(); ctx.arc(target.x, target.y, actor.telegraphKind === 'self' ? 45 : actor.telegraphWidth, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
}

export function mountIslandBrawl({ container, opponent, onFinish, reducedMotion = false }) {
  const doc = container.ownerDocument || document, view = doc.defaultView || window;
  const node = (tag, className = '', value) => { const item = doc.createElement(tag); if (className) item.className = className; if (value !== undefined) item.textContent = value; return item; };
  const button = (className, label, action) => { const item = node('button', className, label); item.type = 'button'; if (action) item.addEventListener('click', action); return item; };
  const root = node('section', 'brawl-shell'); root.dataset.brawlRoot = '';
  const profile = getBrawlProfile(opponent.id);
  const moveById = new Map([...profile.skills, ...profile.events].map(skill => [skill.id, skill]));
  const head = node('div', 'brawl-heading'), titles = node('div');
  titles.append(node('span', 'brawl-eyebrow', 'AFTER HOURS · ISLAND DUEL'));
  const title = node('h2', '', '移動島大亂鬥'); title.id = 'encounter-title'; title.tabIndex = -1; titles.append(title);
  let model, controls, disposed = false, finished = false, frameId = 0, previousTime = null, resizeObserver;
  const pauseButton = button('brawl-pause-button', '暫停 Ⅱ', () => model.getState().phase === 'paused' ? resume() : pause()); pauseButton.dataset.brawlPause = '';
  head.append(titles, pauseButton); root.append(head);
  const hud = node('div', 'brawl-hud');
  const health = (name, isPlayer) => {
    const card = node('div', `brawl-fighter-hud ${isPlayer ? 'is-player' : 'is-opponent'}`), line = node('div', 'brawl-fighter-line');
    const identity = node('div', 'brawl-fighter-identity');
    const avatar = node(isPlayer ? 'span' : 'img', 'brawl-avatar');
    if (isPlayer) avatar.textContent = '我'; else { avatar.src = opponent.image; avatar.alt = ''; }
    identity.append(avatar);
    const label = node('b', '', name), hp = node('span', 'brawl-health-number', '100'); hp.dataset[isPlayer ? 'brawlPlayerHp' : 'brawlOpponentHp'] = '';
    identity.append(label); line.append(identity, hp);
    const track = node('div', 'brawl-health-track'); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', `${name}的體力`); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100');
    const fill = node('span'); track.append(fill); card.append(line, track); return { card, hp, track, fill };
  };
  const playerHud = health('你', true), opponentHud = health(opponent.name, false);
  const clock = node('div', 'brawl-clock'); clock.dataset.brawlClock = ''; clock.append(node('span', '', '對戰時間'), node('strong', '', '75'));
  hud.append(playerHud.card, clock, opponentHud.card); root.append(hud);
  const energyRow = node('div', 'brawl-energy-row'), energyLabel = node('span', '', '下班氣勢 0%'); energyLabel.dataset.brawlEnergy = '';
  const energyTrack = node('div', 'brawl-energy-track'), energyFill = node('span'); energyTrack.append(energyFill);
  const combo = node('strong', 'brawl-combo'); combo.dataset.brawlCombo = ''; energyRow.append(energyLabel, energyTrack, combo); root.append(energyRow);
  const stage = node('div', 'brawl-stage'), canvas = node('canvas', 'brawl-canvas'); canvas.dataset.brawlCanvas = ''; canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `你與${opponent.name}的對戰場地`); canvas.setAttribute('aria-describedby', 'brawl-control-hint'); stage.append(canvas);
  const overlay = node('div', 'brawl-overlay'); overlay.dataset.brawlOverlay = '';
  const panel = node('div', 'brawl-overlay-panel'); panel.setAttribute('role', 'group');
  const panelKicker = node('span', 'brawl-eyebrow', profile.title), panelTitle = node('h3', '', `你 vs ${opponent.name}`), panelCopy = node('p', 'brawl-opening', `「${profile.opening}」`);
  const readyRules = node('p', 'brawl-ready-rules', '75 秒內擊倒對手，或比剩餘體力；相同算平手。看預警閃避，回血可打斷。');
  const startButton = button('brawl-primary', '開始對戰 →', () => start()); startButton.dataset.brawlStart = '';
  const resumeButton = button('brawl-primary', '繼續對戰 →', () => resume()); resumeButton.dataset.brawlResume = ''; resumeButton.hidden = true;
  const forfeitButton = button('brawl-secondary', '認輸離場', () => { controls.clear(); model.forfeit(); update(); complete(); }); forfeitButton.dataset.brawlForfeit = ''; forfeitButton.hidden = true;
  panel.append(panelKicker, panelTitle, panelCopy, readyRules, startButton, resumeButton, forfeitButton); overlay.append(panel); stage.append(overlay); root.append(stage);
  const abilityToast = node('div', 'brawl-ability-toast'); abilityToast.setAttribute('aria-hidden', 'true'); abilityToast.hidden = true;
  const abilityName = node('strong'), abilityLine = node('span'); abilityToast.append(abilityName, abilityLine); stage.append(abilityToast);
  const status = node('p', 'brawl-status', '準備好再開始；右上角可以先離開。'); status.dataset.brawlStatus = ''; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); root.append(status);
  const lower = node('div', 'brawl-controls'), pad = node('div', 'brawl-pad'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', '方向搖桿，按住拖曳或按方向鍵'); pad.dataset.brawlPad = '';
  const stick = node('span', 'brawl-stick'); stick.setAttribute('aria-hidden', 'true'); stick.textContent = '步'; pad.append(stick);
  const directionButtons = [];
  for (const [direction, label, arrow] of [['up', '向上移動', '↑'], ['left', '向左移動', '←'], ['right', '向右移動', '→'], ['down', '向下移動', '↓']]) {
    const move = button(`brawl-direction is-${direction}`, arrow); move.dataset.brawlMove = direction; move.setAttribute('aria-label', label); directionButtons.push(move); pad.append(move);
  }
  const desktopHint = node('div', 'brawl-keyboard-note'); desktopHint.append(node('b', '', 'W A S D'), node('span', '', '或方向鍵移動'), node('small', '', '靠近紙團會自動撿起'));
  const actionGroup = node('div', 'brawl-actions'); actionGroup.setAttribute('role', 'group'); actionGroup.setAttribute('aria-label', '對戰動作');
  const buttons = {};
  for (const [action, label, sub, key] of [['attack', '擊', '按住連段', 'J'], ['dodge', '閃', '閃避', 'SPACE'], ['special', '無雙', '氣勢蓄滿', 'K'], ['throw', '丟', '紙團', 'L']]) {
    const item = button(`brawl-action is-${action}`, ''); item.dataset[`brawl${action[0].toUpperCase()}${action.slice(1)}`] = '';
    item.setAttribute('aria-label', `${sub}，鍵盤 ${key}`); item.setAttribute('aria-keyshortcuts', key === 'SPACE' ? 'Space' : key);
    item.append(node('strong', '', label), node('small', '', sub), node('kbd', '', key)); buttons[action] = item; actionGroup.append(item);
  }
  lower.append(pad, desktopHint, actionGroup); root.append(lower);
  const hints = node('p', 'brawl-control-hint', 'WASD／方向鍵移動 · J 連擊 · 空白鍵閃避 · K 無雙 · L 丟紙團'); hints.id = 'brawl-control-hint'; root.append(hints);
  const dossier = node('details', 'brawl-dossier'); dossier.dataset.brawlDossier = '';
  dossier.append(node('summary', '', `${opponent.name}的招式 · ${profile.skills.length} 招與專屬事件`));
  const skillList = node('div', 'brawl-skill-list');
  for (const skill of [...profile.skills, ...profile.events]) {
    const card = node('div', 'brawl-skill-card'); card.dataset.skillId = skill.id;
    card.append(node('strong', '', `${profile.events.includes(skill) ? '島上插曲 · ' : ''}${skill.name}`), node('span', '', skill.counter)); skillList.append(card);
  }
  dossier.append(skillList); dossier.addEventListener('toggle', () => { if (dossier.open) pause(false); }); root.append(dossier);
  container.append(root);
  let ctx;
  try { ctx = canvas.getContext('2d', { alpha: false }); } catch { /* Explicit fallback below; never substitutes a random win. */ }
  if (!ctx) { root.remove(); throw new Error('這台裝置暫時無法顯示對戰畫面，請換個瀏覽器再試；這次不會結算勝敗。'); }
  model = createIslandBrawl({ opponentId: opponent.id });
  controls = bindIslandBrawlInput({ document: doc, window: view, pad, buttons, directionButtons, getPhase: () => model.getState().phase, onPause: pause, onStart: start });
  let width = 960, height = 540, dpr = 1, lastStatus = '';
  const resize = () => {
    const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width || stage.clientWidth || 960); height = Math.max(1, rect.height || stage.clientHeight || 540);
    dpr = Math.min(2, Math.max(1, view.devicePixelRatio || 1)); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); draw(model.getState());
  };
  function draw(state) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#b7cbbb'; ctx.fillRect(0, 0, width, height);
    // Expand only near an edge: keep the full doll and name in view.
    const actors = [state.player, state.opponent];
    const left = Math.min(0, ...actors.map(actor => actor.x - 96));
    const top = Math.min(0, ...actors.map(actor => actor.y - 212));
    const right = Math.max(BRAWL_ARENA.width, ...actors.map(actor => actor.x + 96));
    const bottom = Math.max(BRAWL_ARENA.height, ...actors.map(actor => actor.y + 38));
    const viewWidth = right - left, viewHeight = bottom - top;
    const scale = Math.min(width / viewWidth, height / viewHeight);
    ctx.save(); ctx.translate((width - viewWidth * scale) / 2 - left * scale, (height - viewHeight * scale) / 2 - top * scale); ctx.scale(scale, scale);
    const recentImpact = state.effects?.find(effect => effect.type === 'impact' && effect.life / effect.maxLife > .7);
    if (recentImpact && !reducedMotion) ctx.translate(Math.sin(state.elapsed * 150) * 2.5, Math.cos(state.elapsed * 120) * 1.5);
    ctx.fillStyle = '#b7cbbb'; ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#e9e5d3'; roundRect(ctx, 19, 19, 922, 502, 30); ctx.fill();
    ctx.strokeStyle = '#d1d1ba'; ctx.lineWidth = 2; roundRect(ctx, 31, 31, 898, 478, 25); ctx.stroke();
    ctx.strokeStyle = '#c8cbb542'; ctx.lineWidth = 1;
    for (let x = 55; x < 930; x += 58) { ctx.beginPath(); ctx.moveTo(x, 34); ctx.lineTo(x, 506); ctx.stroke(); }
    for (let y = 61; y < 510; y += 44) { ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(926, y); ctx.stroke(); }
    ctx.lineWidth = 2; hex(ctx, 480, 270, 108, '#e1e3cf', '#c1c9b1'); hex(ctx, 480, 270, 97, null, '#cbd1bc');
    text(ctx, '移 動 島', 480, 259, 29, '#a1af91', 600); text(ctx, 'AFTER HOURS', 480, 284, 12, '#9cab8d', 500); text(ctx, '一場打完，事情還是要好好說', 480, 309, 12, '#a0ad92', 500);
    for (const pickup of state.pickups || []) if (pickup.available) {
      ellipse(ctx, pickup.x, pickup.y + 3, 15, 7, '#a6b08c47'); ellipse(ctx, pickup.x, pickup.y, 10, 9, '#fff9e7');
      ctx.strokeStyle = '#aa9c7b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pickup.x - 6, pickup.y - 3); ctx.lineTo(pickup.x + 2, pickup.y + 4); ctx.lineTo(pickup.x + 6, pickup.y - 3); ctx.stroke();
      text(ctx, '紙團', pickup.x, pickup.y + 27, 13, '#859173', 500);
    }
    drawSignatureWarning(ctx, state.opponent, moveById.get(state.opponent.activeSkillId));
    if (state.opponent.shield > 0) { ctx.strokeStyle = '#7fa4b1'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(state.opponent.x, state.opponent.y - 64, 37, 83, 0, 0, Math.PI * 2); ctx.stroke(); }
    const sorted = [...(state.obstacles || []).map(obstacle => ({ y: obstacle.y, draw: () => drawObstacle(ctx, obstacle) })),
      { y: state.player.y, draw: () => drawBrawlCharacter(ctx, state.player, { isPlayer: true, name: '我', elapsed: state.elapsed, reducedMotion }) },
      { y: state.opponent.y, draw: () => drawBrawlCharacter(ctx, state.opponent, { isPlayer: false, name: opponent.name, elapsed: state.elapsed, reducedMotion }) }].sort((a, b) => a.y - b.y);
    for (const item of sorted) item.draw();
    for (const projectile of state.projectiles || []) { ellipse(ctx, projectile.x + 2, projectile.y + 5, 8, 4, '#5b6a5626'); ellipse(ctx, projectile.x, projectile.y - 8, 10, 9, projectile.color || '#fffae6'); text(ctx, projectile.label || '⌁', projectile.x, projectile.y - 4, projectile.label ? 10 : 15, projectile.owner === 'opponent' ? '#fff6e7' : '#b4a484'); }
    for (const effect of state.effects || []) drawEffect(ctx, effect, reducedMotion);
    ctx.restore();
  }
  const write = (item, value) => { if (item.textContent !== value) item.textContent = value; };
  function update() {
    if (disposed) return;
    const state = model.getState();
    for (const [actor, display] of [[state.player, playerHud], [state.opponent, opponentHud]]) {
      const hp = Math.max(0, Math.ceil(actor.hp)); write(display.hp, `${hp}${actor.shield > 0 ? ` +${Math.ceil(actor.shield)}盾` : ''}`); display.fill.style.width = `${Math.max(0, actor.hp / actor.maxHp) * 100}%`;
      display.track.setAttribute('aria-valuenow', String(hp)); display.track.setAttribute('aria-valuemax', String(actor.maxHp)); display.track.classList.toggle('is-low', actor.hp < actor.maxHp * .3);
    }
    write(clock.querySelector('strong'), String(Math.max(0, Math.ceil(state.remaining))));
    write(energyLabel, `下班氣勢 ${Math.floor(state.player.energy)}%`); energyFill.style.width = `${state.player.energy}%`;
    write(combo, state.combo > 1 ? `${state.combo} 連擊` : ''); combo.classList.toggle('is-active', state.combo > 1);
    buttons.special.disabled = state.player.energy < 100 || state.phase !== 'playing';
    buttons.throw.disabled = !state.player.paper || state.phase !== 'playing';
    buttons.dodge.disabled = state.player.cooldowns.dodge > 0 || state.phase !== 'playing';
    buttons.attack.disabled = state.phase !== 'playing';
    buttons.special.setAttribute('aria-label', `下班無雙，氣勢 ${Math.floor(state.player.energy)}%，鍵盤 K`);
    buttons.dodge.querySelector('small').textContent = state.player.cooldowns.dodge > 0 ? `${state.player.cooldowns.dodge.toFixed(1)}秒` : '閃避';
    buttons.throw.querySelector('small').textContent = state.player.paper ? '已拿紙團' : '靠近撿取';
    buttons.special.classList.toggle('is-ready', state.player.energy >= 100);
    pauseButton.disabled = state.phase === 'ready' || state.phase === 'finished'; write(pauseButton, state.phase === 'paused' ? '繼續 ▷' : '暫停 Ⅱ');
    const activeMove = moveById.get(state.opponent.activeSkillId), notice = state.signature.history.at(-1);
    abilityToast.hidden = state.phase !== 'playing' || !notice || state.elapsed - notice.time > 3;
    if (notice) { write(abilityName, notice.type === 'opening' ? `${opponent.name} · 開場白` : notice.name); write(abilityLine, notice.text); }
    const castHint = activeMove && state.opponent.telegraphRemaining > 0 ? `${activeMove.name}：${activeMove.counter}` : null;
    let message = state.phase === 'ready' ? '準備好再開始；下方可查看對手招式。' : state.phase === 'paused' ? '已暫停，準備好再繼續。' : castHint || (state.opponent.action === 'windup' ? `${opponent.name}準備出手，看準扇形範圍再閃避。` : state.player.slowRemaining > 0 ? '暫時被拖慢腳步，仍可用空白鍵閃避。' : state.player.energy >= 100 ? '下班氣勢已滿，按 K 或「無雙」！' : state.player.paper ? '手上有紙團，按 L 或「丟」拉開距離。' : '按住「擊」連段，注意對手出手前的提示。');
    if (message !== lastStatus) { write(status, message); lastStatus = message; }
    overlay.hidden = state.phase !== 'ready' && state.phase !== 'paused';
    root.dataset.phase = state.phase; draw(state);
  }
  function complete() {
    if (disposed || finished) return;
    const state = model.getState(); if (state.phase !== 'finished') return;
    finished = true; controls.clear(); view.cancelAnimationFrame(frameId); onFinish(state.outcome, state.summary);
  }
  function start() {
    if (disposed || model.getState().phase !== 'ready') return;
    controls.clear(); model.start(); previousTime = null; update(); canvas.focus({ preventScroll: true });
  }
  function pause(focus = true) {
    if (disposed || model.getState().phase !== 'playing') return;
    controls.clear(); model.pause(); previousTime = null;
    panelKicker.textContent = '先停一下，也沒關係'; panelTitle.textContent = '這場對戰，等你回來'; panelCopy.textContent = '準備好再繼續；認輸離場會依敗方送醫收尾。';
    readyRules.hidden = true; startButton.hidden = true; resumeButton.hidden = false; forfeitButton.hidden = false;
    update(); if (focus) resumeButton.focus({ preventScroll: true });
  }
  function resume() {
    if (disposed || model.getState().phase !== 'paused') return;
    controls.clear(); model.resume(); previousTime = null; update(); canvas.focus({ preventScroll: true });
  }
  function frame(time) {
    if (disposed || finished) return;
    const state = model.getState();
    if (state.phase === 'playing') {
      const dt = previousTime === null ? 0 : Math.min(.05, Math.max(0, (time - previousTime) / 1000)); previousTime = time;
      if (dt > 0) model.step(dt, controls.read());
    } else previousTime = null;
    update(); complete(); if (!disposed && !finished) frameId = view.requestAnimationFrame(frame);
  }
  resize();
  if (typeof view.ResizeObserver === 'function') { resizeObserver = new view.ResizeObserver(resize); resizeObserver.observe(stage); }
  else view.addEventListener('resize', resize);
  update(); startButton.focus({ preventScroll: true }); frameId = view.requestAnimationFrame(frame);
  return {
    requestExit() { if (disposed || model.getState().phase === 'ready') return true; pause(); return false; },
    pause,
    getState: () => model.getState(),
    destroy() { if (disposed) return; disposed = true; controls.destroy(); view.cancelAnimationFrame(frameId); resizeObserver?.disconnect(); view.removeEventListener('resize', resize); root.remove(); },
  };
}
