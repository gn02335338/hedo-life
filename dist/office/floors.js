// Shared public office layout. Keep this module static and browser-independent
// so the Worker and the client validate the same numeric floor identifiers.
export const DEFAULT_OFFICE_FLOOR = 1;

export const OFFICE_FLOORS = Object.freeze([
  { id: 1, name: '接待與共享', department: '訪客接待與共享空間', description: '從一樓報到，在交誼區碰見暫時休息的各部門同事。', color: '#9aab8b' },
  { id: 2, name: '人資行政', department: '人資、行政與員工活動', description: '確認報到、招募與活動安排，讓大家知道下一步找誰。', color: '#bd9a8c' },
  { id: 3, name: '財會法務稽核', department: '財務、會計、法務與稽核', description: '核對預算、文件與紀錄，把需要確認的條件留清楚。', color: '#a8a1bf' },
  { id: 4, name: '業務商務開發', department: '業務與商務開發', description: '跟進客戶、整理合作條件，替提案找到能繼續做的下一步。', color: '#84a6aa' },
  { id: 5, name: '產品與專案', department: '產品、設計與專案管理', description: '把需求、畫面和時程放在一起，確認這一版要完成什麼。', color: '#c7a268' },
  { id: 6, name: '研發與資料', department: '研發、資訊系統與資料', description: '寫程式、跑測試、查資料，也替下一位接手的人留下線索。', color: '#729d8a' },
  { id: 7, name: '經營與顧問', department: '經營管理與顧問', description: '討論公司方向與研究問題，將成果和待決事項帶進主管室。', color: '#8c91b6' },
].map(floor => Object.freeze(floor)));

export function isOfficeFloor(value) {
  return Number.isInteger(value) && value >= 1 && value <= OFFICE_FLOORS.length;
}

export function getOfficeFloor(value) {
  return isOfficeFloor(value) ? OFFICE_FLOORS[value - 1] : null;
}

// Only the 34 public character-book identities belong here. Floor assignment
// follows departments; a technical manager still works on the research floor.
export const CHARACTER_FLOORS = Object.freeze({
  wing: 7,
  spencer: 7,
  erich: 3,
  sonny: 6,
  jenjen: 2,
  rick: 7,
  kind: 6,
  hope: 2,
  jack: 6,
  meimei: 4,
  helen: 5,
  sophie: 3,
  jonathan: 6,
  owen: 4,
  sam: 6,
  cindy: 5,
  professor: 7,
  annie_yu: 4,
  princess: 6,
  joyce: 4,
  janet: 3,
  captain: 2,
  zoe: 2,
  action: 4,
  hester: 4,
  simon: 5,
  james: 6,
  johnny: 5,
  alice: 2,
  wine: 6,
  peter: 6,
  tony: 6,
  henry: 6,
  mia: 2,
});

export function getCharacterFloor(id) {
  return typeof id === 'string' && Object.hasOwn(CHARACTER_FLOORS, id) ? CHARACTER_FLOORS[id] : DEFAULT_OFFICE_FLOOR;
}
