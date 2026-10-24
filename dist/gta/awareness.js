// Short-lived, bounded sensory events shared by pedestrians and civilian traffic.
// Consumers remember a reaction; a muzzle flash is never replayed as a new sound.
export const AWARENESS_RULES = Object.freeze({ maxThreats: 8, gunshotRadius: 48, collisionRadius: 26, explosionRadius: 64 });

export function createAwareness() { return { nextId: 1, threats: [] }; }

export function stepAwareness(state, events = [], dt = 0) {
  const elapsed = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
  if (!elapsed) return state;
  const threats = state.threats.map(threat => ({ ...threat, remaining: threat.remaining - elapsed }))
    .filter(threat => threat.remaining > 1e-8);
  let nextId = state.nextId;
  for (const event of events) {
    const kind = event.type === 'shot' ? 'gunshot' : event.type === 'collision' ? 'collision' : event.type === 'explosion' ? 'explosion' : null;
    if (!kind || !Number.isFinite(event.position?.x) || !Number.isFinite(event.position?.z)) continue;
    const { x, z } = event.position;
    // A burst at one position occupies one slot but has a fresh identity so a
    // new shot can extend an existing reaction without accumulating events.
    const previous = threats.findIndex(threat => threat.kind === kind && Math.hypot(threat.x - x, threat.z - z) < 4);
    if (previous >= 0) threats.splice(previous, 1);
    threats.push({ id: nextId++, kind, x, z,
      radius: kind === 'explosion' ? AWARENESS_RULES.explosionRadius : kind === 'gunshot' ? AWARENESS_RULES.gunshotRadius : AWARENESS_RULES.collisionRadius,
      remaining: kind === 'explosion' ? 2.8 : kind === 'gunshot' ? 1.2 : 1.8 });
    if (threats.length > AWARENESS_RULES.maxThreats) threats.shift();
  }
  return { nextId, threats };
}
