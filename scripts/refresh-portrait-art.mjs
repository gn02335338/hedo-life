// Refresh the seventeen committed portrait files without rebuilding ending art.
// Paths are fixed to public assets; no original reference photos are consulted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

if(process.argv.length!==2)throw new Error('This command takes no arguments; it only reads the committed public portraits.');
const assets=new URL('../dist/assets/',import.meta.url);
const manifestURL=new URL('art-v38.json',assets);
const raw=await fs.readFile(manifestURL,'utf8');
const previous=JSON.parse(raw);
const ids=['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack','meimei','helen','sophie','jonathan','owen','sam','cindy','professor'];
assert.deepEqual(previous.portraits.map(item=>item.id),ids,'Unexpected portrait roster or order');

const portraits=await Promise.all(previous.portraits.map(async record=>{
 assert.equal(record.path,`./assets/${record.id}.png`,'Portrait paths must remain inside public assets');
 const bytes=await fs.readFile(new URL(`${record.id}.png`,assets));
 const metadata=await sharp(bytes).metadata();
 assert.equal(metadata.format,'png',record.id);
 assert.equal(metadata.hasAlpha,true,record.id);
 if(!['wing','spencer'].includes(record.id)){
  assert.ok(metadata.width<=600&&metadata.height<=760,`${record.id}: oversized portrait`);
  assert.ok(bytes.length<650000,`${record.id}: portrait exceeds the byte budget`);
 }
 const sha256=createHash('sha256').update(bytes).digest('hex');
 // These two references are intentionally retained, not re-exported.
 if(['wing','spencer'].includes(record.id))assert.equal(sha256,record.sha256,`${record.id}: preserved executive portrait changed`);
 return {...record,width:metadata.width,height:metadata.height,bytes:bytes.length,sha256};
}));

// Replace just the top-level portrait array. Everything before and after this
// array, including all 805 ending records, stays byte-for-byte unchanged.
const matches=[...raw.matchAll(/^([ \t]*)"portraits": (\[)/gm)];
assert.equal(matches.length,1,'Expected exactly one top-level portrait array');
const match=matches[0];
const start=match.index+match[0].length-1;
let depth=0,inString=false,escaped=false,end=-1;
for(let index=start;index<raw.length;index++){
 const character=raw[index];
 if(inString){
  if(escaped)escaped=false;
  else if(character==='\\')escaped=true;
  else if(character==='"')inString=false;
 }else if(character==='"')inString=true;
 else if(character==='[')depth++;
 else if(character===']'&&--depth===0){end=index+1;break;}
}
assert.ok(end>start,'Unterminated portrait array');
assert.deepEqual(JSON.parse(raw.slice(start,end)),previous.portraits);
const replacement=JSON.stringify(portraits,null,2).replaceAll('\n',`\n${match[1]}`);
const updatedRaw=raw.slice(0,start)+replacement+raw.slice(end);
const updated=JSON.parse(updatedRaw);
assert.deepEqual({...updated,portraits:previous.portraits},previous,'Only portrait metadata may change');
for(let index=0;index<portraits.length;index++){
 const strip=({width,height,bytes,sha256,...other})=>other;
 assert.deepEqual(strip(updated.portraits[index]),strip(previous.portraits[index]));
}
await fs.writeFile(manifestURL,updatedRaw);
console.log(JSON.stringify({portraits:portraits.length,changed:portraits.filter((record,index)=>record.sha256!==previous.portraits[index].sha256).map(record=>record.id),otherArtwork:'unchanged'}));
