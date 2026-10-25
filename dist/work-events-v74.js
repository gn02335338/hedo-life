import {CAST_IDS_V74} from './cast-v74.js';
const actor=event=>event.speaker||'wing';
const weighted=(rows,weight,draw)=>{let ticket=draw()*rows.reduce((sum,row)=>sum+weight(row),0);return rows.find(row=>(ticket-=weight(row))<0)||rows.at(-1);};
// Keep the v71 occupation cadence, with a modest introduction weight for the
// new colleagues. Speakers are chosen before scenes so adding 31 stories does
// not make one person's airtime 31 times larger.
export function selectWorkEventV74(run,pool,draw,allEvents){
 if(!pool.length)throw Error('No eligible work events');
 const byId=new Map(allEvents.map(event=>[event.id,event])),unique=new Set();
 const recent=(run.history||[]).filter(row=>{
  const key=`${row.turn}:${row.eventId}`;
  if(!['daily','private-social'].includes(row.kind)||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0||!byId.has(row.eventId)||unique.has(key))return false;
  unique.add(key);return true;
 });
 const unplayed=pool.filter(event=>!(run.seen||[]).includes(event.id)),available=unplayed.length?unplayed:pool;
 const exclusive=available.filter(event=>event.roles?.length===1&&event.roles[0]===run.actualRoleId),related=available.filter(event=>event.roles?.length>1&&event.roles.includes(run.actualRoleId)),shared=available.filter(event=>!event.roles);
 const focused=exclusive.filter(event=>event.careerFocusV71===true),lastTwo=recent.filter(row=>row.kind==='daily').slice(-2);
 const forceFocus=focused.length&&(!recent.length||lastTwo.length===2&&lastTwo.every(row=>byId.get(row.eventId).careerFocusV71!==true));
 let selected;
 if(forceFocus)selected=focused;
 else{const ticket=draw();selected=ticket<.60?exclusive:ticket<.76?related:shared;if(!selected.length)selected=exclusive.length?exclusive:related.length?related:shared;if(selected===exclusive&&focused.length&&draw()<.48)selected=focused;}
 const counts=new Map(),speakers=recent.map(row=>actor(byId.get(row.eventId))),groups=new Map();
 for(const id of speakers)counts.set(id,(counts.get(id)||0)+1);
 for(const event of selected){const id=actor(event);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(event);}
 let candidates=[...groups.keys()],different=candidates.filter(id=>id!==speakers.at(-1));if(different.length)candidates=different;
 const fresh=candidates.filter(id=>!counts.has(id));
 if(fresh.length)candidates=fresh;else{const spread=candidates.filter(id=>speakers.slice(-5).filter(other=>other===id).length<2);if(spread.length)candidates=spread;}
 const speaker=weighted(candidates,id=>((CAST_IDS_V74.includes(id)||id==='alice')&&!counts.has(id)?1.7:1)/(1+(counts.get(id)||0)*.8),draw);
 return weighted(groups.get(speaker),event=>event.weight||1,draw).id;
}
