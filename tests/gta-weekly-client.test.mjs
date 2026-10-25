import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLeaderboardClient, RANKING_PENDING_KEY } from '../dist/gta/leaderboard-client.js';
import { racingCalendar, dailyChallenge } from '../dist/gta/racing-calendar.js';
import { driveRaceProof } from './helpers/gta-racing-proof.mjs';

const IDENTITY_KEY = 'hedo-anonymous-v1', token = 'a'.repeat(64);
const weekId = '2026-10-19', priorWeek = '2026-10-12', nextWeek = '2026-10-26';
const weekly = { scope: 'weekly', weekId }, prior = { scope: 'weekly', weekId: priorWeek };
const runId = 'a1234567-1234-4123-8123-123456789abc', otherRun = 'b1234567-1234-4123-8123-123456789abc';
const proof = driveRaceProof().proof;
const elapsedMs = Math.round(proof.samples.at(-1)[0] / 120 * 1000);
const body = () => ({ runId, proof: structuredClone(proof) });
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function memory(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
}
const client = (storage, fetcher, extra = {}) => createLeaderboardClient({ storage, fetcher, random: webcrypto, ...extra });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const row = (time = elapsedMs) => ({ driverCode: '車手-123456789ABC', elapsedMs: time, position: 1, vehicleId: 'owned-hatch' });
const board = (filter = {}, entries = [row()]) => ({ version: 1, raceId: 'first-sprint', ...filter, totalDrivers: entries.length, entries });
const mine = (filter = {}) => ({ version: 1, ...filter, driverCode: '車手-123456789ABC',
  entries: [{ ...row(), raceId: 'first-sprint', runId }] });
const publication = (week = weekId) => {
  const entry = { ...row(), raceId: 'first-sprint', runId };
  return { recorded: true, duplicate: false, improved: true, driverCode: entry.driverCode, entry,
    weekly: { weekId: week, improved: true, entry: { ...entry } } };
};
const calendar = serverNow => {
  const period = racingCalendar(serverNow);
  return { version: 1, serverNow, ...period, dailyChallenge: dailyChallenge(period.dayId) };
};

test('all-time, current-week and prior-week reads have separate cache/inflight keys without creating an identity', async () => {
  const storage = memory({ 'hedo-gta-v1': 'local-progress' }), calls = [], gates = new Map();
  let clock = 1000;
  const api = client(storage, async (url, options) => {
    const query = new URL(url, 'https://hodo.bvivify.com').searchParams;
    const key = query.get('weekId') || 'alltime'; calls.push(key);
    assert.equal(query.get('scope'), key === 'alltime' ? null : 'weekly');
    assert.equal(options.headers.Authorization, undefined);
    const gate = gates.get(key); if (gate) await gate.promise;
    return reply(board(key === 'alltime' ? {} : { scope: 'weekly', weekId: key }, [row(key === 'alltime' ? 6000 : key === weekId ? 7000 : 8000)]));
  }, { now: () => clock });
  for (const key of ['alltime', weekId, priorWeek]) gates.set(key, deferred());
  const all = api.board('first-sprint'), current = api.board('first-sprint', weekly), currentShared = api.board('first-sprint', weekly);
  const previous = api.board('first-sprint', prior);
  assert.deepEqual(calls, ['alltime', weekId, priorWeek]);
  for (const gate of gates.values()) gate.resolve();
  assert.equal((await all).entries[0].elapsedMs, 6000);
  assert.equal((await current).entries[0].elapsedMs, 7000); assert.deepEqual(await currentShared, await current);
  assert.equal((await previous).entries[0].elapsedMs, 8000);
  await api.board('first-sprint'); await api.board('first-sprint', weekly); await api.board('first-sprint', prior);
  assert.equal(calls.length, 3);
  await api.board('first-sprint', { ...weekly, refresh: true }); assert.equal(calls.length, 4);
  clock += 60001;
  await api.board('first-sprint', prior); assert.equal(calls.length, 5);
  assert.deepEqual(await api.mine(weekly), { version: 1, ...weekly, driverCode: null, entries: [] });
  assert.equal(storage.getItem(IDENTITY_KEY), null); assert.equal(storage.getItem(RANKING_PENDING_KEY), null);
  assert.equal(storage.getItem('hedo-gta-v1'), 'local-progress');
});

test('invalid period options never issue a board, mine or withdrawal request', async () => {
  const storage = memory({ [IDENTITY_KEY]: token }); let calls = 0;
  const api = client(storage, async () => { calls += 1; throw new Error('must not send'); });
  for (const filter of [{ scope: 'daily', weekId }, { scope: 'weekly' }, { scope: 'weekly', weekId: '2026-10-25' },
    { scope: 'weekly', weekId: '2026-02-30' }, { scope: 'alltime', weekId }, { weekId }]) {
    await assert.rejects(api.board('first-sprint', filter), /有效的每週賽季/);
    await assert.rejects(api.mine(filter), /有效的每週賽季/);
    await assert.rejects(api.withdraw('first-sprint', filter), /有效的每週賽季/);
  }
  assert.equal(calls, 0);
});

test('weekly withdrawal targets only its selected server period and preserves all-time, prior-week and local progress', async () => {
  const storage = memory({ [IDENTITY_KEY]: token, 'hedo-gta-v1': 'daily-claimed-and-tuned', 'hedo-life-v3': 'career' });
  const visible = new Map([['alltime', true], [weekId, true], [priorWeek, true]]), deletes = [];
  const api = client(storage, async (url, options) => {
    assert.equal(options.headers.Authorization, options.method === 'DELETE' ? `Bearer ${token}` : undefined);
    const query = new URL(url, 'https://hodo.bvivify.com').searchParams;
    const key = query.get('weekId') || 'alltime', filter = key === 'alltime' ? {} : { scope: 'weekly', weekId: key };
    if (options.method === 'DELETE') {
      assert.equal(query.get('scope'), 'weekly'); deletes.push(key); visible.set(key, false);
      return reply({ raceId: 'first-sprint', removed: true, ...filter });
    }
    return reply(board(filter, visible.get(key) ? [row()] : []));
  });
  await api.board('first-sprint'); await api.board('first-sprint', weekly); await api.board('first-sprint', prior);
  assert.deepEqual(await api.withdraw('first-sprint', weekly), { raceId: 'first-sprint', removed: true, ...weekly });
  assert.deepEqual(deletes, [weekId]); assert.equal((await api.board('first-sprint', weekly)).entries.length, 0);
  assert.equal((await api.board('first-sprint')).entries.length, 1); assert.equal((await api.board('first-sprint', prior)).entries.length, 1);
  assert.equal(storage.getItem('hedo-gta-v1'), 'daily-claimed-and-tuned'); assert.equal(storage.getItem('hedo-life-v3'), 'career');
  assert.equal(storage.getItem(IDENTITY_KEY), token);
});

test('publication invalidates each period revision and late pre-publication GETs cannot replace the new cache', async () => {
  const storage = memory({ [IDENTITY_KEY]: token }), old = new Map(), current = new Map(), counts = new Map();
  for (const key of ['alltime', weekId, priorWeek]) { old.set(key, deferred()); current.set(key, deferred()); }
  const api = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    if (options.method === 'POST') return reply(publication());
    const query = new URL(url, 'https://hodo.bvivify.com').searchParams;
    const key = query.get('weekId') || 'alltime', filter = key === 'alltime' ? {} : { scope: 'weekly', weekId: key };
    const count = (counts.get(key) || 0) + 1; counts.set(key, count);
    await (count === 1 ? old.get(key) : current.get(key)).promise;
    return reply(board(filter, count === 1 ? [] : [row()]));
  });
  const options = [{}, weekly, prior], keys = ['alltime', weekId, priorWeek];
  const older = options.map(filter => api.board('first-sprint', filter));
  await api.submit(body());
  const newer = options.map(filter => api.board('first-sprint', { ...filter, refresh: true }));
  for (const key of keys) { assert.equal(counts.get(key), 2); old.get(key).resolve(); }
  for (const request of older) assert.equal((await request).entries.length, 0);
  const shared = options.map(filter => api.board('first-sprint', { ...filter, refresh: true }));
  for (const key of keys) { assert.equal(counts.get(key), 2); current.get(key).resolve(); }
  for (const request of [...newer, ...shared]) assert.equal((await request).entries.length, 1);
  for (const filter of options) assert.equal((await api.board('first-sprint', filter)).entries.length, 1);
  for (const key of keys) assert.equal(counts.get(key), 2);
});

test('a late weekly GET cannot restore a withdrawn listing after the empty refresh', async () => {
  const storage = memory({ [IDENTITY_KEY]: token }), gate = deferred(); let reads = 0;
  const api = client(storage, async (url, options) => {
    if (options.method === 'DELETE') return reply({ raceId: 'first-sprint', removed: true, ...weekly });
    reads += 1;
    if (reads === 1) { await gate.promise; return reply(board(weekly)); }
    return reply(board(weekly, []));
  });
  const oldRead = api.board('first-sprint', weekly);
  await api.withdraw('first-sprint', weekly);
  assert.equal((await api.board('first-sprint', { ...weekly, refresh: true })).entries.length, 0);
  gate.resolve(); assert.equal((await oldRead).entries.length, 1);
  assert.equal((await api.board('first-sprint', weekly)).entries.length, 0); assert.equal(reads, 2);
});

test('board, private records and withdrawal reject wrong-week or wrong-scope responses', async () => {
  for (const [requested, returned] of [[weekly, prior], [weekly, {}], [weekly, { scope: 'alltime', weekId }], [{}, weekly]]) {
    const storage = memory({ [IDENTITY_KEY]: token });
    const api = client(storage, async (url, options) => options.method === 'DELETE'
      ? reply({ raceId: 'first-sprint', removed: true, ...returned })
      : reply(url.includes('/mine') ? mine(returned) : board(returned)));
    await assert.rejects(api.board('first-sprint', requested), /排行榜回覆不完整/);
    await assert.rejects(api.mine(requested), /個人上榜紀錄尚未取得完整/);
    await assert.rejects(api.withdraw('first-sprint', requested), /撤榜狀態尚未確認/);
  }
});

test('malformed weekly receipts preserve the exact pending proof instead of falsely acknowledging publication', async () => {
  const corruptions = [weekly => { weekly.weekId = '2026-10-25'; }, weekly => { weekly.improved = 1; },
    weekly => { weekly.entry.runId = otherRun; }, weekly => { weekly.entry.elapsedMs += 1; },
    weekly => { weekly.entry.vehicleId = 'owned-sedan'; }, weekly => { weekly.entry.driverCode = '車手-OTHER'; },
    weekly => { weekly.entry.raceId = 'block-sprint'; }, weekly => { delete weekly.entry; }];
  for (const corrupt of corruptions) {
    const storage = memory({ [IDENTITY_KEY]: token }); let submitted;
    const api = client(storage, async (url, options) => {
      if (url === '/api/player') return reply({ ok: true });
      submitted = options.body; const response = publication(); corrupt(response.weekly); return reply(response);
    });
    await assert.rejects(api.submit(body()), /每週成績收據尚未核對/);
    assert.equal(JSON.stringify(JSON.parse(storage.getItem(RANKING_PENDING_KEY)).body), submitted);
    assert.equal((await api.pending()).runId, runId);
  }
});

test('a retry can acknowledge its original earlier week without relabeling it as the new current week', async () => {
  const storage = memory({ [IDENTITY_KEY]: token }); let sends = 0, original;
  const api = client(storage, async (url, options) => {
    if (url === '/api/player') return reply({ ok: true });
    sends += 1;
    if (sends === 1) { original = options.body; throw new TypeError('response lost after commit'); }
    assert.equal(options.body, original);
    const result = publication(priorWeek); result.duplicate = true; result.weekly.improved = false; return reply(result);
  }, { now: () => Date.parse(`${nextWeek}T04:00:00Z`) });
  await assert.rejects(api.submit(body()), /暫時無法連上/);
  const result = await api.retry();
  assert.equal(result.weekly.weekId, priorWeek); assert.equal(result.weekly.improved, false); assert.equal(result.duplicate, true);
  assert.equal(storage.getItem(RANKING_PENDING_KEY), null); assert.equal(sends, 2);
});

test('calendar reads coalesce, cache their original receivedAt, expire, and create no identity or local writes', async () => {
  const storage = memory({ 'hedo-gta-v1': 'claimed-daily' }), gate = deferred();
  let clock = 1000, calls = 0, serverNow = Date.parse('2026-10-25T04:00:00Z');
  const api = client(storage, async (url, options) => {
    calls += 1; assert.equal(url, '/api/gta/calendar'); assert.equal(options.method, 'GET');
    assert.equal(options.headers.Authorization, undefined); await gate.promise; return reply(calendar(serverNow));
  }, { now: () => clock });
  const first = api.calendar(), shared = api.calendar({ refresh: true });
  assert.equal(calls, 1); clock = 1200; gate.resolve();
  const firstResult = await first;
  assert.deepEqual(await shared, firstResult); assert.equal(firstResult.receivedAt, 1200);
  clock = 2000;
  const cached = await api.calendar(); assert.equal(cached.receivedAt, 1200); assert.equal(cached.serverNow, serverNow); assert.equal(calls, 1);
  cached.dailyChallenge.reward = 9999; cached.dayId = 'bad';
  assert.equal((await api.calendar()).dailyChallenge.reward, 180); assert.equal((await api.calendar()).dayId, '2026-10-25');
  clock = 61201; serverNow += 60001;
  const refreshed = await api.calendar(); assert.equal(calls, 2); assert.equal(refreshed.receivedAt, clock); assert.equal(refreshed.serverNow, serverNow);
  assert.equal(storage.getItem(IDENTITY_KEY), null); assert.equal(storage.getItem(RANKING_PENDING_KEY), null); assert.equal(storage.values.size, 1);
  assert.equal(storage.getItem('hedo-gta-v1'), 'claimed-daily');
});

test('invalid server calendar or challenge metadata is rejected without poisoning later valid reads', async () => {
  const serverNow = Date.parse('2026-10-25T04:00:00Z');
  const corruptions = [data => { data.version = 2; }, data => { data.serverNow = String(serverNow); },
    data => { data.dayId = '2026-10-26'; }, data => { data.weekId = nextWeek; }, data => { data.previousWeekId = weekId; },
    data => { data.dayEndsAt += 1; }, data => { data.weekStartsAt += 1; }, data => { data.weekEndsAt += 1; },
    data => { data.dailyChallenge.targetMs = 1; }, data => { data.dailyChallenge.reward = 9999; },
    data => { data.dailyChallenge.raceId = 'city-loop'; }, data => { data.dailyChallenge.startsAt += 1; },
    data => { data.dailyChallenge.title = '偽造挑戰'; }, data => { delete data.dailyChallenge; }];
  for (const corrupt of corruptions) {
    let calls = 0;
    const api = client(memory(), async () => {
      calls += 1; const data = calendar(serverNow); if (calls === 1) corrupt(data); return reply(data);
    }, { now: () => 1000 });
    await assert.rejects(api.calendar(), /賽季時間尚未核對/);
    assert.equal((await api.calendar()).dayId, '2026-10-25'); assert.equal(calls, 2);
  }
  let offline = false;
  const api = client(memory(), async () => { if (offline) throw new TypeError('offline'); return reply(calendar(serverNow)); }, { now: () => 1000 });
  const known = await api.calendar(); offline = true;
  await assert.rejects(api.calendar({ refresh: true }), /暫時無法連上/);
  assert.deepEqual(await api.calendar(), known, 'a failed forced refresh keeps the last validated cache rather than replacing it with invalid data');
});
