// A complete alternative answer is available only where a conversation can
// finish without consenting to paperwork, spending money or choosing a finale.
export const isPatronageProgressV69=value=>/^e39-r(?:69|7[01])-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
const ownScenes=new Set(['patronage67-education','patronage67-pay-review','patronage67-smalltalk']);
const fantasyScenes=new Set(['road','runway','audit']);
export function patronageProgressEffectV69(run,event){
 if(!isPatronageProgressV69(run)||!event)return null;
 if(event.kind==='daily'||event.kind==='fantasy'&&fantasyScenes.has(event.id))return {effect:null};
 if(ownScenes.has(event.id)&&event.kind==='career'&&run.resumeEventId)return {effect:'patronage67Return'};
 if(['kind-break','kind-workday'].includes(event.id)&&run.breakReturnEventId)return {effect:'cancelBreak',closing:'你把這次邀約停在這裡，沒有答應付費行程。話說完，先處理後面的事。'};
 if(event.id==='banquet-afterparty'&&run.banquetReturnEventId)return {effect:'banquetFinish',closing:'續攤的話題到這裡為止，你沒有購買行程。今晚先散，各自離開。'};
 return null;
}
