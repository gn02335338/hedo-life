import {PERSONAS,publishedDisplayText as displayText} from './persona.js';
import {castVerbalLineV39} from './verbal-cast-v39.js';

const pair=(event,result)=>({event,result});
const scenes={
 'onboarding':pair('幹，缺人就把職稱、薪水、工作寫清楚。連錄取通知都能玩文字遊戲，你們是請員工，還是找人替這間爛公司收拾話術？','名片和條件剛才都談了。現在又補一句有彈性？幹，你們的誠信是試用版，報到就到期是不是？'),
 'career-review':pair('幹，下一階要做什麼、能決定什麼、加多少錢，一次寫清楚。只在分鍋的時候說我有主管潛力，你他媽是升我，還是幫爛攤子找新戶長？','幹，責任、授權、薪水都還沒對齊，你倒是先把新工作塞來了。名片不能繳房租，少拿那張紙當加薪。'),
 'education-scrutiny':pair('幹，面試時學歷就在那裡，現在才嫌？你當時沒看，還是發薪水以前忽然想省錢？工作做完了又查畢業證書，你這管理能力只能考古是不是？','幹，成果在桌上，你還在念科系。讀書是為了做事，你倒是把讀書拿來當不看成果的遮羞布，真他媽方便。'),
 'salary-cut':pair('幹，工作一件沒少，薪水先砍。試用期是在試我能不能做，還是在試我多便宜？少拿共體時艱替你這種爛砍價穿西裝。','幹，條件都回覆了還換個人來勸。薪水不是你們的橡皮擦，老闆心情不好就能擦掉一截。'),
 'pip-review':pair('希望，幹，驗收標準拿出來。你這張表要改善的是工作，還是把早想開除的人寫成自願認輸？少拿關心的口氣包這包狗屁。','幹，紀錄都交了你還叫我自己猜幾分。要出考卷就先學會寫答案，別讓老闆今天的臉色代替驗收標準。'),
 'kind-break':pair('阿良，幹，地點、價錢、誰真的會到，現在講清楚。你嘴巴每次都說放鬆，我的荷包每次都先繃緊；少把私房行程辦成不附報價的募資。','幹，我的答覆你聽不懂是不是？去就說去，不去就說不去，少把「一下下」講成不用付錢的咒語。'),
 'kind-workday':pair('幹，阿良，工作卡住不見你，揪花錢倒是跑得比部署還快。先把你自己那堆爛事顧好，別拿我的晚上替你的行程充業績。','阿良，幹，我剛才已經回了。上班時間推銷下班行程，你這主動性要是拿一半做正事，大家還用得著陪你靠北？'),
 'banquet-afterparty':pair('阿良，幹，嘴上全都答應，出門就只剩空氣。你是主揪還是自動回覆機？今晚再放鳥，就替那張空椅子結帳，別又讓大家替你買單。','幹，阿良，剛才答應的是你，人不見的也是你。下次直接派外套來吃飯算了，至少它真的會坐在椅子上。'),
 'video-pizza-overtime':pair('阿福，幹，要比就比，不比就吃你的第三片披薩。開始都還沒喊，理由先跑完一屆奧運；你是來比腕力，還是替自己的手開脫口秀？','幹，十秒都比完了，還在抽筋、拉到、別人害你。你的手輸一場，嘴巴倒是從來不肯下場，理由伯也該有個閉幕式吧？')
};
const topics=[
 [/資料庫|DB\b|SQL|主鍵|匯入/,'幹，先看資料結構再開口。自動編號不是人工智慧，截圖也不是需求；你少懂一行 SQL，別叫我多扛一整間公司的狗屁願景。'],
 [/設計|字體|色碼|Figma|PNG|Logo|版位|主視覺|素材/,'幹，你的感覺不是規格，昨天點頭也不是今天失憶的理由。哪裡要改就指哪裡，別把沒想法包裝成我不懂設計。'],
 [/報價|成交|業績|獎金|客戶|佣金/,'幹，報價時什麼都敢送，交付時什麼都找我。業績算你的，爛攤子算我的，你這算盤打得比客戶還精。'],
 [/合作|MOU|通路|夥伴|出海|引薦/,'幹，握手不是簽約，合照不是入帳。條件空著就叫我開始做，你們的國際合作是拿別人的工時去交朋友是不是？'],
 [/模型|AI|資料探勘|演算法|推薦/,'幹，資料不給、驗證不排，倒是天天喊 AI。願景唸三遍不會收斂，想要只會點頭的模型，鏡子放你面前最快。'],
 [/會議|排程|時程|進度|工期|上線|測試|部署/,'幹，你們每項都說最急，最後出事又裝不認識排程。少開一場廢會，少改一次口，進度早就比你催半天有用。'],
 [/薪水|月薪|加薪|待遇|砍薪|獎勵/,'幹，談責任就叫我像老闆，談錢就提醒我是員工。餅畫那麼大，薪資單連墨水都捨不得多印一行？'],
 [/表單|簽核|預算|核銷|憑證|KPI|財務/,'幹，要哪張單一次講完。你今天多想到一個欄位，不代表昨天照規矩做的人都是白癡；別把你沒講清楚算成我的疏失。'],
 [/鋼琴|續攤|邀約|放鳥|酒吧|餐廳/,'幹，價錢不講、人又不來，答應得像董事長，出席率像自動回覆。少拿朋友當免費候補，我的晚上沒有附贈給你。'],
 [/門禁|印表機|設備|帳號|筆電/,'幹，會用電腦不代表要替整棟樓通靈。哪一台、誰負責、什麼權限先講，少把自己的懶散叫成別人不配合。']
];

export function strongVerbalLineV39({event,target,run,phase='event',base=''}={}){
 const coarse=/幹[，。！？]|他媽|靠北|媽的|狗屁/;
 const newcomer=castVerbalLineV39({event,target,run,phase});if(newcomer)return coarse.test(newcomer)?newcomer:`靠北，${newcomer}`;
 const authored=scenes[event?.id];
 if(authored&&(!event?.speaker||event.speaker===target||target==='wing'&&['onboarding','career-review','education-scrutiny'].includes(event.id)))return authored[phase==='result'?'result':'event'];
 const existing=displayText(base);
 if(coarse.test(existing))return existing;
 const topic=topics.find(([pattern])=>pattern.test([event?.title,event?.body,event?.id].join(' ')));
 if(topic&&phase!=='result')return `${PERSONAS[target]?.name?`${PERSONAS[target].name}，`:''}${topic[1]}`;
 if(target==='self')return `幹，${existing.replace(/^[靠，\s]+/u,'')} 我不是來替這堆爛安排把自己耗乾的。`;
 const direct=existing.replace(/麻煩(?:你)?|拜託(?:你)?|好嗎？|可不可以/g,'').replace(/^請/u,'').trim();
 return `幹，${direct}${/[。？！!?]$/u.test(direct)?'':'。'}少把你自己的爛安排，算成我不夠懂事。`;
}
