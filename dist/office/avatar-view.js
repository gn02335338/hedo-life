import * as THREE from '../island/vendor/three.module.js';
import { OrbitControls } from '../island/vendor/OrbitControls.js';
import { mergeGeometries } from '../island/vendor/BufferGeometryUtils.js';
import { defaultOfficeAvatar, validateOfficeAvatar } from './avatar-config.js';

const PIVOTS = { root: [0, 0, 0], body: [0, .65, 0], head: [0, 1.08, 0], leftArm: [-.28, .85, 0], rightArm: [.28, .85, 0], leftLeg: [-.11, .43, 0], rightLeg: [.11, .43, 0] };
export const AVATAR_SHAPES = Object.freeze(['box', 'sphere', 'cylinder', 'cone', 'torus', 'hair']);

export function createAvatarGeometry(shape) {
  if (shape === 'sphere') return new THREE.SphereGeometry(1, 10, 7);
  if (shape === 'cylinder') return new THREE.CylinderGeometry(1, 1, 1, 10);
  if (shape === 'cone') return new THREE.ConeGeometry(1, 1, 6);
  if (shape === 'torus') return new THREE.TorusGeometry(1, .12, 4, 14);
  if (shape === 'hair') return new THREE.SphereGeometry(1, 10, 7, 0, Math.PI * 2, 0, Math.PI * .55);
  return new THREE.BoxGeometry(1, 1, 1);
}

export function avatarAppearanceKey(config = defaultOfficeAvatar()) { return JSON.stringify(validateOfficeAvatar(config)); }

// One layout feeds both the merged detailed model and the instanced overview.
// Coordinates are local to the feet; no URLs, scripts or uploaded models run.
export function getAvatarLayout(input = defaultOfficeAvatar()) {
  const config = validateOfficeAvatar(input), parts = [];
  const add = (shape, bone, color, position, scale, rotation = [0, 0, 0]) => parts.push({ shape, bone, color, position, scale, rotation });
  const box = (bone, color, p, s, r) => add('box', bone, color, p, s, r);
  const ball = (bone, color, p, s) => add('sphere', bone, color, p, s);
  const { bodyColor: body, skinColor: skin, hairColor: hair, accentColor: accent, preset } = config;
  if (preset === 'voxel' && config.voxels.length) {
    for (const voxel of config.voxels) box('root', voxel.color, [voxel.x, voxel.y, voxel.z], [voxel.w, voxel.h, voxel.d]);
  } else {
    const square = preset === 'robot' || preset === 'voxel';
    add(square ? 'box' : preset === 'cat' ? 'sphere' : 'cylinder', 'body', body, [0, .66, 0], square ? [.48, .5, .34] : preset === 'cat' ? [.29, .34, .24] : [.23, .5, .23]);
    for (const [side, x] of [['left', -.11], ['right', .11]]) {
      box(`${side}Leg`, preset === 'cat' ? body : '#52616a', [x, .23, 0], [.14, .42, .18]);
      box(`${side}Leg`, accent, [x, .055, .055], [.17, .09, .27]);
      box(`${side}Arm`, body, [x < 0 ? -.28 : .28, .65, 0], [.14, .4, .15]);
      ball(`${side}Arm`, skin, [x < 0 ? -.28 : .28, .43, 0], [.075, .075, .075]);
    }
    add(square ? 'box' : 'sphere', 'head', skin, [0, 1.08, 0], square ? [.48, .43, .4] : preset === 'cat' ? [.29, .27, .25] : [.235, .25, .235]);
    for (const x of [-.075, .075]) ball('head', '#243e42', [x, 1.1, square ? .215 : .22], [.025, .027, .022]);
    if (preset === 'robot') {
      add('cylinder', 'head', accent, [0, 1.43, 0], [.025, .22, .025]);
      ball('head', accent, [0, 1.56, 0], [.07, .07, .07]);
      box('body', accent, [0, .7, .19], [.2, .13, .035]);
    }
    if (preset === 'cat') {
      for (const x of [-.18, .18]) add('cone', 'head', body, [x, 1.38, -.02], [.12, .28, .10]);
      ball('head', accent, [0, 1.02, .235], [.045, .035, .025]);
      add('cylinder', 'body', body, [0, .56, -.31], [.055, .5, .055], [-.7, 0, 0]);
    }
    if (config.hairStyle === 'short') add('hair', 'head', hair, [0, 1.13, -.01], [.25, .26, .25]);
    if (config.hairStyle === 'long') {
      add('hair', 'head', hair, [0, 1.13, -.01], [.26, .27, .26]);
      box('head', hair, [0, .99, -.17], [.47, .48, .16]);
    }
    if (config.hairStyle === 'mohawk') box('head', hair, [0, 1.39, -.015], [.13, .25, .36]);
    if (config.accessory === 'glasses') {
      for (const x of [-.083, .083]) add('torus', 'head', '#344a4d', [x, 1.11, .253], [.085, .067, .07]);
      box('head', '#344a4d', [0, 1.11, .255], [.04, .025, .025]);
    }
    if (config.accessory === 'headphones') {
      add('torus', 'head', accent, [0, 1.14, 0], [.29, .29, .21]);
      for (const x of [-.27, .27]) box('head', accent, [x, 1.08, 0], [.09, .19, .20]);
    }
    if (config.accessory === 'cap') {
      add('cylinder', 'head', accent, [0, 1.34, 0], [.28, .10, .28]);
      box('head', accent, [0, 1.3, .20], [.45, .045, .30]);
    }
  }
  // Cubes may extend any preset (for example wings or a tail); a custom voxel
  // body already consumed the same list above and must not draw it twice.
  if (preset !== 'voxel') for (const voxel of config.voxels) box('root', voxel.color, [voxel.x, voxel.y, voxel.z], [voxel.w, voxel.h, voxel.d]);
  const pivots = Object.fromEntries(Object.entries(PIVOTS).map(([name, point]) => [name, [point[0] * config.width, point[1] * config.height, point[2] * config.width]]));
  const transform = new THREE.Object3D();
  for (const part of parts) {
    const head = part.bone === 'head', factor = head ? config.headSize : 1, pivot = PIVOTS[part.bone];
    part.position = part.position.map((value, axis) => (head ? pivot[axis] + (value - pivot[axis]) * factor : value) * (axis === 1 ? config.height : config.width));
    part.scale = part.scale.map((value, axis) => value * factor * (axis === 1 ? config.height : config.width));
    transform.position.set(...part.position); transform.rotation.set(...part.rotation); transform.scale.set(...part.scale); transform.updateMatrix();
    part.matrix = transform.matrix.clone();
  }
  return { config, appearanceKey: JSON.stringify(config), parts, pivots };
}

export function avatarBoneRotations({ walking = false, walkPhase = 0, talking = false, armWrestling = false, time = 0, reducedMotion = false } = {}) {
  const swing = !reducedMotion && walking ? Math.sin(walkPhase) * .32 : 0;
  const chat = !reducedMotion && talking ? Math.sin(time * 2.7) * .12 : 0;
  const grapple = armWrestling ? -.85 + (!reducedMotion ? Math.sin(time * 5) * .10 : 0) : 0;
  return { root: [0, 0, 0], body: [0, 0, swing * .06], head: [0, chat * .4, 0], leftLeg: [swing, 0, 0], rightLeg: [-swing, 0, 0], leftArm: [-swing * .8, 0, chat], rightArm: [armWrestling ? -.6 : swing * .8, 0, armWrestling ? grapple : -chat] };
}

export function buildAvatar(input = defaultOfficeAvatar()) {
  const layout = getAvatarLayout(input), group = new THREE.Group(), parts = {}, meshes = [], geometries = [], templates = new Map();
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: .82 });
  const byBone = new Map();
  for (const part of layout.parts) {
    if (!templates.has(part.shape)) templates.set(part.shape, createAvatarGeometry(part.shape));
    let shape = templates.get(part.shape).clone();
    if (shape.index) { const previous = shape; shape = shape.toNonIndexed(); previous.dispose(); }
    const pivot = layout.pivots[part.bone], matrix = new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]).multiply(part.matrix);
    shape.applyMatrix4(matrix);
    const color = new THREE.Color(part.color), colors = new Float32Array(shape.attributes.position.count * 3);
    for (let index = 0; index < colors.length; index += 3) { colors[index] = color.r; colors[index + 1] = color.g; colors[index + 2] = color.b; }
    shape.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!byBone.has(part.bone)) byBone.set(part.bone, []); byBone.get(part.bone).push(shape);
  }
  for (const [bone, shapes] of byBone) {
    const geometry = mergeGeometries(shapes, false); shapes.forEach(shape => shape.dispose());
    const joint = new THREE.Group(); joint.position.set(...layout.pivots[bone]);
    const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.avatarBone = bone;
    joint.add(mesh); group.add(joint); parts[bone] = joint; meshes.push(mesh); geometries.push(geometry);
  }
  templates.forEach(shape => shape.dispose());
  let disposed = false;
  return { group, parts, pickTargets: meshes, layout, appearanceKey: layout.appearanceKey,
    pose(state) { if (disposed) return; const rotations = avatarBoneRotations(state); for (const [bone, joint] of Object.entries(parts)) joint.rotation.set(...rotations[bone]); },
    dispose() { if (disposed) return; disposed = true; geometries.forEach(shape => shape.dispose()); material.dispose(); group.clear(); },
  };
}

export function createAvatarPreview(container, initialConfig = defaultOfficeAvatar()) {
  if (!container) throw new TypeError('缺少角色預覽容器。');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.6)); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('role', 'img'); renderer.domElement.setAttribute('aria-label', '可旋轉的角色外觀預覽');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none'; container.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#edf1e7');
  scene.add(new THREE.HemisphereLight('#fff8e8', '#8c9b91', 2.8));
  const light = new THREE.DirectionalLight('#fff3d5', 2.4); light.position.set(3, 5, 4); scene.add(light);
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .01, 100);
  const controls = new OrbitControls(camera, renderer.domElement); controls.enablePan = false; controls.enableDamping = true; controls.minZoom = .6; controls.maxZoom = 2.8;
  let avatar = null, radius = 1, disposed = false, frame = 0;
  function resize() {
    if (disposed) return;
    const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight), aspect = width / height, viewHeight = Math.max(2.2, radius * 2.6, radius * 2.6 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix(); renderer.setSize(width, height, false);
  }
  function update(config) {
    if (disposed) return;
    const next = buildAvatar(config);
    if (avatar) { scene.remove(avatar.group); avatar.dispose(); }
    avatar = next; scene.add(avatar.group); avatar.group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(avatar.group), center = bounds.getCenter(new THREE.Vector3()); radius = bounds.getBoundingSphere(new THREE.Sphere()).radius || 1;
    controls.target.copy(center); camera.position.copy(center).add(new THREE.Vector3(4, 2.5, 5)); camera.zoom = 1; camera.lookAt(center); controls.update(); resize();
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  function draw() { if (disposed) return; frame = requestAnimationFrame(draw); controls.update(); renderer.render(scene, camera); }
  try { update(initialConfig); frame = requestAnimationFrame(draw); }
  catch (error) { observer.disconnect(); controls.dispose(); avatar?.dispose(); renderer.dispose(); renderer.domElement.remove(); throw error; }
  return { update, dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); avatar?.dispose(); renderer.dispose(); renderer.domElement.remove(); } };
}
