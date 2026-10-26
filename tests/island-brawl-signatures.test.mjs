import test from 'node:test';
import assert from 'node:assert/strict';
import { createIslandBrawl, BRAWL_ARENA } from '../dist/island/brawl.js';
import { BRAWL_ROSTER } from '../dist/island/brawl-roster.js';
import { ISLAND_CAST } from '../dist/island/cast.js';

const KINDS = new Set(['strike', 'rush', 'projectile', 'zone', 'heal', 'guard', 'slow']);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function approach(state) {
  const { player, opponent } = state;
  if (distance(player, opponent) < 75) return {};
  const aim = Math.atan2(opponent.y - player.y, opponent.x - player.x);
  const routes = [0, -.65, .65, -1.2, 1.2, -1.7, 1.7].map(offset => {
    const x = Math.cos(aim + offset), y = Math.sin(aim + offset), next = { x: player.x + x * 30, y: player.y + y * 30 };
    return { x, y, next, score: distance(next, opponent) + Math.abs(offset) * .02 };
  }).filter(({ next }) => next.x > 42 && next.x < 918 && next.y > 42 && next.y < 498
    && state.obstacles.every(obstacle => distance(next, obstacle) >= player.radius + obstacle.radius + 1));
  routes.sort((a, b) => a.score - b.score);
  return routes[0] ? { x: routes[0].x, y: routes[0].y } : {};
}
function observePolicy(state) {
  const toward = { x: state.opponent.x - state.player.x, y: state.opponent.y - state.player.y };
  const gap = distance(state.player, state.opponent);
  const evade = state.opponent.telegraphRemaining > 0 && state.opponent.telegraphRemaining < .23 && gap < 135;
  return {
    x: evade ? -toward.x : gap > 65 ? toward.x : 0, y: evade ? -toward.y : gap > 65 ? toward.y : 0,
    // Lower the opponent into all low-stamina triggers, then stop short of a KO
    // so every authored ability has time to complete using normal play inputs.
    attack: state.opponent.hp > state.opponent.maxHp * .3 && state.opponent.telegraphRemaining === 0,
    dodge: evade,
    special: state.opponent.hp > state.opponent.maxHp * .6 && state.player.energy >= 100 && gap < 140,
  };
}
function assertDescriptor(item, id) {
  for (const key of ['id', 'name', 'tell', 'line', 'counter']) assert.ok(typeof item[key] === 'string' && item[key].trim(), `${id}: ${key} explains the authored ability`);
  assert.ok(KINDS.has(item.kind), `${id}: the ability has a supported gameplay effect`);
  for (const key of ['windup', 'cooldown', 'range', 'radius', 'damage', 'heal', 'shield', 'duration', 'at']) {
    if (item[key] !== undefined) assert.ok(Number.isFinite(item[key]) && item[key] >= 0, `${id}: ${key} is a bounded game value`);
  }
  assert.ok(item.windup >= .7, `${id}: a visible warning gives the visitor time to respond`);
}
function reachCast(game, predicate, policy = observePolicy) {
  let state = game.start();
  for (let frame = 0; frame < 75 * 60 && state.phase === 'playing'; frame++) {
    if (predicate(state)) return state;
    state = game.step(1 / 60, policy(state));
  }
  assert.fail('the normal-input scenario did not reach its intended authored cast');
}

test('all 34 authored colleagues have personal introductions, at least three playable skills and a once-only event', () => {
  assert.deepEqual(Object.keys(BRAWL_ROSTER).sort(), ISLAND_CAST.map(person => person.id).sort());
  const openings = new Set(), names = new Set();
  for (const { id } of ISLAND_CAST) {
    const person = BRAWL_ROSTER[id];
    assert.equal(person.id, id); assert.ok(person.title?.trim()); assert.ok(person.opening?.trim());
    assert.ok(!openings.has(person.opening), `${id}: opening dialogue is personal`); openings.add(person.opening);
    assert.ok(person.skills.length >= 3, `${id}: there are at least three authored abilities`);
    assert.equal(new Set(person.skills.map(skill => skill.id)).size, person.skills.length, `${id}: skill identifiers are unique`);
    assert.ok(person.events.length >= 1, `${id}: the colleague has an authored encounter event`);
    assert.ok(Object.isFrozen(person) && Object.isFrozen(person.skills) && Object.isFrozen(person.events), `${id}: a fight cannot mutate the shared catalog`);
    for (const skill of person.skills) {
      assertDescriptor(skill, `${id}/${skill.id}`); assert.ok(Object.isFrozen(skill));
      assert.ok(!names.has(skill.name), `${id}: a skill is not just the same named move assigned to every colleague`); names.add(skill.name);
    }
    for (const event of person.events) {
      assertDescriptor(event, `${id}/${event.id}`); assert.ok(Object.isFrozen(event));
      assert.equal(event.once, true); assert.ok(['time', 'lowHp', 'pressure'].includes(event.trigger));
    }
  }
});

test('signature state is a detached snapshot and cannot be used to change cooldowns, usage or dialogue', () => {
  const game = createIslandBrawl({ opponentId: 'wing', seed: 'snapshot-signatures' });
  const first = game.start(), baseline = game.getState();
  assert.ok(first.signature.skills.length >= 3); assert.ok(first.signature.events.length >= 1);
  first.signature.skills[0].uses = 999; first.signature.skills[0].cooldownRemaining = 0;
  first.signature.events[0].uses = 999; first.signature.history.push({ seq: 999, time: 0, text: 'forged dialogue' });
  if (first.signature.history[0]) first.signature.history[0].text = 'changed';
  assert.deepEqual(game.getState(), baseline, 'renderers receive values rather than mutation access to the encounter');
});

test('signature casts and encounter clocks stop while paused and cannot mutate a finished bout', () => {
  const game = createIslandBrawl({ opponentId: 'wing', seed: 'pause-signatures' }); let state = game.start();
  for (let frame = 0; frame < 25 * 60 && state.phase === 'playing' && !state.opponent.activeSkillId; frame++) state = game.step(1 / 60);
  assert.ok(state.opponent.activeSkillId, 'the test reaches an actual authored ability');
  const paused = game.pause(); assert.equal(paused.phase, 'paused');
  for (let i = 0; i < 60; i++) assert.deepEqual(game.step(.05, { x: 1, attack: true, dodge: true, special: true }), paused);
  game.resume(); const previous = game.getState(); state = game.step(10000);
  assert.ok(state.elapsed - previous.elapsed <= .05 + 1e-8);
  const final = game.forfeit(); assert.equal(final.outcome, 'lose');
  for (const action of [() => game.step(.05), () => game.resume(), () => game.pause(), () => game.forfeit(), () => game.start()]) assert.deepEqual(action(), final);
});

test('all 119 personal skills and all 34 exclusive events really finish during ordinary playable encounters', () => {
  const completedKinds = new Set(); let sawHeal = false, sawShield = false, sawEnemyProjectile = false;
  for (const { id } of ISLAND_CAST) {
    const game = createIslandBrawl({ opponentId: id, seed: 'observe' }), person = BRAWL_ROSTER[id];
    const seen = new Map(), starts = new Map(), completions = new Set(), eventCompletions = new Set(), lastStart = new Map();
    let state = game.start(); assert.equal(state.signature.history[0].text, person.opening);
    for (let frame = 0; frame < 80 * 60 && state.phase === 'playing'; frame++) {
      const previous = state; state = game.step(1 / 60, observePolicy(state));
      sawHeal ||= state.opponent.hp > previous.opponent.hp;
      sawShield ||= state.opponent.shield > 0;
      sawEnemyProjectile ||= state.projectiles.some(projectile => projectile.owner === 'opponent' && typeof projectile.skillId === 'string');
      for (const body of [state.player, state.opponent]) {
        assert.ok(Number.isFinite(body.hp) && body.hp >= 0 && body.hp <= body.maxHp, `${id}: healing and damage stay within stamina bounds`);
        assert.ok(body.shield >= 0 && body.shield <= 30 && Number.isFinite(body.shieldRemaining));
      }
      for (const item of state.signature.skills) {
        const spec = person.skills.find(skill => skill.id === item.id);
        assert.ok(Number.isFinite(item.cooldownRemaining) && item.cooldownRemaining >= 0 && item.cooldownRemaining <= spec.cooldown + 1e-7, `${item.id}: cooldown is finite and bounded`);
        if (spec.once) assert.ok(item.uses <= 1, `${item.id}: a once-only skill cannot repeat`);
      }
      for (const item of state.signature.events) assert.ok(item.uses <= 1, `${item.id}: exclusive events cannot repeat after healing or later pressure`);
      for (const item of state.signature.history) {
        if (seen.has(item.seq)) continue; seen.set(item.seq, item);
        assert.ok(Number.isFinite(item.time) && item.time >= 0 && item.time <= state.elapsed + 1e-7);
        if (item.type === 'skill-start' || item.type === 'event-start') {
          const spec = [...person.skills, ...person.events].find(skill => skill.id === item.id); assert.ok(spec, item.id);
          if (lastStart.has(item.id)) assert.ok(item.time - lastStart.get(item.id) >= spec.cooldown - .02, `${item.id}: the AI respects the authored cooldown`);
          lastStart.set(item.id, item.time); starts.set(item.id, item);
        }
        if (item.type === 'skill-end' || item.type === 'event-end') {
          const spec = [...person.skills, ...person.events].find(skill => skill.id === item.id), start = starts.get(item.id);
          assert.ok(start && item.time - start.time >= spec.windup - .02, `${item.id}: the warning completes before its effect`);
          (item.type === 'skill-end' ? completions : eventCompletions).add(item.id); completedKinds.add(spec.kind);
        }
      }
    }
    assert.equal(state.phase, 'finished', id); assert.equal(state.elapsed, BRAWL_ARENA.duration, `${id}: observing the repertoire remains survivable`);
    assert.ok(state.player.hp > 0 && state.opponent.hp > 0, `${id}: the visitor can leave room for a full repertoire without a forced knockout`);
    for (const skill of person.skills) assert.ok(completions.has(skill.id), `${skill.id}: the named ability really executes rather than only appearing on a card`);
    for (const event of person.events) assert.ok(eventCompletions.has(event.id), `${event.id}: the exclusive encounter really executes`);
    for (const usage of state.signature.skills) assert.equal(usage.uses, [...seen.values()].filter(item => item.type === 'skill-start' && item.id === usage.id).length);
    for (const usage of state.signature.events) assert.equal(usage.uses, 1);
  }
  assert.deepEqual([...completedKinds].sort(), [...KINDS].sort());
  assert.ok(sawHeal && sawShield && sawEnemyProjectile, 'healing, defensive shields and enemy projectiles change the simulation, not just the dialogue');
});

test('Wing’s sandalwood recovery heals when allowed to finish and is cancelled by an actual timed attack', () => {
  const uninterrupted = createIslandBrawl({ opponentId: 'wing', seed: 'observe' });
  const interrupted = createIslandBrawl({ opponentId: 'wing', seed: 'observe' });
  const healing = state => state.opponent.castKind === 'heal' && state.opponent.telegraphRemaining > 1;
  let control = reachCast(uninterrupted, healing), state = reachCast(interrupted, healing);
  assert.deepEqual(state, control);
  const skillId = state.opponent.activeSkillId, spec = BRAWL_ROSTER.wing.skills.find(skill => skill.id === skillId), originalHp = state.opponent.hp;
  assert.equal(spec.name, '全身檀香');
  const seen = new Map(state.signature.history.map(item => [item.seq, item]));
  for (let frame = 0; frame < Math.ceil(spec.windup * 60) && state.opponent.activeSkillId === skillId; frame++) {
    state = interrupted.step(1 / 60, { ...approach(state), attack: true }); control = uninterrupted.step(1 / 60);
    for (const item of state.signature.history) seen.set(item.seq, item);
  }
  assert.ok(state.opponent.hp < originalHp, 'the cancellation comes from actual incoming damage');
  assert.ok([...seen.values()].some(item => item.type === 'skill-cancel' && item.id === skillId));
  for (let frame = 0; frame < 2 * 60; frame++) { state = interrupted.step(1 / 60); control = uninterrupted.step(1 / 60); }
  assert.equal(control.opponent.hp, Math.min(control.opponent.maxHp, originalHp + spec.heal), 'an uninterrupted cast restores the authored amount within maximum stamina');
  assert.ok(state.opponent.hp < originalHp, 'the cancelled channel grants no late recovery');
  for (let frame = 0; frame < 75 * 60 && state.phase === 'playing'; frame++) {
    state = interrupted.step(1 / 60, observePolicy(state));
    for (const item of state.signature.history) seen.set(item.seq, item);
  }
  assert.equal(state.signature.skills.find(item => item.id === skillId).uses, 1);
  assert.equal([...seen.values()].filter(item => item.type === 'skill-start' && item.id === skillId).length, 1, 'a cancelled once-only recovery cannot be retried after its cooldown');
  assert.equal([...seen.values()].filter(item => item.type === 'skill-end' && item.id === skillId).length, 0);
});

test('Sonny’s low-stamina old-injury pose protects with a finite shield and remains down after a blocked hit', () => {
  const game = createIslandBrawl({ opponentId: 'sonny', seed: 'observe' });
  let state = reachCast(game, state => state.opponent.activeSkillId === 'sonny-old-injury');
  assert.ok(state.opponent.hp < state.opponent.maxHp * .4, 'the old-injury statement requires actual low stamina');
  while (state.opponent.telegraphRemaining > 0) {
    const gap = distance(state.player, state.opponent);
    state = game.step(1 / 60, gap > 65 ? { x: state.opponent.x - state.player.x, y: state.opponent.y - state.player.y } : {});
  }
  const hp = state.opponent.hp, shield = state.opponent.shield;
  assert.ok(shield > 0 && state.opponent.shieldRemaining > 0); assert.equal(state.opponent.pose, 'down');
  state = game.step(.02, { attack: true });
  assert.equal(state.opponent.hp, hp); assert.ok(state.opponent.shield < shield && state.opponent.shield > 0, 'the shield absorbs a real strike');
  assert.equal(state.opponent.pose, 'down'); assert.equal(state.opponent.activeSkillId, 'sonny-old-injury', 'a hit cannot make the active shield pose vanish');
  for (let frame = 0; frame < 4 * 60 && state.opponent.shieldRemaining > 0; frame++) state = game.step(1 / 60, { x: -1 });
  assert.equal(state.opponent.shield, 0); assert.equal(state.opponent.shieldRemaining, 0);
  assert.notEqual(state.opponent.pose, 'down', 'the pose ends when the protection expires');
  assert.equal(state.signature.skills.find(item => item.id === 'sonny-old-injury').uses, 1);
});

test('the third-floor circle locks a visible target and can be escaped by ordinary movement', () => {
  const stationary = createIslandBrawl({ opponentId: 'wing', seed: 'zone-target' }), escaping = createIslandBrawl({ opponentId: 'wing', seed: 'zone-target' });
  const zone = state => state.opponent.activeSkillId === 'wing-third-floor';
  let control = reachCast(stationary, zone, () => ({})), state = reachCast(escaping, zone, () => ({}));
  assert.deepEqual(state, control); assert.equal(state.opponent.telegraphKind, 'circle');
  const target = { ...state.opponent.telegraphTarget }, hp = state.player.hp, spec = BRAWL_ROSTER.wing.skills.find(skill => skill.id === state.opponent.activeSkillId);
  assert.ok(distance(state.player, target) <= state.player.radius);
  const detached = escaping.getState(); detached.opponent.telegraphTarget.x = Infinity;
  assert.deepEqual(escaping.getState().opponent.telegraphTarget, target, 'UI snapshots cannot move the locked warning');
  for (let frame = 0; frame < Math.ceil(spec.windup * 60) + 2; frame++) {
    state = escaping.step(1 / 60, { x: -1 }); control = stationary.step(1 / 60);
    if (state.opponent.telegraphRemaining > 0) assert.deepEqual(state.opponent.telegraphTarget, target);
  }
  assert.ok(distance(state.player, target) > spec.radius + state.player.radius);
  assert.equal(state.player.hp, hp, 'walking outside the circle avoids its actual damage');
  assert.equal(control.player.hp, hp - spec.damage, 'standing in the marked area takes the authored hit');
  for (const body of [state.player, state.opponent]) {
    assert.ok(body.x >= BRAWL_ARENA.margin + body.radius && body.x <= BRAWL_ARENA.width - BRAWL_ARENA.margin - body.radius);
    assert.ok(body.y >= BRAWL_ARENA.margin + body.radius && body.y <= BRAWL_ARENA.height - BRAWL_ARENA.margin - body.radius);
  }
});

test('a landed discussion circle slows actual walking only for its declared duration', () => {
  const game = createIslandBrawl({ opponentId: 'wing', seed: 'slow-effect' });
  let state = reachCast(game, state => state.opponent.activeSkillId === 'wing-ten-minutes', () => ({}));
  while (state.opponent.telegraphRemaining > 0) state = game.step(1 / 60);
  assert.ok(state.player.slowRemaining > 0, 'the landed circle changes a gameplay status');
  const first = state.player; state = game.step(.05, { x: -1 }); const slowDistance = distance(first, state.player);
  for (let frame = 0; frame < 4 * 60 && state.player.slowRemaining > 0; frame++) state = game.step(1 / 60);
  assert.equal(state.player.slowRemaining, 0);
  const second = state.player; state = game.step(.05, { x: -1 }); const regularDistance = distance(second, state.player);
  assert.ok(slowDistance > 0 && regularDistance > slowDistance * 1.5, 'expiry restores the ordinary movement speed');
});

test('a rush blocked by a planter stops instead of sliding outside its advertised line', () => {
  const game = createIslandBrawl({ opponentId: 'jack', seed: 'blocked-rush' });
  let state = reachCast(game, state => state.opponent.activeSkillId === 'jack-court-cut', () => ({ x: 1 }));
  const origin = { x: state.opponent.x, y: state.opponent.y }, angle = state.opponent.facing, range = state.opponent.telegraphRange;
  const direction = { x: Math.cos(angle), y: Math.sin(angle) };
  assert.equal(state.opponent.telegraphKind, 'line');
  assert.ok(state.obstacles.some(obstacle => {
    const along = Math.max(0, Math.min(range, (obstacle.x - origin.x) * direction.x + (obstacle.y - origin.y) * direction.y));
    return distance(obstacle, { x: origin.x + along * direction.x, y: origin.y + along * direction.y }) < obstacle.radius + state.opponent.radius;
  }), 'the real cast has a solid obstruction in its line');
  let progress = 0;
  for (let frame = 0; frame < 3 * 60 && state.opponent.activeSkillId === 'jack-court-cut'; frame++) {
    state = game.step(1 / 60);
    const dx = state.opponent.x - origin.x, dy = state.opponent.y - origin.y;
    assert.ok(Math.abs(dx * direction.y - dy * direction.x) < 1e-6, 'the rushing actor stays on the warned centre line');
    progress = Math.max(progress, dx * direction.x + dy * direction.y);
    assert.ok(progress <= range + 1e-6);
  }
  assert.ok(progress < range - 5, 'the obstacle stops the charge before its full advertised reach');
  for (const obstacle of state.obstacles) assert.ok(distance(state.opponent, obstacle) >= state.opponent.radius + obstacle.radius - 1e-7);
});
