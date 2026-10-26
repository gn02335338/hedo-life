import { ApiError } from './http.js';
import { PVP_ROOM_LIFETIME_MS, PVP_CODE_PATTERN } from './island-pvp-directory.js';

export const PVP_GRACE_MS = 15000;
export const PVP_INPUT_STALE_MS = 250;
export const PVP_AUTH_MS = 5000;
const TICK_MS = 50, SNAPSHOT_MS = 100;
const activePhases = new Set(['countdown', 'playing', 'paused']);
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key));
const neutral = () => ({ x: 0, y: 0, attack: false, dodge: false, special: false, throw: false, lastAt: -Infinity });
const detached = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const defaultTicket = () => [...crypto.getRandomValues(new Uint8Array(32))].map(value => value.toString(16).padStart(2, '0')).join('');
async function hashTicket(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export function parsePvpInput(value) {
  if (!keysAre(value, ['x', 'y', 'attack', 'dodge', 'special', 'throw']) || !['x', 'y'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && Math.abs(value[key]) <= 1)
    || !['attack', 'dodge', 'special', 'throw'].every(key => typeof value[key] === 'boolean')) {
    throw new ApiError(400, 'invalid_pvp_input', '操作格式不正確。');
  }
  const length = Math.hypot(value.x, value.y), divisor = Math.max(1, length);
  return { x: value.x / divisor, y: value.y / divisor, attack: value.attack, dodge: value.dodge, special: value.special, throw: value.throw };
}

// The room coordinator is transport-independent. The DO adapter supplies a
// durable metadata store and hibernating sockets; only an active bout has a timer.
export class IslandPvpSession {
  constructor({ persisted = null, sockets = [], createCombat, now = Date.now, persist = async () => {}, erase = async () => {}, schedule = async () => {},
    ticket = defaultTicket, uuid = () => crypto.randomUUID(), setInterval: interval = globalThis.setInterval, clearInterval: clear = globalThis.clearInterval } = {}) {
    this.now = now; this.persist = persist; this.erase = erase; this.schedule = schedule;
    this.createCombat = createCombat; this.ticket = ticket; this.uuid = uuid; this.interval = interval; this.clearInterval = clear;
    this.meta = persisted ? detached(persisted) : null; this.model = null; this.resultSnapshot = this.meta?.snapshot || null;
    this.connections = new Map(); this.owners = [null, null]; this.inputs = [neutral(), neutral()]; this.pending = Promise.resolve();
    this.timer = null; this.clockBaseline = 0; this.pausedAt = null; this.sequence = 0; this.lastSnapshotAt = -Infinity;
    for (const socket of sockets) {
      let attachment; try { attachment = socket.deserializeAttachment(); } catch { attachment = null; }
      const seat = attachment?.seat;
      const info = { seat: Number.isInteger(seat) && seat >= 0 && seat < 2 && this.meta?.seats?.[seat] ? seat : null,
        authUntil: attachment?.authUntil || this.now(), seq: -1, tokens: 80, rateAt: this.now(), invalid: 0 };
      this.connections.set(socket, info);
      if (info.seat !== null && !this.owners[info.seat]) this.owners[info.seat] = socket;
      else if (info.seat !== null) this.connections.delete(socket);
    }
  }
  run(operation) {
    const result = this.pending.then(operation); this.pending = result.catch(() => {}); return result;
  }
  async restore() {
    return this.run(async () => {
      if (!this.meta) { this._closeAll(4410, 'expired'); return; }
      if (activePhases.has(this.meta.phase)) {
        // In-memory physics is never guessed after eviction/restart. An interrupted
        // bout becomes a draw/cancellation, never a free or invented victory.
        this.meta.phase = 'cancelled'; this.meta.reason = 'server_restart';
        this.meta.seats.forEach(seat => { if (seat) { seat.ready = false; seat.rematch = false; } });
        this.resultSnapshot = null; this.meta.snapshot = null;
        await this._save();
      } else if (this.meta.phase === 'waiting') this._newModel();
      for (let seat = 0; seat < 2; seat++) if (this.owners[seat]) this.meta.missingSince[seat] = null;
      await this._checkDeadlines(); this._broadcastRoom(); this._broadcastSnapshot(true); await this._planAlarm();
    });
  }
  create(roomCode, playerId, nickname) {
    return this.run(async () => {
      if (this.meta && this.meta.expiresAt > this.now()) throw new ApiError(409, 'pvp_room_exists', '這個房間編號已使用。');
      if (this.meta) await this._expire();
      if (!PVP_CODE_PATTERN.test(roomCode) || typeof playerId !== 'string' || !playerId) throw new ApiError(400, 'invalid_pvp_room', '房間資料不正確。');
      this.meta = { version: 1, roomCode, createdAt: this.now(), expiresAt: this.now() + PVP_ROOM_LIFETIME_MS,
        phase: 'waiting', reason: null, matchId: this.uuid(), seats: [null, null], missingSince: [null, null], countdownEndsAt: null, snapshot: null };
      this.resultSnapshot = null; this._newModel();
      const claim = await this._claim(playerId, nickname, true); await this._planAlarm(); return claim;
    });
  }
  claim(playerId, nickname) { return this.run(async () => { await this._requireRoom(); return this._claim(playerId, nickname); }); }
  async _claim(playerId, nickname, creating = false) {
    if (typeof playerId !== 'string' || !playerId) throw new ApiError(401, 'unknown_player', '請先建立匿名島民身分。');
    let seat = this.meta.seats.findIndex(row => row?.playerId === playerId);
    if (seat < 0) {
      if (this.meta.phase !== 'waiting') throw new ApiError(409, 'pvp_room_started', '這個房間已經開始，請另開一個房間。');
      seat = this.meta.seats.findIndex(row => row === null);
      if (seat < 0) throw new ApiError(409, 'pvp_room_full', '房間已經有兩位玩家，請建立另一個房間。');
      this.meta.seats[seat] = { playerId, nickname: nickname || `島民 ${seat + 1}`, ticketHash: null, ready: false, rematch: false };
      this.meta.missingSince[seat] = this.now();
    }
    // Same anonymous owner may refresh/resume its seat. A ticket is not an
    // identity, and refreshing never awards the other participant a win.
    const ticket = this.ticket(); this.meta.seats[seat].ticketHash = await hashTicket(ticket);
    await this._save(); this._broadcastRoom(); await this._planAlarm();
    return { roomCode: this.meta.roomCode, seat, ticket, expiresAt: this.meta.expiresAt, socketPath: `/api/island/pvp/rooms/${this.meta.roomCode}/socket` };
  }
  async _requireRoom() {
    if (!this.meta) throw new ApiError(404, 'pvp_room_not_found', '找不到這個房間，請確認邀請碼。');
    if (this.meta.expiresAt <= this.now()) { await this._expire(); throw new ApiError(410, 'pvp_room_expired', '房間已到期，請建立新的房間。'); }
    await this._checkDeadlines();
  }
  connect(socket) {
    return this.run(async () => {
      await this._requireRoom();
      if ([...this.connections.values()].filter(info => info.seat === null).length >= 4) throw new ApiError(429, 'pvp_connection_busy', '房間正在處理連線，請稍後再試。');
      const info = { seat: null, authUntil: this.now() + PVP_AUTH_MS, seq: -1, tokens: 80, rateAt: this.now(), invalid: 0 };
      this.connections.set(socket, info); this._attach(socket, info); await this._planAlarm();
    });
  }
  _attach(socket, info) { socket.serializeAttachment?.({ seat: info.seat, authUntil: info.authUntil }); }
  _send(socket, data) { try { socket.send(JSON.stringify(data)); return true; } catch { return false; } }
  _error(socket, code, message) { this._send(socket, { type: 'error', code, message }); }
  _close(socket, code, reason) { try { socket.close(code, reason); } catch { /* closed transport */ } }
  _closeAll(code, reason) { for (const socket of this.connections.keys()) this._close(socket, code, reason); this.connections.clear(); this.owners = [null, null]; }
  publicRoom() {
    if (!this.meta) return null;
    const missing = this.meta.missingSince.filter((time, seat) => time !== null && this.meta.seats[seat] && !this.owners[seat]);
    return { roomCode: this.meta.roomCode, phase: this.meta.phase, matchId: this.meta.matchId, expiresAt: this.meta.expiresAt, serverNow: this.now(), reason: this.meta.reason,
      countdownEndsAt: this.meta.countdownEndsAt, reconnectDeadline: this.meta.phase === 'paused' && missing.length ? Math.min(...missing) + PVP_GRACE_MS : null,
      players: this.meta.seats.map((row, seat) => ({ seat, occupied: Boolean(row), nickname: row?.nickname || '', connected: Boolean(this.owners[seat]), ready: Boolean(row?.ready), rematch: Boolean(row?.rematch) })) };
  }
  _broadcastRoom() {
    if (!this.meta) return;
    const message = { type: 'room', room: this.publicRoom() };
    for (const socket of this.owners) if (socket) this._send(socket, message);
  }
  _snapshot() { return this.resultSnapshot || this.model?.getState() || null; }
  _broadcastSnapshot(force = false) {
    if (!this.meta || (!force && this.now() - this.lastSnapshotAt < SNAPSHOT_MS)) return;
    const state = this._snapshot(); if (!state) return;
    this.lastSnapshotAt = this.now();
    const message = { type: 'snapshot', state, matchId: this.meta.matchId, sequence: ++this.sequence, serverNow: this.now() };
    for (const socket of this.owners) if (socket) this._send(socket, message);
  }
  _newModel() { this.model = this.createCombat({ seed: `${this.meta.roomCode}:${this.meta.matchId}` }); this.resultSnapshot = null; this.sequence = 0; this.lastSnapshotAt = -Infinity; this._resetInputs(true); }
  _resetInputs(resetSequence = false) { this.inputs = [neutral(), neutral()]; if (resetSequence) for (const info of this.connections.values()) info.seq = -1; }
  async _save() { if (this.meta) await this.persist(detached({ ...this.meta, snapshot: this.resultSnapshot })); }
  async _planAlarm() {
    if (!this.meta) return;
    const times = [this.meta.expiresAt];
    for (const info of this.connections.values()) if (info.seat === null) times.push(info.authUntil);
    if (['waiting', 'countdown', 'paused'].includes(this.meta.phase)) this.meta.missingSince.forEach((at, seat) => { if (at !== null && this.meta.seats[seat] && !this.owners[seat]) times.push(at + PVP_GRACE_MS); });
    await this.schedule(Math.max(this.now() + 1, Math.min(...times)));
  }
  _startTimer() {
    if (this.timer !== null) return;
    this.timer = this.interval(() => this.tick().catch(() => {
      this._stopTimer();
      return this.run(() => this._fatal()).catch(() => this._closeAll(1011, 'unavailable'));
    }), TICK_MS);
  }
  _stopTimer() { if (this.timer !== null) { this.clearInterval(this.timer); this.timer = null; } }
  message(socket, data) {
    return this.run(async () => {
      const info = this.connections.get(socket); if (!info || !this.meta) return;
      try {
        await this._requireRoom();
        if (typeof data !== 'string' || data.length > 1024 || new TextEncoder().encode(data).byteLength > 1024) throw new ApiError(400, 'invalid_pvp_message', '連線資料太大或格式不正確。');
        const elapsed = Math.max(0, this.now() - info.rateAt); info.tokens = Math.min(80, info.tokens + elapsed * .04); info.rateAt = this.now();
        if (info.tokens < 1) { this._error(socket, 'pvp_message_rate', '操作送出太快，連線已暫停。'); this._close(socket, 1008, 'rate'); await this._closed(socket); return; }
        info.tokens--;
        let body; try { body = JSON.parse(data); } catch { throw new ApiError(400, 'invalid_pvp_message', '連線資料無法讀取。'); }
        if (!record(body) || typeof body.type !== 'string') throw new ApiError(400, 'invalid_pvp_message', '連線格式不正確。');
        if (info.seat === null) { await this._authenticate(socket, info, body); return; }
        const seat = info.seat;
        // Ownership is checked for every packet, not only the handshake. A late
        // close/error/packet from a replaced connection cannot act on a new one.
        if (this.owners[seat] !== socket) return;
        if (body.type === 'ping' && keysAre(body, ['type'])) { this._send(socket, { type: 'pong', serverNow: this.now() }); return; }
        if (!['ready', 'input', 'rematch', 'leave'].includes(body.type)) throw new ApiError(400, 'invalid_pvp_message', '這個房間動作不存在。');
        if (body.matchId !== this.meta.matchId) return;
        if (body.type === 'ready') {
          if (!keysAre(body, ['type', 'matchId', 'ready']) || typeof body.ready !== 'boolean') throw new ApiError(400, 'invalid_pvp_message', '準備狀態不正確。');
          if (!['waiting', 'countdown'].includes(this.meta.phase)) return;
          this.meta.seats[seat].ready = body.ready;
          if (!body.ready && this.meta.phase === 'countdown') { this.meta.phase = 'waiting'; this.meta.countdownEndsAt = null; this._stopTimer(); }
          if (this.meta.phase === 'waiting' && this.meta.seats.every((row, index) => row?.ready && this.owners[index])) {
            this.meta.phase = 'countdown'; this.meta.countdownEndsAt = this.now() + 3000; this._resetInputs(); this._startTimer();
          }
          await this._save(); this._broadcastRoom(); await this._planAlarm();
        } else if (body.type === 'input') {
          if (!keysAre(body, ['type', 'matchId', 'seq', 'input']) || !Number.isSafeInteger(body.seq) || body.seq < 0 || body.seq > 2147483647) throw new ApiError(400, 'invalid_pvp_input', '操作序號不正確。');
          const input = parsePvpInput(body.input);
          if (this.meta.phase !== 'playing' || body.seq <= info.seq) return;
          info.seq = body.seq; const target = this.inputs[seat];
          target.x = input.x; target.y = input.y; target.attack = input.attack; target.lastAt = this.now();
          for (const action of ['dodge', 'special', 'throw']) target[action] ||= input[action];
        } else if (body.type === 'rematch') {
          if (!keysAre(body, ['type', 'matchId'])) throw new ApiError(400, 'invalid_pvp_message', '重賽資料不正確。');
          if (!['finished', 'cancelled'].includes(this.meta.phase)) return;
          this.meta.seats[seat].rematch = true;
          if (this.meta.seats.every((row, index) => row?.rematch && this.owners[index])) {
            this.meta.matchId = this.uuid(); this.meta.phase = 'waiting'; this.meta.reason = null; this.meta.countdownEndsAt = null;
            this.meta.seats.forEach(row => { row.ready = false; row.rematch = false; }); this._newModel();
          }
          await this._save(); this._broadcastRoom(); this._broadcastSnapshot(true);
        } else if (body.type === 'leave') {
          if (!keysAre(body, ['type', 'matchId'])) throw new ApiError(400, 'invalid_pvp_message', '離開資料不正確。');
          if (['playing', 'paused'].includes(this.meta.phase)) await this._finishForfeit(seat, 'forfeit');
          else if (['waiting', 'countdown'].includes(this.meta.phase)) {
            this.meta.seats[seat] = null; this.meta.missingSince[seat] = null; this.meta.phase = 'waiting'; this.meta.countdownEndsAt = null; this._stopTimer(); this._resetInputs();
          }
          this.owners[seat] = null; this.connections.delete(socket); this._close(socket, 1000, 'left'); await this._save(); this._broadcastRoom(); await this._planAlarm();
        }
      } catch (error) {
        const known = error instanceof ApiError; this._error(socket, known ? error.code : 'pvp_unavailable', known ? error.message : '房間暫時無法處理這個操作。');
        info.invalid++;
        if (info.seat === null || info.invalid >= 3) { this._close(socket, 1008, 'invalid'); await this._closed(socket); }
      }
    });
  }
  async _authenticate(socket, info, body) {
    if (this.now() >= info.authUntil || body.type !== 'auth' || !keysAre(body, ['type', 'ticket']) || typeof body.ticket !== 'string' || !/^[a-f0-9]{64}$/.test(body.ticket)) {
      throw new ApiError(401, 'pvp_auth_required', '請先從房間入口取得連線席位。');
    }
    const digest = await hashTicket(body.ticket), seat = this.meta.seats.findIndex(row => row?.ticketHash === digest);
    if (seat < 0) throw new ApiError(401, 'pvp_ticket_invalid', '席位已更新，請重新加入房間。');
    const previous = this.owners[seat];
    if (previous && previous !== socket) {
      this.connections.delete(previous); this._error(previous, 'seat_replaced', '這個席位已在另一個分頁連線。'); this._close(previous, 4009, 'replaced');
    }
    info.seat = seat; info.seq = -1; this.owners[seat] = socket; this.meta.missingSince[seat] = null; this.inputs[seat] = neutral(); this._attach(socket, info);
    if (this.meta.phase === 'paused' && this.owners.every(Boolean)) {
      this.clockBaseline += this.now() - this.pausedAt; this.pausedAt = null; this.meta.phase = 'playing'; this.meta.reason = null; this._resetInputs(); this._startTimer();
    }
    await this._save(); this._broadcastRoom(); this._broadcastSnapshot(true); await this._planAlarm();
  }
  closed(socket) { return this.run(() => this._closed(socket)); }
  async _closed(socket) {
    const info = this.connections.get(socket); if (!info) return; this.connections.delete(socket);
    const seat = info.seat; if (seat === null || this.owners[seat] !== socket || !this.meta) { await this._planAlarm(); return; }
    this.owners[seat] = null; this.inputs[seat] = neutral(); this.meta.missingSince[seat] = this.now();
    if (this.meta.phase === 'playing') {
      this.meta.phase = 'paused'; this.meta.reason = 'disconnected'; this.pausedAt = this.now(); this._resetInputs(); this._stopTimer();
    } else if (this.meta.phase === 'countdown') {
      this.meta.phase = 'waiting'; this.meta.countdownEndsAt = null; this.meta.seats[seat].ready = false; this._resetInputs(); this._stopTimer();
    }
    await this._save(); this._broadcastRoom(); await this._planAlarm();
  }
  tick() { return this.run(() => this._tick()); }
  async _tick() {
    if (!this.meta) return;
    await this._checkDeadlines(); if (!this.meta) return;
    if (this.meta.phase === 'countdown' && this.now() >= this.meta.countdownEndsAt) {
      if (!this.owners.every(Boolean) || !this.meta.seats.every(row => row?.ready)) { this.meta.phase = 'waiting'; this.meta.countdownEndsAt = null; this._stopTimer(); await this._save(); this._broadcastRoom(); return; }
      this.meta.phase = 'playing'; this.meta.countdownEndsAt = null; this.clockBaseline = this.now(); this.model.start(); this._resetInputs();
      await this._save(); this._broadcastRoom(); this._broadcastSnapshot(true);
    }
    if (this.meta.phase !== 'playing') return;
    const target = Math.max(0, (this.now() - this.clockBaseline) / 1000), current = this.model.getState().elapsed;
    if (target - current > .55) { await this._cancel('server_lag'); return; }
    let steps = 0;
    while (this.model.getState().phase === 'playing' && this.model.getState().elapsed + .05 <= target + 1e-6 && steps++ < 11) {
      const inputs = this.inputs.map(input => this.now() - input.lastAt > PVP_INPUT_STALE_MS ? neutral() : { ...input });
      this.model.step(.05, inputs);
      this.inputs.forEach(input => { input.dodge = false; input.special = false; input.throw = false; });
    }
    if (this.model.getState().phase === 'finished') { await this._finish('combat'); return; }
    this._broadcastSnapshot();
  }
  async _checkDeadlines() {
    if (!this.meta) return;
    if (this.meta.expiresAt <= this.now()) { await this._expire(); return; }
    for (const [socket, info] of this.connections) if (info.seat === null && info.authUntil <= this.now()) { this.connections.delete(socket); this._close(socket, 1008, 'auth_timeout'); }
    const expiredSeats = this.meta.missingSince.flatMap((at, seat) => at !== null && this.meta.seats[seat] && !this.owners[seat] && at + PVP_GRACE_MS <= this.now() ? [seat] : []);
    if (!expiredSeats.length) return;
    if (this.meta.phase === 'paused') {
      if (!this.owners.some(Boolean)) await this._cancel('both_disconnected');
      else await this._finishForfeit(expiredSeats[0], 'disconnect');
    } else if (['waiting', 'countdown'].includes(this.meta.phase)) {
      for (const seat of expiredSeats) { this.meta.seats[seat] = null; this.meta.missingSince[seat] = null; }
      this.meta.phase = 'waiting'; this.meta.countdownEndsAt = null; this._stopTimer(); await this._save(); this._broadcastRoom();
    }
  }
  async _finishForfeit(seat, reason) { this.model.forfeit(seat); await this._finish(reason); }
  async _finish(reason) {
    this.meta.phase = 'finished'; this.meta.reason = reason; this.meta.countdownEndsAt = null;
    this.resultSnapshot = this.model.getState(); this._stopTimer(); this._resetInputs(); await this._save(); this._broadcastRoom(); this._broadcastSnapshot(true); await this._planAlarm();
  }
  async _cancel(reason) {
    this.meta.phase = 'cancelled'; this.meta.reason = reason; this.meta.countdownEndsAt = null;
    const state = this.model?.getState(); this.resultSnapshot = state ? { ...state, phase: 'finished', winner: null, reason } : null;
    this._stopTimer(); this._resetInputs(); await this._save(); this._broadcastRoom(); this._broadcastSnapshot(true); await this._planAlarm();
  }
  async _fatal() {
    // A failed tick must never leave an apparently playing room with no clock.
    // Terminate in memory first, even if the metadata store is unavailable.
    this._stopTimer();
    if (this.meta) {
      this.meta.phase = 'cancelled'; this.meta.reason = 'server_error'; this.meta.countdownEndsAt = null;
      let state = null; try { state = this.model?.getState(); } catch {}
      this.resultSnapshot = state ? { ...state, phase: 'finished', winner: null, reason: 'server_error' } : null;
      this._resetInputs(); this._broadcastRoom(); this._broadcastSnapshot(true);
      try { await this._save(); } catch {}
    }
    this._closeAll(1011, 'unavailable');
    try { await this._planAlarm(); } catch {}
  }
  async _expire() {
    this._stopTimer(); this.meta.phase = 'expired'; this.meta.reason = 'expired'; this._broadcastRoom(); this._closeAll(4410, 'expired'); this.meta = null; this.model = null; this.resultSnapshot = null; await this.erase();
  }
  alarm() { return this.run(async () => { await this._checkDeadlines(); await this._planAlarm(); }); }
  dispose() { this._stopTimer(); }
}
