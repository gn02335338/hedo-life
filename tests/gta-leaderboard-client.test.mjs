import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLeaderboardClient, RANKING_PENDING_KEY } from '../dist/gta/leaderboard-client.js';
import { verifyRaceProof } from '../dist/gta/racing-proof.js';
import { driveRaceProof } from './helpers/gta-racing-proof.mjs';

const IDENTITY_KEY = 'hedo-anonymous-v1', tokenA = 'a'.repeat(64), tokenB = 'b'.repeat(64);
const runA = 'a1234567-1234-4123-8123-123456789abc', runB = 'b1234567-1234-4123-8123-123456789abc';
const goodProof = driveRaceProof().proof;
assert.equal(verifyRaceProof(goodProof).ok, true);
const body = (runId = runA) => ({ runId, proof: structuredClone(goodProof) });
const elapsed = proof => Math.round(proof.samples.at(-1)[0] * 1000 / 120);
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const receipt = (submission, extras = {}) => ({ recorded: true, duplicate: false, improved: true,
  entry: { raceId: submission.proof.raceId, runId: submission.runId.toLowerCase(), vehicleId: submission.proof.vehicleId,
    elapsedMs: elapsed(submission.proof), position: 1, driverCode: '車手-123456789ABC' }, ...extras });
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
const client = (storage, fetcher, extras = {}) => createLeaderboardClient({ storage, fetcher, random: webcrypto, ...extras });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('reading public boards creates no identity, shares inflight/cache, and strips private receipt fields', async () => {
  const storage = memory({ 'hedo-gta-v1': 'local-game' }), gate = deferred();
  let calls = 0, clock = 1000;
  const api = client(storage, async (url, options) => {
    calls += 1; assert.equal(url, '/api/gta/leaderboard?raceId=first-sprint');
    assert.equal(options.headers.Authorization, undefined); await gate.promise;
    return reply({ version: 1, raceId: 'first-sprint', totalDrivers: 1, entries: [{ driverCode: '車手-123456789ABC',
      elapsedMs: 7000, position: 1, vehicleId: 'owned-hatch', runId: runA, token: tokenA }] });
  }, { now: () => clock });
  const first = api.board('first-sprint'), second = api.board('first-sprint'); gate.resolve();
  assert.deepEqual(await first, await second); assert.equal(calls, 1);
  const loaded = await api.board('first-sprint');
  assert.deepEqual(Object.keys(loaded.entries[0]).sort(), ['driverCode', 'elapsedMs', 'position', 'vehicleId']);
  assert.equal(calls, 1); assert.deepEqual(await api.mine(), { version: 1, driverCode: null, entries: [] });
  assert.equal(storage.getItem(IDENTITY_KEY), null); assert.equal(storage.getItem(RANKING_PENDING_KEY), null);
  assert.equal(storage.getItem('hedo-gta-v1'), 'local-game');
  clock += 60001; await api.board('first-sprint'); assert.equal(calls, 2);
});

test('an uncertain response survives reload, retries the exact body and identity, and cannot be replaced by a later run', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA, 'hedo-gta-v1': 'game-progress' });
  const submitted = [], firstBody = body();
  const first = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    submitted.push(options.body); assert.equal(options.headers.Authorization, `Bearer ${tokenA}`);
    throw new TypeError('connection closed after the server committed');
  });
  await assert.rejects(first.submit(firstBody), /暫時無法連上/);
  const persisted = storage.getItem(RANKING_PENDING_KEY); assert.ok(persisted);
  firstBody.proof.samples[1][1] = 123;
  const reloaded = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    submitted.push(options.body);
    return reply(receipt(JSON.parse(options.body), { duplicate: true, improved: false }));
  });
  assert.equal((await reloaded.pending()).runId, runA);
  await assert.rejects(reloaded.submit(body(runB)), /上一場成績尚未確認/);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), persisted); assert.equal(submitted.length, 1);
  const result = await reloaded.retry(); assert.equal(result.duplicate, true); assert.equal(result.improved, false);
  assert.equal(submitted.length, 2); assert.equal(submitted[1], submitted[0]);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), null); assert.equal(storage.getItem('hedo-gta-v1'), 'game-progress');
});

test('a slower accepted run clears its own receipt without pretending to replace the personal best', async () => {
  const storage = memory(), submission = body();
  const api = client(storage, async (url, options) => url === '/api/player' ? reply({ ok: true })
    : reply(receipt(JSON.parse(options.body), { improved: false })));
  const result = await api.submit(submission);
  assert.equal(result.recorded, true); assert.equal(result.improved, false); assert.equal(result.entry.runId, runA);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), null); assert.match(storage.getItem(IDENTITY_KEY), /^[a-f0-9]{64}$/);
});

test('incomplete, wrong-run, wrong-time and malformed successful receipts retain the exact pending submission', async () => {
  const corruptions = [result => { delete result.recorded; }, result => { result.entry.runId = runB; },
    result => { result.entry.elapsedMs += 1; }, result => { result.entry.vehicleId = 'owned-suv'; },
    result => { result.entry.driverCode = '\nforged'; }, result => { result.entry.position = 0; }];
  for (const corrupt of corruptions) {
    const storage = memory({ [IDENTITY_KEY]: tokenA }); let sent;
    const api = client(storage, async (url, options) => {
      if (url === '/api/player') return reply({ ok: true });
      sent = options.body; const result = receipt(JSON.parse(sent)); corrupt(result); return reply(result);
    });
    await assert.rejects(api.submit(body()), /收據尚未核對/);
    assert.equal(JSON.stringify(JSON.parse(storage.getItem(RANKING_PENDING_KEY)).body), sent);
  }
});

test('canonical server UUIDs acknowledge an accepted uppercase UUID without trapping the queue', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA });
  const api = client(storage, async (url, options) => url === '/api/player' ? reply({ ok: true }) : reply(receipt(JSON.parse(options.body))));
  const result = await api.submit(body(runA.toUpperCase()));
  assert.equal(result.entry.runId, runA); assert.equal(storage.getItem(RANKING_PENDING_KEY), null);
});

test('storage failures prevent any submission and malformed pending data is preserved for recovery', async () => {
  let calls = 0;
  const fetcher = async () => { calls += 1; throw new Error('must not send'); };
  const unavailable = { getItem: () => null, setItem: () => { throw new Error('blocked'); } };
  await assert.rejects(client(unavailable, fetcher).submit(body()), /無法保存上榜憑證/);
  const full = memory({ [IDENTITY_KEY]: tokenA });
  full.setItem = (key, value) => { if (key === RANKING_PENDING_KEY) throw new Error('quota'); full.values.set(key, value); };
  await assert.rejects(client(full, fetcher).submit(body()), /無法保存待確認成績/);
  const malformed = memory({ [IDENTITY_KEY]: tokenA, [RANKING_PENDING_KEY]: '{broken' });
  await assert.rejects(client(malformed, fetcher).submit(body()), /待確認的上榜紀錄無法讀取/);
  assert.equal(malformed.getItem(RANKING_PENDING_KEY), '{broken'); assert.equal(calls, 0);
});

test('identity changes before retry or while parsing a receipt never erase or reassign the original pending run', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA });
  const setup = client(storage, async url => { if (url === '/api/player') return reply({ ok: true }); throw new Error('offline'); });
  await assert.rejects(setup.submit(body())); const pending = storage.getItem(RANKING_PENDING_KEY);
  storage.setItem(IDENTITY_KEY, tokenB); let calls = 0;
  await assert.rejects(client(storage, async () => { calls += 1; }).retry(), /原本的匿名身分/);
  assert.equal(calls, 0); assert.equal(storage.getItem(RANKING_PENDING_KEY), pending);
  storage.setItem(IDENTITY_KEY, tokenA);
  const changed = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    return { ok: true, status: 200, json: async () => { storage.setItem(IDENTITY_KEY, tokenB); return receipt(JSON.parse(options.body)); } };
  });
  await assert.rejects(changed.retry(), /匿名身分已在其他分頁變更/);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), pending);
});

test('a second in-flight run cannot resolve with the first run receipt or replace its pending body', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA }), started = deferred(), release = deferred();
  let sends = 0;
  const api = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    sends += 1; started.resolve(); await release.promise; return reply(receipt(JSON.parse(options.body)));
  });
  const first = api.submit(body()); await started.promise;
  const pending = storage.getItem(RANKING_PENDING_KEY);
  const second = api.submit(body(runB));
  release.resolve();
  await assert.rejects(second, /目前|上一場|上傳|確認/);
  assert.equal((await first).entry.runId, runA); assert.equal(sends, 1);
  assert.equal(JSON.parse(pending).body.runId, runA); assert.equal(storage.getItem(RANKING_PENDING_KEY), null);
});

test('withdrawal changes public visibility only and drops a matching uncertain upload after confirmation', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA, 'hedo-gta-v1': 'unchanged-game', 'hedo-life-v3': 'unchanged-life' });
  const first = client(storage, async url => { if (url === '/api/player') return reply({ ok: true }); throw new Error('lost'); });
  await assert.rejects(first.submit(body())); assert.ok(storage.getItem(RANKING_PENDING_KEY));
  const api = client(storage, async (url, options) => {
    assert.equal(url, '/api/gta/leaderboard?raceId=first-sprint'); assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.Authorization, `Bearer ${tokenA}`); return reply({ raceId: 'first-sprint', removed: true });
  });
  assert.deepEqual(await api.withdraw('first-sprint'), { raceId: 'first-sprint', removed: true });
  assert.equal(storage.getItem(RANKING_PENDING_KEY), null); assert.equal(storage.getItem(IDENTITY_KEY), tokenA);
  assert.equal(storage.getItem('hedo-gta-v1'), 'unchanged-game'); assert.equal(storage.getItem('hedo-life-v3'), 'unchanged-life');
});

test('temporary API failures keep the pending proof, while definite rejection releases only that exact run', async () => {
  for (const status of [401, 429, 500, 503, 400, 409, 413, 422]) {
    const storage = memory({ [IDENTITY_KEY]: tokenA, 'hedo-gta-v1': 'local-progress' });
    const api = client(storage, async url => url === '/api/player' ? reply({ ok: true })
      : reply({ error: 'test_error', message: '測試錯誤' }, status));
    await assert.rejects(api.submit(body()), error => error.status === status);
    assert.equal(Boolean(storage.getItem(RANKING_PENDING_KEY)), [401, 429, 500, 503].includes(status), `HTTP ${status}`);
    assert.equal(storage.getItem('hedo-gta-v1'), 'local-progress');
  }
});

test('a queue changed by another tab before publication is not submitted or erased by the old sender', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA }); let scoreCalls = 0;
  const api = client(storage, async url => {
    if (url === '/api/player') {
      const newer = JSON.parse(storage.getItem(RANKING_PENDING_KEY)); newer.body = body(runB);
      storage.setItem(RANKING_PENDING_KEY, JSON.stringify(newer)); return reply({ ok: true });
    }
    scoreCalls += 1; throw new Error('old run must not be submitted');
  });
  await assert.rejects(api.submit(body()), /其他分頁變更/);
  assert.equal(scoreCalls, 0); assert.equal(JSON.parse(storage.getItem(RANKING_PENDING_KEY)).body.runId, runB);
});

test('a successful receipt whose local cleanup failed can be safely retried and never loses the original proof', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA }); let removed = false, sends = 0;
  storage.removeItem = key => { if (removed) storage.values.delete(key); };
  const api = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    sends += 1; return reply(receipt(JSON.parse(options.body), { duplicate: sends > 1, improved: sends === 1 }));
  });
  await assert.rejects(api.submit(body()), /尚未清除/);
  assert.equal((await api.pending()).runId, runA);
  removed = true;
  const result = await api.retry(); assert.equal(result.duplicate, true); assert.equal(sends, 2);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), null);
});

test('publication bypasses an older board request and its late completion cannot evict the current request or cache', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA }), oldGate = deferred(), currentGate = deferred();
  const empty = { version: 1, raceId: 'first-sprint', totalDrivers: 0, entries: [] };
  const published = { version: 1, raceId: 'first-sprint', totalDrivers: 1, entries: [{
    driverCode: '車手-123456789ABC', elapsedMs: elapsed(goodProof), position: 1, vehicleId: 'owned-hatch' }] };
  let reads = 0;
  const api = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    if (options.method === 'POST') return reply(receipt(JSON.parse(options.body)));
    reads += 1;
    if (reads === 1) { await oldGate.promise; return reply(empty); }
    await currentGate.promise; return reply(published);
  });
  const oldRead = api.board('first-sprint'); assert.equal(reads, 1);
  await api.submit(body());
  const currentRead = api.board('first-sprint', { refresh: true });
  assert.equal(reads, 2, 'confirmed publication must start a new read instead of sharing the older inflight request');
  oldGate.resolve(); assert.deepEqual(await oldRead, empty);
  const sharedCurrent = api.board('first-sprint', { refresh: true });
  assert.equal(reads, 2, 'the old finally handler must leave the new inflight request available for coalescing');
  currentGate.resolve(); assert.deepEqual(await currentRead, published); assert.deepEqual(await sharedCurrent, published);
  assert.deepEqual(await api.board('first-sprint'), published); assert.equal(reads, 2);
});

test('withdrawal stays visible after a pre-withdraw board response arrives later than the refreshed empty board', async () => {
  const storage = memory({ [IDENTITY_KEY]: tokenA }), oldGate = deferred();
  const listed = { version: 1, raceId: 'first-sprint', totalDrivers: 1, entries: [{
    driverCode: '車手-123456789ABC', elapsedMs: elapsed(goodProof), position: 1, vehicleId: 'owned-hatch' }] };
  const empty = { version: 1, raceId: 'first-sprint', totalDrivers: 0, entries: [] };
  let reads = 0;
  const api = client(storage, async (url, options) => {
    if (options.method === 'DELETE') return reply({ raceId: 'first-sprint', removed: true });
    reads += 1;
    if (reads === 1) { await oldGate.promise; return reply(listed); }
    return reply(empty);
  });
  const oldRead = api.board('first-sprint');
  await api.withdraw('first-sprint');
  assert.deepEqual(await api.board('first-sprint', { refresh: true }), empty);
  assert.equal(reads, 2, 'withdrawal forces a fresh revision despite the pre-withdraw GET still being inflight');
  oldGate.resolve(); assert.deepEqual(await oldRead, listed);
  assert.deepEqual(await api.board('first-sprint'), empty, 'the delayed public response must never restore a withdrawn listing in cache');
  assert.equal(reads, 2);
});
