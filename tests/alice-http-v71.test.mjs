import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCompletion} from '../worker/http.js';
import {ROLE_MAP} from '../dist/roles.js';

const proof=(seed,action)=>({runId:'b015cb64-0558-4cab-a28e-bcde35d0f056',roleId:'sales',seed,actions:[action]});
test('Alice explicit interaction targets are accepted only in the strict new career cohort',()=>{
 const actions=[
  {type:'rage',eventId:'alice71-first-pull',phase:'event',target:'alice'},
  {type:'verbal',eventId:'alice71-first-pull',phase:'event',target:'alice',version:2},
  {type:'patronage-reply',version:2,eventId:'alice71-first-pull',target:'alice'},
 ];
 for(const action of actions){
  assert.doesNotThrow(()=>validateCompletion(proof('e39-r71-n-'+'a'.repeat(22),action),ROLE_MAP));
  for(const seed of ['e39-r70-n-'+'a'.repeat(22),'e39-r75-n-'+'a'.repeat(22),'e39-r71-x-'+'a'.repeat(22)]){
   assert.throws(()=>validateCompletion(proof(seed,action),ROLE_MAP),error=>error.code==='invalid_actions');
  }
 }
});
