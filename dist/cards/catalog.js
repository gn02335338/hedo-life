const people = [
 ['wing','翅膀','SSR','pressure','願景連發','把最後期限當成範圍技。'],
 ['spencer','屎潘蛇','SSR','shield','董事長致詞','致詞還沒講完，對面的耐心先耗盡。'],
 ['erich','法師','R','expose','逐條核對','請先看附件，不要只看最後一頁。'],
 ['sonny','阿福','R','shield','理由伯記者會','手還沒上桌，傷勢報告已經完成。'],
 ['jenjen','真真','R','drain','座位不足','先勸退一輪，再確認現場有多少椅子。'],
 ['rick','瑞克','SSR','focus','電話一響','睡眠模式立即切換成老闆專線。'],
 ['kind','阿良','R','heal','鋼琴補給','行程很滿，帳單也很滿。'],
 ['hope','希望','R','drain','改善計畫','表格排得越整齊，壓力越不整齊。'],
 ['jack','傑克','SSR','expose','請看原始紀錄','有日期、有附件，還有那杯偷外帶的咖啡。'],
 ['meimei','水蛇','R','pressure','全場控麥','來賓請喝到飽，員工請先放下杯子。'],
 ['helen','海倫','SSR','heal','產品救火','先救產品，恩怨等會再開另一個會。'],
 ['sophie','紅茶','N','expose','稽核追問','不是綠茶，是能追到單據的紅茶。'],
 ['jonathan','強哥','N','shield','我只是助理','職稱四個字，擋下四份新增需求。'],
 ['owen','歐文','R','pressure','飛天拐子','先看球，再看你還站不站得穩。'],
 ['sam','山姆','N','focus','串流讀書會','畫面上有字幕，理論上也算閱讀。'],
 ['cindy','辛蒂','R','drain','排程大風吹','下個會議之前，先確認主管還在不在。'],
 ['professor','林老師','SSR','focus','半天顧問','短短半天，把散掉的論點串起來。'],
 ['annie_yu','安妮余','N','heal','商務救援','先確認今天被叫的是哪一位安妮。'],
 ['princess','公主','SSR','pressure','Premium Only','The budget is not the problem. Your budget is.'],
 ['joyce','Joyce','R','pressure','升級路線','新的樓層，新的聯絡名單。'],
 ['janet','Janet','R','drain','白隊對帳','五千元的去向，比決賽還難追。'],
 ['captain','船長','N','heal','下午茶導航','一點五星也是星，先別急著慶祝。'],
 ['zoe','201','R','shield','主持人結界','掌聲在這邊，尷尬請排到隊伍後面。'],
 ['action','順哥','R','focus','區塊鏈願景','報告、專利、人脈都有了，預算呢？'],
 ['hester','海姐','N','expose','商務連線','先把人脈接上，再確認對方有沒有預算。'],
 ['simon','丁哥','N','shield','真人駱駝','規則先講完，誰疊在誰上面再慢慢談。'],
 ['james','詹姆士','N','heal','七進七出','離職不是退場，是下一次登入前的載入畫面。'],
 ['johnny','強尼','N','expose','排程反擊','延期有原因，這次直接把原因印出來。'],
 ['alice','愛麗絲','SSR','focus','最後一抽','這是理性的資源配置。真的，最後一次。'],
];
const items = [
 ['badge','門禁卡','N','shield','護盾 +8，讓報到先過得了門。'],['cup','滿料飲料','N','heal','生命 +10，珍珠也算補給。'],['printer','口試影印機','N','expose','破防 +2，先說到它不再卡紙。'],['pillow','午睡靠枕','N','heal','生命 +14，給疲勞一個座位。'],['calendar','延期行事曆','N','pressure','攻擊 +2，排程終於有空白。'],['usb','備份隨身碟','N','expose','破防 +3，重要附件隨身攜帶。'],
 ['coffee','三百元咖啡','R','pressure','攻擊 +5，員工理論上不能喝。'],['invoice','白隊收據','R','expose','破防 +6，帳本不會自己歸隊。'],['microphone','First Love 麥克風','R','pressure','攻擊 +6，主唱權靠自己爭取。'],['laptop','專案筆電','R','focus','技能傷害 +8，電池請自行補充。'],['cake','未退冰蛋糕','R','shield','護盾 +16，刀和手腕都需要勇氣。'],['sneakers','球場護具','R','heal','生命 +22，預防移動迷宮碰撞。'],
 ['goose','玩具鵝主席','SSR','shield','護盾 +28，會議由鵝主持。'],['bell','敲鐘槌','SSR','pressure','攻擊 +10，鐘聲不保證上市。'],['contract','簽名附件','SSR','expose','破防 +10，聖旨終於能核對。'],['server','區塊鏈舊主機','SSR','focus','技能傷害 +16，設備很舊，願景很新。'],['cardcase','愛麗絲卡冊','SSR','heal','生命 +32，收藏也需要活著打完。'],['shares','員工認股單','SSR','drain','敵方攻擊 -3，先把錢留在公司。'],
];
const events = [
 ['drink','傑克請飲料','N','heal','全隊恢復 12 生命。滿料那杯另計。'],['walk','先去走一圈','N','shield','全隊獲得 10 護盾。'],['minutes','會議紀錄寄出','N','damage','造成 20 傷害，這封信有附件。'],['nap','螢幕還亮著','N','charge','全隊技能冷卻歸零。'],['test','測試不是許願','N','expose','本場破防增加 4。'],['delay','客戶再等一下','N','weaken','敵方下三次攻擊降低 5。'],
 ['roadshow','Roadshow 偷咖啡','R','heal','全隊恢復 24 生命，還能外帶。'],['arm','腕力賽前記者會','R','shield','全隊獲得 20 護盾，理由已經準備好。'],['database','AI 原來是自動遞增','R','damage','造成 42 傷害，Primary Key 沒有夢想。'],['camel','真人駱駝開跑','R','charge','技能冷卻歸零，額外造成 18 傷害。'],['audit','原始紀錄在這裡','R','expose','本場破防增加 8。'],['vacation','今天真的休假','R','weaken','敵方下三次攻擊降低 9。'],
 ['firstlove','First Love 搶麥決鬥','SSR','damage','造成 68 傷害，副歌由你決定。'],['retreat','暗黑續攤人不見','SSR','heal','全隊恢復 38 生命，阿良已離線。'],['ipo','鐘聲以前先對帳','SSR','expose','本場破防增加 14。'],['goosemeeting','玩具鵝董事會','SSR','shield','全隊獲得 34 護盾。'],['allin','這次真的最後一抽','SSR','charge','技能冷卻歸零，額外造成 36 傷害。'],['labor','請進入正式調解','SSR','weaken','敵方下三次攻擊降低 14。'],
];
const effects={pressure:'重擊：造成 1.8 倍攻擊傷害。',shield:'掩護：攻擊並替全隊增加護盾。',heal:'補給：替生命最低的隊友恢復生命。',expose:'佐證：造成傷害並永久降低本場敵方防禦。',focus:'專注：造成技能傷害，下回合攻擊更強。',drain:'打斷：造成傷害並削弱敵方下一次攻擊。'};
export const CARD_CATALOG=Object.freeze([
 ...people.map(([key,name,rarity,effect,skill,flavor],i)=>Object.freeze({id:`person-${key}`,key,name,kind:'character',rarity,effect,skill,flavor,description:effects[effect],portrait:`/assets/${key}.png`,attack:(rarity==='SSR'?19:rarity==='R'?16:14)+(i%5)-2,hp:(rarity==='SSR'?76:rarity==='R'?68:62)+((i%7)-3)*2})),
 ...items.map(([key,name,rarity,effect,description])=>Object.freeze({id:`item-${key}`,key,name,kind:'item',rarity,effect,power:Number(description.match(/[+-]?(\d+)/)?.[1]||0),description,flavor:description,portrait:null})),
 ...events.map(([key,name,rarity,effect,description])=>Object.freeze({id:`event-${key}`,key,name,kind:'event',rarity,effect,description,flavor:description,portrait:null})),
]);
export const CARD_MAP=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(CARD_CATALOG.map(card=>[card.id,card]))));
export const STAGES=Object.freeze([
 ['名片還沒拆','先通過新人的第一場臨時會議。','captain',86,7,1,'heal'],
 ['需求又改了','三個方向都不對，但請今天下班前完成。','simon',112,9,2,'shield'],
 ['一點五星補給站','店家評分不高，配送壓力倒是滿分。','captain',140,10,3,'heal'],
 ['助理職稱結界','強哥提醒：這件事情可能超出助理範圍。','jonathan',165,11,4,'shield'],
 ['白隊的收據','要對帳，先讓每個版本的說法站到同一邊。','janet',192,12,5,'expose'],
 ['理由伯記者會','還沒出賽，先聽完完整的傷勢說明。','sonny',220,13,6,'shield'],
 ['續攤定位消失','集合時間到了，發起人的定位卻沒有了。','kind',250,14,7,'heal'],
 ['顧問半天考','把產品、論文與簡報放在同一張桌上。','professor',280,15,8,'focus'],
 ['最後一抽的誘惑','愛麗絲說這一抽是戰術，不是衝動。','alice',316,16,9,'focus'],
 ['願景董事會','把願景、預算和交付日一起放上投影片。','wing',360,18,10,'pressure'],
].map(([name,description,portrait,hp,attack,armor,style],i)=>Object.freeze({id:i+1,name,description,portrait:`/assets/${portrait}.png`,hp,attack:Math.round((i+1)*4.3+7),armor,style,reward:i<3?3:i<7?4:5})));
export const RARITY_ODDS=Object.freeze({N:70,R:24,SSR:6});
export const CARD_KINDS=Object.freeze({character:'人物',item:'物品',event:'事件'});
export const STARTER_IDS=Object.freeze(['person-jack','person-captain','person-jonathan','person-simon','person-annie_yu','item-badge','item-cup','event-drink','event-walk']);
