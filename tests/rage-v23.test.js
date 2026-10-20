import test from 'node:test';
import assert from 'node:assert/strict';
import { getRageV14, RAGE_NAMES } from '../dist/rage-v14.js';
import { getRageV22, rageTargetForV22 } from '../dist/rage-v22.js';
import { getRageV23, rageTargetForV23 } from '../dist/rage-v23.js';

const PEOPLE = { sophie: '紅茶', jonathan: '強哥', owen: '歐文', sam: '山姆', cindy: '辛蒂' };
const NAMES = { ...RAGE_NAMES, jack: '傑克', meimei: '水蛇', helen: '前女友', ...PEOPLE };
const WORLD = ['rage-aftermath', 'rage-legal', 'rage-showdown', 'rage-public'];
function runFor(target, { mood = 50, eventId = 'rage-release', phase = 'event', energy = 70 } = {}) {
  return { seed: 'e23-five-voices', rng: 2987324731, turn: 9, eventId,
    stats: { mood, energy, boss: 44 },
    rageContext: { target, eventId: `${target}-workday`, phase } };
}

test('e23 targets come only from the five explicit speakers, never a name in prose', () => {
  for (const speaker of Object.keys(PEOPLE)) assert.equal(rageTargetForV23({ speaker }), speaker);
  for (const event of [null, {}, { speaker: 'wing', body: Object.values(PEOPLE).join('、') },
    { speaker: 'outsider', participants: Object.keys(PEOPLE) },
    ...Object.keys(NAMES).filter(id => !Object.hasOwn(PEOPLE, id)).map(speaker => ({ speaker }))]) {
    assert.equal(rageTargetForV23(event), rageTargetForV22(event));
  }
});

test('all previously published rage targets delegate exactly to e22', () => {
  for (const target of Object.keys(NAMES).filter(id => !Object.hasOwn(PEOPLE, id))) {
    for (const eventId of ['rage-release', ...WORLD]) for (const mood of [0, 25, 26, 64, 65, 100]) {
      for (const phase of ['event', 'result']) {
        const run = runFor(target, { eventId, mood, phase });
        assert.deepEqual(getRageV23(run), getRageV22(run), `${target}/${eventId}/${mood}/${phase}`);
      }
    }
  }
});

test('five distinct dreams reveal no outcome before the seeded draw and keep real incidents separate', () => {
  const dreams = new Set();
  for (const [target, name] of Object.entries(PEOPLE)) {
    for (const [mood, realWeight] of [[0, 51], [25, 51], [26, 28], [64, 28], [65, 16], [100, 16]]) {
      for (const phase of ['event', 'result']) {
        const run = runFor(target, { mood, phase }), before = structuredClone(run), event = getRageV23(run);
        assert.deepEqual(run, before, 'opening an event neither edits a save nor draws RNG');
        assert.equal(event.speaker, target); assert.match(event.body, new RegExp(name));
        assert.equal(event.kind, 'rage'); assert.equal(event.choices.length, 1);
        const choice = event.choices[0], [dream, real] = choice.draw.outcomes;
        assert.equal(choice.rageTarget, target); assert.equal(choice.result, ''); assert.equal(choice.detail, '');
        assert.doesNotMatch(choice.text, /機率|成功率|%|％|[+-]\d+/);
        assert.deepEqual(choice.draw.outcomes.map(row => row.weight), [100 - realWeight, realWeight]);
        assert.equal(dream.effect, 'rageReturn'); assert.deepEqual(dream.flags, ['rage_imagined', 'rage_catharsis']);
        assert.equal(real.effect, 'rageAftermath'); assert.deepEqual(real.flags, ['rage_real']);
        assert.match(dream.result, /腦內幻想/); assert.match(dream.result, /沒有人真的挨打/);
        assert.match(dream.result, /雙手仍放在膝上/); assert.doesNotMatch(dream.result, /漫畫/);
        assert.match(real.result, /同事立刻把你們隔開/); assert.match(real.result, /卻沒有醒來/);
        assert.match(real.result, /真的對眼前的人動了手/);
        for (const outcome of [dream, real]) assert.match(outcome.result, phase === 'result' ? /剛才已經回了話/ : /話還沒講完/);
      }
    }
    dreams.add(getRageV23(runFor(target)).choices[0].draw.outcomes[0].result);
  }
  assert.equal(dreams.size, 5);
});

test('new targets reach every established aftermath using their own name and unchanged mechanics', () => {
  for (const [target, name] of Object.entries(PEOPLE)) for (const eventId of WORLD) {
    for (const energy of [10, 35, 36, 90]) {
      const run = runFor(target, { eventId, energy }), before = structuredClone(run);
      assert.deepEqual(getRageV23(run), getRageV14(run, NAMES));
      assert.deepEqual(run, before);
      const event = getRageV23(run);
      assert.equal(event.kind, 'rage-world'); assert.ok(event.choices.some(choice => choice.wild));
      assert.doesNotMatch(JSON.stringify(event), /undefined/);
      if (eventId !== 'rage-public') assert.match(event.body, new RegExp(name));
      if (eventId === 'rage-showdown') assert.equal(event.speaker, target);
    }
  }
});
