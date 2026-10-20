/* 3D 레이어: 기본 도형, 데생 인형(관절 포즈), 음영·툰·선화 렌더, 카메라 조작, 3D 카메라에서 퍼스 자 작성.
 * three.js(r128)는 vendor/에 동봉되어 오프라인에서도 동작한다. */
'use strict';

const POSES = {
  '기본': {},
  '차렷': { shoulderL: [0, 0, 4], shoulderR: [0, 0, -4] },
  'T 포즈': { shoulderL: [0, 0, 90], shoulderR: [0, 0, -90] },
  '걷기': { shoulderL: [-25, 0, 6], shoulderR: [25, 0, -6], elbowL: [-15, 0, 0], elbowR: [-20, 0, 0], hipL: [25, 0, 0], hipR: [-22, 0, 0], kneeL: [10, 0, 0], kneeR: [30, 0, 0] },
  '달리기': { spine: [12, 0, 0], shoulderL: [-55, 0, 8], shoulderR: [50, 0, -8], elbowL: [-90, 0, 0], elbowR: [-85, 0, 0], hipL: [60, 0, 0], hipR: [-35, 0, 0], kneeL: [70, 0, 0], kneeR: [95, 0, 0] },
  '앉기': { hipL: [90, 0, 4], hipR: [90, 0, -4], kneeL: [-90, 0, 0], kneeR: [-90, 0, 0], shoulderL: [-20, 0, 6], shoulderR: [-20, 0, -6], elbowL: [-40, 0, 0], elbowR: [-40, 0, 0] },
  '손 흔들기': { shoulderR: [0, 0, -150], elbowR: [0, 0, -30], shoulderL: [0, 0, 6], neck: [0, -10, 0] },
  '생각하기': { shoulderR: [-40, 0, -20], elbowR: [-130, 0, 0], neck: [10, 0, 8], shoulderL: [-10, 0, 25], elbowL: [-90, 0, 0] },
};
const Three3D = {
  loading: null, renderer: null, scenes: new WeakMap(), selId: null, part: null,
  mode: 'camera',
  ensure() {
    if (window.THREE) return Promise.resolve();
    if (!this.loading) this.loading = loadScript('vendor/three.min.js').catch(() => loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'));
    return this.loading;
  },
  defaultCamera() { return { pos: [140, 150, 460], target: [0, 95, 0], fov: 38 }; },
  newLayer() {
    this.ensure().then(() => {
      let L;
      structural('3D 레이어', [], () => {
        L = newLayer({ type: '3d', name: '3D', data: { objects: [], camera: this.defaultCamera(), mode: 'line', lightAz: 40, lightEl: 50, outline: 2.2 } });
        L.data.objects.push(this.makeObj('plane'), this.makeObj('figure'));
        insertLayer(L);
        D.activeId = L.id;
        bumpLayer(L);
      });
      setTool('object');
      toast('3D: 오브젝트 도구로 드래그하면 카메라가 돕니다. 속성 패널에서 조작 대상을 바꿀 수 있습니다.');
    }).catch(() => toast('3D 엔진을 불러오지 못했습니다.', true));
  },
  makeObj(kind, color) {
    const base = { id: uid(), kind, pos: [0, 0, 0], rot: [0, 0, 0], scale: 1, color: color || '#d9d4cc', pose: {} };
    if (kind === 'plane') return { ...base, color: '#bfbab2' };
    if (kind === 'figure') return { ...base, color: '#e8e2d8', pose: structuredClone(POSES['차렷']) };
    return { ...base, pos: [(Math.random() - .5) * 160, kind === 'torus' ? 40 : 50, (Math.random() - .5) * 120] };
  },
  /* ---------- 씬 구성 ---------- */
  outlineMaterial(th) {
    const m = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.BackSide });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normal * ${th.toFixed(3)};`); };
    return m;
  },
  material(data, color) {
    const c = new THREE.Color(color);
    if (data.mode === 'line') return new THREE.MeshBasicMaterial({ color: 0xffffff });
    if (data.mode === 'toon') {
      if (!this.grad) { const d = new Uint8Array([90, 170, 255]); this.grad = new THREE.DataTexture(d, 3, 1, THREE.LuminanceFormat); this.grad.minFilter = this.grad.magFilter = THREE.NearestFilter; this.grad.needsUpdate = true; }
      return new THREE.MeshToonMaterial({ color: c, gradientMap: this.grad });
    }
    return new THREE.MeshStandardMaterial({ color: c, roughness: .75, metalness: 0 });
  },
  addMesh(parent, geo, data, color, userData, outline) {
    const m = new THREE.Mesh(geo, this.material(data, color));
    m.userData = userData;
    parent.add(m);
    if (outline && data.mode !== 'shade') { const o = new THREE.Mesh(geo, this.outlineMaterial(outline)); o.userData = { outline: true }; m.add(o); }
    return m;
  },
  buildFigure(obj, data) {
    const G = new THREE.Group(), ol = data.outline ?? 2, col = obj.color;
    const J = {};
    const joint = (name, parent, x, y, z, r) => {
      const g = new THREE.Group(); g.position.set(x, y, z); g.name = name; parent.add(g); J[name] = g;
      const p = obj.pose[name]; if (p) g.rotation.set(p[0] * Math.PI / 180, p[1] * Math.PI / 180, p[2] * Math.PI / 180, 'XYZ');
      if (r) this.addMesh(g, new THREE.SphereGeometry(r, 16, 12), data, col, { obj: obj.id, joint: name }, ol);
      return g;
    };
    const limb = (j, len, r0, r1) => { const m = this.addMesh(j, new THREE.CylinderGeometry(r0, r1, len, 14), data, col, { obj: obj.id, joint: j.name }, ol); m.position.y = -len / 2; return m; };
    const box = (j, w, h, d, y, z = 0) => { const m = this.addMesh(j, new THREE.BoxGeometry(w, h, d), data, col, { obj: obj.id, joint: j.name }, ol); m.position.set(0, y, z); return m; };
    const root = joint('pelvis', G, 0, 95, 0);
    box(root, 30, 14, 18, 0);
    const spine = joint('spine', root, 0, 8, 0, 6);
    const chest = joint('chest', spine, 0, 6, 0);
    box(chest, 34, 30, 19, 15);
    const neck = joint('neck', chest, 0, 32, 0, 4.5);
    const nm = this.addMesh(neck, new THREE.CylinderGeometry(4, 4.5, 8, 10), data, col, { obj: obj.id, joint: 'neck' }, ol); nm.position.y = 4;
    const head = joint('head', neck, 0, 8, 0);
    const hm = this.addMesh(head, new THREE.SphereGeometry(11, 20, 16), data, col, { obj: obj.id, joint: 'head' }, ol); hm.position.y = 11; hm.scale.set(.92, 1.12, 1);
    const nose = this.addMesh(head, new THREE.ConeGeometry(2, 5, 8), data, col, { obj: obj.id, joint: 'head' }, ol); nose.position.set(0, 10, 10.5); nose.rotation.x = Math.PI / 2;
    for (const [s, sign] of [['L', 1], ['R', -1]]) {
      const sh = joint('shoulder' + s, chest, 19 * sign, 27, 0, 5.5);
      limb(sh, 27, 4.8, 4);
      const el = joint('elbow' + s, sh, 0, -27, 0, 4.2);
      limb(el, 24, 4, 3.2);
      const wr = joint('wrist' + s, el, 0, -24, 0, 3);
      box(wr, 3.5, 15, 7.5, -8);
      const hip = joint('hip' + s, root, 9.5 * sign, -6, 0, 7);
      limb(hip, 42, 7, 5.5);
      const kn = joint('knee' + s, hip, 0, -42, 0, 5.5);
      limb(kn, 40, 5.2, 4);
      const an = joint('ankle' + s, kn, 0, -40, 0, 3.8);
      box(an, 9, 6, 23, -3.5, 5.5);
    }
    return G;
  },
  build(L) {
    const data = L.data, scene = new THREE.Scene();
    if (data.mode === 'shade') scene.background = null;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, data.mode === 'shade' ? .55 : .5));
    const dl = new THREE.DirectionalLight(0xffffff, data.mode === 'shade' ? .85 : .9);
    const az = (data.lightAz ?? 40) * Math.PI / 180, elv = (data.lightEl ?? 50) * Math.PI / 180;
    dl.position.set(Math.cos(elv) * Math.sin(az) * 500, Math.sin(elv) * 500, Math.cos(elv) * Math.cos(az) * 500);
    scene.add(dl);
    const ol = data.outline ?? 2;
    for (const o of data.objects) {
      let g;
      if (o.kind === 'figure') g = this.buildFigure(o, data);
      else {
        const geo = { cube: () => new THREE.BoxGeometry(100, 100, 100), sphere: () => new THREE.SphereGeometry(55, 32, 24), cylinder: () => new THREE.CylinderGeometry(40, 40, 110, 32), cone: () => new THREE.ConeGeometry(50, 110, 32), torus: () => new THREE.TorusGeometry(45, 16, 18, 40), plane: () => new THREE.BoxGeometry(700, 1, 700) }[o.kind]();
        g = new THREE.Group();
        const m = this.addMesh(g, geo, data, o.color, { obj: o.id }, o.kind === 'plane' ? 0 : ol);
        if (o.kind === 'plane') m.position.y = -.5;
        if (o.kind === 'plane' && data.mode !== 'shade') {
          const grid = new THREE.GridHelper(700, 14, 0x444444, 0x999999); grid.position.y = .2; g.add(grid);
        }
      }
      g.position.set(...o.pos); g.rotation.set(...o.rot.map(v => v * Math.PI / 180)); g.scale.setScalar(o.scale || 1);
      g.userData.obj = o.id;
      scene.add(g);
    }
    const c = data.camera || this.defaultCamera();
    const cam = new THREE.PerspectiveCamera(c.fov, D.w / D.h, 1, 20000);
    cam.position.set(...c.pos); cam.lookAt(new THREE.Vector3(...c.target));
    this.scenes.set(L, { scene, cam });
    return { scene, cam };
  },
  render(L) {
    const x = L.ctx;
    x.clearRect(0, 0, D.w, D.h);
    if (!window.THREE) {
      x.fillStyle = 'rgba(0,0,0,.4)'; x.font = '24px sans-serif'; x.fillText('3D 엔진을 불러오는 중…', 24, 40);
      this.ensure().then(() => bumpLayer(L)).catch(() => {});
      return;
    }
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
    }
    const max = this.renderer.capabilities.maxTextureSize || 4096, s = Math.min(1, max / Math.max(D.w, D.h));
    this.renderer.setSize(Math.round(D.w * s), Math.round(D.h * s), false);
    this.renderer.setClearColor(0x000000, 0);
    const { scene, cam } = this.build(L);
    this.renderer.render(scene, cam);
    x.drawImage(this.renderer.domElement, 0, 0, D.w, D.h);
  },
  /* ---------- 조작 ---------- */
  ray(L, d) {
    const sc = this.scenes.get(L) || this.build(L);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(d.x / D.w * 2 - 1, -(d.y / D.h * 2 - 1)), sc.cam);
    return { rc, hits: rc.intersectObjects(sc.scene.children, true).filter(h => !h.object.userData.outline && h.object.userData.obj), cam: sc.cam };
  },
  commit(L, before, label) {
    const after = structuredClone(L.data);
    H.push({ label, undo: () => { L.data = structuredClone(before); bumpLayer(L); PropUI.render(); }, redo: () => { L.data = structuredClone(after); bumpLayer(L); PropUI.render(); } });
  },
  update(fn, label) {
    const L = active(); if (!L || L.type !== '3d') return;
    const before = structuredClone(L.data);
    fn(L.data);
    bumpLayer(L); this.commit(L, before, label); PropUI.render();
  },
  selObj(L) { return L.data.objects.find(o => o.id === this.selId); },
  cameraFromVP() {
    const L = active(); if (!L || L.type !== '3d' || !window.THREE) return;
    const { cam } = this.build(L);
    cam.updateMatrixWorld();
    const P = cam.projectionMatrix.elements;
    const proj = dir => {
      const v = new THREE.Vector3(...dir).transformDirection(cam.matrixWorldInverse);
      if (v.z > -1e-4) return null; // 카메라 뒤쪽
      const nx = (P[0] * v.x + P[8] * v.z) / -v.z, ny = (P[5] * v.y + P[9] * v.z) / -v.z;
      return { x: (nx + 1) / 2 * D.w, y: (1 - ny) / 2 * D.h };
    };
    const ok = (p, k) => p && Math.abs(p.x - D.w / 2) < D.w * k && Math.abs(p.y - D.h / 2) < D.h * k;
    const vps = [proj([1, 0, 0]), proj([-1, 0, 0]), proj([0, 0, 1]), proj([0, 0, -1])].filter(p => ok(p, 30));
    const pick = vps.slice(0, 2);
    const vy = [proj([0, 1, 0]), proj([0, -1, 0])].find(p => ok(p, 8));
    if (vy) pick.push(vy);
    if (!pick.length) { toast('이 카메라 각도에서는 소실점을 구할 수 없습니다.', true); return; }
    Rulers.add({ kind: 'persp', vps: pick.map(p => ({ x: p.x, y: p.y })) }, '3D 카메라로 퍼스 자');
    toast(`소실점 ${pick.length}개로 퍼스 자를 만들었습니다.`);
  },
};
RENDERERS['3d'] = L => Three3D.render(L);

Three3D.objectHandler = {
  down(e, s) {
    const L = active();
    if (!window.THREE) { Three3D.ensure().then(() => bumpLayer(L)); return false; }
    const d = s2d(s.x, s.y);
    drag.L = L; drag.before = structuredClone(L.data); drag.s0 = s; drag.d0 = d;
    const { hits } = Three3D.ray(L, d);
    const mode = Three3D.mode;
    if (mode !== 'camera' && hits.length) {
      const h = hits[0];
      Three3D.selId = h.object.userData.obj;
      Three3D.part = h.object.userData.joint || null;
      PropUI.render();
    }
    drag.obj = Three3D.selObj(L);
    if (mode === 'joint' && (!drag.obj || drag.obj.kind !== 'figure' || !Three3D.part)) drag.cam = true;
    else if (mode !== 'camera' && !drag.obj) drag.cam = true;
    else if (mode === 'camera') drag.cam = true;
    drag.c0 = structuredClone(L.data.camera || Three3D.defaultCamera());
  },
  move(e) {
    const s = localPos(e), dx = s.x - drag.s0.x, dy = s.y - drag.s0.y, L = drag.L;
    L.data = structuredClone(drag.before);
    if (drag.cam) {
      const c = drag.c0, t = c.target, p = c.pos;
      let ox = p[0] - t[0], oy = p[1] - t[1], oz = p[2] - t[2];
      if (e.shiftKey) {
        // 이동(팬)
        const r = Math.hypot(ox, oy, oz) * .002, ang = Math.atan2(ox, oz);
        const mx = -Math.cos(ang) * dx * r, mz = Math.sin(ang) * dx * r, my = dy * r;
        L.data.camera = { ...c, pos: [p[0] + mx, p[1] + my, p[2] + mz], target: [t[0] + mx, t[1] + my, t[2] + mz] };
      } else if (e.ctrlKey || e.metaKey || e.altKey) {
        const k = Math.exp(dy * .005);
        L.data.camera = { ...c, pos: [t[0] + ox * k, t[1] + oy * k, t[2] + oz * k] };
      } else {
        const r = Math.hypot(ox, oy, oz);
        let az = Math.atan2(ox, oz) - dx * .008, el = Math.asin(clamp(oy / r, -1, 1)) + dy * .008;
        el = clamp(el, -1.45, 1.45);
        L.data.camera = { ...c, pos: [t[0] + r * Math.cos(el) * Math.sin(az), t[1] + r * Math.sin(el), t[2] + r * Math.cos(el) * Math.cos(az)] };
      }
    } else {
      const o = L.data.objects.find(q => q.id === drag.obj.id);
      if (Three3D.mode === 'move') {
        const c = drag.c0, ang = Math.atan2(c.pos[0] - c.target[0], c.pos[2] - c.target[2]), dist = Math.hypot(c.pos[0] - c.target[0], c.pos[1] - c.target[1], c.pos[2] - c.target[2]) * .0022 / Math.max(.1, V.zoom);
        if (e.shiftKey) o.pos[1] = drag.obj.pos[1] - dy * dist;
        else { o.pos[0] = drag.obj.pos[0] + (Math.cos(ang) * dx + Math.sin(ang) * dy) * dist; o.pos[2] = drag.obj.pos[2] + (-Math.sin(ang) * dx + Math.cos(ang) * dy) * dist; }
      } else if (Three3D.mode === 'rotate') {
        o.rot[1] = drag.obj.rot[1] + dx * .5;
        if (e.shiftKey) o.rot[0] = drag.obj.rot[0] + dy * .5; else o.rot[2] = drag.obj.rot[2];
      } else if (Three3D.mode === 'scale') {
        o.scale = clamp((drag.obj.scale || 1) * Math.exp(-dy * .005), .05, 20);
      } else if (Three3D.mode === 'joint') {
        const j = Three3D.part, p = (o.pose[j] || [0, 0, 0]).slice(), p0 = drag.obj.pose[j] || [0, 0, 0];
        if (e.shiftKey) p[1] = p0[1] + dx * .5;
        else { p[0] = p0[0] + dy * .5; p[2] = p0[2] - dx * .5; }
        o.pose = { ...o.pose, [j]: p };
      }
    }
    bumpLayer(L); drag.moved = true;
  },
  up() { if (drag.moved) Three3D.commit(drag.L, drag.before, drag.cam ? '3D 카메라' : '3D 오브젝트'); },
  cancel() { drag.L.data = drag.before; bumpLayer(drag.L); },
};
OVERLAYS.screen.push(ctx => {
  const L = active();
  if (!L || L.type !== '3d' || !Three3D.selId || !window.THREE) return;
  const sc = Three3D.scenes.get(L); if (!sc) return;
  const g = sc.scene.children.find(c => c.userData.obj === Three3D.selId); if (!g) return;
  const box = new THREE.Box3().setFromObject(g);
  if (box.isEmpty()) return;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const p = new THREE.Vector3(x, y, z).project(sc.cam); corners.push(d2s((p.x + 1) / 2 * D.w, (1 - p.y) / 2 * D.h));
  }
  const r = Rect.ofPoints(corners);
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#40aaff'; ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
  if (Three3D.part) { ctx.fillStyle = '#40aaff'; ctx.font = '12px "IBM Plex Sans KR", sans-serif'; ctx.fillText(JOINT_NAMES[Three3D.part] || Three3D.part, r.x, r.y - 6); }
});
const JOINT_NAMES = { pelvis: '골반', spine: '허리', chest: '가슴', neck: '목', head: '머리', shoulderL: '왼어깨', shoulderR: '오른어깨', elbowL: '왼팔꿈치', elbowR: '오른팔꿈치', wristL: '왼손목', wristR: '오른손목', hipL: '왼고관절', hipR: '오른고관절', kneeL: '왼무릎', kneeR: '오른무릎', ankleL: '왼발목', ankleR: '오른발목' };
