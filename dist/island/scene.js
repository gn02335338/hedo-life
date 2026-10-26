/**
 * Original procedural 移動島 scene. Three.js 0.180.0 is vendored locally (MIT).
 * All buildings, characters, boats and terrain are constructed here; no models,
 * textures, scripts or other assets from the reference website are distributed.
 */
import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

import { REGIONS, DOCKS, PLAYER_SAIL_SECONDS, getRegionForDistrict, getFerryRoute, ferryRouteLength, ferryPoint } from './archipelago.js';
import { displayPersona } from '../persona.js';
import { getIslandCharacterLook } from './character-looks.js';
import { LAYOUT, LINKS, WALK_HEIGHT, PLAYER_SPAWN, DISTRICT_ENTRANCES, PLACE_ENTRANCES, CAST_POSITIONS, PLAYER_RADIUS, isWalkable, movePlayer, nearestInteraction, findPlaceLanding } from './navigation.js';

import { OUTFITS, RESIDENT_POSITIONS, normalizeResidents } from './residents.js';

import { ISLAND_CAST } from './cast.js';
import { PLACES } from './places.js';
import { createNpcLife } from './npc-life.js';

export async function createIslandScene({ container, districts = [], initialHour = 10, onSelect = () => {}, onSelectPlace = () => {}, onReady = () => {}, onNearby = () => {}, onRoamChange = () => {}, onLifeUpdate = () => {} }) {
  if (!container) throw new Error('Missing island container');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    throw new Error('此裝置目前無法啟用 3D 地圖，仍可從地點清單探索移動島。');
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
  renderer.domElement.setAttribute('aria-label', '移動島互動立體地圖，可拖曳旋轉、捲動縮放，或用地點按鈕探索。');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.touchAction = 'none';
  container.append(renderer.domElement);
  const overlay = document.createElement('div');
  overlay.className = 'map-labels';
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
  container.append(overlay);

  const camera = new THREE.OrthographicCamera(-24, 24, 24, -24, .1, 250);
  const homeTarget = new THREE.Vector3(0, 1, 0);
  let currentRegion='company', voyage=null;
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
  const placeRayTargets = [];
  const tileGroups = new Map();
  const labelItems = [];
  const placeLabels = [];
  let focusedDistrict = null, focusedPerson = null;
  const ferryBoats=new Map();
  const people = [];
  const colleagues = [];
  const interactionTargets = [];
  const residentActors = new Map();
  const actorsByKey = new Map();
  const npcLife = createNpcLife({ hour: initialHour });
  let characterObstacles = npcLife.getObstacles();
  let lifeSnapshot = npcLife.getState(), lastLifePublished = -Infinity;
  const dynamicNavigation = Object.freeze({dynamicCharacters:true});
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
    const sign = mesh(p, geo(new THREE.PlaneGeometry(width, height)), material, x + Math.sin(r)*.046, y, z + Math.cos(r)*.046);
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
    textSign(b, '經營總部', -.45, 4.88, 1.04, 1.8, .4, '#3b5966');
    for(const x of [-1.48,1.48])box(b,palette.gold,x,2.36,1.24,.065,4.1,.07);
    box(b,palette.navy,.5,4.82,.43,1.34,.4,.035);
    textSign(b,'董事長室',.5,4.82,.46,1.1,.23,'#3b5966');
    textSign(b,'總經理室',-.55,3.55,1.26,1.4,.3,'#a26851');
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
    textSign(b, '創研園區', 0, 1.94, 1.23, 1.62, .34, '#577d78');
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
    for(let i=0;i<5;i++){
      const color=[palette.teal,palette.gold,palette.navy,palette.lilac,palette.brick][i];
      box(b,color,-1.35+i*.68,.12,1.17,.54,.18,.06);
      box(b,color,-1.35+i*.68,2.32,.7,.55,.18,.48);
    }
    box(b,palette.navy,-1.74,1.11,0,.04,1.38,1.35);
    for(let i=0;i<4;i++)box(b,palette.blue,-1.77,.65+i*.25,0,.025,.07,1.1);
    textSign(b,'研發中心',-.92,1.2,1.21,.88,.23,'#527f7b');
    textSign(b,'產品開發',.92,1.2,1.21,.88,.23,'#a6824a');
    textSign(b,'MIS',-1.8,1.55,0,.9,.28,'#3b5966','#fff4dd',-Math.PI/2);
    textSign(b,'產品設計',1.8,1.55,0,1.0,.28,'#a188a9','#fff4dd',Math.PI/2);
    textSign(b,'專案管理',0,1.55,-1.21,1.2,.28,'#a66f55','#fff4dd',Math.PI);
  }

  function meeting(p) {
    const base=group(p,0,1.04,-.55);
    cylinder(base,palette.cream,0,.1,0,2.08,.2,12);
    for(const [side,color,title] of [[-1,palette.lilac,'行銷部'],[1,palette.teal,'教育訓練']]){
      const wing=group(base,side*.83,0,0);
      box(wing,color,0,1.02,0,1.5,1.85,2.15);
      roof(wing,side<0?palette.brick:palette.navy,0,1.98,0,1.68,2.34,.68);
      box(wing,palette.white,0,.92,1.09,1.2,1.23,.055);
      box(wing,palette.glass,0,1.03,1.13,.94,.79,.03);
      box(wing,palette.cream,0,.46,1.16,1.1,.12,.18);
      textSign(wing,title,0,1.72,1.16,1.18,.28,side<0?'#a77a94':'#567e7d');
      for(let i=0;i<3;i++)box(wing,[palette.gold,palette.pink,palette.blue][i],-.32+i*.3,1.05,1.155,.2,.27,.02,.1*i);
    }
    box(base,palette.white,0,2.11,.1,.16,.18,2.25);
    const board=group(p,-2.6,1.08,1.2,-.22);
    for(const x of [-.45,.45])box(board,palette.wood,x,.65,0,.06,1.3,.1);
    box(board,palette.white,0,1.15,0,1.15,.75,.08);
    textSign(board,'BRAND · LEARN',0,1.26,.055,1.0,.2,'#ebe0ca','#5a6c65');
    for(let i=0;i<3;i++)box(board,[palette.gold,palette.pink,palette.teal][i],-.3+i*.3,.99,.055,.19,.18,.02);
    bench(p,2.7,1.15,-Math.PI/2);
  }

  function humanResources(p) {
    const b=group(p,-.3,1.05,-.5);
    box(b,palette.cream,0,.1,0,3.5,.2,2.6);
    for(let i=0;i<3;i++){
      const x=-1+i;
      box(b,[palette.gold,palette.cream,palette.teal][i],x,1.02,0,.97,1.86,2.15);
      box(b,palette.navy,x,.82,1.1,.55,1.35,.05);
      box(b,palette.glass,x,1.1,1.14,.42,.65,.025);
      box(b,palette.white,x,2.01,0,1.05,.13,2.4);
      textSign(b,['人資','行政','法務'][i],x,1.74,1.16,.72,.26,'#806e56');
    }
    box(b,palette.brick,0,2.2,-.35,3.15,.24,1.45);
    box(b,palette.white,0,2.35,-.35,3.35,.08,1.65);
    for(const x of [-1.35,1.35])cylinder(b,palette.cream,x,.85,1.54,.055,1.7,7);
    box(b,palette.teal,0,1.76,1.5,3.1,.1,.8);
    textSign(b,'PEOPLE · SERVICE',0,2.18,.45,2.2,.3,'#a27354');
    const fence=group(p,0,1.05,2.4);
    for(const x of [-2.6,-2.2,-1.8,1.8,2.2,2.6])box(fence,palette.white,x,.36,0,.12,.7,.12);
    for(const x of [-2.2,2.2])box(fence,palette.white,x,.43,0,1.2,.1,.08);
    flowers(p,-2.15,1.9,palette.pink);flowers(p,2.15,1.9,palette.gold);
    const mailbox=group(p,1.25,1.05,2.48);
    cylinder(mailbox,palette.woodDark,0,.47,0,.05,.94,7);
    box(mailbox,palette.teal,0,1.02,0,.44,.32,.48);
    box(mailbox,palette.navy,0,1.05,.25,.28,.055,.025);
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
    textSign(b, '財務 · 會計', 0, 2.47, 1.34, 2.15, .28, '#3b5966');
    for(const x of [-.76,.76]){
      box(b,palette.teal,x,.75,1.16,.62,1.18,.055);
      box(b,palette.glass,x,1.02,1.2,.46,.54,.025);
      box(b,palette.gold,x,1.44,1.22,.74,.06,.11);
    }
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
    const b=group(p,-.55,1.04,-.7);
    box(b,palette.cream,0,.1,0,3.1,.2,2.5);
    box(b,palette.teal,0,1.02,0,2.7,1.85,2.05);
    for(let i=0;i<3;i++){
      const x=-.9+i*.9;
      box(b,palette.woodLight,x,.97,1.06,.8,1.55,.06);
      box(b,palette.glass,x,1.07,1.1,.61,1.1,.025);
      textSign(b,['會議室','茶水間','福委會'][i],x,1.76,1.15,.7,.24,'#537d75');
    }
    box(b,palette.white,0,2.02,0,3.05,.16,2.45);
    for(let i=0;i<5;i++)box(b,i%2?palette.woodLight:palette.cream,-1.2+i*.6,2.12,0,.22,.1,2.4);
    box(b,palette.gold,0,2.29,-.4,2.4,.18,1.25);
    textSign(b,'COMMON HOUSE',0,2.31,.32,2.15,.3,'#9a7857');
    const cup=group(b,-.85,2.43,-.1);
    cylinder(cup,palette.white,0,.24,0,.23,.44,12);
    cylinder(cup,palette.woodDark,0,.47,0,.19,.012,12);
    mesh(cup,geo(new THREE.TorusGeometry(.15,.045,6,10)),palette.white,.24,.25,0);
    cylinder(cup,palette.cream,0,0,0,.34,.06,12);
    umbrella(p,2,-.25,palette.gold,.88);umbrella(p,1.85,2,palette.teal,.86);
    bench(p,-2.5,1.8,.1);
    const boxOffice=group(b,.82,2.46,-.3);
    box(boxOffice,palette.pink,0,.17,0,.63,.34,.5);
    for(const x of [-.18,.18])box(boxOffice,palette.white,x,.17,.26,.11,.15,.02);
    ball(boxOffice,palette.red,0,.39,0,.08);
  }

  function plaza(p) {
    const base=group(p,0,1.05,-.8);
    cylinder(base,palette.cream,0,.1,0,2.25,.2,12);
    const stores=[[-1.12,-.18,palette.teal,'商務開發'],[0,.18,palette.brick,'電商業務'],[1.12,-.18,palette.lilac,'廣告業務']];
    for(const [x,z,color,title] of stores){
      const shop=group(base,x,.1,z);
      box(shop,color,0,.95,0,1.06,1.7,1.8);
      box(shop,palette.navy,0,.72,.92,.64,1.28,.045);
      box(shop,palette.glass,0,.95,.96,.48,.75,.03);
      box(shop,palette.white,0,1.86,0,1.18,.14,2.0);
      roof(shop,color,0,1.95,0,1.25,2.05,.46);
      for(let i=0;i<4;i++)box(shop,i%2?palette.white:palette.gold,-.45+i*.3,1.48,1.15,.3,.08,.6);
      textSign(shop,title,0,1.78,1.02,1.0,.25,'#596c68');
    }
    const display=group(base,0,2.8,-.4);
    box(display,palette.cream,0,0,0,2.7,.72,.13);
    textSign(display,'BUSINESS QUARTER',0,0,.08,2.45,.42,'#477b7b');
    for(const x of [-1.18,1.18])cylinder(base,palette.navy,x,2.1,-.4,.035,1.3,7);
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
    textSign(shed, '禾多居酒屋', 0, 1.1, .72, 1.25, .24, '#5e4037');
    for(const x of [-.42,-.14,.14,.42])box(shed,palette.navy,x,.91,.78,.23,.38,.045);
    const lantern=mat('#df7050',{emissive:'#e76c35',emissiveIntensity:.5});lampMaterials.add(lantern);
    for(const x of [-.83,.83]){
      cylinder(shed,palette.woodDark,x,1.2,.76,.025,.55,6);
      ball(shed,lantern,x,.95,.76,.17,.85,1.2,.85);
      cylinder(shed,palette.navy,x,.77,.76,.1,.04,7);
    }
    const dock = group(p, .1, .58, 4.2);
    box(dock, palette.woodDark, 0, -.09, .3, 1.35, .18, 3.3);
    for (let i = 0; i < 18; i++) box(dock, palette.woodLight, 0, .04, -1.25 + i * .19, 1.45, .11, .15);
    for (const x of [-.66, .66]) for (const z of [-1.15, .2, 1.6]) cylinder(dock, palette.woodDark, x, -.04, z, .08, 1.2, 7);
    const lifesaver = mesh(p, geo(new THREE.TorusGeometry(.28, .085, 7, 16)), palette.red, 1.03, 1.65, 2.74);
    lifesaver.rotation.y = -.2;
    cylinder(p, palette.woodDark, 1.03, 1.42, 2.75, .045, .78, 7);
    const kiosk=group(p,2.6,1.05,1.95);
    box(kiosk,palette.navy,0,.66,0,.8,1.3,.8);
    roof(kiosk,palette.lilac,0,1.34,0,1.05,1.0,.38);
    box(kiosk,palette.woodLight,0,.65,.42,.64,.42,.04);
    textSign(kiosk,'阿良的邀請',0,1.08,.43,.75,.24,'#655071');
    ball(kiosk,lantern,.49,1.15,.12,.12,.9,1.2,.9);
    for(let i=0;i<5;i++)box(p,palette.woodLight,1.52+i*.09,1.067,1.45+i*.21,.62,.018,.11,-.28);
  }

  // District keepsakes sit on existing furniture, roofs or the decorative dock.
  // Nothing here adds a standing obstacle to the shared walking paths.

  function exile(p) {
    const palace=group(p,-.65,1.05,-.8);
    box(palace,palette.cream,0,.07,0,2.45,.14,2.2);
    box(palace,palette.lilac,0,.92,0,2.15,1.7,1.9);
    roof(palace,palette.navy,0,1.87,0,2.47,2.17,.65);
    for(const x of [-.68,.68]){
      box(palace,palette.white,x,.97,.98,.38,.7,.045);
      box(palace,palette.glass,x,1,.101+.9,.27,.51,.025);
      box(palace,palette.white,x,.97,-.98,.38,.7,.045);
    }
    box(palace,palette.woodDark,0,.61,.98,.53,1.1,.055);
    textSign(palace,'冷宮',0,1.55,1.02,1.15,.32,'#78809a');
    const gate=group(p,1.8,1.05,.15);
    box(gate,palette.teal,0,.62,0,.95,1.24,.9);
    roof(gate,palette.navy,0,1.29,0,1.2,1.15,.4);
    box(gate,palette.glass,0,.85,.47,.69,.42,.03);
    box(gate,palette.woodLight,0,.4,.52,.75,.08,.24);
    textSign(gate,'值班亭',0,1.19,.56,.9,.22,'#6d7d7e');
    const clock=group(gate,0,.94,-.47);
    cylinder(clock,palette.cream,0,0,0,.17,.04,12).rotation.x=Math.PI/2;
    box(p, palette.navy,2.6,1.8,1.5,.065,1.5,.065);
    box(p,palette.gold,2.6,2.25,1.5,.54,.1,.12);
    bench(p,-2.5,1.5,.1);
    const tea=group(p,-2.15,1.05,2.1);
    cylinder(tea,palette.woodLight,0,.4,0,.35,.09,10);
    cylinder(tea,palette.woodDark,0,.2,0,.045,.4,7);
    cylinder(tea,palette.white,0,.52,0,.07,.16,8);
    textSign(p,'流放島',-.8,1.65,2.8,1.75,.35,'#7b8195');
  }
  function hospital(p) {
    const b=group(p,-.3,1.05,-.5);
    box(b,palette.cream,0,.09,0,3.5,.18,2.6);
    box(b,palette.white,0,1.37,0,3.1,2.55,2.2);
    for(const x of [-1.05,1.05])for(const y of [.95,1.85])box(b,palette.glass,x,y,1.13,.52,.56,.04);
    box(b,palette.pink,0,2.7,0,3.35,.18,2.45);
    box(b,palette.white,0,.75,1.14,.8,1.3,.06);
    box(b,palette.glass,0,.79,1.18,.62,1.12,.025);
    box(b,palette.red,0,2.22,1.16,.64,.17,.055);
    box(b,palette.red,0,2.22,1.17,.17,.64,.055);
    box(b,palette.pink,0,1.55,1.5,1.5,.11,.72);
    textSign(b,'急診室',0,1.73,1.54,1.2,.27,'#b77470');
    const roofSign=group(b,0,3,-.25);
    box(roofSign,palette.white,0,.12,0,1.2,.72,.13);
    box(roofSign,palette.red,0,.12,.09,.5,.14,.04);
    box(roofSign,palette.red,0,.12,.1,.14,.5,.04);
    const car=group(p,2.45,1.08,1.3);
    box(car,palette.white,0,.38,0,.85,.62,1.35);
    box(car,palette.pink,0,.47,.7,.58,.14,.025);
    box(car,palette.glass,0,.68,.44,.66,.28,.035);
    box(car,palette.red,0,.75,-.3,.53,.09,.22);
    for(const x of [-.45,.45])for(const z of [-.42,.42])ball(car,palette.charcoal,x,.16,z,.14,.5,1,1);
    box(car,palette.red,-.44,.42,-.05,.03,.12,.4);
    box(car,palette.red,-.45,.42,-.05,.03,.4,.12);
    bench(p,-2.6,1.6,0);
  }
  function police(p) {
    const b=group(p,-.25,1.05,-.5);
    box(b,palette.cream,0,.09,0,3.3,.18,2.5);
    box(b,palette.blue,0,1.02,0,2.9,1.9,2.1);
    box(b,palette.navy,0,2.04,0,3.2,.22,2.4);
    for(const x of [-.95,.95]){
      box(b,palette.white,x,1.02,1.08,.64,.85,.05);
      box(b,palette.glass,x,1.04,1.12,.47,.61,.025);
    }
    box(b,palette.navy,0,.7,1.08,.65,1.25,.065);
    box(b,palette.glass,0,.8,1.13,.48,.86,.025);
    box(b,palette.white,0,1.67,1.1,1.25,.4,.05);
    textSign(b,'島上警局',0,1.69,1.15,1.18,.3,'#48667e');
    const badge=mesh(b,geo(new THREE.CircleGeometry(.34,5)),palette.gold,0,2.49,.4);badge.rotation.z=Math.PI;
    box(b,palette.white,0,2.49,.43,.27,.055,.025);
    textSign(b,'筆錄室',0,1.27,1.21,.72,.21,'#55758a');
    const car=group(p,2.35,1.08,1.4);
    box(car,palette.white,0,.26,0,.85,.4,1.3);
    box(car,palette.navy,0,.49,-.05,.78,.31,.75);
    box(car,palette.glass,0,.51,.35,.6,.2,.025);
    for(const x of [-.45,.45])for(const z of [-.42,.42])ball(car,palette.charcoal,x,.15,z,.14,.5,1,1);
    box(car,palette.red,-.18,.69,0,.24,.1,.19);box(car,palette.blue,.18,.69,0,.24,.1,.19);
    const flag=group(p,-2.45,1.05,1.5);
    cylinder(flag,palette.navy,0,1,0,.035,2,7);
    box(flag,palette.blue,.3,1.7,0,.6,.38,.025);
    box(flag,palette.gold,.3,1.7,.02,.12,.12,.025);
  }

  function districtKeepsakes(p,id) {
    if(id==='lobby'){
      for(let i=0;i<3;i++){box(p,palette.teal,.75,6.27,-1.02+i*.36,.29,.13,.26);ball(p,palette.leafLight,.75,6.42,-1.02+i*.36,.18,1,.7,1);}
    }else if(id==='lab'){
      cylinder(p,palette.white,.1,3.45,-1.35,.035,.65,7);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;box(p,palette.gold,.1+Math.cos(a)*.21,3.78,-1.35+Math.sin(a)*.21,.25,.04,.07,-a);}
      ball(p,palette.red,.1,3.82,-1.35,.065);
    }else if(id==='meeting'){
      for(let i=0;i<3;i++)box(p,[palette.gold,palette.lilac,palette.blue][i],-.42+i*.38,1.89,-.85,.26,.03,.2,.16*i);
    }else if(id==='hr'){
      for(const x of [-1.26,.66])for(let i=0;i<3;i++)ball(p,i%2?palette.pink:palette.white,x-.16+i*.16,1.89,.77,.07);
    }else if(id==='finance'){
      cylinder(p,palette.wood,1.05,4.1,-.85,.24,.22,8);
      ball(p,palette.leaf,1.05,4.4,-.85,.31,1,1.1,1);
      ball(p,palette.leafLight,1.15,4.58,-.88,.2);
    }else if(id==='cafe'){
      box(p,palette.woodLight,-1.08,2.1,.4,1.0,.065,.32);
      for(let i=0;i<3;i++){
        cylinder(p,palette.brick,-1.36+i*.28,2.21,.4,.105,.18,8);
        ball(p,[palette.leaf,palette.leafLight,palette.leafDark][i],-1.36+i*.28,2.38,.4,.13,.8,1.25,.8);
      }
      cylinder(p,palette.white,-2.73,1.51,1.67,.055,.12,8);
      box(p,palette.pink,-2.35,1.49,1.72,.25,.025,.2,.18);
    }else if(id==='plaza'){
      for(let i=0;i<2;i++){
        const x=.6+i*.65,z=-.55;
        box(p,palette.wood,x,1.71,z,.56,.3,.47);
        for(const side of [-1,1])box(p,palette.woodLight,x+side*.26,1.9,z,.045,.1,.49);
        for(let j=0;j<4;j++)ball(p,i?palette.gold:palette.red,x-.16+(j%2)*.29,1.9,z-.1+Math.floor(j/2)*.2,.105);
      }
    }else if(id==='court'){
      for(let i=0;i<3;i++){cylinder(p,i%2?palette.blue:palette.white,-.65+i*.32,1.55,-2.48,.055,.22,8);cylinder(p,palette.navy,-.65+i*.32,1.68,-2.48,.036,.035,8);}
      box(p,palette.gold,.55,1.48,-2.48,.43,.045,.28,-.06);
    }else if(id==='harbor'){
      for(let i=0;i<3;i++){
        const coil=mesh(p,geo(new THREE.TorusGeometry(.15+i*.05,.025,5,14)),palette.cream,-.23,.72,5.1);
        coil.rotation.x=-Math.PI/2;
      }
      const rod=cylinder(p,palette.woodDark,.55,1.08,5.4,.025,1.4,6);rod.rotation.x=-.7;
      line(p,[[.55,1.6,4.95],[.55,1.48,6.06],[.55,.05,6.06]],'#d6dcc8');
      cylinder(p,palette.teal,-.3,.86,4.45,.18,.35,8);
    }
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

  const buildingFunctions = { lobby: office, lab: laboratory, meeting, hr: humanResources, finance, cafe, plaza, court, harbor, exile, hospital, police };
  const districtGround=['#bac994','#a6bfab','#c3bc9c','#c4c999','#b3c2ae','#c8bd99','#bdc89a','#9fbda4','#c8c4a0','#c2c5c7','#b9c9ba','#b9c4c9'];
  for (let index = 0; index < LAYOUT.length; index++) {
    const config = LAYOUT[index];
    const tile = group(scene, config.x, 0, config.z);
    tile.userData.district = config.id;
    tileGroups.set(config.id, tile);
    const bottom = cylinder(tile, palette.darkSand, 0, -.19, 0, 4.27, 1.02, 6); bottom.rotation.y = Math.PI / 6;
    const cliff = cylinder(tile, palette.sand, 0, .22, 0, 4.52, .98, 6); cliff.rotation.y = Math.PI / 6;
    const edge = cylinder(tile, palette.cream, 0, .73, 0, 4.62, .25, 6); edge.rotation.y = Math.PI / 6;
    const rim=cylinder(tile,mat(new THREE.Color(config.color).lerp(new THREE.Color('#f2e6ca'),.6).getStyle()),0,.79,0,4.64,.085,6);rim.rotation.y=Math.PI/6;
    const ground = cylinder(tile, mat(districtGround[index]), 0, .95, 0, 4.36, .2, 6); ground.rotation.y = Math.PI / 6;
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
    districtKeepsakes(tile,config.id);
    const treePositions = config.id === 'court' ? [[-2.9,-2.1],[2.8,-2.2],[3.25,.6]] : [[-2.9,-1.55],[2.65,-2],[-2.9,.1],[1.0,-3.1],[3.0,.85]];
    for (let i = 0; i < treePositions.length; i++) {
      const [x,z] = treePositions[i];
      const tx=x+(random()-.5)*.24;
      if(Object.values(CAST_POSITIONS).some(point=>Math.hypot(point.x-config.x-tx,point.z-config.z-z)<1.15))continue;
      tree(tile, tx, z, .65 + random()*.38, i % 3 === 0 ? 'pine' : 'round');
    }
    shrub(tile, -2.65, 2.45, .37); shrub(tile, 2.8, 2.3, .32);
    flowers(tile, -1.7, 3.1, index % 2 ? palette.gold : palette.pink);
    lamp(tile, -2.95, 1.5);
    for (let j = 0; j < 5; j++) {
      const a = .2 + j * 1.4;
      ball(tile, j % 2 ? palette.sand : palette.cream, Math.cos(a)*3.9, 1.09, Math.sin(a)*3.9, .11 + random()*.13, 1.4, .6, .8);
    }
    const campusPlaces=PLACES.filter(place=>place.districtId===config.id);
    for(const place of campusPlaces){
      const entrance=PLACE_ENTRANCES[place.id],number=`${String(dataById.get(config.id)?.number??index+1).padStart(2,'0')}.${campusPlaces.indexOf(place)+1}`;
      const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
      const context=canvas.getContext('2d');
      context.fillStyle='#fff4dd';context.beginPath();context.arc(128,128,122,0,Math.PI*2);context.fill();
      context.fillStyle=config.color;context.beginPath();context.arc(128,128,104,0,Math.PI*2);context.fill();
      context.fillStyle='#fff9ec';context.font='700 82px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(number,128,135,192);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.add(texture);
      const material=new THREE.MeshStandardMaterial({map:texture,transparent:true,roughness:1,depthWrite:false});materials.set(`entry-${place.id}`,material);
      const marker=mesh(tile,geo(new THREE.PlaneGeometry(.62,.62)),material,entrance.x-config.x,1.082,entrance.z-config.z);
      marker.rotation.x=-Math.PI/2;marker.castShadow=false;marker.userData.keepDynamic=true;marker.userData.place=place.id;placeRayTargets.push(marker);
      const button=document.createElement('button');button.type='button';button.className='map-place-label';button.dataset.place=place.id;
      button.style.pointerEvents='auto';button.style.display='none';button.setAttribute('aria-label',`探索${place.name}`);
      const badge=document.createElement('span');badge.className='map-place-number';badge.textContent=number;
      const name=document.createElement('span');name.className='map-place-name';name.textContent=place.name;button.append(badge,name);
      button.addEventListener('click',event=>{event.stopPropagation();if(!roaming||Math.hypot(entrance.x-playerPosition.x,entrance.z-playerPosition.z)<=.95)onSelectPlace(place.id);});
      overlay.append(button);placeLabels.push({id:place.id,districtId:place.districtId,element:button,position:new THREE.Vector3(entrance.x,1.55,entrance.z),entrance});
      interactionTargets.push({kind:'place',id:place.id,districtId:place.districtId,key:`place:${place.id}`,position:entrance,radius:.9,exitRadius:1.15});
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

  function makeFerryBoat(small=false) {
    const boat=group(scene);boat.visible=false;
    box(boat,palette.woodDark,0,.17,0,small?.76:1.4,.22,small?1.2:2.25);
    box(boat,palette.cream,0,.31,0,small?.62:1.18,.1,small?1.02:1.96);
    if(!small){box(boat,palette.white,0,.65,-.3,.85,.62,.85);box(boat,palette.teal,0,.99,-.3,1.04,.1,1.04);box(boat,palette.glass,0,.75,.135,.58,.25,.025);}
    return boat;
  }
  for(const port of Object.values(DOCKS)) {
    const dx=port.sea.x-port.position.x,dz=port.sea.z-port.position.z,length=Math.hypot(dx,dz),pier=group(scene,(port.position.x+port.sea.x)/2,.82,(port.position.z+port.sea.z)/2,Math.atan2(dx,dz));
    box(pier,palette.woodDark,0,0,0,1.1,.17,length);
    for(let i=0;i<Math.ceil(length/.28);i++)box(pier,palette.woodLight,0,.11,-length/2+(i+.5)*length/Math.ceil(length/.28),1.2,.08,.24);
    textSign(pier,port.name,0,1.2,-length/2+.4,2.3,.52);
    interactionTargets.push({kind:'dock',id:port.regionId,regionId:port.regionId,districtId:port.districtId,key:`dock:${port.regionId}`,position:port.position,radius:1.6,exitRadius:2});
  }
  const passengerBoat=makeFerryBoat();

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
    const leftLegRatio = Math.max(.25, Math.min(1, options.leftLegRatio || 1));
    for (const x of [-.07,.07]) {
      // Local +X is the person's own left when facing +Z. Shorten the visible
      // leg from its hip while keeping its sole at the same island floor.
      const legLength = .24 * (x > 0 ? leftLegRatio : 1);
      const leg = group(g, x, .05 + legLength, 0);
      cylinder(leg, options.trousers || palette.navy, 0, -legLength / 2 + .01, 0, .055, legLength, 6);
      box(leg, options.shoes || palette.cream, 0, -legLength - .005, .035, .11, .08, .18);
      if (options.sportShoes) box(leg, palette.white, 0, -legLength - .032, .038, .12, .025, .19);
      legs.push(leg);
      const arm = group(body, Math.sign(x)*.19, .57, 0);
      if (options.clothing === 'tee') {
        uniform.push(cylinder(arm, shirt, 0, -.045, 0, .05, .11, 6));
        cylinder(arm, skin, 0, -.15, 0, .041, .12, 6);
      } else uniform.push(cylinder(arm, shirt, 0, -.08, 0, .045, .19, 6));
      ball(arm, skin, 0, -.21, 0, .052);
      arms.push(arm);
    }
    const accessories=options.accessories||[options.accessory];
    if (leftLegRatio < 1) uniform.push(cylinder(body, shirt, .06, .245, 0, .095, .17, 7));
    if (accessories.includes('cane')) {
      cylinder(g, palette.woodDark, .25, .18, .08, .017, .34, 7);
      box(g, palette.woodDark, .215, .365, .08, .11, .035, .04);
      cylinder(g, palette.charcoal, .25, .015, .08, .023, .025, 7);
    }
    if (accessories.includes('sport-emblem')) {
      const emblem = mat('#deb9ba');
      box(body, emblem, 0, .47, .145, .11, .016, .02);
      for (const x of [-.05, .05]) box(body, emblem, x, .47, .145, .022, .06, .022);
    }
    if(options.hairStyle==='long')ball(body,mat(options.hair||'#5c4337'),0,.69,-.09,.15,1,1.3,.65);
    if(accessories.includes('bag')) box(body,palette.wood,.25,.28,0,.17,.22,.08);
    if(accessories.includes('coffee')) { cylinder(body,palette.cream,.22,.39,.12,.055,.15,8); cylinder(body,palette.woodDark,.22,.47,.12,.046,.012,8); }
    if(accessories.includes('clipboard')) box(body,palette.cream,.22,.4,.06,.16,.24,.035,-.2);
    if(accessories.includes('glasses')) { box(body,palette.navy,0,.79,.15,.25,.065,.025); box(body,palette.gold,0,.8,.17,.027,.025,.02); }
    if(accessories.includes('cap')) { cylinder(body,palette.white,0,.9,0,.16,.12,10); box(body,palette.white,0,.86,.14,.24,.025,.16); }
    if(accessories.includes('gamepad')){box(body,palette.navy,0,.43,.22,.31,.13,.08);ball(body,palette.brick,.09,.46,.27,.025);box(body,palette.cream,-.08,.46,.27,.07,.025,.02);}
    if(accessories.includes('ribbon')){ball(body,palette.pink,.13,.86,.05,.065,1,.5,.6);ball(body,palette.pink,.21,.86,.05,.065,1,.5,.6);}
    if(options.player) {
      // A bright hiking jacket, brimmed hat and red pack identify the visitor.
      cylinder(body,palette.cream,0,.94,-.005,.16,.14,10);
      cylinder(body,palette.cream,0,.87,.015,.215,.035,12);
      box(body,palette.brick,0,.47,-.17,.23,.3,.13);
      for(const x of [-.095,.095]) box(body,palette.brick,x,.5,.12,.026,.29,.035);
      box(body,palette.white,0,.53,.15,.09,.1,.018);
    }
    const person = { object:g, body, uniform, legs, arms, leftLegRatio, hasCane:accessories.includes('cane'), tile, phase:index*1.74, speed:.07+random()*.035, radius:2.65+random()*.15, index };
    if(!options.player) people.push(person);
    return person;
  }
  const wingLook = getIslandCharacterLook('wing'), jackLook = getIslandCharacterLook('jack');
  const colleagueLooks = {
    wing:{shirt:mat(wingLook.shirt),accessories:wingLook.accessories,hair:wingLook.hair,leftLegRatio:wingLook.leftLegRatio},
    spencer:{shirt:palette.charcoal,accessory:'glasses',hair:'#b7b0a3'},
    rick:{shirt:palette.red,accessory:'cap',hair:'#4c403b'},
    jack:{shirt:mat(jackLook.shirt),accessories:jackLook.accessories,hair:jackLook.hair,trousers:mat(jackLook.trousers),shoes:mat('#e6e9e1'),sportShoes:true,clothing:'tee'},
    sam:{shirt:palette.blue,accessory:'bag',hair:'#3c4746'},
    professor:{shirt:palette.cream,accessories:['clipboard','glasses'],hair:'#c1b6a0'},
    princess:{shirt:palette.lilac,accessories:['coffee','ribbon'],hair:'#6d4838',hairStyle:'long'},
    meimei:{shirt:palette.brick,accessory:'clipboard',hair:'#574032'},
    helen:{shirt:palette.lilac,accessory:'glasses',hair:'#49382f',hairStyle:'long'},
    joyce:{shirt:palette.gold,accessory:'glasses',hair:'#483a32'},
    hester:{shirt:palette.brick,accessory:'bag',hair:'#543c32',hairStyle:'long'},
    hope:{shirt:palette.lilac,accessory:'clipboard',hair:'#5d4337'},
    jenjen:{shirt:palette.lilac,accessory:'bag',hair:'#79543e',hairStyle:'long'},
    zoe:{shirt:palette.teal,accessories:['clipboard','cap'],hair:'#59473b'},
    janet:{shirt:palette.blue,accessory:'bag',hair:'#6c5142'},
    sophie:{shirt:palette.brick,accessory:'clipboard',hair:'#704736',hairStyle:'long'},
    erich:{shirt:palette.navy,accessories:['clipboard','glasses'],hair:'#9e9b91'},
    jonathan:{shirt:palette.white,accessory:'coffee',hair:'#3d4142'},
    annie_yu:{shirt:palette.pink,accessory:'bag',hair:'#493c34',hairStyle:'long'},
    alice:{shirt:palette.pink,accessory:'gamepad',hair:'#463b37',hairStyle:'long'},
    captain:{shirt:palette.pink,accessory:'cap',hair:'#624438'},
    simon:{shirt:palette.cream,accessories:['cap','clipboard'],hair:'#815a42'},
    action:{shirt:palette.navy,accessory:'bag',hair:'#aaa495'},
    owen:{shirt:palette.navy,accessory:'glasses',hair:'#3d4142'},
    sonny:{shirt:palette.teal,accessory:'coffee',hair:'#3b4242'},
    kind:{shirt:palette.brick,accessory:'coffee',hair:'#784b39'},
    cindy:{shirt:palette.gold,accessory:'clipboard',hair:'#73503f'},
    james:{shirt:palette.blue,accessory:'coffee',hair:'#74604e'},
    johnny:{shirt:palette.gold,accessory:'bag',hair:'#424243'},
    wine:{shirt:palette.blue,accessories:['cap','clipboard'],hair:'#4a413d'},
    peter:{shirt:palette.navy,accessories:['cap','bag'],hair:'#4d4035'},
    tony:{shirt:palette.brick,accessories:['coffee','glasses'],hair:'#3c4141'},
    henry:{shirt:palette.lilac,accessories:['clipboard','glasses'],hair:'#795c44'},
    mia:{shirt:palette.pink,accessory:'glasses',hair:'#493b34',hairStyle:'long'},
  };
  ISLAND_CAST.forEach(({id,districtId},index) => {
    const config=LAYOUT.find(district=>district.id===districtId);
    const person = makePerson(index,config,colleagueLooks[id]);
    person.id=id;person.home=CAST_POSITIONS[id];person.walkDistance=0;
    person.object.scale.setScalar(1.18);
    person.object.position.set(person.home.x,person.home.y,person.home.z);
    person.object.rotation.y=-.25;
    const label=document.createElement('div');label.className='map-npc-label';label.textContent=displayPersona(id).name;label.setAttribute('aria-hidden','true');label.style.pointerEvents='none';label.style.display='none';overlay.append(label);
    person.label=label;colleagues.push(person);actorsByKey.set(`person:${id}`,person);
    person.target={kind:'person',id,districtId,key:`person:${id}`,position:person.home,radius:1.4};
    interactionTargets.push(person.target);
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
    const placeHit=raycaster.intersectObjects(placeRayTargets,false)[0];
    if(placeHit){const id=placeHit.object.userData.place,point=PLACE_ENTRANCES[id];if(!roaming||Math.hypot(point.x-playerPosition.x,point.z-playerPosition.z)<=.95){onSelectPlace(id);return;}}
    const hit=raycaster.intersectObjects(rayTargets,false).find((item)=>item.object.userData.district);
    if(hit && (!roaming || nearby?.districtId===hit.object.userData.district))onSelect(hit.object.userData.district);
  };
  renderer.domElement.addEventListener('pointerdown',onPointerDown);
  renderer.domElement.addEventListener('pointerup',onPointerUp);
  renderer.domElement.addEventListener('pointercancel',()=>{pointerDown=null;});
  const onContextLost=(event)=>{
    event.preventDefault();
    endVoyage(false);contextLost=true;cancelAnimationFrame(frameId);
    container.dispatchEvent(new CustomEvent('island-context-lost',{bubbles:true}));
  };
  renderer.domElement.addEventListener('webglcontextlost',onContextLost);

  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let paused=reducedMotion.matches,destroyed=false,contextLost=false,topView=false,width=1,height=1,frameId=0;
  let elapsed=0,lastTime=performance.now(),transition=null,needsRender=true,renderedOnce=false;
  const onMotionPreference=()=>{needsRender=true;};
  reducedMotion.addEventListener('change',onMotionPreference);
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
    baseView=aspect<.8?30:aspect<1.1?25:22.8;
    camera.left=-baseView*aspect;camera.right=baseView*aspect;camera.top=baseView;camera.bottom=-baseView;
    // On tall screens keep the entire archipelago within the horizontal frame.
    if(aspect<.8){camera.left=-23.8;camera.right=23.8;camera.top=23.8/aspect;camera.bottom=-23.8/aspect;}
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
    const targets=interactionTargets.filter(target=>getRegionForDistrict(target.districtId)===currentRegion&&!['sailing','boarding'].includes(actorsByKey.get(target.key)?.lifeState));
    const next=roaming&&!voyage?nearestInteraction(playerPosition,targets,nearby?.key):null;
    const previous=nearby;nearby=next;
    if(next?.key!==previous?.key || next&&previous&&next!==previous){needsRender=true;onNearby(next);}
    return nearby;
  }
  function setResidents(input) {
    if(destroyed)return [];
    const residents=normalizeResidents({version:1,residents:input});
    // Keep one reusable model per physical slot. Repeated refreshes or changed
    // approvals never accumulate detached geometry, materials or label nodes.
    for(const actor of residentActors.values()) {actorsByKey.delete(`resident:${actor.id}`);actor.object.visible=false;actor.id=null;actor.target=null;actor.label.textContent='';actor.label.style.display='none';}
    for(let i=interactionTargets.length-1;i>=0;i--)if(interactionTargets[i].kind==='resident')interactionTargets.splice(i,1);
    for(const resident of residents) {
      const slotKey=`${resident.districtId}:${resident.slot}`;
      let actor=residentActors.get(slotKey);
      const tile=LAYOUT.find(d=>d.id===resident.districtId);
      if(!actor) {
        actor=makePerson(200+residentActors.size,tile,{shirt:palette.teal,accessory:['coffee','bag','cap'][resident.slot],skin:['#e9b48c','#cc936e','#a77256'][resident.slot],hair:['#5c4337','#39494c','#7b5844'][resident.slot]});
        actor.resident=true;actor.home=RESIDENT_POSITIONS[resident.districtId][resident.slot];actor.walkDistance=0;
        actor.object.scale.setScalar(1.18);
        actor.object.position.set(actor.home.x,WALK_HEIGHT,actor.home.z);
        actor.object.rotation.y=.35;
        const label=document.createElement('div');label.className='map-npc-label map-resident-label';label.setAttribute('aria-hidden','true');label.style.pointerEvents='none';label.style.display='none';overlay.append(label);actor.label=label;
        residentActors.set(slotKey,actor);
      }
      const outfit=OUTFITS.find(item=>item.id===resident.outfit);
      for(const part of actor.uniform)part.material=mat(outfit.color);
      actor.id=resident.id;actor.label.textContent=resident.nickname;actor.object.visible=true;
      actor.target={kind:'resident',id:resident.id,districtId:resident.districtId,key:`resident:${resident.id}`,position:actor.home,radius:1.15,exitRadius:1.4};
      interactionTargets.push(actor.target);actorsByKey.set(actor.target.key,actor);
    }
    npcLife.setResidents(residents);
    updateNpcLife(0);
    ensurePlayerSpace();
    needsRender=true;updateNearby();
    return residents;
  }
  function ensurePlayerSpace() {
    // Arrivals or walkers in overview mode may occupy the saved visitor spot.
    // Relocate only when needed, choosing the nearest collision-free ground.
    if(!isWalkable(playerPosition,PLAYER_RADIUS,characterObstacles,dynamicNavigation)) {
      let free=null;
      for(let radius=.12;radius<=4&&!free;radius+=.12)for(let i=0;i<48;i++) {
        const angle=i/48*Math.PI*2,point={x:playerPosition.x+Math.cos(angle)*radius,z:playerPosition.z+Math.sin(angle)*radius};
        if(isWalkable(point,PLAYER_RADIUS,characterObstacles,dynamicNavigation)){free=point;break;}
      }
      if(!free)free=[DOCKS[currentRegion].landing,...LAYOUT.filter(row=>getRegionForDistrict(row.id)===currentRegion).map(row=>DISTRICT_ENTRANCES[row.id])].find(point=>isWalkable(point,PLAYER_RADIUS,characterObstacles,dynamicNavigation));
      if(free)playerPosition={x:free.x,z:free.z};
      player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);
      playerRing.position.set(playerPosition.x,WALK_HEIGHT+.018,playerPosition.z);
    }
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
    if(voyage)return false;
    const next=Boolean(value);if(next===roaming)return;
    roaming=next;moveInput={x:0,z:0};standStill();needsRender=true;resize();
    renderer.domElement.setAttribute('aria-label',next?'移動島散步地圖。以 W A S D、方向鍵或畫面方向按鈕移動，靠近入口或同事後按 E 或空白鍵互動。可拖曳旋轉、捲動縮放，Home 回到全島。':'移動島互動立體地圖，可拖曳旋轉、捲動縮放，或用地點按鈕探索。');
    player.object.visible=next;playerRing.visible=next;
    playerMarker.style.display=next?'':'none';
    controls.enablePan=!next;
    if(next){
      movementEnabled=true;
      updateNpcLife(0);ensurePlayerSpace();
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
  function sendPlayerToPlace(placeId) {
    if (destroyed || contextLost || voyage || getRegionForDistrict(PLACES.find(place=>place.id===placeId)?.districtId)!==currentRegion) return false;
    const landing=findPlaceLanding(placeId,characterObstacles,dynamicNavigation);
    if (!landing) return false;
    playerPosition=landing;moveInput={x:0,z:0};nearby=null;focusedPerson=null;
    setRoaming(true);standStill();
    player.object.position.set(landing.x,WALK_HEIGHT,landing.z);
    playerRing.position.set(landing.x,WALK_HEIGHT+.018,landing.z);
    moveCamera(getFollowTarget().clone(),window.innerWidth<=780?3.15:2.65,homeOffset);
    updateNearby();needsRender=true;
    return true;
  }
  function setDispositions(rows) {
    if(destroyed || contextLost) return [];
    npcLife.setDispositions(rows);lastLifePublished=-Infinity;updateNpcLife(0);updateNearby();needsRender=true;
    return lifeSnapshot.map(actor=>({...actor,position:{...actor.position}}));
  }
  function resetView() {
    if(voyage)return false;
    if(roaming)setRoaming(false);
    focusedDistrict=null;focusedPerson=null;
    for(const item of labelItems)item.element.setAttribute('aria-pressed','false');
    selectRing.visible=false;topView=false;moveCamera(homeTarget,1,homeOffset);
  }
  function updateWalking(dt) {
    if(!roaming||voyage)return;
    const beforeX=playerPosition.x,beforeZ=playerPosition.z;
    if(movementEnabled&&(moveInput.x||moveInput.z)){
      camera.updateMatrixWorld();
      cameraRight.setFromMatrixColumn(camera.matrixWorld,0);cameraRight.y=0;cameraRight.normalize();
      cameraDown.subVectors(camera.position,controls.target);cameraDown.y=0;
      if(cameraDown.lengthSq()<.0001)cameraDown.set(-cameraRight.z,0,cameraRight.x);
      else cameraDown.normalize();
      const worldInput={x:cameraRight.x*moveInput.x+cameraDown.x*moveInput.z,z:cameraRight.z*moveInput.x+cameraDown.z*moveInput.z};
      playerPosition=movePlayer(playerPosition,worldInput,dt,3.8,characterObstacles,dynamicNavigation);
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
  function updateNpcLife(dt) {
    if(contextLost)return;
    const still=paused||reducedMotion.matches||document.hidden;
    lifeSnapshot=npcLife.update(dt,{player:playerPosition,roaming,paused,reducedMotion:reducedMotion.matches,hidden:document.hidden});
    characterObstacles=npcLife.getObstacles();
    for(const state of lifeSnapshot){
      const actor=actorsByKey.get(state.key??`${state.kind}:${state.id}`);
      if(!actor||!actor.object.visible)continue;
      let boat=ferryBoats.get(state.key);
      if(state.ferry&&!boat){boat=makeFerryBoat(true);ferryBoats.set(state.key,boat);}
      if(boat){boat.visible=Boolean(state.ferry);if(state.ferry){boat.position.set(state.position.x,.05,state.position.z);boat.rotation.y=state.heading;needsRender=true;}}
      const moved=Math.hypot(actor.object.position.x-state.position.x,actor.object.position.z-state.position.z);
      if(moved>.00001||actor.lifeState!==state.state)needsRender=true;
      actor.object.position.set(state.position.x,state.position.y??WALK_HEIGHT,state.position.z);
      actor.target.position=state.position;actor.target.districtId=state.districtId;actor.lifeState=state.state;
      const difference=Math.atan2(Math.sin(state.heading-actor.object.rotation.y),Math.cos(state.heading-actor.object.rotation.y));
      if(Math.abs(difference)>.001){actor.object.rotation.y+=difference*(still||dt===0?1:Math.min(1,dt*9));needsRender=true;}
      actor.walkDistance+=moved;
      const stride=!still&&state.state==='walking'?Math.sin(actor.walkDistance*10+actor.phase)*.4:0;
      actor.legs[0].rotation.x=stride;actor.legs[1].rotation.x=-stride*(actor.leftLegRatio||1);
      actor.arms[0].rotation.x=-stride*.7;actor.arms[1].rotation.x=actor.hasCane?0:stride*.7;
      actor.body.position.y=still?0:state.state==='walking'?Math.abs(Math.sin(actor.walkDistance*10+actor.phase))*.022:Math.sin(elapsed*1.6+actor.phase)*.009;
      actor.arms[1].rotation.z=!actor.hasCane&&!still&&state.state==='greeting'?-.55+Math.sin(elapsed*4+actor.phase)*.09:0;
    }
    const now=performance.now();
    if(now-lastLifePublished>=1000){
      lastLifePublished=now;
      const actors=lifeSnapshot.map(actor=>Object.freeze({...actor,position:Object.freeze({...actor.position})}));
      onLifeUpdate(Object.freeze({actors:Object.freeze(actors)}));
    }
  }
  function setConversationTarget(target) {
    if(destroyed)return;
    npcLife.setConversationTarget(target);updateNpcLife(0);needsRender=true;updateNearby();
  }
  function positionOverlay(element,position,visible=true,avoidPlayer=false,placements=null) {
    const projected=position.clone().project(camera);
    visible=visible&&projected.z>-1&&projected.z<1&&projected.x>-1.1&&projected.x<1.1&&projected.y>-1.1&&projected.y<1.1;
    element.style.display=visible?'':'none';
    if(visible){
      let x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
      if(avoidPlayer){
        const playerLabel=new THREE.Vector3(playerPosition.x,WALK_HEIGHT+1.85,playerPosition.z).project(camera);
        const px=(playerLabel.x*.5+.5)*width,py=(-playerLabel.y*.5+.5)*height;
        if(Math.abs(x-px)<Math.min(110,element.textContent.length*5+30)&&Math.abs(y-py)<30)y=py-36;
      }
      if(placements){
        const halfWidth=(element.offsetWidth||element.textContent.length*12+20)/2;
        x=THREE.MathUtils.clamp(x,halfWidth+8,Math.max(halfWidth+8,width-halfWidth-8));
        const offset=[0,-28,28,-56,56,-84,84].find(offset=>{
          const top=y+offset-13,bottom=y+offset+13;
          return top>4&&bottom<height-4&&!placements.some(rect=>x+halfWidth+3>rect.left&&x-halfWidth-3<rect.right&&bottom>rect.top&&top<rect.bottom);
        });
        if(offset===undefined){element.style.display='none';return;}
        y+=offset;placements.push({left:x-halfWidth,right:x+halfWidth,top:y-13,bottom:y+13});
      }
      element.style.transform=`translate(${x}px, ${y}px) translate(-50%, -50%)`;
    }
  }
  function setHour(hour){
    const value=Number(hour);
    if(!Number.isFinite(value))return;
    needsRender=true;
    const h=((value%24)+24)%24;
    npcLife.setHour(h);lastLifePublished=-Infinity;
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
  function focusRegion(regionId) {
    if(destroyed||contextLost||voyage||regionId!==currentRegion||!Object.hasOwn(REGIONS,regionId))return false;
    const region=REGIONS[regionId];homeTarget.set(region.center.x,1,region.center.z);
    focusedDistrict=null;focusedPerson=null;selectRing.visible=false;
    moveCamera(homeTarget,regionId==='exile'?2.15:regionId==='life'?1.35:1,homeOffset);return true;
  }
  function endVoyage(success) {
    const trip=voyage;if(!trip)return;voyage=null;passengerBoat.visible=false;
    if(success){currentRegion=trip.to;const region=REGIONS[currentRegion];homeTarget.set(region.center.x,1,region.center.z);playerPosition={...DOCKS[currentRegion].landing};ensurePlayerSpace();}
    player.object.visible=roaming;playerRing.visible=roaming;playerMarker.style.display=roaming?'':'none';
    player.object.position.set(playerPosition.x,WALK_HEIGHT,playerPosition.z);playerRing.position.set(playerPosition.x,WALK_HEIGHT+.018,playerPosition.z);
    if(success){if(roaming)moveCamera(getFollowTarget().clone(),window.innerWidth<=780?3.15:2.65,homeOffset);else focusRegion(currentRegion);try{trip.onProgress?.(1);}catch{}}
    needsRender=true;updateNearby();trip.resolve(success);
  }
  function sailToRegion(regionId,{onProgress}={}) {
    if(destroyed||contextLost||voyage||!Object.hasOwn(REGIONS,regionId))return Promise.resolve(false);
    if(regionId===currentRegion){try{onProgress?.(1);}catch{}return Promise.resolve(true);}
    const points=getFerryRoute(currentRegion,regionId);moveInput={x:0,z:0};standStill();transition=null;nearby=null;onNearby(null);
    return new Promise(resolve=>{
      voyage={from:currentRegion,to:regionId,points,length:ferryRouteLength(points),start:performance.now(),onProgress,resolve};
      player.object.visible=false;playerRing.visible=false;playerMarker.style.display='none';passengerBoat.visible=true;needsRender=true;
      try{onProgress?.(0);}catch{}
      if(reducedMotion.matches)endVoyage(true);
    });
  }
  function updateVoyage(time) {
    if(!voyage)return;
    const progress=Math.min(1,Math.max(0,(time-voyage.start)/(PLAYER_SAIL_SECONDS*1000))),point=ferryPoint(voyage.points,voyage.length*progress);
    passengerBoat.position.set(point.x,.05,point.z);passengerBoat.rotation.y=point.heading;
    const target=new THREE.Vector3(point.x,1,point.z);controls.target.copy(target);camera.position.copy(target).add(homeOffset);
    camera.zoom=1.3;camera.updateProjectionMatrix();needsRender=true;
    try{voyage.onProgress?.(progress);}catch{}
    if(progress===1)endVoyage(true);
  }
  function animate(time){
    if(destroyed||contextLost)return;
    frameId=requestAnimationFrame(animate);
    const dt=Math.min((time-lastTime)/1000,.06);lastTime=time;
    if(document.hidden)return;
    const ambientPaused=paused||reducedMotion.matches;
    if(!ambientPaused)elapsed+=dt;
    if(!ambientPaused||!renderedOnce){
    waterUniforms.uTime.value=elapsed;
    for(const item of moving){
      if(item.type==='boat'){
        item.object.position.y=.08+Math.sin(elapsed*1.2+item.phase)*.045;item.object.rotation.z=Math.sin(elapsed*.8+item.phase)*.025;
        if(!item.anchored){item.object.position.x=item.x+Math.sin(elapsed*.045+item.phase)*2;item.object.position.z=item.z+Math.cos(elapsed*.045+item.phase)*1.5;item.object.rotation.y=elapsed*.045+item.phase+.7;}
      }else{const a=elapsed*.07+item.phase;item.object.position.set(Math.cos(a)*item.radius,6.7+Math.sin(a*2)*.5,Math.sin(a)*item.radius);item.object.rotation.y=-a;}
    }
    if(connectionGroup.visible)for(const item of connectionDots)item.dot.position.copy(item.curve.getPoint((elapsed*.12+item.offset)%1));
    }
    updateWalking(dt);
    updateNpcLife(dt);updateVoyage(time);updateNearby();
    if(transition){
      const linear=Math.min(1,(time-transition.start)/850);const t=1-Math.pow(1-linear,3);
      controls.target.lerpVectors(transition.targetFrom,transition.targetTo,t);camera.position.lerpVectors(transition.positionFrom,transition.positionTo,t);camera.zoom=THREE.MathUtils.lerp(transition.zoomFrom,transition.zoomTo,t);camera.updateProjectionMatrix();
      if(linear===1)transition=null;
    }
    const controlsChanged=controls.update();
    if(ambientPaused&&!needsRender&&!controlsChanged&&!transition)return;
    camera.updateMatrixWorld();
    for(const item of labelItems){
      const v=item.position.clone().project(camera);
      const closeEnough=!roaming&&!voyage&&getRegionForDistrict(item.id)===currentRegion&&focusedDistrict!==item.id;
      const visible=closeEnough&&v.z>-1&&v.z<1&&v.x> -1.15&&v.x<1.15&&v.y> -1.1&&v.y<1.1;
      item.element.disabled=roaming&&!(nearby?.kind==='building'&&nearby.districtId===item.id);
      item.element.style.display=visible?'':'none';
      if(visible)item.element.style.transform=`translate(${(v.x*.5+.5)*width}px, ${(-v.y*.5+.5)*height}px) translate(-50%, -50%)`;
    }
    const entryPlacements=[];
    if(roaming){
      const markerPosition=new THREE.Vector3(playerPosition.x,WALK_HEIGHT+1.85,playerPosition.z);
      positionOverlay(playerMarker,markerPosition);
      const marker=markerPosition.clone().project(camera),markerX=(marker.x*.5+.5)*width,markerY=(-marker.y*.5+.5)*height;
      const placements=entryPlacements;placements.push({left:markerX-18,right:markerX+18,top:markerY-18,bottom:markerY+18});
      const distanceToPlayer=person=>Math.hypot(person.object.position.x-playerPosition.x,person.object.position.z-playerPosition.z);
      const namedPeople=people.filter(person=>person.label&&person.object.visible).sort((a,b)=>distanceToPlayer(a)-distanceToPlayer(b));
      for(const colleague of namedPeople)positionOverlay(colleague.label,new THREE.Vector3(colleague.object.position.x,colleague.object.position.y+1.52,colleague.object.position.z),distanceToPlayer(colleague)<3.8,true,placements);
    }
    if(!roaming)for(const person of colleagues)positionOverlay(person.label,new THREE.Vector3(person.object.position.x,person.object.position.y+1.52,person.object.position.z),person.id===focusedPerson);
    for(const item of placeLabels){
      const distance=Math.hypot(item.entrance.x-playerPosition.x,item.entrance.z-playerPosition.z);
      item.element.disabled=roaming&&distance>.95;
      item.element.classList.toggle('is-nearby',nearby?.kind==='place'&&nearby.id===item.id);
      positionOverlay(item.element,item.position,roaming?distance<3.4:focusedDistrict===item.districtId,roaming,entryPlacements);
    }
    renderer.render(scene,camera);
    renderedOnce=true;needsRender=false;
  }
  setHour(initialHour);
  animate(performance.now());
  // A completed first render lets the caller dismiss its loading state.
  onReady({ reducedMotion:reducedMotion.matches });
  return {
    focus(id){
      if(roaming||voyage||getRegionForDistrict(id)!==currentRegion)return false;
      const config=LAYOUT.find((d)=>d.id===id);if(!config)return;
      focusedDistrict=id;focusedPerson=null;
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
    focusPlace(id){
      const place=PLACES.find(place=>place.id===id);if(!place||roaming||voyage||getRegionForDistrict(place.districtId)!==currentRegion)return false;
      focusedDistrict=place.districtId;focusedPerson=null;
      const config=LAYOUT.find(district=>district.id===place.districtId),isMobile=window.innerWidth<=780,zoom=isMobile?2.2:1.8;
      const target=new THREE.Vector3(config.x,1.5,config.z);
      if(isMobile){const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);target.addScaledVector(up,-(camera.top-camera.bottom)/zoom*.28);}
      for(const item of labelItems)item.element.setAttribute('aria-pressed',String(item.id===place.districtId));
      for(const item of placeLabels)item.element.setAttribute('aria-pressed',String(item.id===id));
      selectRing.position.set(config.x,1.08,config.z);selectRing.visible=true;moveCamera(target,zoom);
    },
    focusPerson(id){
      const actor=actorsByKey.get(`person:${id}`);if(!actor||roaming||voyage||actor.lifeState==='sailing'||getRegionForDistrict(actor.target.districtId)!==currentRegion)return false;
      focusedPerson=id;focusedDistrict=actor.target.districtId;
      const target=new THREE.Vector3(actor.object.position.x,1.5,actor.object.position.z),isMobile=window.innerWidth<=780,zoom=isMobile?2.2:1.8;
      if(isMobile){const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);target.addScaledVector(up,-(camera.top-camera.bottom)/zoom*.28);}
      moveCamera(target,zoom);needsRender=true;
    },
    focusRegion, sailToRegion,
    getRegion:()=>currentRegion,
    getPlayerPosition:()=>({...playerPosition}),
    reset:resetView,
    setRoaming,
    setMoveInput,
    setMovementEnabled,
    setResidents,
    setDispositions,
    sendPlayerToPlace,
    setConversationTarget,
    interactNearby(){return updateNearby();},
    setHour,
    setConnections(value){connectionGroup.visible=Boolean(value);needsRender=true;for(const item of connectionDots)item.dot.position.copy(item.curve.getPoint((elapsed*.12+item.offset)%1));},
    setPaused(value){paused=Boolean(value);needsRender=true;},
    setTopView(value){topView=Boolean(value);moveCamera(controls.target.clone(),camera.zoom,topView?new THREE.Vector3(0,65,.1):homeOffset);},
    zoom(delta){const value=Number(delta);if(!Number.isFinite(value))return;transition=null;needsRender=true;camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(value*.17),controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();},
    destroy(){if(destroyed)return;endVoyage(false);destroyed=true;cancelAnimationFrame(frameId);resizeObserver.disconnect();reducedMotion.removeEventListener('change',onMotionPreference);controls.dispose();renderer.domElement.removeEventListener('pointerdown',onPointerDown);renderer.domElement.removeEventListener('pointerup',onPointerUp);renderer.domElement.removeEventListener('keydown',onKeyDown);renderer.domElement.removeEventListener('webglcontextlost',onContextLost);for(const g of allGeometries)g.dispose();for(const m of materials.values())m.dispose();for(const t of textures)t.dispose();renderer.dispose();renderer.domElement.remove();overlay.remove();},
  };
}
