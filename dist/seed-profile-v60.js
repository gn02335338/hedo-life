// A compact profile keeps all current rules while leaving 88 bits for entropy.
// Published profiles retain their original deterministic rules and witnesses.
export const isRecruitmentV60=value=>/^e39-r60-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');

export function recruitmentSeedV60(entropy,kind='normal'){
 const marker={normal:'n',executive:'n',godson:'s',goddaughter:'d'}[kind];
 if(!marker||typeof entropy!=='string'||!/^[0-9a-f]{22,}$/i.test(entropy))throw new Error('Invalid recruitment seed input');
 return `e39-r60-${marker}-${entropy.toLowerCase().slice(0,22)}`;
}
