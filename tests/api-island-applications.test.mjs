import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { IslandApplicationStore, validateIslandApplication } from '../worker/island-applications.js';
import { AdminPrivateStore } from '../worker/admin-private.js';
import { AchievementStore } from '../worker/achievements.js';
import { CharacterStore } from '../worker/characters.js';
import { ObservationStore } from '../worker/observations.js';
import { FeedbackStore } from '../worker/feedback-store.js';
import { validateFeedback, validatePublisherToken } from '../worker/feedback.js';
import * as http from '../worker/http.js';
import { replayRun, VERSION, MAX_TURNS } from '../dist/engine.js';
import { ROLE_MAP } from '../dist/roles.js';
import { ENDINGS } from '../dist/endings.js';

const password = 'synthetic-island-admin-test-only';
const salt = randomBytes(16);
const verifier = JSON.stringify({ v: 1, iterations: 100000, salt: salt.toString('hex'), hash: pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex') });
const source = readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '')
  .replace('export class HedoArchive', 'globalThis.HedoArchive=class HedoArchive').replace('export default', 'globalThis.worker=');
const payload = (changes = {}) => ({ version: 1, submissionId: crypto.randomUUID(), nickname: '小禾測試', districtId: 'lobby', outfit: 'teal',
  greeting: '很高興在島上遇見你。', introduction: '喜歡在島上散步，也喜歡聽大家分享工作日常。', reason: '這是只交給管理員看的申請理由，希望有機會陪大家聊聊。', consent: true, ...changes });
const privateKeys = ['id', 'status', 'nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'reason', 'reviewNote', 'createdAt', 'reviewedAt'].sort();
const publicKeys = ['id', 'nickname', 'districtId', 'outfit', 'greeting', 'introduction', 'slot'].sort();
function harness(t, { configured = true } = {}) {
  const db = new DatabaseSync(':memory:'); t.after(() => db.close()); db.exec('PRAGMA foreign_keys=ON'); let failQuery = null;
  const sql = { exec(query, ...args) {
    if (failQuery && query.includes(failQuery)) { failQuery = null; throw Error('Synthetic island storage failure'); }
    let rows = [];
    if (!args.length && query.includes(';')) db.exec(query);
    else { const statement = db.prepare(query); if (statement.columns().length) rows = statement.all(...args); else statement.run(...args); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { sql, transactionSync(fn) { db.exec('BEGIN'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } }, async getAlarm() { return null; }, async setAlarm() {} };
  const env = configured ? { ADMIN_PASSWORD_VERIFIER: verifier } : {};
  const context = vm.createContext({ DurableObject: class { constructor(ctx) { this.ctx = ctx; } }, replayRun, VERSION, MAX_TURNS, ROLE_MAP, ENDINGS, ...http,
    IslandApplicationStore, validateIslandApplication, AdminPrivateStore, validateFeedback, validatePublisherToken, FeedbackStore, AchievementStore, CharacterStore, ObservationStore, crypto, Response, Request, URL, Date });
  vm.runInContext(source, context); let archive;
  const reopen = () => { archive = new context.HedoArchive({ storage, blockConcurrencyWhile: fn => fn() }, env); }; reopen();
  const call = async (path, { method = 'GET', body, token, cookie, csrf, origin = 'https://game.example', site, ip = '192.0.2.10' } = {}) => {
    const headers = { 'CF-Connecting-IP': ip, 'X-Admin-Intent': 'private-archive' };
    if (token) headers.Authorization = `Bearer ${token}`; if (cookie) headers.Cookie = cookie; if (csrf) headers['X-CSRF-Token'] = csrf;
    if (origin !== false) headers.Origin = origin; if (site) headers['Sec-Fetch-Site'] = site; if (body !== undefined) headers['Content-Type'] = 'application/json';
    return archive.fetch(new Request('https://game.example' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  };
  const player = async () => { const token = randomBytes(32).toString('hex'), r = await call('/api/player', { method: 'POST', token, body: { token } }); assert.equal(r.status, 200); return { token, id: (await r.json()).playerId }; };
  const login = async () => { const r = await call('/api/admin/login', { method: 'POST', body: { password } }); assert.equal(r.status, 200); return { cookie: r.headers.get('Set-Cookie').split(';')[0], csrf: (await r.json()).csrfToken }; };
  const store = () => archive.islandStore();
  const seedPlayer = () => { const id = crypto.randomUUID(); sql.exec('INSERT INTO players (id,token_hash,created_at) VALUES (?,?,?)', id, crypto.randomUUID(), new Date().toISOString()); return id; };
  return { sql, storage, env, call, player, login, store, reopen, seedPlayer, failNext(query) { failQuery = query; } };
}
const submit = (h, player, body = payload(), extra = {}) => h.call('/api/island/applications', { method: 'POST', token: player.token, body, ...extra });
const review = (h, auth, id, decision = 'approve', note = '') => h.call(`/api/admin/island-applications/${id}/review`, { method: 'POST', ...auth, body: { decision, note } });
const noStore = r => { assert.match(r.headers.get('Cache-Control'), /private.*no-store/); assert.equal(r.headers.get('Access-Control-Allow-Origin'), null); };

test('public application summary counts only pending requests through every transition without exposing records', async t => {
  const h = harness(t), endpoint = '/api/island/application-summary';
  const count = async expected => {
    const r = await h.call(endpoint, { origin: false }); assert.equal(r.status, 200); noStore(r);
    assert.equal(r.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
    assert.deepEqual(await r.json(), { pending: expected }, 'the complete public response is one scalar count');
  };
  await count(0);
  const people = [];
  for (let i = 0; i < 4; i++) {
    const player = await h.player(), body = payload({ nickname: `測試島民${i}` });
    assert.equal((await submit(h, player, body)).status, 202); people.push({ player, body }); await count(i + 1);
  }
  const auth = await h.login();
  assert.equal((await review(h, auth, people[0].body.submissionId, 'approve', '審核測試備註')).status, 200); await count(3);
  assert.equal((await review(h, auth, people[1].body.submissionId, 'reject', '不公開的測試備註')).status, 200); await count(2);
  assert.equal((await h.call(`/api/island/applications/${people[2].body.submissionId}`, { method: 'DELETE', token: people[2].player.token })).status, 200); await count(1);
  assert.equal((await review(h, auth, people[0].body.submissionId, 'revoke', '撤銷已批准的測試申請')).status, 200); await count(1);
  h.reopen(); await count(1);
  assert.equal((await h.call(`/api/island/applications/${people[3].body.submissionId}`, { method: 'DELETE', token: people[3].player.token })).status, 200); await count(0);
  for (const options of [{ origin: 'https://foreign.example' }, { site: 'cross-site' }]) {
    const r = await h.call(endpoint, options); assert.equal(r.status, 403); noStore(r); assert.doesNotMatch(await r.text(), /測試島民|測試備註|申請理由/);
  }
  assert.equal((await h.call(endpoint + '?status=approved')).status, 400);
  assert.equal((await h.call(endpoint, { method: 'POST', body: {} })).status, 405);
});

test('application validation normalizes plain text and rejects unsafe, contact, extra and oversized fields', () => {
  const result = validateIslandApplication(payload({ nickname: '  ＡＢ禾  ' })); assert.equal(result.nickname, 'AB禾');
  for (const changes of [{ nickname: '禾' }, { nickname: '禾'.repeat(17) }, { greeting: 'x'.repeat(81) }, { introduction: '短' }, { reason: 'x'.repeat(501) }, { consent: false }, { consent: 'true' }, { version: 2 }, { submissionId: 'fake' }, { districtId: 'secret' }, { outfit: 'custom' }, { private: 'extra' }]) assert.throws(() => validateIslandApplication(payload(changes)), { status: 400 });
  for (const unsafe of ['<script>alert(1)</script>', '＜b＞你好＜/b＞', 'hello\nworld', 'hello\tworld', 'hidden\u202eworld', 'hidden\u200bworld', 'https://example.com', 'www.example.tw', 'example.com', 'example.social', 'a@example.test', 'a＠example.test', '小禾＠example.test', '@hedo-test', '請打 0912-345-678', '請打 0912.345.678', 'Line ID: hedo-test', '帳號：hedo-test', '臺北市大安區和平路12號']) {
    for (const field of ['greeting', 'introduction', 'reason']) assert.throws(() => validateIslandApplication(payload({ [field]: `測試文字內容 ${unsafe} 補足十個字` })), { status: 400 }, unsafe);
  }
  assert.equal(validateIslandApplication(payload({ nickname: '🌱'.repeat(16) })).nickname.length, 32, 'limits count Unicode code points');
});

test('store remains lazy and public config has no verification material; unconfigured submissions fail closed', async t => {
  const h = harness(t, { configured: false });
  assert.equal(h.sql.exec("SELECT name FROM sqlite_master WHERE name='island_applications'").toArray().length, 0);
  const config = await h.call('/api/island/config'); noStore(config); const body = await config.json();
  assert.equal(body.enabled, false); assert.deepEqual(Object.keys(body).sort(), ['enabled', 'limits']); assert.doesNotMatch(JSON.stringify(body), /salt|verifier|hash|password/i);
  const player = await h.player(); assert.equal((await submit(h, player)).status, 503);
  assert.deepEqual(await (await h.call('/api/island/residents')).json(), { version: 1, residents: [] });
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_applications').one().n, 0);
});

test('submission and owner history require the anonymous bearer, isolate owners, and keep pending content private', async t => {
  const h = harness(t), a = await h.player(), b = await h.player(), body = payload();
  assert.equal((await submit(h, {})).status, 401);
  assert.equal((await submit(h, { token: 'f'.repeat(64) })).status, 401);
  assert.equal((await submit(h, a, body, { origin: 'https://foreign.example' })).status, 403);
  assert.equal((await submit(h, a, body, { site: 'cross-site' })).status, 403);
  const response = await submit(h, a, body); assert.equal(response.status, 202); noStore(response);
  const { application } = await response.json(); assert.deepEqual(Object.keys(application).sort(), privateKeys); assert.equal(application.status, 'pending'); assert.equal(application.reviewedAt, null);
  assert.equal((await h.call('/api/island/applications/mine')).status, 401);
  assert.deepEqual(await (await h.call('/api/island/applications/mine', { token: b.token })).json(), { applications: [] });
  assert.equal((await h.call(`/api/island/applications/${application.id}`, { token: b.token, method: 'DELETE' })).status, 404);
  assert.equal((await h.call(`/api/island/applications/${application.id}`, { token: a.token })).status, 405);
  assert.equal((await h.call(`/api/island/applications/mine?id=${application.id}`, { token: a.token })).status, 400);
  const own = await h.call('/api/island/applications/mine', { token: a.token }); noStore(own); assert.deepEqual(await own.json(), { applications: [application] });
  for (const path of ['/api/island/residents', '/api/stats', '/api/characters']) {
    const publicResponse = await h.call(path); assert.equal(publicResponse.status, 200); const text = await publicResponse.text();
    for (const value of [body.reason, body.nickname, body.submissionId, a.id]) assert.ok(!text.includes(value));
  }
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM feedback_submissions').one().n, 0);
});

test('concurrent retries commit once, preserve normalized payload identity, and cannot reopen terminal applications', async t => {
  const h = harness(t), a = await h.player(), b = await h.player(), body = payload({ nickname: '  ＡＢ禾  ' });
  const responses = await Promise.all([submit(h, a, body), submit(h, a, body)]); for (const r of responses) assert.equal(r.status, 202);
  const snapshots = await Promise.all(responses.map(r => r.json())); assert.deepEqual(snapshots[0], snapshots[1]);
  assert.equal(h.sql.exec("SELECT count FROM island_application_limits WHERE bucket='global'").one().count, 1);
  assert.equal((await submit(h, a, { ...body, nickname: 'AB禾' })).status, 202);
  assert.equal((await submit(h, a, { ...body, greeting: '改了另一句問候' })).status, 409);
  assert.equal((await submit(h, b, body)).status, 409);
  assert.equal((await submit(h, a)).status, 409);
  const path = `/api/island/applications/${body.submissionId}`;
  assert.equal((await h.call(path, { method: 'DELETE', token: a.token })).status, 200);
  h.reopen();
  const repeated = await h.call(path, { method: 'DELETE', token: a.token }); assert.equal(repeated.status, 200); assert.equal((await repeated.json()).application.status, 'withdrawn');
  assert.equal((await (await submit(h, a, body)).json()).application.status, 'withdrawn');
  assert.equal(h.sql.exec("SELECT count FROM island_application_limits WHERE bucket='global'").one().count, 1);
});

test('review requires existing admin session, CSRF and exact origin; review responses and errors remain private', async t => {
  const h = harness(t), a = await h.player(), body = payload(); await submit(h, a, body); const auth = await h.login();
  for (const path of ['/api/admin/island-applications', `/api/admin/island-applications/${body.submissionId}/review`]) {
    const r = await h.call(path, path.endsWith('/review') ? { method: 'POST', body: { decision: 'approve' } } : {}); assert.equal(r.status, 401); noStore(r); assert.equal(r.headers.get('Vary'), 'Cookie');
  }
  for (const extra of [{ csrf: undefined }, { csrf: 'f'.repeat(64) }, { origin: false }, { origin: 'https://foreign.example' }, { site: 'cross-site' }]) {
    const r = await h.call(`/api/admin/island-applications/${body.submissionId}/review`, { method: 'POST', ...auth, body: { decision: 'approve' }, ...extra }); assert.equal(r.status, 403); noStore(r);
  }
  const list = await h.call('/api/admin/island-applications', auth); assert.equal(list.status, 200); noStore(list); const queue = await list.json();
  assert.deepEqual(queue.items.map(row => row.id), [body.submissionId]); assert.equal(queue.counts.pending, 1); assert.equal(queue.more, false); assert.equal(queue.nextCursor, null);
  const r = await review(h, auth, body.submissionId, 'reject', '請再補充你想分享的島上日常。'); assert.equal(r.status, 200); noStore(r);
  const application = (await r.json()).application; assert.equal(application.status, 'rejected'); assert.ok(application.reviewedAt); assert.deepEqual(Object.keys(application).sort(), privateKeys);
  assert.equal((await review(h, auth, body.submissionId)).status, 409);
  assert.equal((await h.call(`/api/island/applications/${body.submissionId}`, { method: 'DELETE', token: a.token })).status, 409);
  assert.equal((await h.call('/api/admin/archive', auth)).status, 200, 'existing private archive route is unaffected');
});

test('approval allocates three distinct slots, publishes only safe fields, and withdrawal/revoke immediately free slots', async t => {
  const h = harness(t), auth = await h.login(), people = [];
  for (let i = 0; i < 4; i++) { const player = await h.player(), body = payload(); assert.equal((await submit(h, player, body)).status, 202); people.push({ player, body }); }
  const racing = await Promise.all([review(h, auth, people[0].body.submissionId), review(h, auth, people[0].body.submissionId)]);
  assert.deepEqual(racing.map(r => r.status).sort(), [200, 409]);
  for (const person of people.slice(1, 3)) assert.equal((await review(h, auth, person.body.submissionId)).status, 200);
  const full = await review(h, auth, people[3].body.submissionId); assert.equal(full.status, 409); assert.equal((await full.json()).error, 'island_district_full');
  let residents = (await (await h.call('/api/island/residents')).json()).residents;
  assert.deepEqual(residents.map(row => row.slot), [0, 1, 2]); assert.equal(new Set(residents.map(row => row.id)).size, 3);
  for (const row of residents) { assert.deepEqual(Object.keys(row).sort(), publicKeys); assert.match(row.id, /^[0-9a-f-]{14}4[0-9a-f-]{21}$/); assert.ok(!people.some(p => p.body.submissionId === row.id)); }
  assert.doesNotMatch(JSON.stringify(residents), /reason|review|player|submission|status|createdAt/);
  const removedId = residents[1].id;
  const withdrawn = await h.call(`/api/island/applications/${people[1].body.submissionId}`, { method: 'DELETE', token: people[1].player.token }); assert.equal(withdrawn.status, 200);
  assert.equal((await review(h, auth, people[3].body.submissionId)).status, 200);
  residents = (await (await h.call('/api/island/residents')).json()).residents; assert.deepEqual(residents.map(row => row.slot), [0, 1, 2]); assert.ok(!residents.some(row => row.id === removedId));
  assert.equal((await review(h, auth, people[0].body.submissionId, 'revoke')).status, 400);
  const revoked = await review(h, auth, people[0].body.submissionId, 'revoke', '這份公開介紹需要重新整理。'); assert.equal(revoked.status, 200); assert.equal((await revoked.json()).application.status, 'rejected');
  h.reopen();
  assert.equal((await (await h.call('/api/island/residents')).json()).residents.length, 2);
  assert.equal((await (await h.call('/api/island/applications/mine', { token: people[1].player.token })).json()).applications[0].status, 'withdrawn');
  delete h.env.ADMIN_PASSWORD_VERIFIER;
  assert.equal((await (await h.call('/api/island/config')).json()).enabled, false);
  assert.equal((await h.call(`/api/island/applications/${people[2].body.submissionId}`, { method: 'DELETE', token: people[2].player.token })).status, 200);
  assert.equal((await (await h.call('/api/island/residents')).json()).residents.length, 1);
});

test('daily owner, network and global limits persist without storing raw addresses and reset at UTC rollover', async t => {
  const h = harness(t), store = h.store(); let now = Date.parse('2026-10-24T10:00:00.000Z'); store.now = () => now;
  const owner = h.seedPlayer();
  for (let i = 0; i < 3; i++) { const body = validateIslandApplication(payload()); await store.submit(owner, body, '192.0.2.42'); store.withdraw(owner, body.submissionId); }
  await assert.rejects(store.submit(owner, validateIslandApplication(payload()), '192.0.2.42'), { status: 429 });
  for (let i = 0; i < 7; i++) await store.submit(h.seedPlayer(), validateIslandApplication(payload()), '192.0.2.42');
  await assert.rejects(store.submit(h.seedPlayer(), validateIslandApplication(payload()), '192.0.2.42'), { status: 429 });
  for (let i = 0; i < 90; i++) await store.submit(h.seedPlayer(), validateIslandApplication(payload()), `198.51.100.${i}`);
  await assert.rejects(store.submit(h.seedPlayer(), validateIslandApplication(payload()), '203.0.113.1'), { status: 429 });
  const buckets = JSON.stringify(h.sql.exec('SELECT * FROM island_application_limits').toArray()); assert.doesNotMatch(buckets, /192\.0\.2|198\.51\.100|203\.0\.113/);
  h.reopen(); const restored = h.store(); restored.now = () => now;
  await assert.rejects(restored.submit(h.seedPlayer(), validateIslandApplication(payload()), '203.0.113.2'), { status: 429 });
  now = Date.parse('2026-10-25T00:00:00.000Z'); assert.equal((await restored.submit(owner, validateIslandApplication(payload()), '192.0.2.42')).application.status, 'pending');
});

test('admin pagination reaches every pending record, rejects malformed cursors, and queue cap is enforced', async t => {
  const h = harness(t), auth = await h.login(), store = h.store();
  for (let i = 0; i < 200; i++) {
    const body = payload(); h.sql.exec("INSERT INTO island_applications (id,player_id,payload_hash,status,nickname,district_id,outfit,greeting,introduction,reason,created_at) VALUES (?,?,?,'pending',?,?,?,?,?,?,?)",
      body.submissionId, h.seedPlayer(), 'synthetic', body.nickname, body.districtId, body.outfit, body.greeting, body.introduction, body.reason, '2026-10-24T10:00:00.000Z');
  }
  const first = await (await h.call('/api/admin/island-applications?status=pending', auth)).json(); assert.equal(first.items.length, 100); assert.equal(first.total, 200); assert.equal(first.more, true); assert.ok(first.nextCursor);
  const second = await (await h.call(`/api/admin/island-applications?status=pending&after=${first.nextCursor}`, auth)).json(); assert.equal(second.items.length, 100); assert.equal(second.more, false); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map(row => row.id)).size, 200);
  for (const query of ['status=unknown', 'status=pending&status=approved', 'after=bad!', `status=rejected&after=${first.nextCursor}`, 'playerId=private']) assert.equal((await h.call(`/api/admin/island-applications?${query}`, auth)).status, 400);
  await assert.rejects(store.submit(h.seedPlayer(), validateIslandApplication(payload()), '192.0.2.1'), { status: 503, code: 'island_queue_full' });
});

test('terminal content expires after 90 days while active residents persist and expired quota metadata is removed', async t => {
  const h = harness(t), store = h.store(); let now = Date.parse('2026-01-01T00:00:00.000Z'); store.now = () => now;
  const rows = [];
  for (let i = 0; i < 4; i++) { const owner = h.seedPlayer(), body = validateIslandApplication(payload()); await store.submit(owner, body); rows.push({ owner, body }); }
  store.review(rows[0].body.submissionId, { decision: 'reject', note: '請再補充故事。' });
  store.withdraw(rows[1].owner, rows[1].body.submissionId);
  store.review(rows[2].body.submissionId, { decision: 'approve' });
  now += 91 * 86400000; store.cleanup();
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_applications').one().n, 2);
  assert.equal(store.residents().residents.length, 1); assert.equal(store.mine(rows[3].owner).applications[0].status, 'pending');
  assert.deepEqual(store.mine(rows[0].owner), { applications: [] });
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_application_limits').one().n, 0);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_application_meta').one().n, 0);
});

test('failed writes roll back application and quota changes without changing archive, feedback or career data', async t => {
  const h = harness(t), a = await h.player(), body = payload(); h.store();
  h.failNext('INSERT INTO island_application_limits'); const r = await submit(h, a, body); assert.equal(r.status, 503); assert.doesNotMatch(await r.text(), /Synthetic|SQL|reason/);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_applications').one().n, 0); assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM island_application_limits').one().n, 0);
  assert.equal((await submit(h, a, body)).status, 202);
  for (const table of ['runs', 'player_endings', 'feedback_submissions']) assert.equal(h.sql.exec(`SELECT COUNT(*) AS n FROM ${table}`).one().n, 0);
  const me = await h.call('/api/me', { token: a.token }); assert.equal(me.status, 200); assert.doesNotMatch(await me.text(), /申請理由|小禾測試|island/);
});
