import test from 'node:test';
import assert from 'node:assert/strict';
import { getRageV14, RAGE_NAMES } from '../dist/rage-v14.js';
import { getRageV20, rageTargetForV20 } from '../dist/rage-v20.js';
import { getRageV22, rageTargetForV22 } from '../dist/rage-v22.js';

const NAMES = { ...RAGE_NAMES, jack: '傑克', meimei: '水蛇', helen: '前女友' };
const WORLD = ['rage-aftermath', 'rage-legal', 'rage-showdown', 'rage-public'];
const copy = value => JSON.parse(JSON.stringify(value));
function frozen(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(frozen);
    Object.freeze(value);
  }
  return value;
}
function runFor(target = 'helen', options = {}) {
  return {
    seed: 'e22-helen-release', rng: 2987324731, turn: options.turn ?? 9,
    eventId: options.eventId || 'rage-release',
    stats: { mood: options.mood ?? 50, energy: options.energy ?? 70, boss: 44 },
    rageContext: { target, eventId: 'helen-product-roadmap', phase: options.phase || 'event' },
  };
}

test('e22 adds only the explicit Helen speaker to the published target mapping', () => {
  assert.equal(rageTargetForV22({ speaker: 'helen' }), 'helen');
  for (const event of [null, undefined, {}, ...Object.keys(NAMES).filter(id => id !== 'helen').map(speaker => ({ speaker })),
    { id: 'paperwork', speaker: 'exit-team' }, { id: 'crisis-boss', speaker: 'exit-team' },
    { speaker: 'nobody', body: '前女友、海倫、Helen 都只出現在這封信裡。' },
    { speaker: 'wing', participants: ['helen'] }]) {
    assert.equal(rageTargetForV22(event), rageTargetForV20(event));
  }
});

test('legacy targets retain their exact release and aftermath contracts', () => {
  for (const target of Object.keys(NAMES).filter(id => id !== 'helen')) {
    for (const eventId of ['rage-release', ...WORLD]) {
      for (const mood of [0, 25, 26, 64, 65, 100]) {
        for (const phase of ['event', 'result']) {
          const run = frozen(runFor(target, { eventId, mood, phase }));
          assert.deepEqual(getRageV22(run), getRageV20(run), `${target}/${eventId}/${mood}/${phase}`);
        }
      }
    }
  }
});

test('Helen uses one weighted release with a stronger real branch at low mood', () => {
  for (const phase of ['event', 'result']) {
    for (const [mood, realWeight] of [[0, 51], [25, 51], [26, 28], [50, 28], [64, 28], [65, 16], [100, 16]]) {
      const event = getRageV22(frozen(runFor('helen', { mood, phase })));
      assert.equal(event.id, 'rage-release');
      assert.equal(event.kind, 'rage');
      assert.equal(event.speaker, 'helen');
      assert.deepEqual(event.sourceIds, ['characterFiction']);
      assert.equal(event.choices.length, 1);
      const choice = event.choices[0];
      assert.equal(choice.rageTarget, 'helen');
      assert.equal(choice.detail, '');
      assert.equal(choice.result, '');
      assert.deepEqual(choice.delta, {});
      assert.deepEqual(choice.flags, []);
      assert.equal(choice.draw.outcomes.length, 2);
      assert.deepEqual(choice.draw.outcomes.map(row => row.weight), [100 - realWeight, realWeight]);
      const [dream, real] = choice.draw.outcomes;
      assert.equal(dream.effect, 'rageReturn');
      assert.deepEqual(dream.flags, ['rage_imagined', 'rage_catharsis']);
      assert.equal(real.effect, 'rageAftermath');
      assert.deepEqual(real.flags, ['rage_real']);
      assert.equal(dream.delta.mood, mood <= 25 ? 17 : 9);
      assert.equal(real.delta.mood, mood <= 25 ? 10 : -8);
    }
  }
});

test('Helen distinguishes a pending result from the original conversation without changing mechanics', () => {
  const event = getRageV22(runFor('helen', { phase: 'event' }));
  const result = getRageV22(runFor('helen', { phase: 'result' }));
  for (const row of event.choices[0].draw.outcomes) assert.match(row.result, /還沒講到下一版/);
  for (const row of result.choices[0].draw.outcomes) assert.match(row.result, /剛才已經回了話/);
  const stripCopy = value => {
    const next = copy(value);
    next.choices[0].draw.outcomes.forEach(row => delete row.result);
    return next;
  };
  assert.deepEqual(stripCopy(result), stripCopy(event));
});

test('the new dream is explicitly imagined, with separate non-graphic real consequences', () => {
  const event = getRageV22(runFor());
  const [dream, real] = event.choices[0].draw.outcomes;
  assert.match(dream.result, /腦內幻想/);
  assert.match(dream.result, /沒有人真的挨打/);
  assert.match(dream.result, /雙手仍放在膝上/);
  assert.match(dream.result, /產品路線圖/);
  assert.match(dream.result, /Slack/);
  assert.doesNotMatch(dream.result, /漫畫/);
  assert.match(real.result, /沒有醒來/);
  assert.match(real.result, /同事立刻把你們隔開/);
  assert.match(real.result, /這次真的對眼前的人動了手/);
  assert.doesNotMatch(JSON.stringify(event), /交往|情人|戀愛|婚外|愛恨|緋聞/);
});

test('Helen reaches every existing aftermath branch with her own name and unchanged outcomes', () => {
  for (const eventId of WORLD) {
    for (const energy of [10, 35, 36, 90]) {
      const run = frozen(runFor('helen', { eventId, energy }));
      const event = getRageV22(run);
      assert.deepEqual(event, getRageV14(run, NAMES));
      assert.equal(event.kind, 'rage-world');
      assert.ok(event.choices.length >= 3);
      assert.doesNotMatch(JSON.stringify(event), /undefined/);
      if (eventId !== 'rage-public') assert.match(event.body, /前女友/);
      if (eventId === 'rage-showdown') assert.equal(event.speaker, 'helen');
      assert.ok(event.choices.some(choice => choice.wild));
    }
  }
});

test('displaying Helen scenes cannot mutate a saved run or consume RNG', () => {
  const originalRandom = Math.random;
  Math.random = () => { throw new Error('scene construction must not draw RNG'); };
  try {
    for (const eventId of ['rage-release', ...WORLD]) {
      const run = frozen(runFor('helen', { eventId }));
      const before = copy(run);
      assert.deepEqual(getRageV22(run), getRageV22(run));
      assert.deepEqual(run, before);
      assert.equal(run.rng, 2987324731);
    }
  } finally {
    Math.random = originalRandom;
  }
});
