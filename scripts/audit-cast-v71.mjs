import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EVENTS} from '../dist/events.js';
import {PERSONAS,displayName} from '../dist/persona.js';
import {CAREER_EVENTS_V71} from '../dist/events-career-v71.js';
import {ALICE_EVENTS_V71} from '../dist/events-alice-v71.js';
import {HIDDEN_STORIES_V66} from '../dist/hidden-stories-v66.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';
import {isCareerContentV71} from '../dist/career-content-v71.js';

const seed='e39-r71-n-'+'0'.repeat(22);
// A scene counts once if its time window overlaps ordinary work and the
// current calendar/treat rules do not permanently replace it. A completed
// banquet is a legal late-game state, not an extra story or a second copy.
const eligible=event=>{
 if((event.minRules??0)>39||event.requiresCareerV71&&!isCareerContentV71(seed))return false;
 for(let turn=0;turn<20;turn++){
  if((event.minTurn??0)>turn||(event.maxTurn??99)<turn)continue;
  const probe={seed,turn,flags:{activity46_enabled:1,activity44_banquet:1}};
  if(calendarDailyAllowedV46(probe,event)&&officeTreatDailyAllowedV61(probe,event))return true;
 }
 return false;
};

export function auditCastV71(){
 const authored=EVENTS.filter(event=>!event.requiresRelationshipV72),unique=new Map(authored.map(event=>[event.id,event]));
 if(unique.size!==authored.length)throw Error('Duplicate authored event ID');
 const playable=[...unique.values()].filter(event=>event.choices?.length>=3&&eligible(event));
 const characters=Object.keys(PERSONAS).map(id=>{
  const scenes=playable.filter(event=>event.speaker===id),added=scenes.filter(event=>event.requiresCareerV71),existing=scenes.filter(event=>!event.requiresCareerV71);
  return {id,name:displayName(id),existing:existing.length,added:added.length,total:scenes.length,eventIds:scenes.map(event=>event.id)};
 });
 const roles=[...new Set(CAREER_EVENTS_V71.flatMap(event=>event.roles))].sort();
 const occupations=roles.map(id=>({id,added:CAREER_EVENTS_V71.filter(event=>event.roles.includes(id)&&eligible(event)).length,eventIds:CAREER_EVENTS_V71.filter(event=>event.roles.includes(id)&&eligible(event)).map(event=>event.id)}));
 const hidden={id:'company-mystery',name:'公司神秘人物',existing:8,added:HIDDEN_STORIES_V66.length,total:8+HIDDEN_STORIES_V66.length,eventIds:[...Array.from({length:8},(_,index)=>`hidden45-${index}-0`),...HIDDEN_STORIES_V66.map((_,index)=>`hidden45-${index+8}-0`)]};
 return {
  profile:'e39-r71-[nsd]',
  method:'Count distinct authored source-event IDs, with an explicit main speaker and at least three choices, whose time windows overlap ordinary work and which are not permanently replaced by the active calendar or office-treat rules. A source counts once regardless of answers, meal reactions, repeated plays or aftermath stages. Roles, rank and lawful PIP conditions may narrow when a scene can appear; this is a content inventory, not a statistical appearance guarantee or a per-event natural-replay proof. Hidden stories count base IDs only and disclose no private identity or text.',
  publicCharacters:characters.length,hiddenCharacters:1,minimumPublicStories:Math.min(...characters.map(row=>row.total)),
  addedDaily:CAREER_EVENTS_V71.length+ALICE_EVENTS_V71.length,addedCareerDaily:CAREER_EVENTS_V71.length,addedAliceDaily:ALICE_EVENTS_V71.length,
  occupations,characters,hidden
 };
}

if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const report=auditCastV71();
 if(report.publicCharacters!==29||report.characters.some(row=>row.total<31)||report.hidden.total<31)throw Error('A current character has fewer than 31 independent stories');
 if(report.addedDaily!==93||report.occupations.length!==10||report.occupations.some(row=>row.added!==6))throw Error('Incomplete current job expansion');
 if(process.argv.includes('--write'))writeFileSync(new URL('../research/cast-event-counts-v71.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.table(report.characters.map(({name,existing,added,total})=>({name,existing,added,total})));
 console.table(report.occupations.map(({id,added})=>({occupation:id,added})));
 console.log(JSON.stringify({publicCharacters:report.publicCharacters,hiddenCharacters:report.hiddenCharacters,minimumPublicStories:report.minimumPublicStories,addedDaily:report.addedDaily,addedCareerDaily:report.addedCareerDaily,addedAliceDaily:report.addedAliceDaily,hiddenStories:report.hidden.total}));
}
