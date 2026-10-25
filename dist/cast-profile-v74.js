// New cast scenes are opt-in through a fresh profile; published replays stay deterministic.
export const isCastV74=value=>/^e39-r74-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
