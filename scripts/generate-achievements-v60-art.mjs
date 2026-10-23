// Original code-native milestone illustrations, matching the existing badges.
import {writeFile,mkdir} from 'node:fs/promises';
import {ACHIEVEMENTS_V60} from '../dist/achievements-v60.js';

const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const palettes={
 office:['#fff3f7','#f8d7e4','#ed6995','#c67898'],
 craft:['#edf8f6','#cce7df','#75bba9','#5a9c8c'],
 career:['#fff8df','#eddfa3','#d9b657','#b79537'],
 wallet:['#fff8df','#eddfa3','#d9b657','#b79537'],
 banquet:['#fff4f0','#f6d5c7','#e99775','#ba806d']
};
const icons={
 receipt:'<path d="M-31-44h62v88l-10-6-10 6-11-6-11 6-10-6-10 6z" fill="W"/><path d="M-19-27h38m-38 13h22m-22 17h38m-38 14h22M10 9v18m7-14H6q-8 0-7 5t8 5h5" fill="none"/>',
 coins:'<ellipse cy="31" rx="39" ry="13" fill="A"/><path d="M-39 9v22q0 13 39 13T39 31V9" fill="A"/><ellipse cy="9" rx="39" ry="13" fill="W"/><path d="M-31-13V9q0 13 31 13T31 9v-22" fill="A"/><ellipse cy="-13" rx="31" ry="12" fill="W"/><path d="M0-43v29m10-22h-15q-11 0-10 8t12 8h8q12 0 12 8-1 9-12 9h-17" fill="none"/>',
 wallet:'<rect x="-43" y="-29" width="86" height="65" rx="9" fill="A"/><path d="M-36-29v-12l65-7v19" fill="W"/><path d="M17-11h31v29H17q-12-14 0-29z" fill="W"/><circle cx="29" cy="4" r="3" stroke="none" fill="#273144"/>',
 chair:'<rect x="-30" y="-43" width="60" height="53" rx="12" fill="A"/><path d="M-40 8v16h80V8M-28 10v12m56-12v12M0 24v27m-29 0h58" fill="W"/><circle cx="-30" cy="54" r="4"/><circle cx="30" cy="54" r="4"/>',
 door:'<path d="M-40 50v-99h75v99" fill="W"/><path d="m-22-34 42-12v96h-42z" fill="A"/><circle cx="8" cy="7" r="3" fill="#273144" stroke="none"/><path d="M-49 50h99" fill="none"/>',
 mic:'<rect x="-14" y="-41" width="28" height="54" rx="14" fill="A"/><path d="M-24-5v9q0 25 24 25T24 4v-9M0 29v20m-19 0h38M-7-27H7m-14 10H7" fill="none"/>',
 paper:'<path d="M-31-47H9l25 25v70h-65z" fill="W"/><path d="M9-47v25h25M-19-8h39m-39 14h39m-39 14H7m-26 14h31" fill="none"/><path d="m-12 20 7 7 18-19" fill="none" stroke="A"/>',
 list:'<rect x="-36" y="-41" width="72" height="86" rx="7" fill="W"/><path d="M-12-17h34m-34 23h34m-34 23h34" fill="none"/><path d="m-25-20 4 5 8-10m-12 28 4 5 8-10m-12 28 4 5 8-10" stroke="A" fill="none"/>',
 folder:'<path d="M-45-24v-14h35l10 14h45v64h-90z" fill="A"/><path d="M-33-18h61v46h-61z" fill="W"/><path d="M-45-8h99L40 47h-88z" fill="A"/>',
 laptop:'<path d="M-36-35h72v57h-72z" fill="W"/><path d="M-36 22h72l14 15q0 8-8 8h-84q-8 0-8-8z" fill="A"/><path d="M-23-20h46m-46 13H3m-26 13h39M-10 31h20" fill="none"/>',
 arm:'<path d="m-42 37 8-44 12-28q6-13 18-7l12 6q10 4 4 16l-4 7-14-8-5 21Q17-19 36-1q15 15 8 38z" fill="A"/><path d="M-11 0q-12 4-15 16m34-29q9 11 7 25M-34 26H36" fill="none"/>',
 clock:'<circle r="42" fill="W"/><path d="M0-29V0l20 13M0-42v7m42 7h-7M0 42v-7m-42-7h7" fill="none"/><circle r="5" fill="A"/>',
 hand:'<path d="M-27 35v-29q0-14 12-14v-27q0-11 10-11t10 11v27-35q0-11 10-11t10 11v36-27q0-11 10-11t10 11v34-16q0-11 10-11t10 11v33q-1 18-18 30v13H-8V48z" fill="A"/>',
 calendar:'<rect x="-39" y="-37" width="78" height="80" rx="8" fill="W"/><path d="M-39-14h78m-59-36v25m40-25v25" fill="none"/><path d="M-23 0h13m8 0h13m8 0h8M-23 15h13m8 0h13m8 0h8M-23 30h13m8 0h13" fill="none" stroke="A"/>',
 booth:'<path d="M-43-10h86v59h-86z" fill="W"/><path d="M-51-34h102v26H-51z" fill="A"/><path d="M-34-34v26m23-26v26m22-26v26m23-26v26M-31 8h36v22h-36m48-22h14v41M-51 49H51" fill="none"/>',
 fish:'<ellipse cy="23" rx="50" ry="16" fill="W"/><path d="M-33 8q26-31 57-6l18-15v32L24 8Q-8 34-33 8z" fill="A"/><circle cx="-19" cy="7" r="2.5" fill="#273144" stroke="none"/><path d="M-6-5q9 11 0 25" fill="none"/>',
 music:'<path d="M-17 20v-52l50-10v52M-17-18l50-10" fill="none"/><ellipse cx="-29" cy="22" rx="15" ry="11" fill="A" transform="rotate(-20 -29 22)"/><ellipse cx="21" cy="12" rx="15" ry="11" fill="A" transform="rotate(-20 21 12)"/>',
 basketball:'<circle r="42" fill="A"/><path d="M-42 0h84M0-42v84M-28-31q42 31 0 62m56-62q-42 31 0 62" fill="none"/>',
 bandage:'<g transform="rotate(-35)"><rect x="-46" y="-18" width="92" height="36" rx="15" fill="W"/><path d="M-15-17h30v34h-30z" fill="A"/><path d="M-34-7v1m0 12v1m8-14v1m0 12v1m52-14v1m0 12v1m8-14v1m0 12v1" fill="none"/></g>',
 umbrella:'<path d="M-46-1Q0-74 46-1q-16-14-30 0-16-14-32 0-14-14-30 0z" fill="A"/><path d="M0-43v77q0 21-20 10" fill="none"/>',
 badge:'<path d="M-16-39v-13h32v13" fill="none"/><rect x="-33" y="-39" width="66" height="85" rx="9" fill="W"/><path d="M-33-16h66" fill="none"/><circle cy="5" r="11" fill="A"/><path d="M-19 33q2-17 19-17t19 17" fill="A"/>',
 crown:'<path d="m-40-30 21 20 19-34 19 34 21-20-8 65h-64z" fill="A"/><path d="M-32 18h64" fill="none"/><circle cx="-40" cy="-34" r="5" fill="W"/><circle cy="-48" r="5" fill="W"/><circle cx="40" cy="-34" r="5" fill="W"/>',
 mail:'<rect x="-43" y="-29" width="86" height="60" rx="7" fill="W"/><path d="m-41-26 41 32 41-32m-82 55 28-25m54 25L13 4" fill="none"/>',
 phone:'<rect x="-25" y="-46" width="50" height="92" rx="9" fill="W"/><path d="M-10-35h20m-24 12h28m-28 12H8m-22 12h22" fill="none"/><circle cy="33" r="4" fill="A"/>',
 shield:'<path d="M0-47q17 13 36 13v34q-2 31-36 48Q-34 31-36 0v-34q19 0 36-13z" fill="A"/><path d="m-18 0 12 13 25-29" fill="none"/>',
 bubble:'<path d="M-43-31h86v54H-8l-22 22V23h-13z" fill="W"/><path d="M-26-12h52m-52 16H8" fill="none"/>',
 book:'<path d="M0-28q-18-16-43-7v72q25-9 43 7 18-16 43-7v-72Q18-44 0-28z" fill="W"/><path d="M0-28v72m-31-61 20 5m-20 12 20 5m22-5 20-5m-20-12 20-5" fill="none"/>',
 megaphone:'<path d="m-35-15 55-23V30l-55-22z" fill="A"/><path d="M-35-15h-12V8h12m15 6 5 28h17L-2 20M31-14l15-6m-15 22h19m-19 16 15 6" fill="W"/>',
 star:'<path d="m0-46 14 30 33 4-24 24 5 34L0 30l-28 16 5-34-24-24 33-4z" fill="A"/>'
};
const recipes={
 'stock-receipt':['receipt','coins','folder',null,'認股收據旁放著實付的硬幣與資料夾，投資先留下自己的付款紀錄。'],
 'stock-heavy-bag':['wallet','coins','receipt',50,'厚厚的認股硬幣壓住錢包與收據，五十格生活費比願景先到位。'],
 'stock-cash-before-vision':['wallet','shield','booth',null,'錢包留在保護盾後，認股攤位還在遠處，生活費沒有先匯出去。'],
 'shareholder-own-chair':['chair','receipt','door',null,'認股收據與自己的會場椅子相連，門已為付款的人打開。'],
 'shareholder-proxy-chair':['chair','mail','laptop',null,'空椅子上留著代理文件，本人已回到旁邊的工作電腦。'],
 'shareholder-first-objection':['mic','paper','shield',null,'麥克風旁第一次放上對準說法的文件，證據替問題守住位置。'],
 'shareholder-four-minutes':['paper','list','mic',4,'四項已核對的會議紀錄與麥克風並列，問題各自有了句號。'],
 'shareholder-two-followups':['list','clock','paper',2,'兩項有編號的待回覆清單留在時鐘旁，之後終於可以逐項核對。'],
 'shareholder-four-pass':['chair','mic','clock',4,'四輪都坐在會場，麥克風留在一旁，問題跟著時鐘繼續等。'],
 'shareholder-page-mismatch':['folder','door','paper',3,'翻錯的三份資料留在會場門旁，人先帶著文件離席冷靜。'],
 'shareholder-seven-files':['folder','list','receipt',7,'七份資料收入打開的文件夾，紙張已經能流通，股票仍在等待。'],
 'shareholder-back-to-work':['laptop','receipt','clock',null,'會議收據收進工作電腦旁，散會後的時鐘重新指向員工工時。'],
 'play-arm-eight':['arm','music','clock',8,'腕力手臂照八拍節奏出力，計時器已停，補充聲明還在後面。'],
 'play-arm-twenty-eight':['arm','hand','clock',28,'出力手臂、點按的手掌與計時器一起留下二十八次持續操作。'],
 'play-arm-stop':['hand','clock','chair',null,'手掌明確喊停，計時器走完，腕力比賽沒有拿沒出力當輸贏。'],
 'play-diet-weekend':['calendar','fish','chair',7,'七天行事曆裡有正餐，週末也保留一張能好好休息的椅子。'],
 'play-road-six':['booth','list','mail',6,'六位訪客的問題送到合適展位，名單上沒有自己長大的數字。'],
 'play-dinner-shared':['fish','coins','chair',6,'六道共享菜轉到桌上，比目魚有份，預算與座位都照顧到了。'],
 'play-banquet-twelve':['music','mic','paper',12,'十二個拍點接住麥克風，願景簡報暫時只能停在一旁。'],
 'play-basket-five':['basketball','list','hand',5,'五波球路都對上配合，籃球直接找到舉手的空檔隊友。'],
 'play-basket-sonny-bench':['chair','bandage','basketball',null,'碰上移動迷宮後，把瘀青帶到板凳休息，球留給候補。'],
 'play-basket-owen-bench':['bandage','chair','basketball',null,'遇上飛天拐子的碰撞，先收好傷處再坐下，沒有硬撐換比分。'],
 'play-review-four':['paper','umbrella','list',4,'四份佐證對上四個問題，雨傘終於不用代替專案負責人。'],
 'kin-direct-son':['badge','crown','phone',null,'特殊任用工作證與象徵稱謂的皇冠並列，旁邊電話提醒瑞克還在。'],
 'kin-direct-daughter':['crown','badge','book',null,'新的特殊任用稱謂搭配已領取的工作證，組織圖正式多了一格。'],
 'kin-offer-declined':['mail','door','badge',null,'特殊任用錄取信留在門內，工作證未領，玩家選擇離開。'],
 'kin-rick-boundary':['shield','phone','paper',null,'電話停在書面界線外，新來的自己人沒有自動接下瑞克的工作。'],
 'kin-princess-english':['book','paper','clock',null,'英文書、工作負責文件與期限時鐘擺在一起，分工有了明確主詞。'],
 'kin-application-approved':['badge','paper','phone',null,'正式任用文件附上工作證，瑞克的電話留在一旁，沒有替錄取鼓掌。'],
 'kin-application-rejected':['mail','phone','folder',null,'沒有獲准的申請信與瑞克的聯絡清單同框，職稱沒換，關係先變。'],
 'kin-upward-applause':['crown','bubble','star',null,'往高層遞出的諂媚對話真的得到正面回應，掌聲沿階級往上走。'],
 'kin-downward-rebound':['megaphone','bubble','badge',null,'擺架子的擴音器收到回嘴，特殊工作證沒有把別人的聲音關掉。']
};
const icon=(name,x,y,scale,palette)=>{
 if(!Object.hasOwn(icons,name))throw new Error(`Unknown achievement icon ${name}`);
 return `<g transform="translate(${x} ${y}) scale(${scale})">${icons[name].replaceAll('A',palette[2]).replaceAll('W','#fffaf4')}</g>`;
};
function render(item){
 const recipe=recipes[item.id];if(!recipe)throw new Error(`Missing achievement recipe ${item.id}`);
 const [main,secondary,extra,count,description]=recipe,p=palettes[item.group];
 const picture=icon(main,111,101,1.02,p)+`<circle cx="177" cy="139" r="27" fill="${p[0]}" stroke="${p[3]}" stroke-width="2.5"/>`+icon(secondary,177,139,.43,p)+icon(extra,51,143,.34,p)+(count?`<circle cx="183" cy="47" r="21" fill="#fffaf4" stroke="${p[3]}" stroke-width="3"/><text x="183" y="54" text-anchor="middle" fill="#273144" stroke="none" font-family="system-ui,sans-serif" font-weight="800" font-size="18">${count}</text>`:'');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-labelledby="${item.id}-title ${item.id}-desc" data-art-version="60">
 <title id="${item.id}-title">${esc(item.title)}</title>
 <desc id="${item.id}-desc">${esc(description)}</desc>
 <rect width="240" height="200" rx="28" fill="${p[0]}"/>
 <circle cx="120" cy="98" r="76" fill="${p[1]}"/>
 <path d="M35 172q85 14 170 0" fill="none" stroke="${p[3]}" opacity=".55" stroke-width="4" stroke-linecap="round"/>
 <g stroke="#273144" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${picture}</g>
 <path d="M205 85h10m-5-5v10M26 116h10" fill="none" stroke="${p[2]}" stroke-width="3" stroke-linecap="round"/>
</svg>\n`;
}
await mkdir(new URL('../dist/assets/achievements/',import.meta.url),{recursive:true});
for(const item of ACHIEVEMENTS_V60)await writeFile(new URL(`../dist/assets/achievements/${item.id}.svg`,import.meta.url),render(item));
console.log(`Wrote ${ACHIEVEMENTS_V60.length} original illustrated achievement badges.`);
