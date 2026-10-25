import test from 'node:test';
import assert from 'node:assert/strict';
import { racingCalendar, dailyChallenge, validDayId, validWeekId, RACING_DAY_MS } from '../dist/gta/racing-calendar.js';
import { deriveDailyChallenge } from '../dist/gta/daily-challenges.js';
import { claimDailyReward, GARAGE_RULES } from '../dist/gta/garage.js';
import { sanitizeProgress, saveProgress, loadProgress, STORAGE_KEY } from '../dist/gta/progress.js';
import { RACE_CATALOG } from '../dist/gta/racing-catalog.js';
import { startRace, stepRace, settleRace } from '../dist/gta/racing.js';
import { deriveRacingRecords } from '../dist/gta/racing-records.js';
import { createOwnedVehicle } from '../dist/gta/ownership.js';
import { createVehicle, stepVehicle } from '../dist/gta/driving.js';

const day = '2026-10-25', nextDay = '2026-10-26';
const buy = { id: 'buy', kind: 'purchase', vehicleId: 'owned-hatch', missionCount: 0 };
const replay = (ledger, extra = {}) => sanitizeProgress({ version: 6, completed: [], ledger, ...extra });
const receipt = (id, dailyDay = day, elapsedMs = 9000, raceId = 'first-sprint', rank = 1) => {
  const race = RACE_CATALOG.find(item => item.id === raceId);
  let travelled = 0;
  const checkpointTimes = race.route.slice(1).map((point, index) => {
    travelled += Math.hypot(point.x - race.route[index].x, point.z - race.route[index].z);
    return Math.round(elapsedMs * travelled / race.distance);
  });
  return { id, kind: rank <= race.maxRank ? 'race' : 'race-finish', raceId, elapsedMs, rank, checkpointTimes,
    vehicleId: 'owned-hatch', missionCount: 0, ...(dailyDay ? { dailyDay } : {}) };
};
const rewardReceipt = (id, dayId, earnedRunId, extra = {}) => ({ id, kind: 'daily-reward', dayId, earnedRunId,
  vehicleId: 'owned-hatch', missionCount: 0, ...extra });
const terminal = record => ({ phase: record.kind === 'race' ? 'finished' : 'failed', runId: record.id,
  raceId: record.raceId, vehicleId: record.vehicleId, elapsed: record.elapsedMs / 1000,
  rank: record.rank, checkpointTimes: [...record.checkpointTimes], dailyDay: record.dailyDay,
  result: { success: record.kind === 'race', reason: record.kind === 'race' ? 'finished' : 'lost', receipt: record } });
const context = car => ({ player: car, vehicle: car, controlledId: car.id, walking: false,
  wantedLevel: 0, transition: null, dead: false, busted: false, traffic: [], pedestrians: [] });
function driveFirstSprint(startDay = day, hz = 60) {
  const progress = replay([buy]), car = createOwnedVehicle(progress, 'owned-hatch', { x: -30, z: 60, heading: Math.PI / 2 });
  let actor = createVehicle(car), state = startRace(progress, 'first-sprint', `actual-${hz}`, { ...context(car), dailyDay: startDay }).state;
  for (let n = 0; n < hz * 30 && ['countdown', 'racing'].includes(state.phase); n += 1) {
    if (state.phase === 'racing') actor = stepVehicle(actor, { throttle: 1, tuning: car.upgrades }, 1 / hz);
    state = stepRace(state, context({ ...car, ...actor }), 1 / hz);
  }
  return { progress, state };
}

test('Taiwan midnight and Monday boundaries are exact and independent of host timezone', () => {
  const before = racingCalendar(Date.parse('2026-10-25T15:59:59.999Z'));
  assert.deepEqual(before, { dayId: day, weekId: '2026-10-19', previousWeekId: '2026-10-12',
    dayStartsAt: Date.parse('2026-10-24T16:00:00Z'), dayEndsAt: Date.parse('2026-10-25T16:00:00Z'),
    weekStartsAt: Date.parse('2026-10-18T16:00:00Z'), weekEndsAt: Date.parse('2026-10-25T16:00:00Z') });
  const after = racingCalendar(before.dayEndsAt);
  assert.equal(after.dayId, nextDay); assert.equal(after.weekId, nextDay); assert.equal(after.previousWeekId, before.weekId);
  assert.equal(after.dayEndsAt - after.dayStartsAt, RACING_DAY_MS);
  assert.equal(after.weekEndsAt - after.weekStartsAt, 7 * RACING_DAY_MS);
  assert.deepEqual(racingCalendar(Date.parse('2026-10-26T00:00:00+08:00')), after);
  assert.equal(racingCalendar(Date.parse('2026-10-25T00:00:00-08:00')).dayId, day);
});

test('calendar handles leap days, year-crossing weeks, valid Mondays, and rejects malformed dates', () => {
  assert.equal(racingCalendar(Date.parse('2024-02-28T16:00:00Z')).dayId, '2024-02-29');
  assert.equal(racingCalendar(Date.parse('2024-02-29T16:00:00Z')).dayId, '2024-03-01');
  const year = racingCalendar(Date.parse('2025-12-31T16:00:00Z'));
  assert.equal(year.dayId, '2026-01-01'); assert.equal(year.weekId, '2025-12-29'); assert.equal(year.previousWeekId, '2025-12-22');
  assert.equal(validWeekId('2025-12-29'), true); assert.equal(validWeekId('2026-01-01'), false);
  for (const invalid of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-01-00', '2026-1-01',
    '2026-10-25T00:00:00Z', '__proto__', '', null, undefined, 20261025]) {
    assert.equal(validDayId(invalid), false, String(invalid)); assert.equal(dailyChallenge(invalid), null);
  }
  for (const invalid of [NaN, Infinity, -Infinity, '2026-10-25', null, undefined, 9e15, -9e15]) assert.equal(racingCalendar(invalid), null);
  for (const valid of ['2000-02-29', '2024-02-29', '2026-10-25', '0099-01-01']) assert.equal(validDayId(valid), true);
});

test('seven daily targets rotate by weekday with immutable catalog prizes and matching bounds', () => {
  const expected = [['first-sprint', 10000, 180], ['block-sprint', 45000, 220], ['first-sprint', 9000, 200],
    ['city-loop', 85000, 280], ['block-sprint', 40000, 240], ['first-sprint', 8000, 240], ['city-loop', 75000, 320]];
  for (let index = 0; index < 7; index += 1) {
    const calendar = racingCalendar(Date.parse('2026-10-25T04:00:00Z') + index * RACING_DAY_MS);
    const challenge = dailyChallenge(calendar.dayId);
    assert.deepEqual([challenge.raceId, challenge.targetMs, challenge.reward], expected[index]);
    assert.equal(challenge.startsAt, calendar.dayStartsAt); assert.equal(challenge.endsAt, calendar.dayEndsAt);
    challenge.reward = 999999;
    assert.equal(dailyChallenge(calendar.dayId).reward, expected[index][2]);
  }
});

test('real driving keeps the captured day through finish and pays daily cash once, without changing race cash', () => {
  const elapsed = [];
  for (const hz of [30, 60, 120]) {
    const { progress, state } = driveFirstSprint(day, hz);
    assert.equal(state.phase, 'finished'); assert.equal(state.dailyDay, day);
    const settled = settleRace(progress, state, { dayId: day });
    assert.equal(settled.ok, true); assert.equal(settled.reward, 140); assert.equal(settled.progress.ledger.at(-1).dailyDay, day);
    const daily = deriveDailyChallenge(settled.progress, day);
    assert.equal(daily.claimable, true); assert.equal(daily.claimed, false); assert.equal(daily.finishCount, 1);
    assert.equal(daily.best.elapsedMs, Math.round(state.elapsed * 1000)); elapsed.push(daily.best.elapsedMs);
    const claimed = claimDailyReward(settled.progress, day);
    assert.equal(claimed.ok, true); assert.equal(claimed.reward, 180); assert.equal(claimed.progress.money, progress.money + 140 + 180);
    const repeated = claimDailyReward(claimed.progress, day);
    assert.equal(repeated.reward, 0); assert.equal(repeated.reason, 'already-claimed'); assert.deepEqual(repeated.progress, claimed.progress);
    assert.equal(deriveDailyChallenge(claimed.progress, day).claimed, true);
  }
  assert.equal(new Set(elapsed).size, 1);
});

test('cross-midnight or missing/invalid start day preserves normal results but cannot pay either daily challenge', () => {
  const { progress, state } = driveFirstSprint();
  for (const [startDay, finishDay] of [[day, nextDay], [day, undefined], [null, day], ['2026-02-30', day]]) {
    const result = settleRace(progress, { ...state, dailyDay: startDay }, { dayId: finishDay });
    assert.equal(result.ok, true); assert.equal(result.reward, 140); assert.equal(Object.hasOwn(result.progress.ledger.at(-1), 'dailyDay'), false);
    assert.equal(deriveRacingRecords(result.progress).byRace['first-sprint'].best.elapsedMs, Math.round(state.elapsed * 1000));
    assert.equal(claimDailyReward(result.progress, day).reward, 0); assert.equal(claimDailyReward(result.progress, nextDay).reward, 0);
  }
  const car = createOwnedVehicle(progress, 'owned-hatch', { x: -30, z: 60, heading: Math.PI / 2 });
  assert.equal(startRace(progress, 'first-sprint', 'no-day', { ...context(car), dailyDay: 'bad' }).state.dailyDay, null);
});

test('daily best retains earliest ties, threshold qualifies exactly, and other courses/days do not count', () => {
  let progress = replay([buy, receipt('slow', day, 10001), receipt('other-course', day, 45000, 'block-sprint'),
    receipt('yesterday', '2026-10-24', 7000)]);
  assert.equal(deriveDailyChallenge(progress, day).finishCount, 1);
  assert.equal(deriveDailyChallenge(progress, day).best.elapsedMs, 10001);
  assert.equal(claimDailyReward(progress, day).reason, 'not-qualified');
  progress = replay([...progress.ledger, receipt('limit', day, 10000), receipt('faster', day, 8000), receipt('tie', day, 8000), receipt('slower', day, 9000)]);
  const daily = deriveDailyChallenge(progress, day);
  assert.equal(daily.best.id, 'faster'); assert.equal(daily.qualifyingRun.id, 'limit'); assert.equal(daily.finishCount, 5);
  daily.best.checkpointTimes[0] = -1;
  assert.ok(deriveDailyChallenge(progress, day).best.checkpointTimes[0] > 0);
  const claimed = claimDailyReward(progress, day);
  assert.equal(claimed.earnedRunId, 'limit'); assert.equal(claimed.reward, 180);
  assert.equal(deriveDailyChallenge(claimed.progress, nextDay).best, null);
  const monday = settleRace(claimed.progress, terminal(receipt('monday', nextDay, 44000, 'block-sprint', 3)), { dayId: nextDay });
  assert.equal(monday.ok, true); assert.equal(monday.reward, 0, 'a legal non-podium finish still counts toward a time-only daily target');
  const second = claimDailyReward(monday.progress, nextDay);
  assert.equal(second.reward, 220); assert.equal(deriveDailyChallenge(second.progress, day).claimed, true);
  assert.equal(deriveDailyChallenge(second.progress, nextDay).claimed, true);
});

test('daily reward replay requires its preceding exact day/source/car, ignores arbitrary cash and rejects duplicates', () => {
  const run = receipt('finish'), award = rewardReceipt('claim', day, 'finish'), prefix = [buy, run];
  const valid = replay([...prefix, award]);
  assert.equal(valid.money, 570);
  for (const invalid of [rewardReceipt('x', nextDay, 'finish'), rewardReceipt('x', day, 'other'),
    rewardReceipt('x', '2026-02-30', 'finish'), rewardReceipt('x', day, 'finish', { vehicleId: 'owned-sedan' })]) {
    assert.deepEqual(replay([...prefix, invalid, award]).ledger, prefix);
  }
  assert.deepEqual(replay([buy, award, run]).ledger, [buy]);
  assert.deepEqual(replay([...prefix, award, { ...award, id: 'again' }, receipt('later')]).ledger, [...prefix, award]);
  assert.equal(replay([...prefix, { ...award, reward: 999999, money: 999999 }]).money, valid.money);
  assert.deepEqual(replay([buy, { ...run, dailyDay: '2026-02-30' }, award]).ledger, [buy]);
  const slow = receipt('slow', day, 10001);
  assert.deepEqual(replay([buy, slow, rewardReceipt('claim-slow', day, 'slow')]).ledger, [buy, slow]);
});

test('v1-v5 migration keeps prior cash/cars/achievements, strips backdated daily annotations and cached daily flags', () => {
  const run = receipt('finish'), award = rewardReceipt('claim', day, 'finish');
  for (const version of [1, 2, 3, 4, 5]) {
    const old = sanitizeProgress({ version, completed: [], ledger: [buy, run, award], money: 999999,
      daily: { claimed: true, dayId: day, reward: 999999 }, ownedVehicleHealth: { 'owned-hatch': 37 }, selectedOwnedId: 'owned-hatch' });
    assert.equal(old.version, 6); assert.equal(old.money, version < 3 ? 500 : version === 3 ? 250 : 390);
    assert.equal(old.ledger.length, version < 3 ? 0 : version === 3 ? 1 : 2);
    assert.equal(old.ledger.some(entry => Object.hasOwn(entry, 'dailyDay')), false);
    assert.equal(deriveDailyChallenge(old, day).claimable, false);
    assert.equal(claimDailyReward(old, day).reward, 0);
    if (version >= 3) { assert.equal(old.ownedVehicleHealth['owned-hatch'], 37); assert.equal(old.selectedOwnedId, 'owned-hatch'); }
  }
  const achievement = { id: 'achievement', kind: 'achievement', achievementId: 'first-finish', earnedRunId: 'finish', vehicleId: 'owned-hatch', missionCount: 0 };
  const old = sanitizeProgress({ version: 5, completed: [], ledger: [buy, run, achievement] });
  assert.equal(old.money, 470); assert.equal(old.ledger.length, 3); assert.equal(deriveDailyChallenge(old, day).best, null);
  assert.equal(deriveRacingRecords(old).achievements.find(item => item.id === 'first-finish').claimed, true);
});

test('daily rewards cannot finance earlier purchases, obey the ledger bound, and avoid transaction ID collisions', () => {
  const upgrade = id => ({ id, kind: 'upgrade', value: 'engine', vehicleId: 'owned-hatch', missionCount: 0 });
  const run = receipt('finish'), award = rewardReceipt('claim', day, 'finish');
  const tooEarly = replay([buy, upgrade('engine-1'), upgrade('engine-2'), run, award]);
  assert.equal(tooEarly.ledger.length, 2); assert.equal(tooEarly.money, 70);
  const funded = replay([buy, upgrade('engine-1'), run, award, upgrade('engine-2')]);
  assert.equal(funded.ledger.length, 5); assert.equal(funded.money, 70); assert.equal(funded.customizations['owned-hatch'].upgrades.engine, 2);
  const entries = [buy, receipt(`daily-${day}`), ...Array.from({ length: GARAGE_RULES.maxLedger - 3 }, (_, n) => receipt(`run-${n}`, null))];
  const nearFull = replay(entries), claimed = claimDailyReward(nearFull, day);
  assert.equal(nearFull.ledger.length, 255); assert.equal(claimed.reward, 180); assert.equal(claimed.progress.ledger.length, 256);
  assert.equal(claimed.progress.ledger.at(-1).id, `daily-${day}-1`);
  const full = replay([...entries, receipt('last')]);
  const blocked = claimDailyReward(full, day);
  assert.equal(blocked.ok, false); assert.equal(blocked.reason, 'ledger-full'); assert.equal(blocked.reward, 0); assert.deepEqual(blocked.progress, full);
});

test('save/reload preserves claimed days, local tuning and health without persisting derived daily caches', () => {
  const progress = claimDailyReward(replay([buy, receipt('finish')], { selectedOwnedId: 'owned-hatch', ownedVehicleHealth: { 'owned-hatch': 37 } }), day).progress;
  const data = new Map([['hedo-life-v3', 'untouched'], ['hedo-anonymous-v1', 'untouched']]);
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  assert.equal(saveProgress(storage, { ...progress, dailyChallenge: { claimed: false, money: 999999 } }), true);
  assert.deepEqual(loadProgress(storage), progress); assert.equal(loadProgress(storage).ownedVehicleHealth['owned-hatch'], 37);
  assert.equal(data.get('hedo-life-v3'), 'untouched'); assert.equal(data.get('hedo-anonymous-v1'), 'untouched');
  assert.equal(data.get(STORAGE_KEY).includes('dailyChallenge'), false);
  assert.equal(claimDailyReward(loadProgress(storage), day).reward, 0);
  assert.equal(deriveDailyChallenge(loadProgress(storage), nextDay).claimed, false);
});
