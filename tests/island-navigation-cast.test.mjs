import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_CAST } from '../dist/island/cast.js';
import {
  LAYOUT, BRIDGES, CAST_POSITIONS, CAST_RADIUS, PLAYER_RADIUS, PLAYER_SPAWN,
  NPC_POSITIONS, DISTRICT_ENTRANCES, isWalkable, movePlayer, nearestInteraction,
} from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS, RESIDENT_RADIUS } from '../dist/island/residents.js';

import { REGIONS } from '../dist/island/archipelago.js';
import { walkRegionTargets } from './island-region-walking.mjs';

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const castTargets = ISLAND_CAST.map(({id,districtId}) => ({kind:'person',id,districtId,
  key:`person:${id}`,position:CAST_POSITIONS[id],radius:1.4}));
const residentTargets = LAYOUT.flatMap(({id}) => (RESIDENT_POSITIONS[id]||[]).map((position,slot) => ({
  kind:'resident',districtId:id,key:`resident:${id}:${slot}`,position,radius:1.15,exitRadius:1.4,
})));
const occupied = residentTargets.map(({position}) => ({...position,radius:RESIDENT_RADIUS}));
const targets = [...LAYOUT.map(({id}) => ({kind:'building',districtId:id,key:`building:${id}`,
  position:DISTRICT_ENTRANCES[id],radius:1.25})),...castTargets,...residentTargets];

test('every public colleague has a distinct campus home without displacing community slots',()=>{
  assert.equal(ISLAND_CAST.length,34);
  assert.deepEqual(Object.keys(CAST_POSITIONS).sort(),ISLAND_CAST.map(person=>person.id).sort());
  for(const {id,districtId} of ISLAND_CAST){
    const point=CAST_POSITIONS[id],district=LAYOUT.find(item=>item.id===districtId);
    assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.z)&&Number.isFinite(point.y),id);
    assert.ok(distance(point,district)<4,`${id}: stands on their own island`);
    assert.equal(isWalkable(point),false,`${id}: has a solid body`);
    for(const other of castTargets)if(other.id!==id)assert.ok(distance(point,other.position)>CAST_RADIUS*2,`${id}/${other.id}: separate figures`);
    for(const other of residentTargets)assert.ok(distance(point,other.position)>CAST_RADIUS+RESIDENT_RADIUS+.3,`${id}/${other.key}: preserve community space`);
  }
  for(const [districtId,id] of Object.entries({lobby:'wing',lab:'jack',meeting:'zoe',hr:'hope',finance:'janet',cafe:'jonathan',plaza:'meimei',court:'sonny',harbor:'cindy'})){
    assert.equal(distance(CAST_POSITIONS[id],NPC_POSITIONS[districtId]),0,`${id}: district guide matches the campus roster`);
  }
  for(const {position,key} of residentTargets)assert.ok(isWalkable(position),`${key}: unused slot remains clear`);
  for(const bridge of BRIDGES)for(let i=0;i<=40;i++){
    const along=(i/40-.5)*(bridge.length+.8);
    const point={x:bridge.x+Math.sin(bridge.rotation)*along,z:bridge.z+Math.cos(bridge.rotation)*along};
    assert.ok(isWalkable(point,PLAYER_RADIUS,occupied),`${bridge.fromId}/${bridge.toId}: deck and shore approach remain clear`);
  }
});

test('all34 colleague conversations and all27 community conversations are reachable after landing on each island',()=>{
  for(const regionId of Object.keys(REGIONS))walkRegionTargets(regionId,targets,{obstacles:occupied});
});
