import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdirSync,openSync,closeSync} from 'node:fs';

// Example: node scripts/simulate-balance-parallel.mjs --runs 1000 --jobs 4
// Historical cohorts can use --dist <checkout>/dist --prefix e8 --label baseline.
const args=Object.fromEntries(process.argv.slice(2).reduce((a,x,i,v)=>{if(x.startsWith('--'))a.push([x.slice(2),v[i+1]]);return a;},[]));
const prefix=args.prefix||'e9',label=args.label||prefix,runs=args.runs||'1000',dist=resolve(args.dist||'dist'),jobs=Number(args.jobs)||4;
const base=resolve(args.out||'artifacts/balance'),shards=resolve(base,`${label}-shards`);mkdirSync(shards,{recursive:true});
const harness=fileURLToPath(new URL('./simulate-balance.mjs',import.meta.url));
const {ROLES}=await import(pathToFileURL(resolve(dist,'roles.js')));
const roles=ROLES.map(r=>r.id);
function execute(argv,log){return new Promise((res,rej)=>{const fd=openSync(log,'w');const p=spawn(process.execPath,[harness,...argv],{stdio:['ignore',fd,fd]});p.on('error',rej);p.on('exit',c=>{closeSync(fd);c===0?res():rej(Error(`Exit ${c}: ${log}`));});});}
let next=0;
await Promise.all(Array.from({length:Math.min(jobs,roles.length)},async()=>{while(next<roles.length){const role=roles[next++];console.log(`start ${role}`);await execute(['--prefix',prefix,'--label',`${label}-${role}`,'--runs',runs,'--dist',dist,'--roles',role,'--out',shards],resolve(shards,`${role}.log`));console.log(`done ${role}`);}}));
await execute(['--prefix',prefix,'--label',label,'--runs',runs,'--dist',dist,'--merge',shards,'--out',base],resolve(base,`${label}.log`));
console.log(`Merged ${roles.length} roles x 4 strategies x ${runs} games at ${resolve(base,`${label}.json`)}`);
