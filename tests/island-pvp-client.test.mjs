import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandPvpClient, normalizePvpInput, normalizePvpRoomCode, islandPvpInviteUrl } from '../dist/island/pvp-client.js';
import { createIslandPvpCombat } from '../dist/island/pvp-combat.js';

const ANON = 'hedo-anonymous-v1', CODE = 'ABC12345';
const tokenA = 'ab'.repeat(32), tokenB = 'cd'.repeat(32);
const ticket = seat => `${seat}`.repeat(64);
const tick = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  let time = 100000, id = 0; const timers = new Map();
  return { now: () => time, schedule(fn, delay) { timers.set(++id, { fn, at: time + delay }); return id; }, unschedule(id) { timers.delete(id); }, size: () => timers.size,
    async advance(ms) { time += ms; for (const [id, timer] of [...timers]) if (timer.at <= time && timers.delete(id)) await timer.fn(); await tick(); } };
}
function fixture({ saved = tokenA, run, server } = {}) {
  const timer = clock(), calls = [], writes = [], sockets = [], events = [], snapshots = [];
  const values = new Map([[ANON, saved], ['hedo-life-v3', 'career bytes'], ['hedo-island-v1', 'passport bytes']]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); writes.push(key); } };
  class Socket {
    constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; sockets.push(this); server?.sockets.push(this); }
    open() { this.readyState = 1; this.onopen?.({}); }
    send(raw) { this.sent.push(JSON.parse(raw)); server?.receive(this, JSON.parse(raw)); }
    close(code = 1000, reason = '') { this.readyState = 3; this.closeCode = code; this.closeReason = reason; this.onclose?.({ code, reason }); }
    message(value) { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  }
  const client = createIslandPvpClient({ storage, location: { href: 'https://hodo.bvivify.com/island/?private=not-copied#court' }, random: { getRandomValues: array => array.fill(171) },
    WebSocketClass: Socket, now: timer.now, schedule: timer.schedule, unschedule: timer.unschedule,
    fetcher: async (url, options) => {
      calls.push({ url, ...options }); if (run) { const result = await run(url, options); if (result) return result; }
      if (url === '/api/player') return Response.json({ playerId: 'private-owner-id' });
      const seat = server ? options.headers.Authorization === `Bearer ${tokenA}` ? 0 : 1 : 0;
      return Response.json({ roomCode: CODE, seat, ticket: ticket(seat), expiresAt: timer.now() + 600000, socketPath: `/api/island/pvp/rooms/${CODE}/socket` });
    }, onChange: value => events.push(value), onSnapshot: (value, meta) => snapshots.push({ value, meta }) });
  return { client, timer, calls, writes, sockets, values, events, snapshots };
}
function room(overrides = {}) {
  return { roomCode: CODE, phase: 'waiting', players: [0, 1].map(seat => ({ seat, occupied: true, nickname: seat ? '朋友' : '島民', connected: true, ready: false, rematch: false })),
    countdownEndsAt: null, reconnectDeadline: null, expiresAt: 700000, serverNow: 100000, matchId: 'round-1', reason: null, ...overrides };
}
async function connect(f, { joining = false } = {}) {
  if (joining) await f.client.join(CODE, '朋友'); else await f.client.create('島民');
  const socket = f.sockets.at(-1); socket.open(); socket.message({ type: 'room', room: room() }); return socket;
}

test('an invitation is public code only and opening the client never creates an identity or connection', () => {
  const f = fixture();
  assert.equal(f.calls.length, 0); assert.equal(f.sockets.length, 0); assert.equal(f.writes.length, 0);
  assert.equal(normalizePvpRoomCode(' abc1-2345 '), CODE);
  assert.equal(islandPvpInviteUrl(CODE, { href: 'https://hodo.bvivify.com/island/?token=secret#lab' }), `https://hodo.bvivify.com/island/?duel=${CODE}`);
  assert.throws(() => islandPvpInviteUrl('invalid', { href: 'https://hodo.bvivify.com' }), /8 碼/);
  f.client.destroy(); assert.equal(f.timer.size(), 0);
});

test('HTTP and first-frame authentication reuse only the anonymous identity and never put credentials in socket URLs', async () => {
  const f = fixture(), socket = await connect(f);
  assert.deepEqual(f.calls.map(call => call.url), ['/api/player', '/api/island/pvp/rooms']);
  assert.deepEqual(JSON.parse(f.calls[0].body), { token: tokenA });
  assert.equal(f.calls[1].headers.Authorization, `Bearer ${tokenA}`);
  assert.deepEqual(JSON.parse(f.calls[1].body), { nickname: '島民' });
  assert.equal(socket.url, `wss://hodo.bvivify.com/api/island/pvp/rooms/${CODE}/socket`);
  assert.deepEqual(socket.sent[0], { type: 'auth', ticket: ticket(0) });
  assert.deepEqual(f.writes, []); assert.equal(f.values.get('hedo-life-v3'), 'career bytes'); assert.equal(f.values.get('hedo-island-v1'), 'passport bytes');
  const publicData = JSON.stringify([f.client.getState(), f.events, f.snapshots]);
  for (const secret of [tokenA, ticket(0), 'private-owner-id']) assert.equal(publicData.includes(secret), false);
  f.client.destroy(); assert.equal(socket.sent.some(message => message.type === 'leave'), false, 'teardown/reload only disconnects');
});

test('invalid room codes and nicknames reject before network/storage side effects', async () => {
  for (const [code, nickname] of [['secret', '島民'], [CODE, 'abcdefghijklmnop'], [CODE, 'ab\u0000cd']]) {
    const f = fixture(); await assert.rejects(f.client.join(code, nickname)); assert.equal(f.calls.length, 0); assert.equal(f.writes.length, 0); f.client.destroy();
  }
});

test('only active authenticated input is sent, with current match IDs and no client-computed health or outcome', async () => {
  const f = fixture(), socket = await connect(f);
  assert.equal(f.client.sendInput({ x: 1, attack: true }), false);
  f.client.ready(true); assert.deepEqual(socket.sent.at(-1), { type: 'ready', matchId: 'round-1', ready: true });
  socket.message({ type: 'room', room: room({ phase: 'playing' }) });
  assert.equal(f.client.sendInput({ x: 9, y: -9, attack: true, hp: 1, winner: 0, dodge: 'yes' }), true);
  const input = socket.sent.at(-1); assert.deepEqual(Object.keys(input).sort(), ['input', 'matchId', 'seq', 'type']);
  assert.ok(Math.abs(Math.hypot(input.input.x, input.input.y) - 1) < 1e-12); assert.equal(input.input.attack, true); assert.equal(input.input.dodge, false);
  assert.deepEqual(Object.keys(input.input).sort(), ['attack', 'dodge', 'special', 'throw', 'x', 'y']);
  assert.deepEqual(normalizePvpInput({ x: NaN, y: Infinity, attack: 1 }), { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
  f.client.clearInput(); assert.deepEqual(socket.sent.at(-1).input, normalizePvpInput());
  f.client.leave(); assert.deepEqual(socket.sent.at(-1), { type: 'leave', matchId: 'round-1' }); f.client.destroy();
});

test('server snapshots are projected, detached, ordered and bound to their current match', async () => {
  const f = fixture(), socket = await connect(f), combat = createIslandPvpCombat({ seed: 'client-proof' }); combat.start();
  socket.message({ type: 'room', room: room({ phase: 'playing' }) });
  const authority = combat.getState(); authority.privateTicket = ticket(1); authority.fighters[0].bearer = tokenA;
  socket.message({ type: 'snapshot', matchId: 'round-1', sequence: 2, serverNow: 100000, state: authority });
  assert.equal(f.snapshots.length, 1); assert.equal(f.client.getState().combat.fighters[0].hp, 160);
  assert.equal(JSON.stringify(f.snapshots).includes(ticket(1)), false); assert.equal(JSON.stringify(f.snapshots).includes(tokenA), false);
  const changed = f.client.getState(); changed.combat.fighters[0].hp = 0; assert.equal(f.client.getState().combat.fighters[0].hp, 160);
  for (const message of [{ matchId: 'round-1', sequence: 1 }, { matchId: 'round-0', sequence: 99 }]) socket.message({ type: 'snapshot', serverNow: 100000, state: authority, ...message });
  assert.equal(f.snapshots.length, 1);
  socket.message({ type: 'room', room: room({ matchId: 'round-2' }) }); assert.equal(f.client.getState().combat, null);
  socket.message({ type: 'snapshot', matchId: 'round-1', sequence: 100, serverNow: 100000, state: authority }); assert.equal(f.client.getState().combat, null);
  socket.message({ type: 'snapshot', matchId: 'round-2', sequence: 0, serverNow: 100000, state: combat.getState() }); assert.equal(f.snapshots.length, 2);
  f.client.destroy();
});

test('two transport clients independently ready, receive the same authority, and vote rematch for that round only', async () => {
  const hub = { sockets: [], room: room(), receive(socket, message) {
    if (message.type === 'auth') { socket.seat = message.ticket === ticket(0) ? 0 : 1; this.broadcast(); }
    else if (message.type === 'ready' && message.matchId === this.room.matchId) { this.room.players[socket.seat].ready = message.ready; if (this.room.players.every(player => player.ready)) this.room.phase = 'countdown'; this.broadcast(); }
    else if (message.type === 'rematch' && message.matchId === this.room.matchId) { this.room.players[socket.seat].rematch = true; if (this.room.players.every(player => player.rematch)) this.room = room({ matchId: 'round-2' }); this.broadcast(); }
  }, broadcast() { for (const socket of this.sockets) if (socket.readyState === 1 && socket.seat !== undefined) socket.message({ type: 'room', room: this.room }); } };
  const a = fixture({ saved: tokenA, server: hub }), b = fixture({ saved: tokenB, server: hub });
  await a.client.create('甲'); a.sockets[0].open(); await b.client.join(CODE, '乙'); b.sockets[0].open();
  assert.equal(a.client.getState().seat, 0); assert.equal(b.client.getState().seat, 1);
  a.client.ready(true); assert.equal(b.client.getState().room.phase, 'waiting'); b.client.ready(true);
  assert.equal(a.client.getState().room.phase, 'countdown'); assert.equal(b.client.getState().room.phase, 'countdown');
  const combat = createIslandPvpCombat({ seed: 'server' }); combat.start(); combat.forfeit(1); hub.room.phase = 'finished'; hub.broadcast();
  for (const socket of hub.sockets) socket.message({ type: 'snapshot', state: combat.getState(), matchId: 'round-1', sequence: 0, serverNow: 100000 });
  assert.deepEqual(a.client.getState().combat, b.client.getState().combat); assert.equal(a.client.getState().combat.winner, 0);
  a.client.rematch(); assert.equal(b.client.getState().room.players[0].rematch, true); b.client.rematch();
  assert.equal(a.client.getState().room.matchId, 'round-2'); assert.equal(b.client.getState().room.phase, 'waiting');
  assert.equal(a.client.getState().combat, null); assert.equal(b.client.getState().combat, null);
  a.client.destroy(); b.client.destroy(); assert.equal(a.timer.size() + b.timer.size(), 0);
});

test('network interruption refreshes only its own ticket, cancels stale callbacks and stops takeover reconnect loops', async () => {
  const f = fixture(), old = await connect(f), stale = old.onmessage;
  old.close(1006, 'network'); assert.equal(f.client.getState().connection, 'reconnecting');
  await f.timer.advance(500); const resumed = f.sockets.at(-1); assert.notEqual(resumed, old); resumed.open(); resumed.message({ type: 'room', room: room() });
  assert.equal(f.client.getState().connection, 'connected'); assert.equal(f.timer.size(), 0);
  stale({ data: JSON.stringify({ type: 'room', room: room({ phase: 'expired' }) }) }); assert.equal(f.client.getState().room.phase, 'waiting');
  resumed.message({ type: 'error', code: 'seat_replaced', message: '席位已在另一分頁開啟。' });
  assert.equal(f.client.getState().connection, 'failed'); assert.equal(f.timer.size(), 0); const count = f.sockets.length; await f.timer.advance(20000); assert.equal(f.sockets.length, count);
  f.client.destroy();
});

test('destroy during a pending HTTP reply cannot open a late socket or expose a phantom room', async () => {
  let resolve; const f = fixture({ run: async url => url === '/api/player' ? await new Promise(done => { resolve = done; }) : undefined });
  const pending = f.client.create('島民').catch(error => error); await tick(); f.client.destroy(); const count = f.events.length;
  resolve(Response.json({ playerId: 'unpublished' })); await pending;
  assert.equal(f.sockets.length, 0); assert.equal(f.events.length, count); assert.equal(f.timer.size(), 0);
});

test('malformed oversized or impossible server data closes safely without inventing a result', async () => {
  for (const payload of ['{bad', 'x'.repeat(65537), { type: 'room', room: room({ players: [] }) }]) {
    const f = fixture(), socket = await connect(f); socket.message(payload); assert.equal(f.client.getState().connection, 'failed'); assert.equal(f.client.getState().combat, null); f.client.destroy(); assert.equal(f.timer.size(), 0);
  }
});

test('expired room broadcasts, close codes and HTTP receipts become a terminal expiry without reconnect loops', async () => {
  for (const broadcast of [true, false]) {
    const f = fixture(), socket = await connect(f);
    if (broadcast) socket.message({ type: 'room', room: room({ phase: 'expired', reason: 'expired' }) });
    socket.close(4410, 'expired');
    assert.equal(f.client.getState().terminalReason, 'expired'); assert.match(f.client.getState().error, /房間已到期/); assert.equal(f.timer.size(), 0);
    const count = f.calls.length; await f.timer.advance(30000); assert.equal(f.calls.length, count); f.client.destroy();
  }
  const f = fixture({ run: async url => url.includes('/join') ? Response.json({ error: 'pvp_room_expired', message: '房間已到期，請建立新的房間。' }, { status: 410 }) : undefined });
  await assert.rejects(f.client.join(CODE, '島民'), /房間已到期/); assert.equal(f.client.getState().terminalReason, 'expired'); assert.equal(f.sockets.length, 0); f.client.destroy();
});
