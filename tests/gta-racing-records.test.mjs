import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeProgress, loadProgress, saveProgress, STORAGE_KEY } from '../dist/gta/progress.js';
import { GARAGE_RULES, claimRaceAchievements } from '../dist/gta/garage.js';
import { RACE_CATALOG, validRaceCompletion, validRaceReceipt } from '../dist/gta/racing-catalog.js';
import { settleRace } from '../dist/gta/racing.js';
import { deriveRacingRecords, personalBestSnapshot, raceSplitComparison, compareRaceResult, RACE_ACHIEVEMENTS } from '../dist/gta/racing-records.js';

const buy = { id: 'buy', kind: 'purchase', vehicleId: 'owned-hatch', missionCount: 0 };
const upgrade = (id, value = 'engine') => ({ id, kind: 'upgrade', vehicleId: 'owned-hatch', missionCount: 0, value });
const replay = (ledger, extra = {}) => sanitizeProgress({ version: 5, completed: [], ledger, ...extra });
const receipt = (id, raceId = 'first-sprint', elapsedMs = 9000, rank = 1) => {
  const race = RACE_CATALOG.find(item => item.id === raceId);
  let travelled = 0;
  const checkpointTimes = race.route.slice(1).map((point, index) => {
    travelled += Math.hypot(point.x - race.route[index].x, point.z - race.route[index].z);
    return Math.round(elapsedMs * travelled / race.distance);
  });
  return { id, kind: rank <= race.maxRank ? 'race' : 'race-finish', raceId, elapsedMs, rank, checkpointTimes,
    vehicleId: 'owned-hatch', missionCount: 0 };
};
const claim = (id, achievementId, earnedRunId, extras = {}) => ({ id, kind: 'achievement', achievementId, earnedRunId,
  vehicleId: 'owned-hatch', missionCount: 0, ...extras });
const terminal = record => ({ phase: record.kind === 'race' ? 'finished' : 'failed', runId: record.id,
  raceId: record.raceId, vehicleId: record.vehicleId, elapsed: record.elapsedMs / 1000,
  rank: record.rank, checkpointTimes: [...record.checkpointTimes],
  result: { success: record.kind === 'race', reason: record.kind === 'race' ? 'finished' : 'lost', receipt: record } });

test('local records retain the earliest tied PB, snapshot paid tuning at the run, and cap recent histories', () => {
  const ledger = [buy, receipt('first'), upgrade('engine'), receipt('better', 'first-sprint', 8000),
    receipt('tie', 'first-sprint', 8000), ...Array.from({ length: 12 }, (_, n) => receipt(`slow-${n}`, 'first-sprint', 10000 + n))];
  const progress = replay(ledger), before = structuredClone(progress), records = deriveRacingRecords(progress);
  const first = records.byRace['first-sprint'];
  assert.equal(first.best.id, 'better'); assert.equal(first.best.elapsedMs, 8000);
  assert.deepEqual(first.best.upgrades, { engine: 1, brakes: 0, handling: 0 });
  assert.equal(first.pbCount, 1); assert.equal(first.finishCount, 15); assert.equal(first.recent.length, 8);
  assert.equal(first.recent[0].id, 'slow-11'); assert.deepEqual(progress, before);
  const snapshot = personalBestSnapshot(records, 'first-sprint');
  snapshot.checkpointTimes[0] = -1; snapshot.upgrades.engine = 2;
  assert.ok(first.best.checkpointTimes[0] > 0); assert.equal(first.best.upgrades.engine, 1);
});

test('PB and split comparisons use a prior snapshot, report ties, and do not award cancelled or unfinished attempts', () => {
  const records = deriveRacingRecords(replay([buy, receipt('old')])), pb = personalBestSnapshot(records, 'first-sprint');
  const faster = terminal(receipt('new', 'first-sprint', 8000));
  assert.deepEqual(raceSplitComparison({ raceId: 'first-sprint', checkpointTimes: [1500] }, pb),
    { index: 0, elapsedMs: 1500, bestMs: 1800, deltaMs: -300 });
  assert.equal(raceSplitComparison({ raceId: 'first-sprint', checkpointTimes: [] }, pb), null);
  assert.equal(raceSplitComparison({ raceId: 'city-loop', checkpointTimes: [1500] }, pb), null);
  const comparison = compareRaceResult(records, faster);
  assert.equal(comparison.isPersonalBest, true); assert.equal(comparison.deltaMs, -1000); assert.equal(comparison.isFirst, false);
  assert.deepEqual(comparison.splitDeltas, [-200, -600, -1000]);
  const tie = compareRaceResult(records, terminal(receipt('tie')));
  assert.equal(tie.deltaMs, 0); assert.equal(tie.isPersonalBest, false);
  for (const phase of ['countdown', 'racing', 'cancelled']) {
    assert.equal(compareRaceResult(records, { ...faster, phase }).isPersonalBest, false);
  }
});

test('eight fixed achievements unlock from validated history and each fixed reward is paid once', () => {
  const records = [receipt('first', 'first-sprint', 9000), receipt('fast', 'first-sprint', 8000),
    receipt('block', 'block-sprint', 26000), receipt('city', 'city-loop', 48000),
    ...Array.from({ length: 6 }, (_, n) => receipt(`repeat-${n}`))];
  const progress = replay([buy, ...records]);
  const facts = deriveRacingRecords(progress);
  assert.equal(facts.achievements.length, 8); assert.ok(facts.achievements.every(item => item.unlocked && item.claimable && !item.claimed));
  const result = claimRaceAchievements(progress), reward = RACE_ACHIEVEMENTS.reduce((sum, item) => sum + item.reward, 0);
  assert.equal(result.ok, true); assert.equal(result.reward, reward); assert.equal(result.progress.money, progress.money + reward);
  assert.equal(result.unlocked.length, 8); assert.equal(result.progress.ledger.length, progress.ledger.length + 8);
  assert.equal(result.pendingCount, 0); assert.ok(deriveRacingRecords(result.progress).achievements.every(item => item.claimed && !item.claimable));
  const duplicate = claimRaceAchievements(result.progress);
  assert.equal(duplicate.reward, 0); assert.deepEqual(duplicate.progress, result.progress);
  assert.deepEqual(replay(result.progress.ledger), result.progress);
});

test('achievement boundaries distinguish first attempts, ties, time thresholds, podiums and street wins', () => {
  const unlocked = ledger => deriveRacingRecords(replay([buy, ...ledger])).achievements.filter(item => item.unlocked).map(item => item.id);
  assert.deepEqual(unlocked([receipt('slow', 'first-sprint', 8001)]), ['first-finish']);
  assert.deepEqual(unlocked([receipt('limit', 'first-sprint', 8000)]), ['first-finish', 'eight-second-sprint']);
  assert.deepEqual(unlocked([receipt('first'), receipt('tie')]), ['first-finish']);
  assert.ok(unlocked([receipt('first'), receipt('better', 'first-sprint', 8999)]).includes('personal-best'));
  assert.ok(!unlocked(Array.from({ length: 4 }, (_, n) => receipt(`r-${n}`))).includes('five-finishes'));
  assert.ok(unlocked(Array.from({ length: 5 }, (_, n) => receipt(`r-${n}`))).includes('five-finishes'));
  assert.ok(!unlocked([receipt('second', 'block-sprint', 45000, 2)]).includes('street-winner'));
  assert.ok(unlocked([receipt('first', 'block-sprint', 45000, 1)]).includes('street-winner'));
});

test('all legal non-prize finishes preserve their times and unlock completion goals without paying a race prize', () => {
  const progress = replay([buy]);
  for (const raceId of ['block-sprint', 'city-loop']) for (const rank of [2, 3]) {
    const record = receipt(`lost-${raceId}-${rank}`, raceId, raceId === 'block-sprint' ? 40000 : 70000, rank);
    assert.equal(validRaceCompletion(record), true);
    if (record.kind === 'race') continue;
    assert.equal(validRaceReceipt(record), false);
    const result = settleRace(progress, terminal(record));
    assert.equal(result.ok, true); assert.equal(result.reward, 0); assert.equal(result.progress.money, progress.money);
    assert.equal(result.progress.ledger.at(-1).kind, 'race-finish');
    const facts = deriveRacingRecords(result.progress);
    assert.equal(facts.byRace[raceId].best.elapsedMs, record.elapsedMs); assert.equal(facts.stats.winCount, 0);
    assert.equal(facts.achievements.find(item => item.id === 'first-finish').claimable, true);
    assert.equal(settleRace(result.progress, terminal(record)).reason, 'duplicate');
    assert.equal(compareRaceResult(deriveRacingRecords(progress), terminal(record)).isFirst, true);
  }
  const all = deriveRacingRecords(replay([buy, receipt('straight'), receipt('b', 'block-sprint', 40000, 3), receipt('c', 'city-loop', 70000, 3)]));
  assert.equal(all.achievements.find(item => item.id === 'all-routes').unlocked, true);
  assert.equal(all.achievements.find(item => item.id === 'all-gold').unlocked, false);
});

test('achievement receipts require the preceding exact qualifying run, cannot duplicate or borrow future income', () => {
  const race = receipt('finish'), award = claim('claim', 'first-finish', 'finish');
  const valid = replay([buy, race, award]);
  assert.equal(valid.money, 470);
  for (const invalid of [claim('x', 'unknown', 'finish'), claim('x', 'personal-best', 'finish'),
    claim('x', 'first-finish', 'other'), claim('x', 'first-finish', 'finish', { vehicleId: 'owned-sedan' })]) {
    assert.deepEqual(replay([buy, race, invalid, award]).ledger, [buy, race]);
  }
  assert.deepEqual(replay([buy, award, race]).ledger, [buy]);
  assert.deepEqual(replay([buy, race, award, { ...award, id: 'again' }, receipt('next')]).ledger, [buy, race, award]);
  const before = replay([buy, upgrade('engine1'), upgrade('engine2'), race, award]);
  assert.equal(before.ledger.length, 2); assert.equal(before.money, 70);
  const after = replay([buy, upgrade('engine1'), race, award, upgrade('engine2')]);
  assert.equal(after.ledger.length, 4, '290 available cannot pay a 320 upgrade even with valid fixed achievement');
  const funded = replay([buy, upgrade('engine1'), receipt('eight', 'first-sprint', 8000),
    claim('a1', 'first-finish', 'eight'), claim('a2', 'eight-second-sprint', 'eight'), upgrade('engine2')]);
  assert.equal(funded.ledger.length, 6); assert.equal(funded.customizations['owned-hatch'].upgrades.engine, 2);
  assert.equal(funded.money, 150);
  assert.equal(replay([buy, race, { ...award, reward: 99999, money: 99999 }]).money, valid.money);
});

test('v1-v4 migration never backdates achievement money and rejects newer receipt kinds until v5', () => {
  const ledger = [buy, receipt('first', 'first-sprint', 8000)], award = claim('claim', 'first-finish', 'first');
  for (const version of [1, 2, 3, 4]) {
    const old = sanitizeProgress({ version, completed: [], ledger: [...ledger, award], money: 99999 });
    assert.equal(old.version, 6);
    assert.equal(old.money, version < 3 ? 500 : version === 3 ? 250 : 390);
    assert.equal(old.ledger.length, version < 3 ? 0 : version === 3 ? 1 : 2);
  }
  const imported = sanitizeProgress({ version: 4, completed: [], ledger });
  assert.equal(imported.money, 390); assert.equal(deriveRacingRecords(imported).claimableReward, 260);
  const claimed = claimRaceAchievements(imported);
  assert.equal(claimed.progress.money, 650); assert.equal(claimed.reward, 260);
  const loss = receipt('loss', 'block-sprint', 45000, 3);
  assert.equal(sanitizeProgress({ version: 4, completed: [], ledger: [buy, loss] }).ledger.length, 1);
  assert.equal(replay([buy, loss]).ledger.length, 2);
  assert.equal(replay([buy, { ...receipt('winner'), kind: 'race-finish' }]).ledger.length, 1);
});

test('claims are bounded, allow partial collection near capacity, and avoid colliding transaction IDs', () => {
  const ledger = [buy, receipt('achievement-first-finish', 'first-sprint', 8000),
    ...Array.from({ length: GARAGE_RULES.maxLedger - 3 }, (_, n) => receipt(`run-${n}`))];
  const progress = replay(ledger), result = claimRaceAchievements(progress);
  assert.equal(progress.ledger.length, 255); assert.equal(result.progress.ledger.length, 256);
  assert.equal(result.ok, true); assert.equal(result.reward, 80); assert.equal(result.pendingCount, 3);
  assert.equal(result.progress.ledger.at(-1).id, 'achievement-first-finish-1');
  const next = claimRaceAchievements(result.progress);
  assert.equal(next.ok, false); assert.equal(next.reason, 'ledger-full'); assert.equal(next.reward, 0);
  assert.deepEqual(next.progress, result.progress);
});

test('new receipts survive exact save/reload without persisting caches, altering health, or touching other game storage', () => {
  const initial = replay([buy, receipt('first', 'first-sprint', 8000)], { ownedVehicleHealth: { 'owned-hatch': 37 }, selectedOwnedId: 'owned-hatch' });
  const progress = claimRaceAchievements(initial).progress;
  const entries = new Map([['hedo-life-v3', 'untouched']]);
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  assert.equal(saveProgress(storage, { ...progress, raceRecords: { best: 1 }, achievements: ['all-gold'] }), true);
  assert.equal(entries.get('hedo-life-v3'), 'untouched');
  assert.deepEqual(loadProgress(storage), progress);
  assert.ok(!entries.get(STORAGE_KEY).includes('raceRecords'));
  assert.equal(loadProgress(storage).ownedVehicleHealth['owned-hatch'], 37);
  assert.equal(loadProgress(storage).selectedOwnedId, 'owned-hatch');
});
