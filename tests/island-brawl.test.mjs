import test from 'node:test';
import assert from 'node:assert/strict';
import { BRAWL_ARENA, createIslandBrawl } from '../dist/island/brawl.js';
import { ISLAND_CAST } from '../dist/island/cast.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inputToward = state => ({ x: state.opponent.x - state.player.x, y: state.opponent.y - state.player.y });
function play(game, policy = () => ({}), limit = 80) {
  let state = game.start();
  for (let frame = 0; frame < limit * 60 && state.phase === 'playing'; frame++) state = game.step(1 / 60, policy(state, frame));
  return state;
}
function counterplay(state) {
  const toward = inputToward(state), distance = gap(state.player, state.opponent);
  const dodge = state.opponent.telegraphRemaining > 0 && state.opponent.telegraphRemaining < .23 && distance < 135;
  return { x: dodge ? -toward.x : distance > 65 ? toward.x : 0, y: dodge ? -toward.y : distance > 65 ? toward.y : 0,
    attack: state.opponent.telegraphRemaining === 0, dodge, special: state.player.energy >= 100 && distance < 140 };
}
function checkGeometry(state) {
  for (const body of [state.player, state.opponent]) {
    assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y));
    assert.ok(body.x >= BRAWL_ARENA.margin + body.radius - 1e-7 && body.x <= BRAWL_ARENA.width - BRAWL_ARENA.margin - body.radius + 1e-7);
    assert.ok(body.y >= BRAWL_ARENA.margin + body.radius - 1e-7 && body.y <= BRAWL_ARENA.height - BRAWL_ARENA.margin - body.radius + 1e-7);
    for (const obstacle of state.obstacles) assert.ok(gap(body, obstacle) >= body.radius + obstacle.radius - 1e-7, `${body.id}: intersects ${obstacle.id}`);
  }
  assert.ok(gap(state.player, state.opponent) >= state.player.radius + state.opponent.radius - 1e-7, 'bodies remain solid');
}

test('all public colleagues can duel with detached snapshots and no preselected outcome', () => {
  for (const { id } of ISLAND_CAST) {
    const game = createIslandBrawl({ opponentId: id }), first = game.getState();
    assert.equal(first.phase, 'ready'); assert.equal(first.outcome, null); assert.equal(first.summary, null);
    assert.equal(first.opponent.id, id); assert.equal(first.player.hp, first.player.maxHp); assert.equal(first.opponent.hp, first.opponent.maxHp);
    assert.ok(first.player.maxHp > 0 && first.duration === 75); checkGeometry(first);
    first.player.hp = 0; first.opponent.x = Infinity; first.obstacles[0].radius = 1000; first.pickups.length = 0;
    const next = game.getState(); assert.ok(next.player.hp > 0 && Number.isFinite(next.opponent.x)); assert.equal(next.pickups.length, 2); checkGeometry(next);
  }
  for (const id of ['unknown', 'resident:jack', '', null, undefined, '__proto__']) assert.throws(() => createIslandBrawl({ opponentId: id }), RangeError);
});

test('real input can win against all 34 colleagues, while passive play loses instead of receiving a random result', () => {
  for (const { id } of ISLAND_CAST) {
    const win = play(createIslandBrawl({ opponentId: id }), counterplay);
    assert.equal(win.phase, 'finished', id); assert.equal(win.outcome, 'win', id); assert.equal(win.opponent.hp, 0, id);
    assert.ok(win.player.hp > 0 && win.summary.damageDealt >= win.opponent.maxHp, `${id}: actual damage also accounts for any stamina the opponent recovered`);
    assert.ok(win.summary.specialsUsed >= 1 && win.summary.dodgesUsed >= 1, `${id}: active combat uses charged specials and dodge windows`);
    assert.equal(win.summary.reason, 'knockout'); assert.ok(win.elapsed < 75); checkGeometry(win);
  }
  for (const id of ['jack', 'wing', 'alice']) {
    const lose = play(createIslandBrawl({ opponentId: id }));
    assert.equal(lose.outcome, 'lose'); assert.equal(lose.player.hp, 0); assert.equal(lose.opponent.hp, lose.opponent.maxHp);
    assert.equal(lose.summary.damageDealt, 0); assert.equal(lose.summary.reason, 'knockout');
  }
});

test('holding attack from one place does not indefinitely stun an opponent through its telegraphs', () => {
  const state = play(createIslandBrawl({ opponentId: 'jack' }), () => ({ attack: true }));
  assert.equal(state.outcome, 'lose'); assert.ok(state.summary.damageTaken > 0);
  assert.ok(state.opponent.hp > 0, 'timed enemy attacks finish despite repeated player hits');
  const game = createIslandBrawl({ opponentId: 'wing' }); let sawTelegraph = false, sawRecovery = false;
  play(game, state => { sawTelegraph ||= state.opponent.action === 'windup' && state.opponent.telegraphRemaining > 0; sawRecovery ||= state.opponent.action === 'recover'; return {}; });
  assert.ok(sawTelegraph && sawRecovery, 'enemy attacks expose both warning and recovery windows');
});

test('courtyard obstacles, bounds and bodies remain solid under movement, dash and adversarial time/input values', () => {
  const game = createIslandBrawl({ opponentId: 'wing' }); game.start();
  for (const bad of [NaN, Infinity, -Infinity, -1, 0, '1', null]) { const before = game.getState(); assert.deepEqual(game.step(bad, { x: Infinity, y: NaN, attack: 'true' }), before); }
  let state = game.getState();
  for (let frame = 0; frame < 1800 && state.phase === 'playing'; frame++) {
    state = game.step(.05, { x: Math.sin(frame / 19) * 1000, y: Math.cos(frame / 31) * 1000, dodge: frame % 40 === 0 });
    checkGeometry(state);
  }
  const huge = createIslandBrawl({ opponentId: 'jack', seed: 'dt-bound' }), bounded = createIslandBrawl({ opponentId: 'jack', seed: 'dt-bound' });
  huge.start(); bounded.start();
  assert.deepEqual(huge.step(1e9, { x: 1, dodge: true }), bounded.step(.05, { x: 1, dodge: true }), 'one delayed frame cannot tunnel or catch up an entire hidden interval');
});

test('dash has a cooldown and protects a still-in-range player during a telegraphed hit', () => {
  const idle = createIslandBrawl({ opponentId: 'wing' }), evade = createIslandBrawl({ opponentId: 'wing' }); idle.start(); evade.start();
  let state = idle.getState();
  for (let frame = 0; frame < 1200; frame++) {
    const input = gap(state.player, state.opponent) > 70 ? inputToward(state) : {};
    state = idle.step(1 / 60, input); evade.step(1 / 60, input);
    if (state.opponent.telegraphRemaining > 0 && state.opponent.telegraphRemaining < .22) break;
  }
  assert.ok(state.opponent.telegraphRemaining > 0);
  const health = state.player.hp, toward = inputToward(state);
  idle.step(.05); let dodged = evade.step(.05, { ...toward, dodge: true });
  assert.ok(dodged.player.invulnerable && dodged.player.cooldowns.dodge > 1);
  for (let i = 0; i < 14; i++) { idle.step(1 / 60); dodged = evade.step(1 / 60, { dodge: true }); }
  assert.ok(idle.getState().player.hp < health, 'the undodged control takes the actual telegraphed hit');
  assert.equal(dodged.player.hp, health); assert.ok(gap(dodged.player, dodged.opponent) < 110, 'the protected visitor remained in attack range');
  for (let i = 0; i < 120; i++) evade.step(1 / 60, { dodge: true });
  assert.equal(evade.forfeit().summary.dodgesUsed, 1, 'holding a dash key is not a stream of retriggered dashes');
});

test('charged special and picked-up paper are actual bounded combat actions', () => {
  const game = createIslandBrawl({ opponentId: 'wing' }); let state = game.start();
  const before = state; state = game.step(.02, { attack: true, special: true, throw: true });
  assert.equal(state.opponent.hp, before.opponent.hp, 'out-of-range attack cannot damage across the courtyard');
  assert.equal(state.player.energy, 25, 'an uncharged special does not spend or grant energy'); assert.equal(state.projectiles.length, 0);
  for (let frame = 0; frame < 2500 && state.phase === 'playing'; frame++) {
    if (state.player.energy >= 100 && state.player.action !== 'dodge' && gap(state.player, state.opponent) < 130) break;
    const input = counterplay(state); state = game.step(1 / 60, { ...input, special: false });
  }
  assert.equal(state.player.energy, 100); const hp = state.opponent.hp;
  state = game.step(.02, { special: true }); assert.ok(state.player.energy < 100 && state.opponent.hp < hp); assert.ok(state.effects.some(item => item.type === 'special'));
  const paper = createIslandBrawl({ opponentId: 'jack' }); let p = paper.start();
  for (let frame = 0; frame < 180 && !p.player.paper; frame++) p = paper.step(1 / 60, { x: 210 - p.player.x, y: 150 - p.player.y });
  assert.equal(p.player.paper, true); assert.ok(p.pickups.some(item => !item.available && item.respawnIn > 0));
  for (let frame = 0; frame < 600 && p.opponent.telegraphRemaining === 0; frame++) p = paper.step(1 / 60, gap(p.player, p.opponent) > 70 ? inputToward(p) : {});
  assert.ok(p.opponent.telegraphRemaining > .2, 'aim at the stationary telegraph rather than a running opponent');
  p = paper.step(.02, { throw: true }); assert.equal(p.player.paper, false); assert.equal(p.projectiles.length, 1);
  for (let frame = 0; frame < 120 && p.opponent.hp === p.opponent.maxHp; frame++) p = paper.step(1 / 60);
  assert.ok(p.opponent.hp < p.opponent.maxHp, 'a thrown paper ball collides with the opponent');
  assert.equal(paper.forfeit().summary.throwsUsed, 1);
});

test('pause, resume and terminal outcomes release time/input ownership without reroll or late mutation', () => {
  const game = createIslandBrawl({ opponentId: 'jack', seed: 'pause' }); assert.equal(game.forfeit().phase, 'ready');
  game.start(); game.step(.02, { x: 1, attack: true }); const paused = game.pause();
  assert.equal(paused.phase, 'paused'); assert.deepEqual(game.step(10000, { x: -1, dodge: true }), paused);
  assert.equal(game.resume().phase, 'playing'); const before = game.getState().elapsed;
  assert.ok(game.step(10000).elapsed - before <= .05 + 1e-8);
  const final = game.forfeit(); assert.equal(final.outcome, 'lose'); assert.equal(final.summary.reason, 'forfeit');
  for (const action of [() => game.start(), () => game.pause(), () => game.resume(), () => game.forfeit(), () => game.step(.05, { attack: true, special: true })]) assert.deepEqual(action(), final);
  final.summary.damageDealt = 999; assert.notEqual(game.getState().summary.damageDealt, 999);
});

test('timeout compares remaining stamina and can end a fully dodged match as a draw', () => {
  const state = play(createIslandBrawl({ opponentId: 'wing' }), state => {
    const evade = state.opponent.telegraphRemaining > 0 && state.opponent.telegraphRemaining < .28;
    const toward = inputToward(state);
    // Projectile/rush warnings mark a line: move across it rather than into it.
    const direction = state.opponent.telegraphKind === 'line' ? { x: -toward.y, y: toward.x } : toward;
    return { ...(evade ? direction : {}), dodge: evade && state.player.cooldowns.dodge === 0 };
  });
  assert.equal(state.elapsed, 75); assert.equal(state.summary.reason, 'timeout'); assert.equal(state.outcome, 'draw');
  assert.equal(state.player.hp, state.opponent.hp); assert.equal(state.summary.damageDealt, 0);
  const a = createIslandBrawl({ opponentId: 'kind', seed: 'repeat' }), b = createIslandBrawl({ opponentId: 'kind', seed: 'repeat' }); a.start(); b.start();
  for (let i = 0; i < 500; i++) { const input = counterplay(a.getState()); assert.deepEqual(a.step(1 / 60, input), b.step(1 / 60, input)); }
});
