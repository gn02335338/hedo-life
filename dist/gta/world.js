// Original, deterministic city geometry. Physics and rendering use the same blocks.
export const ROAD_LINES = Object.freeze([-120, -60, 0, 60, 120]);
export const WORLD_LIMIT = 133;
export const SPAWN = Object.freeze({ x: 4, z: 32, heading: 0, speed: 0 });

export const LOCATIONS = Object.freeze([
  { id: 'hq', name: '禾多總部', x: 4, z: 22, color: 0x9ddb55 },
  { id: 'coffee', name: '續杯咖啡', x: -56, z: 30, color: 0xf7bc70 },
  { id: 'lab', name: '深夜實驗室', x: -56, z: -88, color: 0x7ac8e5 },
  { id: 'meeting', name: 'Roadshow 會場', x: 64, z: -30, color: 0xe795b7 },
  { id: 'court', name: '下班籃球場', x: 90, z: 64, color: 0xe8ac56 },
  { id: 'harbor', name: '敲鐘碼頭', x: 4, z: 116, color: 0x6ccdb3 },
  { id: 'finance', name: '財務收件站', x: 64, z: 86, color: 0xc0a0e6 },
  { id: 'garage', name: '禾多修車廠', x: -90, z: 18, color: 0x78b6a0 },
].map(Object.freeze));

const blockCenters = [-90, -30, 30, 90];
const palette = [0x899d8d, 0xb5a898, 0x8eabb1, 0xb2b6a3, 0x9c9fba, 0xc0ab92];
const landmarks = {
  '2,0': { kind: 'garage', name: 'HEDO MOTOR WORKS', x: -90, z: 37, w: 36, d: 22, h: 9, color: 0xa6b9b9 },
  '2,2': { kind: 'hq', name: 'HEDO', h: 48, color: 0x9cbaac },
  '0,1': { kind: 'lab', name: 'LAB', h: 27, color: 0x8cabb7 },
  '1,3': { kind: 'meeting', name: 'ROADSHOW', h: 25, color: 0xb9a0ae },
  '2,1': { kind: 'coffee', name: 'COFFEE', h: 12, color: 0xbba68c },
  '3,3': { kind: 'court', name: 'COURT', h: 5, color: 0x98aa8a },
  '3,2': { kind: 'finance', name: 'FINANCE', h: 24, color: 0xaaa3b8 },
};

export const BUILDINGS = Object.freeze(blockCenters.flatMap((z, row) =>
  blockCenters.map((x, column) => Object.freeze({
    x, z, w: 40, d: 40,
    h: 15 + ((row * 13 + column * 7) % 5) * 5,
    color: palette[(row * 3 + column) % palette.length],
    kind: 'office', name: '',
    ...landmarks[`${row},${column}`],
  }))));

// These errands and conversations are original extensions of the public cast.
// The application reveals completion text only after the delivery is made.
export const MISSIONS = Object.freeze([
  {
    id: 'coffee-run', title: '傑克的續杯計畫', person: '傑克',
    brief: '傑克說開會前只差一杯咖啡。先到續杯咖啡取餐，再送回禾多總部；杯架已經準備好了。',
    pickup: 'coffee', dropoff: 'hq', reward: 350,
    completion: '咖啡順利送達。傑克把第二杯藏在文件後面：「這杯是下午的預算。」',
  },
  {
    id: 'roadshow-rescue', title: '水蛇的開場倒數', person: '水蛇',
    brief: 'Roadshow 即將開始，識別證和轉接頭卻還在總部。水蛇傳來一句：「人可以慢慢講，線不能沒有。」',
    pickup: 'hq', dropoff: 'meeting', reward: 450,
    completion: '會場亮起第一張投影片。水蛇收好轉接頭，終於有空提醒傑克咖啡不是喝到飽。',
  },
  {
    id: 'lab-relay', title: 'Sam 的展示機接力', person: 'Sam',
    brief: 'Sam 把能正常開機的展示機放在實驗室門口。把它送到會場，沿路不用順便幫它更新系統。',
    pickup: 'lab', dropoff: 'meeting', reward: 550,
    completion: '展示機一插電就亮了。Sam 在群組回覆「先別動」，比任何簡報都讓人安心。',
  },
  {
    id: 'court-call', title: '阿福的場邊補給', person: '阿福',
    brief: '阿福已經到球場，球和毛巾卻還在總部。把裝備袋送過去，讓今晚至少有人帶球上場。',
    pickup: 'hq', dropoff: 'court', reward: 500,
    completion: '球送到了。阿福伸展兩下，宣布先當教練；球場上的人決定照常開打。',
  },
  {
    id: 'receipt-run', title: 'Janet 的最後一張單', person: 'Janet',
    brief: '球場補給的單據還夾在裝備袋裡。Janet 要的是那張紙，請到球場取件，再送到財務收件站。',
    pickup: 'court', dropoff: 'finance', reward: 650,
    completion: '單據完整抵達。Janet 蓋下收件章：「收到了。下次也請記得拿。」今晚的帳終於能往前走。',
  },
  {
    id: 'harbor-finale', title: '翅膀的敲鐘快遞', person: '翅膀',
    brief: '翅膀把一座展示用小鐘寄存在財務站，現在要搬去碼頭拍照。帶著它去吹海風，照片的標題留給他想。',
    pickup: 'finance', dropoff: 'harbor', reward: 900,
    completion: '小鐘在碼頭響了一聲。沒有股票開始交易，只有大家的下班時間正式開盤。今天的委託全部完成。',
  },
].map(Object.freeze));
