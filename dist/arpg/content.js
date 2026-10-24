// Original Hedo ARPG content. Coordinates use x/z; angle 0 faces toward -z.
export const SPAWN = Object.freeze({ x: 0, z: 10 });
export const WORLD = Object.freeze({
  bounds: { minX: -12, maxX: 12, minZ: -41, maxZ: 16 },
  rooms: [
    { id: 0, name: '下班基地', x: 0, z: 10, width: 12, depth: 12 },
    { id: 1, name: '需求大廳', x: 0, z: 0, width: 24, depth: 12 },
    { id: 2, name: '會議迴廊', x: 0, z: -16, width: 24, depth: 12 },
    { id: 3, name: '績效核心', x: 0, z: -32, width: 24, depth: 18 },
  ],
  corridors: [
    { x: 0, z: 5, width: 6, depth: 4 },
    { x: 0, z: -8, width: 6, depth: 8 },
    { x: 0, z: -23, width: 6, depth: 6 },
  ],
  obstacles: [
    { x: -7, z: 0, width: 2, depth: 3 },
    { x: 7, z: 0, width: 2, depth: 3 },
    { x: -6, z: -16, width: 3, depth: 2 },
    { x: 6, z: -16, width: 3, depth: 2 },
    { x: -8, z: -32, width: 2, depth: 5 },
    { x: 8, z: -32, width: 2, depth: 5 },
  ],
});

export const SKILLS = Object.freeze({
  attack: { name: '鍵盤重擊', cooldown: 0.42, energy: 0, range: 2.7, damage: 1 },
  burst: { name: '需求爆破', cooldown: 4.8, energy: 30, radius: 5.2, damage: 2.1 },
  dash: { name: '準時下班', cooldown: 2.2, energy: 16, distance: 5, duration: 0.16 },
  potion: { name: '續命咖啡', cooldown: 1.2, heal: 0.55, charges: 3 },
});

export const ENEMY_TYPES = Object.freeze({
  slime: { name: '需求史萊姆', color: '#80b89e', maxHp: 46, speed: 2.2, radius: 0.58, attack: 12, xp: 18, gold: 8 },
  wraith: { name: '會議怨靈', color: '#ae9fcb', maxHp: 39, speed: 1.65, radius: 0.5, attack: 11, xp: 22, gold: 10 },
  golem: { name: 'KPI 魔像', color: '#c39b78', maxHp: 100, speed: 1.25, radius: 0.78, attack: 21, xp: 34, gold: 15 },
  boss: { name: '分區領主', color: '#d8b56d', maxHp: 420, speed: 1.55, radius: 1.15, attack: 23, xp: 160, gold: 80 },
});

// Public cast identities and original fantasy encounters; no private research is used.
export const BOSS_PROFILES = Object.freeze({
  sonny: {
    id: 'sonny', displayName: '阿福', title: '腕力守門人', portrait: '/assets/sonny.png',
    intro: '資訊設備先放旁邊。阿福捲起袖子，要用腕力守住第一道需求。',
    phaseTaunts: { normal: '先比腕力，贏了再談下班！', enraged: '披薩還沒送到，不能走！', defeated: '等一下，我只是剛好手滑……披薩分你一片。' },
    skills: [{ id: 'arm-slam', label: '腕力震地', kind: 'circle' }, { id: 'pizza-charge', label: '披薩衝鋒', kind: 'line' }],
    color: '#bc8661', maxHp: 170, speed: 1.8, radius: 0.95, attack: 18, xp: 65, gold: 35,
  },
  meimei: {
    id: 'meimei', displayName: '水蛇', title: '話術編織者', portrait: '/assets/meimei.png',
    intro: '業務簡報翻到下一頁。水蛇把客戶提案編成彈幕，會議還沒有結束。',
    phaseTaunts: { normal: '先聽我把這個合作講完。', enraged: '這個方案，還能再加一點價值！', defeated: '好，這次就當我們談成了。下一場會議改天再約。' },
    skills: [{ id: 'sales-volley', label: '話術彈幕', kind: 'volley' }, { id: 'promise-ring', label: '畫餅圈', kind: 'circle' }],
    color: '#b68ec4', maxHp: 230, speed: 1.65, radius: 0.85, attack: 15, xp: 90, gold: 45,
  },
  wing: {
    id: 'wing', displayName: '翅膀', title: '大餅主宰', portrait: '/assets/wing.png',
    intro: '績效核心的大門敞開。執行長翅膀展開黑金羽翼，把最後一疊需求投向戰場。',
    phaseTaunts: { normal: '這一切，都是為了公司的未來。', enraged: '開始加碼！需求再加一倍，今天一定要完成！', defeated: '這一輪……准你準時下班。' },
    skills: [{ id: 'requirement-bombard', label: '需求轟炸', kind: 'circle' }, { id: 'pie-crush', label: '大餅壓頂', kind: 'circle' }],
    color: '#d8b56d', maxHp: 420, speed: 1.4, radius: 1.2, attack: 23, xp: 160, gold: 80,
  },
});

export const RARITIES = Object.freeze({
  common: { name: '常見', color: '#c4cec8', multiplier: 1 },
  rare: { name: '稀有', color: '#79bcdf', multiplier: 1.65 },
  epic: { name: '史詩', color: '#c3a2e4', multiplier: 2.4 },
});

export const ITEM_BASES = Object.freeze([
  { id: 'keyboard', name: '機械鍵盤', slot: 'weapon', attack: 5, armor: 0, maxHp: 0, energyRegen: 0, description: '每一次敲擊，都有明確回應。' },
  { id: 'mug', name: '不鏽鋼馬克杯', slot: 'weapon', attack: 7, armor: 0, maxHp: 0, energyRegen: 0, description: '握穩把手，需求也能被打退。' },
  { id: 'hoodie', name: '工程師連帽衣', slot: 'armor', attack: 0, armor: 3, maxHp: 12, energyRegen: 0, description: '擋住冷氣，也擋住幾點傷害。' },
  { id: 'helmet', name: '專案安全帽', slot: 'armor', attack: 0, armor: 5, maxHp: 7, energyRegen: 0, description: '面對突如其來的需求，先保護自己。' },
  { id: 'badge', name: '準時下班識別證', slot: 'charm', attack: 2, armor: 0, maxHp: 6, energyRegen: 0.6, description: '提醒自己，今天的工作總有結束的時候。' },
  { id: 'lanyard', name: '防會議掛繩', slot: 'charm', attack: 0, armor: 1, maxHp: 10, energyRegen: 1, description: '掛上之後，思路恢復得稍微快一點。' },
]);

export const ENCOUNTERS = Object.freeze([
  { type: 'slime', x: -2.6, z: 1.1, room: 1 },
  { type: 'slime', x: 2.5, z: -1.3, room: 1 },
  { type: 'wraith', x: -4.2, z: -3.5, room: 1 },
  { type: 'boss', bossId: 'sonny', x: 0, z: -3.6, room: 1 },
  { type: 'golem', x: 0, z: -14.2, room: 2 },
  { type: 'wraith', x: -3.7, z: -17.4, room: 2 },
  { type: 'slime', x: 3.7, z: -17.4, room: 2 },
  { type: 'boss', bossId: 'meimei', x: 0, z: -19, room: 2 },
  { type: 'golem', x: -3.8, z: -29.2, room: 3 },
  { type: 'wraith', x: 3.7, z: -31.6, room: 3 },
  { type: 'boss', bossId: 'wing', x: 0, z: -35, room: 3 },
]);
