/* 선택 범위 · 영역 탐색(채우기, 자동 선택) · 그라데이션 · 스포이트 · 퀵 마스크 */
'use strict';

function selSnapshot() { return { c: Sel.has ? cloneCanvas(Sel.canvas) : null }; }
function selRestore(s) {
  Sel.ctx.clearRect(0, 0, D.w, D.h);
  if (s.c) Sel.ctx.drawImage(s.c, 0, 0);
  Sel.has = !!s.c;
  selChanged();
}
function selChanged() {
  if (!Sel.has) { Sel.path = null; Sel.bbox = null; requestRender(); if (typeof updateCmdStates === 'function') updateCmdStates(); return; }
  const w = D.w, h = D.h, d = Sel.ctx.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] >= 128) { m[y * w + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { Sel.has = false; Sel.path = null; Sel.bbox = null; Sel.ctx.clearRect(0, 0, w, h); requestRender(); if (typeof updateCmdStates === 'function') updateCmdStates(); return; }
  const p = new Path2D(), at = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? m[y * w + x] : 0);
  for (let y = y0; y <= y1 + 1; y++) {
    let run = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const e = x <= x1 && at(x, y - 1) !== at(x, y);
      if (e && run < 0) run = x;
      if (!e && run >= 0) { p.moveTo(run, y); p.lineTo(x, y); run = -1; }
    }
  }
  for (let x = x0; x <= x1 + 1; x++) {
    let run = -1;
    for (let y = y0; y <= y1 + 1; y++) {
      const e = y <= y1 && at(x - 1, y) !== at(x, y);
      if (e && run < 0) run = y;
      if (!e && run >= 0) { p.moveTo(x, run); p.lineTo(x, y); run = -1; }
    }
  }
  Sel.path = p;
  Sel.bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  requestRender(); if (typeof updateCmdStates === 'function') updateCmdStates();
}
function selApply(label, op, draw) {
  const b = selSnapshot(), ctx = Sel.ctx;
  if (op === 'new') ctx.clearRect(0, 0, D.w, D.h);
  ctx.save();
  ctx.globalCompositeOperation = op === 'sub' ? 'destination-out' : op === 'int' ? 'destination-in' : 'source-over';
  ctx.fillStyle = '#000';
  draw(ctx);
  ctx.restore();
  Sel.has = true;
  selChanged();
  const a = selSnapshot();
  H.push({ label, undo: () => selRestore(b), redo: () => selRestore(a) });
}
function selectAll() { selApply('전체 선택', 'new', c => c.fillRect(0, 0, D.w, D.h)); }
function deselect() {
  if (!Sel.has) return;
  const b = selSnapshot();
  Sel.ctx.clearRect(0, 0, D.w, D.h); Sel.has = false; selChanged();
  H.push({ label: '선택 해제', undo: () => selRestore(b), redo: () => selRestore({ c: null }) });
}
function invertSel() {
  if (!Sel.has) { toast('선택 범위가 없습니다.'); return; }
  selApply('선택 범위 반전', 'keep', c => { c.globalCompositeOperation = 'xor'; c.fillRect(0, 0, D.w, D.h); });
}
function maskFromSel() {
  const d = Sel.ctx.getImageData(0, 0, D.w, D.h).data, m = new Uint8Array(D.w * D.h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
  return m;
}
function maskToCanvas(m, w, h) {
  const c = mkCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
  for (let i = 0; i < m.length; i++) if (m[i]) id.data[i * 4 + 3] = 255;
  x.putImageData(id, 0, 0);
  return c;
}
function growSel(px) {
  if (!Sel.has) { toast('선택 범위가 없습니다.'); return; }
  let m = maskFromSel();
  m = px >= 0 ? dilate(m, D.w, D.h, px) : erode(m, D.w, D.h, -px);
  const c = maskToCanvas(m, D.w, D.h);
  selApply(px >= 0 ? '선택 범위 확장' : '선택 범위 축소', 'new', x => x.drawImage(c, 0, 0));
}
function featherSel(px) {
  if (!Sel.has) { toast('선택 범위가 없습니다.'); return; }
  const c = cloneCanvas(Sel.canvas);
  selApply('경계 흐리기', 'new', x => blurDraw(x, c, px * 2, Rect.full()));
}
function selFromLayer(L) {
  if (!L.canvas) { toast('이 레이어에서는 선택 범위를 만들 수 없습니다.', true); return; }
  const c = cloneCanvas(L.canvas);
  selApply('레이어에서 선택 범위', 'new', x => x.drawImage(c, 0, 0));
}
// 선택 범위 저장 (선택 범위 레이어에 해당)
function saveSelection(name) {
  if (!Sel.has) { toast('저장할 선택 범위가 없습니다.'); return; }
  structural('선택 범위 저장', [], () => { D.selSaved = D.selSaved.concat([{ id: uid(), name, canvas: cloneCanvas(Sel.canvas) }]); });
  toast(`선택 범위 "${name}"을(를) 저장했습니다.`);
}
function loadSelection(id, op = 'new') {
  const s = D.selSaved.find(x => x.id === id); if (!s) return;
  selApply('선택 범위 불러오기', op, x => x.drawImage(s.canvas, 0, 0));
}

/* ---------- 퀵 마스크 ---------- */
function toggleQuickMask() {
  const q = D.layers.find(L => L.quickmask);
  if (q) {
    const c = cloneCanvas(q.canvas);
    structural('퀵 마스크 해제', [], () => { D.layers = D.layers.filter(L => L !== q); if (D.activeId === q.id) D.activeId = (D.layers[D.layers.length - 1]).id; });
    selApply('퀵 마스크에서 선택 범위', 'new', x => x.drawImage(c, 0, 0));
    toast('퀵 마스크를 선택 범위로 바꿨습니다.');
    return;
  }
  structural('퀵 마스크', [], () => {
    const L = newLayer({ name: '퀵 마스크', quickmask: true, opacity: .5, fx: { color: '#e0405a', border: null, tone: null } });
    if (Sel.has) L.ctx.drawImage(Sel.canvas, 0, 0);
    D.layers.push(L); D.activeId = L.id;
  });
  if (Sel.has) { Sel.ctx.clearRect(0, 0, D.w, D.h); Sel.has = false; selChanged(); }
  toast('퀵 마스크: 칠한 곳이 선택 범위가 됩니다. 다시 Ctrl+M을 누르면 선택 범위로 바뀝니다.');
}

/* ---------- 영역 탐색 ---------- */
function dilate(src, w, h, r) {
  if (r <= 0) return src;
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w; let cnt = 0;
    for (let x = 0; x < Math.min(r, w); x++) cnt += src[o + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) cnt += src[o + x + r];
      if (x - r - 1 >= 0) cnt -= src[o + x - r - 1];
      tmp[o + x] = cnt > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let cnt = 0;
    for (let y = 0; y < Math.min(r, h); y++) cnt += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      if (y + r < h) cnt += tmp[(y + r) * w + x];
      if (y - r - 1 >= 0) cnt -= tmp[(y - r - 1) * w + x];
      out[y * w + x] = cnt > 0 ? 1 : 0;
    }
  }
  return out;
}
function erode(src, w, h, r) {
  const inv = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i++) inv[i] = src[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < d.length; i++) d[i] = d[i] ? 0 : 1;
  return d;
}
function refImage(ref) {
  const t = T.get('read').ctx;
  if (ref === 'layer') {
    t.clearRect(0, 0, D.w, D.h);
    const L = active();
    if (L.canvas) t.drawImage(L.canvas, 0, 0);
  } else compositeInto(t, Rect.full(), { raw: true, excludeDraft: true, onlyRef: ref === 'ref' });
  return t.getImageData(0, 0, D.w, D.h).data;
}
function matchMap(d, sx, sy, tolerance) {
  const w = D.w, n = w * D.h, i0 = (sy * w + sx) * 4, a0 = d[i0 + 3];
  const r0 = d[i0] * a0, g0 = d[i0 + 1] * a0, b0 = d[i0 + 2] * a0, tol = (tolerance / 100) * 255 * 255;
  const match = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = d[j + 3];
    match[i] = Math.max(Math.abs(d[j] * a - r0), Math.abs(d[j + 1] * a - g0), Math.abs(d[j + 2] * a - b0), Math.abs(a - a0) * 255) <= tol ? 1 : 0;
  }
  return match;
}
function scanFill(pass, region, sx, sy) {
  const w = D.w, h = D.h, stack = [sx, sy];
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    let i = y * w + x;
    if (region[i] || !pass[i]) continue;
    while (x > 0 && pass[i - 1] && !region[i - 1]) { x--; i--; }
    let up = false, dn = false;
    for (; x < w && pass[i] && !region[i]; x++, i++) {
      region[i] = 1;
      if (y > 0) { const u = i - w; if (pass[u] && !region[u]) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
      if (y < h - 1) { const v = i + w; if (pass[v] && !region[v]) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
    }
  }
  return region;
}
function floodRegion(sx, sy, o, dataIn) {
  const w = D.w, h = D.h, n = w * h;
  sx = sx | 0; sy = sy | 0;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const d = dataIn || refImage(o.ref);
  const match = matchMap(d, sx, sy, o.tolerance);
  let pass = match;
  if (o.gap > 0) {
    const wall = new Uint8Array(n); for (let i = 0; i < n; i++) wall[i] = match[i] ? 0 : 1;
    const wd = dilate(wall, w, h, o.gap);
    pass = new Uint8Array(n); for (let i = 0; i < n; i++) pass[i] = match[i] && !wd[i] ? 1 : 0;
    if (!pass[sy * w + sx]) pass = match;
  }
  if (!pass[sy * w + sx]) return null;
  const region = scanFill(pass, new Uint8Array(n), sx, sy);
  let out = region;
  if (o.gap > 0 && pass !== match) { const g = dilate(region, w, h, o.gap); out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = g[i] && match[i] ? 1 : 0; }
  if (o.expand > 0) out = dilate(out, w, h, o.expand);
  else if (o.expand < 0) out = erode(out, w, h, -o.expand);
  return out;
}
function regionBBox(m) {
  const w = D.w, h = D.h;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) if (m[o + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function paintRegion(m, o, label, quiet) {
  const bb = regionBBox(m);
  if (!bb) return;
  const buf = T.get('buffer'), id = buf.ctx.createImageData(bb.w, bb.h);
  for (let yy = 0; yy < bb.h; yy++) for (let xx = 0; xx < bb.w; xx++) if (m[(bb.y + yy) * D.w + bb.x + xx]) id.data[(yy * bb.w + xx) * 4 + 3] = 255;
  buf.ctx.putImageData(id, bb.x, bb.y);
  const L = active(), erase = C.cur === 'trans';
  A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
  A.overlay = { canvas: buf.canvas, color: erase ? null : drawHex(), mode: erase ? 'destination-out' : (L.alphaLock && A.target === 'canvas' ? 'source-atop' : 'source-over'), alpha: o.opacity ?? 1, useSel: true };
  commitOverlay(label, bb);
  if (!quiet) pushColorHistory();
}
function fillAt(x, y, o, label = '채우기', quiet = false) {
  if (!canPaint(active(), 'pixel')) return;
  const m = floodRegion(x, y, o);
  if (m) paintRegion(m, o, label, quiet);
}
// 에워싸고 칠하기: 올가미 안의 닫힌 영역(선이 아닌 곳)을 모두 칠한다
function lassoFill(pts, o) {
  if (!canPaint(active(), 'pixel')) return;
  const poly = maskToCanvas(new Uint8Array(0), D.w, D.h), px = poly.getContext('2d');
  px.beginPath(); pts.forEach((p, i) => (i ? px.lineTo(p.x, p.y) : px.moveTo(p.x, p.y))); px.closePath(); px.fill();
  const pd = px.getImageData(0, 0, D.w, D.h).data, d = refImage(o.ref), n = D.w * D.h;
  // 올가미 안에서 선(불투명하고 어두운 픽셀)이 아닌 곳
  const m = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (pd[i * 4 + 3] < 128) continue;
    const a = d[i * 4 + 3], lum = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    const isLine = a > 128 && lum < 255 * (1 - o.tolerance / 100) * .7;
    m[i] = isLine ? 0 : 1;
  }
  paintRegion(o.expand > 0 ? andMask(dilate(m, D.w, D.h, o.expand), pd) : m, o, '에워싸고 칠하기');
}
function andMask(m, pd) { for (let i = 0; i < m.length; i++) if (pd[i * 4 + 3] < 128) m[i] = 0; return m; }
// 안 칠한 부분 칠하기: 획이 지나간 작은 빈 영역들을 채운다
function fillUnpainted(pts, o) {
  if (!canPaint(active(), 'pixel')) return;
  const d = refImage('all'), n = D.w * D.h, all = new Uint8Array(n), maxArea = n * .02;
  const seen = new Uint8Array(n);
  for (const p of pts) {
    const x = p.x | 0, y = p.y | 0;
    if (x < 0 || y < 0 || x >= D.w || y >= D.h || seen[y * D.w + x]) continue;
    const r = floodRegion(x, y, { ...o, gap: 0, expand: 0 }, d);
    if (!r) continue;
    let cnt = 0; for (let i = 0; i < n; i++) if (r[i]) { cnt++; seen[i] = 1; }
    if (cnt <= maxArea) for (let i = 0; i < n; i++) if (r[i]) all[i] = 1;
  }
  paintRegion(o.expand > 0 ? dilate(all, D.w, D.h, o.expand) : all, o, '안 칠한 부분 칠하기');
}

/* ---------- 포인터 도구 ---------- */
function antsPreview(pathFn) {
  return (ctx, px) => {
    ctx.beginPath(); pathFn(ctx);
    ctx.lineWidth = px; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([]);
  };
}
HANDLERS.fill = {
  down(e, s) {
    const o = curSub(), d = s2d(s.x, s.y);
    if (o.fmode === 'lasso' || o.fmode === 'paint') {
      if (!canPaint(active(), 'pixel')) return false;
      drag.pts = [d];
      drag.preview = o.fmode === 'lasso'
        ? antsPreview(c => { drag.pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); })
        : (ctx, px) => { ctx.beginPath(); drag.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.lineWidth = Math.max(px * 2, 6); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(227,164,70,.6)'; ctx.stroke(); };
      return;
    }
    if (active().type === 'vector' && !active().maskEdit) { toast('벡터 레이어에는 채우기를 할 수 없습니다.', true); return false; }
    fillAt(d.x, d.y, o);
    return false;
  },
  move(e) { drag.pts.push(s2d(...Object.values(localPos(e)))); requestRender(); },
  up() {
    const o = curSub();
    if (o.fmode === 'lasso') { if (drag.pts.length > 2) lassoFill(drag.pts, o); }
    else {
      const pts = [], p = drag.pts;
      for (let i = 0; i < p.length; i++) { pts.push(p[i]); if (i) { const a = p[i - 1], b = p[i], L = Math.hypot(b.x - a.x, b.y - a.y); for (let t = 4; t < L; t += 4) pts.push({ x: lerp(a.x, b.x, t / L), y: lerp(a.y, b.y, t / L) }); } }
      fillUnpainted(pts, o);
    }
  },
};
HANDLERS.wand = {
  down(e, s) {
    const d = s2d(s.x, s.y), o = curSub(), m = floodRegion(d.x, d.y, o);
    if (!m) return false;
    const c = maskToCanvas(m, D.w, D.h);
    selApply('자동 선택', e.shiftKey ? 'add' : e.altKey ? 'sub' : o.mode, x => x.drawImage(c, 0, 0));
    return false;
  },
};
HANDLERS.eyedropper = {
  down(e, s) { this.pick(s); },
  move(e) { this.pick(localPos(e)); },
  up() { pushColorHistory(); },
  pick(s) {
    const d = s2d(s.x, s.y), x = Math.floor(d.x), y = Math.floor(d.y);
    if (x < 0 || y < 0 || x >= D.w || y >= D.h) return;
    const L = active();
    const src = (S.temp ? 'display' : curSub().source) === 'layer' && L.canvas ? L.canvas : comp.canvas;
    const t = T.get('read').ctx; t.clearRect(0, 0, 1, 1); t.drawImage(src, x, y, 1, 1, 0, 0, 1, 1);
    const p = t.getImageData(0, 0, 1, 1).data;
    if (p[3] === 0) return;
    setCurColor([p[0], p[1], p[2]]);
  },
};
HANDLERS.gradient = {
  down(e, s) {
    const o = curSub();
    if (!o.asLayer && !canPaint(active(), 'pixel')) return false;
    drag.a = s2d(s.x, s.y); drag.b = drag.a;
    drag.preview = (ctx, px) => {
      ctx.beginPath(); ctx.moveTo(drag.a.x, drag.a.y); ctx.lineTo(drag.b.x, drag.b.y);
      ctx.lineWidth = 1.5 * px; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([]);
    };
  },
  move(e) { drag.b = s2d(...Object.values(localPos(e))); this.render(e.shiftKey); },
  colors() {
    const o = curSub(), from = C.cur === 'sub' ? C.sub : C.main, to = C.cur === 'sub' ? C.main : C.sub;
    return { from: hex(from), to: hex(to), toTrans: o.to === 'trans' };
  },
  render(snap) {
    const o = curSub(), a = drag.a; let b = drag.b;
    if (snap) {
      const ang = Math.atan2(b.y - a.y, b.x - a.x), st = Math.PI / 4, len = Math.hypot(b.x - a.x, b.y - a.y), q = Math.round(ang / st) * st;
      b = { x: a.x + Math.cos(q) * len, y: a.y + Math.sin(q) * len }; drag.b = b;
    }
    if (o.asLayer) { requestRender(); return; }
    const buf = T.get('buffer'), ctx = buf.ctx, L = active();
    ctx.clearRect(0, 0, D.w, D.h);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1) { A.overlay = null; markDirty(); return; }
    const c = this.colors();
    const g = o.shape === 'radial' ? ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, len) : ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    g.addColorStop(0, c.from);
    g.addColorStop(1, c.toTrans ? `rgba(${parseHex(c.from).join(',')},0)` : c.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, D.w, D.h);
    A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
    A.overlay = { canvas: buf.canvas, color: null, mode: L.alphaLock && A.target === 'canvas' ? 'source-atop' : 'source-over', alpha: o.opacity, useSel: true };
    markDirty();
  },
  up() {
    const o = curSub();
    if (o.asLayer) {
      if (Math.hypot(drag.b.x - drag.a.x, drag.b.y - drag.a.y) < 2) return;
      const c = this.colors();
      addLayerOfType('gradient', { data: { a: drag.a, b: drag.b, shape: o.shape, ...c }, opacity: o.opacity }, '그라데이션 레이어');
      return;
    }
    if (A.overlay) { commitOverlay('그라데이션', Rect.full()); pushColorHistory(); }
  },
  cancel() { T.get('buffer').ctx.clearRect(0, 0, D.w, D.h); A.overlay = null; markDirty(); },
};
HANDLERS.select = {
  down(e, s) {
    const o = curSub();
    drag.op = e.shiftKey ? 'add' : e.altKey ? 'sub' : o.mode;
    drag.shape = o.shape;
    const d = s2d(s.x, s.y);
    drag.pts = [typeof Rulers !== 'undefined' ? Rulers.gridSnap(d) : d];
    if (drag.shape === 'pen') {
      drag.buf = T.get('buffer'); drag.buf.ctx.clearRect(0, 0, D.w, D.h);
      drag.preview = (ctx, px) => { ctx.globalAlpha = .45; ctx.drawImage(drag.buf.canvas, 0, 0); };
      this.penDab(d, d);
      return;
    }
    drag.preview = antsPreview(c => {
      const p = drag.pts;
      if (drag.shape === 'lasso') { p.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); }
      else if (drag.shape === 'poly') { p.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); if (drag.hoverPt) c.lineTo(drag.hoverPt.x, drag.hoverPt.y); }
      else { const r = this.rect(); if (drag.shape === 'rect') c.rect(r.x, r.y, r.w, r.h); else c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); }
    });
  },
  penDab(a, b) {
    const x = drag.buf.ctx, s = curSub().size || 20;
    x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = s; x.strokeStyle = '#e3a446';
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x + .01, b.y); x.stroke();
    requestRender();
  },
  rect() {
    const a = drag.pts[0], b = drag.pts[drag.pts.length - 1];
    let w = b.x - a.x, h = b.y - a.y;
    if (drag.square) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
    return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) };
  },
  move(e) {
    let d = s2d(...Object.values(localPos(e)));
    if (typeof Rulers !== 'undefined' && drag.shape !== 'lasso' && drag.shape !== 'pen') d = Rulers.gridSnap(d);
    drag.square = e.shiftKey && drag.op !== 'add';
    if (drag.shape === 'pen') { this.penDab(drag.pts[drag.pts.length - 1], d); drag.pts.push(d); return; }
    if (drag.shape === 'lasso') drag.pts.push(d); else if (drag.shape === 'poly') drag.hoverPt = d; else drag.pts[1] = d;
    requestRender();
  },
  up() {
    const p = drag.pts;
    if (drag.shape === 'pen') {
      const c = cloneCanvas(drag.buf.canvas); drag.buf.ctx.clearRect(0, 0, D.w, D.h);
      selApply('선택 펜', drag.op === 'new' ? 'add' : drag.op, x => x.drawImage(c, 0, 0));
      return;
    }
    if (drag.shape === 'lasso') {
      if (p.length < 3) { if (drag.op === 'new') deselect(); return; }
      selApply('올가미 선택', drag.op, c => { c.beginPath(); c.moveTo(p[0].x, p[0].y); for (const q of p) c.lineTo(q.x, q.y); c.closePath(); c.fill(); });
    } else {
      const r = this.rect();
      if (r.w < 1 || r.h < 1) { if (drag.op === 'new') deselect(); return; }
      selApply(drag.shape === 'rect' ? '직사각형 선택' : '타원 선택', drag.op, c => {
        c.beginPath();
        if (drag.shape === 'rect') c.rect(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
        else c.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2);
        c.fill();
      });
    }
  },
  cancel() { if (drag.buf) drag.buf.ctx.clearRect(0, 0, D.w, D.h); requestRender(); },
};
// 꺾은선 선택: 클릭으로 점을 찍고 더블클릭·시작점 클릭·Enter로 닫는다
const PolySel = {
  pts: null, op: 'new',
  click(d, e) {
    if (!this.pts) { this.pts = [d]; this.op = e.shiftKey ? 'add' : e.altKey ? 'sub' : curSub().mode; OVERLAYS.doc.includes(this.draw) || OVERLAYS.doc.push(this.draw); requestRender(); return; }
    const first = this.pts[0];
    if (Math.hypot(first.x - d.x, first.y - d.y) * V.zoom < 8 && this.pts.length > 2) { this.close(); return; }
    this.pts.push(d); requestRender();
  },
  close() {
    const p = this.pts; this.pts = null;
    if (p && p.length > 2) selApply('꺾은선 선택', this.op, c => { c.beginPath(); p.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); });
    requestRender();
  },
  cancel() { this.pts = null; requestRender(); },
  draw: (ctx, px) => {
    const p = PolySel.pts; if (!p) return;
    ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    if (hover) { const h = s2d(hover.x, hover.y); ctx.lineTo(h.x, h.y); }
    ctx.lineWidth = px; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([]);
    for (const q of p) { ctx.fillStyle = '#e3a446'; ctx.fillRect(q.x - 3 * px, q.y - 3 * px, 6 * px, 6 * px); }
  },
};
HANDLERS.polysel = { down(e, s) { PolySel.click(s2d(s.x, s.y), e); return false; } };
