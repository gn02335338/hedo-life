/**
 * Original procedural 禾多島 scene. Three.js 0.180.0 is vendored locally (MIT).
 * All buildings, characters, boats and terrain are constructed here; no models,
 * textures, scripts or other assets from the reference website are distributed.
 */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

import { displayPersona } from '../persona.js';
import { LAYOUT, LINKS, WALK_HEIGHT, PLAYER_SPAWN, DISTRICT_ENTRANCES, NPC_POSITIONS, PLAYER_RADIUS, isWalkable, movePlayer, nearestInteraction } from './navigation.js';

import { OUTFITS, RESIDENT_POSITIONS, normalizeResidents, residentObstacles } from './residents.js';

const COLLEAGUES = Object.freeze({ lobby:'wing', lab:'jack', meeting:'meimei', hr:'hope', finance:'janet', cafe:'jonathan', plaza:'captain', court:'owen', harbor:'cindy' });

export async function createIslandScene({ container, districts = [], onSelect = () => {}, onReady = () => {}, onNearby = () => {}, onRoamChange = () => {} }) {
  if (!container) throw new Error('Missing island container');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    throw new Error('此裝置目前無法啟用 3D 地圖，仍可從地點清單探索禾多島。');
  }
  const scene = new THREE.Scene();
  const daySea = new THREE.Color('#8fc6c2');
  const nightSea = new THREE.Color('#263b53');
  scene.background = daySea.clone();
  scene.fog = new THREE.Fog(daySea, 65, 150);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.27;
  renderer.domElement.className = 'island-canvas';
  renderer.domElement.setAttribute('aria-label', '禾多島互動立體地圖，可拖曳旋轉、捲動縮放，或用地點按鈕探索。');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = 'none';
  container.append(renderer.domElement);
  const overlay = document.createElement('div');
  overlay.className = 'map-labels';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  container.append(overlay);

  const camera = new THREE.OrthographicCamera(-24, 24, 24, -24, .1, 250);
  const homeTarget = new THREE.Vector3(.4, 1, 1);
  const homeOffset = new THREE.Vector3(34, 42, 42);
  camera.position.copy(homeTarget).add(homeOffset);
  camera.lookAt(homeTarget);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.minZoom = .65;
  controls.maxZoom = 3.5;
  controls.minPolarAngle = .08;
  controls.maxPolarAngle = Math.PI / 2.45;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.rotateSpeed = .55;
  controls.panSpeed = .6;
  controls.zoomSpeed = .7;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.listenToKeyEvents(renderer.domElement);

  const hemisphere = new THREE.HemisphereLight('#fff9df', '#749894', 2.5);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff0d4', 3.6);
  sun.position.set(-19, 35, 17);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -31, right: 31, top: 31, bottom: -31, near: 1, far: 95 });
  sun.shadow.bias = -.0006;
  sun.shadow.normalBias = .07;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#b8e4e4', .7);
  fill.position.set(25, 15, -20);
  scene.add(fill);

  const materials = new Map();
  const allGeometries = new Set();
  const textures = new Set();
  const windowMaterials = new Set();
  const lampMaterials = new Set();
  const moving = [];
  const rayTargets = [];
  const tileGroups = new Map();
  const labelItems = [];
  const people = [];
  const colleagues = [];
  const interactionTargets = [];
  const residentActors = new Map();
  let communityObstacles = [];
  let roaming = false, movementEnabled = true, nearby = null;
  let moveInput = { x:0, z:0 };
  let playerPosition = { ...PLAYER_SPAWN };
  let walkTime = 0, playerMoving = false;
  const cameraRight = new THREE.Vector3(), cameraDown = new THREE.Vector3();
  const followTarget = new THREE.Vector3(), followDelta = new THREE.Vector3();
  const dataById = new Map(districts.map((d) => [d.id, d]));
  const mat = (color, opts = {}) => {
    const key = JSON.stringify([color, opts]);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: 0, flatShading: true, ...opts }));
    return materials.get(key);
  };
  const palette = {
    cream: mat('#f2e6ca'), sand: mat('#d8c49c'), darkSand: mat('#c0af8c'),
    grass: mat('#a8bc81'), grassLight: mat('#bac994'), grassDark: mat('#829d6e'),
    leaf: mat('#62947a'), leafLight: mat('#87aa7c'), leafDark: mat('#477966'),
    wood: mat('#ad7e57'), woodLight: mat('#cfaa7e'), woodDark: mat('#725743'),
    brick: mat('#d77c59'), red: mat('#cc5b46'), pink: mat('#e7b2a4'),
    white: mat('#fff4dd'), navy: mat('#3b5966'), blue: mat('#86b6ba'),
    teal: mat('#6b9e91'), lilac: mat('#b49abb'), gold: mat('#dfb966'),
    path: mat('#e4d6b7'), charcoal: mat('#455359'), glass: mat('#73a9b2', { roughness: .28, metalness: .12 }),
  };
  windowMaterials.add(palette.glass);
  const geo = (g) => { allGeometries.add(g); return g; };
  const boxG = geo(new THREE.BoxGeometry(1, 1, 1));
  const sphereG = geo(new THREE.IcosahedronGeometry(1, 0));
  const sphereSmoothG = geo(new THREE.SphereGeometry(1, 10, 7));
  const cylinderG = geo(new THREE.CylinderGeometry(1, 1, 1, 10));
  const coneG = geo(new THREE.ConeGeometry(1, 1, 7));
  const mesh = (parent, geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, rotation = 0) => {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.scale.set(sx, sy, sz);
    object.rotation.y = rotation;
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (p, m, x, y, z, sx, sy, sz, r = 0) => mesh(p, boxG, m, x, y, z, sx, sy, sz, r);
  const cylinder = (p, m, x, y, z, r, h, segments = 10) => mesh(p, segments === 10 ? cylinderG : geo(new THREE.CylinderGeometry(1, 1, 1, segments)), m, x, y, z, r, h, r);
  const ball = (p, m, x, y, z, size, sx = 1, sy = 1, sz = 1) => mesh(p, sphereG, m, x, y, z, size * sx, size * sy, size * sz);
  const group = (p, x = 0, y = 0, z = 0, r = 0) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = r; p.add(g); return g;
  };
  let seed = 20261023;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const from = (values) => values[Math.floor(random() * values.length)];

  function textSign(p, text, x, y, z, width, height, bg = '#3b5966', fg = '#fff4dd', r = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = bg; context.fillRect(0, 0, 512, 128);
    context.fillStyle = fg; context.font = '700 62px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(text, 256, 67, 470);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }); materials.set(`sign-${materials.size}`, material);
    box(p, palette.woodDark, x, y, z, width + .1, height + .09, .08, r);
    const sign = mesh(p, geo(new THREE.PlaneGeometry(width, height)), material, x, y, z + .046);
    sign.rotation.y = r;
  }

  function roof(p, m, x, y, z, width, depth, height) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0); shape.lineTo(0, height); shape.lineTo(width / 2, 0); shape.closePath();
    const geometry = geo(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }));
    const obj = mesh(p, geometry, m, x, y, z - depth / 2);
    return obj;
  }

  function tree(p, x, z, size = 1, kind = 'round') {
    const y = 1.05;
    cylinder(p, palette.wood, x, y + .57 * size, z, .1 * size, 1.15 * size, 7);
    if (kind === 'pine') {
      mesh(p, coneG, palette.leafDark, x, y + 1.1 * size, z, .73 * size, 1.5 * size, .73 * size);
      mesh(p, coneG, palette.leaf, x, y + 1.65 * size, z, .57 * size, 1.3 * size, .57 * size);
    } else {
      ball(p, palette.leaf, x, y + 1.4 * size, z, .72 * size, 1, 1.1, .95);
      ball(p, palette.leafLight, x - .34 * size, y + 1.15 * size, z + .12 * size, .48 * size);
      ball(p, palette.leafDark, x + .33 * size, y + 1.35 * size, z - .16 * size, .48 * size);
    }
    cylinder(p, palette.grassDark, x, 1.025, z, .46 * size, .035, 10);
  }

  function shrub(p, x, z, size = .4) {
    ball(p, palette.leaf, x, 1.1 + size * .38, z, size, 1.1, .7, .8);
    ball(p, palette.leafLight, x + .24, 1.1 + size * .28, z + .08, size * .67);
  }

  function flowers(p, x, z, shade = palette.pink) {
    for (let i = 0; i < 4; i++) {
      const dx = x + (random() - .5) * .7, dz = z + (random() - .5) * .5;
      cylinder(p, palette.leafDark, dx, 1.17, dz, .018, .22, 5);
      ball(p, shade, dx, 1.3 + random() * .1, dz, .105);
    }
  }

  function bench(p, x, z, rotation = 0) {
    const b = group(p, x, 1.05, z, rotation);
    for (const dx of [-.44, .44]) {
      box(b, palette.navy, dx, .2, 0, .07, .4, .43);
      box(b, palette.navy, dx, .5, -.2, .07, .65, .07);
    }
    for (let i = 0; i < 3; i++) box(b, palette.woodLight, 0, .39, -.15 + i * .14, 1.15, .075, .11);
    for (let i = 0; i < 2; i++) box(b, palette.woodLight, 0, .61 + i * .16, -.21, 1.15, .11, .07);
  }

  function lamp(p, x, z) {
    cylinder(p, palette.navy, x, 1.98, z, .045, 1.9, 7);
    cylinder(p, palette.navy, x, 1.1, z, .13, .14, 7);
    const glow = mat('#fff1bd', { emissive: '#ffc46b', emissiveIntensity: .05, roughness: .4 });
    lampMaterials.add(glow);
    box(p, glow, x, 2.98, z, .28, .32, .28);
    box(p, palette.navy, x, 3.16, z, .37, .06, .37);
  }

  function planter(p, x, z, w = 1) {
    box(p, palette.cream, x, 1.18, z, w, .32, .44);
    box(p, palette.woodDark, x, 1.35, z, w - .1, .04, .34);
    for (let i = 0; i < Math.ceil(w * 3); i++) ball(p, palette.leaf, x - w * .36 + i * .3, 1.53, z, .24);
  }

  function windowGrid(p, width, floors, baseY, depth, accent = palette.cream) {
    for (let row = 0; row < floors; row++) {
      const wy = baseY + .48 + row * .82;
      for (let col = 0; col < 3; col++) {
        const wx = -width * .32 + col * width * .32;
        box(p, palette.glass, wx, wy, depth / 2 + .013, width * .235, .52, .035);
      }
      box(p, accent, 0, wy - .32, depth / 2 + .06, width + .1, .085, .13);
      for (let col = 0; col < 2; col++) {
        const wz = -depth * .25 + col * depth * .5;
        box(p, palette.glass, width / 2 + .016, wy, wz, .035, .52, depth * .35);
      }
      box(p, accent, width / 2 + .06, wy - .32, 0, .13, .085, depth + .1);
    }
  }

  function office(p) {
    const b = group(p, -.45, 1.04, -.65);
    box(b, palette.cream, 0, .09, 0, 3.65, .18, 2.95);
    box(b, palette.brick, 0, 2.22, 0, 3.1, 4.35, 2.4);
    windowGrid(b, 3.1, 5, .1, 2.4);
    box(b, palette.navy, 0, .65, 1.23, .75, 1.08, .06);
    box(b, palette.glass, 0, .7, 1.27, .58, .85, .04);
    box(b, palette.white, 0, 1.32, 1.58, 1.55, .12, .86);
    for (const x of [-.68, .68]) cylinder(b, palette.cream, x, .65, 1.85, .045, 1.3, 7);
    box(b, palette.cream, 0, 4.44, 0, 3.4, .18, 2.7);
    box(b, palette.teal, .5, 4.82, -.26, 1.6, .64, 1.34);
    box(b, palette.white, .5, 5.17, -.26, 1.8, .1, 1.5);
    textSign(b, 'HEDO', -.45, 4.88, 1.04, 1.6, .4, '#3b5966');
    for (let i = 0; i < 3; i++) {
      const panel = box(b, palette.navy, -1.02, 4.64, -.7 + i * .54, .72, .07, .43);
      panel.rotation.z = -.15;
      box(b, palette.blue, -1.02, 4.69, -.7 + i * .54, .59, .025, .34);
    }
    planter(p, 1.77, .6, 1);
    const signpost = group(p, 1.85, 1.03, 2.04, -.12);
    cylinder(signpost, palette.woodDark, 0, .72, 0, .05, 1.44, 7);
    box(signpost, palette.gold, 0, 1.2, 0, .65, .24, .1);
    box(signpost, palette.teal, .06, .88, 0, .78, .23, .1);
    bench(p, -2.45, 1.9, .2);
    for (let i = 0; i < 3; i++) box(p, palette.cream, -.45, 1.06 + i * .06, 1.6 - i * .12, 1.65, .11, .3);
  }

  function laboratory(p) {
    const b = group(p, -.25, 1.04, -.5);
    box(b, palette.cream, 0, .1, 0, 3.9, .2, 2.8);
    box(b, palette.teal, 0, 1.06, 0, 3.45, 2.0, 2.3);
    windowGrid(b, 3.45, 2, .14, 2.3, palette.white);
    box(b, palette.white, 0, 2.12, 0, 3.75, .2, 2.65);
    textSign(b, 'IDEA LAB', 0, 1.94, 1.23, 1.62, .34, '#577d78');
    box(b, palette.navy, .95, .57, 1.18, .62, 1.08, .06);
    for (let i = 0; i < 2; i++) {
      box(b, palette.navy, -1.1 + i * .78, 2.3, -.6, .62, .23, .68);
      for (let j = 0; j < 3; j++) box(b, palette.cream, -1.1 + i * .78, 2.43, -.81 + j * .21, .52, .04, .05);
    }
    const dish = group(b, .9, 2.65, -.05, .4);
    cylinder(dish, palette.navy, 0, -.2, 0, .08, .5, 7);
    const bowl = mesh(dish, geo(new THREE.SphereGeometry(.68, 12, 7, 0, Math.PI * 2, 0, Math.PI * .5)), mat('#e8e7d7', { side: THREE.DoubleSide }), 0, .2, 0);
    bowl.rotation.x = -Math.PI * .23;
    cylinder(dish, palette.navy, 0, .61, .17, .03, .9, 6);
    ball(dish, palette.red, 0, 1.04, .17, .08);
    const robot = group(p, 2.2, 1.05, 1.75, -.4);
    box(robot, palette.navy, 0, .13, 0, .5, .25, .36);
    box(robot, palette.white, 0, .48, 0, .46, .48, .32);
    box(robot, palette.blue, 0, .76, .03, .5, .25, .33);
    for (const x of [-.13, .13]) ball(robot, palette.navy, x, .79, .21, .035);
    cylinder(robot, palette.navy, 0, .98, 0, .025, .25, 6);
    ball(robot, palette.gold, 0, 1.12, 0, .07);
    for (const x of [-.35, .35]) box(robot, palette.teal, x, .53, 0, .15, .14, .17);
    planter(p, -1.7, 1.7, 1.1);
    bench(p, 2.45, -.65, Math.PI / 2);
  }

  function meeting(p) {
    const b = group(p, 0, 1.04, -.55);
    cylinder(b, palette.cream, 0, .12, 0, 2.08, .24, 12);
    cylinder(b, palette.lilac, 0, .25, 0, 1.93, .13, 12);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      cylinder(b, palette.white, Math.cos(a) * 1.7, 1.21, Math.sin(a) * 1.7, .075, 1.95, 7);
    }
    cylinder(b, palette.lilac, 0, 2.22, 0, 2.08, .17, 12);
    mesh(b, geo(new THREE.ConeGeometry(2.2, .9, 12)), palette.brick, 0, 2.75, 0);
    cylinder(b, palette.gold, 0, 3.29, 0, .08, .32, 8);
    cylinder(b, palette.woodLight, 0, .77, 0, 1.12, .1, 12);
    cylinder(b, palette.woodDark, 0, .49, 0, .1, .5, 7);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      cylinder(b, palette.teal, Math.cos(a) * 1.4, .52, Math.sin(a) * 1.4, .21, .12, 8);
      cylinder(b, palette.woodDark, Math.cos(a) * 1.4, .37, Math.sin(a) * 1.4, .045, .23, 7);
    }
    box(b, palette.white, 0, .85, .22, .43, .025, .29, -.25);
    cylinder(b, palette.red, -.5, .9, .3, .065, .18, 8);
    const board = group(p, -2.6, 1.08, 1.2, -.22);
    for (const x of [-.45, .45]) box(board, palette.wood, x, .65, 0, .06, 1.3, .1);
    box(board, palette.white, 0, 1.15, 0, 1.15, .75, .08);
    box(board, palette.gold, -.27, 1.29, .05, .2, .17, .02);
    box(board, palette.teal, .05, 1.1, .05, .2, .17, .02);
    box(board, palette.pink, .32, 1.29, .05, .2, .17, .02);
    bench(p, 2.7, 1.15, -Math.PI / 2);
  }

  function humanResources(p) {
    const b = group(p, -.3, 1.05, -.5);
    box(b, palette.cream, 0, .1, 0, 3.5, .2, 2.6);
    box(b, palette.gold, 0, 1.0, 0, 3.0, 1.85, 2.15);
    roof(b, palette.brick, 0, 1.96, 0, 3.5, 2.65, 1.05);
    for (const x of [-.96, .96]) {
      box(b, palette.white, x, 1.08, 1.1, .65, .77, .07);
      box(b, palette.glass, x, 1.08, 1.15, .48, .59, .03);
      box(b, palette.white, x, 1.08, 1.18, .055, .6, .03);
      box(b, palette.teal, x, .59, 1.26, .8, .19, .28);
      ball(b, palette.leaf, x, .77, 1.27, .3, 1, .45, .65);
    }
    box(b, palette.navy, 0, .67, 1.12, .61, 1.18, .1);
    ball(b, palette.gold, .2, .67, 1.19, .045);
    textSign(b, 'PEOPLE', 0, 1.66, 1.19, 1.3, .3, '#a37250');
    box(b, palette.cream, .9, 2.65, -.45, .43, .9, .43);
    box(b, palette.brick, .9, 3.12, -.45, .54, .12, .54);
    const fence = group(p, 0, 1.05, 2.4);
    for (const x of [-2.6, -2.2, -1.8, 1.8, 2.2, 2.6]) box(fence, palette.white, x, .36, 0, .12, .7, .12);
    for (const x of [-2.2, 2.2]) box(fence, palette.white, x, .43, 0, 1.2, .1, .08);
    flowers(p, -2.15, 1.9, palette.pink); flowers(p, 2.15, 1.9, palette.gold);
    bench(p, -2.7, -.5, Math.PI / 2);
    const mailbox = group(p, 1.25, 1.05, 2.48);
    cylinder(mailbox, palette.woodDark, 0, .47, 0, .05, .94, 7);
    box(mailbox, palette.teal, 0, 1.02, 0, .44, .32, .48);
    box(mailbox, palette.navy, 0, 1.05, .25, .28, .055, .025);
  }

  function finance(p) {
    const b = group(p, -.2, 1.04, -.4);
    box(b, palette.cream, 0, .13, 0, 3.7, .26, 2.8);
    box(b, palette.blue, 0, 1.4, 0, 3.1, 2.55, 2.2);
    box(b, palette.navy, 0, 2.76, 0, 3.5, .18, 2.55);
    box(b, palette.cream, 0, 2.92, 0, 3.2, .15, 2.3);
    for (const x of [-1.25, 1.25]) {
      cylinder(b, palette.white, x, 1.25, 1.27, .18, 2.24, 8);
      cylinder(b, palette.cream, x, .25, 1.27, .26, .18, 8);
      cylinder(b, palette.cream, x, 2.36, 1.27, .26, .18, 8);
    }
    for (const x of [-.7, .7]) box(b, palette.glass, x, 1.79, 1.12, .5, .6, .03);
    box(b, palette.navy, 0, .77, 1.14, .93, 1.1, .08);
    const door = mesh(b, geo(new THREE.CylinderGeometry(.38, .38, .1, 16)), palette.sand, 0, .83, 1.23);
    door.rotation.x = Math.PI / 2;
    const wheel = mesh(b, geo(new THREE.TorusGeometry(.18, .025, 5, 12)), palette.navy, 0, .84, 1.31);
    box(b, palette.navy, 0, .84, 1.32, .35, .035, .03);
    box(b, palette.navy, 0, .84, 1.32, .035, .35, .03);
    textSign(b, 'FINANCE', 0, 2.47, 1.34, 1.8, .28, '#3b5966');
    for (let i = 0; i < 3; i++) box(p, palette.cream, -.2, 1.05 + i * .08, 1.7 - i * .16, 2.0, .16, .35);
    const sculpture = group(p, 2.43, 1.05, 1.65);
    box(sculpture, palette.white, 0, .19, 0, .72, .38, .72);
    for (let i = 0; i < 5; i++) cylinder(sculpture, palette.gold, -.12 + (i % 2) * .2, .43 + i * .12, 0, .3, .12, 12);
    bench(p, -2.6, 1.25, .15);
  }

  function umbrella(p, x, z, color, size = 1) {
    const u = group(p, x, 1.05, z);
    cylinder(u, palette.woodDark, 0, .9, 0, .045, 1.8, 7);
    mesh(u, geo(new THREE.ConeGeometry(size, .4, 8)), color, 0, 1.97, 0);
    ball(u, palette.white, 0, 2.2, 0, .06);
    cylinder(u, palette.cream, 0, .69, 0, .44, .09, 10);
    cylinder(u, palette.wood, 0, .37, 0, .06, .6, 7);
    for (const [dx, dz] of [[-.61, 0], [.61, 0]]) {
      cylinder(u, palette.woodLight, dx, .36, dz, .18, .12, 8);
      cylinder(u, palette.woodDark, dx, .2, dz, .04, .3, 7);
    }
    cylinder(u, palette.brick, .17, .79, .04, .05, .13, 7);
  }

  function cafe(p) {
    const b = group(p, -.55, 1.04, -.7);
    box(b, palette.cream, 0, .1, 0, 3.1, .2, 2.5);
    box(b, palette.pink, 0, .97, 0, 2.7, 1.74, 2.05);
    roof(b, palette.brick, 0, 1.92, -.02, 3.2, 2.5, .92);
    box(b, palette.navy, -.52, .98, 1.06, 1.1, 1.05, .06);
    box(b, palette.glass, -.52, 1.03, 1.1, .93, .82, .03);
    box(b, palette.navy, .76, .65, 1.08, .62, 1.22, .05);
    for (let i = 0; i < 7; i++) {
      const awning = box(b, i % 2 ? palette.white : palette.teal, -1.2 + i * .4, 1.67, 1.46, .4, .08, .8);
      awning.rotation.x = .17;
      box(b, i % 2 ? palette.white : palette.teal, -1.2 + i * .4, 1.54, 1.85, .4, .19, .08);
    }
    textSign(b, 'COFFEE', 0, 2.07, 1.3, 1.4, .33, '#764b3c');
    const cup = group(b, -.85, 2.66, 0);
    cylinder(cup, palette.white, 0, .29, 0, .28, .55, 12);
    cylinder(cup, palette.woodDark, 0, .58, 0, .23, .012, 12);
    const handle = mesh(cup, geo(new THREE.TorusGeometry(.18, .055, 6, 10)), palette.white, .29, .3, 0);
    cylinder(cup, palette.cream, 0, 0, 0, .4, .07, 12);
    umbrella(p, 2.0, -.25, palette.gold, .88);
    umbrella(p, 1.85, 2.0, palette.brick, .86);
    bench(p, -2.5, 1.8, .1);
    const chalk = group(p, -.9, 1.05, 2.15, -.12);
    box(chalk, palette.wood, 0, .5, 0, .56, .98, .1);
    box(chalk, palette.navy, 0, .57, .06, .43, .68, .02);
    for (let i = 0; i < 3; i++) box(chalk, palette.cream, 0, .75 - i * .16, .075, .29 - i * .04, .035, .012);
  }

  function plaza(p) {
    const b = group(p, 0, 1.05, -.8);
    cylinder(b, palette.cream, 0, .1, 0, 2.25, .2, 12);
    cylinder(b, palette.brick, 0, .29, 0, 1.85, .24, 12);
    box(b, palette.woodLight, 0, .43, -.15, 3.2, .08, 2.2);
    for (const x of [-1.52, 1.52]) {
      cylinder(b, palette.wood, x, 1.5, -.85, .09, 2.2, 7);
      box(b, palette.navy, x, .85, .65, .37, .8, .38);
      cylinder(b, palette.charcoal, x, 1.05, .85, .12, .02, 10).rotation.x = Math.PI / 2;
    }
    box(b, palette.cream, 0, 2.65, -.85, 3.35, .16, .16);
    for (let i = 0; i < 9; i++) {
      const pennant = mesh(b, geo(new THREE.ConeGeometry(.13, .35, 3)), from([palette.brick, palette.gold, palette.teal, palette.lilac]), -1.35 + i * .34, 2.41 - Math.sin(i / 8 * Math.PI) * .2, -.85);
      pennant.rotation.z = Math.PI;
    }
    box(b, palette.lilac, 0, 1.44, -1.0, 2.6, 1.4, .1);
    textSign(b, 'HELLO, ISLAND', 0, 1.72, -.92, 2.14, .38, '#ae90ae');
    cylinder(b, palette.navy, -.4, .98, .3, .028, .95, 6);
    cylinder(b, palette.navy, -.4, .5, .3, .2, .05, 8);
    ball(b, palette.charcoal, -.4, 1.48, .3, .07);
    for (let i = 0; i < 3; i++) {
      const bx = -1.4 + i * 1.35;
      bench(p, bx, 2.23, 0);
    }
    umbrella(p, 2.85, .5, palette.lilac, .75);
  }

  function line(p, points, color = '#fff4dd', width = 1) {
    const geometry = geo(new THREE.BufferGeometry().setFromPoints(points.map((v) => new THREE.Vector3(...v))));
    const material = new THREE.LineBasicMaterial({ color, linewidth: width });
    materials.set(`line-${materials.size}`, material);
    const l = new THREE.Line(geometry, material); p.add(l); return l;
  }

  function court(p) {
    const c = group(p, 0, 1.05, -.3, -.06);
    box(c, palette.cream, 0, .05, 0, 5.2, .1, 3.8);
    box(c, palette.teal, 0, .115, 0, 4.9, .05, 3.5);
    for (const x of [-1.76, 1.76]) box(c, palette.brick, x, .145, 0, 1.15, .015, 1.5);
    const y = .17;
    line(c, [[-2.35,y,-1.62],[2.35,y,-1.62],[2.35,y,1.62],[-2.35,y,1.62],[-2.35,y,-1.62]]);
    line(c, [[0,y,-1.62],[0,y,1.62]]);
    const circle = [];
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; circle.push([Math.cos(a) * .53,y,Math.sin(a) * .53]); }
    line(c, circle);
    for (const x of [-2.15, 2.15]) {
      const sign = Math.sign(x);
      cylinder(c, palette.navy, x, .83, 0, .055, 1.45, 7);
      box(c, palette.white, x - sign * .05, 1.62, 0, .07, .54, .85);
      box(c, palette.navy, x - sign * .1, 1.57, 0, .025, .23, .34);
      const hoop = mesh(c, geo(new THREE.TorusGeometry(.19, .025, 6, 14)), palette.red, x - sign * .35, 1.4, 0);
      hoop.rotation.x = Math.PI / 2;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        line(c, [[x-sign*.35+Math.cos(a)*.18,1.4,Math.sin(a)*.18],[x-sign*.35+Math.cos(a)*.12,1.15,Math.sin(a)*.12]], '#f5ead7');
      }
      line(c, [[x-sign*.01,y,-.77],[x-sign*1.03,y,-.77],[x-sign*1.03,y,.77],[x-sign*.01,y,.77]]);
    }
    for (const z of [-2.18, 2.18]) {
      for (let i = -2; i <= 2; i++) box(c, palette.woodLight, i * .85, .34, z, .72, .13, .4);
      box(c, palette.navy, 0, .17, z, 4.15, .3, .15);
    }
    const ballObject = ball(c, palette.brick, .72, .32, .68, .17);
    box(p, palette.navy, -2.6, 2.65, -1.75, .12, 3.2, .12);
    box(p, palette.white, -2.55, 4.15, -1.75, .7, .18, .25);
    const glow = mat('#ffe4a6', { emissive: '#ffc46b', emissiveIntensity: .05 }); lampMaterials.add(glow);
    box(p, glow, -2.54, 4.11, -1.61, .54, .09, .03);
  }

  function harbor(p) {
    const l = group(p, -.95, 1.05, -.8);
    cylinder(l, palette.cream, 0, .09, 0, 1.12, .18, 10);
    mesh(l, geo(new THREE.CylinderGeometry(.62, .86, 3.1, 12)), palette.white, 0, 1.68, 0);
    for (let i = 0; i < 3; i++) cylinder(l, palette.teal, 0, .78 + i * .86, 0, .8 - i * .065, .31, 12);
    cylinder(l, palette.cream, 0, 3.27, 0, .96, .15, 12);
    cylinder(l, palette.glass, 0, 3.68, 0, .57, .7, 12);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; cylinder(l, palette.white, Math.cos(a)*.58, 3.69, Math.sin(a)*.58, .035, .72, 6); }
    mesh(l, geo(new THREE.ConeGeometry(.87, .65, 12)), palette.brick, 0, 4.36, 0);
    ball(l, palette.gold, 0, 4.74, 0, .1);
    box(l, palette.navy, 0, .58, .84, .42, .87, .05);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; cylinder(l, palette.navy, Math.cos(a)*.88, 3.51, Math.sin(a)*.88, .022, .4, 6); }
    const rail = mesh(l, geo(new THREE.TorusGeometry(.89, .022, 4, 24)), palette.navy, 0, 3.73, 0); rail.rotation.x = Math.PI / 2;
    const shed = group(p, 1.65, 1.04, .05, -.15);
    box(shed, palette.gold, 0, .65, 0, 1.45, 1.25, 1.35);
    roof(shed, palette.brick, 0, 1.28, 0, 1.7, 1.6, .6);
    box(shed, palette.navy, 0, .5, .69, .55, .95, .04);
    textSign(shed, 'PORT', 0, 1.1, .72, .8, .22, '#a36f47');
    const dock = group(p, .1, .58, 4.2);
    box(dock, palette.woodDark, 0, -.09, .3, 1.35, .18, 3.3);
    for (let i = 0; i < 18; i++) box(dock, palette.woodLight, 0, .04, -1.25 + i * .19, 1.45, .11, .15);
    for (const x of [-.66, .66]) for (const z of [-1.15, .2, 1.6]) cylinder(dock, palette.woodDark, x, -.04, z, .08, 1.2, 7);
    const lifesaver = mesh(p, geo(new THREE.TorusGeometry(.28, .085, 7, 16)), palette.red, 1.03, 1.65, 2.74);
    lifesaver.rotation.y = -.2;
    cylinder(p, palette.woodDark, 1.03, 1.42, 2.75, .045, .78, 7);
    for (let i = 0; i < 3; i++) box(p, palette.woodLight, 2.5 + (i % 2) * .4, 1.3 + Math.floor(i / 2) * .45, 1.95, .42, .43, .43, .1);
  }

  function bakeStatic(tile) {
    tile.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(tile.matrixWorld).invert();
    const buckets = new Map();
    const originals = [];
    tile.traverse((object) => {
      if (!object.isMesh || object.userData.keepDynamic || Array.isArray(object.material)) return;
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      if (geometry.index) { const expanded = geometry.toNonIndexed(); geometry.dispose(); allGeometries.add(expanded); originals.push(expanded); }
      else { allGeometries.add(geometry); originals.push(geometry); }
      const ready = originals[originals.length - 1];
      for (const key of Object.keys(ready.attributes)) if (!['position','normal','uv'].includes(key)) ready.deleteAttribute(key);
      if (!ready.getAttribute('uv')) ready.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(ready.getAttribute('position').count * 2), 2));
      if (!ready.getAttribute('normal')) ready.computeVertexNormals();
      if (!buckets.has(object.material)) buckets.set(object.material, []);
      buckets.get(object.material).push(ready);
    });
    const toRemove = [];
    tile.traverse((o) => { if (o.isMesh && !o.userData.keepDynamic) toRemove.push(o); });
    toRemove.forEach((o) => o.removeFromParent());
    for (const [material, geometries] of buckets) {
      const merged = mergeGeometries(geometries, false);
      if (!merged) continue;
      allGeometries.add(merged);
      const object = new THREE.Mesh(merged, material);
      object.castShadow = true; object.receiveShadow = true;
      object.userData.district = tile.userData.district;
      tile.add(object);
      rayTargets.push(object);
    }
    for (const geometry of originals) { geometry.dispose(); allGeometries.delete(geometry); }
  }

  const buildingFunctions = { lobby: office, lab: laboratory, meeting, hr: humanResources, finance, cafe, plaza, court, harbor };
  for (let index = 0; index < LAYOUT.length; index++) {
    const config = LAYOUT[index];
    const tile = group(scene, config.x, 0, config.z);
    tile.userData.district = config.id;
    tileGroups.set(config.id, tile);
    const bottom = cylinder(tile, palette.darkSand, 0, -.19, 0, 4.27, 1.02, 6); bottom.rotation.y = Math.PI / 6;
    const cliff = cylinder(tile, palette.sand, 0, .22, 0, 4.52, .98, 6); cliff.rotation.y = Math.PI / 6;
    const edge = cylinder(tile, palette.cream, 0, .73, 0, 4.62, .25, 6); edge.rotation.y = Math.PI / 6;
    const ground = cylinder(tile, index % 3 === 0 ? palette.grassLight : palette.grass, 0, .95, 0, 4.36, .2, 6); ground.rotation.y = Math.PI / 6;
    const terrace = cylinder(tile, palette.path, 0, 1.057, .2, 3.0, .025, 10);
    terrace.scale.z = .92;
    for (let j = 0; j < 3; j++) {
      const a = .6 + j * 2.1;
      const r = 4.15;
      ball(tile, j % 2 ? palette.sand : palette.cream, Math.cos(a)*r, .2, Math.sin(a)*r, .4 + random()*.2, 1.2, .6, 1);
    }
    const foam = mesh(tile, geo(new THREE.RingGeometry(4.58, 4.7, 6)), mat('#d6e6cd', { transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide }), 0, -.04, 0);
    foam.rotation.x = -Math.PI / 2; foam.rotation.z = Math.PI / 6;
    buildingFunctions[config.id](tile);
    const treePositions = config.id === 'court' ? [[-2.9,-2.1],[2.8,-2.2],[3.25,.6]] : [[-2.9,-1.55],[2.65,-2],[-2.9,.1],[1.0,-3.1],[3.0,.85]];
    for (let i = 0; i < treePositions.length; i++) {
      const [x,z] = treePositions[i];
      tree(tile, x + (random()-.5)*.24, z, .65 + random()*.38, i % 3 === 0 ? 'pine' : 'round');
    }
    shrub(tile, -2.65, 2.45, .37); shrub(tile, 2.8, 2.3, .32);
    flowers(tile, -1.7, 3.1, index % 2 ? palette.gold : palette.pink);
    lamp(tile, -2.95, 1.5);
    for (let j = 0; j < 5; j++) {
      const a = .2 + j * 1.4;
      ball(tile, j % 2 ? palette.sand : palette.cream, Math.cos(a)*3.9, 1.09, Math.sin(a)*3.9, .11 + random()*.13, 1.4, .6, .8);
    }
    bakeStatic(tile);
    const info = dataById.get(config.id) || {};
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'map-label';
    button.dataset.district = config.id;
    button.style.pointerEvents = 'auto';
    const number = String(info.number ?? index + 1).padStart(2, '0');
    const name = info.name || info.title || config.id;
    const count = document.createElement('span'); count.className = 'map-label-number'; count.textContent = number;
    const title = document.createElement('span'); title.className = 'map-label-name'; title.textContent = name;
    button.append(count, title);
    button.setAttribute('aria-label', `探索${name}`);
    button.addEventListener('click', (event) => { event.stopPropagation(); if(!roaming || nearby?.kind==='building' && nearby.districtId===config.id) onSelect(config.id); });
    overlay.append(button);
    labelItems.push({ id: config.id, element: button, position: new THREE.Vector3(config.x + config.label[0], config.label[1], config.z + config.label[2]) });
  }

  // Short boardwalks connect the shorelines, with a generous opening for water.
  const bridges = group(scene);
  for (const [fromId, toId] of LINKS) {
    const a = tileGroups.get(fromId).position, b = tileGroups.get(toId).position;
    const dx = b.x-a.x, dz = b.z-a.z, distance = Math.hypot(dx,dz);
    const length = Math.max(.6, distance - 7.5);
    const bridge = group(bridges, (a.x+b.x)/2, .8, (a.z+b.z)/2, Math.atan2(dx,dz));
    box(bridge, palette.woodDark, 0, -.04, 0, .92, .15, length);
    const count = Math.ceil(length / .22);
    for (let j = 0; j < count; j++) box(bridge, palette.woodLight, 0, .08, -length/2 + (j+.5)*length/count, 1.08, .12, length/count-.035);
    for (const side of [-.48,.48]) {
      box(bridge, palette.woodLight, side, .47, 0, .055, .055, length+.1);
      for (const z of [-length/2, 0, length/2]) box(bridge, palette.woodDark, side, .18, z, .075, .7, .075);
    }
  }
  bakeStatic(bridges);
  // Bridge geometry is decorative and should not select an unrelated district.
  for (let i = rayTargets.length-1; i >= 0; i--) if (!rayTargets[i].userData.district) rayTargets.splice(i,1);

  const waterMaterial = mat('#8fc6c2', { roughness: .48, metalness: .05 });
  const waterUniforms = { uTime: { value: 0 } };
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = 'uniform float uTime; varying vec3 vWaterPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += sin(position.x * 0.22 + uTime * 0.55) * cos(position.z * 0.2 + uTime * 0.35) * 0.055; vWaterPosition = position;');
    shader.fragmentShader = 'uniform float uTime; varying vec3 vWaterPosition;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat ripple = sin(vWaterPosition.x * 1.35 + vWaterPosition.z * 0.6 + uTime * 0.6) * sin(vWaterPosition.z * 1.2 - uTime * 0.35); diffuseColor.rgb += ripple * 0.014;');
  };
  const waterGeometry = geo(new THREE.PlaneGeometry(220, 220, 80, 80)); waterGeometry.rotateX(-Math.PI / 2);
  const water = mesh(scene, waterGeometry, waterMaterial, 0, -.08, 0);
  water.castShadow = false;
  for (let i = 0; i < 65; i++) {
    const x = (random()-.5)*65, z = (random()-.5)*60;
    const points = [[x,-.002,z], [x+.3,-.002,z+.04], [x+.7,-.002,z+.02]];
    line(scene, points, '#badbd1');
  }

  function makePerson(index, tile, options = {}) {
    const g = group(scene);
    const skin = mat(options.skin || from(['#e9b48c','#cc936e','#a77256','#f0c4a3']));
    const shirt = options.shirt || from([palette.white,palette.brick,palette.teal,palette.lilac,palette.gold,palette.navy]);
    const body = group(g);
    const uniform=[cylinder(body, shirt, 0, .44, 0, .14, .35, 7)];
    mesh(body, sphereSmoothG, skin, 0, .76, .015, .14,.16,.14);
    mesh(body, sphereG, mat(options.hair || '#5c4337'), 0, .85, -.02, .15,.09,.15);
    for(const x of [-.049,.049]) ball(body,palette.navy,x,.77,.145,.012);
    const legs = [], arms = [];
    for (const x of [-.07,.07]) {
      const leg = group(g, x, .29, 0);
      cylinder(leg, palette.navy, 0, -.11, 0, .055, .24, 6);
      box(leg, palette.cream, 0, -.245, .035, .11, .08, .18);
      legs.push(leg);
      const arm = group(body, Math.sign(x)*.19, .57, 0);
      uniform.push(cylinder(arm, shirt, 0, -.08, 0, .045, .19, 6));
      ball(arm, skin, 0, -.21, 0, .052);
      arms.push(arm);
    }
    if(options.accessory === 'bag') box(body,palette.wood,.25,.28,0,.17,.22,.08);
    if(options.accessory === 'coffee') { cylinder(body,palette.cream,.22,.39,.12,.055,.15,8); cylinder(body,palette.woodDark,.22,.47,.12,.046,.012,8); }
    if(options.accessory === 'clipboard') box(body,palette.cream,.22,.4,.06,.16,.24,.035,-.2);
    if(options.accessory === 'glasses') { box(body,palette.navy,0,.79,.15,.25,.065,.025); box(body,palette.gold,0,.8,.17,.027,.025,.02); }
    if(options.accessory === 'cap') { cylinder(body,palette.white,0,.9,0,.16,.12,10); box(body,palette.white,0,.86,.14,.24,.025,.16); }
    if(options.player) {
      // A bright hiking jacket, brimmed hat and red pack identify the visitor.
      cylinder(body,palette.cream,0,.94,-.005,.16,.14,10);
      cylinder(body,palette.cream,0,.87,.015,.215,.035,12);
      box(body,palette.brick,0,.47,-.17,.23,.3,.13);
      for(const x of [-.095,.095]) box(body,palette.brick,x,.5,.12,.026,.29,.035);
      box(body,palette.white,0,.53,.15,.09,.1,.018);
    }
    const person = { object:g, body, uniform, legs, arms, tile, phase:index*1.74, speed:.07+random()*.035, radius:2.65+random()*.15, index };
    if(!options.player) people.push(person);
    return person;
  }
  const colleagueLooks = [
    {shirt:palette.navy,accessory:'bag',hair:'#4a4540'},
    {shirt:palette.teal,accessory:'glasses',hair:'#3d4142'},
    {shirt:palette.brick,accessory:'clipboard',hair:'#574032'},
    {shirt:palette.lilac,accessory:'clipboard',hair:'#5d4337'},
    {shirt:palette.blue,accessory:'bag',hair:'#6c5142'},
    {shirt:palette.white,accessory:'coffee',hair:'#3d4142'},
    {shirt:palette.pink,accessory:'cap',hair:'#624438'},
    {shirt:palette.navy,accessory:'glasses',hair:'#3d4142'},
    {shirt:palette.gold,accessory:'clipboard',hair:'#73503f'},
  ];
  LAYOUT.forEach((config,index) => {
    const id = COLLEAGUES[config.id];
    const person = makePerson(index,config,colleagueLooks[index]);
    person.id=id; person.fixed=true; person.home=NPC_POSITIONS[config.id];
    person.object.scale.setScalar(1.18);
    person.object.position.set(person.home.x,WALK_HEIGHT,person.home.z);
    person.object.rotation.y=-.25;
    const label=document.createElement('div');label.className='map-npc-label';label.textContent=displayPersona(id).name;label.setAttribute('aria-hidden','true');label.style.pointerEvents='none';label.style.display='none';overlay.append(label);
    person.label=label;
    colleagues.push(person);
    interactionTargets.push({kind:'building',id:config.id,districtId:config.id,key:`building:${config.id}`,position:DISTRICT_ENTRANCES[config.id],radius:1.25});
    interactionTargets.push({kind:'person',id,districtId:config.id,key:`person:${id}`,position:person.home,radius:1.4});
    // The guide is stationary and approachable; a second tiny passer-by keeps
    // each district lively without moving its interaction target.
    makePerson(index+11,config,{shirt:from([palette.white,palette.teal,palette.brick,palette.lilac])});
  });
  const player=makePerson(100,LAYOUT[0],{player:true,shirt:palette.gold,skin:'#e9b48c',hair:'#5c4337'});
  player.object.scale.setScalar(1.42);
  player.object.visible=false;
  player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);
  const playerRing=mesh(scene,geo(new THREE.RingGeometry(.29,.39,28)),mat('#fff3be',{emissive:'#d7b14b',emissiveIntensity:.22,side:THREE.DoubleSide,depthWrite:false}),playerPosition.x,WALK_HEIGHT+.018,playerPosition.z);
  playerRing.rotation.x=-Math.PI/2;playerRing.visible=false;playerRing.castShadow=false;
  const playerMarker=document.createElement('div');playerMarker.className='map-player-marker';playerMarker.textContent='我';playerMarker.setAttribute('aria-hidden','true');playerMarker.style.pointerEvents='none';playerMarker.style.display='none';overlay.append(playerMarker);

  function boat(x,z, color, scale = 1, sail = false) {
    const b = group(scene, x, .03, z, -.45);
    const hull = mesh(b, geo(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI*2, 0, Math.PI*.5)), color, 0, .2, 0, .56,.34,1.1);
    hull.rotation.z = Math.PI;
    box(b, palette.woodLight, 0, .19, 0, .8,.1,1.5);
    box(b, palette.white, 0,.4,-.3,.65,.4,.68);
    box(b, palette.glass, 0,.5,.05,.44,.18,.025);
    box(b, palette.brick, 0,.65,-.3,.77,.1,.8);
    if (sail) {
      cylinder(b,palette.woodDark,0,1,0,.035,1.6,7);
      const shape = new THREE.Shape(); shape.moveTo(.06,.55);shape.lineTo(.06,1.75);shape.lineTo(.93,.55);shape.closePath();
      const sailMesh = mesh(b,geo(new THREE.ShapeGeometry(shape)),mat('#fff4dd',{side:THREE.DoubleSide}),0,0,0);
      sailMesh.rotation.y=.1;
    }
    b.scale.setScalar(scale);
    const wake = mesh(b, geo(new THREE.RingGeometry(.7,.75,22,1,Math.PI*.2,Math.PI*.6)), mat('#e0e9da',{transparent:true,opacity:.55,depthWrite:false,side:THREE.DoubleSide}), 0,-.015,1);
    wake.rotation.x=-Math.PI/2; wake.scale.set(1,1.8,1); wake.castShadow=false;
    moving.push({ type:'boat', object:b, x,z,phase:random()*7, anchored:sail });
    return b;
  }
  boat(12.3,15.8,palette.brick,.85,true);
  boat(-15,-2,palette.teal,.85);
  boat(15,-12,palette.gold,.7);
  const gullMaterial = mat('#fff8e6');
  for (let i=0;i<5;i++) {
    const bird=group(scene);
    const left=box(bird,gullMaterial,-.12,0,0,.27,.035,.08);left.rotation.z=.3;
    const right=box(bird,gullMaterial,.12,0,0,.27,.035,.08);right.rotation.z=-.3;
    moving.push({type:'bird',object:bird,phase:i*1.7,radius:18+i*.6});
  }

  const connectionGroup=group(scene);connectionGroup.visible=false;
  const connectionDots=[];
  for(const [aId,bId] of LINKS){
    const a=tileGroups.get(aId).position,b=tileGroups.get(bId).position;
    const start=new THREE.Vector3(a.x,2.5,a.z),end=new THREE.Vector3(b.x,2.5,b.z);
    const middle=start.clone().lerp(end,.5);middle.y=6.7;
    const curve=new THREE.QuadraticBezierCurve3(start,middle,end);
    const geometry=geo(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)));
    const material=new THREE.LineDashedMaterial({color:'#fff1b7',dashSize:.27,gapSize:.18,transparent:true,opacity:.8,depthTest:false});materials.set(`connection-${materials.size}`,material);
    const lineObject=new THREE.Line(geometry,material);lineObject.computeLineDistances();lineObject.renderOrder=3;connectionGroup.add(lineObject);
    const dot=ball(connectionGroup,mat('#fff4c4',{emissive:'#ffd978',emissiveIntensity:.45,depthTest:false}),0,0,0,.08);dot.renderOrder=4;
    connectionDots.push({dot,curve,offset:random()});
  }

  const selectRing=mesh(scene,geo(new THREE.RingGeometry(4.47,4.59,6)),mat('#fff0b4',{transparent:true,opacity:.92,side:THREE.DoubleSide,depthWrite:false}),0,1.08,0);
  selectRing.rotation.x=-Math.PI/2;selectRing.rotation.z=Math.PI/6;selectRing.visible=false;selectRing.castShadow=false;
  const raycaster=new THREE.Raycaster();
  const pointer=new THREE.Vector2();
  let pointerDown=null;
  const onPointerDown=(event)=>{pointerDown={x:event.clientX,y:event.clientY,pointerId:event.pointerId};};
  const onPointerUp=(event)=>{
    if(!pointerDown||pointerDown.pointerId!==event.pointerId||Math.hypot(pointerDown.x-event.clientX,pointerDown.y-event.clientY)>7){pointerDown=null;return;}
    pointerDown=null;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(rayTargets,false).find((item)=>item.object.userData.district);
    if(hit && (!roaming || nearby?.districtId===hit.object.userData.district))onSelect(hit.object.userData.district);
  };
  renderer.domElement.addEventListener('pointerdown',onPointerDown);
  renderer.domElement.addEventListener('pointerup',onPointerUp);
  renderer.domElement.addEventListener('pointercancel',()=>{pointerDown=null;});
  const onContextLost=(event)=>{
    event.preventDefault();
    container.dispatchEvent(new CustomEvent('island-context-lost',{bubbles:true}));
  };
  renderer.domElement.addEventListener('webglcontextlost',onContextLost);

  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reducedMotion.matches,destroyed=false,topView=false,width=1,height=1,frameId=0;
  let elapsed=0,lastTime=performance.now(),transition=null,needsRender=true,renderedOnce=false;
  let baseView=24;
  const onKeyDown=(event)=>{
    if(event.key==='+'||event.key==='='||event.key==='-'){
      event.preventDefault();transition=null;needsRender=true;camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp((event.key==='-'?-1:1)*.17),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();
    } else if(event.key==='Home'){
      event.preventDefault();resetView();
    }
  };
  renderer.domElement.addEventListener('keydown',onKeyDown);
  const onControlStart=()=>{transition=null;};
  controls.addEventListener('start',onControlStart);
  const resize=()=>{
    needsRender=true;
    const rect=container.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);
    const aspect=width/height;
    baseView=aspect<.8?27:aspect<1.1?21.3:19.3;
    camera.left=-baseView*aspect;camera.right=baseView*aspect;camera.top=baseView;camera.bottom=-baseView;
    // On tall screens keep the entire archipelago within the horizontal frame.
    if(aspect<.8){camera.left=-20.8;camera.right=20.8;camera.top=20.8/aspect;camera.bottom=-20.8/aspect;}
    if(window.innerWidth>780&&!roaming){const dx=(camera.right-camera.left)*.04,dy=(camera.top-camera.bottom)*.02;camera.left-=dx;camera.right-=dx;camera.top-=dy;camera.bottom-=dy;}
    camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  };
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
  function moveCamera(target,zoom,offset){
    needsRender=true;
    const toPosition=target.clone().add(offset||camera.position.clone().sub(controls.target));
    if(reducedMotion.matches){controls.target.copy(target);camera.position.copy(toPosition);camera.zoom=zoom;camera.updateProjectionMatrix();controls.update();transition=null;return;}
    transition={start:performance.now(),targetFrom:controls.target.clone(),targetTo:target.clone(),positionFrom:camera.position.clone(),positionTo:toPosition,zoomFrom:camera.zoom,zoomTo:zoom};
  }
  function updateNearby() {
    const next=roaming?nearestInteraction(playerPosition,interactionTargets,nearby?.key):null;
    const previous=nearby;nearby=next;
    if(next?.key!==previous?.key || next&&previous&&next!==previous){needsRender=true;onNearby(next);}
    return nearby;
  }
  function setResidents(input) {
    if(destroyed)return [];
    const residents=normalizeResidents({version:1,residents:input});
    // Keep one reusable model per physical slot. Repeated refreshes or changed
    // approvals never accumulate detached geometry, materials or label nodes.
    for(const actor of residentActors.values()) {actor.object.visible=false;actor.id=null;actor.label.textContent='';actor.label.style.display='none';}
    for(let i=interactionTargets.length-1;i>=0;i--)if(interactionTargets[i].kind==='resident')interactionTargets.splice(i,1);
    for(const resident of residents) {
      const slotKey=`${resident.districtId}:${resident.slot}`;
      let actor=residentActors.get(slotKey);
      const tile=LAYOUT.find(d=>d.id===resident.districtId);
      if(!actor) {
        actor=makePerson(200+residentActors.size,tile,{shirt:palette.teal,accessory:['coffee','bag','cap'][resident.slot],skin:['#e9b48c','#cc936e','#a77256'][resident.slot],hair:['#5c4337','#39494c','#7b5844'][resident.slot]});
        actor.fixed=true;actor.resident=true;actor.home=RESIDENT_POSITIONS[resident.districtId][resident.slot];
        actor.object.scale.setScalar(1.18);
        actor.object.position.set(actor.home.x,WALK_HEIGHT,actor.home.z);
        actor.object.rotation.y=.35;
        const label=document.createElement('div');label.className='map-npc-label map-resident-label';label.setAttribute('aria-hidden','true');label.style.pointerEvents='none';label.style.display='none';overlay.append(label);actor.label=label;
        residentActors.set(slotKey,actor);
      }
      const outfit=OUTFITS.find(item=>item.id===resident.outfit);
      for(const part of actor.uniform)part.material=mat(outfit.color);
      actor.id=resident.id;actor.label.textContent=resident.nickname;actor.object.visible=true;
      interactionTargets.push({kind:'resident',id:resident.id,districtId:resident.districtId,key:`resident:${resident.id}`,position:actor.home,radius:1.15,exitRadius:1.4});
    }
    communityObstacles=residentObstacles(residents);
    // A newly approved character can occupy where the visitor was waiting.
    // Move the visitor only as far as needed to leave that new solid footprint.
    if(!isWalkable(playerPosition,PLAYER_RADIUS,communityObstacles)) {
      let free=null;
      for(let radius=.12;radius<=2.4&&!free;radius+=.12)for(let i=0;i<32;i++) {
        const angle=i/32*Math.PI*2,point={x:playerPosition.x+Math.cos(angle)*radius,z:playerPosition.z+Math.sin(angle)*radius};
        if(isWalkable(point,PLAYER_RADIUS,communityObstacles)){free=point;break;}
      }
      playerPosition=free||{...PLAYER_SPAWN};
      player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);
      playerRing.position.set(playerPosition.x,WALK_HEIGHT+.018,playerPosition.z);
    }
    needsRender=true;updateNearby();
    return residents;
  }
  function getFollowTarget() {
    followTarget.set(playerPosition.x,WALK_HEIGHT+.85,playerPosition.z);
    if(window.innerWidth<=780){
      // Dialogs and detail sheets must not cover the visitor's position.
      const screenY=movementEnabled?.48:.24;
      const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      followTarget.addScaledVector(up,-(camera.top-camera.bottom)/camera.zoom*(.5-screenY));
    }
    return followTarget;
  }
  function setMoveInput(input = {}) {
    const x=Number(input.x),z=Number(input.z);
    moveInput={x:roaming&&movementEnabled&&Number.isFinite(x)?THREE.MathUtils.clamp(x,-1,1):0,z:roaming&&movementEnabled&&Number.isFinite(z)?THREE.MathUtils.clamp(z,-1,1):0};
  }
  function standStill() {
    playerMoving=false;player.body.position.y=0;
    for(const limb of [...player.legs,...player.arms])limb.rotation.x=0;
  }
  function setMovementEnabled(value) {
    movementEnabled=Boolean(value);needsRender=true;
    if(!movementEnabled){moveInput={x:0,z:0};standStill();}
  }
  function setRoaming(value) {
    const next=Boolean(value);if(next===roaming)return;
    roaming=next;moveInput={x:0,z:0};standStill();needsRender=true;resize();
    renderer.domElement.setAttribute('aria-label',next?'禾多島散步地圖。以 W A S D、方向鍵或畫面方向按鈕移動，靠近入口或同事後按 E 或空白鍵互動。可拖曳旋轉、捲動縮放，Home 回到全島。':'禾多島互動立體地圖，可拖曳旋轉、捲動縮放，或用地點按鈕探索。');
    player.object.visible=next;playerRing.visible=next;
    playerMarker.style.display=next?'':'none';
    controls.enablePan=!next;
    if(next){
      movementEnabled=true;
      controls.stopListenToKeyEvents();
      controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_ROTATE};
      topView=false;selectRing.visible=false;
      player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);
      moveCamera(getFollowTarget().clone(),window.innerWidth<=780?3.15:2.65,homeOffset);
    }else{
      controls.listenToKeyEvents(renderer.domElement);
      controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
      for(const colleague of people)if(colleague.label)colleague.label.style.display='none';
      moveCamera(homeTarget,1,homeOffset);
    }
    updateNearby();onRoamChange(next);
  }
  function resetView() {
    if(roaming)setRoaming(false);
    for(const item of labelItems)item.element.setAttribute('aria-pressed','false');
    selectRing.visible=false;topView=false;moveCamera(homeTarget,1,homeOffset);
  }
  function updateWalking(dt) {
    if(!roaming)return;
    const beforeX=playerPosition.x,beforeZ=playerPosition.z;
    if(movementEnabled&&(moveInput.x||moveInput.z)){
      camera.updateMatrixWorld();
      cameraRight.setFromMatrixColumn(camera.matrixWorld,0);cameraRight.y=0;cameraRight.normalize();
      cameraDown.subVectors(camera.position,controls.target);cameraDown.y=0;
      if(cameraDown.lengthSq()<.0001)cameraDown.set(-cameraRight.z,0,cameraRight.x);
      else cameraDown.normalize();
      const worldInput={x:cameraRight.x*moveInput.x+cameraDown.x*moveInput.z,z:cameraRight.z*moveInput.x+cameraDown.z*moveInput.z};
      playerPosition=movePlayer(playerPosition,worldInput,dt,3.8,communityObstacles);
    }
    const dx=playerPosition.x-beforeX,dz=playerPosition.z-beforeZ;
    const moved=Math.hypot(dx,dz);
    if(moved>.00005){
      playerMoving=true;walkTime+=moved*2.5;needsRender=true;
      const angle=Math.atan2(dx,dz);
      const difference=Math.atan2(Math.sin(angle-player.object.rotation.y),Math.cos(angle-player.object.rotation.y));
      player.object.rotation.y+=difference*Math.min(1,dt*18);
      const stride=Math.sin(walkTime*5)*.47;
      player.legs[0].rotation.x=stride;player.legs[1].rotation.x=-stride;
      player.arms[0].rotation.x=-stride*.8;player.arms[1].rotation.x=stride*.8;
      player.body.position.y=Math.abs(Math.sin(walkTime*5))*.025;
    }else if(playerMoving){standStill();needsRender=true;}
    player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);
    playerRing.position.set(playerPosition.x,WALK_HEIGHT+.018,playerPosition.z);
    updateNearby();
    for(const colleague of people){
      if(!colleague.fixed||!colleague.object.visible)continue;
      if(Math.hypot(colleague.home.x-playerPosition.x,colleague.home.z-playerPosition.z)>3.3)continue;
      const angle=Math.atan2(playerPosition.x-colleague.home.x,playerPosition.z-colleague.home.z);
      const difference=Math.atan2(Math.sin(angle-colleague.object.rotation.y),Math.cos(angle-colleague.object.rotation.y));
      if(Math.abs(difference)>.005){colleague.object.rotation.y+=difference*Math.min(1,dt*5);needsRender=true;}
    }
    const desired=getFollowTarget();
    if(transition){
      const offset=transition.positionTo.clone().sub(transition.targetTo);
      transition.targetTo.copy(desired);transition.positionTo.copy(desired).add(offset);
    }else{
      followDelta.subVectors(desired,controls.target);
      if(followDelta.lengthSq()>.000001){
        followDelta.multiplyScalar(reducedMotion.matches?1:1-Math.exp(-dt*9));
        controls.target.add(followDelta);camera.position.add(followDelta);needsRender=true;
      }
    }
  }
  function positionOverlay(element,position,visible=true,avoidPlayer=false) {
    const projected=position.clone().project(camera);
    visible=visible&&projected.z>-1&&projected.z<1&&projected.x>-1.1&&projected.x<1.1&&projected.y>-1.1&&projected.y<1.1;
    element.style.display=visible?'':'none';
    if(visible){
      const x=(projected.x*.5+.5)*width;let y=(-projected.y*.5+.5)*height;
      if(avoidPlayer){
        const playerLabel=new THREE.Vector3(playerPosition.x,WALK_HEIGHT+1.85,playerPosition.z).project(camera);
        const px=(playerLabel.x*.5+.5)*width,py=(-playerLabel.y*.5+.5)*height;
        if(Math.abs(x-px)<Math.min(110,element.textContent.length*5+30)&&Math.abs(y-py)<30)y=py-36;
      }
      element.style.transform=`translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }
  function setHour(hour){
    const value=Number(hour);
    if(!Number.isFinite(value))return;
    needsRender=true;
    const h=((value%24)+24)%24;
    const daylight=THREE.MathUtils.smoothstep(Math.sin((h-6)/12*Math.PI),-.1,.7);
    const dusk=1-Math.abs(Math.sin((h-6)/12*Math.PI));
    const waterColor=nightSea.clone().lerp(daySea,daylight);
    scene.background.copy(waterColor);scene.fog.color.copy(waterColor);waterMaterial.color.copy(waterColor);
    hemisphere.intensity=.7+daylight*1.8;sun.intensity=.7+daylight*2.9;fill.intensity=.3+daylight*.4;
    sun.color.set(daylight>.8?'#fff0d4':daylight>.2?'#ffb87b':'#a0b8ed');
    sun.position.set(-19+(h-12)*1.2,22+daylight*13,17);
    renderer.toneMappingExposure=1.1+daylight*.17;
    for(const material of windowMaterials){material.emissive.set('#f6bc67');material.emissiveIntensity=(1-daylight)*.7;}
    for(const material of lampMaterials)material.emissiveIntensity=.05+(1-daylight)*1.8;
  }
  function animate(time){
    if(destroyed)return;
    frameId=requestAnimationFrame(animate);
    const dt=Math.min((time-lastTime)/1000,.06);lastTime=time;
    if(document.hidden)return;
    if(!paused)elapsed+=dt;
    if(!paused||!renderedOnce){
    waterUniforms.uTime.value=elapsed;
    for(const person of people){
      if(!person.object.visible)continue;
      if(person.fixed){person.body.position.y=Math.sin(elapsed*1.6+person.phase)*.012;continue;}
      const a=person.phase+elapsed*person.speed;
      // Rounded paths keep miniature colleagues in the pedestrian plaza.
      person.object.position.set(person.tile.x+Math.cos(a)*person.radius,1.07+Math.abs(Math.sin(elapsed*5+person.phase))*.015,person.tile.z+Math.sin(a)*person.radius*.77+.17);
      person.object.rotation.y=-a;
      const swing=Math.sin(elapsed*6+person.phase)*.32;
      person.legs[0].rotation.x=swing;person.legs[1].rotation.x=-swing;person.arms[0].rotation.x=-swing;person.arms[1].rotation.x=swing;
    }
    for(const item of moving){
      if(item.type==='boat'){
        item.object.position.y=.08+Math.sin(elapsed*1.2+item.phase)*.045;item.object.rotation.z=Math.sin(elapsed*.8+item.phase)*.025;
        if(!item.anchored){item.object.position.x=item.x+Math.sin(elapsed*.045+item.phase)*2;item.object.position.z=item.z+Math.cos(elapsed*.045+item.phase)*1.5;item.object.rotation.y=elapsed*.045+item.phase+.7;}
      }else{const a=elapsed*.07+item.phase;item.object.position.set(Math.cos(a)*item.radius,6.7+Math.sin(a*2)*.5,Math.sin(a)*item.radius);item.object.rotation.y=-a;}
    }
    if(connectionGroup.visible)for(const item of connectionDots)item.dot.position.copy(item.curve.getPoint((elapsed*.12+item.offset)%1));
    }
    updateWalking(dt);
    if(transition){
      const linear=Math.min(1,(time-transition.start)/850);const t=1-Math.pow(1-linear,3);
      controls.target.lerpVectors(transition.targetFrom,transition.targetTo,t);camera.position.lerpVectors(transition.positionFrom,transition.positionTo,t);camera.zoom=THREE.MathUtils.lerp(transition.zoomFrom,transition.zoomTo,t);camera.updateProjectionMatrix();
      if(linear===1)transition=null;
    }
    const controlsChanged=controls.update();
    if(paused&&!needsRender&&!controlsChanged&&!transition)return;
    camera.updateMatrixWorld();
    for(const item of labelItems){
      const v=item.position.clone().project(camera);
      const closeEnough=!roaming;
      const visible=closeEnough&&v.z>-1&&v.z<1&&v.x> -1.15&&v.x<1.15&&v.y> -1.1&&v.y<1.1;
      item.element.disabled=roaming&&!(nearby?.kind==='building'&&nearby.districtId===item.id);
      item.element.style.display=visible?'':'none';
      if(visible)item.element.style.transform=`translate(${(v.x*.5+.5)*width}px, ${(-v.y*.5+.5)*height}px) translate(-50%, -50%)`;
    }
    if(roaming){
      positionOverlay(playerMarker,new THREE.Vector3(playerPosition.x,WALK_HEIGHT+1.85,playerPosition.z));
      for(const colleague of people)if(colleague.label&&colleague.object.visible)positionOverlay(colleague.label,new THREE.Vector3(colleague.home.x,WALK_HEIGHT+1.52,colleague.home.z),Math.hypot(colleague.home.x-playerPosition.x,colleague.home.z-playerPosition.z)<3.8,true);
    }
    renderer.render(scene,camera);
    renderedOnce=true;needsRender=false;
  }
  setHour(14);
  animate(performance.now());
  // A completed first render lets the caller dismiss its loading state.
  onReady({ reducedMotion:reducedMotion.matches });
  return {
    focus(id){
      if(roaming)return;
      const config=LAYOUT.find((d)=>d.id===id);if(!config)return;
      for(const item of labelItems)item.element.setAttribute('aria-pressed',String(item.id===id));
      selectRing.position.set(config.x,1.08,config.z);selectRing.visible=true;
      const isMobile=window.innerWidth<=780,zoom=isMobile?2.2:1.8;
      const target=new THREE.Vector3(config.x,1.5,config.z);
      if(isMobile){
        // Detail sheets cover the lower map; leave the chosen miniature above them.
        const screenY=document.body.classList.contains('touring')?.44:.22;
        const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
        target.addScaledVector(up,-(camera.top-camera.bottom)/zoom*(.5-screenY));
      }
      moveCamera(target,zoom);
    },
    reset:resetView,
    setRoaming,
    setMoveInput,
    setMovementEnabled,
    setResidents,
    interactNearby(){return updateNearby();},
    setHour,
    setConnections(value){connectionGroup.visible=Boolean(value);needsRender=true;for(const item of connectionDots)item.dot.position.copy(item.curve.getPoint((elapsed*.12+item.offset)%1));},
    setPaused(value){paused=Boolean(value);needsRender=true;},
    setTopView(value){topView=Boolean(value);moveCamera(controls.target.clone(),camera.zoom,topView?new THREE.Vector3(0,65,.1):homeOffset);},
    zoom(delta){const value=Number(delta);if(!Number.isFinite(value))return;transition=null;needsRender=true;camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(value*.17),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();},
    destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onPointerDown);renderer.domElement.removeEventListener('pointerup',onPointerUp);renderer.domElement.removeEventListener('keydown',onKeyDown);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);for(const g of allGeometries)g.dispose();for(const m of materials.values())m.dispose();for(const t of textures)t.dispose();renderer.dispose();renderer.domElement.remove();overlay.remove();},
  };
}
