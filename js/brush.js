/* 브러시 엔진: 스탬프 방식 획, 필압·손떨림 보정·입출력 보정, 이미지 브러시 끝(데코레이션),
 * 물감 혼색(수채·유채), 색 혼합·흐리기·유동화 도구. */
'use strict';

/* ---------- 브러시 끝 모양 ---------- */
const tipCache = new Map();
function softTip(hard) {
  const k = Math.round(hard * 20);
  if (tipCache.has(k)) return tipCache.get(k);
  const s = 128, c = mkCanvas(s, s), x = c.getContext('2d');
  const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2), h = k / 20;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    let a = t <= h ? 1 : 1 - (t - h) / (1 - h);
    a = a * a * (3 - 2 * a);
    g.addColorStop(t, `rgba(0,0,0,${a.toFixed(4)})`);
  }
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  tipCache.set(k, c);
  return c;
}
// 이미지 브러시 끝: id → { name, mask(알파), orig(원래 색) }
const TIPS = {
  map: new Map(),
  add(id, name, orig, fromLuminance) {
    const s = 128, o = mkCanvas(s, s), ox = o.getContext('2d');
    const sc = Math.min(s / orig.width, s / orig.height);
    ox.drawImage(orig, (s - orig.width * sc) / 2, (s - orig.height * sc) / 2, orig.width * sc, orig.height * sc);
    const m = mkCanvas(s, s), mx = m.getContext('2d');
    if (fromLuminance) {
      const id = ox.getImageData(0, 0, s, s), d = id.data;
      for (let i = 0; i < d.length; i += 4) { const a = (1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255) * d[i + 3]; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a; }
      mx.putImageData(id, 0, 0);
    } else { mx.drawImage(o, 0, 0); mx.globalCompositeOperation = 'source-in'; mx.fillRect(0, 0, s, s); }
    this.map.set(id, { name, mask: m, orig: o });
    return id;
  },
  get(id) { return this.map.get(id) || this.map.get('star'); },
};
function buildBuiltinTips() {
  const mk = (id, name, draw) => { const c = mkCanvas(128, 128), x = c.getContext('2d'); draw(x); TIPS.add(id, name, c, false); };
  const star = (x, cx, cy, R, r, n, rot = -Math.PI / 2) => { x.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); };
  mk('star', '별', x => { star(x, 64, 66, 60, 25, 5); x.fillStyle = '#f2c94c'; x.fill(); });
  mk('sparkle', '반짝임', x => { star(x, 64, 64, 62, 9, 4, 0); x.fillStyle = '#fff6c8'; x.fill(); });
  mk('heart', '하트', x => { x.beginPath(); x.moveTo(64, 112); x.bezierCurveTo(4, 70, 10, 14, 64, 38); x.bezierCurveTo(118, 14, 124, 70, 64, 112); x.fillStyle = '#e8577a'; x.fill(); });
  mk('flower', '꽃', x => {
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; x.beginPath(); x.ellipse(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30, 28, 22, a, 0, Math.PI * 2); x.fillStyle = '#f5a3c0'; x.fill(); }
    x.beginPath(); x.arc(64, 64, 17, 0, Math.PI * 2); x.fillStyle = '#f6d55c'; x.fill();
  });
  mk('leaf', '잎', x => { x.beginPath(); x.moveTo(10, 118); x.quadraticCurveTo(0, 20, 118, 10); x.quadraticCurveTo(108, 110, 10, 118); x.fillStyle = '#5fa463'; x.fill(); x.strokeStyle = '#3e7a45'; x.lineWidth = 4; x.beginPath(); x.moveTo(14, 114); x.lineTo(100, 28); x.stroke(); });
  mk('snow', '눈송이', x => {
    x.strokeStyle = '#dff2ff'; x.lineWidth = 8; x.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); x.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); x.lineTo(64 + Math.cos(a + .5) * 50, 64 + Math.sin(a + .5) * 50); x.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); x.lineTo(64 + Math.cos(a - .5) * 50, 64 + Math.sin(a - .5) * 50); x.stroke(); }
  });
  mk('grass', '풀', x => {
    x.fillStyle = '#4f8f4a';
    for (let i = 0; i < 7; i++) { const bx = 16 + i * 16, h = 60 + (i * 37 % 50); x.beginPath(); x.moveTo(bx - 6, 128); x.quadraticCurveTo(bx + (i % 2 ? 14 : -14), 128 - h / 2, bx + (i % 2 ? 10 : -10), 128 - h); x.quadraticCurveTo(bx, 128 - h / 2, bx + 6, 128); x.fill(); }
  });
  mk('dot', '물방울', x => { x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fillStyle = '#7ec4ef'; x.fill(); x.beginPath(); x.arc(46, 44, 14, 0, Math.PI * 2); x.fillStyle = '#ffffff'; x.fill(); });
  mk('chalk', '분필', x => { for (let i = 0; i < 900; i++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 58; x.fillStyle = `rgba(0,0,0,${Math.random() * .8})`; x.fillRect(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 2, 2); } });
}

/* ---------- 획 ---------- */
// b: 보조 도구 설정. opts: { sym, noStab, colored, under, colorRGB, constrain }
class Stroke {
  constructor(ctx, b, opts = {}) {
    this.ctx = ctx; this.b = b; this.raw = []; this.pts = [];
    this.dist = 0; this.carry = 0; this.bbox = null; this.dirty = null; this.total = 0;
    this.win = opts.noStab ? 1 : 1 + Math.round((b.stab || 0) * .3);
    this.syms = opts.syms || null;
    this.colored = !!opts.colored;
    this.rgb = opts.colorRGB || [0, 0, 0];
    this.under = opts.under || null;
    this.prevColor = null;
    this.constrain = opts.constrain || null;
    this.seed = 1;
    ctx.fillStyle = '#000';
  }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  pc(p) { return Math.pow(clamp(p, 0, 1), S.pressureGamma); }
  sizeAt(p, d) {
    const b = this.b;
    let s = b.size;
    if (b.pSize) s *= b.minSize + (1 - b.minSize) * this.pc(p);
    let f = 1;
    if (b.taperIn > 0) f = Math.min(f, .08 + .92 * clamp(d / b.taperIn, 0, 1));
    if (this.total && b.taperOut > 0) f = Math.min(f, .08 + .92 * clamp((this.total - d) / b.taperOut, 0, 1));
    return Math.max(.3, s * f);
  }
  alphaAt(p) { return this.b.flow * (this.b.pFlow ? Math.max(.05, this.pc(p)) : 1); }
  dabColor(x, y, r) {
    const b = this.b;
    let c = this.rgb.slice();
    if (this.under && b.mix > 0) {
      const u = sampleUnder(this.under, x, y, r);
      if (u) { const k = b.mix * u[3]; c = [lerp(c[0], u[0], k), lerp(c[1], u[1], k), lerp(c[2], u[2], k)]; }
    }
    if (this.prevColor && b.stretch > 0) c = c.map((v, i) => lerp(v, this.prevColor[i], b.stretch));
    this.prevColor = c;
    return c;
  }
  put(x, y, size, a, dir) {
    const ctx = this.ctx, b = this.b;
    let r = size / 2;
    if (r < .5) { a *= (r / .5) ** 2; r = .5; }
    if (b.sizeJ) r *= 1 - this.rand() * b.sizeJ;
    if (b.scatter) { const ang = this.rand() * Math.PI * 2, d = this.rand() * b.scatter * size; x += Math.cos(ang) * d; y += Math.sin(ang) * d; }
    let angle = (b.angle || 0) * Math.PI / 180;
    if (b.angleMode === 'dir' && dir != null) angle += dir;
    if (b.angleMode === 'tilt' && this.tilt != null) angle += this.tilt;
    if (b.angleJ) angle += (this.rand() - .5) * 2 * b.angleJ * Math.PI / 180;
    const col = this.colored ? (b.tip === 'image' && b.tipColor === 'original' ? null : this.dabColor(x, y, r)) : null;
    ctx.globalAlpha = clamp(a, 0, 1);
    const one = (px, py, ang, mirror) => {
      if (b.tip === 'image') {
        const t = TIPS.get(b.tipId), img = this.colored && b.tipColor === 'original' ? t.orig : (col ? tinted(t.mask, col) : t.mask);
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang); if (mirror) ctx.scale(-1, 1);
        ctx.drawImage(img, -r, -r, r * 2, r * 2); ctx.restore();
      } else if (b.tip === 'flat') {
        if (col) ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang); ctx.scale(1, b.aspect);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (b.hardness >= .99) {
        if (col) ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      } else {
        const tip = col ? tinted(softTip(b.hardness), col) : softTip(b.hardness);
        ctx.drawImage(tip, px - r, py - r, r * 2, r * 2);
      }
      const rr = { x: px - r * 1.5 - 2, y: py - r * 1.5 - 2, w: r * 3 + 4, h: r * 3 + 4 };
      this.bbox = Rect.union(this.bbox, rr); this.dirty = Rect.union(this.dirty, rr);
    };
    if (this.syms) {
      for (const m of this.syms) {
        const p = m.transformPoint(new DOMPoint(x, y));
        const v = m.transformPoint(new DOMPoint(x + Math.cos(angle), y + Math.sin(angle))), mirror = m.a * m.d - m.b * m.c < 0;
        one(p.x, p.y, Math.atan2(v.y - p.y, v.x - p.x), mirror);
      }
    } else one(x, y, angle, false);
    ctx.globalAlpha = 1;
    if (!this.colored) ctx.fillStyle = '#000';
  }
  seg(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const dir = Math.atan2(dy, dx);
    let t = this.carry;
    while (t <= len) {
      const f = t / len, p = a.p + (b.p - a.p) * f, d = this.dist + t;
      const sz = this.sizeAt(p, d) * lerp(a.w ?? 1, b.w ?? 1, f);
      this.put(a.x + dx * f, a.y + dy * f, sz, this.alphaAt(p), dir);
      t += Math.max(.25, sz * this.b.spacing);
    }
    this.carry = t - len; this.dist += len;
  }
  addPt(pt) {
    this.pts.push(pt);
    const n = this.pts.length;
    if (n === 1) {
      const sz = this.sizeAt(pt.p, 0) * (pt.w ?? 1);
      this.put(pt.x, pt.y, sz, this.alphaAt(pt.p), null);
      this.carry = Math.max(.25, sz * this.b.spacing);
    } else this.seg(this.pts[n - 2], pt);
  }
  addRaw(x, y, p) {
    if (this.constrain) { const q = this.constrain(x, y, this); if (!q) { this.raw.push({ x, y, p, pending: true }); return; } x = q.x; y = q.y; }
    this.raw.push({ x, y, p });
    const raw = this.raw.filter(r => !r.pending);
    const n = raw.length, k = Math.min(this.win, n);
    let sx = 0, sy = 0, sp = 0;
    for (let i = n - k; i < n; i++) { sx += raw[i].x; sy += raw[i].y; sp += raw[i].p; }
    const pt = { x: sx / k, y: sy / k, p: sp / k };
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < .2) { last.p = pt.p; return; }
    this.addPt(pt);
  }
  // 제약(자)이 늦게 결정된 경우, 보류해 둔 입력을 다시 넣는다
  replayPending() {
    const pend = this.raw.filter(r => r.pending);
    this.raw = this.raw.filter(r => !r.pending);
    for (const r of pend) this.addRaw(r.x, r.y, r.p);
  }
  finish() {
    const raw = this.raw.filter(r => !r.pending);
    const last = raw[raw.length - 1];
    if (last && this.win > 1) for (let i = 1; i < this.win; i++) this.addRaw(last.x, last.y, last.p);
    if (this.b.taperOut > 0 && this.pts.length > 1) this.rerender();
  }
  rerender() {
    let total = 0;
    for (let i = 1; i < this.pts.length; i++) total += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y);
    if (this.bbox) this.ctx.clearRect(this.bbox.x, this.bbox.y, this.bbox.w, this.bbox.h);
    const pts = this.pts, keep = this.bbox;
    this.pts = []; this.dist = 0; this.carry = 0; this.total = total; this.bbox = null; this.seed = 1; this.prevColor = null;
    for (const p of pts) this.addPt(p);
    this.bbox = Rect.union(this.bbox, keep); this.dirty = Rect.union(this.dirty, keep);
  }
  takeDirty() { const d = this.dirty; this.dirty = null; return d; }
}
const tintCache = new Map();
function tinted(mask, col) {
  const key = col.map(v => v >> 3).join(',');
  let m = tintCache.get(mask);
  if (!m) { m = new Map(); tintCache.set(mask, m); }
  let c = m.get(key);
  if (!c) {
    if (m.size > 400) m.clear();
    c = mkCanvas(mask.width, mask.height);
    const x = c.getContext('2d');
    x.drawImage(mask, 0, 0); x.globalCompositeOperation = 'source-in';
    x.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`; x.fillRect(0, 0, c.width, c.height);
    m.set(key, c);
  }
  return c;
}
function snapshotUnder(L) {
  const t = T.get('read').ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(L.canvas, 0, 0);
  return { d: t.getImageData(0, 0, D.w, D.h).data, w: D.w, h: D.h };
}
function sampleUnder(u, x, y, r) {
  let R = 0, G = 0, B = 0, Aa = 0, n = 0;
  const off = Math.max(1, r * .5);
  for (const [dx, dy] of [[0, 0], [off, 0], [-off, 0], [0, off], [0, -off]]) {
    const px = (x + dx) | 0, py = (y + dy) | 0;
    if (px < 0 || py < 0 || px >= u.w || py >= u.h) continue;
    const i = (py * u.w + px) * 4, a = u.d[i + 3] / 255;
    R += u.d[i] * a; G += u.d[i + 1] * a; B += u.d[i + 2] * a; Aa += a; n++;
  }
  if (!n || Aa < .05) return null;
  return [R / Aa, G / Aa, B / Aa, Aa / n];
}
function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = 0, mi = -1;
    const ax = pts[a].x, ay = pts[a].y, bx = pts[b].x, by = pts[b].y, dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * pts[i].x - dx * pts[i].y + bx * ay - by * ax) / l + Math.abs(pts[i].p - lerp(pts[a].p, pts[b].p, (i - a) / (b - a))) * 4;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps && mi > 0) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* ---------- 레이어 확정 ---------- */
function editTarget(L) { return A.target === 'mask' ? L.mask : L.canvas; }
function brushOverlay(b, L) {
  const erase = b.eraser || C.cur === 'trans';
  const mixing = (b.mix > 0 || b.stretch > 0 || (b.tip === 'image' && b.tipColor === 'original')) && !erase && A.target !== 'mask';
  return {
    canvas: T.get('buffer').canvas, color: erase || mixing ? null : drawHex(), texture: b.texture && !erase, wetEdge: erase ? 0 : (b.wetEdge || 0),
    mode: erase ? 'destination-out' : (L.alphaLock && A.target !== 'mask' ? 'source-atop' : 'source-over'),
    alpha: b.opacity, useSel: true, mixing,
  };
}
function commitOverlay(label, bbox, record = true) {
  const L = findLayer(A.layerId) || active(), r = Rect.clip(bbox);
  const target = editTarget(L);
  if (r && A.overlay && target) {
    const tx = target.getContext('2d');
    const before = record ? cloneCanvas(target, r) : null;
    const src = prepOverlay(A.overlay, r);
    tx.save();
    tx.globalAlpha = A.overlay.alpha; tx.globalCompositeOperation = A.overlay.mode;
    tx.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    tx.restore();
    if (record) H.push(pixCmd(label, L, r, before, cloneCanvas(target, r), A.target === 'mask' ? 'mask' : 'canvas'));
    queueThumb(L);
  }
  if (r) T.get('buffer').ctx.clearRect(r.x, r.y, r.w, r.h);
  A.overlay = null;
  markDirty(r);
}
// what: 'pixel'(래스터만), 'brush'(래스터·벡터), 'any'
function canPaint(L, what = 'pixel', quiet) {
  L = L || active();
  let msg = null;
  const maskEdit = L && L.maskEdit && L.mask;
  if (!L) msg = '레이어가 없습니다.';
  else if (L.locked) msg = '잠긴 레이어입니다. 레이어 잠금을 해제해 주세요.';
  else if (!shownInTree(L)) msg = '숨긴 레이어에는 그릴 수 없습니다.';
  else if (maskEdit) msg = null;
  else if (L.type === 'paper') msg = '용지 레이어에는 그릴 수 없습니다. 새 레이어를 만들어 주세요.';
  else if (L.type === 'vector' && what === 'pixel') msg = '벡터 레이어에는 이 도구를 사용할 수 없습니다. 래스터 레이어를 선택해 주세요.';
  else if (!(L.type === 'raster' || (L.type === 'vector' && what !== 'pixel'))) msg = `${LAYER_TYPE_NAMES[L.type]} 레이어에는 그릴 수 없습니다. 래스터 레이어를 선택하거나 레이어 마스크를 편집하세요.`;
  if (msg && !quiet) toast(msg, true);
  return !msg;
}
let lastStrokeEnd = null;
function brushSymmetry() { return typeof Rulers !== 'undefined' ? Rulers.symTransforms() : null; }
function pressureOf(e) { return e.pointerType === 'pen' ? (e.pressure || 0) : 1; }

HANDLERS.brush = {
  down(e, s) {
    const L = active();
    if (!canPaint(L, 'brush')) return false;
    const b = curSub(), d = s2d(s.x, s.y);
    A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
    if (L.type === 'vector' && A.target === 'canvas' && b.eraser) return HANDLERS.vectorErase.down(e, s);
    const ov = brushOverlay(b, L);
    A.overlay = ov;
    const st = new Stroke(T.get('buffer').ctx, b, {
      syms: brushSymmetry(), noStab: e.shiftKey, colored: ov.mixing, colorRGB: drawColor(),
      under: ov.mixing && b.mix > 0 && L.type === 'raster' ? snapshotUnder(L) : null,
      constrain: typeof Rulers !== 'undefined' && !e.shiftKey ? Rulers.makeConstraint(d) : null,
    });
    if (e.pointerType === 'pen' && e.tiltX != null) st.tilt = Math.atan2(e.tiltY || 0, e.tiltX || 0);
    drag.stroke = st;
    if (e.shiftKey && lastStrokeEnd && lastStrokeEnd.layer === L.id) {
      st.addPt({ ...lastStrokeEnd.pt }); st.addPt({ x: d.x, y: d.y, p: pressureOf(e) });
      drag.line = true;
    } else st.addRaw(d.x, d.y, pressureOf(e));
    markDirty(st.takeDirty());
  },
  move(e) {
    if (drag.line) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const s = localPos(ev), d = s2d(s.x, s.y);
      if (ev.pointerType === 'pen' && ev.tiltX != null) drag.stroke.tilt = Math.atan2(ev.tiltY || 0, ev.tiltX || 0);
      drag.stroke.addRaw(d.x, d.y, pressureOf(ev));
    }
    markDirty(drag.stroke.takeDirty());
  },
  up() {
    const st = drag.stroke, L = findLayer(A.layerId);
    if (!drag.line) st.finish();
    markDirty(st.takeDirty());
    const last = st.pts[st.pts.length - 1];
    if (last) lastStrokeEnd = { layer: L.id, pt: last };
    if (L.type === 'vector' && A.target === 'canvas') {
      const bb = st.bbox;
      if (bb) T.get('buffer').ctx.clearRect(bb.x, bb.y, bb.w, bb.h);
      A.overlay = null;
      if (st.pts.length) Vector.addStroke(L, st, curSub(), drawColor());
      markDirty(bb);
    } else commitOverlay(curSub().name, st.bbox);
    if (!st.b.eraser) pushColorHistory();
  },
  cancel() { const st = drag.stroke; if (st && st.bbox) { T.get('buffer').ctx.clearRect(st.bbox.x, st.bbox.y, st.bbox.w, st.bbox.h); markDirty(st.bbox); } A.overlay = null; },
};

/* ---------- 색 혼합 · 흐리기 · 유동화 ---------- */
HANDLERS.blend = {
  down(e, s) {
    const L = active();
    if (!canPaint(L, 'pixel')) return false;
    const b = curSub(), d = s2d(s.x, s.y);
    A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
    const src = editTarget(L);
    drag.before = cloneCanvas(src);
    drag.work = cloneCanvas(src);
    drag.wx = drag.work.getContext('2d');
    drag.b = b; drag.prev = d; drag.carry = 0; drag.bbox = null;
    if (A.target === 'canvas') A.replace = drag.work;
    if (b.mode === 'liquify') {
      drag.img = drag.wx.getImageData(0, 0, D.w, D.h);
      drag.selA = Sel.has ? Sel.ctx.getImageData(0, 0, D.w, D.h).data : null;
      if (b.lmode !== 'push') drag.timer = setInterval(() => { if (drag && drag.b) { this.dab(drag.prev, { x: 0, y: 0 }); this.flush(); } }, 40);
    }
    this.dab(d, { x: 0, y: 0 });
    this.flush();
  },
  move(e) {
    const s = localPos(e), d = s2d(s.x, s.y), b = drag.b;
    const dx = d.x - drag.prev.x, dy = d.y - drag.prev.y, len = Math.hypot(dx, dy);
    const step = Math.max(1, b.size * (b.mode === 'liquify' ? .15 : .2));
    let t = step - drag.carry;
    let last = drag.prev;
    while (t <= len) {
      const p = { x: drag.prev.x + dx * t / len, y: drag.prev.y + dy * t / len };
      this.dab(p, { x: p.x - last.x, y: p.y - last.y }, last);
      last = p; t += step;
    }
    drag.carry = len - (t - step);
    if (last !== drag.prev) drag.last = last;
    drag.prev = d;
    this.flush();
  },
  dab(p, mv, from) {
    const b = drag.b, r = Math.max(1, b.size / 2), x = drag.wx;
    const rr = { x: p.x - r - 2, y: p.y - r - 2, w: r * 2 + 4, h: r * 2 + 4 };
    drag.bbox = Rect.union(drag.bbox, rr); drag.dirty = Rect.union(drag.dirty, rr);
    if (b.mode === 'liquify') return this.liquifyDab(p, mv, r);
    const size = Math.ceil(r * 2), pc = this.patch(size), px = pc.getContext('2d');
    px.clearRect(0, 0, size, size);
    if (b.mode === 'smudge') {
      if (!from) return;
      px.drawImage(drag.work, from.x - r, from.y - r, size, size, 0, 0, size, size);
    } else {
      // 흐리기: 축소 후 확대
      const f = 1 + b.strength * 6, sw = Math.max(1, Math.round(size / f));
      const q = this.patch2(sw), qx = q.getContext('2d');
      qx.clearRect(0, 0, sw, sw); qx.imageSmoothingQuality = 'high';
      qx.drawImage(drag.work, p.x - r, p.y - r, size, size, 0, 0, sw, sw);
      px.imageSmoothingQuality = 'high'; px.drawImage(q, 0, 0, sw, sw, 0, 0, size, size);
    }
    px.globalCompositeOperation = 'destination-in';
    px.drawImage(softTip(b.hardness ?? .3), 0, 0, size, size);
    if (Sel.has) px.drawImage(Sel.canvas, p.x - r, p.y - r, size, size, 0, 0, size, size);
    px.globalCompositeOperation = 'source-over';
    x.save();
    if (L_alphaLocked()) x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = b.mode === 'smudge' ? b.strength : clamp(b.strength * 1.2, 0, 1);
    x.drawImage(pc, p.x - r, p.y - r);
    x.restore();
  },
  liquifyDab(c, mv, R) {
    const img = drag.img, d = img.data, W = D.w, Hh = D.h, b = drag.b, k = b.strength;
    const x0 = Math.max(0, Math.floor(c.x - R)), y0 = Math.max(0, Math.floor(c.y - R)), x1 = Math.min(W - 1, Math.ceil(c.x + R)), y1 = Math.min(Hh - 1, Math.ceil(c.y + R));
    if (x1 < x0 || y1 < y0) return;
    const m = Math.ceil(Math.hypot(mv.x, mv.y) + 2);
    const sx0 = Math.max(0, x0 - m), sy0 = Math.max(0, y0 - m), sx1 = Math.min(W - 1, x1 + m), sy1 = Math.min(Hh - 1, y1 + m), sw = sx1 - sx0 + 1;
    const src = new Uint8ClampedArray((sy1 - sy0 + 1) * sw * 4);
    for (let y = sy0; y <= sy1; y++) src.set(d.subarray((y * W + sx0) * 4, (y * W + sx1 + 1) * 4), (y - sy0) * sw * 4);
    const sample = (fx, fy, out) => {
      fx = clamp(fx, sx0, sx1); fy = clamp(fy, sy0, sy1);
      const ix = Math.min(sx1 - 1, Math.floor(fx)), iy = Math.min(sy1 - 1, Math.floor(fy)), tx = fx - ix, ty = fy - iy;
      const i00 = ((iy - sy0) * sw + ix - sx0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let ch = 0; ch < 4; ch++) out[ch] = (src[i00 + ch] * (1 - tx) + src[i10 + ch] * tx) * (1 - ty) + (src[i01 + ch] * (1 - tx) + src[i11 + ch] * tx) * ty;
    };
    const out = [0, 0, 0, 0], R2 = R * R;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x - c.x, dy = y - c.y, d2 = dx * dx + dy * dy;
      if (d2 >= R2) continue;
      let w = 1 - d2 / R2; w *= w;
      if (drag.selA) w *= drag.selA[(y * W + x) * 4 + 3] / 255;
      if (w <= 0) continue;
      let fx, fy;
      switch (b.lmode) {
        case 'push': fx = x - mv.x * w * k * 1.5; fy = y - mv.y * w * k * 1.5; break;
        case 'bloat': { const s = 1 - w * k * .12; fx = c.x + dx * s; fy = c.y + dy * s; break; }
        case 'pinch': { const s = 1 + w * k * .12; fx = c.x + dx * s; fy = c.y + dy * s; break; }
        default: { const a = (b.lmode === 'twirlL' ? -1 : 1) * w * k * .12, ca = Math.cos(a), sa = Math.sin(a); fx = c.x + dx * ca - dy * sa; fy = c.y + dx * sa + dy * ca; }
      }
      sample(fx, fy, out);
      const i = (y * W + x) * 4;
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; d[i + 3] = out[3];
    }
    drag.liqDirty = Rect.union(drag.liqDirty, { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  },
  flush() {
    if (drag.liqDirty) { const r = drag.liqDirty; drag.wx.putImageData(drag.img, 0, 0, r.x, r.y, r.w, r.h); drag.liqDirty = null; }
    if (A.target === 'mask') {
      // 마스크 편집은 바로 반영
      const L = findLayer(A.layerId); const mx = L.mask.getContext('2d'); mx.clearRect(0, 0, D.w, D.h); mx.drawImage(drag.work, 0, 0);
    }
    markDirty(drag.dirty); drag.dirty = null;
  },
  patch(n) { const c = this._p || (this._p = mkCanvas(n, n)); if (c.width < n) { c.width = c.height = n; } return c; },
  patch2(n) { const c = this._q || (this._q = mkCanvas(n, n)); if (c.width < n) { c.width = c.height = n; } return c; },
  up() {
    clearInterval(drag.timer);
    const L = findLayer(A.layerId), target = editTarget(L), r = Rect.clip(drag.bbox);
    A.replace = null;
    if (r) {
      const tx = target.getContext('2d');
      tx.clearRect(0, 0, D.w, D.h); tx.drawImage(drag.work, 0, 0);
      H.push(pixCmd(drag.b.name, L, r, cloneCanvas(drag.before, r), cloneCanvas(target, r), A.target === 'mask' ? 'mask' : 'canvas'));
    }
    markDirty(); queueThumb(L);
  },
  cancel() {
    clearInterval(drag.timer);
    A.replace = null;
    if (A.target === 'mask') { const L = findLayer(A.layerId); const mx = L.mask.getContext('2d'); mx.clearRect(0, 0, D.w, D.h); mx.drawImage(drag.before, 0, 0); }
    markDirty();
  },
};
function L_alphaLocked() { const L = findLayer(A.layerId); return L && L.alphaLock && A.target !== 'mask'; }
