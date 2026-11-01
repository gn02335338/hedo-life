import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OfficeStore } from '../worker/office.js';
import { OfficeEventStore, OFFICE_EVENT_NAME, OFFICE_EVENT_LIMITS, officeCallbackURL, signOfficeEvent } from '../worker/office-events.js';
import * as http from '../worker/http.js';

const callback = 'https://callback.example.net/mcp/office';
const secret = () => 'whsec_' + randomBytes(32).toString('base64');
const subscribe = (key = secret(), url = callback, extra = {}) => ({ name: OFFICE_EVENT_NAME, arguments: {}, delivery: { mode: 'webhook', url, secret: key }, cursor: null, ...extra });
function database(t) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close());
  const sql = { exec(query, ...values) { let rows = []; if (!values.length && query.includes(';')) db.exec(query); else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); } return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } }; } };
  let alarm = null; const storage = { sql, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return alarm; }, async setAlarm(value) { alarm = value; }, async deleteAlarm() { alarm = null; } };
  return { sql, storage, alarm: () => alarm, clearAlarm() { alarm = null; } };
}
function harness(t) {
  const h = database(t); let now = Date.parse('2026-11-01T00:00:00Z'), calls = [], resultStatus = 204, verification = 'echo', observer;
  const admin = { async configuration() { return {}; } }; let office;
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, options, body }); observer?.(body);
    if (body.type === 'verification') return verification === 'echo' ? Response.json({ challenge: body.challenge }) : verification === 'redirect' ? new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1' } }) : Response.json({ challenge: 'wrong-challenge' });
    return new Response(null, { status: resultStatus });
  };
  const reopen = () => { office = new OfficeStore(h.sql, h.storage, {}, { now: () => now, admin }); office.events.fetcher = fetcher; }; reopen();
  const member = async (kind = 'agent', status = 'approved') => {
    const id = crypto.randomUUID(), token = randomBytes(32).toString('hex'), at = new Date(now).toISOString();
    h.sql.exec('INSERT INTO office_members(id,token_hash,kind,name,role,intro,contact,admission_status,approved_at,created_at,updated_at,social_auto_reply,social_auto_activities) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', id, await http.tokenHash(token), kind, 'Public test member', 'tester', 'Public intro', 'PRIVATE-CONTACT', status, at, at, at, 1, 1);
    return { id, token, owner: { memberId: id, grantId: null } };
  };
  const item = owner => { const id = crypto.randomUUID(); h.sql.exec('INSERT INTO office_inbox(id,member_id,type,sender_id,payload_json,expires_at,created_at) VALUES(?,?,?,?,?,?,?)', id, owner.id, 'message', 'jack', JSON.stringify({ text: 'UNTRUSTED-NOT-IN-EVENT', privateFixture: 'PRIVATE-PAYLOAD' }), now + 3600000, now); return id; };
  const mcp = (method, params, token) => office.fetch(new Request('https://office.example/api/office/mcp', { method: 'POST', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params }) }));
  return { ...h, member, item, mcp, reopen, office: () => office, events: () => office.events, calls: () => calls, now: () => now, advance(ms) { now += ms; }, status(value) { resultStatus = value; }, verification(value) { verification = value; }, observe(fn) { observer = fn; } };
}
function assertSignature(call, key) {
  const { options } = call, timestamp = options.headers['webhook-timestamp'], id = options.headers['webhook-id'];
  const expected = 'v1,' + createHmac('sha256', Buffer.from(key.slice(6), 'base64')).update(`${id}.${timestamp}.${options.body}`).digest('base64');
  assert.ok(options.headers['webhook-signature'].split(' ').includes(expected));
  assert.equal(options.redirect, 'manual'); assert.equal(options.headers.Authorization, undefined); assert.equal(options.headers.Cookie, undefined);
}

test('MCP events discovery and signed callback verification use the approved owner without exposing credentials', async t => {
  const h = harness(t), member = await h.member(), pending = await h.member('agent', 'pending'), key = secret();
  const initialize = await h.mcp('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'event-test', version: '1' } }, member.token); assert.deepEqual((await initialize.json()).result.capabilities.events, {});
  const list = await h.mcp('events/list', {}, member.token); assert.equal(list.status, 200); assert.equal((await list.json()).result.events[0].name, OFFICE_EVENT_NAME);
  const denied = await h.mcp('events/subscribe', subscribe(key), pending.token); assert.equal(denied.status, 403); assert.equal(h.calls().length, 0);
  const response = await h.mcp('events/subscribe', subscribe(key), member.token), body = await response.json(); assert.equal(response.status, 200); assert.match(body.result.id, /^sub_[a-f0-9]{64}$/); assert.equal(body.result.cursor, null); assert.equal(body.result.truncated, false);
  assert.equal(Date.parse(body.result.refreshBefore) - h.now(), OFFICE_EVENT_LIMITS.ttlMs); assert.ok(h.alarm() > h.now());
  assert.equal(h.calls().length, 1); assert.equal(h.calls()[0].body.type, 'verification'); assertSignature(h.calls()[0], key);
  const serialized = JSON.stringify(body) + JSON.stringify(h.calls()); assert.ok(!serialized.includes(member.token)); assert.ok(!serialized.includes('PRIVATE-CONTACT')); assert.ok(!serialized.includes(key));
  const unauth = await h.office().fetch(new Request('https://office.example/api/office/mcp')); assert.equal(unauth.status, 401); assert.match(unauth.headers.get('WWW-Authenticate'), /resource_metadata="https:\/\/office.example\/\.well-known\/oauth-protected-resource\/api\/office\/mcp"/);
});

test('public callback validation rejects SSRF targets, redirects, invalid keys and failed challenges before application delivery', async t => {
  const h = harness(t), member = await h.member();
  for (const url of ['http://callback.example.net/', 'https://localhost/x', 'https://app.local/x', 'https://app.internal/x', 'https://127.0.0.1/', 'https://2130706433/', 'https://0x7f000001/', 'https://[::1]/', 'https://169.254.169.254/', 'https://user:password@callback.example.net/', 'https://callback.example.net/#private', 'https://callback.example.net:8443/', 'https://hodo.bvivify.com/', 'https://bvivify.com/', 'https://hedo-life.bvstudio.workers.dev/']) assert.throws(() => officeCallbackURL(url), undefined, url);
  assert.equal(officeCallbackURL(callback), callback);
  for (const key of ['wrong', 'whsec_' + randomBytes(16).toString('base64'), 'whsec_' + randomBytes(65).toString('base64')]) await assert.rejects(h.events().handle('events/subscribe', subscribe(key), member.owner));
  assert.equal(h.calls().length, 0);
  h.verification('redirect'); await assert.rejects(h.events().handle('events/subscribe', subscribe(), member.owner), error => error.rpcCode === -32015 && error.rpcData.reason === 'challenge_failed');
  h.verification('wrong'); await assert.rejects(h.events().handle('events/subscribe', subscribe(), member.owner), error => error.rpcCode === -32015);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions').one().n, 0); assert.ok(h.calls().every(call => call.body.type === 'verification'));
});

test('subscriptions persist, refresh idempotently with bounded TTL, rotate signing keys and unsubscribe only their owner', async t => {
  const h = harness(t), member = await h.member(), stranger = await h.member(), first = secret(), replacement = secret();
  const initial = await h.events().handle('events/subscribe', subscribe(first, callback, { ttlMs: 120000 }), member.owner);
  h.advance(10000); h.reopen(); const refreshed = await h.events().handle('events/subscribe', subscribe(first, callback, { ttlMs: 180000 }), member.owner); assert.equal(initial.id, refreshed.id); assert.equal(h.calls().length, 1, 'successful verification has a bounded owner/URL cache');
  const rotated = await h.events().handle('events/subscribe', subscribe(replacement), member.owner); assert.equal(rotated.id, initial.id); assert.equal(h.calls().length, 2); h.item(member); await h.events().pump();
  const delivery = h.calls().find(call => call.body.name === OFFICE_EVENT_NAME); assertSignature(delivery, first); assertSignature(delivery, replacement); assert.equal(delivery.options.headers['webhook-signature'].split(' ').length, 2);
  h.advance(OFFICE_EVENT_LIMITS.rotationMs + 1); h.item(member); await h.events().pump(); const last = h.calls().at(-1); assertSignature(last, replacement); assert.equal(last.options.headers['webhook-signature'].split(' ').length, 1);
  const unsubscription = { name: OFFICE_EVENT_NAME, arguments: {}, delivery: { mode: 'webhook', url: callback } };
  assert.deepEqual(await h.events().handle('events/unsubscribe', unsubscription, stranger.owner), {}); assert.ok(h.events().row(initial.id));
  assert.deepEqual(await h.events().handle('events/unsubscribe', unsubscription, member.owner), {}); assert.deepEqual(await h.events().handle('events/unsubscribe', unsubscription, member.owner), {}); assert.equal(h.events().nextAlarm(), null);
});

test('subscription quotas and expiry fail closed without evicting active subscriptions', async t => {
  const h = harness(t), member = await h.member();
  for (let index = 0; index < 5; index++) await h.events().handle('events/subscribe', subscribe(secret(), callback + '/' + index, { ttlMs: 1 }), member.owner);
  assert.equal(h.calls().length, 5); await assert.rejects(h.events().handle('events/subscribe', subscribe(secret(), callback + '/sixth'), member.owner), error => error.rpcCode === -32000); assert.equal(h.calls().length, 5);
  h.advance(OFFICE_EVENT_LIMITS.minTtlMs); h.reopen(); assert.equal(h.events().hasActive(), false); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions').one().n, 0);
  const bounded = await h.events().handle('events/subscribe', subscribe(secret(), callback, { ttlMs: 365 * 86400000 }), member.owner); assert.equal(Date.parse(bounded.refreshBefore) - h.now(), OFFICE_EVENT_LIMITS.maxTtlMs);
});

test('durable inbox events carry only summaries, keep stable retry IDs, use fresh signatures and never fabricate heartbeat', async t => {
  const h = harness(t), member = await h.member(), key = secret(); await h.events().handle('events/subscribe', subscribe(key), member.owner); const itemId = h.item(member); h.status(503);
  await h.events().pump(); const first = h.calls().filter(call => call.body.eventId)[0]; assert.deepEqual(first.body.data, { itemId, type: 'message' }); assert.equal(first.options.headers['webhook-id'], first.body.eventId); assertSignature(first, key);
  assert.ok(!JSON.stringify(first).includes('UNTRUSTED')); assert.ok(!JSON.stringify(first).includes('PRIVATE-')); assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', member.id).one().last_seen_at, null);
  await h.events().pump(); assert.equal(h.calls().filter(call => call.body.eventId).length, 1, 'retry backoff is durable');
  h.advance(5000); h.reopen(); h.status(204); await h.events().pump(); const second = h.calls().filter(call => call.body.eventId)[1]; assert.equal(second.body.eventId, first.body.eventId); assert.equal(second.options.body, first.options.body); assert.notEqual(second.options.headers['webhook-timestamp'], first.options.headers['webhook-timestamp']); assertSignature(second, key);
  await h.events().pump(); assert.equal(h.calls().filter(call => call.body.eventId).length, 2, 'acknowledged deliveries remain deduplicated');
});

test('410 stops subscription, 413 and redirects are terminal per event, and transient retries have a bound', async t => {
  for (const status of [410, 413, 302, 503]) {
    const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner); const id = h.item(member); h.status(status);
    for (let index = 0; index < 8; index++) { await h.events().pump(); h.advance(300000); }
    const deliveries = h.calls().filter(call => call.body.data?.itemId === id); assert.equal(deliveries.length, status === 503 ? OFFICE_EVENT_LIMITS.attempts : 1);
    if (status === 410) assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions').one().n, 0);
  }
});

test('opt-out, admission revoke and OAuth grant revoke stop pending callback delivery and background materialization', async t => {
  const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner); h.item(member);
  let materialized = 0; h.events().materialize = () => materialized++;
  h.sql.exec('UPDATE office_members SET social_auto_reply=0,social_auto_activities=0 WHERE id=?', member.id); await h.events().pump(); assert.equal(h.events().nextAlarm(), null); assert.equal(materialized, 0); assert.equal(h.calls().filter(call => call.body.eventId).length, 0);
  h.sql.exec('UPDATE office_members SET social_auto_reply=1 WHERE id=?', member.id); await h.events().pump(); assert.equal(materialized, 1); assert.ok(h.calls().some(call => call.body.eventId));
  h.item(member); h.sql.exec("UPDATE office_members SET admission_status='revoked' WHERE id=?", member.id); await h.events().pump(); assert.equal(h.events().nextAlarm(), null); assert.equal(materialized, 1);
  const other = await h.member(); let grantLive = true; h.events().isGrantActive = (grantId, memberId) => grantLive && grantId === 'synthetic-grant' && memberId === other.id;
  await h.events().handle('events/subscribe', subscribe(), { memberId: other.id, grantId: 'synthetic-grant' }); h.item(other); grantLive = false; await h.events().pump(); assert.equal(h.events().hasActive(), false); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_subscriptions WHERE member_id=?', other.id).one().n, 0);
});

test('callback application data is suppressed when opt-out occurs during asynchronous signing', async t => {
  const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner); h.item(member);
  const send = h.events().signedRequest.bind(h.events());
  h.events().signedRequest = (...args) => { const pending = send(...args); h.sql.exec('UPDATE office_members SET social_auto_reply=0,social_auto_activities=1 WHERE id=?', member.id); return pending; };
  await h.events().pump(); assert.equal(h.calls().filter(call => call.body.eventId).length, 0);
});

test('materialized NPC and activity inbox items can wake cloud subscriptions without any model or presence writes', async t => {
  const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner);
  h.events().materialize = memberId => { h.office().social.deliverActivity(memberId, { id: 'synthetic-event-invite', type: 'activity-invitation', senderId: null, payload: { eventId: 'test-event' }, expiresAt: h.now() + 120000 }); };
  await h.events().pump(); assert.ok(h.calls().some(call => call.body.data?.type === 'activity-invitation')); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 0); assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', member.id).one().last_seen_at, null);
});

test('Standard Webhooks signature uses the exact serialized bytes independently of Unicode content', async () => {
  const key = secret(), body = JSON.stringify({ text: '繁體中文 👋' }), timestamp = '1234567890', id = 'evt_independent_vector';
  assert.equal(await signOfficeEvent(key, id, timestamp, body), 'v1,' + createHmac('sha256', Buffer.from(key.slice(6), 'base64')).update(`${id}.${timestamp}.${body}`).digest('base64'));
});

function archiveScope(t, { feedbackDeadline = null, eventDeadline = null } = {}) {
  const h = database(t), calls = { feedbackCleanup: 0, pump: 0, officeInit: 0, forwarded: [] };
  class Office { constructor() { calls.officeInit++; this.events = { nextAlarm: () => eventDeadline, async pump() { calls.pump++; } }; } async fetch(request) { calls.forwarded.push(request); return Response.json({ ok: true }); } }
  class Feedback { cleanup() { calls.feedbackCleanup++; } nextCleanup() { return feedbackDeadline; } }
  class Noop {}
  const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
  const scope = vm.createContext({ ...http, OfficeStore: Office, DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, FeedbackStore: Feedback, AchievementStore: Noop, CharacterStore: Noop, ObservationStore: Noop, ENDINGS: [], Date, Request, Response, URL, crypto, handleDomainMigration: async () => null });
  vm.runInContext(source, scope); const promises = []; const ctx = { storage: h.storage, blockConcurrencyWhile(fn) { const promise = fn(); promises.push(promise); return promise; } };
  const create = () => new scope.HedoArchive(ctx, {}); return { ...h, scope, create, calls, ready: () => Promise.all(promises) };
}

test('the real archive alarm multiplexes events with feedback cleanup and restores only an already-existing office', async t => {
  const h = archiveScope(t, { feedbackDeadline: 50000, eventDeadline: 20000 }); const archive = h.create(); await h.ready(); assert.equal(h.calls.officeInit, 0); assert.equal(h.alarm(), 50000);
  h.sql.exec('CREATE TABLE office_event_subscriptions(id TEXT PRIMARY KEY)'); h.clearAlarm(); const restored = h.create(); await h.ready(); assert.equal(h.calls.officeInit, 1); assert.equal(h.alarm(), 20000);
  h.clearAlarm(); await restored.alarm(); assert.equal(h.calls.feedbackCleanup, 1); assert.equal(h.calls.pump, 1); assert.equal(h.alarm(), 20000);
  assert.equal(archive.sql.exec('SELECT COUNT(*) AS n FROM players').one().n, 0, 'anonymous archive identities are not changed');
});

test('root OAuth metadata routes use the original archive identity, accept only GET, and forward no private headers', async t => {
  const h = archiveScope(t), forwarded = [], names = [];
  const env = { ASSETS: { fetch() { throw new Error('metadata must not reach assets'); } }, ARCHIVE: { idFromName(name) { names.push(name); return 'same-id'; }, get() { return { async fetch(request) { forwarded.push(request); return Response.json({ metadata: true }); } }; } } };
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/office/mcp', '/.well-known/oauth-authorization-server', '/.well-known/oauth-authorization-server/api/office/oauth']) {
    const response = await h.scope.worker.fetch(new Request('https://hodo.bvivify.com' + path + '?private=discard', { headers: { Authorization: 'Bearer PRIVATE', Cookie: 'PRIVATE', Referer: 'https://private.example/' } }), env); assert.equal(response.status, 200);
    const target = forwarded.at(-1); assert.equal(target.url, 'https://hodo.bvivify.com/api/office/oauth/' + (path.includes('protected-resource') ? 'resource' : 'metadata')); assert.deepEqual([...target.headers.keys()], ['accept']);
    assert.equal((await h.scope.worker.fetch(new Request('https://hodo.bvivify.com' + path, { method: 'POST', body: 'PRIVATE' }), env)).status, 405);
  }
  assert.ok(names.every(name => name === 'global-v3'));
});


test('verification cache expiration is not extended by unverified refreshes and outbox identity survives an early TTL refresh', async t => {
  const h = harness(t), member = await h.member(), key = secret(); await h.events().handle('events/subscribe', subscribe(key, callback, { ttlMs: 600000 }), member.owner);
  h.item(member); h.status(503); await h.events().pump(); const original = h.calls().find(call => call.body.eventId);
  h.advance(120000); await h.events().handle('events/subscribe', subscribe(key), member.owner); assert.equal(h.calls().filter(call => call.body.type === 'verification').length, 1);
  h.advance(120000); await h.events().handle('events/subscribe', subscribe(key), member.owner); assert.equal(h.calls().filter(call => call.body.type === 'verification').length, 1);
  h.advance(120000); await h.events().handle('events/subscribe', subscribe(key), member.owner); assert.equal(h.calls().filter(call => call.body.type === 'verification').length, 2, 'cache expiry uses the last actual verification');
  h.status(204); await h.events().pump(); assert.equal(h.calls().filter(call => call.body.eventId).at(-1).body.eventId, original.body.eventId);
});

test('pruned inbox items release bounded outbox capacity while acknowledged items remain deduplicated', async t => {
  const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner);
  for (let index = 0; index < 200; index++) h.item(member);
  await h.events().pump(); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_outbox').one().n, 200);
  h.sql.exec('DELETE FROM office_inbox'); const next = h.item(member); await h.events().pump();
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_outbox').one().n, 1); assert.ok(h.calls().some(call => call.body.data?.itemId === next));
});

test('actual OAuth access resolves the event owner and revoking that grant disables its durable cloud subscription', async t => {
  const h = harness(t), member = await h.member(), clientId = crypto.randomUUID(), grantId = crypto.randomUUID(), access = randomBytes(32).toString('hex');
  h.sql.exec('INSERT INTO office_oauth_clients(id,name,redirects_json,created_at) VALUES(?,?,?,?)', clientId, 'Synthetic cloud client', '[]', h.now());
  h.sql.exec('INSERT INTO office_oauth_grants(id,member_id,client_id,scope,resource,created_at,expires_at) VALUES(?,?,?,?,?,?,?)', grantId, member.id, clientId, 'office', 'https://office.example/api/office/mcp', h.now(), h.now() + 86400000);
  h.sql.exec('INSERT INTO office_oauth_access(token_hash,grant_id,expires_at) VALUES(?,?,?)', await http.tokenHash(access), grantId, h.now() + 3600000);
  const response = await h.mcp('events/subscribe', subscribe(), access), result = (await response.json()).result; assert.ok(result?.id); assert.equal(h.events().row(result.id).grant_id, grantId);
  h.item(member); await h.events().pump(); const deliveries = h.calls().filter(call => call.body.eventId).length; assert.ok(deliveries > 0); assert.ok(!JSON.stringify(h.calls()).includes(access));
  h.item(member); h.office().oauth.revokeGrant(grantId); await h.events().pump(); assert.equal(h.calls().filter(call => call.body.eventId).length, deliveries); assert.equal(h.events().nextAlarm(), null);
  assert.equal((await h.mcp('events/list', {}, access)).status, 401); assert.equal(h.events().row(result.id), undefined);
});

test('a failed ambient materialization cannot block delivery of already-durable inbox work', async t => {
  const h = harness(t), member = await h.member(); await h.events().handle('events/subscribe', subscribe(), member.owner); const id = h.item(member);
  h.events().materialize = () => { throw new Error('Synthetic full ambient conversation board'); }; await h.events().pump();
  assert.ok(h.calls().some(call => call.body.data?.itemId === id)); assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', member.id).one().last_seen_at, null);
});
