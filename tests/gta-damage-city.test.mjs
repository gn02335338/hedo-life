import test from 'node:test';
import assert from 'node:assert/strict';
import { createVehicle, stepVehicle } from '../dist/gta/driving.js';
import { createFleet, stepFleet, findNearbyCar, takeCar } from '../dist/gta/fleet.js';
import { createVehicleDamageState, stepVehicleDamage } from '../dist/gta/vehicle-damage.js';
import { createCombatState, selectWeapon, stepCombat } from '../dist/gta/combat.js';
import { createAwareness, stepAwareness } from '../dist/gta/awareness.js';
import { createCrowd, stepCrowd } from '../dist/gta/crowd.js';
import { createPoliceState, reportCrime, stepPolice } from '../dist/gta/police.js';

test('actual swept vehicle contact supplies normal impact speed and the car that was struck', () => {
  const obstacle={x:0,z:0,w:2,d:4,vehicleId:'parked-target'};
  const before=createVehicle({x:-2.7,z:0,heading:Math.PI/2,speed:20});
  const hit=stepVehicle(before,{},1/60,[obstacle]);
  assert.ok(hit.impact&&hit.impactSpeed>18);
  assert.equal(hit.impactVehicleId,'parked-target');
  const vehicles=[{id:'driver',...hit},{id:'parked-target',x:0,z:0,speed:0}];
  const damaged=stepVehicleDamage(createVehicleDamageState(),{vehicles,collisions:[{vehicleId:'driver',otherId:hit.impactVehicleId,speed:hit.impactSpeed}],obstacles:[]},1/60);
  assert.ok(damaged.vehicles.every(car=>car.vehicleHealth<100));
  assert.ok(damaged.vehicles[0].vehicleHealth<damaged.vehicles[1].vehicleHealth);
  assert.equal(vehicles[0].vehicleHealth,undefined);
});

test('braking and travelling along a wall are not crashes, and resting contact does not replay impact', () => {
  const braked=stepVehicle(createVehicle({speed:25}),{brake:true},.1,[]);
  assert.equal(braked.impactSpeed,0);assert.equal(braked.impactVehicleId,null);
  const wall=[{x:0,z:0,w:2,d:100,vehicleId:'wall'}];
  const beside=stepVehicle(createVehicle({x:-2.5,z:0,heading:0,speed:25}),{},.1,wall);
  assert.equal(beside.impactSpeed,0);assert.equal(beside.impact,false);
  const hit=stepVehicle(createVehicle({x:-3,z:0,heading:Math.PI/2,speed:25}),{},.1,wall);
  const stopped=stepVehicle({...hit,speed:0},{},1/60,wall);
  assert.equal(stopped.impactSpeed,0);assert.equal(stopped.impactVehicleId,null);
  const glanced=stepVehicle(createVehicle({x:-2.51,z:0,heading:.1,speed:25}),{},.1,wall);
  assert.ok(glanced.impact&&glanced.impactSpeed<3,'a shallow scrape has only its normal component');
});

test('real gunfire destroys a car after its fuse, emits one explosion, and the city reacts', () => {
  const player={x:7,z:32,heading:0,speed:0};
  let vehicles=[{id:'target',x:4,z:20,heading:0,speed:0,kind:'parked',vehicleHealth:10}];
  let combat=selectWeapon(createCombatState(),'pistol');combat.cooldown=0;
  let police=createPoliceState(),damage=createVehicleDamageState();
  combat=stepCombat(combat,{player,walking:true,fire:true,aimYaw:Math.atan2(-3,12),traffic:vehicles,police,obstacles:[]},1/60);
  assert.equal(combat.weapons.pistol.mag,11);
  assert.ok(combat.events.some(event=>event.type==='vehicleHit'&&event.targetId==='target'));
  let result=stepVehicleDamage(damage,{vehicles,hits:combat.events,player,obstacles:[]},1/60);
  damage=result.state;vehicles=result.vehicles;
  assert.equal(vehicles[0].damageStage,'burning');
  const exploded=[];
  for(let i=0;i<190;i++){
    result=stepVehicleDamage(damage,{vehicles,player,obstacles:[]},1/60);
    damage=result.state;vehicles=result.vehicles;
    exploded.push(...damage.events.filter(event=>event.type==='vehicleExploded'));
  }
  assert.equal(exploded.length,1);assert.equal(vehicles[0].damageStage,'wreck');
  const event={type:'explosion',position:exploded[0].position};
  const awareness=stepAwareness(createAwareness(),[event],1/60);
  assert.equal(awareness.threats[0].kind,'explosion');
  const crowd=stepCrowd(createCrowd(),1/60,{threats:awareness.threats});
  assert.equal(crowd[0].mode,'startled');
  assert.ok(crowd.some(person=>person.mode==='walk'),'distant blocks remain calm');
  const traffic=stepFleet(createFleet(),1/60,{threats:awareness.threats});
  assert.ok(traffic.find(car=>car.id==='traffic-coral').threatTimer>0);
  police=reportCrime(police,event);
  assert.equal(police.level,2);assert.equal(police.phase,'dispatch');
  assert.deepEqual(police.lastKnown,event.position);
  assert.equal(result.playerDamage,0,'the player outside the blast radius remains safe');
});

test('burning and wrecked cars are solid obstacles but cannot be driven or taken', () => {
  for(const damageStage of ['burning','wreck']){
    const cars=createFleet().map(car=>({...car,damageStage,vehicleHealth:0}));
    assert.equal(findNearbyCar(cars,{x:4,z:20}),null);
    assert.equal(takeCar(cars,'starter-sedan')[0].stolen,false);
    const traffic=cars.find(car=>car.kind==='traffic');
    const after=stepFleet(cars,.1).find(car=>car.id===traffic.id);
    assert.equal(after.x,traffic.x);assert.equal(after.z,traffic.z);assert.equal(after.speed,0);
    const blocked=stepVehicle(createVehicle({x:4,z:26,heading:0,speed:32}),{},.1,[{x:4,z:20,w:2.05,d:4.15,vehicleId:'wreck'}]);
    assert.ok(blocked.impact);assert.equal(blocked.impactVehicleId,'wreck');
  }
});

test('a burning patrol stops and an exploded patrol cannot shoot or keep pursuing', () => {
  const player={x:0,z:0,speed:0};
  let police=reportCrime(createPoliceState(),{type:'explosion',position:player});
  for(let i=0;i<150;i++)police=stepPolice(police,{player,obstacles:[]},1/60);
  assert.ok(police.units.length);
  police.units[0]={...police.units[0],damageStage:'burning',vehicleHealth:0};
  const before={...police.units[0]};
  let next=stepPolice(police,{player,obstacles:[]},.1);
  const burning=next.units.find(unit=>unit.id===before.id);
  assert.equal(burning.x,before.x);assert.equal(burning.z,before.z);assert.equal(burning.speed,0);
  next=stepPolice(next,{player,obstacles:[],disabledUnitIds:[before.id]},1/60);
  assert.equal(next.units.find(unit=>unit.id===before.id).disabled,true);
  const combat=stepCombat(createCombatState(),{player,walking:true,police:next,obstacles:[]},.1);
  assert.ok(!combat.events.some(event=>event.type==='shot'&&event.unitId===before.id));
});
