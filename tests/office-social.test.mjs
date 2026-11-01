import test from 'node:test';
import assert from 'node:assert/strict';
import { getOfficeRoster } from '../dist/office/model.js';
import { getOfficeSocialMoments, sampleOfficeRoutine, getOfficeEncounters, SOCIAL_CYCLE_MS } from '../dist/office/social.js';
import { getOfficeEvent } from '../dist/office/events.js';

const remote=[{id:'human-member',kind:'human',name:'小明',online:true,departmentFloor:5,floor:5,zone:'studio',status:'working',activity:'整理設計'},
  {id:'agent-member',kind:'agent',name:'小機器',online:false,departmentFloor:6,floor:7,zone:'focus',status:'working',activity:'舊的回報'}];
test('unconnected seats remain at the shared rest floor without fabricating connectivity or work',()=>{
  for(let time=0;time<2_400_000;time+=5000){
    const person=getOfficeRoster(remote,time).find(p=>p.id==='agent-member');
    assert.equal(person.online,false);assert.equal(person.status,'break');assert.equal(person.zone,'lounge');assert.equal(person.floor,1);
    assert.equal(person.reportedFloor,7);assert.equal(person.reportedActivity,'舊的回報');assert.equal(person.departmentFloor,6);
    assert.ok(!person.activity.includes('舊的回報'));
  }
});
test('randomized encounters are deterministic, reciprocal and include humans and agents across cycles',()=>{
  const seen=new Set();
  for(let cycle=0;cycle<12;cycle++){
    const now=cycle*SOCIAL_CYCLE_MS+160000,base=getOfficeRoster(remote,now);
    const moments=getOfficeSocialMoments(base,now,null);
    assert.deepEqual(moments,getOfficeSocialMoments([...base].reverse(),now,null));
    for(const [id,moment] of moments){
      const route=moment.routine;if(!route.partnerId)continue;
      const other=moments.get(route.partnerId).routine;
      assert.equal(other.partnerId,id);assert.equal(other.meetingId,route.meetingId);assert.equal(other.destinationFloor,route.destinationFloor);
      assert.equal(other.phase,route.phase);assert.equal(other.progress,route.progress);
      if(id==='human-member')seen.add(route.partnerId);
    }
  }
  assert.ok(seen.size>=6,'human avatar meets different colleagues rather than a fixed pair');
});
test('a sampled social itinerary boards the lift, meets the same partner, and returns to its original location',()=>{
  const people=getOfficeRoster(remote,0),moments=getOfficeSocialMoments(people,0,null);
  const initial=moments.get('human-member').routine,plan=initial.itinerary;
  const at=offset=>sampleOfficeRoutine({routine:initial},plan.startedAt+plan.delay+offset);
  assert.equal(at(0).floor,5);assert.equal(at(0).phase,'home-work');
  assert.equal(at(103000).phase,'outbound-lift');assert.equal(at(109000).inElevator,true);
  assert.equal(at(140000).phase,plan.visitKind);assert.equal(at(140000).partnerId,plan.partnerId);
  assert.equal(at(225999).phase,'return-to-work');assert.equal(at(226001).floor,5);
  assert.equal(at(226001).zone,'studio');assert.equal(at(226001).phase,'home-work');
});
test('active activities gather avatars on the first floor and finish with a return trip',()=>{
  let event=getOfficeEvent(0);event=getOfficeEvent(event.startsAt+25000);
  const people=getOfficeRoster(remote,event.startsAt),moments=getOfficeSocialMoments(people,event.startsAt+25000,event);
  const guests=[...moments.values()].filter(m=>m.ambientEvent);
  assert.equal(guests.length,4);
  for(const guest of guests){
    assert.equal(guest.routine.phase,'event');assert.equal(guest.floor,1);
    const route=sampleOfficeRoutine({routine:guest.routine},event.startsAt+143999);
    assert.equal(route.phase,'return-to-work');assert.equal(route.floor,route.homeFloor);
    assert.equal(sampleOfficeRoutine({routine:guest.routine},event.startsAt+144000).phase,'home-work');
  }
});
test('encounters expose scripted invitations without inventing speech or persisting messages for members',()=>{
  let found=false;
  for(let cycle=0;cycle<12;cycle++){
    const roster=getOfficeRoster(remote,cycle*SOCIAL_CYCLE_MS+160000),before=structuredClone(roster),rows=getOfficeEncounters(roster);
    assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
    for(const row of rows){
      assert.equal(row.simulated,true);assert.equal(row.participants.length,2);assert.ok(Date.parse(row.endsAt)>Date.parse(row.startsAt));
      assert.ok(row.participants.every(p=>Object.keys(p).join(',')==='id,name,kind'));
      if(row.speakerId)assert.equal(row.participants.find(p=>p.id===row.speakerId).kind,'character');
      if(row.recipientId==='agent-member')found=true;
    }
    assert.deepEqual(roster,before);
  }
  assert.equal(found,true,'a real approved agent can discover a character greeting and reply through its own tools');
});
test('real shared matches place both participating avatars together without random scripted greetings',()=>{
  const members=remote.map(member=>({...member,online:true}));
  const match={id:'shared-match',type:'duel',status:'playing',participantIds:members.map(m=>m.id),currentRound:2,createdAt:new Date(1000).toISOString(),roundDeadline:900000};
  const roster=getOfficeRoster(members,160000,{activities:{matches:[match]}});
  for(const member of members){
    const person=roster.find(p=>p.id===member.id);assert.equal(person.online,true);assert.equal(person.floor,1);assert.equal(person.routine.phase,'event');
    assert.equal(person.ambientEvent.shared,true);assert.match(person.activity,/共享單挑活動/);
    assert.equal(sampleOfficeRoutine(person,200000).phase,'event');
  }
  assert.equal(getOfficeEncounters(roster).some(row=>row.participants.some(p=>members.some(m=>m.id===p.id))),false);
  const finished=getOfficeRoster(members,160000,{activities:{matches:[{...match,status:'finished'}]}});
  assert.ok(finished.find(p=>p.id===members[0].id).routine.itinerary.liveEvent!==true);
});
