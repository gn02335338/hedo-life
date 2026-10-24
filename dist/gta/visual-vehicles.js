// Original procedural vehicles. All dimensions use the gameplay car's local
// frame: forward is -Z, the driver is on -X, and the road is Y = 0.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const VARIANTS = Object.freeze({
  sedan: { width: .98, front: -2.02, rear: 2.02, belt: .96, roof: 1.58, roofFront: -.34, roofRear: .78, screenFront: -.91, screenRear: 1.34, doorEnd: .32, wheelFront: -1.28, wheelRear: 1.27, radius: .37, roofWidth: .71 },
  hatch: { width: .95, front: -1.94, rear: 1.91, belt: .98, roof: 1.66, roofFront: -.43, roofRear: .99, screenFront: -.95, screenRear: 1.68, doorEnd: .35, wheelFront: -1.23, wheelRear: 1.21, radius: .36, roofWidth: .73 },
  suv: { width: 1.01, front: -2.05, rear: 2.05, belt: 1.07, roof: 1.83, roofFront: -.46, roofRear: 1.03, screenFront: -.98, screenRear: 1.73, doorEnd: .36, wheelFront: -1.31, wheelRear: 1.31, radius: .395, roofWidth: .78 },
  'maserati-gt': { width: 1.015, front: -2.02, rear: 2.03, belt: .91, roof: 1.37, roofFront: .13, roofRear: .73, screenFront: -.45, screenRear: 1.4, doorEnd: .48, wheelFront: -1.4, wheelRear: 1.37, radius: .385, roofWidth: .66 },
  'bmw-executive': { width: 1.01, front: -2.04, rear: 2.04, belt: 1, roof: 1.58, roofFront: -.31, roofRear: .84, screenFront: -.97, screenRear: 1.4, doorEnd: .34, wheelFront: -1.4, wheelRear: 1.34, radius: .38, roofWidth: .73 },
  'tesla-model-y': { width: 1.025, front: -2.03, rear: 2.05, belt: 1.03, roof: 1.74, roofFront: -.15, roofRear: .55, screenFront: -1.24, screenRear: 1.88, doorEnd: .33, wheelFront: -1.37, wheelRear: 1.36, radius: .405, roofWidth: .76 },
});
function variantFor(id, police) {
  if (police || /sedan|coupe|coral|cream/.test(id)) return 'sedan';
  if (/hatch|compact|plum/.test(id)) return 'hatch';
  if (/wagon|green/.test(id)) return 'suv';
  const hash = [...id].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  return ['sedan', 'hatch', 'suv'][hash % 3];
}

// Catalog cars carry an explicit body shape; ordinary traffic keeps its stable
// ID-derived appearance. This finite registry bounds the geometry cache.
export function resolveVehicleVariant(id, kind, requestedVariant) {
  if (kind === 'police') return 'sedan';
  if (typeof requestedVariant === 'string' && Object.hasOwn(VARIANTS, requestedVariant)) return requestedVariant;
  return variantFor(String(id ?? ''), false);
}

export function createVehicleVisualFactory(ctx) {
  const { THREE, scene, mat, M, geo, part, contact, boxGeometry, planeGeometry, sphereGeometry,
    policeDecal, policeRedOff, policeBlueOff } = ctx;
  const cache = (name, make) => geo(`vehicle-v10:${name}`, make);
  const solid = mat('#ffffff', { vertexColors: true, metalness: .42, roughness: .28 });
  const wheelMaterial = mat('#ffffff', { vertexColors: true, metalness: .23, roughness: .56 });
  if (ctx.environment) { solid.envMap = ctx.environment; solid.envMapIntensity = .55; }
  const driverMaterial = mat('#ffffff', { vertexColors: true, roughness: .88 });
  const damagedSolid = mat('#ffffff', { vertexColors: true, metalness: .15, roughness: .76 });
  const brokenLamp = mat('#363a38', { roughness: .9 });
  const wheelTint = new THREE.Color();
  const shapesByPalette = new Map(), wheelsByVariant = new Map();
  const C = { rubber: '#17202a', inset: '#101c28', glass: '#294c61', reflection: '#7896a5', chrome: '#b3c1c5', trim: '#526773', plate: '#e5ebdf', red: '#d44b49', white: '#f1f4e9' };
  const unit = [1, 1, 1];
  const round = cache('rounded-detail', () => new THREE.SphereGeometry(1, 12, 7));
  const badgeRing = cache('badge-ring', () => new THREE.TorusGeometry(1, .075, 6, 28));

  function meshGeometry(vertices, faces) {
    const positions = [];
    for (const face of faces) for (let i = 1; i < face.length - 1; i += 1) {
      for (const index of [face[0], face[i], face[i + 1]]) positions.push(...vertices[index]);
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.computeVertexNormals(); return result;
  }
  function quad(name, points) {
    return cache(name, () => meshGeometry(points, [[0, 1, 2, 3], [3, 2, 1, 0]]));
  }
  function windowPolygon(name, points) {
    // A curved side panel is not planar: reverse the same triangles rather
    // than triangulating its back from a different corner, which leaves slits.
    return cache(name,()=>{
      const faces=[];
      for(let i=1;i<points.length-1;i++)faces.push([0,i,i+1],[0,i+1,i]);
      return meshGeometry(points,faces);
    });
  }
  function loft(name, rings) {
    return cache(name, () => {
      // A rounded shoulder and crowned top replace the old eight-sided boxes.
      // Shared indices produce continuous normals without subdividing every
      // small trim piece. Three longitudinal samples retain a bounded mesh.
      const profile = [[-.8,0],[.8,0],[.94,.06],[1,.2],[1,.55],[.975,.8],[.9,.95],[.62,1.025],[0,1.045],[-.62,1.025],[-.9,.95],[-.975,.8],[-1,.55],[-1,.2],[-.94,.06]];
      const samples = [], points = [], indices = [], n = profile.length;
      for (let i = 0; i < rings.length - 1; i++) for (let step = 0; step < 3; step++) {
        const t = step / 3, a = rings[i], b = rings[i + 1], before = rings[Math.max(0,i - 1)], after = rings[Math.min(rings.length - 1,i + 2)];
        const sample = { z: a.z + (b.z - a.z) * t };
        for (const key of ['w','bottom','top']) {
          const value = .5 * (2*a[key] + (b[key]-before[key])*t + (2*before[key]-5*a[key]+4*b[key]-after[key])*t*t + (-before[key]+3*a[key]-3*b[key]+after[key])*t*t*t);
          sample[key] = clamp(value, Math.min(a[key],b[key]), Math.max(a[key],b[key]));
        }
        samples.push(sample);
      }
      samples.push(rings.at(-1));
      for (const ring of samples) for (const [x,y] of profile) points.push(x*ring.w,ring.bottom+(ring.top-ring.bottom)*y,ring.z);
      for(let row=0;row<samples.length-1;row++) for(let edge=0;edge<n;edge++) {
        const a=row*n+edge,b=row*n+(edge+1)%n;indices.push(a,b,b+n,a,b+n,a+n);
      }
      for(let i=1;i<n-1;i++){indices.push(0,i+1,i);const end=(samples.length-1)*n;indices.push(end,end+i,end+i+1);}
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
    });
  }
  function add(parts, geometry, color, position = [0, 0, 0], scale = unit, rotation = [0, 0, 0]) {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    parts.push({ geometry, color, transform });
  }
  const box = (parts, color, position, scale, rotation) => add(parts, boxGeometry, color, position, scale, rotation);
  function beam(parts, color, from, to, width, depth = width) {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to), delta = end.clone().sub(start);
    const transform = new THREE.Matrix4().compose(start.add(end).multiplyScalar(.5),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()),
      new THREE.Vector3(width, delta.length(), depth));
    parts.push({ geometry: boxGeometry, color, transform });
  }
  // Unlike the scene's material merge, this bake keeps a color for every face.
  // Finished shells are cached by silhouette + palette, never by transient ID.
  function bake(name, pieces, offset = [0, 0, 0]) {
    return cache(name, () => {
      const positions = [], normals = [], colors = [];
      for (const piece of pieces) {
        const geometry = piece.geometry.index ? piece.geometry.toNonIndexed() : piece.geometry.clone();
        geometry.applyMatrix4(piece.transform); geometry.translate(...offset);
        if (!geometry.attributes.normal) geometry.computeVertexNormals();
        const rgb = new THREE.Color(piece.color), p = geometry.attributes.position, n = geometry.attributes.normal;
        for (let i = 0; i < p.count; i += 1) {
          positions.push(p.getX(i), p.getY(i), p.getZ(i)); normals.push(n.getX(i), n.getY(i), n.getZ(i));
          colors.push(rgb.r, rgb.g, rgb.b);
        }
        geometry.dispose();
      }
      const result = new THREE.BufferGeometry();
      result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      result.computeBoundingBox(); result.computeBoundingSphere(); return result;
    });
  }

  function details(spec, variant, paint, police) {
    const body = [], door = [], frontLights = [], rearLights = [];
    const gt = variant === 'maserati-gt', bmw = variant === 'bmw-executive', electric = variant === 'tesla-model-y';
    const { width: w, front, rear, belt, roof, roofFront, roofRear, screenFront, screenRear, doorEnd, radius, roofWidth: rw } = spec;
    const roofPaint = police ? '#e8eeee' : electric ? '#172b3a' : paint;
    const tag = `${variant}:${police ? 'police' : paint}`;
    const hinge = [-w + .005, .52, screenFront];
    // A continuous beveled sill, two shaped fenders, and an inset cabin leave
    // a real dark opening when either front door swings outward.
    add(body, loft(`${variant}:sill`, [
      { z: front, w: w - .17, bottom: .31, top: .57 },
      { z: front + .2, w: w - .035, bottom: .26, top: .59 },
      { z: rear - .2, w: w - .035, bottom: .26, top: .59 },
      { z: rear, w: w - .18, bottom: .32, top: .57 },
    ]), paint);
    add(body, loft(`${variant}:hood`, [
      { z: front + .015, w: w - (gt || electric ? .16 : .09), bottom: .5, top: belt - .17 },
      { z: front + .28, w: w - .045, bottom: .48, top: belt - .075 },
      { z: (front + screenFront) / 2, w: w - .008, bottom: .48, top: belt + .015 },
      { z: screenFront - .1, w, bottom: .48, top: belt },
      { z: screenFront, w: w - .015, bottom: .49, top: belt },
    ]), paint);
    add(body, loft(`${variant}:rear-deck`, [
      { z: doorEnd + .025, w: w - .015, bottom: .49, top: belt },
      { z: rear - .3, w: w - .025, bottom: .48, top: gt || bmw || variant === 'sedan' ? belt - .04 : belt + .01 },
      { z: rear, w: w - .12, bottom: .5, top: belt - .1 },
    ]), paint);
    box(body, C.inset, [0, .65, (screenFront + screenRear) / 2], [1.62, .3, screenRear - screenFront]);
    box(body, C.inset, [0, .96, screenFront + .19], [1.53, .12, .25]);
    for (const side of [-1, 1]) {
      box(body, C.rubber, [side * (w - .035), .4, .02], [.06, .12, rear - front - .4]);
      box(body, C.trim, [side * (w - .012), belt - .075, (doorEnd + rear - .25) / 2], [.018, .028, rear - .25 - doorEnd]);
      // Rear passenger-door seam, recessed handle, and sculpted shoulder line.
      beam(body, C.inset, [side * (w - .012), .57, doorEnd + .075], [side * (w - .012), belt, doorEnd + .075], .014);
      box(body, C.chrome, [side * (w + .001), belt - .115, 1.12], [.025, .034, .18]);
      for (const z of [spec.wheelFront, spec.wheelRear]) {
        add(body, cache(`${variant}:arch-inset`, () => new THREE.CircleGeometry(radius + .075, 20, 0, Math.PI)), C.inset,
          [side * (w + .002), radius + .035, z], unit, [0, side * Math.PI / 2, 0]);
        add(body, cache(`${variant}:arch-lip`, () => new THREE.TorusGeometry(radius + .055, .027, 5, 18, Math.PI)), variant === 'suv' ? C.rubber : paint,
          [side * (w + .003), radius + .035, z], unit, [0, side * Math.PI / 2, 0]);
        // The caliper stays attached to the body while the rotor/wheel turns.
        add(body, round, gt ? '#ba4234' : electric ? '#54616a' : '#747e82', [side * (w - .11), radius + .055, z + .13], [.055,.13,.07]);
      }
      // A quiet highlight and darker lower crease emphasize curved sheet metal.
      beam(body, paint, [side*(w-.13),belt-.095,front+.37], [side*(w-.095),belt-.055,screenFront-.08], .012);
      if (gt) for (let vent = 0; vent < 3; vent++) {
        const z = screenFront - .18 - vent * .16;
        add(body, round, C.chrome, [side*(w+.005),belt-.105,z],[.012,.034,.047]);
        add(body, round, C.inset, [side*(w+.022),belt-.105,z],[.006,.025,.034]);
      }
    }
    // Each roof has its own silhouette. The electric crossover uses a single
    // smooth glass arch, with its side windows following the same profile.
    const electricControl = [
      {z:screenFront,y:belt+.025,w:w-.095}, {z:-.72,y:1.43,w:.825},
      {z:-.15,y:1.68,w:.755}, {z:.35,y:1.735,w:.75},
      {z:.9,y:1.59,w:.78}, {z:1.4,y:1.335,w:.835}, {z:screenRear,y:belt+.045,w:w-.12},
    ];
    const electricProfile=[];
    for(let i=0;i<electricControl.length-1;i++)for(let step=0;step<3;step++){
      const t=step/3,a=electricControl[i],b=electricControl[i+1],before=electricControl[Math.max(0,i-1)],after=electricControl[Math.min(electricControl.length-1,i+2)];
      const point={z:a.z+(b.z-a.z)*t};
      for(const key of['y','w'])point[key]=clamp(.5*(2*a[key]+(b[key]-before[key])*t+(2*before[key]-5*a[key]+4*b[key]-after[key])*t*t+(-before[key]+3*a[key]-3*b[key]+after[key])*t*t*t),Math.min(a[key],b[key]),Math.max(a[key],b[key]));
      electricProfile.push(point);
    }
    electricProfile.push(electricControl.at(-1));
    const roofAt = z => {
      for(let i=1;i<electricProfile.length;i++) if(z<=electricProfile[i].z) {
        const a=electricProfile[i-1],b=electricProfile[i],t=clamp((z-a.z)/(b.z-a.z),0,1);
        return {z,y:a.y+(b.y-a.y)*t,w:a.w+(b.w-a.w)*t};
      }
      return electricProfile.at(-1);
    };
    if(electric) {
      const glassArch=cache(`${variant}:glass-arch`,()=>{
        const positions=[],indices=[];
        for(const ring of electricProfile) for(let i=0;i<=8;i++) {
          const across=i/4-1;
          positions.push(across*ring.w,ring.y+(1-across*across)*.045,ring.z);
        }
        for(let row=0;row<electricProfile.length-1;row++)for(let col=0;col<8;col++) {
          const a=row*9+col;indices.push(a,a+9,a+1,a+1,a+9,a+10);
        }
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
      });
      add(body,glassArch,C.glass);
      for(const side of[-1,1])for(let i=1;i<electricProfile.length;i++){
        const a=electricProfile[i-1],b=electricProfile[i];
        beam(body,paint,[side*a.w,a.y,a.z],[side*b.w,b.y,b.z],.037);
      }
      const p=roofAt(-1.12),q=roofAt(-.35);
      add(body,quad(`${variant}:screen-reflection`,[[p.w*.6,p.y+.02,p.z-.003],[p.w*.72,p.y+.015,p.z-.003],[q.w*.72,q.y+.03,q.z-.003],[q.w*.6,q.y+.035,q.z-.003]]),C.reflection);
    } else {
      add(body, loft(`${variant}:roof`, [
        { z: roofFront - .055, w: rw - .03, bottom: roof - .025, top: roof + .025 },
        { z: roofFront + .11, w: rw + .015, bottom: roof - .025, top: roof + .055 },
        { z: roofRear - .11, w: rw + .015, bottom: roof - .025, top: roof + .055 },
        { z: roofRear + .055, w: rw - .03, bottom: roof - .025, top: roof + .025 },
      ]), roofPaint);
      add(body, quad(`${variant}:windscreen`, [[-w + .095, belt + .025, screenFront], [w - .095, belt + .025, screenFront], [rw - .04, roof - .025, roofFront], [-rw + .04, roof - .025, roofFront]]), C.glass);
      add(body, quad(`${variant}:rear-screen`, [[-rw + .04, roof - .025, roofRear], [rw - .04, roof - .025, roofRear], [w - .12, belt + .045, screenRear], [-w + .12, belt + .045, screenRear]]), C.glass);
      const screenPoint = (across, up) => {
        const half = (w - .095) * (1 - up) + (rw - .04) * up;
        return [-half + 2 * half * across, (belt + .025) * (1 - up) + (roof - .025) * up + .003,
          screenFront * (1 - up) + roofFront * up - .003];
      };
      add(body, quad(`${variant}:screen-reflection`, [screenPoint(.075, .12), screenPoint(.19, .12), screenPoint(.19, .91), screenPoint(.075, .91)]), C.reflection);
    }
    beam(body, C.rubber, [-.53, belt + .045, screenFront - .008], [-.04, belt + .095, screenFront + .025], .018);
    beam(body, C.rubber, [.04, belt + .045, screenFront - .008], [.57, belt + .095, screenFront + .025], .018);
    for (const side of [-1, 1]) {
      if(!electric){
        beam(body, roofPaint, [side * (w - .06), belt + .015, screenFront], [side * rw, roof, roofFront], .05);
        beam(body, roofPaint, [side * rw, roof, roofRear], [side * (w - .07), belt + .015, screenRear], gt ? .09 : bmw || variant === 'sedan' ? .12 : .095);
      }
      const top=electric?roofAt(doorEnd+.03):{w:rw,y:roof};
      beam(body, C.rubber, [side * (w - .025), belt + .025, doorEnd + .03], [side * top.w, top.y, doorEnd + .03], electric?.035:.055);
      const sideWindow = electric ? [[side*(w-.038),belt+.04,doorEnd+.08],[side*(w-.07),belt+.04,screenRear-.1],
        ...electricProfile.filter(point=>point.z>doorEnd+.08&&point.z<screenRear-.1).reverse().map(point=>[side*(point.w-.006),point.y-.018,point.z]),
        [side*(roofAt(doorEnd+.08).w-.006),roofAt(doorEnd+.08).y-.018,doorEnd+.08]] :
        [[side * (w - .038), belt + .04, doorEnd + .08], [side * (w - .07), belt + .04, screenRear - .12],
        [side * (rw - .008), roof - .055, roofRear - .08], [side * (rw - .008), roof - .055, doorEnd + .08]];
      add(body,electric?windowPolygon(`${variant}:rear-quarter:${side}`,sideWindow):quad(`${variant}:rear-quarter:${side}`,sideWindow),C.glass);
      beam(body, electric ? C.rubber : C.chrome, sideWindow[0], sideWindow[1], electric?.013:.022);
      if(!electric){beam(body,C.chrome,sideWindow[1],sideWindow[2],.023);beam(body,C.chrome,sideWindow[2],sideWindow[3],.018);}
      if (variant === 'suv') {
        beam(body, C.trim, [side * .64, roof + .12, roofFront + .15], [side * .64, roof + .12, roofRear - .05], .045);
        for (const z of [roofFront + .2, roofRear - .1]) box(body, C.rubber, [side * .64, roof + .08, z], [.08, .08, .1]);
      }
    }
    // Original brand-inspired geometry: long GT oval and trident, executive
    // twin kidneys, or an uninterrupted electric nose. No image asset is used.
    if (gt) {
      add(body, round, C.inset, [0,belt-.295,front-.025],[.65,.205,.06]);
      add(body, badgeRing, C.chrome, [0,belt-.295,front-.07],[.63,.193,.035]);
      for(let i=-5;i<=5;i++) box(body,C.trim,[i*.101,belt-.295,front-.086],[.014,.29*Math.sqrt(1-(i/6)**2),.008]);
      const z=front-.102, y=belt-.3;
      beam(body,C.chrome,[0,y-.11,z],[0,y+.12,z],.023);
      for(const side of[-1,1]){
        beam(body,C.chrome,[0,y+.005,z],[side*.075,y+.065,z],.019);
        beam(body,C.chrome,[side*.075,y+.065,z],[side*.075,y+.14,z],.019);
        beam(body,C.chrome,[side*.075,y+.14,z],[side*.045,y+.105,z],.015);
      }
      beam(body,C.chrome,[-.045,y-.1,z],[.045,y-.1,z],.018);
    } else if (bmw) {
      const kidney=[[-.09,-.115],[.09,-.115],[.133,-.073],[.133,.078],[.09,.12],[-.09,.12],[-.133,.078],[-.133,-.073]];
      const kidneyShape=cache('bmw:kidney',()=>meshGeometry(kidney.map(([x,y])=>[x,y,0]),[kidney.map((_,i)=>i),kidney.map((_,i)=>kidney.length-1-i)]));
      for(const side of[-1,1]){
        const center=side*.165,y=belt-.285,z=front-.025;
        add(body,kidneyShape,C.inset,[center,y,z]);
        for(let i=0;i<kidney.length;i++){const a=kidney[i],b=kidney[(i+1)%kidney.length];beam(body,C.chrome,[center+a[0],y+a[1],z-.008],[center+b[0],y+b[1],z-.008],.016);}
        for(let i=-2;i<=2;i++)box(body,C.trim,[center+i*.043,y,z-.012],[.009,.185,.009]);
      }
      add(body,round,C.chrome,[0,belt-.048,front-.025],[.052,.052,.014]);
      for(let i=0;i<4;i++)add(body,cache(`roundel-quarter:${i}`,()=>new THREE.CircleGeometry(.038,6,i*Math.PI/2,Math.PI/2)),i%2?'#f1f1e5':'#337db7',[0,belt-.048,front-.04],unit,[0,Math.PI,0]);
    } else if (electric) {
      box(body,C.inset,[0,.375,front+.012],[1.38,.045,.027]);
      beam(body,C.chrome,[-.075,belt-.04,front-.012],[.075,belt-.04,front-.012],.016);
      beam(body,C.chrome,[0,belt-.045,front-.015],[0,belt-.13,front-.015],.021);
    } else {
      box(body, C.inset, [0, belt - .34, front - .008], [1.25, .21, .028]);
      for (const y of [belt - .4, belt - .32, belt - .24]) box(body, C.chrome, [0, y, front - .025], [1.12, .014, .016]);
      box(body, C.chrome, [0, belt - .3, front - .04], [.05, .12, .025]);
    }
    box(body, C.rubber, [0, .36, front + .02], [1.55, .07, .12]);
    box(body, C.rubber, [0, .39, rear - .025], [1.52, .11, .12]);
    for (const side of [-1, 1]) {
      const lampY=belt-.14;
      const lens=[[side*.54,lampY-.035,front+.025],[side*.93,lampY-.025,front+.11],
        [side*.92,lampY+.035,front+.15],[side*.55,lampY+.035,front+.04]];
      add(body,quad(`${variant}:headlamp:${side}`,lens),C.inset);
      beam(frontLights,C.white,[side*.565,lampY+.006,front+.025],[side*.895,lampY+.006,front+.103],.017,.014);
      if(bmw)for(const offset of[.62,.81])beam(frontLights,C.white,[side*offset,lampY+.005,front+.025+(offset-.565)*.236],[side*offset,lampY-.024,front+.025+(offset-.565)*.236],.013);
      else beam(frontLights,C.white,[side*.895,lampY+.006,front+.103],[side*.885,lampY-.02,front+.098],.013);
      box(body, C.inset, [side * .67, belt - .15, rear + .005], [.49, .16, .045]);
      box(rearLights, C.red, [side * .67, belt - .12, rear + .031], [.43, .042, .025]);
      box(rearLights, C.red, [side * .85, belt - .16, rear + .03], [.04, .12, .024]);
      if(!electric){
        add(body,round,C.chrome,[side*.61,.34,rear+.015],[gt?.13:.095,.052,.08]);
        add(body,round,C.inset,[side*.61,.34,rear+.073],[gt?.102:.07,.035,.012]);
      }
    }
    if (variant !== 'suv') box(rearLights, C.red, [0, belt - .1, rear + .022], [electric?1.22:.8, .022, .018]);
    for (const end of [-1, 1]) {
      const z = end < 0 ? front - .028 : rear + .031, y = end < 0 ? .48 : belt - .34;
      box(body, C.rubber, [0, y, z], [.5, .18, .018]);
      box(body, C.plate, [0, y, z + end * .012], [.46, .14, .012]);
      for (const [x, height] of [[-.155, .075], [-.09, .075], [.005, .075], [.07, .075], [.14, .06]]) {
        box(body, C.inset, [x, y, z + end * .021], [.013, height, .004]);
      }
      box(body, C.inset, [-.122, y, z + end * .022], [.06, .012, .004]);
      box(body, C.inset, [.037, y + .032, z + end * .022], [.065, .012, .004]);
      box(body, C.inset, [.037, y - .032, z + end * .022], [.065, .012, .004]);
    }
    if (variant === 'hatch') box(body, paint, [0, roof + .03, roofRear + .13], [1.49, .065, .23]);
    if (police) {
      box(body, C.rubber, [0, roof + .16, .05], [1.38, .11, .38]);
      beam(body, C.rubber, [.59, roof + .05, roofRear - .2], [.61, roof + .42, roofRear - .12], .015);
    }
    // Both mirrors and the shaped window travel with the front-hinged door.
    const doorPaint = police ? '#e8eeee' : paint;
    const panel = cache(`${variant}:door-panel`, () => meshGeometry([
      [-w + .045, .52, screenFront], [-w + .045, .52, doorEnd], [-w, belt, doorEnd], [-w, belt, screenFront],
      [-w + .11, .52, screenFront], [-w + .11, .52, doorEnd], [-w + .07, belt, doorEnd], [-w + .07, belt, screenFront],
    ], [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [3, 2, 6, 7], [0, 3, 7, 4]]));
    add(door, panel, doorPaint);
    const window = electric ? [[-w+.035,belt+.035,screenFront+.075],[-w+.035,belt+.035,doorEnd-.025],
      [-roofAt(doorEnd-.025).w+.012,roofAt(doorEnd-.025).y-.025,doorEnd-.025],
      ...electricProfile.filter(point=>point.z>screenFront+.075&&point.z<doorEnd-.025).reverse().map(point=>[-point.w+.012,point.y-.025,point.z])] :
      [[-w + .035, belt + .035, screenFront + .075], [-w + .035, belt + .035, doorEnd - .025],
      [-rw + .015, roof - .045, doorEnd - .025], [-rw + .015, roof - .045, roofFront + .045]];
    add(door,electric?windowPolygon(`${variant}:door-window`,window):quad(`${variant}:door-window`,window),C.glass);
    beam(door,electric?C.rubber:C.chrome,window[0],window[1],electric?.013:.023);
    for(let i=1;i<window.length;i++)beam(door,C.rubber,window[i],window[(i+1)%window.length],electric?.015:.026);
    beam(door, C.inset, [-w - .003, .55, doorEnd], [-w - .003, belt, doorEnd], .013);
    box(door, C.chrome, [-w - .012, belt - .12, doorEnd - .21], [.028, .036, .19]);
    beam(door, C.trim, [-w - .004, belt - .07, screenFront + .06], [-w - .004, belt - .07, doorEnd - .055], .017);
    beam(door,C.trim,[-w+.005,belt+.09,screenFront+.14],[-w-.075,belt+.135,screenFront+.16],.03);
    add(door,round,doorPaint,[-w-.055,belt+.16,screenFront+.16],[.105,.062,.13],[0,-.14,0]);
    add(door,round,C.reflection,[-w-.055,belt+.16,screenFront+.27],[.083,.043,.012],[0,-.14,0]);
    // A narrow reflected highlight follows the window slope.
    if(!electric)beam(door, C.reflection, [-w + .038, belt + .1, screenFront + .21], [-rw + .012, roof - .11, roofFront + .17], .028);
    return { body: bake(`${tag}:body`, body), door: bake(`${tag}:door`, door, hinge.map(value => -value)),
      frontLights: bake(`${variant}:front-led`, frontLights), rearLights: bake(`${variant}:rear-led`, rearLights), hinge };
  }

  function wheelGeometry(spec, variant) {
    if (wheelsByVariant.has(variant)) return wheelsByVariant.get(variant);
    const pieces = [], radius = spec.radius;
    const cylinder = (name, r, width, segments) => cache(name, () => new THREE.CylinderGeometry(r, r, width, segments));
    const tire = cache(`${variant}:rounded-tire`, () => new THREE.LatheGeometry([
      new THREE.Vector2(radius*.69,-.112),new THREE.Vector2(radius*.88,-.116),new THREE.Vector2(radius*.97,-.095),
      new THREE.Vector2(radius,-.055),new THREE.Vector2(radius,.055),new THREE.Vector2(radius*.97,.095),
      new THREE.Vector2(radius*.88,.116),new THREE.Vector2(radius*.69,.112),
    ],24));
    add(pieces, tire, C.rubber, [0, 0, 0], unit, [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) {
      add(pieces, cylinder(`${variant}:rim-well`, radius * .73, .012, 24), C.inset, [side * .112, 0, 0], unit, [0, 0, Math.PI / 2]);
      add(pieces, cylinder(`${variant}:brake-rotor`, radius * .55, .012, 20), '#68747a', [side * .12, 0, 0], unit, [0, 0, Math.PI / 2]);
      add(pieces, cache(`${variant}:rim-ring`, () => new THREE.TorusGeometry(radius * .72, .017, 6, 24)), C.chrome,
        [side * .133, 0, 0], unit, [0, Math.PI / 2, 0]);
      const spokes=variant==='maserati-gt'?7:5, aero=variant==='tesla-model-y';
      for (let spoke = 0; spoke < spokes; spoke += 1) {
        const angle = spoke / spokes * Math.PI * 2;
        if(aero) {
          beam(pieces,'#71818b',[side*.143,Math.cos(angle)*.06,Math.sin(angle)*.06],
            [side*.143,Math.cos(angle+.22)*radius*.65,Math.sin(angle+.22)*radius*.65],.018,.085);
        } else for(const split of[-1,1]) {
          beam(pieces,C.chrome,[side*.14,Math.cos(angle)*.07,Math.sin(angle)*.07],
            [side*.14,Math.cos(angle+split*.12)*radius*.66,Math.sin(angle+split*.12)*radius*.66],.024,.022);
        }
        const rotorAngle=angle+.3;
        add(pieces,cache('rotor-drill',()=>new THREE.CircleGeometry(.012,5)),C.inset,
          [side*.129,Math.cos(rotorAngle)*radius*.44,Math.sin(rotorAngle)*radius*.44],unit,[0,side*Math.PI/2,0]);
      }
      add(pieces, cylinder(`${variant}:rim-hub`, .06, .02, 12), '#ccd1cd', [side * .145, 0, 0], unit, [0, 0, Math.PI / 2]);
      for(let lug=0;lug<5;lug++) {
        const angle=lug/5*Math.PI*2;
        add(pieces,round,C.inset,[side*.159,Math.cos(angle)*.043,Math.sin(angle)*.043],[.008,.009,.009]);
      }
      // A single small valve and asymmetric spoke faces make wheel roll visible.
      box(pieces, '#778b91', [side * .15, radius * .59, .02], [.012, .025, .035]);
    }
    const geometry = bake(`${variant}:wheel-assembly`, pieces);
    wheelsByVariant.set(variant, geometry); return geometry;
  }

  // Damage is baked into a separate cached shell. Never recolor the shared
  // intact geometry/material: two cars with the same paint can have different
  // health, and repeated police IDs reuse this bounded palette cache.
  function damageGeometry(original, key, severity, hinge = [0, 0, 0]) {
    return cache(`damage:${key}:${severity}`, () => {
      const result = original.clone(), positions = result.attributes.position, colors = result.attributes.color;
      const charred = severity >= 2, wreck = severity === 3;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i) + hinge[0], y = positions.getY(i) + hinge[1], z = positions.getZ(i) + hinge[2];
        const front = clamp((-z - .85) / 1.25, 0, 1), upper = clamp((y - .8) / .85, 0, 1);
        const crease = Math.sin(z * 7 + y * 5) * Math.sin(y * 9 - x * 3);
        const dent = (.045 + (wreck ? .13 : .035)) * front;
        positions.setXYZ(i, x * (1 - dent) - hinge[0], y - front * (.05 + (wreck ? .2 : .035))
          - (wreck ? upper * .24 : 0) + crease * front * .025 - hinge[1],
        z + front * (wreck ? .31 : .12) - hinge[2]);
        const scrape = y < 1.05 && (front > .45 || Math.abs(x) > .82) && Math.sin(z * 14 + y * 17) > .66;
        const soot = charred ? .4 * (1 - front * .92) : 1 - front * .24;
        const gray = scrape ? (charred ? .006 : .09) : 0;
        if (wreck) colors.setXYZ(i, .006 + colors.getX(i) * .012, .007 + colors.getY(i) * .012, .009 + colors.getZ(i) * .012);
        else colors.setXYZ(i, colors.getX(i) * soot + gray, colors.getY(i) * soot + gray, colors.getZ(i) * soot + gray);
      }
      positions.needsUpdate = colors.needsUpdate = true;
      result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere(); return result;
    });
  }

  return function createVehicleVisual(color, kind = null, id = '', options = {}) {
    const police = kind === 'police', variant = resolveVehicleVariant(id, kind, options?.variant), spec = VARIANTS[variant];
    const paint = police ? '#172a39' : `#${new THREE.Color(color ?? '#b5c7b8').getHexString()}`;
    const paletteKey = `${variant}:${police ? 'police' : paint}`;
    if (!shapesByPalette.has(paletteKey)) shapesByPalette.set(paletteKey, details(spec, variant, paint, police));
    const shapes = shapesByPalette.get(paletteKey);
    const group = new THREE.Group(); group.name = `vehicle:${id}`;
    const body = part(group, shapes.body, solid, [0, 0, 0], unit);
    const frontLights = part(group, shapes.frontLights, M.lit, [0, 0, 0], unit);
    const rearLights = part(group, shapes.rearLights, M.red, [0, 0, 0], unit);
    const door = new THREE.Group(); door.position.set(...shapes.hinge); group.add(door);
    const doorShell = part(door, shapes.door, solid, [0, 0, 0], unit);
    const passengerDoor = door.clone(); passengerDoor.position.x = -shapes.hinge[0]; passengerDoor.scale.x = -1; group.add(passengerDoor);
    const passengerShell = passengerDoor.children[0], decals = [];
    let redFlash = null, blueFlash = null;
    if (police) {
      const decal = policeDecal();
      decals.push(part(group, planeGeometry, decal, [0, spec.belt + .011, -1.28], [1.22, .5, 1], [-Math.PI / 2, 0, 0]));
      const localY = spec.belt - .76, localZ = .71;
      decals.push(part(door, planeGeometry, decal, [-.012, localY, localZ], [1.03, .25, 1], [0, -Math.PI / 2, 0]));
      decals.push(part(passengerDoor, planeGeometry, decal, [-.012, localY, localZ], [-1.03, .25, 1], [0, -Math.PI / 2, 0]));
      redFlash = part(group, boxGeometry, policeRedOff, [-.36, spec.roof + .29, .05], [.57, .16, .31]);
      blueFlash = part(group, boxGeometry, policeBlueOff, [.36, spec.roof + .29, .05], [.57, .16, .31]);
    }
    const wheelMesh = new THREE.InstancedMesh(wheelGeometry(spec, variant), wheelMaterial, 4);
    wheelMesh.name = 'animated-wheels'; wheelMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    wheelMesh.castShadow = false; wheelMesh.receiveShadow = false;
    // Their transforms stay inside this fixed sphere, including full steering.
    wheelMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .6, 0), 2.4); group.add(wheelMesh);
    const occupant = new THREE.Group(); group.add(occupant);
    const driverPieces = [];
    add(driverPieces, sphereGeometry, '#c99070', [-.83, spec.belt + .34, -.07], [.105, .145, .12]);
    box(driverPieces, police ? '#29425c' : '#8baeb5', [-.82, spec.belt + .125, 0], [.17, .28, .29]);
    add(driverPieces, sphereGeometry, '#263840', [-.83, spec.belt + .43, -.045], [.112, .065, .115]);
    part(occupant, bake(`${variant}:${police ? 'police' : 'civilian'}:occupant`, driverPieces), driverMaterial, [0, 0, 0], unit);
    contact(group, 1.17, 2.18);
    const model = { group, door, passengerDoor, occupant, police, redFlash, blueFlash, paintSource: color, damageStage: null,
      ownedGeometries: new Set(), variant, variantSource: options?.variant,
      flashOffset: [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 8,
      wheels: { mesh: wheelMesh, radius: spec.radius, x: spec.width - .125, front: spec.wheelFront, rear: spec.wheelRear,
        roll: 0, steer: 0, previousHeading: null, transform: new THREE.Object3D() },
      setDamage(stage) {
        if (model.damageStage === stage) return;
        model.damageStage = stage;
        const severity = stage === 'wreck' ? 3 : stage === 'burning' || stage === 'smoking' ? 2 : stage === 'damaged' ? 1 : 0;
        const key = `${variant}:${police ? 'police' : paint}`;
        body.geometry = severity ? damageGeometry(shapes.body, `${key}:body`, severity) : shapes.body;
        doorShell.geometry = passengerShell.geometry = severity ? damageGeometry(shapes.door, `${key}:door`, severity, shapes.hinge) : shapes.door;
        body.material = doorShell.material = passengerShell.material = severity ? damagedSolid : solid;
        frontLights.visible = rearLights.visible = stage !== 'wreck';
        frontLights.material = severity ? brokenLamp : M.lit;
        rearLights.material = severity >= 2 ? brokenLamp : M.red;
        for (const decal of decals) decal.visible = severity < 2;
        wheelTint.set(stage === 'wreck' ? '#494744' : '#ffffff');
        for (let i = 0; i < 4; i += 1) wheelMesh.setColorAt(i, wheelTint);
        wheelMesh.instanceColor.needsUpdate = true;
      },
      dispose() { wheelMesh.dispose(); },
    };
    animateVehicleVisual(model, { speed: 0, heading: 0 }, 0);
    scene.add(group); return model;
  };
}

export function animateVehicleVisual(model, state = {}, dt = 0) {
  const wheels = model?.wheels;
  if (!wheels) return;
  const stage = state.damageStage || 'intact';
  model.setDamage?.(stage);
  const elapsed = clamp(finite(dt), 0, .1), speed = stage === 'wreck' || stage === 'burning' ? 0 : finite(state.speed), heading = finite(state.heading);
  const turnRate = elapsed && wheels.previousHeading !== null ? angleDelta(heading, wheels.previousHeading) / elapsed : 0;
  wheels.previousHeading = heading;
  // Player steering is authoritative; NPCs expose heading instead, so infer
  // only their visual axle angle. Neither branch modifies the simulation.
  const requested = Number.isFinite(state.steerAngle) ? clamp(state.steerAngle, -1, 1) * .42
    : Math.abs(speed) > .3 ? clamp(Math.atan(turnRate * 2.45 / speed), -.42, .42) : 0;
  if (elapsed) {
    wheels.steer += (requested - wheels.steer) * (1 - Math.exp(-16 * elapsed));
    wheels.roll = (wheels.roll - speed * elapsed / wheels.radius) % (Math.PI * 2);
  }
  let index = 0;
  for (const z of [wheels.front, wheels.rear]) for (const side of [-1, 1]) {
    const transform = wheels.transform;
    transform.position.set(side * wheels.x, wheels.radius + .035, z);
    transform.rotation.set(wheels.roll, z === wheels.front ? -wheels.steer : 0, 0, 'YXZ');
    transform.updateMatrix(); wheels.mesh.setMatrixAt(index, transform.matrix); index += 1;
  }
  wheels.mesh.instanceMatrix.needsUpdate = true;
}
