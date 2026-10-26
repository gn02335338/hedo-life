import { bindIslandBrawlInput } from './brawl-ui.js';
import { drawBrawlCharacter } from './brawl-characters.js';
import { ISLAND_VISITOR_LOOK } from './character-looks.js';
import { createIslandPvpClient, islandPvpInviteUrl, normalizePvpRoomCode } from './pvp-client.js';

const COLORS = ['#4b8199', '#bd765d'];
const LOOKS = Object.freeze(COLORS.map(shirt => Object.freeze({ ...ISLAND_VISITOR_LOOK, shirt })));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const neutral = () => ({ x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
const write = (node, text) => { if (node.textContent !== String(text)) node.textContent = String(text); };
function ellipse(ctx, x, y, rx, ry, fill) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function label(ctx, value, x, y, size, color) { ctx.fillStyle = color; ctx.font = `650 ${size}px "PingFang TC",sans-serif`; ctx.textAlign = 'center'; ctx.fillText(value, x, y); }
function rectangle(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius); else ctx.rect(x, y, width, height);
  ctx.fillStyle = fill; ctx.fill();
}
function drawArena(ctx, state, names, ownSeat, width, height, dpr, reducedMotion) {
  const fighters = state?.fighters || [0, 1].map(seat => ({ id: 'player', seat, x: seat ? 710 : 250, y: 270, facing: seat ? Math.PI : 0, radius: 18, action: 'idle', paper: false }));
  const left = Math.min(0, ...fighters.map(actor => actor.x - 80)), top = Math.min(0, ...fighters.map(actor => actor.y - 210));
  const right = Math.max(960, ...fighters.map(actor => actor.x + 80)), bottom = Math.max(540, ...fighters.map(actor => actor.y + 35));
  const scale = Math.min(width / (right - left), height / (bottom - top));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#b8cbbd'; ctx.fillRect(0, 0, width, height);
  ctx.save(); ctx.translate((width - (right - left) * scale) / 2 - left * scale, (height - (bottom - top) * scale) / 2 - top * scale); ctx.scale(scale, scale);
  rectangle(ctx, 18, 18, 924, 504, 28, '#ece7d5'); ctx.strokeStyle = '#d4d5bf'; ctx.lineWidth = 1;
  for (let x = 50; x < 940; x += 58) { ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x, 510); ctx.stroke(); }
  for (let y = 60; y < 520; y += 44) { ctx.beginPath(); ctx.moveTo(32, y); ctx.lineTo(928, y); ctx.stroke(); }
  ellipse(ctx, 480, 270, 105, 105, '#dce2cb'); label(ctx, '朋友，場上見。', 480, 260, 25, '#a3ad94'); label(ctx, 'MOVING ISLAND · FRIENDLY DUEL', 480, 290, 11, '#a3ad94');
  for (const pickup of state?.pickups || []) if (pickup.available) { ellipse(ctx, pickup.x, pickup.y + 4, 15, 7, '#879a7433'); ellipse(ctx, pickup.x, pickup.y, 10, 9, '#fffaf0'); label(ctx, '紙團', pickup.x, pickup.y + 25, 12, '#859174'); }
  const objects = (state?.obstacles || []).map(obstacle => ({ y: obstacle.y, draw() {
    const { x, y, radius = 30 } = obstacle;
    ellipse(ctx, x + 3, y + 6, radius, radius * .45, '#59735a30');
    rectangle(ctx, x - radius * .8, y - radius, radius * 1.6, radius * 1.1, 6, obstacle.type === 'planter' ? '#c09a79' : '#d3bd99');
    if (obstacle.type === 'planter') { ellipse(ctx, x - 11, y - radius, radius * .7, radius * .6, '#7e9c70'); ellipse(ctx, x + 11, y - radius - 6, radius * .65, radius * .65, '#94b07d'); }
    else { rectangle(ctx, x - 5, y - radius, 10, radius * 1.1, 1, '#f8efd9'); label(ctx, '文件', x, y - 10, 12, '#8f7c60'); }
  } }));
  fighters.forEach((fighter, seat) => objects.push({ y: fighter.y, draw() {
    drawBrawlCharacter(ctx, fighter, { isPlayer: seat === ownSeat, name: `${seat + 1}P · ${names[seat] || '等待島民'}`, elapsed: state?.elapsed || 0, reducedMotion, lookOverride: LOOKS[seat] });
    ctx.strokeStyle = COLORS[seat]; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(fighter.x, fighter.y + 1, 28, 10, 0, 0, Math.PI * 2); ctx.stroke();
  } }));
  objects.sort((a, b) => a.y - b.y).forEach(object => object.draw());
  for (const projectile of state?.projectiles || []) { ellipse(ctx, projectile.x, projectile.y + 5, 8, 4, '#7b87682b'); ellipse(ctx, projectile.x, projectile.y - 6, 9, 8, '#fffaf0'); }
  for (const effect of state?.effects || []) {
    const ratio = clamp((effect.life || 0) / (effect.maxLife || 1), 0, 1), progress = reducedMotion ? .4 : 1 - ratio;
    ctx.save(); ctx.globalAlpha = ratio; ctx.strokeStyle = COLORS[effect.owner === 1 ? 1 : 0]; ctx.lineWidth = 3 + ratio * 3;
    ctx.beginPath(); ctx.arc(effect.x, effect.y, (effect.radius || 28) * (.55 + progress * .45), effect.type === 'slash' ? (effect.angle || 0) - .8 : 0, effect.type === 'slash' ? (effect.angle || 0) + .8 : Math.PI * 2); ctx.stroke();
    if (effect.text) label(ctx, effect.text, effect.x, effect.y - 45 - progress * 12, 23, COLORS[effect.owner === 1 ? 1 : 0]); ctx.restore();
  }
  ctx.restore();
}

/** The server owns the match. This view only samples controls and interpolates
 * positions between received snapshots; it never awards a hit, win or save. */
export function mountIslandPvp({ container, onClose = () => {}, onStatus = () => {}, inviteCode = '', storage,
  clientFactory = createIslandPvpClient, clientOptions = {}, reducedMotion = false } = {}) {
  const doc = container.ownerDocument || document, view = doc.defaultView || window;
  if (storage === undefined) { try { storage = view.localStorage; } catch {} }
  const node = (tag, className = '', value) => { const item = doc.createElement(tag); if (className) item.className = className; if (value !== undefined) item.textContent = value; return item; };
  const listen = (target, type, action, options) => { target.addEventListener(type, action, options); removers.push(() => target.removeEventListener(type, action, options)); };
  const button = (className, text, action) => { const item = node('button', className, text); item.type = 'button'; if (action) listen(item, 'click', action); return item; };
  const removers = [];
  let disposed = false, busy = false, acceptedExit = false, confirming = false, controls = null, focusLost = false;
  let frameId = null, inputTimer = null, observer = null, width = 960, height = 540, dpr = 1, lastStatusKey = '';
  let state = { connection: 'idle', roomCode: null, seat: null, room: null, combat: null, serverOffsetMs: 0, error: null };
  let previousSnapshot = null, currentSnapshot = null, snapshotAt = 0, lastMatchId = null;
  let pendingInput = neutral();
  const root = node('section', 'pvp-shell'); root.dataset.pvpRoot = '';
  const heading = node('div', 'pvp-heading'), titleGroup = node('div');
  titleGroup.append(node('span', 'eyebrow', 'FRIENDS · LIVE ON THE ISLAND'));
  const title = node('h3', '', '朋友，場上見。'); titleGroup.append(title);
  const connection = node('span', 'pvp-connection', '邀朋友來一場'); connection.dataset.state = 'idle'; heading.append(titleGroup, connection); root.append(heading);
  const notice = node('p', 'pvp-notice'); notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite'); root.append(notice);
  const lobby = node('section', 'pvp-lobby');
  lobby.append(node('p', 'pvp-intro', '開一個房間，把連結傳給朋友。兩個人都準備好，就能各自操作小人即時交手。'));
  const nickLabel = node('label', 'pvp-label', '這一場，怎麼稱呼你？'), nickname = node('input'); nickname.type = 'text'; nickname.maxLength = 24; nickname.autocomplete = 'off'; nickname.placeholder = '島民'; nickname.setAttribute('aria-label', '對戰暱稱，最多十二個字'); nickLabel.append(nickname); lobby.append(nickLabel);
  const entrances = node('div', 'pvp-entrances'), createCard = node('section', 'pvp-entrance');
  createCard.append(node('span', 'pvp-step', '01 · 我來開房'), node('h3', '', '在庭院等你。'), node('p', '', '建立雙人房間，分享邀請連結或房間代碼。'));
  const create = button('primary-button', '建立對戰房間 →', () => begin(null)); create.dataset.pvpCreate = ''; createCard.append(create);
  const joinForm = node('form', 'pvp-entrance'); joinForm.append(node('span', 'pvp-step', '02 · 我有邀請'), node('h3', '', '朋友已經在等。'));
  const codeLabel = node('label', 'pvp-label', '房間代碼'), code = node('input'); code.type = 'text'; code.maxLength = 12; code.autocomplete = 'off'; code.autocapitalize = 'characters'; code.spellcheck = false; code.placeholder = 'ABCD-EFGH'; code.value = normalizePvpRoomCode(inviteCode); code.setAttribute('aria-label', '八碼對戰房間代碼'); code.dataset.pvpCodeInput = ''; codeLabel.append(code);
  const join = node('button', 'primary-button', '加入朋友的房間 →'); join.type = 'submit'; join.dataset.pvpJoin = ''; joinForm.append(codeLabel, join); listen(joinForm, 'submit', event => { event.preventDefault(); begin(code.value); });
  entrances.append(createCard, joinForm); lobby.append(entrances, node('p', 'pvp-rules', '請朋友用自己的裝置或另一個瀏覽器加入；同一瀏覽器代表同一位玩家。兩邊同樣 160 體力、相同招式；75 秒內擊倒對方，或比剩餘體力。好友切磋不計入故事勝場，也不會改動島上處置。'));
  const back = button('pvp-text-button', '先回島上走走', () => leave()); lobby.append(back); root.append(lobby);
  const roomView = node('section', 'pvp-room'); roomView.hidden = true;
  const roomHeader = node('div', 'pvp-room-header'), roomCode = node('strong', 'pvp-room-code'), roomHint = node('span', '', '把連結或代碼交給朋友');
  const roomConnection = node('span', 'pvp-room-connection', '連線中');
  roomCode.setAttribute('aria-label', '目前房間代碼'); roomCode.dataset.pvpRoomCode = '';
  const invite = node('input', 'pvp-invite'); invite.type = 'text'; invite.readOnly = true; invite.setAttribute('aria-label', '對戰邀請連結');
  const copyButton = button('pvp-copy-button', '複製邀請連結', async () => {
    if (disposed || !invite.value) return;
    try { await view.navigator.clipboard.writeText(invite.value); if (!disposed) write(notice, '邀請連結已複製，傳給朋友就能一起進場。'); }
    catch { invite.focus(); invite.select?.(); write(notice, '請選取上方連結手動複製。'); }
  }); copyButton.dataset.pvpCopy = '';
  const leaveButton = button('pvp-text-button', '離開房間', () => { if (requestExit()) leave(); }); leaveButton.dataset.pvpLeave = '';
  const roomCodeGroup = node('div', 'pvp-room-code-group'); roomCodeGroup.append(node('small', '', 'ROOM'), roomCode, roomConnection, roomHint); roomHeader.append(roomCodeGroup, leaveButton);
  const share = node('div', 'pvp-share'); share.append(invite, copyButton); roomView.append(roomHeader, share);
  const hud = node('div', 'pvp-hud');
  const health = seat => {
    const card = node('div', `pvp-player pvp-player-${seat}`), line = node('div', 'pvp-player-line'), name = node('strong', '', `${seat + 1}P · 等待島民`), hp = node('span', '', '160');
    line.append(name, hp); const track = node('div', 'pvp-health-track'), fill = node('span'); track.setAttribute('role', 'progressbar'); track.setAttribute('aria-label', `${seat + 1}P 體力`); track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '160'); track.setAttribute('aria-valuenow', '160'); track.append(fill);
    const status = node('small', 'pvp-player-status', '等候入場'); card.append(line, track, status); return { card, name, hp, track, fill, status };
  };
  const healthCards = [health(0), health(1)], clock = node('div', 'pvp-clock'); clock.append(node('small', '', '切磋倒數')); const clockValue = node('strong', '', '75'); clock.append(clockValue); hud.append(healthCards[0].card, clock, healthCards[1].card); roomView.append(hud);
  const energyRow = node('div', 'pvp-energy-row'), energyLabel = node('span', '', '下班氣勢 25%'), energyTrack = node('div', 'pvp-energy-track'), energyFill = node('span'); energyTrack.append(energyFill); energyRow.append(energyLabel, energyTrack); roomView.append(energyRow);
  const stage = node('div', 'pvp-stage'), canvas = node('canvas', 'pvp-canvas'); canvas.tabIndex = 0; canvas.setAttribute('aria-label', '兩位玩家的即時切磋庭院'); stage.append(canvas);
  let ctx; try { ctx = canvas.getContext('2d', { alpha: false }); } catch {}
  if (!ctx) {
    lobby.hidden = true;
    root.append(node('p', 'pvp-notice', '這台裝置暫時無法顯示對戰場地，請改用支援 Canvas 的瀏覽器。'), button('primary-button', '回到小島', onClose)); container.append(root);
    return { requestExit: () => true, destroy() { disposed = true; for (const remove of removers.splice(0)) remove(); root.remove(); }, getState: () => ({ connection: 'unavailable' }) };
  }
  const overlay = node('div', 'pvp-overlay'), panel = node('div', 'pvp-overlay-panel'), panelKicker = node('span', 'eyebrow'), panelTitle = node('h3'), panelCopy = node('p'), panelTime = node('strong', 'pvp-countdown');
  const ready = button('primary-button', '我準備好了 →', () => { const own = state.room?.players[state.seat]; client.ready(!own?.ready); }); ready.dataset.pvpReady = '';
  const rematch = button('primary-button', '再打一場 →', () => client.rematch()); rematch.dataset.pvpRematch = '';
  const reconnect = button('primary-button', '重新加入這個房間 →', () => begin(state.roomCode)); reconnect.dataset.pvpReconnect = '';
  const newRoom = button('primary-button', '重新開一個房間 →', () => begin(null)); newRoom.dataset.pvpNewRoom = '';
  const roomBack = button('pvp-text-button', '離開房間，回島上', () => leave()); panel.append(panelKicker, panelTitle, panelCopy, panelTime, ready, rematch, reconnect, newRoom, roomBack); overlay.append(panel); stage.append(overlay);
  const exitOverlay = node('div', 'pvp-exit-overlay'); exitOverlay.hidden = true; const exitPanel = node('div', 'pvp-overlay-panel'), exitTitle = node('h3', '', '要離開這一場嗎？'); exitTitle.id = 'pvp-exit-title'; exitOverlay.setAttribute('role', 'group'); exitOverlay.setAttribute('aria-labelledby', exitTitle.id);
  const exitCopy = node('p'), stay = button('primary-button', '繼續留在房間', () => { confirming = false; exitOverlay.hidden = true; updateControls(); canvas.focus({ preventScroll: true }); }); stay.dataset.pvpStay = '';
  const confirmLeave = button('pvp-danger-button', '離開房間', () => leave()); confirmLeave.dataset.pvpConfirmLeave = ''; exitPanel.append(exitTitle, exitCopy, stay, confirmLeave); exitOverlay.append(exitPanel); stage.append(exitOverlay); roomView.append(stage);
  const gameHint = node('p', 'pvp-game-hint', '等待兩位島民準備。'); gameHint.setAttribute('role', 'status'); roomView.append(gameHint);
  const controlRow = node('div', 'pvp-controls'), pad = node('div', 'brawl-pad pvp-pad'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', '方向搖桿，按住拖曳或按方向鍵'); pad.append(node('span', 'brawl-stick', '步'));
  const directionButtons = ['up', 'left', 'right', 'down'].map((direction, index) => { const item = button(`brawl-direction is-${direction}`, ['↑', '←', '→', '↓'][index]); item.dataset.brawlMove = direction; item.setAttribute('aria-label', ['向上移動', '向左移動', '向右移動', '向下移動'][index]); pad.append(item); return item; });
  const keyboardHint = node('div', 'pvp-keyboard', 'W A S D／方向鍵\n走位 · 靠近紙團自動撿取'), actions = node('div', 'brawl-actions'), buttons = {};
  for (const [action, big, small, key] of [['attack', '擊', '按住連段', 'J'], ['dodge', '閃', '閃避', 'SPACE'], ['special', '無雙', '氣勢蓄滿', 'K'], ['throw', '丟', '靠近撿取', 'L']]) {
    const item = button(`brawl-action is-${action}`); item.append(node('strong', '', big), node('small', '', small), node('kbd', '', key)); item.setAttribute('aria-label', `${small}，鍵盤 ${key}`); buttons[action] = item; actions.append(item);
  }
  controlRow.append(keyboardHint, pad, actions); roomView.append(controlRow, node('p', 'pvp-control-note', 'J 連擊 · 空白鍵閃避 · K 無雙 · L 丟紙團。切換分頁不會暫停，會鬆開操作；離開本場視為認輸。')); root.append(roomView); container.append(root);
  const client = clientFactory({ storage, location: view.location, ...clientOptions, onChange: update, onSnapshot(combat, meta) {
    if (disposed) return;
    const fresh = lastMatchId !== meta.matchId; previousSnapshot = fresh ? combat : currentSnapshot || combat; currentSnapshot = combat; snapshotAt = performance.now(); lastMatchId = meta.matchId;
  } });
  async function begin(room) {
    if (disposed || busy) return;
    busy = true; create.disabled = join.disabled = true; write(notice, room === null ? '正在準備你的房間…' : '正在加入朋友的房間…');
    try { if (room === null) await client.create(nickname.value); else await client.join(room, nickname.value); }
    catch (error) { if (!disposed) write(notice, error?.message || '暫時無法加入，請再試一次。'); }
    finally { busy = false; if (!disposed) { create.disabled = join.disabled = false; } }
  }
  function playing() { return !disposed && !confirming && !doc.hidden && state.connection === 'connected' && state.room?.phase === 'playing' && state.combat?.phase === 'playing'; }
  function clearControls() { controls?.clear(); pendingInput = neutral(); client.clearInput(); }
  function updateControls() {
    if (playing() && !controls) {
      controls = bindIslandBrawlInput({ document: doc, window: view, pad, buttons, directionButtons, getPhase: () => playing() ? 'playing' : 'waiting',
        onPause() { clearControls(); if (!focusLost && !doc.hidden) requestExit(); }, onStart() {} });
      inputTimer = view.setInterval(() => {
        if (!playing()) return;
        const input = controls.read();
        pendingInput = { ...input, dodge: pendingInput.dodge || input.dodge, special: pendingInput.special || input.special, throw: pendingInput.throw || input.throw };
        if (client.sendInput(pendingInput)) pendingInput = neutral();
      }, 50);
    } else if (!playing() && controls) {
      controls.destroy(); controls = null; pendingInput = neutral(); if (inputTimer !== null) view.clearInterval(inputTimer); inputTimer = null; client.clearInput();
    }
    const actor = state.combat?.fighters[state.seat];
    for (const item of directionButtons) item.disabled = !playing();
    buttons.attack.disabled = !playing(); buttons.dodge.disabled = !playing() || (actor?.cooldowns?.dodge || 0) > 0;
    buttons.special.disabled = !playing() || (actor?.energy || 0) < 100; buttons.throw.disabled = !playing() || !actor?.paper;
    buttons.special.classList.toggle('is-ready', playing() && actor?.energy >= 100);
  }
  function update(next) {
    if (disposed) return;
    if (next.room?.matchId !== state.room?.matchId) { previousSnapshot = currentSnapshot = null; lastMatchId = next.room?.matchId ?? null; }
    state = next; const room = state.room, phase = ['expired', 'cancelled'].includes(state.terminalReason) ? state.terminalReason : room?.phase || 'waiting';
    lobby.hidden = Boolean(state.roomCode && state.seat !== null); roomView.hidden = !lobby.hidden;
    root.dataset.phase = phase; connection.dataset.state = state.connection;
    write(connection, { idle: '邀朋友來一場', connecting: '連線中', connected: '雙人即時連線', reconnecting: '正在接回房間', failed: '連線未完成', closed: '已離開房間' }[state.connection] || '連線中');
    write(roomConnection, phase === 'expired' ? '房間已到期' : phase === 'cancelled' ? '本場取消' : { connected: '即時連線', reconnecting: '重連中', failed: '連線中斷', closed: '已離席' }[state.connection] || '連線中'); roomConnection.dataset.state = state.connection;
    if (state.error) write(notice, state.error); else if (state.connection === 'connected') write(notice, '');
    if (state.roomCode) { write(roomCode, `${state.roomCode.slice(0, 4)}-${state.roomCode.slice(4)}`); invite.value = islandPvpInviteUrl(state.roomCode, view.location); }
    for (let seat = 0; seat < 2; seat++) {
      const player = room?.players[seat], actor = state.combat?.fighters[seat], hp = Math.max(0, Math.ceil(actor?.hp ?? 160)), display = healthCards[seat];
      write(display.name, `${seat + 1}P · ${player?.occupied ? player.nickname : '等朋友入場'}${state.seat === seat ? '（你）' : ''}`);
      write(display.hp, hp); display.track.setAttribute('aria-valuenow', String(hp)); display.fill.style.width = `${hp / 160 * 100}%`;
      write(display.status, !player?.occupied ? '空位，等朋友加入' : !player.connected ? '連線中斷' : phase === 'waiting' ? player.ready ? '已準備好' : '尚未準備' : phase === 'finished' && player.rematch ? '想再打一場' : phase === 'playing' ? '場上切磋中' : '已連線');
    }
    const actor = state.combat?.fighters[state.seat]; write(energyLabel, `你的下班氣勢 ${Math.floor(actor?.energy ?? 25)}%`); energyFill.style.width = `${actor?.energy ?? 25}%`;
    write(clockValue, Math.max(0, Math.ceil(state.combat?.remaining ?? 75)));
    const key = `${state.connection}:${phase}:${state.roomCode || ''}`;
    if (key !== lastStatusKey) { lastStatusKey = key; onStatus({ phase, connection: state.connection, roomCode: state.roomCode, seat: state.seat }); }
    updateControls(); updateOverlay();
  }
  function updateOverlay() {
    const room = state.room, phase = ['expired', 'cancelled'].includes(state.terminalReason) ? state.terminalReason : room?.phase;
    const connected = state.connection === 'connected', me = room?.players[state.seat];
    overlay.hidden = connected && phase === 'playing' && Boolean(state.combat); ready.hidden = rematch.hidden = reconnect.hidden = newRoom.hidden = true; roomBack.hidden = true; panelTime.hidden = true;
    if (overlay.hidden) { write(gameHint, confirming ? '離開確認不會暫停對戰，場上仍在進行。' : '按住「擊」連段，看準出手再閃避。'); return; }
    write(panelKicker, state.seat === null ? 'FRIENDLY DUEL' : `你是 ${state.seat + 1}P · ${state.seat === 0 ? '藍隊' : '珊瑚隊'}`);
    if (phase === 'expired' || phase === 'cancelled') {
      write(panelTitle, phase === 'expired' ? '房間已到期，請重新開房。' : '這場切磋先取消。');
      write(panelCopy, phase === 'cancelled' ? '房間中斷，這場不計勝負。可以重新開房，再約朋友來一場。' : '建立新的房間，再把新的邀請連結交給朋友。舊代碼已經無法加入。'); newRoom.hidden = false; newRoom.disabled = busy; roomBack.hidden = false;
    } else if (state.connection === 'failed' || state.connection === 'closed') {
      write(panelTitle, '這段連線，先停一下'); write(panelCopy, state.error || '房間連線已結束。'); reconnect.hidden = !state.roomCode; reconnect.disabled = busy; roomBack.hidden = false;
    } else if (!connected) {
      write(panelTitle, state.connection === 'reconnecting' ? '正在接回這一場…' : '正在準備庭院…'); write(panelCopy, '重新連線時雙方會等待，操作也會先鬆開。請稍等一下。');
    } else if (phase === 'waiting') {
      const both = room.players.every(player => player.occupied && player.connected);
      write(panelTitle, both ? me?.ready ? '準備好了，等朋友點頭。' : '兩位都到齊了。' : '朋友，靠岸見。');
      write(panelCopy, both ? '雙方都按下準備，倒數三秒後開始。兩邊招式與體力完全相同。' : '把房間代碼或連結傳給朋友。請用自己的裝置或另一個瀏覽器加入；同一瀏覽器代表同一位玩家。');
      ready.hidden = false; ready.disabled = !me?.connected; write(ready, me?.ready ? '取消準備' : '我準備好了 →');
    } else if (phase === 'countdown') {
      write(panelTitle, '場上見。'); write(panelCopy, '倒數結束後，兩位玩家同時開始。'); panelTime.hidden = false;
      write(panelTime, Math.max(1, Math.ceil(((room.countdownEndsAt || 0) - (Date.now() + state.serverOffsetMs)) / 1000)));
    } else if (phase === 'paused') {
      const missing = room.players.find(player => !player.connected);
      write(panelTitle, '等一下，朋友正在接回來。'); write(panelCopy, `${missing?.nickname || '對方'}的連線中斷，雙方先停手；超過重連時間後，會依離線狀況收尾。`);
      panelTime.hidden = false; write(panelTime, `${Math.max(0, Math.ceil(((room.reconnectDeadline || 0) - (Date.now() + state.serverOffsetMs)) / 1000))}s`);
    } else if (phase === 'finished') {
      const combat = state.combat?.phase === 'finished' ? state.combat : null, result = combat?.winner === null ? '這一場，平手。' : combat?.winner === state.seat ? '這一場，你贏了。' : '這一場，朋友贏了。';
      write(panelTitle, combat ? result : '正在同步本場結果…');
      const reason = combat?.reason === 'knockout' ? '體力歸零，切磋結束。' : combat?.reason === 'timeout' ? '時間到，依剩餘體力收尾。' : '其中一方離場或未能重連，切磋已收尾。';
      write(panelCopy, combat ? `${reason} 好友對戰不計入故事勝場。` : '等候房間確認本場結果，先喘口氣。'); rematch.hidden = !combat; rematch.disabled = !me?.connected || me?.rematch === true;
      write(rematch, me?.rematch ? '已約再戰，等朋友同意' : room.players.some(player => player.rematch) ? '朋友想再戰，我也來 →' : '再打一場 →'); roomBack.hidden = false;
    } else { write(panelTitle, '正在同步場地…'); write(panelCopy, '雙方到齊後，就能開始這場切磋。'); }
    write(gameHint, phase === 'playing' ? '正在等候完整場地資料，操作尚未開啟。' : '對戰由房間同步；切換分頁會鬆開操作。');
  }
  function requestExit() {
    if (disposed || acceptedExit || !state.roomCode || state.seat === null || ['expired', 'cancelled', 'replaced'].includes(state.terminalReason) || ['finished', 'cancelled', 'expired'].includes(state.room?.phase)) return true;
    confirming = true; clearControls(); updateControls(); exitOverlay.hidden = false;
    const live = ['playing', 'paused', 'countdown'].includes(state.room?.phase);
    write(exitCopy, live ? '對戰仍會繼續。確認離開後，這一場會以離席收尾，不會暫停等待。' : '離開房間後，朋友會知道你已離席。'); write(confirmLeave, live ? '認輸並離開' : '離開房間'); stay.focus({ preventScroll: true }); return false;
  }
  function leave() { if (disposed) return; acceptedExit = true; clearControls(); client.leave(); onClose(); }
  listen(view, 'blur', () => { focusLost = true; clearControls(); updateControls(); }, true);
  listen(view, 'focus', () => { focusLost = false; controls?.clear(); updateControls(); }, true);
  listen(doc, 'visibilitychange', () => { clearControls(); if (!doc.hidden) focusLost = false; updateControls(); });
  listen(view, 'pagehide', () => { clearControls(); client.destroy(); });
  // During waiting/countdown there is no combat input owner; let the outer
  // dialog's native Escape use requestExit. Active input handles Escape itself.
  const resize = () => {
    if (disposed) return; const rect = canvas.getBoundingClientRect(); width = Math.max(1, rect.width || 960); height = Math.max(1, rect.height || 400);
    dpr = clamp(view.devicePixelRatio || 1, 1, 2); canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  };
  if (view.ResizeObserver) { observer = new view.ResizeObserver(resize); observer.observe(stage); } else listen(view, 'resize', resize);
  const render = time => {
    if (disposed) return;
    let visual = currentSnapshot || state.combat;
    if (!reducedMotion && previousSnapshot && currentSnapshot && previousSnapshot.fighters.length === 2) {
      const ratio = clamp((time - snapshotAt) / 100, 0, 1);
      visual = { ...currentSnapshot, fighters: currentSnapshot.fighters.map((actor, seat) => ({ ...actor,
        x: previousSnapshot.fighters[seat].x + (actor.x - previousSnapshot.fighters[seat].x) * ratio,
        y: previousSnapshot.fighters[seat].y + (actor.y - previousSnapshot.fighters[seat].y) * ratio })) };
    }
    if (!roomView.hidden && !doc.hidden) drawArena(ctx, visual, state.room?.players.map(player => player.nickname) || [], state.seat, width, height, dpr, reducedMotion);
    if (state.room?.phase === 'countdown' || state.room?.phase === 'paused') updateOverlay();
    frameId = view.requestAnimationFrame(render);
  };
  resize(); update(state); frameId = view.requestAnimationFrame(render);
  return {
    requestExit, getState: () => client.getState(),
    destroy() {
      if (disposed) return; disposed = true; controls?.destroy(); controls = null;
      if (inputTimer !== null) view.clearInterval(inputTimer); if (frameId !== null) view.cancelAnimationFrame(frameId);
      observer?.disconnect(); for (const remove of removers.splice(0)) remove(); client.destroy(); root.remove();
    },
  };
}
