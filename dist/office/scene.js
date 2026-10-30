/** Original procedural office. All furniture and people are local geometry. */
import * as THREE from '../island/vendor/three.module.js';
import { OrbitControls } from '../island/vendor/OrbitControls.js';

const ZONE_CENTERS = Object.freeze({ studio: [-4.9, 2.4], meeting: [5.5, -3.7], focus: [-7.3, -5.1], lounge: [5.8, 4.7] });
const ZONE_BOUNDS = Object.freeze({ studio: [-10.2, .4, -1.7, 7.6], meeting: [1.6, 10.1, -7.1, .2], focus: [-10.2, -4.1, -7.1, -3.3], lounge: [1.6, 10.1, 1.4, 7.6] });
const hash = value => [...String(value)].reduce((n, letter) => (n * 31 + letter.codePointAt(0)) >>> 0, 7);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export async function createOfficeScene({ container, onSelect = () => {}, roster = [] }) {
  if (!container) throw new Error('缺少辦公室場景容器。');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    throw new Error('此裝置無法顯示立體辦公室，仍可從成員清單查看角色與同事。');
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9eee7');
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '禾多辦公室立體場景：共同工作區、會議室、專注區與茶水間。可拖曳旋轉、捲動縮放；所有成員也可從旁邊清單選取。');
  canvas.style.touchAction = 'none';
  container.append(canvas);
  const labels = document.createElement('div');
  labels.className = 'scene-labels';
  container.append(labels);

  const camera = new THREE.OrthographicCamera(-16, 16, 12, -12, .1, 180);
  const homeTarget = new THREE.Vector3(0, .65, .6);
  const homeOffset = new THREE.Vector3(25, 28, 30);
  camera.position.copy(homeTarget).add(homeOffset);
  camera.lookAt(homeTarget);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = .1;
  controls.minZoom = .7;
  controls.maxZoom = 2.7;
  controls.minPolarAngle = Math.PI / 6;
  controls.maxPolarAngle = Math.PI / 2.5;
  controls.rotateSpeed = .45;
  controls.zoomSpeed = .6;
  controls.panSpeed = .45;
  controls.enablePan = false;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const hemisphere = new THREE.HemisphereLight('#fff7e5', '#879780', 2.8);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff0d6', 3.4);
  sun.position.set(-8, 24, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 15, bottom: -15, near: 1, far: 60 });
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .04;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#c3dcd9', .7);
  fill.position.set(14, 14, -8);
  scene.add(fill);
  const warmLamp = new THREE.PointLight('#ffd990', 0, 28, 1.5);
  warmLamp.position.set(0, 5, 1);
  scene.add(warmLamp);

  const geometries = new Set(), materials = new Map();
  const geometry = item => { geometries.add(item); return item; };
  const boxGeometry = geometry(new THREE.BoxGeometry(1, 1, 1));
  const cylinderGeometry = geometry(new THREE.CylinderGeometry(1, 1, 1, 16));
  const sphereGeometry = geometry(new THREE.SphereGeometry(1, 12, 8));
  const leafGeometry = geometry(new THREE.IcosahedronGeometry(1, 0));
  const hairGeometry = geometry(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55));
  const ringGeometry = geometry(new THREE.TorusGeometry(.25, .025, 5, 24));
  const material = (color, options = {}) => {
    const key = JSON.stringify([color, options]);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: 0, ...options }));
    return materials.get(key);
  };
  const palette = {
    wood: material('#c69c70'), woodLight: material('#dfba8a'), woodDark: material('#9b7653'),
    cream: material('#eee8da'), white: material('#faf5e7'), dark: material('#44595b'),
    wall: material('#c4cec2'), trim: material('#627674'), charcoal: material('#374d53'),
    blue: material('#81a3a7'), sage: material('#97ad8c'), green: material('#668875'),
    rose: material('#bd8b83'), terracotta: material('#ba8063'), gold: material('#d5b364'),
    glass: material('#b7d3d0', { transparent: true, opacity: .14, roughness: .15, depthWrite: false, side: THREE.DoubleSide }),
    screen: material('#8cbbc0', { emissive: '#83b6bf', emissiveIntensity: .26, roughness: .35 }),
    lamp: material('#f7ddb0', { emissive: '#ffd699', emissiveIntensity: .2 }),
  };
  const room = new THREE.Group();
  scene.add(room);
  const obstacles = [];
  const solid = (x, z, width, depth, padding = .30) => obstacles.push({ minX: x - width / 2 - padding, maxX: x + width / 2 + padding, minZ: z - depth / 2 - padding, maxZ: z + depth / 2 + padding });
  function mesh(parent, shape, mat, x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) {
    const item = new THREE.Mesh(shape, mat);
    item.position.set(x, y, z); item.scale.set(sx, sy, sz); item.rotation.y = ry;
    item.castShadow = !mat.transparent; item.receiveShadow = !mat.transparent;
    parent.add(item); return item;
  }
  const box = (parent, mat, x, y, z, w, h, d, ry = 0) => mesh(parent, boxGeometry, mat, x, y, z, w, h, d, ry);
  const cylinder = (parent, mat, x, y, z, radius, height) => mesh(parent, cylinderGeometry, mat, x, y, z, radius, height, radius);
  const ball = (parent, mat, x, y, z, radius, sx = 1, sy = 1, sz = 1) => mesh(parent, sphereGeometry, mat, x, y, z, radius * sx, radius * sy, radius * sz);
  const group = (parent, x, y, z, rotation = 0) => {
    const value = new THREE.Group(); value.position.set(x, y, z); value.rotation.y = rotation; parent.add(value); return value;
  };

  // Wood platform, tiny staggered seams and two open sides keep the plan legible.
  box(room, palette.woodDark, 0, -.26, .5, 22.4, .5, 17.4);
  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 9; col++) {
      const x = -10.95 + col * 2.75 + (row % 2 ? 1.37 : 0);
      const left = Math.max(-10.99, x), right = Math.min(10.99, x + 2.73);
      if (right > left) box(room, [palette.wood, palette.woodLight, material('#d4ac7d')][(row * 3 + col) % 3], (left + right) / 2, .008, -7.57 + row * .81, right - left, .025, .795);
    }
  }
  // The back wall has high windows; the left wall is deliberately low enough
  // that people remain visible when rotating the office.
  box(room, palette.wall, 0, .75, -8.05, 22.2, 1.5, .22);
  box(room, palette.wall, -11.05, 1.45, .5, .22, 2.9, 17.1);
  box(room, palette.trim, -11.05, 2.95, .5, .25, .12, 17.1);
  box(room, palette.trim, 0, .1, -7.87, 22, .18, .12);
  for (let x = -10.8; x <= 11; x += 3.1) {
    box(room, palette.glass, x + 1.44, 2.5, -8, 2.82, 2, .04);
    box(room, palette.trim, x, 2.5, -8, .075, 2.1, .09);
  }
  box(room, palette.trim, 0, 3.55, -8, 22.2, .12, .12);
  box(room, palette.trim, 0, 1.45, -8, 22.2, .08, .12);
  // Window panes are subtly blue by day and softly lit after dark.
  const windowGlow = box(room, material('#c8dedb', { emissive: '#adcdd3', emissiveIntensity: .12 }), 0, 2.5, -8.12, 22, 1.98, .03);

  function plant(x, z, scale = 1) {
    const p = group(room, x, 0, z);
    cylinder(p, palette.white, 0, .28 * scale, 0, .29 * scale, .53 * scale);
    cylinder(p, palette.woodDark, 0, .55 * scale, 0, .23 * scale, .03);
    cylinder(p, palette.woodDark, 0, .95 * scale, 0, .04, .85 * scale);
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.4;
      const leaf = mesh(p, leafGeometry, i % 2 ? palette.sage : palette.green, Math.cos(angle) * .23 * scale, (.9 + i * .085) * scale, Math.sin(angle) * .23 * scale, .4 * scale, .17 * scale, .23 * scale);
      leaf.rotation.z = Math.cos(angle) * .6;
    }
    solid(x, z, .7 * scale, .7 * scale, .12);
  }
  plant(-10.25, 7.6, 1.2); plant(10, -7.1, 1.2); plant(10.1, 7.6, 1.25); plant(-3, -7, .95);

  function chair(parent, x, z, color = palette.blue, rotation = 0, obstacle = true) {
    const c = group(parent, x, 0, z, rotation);
    cylinder(c, palette.charcoal, 0, .22, 0, .04, .44);
    cylinder(c, palette.charcoal, 0, .08, 0, .3, .045);
    box(c, color, 0, .47, 0, .64, .15, .63);
    box(c, color, 0, .8, .28, .64, .6, .12);
    if (obstacle) solid(x, z, .64, .64, .13);
    return c;
  }
  function desk(x, z, color, index) {
    const d = group(room, x, 0, z);
    box(d, palette.woodLight, 0, .92, 0, 2.25, .13, 1.05);
    for (const dx of [-.94, .94]) for (const dz of [-.36, .36]) box(d, palette.cream, dx, .45, dz, .08, .88, .08);
    box(d, palette.charcoal, -.25, 1.3, -.2, .84, .5, .07);
    box(d, palette.screen, -.25, 1.3, -.154, .73, .39, .012);
    box(d, palette.charcoal, -.25, 1.02, -.2, .06, .18, .06);
    box(d, palette.charcoal, -.25, 1, -.2, .4, .035, .22);
    box(d, palette.cream, -.25, 1.003, .21, .61, .035, .19);
    box(d, color, .7, 1.005, .05, .33, .04, .42, .13);
    cylinder(d, palette.white, .67, 1.08, -.24, .085, .18);
    box(d, palette.white, -.87, 1.025, .1, .24, .04, .32, -.12);
    chair(room, x, z + .98, color);
    solid(x, z, 2.25, 1.05, .28);
    // Subdued carpet mats define personal stations without hiding the wood.
    box(room, material(index % 2 ? '#bac2ab' : '#b3c3bc'), x, .032, z + .28, 2.8, .025, 2.35);
  }
  for (const [index, x] of [-8.4, -4.85, -1.3].entries()) {
    desk(x, .0, [palette.blue, palette.sage, palette.rose][index], index);
    desk(x, 4.0, [palette.sage, palette.rose, palette.blue][index], index + 1);
  }
  // A shared shelf and pinboard along the studio wall.
  box(room, palette.white, -10.56, 1.0, 2.25, .52, 1.9, 1.55);
  for (let i = 0; i < 4; i++) box(room, palette.woodLight, -10.22, .5 + i * .45, 2.25, .05, .045, 1.4);
  for (let i = 0; i < 9; i++) box(room, [palette.sage, palette.rose, palette.gold][i % 3], -10.2, .7 + Math.floor(i / 3) * .45, 1.83 + i % 3 * .3, .22, .3, .19);
  solid(-10.5, 2.25, .8, 1.7, .2);

  // Glass focus room, with an open doorway facing the common area.
  box(room, material('#c6d1c5'), -7.25, .032, -5.1, 6.7, .025, 5.1);
  for (const [x, width] of [[-9.45, 2.1], [-4.75, 1.6]]) {
    box(room, palette.glass, x, 1.5, -2.65, width, 3, .035);
    for (const dx of [-width / 2, width / 2]) box(room, palette.trim, x + dx, 1.5, -2.65, .045, 3, .045);
    box(room, palette.trim, x, 3, -2.65, width, .045, .045);
    solid(x, -2.65, width, .04, .22);
  }
  box(room, palette.glass, -3.9, 1.5, -5.25, .035, 3, 5.2);
  for (const z of [-7.8, -2.65]) box(room, palette.trim, -3.9, 1.5, z, .045, 3, .045);
  box(room, palette.trim, -3.9, 3, -5.25, .045, .045, 5.2);
  solid(-3.9, -5.25, .04, 5.2, .22);
  desk(-7.3, -5.3, palette.dark, 0);
  box(room, palette.woodLight, -9.8, .75, -7.1, 1.5, 1.5, .5);
  for (let i = 0; i < 6; i++) box(room, [palette.rose, palette.gold, palette.sage][i % 3], -10.35 + i * .21, 1.04, -7.03, .13, .53 + i % 2 * .12, .32);
  solid(-9.8, -7.1, 1.5, .5, .2);

  // The meeting room is open to the common corridor, with six chairs and a
  // generous standing ring so avatars never need to stand inside furniture.
  cylinder(room, material('#c0c8ae'), 5.5, .035, -4.15, 3.8, .035);
  cylinder(room, palette.white, 5.5, .8, -4.15, 2.05, .14);
  cylinder(room, palette.woodDark, 5.5, .4, -4.15, .48, .8);
  solid(5.5, -4.15, 4.0, 4.0, .2);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    const x = 5.5 + Math.sin(angle) * 2.85, z = -4.15 + Math.cos(angle) * 2.85;
    chair(room, x, z, i % 2 ? palette.sage : palette.blue, angle);
  }
  box(room, palette.rose, 5.0, .9, -4.2, .5, .035, .65, .3);
  box(room, palette.cream, 6.0, .9, -4.1, .45, .035, .65, -.2);
  cylinder(room, palette.green, 5.5, 1.03, -4.2, .17, .25);
  ball(room, palette.sage, 5.5, 1.27, -4.2, .27);
  box(room, palette.white, .3, 1.5, -7.73, 3.3, 1.7, .09);
  for (let i = 0; i < 3; i++) box(room, [palette.rose, palette.sage, palette.gold][i], -.7 + i * .9, 1.75, -7.66, .64, .43, .015, i % 2 ? -.05 : .04);
  box(room, palette.trim, .3, .65, -7.67, 3.5, .09, .18);

  // Lounge: an L of sofas, a small table and a coffee shelf.
  box(room, material('#aec1b1'), 5.7, .04, 4.6, 7.3, .04, 6.1);
  function sofa(x, z, width, rotation = 0) {
    const s = group(room, x, 0, z, rotation);
    box(s, palette.green, 0, .52, 0, width, .65, 1.12);
    box(s, palette.sage, 0, .88, .45, width, .94, .25);
    box(s, palette.green, -width / 2 + .12, .79, 0, .25, .7, 1.15);
    box(s, palette.green, width / 2 - .12, .79, 0, .25, .7, 1.15);
    for (let i = 0; i < 3; i++) box(s, material('#86a396'), -width / 3 + i * width / 3, .9, -.06, width / 3 - .06, .18, .75);
    solid(x, z, rotation ? 1.2 : width, rotation ? width : 1.2, .23);
  }
  sofa(5.2, 6.55, 4.4);
  sofa(8.65, 4.65, 3.2, Math.PI / 2);
  cylinder(room, palette.woodLight, 5.4, .55, 4.2, .94, .13);
  cylinder(room, palette.woodDark, 5.4, .26, 4.2, .37, .52);
  box(room, palette.rose, 5.1, .64, 4.1, .4, .04, .55, .24);
  cylinder(room, palette.white, 5.75, .71, 4.25, .11, .21);
  solid(5.4, 4.2, 1.9, 1.9, .18);
  cylinder(room, palette.rose, 2.8, .37, 3.15, .48, .71);
  solid(2.8, 3.15, .95, .95, .16);
  box(room, palette.white, 10.35, .65, -.35, 1.0, 1.3, 3.5);
  box(room, palette.woodLight, 10.35, 1.35, -.35, 1.06, .1, 3.6);
  box(room, palette.charcoal, 10.35, 1.75, -1.3, .58, .7, .62);
  box(room, palette.screen, 10.025, 1.83, -1.3, .018, .19, .37);
  for (let i = 0; i < 3; i++) cylinder(room, palette.white, 10.2, 1.5, -.45 + i * .37, .10, .22);
  solid(10.35, -.35, 1.0, 3.6, .24);
  // Two warm pendant lamps, high enough to keep their supports out of sight.
  for (const [x, z] of [[5.5, -4.15], [5.4, 4.2]]) {
    cylinder(room, palette.trim, x, 4.25, z, .025, .65);
    cylinder(room, palette.lamp, x, 3.87, z, .44, .12);
  }

  // A half-meter navigation grid keeps feet on the floor and outside furniture.
  const step = .5, minX = -10.25, minZ = -7.25, columns = 42, rows = 32;
  const nodes = [], byCell = new Map();
  const clear = (x, z) => !obstacles.some(obstacle => x > obstacle.minX && x < obstacle.maxX && z > obstacle.minZ && z < obstacle.maxZ);
  for (let iz = 0; iz < rows; iz++) for (let ix = 0; ix < columns; ix++) {
    const x = minX + ix * step, z = minZ + iz * step;
    if (!clear(x, z)) continue;
    const node = { x, z, ix, iz, key: `${ix},${iz}` }; nodes.push(node); byCell.set(node.key, node);
  }
  const nearestNode = (x, z, choices = nodes) => choices.reduce((best, node) => !best || (node.x - x) ** 2 + (node.z - z) ** 2 < (best.x - x) ** 2 + (best.z - z) ** 2 ? node : best, null);
  const zoneNodes = Object.fromEntries(Object.entries(ZONE_BOUNDS).map(([id, [left, right, back, front]]) => [id, nodes.filter(node => node.x >= left && node.x <= right && node.z >= back && node.z <= front)]));
  function findPath(from, to) {
    const start = nearestNode(from.x, from.z), end = nearestNode(to.x, to.z);
    if (!start || !end || start === end) return end ? [end] : [];
    const queue = [start], previous = new Map([[start.key, null]]);
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current === end) break;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = byCell.get(`${current.ix + dx},${current.iz + dz}`);
        if (!next || previous.has(next.key)) continue;
        previous.set(next.key, current); queue.push(next);
      }
    }
    if (!previous.has(end.key)) return [];
    const path = [];
    for (let current = end; current && current !== start; current = previous.get(current.key)) path.unshift(current);
    return path;
  }
  const people = new Map();
  let selectedId = null, activeZone = 'all', paused = false, disposed = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hitTargets = [];
  function makePerson(person) {
    const seed = hash(person.id), p = group(room, 0, .055, 0);
    const jacket = material(/^#[0-9a-f]{3,8}$/i.test(person.color || '') ? person.color : '#718d88');
    const skin = material(['#e5b693', '#bf8e6c', '#d3a17e', '#f0cbb0'][seed % 4]);
    const hair = material(['#454641', '#6e5745', '#4b5054', '#8a6a50'][seed % 4]);
    const pants = material(seed % 2 ? '#52616a' : '#686e5c');
    const leftLeg = box(p, pants, -.105, .21, 0, .13, .4, .17);
    const rightLeg = box(p, pants, .105, .21, 0, .13, .4, .17);
    box(p, palette.charcoal, -.105, .04, .045, .15, .08, .26);
    box(p, palette.charcoal, .105, .04, .045, .15, .08, .26);
    const torso = cylinder(p, jacket, 0, .66, 0, .23, .5);
    const head = ball(p, skin, 0, 1.05, 0, .235, 1, 1.06, 1);
    mesh(p, hairGeometry, hair, 0, 1.10, -.01, .243, .254, .243);
    const leftArm = box(p, jacket, -.28, .65, 0, .13, .4, .14);
    const rightArm = box(p, jacket, .28, .65, 0, .13, .4, .14);
    ball(p, skin, -.28, .43, 0, .075);
    ball(p, skin, .28, .43, 0, .075);
    // Small eyes face the walk direction, while hair and accessories vary.
    for (const x of [-.07, .07]) ball(p, palette.charcoal, x, 1.07, .213, .022);
    if (seed % 4 === 0) {
      for (const x of [-.075, .075]) box(p, palette.charcoal, x, 1.075, .224, .12, .07, .018);
    }
    if (person.kind === 'agent') {
      cylinder(p, palette.charcoal, 0, 1.39, 0, .025, .2);
      ball(p, palette.screen, 0, 1.51, 0, .07);
      box(p, palette.screen, 0, .7, .225, .14, .12, .02);
    }
    p.scale.setScalar(.86);
    const ring = mesh(room, ringGeometry, material(person.kind === 'character' ? '#b7b18b' : '#5b91a4'), 0, .055, 0);
    ring.rotation.x = Math.PI / 2; ring.visible = person.kind !== 'character';
    for (const part of [torso, head]) { part.userData.personId = person.id; hitTargets.push(part); }
    const label = document.createElement('button'); label.type = 'button'; label.className = 'person-label';
    label.addEventListener('click', () => choose(person.id));
    labels.append(label);
    return { id: person.id, data: person, object: p, torso, leftLeg, rightLeg, leftArm, rightArm, ring, label, path: [], target: null, heading: 0, walkTime: seed % 100, priority: seed, zone: null };
  }
  function choose(id) {
    if (!people.has(id)) return;
    selectedId = id; refreshLabels(); onSelect(id);
  }
  function refreshLabels() {
    const list = [...people.values()];
    const visible = new Set(list.filter(person => person.data.kind !== 'character' && person.data.online).slice(0, 6).map(person => person.id));
    for (const person of list.filter(person => activeZone === 'all' || person.zone === activeZone).sort((a, b) => a.priority - b.priority)) {
      if (visible.size >= (activeZone === 'all' ? 10 : 7)) break;
      visible.add(person.id);
    }
    if (selectedId) visible.add(selectedId);
    for (const person of list) {
      person.showLabel = visible.has(person.id);
      person.label.className = `person-label${person.data.kind !== 'character' ? ' remote' : ''}${person.id === selectedId ? ' selected' : ''}`;
      person.label.replaceChildren();
      const dot = document.createElement('b'); dot.setAttribute('aria-hidden', 'true');
      person.label.append(dot, document.createTextNode(person.data.name));
      person.label.setAttribute('aria-label', `${person.data.name}，${person.data.kind === 'character' ? '劇情角色' : person.data.kind === 'agent' ? 'Agent' : '真人'}，${person.data.activity || ''}`);
    }
  }
  function setRoster(nextRoster) {
    if (disposed) return;
    const next = (Array.isArray(nextRoster) ? nextRoster : []).filter(person => person && typeof person.id === 'string' && typeof person.name === 'string' && (person.kind === 'character' || person.online === true));
    const ids = new Set(next.map(person => person.id));
    for (const [id, person] of people) if (!ids.has(id)) {
      room.remove(person.object, person.ring); person.label.remove(); people.delete(id);
      for (let i = hitTargets.length - 1; i >= 0; i--) if (hitTargets[i].userData.personId === id) hitTargets.splice(i, 1);
    }
    const occupied = [];
    for (const person of people.values()) if (person.target && ids.has(person.id)) occupied.push({ id: person.id, x: person.target.x, z: person.target.z });
    for (const data of next) {
      let person = people.get(data.id);
      const isNew = !person;
      if (!person) { person = makePerson(data); people.set(data.id, person); }
      person.data = data;
      const zone = Object.hasOwn(ZONE_CENTERS, data.zone) ? data.zone : 'studio';
      const movementChanged = person.zone !== zone;
      if (isNew || movementChanged) {
        const center = ZONE_CENTERS[zone], candidates = zoneNodes[zone];
        const safe = candidates.filter(node => !occupied.some(other => other.id !== data.id && Math.hypot(other.x - node.x, other.z - node.z) < .86));
        const pool = safe.length ? safe : candidates;
        const ordered = [...pool].sort((a, b) => {
          const aScore = hash(`${data.id}:${a.key}`), bScore = hash(`${data.id}:${b.key}`);
          return aScore - bScore;
        });
        const target = ordered.length ? ordered[hash(data.id) % Math.min(ordered.length, 15)] : nearestNode(...center);
        if (target) {
          occupied.push({ id: data.id, x: target.x, z: target.z });
          person.target = target;
          if (isNew) {
            const spawn = nearestNode(target.x + (hash(data.id) % 2 ? 1.5 : -1.5), target.z + 1, candidates);
            person.object.position.set(spawn?.x ?? target.x, .055, spawn?.z ?? target.z);
          }
          person.path = reducedMotion.matches ? [] : findPath(person.object.position, target);
          if (reducedMotion.matches || !person.path.length) person.object.position.set(target.x, .055, target.z);
        }
      }
      person.zone = zone;
      person.ring.visible = data.id === selectedId || data.kind !== 'character';
    }
    refreshLabels();
  }

  const roomLabels = [];
  for (const [id, text, x, z] of [['studio', 'STUDIO', -4.8, 7.75], ['focus', 'FOCUS', -7.3, -3.05], ['meeting', 'MEETING', 5.5, -.35], ['lounge', 'LOUNGE', 5.6, 7.95]]) {
    const element = document.createElement('span'); element.className = 'room-label'; element.textContent = text; element.setAttribute('aria-hidden', 'true');
    labels.append(element); roomLabels.push({ id, element, position: new THREE.Vector3(x, .08, z) });
  }
  function focusZone(id = 'all') {
    activeZone = Object.hasOwn(ZONE_CENTERS, id) ? id : 'all';
    const target = activeZone === 'all' ? homeTarget : new THREE.Vector3(ZONE_CENTERS[activeZone][0], .7, ZONE_CENTERS[activeZone][1]);
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(target); camera.position.copy(target).add(offset);
    camera.zoom = activeZone === 'all' ? 1 : 1.55; camera.updateProjectionMatrix(); controls.update();
    refreshLabels();
  }
  function reset() {
    activeZone = 'all'; camera.position.copy(homeTarget).add(homeOffset); controls.target.copy(homeTarget);
    camera.zoom = 1; camera.updateProjectionMatrix(); controls.update(); refreshLabels();
  }
  function setNight(value) {
    const night = Boolean(value);
    scene.background.set(night ? '#1f353e' : '#e9eee7');
    hemisphere.color.set(night ? '#9cbcc9' : '#fff7e5'); hemisphere.groundColor.set(night ? '#505f59' : '#879780'); hemisphere.intensity = night ? .75 : 2.8;
    sun.color.set(night ? '#b8cee8' : '#fff0d6'); sun.intensity = night ? .8 : 3.4;
    fill.intensity = night ? .35 : .7; warmLamp.intensity = night ? 15 : 0;
    palette.lamp.emissiveIntensity = night ? 1.9 : .2;
    palette.screen.emissiveIntensity = night ? 1.2 : .26;
    windowGlow.material.color.set(night ? '#456578' : '#c8dedb');
    windowGlow.material.emissiveIntensity = night ? .35 : .12;
    renderer.toneMappingExposure = night ? 1.15 : 1.25;
  }

  let width = 1, height = 1;
  function resize() {
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    const aspect = width / height, viewHeight = Math.max(23, 31 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2;
    camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null;
  function onPointerDown(event) { down = { x: event.clientX, y: event.clientY, id: event.pointerId }; }
  function onPointerUp(event) {
    if (!down || down.id !== event.pointerId || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 7) { down = null; return; }
    down = null;
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const target = raycaster.intersectObjects(hitTargets)[0];
    if (target) choose(target.object.userData.personId);
  }
  canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { down = null; });
  const project = new THREE.Vector3();
  let lastTime = performance.now(), frame = 0;
  function animate(now) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const delta = Math.min(.05, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
    controls.update();
    const motion = !paused && !reducedMotion.matches && !document.hidden;
    for (const person of people.values()) {
      let walking = false;
      if (motion && person.path.length) {
        const next = person.path[0], position = person.object.position;
        const dx = next.x - position.x, dz = next.z - position.z, distance = Math.hypot(dx, dz), travel = delta * .9;
        if (distance < travel + .015) { position.x = next.x; position.z = next.z; person.path.shift(); }
        else { position.x += dx / distance * travel; position.z += dz / distance * travel; }
        if (distance > .01) {
          const targetAngle = Math.atan2(dx, dz);
          const difference = Math.atan2(Math.sin(targetAngle - person.object.rotation.y), Math.cos(targetAngle - person.object.rotation.y));
          person.object.rotation.y += difference * Math.min(1, delta * 9);
        }
        walking = true; person.walkTime += delta * 8;
      }
      const swing = walking ? Math.sin(person.walkTime) * .3 : 0;
      person.leftLeg.rotation.x = swing; person.rightLeg.rotation.x = -swing;
      person.leftArm.rotation.x = -swing * .8; person.rightArm.rotation.x = swing * .8;
      person.object.position.y = .055 + (walking ? Math.abs(Math.sin(person.walkTime)) * .025 : 0);
      person.ring.position.set(person.object.position.x, .06, person.object.position.z);
      person.ring.visible = person.id === selectedId || person.data.kind !== 'character';
    }
    renderer.render(scene, camera);
    const placed = [];
    // Labels avoid one another in screen space. Selected and connected people
    // win placement; all 28 characters remain available in the member list.
    const labelOrder = [...people.values()].sort((a, b) => (b.id === selectedId) - (a.id === selectedId) || (b.data.kind !== 'character') - (a.data.kind !== 'character') || a.priority - b.priority);
    for (const person of labelOrder) {
      if (!person.showLabel) { person.label.style.display = 'none'; continue; }
      project.copy(person.object.position); project.y += 1.4; project.project(camera);
      const x = (project.x + 1) * width / 2, y = (1 - project.y) * height / 2;
      const labelWidth = Math.max(35, person.data.name.length * 9 + 18);
      const collision = person.id !== selectedId && placed.some(other => Math.abs(other.x - x) < (other.width + labelWidth) / 2 + 3 && Math.abs(other.y - y) < 20);
      const visible = !collision && project.z >= -1 && project.z <= 1 && x > 12 && x < width - 12 && y > 45 && y < height - 30;
      person.label.style.display = visible ? '' : 'none';
      if (visible) { person.label.style.left = `${x}px`; person.label.style.top = `${y}px`; placed.push({ x, y, width: labelWidth }); }
    }
    for (const label of roomLabels) {
      project.copy(label.position).project(camera);
      label.element.style.left = `${(project.x + 1) * width / 2}px`;
      label.element.style.top = `${(1 - project.y) * height / 2}px`;
      label.element.style.display = project.z < -1 || project.z > 1 || activeZone !== 'all' && activeZone !== label.id ? 'none' : '';
    }
  }
  setRoster(roster); requestAnimationFrame(animate);
  return {
    setRoster,
    focusZone,
    setNight,
    setPaused(value) { paused = Boolean(value); },
    selectPerson(id) { if (people.has(id)) { selectedId = id; refreshLabels(); } },
    reset,
    dispose() {
      if (disposed) return;
      disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); controls.dispose();
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointerup', onPointerUp);
      for (const shape of geometries) shape.dispose();
      for (const mat of materials.values()) mat.dispose();
      renderer.dispose(); canvas.remove(); labels.remove();
    },
  };
}
