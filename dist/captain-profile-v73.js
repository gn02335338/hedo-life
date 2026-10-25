// Gender belongs to the rolled character, never to the anonymous player.
export const isCaptainVoyageV73=value=>/^e39-r7[34]-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
