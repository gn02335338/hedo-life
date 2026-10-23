// Artwork is a read-only presentation layer. Never pass a run's unchosen
// choices, draw outcomes or future ending into this module.
import {PERSONAS,displayPersona} from './persona.js';
import {displayOccupationTextV47 as displayText} from './occupation-copy-v47.js';
import {HIDDEN_PERSONAS_V45} from './hidden-encounter-v45.js';
import {ENDINGS} from './endings.js';
import {EVENT_SCENES_V38,DYNAMIC_SCENES_V38,SCENE_PLATES_V38,SCENE_ALIASES_V38} from './illustration-scenes-v38.js';

const escape=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const illustrationPeople={...PERSONAS,...HIDDEN_PERSONAS_V45};
const plateIds=new Set(SCENE_PLATES_V38);
const endingRecords=new Map(ENDINGS.map(ending=>[ending.id,{roleId:ending.roleId,title:ending.title}]));
const roleLabels=Object.freeze({system:'系統工程',ai:'AI工程',project:'專案管理',product:'產品管理',design:'產品設計',bd:'商務開發',sales:'業務',mis:'MIS',executive:'高階主管',finance:'財務',accounting:'會計',hr:'人資',admin:'行政'});
const uiScenes=Object.freeze({'role-selection':'onboarding','resume-roll':'onboarding'});

export function sceneIllustration(event,{roleId=null,people=[],reality=null}={}){
  const id=typeof event?.id==='string'?event.id:'';
  let theme=(['activity','activity-invitation','office-treat','event-departure','blockchain'].includes(event?.kind)||typeof event?.kind==='string'&&event.kind.startsWith('shareholder')||event?.hiddenCharacter===true||/^cast6[56]-/.test(id))&&plateIds.has(event.scene)?event.scene:EVENT_SCENES_V38[id]||DYNAMIC_SCENES_V38[id]||uiScenes[id]||'office_day';
  // `reality` must come from the already revealed current history row. A
  // previous imagined/real encounter cannot set this frame's visual mode.
  const mode=['imagined','real'].includes(reality)?reality:null;
  if(mode)theme=mode==='imagined'?'dream_rage':event?.scope==='private'?'dinner':'real_rage';
  if(event?.scope==='private'&&mode!=='imagined'){
    if(id==='rage-legal')theme='police_station';
    else if(['rage-aftermath','rage-showdown','rage-public'].includes(id))theme='dinner';
  }
  theme=SCENE_ALIASES_V38[theme]||theme;
  if(!plateIds.has(theme))theme='office_day';
  const knownRole=Object.hasOwn(roleLabels,roleId)?roleId:null;
  const members=[...new Set(people)].filter(id=>Object.hasOwn(illustrationPeople,id)).slice(0,event?.activity?.id==='roadshow'&&event?.participants?.includes('professor')?4:3);
  return {theme,mode,roleId:knownRole,roleLabel:knownRole?roleLabels[knownRole]:'',people:members,
    src:`./assets/scenes/${theme}.webp`,title:displayText(event?.title||'上班途中的一幕')};
}

export function renderSceneIllustration(event,options={}){
  const art=sceneIllustration(event,options),compact=options.compact===true;
  const modeLabel=art.mode==='imagined'?'腦內夢境 · 現實沒有動手':art.mode==='real'?'現實失控 · 事情真的發生了':'';
  return `<figure class="story-illustration${compact?' compact-illustration':''}${art.mode?` illustration-${art.mode}`:''}" data-scene-theme="${art.theme}"${art.roleId?` data-scene-role="${art.roleId}"`:''} aria-label="${escape(`場景插畫：${art.title}`)}"><div class="scene-image-frame"><img class="scene-environment" src="${art.src}" width="960" height="540" alt="" aria-hidden="true" loading="lazy" decoding="async" data-illustration="environment">${art.people.length?`<div class="scene-cast" aria-hidden="true">${art.people.map(id=>`<div class="scene-person"><img src="${illustrationPeople[id].image}" width="180" height="180" alt="" loading="lazy" decoding="async" data-illustration="portrait"><span>${escape(displayText(illustrationPeople[id].name))}</span></div>`).join('')}</div>`:''}${modeLabel?`<span class="scene-reality-label">${modeLabel}</span>`:''}</div><figcaption><span>${modeLabel||(event?.hiddenCharacter?'移動人生 · 隱藏角色':event?.scope==='private'?'移動人生 · 私人場合':'移動人生 · 上班現場')}</span>${art.roleLabel?`<span>${escape(art.roleLabel)}</span>`:''}</figcaption></figure>`;
}

export function endingIllustrationPath(ending,{unlocked=false}={}){
  if(!unlocked||!ending||!endingRecords.has(ending.id))return null;
  const known=endingRecords.get(ending.id);
  if(ending.roleId!==known.roleId)return null;
  return `./assets/endings/${ending.id}.webp`;
}

export function renderEndingIllustration(ending,{unlocked=false,compact=false}={}){
  const path=endingIllustrationPath(ending,{unlocked});
  if(!path)return '';
  return `<figure class="ending-illustration${compact?' compact-ending-illustration':''}" data-ending-art-role="${ending.roleId}"><img src="${path}" width="960" height="540" alt="${escape(`${displayText(ending.title)}・${roleLabels[ending.roleId]}結局插畫`)}" loading="lazy" decoding="async" data-illustration="ending"></figure>`;
}

// The downloaded SVG must keep working offline. Embed the same-origin image
// rather than leaving a relative URL inside the exported certificate.
export async function embedEndingIllustration(ending,{unlocked=false,fetcher=globalThis.fetch,timeoutMs=4000}={}){
  const path=endingIllustrationPath(ending,{unlocked});
  if(!path||typeof fetcher!=='function')return '';
  // Only trusted callers/tests supply options; ending data cannot set this
  // deadline. Cap it even for internal callers so exporting text stays usable.
  const deadline=Number.isSafeInteger(timeoutMs)&&timeoutMs>0?Math.min(timeoutMs,4000):4000;
  const controller=typeof globalThis.AbortController==='function'?new globalThis.AbortController():null;
  let timer;
  const expired=new Promise(resolve=>{timer=globalThis.setTimeout(()=>{
    controller?.abort();resolve('');
  },deadline);});
  const readImage=async()=>{
    const response=await fetcher(path,{credentials:'same-origin',cache:'force-cache',...(controller?{signal:controller.signal}:{})});
    if(!response?.ok)return '';
    const type=(response.headers?.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/webp','image/png','image/jpeg'].includes(type))return '';
    const bytes=new Uint8Array(await response.arrayBuffer());
    if(!bytes.length||bytes.length>4*1024*1024||typeof globalThis.btoa!=='function')return '';
    let binary='';
    for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    return `data:${type};base64,${globalThis.btoa(binary)}`;
  };
  // Abort alone is insufficient: a stalled/custom fetcher may ignore it. The
  // same race also covers a body stream that stalls after headers arrive.
  try{return await Promise.race([readImage(),expired]);}
  catch{return '';}
  finally{globalThis.clearTimeout(timer);}
}
