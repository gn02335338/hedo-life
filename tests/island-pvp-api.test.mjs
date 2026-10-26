import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import * as http from '../worker/http.js';
import { handlePvpArchive, isPvpSocketPath, proxyPvpSocket, randomPvpRoomCode, PVP_CODE_PATTERN, PVP_CODE_ALPHABET, assertPvpOrigin } from '../worker/island-pvp-directory.js';

const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
function harness(t) {
  const db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys=ON'); t.after(() => db.close());
  const sql = { exec(query, ...args) { let rows = []; if (!args.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const calls = [], room = { async fetch(request) { const body = request.method === 'POST' ? await request.json() : null; calls.push({ url: request.url, method: request.method, headers: Object.fromEntries(request.headers), body }); return http.json({ forwarded: true, roomCode: body?.roomCode || 'ABCD2345', seat: 0, ticket: 'synthetic-unit-only-ticket' }, request.url.endsWith('/create') ? 201 : 200); } };
  const env = { ISLAND_PVP: { idFromName(name) { assert.match(name, /^island-pvp-v1:[0-9ABCDEFGHJKMNPQRSTVWXYZ]{8}$/); return name; }, get() { return room; } } };
  const scope = vm.createContext({ DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, ENDINGS: [], ...http, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, handlePvpArchive, isPvpSocketPath, proxyPvpSocket, handleDomainMigration: async () => null, crypto, Response, Request, URL, Date });
  vm.runInContext(source, scope); const archive = new scope.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, env);
  const call = async (path, { method = 'GET', token, body, headers = {}, origin = 'https://game.example', resetRate = true } = {}) => {
    if (resetRate) archive.rate = new http.RateGuard();
    const response = await archive.fetch(new Request(`https://game.example${path}`, { method, headers: { ...(origin !== null ? { Origin: origin } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const register = async token => { const response = await call('/api/player', { method: 'POST', body: { token } }); assert.equal(response.status, 200); return { id: response.body.playerId, token }; };
  return { archive, worker: scope.worker, db, sql, calls, env, call, register };
}
const createPath = '/api/island/pvp/rooms';
const joinPath = `${createPath}/ABCD2345/join`;

test('PVP HTTP room claims use the established anonymous bearer and forward only a verified owner to the independent room', async t => {
  const h = harness(t), p = await h.register('a'.repeat(64));
  const created = await h.call(createPath, { method: 'POST', token: p.token, body: { nickname: '甲' } });
  assert.equal(created.status, 201); assert.match(created.headers.get('Cache-Control'), /no-store/); assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://island-pvp.internal/create'); assert.equal(h.calls[0].body.playerId, p.id); assert.equal(h.calls[0].body.nickname, '甲'); assert.match(h.calls[0].body.roomCode, PVP_CODE_PATTERN);
  for (const text of [p.token, 'Authorization', 'Origin', 'CF-Connecting-IP']) assert.ok(!JSON.stringify(h.calls[0]).includes(text), 'no bearer or origin/IP forwards into a room claim');
  const joined = await h.call(joinPath, { method: 'POST', token: p.token, body: {} }); assert.equal(joined.status, 200); assert.equal(h.calls[1].url, 'https://island-pvp.internal/join'); assert.equal(h.calls[1].body.playerId, p.id);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n, 0); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM player_endings').one().n, 0);
});

test('room claims reject unknown/forged owners, cross-site or missing origins, wrong methods, queries and unrecognized nickname fields', async t => {
  const h = harness(t), p = await h.register('b'.repeat(64));
  assert.equal((await h.call(createPath, { method: 'POST', body: {} })).status, 401);
  assert.equal((await h.call(createPath, { method: 'POST', token: 'c'.repeat(64), body: {} })).status, 401);
  for (const origin of [null, 'https://elsewhere.example']) assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: {}, origin })).status, 403);
  assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  assert.equal((await h.call(createPath, { token: p.token })).status, 405);
  assert.equal((await h.call(`${joinPath}?ticket=do-not-accept`, { method: 'POST', token: p.token, body: {} })).status, 400);
  for (const body of [{ nickname: '<img>' }, { nickname: 'a'.repeat(13) }, { nickname: '甲\n乙' }, { nickname: '甲', playerId: p.id }, { nickname: 123 }, { winner: 0 }]) {
    assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body })).status, 400);
  }
  assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: { nickname: 'a'.repeat(1200) } })).status, 413);
  assert.equal(h.calls.length, 0);
});

test('persistent create limits contain per-owner and per-IP room fanout without retaining raw IPs or creating career records', async t => {
  const h = harness(t), p = await h.register('d'.repeat(64)), ip = '203.0.113.42';
  for (let i = 0; i < 6; i++) assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: {}, headers: { 'CF-Connecting-IP': ip } })).status, 201);
  assert.equal((await h.call(createPath, { method: 'POST', token: p.token, body: {}, headers: { 'CF-Connecting-IP': ip } })).status, 429);
  assert.equal(h.calls.length, 6);
  const rows = h.sql.exec('SELECT * FROM island_pvp_room_limits').toArray(); assert.equal(rows.length, 2); assert.ok(!JSON.stringify(rows).includes(ip));
  assert.ok(rows.some(row => row.rate_key === `player:${p.id}` && row.count === 6));
  assert.equal((await h.call(joinPath, { method: 'POST', token: p.token, body: {}, headers: { 'CF-Connecting-IP': ip } })).status, 200, 'create quota does not block reconnect');
});

test('socket proxy requires exact Origin, a public room path and no URL/protocol credentials', async () => {
  let forwarded = null;
  const env = { ISLAND_PVP: { idFromName: value => value, get() { return { fetch: async request => { forwarded = request; return Response.json({ ok: true }); } }; } } };
  const request = (url = 'https://game.example/api/island/pvp/rooms/ABCD2345/socket', headers = {}) => new Request(url, { headers: { Upgrade: 'websocket', Origin: 'https://game.example', ...headers } });
  assert.equal((await proxyPvpSocket(request(), env)).status, 200); assert.equal(forwarded.url, 'https://game.example/api/island/pvp/rooms/ABCD2345/socket');
  for (const req of [request(undefined, { Origin: 'https://other.example' }), request(undefined, { 'Sec-Fetch-Site': 'cross-site' }), new Request('https://game.example/api/island/pvp/rooms/ABCD2345/socket', { headers: { Upgrade: 'websocket' } })]) {
    await assert.rejects(proxyPvpSocket(req, env), error => error.status === 403);
  }
  for (const req of [request('https://game.example/api/island/pvp/rooms/ABCD2345/socket?ticket=secret'), request(undefined, { 'Sec-WebSocket-Protocol': 'ticket-secret' }), request(undefined, { Upgrade: 'other' })]) {
    await assert.rejects(proxyPvpSocket(req, env), error => error.status === 400);
  }
  assert.doesNotThrow(() => assertPvpOrigin(new Request('http://localhost:4196/api/island/pvp/rooms/ABCD2345/socket', { headers: { Origin: 'http://localhost:4196' } })));
  assert.throws(() => assertPvpOrigin(new Request('http://localhost:4196/api/island/pvp/rooms/ABCD2345/socket', { headers: { Origin: 'http://127.0.0.1:4196' } })));
  for (let n = 0; n < 100; n++) assert.match(randomPvpRoomCode(), PVP_CODE_PATTERN);
});

test('deployment entry adds an independent room class while retaining the existing Worker, archive binding and v1 SQLite migration', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  assert.equal(config.name, 'hedo-life'); assert.equal(config.workers_dev, true); assert.equal(config.main, 'worker/entry.js');
  assert.deepEqual(config.durable_objects.bindings.find(row => row.name === 'ARCHIVE'), { name: 'ARCHIVE', class_name: 'HedoArchive' });
  assert.deepEqual(config.migrations[0], { tag: 'v1', new_sqlite_classes: ['HedoArchive'] });
  assert.deepEqual(config.durable_objects.bindings.find(row => row.name === 'ISLAND_PVP'), { name: 'ISLAND_PVP', class_name: 'IslandPvpRoom' });
  assert.deepEqual(config.migrations[1], { tag: 'v2-island-pvp', new_sqlite_classes: ['IslandPvpRoom'] });
  const entry = readFileSync(new URL('../worker/entry.js', import.meta.url), 'utf8');
  assert.match(entry, /export \{ default, HedoArchive \} from '.\/index.js'/); assert.match(entry, /export \{ IslandPvpRoom \} from '.\/island-pvp-room.js'/);
});

test('a shared network cannot create unbounded rooms by registering fresh anonymous owners', async t => {
  const h = harness(t), ip = '203.0.113.91';
  let accepted = 0;
  for (let owner = 0; owner < 7; owner++) {
    const p = await h.register((owner + 1).toString(16).padStart(64, '0'));
    for (let n = 0; n < 6; n++) {
      const response = await h.call(createPath, { method: 'POST', token: p.token, body: {}, headers: { 'CF-Connecting-IP': ip } });
      if (accepted < 40) { assert.equal(response.status, 201); accepted++; }
      else assert.equal(response.status, 429);
    }
  }
  assert.equal(accepted, 40); assert.equal(h.calls.length, 40);
  const rows = h.sql.exec('SELECT * FROM island_pvp_room_limits').toArray(); assert.ok(!JSON.stringify(rows).includes(ip));
  assert.equal(rows.find(row => row.rate_key.startsWith('ip:')).count, 40);
});

const socketRequest = (code, { ip = '203.0.113.88', origin = 'https://game.example', search = '', protocol, upgrade = 'websocket' } = {}) =>
  new Request(`https://game.example/api/island/pvp/rooms/${code}/socket${search}`, { headers: {
    ...(origin === null ? {} : { Origin: origin }), 'CF-Connecting-IP': ip,
    ...(protocol === undefined ? {} : { 'Sec-WebSocket-Protocol': protocol }), Upgrade: upgrade,
  } });

test('the existing archive rate-gates a single upgrade and returns the room 101/socket unchanged without accepting its frames', async t => {
  const h = harness(t), socket = {}, response = { status: 101, webSocket: socket, headers: new Headers() };
  let archiveLookups = 0, roomLookups = 0, roomRequest;
  h.env.ISLAND_PVP = { idFromName(name) { roomLookups++; assert.equal(name, 'island-pvp-v1:ABCD2345'); return name; }, get() { return { fetch: async request => { roomRequest = request; return response; } }; } };
  h.env.ARCHIVE = { idFromName(name) { archiveLookups++; assert.equal(name, 'global-v3'); return name; }, get() { return h.archive; } };
  // Node's built-in Response disallows status 101; keep this fake response
  // opaque so both Worker and Archive must forward, rather than reserialize it.
  const request = socketRequest('ABCD2345');
  assert.equal(await h.worker.fetch(request, h.env), response);
  assert.equal(response.webSocket, socket); assert.equal(roomRequest, request); assert.equal(archiveLookups, 1); assert.equal(roomLookups, 1);
  const rows = h.sql.exec('SELECT * FROM island_pvp_room_limits').toArray(); assert.equal(rows.length, 1); assert.match(rows[0].rate_key, /^ws-ip:[a-f0-9]{64}$/); assert.equal(rows[0].count, 1);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM players').one().n, 0, 'a handshake does not fabricate an anonymous player or grant a seat');
});

test('unknown room codes consume the same persistent IP upgrade budget and over-limit requests stop before any DO lookup', async t => {
  const h = harness(t); let now = Date.now(), lookups = 0, fetches = 0;
  t.mock.method(Date, 'now', () => now);
  h.env.ISLAND_PVP = { idFromName(name) { lookups++; return name; }, get() { return { fetch: async () => { fetches++; return http.json({ error: 'pvp_room_not_found' }, 404); } }; } };
  const code = value => `ZZZZZZ${PVP_CODE_ALPHABET[Math.floor(value / 32)]}${PVP_CODE_ALPHABET[value % 32]}`;
  for (let index = 0; index < 240; index++) {
    h.archive.rate = new http.RateGuard();
    assert.equal((await h.archive.fetch(socketRequest(code(index)))).status, 404);
  }
  const denied = await h.archive.fetch(socketRequest(code(240)));
  assert.equal(denied.status, 429); assert.equal((await denied.json()).error, 'pvp_connection_rate'); assert.equal(denied.headers.get('Retry-After'), '10');
  assert.equal(lookups, 240); assert.equal(fetches, 240);
  const rows = h.sql.exec('SELECT * FROM island_pvp_room_limits').toArray(); assert.equal(rows.length, 1); assert.equal(rows[0].count, 240); assert.ok(!JSON.stringify(rows).includes('203.0.113.88'));
  assert.equal((await h.archive.fetch(socketRequest(code(241), { ip: '203.0.113.89' }))).status, 404, 'another network has an independent budget');
  now += 10 * 60 * 1000;
  assert.equal((await h.archive.fetch(socketRequest(code(242)))).status, 404, 'the elapsed quota window releases the original network');
  assert.equal(lookups, 242); assert.equal(fetches, 242);
});

test('invalid origin, URL credentials and WebSocket protocol credentials are rejected before quota writes or room resolution', async t => {
  const h = harness(t); let lookups = 0;
  h.env.ISLAND_PVP = { idFromName(name) { lookups++; return name; }, get() { throw new Error('invalid handshakes must not reach a room'); } };
  for (const [options, expected] of [[{ origin: null }, 403], [{ origin: 'https://elsewhere.example' }, 403], [{ search: '?ticket=synthetic-secret' }, 400], [{ protocol: 'synthetic-secret' }, 400], [{ upgrade: 'other' }, 400]]) {
    assert.equal((await h.archive.fetch(socketRequest('ABCD2345', options))).status, expected);
  }
  assert.equal(lookups, 0);
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'island_pvp_room_limits'").one().n, 0, 'invalid requests do not write rate state');
});
