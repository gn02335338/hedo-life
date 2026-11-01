import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../worker/http.js';
import { OfficeActivityStore, OFFICE_ACTIVITY_RETENTION } from '../worker/office-activities.js';
import { getOfficeEvent, OFFICE_EVENT_BUCKET_MS } from '../dist/office/events.js';
import { createSharedOfficeGame, resolveSharedOfficeRound, sharedOfficeActionIds, SHARED_OFFICE_ROUND_MS } from '../dist/office/shared-activities.js';

function eventOf(type='duel') { for(let bucket=0;bucket<3;bucket++){const event=getOfficeEvent(bucket*OFFICE_EVENT_BUCKET_MS);if(event.type===type)return event;} }
function harness(t,{type='duel',kinds=['human','agent','agent','human']}={}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());const event=eventOf(type);let clock=event.startsAt;
 db.exec("CREATE TABLE office_members(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,admission_status TEXT NOT NULL,social_auto_activities INTEGER NOT NULL DEFAULT 1);CREATE TABLE synthetic_activity_inbox(member_id TEXT,id TEXT,payload TEXT,PRIMARY KEY(member_id,id));");
 const sql={exec(query,...values){let rows=[];if(!values.length&&query.includes(';'))db.exec(query);else{const statement=db.prepare(query);if(statement.columns().length)rows=statement.all(...values);else statement.run(...values);}return{toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 let inTransaction=false;
 const storage={transactionSync(fn){assert.equal(inTransaction,false,'Activity callbacks must not nest transactions');inTransaction=true;db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}finally{inTransaction=false;}}};
 const members=kinds.map((kind,index)=>({id:randomUUID(),name:`Synthetic ${index}`,kind}));
 for(const member of members)sql.exec("INSERT INTO office_members(id,name,kind,admission_status) VALUES(?,?,?,'approved')",member.id,member.name,member.kind);
 const notifications=[];
 const approved=id=>{const row=sql.exec("SELECT * FROM office_members WHERE id=? AND admission_status='approved'",id).toArray()[0];if(!row)throw new ApiError(403,'office_approval_required','approval required');return row;};
 const create=()=>new OfficeActivityStore(sql,storage,{now:()=>clock,assertApproved:approved,mutation:(id,fn)=>storage.transactionSync(()=>{approved(id);return fn();}),deliverActivity:(id,notice)=>{sql.exec('INSERT INTO synthetic_activity_inbox(member_id,id,payload) VALUES(?,?,?) ON CONFLICT(member_id,id) DO NOTHING',id,notice.id,JSON.stringify(notice));notifications.push(notice);}});
 let store=create();
 const join=who=>store.join(who.id,{eventId:event.id});
 const match=()=>{join(members[0]);return join(members[1]).match;};
 const move=(who,game,action,submissionId=randomUUID(),round=game.currentRound)=>store.move(who.id,game.id,{round,action,submissionId});
 return{event,members,sql,notifications,join,match,move,get store(){return store;},now:()=>clock,at:time=>{clock=time;},advance:ms=>{clock+=ms;},reopen(){store=create();}};
}
const status=code=>error=>error instanceof ApiError&&error.status===code;

test('shared rules use both actual choices, finish in four/eight rounds and preserve old states',()=>{
 for(const type of ['duel','arm-wrestling','coffee']){
  const options=sharedOfficeActionIds(type);let state=createSharedOfficeGame(type);
  for(let round=0;round<state.maxRounds;round++){
   const before=structuredClone(state),next=resolveSharedOfficeRound(state,[options[round%3],options[(round+1)%3]]);
   assert.deepEqual(state,before);assert.equal(next.round,round+1);assert.equal(next.scores[0]+next.scores[1],2*next.round);assert.ok(next.energy.every(value=>value>=0&&value<=6));state=next;
  }
  assert.equal(state.status,'finished');assert.equal(state.history.length,type==='coffee'?4:8);
 }
 for(const a of ['attack','guard','dodge'])for(const b of ['attack','guard','dodge']){
  const initial=createSharedOfficeGame('duel'),forward=resolveSharedOfficeRound(initial,[a,b]),reverse=resolveSharedOfficeRound(initial,[b,a]);
  assert.deepEqual(forward.scores,[...reverse.scores].reverse());
 }
 assert.throws(()=>resolveSharedOfficeRound(createSharedOfficeGame('duel'),['attack','power']),TypeError);
});

test('a solitary registrant waits without a fabricated opponent, and real humans and agents can pair',t=>{
 const h=harness(t),[a,b,c,d]=h.members;
 const waiting=h.join(a);assert.equal(waiting.registration.status,'waiting');assert.equal(waiting.match,null);assert.equal(h.store.snapshot().matches.length,0);
 const paired=h.join(b);assert.deepEqual(new Set(paired.match.participantIds),new Set([a.id,b.id]));assert.equal(paired.match.mode,'shared');
 assert.equal(h.join(a).match.id,paired.match.id);assert.equal(h.join(a).duplicate,true);
 assert.equal(h.join(c).match,null);const second=h.join(d).match;assert.ok(second);assert.notEqual(second.id,paired.match.id);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_matches').one().n,2);
 assert.ok(h.notifications.filter(notice=>notice.type==='activity-turn').length>=4);
});

test('human-human, human-agent and agent-agent pairs all use two approved persisted identities',t=>{
 for(const kinds of [['human','human'],['human','agent'],['agent','agent']]){
  const h=harness(t,{kinds}),match=h.match();
  assert.deepEqual(match.participants.map(person=>person.kind),kinds);
  assert.deepEqual(new Set(match.participantIds),new Set(h.members.map(person=>person.id)));
  assert.ok(match.participantIds.every(id=>h.sql.exec("SELECT id FROM office_members WHERE id=? AND admission_status='approved'",id).toArray().length===1));
 }
});

test('one sealed move stays hidden from everyone until both actual participants commit, including after restart',t=>{
 const h=harness(t),[a,b,c]=h.members,game=h.match(),submission=randomUUID();
 const first=h.move(a,game,'attack',submission);assert.equal(first.match.round,0);assert.deepEqual(first.match.submitted,[true,false]);assert.deepEqual(first.match.history,[]);
 const observer=h.store.snapshot(c.id).matches[0];assert.deepEqual(observer.history,[]);assert.deepEqual(observer.submitted,[true,false]);assert.equal(Object.hasOwn(observer,'moves'),false);assert.equal(Object.hasOwn(observer,'action'),false);assert.equal(Object.hasOwn(observer,'state_json'),false);
 assert.throws(()=>h.move(c,game,'dodge'),status(403));
 h.reopen();assert.deepEqual(h.store.snapshot().matches[0].submitted,[true,false]);
 const second=h.move(b,game,'guard');assert.equal(second.match.round,1);assert.deepEqual(second.match.history[0].actions,['attack','guard']);assert.deepEqual(second.match.scores,[0,2]);
 const repeated=h.move(a,game,'attack',submission,1);assert.equal(repeated.duplicate,true);assert.equal(repeated.receipt.accepted,true);assert.equal(repeated.match.round,1);assert.deepEqual(repeated.match.scores,[0,2]);
 assert.throws(()=>h.move(a,game,'dodge',submission,1),status(409));assert.throws(()=>h.move(a,game,'attack',randomUUID(),1),status(409));
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_moves').one().n,2);
});

test('malformed actions, forged scores and attempts to replace a sealed action never mutate the match',t=>{
 const h=harness(t),[a]=h.members,game=h.match();
 for(const body of [{round:1,action:'power',submissionId:randomUUID()},{round:0,action:'attack',submissionId:randomUUID()},{round:1,action:'attack',submissionId:[randomUUID()]},{round:1,action:'attack',submissionId:randomUUID(),score:999}])assert.throws(()=>h.store.move(a.id,game.id,body),status(400));
 h.move(a,game,'attack');assert.throws(()=>h.move(a,game,'guard'),status(409));
 assert.equal(h.store.snapshot().matches[0].round,0);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_moves').one().n,1);
});

test('all types finish authoritatively and already paired matches continue beyond the event window',t=>{
 for(const type of ['duel','arm-wrestling','coffee']){
  const h=harness(t,{type}),[a,b,c]=h.members;h.at(h.event.playEndsAt-1000);let game=h.match();const options=sharedOfficeActionIds(type);
  for(let round=1;round<=game.maxRounds;round++){h.advance(5000);h.move(a,game,options[(round-1)%3]);game=h.move(b,game,options[round%3]).match;}
  assert.equal(game.status,'finished');assert.equal(game.finishReason,'completed');assert.equal(game.history.length,type==='coffee'?4:8);assert.ok(game.round<=8);
  if(type!=='coffee')assert.ok(h.now()>h.event.endsAt);
  assert.equal(h.join(a).match.id,game.id);assert.throws(()=>h.join(c),status(409));
 }
});

test('one missing player forfeits fairly, two missing players draw, and old accepted submissions still retry after timeout',t=>{
 const h=harness(t),[a,b]=h.members,game=h.match(),submission=randomUUID();h.move(a,game,'attack',submission);
 h.at(game.roundDeadline);let result=h.store.snapshot().matches[0];assert.equal(result.status,'finished');assert.equal(result.finishReason,'timeout');assert.equal(result.winnerId,a.id);assert.deepEqual(result.forfeitedIds,[b.id]);assert.deepEqual(result.history,[]);
 assert.equal(h.move(a,game,'attack',submission,1).duplicate,true);assert.throws(()=>h.move(b,game,'guard'),status(409));
 const both=harness(t),empty=both.match();both.at(empty.roundDeadline);result=both.store.snapshot().matches[0];assert.equal(result.draw,true);assert.equal(result.winnerId,null);assert.equal(result.forfeitedIds.length,2);
});

test('withdrawal is persistent and cannot manufacture a second match in the same event',t=>{
 const h=harness(t),[a,b,c]=h.members;h.join(a);const left=h.store.leave(a.id,{eventId:h.event.id});assert.equal(left.registration.status,'withdrawn');assert.equal(h.join(a).registration.status,'withdrawn');
 h.join(b);assert.equal(h.join(c).match.participantIds.includes(a.id),false);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_matches').one().n,1);
 const active=h.store.snapshot(b.id).myMatches[0],forfeit=h.store.leave(b.id,{eventId:h.event.id});assert.equal(forfeit.match.finishReason,'withdrawal');assert.equal(forfeit.match.winnerId,c.id);
 assert.equal(h.store.leave(b.id,{eventId:h.event.id}).duplicate,true);assert.equal(h.join(b).match.id,active.id);
});

test('revocation blocks every write immediately and the opponent receives an explicit forfeit instead of a fake action',t=>{
 const h=harness(t),[a,b]=h.members,game=h.match();h.sql.exec("UPDATE office_members SET admission_status='revoked' WHERE id=?",b.id);
 for(const operation of [()=>h.join(b),()=>h.move(b,game,'guard'),()=>h.store.leave(b.id,{eventId:h.event.id})])assert.throws(operation,status(403));
 const result=h.store.snapshot().matches[0];assert.equal(result.finishReason,'revoked');assert.equal(result.winnerId,a.id);assert.deepEqual(result.history,[]);assert.equal(result.participants[1].name,'已離場成員');
});

test('agent opt-out blocks new moves and waiting agents are matched only after opting in again',t=>{
 const h=harness(t),[human,agent]=h.members;h.sql.exec('UPDATE office_members SET social_auto_activities=0 WHERE id=?',agent.id);assert.throws(()=>h.join(agent),status(403));
 h.sql.exec('UPDATE office_members SET social_auto_activities=1 WHERE id=?',agent.id);h.join(agent);h.sql.exec('UPDATE office_members SET social_auto_activities=0 WHERE id=?',agent.id);assert.equal(h.join(human).match,null);
 h.sql.exec('UPDATE office_members SET social_auto_activities=1 WHERE id=?',agent.id);const paired=h.store.snapshot(agent.id).myMatches[0];assert.ok(paired);
 h.sql.exec('UPDATE office_members SET social_auto_activities=0 WHERE id=?',agent.id);assert.throws(()=>h.move(agent,paired,'attack'),status(403));
});

test('one member cannot join another event while their previous match is still active',t=>{
 const h=harness(t),[a,b]=h.members,game=h.match();
 const next=getOfficeEvent(h.event.nextStartsAt),later=h.event.nextStartsAt;
 // Keep the old game's server deadline alive to model an extended final round.
 h.sql.exec('UPDATE office_event_matches SET round_deadline=? WHERE id=?',later+SHARED_OFFICE_ROUND_MS,game.id);h.at(later);
 assert.equal(getOfficeEvent(h.now()).id,next.id);assert.throws(()=>h.store.join(a.id,{eventId:next.id}),status(409));
 assert.equal(h.store.snapshot(b.id).myMatches[0].id,game.id);
});

test('invitations and turn notifications deduplicate durably and never contain sealed choices',t=>{
 const h=harness(t),[a]=h.members;
 const invites=h.store.invitations(a.id);assert.equal(invites.length,1);assert.equal(invites[0].payload.eventId,h.event.id);assert.equal(invites[0].type,'activity-invitation');
 h.store.invitations(a.id);h.reopen();h.store.invitations(a.id);assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM synthetic_activity_inbox WHERE member_id=?',a.id).one().n,1);
 const game=h.match();h.move(a,game,'attack');h.store.invitations(a.id);
 const notices=h.sql.exec('SELECT payload FROM synthetic_activity_inbox WHERE member_id=?',a.id).toArray().map(row=>JSON.parse(row.payload));
 assert.ok(notices.some(notice=>notice.type==='activity-turn'&&notice.payload.matchId===game.id));
 for(const notice of notices){assert.equal(Object.hasOwn(notice.payload,'action'),false);assert.equal(Object.hasOwn(notice.payload,'moves'),false);}
 h.at(h.event.playEndsAt);assert.equal(h.store.invitations(h.members[2].id).length,0);
});

test('retention bounds finished tables while preserving active/current games and retained exact-once receipts',t=>{
 const h=harness(t),[a,b,c,d]=h.members,now=h.now(),records=[];
 const addEvent=event=>h.sql.exec('INSERT INTO office_event_catalog(id,type,starts_at,join_closes_at,event_json) VALUES(?,?,?,?,?)',event.id,event.type,event.startsAt,event.playEndsAt,JSON.stringify(event));
 const addRegistration=(eventId,memberId,matchId)=>h.sql.exec("INSERT INTO office_event_registrations(event_id,member_id,status,match_id,joined_at,updated_at) VALUES(?,?,'matched',?,?,?)",eventId,memberId,matchId,now-1000,now-1000);
 for(let index=1;index<=OFFICE_ACTIVITY_RETENTION.finishedMatches+5;index++){
  const event=getOfficeEvent(-index*OFFICE_EVENT_BUCKET_MS),id=randomUUID(),submissionId=randomUUID(),action=sharedOfficeActionIds(event.type)[0],finished=now-index*1000;
  addEvent(event);const state={...createSharedOfficeGame(event.type),status:'finished',winner:'draw'};
  h.sql.exec("INSERT INTO office_event_matches(id,event_id,type,participant_a,participant_b,state_json,round_deadline,created_at,updated_at,finished_at,finish_reason) VALUES(?,?,?,?,?,?,?,?,?,?,'timeout')",id,event.id,event.type,a.id,b.id,JSON.stringify(state),finished,finished-1000,finished,finished);
  h.sql.exec('INSERT INTO office_event_moves(match_id,round,member_id,action,submission_id,created_at) VALUES(?,1,?,?,?,?)',id,a.id,action,submissionId,finished-100);
  addRegistration(event.id,a.id,id);addRegistration(event.id,b.id,id);records.push({id,eventId:event.id,submissionId,action});
 }
 // The oldest event also has an actual unfinished match and must keep its
 // catalog and registered participants despite falling outside 200 events.
 const activeId=randomUUID(),oldest=records.at(-1),activeState=createSharedOfficeGame('duel');
 h.sql.exec('INSERT INTO office_event_matches(id,event_id,type,participant_a,participant_b,state_json,round_deadline,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',activeId,oldest.eventId,'duel',c.id,d.id,JSON.stringify(activeState),now+60000,now-2000000,now);
 addRegistration(oldest.eventId,c.id,activeId);addRegistration(oldest.eventId,d.id,activeId);
 addEvent(h.event);const currentId=randomUUID(),currentState={...createSharedOfficeGame(h.event.type),status:'finished',winner:'draw'};
 h.sql.exec("INSERT INTO office_event_matches(id,event_id,type,participant_a,participant_b,state_json,round_deadline,created_at,updated_at,finished_at,finish_reason) VALUES(?,?,?,?,?,?,?,?,?,?,'timeout')",currentId,h.event.id,h.event.type,a.id,b.id,JSON.stringify(currentState),now-3000000,now-3000000,now-3000000,now-3000000);
 addRegistration(h.event.id,a.id,currentId);addRegistration(h.event.id,b.id,currentId);
 // Older deployments or maintenance could leave an orphan; it has no receipt
 // authority and should not grow the sealed-move table indefinitely either.
 h.sql.exec('INSERT INTO office_event_moves(match_id,round,member_id,action,submission_id,created_at) VALUES(?,1,?,?,?,?)',randomUUID(),a.id,'attack',randomUUID(),now-4000000);
 const snapshot=h.store.snapshot(a.id);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_matches WHERE finished_at IS NOT NULL').one().n,OFFICE_ACTIVITY_RETENTION.finishedMatches+1,'the current-event exception remains bounded by that event');
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_matches WHERE finished_at IS NULL').one().n,1);
 assert.ok(snapshot.matches.some(match=>match.id===activeId));assert.ok(snapshot.matches.some(match=>match.id===currentId));
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_catalog').one().n,OFFICE_ACTIVITY_RETENTION.recentEvents+1);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_registrations WHERE event_id=? AND member_id IN (?,?)',oldest.eventId,c.id,d.id).one().n,2);
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_moves x LEFT JOIN office_event_matches m ON m.id=x.match_id WHERE m.id IS NULL').one().n,0);
 const kept=records[OFFICE_ACTIVITY_RETENTION.finishedMatches-1],evicted=records.at(-1);
 assert.equal(h.store.move(a.id,kept.id,{round:1,action:kept.action,submissionId:kept.submissionId}).duplicate,true,'retained commands remain exact-once after their event registration was pruned');
 assert.throws(()=>h.store.move(a.id,evicted.id,{round:1,action:evicted.action,submissionId:evicted.submissionId}),status(404));
 assert.throws(()=>h.store.move(a.id,evicted.id,{round:1,action:evicted.action,submissionId:randomUUID()}),status(404));
 h.reopen();assert.deepEqual(h.store.snapshot(a.id),snapshot,'repeated public reads and restarts cannot recreate or rescore evicted matches');
 assert.equal(h.sql.exec('SELECT COUNT(*) AS n FROM office_event_moves').one().n,OFFICE_ACTIVITY_RETENTION.finishedMatches);
});
