// Character-book illustrations translated into the island's shared round-head,
// dot-eye, short-limb style. These are drawing traits, not portrait textures.
// Public artwork supplies the hair, clothing and signature accessories only.
const look = (traits) => Object.freeze({
  skin: '#e9b48c', hair: '#4b403b', hairStyle: 'short',
  shirt: '#849699', clothing: 'shirt', inner: '#f5edda',
  trousers: '#405055', glasses: 'none', tie: null,
  ...traits, accessories: Object.freeze([...(traits.accessories || [])]),
});

export const ISLAND_VISITOR_LOOK = look({
  skin: '#e9b48c', hair: '#5c4337', hairStyle: 'short',
  shirt: '#ccaa65', clothing: 'cardigan', inner: '#f5edda',
  trousers: '#3d4d50', accessories: ['hat', 'backpack'],
});

export const ISLAND_CHARACTER_LOOKS = Object.freeze({
  wing: look({ hair: '#493a38', hairStyle: 'swept', shirt: '#bd718b', clothing: 'polo', skin: '#e9b48c', leftLegRatio: .5, accessories: ['cane'] }),
  spencer: look({ hair: '#385761', hairStyle: 'swept', shirt: '#c27996', clothing: 'polo', glasses: 'round', skin: '#efbf9c' }),
  erich: look({ hair: '#3d3d42', hairStyle: 'swept', shirt: '#465671', clothing: 'blazer', inner: '#c9bdd6', glasses: 'round', tie: '#99576e', accessories: ['book'] }),
  sonny: look({ hair: '#3e3b40', hairStyle: 'short', shirt: '#ab8c71', clothing: 'tee', glasses: 'square', accessories: ['bowl'], skin: '#e5ad83' }),
  jenjen: look({ hair: '#514346', hairStyle: 'bob', shirt: '#707180', clothing: 'blazer', inner: '#414047', accessories: ['clipboard', 'keys'] }),
  rick: look({ hair: '#674943', hairStyle: 'short', shirt: '#bc6f90', clothing: 'polo', glasses: 'square', accessories: ['phone', 'crown'] }),
  kind: look({ hair: '#443d42', hairStyle: 'short', shirt: '#985b7c', clothing: 'shirt', glasses: 'square', accessories: ['card'], skin: '#e7b28e' }),
  hope: look({ hair: '#654744', hairStyle: 'bob', shirt: '#627daf', clothing: 'blazer', inner: '#45434b', glasses: 'round', accessories: ['clipboard'] }),
  jack: look({ hair: '#303038', hairStyle: 'short', shirt: '#303640', clothing: 'tee', inner: '#deb9ba', trousers: '#747b80', accessories: ['sport-emblem'], sportShoes: true, skin: '#eab68c' }),
  meimei: look({ hair: '#6a4a41', hairStyle: 'bob', shirt: '#eee1cf', clothing: 'shirt', inner: '#e8c8c2', trousers: '#46434f', accessories: ['mic', 'book'] }),
  helen: look({ hair: '#463b41', hairStyle: 'long', shirt: '#bd7196', clothing: 'polo', inner: '#f3eadf', glasses: 'square', accessories: ['mask', 'book'] }),
  sophie: look({ hair: '#795441', hairStyle: 'long', shirt: '#c7ae86', clothing: 'blazer', inner: '#eee1bc', accessories: ['coffee', 'clipboard'] }),
  jonathan: look({ hair: '#353641', hairStyle: 'short', shirt: '#44434c', clothing: 'tee', glasses: 'square', accessories: ['badge'], skin: '#e9b88e' }),
  owen: look({ hair: '#57423d', hairStyle: 'swept', shirt: '#484c4b', clothing: 'shirt', inner: '#434549', trousers: '#a08c78', glasses: 'square', accessories: ['sunglasses', 'keys'] }),
  sam: look({ hair: '#8e6650', hairStyle: 'crop', shirt: '#555764', clothing: 'cardigan', inner: '#b4b9bd', glasses: 'square', accessories: ['tablet', 'snack'], skin: '#e5b28d' }),
  cindy: look({ hair: '#775243', hairStyle: 'bun', shirt: '#c8849e', clothing: 'blazer', inner: '#4c4c52', accessories: ['clipboard'] }),
  professor: look({ hair: '#49414a', hairStyle: 'bald', shirt: '#eee9de', clothing: 'polo', inner: '#9e5e74', glasses: 'square', accessories: ['book', 'hourglass'], skin: '#ebbb92' }),
  annie_yu: look({ hair: '#604842', hairStyle: 'bob', shirt: '#e7d8b6', clothing: 'tee', trousers: '#454653', accessories: ['book', 'card'] }),
  princess: look({ hair: '#443c44', hairStyle: 'long', shirt: '#665064', clothing: 'tee', trousers: '#454854', accessories: ['laptop', 'necklace'] }),
  joyce: look({ hair: '#3d3542', hairStyle: 'long', shirt: '#eee0ca', clothing: 'shirt', trousers: '#be994d', tie: '#45414b', accessories: ['mic', 'clipboard'] }),
  janet: look({ hair: '#41404a', hairStyle: 'long', shirt: '#4d7270', clothing: 'shirt', inner: '#b86e5b', glasses: 'square', accessories: ['calculator', 'envelope'], skin: '#e8b28c' }),
  captain: look({ hair: '#383944', hairStyle: 'long', shirt: '#e3e7df', clothing: 'shirt', trousers: '#494957', accessories: ['book', 'boat'] }),
  zoe: look({ hair: '#353943', hairStyle: 'bob', shirt: '#434954', clothing: 'tee', inner: '#e5e7dc', accessories: ['mic'], skin: '#edb68e' }),
  action: look({ hair: '#404047', hairStyle: 'crop', shirt: '#be7b99', clothing: 'polo', accessories: ['pin'], skin: '#e7ae84' }),
  hester: look({ hair: '#87634e', hairStyle: 'long', shirt: '#53545b', clothing: 'vest', inner: '#706371', accessories: ['book'] }),
  simon: look({ hair: '#353943', hairStyle: 'swept', shirt: '#4b6380', clothing: 'blazer', inner: '#bdcfdf', glasses: 'square', accessories: ['tablet'] }),
  james: look({ hair: '#3b3b40', hairStyle: 'short', shirt: '#4a5264', clothing: 'blazer', inner: '#b75b69', accessories: ['mic', 'bag'], skin: '#e4ad85' }),
  johnny: look({ hair: '#35373e', hairStyle: 'crop', shirt: '#557fa1', clothing: 'shirt', inner: '#44464d', accessories: ['clipboard'], skin: '#e7b18c' }),
  alice: look({ hair: '#886145', hairStyle: 'long', shirt: '#bc874f', clothing: 'tee', accessories: ['phone', 'cards', 'bag'], skin: '#efba90' }),
  wine: look({ hair: '#55473f', hairStyle: 'swept', shirt: '#d5a2aa', clothing: 'shirt', glasses: 'square', accessories: ['book', 'can'], skin: '#e8b48a' }),
  peter: look({ hair: '#655044', hairStyle: 'swept', shirt: '#474955', clothing: 'tee', glasses: 'square', accessories: ['gamepad', 'badge'], skin: '#efbf96' }),
  tony: look({ hair: '#423f3e', hairStyle: 'short', shirt: '#485e85', clothing: 'tee', glasses: 'square', accessories: ['cigarette', 'coffee'], skin: '#e6af86' }),
  henry: look({ hair: '#55483e', hairStyle: 'swept', shirt: '#8b939b', clothing: 'polo', inner: '#b85d58', accessories: ['book'], skin: '#e0a983' }),
  mia: look({ hair: '#70513e', hairStyle: 'bob', shirt: '#53617d', clothing: 'shirt', trousers: '#dccdaf', accessories: ['clipboard'], skin: '#edb993' }),
});

// Public visitor artwork translated into the same island doll proportions.
// Keep this optional encounter out of the ordinary cast/resident roster.
export const HIDDEN_CHARACTER_LOOK = look({
  skin: '#eab58f', hair: '#3e3741', hairStyle: 'long',
  shirt: '#405473', clothing: 'tee', inner: '#c76877',
  trousers: '#4e515b', glasses: 'square', accessories: ['cap', 'phone', 'bowl'],
});

export function getIslandCharacterLook(id) {
  if (id === 'hidden-visitor') return HIDDEN_CHARACTER_LOOK;
  return Object.hasOwn(ISLAND_CHARACTER_LOOKS, id) ? ISLAND_CHARACTER_LOOKS[id] : ISLAND_VISITOR_LOOK;
}
