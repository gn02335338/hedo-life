const note = (id, label, detail, fit, result) => ({ id, label, detail, kind: '筆記', fit, result });
const snack = (id, label, detail, result, rage, cred = 0) => ({
  id, label, detail, kind: '點心', result, rage, cred,
});
const prop = (id, label, detail, scrutiny, maxHp, startingEnergy, police = false) => ({
  id, label, detail, kind: '武器類', scrutiny, police,
  loadout: { itemLabel: label, maxHp, startingEnergy },
});

export const ITEMS = [
  note('textbook', '線性代數課本', '書頁夾著一張沒寫完的習題。', ['friday-club', 'training-leak'],
    '你用講義的例題畫出特徵之間的關係。山姆把投影片往回切了一頁，這次大家知道要看哪裡。'),
  note('search-print', '搜尋流量報表', '有依查詢類型分組的點擊紀錄。', ['seo-at-the-table'],
    '伊森拿出計算機，分開核對不同查詢的點擊。鷲把「已證明」改成「先查組成」。'),
  note('experiment-log', '實驗紀錄簿', '每次分流的人數都記得很仔細。', ['ab-imbalance', 'training-leak'],
    '大家比對兩次記錄，把需要重跑的步驟第一次寫對了。'),
  note('stamp', '剛蓋章的會議記錄', '右下角有一欄「待覆核」。', ['agent-refund', 'agent-outcome', 'rotating-hosts'],
    '你把還沒做的事逐項指給大家看。傑克加了負責人，伊森補上要用什麼證據驗收。'),
  note('manual', '影印版產品手冊', '不同版本的段落用色紙隔開。', ['rag-citation', 'agent-refund'],
    '伊森沿著手冊翻到原始條款。這次大家先確認文字，再改投影上的答案。'),
  note('calendar', '上個月的行事曆', '促銷日和維護時段都圈了起來。', ['promo-drift', 'agent-routing', 'rotating-hosts'],
    '你把出現異常的時間和活動標記並排。鷲整理出下一步要重看的樣本。'),
  note('blank-page', '一張白紙和鉛筆', '目前比投影片乾淨得多。', ['friday-club', 'seo-at-the-table', 'agent-routing'],
    '傑克在白紙上分成「已知」和「待查」，大家終於同意先處理其中一件。'),
  note('sticky-notes', '三色便利貼', '每一色都能換成一件事。', ['rotating-hosts', 'agent-outcome'],
    '每個人拿一張寫下願意做的事。會議記錄多了明確下一步，白板也終於沒有新箭頭。'),
  snack('cola', '可樂', '一開瓶，氣泡細得像有人在鼓掌。',
    '山姆喝了一口。傑克趁大家停下來換氣，把話題接回白板。', -20, 1),
  snack('chips', '薯片', '紅酒大概知道這包是什麼口味。',
    '紅酒把薯片分了一圈。山姆終於把攥緊講義的手鬆開。', -26, 1),
  snack('cookies', '奶油餅乾', '盒子上寫著「開會時再開」。',
    '鷲拿了兩塊，把原本要插話的那句吞下去。', -14, 1),
  snack('bubble-tea', '珍珠奶茶', '杯身還有一點水珠。',
    '伊森把吸管遞給山姆。開口前得先嚼珍珠，剛好替傑克爭取到一句話。', -22, 1),
  snack('pineapple-cake', '鳳梨酥', '每一塊都有自己的小紙盒。',
    '傑克切了一塊給還沒講過話的人。伊森總算找到一個能插話的空檔。', -16, 1),
  snack('water', '冰水', '紙杯很普通，冰塊很大。',
    '山姆把水放到講義旁邊，安靜了一會。', -15),
  snack('rice-ball', '飯糰', '你本來打算留到散會後。',
    '你把飯糰往桌中間一推。山姆問了一句「明天那家早餐店有開嗎？」才想起會還在開。', -18, 2),
  snack('instant-coffee', '超濃即溶咖啡', '看起來可以把會議效率翻倍。',
    '山姆喝完突然語速加快。傑克才記到第三行，他已經重新講了一遍第一章。', 16),
  snack('empty-cookie-tin', '高級餅乾鐵盒', '盒身很重，打開前聽不出裡面有什麼。',
    '蓋子打開，裡面只有半捲雙面膠。紅酒問這是不是所謂的資料品質。', 11, -1),
  snack('spicy-cracker', '超辣洋芋餅', '包裝上用小字印著「非常溫暖」。',
    '第一口下去，山姆連咳三聲，剩下的人忙著傳杯子，議程一格也沒動。', 15),
  snack('chicken-soup', '翅膀的試喝保溫瓶', '瓶口貼著「喝完會想上班」。',
    '紅酒聞了一下就把蓋子鎖回去。傑克提議把整瓶列為待處理事項。', 13),
  prop('ceo-toy', '前 CEO 遺留的擬真玩具槍', '箱蓋還貼著舊道具清點標籤。', 54, 234, 100, true),
  prop('grenade-prop', '擬真手榴彈道具', '展演用的模型，底座早已不見了。', 51, 231, 100),
  prop('bat', '球棒', '好像是上次球隊活動留下的。', 36, 218, 90),
  prop('foam-sword', '泡棉大劍', '上一檔舞台活動留下的厚泡棉劍。', 21, 198, 85),
  prop('inflatable-hammer', '充氣大槌', '放在攝影棚本來是用來拍宣傳照的。', 19, 204, 88),
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map(item => [item.id, item]));

export function meetingItemEffect(item, scene, rulesVersion = 2) {
  if (!item || item.loadout) return null;
  if (item.fit && !item.fit.some(match => match === scene.id || match === scene.itemTopic || match === scene.category)) {
    return {
      text: '傑克翻了幾頁。這件資料或許別題用得上，他先把它挪到投影旁，請大家回到手上的問題。',
      rage: 6, credibility: 0, solved: false,
    };
  }
  return {
    text: rulesVersion >= 3 ? ({
      'search-print': '你拿出計算機，分開核對不同查詢的點擊。鷲把「已證明」改成「先查組成」。',
      stamp: '你把還沒做的事逐項指出來，親手加上負責人和驗收證據。傑克朝白板點了一下頭。',
      manual: '你沿著手冊翻到原始條款。這次大家先確認文字，再改投影上的答案。',
      'bubble-tea': '紅酒把吸管遞給山姆。開口前得先嚼珍珠，房間裡暫時只剩旁邊的歌聲。',
      'pineapple-cake': '你把鳳梨酥分給大家。山姆放下筆，空出一個能把話講完的空檔。',
    })[item.id] ?? item.result : item.result,
    rage: item.rage ?? -9,
    credibility: item.cred ?? 2,
    solved: Boolean(item.fit),
  };
}
