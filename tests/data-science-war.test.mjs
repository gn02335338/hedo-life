import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CLOSING, OPENING, TOPICS } from '../dist/data-science-war/cases.js';
import { SAVE_KEY, advanceMeeting, buildAgenda, createMeeting, restoreMeeting, saveMeeting } from '../dist/data-science-war/game.js';

const advance = (state) => advanceMeeting(state, { type: 'advance' });
const reply = (state, choice, evidence) => advanceMeeting(state, { type: 'reply', reply: choice, evidence });
const rebut = (state) => reply(state, 'challenge', state.agenda[state.index].rebuttal);

test('sessions keep original opening and closing and sample distinct modern topics', () => {
  const agendas = new Set();
  for (let seed = 0; seed < 100; seed++) {
    const agenda = buildAgenda(seed);
    assert.equal(agenda.length, 6);
    assert.deepEqual(agenda.slice(0, 2), OPENING);
    assert.equal(agenda.at(-1), CLOSING);
    const modern = agenda.slice(2, 5);
    assert.equal(new Set(modern).size, 3);
    assert.ok(modern.every((scene) => TOPICS.includes(scene)));
    agendas.add(modern.map(({ id }) => id).join(','));
  }
  assert.ok(agendas.size > 5);
  assert.deepEqual(buildAgenda(84), buildAgenda(84));
  for (const scene of [...OPENING, ...TOPICS, CLOSING]) {
    assert.equal(new Set(scene.evidence.map(({ id }) => id)).size, 3);
    assert.ok(scene.evidence.some(({ id }) => id === scene.rebuttal));
    assert.deepEqual(scene.replies.map(({ id }) => id), ['challenge', 'mediate', 'observe']);
  }
});

test('rebuts only with selected evidence, with rage transformation and a battle result on the same round', () => {
  const start = createMeeting(29);
  assert.equal(reply(start, 'challenge'), start);
  assert.equal(advance(start), start);
  const wrong = reply(start, 'challenge', 'soda');
  assert.equal(wrong.report.title, '反駁失焦');
  assert.equal(wrong.correct, 0);
  assert.equal(wrong.credibility, 0);
  const transformed = rebut(advance(rebut(advance(rebut(start)))));
  assert.equal(transformed.rage, 100);
  assert.equal(transformed.correct, 3);
  assert.equal(transformed.transformed, true);
  const fight = advanceMeeting(transformed, { type: 'fight' });
  assert.equal(fight.phase, 'battle');
  assert.equal(advance(fight), fight);
  assert.equal(advanceMeeting(fight, { type: 'battle', result: 'toString' }), fight);
  const won = advanceMeeting(fight, { type: 'battle', result: 'win' });
  assert.equal(won.phase, 'report');
  assert.equal(won.index, transformed.index);
  assert.equal(won.wins, 1);
  assert.ok(won.rage < 100);
  assert.equal(advance(won).index, transformed.index + 1);
  assert.equal(advance(transformed).phase, 'debate');
});

test('all endings are reachable through separate conversation and battle paths', () => {
  const play = (choice, first = createMeeting(84)) => {
    let state = first;
    while (state.phase !== 'ending') {
      if (state.phase === 'debate') state = choice(state);
      else state = advance(state);
    }
    return state;
  };
  const fight = advanceMeeting(createMeeting(84), { type: 'fight' });
  const win = advanceMeeting(fight, { type: 'battle', result: 'win' });
  for (const result of ['lose', 'draw', 'quit']) {
    assert.equal(advanceMeeting(fight, { type: 'battle', result }).phase, 'report');
  }
  assert.equal(play((state) => reply(state, 'mediate')).ending.title, '下週換你主持');
  assert.equal(play((state) => reply(state, 'observe')).ending.title, '只留一份逐字稿');
  assert.equal(play(rebut).ending.title, '洋芋片散會');
  assert.equal(play((state) => reply(state, 'mediate'), win).ending.title, '週五雙主場');
});

test('local replay restores pending battle and declines malformed saves without touching other progress', () => {
  const records = new Map([['hedo-island-v1', 'island progress']]);
  const storage = {
    getItem: (key) => records.get(key),
    setItem: (key, value) => records.set(key, value),
  };
  const state = advanceMeeting(advance(rebut(createMeeting(84))), { type: 'fight' });
  saveMeeting(state, storage);
  assert.deepEqual(restoreMeeting(storage), state);
  assert.equal(records.get('hedo-island-v1'), 'island progress');
  records.set(SAVE_KEY, '{"version":1,"seed":84,"actions":[{"type":"battle","result":"win"}]}');
  assert.equal(restoreMeeting(storage), null);
  assert.doesNotThrow(() => saveMeeting(state, { setItem() { throw new Error('denied'); } }));
});
