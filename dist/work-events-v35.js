// Keep the actual occupation's work mix, then draw a speaker before a scene.
// A large back catalogue no longer gives one character hundreds of tickets.
const actor=event=>event.speaker||'wing';
const weighted=(items,weight,draw)=>{
 let ticket=draw()*items.reduce((sum,item)=>sum+weight(item),0);
 return items.find(item=>(ticket-=weight(item))<0)||items.at(-1);
};

export function selectWorkEventV35(run,pool,draw,allEvents){
 if(!pool.length)throw new Error('No eligible work events');
 const byId=new Map(allEvents.map(event=>[event.id,event])),keys=new Set();
 const recent=run.history.filter(row=>{
  if(row.kind!=='daily'||!Number.isInteger(row.choiceIndex)||row.choiceIndex<0||!byId.has(row.eventId))return false;
  const key=`${row.turn}:${row.eventId}`;if(keys.has(key))return false;keys.add(key);return true;
 });
 const speakers=recent.map(row=>actor(byId.get(row.eventId)));
 const counts=new Map();let lastNew=-1;
 speakers.forEach((id,index)=>{if(!counts.has(id))lastNew=index;counts.set(id,(counts.get(id)||0)+1);});
 const exclusive=pool.filter(event=>event.roles?.length===1&&event.roles[0]===run.actualRoleId);
 const related=pool.filter(event=>event.roles?.length>1&&event.roles.includes(run.actualRoleId));
 const shared=pool.filter(event=>!event.roles);
 const twoShared=recent.length>=2&&recent.slice(-2).every(row=>!byId.get(row.eventId).roles);
 let selected;
 if(!recent.length&&exclusive.length)selected=exclusive;
 else if(twoShared&&(exclusive.length||related.length))selected=exclusive.length?exclusive:related;
 else{const bucket=draw();selected=bucket<.5?exclusive:bucket<.7?related:shared;}
 if(!selected.length)selected=exclusive.length?exclusive:related.length?related:shared;

 // After two work scenes without meeting a new main speaker, look for one
 // across eligible buckets. The two-shared safeguard still preserves job work.
 const unseen=events=>events.some(event=>!counts.has(actor(event)));
 if(recent.length-1-lastNew>=2&&!twoShared&&!unseen(selected)){
  selected=[exclusive,related,shared].find(unseen)||selected;
 }
 const grouped=new Map();
 for(const event of selected){const id=actor(event);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(event);}
 let candidates=[...grouped.keys()];
 const last=speakers.at(-1),different=candidates.filter(id=>id!==last);
 if(different.length)candidates=different;
 const fresh=candidates.filter(id=>!counts.has(id));
 if(fresh.length)candidates=fresh;
 else{
  const spread=candidates.filter(id=>speakers.slice(-5).filter(speaker=>speaker===id).length<2);
  if(spread.length)candidates=spread;
 }
 const chosen=weighted(candidates,id=>1/(1+(counts.get(id)||0)*.65),draw);
 return weighted(grouped.get(chosen),event=>event.weight||1,draw).id;
}
