import {getWorkGapEventV50} from './work-gap-v50.js';
import {isRecruitmentV60} from './seed-profile-v60.js';
import {isLifeBalanceV62,moodRestWarningV62} from './life-balance-v62.js';

// Only new lives use warning-triggered intervals. Published seeds keep the
// same choices and timing that their server-validated replays were given.
export const ENERGY_REST_WARNING_V53=30;
export const isEnergyRestV53=run=>isRecruitmentV60(run)||/^e39-cal46-kin49-g-e-/.test(typeof run==='string'?run:run?.seed||'');
export const energyRestWarningV53=run=>Number.isFinite(run?.stats?.energy)&&run.stats.energy>0&&run.stats.energy<=ENERGY_REST_WARNING_V53;

export function getEnergyRestEventV53(run){
 const event=getWorkGapEventV50();
 if(isLifeBalanceV62(run)){
  const mood=moodRestWarningV62(run),energy=energyRestWarningV53(run),label=mood&&energy?'心情與體力':mood?'心情':'體力';
  return {...event,era:'身心警告・工作空檔',title:mood||energy?`${label}快見底，先停一下。`:'緩過來一些，準備好了再上班。',body:mood||energy?`上一件事已告一段落，${label}也進入警告範圍。下一段工作還沒開始，先決定要不要休息、吃飯，或花點存款照顧自己。`:'心情與體力都回到警告範圍以上，這段空檔還沒結束。確認目前狀態，準備好了再繼續上班。',wing:'先放下工作，看看自己的狀態。'};
 }
 return {
  ...event,era:'體力警告・工作空檔',
  title:energyRestWarningV53(run)?'體力快見底，先停一下。':'這段空檔還沒結束。',
  body:energyRestWarningV53(run)?'上一件事已告一段落，體力也進入警告範圍。趁下一段工作還沒開始，決定要不要休息、吃飯，或花點錢照顧自己。':'剛才的體力警告讓你停了下來。現在體力已回到警告範圍以上，下一件工作還沒開始；確認目前狀態，再繼續上班。',
  wing:'工作先告一段落，看看自己還剩多少電。'
 };
}
