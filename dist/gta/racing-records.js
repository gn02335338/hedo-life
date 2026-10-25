import { RACE_CATALOG, validRaceCompletion } from './racing-catalog.js';

export const RACING_RECORD_LIMITS = Object.freeze({ ledger: 256, recentPerRace: 8, achievements: 8 });
export const RACE_ACHIEVEMENTS = Object.freeze([
  { id: 'first-finish', name: '街頭初登場', description: '首次完成一場有效賽事。', reward: 80, target: 1 },
  { id: 'street-winner', name: '甩開對手', description: '在街區短途賽或環城挑戰賽獲得第一名。', reward: 120, target: 1 },
  { id: 'five-finishes', name: '街頭熟面孔', description: '累計完成 5 場有效賽事。', reward: 150, target: 5 },
  { id: 'ten-finishes', name: '夜路常勝軍', description: '累計完成 10 場有效賽事。', reward: 250, target: 10 },
  { id: 'all-routes', name: '跑遍禾多', description: '完成全部 3 條賽道。', reward: 220, target: 3 },
  { id: 'personal-best', name: '超越昨天', description: '在同一賽道突破自己的既有最佳時間。', reward: 100, target: 1 },
  { id: 'eight-second-sprint', name: '八秒俱樂部', description: '在 8 秒內完成首發直線計時。', reward: 180, target: 8000 },
  { id: 'all-gold', name: '禾多全冠王', description: '在全部 3 條賽道各獲得一次第一名。', reward: 300, target: 3 },
].map(Object.freeze));
const achievementCatalog = new Map(RACE_ACHIEVEMENTS.map(item => [item.id, item]));
const baseUpgrades = () => ({ engine: 0, brakes: 0, handling: 0 });
const copyRun = run => run ? { ...run, checkpointTimes: [...run.checkpointTimes], upgrades: { ...run.upgrades } } : null;

// This projection is ephemeral. Storage persists bounded receipts, never cached
// records, counters, achievement flags or arbitrary reward amounts.
export function createRacingFacts() {
  return { byRace: Object.fromEntries(RACE_CATALOG.map(race => [race.id,
    { best: null, recent: [], finishCount: 0, winCount: 0, pbCount: 0 }])),
  stats: { finishCount: 0, winCount: 0, streetWinCount: 0, pbCount: 0, completedRaceCount: 0, wonRaceCount: 0 },
  unlockedBy: {} };
}
function achievementProgress(id, facts) {
  const stats = facts.stats;
  switch (id) {
    case 'first-finish': case 'five-finishes': case 'ten-finishes': return stats.finishCount;
    case 'street-winner': return stats.streetWinCount;
    case 'all-routes': return stats.completedRaceCount;
    case 'personal-best': return stats.pbCount;
    case 'eight-second-sprint': return facts.byRace['first-sprint'].best?.elapsedMs ?? null;
    case 'all-gold': return stats.wonRaceCount;
    default: return null;
  }
}
export function achievementUnlocked(id, facts) {
  const definition = achievementCatalog.get(id), progress = achievementProgress(id, facts);
  return Boolean(definition && progress !== null && (id === 'eight-second-sprint' ? progress <= definition.target : progress >= definition.target));
}
export function raceAchievement(id) { return achievementCatalog.get(id) || null; }

// Called once for each already-validated race receipt while replaying a ledger.
// Mutation is confined to this fresh, private projection; at most 3 x 8 recent
// runs and 8 unlock sources are retained regardless of play time.
export function appendRacingFact(facts, entry, upgrades = baseUpgrades()) {
  const records = facts.byRace[entry.raceId];
  if (!records || !validRaceCompletion(entry)) return false;
  const previous = records.best;
  const run = { id: entry.id, runId: entry.id, raceId: entry.raceId, vehicleId: entry.vehicleId,
    elapsedMs: entry.elapsedMs, rank: entry.rank, checkpointTimes: [...entry.checkpointTimes], upgrades: { ...upgrades } };
  if (previous && run.elapsedMs < previous.elapsedMs) { records.pbCount += 1; facts.stats.pbCount += 1; }
  if (!previous || run.elapsedMs < previous.elapsedMs) records.best = run;
  if (!records.finishCount) facts.stats.completedRaceCount += 1;
  records.finishCount += 1; facts.stats.finishCount += 1;
  if (run.rank === 1) {
    if (!records.winCount) facts.stats.wonRaceCount += 1;
    records.winCount += 1; facts.stats.winCount += 1;
    if (RACE_CATALOG.find(race => race.id === run.raceId).type === 'street') facts.stats.streetWinCount += 1;
  }
  records.recent.unshift(run);
  if (records.recent.length > RACING_RECORD_LIMITS.recentPerRace) records.recent.length = RACING_RECORD_LIMITS.recentPerRace;
  for (const achievement of RACE_ACHIEVEMENTS) {
    if (!facts.unlockedBy[achievement.id] && achievementUnlocked(achievement.id, facts)) {
      facts.unlockedBy[achievement.id] = { runId: run.id, vehicleId: run.vehicleId };
    }
  }
  return true;
}

// Call with sanitized progress, on menu open, start or settlement, not per frame.
export function deriveRacingRecords(progress) {
  const facts = createRacingFacts(), tuning = new Map(), claimed = new Set(), seen = new Set();
  const ledger = Array.isArray(progress?.ledger) ? progress.ledger.slice(0, RACING_RECORD_LIMITS.ledger) : [];
  for (const entry of ledger) {
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (entry.kind === 'upgrade' && ['engine', 'brakes', 'handling'].includes(entry.value)) {
      const upgrades = tuning.get(entry.vehicleId) || baseUpgrades();
      upgrades[entry.value] = Math.min(2, upgrades[entry.value] + 1); tuning.set(entry.vehicleId, upgrades);
    } else if (['race', 'race-finish'].includes(entry.kind)) appendRacingFact(facts, entry, tuning.get(entry.vehicleId));
    else if (entry.kind === 'achievement' && achievementUnlocked(entry.achievementId, facts)
      && facts.unlockedBy[entry.achievementId]?.runId === entry.earnedRunId) claimed.add(entry.achievementId);
  }
  const achievements = RACE_ACHIEVEMENTS.map(definition => ({ ...definition,
    progress: achievementProgress(definition.id, facts), unlocked: achievementUnlocked(definition.id, facts),
    claimed: claimed.has(definition.id), claimable: achievementUnlocked(definition.id, facts) && !claimed.has(definition.id),
    unlockedBy: facts.unlockedBy[definition.id]?.runId ?? null,
    vehicleId: facts.unlockedBy[definition.id]?.vehicleId ?? null }));
  return { ...facts, achievements, claimableReward: achievements.reduce((sum, item) => sum + (item.claimable ? item.reward : 0), 0),
    claimedReward: achievements.reduce((sum, item) => sum + (item.claimed ? item.reward : 0), 0) };
}

export function personalBestSnapshot(records, raceId) { return copyRun(records?.byRace?.[raceId]?.best); }
export function raceSplitComparison(state, best) {
  const index = Math.min(state?.checkpointTimes?.length || 0, best?.checkpointTimes?.length || 0) - 1;
  if (state?.raceId !== best?.raceId || index < 0) return null;
  const elapsedMs = state.checkpointTimes[index], bestMs = best.checkpointTimes[index];
  if (!Number.isInteger(elapsedMs) || !Number.isInteger(bestMs)) return null;
  return { index, elapsedMs, bestMs, deltaMs: elapsedMs - bestMs };
}
export function compareRaceResult(records, state) {
  const previousBest = personalBestSnapshot(records, state?.raceId);
  const completed = (state?.phase === 'finished' && state.result?.success || state?.phase === 'failed' && state.result?.reason === 'lost')
    && validRaceCompletion(state?.result?.receipt);
  const elapsedMs = completed && Number.isFinite(state.elapsed) ? Math.round(state.elapsed * 1000) : null;
  return { previousBest, deltaMs: elapsedMs !== null && previousBest ? elapsedMs - previousBest.elapsedMs : null,
    isFirst: completed && !previousBest, isPersonalBest: completed && (!previousBest || elapsedMs < previousBest.elapsedMs),
    splitDeltas: completed && previousBest ? state.checkpointTimes.map((time, index) => time - previousBest.checkpointTimes[index]) : [] };
}
