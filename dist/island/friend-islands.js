// Public ferry destinations only. No identity, storage or redirect URL is
// accepted from the other project; both sites keep their own player data.
export const ONEIRA_PORT = Object.freeze({
  id: 'oneira',
  placeId: 'oneira-hub',
  name: 'Oneira',
  harborUrl: 'https://oneirahub.com/harbor?from=moving-island',
});

export function getOneiraArrival(search = '', hash = '') {
  if (typeof search !== 'string' || typeof hash !== 'string' || hash !== '#oneira') return null;
  const params = new URLSearchParams(search);
  const origins = params.getAll('from');
  if (origins.length !== 1 || origins[0] !== 'oneira' || params.has('duel')) return null;
  return { from: 'oneira', to: 'company' };
}
