// New-cohort scheduling: actual-job work remains frequent, with a bounded
// cadence for the substantial new dilemmas and room for different colleagues.
const actor=event=>event.speaker||'wing';
const weighted=(rows,weight,draw)=>{
 let ticket=draw()*rows.reduce((sum,row)=>sum+weight(row),0);
 return rows.find(row=>(ticket-=weight(row))<0)||rows.at(-1);
};
export function selectWorkEventV71(run,pool,draw,allEvents){
 if(!pool.length)throw Error('No eligible work events');
 const byId=new Map(allEvents.map(event=>[event.id,event])),unique=new Set();
 const recent=(run.history||[]).filter(row=>{
  const key=`${row.turn}:${row.eventId}`;
  if(row.kind!=='daily'||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0||!byId.has(row.eventId)||unique.has(key))return false;
  unique.add(key);return true;
 });
 const unplayed=pool.filter(event=>!(run.seen||[]).includes(event.id));
 const available=unplayed.length?unplayed:pool;
 const exclusive=available.filter(event=>event.roles?.length===1&&event.roles[0]===run.actualRoleId);
 const related=available.filter(event=>event.roles?.length>1&&event.roles.includes(run.actualRoleId));
 const shared=available.filter(event=>!event.roles);
 const focused=exclusive.filter(event=>event.careerFocusV71===true);
 const lastTwo=recent.slice(-2),forceFocus=focused.length&&(!recent.length||lastTwo.length===2&&lastTwo.every(row=>byId.get(row.eventId).careerFocusV71!==true));
 let selected;
 if(forceFocus)selected=focused;
 else{
  const ticket=draw();selected=ticket<.60?exclusive:ticket<.76?related:shared;
  if(!selected.length)selected=exclusive.length?exclusive:related.length?related:shared;
  if(selected===exclusive&&focused.length&&draw()<.48)selected=focused;
 }
 const counts=new Map(),speakers=recent.map(row=>actor(byId.get(row.eventId)));
 for(const id of speakers)counts.set(id,(counts.get(id)||0)+1);
 const groups=new Map();
 for(const event of selected){const id=actor(event);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(event);}
 let candidates=[...groups.keys()],different=candidates.filter(id=>id!==speakers.at(-1));
 if(different.length)candidates=different;
 const fresh=candidates.filter(id=>!counts.has(id));
 if(fresh.length)candidates=fresh;
 else{
  const spread=candidates.filter(id=>speakers.slice(-5).filter(other=>other===id).length<2);
  if(spread.length)candidates=spread;
 }
 // A modest, still-random introduction inside shared slots helps players
 // discover the new colleague without replacing occupation-exclusive work.
 const speaker=weighted(candidates,id=>(id==='alice'&&!counts.has(id)?2:1)/(1+(counts.get(id)||0)*.8),draw);
 return weighted(groups.get(speaker),event=>event.weight||1,draw).id;
}
