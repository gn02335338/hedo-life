import {castSceneV74} from './cast-scenes-v74.js';
import {WINE_EVENTS_V74} from './events-cast74-wine.js';
import {PETER_EVENTS_V74} from './events-cast74-peter.js';
import {TONY_EVENTS_V74} from './events-cast74-tony.js';
import {HENRY_EVENTS_V74} from './events-cast74-henry.js';
import {MIA_EVENTS_V74} from './events-cast74-mia.js';

// Anonymous background engineer: this scene never identifies a photographed
// character as the person with the hygiene problem.
export const ALICE_HYGIENE_EVENTS_V74=Object.freeze([castSceneV74('alice',[
 'diagonal-hygiene','愛麗絲的斜對面，正在進行人體採礦。',
 '愛麗絲原本在看手機，忽然把椅子往旁邊移。斜對面的工程師一邊看螢幕，一邊挖鼻孔、摳痘痘，面紙上還留了血點。愛麗絲壓低聲音說這不是第一次，轉頭看著即將輪流使用的共用滑鼠，整張臉都寫著拜託不要。',
 '有夠噁……他等一下不要直接過來碰那顆滑鼠耶。',
 '遞面紙，請對方先停手、清理並洗手。',
 '工程師拿著面紙去清理，愛麗絲把共用桌面擦好。你們回到原本工作，不必再用眼角監控下一隻伸向滑鼠的手。',
 '把椅子轉回去，假裝沒看見。',
 '愛麗絲把滑鼠先收開，自己換到另一個位置。你不用開口，眼角卻還是一直被斜對面的動作抓走。',
 '派紙鵝防疫隊駐守滑鼠，拉起「本區不是採礦場」封鎖線。',
 '愛麗絲替紙鵝戴上面紙口罩，笑完才跟你一起直接提醒對方。紙封鎖線沒有殺菌功能，對方總算願意先停下來清理。',
 '幹，我是來上班，不是坐第一排看人體採礦。先請他去清理，別只跟我吐槽，共用滑鼠還照樣輪下一個人。',
 '靠北，洗手跟清理講清楚就好。別又把那段動作演給我看一次，我剛才已經被迫看過完整版。',
 [],'office_day',{minTurn:2,weight:.9,era:'愛麗絲・斜對面的突發狀況'}
])]);
export const FIVE_CAST_EVENTS_V74=Object.freeze([...WINE_EVENTS_V74,...PETER_EVENTS_V74,...TONY_EVENTS_V74,...HENRY_EVENTS_V74,...MIA_EVENTS_V74]);
export const CAST_EVENTS_V74=Object.freeze([...FIVE_CAST_EVENTS_V74,...ALICE_HYGIENE_EVENTS_V74]);
export const ALL_CAST_EVENTS_V74=CAST_EVENTS_V74;
