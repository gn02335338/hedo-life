// Presentation consumers keep their own cursor. Events never become save data
// and replaying a render frame must not replay sounds, numbers or impacts.
export function createEventCursor(maxAge = 0.22) {
  let source = null, run = null, serial = 0, clock = -1;
  return {
    read(state) {
      const time = Number(state?.time) || 0;
      if (source !== state || run !== state?.runId || time < clock) {
        source = state; run = state?.runId; serial = 0;
      }
      clock = time;
      const fresh = [];
      for (const event of state?.combatEvents || []) {
        if (!Number.isFinite(event.serial) || event.serial <= serial) continue;
        serial = event.serial;
        const age = time - event.time;
        if (Number.isFinite(age) && age >= -0.001 && age <= maxAge) fresh.push(event);
      }
      return fresh;
    },
    reset() { source = null; run = null; serial = 0; clock = -1; },
  };
}
