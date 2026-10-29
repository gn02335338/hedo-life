import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES } from '../dist/island/places.js';
import { LAYOUT, PLACE_ENTRANCES, PLAYER_SPAWN, isTerrainWalkable, isWalkable, movePlayer, nearestInteraction } from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS } from '../dist/island/residents.js';
import { createNpcLife } from '../dist/island/npc-life.js';

import { REGIONS } from '../dist/island/archipelago.js';
import { walkRegionTargets } from './island-region-walking.mjs';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const roster=LAYOUT.filter(({id})=>Object.hasOwn(RESIDENT_POSITIONS,id)).flatMap(({id:districtId})=>[0,1,2].map(slot=>({id:`${districtId}-${slot}`,districtId,slot})));
const places=PLACES.map(place=>({kind:'place',id:place.id,districtId:place.districtId,key:`place:${place.id}`,position:PLACE_ENTRANCES[place.id],radius:.9,exitRadius:1.15}));
const dynamic={dynamicCharacters:true};

test('31 department, shared, after-work and friend-island destinations have separate safe physical entrances',()=>{
  assert.equal(PLACES.length,31);
  assert.deepEqual(Object.keys(PLACE_ENTRANCES).sort(),PLACES.map(place=>place.id).sort());
  assert.equal(new Set(Object.values(PLACE_ENTRANCES).map(point=>`${point.x},${point.z}`)).size,31);
  for(const place of PLACES){
    const point=PLACE_ENTRANCES[place.id],district=LAYOUT.find(row=>row.id===place.districtId);
    assert.ok(isTerrainWalkable(point),`${place.id}: entrance lies on clear ground`);
    assert.ok(distance(point,district)<3.8,`${place.id}: belongs to its campus`);
  }
  assert.ok(!isTerrainWalkable({x:60.4,z:8.45}),'the mystery kiosk has a matching solid footprint');
});

test('all31 place prompts and all61 character prompts remain reachable in a full moving campus',()=>{
  for(const hour of [10,12]){
  const life=createNpcLife({residents:roster,hour});
  for(const phase of [0,20,55]){
    if(phase)for(let i=0;i<(phase===20?200:350);i++)life.update(.1);
    const actors=life.getState(),obstacles=life.getObstacles();
    assert.equal(actors.length,61);
    const targets=[...places,...actors.map(actor=>({...actor,position:actor.position,radius:actor.kind==='person'?1.4:1.15,exitRadius:actor.kind==='person'?1.8:1.4}))];
    for(const regionId of Object.keys(REGIONS))try{walkRegionTargets(regionId,targets,{obstacles,dynamic,step:.16});}catch(error){error.message=`hour ${hour}, phase ${phase}: ${error.message}`;throw error;}
  }
  }
});
