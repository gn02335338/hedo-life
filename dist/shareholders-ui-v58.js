import {getShareholderPlayV58} from './shareholders-v58.js';
import {displayPersona,displayText} from './persona.js';

// Selecting testimony or a document is only a local draft. The shared engine
// receives an action only when the player questions, presents, or yields.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const prose=value=>esc(displayText(String(value??'')));
const ATTENDEES=Object.freeze(['wing','spencer','erich','jenjen','janet','sonny']);
const button=(command,label,extra='')=>`<button type="button" data-shareholder-command="${command}" ${extra}>${label}</button>`;
const person=id=>displayPersona(id)||{name:'會場發言人',title:'股東大會'};
const portrait=(id,className='')=>{const p=person(id);return `<img class="${className}" src="./assets/${ATTENDEES.includes(id)||id==='jack'?id:'wing'}.png" alt="${esc(p.name)}" width="64" height="64">`;};
const blank=()=>({statement:0,evidence:null,locked:false,message:''});
// Keep only a small, local choice draft while the ordinary result screen is
// visible. No consequence, credibility, pressure, or submit lock is cached.
const drafts=new Map();
const draftKey=(run,view)=>{const identity=run?.runId||run?.seed;return typeof identity==='string'&&identity?JSON.stringify([identity,view.round]):null;};
function initialState(run,view){
 const draft=drafts.get(draftKey(run,view)),state=blank();
 if(draft&&view.statements.some(row=>row.id===draft.statement))state.statement=draft.statement;
 if(draft&&view.evidence.some(row=>row.id===draft.evidence))state.evidence=draft.evidence;
 return state;
}
function rememberDraft(key,state){
 if(!key)return;
 const [identity,round]=JSON.parse(key);
 for(const oldKey of drafts.keys()){const old=JSON.parse(oldKey);if(old[0]===identity&&old[1]!==round)drafts.delete(oldKey);}
 drafts.delete(key);drafts.set(key,{statement:state.statement,evidence:state.evidence});
 while(drafts.size>8)drafts.delete(drafts.keys().next().value);
}

function meter(label,value,max,kind){
 const safe=Math.max(0,Math.min(max,Number(value)||0));
 return `<div class="shareholder-meter ${kind}"><div><span>${label}</span><b>${safe}<small> / ${max}</small></b></div><meter min="0" max="${max}" value="${safe}" aria-label="${label}">${safe} / ${max}</meter></div>`;
}

function contentHTML(view,state){
 const selected=view.statements.find(row=>row.id===state.statement)||view.statements[0],file=view.evidence.find(row=>row.id===state.evidence),speaker=person(view.speaker),locked=state.locked?' disabled':'';
 return `<header class="shareholder-heading"><div class="shareholder-heading-top"><span class="shareholder-kicker">SHAREHOLDERS / 股東大會攻防</span><span class="shareholder-round">第 ${view.round+1} / 4 輪</span></div><h2>逐句聽，逐頁核對。</h2><p>聽完說法，挑一句追問；也可以從資料夾拿出文件，對照眼前這句話。</p><ol class="shareholder-rounds" aria-label="大會攻防進度">${Array.from({length:4},(_,i)=>`<li${i===view.round?' aria-current="step"':''} class="${i<view.round?'finished':i===view.round?'current':''}"><span>${i<view.round?'✓':String(i+1).padStart(2,'0')}</span><small>${i===view.round?prose(view.roundLabel):i<view.round?'已記錄':'待開議'}</small></li>`).join('')}</ol></header>
 <div class="shareholder-attendees" aria-label="出席大會的六位公司角色">${ATTENDEES.map(id=>`<div class="shareholder-attendee${view.speaker===id?' speaking':''}">${portrait(id)}<span>${esc(person(id).name)}</span>${view.speaker===id?'<small>發言中</small>':'<small>在席</small>'}</div>`).join('')}</div>
 <div class="shareholder-room"><div class="shareholder-session"><div class="shareholder-session-status">${meter('發言可信度',view.credibility,3,'credibility')}${meter('會場壓力',view.pressure,4,'pressure')}</div><div class="shareholder-witness">${portrait(view.speaker)}<div><span class="shareholder-kicker">${esc(speaker.title)} · ${esc(speaker.name)}</span><p>「${prose(view.wing)}」</p></div></div>
 <fieldset class="shareholder-testimony"><legend><span>01</span> 點選要核對的說法</legend><div role="group" aria-label="本輪三句證詞">${view.statements.map(row=>button('statement',`<span class="shareholder-statement-index">${String(row.id+1).padStart(2,'0')}</span><span>${prose(row.text)}${row.pressed?'<small>這句已追問過</small>':''}</span><i aria-hidden="true">${row.id===selected?.id?'●':'○'}</i>`,`class="shareholder-statement" data-shareholder-value="${row.id}" aria-pressed="${row.id===selected?.id}"${locked}`)).join('')}</div></fieldset>
 ${view.feedback?`<div class="shareholder-last-feedback" role="status" aria-live="polite"><b>剛才的交鋒，對方這樣回答。</b><p>${prose(view.feedback)}</p></div>`:''}
 <aside class="shareholder-jack" aria-label="傑克的場邊筆記">${portrait('jack')}<div><span>同席股東 / 傑克</span><p>${prose(view.jackHint)}</p><small>他又摸了摸認股收據：「早知道拿去買正2，現在就財富自由了。」</small></div></aside></div>
 <fieldset class="shareholder-evidence"><legend><span>02</span> 你的資料夾 <small>${view.evidence.length} 份文件</small></legend><p>選文件只會放到手邊，按「提出證據」才算發言。文件可以反覆查看。</p><div class="shareholder-evidence-grid" role="group" aria-label="可查閱的證據文件">${view.evidence.map((row,i)=>button('evidence',`<span class="shareholder-file-number">FILE ${String(i+1).padStart(2,'0')}<i aria-hidden="true">${row.id===state.evidence?'✓':'⌑'}</i></span><b>${prose(row.title)}</b><span class="shareholder-file-body">${prose(row.body)}</span>`,`class="shareholder-file" data-shareholder-value="${esc(row.id)}" aria-pressed="${row.id===state.evidence}"${locked}`)).join('')}</div></fieldset></div>
 <div class="shareholder-action-desk"><div class="shareholder-selection" aria-live="polite" aria-atomic="true"><span>準備針對</span><p>「${prose(selected?.text)}」</p><small>${file?`手邊文件：${prose(file.title)}`:'尚未選文件；可以先追問，也可以查看資料夾。'}</small></div><div class="shareholder-actions">${button('press',`<span aria-hidden="true">？</span><b>${selected?.pressed?'這句已追問過':'等一下，請說清楚。'}</b><small>追問選中的說法</small>`,`class="shareholder-press"${locked||selected?.pressed?' disabled':''}`)}${button('present','<span aria-hidden="true">！</span><b>提出證據</b><small>用選中的文件回應</small>',`class="shareholder-present"${locked||!file?' disabled':''}`)}${button('yield','這輪先保留，讓大會繼續 →',`class="shareholder-yield"${locked}`)}</div></div>
 <p class="shareholder-feedback" data-shareholder-feedback role="status" aria-live="polite" aria-atomic="true">${esc(state.message||(state.locked?'正在記下這次發言…':'選好說法和文件再發言。對方怎麼接招，說出口後才知道。'))}</p><p class="shareholder-save-note">不計手速，可以慢慢核對。追問、提出證據與保留發言會推進這場大會；點選說法或文件不會。</p>`;
}

export function shareholderGameHTMLV58(run){
 const view=getShareholderPlayV58(run);
 return view?`<section class="shareholder-game" data-shareholder-game-v58 aria-label="股東大會證詞與證據攻防">${contentHTML(view,initialState(run,view))}</section>`:'';
}

export function mountShareholderGameV58(root,{run,onPlay}={}){
 const view=getShareholderPlayV58(run),panel=root?.matches?.('[data-shareholder-game-v58]')?root:root?.querySelector?.('[data-shareholder-game-v58]');
 if(!view||!panel||typeof onPlay!=='function')return()=>{};
 let state=initialState(run,view),alive=true;
 const key=draftKey(run,view);
 rememberDraft(key,state);
 const paint=()=>{
  if(!alive)return;
  const active=panel.ownerDocument?.activeElement,focus=active&&panel.contains(active)?{command:active.dataset.shareholderCommand,value:active.dataset.shareholderValue}:null;
  panel.innerHTML=contentHTML(view,state);
  if(focus){const next=[...panel.querySelectorAll('[data-shareholder-command]')].find(node=>node.dataset.shareholderCommand===focus.command&&node.dataset.shareholderValue===focus.value&&!node.disabled);next?.focus({preventScroll:true});}
 };
 const retry=message=>{if(alive){state.locked=false;state.message=message;paint();}};
 const commit=input=>{
  state.locked=true;state.message='這次發言已送出，接著看會場怎麼回答。';paint();
  try{Promise.resolve(onPlay(input)).then(result=>{if(result===false)retry('目前進度已有變動，這次發言尚未送出。請確認眼前這輪再試。');}).catch(()=>retry('這次發言尚未完成。文件還在手邊，確認進度後可以再試。'));}
  catch{retry('這次發言尚未完成。文件還在手邊，確認進度後可以再試。');}
 };
 const onClick=event=>{
  const target=event.target.closest?.('[data-shareholder-command]');
  if(!alive||!target||!panel.contains(target))return;
  event.stopPropagation();
  if(state.locked||target.disabled)return;
  const command=target.dataset.shareholderCommand,value=target.dataset.shareholderValue;
  if(command==='statement'){
   const id=Number(value);if(!view.statements.some(row=>row.id===id))return;
   state.statement=id;state.message='已選中這句說法，還沒發言。';rememberDraft(key,state);paint();return;
  }
  if(command==='evidence'){
   if(!view.evidence.some(row=>row.id===value))return;
   state.evidence=value;state.message='文件已放到手邊，還沒提出。';rememberDraft(key,state);paint();return;
  }
  const selected=view.statements.find(row=>row.id===state.statement);
  if(command==='press'&&selected&&!selected.pressed)commit({mode:'press',statement:selected.id,evidence:null});
  else if(command==='present'&&selected&&view.evidence.some(row=>row.id===state.evidence))commit({mode:'present',statement:selected.id,evidence:state.evidence});
  else if(command==='yield')commit({mode:'yield',statement:0,evidence:null});
 };
 const onKey=event=>{if(event.repeat&&(event.key===' '||event.key==='Enter')&&event.target.closest?.('[data-shareholder-command]'))event.preventDefault();};
 panel.addEventListener('click',onClick);panel.addEventListener('keydown',onKey);
 return()=>{alive=false;panel.removeEventListener('click',onClick);panel.removeEventListener('keydown',onKey);};
}
