import * as THREE from '../island/vendor/three.module.js';

// Original pre-rendered directional art over a real, lit 3D dungeon. Gameplay
// remains in engine.js; this module only projects and animates its snapshots.
const ROOT = new URL('./assets/', import.meta.url);
export function directionFrame(heading, cameraBearing, count = 8) {
  return ((Math.round((cameraBearing - heading) / (Math.PI * 2) * count) % count) + count) % count;
}
const ACTORS = {
  jack: { file: 'jack-8dir.webp', columns: 4, rows: 2, height: 2.75, baseline: 490 / 512 },
  jackMug: { file: 'jack-mug-8dir.webp', columns: 4, rows: 2, height: 2.75, baseline: 490 / 512 },
  sonny: { file: 'sonny-8dir.webp', columns: 4, rows: 2, height: 4.25, baseline: 490 / 512 },
  meimei: { file: 'meimei-atlas.webp', columns: 4, rows: 2, height: 3.9, baseline: 490 / 512 },
  wing: { file: 'wing-atlas.webp', columns: 4, rows: 2, height: 5.65, baseline: 490 / 512 },
  bug: { file: 'sludge-atlas.webp', columns: 4, rows: 1, height: 2.2, baseline: 460 / 480 },
  paper: { file: 'wraith-atlas.webp', columns: 4, rows: 1, height: 2.85, baseline: 460 / 480 },
  guard: { file: 'golem-atlas.webp', columns: 4, rows: 1, height: 3.15, baseline: 460 / 480 },
};

export function createArtLayer({ scene, camera, renderer, materials: targets }) {
  const loader = new THREE.TextureLoader();
  const textures = new Set(), materials = new Set(), geometries = new Set();
  const sheets = new Map(), fading = [], torches = [], fires = [], scenery = [];
  const inverse = new THREE.Quaternion();
  const healthOffset = new THREE.Vector3();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let destroyed = false, elapsed = 0;
  const rememberMaterial = value => { materials.add(value); return value; };
  const rememberGeometry = value => { geometries.add(value); return value; };
  function load(path, complete) {
    const texture = loader.load(new URL(path, ROOT).href, value => {
      if (destroyed) { value.dispose(); return; }
      complete?.(value);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    textures.add(texture);
    return texture;
  }
  for (const [id, spec] of Object.entries(ACTORS)) {
    sheets.set(id, { ...spec, ready: false });
    const sheet = sheets.get(id);
    sheet.texture = load(`actors-v3/${spec.file}`, texture => {
      sheet.ready = true;
      sheet.aspect = texture.image.width / spec.columns / (texture.image.height / spec.rows);
    });
  }
  load('world-v3/dungeon-floor.webp', texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    targets.floor.map = texture;
    targets.floor.bumpMap = texture;
    targets.floor.bumpScale = 0.14;
    targets.floor.roughness = 0.9;
    targets.floor.color.set('#b3a895');
    targets.floor.needsUpdate = true;
  });
  load('world-v3/dungeon-wall.webp', texture => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    for (const target of [targets.stone, targets.stone2]) {
      target.map = texture; target.bumpMap = texture; target.bumpScale = 0.16;
      target.roughness = 0.97; target.color.set(target === targets.stone ? '#81786a' : '#a59881');
      target.needsUpdate = true;
    }
  });

  // Soft mathematical density fields are used for contact shadows and airborne
  // particles; character and architectural imagery comes from real raster art.
  const density = document.createElement('canvas'); density.width = density.height = 128;
  const ctx = density.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(255,255,255,.9)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
  }
  const densityMap = new THREE.CanvasTexture(density); textures.add(densityMap);
  const shadowMaterial = rememberMaterial(new THREE.MeshBasicMaterial({ map: densityMap, color: '#070504', transparent: true, opacity: 0.8, depthWrite: false }));
  const plane = rememberGeometry(new THREE.PlaneGeometry(1, 1));
  let propsReady = false;
  const propMap = load('world-v3/gothic-props.webp', () => { propsReady = true; });
  function addScenery({ kind = 0, x, z, height = 4, width = 2, depth = 2 }) {
    const root = new THREE.Group(); root.position.set(x, 0.025, z); scene.add(root);
    const fallback = new THREE.Mesh(rememberGeometry(new THREE.BoxGeometry(width, Math.min(2, height), depth)), targets.stone);
    fallback.position.y = Math.min(2, height) / 2; root.add(fallback);
    const visual = new THREE.Group(); root.add(visual); visual.visible = false;
    const geometry = rememberGeometry(new THREE.PlaneGeometry(1, 1));
    const uv = geometry.attributes.uv, left = kind / 4 + 0.00025, right = (kind + 1) / 4 - 0.00025;
    uv.setXY(0, left, 0.999); uv.setXY(1, right, 0.999); uv.setXY(2, left, 0.001); uv.setXY(3, right, 0.001);
    const material = rememberMaterial(new THREE.MeshBasicMaterial({ map: propMap, color: '#d3c4aa', transparent: true, alphaTest: 0.06, depthWrite: true, toneMapped: false, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, material); mesh.scale.set(height, height, 1); mesh.position.y = height * (490 / 512 - 0.5);
    visual.add(mesh);
    const shadow = new THREE.Mesh(plane, shadowMaterial); shadow.rotation.x = -Math.PI / 2;
    shadow.scale.set(width * 1.5, depth * 1.15, 1); root.add(shadow);
    scenery.push({ root, visual, fallback });
  }
  const torchPositions = [[-4.8, 6], [4.8, 6], [-10.7, -3.4], [10.7, -3.4], [-10.7, -18.8], [10.7, -18.8], [-10.5, -36.5], [10.5, -36.5]];
  let flameReady = false;
  const flameMap = load('world-v3/brazier-flame.webp', () => { flameReady = true; });
  const flameMaterial = rememberMaterial(new THREE.MeshBasicMaterial({ map: flameMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.94 }));
  for (let i = 0; i < torchPositions.length; i++) {
    const root = new THREE.Group(); root.position.set(torchPositions[i][0], 1.5, torchPositions[i][1]);
    const geometry = rememberGeometry(new THREE.PlaneGeometry(1, 1));
    const mesh = new THREE.Mesh(geometry, flameMaterial); mesh.scale.set(1.8, 1.8, 1);
    mesh.position.y = 1.8 * (490 / 512 - 0.5); root.add(mesh); root.visible = false; scene.add(root);
    fires.push({ root, geometry, frame: -1, phase: i * 1.7 });
    const glow = new THREE.Mesh(plane, rememberMaterial(new THREE.MeshBasicMaterial({ map: densityMap, color: '#f6923a', transparent: true, opacity: 0.13, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.rotation.x = -Math.PI / 2; glow.scale.set(5.5, 5.5, 1); glow.position.set(torchPositions[i][0], 0.032, torchPositions[i][1]); scene.add(glow);
  }
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight('#f5a456', 43, 12, 2);
    scene.add(light); torches.push(light);
  }
  const playerLight = new THREE.PointLight('#e3c69b', 13, 7.5, 2); scene.add(playerLight);

  const smoke = [];
  const smokeMaterial = rememberMaterial(new THREE.MeshBasicMaterial({ map: densityMap, color: '#a4a89c', transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide }));
  for (let i = 0; i < 18; i++) {
    const cloud = new THREE.Mesh(plane, smokeMaterial);
    cloud.rotation.x = -Math.PI / 2; cloud.scale.set(6 + (i % 4), 3.5 + (i % 3), 1);
    cloud.position.set(Math.sin(i * 15.31) * 9, 0.18 + i % 3 * 0.11, 13 - i * 3.2);
    cloud.renderOrder = 1; scene.add(cloud);
    smoke.push({ mesh: cloud, x: cloud.position.x, z: cloud.position.z, phase: i * 2.17 });
  }
  const dustCount = window.innerWidth < 700 ? 110 : 190;
  const positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = Math.sin(i * 12.9898) * 12;
    positions[i * 3 + 1] = 0.4 + (i % 17) / 17 * 4.3;
    positions[i * 3 + 2] = 14 - (i * 7.17 % 56);
  }
  const dustGeometry = rememberGeometry(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMaterial = rememberMaterial(new THREE.PointsMaterial({ map: densityMap, color: '#dfc49b', size: 0.065, transparent: true, opacity: 0.38, depthWrite: false, sizeAttenuation: true }));
  const dust = new THREE.Points(dustGeometry, dustMaterial); scene.add(dust);

  function attach(model, id) {
    const sheet = sheets.get(id) || sheets.get('guard');
    const visual = new THREE.Group(); visual.visible = false; visual.position.y = 0.045;
    const geometry = rememberGeometry(new THREE.PlaneGeometry(1, 1));
    const material = rememberMaterial(new THREE.MeshBasicMaterial({ map: sheet.texture, color: '#c9c0ad', transparent: true, alphaTest: 0.16, depthWrite: true, toneMapped: false, side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, material); mesh.renderOrder = 2;
    visual.add(mesh); model.root.add(visual);
    let outline = null;
    if (id === 'jack') {
      const rim = rememberMaterial(new THREE.ShaderMaterial({
        uniforms: { atlas: { value: sheet.texture }, texel: { value: new THREE.Vector2(1 / 2048, 1 / 1024) } },
        vertexShader: 'varying vec2 imageUV; void main(){ imageUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: `uniform sampler2D atlas; uniform vec2 texel; varying vec2 imageUV;
          void main(){
            vec2 d=texel*5.0; float a=texture2D(atlas,imageUV).a;
            float edge=max(max(texture2D(atlas,imageUV+vec2(d.x,0.)).a,texture2D(atlas,imageUV-vec2(d.x,0.)).a),
              max(texture2D(atlas,imageUV+vec2(0.,d.y)).a,texture2D(atlas,imageUV-vec2(0.,d.y)).a));
            float rim=smoothstep(.2,.7,edge)*(1.-smoothstep(.12,.35,a));
            gl_FragColor=vec4(.94,.79,.54,rim*.75);
          }`,
        transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      }));
      outline = new THREE.Mesh(geometry, rim); outline.renderOrder = 4; visual.add(outline);
    }
    const shadow = new THREE.Mesh(plane, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.028;
    shadow.scale.set(id === 'wing' ? 3.5 : id === 'sonny' ? 2.6 : id === 'jack' ? 1.65 : 1.9, 1.5, 1);
    model.root.add(shadow);
    model.art = { id, sheet, visual, mesh, outline, geometry, material, shadow, frame: -1, hit: 0, hp: null, phase: 0 };
    return model;
  }
  function updateActor(model, { angle = 0, moved = 0, attack = 0, hp, invulnerable = false, phase, enraged = false, weapon, dt = 0 }) {
    const art = model.art;
    if (art?.id === 'jack') {
      const desired = sheets.get(weapon === 'mug' ? 'jackMug' : 'jack');
      if (desired.ready && art.sheet !== desired) {
        art.sheet = desired; art.material.map = desired.texture; art.material.needsUpdate = true; art.frame = -1;
        if (art.outline) art.outline.material.uniforms.atlas.value = desired.texture;
      }
    }
    if (!art?.sheet.ready) return;
    const { sheet, mesh, visual } = art;
    model.body.visible = false;
    model.legs.forEach(leg => { leg.visible = false; });
    if (model.offhand) model.offhand.visible = false;
    model.root.children.forEach(child => { if (child.material === targets.shadow) child.visible = false; });
    art.phase += moved * (art.id === 'bug' ? 5 : 3.8);
    if (art.hp !== null && hp < art.hp) art.hit = 0.13;
    art.hp = hp; art.hit = Math.max(0, art.hit - Math.max(0, Math.min(0.1, dt)));
    visual.visible = !invulnerable || Math.sin(elapsed * 44) > -0.6;
    inverse.copy(model.root.quaternion).invert();
    visual.quaternion.copy(camera.quaternion).premultiply(inverse);
    const cameraBearing = Math.atan2(camera.position.x - model.root.position.x, -(camera.position.z - model.root.position.z));
    const count = sheet.columns * sheet.rows;
    const frame = directionFrame(angle, cameraBearing, count);
    if (frame !== art.frame) {
      const column = frame % sheet.columns, row = Math.floor(frame / sheet.columns);
      const insetX = 0.7 / sheet.texture.image.width, insetY = 0.7 / sheet.texture.image.height;
      const left = column / sheet.columns + insetX, right = (column + 1) / sheet.columns - insetX;
      const top = 1 - row / sheet.rows - insetY, bottom = 1 - (row + 1) / sheet.rows + insetY;
      const uv = art.geometry.attributes.uv;
      uv.setXY(0, left, top); uv.setXY(1, right, top); uv.setXY(2, left, bottom); uv.setXY(3, right, bottom); uv.needsUpdate = true;
      art.frame = frame;
    }
    const swing = attack > 0 ? Math.sin(Math.min(1, attack / 0.2) * Math.PI) : phase === 'windup' ? Math.sin(elapsed * 7) * 0.2 : 0;
    const bob = moved > 0.001 && !reducedMotion ? Math.abs(Math.sin(art.phase * 2)) * 0.025 : 0;
    const hover = art.id === 'paper' && !reducedMotion ? Math.sin(elapsed * 2.5 + art.phase) * 0.07 : 0;
    const stretch = 1 + swing * 0.035;
    mesh.scale.set(sheet.height * sheet.aspect * (1 - swing * 0.025), sheet.height * stretch, 1);
    mesh.position.y = sheet.height * stretch * (sheet.baseline - 0.5) + bob + hover;
    mesh.rotation.z = reducedMotion ? 0 : swing * -0.07 + (moved > 0.001 ? Math.sin(art.phase) * 0.018 : 0);
    if (art.outline) {
      art.outline.position.copy(mesh.position); art.outline.scale.copy(mesh.scale); art.outline.rotation.copy(mesh.rotation);
    }
    art.material.color.set(art.hit > 0 ? '#ffffff' : enraged ? '#e4ae91' : '#f0e5d1');
    if (model.hp) {
      healthOffset.set(0, sheet.height * 0.91, 0).applyQuaternion(camera.quaternion).applyQuaternion(inverse);
      model.hp.group.position.copy(healthOffset);
    }
  }
  function release(model) {
    const art = model.art;
    if (!art || destroyed) return;
    if (art.sheet.ready) {
      const ghost = art.mesh.clone(); ghost.material = art.material.clone(); ghost.geometry = art.geometry.clone();
      ghost.material.depthWrite = false;
      art.mesh.getWorldQuaternion(ghost.quaternion); art.mesh.getWorldPosition(ghost.position);
      scene.add(ghost); fading.push({ mesh: ghost, life: 0.5 });
    }
    art.geometry.dispose(); geometries.delete(art.geometry);
    art.material.dispose(); materials.delete(art.material);
  }
  function update(state, dt) {
    const frameTime = Math.min(0.1, Math.max(0, dt || 0)); elapsed += frameTime;
    const player = state.player;
    scenery.forEach(item => { item.visual.visible = propsReady; item.fallback.visible = !propsReady; item.visual.quaternion.copy(camera.quaternion); });
    fires.forEach(fire => {
      fire.root.visible = flameReady; fire.root.quaternion.copy(camera.quaternion);
      const frame = reducedMotion ? 0 : Math.floor(elapsed * 11 + fire.phase) % 8;
      if (frame !== fire.frame) {
        const x = frame % 4 / 4, y = 1 - Math.floor(frame / 4) / 2;
        const uv = fire.geometry.attributes.uv;
        uv.setXY(0, x, y); uv.setXY(1, x + 0.25, y); uv.setXY(2, x, y - 0.5); uv.setXY(3, x + 0.25, y - 0.5); uv.needsUpdate = true;
        fire.frame = frame;
      }
    });
    playerLight.position.set(player.x + 0.5, 3.2, player.z + 1.7);
    const nearest = [...torchPositions].sort((a, b) => Math.hypot(a[0] - player.x, a[1] - player.z) - Math.hypot(b[0] - player.x, b[1] - player.z));
    torches.forEach((light, i) => {
      light.position.set(nearest[i][0], 2.1, nearest[i][1]);
      light.intensity = 45 + (!reducedMotion ? Math.sin(elapsed * 9 + i * 2) * 4 + Math.sin(elapsed * 17 + i) * 2 : 0);
    });
    if (!reducedMotion) {
      smoke.forEach(({ mesh, x, z, phase }) => { mesh.position.x = x + Math.sin(elapsed * 0.11 + phase) * 1.8; mesh.position.z = z + Math.cos(elapsed * 0.08 + phase) * 0.8; });
      dust.rotation.y = Math.sin(elapsed * 0.025) * 0.035;
    }
    for (let i = fading.length - 1; i >= 0; i--) {
      const item = fading[i]; item.life -= frameTime;
      item.mesh.material.opacity = Math.max(0, item.life * 2);
      item.mesh.position.y -= frameTime * 0.4;
      if (item.life <= 0) { scene.remove(item.mesh); item.mesh.material.dispose(); item.mesh.geometry.dispose(); fading.splice(i, 1); }
    }
  }
  return { attach, addScenery, updateActor, release, update, hasFlames: () => flameReady, destroy() {
    destroyed = true;
    fading.forEach(item => { item.mesh.material.dispose(); item.mesh.geometry.dispose(); }); fading.length = 0;
    textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
  } };
}
