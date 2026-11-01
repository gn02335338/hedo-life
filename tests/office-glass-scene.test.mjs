import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Three from '../dist/island/vendor/three.module.js';
import { OFFICE_FLOORS, isOfficeFloor } from '../dist/office/floors.js';
import { getOfficeRoster, OFFICE_CAST, getCastMoment } from '../dist/office/model.js';
import { sampleOfficeRoutine } from '../dist/office/social.js';
import { defaultOfficeAvatar, validateOfficeAvatar } from '../dist/office/avatar-config.js';
import { buildAvatar, getAvatarLayout, createAvatarGeometry, avatarBoneRotations } from '../dist/office/avatar-view.js';
import { getCharacterRoutine, OFFICE_ELEVATOR, OFFICE_ROUTINE_CYCLE_MS, OFFICE_ROUTINE_PAIRS } from '../dist/office/routine.js';

// Keep the earlier authored itinerary as a strict continuity regression even
// though the production roster now also schedules member/event social visits.
const legacyRoster = now => OFFICE_CAST.map(person => ({...person,...getCastMoment(person.id,now),kind:'character',source:'ambient',online:false}));

// Run the production scene construction and Three.js matrices/raycasting in
// Node. Only browser surfaces and the GPU renderer are stubbed; no browser is
// launched, and material/geometry/InstancedMesh behavior remains real Three.js.
const sceneSource = readFileSync(new URL('../dist/office/scene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export async function createOfficeScene', 'async function createOfficeScene');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const loadScene = new AsyncFunction('THREE', 'OrbitControls', 'OFFICE_FLOORS', 'isOfficeFloor', 'getCharacterRoutine', 'OFFICE_ELEVATOR', 'sampleOfficeRoutine', 'defaultOfficeAvatar', 'validateOfficeAvatar', 'buildAvatar', 'getAvatarLayout', 'createAvatarGeometry', 'avatarBoneRotations', 'window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', `${sceneSource}\nreturn createOfficeScene;`);

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.classList = { toggle() {} }; this.clientWidth = 700; this.clientHeight = 556;
  }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, callback) { if (!this.listeners.has(name)) this.listeners.set(name, new Set()); this.listeners.get(name).add(callback); }
  removeEventListener(name, callback) { this.listeners.get(name)?.delete(callback); }
  emit(name, event = {}) { for (const callback of this.listeners.get(name) || []) callback(event); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  getContext(kind) { assert.equal(kind, '2d'); return { fillRect() {}, fillText() {} }; }
}

async function harness(t, { roster = legacyRoster(0), width = 700, height = 556, initialFrame = 1000, reducedMotion = false } = {}) {
  const frames = new Map(), selected = [], selectedFloors = [];
  let nextFrame = 0, renderer, resize, frameTime = 0;
  class Renderer {
    constructor() { renderer = this; this.domElement = new Element('canvas'); this.shadowMap = {}; }
    setPixelRatio() {}
    setSize(w, h) { this.domElement.clientWidth = w; this.domElement.clientHeight = h; }
    render(scene, camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); this.scene = scene; this.camera = camera; }
    dispose() { this.disposed = true; }
  }
  class Controls {
    constructor(camera) { this.camera = camera; this.target = new Three.Vector3(); }
    update() { this.camera.lookAt(this.target); this.camera.updateMatrixWorld(true); }
    dispose() {}
  }
  class Observer { constructor(callback) { resize = callback; } observe() {} disconnect() {} }
  const createScene = await loadScene({ ...Three, WebGLRenderer: Renderer }, Controls, OFFICE_FLOORS, isOfficeFloor, getCharacterRoutine, OFFICE_ELEVATOR, sampleOfficeRoutine, defaultOfficeAvatar, validateOfficeAvatar, buildAvatar, getAvatarLayout, createAvatarGeometry, avatarBoneRotations,
    { devicePixelRatio: 1, matchMedia: () => ({ matches: reducedMotion }) },
    { hidden: false, createElement: tag => new Element(tag), createTextNode: text => ({ textContent: text }) },
    Observer, callback => { const id = ++nextFrame; frames.set(id, callback); return id; }, id => frames.delete(id), { now: () => frameTime });
  const container = new Element(); container.clientWidth = width; container.clientHeight = height;
  const api = await createScene({ container, roster, onSelect: id => selected.push(id), onFloorSelect: floor => selectedFloors.push(floor) });
  function frame(time = 1000) {
    frameTime = time;
    const [id, callback] = frames.entries().next().value;
    frames.delete(id); callback(time);
  }
  frame(initialFrame);
  t.after(() => api.dispose());
  return { api, container, renderer, selected, selectedFloors, frame, time: () => frameTime, resize: (w, h) => { container.clientWidth = w; container.clientHeight = h; resize(); frame(); } };
}

function meshes(root, role) { const result = []; root.traverse(object => { if (object.isMesh && (!role || object.userData.buildingRole === role)) result.push(object); }); return result; }
function rootGroup(object, scene) { while (object.parent && object.parent !== scene) object = object.parent; return object; }
function floorOrigins(scene) { return new Map(meshes(scene, 'floor-slab').map(slab => [slab.userData.floor, new Three.Vector3().setFromMatrixPosition(slab.parent.matrixWorld).y])); }
function instancePosition(batch, index) {
  const matrix = new Three.Matrix4(); batch.getMatrixAt(index, matrix);
  return new Three.Vector3().setFromMatrixPosition(matrix).applyMatrix4(batch.matrixWorld);
}

test('all seven storeys and the roof remain transparent without occluding lower-floor interiors', async t => {
  const h = await harness(t);
  const scene = h.renderer.scene, building = rootGroup(meshes(scene, 'overview-person')[0], scene);
  const roles = ['floor-slab', 'back-wall', 'left-wall', 'front-wall', 'right-wall'];
  for (const role of roles) {
    const surfaces = meshes(building, role);
    assert.equal(surfaces.length, 7, role);
    assert.deepEqual(surfaces.map(surface => surface.userData.floor).sort(), [1, 2, 3, 4, 5, 6, 7]);
  }
  assert.equal(meshes(building, 'roof').length, 1);
  const envelope = meshes(building).filter(mesh => mesh.userData.buildingRole && !['floor-furniture', 'overview-person'].includes(mesh.userData.buildingRole));
  for (const surface of envelope) {
    assert.equal(surface.material.transparent, true, surface.userData.buildingRole);
    assert.equal(surface.material.depthWrite, false, surface.userData.buildingRole);
    assert.equal(surface.castShadow, false, surface.userData.buildingRole);
    if ([...roles, 'roof', 'roof-garden'].includes(surface.userData.buildingRole)) assert.ok(surface.material.opacity > 0 && surface.material.opacity <= .12, surface.userData.buildingRole);
  }
  const furniture = meshes(building, 'floor-furniture');
  assert.ok(furniture.length > 0);
  const furnishedFloors = new Set();
  for (const batch of furniture) {
    assert.equal(batch.isInstancedMesh, true);
    assert.equal(batch.userData.floors.length, batch.count);
    for (const floor of batch.userData.floors) { assert.ok(isOfficeFloor(floor)); furnishedFloors.add(floor); }
  }
  assert.deepEqual([...furnishedFloors].sort(), [1, 2, 3, 4, 5, 6, 7]);
  // A ceiling-sized opaque copy would defeat the glass envelope even when its
  // facade material is correct. Furniture instances may include tiny objects,
  // but may not contain a broad horizontal opaque lid.
  const instance = new Three.Matrix4(), bounds = new Three.Box3(), size = new Three.Vector3();
  for (const object of meshes(building).filter(object => !object.material.transparent)) {
    object.geometry.computeBoundingBox();
    for (let index = 0; index < (object.isInstancedMesh ? object.count : 1); index++) {
      if (object.isInstancedMesh) { object.getMatrixAt(index, instance); instance.premultiply(object.matrixWorld); }
      else instance.copy(object.matrixWorld);
      bounds.copy(object.geometry.boundingBox).applyMatrix4(instance); bounds.getSize(size);
      assert.ok(!(size.y < .3 && size.x > 5 && size.z > 5), 'Opaque ceiling or rug blocks the floor below');
    }
  }
  assert.ok(meshes(building).length <= 450, 'Overview exceeds the 450 draw-object budget');
  assert.ok(meshes(building).filter(mesh => mesh.isInstancedMesh).length <= 180, 'Overview exceeds the 180 instanced-batch budget');
});

test('instanced avatars keep all approved entries, including offline resting members, without forging online status', async t => {
  const roster = legacyRoster(0), h = await harness(t, { roster });
  function assertMembers(expected) {
    const batches = meshes(h.renderer.scene, 'overview-person');
    assert.deepEqual([...new Set(batches.flatMap(batch => batch.userData.memberIds))].sort(), expected.map(member=>member.id).sort());
    for (const batch of batches) {
      assert.equal(batch.count, batch.userData.memberIds.length);
      for (let index = 0; index < batch.count; index++) {
        const member = expected.find(person=>person.id===batch.userData.memberIds[index]); assert.ok(member);
        const routine = member.routine ? sampleOfficeRoutine(member,member.routine.sampledAt+h.time()) : null;
        assert.equal(batch.userData.floors[index],routine?.floor??member.floor);
        const position=instancePosition(batch,index),base=((routine?.elevation??member.floor)-1)*4.3;
        assert.ok(Number.isFinite(position.x)&&Number.isFinite(position.y)&&Number.isFinite(position.z));
        assert.ok(position.y>=base-.5&&position.y<base+4,member.id);
        if(batch.userData.bones[index]==='body')assert.ok(Math.abs(position.y-(base+.055+batch.userData.localY[index]*.86))<.04,member.id);
      }
    }
  }
  assertMembers(roster);
  const human={id:'remote-human',name:'同事',kind:'human',online:true,floor:2,departmentFloor:2,zone:'meeting',color:'#789987'};
  const agent={id:'remote-agent',name:'助手',kind:'agent',online:true,floor:7,departmentFloor:6,zone:'focus',color:'#7899ab'};
  const offline={id:'offline-agent',name:'離線助手',kind:'agent',online:false,status:'break',floor:1,departmentFloor:6,zone:'lounge',activity:'離線角色在茶水區休息'};
  const snapshot=[...roster,human,agent,offline],before=structuredClone(snapshot);
  h.api.setRoster(snapshot);h.frame();assertMembers(snapshot);assert.deepEqual(snapshot,before);
  const restingHuman={...human,online:false,status:'break',floor:1,zone:'lounge'},movedAgent={...agent,floor:3};
  h.api.setRoster([...roster,movedAgent,restingHuman,offline]);h.frame();assertMembers([...roster,movedAgent,restingHuman,offline]);
  h.api.setRoster(roster);h.frame();assertMembers(roster);
  h.api.setRoster([]);h.frame();assertMembers([]);
});

test('floor labels, overview instance clicks and handheld-sized cameras select the correct detail floor', async t => {
  const roster = legacyRoster(0), h = await harness(t, { roster, width: 360, height: 376 });
  const scene = h.renderer.scene, avatarBatches = meshes(scene, 'overview-person'), building = rootGroup(avatarBatches[0], scene);
  const origins = floorOrigins(scene);
  const room = scene.children.find(child => child.isGroup && child !== building);
  assert.ok(room);
  const overlay = h.container.children.find(child => child.className === 'scene-labels');
  const floorLabels = overlay.children.filter(child => child.className === 'building-floor-label');
  assert.equal(floorLabels.length, 7);
  for (let floor = 1; floor <= 7; floor++) {
    h.api.showBuilding(); h.frame(); assert.equal(building.visible, true); assert.equal(room.visible, false);
    assert.notEqual(floorLabels[floor - 1].style.display, 'none', `Mobile label ${floor} is hidden`);
    floorLabels[floor - 1].emit('click'); h.frame();
    assert.equal(h.selectedFloors.at(-1), floor);
    assert.equal(building.visible, false); assert.equal(room.visible, true);
    assert.equal(room.position.y, origins.get(floor));
  }
  assert.equal(h.api.setFloor('3'), false);
  assert.equal(h.api.setFloor(8), false);
  assert.equal(room.position.y, origins.get(7));
  h.api.showBuilding(); h.frame();
  const head = avatarBatches.find(batch => batch.userData.bones.includes('head')), camera = h.renderer.camera;
  let picked;
  for (let index = 0; index < head.count; index++) {
    const projected = instancePosition(head, index).project(camera);
    if (Math.abs(projected.x) >= .95 || Math.abs(projected.y) >= .95) continue;
    const ray = new Three.Raycaster(); ray.setFromCamera(new Three.Vector2(projected.x, projected.y), camera);
    const hit = ray.intersectObjects(avatarBatches)[0];
    if (hit) { picked = { id: hit.object.userData.memberIds[hit.instanceId], projected }; break; }
  }
  assert.ok(picked, 'At least one real avatar must be ray-selectable from the handheld overview');
  const pointer = { pointerId: 1, clientX: (picked.projected.x + 1) * 180, clientY: (1 - picked.projected.y) * 188 };
  h.renderer.domElement.emit('pointerdown', pointer); h.renderer.domElement.emit('pointerup', pointer); h.frame();
  assert.equal(h.selected.at(-1), picked.id);
  assert.equal(room.position.y, origins.get(roster.find(member => member.id === picked.id).floor));
  assert.equal(building.visible, false); assert.equal(room.visible, true);
  h.api.showBuilding(); h.resize(850, 556);
  assert.equal(building.visible, true); assert.equal(room.visible, false);
});

function avatarEntry(scene,id){
 const batches=meshes(scene,'overview-person');
 for(const bone of ['body','root','head'])for(const batch of batches){const index=batch.userData.memberIds.findIndex((member,i)=>member===id&&batch.userData.bones[i]===bone);if(index>=0)return{batch,index};}
 assert.fail(`Missing avatar ${id}`);
}
function avatarPosition(scene,id){const{batch,index}=avatarEntry(scene,id);return instancePosition(batch,index);}
function avatarOffset(scene,id){const{batch,index}=avatarEntry(scene,id);return .055+batch.userData.localY[index]*.86;}
function detailedPerson(scene,id){let object=meshes(scene).find(part=>part.userData.personId===id);while(object&&!object.userData.personRoot)object=object.parent;assert.ok(object);return object;}

test('a paired appointment walks through the elevator, changes actual height, meets face to face and returns continuously', async t => {
  const h = await harness(t, { roster: legacyRoster(0), initialFrame: 0 });
  const scene = h.renderer.scene, home = avatarPosition(scene, 'jack').clone();
  // Check both journey phase boundaries and the cabin's boarding/exit edges.
  for (const boundary of [85_000, 103_000, 104_800, 113_200, 115_000, 133_000, 178_000, 196_000, 197_800, 206_200, 208_000, 226_000]) {
    h.frame(boundary - .001); const before = avatarPosition(scene, 'jack').clone();
    h.frame(boundary + .001); const after = avatarPosition(scene, 'jack');
    assert.ok(before.distanceTo(after) < .06, `Position jumped at ${boundary}`);
  }
  // Use a separate clock for an exact mid-journey check after the boundary pass.
  const mid = await harness(t, { roster: legacyRoster(109_000), initialFrame: 0 });
  const routine = getCharacterRoutine('jack', 109_000), riding = avatarPosition(mid.renderer.scene, 'jack');
  assert.equal(routine.inElevator, true);
  assert.ok(Math.abs(riding.y - ((routine.elevation - 1) * 4.3 + avatarOffset(mid.renderer.scene, 'jack'))) < 1e-5);
  assert.ok(Math.abs(riding.z - OFFICE_ELEVATOR.z) < 1e-5);
  assert.ok(meshes(mid.renderer.scene, 'elevator-car').some(batch => batch.userData.memberIds.includes('jack')));

  const meeting = await harness(t, { roster: legacyRoster(145_000), initialFrame: 0 });
  const a = avatarPosition(meeting.renderer.scene, 'jack'), b = avatarPosition(meeting.renderer.scene, 'cindy');
  assert.equal(getCharacterRoutine('jack', 145_000).phase, 'meeting');
  assert.ok(a.distanceTo(b) >= .85 && a.distanceTo(b) <= 1.5, 'Partners must be visibly beside each other');
  assert.ok(Math.abs(a.y - b.y) < 1e-5);
  assert.ok(avatarPosition(scene, 'jack').distanceTo(home) < .06, 'The journey must finish at the original work position');
});

test('the detailed floor shares the overview path and hides a colleague only after the elevator leaves that floor', async t => {
  const h = await harness(t, { roster: legacyRoster(85_000), initialFrame: 0 });
  const scene = h.renderer.scene;
  h.api.setFloor(6); h.frame(0);
  const figure = detailedPerson(scene,'jack');
  const original = figure.getWorldPosition(new Three.Vector3()).clone();
  h.frame(18_000);
  const atDoor = figure.getWorldPosition(new Three.Vector3());
  assert.equal(figure.visible, true);
  assert.ok(Math.hypot(atDoor.x - OFFICE_ELEVATOR.doorX, atDoor.z - OFFICE_ELEVATOR.doorZ) < .01);
  h.frame(30_000); assert.equal(figure.visible, false);
  h.api.setFloor(7); h.frame(30_000); assert.equal(figure.visible, true);
  const landed = figure.getWorldPosition(new Three.Vector3()), overview = avatarPosition(scene, 'jack');
  // The overview anchor is the torso center, which sways a few millimeters
  // around the same foot path when the articulated model is walking.
  assert.ok(Math.hypot(landed.x - overview.x, landed.z - overview.z) < .005);
  h.frame(141_000); assert.equal(figure.visible, false);
  h.api.setFloor(6); h.frame(141_000);
  assert.equal(figure.visible, true);
  assert.ok(figure.getWorldPosition(new Three.Vector3()).distanceTo(original) < .06);
});

test('every public colleague has a continuous route across every staggered walking and elevator boundary', async t => {
  const roster = legacyRoster(0), h = await harness(t, { roster, initialFrame: 0 });
  const phaseEdges = [85_000, 103_000, 104_800, 113_200, 115_000, 133_000, 178_000, 196_000, 197_800, 206_200, 208_000, 226_000];
  const boundaries = new Set();
  for (let pair = 0; pair < OFFICE_ROUTINE_PAIRS.length; pair++) for (const edge of phaseEdges) {
    const time = ((edge - pair * 13_000) % OFFICE_ROUTINE_CYCLE_MS + OFFICE_ROUTINE_CYCLE_MS) % OFFICE_ROUTINE_CYCLE_MS;
    boundaries.add(time || OFFICE_ROUTINE_CYCLE_MS);
  }
  for (const boundary of [...boundaries].sort((a, b) => a - b)) {
    h.frame(boundary - .001);
    const positions = roster.map(person => avatarPosition(h.renderer.scene, person.id).clone());
    h.frame(boundary + .001);
    for (const [index, person] of roster.entries()) assert.ok(avatarPosition(h.renderer.scene, person.id).distanceTo(positions[index]) < .06, `${person.id} jumped at ${boundary}`);
  }
});

test('the routine clock freezes on pause, accepts seamless one-second snapshots and honors reduced motion', async t => {
  const sample = 103_000, h = await harness(t, { roster: legacyRoster(sample), initialFrame: 0 });
  for (let tick = 1000; tick <= 5000; tick += 1000) {
    h.frame(tick); const before = avatarPosition(h.renderer.scene, 'jack').clone();
    h.api.setRoster(legacyRoster(sample + tick)); h.frame(tick);
    assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(before) < .001, 'Resampling double-counted elapsed time');
  }
  const frozen = avatarPosition(h.renderer.scene, 'jack').clone();
  h.api.setPaused(true); h.frame(15_000);
  assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(frozen) < 1e-5);
  h.api.setPaused(false); h.frame(16_000);
  assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(frozen) > .05);

  const reduced = await harness(t, { roster: legacyRoster(sample), initialFrame: 0, reducedMotion: true });
  const still = avatarPosition(reduced.renderer.scene, 'jack').clone(); reduced.frame(10_000);
  assert.ok(avatarPosition(reduced.renderer.scene, 'jack').distanceTo(still) < 1e-5);
  reduced.api.setRoster(legacyRoster(109_000)); reduced.frame(10_000);
  const routine = getCharacterRoutine('jack', 109_000);
  assert.ok(Math.abs(avatarPosition(reduced.renderer.scene, 'jack').y - ((routine.elevation - 1) * 4.3 + avatarOffset(reduced.renderer.scene, 'jack'))) < 1e-5);
});

function socialMember(id,now,{kind='human',online=true,homeFloor=6,destinationFloor=4,side=0,event=null,avatar=defaultOfficeAvatar(kind)}={}){
 const itinerary={cycle:0,pairIndex:0,side,partnerId:side?'visitor-a':'visitor-b',homeFloor,destinationFloor,homeZone:online?'studio':'lounge',visitZone:'lounge',visitKind:'chat',resting:!online,meetingId:event?'scene-event':'scene-social',startedAt:0,delay:0,event};
 const routine=sampleOfficeRoutine({routine:{itinerary}},now);
 return{id,name:id,kind,online,status:online?'working':'break',floor:routine.floor,departmentFloor:homeFloor,zone:online?routine.zone:'lounge',activity:online?'角色拜訪同事':'離線角色在茶水區休息',avatar,routine,ambientEvent:event?{type:event}:null};
}

test('approved member itineraries animate real elevator height, while offline avatars remain visible and stroll without claiming online', async t=>{
 const now=109000,visitor=socialMember('visitor-a',now),resting=socialMember('resting',now,{kind:'agent',online:false,homeFloor:1,destinationFloor:1});
 const roster=[...legacyRoster(now),visitor,resting],before=structuredClone(roster),h=await harness(t,{roster,initialFrame:0});
 const routine=sampleOfficeRoutine(visitor,now),position=avatarPosition(h.renderer.scene,visitor.id);
 assert.equal(routine.inElevator,true);assert.ok(Math.abs(position.y-((routine.elevation-1)*4.3+avatarOffset(h.renderer.scene,visitor.id)))<1e-5);
 assert.ok(meshes(h.renderer.scene,'elevator-car').some(batch=>batch.userData.memberIds.includes(visitor.id)));
 assert.ok(meshes(h.renderer.scene,'overview-person').some(batch=>batch.userData.memberIds.includes(resting.id)));
 const restTime=20000,relaxed=socialMember('resting',restTime,{kind:'agent',online:false,homeFloor:1,destinationFloor:1});
 h.api.setRoster([...legacyRoster(restTime),relaxed]);h.frame(0);h.api.setFloor(1);h.frame(0);
 const start=avatarPosition(h.renderer.scene,relaxed.id).clone();h.frame(5000);const end=avatarPosition(h.renderer.scene,relaxed.id);
 assert.ok(start.distanceTo(end)>.05,'A resting member should be able to wander around the lounge');
 const overlay=h.container.children.find(child=>child.className==='scene-labels'),label=overlay.children.find(child=>child.attributes?.get('aria-label')?.startsWith('resting，'));
 assert.ok(label);assert.equal(label.attributes.get('data-online'),'false');assert.match(label.attributes.get('aria-label'),/休息中/);
 assert.deepEqual(roster,before);
});

test('appearance changes replace detailed geometry and all overview voxels without moving the member or retaining the old buffers',async t=>{
 const member=socialMember('custom-avatar',0,{online:false,homeFloor:1,destinationFloor:1,avatar:{...defaultOfficeAvatar(),preset:'cat',accessory:'glasses'}});
 const h=await harness(t,{roster:[member],initialFrame:0});h.api.setFloor(1);h.frame(0);
 const person=detailedPerson(h.renderer.scene,member.id),oldKey=person.userData.appearanceKey,oldGeometry=meshes(person)[0].geometry;
 let disposed=0;oldGeometry.addEventListener('dispose',()=>disposed++);
 const voxels=Array.from({length:96},(_,i)=>({x:(i%8-3.5)*.2,y:.1+Math.floor(i/8)*.18,z:0,w:.15,h:.15,d:.15,color:i%2?'#aabbcc':'#112233'}));
 const changed={...member,avatar:{...defaultOfficeAvatar(),preset:'voxel',voxels}};
 h.api.setRoster([changed]);h.frame(0);
 assert.equal(detailedPerson(h.renderer.scene,member.id),person);assert.equal(disposed,1);assert.notEqual(person.userData.appearanceKey,oldKey);
 assert.equal(meshes(person).length,1,'96 custom cubes must merge into one detailed draw');
 const entries=meshes(h.renderer.scene,'overview-person').reduce((sum,batch)=>sum+batch.userData.memberIds.filter(id=>id===member.id).length,0);
 assert.equal(entries,96,'The overview must retain every configured custom cube');
 const eventA=socialMember('visitor-a',40000,{homeFloor:1,destinationFloor:1,event:'arm-wrestling'}),eventB=socialMember('visitor-b',40000,{homeFloor:1,destinationFloor:1,event:'arm-wrestling',side:1});
 h.api.setRoster([eventA,eventB]);h.frame(0);
 const arm=meshes(detailedPerson(h.renderer.scene,eventA.id)).find(mesh=>mesh.userData.avatarBone==='rightArm').parent;
 assert.ok(arm.rotation.z<-.7,'Arm-wrestling participants should visibly raise their arm');
 assert.ok(avatarPosition(h.renderer.scene,eventA.id).distanceTo(avatarPosition(h.renderer.scene,eventB.id))<1.6);
});

test('200 avatars with 96 custom cubes keep complete geometry in shared overview batches',async t=>{
 const voxels=Array.from({length:96},(_,i)=>({x:(i%8-3.5)*.2,y:.1+Math.floor(i/8)*.18,z:0,w:.15,h:.15,d:.15,color:i%2?'#aabbcc':'#112233'}));
 const avatar={...defaultOfficeAvatar(),preset:'voxel',voxels},roster=Array.from({length:200},(_,i)=>({id:`capacity-${i}`,name:`測試${i}`,kind:'agent',online:false,status:'break',floor:1,zone:'lounge',avatar}));
 const started=performance.now(),h=await harness(t,{roster,initialFrame:0}),constructionMs=performance.now()-started;
 const batches=meshes(h.renderer.scene,'overview-person');assert.ok(batches.length<=6);assert.equal(batches.reduce((sum,batch)=>sum+batch.count,0),19200);
 const samples=[];for(let i=1;i<=8;i++){const before=performance.now();h.frame(i*16);samples.push(performance.now()-before);}
 samples.sort((a,b)=>a-b);t.diagnostic(JSON.stringify({members:200,cubes:19200,avatarBatches:batches.length,constructionMs:Math.round(constructionMs),medianCpuFrameMs:Math.round(samples[4]*100)/100,gpu:'not measured'}));
});
