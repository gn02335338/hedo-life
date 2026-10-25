import { dailyChallenge } from './racing-calendar.js';
import { validRaceCompletion } from './racing-catalog.js';

const copyRun = run => run ? { ...run, checkpointTimes: [...run.checkpointTimes] } : null;
const runFrom = entry => ({ id: entry.id, runId: entry.id, raceId: entry.raceId, vehicleId: entry.vehicleId,
  elapsedMs: entry.elapsedMs, rank: entry.rank, checkpointTimes: [...entry.checkpointTimes] });

// These helpers consume already-validated receipts during the garage replay.
// At most 256 ledger entries exist; no daily history is persisted separately.
export function createDailyFacts() { return new Map(); }
export function appendDailyFact(facts, entry) {
  const definition = dailyChallenge(entry?.dailyDay);
  if (!definition || definition.raceId !== entry.raceId || !validRaceCompletion(entry)) return false;
  const current = facts.get(definition.dayId) || { best: null, qualifyingRun: null, finishCount: 0 };
  const run = runFrom(entry);
  if (!current.best || run.elapsedMs < current.best.elapsedMs) current.best = run;
  if (!current.qualifyingRun && run.elapsedMs <= definition.targetMs) current.qualifyingRun = run;
  current.finishCount += 1;
  facts.set(definition.dayId, current);
  return true;
}
export function dailyClaimSource(facts, dayId) { return facts.get(dayId)?.qualifyingRun || null; }

// Use sanitized progress at menu/start/settlement boundaries, never per frame.
export function deriveDailyChallenge(progress, dayId) {
  const definition = dailyChallenge(dayId), facts = createDailyFacts(), claimedDays = new Set(), seen = new Set();
  const ledger = progress?.version >= 6 && Array.isArray(progress?.ledger) ? progress.ledger.slice(0, 256) : [];
  for (const entry of ledger) {
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (['race', 'race-finish'].includes(entry.kind)) appendDailyFact(facts, entry);
    else if (entry.kind === 'daily-reward') {
      const source = dailyClaimSource(facts, entry.dayId);
      if (source && source.runId === entry.earnedRunId && source.vehicleId === entry.vehicleId) claimedDays.add(entry.dayId);
    }
  }
  const today = definition ? facts.get(dayId) : null;
  const completed = Boolean(today?.qualifyingRun), claimed = Boolean(definition && claimedDays.has(dayId));
  return { dayId, definition, best: copyRun(today?.best), qualifyingRun: copyRun(today?.qualifyingRun),
    finishCount: today?.finishCount || 0, completed, claimed, claimable: completed && !claimed, reward: definition?.reward || 0 };
}
