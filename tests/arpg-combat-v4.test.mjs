import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startGame, stepGame, restartGame, equipItem,
  getProgress, clearPendingInput, FIXED_STEP,
} from '../dist/arpg/engine.js';
import { SKILLS } from '../dist/arpg/content.js';

function arena(type = 'slime') {
  const state = createGame({ seed: 73 });
  const enemy = state.enemies.find(entry => entry.type === type || entry.bossId === type);
  state.enemies = [enemy];
  Object.assign(state.player, { x: 0, z: 0 });
  Object.assign(enemy, { x: 0, z: -2, hp: 10000, maxHp: 10000, active: true, phase: 'recovery', timer: 100, speed: 0 });
  startGame(state);
  return state;
}

function frames(state, count, input = {}) {
  for (let i = 0; i < count; i++) stepGame(state, input, FIXED_STEP);
}

function until(state, predicate, input = {}, limit = 180) {
  for (let i = 0; i < limit && !predicate(); i++) stepGame(state, input, FIXED_STEP);
  assert.ok(predicate(), 'condition should be reached within the simulation budget');
}

const events = (state, type) => state.combatEvents.filter(event => event.type === type);

test('a tap winds up without damage, strikes at hitAt once, and retains a real recovery', () => {
  const state = arena(), target = state.enemies[0];
  stepGame(state, { attack: true }, FIXED_STEP);
  const action = state.player.action;
  assert.equal(action.kind, 'attack');
  assert.equal(action.elapsed, 0);
  assert.equal(action.duration, SKILLS.attack.cooldown);
  assert.equal(state.stats.damageDealt, 0);
  assert.equal(events(state, 'swing').length, 1);
  assert.equal(events(state, 'strike').length, 0);
  const started = events(state, 'swing')[0];
  while (state.player.action.elapsed + FIXED_STEP < action.hitAt - 1e-9) {
    frames(state, 1);
    assert.equal(target.hp, 10000, 'windup is not an invisible immediate hit');
  }
  until(state, () => events(state, 'strike').length === 1);
  const strike = events(state, 'strike')[0], hit = events(state, 'hit')[0];
  assert.ok(strike.time - started.time >= action.hitAt - 1e-9);
  assert.ok(strike.time - started.time < action.hitAt + FIXED_STEP + 1e-9);
  assert.equal(hit.time, strike.time);
  assert.equal(hit.actionSerial, action.serial);
  assert.equal(hit.damage, Math.round(state.player.attack * 0.8));
  assert.equal(hit.source, 'melee');
  assert.equal(hit.targetId, target.id);
  assert.equal(hit.weapon, 'keyboard');
  assert.equal(hit.enemyType, 'slime');
  assert.equal(strike.range, SKILLS.attack.range);
  assert.ok(state.player.action.elapsed < state.player.action.duration);
  frames(state, 10);
  assert.equal(events(state, 'strike').length, 1);
  assert.equal(events(state, 'hit').length, 1);
  until(state, () => state.player.action === null);
  assert.equal(state.player.attackTimer, 0);
});

test('three held swings have distinct force, unchanged total damage and unchanged cadence', () => {
  const state = arena();
  frames(state, 75, { attack: true });
  const swings = events(state, 'swing'), hits = events(state, 'hit');
  assert.deepEqual(swings.map(event => event.combo), [1, 2, 3]);
  assert.deepEqual(hits.map(event => event.damage), [15, 19, 23]);
  assert.equal(state.stats.damageDealt, state.player.attack * 3);
  assert.deepEqual(hits.map(event => event.heavy), [false, false, true]);
  assert.equal(swings[0].weapon, 'keyboard');
  for (let i = 1; i < swings.length; i++) {
    const interval = swings[i].time - swings[i - 1].time;
    assert.ok(interval >= SKILLS.attack.cooldown - 1e-9);
    assert.ok(interval < SKILLS.attack.cooldown + FIXED_STEP + 1e-9);
  }
  frames(state, 65);
  stepGame(state, { attack: true }, FIXED_STEP);
  assert.equal(events(state, 'swing').at(-1).combo, 1, 'a disconnected tap starts a fresh chain');
});

test('60 Hz and 120 Hz frames produce the same delayed hits and combo events', () => {
  const a = arena(), b = arena();
  for (let i = 0; i < 120; i++) stepGame(a, { attack: true }, 1 / 60);
  for (let i = 0; i < 240; i++) stepGame(b, { attack: true }, 1 / 120);
  assert.equal(a.stats.damageDealt, b.stats.damageDealt);
  assert.deepEqual(a.combatEvents, b.combatEvents);
  assert.deepEqual(a.player.action, b.player.action);
});

test('a sub-tick tap still becomes one complete delayed attack after the key is released', () => {
  const state = arena();
  stepGame(state, { attack: true }, FIXED_STEP / 2);
  assert.equal(state.player.action, null);
  stepGame(state, {}, FIXED_STEP / 2);
  assert.equal(state.player.action.kind, 'attack');
  assert.equal(state.stats.damageDealt, 0);
  frames(state, 40);
  assert.equal(events(state, 'swing').length, 1);
  assert.equal(events(state, 'strike').length, 1);
  assert.equal(events(state, 'hit').length, 1);
});

test('a moving attack locks facing and damage while leaving the player free to reposition', () => {
  const state = arena(), forward = state.enemies[0];
  const side = { ...forward, id: 'side-target', x: 2.5, z: 0 };
  state.enemies.push(side);
  const originalAttack = state.player.attack;
  stepGame(state, { attack: true, aim: { x: 0, z: -4 } }, FIXED_STEP);
  const action = state.player.action;
  const upgrade = { ...state.inventory[0], id: 'windup-upgrade', attack: 70 };
  state.inventory.push(upgrade); equipItem(state, upgrade.id);
  until(state, () => events(state, 'strike').length === 1, { x: 1, aim: { x: 5, z: 0 } });
  assert.ok(state.player.x > 0.3, 'windup permits deliberate movement');
  assert.ok(state.player.x < 0.6, 'the short weighted swing moves slightly slower');
  assert.equal(state.player.angle, 0);
  assert.equal(action.angle, 0);
  assert.equal(10000 - forward.hp, Math.round(originalAttack * 0.8), 'gear swaps cannot change an already-started strike');
  assert.equal(side.hp, 10000, 'mouse motion cannot redirect the locked strike');
});

test('dash wins over an unstruck swing and discards a previously buffered attack', () => {
  const state = arena();
  stepGame(state, { attack: true }, FIXED_STEP);
  frames(state, 2);
  stepGame(state, { dash: true, attack: true, x: 1 }, FIXED_STEP);
  assert.equal(state.player.action.kind, 'dash');
  frames(state, 35);
  assert.equal(state.stats.damageDealt, 0);
  assert.equal(events(state, 'strike').length, 0);
  assert.equal(events(state, 'swing').length, 1);
  assert.ok(state.player.x > 2);
  assert.equal(state.skillBuffer.attack, null);

  const buffered = arena();
  buffered.cooldowns.attack = 0.1;
  stepGame(buffered, { attack: true }, FIXED_STEP);
  assert.ok(buffered.skillBuffer.attack);
  stepGame(buffered, { dash: true, x: 1 }, FIXED_STEP);
  frames(buffered, 35);
  assert.equal(events(buffered, 'swing').length, 0);
});

test('the strike checks current positions and still emits once when its target escapes', () => {
  const state = arena();
  stepGame(state, { attack: true }, FIXED_STEP);
  state.enemies[0].x = 10;
  frames(state, 40);
  assert.equal(state.stats.damageDealt, 0);
  assert.equal(events(state, 'strike').length, 1, 'a miss still has its release animation and sound');
  assert.equal(events(state, 'hit').length, 0);
});

test('near-ready burst, dash and coffee taps buffer once, pay once and do not need a held button', () => {
  for (const skill of ['burst', 'dash', 'potion']) {
    const state = arena();
    state.cooldowns[skill] = 0.12;
    if (skill === 'potion') state.player.hp = 40;
    stepGame(state, { [skill]: true }, FIXED_STEP);
    assert.ok(state.skillBuffer[skill], skill);
    const expiresAt = state.skillBuffer[skill].expiresAt;
    frames(state, 2);
    assert.equal(state.skillBuffer[skill].expiresAt, expiresAt, 'buffer lifetime is not extended while waiting');
    until(state, () => state.cooldowns[skill] > 0.2);
    assert.equal(state.skillBuffer[skill], null);
    const kind = skill === 'dash' ? 'dash' : 'cast';
    const matching = () => events(state, kind).filter(event => skill === 'dash' || event.skill === skill);
    assert.equal(matching().length, 1);
    assert.ok(matching()[0].time <= expiresAt + 1e-9);
    frames(state, 20);
    assert.equal(matching().length, 1);
    if (skill === 'potion') assert.equal(state.player.potions, 2);
  }
});

test('early taps, expired buffers and unavailable resources never fire later by themselves', () => {
  const early = arena(); early.cooldowns.burst = 0.4;
  stepGame(early, { burst: true }, FIXED_STEP);
  assert.equal(early.skillBuffer.burst, null);
  frames(early, 60);
  assert.equal(events(early, 'cast').length, 0);

  const expired = arena(); expired.cooldowns.burst = 0.12;
  stepGame(expired, { burst: true }, FIXED_STEP);
  expired.cooldowns.burst = 0.5;
  frames(expired, 40);
  assert.equal(expired.skillBuffer.burst, null);
  assert.equal(events(expired, 'cast').length, 0);

  const dry = arena(); dry.cooldowns.burst = 0.12; dry.player.energy = 0; dry.player.energyRegen = 0;
  stepGame(dry, { burst: true }, FIXED_STEP);
  frames(dry, 20);
  dry.player.energy = 100;
  frames(dry, 20);
  assert.equal(dry.skillBuffer.burst, null);
  assert.equal(events(dry, 'cast').length, 0);

  const full = arena();
  stepGame(full, { potion: true }, FIXED_STEP);
  full.player.hp = 1;
  frames(full, 100);
  assert.equal(full.player.potions, 3, 'a rejected full-health coffee tap is not stored for a later wound');
});

test('a near-ready released melee tap gets one delayed strike without refreshing the queue', () => {
  const state = arena(); state.cooldowns.attack = 0.12;
  stepGame(state, { attack: true }, FIXED_STEP);
  assert.ok(state.skillBuffer.attack);
  const expiresAt = state.skillBuffer.attack.expiresAt;
  until(state, () => events(state, 'swing').length === 1);
  assert.ok(events(state, 'swing')[0].time <= expiresAt + 1e-9);
  frames(state, 40);
  assert.equal(events(state, 'swing').length, 1);
  assert.equal(events(state, 'strike').length, 1);
  assert.equal(state.skillBuffer.attack, null);
});

test('pause input clearing removes both sub-tick edges and near-ready buffers', () => {
  const state = arena(); state.cooldowns.burst = 0.12;
  stepGame(state, { burst: true }, FIXED_STEP);
  assert.ok(state.skillBuffer.burst);
  stepGame(state, { attack: true }, FIXED_STEP / 2);
  assert.equal(state.pendingInput.attack, true);
  clearPendingInput(state);
  frames(state, 30);
  assert.equal(events(state, 'swing').length, 0);
  assert.equal(events(state, 'cast').length, 0);
  assert.ok(Object.values(state.skillBuffer).every(value => value === null));
});

test('assisted aim stays on a close valid enemy and cannot aim or damage through a cabinet or locked gate', () => {
  const state = arena(), first = state.enemies[0];
  const other = { ...first, id: 'second-target', x: 2.1, z: 0 };
  state.enemies.push(other);
  stepGame(state, { attack: true }, FIXED_STEP);
  assert.equal(state.player.assistTargetId, first.id);
  first.z = -2.15; other.x = 2;
  stepGame(state, { attack: true }, FIXED_STEP);
  assert.equal(state.player.assistTargetId, first.id, 'a tiny distance change does not flicker between directions');
  first.hp = 0;
  stepGame(state, { attack: true }, FIXED_STEP);
  assert.equal(state.player.assistTargetId, other.id);

  for (const setup of [
    s => { s.player.x = -5.5; Object.assign(s.enemies[0], { x: -8.6, z: 0 }); },
    s => { s.player.z = -7.4; Object.assign(s.enemies[0], { x: 0, z: -8.5, room: 1 }); },
  ]) {
    const blocked = arena(); setup(blocked);
    stepGame(blocked, { attack: true }, FIXED_STEP);
    assert.equal(blocked.player.assistTargetId, null);
    frames(blocked, 10);
    stepGame(blocked, { burst: true }, FIXED_STEP);
    assert.equal(blocked.stats.damageDealt, 0);
  }
});

test('auto aim chooses a direction without moving or teleporting the player', () => {
  const state = arena(); state.enemies[0].x = 2; state.enemies[0].z = 0;
  stepGame(state, { attack: true }, FIXED_STEP);
  frames(state, 20);
  assert.equal(state.player.x, 0);
  assert.equal(state.player.z, 0);
  assert.equal(state.player.angle, Math.PI / 2);
});

test('enemy hit reactions are short and do not reset or indefinitely interrupt a boss windup', () => {
  const state = arena('sonny'), boss = state.enemies[0];
  boss.phase = 'idle'; boss.timer = 0;
  stepGame(state, {}, FIXED_STEP);
  const releaseAt = state.time + boss.timer;
  until(state, () => events(state, 'hit').length > 0, { attack: true });
  assert.ok(boss.hitTimer > 0 && boss.hitTimer < 0.14);
  assert.equal(boss.hitAngle, 0);
  assert.equal(boss.phase, 'windup');
  until(state, () => events(state, 'enemy-attack').length > 0, { attack: true });
  const attack = events(state, 'enemy-attack')[0];
  assert.ok(attack.time <= releaseAt + FIXED_STEP + 1e-9);
  assert.ok(state.stats.damageTaken > 0);
  assert.equal(boss.phase, 'recovery');
});

test('combat events stay bounded, ordered and finite across a long held attack', () => {
  const state = arena();
  frames(state, 1800, { attack: true });
  assert.equal(state.combatEvents.length, 96);
  assert.ok(state.combatSerial > 96);
  assert.equal(state.combatEvents.at(-1).serial, state.combatSerial);
  for (let i = 0; i < state.combatEvents.length; i++) {
    const event = state.combatEvents[i];
    assert.ok(Number.isFinite(event.time) && Number.isFinite(event.x) && Number.isFinite(event.z));
    if (i) assert.equal(event.serial, state.combatEvents[i - 1].serial + 1);
    if (event.type === 'hit') {
      assert.ok(event.damage > 0);
      assert.ok([1, 2, 3].includes(event.combo));
      assert.equal(event.heavy, event.combo === 3);
      assert.equal(event.source, 'melee');
    }
  }
});

test('a lethal mug hit retains its started weapon and target metadata after the enemy is removed', () => {
  const state = arena('sonny'), boss = state.enemies[0];
  boss.hp = 1;
  const mug = { ...state.inventory[0], id: 'combat-mug', baseId: 'mug', attack: 7 };
  state.inventory.push(mug); equipItem(state, mug.id);
  stepGame(state, { attack: true }, FIXED_STEP);
  equipItem(state, 'starter-keyboard');
  until(state, () => events(state, 'death').some(event => event.targetId === boss.id));
  assert.equal(state.enemies.some(enemy => enemy.id === boss.id), false);
  const hit = events(state, 'hit')[0], death = events(state, 'death')[0];
  assert.equal(hit.weapon, 'mug');
  assert.equal(hit.bossId, 'sonny');
  assert.equal(hit.enemyType, 'boss');
  assert.equal(hit.damage, 1);
  assert.equal(death.targetId, hit.targetId);
  assert.equal(death.bossId, 'sonny');
  assert.equal(death.enemyType, 'boss');
  assert.equal(events(state, 'strike')[0].weapon, 'mug');
});

test('player hitTimer and direction describe one short reaction without changing invulnerability damage rules', () => {
  const state = arena();
  state.projectiles.push({ id: 'hit', owner: 'test-enemy', x: 0, z: -0.2, vx: 0, vz: 1, radius: 0.2, damage: 10, life: 1 });
  stepGame(state, {}, FIXED_STEP);
  const hit = events(state, 'player-hit')[0];
  assert.equal(state.player.hitTimer, 0.13);
  assert.equal(state.player.hitAngle, hit.angle);
  assert.ok(Math.abs(Math.abs(hit.angle) - Math.PI) < 1e-9);
  assert.equal(hit.actorId, 'test-enemy');
  frames(state, 3);
  assert.ok(state.player.hitTimer > 0 && state.player.hitTimer < 0.13);
  frames(state, 6);
  assert.equal(state.player.hitTimer, 0);
  assert.equal(events(state, 'player-hit').length, 1);
});

test('fatal damage emits player-hit before death, clears actions, and restart keeps the v1 save schema', () => {
  const state = arena();
  stepGame(state, { attack: true }, FIXED_STEP);
  state.player.hp = 1;
  state.projectiles.push({ id: 'fatal', owner: 'test-enemy', x: 0, z: 0, vx: 0, vz: 0, radius: 0.2, damage: 999, life: 1 });
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.status, 'dead');
  assert.deepEqual(state.combatEvents.slice(-2).map(event => [event.type, event.targetId]), [['player-hit', 'player'], ['death', 'player']]);
  assert.equal(state.player.action, null);
  frames(state, 20, { attack: true, potion: true });
  assert.equal(events(state, 'strike').length, 0);
  const progress = getProgress(state);
  assert.equal(progress.version, 1);
  assert.equal(Object.hasOwn(progress, 'combatEvents'), false);
  assert.equal(Object.hasOwn(progress, 'action'), false);
  const runId = state.runId;
  restartGame(state);
  assert.equal(state.runId, runId + 1);
  assert.equal(state.combatSerial, 0);
  assert.deepEqual(state.combatEvents, []);
  assert.deepEqual(getProgress(state), progress);
});
