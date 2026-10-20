import { writeFileSync } from 'node:fs';
import { ROLES } from '../dist/roles.js';
import { EVENTS } from '../dist/events.js';
import { getEvent, applyChoice, canRequestRage, requestRage, getRageTargets, replayRun, validRun } from '../dist/engine.js';
import { simulate, replayRoute } from '../tests/find-routes-v3.mjs';

const events = EVENTS.filter(event => event.minRules === 23);
if (events.length !== 20) throw new Error('Expected all twenty e23 scenes before generating witnesses');
const people = ['sophie', 'jonathan', 'owen', 'sam', 'cindy'];
const groups = { 'sophie-printer-undead': ['sophie', 'sonny'], 'jonathan-spare-time-qa': ['jonathan', 'rick'], 'sam-chip-study': ['sam', 'jack'] };
const targets = ['nasdaq', 'taiwan', 'acquired', 'slacker', 'promotion', 'second_offer', 'sycophant', 'historian'];
const found = new Map();
function inspect(run) {
  if (run.pending || run.completed) return;
  const event = getEvent(run);
  if (!events.some(row => row.id === event.id)) return;
  const base = { roleId: run.roleId, seed: run.seed, eventId: event.id };
  if (!found.has(event.id)) found.set(event.id, { id: event.id, ...base, actions: applyChoice(run, 0).actions });
  if (people.includes(event.speaker) && canRequestRage(run)) {
    const result = requestRage(run), mode = result.rageContext.mode, id = `${event.speaker}-${mode}`;
    if (!found.has(id)) found.set(id, { id, ...base, mode, actions: result.actions });
    if (Object.hasOwn(groups, event.id)) for (const target of getRageTargets(run)) {
      const id = `group-${event.id}-${target}`;
      if (!found.has(id)) found.set(id, { id, ...base, target, actions: requestRage(run, target).actions });
    }
  }
}
const expected = 20 + 10 + 6;
for (let attempt = 0; attempt < 2000 && found.size < expected; attempt++) {
  for (const role of ROLES) {
    const { route } = simulate(role.id, targets[attempt % targets.length], attempt);
    replayRoute(route, inspect);
  }
}
const missing = [...events.map(event => event.id), ...people.flatMap(person => [`${person}-imagined`, `${person}-real`]),
  ...Object.entries(groups).flatMap(([id, targets]) => targets.map(target => `group-${id}-${target}`))].filter(id => !found.has(id));
if (missing.length) throw new Error(`Missing natural witnesses: ${missing.join(', ')}`);
const routes = [...found.values()];
for (const route of routes) {
  const before = replayRun(route.roleId, route.seed, route.actions.slice(0, -1));
  if (before.eventId !== route.eventId) throw new Error(`Unreachable prefix: ${route.id}`);
  const after = replayRun(route.roleId, route.seed, route.actions);
  if (!validRun(after)) throw new Error(`Invalid witness: ${route.id}`);
  const mode = after.history.at(-1)?.eventOutcome?.result === '腦內劇場' ? 'imagined' : after.history.at(-1)?.eventOutcome?.result === '真的失控了' ? 'real' : null;
  if (route.mode && mode !== route.mode) throw new Error(`Rage mode drift: ${route.id}`);
}
writeFileSync(new URL('../tests/fixtures/chronicle-routes-v23.json', import.meta.url), JSON.stringify({
  method: 'Natural e23 canonical replay prefixes: twenty resolved scenes, both rage modes per new speaker, and each explicitly co-present group target. No event, flag, stat, history or RNG state is injected.', routes
}, null, 2) + '\n');
console.log(`Verified ${routes.length} natural e23 scene and rage witnesses.`);
