// New balance rules are opt-in by fresh seed. Published lives remain exact.
export const isLifeBalanceV62=value=>/^e39-r62-[nsd]-[0-9a-f]{22}$/.test(typeof value==='string'?value:value?.seed||'');
export const MOOD_REST_WARNING_V62=30;
export const moodRestWarningV62=run=>isLifeBalanceV62(run)&&Number.isFinite(run?.stats?.mood)&&run.stats.mood>0&&run.stats.mood<=MOOD_REST_WARNING_V62;
export const restWarningV62=run=>moodRestWarningV62(run)||Number.isFinite(run?.stats?.energy)&&run.stats.energy>0&&run.stats.energy<=30;
