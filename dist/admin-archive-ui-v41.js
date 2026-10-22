const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export function adminLoginHTML({message='',busy=false}={}){
 return `<section class="private-archive" data-private-archive><span class="eyebrow">PRIVATE ARCHIVE</span><h2 id="dialog-title">管理員資料室。</h2><p class="dialog-lead">這一頁需要管理員登入。密碼由伺服器驗證，私人內容不包含在公開遊戲檔案裡。</p>${message?`<p class="private-message" role="status">${esc(message)}</p>`:''}<form data-private-login><label for="private-password">管理員密碼</label><input id="private-password" name="password" type="password" autocomplete="current-password" required maxlength="1024" ${busy?'disabled':''}><button class="primary" type="submit" ${busy?'disabled':''}>${busy?'正在驗證…':'進入資料室 →'}</button></form><p class="private-session-note">登入只保留於這個瀏覽器的限時工作階段，不影響玩家身分或遊戲紀錄。</p></section>`;
}

export function privateArchiveHTML(payload,{message='',replies={}}={}){
 const card=payload?.card;
 if(!card)return `<section class="private-archive" data-private-archive><span class="eyebrow">ADMIN / PRIVATE</span><h2 id="dialog-title">管理員資料室。</h2><p class="dialog-lead">已登入，目前尚未匯入封存內容。</p><button class="text-button" data-private-logout>登出管理員</button></section>`;
 return `<section class="private-archive" data-private-archive><div class="private-heading"><div><span class="eyebrow">ADMIN / PRIVATE</span><h2 id="dialog-title">封存角色。</h2></div><button class="text-button" data-private-logout>登出管理員</button></div>${message?`<p class="private-message" role="status">${esc(message)}</p>`:''}<article class="private-character"><img src="/api/admin/portrait" alt="${esc(card.name)}的封存角色插畫" referrerpolicy="no-referrer"><div><span>${esc(card.title)}</span><h3>${esc(card.name)}</h3>${card.alias?`<p>${esc(card.alias)}</p>`:''}<p>${esc(card.description)}</p></div></article><p class="private-session-note">以下完整資料僅供管理員查閱，不加入公開人物統計或結局收藏。遊戲沿用已選定的角色插畫與八篇原創事件，不會讀取這裡的完整資料。</p><div class="private-story-list">${(card.stories||[]).map((story,index)=>`<details><summary>${esc(story.title)}</summary><p>${esc(story.body)}</p>${(story.choices||[]).map((choice,choiceIndex)=>`<button class="private-story-choice" data-private-story="${index}" data-private-answer="${choiceIndex}">${esc(choice.text)}</button>`).join('')}${Number.isInteger(replies[index])&&story.choices?.[replies[index]]?`<p class="private-story-result" role="status">${esc(story.choices[replies[index]].result)}</p>`:''}</details>`).join('')}</div></section>`;
}

export function createAdminArchiveUI({dialog,openDialog,fetcher=(...args)=>fetch(...args),clock={now:()=>Date.now(),setTimeout:(callback,delay)=>setTimeout(callback,delay),clearTimeout:id=>clearTimeout(id)},lifecycle=globalThis.window}={}){
 let csrf='',payload=null,busy=false,epoch=0,replies={},expiresAt=0,expiryTimer=null,resumeOnPageshow=false;
 const visible=()=>dialog.open&&Boolean(dialog.querySelector('[data-private-archive]'));
 const render=html=>openDialog(html);
 function clearPrivate(){
  if(expiryTimer!==null)clock.clearTimeout(expiryTimer);
  expiryTimer=null;expiresAt=0;csrf='';payload=null;replies={};
 }
 function expire(){
  const show=visible();epoch++;clearPrivate();busy=false;
  if(show)render(adminLoginHTML({message:'工作階段已到期，封存內容已清除。請重新登入。'}));
 }
 const expired=()=>expiresAt>0&&clock.now()>=expiresAt;
 function acceptSession(session){
  const deadline=Date.parse(session?.expiresAt);
  if(!Number.isFinite(deadline)||deadline<=clock.now()||typeof session.csrfToken!=='string'||!/^[a-f0-9]{64}$/.test(session.csrfToken)){
   const error=new Error('工作階段已失效，請重新登入。');error.status=401;throw error;
  }
  if(expiryTimer!==null)clock.clearTimeout(expiryTimer);
  csrf=session.csrfToken;expiresAt=deadline;
  expiryTimer=clock.setTimeout(expire,Math.min(deadline-clock.now(),2147483647));
  expiryTimer?.unref?.();
 }
 async function call(path,{method='GET',body}={}){
  const headers={'Accept':'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(method==='POST'&&path.endsWith('/login'))headers['X-Admin-Intent']='private-archive';
  else if(method!=='GET')headers['X-CSRF-Token']=csrf;
  const response=await fetcher(path,{method,headers,credentials:'same-origin',cache:'no-store',...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>null);
  if(!response.ok){const error=new Error(response.status===429?'登入嘗試較多，請稍後再試。':response.status===401?'尚未登入，或驗證未通過。':response.status===503?'管理員資料室尚未就緒。':'目前無法開啟，請稍後再試。');error.status=response.status;throw error;}
  return result;
 }
 async function load(request){
  if(expired()){expire();return;}
  const result=await call('/api/admin/archive');if(request!==epoch||!visible())return;
  if(expired()){expire();return;}
  payload=result;replies={};render(privateArchiveHTML(payload));
 }
 async function open(){
  const request=++epoch;clearPrivate();resumeOnPageshow=false;busy=true;
  render(adminLoginHTML({message:'正在確認登入狀態…',busy:true}));
  try{const session=await call('/api/admin/session');if(request!==epoch)return;acceptSession(session);await load(request);}
  catch(error){if(request===epoch){clearPrivate();render(adminLoginHTML({message:error.status===401?'':error.message}));}}
  finally{if(request===epoch)busy=false;}
 }
 dialog.addEventListener('submit',async event=>{
  if(!event.target.matches?.('[data-private-login]'))return;
  event.preventDefault();if(!visible()||busy)return;
  const input=event.target.querySelector('input[name="password"]'),password=input.value;input.value='';
  const request=++epoch;busy=true;render(adminLoginHTML({busy:true}));
  try{const session=await call('/api/admin/login',{method:'POST',body:{password}});if(request!==epoch)return;acceptSession(session);await load(request);}
  catch(error){if(request===epoch){clearPrivate();render(adminLoginHTML({message:error.message}));}}
  finally{if(request===epoch)busy=false;}
 });
 dialog.addEventListener('click',async event=>{
  if(!visible()||busy)return;
  if(expired()){expire();return;}
  if(event.target.closest('[data-private-logout]')){
   busy=true;const request=++epoch;payload=null;replies={};let message='已登出，封存內容已從畫面清除。';
   render(adminLoginHTML({busy:true,message:'正在登出…'}));
   try{await call('/api/admin/logout',{method:'POST',body:{}});}
   catch(error){message=error.status===401?'工作階段已失效，封存內容已從畫面清除。':'畫面已清除，但暫時無法確認伺服器已登出。請重新連線後再開啟資料室登出。';}
   finally{if(request===epoch){clearPrivate();busy=false;render(adminLoginHTML({message}));}}return;
  }
  const answer=event.target.closest('[data-private-story]');if(!answer||!payload?.card)return;
  const index=Number(answer.dataset.privateStory),choice=Number(answer.dataset.privateAnswer);
  if(!Number.isInteger(index)||!Number.isInteger(choice)||!payload.card.stories?.[index]?.choices?.[choice])return;
  replies={...replies,[index]:choice};render(privateArchiveHTML(payload,{replies}));
  const details=dialog.querySelectorAll('.private-story-list details');if(details[index])details[index].open=true;
 });
 dialog.addEventListener('close',()=>{epoch++;clearPrivate();resumeOnPageshow=false;busy=false;const node=dialog.querySelector('[data-private-archive]');node?.remove();});
 lifecycle?.addEventListener('pagehide',()=>{
  resumeOnPageshow=visible();epoch++;clearPrivate();busy=false;
  if(resumeOnPageshow)render(adminLoginHTML({busy:true,message:'返回頁面後將重新確認登入狀態。'}));
 });
 lifecycle?.addEventListener('pageshow',()=>{
  const resume=resumeOnPageshow&&visible();resumeOnPageshow=false;
  if(resume)void open();
 });
 return {open};
}
