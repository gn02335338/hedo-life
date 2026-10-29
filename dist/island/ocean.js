// The sea follows the view instead of ending at a fixed world-coordinate edge.
// Keep the same vertex budget as the old surface; detail comes from the shader.
export const OCEAN_LEVEL = -.08;
export const OCEAN_SIZE = 1024;
export const OCEAN_SEGMENTS = 80;
const gridSize = OCEAN_SIZE / OCEAN_SEGMENTS;

export function getOceanCenter(target) {
  const snap = value => {
    if (!Number.isFinite(value)) return 0;
    const center = Math.round(value / gridSize) * gridSize;
    return Number.isFinite(center) ? center || 0 : value;
  };
  return { x: snap(target?.x), z: snap(target?.z) };
}

// Screen-space vertical panning changes target.y as well as x/z. Follow the
// view's actual intersection with the water rather than that elevated target.
export function getOceanViewCenter(cameraPosition, direction, fallbackTarget) {
  const finiteVector = vector => vector && ['x', 'y', 'z'].every(axis => Number.isFinite(vector[axis]));
  if (finiteVector(cameraPosition) && finiteVector(direction) && direction.y < 0) {
    const travel = (OCEAN_LEVEL - cameraPosition.y) / direction.y;
    if (Number.isFinite(travel) && travel >= 0) {
      const point = { x: cameraPosition.x + direction.x * travel, z: cameraPosition.z + direction.z * travel };
      if (Number.isFinite(point.x) && Number.isFinite(point.z)) return getOceanCenter(point);
    }
  }
  return getOceanCenter(fallbackTarget);
}

// Water and sky deliberately differ: a faraway shore must still read as sea.
// The existing island clock blends the day/night pairs in both environments.
export const ENVIRONMENTS = Object.freeze({
  normal: Object.freeze({
    dayWater: '#8fc6c2', nightWater: '#263b53',
    daySky: '#c9deda', nightSky: '#142536',
    dayFog: '#b4d5d0', nightFog: '#263b53',
    dayCrest: '#d2ece5', nightCrest: '#84b0c0',
    rippleStrength: .025, crestStrength: .08,
  }),
  'omega-city': Object.freeze({
    dayWater: '#193e50', nightWater: '#245464',
    daySky: '#8da6ad', nightSky: '#081319',
    dayFog: '#577985', nightFog: '#234957',
    dayCrest: '#8ce4d6', nightCrest: '#68c8be',
    rippleStrength: .04, crestStrength: .18,
  }),
});

// Original floating navigation lights, outside every walking surface and route.
// The renderer owns their geometry and motion; these are only fixed positions.
export const OMEGA_SEA_MARKERS = Object.freeze([
  Object.freeze({ id: 'west-beacon', x: -38, z: -71, size: .55 }),
  Object.freeze({ id: 'southwest-beacon', x: -34, z: -55, size: .42 }),
  Object.freeze({ id: 'northeast-beacon', x: -17, z: -73, size: .5 }),
  Object.freeze({ id: 'east-beacon', x: -14, z: -57, size: .4 }),
]);
