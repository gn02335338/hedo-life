#!/usr/bin/env node
// Exercise two real connections through the deployed Worker/DO routing. The
// three anonymous test credentials and seat tickets exist only in this process;
// no career run, score, application, browser storage or private archive is sent.
// Usage: node scripts/island-pvp-smoke.mjs --base http://127.0.0.1:4190
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws'; // Already pinned as Wrangler's development dependency.

const argumentsList = process.argv.slice(2);
if (argumentsList.some((value, index) => value !== '--base' && argumentsList[index - 1] !== '--base') || argumentsList.filter(value => value === '--base').length > 1) {
  throw new Error('Usage: node scripts/island-pvp-smoke.mjs [--base http://127.0.0.1:4190]');
}
const argumentIndex = argumentsList.indexOf('--base');
const target = new URL(argumentIndex < 0 ? 'http://127.0.0.1:4190' : argumentsList[argumentIndex + 1]);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
assert.ok(['http:', 'https:'].includes(target.protocol) && (local || target.protocol === 'https:')
  && !target.username && !target.password && !target.search && !target.hash && target.pathname === '/', 'Use a plain local HTTP origin or HTTPS origin as --base');
const base = target.origin, secrets = [], clients = [];
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const expect = (condition, message) => assert.ok(condition, message);
function privateSafe(value) {
  const text = JSON.stringify(value);
  expect(!secrets.some(secret => typeof secret === 'string' && secret.length > 0 && text.includes(secret)), 'A public WebSocket message contained a private identity or credential');
  const keys = item => item && typeof item === 'object' && Object.entries(item).some(([key, child]) =>
    /^(?:playerId|token|ticket|credential|bearer|authorization|ipHash|tokenHash)$/i.test(key) || keys(child));
  expect(!keys(value), 'A public WebSocket message exposed an internal credential field');
}
async function request(path, { token, body, method = 'POST', origin = base } = {}) {
  const response = await fetch(new URL(path, base), { method, redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Origin: origin, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  expect(/no-store/i.test(response.headers.get('Cache-Control') || ''), 'A private identity or seat API response was cacheable');
  let value; try { value = await response.json(); } catch { throw new Error('The API did not return JSON'); }
  return { status: response.status, value };
}
async function identity() {
  const token = randomBytes(32).toString('hex'); secrets.push(token);
  const registered = await request('/api/player', { body: { token } });
  expect(registered.status === 200 && typeof registered.value.playerId === 'string', 'Anonymous test registration failed');
  secrets.push(registered.value.playerId);
  return token;
}
async function waitUntil(predicate, message, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (predicate()) return; await delay(20); }
  throw new Error(message);
}
function connect(reservation) {
  expect(typeof reservation?.roomCode === 'string' && /^[0-9A-HJKMNP-TV-Z]{8}$/.test(reservation.roomCode)
    && [0, 1].includes(reservation.seat) && typeof reservation.ticket === 'string'
    && reservation.socketPath === `/api/island/pvp/rooms/${reservation.roomCode}/socket`, 'Room reservation was incomplete');
  secrets.push(reservation.ticket);
  const url = new URL(reservation.socketPath, base); url.protocol = target.protocol === 'https:' ? 'wss:' : 'ws:';
  expect(!url.search && !url.hash && !url.username && !url.password, 'Socket credentials must never enter a URL');
  const socket = new WebSocket(url, { origin: base, handshakeTimeout: 8000 });
  const client = { socket, seat: reservation.seat, room: null, snapshots: new Map(), messages: [], sequence: 0, failure: null, closed: false };
  clients.push(client);
  socket.on('open', () => socket.send(JSON.stringify({ type: 'auth', ticket: reservation.ticket })));
  socket.on('message', (data, binary) => {
    try {
      expect(!binary && data.length <= 65536, 'Unexpected socket frame format');
      let message; try { message = JSON.parse(data.toString()); } catch { throw new Error('The socket sent invalid JSON'); }
      privateSafe(message); client.messages.push(message);
      if (message.type === 'room') client.room = message.room;
      if (message.type === 'snapshot') {
        expect(Number.isSafeInteger(message.sequence) && message.state?.fighters?.length === 2, 'Incomplete authoritative snapshot');
        client.snapshots.set(`${message.matchId}:${message.sequence}`, message);
      }
    } catch (error) { client.failure = error; }
  });
  socket.on('error', () => { client.failure = new Error('A test WebSocket connection failed'); });
  socket.on('unexpected-response', (_request, response) => { response.resume(); client.failure = new Error('WebSocket upgrade was rejected'); });
  socket.on('close', () => { client.closed = true; });
  return client;
}
function healthy() { for (const client of clients) if (client.failure) throw client.failure; return true; }
function send(client, message) {
  healthy(); expect(client.socket.readyState === WebSocket.OPEN, 'A test socket closed before its action');
  client.socket.send(JSON.stringify(message));
}
function input(client, value) { send(client, { type: 'input', matchId: client.room.matchId, seq: client.sequence++, input: { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false, ...value } }); }
function commonSnapshot(left, right, predicate = () => true) {
  healthy();
  const entries = [...left.snapshots.entries()].reverse();
  for (const [key, first] of entries) {
    const second = right.snapshots.get(key); if (!second || !predicate(first.state)) continue;
    expect(JSON.stringify(first.state) === JSON.stringify(second.state), 'The two players received different states for the same authoritative sequence');
    return first;
  }
  return null;
}
function safeSnapshot(state) {
  expect(state.fighters.every(fighter => Number.isFinite(fighter.x) && Number.isFinite(fighter.y)
    && fighter.x >= 42 - 1e-7 && fighter.x <= 918 + 1e-7 && fighter.y >= 42 - 1e-7 && fighter.y <= 498 + 1e-7
    && fighter.hp >= 0 && fighter.hp <= 160 && fighter.maxHp === 160 && fighter.energy >= 0 && fighter.energy <= 100), 'The server accepted an impossible body or health state');
}

let host, guest;
try {
  const [first, second, third] = await Promise.all([identity(), identity(), identity()]);
  const created = await request('/api/island/pvp/rooms', { token: first, body: { nickname: '測試島民甲' } });
  expect(created.status === 200 || created.status === 201, 'Room creation failed');
  const code = created.value.roomCode;
  const joined = await request(`/api/island/pvp/rooms/${code}/join`, { token: second, body: { nickname: '測試島民乙' } });
  expect(joined.status === 200, 'Second player could not reserve the other seat');
  expect(created.value.seat !== joined.value.seat && code === joined.value.roomCode, 'The two players did not receive distinct seats in the same room');
  const outsider = await request(`/api/island/pvp/rooms/${code}/join`, { token: third, body: { nickname: '第三位測試' } });
  expect(outsider.status === 409 && outsider.value.error === 'pvp_room_full', 'A third player was able to enter a full room');
  console.log('HTTP: two private seats reserved; third player rejected.');
  host = connect(created.value); guest = connect(joined.value);
  await waitUntil(() => healthy() && host.room?.phase === 'waiting' && guest.room?.phase === 'waiting'
    && host.room.players.every(player => player.connected) && guest.room.players.every(player => player.connected), 'Both real WebSockets did not authenticate');
  expect(host.room.matchId === guest.room.matchId, 'The players were assigned different matches');
  for (const client of [host, guest]) send(client, { type: 'ready', matchId: client.room.matchId, ready: true });
  await waitUntil(() => healthy() && host.room?.phase === 'countdown' && guest.room?.phase === 'countdown', 'Both ready messages did not start a countdown');
  expect(host.room.countdownEndsAt === guest.room.countdownEndsAt && host.room.countdownEndsAt > host.room.serverNow, 'The players did not share the same server countdown');
  await waitUntil(() => healthy() && host.room?.phase === 'playing' && guest.room?.phase === 'playing'
    && commonSnapshot(host, guest, state => state.phase === 'playing'), 'The server did not start the real match after the countdown');
  const initial = commonSnapshot(host, guest, state => state.phase === 'playing'); safeSnapshot(initial.state);
  console.log('WebSocket: both ready, shared countdown and authoritative match confirmed.');

  // Unknown client health/result fields must be rejected or ignored by the
  // authority. Large vectors are directions, never trusted world coordinates.
  input(host, { x: 999999, y: -999999, attack: false, dodge: false, special: false, throw: false, hp: 0, maxHp: 99999, damage: 99999, winner: host.seat });
  send(host, { type: 'result', matchId: host.room.matchId, winner: host.seat, hp: 0 });
  await delay(450);
  await waitUntil(() => commonSnapshot(host, guest, state => state.elapsed >= initial.state.elapsed + .25), 'The authority stopped after malformed client fields');
  const guarded = commonSnapshot(host, guest, state => state.phase === 'playing' && state.elapsed >= initial.state.elapsed + .25);
  expect(guarded && guarded.state.winner === null && guarded.state.fighters.every(body => body.hp === 160), 'Client fields forged health or a result');
  safeSnapshot(guarded.state);
  expect(gapBetween(guarded.state.fighters[host.seat], initial.state.fighters[host.seat]) <= 100, 'Client-supplied coordinates teleported a fighter');

  const movementStart = guarded.state;
  for (let n = 0; n < 12; n++) {
    input(host, { x: 0, y: -1 }); input(guest, { x: 0, y: 1 }); await delay(50);
  }
  await waitUntil(() => commonSnapshot(host, guest, state => state.elapsed >= movementStart.elapsed + .45), 'The server did not advance both control streams');
  const moved = commonSnapshot(host, guest, state => state.elapsed >= movementStart.elapsed + .45); safeSnapshot(moved.state);
  expect(moved.state.fighters[host.seat].y < movementStart.fighters[host.seat].y - 10
    && moved.state.fighters[guest.seat].y > movementStart.fighters[guest.seat].y + 10, 'Both human controls did not move their own authoritative fighter');
  await delay(450);
  const stopped = commonSnapshot(host, guest, state => state.elapsed > moved.state.elapsed + .25);
  expect(stopped, 'No snapshot arrived after stale-input neutralization');
  await delay(350);
  const later = commonSnapshot(host, guest, state => state.elapsed > stopped.state.elapsed + .2);
  expect(later && later.state.fighters.every((body, seat) => gapBetween(body, stopped.state.fighters[seat]) < 1e-7), 'Stale input continued moving a disconnected controller');
  console.log('Authority: real movement works; forged fields cannot win or teleport; stale inputs stop.');

  const matchId = host.room.matchId;
  send(guest, { type: 'leave', matchId });
  await waitUntil(() => commonSnapshot(host, guest, state => state.phase === 'finished'), 'The two players did not receive the same final state');
  const final = commonSnapshot(host, guest, state => state.phase === 'finished');
  expect(final.matchId === matchId && final.state.winner === host.seat && final.state.reason === 'forfeit', 'Explicit leave did not resolve the correct shared forfeit');
  expect(final.state.fighters.every(body => body.hp === 160), 'A leave invented combat damage');
  expect(clients.every(client => client.messages.some(message => message.type === 'room' && message.room.phase === 'finished')), 'Both clients did not receive terminal room status');
  console.log('Result: both clients agree on the same match, winner and forfeit.');
} finally {
  for (const client of clients) {
    if (client.socket.readyState === WebSocket.OPEN) {
      try { client.socket.send(JSON.stringify({ type: 'leave', matchId: client.room?.matchId })); } catch {}
      client.socket.close(1000, 'smoke complete');
    } else if (client.socket.readyState === WebSocket.CONNECTING) client.socket.terminate();
  }
  await delay(100);
  for (const client of clients) if (client.socket.readyState !== WebSocket.CLOSED) client.socket.terminate();
  secrets.fill('');
}
healthy();
console.log('PASS: room capacity, realtime play, authority, privacy and cleanup.');
function gapBetween(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
