import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROLES, ROLE_MAP } from '../dist/roles.js';
import { EVENTS } from '../dist/events.js';
import { SOURCES } from '../dist/public-sources.js';
import { PERSONAS } from '../dist/persona.js';
import { careerMaxRank } from '../dist/career-api.js';
import { deriveCharacterStats, characterAffinity } from '../dist/character-stats.js';
import { createRun, getEvent, applyChoice, advance, requestBreak, requestCareer, requestRaise, requestRage, getRageTargets, canRequestBreak, canRequestCareer, canRequestRaise, validRun, replayRun, STAT_KEYS } from '../dist/engine.js';
import { validateCompletion } from '../worker/http.js';

const routes = JSON.parse(readFileSync(new URL('./fixtures/chronicle-routes-v23.json', import.meta.url))).routes;
const people = ['sophie', 'jonathan', 'owen', 'sam', 'cindy'];
const newEvents = EVENTS.filter(event => event.minRules === 23);
const rowFor = (run, id) => deriveCharacterStats(run).find(row => row.id === id);
const body = route => ({ runId: '54f51683-00db-4a1b-b025-b6fc0d423109', roleId: route.roleId, seed: route.seed, actions: route.actions });

test('twenty e23 scenes cover all five new voices without rewriting published event pools', () => {
  assert.equal(newEvents.length, 20);
  assert.equal(EVENTS.filter(event => (event.minRules || 1) <= 22).length, 303);
  assert.equal(new Set(EVENTS.map(event => event.id)).size, EVENTS.length);
  for (const person of people) assert.equal(newEvents.filter(event => event.speaker === person).length, 4, person);
  for (const event of newEvents) {
    assert.ok(PERSONAS[event.speaker], event.id);
    assert.ok(event.sourceIds.length && event.sourceIds.every(id => SOURCES[id]), event.id);
    assert.equal(event.choices.length, 3); assert.ok(event.choices.some(choice => choice.wild), event.id);
    if (event.roles) assert.ok(event.roles.every(id => ROLE_MAP[id]), event.id);
    for (const choice of event.choices) {
      assert.equal(choice.detail, ''); assert.ok(choice.result.length > 15, event.id);
      assert.doesNotMatch(choice.text, /成功率|機率|[%％]|[+-]\d+/, event.id);
      assert.ok(Object.entries(choice.delta).every(([key, value]) => STAT_KEYS.includes(key) && Number.isInteger(value)), event.id);
    }
  }
});

test('e23 retains the full career, finite ability budget and current intervention gates', () => {
  for (const role of ROLES) {
    const initial = createRun(role.id, `e23-inherit-${role.id}`);
    assert.equal(careerMaxRank(initial), 7);
    assert.equal(initial.rank, role.id === 'executive' ? 5 : initial.assignment === 'assistant' ? 0 : 1);
    assert.equal(initial.raiseContext, null); assert.equal(initial.personnelPending, null);
    assert.equal(initial.meltdownReturnEventId, null); assert.equal(initial.rageContext, null);
    assert.ok(initial.stats.skill + initial.stats.slack + initial.stats.lick <= 180);
    assert.equal(validRun(initial), true);
  }
  const initial = createRun('system', 'e23-controls');
  const run = { ...initial, eventId: 'jack-notebook', turn: 6, educationReviewed: true,
    stats: { ...initial.stats, mood: 80, energy: 80, cash: 80, boss: 65 },
    history: Array.from({ length: 3 }, () => ({ kind: 'daily', choiceIndex: 0, eventId: 'jack-notebook' })) };
  assert.equal(canRequestBreak(run), true); assert.equal(canRequestCareer(run), true); assert.equal(canRequestRaise(run), true);
  assert.equal(requestCareer(run).eventId, 'career-review'); assert.equal(requestRaise(run).eventId, 'raise-request');
  assert.ok(['self-care', 'kind-break'].includes(requestBreak(run).eventId));
  const pip = { ...run, pip: { active: true, remaining: 3 }, pipCount: 1 };
  assert.equal(canRequestCareer(pip), false); assert.equal(canRequestRaise(pip), false); assert.equal(canRequestBreak(pip), true);
  const watch = { ...run, flags: { ...run.flags, floor_watch: 1 } };
  assert.equal(canRequestCareer(watch), false); assert.equal(canRequestRaise(watch), false);
});

test('every new scene has a natural canonical prefix and records only its committed dialogue', () => {
  const witnesses = routes.filter(route => newEvents.some(event => event.id === route.id));
  assert.equal(witnesses.length, 20);
  assert.deepEqual(new Set(witnesses.map(route => route.eventId)), new Set(newEvents.map(event => event.id)));
  for (const route of witnesses) {
    const before = replayRun(route.roleId, route.seed, route.actions.slice(0, -1));
    assert.equal(before.eventId, route.eventId); assert.equal(before.pending, false);
    const event = getEvent(before), saved = structuredClone(before), stats = rowFor(before, event.speaker);
    getEvent(before); characterAffinity(before, event.speaker); assert.deepEqual(before, saved);
    const pending = applyChoice(before, 0), after = advance(pending);
    assert.equal(rowFor(pending, event.speaker).encounters - stats.encounters, 1);
    assert.equal(rowFor(pending, event.speaker).realHits, stats.realHits);
    assert.equal(rowFor(pending, event.speaker).imaginedHits, stats.imaginedHits);
    assert.equal(validRun(after), true, route.id);
    assert.deepEqual(replayRun(route.roleId, route.seed, route.actions), after, route.id);
    assert.doesNotThrow(() => validateCompletion(body(route), ROLE_MAP));
    assert.ok(pending.stats.skill + pending.stats.slack + pending.stats.lick <= 180);
  }
});

test('both seeded rage modes per new character preserve encounters, affinity and canonical replay', () => {
  for (const person of people) for (const mode of ['imagined', 'real']) {
    const route = routes.find(route => route.id === `${person}-${mode}`); assert.ok(route);
    const before = replayRun(route.roleId, route.seed, route.actions.slice(0, -1)), previous = rowFor(before, person);
    const pending = requestRage(before), after = advance(pending), actual = rowFor(after, person);
    assert.equal(pending.pending, true); assert.equal(pending.rageContext.mode, mode);
    assert.equal(pending.history.at(-1).speaker, person);
    assert.equal(actual.encounters - previous.encounters, 1);
    assert.equal(actual.imaginedHits - previous.imaginedHits, Number(mode === 'imagined'));
    assert.equal(actual.realHits - previous.realHits, Number(mode === 'real'));
    if (mode === 'imagined') assert.equal(actual.affinityLost, previous.affinityLost);
    else assert.ok(actual.affinityLost > previous.affinityLost);
    assert.equal(validRun(pending), true); assert.equal(validRun(after), true);
    assert.deepEqual(replayRun(route.roleId, route.seed, route.actions), after);
    assert.doesNotThrow(() => validateCompletion(body(route), ROLE_MAP));
  }
});

test('new group scenes accept only a present target, while forged replay fields remain invalid', () => {
  const groups = routes.filter(route => route.id.startsWith('group-')); assert.equal(groups.length, 6);
  for (const route of groups) {
    const before = replayRun(route.roleId, route.seed, route.actions.slice(0, -1));
    assert.equal(getRageTargets(before).length, 2); assert.ok(getRageTargets(before).includes(route.target));
    const after = advance(requestRage(before, route.target));
    assert.deepEqual(replayRun(route.roleId, route.seed, route.actions), after);
    const absent = people.find(id => !getRageTargets(before).includes(id));
    assert.equal(requestRage(before, absent), before);
    assert.throws(() => replayRun(route.roleId, route.seed, [...route.actions.slice(0, -1), { ...route.actions.at(-1), target: absent }]));
  }
  const initial = createRun('system', 'e23-forged-target');
  for (const action of [{ type: 'raise', amount: 999 }, { type: 'rage', phase: 'event', eventId: 'onboarding', target: 'outsider' },
    { type: 'rage', phase: 'event', eventId: 'onboarding', result: 'real' }]) {
    assert.throws(() => validateCompletion(body({ roleId: initial.roleId, seed: initial.seed, actions: [action] }), ROLE_MAP));
  }
  for (const target of people) assert.throws(() => replayRun(initial.roleId, initial.seed,
    [{ type: 'rage', phase: 'event', eventId: 'onboarding', target }]));
});
