import * as THREE from '../island/vendor/three.module.js';
import { createEventCursor } from './combat-events.js';

// Presentation is bounded and independent of the combat clock. Impact emphasis
// never sleeps the simulation, drops a touch gesture, or moves a collision body.
export function createCombatVisuals({ scene, camera, host = window, doc = document }) {
  const cursor = createEventCursor();
  const reduced = host.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const maxSparks = host.innerWidth < 700 ? 64 : 96;
  const sparks = [], labels = [], slashes = [];
  const positions = new Float32Array(maxSparks * 6), colors = new Float32Array(maxSparks * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; scene.add(lines);
  const slashGeo = new THREE.RingGeometry(0.75, 1, 30, 1, Math.PI / 2 - 0.9, 1.8);
  const flashLight = new THREE.PointLight('#f6cd84', 0, 5, 2); scene.add(flashLight);
  const normalColor = new THREE.Color('#e9c98c'), coldColor = new THREE.Color('#a8e3ed'), hurtColor = new THREE.Color('#e77e61');
  const kick = new THREE.Vector3();
  let shake = 0, flash = 0, phase = 0, run = null, clock = -1;
  const held = new Map();

  for (let i = 0; i < 14; i++) {
    const canvas = doc.createElement('canvas'); canvas.width = 192; canvas.height = 96;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    const sprite = new THREE.Sprite(material); sprite.visible = false; sprite.renderOrder = 9; scene.add(sprite);
    labels.push({ canvas, texture, material, sprite, life: 0, maxLife: 0.65, x: 0, z: 0, height: 2 });
  }
  for (let i = 0; i < 7; i++) {
    const material = new THREE.MeshBasicMaterial({ color: '#edcf8c', side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const mesh = new THREE.Mesh(slashGeo, material); mesh.visible = false; scene.add(mesh);
    slashes.push({ mesh, material, life: 0, maxLife: 0.15, radius: 2, angle: 0, sign: 1 });
  }

  function clear() {
    sparks.length = 0; shake = flash = 0; held.clear();
    labels.forEach(item => { item.life = 0; item.sprite.visible = false; });
    slashes.forEach(item => { item.life = 0; item.mesh.visible = false; });
    flashLight.intensity = 0;
  }
  function number(event, state) {
    if (!(event.damage > 0)) return;
    const label = labels.find(item => item.life <= 0) || labels.reduce((a, b) => a.life < b.life ? a : b);
    const ctx = label.canvas.getContext('2d');
    if (!ctx) return;
    const heavy = event.heavy || event.combo === 3;
    ctx.clearRect(0, 0, 192, 96);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${heavy ? 55 : 46}px Georgia, serif`;
    ctx.lineWidth = 7; ctx.strokeStyle = '#130e0b';
    const text = String(Math.round(event.damage));
    ctx.strokeText(text, 96, 46);
    ctx.fillStyle = event.type === 'player-hit' ? '#f5a08c' : heavy ? '#ffe09b' : '#f5e6c4';
    ctx.fillText(text, 96, 46); label.texture.needsUpdate = true;
    const target = state.enemies?.find(enemy => enemy.id === event.targetId);
    const bossId = event.bossId || target?.bossId;
    label.height = event.type === 'player-hit' ? 2.7 : bossId === 'wing' ? 5.2 : bossId ? 3.9 : (event.enemyType || target?.type) === 'wraith' ? 2.9 : 2.5;
    label.x = event.x + ((event.serial % 3) - 1) * 0.22; label.z = event.z;
    label.life = label.maxLife = heavy ? 0.75 : 0.58;
    label.sprite.scale.set(heavy ? 1.55 : 1.25, heavy ? 0.775 : 0.625, 1);
  }
  function impact(event) {
    const heavy = event.heavy || event.combo === 3;
    const tint = event.type === 'player-hit' ? hurtColor : event.source === 'burst' ? coldColor : normalColor;
    const count = reduced ? 3 : heavy ? 12 : 7;
    const facing = event.angle || 0;
    for (let i = 0; i < count; i++) {
      if (sparks.length >= maxSparks) sparks.shift();
      const theta = facing + (i / count - 0.5) * 3.8 + Math.sin(event.serial * 2.1 + i) * 0.3;
      const speed = (heavy ? 3.8 : 2.5) * (0.6 + (i % 4) * 0.16);
      const life = 0.18 + (i % 4) * 0.055;
      sparks.push({ x: event.x, y: 1 + (i % 3) * 0.1, z: event.z, vx: Math.sin(theta) * speed, vy: 1.8 + i % 3, vz: -Math.cos(theta) * speed, life, maxLife: life, tint });
    }
    number(event, currentState);
    flashLight.position.set(event.x, 1.7, event.z);
    flash = Math.max(flash, heavy ? 15 : 8);
    shake = Math.max(shake, event.type === 'player-hit' ? 0.1 : heavy ? 0.065 : 0.025);
    held.set(event.targetId, heavy ? 0.065 : 0.035);
    if (event.type === 'hit') held.set('player', heavy ? 0.05 : 0.025);
  }
  let currentState = null;
  function update(state, dt) {
    currentState = state;
    if (run !== state.runId || state.time < clock) { clear(); run = state.runId; }
    clock = state.time;
    const delta = Math.max(0, Math.min(0.05, dt || 0)); phase += delta;
    // Decay previous feedback before inserting this frame's contacts. At 20–30
    // fps a new 25ms impact must still own its first visible frame.
    for (const [id, remaining] of held) { if (remaining <= delta) held.delete(id); else held.set(id, remaining - delta); }
    flash *= Math.exp(-delta * 34);
    shake *= Math.exp(-delta * 24);
    for (const event of cursor.read(state)) {
      if (event.type === 'hit' || event.type === 'player-hit') impact(event);
      if (event.type === 'strike') {
        const item = slashes.find(value => value.life <= 0) || slashes[0];
        item.life = item.maxLife = event.heavy ? 0.18 : 0.13;
        item.radius = event.range || 2.7; item.angle = event.angle || 0; item.sign = event.combo === 2 ? -1 : 1;
        item.mesh.position.set(event.x, 1.08, event.z);
        item.material.color.set(event.heavy ? '#fff1c1' : '#dbbc82');
      }
      if (event.type === 'cast' && event.skill === 'burst') { shake = Math.max(shake, 0.09); flash = 20; flashLight.position.set(event.x, 1.9, event.z); }
    }
    let active = 0;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const item = sparks[i]; item.life -= delta;
      if (item.life <= 0) { sparks.splice(i, 1); continue; }
      item.x += item.vx * delta; item.y += item.vy * delta; item.z += item.vz * delta; item.vy -= delta * 14;
      const tail = Math.min(0.033, item.life), index = active++ * 6;
      positions.set([item.x, Math.max(0.06, item.y), item.z, item.x - item.vx * tail, Math.max(0.06, item.y - item.vy * tail), item.z - item.vz * tail], index);
      const fade = item.life / item.maxLife;
      colors.set([item.tint.r * fade, item.tint.g * fade, item.tint.b * fade, item.tint.r * fade * 0.2, item.tint.g * fade * 0.2, item.tint.b * fade * 0.2], index);
    }
    lineGeo.setDrawRange(0, active * 2); lineGeo.attributes.position.needsUpdate = lineGeo.attributes.color.needsUpdate = true;
    for (const item of labels) {
      item.life = Math.max(0, item.life - delta); item.sprite.visible = item.life > 0;
      const age = 1 - item.life / item.maxLife;
      item.sprite.position.set(item.x, item.height + age * (reduced ? 0.2 : 0.8), item.z);
      item.material.opacity = Math.min(1, item.life * 5);
    }
    for (const item of slashes) {
      item.life = Math.max(0, item.life - delta); item.mesh.visible = item.life > 0;
      const age = 1 - item.life / item.maxLife;
      item.mesh.scale.setScalar(item.radius * (0.82 + age * 0.18));
      item.mesh.rotation.set(-Math.PI / 2 + 0.24, 0, -item.angle + (age - 0.5) * 0.9 * item.sign);
      item.material.opacity = (1 - age) * (reduced ? 0.23 : 0.5);
    }
    flashLight.intensity = reduced ? 0 : flash;
    kick.set(reduced ? 0 : Math.sin(phase * 143) * shake, reduced ? 0 : Math.cos(phase * 119) * shake * 0.4, 0);
  }
  return {
    update,
    cameraKick: () => kick,
    held: id => held.has(id),
    destroy() {
      clear(); scene.remove(lines, flashLight); lineGeo.dispose(); lineMat.dispose(); slashGeo.dispose();
      for (const item of labels) { scene.remove(item.sprite); item.material.dispose(); item.texture.dispose(); }
      for (const item of slashes) { scene.remove(item.mesh); item.material.dispose(); }
    },
  };
}
