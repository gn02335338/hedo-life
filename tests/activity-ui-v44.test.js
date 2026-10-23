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
import {renderEndingReport} from '../dist/ending-report-view.js';
import {polishDreamText} from '../dist/copy-v15.js';
import * as activityUI from '../dist/activity-ui-v44.js';
import * as activities from '../dist/activities-v44.js';
import * as jobTitles from '../dist/job-titles-v42.js';
import {polishVerbalHistoryV41} from '../dist/verbal-presentation-v41.js';
import {renderEndingTransition} from '../dist/ending-transition-v40.js';
import {patronageLegacyNoticeV68} from '../dist/patronage-notice-v68.js';

const appSource=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const plain=value=>JSON.parse(JSON.stringify(value));
const esc=value=>persona.displayText(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function harness(mobile){
 const nodes=new Map(),listeners=new Map(),dialogListeners=new Map(),calls={verbal:[],patronage:[],save:0,proof:0,advance:0};
 const node=selector=>{
  if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',title:'',open:false,scrollTop:0,
   classList:{add(){},remove(){},toggle(){}},focus(){},scrollIntoView(){},setAttribute(){},
   addEventListener(type,callback){if(selector!=='#dialog')return;if(!dialogListeners.has(type))dialogListeners.set(type,[]);dialogListeners.get(type).push(callback);},
   showModal(){this.open=true;},close(){this.open=false;for(const callback of dialogListeners.get('close')||[])callback({target:this});},
  });return nodes.get(selector);
 };
 const context=vm.createContext({...roles,...sources,...endings,...legacy,...engine,...achievements,...career,...currentCareer,...persona,...characterStats,...jobTitles,...activityUI,polishDreamText,polishVerbalHistoryV41,renderEndingReport,renderEndingTransition,patronageLegacyNoticeV68,
  requestPatronageReply(...args){calls.patronage.push(args[1]);return engine.requestPatronageReply(...args);},
  requestVerbal(...args){calls.verbal.push({argsLength:args.length,target:args[1],phase:args[0].pending?'result':'event'});return engine.requestVerbal(...args);},
  advance(run){calls.advance++;return engine.advance(run);},
  createFeedbackUI:()=>({open(){}}),createCharacterBook:()=>({open(){},onSnapshot(){},onRunChanged(){}}),
  cloud:{state:{status:'local',achievements:[],characters:[]},subscribe(){},init:async()=>null,achievementProgress:async()=>null,characterProgress:async()=>{calls.proof++;return null;},complete:async()=>null},
  localStorage:{getItem:()=>null,setItem(){calls.save++;}},document:{querySelector:node,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(callback);}},
  window:{scrollTo(){},matchMedia:()=>({matches:mobile})},crypto:webcrypto,structuredClone,setTimeout:()=>1,clearTimeout(){},
 });
 vm.runInContext(appSource,context);await tick();calls.save=0;calls.proof=0;
 const click=async(dataset,choice=false,detail=1)=>{
  const target={closest:selector=>selector===(choice?'[data-choice]':'[data-action]')?{dataset}:null};
  for(const callback of listeners.get('click')||[])await callback({target,detail});await tick();
 };
 return{context,calls,html:()=>node('#main').innerHTML,picker:()=>node('#dialog-content').innerHTML,dialog:()=>node('#dialog'),state:()=>vm.runInContext('run',context),
  render(run){context.testRun=run;vm.runInContext('run=testRun;game(true)',context);return node('#main').innerHTML;},
  candidate(run){context.testCandidate=run;vm.runInContext('candidate=testCandidate',context);},
  randomSeed:()=>vm.runInContext('randomSeed()',context),
  action:(action,activityId)=>click({action,activityId}),
  cancel(){for(const callback of dialogListeners.get('cancel')||[])callback({target:node('#dialog')});node('#dialog').close();},
  async doubleChoice(index){const revision=vm.runInContext('gameViewRevision',context),dataset={choice:String(index),choiceView:String(revision)};await click(dataset,true,1);await click(dataset,true,2);},
 };
}

for(const mobile of [false,true])test(`continued old appointments show a single visible chapter notice and restarting still requires confirmation (${mobile?'mobile':'desktop'})`,async()=>{
 const seed='e39-r66-s-'+'ab'.repeat(11),entry=engine.directEntryV60(seed);
 const old=engine.advance(engine.applyChoice(engine.enableActivitySchedule(engine.createRun(entry.roleId,seed)),0)),before=structuredClone(old);
 const app=await harness(mobile),html=app.render(old),chapter=html.slice(html.indexOf('<article'));
 assert.match(chapter,/特殊任用版本提醒/);assert.equal((html.match(/特殊任用版本提醒/g)||[]).length,1);
 assert.ok(chapter.indexOf('</div><aside class="rules-notice"')>=0,'notice follows the mobile-only bar instead of being inside its hidden container');
 assert.deepEqual(old,before);assert.equal(engine.validRun(old),true);
 await app.action('new');assert.equal(app.dialog().open,true);assert.match(app.picker(),/目前在第/);
 assert.deepEqual(plain(app.state()),plain(old));await app.action('close-dialog');assert.equal(app.dialog().open,false);
});


function legacySourceRun(role='sales'){
 for(let i=0;i<100;i++){
  const run=engine.advance(engine.applyChoice(engine.createRun(role,`e39-activity-ui-${i}`),0));
  if(engine.canRequestActivity(run))return {...run,runId:webcrypto.randomUUID()};
 }
 throw new Error('No natural activity source');
}

// Find a real, uninterrupted work scene. New lives enable their calendar before
// the first choice, exactly as Start does. Merely rendering that valid save must
// leave the invitation unopened until the player continues.
let cachedInvitationSource;
function invitationSourceRun(){
 if(cachedInvitationSource)return structuredClone(cachedInvitationSource);
 for(let seed=0;seed<150;seed++){
  let run=engine.enableActivitySchedule(engine.createRun('sales',`e39-cal46-ui-${seed}`));
  for(let step=0;step<120&&!run.completed;step++){
   if(engine.canRequestActivityInvitation(run)){
    cachedInvitationSource={...run,runId:webcrypto.randomUUID()};
    return structuredClone(cachedInvitationSource);
   }
   if(['daily','fantasy'].includes(engine.getEvent(run).kind)&&(run.stats.mood<55||run.stats.energy<55)&&engine.canRequestBreak(run))run=engine.requestBreak(run);
   const options=engine.getEvent(run).choices.flatMap((choice,index)=>{
    if(choice.available===false)return [];
    const next=engine.applyChoice(run,index);
    if(next===run)return [];
    const {mood,energy,boss,cash}=next.stats;
    return [{index,score:next.completed||next.pendingFamily?-1e6:Math.min(mood,energy)*3+(mood+energy)*.2+boss*.7+cash*.15+(next.pip?.active?-60:0)}];
   }).sort((a,b)=>b.score-a.score);
   if(!options.length)break;
   run=engine.advance(engine.applyChoice(run,options[0].index));
  }
 }
 throw new Error('No natural scheduled invitation source');
}

const noActivityPicker=html=>assert.doesNotMatch(html,/data-action="activity-(?:menu|start|cancel)"|data-activity-picker|data-activity-id=|今天還有這件事|這次，你想參加哪一場/);
for(const mobile of [false,true]){
 const device=mobile?'mobile':'desktop';
 test(`${device}: rendering work never enables or opens activities, and removed picker actions do nothing`,async()=>{
  const source=invitationSourceRun(),app=await harness(mobile),initial=JSON.stringify(source);
  noActivityPicker(app.render(source));
  assert.equal(JSON.stringify(app.state()),initial);assert.equal(app.calls.save,0);
  for(const action of ['activity-menu','activity-start','activity-cancel'])await app.action(action,'arm');
  assert.equal(JSON.stringify(app.state()),initial);assert.equal(app.calls.save,0);
  assert.equal(app.dialog().open,false);
 });
 test(`${device}: continuing naturally delivers one specific invitation with accept and decline choices`,async()=>{
  const source=invitationSourceRun(),app=await harness(mobile);app.render(source);
  const expected=engine.requestActivityInvitation(engine.enableActivitySchedule(source));
  await app.action('continue');
  assert.deepEqual(plain(app.state()),plain(expected));
  const event=engine.getEvent(expected),html=app.html();
  assert.equal(event.kind,'activity-invitation');
  assert.ok(expected.activityInvitationContext);
  assert.match(html,/突發邀約|公司通知/);assert.ok(html.includes(esc(event.body)));
  noActivityPicker(html);assert.doesNotMatch(html,/aria-label="目前活動進度"/);
  assert.match(html,/先回覆眼前的活動邀約/);
  for(const action of ['break','career','raise','exit'])assert.match(html,new RegExp(`data-action="${action}"[^>]*disabled`));
  for(const index of [0,1,2])assert.ok(html.includes(`data-choice="${index}"`));
  assert.doesNotMatch(html.replace(/<[^>]*>/g,''),/成功率|機率|\d+(?:\.\d+)?[%％]/);
  const stable=JSON.stringify(app.state()),saves=app.calls.save;
  app.render(plain(app.state()));await app.action('continue');
  for(const id of activities.ACTIVITY_IDS_V44)await app.action('activity-start',id);
  assert.equal(JSON.stringify(app.state()),stable);assert.equal(app.calls.save,saves);
  assert.equal(engine.validRun(plain(app.state())),true);
 });
 test(`${device}: accepting an invitation reveals its result once, then starts that activity`,async()=>{
  const source=invitationSourceRun(),app=await harness(mobile);app.render(source);await app.action('continue');
  const invitation=plain(app.state()),id=invitation.activityInvitationContext.id;
  const expected=engine.applyChoice(invitation,0),result=expected.history.at(-1).result;
  assert.ok(!app.html().includes(esc(result)));
  await app.doubleChoice(0);assert.deepEqual(plain(app.state()),plain(expected));
  assert.equal(app.html().split(esc(result)).length-1,1);
  assert.equal(engine.validRun(plain(app.state())),true);
  const pending=plain(app.state());app.render(pending);await app.action('continue');
  assert.deepEqual(plain(app.state()),pending);assert.equal(app.html().split(esc(result)).length-1,1);
  await app.action('next');
  assert.equal(app.state().activityContext.id,id);assert.ok(!app.state().activityInvitationContext);
  assert.equal(app.state().turn,source.turn);assert.equal(app.state().pay,source.pay);
  assert.match(app.html(),/aria-label="目前活動進度"/);noActivityPicker(app.html());
  assert.equal(engine.validRun(plain(app.state())),true);
 });
 test(`${device}: both decline replies preserve the original unanswered job and consume no workday`,async()=>{
  for(const index of [1,2]){
   const source=invitationSourceRun(),app=await harness(mobile);app.render(source);await app.action('continue');
   const invitation=plain(app.state()),expected=engine.applyChoice(invitation,index),result=expected.history.at(-1).result;
   assert.ok(!app.html().includes(esc(result)));
   await app.doubleChoice(index);assert.deepEqual(plain(app.state()),plain(expected));
   assert.equal(app.html().split(esc(result)).length-1,1);
   const pending=plain(app.state());app.render(pending);assert.deepEqual(plain(app.state()),pending);
   await app.action('next');
   assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);assert.equal(app.state().pay,source.pay);
   assert.equal(app.state().pending,false);assert.ok(!app.state().activityContext);assert.ok(!app.state().activityInvitationContext);
   assert.match(app.html(),/data-choice="0"/);noActivityPicker(app.html());
   assert.equal(engine.validRun(plain(app.state())),true);
   const stable=JSON.stringify(app.state());await app.action('continue');assert.equal(JSON.stringify(app.state()),stable);
  }
 });
 test(`${device}: all seven published multi-stage activities keep their saved progress and return to work`,async()=>{
  // Published, unscheduled e39 action lists still replay their original opener.
  // They are rendered directly here; no new invitation is forced into a save.
  for(const id of activities.ACTIVITY_IDS_V44.filter(id=>id!=='camel')){
   const source=legacySourceRun(id==='review'?'design':'sales'),opened=engine.requestActivity(source,id),app=await harness(mobile);app.render(opened);
   assert.equal(opened.actions.length,source.actions.length+1);
   assert.match(app.html(),/aria-label="目前活動進度"/);assert.match(app.html(),/先完成目前活動/);noActivityPicker(app.html());
   for(let step=0;step<activities.ACTIVITY_META_V44[id].stages;step++){
    const expected=engine.applyChoice(app.state(),0),result=expected.history.at(-1).result;
    assert.ok(!app.html().includes(esc(result)));
    await app.doubleChoice(0);assert.deepEqual(plain(app.state()),plain(expected));
    assert.equal(app.html().split(esc(result)).length-1,1);assert.match(app.html(),/這次實際變化/);
    assert.equal(engine.validRun(plain(app.state())),true);
    const pending=plain(app.state());app.render(pending);assert.deepEqual(plain(app.state()),pending);
    await app.action('next');assert.equal(engine.validRun(plain(app.state())),true);
   }
   assert.equal(app.state().eventId,source.eventId);assert.equal(app.state().turn,source.turn);
   assert.equal(app.state().pending,false);assert.ok(!app.state().activityContext);
   assert.match(app.html(),/data-choice="0"/);assert.doesNotMatch(app.html(),/aria-label="目前活動進度"/);
  }
 });
 test(`${device}: starting a new life enables the calendar before the first work transition`,async()=>{
  const app=await harness(mobile),seed=app.randomSeed();assert.match(seed,/^e39-r68-n-[a-f\d]{22}$/);assert.equal(seed.length,32);
  const candidate=engine.createRun('sales',seed);app.candidate(candidate);await app.action('start');
  const expected=engine.enableActivitySchedule(candidate),actual=plain(app.state());delete actual.runId;
  assert.deepEqual(actual,plain(expected));assert.equal(actual.eventId,'onboarding');
  assert.ok(!actual.activityInvitationContext);noActivityPicker(app.html());
  assert.equal(engine.validRun(plain(app.state())),true);
 });
}
