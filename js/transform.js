/* 플로팅(레이어 이동 · 확대/축소/회전 · 자유 변형 · 메쉬 변형 · 퍼펫 워프)과 캔버스 크기/해상도 변경 */
'use strict';

function contentBBox(canvas) {
  const t = T.get('read').ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(canvas, 0, 0);
  const d = t.getImageData(0, 0, D.w, D.h).data, w = D.w, h = D.h;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const o = y * w * 4; for (let x = 0; x < w; x++) if (d[o + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function floatMatrix(f) {
  return new DOMMatrix().translate(f.x + f.w / 2 + f.tx, f.y + f.h / 2 + f.ty).rotate(f.rot).scale(f.sx, f.sy).translate(-f.w / 2, -f.h / 2);
}
// 4점 대응 사영변환: 단위 정사각형 → 사각형
function squareToQuad(q) {
  const [p0, p1, p2, p3] = q; // (0,0),(1,0),(1,1),(0,1)
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dy1 = p1.y - p2.y, dy2 = p3.y - p2.y;
  const sx = p0.x - p1.x + p2.x - p3.x, sy = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-9 || Math.abs(sy) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den; h = (dx1 * sy - sx * dy1) / den;
  }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u, v) => { const w = g * u + h * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }; };
}
// 퍼펫 워프: 강체 MLS (복소수 표현)
function mlsRigid(pins, vx, vy) {
  if (!pins.length) return { x: vx, y: vy };
  let sw = 0, px = 0, py = 0, qx = 0, qy = 0;
  const ws = pins.map(p => { const d2 = (p.px - vx) ** 2 + (p.py - vy) ** 2; return 1 / Math.max(1e-3, d2); });
  for (let i = 0; i < pins.length; i++) { const w = ws[i]; sw += w; px += w * pins[i].px; py += w * pins[i].py; qx += w * pins[i].qx; qy += w * pins[i].qy; }
  px /= sw; py /= sw; qx /= sw; qy /= sw;
  if (pins.length === 1) return { x: vx + qx - px, y: vy + qy - py };
  let zr = 0, zi = 0;
  for (let i = 0; i < pins.length; i++) {
    const w = ws[i], ax = pins[i].px - px, ay = pins[i].py - py, bx = pins[i].qx - qx, by = pins[i].qy - qy;
    zr += w * (ax * bx + ay * by); zi += w * (ax * by - ay * bx);
  }
  const m = Math.hypot(zr, zi) || 1, cr = zr / m, sr = zi / m, dx = vx - px, dy = vy - py;
  return { x: cr * dx - sr * dy + qx, y: sr * dx + cr * dy + qy };
}
// 플로팅 로컬 좌표(u,v: 0..w,0..h) → 문서 좌표
function floatMap(f) {
  if (f.mode === 'free') { const H = squareToQuad(f.corners); return (u, v) => H(u / f.w, v / f.h); }
  if (f.mode === 'mesh') {
    const { cols, rows, pts } = f.grid;
    return (u, v) => {
      const gx = clamp(u / f.w * cols, 0, cols), gy = clamp(v / f.h * rows, 0, rows);
      const i = Math.min(cols - 1, Math.floor(gx)), j = Math.min(rows - 1, Math.floor(gy)), tx = gx - i, ty = gy - j;
      const P = (a, b) => pts[b * (cols + 1) + a];
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      return { x: lerp(lerp(p00.x, p10.x, tx), lerp(p01.x, p11.x, tx), ty), y: lerp(lerp(p00.y, p10.y, tx), lerp(p01.y, p11.y, tx), ty) };
    };
  }
  if (f.mode === 'puppet') return (u, v) => mlsRigid(f.pins, f.x + u, f.y + v);
  const M = floatMatrix(f);
  return (u, v) => { const p = M.transformPoint(new DOMPoint(u, v)); return { x: p.x, y: p.y }; };
}
function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  const den = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(den) < 1e-9) return;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / den;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / den;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / den;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / den;
  const e = d0.x - a * s0.x - c * s0.y, f = d0.y - b * s0.x - d * s0.y;
  const cx = (d0.x + d1.x + d2.x) / 3, cy = (d0.y + d1.y + d2.y) / 3;
  const ex = p => { const dx = p.x - cx, dy = p.y - cy, l = Math.hypot(dx, dy) || 1; return { x: p.x + dx / l * .7, y: p.y + dy / l * .7 }; };
  const q0 = ex(d0), q1 = ex(d1), q2 = ex(d2);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q2.x, q2.y); ctx.closePath(); ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  const x0 = Math.max(0, Math.floor(Math.min(s0.x, s1.x, s2.x)) - 2), y0 = Math.max(0, Math.floor(Math.min(s0.y, s1.y, s2.y)) - 2);
  const x1 = Math.min(img.width, Math.ceil(Math.max(s0.x, s1.x, s2.x)) + 2), y1 = Math.min(img.height, Math.ceil(Math.max(s0.y, s1.y, s2.y)) + 2);
  if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
function drawMapped(ctx, img, w, h, map, n) {
  const cols = n, rows = n, src = [], dst = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const u = i / cols * w, v = j / rows * h; src.push({ x: u, y: v }); dst.push(map(u, v)); }
  const at = (a, i, j) => a[j * (cols + 1) + i];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    drawTri(ctx, img, at(src, i, j), at(src, i + 1, j), at(src, i + 1, j + 1), at(dst, i, j), at(dst, i + 1, j), at(dst, i + 1, j + 1));
    drawTri(ctx, img, at(src, i, j), at(src, i + 1, j + 1), at(src, i, j + 1), at(dst, i, j), at(dst, i + 1, j + 1), at(dst, i, j + 1));
  }
}
function drawFloat(ctx, f, which = 'canvas') {
  const img = which === 'mask' ? f.mask : f.canvas;
  if (!img) return;
  ctx.imageSmoothingQuality = 'high';
  if (f.mode === 'affine') { ctx.setTransform(floatMatrix(f)); ctx.drawImage(img, 0, 0); ctx.setTransform(1, 0, 0, 1, 0, 0); return; }
  drawMapped(ctx, img, f.w, f.h, floatMap(f), f.mode === 'mesh' ? f.grid.cols * 4 : 14);
}
function floatBounds(f) {
  const map = floatMap(f), pts = [];
  const n = f.mode === 'affine' ? 1 : 8;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { if (i && j && i < n && j < n) continue; pts.push(map(i / n * f.w, j / n * f.h)); }
  return Rect.grow(Rect.ofPoints(pts), 3);
}
function floatDirty() {
  const f = A.float; if (!f) return;
  const b = floatBounds(f);
  markDirty(Rect.union(f.last || { x: f.x, y: f.y, w: f.w, h: f.h }, b));
  f.last = b;
  requestRender();
}

function beginFloat(kind) {
  const L = active();
  if (L.type === 'vector' && !L.maskEdit) return Vector.beginFloat(kind);
  if ((L.type === 'text' || L.type === '3d') && !L.maskEdit) { toast('텍스트·3D 레이어는 오브젝트 도구로 조작합니다.'); return false; }
  if (!canPaint(L, 'pixel')) return false;
  A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
  const src = editTarget(L);
  const bb = Sel.has ? Sel.bbox : contentBBox(src);
  if (!bb) { toast('이동할 그림이 없습니다.'); return false; }
  const before = cloneCanvas(src), selBefore = selSnapshot();
  const fc = cloneCanvas(src, bb), fx = fc.getContext('2d'), sx = src.getContext('2d');
  let mask = null;
  if (Sel.has) {
    fx.globalCompositeOperation = 'destination-in';
    fx.drawImage(Sel.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
    sx.save(); sx.globalCompositeOperation = 'destination-out'; sx.drawImage(Sel.canvas, 0, 0); sx.restore();
    mask = cloneCanvas(Sel.canvas, bb);
  } else sx.clearRect(bb.x, bb.y, bb.w, bb.h);
  A.layerId = L.id;
  A.float = { canvas: fc, mask, kind, layer: L, before, selBefore, x: bb.x, y: bb.y, w: bb.w, h: bb.h, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, mode: 'affine', last: null, target: A.target };
  if (A.target === 'mask') {
    // 마스크 변형은 마스크 캔버스에 바로 그려 미리 본다
    A.float.maskLive = true;
  }
  floatDirty();
  if (kind === 'transform') showTransformBar();
  return true;
}
function showTransformBar() {
  $('#transformbar').hidden = false;
  $('#tf-mode').value = A.float.mode;
  const vec = A.float.vector;
  $('#tf-mode').disabled = false;
  for (const o of $('#tf-mode').options) o.disabled = false;
  if (vec) $('#tf-mode').title = '벡터 레이어는 선을 직접 변형합니다';
}
function setFloatMode(mode) {
  const f = A.float; if (!f || mode === f.mode) return;
  const map = floatMap(f);
  if (mode === 'affine') { Object.assign(f, { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 }); }
  else if (mode === 'free') f.corners = [map(0, 0), map(f.w, 0), map(f.w, f.h), map(0, f.h)];
  else if (mode === 'mesh') {
    const cols = 4, rows = 4, pts = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push(map(i / cols * f.w, j / rows * f.h));
    f.grid = { cols, rows, pts };
  } else if (mode === 'puppet') {
    // 현재 형태를 원본으로 굳힌 뒤 핀을 꽂는다
    const c = mkCanvas(D.w, D.h), cx = c.getContext('2d');
    drawFloat(cx, f);
    const bb = Rect.ofPoints([map(0, 0), map(f.w, 0), map(f.w, f.h), map(0, f.h)]);
    const r = { x: Math.floor(bb.x), y: Math.floor(bb.y), w: Math.max(1, Math.ceil(bb.w)), h: Math.max(1, Math.ceil(bb.h)) };
    if (f.vector) Vector.bakeFloat(f, map, r);
    if (f.mask) { const mc = mkCanvas(D.w, D.h), mx = mc.getContext('2d'); drawFloat(mx, f, 'mask'); f.mask = cloneCanvas(mc, r); }
    f.canvas = cloneCanvas(c, r);
    Object.assign(f, { x: r.x, y: r.y, w: r.w, h: r.h, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, pins: [] });
    toast('퍼펫 워프: 그림 위를 클릭해 핀을 꽂고, 핀을 드래그해 형태를 바꿉니다. Alt+클릭으로 핀을 지웁니다.');
  }
  f.mode = mode;
  floatDirty();
}
function commitFloat(label) {
  const f = A.float; if (!f) return;
  if (f.vector) { Vector.commitFloat(f, label); return; }
  const L = f.layer, target = f.target === 'mask' ? L.mask : L.canvas, tx = target.getContext('2d');
  tx.save(); drawFloat(tx, f); tx.restore();
  if (f.mask) {
    Sel.ctx.clearRect(0, 0, D.w, D.h);
    Sel.ctx.save(); drawFloat(Sel.ctx, f, 'mask'); Sel.ctx.restore();
    Sel.has = true; selChanged();
  }
  const after = cloneCanvas(target), selAfter = selSnapshot(), which = f.target;
  const put = (c, s) => { const t = which === 'mask' ? L.mask : L.canvas, x = t.getContext('2d'); x.clearRect(0, 0, D.w, D.h); x.drawImage(c, 0, 0); selRestore(s); markDirty(); queueThumb(L); };
  const { before, selBefore } = f;
  A.float = null; A.target = 'canvas';
  $('#transformbar').hidden = true;
  H.push({ label, undo: () => put(before, selBefore), redo: () => put(after, selAfter) });
  markDirty(); queueThumb(L);
}
function cancelFloat() {
  const f = A.float; if (!f) return;
  if (f.vector) { Vector.cancelFloat(f); }
  else {
    const t = f.target === 'mask' ? f.layer.mask : f.layer.canvas, x = t.getContext('2d');
    x.clearRect(0, 0, D.w, D.h); x.drawImage(f.before, 0, 0);
    selRestore(f.selBefore);
  }
  A.float = null; A.target = 'canvas';
  $('#transformbar').hidden = true;
  markDirty();
}
function startTransform(mode) {
  if (A.float || drag) return;
  const L = active();
  if (L.type === 'text' || L.type === '3d') { toast('텍스트·3D 레이어는 오브젝트 도구로 크기와 위치를 바꿉니다.'); return; }
  if (beginFloat('transform')) { if (mode && mode !== 'affine') setFloatMode(mode); $('#tf-mode').value = A.float.mode; }
  requestRender();
}

/* ---------- 변형 핸들 ---------- */
const TF_HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function tfCorners() {
  const f = A.float, M = vm().multiply(floatMatrix(f));
  return [[0, 0], [f.w / 2, 0], [f.w, 0], [f.w, f.h / 2], [f.w, f.h], [f.w / 2, f.h], [0, f.h], [0, f.h / 2]]
    .map(([x, y]) => { const p = M.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; });
}
function pointInPoly(p, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}
function handleBox(ctx, p, round) {
  ctx.beginPath();
  if (round) ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); else ctx.rect(p.x - 4, p.y - 4, 8, 8);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#1b1c1f'; ctx.lineWidth = 1; ctx.stroke();
}
function floatOutlineScreen(f) {
  const map = floatMap(f), pts = [], n = f.mode === 'affine' ? 1 : 10;
  for (let i = 0; i <= n; i++) pts.push(map(i / n * f.w, 0));
  for (let i = 1; i <= n; i++) pts.push(map(f.w, i / n * f.h));
  for (let i = n - 1; i >= 0; i--) pts.push(map(i / n * f.w, f.h));
  for (let i = n - 1; i > 0; i--) pts.push(map(0, i / n * f.h));
  return pts.map(p => d2s(p.x, p.y));
}
OVERLAYS.screen.push(ctx => {
  const f = A.float;
  if (!f || f.kind !== 'transform') return;
  const outline = floatOutlineScreen(f);
  ctx.beginPath(); outline.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.lineWidth = 1; ctx.strokeStyle = '#e3a446'; ctx.stroke();
  if (f.mode === 'affine') tfCorners().forEach(p => handleBox(ctx, p));
  else if (f.mode === 'free') f.corners.forEach(p => handleBox(ctx, d2s(p.x, p.y)));
  else if (f.mode === 'mesh') {
    const { cols, rows, pts } = f.grid, sp = pts.map(p => d2s(p.x, p.y));
    ctx.strokeStyle = 'rgba(227,164,70,.7)';
    for (let j = 0; j <= rows; j++) { ctx.beginPath(); for (let i = 0; i <= cols; i++) { const p = sp[j * (cols + 1) + i]; i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); }
    for (let i = 0; i <= cols; i++) { ctx.beginPath(); for (let j = 0; j <= rows; j++) { const p = sp[j * (cols + 1) + i]; j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } ctx.stroke(); }
    sp.forEach(p => handleBox(ctx, p, true));
  } else if (f.mode === 'puppet') {
    for (const p of f.pins) { const s = d2s(p.qx, p.qy); ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fillStyle = '#e3a446'; ctx.fill(); ctx.strokeStyle = '#1b1c1f'; ctx.stroke(); ctx.beginPath(); ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#1b1c1f'; ctx.fill(); }
  }
});

HANDLERS.transform = {
  down(e, s) {
    const f = A.float, d = s2d(s.x, s.y);
    drag.d0 = d; drag.f0 = structuredClone({ tx: f.tx, ty: f.ty, sx: f.sx, sy: f.sy, rot: f.rot, corners: f.corners, grid: f.grid, pins: f.pins });
    if (f.mode === 'affine') {
      const c = tfCorners(); let hit = -1;
      c.forEach((p, i) => { if (Math.hypot(p.x - s.x, p.y - s.y) < 10) hit = i; });
      const center = { x: f.x + f.w / 2 + f.tx, y: f.y + f.h / 2 + f.ty };
      drag.center = center;
      if (hit >= 0) { drag.mode = 'scale'; drag.h = TF_HANDLES[hit]; }
      else if (pointInPoly(s, [c[0], c[2], c[4], c[6]])) drag.mode = 'move';
      else { drag.mode = 'rotate'; drag.a0 = Math.atan2(d.y - center.y, d.x - center.x); }
      return;
    }
    if (f.mode === 'free') {
      const i = f.corners.findIndex(p => { const q = d2s(p.x, p.y); return Math.hypot(q.x - s.x, q.y - s.y) < 10; });
      drag.mode = i >= 0 ? 'pt' : 'move'; drag.idx = i; return;
    }
    if (f.mode === 'mesh') {
      const i = f.grid.pts.findIndex(p => { const q = d2s(p.x, p.y); return Math.hypot(q.x - s.x, q.y - s.y) < 9; });
      drag.mode = i >= 0 ? 'pt' : 'move'; drag.idx = i; return;
    }
    if (f.mode === 'puppet') {
      const i = f.pins.findIndex(p => { const q = d2s(p.qx, p.qy); return Math.hypot(q.x - s.x, q.y - s.y) < 10; });
      if (i >= 0 && e.altKey) { f.pins.splice(i, 1); floatDirty(); return false; }
      if (i >= 0) { drag.mode = 'pin'; drag.idx = i; return; }
      // 현재 형태의 역사상으로 원본 위치를 근사: 핀이 적을 때는 같은 위치
      const src = inversePuppet(f, d);
      if (src.x < f.x - 2 || src.y < f.y - 2 || src.x > f.x + f.w + 2 || src.y > f.y + f.h + 2) return false;
      f.pins.push({ px: src.x, py: src.y, qx: d.x, qy: d.y });
      drag.mode = 'pin'; drag.idx = f.pins.length - 1;
      floatDirty();
    }
  },
  move(e) {
    const f = A.float, f0 = drag.f0, d = s2d(...Object.values(localPos(e))), dx = d.x - drag.d0.x, dy = d.y - drag.d0.y;
    if (drag.mode === 'move') {
      if (f.mode === 'affine') { f.tx = f0.tx + dx; f.ty = f0.ty + dy; }
      else if (f.mode === 'free') f.corners = f0.corners.map(p => ({ x: p.x + dx, y: p.y + dy }));
      else if (f.mode === 'mesh') f.grid.pts = f0.grid.pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
    } else if (drag.mode === 'pt') {
      if (f.mode === 'free') f.corners[drag.idx] = { x: f0.corners[drag.idx].x + dx, y: f0.corners[drag.idx].y + dy };
      else f.grid.pts[drag.idx] = { x: f0.grid.pts[drag.idx].x + dx, y: f0.grid.pts[drag.idx].y + dy };
    } else if (drag.mode === 'pin') {
      const p = f.pins[drag.idx]; p.qx = d.x; p.qy = d.y;
    } else if (drag.mode === 'rotate') {
      let r = f0.rot + (Math.atan2(d.y - drag.center.y, d.x - drag.center.x) - drag.a0) * 180 / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      f.rot = r;
    } else if (drag.mode === 'scale') {
      const a = -f0.rot * Math.PI / 180, vx0 = d.x - drag.center.x, vy0 = d.y - drag.center.y;
      const lx = vx0 * Math.cos(a) - vy0 * Math.sin(a), ly = vx0 * Math.sin(a) + vy0 * Math.cos(a);
      const [hx, hy] = drag.h;
      let sx = hx ? lx / (hx * f.w / 2) : f0.sx, sy = hy ? ly / (hy * f.h / 2) : f0.sy;
      const keep = $('#tf-ratio').checked !== e.shiftKey;
      if (keep && hx && hy) { const m = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx || 1) * m; sy = Math.sign(sy || 1) * m; }
      if (Math.abs(sx) < .01) sx = .01 * Math.sign(sx || 1);
      if (Math.abs(sy) < .01) sy = .01 * Math.sign(sy || 1);
      f.sx = sx; f.sy = sy;
    }
    floatDirty();
  },
};
function inversePuppet(f, d) {
  // 고정점 반복으로 역변환을 근사한다
  let p = { x: d.x, y: d.y };
  for (let i = 0; i < 12; i++) { const q = mlsRigid(f.pins, p.x, p.y); p = { x: p.x + (d.x - q.x), y: p.y + (d.y - q.y) }; }
  return p;
}

HANDLERS.move = {
  down(e, s) {
    const L = active();
    if (L.type === 'text') { drag.text = true; drag.start = s2d(s.x, s.y); drag.objs0 = structuredClone(L.data.objs); return; }
    if (L.type === '3d') { toast('3D 레이어는 오브젝트 도구로 조작합니다.'); return false; }
    if (L.type === 'folder' || L.type === 'adjust' || L.type === 'fill' || L.type === 'paper') { toast(`${LAYER_TYPE_NAMES[L.type]} 레이어는 이동할 수 없습니다.`); return false; }
    if (!beginFloat('move')) return false;
    drag.start = s2d(s.x, s.y);
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e)));
    if (drag.text) { Text.offsetAll(active(), drag.objs0, d.x - drag.start.x, d.y - drag.start.y); return; }
    A.float.tx = Math.round(d.x - drag.start.x); A.float.ty = Math.round(d.y - drag.start.y);
    floatDirty();
  },
  up() {
    if (drag.text) { Text.commitOffset(active(), drag.objs0); return; }
    if (A.float.tx || A.float.ty) commitFloat('레이어 이동'); else cancelFloat();
  },
  cancel() { if (drag.text) { const L = active(); L.data.objs = drag.objs0; bumpLayer(L); return; } cancelFloat(); },
};

/* ---------- 캔버스 크기 · 해상도 · 회전 ---------- */
// 모든 페이지의 모든 레이어와 오브젝트에 같은 좌표 변환을 적용한다
function transformDocument(newW, newH, M, scaleLen, label) {
  if (A.float) cancelFloat();
  const cur = P.index;
  const mapPt = (x, y) => { const p = M.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; };
  for (let pi = 0; pi < P.pages.length; pi++) {
    Pages.load(pi, true);
    const oldW = D.w, oldH = D.h;
    for (const L of D.layers) {
      for (const k of ['canvas', 'mask']) {
        const c = L[k]; if (!c) continue;
        const n = mkCanvas(newW, newH), x = n.getContext('2d');
        x.imageSmoothingQuality = 'high'; x.setTransform(M); x.drawImage(c, 0, 0);
        L[k] = n; if (k === 'canvas') L.ctx = x;
      }
      if (L.type === 'vector') L.data.strokes = L.data.strokes.map(s => ({ ...s, pts: s.pts.map(p => { const q = mapPt(p[0], p[1]); return [q.x, q.y, p[2]]; }), size: s.size * scaleLen }));
      if (L.type === 'text') L.data.objs = L.data.objs.map(o => Text.transformObj(o, mapPt, scaleLen));
      if (L.type === 'gradient') { L.data.a = mapPt(L.data.a.x, L.data.a.y); L.data.b = mapPt(L.data.b.x, L.data.b.y); }
      if (L.type === 'folder' && L.data.frame) L.data.frame.polys = L.data.frame.polys.map(poly => poly.map(p => mapPt(p.x, p.y)));
      L.rev = revSeq++;
    }
    D.rulers = D.rulers.map(r => Rulers.transformRuler(r, mapPt, scaleLen));
    if (D.manga) D.manga = Manga.scaleGuides(D.manga, scaleLen, mapPt);
    D.w = newW; D.h = newH; D.dpi = Math.round(D.dpi * (label === '해상도 변경' ? scaleLen : 1));
    void oldW; void oldH;
    Pages.store(pi);
  }
  allocDocCanvases();
  Pages.load(cur, true);
  for (const L of D.layers) refreshLayer(L);
  for (const pg of P.pages) pg.hist = { stack: [], idx: 0 };
  H.clear();
  fitView(); markDirty(); renderLayers();
  toast(label + ' 완료. 실행 취소 내역은 초기화되었습니다.');
}
function resizeCanvasDoc(w, h, ax, ay) {
  const dx = (w - D.w) * ax, dy = (h - D.h) * ay;
  transformDocument(w, h, new DOMMatrix().translate(dx, dy), 1, '캔버스 크기 변경');
}
function resampleDoc(scale) {
  transformDocument(Math.max(1, Math.round(D.w * scale)), Math.max(1, Math.round(D.h * scale)), new DOMMatrix().scale(scale), scale, '해상도 변경');
}
function rotateCanvasDoc(kind) {
  const w = D.w, h = D.h;
  if (kind === 'cw') transformDocument(h, w, new DOMMatrix([0, 1, -1, 0, h, 0]), 1, '캔버스 회전');
  else if (kind === 'ccw') transformDocument(h, w, new DOMMatrix([0, -1, 1, 0, 0, w]), 1, '캔버스 회전');
  else if (kind === '180') transformDocument(w, h, new DOMMatrix([-1, 0, 0, -1, w, h]), 1, '캔버스 회전');
  else if (kind === 'fh') transformDocument(w, h, new DOMMatrix([-1, 0, 0, 1, w, 0]), 1, '캔버스 좌우 반전');
  else if (kind === 'fv') transformDocument(w, h, new DOMMatrix([1, 0, 0, -1, 0, h]), 1, '캔버스 상하 반전');
}
function allocDocCanvases() {
  T.reset();
  comp.canvas = mkCanvas(D.w, D.h); comp.ctx = comp.canvas.getContext('2d');
  Sel.canvas = mkCanvas(D.w, D.h); Sel.ctx = Sel.canvas.getContext('2d', { willReadFrequently: true });
  Sel.has = false; Sel.path = null; Sel.bbox = null;
}
