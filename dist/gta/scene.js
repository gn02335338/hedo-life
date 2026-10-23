import * as THREE from '../island/vendor/three.module.js';
import { ROAD_LINES, SPAWN, BUILDINGS, LOCATIONS } from './world.js';

// The city and all of its textures are drawn locally. No remote model or image is used.
export async function createCityScene({ container, onReady } = {}) {
  if (!container) throw new Error('找不到城市畫面容器。');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    throw new Error('無法啟動 3D 城市。請開啟瀏覽器的硬體加速，或換用支援 WebGL 的瀏覽器。');
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Only the immobile city casts into this map; actors have inexpensive contact shadows.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.domElement.setAttribute('aria-label', '禾多 GTA：可駕車探索的 3D 城市');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const daylight = new THREE.Color('#e8b89e');
  const nighttime = new THREE.Color('#192840');
  scene.background = daylight.clone();
  scene.fog = new THREE.FogExp2(daylight, 0.0026);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.15, 1000);
  const hemi = new THREE.HemisphereLight('#ffe3c1', '#355f69', 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd2a1', 3.5);
  sun.position.set(-85, 130, 65);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -215; sun.shadow.camera.right = 215;
  sun.shadow.camera.top = 215; sun.shadow.camera.bottom = -215;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 420;
  sun.shadow.normalBias = 0.32; sun.shadow.bias = -0.00035;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#adc8e2', 1.2);
  rim.position.set(70, 50, -100); scene.add(rim);

  const materials = new Map();
  const geometries = new Set();
  const textures = new Set();
  const batches = new Map();
  const identity = new THREE.Object3D();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  const coneGeometry = new THREE.ConeGeometry(1, 1, 7);
  const sphereGeometry = new THREE.IcosahedronGeometry(1, 1);
  const planeGeometry = new THREE.PlaneGeometry(1, 1);
  [boxGeometry, cylinderGeometry, coneGeometry, sphereGeometry, planeGeometry].forEach(g => geometries.add(g));
  const mat = (color, options = {}) => {
    const key = `${color}:${JSON.stringify(options)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...options }));
    return materials.get(key);
  };
  const M = {
    asphalt: mat('#3d525a'), sidewalk: mat('#a7aaa0'), curb: mat('#d1ccba'),
    white: mat('#e6e0b7'), yellow: mat('#f6c84e'), metal: mat('#263b41'),
    glass: mat('#183f4d', { metalness: 0.35, roughness: 0.3 }),
    roof: mat('#526968'), bark: mat('#665548'), leaf: mat('#416c57'), leaf2: mat('#618661'),
    grass: mat('#73957c'), lit: mat('#ffd98a', { emissive: '#ffc36b', emissiveIntensity: 0.7 }),
    dim: mat('#448a91', { emissive: '#31565d', emissiveIntensity: 0.15 }),
    red: mat('#f87a60', { emissive: '#d22d18', emissiveIntensity: 0.5 }),
    teal: mat('#54cab4', { emissive: '#45baa6', emissiveIntensity: 0.5 }),
  };
  function addBatch(geometry, material, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, cast = true) {
    const key = `${geometry.uuid}:${material.uuid}:${cast}`;
    if (!batches.has(key)) batches.set(key, { geometry, material, matrices: [], cast });
    identity.position.set(x, y, z); identity.rotation.set(rx, ry, rz); identity.scale.set(sx, sy, sz); identity.updateMatrix();
    batches.get(key).matrices.push(identity.matrix.clone());
  }
  const box = (m, x, y, z, w, h, d, ry = 0, cast = true) => addBatch(boxGeometry, m, x, y, z, w, h, d, 0, ry, 0, cast);
  const cylinder = (m, x, y, z, r, h, ry = 0) => addBatch(cylinderGeometry, m, x, y, z, r, h, r, 0, ry, 0);
  const seed = n => { const v = Math.sin(n * 127.1 + 81.73) * 43758.5453123; return v - Math.floor(v); };
  function tree(x, z, size = 1, palm = false) {
    cylinder(M.bark, x, size * 1.7, z, size * 0.22, size * 3.4);
    if (palm) {
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 0.4;
        addBatch(sphereGeometry, M.leaf, x + Math.cos(a) * 1.1 * size, 3.8 * size, z + Math.sin(a) * 1.1 * size,
          2.1 * size, 0.45 * size, 0.65 * size, 0, -a, 0.2);
      }
    } else {
      addBatch(sphereGeometry, M.leaf, x, size * 4.5, z, size * 1.8, size * 2.3, size * 1.8);
      addBatch(sphereGeometry, M.leaf2, x + size * 0.6, size * 4.8, z + size * 0.5, size * 1.2, size * 1.65, size * 1.3);
    }
  }
  function lamp(x, z, angle = 0) {
    cylinder(M.metal, x, 3.7, z, 0.1, 7.4);
    const dx = Math.sin(angle), dz = Math.cos(angle);
    box(M.metal, x + dx * 0.8, 7.35, z + dz * 0.8, 0.14, 0.14, 1.8, angle);
    box(M.lit, x + dx * 1.4, 7.25, z + dz * 1.4, 0.58, 0.12, 1.1, angle);
    // Soft, inexpensive pools of light on the pavement.
    addBatch(planeGeometry, mat('#f7db9e', { transparent: true, opacity: 0.055, depthWrite: false }), x + dx * 1.4, 0.035, z + dz * 1.4,
      6, 8, 1, -Math.PI / 2, 0, angle, false);
  }
  function sign(text, subtitle, width, height, color = '#f4df9b', background = '#173f47') {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 384;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = background; ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = color; ctx.lineWidth = 8; ctx.strokeRect(14, 14, 996, 356);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.font = '900 132px "Arial", "Noto Sans TC", sans-serif'; ctx.fillText(text, 512, subtitle ? 154 : 194, 940);
    if (subtitle) { ctx.font = '500 43px "Arial", "Noto Sans TC", sans-serif'; ctx.fillText(subtitle, 512, 281, 920); }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(texture);
    const material = new THREE.MeshStandardMaterial({ map: texture, emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.3, roughness: 0.7 });
    materials.set(texture.uuid, material);
    const mesh = new THREE.Mesh(planeGeometry, material); mesh.scale.set(width, height, 1); scene.add(mesh); return mesh;
  }

  // The raised city sits within a continuous river and a low mountain horizon.
  const waterMaterial = mat('#468789', { metalness: 0.25, roughness: 0.4 });
  const water = new THREE.Mesh(planeGeometry, waterMaterial); water.rotation.x = -Math.PI / 2;
  water.scale.set(1800, 1800, 1); water.position.y = -1.5; scene.add(water);
  box(mat('#6c7f78'), 0, -1.25, 0, 282, 2.4, 282, 0, false);
  box(M.asphalt, 0, -0.05, 0, 278, 0.1, 278, 0, false);
  const waterShine = mat('#d0d7be', { transparent: true, opacity: 0.21, depthWrite: false });
  for (let i = 0; i < 150; i++) {
    const side = i % 4; const a = (seed(i + 4) - 0.5) * 750; const b = 153 + seed(i + 122) * 240;
    const x = side < 2 ? a : (side === 2 ? b : -b); const z = side < 2 ? (side === 0 ? b : -b) : a;
    box(waterShine, x, -1.45, z, 3 + seed(i) * 14, 0.01, 0.12, 0, false);
  }
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2; const r = 380 + seed(i + 8) * 100;
    const h = 45 + seed(i + 21) * 95;
    addBatch(coneGeometry, mat(i % 2 ? '#789797' : '#8da5a2'), Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r,
      70 + seed(i) * 55, h, 70 + seed(i) * 55, 0, a, 0, false);
  }
  const sunDisk = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({ color: '#ffdf9c' }));
  materials.set('sunDisk', sunDisk.material); sunDisk.position.set(-235, 135, -340); sunDisk.scale.setScalar(31); scene.add(sunDisk);

  // Repeating street rhythm: marked lanes, zebra crossings, signal poles and corners.
  const centers = [-90, -30, 30, 90];
  for (const x of centers) for (const z of centers) {
    box(M.sidewalk, x, 0.17, z, 42, 0.34, 42);
    box(M.curb, x, 0.25, z, 42.3, 0.16, 42.3);
  }
  for (const lane of ROAD_LINES) {
    for (let p = -133; p <= 133; p += 9) {
      if (ROAD_LINES.some(r => Math.abs(r - p) < 12)) continue;
      box(M.white, lane - 0.12, 0.012, p, 0.13, 0.015, 3.4, 0, false);
      box(M.white, lane + 0.12, 0.012, p, 0.13, 0.015, 3.4, 0, false);
      box(M.white, p, 0.012, lane - 0.12, 3.4, 0.015, 0.13, 0, false);
      box(M.white, p, 0.012, lane + 0.12, 3.4, 0.015, 0.13, 0, false);
    }
    for (let p = -130; p < 131; p += 5) {
      if (ROAD_LINES.some(r => Math.abs(r - p) < 11)) continue;
      box(M.yellow, lane - 8.4, 0.025, p, 0.15, 0.02, 3.2, 0, false);
      box(M.yellow, p, 0.025, lane + 8.4, 3.2, 0.02, 0.15, 0, false);
    }
  }
  for (const x of ROAD_LINES) for (const z of ROAD_LINES) {
    for (let j = -5; j <= 5; j += 2) {
      for (const s of [-1, 1]) {
        box(M.white, x + j, 0.024, z + s * 10.1, 0.9, 0.025, 3.1, 0, false);
        box(M.white, x + s * 10.1, 0.024, z + j, 3.1, 0.025, 0.9, 0, false);
      }
    }
    if (Math.abs(x) < 125 && Math.abs(z) < 125) {
      for (const s of [-1, 1]) {
        cylinder(M.metal, x + s * 10.4, 2.8, z + s * 10.4, 0.12, 5.6);
        box(M.metal, x + s * 10.4, 5.3, z + s * 10.4, 0.6, 1.5, 0.45);
        box(s > 0 ? M.teal : M.red, x + s * 10.4, 5.5, z + s * 10.4 + 0.24, 0.3, 0.3, 0.03, 0, false);
      }
    }
  }

  function facade(b, tw, td, baseY, height) {
    const floors = Math.max(1, Math.floor((height - 3) / 3.1));
    const colsX = Math.max(3, Math.floor(tw / 3.4)); const colsZ = Math.max(3, Math.floor(td / 3.4));
    for (let f = 0; f < floors; f++) {
      const y = baseY + 2.1 + f * 3.1;
      for (const side of [-1, 1]) {
        for (let j = 0; j < colsX; j++) {
          const lit = seed(b.x * 13 + b.z * 3 + f * 97 + j * 5 + side) > 0.48;
          box(lit ? M.lit : M.dim, b.x + (j - (colsX - 1) / 2) * (tw - 2) / colsX, y, b.z + side * (td / 2 + 0.015),
            (tw - 2) / colsX * 0.68, 1.38, 0.035, 0, false);
        }
        for (let j = 0; j < colsZ; j++) {
          const lit = seed(b.z * 17 + b.x * 2 + f * 83 + j * 7 + side) > 0.48;
          box(lit ? M.lit : M.dim, b.x + side * (tw / 2 + 0.015), y, b.z + (j - (colsZ - 1) / 2) * (td - 2) / colsZ,
            0.035, 1.38, (td - 2) / colsZ * 0.68, 0, false);
        }
      }
      if (f % 3 === 0) box(M.roof, b.x, y - 1.05, b.z, tw + 0.2, 0.16, td + 0.2);
    }
  }

  BUILDINGS.forEach((b, index) => {
    const h = Math.max(8, b.h || 20);
    const bodyColor = new THREE.Color(b.color || '#3e6b73').lerp(new THREE.Color('#294c58'), 0.55);
    const body = mat(`#${bodyColor.getHexString()}`);
    const isHQ = b.kind === 'hq';
    const isCafe = b.kind === 'coffee' || b.kind === 'cafe';
    const isCourt = b.kind === 'court';
    const tw = b.w * (isHQ ? 0.72 : 0.67 + seed(index) * 0.12);
    const td = b.d * (0.65 + seed(index + 66) * 0.13);
    const podiumHeight = isCafe ? 4.2 : 5.2;
    box(body, b.x, podiumHeight / 2 + 0.35, b.z, b.w, podiumHeight, b.d);
    box(M.roof, b.x, podiumHeight + 0.45, b.z, b.w + 0.3, 0.32, b.d + 0.3);
    // Long storefront glazing makes the scale legible at street level.
    for (const side of [-1, 1]) {
      for (let i = -3; i <= 3; i++) {
        box(M.glass, b.x + i * 4.8, 2.8, b.z + side * (b.d / 2 + 0.02), 4.4, 3.4, 0.05, 0, false);
        box(M.glass, b.x + side * (b.w / 2 + 0.02), 2.8, b.z + i * 4.8, 0.05, 3.4, 4.4, 0, false);
      }
      box(M.lit, b.x, 4.6, b.z + side * (b.d / 2 + 0.08), b.w - 1, 0.13, 0.14, 0, false);
    }
    if (!isCourt) {
      box(body, b.x, podiumHeight + h / 2, b.z, tw, h, td);
      facade(b, tw, td, podiumHeight, h);
      box(M.roof, b.x, podiumHeight + h + 0.1, b.z, tw + 0.5, 0.35, td + 0.5);
      box(M.roof, b.x + tw * 0.15, podiumHeight + h + 1.4, b.z, tw * 0.3, 2.4, td * 0.3);
      for (let a = 0; a < 3; a++) box(M.metal, b.x - tw * 0.3 + a * 3, podiumHeight + h + 0.8, b.z - td * 0.2, 2, 1.3, 2.8);
      if (index % 3 === 0) {
        cylinder(M.metal, b.x, podiumHeight + h + 5, b.z, 0.09, 8);
        box(M.red, b.x, podiumHeight + h + 9, b.z, 0.28, 0.28, 0.28, 0, false);
      }
    } else {
      // A visible rooftop sports court doubles as the neighborhood landmark.
      box(mat('#397c78'), b.x, 5.65, b.z, 28, 0.1, 22);
      box(mat('#bf795b'), b.x, 5.71, b.z, 22, 0.06, 15);
      for (const sx of [-1, 1]) {
        box(M.white, b.x + sx * 11, 5.76, b.z, 0.12, 0.02, 15);
        box(M.white, b.x, 5.76, b.z + sx * 7.5, 22, 0.02, 0.12);
        cylinder(M.metal, b.x + sx * 13, 7.2, b.z, 0.12, 3);
        box(M.white, b.x + sx * 12.4, 9.0, b.z, 0.18, 1.3, 2.3);
        box(M.red, b.x + sx * 11.6, 8.4, b.z, 1.1, 0.12, 0.8);
      }
      box(M.white, b.x, 5.76, b.z, 0.1, 0.02, 15);
      const hoop = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.2, 40), M.white); geometries.add(hoop.geometry);
      hoop.rotation.x = -Math.PI / 2; hoop.position.set(b.x, 5.77, b.z); scene.add(hoop);
      for (const sx of [-1, 1]) box(M.metal, b.x + sx * 19, 7.5, b.z, 0.1, 3.6, 38);
    }
    // Trees, planters and benches stay on the visible sidewalk edge.
    for (const s of [-1, 1]) {
      const tx = b.x + s * 20.65, tz = b.z + 14;
      box(M.roof, tx, 0.65, tz, 1.1, 0.65, 2.2);
      tree(tx, tz, 0.68);
      lamp(b.x + s * 20.7, b.z - 14, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    const facadeX = b.x - b.w / 2 - 0.12;
    if (isHQ) {
      const brand = sign('HEDO', '禾 多 人 生  /  HEADQUARTERS', 17, 6.4, '#e7fa86');
      brand.position.set(b.x, podiumHeight + h - 5, b.z + td / 2 + 0.06);
      const sideBrand = sign('禾多', 'WORK HARD. DRIVE HOME.', 12, 4.5, '#e7fa86');
      sideBrand.position.set(facadeX - 0.03, 9.3, b.z); sideBrand.rotation.y = -Math.PI / 2;
      box(mat('#a6c95a'), b.x - b.w / 2 - 0.8, 4.1, b.z, 2.0, 0.28, 15);
      box(M.lit, b.x - tw / 2 - 0.05, podiumHeight + h * 0.5, b.z - td / 2, 0.12, h, 0.2, 0, false);
      box(M.teal, b.x + tw / 2 + 0.05, podiumHeight + h * 0.5, b.z + td / 2, 0.12, h, 0.2, 0, false);
    } else if (isCafe) {
      const coffeeSign = sign('COFFEE RUN', '禾多咖啡  /  TAKE A BREAK', 15, 3.8, '#ffdaa7', '#744b3d');
      const coffeeLocation = LOCATIONS.find(loc => loc.id === 'coffee');
      const coffeeSide = coffeeLocation && coffeeLocation.x > b.x ? 1 : -1;
      const coffeeFacadeX = b.x + coffeeSide * (b.w / 2 + 0.14);
      coffeeSign.position.set(coffeeFacadeX, 6.9, b.z); coffeeSign.rotation.y = coffeeSide * Math.PI / 2;
      for (let a = -3; a <= 3; a++) {
        box(a % 2 ? mat('#d3936f') : mat('#e9d9b1'), coffeeFacadeX + coffeeSide, 3.9, b.z + a * 2, 2.5, 0.28, 2);
      }
    } else if (b.kind === 'lab' || (b.x === -30 && b.z === -90)) {
      const lab = sign('IDEA LAB', '靈感正在加班', 14, 4.5, '#83ead9');
      lab.position.set(facadeX - 0.02, 8, b.z); lab.rotation.y = -Math.PI / 2;
    } else if (b.kind === 'meeting' || (b.x === 90 && b.z === -30)) {
      const meeting = sign('THE MEETING', '這場會議沒有結論', 16, 4.6, '#eab9a6');
      meeting.position.set(facadeX - 0.02, 8, b.z); meeting.rotation.y = -Math.PI / 2;
    } else if (isCourt) {
      const sport = sign('AFTER HOURS', '下班了，換你上場', 20, 4, '#a8e7da');
      sport.position.set(b.x, 3, b.z - b.d / 2 - 0.12); sport.rotation.y = Math.PI;
    } else if (b.kind === 'finance') {
      const finance = sign('PAPER TRAIL', '財務收件站  /  KEEP THE RECEIPT', 15, 4, '#d8c6f0');
      const location = LOCATIONS.find(loc => loc.id === 'finance');
      const side = location && location.x > b.x ? 1 : -1;
      finance.position.set(b.x + side * (b.w / 2 + 0.14), 7.8, b.z); finance.rotation.y = side * Math.PI / 2;
    }
  });

  // Riverfront railing, promenade, dock and planted verge complete the map edge.
  for (const s of [-1, 1]) {
    box(M.sidewalk, s * 136.5, 0.12, 0, 7, 0.24, 277);
    box(M.sidewalk, 0, 0.12, s * 136.5, 277, 0.24, 7);
    box(M.metal, s * 139.5, 1.25, 0, 0.11, 0.11, 279);
    box(M.metal, 0, 1.25, s * 139.5, 279, 0.11, 0.11);
    for (let a = -135; a <= 135; a += 9) {
      cylinder(M.metal, s * 139.5, 0.7, a, 0.08, 1.4);
      cylinder(M.metal, a, 0.7, s * 139.5, 0.08, 1.4);
      if (a % 27 === 0) { tree(s * 135.5, a, 0.9, true); tree(a, s * 135.5, 0.9, true); }
    }
  }
  const dockMaterial = mat('#9d8065');
  box(dockMaterial, 0, -0.1, 153, 17, 0.7, 28);
  for (let p = 141; p < 167; p += 2) box(M.bark, 0, 0.27, p, 17, 0.05, 0.09);
  for (const s of [-1, 1]) for (const p of [143, 153, 163]) cylinder(M.bark, s * 7.6, -0.1, p, 0.3, 3);
  const harbor = sign('CLOCK OUT', '河岸散步  /  不用打卡', 9, 3, '#d9e99b'); harbor.position.set(0, 5.2, 136); harbor.rotation.y = Math.PI;
  box(M.metal, -4, 2.5, 136, 0.2, 5, 0.2); box(M.metal, 4, 2.5, 136, 0.2, 5, 0.2);
  for (const loc of LOCATIONS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.72, 48), mat(loc.color || '#e7ef9b', { emissive: loc.color || '#e7ef9b', emissiveIntensity: 0.4, transparent: true, opacity: 0.7 }));
    geometries.add(ring.geometry); ring.rotation.x = -Math.PI / 2; ring.position.set(loc.x, 0.045, loc.z); scene.add(ring);
  }

  for (const { geometry, material, matrices, cast } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = cast; mesh.receiveShadow = true; scene.add(mesh);
  }
  batches.clear();

  const movingGeometries = new Map();
  const geo = (name, make) => {
    if (!movingGeometries.has(name)) { const g = make(); movingGeometries.set(name, g); geometries.add(g); }
    return movingGeometries.get(name);
  };
  function part(parent, geometry, material, position, scale, rotation) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = false; mesh.receiveShadow = false; parent.add(mesh); return mesh;
  }
  // Merge fixed parts by material once, so a car does not cost dozens of draw calls.
  // Animated doors stay separate, and all cars share geometry/material caches.
  function mergeFixedParts(group, ownedGeometries = null) {
    const groups = new Map();
    for (const child of [...group.children]) {
      if (!child.isMesh) continue;
      child.updateMatrix();
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      if (!groups.has(child.material)) groups.set(child.material, []);
      groups.get(child.material).push(geometry); group.remove(child);
    }
    for (const [material, pieces] of groups) {
      const geometry = new THREE.BufferGeometry();
      for (const attributeName of ['position', 'normal', 'uv']) {
        if (pieces.some(piece => !piece.attributes[attributeName])) continue;
        const itemSize = pieces[0].attributes[attributeName].itemSize;
        const length = pieces.reduce((n, piece) => n + piece.attributes[attributeName].array.length, 0);
        const array = new Float32Array(length); let offset = 0;
        for (const piece of pieces) { array.set(piece.attributes[attributeName].array, offset); offset += piece.attributes[attributeName].array.length; }
        geometry.setAttribute(attributeName, new THREE.BufferAttribute(array, itemSize));
      }
      pieces.forEach(piece => piece.dispose()); geometry.computeBoundingSphere(); geometries.add(geometry); ownedGeometries?.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); group.add(mesh);
    }
  }
  const contactMaterial = new THREE.MeshBasicMaterial({ color: '#172c31', transparent: true, opacity: 0.27, depthWrite: false });
  materials.set('contactShadow', contactMaterial);
  const contactGeometry = geo('contact', () => new THREE.CircleGeometry(1, 20));
  function contact(parent, x, z) {
    return part(parent, contactGeometry, contactMaterial, [0, 0.015, 0], [x, z, 1], [-Math.PI / 2, 0, 0]);
  }
  let policeDecalMaterial = null;
  function policeDecal() {
    if (policeDecalMaterial) return policeDecalMaterial;
    // Original local lettering; one texture shared by every police car and door.
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#eef4ef'; ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#112936'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 56px "Arial", "Noto Sans TC", sans-serif'; ctx.fillText('禾多警察', 256, 47);
    ctx.font = '900 56px "Arial", sans-serif'; ctx.fillText('POLICE', 256, 116);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; textures.add(texture);
    policeDecalMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false });
    materials.set('policeDecal', policeDecalMaterial); return policeDecalMaterial;
  }
  const policeWhite = mat('#eef4ef', { metalness: 0.2, roughness: 0.34 });
  const policeRedOff = mat('#601b2e'), policeBlueOff = mat('#173f74');
  const policeRedOn = new THREE.MeshBasicMaterial({ color: '#ff3650', toneMapped: false });
  const policeBlueOn = new THREE.MeshBasicMaterial({ color: '#35a9ff', toneMapped: false });
  const policeRedDim = new THREE.MeshBasicMaterial({ color: '#a64552', toneMapped: false });
  const policeBlueDim = new THREE.MeshBasicMaterial({ color: '#3b6e9b', toneMapped: false });
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  materials.set('policeRedOn', policeRedOn); materials.set('policeBlueOn', policeBlueOn);
  materials.set('policeRedDim', policeRedDim); materials.set('policeBlueDim', policeBlueDim);
  function car(color, kind = null, id = '') {
    const police = kind === 'police'; const ownedGeometries = new Set();
    const group = new THREE.Group(); group.name = `vehicle:${id}`;
    const paint = mat(police ? '#17232e' : color || '#b5c7b8', { metalness: 0.28, roughness: 0.32 });
    const rubber = mat('#182329'); const chrome = mat('#6f8a8c', { metalness: 0.75, roughness: 0.3 });
    part(group, boxGeometry, rubber, [0, 0.38, 0], [1.82, 0.38, 3.65]);
    part(group, boxGeometry, paint, [0, 0.62, 0], [1.95, 0.28, 3.92]);
    part(group, boxGeometry, paint, [0, 0.86, -1.31], [1.93, 0.27, 1.3]);
    part(group, boxGeometry, paint, [0, 0.87, 1.4], [1.93, 0.3, 1.08]);
    const cabinGeometry = geo('cabin', () => {
      const v = new Float32Array([-0.8,0,-0.95, 0.8,0,-0.95, 0.8,0,1.05, -0.8,0,1.05, -0.65,0.64,-0.5, 0.65,0.64,-0.5, 0.65,0.64,0.57, -0.65,0.64,0.57]);
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(v,3));
      // Both side openings belong to working doors, including a safe passenger-side exit.
      g.setIndex([0,4,5,0,5,1,2,6,7,2,7,3,4,7,6,4,6,5]); g.computeVertexNormals(); return g;
    });
    part(group, cabinGeometry, M.glass, [0, 0.98, 0.04], [1, 1, 1]);
    part(group, boxGeometry, police ? policeWhite : paint, [0, 1.64, 0.08], [1.34, 0.09, 1.12]);
    for (const x of [-0.99, 0.99]) for (const z of [-1.21, 1.21]) {
      part(group, geo('wheel', () => new THREE.CylinderGeometry(0.43, 0.43, 0.28, 12)), rubber, [x, 0.44, z], [1,1,1], [0,0,Math.PI/2]);
      part(group, geo('rim', () => new THREE.CylinderGeometry(0.24, 0.24, 0.29, 8)), chrome, [x, 0.44, z], [1,1,1], [0,0,Math.PI/2]);
    }
    for (const x of [-0.65, 0.65]) {
      part(group, boxGeometry, M.lit, [x, 0.83, -1.976], [0.52, 0.16, 0.04]);
      part(group, boxGeometry, M.red, [x, 0.84, 1.978], [0.51, 0.13, 0.04]);
      part(group, boxGeometry, paint, [x < 0 ? -1.02 : 1.02, 1.13, -0.5], [0.2, 0.15, 0.3]);
    }
    part(group, boxGeometry, rubber, [0, 0.48, -2.0], [1.56, 0.12, 0.06]);
    part(group, boxGeometry, rubber, [0, 0.48, 2.0], [1.56, 0.12, 0.06]);
    part(group, boxGeometry, M.white, [0, 0.66, 1.995], [0.52, 0.15, 0.02]);
    if (police) {
      for (const side of [-1, 1]) part(group, boxGeometry, policeWhite, [side * 0.985, 0.65, 0], [0.075, 0.17, 2.05]);
      part(group, boxGeometry, rubber, [0, 1.76, 0.05], [1.43, 0.15, 0.43]);
      part(group, planeGeometry, policeDecal(), [0, 1.005, -1.33], [1.45, 0.66, 1], [-Math.PI / 2, 0, 0]);
    }
    mergeFixedParts(group, ownedGeometries);
    const door = new THREE.Group(); door.position.set(-0.96, 0.73, -0.88); group.add(door);
    part(door, boxGeometry, police ? policeWhite : paint, [0, 0.13, 0.78], [0.11, 0.44, 1.57]);
    part(door, boxGeometry, M.glass, [0.1, 0.62, 0.76], [0.06, 0.55, 1.16]);
    part(door, boxGeometry, chrome, [-0.065, police ? 0.33 : 0.25, 1.19], [0.035, 0.06, 0.22]);
    mergeFixedParts(door, ownedGeometries);
    const passengerDoor = door.clone(); passengerDoor.position.x = 0.96; passengerDoor.scale.x = -1; group.add(passengerDoor);
    let redFlash = null, blueFlash = null;
    if (police) {
      part(door, planeGeometry, policeDecal(), [-0.061, 0.13, 0.78], [1.32, 0.38, 1], [0, -Math.PI / 2, 0]);
      // Mirror the passenger lettering as well as the door so it reads normally outside.
      part(passengerDoor, planeGeometry, policeDecal(), [-0.061, 0.13, 0.78], [-1.32, 0.38, 1], [0, -Math.PI / 2, 0]);
      redFlash = part(group, boxGeometry, policeRedOff, [-0.38, 1.92, 0.05], [0.61, 0.2, 0.35]);
      blueFlash = part(group, boxGeometry, policeBlueOff, [0.38, 1.92, 0.05], [0.61, 0.2, 0.35]);
    }
    const occupant = new THREE.Group(); group.add(occupant);
    // A small side silhouette makes occupied cars distinguishable before taking one.
    part(occupant, sphereGeometry, mat('#c99070'), [-0.77, 1.37, 0.03], [0.12, 0.16, 0.14]);
    part(occupant, boxGeometry, mat(police ? '#243b55' : '#8aaeb8'), [-0.77, 1.13, 0.08], [0.13, 0.29, 0.3]);
    contact(group, 1.32, 2.4);
    scene.add(group); return { group, door, passengerDoor, occupant, police, redFlash, blueFlash, ownedGeometries, flashOffset: [...String(id)].reduce((n, char) => n + char.charCodeAt(0), 0) % 8 };
  }
  // This is the authoritative fleet supplied by game physics, including parked cars.
  // No visual-only traffic or permanently owned player vehicle is created.
  const fleetModels = new Map(); const visibleFleetIds = new Set();
  function releaseCar(id, model) {
    scene.remove(model.group);
    for (const geometry of model.ownedGeometries) { geometry.dispose(); geometries.delete(geometry); }
    model.ownedGeometries.clear(); fleetModels.delete(id);
  }

  function person(tint = '#e6d79f', small = false) {
    const group = new THREE.Group(); const shirt = mat(tint); const skin = mat('#c99070'); const trousers = mat('#283c4a');
    part(group, boxGeometry, shirt, [0,1.29,0], [0.55,0.68,0.31]);
    part(group, sphereGeometry, skin, [0,1.88,0], [0.22,0.26,0.23]);
    part(group, boxGeometry, M.metal, [0,2.06,0.04], [0.43,0.12,0.42]);
    const legs = [];
    for (const s of [-1,1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.16,0.98,0); group.add(leg);
      part(leg, boxGeometry, trousers, [0,-0.37,0], [0.21,0.74,0.25]);
      part(leg, boxGeometry, M.white, [0,-0.78,-0.075], [0.25,0.12,0.39]); legs.push(leg);
    }
    const arms = [];
    for (const s of [-1,1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.36,1.56,0); group.add(arm);
      part(arm, boxGeometry, shirt, [0,-0.19,0], [0.17,0.44,0.22]);
      part(arm, boxGeometry, skin, [0,-0.46,0], [0.16,0.2,0.19]); arms.push(arm);
    }
    if (!small) part(group, boxGeometry, mat('#a1c969'), [0,1.34,0.25], [0.43,0.5,0.2]);
    scene.add(group); return { group, legs, arms };
  }
  const walker = person(); walker.group.scale.setScalar(1.08); const walkerShadow = contact(walker.group, 0.44, 0.38);
  const displacedDriver = person('#8aaeb8', true); displacedDriver.group.visible = false;
  const pedestrians = [];
  for (let i = 0; i < 12; i++) {
    const p = person(['#ddaa8b','#b4c5aa','#80b8b2','#d6c380'][i%4], true);
    pedestrians.push({...p, x: (i%4-1.5)*60, z: (Math.floor(i/4)%4-1.5)*60, offset: seed(i+800)*35, side: i%2?1:-1});
  }

  const beaconMaterial = new THREE.MeshBasicMaterial({ color: '#e3f58c', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
  const targetRingMaterial = new THREE.MeshBasicMaterial({ color: '#e3f58c', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  materials.set('beacon', beaconMaterial); materials.set('targetRing', targetRingMaterial);
  const beaconGeometry = new THREE.CylinderGeometry(2.4, 2.4, 27, 32, 1, true); geometries.add(beaconGeometry);
  const beacon = new THREE.Mesh(beaconGeometry, beaconMaterial); scene.add(beacon);
  const ringGeometry = new THREE.RingGeometry(2.7, 3.1, 64); geometries.add(ringGeometry);
  const targetRing = new THREE.Mesh(ringGeometry, targetRingMaterial); targetRing.rotation.x = -Math.PI / 2; scene.add(targetRing);
  const marker = new THREE.Group();
  part(marker, geo('marker', () => new THREE.OctahedronGeometry(0.85)), M.yellow, [0,0,0],[1,1.5,1]); scene.add(marker);
  const selectionMaterial = new THREE.MeshBasicMaterial({ color: '#e7fa9d', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  materials.set('vehicleSelection', selectionMaterial);
  const selectionGeometry = new THREE.RingGeometry(0.48, 0.57, 24); geometries.add(selectionGeometry);
  const vehicleSelection = new THREE.Mesh(selectionGeometry, selectionMaterial);
  vehicleSelection.rotation.x = -Math.PI / 2; vehicleSelection.visible = false; scene.add(vehicleSelection);
  const cameraTarget = new THREE.Vector3(); const desiredCamera = new THREE.Vector3(); const desiredTarget = new THREE.Vector3();
  const boom = new THREE.Vector3(); const collisionOrigin = new THREE.Vector3();
  const cameraObstacles = BUILDINGS.map(b => ({
    minX: b.x - b.w / 2 - 0.55, maxX: b.x + b.w / 2 + 0.55,
    minZ: b.z - b.d / 2 - 0.55, maxZ: b.z + b.d / 2 + 0.55,
    maxY: Math.max(8, b.h || 20) + 7,
  }));
  const clamp = THREE.MathUtils.clamp;
  const ease = v => { const n = clamp(v, 0, 1); return n * n * (3 - 2 * n); };
  const lowPower = (navigator.hardwareConcurrency || 8) <= 4;
  let previousTime = null, animationTime = 0, initialized = false, lastNight = -1, disposed = false;
  let sceneWasCinematic = false, qualityMode = 'auto', autoScale = lowPower ? 0.85 : 1.0;
  let frameAverage = 1 / 60, qualityClock = 0, lastFrameStamp = 0, appliedDpr = 0;
  let renderWidth = 1, renderHeight = 1, qualityLow = lowPower;

  function applyQuality() {
    qualityLow = qualityMode === 'low' || (qualityMode === 'auto' && (lowPower || autoScale < 0.8));
    const pixelBudget = qualityMode === 'low' ? 850000 : qualityMode === 'high' ? 2200000 : 1450000;
    const ceiling = qualityMode === 'low' ? 1 : 1.25;
    const scale = qualityMode === 'auto' ? autoScale : 1;
    const dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, ceiling, Math.sqrt(pixelBudget / (renderWidth * renderHeight))) * scale);
    if (Math.abs(dpr - appliedDpr) > 0.025) { renderer.setPixelRatio(dpr); renderer.setSize(renderWidth, renderHeight, false); appliedDpr = dpr; }
    if (renderer.shadowMap.enabled === qualityLow) {
      renderer.shadowMap.enabled = !qualityLow;
      if (!qualityLow) renderer.shadowMap.needsUpdate = true;
    }
  }
  function resize() {
    renderWidth = Math.max(1, container.clientWidth || window.innerWidth);
    renderHeight = Math.max(1, container.clientHeight || window.innerHeight);
    applyQuality(); renderer.setSize(renderWidth, renderHeight, false);
    camera.aspect = renderWidth / renderHeight; camera.updateProjectionMatrix();
  }
  // Intersect the camera boom with expanded building boxes. Pull in toward the
  // person at a wall; never teleport above a roof or lose street-level orientation.
  function shortenCamera(from, to) {
    boom.subVectors(to, from); let distanceFraction = 1;
    for (const b of cameraObstacles) {
      let near = 0, far = distanceFraction;
      if (Math.abs(boom.x) < 0.00001) { if (from.x < b.minX || from.x > b.maxX) continue; }
      else {
        let a = (b.minX - from.x) / boom.x, c = (b.maxX - from.x) / boom.x;
        if (a > c) { const temp = a; a = c; c = temp; }
        near = Math.max(near, a); far = Math.min(far, c); if (near > far) continue;
      }
      if (Math.abs(boom.z) < 0.00001) { if (from.z < b.minZ || from.z > b.maxZ) continue; }
      else {
        let a = (b.minZ - from.z) / boom.z, c = (b.maxZ - from.z) / boom.z;
        if (a > c) { const temp = a; a = c; c = temp; }
        near = Math.max(near, a); far = Math.min(far, c); if (near > far) continue;
      }
      if (Math.abs(boom.y) < 0.00001) { if (from.y < 0 || from.y > b.maxY) continue; }
      else {
        let a = -from.y / boom.y, c = (b.maxY - from.y) / boom.y;
        if (a > c) { const temp = a; a = c; c = temp; }
        near = Math.max(near, a); far = Math.min(far, c); if (near > far) continue;
      }
      if (near > 0.015) distanceFraction = Math.min(distanceFraction, Math.max(0.04, near - 0.035));
    }
    if (distanceFraction < 1) to.copy(from).addScaledVector(boom, distanceFraction);
  }
  function animatePerson(model, phase, stride) {
    model.legs[0].rotation.x = -Math.sin(phase) * stride; model.legs[1].rotation.x = Math.sin(phase) * stride;
    model.arms[0].rotation.x = Math.sin(phase) * stride * 0.8; model.arms[1].rotation.x = -Math.sin(phase) * stride * 0.8;
  }
  function update(actor = SPAWN, {
    time = 0, dt: suppliedDt, walking = true, controlledId = null, fleet = [], transition = null,
    cameraYaw, cameraPitch, lookActive = false, quality = 'auto', selectedCarId = null,
    night = false, target = null, heat = 0, cinematic = false, cameraMode = 'chase',
  } = {}) {
    if (disposed) return;
    const clock = Number.isFinite(time) ? time : 0;
    const dt = Number.isFinite(suppliedDt) ? clamp(suppliedDt, 0, 0.06) : previousTime === null ? 0 : clamp(clock - previousTime, 0, 0.06);
    previousTime = clock; animationTime += dt; const t = animationTime;
    const px = Number.isFinite(actor.x) ? actor.x : SPAWN.x, pz = Number.isFinite(actor.z) ? actor.z : SPAWN.z;
    const heading = Number.isFinite(actor.heading) ? actor.heading : 0;
    const speed = Number.isFinite(actor.speed) ? actor.speed : 0;
    const yaw = Number.isFinite(cameraYaw) ? cameraYaw : heading;
    const pitch = clamp(Number.isFinite(cameraPitch) ? cameraPitch : walking ? 0.34 : 0.28, 0.10, 1.05);
    const stamp = performance.now();
    if (dt > 0 && lastFrameStamp) {
      const interval = Math.min(0.15, (stamp - lastFrameStamp) / 1000);
      frameAverage += (interval - frameAverage) * 0.035; qualityClock += dt;
      if (qualityClock > 4) {
        if (qualityMode === 'auto' && frameAverage > 0.026 && autoScale > 0.65) { autoScale = Math.max(0.65, autoScale - 0.1); applyQuality(); }
        qualityClock = 0;
      }
    }
    lastFrameStamp = dt > 0 ? stamp : 0;
    if (['auto', 'low', 'high'].includes(quality) && quality !== qualityMode) { qualityMode = quality; applyQuality(); }
    let transitionCar = null, selectedCar = null;
    visibleFleetIds.clear(); for (const state of fleet) visibleFleetIds.add(state.id);
    for (const [id, model] of fleetModels) if (!visibleFleetIds.has(id)) releaseCar(id, model);
    for (const state of fleet) {
      let model = fleetModels.get(state.id);
      if (model && model.police !== (state.kind === 'police')) { releaseCar(state.id, model); model = null; }
      if (!model) { model = car(state.color, state.kind, state.id); fleetModels.set(state.id, model); }
      model.group.position.set(state.x, 0.04, state.z); model.group.rotation.y = -state.heading;
      model.group.visible = Math.hypot(state.x - px, state.z - pz) < (qualityLow ? 105 : 150) || cameraMode === 'aerial' || cinematic;
      model.occupant.visible = Boolean(state.occupied) && state.id !== controlledId;
      model.door.rotation.y = model.passengerDoor.rotation.y = 0;
      if (model.police) {
        // Alternate just twice per second; reduced-motion uses steady dim colors.
        // Shared unlit materials keep this independent of dynamic light/shadow passes.
        const flash = Math.floor(t * 2 + model.flashOffset) % 2;
        const siren = state.siren !== false;
        const steady = reducedMotion?.matches;
        model.redFlash.material = !siren ? policeRedOff : steady ? policeRedDim : flash === 0 ? policeRedOn : policeRedOff;
        model.blueFlash.material = !siren ? policeBlueOff : steady ? policeBlueDim : flash === 1 ? policeBlueOn : policeBlueOff;
      }
      if (state.id === transition?.carId) transitionCar = state;
      if (state.id === selectedCarId && state.kind !== 'police') selectedCar = state;
    }
    const jump = Number.isFinite(actor.y) ? Math.max(0, actor.y) : 0;
    walker.group.visible = walking || Boolean(transition);
    walker.group.position.set(px, 0.05 + jump, pz); walker.group.rotation.y = -heading;
    walkerShadow.position.y = 0.015 - jump / 1.08;
    animatePerson(walker, t * (Math.abs(speed) > 7 ? 13 : 9), Math.min(0.7, Math.abs(speed) * 0.13));
    if (jump > 0.03) { walker.legs[0].rotation.x = -0.35; walker.legs[1].rotation.x = 0.45; walker.arms[0].rotation.x = walker.arms[1].rotation.x = -0.5; }
    displacedDriver.group.visible = false;
    if (transition && transitionCar) {
      const p = clamp(transition.progress || 0, 0, 1), carHeading = transitionCar.heading;
      const cx = Math.cos(carHeading), sz = Math.sin(carHeading);
      const from = transition.from || actor;
      const reference = transition.kind === 'exit' ? transition.to || from : from;
      const lateral = (reference.x - transitionCar.x) * cx + (reference.z - transitionCar.z) * sz;
      let side = lateral > 0.05 ? 1 : -1;
      // A centered rear escape has no side encoded in its endpoint. Prefer a door
      // that has clearance, while still finishing at the physics-validated target.
      if (transition.kind === 'exit' && Math.abs(lateral) <= 0.05) {
        const leftX = transitionCar.x - cx * 1.9, leftZ = transitionCar.z - sz * 1.9;
        const leftBlocked = BUILDINGS.some(b => Math.abs(leftX - b.x) < b.w / 2 + 0.55 && Math.abs(leftZ - b.z) < b.d / 2 + 0.55)
          || fleet.some(other => other.id !== transitionCar.id && Math.hypot(other.x - leftX, other.z - leftZ) < 1.8);
        if (leftBlocked) side = 1;
      }
      const dx = transitionCar.x + cx * side * 1.6, dz = transitionCar.z + sz * side * 1.6;
      const model = fleetModels.get(transitionCar.id);
      const activeDoor = side < 0 ? model.door : model.passengerDoor;
      activeDoor.rotation.y = side * 1.13 * ease(p / 0.2) * (1 - ease((p - 0.78) / 0.22));
      model.occupant.visible = transition.kind === 'steal' && p < 0.24;
      if (transition.kind === 'exit') {
        const move = ease(p / 0.9);
        const startX = transitionCar.x + cx * side * 0.35, startZ = transitionCar.z + sz * side * 0.35;
        const toX = transition.to?.x ?? transitionCar.x + cx * side * 1.9;
        const toZ = transition.to?.z ?? transitionCar.z + sz * side * 1.9;
        walker.group.position.set(THREE.MathUtils.lerp(startX, toX, move), 0.05, THREE.MathUtils.lerp(startZ, toZ, move));
        const outwardHeading = carHeading + side * Math.PI / 2;
        const finalHeading = transition.to?.heading ?? carHeading;
        const headingDelta = Math.atan2(Math.sin(finalHeading - outwardHeading), Math.cos(finalHeading - outwardHeading));
        walker.group.visible = p > 0.12;
        walker.group.rotation.y = -(outwardHeading + headingDelta * ease((p - 0.65) / 0.35));
      } else {
        const approach = ease(p / 0.4), enter = ease((p - 0.63) / 0.32);
        walker.group.position.set(THREE.MathUtils.lerp(from.x, dx, approach) - cx * side * enter, 0.05 - enter * 0.2, THREE.MathUtils.lerp(from.z, dz, approach) - sz * side * enter);
        walker.group.rotation.y = -(carHeading - side * Math.PI / 2); walker.group.visible = p < 0.94;
        if (transition.kind === 'steal' && p > 0.22) {
          const leave = ease((p - 0.22) / 0.28), flee = Math.max(0, p - 0.48) * 8;
          displacedDriver.group.visible = true;
          displacedDriver.group.position.set(transitionCar.x + cx * side * (0.35 + leave * 1.8 + flee), 0.05, transitionCar.z + sz * side * (0.35 + leave * 1.8 + flee));
          displacedDriver.group.rotation.y = -(carHeading + side * Math.PI / 2);
          animatePerson(displacedDriver, t * 15, 0.65);
        }
      }
      animatePerson(walker, t * 8, 0.28 * (transition.kind === 'exit' ? 1 - ease((p - 0.7) / 0.3) : 1));
    }

    vehicleSelection.visible = Boolean(walking && selectedCar && !transition);
    if (vehicleSelection.visible) {
      const selectionSide = (px - selectedCar.x) * Math.cos(selectedCar.heading) + (pz - selectedCar.z) * Math.sin(selectedCar.heading) > 0 ? 1 : -1;
      vehicleSelection.position.set(selectedCar.x + Math.cos(selectedCar.heading) * selectionSide * 1.7, 0.06, selectedCar.z + Math.sin(selectedCar.heading) * selectionSide * 1.7);
      selectionMaterial.opacity = 0.7 + Math.sin(t * 4) * 0.15;
    }
    for (let i = 0; i < pedestrians.length; i++) {
      const person = pedestrians[i], walk = ((t * 0.65 + person.offset) % 34) - 17;
      person.group.position.set(person.x + person.side * 20.7, 0.35, person.z + walk);
      person.group.visible = (cameraMode === 'aerial' || Math.hypot(person.group.position.x - px, person.group.position.z - pz) < (qualityLow ? 48 : 78)) && (!qualityLow || i % 2 === 0);
      if (person.group.visible) { person.group.rotation.y = Math.PI; animatePerson(person, t * 4 + i, 0.3); }
    }
    const darkness = typeof night === 'number' ? clamp(night, 0, 1) : night ? 1 : 0;
    if (darkness !== lastNight) {
      scene.background.copy(daylight).lerp(nighttime, darkness); scene.fog.color.copy(scene.background);
      hemi.intensity = 2.2 - darkness * 1.15; sun.intensity = 3.5 - darkness * 3.05;
      rim.intensity = 1.2 - darkness * 0.4; renderer.toneMappingExposure = 1.18 - darkness * 0.14;
      M.lit.emissiveIntensity = 0.7 + darkness * 1.3; M.dim.emissiveIntensity = 0.15 + darkness * 0.35;
      sunDisk.visible = darkness < 0.65; lastNight = darkness;
    }
    beacon.visible = targetRing.visible = marker.visible = Boolean(target);
    if (target) {
      beacon.position.set(target.x, 13.5, target.z); targetRing.position.set(target.x, 0.07, target.z);
      marker.position.set(target.x, 5 + Math.sin(t * 2) * 0.45, target.z); marker.rotation.y = t * 0.7;
      const color = target.color || '#e3f58c'; beaconMaterial.color.set(color); targetRingMaterial.color.set(color);
      beaconMaterial.opacity = 0.09 + Math.sin(t * 2) * 0.025;
      targetRing.scale.setScalar(1 + Math.sin(t * 2.5) * 0.05);
    }
    let desiredFov;
    if (cinematic) {
      const orbit = Math.sin(t * 0.035) * 0.12;
      desiredCamera.set(px - 17 + orbit * 5, 15, pz + 30 + orbit * 4);
      desiredTarget.set(px - 11, 5, pz - 23); desiredFov = 48;
    } else if (cameraMode === 'aerial') {
      desiredCamera.set(px - Math.sin(yaw) * 37, 63, pz + Math.cos(yaw) * 37);
      desiredTarget.set(px, 0, pz); desiredFov = 50;
    } else {
      const followDistance = walking ? 8.6 : 12.5 + Math.min(4, Math.abs(speed) * 0.09);
      const lookAhead = walking ? 0.2 : 2 + Math.min(2.5, Math.abs(speed) * 0.05);
      // Keep the target near ground level during jumps; the whole view should not bob.
      const targetHeight = walking ? 1.5 + jump * 0.2 : 1.25;
      desiredTarget.set(px + Math.sin(yaw) * lookAhead, targetHeight, pz - Math.cos(yaw) * lookAhead);
      desiredCamera.set(px - Math.sin(yaw) * followDistance * Math.cos(pitch), targetHeight + followDistance * Math.sin(pitch), pz + Math.cos(yaw) * followDistance * Math.cos(pitch));
      desiredFov = walking ? 58 : 55 + Math.min(8, Math.abs(speed) * 0.12);
      collisionOrigin.set(px, targetHeight, pz); shortenCamera(collisionOrigin, desiredCamera);
    }
    if (!initialized || (sceneWasCinematic && !cinematic)) {
      camera.position.copy(desiredCamera); cameraTarget.copy(desiredTarget); camera.fov = desiredFov; initialized = true;
    } else if (dt > 0) {
      const smooth = 1 - Math.exp(-dt * (cinematic ? 2 : walking ? 18 : lookActive ? 14 : 10));
      camera.position.lerp(desiredCamera, smooth); cameraTarget.lerp(desiredTarget, smooth);
      camera.fov += (desiredFov - camera.fov) * (1 - Math.exp(-dt * 5));
    }
    sceneWasCinematic = cinematic;
    // The interpolated boom also needs collision testing when moving around corners.
    if (!cinematic && cameraMode !== 'aerial') shortenCamera(collisionOrigin, camera.position);
    if (walking && !transition && !cinematic && Math.hypot(camera.position.x - px, camera.position.z - pz) < 1.15) walker.group.visible = false;
    camera.lookAt(cameraTarget); camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function getStats() {
    return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: appliedDpr,
      quality: qualityMode, reduced: qualityLow, averageFrameMs: Math.round(frameAverage * 10000) / 10,
      fleetModels: fleetModels.size, policeModels: [...fleetModels.values()].filter(model => model.police).length,
      geometryCount: renderer.info.memory.geometries, textureCount: renderer.info.memory.textures, camera: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z } };
  }

  function dispose() {
    if (disposed) return; disposed = true;
    geometries.forEach(g=>g.dispose()); materials.forEach(m=>m.dispose()); textures.forEach(t=>t.dispose());
    renderer.dispose(); renderer.domElement.remove();
  }
  resize(); update(SPAWN, { time: 0, dt: 0, walking: true, cinematic: true });
  onReady?.();
  return { update, resize, dispose, getStats };
}
