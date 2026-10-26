import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { createIslandChallenge } from '../dist/island/challenge.js';
import { CHALLENGE_STORAGE_KEY, CHALLENGE_STORAGE_KEYS, CHALLENGE_RECEIPT_KEYS, CHALLENGE_INVITATION_KEY } from '../dist/island/challenge-storage.js';
import { LOCAL_KEYS, SESSION_KEYS, BACKUP_KEY, RECEIPTS_KEY, SOURCE_STATE_KEY,
  captureSnapshot, snapshotDigest, snapshotJSON, validateMigrationPayload, migrationConflict,
  importMigration, sourceWasAcknowledged, readBackups, restoreBackup } from '../dist/domain-migration.js';

const nonce = 'a'.repeat(64), firstToken = '1'.repeat(64), secondToken = '2'.repeat(64);
const passport = '{"version":1,"visited":["lobby","court"],"choices":{"lobby":1,"court":2}}';
const options = { cryptoApi: webcrypto };
function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); } };
}
function payload(local, session = storage()) {
  return validateMigrationPayload({ version: 1, nonce, returnTo: '/island/#challenge', ...captureSnapshot(local, session) });
}
function win(model, id) {
  const ready = model.begin(id); assert.equal(ready.ok, true, id); const result = model.settle(ready.token, 'win'); assert.equal(result.ok, true); return result;
}
function completeMain(model) {
  for (const { id } of ISLAND_CAST.filter(person => !['rick','spencer','wing'].includes(person.id))) win(model, id);
  for (const id of ['rick','spencer','wing']) win(model, id);
}
function legacySnapshot() {
  return { local: Object.fromEntries(LOCAL_KEYS.filter(key => !CHALLENGE_STORAGE_KEYS.includes(key)).map(key => [key,
    key === 'hedo-island-v1' ? passport : key === 'hedo-anonymous-v1' ? firstToken : null])),
  session: Object.fromEntries(SESSION_KEYS.map(key => [key, null])) };
}

test('the migration allowlist carries all 37 challenge records and excludes unrelated private keys', () => {
  assert.equal(CHALLENGE_STORAGE_KEYS.length, 37);
  assert.ok(CHALLENGE_STORAGE_KEYS.every(key => LOCAL_KEYS.includes(key)));
  const local = storage({ ...Object.fromEntries(CHALLENGE_STORAGE_KEYS.map(key => [key, `record:${key}`])), 'private-admin': 'not copied' });
  const snapshot = captureSnapshot(local, storage());
  for (const key of CHALLENGE_STORAGE_KEYS) assert.equal(snapshot.local[key], `record:${key}`);
  assert.ok(!Object.hasOwn(snapshot.local, 'private-admin'));
});

test('a completed 35-opponent challenge and opened invitation migrate with passport and identity intact', async () => {
  const source = storage({ 'hedo-island-v1': passport, 'hedo-anonymous-v1': firstToken }), challenge = createIslandChallenge({ storage: source });
  completeMain(challenge); challenge.openInvitation(); win(challenge, 'hidden-visitor');
  const before = new Map(source.values), incoming = payload(source), target = storage(), session = storage();
  assert.ok(CHALLENGE_STORAGE_KEYS.every(key => source.getItem(key) !== null));
  const result = await importMigration(incoming, target, session, options); assert.equal(result.complete, true);
  for (const key of CHALLENGE_STORAGE_KEYS) assert.equal(target.getItem(key), source.getItem(key), key);
  assert.equal(target.getItem('hedo-island-v1'), passport); assert.equal(target.getItem('hedo-anonymous-v1'), firstToken);
  assert.equal(createIslandChallenge({ storage: target }).getState().completed, true);
  assert.deepEqual(source.values, before, 'migration never deletes or rewrites the source browser copy');
  assert.equal(readBackups(target).length, 0);
});

test('compatible same-identity imports union independent victories instead of replacing either page of progress', async () => {
  const source = storage({ 'hedo-island-v1': passport, 'hedo-anonymous-v1': firstToken });
  const destination = storage({ 'hedo-island-v1': passport, 'hedo-anonymous-v1': firstToken });
  const a = createIslandChallenge({ storage: source }), b = createIslandChallenge({ storage: destination });
  win(a, 'jack'); win(a, 'helen'); win(b, 'sam'); win(b, 'sonny');
  const incoming = payload(source), session = storage();
  assert.equal(migrationConflict(incoming, captureSnapshot(destination, session)), null);
  assert.equal((await importMigration(incoming, destination, session, options)).complete, true);
  const merged = createIslandChallenge({ storage: destination }).getState();
  assert.deepEqual(merged.wins.sort(), ['helen','jack','sam','sonny']); assert.equal(merged.bosses[0].available, false);
  assert.equal(destination.getItem('hedo-island-v1'), passport); assert.equal(destination.getItem('hedo-anonymous-v1'), firstToken);
  const records = readBackups(destination); assert.equal(records.length, 1);
  assert.equal(records[0].source.local[CHALLENGE_RECEIPT_KEYS.jack], source.getItem(CHALLENGE_RECEIPT_KEYS.jack));
  assert.ok(records[0].destination.local[CHALLENGE_RECEIPT_KEYS.sam]);
  // A stale or invalid incoming receipt cannot mask a valid destination receipt.
  const other = storage({ 'hedo-island-v1': passport, 'hedo-anonymous-v1': firstToken,
    [CHALLENGE_RECEIPT_KEYS.sam]: '{"version":1,"opponentId":"sam","won":false}' });
  assert.equal((await importMigration(payload(other), destination, session, options)).complete, true);
  assert.ok(createIslandChallenge({ storage: destination }).getState().wins.includes('sam'));
});

test('aggregate-only compatible copies and one-sided invitation receipts preserve all eligible progress', async () => {
  const all = ISLAND_CAST.map(person => person.id), ordinary = all.filter(id => !['rick','spencer','wing'].includes(id));
  const source = storage({ 'hedo-anonymous-v1': firstToken,
    [CHALLENGE_STORAGE_KEY]: JSON.stringify({ version: 1, wins: ordinary, invitationOpened: false }),
    [CHALLENGE_INVITATION_KEY]: '{"version":1,"opened":false}' });
  const destination = storage({ 'hedo-anonymous-v1': firstToken,
    [CHALLENGE_STORAGE_KEY]: JSON.stringify({ version: 1, wins: all, invitationOpened: true }),
    [CHALLENGE_INVITATION_KEY]: '{"version":1,"opened":true}',
    [CHALLENGE_RECEIPT_KEYS['hidden-visitor']]: '{"version":1,"opponentId":"hidden-visitor","won":true}' });
  assert.equal((await importMigration(payload(source), destination, storage(), options)).complete, true);
  const shown = createIslandChallenge({ storage: destination }).getState();
  assert.equal(shown.invitation.opened, true); assert.equal(shown.completed, true); assert.equal(shown.wins.length, 35);
});

test('missing optional challenge keys project to null and keep the previous protocol digest and receipt valid', async () => {
  const old = legacySnapshot();
  const oldDigest = createHash('sha256').update(JSON.stringify(old)).digest('hex');
  const incoming = validateMigrationPayload({ version: 1, nonce, returnTo: '/island/', ...old });
  for (const key of CHALLENGE_STORAGE_KEYS) assert.equal(incoming.local[key], null);
  assert.equal(await snapshotDigest(old, webcrypto), oldDigest);
  assert.equal(await snapshotDigest(incoming, webcrypto), oldDigest);
  const source = storage(old.local), session = storage(), target = storage();
  source.setItem(SOURCE_STATE_KEY, JSON.stringify({ version: 1, digest: oldDigest }));
  assert.equal(sourceWasAcknowledged(source, await snapshotDigest(captureSnapshot(source, session), webcrypto)), true);
  await importMigration(incoming, target, session, options);
  assert.equal(target.getItem('hedo-island-v1'), passport); assert.equal(target.getItem('hedo-anonymous-v1'), firstToken);
  assert.ok(CHALLENGE_STORAGE_KEYS.every(key => target.getItem(key) === null));
  const current = createIslandChallenge({ storage: target }); win(current, 'jack');
  assert.notEqual(await snapshotDigest(captureSnapshot(target, session), webcrypto), oldDigest);
  // A receipt created by the old protocol still blocks replaying old local data.
  target.setItem(RECEIPTS_KEY, JSON.stringify({ version: 1, digests: [oldDigest], localDigests: [oldDigest] }));
  const repeated = await importMigration(incoming, target, session, options); assert.equal(repeated.alreadyImported, true);
  assert.deepEqual(createIslandChallenge({ storage: target }).getState().wins, ['jack']);
});

test('old migration backups lacking challenge fields restore as nulls and preserve the new copy for recovery', async () => {
  const old = legacySnapshot(), local = storage({ 'hedo-anonymous-v1': firstToken, 'hedo-island-v1': passport }), session = storage();
  const model = createIslandChallenge({ storage: local }); win(model, 'jack');
  local.setItem(BACKUP_KEY, JSON.stringify({ version: 1, records: [{ id: 'old-copy', createdAt: '2026-10-01T00:00:00.000Z', source: old, destination: null }] }));
  await restoreBackup(local, session, 'old-copy', 'source', webcrypto);
  assert.equal(snapshotJSON(captureSnapshot(local, session)), snapshotJSON(old));
  for (const key of CHALLENGE_STORAGE_KEYS) assert.equal(local.getItem(key), null, `${key}: missing fields never become the string undefined`);
  const recovery = readBackups(local).find(record => record.id !== 'old-copy'); assert.ok(recovery.source.local[CHALLENGE_RECEIPT_KEYS.jack]);
  await restoreBackup(local, session, recovery.id, 'source', webcrypto);
  assert.deepEqual(createIslandChallenge({ storage: local }).getState().wins, ['jack']);
});

test('different anonymous identities still require the existing choice and never combine challenge victories', async () => {
  const source = storage({ 'hedo-anonymous-v1': firstToken }), destination = storage({ 'hedo-anonymous-v1': secondToken }), session = storage();
  win(createIslandChallenge({ storage: source }), 'jack'); win(createIslandChallenge({ storage: destination }), 'helen');
  const incoming = payload(source), before = captureSnapshot(destination, session);
  const pending = await importMigration(incoming, destination, session, options);
  assert.equal(pending.conflict, 'identity'); assert.deepEqual(captureSnapshot(destination, session), before);
  assert.deepEqual(createIslandChallenge({ storage: destination }).getState().wins, ['helen']);
  const chosen = await importMigration(incoming, destination, session, { ...options, choice: 'source' }); assert.equal(chosen.complete, true);
  assert.equal(destination.getItem('hedo-anonymous-v1'), firstToken);
  assert.deepEqual(createIslandChallenge({ storage: destination }).getState().wins, ['jack']);
  assert.ok(readBackups(destination)[0].destination.local[CHALLENGE_RECEIPT_KEYS.helen]);
});
