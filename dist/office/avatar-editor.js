import { defaultOfficeAvatar, validateOfficeAvatar, OFFICE_AVATAR_LIMITS } from './avatar-config.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const presets={human:'人形同事',robot:'機器人',cat:'貓咪',voxel:'自由積木'};
const hair={none:'無',short:'短髮',long:'長髮',mohawk:'龐克'};
const accessories={none:'無',glasses:'眼鏡',headphones:'耳機',cap:'帽子'};

export async function createOfficeAvatarEditor(container,{initial,kind='human',onSave}={}) {
  let config;try{config=validateOfficeAvatar(initial);}catch{config=defaultOfficeAvatar(kind);}
  let selected=0,preview=null,disposed=false;
  const options=(values,value)=>Object.entries(values).map(([id,label])=>`<option value="${id}" ${id===value?'selected':''}>${label}</option>`).join('');
  container.innerHTML=`<form id="avatar-editor-form" class="form avatar-editor"><div class="avatar-workbench"><div class="avatar-preview" aria-label="角色即時立體預覽"><p>正在準備你的角色…</p></div><div class="avatar-controls"><label>角色底模<select name="preset">${options(presets,config.preset)}</select></label><div class="avatar-colors">${[['bodyColor','衣服／外殼'],['skinColor','膚色／臉部'],['hairColor','頭髮'],['accentColor','裝飾']].map(([id,label])=>`<label>${label}<input type="color" name="${id}" value="${config[id]}"></label>`).join('')}</div>${[['height','身高',.7,1.5],['width','身寬',.65,1.4],['headSize','頭部大小',.7,1.5]].map(([id,label,min,max])=>`<label>${label}<input type="range" name="${id}" min="${min}" max="${max}" step=".05" value="${config[id]}"></label>`).join('')}<div class="avatar-pair"><label>髮型<select name="hairStyle">${options(hair,config.hairStyle)}</select></label><label>配件<select name="accessory">${options(accessories,config.accessory)}</select></label></div><button type="button" class="small-button" data-editor="random">隨機靈感 ↻</button></div></div><details class="voxel-workbench" open><summary>自由積木 · 最多 ${OFFICE_AVATAR_LIMITS.maxVoxels} 塊</summary><p class="form-note">在人形上加翅膀、尾巴或招牌；選「自由積木」可以從零組裝。位置以腳底為原點，尺寸與座標以公尺表示。</p><div class="voxel-toolbar"><select aria-label="選擇積木" id="voxel-selection"></select><button type="button" class="small-button" data-editor="add">＋ 積木</button><button type="button" class="small-button" data-editor="duplicate">複製</button><button type="button" class="small-button" data-editor="remove">移除</button></div><div class="voxel-fields">${[['x','左右位置',-1,1],['y','高度',0,2.5],['z','前後位置',-1,1],['w','寬度',.04,1.5],['h','高度尺寸',.04,1.5],['d','深度',.04,1.5]].map(([key,label,min,max])=>`<label>${label}<input data-voxel="${key}" type="number" min="${min}" max="${max}" step=".01"></label>`).join('')}<label>積木顏色<input type="color" data-voxel="color"></label></div><p class="form-note">積木外緣需在左右／前後 ±1、高度 0–2.5 的模型空間內。</p></details><details class="avatar-json"><summary>匯入／匯出完整模型設定</summary><textarea id="avatar-json" aria-label="完整角色模型 JSON" spellcheck="false" maxlength="32768"></textarea><div class="profile-actions"><button type="button" class="small-button" data-editor="apply-json">套用 JSON</button><button type="button" class="small-button" data-editor="export">下載模型</button><label class="small-button">匯入模型<input id="avatar-import" type="file" accept="application/json,.json" hidden></label></div><p class="form-note">可分享自己的 JSON 配方；設定檔不包含加入憑證。</p></details><p class="notice error" id="avatar-editor-error" role="alert" hidden></p><button class="primary" type="submit">儲存角色，回辦公室走走 →</button></form>`;
  const form=container.querySelector('form'),error=container.querySelector('#avatar-editor-error');
  function notice(message=''){error.hidden=!message;error.textContent=message;}
  function update(){
    preview?.update(config);
    container.querySelector('#avatar-json').value=JSON.stringify(config,null,2);
    const list=container.querySelector('#voxel-selection');list.innerHTML=config.voxels.length?config.voxels.map((v,i)=>`<option value="${i}">${i+1} · ${esc(v.color)}</option>`).join(''):'<option value="0">還沒有積木</option>';
    selected=Math.max(0,Math.min(selected,config.voxels.length-1));list.value=String(selected);
    container.querySelectorAll('[data-voxel]').forEach(input=>{input.disabled=!config.voxels.length;input.required=!!config.voxels.length;input.value=config.voxels[selected]?.[input.dataset.voxel]??(input.type==='color'?'#79a68d':'');});
  }
  function syncControls(){for(const key of ['preset','bodyColor','skinColor','hairColor','accentColor','height','width','headSize','hairStyle','accessory'])form.elements[key].value=config[key];update();}
  function adopt(next){try{config=validateOfficeAvatar(next);notice();update();return true;}catch(e){notice(e.message);return false;}}
  function commitVoxel(){
    if(!config.voxels[selected])return true;
    const next=structuredClone(config);
    for(const input of container.querySelectorAll('[data-voxel]')){
      if(input.type==='number'&&(!input.value.trim()||!Number.isFinite(Number(input.value)))){notice('請填入完整的積木位置與尺寸。');return false;}
      next.voxels[selected][input.dataset.voxel]=input.type==='color'?input.value:Number(input.value);
    }
    return adopt(next);
  }
  const onInput=event=>{
    const input=event.target;
    if(input.name){const next=structuredClone(config);next[input.name]=input.type==='range'?Number(input.value):input.value;adopt(next);}
    else if(input.dataset.voxel&&input.type==='color'&&config.voxels[selected])commitVoxel();
  };
  const onChange=async event=>{
    if(event.target.dataset.voxel&&event.target.type==='number')commitVoxel();
    if(event.target.id==='voxel-selection'){selected=Number(event.target.value);update();}
    if(event.target.id==='avatar-import'){
      const file=event.target.files?.[0];if(!file)return;
      if(file.size>32768){notice('模型設定檔最多 32 KB。');return;}
      try{const next=JSON.parse(await file.text());if(!disposed&&adopt(next))syncControls();}catch{if(!disposed)notice('無法讀取這份 JSON 模型設定。');}
    }
  };
  const onClick=event=>{
    const action=event.target.closest('[data-editor]')?.dataset.editor;if(!action)return;
    if(action==='random'){const next=structuredClone(config);for(const key of ['bodyColor','skinColor','hairColor','accentColor'])next[key]=`#${Array.from(crypto.getRandomValues(new Uint8Array(3)),v=>v.toString(16).padStart(2,'0')).join('')}`;next.hairStyle=Object.keys(hair)[Math.floor(Math.random()*4)];adopt(next);syncControls();}
    if(action==='add'||action==='duplicate'){
      if(config.voxels.length>=OFFICE_AVATAR_LIMITS.maxVoxels){notice('已達到 96 塊積木。');return;}
      const next=structuredClone(config);next.voxels.push(action==='duplicate'&&next.voxels[selected]?{...next.voxels[selected]}:{x:0,y:1.6,z:0,w:.25,h:.25,d:.25,color:config.accentColor});selected=next.voxels.length-1;adopt(next);
    }
    if(action==='remove'){const next=structuredClone(config);next.voxels.splice(selected,1);adopt(next);}
    if(action==='apply-json'){try{if(adopt(JSON.parse(container.querySelector('#avatar-json').value)))syncControls();}catch{notice('請輸入完整、有效的 JSON 模型設定。');}}
    if(action==='export'){const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='moving-office-avatar.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  };
  const onSubmit=async event=>{event.preventDefault();event.stopPropagation();const button=form.querySelector('[type=submit]');if(button.disabled||!commitVoxel())return;button.disabled=true;try{await onSave?.(validateOfficeAvatar(config));}catch(e){if(!disposed)notice(e.message||'暫時無法儲存，請稍後再試。');}finally{button.disabled=false;}};
  form.addEventListener('input',onInput);form.addEventListener('change',onChange);form.addEventListener('click',onClick);form.addEventListener('submit',onSubmit);update();
  const dispose=()=>{disposed=true;preview?.dispose();form.removeEventListener('input',onInput);form.removeEventListener('change',onChange);form.removeEventListener('click',onClick);form.removeEventListener('submit',onSubmit);};
  try{const {createAvatarPreview}=await import('./avatar-view.js');if(!disposed)preview=await createAvatarPreview(container.querySelector('.avatar-preview'),config);if(disposed)preview?.dispose();}
  catch{if(!disposed)container.querySelector('.avatar-preview').innerHTML='<p>立體預覽暫時無法開啟。<br>仍可編輯、儲存角色設定。</p>';}
  return {dispose};
}
