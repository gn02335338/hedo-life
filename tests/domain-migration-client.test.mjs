import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as protocol from '../dist/domain-migration.js';
import {
  LOCAL_KEYS, SESSION_KEYS, SOURCE_STATE_KEY, SOURCE_PENDING_KEY, RECEIPTS_KEY, BACKUP_KEY, ACTIVE_REVISION_KEY,
  captureSnapshot, snapshotDigest, validateReturnTo, validateMigrationPayload,
  sourceWasAcknowledged, rememberPending, acknowledgeSource, migrationConflict,
  importMigration, readBackups, restoreBackup,
} from '../dist/domain-migration.js';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); } };
}
const nonce = 'a'.repeat(64), firstToken = '1'.repeat(64), secondToken = '2'.repeat(64);
const game = (id = 'old-run', count = 1) => JSON.stringify({ run: { runId: id, seed: 'e39-test', actions: Array.from({ length: count }, (_, index) => ({ type: 'choice', eventId: `event-${index}`, index: 0 })) }, unlocked: ['collected-ending'], legacy: [], records: {}, achievements: { collected: { unlockedAt: '2026-10-01T00:00:00.000Z', source: 'verified' } } });
function payload(local = {}, session = {}) {
  return validateMigrationPayload({ version: 1, nonce, returnTo: '/island/?view=map#harbor',
    local: captureSnapshot(storage(local), storage(session)).local,
    session: captureSnapshot(storage(local), storage(session)).session });
}
const options = { cryptoApi: webcrypto };

test('capture includes every game, identity, queue, cache and session draft; excludes other/private keys', () => {
  const local = storage(Object.fromEntries([...LOCAL_KEYS.map(key => [key, `raw:${key}`]), ['private-secret', 'excluded']]));
  const session = storage({ [SESSION_KEYS[0]]: 'unpublished draft', 'private-admin': 'excluded' });
  const snapshot = captureSnapshot(local, session);
  assert.deepEqual(Object.keys(snapshot.local), [...LOCAL_KEYS]);
  assert.deepEqual(Object.keys(snapshot.session), [...SESSION_KEYS]);
  assert.equal(JSON.stringify(snapshot).includes('excluded'), false);
  assert.equal(snapshot.session[SESSION_KEYS[0]], 'unpublished draft');
});

test('return paths preserve path/query/hash and reject foreign origins, slash tricks and migration loops', () => {
  assert.equal(validateReturnTo('/island/?view=map&label=%E5%B3%B6#harbor'), '/island/?view=map&label=%E5%B3%B6#harbor');
  for (const path of ['//evil.test/', 'https://evil.test/', '/\\evil.test/', '/\n/evil', '/%5cattacker.example', '/%2f%2fattacker.example', '/%5fhodo/import', '/_hodo/import', '/foo/../_hodo/export', '/_hodo', '']) assert.throws(() => validateReturnTo(path));
});

test('payload validation rejects unknown storage keys, fields and non-string storage values', () => {
  const valid = payload();
  for (const value of [
    { ...valid, nonce: '<script>' }, { ...valid, other: true },
    { ...valid, local: { ...valid.local, arbitrary: 'secret' } },
    { ...valid, session: { arbitrary: 'secret' } },
    { ...valid, local: { ...valid.local, 'hedo-life-v3': {} } },
  ]) assert.throws(() => validateMigrationPayload(value));
});

test('automatic first import preserves exact raw saves, legacy collections, side games, identity and draft', async () => {
  const localValues = Object.fromEntries(LOCAL_KEYS.map(key => [key, key === 'hedo-life-v3' ? game() : `unchanged ${key}`]));
  localValues['hedo-anonymous-v1'] = firstToken;
  const input = payload(localValues, { 'hedo-feedback-draft-v1': '{"draft":"秘密草稿"}' });
  const local = storage(), session = storage();
  assert.equal((await importMigration(input, local, session, options)).complete, true);
  assert.deepEqual(captureSnapshot(local, session), { local: input.local, session: input.session });
  assert.equal(readBackups(local).length, 0, 'empty destination must not duplicate a potentially near-quota source save');
});

test('source acknowledged digest changes with old-tab progress and requires exact nonce/path', async () => {
  const local = storage({ 'hedo-life-v3': game() }), session = storage();
  const digest = await snapshotDigest(captureSnapshot(local, session), webcrypto);
  rememberPending(session, { nonce, digest, returnTo: '/?x=1#part' });
  assert.throws(() => acknowledgeSource(local, session, 'b'.repeat(64), '/?x=1#part'));
  assert.throws(() => acknowledgeSource(local, session, nonce, '/'));
  assert.equal(sourceWasAcknowledged(local, digest), false);
  acknowledgeSource(local, session, nonce, '/?x=1#part');
  assert.equal(sourceWasAcknowledged(local, digest), true);
  assert.equal(session.getItem(SOURCE_PENDING_KEY), null);
  local.setItem('hedo-life-v3', game('old-run', 2));
  assert.equal(sourceWasAcknowledged(local, await snapshotDigest(captureSnapshot(local, session), webcrypto)), false);
  assert.equal(JSON.parse(local.getItem(SOURCE_STATE_KEY)).digest, digest);
});

test('interrupted ack and repeated imports do not overwrite newer destination progress', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  const local = storage(), session = storage();
  await importMigration(input, local, session, options);
  const newer = game('newer-run', 4);
  local.setItem('hedo-life-v3', newer);
  const repeated = await importMigration({ ...input, nonce: 'b'.repeat(64), returnTo: '/gta/#race' }, local, session, options);
  assert.equal(repeated.alreadyImported, true);
  assert.equal(local.getItem('hedo-life-v3'), newer);
  assert.equal(readBackups(local).length, 0);
});

test('different anonymous identities are backed up before choice and never silently mixed', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game(), 'hedo-sync-queue-v3': '[{"runId":"old"}]' });
  const local = storage({ 'hedo-anonymous-v1': secondToken, 'hedo-life-v3': game('new-run'), 'hedo-sync-queue-v3': '[{"runId":"new"}]' }), session = storage();
  const before = captureSnapshot(local, session);
  const pending = await importMigration(input, local, session, options);
  assert.equal(pending.conflict, 'identity');
  assert.deepEqual(captureSnapshot(local, session), before);
  assert.deepEqual(readBackups(local)[0].destination, before);
  assert.equal(local.getItem(RECEIPTS_KEY), null);
  await importMigration(input, local, session, { ...options, choice: 'source' });
  assert.equal(local.getItem('hedo-anonymous-v1'), firstToken);
  assert.equal(local.getItem('hedo-sync-queue-v3'), input.local['hedo-sync-queue-v3']);
});

test('choosing destination preserves it and source remains restorable; switching backs up current progress', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  const local = storage({ 'hedo-anonymous-v1': secondToken, 'hedo-life-v3': game('new-run') }), session = storage();
  const destination = captureSnapshot(local, session);
  const imported = await importMigration(input, local, session, { ...options, choice: 'destination' });
  assert.deepEqual(captureSnapshot(local, session), destination);
  local.setItem('hedo-life-v3', game('new-run', 5));
  await restoreBackup(local, session, imported.digest, 'source', webcrypto);
  assert.equal(local.getItem('hedo-anonymous-v1'), firstToken);
  assert.equal(local.getItem('hedo-life-v3'), input.local['hedo-life-v3']);
  assert.equal(readBackups(local).length, 2);
  assert.equal(JSON.parse(readBackups(local)[1].source.local['hedo-life-v3']).run.actions.length, 5);
});

test('different ongoing runs and diverged action branches need a choice even under one identity', () => {
  const first = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  assert.equal(migrationConflict(first, captureSnapshot(storage({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game('second') }), storage())), 'run');
  const branch = JSON.parse(game()); branch.run.actions[0].index = 1;
  assert.equal(migrationConflict(first, captureSnapshot(storage({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': JSON.stringify(branch) }), storage())), 'run');
});

test('compatible identical-run import unions collection/proof queues', async () => {
  const first = JSON.parse(game()); first.unlocked = ['source-ending'];
  const next = JSON.parse(game()); next.unlocked = ['destination-ending'];
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': JSON.stringify(first),
    'hedo-achievement-queue-v1': JSON.stringify([{ runId: 'old-run', actions: [1] }, { runId: 'source-only', actions: [1] }]) });
  const local = storage({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': JSON.stringify(next),
    'hedo-achievement-queue-v1': JSON.stringify([{ runId: 'old-run', actions: [1, 2, 3] }, { runId: 'dest-only', actions: [1] }]) });
  await importMigration(input, local, storage(), options);
  const result = JSON.parse(local.getItem('hedo-life-v3'));
  assert.equal(result.run.actions.length, 1);
  assert.deepEqual(new Set(result.unlocked), new Set(['source-ending', 'destination-ending']));
  const queue = JSON.parse(local.getItem('hedo-achievement-queue-v1'));
  assert.equal(queue.find(row => row.runId === 'old-run').actions.length, 3);
  assert.equal(queue.length, 3);
});

test('same actions with different pending boundary and differing sidegame or drafts require choices', () => {
  const first = payload({ 'hedo-life-v3': game(), 'hedo-arpg-v1': '{"level":2}' }, { 'hedo-feedback-draft-v1': 'original draft' });
  const advanced = JSON.parse(game()); advanced.run.pending = { resolved: true };
  assert.equal(migrationConflict(first, captureSnapshot(storage({ 'hedo-life-v3': JSON.stringify(advanced) }), storage())), 'run');
  assert.equal(migrationConflict(first, captureSnapshot(storage({ 'hedo-arpg-v1': '{"level":3}' }), storage())), 'sidegame');
  assert.equal(migrationConflict(first, captureSnapshot(storage(), storage({ 'hedo-feedback-draft-v1': 'different draft' }))), 'draft');
});

test('new old-origin tab or changed draft cannot replay stale local data after successful migration', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game(), 'hedo-arpg-v1': '{"level":2}' }, { 'hedo-feedback-draft-v1': 'first draft' });
  const local = storage(), session = storage();
  await importMigration(input, local, session, options);
  local.setItem('hedo-life-v3', game('new-life', 5));
  local.setItem('hedo-arpg-v1', '{"level":9}');
  const newerLocal = captureSnapshot(local, session).local;
  const newTabInput = { ...input, session: { 'hedo-feedback-draft-v1': null } };
  assert.equal((await importMigration(newTabInput, local, session, options)).complete, true);
  assert.deepEqual(captureSnapshot(local, session).local, newerLocal);
  const changedDraft = { ...input, session: { 'hedo-feedback-draft-v1': 'second old-origin draft' } };
  assert.equal((await importMigration(changedDraft, local, session, options)).conflict, 'draft');
  await importMigration(changedDraft, local, session, { ...options, choice: 'source' });
  assert.deepEqual(captureSnapshot(local, session).local, newerLocal);
  assert.equal(session.getItem('hedo-feedback-draft-v1'), 'second old-origin draft');
});

test('backup quota failure stops before modifying gameplay data or marking success', async () => {
  const local = storage({ 'hedo-life-v3': game('destination') }), session = storage();
  const before = captureSnapshot(local, session), normalSet = local.setItem;
  local.setItem = (key, value) => { if (key === BACKUP_KEY) throw new Error('quota'); normalSet(key, value); };
  await assert.rejects(importMigration(payload({ 'hedo-life-v3': game() }), local, session, options));
  assert.deepEqual(captureSnapshot(local, session), before);
  assert.equal(local.getItem(RECEIPTS_KEY), null);
});

test('write/readback and receipt failures roll back gameplay, retain backup and remain retryable', async () => {
  for (const failingKey of ['hedo-life-v3', RECEIPTS_KEY, ACTIVE_REVISION_KEY]) {
    const local = storage({ 'hedo-anonymous-v1': firstToken }), session = storage(), before = captureSnapshot(local, session), normalSet = local.setItem;
    let failed = false;
    local.setItem = (key, value) => { if (key === failingKey && !failed) { failed = true; return; } normalSet(key, value); };
    const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
    await assert.rejects(importMigration(input, local, session, options));
    assert.deepEqual(captureSnapshot(local, session), before);
    assert.equal(readBackups(local).length, 1);
    assert.equal(local.getItem(RECEIPTS_KEY), null);
    assert.equal(local.getItem(ACTIVE_REVISION_KEY), null);
    assert.equal((await importMigration(input, local, session, options)).complete, true);
  }
});

test('cross-tab revision publishes only committed active changes; retries and keeping destination do not refresh it', async () => {
  const local = storage(), session = storage(), input = payload({ 'hedo-life-v3': game() });
  const writes = [], normalSet = local.setItem;
  local.setItem = (key, value) => { writes.push(key); normalSet(key, value); };
  await importMigration(input, local, session, options);
  const revision = local.getItem(ACTIVE_REVISION_KEY);
  assert.match(revision, /^[a-f0-9]{64}$/);
  assert.ok(writes.indexOf(RECEIPTS_KEY) < writes.indexOf(ACTIVE_REVISION_KEY));
  await importMigration(input, local, session, options);
  assert.equal(local.getItem(ACTIVE_REVISION_KEY), revision);
  const different = payload({ 'hedo-life-v3': game('other-life') });
  await importMigration(different, local, session, { ...options, choice: 'destination' });
  assert.equal(local.getItem(ACTIVE_REVISION_KEY), revision);
  const backup = readBackups(local)[0];
  await restoreBackup(local, session, backup.id, 'source', webcrypto);
  assert.notEqual(local.getItem(ACTIVE_REVISION_KEY), revision);
});

test('malformed saved data or divergent queued evidence cannot silently replace destination copies', () => {
  const source = payload({ 'hedo-life-v3': 'broken JSON' });
  assert.equal(migrationConflict(source, captureSnapshot(storage({ 'hedo-life-v3': game() }), storage())), 'run');
  const proof = (seed, actions) => JSON.stringify([{ runId: 'same-run', roleId: 'engineer', seed, actions }]);
  const queued = payload({ 'hedo-sync-queue-v3': proof('seed-a', [0, 1]) });
  assert.equal(migrationConflict(queued, captureSnapshot(storage({ 'hedo-sync-queue-v3': proof('seed-b', [0, 1]) }), storage())), 'proof');
  assert.equal(migrationConflict(queued, captureSnapshot(storage({ 'hedo-sync-queue-v3': proof('seed-a', [0, 2, 3]) }), storage())), 'proof');
  assert.equal(migrationConflict(queued, captureSnapshot(storage({ 'hedo-sync-queue-v3': proof('seed-a', [0, 1, 3]) }), storage())), null);
  assert.equal(migrationConflict(queued, captureSnapshot(storage({ 'hedo-sync-queue-v3': 'broken JSON' }), storage())), 'proof');
});

async function browserPage(config, { url, local = storage(), session = storage(), cookiesAllowed = true } = {}) {
  const navigations = [], submitted = [], parsed = new URL(url);
  function node(tag) {
    return { tag, children: [], textContent: '', listeners: {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      submit() { submitted.push({ method: this.method, action: this.action, enctype: this.enctype, payload: this.children.find(child => child.name === 'payload')?.value }); } };
  }
  const root = node('main'), body = node('body');
  let cookie = '', allowed = cookiesAllowed;
  const document = { body, createElement: node,
    getElementById(id) { return id === 'hodo-migration-root' ? root : { textContent: JSON.stringify(config) }; } };
  Object.defineProperty(document, 'cookie', { get() { return cookie; }, set(value) { if (allowed) cookie = value.split(';')[0]; } });
  // The real browser module shares one realm; normalize the harness's VM object
  // literals before passing them to the separately imported protocol module.
  const browserProtocol = { ...protocol, validateMigrationPayload(value) { return protocol.validateMigrationPayload(JSON.parse(JSON.stringify(value))); } };
  const context = vm.createContext({ __protocol: browserProtocol, document, localStorage: local, sessionStorage: session,
    location: { origin: parsed.origin, pathname: parsed.pathname, hash: parsed.hash, replace(value) { navigations.push(value); } },
    URL, JSON, Date, Error, crypto: webcrypto });
  const code = (await readFile(new URL('../dist/domain-migration-ui.js', import.meta.url), 'utf8'))
    .replace(/import\s*\{([\s\S]*?)\}\s*from\s*'\.\/domain-migration\.js';/, 'const {$1} = __protocol;')
    // Expose the real guarded promise to the harness. WebCrypto can finish after
    // any fixed number of event-loop turns, especially on a busy CI runner.
    .replace(/\bvoid guarded\(/g, 'guarded(');
  await vm.runInContext(code, context);
  return { root, body, navigations, submitted, local, session, get cookie() { return cookie; },
    allowCookies() { allowed = true; }, async click(label) {
      const button = root.children.find(child => child.tag === 'button' && child.textContent === label);
      assert.ok(button, `button ${label} exists`);
      await button.listeners.click();
    } };
}

test('browser flow POSTs data privately, acknowledges only after cookie/storage readback, preserves return path', async () => {
  const sourceLocal = storage({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  const sourceSession = storage({ 'hedo-feedback-draft-v1': 'draft' });
  const old = await browserPage({ mode: 'export', returnTo: '/island/?map=1' },
    { url: `${protocol.SOURCE_ORIGIN}/island/?map=1#harbor`, local: sourceLocal, session: sourceSession });
  assert.equal(old.submitted.length, 1);
  assert.equal(old.submitted[0].method, 'POST');
  assert.equal(old.submitted[0].enctype, 'multipart/form-data');
  assert.equal(old.submitted[0].action, `${protocol.TARGET_ORIGIN}/_hodo/import`);
  const posted = JSON.parse(old.submitted[0].payload);
  assert.equal(posted.returnTo, '/island/?map=1#harbor');
  const target = await browserPage({ mode: 'import', payload: posted }, { url: `${protocol.TARGET_ORIGIN}/_hodo/import` });
  assert.equal(target.local.getItem('hedo-anonymous-v1'), firstToken);
  assert.equal(target.session.getItem('hedo-feedback-draft-v1'), 'draft');
  assert.equal(target.cookie, 'hodo_migrated_v1=1');
  assert.equal(target.navigations.length, 1);
  assert.equal(target.navigations[0].includes(firstToken), false);
  const completed = await browserPage({ mode: 'complete', returnTo: posted.returnTo },
    { url: target.navigations[0], local: sourceLocal, session: sourceSession });
  assert.equal(completed.navigations[0], `${protocol.TARGET_ORIGIN}/island/?map=1#harbor`);
  assert.equal(sourceLocal.getItem('hedo-life-v3'), game());
});

test('explicit entry check reissues cleared cookie despite unchanged acknowledged source and newer destination', async () => {
  const local = storage({ 'hedo-life-v3': game() }), session = storage();
  const digest = await snapshotDigest(captureSnapshot(local, session), webcrypto);
  rememberPending(session, { nonce, digest, returnTo: '/' }); acknowledgeSource(local, session, nonce, '/');
  const ordinary = await browserPage({ mode: 'export', returnTo: '/gta/' }, { url: `${protocol.SOURCE_ORIGIN}/gta/`, local, session });
  assert.equal(ordinary.submitted.length, 0);
  assert.equal(ordinary.navigations[0], `${protocol.TARGET_ORIGIN}/gta/`);
  const explicit = await browserPage({ mode: 'export', force: true, returnTo: '/gta/#race' }, { url: `${protocol.SOURCE_ORIGIN}/_hodo/export?returnTo=x`, local, session });
  assert.equal(explicit.submitted.length, 1);
  assert.equal(JSON.parse(explicit.submitted[0].payload).returnTo, '/gta/#race');
  const entry = await browserPage({ mode: 'entry', returnTo: '/arpg/?level=2' }, { url: `${protocol.TARGET_ORIGIN}/arpg/?level=2#gate` });
  assert.equal(entry.navigations[0], `${protocol.SOURCE_ORIGIN}/_hodo/export?returnTo=${encodeURIComponent('/arpg/?level=2#gate')}`);
});

test('blocked-cookie browser stops safely; retry uses receipt and preserves newer target progress', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  const page = await browserPage({ mode: 'import', payload: input }, { url: `${protocol.TARGET_ORIGIN}/_hodo/import`, cookiesAllowed: false });
  assert.equal(page.navigations.length, 0);
  assert.equal(page.root.children[0].textContent, '進度還沒有搬好');
  assert.match(page.root.children[1].textContent, /Cookie/);
  const newer = game('new-life', 4); page.local.setItem('hedo-life-v3', newer);
  page.allowCookies(); await page.click('重新嘗試');
  assert.equal(page.navigations.length, 1);
  assert.equal(page.local.getItem('hedo-life-v3'), newer);
});

test('browser conflict presents choices and recovery without exposing anonymous credentials', async () => {
  const input = payload({ 'hedo-anonymous-v1': firstToken, 'hedo-life-v3': game() });
  const page = await browserPage({ mode: 'import', payload: input }, { url: `${protocol.TARGET_ORIGIN}/_hodo/import`,
    local: storage({ 'hedo-anonymous-v1': secondToken, 'hedo-life-v3': game('other-run') }) });
  assert.equal(page.navigations.length, 0);
  assert.equal(page.root.children[0].textContent, '找到兩份不同的進度');
  assert.equal(page.root.children.map(child => child.textContent).join('').includes(firstToken), false);
  await page.click('沿用原網址的進度');
  assert.equal(page.local.getItem('hedo-anonymous-v1'), firstToken);
  assert.equal(page.navigations.length, 1);
});
