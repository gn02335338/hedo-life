import test from 'node:test';
import assert from 'node:assert/strict';
import {EVENTS} from '../dist/events.js';
import {CAREER_EVENTS_V71} from '../dist/events-career-v71.js';
import {ALICE_EVENTS_V71} from '../dist/events-alice-v71.js';
import {selectWorkEventV71} from '../dist/work-events-v71.js';
import {isCareerContentV71} from '../dist/career-content-v71.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';

const roles=['sales','bd','design','project','product','finance','accounting','hr','admin','executive'];
const drawFor=seed=>{let value=seed;return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};};

test('ten non-engineering occupations own six independent dilemmas with substantive answers and a wild option',()=>{
 assert.equal(CAREER_EVENTS_V71.length,60);
 assert.equal(new Set(CAREER_EVENTS_V71.map(event=>event.id)).size,60);
 assert.equal(new Set(CAREER_EVENTS_V71.map(event=>event.body)).size,60);
 for(const role of roles){
  const authored=CAREER_EVENTS_V71.filter(event=>event.roles[0]===role);assert.equal(authored.length,6,role);
  for(const event of authored){
   assert.deepEqual(event.roles,[role]);assert.equal(event.requiresCareerV71,true);assert.equal(event.careerFocusV71,true);
   assert.equal(event.kind,'daily');assert.ok(event.body.length>40);assert.equal(event.choices.length,3);
   assert.equal(new Set(event.choices.map(choice=>choice.text)).size,3);assert.equal(event.choices[2].wild,true);
   assert.ok(event.choices.every(choice=>choice.result.length>28));
   assert.ok(event.choices.every(choice=>!choice.effect),'job decisions resolve work, not shortcuts to a finale');
   assert.doesNotMatch(event.choices.map(choice=>choice.text).join(' '),/成功率|\d+%|心情\s*[+-]|體力\s*[+-]/);
   assert.equal(event.verbalLinesV71.length,2);assert.ok(event.verbalLinesV71[1].includes(event.title.replace(/[。！]/g,'')),'result-phase insults refer to the actual dilemma');
  }
 }
});

test('Alice has independent authored stories and keeps invitations optional with a choice-only flag',()=>{
 assert.ok(ALICE_EVENTS_V71.length>=31);assert.equal(new Set(ALICE_EVENTS_V71.map(event=>event.id)).size,ALICE_EVENTS_V71.length);
 const friends=ALICE_EVENTS_V71.filter(event=>event.participants?.includes('captain'));assert.equal(friends.length,6);
 const invitations=ALICE_EVENTS_V71.filter(event=>event.choices.some(choice=>choice.flags.includes('cards71_invited')));assert.equal(invitations.length,2);
 for(const event of ALICE_EVENTS_V71){
  assert.equal(event.speaker,'alice');assert.equal(event.requiresCareerV71,true);assert.equal(event.choices.length,3);assert.equal(event.choices[2].wild,true);
  assert.doesNotMatch(JSON.stringify(event),/偽娘|男生|女生|性別其實/);
  for(const choice of event.choices){assert.equal(choice.effect,undefined);assert.equal(choice.draw,undefined);assert.equal(choice.delta.cash,undefined),'career invitation never draws or charges a separate game';}
 }
 for(const event of invitations){assert.ok(event.choices[0].flags.includes('cards71_invited'));assert.ok(event.choices.slice(1).every(choice=>!choice.flags.includes('cards71_invited')));}
});

test('new work cadence gives every actual occupation recurring dilemmas without repeating authored events or one main speaker',()=>{
 for(const role of roles){
  let job=0,focus=0,alice=0;
  for(let sample=1;sample<=40;sample++){
   const run={seed:'e39-r71-n-'+sample.toString(16).padStart(22,'0'),actualRoleId:role,turn:0,seen:[],history:[],flags:{activity46_enabled:1,activity44_banquet:1}};
   const draw=drawFor(sample*7951+roles.indexOf(role)*37),ids=[],speakers=new Set();
   let sinceFocus=0;
   for(let index=0;index<16;index++){
    run.turn=index;
    const pool=EVENTS.filter(event=>!event.requiresRelationshipV72&&!event.context&&(!event.roles||event.roles.includes(role))&&(event.minTurn??0)<=index&&(event.maxTurn??99)>=index&&(event.minRank??0)===0&&calendarDailyAllowedV46(run,event)&&officeTreatDailyAllowedV61(run,event)&&!run.seen.includes(event.id));
    const snapshot=structuredClone(run),selected=selectWorkEventV71(run,pool,draw,EVENTS),event=EVENTS.find(event=>event.id===selected);
    assert.deepEqual(run,snapshot,'selecting an event does not mutate evidence or stats');
    assert.ok(event);assert.ok(!event.roles||event.roles.includes(role));assert.ok(!ids.includes(selected),'same-life work does not repeat while fresh eligible scenes remain');
    const freshFocus=pool.some(row=>row.careerFocusV71);sinceFocus=event.careerFocusV71?0:sinceFocus+1;
    if(freshFocus)assert.ok(sinceFocus<=2,`${role}: meaningful job work is not postponed past two intervening scenes`);
    if(event.roles?.includes(role))job++;if(event.careerFocusV71)focus++;if(event.speaker==='alice')alice++;
    ids.push(selected);speakers.add(event.speaker||'wing');run.seen.push(selected);run.history.push({kind:'daily',choiceIndex:0,turn:index,eventId:selected});
   }
   assert.ok(speakers.size>=5,`${role}: keep more than one small circle of coworkers`);
  }
  assert.ok(job/(40*16)>=.60,`${role}: actual occupation owns most working scenes`);
  assert.ok(focus/(40*16)>=.25,`${role}: authored dilemmas have real exposure`);
  assert.ok(alice>0,`${role}: shared slots can still introduce Alice`);
 }
});

test('the strict new profile does not adopt unsupported or malformed future seeds',()=>{
 for(const profile of [71,72,73,74,75])for(const marker of ['n','s','d'])assert.equal(isCareerContentV71(`e39-r${profile}-${marker}-${'a'.repeat(22)}`),true);
 for(const seed of ['e39-r70-n-'+'a'.repeat(22),'e39-r76-n-'+'a'.repeat(22),'e39-r71-x-'+'a'.repeat(22),'e39-r71-n-'+'a'.repeat(21),'e39-r71-n-'+'A'.repeat(22)])assert.equal(isCareerContentV71(seed),false);
});
