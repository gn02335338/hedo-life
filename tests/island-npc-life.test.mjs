import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife, NPC_STOP_DISTANCE, NPC_RESUME_DISTANCE } from '../dist/island/npc-life.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { LAYOUT, BRIDGES, CAST_POSITIONS, PLAYER_SPAWN, isDistrictWalkable, isTerrainWalkable, isWalkable, movePlayer } from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS } from '../dist/island/residents.js';
import { npcGroundHeight } from '../dist/island/npc-routing.js';

const fullRoster = (suffix = '') => LAYOUT.filter(district => Object.hasOwn(RESIDENT_POSITIONS, district.id)).flatMap(({ id: districtId }) => [0, 1, 2].map(slot => ({ id: `${districtId}-${slot}${suffix}`, districtId, slot })));
const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const poses = life => life.getState().map(({ key, position, heading }) => ({ key, position, heading }));
const tick = (life, seconds, options) => { let state; for (let i = 0; i < Math.ceil(seconds * 10); i++) state = life.update(.1, options); return state; };
function assertSeparated(states) {
  for (let i = 0; i < states.length; i++) for (let j = i + 1; j < states.length; j++) {
    assert.ok(gap(states[i].position, states[j].position) >= .445 - 1e-7, `${states[i].key} overlaps ${states[j].key}`);
  }
}
function assertBridgesClear(life) {
  const bodies = life.getObstacles();
  for (const bridge of BRIDGES) for (let i = 0; i <= 40; i++) {
    const along = (i / 40 - .5) * (bridge.length + .8);
    const point = { x: bridge.x + Math.sin(bridge.rotation) * along, z: bridge.z + Math.cos(bridge.rotation) * along };
    assert.ok(isWalkable(point, .22, bodies, { dynamicCharacters: true }), `${bridge.fromId}/${bridge.toId}: bridge and shore approach ${i} blocked`);
  }
}

test('all 61 actors move and rest within their own safe ground, with swept collisions and clear bridge approaches', () => {
  const life = createNpcLife({ residents: fullRoster() }), initial = new Map(life.getState().map(row => [row.key, row])), moved = new Set(), rested = new Set();
  assert.equal(initial.size, ISLAND_CAST.length + 27); let prior = life.getState(); const started = performance.now();
  for (let frame = 0; frame < 1200; frame++) {
    const state = life.update(.1); assert.equal(state.length, 61);
    for (let i = 0; i < state.length; i++) {
      const row = state[i]; assert.ok(Number.isFinite(row.heading));
      assert.ok(isDistrictWalkable(row.position, row.districtId, .21), `${row.key}: water or building collision`);
      assert.ok(gap(row.position, prior[i].position) <= .056 + 1e-8, `${row.key}: a frame must not teleport`);
      assert.equal(row.position.y, npcGroundHeight(row.position), 'actors follow the ground and the gently raised court surface');
      if (gap(row.position, initial.get(row.key).position) > .15) moved.add(row.key);
      if (row.state === 'resting') rested.add(row.key);
    }
    assertSeparated(state); if (frame % 60 === 0) assertBridgesClear(life); prior = state;
  }
  assert.equal(moved.size, 61, `actors that did not walk: ${[...initial.keys()].filter(key => !moved.has(key))}`);
  assert.equal(rested.size, 61, 'every route includes unhurried waypoint stops');
  assert.ok(performance.now() - started < 10000, 'bounded full-capacity simulation should complete without frame-by-frame pathfinding');
});

test('approaching actors stop, face the visitor and resume with hysteresis or when walking mode ends', () => {
  const life = createNpcLife(), original = life.getState().find(row => row.id === 'wing').position;
  const playerAt = distance => ({ x: original.x + distance, z: original.z });
  let wing = life.update(.1, { roaming: true, player: playerAt(NPC_STOP_DISTANCE) }).find(row => row.id === 'wing');
  assert.equal(wing.state, 'greeting'); assert.deepEqual(wing.position, original); assert.ok(Math.abs(wing.heading - Math.PI / 2) < 1e-8);
  for (const distance of [2.2, 2.6, NPC_RESUME_DISTANCE]) {
    wing = life.update(.1, { roaming: true, player: playerAt(distance) }).find(row => row.id === 'wing');
    assert.equal(wing.state, 'greeting'); assert.deepEqual(wing.position, original);
  }
  wing = life.update(.1, { roaming: true, player: playerAt(NPC_RESUME_DISTANCE + .01) }).find(row => row.id === 'wing'); assert.notEqual(wing.state, 'greeting');
  tick(life, 15); assert.ok(gap(life.getState().find(row => row.id === 'wing').position, original) > .1);
  const current = life.getState().find(row => row.id === 'wing').position;
  assert.equal(life.update(.1, { roaming: true, player: { x: current.x + 1, z: current.z } }).find(row => row.id === 'wing').state, 'greeting');
  assert.notEqual(life.update(.1, { roaming: false, player: current }).find(row => row.id === 'wing').state, 'greeting');
});

test('directory conversations pin the actor without roaming and release cleanly on close or removal', () => {
  const life = createNpcLife({ residents: fullRoster() }); tick(life, 4);
  const target = life.getState().find(row => row.id === 'alice'), before = { ...target.position };
  life.setConversationTarget({ kind: 'person', id: 'alice' });
  const talked = tick(life, 20, { roaming: false, player: PLAYER_SPAWN }).find(row => row.id === 'alice');
  assert.equal(talked.state, 'talking'); assert.deepEqual(talked.position, before);
  life.setConversationTarget(null); let released = false;
  for (let i = 0; i < 200; i++) if (gap(life.update(.1).find(row => row.id === 'alice').position, before) > .1) released = true;
  assert.equal(released, true);
  life.setConversationTarget({ kind: 'resident', id: 'cafe-0' }); life.update(0);
  assert.equal(life.getState().find(row => row.key === 'resident:cafe-0').state, 'talking');
  life.setResidents(fullRoster().filter(row => row.id !== 'cafe-0')); tick(life, 1);
  assert.ok(!life.getState().some(row => row.key === 'resident:cafe-0')); assert.ok(!life.getObstacles().some(row => row.key === 'resident:cafe-0'));
  life.setConversationTarget({ kind: 'person', id: 'missing' }); assert.ok(!life.update(0).some(row => row.state === 'talking'));
});

test('pause, reduced motion and hidden tabs freeze simulation time and invalid dt cannot move bodies', () => {
  for (const flag of ['paused', 'reducedMotion', 'hidden']) {
    const a = createNpcLife(), b = createNpcLife(); tick(a, 5); tick(b, 5); const before = poses(a);
    for (let i = 0; i < 100; i++) a.update(100, { [flag]: true });
    assert.deepEqual(poses(a), before); assert.ok(a.getState().every(row => row.state === 'resting'));
    assert.deepEqual(a.update(.1), b.update(.1), 'frozen time must not advance patrol timers');
    a.setConversationTarget({ kind: 'person', id: 'wing' }); const pinned = a.update(5, { [flag]: true }).find(row => row.id === 'wing'); assert.equal(pinned.state, 'talking');
  }
  const life = createNpcLife(); tick(life, 5); const before = poses(life);
  for (const dt of [0, -1, Infinity, NaN]) { life.update(dt); assert.deepEqual(poses(life), before); }
  const prior = life.getState(); life.update(100000);
  for (const [index, actor] of life.getState().entries()) assert.ok(gap(actor.position, prior[index].position) <= .056);
});

test('deterministic phases vary between actors and callers cannot mutate simulation snapshots', () => {
  const a = createNpcLife({ residents: fullRoster() }), b = createNpcLife({ residents: fullRoster().reverse() });
  for (let i = 0; i < 200; i++) assert.deepEqual(a.update(.1), b.update(.1));
  const varied = createNpcLife(); tick(varied, 2); assert.ok(new Set(varied.getState().map(row => row.state)).size > 1);
  const pose = a.getState()[0].position; pose.x = Infinity; a.getObstacles()[0].x = Infinity;
  assert.ok(Number.isFinite(a.getState()[0].position.x));
});

test('mid-patrol arrivals find free space, retain surviving poses and never silently drop full-capacity rosters', () => {
  const life = createNpcLife(); let occupied;
  for (let i = 0; i < 900 && !occupied; i++) {
    const state = life.update(.1);
    occupied = fullRoster().find(row => state.some(actor => gap(actor.position, RESIDENT_POSITIONS[row.districtId][row.slot]) < .43));
  }
  assert.ok(occupied, 'fixture needs an actually occupied arrival spot');
  const before = poses(life); life.setResidents([occupied]);
  assert.deepEqual(poses(life).filter(row => row.key.startsWith('person:')), before, 'arrival must never relocate established colleagues');
  const arrival = life.getState().find(row => row.kind === 'resident'); assert.ok(arrival); assertSeparated(life.getState());
  assert.ok(gap(arrival.position, RESIDENT_POSITIONS[occupied.districtId][occupied.slot]) > .01, 'occupied home uses a free alternative');
  life.setResidents(fullRoster()); assert.equal(life.getState().length, 61);
  for (let generation = 0; generation < 12; generation++) {
    tick(life, 3); const before = poses(life); life.setResidents(fullRoster(generation ? `-${generation - 1}` : ''));
    if (!generation) assert.deepEqual(poses(life), before, 'unchanged roster must not reset current positions or route state');
    life.setResidents(fullRoster(`-${generation}`)); assert.equal(life.getState().length, 61); assertSeparated(life.getState()); assertBridgesClear(life);
  }
});

test('dynamic player collision follows current bodies and vacated homes lose their ghost obstacles', () => {
  const life = createNpcLife(); let vacated;
  for (let i = 0; i < 900 && !vacated; i++) {
    life.update(.1);
    vacated = ISLAND_CAST.find(({ id }) => isWalkable(CAST_POSITIONS[id], .22, life.getObstacles(), { dynamicCharacters: true }));
  }
  assert.ok(vacated); assert.equal(isWalkable(CAST_POSITIONS[vacated.id]), false, 'legacy callers keep the old stationary world');
  assert.equal(isTerrainWalkable(CAST_POSITIONS[vacated.id]), true);
  for (const actor of life.getState()) assert.equal(isWalkable(actor.position, .22, life.getObstacles(), { dynamicCharacters: true }), false, 'every visible current body is solid');
  let approach;
  for (const actor of life.getState()) for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const start = { x: actor.position.x + x * .8, z: actor.position.z + z * .8 };
    if (isWalkable(start, .22, life.getObstacles(), { dynamicCharacters: true })
      && [0, .2, .4, .6, .8].every(along => isTerrainWalkable({ x: start.x - x * along, z: start.z - z * along }))) {
      approach = { actor, start, input: { x: -x, z: -z } }; break;
    }
    if (approach) break;
  }
  assert.ok(approach, 'fixture finds a clear straight approach to a current body');
  const moved = movePlayer(approach.start, approach.input, .1, 100, life.getObstacles(), { dynamicCharacters: true });
  assert.ok(gap(moved, approach.actor.position) >= .43 - 1e-8, 'player sweep cannot tunnel through a moving body');
  assert.ok(gap(moved, approach.start) <= .38, 'the player stops before crossing the body, rather than exiting on its far side');
});

test('all moving colleagues and residents remain approachable from the connected island paths', () => {
  const life = createNpcLife({ residents: fullRoster() }); tick(life, 35);
  const actors = life.getState(), obstacles = life.getObstacles(), reached = new Set(), step = .2;
  let start = { ...PLAYER_SPAWN };
  if (!isWalkable(start, .22, obstacles, { dynamicCharacters: true })) start = { x: -.6, z: 3.1 };
  assert.ok(isWalkable(start, .22, obstacles, { dynamicCharacters: true }));
  const queue = [[0, 0]], seen = new Set(['0,0']);
  for (let head = 0; head < queue.length; head++) {
    const [x, z] = queue[head], point = { x: start.x + x * step, z: start.z + z * step };
    for (const actor of actors) if (gap(point, actor.position) < 1.1) reached.add(actor.key);
    if (reached.size === actors.length) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (seen.has(key) || Math.abs(nx) > 90 || Math.abs(nz) > 100) continue;
      seen.add(key);
      if (isWalkable({ x: start.x + nx * step, z: start.z + nz * step }, .22, obstacles, { dynamicCharacters: true })) queue.push([nx, nz]);
    }
  }
  assert.equal(reached.size, 61, `unreachable: ${actors.filter(row => !reached.has(row.key)).map(row => row.key)}`);
});
