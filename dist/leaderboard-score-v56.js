import { ENDINGS } from './endings.js';

// A read-only projection of a completed engine replay. The worker must replay
// the seed and actions before calling this module; never score posted stats.
// This version deliberately does not change any gameplay or consume RNG.
export const SCORE_VERSION_V56 = 1;
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

export function deriveLeaderboardScoreV56(run) {
  const ending = completedEnding(run);
  const statKeys = ['skill', 'slack', 'lick', 'mood', 'energy', 'cash', 'trust', 'boss', 'dream'];
  const stats = Object.fromEntries(statKeys.map(key => {
    if (typeof run.stats[key] !== 'number' || !Number.isFinite(run.stats[key]))
      throw new Error('Invalid leaderboard stat');
    return [key, bounded(run.stats[key], 100)];
  }));

  // Daily/fantasy verbal responses retain their source kind in engine history.
  // A response after an already answered scene has kind "verbal" instead.
  // Deduplicating turn slots counts each resolved work scene once and includes
  // the finale whose completion can leave engine.turn unchanged at 23. Neither
  // reporting, rest, mini-game stages nor a shortfall turn jump creates a day.
  const workTurns = new Set(run.history.filter(row =>
    row && ['daily', 'fantasy'].includes(row.kind) &&
    Number.isInteger(row.turn) && row.turn >= 1 && row.turn <= WORK_TURN_MAX &&
    Number.isInteger(row.choiceIndex) && row.choiceIndex >= 0
  ).map(row => row.turn));
  const completedTurns = workTurns.size;

  // These cumulative flags increment only in the engine's committed result
  // branches. A failed promotion, cancelled target picker, follow-up response,
  // menu visit or repeated HTTP submission never increments them. Modern
  // reality/fantasy flags are separate; ambiguous old cartoon attempts are
  // deliberately not inferred as actual hits.
  const metrics = {
    overall: 0,
    skill: stats.skill, slack: stats.slack, lick: stats.lick,
    mood: stats.mood, energy: stats.energy, cash: stats.cash,
    trust: stats.trust, boss: stats.boss, belief: stats.dream,
    turns: completedTurns,
    verbal: count(run.flags.verbal_attempts),
    realHits: count(run.flags.rage_real),
    imaginedHits: count(run.flags.rage_imagined),
    promotions: count(run.flags.promotions)
  };
  const tier = familyTiers.get(ending.family) || 1;
  const difficulty = { tier, label: tierLabels[tier - 1], points: tier * 300, max: 1500 };
  const breakdown = [
    { id: 'abilities', label: '三種本事', points: Math.round(bounded(stats.skill + stats.slack + stats.lick, 180) / 180 * 3000), max: 3000 },
    { id: 'wellbeing', label: '心情與體力', points: Math.round((stats.mood + stats.energy) / 200 * 1500), max: 1500 },
    { id: 'wealth', label: '離場存款', points: Math.round(stats.cash * 10), max: 1000 },
    { id: 'relationships', label: '職場關係', points: Math.round(stats.trust * 6 + stats.boss * 2 + stats.dream * 2), max: 1000 },
    { id: 'survival', label: '完成工作回合', points: Math.round(completedTurns / WORK_TURN_MAX * 2000), max: 2000 },
    { id: 'difficulty', label: '結局挑戰', points: difficulty.points, max: 1500 }
  ];
  const total = breakdown.reduce((sum, part) => sum + part.points, 0);
  metrics.overall = total;
  return { scoreVersion: SCORE_VERSION_V56, total, metrics, breakdown, difficulty, completedTurns, endingId: ending.id };
}
