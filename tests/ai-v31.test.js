import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import * as roles from '../dist/roles.js';
import * as sources from '../dist/public-sources.js';
import * as endings from '../dist/endings.js';
import * as legacy from '../dist/legacy.js';
import * as engine from '../dist/engine.js';
import * as badges from '../dist/achievements.js';
import * as career from '../dist/career-api.js';
import * as currentCareer from '../dist/career-v17.js';
import * as persona from '../dist/persona.js';
import * as characterStats from '../dist/character-stats.js';
import {EVENTS} from '../dist/events.js';
import {polishDreamText} from '../dist/copy-v15.js';
import {simulate,replayRoute} from './find-routes-v3.mjs';

const eventId='ai31-auto-increment',badgeId='ai-auto-increment';
const {routes}=JSON.parse(readFileSync(new URL('./fixtures/ai-routes-v31.json',import.meta.url),'utf8'));
const copy=value=>JSON.parse(JSON.stringify(value));
const before=route=>engine.replayRun(route.roleId,route.seed,route.beforeActions);
const earned=run=>badges.deriveAchievements(run).filter(id=>id===badgeId);
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

test('the AI-specific database story and illustrated achievement append without changing occupations, endings or characters',()=>{
 const event=EVENTS.find(row=>row.id===eventId),badge=badges.ACHIEVEMENT_MAP[badgeId];assert.ok(event);assert.ok(badge);
 assert.equal(EVENTS.filter(row=>row.id===eventId).length,1);assert.deepEqual(event.roles,['ai']);assert.equal(event.minRules,31);assert.equal(event.minTurn,0);assert.equal(event.choices.length,3);assert.equal(event.choices[2].wild,true);
 assert.ok(event.sourceIds.length&&event.sourceIds.every(id=>sources.SOURCES[id]));
 const unanswered=[event.title,event.body,event.wing,...event.choices.flatMap(choice=>[choice.text,choice.detail])].join(' ');
 assert.doesNotMatch(unanswered,/auto[ _]?increment/i,'the technical punchline is revealed only after a reply');
 for(const choice of event.choices){assert.equal(choice.detail,'');assert.match(choice.result,/auto[ _]?increment/i);assert.match(choice.result,/主鍵|自動編號/);assert.match(choice.result,/模型|人工智慧/);assert.doesNotMatch(choice.text,/成功率|機率|\d+(?:\.\d+)?\s*[%％]/);}
 assert.equal(badge.title,'原來公司的AI是Auto Increment');assert.ok(badge.description.trim().length>15);assert.equal(badge.image,'./assets/achievements/ai-auto-increment.svg');
 const artwork=readFileSync(new URL('../dist/assets/achievements/ai-auto-increment.svg',import.meta.url),'utf8');assert.match(artwork,/<svg\b/);assert.match(artwork,/<title\b|aria-label="[^"]+"/);assert.doesNotMatch(artwork,/<script|(?:xlink:)?href="https?:\/\//i);
 assert.equal(roles.ROLES.length,13);assert.equal(endings.ENDINGS.length,805);assert.equal(characterStats.CHARACTER_IDS.length,17);assert.equal(badges.ACHIEVEMENTS.length,149);
});

test('all three AI replies are naturally reached by an actual AI employee and remain save-safe through completion',()=>{
 assert.equal(routes.length,3);assert.deepEqual(routes.map(route=>route.index),[0,1,2]);let checkpoints=0;
 for(const route of routes){
  assert.match(route.seed,/^e31-/);const run=before(route),snapshot=copy(run),event=engine.getEvent(run);
  assert.equal(run.actualRoleId,'ai');assert.equal(event.id,eventId);assert.equal(event.kind,'daily');assert.equal(event.speaker,'rick');assert.equal(run.pending,false);assert.deepEqual(earned(run),[]);
  const pending=engine.applyChoice(run,route.index),row=pending.history.at(-1);assert.deepEqual(run,snapshot);assert.equal(row.eventId,eventId);assert.equal(row.choiceIndex,route.index);assert.equal(row.speaker,'rick');assert.match(row.result,/auto[ _]?increment/i);
  assert.deepEqual(earned(pending),[badgeId]);assert.equal(engine.validRun(copy(pending)),true);const resolved=engine.advance(pending);
  assert.deepEqual(engine.replayRun(route.roleId,route.seed,route.actions),resolved);assert.deepEqual(replayRoute({...route,ending:route.id},state=>{checkpoints++;assert.equal(engine.validRun(state),true);}),resolved);
  assert.deepEqual(earned(resolved),[badgeId]);const done=engine.replayRun(route.roleId,route.seed,route.completionActions);assert.equal(done.completed,true);assert.equal(done.endingId,route.endingId);assert.equal(engine.validRun(copy(done)),true);assert.deepEqual(earned(done),[badgeId]);
 }
 assert.ok(checkpoints>15);
});

test('an unanswered AI event, supplied flags and incomplete or foreign history cannot prove the new AI badge',()=>{
 const pending=engine.applyChoice(before(routes[0]),0),row=pending.history.at(-1),supplied={seed:pending.seed,actualRoleId:'ai',achievements:[badgeId],flags:{ai_auto_increment:999}};
 assert.deepEqual(earned({...supplied,eventId,history:[]}),[]);
 const invalid=[
  {...row,eventId:'onboarding'}, {...row,eventId:'another-ai-story'}, {...row,kind:'career'}, {...row,speaker:'wing'},
  {...row,choiceIndex:-1}, {...row,choiceIndex:3}, {...row,choiceIndex:'0'}, {...row,choiceIndex:null},
  {...row,result:''}, {...row,result:'  '}, {...row,result:null},
 ];
 for(const field of ['eventId','kind','speaker','choiceIndex','result']){const missing={...row};delete missing[field];invalid.push(missing);}
 for(const incomplete of invalid)assert.deepEqual(earned({...supplied,history:[incomplete]}),[]);
 for(const seed of [undefined,'unversioned','e17-pretend-ai','e29-pretend-ai','e30-pretend-ai'])assert.deepEqual(earned({...supplied,seed,history:[row]}),[]);
 for(const actualRoleId of [undefined,'system','mis','sales'])assert.deepEqual(earned({...supplied,actualRoleId,history:[row]}),[],'a complete-looking AI row cannot substitute for the actual occupation');
 const snapshot=JSON.stringify(pending);assert.deepEqual(earned(copy(pending)),[badgeId]);assert.deepEqual(earned(pending),[badgeId]);assert.equal(JSON.stringify(pending),snapshot);
 assert.deepEqual(earned({...supplied,history:[row,row,copy(row)]}),[badgeId],'re-reading one resolved response cannot create multiple badges');
});

test('actual assignment controls AI work routing and every earlier cohort rejects the new scene',()=>{
 let reassigned;
 for(let attempt=0;attempt<20;attempt++){
  const {run,route}=simulate('ai','nasdaq',attempt,{seedPrefix:'e31'});
  if(run.actualRoleId!=='ai'){reassigned={run,route};break;}
 }
 assert.ok(reassigned);assert.equal(reassigned.run.roleId,'ai');assert.notEqual(reassigned.run.actualRoleId,'ai');assert.ok(!reassigned.run.history.some(row=>row.eventId===eventId));assert.deepEqual(earned(reassigned.run),[]);
 replayRoute(reassigned.route,state=>{if(!state.completed)assert.notEqual(state.eventId,eventId);});
 for(const cohort of ['e17','e29','e30']){
  const old=engine.createRun('ai',`${cohort}-ai-new-scene`);assert.throws(()=>engine.getEvent({...old,eventId}),/Unknown event/);
 }
});

test('the assistant badge keeps its stable ID and original onboarding condition after correcting the two-extra-characters wording',()=>{
 assert.equal(badges.ACHIEVEMENT_MAP.assistant.title,'多兩個字，少一份薪。');
 let assistant,honest;
 for(let index=0;index<100&&(!assistant||!honest);index++){
  const run=engine.createRun('ai',`e31-assistant-goal-${index}`);if(run.assignment==='assistant')assistant??=run;else honest??=run;
 }
 assert.ok(assistant);assert.ok(honest);assert.ok(!badges.deriveAchievements(assistant).includes('assistant'));
 const resolved=engine.applyChoice(assistant,0);assert.ok(badges.deriveAchievements(resolved).includes('assistant'));
 assert.ok(!badges.deriveAchievements(engine.applyChoice(honest,0)).includes('assistant'));
 assert.ok(!badges.deriveAchievements({...resolved,history:[]}).includes('assistant'));
 assert.ok(!badges.deriveAchievements({...resolved,flags:{...resolved.flags,assistant:0}}).includes('assistant'));
});

const appSource=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile,initial={},retainedRun=null){
 const nodes=new Map(),calls={save:0,proof:0},storage=new Map([['hedo-life-v3',JSON.stringify({unlocked:[],achievements:initial,...(retainedRun?{run:retainedRun}:{})})]]);
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,classList:{add(){},remove(){},toggle(){}},focus(){},setAttribute(){},addEventListener(){},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...badges,...career,...currentCareer,...persona,...characterStats,polishDreamText,
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'offline',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>{calls.proof++;return null;},characterProgress:async()=>null,complete:async()=>null},
  localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){calls.save++;storage.set(key,value);}},document:{querySelector:node,addEventListener(){}},window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 return{calls,node,state:()=>vm.runInContext('run',context),records:()=>copy(vm.runInContext('achievements',context)),saved:()=>JSON.parse(storage.get('hedo-life-v3')),
  render(run){context.fixtureRun=run;vm.runInContext('run=fixtureRun;game(true)',context);return node('#main').innerHTML;},
  choose(index){context.fixtureIndex=index;vm.runInContext('choose(fixtureIndex)',context);return node('#main').innerHTML;},
  book(filter='all'){context.fixtureFilter=filter;vm.runInContext('achievementFilter=fixtureFilter;achievementBook()',context);const html=node('#dialog-content').innerHTML;node('#dialog').close();return html;},
 };
}
function assertHidden(html){const badge=badges.ACHIEVEMENT_MAP[badgeId];assert.ok(!html.includes(`<h3>${esc(badge.title)}</h3>`));assert.ok(!html.includes(esc(badge.description)));assert.ok(!html.includes(badge.image));}

for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: locked AI name, explanation and artwork stay hidden until one of the actual three replies resolves`,async()=>{
  for(const route of routes){
   const run={...before(route),runId:webcrypto.randomUUID()},initial=Object.fromEntries(badges.deriveAchievements(run).map(id=>[id,{unlockedAt:'2026-10-01T00:00:00.000Z',source:'local'}])),app=await harness(mobile,initial),badge=badges.ACHIEVEMENT_MAP[badgeId];
   const html=app.render(run);assert.doesNotMatch(html,/auto[ _]?increment/i);assert.equal(app.node('#achievement-toast').innerHTML,'');
   for(const filter of ['all','locked','unlocked']){
    const book=app.book(filter);assertHidden(book);for(const card of book.matchAll(/<article class="achievement-card locked"[\s\S]*?<\/article>/g)){assert.match(card[0],/<h3>\?\?\?<\/h3>/);assert.doesNotMatch(card[0],/<img|data-achievement-id=/);}
   }
   assert.equal(app.calls.save,0);assert.equal(app.calls.proof,0);assert.ok(!app.records()[badgeId]);
   const expected=engine.applyChoice(run,route.index),result=app.choose(route.index);assert.deepEqual(copy(app.state()),copy(expected));assert.match(result,/auto[ _]?increment/i);
   const recent=result.match(/<section class="result-achievements"[\s\S]*?<\/section>/)?.[0];assert.ok(recent);assert.ok(recent.includes(esc(badge.title)));assert.ok(recent.includes(`src="${badge.image}"`));
   assert.equal(app.calls.proof,1);assert.ok(app.saved().achievements[badgeId]);const book=app.book();assert.ok(book.includes(`<h3>${esc(badge.title)}</h3>`));assert.ok(book.includes(esc(badge.description)));assert.ok(book.includes(`src="${badge.image}"`));
  }
 });

 test(`${device}: a retained canonical AI reply backfills the new illustration while preserving the assistant record and saved RNG`,async()=>{
  const route=routes[0],run={...engine.replayRun(route.roleId,route.seed,route.actions),runId:webcrypto.randomUUID()},snapshot=copy(run),old={unlockedAt:'2026-10-01T00:00:00.000Z',source:'local'},app=await harness(mobile,{assistant:old},run);
  assert.ok(app.records()[badgeId]);assert.deepEqual(app.records().assistant,old);assert.deepEqual(copy(app.state()),snapshot);assert.deepEqual(app.saved().run,snapshot);
  const book=app.book();assert.ok(book.includes(`<h3>${esc(badges.ACHIEVEMENT_MAP[badgeId].title)}</h3>`));assert.ok(book.includes('多兩個字，少一份薪。'));assert.ok(book.includes(`src="${badges.ACHIEVEMENT_MAP[badgeId].image}"`));
 });
}
