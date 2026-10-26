import { displayPersona } from '../persona.js';
import { HIDDEN_PERSONAS_V45 } from '../hidden-encounter-v45.js';

// Island presentation can evolve independently of historical career witnesses.
export function displayIslandPersona(id, { revealHidden = false } = {}) {
  if (id === 'hidden-visitor') return revealHidden ? { ...HIDDEN_PERSONAS_V45[id] } : null;
  const person = displayPersona(id);
  return person && id === 'jack' ? { ...person, image: './assets/jack-sport.webp' } : person;
}
