// Presentation only: the archived event, choices and replay outcome stay frozen.
const SCENE_ID='quiz26-white-team-wallet';
const OLD_BODY='校外活動結束，白隊開始清點公費。有人說那筆錢先交給阿福的朋友處理，朋友卻沒在工作群組裡。阿福忙著回憶誰當時站在哪裡，你拿著收支表，覺得今天最需要接力的是單據。';
const BODY='校外活動結束，白隊開始清點公費。有人說那筆錢先交給財會主管 Janet，也就是阿福口中的「朋友」處理。你請阿福和 Janet 把付款、保管與結餘紀錄放在一起，他卻先忙著回憶誰當時站在哪裡。你拿著收支表，覺得今天最需要接力的是單據。';
const OLD_LINE='他有幫忙啦，錢的部分我再問一下。';
const LINE='Janet 有幫忙啦，錢的部分我再跟她核對。';

export function displayJanetSceneV70(record){
 if(!record||typeof record!=='object')return record;
 const descriptors=Object.getOwnPropertyDescriptors(record);
 if(descriptors.id?.value!==SCENE_ID&&descriptors.eventId?.value!==SCENE_ID)return record;
 let changed=false;
 const replace=(key,transform)=>{
  const descriptor=descriptors[key];
  // Never resolve a hidden choice, result or draw accessor during rendering.
  if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='string')return;
  const value=transform(descriptor.value);
  if(value!==descriptor.value){descriptors[key]={...descriptor,value};changed=true;}
 };
 replace('body',value=>value===OLD_BODY?BODY:value);
 replace('wing',value=>value===OLD_LINE?LINE:value);
 replace('result',value=>value.replaceAll('阿福找到聯絡窗口','阿福找到 Janet 一起核對').replaceAll('朋友有處理','Janet 有處理'));
 return changed?Object.create(Object.getPrototypeOf(record),descriptors):record;
}
