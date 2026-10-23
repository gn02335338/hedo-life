import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {EVENTS} from '../dist/events.js';
import {PERSONAS,publishedDisplayText} from '../dist/persona.js';
import {HIDDEN_STORIES_V66} from '../dist/hidden-stories-v66.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';
const currentCalendarEligible=event=>{
 const probe={seed:'e39-r66-n-'+'0'.repeat(22),turn:19,flags:{activity46_enabled:1,activity44_banquet:1}};
 return calendarDailyAllowedV46(probe,event)&&officeTreatDailyAllowedV61(probe,event);
};
export function auditCastV66(){
 const unique=new Map(EVENTS.map(event=>[event.id,event]));
 if(unique.size!==EVENTS.length)throw Error('Duplicate authored event ID');
 const characters=Object.entries(PERSONAS).map(([id,persona])=>{
  const authored=[...unique.values()].filter(event=>event.speaker===id&&event.choices?.length>=3);
  const previous=authored.filter(event=>!event.requiresCastV66&&currentCalendarEligible(event)),added=authored.filter(event=>event.requiresCastV66&&currentCalendarEligible(event)),excludedLegacy=authored.filter(event=>!event.requiresCastV66&&!currentCalendarEligible(event)).map(event=>event.id);
  return {id,name:id==='professor'?'林老師':publishedDisplayText(persona.name),before:previous.length,added:added.length,after:previous.length+added.length,beforeIds:previous.map(event=>event.id),addedIds:added.map(event=>event.id),excludedLegacy};
 });
 const hidden={id:'company-mystery',name:'公司神秘人物',before:8,added:HIDDEN_STORIES_V66.length,after:8+HIDDEN_STORIES_V66.length,beforeIds:Array.from({length:8},(_,index)=>`hidden45-${index}-0`),addedIds:HIDDEN_STORIES_V66.map((_,index)=>`hidden45-${index+8}-0`)};
 return {method:'Count distinct authored event IDs with an explicit main speaker and at least three choices, excluding old short scenes permanently replaced by the current calendar or office-treat rules. One ID counts once; answers, meal branches, reaction variants, repeated plays and aftermath stages never add to the count. Conditional post-banquet scenes may count because they retain a legal calendar window. Hidden encounters count distinct base stories only; their follow-up stage does not count again.',profiles:{before:'r65 with active calendar',after:'r66 with active calendar'},publicCharacters:characters.length,hiddenCharacters:1,addedDaily:characters.reduce((sum,row)=>sum+row.added,0),addedHidden:hidden.added,characters:[...characters,hidden]};
}
if(import.meta.url===pathToFileURL(process.argv[1]||'').href){
 const report=auditCastV66();
 if(report.characters.some(row=>row.after<31))throw Error('A character has fewer than 31 authored stories');
 if(process.argv.includes('--write'))writeFileSync(new URL('../research/cast-event-counts-v66.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.table(report.characters.map(({name,before,added,after})=>({name,before,added,after})));
 console.log(JSON.stringify({publicCharacters:report.publicCharacters,hiddenCharacters:1,addedDaily:report.addedDaily,addedHidden:report.addedHidden}));
}
