import assert from 'node:assert/strict';
import {CHARACTER_METRICS} from '../dist/character-stats.js';

// Historical action proofs stay immutable. Appending a new encyclopedia entry
// may add one empty projection, never reinterpret an old actor's history.
export function assertFrozenCharacterStats(actual,expected,label='legacy characters'){
 assert.equal(expected.length,16,`${label}: immutable original roster`);
 const original=new Set(expected.map(row=>row.id));
 assert.deepEqual(actual.filter(row=>original.has(row.id)),expected,`${label}: original sixteen counters`);
 assert.deepEqual(actual.filter(row=>!original.has(row.id)),[
  {id:'professor',...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))}
 ],`${label}: the new professor has no retroactive meetings, hits or affinity`);
 assert.equal(actual.length,17,`${label}: one additive entry only`);
}
