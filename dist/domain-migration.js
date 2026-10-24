// This protocol copies browser-owned data without changing game/replay formats.
// Credentials stay in POST bodies and browser storage, never URLs or logs.
export const SOURCE_ORIGIN = 'https://hedo-life.bvstudio.workers.dev';
export const TARGET_ORIGIN = 'https://hodo.bvivify.com';
export const MAX_PAYLOAD_BYTES = 12 * 1024 * 1024;
export const LOCAL_KEYS = Object.freeze([
  'hedo-life-v1', 'hedo-life-v2', 'hedo-life-v3', 'hedo-anonymous-v1',
  'hedo-sync-queue-v3', 'hedo-achievement-queue-v1',
  'hedo-character-cache-v1', 'hedo-character-public-v1',
  'hedo-island-v1', 'hedo-gta-v1', 'hedo-arpg-v1',
]);
export const SESSION_KEYS = Object.freeze(['hedo-feedback-draft-v1']);
export const SOURCE_STATE_KEY = 'hodo-domain-migration-source-v1';
export const SOURCE_PENDING_KEY = 'hodo-domain-migration-pending-v1';
export const RECEIPTS_KEY = 'hodo-domain-migration-receipts-v1';
export const BACKUP_KEY = 'hodo-domain-migration-backups-v1';
export const ACTIVE_REVISION_KEY = 'hodo-domain-migration-active-v1';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

export function validateReturnTo(value) {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/')
    || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/u.test(value)) throw new Error('invalid_return_path');
  const url = new URL(value, TARGET_ORIGIN);
  let decodedPath;
  try { decodedPath = decodeURIComponent(url.pathname); } catch { throw new Error('invalid_return_path'); }
  if (url.origin !== TARGET_ORIGIN || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(url.pathname)
    || /[\\\u0000-\u001f\u007f]/u.test(decodedPath)
    || decodedPath === '/_hodo' || decodedPath.startsWith('/_hodo/')) throw new Error('invalid_return_path');
  return `${url.pathname}${url.search}${url.hash}`;
}

function validateStorage(value, keys) {
  if (!isRecord(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error('invalid_storage');
  return Object.fromEntries(keys.map(key => {
    const item = Object.hasOwn(value, key) ? value[key] : null;
    if (item !== null && typeof item !== 'string') throw new Error('invalid_storage');
    return [key, item];
  }));
}

export function validateMigrationPayload(value) {
  if (!isRecord(value) || value.version !== 1 || !/^[a-f0-9]{64}$/.test(value.nonce || '')
    || Object.keys(value).some(key => !['version', 'nonce', 'returnTo', 'local', 'session'].includes(key))) throw new Error('invalid_migration');
  const result = { version: 1, nonce: value.nonce, returnTo: validateReturnTo(value.returnTo),
    local: validateStorage(value.local, LOCAL_KEYS), session: validateStorage(value.session, SESSION_KEYS) };
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_PAYLOAD_BYTES) throw new Error('migration_too_large');
  return result;
}

export function captureSnapshot(local, session) {
  const read = (storage, keys) => Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
  return { local: read(local, LOCAL_KEYS), session: read(session, SESSION_KEYS) };
}

export function snapshotJSON(snapshot) {
  return JSON.stringify({ local: validateStorage(snapshot.local, LOCAL_KEYS), session: validateStorage(snapshot.session, SESSION_KEYS) });
}

export async function snapshotDigest(snapshot, cryptoApi = globalThis.crypto) {
  const bytes = new TextEncoder().encode(snapshotJSON(snapshot));
  const hash = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createNonce(cryptoApi = globalThis.crypto) {
  return Array.from(cryptoApi.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

function parseRecord(raw) {
  try { const result = JSON.parse(raw); return isRecord(result) ? result : null; } catch { return null; }
}

function checkedSet(storage, key, value) {
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw new Error('storage_readback_failed');
}

function restoreEntry(storage, key, value) {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

export function sourceWasAcknowledged(local, digest) {
  const state = parseRecord(local.getItem(SOURCE_STATE_KEY));
  return state?.version === 1 && state.digest === digest;
}

export function rememberPending(session, { nonce, digest, returnTo }) {
  checkedSet(session, SOURCE_PENDING_KEY, JSON.stringify({ version: 1, nonce, digest, returnTo: validateReturnTo(returnTo) }));
}

export function acknowledgeSource(local, session, nonce, returnTo) {
  const pending = parseRecord(session.getItem(SOURCE_PENDING_KEY));
  if (!pending || pending.version !== 1 || pending.nonce !== nonce || !/^[a-f0-9]{64}$/.test(nonce || '')
    || pending.returnTo !== validateReturnTo(returnTo) || !/^[a-f0-9]{64}$/.test(pending.digest || '')) throw new Error('migration_ack_mismatch');
  checkedSet(local, SOURCE_STATE_KEY, JSON.stringify({ version: 1, digest: pending.digest }));
  session.removeItem(SOURCE_PENDING_KEY);
  return pending.returnTo;
}

export function migrationConflict(source, destination) {
  const sourceToken = source.local['hedo-anonymous-v1'], destinationToken = destination.local['hedo-anonymous-v1'];
  if (sourceToken && destinationToken && sourceToken !== destinationToken) return 'identity';
  const sourceGame = parseRecord(source.local['hedo-life-v3']), destinationGame = parseRecord(destination.local['hedo-life-v3']);
  if (source.local['hedo-life-v3'] !== null && destination.local['hedo-life-v3'] !== null
    && source.local['hedo-life-v3'] !== destination.local['hedo-life-v3'] && (!sourceGame || !destinationGame)) return 'run';
  const first = sourceGame?.run, second = destinationGame?.run;
  // Pending-result and advanced-event boundaries can share the same actions.
  // A full run difference therefore requires a choice, even for one run UUID.
  if (first && second && JSON.stringify(first) !== JSON.stringify(second)) return 'run';
  for (const key of ['hedo-island-v1', 'hedo-gta-v1', 'hedo-arpg-v1']) {
    if (source.local[key] !== null && destination.local[key] !== null && source.local[key] !== destination.local[key]) return 'sidegame';
  }
  if (SESSION_KEYS.some(key => source.session[key] !== null && destination.session[key] !== null
    && source.session[key] !== destination.session[key])) return 'draft';
  for (const key of ['hedo-sync-queue-v3', 'hedo-achievement-queue-v1']) {
    const left = source.local[key], right = destination.local[key];
    if (left === null || right === null || left === right) continue;
    let firstQueue, secondQueue;
    try { firstQueue = JSON.parse(left); secondQueue = JSON.parse(right); } catch { return 'proof'; }
    if (!Array.isArray(firstQueue) || !Array.isArray(secondQueue)) return 'proof';
    const existing = new Map(secondQueue.map(row => [row?.runId, row]));
    for (const row of firstQueue) {
      const previous = existing.get(row?.runId);
      if (!previous) continue;
      if (row.roleId !== previous.roleId || row.seed !== previous.seed
        || !Array.isArray(row.actions) || !Array.isArray(previous.actions)) return 'proof';
      const length = Math.min(row.actions.length, previous.actions.length);
      if (JSON.stringify(row.actions.slice(0, length)) !== JSON.stringify(previous.actions.slice(0, length))) return 'proof';
    }
  }
  return null;
}

function union(left, right) { return [...new Set([...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])])]; }

// Only merge compatible identities. Complete conflicting copies stay separate.
function mergeCompatible(source, destination) {
  const result = { local: {}, session: {} };
  for (const key of LOCAL_KEYS) result.local[key] = source.local[key] ?? destination.local[key];
  for (const key of SESSION_KEYS) result.session[key] = source.session[key] ?? destination.session[key];
  const left = parseRecord(source.local['hedo-life-v3']), right = parseRecord(destination.local['hedo-life-v3']);
  if (left && right) {
    const achievements = { ...(right.achievements || {}) };
    for (const [id, row] of Object.entries(left.achievements || {})) {
      const old = achievements[id];
      if (!old || (row?.source === 'verified' && old.source !== 'verified')
        || (row?.source === old.source && Date.parse(row?.unlockedAt) < Date.parse(old.unlockedAt))) achievements[id] = row;
    }
    let run = left.run || right.run || null;
    if (left.run && right.run && (right.run.actions?.length || 0) > (left.run.actions?.length || 0)) run = right.run;
    result.local['hedo-life-v3'] = JSON.stringify({ ...right, ...left, run,
      unlocked: union(right.unlocked, left.unlocked), legacy: union(right.legacy, left.legacy),
      records: { ...(right.records || {}), ...(left.records || {}) }, achievements });
  }
  for (const key of ['hedo-life-v1', 'hedo-life-v2']) {
    const first = parseRecord(source.local[key]), second = parseRecord(destination.local[key]);
    if (first && second) result.local[key] = JSON.stringify({ ...second, ...first,
      unlocked: union(second.unlocked, first.unlocked), legacy: union(second.legacy, first.legacy) });
  }
  for (const key of ['hedo-sync-queue-v3', 'hedo-achievement-queue-v1']) {
    let first, second;
    try { first = JSON.parse(source.local[key]); second = JSON.parse(destination.local[key]); } catch { continue; }
    if (!Array.isArray(first) || !Array.isArray(second)) continue;
    const rows = new Map();
    for (const row of [...second, ...first]) {
      const id = row?.runId;
      if (!id) continue;
      if (!rows.has(id) || (row.actions?.length || 0) > (rows.get(id).actions?.length || 0)) rows.set(id, row);
    }
    result.local[key] = JSON.stringify([...rows.values()]);
  }
  return result;
}

export function readBackups(local) {
  const raw = local.getItem(BACKUP_KEY);
  if (raw === null) return [];
  const saved = parseRecord(raw);
  if (saved?.version !== 1 || !Array.isArray(saved.records)) throw new Error('invalid_migration_backups');
  for (const record of saved.records) {
    if (!isRecord(record) || typeof record.id !== 'string') throw new Error('invalid_migration_backups');
    snapshotJSON(record.source);
    if (record.destination) snapshotJSON(record.destination);
  }
  return saved.records;
}

function preserveBackup(local, id, source, destination) {
  const records = readBackups(local);
  if (!records.some(row => row.id === id)) {
    records.push({ id, createdAt: new Date().toISOString(), source, destination });
    checkedSet(local, BACKUP_KEY, JSON.stringify({ version: 1, records }));
  }
}

function readReceipts(local) {
  const raw = local.getItem(RECEIPTS_KEY);
  if (raw === null) return { digests: [], localDigests: [] };
  const value = parseRecord(raw);
  if (value?.version !== 1 || !Array.isArray(value.digests) || !Array.isArray(value.localDigests)
    || [...value.digests, ...value.localDigests].some(id => !/^[a-f0-9]{64}$/.test(id))) throw new Error('invalid_migration_receipts');
  return value;
}

export function writeSnapshot(snapshot, local, session) {
  for (const [storage, keys, values] of [[local, LOCAL_KEYS, snapshot.local], [session, SESSION_KEYS, snapshot.session]]) {
    for (const key of keys) {
      if (values[key] === null) storage.removeItem(key);
      else storage.setItem(key, values[key]);
      if (storage.getItem(key) !== values[key]) throw new Error('storage_readback_failed');
    }
  }
}

export async function importMigration(raw, local, session, { choice = null, cryptoApi = globalThis.crypto } = {}) {
  const payload = validateMigrationPayload(raw), source = { local: payload.local, session: payload.session };
  const digest = await snapshotDigest(source, cryptoApi), receipts = readReceipts(local);
  if (receipts.digests.includes(digest)) return { complete: true, alreadyImported: true, digest };
  const localDigest = await snapshotDigest({ local: source.local, session: Object.fromEntries(SESSION_KEYS.map(key => [key, null])) }, cryptoApi);
  const destination = captureSnapshot(local, session);
  // A different tab's absent/different draft must never make stale source local
  // progress eligible to overwrite a previously imported, now newer copy.
  const localAlreadyImported = receipts.localDigests.includes(localDigest);
  const incoming = localAlreadyImported ? { local: destination.local, session: source.session } : source;
  const conflict = migrationConflict(incoming, destination);
  // A pristine destination can fit the original save without needing twice its
  // storage quota. The untouched old origin remains that first copy's backup.
  if (snapshotHasData(destination)) preserveBackup(local, digest, source, destination);
  if (conflict && !['source', 'destination'].includes(choice)) return { complete: false, conflict, digest };
  const selected = choice === 'destination' ? destination : conflict ? incoming : mergeCompatible(incoming, destination);
  if (localAlreadyImported) selected.local = destination.local;
  const previousReceipts = local.getItem(RECEIPTS_KEY), previousRevision = local.getItem(ACTIVE_REVISION_KEY);
  try {
    writeSnapshot(selected, local, session);
    checkedSet(local, RECEIPTS_KEY, JSON.stringify({ version: 1, digests: [...receipts.digests, digest],
      localDigests: union(receipts.localDigests, [localDigest]) }));
    // Other open game tabs reload only after both active data and its receipt
    // are durable. An idempotent/keep-destination import has no new revision.
    if (snapshotJSON(selected) !== snapshotJSON(destination)) checkedSet(local, ACTIVE_REVISION_KEY, createNonce(cryptoApi));
  } catch (error) {
    try { writeSnapshot(destination, local, session); } catch { /* The durable local backup and source copy remain available. */ }
    try { restoreEntry(local, RECEIPTS_KEY, previousReceipts); } catch {}
    try { restoreEntry(local, ACTIVE_REVISION_KEY, previousRevision); } catch {}
    throw error;
  }
  return { complete: true, alreadyImported: false, digest };
}

export async function restoreBackup(local, session, id, side, cryptoApi = globalThis.crypto) {
  if (!['source', 'destination'].includes(side)) throw new Error('invalid_backup');
  const records = readBackups(local), selected = records.find(record => record.id === id)?.[side];
  if (!selected) throw new Error('invalid_backup');
  const current = captureSnapshot(local, session), digest = await snapshotDigest(current, cryptoApi);
  preserveBackup(local, digest, current, null);
  const previousRevision = local.getItem(ACTIVE_REVISION_KEY);
  try {
    writeSnapshot(selected, local, session);
    if (snapshotJSON(selected) !== snapshotJSON(current)) checkedSet(local, ACTIVE_REVISION_KEY, createNonce(cryptoApi));
  } catch (error) {
    try { writeSnapshot(current, local, session); } catch {}
    try { restoreEntry(local, ACTIVE_REVISION_KEY, previousRevision); } catch {}
    throw error;
  }
}

export function snapshotHasData(snapshot) {
  return LOCAL_KEYS.some(key => snapshot.local[key] !== null) || SESSION_KEYS.some(key => snapshot.session[key] !== null);
}
