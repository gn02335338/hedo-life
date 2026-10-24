// Bounded original race graphics: one static start line, one checkpoint gate
// and at most 64 route arrows. No lights, per-frame geometry or texture creation.
export function createRacingVisuals({ THREE, scene, mat, geometries, materials, boxGeometry, sign, location }) {
  const transform=new THREE.Object3D(), color=new THREE.Color();
  const startMaterial=mat('#ffffff',{vertexColors:false,roughness:.85});
  const gateMaterial=new THREE.MeshBasicMaterial({color:'#92ead6',transparent:true,opacity:.8,depthWrite:false});
  const routeMaterial=new THREE.MeshBasicMaterial({color:'#ffd0a3',transparent:true,opacity:.65,depthWrite:false,side:THREE.DoubleSide});
  routeMaterial.forceSinglePass=true;materials.set('race-gate',gateMaterial);materials.set('race-route',routeMaterial);
  const start=new THREE.InstancedMesh(boxGeometry,startMaterial,32);start.name='race-start-line';start.count=32;
  for(let i=0;i<32;i++){
    const column=i%2,row=Math.floor(i/2);transform.position.set(location.x+(column-.5)*.45,.026,location.z+(row-7.5)*.83);
    transform.scale.set(.43,.025,.8);transform.updateMatrix();start.setMatrixAt(i,transform.matrix);start.setColorAt(i,color.set((row+column)%2?'#33404c':'#f1d9bb'));
  }
  start.instanceMatrix.needsUpdate=true;start.instanceColor.needsUpdate=true;scene.add(start);
  const startSign=sign('AFTERWORK RUN','禾多街頭賽  /  START HERE',6.8,1.15,'#ffe1bc','#533f53');
  startSign.name='race-start-sign';startSign.position.set(location.x,5.6,location.z);startSign.rotation.y=-Math.PI/2;
  const gate=new THREE.InstancedMesh(boxGeometry,gateMaterial,7);gate.name='race-checkpoint-gate';gate.count=0;gate.visible=false;gate.frustumCulled=false;
  gate.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(gate);
  const arrowGeometry=new THREE.BufferGeometry();arrowGeometry.setAttribute('position',new THREE.Float32BufferAttribute([
    0,0,-.9,-.47,0,.42,0,0,.08, 0,0,-.9,0,0,.08,.47,0,.42,
  ],3));arrowGeometry.computeVertexNormals();geometries.add(arrowGeometry);
  const arrows=new THREE.InstancedMesh(arrowGeometry,routeMaterial,64);arrows.name='race-route-arrows';arrows.count=0;arrows.visible=false;arrows.frustumCulled=false;
  arrows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);scene.add(arrows);
  const points=new Float64Array(28);points.fill(NaN);
  let routeCount=-1,wasLow=false,gateX=NaN,gateZ=NaN,gateRadius=NaN,gateHeading=NaN,disposed=false;
  function place(index,x,y,z,w,h,d,heading=0){transform.position.set(x,y,z);transform.rotation.set(0,heading,0);transform.scale.set(w,h,d);transform.updateMatrix();gate.setMatrixAt(index,transform.matrix);}
  function update(state,{time=0,low=false,reducedMotion=false}={}) {
    if(disposed)return;
    const active=Boolean(state?.active),checkpoint=state?.checkpoint;
    const valid=active&&Number.isFinite(checkpoint?.x)&&Number.isFinite(checkpoint?.z);
    gate.visible=Boolean(valid);arrows.visible=active;
    const route=Array.isArray(state?.route)?state.route:[],count=Math.min(14,route.length);
    let dirty=count!==routeCount||low!==wasLow;
    for(let i=0;i<count;i++)if(points[i*2]!==route[i]?.x||points[i*2+1]!==route[i]?.z)dirty=true;
    if(dirty){
      routeCount=count;wasLow=low;arrows.count=0;
      for(let i=0;i<count;i++){points[i*2]=Number.isFinite(route[i]?.x)?route[i].x:NaN;points[i*2+1]=Number.isFinite(route[i]?.z)?route[i].z:NaN;}
      const maximum=low?32:64,spacing=low?16:9;
      for(let i=1;i<count&&arrows.count<maximum;i++){
        const x=points[(i-1)*2],z=points[(i-1)*2+1],dx=points[i*2]-x,dz=points[i*2+1]-z,length=Math.hypot(dx,dz);
        if(!Number.isFinite(length)||length<1)continue;
        const heading=Math.atan2(dx,-dz);
        for(let distance=3;distance<length-2&&arrows.count<maximum;distance+=spacing){
          transform.position.set(x+dx*distance/length,.06,z+dz*distance/length);transform.rotation.set(0,-heading,0);transform.scale.set(1.2,1,1.2);transform.updateMatrix();arrows.setMatrixAt(arrows.count++,transform.matrix);
        }
      }
      arrows.instanceMatrix.needsUpdate=true;
    }
    if(valid){
      let heading=Math.PI/2;
      for(let i=0;i<count;i++)if(points[i*2]===checkpoint.x&&points[i*2+1]===checkpoint.z){
        const before=i>0?i-1:Math.max(0,count-2),dx=checkpoint.x-points[before*2],dz=checkpoint.z-points[before*2+1];
        if(Number.isFinite(dx)&&Number.isFinite(dz)&&Math.hypot(dx,dz)>.1)heading=Math.atan2(dx,-dz);break;
      }
      const radius=Math.max(3,Math.min(9,Number.isFinite(checkpoint.radius)?checkpoint.radius:7));
      if(gateX!==checkpoint.x||gateZ!==checkpoint.z||gateRadius!==radius||gateHeading!==heading){
        gateX=checkpoint.x;gateZ=checkpoint.z;gateRadius=radius;gateHeading=heading;
        const rx=Math.cos(heading),rz=Math.sin(heading);
        for(let side=-1;side<=1;side+=2){const index=side<0?0:1;place(index,gateX+rx*radius,2.65,gateZ+rz*radius,.13,5.3,.13,-heading);}
        place(2,gateX,5.3,gateZ,radius*2+.14,.14,.14,-heading);
        place(3,gateX,.065,gateZ,radius*2,.04,.23,-heading);
        for(let i=0;i<3;i++)place(4+i,gateX+rx*(i-1)*.5,5.65,gateZ,.24,.24,.14,-heading);
        gate.count=7;gate.instanceMatrix.needsUpdate=true;
      }
      gateMaterial.color.set(state.countdown>0?'#ffc68d':'#92ead6');
      gateMaterial.opacity=reducedMotion?.65:.76+Math.sin((Number.isFinite(time)?time:0)*2)*.08;
    }
    startSign.visible=!active||state.countdown>0;
    arrows.visible=active&&arrows.count>0;
  }
  function dispose(){if(disposed)return;disposed=true;start.dispose();gate.dispose();arrows.dispose();scene.remove(start,gate,arrows,startSign);}
  return{update,dispose,getStats:()=>({active:gate.visible,gateInstances:gate.visible?gate.count:0,arrows:arrows.visible?arrows.count:0,capacity:64})};
}
