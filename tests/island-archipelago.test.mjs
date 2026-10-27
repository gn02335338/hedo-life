import test from 'node:test';
import assert from 'node:assert/strict';
import { REGIONS, DOCKS, FERRY_SPEED, getRegionForDistrict, getFerryRoute, ferryRouteLength, ferryPoint } from '../dist/island/archipelago.js';
import { LAYOUT, LINKS, DISTRICT_ENTRANCES, PLACE_ENTRANCES, isTerrainWalkable } from '../dist/island/navigation.js';
import { findNpcRoute } from '../dist/island/npc-routing.js';
import { createNpcLife } from '../dist/island/npc-life.js';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('the original twelve districts and Oneira form four sea regions with only local walking bridges',()=>{
  assert.deepEqual(Object.keys(REGIONS),['company','life','exile','oneira']);
  assert.deepEqual(Object.values(REGIONS).flatMap(region=>region.districts).sort(),LAYOUT.map(d=>d.id).sort());
  assert.equal(REGIONS.company.districts.length,7);assert.equal(REGIONS.life.districts.length,4);assert.deepEqual(REGIONS.exile.districts,['exile']);assert.deepEqual(REGIONS.oneira.districts,['oneira']);
  assert.equal(getRegionForDistrict('__proto__'),null);
  for(const [a,b]of LINKS)assert.equal(getRegionForDistrict(a),getRegionForDistrict(b),`${a}/${b}: no bridge over the open sea`);
  for(const region of Object.values(REGIONS)){
    const reached=new Set([region.districts[0]]);for(let pass=0;pass<12;pass++)for(const [a,b]of LINKS){if(reached.has(a))reached.add(b);if(reached.has(b))reached.add(a);}
    assert.deepEqual([...reached].sort(),[...region.districts].sort(),`${region.id}: local paths remain connected`);
    const port=DOCKS[region.id];assert.equal(getRegionForDistrict(port.districtId),region.id);assert.ok(isTerrainWalkable(port.landing));
    assert.ok(findNpcRoute(port.landing,DISTRICT_ENTRANCES[port.districtId])?.length);
  }
  for(const a of LAYOUT)for(const b of LAYOUT)if(getRegionForDistrict(a.id)!==getRegionForDistrict(b.id))assert.ok(gap(a,b)>35,'separate regions have open water between their shores');
  assert.equal(findNpcRoute(PLACE_ENTRANCES.pantry,PLACE_ENTRANCES.izakaya),null);
  assert.equal(findNpcRoute(PLACE_ENTRANCES.izakaya,PLACE_ENTRANCES['cold-palace']),null);
  assert.equal(findNpcRoute(PLACE_ENTRANCES.pantry,PLACE_ENTRANCES['oneira-hub']),null);
  assert.equal(findNpcRoute(PLACE_ENTRANCES['oneira-hub'],PLACE_ENTRANCES['cold-palace']),null);
});

test('ferry routes depart and arrive at distinct ports and sail through open water in either direction',()=>{
  for(const from of Object.keys(REGIONS))for(const to of Object.keys(REGIONS)){
    if(from===to){assert.equal(getFerryRoute(from,to),null);continue;}
    const points=getFerryRoute(from,to);assert.deepEqual(points[0],DOCKS[from].position);assert.deepEqual(points.at(-1),DOCKS[to].position);
    assert.deepEqual(points,getFerryRoute(to,from).reverse());
    const length=ferryRouteLength(points);assert.ok(length>50);
    assert.deepEqual({x:ferryPoint(points,0).x,z:ferryPoint(points,0).z},DOCKS[from].position);
    assert.ok(gap(ferryPoint(points,length),DOCKS[to].position)<1e-8);
    const sea=points.slice(1,-1),seaLength=ferryRouteLength(sea);
    for(let d=0;d<=seaLength;d+=.25)assert.equal(isTerrainWalkable(ferryPoint(sea,d)),false,`${from}/${to}: route does not cut through another island`);
  }
  assert.equal(getFerryRoute('company','unknown'),null);
});

test('a passenger pauses on the boat and completes the crossing before taking a newly assigned emergency boat',()=>{
  const life=createNpcLife({hour:10});
  life.setDispositions([{id:'jack',status:'hospital',districtId:'hospital',placeId:'hospital-er'}]);
  let jack,seenFirst=false,seenSecond=false,previous=life.getState().find(row=>row.id==='jack');
  for(let n=0;n<1800;n++){
    jack=life.update(.1).find(row=>row.id==='jack');
    assert.ok(gap(jack.position,previous.position)<=(jack.ferry||previous.ferry?FERRY_SPEED:1.35)*.1+1e-8);
    previous=jack;if(jack.state==='sailing'){seenFirst=true;break;}
  }
  assert.equal(seenFirst,true);assert.deepEqual([jack.ferry.from,jack.ferry.to,jack.ferry.emergency],['company','life',true]);
  const pose=jack.position,trip=jack.ferry;
  for(const flag of ['paused','hidden','reducedMotion'])for(let n=0;n<5;n++){jack=life.update(.1,{[flag]:true}).find(row=>row.id==='jack');assert.deepEqual(jack.position,pose);assert.equal(jack.ferry.progress,trip.progress);}
  life.setDispositions([{id:'jack',status:'exile',districtId:'exile',placeId:'cold-palace'}]);
  jack=life.getState().find(row=>row.id==='jack');assert.deepEqual(jack.position,pose);assert.equal(jack.ferry.to,'life','the current boat remains real after retargeting');
  previous=jack;
  for(let n=0;n<2400;n++){
    jack=life.update(.1).find(row=>row.id==='jack');assert.ok(gap(jack.position,previous.position)<=(jack.ferry||previous.ferry?FERRY_SPEED:1.35)*.1+1e-8);previous=jack;
    if(jack.ferry?.from==='life'&&jack.ferry.to==='exile')seenSecond=true;
    if(!jack.traveling)break;
  }
  assert.equal(seenSecond,true);assert.equal(jack.traveling,false);assert.equal(jack.districtId,'exile');assert.equal(jack.destinationPlaceId,'cold-palace');
});

test('a visitor occupying the landing during final approach stops the ferry without moving it backwards',()=>{
  const createTrip=()=>{const life=createNpcLife({hour:10});life.setDispositions([{id:'jack',status:'hospital',districtId:'hospital',placeId:'hospital-er'}]);return life;};
  // Discover the clear landing through an identical ordinary journey, rather
  // than depending on the internal choice among safe port positions.
  const reference=createTrip();let aboard=false,landing=null;
  for(let n=0;n<1800;n++){
    const jack=reference.update(.1).find(row=>row.id==='jack');
    if(jack.ferry)aboard=true;else if(aboard){landing=jack.position;break;}
  }
  assert.ok(landing,'the reference passenger disembarks');
  const life=createTrip();let approach=null;
  for(let n=0;n<1800;n++){
    const jack=life.update(.1).find(row=>row.id==='jack');
    if(jack.ferry?.progress>.98){approach=jack;break;}
  }
  assert.ok(approach,'the ferry enters its final approach');
  for(let n=0;n<5;n++){
    const jack=life.update(.1,{player:landing,roaming:true}).find(row=>row.id==='jack');
    assert.ok(jack.ferry,'an occupied landing does not disembark the passenger');
    assert.ok(jack.ferry.progress>=approach.ferry.progress,'the ferry never reverses progress');
    assert.ok(gap(jack.position,approach.position)<1e-8,'a boat already approaching waits in place');
    assert.match(jack.activity,/等候靠港/);
  }
  let arrived=false,previous=approach;
  for(let n=0;n<100;n++){
    const jack=life.update(.1).find(row=>row.id==='jack');
    assert.ok(gap(jack.position,previous.position)<=FERRY_SPEED*.1+1e-8,'clearing the landing resumes continuous motion');
    previous=jack;if(!jack.ferry){arrived=true;break;}
  }
  assert.equal(arrived,true);assert.ok(gap(previous.position,landing)<1e-8);
});
