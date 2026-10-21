import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {ENDINGS} from '../dist/endings.js';
import {SCENE_PLATES_V38} from '../dist/illustration-scenes-v38.js';

const assets=new URL('../dist/assets/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('art-v38.json',assets),'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const file=relative=>new URL(relative.replace(/^\.\/assets\//,''),assets);

test('every ending has a distinct, decoded, bounded image matching the shipped manifest',async()=>{
 assert.equal(manifest.endings.length,ENDINGS.length);
 assert.equal(manifest.endings.length,805);
 const disk=(await readdir(new URL('endings/',assets))).filter(name=>name.endsWith('.webp')).sort();
 assert.deepEqual(disk,ENDINGS.map(ending=>`${ending.id}.webp`).sort());
 const records=new Map(manifest.endings.map(item=>[item.id,item])),hashes=new Set();
 for(const ending of ENDINGS){
  const record=records.get(ending.id);assert.ok(record,ending.id);
  assert.equal(record.family,ending.family);assert.equal(record.roleId,ending.roleId);
  assert.equal(record.path,`./assets/endings/${ending.id}.webp`);
  assert.equal(record.composition.props,`./assets/role-props/${ending.roleId}.webp`);
  assert.ok(record.composition.propWidth>=300,'job artwork must be substantial');
  const bytes=await readFile(file(record.path)),meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'webp');assert.equal(meta.width,960);assert.equal(meta.height,540);
  assert.equal(bytes.length,record.bytes);assert.ok(bytes.length<240000,ending.id);
  assert.equal(hash(bytes),record.sha256);hashes.add(record.sha256);
 }
 assert.equal(hashes.size,805,'no filename-only duplicate artwork');
});

test('all 40 neutral scenes, 62 narrative masters and 13 job illustrations ship with verified hashes',async()=>{
 assert.deepEqual(manifest.scenes.map(item=>item.id).sort(),[...SCENE_PLATES_V38].sort());
 assert.equal(manifest.masters.length,62);assert.equal(manifest.props.length,13);
 const records=[...manifest.scenes,...manifest.masters,...manifest.props];
 for(const record of records){
  const bytes=await readFile(file(record.path)),meta=await sharp(bytes).metadata();
  assert.equal(hash(bytes),record.sha256);assert.equal(meta.format,'webp');
  assert.equal(meta.width,record.width);assert.equal(meta.height,record.height);
  assert.ok(bytes.length<300000,record.path);
  if(record.path.includes('/role-props/'))assert.equal(meta.hasAlpha,true,record.path);
 }
 assert.equal(new Set(records.map(record=>record.sha256)).size,records.length);
});

test('15 supplied-photo remakes have alpha and bounded size; the 2 original executive portraits stay unchanged',async()=>{
 assert.equal(manifest.portraits.length,17);
 assert.equal(manifest.portraits.filter(item=>item.referenceRemake).length,15);
 const originals={wing:'970d74ebddbfee57276abce482f93a80f021556f3a7c6a76b5a2ace37b4d3082',spencer:'3bccde30cfac000dd3e30c1789c30f01f75e266e90b7cabbd4289e7819537dc3'};
 for(const record of manifest.portraits){
  const bytes=await readFile(file(record.path)),meta=await sharp(bytes).metadata();
  assert.equal(hash(bytes),record.sha256);assert.equal(meta.format,'png');assert.equal(meta.hasAlpha,true);
  if(Object.hasOwn(originals,record.id))assert.equal(record.sha256,originals[record.id]);
  else{assert.ok(meta.width<=600&&meta.height<=760,record.id);assert.ok(bytes.length<650000,record.id);}
 }
});

test('public artwork metadata contains no original local reference paths or embedded image payloads',async()=>{
 const raw=await readFile(new URL('art-v38.json',assets),'utf8');
 assert.doesNotMatch(raw,/\/Users\/|Downloads|portraits-v38-originals|data:image|base64|圖片\.zip/);
 assert.equal(manifest.counts.endingImages,805);
});
