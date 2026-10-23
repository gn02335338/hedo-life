import {ACHIEVEMENTS,deriveAchievements} from '../dist/achievements.js';

// Published save fixtures freeze the 250 badges that existed when recorded.
// The additive v66 badges can be earned retroactively from the same transcript;
// compare the original projection without rewriting a frozen state or badge.
const publishedIds=new Set(ACHIEVEMENTS.slice(0,250).map(row=>row.id));
export const derivePublishedAchievements=run=>deriveAchievements(run).filter(id=>publishedIds.has(id));
