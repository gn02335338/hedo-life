import test from 'node:test';
import assert from 'node:assert/strict';
import { scopedBossDeltaV18, wingMoodScopeV18 } from '../dist/relationships-v18.js';
import { getRageV16 } from '../dist/rage-v16.js';
import { JACK_EVENTS } from '../dist/events-jack.js';
import { getBanquet } from '../dist/banquet.js';

test('the mood meter belongs to Wing, with NPC-only conversations kept separate', () => {
  for (const delta of [-20, -4, 7, 30]) {
    assert.equal(scopedBossDeltaV18({ speaker: 'wing' }, delta), delta);
    assert.equal(scopedBossDeltaV18({}, delta), delta, 'older authored daily scenes default to Wing');
    for (const speaker of ['spencer', 'rick', 'hope', 'erich', 'jenjen', 'sonny', 'kind', 'jack', 'self']) {
      const event = { speaker, body: '這裡只是在同事之間交接。', wing: '先把這份工作處理好。' };
      assert.equal(scopedBossDeltaV18(event, delta, { result: '對方點點頭，沒有再說什麼。' }), 0, speaker);
    }
  }
  assert.equal(scopedBossDeltaV18({ speaker: 'jack' }, 12, { source: 'rng' }), 0);
  assert.equal(scopedBossDeltaV18({ speaker: 'wing' }, 12, { source: 'rng' }), 12);
  assert.equal(scopedBossDeltaV18({ speaker: 'self' }, -9, { source: 'weather' }), -9);
});

test('resolved Wing replies and explicit HR proxies have a smaller bounded impact', () => {
  const event = { speaker: 'rick', body: '老闆乾兒子在問進度。' };
  assert.equal(scopedBossDeltaV18(event, -20, { result: '翅膀收到報告，說你又在找藉口。' }), -7);
  assert.equal(scopedBossDeltaV18(event, 12, { result: 'Wing 說這次做得不錯。' }), 4);
  assert.equal(scopedBossDeltaV18(event, 40, { result: '他向 Wing 回報，這次進度已經交出去了。' }), 8);
  assert.equal(scopedBossDeltaV18(event, -100, { result: '傑克轉告翅膀，這件事需要確認。' }), -8);
  assert.equal(scopedBossDeltaV18({ speaker: 'hope', body: '翅膀本人不在，評語已先到。希望轉達他的意見。' }, -20), -7);
  assert.equal(scopedBossDeltaV18({ speaker: 'exit-team', body: 'Wing 仍然不在場，大家都能精準代言他的心情。' }, -3), -1);
  assert.equal(scopedBossDeltaV18({ speaker: 'hope', body: '希望請你先填明年可能休假的日子。' }, -12), 0);
});

test('unselected branches, old mentions, dreams, links and identifiers cannot fake a Wing response', () => {
  const event = {
    speaker: 'jack', body: '散會前，翅膀嫌同事沒有讀書。現在傑克過來一起整理文件。',
    choices: [{ result: '翅膀點頭。' }, { result: '翅膀拍桌。' }]
  };
  const ignored = [
    '傑克補好一份筆記，你們把真正的決議寄出去。',
    '大家的希望都在下一份工作。',
    'Wingman 說你很厲害，rage_wing 已記錄。',
    '文件放在 https://example.test/Wing說得好 與 ./assets/Wing說.png。',
    '你沒有通知翅膀，先和傑克把工作交接好。',
    '翅膀還不知道，你們先一起吃飯。',
    '如果翅膀問起，你再把報告拿出來。'
  ];
  for (const result of ignored) assert.equal(scopedBossDeltaV18(event, 16, { result }), 0, result);
});

test('all nine real rage targets keep imaginary punches out of Wing mood and scope actual conflicts', () => {
  for (const target of ['wing', 'spencer', 'rick', 'hope', 'erich', 'jenjen', 'sonny', 'kind', 'jack']) {
    const event = getRageV16({ eventId: 'rage-release', turn: 0, stats: { mood: 50, boss: 40 }, rageContext: { target, eventId: 'onboarding', phase: 'choice' } });
    const [imagined, real] = event.choices[0].draw.outcomes;
    assert.equal(scopedBossDeltaV18(event, imagined.delta.boss, { target, effect: imagined.effect, result: imagined.result }), 0, target);
    assert.equal(scopedBossDeltaV18(event, real.delta.boss, { target, effect: real.effect, result: real.result }), target === 'wing' ? -32 : target === 'spencer' ? -3 : -5, target);
  }
  assert.equal(scopedBossDeltaV18({ id: 'rage-release', speaker: 'spencer' }, -32, { mode: 'real', target: 'spencer' }), -3);
  assert.equal(scopedBossDeltaV18({ id: 'rage-release', speaker: 'wing' }, -2, { mode: 'imagined' }), 0);
});

test('later rage news can reach Wing without borrowing all of the target’s anger', () => {
  assert.equal(scopedBossDeltaV18({ id: 'rage-aftermath', speaker: 'erich', body: 'Wing 的名字比本人更快出現。' }, -6), 0);
  assert.equal(scopedBossDeltaV18({ id: 'rage-showdown', speaker: 'spencer' }, -32, { result: '翅膀拍桌要大家選邊。' }), -8);
  assert.equal(scopedBossDeltaV18({ id: 'rage-showdown', speaker: 'wing' }, -20), -7);
});

test('authored Jack scenes and Spencer’s banquet show distinct, outcome-specific relations', () => {
  const notebook = JACK_EVENTS.find(event => event.id === 'jack-notebook');
  assert.equal(scopedBossDeltaV18(notebook, notebook.choices[1].delta.boss, { result: notebook.choices[1].result }), 0);
  const budget = JACK_EVENTS.find(event => event.id === 'jack-api-budget');
  assert.equal(scopedBossDeltaV18(budget, budget.choices[1].delta.boss, { result: budget.choices[1].result }), 4);
  const defense = JACK_EVENTS.find(event => event.id === 'jack-colleague-defense');
  assert.equal(scopedBossDeltaV18(defense, defense.choices[0].delta.boss, { result: defense.choices[0].result }), 0);
  const banquet = getBanquet({ eventId: 'banquet-draw', stats: { cash: 60 } });
  const gift = banquet.choices[1].draw.outcomes.find(outcome => outcome.flags?.includes('banquet_gift'));
  assert.equal(scopedBossDeltaV18(banquet, gift.delta.boss, { result: gift.result }), 0, 'Rick demanding thanks is not a Wing response');
});

test('scope notices are post-result explanations and helpers neither mutate data nor draw randomness', () => {
  const event = Object.freeze({ id: 'rage-release', speaker: 'spencer' });
  const options = Object.freeze({ source: 'choice', target: 'spencer', mode: 'real' });
  assert.deepEqual(wingMoodScopeV18(event, -32, options), {
    delta: -3, notice: '消息傳到翅膀那裡，只影響他自己的心情；對方的反應另算。'
  });
  assert.deepEqual(wingMoodScopeV18({ speaker: 'wing' }, 5), { delta: 5 });
  assert.equal(wingMoodScopeV18(event, -2, { mode: 'imagined' }).delta, 0);
  assert.match(wingMoodScopeV18(event, -2, { mode: 'imagined' }).notice, /腦內/u);
  assert.match(wingMoodScopeV18({ speaker: 'jack' }, 8).notice, /你和對方/u);
  assert.equal(scopedBossDeltaV18(event, undefined), 0);
  assert.equal(scopedBossDeltaV18(event, Infinity), 0);
});
