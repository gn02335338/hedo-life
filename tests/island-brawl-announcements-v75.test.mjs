import test from 'node:test';
import assert from 'node:assert/strict';
import { brawlAnnouncement } from '../dist/island/brawl-ui.js';
import { createIslandBrawl } from '../dist/island/brawl.js';
import { BRAWL_ROSTER, HIDDEN_BRAWL_PROFILE } from '../dist/island/brawl-roster.js';

const profile = BRAWL_ROSTER.wing;
test('the large title follows the actual cast until release and includes its actionable counter', () => {
  const game = createIslandBrawl({ opponentId: 'wing', seed: 'visible-title-v75' });
  let state = game.start();
  assert.equal(brawlAnnouncement(game.getState(), profile, '翅膀').name, '見招拆招');
  for (let frame = 0; frame < 1000 && !state.opponent.activeSkillId; frame++) state = game.step(1 / 60);
  const move = [...profile.skills, ...profile.events].find(item => item.id === state.opponent.activeSkillId);
  assert.ok(move, 'the actual simulation opens an authored cast');
  const first = brawlAnnouncement(state, profile, '翅膀');
  assert.equal(first.name, move.name);
  assert.equal(first.line, move.line);
  assert.equal(first.counter, move.counter);
  assert.equal(first.tone, 'warning');
  assert.ok(first.progress >= 0 && first.progress <= 1);
  state = game.step(1 / 60);
  const later = brawlAnnouncement(state, profile, '翅膀');
  assert.equal(later.name, move.name);
  assert.ok(later.progress > first.progress);
  const paused = game.pause();
  assert.equal(brawlAnnouncement(paused, profile, '翅膀').name, move.name, 'pause does not change or expire the real cast title');
  game.resume();
  for (let frame = 0; frame < 200 && state.opponent.telegraphRemaining > 0; frame++) state = game.step(1 / 60);
  const released = brawlAnnouncement(state, profile, '翅膀');
  assert.equal(released.name, move.name);
  assert.equal(released.tone, 'resolved');
  assert.match(released.line, new RegExp(move.line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.deepEqual(game.getState(), state, 'reading the display leaves combat untouched');
});

test('a real player special gets its own title; ordinary opponent heavy attacks cannot impersonate it', () => {
  const game = createIslandBrawl({ opponentId: 'wing', seed: 'special-title-v75' });
  const state = game.start();
  state.effects = [{ id: 2, type: 'special', owner: 'opponent', text: undefined }];
  assert.notEqual(brawlAnnouncement(state, profile, '翅膀').tone, 'special');
  state.effects = [{ id: 3, type: 'special', owner: 'player', text: '下班無雙' }];
  const title = brawlAnnouncement(state, profile, '翅膀');
  assert.equal(title.tone, 'special');
  assert.equal(title.name, '下班無雙');
  assert.equal(title.key, 'special-3');
});

test('new dark workplace punchlines cover every public opponent and the optional hidden boss', () => {
  const names = new Set();
  for (const roster of [...Object.values(BRAWL_ROSTER), HIDDEN_BRAWL_PROFILE]) {
    const moves = [...roster.skills, ...roster.events];
    assert.ok(moves.length >= 4);
    for (const move of moves) {
      assert.ok(!names.has(move.name), `${move.name} remains a personal authored skill`);
      names.add(move.name);
      assert.ok(move.line.length >= 8, `${move.id} has an actual punchline`);
      assert.ok(move.counter.length >= 10, `${move.id} keeps the gameplay response readable`);
    }
  }
  assert.ok(names.has('一點五星米其靈'));
  assert.ok(names.has('三百名單百鬼夜行'));
  assert.ok(names.has('一份薪水十二牌位'));
  assert.ok(names.has('Final Final 遺稿連發'));
});
