// New outings restore the body as well as the mood. Earlier lives keep their
// published recovery and RNG so saved results remain exactly replayable.
export const isKindRecoveryV70=value=>/^e39-r70-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
export const KIND_RECOVERY_ENERGY_V70=45;
