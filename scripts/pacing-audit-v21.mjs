import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { EVENTS } from '../dist/events.js';
import { createRun, getEvent, applyChoice, advance, canRequestBreak, requestBreak, canRequestCareer, requestCareer, canRequestRaise, replayRun, validRun } from '../dist/engine.js';

// Only visible choices and present meters drive decisions. Result metadata is
// read after committing a choice, solely to count the observed pacing.
const count = Number(process.argv[2] || 100);
assert.ok(Number.isInteger(count) && count >= 1 && count <= 1000);
const eventById = new Map(EVENTS.map(event => [event.id, event]));
const roles = ['sales', 'bd', 'design'];
const policies = ['work', 'politics', 'mixed'];
const rows = [], witnesses = {};
const visibleEvent = event => ({ id: event.id, kind: event.kind, title: event.title, body: event.body, choices: event.choices.map((choice, index) => ({ index, text: choice.text, available: choice.available !== false })) });

function pick(event, stats, policy, turn) {
  const choices = event.choices.filter(choice => choice.available);
  const has = index => choices.some(choice => choice.index === index);
  const named = pattern => choices.find(choice => pattern.test(choice.text))?.index;
  if (event.id === 'onboarding') return 0;
  if (event.id === 'self-care') return named(stats.energy < 35 ? /補.*覺|補眠|安靜的房間/ : /喜歡的飲料/) ?? named(/先把錢留著/) ?? choices[0].index;
  if (event.id === 'kind-break' || event.id === 'kind-workday') return named(/太髒|不參加|不跟|拒絕/) ?? 1;
  if (event.id === 'mood-collapse') return has(0) ? 0 : 1;
  if (event.id === 'crisis-mood') return has(1) ? 1 : 2;
  if (event.id === 'education-scrutiny') return policy === 'politics' ? 1 : 0;
  if (event.id === 'education-review') return policy === 'politics' ? 2 : 0;
  if (event.id === 'salary-cut' || event.id === 'salary-final') return 0;
  if (event.id === 'crisis-boss') return has(2) ? 2 : 0;
  if (event.id === 'paperwork') return has(2) ? 2 : 1;
  if (event.id === 'pip-review') return stats.skill >= stats.lick ? 0 : 1;
  if (event.id === 'pip-passed') return 1;
  if (event.id === 'floor-notice' || event.id === 'watch-review' || event.id === 'watch-future') return 0;
  if (event.id === 'dismissal-final') return 0;
  if (event.id === 'career-review') return policy === 'politics' && has(1) ? 1 : has(0) ? 0 : has(2) ? 2 : choices[0].index;
  if (event.id === 'rank-exit' || event.id === 'final-shortfall') return 0;
  if (event.kind === 'daily') return policy === 'work' ? choices[0].index : policy === 'politics' ? has(1) ? 1 : choices[0].index : choices[turn % choices.length].index;
  return choices[0].index;
}

function restBlock(run) {
  if (canRequestBreak(run)) return 'available';
  if (run.pending) return 'result';
  if (run.completed) return 'completed';
  if (run.rageContext) return 'rage';
  if (run.lastBreakTurn === run.turn) return 'used-this-workday';
  if (run.resumeEventId || run.exitReturnEventId || run.breakReturnEventId) return 'finish-current-notice';
  return 'not-a-work-scene';
}

for (const roleId of roles) for (const policy of policies) {
  const row = { roleId, policy, runs: count, completed: 0, workScenes: 0, exclusiveScenes: 0, relatedScenes: 0, sharedScenes: 0, firstWorkExclusive: 0, maxSharedStreak: 0, repeatedWorkScenes: 0, unchosenWorkReturns: 0, pipRuns: 0, pipEntries: 0, maxPip: 0, pipReviews: 0, pipWorkLengths: {}, pipPassedRuns: 0, careerMenus: 0, careerApplications: 0, careerTraining: 0, promotions: 0, chiefs: 0, restRequests: 0, restPurchases: 0, restCancels: 0, workSceneRestAvailable: 0, workSceneRestBlocked: {}, restNeededWhenAvailable: 0, neededRestUnavailable: {}, raiseAvailableWindows: 0, salaryCuts: 0, directDismissals: 0, moodCrashes: 0, energyBurnouts: 0, averageFinalDay: 0, maxActionsWithoutWorkProgress: 0, rankPeaks: {}, averageRestSpend: 0 };
  for (let attempt = 0; attempt < count; attempt++) {
    let run = createRun(roleId, `e21-pacing-${roleId}-${attempt}`), sharedStreak = 0, first = true, pipWork = null, actionsAtWork = 0, restSpent = 0;
    const completedWork = new Set(), workWindows = new Set(), offeredWork = new Set();
    const trace = [];
    for (let step = 0; step < 200 && !run.completed; step++) {
      let event = getEvent(run);
      const windowKey = `${run.turn}/${event.id}`;
      if (['daily', 'fantasy'].includes(event.kind) && !workWindows.has(windowKey)) {
        workWindows.add(windowKey);
        const block = restBlock(run);
        if (block === 'available') row.workSceneRestAvailable++;
        else row.workSceneRestBlocked[block] = (row.workSceneRestBlocked[block] || 0) + 1;
        if (run.stats.energy < 35 || run.stats.mood < 45) {
          if (block === 'available') row.restNeededWhenAvailable++;
          else row.neededRestUnavailable[block] = (row.neededRestUnavailable[block] || 0) + 1;
        }
        row.raiseAvailableWindows += Number(canRequestRaise(run));
      }
      if (['daily', 'fantasy'].includes(event.kind)) {
        row.unchosenWorkReturns += Number(offeredWork.has(windowKey));
        offeredWork.add(windowKey);
      }
      if (canRequestBreak(run) && run.stats.cash >= 12 && (run.stats.energy < 35 || run.stats.mood < 45)) {
        run = requestBreak(run); row.restRequests++;
      } else if (canRequestCareer(run) && run.stats.energy > 30 && run.stats.mood > 35) {
        run = requestCareer(run);
      }
      event = getEvent(run);
      if (event.id === 'pip-review') {
        row.pipReviews++;
        row.pipWorkLengths[pipWork] = (row.pipWorkLengths[pipWork] || 0) + 1;
        assert.equal(pipWork, 3, `PIP must provide three actual work scenes: ${run.seed}`);
        pipWork = null;
      }
      if (event.id === 'career-review') {
        row.careerMenus++;
      }
      const index = pick(visibleEvent(event), { ...run.stats }, policy, run.turn);
      assert.ok(event.choices[index] && event.choices[index].available !== false, `${event.id}/${index}`);
      const before = run;
      const chosen = applyChoice(run, index);
      const result = { ...chosen.history.at(-1), effect: chosen.pendingEffect };
      if (event.id === 'career-review') {
        row.careerApplications += Number(index < 2);
        row.careerTraining += Number(result.effect === 'careerTrain');
      }
      if (['daily', 'fantasy'].includes(event.kind) && before.pip?.active) pipWork++;
      if (result.effect === 'startPip') pipWork = 0;
      if (result.effect === 'finishBreak') { row.restPurchases++; restSpent += Math.max(0, before.stats.cash - chosen.stats.cash); }
      if (result.effect === 'cancelBreak') row.restCancels++;
      if (event.kind === 'daily' && eventById.has(event.id)) {
        const authored = eventById.get(event.id);
        row.workScenes++;
        const exclusive = authored.roles?.length === 1 && authored.roles[0] === before.actualRoleId;
        if (first) { row.firstWorkExclusive += Number(exclusive); first = false; }
        if (exclusive) row.exclusiveScenes++;
        else if (authored.roles) row.relatedScenes++;
        else row.sharedScenes++;
        sharedStreak = authored.roles ? 0 : sharedStreak + 1;
        row.maxSharedStreak = Math.max(row.maxSharedStreak, sharedStreak);
        row.repeatedWorkScenes += Number(completedWork.has(event.id)); completedWork.add(event.id);
      }
      trace.push({ day: before.turn + 1, eventId: event.id, kind: event.kind, choice: index, effect: result.effect, energy: chosen.stats.energy, mood: chosen.stats.mood, pip: chosen.pip?.remaining ?? null });
      run = advance(chosen);
      assert.equal(validRun(run), true, `${run.seed}/${event.id}`);
      if (run.turn !== before.turn) actionsAtWork = run.actions.length;
      row.maxActionsWithoutWorkProgress = Math.max(row.maxActionsWithoutWorkProgress, run.actions.length - actionsAtWork);
    }
    assert.equal(run.completed, true, run.seed);
    if (attempt === 0) assert.deepEqual(replayRun(roleId, run.seed, run.actions), run);
    if (!witnesses[`${roleId}/${policy}`] || trace.length > witnesses[`${roleId}/${policy}`].trace.length) witnesses[`${roleId}/${policy}`] = { seed: run.seed, ending: run.endingId, trace };
    row.completed++; row.pipRuns += Number(run.pipCount > 0); row.pipEntries += run.pipCount; row.maxPip = Math.max(row.maxPip, run.pipCount);
    row.pipPassedRuns += Number(run.flags.pip_passed > 0); row.promotions += run.flags.promotions || 0; row.chiefs += Number(run.flags.career_peak_rank === 7);
    row.rankPeaks[run.flags.career_peak_rank] = (row.rankPeaks[run.flags.career_peak_rank] || 0) + 1;
    row.salaryCuts += Number(run.salaryCut?.status === 'accepted'); row.directDismissals += Number(run.history.some(item => item.eventId === 'dismissal-final'));
    row.moodCrashes += run.flags.mood_crash_count || 0; row.energyBurnouts += Number(run.endingId.startsWith('burnout-'));
    row.averageFinalDay += run.turn + 1; row.averageRestSpend += restSpent;
  }
  row.averageFinalDay /= count; row.averageRestSpend /= count;
  assert.equal(row.repeatedWorkScenes, 0); assert.ok(row.maxSharedStreak <= 2); assert.ok(row.maxPip <= 2);
  rows.push(row);
  console.log(JSON.stringify(row));
}

mkdirSync('artifacts/player-qa-v21', { recursive: true });
writeFileSync('artifacts/player-qa-v21/pacing-audit.json', JSON.stringify({ method: 'Natural runs, three visible-choice policies; no state injection, outcome inspection or RNG peeking. Repeated work counts committed work choices only; returning after a menu is reported separately.', count, rows, witnesses }, null, 2) + '\n');
