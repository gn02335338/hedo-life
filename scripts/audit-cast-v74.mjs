import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EVENTS} from '../dist/events.js';
import {PERSONAS,displayName} from '../dist/persona.js';
import {CAST_IDS_V74} from '../dist/cast-v74.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';
import {HIDDEN_STORIES_V66} from '../dist/hidden-stories-v66.js';

const seed='e39-r74-n-'+'0'.repeat(22);
const eligible=event=>{
 if((event.minRules??0)>39||!event.choices||event.choices.length<3)return false;
 for(let turn=0;turn<20;turn++){
  if((event.minTurn??0)>turn||(event.maxTurn??99)<turn)continue;
  const run={seed,turn,flags:{activity46_enabled:1,activity44_banquet:1}};
  if(calendarDailyAllowedV46(run,event)&&officeTreatDailyAllowedV61(run,event))return true;
 }
 return false;
};

export function auditCastV74(){
 const unique=new Map(EVENTS.map(event=>[event.id,event]));
 if(unique.size!==EVENTS.length)throw Error('Duplicate authored event ID');
 const playable=[...unique.values()].filter(eligible);
 const characters=Object.keys(PERSONAS).map(id=>{
  const scenes=playable.filter(event=>event.speaker===id),added=scenes.filter(event=>event.requiresCastV74);
  return {id,name:displayName(id),existing:scenes.length-added.length,added:added.length,total:scenes.length,eventIds:scenes.map(event=>event.id)};
 });
 return {profile:'e39-r74-[nsd]',method:'Count distinct authored source-event IDs with an explicit main speaker, at least three choices and a legal calendar window. One story counts once; answers, meal reactions, repeated plays, conflict aftermath and illustrations add no extra stories. Roles, rank, resources and PIP may narrow availability. This is a content inventory, not an appearance guarantee or a natural-replay proof of every event. The private hidden-character count reveals no identity or story text.',publicCharacters:characters.length,hiddenCharacters:1,minimumPublicStories:Math.min(...characters.map(row=>row.total)),addedDaily:playable.filter(event=>event.requiresCastV74).length,newCharacters:CAST_IDS_V74,characters,hidden:{id:'company-mystery',name:'公司神秘人物',total:8+HIDDEN_STORIES_V66.length}};
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const report=auditCastV74();
 if(report.publicCharacters!==34||report.characters.some(row=>row.total<31)||report.hidden.total<31)throw Error('Incomplete current character coverage');
 if(process.argv.includes('--write'))writeFileSync(new URL('../research/cast-event-counts-v74.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.table(report.characters.map(({name,existing,added,total})=>({name,existing,added,total})));
 console.log(JSON.stringify({publicCharacters:report.publicCharacters,minimumPublicStories:report.minimumPublicStories,addedDaily:report.addedDaily,hiddenStories:report.hidden.total}));
}
