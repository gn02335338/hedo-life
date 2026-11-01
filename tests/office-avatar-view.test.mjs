import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Three from '../dist/island/vendor/three.module.js';
import { mergeGeometries } from '../dist/island/vendor/BufferGeometryUtils.js';
import { defaultOfficeAvatar, validateOfficeAvatar } from '../dist/office/avatar-config.js';
import { buildAvatar, getAvatarLayout, avatarAppearanceKey } from '../dist/office/avatar-view.js';

test('all four presets create distinct articulated models with bounded draw calls and shared color geometry', () => {
  const signatures = new Set();
  for (const preset of ['human', 'robot', 'cat', 'voxel']) {
    const config = {...defaultOfficeAvatar(), preset}, layout = getAvatarLayout(config), avatar = buildAvatar(config);
    signatures.add(JSON.stringify(layout.parts.map(part=>[part.shape,part.position,part.scale])));
    assert.ok(avatar.pickTargets.length <= 6);
    assert.equal(avatar.appearanceKey, avatarAppearanceKey(config));
    for (const mesh of avatar.pickTargets) { assert.ok(mesh.geometry.attributes.color); assert.equal(mesh.material.vertexColors,true); }
    avatar.pose({walking:true,walkPhase:Math.PI/2});
    assert.ok(avatar.parts.leftLeg.rotation.x>0);assert.ok(avatar.parts.rightLeg.rotation.x<0);
    avatar.pose({armWrestling:true,time:0});assert.ok(avatar.parts.rightArm.rotation.z<-.7);
    avatar.pose({walking:true,walkPhase:1,reducedMotion:true});assert.equal(avatar.parts.leftLeg.rotation.x,0);
    avatar.dispose();
  }
  assert.equal(signatures.size,4);
});

test('proportions, hair and accessories change real model geometry instead of metadata alone', () => {
  const plain=getAvatarLayout({...defaultOfficeAvatar(),hairStyle:'none'});
  const changed=getAvatarLayout({...defaultOfficeAvatar(),height:1.5,width:1.4,headSize:1.5,hairStyle:'mohawk',accessory:'headphones'});
  assert.notEqual(plain.appearanceKey,changed.appearanceKey);
  const head=layout=>layout.parts.find(part=>part.bone==='head');
  assert.ok(head(changed).scale[0]>head(plain).scale[0]);
  assert.ok(changed.parts.some(part=>part.shape==='torus'));
  assert.ok(changed.parts.length>plain.parts.length);
});

test('96 custom cubes merge into one colored draw with exact cleanup and reject invalid updates', () => {
  const voxels=Array.from({length:96},(_,i)=>({x:(i%8-3.5)*.2,y:.1+Math.floor(i/8)*.18,z:0,w:.15,h:.15,d:.15,color:i%2?'#aabbcc':'#112233'}));
  const config={...defaultOfficeAvatar(),preset:'voxel',voxels},before=structuredClone(config),avatar=buildAvatar(config);
  assert.equal(avatar.pickTargets.length,1);assert.equal(avatar.layout.parts.length,96);
  assert.deepEqual(config,before);
  let geometryDisposals=0,materialDisposals=0;
  avatar.pickTargets[0].geometry.addEventListener('dispose',()=>geometryDisposals++);
  avatar.pickTargets[0].material.addEventListener('dispose',()=>materialDisposals++);
  avatar.dispose();avatar.dispose();assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(avatar.group.children.length,0);
  assert.throws(()=>buildAvatar({...config,voxels:[...voxels,voxels[0]]}),TypeError);
});

test('custom cubes add real colored geometry to human, robot and cat presets without replacing their body', () => {
  const wing={x:.7,y:1.2,z:0,w:.5,h:.1,d:.8,color:'#f17e42'};
  for(const preset of ['human','robot','cat']){
    const base={...defaultOfficeAvatar(),preset},layout=getAvatarLayout({...base,voxels:[wing]}),avatar=buildAvatar({...base,voxels:[wing]});
    assert.equal(layout.parts.length,getAvatarLayout(base).parts.length+1);
    const cube=layout.parts.filter(part=>part.bone==='root');assert.equal(cube.length,1);assert.equal(cube[0].color,wing.color);
    assert.ok(avatar.parts.body);const mesh=avatar.parts.root.children[0];mesh.geometry.computeBoundingBox();
    assert.ok(Math.abs(mesh.geometry.boundingBox.max.x-.95)<1e-5);
    const color=new Three.Color(wing.color),colors=mesh.geometry.attributes.color;
    assert.ok(Math.abs(colors.getX(0)-color.r)<1e-6&&Math.abs(colors.getY(0)-color.g)<1e-6&&Math.abs(colors.getZ(0)-color.b)<1e-6);
    avatar.dispose();
  }
});

test('preview hot updates dispose the previous avatar, preserve valid content after invalid input, and remove renderer resources', async () => {
  const source=readFileSync(new URL('../dist/office/avatar-view.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const load=new AsyncFunction('THREE','OrbitControls','mergeGeometries','defaultOfficeAvatar','validateOfficeAvatar','ResizeObserver','requestAnimationFrame','cancelAnimationFrame',`${source}\nreturn createAvatarPreview;`);
  let renderer,observer,controls,nextFrame=0;const frames=new Map();
  const canvas={style:{},setAttribute(){},remove(){this.removed=true;}};
  class Renderer{constructor(){renderer=this;this.domElement=canvas;}setPixelRatio(){}setSize(){}render(scene,camera){this.scene=scene;this.camera=camera;}dispose(){this.disposed=true;}}
  class Controls{constructor(){controls=this;this.target=new Three.Vector3();}update(){}dispose(){this.disposed=true;}}
  class Observer{constructor(){observer=this;}observe(){}disconnect(){this.disconnected=true;}}
  const create=await load({...Three,WebGLRenderer:Renderer},Controls,mergeGeometries,defaultOfficeAvatar,validateOfficeAvatar,Observer,cb=>{frames.set(++nextFrame,cb);return nextFrame;},id=>frames.delete(id));
  const preview=create({clientWidth:300,clientHeight:250,append(){}},defaultOfficeAvatar());
  function draw(){const[id,cb]=frames.entries().next().value;frames.delete(id);cb();}
  draw();const old=renderer.scene.children.find(object=>object.isGroup),mesh=old.children[0].children[0];
  let oldDisposed=0;mesh.geometry.addEventListener('dispose',()=>oldDisposed++);
  preview.update({...defaultOfficeAvatar('agent'),accessory:'cap'});draw();assert.equal(oldDisposed,1);
  const current=renderer.scene.children.find(object=>object.isGroup);
  assert.throws(()=>preview.update({...defaultOfficeAvatar(),height:100}),TypeError);
  assert.equal(renderer.scene.children.find(object=>object.isGroup),current);
  preview.dispose();preview.dispose();assert.equal(frames.size,0);assert.equal(renderer.disposed,true);assert.equal(canvas.removed,true);assert.equal(observer.disconnected,true);assert.equal(controls.disposed,true);
});
