import test from 'node:test';
import assert from 'node:assert/strict';
import { PVP_ARENA, createIslandPvpCombat, normalizePvpInput } from '../dist/island/pvp-combat.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const toward = (body, point) => { const length = gap(body, point); return length > 1e-8 ? { x: (point.x - body.x) / length, y: (point.y - body.y) / length } : {}; };
const tick = (game, inputs = [{}, {}]) => game.step(.05, inputs);
function walkTo(game, seat, point, max = 12) {
  let state = game.getState();
  for (let n = 0; n < max * 20 && gap(state.fighters[seat], point) > 5; n++) {
    const inputs = [{}, {}]; inputs[seat] = toward(state.fighters[seat], point); state = tick(game, inputs);
  }
  assert.ok(gap(state.fighters[seat], point) <= 5, `seat ${seat} reaches its ordinary input destination`);
  return state;
}
function closePair(game) {
  walkTo(game, 0, { x: 250, y: 200 }); walkTo(game, 1, { x: 710, y: 200 });
  let state = game.getState();
  for (let n = 0; n < 120 && gap(...state.fighters) > 66; n++) state = tick(game, [{ x: 1 }, { x: -1 }]);
  assert.ok(gap(...state.fighters) < 82); return state;
}
function checkGeometry(state) {
  for (const body of state.fighters) {
    assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y));
    assert.ok(body.x >= PVP_ARENA.margin + body.radius - 1e-7 && body.x <= PVP_ARENA.width - PVP_ARENA.margin - body.radius + 1e-7);
    assert.ok(body.y >= PVP_ARENA.margin + body.radius - 1e-7 && body.y <= PVP_ARENA.height - PVP_ARENA.margin - body.radius + 1e-7);
    for (const obstacle of state.obstacles) assert.ok(gap(body, obstacle) >= body.radius + obstacle.radius - 1e-7, `${body.seat} does not enter ${obstacle.id}`);
    assert.ok(body.hp >= 0 && body.hp <= body.maxHp && body.energy >= 0 && body.energy <= 100);
  }
  assert.ok(gap(...state.fighters) >= state.fighters[0].radius + state.fighters[1].radius - 1e-7);
}

test('two equal human fighters start without AI, hidden skills, rewards or a preselected winner', () => {
  const game = createIslandPvpCombat({ seed: 'room-one' }), state = game.getState();
  assert.equal(state.phase, 'ready'); assert.equal(state.winner, null); assert.equal(state.reason, null); assert.equal(state.summary, null);
  assert.equal(state.duration, 75); assert.deepEqual(state.fighters.map(body => body.hp), [160, 160]);
  assert.deepEqual(state.fighters.map(body => body.energy), [25, 25]);
  checkGeometry(state);
  state.fighters[0].hp = 0; state.fighters[1].x = Infinity; state.pickups.length = 0; state.obstacles[0].radius = 900;
  assert.equal(game.getState().fighters[0].hp, 160); assert.equal(game.getState().pickups.length, 2); checkGeometry(game.getState());
  const ready = game.getState(); assert.deepEqual(game.step(.05, [{ attack: true }, { special: true }]), ready);
  game.start(); for (let n = 0; n < 300; n++) tick(game);
  assert.deepEqual(game.getState().fighters.map(body => [body.x, body.y, body.hp]), [[250, 270, 160], [710, 270, 160]], 'an unattended opponent never becomes a bot');
});

test('invalid inputs and client-supplied combat fields cannot move time, bodies, health or outcomes', () => {
  assert.deepEqual(normalizePvpInput({ x: Infinity, y: NaN, attack: 'true', dodge: 1, special: [], throw: null }), { x: 0, y: 0, attack: false, dodge: false, special: false, throw: false });
  assert.ok(Math.hypot(...Object.values(normalizePvpInput({ x: 999, y: -999 })).slice(0, 2)) <= 1);
  assert.deepEqual(normalizePvpInput(Object.defineProperty({}, 'x', { get() { throw new Error('hostile input'); } })), normalizePvpInput(null));
  const game = createIslandPvpCombat(); game.start();
  for (const dt of [null, undefined, '1', NaN, Infinity, -Infinity, -1, 0]) { const before = game.getState(); assert.deepEqual(game.step(dt, [{ x: 1 }]), before); }
  const before = game.getState(); tick(game, [{ hp: 0, maxHp: 9999, x: NaN, damage: 9999, winner: 0 }, { hp: 0, elapsed: 75 }]);
  assert.deepEqual(game.getState().fighters.map(body => [body.x, body.y, body.hp]), before.fighters.map(body => [body.x, body.y, body.hp]));
  assert.equal(game.getState().winner, null);
  const a = createIslandPvpCombat(), b = createIslandPvpCombat(); a.start(); b.start();
  assert.deepEqual(a.step(99999, [{ x: 1, dodge: true }, {}]), b.step(.05, [{ x: 1, dodge: true }, {}]), 'late server events never catch up a whole hidden interval');
});

test('both seats obey the same cooldowns and dodge needs a new press after stale/neutral controls', () => {
  const game = createIslandPvpCombat(); game.start();
  for (let n = 0; n < 80; n++) tick(game, [{ dodge: true }, { dodge: true }]);
  assert.deepEqual(game.getState().stats.map(stats => stats.dodgesUsed), [1, 1], 'holding dodge never repeats after cooldown');
  tick(game); tick(game, [{ dodge: true }, { dodge: true }]);
  assert.deepEqual(game.getState().stats.map(stats => stats.dodgesUsed), [2, 2]);
  for (let n = 0; n < 20; n++) tick(game, [{ special: true }, { special: true }]);
  assert.deepEqual(game.getState().stats.map(stats => stats.specialsUsed), [0, 0], 'unearned energy cannot buy a burst');
});

test('movement, collision, dodges and server stepping remain deterministic under both input streams', () => {
  const a = createIslandPvpCombat({ seed: 'repeat' }), b = createIslandPvpCombat({ seed: 'repeat' }); a.start(); b.start();
  for (let n = 0; n < 1000; n++) {
    const inputs = [0, 1].map(seat => ({ x: Math.sin(n / (17 + seat)), y: Math.cos(n / (29 + seat)),
      attack: n % 5 < 3, dodge: n % (43 + seat) === 0, special: n % 29 === 0, throw: n % 19 === 0 }));
    const first = tick(a, inputs), second = tick(b, inputs); assert.deepEqual(first, second); checkGeometry(first);
    if (first.phase === 'finished') break;
  }
});

test('swapping seats and rotating the same legal input stream preserves mirrored health, resources and geometry', () => {
  const a = createIslandPvpCombat(), b = createIslandPvpCombat(); a.start(); b.start();
  for (let n = 0; n < 900; n++) {
    const inputs = [0, 1].map(seat => ({ x: Math.sin(n / (19 + seat)), y: Math.cos(n / (37 + seat)), attack: n % (3 + seat) === 0, dodge: n % (47 + seat) === 0, special: n % 31 === 0, throw: n % 17 === 0 }));
    const mirrored = [inputs[1], inputs[0]].map(input => ({ ...input, x: -input.x, y: -input.y }));
    const first = tick(a, inputs), second = tick(b, mirrored);
    for (let seat = 0; seat < 2; seat++) {
      const left = first.fighters[seat], right = second.fighters[1 - seat];
      assert.ok(Math.abs(left.x + right.x - PVP_ARENA.width) < 1e-6);
      assert.ok(Math.abs(left.y + right.y - PVP_ARENA.height) < 1e-6);
      assert.equal(left.hp, right.hp); assert.equal(left.energy, right.energy); assert.equal(left.paper, right.paper);
      assert.deepEqual(first.stats[seat], second.stats[1 - seat]);
    }
    checkGeometry(first); checkGeometry(second);
  }
});

test('ordinary movement and held attacks can actually defeat either human seat without an AI policy', () => {
  for (const attacker of [0, 1]) {
    const game = createIslandPvpCombat(); game.start();
    const body = game.getState().fighters[attacker];
    walkTo(game, attacker, { x: body.x, y: 200 });
    walkTo(game, attacker, { x: attacker === 0 ? 650 : 310, y: 200 });
    let state = game.getState();
    for (let n = 0; n < 1200 && state.phase === 'playing'; n++) {
      const mine = state.fighters[attacker], target = state.fighters[1 - attacker], inputs = [{}, {}];
      inputs[attacker] = { ...(gap(mine, target) > 64 ? toward(mine, target) : {}), attack: true, special: mine.energy >= 100 && gap(mine, target) < 140 };
      state = tick(game, inputs); checkGeometry(state);
    }
    assert.equal(state.phase, 'finished'); assert.equal(state.winner, attacker); assert.equal(state.reason, 'knockout');
    assert.equal(state.fighters[1 - attacker].hp, 0); assert.equal(state.fighters[attacker].hp, 160);
    assert.equal(state.stats[attacker].damageDealt, 160); assert.ok(state.stats[attacker].specialsUsed >= 1);
    assert.deepEqual(tick(game, [{ attack: true }, { attack: true }]), state, 'a finished match cannot be settled again');
  }
});

test('simultaneous legal attacks resolve together, including a real double-knockout draw', () => {
  const game = createIslandPvpCombat(); game.start(); let state = closePair(game);
  for (let n = 0; n < 1200 && state.phase === 'playing'; n++) {
    const inputs = state.fighters.map((body, seat) => ({ ...(gap(...state.fighters) > 64 ? toward(body, state.fighters[1 - seat]) : {}), attack: true }));
    state = tick(game, inputs);
    assert.equal(state.fighters[0].hp, state.fighters[1].hp, 'first-seat update order cannot steal an otherwise simultaneous hit');
    checkGeometry(state);
  }
  assert.equal(state.phase, 'finished'); assert.equal(state.reason, 'knockout'); assert.equal(state.winner, null);
  assert.deepEqual(state.fighters.map(body => body.hp), [0, 0]); assert.deepEqual(state.stats.map(stats => stats.damageDealt), [160, 160]);
});

test('a real dodge protects an in-range human from the same attack that lands on an idle defender', () => {
  const still = createIslandPvpCombat(), dodge = createIslandPvpCombat(); still.start(); dodge.start(); closePair(still); closePair(dodge);
  const hit = tick(still, [{ attack: true }, {}]);
  const evaded = tick(dodge, [{ attack: true }, { dodge: true, y: -1 }]);
  assert.ok(hit.fighters[1].hp < 160); assert.equal(evaded.fighters[1].hp, 160); assert.equal(evaded.stats[1].dodgesUsed, 1);
});

test('paper pickups, projectiles, obstacle blocking and new-press throws have real symmetric consequences', () => {
  for (const seat of [0, 1]) {
    const game = createIslandPvpCombat(); game.start();
    const pickup = game.getState().pickups[seat]; walkTo(game, seat, pickup);
    assert.equal(game.getState().fighters[seat].paper, true);
    let state, sawProjectile = false;
    for (let n = 0; n < 220; n++) {
      const inputs = [{}, {}]; inputs[seat] = { throw: true }; state = tick(game, inputs);
      sawProjectile ||= state.projectiles.some(item => item.owner === seat);
      checkGeometry(state);
    }
    assert.ok(sawProjectile); assert.equal(state.fighters[1 - seat].hp, 148); assert.equal(state.stats[seat].throwsUsed, 1);
    assert.equal(state.fighters[seat].paper, true, 'staying at the pickup replenishes after nine seconds without automatically throwing');
    tick(game); const inputs = [{}, {}]; inputs[seat] = { throw: true }; state = tick(game, inputs); assert.equal(state.stats[seat].throwsUsed, 2);
  }
  const blocked = createIslandPvpCombat(); blocked.start(); walkTo(blocked, 0, { x: 210, y: 150 }); walkTo(blocked, 1, { x: 710, y: 150 });
  let state; for (let n = 0; n < 40; n++) state = tick(blocked, [{ throw: true }, {}]);
  assert.equal(state.stats[0].throwsUsed, 1); assert.equal(state.fighters[1].hp, 160, 'the north planter actually blocks a shot through its body');
  assert.equal(state.projectiles.length, 0);
});

test('timeout uses both actual health ratios and forfeits are owned, bounded and terminal', () => {
  const draw = createIslandPvpCombat(); draw.start(); let state;
  for (let n = 0; n < 1510 && draw.getState().phase !== 'finished'; n++) state = tick(draw);
  assert.equal(state.reason, 'timeout'); assert.equal(state.winner, null); assert.ok(Math.abs(state.elapsed - 75) < 1e-8);
  const score = createIslandPvpCombat(); score.start(); closePair(score); tick(score, [{ attack: true }, {}]);
  for (let n = 0; n < 1510 && score.getState().phase !== 'finished'; n++) state = tick(score);
  assert.equal(state.reason, 'timeout'); assert.equal(state.winner, 0); assert.ok(state.fighters[0].hp > state.fighters[1].hp);
  for (const seat of [0, 1]) {
    const game = createIslandPvpCombat(); const before = game.getState();
    for (const bad of [null, undefined, false, true, '0', -1, 2, NaN]) assert.deepEqual(game.forfeit(bad), before);
    const ended = game.forfeit(seat); assert.equal(ended.phase, 'finished'); assert.equal(ended.winner, 1 - seat); assert.equal(ended.reason, 'forfeit');
    assert.equal(ended.summary.duration, 0); assert.deepEqual(game.forfeit(1 - seat), ended); assert.deepEqual(game.start(), ended);
  }
});
