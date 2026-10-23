import { ENDINGS } from './endings.js';

// A read-only projection of a completed engine replay. The worker must replay
// the seed and actions before calling this module; never score posted stats.
// This version deliberately does not change any gameplay or consume RNG.
export const SCORE_VERSION_V56 = 2;
const WORK_TURN_MAX = 23; // 19 ordinary + 4 final work scenes; reporting is not work.
const CURRENT_SEASON_SEED = /^e39-cal46-kin49-g-e-s-m-/;
const endingById = new Map(ENDINGS.map(ending => [ending.id, ending]));

export const LEADERBOARD_METRICS_V56 = Object.freeze([
  ['overall', '綜合分數', '分', 10000],
  ['skill', '工作能力', '點', 100],
  ['slack', '偷懶能力', '點', 100],
  ['lick', '舔老闆能力', '點', 100],
  ['mood', '自己心情', '點', 100],
  ['energy', '體力', '點', 100],
  ['cash', '存款', '點', 100],
  ['trust', '同事情義', '點', 100],
  ['boss', '翅膀心情', '點', 100],
  ['belief', '大餅信仰', '點', 100],
  ['turns', '完成工作回合', '回合', WORK_TURN_MAX],
  ['verbal', '惡言相向', '次', 300],
  ['realHits', '現實出手', '次', 300],
  ['imaginedHits', '腦內扁人', '次', 300],
  ['promotions', '正式升遷', '次', 300]
].map(([id, label, unit, max]) => Object.freeze({ id, label, unit, max })));

// Static challenge tiers describe acquisition constraints, not moral worth or
// current popularity. Company successes and failures share the same tier:
// reaching the full-length company plan is their common gate. A favorable
// random draw alone does not make a result a harder achievement.
// Each existing family is explicit; an unknown future family receives only
// tier 1 until its real prerequisites have been reviewed.
const tierGroups = Object.freeze({
  1: ['fired_signed', 'fired_refused', 'layoff', 'ragequit', 'burnout', 'broke',
    'assistant', 'career_assistant', 'verbal_onboarding'],
  2: ['pip_fail', 'promotion', 'slacker', 'historian', 'career_staff', 'merged_out',
    'rage_legal', 'rage_defeated', 'rage_truce', 'rage_meme', 'rage_walkaway',
    'mediation_settled', 'mediation_pending', 'verbal_wing_concession',
    'verbal_boardroom', 'verbal_rick_awake', 'verbal_hr_rewrite',
    'verbal_legal_letter', 'verbal_sonny_statement', 'verbal_kind_ghost',
    'verbal_colleague_solidarity', 'verbal_viral', 'verbal_mutual_mute', 'verbal_apology'],
  3: ['pip_exit', 'sycophant', 'career_senior', 'career_principal', 'career_deputy',
    'second_offer', 'handover_author', 'alumni_network', 'cold_storage',
    'venture_independent', 'venture_restart', 'retired_free', 'retired_flexible'],
  4: ['career_manager', 'consultant', 'nasdaq', 'taiwan', 'acquired',
    'nasdaq_failed', 'taiwan_failed', 'google_board', 'google_ousted',
    'buyer_board', 'buyer_ousted', 'vietnam_core', 'vietnam_afterdark',
    'company_closed', 'company_stagnation', 'company_taiwan_exit',
    'company_wage_arrears', 'company_shell_brand', 'company_restructured'],
  5: ['career_director', 'career_chief', 'rage_coup']
});
const familyTiers = new Map(Object.entries(tierGroups).flatMap(([tier, families]) =>
  families.map(family => [family, Number(tier)])));
const tierLabels = ['單段收尾', '多步收尾', '累積挑戰', '長程挑戰', '極限挑戰'];

const bounded = (value, max) => Math.max(0, Math.min(max, value));
const count = value => Number.isSafeInteger(value) ? bounded(value, 300) : 0;

function completedEnding(run) {
  if (!run || run.completed !== true || run.pending !== false || run.eventId !== null)
    throw new Error('A completed replay is required for leaderboard scoring');
  const ending = endingById.get(run.endingId);
  if (!ending || ending.roleId !== run.roleId)
    throw new Error('Unknown completed leaderboard ending');
  if (!Array.isArray(run.history) || run.history.length > 300 ||
      !run.stats || !run.flags || typeof run.flags !== 'object')
    throw new Error('Invalid leaderboard replay evidence');
  return ending;
}

export function leaderboardEligibilityV56(run) {
  try { completedEnding(run); }
  catch { return { eligible: false, reason: '先完成這次人生，再決定要不要留名。' }; }
  if (!CURRENT_SEASON_SEED.test(run.seed || '')) return {
    eligible: false,
    reason: '本季排行榜採用新版活動與體力規則。這局仍可看分數；開一段新人生就能參賽。'
  };
  return { eligible: true, reason: '' };
}

function snapshotMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics) ||
      Object.keys(metrics).length !== LEADERBOARD_METRICS_V56.length ||
      LEADERBOARD_METRICS_V56.some(({ id, max }) =>
        !Object.hasOwn(metrics, id) || !Number.isSafeInteger(metrics[id]) ||
        metrics[id] < 0 || metrics[id] > max))
    throw new Error('Invalid canonical leaderboard metrics');
  return { ...metrics };
}

function scoreSnapshot(metrics, endingId, legacy) {
  const values = snapshotMetrics(metrics), ending = endingById.get(endingId);
  if (!ending) throw new Error('Unknown completed leaderboard ending');
  const completedTurns = values.turns;
  const nominalTier = familyTiers.get(ending.family) || 1;
  // A title assigned on the first morning is not an earned promotion. Keep
  // the original tiers only when verifying a previously stored v1 snapshot.
  const careerEnding = ending.family.startsWith('career_') ||
    ['promotion', 'consultant'].includes(ending.family);
  const tier = legacy ? nominalTier : ending.family === 'rage_coup' ? 3 :
    careerEnding ? Math.min(nominalTier, 1 + values.promotions) : nominalTier;
  const abilitySum = bounded(values.skill + values.slack + values.lick, 180);
  const strongest = Math.max(values.skill, values.slack, values.lick);
  const experienceFactor = Math.min(completedTurns / 19, 1);
  const groups = [
    { id: 'abilities', label: '三種本事', points: legacy ? Math.round(abilitySum / 180 * 3000) :
      Math.round(3000 * (.6 * strongest / 100 + .4 * abilitySum / 180)), max: 3000 },
    { id: 'wellbeing', label: '心情與體力', points: Math.round((values.mood + values.energy) / 200 * 1500), max: 1500 },
    { id: 'wealth', label: '離場存款', points: Math.round(values.cash * 10), max: 1000 },
    { id: 'relationships', label: '職場關係', points: Math.round(values.trust * 6 + values.boss * 2 + values.belief * 2), max: 1000 },
    { id: 'survival', label: '完成工作回合', points: Math.round(completedTurns / WORK_TURN_MAX * 2000), max: 2000 },
    { id: 'difficulty', label: '結局挑戰', points: tier * 300, max: 1500 }
  ];
  const breakdown = legacy ? groups : groups.map(group => group.id === 'survival' ? group :
    { ...group, points: Math.round(group.points * experienceFactor) });
  const total = breakdown.reduce((sum, part) => sum + part.points, 0);
  values.overall = total;
  return {
    scoreVersion: legacy ? 1 : SCORE_VERSION_V56, total, metrics: values, breakdown,
    difficulty: { tier, label: tierLabels[tier - 1],
      points: breakdown.find(group => group.id === 'difficulty').points, max: 1500 },
    completedTurns, endingId,
    ...(!legacy ? { experience: { completedTurns, fullCreditTurns: 19,
      factor: experienceFactor, percent: Math.round(experienceFactor * 100) } } : {})
  };
}

// The same numeric projection scores fresh server replays and migrates old
// opt-in entries. Stored final metrics are sufficient; raw dialogue, actions
// and seeds do not need to be retained. The supplied overall is never trusted.
export function deriveLeaderboardScoreFromMetricsV57(metrics, endingId) {
  return scoreSnapshot(metrics, endingId, false);
}

// Verify every v1 row against its original formula before changing versions.
// This preserves the old tiers, including the randomly acquired coup tier.
export function deriveLegacyLeaderboardScoreV1FromMetricsV57(metrics, endingId) {
  return scoreSnapshot(metrics, endingId, true);
}

export function deriveLeaderboardScoreV56(run) {
  const ending = completedEnding(run);
  const statKeys = ['skill', 'slack', 'lick', 'mood', 'energy', 'cash', 'trust', 'boss', 'dream'];
  const stats = Object.fromEntries(statKeys.map(key => {
    if (typeof run.stats[key] !== 'number' || !Number.isFinite(run.stats[key]))
      throw new Error('Invalid leaderboard stat');
    return [key, bounded(run.stats[key], 100)];
  }));

  // Deduplicate completed work scenes. Reporting, rest, mini-game stages,
  // menu visits and jumps of the turn cursor do not demonstrate work service.
  const workTurns = new Set(run.history.filter(row =>
    row && ['daily', 'fantasy'].includes(row.kind) &&
    Number.isInteger(row.turn) && row.turn >= 1 && row.turn <= WORK_TURN_MAX &&
    Number.isInteger(row.choiceIndex) && row.choiceIndex >= 0
  ).map(row => row.turn));
  const metrics = {
    overall: 0,
    skill: stats.skill, slack: stats.slack, lick: stats.lick,
    mood: stats.mood, energy: stats.energy, cash: stats.cash,
    trust: stats.trust, boss: stats.boss, belief: stats.dream,
    turns: workTurns.size,
    verbal: count(run.flags.verbal_attempts),
    realHits: count(run.flags.rage_real),
    imaginedHits: count(run.flags.rage_imagined),
    promotions: count(run.flags.promotions)
  };
  return deriveLeaderboardScoreFromMetricsV57(metrics, ending.id);
}
