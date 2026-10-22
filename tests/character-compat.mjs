import assert from 'node:assert/strict';
import {CHARACTER_IDS,CHARACTER_METRICS} from '../dist/character-stats.js';

export const ORIGINAL_CHARACTER_IDS_V37=Object.freeze(['wing','spencer','erich','sonny','jenjen','rick','kind','hope','jack','meimei','helen','sophie','jonathan','owen','sam','cindy','professor']);

export function frozenCharacterProjection(actual,ids,label='legacy characters'){
 const original=new Set(ids);
 assert.equal(original.size,ids.length,`${label}: unique historical roster`);
 assert.deepEqual(actual.map(row=>row.id),CHARACTER_IDS,`${label}: additive current roster only`);
 assert.deepEqual(actual.filter(row=>!original.has(row.id)),CHARACTER_IDS.filter(id=>!original.has(id)).map(id=>({id,...Object.fromEntries(CHARACTER_METRICS.map(key=>[key,0]))})),`${label}: appended characters have no retroactive interactions`);
 return actual.filter(row=>original.has(row.id));
}

// Historical action proofs stay immutable. Appending a new encyclopedia entry
// may add one empty projection, never reinterpret an old actor's history.
export function assertFrozenCharacterStats(actual,expected,label='legacy characters'){
 assert.ok([16,17].includes(expected.length),`${label}: immutable historical roster`);
 assert.deepEqual(frozenCharacterProjection(actual,expected.map(row=>row.id),label),expected,`${label}: historical counters`);
}
