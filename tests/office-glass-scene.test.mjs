import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Three from '../dist/island/vendor/three.module.js';
import { OFFICE_FLOORS, isOfficeFloor } from '../dist/office/floors.js';
import { getOfficeRoster } from '../dist/office/model.js';
import { getCharacterRoutine, OFFICE_ELEVATOR, OFFICE_ROUTINE_CYCLE_MS, OFFICE_ROUTINE_PAIRS } from '../dist/office/routine.js';

// Run the production scene construction and Three.js matrices/raycasting in
// Node. Only browser surfaces and the GPU renderer are stubbed; no browser is
// launched, and material/geometry/InstancedMesh behavior remains real Three.js.
const sceneSource = readFileSync(new URL('../dist/office/scene.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export async function createOfficeScene', 'async function createOfficeScene');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const loadScene = new AsyncFunction('THREE', 'OrbitControls', 'OFFICE_FLOORS', 'isOfficeFloor', 'getCharacterRoutine', 'OFFICE_ELEVATOR', 'window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', `${sceneSource}\nreturn createOfficeScene;`);

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

async function harness(t, { roster = getOfficeRoster([], 0), width = 700, height = 556, initialFrame = 1000, reducedMotion = false } = {}) {
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
  const createScene = await loadScene({ ...Three, WebGLRenderer: Renderer }, Controls, OFFICE_FLOORS, isOfficeFloor, getCharacterRoutine, OFFICE_ELEVATOR,
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

test('four avatar batches show every real roster entry on its current floor and remove offline members', async t => {
  const roster = getOfficeRoster([], 0), h = await harness(t, { roster });
  const batches = meshes(h.renderer.scene, 'overview-person');
  const origins = floorOrigins(h.renderer.scene);
  assert.deepEqual(batches.map(batch => batch.userData.personPart).sort(), ['body', 'hair', 'head', 'legs']);
  const assertMembers = expected => {
    for (const batch of batches) {
      assert.equal(batch.count, expected.length);
      assert.deepEqual(batch.userData.memberIds, expected.map(member => member.id));
      assert.deepEqual(batch.userData.floors, expected.map(member => member.kind === 'character' ? getCharacterRoutine(member.id, member.routine.sampledAt + h.time()).floor : member.floor));
      for (let index = 0; index < batch.count; index++) {
        const member = expected[index], position = instancePosition(batch, index), base = origins.get(member.floor);
        if (member.kind === 'character') {
          const routine = getCharacterRoutine(member.id, member.routine.sampledAt + h.time());
          const offset = { body: .67, head: 1.14, legs: .25, hair: 1.18 }[batch.userData.personPart];
          assert.ok(Math.abs(position.y - ((routine.elevation - 1) * 4.3 + offset)) < .03, member.id);
        } else assert.ok(position.y >= base && position.y < base + 3, member.id);
        assert.ok(Math.abs(position.x) < 11 && position.z > -8 && position.z < 9, expected[index].id);
      }
    }
  };
  assert.equal(roster.length, 34); assertMembers(roster);
  const human = { id: 'remote-human', name: '同事', kind: 'human', online: true, floor: 2, departmentFloor: 2, zone: 'meeting', color: '#789987' };
  const agent = { id: 'remote-agent', name: '助手', kind: 'agent', online: true, floor: 7, departmentFloor: 6, zone: 'focus', color: '#7899ab' };
  const offline = { id: 'offline-agent', name: '離線助手', kind: 'agent', online: false, floor: 6, departmentFloor: 6 };
  const snapshot = [...roster, human, agent, offline], before = structuredClone(snapshot);
  h.api.setRoster(snapshot); h.frame(); assertMembers([...roster, human, agent]);
  assert.deepEqual(snapshot, before);
  const movedAgent = { ...agent, floor: 3 };
  h.api.setRoster([...roster, movedAgent, { ...human, online: false }]); h.frame(); assertMembers([...roster, movedAgent]);
  h.api.setRoster(roster); h.frame(); assertMembers(roster);
  h.api.setRoster([]); h.frame(); assertMembers([]);
});

test('floor labels, overview instance clicks and handheld-sized cameras select the correct detail floor', async t => {
  const roster = getOfficeRoster([], 0), h = await harness(t, { roster, width: 360, height: 376 });
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
  const head = avatarBatches.find(batch => batch.userData.personPart === 'head'), camera = h.renderer.camera;
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

function avatarPosition(scene, id) {
  const body = meshes(scene, 'overview-person').find(batch => batch.userData.personPart === 'body');
  const index = body.userData.memberIds.indexOf(id); assert.ok(index >= 0, id);
  return instancePosition(body, index);
}

test('a paired appointment walks through the elevator, changes actual height, meets face to face and returns continuously', async t => {
  const h = await harness(t, { roster: getOfficeRoster([], 0), initialFrame: 0 });
  const scene = h.renderer.scene, home = avatarPosition(scene, 'jack').clone();
  // Check both journey phase boundaries and the cabin's boarding/exit edges.
  for (const boundary of [85_000, 103_000, 104_800, 113_200, 115_000, 133_000, 178_000, 196_000, 197_800, 206_200, 208_000, 226_000]) {
    h.frame(boundary - .001); const before = avatarPosition(scene, 'jack').clone();
    h.frame(boundary + .001); const after = avatarPosition(scene, 'jack');
    assert.ok(before.distanceTo(after) < .06, `Position jumped at ${boundary}`);
  }
  // Use a separate clock for an exact mid-journey check after the boundary pass.
  const mid = await harness(t, { roster: getOfficeRoster([], 109_000), initialFrame: 0 });
  const routine = getCharacterRoutine('jack', 109_000), riding = avatarPosition(mid.renderer.scene, 'jack');
  assert.equal(routine.inElevator, true);
  assert.ok(Math.abs(riding.y - ((routine.elevation - 1) * 4.3 + .67)) < 1e-5);
  assert.ok(Math.abs(riding.z - OFFICE_ELEVATOR.z) < 1e-5);
  assert.ok(meshes(mid.renderer.scene, 'elevator-car').some(batch => batch.userData.memberIds.includes('jack')));

  const meeting = await harness(t, { roster: getOfficeRoster([], 145_000), initialFrame: 0 });
  const a = avatarPosition(meeting.renderer.scene, 'jack'), b = avatarPosition(meeting.renderer.scene, 'cindy');
  assert.equal(getCharacterRoutine('jack', 145_000).phase, 'meeting');
  assert.ok(a.distanceTo(b) >= .85 && a.distanceTo(b) <= 1.5, 'Partners must be visibly beside each other');
  assert.ok(Math.abs(a.y - b.y) < 1e-5);
  assert.ok(avatarPosition(scene, 'jack').distanceTo(home) < .06, 'The journey must finish at the original work position');
});

test('the detailed floor shares the overview path and hides a colleague only after the elevator leaves that floor', async t => {
  const h = await harness(t, { roster: getOfficeRoster([], 85_000), initialFrame: 0 });
  const scene = h.renderer.scene;
  h.api.setFloor(6); h.frame(0);
  const figure = meshes(scene).find(part => part.userData.personId === 'jack').parent;
  const original = figure.getWorldPosition(new Three.Vector3()).clone();
  h.frame(18_000);
  const atDoor = figure.getWorldPosition(new Three.Vector3());
  assert.equal(figure.visible, true);
  assert.ok(Math.hypot(atDoor.x - OFFICE_ELEVATOR.doorX, atDoor.z - OFFICE_ELEVATOR.doorZ) < .01);
  h.frame(30_000); assert.equal(figure.visible, false);
  h.api.setFloor(7); h.frame(30_000); assert.equal(figure.visible, true);
  const landed = figure.getWorldPosition(new Three.Vector3()), overview = avatarPosition(scene, 'jack');
  assert.ok(Math.hypot(landed.x - overview.x, landed.z - overview.z) < 1e-5);
  h.frame(141_000); assert.equal(figure.visible, false);
  h.api.setFloor(6); h.frame(141_000);
  assert.equal(figure.visible, true);
  assert.ok(figure.getWorldPosition(new Three.Vector3()).distanceTo(original) < .06);
});

test('every public colleague has a continuous route across every staggered walking and elevator boundary', async t => {
  const roster = getOfficeRoster([], 0), h = await harness(t, { roster, initialFrame: 0 });
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
  const sample = 103_000, h = await harness(t, { roster: getOfficeRoster([], sample), initialFrame: 0 });
  for (let tick = 1000; tick <= 5000; tick += 1000) {
    h.frame(tick); const before = avatarPosition(h.renderer.scene, 'jack').clone();
    h.api.setRoster(getOfficeRoster([], sample + tick)); h.frame(tick);
    assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(before) < .001, 'Resampling double-counted elapsed time');
  }
  const frozen = avatarPosition(h.renderer.scene, 'jack').clone();
  h.api.setPaused(true); h.frame(15_000);
  assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(frozen) < 1e-5);
  h.api.setPaused(false); h.frame(16_000);
  assert.ok(avatarPosition(h.renderer.scene, 'jack').distanceTo(frozen) > .05);

  const reduced = await harness(t, { roster: getOfficeRoster([], sample), initialFrame: 0, reducedMotion: true });
  const still = avatarPosition(reduced.renderer.scene, 'jack').clone(); reduced.frame(10_000);
  assert.ok(avatarPosition(reduced.renderer.scene, 'jack').distanceTo(still) < 1e-5);
  reduced.api.setRoster(getOfficeRoster([], 109_000)); reduced.frame(10_000);
  const routine = getCharacterRoutine('jack', 109_000);
  assert.ok(Math.abs(avatarPosition(reduced.renderer.scene, 'jack').y - ((routine.elevation - 1) * 4.3 + .67)) < 1e-5);
});
