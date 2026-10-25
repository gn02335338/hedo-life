// New scenes belong only to this fresh cohort; published lives stay frozen.
export const isExpansionV65=value=>/^e39-r(?:6[56789]|7[01234])-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
