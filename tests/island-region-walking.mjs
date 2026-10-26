import assert from 'node:assert/strict';
import { DOCKS, getRegionForDistrict } from '../dist/island/archipelago.js';
import { LAYOUT, PLAYER_RADIUS, isWalkable, movePlayer, nearestInteraction } from '../dist/island/navigation.js';
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Start after disembarking, then prove each local target with real collision
// sweeps and the same proximity hysteresis used by the visitor.
export function walkRegionTargets(regionId, targets, {obstacles=[],dynamic={},threshold=.85,replay=true,step=.16}={}) {
  const walkEdge=(from,to)=>{let position={...from};const count=Math.ceil(distance(from,to)/.02);for(let n=1;n<=count;n++){const goal={x:from.x+(to.x-from.x)*n/count,z:from.z+(to.z-from.z)*n/count};position=movePlayer(position,{x:goal.x-position.x,z:goal.z-position.z},.1,10,obstacles,dynamic);if(distance(position,goal)>1e-7)break;}return position;};
  const local=targets.filter(target=>getRegionForDistrict(target.districtId)===regionId&&!target.ferry);
  const dock=DOCKS[regionId].landing;
  const candidates=[dock];
  for(const radius of [.4,.8,1.2,1.6])for(let n=0;n<16;n++)candidates.push({x:dock.x+Math.sin(n*Math.PI/8)*radius,z:dock.z+Math.cos(n*Math.PI/8)*radius});
  const start=candidates.find(point=>isWalkable(point,PLAYER_RADIUS,obstacles,dynamic));
  assert.ok(start,`${regionId}: safe disembarkation`);
  const layouts=LAYOUT.filter(row=>getRegionForDistrict(row.id)===regionId);
  const bounds={minX:Math.min(...layouts.map(row=>row.x))-5,maxX:Math.max(...layouts.map(row=>row.x))+5,minZ:Math.min(...layouts.map(row=>row.z))-5,maxZ:Math.max(...layouts.map(row=>row.z))+5};
  const key=(x,z)=>`${x},${z}`,point=(x,z)=>({x:start.x+x*step,z:start.z+z*step});
  const first={x:0,z:0,current:nearestInteraction(start,local)?.key??null},stateKey=cell=>`${key(cell.x,cell.z)}:${cell.current}`;
  const queue=[first],parents=new Map([[stateKey(first),null]]),usable=new Map(),reached=new Map();
  const byKey=new Map(local.map(target=>[target.key,target]));
  for(let head=0;head<queue.length;head++){
    const cell=queue[head],p=point(cell.x,cell.z),selected=byKey.get(cell.current);
    if(selected&&distance(p,selected.position)<(selected.approachDistance??threshold)&&!reached.has(selected.key))reached.set(selected.key,cell);
    if(reached.size===local.length)break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=cell.x+dx,z=cell.z+dz,k=key(x,z),next=point(x,z);
      if(next.x<bounds.minX||next.x>bounds.maxX||next.z<bounds.minZ||next.z>bounds.maxZ)continue;
      if(!usable.has(k))usable.set(k,isWalkable(next,PLAYER_RADIUS,obstacles,dynamic));
      if(!usable.get(k)||distance(walkEdge(p,next),next)>1e-7)continue;
      const nextCell={x,z,current:nearestInteraction(next,local,cell.current)?.key??null},nextState=stateKey(nextCell);
      if(parents.has(nextState))continue;parents.set(nextState,cell);queue.push(nextCell);
    }
  }
  assert.deepEqual(local.filter(target=>!reached.has(target.key)).map(target=>target.key),[],`${regionId}: every local prompt can be approached from its port`);
  if(replay)for(const target of local){
    const route=[];for(let cell=reached.get(target.key);cell;cell=parents.get(stateKey(cell)))route.push(point(cell.x,cell.z));route.reverse();
    let position={...start},current=nearestInteraction(position,local)?.key??null;
    for(const destination of route.slice(1)){
      position=walkEdge(position,destination);
      assert.ok(distance(position,destination)<1e-7,`${target.key}: actual movement reaches ${JSON.stringify(destination)} from ${JSON.stringify(position)}`);
      position={...destination};current=nearestInteraction(position,local,current)?.key??null;
    }
    assert.equal(current,target.key,`${target.key}: arriving selects this prompt`);
  }
  return {reached,visited:queue.length};
}
