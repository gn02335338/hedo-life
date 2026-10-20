import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROLE_MAP } from '../dist/roles.js';
import { SOURCES } from '../dist/public-sources.js';
import { deriveCharacterStats } from '../dist/character-stats.js';
import { createRun, getEvent, applyChoice, advance, requestBreak, requestCareer, requestRaise, requestExit, requestRage, canRequestRage, validRun, replayRun, STAT_KEYS } from '../dist/engine.js';
import { validateCompletion } from '../worker/http.js';

const report = JSON.parse(readFileSync(new URL('./fixtures/lowpay-routes-v24.json', import.meta.url)));
const fixture = id => { const result = report.routes.find(route => route.id === id); assert.ok(result, id); return result; };
const from = id => { const route = fixture(id); return replayRun(route.roleId, route.seed, route.actions); };
const clone = value => JSON.parse(JSON.stringify(value));
const handlers = { break: requestBreak, career: requestCareer, raise: requestRaise, exit: requestExit };
function trace(route, saved = false) {
  let run = createRun(route.roleId, route.seed); const rows = [];
  const checkpoint = () => { if (saved) run = clone(run); assert.equal(validRun(run), true, `${route.id}/${run.eventId}`); };
  checkpoint();
  for (let i = 0; i < route.actions.length; i++) {
    const action = route.actions[i], before = clone(run); let pending = null;
    if (action.type === 'choice') {
      assert.equal(run.eventId, action.eventId); run = applyChoice(run, action.index); checkpoint(); pending = clone(run);
      if (!(route.actions[i + 1]?.type === 'rage' && route.actions[i + 1].phase === 'result')) run = advance(run);
    } else if (action.type === 'rage') {
      run = Object.hasOwn(action, 'target') ? requestRage(run, action.target) : requestRage(run); checkpoint(); pending = clone(run); run = advance(run);
    } else { const previous = run; run = handlers[action.type](run); assert.notEqual(previous, run); }
    checkpoint(); rows.push({ action, before, pending, after: clone(run) });
  }
  return { run, rows };
}
function dailyQueue() {
  const run = from('deferred-mood');
  return { ...run, eventId: 'jack-notebook', meltdownReturnEventId: null, resumeEventId: null, exitReturnEventId: null,
    breakReturnEventId: null, banquetReturnEventId: null, raiseContext: null, rageContext: null, personnelPending: null,
    stats: { ...run.stats, mood: 80, energy: 80, cash: 80, boss: 60 } };
}
const proof = route => ({ runId: '43c54443-b49b-46cb-8c67-dd182507648d', roleId: route.roleId, seed: route.seed, actions: route.actions });

test('e24 low-pay advice has thirteen natural save-compatible canonical witnesses and complete continuations', () => {
  assert.match(report.method, /no .*injection/i); assert.equal(report.routes.length, 13);
  for (const route of report.routes) {
    assert.match(route.seed, /^e24-/);
    const direct = trace(route).run, saved = trace(route, true).run;
    assert.deepEqual(saved, direct, route.id); assert.deepEqual(replayRun(route.roleId, route.seed, route.actions), direct);
    for (const key of ['eventId', 'pay', 'turn', 'completed', 'salaryAdvice']) assert.deepEqual(direct[key], route.expected[key], `${route.id}/${key}`);
    assert.doesNotThrow(() => validateCompletion(proof(route), ROLE_MAP));
    if (route.completionActions) {
      const complete = trace({ ...route, actions: route.completionActions }, true).run;
      assert.equal(complete.completed, true); assert.equal(complete.salaryAdvice, null);
      assert.deepEqual(replayRun(route.roleId, route.seed, route.completionActions), complete);
    }
  }
});

test('an actual accepted cut below 30K triggers once; an initial low offer, unaccepted proposal and exactly 30K do not', () => {
  const offer = from('proposal-below-30'); assert.ok(offer.salaryCut.to < 30); assert.ok(offer.pay >= 30);
  assert.equal(offer.salaryAdvice, null); const untouched = clone(offer); getEvent(offer); assert.equal(advance(offer), offer); assert.deepEqual(offer, untouched);
  const accepted = from('accepted-cut'); assert.equal(accepted.eventId, 'low-pay-tip'); assert.equal(accepted.salaryAdvice.from, offer.pay);
  assert.equal(accepted.pay, offer.salaryCut.to); assert.equal(accepted.salaryCut.status, 'accepted');
  const pending = applyChoice(offer, 0); assert.equal(pending.salaryAdvice.status, 'queued'); assert.equal(pending.rng, accepted.rng);
  assert.equal(pending.turn, accepted.turn); assert.equal(accepted.pay < 30, true);
  const thirty = from('cut-to-30'); assert.equal(thirty.pay, 30); assert.equal(thirty.salaryCut.status, 'accepted'); assert.equal(thirty.salaryAdvice, null);
  const initial = { ...createRun('design', 'e24-initial-low-offer'), pay: 25, basePay: 25, offerPay: 25 };
  assert.equal(validRun(initial), true); const started = advance(applyChoice(initial, 0)); assert.equal(started.pay, 25); assert.equal(started.salaryAdvice, null);
});

test('all advice choices preserve the exact interrupted scene, workday, PIP clock and RNG while recording visible consequences', () => {
  const source = from('accepted-cut');
  for (const pip of [null, { active: true, remaining: 2 }]) for (const index of [0, 1, 2]) {
    const run = { ...clone(source), pip, pipCount: pip ? 1 : source.pipCount }, saved = clone(run), event = getEvent(run);
    assert.equal(validRun(run), true); assert.equal(event.speaker, 'erich'); assert.equal(event.kind, 'crisis');
    getEvent(run); deriveCharacterStats(run); assert.deepEqual(run, saved); assert.equal(advance(run), run);
    assert.equal(requestExit(run), run); assert.equal(requestBreak(run), run); assert.equal(requestCareer(run), run); assert.equal(requestRaise(run), run);
    const pending = applyChoice(run, index), after = advance(pending), last = pending.history.at(-1);
    assert.equal(last.eventId, 'low-pay-tip'); assert.equal(last.speaker, 'erich'); assert.ok(last.delta.mood > 0);
    for (const key of STAT_KEYS) assert.equal(last.breakdown.reduce((sum, row) => sum + (row.delta[key] || 0), 0), last.delta[key]);
    assert.equal(after.eventId, run.salaryAdvice.returnEventId); assert.equal(after.salaryAdvice.status, 'done'); assert.equal(after.salaryAdvice.returnEventId, null);
    for (const key of ['turn', 'rng', 'pay', 'rank', 'actualRoleId', 'lastBreakTurn']) assert.equal(after[key], run[key], key);
    assert.deepEqual(after.pip, run.pip); assert.equal(validRun(after), true); assert.equal(after.stats.boss, run.stats.boss);
  }
});

test('actual unpaid-leave reductions also queue the advice, and fresh reductions update only an unopened notice', () => {
  const unpaid = from('unpaid-leave-cut'); assert.equal(unpaid.pay, 29); assert.equal(unpaid.salaryAdvice.from, 32);
  assert.equal(unpaid.history[unpaid.salaryAdvice.historyIndex].eventId, 'mood-collapse');
  const mood = from('deferred-mood'); assert.equal(mood.eventId, 'mood-collapse'); assert.equal(mood.salaryAdvice.status, 'queued');
  const lower = applyChoice(mood, 1); assert.equal(lower.pay, Math.round(mood.pay * .9)); assert.equal(lower.salaryAdvice.from, mood.pay);
  assert.equal(lower.salaryAdvice.to, lower.pay); assert.equal(lower.salaryAdvice.historyIndex, lower.history.length - 1); assert.equal(validRun(lower), true);
  const done = from('tip-choice-0'), repeat = { ...clone(done), eventId: 'mood-collapse', meltdownReturnEventId: done.eventId,
    stats: { ...done.stats, mood: 0, energy: 80, cash: 80 } };
  assert.equal(validRun(repeat), true); const repeated = advance(applyChoice(repeat, 1));
  assert.ok(repeated.pay < done.pay); assert.equal(repeated.salaryAdvice.status, 'done'); assert.equal(repeated.eventId, done.eventId);
  assert.equal(repeated.history.filter(row => row.eventId === 'low-pay-tip').length, 1); assert.equal(validRun(repeated), true);
});

test('urgent zero-mood and personnel scenes finish before the queued advice; active PIP itself does not block it', () => {
  const mood = from('deferred-mood'); assert.equal(mood.stats.mood, 0); assert.equal(mood.salaryAdvice.status, 'queued');
  const after = advance(applyChoice(mood, 0)); assert.equal(after.stats.mood > 0, true); assert.equal(after.salaryAdvice.status, 'open'); assert.equal(after.eventId, 'low-pay-tip');
  let personnel = { ...dailyQueue(), eventId: 'crisis-boss', resumeEventId: 'jack-notebook', flags: { ...dailyQueue().flags, hr_pip_allowed: 1 } };
  assert.equal(validRun(personnel), true); personnel = advance(applyChoice(personnel, 1));
  assert.equal(personnel.eventId, 'paperwork'); assert.equal(personnel.salaryAdvice.status, 'queued');
  const start = getEvent(personnel).choices.findIndex(choice => choice.effect === 'startPip' && choice.available !== false); assert.ok(start >= 0);
  personnel = advance(applyChoice(personnel, start)); assert.equal(personnel.eventId, 'low-pay-tip'); assert.equal(personnel.pip.active, true); assert.equal(personnel.pip.remaining, 3);
  assert.equal(validRun(personnel), true);
});

test('queued advice waits across salary-talk, banquet and imagined-rage contexts and clears if a confirmed raise restores 30K', () => {
  const base = dailyQueue(); assert.equal(validRun(base), true);
  let salary = { ...clone(base), eventId: 'raise-response', raiseContext: {
    eventId: base.eventId, fromPay: base.pay, offerPay: null, percent: null, outcome: 'promise', view: 'promise', approach: 'merit' } };
  assert.equal(validRun(salary), true); assert.equal(advance(salary), salary); getEvent(salary); assert.equal(salary.salaryAdvice.status, 'queued');
  const closed = advance(applyChoice(salary, 2)); assert.equal(closed.raiseContext, null); assert.equal(closed.eventId, 'low-pay-tip');
  let banquet = { ...clone(base), eventId: 'banquet-welcome', banquetReturnEventId: base.eventId };
  assert.equal(validRun(banquet), true);
  for (const index of [0, 0, 3]) {
    const wasFinal = banquet.eventId === 'banquet-afterparty'; banquet = advance(applyChoice(banquet, index));
    assert.equal(validRun(banquet), true); assert.equal(banquet.salaryAdvice.status, wasFinal ? 'open' : 'queued');
  }
  assert.equal(banquet.eventId, 'low-pay-tip'); assert.equal(banquet.salaryAdvice.returnEventId, base.eventId);
  let dream = null;
  for (let draw = 0; draw < 30 && !dream; draw++) {
    const boundary = { ...clone(base), rng: createRun('system', `e24-queued-dream-${draw}`).rng, flags: { ...base.flags } };
    delete boundary.flags.rage_last_turn;
    assert.equal(validRun(boundary), true);
    const pending = requestRage(boundary);
    if (pending.rageContext?.mode === 'imagined') dream = pending;
  }
  assert.ok(dream); assert.equal(dream.salaryAdvice.status, 'queued'); const woke = advance(dream);
  assert.equal(woke.rageContext, null); assert.equal(woke.eventId, 'low-pay-tip'); assert.equal(woke.salaryAdvice.returnEventId, base.eventId);
  salary = { ...clone(base), eventId: 'raise-confirmation', raiseContext: {
    eventId: base.eventId, fromPay: base.pay, offerPay: 31, percent: 10, outcome: 'offer', view: 'offer', approach: 'merit' } };
  assert.equal(validRun(salary), true); const restored = advance(applyChoice(salary, 0)); assert.equal(restored.pay, 31);
  assert.equal(restored.salaryAdvice, null); assert.equal(restored.eventId, base.eventId); assert.equal(validRun(restored), true);
});

test('a natural dream after accepting the cut resumes the already committed reduction before opening the advice exactly once', () => {
  const route = fixture('cut-result-dream-opens-tip'), { run, rows } = trace(route, true), step = rows.at(-1);
  assert.equal(step.action.eventId, 'salary-cut'); assert.equal(step.action.phase, 'result');
  assert.equal(step.pending.rageContext.mode, 'imagined'); assert.equal(step.pending.salaryAdvice.status, 'queued');
  assert.equal(run.eventId, 'low-pay-tip'); assert.equal(run.pay, 24); assert.equal(run.salaryAdvice.status, 'open');
  assert.equal(run.history.filter(row => row.eventId === 'salary-cut').length, 1);
  const back = advance(applyChoice(run, 0)); assert.equal(back.eventId, run.salaryAdvice.returnEventId);
  assert.equal(back.history.filter(row => row.eventId === 'low-pay-tip').length, 1);
  assert.equal(back.history.filter(row => row.eventId === 'salary-cut').length, 1);
  assert.deepEqual(replayRun(back.roleId, back.seed, back.actions), back); assert.equal(validRun(back), true);
});

test('both natural rage modes target the speaking law chief; event and result interruptions resume or end canonically', () => {
  for (const phase of ['event', 'result']) for (const mode of ['imagined', 'real']) {
    const route = fixture(`tip-${phase}-rage-${mode}`), { run, rows } = trace(route, true), step = rows.at(-1);
    assert.equal(step.action.type, 'rage'); assert.equal(step.action.phase, phase); assert.equal(step.action.eventId, 'low-pay-tip');
    assert.equal(step.pending.rageContext.target, 'erich'); assert.equal(step.pending.rageContext.mode, mode);
    const before = deriveCharacterStats(step.before).find(row => row.id === 'erich'), after = deriveCharacterStats(run).find(row => row.id === 'erich');
    assert.equal(after.realHits - before.realHits, Number(mode === 'real')); assert.equal(after.imaginedHits - before.imaginedHits, Number(mode === 'imagined'));
    if (mode === 'imagined') {
      assert.equal(run.salaryAdvice.status, phase === 'event' ? 'open' : 'done');
      assert.equal(run.eventId, phase === 'event' ? 'low-pay-tip' : step.before.salaryAdvice.returnEventId);
      assert.equal(run.turn, step.before.turn);
    } else { assert.equal(run.rageContext.target, 'erich'); assert.equal(run.eventId, 'rage-aftermath'); }
  }
});

test('low-pay advice validates the actual historical reduction and never promises that any number below 30K is automatically unlawful', () => {
  const open = from('accepted-cut'), event = getEvent(open); assert.ok(event.sourceIds.every(id => SOURCES[id]));
  assert.match(event.body, /2026.*29,500/); assert.match(event.body, /正常工時/); assert.match(event.body, /約定月薪.*請假扣款.*實領金額/);
  assert.match(event.body, /諮詢.*調解.*訴訟/); assert.doesNotMatch(event.body, /一定違法|一定告得贏|保證勝訴/); assert.equal(event.choices.some(choice => choice.wild), true);
  for (const choice of event.choices) { assert.equal(choice.detail, ''); assert.doesNotMatch(choice.text, /成功率|[%％]|[+-]\d+/); }
  for (const salaryAdvice of [undefined, {}, { ...open.salaryAdvice, to: 30 }, { ...open.salaryAdvice, from: 1 },
    { ...open.salaryAdvice, from: open.salaryAdvice.from + 1 }, { ...open.salaryAdvice, historyIndex: 0 },
    { ...open.salaryAdvice, historyIndex: open.history.length }, { ...open.salaryAdvice, status: 'invented' },
    { ...open.salaryAdvice, extra: true }, { ...open.salaryAdvice, returnEventId: 'onboarding' },
    { ...open.salaryAdvice, returnEventId: 'low-pay-tip' }, { ...open.salaryAdvice, status: 'done', returnEventId: null }]) {
    assert.equal(validRun({ ...clone(open), salaryAdvice }), false, JSON.stringify(salaryAdvice));
  }
  const forgedHistory = clone(open); forgedHistory.history[open.salaryAdvice.historyIndex].pay++;
  assert.equal(validRun(forgedHistory), false); assert.equal(validRun({ ...clone(open), salaryAdvice: null }), false);
});
