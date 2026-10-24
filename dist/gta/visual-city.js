// Original procedural streetscape: small shared textures and instanced details.
// These assets are generated once; there are no downloads or per-frame generators.
export function createCityVisualKit({ THREE, scene, renderer, materials, textures, geometries, mat, M,
  box, cylinder, addBatch, boxGeometry, sphereGeometry, planeGeometry, seed }) {
  function canvasTexture(width, height, draw, repeat = null) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    if (repeat) { texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); }
    textures.add(texture); return texture;
  }
  function grain(ctx, size, base, range, salt) {
    const pixels = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const n = (seed(i + salt) - .5) * range;
      pixels.data[i * 4] = base[0] + n; pixels.data[i * 4 + 1] = base[1] + n;
      pixels.data[i * 4 + 2] = base[2] + n; pixels.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
  }
  const roadMap = canvasTexture(256, 256, ctx => {
    grain(ctx, 256, [100, 104, 110], 28, 7100);
    ctx.strokeStyle = '#414751'; ctx.globalAlpha = .3; ctx.lineWidth = .7;
    for (let i = 0; i < 6; i++) {
      const x = seed(i + 80) * 256, y = seed(i + 120) * 256;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 11, y + 17); ctx.lineTo(x + 6, y + 26); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [64, 64]);
  M.asphalt.color.set('#8a8c91'); M.asphalt.map = roadMap; M.asphalt.roughness = .96;
  M.sidewalk.color.set('#adada6'); M.curb.color.set('#d6d0bd');
  M.white.color.set('#eee6d6'); M.roof.color.set('#768183');
  M.leaf.color.set('#3c6755'); M.leaf2.color.set('#6e8b59');
  M.bark.color.set('#99806c'); M.glass.color.set('#49717e'); M.glass.roughness = .2;
  const plasterMap = canvasTexture(128, 128, ctx => grain(ctx, 128, [231, 228, 221], 13, 3200), [3, 5]);
  const facadePalette = ['#e3bfaa', '#d7d5c1', '#a6b9b9', '#d2b6ac', '#a6b6c4', '#c9baa4'];
  const walls = facadePalette.map(color => {
    const wall = mat(color, { roughness: .88 }); wall.map = plasterMap; return wall;
  });
  const windowMap = canvasTexture(128, 128, (ctx, w, h) => {
    const reflection = ctx.createLinearGradient(0, 0, w, h);
    reflection.addColorStop(0, '#a2b5c4'); reflection.addColorStop(.38, '#577b90');
    reflection.addColorStop(.4, '#38586b'); reflection.addColorStop(1, '#263b4b');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d0d7ce'; ctx.globalAlpha = .2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(52, 0); ctx.lineTo(128, 128); ctx.lineTo(96, 128); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#172f41'; ctx.fillRect(0, 0, 3, h); ctx.fillRect(0, h - 4, w, 4);
  });
  const storefrontMap = canvasTexture(256, 128, (ctx, w, h) => {
    const reflection = ctx.createLinearGradient(0, 0, 0, h);
    reflection.addColorStop(0, '#9ba9ad'); reflection.addColorStop(.46, '#657978');
    reflection.addColorStop(.48, '#293d46'); reflection.addColorStop(1, '#223139');
    ctx.fillStyle = reflection; ctx.fillRect(0, 0, w, h);
    // Suggest shop interiors behind reflected glazing without geometry or transparency.
    ctx.fillStyle = '#b18b60'; ctx.fillRect(19, 34, 88, 53); ctx.fillRect(139, 34, 94, 53);
    ctx.fillStyle = '#e3c299'; ctx.fillRect(22, 38, 80, 3); ctx.fillRect(142, 38, 86, 3);
    ctx.fillStyle = '#394145';
    for (let n = 0; n < 8; n++) ctx.fillRect(24 + n * 27, 63, 15, 23);
    ctx.globalAlpha = .2; ctx.fillStyle = '#c5dddf';
    ctx.beginPath(); ctx.moveTo(45, 0); ctx.lineTo(104, 0); ctx.lineTo(188, h); ctx.lineTo(129, h); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#263842'; ctx.fillRect(0, 0, w, 5); ctx.fillRect(0, 0, 5, h);
    ctx.fillRect(124, 0, 7, h); ctx.fillRect(251, 0, 5, h); ctx.fillRect(0, 120, w, 8);
    ctx.fillStyle = '#b7b4a2'; ctx.fillRect(116, 67, 3, 18); ctx.fillRect(137, 67, 3, 18);
  });
  M.dim.map = windowMap; M.dim.color.set('#b6cbcf'); M.dim.emissiveIntensity = .06;
  const storefront = mat('#e3d4bf', { metalness: .12, roughness: .42 }); storefront.map = storefrontMap;

  const skyTexture = canvasTexture(1024, 512, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    for (const [position, color] of [[0, '#5f88af'], [.25, '#97b0c9'], [.48, '#e4b6ba'], [.56, '#f4c8a0'], [1, '#d5b39e']]) gradient.addColorStop(position, color);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    // Thin high clouds, drawn into the shared sky once, with no animated noise pass.
    for (let i = 0; i < 90; i++) {
      const x = seed(i + 490) * w, y = 145 + seed(i + 620) * 95;
      ctx.fillStyle = `rgba(255,236,218,${.025 + seed(i + 810) * .035})`;
      ctx.beginPath(); ctx.ellipse(x, y, 22 + seed(i + 27) * 135, 1 + seed(i + 44) * 5, -.04, 0, Math.PI * 2); ctx.fill();
    }
  });
  const skyGeometry = new THREE.SphereGeometry(800, 32, 20); geometries.add(skyGeometry);
  const skyMaterial = new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  materials.set('citySky', skyMaterial);
  const sky = new THREE.Mesh(skyGeometry, skyMaterial); sky.renderOrder = -20; scene.add(sky);
  // A tiny, shared environment map adds believable warm reflections to paint/glass.
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'), gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, face === 2 ? '#b6cde3' : '#8fa8c3');
    gradient.addColorStop(.55, '#e7c8b4'); gradient.addColorStop(.57, '#999b95'); gradient.addColorStop(1, '#596a74');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    if (face !== 2 && face !== 3) { ctx.fillStyle = '#56616c'; ctx.fillRect(5, 31, 12, 18); ctx.fillRect(37, 24, 8, 25); }
    return canvas;
  });
  const reflection = new THREE.CubeTexture(faces); reflection.colorSpace = THREE.SRGBColorSpace; reflection.needsUpdate = true;
  // Restrict reflection sampling to vehicles and glazing. The much larger
  // asphalt/facade surfaces use the sun and hemisphere, saving a shader pass's
  // worth of texture sampling on every street pixel.
  textures.add(reflection); M.glass.envMap = reflection; M.glass.envMapIntensity = .5;
  const contactMap = canvasTexture(64, 64, (ctx, w, h) => {
    const shadow = ctx.createRadialGradient(w / 2, h / 2, 3, w / 2, h / 2, w / 2);
    shadow.addColorStop(0, 'rgba(255,255,255,1)'); shadow.addColorStop(.45, 'rgba(255,255,255,.65)');
    shadow.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = shadow; ctx.fillRect(0, 0, w, h);
  });

  const trunkGeometry = new THREE.CylinderGeometry(.72, 1, 1, 7); geometries.add(trunkGeometry);
  const frondGeometry = new THREE.BufferGeometry();
  const vertices = [], indices = [];
  for (let j = 0; j <= 6; j++) {
    const t = j / 6, width = Math.sin(t * Math.PI) * .48;
    vertices.push(t * 3.2, Math.sin(t * Math.PI) * .55 - t * .6, -width,
      t * 3.2, Math.sin(t * Math.PI) * .55 - t * .6, width);
    if (j < 6) { const n = j * 2; indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); }
  }
  frondGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  frondGeometry.setIndex(indices); frondGeometry.computeVertexNormals(); geometries.add(frondGeometry);
  const palmLeaf = mat('#567657', { side: THREE.DoubleSide, roughness: .85 });
  function tree(x, z, size = 1, palm = false) {
    if (!palm) {
      cylinder(M.bark, x, size * 1.7, z, size * .18, size * 3.4);
      for (let i = 0; i < 5; i++) {
        const a = i * 2.4;
        addBatch(sphereGeometry, i % 2 ? M.leaf : M.leaf2, x + Math.cos(a) * .65 * size,
          (3.3 + (i % 3) * .56) * size, z + Math.sin(a) * .65 * size,
          1.25 * size, 1.35 * size, 1.3 * size);
      }
      return;
    }
    for (let i = 0; i < 4; i++) addBatch(trunkGeometry, M.bark, x + i * .10 * size, (i + .5) * 1.25 * size, z,
      (.25 - i * .025) * size, 1.28 * size, (.25 - i * .025) * size, 0, 0, -.08);
    for (let i = 0; i < 8; i++) addBatch(frondGeometry, palmLeaf, x + .37 * size, 5.05 * size, z,
      size, size, size, 0, i * Math.PI / 4, (i % 2) * .12);
  }
  const trim = mat('#d6cebb'), darkTrim = mat('#66747a'), terracotta = mat('#a97763');
  const joint = mat('#7f8989'), drain = mat('#58666c');
  function detailBuilding(b, index, { tw, td, podiumHeight, h }) {
    // All facade depth stays against the existing building shell; roads and exits stay clear.
    for (const side of [-1, 1]) {
      for (const axis of ['x', 'z']) {
        const length = axis === 'x' ? b.w : b.d;
        for (let c = -3; c <= 3; c++) {
          const offset = c * 4.8;
          if (axis === 'x') box(trim, b.x + offset + 2.3, 2.75, b.z + side * (b.d / 2 + .07), .13, 3.45, .12, 0, false);
          else box(trim, b.x + side * (b.w / 2 + .07), 2.75, b.z + offset + 2.3, .12, 3.45, .13, 0, false);
        }
        const y = 1.0;
        if (axis === 'x') box(darkTrim, b.x, y, b.z + side * (b.d / 2 + .06), length - .5, .22, .16, 0, false);
        else box(darkTrim, b.x + side * (b.w / 2 + .06), y, b.z, .16, .22, length - .5, 0, false);
      }
      // Recessed upper-level balcony bands and shallow window surrounds.
      for (let floor = 1; floor < Math.floor(h / 3.1); floor += 3) {
        const y = podiumHeight + 1.1 + floor * 3.1;
        box(trim, b.x, y, b.z + side * (td / 2 + .18), tw + .12, .16, .5, 0, false);
        box(darkTrim, b.x, y + .68, b.z + side * (td / 2 + .36), tw - .8, .055, .055, 0, false);
        for (let k = -2; k <= 2; k++) box(darkTrim, b.x + k * (tw - 2) / 5, y + .34, b.z + side * (td / 2 + .36), .045, .68, .045, 0, false);
      }
      box(trim, b.x + side * (tw / 2 - .22), podiumHeight + h / 2, b.z - td / 2 - .03, .28, h, .16, 0, false);
      box(darkTrim, b.x + side * (b.w / 2 - .22), 2.7, b.z + b.d / 2 + .1, .13, 4.8, .14, 0, false);
    }
    // Rooftop plant room, a cylindrical tank and stepped coping give each block a skyline.
    if (b.kind !== 'court') {
      const tank = index % 3 === 0, top = podiumHeight + h + .4;
      if (tank) {
        cylinder(darkTrim, b.x - tw * .25, top + 1.4, b.z + td * .15, 1.35, 2.7);
        cylinder(trim, b.x - tw * .25, top + 2.82, b.z + td * .15, 1.42, .15);
      }
      for (const side of [-1, 1]) {
        box(trim, b.x, top + .18, b.z + side * (td / 2 - .2), tw, .7, .3);
        box(trim, b.x + side * (tw / 2 - .2), top + .18, b.z, .3, .7, td);
      }
    }
    // Sidewalk seams and drainage are flush decals, not extra collision objects.
    for (let p = -20; p <= 20; p += 2.5) for (const side of [-1, 1]) {
      box(joint, b.x + p, .337, b.z + side * 20.65, .025, .007, 1.0, 0, false);
      box(joint, b.x + side * 20.65, .337, b.z + p, 1.0, .007, .025, 0, false);
    }
    for (const side of [-1, 1]) for (let k = 0; k < 5; k++) {
      box(drain, b.x + side * 19.7, .012, b.z + 21.55 + k * .09, .7, .018, .045, 0, false);
    }
    if (index % 2 === 0) for (const side of [-1, 1]) {
      box(terracotta, b.x + side * (tw * .28), podiumHeight + 2.1, b.z + td / 2 + .3, 2.1, .36, .5);
      box(M.leaf2, b.x + side * (tw * .28), podiumHeight + 2.4, b.z + td / 2 + .3, 1.9, .33, .42, 0, false);
    }
  }
  const hazeColor = new THREE.Color('#fff3dd'), nightColor = new THREE.Color('#3c3a61');
  let lastDark = -1;
  return {
    storefront, contactMap, environment: reflection, wall: index => walls[index % walls.length], tree, detailBuilding,
    update(darkness) { if (darkness !== lastDark) { skyMaterial.color.copy(hazeColor).lerp(nightColor, darkness); lastDark = darkness; } },
  };
}
