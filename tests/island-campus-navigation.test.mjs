import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACES } from '../dist/island/places.js';
import { LAYOUT, PLACE_ENTRANCES, PLAYER_SPAWN, isTerrainWalkable, isWalkable, movePlayer, nearestInteraction } from '../dist/island/navigation.js';
import { RESIDENT_POSITIONS } from '../dist/island/residents.js';
import { createNpcLife } from '../dist/island/npc-life.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const roster=LAYOUT.filter(({id})=>Object.hasOwn(RESIDENT_POSITIONS,id)).flatMap(({id:districtId})=>[0,1,2].map(slot=>({id:`${districtId}-${slot}`,districtId,slot})));
const places=PLACES.map(place=>({kind:'place',id:place.id,districtId:place.districtId,key:`place:${place.id}`,position:PLACE_ENTRANCES[place.id],radius:.9,exitRadius:1.15}));
const dynamic={dynamicCharacters:true};

test('27 departments and shared/after-work destinations have separate safe physical entrances',()=>{
  assert.equal(PLACES.length,27);
  assert.deepEqual(Object.keys(PLACE_ENTRANCES).sort(),PLACES.map(place=>place.id).sort());
  assert.equal(new Set(Object.values(PLACE_ENTRANCES).map(point=>`${point.x},${point.z}`)).size,27);
  for(const place of PLACES){
    const point=PLACE_ENTRANCES[place.id],district=LAYOUT.find(row=>row.id===place.districtId);
    assert.ok(isTerrainWalkable(point),`${place.id}: entrance lies on clear ground`);
    assert.ok(distance(point,district)<3.8,`${place.id}: belongs to its campus`);
  }
  assert.ok(!isTerrainWalkable({x:13.4,z:12.45}),'the mystery kiosk has a matching solid footprint');
});

test('all27 place prompts and all61 character prompts remain reachable in a full moving campus',()=>{
  for(const hour of [10,12]){
  const life=createNpcLife({residents:roster,hour});
  for(const phase of [0,20,55]){
    if(phase)for(let i=0;i<(phase===20?200:350);i++)life.update(.1);
    const actors=life.getState(),obstacles=life.getObstacles();
    assert.equal(actors.length,61);
    const targets=[...places,...actors.map(actor=>({...actor,position:actor.position,radius:actor.kind==='person'?1.4:1.15,exitRadius:actor.kind==='person'?1.8:1.4}))];
    let start={...PLAYER_SPAWN};
    if(!isWalkable(start,.22,obstacles,dynamic))start={x:-.6,z:3.1};
    assert.ok(isWalkable(start,.22,obstacles,dynamic));
    const step=.16,key=(x,z)=>`${x},${z}`,point=(x,z)=>({x:start.x+x*step,z:start.z+z*step});
    const first={x:0,z:0,current:nearestInteraction(start,targets)?.key??null};
    const queue=[first],parents=new Map([[key(0,0),null]]),usable=new Map(),reached=new Map();
    for(let head=0;head<queue.length;head++){
      const cell=queue[head],p=point(cell.x,cell.z),selected=targets.find(target=>target.key===cell.current);
      if(selected&&distance(p,selected.position)<.85&&!reached.has(selected.key))reached.set(selected.key,cell);
      if(reached.size===targets.length)break;
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const x=cell.x+dx,z=cell.z+dz,k=key(x,z);if(parents.has(k)||Math.abs(x)>105||Math.abs(z)>170)continue;
        const next=point(x,z);if(!usable.has(k))usable.set(k,isWalkable(next,.22,obstacles,dynamic));if(!usable.get(k))continue;
        // Valid endpoints can still cut the corner of a round body. Flood only
        // edges the real visitor can walk, then replay that exact valid path.
        const walked=movePlayer(p,{x:dx*step,z:dz*step},.1,10,obstacles,dynamic);
        if(distance(walked,next)>1e-7)continue;
        const current=nearestInteraction(next,targets,cell.current)?.key??null;
        parents.set(k,cell);queue.push({x,z,current});
      }
    }
    assert.deepEqual(targets.filter(target=>!reached.has(target.key)).map(target=>target.key),[],`hour ${hour}, phase ${phase}: all conversations and entrances can own the prompt`);
    for(const target of places){
      const route=[];for(let cell=reached.get(target.key);cell;cell=parents.get(key(cell.x,cell.z)))route.push(point(cell.x,cell.z));route.reverse();
      let position={...start},current=nearestInteraction(position,targets)?.key??null;
      for(const destination of route.slice(1)){
        position=movePlayer(position,{x:destination.x-position.x,z:destination.z-position.z},.1,10,obstacles,dynamic);
        assert.ok(distance(position,destination)<1e-7,`${target.id}: actual player movement reaches the entrance`);
        current=nearestInteraction(position,targets,current)?.key??null;
      }
      assert.equal(current,target.key);
    }
  }
  }
});
