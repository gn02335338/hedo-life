// Public names are a presentation concern. Replay IDs, saved history and proof
// inputs keep their original values so older lives remain verifiable.
import {CAST_PROFILES_V39} from './cast-v39.js';
export { displayChronicleEvent, displayChronicleHistory } from './chronicle-scene-copy.js';
// Short introductions belong to the character book, not the replay narrative.
// Keep schools, personal relationships and workplace rumors out of these cards.
const CHARACTER_BIOS=Object.freeze({
 wing:'執行長，關注公司方向與團隊表現。從工作分配到人事決策，都可能在對話中遇見他。',
 spencer:'董事長，參與公司的經營討論。談到發展方向或重要場合時，常有他的身影。',
 erich:'法務長，處理合約、文件與相關程序。遇到條件需要核對時，可以聽聽他的說明。',
 sonny:'負責資訊設備與日常支援，也叫桑尼。工作之外，偶爾會在同事活動中遇見他。',
 jenjen:'行政長，負責行政安排與內部協調。辦公室裡許多需要確認的流程，都會經過她。',
 rick:'以「老闆乾兒子」身分出現的同事。常在主管交辦、訊息轉達與團隊活動中登場。',
 kind:'技術經理，參與技術工作，也喜歡邀同事安排下班行程。要不要赴約，由你決定。',
 hope:'人資主管，負責招募、考核與人事流程。談話常圍繞任職條件與工作紀錄。',
 jack:'研發部經理，參與開發、會議與交接。下班後也會約同事打球，換個地方聊聊。',
 meimei:'業務經理，負責客戶與業務協調。提案、活動和跨部門合作中，都可能與她共事。',
 helen:'產品開發總監，辦公室別稱「前女友」。故事圍繞產品規劃、工作分工與交接。',
 sophie:'稽核主管，自稱紅茶。工作重視紀錄與核對，常與不同部門確認流程和資料。',
 jonathan:'頂大資訊相關科系畢業的助理工程師。討論排程與測試時，很在意職責和決定權。',
 owen:'商務開發總監，墨鏡與豪車是他的鮮明印象。工作上經常討論合作方向與對外安排。',
 sam:'具有理工學士與碩士背景的資深資料探勘工程師。常在技術討論與團隊協作中登場。',
 cindy:'資深專案管理師，熟悉專案排程與跨部門協調。人員更替時，也需要她協助銜接工作。',
 professor:'電機領域教授兼產學顧問，定期參與公司討論。研究課題與專案需求，是常見的話題。',
 annie_yu:'商務開發助理，協助歐文處理合作與對外聯繫。同名同事不少，傳訊前記得確認對象。',
 princess:'海外資訊背景的資料探勘工程師，辦公室叫她公主。對話多與資料工作及技術分工有關。',
 joyce:'業務總監，別稱914。負責客戶窗口與業務協調，熟識的同事也可能需要透過正式流程聯繫。',
 janet:'財會主管，負責預算、帳務與核銷。資料是否齊全、條件是否一致，是她常確認的事。',
 captain:'人資行政專員，別稱船長。招募、活動與日常行政都是她的工作，行程常需要臨時協調。',
});
export const PERSONAS = Object.freeze(Object.fromEntries([
 ['wing','翅膀','執行長'],
 ['spencer','屎潘蛇','董事長'],
 ['erich','法師','法務長'],
 ['sonny','阿福','MIS'],
 ['jenjen','真真','行政長'],
 ['rick','瑞克','老闆乾兒子'],
 ['kind','阿良','技術經理'],
 ['hope','希望','HR長'],
 ['jack','傑克','研發部經理'],
 ['meimei','水蛇','業務經理'],
 ['helen','前女友','產品開發總監'],
 ['sophie','紅茶','稽核主管'],
 ['jonathan','強哥','助理工程師'],
 ['owen','歐文','商務開發總監'],
 ['sam','山姆','資深資料探勘工程師'],
 ['cindy','辛蒂','資深專案管理師'],
 ['professor','林澤教授','台大電機教授／產學顧問'],
 ...Object.entries(CAST_PROFILES_V39).map(([id,p])=>[id,p.name,p.title]),
].map(([id,name,title])=>[id,Object.freeze({name,title,image:`./assets/${id}.png`,portrait:!['wing','spencer'].includes(id),about:CHARACTER_BIOS[id]})])));

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

export function displayName(id){return Object.hasOwn(PERSONAS,id)?displayText(PERSONAS[id].name):id;}

// Engine authors still read the frozen identity above. UI cards can use the
// current public alias without altering old history, RNG or proof inputs.
export function displayPersona(id){
 if(!Object.hasOwn(PERSONAS,id))return null;
 const person=PERSONAS[id];
 return {...person,name:displayName(id),title:id==='professor'?'電機領域教授／產學顧問':person.title};
}

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
export function publishedDisplayText(value=''){
 return proseText(value,part=>renameCopy(part).replace(/(?<![A-Za-z0-9_])Moon\s+Dog(?![A-Za-z0-9_])/g,'真真').replace(displayNamePattern,name=>displayNames[name]).replaceAll('蘇菲','紅茶').replaceAll('老闆乾兒子','瑞克').replaceAll('顧問教授','林澤教授').replaceAll('遊戲月薪','月薪'));
}

export function displayText(value=''){
 return proseText(value,part=>publishedDisplayText(part).replaceAll('林澤教授','林老師'));
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
