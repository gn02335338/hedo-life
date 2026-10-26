import test from 'node:test';
import assert from 'node:assert/strict';
import { createNpcLife, NPC_COMMUTE_SPEED } from '../dist/island/npc-life.js';
import { ISLAND_CAST } from '../dist/island/cast.js';
import { PLACE_ENTRANCES, CAST_RADIUS, PLAYER_RADIUS, isTerrainWalkable } from '../dist/island/navigation.js';
import { DOCKS, FERRY_SPEED } from '../dist/island/archipelago.js';
import { RESIDENT_POSITIONS, normalizeResidents } from '../dist/island/residents.js';
import { findNpcRoute, ROUTE_GAP, npcGroundHeight } from '../dist/island/npc-routing.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const disposition=(id,status,placeId,districtId=status)=>({id,status,placeId,districtId});
const residentRoster=Object.keys(RESIDENT_POSITIONS).flatMap(districtId=>[0,1,2].map(slot=>({id:`${districtId}:${slot}`,districtId,slot})));
function assertClear(rows,player=null){
  const grounded=rows.filter(row=>!row.ferry);
  for(let i=0;i<grounded.length;i++){
    const actor=grounded[i];assert.ok(isTerrainWalkable(actor.position,CAST_RADIUS+ROUTE_GAP),`${actor.key} is on clear ground`);
    for(let j=i+1;j<grounded.length;j++)assert.ok(distance(actor.position,grounded[j].position)>=2*CAST_RADIUS+ROUTE_GAP-1e-8,`${actor.key}/${grounded[j].key} leave room`);
    if(player)assert.ok(distance(actor.position,player)>=CAST_RADIUS+PLAYER_RADIUS+ROUTE_GAP-1e-8,`${actor.key} leaves visitor room`);
  }
}
function settle(life,{player=null,seconds=360}={}){
  let previous=life.getState(),seenFerry=new Set();
  for(let tick=0;tick<seconds*10;tick++){
    const rows=life.update(.1,{player,roaming:Boolean(player)});
    for(let i=0;i<rows.length;i++){
      const actor=rows[i],prior=previous[i],speed=actor.ferry||prior.ferry?FERRY_SPEED:NPC_COMMUTE_SPEED;
      assert.ok(distance(actor.position,prior.position)<=speed*.1+1e-8,`${actor.key} moves continuously`);
      if(actor.ferry)seenFerry.add(actor.id);
      if(actor.state==='sailing')assert.equal(actor.position.y,.58);else assert.equal(actor.position.y,npcGroundHeight(actor.position));
    }
    if(tick%10===0)assertClear(rows,player);
    previous=rows;
    if(!rows.some(row=>row.traveling)){assertClear(rows,player);return seenFerry;}
  }
  assert.fail(`unresolved transfers: ${life.getState().filter(row=>row.traveling).map(row=>`${row.id}:${row.districtId}>${row.destinationDistrictId}:${row.activity}@${row.position.x.toFixed(2)},${row.position.z.toFixed(2)}`).join(',')}`);
}

test('emergency cases retain current bodies then board visible boats before reaching facilities',()=>{
  const life=createNpcLife({residents:residentRoster,hour:10}),before=life.getState();
  const batch=[disposition('jack','hospital','hospital-er'),disposition('wing','police','police-desk'),disposition('henry','exile','cold-palace')];
  const rows=life.setDispositions(batch);assert.equal(rows.length,61);assertClear(rows);
  for(const actor of rows){
    if(actor.disposition){assert.deepEqual(actor.position,before.find(row=>row.key===actor.key).position,'a case never teleports a body across the sea');assert.equal(actor.traveling,true);assert.equal(actor.destinationPlaceId,actor.disposition.placeId);}
    else assert.deepEqual(actor,before.find(row=>row.key===actor.key),`${actor.key} untouched`);
  }
  assert.deepEqual(life.setDispositions(batch),rows,'refresh keeps the active journey');
  assert.deepEqual([...settle(life)].sort(),['henry','jack','wing']);
  for(const actor of life.getState().filter(row=>row.disposition)){
    assert.equal(actor.districtId,actor.disposition.districtId);assert.equal(actor.routine.phase,actor.disposition.status);
    assert.ok(distance(actor.position,PLACE_ENTRANCES[actor.destinationPlaceId])<4);
    assert.ok(Object.values(PLACE_ENTRANCES).every(point=>distance(point,actor.position)>.72));
  }
});

test('facility holds survive clock changes and release sails from the facility before walking to work',()=>{
  const life=createNpcLife({hour:10});life.setDispositions([disposition('jack','hospital','hospital-er')]);settle(life);
  const held=life.getState().find(row=>row.id==='jack');
  for(const hour of [12.25,15.25,18,19.25,10]){life.setHour(hour);const actor=life.getState().find(row=>row.id==='jack');assert.deepEqual(actor.position,held.position);assert.equal(actor.destinationPlaceId,'hospital-er');assert.equal(actor.disposition.status,'hospital');}
  const released=life.setDispositions([]).find(row=>row.id==='jack');
  assert.equal(released.disposition,null);assert.equal(released.destinationPlaceId,'research-center');assert.equal(released.traveling,true);assert.deepEqual(released.position,held.position);
  assert.equal(findNpcRoute(released.position,PLACE_ENTRANCES['research-center']),null,'the sea has no walking route');
  assert.ok(settle(life).has('jack'),'release needs a real return ferry');
  const final=life.getState().find(row=>row.id==='jack');assert.equal(final.districtId,'lab');assert.equal(final.disposition,null);
});

test('all34 official colleagues can queue, sail and settle safely at each full facility',()=>{
  for(const [status,placeId] of [['hospital','hospital-er'],['police','police-desk'],['exile','exile-gate']]){
    const life=createNpcLife({residents:residentRoster});const rows=life.setDispositions(ISLAND_CAST.map(({id})=>disposition(id,status,placeId)));
    assert.equal(rows.filter(row=>row.disposition?.status===status).length,34);assertClear(rows);
    assert.equal(settle(life).size,34,`${status}: every colleague used a boat`);
    assert.ok(life.getState().filter(row=>row.disposition).every(row=>row.districtId===status));
    for(let n=0;n<50;n++)life.update(.1);assertClear(life.getState());
    assert.ok(life.getState().filter(row=>row.disposition).every(row=>row.districtId===status),'holds prevent normal departures');
  }
});

test('emergency arrivals reserve the visitor body and malformed batches leave state intact',()=>{
  const player=DOCKS.life.position,life=createNpcLife({hour:10});life.update(0,{player,roaming:true});life.setDispositions([disposition('jack','hospital','hospital-er')]);
  let aboard=false,arrived=false;
  for(let n=0;n<2400;n++){const rows=life.update(.1,{player,roaming:true}),jack=rows.find(row=>row.id==='jack');assertClear(rows,player);if(jack.ferry)aboard=true;else if(aboard){arrived=true;break;}}
  assert.equal(arrived,true,'a reserved landing allows disembarking without overlapping the visitor');const held=life.getState();
  for(const input of [null,{},[disposition('made-up','hospital','hospital-er')],[disposition('jack','__proto__','hospital-er')],[disposition('jack','hospital','police-desk')],[disposition('jack','hospital','hospital-er'),disposition('jack','hospital','hospital-er')]])assert.deepEqual(life.setDispositions(input),held);
});

test('special districts never become community application slots',()=>{
  assert.equal(Object.keys(RESIDENT_POSITIONS).length,9);const life=createNpcLife();life.setResidents([{id:'invalid-special-slot',districtId:'hospital',slot:0}]);assert.equal(life.getState().length,34);
  const payload={version:1,residents:[{id:'00000000-0000-4000-8000-000000000001',districtId:'hospital',slot:0,nickname:'測試島民',outfit:'teal',greeting:'一起散步',introduction:'喜歡一起在島上散步聊天。'}]};assert.deepEqual(normalizeResidents(payload),[]);
});
