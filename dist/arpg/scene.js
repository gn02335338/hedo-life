import * as THREE from '../island/vendor/three.module.js';
import { WORLD, BOSS_PROFILES } from './content.js';
import { createArtLayer } from './art-layer.js';
import { createCombatVisuals } from './combat-visuals.js';

// The ground projection of the real camera basis. A screen-up joystick must
// travel vertically on screen rather than drifting with an assumed 45° view.
export function movementToWorld(x, z) {
  const scale = Math.hypot(17, 22);
  return { x: (x * 22 + z * 17) / scale, z: (z * 22 - x * 17) / scale };
}

// Original textured 3D architecture with directional pre-rendered character art.
// The renderer only reads simulation snapshots.
export function createScene({ container } = {}) {
  if (!container) throw new Error('找不到地城畫面。');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    throw new Error('這台裝置無法啟動 3D 地城。請開啟硬體加速，或使用支援 WebGL 的瀏覽器。');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '禾多暗黑：斜俯視辦公地城');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0c0d0e');
  scene.fog = new THREE.Fog('#171614', 28, 84);
  const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 180);
  const cameraTarget = new THREE.Vector3(0, 0, -12);
  const lookTarget = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3(17, 25, 22);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  const inverseActorRotation = new THREE.Quaternion();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const batches = new Map();
  const actors = new Map();
  const loot = new Map();
  const warnings = new Map();
  const missiles = new Map();
  const particles = new Map();
  const flames = [];
  const rotating = [];
  const gates = new Map();
  const bossLabels = new Map();
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let destroyed = false;
  let time = 0;
  let viewSize = 43;
  let width = 1;
  let height = 1;
  let lastStatus = null;
  let playerModel = null;
  let contextLost = false;

  const geo = geometry => { geometries.add(geometry); return geometry; };
  const material = (tint, options = {}) => {
    const result = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.86, ...options });
    materials.add(result); return result;
  };
  const basic = (tint, options = {}) => {
    const result = new THREE.MeshBasicMaterial({ color: tint, ...options });
    materials.add(result); return result;
  };
  const G = {
    box: geo(new THREE.BoxGeometry(1, 1, 1)),
    sphere: geo(new THREE.IcosahedronGeometry(1, 1)),
    ball: geo(new THREE.SphereGeometry(1, 10, 6)),
    cylinder: geo(new THREE.CylinderGeometry(1, 1, 1, 10)),
    cone: geo(new THREE.ConeGeometry(1, 1, 7)),
    ring: geo(new THREE.RingGeometry(0.965, 1, 72)),
    disc: geo(new THREE.CircleGeometry(1, 40)),
    plane: geo(new THREE.PlaneGeometry(1, 1)),
    torus: geo(new THREE.TorusGeometry(1, 0.055, 5, 36)),
  };
  const M = {
    floor: material('#303a40'), stone: material('#272d32'), stone2: material('#3a4145'),
    black: material('#151b20'), iron: material('#4b555a', { metalness: 0.7, roughness: 0.4 }),
    bronze: material('#8c6435', { metalness: 0.72, roughness: 0.37 }),
    gold: material('#dba850', { metalness: 0.7, roughness: 0.32 }),
    wood: material('#48332c'), red: material('#822d29'), paper: material('#c4bd9d'),
    ink: material('#343c4e'), skin: material('#d7a988'), hair: material('#1b252d'),
    shirt: material('#d5d6bf'), blue: material('#486a7e'), trousers: material('#2a3543'),
    teal: material('#487e78'), bone: material('#c5c3ab'), purple: material('#554466'),
    slime: material('#6ca58c', { roughness: 0.34, metalness: 0.18 }),
    slimeDark: material('#315d54', { roughness: 0.44 }),
    tan: material('#946b4c'), pink: material('#d02b72'), blush: material('#e6b0ba'),
    brownHair: material('#50332f'), ivory: material('#ece3d0'), wax: material('#c6b393'),
    blueMagic: basic('#8fabe9', { transparent: true, opacity: 0.65, depthWrite: false, side: THREE.DoubleSide }),
    violetMagic: basic('#9c78d5', { transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }),
    gateOpen: basic('#85c5b3', { transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
    hot: material('#f0a05c', { emissive: '#e65115', emissiveIntensity: 2.7 }),
    ember: basic('#ffb862', { transparent: true, opacity: 0.85, depthWrite: false }),
    flame: basic('#ff5c26', { transparent: true, opacity: 0.55, depthWrite: false }),
    eye: basic('#ff7351'), blueEye: basic('#9de9ed'),
    playerRing: basic('#9ac6b7', { transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide }),
    shadow: basic('#000000', { transparent: true, opacity: 0.28, depthWrite: false }),
    healthBack: basic('#211c20'), health: basic('#a8322e'), healthPlayer: basic('#83bda6'),
    warning: basic('#e44935', { transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }),
    warningEdge: basic('#ff7652', { transparent: true, opacity: 0.76, depthWrite: false, side: THREE.DoubleSide }),
    rune: basic('#e1a657', { transparent: true, opacity: 0.33, depthWrite: false, side: THREE.DoubleSide }),
    halo: basic('#bd8b34', { transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  };

  const ambient = new THREE.HemisphereLight('#b6bfc4', '#242017', 0.9);
  scene.add(ambient);
  const key = new THREE.DirectionalLight('#b0bcc4', 2.05);
  key.position.set(-12, 27, 10); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -28; key.shadow.camera.right = 28;
  key.shadow.camera.top = 40; key.shadow.camera.bottom = -40;
  key.shadow.camera.near = 1; key.shadow.camera.far = 100;
  key.shadow.normalBias = 0.055;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#dba275', 0.75);
  rim.position.set(7, 10, -40); scene.add(rim);
  const artLayer = createArtLayer({ scene, camera, renderer, materials: M });
  const combatVisuals = createCombatVisuals({ scene, camera });

  // A single shared, locally drawn stone map adds surface detail without assets
  // or another material/draw call for each tile.
  const slate = document.createElement('canvas'); slate.width = slate.height = 256;
  const slateCtx = slate.getContext('2d');
  if (slateCtx) {
    slateCtx.fillStyle = '#596469'; slateCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1000; i++) {
      const grey = Math.floor(83 + hash(i + 812) * 55);
      slateCtx.fillStyle = `rgba(${grey},${grey + 6},${grey + 8},${0.04 + hash(i + 140) * 0.09})`;
      slateCtx.fillRect(hash(i + 50) * 256, hash(i + 60) * 256, 2 + hash(i + 70) * 25, 1 + hash(i + 80) * 10);
    }
    slateCtx.strokeStyle = '#798182'; slateCtx.lineWidth = 1;
    slateCtx.strokeRect(3.5, 3.5, 249, 249);
    slateCtx.strokeStyle = '#303a3e';
    for (let i = 0; i < 6; i++) {
      let x = hash(i + 210) * 256, y = hash(i + 230) * 256;
      slateCtx.beginPath(); slateCtx.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += (hash(i * 4 + j + 68) - 0.5) * 45; y += 13 + hash(i * 4 + j + 86) * 22; slateCtx.lineTo(x, y); }
      slateCtx.stroke();
    }
    const map = new THREE.CanvasTexture(slate); map.colorSpace = THREE.SRGBColorSpace; textures.add(map);
    M.floor.map = map; M.floor.bumpMap = map; M.floor.bumpScale = 0.055; M.floor.color.set('#a4adb0');
  }

  function part(parent, geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = !mat.transparent; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  function group(parent, x = 0, y = 0, z = 0) {
    const result = new THREE.Group(); result.position.set(x, y, z); parent.add(result); return result;
  }
  function batch(geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const batchKey = `${geometry.uuid}:${mat.uuid}`;
    if (!batches.has(batchKey)) batches.set(batchKey, { geometry, mat, matrices: [] });
    dummy.position.set(x, y, z); dummy.scale.set(sx, sy, sz); dummy.rotation.set(rx, ry, rz); dummy.updateMatrix();
    batches.get(batchKey).matrices.push(dummy.matrix.clone());
  }
  function plate(parent, mat, x, y, z, radius, inner = false) {
    return part(parent, inner ? G.ring : G.disc, mat, x, y, z, radius, radius, radius, -Math.PI / 2);
  }
  function hash(value) { const n = Math.sin(value * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); }
  function sign(text, subtitle, x, y, z, size = 3.7, tint = '#b9a17b', rotation = 0) {
    const surface = document.createElement('canvas'); surface.width = 512; surface.height = 128;
    const ctx = surface.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#10151a'; ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#65543b'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = tint; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '600 37px "Noto Sans TC", "PingFang TC", sans-serif'; ctx.fillText(text, 256, 49);
    ctx.fillStyle = '#6f7777'; ctx.font = '17px Georgia, serif'; ctx.fillText(subtitle, 256, 94);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = material('#ffffff', { map: texture, roughness: 0.9 });
    part(scene, G.box, M.bronze, x, y, z + 0.03, size + 0.12, size / 4 + 0.12, 0.09, 0, rotation);
    const mesh = part(scene, G.plane, mat, x, y, z + 0.087, size, size / 4, 1, 0, rotation);
    mesh.castShadow = false;
  }

  const rooms = WORLD.rooms;
  const corridors = WORLD.corridors || [{ x: 0, z: 5, width: 6, depth: 4 }, { x: 0, z: -8, width: 6, depth: 8 }, { x: 0, z: -23, width: 6, depth: 6 }];
  const rectangles = [...rooms, ...corridors];
  const inside = (x, z) => rectangles.some(r => Math.abs(x - r.x) < r.width / 2 + 0.001 && Math.abs(z - r.z) < r.depth / 2 + 0.001);
  const bounds = WORLD.bounds || { minX: -12, maxX: 12, minZ: -41, maxZ: 16 };
  const floorCells = [];
  for (let x = Math.floor(bounds.minX); x < bounds.maxX; x++) {
    for (let z = Math.floor(bounds.minZ); z < bounds.maxZ; z++) {
      if (!inside(x + 0.5, z + 0.5)) continue;
      floorCells.push({ x: x + 0.5, z: z + 0.5 });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (inside(x + 0.5 + dx, z + 0.5 + dz)) continue;
        const wallHeight = dz === -1 || dx === -1 ? 3.8 : 0.85;
        batch(G.box, M.stone, x + 0.5 + dx / 2, wallHeight / 2 - 0.1, z + 0.5 + dz / 2, dx ? 0.28 : 1.02, wallHeight, dz ? 0.28 : 1.02);
        batch(G.box, M.iron, x + 0.5 + dx / 2, wallHeight - 0.08, z + 0.5 + dz / 2, dx ? 0.32 : 1.02, 0.09, dz ? 0.32 : 1.02);
        batch(G.box, M.black, x + 0.5 + dx / 2, -0.7, z + 0.5 + dz / 2, dx ? 0.42 : 1.02, 1.2, dz ? 0.42 : 1.02);
      }
    }
  }
  // World-aligned UVs keep large stone slabs continuous across room/corridor
  // boundaries, instead of stamping a complete texture into every small tile.
  const floorPositions = [], floorNormals = [], floorUVs = [];
  for (const { x, z } of floorCells) {
    for (const [dx, dz] of [[-.5,-.5],[-.5,.5],[.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]) {
      floorPositions.push(x + dx, 0, z + dz); floorNormals.push(0, 1, 0);
      floorUVs.push((x + dx) / 5.5, (z + dz) / 5.5);
    }
  }
  const floorGeometry = geo(new THREE.BufferGeometry());
  floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floorPositions, 3));
  floorGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(floorNormals, 3));
  floorGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(floorUVs, 2));
  const floor = new THREE.Mesh(floorGeometry, M.floor); floor.receiveShadow = true; scene.add(floor);
  for (const r of rectangles) batch(G.box, M.black, r.x, -0.45, r.z, r.width, 0.65, r.depth);

  function pillar(x, z, tall = 3.8) {
    batch(G.box, M.stone, x, 0.18, z, 1.08, 0.36, 1.08);
    batch(G.cylinder, M.stone2, x, tall / 2, z, 0.36, tall, 0.36);
    batch(G.cylinder, M.bronze, x, 0.48, z, 0.42, 0.13, 0.42);
    batch(G.cylinder, M.bronze, x, tall - 0.38, z, 0.43, 0.12, 0.43);
    batch(G.box, M.stone2, x, tall - 0.18, z, 0.88, 0.3, 0.88);
    batch(G.cone, M.stone, x, tall + 0.34, z, 0.41, 0.72, 0.41);
  }
  for (const z of [4.5, -1.5, -5.3, -11.5, -16, -21.3, -27.5, -33, -39.4]) {
    pillar(-12.1, z, z < -23 ? 4.6 : 3.8);
    // The camera-facing parapet stays low enough to preserve combat visibility.
    pillar(12.1, z, 1.3);
  }
  const archShape = new THREE.Shape();
  archShape.moveTo(-3.65, 0); archShape.lineTo(-3.65, 3.2);
  archShape.quadraticCurveTo(-3.5, 4.4, 0, 5.7);
  archShape.quadraticCurveTo(3.5, 4.4, 3.65, 3.2); archShape.lineTo(3.65, 0);
  archShape.lineTo(3.02, 0); archShape.lineTo(3.02, 3.02);
  archShape.quadraticCurveTo(2.85, 3.85, 0, 4.95);
  archShape.quadraticCurveTo(-2.85, 3.85, -3.02, 3.02); archShape.lineTo(-3.02, 0);
  const archGeometry = geo(new THREE.ExtrudeGeometry(archShape, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, steps: 1, curveSegments: 10 }));
  function arch(z, tint = M.bronze) {
    part(scene, archGeometry, M.stone2, 0, 0, z - 0.3);
    for (const x of [-3.4, 3.4]) {
      batch(G.box, M.stone, x, 0.24, z, 0.95, 0.48, 1.05);
      batch(G.box, tint, x, 2.85, z, 0.7, 0.12, 0.82);
      batch(G.cone, M.stone2, x, 4.48, z, 0.3, 0.95, 0.3);
    }
    part(scene, G.box, tint, 0, 5.25, z + 0.37, 0.38, 0.62, 0.13, 0, 0, Math.PI / 4);
  }
  arch(-8); arch(-23, M.gold);
  sign('阿福・腕力試煉', 'THE UNDEFEATED ARM', -5.3, 2.5, -5.4, 4.2);
  sign('水蛇・話術迴廊', 'THE ROOM OF INFINITE PROMISES', -5.3, 2.5, -21.3, 4.3, '#b5afdf');
  sign('翅膀・大餅王座', 'THE PIE IS A LIE', 0, 3.25, -40.4, 5, '#d8ad67');

  function makeGate(spec) {
    const root = group(scene, spec.x || 0, 0, spec.z);
    const closed = group(root), opened = group(root);
    const glass = basic('#d65d49', { transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    part(closed, G.plane, glass, 0, 1.6, 0, spec.width || 6, 3.1, 1);
    for (let i = -3; i <= 3; i++) {
      part(closed, G.box, M.bronze, i * 0.82, 1.57, 0, 0.065, 3.1, 0.08);
      part(closed, G.cone, M.gold, i * 0.82, 3.2, 0, 0.12, 0.33, 0.12);
    }
    part(closed, G.box, M.iron, 0, 1.6, 0, 5.7, 0.11, 0.15);
    part(closed, G.torus, M.hot, 0, 1.65, 0.1, 0.43, 0.43, 0.43);
    part(closed, G.box, M.gold, 0, 1.57, 0.14, 0.23, 0.35, 0.09);
    for (let i = 0; i < 3; i++) {
      for (const side of [-1, 1]) part(opened, G.box, M.gateOpen, side * 0.2, 0.04, 1.4 - i * 0.8, 0.07, 0.04, 0.65, 0, side * -0.7);
    }
    opened.visible = false;
    return { root, closed, opened, glass };
  }
  for (const spec of [{ id: 'to-room-2', x: 0, z: -8, width: 6 }, { id: 'to-room-3', x: 0, z: -23, width: 6 }]) gates.set(spec.id, makeGate(spec));

  function brazier(x, z, index) {
    batch(G.box, M.black, x, 0.15, z, 0.85, 0.3, 0.85);
    batch(G.cylinder, M.iron, x, 0.75, z, 0.2, 1.1, 0.2);
    batch(G.cylinder, M.bronze, x, 1.35, z, 0.43, 0.25, 0.43);
    batch(G.sphere, M.hot, x, 1.5, z, 0.28, 0.2, 0.28);
    const flame = group(scene, x, 1.62, z);
    part(flame, G.cone, M.flame, 0, 0.2, 0, 0.32, 0.9, 0.32, 0, index);
    part(flame, G.cone, M.ember, 0, 0.08, 0, 0.17, 0.55, 0.17, 0, -index);
    const glow = plate(scene, basic('#df6c30', { transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending }), x, 0.028, z, 2.7);
    flames.push({ object: flame, glow, offset: index * 1.7 });
  }
  [[-4.8, 6.0], [4.8, 6.0], [-10.7, -3.4], [10.7, -3.4], [-10.7, -18.8], [10.7, -18.8], [-10.5, -36.5], [10.5, -36.5]].forEach(([x, z], i) => brazier(x, z, i));

  function paperStack(x, y, z, amount = 4) {
    for (let i = 0; i < amount; i++) batch(G.box, i % 3 ? M.paper : M.ink, x + (hash(i + x * 4) - 0.5) * 0.13, y + i * 0.055, z, 0.55, 0.044, 0.75, 0, (hash(i + z) - 0.5) * 0.24);
  }
  function candles(x, z, count = 3) {
    for (let i = 0; i < count; i++) {
      const dx = (i - (count - 1) / 2) * 0.21, h = 0.3 + hash(i + x) * 0.35;
      batch(G.cylinder, M.wax, x + dx, h / 2 + 0.03, z, 0.065, h, 0.065);
      batch(G.cone, M.ember, x + dx, h + 0.12, z, 0.042, 0.2, 0.042);
    }
  }
  [[-5.2, 5.6], [5.2, 5.6], [-10.7, -5.3], [10.7, -5.3], [-10.7, -11.1], [10.7, -20.8], [-10.4, -39.8], [10.4, -39.8]].forEach(([x, z]) => candles(x, z));
  function gear(parent, x, y, z, radius = 1, mat = M.bronze) {
    const g = group(parent, x, y, z);
    part(g, G.torus, mat, 0, 0, 0, radius, radius, radius);
    part(g, G.cylinder, M.iron, 0, 0, 0, radius * 0.22, radius * 0.18, radius * 0.22, Math.PI / 2);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      part(g, G.box, mat, Math.sin(a) * radius, Math.cos(a) * radius, 0, radius * 0.23, radius * 0.2, radius * 0.14, 0, 0, -a);
    }
    return g;
  }
  for (const obstacle of WORLD.obstacles || []) {
    const { x, z, width, depth } = obstacle;
    const kind = z > -8 ? 0 : z > -25 ? 1 : 2;
    artLayer.addScenery({ kind, x, z, width, depth, height: kind === 2 ? 5.4 : kind === 1 ? 4.5 : 3.8 });
  }
  for (const z of [-3.8, -17.5, -36.2]) artLayer.addScenery({ kind: 3, x: -11.7, z, width: 1.4, depth: 1.2, height: 5.8 });
  // The safe return circle and the executive's gold pie share a visual language.
  plate(scene, M.rune, 0, 0.015, 11, 2.2, true);
  const returnRing = plate(scene, M.playerRing, 0, 0.018, 11, 1.6, true);
  returnRing.material = basic('#78b4b1', { transparent: true, opacity: 0.3, depthWrite: false });
  plate(scene, M.rune, 0, 0.02, -34, 5.2, true);
  plate(scene, M.rune, 0, 0.02, -1, 3.8, true);
  plate(scene, M.violetMagic, 0, 0.02, -16.5, 4.4, true);
  // Inlaid room emblems identify the three trials without hiding the route.
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    batch(G.box, M.bronze, Math.sin(a) * 3.65, 0.032, -1 + Math.cos(a) * 3.65, 0.06, 0.025, 0.32, 0, a);
    batch(G.box, M.purple, Math.sin(a) * 4.25, 0.032, -16.5 + Math.cos(a) * 4.25, 0.08, 0.025, 0.38, 0, a);
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    batch(G.box, M.bronze, Math.sin(a) * 4.9, 0.035, -34 + Math.cos(a) * 4.9, 0.08, 0.04, 0.42, 0, a);
  }
  for (let i = 0; i < 52; i++) {
    const x = (hash(i + 52) - 0.5) * 21;
    const z = -38 + hash(i + 82) * 43;
    if (!inside(x, z) || (Math.abs(x) < 2 && z > 4)) continue;
    batch(G.box, i % 4 ? M.paper : M.red, x, 0.018, z, 0.2 + hash(i) * 0.22, 0.015, 0.32 + hash(i + 3) * 0.22, 0, hash(i + 8) * Math.PI);
  }
  for (let i = 0; i < 70; i++) {
    const z = -40 + hash(i + 400) * 55;
    const x = (i % 2 ? 1 : -1) * (10.7 + hash(i + 430) * 0.8);
    if (!inside(x, z)) continue;
    const size = 0.12 + hash(i + 461) * 0.24;
    batch(G.sphere, i % 3 ? M.stone : M.stone2, x, size * 0.25, z, size, size * 0.42, size * 0.85, hash(i), hash(i + 3), hash(i + 7));
  }
  for (const { geometry, mat, matrices } of batches.values()) {
    const instanced = new THREE.InstancedMesh(geometry, mat, matrices.length);
    matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
    instanced.castShadow = true; instanced.receiveShadow = true; instanced.instanceMatrix.needsUpdate = true; scene.add(instanced);
  }
  batches.clear();

  function healthBar(parent, boss = false, player = false) {
    const g = group(parent, 0, boss ? 4.15 : player ? 2.15 : 1.8, 0);
    const barWidth = boss ? 2.5 : player ? 0.9 : 0.85;
    part(g, G.plane, M.healthBack, 0, 0, 0, barWidth + 0.08, 0.13, 1);
    const bar = part(g, G.plane, player ? M.healthPlayer : M.health, 0, 0, 0.01, barWidth, 0.055, 1);
    bar.castShadow = false;
    return { group: g, bar, width: barWidth };
  }
  function keyboard(parent, x, y, z, scale = 1) {
    const g = group(parent, x, y, z);
    part(g, G.box, M.iron, 0, 0, 0, 0.52 * scale, 0.12 * scale, 1.35 * scale);
    part(g, G.box, M.black, 0, 0.072 * scale, 0, 0.46 * scale, 0.025 * scale, 1.25 * scale);
    for (let i = 0; i < 5; i++) part(g, G.box, M.paper, 0, 0.09 * scale, (i - 2) * 0.21 * scale, 0.35 * scale, 0.035 * scale, 0.1 * scale);
    part(g, G.box, M.bronze, 0, 0.09 * scale, 0.53 * scale, 0.32 * scale, 0.04 * scale, 0.14 * scale);
    return g;
  }
  function engineer() {
    const root = group(scene);
    const body = group(root);
    part(body, G.box, M.blue, 0, 0.98, 0, 0.57, 0.66, 0.32);
    part(body, G.box, M.shirt, 0, 1.09, -0.18, 0.17, 0.42, 0.035);
    part(body, G.box, M.bronze, 0.12, 1.13, -0.21, 0.13, 0.18, 0.025);
    part(body, G.sphere, M.skin, 0, 1.56, 0, 0.23, 0.27, 0.23);
    part(body, G.sphere, M.hair, 0, 1.73, 0.035, 0.245, 0.15, 0.24);
    part(body, G.box, M.black, 0, 1.59, -0.22, 0.42, 0.07, 0.035);
    part(body, G.box, M.blueEye, 0, 1.59, -0.243, 0.28, 0.025, 0.015);
    const legs = [-1, 1].map(side => {
      const leg = group(root, side * 0.15, 0.7, 0);
      part(leg, G.box, M.trousers, 0, -0.27, 0, 0.22, 0.61, 0.25);
      part(leg, G.box, M.black, 0, -0.58, -0.06, 0.25, 0.16, 0.38);
      return leg;
    });
    const arm = group(body, 0.4, 1.23, 0);
    part(arm, G.box, M.blue, 0, -0.16, 0, 0.22, 0.42, 0.27);
    part(arm, G.sphere, M.skin, 0, -0.43, 0, 0.12, 0.13, 0.12);
    const weapon = keyboard(arm, 0, -0.39, -0.45, 1.03);
    weapon.rotation.x = -0.25;
    const mug = group(arm, 0, -0.47, -0.38);
    part(mug, G.cylinder, M.iron, 0, 0, 0, 0.31, 0.58, 0.31);
    part(mug, G.cylinder, M.black, 0, 0.296, 0, 0.255, 0.012, 0.255);
    part(mug, G.torus, M.bronze, 0, 0.303, 0, 0.29, 0.29, 0.29, Math.PI / 2);
    part(mug, G.torus, M.iron, 0.36, 0, 0, 0.22, 0.23, 0.22);
    part(mug, G.box, M.bronze, 0, -0.03, -0.315, 0.13, 0.24, 0.025);
    mug.visible = false;
    const offhand = group(body, -0.39, 1.2, 0);
    part(offhand, G.box, M.blue, 0, -0.18, 0, 0.21, 0.44, 0.25);
    part(offhand, G.box, M.wood, -0.03, -0.61, 0, 0.21, 0.49, 0.56);
    part(offhand, G.box, M.bronze, -0.15, -0.56, -0.02, 0.025, 0.07, 0.12);
    plate(root, M.playerRing, 0, 0.025, 0, 0.65, true);
    const hp = healthBar(root, false, true);
    return { root, body, legs, arm, offhand, hp, weapons: { keyboard: weapon, mug }, lastX: 0, lastZ: 10, phase: 0 };
  }
  function enemyKind(type) {
    const id = String(type).toLowerCase();
    if (/boss|wing|executive|pie|overlord/.test(id)) return 'boss';
    if (/golem|audit|guard|stamp|shield|manager/.test(id)) return 'guard';
    if (/slime|bug|crab|crawler|overtime|error/.test(id)) return 'bug';
    return 'paper';
  }
  function face(parent, x, y, z, scale = 1, { glasses = false, brown = false, wing = false } = {}) {
    const head = group(parent, x, y, z);
    part(head, G.ball, M.skin, 0, 0, 0, 0.3 * scale, 0.34 * scale, 0.27 * scale);
    part(head, G.sphere, brown ? M.brownHair : M.hair, 0, 0.22 * scale, 0.035 * scale, 0.34 * scale, 0.18 * scale, 0.29 * scale);
    part(head, G.cone, M.skin, 0, -0.01 * scale, -0.3 * scale, 0.1 * scale, 0.2 * scale, 0.1 * scale, -Math.PI / 2);
    for (const side of [-1, 1]) {
      part(head, G.ball, M.skin, side * 0.3 * scale, 0, 0, 0.075 * scale, 0.12 * scale, 0.07 * scale);
      part(head, G.sphere, M.black, side * 0.115 * scale, 0.035 * scale, -0.253 * scale, 0.028 * scale, 0.042 * scale, 0.02 * scale);
      part(head, G.box, M.hair, side * 0.12 * scale, 0.13 * scale, -0.245 * scale, 0.19 * scale, (wing ? 0.06 : 0.035) * scale, 0.03 * scale, 0, 0, side * (wing ? -0.3 : -0.1));
      if (glasses) {
        for (const oy of [-0.04, 0.12]) part(head, G.box, M.black, side * 0.15 * scale, oy * scale, -0.29 * scale, 0.25 * scale, 0.032 * scale, 0.04 * scale);
        for (const ox of [-0.115, 0.115]) part(head, G.box, M.black, (side * 0.15 + ox) * scale, 0.04 * scale, -0.29 * scale, 0.025 * scale, 0.18 * scale, 0.04 * scale);
      }
    }
    if (glasses) part(head, G.box, M.black, 0, 0.065 * scale, -0.3 * scale, 0.08 * scale, 0.032 * scale, 0.04 * scale);
    part(head, G.box, M.black, 0.02 * scale, -0.16 * scale, -0.25 * scale, 0.32 * scale, 0.09 * scale, 0.035 * scale, 0, 0, -0.1);
    part(head, G.box, M.ivory, 0.02 * scale, -0.14 * scale, -0.274 * scale, 0.27 * scale, 0.045 * scale, 0.02 * scale, 0, 0, -0.1);
    return head;
  }
  function pizza(parent, x, y, z, radius = 0.62) {
    const pie = group(parent, x, y, z);
    part(pie, G.cylinder, M.bronze, 0, 0, 0, radius, 0.1, radius, Math.PI / 2);
    part(pie, G.cylinder, M.ivory, 0, 0, -0.06, radius * 0.87, 0.025, radius * 0.87, Math.PI / 2);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      part(pie, G.sphere, M.red, Math.sin(a) * radius * 0.57, Math.cos(a) * radius * 0.57, -0.09, radius * 0.13, radius * 0.13, 0.025);
    }
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) part(pie, G.box, M.bronze, 0, 0, -0.09, 0.012, radius * 1.62, 0.01, 0, 0, a);
    return pie;
  }
  function buildBoss(root, body, bossId) {
    const legs = [], wings = [];
    let arm, magic = null;
    if (bossId === 'sonny') {
      part(body, G.ball, M.tan, 0, 1.32, 0, 0.87, 0.88, 0.62);
      part(body, G.box, M.tan, 0, 1.43, -0.24, 1.26, 0.95, 0.58);
      part(body, G.box, M.iron, 0, 0.75, 0, 1.22, 0.16, 0.6);
      part(body, G.box, M.bronze, 0, 0.74, -0.33, 0.21, 0.18, 0.045);
      const head = face(body, 0, 2.38, -0.03, 1.35, { glasses: true });
      for (let i = 0; i < 6; i++) part(head, G.cone, M.hair, (i - 2.5) * 0.115, 0.36 + hash(i) * 0.09, 0, 0.1, 0.24, 0.13, 0, 0, (i - 2) * -0.16);
      for (const side of [-1, 1]) {
        const leg = group(root, side * 0.37, 0.67, 0); legs.push(leg);
        part(leg, G.box, M.trousers, 0, -0.23, 0, 0.45, 0.74, 0.48);
        part(leg, G.box, M.black, 0, -0.58, -0.11, 0.49, 0.23, 0.71);
      }
      arm = group(body, 0.96, 1.87, 0);
      part(arm, G.ball, M.tan, 0, -0.12, 0, 0.39, 0.34, 0.4);
      part(arm, G.cylinder, M.skin, 0, -0.49, 0, 0.3, 0.7, 0.3);
      part(arm, G.sphere, M.skin, 0, -0.95, -0.1, 0.36, 0.35, 0.37);
      part(arm, G.box, M.bronze, 0, -0.69, 0, 0.62, 0.13, 0.62);
      const left = group(body, -0.95, 1.83, 0);
      part(left, G.ball, M.tan, 0, -0.1, 0, 0.36, 0.33, 0.38);
      part(left, G.cylinder, M.skin, 0, -0.46, -0.1, 0.28, 0.63, 0.28, 0.2);
      pizza(left, -0.02, -0.65, -0.51);
    } else if (bossId === 'meimei') {
      part(body, G.cone, M.black, 0, 0.87, 0, 0.62, 1.1, 0.48);
      part(body, G.box, M.ivory, 0, 1.65, 0, 0.88, 0.9, 0.43);
      part(body, G.box, M.black, 0, 1.15, 0, 0.9, 0.14, 0.5);
      const head = face(body, 0, 2.44, -0.02, 1.08, { brown: true });
      part(head, G.ball, M.brownHair, 0, 0.04, 0.16, 0.39, 0.5, 0.31);
      for (const side of [-1, 1]) part(head, G.box, M.brownHair, side * 0.33, -0.19, 0.03, 0.14, 0.62, 0.36, 0, 0, side * -0.18);
      part(head, G.box, M.brownHair, -0.13, 0.19, -0.23, 0.5, 0.18, 0.13, 0, 0, -0.44);
      for (const side of [-1, 1]) {
        const leg = group(root, side * 0.21, 0.54, 0); legs.push(leg);
        part(leg, G.cylinder, M.skin, 0, -0.16, 0, 0.12, 0.42, 0.12);
        part(leg, G.box, M.black, 0, -0.43, -0.06, 0.24, 0.16, 0.38);
        const sleeve = group(body, side * 0.53, 1.8, 0);
        part(sleeve, G.cylinder, M.blush, 0, -0.24, 0, 0.26, 0.64, 0.26, 0, 0, side * 0.18);
        for (let i = 0; i < 3; i++) {
          const fy = -0.13 - i * 0.15;
          part(sleeve, G.sphere, M.ivory, side * 0.12, fy, -0.225, 0.06, 0.05, 0.018);
          part(sleeve, G.sphere, M.ivory, side * 0.04, fy + 0.05, -0.23, 0.05, 0.045, 0.018);
        }
      }
      part(body, G.box, M.pink, -0.42, 1.35, -0.41, 0.67, 0.97, 0.14, 0, 0.03, -0.15);
      part(body, G.box, M.ivory, -0.42, 1.35, -0.494, 0.45, 0.05, 0.02, 0, 0, -0.15);
      arm = group(body, 0.63, 1.7, -0.03);
      part(arm, G.cylinder, M.skin, 0, -0.28, 0, 0.14, 0.49, 0.14);
      part(arm, G.cylinder, M.black, 0, -0.14, -0.24, 0.055, 1.8, 0.055);
      part(arm, G.sphere, M.iron, 0, 0.81, -0.24, 0.17, 0.23, 0.17);
      part(arm, G.torus, M.blueMagic, 0, 0.81, -0.24, 0.34, 0.34, 0.34);
      magic = group(body, 0, 1.3, 0);
      const orbit = part(magic, G.torus, M.blueMagic, 0, 0, 0, 1.18, 1.18, 1.18, Math.PI / 2.4);
      orbit.castShadow = false;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        part(magic, G.box, M.pink, Math.sin(a) * 1.18, 0, Math.cos(a) * 1.18, 0.21, 0.31, 0.04, 0, a);
      }
    } else {
      part(body, G.cone, M.black, 0, 1.05, 0, 0.86, 2.1, 0.8);
      part(body, G.box, M.iron, 0, 1.9, 0, 1.2, 0.9, 0.62);
      part(body, G.box, M.pink, 0, 1.97, -0.36, 0.58, 0.78, 0.055);
      for (const side of [-1, 1]) part(body, G.box, M.gold, side * 0.36, 1.97, -0.39, 0.09, 0.9, 0.06, 0, 0, side * 0.2);
      const head = face(body, 0, 2.76, -0.05, 1.35, { wing: true });
      for (let i = 0; i < 5; i++) part(head, G.cone, M.hair, (i - 2) * 0.14, 0.34, 0.02, 0.14, 0.41, 0.17, 0, 0, -0.6);
      part(body, G.box, M.gold, 0, 3.05, -0.05, 0.9, 0.12, 0.72);
      for (let i = -1; i <= 1; i++) part(body, G.cone, M.gold, i * 0.31, 3.26, -0.08, 0.13, 0.4, 0.13);
      for (const side of [-1, 1]) {
        const wing = group(body, side * 0.56, 2.15, 0.25); wings.push(wing);
        for (let i = 0; i < 4; i++) {
          part(wing, G.box, i % 2 ? M.iron : M.black, side * (0.5 + i * 0.3), 0.2 + i * 0.14, 0.1 + i * 0.08, 0.55, 1.45 - i * 0.15, 0.12, -0.12, side * -0.22, side * (-0.2 - i * 0.16));
          part(wing, G.cone, M.gold, side * (0.75 + i * 0.3), -0.38 + i * 0.18, 0.15, 0.1, 0.5, 0.1, 0, 0, side * 0.5);
        }
      }
      const halo = group(body, 0, 2.9, 0.55);
      part(halo, G.torus, M.gold, 0, 0, 0, 1.35, 1.35, 1.35);
      part(halo, G.disc, M.halo, 0, 0, 0.02, 1.28, 1.28, 1);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        part(halo, G.box, M.gold, Math.sin(a) * 1.54, Math.cos(a) * 1.54, 0, 0.06, 0.31, 0.06, 0, 0, -a);
      }
      arm = group(body, 0.85, 2.12, 0);
      part(arm, G.box, M.black, 0, -0.4, 0, 0.32, 0.9, 0.35);
      part(arm, G.cylinder, M.gold, 0, -0.33, -0.3, 0.07, 1.8, 0.07);
      part(arm, G.box, M.paper, 0, 0.7, -0.3, 0.53, 0.68, 0.08);
      part(arm, G.box, M.red, 0, 0.65, -0.35, 0.23, 0.18, 0.025);
      part(arm, G.torus, M.gold, 0, 0.7, -0.3, 0.46, 0.46, 0.46);
    }
    return { legs, wings, arm, magic };
  }
  function bossLabel(bossId) {
    if (bossLabels.has(bossId)) return bossLabels.get(bossId);
    const surface = document.createElement('canvas'); surface.width = 512; surface.height = 80;
    const ctx = surface.getContext('2d');
    if (!ctx) return null;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#17191a';
    ctx.fillRect(0, 10, 512, 60); ctx.strokeStyle = bossId === 'meimei' ? '#8875ac' : '#a98a50'; ctx.strokeRect(1, 10, 510, 60);
    ctx.fillStyle = '#efddad'; ctx.font = '600 31px "Noto Sans TC", "PingFang TC", sans-serif';
    const profile = BOSS_PROFILES[bossId] || BOSS_PROFILES.wing;
    ctx.fillText(`${profile.displayName} · ${profile.title}`, 256, 41);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    const mat = basic('#ffffff', { map: texture, transparent: true, depthWrite: false }); bossLabels.set(bossId, mat); return mat;
  }
  function makeEnemy(enemy) {
    const kind = enemyKind(enemy.type), root = group(scene), body = group(root);
    const legs = [], wings = [];
    let arm, magic = null;
    if (kind === 'boss') {
      const boss = buildBoss(root, body, enemy.bossId || 'wing');
      legs.push(...boss.legs); wings.push(...boss.wings); arm = boss.arm; magic = boss.magic;
    } else if (kind === 'guard') {
      part(body, G.box, M.iron, 0, 0.95, 0, 0.8, 0.9, 0.55);
      part(body, G.box, M.red, 0, 0.96, -0.29, 0.44, 0.62, 0.03);
      part(body, G.box, M.stone2, 0, 1.61, 0, 0.59, 0.44, 0.47);
      part(body, G.box, M.eye, 0, 1.63, -0.245, 0.39, 0.065, 0.025);
      part(body, G.box, M.bronze, -0.49, 1.0, -0.32, 0.63, 0.93, 0.15, 0, 0.15, -0.12);
      part(body, G.box, M.red, -0.49, 1.0, -0.41, 0.35, 0.52, 0.03);
      arm = group(body, 0.53, 1.22, 0);
      part(arm, G.cylinder, M.wood, 0, -0.2, -0.3, 0.075, 0.8, 0.075, Math.PI / 2);
      part(arm, G.cylinder, M.iron, 0, -0.2, -0.75, 0.3, 0.27, 0.3, Math.PI / 2);
      for (const side of [-1, 1]) {
        const leg = group(root, side * 0.23, 0.62, 0); legs.push(leg);
        part(leg, G.box, M.black, 0, -0.27, 0, 0.28, 0.6, 0.34);
      }
    } else if (kind === 'bug') {
      // An amorphous demand pile, with a tiny abandoned office tie.
      part(body, G.ball, M.slime, 0, 0.53, 0, 0.68, 0.57, 0.69);
      part(body, G.ball, M.slimeDark, 0, 0.14, 0, 0.78, 0.18, 0.78);
      part(body, G.ball, M.slime, -0.35, 0.17, -0.28, 0.4, 0.23, 0.4);
      part(body, G.ball, M.slime, 0.39, 0.17, 0.18, 0.34, 0.23, 0.37);
      part(body, G.box, M.red, 0, 0.39, -0.62, 0.12, 0.34, 0.045, -0.16);
      part(body, G.box, M.paper, 0.1, 0.94, 0.1, 0.4, 0.035, 0.45, 0.16, 0.3, -0.2);
      for (const side of [-1, 1]) {
        part(body, G.sphere, M.black, side * 0.21, 0.68, -0.57, 0.12, 0.13, 0.055);
        part(body, G.sphere, M.blueEye, side * 0.21, 0.7, -0.62, 0.045, 0.055, 0.025);
      }
      arm = body;
    } else {
      part(body, G.cone, M.purple, 0, 0.87, 0.12, 0.5, 1.3, 0.43);
      for (let i = 0; i < 5; i++) part(body, G.box, i === 3 ? M.red : M.paper, (i % 2 ? 0.04 : -0.04), 0.62 + i * 0.15, 0, 0.7 - i * 0.05, 0.13, 0.45, 0, i * 0.06);
      part(body, G.sphere, M.purple, 0, 1.52, 0, 0.36, 0.4, 0.32);
      part(body, G.box, M.black, 0, 1.49, -0.24, 0.41, 0.35, 0.08, 0, 0, -0.04);
      for (const side of [-1, 1]) {
        part(body, G.sphere, M.blueEye, side * 0.12, 1.53, -0.29, 0.065, 0.045, 0.03);
        const leg = group(root, side * 0.19, 0.5, 0); legs.push(leg);
        part(leg, G.box, M.iron, 0, -0.2, 0, 0.12, 0.5, 0.15, 0, 0, side * 0.12);
      }
      arm = group(body, 0.42, 1.03, 0);
      part(arm, G.box, M.paper, 0.07, -0.15, -0.08, 0.2, 0.58, 0.17, 0.25, 0, -0.3);
      part(arm, G.cone, M.bronze, 0.13, -0.38, -0.27, 0.12, 0.6, 0.12, -Math.PI / 2);
    }
    const radius = kind === 'boss' ? 1.12 : kind === 'bug' ? 0.7 : 0.53;
    plate(root, M.shadow, 0, 0.022, 0, radius);
    const hp = healthBar(root, kind === 'boss');
    if (kind === 'boss') {
      hp.group.position.y = enemy.bossId === 'wing' ? 4.35 : 3.4;
      const label = bossLabel(enemy.bossId || 'wing');
      if (label) part(hp.group, G.plane, label, 0, 0.33, 0.02, 2.8, 0.44, 1).castShadow = false;
    }
    return { root, body, legs, wings, arm, hp, kind, magic, bossId: enemy.bossId, phase: hash(enemy.id?.length || 2) * 8, lastX: enemy.x, lastZ: enemy.z };
  }

  function makeWarning(bossId) {
    const root = group(scene);
    const fillMat = bossId === 'meimei' ? M.violetMagic : M.warning;
    const edgeMat = bossId === 'meimei' ? M.blueMagic : M.warningEdge;
    const fill = plate(root, fillMat, 0, 0.04, 0, 1);
    const edge = plate(root, edgeMat, 0, 0.047, 0, 1, true);
    const line = part(root, G.plane, fillMat, 0, 0.045, -0.5, 1, 1, 1, -Math.PI / 2);
    const lineEdge = part(root, G.box, edgeMat, 0, 0.05, -0.5, 1, 0.018, 1);
    return { root, fill, edge, line, lineEdge };
  }
  function rarityColor(rarity) {
    return ({ common: '#c4cec8', normal: '#c4cec8', magic: '#659ddd', rare: '#79bcdf', epic: '#c3a2e4', legendary: '#ef8448', unique: '#efb85a' })[rarity] || '#dfbc6b';
  }
  function makeDrop(drop) {
    const root = group(scene);
    const tint = drop.type === 'gold' ? '#edc064' : drop.type === 'xp' ? '#81c4bb' : rarityColor(drop.item?.rarity);
    const mat = basic(tint);
    let object;
    const extraMaterials = [];
    if (drop.type === 'item') {
      object = part(root, G.box, M.iron, 0, 0.26, 0, 0.35, 0.22, 0.65, 0, 0.6, 0.15);
      part(root, G.box, mat, 0, 0.4, 0, 0.08, 0.035, 0.48, 0, 0.6);
      const beamMat = basic(tint, { transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending });
      extraMaterials.push(beamMat);
      part(root, G.cylinder, beamMat, 0, 1.55, 0, 0.075, 3.1, 0.075);
      plate(root, mat, 0, 0.035, 0, 0.39, true);
    } else if (drop.type === 'gold') {
      object = part(root, G.cylinder, M.gold, 0, 0.12, 0, 0.23, 0.13, 0.23);
      part(root, G.cylinder, M.gold, 0.12, 0.19, 0.03, 0.17, 0.11, 0.17, 0.12, 0, 0.15);
    } else if (drop.type === 'coffee') {
      object = part(root, G.cylinder, M.ivory, 0, 0.24, 0, 0.2, 0.42, 0.2);
      part(root, G.cylinder, M.tan, 0, 0.23, 0, 0.208, 0.17, 0.208);
      part(root, G.cylinder, M.black, 0, 0.47, 0, 0.225, 0.065, 0.225);
      part(root, G.torus, M.bronze, 0.23, 0.28, 0, 0.13, 0.13, 0.13);
      part(root, G.box, mat, 0, 0.24, -0.212, 0.11, 0.11, 0.025);
      plate(root, mat, 0, 0.025, 0, 0.36, true);
    } else object = part(root, G.sphere, mat, 0, 0.33, 0, 0.12, 0.16, 0.12);
    return { root, object, material: mat, extraMaterials, phase: hash(drop.id?.length || 1) * 5 };
  }
  function makeEffect(effect) {
    const tint = effect.color || (/heal|potion/.test(effect.type) ? '#8bceb0' : /burst|skill|nova/.test(effect.type) ? '#d9b777' : '#f0be88');
    const mat = basic(tint, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const root = group(scene);
    const ring = plate(root, mat, 0, 0.13, 0, 1, true);
    const slash = part(root, G.torus, mat, 0, 0.8, -0.5, 0.8, 0.8, 0.8, Math.PI / 2.3, 0, 0.5);
    const trail = part(root, G.plane, mat, 0, 0.04, -0.5, 0.2, 1, 1, -Math.PI / 2);
    trail.visible = false;
    const sparks = [];
    for (let i = 0; i < 4; i++) sparks.push(part(root, G.box, mat, 0, 0.5, 0, 0.035, 0.22, 0.035));
    return { root, ring, slash, trail, sparks, material: mat, type: String(effect.type) };
  }
  const projectileMats = { player: basic('#99ded2'), enemy: basic('#ff7952') };

  function prune(map, live, disposeMaterial = false) {
    for (const [id, model] of map) {
      if (live.has(id)) continue;
      if (model.art) artLayer.release(model);
      scene.remove(model.root);
      if (disposeMaterial && model.material) { model.material.dispose(); materials.delete(model.material); }
      if (model.extraMaterials) for (const mat of model.extraMaterials) { mat.dispose(); materials.delete(mat); }
      map.delete(id);
    }
  }
  function updateHealth(model, hp, maxHp, visible) {
    const ratio = Math.max(0, Math.min(1, Number(hp) / Math.max(1, Number(maxHp) || 1)));
    model.hp.group.visible = visible;
    model.hp.group.quaternion.copy(camera.quaternion);
    // Bars are children of the actor; compensate for its heading.
    inverseActorRotation.copy(model.root.quaternion).invert();
    model.hp.group.quaternion.premultiply(inverseActorRotation);
    model.hp.bar.scale.x = model.hp.width * ratio;
    model.hp.bar.position.x = -model.hp.width * (1 - ratio) / 2;
  }
  function update(state, dt = 0) {
    if (destroyed || contextLost || !state?.player) return;
    const elapsed = Math.max(0, Math.min(0.1, Number(dt) || 0));
    time += elapsed;
    combatVisuals.update(state, elapsed);
    const ready = state.status === 'ready';
    if (lastStatus === null) cameraTarget.set(ready ? 0 : state.player.x, 0, ready ? -12 : state.player.z - 1.5);
    lastStatus = state.status;
    const ease = 1 - Math.exp(-elapsed * 5);
    cameraTarget.x += ((ready ? 0 : state.player.x) - cameraTarget.x) * ease;
    cameraTarget.z += ((ready ? -12 : state.player.z - 1.5) - cameraTarget.z) * ease;
    const desiredView = ready ? Math.max(43, 37 / (width / height)) : width < 700 ? 17 : 19;
    const nextView = viewSize + (desiredView - viewSize) * (1 - Math.exp(-elapsed * 3));
    if (Math.abs(nextView - viewSize) > 0.001) { viewSize = nextView; updateProjection(); }
    const kick = combatVisuals.cameraKick();
    camera.position.copy(cameraTarget).add(cameraOffset).add(kick);
    camera.lookAt(lookTarget.copy(cameraTarget).add(kick)); camera.updateMatrixWorld();

    if (!playerModel) playerModel = artLayer.attach(engineer(), 'jack');
    const p = state.player, pAngle = Number(p.action?.angle ?? p.angle) || 0;
    const carryingMug = state.equipped?.weapon?.baseId === 'mug';
    playerModel.weapons.keyboard.visible = !carryingMug;
    playerModel.weapons.mug.visible = carryingMug;
    const playerMoved = Math.hypot(p.x - playerModel.lastX, p.z - playerModel.lastZ);
    playerModel.phase += playerMoved * 4.5;
    playerModel.root.position.set(p.x, 0, p.z); playerModel.root.rotation.y = -pAngle;
    const stride = playerMoved > 0.001 ? Math.min(0.5, playerMoved * 30) : 0;
    playerModel.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(playerModel.phase + i * Math.PI) * stride; });
    const attack = Number(p.attackTimer) || 0;
    playerModel.arm.rotation.x = attack > 0 ? -0.6 - Math.sin(Math.min(1, attack / 0.18) * Math.PI) * 1.8 : -0.1;
    playerModel.arm.rotation.z = attack > 0 ? -0.3 : 0.03;
    playerModel.body.position.y = Math.abs(Math.sin(playerModel.phase)) * stride * 0.07;
    playerModel.offhand.rotation.x = -Math.sin(playerModel.phase) * stride * 0.4;
    playerModel.lastX = p.x; playerModel.lastZ = p.z;
    playerModel.root.visible = state.status !== 'dead' || Math.sin(time * 4) > -0.4;
    if (p.invulnerable > 0 && state.status === 'playing') playerModel.body.visible = Math.sin(time * 44) > -0.6;
    else playerModel.body.visible = true;
    artLayer.updateActor(playerModel, { angle: pAngle, moved: playerMoved, attack, hp: p.hp, dt: elapsed, weapon: carryingMug ? 'mug' : 'keyboard', invulnerable: p.invulnerable > 0 && state.status === 'playing', action: p.action, held: combatVisuals.held('player'), hitTimer: p.hitTimer, hitAngle: p.hitAngle });
    updateHealth(playerModel, p.hp, p.maxHp || p.hp, !ready && Number(p.hp) < Number(p.maxHp));

    const liveEnemies = new Set(), liveWarnings = new Set();
    for (const enemy of state.enemies || []) {
      if (!(enemy.hp > 0)) continue;
      liveEnemies.add(enemy.id);
      let model = actors.get(enemy.id);
      if (!model) { model = makeEnemy(enemy); artLayer.attach(model, model.kind === 'boss' ? enemy.bossId || 'wing' : model.kind); actors.set(enemy.id, model); }
      const moved = Math.hypot(enemy.x - model.lastX, enemy.z - model.lastZ);
      model.phase += moved * (model.kind === 'bug' ? 7 : 4);
      model.root.position.set(enemy.x, 0, enemy.z); model.root.rotation.y = -(Number(enemy.angle) || 0);
      model.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(model.phase + i * Math.PI) * Math.min(0.45, moved * 30); });
      model.body.position.y = model.kind === 'paper' ? Math.sin(time * 3 + model.phase) * 0.055 : Math.sin(model.phase * 2) * Math.min(0.04, moved);
      if (model.kind === 'bug') {
        model.body.scale.set(1 + Math.sin(time * 3 + model.phase) * 0.035, 1 - Math.sin(time * 3 + model.phase) * 0.06, 1 + Math.sin(time * 3 + model.phase) * 0.035);
      }
      if (model.arm !== model.body) {
        if (model.bossId === 'sonny') model.arm.rotation.x = enemy.phase === 'windup' ? -2.6 : enemy.phase === 'recovery' ? 0.5 : -0.12;
        else if (model.bossId === 'meimei') model.arm.rotation.x = enemy.phase === 'windup' ? -0.65 : enemy.phase === 'recovery' ? -0.3 : -0.06;
        else model.arm.rotation.x = enemy.phase === 'windup' ? -1.8 : enemy.phase === 'recovery' ? -0.7 : -0.12;
      }
      model.wings.forEach((wing, i) => { wing.rotation.z = Math.sin(time * 1.4) * 0.04 * (i ? 1 : -1); });
      if (model.magic) model.magic.rotation.y = time * 0.6;
      model.lastX = enemy.x; model.lastZ = enemy.z;
      artLayer.updateActor(model, { angle: Number(enemy.angle) || 0, moved, hp: enemy.hp, dt: elapsed, phase: enemy.phase, enraged: enemy.enraged, held: combatVisuals.held(enemy.id), hitTimer: enemy.hitTimer, hitAngle: enemy.hitAngle, windup: enemy.telegraph?.progress || 0 });
      // The persistent boss HUD owns its name/health; duplicate labels would
      // cover the portrait art, especially on a short phone viewport.
      updateHealth(model, enemy.hp, enemy.maxHp, !ready && model.kind !== 'boss' && (enemy.hp < enemy.maxHp || enemy.phase === 'windup'));
      const telegraphs = enemy.telegraphs?.length ? enemy.telegraphs : enemy.telegraph ? [enemy.telegraph] : [];
      for (let warningIndex = 0; warningIndex < telegraphs.length; warningIndex++) {
        const tel = telegraphs[warningIndex], warningId = `${enemy.id}:${warningIndex}`;
        liveWarnings.add(warningId);
        let warning = warnings.get(warningId);
        if (!warning) { warning = makeWarning(enemy.bossId); warnings.set(warningId, warning); }
        warning.root.position.set(Number.isFinite(tel.x) ? tel.x : enemy.x, 0, Number.isFinite(tel.z) ? tel.z : enemy.z);
        const line = tel.kind === 'line';
        warning.fill.visible = warning.edge.visible = !line;
        warning.line.visible = warning.lineEdge.visible = line;
        const progress = Number.isFinite(tel.progress) ? tel.progress : 1 - (tel.remaining || 0) / Math.max(0.01, tel.duration || 1);
        if (line) {
          warning.root.rotation.y = -(Number(tel.angle) || 0);
          const length = tel.length || 5, w = tel.width || 1;
          warning.line.scale.set(w, length, 1); warning.line.position.z = -length / 2;
          warning.lineEdge.scale.set(w, 0.018, 0.09); warning.lineEdge.position.z = -length * Math.max(0.04, progress);
        } else {
          warning.root.rotation.y = 0;
          warning.fill.scale.setScalar(tel.radius || 1);
          warning.edge.scale.setScalar((tel.radius || 1) * Math.max(0.15, progress));
        }
      }
    }
    prune(actors, liveEnemies); prune(warnings, liveWarnings);

    const liveLoot = new Set();
    for (const drop of state.drops || []) {
      liveLoot.add(drop.id);
      let model = loot.get(drop.id);
      if (!model) { model = makeDrop(drop); loot.set(drop.id, model); }
      model.root.position.set(drop.x, 0, drop.z);
      if (drop.type === 'xp') { model.object.position.y = 0.3 + Math.sin(time * 3 + model.phase) * 0.09; model.object.rotation.y = time; }
    }
    prune(loot, liveLoot, true);
    const liveMissiles = new Set();
    for (const projectile of state.projectiles || []) {
      liveMissiles.add(projectile.id);
      let model = missiles.get(projectile.id);
      if (!model) {
        const root = group(scene);
        let object;
        if (projectile.kind === 'speech') {
          object = part(root, G.box, M.blueMagic, 0, 0.8, 0, 0.3, 0.25, 0.1, 0.2, 0.3);
          part(root, G.box, M.pink, 0, 0.8, -0.06, 0.16, 0.04, 0.025);
        } else if (projectile.kind === 'bomb') {
          object = part(root, G.box, M.paper, 0, 1.1, 0, 0.33, 0.42, 0.06, 0.2, 0.3);
          part(root, G.box, M.red, 0, 1.08, -0.04, 0.17, 0.1, 0.02);
        } else object = part(root, G.sphere, projectileMats[projectile.owner === 'player' ? 'player' : 'enemy'], 0, 0.65, 0, 0.14, 0.14, 0.3);
        model = { root, object }; missiles.set(projectile.id, model);
      }
      model.root.position.set(projectile.x, 0, projectile.z);
      model.root.rotation.y = -Math.atan2(projectile.vx || 0, -(projectile.vz || 0));
    }
    prune(missiles, liveMissiles);
    const liveEffects = new Set();
    for (const effect of state.effects || []) {
      liveEffects.add(effect.id);
      let model = particles.get(effect.id);
      if (!model) { model = makeEffect(effect); particles.set(effect.id, model); }
      const age = Math.max(0, Math.min(1, 1 - effect.life / Math.max(0.01, effect.maxLife || 0.4)));
      const radius = Math.max(0.25, Number(effect.radius) || 0.8);
      model.root.position.set(effect.x, 0, effect.z); model.root.rotation.y = -(Number(effect.angle) || 0);
      model.material.opacity = (1 - age) * 0.85;
      const slash = /attack|melee|slash|cleave/.test(model.type);
      // The new impact renderer owns precisely timed melee arcs and contact
      // sparks. Preserve area telegraphs/effects without drawing two hit rings.
      const contact = model.type === 'hit' || slash;
      const trail = model.type === 'charge' || model.type === 'dash';
      model.root.visible = !contact;
      model.slash.visible = slash; model.ring.visible = !slash && !trail;
      model.trail.visible = trail;
      model.trail.scale.set(0.24 * (1 - age * 0.6), radius, 1);
      model.trail.position.z = -radius / 2;
      model.ring.scale.setScalar(radius * (0.3 + age * 0.85));
      model.slash.scale.setScalar(radius * (0.6 + age * 0.5)); model.slash.rotation.z = 0.5 + age * 1.6;
      model.sparks.forEach((spark, i) => {
        const a = i * Math.PI / 2 + 0.4;
        if (trail) spark.position.set(Math.sin(a) * 0.18, 0.12 + Math.sin(age * Math.PI) * 0.2, -radius * (i + age) / 4);
        else spark.position.set(Math.sin(a) * radius * age, 0.2 + Math.sin(age * Math.PI) * (0.7 + i * 0.1), Math.cos(a) * radius * age);
        spark.rotation.z = a + age * 3;
      });
    }
    prune(particles, liveEffects, true);
    flames.forEach(flame => {
      flame.object.visible = !artLayer.hasFlames();
      flame.glow.visible = !artLayer.hasFlames();
      const flicker = 0.92 + Math.sin(time * 7 + flame.offset) * 0.09 + Math.sin(time * 13 + flame.offset) * 0.045;
      flame.object.scale.set(1 + Math.sin(time * 5 + flame.offset) * 0.08, flicker, 1);
    });
    rotating.forEach(cog => { cog.object.rotation.z = time * cog.speed; });
    for (const spec of state.gates || []) {
      let gate = gates.get(spec.id);
      if (!gate) { gate = makeGate(spec); gates.set(spec.id, gate); }
      const target = spec.locked ? 1 : 0;
      gate.closed.scale.y += (target - gate.closed.scale.y) * (1 - Math.exp(-elapsed * 6));
      gate.closed.visible = gate.closed.scale.y > 0.02;
      gate.opened.visible = !spec.locked;
    }
    returnRing.rotation.z = time * 0.2;
    artLayer.update(state, elapsed);
    renderer.render(scene, camera);
  }
  function updateProjection() {
    const aspect = width / Math.max(1, height);
    camera.left = -viewSize * aspect / 2; camera.right = viewSize * aspect / 2;
    camera.top = viewSize / 2; camera.bottom = -viewSize / 2;
    camera.updateProjectionMatrix();
  }
  function resize() {
    if (destroyed) return;
    const rect = container.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, width < 700 ? 1.25 : 1.5);
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); updateProjection();
  }
  function screenToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (destroyed || !rect.width || !rect.height) return null;
    pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(groundPlane, intersection) ? { x: intersection.x, z: intersection.z } : null;
  }
  function onContextLost(event) { event.preventDefault(); contextLost = true; }
  function onContextRestored() { contextLost = false; resize(); }
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  const observer = new ResizeObserver(resize); observer.observe(container);
  resize(); camera.position.copy(cameraTarget).add(cameraOffset); camera.lookAt(cameraTarget); camera.updateMatrixWorld();
  renderer.render(scene, camera);
  return {
    canvas, update, screenToWorld, movementToWorld, resize,
    destroy() {
      if (destroyed) return;
      destroyed = true; observer.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      artLayer.destroy();
      combatVisuals.destroy();
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
      actors.clear(); loot.clear(); warnings.clear(); missiles.clear(); particles.clear(); gates.clear(); bossLabels.clear(); scene.clear();
      renderer.dispose(); canvas.remove();
    },
  };
}
