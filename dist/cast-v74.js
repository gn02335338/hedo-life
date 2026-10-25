import {isCastV74} from './cast-profile-v74.js';
export {isCastV74} from './cast-profile-v74.js';

// Brief, neutral character-book introductions. The scenes are fictional office
// comedy; private relationships and allegations do not belong in these cards.
export const CAST_PROFILES_V74=Object.freeze({
 wine:Object.freeze({name:'紅酒',title:'系統工程師',department:'engineering',seniority:'colleague',cost:12,sensitivity:.02,
  about:'Wine，系統工程師，熟悉系統維運與故障排查。名字偶爾被聽錯，工作時很在意交接、值班與下班時間。',era:'紅酒・系統與加班現場'}),
 peter:Object.freeze({name:'P神',title:'助理工程師',department:'engineering',seniority:'colleague',cost:10,sensitivity:.03,
  about:'Peter，也叫二代 P，擔任助理工程師。常在遊戲話題、工作分工與同事互動中出現。',era:'P神・助理與辦公室日常'}),
 tony:Object.freeze({name:'8+9',title:'助理工程師',department:'engineering',seniority:'colleague',cost:11,sensitivity:.03,
  about:'Tony，也叫托尼，擔任助理工程師。說話直接，喜歡聊遊戲與揪同事吃早餐，也常為自己的名字補充說明。',era:'8+9・早餐與江湖副本'}),
 henry:Object.freeze({name:'老大',title:'技術總監',department:'engineering',seniority:'director',cost:19,sensitivity:.04,
  about:'Henry，從外部加入團隊的技術總監。參與技術規劃、主管協調與工作交接，私下也會邀同事聚會。',era:'老大・技術決策與同事小聚'}),
 mia:Object.freeze({name:'米雅',title:'人資專員',department:'people',seniority:'colleague',cost:12,sensitivity:.02,
  about:'Mia，人資專員，協助招募、報到與日常人事聯繫。待人親切，也重視資料用途和每個人的選擇。',era:'米雅・人資與辦公室窗口'})
});
export const CAST_IDS_V74=Object.freeze(Object.keys(CAST_PROFILES_V74));

export const CAST_RELATIONSHIP_VOICES_V74=Object.freeze({
 wine:Object.freeze({help:'紅酒把真正卡住的系統紀錄和處理順序交給你，這次救火有了接棒的人。',cover:'紅酒先接住一輪查修，讓你把自己的交付收好，不必兩邊同時值班。',refusal:'紅酒說這張單需要先確認負責人，沒有再替一句順便接下整夜。',argument:'紅酒不滿你把他的時間當成系統備援，兩人得先把工時和分工重新說清楚。',backstab:'紅酒只留下能查到的系統紀錄，你原本想靠一句口頭交接帶過的空格，又回到自己面前。',report:false}),
 peter:Object.freeze({help:'P神把遊戲視窗收起來，這次真的找出你需要的測試資料，還把操作步驟補在旁邊。',cover:'P神先接了一輪基本檢查，讓你能把手上那件事做完再回來核對。',refusal:'P神提醒自己是助理工程師，這次需要拍板的部分請你找原決定人。',argument:'P神覺得你又替他接了沒問過的工作，兩人先吵了一輪誰答應了什麼。',backstab:'P神把交辦訊息照原樣轉出去，你之前省掉的條件沒有一起出現，得自己補回完整前提。',report:false}),
 tony:Object.freeze({help:'8+9嘴上碎念，還是把真正能跑的那份檔案交給你，順手圈出兩個容易踩的坑。',cover:'8+9先替你擋下一輪追問，說要催也先讓人把這一段做完。',refusal:'8+9說這輪不是他接的單，沒有再為一句哥們幫忙就自動報到。',argument:'8+9一句粗話把你頂回來，兩人都覺得自己被當成免費候補，工作得等話講完才能繼續。',backstab:'8+9在群組裡只回自己做過的那一段，你以為有人會順手補的工作又留成空格。',report:false}),
 henry:Object.freeze({help:'老大把技術決定和負責人一起寫下來，這次不用由你拿一張空白規格去擋所有追問。',cover:'老大先接住一輪主管確認，請你把已同意的範圍做好，追加的另談。',refusal:'老大說條件還沒拍板，不願先用技術總監的名義替別人的承諾保證。',argument:'老大覺得你跳過了應該先確認的技術決定，兩人把問題花了一輪才拆回同一張圖。',backstab:'老大把尚未核准的方案留成待決，你先前對外答應的日期沒有跟著變成正式排程。',report:false}),
 mia:Object.freeze({help:'米雅把需要的資料、用途和聯絡窗口整理給你，這輪不用再把同一份說明寄三次。',cover:'米雅先替你確認一輪流程，沒有讓每個人都把自己的問題重新丟回你這裡。',refusal:'米雅說這項需要本人確認，沒有因為熟就替別人按下同意。',argument:'米雅覺得你把客氣當成什麼都答應，兩人先把原本的請求和後加的要求分開。',backstab:'米雅只把能確認的原始資料送出，你口頭說已經同意的那段仍得自己找本人核對。',report:false})
});

export function castAvailableV74(run,id){return !CAST_IDS_V74.includes(id)||isCastV74(run);}
