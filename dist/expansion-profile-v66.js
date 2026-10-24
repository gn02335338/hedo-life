// Fresh cast stories never enter a published cohort's deterministic deck.
export const isExpansionV66=value=>/^e39-r(?:6[6789]|7[01])-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
