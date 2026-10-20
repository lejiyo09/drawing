/* 시작: 예시 작품과 초기화 */
'use strict';

function findSub(id) { for (const t of TOOL_LIST) for (const s of t.subs) if (s.id === id) return s; return null; }
function sampleStroke(L, preset, color, pts, opts = {}) {
  const b = { ...preset, ...opts };
  const st = new Stroke(T.get('buffer').ctx, b, { noStab: true });
  if (b.taperOut) { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); st.total = t; }
  for (const p of pts) st.addPt(p);
  D.activeId = L.id; A.layerId = L.id; A.target = 'canvas';
  A.overlay = { canvas: T.get('buffer').canvas, color, mode: 'source-over', alpha: b.opacity, texture: b.texture, useSel: false };
  commitOverlay(null, st.bbox, false);
}
function sampleVector(L, preset, color, pts, opts = {}) {
  const b = { ...preset, ...opts };
  L.data.strokes = L.data.strokes.concat([{ id: uid(), pts: pts.map(p => [p.x, p.y, p.p, 1]), b: Vector.brushOf(b), color, opacity: 1 }]);
}
function buildSample() {
  newDocument({ w: 1600, h: 1200, dpi: 350, paper: '#ffffff', name: '사과 스케치 (예시)' });
  D.layers = [D.layers[0]];
  D.nameSeq = 1;
  const add = o => { const L = newLayer(o); D.layers.push(L); return L; };
  const ground = add({ name: '바닥 그림자', blend: 'multiply', opacity: .7 });
  const base = add({ name: '밑색' });
  const shade = add({ name: '그림자', clip: true, blend: 'multiply', opacity: .6 });
  const light = add({ name: '하이라이트', clip: true, blend: 'screen', opacity: .8 });
  const line = add({ type: 'vector', name: '선화 (벡터)' });
  const sketch = add({ name: '밑그림', draft: true, opacity: .4 });
  const cx = 800, cy = 650, R = 300;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const apple = (th, k = 1) => {
    let r = R * (1 - .17 * Math.exp(-(angDiff(th, -Math.PI / 2) ** 2) / .05)) * (1 - .05 * Math.exp(-(angDiff(th, Math.PI / 2) ** 2) / .04));
    r *= k;
    return { x: cx + Math.cos(th) * r * 1.06, y: cy + Math.sin(th) * r * .96 };
  };
  const pencil = findSub('pencil');
  for (let n = 0; n < 2; n++) {
    const pts = [];
    for (let i = 0; i <= 90; i++) { const th = -Math.PI / 2 + i / 90 * Math.PI * 2.1 + n * .3; const p = apple(th, 1.02 + n * .03); pts.push({ ...p, x: p.x + n * 8, p: .6 + .3 * Math.sin(i / 9) }); }
    sampleStroke(sketch, pencil, '#3a6fd8', pts, { size: 6 });
  }
  sampleStroke(sketch, pencil, '#3a6fd8', [{ x: cx, y: cy - R * 1.1, p: .5 }, { x: cx, y: cy + R * 1.05, p: .5 }], { size: 4 });
  sampleStroke(sketch, pencil, '#3a6fd8', [{ x: cx - R * 1.1, y: cy, p: .5 }, { x: cx + R * 1.1, y: cy, p: .5 }], { size: 4 });
  const gpen = findSub('gpen');
  const outline = [];
  for (let i = 0; i <= 120; i++) { const th = -Math.PI / 2 + .08 + i / 120 * (Math.PI * 2 + .06); outline.push({ ...apple(th), p: .55 + .4 * Math.sin(i / 120 * Math.PI) }); }
  sampleVector(line, gpen, '#2a2326', outline, { size: 9, taperIn: 0, taperOut: 0 });
  const stemBase = apple(-Math.PI / 2);
  const stem = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; stem.push({ x: stemBase.x + 4 + t * 34 + Math.sin(t * 3) * 6, y: stemBase.y + 18 - t * 120, p: 1 - t * .5 }); }
  sampleVector(line, gpen, '#2a2326', stem, { size: 11, taperIn: 0, taperOut: 30 });
  const la = { x: stemBase.x + 18, y: stemBase.y - 30 }, lb = { x: stemBase.x + 200, y: stemBase.y - 120 };
  const leaf = side => {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20, mx = la.x + (lb.x - la.x) * t, my = la.y + (lb.y - la.y) * t;
      const nx = -(lb.y - la.y), ny = lb.x - la.x, nl = Math.hypot(nx, ny), off = Math.sin(t * Math.PI) * 52 * side;
      pts.push({ x: mx + nx / nl * off, y: my + ny / nl * off, p: .4 + .5 * Math.sin(t * Math.PI) });
    }
    return pts;
  };
  sampleVector(line, gpen, '#2a2326', leaf(1), { size: 7, taperIn: 0, taperOut: 0 });
  sampleVector(line, gpen, '#2a2326', leaf(-1), { size: 7, taperIn: 0, taperOut: 0 });
  sampleVector(line, gpen, '#2a2326', [la, { x: (la.x * .2 + lb.x * .8), y: (la.y * .2 + lb.y * .8) }].map(p => ({ ...p, p: .4 })), { size: 4, taperIn: 20, taperOut: 40 });
  bumpLayer(line);
  D.activeId = base.id;
  const fillOpts = { ref: 'all', tolerance: 10, expand: 3, gap: 0, opacity: 1 };
  const prevCur = C.cur, prevMain = C.main;
  C.cur = 'main';
  C.main = [216, 70, 58]; fillAt(cx - 60, cy + 40, fillOpts, '채우기', true);
  C.main = [106, 168, 79]; fillAt((la.x + lb.x) / 2 + 10, (la.y + lb.y) / 2 - 8, fillOpts, '채우기', true);
  C.main = prevMain; C.cur = prevCur;
  const air = findSub('air-soft');
  for (let n = 0; n < 3; n++) {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const th = -.9 + i / 30 * 2.6; pts.push({ ...apple(th, .86 - n * .05), p: 1 }); }
    sampleStroke(shade, air, '#7d5fb0', pts, { size: 190, flow: .09 });
  }
  sampleStroke(light, air, '#fff1d6', [{ x: cx - 150, y: cy - 130, p: 1 }, { x: cx - 120, y: cy - 165, p: 1 }], { size: 110, flow: .25 });
  for (let n = 0; n < 2; n++) sampleStroke(ground, air, '#77707f', [{ x: cx - 230, y: cy + R * .95, p: 1 }, { x: cx + 260, y: cy + R * .95, p: 1 }], { size: 120 - n * 30, flow: .08 });
  D.activeId = line.id;
  D.nameSeq = 1;
  H.clear();
  Pages.store();
  markDirty(); renderLayers();
  for (const L of D.layers) queueThumb(L);
}
async function init() {
  buildBuiltinTips();
  buildMenus();
  bindUI();
  resizeView();
  ColorUI.init();
  NavUI.init();
  ToolUI.render();
  Anim.init();
  PWA.init();
  updateCursor();
  try { await Materials.init(); } catch { /* 소재 없음 */ }
  let restored = false;
  try { restored = await Autosave.restore(); } catch { restored = false; }
  if (restored) toast('지난 작업을 불러왔습니다.');
  else buildSample();
  fitView();
  Pages.render();
  Anim.renderTimeline();
  dirtySinceSave = false;
  updateStatus();
  updateCmdStates();
  ToolUI.render();
}
// 테스트·디버그용
window.WebPaint = { D, P, H, V, Sel, A, runCmd, setTool, exportComposite, buildPSD, newDocument, fitView, s2d, d2s, active, CMDS, Pages, Anim, Vector, Text, Manga, Rulers, Three3D, Materials, serializeProject, loadProject };
init();
