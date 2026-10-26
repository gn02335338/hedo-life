import test from 'node:test';
import assert from 'node:assert/strict';
import { IslandPvpSession, PVP_GRACE_MS, PVP_INPUT_STALE_MS, parsePvpInput } from '../worker/island-pvp-session.js';
import { createIslandPvpCombat } from '../dist/island/pvp-combat.js';

class Socket {
  constructor() { this.messages = []; this.closes = []; this.seq = 0; this.attachment = null; }
  send(value) { this.messages.push(JSON.parse(value)); }
  close(code, reason) { this.closes.push({ code, reason }); }
  serializeAttachment(value) { this.attachment = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.attachment); }
}
function harness(options = {}) {
  let now = 1000000, persisted = null, nextUuid = 0, activeTimers = 0, lastAlarm = null;
  const timers = new Set();
  const dependencies = { createCombat: createIslandPvpCombat, now: () => now,
    persist: async value => { persisted = structuredClone(value); }, erase: async () => { persisted = null; }, schedule: async at => { lastAlarm = at; },
    uuid: () => `round-${++nextUuid}`, setInterval: fn => { const id = ++activeTimers; timers.add(id); return id; }, clearInterval: id => timers.delete(id), ...options };
  const session = new IslandPvpSession(dependencies);
  const send = (socket, body) => session.message(socket, JSON.stringify(body));
  const action = (socket, type, extra = {}) => send(socket, { type, matchId: session.publicRoom().matchId, ...extra });
  async function seat(owner, nickname, create = false) {
    const claim = create ? await session.create('ABCD2345', owner, nickname) : await session.claim(owner, nickname);
    const socket = new Socket(); await session.connect(socket); await send(socket, { type: 'auth', ticket: claim.ticket }); return { socket, claim };
  }
  async function advance(ms) { while (ms > 0) { const delta = Math.min(50, ms); now += delta; ms -= delta; await session.tick(); } }
  async function start(a, b) { await action(a, 'ready', { ready: true }); await action(b, 'ready', { ready: true }); await advance(3000); assert.equal(session.publicRoom().phase, 'playing'); }
  const input = (socket, value = {}) => action(socket, 'input', { seq: socket.seq++, input: { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false, ...value } });
  return { session, dependencies, seat, send, action, advance, start, input, timers, get persisted() { return persisted; }, get lastAlarm() { return lastAlarm; }, get now() { return now; }, setNow(value) { now = value; } };
}

test('two anonymous owners claim separate seats; only ticket hashes persist and public rooms reveal no identities', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  assert.deepEqual([a.claim.seat, b.claim.seat], [0, 1]);
  await assert.rejects(h.session.claim('owner-c', '丙'), error => error.status === 409 && error.code === 'pvp_room_full');
  const publicText = JSON.stringify([...a.socket.messages, ...b.socket.messages]);
  for (const secret of ['owner-a', 'owner-b', a.claim.ticket, b.claim.ticket, 'ticketHash']) assert.ok(!publicText.includes(secret));
  assert.ok(!JSON.stringify(h.persisted).includes(a.claim.ticket));
  assert.match(h.persisted.seats[0].ticketHash, /^[0-9a-f]{64}$/);
  assert.equal(h.timers.size, 0, 'waiting rooms do not keep an interval alive');
});

test('first frame must authenticate and pending/invalid tickets never expose a room snapshot', async () => {
  const h = harness(); await h.seat('owner-a', '甲', true);
  const bad = new Socket(); await h.session.connect(bad);
  await h.send(bad, { type: 'ready', ready: true });
  assert.equal(bad.closes.at(-1).code, 1008); assert.equal(bad.messages.length, 1); assert.equal(bad.messages[0].type, 'error');
  const late = new Socket(); await h.session.connect(late); h.setNow(h.now + 5000); await h.session.alarm();
  assert.equal(late.closes.at(-1).reason, 'auth_timeout');
});

test('both explicit ready votes start one three-second countdown; stale frames and repeated ready cannot postpone it', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  await h.action(a.socket, 'ready', { ready: true }); await h.advance(500); assert.equal(h.session.publicRoom().phase, 'waiting');
  await h.action(b.socket, 'ready', { ready: true }); const deadline = h.session.publicRoom().countdownEndsAt;
  await h.advance(1000); await h.action(a.socket, 'ready', { ready: true });
  assert.equal(h.session.publicRoom().countdownEndsAt, deadline);
  await h.send(a.socket, { type: 'ready', matchId: 'old', ready: false }); assert.equal(h.session.publicRoom().phase, 'countdown');
  await h.advance(2000); assert.equal(h.session.publicRoom().phase, 'playing'); assert.equal(h.session.model.getState().elapsed, 0);
  assert.equal(h.timers.size, 1); h.session.dispose();
});

test('server advances the actual duel, neutralizes stale movement and rejects client health, winner or duplicated sequence injection', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  const before = h.session.model.getState().fighters[0].x;
  await h.input(a.socket, { x: 1 }); await h.advance(PVP_INPUT_STALE_MS);
  const moved = h.session.model.getState().fighters[0].x; assert.ok(moved > before);
  await h.advance(300); assert.equal(h.session.model.getState().fighters[0].x, moved, 'missing packets cannot hold a direction forever');
  await h.send(a.socket, { type: 'input', matchId: h.session.publicRoom().matchId, seq: 0, input: { x: -1, y: 0, attack: false, dodge: false, special: false, throw: false } });
  await h.advance(50); assert.equal(h.session.model.getState().fighters[0].x, moved, 'duplicate sequence ignored');
  await h.send(a.socket, { type: 'input', matchId: h.session.publicRoom().matchId, seq: 100, input: { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false, hp: 999 } });
  assert.equal(a.socket.messages.at(-1).code, 'invalid_pvp_input'); assert.equal(h.session.model.getState().fighters[0].hp, 160);
  assert.equal(h.session.model.getState().winner, null); h.session.dispose();
});

test('short dodge/special/throw packets are queued until one server step and then cleared', async () => {
  const received = [];
  const makeCombat = () => { let elapsed = 0, phase = 'ready'; return { start() { phase = 'playing'; }, getState() { return { phase, elapsed, fighters: [], winner: null }; }, step(dt, inputs) { elapsed += dt; received.push(structuredClone(inputs)); }, forfeit() {} }; };
  const h = harness({ createCombat: makeCombat }), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  await h.input(a.socket, { dodge: true, special: true, throw: true }); await h.input(a.socket);
  await h.advance(50); assert.deepEqual(['dodge', 'special', 'throw'].map(key => received.at(-1)[0][key]), [true, true, true]);
  await h.advance(50); assert.deepEqual(['dodge', 'special', 'throw'].map(key => received.at(-1)[0][key]), [false, false, false]); h.session.dispose();
});

test('disconnect pauses both clocks and neutralizes inputs; resume uses a fresh socket sequence without charging grace as battle time', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  await h.input(a.socket, { x: 1 }); await h.advance(100); const before = h.session.model.getState();
  const timer = h.session.timer;
  await h.session.closed(a.socket); assert.equal(h.session.publicRoom().phase, 'paused'); assert.equal(h.timers.size, 1); assert.equal(h.session.timer, timer);
  await h.advance(12000);
  assert.equal(h.timers.size, 1, 'the grace interval prevents ordinary 10-second hibernation');
  assert.deepEqual(h.session.model.getState(), before, 'twelve seconds of grace change no HP, clock, position or cooldown');
  const resumed = await h.seat('owner-a', '改名'); assert.equal(resumed.claim.seat, 0); assert.equal(h.session.publicRoom().phase, 'playing');
  assert.equal(h.timers.size, 1); assert.equal(h.session.timer, timer, 'resuming reuses the same interval rather than duplicating it');
  assert.equal(h.session.publicRoom().players[0].nickname, '甲', 'reconnect preserves room identity');
  await h.input(resumed.socket, { x: -1 }); await h.advance(50); assert.ok(h.session.model.getState().fighters[0].x < before.fighters[0].x);
  assert.ok(Math.abs(h.session.model.getState().elapsed - before.elapsed - .05) < 1e-8); h.session.dispose();
});

test('a missing opponent forfeits only after the grace deadline, while both missing cancel with no winner', async () => {
  for (const both of [false, true]) {
    const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
    const timer = h.session.timer;
    await h.session.closed(a.socket); if (both) await h.session.closed(b.socket);
    assert.equal(h.timers.size, 1); assert.equal(h.session.timer, timer);
    await h.advance(PVP_GRACE_MS - 50); assert.equal(h.session.publicRoom().phase, 'paused');
    assert.equal(h.timers.size, 1, 'one interval remains alive until the grace deadline');
    await h.advance(50); assert.equal(h.session.publicRoom().phase, both ? 'cancelled' : 'finished');
    assert.equal(h.session._snapshot().winner, both ? null : 1); assert.equal(h.session.publicRoom().reason, both ? 'both_disconnected' : 'disconnect');
    assert.equal(h.timers.size, 0);
  }
});

test('takeover disconnects the old tab once; its late close, error, leave and input cannot affect the fresh owner', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  const newer = await h.seat('owner-a', '甲'); assert.equal(a.socket.closes.at(-1).code, 4009); assert.equal(a.socket.messages.at(-1).code, 'seat_replaced');
  await h.session.closed(a.socket); await h.session.closed(a.socket); await h.action(a.socket, 'leave'); await h.input(a.socket, { x: 1 });
  assert.equal(h.session.publicRoom().phase, 'playing'); assert.equal(h.session.publicRoom().players[0].connected, true);
  const before = h.session.model.getState().fighters[0].x; await h.input(newer.socket, { x: -1 }); await h.advance(50); assert.ok(h.session.model.getState().fighters[0].x < before);
  h.session.dispose();
});

test('rematch needs both votes, a new round ID and two new ready decisions; old queued actions never enter a new round', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  const old = h.session.publicRoom().matchId; await h.action(a.socket, 'leave'); assert.equal(h.session.publicRoom().phase, 'finished'); assert.equal(h.session._snapshot().winner, 1);
  const back = await h.seat('owner-a', '甲'); await h.action(back.socket, 'rematch'); assert.equal(h.session.publicRoom().phase, 'finished');
  await h.action(b.socket, 'rematch'); assert.equal(h.session.publicRoom().phase, 'waiting'); assert.notEqual(h.session.publicRoom().matchId, old);
  await h.send(back.socket, { type: 'ready', matchId: old, ready: true }); await h.send(b.socket, { type: 'leave', matchId: old });
  assert.ok(h.session.publicRoom().players.every(row => row.connected && !row.ready));
  await h.start(back.socket, b.socket); await h.send(back.socket, { type: 'input', matchId: old, seq: 999999, input: { x: 1, y: 0, attack: false, dodge: false, special: false, throw: false } });
  const before = h.session.model.getState().fighters[0].x; await h.advance(100); assert.equal(h.session.model.getState().fighters[0].x, before);
  await h.input(back.socket, { x: -1 }); await h.advance(50); assert.ok(h.session.model.getState().fighters[0].x < before); h.session.dispose();
});

test('restart during an active bout cancels fairly; waiting seats survive hibernation and finished outcomes survive reload', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  const waiting = new IslandPvpSession({ ...h.dependencies, persisted: h.persisted, sockets: [a.socket, b.socket] }); await waiting.restore();
  assert.equal(waiting.publicRoom().phase, 'waiting'); assert.ok(waiting.publicRoom().players.every(row => row.connected));
  await h.start(a.socket, b.socket); await h.advance(100); const activeSaved = h.persisted; h.session.dispose();
  const restarted = new IslandPvpSession({ ...h.dependencies, persisted: activeSaved, sockets: [a.socket, b.socket] }); await restarted.restore();
  assert.equal(restarted.publicRoom().phase, 'cancelled'); assert.equal(restarted.publicRoom().reason, 'server_restart'); assert.equal(restarted._snapshot(), null);
  assert.ok(restarted.publicRoom().players.every(row => !row.ready)); assert.equal(h.timers.size, 0);
});

test('expiry erases private room data and closes sockets; excessive, binary and non-finite messages cannot mutate physics', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  assert.throws(() => parsePvpInput({ x: NaN, y: 0, attack: false, dodge: false, special: false, throw: false }));
  const bad = new Socket(); await h.session.connect(bad); await h.session.message(bad, new Uint8Array([1, 2])); assert.equal(bad.closes.at(-1).code, 1008);
  h.setNow(h.session.publicRoom().expiresAt); await h.session.alarm(); assert.equal(h.session.publicRoom(), null); assert.equal(h.persisted, null);
  assert.equal(a.socket.closes.at(-1).code, 4410); assert.equal(b.socket.closes.at(-1).code, 4410);
  await assert.rejects(h.session.claim('owner-c', null), error => error.status === 404);
});

test('server clock stalls cancel the bout instead of inventing damage, health or a winner', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  h.setNow(h.now + 1000); await h.session.tick(); assert.equal(h.session.publicRoom().phase, 'cancelled'); assert.equal(h.session.publicRoom().reason, 'server_lag'); assert.equal(h.session._snapshot().winner, null);
});

test('wall-clock grace is enforced even when the alarm is late, before an arriving reconnect can resume the old bout', async () => {
  for (const both of [false, true]) {
    const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
    await h.session.closed(a.socket); if (both) await h.session.closed(b.socket);
    h.setNow(h.now + PVP_GRACE_MS + 1);
    const resumed = await h.seat('owner-a', '甲'); assert.equal(resumed.claim.seat, 0);
    assert.equal(h.session.publicRoom().phase, both ? 'cancelled' : 'finished'); assert.equal(h.session._snapshot().winner, both ? null : 1);
    assert.equal(h.timers.size, 0);
  }
});

test('an expired room can be recreated only after its old sockets and private owners have been cleared', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  h.setNow(h.session.publicRoom().expiresAt + 1);
  const replacement = await h.session.create('ABCD2345', 'owner-c', '丙');
  assert.equal(replacement.seat, 0); assert.equal(a.socket.closes.at(-1).code, 4410); assert.equal(b.socket.closes.at(-1).code, 4410);
  assert.equal(h.session.publicRoom().players[0].connected, false); assert.equal(h.session.publicRoom().players[0].nickname, '丙'); assert.equal(h.session.publicRoom().players[1].occupied, false);
  await h.session.closed(a.socket); await h.action(b.socket, 'leave'); assert.equal(h.session.publicRoom().players[0].nickname, '丙');
});

test('pause and resume preserve the still-connected peer sequence watermark while a replacement socket starts from zero', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  await h.input(b.socket, { x: -1 }); await h.advance(50); await h.session.closed(a.socket);
  await h.seat('owner-a', '甲');
  const before = h.session.model.getState().fighters[1].x;
  await h.send(b.socket, { type: 'input', matchId: h.session.publicRoom().matchId, seq: 0, input: { x: 1, y: 0, attack: false, dodge: false, special: false, throw: false } });
  await h.advance(50); assert.equal(h.session.model.getState().fighters[1].x, before);
  await h.input(b.socket, { x: -1 }); await h.advance(50); assert.ok(h.session.model.getState().fighters[1].x < before); h.session.dispose();
});

test('a ticker failure becomes an explicit cancellation even if persistence is also unavailable, and reconnect cannot revive a stopped clock', async () => {
  let breakPhysics = false, breakStorage = false, timerCallback;
  const makeCombat = options => { const model = createIslandPvpCombat(options); return { ...model, step(...args) { if (breakPhysics) throw new Error('synthetic failure'); return model.step(...args); } }; };
  const h = harness({ createCombat: makeCombat, persist: async () => { if (breakStorage) throw new Error('synthetic store failure'); }, setInterval: callback => { timerCallback = callback; return 1; }, clearInterval() {} });
  const a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket);
  breakPhysics = true; breakStorage = true; h.setNow(h.now + 50); await timerCallback();
  assert.equal(h.session.publicRoom().phase, 'cancelled'); assert.equal(h.session.publicRoom().reason, 'server_error'); assert.equal(h.session._snapshot().winner, null);
  assert.ok(h.session.publicRoom().players.every(row => !row.connected)); assert.equal(a.socket.closes.at(-1).code, 1011); assert.equal(b.socket.closes.at(-1).code, 1011); assert.equal(h.session.timer, null);
  breakPhysics = false; breakStorage = false; const resumed = await h.seat('owner-a', '甲');
  assert.equal(resumed.claim.seat, 0); assert.equal(h.session.publicRoom().phase, 'cancelled'); assert.equal(h.session.timer, null);
});

test('the authoritative active clock reaches the 75-second timeout and leaves no running timer', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙'); await h.start(a.socket, b.socket); await h.advance(75000);
  assert.equal(h.session.publicRoom().phase, 'finished'); assert.equal(h.session._snapshot().reason, 'timeout'); assert.equal(h.session._snapshot().winner, null);
  assert.equal(h.session._snapshot().remaining, 0); assert.equal(h.timers.size, 0);
});

test('pending handshakes and authenticated message floods are bounded without exposing other seats or continuing stale actions', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true);
  const pending = Array.from({ length: 4 }, () => new Socket());
  for (const socket of pending) await h.session.connect(socket);
  await assert.rejects(h.session.connect(new Socket()), error => error.status === 429);
  for (let n = 0; n < 90; n++) await h.send(a.socket, { type: 'ping' });
  assert.equal(a.socket.closes.at(-1).code, 1008); assert.equal(a.socket.messages.at(-1).code, 'pvp_message_rate');
  assert.equal(h.session.publicRoom().players[0].connected, false); assert.equal(h.session.publicRoom().phase, 'waiting');
  assert.ok(pending.every(socket => socket.messages.length === 0));
});

test('a true runtime restart during reconnect grace still cancels fairly, while waiting/countdown cancellation keeps no timer', async () => {
  const h = harness(), a = await h.seat('owner-a', '甲', true), b = await h.seat('owner-b', '乙');
  await h.action(a.socket, 'ready', { ready: true }); await h.action(b.socket, 'ready', { ready: true });
  assert.equal(h.timers.size, 1); await h.session.closed(a.socket);
  assert.equal(h.session.publicRoom().phase, 'waiting'); assert.equal(h.timers.size, 0, 'an unstarted countdown can hibernate normally');
  const back = await h.seat('owner-a', '甲'); await h.start(back.socket, b.socket); await h.advance(100); await h.session.closed(back.socket);
  assert.equal(h.session.publicRoom().phase, 'paused'); assert.equal(h.timers.size, 1);
  const saved = h.persisted; h.session.dispose(); assert.equal(h.timers.size, 0);
  const restarted = new IslandPvpSession({ ...h.dependencies, persisted: saved, sockets: [b.socket] }); await restarted.restore();
  assert.equal(restarted.publicRoom().phase, 'cancelled'); assert.equal(restarted.publicRoom().reason, 'server_restart'); assert.equal(restarted._snapshot(), null);
  assert.equal(h.timers.size, 0, 'a cancelled restarted bout keeps no interval');
});
