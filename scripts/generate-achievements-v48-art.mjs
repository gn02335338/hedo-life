// Hand-authored, code-native badge art. Run after updating ACHIEVEMENTS_V48.
// Each recipe describes an earned feat; locked UI must never render these files.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {ACHIEVEMENTS_V48} from '../dist/achievements-v48.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'dist/assets/achievements');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
const palettes={
 verbal:{bg:'#fff4f0',wash:'#f8d7e4',accent:'#ed6995',edge:'#c67898'},
 rage:{bg:'#f7f1ff',wash:'#ded1ef',accent:'#a987cf',edge:'#9c7db5'},
 office:{bg:'#fff3f7',wash:'#f8d7e4',accent:'#ed6995',edge:'#c67898'},
 career:{bg:'#fff8df',wash:'#eddfa3',accent:'#d9b657',edge:'#b79537'},
 craft:{bg:'#edf8f6',wash:'#cce7df',accent:'#75bba9',edge:'#5a9c8c'},
 wallet:{bg:'#fff8df',wash:'#eddfa3',accent:'#d9b657',edge:'#b79537'},
 banquet:{bg:'#fff4f0',wash:'#f6d5c7',accent:'#e99775',edge:'#ba806d'}
};
const icons={
 mic:`<rect x="-14" y="-41" width="28" height="54" rx="14" fill="A"/><path d="M-24-5v9q0 25 24 25T24 4v-9M0 29v20m-19 0h38M-7-27H7m-14 10H7" fill="none"/>`,
 badge:`<path d="M-16-39v-13h32v13" fill="none"/><rect x="-33" y="-39" width="66" height="85" rx="9" fill="W"/><path d="M-33-16h66" fill="none"/><circle cy="5" r="11" fill="A"/><path d="M-19 33q2-17 19-17t19 17" fill="A"/>`,
 clover:`<path d="M0 2c-38 6-39-39-15-38q16-1 15 23 1-24 17-23 24 0 22 22C36 4 15 4 0 2c25-4 37 17 21 32C3 51-4 24 0 2c-1 23-26 37-37 18C-48 1-19-5 0 2z" fill="A"/><path d="M0 6q-5 26 15 43" fill="none"/>`,
 shield:`<path d="M0-47q17 13 36 13v34q-2 31-36 48Q-34 31-36 0v-34q19 0 36-13z" fill="A"/><path d="m-18 0 12 13 25-29" fill="none"/>`,
 fist:`<path d="M-34 30v-38q0-9 9-9v-10q0-12 11-12 10 0 10 12v-5q0-12 11-12 10 0 10 12v5q0-10 10-10 10 0 10 10v13q0-9 9-9 9 0 9 9v30q0 17-15 25v14h-51V30z" fill="A"/><path d="M-25-16v26m21-37V5m21-32V5m20-15V8M-35 4q15-7 23 3l9 11m-26 28h49" fill="none"/>`,
 glove:`<path d="M-24 40v-11q-16-9-16-30v-22q0-16 17-16h35q26 0 26 25v17q0 19-20 27v10z" fill="A"/><path d="M-21 2q-21-8-24 9-4 15 17 20m7-15V2q0-10 10-10h13M-24 40h42v13h-42z" fill="W"/>`,
 cloud:`<path d="M-32 28c-34 0-33-38-10-41-4-31 37-43 50-17 23-16 46 4 40 26 25 16 14 39-9 39h-71z" fill="W"/><circle cx="-34" cy="45" r="7" fill="W"/><circle cx="-47" cy="57" r="3" fill="W"/>`,
 calendar:`<rect x="-39" y="-37" width="78" height="80" rx="8" fill="W"/><path d="M-39-14h78m-59-36v25m40-25v25" fill="none"/><path d="M-23 0h13m8 0h13m8 0h8M-23 15h13m8 0h13m8 0h8M-23 30h13m8 0h13" fill="none" stroke="A"/>`,
 desk:`<path d="M-49 12h98v13h-98z" fill="A"/><path d="M-39 25v31m78-31v31M-32-25h64v37h-64z" fill="W"/><path d="M-23-16h46m-23 3V3m-12 0h24M0 25v31" fill="none"/>`,
 paper:`<path d="M-31-47H9l25 25v70h-65z" fill="W"/><path d="M9-47v25h25M-19-8h39m-39 14h39m-39 14H7m-26 14h31" fill="none"/><path d="m-12 20 7 7 18-19" fill="none" stroke="A"/>`,
 door:`<path d="M-40 50v-99h75v99" fill="W"/><path d="m-22-34 42-12v96h-42z" fill="A"/><circle cx="8" cy="7" r="3" fill="#273144" stroke="none"/><path d="M-49 50h99" fill="none"/>`,
 chair:`<rect x="-30" y="-43" width="60" height="53" rx="12" fill="A"/><path d="M-40 8v16h80V8M-28 10v12m56-12v12M0 24v27m-29 0h58" fill="W"/><circle cx="-30" cy="54" r="4"/><circle cx="30" cy="54" r="4"/>`,
 coins:`<ellipse cy="31" rx="39" ry="13" fill="A"/><path d="M-39 9v22q0 13 39 13T39 31V9" fill="A"/><ellipse cy="9" rx="39" ry="13" fill="W"/><path d="M-31-13V9q0 13 31 13T31 9v-22" fill="A"/><ellipse cy="-13" rx="31" ry="12" fill="W"/><path d="M0-43v29m10-22h-15q-11 0-10 8t12 8h8q12 0 12 8-1 9-12 9h-17" fill="none"/>`,
 wallet:`<rect x="-43" y="-29" width="86" height="65" rx="9" fill="A"/><path d="M-36-29v-12l65-7v19" fill="W"/><path d="M17-11h31v29H17q-12-14 0-29z" fill="W"/><circle cx="29" cy="4" r="3" stroke="none" fill="#273144"/>`,
 coffee:`<path d="M-30-15h55v43q0 17-28 17t-27-17z" fill="W"/><path d="M25-8h12q18 20-12 29M-43 49h82M-16-31q-10-10 1-20m16 20q-10-10 1-20m15 20q-10-10 1-20" fill="none"/><path d="M-30 8h55" stroke="A"/>`,
 bowl:`<path d="M-44-4h88q-5 44-44 44T-44-4z" fill="A"/><path d="M-22 46h44M-30-20l77-22m-75 33 77-22M-12-4v-27m10 27v-29m10 29v-32" fill="none"/>`,
 laptop:`<path d="M-36-35h72v57h-72z" fill="W"/><path d="M-36 22h72l14 15q0 8-8 8h-84q-8 0-8-8z" fill="A"/><path d="M-23-20h46m-46 13H3m-26 13h39M-10 31h20" fill="none"/>`,
 crown:`<path d="m-40-30 21 20 19-34 19 34 21-20-8 65h-64z" fill="A"/><path d="M-32 18h64" fill="none"/><circle cx="-40" cy="-34" r="5" fill="W"/><circle cy="-48" r="5" fill="W"/><circle cx="40" cy="-34" r="5" fill="W"/>`,
 stairs:`<path d="M-47 42v-22h24V-2H1v-22h24v-22h23v88z" fill="A"/><path d="m-45-16 66-41m-16-3 18 1-5 17" fill="none"/>`,
 books:`<path d="M-37-38h18v82h-18z" fill="A"/><path d="M-19-45H5v89h-24z" fill="W"/><path d="m5-30 20-5 20 72-21 6z" fill="A"/><path d="M-37-24h18m-18 50h18m0-52H5m-24 54H5M12-17l18-5m-5 46 18-5" fill="none"/>`,
 scale:`<path d="M0-43v87m-22 0h44M-38-25H38M-29-25-47 6h36L-29-25zm58 0L11 6h36L29-25z" fill="W"/><path d="M-47 6q3 18 18 18t18-18m22 0q3 18 18 18T47 6" fill="A"/><circle cy="-29" r="6" fill="A"/>`,
 lifebuoy:`<circle r="41" fill="A"/><circle r="21" fill="W"/><path d="m-29-29 14 14m30 30 14 14m-58 0 14-14m30-30 14-14" stroke="#fffaf4" stroke-width="13"/><circle r="41" fill="none"/><circle r="21" fill="none"/>`,
 moon:`<path d="M17-42c-39 4-56 51-21 75C23 50 46 31 47 13 13 21-3-9 17-42z" fill="A"/><path d="m-33-35 2 7 7 2-7 2-2 7-2-7-7-2 7-2zm65 2 3 9 10 3-10 3-3 10-3-10-10-3 10-3z" fill="W"/>`,
 umbrella:`<path d="M-46-1Q0-74 46-1q-16-14-30 0-16-14-32 0-14-14-30 0z" fill="A"/><path d="M0-43v77q0 21-20 10" fill="none"/>`,
 plant:`<path d="M-26 9h52l-7 36h-38z" fill="W"/><path d="M0 9v-43m0 17q-34 4-34-24 32-3 34 24zm0 11q32 0 34-29Q2-36 0-6z" fill="A"/>`,
 network:`<circle r="14" fill="A"/><path d="m-9-11-21-22m39 22 21-22m-39 44-21 22m39-22 21 22M-14 0h-28m56 0h28" fill="none"/><circle cx="-35" cy="-38" r="9" fill="W"/><circle cx="35" cy="-38" r="9" fill="W"/><circle cx="-35" cy="38" r="9" fill="W"/><circle cx="35" cy="38" r="9" fill="W"/><circle cx="-49" r="7" fill="W"/><circle cx="49" r="7" fill="W"/>`,
 heart:`<path d="M0 39C-73-6-30-56 0-22 30-56 73-6 0 39z" fill="A"/>`,
 battery:`<rect x="-42" y="-25" width="75" height="52" rx="6" fill="W"/><path d="M33-12h12v26H33" fill="A"/><path d="m-4-19-16 24H-5l-6 18 26-28H1l7-14z" fill="A"/>`,
 envelope:`<rect x="-43" y="-29" width="86" height="60" rx="7" fill="W"/><path d="m-41-26 41 32 41-32m-82 55 28-25m54 25L13 4" fill="none"/>`,
 clock:`<circle r="42" fill="W"/><path d="M0-29V0l20 13M0-42v7m42 7h-7M0 42v-7m-42-7h7" fill="none"/><circle r="5" fill="A"/>`,
 trophy:`<path d="M-25-39h50v23q0 31-25 31t-25-31z" fill="A"/><path d="M-25-29h-16v16q0 18 25 18m41-34h16v16q0 18-25 18M0 15v27m-23 6v-8h46v8z" fill="W"/>`,
 hand:`<path d="M-27 35v-29q0-14 12-14v-27q0-11 10-11t10 11v27-35q0-11 10-11t10 11v36-27q0-11 10-11t10 11v34-16q0-11 10-11t10 11v33q-1 18-18 30v13H-8V48z" fill="A"/>`,
 balloon:`<path d="M0 20C-50-8-32-49 0-49S50-8 0 20z" fill="A"/><path d="m-5 20 5-9 5 9z" fill="W"/><path d="M0 20q20 16 0 26t0 23" fill="none"/>`,
 crownChair:`<path d="M-31-6h62v42h-62z" fill="W"/><path d="M-31-6v-35l16 14L0-47l15 20 16-14v35z" fill="A"/><path d="M-39 23v15h78V23M-24 38v16m48-16v16" fill="none"/>`,
 phone:`<rect x="-25" y="-46" width="50" height="92" rx="9" fill="W"/><path d="M-10-35h20m-24 12h28m-28 12H8m-22 12h22" fill="none"/><circle cy="33" r="4" fill="A"/>`,
 noodle:`<path d="M-42 3h84q-2 34-42 34T-42 3z" fill="A"/><path d="M-24 43h48M-27 3v-25q0-18 14-18t14 18v25m8 0v-32m13 32v-36M-34-32l80-10m-78 22 80-10" fill="none"/>`,
 shoe:`<path d="m-33-34 29 5 5 30 37 17q13 5 13 24h-92v-34z" fill="A"/><path d="M-41 30h92M-3-7l-17 8m22 2-17 8m24-2-17 8" fill="none"/>`,
 coffeeTray:`<path d="M-47 29h94v10h-94z" fill="A"/><path d="M-36-10h30v25q-1 13-15 13t-15-13zM7-10h30v25q-1 13-15 13T7 15z" fill="W"/><path d="M-6-5H0q12 12-6 17m43-17h6q12 12-6 17M-21-25q-8-8 1-18m42 18q-8-8 1-18" fill="none"/>`,
 rocket:`<path d="M0-50q36 30 24 61L0 29l-24-18Q-36-20 0-50z" fill="W"/><circle cy="-13" r="10" fill="A"/><path d="M-25 1-41 26l20-7m46-18 16 25-20-7M-12 29q-4 21 12 30 16-9 12-30" fill="A"/>`,
 key:`<circle cx="-17" cy="-12" r="25" fill="A"/><circle cx="-17" cy="-12" r="8" fill="W"/><path d="m3 2 38 38-10 10-12-12 7-7-10-10-7 7-15-15" fill="A"/>`,
 megaphone:`<path d="m-35-15 55-23V30l-55-22z" fill="A"/><path d="M-35-15h-12V8h12m15 6 5 28h17L-2 20M31-14l15-6m-15 22h19m-19 16 15 6" fill="W"/>`,
 candle:`<path d="M-20-4h40v49h-40z" fill="W"/><path d="M0-8c-24-12-11-36 1-43-4 18 22 25-1 43z" fill="A"/><path d="M-29 47h58" fill="none"/>`,
 compass:`<circle r="43" fill="W"/><path d="m16-24-7 33-25 15 7-33z" fill="A"/><path d="M0-43v8m43 8h-8M0 43v-8m-43-8h8M-8 8 8-8" fill="none"/>`,
 puzzle:`<path d="M-39-36h25q-6-19 10-19t10 19h27v25q20-6 20 10T33 9v27H7q7 21-10 21t-11-21h-25V10q-20 6-20-10t20-11z" fill="A"/>`,
 bell:`<path d="M-33 26q10-14 10-39 0-23 23-23t23 23q0 25 10 39z" fill="A"/><path d="M-9 36q9 18 18 0M0-36v-10" fill="none"/>`,
 film:`<rect x="-44" y="-33" width="88" height="66" rx="5" fill="W"/><path d="M-28-33v66m56-66v66m-71-44h14m-14 22h14m-14 22h14m57-44h14m-14 22h14m-14 22h14" fill="none"/><path d="m-10-17 27 17-27 17z" fill="A"/>`,
 bridge:`<path d="M-48 28H48M-38 28v-68m76 68v-68M-38-29Q0 24 38-29M-25-13v41m16-29v29M9-1v29m16-41v41" fill="none"/>`,
 lifeRing:`<circle r="41" fill="A"/><circle r="22" fill="W"/><path d="m-29-29 14 14m30 30 14 14m-58 0 14-14m30-30 14-14" fill="none" stroke="#fffaf4" stroke-width="12"/>`,
 monitor:`<rect x="-43" y="-34" width="86" height="58" rx="6" fill="W"/><path d="M0 24v22m-24 0h48M-31-22h62v34h-62z" fill="A"/>`,
 star:`<path d="m0-46 14 30 33 4-24 24 5 34L0 30l-28 16 5-34-24-24 33-4z" fill="A"/>`,
 lock:`<rect x="-30" y="-8" width="60" height="51" rx="7" fill="A"/><path d="M-19-8v-21q0-29 25-21t18 29" fill="none"/><circle cy="13" r="7" fill="W"/><path d="M0 20v9" fill="none"/>`,
 invoice:`<path d="M-31-44h62v88l-10-6-10 6-11-6-11 6-10-6-10 6z" fill="W"/><path d="M-19-27h38m-38 13h22m-22 17h38m-38 14h22M10 9v18m7-14H6q-8 0-7 5t8 5h5" fill="none"/>`,
 headphones:`<path d="M-34 0v-13q0-36 34-36t34 36V0" fill="none"/><rect x="-43" y="-6" width="19" height="40" rx="8" fill="A"/><rect x="24" y="-6" width="19" height="40" rx="8" fill="A"/><path d="M34 34q0 17-29 17" fill="none"/><rect x="-7" y="44" width="18" height="12" rx="5" fill="W"/>`,
 feather:`<path d="M-28 29q-8-59 58-72 14 63-43 68z" fill="A"/><path d="m-41 48 64-79m-40 51 31-3m-14-15 23-4m-7-16 14-3" fill="none"/>`,
 suitcase:`<rect x="-42" y="-25" width="84" height="65" rx="8" fill="A"/><path d="M-17-25v-15h34v15m-59 26h84M-20-25v65m40-65v65" fill="none"/><rect x="-7" y="-5" width="14" height="13" rx="2" fill="W"/>`,
 lamp:`<path d="M-25-41h50l18 49h-86z" fill="A"/><path d="M0 8v35m-27 0h54M-21 52h42" fill="none"/>`,
 mountain:`<path d="m-52 40 31-70L1 12l20-55 34 83z" fill="A"/><path d="m-29-10 9 12 7-14M12-18l10 11 9-10M21-43v-15l19 8-19 8" fill="W"/>`,
 anchor:`<circle cy="-32" r="10" fill="W"/><path d="M0-22v65m-23-48h46M-42 9q5 34 42 34t42-34M-42 9l-6 19m6-19 18 8M42 9l6 19m-6-19-18 8" fill="none"/>`,
 medical:`<rect x="-41" y="-24" width="82" height="64" rx="8" fill="W"/><path d="M-15-24v-15h30v15" fill="none"/><path d="M-8-11H8V0h12v16H8v12H-8V16h-12V0h12z" fill="A"/>`,
 thermos:`<rect x="-23" y="-44" width="46" height="86" rx="10" fill="W"/><path d="M-23-26h46M-23 25h46M-12-10h24m-24 13h24" fill="none"/><path d="M-16-51h32v10h-32z" fill="A"/>`,
 arm:`<path d="m-42 37 8-44 12-28q6-13 18-7l12 6q10 4 4 16l-4 7-14-8-5 21Q17-19 36-1q15 15 8 38z" fill="A"/><path d="M-11 0q-12 4-15 16m34-29q9 11 7 25M-34 26H36" fill="none"/>`,
 tart:`<path d="m-42-9 6-14 14 4 9-12 13 8 13-8 9 12 14-4 6 14-5 36q-37 23-74 0z" fill="A"/><ellipse cy="-4" rx="40" ry="23" fill="W"/><ellipse cy="-4" rx="26" ry="13" fill="#eddfa3"/>`,
 booth:`<path d="M-43-10h86v59h-86z" fill="W"/><path d="M-51-34h102v26H-51z" fill="A"/><path d="M-34-34v26m23-26v26m22-26v26m23-26v26M-31 8h36v22h-36m48-22h14v41M-51 49H51" fill="none"/>`,
 fish:`<ellipse cy="23" rx="50" ry="16" fill="W"/><path d="M-33 8q26-31 57-6l18-15v32L24 8Q-8 34-33 8z" fill="A"/><circle cx="-19" cy="7" r="2.5" fill="#273144" stroke="none"/><path d="M-6-5q9 11 0 25" fill="none"/>`,
 basketball:`<circle r="42" fill="A"/><path d="M-42 0h84M0-42v84M-28-31q42 31 0 62m56-62q-42 31 0 62" fill="none"/>`,
 goose:`<path d="M-43 20q-11-30 15-38 22-7 32 12L14 6V-19q-1-24 20-24 17 0 17 17 0 10-13 15l-1 29q-1 29-34 29-31 0-46-27z" fill="W"/><path d="m47-30 16 9-18 3" fill="A"/><circle cx="33" cy="-30" r="2.5" fill="#273144" stroke="none"/><path d="M-21 7q12 24 31 10M-16 47v8m24-8v8" fill="none"/>`,
 warning:`<path d="M0-46 49 39h-98z" fill="A"/><path d="M0-18V9m0 13v2" fill="none"/>`,
 weather:`<circle cx="-14" cy="-16" r="22" fill="A"/><path d="M-14-48v7m-32 25h7m2-23 5 5m38-5-5 5m21 9h-7" fill="none"/><path d="M-15 29q-31-1-24-24 4-15 22-13 8-25 29-12 18-3 24 15 21 2 16 22-4 14-25 12z" fill="W"/>`,
 wrench:`<path d="M-13-20q-15-28 9-37l-1 20 18 8 14-14q8 29-20 34l-27 54q-9 13-20 3-8-8 0-18z" fill="A"/><circle cx="-27" cy="36" r="4" fill="W"/>`
};

// Filled with explicit achievement IDs below. An unknown ID is an authoring
// error, rather than a generic picture silently standing in for a new goal.
const recipes={
 'verbal-still-here-three':{main:'mic',secondary:'badge',count:3,description:'麥克風旁的在職工作證，記下三次開嗆後仍繼續工作的日常。'},
 'verbal-still-here-five':{main:'mic',secondary:'lock',extra:'badge',count:5,description:'五次發言之後，工作證和沒有換掉的門鎖仍留在一起。'},
 'verbal-still-here-eight':{main:'laptop',secondary:'mic',extra:'badge',count:8,description:'持續運作的工作電腦旁放著麥克風，第八次開嗆也沒有讓工作清單消失。'},
 'verbal-no-audience':{main:'megaphone',secondary:'envelope',count:2,description:'兩封無人接手的信停在擴音器旁，聲音有送出，沒收到回音。'},
 'verbal-echo-office':{main:'mic',secondary:'megaphone',layout:'duet',count:2,description:'麥克風和擴音器隔桌回應，兩輪互嗆成了辦公室雙聲道。'},
 'verbal-witnesses':{main:'mic',secondary:'network',extra:'paper',count:2,description:'發言麥克風連到同事網絡，兩份補充前情的文件有人一起接住。'},
 'verbal-three-agendas':{main:'paper',secondary:'mic',extra:'calendar',count:3,description:'議程文件、日曆和麥克風，留下三個不同場合的原話。'},
 'verbal-both-bosses':{main:'mic',secondary:'crownChair',extra:'crown',layout:'duet',description:'麥克風朝向兩張高層象徵，一句寄給老闆，一句寄往董事會。'},
 'verbal-onboard-return':{main:'badge',secondary:'mic',extra:'door',description:'剛拿到的工作證旁已有麥克風，報到開嗆後門禁仍然開著。'},
 'verbal-salary-return':{main:'coins',secondary:'mic',extra:'badge',description:'薪資硬幣、現場麥克風與工作證，薪資會議有音量，之後也有工作。'},
 'verbal-pip-return':{main:'paper',secondary:'mic',extra:'desk',description:'改善文件附上一支麥克風，工作桌提醒真正的交付也有留下。'},
 'verbal-private-return':{main:'bowl',secondary:'mic',extra:'badge',description:'私下飯碗旁放著麥克風，隔天仍使用的工作證把工作和口角分開。'},
 'verbal-legal-return':{main:'scale',secondary:'badge',extra:'paper',description:'正式說明的天秤旁留著逐字稿與工作證，程序之外仍照常打卡。'},
 'verbal-warning-return':{main:'paper',secondary:'warning',extra:'badge',description:'警告三角形停在書面紀錄旁，工作證沒有被改成離場證明。'},
 'verbal-dream-to-words':{main:'fist',secondary:'mic',layout:'dream',description:'拳頭留在夢泡泡內，現場的麥克風表示後來說出口的是話。'},
 'verbal-words-to-dream':{main:'mic',secondary:'cloud',extra:'fist',layout:'duet',description:'麥克風指向稍後的夢泡泡，現場發言之後才輪到腦內加演。'},
 'verbal-colleague-circuit':{main:'network',secondary:'mic',count:3,description:'跨部門聯絡網接上一支麥克風，三位同事各自收到一份現場發言。'},
 'verbal-cold-shoulder':{main:'envelope',secondary:'weather',extra:'laptop',count:2,description:'冷下來的往來改用信件，工作電腦的工單仍在運轉。'},
 'rage-truce-return':{main:'fist',secondary:'clover',extra:'badge',description:'現實拳頭旁有停火後保留的工作證與幸運草；後續仍要處理，上班也仍繼續。'},
 'rage-private-return':{main:'glove',secondary:'coffee',extra:'badge',description:'私人場合失控的拳套放在咖啡旁，工作證表示隔天仍有班。'},
 'rage-police-return':{main:'paper',secondary:'scale',extra:'badge',palette:'rage',description:'派出所說明紀錄、程序天秤和工作證並列，筆錄與工單各有一份。'},
 'rage-medical-receipt':{main:'invoice',secondary:'medical',extra:'wallet',palette:'rage',description:'事故費用收據旁放著醫療箱與打開的錢包，這筆花費由自己處理。'},
 'rage-cup-off-duty':{main:'thermos',secondary:'invoice',extra:'moon',palette:'rage',description:'保溫杯回到杯子的用途，收據收好，月亮提醒這場記者會可以散場了。'},
 'dream-trilogy':{main:'film',secondary:'moon',layout:'dream',count:3,description:'夢泡泡包住電影畫面，三場連映都只發生在腦內。'},
 'dream-three-cast':{main:'network',secondary:'film',layout:'dream',count:3,description:'腦內片場擴編成三人卡司，所有人都留在夢境的邊界裡。'},
 'rage-dream-then-real':{main:'cloud',secondary:'fist',layout:'duet',extra:'warning',description:'夢泡泡轉向現實拳頭，警示提醒這一次沒有在夢中醒來。'},
 'rage-real-then-dream':{main:'fist',secondary:'cloud',layout:'duet',extra:'shield',description:'現實拳頭轉向夢泡泡，後來的衝動留在腦內，沒有新增出手。'},
 'rage-onboard-truce':{main:'badge',secondary:'shield',extra:'glove',description:'新工作證、停火盾牌與拳套同框，報到日的風波之後仍回去工作。'},
 'rage-salary-truce':{main:'coins',secondary:'shield',extra:'glove',description:'薪資硬幣先放到一旁，拳套旁的盾牌表示這輪先處理停火和後續。'},
 'rage-private-mediation':{main:'coffeeTray',secondary:'scale',extra:'paper',palette:'rage',description:'兩杯私下飲料旁是調解天秤和書面事項，續攤改約後續協調。'},
 'meal-three-warm':{main:'bowl',secondary:'heart',extra:'coffee',count:3,description:'三次溫暖飯局留下飯碗、愛心和聊天後的咖啡，不必把開心寫成指標。'},
 'meal-two-mines':{main:'bowl',secondary:'warning',extra:'megaphone',count:2,description:'飯碗旁冒出聊天警示，兩次踩雷都不在菜單的辣度標示內。'},
 'meal-same-person-weather':{main:'bowl',secondary:'weather',description:'同一個飯碗配上晴雨變化，和同一人吃飯也可能有不同桌況。'},
 'meal-wing-warm':{main:'bowl',secondary:'feather',extra:'heart',description:'飯碗旁的翅膀與愛心表示老闆這頓聊得很開，飯桌暫時沒有變考場。'},
 'meal-read-three':{main:'phone',secondary:'envelope',count:3,description:'手機留著三次沒有成行的邀約回條，餐費沒有支出，等待已經收齊。'},
 'meal-rain-check':{main:'envelope',secondary:'bowl',layout:'duet',description:'先前的邀餐回條終於接到一碗真的上桌的飯，改天有了下一集。'},
 'meal-after-insult':{main:'mic',secondary:'bowl',extra:'heart',layout:'duet',description:'現場麥克風之後是一頓能好好聊天的飯，原話留著，餐桌重新接話。'},
 'meal-after-dream':{main:'fist',secondary:'bowl',extra:'heart',layout:'dream',description:'拳頭留在夢泡泡內，飯碗與愛心留在現場，這一餐沒有重演。'},
 'meal-three-guests':{main:'bowl',secondary:'network',count:3,description:'飯碗接到三位不同的同桌人，晚餐開始有不同談法。'},
 'meal-first-love-break':{main:'bowl',secondary:'mic',extra:'mic',palette:'banquet',description:'一碗主餐旁放著兩支麥克風，兩位主唱都先坐下吃飯。'},
 'care-second-repair':{main:'heart',secondary:'wrench',extra:'wallet',count:2,description:'心情愛心接受第二次維修，工具與錢包表示實際替自己安排休整。'},
 'care-unpaid-drink':{main:'calendar',secondary:'coffee',extra:'wallet',description:'無薪假日曆後仍有一杯自己挑的飲料，口味不在公司的扣薪範圍內。'},
 'care-raise-party':{main:'coins',secondary:'coffee',extra:'balloon',description:'真的增加的薪資硬幣換成一杯飲料，氣球慶祝的是已經發生的調薪。'},
 'career-cut-raise':{main:'stairs',secondary:'coins',extra:'invoice',description:'薪資硬幣沿階梯回升，前次降薪和後來談回來的數字都有紀錄。'},
 'care-evidence-then-words':{main:'paper',secondary:'mic',extra:'lock',layout:'duet',description:'備份文件在前，麥克風在後，資料先收好才把話說出口。'},
 'care-words-then-evidence':{main:'mic',secondary:'paper',extra:'lock',layout:'duet',description:'麥克風在前，備份文件在後，講完才補上保存前後文的雲端空間。'},
 'care-pip-two-ways':{main:'paper',secondary:'moon',extra:'umbrella',description:'改善文件旁另有補眠月亮和休假傘，公司的表格之外也替自己排了兩種自救。'},
 'care-sixty':{main:'wallet',secondary:'heart',extra:'bowl',count:60,description:'錢包、愛心與飯碗合成實際執行的福利預算，六十格由自己出資照顧自己。'},
 'care-goose-three':{main:'goose',secondary:'crown',count:3,description:'玩具鵝戴上續任主管的小皇冠，第三次主持的績效檢討仍沒有追加需求。'},
 'career-cut-care':{main:'invoice',secondary:'umbrella',extra:'heart',description:'縮水薪資單旁仍留著休息傘和心情愛心，沒有把自己列為第一個刪除項。'},
 'activity-arm-whitepaper':{main:'arm',secondary:'paper',extra:'clock',description:'腕力手臂旁有十秒計時器與白紙附件，賽程很短，補充聲明很長。'},
 'activity-diet-prize':{main:'tart',secondary:'trophy',extra:'paper',palette:'career',description:'蛋塔與習慣紀錄組獎盃並列，獎狀沒有要求沒收甜點。'},
 'activity-diet-special':{main:'tart',secondary:'star',extra:'scale',palette:'career',description:'受審的蛋塔旁放著觀察特別獎星章，牠終於可以離開被告席。'},
 'activity-diet-withdraw':{main:'bowl',secondary:'door',extra:'shoe',description:'便當飯碗保留在手邊，腳步走出公開排行榜，午餐仍照常。'},
 'activity-roadshow-limits':{main:'booth',secondary:'paper',extra:'shield',description:'展場攤位旁有可驗證的文件和界線盾牌，交回的名單保留真實需求。'},
 'activity-fish-share':{main:'fish',secondary:'coins',extra:'heart',description:'實際付錢加點的第三盤魚送到同桌，這次分享有食物也有價格。'},
 'activity-banquet-ghost-return':{main:'moon',secondary:'badge',extra:'shoe',description:'尾牙散場的夜色裡只剩一雙等待的鞋，隔天工作證仍照常使用。'},
 'activity-basketball-assist':{main:'basketball',secondary:'network',extra:'heart',description:'籃球傳向空檔隊友的聯絡點，這次交付有人接，助攻也有人看見。'},
 'activity-basketball-rest':{main:'basketball',secondary:'chair',extra:'battery',description:'籃球暫放在場邊椅子旁，主動換人休息替自己補回電量。'},
 'activity-review-evidence':{main:'umbrella',secondary:'paper',extra:'compass',description:'審查雨傘不再頂替負責人，旁邊的證據文件和方向指標留下可追的待辦。'}
};

function drawIcon(name,x,y,scale,palette){
 if(!icons[name])throw new Error(`Unknown icon: ${name}`);
 const markup=icons[name].replaceAll('A',palette.accent).replaceAll('W','#fffaf4');
 return `<g transform="translate(${x} ${y}) scale(${scale})">${markup}</g>`;
}
function renderBadge(achievement){
 const recipe=recipes[achievement.id];
 if(!recipe)throw new Error(`Missing art recipe for ${achievement.id}`);
 const palette=palettes[recipe.palette||achievement.group]||palettes.office;
 let picture='';
 if(recipe.layout==='duet'){
  picture+=drawIcon(recipe.main,87,99,.8,palette);
  picture+=drawIcon(recipe.secondary,163,115,.64,palette);
  picture+='<path d="M116 61q20-14 36 2m-3-11 5 12-13-1" fill="none" stroke="'+palette.edge+'" stroke-width="3"/>';
 }else if(recipe.layout==='dream'){
  picture+=drawIcon('cloud',120,90,1.3,palette);
  picture+=drawIcon(recipe.main,120,83,.7,palette);
  if(recipe.secondary)picture+=drawIcon(recipe.secondary,183,146,.4,palette);
 }else if(recipe.layout==='stack'){
  picture+=drawIcon(recipe.main,108,105,1,palette);
  picture+=drawIcon(recipe.secondary,174,133,.47,palette);
 }else{
  picture+=drawIcon(recipe.main,113,102,1.03,palette);
  if(recipe.secondary){
   picture+=`<circle cx="177" cy="139" r="27" fill="${palette.bg}" stroke="${palette.edge}" stroke-width="2.5"/>`;
   picture+=drawIcon(recipe.secondary,177,139,.43,palette);
  }
 }
 if(recipe.extra)picture+=drawIcon(recipe.extra,52,142,.36,palette);
 if(recipe.count){
  // The numeral is a semantic repetition marker, not the achievement title.
  picture+=`<circle cx="183" cy="48" r="20" fill="#fffaf4" stroke="${palette.edge}" stroke-width="3"/><text x="183" y="55" text-anchor="middle" fill="#273144" stroke="none" font-family="system-ui,sans-serif" font-weight="800" font-size="19">${esc(recipe.count)}</text>`;
 }
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-labelledby="${esc(achievement.id)}-title ${esc(achievement.id)}-desc" data-art-version="48">
 <title id="${esc(achievement.id)}-title">${esc(achievement.title)}</title>
 <desc id="${esc(achievement.id)}-desc">${esc(recipe.description)}</desc>
 <rect width="240" height="200" rx="28" fill="${palette.bg}"/>
 <circle cx="120" cy="98" r="76" fill="${palette.wash}"/>
 <path d="M35 172q85 14 170 0" fill="none" stroke="${palette.edge}" opacity=".55" stroke-width="4" stroke-linecap="round"/>
 <g stroke="#273144" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">${picture}</g>
 <path d="M205 85h10m-5-5v10M26 116h10" fill="none" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round"/>
</svg>\n`;
}

await mkdir(output,{recursive:true});
const seen=new Set();
for(const achievement of ACHIEVEMENTS_V48){
 if(seen.has(achievement.id))throw new Error(`Duplicate ID ${achievement.id}`);
 if(!/^[a-z0-9-]+$/.test(achievement.id))throw new Error(`Unsafe ID ${achievement.id}`);
 const target=path.join(output,`${achievement.id}.svg`);
 if(achievement.image!==`./assets/achievements/${achievement.id}.svg`)throw new Error(`Unexpected art URL ${achievement.id}`);
 const existing=await readFile(target,'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(existing&&!existing.includes('data-art-version="48"'))throw new Error(`Refusing to overwrite existing art ${achievement.id}`);
 await writeFile(target,renderBadge(achievement));
 seen.add(achievement.id);
}
for(const id of Object.keys(recipes))if(!seen.has(id))throw new Error(`Unused art recipe ${id}`);
console.log(`Wrote ${seen.size} authored achievement illustrations.`);

// The optional review sheet stays in ignored local artifacts, never in dist.
if(process.argv.includes('--contact-sheet')){
 const {default:sharp}=await import('sharp');
 const width=960,cellW=192,cellH=196,rows=Math.ceil(ACHIEVEMENTS_V48.length/5);
 const tiles=[];
 for(let index=0;index<ACHIEVEMENTS_V48.length;index++){
  const item=ACHIEVEMENTS_V48[index],x=(index%5)*cellW,y=Math.floor(index/5)*cellH;
  const thumb=await sharp(Buffer.from(renderBadge(item))).resize(180,150).png().toBuffer();
  tiles.push({input:thumb,left:x+6,top:y+5});
  const lines=item.title.length>12?[item.title.slice(0,12),item.title.slice(12)]:[item.title];
  const caption=`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="40">${lines.map((line,i)=>`<text x="96" y="${16+i*15}" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#273144">${esc(line)}</text>`).join('')}</svg>`;
  tiles.push({input:Buffer.from(caption),left:x,top:y+156});
 }
 const artifactDir=path.join(root,'artifacts/v48');
 await mkdir(artifactDir,{recursive:true});
 await sharp({create:{width,height:rows*cellH,channels:4,background:'#fcfbff'}}).composite(tiles).png().toFile(path.join(artifactDir,'achievement-contact-sheet.png'));
 console.log('Contact sheet: artifacts/v48/achievement-contact-sheet.png');
}
