// New fictional target only. Older conversations delegate to their published
// rules, and the engine draws only after confirming an actually present target.
import {PERSONAS} from './persona.js';
import {getRageV14} from './rage-v14.js';
import {getRageV23,rageTargetForV23} from './rage-v23.js';

export function rageTargetForV37(event){
  return event?.speaker==='professor'&&event.minRules>=37?'professor':rageTargetForV23(event);
}

export function getRageV37(run){
  if(!/^e(?:37|38)-/.test(run?.seed||'')||run.rageContext?.target!=='professor')return getRageV23(run);
  if(run.eventId!=='rage-release')return getRageV14(run,Object.fromEntries(Object.entries(PERSONAS).map(([id,p])=>[id,p.name])));
  const context=run.rageContext,hot=run.stats.mood<=25,calm=run.stats.mood>=65;
  const realWeight=Math.max(12,Math.min(64,28+(hot?23:calm?-12:0)));
  const after=context.phase==='result';
  const meal=context.eventId==='meal-with-professor';
  const phase=after?'你剛才已經回了話，這股火是在聽完回應後湧上來的。':'教授還在等你的回答，你先發現自己的耐性已經用完。';
  return {
    id:'rage-release',kind:'rage',speaker:'professor',minRules:37,era:'當場暴走・原創分支',sourceIds:['schoolLore','characterFiction'],
    title:'受不了了，扁他。',
    body:`林澤教授就在眼前。${meal?'桌上仍是那頓飯，餐費不會因為這一下重算。':'你們還在同一場討論，白板上的問題還沒擦掉。'}這次沒有轉去找不在場的人。`,
    wing:'先停一下。你要說的是研究問題，還是現在已經聽不進去？',
    choices:[{text:'受不了了，扁他。',detail:'',result:'',delta:{},flags:[],effect:'rageReturn',rageTarget:'professor',draw:{label:'剛才發生了什麼',outcomes:[
      {weight:100-realWeight,label:'腦內劇場',result:`你在腦內揮出一拳，林澤教授卻把整個拳頭框成待驗證的假設。白板自己長出三位口試委員，要求你的怒氣先補資料、附參考文獻，再說明這一下怎麼重現。你還沒開始答辯，橡皮擦已經拿到共同作者。${phase}你眨了一下眼，雙手仍放在膝上；教授沒有挨打，桌上也沒有口試委員，剛才全是你的想像。`,delta:{mood:hot?17:9,energy:-3,boss:0},effect:'rageReturn',flags:['rage_imagined','rage_catharsis']},
      {weight:realWeight,label:'真的失控了',result:`你的手真的越過桌沿，林澤教授往後退，筆記散在椅子旁。附近的人立刻把你們隔開，他沒有繼續講研究，先請在場的人各自記下剛才的經過。${phase}你等了一秒，卻沒有醒來；這次真的對眼前的人動手，原本的工作爭議與動手的責任都得另外說清楚。`,delta:{mood:hot?10:-8,energy:-11,boss:0,trust:-7},effect:'rageAftermath',flags:['rage_real']}
    ]}}]
  };
}
