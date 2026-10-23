import {isPatronageBenefitsV67} from './patronage-benefits-v67.js';

// Display only: a continued life retains its original, replayable rules.
export function patronageLegacyNoticeV68(run){
 if(!run?.patronage||run.completed||isPatronageBenefitsV67(run))return '';
 return '<aside class="rules-notice" role="status" aria-label="特殊任用版本提醒"><p>這局沿用舊版特殊任用規則。重新應徵後，才會使用提高後的月薪、生活津貼與自己人專屬人事事件；已收藏的結局和成就會保留。</p><button type="button" class="text-button" data-action="new">重新應徵，體驗新版待遇 ↗</button></aside>';
}
