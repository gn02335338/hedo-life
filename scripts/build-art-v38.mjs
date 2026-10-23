// Rebuild all ending images from committed illustrated masters, without
// consulting private photos, game draws, or any player's saved life.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {ENDINGS} from '../dist/endings.js';
import {SCENE_PLATES_V38} from '../dist/illustration-scenes-v38.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const asset=relative=>path.join(root,'dist/assets',relative);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const width=960,height=540;
const roles=Object.freeze({
 system:'#228d8b',ai:'#8b65bd',project:'#d7776b',product:'#ce688a',
 design:'#c14591',bd:'#c69a3e',sales:'#db8c46',mis:'#48a3b9',
 executive:'#6560a2',finance:'#b5a04b',accounting:'#68a68a',hr:'#ce7d7c',admin:'#a08bb8',
});
const families=[...new Set(ENDINGS.map(ending=>ending.id.slice(0,-ending.roleId.length-1)))];

async function record(relative,extra={}){
 const bytes=await fs.readFile(asset(relative)),meta=await sharp(bytes).metadata();
 return {path:`./assets/${relative}`,width:meta.width,height:meta.height,bytes:bytes.length,sha256:digest(bytes),...extra};
}

async function render(ending){
 const family=ending.id.slice(0,-ending.roleId.length-1),role=ending.roleId;
 if(!Object.hasOwn(roles,role)||!families.includes(family))throw new Error(`Unknown artwork mapping: ${ending.id}`);
 const familyIndex=families.indexOf(family),roleIndex=Object.keys(roles).indexOf(role);
 // Keep the central narrative visible. The job-specific illustrated desk is
 // substantial (roughly a third of the picture), not a small badge or filename.
 const side=(familyIndex+roleIndex)%2?'left':'right';
 const propWidth=310+(familyIndex%3)*10;
 const props=await sharp(asset(`role-props/${role}.webp`)).resize(propWidth,null).toBuffer({resolveWithObject:true});
 const left=side==='left'?14:width-props.info.width-14,top=height-props.info.height-5;
 const accent=roles[role];
 const wash=Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="wash" x1="0" y1="0" x2="0" y2="1"><stop offset=".56" stop-color="#15172c" stop-opacity="0"/><stop offset="1" stop-color="#15172c" stop-opacity=".26"/></linearGradient><radialGradient id="light"><stop stop-color="${accent}" stop-opacity=".32"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="960" height="540" fill="url(#wash)"/><ellipse cx="${side==='left'?140:820}" cy="535" rx="360" ry="210" fill="url(#light)"/><path d="M0 537H960" stroke="${accent}" stroke-width="6" opacity=".85"/></svg>`);
 const bytes=await sharp(asset(`ending-scenes/${family}.webp`)).resize(width,height,{fit:'cover',position:'centre'}).composite([{input:wash},{input:props.data,left,top}]).webp({quality:79,effort:5}).toBuffer();
 await fs.writeFile(asset(`endings/${ending.id}.webp`),bytes);
 return {id:ending.id,family,roleId:role,path:`./assets/endings/${ending.id}.webp`,width,height,bytes:bytes.length,sha256:digest(bytes),
  composition:{scene:`./assets/ending-scenes/${family}.webp`,props:`./assets/role-props/${role}.webp`,propSide:side,propWidth,accent}};
}

await fs.mkdir(asset('endings'),{recursive:true});
// Fail before writing a partial release if any illustrated input is missing.
await Promise.all([...families.map(id=>`ending-scenes/${id}.webp`),...Object.keys(roles).map(id=>`role-props/${id}.webp`),...SCENE_PLATES_V38.map(id=>`scenes/${id}.webp`)].map(relative=>fs.access(asset(relative))));
let index=0;const endings=new Array(ENDINGS.length);
async function worker(){while(index<ENDINGS.length){const current=index++;endings[current]=await render(ENDINGS[current]);}}
await Promise.all(Array.from({length:4},worker));
if(new Set(endings.map(image=>image.sha256)).size!==ENDINGS.length)throw new Error('Ending images must be visually distinct exports');
const scenes=await Promise.all(SCENE_PLATES_V38.map(async id=>({id,...await record(`scenes/${id}.webp`)})));
const masters=await Promise.all(families.map(async id=>({id,...await record(`ending-scenes/${id}.webp`)})));
const props=await Promise.all(Object.keys(roles).map(async id=>({id,...await record(`role-props/${id}.webp`)})));
const characterIds=['wing','spencer','rick','hope','erich','jenjen','sonny','kind','jack','meimei','helen','sophie','jonathan','owen','sam','cindy','professor','annie_yu','princess','joyce','janet','captain','zoe','action','hester','simon','james','johnny'];
const portraits=await Promise.all(characterIds.map(async id=>({id,...await record(`${id}.png`),referenceRemake:!['wing','spencer'].includes(id)})));
const manifest={version:38,styleRevision:41,method:'Built-in image_gen illustrations, composed and optimized with Sharp',
 counts:{portraitRemakes:20,preservedPortraits:2,scenePlates:scenes.length,endingMasters:masters.length,jobPropIllustrations:props.length,endingImages:endings.length},
 dimensions:{width,height},privacy:'No original reference photos are included. Locked ending artwork is never rendered or requested by the UI.',
 scenes,masters,props,portraits,endings};
await fs.writeFile(asset('art-v38.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({counts:manifest.counts,endingBytes:endings.reduce((total,image)=>total+image.bytes,0),largestEnding:Math.max(...endings.map(image=>image.bytes)),uniqueEndings:new Set(endings.map(image=>image.sha256)).size}));
