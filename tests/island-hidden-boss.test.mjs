import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { BRAWL_ROSTER, HIDDEN_BRAWL_ID, HIDDEN_BRAWL_PROFILE, getBrawlProfile } from '../dist/island/brawl-roster.js';
import { ISLAND_CHARACTER_LOOKS, HIDDEN_CHARACTER_LOOK, getIslandCharacterLook } from '../dist/island/character-looks.js';
import { displayIslandPersona } from '../dist/island/persona.js';
import { HIDDEN_PERSONAS_V45 } from '../dist/hidden-encounter-v45.js';
import { drawBrawlCharacter } from '../dist/island/brawl-characters.js';
import { createIslandBrawl } from '../dist/island/brawl.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function counterplay(state, observe = false) {
  const x = state.opponent.x - state.player.x, y = state.opponent.y - state.player.y, distance = gap(state.player, state.opponent);
  const evade = state.opponent.telegraphRemaining > 0 && ((observe && state.opponent.castKind === 'projectile' && distance < 220)
    || (state.opponent.telegraphRemaining < .23 && distance < 135));
  return {
    x: evade ? -x : distance > 65 ? x : 0, y: evade ? -y : distance > 65 ? y : 0,
    attack: (!observe || state.opponent.hp > state.opponent.maxHp * .3) && state.opponent.telegraphRemaining === 0,
    dodge: evade,
    special: (!observe || state.opponent.hp > state.opponent.maxHp * .6) && state.player.energy >= 100 && distance < 140,
  };
}

test('the optional final visitor remains separate from the 34 public colleagues and resident identities', () => {
  assert.equal(HIDDEN_BRAWL_ID, 'hidden-visitor');
  assert.equal(ISLAND_CAST.length, 34);
  assert.equal(Object.keys(BRAWL_ROSTER).length, 34);
  assert.equal(Object.keys(ISLAND_CHARACTER_LOOKS).length, 34);
  assert.ok(!ISLAND_CAST.some(person => person.id === HIDDEN_BRAWL_ID));
  assert.equal(Object.hasOwn(BRAWL_ROSTER, HIDDEN_BRAWL_ID), false);
  assert.equal(Object.hasOwn(ISLAND_CHARACTER_LOOKS, HIDDEN_BRAWL_ID), false);
  assert.equal(getBrawlProfile(HIDDEN_BRAWL_ID), HIDDEN_BRAWL_PROFILE);
  assert.equal(getIslandCharacterLook(HIDDEN_BRAWL_ID), HIDDEN_CHARACTER_LOOK);
  assert.equal(getBrawlProfile('__proto__'), null);
});

test('the final visitor has six distinct readable skills and two once-per-bout incidents with bounded values', () => {
  const boss = HIDDEN_BRAWL_PROFILE;
  assert.equal(boss.id, HIDDEN_BRAWL_ID);
  assert.ok(boss.opening && boss.title);
  assert.equal(boss.skills.length, 6);
  assert.equal(boss.events.length, 2);
  assert.equal(new Set(boss.skills.map(skill => skill.kind)).size, 6);
  const officialIds = new Set(Object.values(BRAWL_ROSTER).flatMap(person => [...person.skills, ...person.events].map(skill => skill.id)));
  const officialNames = new Set(Object.values(BRAWL_ROSTER).flatMap(person => person.skills.map(skill => skill.name)));
  const ids = new Set(), names = new Set();
  for (const skill of [...boss.skills, ...boss.events]) {
    assert.ok(Object.isFrozen(skill));
    assert.ok(!ids.has(skill.id) && !officialIds.has(skill.id)); ids.add(skill.id);
    assert.ok(!names.has(skill.name) && !officialNames.has(skill.name)); names.add(skill.name);
    for (const key of ['name', 'tell', 'line', 'counter']) assert.ok(skill[key]?.trim(), `${skill.id}: ${key}`);
    assert.ok(skill.windup >= 1 && skill.windup <= 2, `${skill.id}: every attack can be read and answered`);
    for (const value of [skill.range, skill.radius, skill.cooldown, skill.duration]) assert.ok(Number.isFinite(value) && value > 0);
    if (skill.damage !== undefined) assert.ok(skill.damage > 0 && skill.damage <= 22);
    if (skill.heal !== undefined) { assert.ok(skill.heal <= 22); assert.equal(skill.once, true); }
    if (boss.events.includes(skill)) { assert.equal(skill.once, true); assert.ok(['time', 'pressure'].includes(skill.trigger)); }
  }
  assert.ok(Object.isFrozen(boss) && Object.isFrozen(boss.skills) && Object.isFrozen(boss.events));
});

test('a locked island caller receives no hidden visitor identity or portrait until explicitly revealed', async () => {
  assert.equal(displayIslandPersona(HIDDEN_BRAWL_ID), null);
  assert.equal(displayIslandPersona(HIDDEN_BRAWL_ID, { revealHidden: false }), null);
  const shown = displayIslandPersona(HIDDEN_BRAWL_ID, { revealHidden: true });
  assert.equal(shown.name, HIDDEN_PERSONAS_V45[HIDDEN_BRAWL_ID].name);
  assert.equal(shown.image, './assets/hidden-visitor.png');
  assert.equal(shown.hidden, true);
  shown.name = 'changed';
  assert.equal(displayIslandPersona(HIDDEN_BRAWL_ID, { revealHidden: true }).name, '魚酥姐');
  const image = await readFile(new URL('../dist/assets/hidden-visitor.png', import.meta.url));
  assert.ok(image.length > 0, 'only the already-public original visitor artwork is needed');
  assert.ok(HIDDEN_BRAWL_PROFILE.sources.every(source => /^dist\/hidden-(?:encounter-v45|stories-v66)\.js#/.test(source)));
  assert.doesNotMatch(JSON.stringify(HIDDEN_BRAWL_PROFILE), /api\/admin|notion\.so|private-archive|raw-photo/);
});

test('the final visitor uses the same code-native doll renderer and keeps all poses finite without portrait pixels', () => {
  const look = HIDDEN_CHARACTER_LOOK;
  assert.equal(look.hairStyle, 'long'); assert.equal(look.glasses, 'square');
  for (const prop of ['cap', 'phone', 'bowl']) assert.ok(look.accessories.includes(prop));
  const actor = { id: HIDDEN_BRAWL_ID, x: 710, y: 270, radius: 18, facing: 0, invulnerable: false, telegraphRemaining: 0 };
  for (const action of ['idle', 'walk', 'windup', 'skill', 'heal', 'guard', 'hit', 'defeated']) for (const facing of [0, Math.PI]) for (const reducedMotion of [false, true]) {
    let depth = 0, calls = 0;
    const colours = new Set();
    const ctx = new Proxy({ roundRect: undefined, drawImage() { assert.fail('a hidden boss must not reintroduce pasted portraits into the arena'); } }, {
      set(target, key, value) { target[key] = value; if (key === 'fillStyle') colours.add(value); return true; },
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          calls++;
          if (key === 'save') depth++;
          if (key === 'restore') { depth--; assert.ok(depth >= 0); }
          for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value));
        };
      },
    });
    const body = { ...actor, action, facing }, before = structuredClone(body);
    drawBrawlCharacter(ctx, body, { isPlayer: false, name: '魚酥姐', elapsed: 2.2, reducedMotion });
    assert.equal(depth, 0); assert.ok(calls > 0);
    for (const colour of [look.skin, look.shirt, look.hair, look.inner]) assert.ok(colours.has(colour));
    assert.deepEqual(body, before, 'appearance never changes collision or battle state');
  }
});

test('the final visitor can be beaten with ordinary combat inputs while idle play loses', () => {
  for (const active of [true, false]) {
    const game = createIslandBrawl({ opponentId: HIDDEN_BRAWL_ID, seed: 'hidden-final-counterplay' });
    let state = game.start();
    for (let frame = 0; frame < 80 * 60 && state.phase === 'playing'; frame++) state = game.step(1 / 60, active ? counterplay(state) : {});
    assert.equal(state.phase, 'finished');
    assert.equal(state.outcome, active ? 'win' : 'lose');
    assert.equal(active ? state.opponent.hp : state.player.hp, 0, 'the result comes from actual health loss');
    assert.equal(state.summary.reason, 'knockout');
    if (active) { assert.ok(state.summary.damageDealt >= state.opponent.maxHp); assert.ok(state.summary.specialsUsed > 0 && state.summary.dodgesUsed > 0); }
    for (let i = 0; i < 10; i++) assert.deepEqual(game.step(.05, { attack: true, special: true }), state, 'a terminal final boss cannot inflict late damage or change the win');
  }
});

test('all six final-boss abilities and both incidents resolve through normal inputs with real healing, shields and projectiles', () => {
  const game = createIslandBrawl({ opponentId: HIDDEN_BRAWL_ID, seed: 'hidden-final-observation' });
  let state = game.start(), previousHp = state.opponent.hp, healed = false, shielded = false, fired = false;
  const completedSkills = new Set(), completedEvents = new Set();
  for (let frame = 0; frame < 80 * 60 && state.phase === 'playing'; frame++) {
    state = game.step(1 / 60, counterplay(state, true));
    for (const line of state.signature.history) {
      if (line.type === 'skill-end') completedSkills.add(line.id);
      if (line.type === 'event-end') completedEvents.add(line.id);
    }
    healed ||= state.opponent.hp > previousHp; previousHp = state.opponent.hp;
    shielded ||= state.opponent.shield > 0;
    fired ||= state.projectiles.some(projectile => projectile.owner === 'opponent');
    assert.ok(state.opponent.hp <= state.opponent.maxHp && state.opponent.hp >= 0);
    for (const body of [state.player, state.opponent]) {
      assert.ok(Number.isFinite(body.x) && Number.isFinite(body.y));
      for (const obstacle of state.obstacles) assert.ok(gap(body, obstacle) >= body.radius + obstacle.radius - 1e-7);
    }
  }
  assert.deepEqual([...completedSkills].sort(), HIDDEN_BRAWL_PROFILE.skills.map(skill => skill.id).sort());
  assert.deepEqual([...completedEvents].sort(), HIDDEN_BRAWL_PROFILE.events.map(event => event.id).sort());
  assert.ok(healed && shielded && fired, 'the skill names correspond to changes in the battle state');
  for (const row of state.signature.events) assert.equal(row.uses, 1, 'each story incident resolves at most once');
  assert.equal(state.signature.skills.find(skill => skill.id.endsWith('shelf-restock')).uses, 1, 'the once-only snack refill does not reset at low health');
});
