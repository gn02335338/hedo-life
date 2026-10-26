// Stable district identities, separated into three sea regions. No sea route is
// part of the walking surface; the same ports drive UI, boats and NPC commutes.
export const REGIONS = Object.freeze({
  company: Object.freeze({ id: 'company', name: '公司本島', subtitle: '上班的七個生活圈', districts: Object.freeze(['lobby','lab','meeting','hr','finance','cafe','plaza']), center: Object.freeze({x:0,z:0}) }),
  life: Object.freeze({ id: 'life', name: '下班生活島', subtitle: '球場、居酒屋、醫院與警局', districts: Object.freeze(['court','harbor','hospital','police']), center: Object.freeze({x:51.5,z:.5}) }),
  exile: Object.freeze({ id: 'exile', name: '遠海流放島', subtitle: '看門值班亭與冷宮', districts: Object.freeze(['exile']), center: Object.freeze({x:-50,z:-28}) }),
});
const districtRegions = new Map(Object.values(REGIONS).flatMap(region => region.districts.map(id => [id, region.id])));
export function getRegionForDistrict(id) { return districtRegions.get(id) || null; }
const dock = (regionId, districtId, name, x, z, seaX, seaZ) => Object.freeze({ regionId, districtId, name, position: Object.freeze({x,z}), landing: Object.freeze({x,z}), sea: Object.freeze({x:seaX,z:seaZ}) });
export const DOCKS = Object.freeze({
  company: dock('company','cafe','本島南岸碼頭',-8.5,12.6,-8.5,16.5),
  life: dock('life','harbor','生活島渡船口',57,8.1,57,13),
  exile: dock('exile','exile','流放島孤燈碼頭',-50,-24.9,-50,-21),
});
export const FERRY_SPEED = 8;
export const PLAYER_SAIL_SECONDS = 2.8;
const middle = {
  'company:life': [{x:25,z:17}],
  'company:exile': [{x:-23,z:18},{x:-29,z:-18}],
  'life:exile': [{x:29,z:19},{x:-23,z:18},{x:-29,z:-18}],
};
export function getFerryRoute(from, to) {
  if (!Object.hasOwn(DOCKS,from) || !Object.hasOwn(DOCKS,to) || from===to) return null;
  const direct=middle[`${from}:${to}`], reverse=middle[`${to}:${from}`];
  const points=direct || (reverse ? [...reverse].reverse() : []);
  return [{...DOCKS[from].position},{...DOCKS[from].sea},...points.map(p=>({...p})),{...DOCKS[to].sea},{...DOCKS[to].position}];
}
export function ferryRouteLength(points) { return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.z-points[i].z),0); }
export function ferryPoint(points, distance) {
  let remaining=Math.max(0,distance);
  for(let i=1;i<points.length;i++) { const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z); if(remaining<=length || i===points.length-1) {const t=Math.min(1,length?remaining/length:1);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(b.x-a.x,b.z-a.z)};}remaining-=length; }
  return {...points.at(-1),heading:0};
}
