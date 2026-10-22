import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ENDINGS, FAMILIES } from '../dist/endings.js';
import { createRun, replayRun, enableActivitySchedule, applyChoice, advance } from '../dist/engine.js';
import { SCORE_VERSION_V56, LEADERBOARD_METRICS_V56,
  leaderboardEligibilityV56, deriveLeaderboardScoreV56 } from '../dist/leaderboard-score-v56.js';

// Boundary fixtures exercise only this read-only projection. Production never
// accepts this state: the worker derives it independently with replayRun.
const projection = (options = {}) => ({
  seed: 'e39-cal46-kin49-g-e-s-m-12345678', roleId: 'system',
  completed: true, pending: false, eventId: null, endingId: 'ragequit-system',
  stats: { skill: 60, slack: 60, lick: 60, mood: 50, energy: 50,
    cash: 50, trust: 50, boss: 50, dream: 50 },
  history: [], flags: {}, ...options
});
const work = (turn, kind = 'daily') => ({ turn, kind, choiceIndex: 0 });
const part = (score, id) => score.breakdown.find(row => row.id === id).points;
const load = file => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

test('metric contract is complete, bounded and immutable', () => {
  assert.equal(SCORE_VERSION_V56, 1);
  assert.deepEqual(LEADERBOARD_METRICS_V56.map(row => row.id), [
    'overall', 'skill', 'slack', 'lick', 'mood', 'energy', 'cash', 'trust',
    'boss', 'belief', 'turns', 'verbal', 'realHits', 'imaginedHits', 'promotions'
  ]);
  assert.equal(LEADERBOARD_METRICS_V56.find(row => row.id === 'turns').max, 23);
  for (const row of LEADERBOARD_METRICS_V56) {
    assert.ok(Object.isFrozen(row));
    assert.ok(row.label && row.unit && row.max > 0);
  }
  assert.ok(Object.isFrozen(LEADERBOARD_METRICS_V56));
});

test('six weighted groups total 10,000; the 180-point ability limit can fill its group', () => {
  const run = projection({ endingId: 'career_chief-system',
    stats: { skill: 60, slack: 60, lick: 60, mood: 100, energy: 100,
      cash: 100, trust: 100, boss: 100, dream: 100 },
    history: Array.from({ length: 23 }, (_, index) => work(index + 1)) });
  const score = deriveLeaderboardScoreV56(run);
  assert.equal(score.total, 10000);
  assert.equal(score.metrics.overall, 10000);
  assert.equal(score.breakdown.reduce((sum, row) => sum + row.max, 0), 10000);
  assert.equal(part(score, 'abilities'), 3000);
  assert.deepEqual(score.breakdown.map(row => row.max), [3000, 1500, 1000, 1000, 2000, 1500]);
});

test('ability trade-offs have equal weight and cannot exceed 3,000', () => {
  const run = projection();
  const balanced = deriveLeaderboardScoreV56(run);
  const specialist = deriveLeaderboardScoreV56({ ...run,
    stats: { ...run.stats, skill: 100, slack: 40, lick: 40 } });
  assert.equal(specialist.total, balanced.total);
  assert.equal(specialist.metrics.skill, 100);
  assert.equal(specialist.metrics.slack, 40);
  const old = deriveLeaderboardScoreV56({ ...run,
    stats: { ...run.stats, skill: 100, slack: 100, lick: 100 } });
  assert.equal(part(old, 'abilities'), 3000);
});

test('spending savings affects at most ten percent; wellbeing can offset it', () => {
  const run = projection();
  const rich = deriveLeaderboardScoreV56({ ...run, stats: { ...run.stats, cash: 100 } });
  const spent = deriveLeaderboardScoreV56({ ...run, stats: { ...run.stats, cash: 0 } });
  assert.equal(rich.total - spent.total, 1000);
  const recovered = deriveLeaderboardScoreV56({ ...run,
    stats: { ...run.stats, cash: 35, mood: 90, energy: 90 } });
  assert.ok(recovered.total > deriveLeaderboardScoreV56(run).total);
  assert.equal(part(recovered, 'wellbeing'), 1350);
});

test('relationships prioritize coworkers and correctly map belief to dream', () => {
  const zero = projection({ stats: Object.fromEntries(Object.keys(projection().stats).map(key => [key, 0])) });
  assert.equal(part(deriveLeaderboardScoreV56({ ...zero, stats: { ...zero.stats, trust: 100 } }), 'relationships'), 600);
  assert.equal(part(deriveLeaderboardScoreV56({ ...zero, stats: { ...zero.stats, boss: 100 } }), 'relationships'), 200);
  const believer = deriveLeaderboardScoreV56({ ...zero, stats: { ...zero.stats, dream: 80 } });
  assert.equal(believer.metrics.belief, 80);
  assert.equal(part(believer, 'relationships'), 160);
});

test('work evidence excludes reporting, free actions, duplicate scenes and turn jumps', () => {
  const run = projection({ turn: 24, history: [
    work(0, 'onboarding'), work(1), work(1), work(1, 'verbal'),
    work(1, 'self-care'), work(1, 'career'), work(1, 'activity'),
    work(2), work(3, 'fantasy'), work(23, 'fantasy'),
    { turn: 24, kind: 'career', choiceIndex: 0 }
  ] });
  const score = deriveLeaderboardScoreV56(run);
  assert.equal(score.completedTurns, 4);
  assert.equal(score.metrics.turns, 4);
  assert.equal(part(score, 'survival'), Math.round(4 / 23 * 2000));
  assert.equal(deriveLeaderboardScoreV56(projection({ turn: 24 })).completedTurns, 0);
});

test('real canonical company finale counts all 19 daily and 4 fantasy scenes', () => {
  const route = load('./fixtures/company-e39-routes.json').routes.find(row => row.target === 'nasdaq');
  const run = replayRun(route.roleId, route.seed, route.actions);
  assert.equal(run.completed, true);
  assert.equal(run.turn, 23);
  const score = deriveLeaderboardScoreV56(run);
  assert.equal(score.completedTurns, 23);
  assert.equal(part(score, 'survival'), 2000);
  assert.equal(score.metrics.belief, run.stats.dream);
  assert.equal(leaderboardEligibilityV56(run).eligible, false);
});

test('leaving at reporting earns no work turns', () => {
  const run = replayRun('system', 'e39-early-exit', [
    { type: 'choice', eventId: 'onboarding', index: 2 }
  ]);
  assert.equal(run.completed, true);
  assert.equal(deriveLeaderboardScoreV56(run).completedTurns, 0);
});

test('committed counters distinguish actual hits, fantasies and successful promotions', () => {
  const score = deriveLeaderboardScoreV56(projection({ flags: {
    verbal_attempts: 7, rage_real: 2, rage_imagined: 5, promotions: 3,
    career_reviews: 99, rage_attempts: 99, rage_target_wing: 99
  } }));
  assert.equal(score.metrics.verbal, 7);
  assert.equal(score.metrics.realHits, 2);
  assert.equal(score.metrics.imaginedHits, 5);
  assert.equal(score.metrics.promotions, 3);
  assert.equal(score.total, deriveLeaderboardScoreV56(projection()).total,
    'behavior counters get their own boards, not extra overall farming points');
});

test('canonical real and imagined branches stay separate in score metrics', () => {
  const routes = load('../research/reachability-v3.json').routes;
  for (const family of ['rage_coup', 'rage_defeated', 'career_chief', 'verbal_onboarding']) {
    const route = routes.find(row => row.ending === `${family}-system`);
    const run = replayRun(route.roleId, route.seed, route.actions);
    const score = deriveLeaderboardScoreV56(run);
    assert.equal(score.metrics.realHits, run.flags.rage_real || 0);
    assert.equal(score.metrics.imaginedHits, run.flags.rage_imagined || 0);
    assert.equal(score.metrics.verbal, run.flags.verbal_attempts || 0);
    assert.equal(score.metrics.promotions, run.flags.promotions || 0);
    if (family.startsWith('rage_')) assert.ok(score.metrics.realHits >= 1);
    if (family === 'career_chief') assert.ok(score.metrics.promotions >= 1);
  }
});

test('all 883 endings have stable family tiers with no locked title or hint in score output', () => {
  assert.equal(ENDINGS.length, 883);
  assert.equal(FAMILIES.length, 68);
  const tiers = new Map();
  for (const ending of ENDINGS) {
    const score = deriveLeaderboardScoreV56(projection({ roleId: ending.roleId, endingId: ending.id }));
    assert.ok(score.difficulty.tier >= 1 && score.difficulty.tier <= 5);
    assert.equal(score.difficulty.points, score.difficulty.tier * 300);
    if (tiers.has(ending.family)) assert.equal(score.difficulty.tier, tiers.get(ending.family));
    tiers.set(ending.family, score.difficulty.tier);
    assert.equal(score.endingId, ending.id);
    assert.ok(!Object.hasOwn(score, 'title') && !Object.hasOwn(score, 'hint'));
    assert.ok(!JSON.stringify(score.difficulty).includes(ending.title));
    assert.ok(Number.isInteger(score.total) && score.total >= 0 && score.total <= 10000);
  }
  for (const family of ['nasdaq', 'nasdaq_failed', 'taiwan', 'taiwan_failed',
    'google_board', 'google_ousted', 'buyer_board', 'buyer_ousted',
    'vietnam_core', 'vietnam_afterdark', 'company_closed', 'company_stagnation',
    'company_taiwan_exit', 'company_wage_arrears', 'company_shell_brand', 'company_restructured'])
    assert.equal(tiers.get(family), 4, `${family}: shared full-length gate, irrespective of outcome`);
  assert.equal(tiers.get('career_chief'), 5);
  assert.equal(tiers.get('career_director'), 5);
  assert.equal(tiers.get('rage_coup'), 5);
  assert.equal(tiers.get('verbal_onboarding'), 1);
  assert.equal(tiers.get('venture_independent'), tiers.get('venture_restart'));
});

test('only completed current-rule lives can join this season; old runs can still see a score', () => {
  assert.deepEqual(leaderboardEligibilityV56(projection()), { eligible: true, reason: '' });
  const natural = advance(applyChoice(enableActivitySchedule(createRun('system',
    'e39-cal46-kin49-g-e-s-m-00000001')), 2));
  assert.equal(natural.completed, true);
  assert.deepEqual(leaderboardEligibilityV56(natural), { eligible: true, reason: '' });
  assert.deepEqual(deriveLeaderboardScoreV56(replayRun(natural.roleId, natural.seed, natural.actions)),
    deriveLeaderboardScoreV56(natural));
  for (const seed of ['e39-cal46-kin49-g-e-s-1234567890', 'e39-older', 'e18-old', '']) {
    const run = projection({ seed });
    assert.equal(leaderboardEligibilityV56(run).eligible, false);
    assert.ok(leaderboardEligibilityV56(run).reason);
    assert.ok(Number.isInteger(deriveLeaderboardScoreV56(run).total));
  }
  assert.equal(leaderboardEligibilityV56(createRun('system', projection().seed)).eligible, false);
});

test('incomplete or malformed projections fail closed; finite values are clamped', () => {
  for (const overrides of [{ completed: false }, { pending: true }, { eventId: 'onboarding' },
    { endingId: 'invented-system' }, { roleId: 'sales' }, { history: null }, { stats: null }, { flags: null }])
    assert.throws(() => deriveLeaderboardScoreV56(projection(overrides)));
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '100'])
    assert.throws(() => deriveLeaderboardScoreV56(projection({ stats: { ...projection().stats, skill: value } })));
  const clamped = deriveLeaderboardScoreV56(projection({ stats: { ...projection().stats, skill: 500, mood: -10 } }));
  assert.equal(clamped.metrics.skill, 100);
  assert.equal(clamped.metrics.mood, 0);
});

test('scoring is deterministic, side-effect free and ignores action length', () => {
  const run = projection({ rng: 12345, actions: [], flags: { rage_real: 1 } });
  const before = structuredClone(run);
  const score = deriveLeaderboardScoreV56(run);
  assert.deepEqual(run, before);
  assert.deepEqual(deriveLeaderboardScoreV56(run), score);
  assert.deepEqual(deriveLeaderboardScoreV56({ ...run, actions: Array.from({ length: 300 }, () => ({ type: 'exit' })) }), score);
});
