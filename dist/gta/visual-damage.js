// Original, bounded vehicle effects. Gameplay owns all damage and explosion
// lifetimes; these pools only illustrate the authoritative state.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const validPoint = value => Number.isFinite(value?.x) && Number.isFinite(value?.z);
const fract = value => value - Math.floor(value);
const seedFor = id => {
  let seed = 7;
  for (const char of String(id)) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return seed % 997 / 997;
};

export function createVehicleDamageVisuals({ THREE, scene, geo, materials, textures }) {
  const limits = Object.freeze({ smoke: 192, flames: 128, rings: 8 });
  const transform = new THREE.Object3D(), color = new THREE.Color();
  const smokeDark = new THREE.Color('#5f666b'), smokeLight = new THREE.Color('#a0a4a7');
  const fireOrange = new THREE.Color('#ee6b32'), fireCore = new THREE.Color('#ffd29a');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,.7)');
  gradient.addColorStop(.35, 'rgba(255,255,255,.58)');
  gradient.addColorStop(.7, 'rgba(255,255,255,.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  const smokeMap = new THREE.CanvasTexture(canvas); textures.add(smokeMap);

  function pool(name, geometry, count, options) {
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false, ...options });
    // A flat, double-sided ground ring needs one pass, not separate back/front
    // transparent passes. This keeps all three pools at three draws in total.
    material.forceSinglePass = true;
    // One scalar per instance fades puffs smoothly without separate materials
    // or CPU geometry creation. The geometry belongs exclusively to this pool.
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float damageAlpha;\nvarying float vDamageAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDamageAlpha = damageAlpha;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vDamageAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vDamageAlpha;');
    };
    material.customProgramCacheKey = () => 'vehicle-damage-alpha-v1';
    materials.set(`damage:${name}`, material);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    alpha.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute('damageAlpha', alpha);
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.name = `vehicle-damage:${name}`; mesh.count = 0; mesh.visible = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.castShadow = mesh.receiveShadow = false;
    scene.add(mesh); return { mesh, alpha, count: 0, capacity: count };
  }
  const smoke = pool('smoke', geo('damage:smoke', () => new THREE.PlaneGeometry(1, 1)), limits.smoke, { map: smokeMap, opacity: .86 });
  const flameGeometry = geo('damage:flame', () => {
    const geometry = new THREE.IcosahedronGeometry(1, 1), points = geometry.attributes.position;
    for (let i = 0; i < points.count; i += 1) {
      const y = points.getY(i), taper = 1 - Math.max(0, y) * .58;
      points.setXYZ(i, points.getX(i) * taper, y, points.getZ(i) * taper);
    }
    geometry.computeVertexNormals(); return geometry;
  });
  const flames = pool('flames', flameGeometry, limits.flames, { opacity: .84 });
  const rings = pool('rings', geo('damage:ring', () => new THREE.RingGeometry(.91, 1, 32)), limits.rings,
    { opacity: .42, side: THREE.DoubleSide });
  const pools = [smoke, flames, rings];
  let damagedVehicles = 0, emitters = 0, explosions = 0, disposed = false;

  function put(target, x, y, z, sx, sy, sz, tint, alpha, camera = null) {
    if (target.count >= target.capacity || !(alpha > .005) || !(sx > .001)) return;
    transform.position.set(x, y, z); transform.scale.set(sx, sy, sz);
    if (camera) transform.quaternion.copy(camera.quaternion);
    else transform.rotation.set(target === rings ? -Math.PI / 2 : 0, 0, 0);
    transform.updateMatrix();
    target.mesh.setMatrixAt(target.count, transform.matrix); target.mesh.setColorAt(target.count, tint);
    target.alpha.setX(target.count, clamp(alpha, 0, 1)); target.count += 1;
  }
  function finish(target) {
    target.mesh.count = target.count; target.mesh.visible = target.count > 0;
    if (!target.count) return;
    target.mesh.instanceMatrix.needsUpdate = true; target.mesh.instanceColor.needsUpdate = true; target.alpha.needsUpdate = true;
  }

  function update(fleet, damage, { time = 0, low = false, reducedMotion = false, x = 0, z = 0, camera } = {}) {
    if (disposed) return;
    for (const target of pools) { target.count = 0; target.capacity = low ? target === smoke ? 96 : target === flames ? 64 : 4 : limits[target === smoke ? 'smoke' : target === flames ? 'flames' : 'rings']; }
    damagedVehicles = emitters = explosions = 0;
    const range = low ? 90 : 135, clock = finite(time);
    for (const vehicle of fleet) {
      const stage = vehicle.damageStage || 'intact';
      if (stage !== 'intact') damagedVehicles += 1;
      if (!validPoint(vehicle) || Math.hypot(vehicle.x - x, vehicle.z - z) > range) continue;
      const burning = stage === 'burning', wreck = stage === 'wreck';
      const wreckAge = Math.max(0, finite(vehicle.wreckAge));
      if (!(stage === 'smoking' || burning || wreck && wreckAge < 18)) continue;
      emitters += 1;
      const seed = seedFor(vehicle.id), heading = finite(vehicle.heading);
      const engineX = vehicle.x + Math.sin(heading) * 1.28, engineZ = vehicle.z - Math.cos(heading) * 1.28;
      const count = reducedMotion ? 3 : low ? 4 : 7;
      const fade = wreck ? clamp(1 - wreckAge / 18, 0, 1) : 1;
      for (let i = 0; i < count; i += 1) {
        const life = reducedMotion ? .2 + i * .2 : fract(clock * .32 + i / count + seed);
        const spread = .15 + life * (burning || wreck ? .9 : .45);
        const angle = seed * 17 + i * 2.4;
        const size = (.7 + life * (burning || wreck ? 2.6 : 2)) * (wreck ? .85 + fade * .15 : 1);
        const opacity = Math.sin(Math.PI * life) * fade * (burning || wreck ? .95 : .82);
        color.copy(smokeDark).lerp(smokeLight, life * (burning || wreck ? .35 : .8));
        put(smoke, engineX + Math.cos(angle) * spread + life * .5, 1.12 + life * (burning || wreck ? 5.5 : 4.4),
          engineZ + Math.sin(angle) * spread, size, size * 1.1, 1, color, opacity, camera);
      }
      if (!burning) continue;
      const flamesPerCar = low || reducedMotion ? 3 : 5;
      for (let i = 0; i < flamesPerCar; i += 1) {
        const angle = seed * 9 + i * 2.4;
        // Low-frequency breathing replaces rapid random flicker. Reduced
        // motion uses steady flame silhouettes and stationary smoke layers.
        const pulse = reducedMotion ? .5 : .5 + Math.sin(clock * 3.4 + i * 1.7) * .5;
        const fx = engineX + Math.cos(angle) * .42, fz = engineZ + Math.sin(angle) * .42;
        put(flames, fx, 1.1 + pulse * .12, fz, .3 + pulse * .09, .65 + pulse * .35, .3 + pulse * .09, fireOrange, reducedMotion ? .55 : .8);
        if (!low && !reducedMotion) put(flames, fx, .98, fz, .17, .4 + pulse * .12, .17, fireCore, .85);
      }
    }
    const blasts = Array.isArray(damage?.explosions) ? damage.explosions : [];
    for (let index = Math.max(0, blasts.length - 8); index < blasts.length; index += 1) {
      const blast = blasts[index];
      const duration = Math.max(.1, finite(blast.duration, finite(blast.maxLife, 2.4)));
      const age = Math.max(0, finite(blast.age, duration - finite(blast.remaining, duration)));
      if (!validPoint(blast) || age >= duration || Math.hypot(blast.x - x, blast.z - z) > range) continue;
      explosions += 1;
      const progress = clamp(age / duration, 0, 1), fade = 1 - progress, seed = seedFor(blast.id);
      const smokeCount = reducedMotion ? 3 : low ? 5 : 9;
      for (let i = 0; i < smokeCount; i += 1) {
        const angle = i * 2.4 + seed * 9, radial = reducedMotion ? .8 : .35 + Math.min(age, 1.4) * (i % 3 + 1) * .65;
        const size = reducedMotion ? 2.3 : 1.1 + age * .9;
        color.copy(smokeDark).lerp(smokeLight, progress * .25);
        put(smoke, blast.x + Math.cos(angle) * radial, 1.2 + (reducedMotion ? i * .4 : age * 1.3 + i % 3 * .35),
          blast.z + Math.sin(angle) * radial, size, size, 1, color, fade * .72, camera);
      }
      if (age < .85) {
        const fireFade = 1 - age / .85, count = reducedMotion ? 1 : low ? 4 : 7;
        for (let i = 0; i < count; i += 1) {
          const angle = i * 2.4 + seed * 6, radius = reducedMotion ? 0 : Math.sin(age / .85 * Math.PI * .7) * 1.6;
          const size = reducedMotion ? .9 : .5 + Math.sin(age / .85 * Math.PI) * 1.05;
          color.copy(fireOrange).lerp(fireCore, reducedMotion ? .05 : fireFade * .4);
          put(flames, blast.x + Math.cos(angle) * radius, 1 + (reducedMotion ? 0 : age * 1.9 + i % 2 * .4),
            blast.z + Math.sin(angle) * radius, size, size * 1.2, size, color, fireFade * (reducedMotion ? .4 : .82));
        }
      }
      if (!reducedMotion && age < .65) {
        const radius = 1 + Math.min(finite(blast.radius, 9) * .65, 7) * Math.sin(age / .65 * Math.PI / 2);
        put(rings, blast.x, .08, blast.z, radius, radius, 1, fireOrange, (1 - age / .65) * .65);
      }
    }
    for (const target of pools) finish(target);
  }
  function getStats() {
    return { damagedVehicles, emitters, explosions, smoke: smoke.count, flames: flames.count, rings: rings.count,
      drawCalls: pools.reduce((count, target) => count + Number(target.count > 0), 0), capacities: { ...limits } };
  }
  function dispose() {
    if (disposed) return; disposed = true;
    // Cached geometries, materials and texture are owned by the scene. Only
    // instance buffers need release here before scene-wide cache disposal.
    for (const target of pools) { scene.remove(target.mesh); target.mesh.dispose(); }
  }
  return { update, getStats, dispose };
}
