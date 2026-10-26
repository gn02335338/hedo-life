import { displayPersona } from '../persona.js';

// Island presentation can evolve independently of historical career witnesses.
export function displayIslandPersona(id) {
  const person = displayPersona(id);
  return person && id === 'jack' ? { ...person, image: './assets/jack-sport.webp' } : person;
}
