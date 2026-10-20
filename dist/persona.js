// Public names are a presentation concern. Replay IDs, saved history and proof
// inputs keep their original values so older lives remain verifiable.
export { displayChronicleEvent, displayChronicleHistory } from './chronicle-scene-copy.js';
export const PERSONAS = Object.freeze(Object.fromEntries([
 ['wing','翅膀','執行長'],
 ['spencer','屎潘蛇','董事長'],
 ['erich','法師','法務長'],
 ['sonny','阿福','MIS','史冊裡也叫桑尼。工單、點名和腕力賽，各有一套尚待補充的說法。'],
 ['jenjen','真真','行政長'],
 ['rick','老闆乾兒子','技術資深經理'],
 ['kind','阿良','技術經理'],
 ['hope','希望','HR長'],
 ['jack','傑克','研發部經理'],
 ['meimei','水蛇','業務經理'],
 ['helen','前女友','產品開發總監','海倫的辦公室綽號。離場後仍在延長的交接與特權，被同事比喻成一段分不乾淨的關係；不代表實際交往紀錄。'],
 ['sophie','紅茶','稽核主管','自稱紅茶，理由是「我又不是綠茶」。同事把她和阿福戲稱為夫妻；究竟是真是假，辦公室沒人能確認。稽核有紀錄，茶水間的傳聞沒有。'],
 ['jonathan','強哥','助理工程師','台大資工畢業，職稱是助理工程師。工程排程、測試工時一有爭議，他就把職稱拿出來：「這是助理工程師能決定的嗎？」'],
 ['owen','歐文','商務開發總監','墨鏡、金項鏈，開特斯拉。談完合作還能約跑；離職倒數講了幾回，下一場會議又看見他。'],
 ['sam','山姆','資深資料探勘工程師','成大學士加碩士，傑克的前主管。光頭醒目，對學歷很有自信，對同事卻沒多少耐性。Netflix 和午睡，輪流占據他的工作時段。'],
 ['cindy','辛蒂','資深專案管理師','翅膀曾經喜愛，後來又看不順眼。主管一任換一任，同事總把離場名單跟她連在一起；究竟誰趕走誰，會議紀錄沒有答案。'],
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
const displayNames = Object.freeze({Sophie:'紅茶',SOPHIE:'紅茶',Jonathan:'強哥',JONATHAN:'強哥',Owen:'歐文',OWEN:'歐文',Sam:'山姆',SAM:'山姆',Cindy:'辛蒂',CINDY:'辛蒂'});
const displayNamePattern = new RegExp(`(?<![A-Za-z0-9_])(?:${Object.keys(displayNames).join('|')})(?![A-Za-z0-9_])`,'g');

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

// Keep the published names in engine-authored prose. New display aliases must
// not rewrite existing replay histories or queued server proofs.
function proseText(value,transform){
 return String(value).split(/((?:https?:\/\/|\.{1,2}\/)[^\s<>"'，。；）]+)/u)
  .map(part=>/^(?:https?:\/\/|\.{1,2}\/)/u.test(part)?part:transform(part)).join('');
}
export function replayText(value=''){return proseText(value,renameCopy);}

// Skip URLs, asset paths and identifiers while rendering both saved aliases
// and original names with the current public name.
export function displayText(value=''){
 return proseText(value,part=>renameCopy(part).replace(/(?<![A-Za-z0-9_])Moon\s+Dog(?![A-Za-z0-9_])/g,'真真').replace(displayNamePattern,name=>displayNames[name]).replaceAll('蘇菲','紅茶').replaceAll('顧問教授','林澤教授').replaceAll('遊戲月薪','月薪'));
}

function copyFields(value,keys){
 const next={...value};
 for(const key of keys)if(typeof value[key]==='string')next[key]=replayText(value[key]);
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
