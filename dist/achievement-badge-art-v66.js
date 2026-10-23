// Original code-native badge compositions. No photos, network assets or
// external font are needed for these scene souvenirs.
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;};
const palettes=[['#fff3f7','#f5d5e2','#e76c9a','#b36e8b'],['#f1f8f5','#d1e9df','#79b69f','#629780'],['#fff8e5','#f0e1b0','#d4ae56','#a88942'],['#f3f1fb','#ded9ef','#9e89bf','#80719e'],['#eef7fb','#d2e6ef','#73a9bc','#5b899d'],['#fff3ec','#f2dac8','#ce9670','#a77c60']];
const icons={
 folder:'<path d="M-44-25v-14h34l12 14h43v66h-89z" fill="A"/><path d="M-31-21h61v46h-61z" fill="W"/><path d="M-44-6h99L40 47h-88z" fill="A"/>',
 laptop:'<rect x="-36" y="-35" width="72" height="56" rx="4" fill="W"/><path d="M-36 21h72l14 15q0 8-9 8h-82q-9 0-9-8z" fill="A"/><path d="M-23-20h45m-45 14h27m-27 14h39" fill="none"/>',
 phone:'<rect x="-25" y="-46" width="50" height="92" rx="9" fill="W"/><path d="M-11-34h22m-25 18h28m-28 15h21m-21 15h28" fill="none"/><circle cy="34" r="3" fill="A"/>',
 cup:'<path d="M-32-28h64l-8 73h-48z" fill="A"/><path d="M-37-39h74v13h-74z" fill="W"/><path d="m9-52-4 61M-23 7h44" fill="none"/>',
 book:'<path d="M0-28q-18-16-43-7v72q25-9 43 7 18-16 43-7v-72Q18-44 0-28z" fill="W"/><path d="M0-28v72m-31-61 20 5m-20 12 20 5m22-5 20-5m-20-12 20-5" fill="none"/>',
 wallet:'<rect x="-43" y="-28" width="86" height="64" rx="9" fill="A"/><path d="M-35-28v-12l64-7v19" fill="W"/><path d="M17-10h31v28H17q-12-14 0-28z" fill="W"/><circle cx="30" cy="4" r="3" stroke="none" fill="#293044"/>',
 board:'<rect x="-43" y="-38" width="86" height="63" rx="4" fill="W"/><path d="M-20 25v24m40-24v24M-29 8l18-17 17 6 22-22" fill="none" stroke="A"/><path d="M20-25h8v9" fill="none"/>',
 palette:'<path d="M37-31q-38-35-72 3-29 35 10 63 23 14 39-1-12-17 1-20 27 3 22-24z" fill="W"/><circle cx="-23" cy="-9" r="6" fill="A"/><circle cx="-6" cy="-25" r="6" fill="A"/><circle cx="16" cy="-22" r="6" fill="A"/><circle cx="-22" cy="15" r="6" fill="A"/>',
 calendar:'<rect x="-39" y="-37" width="78" height="80" rx="8" fill="W"/><path d="M-39-14h78m-59-35v24m40-24v24M-23 1h13m8 0h13m8 0h8M-23 17h13m8 0h13m8 0h8M-23 32h13m8 0h13" fill="none"/>',
 cloud:'<path d="M-29 25q-29-3-22-25 4-14 21-15 5-29 29-25 22 2 23 25 24-2 29 17 5 23-23 24z" fill="W"/><circle cx="-17" cy="44" r="5" fill="A"/><circle cx="-30" cy="56" r="3" fill="A"/>',
 storm:'<path d="M-29 4q-26-3-20-23 6-15 22-14 11-22 31-13 14 5 16 21 25-1 28 16Q53 8 28 8z" fill="W"/><path d="m0 9-15 22H2L-6 50l28-30H6l10-11" fill="A"/>',
 shield:'<path d="M0-47q17 13 36 13v34q-2 31-36 48Q-34 31-36 0v-34q19 0 36-13z" fill="A"/><path d="m-18 0 12 13 25-29" fill="none"/>',
 megaphone:'<path d="m-35-15 55-23V30l-55-22z" fill="A"/><path d="M-35-15h-12V8h12m15 6 5 28h17L-2 20M31-14l15-6m-15 22h19m-19 16 15 6" fill="W"/>',
 arm:'<path d="m-42 37 8-44 12-28q6-13 18-7l12 6q10 4 4 16l-4 7-14-8-5 21Q17-19 36-1q15 15 8 38z" fill="A"/><path d="M-11 0q-12 4-15 16m34-29q9 11 7 25M-34 26H36" fill="none"/>',
 booth:'<path d="M-43-10h86v59h-86z" fill="W"/><path d="M-51-34h102v26H-51z" fill="A"/><path d="M-34-34v26m23-26v26m22-26v26m23-26v26M-31 8h36v22h-36m48-22h14v41M-51 49H51" fill="none"/>',
 fish:'<ellipse cy="24" rx="50" ry="15" fill="W"/><path d="M-33 8q26-31 57-6l18-15v32L24 8Q-8 34-33 8z" fill="A"/><circle cx="-19" cy="7" r="3" fill="#293044" stroke="none"/><path d="M-6-5q9 11 0 25" fill="none"/>',
 mic:'<rect x="-14" y="-41" width="28" height="54" rx="14" fill="A"/><path d="M-24-5v9q0 25 24 25T24 4v-9M0 29v20m-19 0h38M-7-27H7m-14 10H7" fill="none"/>',
 basketball:'<circle r="42" fill="A"/><path d="M-42 0h84M0-42v84M-28-31q42 31 0 62m56-62q-42 31 0 62" fill="none"/>',
 camel:'<path d="M-43 18v-20q3-16 13-4 7-27 18-2 12-27 24-2l9 2 4-30q3-14 13-12l8 3v12l-10 3 1 42-10 9v24H16V26H-20v24h-12V26z" fill="A"/><path d="M-26 5h34m27-39h1" fill="none"/>',
 receipt:'<path d="M-31-44h62v88l-10-6-10 6-11-6-11 6-10-6-10 6z" fill="W"/><path d="M-19-27h38m-38 13h22m-22 17h38m-38 14h22" fill="none"/>',
 coins:'<path d="M-39 8v23q0 13 39 13T39 31V8" fill="A"/><ellipse cy="8" rx="39" ry="13" fill="W"/><path d="M-31-14V8q0 13 31 13T31 8v-22" fill="A"/><ellipse cy="-14" rx="31" ry="12" fill="W"/>',
 door:'<path d="M-40 50v-99h75v99" fill="W"/><path d="m-22-34 42-12v96h-42z" fill="A"/><circle cx="8" cy="7" r="3" fill="#293044" stroke="none"/><path d="M-49 50h99" fill="none"/>',
 badge:'<path d="M-16-39v-13h32v13" fill="none"/><rect x="-33" y="-39" width="66" height="85" rx="9" fill="W"/><path d="M-33-16h66" fill="none"/><circle cy="5" r="11" fill="A"/><path d="M-19 33q2-17 19-17t19 17" fill="A"/>',
 chair:'<rect x="-30" y="-43" width="60" height="53" rx="12" fill="A"/><path d="M-40 8v16h80V8M0 24v27m-29 0h58" fill="W"/><circle cx="-30" cy="54" r="4"/><circle cx="30" cy="54" r="4"/>',
 cake:'<ellipse cy="37" rx="50" ry="14" fill="W"/><path d="M-39-16h78v52q-39 19-78 0z" fill="A"/><ellipse cy="-16" rx="39" ry="17" fill="W"/><path d="M-39-13v12q10 12 18 0 9 14 21 1 11 12 20-1 10 12 19 0v-12M-17-27v-20m17 15v-19m17 24v-20" fill="none"/>'
};
const secondary={stories:'book',professions:'badge',wallet:'coins',rage:'shield',verbal:'megaphone',activities:'calendar',career:'door',craft:'laptop',office:'folder',banquet:'cake'};
export function renderAchievementBadgeV66(item){
 const seed=hash(item.id),p=palettes[seed%palettes.length],main=icons[item.art]?item.art:'folder',side=secondary[item.group]||'badge';
 const icon=(key,x,y,scale)=>`<g transform="translate(${x} ${y}) scale(${scale})">${icons[key].replaceAll('A',p[2]).replaceAll('W','#fffaf4')}</g>`;
 const dots=1+seed%3,tilt=(seed%5-2)*4,small=seed%2?'calendar':'receipt';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-labelledby="${item.id}-title ${item.id}-desc" data-art-version="66"><title id="${item.id}-title">${esc(item.title)}</title><desc id="${item.id}-desc">${esc(item.description)}</desc><rect width="240" height="200" rx="28" fill="${p[0]}"/><circle cx="120" cy="98" r="76" fill="${p[1]}"/><path d="M35 172q85 14 170 0" fill="none" stroke="${p[3]}" opacity=".55" stroke-width="4" stroke-linecap="round"/><g stroke="#293044" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><g transform="rotate(${tilt} 111 101)">${icon(main,111,101,.92)}</g><circle cx="179" cy="142" r="28" fill="${p[0]}" stroke="${p[3]}" stroke-width="2.5"/>${icon(side,179,142,.38)}${icon(small,49,143,.3)}</g><g fill="${p[2]}">${Array.from({length:dots},(_,i)=>`<circle cx="${176+i*12}" cy="42" r="4"/>`).join('')}</g><path d="M205 85h10m-5-5v10M26 116h10" fill="none" stroke="${p[2]}" stroke-width="3" stroke-linecap="round"/></svg>\n`;
}
