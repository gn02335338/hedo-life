// Fresh lives can leave a scene explicitly. Earlier proofs keep their rules.
export const isParticipationV63=value=>/^e39-r(?:6[356789]|70)-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
