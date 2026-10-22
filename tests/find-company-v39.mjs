import {writeFile} from 'node:fs/promises';
import {simulate} from './find-routes-v3.mjs';
import {ROLES} from '../dist/roles.js';
import {COMPANY_ENDING_IDS_V32} from '../dist/company-v32.js';
import {COMPANY_ENDING_IDS_V39} from '../dist/company-v39.js';

// This finder may inspect its own committed-choice previews to locate proof.
// It never injects resources, RNG, history or contexts into an archived life.
const routes=[],missing=[],attempts=Number(process.argv[2]||1000);
for(const role of ROLES){
 for(const target of [...COMPANY_ENDING_IDS_V32,...COMPANY_ENDING_IDS_V39]){
  let found;
  for(let attempt=0;attempt<attempts&&!found;attempt++){
   const candidate=simulate(role.id,target,attempt,{seedPrefix:'e39'});
   if(candidate.run.endingId===`${target}-${role.id}`)found=candidate.route;
  }
  if(found)routes.push(found);else missing.push(`${target}-${role.id}`);
 }
 console.log(`${role.id}: ${routes.length} routes, ${missing.length} missing`);
}
await writeFile(new URL('./fixtures/company-e39-routes.json',import.meta.url),JSON.stringify({method:'Natural e39 seeds and canonical actions only, ten prior company futures plus six non-success/operating finales per occupation.',routes,missing},null,2)+'\n');
if(missing.length)process.exitCode=1;
