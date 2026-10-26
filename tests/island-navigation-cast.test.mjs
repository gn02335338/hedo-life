import test from 'node:test';
import assert from 'node:assert/strict';
import { ISLAND_CAST } from '../dist/island/cast.js';
import {
  LAYOUT, BRIDGES, CAST_POSITIONS, CAST_RADIUS, PLAYER_RADIUS, PLAYER_SPAWN,
  NPC_POSITIONS, DISTRICT_ENTRANCES, isWalkable, movePlayer, nearestInteraction,
} from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS, RESIDENT_RADIUS } from '../dist/island/residents.js';

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
const castTargets = ISLAND_CAST.map(({id,districtId}) => ({kind:'person',id,districtId,
  key:`person:${id}`,position:CAST_POSITIONS[id],radius:1.4}));
const residentTargets = LAYOUT.flatMap(({id}) => RESIDENT_POSITIONS[id].map((position,slot) => ({
  kind:'resident',key:`resident:${id}:${slot}`,position,radius:1.15,exitRadius:1.4,
})));
const occupied = residentTargets.map(({position}) => ({...position,radius:RESIDENT_RADIUS}));
const targets = [...LAYOUT.map(({id}) => ({kind:'building',key:`building:${id}`,
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

test('all34 colleague conversations and all27 community conversations are reachable by actual walking at full capacity',()=>{
  // Each flood node carries its real proximity selection from the parent path.
  // This proves conversations can be selected after walking past other people,
  // rather than only checking geometry or resetting interaction hysteresis.
  const step=.16,key=(x,z)=>`${x},${z}`;
  const point=(x,z)=>({x:PLAYER_SPAWN.x+x*step,z:PLAYER_SPAWN.z+z*step});
  const start={x:0,z:0,current:nearestInteraction(PLAYER_SPAWN,targets)?.key??null};
  const queue=[start],parents=new Map([[key(0,0),null]]),usable=new Map(),approaches=new Map(),entrances=new Set();
  for(let head=0;head<queue.length;head++){
    const cell=queue[head],position=point(cell.x,cell.z),selected=targets.find(target=>target.key===cell.current);
    if(selected&&selected.kind!=='building'&&distance(position,selected.position)<.9&&!approaches.has(selected.key))approaches.set(selected.key,cell);
    for(const district of LAYOUT)if(distance(position,DISTRICT_ENTRANCES[district.id])<.2)entrances.add(district.id);
    if(approaches.size===castTargets.length+residentTargets.length&&entrances.size===9)break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=cell.x+dx,z=cell.z+dz,k=key(x,z);
      if(parents.has(k)||Math.abs(x)>100||Math.abs(z)>110)continue;
      const destination=point(x,z);
      if(!usable.has(k))usable.set(k,isWalkable(destination,PLAYER_RADIUS,occupied));
      if(!usable.get(k))continue;
      const current=nearestInteraction(destination,targets,cell.current)?.key??null;
      parents.set(k,cell);queue.push({x,z,current});
    }
  }
  const missing=[...castTargets,...residentTargets].filter(target=>!approaches.has(target.key)).map(target=>target.key);
  assert.deepEqual(missing,[],'all named conversations own the proximity prompt on a reachable walking path');
  assert.equal(entrances.size,9,'the complete cast does not close any district entrance');
  for(const target of [...castTargets,...residentTargets]){
    const route=[];
    for(let cell=approaches.get(target.key);cell;cell=parents.get(key(cell.x,cell.z)))route.push(point(cell.x,cell.z));
    route.reverse();
    let position={...PLAYER_SPAWN},current=nearestInteraction(position,targets)?.key??null;
    for(const destination of route.slice(1)){
      position=movePlayer(position,{x:destination.x-position.x,z:destination.z-position.z},.1,10,occupied);
      assert.ok(distance(position,destination)<1e-7,`${target.key}: movement cannot traverse a blocked path`);
      current=nearestInteraction(position,targets,current)?.key??null;
    }
    assert.equal(current,target.key,`${target.key}: arriving selects this conversation`);
  }
});
