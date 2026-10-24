// Original procedural streetwear characters. A shared vertex-color material keeps
// each articulated person at seven draws; immutable segment geometry is cached by
// appearance. The scene owns the supplied geometry/material caches and disposal.
export function createPersonVisualFactory({ THREE, scene, mat, geo, part, boxGeometry, sphereGeometry }) {
  const material = mat('#ffffff', { vertexColors: true, roughness: 0.82, metalness: 0 });
  const round = geo('person-v5-round', () => new THREE.SphereGeometry(1, 8, 5));
  const face = geo('person-v5-face', () => new THREE.SphereGeometry(1, 10, 7));
  const hairCap = geo('person-v5-hair-cap', () => new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.54));
  const tube = geo('person-v5-tapered-limb', () => new THREE.CylinderGeometry(1, 0.82, 1, 8));
  const cloth = geo('person-v5-tailored-cloth', () => {
    const corners = [[-.36,-.5],[.36,-.5],[.5,-.3],[.5,.3],[.36,.5],[-.36,.5],[-.5,.3],[-.5,-.3]];
    const rings = [[-.5,.78,.88],[-.34,.88,.98],[.31,1,1],[.5,.86,.82]];
    const positions = [], indices = [];
    for (const [y, width, depth] of rings) for (const [x,z] of corners) positions.push(x*width,y,z*depth);
    for (let row=0;row<rings.length-1;row++) for(let i=0;i<8;i++) {
      const a=row*8+i,b=row*8+(i+1)%8,c=(row+1)*8+i,d=(row+1)*8+(i+1)%8;
      indices.push(a,c,b,b,c,d);
    }
    positions.push(0,-.5,0,0,.5,0);
    for(let i=0;i<8;i++) { indices.push(32,i,(i+1)%8); indices.push(33,24+(i+1)%8,24+i); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  });
  const skins = ['#c8906d','#a66f50','#dfb48e','#83563f'];
  const hairs = ['#25232c','#3a2c28','#242b32','#51382d'];
  const pants = ['#283548','#34414a','#393342','#294444'];
  let civilianSerial = 0, policeSerial = 0;
  const shade = (color, target, amount) => '#'+new THREE.Color(color).lerp(new THREE.Color(target),amount).getHexString();

  function combine(pieces) {
    const positions=[], normals=[], colors=[];
    let count=0;
    const transform=new THREE.Object3D();
    for(const [source,color,position,scale,rotation] of pieces) {
      transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...(rotation||[0,0,0])); transform.updateMatrix();
      const geometry=source.index ? source.toNonIndexed() : source.clone(); geometry.applyMatrix4(transform.matrix);
      const p=geometry.getAttribute('position'), n=geometry.getAttribute('normal'), tint=new THREE.Color(color);
      const c=new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++) { c[i*3]=tint.r; c[i*3+1]=tint.g; c[i*3+2]=tint.b; }
      positions.push(p.array); normals.push(n.array); colors.push(c); count+=p.array.length; geometry.dispose();
    }
    const geometry=new THREE.BufferGeometry();
    for(const [name,arrays] of [['position',positions],['normal',normals],['color',colors]]) {
      const joined=new Float32Array(count); let offset=0;
      for(const array of arrays) { joined.set(array,offset); offset+=array.length; }
      geometry.setAttribute(name,new THREE.BufferAttribute(joined,3));
    }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  }
  function geometryFor(key, pieces) { return geo('person-v5-'+key,()=>combine(pieces)); }
  const piece=(pieces,shape,color,position,scale,rotation)=>pieces.push([shape,color,position,scale,rotation]);

  return function person(tint='#e6d79f', small=false) {
    const police=small && new THREE.Color(tint).getHexString()==='24354e';
    const visualKind=police?'police':small?'civilian':'player';
    const variant=police?policeSerial++%4:small?civilianSerial++%4:0;
    const skin=skins[variant], hair=hairs[variant], trouser=police?'#202d40':pants[variant];
    const jacket=police?'#2d405b':tint, seam=shade(jacket,'#151c2e',.24), highlight=shade(jacket,'#fff1da',.22);
    const tee=police?'#35465c':variant===2?'#e9b4a6':'#e8e1cf';
    const shoe=police?'#1c2330':variant===1?'#674b43':'#35414b', sole=police?'#343b47':'#d5d4c4';
    const appearance=visualKind+'-'+variant+'-'+new THREE.Color(tint).getHexString();
    const body=[];
    // Broad rounded shoulders, a narrower waist and layered front panels keep
    // silhouettes readable from the chase camera as well as from the street.
    piece(body,cloth,jacket,[0,1.3,0],[.61,.67,.36]);
    piece(body,cloth,seam,[0,1.005,.005],[.48,.075,.345]);
    piece(body,boxGeometry,tee,[0,1.34,-.17],[.21,.46,.025]);
    for(const side of [-1,1]) {
      piece(body,cloth,jacket,[side*.172,1.31,-.18],[.15,.53,.055],[0,0,side*.025]);
      piece(body,boxGeometry,highlight,[side*.12,1.555,-.16],[.13,.09,.06],[0,0,side*.45]);
      piece(body,boxGeometry,seam,[side*.173,1.19,-.211],[.14,.022,.012],[0,0,side*.12]);
    }
    piece(body,tube,skin,[0,1.688,0],[.09,.16,.085]);
    piece(body,face,skin,[0,1.866,-.006],[.207,.253,.194]);
    // Ears, cheek/jaw volume and a small nose orient the face toward local -Z.
    for(const side of [-1,1]) {
      piece(body,round,skin,[side*.205,1.855,.003],[.042,.064,.034]);
      piece(body,boxGeometry,'#eee3d2',[side*.075,1.91,-.184],[.051,.021,.012]);
      piece(body,boxGeometry,'#29282d',[side*.075,1.909,-.192],[.021,.022,.01]);
      piece(body,boxGeometry,hair,[side*.074,1.944,-.182],[.063,.015,.015],[0,0,side*.08]);
    }
    piece(body,round,shade(skin,'#f8d4b4',.12),[0,1.854,-.194],[.036,.052,.05]);
    piece(body,boxGeometry,shade(skin,'#4b2730',.45),[0,1.786,-.188],[.066,.014,.012]);
    piece(body,hairCap,hair,[0,1.899,.009],[.218,.228,.207]);
    if(variant===1) {
      piece(body,round,hair,[-.075,2.065,-.105],[.145,.072,.1],[0,0,-.19]);
      piece(body,cloth,hair,[.179,1.962,.045],[.045,.15,.23]);
    } else if(variant===2) {
      for(const side of [-1,1]) piece(body,cloth,hair,[side*.183,1.883,.045],[.075,.26,.25],[0,0,-side*.08]);
      piece(body,round,hair,[0,1.99,.2],[.11,.1,.105]);
    } else if(variant===3) {
      piece(body,round,hair,[.06,2.052,-.105],[.16,.06,.12],[0,0,.12]);
      piece(body,boxGeometry,hair,[0,1.769,-.153],[.14,.035,.045]);
    } else piece(body,cloth,hair,[0,2.027,-.145],[.32,.07,.095],[0,0,-.055]);

    if(police) {
      // Original uniform equipment is baked into the same colored torso mesh.
      piece(body,cloth,'#1d2b3c',[0,1.335,-.183],[.49,.42,.09]);
      for(const side of [-1,1]) {
        piece(body,cloth,'#30435a',[side*.14,1.24,-.239],[.13,.14,.055]);
        piece(body,boxGeometry,'#33465d',[side*.244,1.56,-.01],[.12,.033,.23]);
      }
      piece(body,sphereGeometry,'#dfbc6b',[-.142,1.46,-.247],[.05,.065,.012]);
      piece(body,boxGeometry,'#0f1d2b',[.155,1.45,-.241],[.08,.12,.035]);
      piece(body,boxGeometry,'#778591',[.16,1.55,-.24],[.013,.12,.012]);
      piece(body,cloth,'#1b2b40',[0,2.063,.005],[.44,.116,.41]);
      piece(body,cloth,'#172438',[0,2.016,-.2],[.38,.033,.26]);
      piece(body,sphereGeometry,'#d0b36b',[0,2.08,-.199],[.035,.039,.01]);
      piece(body,boxGeometry,'#172333',[0,1.015,0],[.49,.07,.35]);
      piece(body,cloth,'#142230',[.28,1.015,.045],[.1,.16,.15]);
    } else if(!small) {
      // The player's compact teal backpack and coral utility tabs remain easy
      // to identify from behind without adding textures or separate draws.
      piece(body,cloth,'#547e76',[0,1.33,.252],[.43,.49,.245]);
      piece(body,cloth,'#345a59',[0,1.22,.378],[.32,.23,.035]);
      piece(body,boxGeometry,'#d4bd8c',[0,1.445,.383],[.13,.045,.016]);
      piece(body,boxGeometry,'#ee937a',[.181,1.31,.37],[.027,.14,.018]);
      for(const side of [-1,1]) {
        piece(body,boxGeometry,'#425e57',[side*.205,1.365,-.214],[.035,.39,.02],[0,0,side*.12]);
        piece(body,cloth,'#547e76',[side*.2,1.596,.035],[.045,.055,.37]);
      }
      piece(body,boxGeometry,'#e6bba0',[-.169,1.449,-.23],[.095,.062,.014]);
      piece(body,boxGeometry,'#31464a',[-.187,1.449,-.24],[.012,.037,.008]);
      piece(body,boxGeometry,'#31464a',[-.151,1.449,-.24],[.012,.037,.008]);
      piece(body,boxGeometry,'#31464a',[-.169,1.449,-.24],[.035,.01,.008]);
    } else if(variant===1) {
      piece(body,boxGeometry,'#584940',[0,1.34,-.216],[.049,.53,.02],[0,0,-.56]);
      piece(body,cloth,'#69584c',[-.26,1.02,.14],[.18,.3,.19]);
    } else if(variant===2) {
      piece(body,boxGeometry,highlight,[0,1.27,-.219],[.44,.045,.013]);
      piece(body,boxGeometry,seam,[0,1.45,.184],[.44,.035,.015]);
    } else if(variant===3) {
      piece(body,cloth,highlight,[0,1.63,-.06],[.32,.09,.27]);
      piece(body,boxGeometry,highlight,[.09,1.47,-.22],[.08,.25,.023],[0,0,-.11]);
    }

    const thigh=[],calf=[],arm=[];
    piece(thigh,cloth,trouser,[0,-.205,0],[.236,.43,.286]);
    piece(thigh,boxGeometry,shade(trouser,'#f4e0c3',.11),[.091,-.192,.012],[.012,.31,.2]);
    piece(thigh,cloth,shade(trouser,'#101c2c',.16),[0,-.393,-.015],[.215,.09,.249]);
    piece(calf,tube,trouser,[0,-.182,.006],[.102,.36,.118]);
    piece(calf,cloth,shade(trouser,'#111a29',.12),[0,-.34,.005],[.2,.045,.23]);
    piece(calf,cloth,shoe,[0,-.419,-.064],[.244,.137,.39]);
    piece(calf,cloth,sole,[0,-.479,-.064],[.249,.033,.4]);
    piece(calf,boxGeometry,police?'#505d6c':'#b0b6ad',[0,-.385,-.115],[.115,.016,.12],[.16,0,0]);
    if(!police) {
      for(let i=0;i<3;i++) piece(calf,boxGeometry,'#e5dfcc',[0,-.375+i*.002,-.088-i*.027],[.104,.009,.011],[.1,0,0]);
      piece(calf,boxGeometry,variant===2?'#db9a82':'#8daba6',[.121,-.423,-.072],[.009,.028,.16]);
    }
    // Arms retain the original shoulder pivots and hand reach for the existing
    // aiming/reload poses. Their rounded elbow and forearm form one shared mesh.
    piece(arm,round,jacket,[-.014,-.036,0],[.106,.102,.12]);
    piece(arm,tube,jacket,[0,-.168,0],[.097,.28,.111]);
    piece(arm,cloth,highlight,[0,-.288,-.004],[.184,.052,.214]);
    piece(arm,round,skin,[0,-.334,-.006],[.079,.079,.082]);
    piece(arm,tube,police?jacket:skin,[0,-.399,-.016],[.072,.15,.079],[.09,0,0]);
    if(police) piece(arm,cloth,seam,[0,-.463,-.024],[.145,.044,.164]);
    piece(arm,round,skin,[0,-.506,-.024],[.074,.09,.079]);
    piece(arm,round,skin,[-.063,-.49,-.034],[.025,.05,.036],[0,0,-.2]);
    piece(arm,boxGeometry,police?'#213345':'#444b4d',[0,-.463,.049],[.12,.039,.018]);

    const group=new THREE.Group(), chest=new THREE.Group(); group.add(chest);
    chest.name='person-chest';
    part(chest,geometryFor(appearance+'-body',body),material,[0,0,0],[1,1,1]);
    const thighGeometry=geometryFor(appearance+'-thigh',thigh), calfGeometry=geometryFor(appearance+'-calf',calf), armGeometry=geometryFor(appearance+'-arm',arm);
    const legs=[],knees=[],arms=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Group(); leg.position.set(side*.155,.98,0); group.add(leg);
      part(leg,thighGeometry,material,[0,0,0],[1,1,1]);
      const knee=new THREE.Group(); knee.position.y=-.44; leg.add(knee);
      part(knee,calfGeometry,material,[0,0,0],[1,1,1]); legs.push(leg); knees.push(knee);
      const armGroup=new THREE.Group(); armGroup.position.set(side*.36,1.56,0); group.add(armGroup);
      part(armGroup,armGeometry,material,[0,0,0],[side,1,1]); arms.push(armGroup);
    }
    scene.add(group);
    return {group,legs,arms,knees,chest,visualKind,visualVariant:variant};
  };
}

// Deterministic poses do not accumulate offsets and stay still when scene time
// is paused. Scene combat/jump/takeover poses can override the same hip/shoulder
// rotations immediately afterward, just as they did with the original model.
export function animatePersonVisual(model, phase, stride) {
  const gait=Math.sin(phase), amount=Math.max(0,stride);
  model.legs[0].rotation.x=-gait*amount; model.legs[1].rotation.x=gait*amount;
  model.arms[0].rotation.x=gait*amount*.8; model.arms[1].rotation.x=-gait*amount*.8;
  if(model.knees) {
    model.knees[0].rotation.x=-Math.max(0,gait)*amount*.9;
    model.knees[1].rotation.x=-Math.max(0,-gait)*amount*.9;
  }
  if(model.chest) {
    const breathe=Math.sin(phase*.43)*.006 + Math.sin(phase*2)*amount*.009;
    model.chest.position.y=breathe;
    model.arms[0].position.y=model.arms[1].position.y=1.56+breathe;
  }
}
