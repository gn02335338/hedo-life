import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { OfficeStore, OFFICE_PRESENCE_MS } from '../worker/office.js';
import { AdminPrivateStore } from '../worker/admin-private.js';
import * as http from '../worker/http.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';

const password = 'synthetic-office-review-password';
function verifier() { const salt = randomBytes(16); return JSON.stringify({ v: 1, iterations: 100000, salt: salt.toString('hex'), hash: pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex') }); }
const token = () => randomBytes(32).toString('hex');
const input = (value = token(), extra = {}) => ({ token: value, kind: 'human', name: '測試同事', role: '設計', intro: '一起做可以交付的工作。', contact: 'private@example.test', ...extra });
function harness(t, { configured = true, throughWorker = false, setup = () => {} } = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); let currentTime = Date.now();
  const sql = { exec(query, ...values) {
    let rows = [];
    if (!values.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...values); else statement.run(...values); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  setup(sql);
  const env = configured ? { ADMIN_PASSWORD_VERIFIER: verifier() } : {};
  const create = () => new OfficeStore(sql, storage, env, { now: () => currentTime }); let office = throughWorker ? null : create();
  let archive, createArchive;
  if (throughWorker) {
    const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
    const scope = vm.createContext({ DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, OfficeStore, AdminPrivateStore, ...http,
      replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, crypto, Response, Request, URL, Date });
    vm.runInContext(source, scope);
    createArchive = () => new scope.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, env);
    archive = createArchive();
  }
  const call = (path, { method = 'GET', body, bearer, cookie, csrf, origin = 'https://office.example', site, ip = '192.0.2.8', intent = false } = {}) => {
    const headers = { 'CF-Connecting-IP': ip };
    if (body !== undefined) headers['Content-Type'] = 'application/json'; if (bearer) headers.Authorization = 'Bearer ' + bearer;
    if (cookie) headers.Cookie = cookie; if (csrf) headers['X-CSRF-Token'] = csrf; if (origin !== null) headers.Origin = origin; if (site) headers['Sec-Fetch-Site'] = site;
    if (intent) headers['X-Admin-Intent'] = 'private-archive';
    const request = new Request('https://office.example' + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return throughWorker ? archive.fetch(request) : office.fetch(request);
  };
  const login = async () => {
    const response = throughWorker
      ? await call('/api/admin/login', { method: 'POST', body: { password }, intent: true })
      : await office.admin.fetch(new Request('https://office.example/api/admin/login', { method: 'POST', headers: { Origin: 'https://office.example', 'Content-Type': 'application/json', 'X-Admin-Intent': 'private-archive' }, body: JSON.stringify({ password }) }));
    assert.equal(response.status, 200); return { cookie: response.headers.get('Set-Cookie').split(';')[0], csrf: (await response.json()).csrfToken };
  };
  const apply = async body => { const response = await call('/api/office/apply', { method: 'POST', body }); assert.equal(response.status, 202); return (await response.json()).application; };
  const review = (id, decision, auth) => call('/api/office/admin/applications/' + id, { method: 'POST', body: { decision }, ...auth });
  const approve = async (body, auth) => { const applicant = await apply(body); assert.equal((await review(applicant.id, 'approved', auth || await login())).status, 200); return applicant; };
  return { sql, env, call, login, apply, approve, review, reopen() { if (throughWorker) archive = createArchive(); else office = create(); }, advance(ms) { currentTime += ms; } };
}

test('office routes integrate lazily in the real Worker, remain independent from the anonymous game archive, and fail closed without review config', async t => {
  const h = harness(t, { configured: false, throughWorker: true });
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name LIKE 'office_%'").one().n, 0);
  const snapshot = await h.call('/api/office'); assert.equal(snapshot.status, 200); assert.equal((await snapshot.json()).admissionOpen, false);
  const failed = await h.call('/api/office/apply', { method: 'POST', body: input() }); assert.equal(failed.status, 503);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_members').one().n, 0);
  const gameToken = token(); assert.equal((await h.call('/api/player', { method: 'POST', body: { token: gameToken } })).status, 200);
  assert.equal((await h.call('/api/office/me', { bearer: gameToken })).status, 401);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM players').one().n, 1);
});

test('real Worker routing shares the administrator session across office approval, external agent work, restart and revocation', async t => {
  const h = harness(t, { throughWorker: true }), body = input(token(), { kind: 'agent', name: 'Route-tested agent' });
  const applicant = await h.apply(body), auth = await h.login();
  assert.equal((await h.call('/api/admin/session', auth)).status, 200);
  const reviews = await h.call('/api/office/admin/applications', auth);
  assert.equal(reviews.status, 200); assert.equal((await reviews.json()).applications[0].contact, body.contact);
  assert.equal((await h.review(applicant.id, 'approved', auth)).status, 200);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: body.token, origin: null, body: { zone: 'studio', status: 'working', activity: 'Verifying the actual route' } })).status, 200);
  const created = await h.call('/api/office/tasks', { method: 'POST', bearer: body.token, origin: null, body: { title: 'Complete the routed task' } });
  assert.equal(created.status, 201); const task = (await created.json()).task;
  assert.equal((await h.call(`/api/office/tasks/${task.id}/claim`, { method: 'POST', bearer: body.token, origin: null, body: {} })).status, 200);
  h.reopen();
  assert.equal((await h.call('/api/admin/session', auth)).status, 200);
  const snapshot = await (await h.call('/api/office')).json();
  assert.equal(snapshot.members[0].id, applicant.id); assert.equal(snapshot.tasks[0].assigneeId, applicant.id);
  assert.equal(JSON.stringify(snapshot).includes(body.contact), false); assert.equal(JSON.stringify(snapshot).includes(body.token), false);
  assert.equal((await h.review(applicant.id, 'revoked', auth)).status, 200);
  assert.equal((await h.call(`/api/office/tasks/${task.id}/complete`, { method: 'POST', bearer: body.token, origin: null, body: { result: 'No longer authorized' } })).status, 403);
  assert.equal((await h.call('/api/me', { bearer: body.token })).status, 401, 'an office credential is not an anonymous player credential');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM players').one().n, 0);
});

test('applications persist, retry idempotently, store only token hashes, and are isolated from other applicants and the public', async t => {
  const h = harness(t), body = input(), applicant = await h.apply(body);
  assert.equal(applicant.status, 'pending'); assert.equal((await h.call('/api/office/apply', { method: 'POST', body })).status, 200);
  assert.equal((await h.call('/api/office/apply', { method: 'POST', body: { ...body, name: '換名' } })).status, 409);
  h.reopen(); assert.equal((await (await h.call('/api/office/me', { bearer: body.token })).json()).application.id, applicant.id);
  const other = input(token(), { name: '其他同事', contact: 'different@example.test' }); await h.apply(other);
  const mine = await (await h.call('/api/office/me', { bearer: other.token })).text(); assert.ok(!mine.includes(applicant.id)); assert.ok(!mine.includes(body.contact));
  const snapshot = await (await h.call('/api/office')).text(); assert.ok(!snapshot.includes(applicant.name)); assert.ok(!snapshot.includes(body.contact)); assert.ok(!snapshot.includes(body.token));
  const persisted = JSON.stringify(h.sql.exec('SELECT * FROM office_members').toArray()); assert.ok(!persisted.includes(body.token)); assert.ok(!persisted.includes(other.token));
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_members').one().n, 2);
});

test('pending and rejected members cannot self-approve, impersonate someone else, send messages or mutate work', async t => {
  const h = harness(t), body = input(), applicant = await h.apply(body);
  for (const [path, payload] of [['presence', { zone: 'studio', status: 'working' }], ['messages', { text: 'hello' }], ['tasks', { title: 'Task' }]]) {
    assert.equal((await h.call('/api/office/' + path, { method: 'POST', body: payload, bearer: body.token })).status, 403);
  }
  assert.equal((await h.call('/api/office/apply', { method: 'POST', body: { ...input(), status: 'approved', id: applicant.id } })).status, 400);
  assert.equal((await h.call('/api/office/admin/applications')).status, 401);
  assert.equal((await h.review(applicant.id, 'approved', {})).status, 401);
  const auth = await h.login(); assert.equal((await h.review(applicant.id, 'rejected', auth)).status, 200);
  assert.equal((await h.call('/api/office/messages', { method: 'POST', body: { text: 'hello' }, bearer: body.token })).status, 403);
});

test('review list and decisions reuse authenticated private session and require CSRF plus exact same-origin writes', async t => {
  const h = harness(t), body = input(), applicant = await h.apply(body), auth = await h.login();
  const list = await h.call('/api/office/admin/applications', auth); assert.equal(list.status, 200); assert.equal((await list.json()).applications[0].contact, body.contact);
  for (const options of [{ cookie: auth.cookie }, { ...auth, csrf: 'a'.repeat(64) }, { ...auth, origin: null }, { ...auth, origin: 'https://foreign.example' }, { ...auth, site: 'cross-site' }]) {
    assert.equal((await h.review(applicant.id, 'approved', options)).status, 403);
  }
  assert.equal((await h.review(applicant.id, 'approved', auth)).status, 200);
  const publicResponse = await h.call('/api/office'), text = await publicResponse.text(); assert.ok(text.includes(body.name)); assert.ok(!text.includes(body.contact)); assert.ok(!text.includes(body.token));
  assert.match(publicResponse.headers.get('Cache-Control'), /no-store/); assert.equal(publicResponse.headers.get('Access-Control-Allow-Origin'), null);
});

test('approved humans and server-side agents share real presence with expiry and persisted messages, while cross-origin browser writes are rejected', async t => {
  const h = harness(t), body = input(token(), { kind: 'agent', name: 'Agent' }); await h.approve(body);
  const presence = { zone: 'focus', status: 'working', activity: '整理文件' };
  assert.equal((await h.call('/api/office/presence', { method: 'POST', body: presence, bearer: body.token, origin: null })).status, 200);
  assert.equal((await h.call('/api/office/messages', { method: 'POST', body: { text: '<script>literal text</script>' }, bearer: body.token, origin: 'https://foreign.example' })).status, 403);
  assert.equal((await h.call('/api/office/messages', { method: 'POST', body: { text: '完成初步整理。' }, bearer: body.token, origin: null })).status, 201);
  h.reopen(); const online = await (await h.call('/api/office')).json(); assert.equal(online.members[0].online, true); assert.equal(online.members[0].zone, 'focus'); assert.equal(online.messages.length, 1);
  h.advance(OFFICE_PRESENCE_MS); const offline = await (await h.call('/api/office')).json(); assert.equal(offline.members[0].online, false); assert.equal(offline.members[0].activity, '整理文件');
});

test('work ownership, conflict checks, completion and retries are authoritative and persistent', async t => {
  const h = harness(t), auth = await h.login(), a = input(), b = input(token(), { kind: 'agent', name: 'Worker B', departmentFloor: 4 }); await h.approve(a, auth); await h.approve(b, auth);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', body: { floor: 2, zone: 'lounge', status: 'break' }, bearer: b.token })).status, 200);
  const created = await h.call('/api/office/tasks', { method: 'POST', body: { title: '整理公開資料', description: '產出摘要' }, bearer: a.token }); assert.equal(created.status, 201); const task = (await created.json()).task;
  const claim = who => h.call(`/api/office/tasks/${task.id}/claim`, { method: 'POST', body: {}, bearer: who });
  assert.equal((await claim(b.token)).status, 200);
  const claimedPresence = (await (await h.call('/api/office/me', { bearer: b.token })).json()).application;
  assert.equal(claimedPresence.floor, 4); assert.equal(claimedPresence.departmentFloor, 4);
  assert.equal(claimedPresence.zone, 'studio'); assert.equal(claimedPresence.presenceStatus, 'working'); assert.equal(claimedPresence.activity, '正在處理：整理公開資料');
  h.advance(1000); assert.equal((await claim(b.token)).status, 200);
  assert.deepEqual((await (await h.call('/api/office/me', { bearer: b.token })).json()).application, claimedPresence);
  assert.equal((await claim(a.token)).status, 409);
  assert.equal((await h.call(`/api/office/tasks/${task.id}/complete`, { method: 'POST', body: { result: '假冒完成' }, bearer: a.token })).status, 403);
  const completed = () => h.call(`/api/office/tasks/${task.id}/complete`, { method: 'POST', body: { result: '公開摘要已整理' }, bearer: b.token });
  assert.equal((await completed()).status, 200);
  const deliveredPresence = (await (await h.call('/api/office/me', { bearer: b.token })).json()).application;
  assert.equal(deliveredPresence.floor, 7); assert.equal(deliveredPresence.departmentFloor, 4);
  assert.equal(deliveredPresence.zone, 'focus'); assert.equal(deliveredPresence.presenceStatus, 'idle'); assert.equal(deliveredPresence.activity, '已交付：整理公開資料');
  h.advance(1000); assert.equal((await completed()).status, 200);
  assert.deepEqual((await (await h.call('/api/office/me', { bearer: b.token })).json()).application, deliveredPresence);
  h.reopen(); const snapshot = await (await h.call('/api/office')).json(); assert.equal(snapshot.tasks[0].status, 'completed'); assert.equal(snapshot.tasks[0].result, '公開摘要已整理');
  assert.equal(snapshot.activity.filter(event => event.type === 'task-completed').length, 1);
});

test('revocation immediately removes presence and messages, blocks every member mutation, and releases claimed work', async t => {
  const h = harness(t), auth = await h.login(), a = input(), b = input(token(), { name: 'Revoked coworker' }); await h.approve(a, auth); const applicant = await h.approve(b, auth);
  await h.call('/api/office/presence', { method: 'POST', bearer: b.token, body: { zone: 'studio', status: 'working' } });
  await h.call('/api/office/messages', { method: 'POST', bearer: b.token, body: { text: 'Member message' } });
  const task = (await (await h.call('/api/office/tasks', { method: 'POST', bearer: a.token, body: { title: 'Shared task' } })).json()).task;
  await h.call(`/api/office/tasks/${task.id}/claim`, { method: 'POST', bearer: b.token, body: {} });
  assert.equal((await h.review(applicant.id, 'revoked', auth)).status, 200);
  for (const [path, body] of [['presence', { zone: 'studio', status: 'working' }], ['messages', { text: 'No access' }], ['tasks', { title: 'No access' }], [`tasks/${task.id}/claim`, {}], [`tasks/${task.id}/complete`, {}]]) {
    assert.equal((await h.call('/api/office/' + path, { method: 'POST', body, bearer: b.token })).status, 403);
  }
  h.reopen(); const snapshot = await (await h.call('/api/office')).json(); assert.ok(!snapshot.members.some(row => row.id === applicant.id)); assert.equal(snapshot.messages.length, 0); assert.equal(snapshot.tasks[0].status, 'open'); assert.equal(snapshot.tasks[0].assigneeId, null);
  assert.equal((await (await h.call('/api/office/me', { bearer: b.token })).json()).application.status, 'revoked');
});

test('persistent limits survive restarts and malformed/oversized fields cannot add privileged or impersonated data', async t => {
  const h = harness(t), auth = await h.login(), body = input(); await h.approve(body, auth);
  for (const payload of [{ name: 'x'.repeat(41) }, { kind: 'npc' }, { contact: 5 }, { role: '' }, { intro: 'bad\u0000text' }]) assert.equal((await h.call('/api/office/apply', { method: 'POST', body: { ...input(), ...payload } })).status, 400);
  for (const [path, payload] of [['presence', { zone: 'boss', status: 'working' }], ['presence', { zone: 'studio', status: 'working', memberId: 'fake' }], ['messages', { text: 'x'.repeat(501) }], ['tasks', { title: 'Task', status: 'completed' }]]) assert.equal((await h.call('/api/office/' + path, { method: 'POST', body: payload, bearer: body.token })).status, 400);
  for (let i = 0; i < 10; i++) assert.equal((await h.call('/api/office/messages', { method: 'POST', body: { text: String(i) }, bearer: body.token })).status, 201);
  h.reopen(); const limited = await h.call('/api/office/messages', { method: 'POST', body: { text: 'limited' }, bearer: body.token });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('Retry-After'), '60');
  h.advance(60000); assert.equal((await h.call('/api/office/messages', { method: 'POST', body: { text: 'available again' }, bearer: body.token })).status, 201);
  for (let i = 0; i < 4; i++) await h.apply(input());
  h.reopen(); assert.equal((await h.call('/api/office/apply', { method: 'POST', body: input() })).status, 429);
});

test('revoked authors cannot consume visible board capacity and recent completions never hide unfinished work', async t => {
  const h = harness(t), auth = await h.login(), a = input(), b = input(token(), { name: 'Former author' }); const creator = await h.approve(a, auth), former = await h.approve(b, auth);
  const now = new Date().toISOString(), oldest = crypto.randomUUID();
  h.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,created_at,updated_at) VALUES (?,'Unfinished work','','open',?,?,?)", oldest, creator.id, now, now);
  for (let i = 0; i < 100; i++) h.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,created_at,updated_at) VALUES (?,'Unavailable author task','','open',?,?,?)", crypto.randomUUID(), former.id, now, now);
  for (let i = 0; i < 180; i++) h.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,assignee_id,created_at,updated_at) VALUES (?,'Completed work','','completed',?,?,?,?)", crypto.randomUUID(), creator.id, creator.id, now, now);
  assert.equal((await h.review(former.id, 'revoked', auth)).status, 200);
  assert.equal((await h.call('/api/office/tasks', { method: 'POST', body: { title: 'New visible work' }, bearer: a.token })).status, 201);
  const snapshot = await (await h.call('/api/office')).json(); assert.equal(snapshot.tasks.length, 150); assert.ok(snapshot.tasks.some(row => row.id === oldest)); assert.equal(snapshot.tasks.filter(row => row.status !== 'completed').length, 2);
  assert.equal((await h.call(`/api/office/tasks/${oldest}/claim`, { method: 'POST', body: {}, bearer: a.token })).status, 200);
});

test('reapproval atomically respects unfinished board capacity without deleting existing work or repeating approval events', async t => {
  const h = harness(t), auth = await h.login(), a = input(), b = input(token(), { name: 'Returning author' });
  const current = await h.approve(a, auth), returning = await h.approve(b, auth), now = new Date().toISOString();
  for (let i = 0; i < 100; i++) h.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,created_at,updated_at) VALUES (?,'Returning work','','open',?,?,?)", crypto.randomUUID(), returning.id, now, now);
  assert.equal((await h.review(returning.id, 'revoked', auth)).status, 200);
  for (let i = 0; i < 100; i++) h.sql.exec("INSERT INTO office_tasks (id,title,description,status,created_by,created_at,updated_at) VALUES (?,'Current work','','open',?,?,?)", crypto.randomUUID(), current.id, now, now);
  const blocked = await h.review(returning.id, 'approved', auth); assert.equal(blocked.status, 409); assert.equal((await blocked.json()).error, 'office_task_limit');
  assert.equal((await (await h.call('/api/office/me', { bearer: b.token })).json()).application.status, 'revoked');
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_tasks').one().n, 200);
  assert.equal((await (await h.call('/api/office')).json()).tasks.filter(row => row.status !== 'completed').length, 100);
  h.sql.exec("UPDATE office_tasks SET status='completed',assignee_id=?,result='Completed before restoration' WHERE created_by=?", current.id, current.id);
  assert.equal((await h.review(returning.id, 'approved', auth)).status, 200);
  const before = (await (await h.call('/api/office/me', { bearer: b.token })).json()).application;
  const events = h.sql.exec("SELECT COUNT(*) AS n FROM office_activity WHERE member_id=? AND type='joined'", returning.id).one().n;
  h.advance(1000); assert.equal((await h.review(returning.id, 'approved', auth)).status, 200);
  assert.deepEqual((await (await h.call('/api/office/me', { bearer: b.token })).json()).application, before);
  assert.equal(h.sql.exec("SELECT COUNT(*) AS n FROM office_activity WHERE member_id=? AND type='joined'", returning.id).one().n, events);
  h.reopen(); const restored = await (await h.call('/api/office')).json(); assert.equal(restored.tasks.filter(row => row.status !== 'completed').length, 100);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_tasks').one().n, 200);
});

test('department admission supports all seven numeric floors, defaults legacy clients to one and rejects forged floor fields', async t => {
  const h = harness(t), legacy = input(), application = await h.apply(legacy);
  assert.equal(application.departmentFloor, 1); assert.equal(application.floor, 1);
  assert.equal((await h.call('/api/office/apply', { method: 'POST', body: legacy })).status, 200);
  for (let floor = 1; floor <= 7; floor++) {
    const body = input(token(), { departmentFloor: floor }), created = await h.call('/api/office/apply', { method: 'POST', body, ip: '192.0.2.' + (floor + 30) });
    assert.equal(created.status, 202); const row = (await created.json()).application;
    assert.equal(row.departmentFloor, floor); assert.equal(row.floor, floor);
    assert.equal((await h.call('/api/office/apply', { method: 'POST', body })).status, 200);
    if (floor !== 1) assert.equal((await h.call('/api/office/apply', { method: 'POST', body: { ...body, departmentFloor: undefined } })).status, 409);
  }
  for (const floor of [0, 8, -1, 1.5, '2', null, true, {}, []]) {
    const rejected = await h.call('/api/office/apply', { method: 'POST', body: input(token(), { departmentFloor: floor }) }); assert.equal(rejected.status, 400);
  }
  assert.equal((await h.call('/api/office/apply', { method: 'POST', body: input(token(), { floor: 7 }) })).status, 400);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: legacy.token, body: { floor: 7, zone: 'focus', status: 'working' } })).status, 403);
  assert.equal((await (await h.call('/api/office/me', { bearer: legacy.token })).json()).application.floor, 1);
});

test('approved floor movement survives restart, omission preserves current floor, and revocation prevents further movement', async t => {
  const h = harness(t), auth = await h.login(), body = input(token(), { departmentFloor: 5 }); const applicant = await h.approve(body, auth);
  for (const floor of [0, 8, -1, 1.5, '2', null, true, {}, []]) assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: body.token, body: { floor, zone: 'studio', status: 'working' } })).status, 400);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: body.token, body: { departmentFloor: 2, zone: 'studio', status: 'working' } })).status, 400);
  for (let floor = 1; floor <= 7; floor++) {
    const moved = await h.call('/api/office/presence', { method: 'POST', bearer: body.token, body: { floor, zone: 'meeting', status: 'working', activity: '跨樓層協作' } });
    assert.equal(moved.status, 200); const member = (await moved.json()).member; assert.equal(member.floor, floor); assert.equal(member.departmentFloor, 5);
  }
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: body.token, body: { zone: 'lounge', status: 'break' } })).status, 200);
  h.reopen(); const own = (await (await h.call('/api/office/me', { bearer: body.token })).json()).application;
  assert.equal(own.floor, 7); assert.equal(own.departmentFloor, 5);
  const member = (await (await h.call('/api/office')).json()).members[0]; assert.equal(member.floor, 7); assert.equal(member.departmentFloor, 5); assert.equal(member.zone, 'lounge');
  assert.equal((await h.review(applicant.id, 'revoked', auth)).status, 200);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: body.token, body: { floor: 2, zone: 'studio', status: 'working' } })).status, 403);
  assert.equal((await (await h.call('/api/office/me', { bearer: body.token })).json()).application.floor, 7);
});

test('additive floor initialization preserves legacy credentials, admission, timestamps and retained work across repeated restarts', async t => {
  const legacyToken = token(), hash = await http.tokenHash(legacyToken), id = crypto.randomUUID(), createdAt = '2026-10-30T00:00:00.000Z';
  const h = harness(t, { setup(sql) {
    sql.exec(`CREATE TABLE office_members (
      id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,intro TEXT NOT NULL,contact TEXT NOT NULL,
      admission_status TEXT NOT NULL,zone TEXT NOT NULL DEFAULT 'studio',presence_status TEXT NOT NULL DEFAULT 'idle',activity TEXT NOT NULL DEFAULT '',
      last_seen_at INTEGER,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
    );`);
    sql.exec("INSERT INTO office_members (id,token_hash,kind,name,role,intro,contact,admission_status,zone,presence_status,activity,approved_at,created_at,updated_at) VALUES (?,?,'agent','Legacy agent','研究','Before seven floors','private-legacy@example.test','approved','meeting','working','Original work',?,?,?)", id, hash, createdAt, createdAt, createdAt);
  } });
  const before = h.sql.exec('SELECT * FROM office_members WHERE id=?', id).one();
  assert.equal(before.token_hash, hash); assert.equal(before.department_floor, 1); assert.equal(before.floor, 1);
  const own = (await (await h.call('/api/office/me', { bearer: legacyToken })).json()).application;
  assert.equal(own.id, id); assert.equal(own.status, 'approved'); assert.equal(own.createdAt, createdAt); assert.equal(own.updatedAt, createdAt); assert.equal(own.activity, 'Original work');
  const made = await h.call('/api/office/tasks', { method: 'POST', bearer: legacyToken, body: { title: 'Retained work after migration' } }); assert.equal(made.status, 201); const task = (await made.json()).task;
  assert.equal((await h.call('/api/office/messages', { method: 'POST', bearer: legacyToken, body: { text: 'Retained message' } })).status, 201);
  h.reopen(); h.reopen(); assert.deepEqual(h.sql.exec('SELECT * FROM office_members WHERE id=?', id).one(), before);
  const snapshot = await (await h.call('/api/office')).json(); assert.equal(snapshot.members[0].id, id); assert.equal(snapshot.tasks[0].id, task.id); assert.equal(snapshot.messages[0].text, 'Retained message');
  assert.equal(JSON.stringify(snapshot).includes('private-legacy@example.test'), false); assert.equal(JSON.stringify(snapshot).includes(legacyToken), false);
  assert.equal(h.sql.exec('PRAGMA table_info(office_members)').toArray().filter(row => ['floor', 'department_floor'].includes(row.name)).length, 2);
});

test('approved avatar updates are owner-only, persist safely, and never manufacture online presence', async t => {
  const { defaultOfficeAvatar } = await import('../dist/office/avatar-config.js');
  const h = harness(t), auth = await h.login(), a = input(token(), { kind: 'agent' }), b = input(token(), { name: 'Other avatar' }); const applicant = await h.apply(a); await h.approve(b, auth);
  const avatar = { ...defaultOfficeAvatar('agent'), preset: 'voxel', bodyColor: '#AABBCC', hairStyle: 'mohawk', accessory: 'glasses', voxels: Array.from({ length: 96 }, () => ({ x: 0, y: .5, z: 0, w: .123456, h: .3, d: .2, color: '#123456' })) };
  assert.equal((await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar } })).status, 403);
  assert.equal((await h.review(applicant.id, 'approved', auth)).status, 200);
  const saved = await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar } }); assert.equal(saved.status, 200); const member = (await saved.json()).member;
  assert.equal(member.avatar.bodyColor, '#aabbcc'); assert.equal(member.avatar.voxels.length, 96); assert.equal(member.avatar.voxels[0].w, .123); assert.equal(member.online, false);
  assert.equal((await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar, memberId: 'someone-else' } })).status, 400);
  assert.equal((await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, origin: 'https://foreign.example', body: { avatar } })).status, 403);
  assert.equal((await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar: { ...avatar, voxels: [{ ...avatar.voxels[0], x: .99 }] } } })).status, 400);
  h.reopen(); const own = (await (await h.call('/api/office/me', { bearer: a.token })).json()).application;
  assert.deepEqual(own.avatar, member.avatar); assert.deepEqual((await (await h.call('/api/office/me', { bearer: b.token })).json()).application.avatar, defaultOfficeAvatar('human'));
  const snapshot = await (await h.call('/api/office')).json(); assert.deepEqual(snapshot.members.find(row => row.id === applicant.id).avatar, member.avatar);
  await h.call('/api/office/presence', { method: 'POST', bearer: a.token, body: { floor: 3, zone: 'meeting', status: 'break', activity: 'Real presence' } });
  const before = (await (await h.call('/api/office')).json()).members.find(row => row.id === applicant.id); h.advance(120000);
  const changed = await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar: defaultOfficeAvatar('agent') } }); const after = (await changed.json()).member;
  assert.equal(after.lastSeenAt, before.lastSeenAt); assert.equal(after.online, false); assert.equal(after.status, 'break'); assert.equal(after.floor, 3);
  await h.review(applicant.id, 'revoked', auth); assert.equal((await h.call('/api/office/avatar', { method: 'POST', bearer: a.token, body: { avatar } })).status, 403);
});

test('targeted messages accept public characters and approved members, stay public, and hide private admission information', async t => {
  const { CHARACTER_IDS } = await import('../dist/character-stats.js');
  const h = harness(t), auth = await h.login(), a = input(), b = input(token(), { name: 'Receiver' }), pending = input(token(), { name: 'Private pending', contact: 'pending-private@example.test' });
  await h.approve(a, auth); const receiver = await h.approve(b, auth), waiting = await h.apply(pending);
  const untargeted = await h.call('/api/office/messages', { method: 'POST', bearer: a.token, body: { text: 'Everyone' } }); assert.equal((await untargeted.json()).message.recipientId, null);
  const addressed = await h.call('/api/office/messages', { method: 'POST', bearer: a.token, body: { text: 'For receiver', recipientId: receiver.id.toUpperCase() } }); assert.equal((await addressed.json()).message.recipientId, receiver.id);
  for (const [index, recipientId] of CHARACTER_IDS.entries()) {
    if (index % 8 === 0) h.advance(60000);
    const sent = await h.call('/api/office/messages', { method: 'POST', bearer: a.token, body: { text: 'For public character ' + recipientId, recipientId } }); assert.equal(sent.status, 201); assert.equal((await sent.json()).message.recipientId, recipientId);
  }
  let firstError;
  for (const recipientId of [waiting.id, crypto.randomUUID(), 'private', 'admin', '../admin/archive', null, '', 7, {}]) {
    const failed = await h.call('/api/office/messages', { method: 'POST', bearer: a.token, body: { text: 'Not delivered', recipientId } }); assert.equal(failed.status, 400);
    const body = await failed.json(); firstError ||= body; assert.deepEqual(body, firstError);
  }
  await h.review(receiver.id, 'revoked', auth);
  const revoked = await h.call('/api/office/messages', { method: 'POST', bearer: a.token, body: { text: 'Cannot target revoked member', recipientId: receiver.id } }); assert.equal(revoked.status, 400); assert.deepEqual(await revoked.json(), firstError);
  h.reopen(); const snapshot = await (await h.call('/api/office')).json(); assert.ok(snapshot.messages.some(row => row.text === 'For receiver' && row.recipientId === receiver.id)); assert.ok(snapshot.messages.some(row => row.recipientId === 'jack'));
  assert.equal(JSON.stringify(snapshot).includes(pending.contact), false); assert.equal(JSON.stringify(snapshot).includes(waiting.id), false); assert.equal(snapshot.messages.length, CHARACTER_IDS.length + 2);
});

test('legacy message and member tables gain display columns without changing admission, identity or original message records', async t => {
  const value = token(), hash = await http.tokenHash(value), id = crypto.randomUUID(), messageId = crypto.randomUUID(), timestamp = '2026-10-31T00:00:00.000Z', lastHeartbeat = Date.now() - 30000;
  const h = harness(t, { setup(sql) {
    sql.exec(`CREATE TABLE office_members (id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,intro TEXT NOT NULL,contact TEXT NOT NULL,admission_status TEXT NOT NULL,zone TEXT NOT NULL DEFAULT 'studio',presence_status TEXT NOT NULL DEFAULT 'idle',activity TEXT NOT NULL DEFAULT '',last_seen_at INTEGER,approved_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE office_messages(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,text TEXT NOT NULL,created_at TEXT NOT NULL);`);
    sql.exec("INSERT INTO office_members(id,token_hash,kind,name,role,intro,contact,admission_status,presence_status,activity,last_seen_at,approved_at,created_at,updated_at) VALUES(?,?,'agent','Legacy','Support','Original intro','','approved','working','Original activity',?,?,?,?)", id, hash, lastHeartbeat, timestamp, timestamp, timestamp);
    sql.exec('INSERT INTO office_messages(id,member_id,text,created_at) VALUES(?,?,?,?)', messageId, id, 'Original public message', timestamp);
  } });
  h.reopen(); const own = (await (await h.call('/api/office/me', { bearer: value })).json()).application, snapshot = await (await h.call('/api/office')).json();
  assert.equal(own.id, id); assert.equal(own.status, 'approved'); assert.equal(own.avatar.preset, 'robot'); assert.equal(own.updatedAt, timestamp); assert.equal(own.approvedAt, timestamp); assert.equal(own.presenceStatus, 'working'); assert.equal(own.activity, 'Original activity');
  assert.equal(snapshot.members[0].lastSeenAt, new Date(lastHeartbeat).toISOString()); assert.equal(snapshot.members[0].online, true);
  assert.deepEqual(snapshot.messages, [{ id: messageId, memberId: id, text: 'Original public message', recipientId: null, createdAt: timestamp }]);
  assert.equal(h.sql.exec('SELECT token_hash FROM office_members WHERE id=?', id).one().token_hash, hash);
  assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', id).one().last_seen_at, lastHeartbeat);
});

test('public encounters expose only fictional invitations and approved identities without writing messages or heartbeats', async t => {
  const { getOfficeRoster } = await import('../dist/office/model.js');
  const { getOfficeEncounters, SOCIAL_CYCLE_MS } = await import('../dist/office/social.js');
  const { CHARACTER_IDS } = await import('../dist/character-stats.js');
  const h = harness(t), auth = await h.login(), agent = input(token(), { kind: 'agent', name: 'Approved encounter agent', contact: 'private-agent@example.test' });
  const applicant = await h.approve(agent, auth), pending = await h.apply(input(token(), { name: 'PRIVATE_PENDING_NAME', contact: 'pending-encounter@example.test' }));
  const firstTime = Date.parse(applicant.createdAt), cycle = Math.floor(firstTime / SOCIAL_CYCLE_MS);
  const simulatedMember = { id: applicant.id, kind: agent.kind, name: agent.name, role: agent.role, intro: agent.intro, online: true, departmentFloor: 1, floor: 1, zone: 'studio', status: 'working', activity: 'Actual agent work' };
  let moment;
  for (let turn = 0; turn < 64 && !moment; turn++) for (let delay = 0; delay <= 49000; delay += 7000) {
    const time = (cycle + turn) * SOCIAL_CYCLE_MS + 155000 + delay; if (time < firstTime) continue;
    const encounter = getOfficeEncounters(getOfficeRoster([simulatedMember], time)).find(row => row.recipientId === applicant.id && CHARACTER_IDS.includes(row.speakerId));
    if (encounter) { moment = { time, encounter }; break; }
  }
  assert.ok(moment, 'An approved agent can receive a public character invitation through the shared routine');
  h.advance(moment.time - firstTime);
  assert.equal((await h.call('/api/office/presence', { method: 'POST', bearer: agent.token, body: { floor: 1, zone: 'studio', status: 'working', activity: simulatedMember.activity } })).status, 200);
  const before = {
    members: h.sql.exec('SELECT * FROM office_members ORDER BY id').toArray(),
    messages: h.sql.exec('SELECT * FROM office_messages').toArray(),
    activity: h.sql.exec('SELECT * FROM office_activity ORDER BY rowid').toArray(),
  };
  const snapshot = await (await h.call('/api/office')).json(), invitation = snapshot.encounters.find(row => row.id === moment.encounter.id);
  assert.deepEqual(invitation, moment.encounter); assert.equal(snapshot.members[0].online, true); assert.equal(snapshot.members[0].activity, 'Actual agent work');
  const publicIds = new Set([...CHARACTER_IDS, applicant.id]);
  for (const encounter of snapshot.encounters) {
    assert.equal(encounter.simulated, true); assert.ok(encounter.prompt.length > 0); assert.ok(Date.parse(encounter.endsAt) > Date.parse(encounter.startsAt));
    for (const participant of encounter.participants) { assert.deepEqual(Object.keys(participant).sort(), ['id', 'kind', 'name']); assert.ok(publicIds.has(participant.id)); }
    if (encounter.speakerId !== null) assert.ok(CHARACTER_IDS.includes(encounter.speakerId), 'Only an authored character speaks a generated greeting');
  }
  const text = JSON.stringify(snapshot); assert.ok(!text.includes(agent.contact)); assert.ok(!text.includes(agent.token)); assert.ok(!text.includes(pending.id)); assert.ok(!text.includes('PRIVATE_PENDING_NAME'));
  assert.deepEqual(h.sql.exec('SELECT * FROM office_members ORDER BY id').toArray(), before.members);
  assert.deepEqual(h.sql.exec('SELECT * FROM office_messages').toArray(), before.messages);
  assert.deepEqual(h.sql.exec('SELECT * FROM office_activity ORDER BY rowid').toArray(), before.activity);
  const reply = await h.call('/api/office/messages', { method: 'POST', bearer: agent.token, body: { text: 'This is my actual reply.', recipientId: invitation.speakerId } }); assert.equal(reply.status, 201);
  const replied = await (await h.call('/api/office')).json(); assert.equal(replied.messages.length, 1); assert.equal(replied.messages[0].recipientId, invitation.speakerId); assert.equal(replied.messages[0].text, 'This is my actual reply.');
  assert.equal(h.sql.exec('SELECT last_seen_at FROM office_members WHERE id=?', applicant.id).one().last_seen_at, moment.time);
});
