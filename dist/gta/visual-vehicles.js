// Original procedural vehicles. All dimensions use the gameplay car's local
// frame: forward is -Z, the driver is on -X, and the road is Y = 0.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const VARIANTS = Object.freeze({
  sedan: { width: .98, front: -2.02, rear: 2.02, belt: .96, roof: 1.58, roofFront: -.34, roofRear: .78, screenFront: -.91, screenRear: 1.34, doorEnd: .32, wheelFront: -1.28, wheelRear: 1.27, radius: .37, roofWidth: .71 },
  hatch: { width: .95, front: -1.94, rear: 1.91, belt: .98, roof: 1.66, roofFront: -.43, roofRear: .99, screenFront: -.95, screenRear: 1.68, doorEnd: .35, wheelFront: -1.23, wheelRear: 1.21, radius: .36, roofWidth: .73 },
  suv: { width: 1.01, front: -2.05, rear: 2.05, belt: 1.07, roof: 1.83, roofFront: -.46, roofRear: 1.03, screenFront: -.98, screenRear: 1.73, doorEnd: .36, wheelFront: -1.31, wheelRear: 1.31, radius: .395, roofWidth: .78 },
});
function variantFor(id, police) {
  if (police || /sedan|coupe|coral|cream/.test(id)) return 'sedan';
  if (/hatch|compact|plum/.test(id)) return 'hatch';
  if (/wagon|green/.test(id)) return 'suv';
  const hash = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return ['sedan', 'hatch', 'suv'][hash % 3];
}

export function createVehicleVisualFactory(ctx) {
  const { THREE, scene, mat, M, geo, part, contact, boxGeometry, planeGeometry, sphereGeometry,
    policeDecal, policeRedOff, policeBlueOff } = ctx;
  const cache = (name, make) => geo(`vehicle-v6:${name}`, make);
  const solid = mat('#ffffff', { vertexColors: true, metalness: .32, roughness: .32 });
  const wheelMaterial = mat('#ffffff', { vertexColors: true, metalness: .23, roughness: .56 });
  if (ctx.environment) { solid.envMap = ctx.environment; solid.envMapIntensity = .55; }
  const driverMaterial = mat('#ffffff', { vertexColors: true, roughness: .88 });
  const damagedSolid = mat('#ffffff', { vertexColors: true, metalness: .15, roughness: .76 });
  const brokenLamp = mat('#363a38', { roughness: .9 });
  const wheelTint = new THREE.Color();
  const shapesByPalette = new Map(), wheelsByVariant = new Map();
  const C = { rubber: '#17202a', inset: '#101c28', glass: '#294c61', reflection: '#7896a5', chrome: '#b3c1c5', trim: '#526773', plate: '#e5ebdf', red: '#d44b49', white: '#f1f4e9' };
  const unit = [1, 1, 1];

  function meshGeometry(vertices, faces) {
    const positions = [];
    for (const face of faces) for (let i = 1; i < face.length - 1; i += 1) {
      for (const index of [face[0], face[i], face[i + 1]]) positions.push(...vertices[index]);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.computeVertexNormals(); return result;
  }
  function quad(name, points) {
    return cache(name, () => meshGeometry(points, [[0, 1, 2, 3], [3, 2, 1, 0]]));
  }
  function loft(name, rings) {
    return cache(name, () => {
      const points = [], faces = [];
      rings.forEach(({ z, w, bottom, top }) => {
        const bevel = Math.min(.085, (top - bottom) / 3);
        points.push([-w + bevel, bottom, z], [w - bevel, bottom, z], [w, bottom + bevel, z],
          [w, top - bevel, z], [w - bevel, top, z], [-w + bevel, top, z], [-w, top - bevel, z], [-w, bottom + bevel, z]);
      });
      for (let ring = 0; ring < rings.length - 1; ring += 1) {
        for (let edge = 0; edge < 8; edge += 1) {
          const a = ring * 8 + edge, b = ring * 8 + (edge + 1) % 8;
          faces.push([a, b, b + 8, a + 8]);
        }
      }
      faces.push([7, 6, 5, 4, 3, 2, 1, 0], Array.from({ length: 8 }, (_, i) => (rings.length - 1) * 8 + i));
      return meshGeometry(points, faces);
    });
  }
  function add(parts, geometry, color, position = [0, 0, 0], scale = unit, rotation = [0, 0, 0]) {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    parts.push({ geometry, color, transform });
  }
  const box = (parts, color, position, scale, rotation) => add(parts, boxGeometry, color, position, scale, rotation);
  function beam(parts, color, from, to, width, depth = width) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(start);
    const transform = new THREE.Matrix4().compose(start.add(end).multiplyScalar(.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()),
      new THREE.Vector3(width, delta.length(), depth));
    parts.push({ geometry: boxGeometry, color, transform });
  }
  // Unlike the scene's material merge, this bake keeps a color for every face.
  // Finished shells are cached by silhouette + palette, never by transient ID.
  function bake(name, pieces, offset = [0, 0, 0]) {
    return cache(name, () => {
      const positions = [], normals = [], colors = [];
      for (const piece of pieces) {
        const geometry = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone();
        geometry.applyMatrix4(piece.transform); geometry.translate(...offset);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        const rgb = new THREE.Color(piece.color), p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let i = 0; i < p.count; i += 1) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i));
          colors.push(rgb.r, rgb.g, rgb.b);
        }
        geometry.dispose();
      }
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      result.computeBoundingBox(); result.computeBoundingSphere(); return result;
    });
  }

  function details(spec, variant, paint, police) {
    const body = [], door = [], frontLights = [], rearLights = [];
    const { width: w, front, rear, belt, roof, roofFront, roofRear, screenFront, screenRear, doorEnd, radius, roofWidth: rw } = spec;
    const roofPaint = police ? '#e8eeee' : paint;
    const tag = `${variant}:${police ? 'police' : paint}`;
    const hinge = [-w + .005, .52, screenFront];
    // A continuous beveled sill, two shaped fenders, and an inset cabin leave
    // a real dark opening when either front door swings outward.
    add(body, loft(`${variant}:sill`, [
      { z: front, w: w - .17, bottom: .31, top: .57 },
      { z: front + .2, w: w - .035, bottom: .26, top: .59 },
      { z: rear - .2, w: w - .035, bottom: .26, top: .59 },
      { z: rear, w: w - .18, bottom: .32, top: .57 },
    ]), paint);
    add(body, loft(`${variant}:hood`, [
      { z: front + .015, w: w - .07, bottom: .5, top: belt - .12 },
      { z: front + .21, w: w - .035, bottom: .48, top: belt - .09 },
      { z: screenFront - .1, w, bottom: .48, top: belt },
      { z: screenFront, w: w - .015, bottom: .49, top: belt },
    ]), paint);
    add(body, loft(`${variant}:rear-deck`, [
      { z: doorEnd + .025, w: w - .015, bottom: .49, top: belt },
      { z: rear - .26, w: w - .025, bottom: .48, top: variant === 'sedan' ? belt - .04 : belt + .01 },
      { z: rear, w: w - .07, bottom: .5, top: belt - .07 },
    ]), paint);
    box(body, C.inset, [0, .65, (screenFront + screenRear) / 2], [1.62, .3, screenRear - screenFront]);
    box(body, C.inset, [0, .96, screenFront + .19], [1.53, .12, .25]);
    for (const side of [-1, 1]) {
      box(body, C.rubber, [side * (w - .035), .4, .02], [.06, .12, rear - front - .4]);
      box(body, C.trim, [side * (w - .012), belt - .075, (doorEnd + rear - .25) / 2], [.018, .028, rear - .25 - doorEnd]);
      // Rear passenger-door seam, recessed handle, and sculpted shoulder line.
      beam(body, C.inset, [side * (w - .012), .57, doorEnd + .075], [side * (w - .012), belt, doorEnd + .075], .014);
      box(body, C.chrome, [side * (w + .001), belt - .115, 1.12], [.025, .034, .18]);
      for (const z of [spec.wheelFront, spec.wheelRear]) {
        add(body, cache(`${variant}:arch-inset`, () => new THREE.CircleGeometry(radius + .075, 20, 0, Math.PI)), C.inset,
          [side * (w + .002), radius + .035, z], unit, [0, side * Math.PI / 2, 0]);
        add(body, cache(`${variant}:arch-lip`, () => new THREE.TorusGeometry(radius + .055, .027, 5, 18, Math.PI)), variant === 'suv' ? C.rubber : paint,
          [side * (w + .003), radius + .035, z], unit, [0, side * Math.PI / 2, 0]);
      }
    }
    // The roof and all four pillars are actual slopes, not a rectangular cabin.
    add(body, loft(`${variant}:roof`, [
      { z: roofFront - .055, w: rw - .03, bottom: roof - .025, top: roof + .055 },
      { z: roofFront + .11, w: rw + .015, bottom: roof - .025, top: roof + .07 },
      { z: roofRear - .11, w: rw + .015, bottom: roof - .025, top: roof + .07 },
      { z: roofRear + .055, w: rw - .03, bottom: roof - .025, top: roof + .045 },
    ]), roofPaint);
    add(body, quad(`${variant}:windscreen`, [[-w + .095, belt + .025, screenFront], [w - .095, belt + .025, screenFront], [rw - .04, roof - .025, roofFront], [-rw + .04, roof - .025, roofFront]]), C.glass);
    add(body, quad(`${variant}:rear-screen`, [[-rw + .04, roof - .025, roofRear], [rw - .04, roof - .025, roofRear], [w - .12, belt + .045, screenRear], [-w + .12, belt + .045, screenRear]]), C.glass);
    // Two broad reflection ribbons give the dark glass a readable surface.
    const screenPoint = (across, up) => {
      const half = (w - .095) * (1 - up) + (rw - .04) * up;
      return [-half + 2 * half * across, (belt + .025) * (1 - up) + (roof - .025) * up + .003,
        screenFront * (1 - up) + roofFront * up - .003];
    };
    add(body, quad(`${variant}:screen-reflection`, [screenPoint(.075, .12), screenPoint(.19, .12), screenPoint(.19, .91), screenPoint(.075, .91)]), C.reflection);
    beam(body, C.rubber, [-.53, belt + .045, screenFront - .008], [-.04, belt + .095, screenFront + .025], .022);
    beam(body, C.rubber, [.04, belt + .045, screenFront - .008], [.57, belt + .095, screenFront + .025], .022);
    for (const side of [-1, 1]) {
      beam(body, roofPaint, [side * (w - .06), belt + .015, screenFront], [side * rw, roof, roofFront], .065);
      beam(body, roofPaint, [side * rw, roof, roofRear], [side * (w - .07), belt + .015, screenRear], variant === 'sedan' ? .12 : .095);
      beam(body, C.rubber, [side * (w - .025), belt + .025, doorEnd + .03], [side * rw, roof, doorEnd + .03], .055);
      const sideWindow = [[side * (w - .038), belt + .04, doorEnd + .08], [side * (w - .07), belt + .04, screenRear - .12],
        [side * (rw - .008), roof - .055, roofRear - .08], [side * (rw - .008), roof - .055, doorEnd + .08]];
      add(body, quad(`${variant}:rear-quarter:${side}`, sideWindow), C.glass);
      beam(body, C.chrome, sideWindow[0], sideWindow[1], .022);
      if (variant === 'suv') {
        beam(body, C.trim, [side * .64, roof + .12, roofFront + .15], [side * .64, roof + .12, roofRear - .05], .045);
        for (const z of [roofFront + .2, roofRear - .1]) box(body, C.rubber, [side * .64, roof + .08, z], [.08, .08, .1]);
      }
    }
    // Grille, bumper channels, paired LED elements, and inset embossed plates.
    box(body, C.inset, [0, belt - .34, front - .008], [1.32, .24, .028]);
    for (const y of [belt - .4, belt - .32, belt - .24]) box(body, C.chrome, [0, y, front - .025], [1.18, .018, .016]);
    box(body, C.chrome, [0, belt - .3, front - .04], [.065, .14, .025]);
    box(body, C.rubber, [0, .36, front + .02], [1.55, .07, .12]);
    box(body, C.rubber, [0, .39, rear - .025], [1.52, .11, .12]);
    for (const side of [-1, 1]) {
      box(body, C.inset, [side * .67, belt - .19, front + .01], [.48, .13, .07]);
      box(frontLights, C.white, [side * .67, belt - .17, front - .032], [.43, .038, .025]);
      box(frontLights, C.white, [side * .84, belt - .205, front - .03], [.035, .09, .024]);
      box(body, C.inset, [side * .67, belt - .15, rear + .005], [.49, .16, .045]);
      box(rearLights, C.red, [side * .67, belt - .12, rear + .031], [.43, .042, .025]);
      box(rearLights, C.red, [side * .85, belt - .16, rear + .03], [.04, .12, .024]);
      box(body, C.chrome, [side * .59, .34, rear + .015], [.17, .09, .085]);
      box(body, C.inset, [side * .59, .34, rear + .06], [.12, .055, .01]);
    }
    if (variant !== 'suv') box(rearLights, C.red, [0, belt - .1, rear + .022], [.8, .022, .018]);
    for (const end of [-1, 1]) {
      const z = end < 0 ? front - .028 : rear + .031, y = end < 0 ? .48 : belt - .34;
      box(body, C.rubber, [0, y, z], [.5, .18, .018]);
      box(body, C.plate, [0, y, z + end * .012], [.46, .14, .012]);
      for (const [x, height] of [[-.155, .075], [-.09, .075], [.005, .075], [.07, .075], [.14, .06]]) {
        box(body, C.inset, [x, y, z + end * .021], [.013, height, .004]);
      }
      box(body, C.inset, [-.122, y, z + end * .022], [.06, .012, .004]);
      box(body, C.inset, [.037, y + .032, z + end * .022], [.065, .012, .004]);
      box(body, C.inset, [.037, y - .032, z + end * .022], [.065, .012, .004]);
    }
    if (variant === 'hatch') box(body, paint, [0, roof + .03, roofRear + .13], [1.49, .065, .23]);
    if (police) {
      box(body, C.rubber, [0, roof + .16, .05], [1.38, .11, .38]);
      beam(body, C.rubber, [.59, roof + .05, roofRear - .2], [.61, roof + .42, roofRear - .12], .015);
    }
    // Both mirrors and the shaped window travel with the front-hinged door.
    const doorPaint = police ? '#e8eeee' : paint;
    const panel = cache(`${variant}:door-panel`, () => meshGeometry([
      [-w + .045, .52, screenFront], [-w + .045, .52, doorEnd], [-w, belt, doorEnd], [-w, belt, screenFront],
      [-w + .11, .52, screenFront], [-w + .11, .52, doorEnd], [-w + .07, belt, doorEnd], [-w + .07, belt, screenFront],
    ], [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [3, 2, 6, 7], [0, 3, 7, 4]]));
    add(door, panel, doorPaint);
    const window = [[-w + .035, belt + .035, screenFront + .075], [-w + .035, belt + .035, doorEnd - .025],
      [-rw + .015, roof - .045, doorEnd - .025], [-rw + .015, roof - .045, roofFront + .045]];
    add(door, quad(`${variant}:door-window`, window), C.glass);
    beam(door, C.chrome, window[0], window[1], .023);
    beam(door, C.rubber, window[1], window[2], .028);
    beam(door, C.rubber, window[2], window[3], .026);
    beam(door, C.rubber, window[3], window[0], .025);
    beam(door, C.inset, [-w - .003, .55, doorEnd], [-w - .003, belt, doorEnd], .013);
    box(door, C.chrome, [-w - .012, belt - .12, doorEnd - .21], [.028, .036, .19]);
    beam(door, C.trim, [-w - .004, belt - .07, screenFront + .06], [-w - .004, belt - .07, doorEnd - .055], .017);
    box(door, doorPaint, [-w - .014, belt + .16, screenFront + .12], [.11, .11, .22], [0, -.14, 0]);
    box(door, C.reflection, [-w - .017, belt + .16, screenFront + .231], [.085, .07, .008], [0, -.14, 0]);
    // A narrow reflected highlight follows the window slope.
    beam(door, C.reflection, [-w + .038, belt + .1, screenFront + .21], [-rw + .012, roof - .11, roofFront + .17], .035);
    return { body: bake(`${tag}:body`, body), door: bake(`${tag}:door`, door, hinge.map(value => -value)),
      frontLights: bake(`${variant}:front-led`, frontLights), rearLights: bake(`${variant}:rear-led`, rearLights), hinge };
  }

  function wheelGeometry(spec, variant) {
    if (wheelsByVariant.has(variant)) return wheelsByVariant.get(variant);
    const pieces = [], radius = spec.radius;
    const cylinder = (name, r, width, segments) => cache(name, () => new THREE.CylinderGeometry(r, r, width, segments));
    add(pieces, cylinder(`${variant}:tire`, radius, .23, 20), C.rubber, [0, 0, 0], unit, [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) {
      add(pieces, cylinder(`${variant}:rim-well`, radius * .71, .012, 16), C.inset, [side * .122, 0, 0], unit, [0, 0, Math.PI / 2]);
      add(pieces, cache(`${variant}:rim-ring`, () => new THREE.TorusGeometry(radius * .7, .018, 5, 20)), C.chrome,
        [side * .133, 0, 0], unit, [0, Math.PI / 2, 0]);
      for (let spoke = 0; spoke < 5; spoke += 1) {
        const angle = spoke / 5 * Math.PI * 2;
        beam(pieces, C.chrome, [side * .14, Math.cos(angle) * .05, Math.sin(angle) * .05],
          [side * .14, Math.cos(angle) * radius * .65, Math.sin(angle) * radius * .65], .032, .032);
      }
      add(pieces, cylinder(`${variant}:rim-hub`, .065, .02, 10), '#ccd1cd', [side * .145, 0, 0], unit, [0, 0, Math.PI / 2]);
      // A single small valve and asymmetric spoke faces make wheel roll visible.
      box(pieces, '#778b91', [side * .15, radius * .59, .02], [.012, .025, .035]);
    }
    const geometry = bake(`${variant}:wheel-assembly`, pieces);
    wheelsByVariant.set(variant, geometry); return geometry;
  }

  // Damage is baked into a separate cached shell. Never recolor the shared
  // intact geometry/material: two cars with the same paint can have different
  // health, and repeated police IDs reuse this bounded palette cache.
  function damageGeometry(original, key, severity, hinge = [0, 0, 0]) {
    return cache(`damage:${key}:${severity}`, () => {
      const result = original.clone(), positions = result.attributes.position, colors = result.attributes.color;
      const charred = severity >= 2, wreck = severity === 3;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i) + hinge[0], y = positions.getY(i) + hinge[1], z = positions.getZ(i) + hinge[2];
        const front = clamp((-z - .85) / 1.25, 0, 1), upper = clamp((y - .8) / .85, 0, 1);
        const crease = Math.sin(z * 7 + y * 5) * Math.sin(y * 9 - x * 3);
        const dent = (.045 + (wreck ? .13 : .035)) * front;
        positions.setXYZ(i, x * (1 - dent) - hinge[0], y - front * (.05 + (wreck ? .2 : .035))
          - (wreck ? upper * .24 : 0) + crease * front * .025 - hinge[1],
        z + front * (wreck ? .31 : .12) - hinge[2]);
        const scrape = y < 1.05 && (front > .45 || Math.abs(x) > .82) && Math.sin(z * 14 + y * 17) > .66;
        const soot = charred ? .4 * (1 - front * .92) : 1 - front * .24;
        const gray = scrape ? (charred ? .006 : .09) : 0;
        if (wreck) colors.setXYZ(i, .006 + colors.getX(i) * .012, .007 + colors.getY(i) * .012, .009 + colors.getZ(i) * .012);
        else colors.setXYZ(i, colors.getX(i) * soot + gray, colors.getY(i) * soot + gray, colors.getZ(i) * soot + gray);
      }
      positions.needsUpdate = colors.needsUpdate = true;
      result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere(); return result;
    });
  }

  return function createVehicleVisual(color, kind = null, id = '') {
    const police = kind === 'police', variant = variantFor(String(id), police), spec = VARIANTS[variant];
    const paint = police ? '#172a39' : `#${new THREE.Color(color ?? '#b5c7b8').getHexString()}`;
    const paletteKey = `${variant}:${police ? 'police' : paint}`;
    if (!shapesByPalette.has(paletteKey)) shapesByPalette.set(paletteKey, details(spec, variant, paint, police));
    const shapes = shapesByPalette.get(paletteKey);
    const group = new THREE.Group(); group.name = `vehicle:${id}`;
    const body = part(group, shapes.body, solid, [0, 0, 0], unit);
    const frontLights = part(group, shapes.frontLights, M.lit, [0, 0, 0], unit);
    const rearLights = part(group, shapes.rearLights, M.red, [0, 0, 0], unit);
    const door = new THREE.Group(); door.position.set(...shapes.hinge); group.add(door);
    const doorShell = part(door, shapes.door, solid, [0, 0, 0], unit);
    const passengerDoor = door.clone(); passengerDoor.position.x = -shapes.hinge[0]; passengerDoor.scale.x = -1; group.add(passengerDoor);
    const passengerShell = passengerDoor.children[0], decals = [];
    let redFlash = null, blueFlash = null;
    if (police) {
      const decal = policeDecal();
      decals.push(part(group, planeGeometry, decal, [0, spec.belt + .011, -1.28], [1.22, .5, 1], [-Math.PI / 2, 0, 0]));
      const localY = spec.belt - .76, localZ = .71;
      decals.push(part(door, planeGeometry, decal, [-.012, localY, localZ], [1.03, .25, 1], [0, -Math.PI / 2, 0]));
      decals.push(part(passengerDoor, planeGeometry, decal, [-.012, localY, localZ], [-1.03, .25, 1], [0, -Math.PI / 2, 0]));
      redFlash = part(group, boxGeometry, policeRedOff, [-.36, spec.roof + .29, .05], [.57, .16, .31]);
      blueFlash = part(group, boxGeometry, policeBlueOff, [.36, spec.roof + .29, .05], [.57, .16, .31]);
    }
    const wheelMesh = new THREE.InstancedMesh(wheelGeometry(spec, variant), wheelMaterial, 4);
    wheelMesh.name = 'animated-wheels'; wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wheelMesh.castShadow = false; wheelMesh.receiveShadow = false;
    // Their transforms stay inside this fixed sphere, including full steering.
    wheelMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .6, 0), 2.4); group.add(wheelMesh);
    const occupant = new THREE.Group(); group.add(occupant);
    const driverPieces = [];
    add(driverPieces, sphereGeometry, '#c99070', [-.83, spec.belt + .34, -.07], [.105, .145, .12]);
    box(driverPieces, police ? '#29425c' : '#8baeb5', [-.82, spec.belt + .125, 0], [.17, .28, .29]);
    add(driverPieces, sphereGeometry, '#263840', [-.83, spec.belt + .43, -.045], [.112, .065, .115]);
    part(occupant, bake(`${variant}:${police ? 'police' : 'civilian'}:occupant`, driverPieces), driverMaterial, [0, 0, 0], unit);
    contact(group, 1.17, 2.18);
    const model = { group, door, passengerDoor, occupant, police, redFlash, blueFlash, paintSource: color, damageStage: null,
      ownedGeometries: new Set(), variant,
      flashOffset: [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8,
      wheels: { mesh: wheelMesh, radius: spec.radius, x: spec.width - .125, front: spec.wheelFront, rear: spec.wheelRear,
        roll: 0, steer: 0, previousHeading: null, transform: new THREE.Object3D() },
      setDamage(stage) {
        if (model.damageStage === stage) return;
        model.damageStage = stage;
        const severity = stage === 'wreck' ? 3 : stage === 'burning' || stage === 'smoking' ? 2 : stage === 'damaged' ? 1 : 0;
        const key = `${variant}:${police ? 'police' : paint}`;
        body.geometry = severity ? damageGeometry(shapes.body, `${key}:body`, severity) : shapes.body;
        doorShell.geometry = passengerShell.geometry = severity ? damageGeometry(shapes.door, `${key}:door`, severity, shapes.hinge) : shapes.door;
        body.material = doorShell.material = passengerShell.material = severity ? damagedSolid : solid;
        frontLights.visible = rearLights.visible = stage !== 'wreck';
        frontLights.material = severity ? brokenLamp : M.lit;
        rearLights.material = severity >= 2 ? brokenLamp : M.red;
        for (const decal of decals) decal.visible = severity < 2;
        wheelTint.set(stage === 'wreck' ? '#494744' : '#ffffff');
        for (let i = 0; i < 4; i += 1) wheelMesh.setColorAt(i, wheelTint);
        wheelMesh.instanceColor.needsUpdate = true;
      },
      dispose() { wheelMesh.dispose(); },
    };
    animateVehicleVisual(model, { speed: 0, heading: 0 }, 0);
    scene.add(group); return model;
  };
}

export function animateVehicleVisual(model, state = {}, dt = 0) {
  const wheels = model?.wheels;
  if (!wheels) return;
  const stage = state.damageStage || 'intact';
  model.setDamage?.(stage);
  const elapsed = clamp(finite(dt), 0, .1), speed = stage === 'wreck' || stage === 'burning' ? 0 : finite(state.speed), heading = finite(state.heading);
  const turnRate = elapsed && wheels.previousHeading !== null ? angleDelta(heading, wheels.previousHeading) / elapsed : 0;
  wheels.previousHeading = heading;
  // Player steering is authoritative; NPCs expose heading instead, so infer
  // only their visual axle angle. Neither branch modifies the simulation.
  const requested = Number.isFinite(state.steerAngle) ? clamp(state.steerAngle, -1, 1) * .42
    : Math.abs(speed) > .3 ? clamp(Math.atan(turnRate * 2.45 / speed), -.42, .42) : 0;
  if (elapsed) {
    wheels.steer += (requested - wheels.steer) * (1 - Math.exp(-16 * elapsed));
    wheels.roll = (wheels.roll - speed * elapsed / wheels.radius) % (Math.PI * 2);
  }
  let index = 0;
  for (const z of [wheels.front, wheels.rear]) for (const side of [-1, 1]) {
    const transform = wheels.transform;
    transform.position.set(side * wheels.x, wheels.radius + .035, z);
    transform.rotation.set(wheels.roll, z === wheels.front ? -wheels.steer : 0, 0, 'YXZ');
    transform.updateMatrix(); wheels.mesh.setMatrixAt(index, transform.matrix); index += 1;
  }
  wheels.mesh.instanceMatrix.needsUpdate = true;
}
