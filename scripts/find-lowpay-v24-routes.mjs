import { writeFileSync } from 'node:fs';
import { ROLES } from '../dist/roles.js';
import { createRun, getEvent, applyChoice, advance, requestBreak, requestCareer, requestRaise, requestExit, requestRage, canRequestRage, replayRun, validRun } from '../dist/engine.js';
import { simulate } from '../tests/find-routes-v3.mjs';

const found = new Map();
const routeOf = (id, run, extra = {}) => ({ id, roleId: run.roleId, seed: run.seed, actions: run.actions, expected: {
  eventId: run.eventId, pay: run.pay, turn: run.turn, completed: run.completed, salaryAdvice: run.salaryAdvice,
}, ...extra });
function record(id, run, extra) {
  if (found.has(id)) return;
  if (!validRun(run)) throw new Error(`Invalid natural witness ${id}: ${run.eventId}`);
  if (run.pending) throw new Error(`Uncommitted witness ${id}`);
  if (!/^e24-/.test(run.seed)) throw new Error('The normal route finder must use current e24 seeds');
  found.set(id, routeOf(id, run, extra));
}
function complete(run, depth = 7) {
  if (run.completed) return run;
  if (depth <= 0) return null;
  const exit = requestExit(run);
  if (exit !== run) {
    for (const index of [0, 1, 2]) if (getEvent(exit).choices[index]?.available !== false) {
      const ended = advance(applyChoice(exit, index));
      if (ended.completed) return ended;
    }
  }
  for (const [index, choice] of getEvent(run).choices.entries()) if (choice.available !== false) {
    const ended = complete(advance(applyChoice(run, index)), depth - 1);
    if (ended) return ended;
  }
  return null;
}
function inspectTip(run) {
  if (run.eventId !== 'low-pay-tip') return;
  record('accepted-cut', run);
  for (const [index, choice] of getEvent(run).choices.entries()) if (choice.available !== false) {
    const after = advance(applyChoice(run, index)), ended = complete(after);
    if (!ended) throw new Error(`No ending after salary advice choice ${index}`);
    record(`tip-choice-${index}`, after, { completionActions: ended.actions });
  }
  for (const phase of ['event', 'result']) {
    const before = phase === 'event' ? run : applyChoice(run, 0);
    if (!canRequestRage(before)) continue;
    const pending = requestRage(before), mode = pending.rageContext.mode, after = advance(pending), ended = complete(after);
    if (!ended) throw new Error(`No ending after ${phase} ${mode} advice rage`);
    record(`tip-${phase}-rage-${mode}`, after, { phase, mode, completionActions: ended.actions });
  }
}
function seekTip(start, depth = 7) {
  if (start.completed || !start.salaryAdvice || depth < 0) return;
  if (start.eventId === 'low-pay-tip') { inspectTip(start); return; }
  if (start.salaryAdvice.status !== 'queued') return;
  if (start.eventId === 'mood-collapse') record('deferred-mood', start);
  const choices = [...getEvent(start).choices.entries()].filter(([, choice]) => choice.available !== false);
  if (start.eventId === 'crisis-mood') choices.sort(([a], [b]) => (a === 1 ? -1 : b === 1 ? 1 : a - b));
  for (const [index] of choices) {
    seekTip(advance(applyChoice(start, index)), depth - 1);
    if (found.has('accepted-cut')) break;
  }
}
function inspect(run) {
  if (run.pending || run.completed) return;
  if (run.eventId === 'low-pay-tip') inspectTip(run);
  if (['salary-cut', 'salary-final'].includes(run.eventId)) {
    if (run.salaryCut.to < 30 && !run.salaryAdvice) {
      record('proposal-below-30', run);
      const accepted = applyChoice(run, 0);
      if (canRequestRage(accepted)) {
        const dream = requestRage(accepted);
        if (dream.rageContext.mode === 'imagined') {
          const resumed = advance(dream);
          if (resumed.eventId === 'low-pay-tip') record('cut-result-dream-opens-tip', resumed);
        }
      }
      seekTip(advance(accepted));
    }
    if (run.salaryCut.to === 30 && !run.salaryAdvice) {
      const after = advance(applyChoice(run, 0));
      if (!after.completed) record('cut-to-30', after);
    }
  }
  if (run.eventId === 'mood-collapse' && !run.salaryAdvice && Math.round(run.pay * .9) < 30) {
    const after = advance(applyChoice(run, 1));
    if (!after.completed && after.salaryAdvice) { record('unpaid-leave-cut', after); seekTip(after); }
  }
}
function visit(route) {
  let run = createRun(route.roleId, route.seed);
  inspect(run);
  for (let i = 0; i < route.actions.length; i++) {
    const action = route.actions[i];
    if (action.type === 'choice') {
      run = applyChoice(run, action.index);
      if (!(route.actions[i + 1]?.type === 'rage' && route.actions[i + 1].phase === 'result')) run = advance(run);
    } else if (action.type === 'rage') run = advance(Object.hasOwn(action, 'target') ? requestRage(run, action.target) : requestRage(run));
    else run = ({ break: requestBreak, career: requestCareer, raise: requestRaise, exit: requestExit })[action.type](run);
    inspect(run);
  }
}
const expected = ['proposal-below-30', 'accepted-cut', 'cut-to-30', 'deferred-mood', 'unpaid-leave-cut', 'cut-result-dream-opens-tip',
  ...[0, 1, 2].map(index => `tip-choice-${index}`), ...['event', 'result'].flatMap(phase => ['imagined', 'real'].map(mode => `tip-${phase}-rage-${mode}`))];
for (let attempt = 0; attempt < 600 && expected.some(id => !found.has(id)); attempt++) {
  for (const role of ROLES.filter(role => role.id !== 'executive')) {
    visit(simulate(role.id, ['broke', 'historian', 'nasdaq', 'cold_storage', 'promotion', 'second_offer'][attempt % 6], attempt, {seedPrefix:'e24'}).route);
  }
}
const missing = expected.filter(id => !found.has(id));
if (missing.length) throw new Error(`Missing e24 natural witnesses: ${missing.join(', ')}`);
const routes = [...found.values()];
for (const route of routes) {
  const after = replayRun(route.roleId, route.seed, route.actions);
  if (!validRun(after)) throw new Error(`Invalid replay ${route.id}`);
  for (const key of ['eventId', 'pay', 'turn', 'completed']) if (after[key] !== route.expected[key]) throw new Error(`Replay drift ${route.id}/${key}`);
  if (JSON.stringify(after.salaryAdvice) !== JSON.stringify(route.expected.salaryAdvice)) throw new Error(`Advice drift ${route.id}`);
  if (route.completionActions && !replayRun(route.roleId, route.seed, route.completionActions).completed) throw new Error(`Incomplete continuation ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/lowpay-routes-v24.json', import.meta.url), JSON.stringify({
  method: 'Natural e24 createRun seeds, normal game choices and canonical replay only; no event, role, stat, flag, history, salary or RNG state injection. Actual accepted cuts, pending offers, the 30K boundary, unpaid leave, mood deferral, all advice choices and both rage modes have replay witnesses.', routes
}, null, 2) + '\n');
console.log(`Verified ${routes.length} natural e24 low-pay advice witnesses.`);
