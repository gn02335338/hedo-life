import {readFileSync,writeFileSync} from 'node:fs';
import {EVENTS} from '../dist/events.js';
import {ACHIEVEMENT_STORIES_V66 as published} from '../dist/achievement-stories-v66.js';
import {displayPersona,displayText} from '../dist/persona.js';
import {displayOccupationTextV47} from '../dist/occupation-copy-v47.js';
import {calendarDailyAllowedV46} from '../dist/activity-schedule-v46.js';
import {officeTreatDailyAllowedV61} from '../dist/office-treats-v61.js';

// Preserve published identities rather than selecting the current first four
// scenes again. These six not-yet-released IDs replace short party scenes that
// the live calendar permanently delegates to its interactive annual banquet.
const overrides=Object.freeze({'tale-meimei-a':'cast66-meimei-first-love-rematch','tale-meimei-b':'cast66-meimei-duet-file'});
const probe={seed:'e39-r66-n-'+'0'.repeat(22),turn:19,flags:{activity46_enabled:1,activity44_banquet:1}};
const byId=new Map(EVENTS.map(event=>[event.id,event]));
const text=s=>displayOccupationTextV47(displayText(String(s||''))).replace(/\s+/g,' ').trim();
const cut=(s,n)=>Array.from(text(s)).slice(0,n).join('');
const recipe=e=>/電話|來電/.test(e.title+e.body)?'phone':/餐|飯|咖啡|杯|飲料/.test(e.title+e.body)?'cup':/學歷|學校|讀書|教授|培訓/.test(e.title+e.body)?'book':/薪|預算|帳|報價|成本/.test(e.title+e.body)?'wallet':/會議|提案|簡報/.test(e.title+e.body)?'board':/設計|稿|畫|按鈕/.test(e.title+e.body)?'palette':/工程|系統|程式|資料|測試/.test(e.title+e.body)?'laptop':/下班|休假|行程|排程|工時/.test(e.title+e.body)?'calendar':'folder';
const stories=published.map(spec=>{
 const prefix=spec.id.replace(/-(?:first|second|third)$/,''),eventId=overrides[prefix];if(!eventId)return {...spec};
 const event=byId.get(eventId),choice=event?.choices[spec.choiceIndex];if(!event||event.speaker!=='meimei'||!choice||!choice.result||choice.draw||choice.check)throw Error(`Invalid replacement scene ${eventId}`);
 const title=`${cut(choice.text.replace(/[。！？!?]$/,''),15)}${Array.from(text(choice.text)).length>15?'…':''}`,outcome=text(choice.result).split(/(?<=[。！？])/).filter(Boolean).slice(0,2).join('');
 return {...spec,eventId,title:`${displayPersona('meimei').name}｜${title}`,description:`在「${text(event.title)}」這一幕，明確選擇「${text(choice.text).replace(/[。]$/,'')}」。${cut(outcome,95)}`,art:recipe(event)};
});
if(stories.length!==492||new Set(stories.map(spec=>spec.id)).size!==492||new Set(stories.map(spec=>`${spec.eventId}/${spec.choiceIndex}`)).size!==492)throw Error('Unexpected story identities');
for(const spec of stories){const event=byId.get(spec.eventId);if(!event||!calendarDailyAllowedV46(probe,event)||!officeTreatDailyAllowedV61(probe,event))throw Error(`Story has no live calendar window: ${spec.id}/${spec.eventId}`);}
const output='// Published source-choice pairs. Generated once from authored game scenes.\nexport const ACHIEVEMENT_STORIES_V66=Object.freeze('+JSON.stringify(stories,null,1)+'.map(Object.freeze));\n',target=new URL('../dist/achievement-stories-v66.js',import.meta.url);
if(process.argv.includes('--check')){if(readFileSync(target,'utf8')!==output)throw Error('Authored achievement catalog needs regeneration');}else writeFileSync(target,output);
console.log(JSON.stringify({character:stories.filter(r=>r.kind==='character').length,profession:stories.filter(r=>r.kind==='profession').length,events:new Set(stories.map(r=>r.eventId)).size,replacements:6}));
