// Public ferry destinations only. No identity, storage or redirect URL is
// accepted from the other project; both sites keep their own player data.
export const ONEIRA_PORT = Object.freeze({
  id: 'oneira',
  placeId: 'oneira-hub',
  name: 'Oneira',
  harborUrl: 'https://oneirahub.com/harbor?from=moving-island',
});

// This is Alice's external game. Opening it starts a separate experience; the
// public destination never receives our anonymous identity or island progress.
export const OMEGA_CITY_PORT = Object.freeze({
  id: 'omega-city',
  placeId: 'omega-terminal',
  name: '終末之都',
  author: '手遊王愛麗絲',
  gameUrl: 'https://omegacity-life.vercel.app/',
});

export function getOneiraArrival(search = '', hash = '') {
  if (typeof search !== 'string' || typeof hash !== 'string' || hash !== '#oneira') return null;
  const params = new URLSearchParams(search);
  const origins = params.getAll('from');
  if (origins.length !== 1 || origins[0] !== 'oneira' || params.has('duel')) return null;
  return { from: 'oneira', to: 'company' };
}
