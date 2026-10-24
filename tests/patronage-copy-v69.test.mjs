import test from 'node:test';
import assert from 'node:assert/strict';
import {PERSONAS} from '../dist/persona.js';
import {patronageReplyOutcomesV43} from '../dist/patronage-reply-v43.js';
import {patronageReplyResultV69} from '../dist/patronage-copy-v69.js';

const scenes=[{id:'system-printer',kind:'daily'},{id:'kind-workday',kind:'daily',scope:'private'},{id:'pip-review',kind:'crisis'}];
function allVariants(){
 const variants=[];
 for(const profile of [65,69])for(const target of Object.keys(PERSONAS))for(const event of scenes){
  const run={seed:`e39-r${profile}-s-${'a'.repeat(22)}`,patronage:{title:'乾兒子'},stats:{mood:60,boss:60},history:[]};
  for(const row of patronageReplyOutcomesV43(run,event,target))variants.push({profile,target,event,row});
 }
 return variants;
}

test('every published voice and fresh benefit reaction can be read as a completed exchange',()=>{
 const variants=allVariants();assert.equal(variants.length,672);
 const retry=/(?:原本.{0,12}(?:仍|還得|等你).{0,10}(?:回答|回覆|選|決定)|桌上原本那個選擇|現在只等你說|接下來同不同意|接不接受仍等你|原本的問題留在你面前|還要你選|還要你決定|需要你自己回答|尚未選的答案|該輪到你簽的地方照樣等著你)/;
 for(const {profile,target,event,row}of variants){
  const before=structuredClone(row),text=patronageReplyResultV69(row.result);
  assert.ok(text.length>40,`${profile}/${target}/${event.id}/${row.reaction}`);
  assert.doesNotMatch(text,retry,`${profile}/${target}/${event.id}/${row.reaction}`);
  assert.deepEqual(row,before,'copy must not edit the reaction, weight, affinity or effects');
  assert.equal(patronageReplyResultV69(text),text,'a displayed result is stable when rendered again');
 }
});

test('the fresh upward and rival copies keep their personalities without asking the same question twice',()=>{
 const variants=allVariants().filter(v=>v.profile===69&&v.event.kind==='daily'&&!v.event.scope);
 const get=(target,reaction)=>patronageReplyResultV69(variants.find(v=>v.target===target&&v.row.reaction===reaction).row.result);
 assert.match(get('wing','obliged'),/自己人懂事/);assert.match(get('wing','welcomed'),/交辦也跟著收了尾/);
 assert.match(get('spencer','reported'),/待遇差異的現場教學/);assert.match(get('spencer','reported'),/正式回應/);
 assert.match(get('princess','retort'),/Your new title doesn’t put you above me/);assert.match(get('princess','retort'),/家譜競爭/);
 assert.match(get('sonny','welcomed'),/記者會/);assert.match(get('annie_yu','obliged'),/抄給歐文/);
});

test('private invitation copy never turns the authority reply into a purchased itinerary',()=>{
 const text=patronageReplyResultV69('阿良把消息問回來。至於原本那個邀約，你還沒答應。');
 assert.equal(text,'阿良把消息問回來。這回只把話講完，沒有另外答應付費行程。');
 const variants=allVariants().filter(v=>v.event.scope==='private');
 for(const {row}of variants)assert.doesNotMatch(patronageReplyResultV69(row.result),/已替你(?:付款|購買)|自動(?:付款|接受邀約)/);
});

test('unrelated words, character humour, numbers and absent text remain unchanged',()=>{
 for(const value of [null,undefined,0,'','阿福補了三個理由，尤其強調「原本就會處理」。','半天還是半天，五千塊仍是五千塊。'])assert.equal(patronageReplyResultV69(value),value);
});
