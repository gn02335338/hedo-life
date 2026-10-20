import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRun, getEvent, applyChoice, requestRage, replayRun } from '../dist/engine.js';
import { deriveAchievements } from '../dist/achievements.js';

const base = (process.env.API_BASE || 'http://127.0.0.1:4177').replace(/\/$/, '');
const origin = new URL(base);
if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) ||
    origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') {
  throw new Error('Feature smoke writes synthetic game records; a localhost origin is required.');
}
const summary = { localOnly: true, directProofs: [], completedFamilies: [], rejectedForgeries: 0, rateRetries: 0 };
async function call(path, token, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json', Origin: origin.origin } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    if (response.status !== 429 || attempt === 2) return { status: response.status, data };
    const retrySeconds = Number(response.headers.get('Retry-After'));
    assert.ok(Number.isFinite(retrySeconds) && retrySeconds >= 0 && retrySeconds <= 60, 'a bounded Retry-After is required');
    summary.rateRetries++;
    await new Promise(resolve => setTimeout(resolve, retrySeconds * 1000 + 100));
  }
}
const expect = (response, status) => {
  assert.equal(response.status, status, JSON.stringify(response.data));
  return response.data;
};
const badgeIds = data => data.achievements.map(row => row.id).sort();
const proof = (run, runId = randomUUID()) => ({ runId, roleId: run.roleId, seed: run.seed, actions: run.actions });
async function player() {
  const token = randomBytes(32).toString('hex');
  const registered = expect(await call('/api/player', null, { token }), 200);
  assert.equal(registered.totalRuns, 0);
  assert.deepEqual(registered.achievements, []);
  return token;
}
function directRun(phase, mode) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    let run = createRun('system', `e14-api-${phase}-${attempt}`);
    if (phase === 'result') {
      const choice = getEvent(run).choices.findIndex(item => item.available !== false && !item.effect);
      run = applyChoice(run, choice);
    }
    run = requestRage(run);
    if (run.rageContext?.mode === mode) return run;
  }
  throw new Error(`No natural ${phase}/${mode} prefix found`);
}
expect(await call('/api/health'), 200);
for (const phase of ['event', 'result']) for (const mode of ['imagined', 'real']) {
  const token = await player(), run = directRun(phase, mode), payload = proof(run);
  const canonical = replayRun(run.roleId, run.seed, run.actions);
  assert.equal(run.pending, true);
  assert.equal(run.rageContext.target, 'wing');
  assert.equal(run.actions.at(-1).phase, phase);
  assert.equal(canonical.completed, false);
  const response = expect(await call('/api/achievements', token, {
    ...payload, achievements: ['nasdaq', 'rage-coup'], endingId: 'rage_coup-system', stats: { mood: 100 },
  }), 200);
  assert.equal(response.verified, true);
  assert.equal(response.totalRuns, 0);
  assert.deepEqual(badgeIds(response), deriveAchievements(canonical).sort());
  assert.ok(badgeIds(response).includes(`rage-${mode}`));
  assert.ok(badgeIds(response).includes(mode === 'real' ? 'real-hit-wing' : 'dream-wing'));
  assert.ok(!badgeIds(response).includes(mode === 'real' ? 'dream-wing' : 'real-hit-wing'));
  assert.ok(badgeIds(response).includes(mode === 'real' ? 'real-first-day' : 'dream-first-day'));
  assert.ok(!badgeIds(response).includes(mode === 'real' ? 'dream-first-day' : 'real-first-day'));
  assert.ok(!badgeIds(response).includes('rage-wing'));
  assert.ok(!badgeIds(response).includes('rage-first-day'));
  assert.ok(!badgeIds(response).includes('nasdaq'));
  assert.ok(!badgeIds(response).includes('rage-coup'));
  const retried = expect(await call('/api/achievements', token, payload), 200);
  assert.deepEqual(retried.newlyUnlocked, []);
  assert.deepEqual(retried.achievements, response.achievements);
  expect(await call('/api/complete', token, payload), 400);
  for (const changes of [
    { phase: phase === 'event' ? 'result' : 'event' },
    { target: 'spencer' },
    { eventId: 'not-the-visible-conversation' },
  ]) {
    const actions = run.actions.map((action, index) => index === run.actions.length - 1 ? { ...action, ...changes } : action);
    expect(await call('/api/achievements', token, { ...payload, actions }), 400);
    summary.rejectedForgeries++;
  }
  expect(await call('/api/achievements', token, {
    ...payload, actions: [...run.actions, { type: 'choice', eventId: 'rage-release', index: 0 }],
  }), 400);
  summary.rejectedForgeries++;
  const me = expect(await call('/api/me', token), 200);
  assert.equal(me.totalRuns, 0);
  assert.deepEqual(me.achievements, response.achievements);
  assert.ok(!JSON.stringify(me).includes(run.seed));
  assert.ok(!Object.hasOwn(me, 'actions'));
  if (phase === 'event' && mode === 'imagined') {
    expect(await call('/api/achievements', null, payload), 401);
    const stranger = await player();
    expect(await call('/api/achievements', stranger, payload), 409);
    assert.deepEqual(expect(await call('/api/me', stranger), 200).achievements, []);
  }
  summary.directProofs.push({ phase, mode, verified: true, partialTotalRuns: me.totalRuns });
}

const report = JSON.parse(readFileSync(new URL('../research/reachability-v3.json', import.meta.url), 'utf8'));
assert.equal(report.complete, true);
for (const family of ['rage_legal', 'rage_defeated', 'rage_coup', 'rage_truce', 'rage_meme', 'rage_walkaway']) {
  const route = report.routes.find(item => /^e(?:14|15|16|17|18|19|20|21)-/.test(item.seed) && item.ending.startsWith(`${family}-`));
  assert.ok(route, `Missing natural witness for ${family}`);
  const run = replayRun(route.roleId, route.seed, route.actions);
  assert.equal(run.completed, true);
  assert.equal(run.endingId, route.ending);
  const token = await player(), payload = proof(run);
  const rageIndex = run.actions.findIndex(action => action.type === 'rage');
  assert.ok(rageIndex >= 0);
  const prefix = { ...payload, actions: run.actions.slice(0, rageIndex + 1) };
  const partial = expect(await call('/api/achievements', token, prefix), 200);
  assert.equal(partial.totalRuns, 0);
  assert.ok(badgeIds(partial).includes('rage-real'));
  assert.ok(!badgeIds(partial).includes('first-ending'));
  expect(await call('/api/complete', token, prefix), 400);
  const complete = expect(await call('/api/complete', token, payload), 200);
  assert.equal(complete.totalRuns, 1);
  assert.equal(complete.endingId, route.ending);
  assert.equal(complete.duplicate, false);
  assert.equal(complete.recorded, true);
  assert.deepEqual(complete.unlocked, [route.ending]);
  assert.deepEqual(badgeIds(complete), deriveAchievements(run).sort());
  assert.ok(badgeIds(complete).includes('first-ending'));
  if (['rage_legal', 'rage_defeated', 'rage_coup'].includes(family)) {
    assert.ok(badgeIds(complete).includes(family.replace('_', '-')));
  }
  const duplicate = expect(await call('/api/complete', token, payload), 200);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.totalRuns, 1);
  assert.deepEqual(duplicate.achievements, complete.achievements);
  const progress = expect(await call('/api/achievements', token, payload), 200);
  assert.deepEqual(progress.newlyUnlocked, []);
  assert.equal(progress.totalRuns, 1);
  assert.deepEqual(progress.achievements, complete.achievements);
  const me = expect(await call('/api/me', token), 200);
  assert.deepEqual(me.unlocked, [route.ending]);
  assert.equal(me.totalRuns, 1);
  assert.ok(!JSON.stringify(me).includes(run.seed));
  assert.ok(!Object.hasOwn(me, 'actions'));
  summary.completedFamilies.push({ family, ending: complete.endingId, idempotent: true, totalRuns: me.totalRuns });
}
const stats = expect(await call('/api/stats'), 200);
assert.ok(!Object.hasOwn(stats, 'achievements'));
assert.ok(!Object.hasOwn(stats, 'actions'));
summary.passed = true;
summary.checkedAt = new Date().toISOString();
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
writeFileSync(new URL('../artifacts/v14-api-proof.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(`e14 local API smoke passed: ${summary.directProofs.length} event/result × imagined/real prefixes, ${summary.rejectedForgeries} rejected forgeries, all ${summary.completedFamilies.length} real-world ending families, replay-derived badges, zero partial-run counts, ownership, completion idempotency, private transcripts; ${summary.rateRetries} rate retries.`);
