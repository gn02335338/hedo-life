import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, Spherical, Vector3 } from '../dist/island/vendor/three.module.js';
import { OCEAN_LEVEL, OCEAN_SIZE, OCEAN_SEGMENTS, getOceanCenter, getOceanViewCenter, ENVIRONMENTS, OMEGA_SEA_MARKERS } from '../dist/island/ocean.js';
import { REGIONS, DOCKS, getFerryRoute } from '../dist/island/archipelago.js';
import { LAYOUT, isTerrainWalkable } from '../dist/island/navigation.js';

const waterY = OCEAN_LEVEL;
const cellSize = OCEAN_SIZE / OCEAN_SEGMENTS;
const cameraRadius = Math.hypot(34, 42, 42);
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

function viewCamera(width, height, screenWidth, target, polar, azimuth, zoom) {
  const aspect = width / height, baseView = aspect < .8 ? 30 : aspect < 1.1 ? 25 : 22.8;
  let left = -baseView * aspect, right = baseView * aspect, top = baseView, bottom = -baseView;
  if (aspect < .8) { left = -23.8; right = 23.8; top = 23.8 / aspect; bottom = -top; }
  if (screenWidth > 780) {
    const dx = (right - left) * .04, dy = (top - bottom) * .02;
    left -= dx; right -= dx; top -= dy; bottom -= dy;
  }
  const camera = new OrthographicCamera(left, right, top, bottom, .1, 1400);
  camera.position.copy(target).add(new Vector3().setFromSpherical(new Spherical(cameraRadius, polar, azimuth)));
  camera.lookAt(target); camera.zoom = zoom; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return camera;
}
function groundPoint(camera, x = 0, y = 0) {
  const origin = new Vector3(x, y, -1).unproject(camera), direction = camera.getWorldDirection(new Vector3());
  const travel = (waterY - origin.y) / direction.y;
  return origin.addScaledVector(direction, travel);
}

test('camera-following water covers remote shores and zoomed, rotated, panned desktop and tall-screen views', () => {
  const viewports = [[950, 632, 1280], [390, 844, 390], [320, 932, 320], [320, 1024, 320], [3440, 720, 3440], [5120, 720, 5120]];
  const targets = [...Object.values(REGIONS).map(region => new Vector3(region.center.x, 1.5, region.center.z)), new Vector3(5000, 6, -3000)];
  const polars = [.08, Math.acos(42 / cameraRadius), Math.PI / 2.45];
  let views = 0, oldEdgeExposed = false;
  for (const viewport of viewports) for (const target of targets) for (const polar of polars) for (const zoom of [.65, 2.15, 3.5]) for (let yaw = 0; yaw < 24; yaw++) {
    const camera = viewCamera(...viewport, target, polar, yaw * Math.PI / 12, zoom);
    const center = getOceanViewCenter(camera.position, camera.getWorldDirection(new Vector3()), target);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const point = groundPoint(camera, x, y);
      assert.ok(Math.abs(point.x - center.x) < OCEAN_SIZE / 2 - 1, `${viewport}: visible water exceeds X edge`);
      assert.ok(Math.abs(point.z - center.z) < OCEAN_SIZE / 2 - 1, `${viewport}: visible water exceeds Z edge`);
      if (target.z === -66 && (Math.abs(point.x) > 110 || Math.abs(point.z) > 110)) oldEdgeExposed = true;
    }
    views++;
  }
  assert.equal(views, 7776);
  assert.ok(oldEdgeExposed, 'the old origin-centered 220-square sea clipped supported Omega City views');
});

test('recentering stays finite, preserves the world-space wave sample and does not mutate a camera target', () => {
  assert.equal(OCEAN_SEGMENTS, 80, 'the expanded surface retains the existing vertex budget');
  const point = Object.freeze({ x: -26.1, y: 1.5, z: -66.5 }), samples = [];
  for (const pan of [0, 1, -1, 50, -50, 5000]) {
    const target = Object.freeze({ x: point.x + pan, z: point.z - pan });
    const center = getOceanCenter(target);
    assert.ok(Math.abs(center.x - target.x) <= cellSize / 2 + 1e-8);
    assert.ok(Math.abs(center.z - target.z) <= cellSize / 2 + 1e-8);
    near(center.x / cellSize, Math.round(center.x / cellSize));
    near(center.z / cellSize, Math.round(center.z / cellSize));
    // The renderer adds the rebased mesh origin before sampling the wave field.
    const local = { x: point.x - center.x, z: point.z - center.z };
    samples.push({ x: local.x + center.x, z: local.z + center.z });
  }
  for (const sample of samples) { near(sample.x, point.x); near(sample.z, point.z); }
  for (const target of [undefined, null, {}, { x: Infinity, z: NaN }, { x: '1', z: '-3' }]) assert.deepEqual(getOceanCenter(target), { x: 0, z: 0 });
  const partial = getOceanCenter({ x: 1.25, z: Infinity });
  assert.ok(Number.isFinite(partial.x)); assert.equal(partial.z, 0);
});

test('vertical screen-space pans follow the sea intersection instead of an elevated controls target', () => {
  for (const height of [1.5, 50, 200, 600]) for (const polar of [.08, Math.PI / 2.45]) {
    const target = new Vector3(-26, height, -66);
    const camera = viewCamera(390, 844, 390, target, polar, .7, .65);
    const direction = camera.getWorldDirection(new Vector3());
    const center = getOceanViewCenter(camera.position, direction, target);
    const intersection = groundPoint(camera);
    assert.ok(Math.abs(center.x - intersection.x) <= cellSize / 2 + 1e-8);
    assert.ok(Math.abs(center.z - intersection.z) <= cellSize / 2 + 1e-8);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const point = groundPoint(camera, x, y);
      assert.ok(Math.abs(point.x - center.x) < OCEAN_SIZE / 2 - 1);
      assert.ok(Math.abs(point.z - center.z) < OCEAN_SIZE / 2 - 1);
    }
    if (height === 600 && polar > 1) assert.ok(Math.hypot(center.x - target.x, center.z - target.z) > OCEAN_SIZE / 2, 'following target.x/z alone loses the water after vertical panning');
  }
  const fallback = Object.freeze({ x: 31, z: -29 }), expected = getOceanCenter(fallback);
  for (const [position, direction] of [
    [undefined, undefined], [{ x: 1, y: 5, z: 2 }, { x: 0, y: 0, z: 1 }],
    [{ x: 1, y: 5, z: 2 }, { x: 0, y: 1, z: 0 }],
    [{ x: 1, y: -5, z: 2 }, { x: 0, y: -1, z: 0 }],
    [{ x: Infinity, y: 5, z: 2 }, { x: 0, y: -1, z: 0 }],
    [{ x: 1, y: 5, z: 2 }, { x: 1, y: -Number.MIN_VALUE, z: 1 }],
  ]) assert.deepEqual(getOceanViewCenter(position, direction, fallback), expected);
  assert.deepEqual(getOceanViewCenter(null, null, null), { x: 0, z: 0 });
});

test('day and night palettes distinguish ocean from sky while the future city keeps mint-lit crests', () => {
  assert.ok(Object.isFrozen(ENVIRONMENTS));
  assert.equal(ENVIRONMENTS.normal.dayWater, '#8fc6c2');
  assert.equal(ENVIRONMENTS.normal.nightWater, '#263b53');
  for (const environment of Object.values(ENVIRONMENTS)) {
    assert.ok(Object.isFrozen(environment));
    for (const [field, value] of Object.entries(environment)) {
      if (field.endsWith('Strength')) assert.ok(Number.isFinite(value) && value > 0 && value <= 1);
      else assert.match(value, /^#[\da-f]{6}$/i, field);
    }
    for (const period of ['day', 'night']) assert.notEqual(environment[`${period}Water`], environment[`${period}Sky`]);
    assert.notEqual(environment.dayWater, environment.nightWater, 'the city still follows the chosen island clock');
  }
  assert.equal(ENVIRONMENTS['omega-city'].dayCrest, '#8ce4d6');
  assert.ok(ENVIRONMENTS['omega-city'].crestStrength > ENVIRONMENTS.normal.crestStrength);
});

function segmentDistance(point, from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  const fraction = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(point.x - from.x - fraction * dx, point.z - from.z - fraction * dz);
}
test('Omega navigation lights remain at sea and clear every island, dock and directed ferry approach', () => {
  assert.ok(Object.isFrozen(OMEGA_SEA_MARKERS));
  assert.ok(OMEGA_SEA_MARKERS.length >= 3 && OMEGA_SEA_MARKERS.length <= 5);
  assert.equal(new Set(OMEGA_SEA_MARKERS.map(marker => marker.id)).size, OMEGA_SEA_MARKERS.length);
  const routes = Object.keys(REGIONS).flatMap(from => Object.keys(REGIONS).filter(to => to !== from).map(to => getFerryRoute(from, to)));
  assert.equal(routes.length, 20);
  for (const marker of OMEGA_SEA_MARKERS) {
    assert.ok(Object.isFrozen(marker)); assert.ok(Number.isFinite(marker.x) && Number.isFinite(marker.z));
    assert.ok(Number.isFinite(marker.size) && marker.size > 0 && marker.size <= 1);
    for (let sample = 0; sample < 16; sample++) {
      const angle = sample * Math.PI / 8;
      assert.equal(isTerrainWalkable({ x: marker.x + Math.sin(angle) * marker.size, z: marker.z + Math.cos(angle) * marker.size }), false, marker.id);
    }
    for (const island of LAYOUT) assert.ok(Math.hypot(marker.x - island.x, marker.z - island.z) > 6 + marker.size, `${marker.id}: stays beyond the island shore`);
    for (const dock of Object.values(DOCKS)) assert.ok(Math.hypot(marker.x - dock.position.x, marker.z - dock.position.z) > 3 + marker.size, `${marker.id}: clears boarding`);
    for (const route of routes) for (let segment = 1; segment < route.length; segment++) assert.ok(segmentDistance(marker, route[segment - 1], route[segment]) > 2 + marker.size, `${marker.id}: clears the ferry lane`);
  }
});
