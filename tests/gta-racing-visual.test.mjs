import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/island/vendor/three.module.js';
import { createVehicleVisualFactory, resolveVehicleVariant, animateVehicleVisual } from '../dist/gta/visual-vehicles.js';
import { createPersonVisualFactory, animatePersonVisual, setPersonArmFlex } from '../dist/gta/visual-people.js';
import { createRacingVisuals } from '../dist/gta/visual-racing.js';
import { createFleet } from '../dist/gta/fleet.js';
import { applyGarageCustomizations } from '../dist/gta/garage.js';
import { LOCATIONS, MISSIONS } from '../dist/gta/world.js';

function fixture() {
  const scene=new THREE.Scene(),materials=new Map(),geometries=new Set(),cache=new Map();
  const mat=(color,options={})=>{const key=String(color)+JSON.stringify(options);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,...options}));return materials.get(key);};
  const geo=(key,make)=>{if(!cache.has(key)){const geometry=make();cache.set(key,geometry);geometries.add(geometry);}return cache.get(key);};
  const boxGeometry=geo('box',()=>new THREE.BoxGeometry(1,1,1)),sphereGeometry=geo('sphere',()=>new THREE.IcosahedronGeometry(1,1)),planeGeometry=geo('plane',()=>new THREE.PlaneGeometry(1,1));
  const part=(parent,geometry,material,position,scale,rotation)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);mesh.scale.set(...scale);if(rotation)mesh.rotation.set(...rotation);parent.add(mesh);return mesh;};
  const M={lit:mat('#ffe0aa'),red:mat('#ff6655')};
  return{THREE,scene,materials,geometries,cache,mat,geo,part,boxGeometry,sphereGeometry,planeGeometry,M,contact(){},
    dispose(){scene.traverse(object=>{if(object.isInstancedMesh)object.dispose();});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
function finiteGeometry(geometry) {
  for(const attribute of Object.values(geometry.attributes))assert.ok(attribute.array.every(Number.isFinite));
  for(const attributes of Object.values(geometry.morphAttributes))for(const attribute of attributes)assert.ok(attribute.array.every(Number.isFinite));
}

test('three named cars retain stable street IDs and paid paint while using their specified stock colors',()=>{
  const fleet=createFleet();assert.equal(fleet.length,11);assert.equal(new Set(fleet.map(car=>car.id)).size,11);
  const signatures=[['finance-wagon','董事長','maserati-gt',0x245aab],['coffee-coupe','翅膀','bmw-executive',0xb9c3cf],['city-hatch','歐文','tesla-model-y',0x171c24]];
  const customizations={};
  for(const[id,owner,variant,color]of signatures){const car=fleet.find(car=>car.id===id);assert.ok(car.name.includes(owner));assert.equal(car.variant,variant);assert.equal(car.color,color);customizations[id]={colorId:'coral',upgrades:{engine:1,brakes:0,handling:0}};}
  // Replay actual pre-race save transactions, not untrusted derived fields.
  const ledger=signatures.flatMap(([vehicleId])=>[{id:vehicleId+'-paint',vehicleId,kind:'paint',value:'coral',missionCount:6},{id:vehicleId+'-engine',vehicleId,kind:'upgrade',value:'engine',missionCount:6}]);
  const updated=applyGarageCustomizations(fleet,{version:3,completed:MISSIONS.map(mission=>mission.id),ledger,customizations});
  for(const[id,,variant]of signatures){const car=updated.find(car=>car.id===id);assert.equal(car.color,0xdf806b);assert.equal(car.variant,variant);assert.equal(car.upgrades.engine,1);}
  assert.deepEqual(LOCATIONS.filter(place=>place.id==='racing').map(place=>[place.x,place.z]),[[-30,60]]);
});

test('all six bodies have finite bounded geometry, distinct brand silhouettes and reusable repair shells',()=>{
  const ctx=fixture(),create=createVehicleVisualFactory(ctx),heights={};
  for(const variant of['hatch','sedan','suv','maserati-gt','bmw-executive','tesla-model-y']){
    assert.equal(resolveVehicleVariant('arbitrary-racer-id','racer',variant),variant);
    const model=create(0x245aab,'parked',variant,{variant}),body=model.group.children[0],original=body.geometry;
    model.group.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model.group);
    assert.ok(bounds.min.x>=-1.23&&bounds.max.x<=1.23,variant+' must fit the existing traffic width');
    assert.ok(bounds.min.z>=-2.15&&bounds.max.z<=2.15,variant+' must keep bumper details close to the 4.15m gameplay length');
    assert.ok(bounds.min.y>=-.03&&bounds.max.y<2.1);heights[variant]=bounds.max.y;
    model.group.traverse(object=>{if(object.geometry)finiteGeometry(object.geometry);});
    if(variant==='tesla-model-y')for(const name of['rear-quarter:-1','rear-quarter:1','door-window']){
      const vertices=ctx.cache.get('vehicle-v10:tesla-model-y:'+name).attributes.position.array;
      for(let i=0;i<vertices.length;i+=18){
        assert.deepEqual(Array.from(vertices.slice(i,i+3)),Array.from(vertices.slice(i+9,i+12)));
        assert.deepEqual(Array.from(vertices.slice(i+3,i+6)),Array.from(vertices.slice(i+15,i+18)));
        assert.deepEqual(Array.from(vertices.slice(i+6,i+9)),Array.from(vertices.slice(i+12,i+15)));
      }
    }
    model.setDamage('wreck');assert.notEqual(body.geometry,original);model.setDamage('intact');assert.equal(body.geometry,original);
    model.dispose();ctx.scene.remove(model.group);
  }
  assert.ok(heights['maserati-gt']<heights['bmw-executive']&&heights['bmw-executive']<heights['tesla-model-y']);
  const warm=ctx.cache.size;
  for(let i=0;i<12;i++)for(const variant of['hatch','sedan','suv','maserati-gt','bmw-executive','tesla-model-y']){const model=create(0x245aab,'racer','reused-'+i,{variant});model.setDamage('wreck');model.dispose();ctx.scene.remove(model.group);}
  assert.equal(ctx.cache.size,warm,'transient rival IDs must not create fresh cached geometry');ctx.dispose();
});

test('brand wheels roll forward and reverse around the correct axle, front steering and pause stay deterministic',()=>{
  const ctx=fixture(),create=createVehicleVisualFactory(ctx);
  for(const variant of['maserati-gt','bmw-executive','tesla-model-y']) {
    const model=create(0x245aab,'racer',variant,{variant}),wheels=model.wheels;
    animateVehicleVisual(model,{speed:5,heading:0,steerAngle:.5},.05);
    assert.ok(wheels.roll<0,'forward -Z travel rolls negatively around the X axle');assert.ok(wheels.steer>0);
    const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
    for(let i=0;i<4;i++) {
      wheels.mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
      assert.ok(Math.abs(position.x-(i%2?-1:1)*-wheels.x)<1e-6);
      assert.ok(Math.abs(position.z-(i<2?wheels.front:wheels.rear))<1e-6);
      const forward=new THREE.Vector3(0,0,-1).applyQuaternion(rotation);
      assert.ok(i<2?forward.x>0:Math.abs(forward.x)<1e-7,'only the front axle turns toward positive steering');
    }
    const paused=Array.from(wheels.mesh.instanceMatrix.array),roll=wheels.roll,steer=wheels.steer;
    animateVehicleVisual(model,{speed:5,heading:0,steerAngle:-1},0);
    assert.deepEqual(Array.from(wheels.mesh.instanceMatrix.array),paused);assert.equal(wheels.roll,roll);assert.equal(wheels.steer,steer);
    animateVehicleVisual(model,{speed:-5,heading:0,steerAngle:0},.1);assert.ok(wheels.roll>0,'reverse changes the rolling direction');
    model.dispose();ctx.scene.remove(model.group);
  }
  ctx.dispose();
});

test('articulated humans keep seven draws and finite reusable elbow poses without cumulative movement',()=>{
  const ctx=fixture(),create=createPersonVisualFactory(ctx),model=create('#e6d79f');let draws=0;
  model.group.traverse(object=>{if(object.isMesh){draws++;finiteGeometry(object.geometry);}});assert.equal(draws,7);
  animatePersonVisual(model,1.4,.7);assert.ok(model.armMeshes.every(mesh=>mesh.morphTargetInfluences[0]>0));
  const pose=()=>JSON.stringify({chest:model.chest.position.toArray(),arms:model.arms.map(arm=>arm.rotation.toArray()),knees:model.knees.map(knee=>knee.rotation.toArray()),elbows:model.armMeshes.map(mesh=>mesh.morphTargetInfluences)});
  const snapshot=pose();for(let i=0;i<100;i++)animatePersonVisual(model,1.4,.7);assert.equal(pose(),snapshot);
  setPersonArmFlex(model,0);assert.ok(model.armMeshes.every(mesh=>mesh.morphTargetInfluences[0]===0));
  animatePersonVisual(model,NaN,Infinity);assert.ok(model.legs.every(leg=>Number.isFinite(leg.rotation.x)));
  const warm=ctx.cache.size;for(let i=0;i<8;i++){const person=create('#e6d79f');ctx.scene.remove(person.group);}assert.equal(ctx.cache.size,warm);ctx.dispose();
});

test('checkpoint and route pools remain bounded, unchanged frames do not rewrite matrices, and disposal releases instances',()=>{
  const ctx=fixture();const sign=()=>{const mesh=new THREE.Mesh(ctx.planeGeometry,ctx.M.lit);ctx.scene.add(mesh);return mesh;};
  const race=createRacingVisuals({...ctx,sign,location:LOCATIONS.find(place=>place.id==='racing')});
  const route=[{x:-30,z:60},{x:0,z:60},{x:0,z:0},{x:60,z:0},{x:60,z:60},{x:-30,z:60}];
  const state={active:true,checkpoint:{x:0,z:60,radius:7},route,countdown:3};race.update(state,{time:1});
  const arrows=ctx.scene.getObjectByName('race-route-arrows'),gate=ctx.scene.getObjectByName('race-checkpoint-gate');
  assert.equal(race.getStats().gateInstances,7);assert.ok(arrows.count>0&&arrows.count<=64);const version=arrows.instanceMatrix.version,gateVersion=gate.instanceMatrix.version;
  const frozen=gate.material.opacity;for(let i=0;i<20;i++)race.update(state,{time:1});assert.equal(arrows.instanceMatrix.version,version);assert.equal(gate.instanceMatrix.version,gateVersion);assert.equal(gate.material.opacity,frozen);
  race.update(state,{time:10,low:true,reducedMotion:true});assert.ok(arrows.count<=32);const quiet=gate.material.opacity;race.update(state,{time:99,low:true,reducedMotion:true});assert.equal(gate.material.opacity,quiet);
  race.update({active:true,checkpoint:{x:Infinity,z:NaN},route:[{},null]});assert.equal(gate.visible,false);assert.ok(arrows.instanceMatrix.array.every(Number.isFinite));
  race.update(null);assert.equal(race.getStats().active,false);assert.equal(race.getStats().arrows,0);
  let released=0;for(const name of['race-start-line','race-checkpoint-gate','race-route-arrows'])ctx.scene.getObjectByName(name).addEventListener('dispose',()=>released++);
  race.dispose();race.dispose();assert.equal(released,3);assert.equal(ctx.scene.getObjectByName('race-route-arrows'),undefined);ctx.dispose();
});
