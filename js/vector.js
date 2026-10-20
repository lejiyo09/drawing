/* 벡터 레이어: 선 데이터 저장·렌더, 벡터 지우개(닿은 부분·교점까지·선 전체), 오브젝트 선택,
 * 선 수정(제어점·선 집기·선 폭 수정·선 단순화), 도형(직선·직사각형·타원·꺾은선), 집중선·유선. */
'use strict';

const BRUSH_KEYS = ['size', 'hardness', 'flow', 'spacing', 'minSize', 'pSize', 'pFlow', 'taperIn', 'taperOut', 'tip', 'angle', 'aspect', 'angleMode', 'tipId', 'sizeJ', 'angleJ', 'scatter', 'texture'];
const Vector = {
  sel: new Set(), // 선택된 선 id
  bboxCache: new WeakMap(),
  brushOf(b) { const o = {}; for (const k of BRUSH_KEYS) if (b[k] !== undefined) o[k] = b[k]; o.stab = 0; return o; },
  strokeLen(pts) { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return t; },
  renderOne(ctx, s) {
    if (s.kind === 'poly') {
      ctx.save(); ctx.globalAlpha = s.opacity ?? 1; ctx.fillStyle = s.color;
      ctx.beginPath(); s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.restore();
      const bb = Rect.ofPoints(s.pts, 2); this.bboxCache.set(s, bb); return bb;
    }
    const tm = T.get('vtmp'), tx = tm.ctx;
    const est = Rect.clip(Rect.grow(Rect.ofPoints(s.pts), s.b.size * 2 + 4));
    if (!est) return null;
    tx.clearRect(est.x, est.y, est.w, est.h);
    const st = new Stroke(tx, s.b, { noStab: true });
    if (s.b.taperOut) st.total = this.strokeLen(s.pts);
    for (const p of s.pts) st.addPt({ x: p[0], y: p[1], p: p[2], w: p[3] ?? 1 });
    const r = Rect.clip(st.bbox);
    if (!r) return null;
    tx.save(); tx.beginPath(); tx.rect(r.x, r.y, r.w, r.h); tx.clip();
    if (s.b.texture) { tx.globalCompositeOperation = 'destination-in'; tx.fillStyle = paperPattern(tx); tx.fillRect(r.x, r.y, r.w, r.h); }
    tx.globalCompositeOperation = 'source-in'; tx.fillStyle = s.color; tx.fillRect(r.x, r.y, r.w, r.h);
    tx.restore();
    ctx.save(); ctx.globalAlpha = s.opacity ?? 1;
    ctx.drawImage(tm.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.restore();
    tx.clearRect(r.x, r.y, r.w, r.h);
    this.bboxCache.set(s, r);
    return r;
  },
  render(L, skip) {
    L.ctx.clearRect(0, 0, D.w, D.h);
    for (const s of L.data.strokes) if (!skip || !skip.has(s.id)) this.renderOne(L.ctx, s);
  },
  setStrokes(L, arr, label, before) {
    const b = before || L.data.strokes;
    L.data.strokes = arr;
    bumpLayer(L);
    const a = arr;
    H.push({ label, undo: () => { L.data.strokes = b.slice(); bumpLayer(L); Vector.sel.clear(); }, redo: () => { L.data.strokes = a.slice(); bumpLayer(L); } });
  },
  addStroke(L, st, b, rgb) {
    let pts = rdp(st.pts, .35);
    if (pts.length === 1) pts = [pts[0], { ...pts[0], x: pts[0].x + .01 }];
    const s = { id: uid(), pts: pts.map(p => [+p.x.toFixed(2), +p.y.toFixed(2), +p.p.toFixed(3)]), b: this.brushOf(b), color: hex(rgb), opacity: b.opacity ?? 1 };
    const before = L.data.strokes;
    L.data.strokes = before.concat([s]);
    // 새 선만 덧그린다 (전체 재렌더 생략)
    const r = this.renderOne(L.ctx, s);
    L.rev = revSeq++; L.renderedRev = L.rev;
    markDirty(r); queueThumb(L);
    const a = L.data.strokes;
    H.push({ label: b.name || '벡터 선', undo: () => { L.data.strokes = before.slice(); bumpLayer(L); }, redo: () => { L.data.strokes = a.slice(); bumpLayer(L); } });
  },
  addRaw(L, items, label) { this.setStrokes(L, L.data.strokes.concat(items), label); },
  /* ---------- 기하 ---------- */
  distSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return { d: Math.hypot(px - ax - dx * t, py - ay - dy * t), t };
  },
  hit(s, x, y, tol) {
    if (s.kind === 'poly') return pointInPoly({ x, y }, s.pts.map(p => ({ x: p[0], y: p[1] }))) ? { d: 0, i: 0, t: 0 } : null;
    const half = s.b.size / 2;
    let best = null;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i], b = s.pts[i + 1], r = this.distSeg(x, y, a[0], a[1], b[0], b[1]);
      const d = r.d - half * lerp(a[2], b[2], r.t);
      if (d <= tol && (!best || d < best.d)) best = { d, i, t: r.t };
    }
    if (s.pts.length === 1) { const d = Math.hypot(x - s.pts[0][0], y - s.pts[0][1]) - half; if (d <= tol) best = { d, i: 0, t: 0 }; }
    return best;
  },
  pick(L, x, y, tol) {
    let best = null;
    for (let k = L.data.strokes.length - 1; k >= 0; k--) {
      const s = L.data.strokes[k], h = this.hit(s, x, y, tol);
      if (h && (!best || h.d < best.h.d - .01)) best = { s, h };
    }
    return best;
  },
  resample(s, step) {
    const out = [s.pts[0].slice()], cum = [0];
    let acc = 0;
    for (let i = 1; i < s.pts.length; i++) {
      const a = s.pts[i - 1], b = s.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
      for (let k = 1; k <= n; k++) { const t = k / n; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3] ?? 1, b[3] ?? 1, t)]); cum.push(acc + L * t); }
      acc += L;
    }
    return { pts: out, cum };
  },
  // 호 길이 구간들을 제거하고 남은 조각을 새 선으로 만든다
  cut(s, intervals, rs) {
    rs = rs || this.resample(s, 1.5);
    const keep = rs.pts.map((_, i) => !intervals.some(([a, b]) => rs.cum[i] >= a && rs.cum[i] <= b));
    const pieces = [];
    let cur = [];
    for (let i = 0; i < rs.pts.length; i++) {
      if (keep[i]) cur.push(rs.pts[i]);
      else if (cur.length) { pieces.push(cur); cur = []; }
    }
    if (cur.length) pieces.push(cur);
    return pieces.filter(p => p.length >= 2).map(p => {
      const pts = rdp(p.map(q => ({ x: q[0], y: q[1], p: q[2], w: q[3] })), .3).map(q => [q.x, q.y, q.p, q.w ?? 1]);
      return { ...s, id: uid(), pts };
    });
  },
  segIntersect(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]], den = r[0] * q[1] - r[1] * q[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
  },
  // 다른 선과 만나는 위치(호 길이)
  crossings(s, others) {
    const out = [];
    const bb = this.bboxCache.get(s) || Rect.ofPoints(s.pts, s.b.size);
    let acc = 0;
    for (let i = 0; i < s.pts.length - 1; i++) {
      const a = s.pts[i], b = s.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (const o of others) {
        if (o.kind === 'poly') continue;
        const ob = this.bboxCache.get(o) || Rect.ofPoints(o.pts, o.b.size);
        if (ob.x > bb.x + bb.w || ob.x + ob.w < bb.x || ob.y > bb.y + bb.h || ob.y + ob.h < bb.y) continue;
        for (let j = 0; j < o.pts.length - 1; j++) {
          if (o === s && Math.abs(i - j) < 2) continue;
          const t = this.segIntersect(a, b, o.pts[j], o.pts[j + 1]);
          if (t != null) out.push(acc + L * t);
        }
      }
      acc += L;
    }
    return out.sort((x, y) => x - y);
  },
  /* ---------- 플로팅 변형 ---------- */
  targetIds(L) {
    if (this.sel.size) return new Set([...this.sel].filter(id => L.data.strokes.some(s => s.id === id)));
    if (Sel.has) {
      const d = Sel.ctx.getImageData(0, 0, D.w, D.h).data, ids = new Set();
      for (const s of L.data.strokes) {
        const inside = s.pts.every(p => { const x = clamp(p[0] | 0, 0, D.w - 1), y = clamp(p[1] | 0, 0, D.h - 1); return d[(y * D.w + x) * 4 + 3] >= 128; });
        if (inside) ids.add(s.id);
      }
      return ids;
    }
    return new Set(L.data.strokes.map(s => s.id));
  },
  beginFloat(kind) {
    const L = active();
    if (!canPaint(L, 'brush')) return false;
    const ids = this.targetIds(L);
    if (!ids.size) { toast('변형할 벡터 선이 없습니다.'); return false; }
    const strokes = L.data.strokes.filter(s => ids.has(s.id));
    const tmp = mkCanvas(D.w, D.h), tx = tmp.getContext('2d');
    let bb = null;
    for (const s of strokes) bb = Rect.union(bb, this.renderOne(tx, s));
    bb = Rect.clip(bb) || Rect.full();
    this.render(L, ids); markDirty();
    A.layerId = L.id; A.target = 'canvas';
    A.float = { canvas: cloneCanvas(tmp, bb), mask: null, kind, layer: L, vector: { ids, strokes, before: L.data.strokes }, x: bb.x, y: bb.y, w: bb.w, h: bb.h, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, mode: 'affine', last: null, target: 'canvas', selBefore: selSnapshot() };
    floatDirty();
    if (kind === 'transform') showTransformBar();
    return true;
  },
  mapStrokes(strokes, f, map, scale = 1) {
    return strokes.map(s => ({ ...s, pts: s.pts.map(p => { const q = map(p[0] - f.x, p[1] - f.y); return [q.x, q.y, p[2], p[3] ?? 1]; }), b: s.b ? { ...s.b, size: s.b.size * scale } : s.b }));
  },
  bakeFloat(f, map, r) {
    f.vector.strokes = this.mapStrokes(f.vector.strokes, f, map).map(s => s);
    // 이후 퍼펫 매핑은 새 원점 기준
    void r;
  },
  commitFloat(f, label) {
    const L = f.layer, map = floatMap(f);
    const scale = f.mode === 'affine' ? Math.sqrt(Math.abs(f.sx * f.sy)) : 1;
    const moved = this.mapStrokes(f.vector.strokes, f, map, scale);
    const byId = new Map(moved.map(s => [s.id, s]));
    const next = f.vector.before.map(s => byId.get(s.id) || s);
    A.float = null; $('#transformbar').hidden = true;
    this.setStrokes(L, next, label, f.vector.before);
  },
  cancelFloat(f) { const L = f.layer; L.data.strokes = f.vector.before; bumpLayer(L); },
};
RENDERERS.vector = L => Vector.render(L);

/* ---------- 벡터 지우개 ---------- */
HANDLERS.vectorErase = {
  down(e, s) {
    const L = active();
    drag.kind = 'vectorErase';
    drag.L = L; drag.before = L.data.strokes; drag.mode = curSub().vmode || 'touch';
    drag.r = Math.max(2, (curSub().size || 10) / 2);
    this.at(s2d(s.x, s.y));
  },
  move(e) {
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) { const s = localPos(ev); this.at(s2d(s.x, s.y)); }
  },
  at(p) {
    const L = drag.L, r = drag.r;
    let changed = false;
    const out = [];
    for (const s of L.data.strokes) {
      const h = Vector.hit(s, p.x, p.y, r);
      if (!h) { out.push(s); continue; }
      changed = true;
      if (drag.mode === 'line' || s.kind === 'poly') continue;
      const rs = Vector.resample(s, Math.max(.75, r / 4));
      if (drag.mode === 'touch') {
        const iv = [];
        rs.pts.forEach((q, i) => { if (Math.hypot(q[0] - p.x, q[1] - p.y) <= r + s.b.size / 2 * q[2] * .5) iv.push([rs.cum[i] - .01, rs.cum[i] + .01]); });
        out.push(...Vector.cut(s, iv, rs));
      } else {
        // 교점까지: 지운 위치를 기준으로 앞뒤 가장 가까운 교점 사이를 지운다
        const others = L.data.strokes;
        const xs = Vector.crossings(s, others);
        let acc = 0;
        for (let i = 0; i < h.i; i++) acc += Math.hypot(s.pts[i + 1][0] - s.pts[i][0], s.pts[i + 1][1] - s.pts[i][1]);
        const a = s.pts[h.i], b = s.pts[Math.min(h.i + 1, s.pts.length - 1)];
        const th = acc + Math.hypot(b[0] - a[0], b[1] - a[1]) * h.t;
        const lo = Math.max(-1, ...xs.filter(x => x < th - .5)), hi = Math.min(Infinity, ...xs.filter(x => x > th + .5));
        out.push(...Vector.cut(s, [[lo === -1 ? -1 : lo + .01, hi === Infinity ? Infinity : hi - .01]], rs));
      }
    }
    if (changed) { L.data.strokes = out; bumpLayer(L); }
  },
  up() {
    const L = drag.L;
    if (L.data.strokes !== drag.before) Vector.setStrokes(L, L.data.strokes, '벡터 지우개', drag.before);
  },
  cancel() { drag.L.data.strokes = drag.before; bumpLayer(drag.L); },
};

/* ---------- 오브젝트 도구 (벡터) ---------- */
Vector.objectHandler = {
  down(e, s) {
    const L = active(), d = s2d(s.x, s.y), tol = 6 / V.zoom;
    const hit = Vector.pick(L, d.x, d.y, tol);
    if (!hit) { if (!e.shiftKey) Vector.sel.clear(); requestRender(); PropUI.render(); drag.marquee = d; drag.preview = antsPreview(c => { const r = Rect.ofPoints([drag.marquee, drag.cur || drag.marquee]); c.rect(r.x, r.y, r.w, r.h); }); return; }
    if (e.shiftKey) { Vector.sel.has(hit.s.id) ? Vector.sel.delete(hit.s.id) : Vector.sel.add(hit.s.id); }
    else if (!Vector.sel.has(hit.s.id)) { Vector.sel.clear(); Vector.sel.add(hit.s.id); }
    drag.start = d; drag.before = L.data.strokes; drag.L = L;
    requestRender(); PropUI.render();
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e)));
    if (drag.marquee) { drag.cur = d; requestRender(); return; }
    const dx = d.x - drag.start.x, dy = d.y - drag.start.y, L = drag.L;
    L.data.strokes = drag.before.map(s => (Vector.sel.has(s.id) ? { ...s, pts: s.pts.map(p => [p[0] + dx, p[1] + dy, p[2], p[3] ?? 1]) } : s));
    bumpLayer(L); drag.moved = true;
  },
  up() {
    if (drag.marquee) {
      const r = Rect.ofPoints([drag.marquee, drag.cur || drag.marquee]), L = active();
      for (const s of L.data.strokes) if (s.pts.every(p => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h)) Vector.sel.add(s.id);
      requestRender(); PropUI.render(); return;
    }
    if (drag.moved) Vector.setStrokes(drag.L, drag.L.data.strokes, '벡터 선 이동', drag.before);
  },
  cancel() { if (drag.before) { drag.L.data.strokes = drag.before; bumpLayer(drag.L); } },
};
Vector.deleteSelected = () => {
  const L = active();
  if (L.type !== 'vector' || !Vector.sel.size) return false;
  Vector.setStrokes(L, L.data.strokes.filter(s => !Vector.sel.has(s.id)), '벡터 선 삭제');
  Vector.sel.clear(); PropUI.render();
  return true;
};
Vector.applyToSelected = (fn, label) => {
  const L = active();
  if (L.type !== 'vector' || !Vector.sel.size) return;
  Vector.setStrokes(L, L.data.strokes.map(s => (Vector.sel.has(s.id) ? fn({ ...s, b: s.b ? { ...s.b } : s.b }) : s)), label);
};
Vector.simplifyAll = () => {
  const L = active(); if (L.type !== 'vector') { toast('벡터 레이어를 선택해 주세요.'); return; }
  const ids = Vector.sel.size ? Vector.sel : null;
  Vector.setStrokes(L, L.data.strokes.map(s => (s.kind === 'poly' || (ids && !ids.has(s.id)) ? s : { ...s, pts: rdp(s.pts.map(p => ({ x: p[0], y: p[1], p: p[2], w: p[3] })), 1.2).map(q => [q.x, q.y, q.p, q.w ?? 1]) })), '벡터 선 단순화');
};
Vector.rasterize = () => {
  const L = active();
  if (!['vector', 'text', 'fill', 'gradient', '3d'].includes(L.type)) { toast('래스터화할 레이어가 아닙니다.'); return; }
  structural('래스터화', [L], () => { L.type = 'raster'; L.data = {}; L.rev = revSeq++; L.renderedRev = L.rev; });
};
OVERLAYS.doc.push((ctx, px) => {
  const L = active();
  if (!L || L.type !== 'vector') return;
  const k = typeof effKind === 'function' ? effKind() : '';
  if (Vector.sel.size && (k === 'object' || A.float)) {
    ctx.strokeStyle = 'rgba(64,170,255,.95)'; ctx.lineWidth = 1.5 * px;
    for (const s of L.data.strokes) if (Vector.sel.has(s.id)) { ctx.beginPath(); s.pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (s.kind === 'poly') ctx.closePath(); ctx.stroke(); }
  }
  if (k === 'linefix' && hover && V.zoom > .2) {
    const h = s2d(hover.x, hover.y), R = Math.max(40 * px, (curSub().size || 20));
    ctx.fillStyle = 'rgba(64,170,255,.9)';
    for (const s of L.data.strokes) {
      if (s.kind === 'poly') continue;
      for (const p of s.pts) if (Math.abs(p[0] - h.x) < R * 3 && Math.abs(p[1] - h.y) < R * 3) ctx.fillRect(p[0] - 2 * px, p[1] - 2 * px, 4 * px, 4 * px);
    }
  }
});

/* ---------- 선 수정 ---------- */
HANDLERS.linefix = {
  down(e, s) {
    const L = active();
    if (L.type !== 'vector') { toast('선 수정 도구는 벡터 레이어에서 사용합니다.', true); return false; }
    if (L.locked) { toast('잠긴 레이어입니다.', true); return false; }
    const o = curSub(), d = s2d(s.x, s.y);
    drag.L = L; drag.before = L.data.strokes; drag.o = o; drag.start = d; drag.prev = d;
    if (o.fix === 'ctrl' || o.fix === 'pinch') {
      let best = null;
      L.data.strokes.forEach((st, si) => { if (st.kind === 'poly') return; st.pts.forEach((p, pi) => { const dd = Math.hypot(p[0] - d.x, p[1] - d.y); if (!best || dd < best.d) best = { d: dd, si, pi }; }); });
      if (!best || best.d * V.zoom > (o.fix === 'ctrl' ? 14 : 40)) return false;
      drag.target = best;
    } else this.brush(d);
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e))), o = drag.o, L = drag.L;
    if (o.fix === 'ctrl' || o.fix === 'pinch') {
      const dx = d.x - drag.start.x, dy = d.y - drag.start.y, { si, pi } = drag.target;
      const src = drag.before[si];
      let pts;
      if (o.fix === 'ctrl') pts = src.pts.map((p, i) => (i === pi ? [p[0] + dx, p[1] + dy, p[2], p[3] ?? 1] : p));
      else {
        // 선 집기: 잡은 점에서 호 길이로 멀어질수록 적게 움직인다
        const rs = Vector.resample(src, 2), R = Math.max(10, o.size * 2);
        let c0 = 0; for (let i = 0; i < pi; i++) c0 += Math.hypot(src.pts[i + 1][0] - src.pts[i][0], src.pts[i + 1][1] - src.pts[i][1]);
        pts = rs.pts.map((p, i) => { const w = Math.max(0, 1 - Math.abs(rs.cum[i] - c0) / R); const k = w * w * (3 - 2 * w); return [p[0] + dx * k, p[1] + dy * k, p[2], p[3] ?? 1]; });
        pts = rdp(pts.map(q => ({ x: q[0], y: q[1], p: q[2], w: q[3] })), .3).map(q => [q.x, q.y, q.p, q.w ?? 1]);
      }
      L.data.strokes = drag.before.map((st, i) => (i === si ? { ...st, pts } : st));
      bumpLayer(L);
    } else this.brush(d);
    drag.prev = d;
  },
  brush(d) {
    const o = drag.o, L = drag.L, R = Math.max(2, o.size / 2);
    let changed = false;
    const next = L.data.strokes.map(st => {
      if (st.kind === 'poly' || !Vector.hit(st, d.x, d.y, R)) return st;
      changed = true;
      if (o.fix === 'width') {
        const rs = Vector.resample(st, 2);
        const pts = rs.pts.map(p => { const dd = Math.hypot(p[0] - d.x, p[1] - d.y); if (dd > R) return p; const k = 1 - dd / R; return [p[0], p[1], p[2], clamp((p[3] ?? 1) * (1 + (o.thicken ? 1 : -1) * o.amount * .25 * k), .05, 6)]; });
        return { ...st, pts: rdp(pts.map(q => ({ x: q[0], y: q[1], p: q[2], w: q[3] })), .25).map(q => [q.x, q.y, q.p, q.w ?? 1]) };
      }
      return { ...st, pts: rdp(st.pts.map(q => ({ x: q[0], y: q[1], p: q[2], w: q[3] })), 1 + o.amount * 4).map(q => [q.x, q.y, q.p, q.w ?? 1]) };
    });
    if (changed) { L.data.strokes = next; bumpLayer(L); }
  },
  up() { if (drag.L.data.strokes !== drag.before) Vector.setStrokes(drag.L, drag.L.data.strokes, drag.o.name, drag.before); },
  cancel() { drag.L.data.strokes = drag.before; bumpLayer(drag.L); },
};

/* ---------- 도형 · 집중선 · 유선 ---------- */
// 점 목록들([{x,y,p}]...)을 현재 레이어에 선으로 그린다. 벡터 레이어면 벡터 선으로 저장.
function drawPolylines(lines, b, label, fillPolys) {
  const L = active();
  if (!canPaint(L, 'brush')) return;
  const rgb = drawColor(), erase = C.cur === 'trans';
  if (L.type === 'vector' && !L.maskEdit) {
    const items = [];
    for (const poly of fillPolys || []) items.push({ id: uid(), kind: 'poly', pts: poly.map(p => [p.x, p.y]), color: hex(rgb), opacity: b.opacity ?? 1 });
    for (const pts of lines) {
      const pp = pts.length < 2 ? [pts[0], { ...pts[0], x: pts[0].x + .01 }] : pts;
      items.push({ id: uid(), pts: pp.map(p => [p.x, p.y, p.p ?? 1, 1]), b: Vector.brushOf(b), color: hex(rgb), opacity: b.opacity ?? 1 });
    }
    Vector.addRaw(L, items, label);
    return;
  }
  A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
  const buf = T.get('buffer');
  let bbox = null;
  if (fillPolys) for (const poly of fillPolys) {
    buf.ctx.fillStyle = '#000'; buf.ctx.beginPath(); poly.forEach((p, i) => (i ? buf.ctx.lineTo(p.x, p.y) : buf.ctx.moveTo(p.x, p.y))); buf.ctx.closePath(); buf.ctx.fill();
    bbox = Rect.union(bbox, Rect.ofPoints(poly, 2));
  }
  for (const pts of lines) {
    const st = new Stroke(buf.ctx, b, { noStab: true, syms: brushSymmetry() });
    if (b.taperOut) { let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); st.total = t; }
    for (const p of pts) st.addPt({ x: p.x, y: p.y, p: p.p ?? 1 });
    bbox = Rect.union(bbox, st.bbox);
  }
  A.overlay = { canvas: buf.canvas, color: erase ? null : hex(rgb), mode: erase ? 'destination-out' : (L.alphaLock && A.target === 'canvas' ? 'source-atop' : 'source-over'), alpha: b.opacity ?? 1, useSel: true };
  commitOverlay(label, bbox);
  pushColorHistory();
}
function figureBrush(o) { return BR({ size: o.size, pSize: false, hardness: 1, spacing: .05, opacity: o.opacity ?? 1, stab: 0, taperIn: o.taperIn || 0, taperOut: o.taperOut || 0, flow: 1, name: o.name }); }
function shapePoints(shape, a, b, sides) {
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  if (shape === 'rect') return [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }, { x: x0, y: y0 }];
  if (shape === 'ellipse') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, n = Math.max(24, Math.ceil(Math.hypot(rx, ry) / 3)); return Array.from({ length: n + 1 }, (_, i) => ({ x: cx + Math.cos(i / n * Math.PI * 2) * rx, y: cy + Math.sin(i / n * Math.PI * 2) * ry })); }
  if (shape === 'polygon') { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, n = sides || 5; return Array.from({ length: n + 1 }, (_, i) => ({ x: cx + Math.cos(-Math.PI / 2 + i / n * Math.PI * 2) * rx, y: cy + Math.sin(-Math.PI / 2 + i / n * Math.PI * 2) * ry })); }
  return [a, b];
}
const rng = (() => { let s = 12345; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
function focusLines(cx, cy, rx, ry, o) {
  const lines = [], R = Math.hypot(D.w, D.h), n = Math.round(o.count);
  for (let i = 0; i < n; i++) {
    const a = (i + rng() * .8) / n * Math.PI * 2;
    const jit = 1 + (rng() - .3) * o.jitter;
    const ex = cx + Math.cos(a) * rx * jit, ey = cy + Math.sin(a) * ry * jit;
    const sx = cx + Math.cos(a) * R, sy = cy + Math.sin(a) * R;
    lines.push([{ x: sx, y: sy, p: 1 }, { x: lerp(sx, ex, .5), y: lerp(sy, ey, .5), p: 1 }, { x: ex, y: ey, p: .2 }]);
  }
  return lines;
}
function speedLines(a, b, o) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const reg = Sel.has ? Sel.bbox : Rect.full();
  const corners = [[reg.x, reg.y], [reg.x + reg.w, reg.y], [reg.x, reg.y + reg.h], [reg.x + reg.w, reg.y + reg.h]];
  const projN = corners.map(([x, y]) => x * nx + y * ny), projU = corners.map(([x, y]) => x * ux + y * uy);
  const n0 = Math.min(...projN), n1 = Math.max(...projN), u0 = Math.min(...projU), u1 = Math.max(...projU), span = u1 - u0;
  const lines = [], n = Math.round(o.count);
  for (let i = 0; i < n; i++) {
    const nn = lerp(n0, n1, (i + rng()) / n), l = span * (o.lengthRatio || .5) * (.6 + rng() * .8), st = lerp(u0 - l * .3, u1 - l * .7, rng());
    const p0 = { x: ux * st + nx * nn, y: uy * st + ny * nn }, p1 = { x: ux * (st + l) + nx * nn, y: uy * (st + l) + ny * nn };
    lines.push([{ ...p0, p: .2 }, { x: lerp(p0.x, p1.x, .5), y: lerp(p0.y, p1.y, .5), p: 1 }, { ...p1, p: .2 }]);
  }
  return lines;
}
HANDLERS.figure = {
  down(e, s) {
    const o = curSub(), L = active();
    if (!canPaint(L, 'brush')) return false;
    let d = s2d(s.x, s.y);
    if (typeof Rulers !== 'undefined') d = Rulers.gridSnap(d);
    if (o.shape === 'polyline') { Polyline.click(d, e); return false; }
    drag.a = d; drag.b = d;
    drag.preview = (ctx, px) => {
      ctx.lineWidth = Math.max(px, o.size || 1); ctx.strokeStyle = 'rgba(227,164,70,.85)'; ctx.lineCap = 'round';
      if (o.shape === 'focus') { const r = Rect.ofPoints([drag.a, drag.b]); ctx.lineWidth = px; ctx.setLineDash([5 * px, 4 * px]); ctx.beginPath(); ctx.ellipse(drag.a.x, drag.a.y, Math.max(1, Math.abs(drag.b.x - drag.a.x)), Math.max(1, Math.abs(drag.b.y - drag.a.y)), 0, 0, Math.PI * 2); ctx.stroke(); void r; return; }
      if (o.shape === 'speed') { ctx.lineWidth = 2 * px; ctx.beginPath(); ctx.moveTo(drag.a.x, drag.a.y); ctx.lineTo(drag.b.x, drag.b.y); ctx.stroke(); return; }
      const pts = shapePoints(o.shape, drag.a, this.endPt(), o.sides);
      ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (o.style === 'fill') { ctx.fillStyle = 'rgba(227,164,70,.4)'; ctx.fill(); } else ctx.stroke();
    };
  },
  endPt() {
    const o = curSub(), a = drag.a; let b = drag.b;
    if (drag.shift) {
      if (o.shape === 'line') { const ang = Math.round(Math.atan2(b.y - a.y, b.x - a.x) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(b.x - a.x, b.y - a.y); b = { x: a.x + Math.cos(ang) * l, y: a.y + Math.sin(ang) * l }; }
      else { const m = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); b = { x: a.x + Math.sign(b.x - a.x || 1) * m, y: a.y + Math.sign(b.y - a.y || 1) * m }; }
    }
    return b;
  },
  move(e) {
    let d = s2d(...Object.values(localPos(e)));
    if (typeof Rulers !== 'undefined') d = Rulers.gridSnap(d);
    drag.b = d; drag.shift = e.shiftKey; requestRender();
  },
  up() {
    const o = curSub(), b = this.endPt();
    if (Math.hypot(b.x - drag.a.x, b.y - drag.a.y) < 1) return;
    const br = figureBrush(o);
    if (o.shape === 'focus') {
      drawPolylines(focusLines(drag.a.x, drag.a.y, Math.abs(b.x - drag.a.x), Math.abs(b.y - drag.a.y), o), { ...br, taperOut: o.size * 30, taperIn: 0, pSize: true, minSize: .05 }, '집중선');
      return;
    }
    if (o.shape === 'speed') { drawPolylines(speedLines(drag.a, b, o), { ...br, taperIn: o.size * 20, taperOut: o.size * 20, pSize: true, minSize: .05 }, '유선'); return; }
    const pts = shapePoints(o.shape, drag.a, b, o.sides);
    if (o.style === 'fill') drawPolylines([], br, o.name, [pts]);
    else drawPolylines([pts.map(p => ({ ...p, p: 1 }))], br, o.name);
  },
};
const Polyline = {
  pts: null,
  click(d, e) {
    if (!this.pts) { this.pts = [d]; if (!OVERLAYS.doc.includes(this.draw)) OVERLAYS.doc.push(this.draw); requestRender(); return; }
    const first = this.pts[0], last = this.pts[this.pts.length - 1];
    if (Math.hypot(first.x - d.x, first.y - d.y) * V.zoom < 8 && this.pts.length > 2) { this.pts.push(first); this.finish(true); return; }
    if (Math.hypot(last.x - d.x, last.y - d.y) * V.zoom < 4 || e.detail >= 2) { this.finish(false); return; }
    this.pts.push(d); requestRender();
  },
  finish(closed) {
    const p = this.pts; this.pts = null; requestRender();
    if (!p || p.length < 2) return;
    const o = curSub(), br = figureBrush(o);
    if (o.style === 'fill' && closed) drawPolylines([], br, '꺾은선', [p]);
    else drawPolylines([p.map(q => ({ ...q, p: 1 }))], br, '꺾은선');
  },
  cancel() { this.pts = null; requestRender(); },
  draw: (ctx, px) => {
    const p = Polyline.pts; if (!p) return;
    ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    if (hover) { const h = s2d(hover.x, hover.y); ctx.lineTo(h.x, h.y); }
    ctx.lineWidth = Math.max(px, curSub().size || 1); ctx.strokeStyle = 'rgba(227,164,70,.85)'; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  },
};
