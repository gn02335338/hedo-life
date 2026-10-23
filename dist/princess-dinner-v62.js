import {isLifeBalanceV62} from './life-balance-v62.js';

// A fictional restaurant preference belongs only to the new life profile.
// Historical Princess dinners retain their original price and transcript.
export const PRINCESS_DINNER_COST_V62=52;
const dinner=Object.freeze({
 cost:PRINCESS_DINNER_COST_V62,
 title:'她看的是訂位，你看的是存款。',
 body:'你傳去幾家平價店，公主一間也沒選。她回傳一份需要訂位的套餐菜單，價格讓你重新看了一眼自己的存款。這餐要花 52 存款指數，尚未下單；你可以照原本安排坐下吃，也可以現在取消。她沒有把願不願意赴約跟餐廳預算算成同一件事。',
 quote:"I don't do budget dinners. If we're going out, let's book somewhere worth the evening.",
 normal:'先看完整菜單和總價，聊她自己願意談的近況。',
 wild:'替帳單申請精品認證，要求服務生替每個零單獨點燈。',
 accept:'公主傳回訂位頁：「I can make it. Please book this place; I’m not looking for a budget meal.」你先看過套餐與總價，邀約確定了，餐費還沒扣；正式用餐前仍能取消。',
 decline:'公主回覆：「Not tonight. I’d rather keep the evening to myself.」你收起那份高價菜單，沒有訂餐，也不扣餐費。',
 flavor:Object.freeze({
  normal:Object.freeze([
   '公主說：「This is much better. What have you been doing outside work?」她講完近況，也記得把問題問回來。這頓飯聊得開心，帳單仍照菜單上的高價結算，沒有因為氣氛好就自動折扣。',
   '公主看完菜單，說：「The food is good. Let’s keep work out of dinner.」你們吃完各自那份，沒有突然變得很熟；餐廳的價位很明確，交情還得另外慢慢累積。',
   '你問這份套餐值不值得，她把叉子放下：「If you’re going to audit every course, we should have stayed home.」你本來只是想聊天，後半餐卻開始努力避開價格。費用照樣結算，交情沒有附在套餐裡。'
  ]),
  wild:Object.freeze([
   '公主笑著說：「Fine. Every zero gets its own spotlight.」你們替帳單排了一場小型首映，服務生來收盤時，兩人都還沒把笑收好。精品認證沒有折抵餐費，至少這個玩笑真的有人接。',
   '公主看著你畫的認證章：「Cute. The bill still needs paying, though.」玩笑順利收場，你們接著吃甜點。帳單沒有變小，也沒有把一次微笑算成終身交情。',
   '公主皺眉：「I picked the restaurant, not a stage for jokes about the price.」你把精品認證收回口袋，才發現她今天不想再被拿來當餐費笑話。飯仍吃完了，這個玩笑卻沒有替你換到好感。'
  ])
 })
});

export const getPrincessDinnerV62=run=>isLifeBalanceV62(run)?dinner:null;
