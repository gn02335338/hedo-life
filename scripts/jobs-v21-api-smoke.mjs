import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EVENTS } from '../dist/events.js';
import { ROLES as ALL_ROLES } from '../dist/roles.js';
import { replayRun, getEvent } from '../dist/engine.js';
import { CHARACTER_IDS, CHARACTER_METRICS, deriveCharacterStats } from '../dist/character-stats.js';
const ROLES=ALL_ROLES.filter(role=>(role.minRules||1)<=21);

const base = (process.env.API_BASE || 'http://127.0.0.1:4179').replace(/\/$/, '');
const origin = new URL(base);
if (origin.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.port !== '4179' || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
  throw new Error('Role-work smoke creates anonymous records; only localhost HTTP on port 4179 is allowed.');
}
const summary = { localOnly: true, cases: [], completedCases: 0, rejectedForgeries: 0, rejectedOwnership: 0, acceptedLegacyPrefixes: 0, rateRetries: 0 };
const zero = () => CHARACTER_IDS.map(id => ({ id, ...Object.fromEntries(CHARACTER_METRICS.map(key => [key, 0])) }));
const add = (...collections) => CHARACTER_IDS.map(id => ({ id, ...Object.fromEntries(CHARACTER_METRICS.map(key => [key, collections.reduce((sum, rows) => sum + (rows.find(row => row.id === id)?.[key] || 0), 0)])) }));
const newEvents = new Map(EVENTS.filter(event => event.minRules === 21 && event.roles?.length === 1).map(event => [event.id, event]));
assert.equal(newEvents.size, 60, 'all sixty new scenes must be registered');
const source = JSON.parse(readFileSync(new URL('../research/reachability-v3.json', import.meta.url), 'utf8'));
const routes = [...source.routes];
if (process.env.JOBS_WITNESS_FILE) {
  const extra = JSON.parse(readFileSync(resolve(process.env.JOBS_WITNESS_FILE), 'utf8'));
  routes.push(...(Array.isArray(extra) ? extra : extra.routes));
}
const candidates = new Map(ROLES.map(role => [role.id, []]));
for (const route of routes) {
  if (!/^e(?:21|22|23|24|25|26|27|28)-/.test(route.seed||'') || !candidates.has(route.roleId) || !route.actions?.some(action => newEvents.has(action.eventId))) continue;
  const run = replayRun(route.roleId, route.seed, route.actions);
  if (!run.completed) continue;
  const newRows = run.history.filter(row => row.choiceIndex >= 0 && row.kind === 'daily' && newEvents.has(row.eventId));
  if (!newRows.length) continue;
  for (const row of newRows) assert.deepEqual(newEvents.get(row.eventId).roles, [run.actualRoleId], 'new work must match the actual profession');
  candidates.get(route.roleId).push({ route, run, newRows });
}
const missing = [...candidates].filter(([, found]) => !found.length).map(([id]) => id);
assert.deepEqual(missing, [], `Missing natural completed e21 work witnesses: ${missing.join(', ')}. Supply JOBS_WITNESS_FILE if needed.`);

async function call(path, token, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { Origin: origin.origin, 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    assert.match(response.headers.get('Cache-Control') || '', /no-store/);
    const data = await response.json();
    if (response.status !== 429 || attempt === 3) return { status: response.status, data };
    const seconds = Number(response.headers.get('Retry-After'));
    assert.ok(Number.isFinite(seconds) && seconds >= 0 && seconds <= 60, 'bounded retry delay');
    summary.rateRetries++;
    await new Promise(done => setTimeout(done, seconds * 1000 + 100));
  }
}
const expect = (response, status) => { assert.equal(response.status, status, JSON.stringify(response.data)); return response.data; };
const proof = (route, runId, actions = route.actions) => ({ runId, roleId: route.roleId, seed: route.seed, actions });
const freshToken = () => randomBytes(32).toString('hex');
const privateValues = [], expectedTotals = [];
expect(await call('/api/health'), 200);
const before = expect(await call('/api/characters'), 200);
const beforeStats = expect(await call('/api/stats'), 200);
let firstProof;

for (const role of ROLES) {
  const selected = candidates.get(role.id).sort((a, b) => a.route.actions.length - b.route.actions.length)[0];
  const { route, run, newRows } = selected;
  const firstScene = newRows[0].eventId;
  const newAt = route.actions.findIndex(action => action.type === 'choice' && action.eventId === firstScene);
  assert.ok(newAt > 0);
  const prefixActions = route.actions.slice(0, newAt + 1);
  const prefixRun = replayRun(route.roleId, route.seed, prefixActions);
  assert.ok(prefixRun.history.some(row => row.choiceIndex >= 0 && row.eventId === firstScene));
  const token = freshToken(), runId = randomUUID();
  const player = expect(await call('/api/player', null, { token }), 200);
  assert.deepEqual(player.characters, zero());
  privateValues.push(token, runId, player.playerId, route.seed);
  const partial = proof(route, runId, prefixActions), complete = proof(route, runId);
  const committed = expect(await call('/api/characters', token, partial), 200);
  assert.equal(committed.verified, true); assert.equal(committed.totalRuns, 0);
  assert.deepEqual(committed.characters, deriveCharacterStats(prefixRun));
  const badges = expect(await call('/api/achievements', token, partial), 200);
  assert.equal(badges.verified, true); assert.equal(badges.totalRuns, 0);
  assert.deepEqual(badges.characters, committed.characters);
  assert.deepEqual(expect(await call('/api/characters', token, partial), 200).characters, committed.characters);
  const recorded = expect(await call('/api/complete', token, complete), 200);
  assert.equal(recorded.recorded, true); assert.equal(recorded.duplicate, false);
  assert.equal(recorded.endingId, run.endingId); assert.equal(recorded.totalRuns, 1);
  assert.deepEqual(recorded.characters, deriveCharacterStats(run));
  const duplicate = expect(await call('/api/complete', token, complete), 200);
  assert.equal(duplicate.duplicate, true); assert.equal(duplicate.totalRuns, 1);
  assert.deepEqual(duplicate.characters, recorded.characters);
  const personal = expect(await call('/api/me', token), 200);
  assert.equal(personal.totalRuns, 1); assert.deepEqual(personal.characters, deriveCharacterStats(run));

  if (!firstProof) {
    firstProof = complete;
    const swappedId = [...newEvents.values()].find(event => !event.roles.includes(run.actualRoleId)).id;
    const swapped = { ...partial, runId: randomUUID(), actions: prefixActions.map((action, index) => index === newAt ? { ...action, eventId: swappedId } : action) };
    assert.throws(() => replayRun(swapped.roleId, swapped.seed, swapped.actions));
    expect(await call('/api/characters', token, swapped), 400); summary.rejectedForgeries++;

    const prior = replayRun(route.roleId, route.seed, route.actions.slice(0, newAt));
    const speaker = getEvent(prior).speaker;
    const outside = { ...partial, runId: randomUUID(), actions: [...route.actions.slice(0, newAt), { type: 'rage', phase: 'event', eventId: firstScene, target: speaker === 'wing' ? 'sonny' : 'wing' }] };
    assert.throws(() => replayRun(outside.roleId, outside.seed, outside.actions));
    expect(await call('/api/achievements', token, outside), 400); summary.rejectedForgeries++;

    let changedSeed;
    for (const suffix of '0123456789abcdefghijklmnopqrstuvwxyz') {
      const candidate = route.seed.slice(0, -1) + suffix;
      if (candidate === route.seed) continue;
      try { replayRun(route.roleId, candidate, prefixActions); } catch { changedSeed = candidate; break; }
    }
    assert.ok(changedSeed, 'a changed RNG seed must invalidate this natural event proof');
    expect(await call('/api/characters', token, { ...partial, runId: randomUUID(), seed: changedSeed }), 400); summary.rejectedForgeries++;
  }
  expectedTotals.push(deriveCharacterStats(run));
  summary.cases.push({ roleId: route.roleId, actualRoleId: run.actualRoleId, newScenes: newRows.map(row => row.eventId), endingId: run.endingId });
  summary.completedCases++;
}

// A second browser cannot attach the first browser's committed life to itself.
const isolatedToken = freshToken();
const isolated = expect(await call('/api/player', null, { token: isolatedToken }), 200);
privateValues.push(isolatedToken, isolated.playerId);
assert.deepEqual(isolated.characters, zero());
expect(await call('/api/characters', isolatedToken, firstProof), 409); summary.rejectedOwnership++;
const isolatedAfter = expect(await call('/api/me', isolatedToken), 200);
assert.deepEqual(isolatedAfter.characters, zero()); assert.equal(isolatedAfter.totalRuns, 0);

// The new scheduler must not invalidate an already published e20 work prefix.
const historical = JSON.parse(readFileSync(new URL('../tests/fixtures/legacy-e20-routes.json', import.meta.url), 'utf8'));
const legacyRoute = historical.find(route => route.actions.some(action => EVENTS.some(event => event.id === action.eventId && (event.minRules || 1) <= 20)));
assert.ok(legacyRoute, 'historical e20 work witness');
const legacyAt = legacyRoute.actions.findIndex(action => EVENTS.some(event => event.id === action.eventId && (event.minRules || 1) <= 20));
const legacyActions = legacyRoute.actions.slice(0, legacyAt + 1);
const legacyRun = replayRun(legacyRoute.roleId, legacyRoute.seed, legacyActions);
assert.equal(legacyRun.completed, false, 'the historical case is an unfinished work prefix');
const legacyToken = freshToken(), legacyId = randomUUID();
const legacyPlayer = expect(await call('/api/player', null, { token: legacyToken }), 200);
privateValues.push(legacyToken, legacyId, legacyPlayer.playerId, legacyRoute.seed);
const legacyProof = proof(legacyRoute, legacyId, legacyActions);
const legacy = expect(await call('/api/characters', legacyToken, legacyProof), 200);
assert.equal(legacy.verified, true); assert.equal(legacy.totalRuns, 0);
assert.deepEqual(legacy.characters, deriveCharacterStats(legacyRun));
const legacyBadges = expect(await call('/api/achievements', legacyToken, legacyProof), 200);
assert.deepEqual(legacyBadges.characters, legacy.characters); assert.equal(legacyBadges.totalRuns, 0);
expectedTotals.push(deriveCharacterStats(legacyRun)); summary.acceptedLegacyPrefixes++;

const after = expect(await call('/api/characters'), 200);
assert.equal(after.version, 1); assert.equal(after.trackingSince, before.trackingSince);
assert.deepEqual(after.characters, add(before.characters, ...expectedTotals));
assert.deepEqual(Object.keys(after).sort(), ['version', 'characters', 'trackingSince'].sort());
const afterStats = expect(await call('/api/stats'), 200);
assert.equal(afterStats.totalRuns, beforeStats.totalRuns + ROLES.length);
for (const role of ROLES) assert.equal(afterStats.roles.find(row => row.id === role.id)?.count || 0, (beforeStats.roles.find(row => row.id === role.id)?.count || 0) + 1);
const publicOutput = JSON.stringify({ characters: after, statistics: afterStats });
for (const value of privateValues) assert.ok(!publicOutput.includes(value), 'public aggregates contain no proof or identity');
assert.ok(!publicOutput.includes('actions') && !publicOutput.includes('seed') && !publicOutput.includes('token'));
summary.passed = true; summary.checkedAt = new Date().toISOString();
mkdirSync(new URL('../artifacts/jobs-v21/', import.meta.url), { recursive: true });
writeFileSync(new URL('../artifacts/jobs-v21/api-smoke.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(`Role-work API smoke passed: ${summary.completedCases} professions, ${summary.rejectedForgeries} rejected event/target/RNG forgeries, ${summary.rejectedOwnership} rejected ownership change, ${summary.acceptedLegacyPrefixes} historical e20 prefix, deduplicated completions and private character aggregates; ${summary.rateRetries} rate retries.`);
