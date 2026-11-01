// Shared avatar data only: no browser globals, credentials, URLs or executable assets.
export const OFFICE_AVATAR_PRESETS = Object.freeze(['human', 'robot', 'cat', 'voxel']);
export const OFFICE_AVATAR_HAIR_STYLES = Object.freeze(['none', 'short', 'long', 'mohawk']);
export const OFFICE_AVATAR_ACCESSORIES = Object.freeze(['none', 'glasses', 'headphones', 'cap']);
export const OFFICE_AVATAR_LIMITS = Object.freeze({ maxVoxels: 96, height: [.7, 1.5], width: [.65, 1.4], headSize: [.7, 1.5], horizontalExtent: 1, verticalExtent: 2.5, voxelSize: [.04, 1.5] });
const colorSchema = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', maxLength: 7 };
const bounded = (minimum, maximum) => ({ type: 'number', minimum, maximum });
const voxelSchema = { type: 'object', additionalProperties: false, required: ['x', 'y', 'z', 'w', 'h', 'd', 'color'], properties: {
  x: bounded(-1, 1), y: bounded(0, 2.5), z: bounded(-1, 1), w: bounded(.04, 1.5), h: bounded(.04, 1.5), d: bounded(.04, 1.5), color: colorSchema,
} };
export const OFFICE_AVATAR_SCHEMA = { type: 'object', additionalProperties: false,
  required: ['version', 'preset', 'bodyColor', 'skinColor', 'hairColor', 'accentColor', 'height', 'width', 'headSize', 'hairStyle', 'accessory', 'voxels'],
  properties: { version: { type: 'integer', const: 1 }, preset: { type: 'string', enum: OFFICE_AVATAR_PRESETS }, bodyColor: colorSchema, skinColor: colorSchema, hairColor: colorSchema, accentColor: colorSchema,
    height: bounded(.7, 1.5), width: bounded(.65, 1.4), headSize: bounded(.7, 1.5), hairStyle: { type: 'string', enum: OFFICE_AVATAR_HAIR_STYLES }, accessory: { type: 'string', enum: OFFICE_AVATAR_ACCESSORIES },
    voxels: { type: 'array', maxItems: OFFICE_AVATAR_LIMITS.maxVoxels, items: voxelSchema },
  },
};
export function defaultOfficeAvatar(kind = 'human') {
  return { version: 1, preset: kind === 'agent' ? 'robot' : 'human', bodyColor: kind === 'agent' ? '#7185a6' : '#79a68d', skinColor: '#e5b693', hairColor: '#454641', accentColor: '#b6d5be', height: 1, width: 1, headSize: 1, hairStyle: kind === 'agent' ? 'none' : 'short', accessory: 'none', voxels: [] };
}
const invalid = () => { throw new TypeError('角色外觀格式無效，請確認色碼、比例與方塊範圍。'); };
function object(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== required.length || required.some(key => !Object.hasOwn(value, key))) invalid();
}
function color(value) { if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) invalid(); return value.toLowerCase(); }
function number(value, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) invalid();
  return Math.round(value * 1000) / 1000;
}
export function validateOfficeAvatar(input) {
  object(input, OFFICE_AVATAR_SCHEMA.required);
  if (input.version !== 1 || !OFFICE_AVATAR_PRESETS.includes(input.preset) || !OFFICE_AVATAR_HAIR_STYLES.includes(input.hairStyle) || !OFFICE_AVATAR_ACCESSORIES.includes(input.accessory) || !Array.isArray(input.voxels) || input.voxels.length > OFFICE_AVATAR_LIMITS.maxVoxels) invalid();
  const avatar = { version: 1, preset: input.preset, bodyColor: color(input.bodyColor), skinColor: color(input.skinColor), hairColor: color(input.hairColor), accentColor: color(input.accentColor),
    height: number(input.height, .7, 1.5), width: number(input.width, .65, 1.4), headSize: number(input.headSize, .7, 1.5), hairStyle: input.hairStyle, accessory: input.accessory,
    voxels: input.voxels.map(box => {
      object(box, voxelSchema.required);
      const row = { x: number(box.x, -1, 1), y: number(box.y, 0, 2.5), z: number(box.z, -1, 1), w: number(box.w, .04, 1.5), h: number(box.h, .04, 1.5), d: number(box.d, .04, 1.5), color: color(box.color) };
      if (Math.abs(row.x) + row.w / 2 > 1 || Math.abs(row.z) + row.d / 2 > 1 || row.y - row.h / 2 < 0 || row.y + row.h / 2 > 2.5) invalid();
      return row;
    }),
  };
  return avatar;
}
