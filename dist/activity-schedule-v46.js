import {isExpansionV65} from './expansion-profile-v65.js';
// A seed fixes when an invitation can arrive. Reading a calendar never rolls
// the game's RNG, changes a save, or lets the player choose an activity.
import {isParticipationV63} from './participation-profile-v63.js';
import {ROADSHOW_INVITATION_V63} from './roadshow-v63.js';
export const ACTIVITY_WINDOWS_V46=Object.freeze({
 camel:Object.freeze([3,17]),
 arm:Object.freeze([2,15]),diet:Object.freeze([4,11]),roadshow:Object.freeze([6,15]),
 dinner:Object.freeze([3,17]),basketball:Object.freeze([2,17]),review:Object.freeze([8,18]),
 banquet:Object.freeze([16,19])
});
const COMMON_ACTIVITIES=Object.keys(ACTIVITY_WINDOWS_V46).filter(id=>id!=='banquet');
const hash=value=>{let result=2166136261;for(const char of String(value))result=Math.imul(result^char.charCodeAt(0),16777619)>>>0;return result;};
const unseen=(run,id)=>!run.flags[`activity46_seen_${id}`]&&!run.flags[`activity44_${id}`]&&!(id==='banquet'&&(run.flags.banquet_seen||run.flags.banquet_attended));
const inWindow=(turn,id)=>turn>=ACTIVITY_WINDOWS_V46[id][0]&&turn<=ACTIVITY_WINDOWS_V46[id][1];
const cooledDown=run=>['activity46_last_turn','activity44_last_turn'].every(key=>!Number.isInteger(run.flags[key])||run.turn+1-run.flags[key]>=2);
const weight=(id,role)=>id==='roadshow'&&['sales','bd','design','project'].includes(role)||id==='review'&&['system','ai','mis','project','product','finance','accounting'].includes(role)?3:1;
const LIVE_BANQUET_DAILIES=new Set(['quiz26-banquet-cup','quiz26-toast-rule','cast35-meimei-first-love-enlist','cast35-meimei-sober-label']);
const AFTER_BANQUET_DAILIES=new Set(['cast35-kind-reservation-ghost','dp-prize-last-day']);

// The scheduled party owns this year's occasion. Its old short scenes cannot
// place someone at a second party, or attend on behalf of a declined invite.
export function calendarDailyAllowedV46(run,event){
 if(run?.flags?.activity46_enabled!==1)return true;
 if(LIVE_BANQUET_DAILIES.has(event?.id))return false;
 if(AFTER_BANQUET_DAILIES.has(event?.id))return run.turn>=16&&!!run.flags.activity44_banquet;
 return true;
}

export function scheduledActivityV46(run){
 if(!run||run.flags?.activity46_enabled!==1||typeof run.seed!=='string'||!Number.isInteger(run.turn))return null;
 const turn=run.turn,ready=cooledDown(run);
 const banquetDue=16+hash(`${run.seed}:banquet`)%3;
 if(inWindow(turn,'banquet')&&turn>=banquetDue&&unseen(run,'banquet')&&(ready||turn===19))return 'banquet';
 if(!ready||(run.flags.activity46_count||0)>=3||hash(`${run.seed}:${turn}:invitation`)/4294967296>=.42)return null;
 const ids=COMMON_ACTIVITIES.filter(id=>(id!=='camel'||isExpansionV65(run))&&inWindow(turn,id)&&unseen(run,id));
 if(!ids.length)return null;
 const role=run.actualRoleId||run.roleId,total=ids.reduce((sum,id)=>sum+weight(id,role),0);
 let ticket=hash(`${run.seed}:${turn}:activity`)/4294967296*total;
 for(const id of ids){ticket-=weight(id,role);if(ticket<0)return id;}
 return ids.at(-1)||null;
}

// These invitations precede the existing multi-scene activities. Nothing here
// implies that the player has agreed, travelled, paid, or started competing.
const INVITATIONS=Object.freeze({
 camel:{title:'丁哥搬來三張名牌：真人駱駝大賽，要來嗎？',speaker:'simon',scene:'meeting',source:'characterFiction',body:'丁哥代表福委會來揪真人駱駝大賽，手上卻只有紙名牌和骰袋。阿福正問誰要扛誰，他把名牌放到桌上：真人只負責喊位置，不抬人。你還沒報名，今天的活動點也不用花錢買。',wing:'要來一起猜排名嗎？名牌跑就好，人坐著也能玩。',choices:['參加，先看看骰色與疊堆怎麼算。','這場我先不去，留著處理自己的安排。','派玩具鵝先報名，本尊這次不出席。'],results:['你向丁哥報名，準備過去看規則。紙名牌先進場，現金留在口袋。','你說這次不參加，丁哥把人數核對好，沒有收活動費。','丁哥問鵝會不會自己猜排名，你說牠負責精神出席。你沒有參賽，先回原本的事。']},
 arm:{title:'阿福的手還沒上桌，邀請先到了。',speaker:'jack',scene:'office_day',source:'videoOffice',
  body:'傑克從隔壁探頭，問你要不要一起看腕力大賽。阿福站在桌邊，先說今天吃太飽，又問有沒有錄影。比賽還沒開始，你連椅子都還沒搬過去。',
  wing:'要來嗎？先看他今天到底願不願意比。',
  choices:['過去看看，也幫忙把規則講清楚。','我先把手上的事做完，這場不去了。','請玩具鵝代我出席；牠沒有手，比較不會被說弄傷誰。'],
  results:['你回傑克說一起過去，桌邊的人替你留了一個位置。比賽規則還沒定，先聽大家怎麼說。','你說這次不去，傑克點點頭。隔壁還在確認阿福的參賽條件，你回頭接著做原本的事。','你指派玩具鵝當觀察員，自己留下來工作。傑克笑說那就不替牠登記腕力組，邀請到這裡為止。']},
 diet:{title:'減肥比賽的群組，忽然多了一則邀請。',speaker:'annie_yu',scene:'office_day',source:'verifiedQuiz',
  body:'安妮余傳來公司減肥比賽的報名訊息，問你有沒有興趣。旁邊有人已經開始討論蛋塔算不算犯規，紅茶說先別替別人的午餐訂規則。你的名字還沒填進名單。',
  wing:'你要一起嗎？不報名也可以正常吃飯。',
  choices:['先聽參賽方式，再選一個自己做得到的目標。','我不參加排名，照自己的步調吃飯。','替會議室報名吧，先減掉它每週超重的會議。'],
  results:['你說願意參加，安妮余把報名方式傳給你。這次要怎麼比，先從自己的目標決定。','你婉拒了報名，名單沒有多出你的名字。午餐照常，原本的工作也還在等你。','你推薦會議室先瘦身，安妮余笑著說它沒有員工編號。你沒有報名，先回去處理桌上的工作。']},
 roadshow:{title:'真真帶著 Roadshow 名單走過來。',speaker:'jenjen',scene:'office_day',source:'verifiedQuiz',
  body:'真真把一張還沒填完的分工表放到你桌邊，問這次 Roadshow 能不能一起支援。強哥路過，先提醒自己只是助理工程師。設備還沒出門，你也還沒答應。',
  wing:'這次缺一個能在現場把事情講清楚的人。你能來嗎？',
  choices:['先確認負責範圍，這次一起支援。','目前的交付排不開，請另外安排人手。','提名玩具鵝站台，我留守處理真的會出錯的東西。'],
  results:['你答應支援，先請真真把分工拿來一起確認。要帶什麼、現場答到哪裡，現在開始講。','你說明手上的交付，請真真另找人支援。她把空格留在名單上，你繼續原本的工作。','你把玩具鵝推到名單旁邊，明確表示自己這次無法到場。真真說展位還是需要真人，拿著表繼續找人。']},
 dinner:{title:'船長問你，今晚要不要一起吃。',speaker:'captain',scene:'office_day',source:'budget',
  body:'船長來核對公司聚餐人數，手上的名單還缺幾個回覆。歐文已經開始問菜單有沒有比目魚，屎潘蛇說先看預算。你還坐在辦公桌前，今晚的位子等你一句話。',
  wing:'要去的話我幫你算進去，現在還來得及調座位。',
  choices:['一起吃，麻煩幫我登記一位。','今晚有自己的安排，這次先不參加。','讓玩具鵝代表我吃願景，真人今晚自己覓食。'],
  results:['你請船長把自己算進人數。她先記下來，聚餐現場的位子和菜單，等到了再看。','你回覆今晚不參加，船長把人數改好。你不用等聚餐散場，先照自己的安排過晚上。','你說今晚自己吃，玩具鵝只負責精神出席。船長笑著確認不用替牠加椅子，這次沒有登記你。']},
 basketball:{title:'傑克突然探頭：下班打球嗎？',speaker:'jack',scene:'office_day',source:'characterFiction',
  body:'你還在盯著螢幕，傑克拿著手機走過來，問下班要不要去附近打半場。球場時間剛確認，有人帶球，有人說自己只能當候補。你今天要不要動一動，還沒有人替你決定。',
  wing:'下班打個半場？打完各自回家，不用交心得。',
  choices:['好，等下班一起去，先看看怎麼分隊。','今天先不去了，我想留點力氣休息。','我派分身去投三分，本尊今晚採取水平移動：躺下。'],
  results:['你回傑克說好，下班後一起去球場。球還沒開打，先把暖身和分隊安排好。','你說今天想休息，傑克回了個好。球場不用替你留位，眼前的工作先照原本進度走。','傑克問分身會不會回防，你說本尊今晚只負責躺平。他笑著收起手機，這次不替你算人數。']},
 review:{title:'審查通知到了，水蛇先來找你。',speaker:'meimei',scene:'office_day',source:'verifiedQuiz',
  body:'水蛇拿著政府專案審查通知走過來，問這次能不能陪同出席。資料和分工還要再對一次，傑克說答不出來就先看稿。你還沒接下這個安排，桌上卻已經多了一份待確認的簡報。',
  wing:'這次你一起去好嗎？先把要講的內容對好。',
  choices:['一起去，先確認我負責回答哪些問題。','這次無法出席，請先把人手和資料重新安排。','建議先送玩具鵝口試；我這次不出席，牠至少不會亂承諾。'],
  results:['你答應陪同審查，請水蛇先把問題範圍和資料攤開。正式進場前，還有分工要確認。','你說明這次無法出席，請水蛇重新安排人手。簡報還得有人核對，你回頭接著做原本的工作。','你用玩具鵝示範如何保持沉默，也把自己無法出席說清楚。水蛇把簡報收回去，繼續找這次能到場的人。']},
 banquet:{title:'年度走到後段，尾牙通知終於來了。',speaker:'captain',scene:'office_day',source:'chronicleBanquet',
  body:'年度走到後段，船長開始收尾牙回覆。水蛇在群組問有沒有人點 First Love，傑克回得比平常交進度還快；阿良則說散場後可以再聊。桌上的邀請還沒勾選，你可以決定今晚要不要去。',
  wing:'尾牙人數要確認了。你要來嗎？',
  choices:['參加，今晚去吃飯，也看看大家會唱成怎樣。','今年先不參加，這個晚上留給自己。','替玩具鵝報名精神加碼，本人今晚不候補任何願景。'],
  results:['你勾選參加，船長把名字填進尾牙名單。到了現場，先處理的可能是麥克風，也可能是晚餐。','你回覆今年不參加，船長確認後把名單收好。尾牙照常舉行，你把這個晚上留給自己。','你說玩具鵝願意精神出席，自己今年不參加。船長確認不留座位，抽獎券也沒有多填一張。']}
});
const invitation=run=>{
 const context=run?.activityInvitationContext;
 if(!context||context.version!==1||!Object.hasOwn(INVITATIONS,context.id)||typeof context.returnEventId!=='string')throw new Error('Invalid activity invitation');
 return {context,copy:context.id==='roadshow'&&isParticipationV63(run)?ROADSHOW_INVITATION_V63:INVITATIONS[context.id]};
};

export function getActivityInvitationEventV46(run){
 const {context,copy}=invitation(run);
 if(context.id==='camel'&&!isExpansionV65(run))throw new Error('Invalid camel invitation');
 const freshDiet=context.id==='diet'&&isExpansionV65(run);
 return {id:`activity46-invite-${context.id}`,title:freshDiet?'傑克來揪三隊減肥比賽。':copy.title,body:freshDiet?'傑克在群組主揪減肥比賽，Johnny、安妮余、阿福各帶一隊。這次用七天飲食與活動行事曆記錄自己的安排，不公布真人身體數字；你還沒選隊，也可以說不參加。':copy.body,speaker:freshDiet?'jack':copy.speaker,wing:copy.wing,
  kind:'activity-invitation',era:context.id==='banquet'?'年度後段・尾牙通知':'突然的活動邀約',scope:'work',scene:copy.scene,
  sourceIds:[...new Set([copy.source,'characterFiction'])],
  choices:copy.choices.map((text,index)=>({text,result:copy.results[index],delta:{},...(index===2?{wild:true}:{})}))};
}

export function invitationResultV46(run,index){
 const {copy}=invitation(run);
 if(!Number.isInteger(index)||index<0||index>=copy.results.length)throw new Error('Invalid activity invitation choice');
 return copy.results[index];
}
