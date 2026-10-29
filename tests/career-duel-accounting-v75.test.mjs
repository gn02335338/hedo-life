import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../dist/engine.js';
import { buildEndingReport } from '../dist/ending-report.js';
import { deriveLeaderboardScoreV56 } from '../dist/leaderboard-score-v56.js';
import { characterHistoryChanges } from '../dist/character-stats.js';
import { ROLE_MAP } from '../dist/roles.js';
import { validateCompletion } from '../worker/http.js';
import { createCareerDuelModelV75, DUEL_STEP_V75, DUEL_FRAME_LIMIT_V75 } from '../dist/career-duel-v75.js';

const copy = value => JSON.parse(JSON.stringify(value));
const seed = index => `e39-r75-n-${index.toString(16).padStart(22, '0')}`;
function source(index) {
  const start = E.enableActivitySchedule(E.createRun('system', seed(index)));
  return { start, run: E.advance(E.applyChoice(start, 0)) };
}
function assertChart(run, initialStats) {
  const before = copy(run), report = buildEndingReport(run);
  assert.equal(report.metadata.complete, true, `${run.eventId}/${run.pending}: ${JSON.stringify(report.metadata.unavailableKeys)}`);
  assert.deepEqual(report.metadata.unavailableKeys, []);
  assert.equal(report.samples.length, run.history.length + 1);
  for (const stat of report.stats) {
    assert.equal(stat.available, true, stat.key);
    assert.equal(stat.reason, null, stat.key);
    assert.equal(stat.start, initialStats[stat.key], `${stat.key} preserves the rolled starting value`);
    assert.equal(stat.end, run.stats[stat.key]);
    assert.equal(report.samples.at(-1).stats[stat.key], run.stats[stat.key]);
  }
  for (const trend of report.trends) {
    assert.equal(trend.available, true);
    assert.equal(trend.points.length, run.history.length + 1);
  }
  assert.deepEqual(run, before, 'chart construction remains read-only');
  return report;
}
function assertCanonical(run) {
  assert.equal(E.validRun(copy(run)), true);
  const body = { runId: '75757575-7575-4757-8757-757575757575', roleId: run.roleId, seed: run.seed, actions: run.actions };
  assert.doesNotThrow(() => validateCompletion(body, ROLE_MAP));
  if (!run.pending) assert.deepEqual(E.replayRun(run.roleId, run.seed, run.actions), run);
}
function playBattle(battle) {
  const context = battle.duelContextV75;
  const model = createCareerDuelModelV75({ opponentId: context.target, seed: context.seed });
  let state = model.start();
  for (let frame = 0; frame < DUEL_FRAME_LIMIT_V75 && state.phase === 'playing'; frame++) {
    const x = state.opponent.x - state.player.x, y = state.opponent.y - state.player.y;
    const distance = Math.hypot(x, y);
    const dodge = state.opponent.telegraphRemaining > 0 && state.opponent.telegraphRemaining < .23 && distance < 135;
    state = model.step(DUEL_STEP_V75, {
      x: dodge ? -x : distance > 65 ? x : 0,
      y: dodge ? -y : distance > 65 ? y : 0,
      attack: state.opponent.telegraphRemaining === 0,
      dodge,
      special: state.player.energy >= 100 && distance < 140,
    });
  }
  assert.equal(state.phase, 'finished');
  return { state, input: model.getProof() };
}
// Continue normal authored choices until the engine itself confirms departure.
// No completed flag, ending ID, statistic or action is invented by these tests.
function completeNaturally(run) {
  for (let step = 0; step < 160 && !run.completed; step++) {
    if (run.pending) { run = E.advance(run); continue; }
    const event = E.getEvent(run);
    const index = event.choices.findIndex(choice => choice.available !== false);
    assert.ok(index >= 0, `${event.id} has an available authored reply`);
    run = E.applyChoice(run, index);
  }
  assert.equal(run.completed, true, `natural continuation ended at ${run.eventId}`);
  assert.equal(run.pending, false);
  assert.equal(run.eventId, null);
  assertCanonical(run);
  return run;
}

test('refused invitations preserve reconstructed charts before and after the committed reply is continued', () => {
  const { start, run } = source(0), pending = E.requestDuelV75(run, 'princess');
  assert.equal(pending.duelContextV75.accepted, false);
  assertCanonical(pending);
  const invitationReport = assertChart(pending, start.stats);
  assert.equal(invitationReport.samples.at(-1).label, '同事單挑');
  const returned = E.advance(copy(pending));
  assert.equal(returned.eventId, run.eventId);
  assert.equal(returned.history.length, run.history.length + 1);
  assertCanonical(returned);
  assertChart(returned, start.stats);
  const completed = completeNaturally(returned);
  assertChart(completed, start.stats);
  assert.equal(deriveLeaderboardScoreV56(completed).metrics.realHits, 0, 'a refused challenge is not an actual hit');
});

test('completed combat and paid aftercare reconstruct every chart and count spending once through save/replay', () => {
  const { start, run } = source(36), invitation = E.requestDuelV75(run, 'wing');
  assert.equal(invitation.duelContextV75.accepted, true);
  const battle = E.advance(invitation), record = playBattle(battle);
  assert.equal(record.state.outcome, 'win');
  assert.ok(record.state.summary.damageDealt > 0);
  const result = E.applyDuelPlayV75(battle, record.input);
  assertCanonical(result);
  assertChart(result, start.stats);
  const aftercare = E.advance(result);
  const cashBefore = aftercare.stats.cash, spentBefore = aftercare.flags.cash_spent_total || 0;
  assert.ok(cashBefore >= 8);
  const paid = E.applyChoice(aftercare, 1);
  assert.equal(paid.stats.cash, cashBefore - 8);
  assert.equal(paid.flags.cash_spent_total, spentBefore + 8);
  assert.equal(paid.history.at(-1).delta.cash, -8);
  assert.equal(paid.history.at(-1).duelOutcome.choice, 1);
  assert.equal(E.applyChoice(paid, 1), paid, 'a pending paid result cannot charge again');
  assertCanonical(paid);
  const paidReport = assertChart(paid, start.stats);
  assert.deepEqual(paidReport.samples.filter(sample => sample.label === '同事單挑').length, 3);
  const returned = E.advance(copy(paid));
  assert.equal(returned.flags.cash_spent_total, spentBefore + 8);
  assert.equal(returned.stats.cash, cashBefore - 8);
  assert.equal(returned.eventId, run.eventId);
  assert.equal(returned.turn, run.turn);
  assertCanonical(returned);
  assertChart(returned, start.stats);
  const completed = completeNaturally(returned);
  assertChart(completed, start.stats);
  assert.equal(completed.history.filter(row => row.kind === 'duel' && row.delta.cash < 0).reduce((total, row) => total - row.delta.cash, 0), 8);
});

test('a naturally completed life scores actual duel contact once and never credits duel stages as completed work', () => {
  const { run } = source(36), battle = E.advance(E.requestDuelV75(run, 'wing'));
  const record = playBattle(battle), result = E.applyDuelPlayV75(battle, record.input);
  assert.ok(record.state.summary.damageDealt > 0);
  assert.equal(result.flags.duel75_real_hits, 1);
  assert.equal(result.flags.rage_real || 0, run.flags.rage_real || 0, 'a duel is not relabeled as a rage action');
  const aftercare = E.advance(result), returned = E.advance(E.applyChoice(aftercare, 0));
  const completed = completeNaturally(returned), score = deriveLeaderboardScoreV56(completed);
  const recordedHits = characterHistoryChanges(completed).reduce((total, row) => total + row.realHits, 0);
  assert.equal(score.metrics.realHits, (completed.flags.rage_real || 0) + 1);
  assert.equal(score.metrics.realHits, recordedHits);
  assert.equal(score.metrics.imaginedHits, completed.flags.rage_imagined || 0);
  const workedTurns = new Set(completed.history.filter(row => ['daily', 'fantasy'].includes(row.kind) && row.turn >= 1 && row.turn <= 23 && row.choiceIndex >= 0).map(row => row.turn));
  assert.equal(score.completedTurns, workedTurns.size);
  assert.equal(score.metrics.turns, workedTurns.size);
  assert.equal(completed.history.filter(row => row.kind === 'duel').length, 3);
});

test('zero-contact surrender never increases actual-hit leaderboard or character metrics', () => {
  const { start, run } = source(1), battle = E.advance(E.requestDuelV75(run, 'simon'));
  const result = E.applyDuelPlayV75(battle, { frames: '', forfeit: true });
  assert.equal(result.history.at(-1).duelOutcome.summary.damageDealt, 0);
  assert.equal(result.flags.duel75_real_hits || 0, 0);
  const aftercare = E.advance(result), returned = E.advance(E.applyChoice(aftercare, 0));
  const completed = completeNaturally(returned), score = deriveLeaderboardScoreV56(completed);
  assert.equal(score.metrics.realHits, 0);
  assert.equal(characterHistoryChanges(completed).reduce((total, row) => total + row.realHits, 0), 0);
  assertChart(completed, start.stats);
});
