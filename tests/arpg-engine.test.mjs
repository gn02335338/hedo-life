import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startGame, stepGame, restartGame, equipItem, discardItem,
  getProgress, normalizeProgress, isWalkable, FIXED_STEP,
  clearPendingInput,
} from '../dist/arpg/engine.js';
import { SKILLS, SPAWN, BOSS_PROFILES, ENCOUNTERS, WORLD } from '../dist/arpg/content.js';

function advance(state, input, seconds) {
  for (let i = 0; i < Math.round(seconds / FIXED_STEP); i++) stepGame(state, input, FIXED_STEP);
}
function arena(type = null) {
  const state = createGame({ seed: 73 });
  state.enemies = type ? [state.enemies.find((enemy) => enemy.type === type || enemy.bossId === type)] : [];
  const room = state.enemies[0]?.room || 3;
  for (let previous = 1; previous < room; previous++) {
    state.roomCleared[previous] = true;
    state.defeatedBosses[['sonny', 'meimei'][previous - 1]] = true;
  }
  state.unlockedRoom = room;
  for (const gate of state.gates) gate.locked = !state.roomCleared[gate.fromRoom];
  state.player.x = 0; state.player.z = 0;
  startGame(state);
  return state;
}

test('a new run waits for start, owns original equipment, and serializes valid progress', () => {
  const state = createGame({ seed: 4 });
  stepGame(state, { z: -1, attack: true }, 0.2);
  assert.equal(state.status, 'ready');
  assert.equal(state.player.z, SPAWN.z);
  assert.equal(state.inventory.length, 2);
  assert.ok(state.player.attack > 14);
  const progress = getProgress(state);
  assert.deepEqual(getProgress(createGame({ progress: JSON.parse(JSON.stringify(progress)) })), progress);
});

test('fixed stepping gives the same movement for 60 Hz and 120 Hz frames', () => {
  const a = arena(), b = arena();
  for (let i = 0; i < 60; i++) stepGame(a, { x: 0.3, z: -0.7 }, 1 / 60);
  for (let i = 0; i < 120; i++) stepGame(b, { x: 0.3, z: -0.7 }, 1 / 120);
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.z, b.player.z);
  assert.equal(a.time, b.time);
});

test('movement follows connected rooms, stays inside walls and cannot dash through a cabinet', () => {
  const state = arena();
  state.player.x = 0; state.player.z = 10;
  advance(state, { x: 1 }, 3);
  assert.ok(state.player.x <= 6 - state.player.radius + 0.001);
  assert.ok(isWalkable(state.player.x, state.player.z));
  state.player.x = -4.8; state.player.z = 0; state.player.energy = 100;
  stepGame(state, { x: -1, dash: true }, FIXED_STEP);
  advance(state, {}, 0.25);
  assert.ok(state.player.x > -6 + state.player.radius - 0.001, 'dash stops at the east face of the cabinet');
  assert.ok(isWalkable(state.player.x, state.player.z));
  state.player.x = 0; state.player.z = 10;
  advance(state, { z: -1 }, 9);
  assert.equal(state.room, 3);
  assert.ok(state.player.z < -32);
  assert.ok(!isWalkable(6, -8), 'corridor has real side walls');
});

test('skill edges survive a frame shorter than the fixed step and pay only once', () => {
  const state = arena();
  stepGame(state, { burst: true }, FIXED_STEP / 2);
  assert.equal(state.cooldowns.burst, 0);
  stepGame(state, {}, FIXED_STEP / 2);
  assert.equal(state.cooldowns.burst, SKILLS.burst.cooldown);
  assert.equal(state.player.energy, 70);
  const energy = state.player.energy;
  stepGame(state, { burst: true }, FIXED_STEP);
  assert.ok(state.player.energy > energy, 'cooldown rejects a second energy payment');
  state.cooldowns.burst = 0; state.player.energy = 2;
  stepGame(state, { burst: true }, FIXED_STEP);
  assert.equal(state.cooldowns.burst, 0);
});

test('melee and burst cannot damage an enemy through an office cabinet', () => {
  const state = arena('slime'), enemy = state.enemies[0];
  state.player.x = -5.5;
  Object.assign(enemy, { x: -8.6, z: 0, hp: 100, maxHp: 100, timer: 10 });
  stepGame(state, { attack: true, aim: { x: -9, z: 0 } }, FIXED_STEP);
  advance(state, {}, 0.15);
  stepGame(state, { burst: true, aim: { x: -9, z: 0 } }, FIXED_STEP);
  assert.equal(enemy.hp, 100);
});

test('a short attack tap at 120 Hz survives release before the next tick and held attacks still repeat', () => {
  const tapped = arena('slime');
  Object.assign(tapped.enemies[0], { x: 0, z: -2, hp: 1000, maxHp: 1000, timer: 10 });
  stepGame(tapped, { attack: true }, 1 / 120);
  assert.equal(tapped.stats.damageDealt, 0);
  stepGame(tapped, { attack: false }, 1 / 120);
  assert.equal(tapped.stats.damageDealt, 0, 'the retained tap begins a real windup');
  advance(tapped, {}, 0.15);
  assert.equal(tapped.stats.damageDealt, Math.round(tapped.player.attack * 0.8));
  assert.equal(tapped.pendingInput.attack, false);
  const held = arena('slime');
  Object.assign(held.enemies[0], { x: 0, z: -2, hp: 1000, maxHp: 1000, timer: 10 });
  advance(held, { attack: true }, 1.2);
  assert.equal(held.stats.damageDealt, held.player.attack * 3);
});

test('an original starting character can clear all three rooms using only normal controls and loot upgrades', () => {
  const state = createGame({ seed: 73 });
  startGame(state);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const norm = (x, z) => { const length = Math.hypot(x, z) || 1; return { x: x / length, z: z / length }; };
  const score = (item) => item ? item.attack * 2 + item.armor + item.maxHp * 0.15 + item.energyRegen * 2 : 0;
  // A small independent grid planner only chooses normal movement input. It neither
  // relocates actors nor alters health, rewards, cooldowns or encounter state.
  const nodes = [];
  for (let z = -40.5; z <= 15.75; z += 0.75) for (let x = -11.25; x <= 11.25; x += 0.75) {
    if (isWalkable(x, z, 0.5)) nodes.push({ x, z, key: `${x},${z}` });
  }
  const byKey = new Map(nodes.map((node, index) => [node.key, index]));
  const neighbors = nodes.map((node) => {
    const result = [];
    for (const [dx, dz] of [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]]) {
      const neighbor = byKey.get(`${node.x + dx},${node.z + dz}`);
      if (neighbor !== undefined && isWalkable(node.x + dx / 2, node.z + dz / 2, 0.5)) result.push(neighbor);
    }
    return result;
  });
  let route = [];
  function plan(goal) {
    const minZ = state.gates.find((gate) => gate.locked)?.z + 0.5 || -41;
    const nearest = (point) => nodes.reduce((best, node, index) => node.z >= minZ && (best < 0 || dist(point, node) < dist(point, nodes[best])) ? index : best, -1);
    const start = nearest(state.player), end = nearest(goal), previous = new Int32Array(nodes.length).fill(-1), queue = [start];
    previous[start] = start;
    for (let cursor = 0; cursor < queue.length && previous[end] < 0; cursor++) {
      for (const next of neighbors[queue[cursor]]) if (previous[next] < 0 && nodes[next].z >= minZ) { previous[next] = queue[cursor]; queue.push(next); }
    }
    route = [];
    if (previous[end] < 0) return;
    for (let cursor = end; cursor !== start; cursor = previous[cursor]) route.unshift(nodes[cursor]);
  }
  for (let i = 0; i < 60 * 90 && state.status === 'playing'; i++) {
    const p = state.player;
    for (const item of state.inventory) if (score(item) > score(state.equipped[item.slot])) equipItem(state, item.id);
    const target = state.enemies.filter((enemy) => enemy.room <= state.unlockedRoom).sort((a, b) => dist(p, a) - dist(p, b))[0];
    const distance = dist(p, target);
    let goal = target;
    let move = { x: 0, z: 0 };
    let dodge = false;
    const pickup = state.drops.filter((drop) => drop.type !== 'coffee' || p.potions < SKILLS.potion.charges).sort((a, b) => dist(p, a) - dist(p, b))[0];
    if (pickup && dist(p, pickup) < 5 && distance > 3) goal = pickup;
    if (i % 20 === 0 || !route.length) plan(goal);
    while (route.length && dist(p, route[0]) < 0.35) route.shift();
    if (distance > 2 || goal !== target) {
      const next = route[0] || goal;
      move = norm(next.x - p.x, next.z - p.z);
    }
    for (const enemy of state.enemies) for (const t of enemy.telegraphs || []) {
      if (t.kind === 'circle' && dist(p, t) < t.radius + 0.9) { move = norm(p.x - t.x, p.z - t.z); dodge = true; }
      if (t.kind === 'line') {
        const fx = Math.sin(t.angle), fz = -Math.cos(t.angle), dx = p.x - t.x, dz = p.z - t.z;
        const ahead = dx * fx + dz * fz, side = dx * -fz + dz * fx;
        if (ahead > -0.8 && ahead < t.length + 1 && Math.abs(side) < t.width / 2 + 0.8) {
          const sign = side < 0 ? -1 : 1;
          move = { x: -fz * sign, z: fx * sign }; dodge = true;
        }
      }
    }
    if (!isWalkable(p.x + move.x * 0.6, p.z + move.z * 0.6)) {
      const base = Math.atan2(move.z, move.x);
      move = { x: 0, z: 0 };
      for (const offset of [0.5, -0.5, 1, -1, 1.6, -1.6, 2.2, -2.2]) {
        const candidate = { x: Math.cos(base + offset), z: Math.sin(base + offset) };
        if (isWalkable(p.x + candidate.x * 0.6, p.z + candidate.z * 0.6)) { move = candidate; break; }
      }
    }
    stepGame(state, { ...move, attack: true, burst: distance < 4.8, dash: dodge && p.energy > 48, potion: p.hp < p.maxHp * 0.45 }, FIXED_STEP);
  }
  assert.equal(state.status, 'won', JSON.stringify({ room: state.room, player: state.player, enemies: state.enemies.map(({ bossId, type, x, z, hp, room }) => ({ bossId, type, x, z, hp, room })) }));
  assert.equal(state.stats.kills, 11);
  assert.equal(state.stats.bossKills, 3);
  assert.deepEqual(state.roomCleared, { 1: true, 2: true, 3: true });
  assert.ok(state.player.level > 1);
  assert.ok(state.stats.itemsFound > 0);
  assert.ok(getProgress(state));
});

test('coffee has finite charges, does not drink at full health, and respects cooldown', () => {
  const state = arena();
  stepGame(state, { potion: true }, FIXED_STEP);
  assert.equal(state.player.potions, 3);
  state.player.hp = 1;
  stepGame(state, { potion: true }, FIXED_STEP);
  assert.equal(state.player.potions, 2);
  const hp = state.player.hp;
  stepGame(state, { potion: true }, FIXED_STEP);
  assert.equal(state.player.hp, hp);
  for (let i = 0; i < 3; i++) {
    state.player.hp = 1; state.cooldowns.potion = 0;
    stepGame(state, { potion: true }, FIXED_STEP);
  }
  assert.equal(state.player.potions, 0);
  assert.equal(state.player.hp, 1);
});

test('opening and closing a pause discards pending skill edges without advancing combat', () => {
  const state = arena();
  stepGame(state, { attack: true, burst: true, dash: true }, FIXED_STEP / 2);
  assert.equal(state.pendingInput.burst, true);
  clearPendingInput(state);
  assert.equal(state.time, 0);
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.cooldowns.burst, 0);
  assert.equal(state.cooldowns.dash, 0);
  assert.equal(state.cooldowns.attack, 0);
  assert.equal(state.player.energy, 100);
});

test('an enemy dies once, drops once, and nearby pickup settles rewards once', () => {
  const state = arena('slime');
  Object.assign(state.enemies[0], { x: 0, z: -2, hp: 1, active: false, timer: 10 });
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.stats.kills, 1);
  assert.equal(state.enemies.length, 0);
  assert.equal(state.drops.length, 3, 'first enemy guarantees a piece of equipment');
  const ids = state.drops.map((drop) => drop.id);
  advance(state, { attack: true }, 1);
  assert.deepEqual(state.drops.map((drop) => drop.id), ids);
  state.player.z = -2;
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.drops.length, 0);
  assert.equal(state.stats.itemsFound, 1);
  assert.equal(state.player.xp, 18);
  assert.equal(state.player.gold, 8);
  const rewards = getProgress(state);
  advance(state, {}, 1);
  assert.deepEqual(getProgress(state), rewards);
});

test('equipping affects damage and defense without healing exploits; equipped items cannot be discarded', () => {
  const state = arena();
  const oldAttack = state.player.attack, oldArmor = state.player.armor;
  const item = { ...state.inventory[0], id: 'test-upgrade', attack: 30, armor: 5, maxHp: 20 };
  state.inventory.push(item);
  state.player.hp = 40;
  assert.equal(equipItem(state, item.id), true);
  assert.equal(state.player.attack, oldAttack + 25);
  assert.equal(state.player.armor, oldArmor + 5);
  assert.equal(state.player.hp, 40);
  assert.equal(equipItem(state, item.id), true);
  assert.equal(state.player.hp, 40);
  assert.equal(discardItem(state, item.id), false);
  assert.equal(discardItem(state, 'starter-keyboard'), true);
  assert.equal(equipItem(state, 'missing'), false);
  const enemy = createGame().enemies[0];
  Object.assign(enemy, { x: 0, z: -2, hp: 100, maxHp: 100, timer: 10 });
  state.enemies = [enemy];
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(enemy.hp, 100 - Math.round(state.player.attack * 0.8));
});

test('slime charge, golem slam, and wraith bolt have distinct dodgeable warnings', () => {
  for (const [type, kind, attackKind] of [['slime', 'line', 'charge'], ['golem', 'circle', 'slam'], ['wraith', 'line', 'bolt']]) {
    const state = arena(type), enemy = state.enemies[0];
    Object.assign(enemy, { x: 0, z: -2.4, room: 1, timer: 0 });
    stepGame(state, {}, FIXED_STEP);
    assert.equal(enemy.phase, 'windup', type);
    assert.equal(enemy.telegraph.kind, kind);
    assert.equal(enemy.attackKind, attackKind);
    assert.equal(enemy.telegraph.progress, 0);
    const target = { x: enemy.telegraph.x, z: enemy.telegraph.z };
    const hp = state.player.hp;
    state.player.x = 4; state.player.z = 2;
    advance(state, {}, 1.15);
    assert.equal(state.player.hp, hp, `${type} can be dodged`);
    assert.equal(enemy.phase, 'recovery');
    assert.ok(Number.isFinite(target.x));
  }
});

test('the three public cast bosses expose distinct profiles and two readable attacks each', () => {
  assert.equal(ENCOUNTERS.length, 11);
  assert.deepEqual(ENCOUNTERS.filter((enemy) => enemy.type === 'boss').map((enemy) => enemy.bossId), ['sonny', 'meimei', 'wing']);
  for (const [bossId, attacks] of [['sonny', ['slam', 'charge']], ['meimei', ['volley', 'promise']], ['wing', ['bombard', 'slam']]]) {
    const state = arena(bossId), boss = state.enemies[0], center = WORLD.rooms[boss.room].z;
    Object.assign(state.player, { x: 0, z: center + 1.4 });
    Object.assign(boss, { x: 0, z: center - 1, timer: 0 });
    assert.equal(boss.name, BOSS_PROFILES[bossId].displayName);
    assert.equal(boss.title, BOSS_PROFILES[bossId].title);
    for (let index = 0; index < 2; index++) {
      Object.assign(boss, { phase: 'idle', timer: 0, telegraph: null, telegraphs: [] });
      stepGame(state, {}, FIXED_STEP);
      assert.equal(boss.phase, 'windup');
      assert.equal(boss.attackKind, attacks[index]);
      assert.equal(boss.attackLabel, BOSS_PROFILES[bossId].skills[index].label);
      assert.ok(boss.telegraph.duration >= 1);
      assert.equal(boss.telegraph.progress, 0);
      if (boss.attackKind === 'volley') {
        boss.timer = 0;
        stepGame(state, {}, FIXED_STEP);
        assert.equal(state.projectiles.length, 5);
        assert.ok(state.projectiles.every((shot) => shot.kind === 'speech'));
      }
      if (boss.attackKind === 'promise' || boss.attackKind === 'bombard') {
        assert.equal(boss.telegraph.x, state.player.x);
        assert.equal(boss.telegraph.z, state.player.z);
        const locked = { x: boss.telegraph.x, z: boss.telegraph.z };
        stepGame(state, { x: 1 }, FIXED_STEP);
        assert.equal(boss.telegraph.x, locked.x, 'impact never follows a moving player');
        assert.equal(boss.telegraph.z, locked.z);
      }
    }
  }
});

test('unbeaten room gates block walking and dash, and future enemies neither wake nor take damage', () => {
  const state = createGame(); startGame(state);
  state.player.z = -7.4;
  advance(state, { z: -1, dash: true, burst: true, attack: true }, 0.3);
  assert.ok(state.player.z >= -8 + state.player.radius - 1e-7);
  assert.equal(state.gates[0].locked, true);
  assert.equal(state.unlockedRoom, 1);
  assert.ok(state.enemies.filter((enemy) => enemy.room > 1).every((enemy) => !enemy.active && enemy.hp === enemy.maxHp));
  assert.ok(state.messages.some(({ text }) => text.includes('先清完')));
  // A forged scene position still cannot damage or activate a future encounter.
  state.player.z = -18;
  stepGame(state, { burst: true, attack: true }, FIXED_STEP);
  assert.ok(state.enemies.filter((enemy) => enemy.room > 1).every((enemy) => !enemy.active && enemy.hp === enemy.maxHp));
});

test('each room needs its boss and its mobs; a boss awards equipment and coffee exactly once', () => {
  const state = arena('sonny'), boss = state.enemies[0];
  Object.assign(state.player, { x: 0, z: -2 });
  Object.assign(boss, { x: 0, z: -4, hp: 1, timer: 10 });
  const mob = { ...createGame().enemies[0], id: 'room-one-last-mob', x: 9, z: 0, hp: 1, timer: 10 };
  state.enemies.push(mob);
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.defeatedBosses.sonny, true);
  assert.equal(state.roomCleared[1], false);
  assert.equal(state.gates[0].locked, true);
  assert.equal(state.stats.bossKills, 1);
  assert.equal(state.drops.filter((drop) => drop.type === 'coffee').length, 1);
  assert.ok(state.drops.some((drop) => drop.item && drop.item.rarity !== 'common'));
  assert.ok(state.messages.some(({ text }) => text.includes('阿福已擊破')));
  const coffee = state.drops.find((drop) => drop.type === 'coffee');
  Object.assign(state.player, { x: coffee.x, z: coffee.z, potions: 1 });
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.player.potions, 2);
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.player.potions, 2);
  advance(state, {}, SKILLS.attack.cooldown);
  Object.assign(state.player, { x: 8, z: 0 }); state.cooldowns.attack = 0;
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.roomCleared[1], true);
  assert.equal(state.unlockedRoom, 2);
  assert.equal(state.gates[0].locked, false);
  assert.equal(state.gates[1].locked, true);
  assert.equal(state.status, 'playing');
  assert.equal(state.stats.bossKills, 1);
});

test('old version-one progress keeps all gear, bonuses and clears while new encounters start fresh', () => {
  const old = getProgress(createGame());
  old.level = 5; old.xp = 37; old.gold = 478; old.wins = 2;
  old.inventory.push({ ...old.inventory[0], id: 'legacy-rare', rarity: 'rare', attack: 19, armor: 2 });
  old.equipped.weapon = 'legacy-rare';
  const restored = createGame({ progress: JSON.parse(JSON.stringify(old)) });
  assert.deepEqual(getProgress(restored), normalizeProgress(old));
  assert.equal(restored.player.attack, 14 + 4 * 3 + 19);
  assert.equal(restored.difficulty, 3);
  assert.equal(restored.unlockedRoom, 1);
  assert.equal(restored.enemies.filter((enemy) => enemy.type === 'boss').length, 3);
  assert.deepEqual(restored.defeatedBosses, { sonny: false, meimei: false, wing: false });
});

test('final boss alternates bombardment and slam, enrages once, and awards victory once', () => {
  const state = arena('wing'), boss = state.enemies[0];
  state.player.x = 0; state.player.z = -30;
  Object.assign(boss, { x: 0, z: -34, timer: 0 });
  stepGame(state, {}, FIXED_STEP);
  assert.equal(boss.attackKind, 'bombard');
  assert.equal(boss.telegraphs.length, 3);
  boss.hp = boss.maxHp / 2;
  stepGame(state, {}, FIXED_STEP);
  assert.equal(boss.enraged, true);
  const count = state.messages.filter((entry) => entry.text.includes('開始加碼')).length;
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.messages.filter((entry) => entry.text.includes('開始加碼')).length, count);
  Object.assign(boss, { phase: 'idle', telegraph: null, timer: 0 });
  stepGame(state, {}, FIXED_STEP);
  assert.equal(boss.attackKind, 'slam');
  boss.hp = 1;
  state.player.z = -32;
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.status, 'won');
  assert.equal(state.wins, 1);
  assert.equal(state.stats.bossKills, 1);
  assert.ok(state.inventory.some((item) => item.rarity !== 'common'));
  const final = JSON.stringify(state.stats);
  advance(state, { attack: true, burst: true }, 2);
  assert.equal(state.wins, 1);
  assert.equal(JSON.stringify(state.stats), final);
  const gear = getProgress(state).inventory;
  restartGame(state);
  assert.equal(state.status, 'ready');
  assert.equal(state.difficulty, 2);
  assert.deepEqual(state.inventory, gear);
  assert.equal(state.enemies.length, 11);
  assert.ok(state.enemies.find((enemy) => enemy.bossId === 'wing').maxHp > BOSS_PROFILES.wing.maxHp);
  assert.deepEqual(state.roomCleared, { 1: false, 2: false, 3: false });
  assert.equal(state.player.hp, state.player.maxHp);
});

test('death freezes combat, does not collect floor rewards, and restart preserves earned progress', () => {
  const state = arena();
  state.player.gold = 42; state.player.hp = 1;
  state.drops.push({ id: 'floor-xp', type: 'xp', x: 0, z: 0, amount: 500 });
  state.projectiles.push(...[1, 2].map((id) => ({ id: `fatal-${id}`, owner: 'enemy', x: 0, z: 0, vx: 0, vz: 0, damage: 999, radius: 0.2, life: 1 })));
  stepGame(state, {}, FIXED_STEP);
  assert.equal(state.status, 'dead');
  assert.equal(state.player.hp, 0);
  assert.equal(state.player.xp, 0);
  const damage = state.stats.damageTaken, elapsed = state.stats.elapsed;
  advance(state, { potion: true }, 1);
  assert.equal(state.stats.damageTaken, damage);
  assert.equal(state.stats.elapsed, elapsed);
  restartGame(state);
  assert.equal(state.status, 'ready');
  assert.equal(state.player.gold, 42);
  assert.equal(state.player.potions, 3);
  assert.equal(state.player.x, SPAWN.x);
  assert.equal(state.player.z, SPAWN.z);
});

test('defeating the boss while other enemies live cannot finish or award a clear', () => {
  const state = arena('wing'), boss = state.enemies[0];
  state.player.x = 0; state.player.z = -32;
  Object.assign(boss, { x: 0, z: -34, hp: 1, timer: 10 });
  const other = createGame().enemies[0];
  Object.assign(other, { x: 10, z: 0, hp: 1, timer: 10 });
  state.enemies.push(other);
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.stats.bossKills, 1);
  assert.equal(state.wins, 0);
  assert.equal(state.status, 'playing');
  advance(state, {}, SKILLS.attack.cooldown);
  state.player.x = 9; state.player.z = 0;
  state.cooldowns.attack = 0;
  stepGame(state, { attack: true }, FIXED_STEP);
  advance(state, {}, 0.15);
  assert.equal(state.status, 'won');
  assert.equal(state.wins, 1);
});

test('identical seeds and kills produce identical loot and loaded gear never reuses an item id', () => {
  const a = arena('slime'), b = arena('slime');
  for (const state of [a, b]) {
    Object.assign(state.enemies[0], { x: 0, z: -1, hp: 1, timer: 10 });
    stepGame(state, { attack: true }, FIXED_STEP);
    advance(state, {}, 0.15);
    assert.equal(state.stats.kills, 1);
  }
  assert.deepEqual(a.inventory, b.inventory);
  const c = createGame({ seed: 73, progress: getProgress(a) });
  c.player.z = 0; startGame(c);
  c.enemies = [c.enemies[0]];
  Object.assign(c.enemies[0], { x: 0, z: -1, hp: 1, timer: 10 });
  stepGame(c, { attack: true }, FIXED_STEP);
  advance(c, {}, 0.15);
  assert.equal(c.stats.kills, 1);
  assert.equal(new Set(c.inventory.map((item) => item.id)).size, c.inventory.length);
});

test('invalid progress, non-finite inputs, and suspended-tab deltas cannot poison the simulation', () => {
  const state = arena();
  const saved = getProgress(state);
  assert.equal(normalizeProgress(Object.create(saved)), null);
  assert.equal(normalizeProgress({ ...saved, inventory: new Array(1) }), null);
  stepGame(state, { x: NaN, z: Infinity }, Infinity);
  assert.equal(state.time, 0);
  stepGame(state, { x: NaN, z: Infinity, aim: { x: NaN, z: 0 } }, 900);
  assert.ok(state.time <= 0.25 + 1e-8);
  assert.ok(Number.isFinite(state.player.x));
  assert.ok(Number.isFinite(state.player.angle));
});
