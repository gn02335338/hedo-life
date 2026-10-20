// Public names are a presentation concern. Replay IDs, saved history and proof
// inputs keep their original values so older lives remain verifiable.
export { displayChronicleEvent, displayChronicleHistory } from './chronicle-scene-copy.js';
export const PERSONAS = Object.freeze(Object.fromEntries([
 ['wing','翅膀','執行長'],
 ['spencer','屎潘蛇','董事長'],
 ['erich','法師','法務長'],
 ['sonny','阿福','MIS','史冊裡也叫桑尼。工單、點名和腕力賽，各有一套尚待補充的說法。'],
 ['jenjen','Moon Dog','行政長'],
 ['rick','老闆乾兒子','技術資深經理'],
 ['kind','阿良','技術經理'],
 ['hope','希望','HR長'],
 ['jack','傑克','研發部經理'],
 ['meimei','水蛇','業務經理'],
 ['helen','前女友','產品開發總監','海倫的辦公室綽號。離場後仍在延長的交接與特權，被同事比喻成一段分不乾淨的關係；不代表實際交往紀錄。'],
].map(([id,name,title,about])=>[id,Object.freeze({name,title,image:`./assets/${id}.png`,portrait:!['wing','spencer'].includes(id),...(about?{about}:{})})])));

const names = Object.freeze({
 Wing:'翅膀',WING:'翅膀',Spencer:'屎潘蛇',SPENCER:'屎潘蛇',
 Erich:'法師',ERICH:'法師',Sonny:'阿福',SONNY:'阿福',
 JenJen:'Moon Dog',JENJEN:'Moon Dog',Rick:'老闆乾兒子',RICK:'老闆乾兒子',
 Kind:'阿良',KIND:'阿良',Hope:'希望',HOPE:'希望',Jack:'傑克',JACK:'傑克',
 Meimei:'水蛇',MeiMei:'水蛇',MEIMEI:'水蛇',
 Helen:'前女友',HELEN:'前女友',
});
const namePattern = new RegExp(`(?<![A-Za-z0-9_])(?:${Object.keys(names).join('|')})(?![A-Za-z0-9_])`,'g');

export function displayName(id){return Object.hasOwn(PERSONAS,id)?PERSONAS[id].name:id;}

function renameCopy(value){
 return value
  .replaceAll('阿良（Kind）','阿良').replaceAll('阿良 (Kind)','阿良')
  .replace(/(?:Rick|RICK)[（(](?:老闆)?乾兒子[）)]/g,'老闆乾兒子')
  .replace(/(?:Jack|JACK)[（(]傑克[）)]/g,'傑克')
  .replaceAll('美美','水蛇')
  .replace(/林澤教授|林澤/g,'顧問教授')
  .replace(namePattern,name=>names[name])
  .replaceAll('空降事業部經理','事業部經理')
  .replaceAll('空降主管','高階主管')
  .replaceAll('禾多','移動');
}

// Skip URLs and asset paths even when they appear inside a text paragraph.
// Only exact character names change: “kind”, “hopeful”, “Wingman” and internal
// identifiers such as “rage_wing” are not names to rewrite.
export function displayText(value=''){
 return String(value).split(/((?:https?:\/\/|\.{1,2}\/)[^\s<>"'，。；）]+)/u)
  .map(part=>/^(?:https?:\/\/|\.{1,2}\/)/u.test(part)?part:renameCopy(part)).join('');
}

function copyFields(value,keys){
 const next={...value};
 for(const key of keys)if(typeof value[key]==='string')next[key]=displayText(value[key]);
 return next;
}

function copyChoice(choice){
 const next=copyFields(choice,['text','detail','result']);
 if(choice.check){
  next.check={...choice.check};
  for(const key of ['success','failure'])if(choice.check[key])next.check[key]=copyFields(choice.check[key],['result']);
 }
 if(choice.draw){
  next.draw=copyFields(choice.draw,['label']);
  if(Array.isArray(choice.draw.outcomes))next.draw.outcomes=choice.draw.outcomes.map(outcome=>copyFields(outcome,['label','result']));
 }
 return next;
}

// The caller selects the content cohort. Only authored prose is transformed:
// target IDs, flags, effects, draw weights and every other mechanic stay intact.
export function applyPersonaCopy(event){
 if(!event||typeof event!=='object')return event;
 const next=copyFields(event,['title','body','wing']);
 if(Array.isArray(event.choices))next.choices=event.choices.map(copyChoice);
 return next;
}
