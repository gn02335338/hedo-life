import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as achievements from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import * as characterStats from '../dist/character-stats.js';
import {polishDreamText} from '../dist/copy-v15.js';

const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function appHarness(mobile){
 const nodes=new Map(),calls={save:0,proof:0,scroll:[]};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{
   innerHTML:'',textContent:'',title:'',open:false,
   classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},
   scrollIntoView(){calls.scroll.push(selector);},showModal(){this.open=true;},close(){this.open=false;},
  });
  return nodes.get(selector);
 };
 const context=vm.createContext({
  ...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,
   achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},
  document:{querySelector:node,addEventListener(){}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(source,context,{filename:'dist/app.js'});
 await tick();
 // Boot may persist the empty collection once. Only subsequent display work is
 // under test; it must neither write another save nor submit a proof.
 calls.save=0;calls.proof=0;
 return {
  calls,state:()=>vm.runInContext('run',context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  journal:()=>vm.runInContext('journalHTML()',context),
 };
}

// Isolated UI boundary states, using the published engine to author and resolve
// every choice. They are not submitted as server replay proofs or public stats.
function sceneRun(id,seed='e21-ui-chronicle'){
 const run=engine.createRun('sales',seed);
 run.eventId=id;run.turn=12;
 if(id==='banquet-welcome')run.banquetReturnEventId='video-pizza-overtime';
 return run;
}
function songResult(branch){
 const labels=['成功搶麥','被夢想插播'];
 for(let n=0;n<100;n++){
  const run=engine.applyChoice(sceneRun('banquet-welcome',`e21-ui-song-${branch}-${n}`),1);
  if(run.history.at(-1).eventOutcome?.result===labels[branch])return run;
 }
 throw new Error(`No natural draw for First Love branch ${branch}`);
}
function assertUnchanged(app,run,before,characterBefore,rngBefore){
 assert.equal(JSON.stringify(run),before,'rendering never rewrites the canonical saved life');
 assert.equal(app.state(),run,'the saved run object remains the same object');
 assert.deepEqual(characterStats.deriveCharacterStats(run),characterBefore,'character totals are unchanged');
 assert.equal(run.rng,rngBefore,'rendering consumes no random draw');
 assert.equal(app.calls.save,0,'displaying corrected prose never saves a new proof');
 assert.equal(app.calls.proof,0,'displaying corrected prose never submits a character interaction');
}
function assertLedger(html,raw,shown,speaker){
 assert.match(html,/aria-label="事件後數值變化"/);
 for(const delta of Object.values(raw.delta))if(delta)assert.ok(html.includes(`>${delta>0?'+':''}${delta}</b>`),'committed numeric delta');
 if(shown.eventOutcome){
  assert.ok(html.includes(esc(`${shown.eventOutcome.label}：${shown.eventOutcome.result}`)),'resolved draw label');
  assert.ok(!html.includes(esc(`${raw.eventOutcome.label}：${raw.eventOutcome.result}`)),'superseded draw label is not shown');
 }
 for(const part of shown.breakdown||[])assert.ok(html.includes(esc(part.label)),`ledger source ${part.label}`);
 const characterLedger=html.match(/<div class="character-outcomes"[\s\S]*?<\/div>/)?.[0];
 assert.ok(characterLedger,'original history identity still reaches the character ledger');
 assert.ok(characterLedger.includes(`data-character-id="${speaker}"`));
 assert.ok(characterLedger.includes(persona.PERSONAS[speaker].name));
}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: corrected banquet and wrist-wrestling choices reveal no outcome before selection`,async()=>{
  const app=await appHarness(mobile);
  for(const id of ['banquet-welcome','video-pizza-overtime']){
   const run=sceneRun(id),before=JSON.stringify(run),raw=engine.getEvent(run),shown=persona.displayChronicleEvent(raw);
   const characterBefore=characterStats.deriveCharacterStats(run),rngBefore=run.rng,html=app.render(run);
   assert.ok(html.includes(esc(shown.body)));
   assert.ok(html.includes(esc(shown.wing)));
   assert.ok(!html.includes(esc(raw.body)),'original generic setup is replaced');
   for(const choice of shown.choices){
    assert.ok(html.includes(esc(choice.text)),'authored response is visible');
    for(const resolved of [choice.result,...(choice.draw?.outcomes.map(row=>row.result)||[])])if(resolved)assert.ok(!html.includes(esc(resolved)),'unresolved result remains hidden');
   }
   assert.equal([...html.matchAll(/\bdata-choice="/g)].length,raw.choices.length);
   assert.doesNotMatch(html,/class="result-text"|outcome-ledger|luck-result|effect-details/);
   const choices=html.slice(html.indexOf('<div class="choices '));
   assert.ok(choices.indexOf('data-action="rage"')>choices.lastIndexOf('data-choice='));
   assertUnchanged(app,run,before,characterBefore,rngBefore);
  }
 });

 test(`${device}: both First Love draw results and the journal show the corrected duel with intact character ledgers`,async()=>{
  const app=await appHarness(mobile);
  for(const branch of [0,1]){
   const run=songResult(branch),before=JSON.stringify(run),raw=run.history.at(-1),shown=persona.displayChronicleHistory(raw);
   const characterBefore=characterStats.deriveCharacterStats(run),rngBefore=run.rng,html=app.render(run),journal=app.journal();
   assert.ok(html.includes(esc(shown.body)));
   assert.ok(html.includes(esc(shown.wing)));
   assert.ok(html.includes(esc(shown.result)));
   assert.ok(!html.includes(esc(raw.result)),'the earlier player-sings story is replaced');
   assert.match(html,/class="result-text"/);
   assert.equal([...html.matchAll(/\bdata-choice="/g)].length,0,'pending results cannot resolve a second choice');
   assert.ok(journal.includes(esc(shown.choiceText)));
   assert.ok(journal.includes(esc(shown.result)));
   assert.ok(!journal.includes(esc(raw.choiceText)));
   assertLedger(html,raw,shown,'rick');
   assertLedger(journal,raw,shown,'rick');
   assertUnchanged(app,run,before,characterBefore,rngBefore);
  }
 });

 test(`${device}: each wrist-wrestling response preserves the committed result suffix, numeric changes and 阿福 interaction`,async()=>{
  const app=await appHarness(mobile);
  for(let index=0;index<3;index++){
   const run=engine.applyChoice(sceneRun('video-pizza-overtime',`e21-ui-wrist-${index}`),index);
   const raw=run.history.at(-1),rawEvent=engine.getEvent(run),choice=rawEvent.choices[index],shown=persona.displayChronicleHistory(raw);
   const before=JSON.stringify(run),characterBefore=characterStats.deriveCharacterStats(run),rngBefore=run.rng;
   const html=app.render(run),journal=app.journal();
   assert.ok(raw.result.startsWith(choice.result),'the engine authors the canonical choice before any display correction');
   const suffix=raw.result.slice(choice.result.length),expected=persona.displayChronicleEvent(rawEvent).choices[index].result+persona.displayText(suffix);
   assert.equal(shown.result,expected,'all actual appended randomness and pressure text survive');
   assert.ok(html.includes(esc(shown.title)));
   assert.ok(html.includes(esc(shown.body)));
   assert.ok(html.includes(esc(shown.wing)));
   assert.ok(html.includes(esc(expected)));
   assert.ok(journal.includes(esc(shown.choiceText)));
   assert.ok(journal.includes(esc(expected)));
   assert.ok(!journal.includes(esc(raw.choiceText)));
   assertLedger(html,raw,shown,'sonny');
   assertLedger(journal,raw,shown,'sonny');
   assertUnchanged(app,run,before,characterBefore,rngBefore);
  }
 });
}
