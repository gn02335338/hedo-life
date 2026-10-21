// Schools and subjects are fictional résumé combinations. wingBias belongs to the satirical character, never a ranking of education quality.
const SCHOOLS = [
 {id:'ntu',name:'國立臺灣大學',sector:'public',region:'台灣'},
 {id:'nthu',name:'國立清華大學',sector:'public',region:'台灣'},
 {id:'nycu',name:'國立陽明交通大學',sector:'public',region:'台灣'},
 {id:'ncku',name:'國立成功大學',sector:'public',region:'台灣'},
 {id:'nccu',name:'國立政治大學',sector:'public',region:'台灣'},
 {id:'ntust',name:'國立臺灣科技大學',sector:'public',region:'台灣'},
 {id:'ntut',name:'國立臺北科技大學',sector:'public',region:'台灣'},
 {id:'ncu',name:'國立中央大學',sector:'public',region:'台灣'},
 {id:'tku',name:'淡江大學',sector:'private',region:'台灣'},
 {id:'fju',name:'輔仁大學',sector:'private',region:'台灣'},
 {id:'fcu',name:'逢甲大學',sector:'private',region:'台灣'},
 {id:'cycu',name:'中原大學',sector:'private',region:'台灣'},
 {id:'thu',name:'東海大學',sector:'private',region:'台灣'},
 {id:'scu',name:'東吳大學',sector:'private',region:'台灣'},
 {id:'mit',name:'麻省理工學院',sector:'overseas',region:'美國'},
 {id:'stanford',name:'史丹佛大學',sector:'overseas',region:'美國'},
 {id:'berkeley',name:'加州大學柏克萊分校',sector:'overseas',region:'美國'},
 {id:'cmu',name:'卡內基美隆大學',sector:'overseas',region:'美國'},
 {id:'tokyo',name:'東京大學',sector:'overseas',region:'日本'},
 {id:'waseda',name:'早稻田大學',sector:'overseas',region:'日本'},
 {id:'nus',name:'新加坡國立大學',sector:'overseas',region:'新加坡'},
 {id:'ucl',name:'倫敦大學學院',sector:'overseas',region:'英國'},
 {id:'toronto',name:'多倫多大學',sector:'overseas',region:'加拿大'}
];
const SUBJECTS = [
 {name:'資訊工程',field:'stem'}, {name:'電機工程',field:'stem'},
 {name:'應用數學',field:'stem'}, {name:'資訊管理',field:'business'},
 {name:'企業管理',field:'business'}, {name:'經濟',field:'business'},
 {name:'外國語文',field:'humanities'}, {name:'社會學',field:'humanities'},
 {name:'歷史',field:'humanities'}, {name:'視覺設計',field:'design'},
 {name:'機械工程',field:'stem'}, {name:'統計',field:'stem'}
];
const BACKOFFICE_SUBJECTS_V28=[
 {name:'財務金融',field:'business'}, {name:'會計',field:'business'},
 {name:'人力資源管理',field:'business'}, {name:'公共行政',field:'humanities'}
];
export function rollEducation(random,rules=1) {
 const school=SCHOOLS[Math.floor(random()*SCHOOLS.length)];
 const subjects=rules>=28?[...SUBJECTS,...BACKOFFICE_SUBJECTS_V28]:SUBJECTS;
 const subject=subjects[Math.floor(random()*subjects.length)];
 const degreeRoll=random();
 const degree=degreeRoll<.68?'學士':degreeRoll<.94?'碩士':'EMBA';
 const field=degree==='EMBA'?'business':subject.field;
 const department=degree==='EMBA'?'高階經營管理':subject.name;
 let wingBias=school.id==='ntu'&&degree!=='EMBA'?14:0;
 if(school.sector==='private')wingBias-=10;
 if(['humanities','business'].includes(field))wingBias-=12;
 if(degree==='EMBA')wingBias-=6;
 return {id:`${school.id}-${field}-${degree}-${department}`,school:school.name,schoolId:school.id,department,degree,sector:school.sector,region:school.region,field,wingBias};
}
export const EDUCATION_SCHOOLS=SCHOOLS;
export function educationLabel(education){return `${education.school}・${education.department} ${education.degree}`;}
