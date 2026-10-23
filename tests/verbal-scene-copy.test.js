import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {PERSONAS} from '../dist/persona.js';
import {createRun,getEvent,applyChoice} from '../dist/engine.js';
import {verbalTargetsV30} from '../dist/verbal-v30.js';
import {VERBAL_SCENE_IDS,verbalSceneLine} from '../dist/verbal-scene-copy.js';
import {displayChronicleEvent} from '../dist/chronicle-scene-copy.js';
import {getBanquet} from '../dist/banquet.js';
import {CAST_IDS_V65} from '../dist/cast-v65.js';
import {castVerbalLineV65} from '../dist/verbal-cast-v65.js';

const phases=['event','result'];
const copy=value=>JSON.parse(JSON.stringify(value));
const sample=createRun('ai','e39-verbal-scene-copy');
const rendered=event=>({...event,speaker:event.speaker||'wing'});
const publishedEvents=EVENTS.filter(event=>!event.requiresCastV65&&!event.requiresCastV66);
const publishedPeople=Object.keys(PERSONAS).filter(id=>!CAST_IDS_V65.includes(id));
const source=id=>{const event=EVENTS.find(row=>row.id===id);assert.ok(event,id);return rendered(event);};
const quote=(event,target,run=sample,phase='event')=>verbalSceneLine({event,target,run,phase});
const both=(id,target,run=sample)=>phases.map(phase=>quote({id,speaker:target},target,run,phase));
const validLine=(line,id)=>{
 assert.equal(typeof line,'string',id);assert.ok(line.trim().length>20,id);assert.ok(line.length<500,id);
 assert.doesNotMatch(line,/undefined|null|NaN|https?:\/\/|\/Users\/|\/private\//,id);
};

test('all 861 daily and four fantasy scenes have distinct, deterministic speech in both phases',()=>{
 assert.equal(publishedEvents.length,861);assert.equal(FANTASY_EVENTS.length,4);
 const events=[...publishedEvents,...FANTASY_EVENTS].map(rendered),targets=new Set();
 for(const phase of phases){
  const lines=[];
  for(const event of events){
   const before=copy(event),runBefore=copy(sample),participants=verbalTargetsV30(event),perTarget=[];
   for(const target of participants){
    targets.add(target);const line=quote(event,target,sample,phase);validLine(line,`${event.id}/${target}/${phase}`);
    assert.equal(quote(copy(event),target,copy(sample),phase),line);perTarget.push(line);
   }
   assert.equal(new Set(perTarget).size,participants.length,`${event.id}: co-present people receive different words`);
   lines.push(quote(event,event.speaker==='self'?'self':event.speaker,sample,phase));
   assert.deepEqual(event,before,'copy does not rewrite choice results or source objects');assert.deepEqual(sample,runBefore,'copy does not draw RNG or change player state');
  }
  assert.equal(new Set(lines).size,events.length,`${phase}: no two scenes recycle an identical quote`);
 }
 assert.deepEqual([...targets].sort(),[...publishedPeople,'self'].sort());
});

test('explicit scene IDs refer to real daily or dynamically generated scenes, never typo-only overrides',()=>{
 assert.equal(new Set(VERBAL_SCENE_IDS).size,VERBAL_SCENE_IDS.length);assert.ok(Object.isFrozen(VERBAL_SCENE_IDS));
 assert.ok(EVENTS.filter(event=>VERBAL_SCENE_IDS.includes(event.id)).length>=100);
 const directIds=new Set([...EVENTS,...FANTASY_EVENTS].map(event=>event.id));
 const scriptSource=readdirSync(new URL('../dist/',import.meta.url)).filter(name=>name.endsWith('.js')&&name!=='verbal-scene-copy.js').map(name=>readFileSync(new URL(`../dist/${name}`,import.meta.url),'utf8')).join('\n');
 for(const id of VERBAL_SCENE_IDS){
  if(directIds.has(id))continue;
  if(id.startsWith('meal-with-')){assert.ok(PERSONAS[id.slice('meal-with-'.length)],id);continue;}
  assert.ok(scriptSource.includes(`'${id}'`)||scriptSource.includes(`"${id}"`),`missing source event ${id}`);
 }
});

test('onboarding speech follows the visible honest, swapped and assistant offer instead of inventing reassignment',()=>{
 const examples={};
 for(let attempt=0;attempt<200&&Object.keys(examples).length<3;attempt++){
  const run=createRun('ai',`e31-copy-onboarding-${attempt}`);examples[run.assignment]??=run;
 }
 assert.deepEqual(Object.keys(examples).sort(),['assistant','honest','swapped']);
 const eventLines=new Set(),resultLines=new Set();
 for(const [assignment,run] of Object.entries(examples)){
  const event=getEvent(run),before=copy(run);
  for(const phase of phases){
   const line=quote(event,'wing',run,phase);validLine(line,assignment);(phase==='event'?eventLines:resultLines).add(line);
   if(assignment==='honest'){
    assert.match(line,/順便|範圍|邊界/);assert.doesNotMatch(line,/錄取.*不誠實|工作換|改派|薪水.*縮|報到卻/);
   }else if(assignment==='swapped'){
    assert.match(line,/錄取信/);assert.match(line,/AI工程師/);assert.match(line,/工程師/);assert.match(event.body,/系統工程師/);
   }else assert.match(line,/助理|薪水/);
  }
  assert.deepEqual(run,before);
 }
 assert.equal(eventLines.size,3);assert.equal(resultLines.size,3);
 // A result-stage demand may already have restored the role. The original
 // visible event still identifies the offer being challenged.
 const old=examples.swapped,event=getEvent(old),accepted=applyChoice(old,1);
 assert.match(quote(event,'wing',accepted,'result'),/AI工程師.*工程師/);
});

test('unselected technical answers, choices, random checks and RNG are never read to write the insult',()=>{
 const ai=source('ai31-auto-increment'),before=quote(ai,'rick');
 assert.doesNotMatch(before,/auto[ _]?increment|自動編號|流水號|41.*42/i);
 assert.match(before,/資料庫|匯入|模型|截圖/);assert.match(quote(ai,'rick',sample,'result'),/DB|自動編號/);
 const poisoned={id:ai.id,title:ai.title,body:ai.body,wing:ai.wing,speaker:'rick'};
 for(const key of ['choices','result','check','draw'])Object.defineProperty(poisoned,key,{get(){throw new Error(`future ${key} read`);}});
 const safeRun={roleId:'ai',actualRoleId:'ai'};
 for(const key of ['rng','history','actions','pendingEffect','pendingFamily'])Object.defineProperty(safeRun,key,{get(){throw new Error(`unneeded ${key} read`);}});
 assert.equal(quote(poisoned,'rick',safeRun),before);
 assert.equal(quote({...ai,choices:ai.choices.map(choice=>({...choice,result:'THIS WOULD BE A SPOILER',draw:{outcomes:[]}}))},'rick'),before);
});

test('PIP, pay cuts, low starting pay, education, third-floor duty and raises speak to different actual disputes',()=>{
 const cases=[
  ['pip-review','hope',/驗收標準|打分|不及格/],['pip-passed','hope',/通過/],
  ['salary-cut','hope',/試用期|薪水|工作/],['salary-final','hope',/方案|降薪/],
  ['education-review','wing',/哪裡畢業|學校|科系|畢業證書/],['education-scrutiny','wing',/面試|學歷|畢業證書/],
  ['floor-notice','hope',/五樓|三樓|工作/],['watch-review','hope',/五樓|三樓|站崗/],
  ['watch-empty-corridor','self',/門|工作/],['raise-request','wing',/加薪|薪水|談薪/],
  ['career-review','wing',/下一階|職涯|授權|薪水/],['patronage-application','rick',/位置|椅子/]
 ];
 const lines=[];
 for(const [id,target,pattern] of cases)for(const phase of phases){const line=quote({id,speaker:target,title:id},target,sample,phase);validLine(line,id);assert.match(line,pattern);lines.push(line);}
 assert.equal(new Set(lines).size,lines.length);
 const starting={...sample,salaryAdvice:{origin:'starting-pay',from:27,to:27}};
 assert.match(quote({id:'low-pay-tip',speaker:'erich'},'erich',starting),/一開始就開27K/);
 const cut={...sample,salaryAdvice:{from:40,to:27}};
 assert.match(quote({id:'low-pay-tip',speaker:'erich'},'erich',cut),/薪水被砍/);
 assert.notEqual(quote({id:'low-pay-tip',speaker:'erich'},'erich',starting),quote({id:'low-pay-tip',speaker:'erich'},'erich',cut));
 const outcomes={fury:/朕|登基|皇上|龍袍/,promise:/季度|日期/,offset:/欄|總額|給付|排版/,offer:/生效日|書面/};
 for(const [view,pattern] of Object.entries(outcomes))for(const phase of phases)assert.match(quote({id:'raise-response',speaker:view==='fury'?'wing':'hope'},view==='fury'?'wing':'hope',{...sample,raiseContext:{view}},phase),pattern);
});

test('First Love remains Jack versus Meimei, armwrestling remains Sonny’s excuses, and neither pre-line announces the drawn winner',()=>{
 const banquet=displayChronicleEvent(getBanquet({...sample,eventId:'banquet-welcome'}));
 for(const phase of phases){
  for(const target of ['rick','wing']){
   const line=quote(banquet,target,sample,phase);assert.match(line,/傑克|兩個人/);assert.match(line,/水蛇|兩個人/);assert.match(line,/搶|爭|決鬥/);
  }
 }
 for(const target of ['rick','wing'])assert.doesNotMatch(quote(banquet,target),/傑克搶麥成功|傑克先搶到|搶歌的人還是傑克/);
 const arm=displayChronicleEvent(source('video-pizza-overtime'));
 assert.match(quote(arm,'sonny'),/抽筋|拉到|吃太飽/);assert.match(quote(arm,'sonny'),/記者會/);
 assert.doesNotMatch(quote(arm,'sonny'),/傑克.*贏|弄傷了|世界冠軍/);
 assert.notEqual(quote(arm,'sonny'),quote(source('quiz26-arm-draw'),'sonny'));
 assert.notEqual(quote(arm,'sonny'),quote(arm,'sonny',sample,'result'));
});

test('all twenty-one non-professor meal guests get individual, meal-specific replies in both phases',()=>{
 const lines=[];
 for(const target of publishedPeople.filter(id=>id!=='professor')){
  const [event,result]=both(`meal-with-${target}`,target);validLine(event,target);validLine(result,target);
  assert.match(`${event} ${result}`,/飯|餐|湯|麵|菜|筷|吃|點|鍋|甜點|砂鍋|結帳|收銀|便當/);assert.notEqual(event,result,target);lines.push(event,result);
 }
 assert.equal(new Set(lines).size,42);
 const event={id:'banquet-afterparty',speaker:'kind',body:'阿良問要不要一起吃甜點。'};
 for(const phase of phases){assert.doesNotMatch(quote(event,'kind',{...sample,characterGender:'female'},phase),/暗黑|四手|鋼琴/);}
 assert.match(quote({...event,body:'阿良又提起私房暗黑行程。'},'kind'),/暗黑/);
 assert.notEqual(...both('kind-workday','kind'));
});

test('new r65 meal guests use their cohort-specific wrapper while published speech stays frozen',()=>{
 const run=createRun('ai','e39-r65-n-0000000000000000000000'),lines=[];
 for(const target of CAST_IDS_V65)for(const phase of phases){
  const event={id:`meal-with-${target}`,speaker:target,scope:'private',title:'下班一起吃飯。'},line=castVerbalLineV65(run,event,target,phase);
  validLine(line,`${target}/${phase}`);assert.match(line,/吃飯|飯局|私下安排|下班/);assert.ok(line.startsWith(`${PERSONAS[target].name}，`));lines.push(line);
  assert.equal(castVerbalLineV65(sample,event,target,phase),null,'a published life cannot acquire a new voice');
 }
 assert.equal(new Set(lines).size,CAST_IDS_V65.length*2);
});

test('multi-person PIP, dismissal, patronage and back-office scenes distinguish the selected person’s role',()=>{
 const scenes=[
  [{id:'crisis-boss',speaker:'exit-team'},['erich','jenjen','sonny']],
  [{id:'dismissal-final',speaker:'exit-team'},['erich','jenjen','sonny']],
  [{id:'patronage-application',speaker:'wing'},['wing','hope','rick']],
  [source('q26-pip-mentor-paradox'),['hope','rick','jack']],
  [source('admin28-extension-grandeur'),['wing','jenjen','erich','sonny']],
  [source('hr28-attendance-access'),['jack','meimei']],
  [source('q26-spring-dinner-seats'),['spencer','rick','sophie']]
 ];
 for(const [event,targets] of scenes)for(const phase of phases){const lines=targets.map(target=>quote(event,target,sample,phase));assert.equal(new Set(lines).size,targets.length,event.id);}
 assert.match(quote(source('q26-pip-mentor-paradox'),'hope'),/驗收|標準|領導/);
 assert.match(quote(source('q26-pip-mentor-paradox'),'rick'),/能教|接電話/);
 assert.match(quote(source('hr28-attendance-access'),'meimei'),/舊設定|申請/);
 assert.match(quote(source('hr28-attendance-access'),'jack'),/審核人|通知/);
});

test('sales, business development, design, engineering and coffee use substantive job-specific dialogue',()=>{
 const cases=[
  ['sales21-commission-proof','jenjen',/佣金|成交/],['sales21-forecast-zoo','wing',/成交|漏斗/],
  ['bd21-mou-annex','spencer',/MOU|合作|合約|簽|人力/],
  ['design-v21-chairman-portrait','spencer',/照片|椅子|威嚴/],
  ['rick-architecture-relic','rick',/架構|系統|箭頭/],['hr28-coffee-jd','wing',/咖啡|牛奶|人資/]
 ];
 for(const [id,target,pattern] of cases){const event=source(id);assert.ok(VERBAL_SCENE_IDS.includes(id));assert.match(quote(event,target),pattern);assert.notEqual(quote(event,target),quote(event,target,sample,'result'));}
});
