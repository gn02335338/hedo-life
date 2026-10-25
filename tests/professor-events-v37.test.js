import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {EVENTS} from '../dist/events.js';
import {PROFESSOR_EVENTS_V37} from '../dist/events-professor-v37.js';
import {ROLE_MAP} from '../dist/roles.js';
import {PERSONAS,displayText} from '../dist/persona.js';
import {SOURCES} from '../dist/public-sources.js';
import {createRun,getEvent,applyChoice,advance,replayRun,validRun} from '../dist/engine.js';

const added=PROFESSOR_EVENTS_V37;
const ids=new Set(added.map(event=>event.id));
const expectedExclusive={system:3,ai:3,mis:2,project:2,product:2,design:2,bd:2,sales:1,finance:2,accounting:1,hr:1,admin:1,executive:0};
const privateMaterial=/https?:\/\/|notion(?:-file-block:|\.com|\.so)|jacktang|verified-bank\.json|body-cache\.json|evidence-private|\/Users\/|Jefferson|\bSean\b/i;
const advanceChoice=(run,index)=>advance(applyChoice(run,index));
const displayedChoice=choice=>({...choice,text:displayText(choice.text),detail:displayText(choice.detail),result:displayText(choice.result)});

test('thirty professor stories are distinct ordinary scenes with ninety authored, concealed responses',()=>{
  assert.equal(added.length,30);assert.equal(ids.size,30);
  assert.ok(PERSONAS.professor);
  assert.deepEqual(new Set(EVENTS.filter(event=>event.speaker==='professor'&&!event.requiresCastV66&&!event.requiresRelationshipV72).map(event=>event.id)),ids);
  const titles=new Set(),texts=new Set(),results=new Set();
  for(const event of added){
    assert.match(event.id,/^professor37-/);assert.equal(event.speaker,'professor');
    assert.equal(event.minRules,37);assert.equal(event.minTurn,1);
    assert.equal(event.context,undefined,'the professor must not require PIP to appear');
    assert.equal(event.minRank,undefined);assert.equal(event.requireGender,undefined);
    assert.ok(event.body.length>=40&&event.wing.length>=8,event.id);
    assert.ok(!titles.has(event.title),event.id);titles.add(event.title);
    assert.equal(event.choices.length,3);assert.equal(event.choices.filter(choice=>choice.wild).length,1);
    assert.ok(event.choices[2].wild,'the authored absurd answer must survive as its own choice');
    assert.doesNotMatch([event.title,event.body,event.wing].join('\n'),privateMaterial,event.id);
    for(const choice of event.choices){
      assert.ok(choice.text.length>=8&&choice.result.length>=20,event.id);
      assert.equal(choice.detail,'','the preview must not include consequences or odds');
      assert.doesNotMatch(choice.text,/%|(?:成功率|機率)\s*[:：=]?\s*\d|好感[+-]|[+-]\d+/);
      assert.doesNotMatch(choice.text,privateMaterial,event.id);assert.doesNotMatch(choice.result,privateMaterial,event.id);
      assert.ok(!texts.has(choice.text),`${event.id}: recycled answer`);texts.add(choice.text);
      assert.ok(!results.has(choice.result),`${event.id}: recycled consequence`);results.add(choice.result);
      assert.ok(Object.values(choice.delta).every(Number.isInteger));
      assert.ok(!choice.effect&&!choice.check&&!choice.draw,'ordinary conversations must not silently graduate, hire or dismiss a player');
    }
  }
  assert.equal(titles.size,30);assert.equal(texts.size,90);assert.equal(results.size,90);
});

test('eight shared professor scenes remain available to all thirteen jobs while twenty-two retain job-specific work',()=>{
  assert.equal(added.filter(event=>!event.roles).length,8);
  assert.equal(added.filter(event=>event.roles?.length===1).length,22);
  assert.equal(Object.keys(ROLE_MAP).length,13);
  assert.deepEqual(new Set(Object.keys(expectedExclusive)),new Set(Object.keys(ROLE_MAP)));
  for(const event of added)if(event.roles)assert.ok(event.roles.every(role=>ROLE_MAP[role]),event.id);
  for(const [role,count]of Object.entries(expectedExclusive)){
    const exclusive=added.filter(event=>event.roles?.length===1&&event.roles[0]===role);
    assert.equal(exclusive.length,count,`${role}: preserve its own research/company task mix`);
    const eligible=added.filter(event=>!event.roles||event.roles.includes(role));
    assert.equal(eligible.length,8+count,role);
    assert.equal(eligible.filter(event=>!event.roles).length,8,`${role}: unfamiliar departments can still meet the professor`);
  }
});

test('the professor bibliography identifies fictional adaptation and publishes no private evidence or answer bank',()=>{
  const source=SOURCES.professorFiction;
  assert.ok(source);assert.equal(source.url,null);
  assert.match(source.summary,/虛構/);assert.match(source.summary,/獨立史實/);
  for(const event of added){
    assert.ok(event.sourceIds.includes('professorFiction'),event.id);
    assert.ok(event.sourceIds.includes('characterFiction'),event.id);
    for(const key of event.sourceIds){assert.ok(SOURCES[key],`${event.id}: unknown source ${key}`);assert.doesNotMatch(key,privateMaterial);}
  }
});

test('every pre-e37 event pool excludes the new professor and bounded old-cohort lives cannot draw him',()=>{
  for(let rules=1;rules<=36;rules++){
    const supported=EVENTS.filter(event=>(event.minRules??0)<=rules);
    assert.ok(!supported.some(event=>ids.has(event.id)||event.speaker==='professor'),`e${rules}`);
  }
  // A few short canonical lives also exercise the actual scheduler; these are
  // bounded regression checks rather than a simulation or edited game state.
  for(const cohort of [1,15,22,35,36]){
    let run=createRun('system',`e${cohort}-professor-stays-new`);
    for(let step=0;step<8&&!run.completed;step++){
      const event=getEvent(run);assert.ok(event);
      assert.ok(!ids.has(event.id)&&event.speaker!=='professor',`e${cohort}: ${event.id}`);
      const index=event.choices.findIndex(choice=>choice.available!==false);assert.ok(index>=0);
      run=advanceChoice(run,index);assert.equal(validRun(run),true,`e${cohort}: ${run.eventId}`);
    }
  }
});

test('all thirty natural e37 prefixes preserve original choices through the real render overlays without drawing RNG',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/professor-v37.json',import.meta.url),'utf8'));
  assert.equal(fixture.version,37);assert.equal(fixture.scenes.length,30);
  assert.deepEqual(new Set(fixture.scenes.map(route=>route.id)),ids);
  for(const route of fixture.scenes){
    assert.match(route.seed,/^e37-/);assert.ok(Array.isArray(route.beforeActions));
    const run=replayRun(route.roleId,route.seed,route.beforeActions),snapshot=structuredClone(run);
    const authored=added.find(event=>event.id===route.id);assert.ok(authored);
    assert.equal(validRun(run),true,route.id);assert.equal(run.eventId,authored.id);
    assert.ok(!authored.roles||authored.roles.includes(run.actualRoleId),`${route.id}: actual reassigned occupation`);
    for(let view=0;view<3;view++){
      const rendered=getEvent(run);
      assert.equal(rendered.kind,'daily');assert.equal(rendered.speaker,'professor');
      // Canonical replay aliases remain frozen; the UI uses displayText to
      // restore the current name. Compare what the player actually reads.
      for(const field of ['title','body','wing'])assert.equal(displayText(rendered[field]),displayText(authored[field]),`${route.id}: ${field}`);
      assert.match(displayText(rendered.body),/林老師/);assert.doesNotMatch(displayText(rendered.body),/顧問教授/);
      assert.deepEqual(rendered.sourceIds,authored.sourceIds);
      assert.deepEqual(rendered.choices.map(displayedChoice),authored.choices.map(displayedChoice),`${route.id}: choices`);
      assert.deepEqual(run,snapshot,'copy, persona, wild and gender overlays must not consume a draw or rewrite the run');
    }
  }
});
