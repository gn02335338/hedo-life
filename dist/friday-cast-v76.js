export const FRIDAY_CAST_PROFILES_V76 = Object.freeze({
  joe: Object.freeze({
    name: '鷲',
    title: '週五讀書會成員',
    image: './data-science-war/art/joe.webp',
    portrait: true,
    about: '資料科學讀書會的成員。喜歡拿工作裡遇到的問題開場，常把流量報表或實驗結果帶來請大家一起拆解。',
  }),
  ethan: Object.freeze({
    name: '伊森',
    title: '週五讀書會成員',
    image: './data-science-war/art/ethan.webp',
    portrait: true,
    about: '資料科學讀書會的成員。遇到新術語會先寫在講義頁角，再做一個小例子，讓在場的人都能跟著驗一次。',
  }),
});

export const isFridayCastV76 = value => /^e39-r76-[nsd]-[0-9a-f]{22}$/.test(typeof value === 'string' ? value : value?.seed || '');

export function fridayCastEventAllowedV76(run, event) {
  return isFridayCastV76(run) && !run.pip?.active && run.turn >= event.minTurn && !run.seen.includes(event.id);
}
