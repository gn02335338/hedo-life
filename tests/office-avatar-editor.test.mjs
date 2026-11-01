import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficeAvatarEditor } from '../dist/office/avatar-editor.js';
import { defaultOfficeAvatar } from '../dist/office/avatar-config.js';

// Exercise the real editor event handlers with small DOM surfaces. No GPU or
// browser is used: a failed preview must not block editing and saving a model.
class Field {
  constructor(type='text',value=''){this.type=type;this.value=value;this.dataset={};this.listeners=new Map();}
  get value(){return this._value;}
  set value(value){this._value=String(value);}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  removeEventListener(name,fn){if(this.listeners.get(name)===fn)this.listeners.delete(name);}
  focus(){}
  async emit(name,event={}){event.preventDefault||=()=>{};event.stopPropagation||=()=>{};await this.listeners.get(name)?.(event);}
}
async function harness(){
  const initial=defaultOfficeAvatar();initial.voxels=[{x:0,y:1,z:0,w:.2,h:.2,d:.2,color:'#ff00aa'}];
  const form=new Field(),button=new Field(),error=new Field(),json=new Field(),selection=new Field(),preview=new Field();
  const inputs=['x','y','z','w','h','d','color'].map(key=>{const input=new Field(key==='color'?'color':'number');input.dataset.voxel=key;return input;});
  form.elements=Object.fromEntries(Object.keys(initial).map(key=>[key,new Field()]));
  form.querySelector=()=>button;
  const ids=new Map([['form',form],['#avatar-editor-error',error],['#avatar-json',json],['#voxel-selection',selection],['.avatar-preview',preview]]);
  const container={innerHTML:'',querySelector:selector=>ids.get(selector),querySelectorAll:selector=>selector==='[data-voxel]'?inputs:[]};
  const saved=[];const editor=await createOfficeAvatarEditor(container,{initial,onSave:config=>saved.push(config)});
  return {form,error,json,inputs,saved,editor,preview};
}
test('voxel positions accept draft negative/decimal typing and commit only complete, valid values',async()=>{
  const h=await harness(),x=h.inputs[0];
  assert.equal(x.value,'0');x.value='';await h.form.emit('input',{target:x});assert.equal(x.value,'');
  assert.equal(JSON.parse(h.json.value).voxels[0].x,0);
  await h.form.emit('change',{target:x});assert.equal(h.error.hidden,false);
  x.value='-0.25';await h.form.emit('input',{target:x});assert.equal(x.value,'-0.25');
  await h.form.emit('change',{target:x});assert.equal(JSON.parse(h.json.value).voxels[0].x,-.25);assert.equal(h.error.hidden,true);
  await h.form.emit('submit');assert.equal(h.saved.length,1);assert.equal(h.saved[0].voxels[0].x,-.25);
  h.editor.dispose();assert.equal(h.form.listeners.size,0);
});
test('invalid box bounds cannot be saved, and the editor still works when 3D preview is unavailable',async()=>{
  const h=await harness(),x=h.inputs[0];assert.match(h.preview.innerHTML,/仍可編輯/);
  x.value='1';await h.form.emit('change',{target:x});assert.equal(h.error.hidden,false);
  await h.form.emit('submit');assert.equal(h.saved.length,0);assert.equal(JSON.parse(h.json.value).voxels[0].x,0);
  x.value='0.2';await h.form.emit('change',{target:x});await h.form.emit('submit');assert.equal(h.saved.length,1);
  h.editor.dispose();
});
