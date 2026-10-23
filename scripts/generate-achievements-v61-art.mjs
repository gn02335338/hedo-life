// Original vector badges for three fictional office-food interludes.
import {mkdir,writeFile} from 'node:fs/promises';
import {ACHIEVEMENTS_V61} from '../dist/achievements-v61.js';

const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const palettes={office:['#fff3f7','#f8d7e4','#ed6995','#c67898'],craft:['#edf8f6','#cce7df','#75bba9','#5a9c8c'],banquet:['#fff4f0','#f6d5c7','#e99775','#ba806d']};
const icons={
 cup:'<path d="M-32-30h64l-8 77h-48z" fill="A"/><path d="M-38-39h76v12h-76z" fill="W"/><path d="m9-54-2 64M-28 4h56" fill="none"/><path d="M-19 36h13m14 0h11" fill="none" stroke="W"/>',
 toppings:'<path d="M-33-31h66l-9 78h-48z" fill="A"/><path d="M-39-40h78v12h-78z" fill="W"/><path d="m12-57-4 38" fill="none"/><path d="M-29-7q14-20 29-3t29-3" fill="W"/><circle cx="-13" cy="15" r="5" fill="W"/><circle cx="6" cy="15" r="5" fill="W"/><circle cx="-3" cy="31" r="5" fill="W"/><circle cx="15" cy="31" r="5" fill="W"/>',
 gift:'<rect x="-37" y="-9" width="74" height="52" rx="5" fill="A"/><path d="M-42-22h84v17h-84z" fill="W"/><path d="M0-22v65m0-66q-35-30-33-8 3 15 33 8zm0 0q35-30 33-8-3 15-33 8z" fill="W"/>',
 hand:'<path d="M-27 35v-29q0-14 12-14v-27q0-11 10-11t10 11v27-35q0-11 10-11t10 11v36-27q0-11 10-11t10 11v34-16q0-11 10-11t10 11v33q-1 18-18 30v13H-8V48z" fill="A"/>',
 shield:'<path d="M0-47q17 13 36 13v34q-2 31-36 48Q-34 31-36 0v-34q19 0 36-13z" fill="A"/><path d="m-18 0 12 13 25-29" fill="none"/>',
 phone:'<rect x="-25" y="-46" width="50" height="92" rx="9" fill="W"/><path d="M-10-35h20m-24 12h28m-28 12H8m-22 12h22" fill="none"/><circle cy="33" r="4" fill="A"/>',
 shop:'<path d="M-43-10h86v59h-86z" fill="W"/><path d="M-51-34h102v26H-51z" fill="A"/><path d="M-34-34v26m23-26v26m22-26v26m23-26v26M-31 8h36v22h-36m48-22h14v41M-51 49H51" fill="none"/>',
 star:'<path d="m0-46 14 30 33 4-24 24 5 34L0 30l-28 16 5-34-24-24 33-4z" fill="A"/>',
 tag:'<path d="m-42-19 22-22h52v80h-52l-22-22z" fill="W"/><circle cx="-20" cy="-19" r="5" fill="A"/><path d="M-5-19h24m-24 15h24m-24 15h17" fill="none"/>',
 list:'<rect x="-36" y="-41" width="72" height="86" rx="7" fill="W"/><path d="M-12-17h34m-34 23h34m-34 23h34" fill="none"/><path d="m-25-20 4 5 8-10m-12 28 4 5 8-10m-12 28 4 5 8-10" stroke="A" fill="none"/>',
 folder:'<path d="M-45-24v-14h35l10 14h45v64h-90z" fill="A"/><path d="M-33-18h61v46h-61z" fill="W"/><path d="M-45-8h99L40 47h-88z" fill="A"/>',
 cake:'<ellipse cy="37" rx="50" ry="14" fill="W"/><path d="M-39-16h78v52q-39 19-78 0z" fill="A"/><ellipse cy="-16" rx="39" ry="17" fill="W"/><path d="M-39-13v12q10 12 18 0 9 14 21 1 11 12 20-1 10 12 19 0v-12M-39 22q39 19 78 0M-17-27v-20m17 15v-19m17 24v-20" fill="none"/><path d="M-17-48q-10-11 0-17 10 6 0 17zm17-4q-10-11 0-17 10 6 0 17zm17 4q-10-11 0-17 10 6 0 17z" fill="A"/>',
 ice:'<path d="m-32-26 48-13 20 21v48l-48 12-20-22z" fill="#d5eef4"/><path d="m-32-26 20 21 48-13M-12-5v47m-6-29 8-12m17 21 8-13" fill="none"/>',
 clock:'<circle r="42" fill="W"/><path d="M0-29V0l20 13M0-42v7m42 7h-7M0 42v-7m-42-7h7" fill="none"/><circle r="5" fill="A"/>',
 goose:'<path d="M-43 20q-11-30 15-38 22-7 32 12L14 6V-19q-1-24 20-24 17 0 17 17 0 10-13 15l-1 29q-1 29-34 29-31 0-46-27z" fill="W"/><path d="m47-30 16 9-18 3" fill="A"/><circle cx="33" cy="-30" r="2.5" fill="#273144" stroke="none"/><path d="M-21 7q12 24 31 10M-16 47v8m24-8v8" fill="none"/>',
 crown:'<path d="m-40-30 21 20 19-34 19 34 21-20-8 65h-64z" fill="A"/><path d="M-32 18h64" fill="none"/><circle cx="-40" cy="-34" r="5" fill="W"/><circle cy="-48" r="5" fill="W"/><circle cx="40" cy="-34" r="5" fill="W"/>'
};
const recipes={
 'treat-jack-drink':['cup','gift','phone',null,'傑克請客的飲料確實送到手上，禮物盒和聯絡電話陪著這杯下班前的小確幸。'],
 'treat-jack-decline':['hand','cup','shield',null,'手掌明確拒絕免費飲料，自己的選擇留在保護盾內，杯子沒有被強塞過來。'],
 'treat-jonathan-toppings':['toppings','phone','tag',null,'強哥那杯塞滿配料的飲料旁放著點單標籤，杯子的內容比責任範圍還滿。'],
 'tea-star-and-half':['shop','cup','star','1.5','公司下午茶選中的店家旁標著一點五顆星，飲料仍照訂單進了公司。'],
 'tea-name-check':['cup','tag','list',null,'飲料杯名與點單清單一起核對，標籤有名字，沒有替拿錯者編出一個名字。'],
 'tea-no-scapegoat':['folder','shield','cup',null,'下午茶取消後，杯子與已知經過收在資料夾，盾牌擋住沒有證據的指名。'],
 'cake-jack-relief':['cake','hand','ice',null,'尚未退冰的生日蛋糕旁伸出幫忙的手，傑克不用再獨自硬切那塊冰。'],
 'cake-goose-chair':['goose','cake','crown',null,'玩具鵝接手主持生日場合，蛋糕和小皇冠留在一旁，真人先等待安全分切。'],
 'cake-let-it-thaw':['cake','clock','ice',null,'蛋糕旁留著耐心的時鐘與未融冰塊，合照拍完了，分切可以等退冰。']
};
const icon=(name,x,y,size,p)=>{if(!icons[name])throw new Error(`Unknown badge icon ${name}`);return `<g transform="translate(${x} ${y}) scale(${size})">${icons[name].replaceAll('A',p[2]).replaceAll('W','#fffaf4')}</g>`;};
function render(item){
 const r=recipes[item.id];if(!r)throw new Error(`Missing badge recipe ${item.id}`);const p=palettes[item.group];
 const picture=icon(r[0],111,105,r[0]==='cake'?.88:1.02,p)+`<circle cx="177" cy="139" r="27" fill="${p[0]}" stroke="${p[3]}" stroke-width="2.5"/>`+icon(r[1],177,139,.43,p)+icon(r[2],51,143,.34,p)+(r[3]?`<circle cx="183" cy="47" r="21" fill="#fffaf4" stroke="${p[3]}" stroke-width="3"/><text x="183" y="53" text-anchor="middle" fill="#273144" stroke="none" font-family="system-ui,sans-serif" font-weight="800" font-size="15">${r[3]}</text>`:'');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-labelledby="${item.id}-title ${item.id}-desc" data-art-version="61">
 <title id="${item.id}-title">${esc(item.title)}</title>
 <desc id="${item.id}-desc">${esc(r[4])}</desc>
 <rect width="240" height="200" rx="28" fill="${p[0]}"/>
 <circle cx="120" cy="98" r="76" fill="${p[1]}"/>
 <path d="M35 172q85 14 170 0" fill="none" stroke="${p[3]}" opacity=".55" stroke-width="4" stroke-linecap="round"/>
 <g stroke="#273144" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${picture}</g>
 <path d="M205 85h10m-5-5v10M26 116h10" fill="none" stroke="${p[2]}" stroke-width="3" stroke-linecap="round"/>
</svg>\n`;
}
await mkdir(new URL('../dist/assets/achievements/',import.meta.url),{recursive:true});
for(const item of ACHIEVEMENTS_V61)await writeFile(new URL(`../dist/assets/achievements/${item.id}.svg`,import.meta.url),render(item));
console.log(`Wrote ${ACHIEVEMENTS_V61.length} original illustrated achievement badges.`);
