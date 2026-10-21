// New occupations only enter e28 lives. Existing role objects and draw order stay frozen.
export const BACKOFFICE_LADDERS_V28={
 finance:['財務助理','財務專員','資深財務專員','主任財務專員','財務副理','財務經理','財務總監','財務長 CFO'],
 accounting:['會計助理','會計專員','資深會計專員','主任會計專員','會計副理','會計經理','會計總監','會計長 CAO'],
 hr:['人資助理','人資專員','資深人資專員','主任人資專員','人資副理','人資經理','人資總監','人資長 CHRO'],
 admin:['行政助理','行政專員','資深行政專員','主任行政專員','行政副理','行政經理','行政總監','行政長 CAO']
};
export const BACKOFFICE_ROLE_IDS_V28=Object.freeze(Object.keys(BACKOFFICE_LADDERS_V28));
export const BACKOFFICE_ROLES_V28=[
 {id:'finance',name:'財務專員',symbol:'財',subtitle:'願景可以無限，銀行餘額不行。',description:'資金預估、付款安排、應收帳款。你算還能撐多久，他問為什麼不能把信心也算進去。',stats:{energy:73,cash:63,trust:57,dream:43,boss:61,mood:74,skill:66,slack:35,lick:30},pay:48,payRange:[38,72],assistantTitle:'財務助理',swapChance:0,assistantChance:.18,swapTo:'finance',ladder:BACKOFFICE_LADDERS_V28.finance,minRules:28},
 {id:'accounting',name:'會計專員',symbol:'帳',subtitle:'憑證沒到，結帳日先到了。',description:'帳務、核銷、薪資對帳與月結。每張發票都有去處，每句「先幫我過」都得有人負責。',stats:{energy:75,cash:61,trust:59,dream:40,boss:60,mood:74,skill:67,slack:36,lick:28},pay:45,payRange:[36,65],assistantTitle:'會計助理',swapChance:0,assistantChance:.2,swapTo:'accounting',ladder:BACKOFFICE_LADDERS_V28.accounting,minRules:28},
 {id:'hr',name:'人資專員',symbol:'人',subtitle:'招人、送人，還要先問咖啡加不加糖。',description:'招募、出勤、考核和離職。行政的事也會找你，泡完咖啡回座位，希望已經傳來下一份表。',stats:{energy:72,cash:58,trust:64,dream:45,boss:64,mood:73,skill:61,slack:36,lick:39},pay:43,payRange:[35,62],assistantTitle:'人資助理',swapChance:.2,assistantChance:.16,swapTo:'admin',assignmentTable:[{actualRoleId:'admin',assignment:'swapped',weight:.2},{actualRoleId:'hr',assignment:'assistant',weight:.16}],ladder:BACKOFFICE_LADDERS_V28.hr,minRules:28},
 {id:'admin',name:'行政專員',symbol:'行',subtitle:'「順便」兩個字，沒有工作上限。',description:'採購、總務、接待與活動，缺人時再兼招募和出勤。公司說分工靈活，你的待辦清單已經可以攤開睡。',stats:{energy:76,cash:56,trust:65,dream:42,boss:62,mood:75,skill:59,slack:41,lick:35},pay:39,payRange:[32,54],assistantTitle:'行政助理',swapChance:.22,assistantChance:.2,swapTo:'hr',assignmentTable:[{actualRoleId:'hr',assignment:'swapped',weight:.22},{actualRoleId:'admin',assignment:'assistant',weight:.2}],ladder:BACKOFFICE_LADDERS_V28.admin,minRules:28}
];
