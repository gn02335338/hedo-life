export function castLegacyNoticeV74(run){
 return /^e39-r73-[nsd]-[0-9a-f]{22}$/.test(run?.seed||'')?'<aside class="rules-notice"><p>新版加入紅酒、p神、8+9、老大與米雅，以及愛麗絲的新插曲。重新應徵後，就有機會和他們共事。</p><button class="text-button" data-action="new">重新應徵，認識新同事 ↗</button></aside>':'';
}
