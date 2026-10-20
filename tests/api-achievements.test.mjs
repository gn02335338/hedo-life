import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { AchievementStore } from '../worker/achievements.js';
import { validateCompletion } from '../worker/http.js';
import { createRun, applyChoice, advance, requestRage, replayRun } from '../dist/engine.js';
import { deriveAchievements } from '../dist/achievements.js';

function harness() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON; CREATE TABLE players(id TEXT PRIMARY KEY); CREATE TABLE runs(id TEXT PRIMARY KEY, player_id TEXT, role_id TEXT, ending_id TEXT);');
  const sql = { exec(query, ...args) {
    let rows = [];
    if (!args.length && query.includes(';')) db.exec(query);
    else { const s = db.prepare(query); if (s.columns().length) rows = s.all(...args); else s.run(...args); }
    return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
  } };
  const storage = { transactionSync(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch(e) { db.exec('ROLLBACK'); throw e; } } };
  db.prepare('INSERT INTO players(id) VALUES (?)').run('owner'); db.prepare('INSERT INTO players(id) VALUES (?)').run('other');
  return { db, sql, store: new AchievementStore(sql, storage), reopen: () => new AchievementStore(sql, storage) };
}
const entered = (seed='e13-achievement-store') => advance(applyChoice(createRun('system', seed), 0));

test('the HTTP envelope accepts rage only in e13 and gives that cohort room for interludes', () => {
  const proof={runId:randomUUID(),roleId:'system',seed:'e13-api-rage',actions:[{type:'rage'}]};
  assert.deepEqual(validateCompletion(proof, {system:{}}), proof);
  for (const seed of ['e12-api-rage','e11-api-rage','old-api-rage']) assert.throws(() => validateCompletion({...proof,seed}, {system:{}}));
  assert.doesNotThrow(() => validateCompletion({...proof,actions:Array(300).fill({type:'rage'})}, {system:{}}));
  assert.throws(() => validateCompletion({...proof,actions:Array(301).fill({type:'rage'})}, {system:{}}));
  // HTTP validates the envelope; replay rejects impossible ordering and forged choices.
  assert.throws(() => replayRun('system',proof.seed,[{type:'rage'},{type:'rage'}]));
});

test('partial-run achievements sync without creating a completed game or retaining its transcript', async () => {
  const h=harness(),run=entered(),id=randomUUID(),expected=deriveAchievements(run);
  assert.ok(expected.includes('work-card')); assert.ok(!run.completed);
  assert.deepEqual(await h.store.record('owner',id,run,'2026-10-20T00:00:00.000Z'),expected);
  assert.deepEqual(h.store.snapshot('owner').map(row=>row.id).sort(),[...expected].sort());
  assert.deepEqual(h.store.snapshot('other'),[]);
  assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM runs').one().n,0);
  const rows=h.sql.exec('SELECT * FROM achievement_runs').toArray();
  assert.deepEqual(Object.keys(rows[0]).sort(),['id','player_id','role_id','seed_hash','created_at'].sort());
  assert.ok(!JSON.stringify(rows).includes(run.seed));
  assert.deepEqual(await h.reopen().record('owner',id,run,'2026-10-21T00:00:00.000Z'),[]);
  assert.ok(h.store.snapshot('owner').every(row=>row.unlockedAt==='2026-10-20T00:00:00.000Z'));
  h.db.close();
});

test('achievement proofs bind each run to its owner, role and seed without accepting client achievement lists', async () => {
  const h=harness(),run=entered(),id=randomUUID();
  await h.store.record('owner',id,run);
  await assert.rejects(h.store.record('other',id,run),e=>e.status===409);
  await assert.rejects(h.store.record('owner',id,entered('e13-another-seed')),e=>e.status===409);
  await assert.rejects(h.store.record('owner',id,{...run,roleId:'sales'}),e=>e.status===409);
  h.sql.exec('INSERT INTO runs (id,player_id,role_id,ending_id) VALUES (?,?,?,?)',randomUUID(),'other','system','ragequit-system');
  const otherId=h.sql.exec('SELECT id FROM runs').one().id;
  await assert.rejects(h.store.record('owner',otherId,run),e=>e.status===409);
  const trusted=replayRun('system',run.seed,run.actions);
  const body={runId:randomUUID(),roleId:'system',seed:run.seed,actions:run.actions,achievements:['nasdaq']};
  const parsed=validateCompletion(body,{system:{}});
  assert.ok(!Object.hasOwn(parsed,'achievements'));
  await h.store.record('owner',body.runId,trusted);
  assert.ok(!h.store.snapshot('owner').some(row=>row.id==='nasdaq'));
  h.db.close();
});

test('concurrent milestone retries are idempotent and later valid choices add new badges', async () => {
  const h=harness(),run=entered(),id=randomUUID();
  const added=await Promise.all(Array.from({length:8},()=>h.reopen().record('owner',id,run)));
  assert.equal(added.flat().length,deriveAchievements(run).length);
  const rage=advance(applyChoice(requestRage(run),0));
  assert.ok(deriveAchievements(rage).includes('rage-wing'));
  const delta=await h.store.record('owner',id,rage);
  assert.ok(delta.includes('rage-wing'));
  assert.deepEqual(await h.store.record('owner',id,rage),[]);
  h.db.close();
});
