import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCKS, getRegionForDistrict } from '../dist/island/archipelago.js';
import { LAYOUT, DISTRICT_ENTRANCES, PLACE_ENTRANCES, PLAYER_RADIUS, isWalkable, movePlayer, nearestInteraction } from '../dist/island/navigation.js';
import { PLACES } from '../dist/island/places.js';
import { findNpcRoute } from '../dist/island/npc-routing.js';

const gap = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const dynamic = { dynamicCharacters: true };

test('a visitor can walk from every local district to its dock and acquire the boarding prompt', () => {
  for (const district of LAYOUT) {
    const regionId = getRegionForDistrict(district.id), port = DOCKS[regionId];
    const dock = { kind: 'dock', key: `dock:${regionId}`, position: port.landing, radius: 1.6, exitRadius: 2 };
    const targets = PLACES.filter(place => getRegionForDistrict(place.districtId) === regionId).map(place => ({
      kind: 'place', key: `place:${place.id}`, position: PLACE_ENTRANCES[place.id], radius: .9, exitRadius: 1.15,
    }));
    targets.push(dock);
    let position = { ...DISTRICT_ENTRANCES[district.id] };
    let selected = nearestInteraction(position, targets)?.key ?? null;
    const route = findNpcRoute(position, port.landing);
    assert.ok(route?.length, `${district.id}: route to the island's own shore`);
    for (const destination of route) {
      const from = { ...position }, steps = Math.max(1, Math.ceil(gap(from, destination) / .02));
      for (let index = 1; index <= steps; index++) {
        const goal = { x: from.x + (destination.x - from.x) * index / steps,
          z: from.z + (destination.z - from.z) * index / steps };
        position = movePlayer(position, { x: goal.x - position.x, z: goal.z - position.z }, .1, 10, [], dynamic);
        assert.ok(gap(position, goal) < 1e-7, `${district.id}: real collision movement follows the route`);
        assert.ok(isWalkable(position, PLAYER_RADIUS, [], dynamic), `${district.id}: approach stays on safe ground`);
        selected = nearestInteraction(position, targets, selected)?.key ?? null;
      }
    }
    assert.ok(gap(position, port.landing) < 1e-7, `${district.id}: reaches boarding landing`);
    assert.equal(selected, dock.key, `${district.id}: boarding wins over surrounding place prompts`);
  }
});
