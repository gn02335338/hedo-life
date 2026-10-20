// This is a read-only projection of committed results. It never rerolls a life
// or changes the save/replay protocol. Row deltas already include 0/100 limits.
const LABELS = Object.freeze({
 energy:'體力', cash:'存款', trust:'同事情義', dream:'大餅信仰',
 boss:'翅膀心情', mood:'自己心情', skill:'工作能力', slack:'偷懶能力', lick:'舔老闆能力'
});
const KEYS = Object.keys(LABELS);
const valueInRange = value => Number.isFinite(value) && value >= 0 && value <= 100;
const turnValue = value => Number.isInteger(value) && value >= 0 ? value : null;

function sampleLabel(row) {
 const id = typeof row?.eventId === 'string' ? row.eventId : '';
 if (id === 'mood-self-destruct') return '自爆';
 if (id === 'mood-collapse') return '崩潰';
 if (id.startsWith('meal-')) return '飯局';
 if (id.startsWith('pip-')) return 'PIP';
 if (row?.kind === 'self-care' || ['kind-break','kind-workday'].includes(id)) return '休整';
 if (row?.kind === 'banquet') return '尾牙';
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

// A direct rage action commits one implicit result row. Menu-opening actions
// such as break/raise/exit do not. If an action log is available, a mismatch
// proves the history has been shortened; do not invent its missing origin.
function historyMatchesActions(run, history) {
 if (!Array.isArray(run?.actions)) return true;
 const committed = run.actions.filter(action => action?.type === 'choice' ||
  (action?.type === 'rage' && ['event','result'].includes(action.phase)));
 return committed.length === history.length && committed.every((action, index) =>
  history[index]?.eventId === (action.type === 'rage' ? 'rage-release' : action.eventId));
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
