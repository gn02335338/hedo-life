import {getWorkGapEventV50} from './work-gap-v50.js';

// Only new lives use warning-triggered intervals. Published seeds keep the
// same choices and timing that their server-validated replays were given.
export const ENERGY_REST_WARNING_V53=30;
export const isEnergyRestV53=run=>/^e39-cal46-kin49-g-e-/.test(typeof run==='string'?run:run?.seed||'');
export const energyRestWarningV53=run=>Number.isFinite(run?.stats?.energy)&&run.stats.energy>0&&run.stats.energy<=ENERGY_REST_WARNING_V53;

export function getEnergyRestEventV53(run){
 const event=getWorkGapEventV50();
 return {
  ...event,era:'體力警告・工作空檔',
  title:energyRestWarningV53(run)?'體力快見底，先停一下。':'這段空檔還沒結束。',
  body:energyRestWarningV53(run)?'上一件事已告一段落，體力也進入警告範圍。趁下一段工作還沒開始，決定要不要休息、吃飯，或花點錢照顧自己。':'剛才的體力警告讓你停了下來。現在體力已回到警告範圍以上，下一件工作還沒開始；確認目前狀態，再繼續上班。',
  wing:'工作先告一段落，看看自己還剩多少電。'
 };
}
