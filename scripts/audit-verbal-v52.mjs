import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {EVENTS,FANTASY_EVENTS} from '../dist/events.js';
import {createRun,getEvent} from '../dist/engine.js';
import {verbalSceneLine,VERBAL_SCENE_IDS} from '../dist/verbal-scene-copy.js';
import {strongVerbalLineV39} from '../dist/verbal-lines-v39.js';
import {verbalTargetsV30} from '../dist/verbal-v30.js';
import {displayContextVerbalLineV52} from '../dist/verbal-context-v52.js';
// Audit only public event copy. The JSON comparison stays in ignored artifacts.
const raw=await readFile(new URL('../dist/verbal-lines-v39.js',import.meta.url),'utf8');
const topics=[...raw.slice(raw.indexOf('const topics=['),raw.indexOf('export function strong')).matchAll(/\[\/(.+)\/,\s*'([^']+)'\]/g)].map(x=>({regex:x[1],line:x[2]}));
const all=[],fallbackSources=[],coarse=/幹[，。！？]|他媽|靠北|媽的|狗屁/;
for(const source of [...EVENTS,...FANTASY_EVENTS]){
 const run={...createRun(source.roles?.[0]||'sales','e39-audit'),eventId:source.id,turn:10};
 let event;try{event=getEvent(run)}catch{fallbackSources.push(source.id);event={...source,speaker:source.speaker||'wing',kind:FANTASY_EVENTS.includes(source)?'fantasy':'daily'};}
 for(const target of verbalTargetsV30(event))for(const phase of ['event','result']){
  const base=verbalSceneLine({event,target,run,phase}),strong=strongVerbalLineV39({event,target,run,phase,base});
  const displayed=displayContextVerbalLineV52(strong,{event,target,run,phase});
  const topic=topics.find(x=>strong.endsWith(x.line));
  all.push({id:event.id,title:event.title,speaker:event.speaker,target,phase,roles:source.roles||null,authoredId:VERBAL_SCENE_IDS.includes(source.id),category:topic?'topic-replacement':strong===base?'preserved':coarse.test(base)?'authored-strong-replacement':'amplified',topic:topic?.regex||null,base,strong,displayed,changed:displayed!==strong,body:event.body,wing:event.wing});
 }
}
const unique=xs=>new Set(xs.map(x=>x.id)).size;
const summary={fallbackSources,changedLines:all.filter(x=>x.changed).length,events:unique(all),lines:all.length,authoredIDs:VERBAL_SCENE_IDS.length,authoredMatchedEvents:unique(all.filter(x=>x.authoredId)),topicReplacementEvents:unique(all.filter(x=>x.category==='topic-replacement')),topicReplacementLines:all.filter(x=>x.category==='topic-replacement').length,authoredLostToTopicEvents:unique(all.filter(x=>x.category==='topic-replacement'&&x.authoredId)),selfTopicReplacementEvents:unique(all.filter(x=>x.category==='topic-replacement'&&x.target==='self')),categories:Object.fromEntries([...new Set(all.map(x=>x.category))].map(k=>[k,{events:unique(all.filter(x=>x.category===k)),lines:all.filter(x=>x.category===k).length}]))};
await mkdir(new URL('../artifacts/',import.meta.url),{recursive:true});
await writeFile(new URL('../artifacts/verbal-audit-v52.json',import.meta.url),JSON.stringify({summary,topics,all},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
console.log('Full public-copy comparison: artifacts/verbal-audit-v52.json');
