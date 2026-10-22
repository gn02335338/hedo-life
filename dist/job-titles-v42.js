// Player-facing title corrections only. Canonical career ladders, saved rows,
// choices and replay evidence keep the wording with which they were published.
const SYSTEM_TITLES=Object.freeze({
 '助理工程師':'助理系統工程師',
 '工程師':'系統工程師',
 '資深工程師':'資深系統工程師',
 '主任工程師':'主任系統工程師',
 '工程副理':'系統工程副理',
 '工程經理':'系統工程經理',
 '工程總監':'系統工程總監'
});
const titles=Object.keys(SYSTEM_TITLES).sort((a,b)=>b.length-a.length).join('|');
const titleEnd='(?=$|[「」『』，。,.;；：:！!？?\\s、→]|的(?:工作|正式職稱|名片|身分|位置)|又被放上桌)';
const playerPrefix='(?:你目前仍是|你目前是|你仍是|你現在的職稱是|你的職稱是|你的職稱還是|你的職稱變更為|目前實際職稱[：:]\\s*|你正式成為|報到卻叫我做|報到改|我接受)';
const careerPrefix='(?:目前職稱是|(?:^|[，。；])職稱是|職稱寫著|實際職稱是|實際職稱也是|報到後的職稱也是|報到時的實際職稱卻被改成|改以|被改派為|職稱變更[：:]\\s*|職級維持|正式任用[：:]\\s*|第\\d+個工作回合，|→\\s*|(?:^|[，。；])正式成為|(?:^|[，。；])談到了|(?:^|[，。；])換到了|你得到|這次要談的是|這次想談|下一步想談|重新談|上回談|現在|又做了一段時間的|接下來先以|[，。；]留下)';
const playerTitle=new RegExp(`(${playerPrefix}[「『]?)(?<title>${titles})${titleEnd}`,'gu');
const careerTitle=new RegExp(`(${careerPrefix}[「『]?)(?<title>${titles})${titleEnd}`,'gu');
const onboardingComparison=new RegExp(`(跟)(?<title>${titles})(?=不是換一張名片)`,'gu');
const relevantEvent=id=>/^(?:onboarding$|career-|rank-|promotion-|patronage-|education-|salary-|raise-|exit-menu$|story-exit$|chapter-resolution$|verbal-v2-decision$)/u.test(id||'');
const assistantSystemOrigins=new Set(['system','project','mis']);

export function displayPlayerTitleV42(title,actualRoleId){
 return actualRoleId==='system'&&typeof title==='string'?(SYSTEM_TITLES[title]||title):title;
}

export function displayPlayerCareerTextV42(text,{actualRoleId,eventId,jobTitle}={}){
 if(actualRoleId!=='system'||typeof text!=='string')return text;
 if(text===jobTitle||Object.hasOwn(SYSTEM_TITLES,text))return displayPlayerTitleV42(text,actualRoleId);
 const replace=(_match,prefix,_title,_offset,_source,groups)=>prefix+SYSTEM_TITLES[groups.title];
 let next=text.replace(playerTitle,replace);
 if(relevantEvent(eventId))next=next.replace(careerTitle,replace);
 if(eventId==='onboarding')next=next.replace(onboardingComparison,replace);
 return next;
}

// Copy descriptors rather than spreading a choice: a preview must not read a
// result, random draw or success/failure branch, even if one is a getter.
const patch=(source,values)=>{
 const descriptors=Object.getOwnPropertyDescriptors(source);
 for(const [key,value]of Object.entries(values))descriptors[key]={value,writable:true,enumerable:true,configurable:true};
 return Object.defineProperties({},descriptors);
};
const textFields=(source,fields,context)=>Object.fromEntries(fields.filter(key=>typeof source[key]==='string').map(key=>[key,displayPlayerCareerTextV42(source[key],context)]));

export function displayPlayerEventV42(event,run){
 if(!event||run?.actualRoleId!=='system')return event;
 const context={actualRoleId:'system',eventId:event.id},values=textFields(event,['title','body','wing'],context);
 if(Array.isArray(event.choices))values.choices=event.choices.map(choice=>typeof choice?.text==='string'?patch(choice,{text:displayPlayerCareerTextV42(choice.text,context)}):choice);
 return patch(event,values);
}

export function displayPlayerVerbalLineV42(line,run,eventId=run?.eventId){
 return displayPlayerCareerTextV42(line,{actualRoleId:run?.actualRoleId,eventId});
}

function historicalRole(row,run){
 // These formal titles only belong to the system career. The role at the end
 // of a life is not evidence of the role described by an earlier row.
 const title=row?.jobTitle;
 if(Object.hasOwn(SYSTEM_TITLES,title)&&title!=='助理工程師')return 'system';
 if(title==='助理工程師'&&assistantSystemOrigins.has(run?.roleId))return 'system';
 return null;
}
function historicalTextRole(row,run){
 const fields=['body','choiceText','result'].map(key=>typeof row[key]==='string'?row[key]:'');
 // An accepted job can already have changed row.jobTitle. Inspect only its
 // committed wording in explicit player-title positions, never future choices.
 const probe='__SYSTEM_TITLE__';
 for(const text of fields){
  const projected=displayPlayerCareerTextV42(text,{actualRoleId:'system',eventId:row.eventId});
  if(projected===text)continue;
  if(assistantSystemOrigins.has(run?.roleId))return 'system';
  const withoutAssistant=text.replaceAll('助理工程師',probe);
  if(displayPlayerCareerTextV42(withoutAssistant,{actualRoleId:'system',eventId:row.eventId})!==withoutAssistant)return 'system';
 }
 return null;
}

export function displayPlayerHistoryV42(row,run){
 if(!row||typeof row!=='object')return row;
 const role=historicalRole(row,run),proseRole=historicalTextRole(row,run)||role;
 const values=textFields(row,['title','body','wing','choiceText','result'],{actualRoleId:proseRole,eventId:row.eventId});
 if(typeof row.jobTitle==='string')values.jobTitle=displayPlayerTitleV42(row.jobTitle,role);
 return patch(row,values);
}

export function displayPlayerEndingV42(ending){
 if(!ending||ending.roleId!=='system')return ending;
 const values=textFields(ending,['title','subtitle','body','retrospectiveBody'],{actualRoleId:'system',eventId:'career-ending'});
 if(typeof values.title==='string'){
  values.title=values.title.replace(new RegExp(`^(${titles})(?=的|留下|[｜，。；：]|$)`,'u'),title=>SYSTEM_TITLES[title]);
  if(values.title==='副理兼全部工程師')values.title='系統工程副理兼全組工程師';
 }
 if(typeof values.subtitle==='string')values.subtitle=values.subtitle.replace(/^這次離線的是工程師$/u,'這次離線的是系統工程師');
 if(typeof values.body==='string')values.body=values.body.replace(/職稱之所以還留著工程師/gu,'職稱之所以還留著系統工程師');
 return patch(ending,values);
}
