import { ANONYMOUS_KEY } from './application-client.js';

const TOKEN = /^[a-f0-9]{64}$/;
const ROOM = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const PHASES = new Set(['waiting', 'countdown', 'playing', 'paused', 'finished', 'cancelled', 'expired']);
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function normalizePvpRoomCode(value) { return typeof value === 'string' ? value.normalize('NFKC').toUpperCase().replace(/[\s-]/g, '') : ''; }
export function islandPvpInviteUrl(code, location = globalThis.location) {
  const normalized = normalizePvpRoomCode(code);
  if (!ROOM.test(normalized)) throw new Error('請輸入 8 碼房間代碼。');
  const url = new URL('/island/', location.href);
  url.searchParams.set('duel', normalized);
  return url.href;
}
export function normalizePvpInput(value = {}) {
  let x = finite(value.x) ? Math.max(-1, Math.min(1, value.x)) : 0;
  let y = finite(value.y) ? Math.max(-1, Math.min(1, value.y)) : 0;
  const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
  return { x, y, attack: value.attack === true, dodge: value.dodge === true, special: value.special === true, throw: value.throw === true };
}
function publicRoom(value) {
  if (!value || !ROOM.test(value.roomCode || '') || !PHASES.has(value.phase) || !Array.isArray(value.players) || value.players.length !== 2
    || !finite(value.serverNow) || !finite(value.expiresAt)) return null;
  const players = value.players.map((player, seat) => player && player.seat === seat && typeof player.occupied === 'boolean'
    && typeof player.nickname === 'string' && [...player.nickname].length <= 12 && ['connected', 'ready', 'rematch'].every(key => typeof player[key] === 'boolean')
    ? { seat, occupied: player.occupied, nickname: player.nickname, connected: player.connected, ready: player.ready, rematch: player.rematch } : null);
  if (players.some(player => !player)) return null;
  if (![value.countdownEndsAt, value.reconnectDeadline].every(time => time === null || finite(time))) return null;
  if (!(typeof value.matchId === 'string' && value.matchId.length <= 100 || Number.isSafeInteger(value.matchId))) return null;
  return { roomCode: value.roomCode, phase: value.phase, players, matchId: value.matchId, expiresAt: value.expiresAt,
    countdownEndsAt: value.countdownEndsAt, reconnectDeadline: value.reconnectDeadline, serverNow: value.serverNow,
    reason: typeof value.reason === 'string' ? value.reason.slice(0, 100) : null };
}
function combatState(value) {
  if (!value || !['ready', 'playing', 'finished'].includes(value.phase) || !Array.isArray(value.fighters) || value.fighters.length !== 2
    || !finite(value.elapsed) || !finite(value.remaining) || !finite(value.duration) || value.duration !== 75
    || value.elapsed < 0 || value.elapsed > 76 || value.remaining < 0 || value.remaining > 75
    || ![null, 0, 1].includes(value.winner)) return null;
  if (value.fighters.some(actor => !actor || !['x', 'y', 'hp', 'maxHp', 'energy', 'facing', 'radius'].every(key => finite(actor[key]))
    || actor.x < -100 || actor.x > 1100 || actor.y < -100 || actor.y > 700 || actor.maxHp !== 160 || actor.hp < 0 || actor.hp > 160
    || actor.energy < 0 || actor.energy > 100 || actor.radius <= 0 || actor.radius > 50)) return null;
  if (!['obstacles', 'pickups', 'projectiles', 'effects'].every(key => Array.isArray(value[key]) && value[key].length <= 100
    && value[key].every(row => row && finite(row.x) && finite(row.y) && Math.abs(row.x) < 3000 && Math.abs(row.y) < 3000))) return null;
  const numbers = (row, keys) => Object.fromEntries(keys.filter(key => finite(row[key])).map(key => [key, row[key]]));
  const fighters = value.fighters.map((row, seat) => ({ id: 'player', seat, ...numbers(row, ['x', 'y', 'radius', 'hp', 'maxHp', 'energy', 'maxEnergy', 'facing', 'combo', 'actionRemaining', 'telegraphRemaining', 'telegraphDuration', 'telegraphRadius', 'telegraphHalfAngle', 'attackRadius', 'attackHalfAngle']),
    action: typeof row.action === 'string' ? row.action.slice(0, 30) : 'idle', paper: row.paper === true, invulnerable: row.invulnerable === true,
    cooldowns: { attack: 0, dodge: 0, special: 0, throw: 0, ...numbers(row.cooldowns || {}, ['attack', 'dodge', 'special', 'throw']) } }));
  return { phase: value.phase, winner: value.winner, reason: typeof value.reason === 'string' ? value.reason.slice(0, 100) : null,
    elapsed: value.elapsed, duration: value.duration, remaining: value.remaining, fighters,
    obstacles: value.obstacles.map(row => ({ ...numbers(row, ['x', 'y', 'radius']), type: row.type === 'planter' ? 'planter' : 'boxes' })),
    pickups: value.pickups.map(row => ({ ...numbers(row, ['x', 'y', 'radius']), available: row.available === true })),
    projectiles: value.projectiles.map(row => ({ ...numbers(row, ['x', 'y', 'radius']), owner: row.owner === 1 ? 1 : 0 })),
    effects: value.effects.map(row => ({ ...numbers(row, ['x', 'y', 'radius', 'angle', 'life', 'maxLife']), owner: row.owner === 1 ? 1 : 0,
      type: typeof row.type === 'string' ? row.type.slice(0, 30) : 'impact', text: typeof row.text === 'string' ? row.text.slice(0, 30) : '' })),
    stats: Array.isArray(value.stats) ? value.stats.slice(0, 2).map(row => numbers(row || {}, ['damageDealt', 'damageTaken', 'maxCombo', 'specialsUsed', 'throwsUsed', 'dodgesUsed'])) : [] };
}

/** Anonymous room transport. Tokens and seat tickets stay private to this closure;
 * only public room data and authoritative combat snapshots reach the view. */
export function createIslandPvpClient({ storage, fetcher = globalThis.fetch, WebSocketClass = globalThis.WebSocket,
  random = globalThis.crypto, location = globalThis.location, now = Date.now,
  schedule = globalThis.setTimeout, unschedule = globalThis.clearTimeout, requestTimeoutMs = 8000,
  onChange = () => {}, onSnapshot = () => {} } = {}) {
  let destroyed = false, generation = 0, socket = null, socketOwner = 0, inputSequence = 0, snapshotSequence = -1;
  let credential = null, registered = null, nickname = '島民', ticket = null, task = null, aborter = null;
  let retryTimer = null, retryDeadlineTimer = null, retryDeadline = 0, retries = 0, authTimer = null, terminal = false;
  let state = { connection: 'idle', roomCode: null, seat: null, room: null, combat: null, serverOffsetMs: 0, error: null, terminalReason: null };
  const emit = () => { if (!destroyed) onChange(copy(state)); };
  const errorText = error => error?.name === 'AbortError' || error?.name === 'TimeoutError' ? '連線等候太久，請再試一次。' : error?.message || '暫時無法連上對戰房間。';
  function getCredential() {
    try {
      if (!storage) throw new Error();
      const saved = storage.getItem(ANONYMOUS_KEY);
      if (TOKEN.test(saved || '')) return saved;
      const value = Array.from(random.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      storage.setItem(ANONYMOUS_KEY, value);
      if (storage.getItem(ANONYMOUS_KEY) !== value) throw new Error();
      return value;
    } catch { throw new Error('瀏覽器無法保存匿名憑證。請允許本站儲存資料後再建立或加入房間。'); }
  }
  function clearTimers() {
    for (const id of [retryTimer, retryDeadlineTimer, authTimer]) if (id !== null) unschedule(id);
    retryTimer = retryDeadlineTimer = authTimer = null;
  }
  function closeSocket() {
    const old = socket; socket = null; socketOwner++;
    if (authTimer !== null) unschedule(authTimer); authTimer = null;
    if (old) { old.onopen = old.onmessage = old.onclose = old.onerror = null; try { old.close(1000, 'disconnected'); } catch {} }
  }
  async function api(path, body, token, owner) {
    const controller = new AbortController(); aborter = controller;
    const timer = schedule(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetcher(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
      let data; try { data = await response.json(); } catch { throw new Error('房間回覆不完整，請再試一次。'); }
      if (destroyed || owner !== generation) throw Object.assign(new Error('已離開這次連線。'), { stale: true });
      if (!response.ok) throw Object.assign(new Error(data.message || '暫時無法加入對戰。'), { code: data.error, status: response.status });
      return data;
    } finally { unschedule(timer); if (aborter === controller) aborter = null; }
  }
  function send(message) {
    if (destroyed || !socket || socket.readyState !== 1) return false;
    try { if ((socket.bufferedAmount || 0) > 65536) return false; socket.send(JSON.stringify(message)); return true; } catch { return false; }
  }
  function fail(message, reason = null) {
    terminal = true; clearTimers(); aborter?.abort(); closeSocket(); ticket = null;
    state.connection = 'failed'; state.error = message; state.terminalReason = reason; emit();
  }
  function scheduleReconnect() {
    if (destroyed || terminal || !state.roomCode) return;
    if (!retryDeadline) {
      retryDeadline = now() + 15000; retries = 0;
      retryDeadlineTimer = schedule(() => fail('連線已中斷。可以重新加入房間，或建立新的一場。'), 15000);
    }
    state.connection = 'reconnecting'; state.error = '連線中斷，正在重新接回房間…'; emit();
    if (retryTimer !== null) return;
    const owner = generation, delay = Math.min(2500, 500 * 2 ** Math.min(3, retries++));
    retryTimer = schedule(async () => {
      retryTimer = null;
      if (destroyed || terminal || owner !== generation || now() >= retryDeadline) return;
      try {
        if (storage?.getItem(ANONYMOUS_KEY) !== credential) { fail('這個瀏覽器的匿名憑證已變更，請重新開啟對戰。'); return; }
        const reservation = await api(`/api/island/pvp/rooms/${state.roomCode}/join`, { nickname }, credential, owner);
        connectReservation(reservation, owner);
      } catch (error) {
        if (destroyed || owner !== generation || error.stale || terminal) return;
        if ([401, 403, 404, 409, 410].includes(error.status)) fail(errorText(error), error.status === 410 ? 'expired' : null); else scheduleReconnect();
      }
    }, delay);
  }
  function connectReservation(reservation, owner) {
    if (!reservation || !ROOM.test(reservation.roomCode || '') || ![0, 1].includes(reservation.seat)
      || typeof reservation.ticket !== 'string' || reservation.ticket.length < 32 || reservation.ticket.length > 200
      || reservation.socketPath !== `/api/island/pvp/rooms/${reservation.roomCode}/socket` || !finite(reservation.expiresAt)) throw new Error('房間憑證回覆不完整，請重試。');
    if (destroyed || owner !== generation) return;
    closeSocket(); ticket = reservation.ticket; state.roomCode = reservation.roomCode; state.seat = reservation.seat;
    state.connection = retryDeadline ? 'reconnecting' : 'connecting'; state.error = null; inputSequence = 0;
    const url = new URL(reservation.socketPath, location.href);
    if (url.origin !== new URL(location.href).origin) throw new Error('房間連線來源不正確。');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const connection = new WebSocketClass(url.href), connectionOwner = ++socketOwner; socket = connection; emit();
    const owned = () => !destroyed && owner === generation && socket === connection && connectionOwner === socketOwner;
    authTimer = schedule(() => { if (owned() && state.connection !== 'connected') { closeSocket(); scheduleReconnect(); } }, 6000);
    connection.onopen = () => { if (owned()) send({ type: 'auth', ticket }); };
    connection.onmessage = event => {
      if (!owned()) return;
      if (typeof event.data !== 'string' || event.data.length > 65536) { fail('對戰資料格式不正確，請重新加入。'); return; }
      let message; try { message = JSON.parse(event.data); } catch { fail('對戰資料格式不正確，請重新加入。'); return; }
      if (message?.type === 'room') {
        const room = publicRoom(message.room);
        if (!room || room.roomCode !== state.roomCode) { fail('房間回覆不正確，請重新加入。'); return; }
        if (state.room?.matchId !== room.matchId) { state.combat = null; snapshotSequence = -1; inputSequence = 0; }
        state.room = room; state.serverOffsetMs = room.serverNow - now(); state.connection = 'connected'; state.error = null; ticket = null;
        clearTimers(); retryDeadline = 0; retries = 0;
        if (['expired', 'cancelled'].includes(room.phase)) { terminal = true; state.terminalReason = room.phase; }
        emit();
      } else if (message?.type === 'snapshot') {
        if (!state.room || message.matchId !== state.room.matchId || !Number.isSafeInteger(message.sequence) || message.sequence <= snapshotSequence || !finite(message.serverNow)) return;
        const combat = combatState(message.state);
        if (!combat) { fail('對戰畫面資料不完整，請重新加入。'); return; }
        snapshotSequence = message.sequence; state.combat = combat; state.serverOffsetMs = message.serverNow - now();
        onSnapshot(copy(combat), { matchId: message.matchId, sequence: message.sequence, receivedAt: now() }); emit();
      } else if (message?.type === 'error') {
        const code = typeof message.code === 'string' ? message.code : '';
        const text = typeof message.message === 'string' ? message.message.slice(0, 200) : '房間暫時無法連線。';
        if (code === 'seat_replaced') fail(text, 'replaced');
        else if (['room_expired', 'pvp_room_expired'].includes(code)) fail(text, 'expired');
        else if (['room_cancelled', 'pvp_room_cancelled'].includes(code)) fail(text, 'cancelled');
        else { state.error = text; emit(); }
      }
    };
    connection.onerror = () => { if (owned()) { try { connection.close(); } catch { closeSocket(); scheduleReconnect(); } } };
    connection.onclose = event => {
      if (!owned()) return;
      socket = null; socketOwner++; ticket = null;
      if (authTimer !== null) unschedule(authTimer); authTimer = null;
      if (event.code === 4009 || event.reason === 'replaced') { fail('這個席位已在另一個分頁開啟，請在該分頁繼續。', 'replaced'); return; }
      if (event.code === 4410 || event.reason === 'expired') { fail('房間已到期，請重新開房。', 'expired'); return; }
      if (terminal || ['expired', 'cancelled'].includes(state.room?.phase)) { state.connection = 'closed'; emit(); return; }
      scheduleReconnect();
    };
  }
  function enter(code, name) {
    if (destroyed) return Promise.reject(new Error('這次對戰已關閉。'));
    if (task) return task;
    const normalized = code === null ? null : normalizePvpRoomCode(code);
    if (normalized !== null && !ROOM.test(normalized)) return Promise.reject(new Error('請輸入 8 碼房間代碼。'));
    const cleanName = typeof name === 'string' ? name.normalize('NFKC').trim() : '';
    if ([...cleanName].length > 12 || /[\u0000-\u001f\u007f]/.test(cleanName)) return Promise.reject(new Error('暱稱最多 12 個字，請勿使用控制字元。'));
    nickname = cleanName || '島民';
    const owner = ++generation; terminal = false; clearTimers(); retryDeadline = 0; closeSocket(); aborter?.abort();
    state = { connection: 'connecting', roomCode: normalized, seat: null, room: null, combat: null, serverOffsetMs: 0, error: null, terminalReason: null }; emit();
    task = (async () => {
      try {
        if (typeof WebSocketClass !== 'function') throw new Error('這個瀏覽器暫時不支援即時連線，請換個瀏覽器再加入。');
        credential = getCredential();
        if (registered !== credential) { await api('/api/player', { token: credential }, null, owner); registered = credential; }
        const reservation = await api(normalized ? `/api/island/pvp/rooms/${normalized}/join` : '/api/island/pvp/rooms', { nickname }, credential, owner);
        connectReservation(reservation, owner);
        return copy({ roomCode: state.roomCode, seat: state.seat });
      } catch (error) {
        if (!destroyed && owner === generation && !error.stale) { state.connection = 'failed'; state.error = errorText(error); state.terminalReason = error.status === 410 ? 'expired' : null; emit(); }
        throw error;
      }
    })().finally(() => { if (owner === generation) task = null; });
    return task;
  }
  return {
    create: name => enter(null, name), join: (code, name) => enter(code, name),
    getState: () => copy(state),
    ready: ready => state.connection === 'connected' && state.room?.phase === 'waiting' && send({ type: 'ready', matchId: state.room.matchId, ready: ready === true }),
    rematch: () => state.connection === 'connected' && state.room?.phase === 'finished' && send({ type: 'rematch', matchId: state.room.matchId }),
    sendInput(input) { return state.connection === 'connected' && state.room?.phase === 'playing' && send({ type: 'input', matchId: state.room.matchId, seq: ++inputSequence, input: normalizePvpInput(input) }); },
    clearInput() { return send({ type: 'input', matchId: state.room?.matchId, seq: ++inputSequence, input: normalizePvpInput() }); },
    leave() {
      if (destroyed) return;
      send({ type: 'leave', matchId: state.room?.matchId }); terminal = true; generation++; clearTimers(); aborter?.abort(); closeSocket(); ticket = credential = null; task = null;
      state.connection = 'closed'; state.error = null; emit();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; terminal = true; generation++; clearTimers(); aborter?.abort(); closeSocket(); ticket = credential = null; task = null;
    },
  };
}
