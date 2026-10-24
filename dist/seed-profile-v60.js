// A compact profile keeps all current rules while leaving 88 bits for entropy.
// Published profiles retain their original deterministic rules and witnesses.
export const isRecruitmentV60=value=>/^e39-r(?:6[012356789]|70)-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');

export function recruitmentSeedV60(entropy,kind='normal',profile=60){
 const marker={normal:'n',executive:'n',godson:'s',goddaughter:'d'}[kind];
 if(!marker||![60,61,62,63,65,66,67,68,69,70].includes(profile)||typeof entropy!=='string'||!/^[0-9a-f]{22,}$/i.test(entropy))throw new Error('Invalid recruitment seed input');
 return `e39-r${profile}-${marker}-${entropy.toLowerCase().slice(0,22)}`;
}
