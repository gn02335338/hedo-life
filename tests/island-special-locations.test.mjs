import { DOCKS, getRegionForDistrict } from '../dist/island/archipelago.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICTS } from '../dist/island/content.js';
import { PLACES } from '../dist/island/places.js';
import {
  LAYOUT, PLACE_ENTRANCES, PLAYER_SPAWN, PLAYER_RADIUS, CAST_POSITIONS, CAST_RADIUS,
  findPlaceLanding, isWalkable, isDistrictWalkable, movePlayer,
} from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS, RESIDENT_RADIUS } from '../dist/island/residents.js';
import { findNpcRoute } from '../dist/island/npc-routing.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const dynamic = { dynamicCharacters: true };
const specialPlaces = ['exile-gate', 'cold-palace', 'hospital-er', 'police-desk'];
const fullCampusBodies = [
  ...Object.values(CAST_POSITIONS).map(point => ({ ...point, radius: CAST_RADIUS })),
  ...Object.values(RESIDENT_POSITIONS).flat().map(point => ({ ...point, radius: RESIDENT_RADIUS })),
];

test('special districts have their own four facilities while original community slots stay in their nine districts', () => {
  assert.deepEqual(DISTRICTS.filter(d => d.category === 'special').map(d => d.id), ['exile', 'hospital', 'police']);
  assert.deepEqual(PLACES.filter(p => p.category === 'special').map(p => p.id), specialPlaces);
  assert.equal(LAYOUT.length, 12);
  assert.equal(PLACES.length, 27);
  assert.equal(Object.keys(RESIDENT_POSITIONS).length, 9);
  assert.equal(Object.values(RESIDENT_POSITIONS).flat().length, 27);
  for (const id of ['exile', 'hospital', 'police']) assert.equal(Object.hasOwn(RESIDENT_POSITIONS,id), false);
  for (const placeId of specialPlaces) {
    const place=PLACES.find(p => p.id===placeId), landing=findPlaceLanding(placeId,fullCampusBodies,dynamic);
    assert.ok(landing, placeId);
    assert.ok(isDistrictWalkable(landing,place.districtId),`${placeId}: landing belongs to its facility island`);
    assert.ok(isWalkable(landing,PLAYER_RADIUS,fullCampusBodies,dynamic),`${placeId}: clear landing`);
    assert.ok(distance(landing,PLACE_ENTRANCES[placeId])<=1.7, `${placeId}: transport stays outside its entrance`);
  }
  for(const [id,x,z] of [['exile',-.65,-.8],['hospital',-.3,-.5],['police',-.25,-.5]]) {
    const campus=LAYOUT.find(d=>d.id===id);
    assert.equal(isWalkable({x:campus.x+x,z:campus.z+z},PLAYER_RADIUS,[],dynamic),false,`${id}: main building has solid walls`);
  }
});

test('all four new facilities require a sea crossing before walking from the arrival port with every old body present', () => {
  for(const placeId of specialPlaces) {
    const goal=findPlaceLanding(placeId,fullCampusBodies,dynamic);
    assert.equal(findNpcRoute(PLAYER_SPAWN,goal,{obstacles:fullCampusBodies}),null,`${placeId}: no walking shortcut across the sea`);
    const districtId=PLACES.find(place=>place.id===placeId).districtId;
    const landing=DOCKS[getRegionForDistrict(districtId)].landing;
    const path=findNpcRoute(landing,goal,{obstacles:fullCampusBodies});
    assert.ok(path?.length, `${placeId}: local route after disembarking`);
    let position={...landing};
    for(const waypoint of path) {
      let steps=0;
      while(distance(position,waypoint)>1e-7 && steps++<200) {
        const next=movePlayer(position,{x:waypoint.x-position.x,z:waypoint.z-position.z},.1,10,fullCampusBodies,dynamic);
        assert.ok(distance(next,position)>1e-8,`${placeId}: actual walk must advance along its route`);
        assert.ok(isWalkable(next,PLAYER_RADIUS,fullCampusBodies,dynamic),`${placeId}: no actor or shore clipping`);
        position=next;
      }
      assert.ok(distance(position,waypoint)<1e-7,`${placeId}: visitor reaches every waypoint`);
    }
    assert.ok(distance(position,goal)<1e-7,`${placeId}: visitor arrives at the facility`);
  }
});

test('emergency transport selects a free exterior spot or fails instead of entering a wall or overlapping a person', () => {
  for(const placeId of specialPlaces) {
    const entrance=PLACE_ENTRANCES[placeId], blocker={...entrance,radius:.35};
    const landing=findPlaceLanding(placeId,[blocker],dynamic);
    assert.ok(landing,placeId);
    assert.ok(distance(landing,entrance)>=PLAYER_RADIUS+blocker.radius,`${placeId}: leaves room for an existing person`);
    assert.ok(isWalkable(landing,PLAYER_RADIUS,[blocker],dynamic));
    assert.equal(findPlaceLanding(placeId,[{...entrance,radius:10}],dynamic),null,`${placeId}: no unsafe fallback into occupied space`);
  }
  assert.equal(findPlaceLanding('not-a-place'),null);
  assert.equal(findPlaceLanding('hospital-er',null),null);
});
