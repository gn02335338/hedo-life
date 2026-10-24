import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAYOUT, LINKS, BRIDGES, WALK_HEIGHT, PLAYER_SPAWN, PLAYER_RADIUS,
  DISTRICT_ENTRANCES, NPC_POSITIONS, isWalkable, movePlayer, nearestInteraction,
} from '../dist/island/navigation.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} != ${expected}`);

test('walking world has nine districts, safe entrances and connected physical bridges', () => {
  assert.equal(LAYOUT.length, 9);
  assert.equal(LINKS.length, 13);
  assert.equal(WALK_HEIGHT, 1.07);
  assert.equal(PLAYER_RADIUS, .22);
  assert.ok(isWalkable(PLAYER_SPAWN));
  for (const district of LAYOUT) {
    assert.ok(isWalkable(DISTRICT_ENTRANCES[district.id]), `${district.id}: entrance`);
    assert.ok(!isWalkable(NPC_POSITIONS[district.id]), `${district.id}: colleague has a solid footprint`);
  }
  for (const bridge of BRIDGES) {
    for (let i = 0; i <= 40; i++) {
      const along = (i / 40 - .5) * (bridge.length + .8);
      const point = { x: bridge.x + Math.sin(bridge.rotation) * along, z: bridge.z + Math.cos(bridge.rotation) * along };
      assert.ok(isWalkable(point), `${bridge.fromId}–${bridge.toId}: bridge or shore seam ${i}`);
    }
    const outsideRail = { x: bridge.x + Math.cos(bridge.rotation) * .5, z: bridge.z - Math.sin(bridge.rotation) * .5 };
    assert.ok(!isWalkable(outsideRail), `${bridge.fromId}–${bridge.toId}: cannot walk through rail into water`);
  }
});

test('water, grass edges and main building footprints block walking while the court stays open', () => {
  for (const point of [{ x: 30, z: 30 }, { x: -2, z: 3.7 }, { x: 4.2, z: 0 },
    { x: -.45, z: -.65 }, { x: -9.05, z: -8.3 }, { x: .3, z: -9.65 },
    { x: -10.3, z: .5 }, { x: 9, z: -7.9 }, { x: -9.05, z: 8.8 },
    { x: 9.7, z: .5 }, { x: 9.85, z: 9.7 }, { x: 12.45, z: 10.55 }]) {
    assert.equal(isWalkable(point), false, `solid/water point ${JSON.stringify(point)}`);
  }
  assert.ok(isWalkable({ x: .7, z: 9.7 }), 'players can enter the open basketball court');
  assert.ok(isWalkable({ x: -2, z: 3.5 }), 'the interior of the southern grass edge stays open');
  for (const point of [null, {}, { x: NaN, z: 0 }, { x: 0, z: Infinity }]) assert.equal(isWalkable(point), false);
  assert.equal(isWalkable(PLAYER_SPAWN, -1), false);
});

test('movement is frame-rate consistent, normalizes diagonals and preserves analog input', () => {
  const start = { x: .7, z: 9.7 };
  const straight = movePlayer(start, { x: 1, z: 0 }, .1);
  const diagonal = movePlayer(start, { x: 1, z: 1 }, .1);
  const analog = movePlayer(start, { x: .5, z: 0 }, .1);
  close(distance(start, straight), .45, 'straight distance');
  close(distance(start, diagonal), .45, 'diagonal distance');
  close(distance(start, analog), .225, 'analog distance');
  let smallFrames = start;
  for (let i = 0; i < 6; i++) smallFrames = movePlayer(smallFrames, { x: 1, z: 0 }, 1 / 60);
  close(distance(straight, smallFrames), 0, 'six short frames match one 100 ms frame');
  assert.deepEqual(start, { x: .7, z: 9.7 }, 'input position is not mutated');
  close(distance(start, movePlayer(start, { x: 1, z: 0 }, 50)), .45, 'stalled frame is capped');
  for (const dt of [0, -1, Infinity, NaN]) assert.deepEqual(movePlayer(start, { x: 1, z: 0 }, dt), start);
});

test('fast movement cannot tunnel through buildings, colleagues or the shore and slides along walls', () => {
  const wall = movePlayer({ x: 0, z: 2.5 }, { x: 0, z: -1 }, .1, 100);
  assert.ok(wall.z >= .77 - 1e-8 && wall.z < .84, `stopped at lobby wall: ${wall.z}`);
  assert.ok(isWalkable(wall));
  const npc = NPC_POSITIONS.lobby;
  const colleague = movePlayer({ x: npc.x, z: npc.z + 1 }, { x: 0, z: -1 }, .1, 100);
  assert.ok(colleague.z >= npc.z + .43 - 1e-8, 'cannot cross the colleague body');
  const shore = movePlayer({ x: -2, z: 3.1 }, { x: 0, z: 1 }, .1, 100);
  assert.ok(shore.z <= 4.36 * Math.cos(Math.PI / 6) - PLAYER_RADIUS + 1e-8);
  assert.ok(isWalkable(shore));
  const sliding = movePlayer({ x: 0, z: 1 }, { x: 1, z: -1 }, .1);
  assert.ok(sliding.x > .3 && sliding.z >= .77 - 1e-8 && sliding.z < 1, 'blocked diagonal continues along wall');
});

test('every entrance and colleague can be reached from spawn through walkable routes', () => {
  // Flood a small world-space grid, then replay the resulting paths using the
  // actual movement function. This catches disconnected bridges and obstacles
  // that accidentally seal the only route, not merely connected district IDs.
  const step = .18, key = (x, z) => `${x},${z}`;
  const point = (x, z) => ({ x: PLAYER_SPAWN.x + x * step, z: PLAYER_SPAWN.z + z * step });
  const start = { x: 0, z: 0 }, queue = [start], parents = new Map([[key(0, 0), null]]), usable = new Map();
  const nearest = new Map(), npcApproaches = new Set();
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head], position = point(cell.x, cell.z);
    for (const district of LAYOUT) {
      if (!nearest.has(district.id) && distance(position, DISTRICT_ENTRANCES[district.id]) < .15) nearest.set(district.id, cell);
      const gap = distance(position, NPC_POSITIONS[district.id]);
      if (gap > .43 && gap < .8) npcApproaches.add(district.id);
    }
    if (nearest.size === 9 && npcApproaches.size === 9) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cell.x + dx, nz = cell.z + dz, nextKey = key(nx, nz);
      if (parents.has(nextKey) || Math.abs(nx) > 90 || Math.abs(nz) > 100) continue;
      if (!usable.has(nextKey)) usable.set(nextKey, isWalkable(point(nx, nz)));
      if (!usable.get(nextKey)) continue;
      parents.set(nextKey, cell); queue.push({ x: nx, z: nz });
    }
  }
  assert.equal(nearest.size, 9, `reachable entrances: ${[...nearest.keys()].join(', ')}`);
  assert.equal(npcApproaches.size, 9, `reachable colleagues: ${[...npcApproaches].join(', ')}`);
  for (const [id, end] of nearest) {
    const route = [];
    for (let cell = end; cell; cell = parents.get(key(cell.x, cell.z))) route.push(point(cell.x, cell.z));
    route.reverse();
    let position = { ...PLAYER_SPAWN };
    for (const target of route.slice(1)) {
      position = movePlayer(position, { x: target.x - position.x, z: target.z - position.z }, .1, 10);
      assert.ok(distance(position, target) < 1e-7, `${id}: route blocked at ${JSON.stringify(target)}`);
    }
    assert.ok(distance(position, DISTRICT_ENTRANCES[id]) < .15, `${id}: arrived at entrance`);
  }
});

test('interaction uses nearest target, stable unique keys and separate entry/exit thresholds', () => {
  const a = { key: 'building:lobby', id: 'shared-id', position: { x: 0, z: 0 } };
  const b = { key: 'person:wing', id: 'shared-id', position: { x: 2, z: 0 } };
  assert.equal(nearestInteraction({ x: 1.1, z: 0 }, [a, b]), b);
  assert.equal(nearestInteraction({ x: 1.1, z: 0 }, [a, b], a.key), a, 'retain current to avoid prompt flicker');
  assert.equal(nearestInteraction({ x: -1.51, z: 0 }, [a]), null, 'outside entry radius');
  assert.equal(nearestInteraction({ x: -1.8, z: 0 }, [a], a.key), a, 'inside exit radius');
  assert.equal(nearestInteraction({ x: -1.91, z: 0 }, [a], a.key), null, 'outside exit radius');
  assert.equal(nearestInteraction({ x: 1.91, z: 0 }, [a, b], a.key), b, 'switch after current exits');
  assert.equal(nearestInteraction({ x: 0, z: 0 }, [b], a.key), null, 'removed targets cannot remain current');
  const npc = { key: 'person:jack', position: { x: 0, z: 0 }, radius: 1.35, exitRadius: 1.65 };
  assert.equal(nearestInteraction({ x: 1.36, z: 0 }, [npc]), null);
  assert.equal(nearestInteraction({ x: 1.64, z: 0 }, [npc], npc.key), npc);
  assert.equal(nearestInteraction({ x: 1.66, z: 0 }, [npc], npc.key), null);
  assert.equal(nearestInteraction({ x: 0, z: 0 }, [null, {}, { position: { x: NaN, z: 0 } }]), null);
});

test('deliberately approaching a closer conversation releases a nearby building prompt without flicker',()=>{
  const building={key:'building:meeting',position:{x:0,z:0},radius:1.25};
  const resident={key:'resident:visitor',position:{x:.39,z:0},radius:1.15};
  assert.equal(nearestInteraction({x:1.1,z:0},[building,resident],building.key),resident,'a person beside an entrance remains selectable');
  const first={key:'person:first',position:{x:0,z:0},radius:1.4};
  const second={key:'person:second',position:{x:1.5,z:0},radius:1.4};
  assert.equal(nearestInteraction({x:.8,z:0},[first,second],first.key),first,'small distance changes retain the current conversation');
  assert.equal(nearestInteraction({x:1,z:0},[first,second],first.key),second,'walking closer changes the conversation');
  assert.equal(nearestInteraction({x:.8,z:0},[first,second],second.key),second,'crossing back slightly does not flicker');
});
