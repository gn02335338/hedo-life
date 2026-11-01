import { getCharacterRoutine, OFFICE_ELEVATOR } from './routine.js';

// Shared visual itineraries. These never execute an agent or publish speech.
export const SOCIAL_CYCLE_MS = 300_000;
const phases = [['home-work',85_000],['to-elevator',18_000],['outbound-lift',12_000],['to-visit',18_000],['chat',45_000],['return-to-elevator',18_000],['return-lift',12_000],['return-to-work',18_000]];
const eventPhases = [['to-elevator',8_000],['outbound-lift',8_000],['to-visit',8_000],['event',96_000],['return-to-elevator',8_000],['return-lift',8_000],['return-to-work',8_000]];
export function officeHash(value) {
  let n=2166136261; for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);} return n>>>0;
}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export function sampleOfficeRoutine(data, nowMs=Date.now()) {
  const previous=data?.routine, plan=previous?.itinerary;
  const now=Number.isFinite(nowMs)?nowMs:0;
  if(!plan)return data?.kind==='character'?getCharacterRoutine(data.id,now,{homeZone:previous?.homeZone}):null;
  if(plan.liveEvent){
    return {...plan,itinerary:plan,phase:'event',sampledAt:now,phaseStartedAt:plan.startedAt,phaseEndsAt:plan.endsAt,
      progress:0,fromFloor:1,toFloor:1,elevation:1,floor:1,inElevator:false,travelProgress:0,zone:'lounge',visitKind:'event',liftLane:0};
  }
  const rows=plan.event?eventPhases:phases;
  const elapsed=now-plan.startedAt-plan.delay;
  let start=0, phase='home-work', duration=85_000, progress=0, phaseStartedAt=plan.startedAt+plan.delay;
  for(const [name,length] of rows){if(elapsed>=start&&elapsed<start+length){phase=name;duration=length;progress=(elapsed-start)/length;phaseStartedAt+=start;break;}start+=length;}
  if(elapsed<0||elapsed>=rows.reduce((sum,row)=>sum+row[1],0)){phase='home-work';progress=0;phaseStartedAt=now;duration=1000;}
  if(phase==='chat'&&plan.visitKind==='meeting')phase='meeting';
  const inElevator=['outbound-lift','return-lift'].includes(phase);
  let fromFloor=plan.homeFloor,toFloor=plan.homeFloor;
  if(phase==='outbound-lift')toFloor=plan.destinationFloor;
  else if(phase==='return-lift'){fromFloor=plan.destinationFloor;toFloor=plan.homeFloor;}
  else if(['to-visit','meeting','chat','event','return-to-elevator'].includes(phase))fromFloor=toFloor=plan.destinationFloor;
  const travelProgress=clamp((progress-.15)/.7,0,1),elevation=inElevator?fromFloor+(toFloor-fromFloor)*travelProgress:fromFloor;
  return {...plan, itinerary:plan,phase,sampledAt:now,phaseStartedAt,phaseEndsAt:phaseStartedAt+duration,progress,
    fromFloor,toFloor,elevation,floor:clamp(Math.round(elevation),1,7),inElevator,travelProgress,
    zone:['home-work','return-to-work'].includes(phase)?plan.homeZone:['to-visit','meeting','chat','event'].includes(phase)?plan.visitZone:'studio',
    visitKind:plan.event?'event':plan.visitKind||'chat',liftLane:(plan.pairIndex*2+plan.side)%OFFICE_ELEVATOR.lanes};
}

export function getOfficeSocialMoments(people, nowMs=Date.now(), event=null) {
  const now=Number.isFinite(nowMs)?nowMs:0,cycle=Math.floor(now/SOCIAL_CYCLE_MS),startedAt=cycle*SOCIAL_CYCLE_MS;
  const sorted=[...people].sort((a,b)=>officeHash(`${cycle}:${a.id}`)-officeHash(`${cycle}:${b.id}`)||a.id.localeCompare(b.id));
  const moments=new Map();
  const eventActive=event&&event.phase!=='upcoming'&&now>=event.startsAt&&now<event.startsAt+144_000;
  const eventGuests=eventActive?[...people].sort((a,b)=>officeHash(`${event.id}:${a.id}`)-officeHash(`${event.id}:${b.id}`)).slice(0,4):[];
  const eventIds=new Set(eventGuests.map(p=>p.id));
  const regular=sorted.filter(p=>!eventIds.has(p.id));
  function pair(a,b,index,eventPair=false){
    for(const [side,person,partner] of [[0,a,b],[1,b,a]]){
      if(!person)continue;
      const resting=person.kind!=='character'&&!person.online;
      const otherResting=partner?.kind!=='character'&&!partner?.online;
      const homeFloor=resting?1:person.kind==='character'?person.departmentFloor:person.reportedFloor;
      const destinationFloor=eventPair||resting||otherResting?1:1+officeHash(`floor:${cycle}:${index}`)%7;
      const homeZone=resting?'lounge':person.kind==='character'?person.homeZone:person.reportedZone;
      const visitKind=!eventPair&&!resting&&!otherResting&&(cycle+index)%3===0?'meeting':'chat';
      const plan={cycle,pairIndex:index,side,partnerId:partner?.id||null,homeFloor,destinationFloor,homeZone,visitKind,visitZone:visitKind==='meeting'?'meeting':'lounge',resting,
        meetingId:eventPair?`${event.id}:${index}`:`social-${cycle}-${index}`,startedAt:eventPair?event.startsAt:startedAt,delay:eventPair?0:(index%8)*7_000,event:eventPair?event.type:null};
      const routine=sampleOfficeRoutine({routine:{itinerary:plan}},now);
      const partnerName=partner?.name||'路過的同事',target=`${routine.destinationFloor}F`;
      const activities={
        'home-work':resting?['在茶水區泡一杯茶','在休息區看看窗外','在交誼區伸個懶腰'][officeHash(person.id)%3]:person.reportedActivity||person.activity,
        'to-elevator':`角色散步：準備到${target}找${partnerName}`,
        'outbound-lift':`角色搭電梯前往${target}`,
        'to-visit':`走向${target}的${partnerName}`,
        chat:`角色正和${partnerName}在${target}聊聊`,
        meeting:`角色正和${partnerName}在${target}開會`,
        event:`角色參加${event?.title||'辦公室活動'}`,
        'return-to-elevator':resting?'回茶水區繼續休息':'聊完了，走向回程電梯',
        'return-lift':`角色搭電梯回${homeFloor}F`,
        'return-to-work':resting?'走回休息區坐坐':`回到${homeFloor}F的座位`,
      };
      moments.set(person.id,{routine,floor:routine.floor,zone:resting?'lounge':routine.zone,
        status:resting||routine.phase==='chat'?'break':person.status,resting,activity:activities[routine.phase]||'在辦公室散步',
        ambientEvent:eventPair?{id:event.id,type:event.type,title:event.title}:null,
        ambientChat:routine.phase==='chat'&&partner?{partnerId:partner.id,text:`${person.name}與${partnerName}在${target}相遇，聊聊今天的辦公室日常。`}:null});
    }
  }
  for(let i=0;i<regular.length;i+=2)pair(regular[i],regular[i+1],i/2);
  for(let i=0;i<eventGuests.length;i+=2)pair(eventGuests[i],eventGuests[i+1],50+i/2,true);
  return moments;
}

const GREETINGS=['剛好遇到你！今天在忙什麼，有沒有想交換的點子？','先喝口水吧。你最近完成了什麼有趣的事？','在這層碰到你真巧。想聊聊最近的工作，還是下午茶？','離開螢幕走走，也來聽聽你今天的新發現。'];
export function getOfficeEncounters(roster=[]) {
  const byId=new Map(roster.map(person=>[person.id,person])),seen=new Set(),encounters=[];
  for(const person of roster){
    const route=person.routine,other=byId.get(route?.partnerId);
    if(route?.phase!=='chat'||!other||seen.has(route.meetingId))continue;
    seen.add(route.meetingId);
    const pair=[person,other].sort((a,b)=>a.id.localeCompare(b.id));
    const speaker=pair.find(p=>p.kind==='character')||null;
    const recipient=speaker?pair.find(p=>p.id!==speaker.id):null;
    encounters.push({id:route.meetingId,simulated:true,floor:route.destinationFloor,
      participants:pair.map(p=>({id:p.id,name:p.name,kind:p.kind})),speakerId:speaker?.id||null,recipientId:recipient?.id||null,
      prompt:speaker?GREETINGS[officeHash(route.meetingId)%GREETINGS.length]:`${pair[0].name}與${pair[1].name}的角色在交誼區打招呼，可以留一句話接著聊。`,
      startsAt:new Date(route.phaseStartedAt).toISOString(),endsAt:new Date(route.phaseEndsAt).toISOString()});
  }
  return encounters;
}
