import test from 'node:test';
import assert from 'node:assert/strict';
import { OUTFITS, RESIDENT_POSITIONS, RESIDENT_RADIUS, normalizeResidents, residentObstacles } from '../dist/island/residents.js';
import { LAYOUT, BRIDGES, PLAYER_RADIUS, PLAYER_SPAWN, NPC_POSITIONS, DISTRICT_ENTRANCES, isWalkable, movePlayer, nearestInteraction } from '../dist/island/navigation.js';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const resident = (n=1,overrides={}) => ({id:id(n),nickname:`島民${n}`,districtId:'lobby',outfit:'teal',greeting:'一起散步吧。',introduction:'喜歡在小島散步，與大家分享平凡的日常。',slot:0,...overrides});
const roster = () => LAYOUT.flatMap((district,index)=>[0,1,2].map(slot=>resident(index*3+slot+1,{districtId:district.id,slot,outfit:OUTFITS[(index+slot)%OUTFITS.length].id})));
const payload = residents => ({version:1,residents});
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);

test('approved roster normalization only retains the exact public response fields',()=>{
  const list=normalizeResidents(payload(roster()));
  assert.equal(list.length,27);
  assert.equal(OUTFITS.length,6);
  assert.equal(new Set(OUTFITS.map(item=>item.id)).size,6);
  for(const outfit of OUTFITS)assert.match(outfit.color,/^#[0-9a-f]{6}$/i);
  const source=resident(1,{nickname:'  ＡＢ島民  ',id:id(1).toUpperCase()});
  const normalized=normalizeResidents(payload([source]));
  assert.equal(normalized[0].nickname,'AB島民');
  assert.equal(normalized[0].id,id(1));
  assert.equal(source.nickname,'  ＡＢ島民  ');
  assert.equal(normalizeResidents(payload([resident(1,{nickname:'島民',greeting:'慢慢\u00ad散步。'})])).length,1,'do not reject API-allowed format characters');
  assert.deepEqual(normalizeResidents(payload([])),[]);
});

test('malformed, private, duplicate and oversized public rosters fail closed as one batch',()=>{
  for(const value of [null,[],{version:2,residents:[]},{version:1},{version:1,residents:[],ownerId:'private'},payload('not an array')])assert.deepEqual(normalizeResidents(value),[]);
  const badRows=[null,[],{...resident(),status:'pending'},{...resident(),reason:'private application reason'},resident(1,{id:'wing'}),resident(1,{id:'00000000-0000-1000-8000-000000000001'}),resident(1,{districtId:'unknown'}),resident(1,{outfit:'unknown'}),resident(1,{slot:3}),resident(1,{slot:-1}),resident(1,{slot:1.5}),resident(1,{nickname:'甲'}),resident(1,{nickname:'甲'.repeat(17)}),resident(1,{greeting:'好'}),resident(1,{greeting:'好'.repeat(81)}),resident(1,{introduction:'太短'}),resident(1,{introduction:'好'.repeat(241)}),resident(1,{nickname:'<甲>'}),resident(1,{nickname:'島民\n'}),resident(1,{nickname:'島\u200b民'}),resident(1,{greeting:'https://example.com'}),resident(1,{greeting:'someone@example.com'}),resident(1,{greeting:'手機:0912345678'}),resident(1,{nickname:'島民@'}),resident(1,{greeting:'小禾＠example.test'}),resident(1,{greeting:'example.social'}),resident(1,{greeting:'0912.345.678'})];
  for(const row of badRows)assert.deepEqual(normalizeResidents(payload([resident(99,{districtId:'lab'}),row])),[],JSON.stringify(row));
  assert.deepEqual(normalizeResidents(payload([resident(),resident(1,{districtId:'lab',slot:1})])),[],'duplicate public identity');
  assert.deepEqual(normalizeResidents(payload([resident(),resident(2)])),[],'duplicate district slot');
  assert.deepEqual(normalizeResidents(payload([...roster(),resident(99,{slot:2})])),[],'more than27');
  assert.equal(normalizeResidents(payload([resident(1,{nickname:'😀'.repeat(16)})])).length,1,'length uses code points');
});

test('resident obstacles are optional, local to the caller and prevent body tunneling',()=>{
  const residents=normalizeResidents(payload([resident()]));
  const extra=residentObstacles(residents),center=RESIDENT_POSITIONS.lobby[0];
  assert.equal(extra[0].radius,RESIDENT_RADIUS);
  assert.ok(isWalkable(center),'empty public roster leaves the ground open');
  assert.equal(isWalkable(center,PLAYER_RADIUS,extra),false);
  const from={x:center.x,z:center.z+.8};
  const stopped=movePlayer(from,{x:0,z:-1},.1,10,extra);
  assert.ok(distance(stopped,center)>=PLAYER_RADIUS+RESIDENT_RADIUS-1e-8);
  assert.ok(isWalkable(stopped,PLAYER_RADIUS,extra));
  assert.ok(isWalkable(center),'one scene cannot mutate another scene collision state');
  assert.equal(isWalkable(center,PLAYER_RADIUS,[{x:NaN,z:0,radius:.2}]),false);
});

test('all27 resident slots, built-in colleagues and every bridge remain approachable at capacity',()=>{
  const residents=normalizeResidents(payload(roster())),extra=residentObstacles(residents);
  assert.ok(isWalkable(PLAYER_SPAWN,PLAYER_RADIUS,extra));
  const targets=residents.map(row=>({...row,kind:'resident',key:`resident:${row.id}`,position:RESIDENT_POSITIONS[row.districtId][row.slot],radius:1.15,exitRadius:1.4}));
  const builtin=LAYOUT.flatMap(d=>[{key:`building:${d.id}`,position:DISTRICT_ENTRANCES[d.id],radius:1.25},{key:`person:${d.id}`,position:NPC_POSITIONS[d.id],radius:1.4}]);
  for(const target of targets){assert.ok(isWalkable(target.position),`${target.districtId}/${target.slot}: exterior ground`);assert.equal(isWalkable(target.position,PLAYER_RADIUS,extra),false);}
  for(const bridge of BRIDGES)for(let i=0;i<=40;i++){
    const along=(i/40-.5)*(bridge.length+.8),point={x:bridge.x+Math.sin(bridge.rotation)*along,z:bridge.z+Math.cos(bridge.rotation)*along};
    assert.ok(isWalkable(point,PLAYER_RADIUS,extra),`${bridge.fromId}-${bridge.toId}: resident does not block deck or seam`);
  }
  const step=.16,key=(x,z)=>`${x},${z}`,point=(x,z)=>({x:PLAYER_SPAWN.x+x*step,z:PLAYER_SPAWN.z+z*step});
  const queue=[{x:0,z:0}],parents=new Map([[key(0,0),null]]),usable=new Map(),approaches=new Map(),colleagues=new Set(),entrances=new Set();
  for(let head=0;head<queue.length;head++){
    const cell=queue[head],position=point(cell.x,cell.z);
    const selected=nearestInteraction(position,[...builtin,...targets]);
    if(selected?.kind==='resident'&&distance(position,selected.position)<.85)approaches.set(selected.key,cell);
    for(const district of LAYOUT){
      if(distance(position,NPC_POSITIONS[district.id])<.8)colleagues.add(district.id);
      if(distance(position,DISTRICT_ENTRANCES[district.id])<.2)entrances.add(district.id);
    }
    if(approaches.size===27&&colleagues.size===9&&entrances.size===9)break;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=cell.x+dx,z=cell.z+dz,k=key(x,z);
      if(parents.has(k)||Math.abs(x)>100||Math.abs(z)>110)continue;
      if(!usable.has(k))usable.set(k,isWalkable(point(x,z),PLAYER_RADIUS,extra));
      if(!usable.get(k))continue;parents.set(k,cell);queue.push({x,z});
    }
  }
  assert.equal(approaches.size,27,`reachable residents: ${[...approaches.keys()].join(',')}`);
  assert.equal(colleagues.size,9,'all original colleagues stay reachable');
  assert.equal(entrances.size,9,'all entrances stay reachable');
  for(const target of targets){
    const route=[];for(let cell=approaches.get(target.key);cell;cell=parents.get(key(cell.x,cell.z)))route.push(point(cell.x,cell.z));route.reverse();
    let position={...PLAYER_SPAWN};
    for(const destination of route.slice(1)){
      position=movePlayer(position,{x:destination.x-position.x,z:destination.z-position.z},.1,10,extra);
      assert.ok(distance(position,destination)<1e-7,`${target.districtId}/${target.slot}: movement reaches approach`);
    }
    assert.equal(nearestInteraction(position,[...builtin,...targets])?.key,target.key,'resident can own the proximity prompt');
  }
});
