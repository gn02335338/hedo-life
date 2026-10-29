// This is a read-only projection of committed results. It never rerolls a life
// or changes the save/replay protocol. Row deltas already include 0/100 limits.
import {isPatronageOutcomeV43} from './character-stats.js';
import {isWorkGapV50} from './work-gap-v50.js';
import {isActivityPlayV55,deriveActivityPlayV55} from './activity-play-v55.js';
import {isShareholderV58,deriveShareholderPlayV58} from './shareholders-v58.js';
import {isEventDepartureOutcomeV63} from './event-departure-v63.js';
import {isCareerDuelV75,duelHistoryChangeV75} from './career-duel-v75.js';
const LABELS = Object.freeze({
 energy:'體力', cash:'存款', trust:'同事情義', dream:'大餅信仰',
 boss:'翅膀心情', mood:'自己心情', skill:'工作能力', slack:'偷懶能力', lick:'舔老闆能力'
});
const KEYS = Object.keys(LABELS);
const valueInRange = value => Number.isFinite(value) && value >= 0 && value <= 100;
const turnValue = value => Number.isInteger(value) && value >= 0 ? value : null;

function sampleLabel(row) {
 const id = typeof row?.eventId === 'string' ? row.eventId : '';
 if (row?.kind === 'event-departure') return '事件離場';
 if (row?.kind === 'blockchain') return '區塊鏈計畫';
 if (row?.kind === 'shareholder') return row.shareholderOutcome?.stage === 'offer' ? '員工認股' : '股東會';
 if (row?.kind === 'office-treat') return '點心插曲';
 if (row?.kind === 'recruitment') return '入職介紹';
 if (id === 'mood-self-destruct') return '自爆';
 if (id === 'mood-collapse') return '崩潰';
 if (id === 'patronage-reply' && row?.kind === 'patronage' || row?.patronageOutcome?.version === 2) return '自己人發話';
 if (id.startsWith('meal-')) return '飯局';
 if (id.startsWith('wealth-')) return '離職後規劃';
 if (id.startsWith('company-v32-')) return '公司未來';
 if (id === 'verbal-v32-aftermath') return '口舌收尾';
 if (id.startsWith('pip-')) return 'PIP';
 if (row?.kind === 'self-care' || ['kind-break','kind-workday'].includes(id)) return '休整';
 if (row?.kind === 'banquet') return '尾牙';
 if (row?.kind === 'activity') return '活動';
 if (row?.kind === 'activity-invitation') return '邀約';
 if (row?.kind === 'hidden') return '意外相遇';
 if (row?.kind === 'duel') return '同事單挑';
 if (id === 'rage-release') {
  if (row?.eventOutcome?.result === '腦內劇場') return '夢境';
  if (row?.eventOutcome?.result === '真的失控了') return '真實失控';
  return '暴走';
 }
 if (row?.kind === 'rage-world') return '失控後續';
 if (row?.kind === 'rage') return '暴走';
 if (row?.kind === 'onboarding' || id === 'onboarding') return '報到';
 if (row?.kind === 'daily') return '工作';
 if (row?.kind === 'fantasy') return '幻想';
 if (['exit-menu','rank-exit','story-exit','career-exit'].includes(id)) return '離場';
 if (id === 'crisis-mood') return '情緒預警';
 if (row?.kind === 'career' || row?.kind === 'crisis') return '人事';
 return '選擇';
}

// Opening a menu or returning from a work gap does not commit a result row.
// Interactive plays, departure, direct rage and verbal actions do. Match these
// without replaying the engine or mistaking a shortened log for a full life.
// A v2 verbal decision commits its source answer instead of its wrapper name.
function historyMatchesActions(run, history) {
 if (!Array.isArray(run?.actions)) return true;
 const committed = run.actions.filter(action => action?.type === 'choice' &&
  !(isWorkGapV50(run) && action.eventId === 'work-gap-v50' && action.index === 0) ||
  ['patronage-reply','activity-play','shareholder-play','event-departure','duel-invite','duel-play'].includes(action?.type) ||
  (['rage','verbal'].includes(action?.type) && ['event','result'].includes(action.phase)));
 if (committed.length !== history.length) return false;
 let spokenSource = null;
 return committed.every((action, index) => {
  const row = history[index];
  if (action.type === 'duel-invite' || action.type === 'duel-play') {
   spokenSource = null;
   return isCareerDuelV75(run) && action.version === 1 && duelHistoryChangeV75(run,row) !== null &&
    (action.type === 'duel-invite' ? row?.eventId === 'duel75-invitation' && row.duelOutcome.target === action.target : row?.eventId === 'duel75-result');
  }
  if (action.type === 'event-departure') {
   spokenSource = null;
   return action.version === 1 && action.eventId === row?.eventId && isEventDepartureOutcomeV63(run,row);
  }
  if (action.type === 'activity-play') {
   spokenSource = null;
   try {
    const played = deriveActivityPlayV55(action.input,action.input?.kind),outcome = row?.activityOutcome;
    return isActivityPlayV55(run) && action.version === 1 && action.index === 1 &&
     action.eventId === `activity44-${action.input.kind}-1` && row?.eventId === action.eventId &&
     row.kind === 'activity' && row.choiceIndex === 1 && outcome?.version === 1 &&
     outcome.id === action.input.kind && outcome.stage === 1 && outcome.done === false &&
     outcome.performance?.version === 1 && outcome.performance.score === played.score && outcome.performance.grade === played.grade;
   } catch { return false; }
  }
  if (action.type === 'shareholder-play') {
   spokenSource = null;
   try {
    const played = deriveShareholderPlayV58(action.input),outcome = row?.shareholderOutcome;
    return isShareholderV58(run) && action.version === 1 && row?.eventId === action.eventId &&
     row.kind === 'shareholder' && row.choiceIndex === 0 && outcome?.version === 1 &&
     outcome.stage === 'hearing' && Number.isInteger(outcome.round) && outcome.round >= 0 && outcome.round <= 3 &&
     action.eventId === `shareholder58-hearing-${outcome.round}` && outcome.mode === played.mode && typeof outcome.done === 'boolean';
   } catch { return false; }
  }
  if (action.type === 'patronage-reply') {
   spokenSource = null;
   return action.version === row?.patronageOutcome?.version && isPatronageOutcomeV43(run,row) &&
    row.patronageOutcome.origin === action.eventId && row.patronageOutcome.target === action.target;
  }
  if (action.type === 'verbal') {
   const evidence = row?.verbalOutcome;
   spokenSource = action.version === 2 ? action : null;
   return row?.eventId === (action.version === 2 ? action.eventId : 'verbal-release') &&
    evidence?.origin === action.eventId && evidence.phase === action.phase &&
    (action.version === 2 ? evidence.version === 2 : evidence.version === undefined);
  }
  if (action.type === 'rage') { spokenSource = null; return row?.eventId === 'rage-release'; }
  if (action.eventId === 'verbal-v2-decision') {
   const origin = spokenSource?.eventId;
   // Onboarding offers only two follow-up answers: accept (source 0), leave
   // (source 2). Other modal decisions preserve the source option indices.
   const sourceIndex = origin === 'onboarding' ? [0,2][action.index] : action.index;
   const matches = spokenSource?.phase === 'event' && row?.eventId === origin && row.choiceIndex === sourceIndex;
   spokenSource = null;
   return matches;
  }
  if (!['verbal-v2-warning','verbal-v2-legal','verbal-v2-legal-result','verbal-v32-aftermath'].includes(action.eventId)) spokenSource = null;
  return row?.eventId === action.eventId && row.choiceIndex === action.index;
 });
}

export function buildEndingReport(run) {
 const history = Array.isArray(run?.history) ? run.history : [];
 const hasHistory = history.length > 0;
 const historyMatches = historyMatchesActions(run, history);
 const samples = [
  {decisionIndex:0, turn:0, eventId:null, label:'起點', stats:{}},
  ...history.map((row, index) => ({
   decisionIndex:index + 1, turn:turnValue(row?.turn),
   eventId:typeof row?.eventId === 'string' ? row.eventId : null,
   label:sampleLabel(row), stats:{}
  }))
 ];

 const stats = KEYS.map(key => {
  const end = valueInRange(run?.stats?.[key]) ? run.stats[key] : null;
  let reason = end === null ? 'invalid-end' : !hasHistory ? 'no-history' : !historyMatches ? 'incomplete-history' : null;
  const values = Array(history.length + 1).fill(null);
  if (!reason) {
   values[history.length] = end;
   for (let index = history.length - 1; index >= 0; index--) {
    const delta = history[index]?.delta?.[key];
    if (!Number.isFinite(delta)) { reason = 'invalid-delta'; break; }
    const before = values[index + 1] - delta;
    if (!valueInRange(before)) { reason = 'out-of-range'; break; }
    values[index] = before;
   }
  }
  const available = reason === null;
  for (let index = 0; index < samples.length; index++) samples[index].stats[key] = available ? values[index] : null;
  const start = available ? values[0] : null;
  return {key, label:LABELS[key], start, end, delta:available ? end - start : null, available, reason};
 });
 const byKey = Object.fromEntries(stats.map(stat => [stat.key, stat]));
 const unavailableKeys = stats.filter(stat => !stat.available).map(stat => stat.key);

 return {
  stats,
  abilities:['skill','slack','lick'].map(key => byKey[key]),
  trends:['mood','energy','cash'].map(key => ({
   key, label:LABELS[key], available:byKey[key].available, reason:byKey[key].reason,
   points:byKey[key].available ? samples.map(sample => ({
    decisionIndex:sample.decisionIndex, turn:sample.turn, value:sample.stats[key]
   })) : []
  })),
  samples,
  metadata:{
   decisionCount:history.length,
   workTurns:turnValue(run?.turn),
   hasHistory,
   complete:unavailableKeys.length === 0,
   unavailableKeys,
   axisLabel:'選擇進程'
  }
 };
}
