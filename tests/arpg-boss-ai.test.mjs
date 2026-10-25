import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, stepGame, isWalkable, FIXED_STEP } from '../dist/arpg/engine.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// These isolated arenas change only encounter placement/state. The complete-run
// tests in arpg-engine use an untouched starting character and earned loot.
function arena(bossId, seed = 73) {
  const state = createGame({ seed });
  const boss = state.enemies.find(enemy => enemy.bossId === bossId);
  state.enemies = [boss];
  for (let room = 1; room < boss.room; room++) {
    state.roomCleared[room] = true;
    state.defeatedBosses[['sonny', 'meimei'][room - 1]] = true;
  }
  state.unlockedRoom = boss.room;
  for (const gate of state.gates) gate.locked = !state.roomCleared[gate.fromRoom];
  Object.assign(boss, { active: true, phase: 'idle', timer: 0 });
  startGame(state);
  return { state, boss };
}

function simulate(state, seconds, { input = {}, frame = FIXED_STEP, observe = () => {} } = {}) {
  syncInitialMotion(state);
  for (let i = 0; i < Math.round(seconds / frame) && state.status === 'playing'; i++) {
    stepGame(state, typeof input === 'function' ? input(state) : input, frame);
    observe(state);
  }
}

function syncInitialMotion(state) {
  // Arena placement is initial setup, not a player teleport observed during play.
  if (state.time === 0 && state.playerMotion) Object.assign(state.playerMotion,
    { x: state.player.x, z: state.player.z, vx: 0, vz: 0, speed: 0 });
}

function assertSolid(body) {
  assert.ok(isWalkable(body.x, body.z, body.radius), `body intersects scenery at ${body.x},${body.z}`);
}

function warning(state, boss, limit = 240) {
  syncInitialMotion(state);
  for (let i = 0; i < limit && !boss.telegraph; i++) stepGame(state, {}, FIXED_STEP);
  assert.ok(boss.telegraph, 'a reachable target must eventually receive a visible warning');
  return boss.telegraph;
}

function placement(bossId, separation, seed = 73) {
  const result = arena(bossId, seed);
  const z = [0, -16, -32][result.boss.room - 1] - 3;
  Object.assign(result.boss, { x: 0, z });
  Object.assign(result.state.player, { x: 0, z: z + separation });
  syncInitialMotion(result.state);
  return result;
}

function shape(t) {
  return Object.fromEntries(Object.entries(t).filter(([key]) => !['remaining', 'progress'].includes(key)));
}

for (const [side, seed, frame] of [[-1, 73, FIXED_STEP], [1, 2026, 1 / 120]]) {
  test(`a pursuing boss routes around the cabinet from side ${side} without crossing scenery`, () => {
    const { state, boss } = arena('sonny', seed);
    Object.assign(boss, { x: side < 0 ? -10 : -4, z: 0, active: side > 0 });
    Object.assign(state.player, { x: side < 0 ? -4 : -10, z: 0 });
    let detour = 0, threatened = false;
    simulate(state, 9, { frame, observe() {
      assertSolid(boss);
      detour = Math.max(detour, Math.abs(boss.z));
      threatened ||= Boolean(boss.telegraph || state.combatEvents.some(event => event.type === 'enemy-attack'));
    } });
    assert.equal(boss.active, true, 'a nearby same-room boss can wake even when the cabinet initially blocks sight');
    assert.ok(detour > 2.3, 'the boss must go past a cabinet corner, rather than stay pressed against its face');
    assert.ok(threatened, 'routing must restore an actual readable attack, not merely shuffle sideways');
  });
}

test('pursuit respects a still-locked room gate even when its target is beyond it', () => {
  const { state, boss } = arena('sonny', 4);
  Object.assign(boss, { x: 0, z: -6.8 });
  Object.assign(state.player, { x: 0, z: -11 });
  const gate = state.gates.find(gate => gate.fromRoom === 1);
  assert.equal(gate.locked, true);
  simulate(state, 5, { observe() {
    assertSolid(boss);
    assert.ok(boss.z >= gate.z + boss.radius - 1e-7, 'a route or charge cannot cross the sealed threshold');
  } });
  assert.equal(gate.locked, true);
  assert.equal(state.stats.damageTaken, 0, 'a locked door also blocks attacks at a target on the far side');
});

test('the ranged boss finds space along a wall instead of retreating into it forever', (t) => {
  const { state, boss } = arena('meimei', 2026);
  Object.assign(boss, { x: 10.8, z: -16, timer: 1.8 });
  Object.assign(state.player, { x: 9, z: -16 });
  let maximumDistance = distance(state.player, boss), alongWall = 0;
  simulate(state, 8, { observe() {
    assertSolid(boss);
    maximumDistance = Math.max(maximumDistance, distance(state.player, boss));
    alongWall = Math.max(alongWall, Math.abs(boss.z + 16));
  } });
  t.diagnostic(JSON.stringify({ maximumDistance, alongWall, end: { x: boss.x, z: boss.z } }));
  assert.ok(alongWall > 1.2, 'blocked retreat must choose a reachable side position');
  assert.ok(maximumDistance > 5, 'the route eventually establishes the intended ranged distance');
  assert.ok(distance(state.player, boss) > 4.5, 'the boss keeps space after completing the retreat');
});

for (const [id, near, far] of [['sonny', 'slam', 'charge'], ['wing', 'slam', 'bombard']]) {
  test(`${id} chooses a useful attack for close and distant targets rather than alternating blindly`, () => {
    for (const [separation, expected] of [[2, near], [7, far]]) {
      const { state, boss } = placement(id, separation);
      const t = warning(state, boss);
      assert.equal(boss.attackKind, expected);
      if (t.kind === 'circle' && expected === 'slam') {
        assert.ok(distance(state.player, t) <= t.radius + state.player.radius, 'a selected close slam can actually reach its target');
      }
    }
  });
}

test('a close ranged boss creates space before casting while a distant one can volley', () => {
  const close = placement('meimei', 2);
  const initial = distance(close.state.player, close.boss);
  const start = { x: close.boss.x, z: close.boss.z };
  simulate(close.state, 0.3);
  assert.equal(close.boss.telegraph, null, 'point-blank casting must not preempt the initial retreat');
  assert.ok(distance(close.boss, start) > 0.35, 'retreat begins with real movement rather than idle delay');
  assert.ok(distance(close.state.player, close.boss) > initial, 'the initial arc creates space rather than moving into the player');
  simulate(close.state, 2.7);
  assert.ok(distance(close.state.player, close.boss) > 3.2, 'retreat and recovery should establish useful ranged spacing');
  const far = placement('meimei', 7);
  warning(far.state, far.boss);
  assert.equal(far.boss.attackKind, 'volley');
});

for (const id of ['sonny', 'meimei', 'wing']) {
  test(`${id} locks its complete warning geometry and gives a 250 ms reaction a dodge opportunity`, () => {
    const { state, boss } = placement(id, 7, 4);
    warning(state, boss);
    const warnings = [...boss.telegraphs], snapshots = warnings.map(shape);
    assert.ok(warnings.length > 0, 'the renderer receives actual warning shapes');
    const started = state.time, duration = boss.telegraph.duration;
    assert.ok(duration >= 0.9, 'a newly revealed attack has a readable windup');
    let dashed = false;
    const hp = state.player.hp;
    for (let i = 0; i < 180 && !state.combatEvents.some(event => event.type === 'enemy-attack'); i++) {
      const reacting = state.time - started >= 0.25;
      stepGame(state, reacting ? { x: 1, dash: !dashed } : {}, FIXED_STEP);
      if (reacting) dashed = true;
      for (let j = 0; j < warnings.length; j++) assert.deepEqual(shape(warnings[j]), snapshots[j], 'lock includes angle, position, length, width and radius');
      if (state.time < started + duration - FIXED_STEP) assert.equal(state.player.hp, hp, 'windup cannot deal invisible early damage');
    }
    const release = state.combatEvents.find(event => event.type === 'enemy-attack');
    assert.ok(release, 'the warning must resolve, not be cancelled by player movement');
    assert.ok(release.time - started >= duration - FIXED_STEP - 1e-9);
    simulate(state, 0.5);
    assert.equal(state.player.hp, hp, 'a normal perpendicular dodge after reading the warning can avoid the attack');
  });
}

test('a charge advances over multiple ticks, keeps its locked path, and damages a target only once', () => {
  const { state, boss } = placement('sonny', 6);
  const t = warning(state, boss), locked = shape(t);
  assert.equal(boss.attackKind, 'charge');
  let chargeFrames = 0, maximumStep = 0, travelled = 0;
  for (let i = 0; i < 180 && boss.phase !== 'recovery'; i++) {
    const before = { x: boss.x, z: boss.z };
    stepGame(state, {}, FIXED_STEP);
    const moved = distance(before, boss);
    maximumStep = Math.max(maximumStep, moved); travelled += moved;
    assertSolid(boss);
    if (boss.phase === 'charge') {
      chargeFrames++;
      assert.deepEqual(shape(boss.telegraph), locked);
      assert.equal(boss.telegraph.progress, 1);
    }
  }
  assert.ok(chargeFrames >= 8, 'charge is a visible movement phase, rather than one large move');
  assert.ok(maximumStep > 0 && maximumStep < 0.7, `largest physics step was ${maximumStep}`);
  assert.ok(travelled > 4, 'the charge actually traverses its warned lane');
  assert.equal(boss.phase, 'recovery');
  const hits = state.combatEvents.filter(event => event.type === 'player-hit' && event.actorId === boss.id);
  assert.equal(hits.length, 1, 'one charge does not tick repeated contact damage');
  const damage = state.stats.damageTaken;
  simulate(state, 0.4);
  assert.equal(state.stats.damageTaken, damage, 'the completed charge cannot settle damage again in recovery');
});

test('a locked charge stops at a cabinet instead of sliding around it or tracking an escaping target', () => {
  const { state, boss } = arena('sonny', 2026);
  Object.assign(boss, { x: 1, z: 0 });
  Object.assign(state.player, { x: -4.8, z: 0 });
  warning(state, boss);
  assert.equal(boss.attackKind, 'charge');
  const started = state.time;
  let moved = false, charging = false;
  for (let i = 0; i < 180 && boss.phase !== 'recovery'; i++) {
    stepGame(state, state.time - started >= 0.25 ? { z: 1 } : {}, FIXED_STEP);
    charging ||= boss.phase === 'charge'; moved ||= boss.x < 0;
    assertSolid(boss);
    assert.ok(boss.x >= -6 + boss.radius - 1e-7, 'the swept body stops at the cabinet face');
    assert.ok(Math.abs(boss.z) < 1e-7, 'charge does not axis-slide or curve after the warning locks');
  }
  assert.ok(charging && moved, 'the test exercises an actual charge into scenery');
  assert.equal(boss.phase, 'recovery');
  assert.ok(boss.x < -4.5, 'the charge reaches the obstacle rather than stopping without travelling');
  assert.equal(state.stats.damageTaken, 0);
});

test('every speech projectile stays in a revealed lane and lifetime cannot add an extra travel tick', () => {
  const { state, boss } = arena('meimei', 4);
  Object.assign(boss, { x: -9, z: -19 });
  Object.assign(state.player, { x: -2, z: -19 });
  warning(state, boss);
  assert.equal(boss.attackKind, 'volley');
  const lanes = boss.telegraphs.map(t => ({ ...t }));
  assert.equal(lanes.length, 5);
  assert.ok(lanes.every(t => t.kind === 'line'));
  const started = state.time;
  while (!state.projectiles.length && state.time - started < 3) {
    stepGame(state, state.time - started >= 0.25 ? { z: 1 } : {}, FIXED_STEP);
  }
  assert.equal(state.projectiles.length, 5);
  const flights = state.projectiles.map(projectile => {
    const speed = Math.hypot(projectile.vx, projectile.vz);
    const lane = lanes.reduce((best, lane) => {
      const error = Math.abs(projectile.vx / speed - Math.sin(lane.angle)) + Math.abs(projectile.vz / speed + Math.cos(lane.angle));
      return !best || error < best.error ? { lane, error } : best;
    }, null);
    assert.ok(lane.error < 1e-7, 'each projectile direction has its own warning');
    assert.ok(lane.lane.width + 1e-7 >= projectile.radius * 2, 'the lane covers the full projectile width');
    return { projectile, lane: lane.lane, speed,
      origin: { x: projectile.x - projectile.vx * FIXED_STEP, z: projectile.z - projectile.vz * FIXED_STEP },
      lifeBudget: Math.round((projectile.life + FIXED_STEP) * 1e9) / 1e9 };
  });
  boss.timer = 100; // Isolate the already-released volley from a second cast.
  for (let i = 0; i < 210 && state.projectiles.length; i++) {
    for (const { projectile, lane } of flights) {
      const dx = projectile.x - lane.x, dz = projectile.z - lane.z;
      const forward = dx * Math.sin(lane.angle) - dz * Math.cos(lane.angle);
      const side = Math.abs(dx * Math.cos(lane.angle) + dz * Math.sin(lane.angle));
      assert.ok(forward - projectile.radius >= -1e-7 && forward + projectile.radius <= lane.length + 1e-7, 'actual travel cannot reach unmarked space beyond the lane');
      assert.ok(side + projectile.radius <= lane.width / 2 + 1e-7, 'the sides of the projectile remain inside the revealed lane');
    }
    stepGame(state, {}, FIXED_STEP);
  }
  assert.equal(state.projectiles.length, 0);
  for (const { projectile, lane } of flights) {
    const dx = projectile.x - lane.x, dz = projectile.z - lane.z;
    const forward = dx * Math.sin(lane.angle) - dz * Math.cos(lane.angle);
    assert.ok(forward + projectile.radius <= lane.length + 1e-7, 'the removal tick cannot travel beyond the warning cap');
  }
  const center = flights.reduce((best, flight) => Math.abs(flight.projectile.vz) < Math.abs(best.projectile.vz) ? flight : best);
  const travelled = distance(center.projectile, center.origin);
  assert.ok(Math.abs(travelled - center.speed * center.lifeBudget) < 1e-6, 'the clear central lane exercises the entire lifetime, including its final partial tick');
  assert.ok(travelled + center.projectile.radius * 2 <= center.lane.length + 1e-7);
});

test('the visible gap between two distant volley lanes is safe for a full player body', () => {
  const { state, boss } = arena('meimei', 73);
  Object.assign(boss, { x: -9, z: -19 });
  Object.assign(state.player, { x: -2, z: -19 });
  warning(state, boss);
  const lanes = boss.telegraphs.map(t => ({ ...t }));
  assert.equal(lanes.length, 5);
  const angle = (lanes[2].angle + lanes[3].angle) / 2;
  const goal = { x: boss.x + Math.sin(angle) * 11, z: boss.z - Math.cos(angle) * 11 };
  assert.ok(isWalkable(goal.x, goal.z, state.player.radius));
  for (const lane of lanes) {
    const dx = goal.x - lane.x, dz = goal.z - lane.z;
    const forward = dx * Math.sin(lane.angle) - dz * Math.cos(lane.angle);
    const side = Math.abs(dx * Math.cos(lane.angle) + dz * Math.sin(lane.angle));
    const separation = Math.hypot(Math.max(-forward, forward - lane.length, 0), Math.max(side - lane.width / 2, 0));
    assert.ok(separation > state.player.radius + 0.03, 'the chosen gap contains the whole player, not only its center');
  }
  const started = state.time;
  let released = false, closestShot = Infinity;
  for (let i = 0; i < 260; i++) {
    const distanceToGoal = distance(state.player, goal);
    const move = state.time - started >= 0.25 && distanceToGoal > 0.08
      ? { x: (goal.x - state.player.x) / distanceToGoal, z: (goal.z - state.player.z) / distanceToGoal } : {};
    stepGame(state, move, FIXED_STEP);
    if (state.projectiles.length && !released) { released = true; boss.timer = 100; }
    if (distance(state.player, goal) < 0.15) for (const shot of state.projectiles) closestShot = Math.min(closestShot, distance(state.player, shot));
  }
  assert.ok(released, 'the test contains a real five-projectile volley');
  assert.ok(distance(state.player, goal) < 0.15, 'normal movement reaches the revealed gap');
  assert.ok(closestShot < 1.2, 'projectiles actually pass either side of the nearby player');
  assert.equal(state.stats.damageTaken, 0, 'empty space outside every warning lane does not conceal a wider damaging fan');
});

test('half-health Wing chains distinct attacks with a recovery gap and a fresh readable warning', () => {
  const { state, boss } = placement('wing', 6, 2026);
  boss.hp = boss.maxHp / 2;
  let previousWarning = null, firstRelease = null, secondWarningAt = null;
  const observedWarnings = [], released = [];
  let sawRageChain = false;
  for (let i = 0; i < 360 && released.length < 2; i++) {
    // Read the first bombardment, then use normal movement to close the gap.
    // The second part of the chain must respond to that now-close target.
    const approaching = state.time > 0.25 && distance(state.player, boss) > 2.2;
    stepGame(state, { z: approaching ? -1 : 0 }, FIXED_STEP);
    sawRageChain ||= boss.comboTotal === 2;
    if (boss.telegraph && boss.telegraph !== previousWarning && boss.phase === 'windup') {
      previousWarning = boss.telegraph;
      observedWarnings.push({ at: state.time, duration: boss.telegraph.duration, kind: boss.attackKind });
      assert.ok(boss.telegraph.duration >= 0.9);
      if (firstRelease) secondWarningAt = state.time;
    }
    for (const event of state.combatEvents) if (event.type === 'enemy-attack' && !released.some(entry => entry.serial === event.serial)) {
      released.push(event); firstRelease ||= event;
    }
  }
  assert.equal(boss.enraged, true);
  assert.ok(sawRageChain);
  assert.equal(released.length, 2);
  assert.equal(observedWarnings.length, 2, 'a chain cannot omit the second warning');
  assert.notEqual(released[0].source, released[1].source, 'the rage chain uses distinct attacks');
  assert.ok(secondWarningAt - firstRelease.time >= 0.65 - FIXED_STEP - 1e-9, 'the player has a real recovery window between warnings');
});

for (const id of ['meimei', 'wing']) {
  test(`an unmoving starter cannot cheaply trade attacks with ${id}`, (t) => {
    const { state, boss } = placement(id, 2, 73);
    const startingMaxHp = state.player.maxHp;
    for (let i = 0; i < 30 * 60 && state.status === 'playing' && !state.defeatedBosses[id]; i++) {
      stepGame(state, { attack: true, burst: true }, FIXED_STEP);
    }
    assert.ok(state.stats.damageDealt > 0, 'the comparison is an actual reachable fight');
    assert.ok(state.stats.damageTaken >= startingMaxHp * 0.6, 'ignoring repeated visible attacks must create real pressure');
    assert.ok(!state.defeatedBosses[id] || state.stats.damageTaken >= startingMaxHp * 0.85,
      'if the stationary player narrowly wins, it must have risked nearly all starting health');
    t.diagnostic(JSON.stringify({ boss: id, seconds: Number(state.time.toFixed(2)), status: state.status,
      bossDefeated: state.defeatedBosses[id], damageTaken: state.stats.damageTaken, damageDealt: state.stats.damageDealt }));
  });
}
