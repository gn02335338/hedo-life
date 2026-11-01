import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';
import { OfficeStore } from '../worker/office.js';
import { OFFICE_SOCIAL_LIMITS } from '../worker/office-social.js';
import { tokenHash, ApiError, assertSameOrigin } from '../worker/http.js';
import { getOfficeEvent } from '../dist/office/events.js';
import { CHARACTER_IDS } from '../dist/character-stats.js';

const preferences = (extra = {}) => ({ autoReply: true, autoActivities: false, maxTurns: 6, cooldownSeconds: 30, ...extra });
function harness(t, setup = () => {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); let time = Date.parse('2026-11-01T00:00:00Z');
  const sql = { exec(query, ...values) {
    let rows = [];
    if (!values.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); }
    return { toArray: () => rows, one() { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } } };
  const admin = { async configuration() { return {}; }, async signature(_config, key) { return tokenHash(key); }, async authenticate(request) { if (request.headers.get('Cookie') !== 'test-admin=approved') throw new ApiError(401, 'admin_session_required', 'test session required'); return { hash: 'test-only-session' }; }, async writeGuard(request) { assertSameOrigin(request); if (request.headers.get('X-CSRF-Token') !== 'test-only-csrf') throw new ApiError(403, 'csrf', 'test csrf required'); } };
  setup(sql); let office; const reopen = () => office = new OfficeStore(sql, storage, {}, { now: () => time, admin }); reopen();
  const call = (path, { method = 'GET', body, bearer, origin = null, admin: reviewing = false } = {}) => {
    const headers = {}; if (body !== undefined) headers['Content-Type'] = 'application/json'; if (bearer) headers.Authorization = 'Bearer ' + bearer;
    if (origin !== null) headers.Origin = origin;
    if (reviewing) { headers.Cookie = 'test-admin=approved'; headers['X-CSRF-Token'] = 'test-only-csrf'; }
    return office.fetch(new Request('https://office.example/api/office' + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
  };
  const post = (path, body, bearer) => call(path, { method: 'POST', body, bearer });
  const member = async (kind = 'agent', status = 'approved') => {
    const token = randomBytes(32).toString('hex'), id = crypto.randomUUID(), name = kind + '-' + id.slice(0, 4), at = new Date(time).toISOString();
    sql.exec('INSERT INTO office_members(id,token_hash,kind,name,role,intro,contact,admission_status,approved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)', id, await tokenHash(token), kind, name, 'test', 'public profile', 'PRIVATE-' + id, status, at, at, at);
    return { id, token, name };
  };
  const data = async (response, expected = 200) => { const body = await response.json(); assert.equal(response.status, expected, JSON.stringify(body)); return body; };
  const inbox = async owner => data(await call('/inbox', { bearer: owner.token }));
  const prefs = async (owner, value = preferences()) => data(await post('/social-preferences', value, owner.token));
  const send = async (owner, recipient, extra = {}) => (await data(await post('/messages', { text: 'Public test message', recipientId: recipient.id, ...extra }, owner.token), 201)).message;
  const claim = async (owner, id) => data(await post(`/inbox/${id}/claim`, {}, owner.token));
  return { sql, call, post, member, data, inbox, prefs, send, claim, reopen, office: () => office, now: () => time, at(value) { time = value; }, advance(ms) { time += ms; } };
}

test('social preferences are opt-in, agent-only, persist and expose only public automation booleans', async t => {
  const h = harness(t), agent = await h.member(), human = await h.member('human'), pending = await h.member('agent', 'pending');
  const initial = await h.data(await h.call('/social-preferences', { bearer: agent.token }));
  assert.deepEqual(initial.socialPreferences, { autoReply: false, autoActivities: false, maxTurns: 4, cooldownSeconds: 60 });
  assert.equal((await h.call('/inbox')).status, 401); assert.equal((await h.call('/inbox', { bearer: pending.token })).status, 403);
  assert.equal((await h.call('/activities')).status, 200); assert.equal((await h.call('/activities', { bearer: pending.token })).status, 403);
  assert.ok((await h.data(await h.call('/activities', { bearer: agent.token }))).myMatches);
  assert.equal((await h.post('/social-preferences', preferences(), human.token)).status, 400);
  for (const body of [preferences({ maxTurns: 7 }), preferences({ maxTurns: 0 }), preferences({ maxTurns: '3' }), preferences({ cooldownSeconds: 29 }), preferences({ cooldownSeconds: 3601 }), preferences({ autoReply: 1 }), { ...preferences(), token: agent.token }]) assert.equal((await h.post('/social-preferences', body, agent.token)).status, 400);
  await h.prefs(agent, preferences({ autoActivities: true, maxTurns: 3, cooldownSeconds: 35 })); h.reopen();
  assert.deepEqual((await h.inbox(agent)).socialPreferences, { autoReply: true, autoActivities: true, maxTurns: 3, cooldownSeconds: 35 });
  const publicBody = await h.data(await h.call(''));
  assert.deepEqual(publicBody.members.find(row => row.id === agent.id).social, { autoReply: true, autoActivities: true });
  const serialized = JSON.stringify(publicBody); assert.ok(!serialized.includes('cooldownSeconds')); assert.ok(!serialized.includes('PRIVATE-')); assert.ok(!serialized.includes(agent.token));
  assert.equal(publicBody.members.find(row => row.id === agent.id).online, false, 'preferences and inbox polling do not invent a heartbeat');
  assert.equal((await h.call('/social-preferences', { method: 'POST', body: preferences(), bearer: agent.token, origin: 'https://bad.example' })).status, 403);
});

test('direct messages are durable, isolated, deduplicated inbox data; public snapshot never exposes leases or contacts', async t => {
  const h = harness(t), sender = await h.member('human'), receiver = await h.member(), stranger = await h.member();
  const message = await h.send(sender, receiver);
  let inbox = await h.inbox(receiver), item = inbox.items.find(row => row.type === 'message');
  assert.equal(item.senderId, sender.id); assert.equal(item.payload.message.id, message.id); assert.equal(item.payload.sender.name, sender.name); assert.equal(item.state, 'pending'); assert.equal(item.leaseExpiresAt, null);
  assert.equal((await h.post(`/inbox/${item.id}/claim`, {}, receiver.token)).status, 403, 'receiving never silently opts a seat in');
  assert.equal((await h.post(`/inbox/${item.id}/claim`, {}, stranger.token)).status, 404);
  assert.equal((await h.inbox(stranger)).items.filter(row => row.type === 'message').length, 0);
  await h.prefs(receiver); const lease = await h.claim(receiver, item.id); assert.match(lease.leaseToken, /^[a-f0-9]{64}$/);
  assert.equal(Date.parse(lease.leaseExpiresAt) - h.now(), 90000);
  const persisted = h.sql.exec('SELECT * FROM office_inbox WHERE id=?', item.id).one(); assert.notEqual(persisted.lease_hash, lease.leaseToken); assert.equal(persisted.lease_hash, await tokenHash(lease.leaseToken));
  assert.ok(!JSON.stringify(await h.inbox(receiver)).includes(lease.leaseToken)); assert.ok(!JSON.stringify(await h.data(await h.call(''))).includes('lease_hash'));
  h.reopen(); inbox = await h.inbox(receiver); assert.equal(inbox.items.filter(row => row.type === 'message').length, 1); assert.equal(inbox.items.find(row => row.id === item.id).state, 'leased');
  assert.equal((await h.post(`/inbox/${item.id}/claim`, {}, receiver.token)).status, 409);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 1);
});

test('leases expire and cannot be replayed; a successful reply atomically handles the item exactly once across restart', async t => {
  const h = harness(t), sender = await h.member('human'), receiver = await h.member(); await h.prefs(receiver);
  const parent = await h.send(sender, receiver), item = (await h.inbox(receiver)).items.find(row => row.type === 'message');
  const oldLease = await h.claim(receiver, item.id); h.advance(90000); const lease = await h.claim(receiver, item.id);
  assert.notEqual(lease.leaseToken, oldLease.leaseToken);
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { leaseToken: oldLease.leaseToken, text: 'old', submissionId: crypto.randomUUID() }, receiver.token)).status, 409);
  const body = { leaseToken: lease.leaseToken, text: 'Actual model supplied response', submissionId: crypto.randomUUID() };
  const sent = await h.data(await h.post(`/inbox/${item.id}/reply`, body, receiver.token));
  assert.equal(sent.item.state, 'handled'); assert.equal(sent.item.leaseExpiresAt, null); assert.equal(sent.message.replyToId, parent.id); assert.equal(sent.message.recipientId, sender.id); assert.equal(sent.message.conversationId, parent.conversationId); assert.equal(sent.message.turnIndex, 1); assert.equal(sent.message.automated, true);
  assert.equal((await h.post(`/inbox/${item.id}/claim`, {}, receiver.token)).status, 409);
  h.advance(6 * 3600000); h.reopen(); await h.inbox(receiver); const again = await h.data(await h.post(`/inbox/${item.id}/reply`, body, receiver.token));
  assert.equal(again.duplicate, true); assert.equal(again.message.id, sent.message.id); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 2);
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { ...body, text: 'changed' }, receiver.token)).status, 409);
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { ...body, submissionId: crypto.randomUUID() }, receiver.token)).status, 404);
  assert.equal((await h.post(`/inbox/${item.id}/claim`, {}, receiver.token)).status, 404);
  assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', receiver.id).one().last_seen_at, null, 'a reply does not fake connection heartbeat');
});

test('manual replies invalidate an outstanding model lease, and submission IDs deduplicate posts without spoofing', async t => {
  const h = harness(t), sender = await h.member('human'), receiver = await h.member(), other = await h.member(); await h.prefs(receiver);
  const parent = await h.send(sender, receiver), item = (await h.inbox(receiver)).items.find(row => row.type === 'message'), lease = await h.claim(receiver, item.id);
  const submissionId = crypto.randomUUID(), body = { text: 'Hand-written reply', replyToId: parent.id, submissionId };
  const response = await h.data(await h.post('/messages', body, receiver.token), 201); assert.equal(response.message.automated, false);
  assert.equal((await h.inbox(receiver)).items.find(row => row.id === item.id).state, 'handled');
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'Racing automatic response', submissionId: crypto.randomUUID() }, receiver.token)).status, 409);
  const retry = await h.data(await h.post('/messages', body, receiver.token)); assert.equal(retry.duplicate, true); assert.equal(retry.message.id, response.message.id);
  assert.equal((await h.post('/messages', { ...body, text: 'Changed same operation' }, receiver.token)).status, 409);
  assert.equal((await h.post('/messages', { ...body, submissionId: crypto.randomUUID() }, other.token)).status, 403);
  assert.equal((await h.post('/messages', { text: 'spoof', memberId: sender.id }, receiver.token)).status, 400);
});

test('conversation caps and cooldown stop agent echoes; a new human message starts a fresh segment', async t => {
  const h = harness(t), a = await h.member(), b = await h.member(), human = await h.member('human'); await h.prefs(a, preferences({ maxTurns: 3 })); await h.prefs(b);
  const first = await h.send(a, b), inbox = await h.inbox(b), item = inbox.items.find(row => row.payload?.message?.id === first.id), lease = await h.claim(b, item.id);
  const second = (await h.data(await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'second', submissionId: crypto.randomUUID() }, b.token))).message;
  assert.equal(second.turnIndex, 2);
  const next = (await h.inbox(a)).items.find(row => row.payload?.message?.id === second.id);
  const cooling = await h.post(`/inbox/${next.id}/claim`, {}, a.token); assert.equal(cooling.status, 429); assert.equal(cooling.headers.get('Retry-After'), '30');
  h.advance(30000); const thirdLease = await h.claim(a, next.id), third = (await h.data(await h.post(`/inbox/${next.id}/reply`, { leaseToken: thirdLease.leaseToken, text: 'third', submissionId: crypto.randomUUID() }, a.token))).message;
  assert.equal(third.turnIndex, 3);
  const last = (await h.inbox(b)).items.find(row => row.payload?.message?.id === third.id);
  assert.equal((await h.post(`/inbox/${last.id}/claim`, {}, b.token)).status, 409);
  assert.equal((await h.post('/messages', { text: 'omit parent does not reset the cap', recipientId: b.id }, a.token)).status, 409);
  const fresh = await h.send(human, a), newItem = (await h.inbox(a)).items.find(row => row.payload?.message?.id === fresh.id);
  assert.notEqual(fresh.conversationId, third.conversationId); const freshLease = await h.claim(a, newItem.id);
  assert.ok(freshLease.leaseToken);
});

test('opt-out and review revocation immediately disable leased work; wrong-owner and unsolicited claims stay private', async t => {
  const h = harness(t), sender = await h.member('human'), receiver = await h.member(), other = await h.member(); await h.prefs(receiver);
  await h.send(sender, receiver); const item = (await h.inbox(receiver)).items.find(row => row.type === 'message'), lease = await h.claim(receiver, item.id);
  await h.prefs(receiver, preferences({ autoReply: false }));
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'after opt out', submissionId: crypto.randomUUID() }, receiver.token)).status, 409);
  await h.prefs(receiver); const current = await h.claim(receiver, item.id);
  assert.equal((await h.post(`/inbox/${item.id}/ack`, { leaseToken: current.leaseToken, submissionId: crypto.randomUUID() }, other.token)).status, 404);
  const review = await h.call(`/admin/applications/${receiver.id}`, { method: 'POST', body: { decision: 'revoked' }, admin: true }); assert.equal(review.status, 200);
  assert.equal((await h.call('/inbox', { bearer: receiver.token })).status, 403);
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { leaseToken: current.leaseToken, text: 'after revoke', submissionId: crypto.randomUUID() }, receiver.token)).status, 403);
  assert.equal(h.sql.exec('SELECT lease_hash FROM office_inbox WHERE id=?', item.id).one().lease_hash, null);
  const restored = await h.call(`/admin/applications/${receiver.id}`, { method: 'POST', body: { decision: 'approved' }, admin: true }); assert.equal(restored.status, 200);
  assert.equal((await h.post(`/inbox/${item.id}/ack`, { leaseToken: current.leaseToken, submissionId: crypto.randomUUID() }, receiver.token)).status, 409);
});

test('inbox activity invitations retain their typed public payload and acknowledge without publishing speech', async t => {
  const h = harness(t), agent = await h.member(); await h.prefs(agent, preferences({ autoActivities: true }));
  h.at(getOfficeEvent(h.now()).startsAt + 1);
  let inbox = await h.inbox(agent), item = inbox.items.find(row => row.type === 'activity-invitation'); assert.ok(item); assert.ok(item.payload.eventId); assert.ok(item.payload.event); assert.equal(item.senderId, null); assert.match(item.id, /^[a-f0-9-]{36}$/); assert.ok(inbox.activities.myMatches);
  const lease = await h.claim(agent, item.id);
  assert.equal((await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'Do not invent activity speech', submissionId: crypto.randomUUID() }, agent.token)).status, 400);
  const body = { leaseToken: lease.leaseToken, submissionId: crypto.randomUUID() }, ack = await h.data(await h.post(`/inbox/${item.id}/ack`, body, agent.token)); assert.equal(ack.item.state, 'handled');
  h.reopen(); assert.equal((await h.data(await h.post(`/inbox/${item.id}/ack`, body, agent.token))).duplicate, true);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 0);
  inbox = await h.inbox(agent); assert.equal(inbox.items.filter(row => row.type === 'activity-invitation').length, 1);
});

test('simulated NPC invitation can receive a real reply without forging an NPC message or heartbeat', async t => {
  const h = harness(t), agent = await h.member(); await h.prefs(agent);
  const encounter = { id: 'test-encounter', simulated: true, floor: 1, participants: [{ id: 'jack', name: 'Jack', kind: 'character' }, { id: agent.id, name: agent.name, kind: 'agent' }], speakerId: 'jack', recipientId: agent.id, prompt: 'A fictional greeting, untrusted input.', startsAt: new Date(h.now()).toISOString(), endsAt: new Date(h.now() + 45000).toISOString() };
  assert.ok(CHARACTER_IDS.includes('jack')); h.office().social.sync(agent.id, [encounter]); h.office().social.sync(agent.id, [encounter]);
  const item = (await h.inbox(agent)).items.find(row => row.type === 'encounter'); assert.ok(item); assert.equal(item.payload.encounter.simulated, true);
  const lease = await h.claim(agent, item.id), result = await h.data(await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'I am testing the actual inbox.', submissionId: crypto.randomUUID() }, agent.token));
  assert.equal(result.message.memberId, agent.id); assert.equal(result.message.recipientId, 'jack'); assert.equal(result.message.replyToId, null); assert.equal(result.message.automated, true);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 1); assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', agent.id).one().last_seen_at, null);
});

test('bounded inbox and dedupe survive restart, expire leases, and never replay a pruned source immediately', async t => {
  const h = harness(t), agent = await h.member();
  for (let index = 0; index < 220; index++) h.office().social.deliverActivity(agent.id, { id: 'fixture-' + index, type: 'activity-invitation', senderId: null, payload: { eventId: 'fixture-' + index }, expiresAt: h.now() + 100000 });
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_inbox WHERE member_id=?', agent.id).one().n, 200);
  assert.equal((await h.inbox(agent)).items.length, 50); h.reopen();
  assert.equal(h.office().social.deliverActivity(agent.id, { id: 'fixture-0', type: 'activity-invitation', payload: {}, expiresAt: h.now() + 100000 }), null);
  h.advance(100000); assert.equal((await h.inbox(agent)).items.filter(row => row.payload.eventId?.startsWith('fixture-')).length, 0);
});

test('additive social schema preserves old identities, approval, messages and heartbeat; recent legacy directs are claimable', async t => {
  const dbId = crypto.randomUUID(), senderId = crypto.randomUUID(), messageId = crypto.randomUUID(), legacyToken = randomBytes(32).toString('hex'), senderToken = randomBytes(32).toString('hex'), hash = await tokenHash(legacyToken), senderHash = await tokenHash(senderToken), timestamp = '2026-11-01T00:00:00.000Z', lastSeen = Date.parse(timestamp) - 10000;
  const h = harness(t, sql => {
    sql.exec("CREATE TABLE office_members (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,intro TEXT NOT NULL,contact TEXT NOT NULL,admission_status TEXT NOT NULL,zone TEXT NOT NULL DEFAULT 'studio',presence_status TEXT NOT NULL DEFAULT 'idle',activity TEXT NOT NULL DEFAULT '',last_seen_at INTEGER,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);CREATE TABLE office_messages(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,text TEXT NOT NULL,recipient_id TEXT,created_at TEXT NOT NULL);");
    for (const [id, value, kind] of [[dbId, hash, 'agent'], [senderId, senderHash, 'human']]) sql.exec('INSERT INTO office_members(id,token_hash,kind,name,role,intro,contact,admission_status,last_seen_at,approved_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)', id, value, kind, 'legacy', 'role', 'intro', 'PRIVATE-LEGACY', 'approved', lastSeen, timestamp, timestamp, timestamp);
    sql.exec('INSERT INTO office_messages(id,member_id,text,recipient_id,created_at) VALUES(?,?,?,?,?)', messageId, senderId, 'Legacy direct message', dbId, timestamp);
  });
  const owner = { id: dbId, token: legacyToken }; assert.deepEqual((await h.inbox(owner)).socialPreferences, { autoReply: false, autoActivities: false, maxTurns: 4, cooldownSeconds: 60 });
  await h.prefs(owner); h.reopen(); const row = h.sql.exec('SELECT * FROM office_members WHERE id=?', dbId).one(); assert.equal(row.token_hash, hash); assert.equal(row.last_seen_at, lastSeen); assert.equal(row.approved_at, timestamp); assert.equal(row.created_at, timestamp); assert.equal(row.updated_at, timestamp);
  const item = (await h.inbox(owner)).items.find(row => row.payload?.message?.id === messageId); assert.ok(item); const lease = await h.claim(owner, item.id); assert.ok(lease.leaseToken);
  const result = await h.data(await h.post(`/inbox/${item.id}/reply`, { leaseToken: lease.leaseToken, text: 'Compatibility reply', submissionId: crypto.randomUUID() }, legacyToken)); assert.equal(result.message.replyToId, messageId);
  const retained = h.sql.exec('SELECT * FROM office_messages WHERE id=?', messageId).one(); assert.equal(retained.created_at, timestamp); assert.equal(retained.conversation_id, null); assert.equal(retained.text, 'Legacy direct message');
});


test('a failed rate-limited reply rolls back message, turn and inbox changes, then can retry the original lease', async t => {
  const h = harness(t), sender = await h.member('human'), receiver = await h.member(); await h.prefs(receiver);
  const original = await h.send(sender, receiver), item = (await h.inbox(receiver)).items.find(row => row.type === 'message'), lease = await h.claim(receiver, item.id);
  for (let index = 0; index < 10; index++) await h.data(await h.post('/messages', { text: 'Manual broadcast ' + index }, receiver.token), 201);
  const body = { leaseToken: lease.leaseToken, text: 'This reply must be atomic.', submissionId: crypto.randomUUID() };
  const limited = await h.post(`/inbox/${item.id}/reply`, body, receiver.token); assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(h.sql.exec('SELECT turns FROM office_social_conversations WHERE id=?', original.conversationId).one().turns, 0);
  assert.equal(h.sql.exec('SELECT state FROM office_inbox WHERE id=?', item.id).one().state, 'leased');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 11);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_receipts WHERE submission_id=?', body.submissionId).one().n, 0);
  h.advance(60000); const sent = await h.data(await h.post(`/inbox/${item.id}/reply`, body, receiver.token)); assert.equal(sent.message.turnIndex, 1); assert.equal(sent.item.state, 'handled');
});


test('expired conversations remove inbox references and turns without reviving loops from retained message history', async t => {
  const h = harness(t), human = await h.member('human'), agent = await h.member(); await h.prefs(agent);
  const original = await h.send(human, agent), item = (await h.inbox(agent)).items.find(row => row.type === 'message'), lease = await h.claim(agent, item.id);
  const body = { leaseToken: lease.leaseToken, text: 'A bounded real response.', submissionId: crypto.randomUUID() };
  await h.data(await h.post(`/inbox/${item.id}/reply`, body, agent.token));
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_turns').one().n, 1);
  // A reply's delivery may outlive the root clock slightly, but the thread still ends at its original expiry.
  h.advance(OFFICE_SOCIAL_LIMITS.messageTtlMs + 1); h.reopen(); await h.inbox(agent);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_conversations').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_turns').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_inbox WHERE conversation_id=?', original.conversationId).one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 2, 'public message history is preserved');
  assert.equal((await h.post('/messages', { text: 'Cannot resurrect this old parent', replyToId: original.id }, agent.token)).status, 409);
  await h.inbox(human); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_conversations').one().n, 0, 'backfill never recreates a pruned conversationId');
  assert.equal((await h.data(await h.post(`/inbox/${item.id}/reply`, body, agent.token))).duplicate, true, 'a retained receipt is independent of pruned conversation data');
});

test('receipts retain only a small public result for seven days, then expired inbox replies cannot publish again', async t => {
  const h = harness(t), agent = await h.member(); await h.prefs(agent, preferences({ autoActivities: true }));
  const id = h.office().social.deliverActivity(agent.id, { id: 'large-invitation', type: 'activity-invitation', senderId: null, payload: { publicNotice: 'LARGE-UNTRUSTED-'.repeat(600) }, expiresAt: h.now() + 60000 });
  const lease = await h.claim(agent, id), body = { leaseToken: lease.leaseToken, submissionId: crypto.randomUUID() };
  await h.data(await h.post(`/inbox/${id}/ack`, body, agent.token));
  const persisted = h.sql.exec('SELECT result_json FROM office_social_receipts WHERE member_id=? AND submission_id=?', agent.id, body.submissionId).one().result_json;
  assert.ok(persisted.length < 1000); assert.ok(!persisted.includes('LARGE-UNTRUSTED')); assert.ok(!persisted.includes(lease.leaseToken)); assert.equal(JSON.parse(persisted).item.state, 'handled');
  h.advance(OFFICE_SOCIAL_LIMITS.receiptTtlMs + 1); h.reopen(); await h.inbox(agent);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_receipts').one().n, 0);
  assert.equal((await h.post(`/inbox/${id}/ack`, body, agent.token)).status, 404); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 0);
});

test('global active conversation capacity fails closed and expired capacity is safely reclaimed', async t => {
  const h = harness(t), human = await h.member('human');
  for (let index = 0; index < OFFICE_SOCIAL_LIMITS.conversationsGlobal; index++) h.sql.exec('INSERT INTO office_social_conversations(id,pair_key,created_at,expires_at) VALUES(?,?,?,?)', 'capacity-' + index, 'fixture', h.now(), h.now() + 60000);
  const blocked = await h.post('/messages', { text: 'Cannot create an unbounded new thread' }, human.token); assert.equal(blocked.status, 503); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_messages').one().n, 0);
  h.advance(60000); await h.data(await h.post('/messages', { text: 'Expired capacity has been reclaimed' }, human.token), 201); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_social_conversations').one().n, 1);
});
