import {mkdir,writeFile} from 'node:fs/promises';
import {ACHIEVEMENT_RULES_V66} from '../dist/achievements-v66.js';
import {renderAchievementBadgeV66} from '../dist/achievement-badge-art-v66.js';
await mkdir(new URL('../dist/assets/achievements/',import.meta.url),{recursive:true});
await Promise.all(ACHIEVEMENT_RULES_V66.map(item=>writeFile(new URL(`../dist/assets/achievements/${item.id}.svg`,import.meta.url),renderAchievementBadgeV66(item))));
console.log(`Wrote ${ACHIEVEMENT_RULES_V66.length} original illustrated achievement badges.`);
