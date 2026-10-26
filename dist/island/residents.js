import { LAYOUT } from './navigation.js';

export const OUTFITS = Object.freeze([
  { id:'teal', label:'苔綠', color:'#6b9e91' },
  { id:'amber', label:'暖黃', color:'#dfb966' },
  { id:'coral', label:'珊瑚橘', color:'#d77c59' },
  { id:'lavender', label:'薰衣草紫', color:'#b49abb' },
  { id:'navy', label:'海軍藍', color:'#3b5966' },
  { id:'cream', label:'奶油白', color:'#fff4dd' },
].map(Object.freeze));

// Residency keeps its original application schema; the new facilities are visits.
const districts = new Set(['lobby', 'lab', 'meeting', 'hr', 'finance', 'cafe', 'plaza', 'court', 'harbor']);
const outfits = new Set(OUTFITS.map(({id})=>id));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicFields = ['districtId','greeting','id','introduction','nickname','outfit','slot'].sort().join(',');
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype,null].includes(Object.getPrototypeOf(value));
function text(value,min,max) {
  if(typeof value !== 'string' || value.length>max*4) return null;
  const normalized=value.normalize('NFKC').trim();
  const length=[...normalized].length;
  // Match the API's plainText rules, including checking controls before trim.
  if(length<min || length>max || /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff<>]/u.test(value) || /[<>]/u.test(normalized)) return null;
  if(/(?:[a-z][a-z0-9+.-]*:\/\/|https?:|ftp:|www\.|mailto:|tel:|@|(?:[a-z0-9-]+\.)+[a-z]{2,63}\b)/iu.test(normalized)
    || /(?:\+?\d[\d ().-]{6,}\d)/u.test(normalized)
    || /\b(?:line|telegram|wechat|discord|instagram|ig|facebook|fb|whatsapp)\s*(?:id|帳號|账号)?\s*[:=@]\s*\S+/iu.test(normalized)
    || /(?:電話|手机|手機|電郵|邮箱|信箱|聯絡方式|联系方式|帳號|账号)\s*[:=]\s*\S+/u.test(normalized)
    || /[縣市].{0,12}[區鄉鎮].{0,16}[路街].{0,10}\d+號/u.test(normalized)) return null;
  return normalized;
}

/** Only the approved public response shape is accepted. One malformed or
 * duplicate record rejects the whole roster; private/review fields never pass
 * through to rendering. This validation does not itself grant approval.
 */
export function normalizeResidents(payload) {
  if(!plainObject(payload) || Object.keys(payload).sort().join(',')!=='residents,version'
    || payload.version!==1 || !Array.isArray(payload.residents) || payload.residents.length>27) return [];
  const ids=new Set(),slots=new Set(),result=[];
  for(const row of payload.residents) {
    if(!plainObject(row) || Object.keys(row).sort().join(',')!==publicFields
      || typeof row.id!=='string' || !uuid.test(row.id) || !districts.has(row.districtId)
      || !outfits.has(row.outfit) || !Number.isInteger(row.slot) || row.slot<0 || row.slot>2) return [];
    const nickname=text(row.nickname,2,16),greeting=text(row.greeting,2,80),introduction=text(row.introduction,10,240);
    if(nickname===null || greeting===null || introduction===null) return [];
    const id=row.id.toLowerCase(),slotKey=`${row.districtId}:${row.slot}`;
    if(ids.has(id)||slots.has(slotKey)) return [];
    ids.add(id);slots.add(slotKey);
    result.push(Object.freeze({id,nickname,districtId:row.districtId,outfit:row.outfit,greeting,introduction,slot:row.slot}));
  }
  return result;
}

// Three deliberately separate exterior spots per island. Coordinates are shared
// with collision and reachability checks, never supplied by application text.
const localPositions = {
  lobby:[[-1.45,2.7],[1.25,2.7],[2.65,-.65]],
  lab:[[-1.3,2.7],[1.05,2.85],[-2.4,1.1]],
  meeting:[[-1.5,2.5],[.3,2.6],[2.9,-.45]],
  hr:[[-1.3,2.9],[.2,1.8],[2.7,-.6]],
  finance:[[-1.35,2.65],[2.7,-.2],[-2.3,-.65]],
  cafe:[[-1.1,2.95],[.25,1.8],[2.7,-1.1]],
  plaza:[[-1.8,2.95],[1.1,2.95],[-2.45,1]],
  court:[[-1.5,2.95],[1.05,2.95],[2.9,-.3]],
  harbor:[[-2.3,1.5],[-1.25,2.7],[2.45,-1.1]],
};
export const RESIDENT_POSITIONS = Object.freeze(Object.fromEntries(LAYOUT.filter(district => districts.has(district.id)).map(district => [district.id,
  Object.freeze(localPositions[district.id].map(([x,z])=>Object.freeze({x:district.x+x,z:district.z+z}))),
])));
export const RESIDENT_RADIUS = .21;
export function residentObstacles(residents) {
  return residents.filter(resident => RESIDENT_POSITIONS[resident.districtId]?.[resident.slot])
    .map(resident=>({...RESIDENT_POSITIONS[resident.districtId][resident.slot],radius:RESIDENT_RADIUS}));
}
