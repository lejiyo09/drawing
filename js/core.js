/* WebPaint Studio — 코어: 유틸, 컬러, 문서·레이어 트리, 합성, 뷰포트, 작업 내역.
 * 모든 스크립트는 같은 전역 스코프를 공유하는 일반 스크립트다(빌드 과정 없음).
 * 모듈은 HANDLERS(포인터 도구), RENDERERS(레이어 캐시), OVERLAYS(화면 표시), CMDS(명령)에 등록한다. */
'use strict';

/* ================= 유틸 ================= */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
let uidSeq = 1;
const uid = () => Date.now().toString(36) + (uidSeq++).toString(36);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
function cloneCanvas(src, r) {
  r = r || { x: 0, y: 0, w: src.width, h: src.height };
  const c = mkCanvas(r.w, r.h);
  c.getContext('2d').drawImage(src, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return c;
}
const Rect = {
  union(a, b) {
    if (!a) return b; if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  },
  clip(r) {
    if (!r) return null;
    const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    const x2 = Math.min(D.w, Math.ceil(r.x + r.w)), y2 = Math.min(D.h, Math.ceil(r.y + r.h));
    return x2 > x && y2 > y ? { x, y, w: x2 - x, h: y2 - y } : null;
  },
  grow(r, d) { return r && { x: r.x - d, y: r.y - d, w: r.w + d * 2, h: r.h + d * 2 }; },
  full() { return { x: 0, y: 0, w: D.w, h: D.h }; },
  ofPoints(pts, pad = 0) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { const x = p.x ?? p[0], y = p.y ?? p[1]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return x1 < x0 ? null : { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  },
};
function toast(msg, err) {
  const t = el('div', { class: 'toast' + (err ? ' err' : ''), text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), err ? 4500 : 2600);
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('webpaint:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('webpaint:' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};
function loadScript(src) {
  return new Promise((res, rej) => { const s = el('script', { src }); s.onload = res; s.onerror = () => rej(new Error('스크립트를 불러오지 못했습니다: ' + src)); document.head.append(s); });
}

/* ================= 컬러 ================= */
const hex = c => '#' + c.slice(0, 3).map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function parseHex(s) {
  s = String(s).trim().replace('#', '');
  if (s.length === 3) s = s.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
}
function rgb2hsv([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
}
function rgb2hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}
function hue2rgb(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
function hsl2rgb(h, s, l) {
  if (!s) return [l, l, l];
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}
const C = {
  main: store.get('main', [38, 32, 40]),
  sub: store.get('sub', [255, 255, 255]),
  cur: 'main', // main | sub | trans
  hsv: [0, 0, 0],
  history: store.get('colorhist', []),
};
const SWATCHES = ['#000000', '#3b3436', '#6e6a6c', '#a8a4a5', '#ffffff', '#f6e3d3', '#f0c7a8', '#d9a07c', '#a8684a', '#5e3a2b',
  '#d8463a', '#ef7d4c', '#f2b84b', '#f4e17a', '#9fcf6a', '#4f9e5a', '#3a8a8a', '#4a86c8', '#3b4fa0', '#7a5bb5',
  '#c45b9a', '#f2a6c0', '#b7d8f0', '#cbe6c5', '#fff4c9', '#e9d8c4', '#8b6bb5', '#2e3a59', '#1f2a24', '#592a2a'];
function drawColor() { return C.cur === 'sub' ? C.sub : C.main; }
function drawHex() { return hex(drawColor()); }
function setCurColor(rgb, fromWheel) {
  if (C.cur === 'trans') C.cur = 'main';
  C[C.cur] = rgb.slice(0, 3);
  if (!fromWheel) { const h = rgb2hsv(rgb); if (h[1] === 0) h[0] = C.hsv[0]; C.hsv = h; }
  store.set(C.cur, C[C.cur]);
  if (typeof ColorUI !== 'undefined') ColorUI.update();
  if (typeof onColorChanged === 'function') onColorChanged();
}
function pushColorHistory() {
  if (C.cur === 'trans') return;
  const h = drawHex();
  C.history = [h, ...C.history.filter(x => x !== h)].slice(0, 20);
  store.set('colorhist', C.history);
  if (typeof ColorUI !== 'undefined') ColorUI.renderHistory();
}

/* ================= 레지스트리 ================= */
const HANDLERS = {};   // 포인터 도구: kind → {down, move, up, cancel}
const RENDERERS = {};  // 레이어 종류 → 캐시 렌더 함수(L)
const OVERLAYS = { doc: [], screen: [] };
const CMDS = {};
function cmd(id, label, keys, run, extra = {}) { CMDS[id] = { id, label, keys: keys ? [].concat(keys) : [], run, ...extra }; }
function runCmd(id) {
  const c = CMDS[id]; if (!c) return;
  if (c.enabled && !c.enabled()) return;
  try { const r = c.run(); if (r && r.catch) r.catch(e => { console.error(e); toast(e.message || String(e), true); }); }
  catch (e) { console.error(e); toast(e.message || String(e), true); }
}

/* ================= 문서 · 페이지 ================= */
const D = { w: 1600, h: 1200, dpi: 350, layers: [], activeId: 0, nameSeq: 1, name: '제목 없음', manga: null, anim: null, rulers: [], comps: [], selSaved: [], audio: null };
const PAGE_FIELDS = ['w', 'h', 'dpi', 'layers', 'activeId', 'nameSeq', 'name', 'manga', 'anim', 'rulers', 'comps', 'selSaved', 'audio'];
const P = { pages: [], index: 0, name: '제목 없음' };
let layerSeq = 1, revSeq = 1;
function defaultAnim() { return { fps: 12, length: 24, frame: 0, tracks: {}, camera: { on: false, keys: {} }, onion: { on: true, before: 1, after: 1 } }; }

const LAYER_TYPE_NAMES = { raster: '래스터', vector: '벡터', text: '텍스트', folder: '폴더', adjust: '보정', fill: '채우기', gradient: '그라데이션', '3d': '3D', paper: '용지' };
function defaultData(type) {
  switch (type) {
    case 'vector': return { strokes: [] };
    case 'text': return { objs: [] };
    case 'folder': return { open: true, anim: false, frame: null };
    case 'adjust': return { kind: 'hsl', params: {} };
    case 'fill': return { color: '#808080' };
    case 'gradient': return { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, shape: 'linear', from: '#000000', to: '#ffffff', toTrans: false };
    case '3d': return { objects: [], camera: null, mode: 'shade', lightAz: 40, lightEl: 50 };
    default: return {};
  }
}
function newLayer(o = {}) {
  const type = o.type || 'raster';
  const hasCanvas = type !== 'folder' && type !== 'adjust';
  const c = hasCanvas ? mkCanvas(D.w, D.h) : null;
  let name = o.name;
  if (!name) {
    name = type === 'folder' ? '폴더 ' + D.nameSeq : type === 'adjust' ? (ADJUST[(o.data && o.data.kind) || 'hsl'].label + ' ' + D.nameSeq)
      : type === 'fill' ? '채우기 ' + D.nameSeq : type === 'gradient' ? '그라데이션 ' + D.nameSeq : type === '3d' ? '3D ' + D.nameSeq : '레이어 ' + D.nameSeq;
    D.nameSeq++;
  }
  const L = Object.assign({
    id: layerSeq++, type, name, canvas: c, ctx: c && c.getContext('2d'), parent: 0,
    opacity: 1, blend: type === 'folder' ? 'pass' : 'source-over', visible: true, locked: false, alphaLock: false, clip: false, draft: false, ref: false,
    color: null, mask: null, maskOn: true, maskEdit: false, quickmask: false,
    fx: { color: null, border: null, tone: null }, data: defaultData(type), keys: null, rev: revSeq++, renderedRev: 0,
  }, o, { name });
  if (o.data) L.data = Object.assign(defaultData(type), o.data);
  if (o.fx) L.fx = Object.assign({ color: null, border: null, tone: null }, o.fx);
  if (type === 'paper') paintPaper(L);
  else if (RENDERERS[type] && type !== 'raster') { RENDERERS[type](L); L.renderedRev = L.rev; }
  return L;
}
function paintPaper(L) { L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.fillStyle = L.color || '#ffffff'; L.ctx.fillRect(0, 0, D.w, D.h); }
RENDERERS.fill = L => { L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.fillStyle = L.data.color || '#808080'; L.ctx.fillRect(0, 0, D.w, D.h); };
RENDERERS.paper = L => paintPaper(L);
RENDERERS.gradient = L => {
  const d = L.data, x = L.ctx;
  x.clearRect(0, 0, D.w, D.h);
  const len = Math.max(1, Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y));
  const g = d.shape === 'radial' ? x.createRadialGradient(d.a.x, d.a.y, 0, d.a.x, d.a.y, len) : x.createLinearGradient(d.a.x, d.a.y, d.b.x, d.b.y);
  const f = parseHex(d.from) || [0, 0, 0];
  g.addColorStop(0, d.from);
  g.addColorStop(1, d.toTrans ? `rgba(${f.join(',')},0)` : d.to);
  x.fillStyle = g; x.fillRect(0, 0, D.w, D.h);
};
function refreshLayer(L) {
  const r = RENDERERS[L.type];
  if (r && L.type !== 'raster') r(L);
  L.renderedRev = L.rev;
  markDirty(); queueThumb(L);
}
function bumpLayer(L) { L.rev = revSeq++; refreshLayer(L); }

const findLayer = id => D.layers.find(L => L.id === id);
const kids = pid => D.layers.filter(L => L.parent === pid);
function active() { return findLayer(D.activeId) || D.layers[D.layers.length - 1]; }
function layerIndex(L) { return D.layers.indexOf(L); }
function ancestors(L) { const a = []; let p = L.parent, guard = 0; while (p && guard++ < 64) { const f = findLayer(p); if (!f) break; a.push(f); p = f.parent; } return a; }
function descendants(F) { const out = []; const walk = id => { for (const L of kids(id)) { out.push(L); if (L.type === 'folder') walk(L.id); } }; walk(F.id); return out; }
function shownInTree(L) { return L.visible && ancestors(L).every(f => f.visible); }
function isPaintable(L) { return L && (L.type === 'raster' || L.type === 'vector'); }
// 표시 순서(위→아래)로 펼친 트리
function treeOrder() {
  const out = [];
  const walk = (pid, depth) => { const k = kids(pid); for (let i = k.length - 1; i >= 0; i--) { out.push({ L: k[i], depth }); if (k[i].type === 'folder' && k[i].data.open) walk(k[i].id, depth + 1); } };
  walk(0, 0);
  return out;
}

/* ================= 보정 레이어 ================= */
function curveLUT(pts) {
  // 단조 3차 보간 (Fritsch–Carlson)
  const p = pts.slice().sort((a, b) => a[0] - b[0]);
  const n = p.length, lut = new Uint8ClampedArray(256);
  if (n < 2) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = Math.max(1e-6, p[i + 1][0] - p[i][0]); dy[i] = (p[i + 1][1] - p[i][1]) / dx[i]; }
  m[0] = dy[0]; m[n - 1] = dy[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = dy[i - 1] * dy[i] <= 0 ? 0 : (dy[i - 1] + dy[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (dy[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / dy[i], b = m[i + 1] / dy[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * dy[i]; m[i + 1] = t * b * dy[i]; }
  }
  for (let x = 0; x < 256; x++) {
    let i = 0;
    if (x <= p[0][0]) { lut[x] = p[0][1]; continue; }
    if (x >= p[n - 1][0]) { lut[x] = p[n - 1][1]; continue; }
    while (i < n - 2 && x > p[i + 1][0]) i++;
    const h = dx[i], t = (x - p[i][0]) / h, t2 = t * t, t3 = t2 * t;
    lut[x] = (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h * m[i + 1];
  }
  return lut;
}
function gradStopsLUT(stops) {
  const s = stops.map(([t, c]) => [t, parseHex(c) || [0, 0, 0]]).sort((a, b) => a[0] - b[0]);
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0; while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const a = s[k], b = s[Math.min(k + 1, s.length - 1)];
    const f = b[0] === a[0] ? 0 : clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = lerp(a[1][c], b[1][c], f);
  }
  return lut;
}
const ADJUST = {
  bc: { label: '밝기·대비', defaults: { b: 0, c: 0 },
    make(p) { const c = p.c * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), b = p.b * 1.28, lut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) lut[i] = f * (i - 128) + 128 + b; return d => lutRGB(d, lut); } },
  hsl: { label: '색조·채도·명도', defaults: { h: 0, s: 0, l: 0 },
    make(p) {
      const dh = p.h / 360, ds = p.s / 100, dl = p.l / 100;
      return d => { for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        let [h, s, l] = rgb2hsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
        h = (h + dh + 1) % 1;
        s = ds >= 0 ? (s > 0 ? s + (1 - s) * ds : 0) : s * (1 + ds);
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        const [r, g, b] = hsl2rgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
      } };
    } },
  levels: { label: '레벨 보정', defaults: { inB: 0, inW: 255, gamma: 1, outB: 0, outW: 255 },
    make(p) { const lut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) { const t = clamp((i - p.inB) / Math.max(1, p.inW - p.inB), 0, 1); lut[i] = p.outB + Math.pow(t, 1 / p.gamma) * (p.outW - p.outB); } return d => lutRGB(d, lut); } },
  curve: { label: '톤 커브', defaults: { pts: [[0, 0], [64, 52], [192, 204], [255, 255]] },
    make(p) { const lut = curveLUT(p.pts); return d => lutRGB(d, lut); } },
  balance: { label: '컬러 밸런스', defaults: { sh: [0, 0, 0], mid: [0, 0, 0], hi: [0, 0, 0], keepLum: true },
    make(p) {
      return d => { for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2], lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const ws = clamp(1 - lum * 3, 0, 1) * .7 + .3 * (1 - lum), wh = clamp(lum * 3 - 2, 0, 1) * .7 + .3 * lum, wm = 1 - Math.abs(lum - .5) * 2;
        let nr = r + (p.sh[0] * ws + p.mid[0] * wm + p.hi[0] * wh) * 1.28;
        let ng = g + (p.sh[1] * ws + p.mid[1] * wm + p.hi[1] * wh) * 1.28;
        let nb = b + (p.sh[2] * ws + p.mid[2] * wm + p.hi[2] * wh) * 1.28;
        if (p.keepLum) { const l2 = 0.299 * nr + 0.587 * ng + 0.114 * nb, k = lum * 255 - l2; nr += k; ng += k; nb += k; }
        d[i] = nr; d[i + 1] = ng; d[i + 2] = nb;
      } };
    } },
  invert: { label: '계조 반전', defaults: {}, make() { return d => { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } }; } },
  posterize: { label: '포스터화', defaults: { n: 4 }, make(p) { const n = Math.max(1, p.n - 1), lut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) lut[i] = Math.round(i / 255 * n) / n * 255; return d => lutRGB(d, lut); } },
  binarize: { label: '2치화', defaults: { t: 128 }, make(p) { return d => { for (let i = 0; i < d.length; i += 4) { const v = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) >= p.t ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v; } }; } },
  gradmap: { label: '그라데이션 맵', defaults: { stops: [[0, '#1d1b3a'], [0.5, '#b8577a'], [1, '#ffe7b0']] },
    make(p) { const lut = gradStopsLUT(p.stops); return d => { for (let i = 0; i < d.length; i += 4) { const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); d[i] = lut[v * 3]; d[i + 1] = lut[v * 3 + 1]; d[i + 2] = lut[v * 3 + 2]; } }; } },
};
function lutRGB(d, lut) { for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; } }
const adjCache = new WeakMap();
function adjustFn(L) {
  const key = JSON.stringify(L.data);
  const c = adjCache.get(L);
  if (c && c.key === key) return c.fn;
  const def = ADJUST[L.data.kind] || ADJUST.hsl;
  const fn = def.make(Object.assign({}, def.defaults, L.data.params));
  adjCache.set(L, { key, fn });
  return fn;
}

/* ================= 합성 ================= */
const T = {
  pool: new Map(),
  get(k) {
    let c = this.pool.get(k);
    if (!c || c.canvas.width !== D.w || c.canvas.height !== D.h) {
      const cv = mkCanvas(D.w, D.h);
      c = { canvas: cv, ctx: cv.getContext('2d', k === 'read' ? { willReadFrequently: true } : undefined) };
      this.pool.set(k, c);
    }
    return c;
  },
  reset() { this.pool.clear(); },
};
const comp = { canvas: null, ctx: null, dirty: null };
const Sel = { canvas: null, ctx: null, has: false, path: null, bbox: null };
// 활성 레이어 미리보기: overlay(브러시 버퍼 등), replace(필터 결과), float(이동·변형). target: 'canvas' | 'mask'
const A = { layerId: 0, overlay: null, replace: null, float: null, target: 'canvas' };

function markDirty(r) {
  if (!comp.canvas) return;
  r = Rect.clip(r || Rect.full());
  if (!r) return;
  comp.dirty = Rect.union(comp.dirty, r);
  navDirty = true;
  requestRender();
}
let paperTile = null;
function paperPattern(ctx) {
  if (!paperTile) {
    const s = 128, c = mkCanvas(s, s), x = c.getContext('2d'), id = x.createImageData(s, s);
    const raw = new Float32Array(s * s);
    for (let i = 0; i < raw.length; i++) raw[i] = Math.random();
    for (let y = 0; y < s; y++) for (let xx = 0; xx < s; xx++) {
      let v = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) v += raw[((y + dy + s) % s) * s + ((xx + dx + s) % s)];
      v = v / 9 * .55 + raw[y * s + xx] * .45;
      id.data[(y * s + xx) * 4 + 3] = clamp(.25 + v, 0, 1) * 255;
    }
    x.putImageData(id, 0, 0);
    paperTile = c;
  }
  return ctx.createPattern(paperTile, 'repeat');
}
// 브러시 버퍼에 색 · 종이 질감 · 수채 경계 · 선택 범위를 적용한 캔버스
function prepOverlay(o, r) {
  const sel = o.useSel && Sel.has;
  if (!o.color && !o.texture && !sel && !o.wetEdge && !o.tail) return o.canvas;
  const tt = T.get('tmp'), t = tt.ctx;
  t.save(); t.beginPath(); t.rect(r.x, r.y, r.w, r.h); t.clip(); t.clearRect(r.x, r.y, r.w, r.h);
  if (o.wetEdge) {
    // 수채 경계: 가장자리를 진하게 (원본 일부 + 원본에서 흐린 사본을 뺀 띠)
    const e = T.get('wet'), ex = e.ctx, bl = Math.max(2, o.wetEdge * 10);
    ex.save(); ex.beginPath(); ex.rect(r.x, r.y, r.w, r.h); ex.clip(); ex.clearRect(r.x, r.y, r.w, r.h);
    ex.drawImage(o.canvas, 0, 0);
    ex.globalCompositeOperation = 'destination-out';
    blurDraw(ex, o.canvas, bl, r);
    ex.restore();
    t.globalAlpha = 1 - o.wetEdge * .45; t.drawImage(o.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    t.globalAlpha = 1; t.globalCompositeOperation = 'lighter';
    t.drawImage(e.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    t.globalCompositeOperation = 'source-over';
  } else t.drawImage(o.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  // 손떨림 보정으로 아직 덜 그려진 끝부분 (손을 떼면 실제로 그려질 부분)
  if (o.tail) t.drawImage(o.tail, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  if (o.color) { t.globalCompositeOperation = 'source-in'; t.fillStyle = o.color; t.fillRect(r.x, r.y, r.w, r.h); }
  if (o.texture) { t.globalCompositeOperation = 'destination-in'; t.fillStyle = paperPattern(t); t.fillRect(r.x, r.y, r.w, r.h); }
  if (sel) { t.globalCompositeOperation = 'destination-in'; t.drawImage(Sel.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); }
  t.restore();
  return tt.canvas;
}
// 축소·확대로 흐리게 그리기 (모든 브라우저에서 동작)
function blurDraw(ctx, src, radius, r) {
  const f = Math.max(1, radius / 2);
  const w = Math.max(1, Math.ceil(r.w / f) + 4), h = Math.max(1, Math.ceil(r.h / f) + 4);
  const s = blurDraw.c || (blurDraw.c = mkCanvas(8, 8));
  if (s.width < w || s.height < h) { s.width = Math.max(s.width, w); s.height = Math.max(s.height, h); }
  const sx = s.getContext('2d');
  sx.clearRect(0, 0, s.width, s.height);
  sx.imageSmoothingQuality = 'high';
  sx.drawImage(src, r.x - 2 * f, r.y - 2 * f, w * f, h * f, 0, 0, w, h);
  ctx.save(); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, 0, 0, w, h, r.x - 2 * f, r.y - 2 * f, w * f, h * f);
  ctx.restore();
}
function frameOf(opts) { return opts && opts.frame != null ? opts.frame : (D.anim ? D.anim.frame : 0); }
function included(L, opts) {
  if (!L.visible) return false;
  if (opts.excludeDraft && L.draft) return false;
  if (opts.onlyRef && !L.ref && L.type !== 'folder') return false;
  if (opts.excludePaper && L.type === 'paper') return false;
  if (opts.export && L.quickmask) return false;
  return true;
}
function maskSource(L, r) {
  if (!(A.layerId === L.id && A.target === 'mask' && (A.overlay || A.float || A.replace))) return L.mask;
  const m = T.get('maskp'), mx = m.ctx;
  mx.save(); mx.beginPath(); mx.rect(r.x, r.y, r.w, r.h); mx.clip(); mx.clearRect(r.x, r.y, r.w, r.h);
  mx.drawImage(A.replace || L.mask, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  if (A.overlay) {
    const o = A.overlay, src = prepOverlay(o, r);
    mx.globalAlpha = o.alpha; mx.globalCompositeOperation = o.mode === 'destination-out' ? 'destination-out' : 'source-over';
    mx.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
  if (A.float && typeof drawFloat === 'function') { mx.globalAlpha = 1; mx.globalCompositeOperation = 'source-over'; mx.save(); drawFloat(mx, A.float); mx.restore(); }
  mx.restore();
  return m.canvas;
}
function layerSource(L, r, opts, slot) {
  const preview = !opts.raw && A.layerId === L.id && (A.overlay || A.replace || A.float);
  const onCanvas = preview && A.target !== 'mask';
  const xf = typeof Anim !== 'undefined' ? Anim.layerXform(L, frameOf(opts)) : null;
  const fx = L.fx && (L.fx.color || L.fx.border || L.fx.tone) && !opts.noFx;
  const useMask = L.mask && L.maskOn;
  if (!onCanvas && !xf && !fx && !useMask && !(preview && A.target === 'mask')) return L.canvas;
  const sl = T.get(slot), s = sl.ctx;
  const bw = fx && L.fx.border ? Math.ceil(L.fx.border.w) + 2 : 0;
  const rr = Rect.clip(Rect.grow(r, bw)) || r;
  s.save(); s.beginPath(); s.rect(rr.x, rr.y, rr.w, rr.h); s.clip(); s.clearRect(rr.x, rr.y, rr.w, rr.h);
  const content = (onCanvas && A.replace) || L.canvas;
  if (xf) { s.setTransform(xf); s.drawImage(content, 0, 0); s.setTransform(1, 0, 0, 1, 0, 0); }
  else s.drawImage(content, rr.x, rr.y, rr.w, rr.h, rr.x, rr.y, rr.w, rr.h);
  if (onCanvas && A.overlay) {
    const o = A.overlay, src = prepOverlay(o, rr);
    s.globalAlpha = o.alpha; s.globalCompositeOperation = o.mode;
    s.drawImage(src, rr.x, rr.y, rr.w, rr.h, rr.x, rr.y, rr.w, rr.h);
    s.globalAlpha = 1; s.globalCompositeOperation = 'source-over';
  }
  if (onCanvas && A.float && typeof drawFloat === 'function') { s.save(); drawFloat(s, A.float); s.restore(); }
  if (fx) applyLayerFx(sl, L, rr);
  if (useMask) {
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(maskSource(L, rr), rr.x, rr.y, rr.w, rr.h, rr.x, rr.y, rr.w, rr.h);
  }
  s.restore();
  return sl.canvas;
}
function applyLayerFx(sl, L, r) {
  const s = sl.ctx, fx = L.fx;
  if (fx.color) { s.globalCompositeOperation = 'source-in'; s.fillStyle = fx.color; s.fillRect(r.x, r.y, r.w, r.h); s.globalCompositeOperation = 'source-over'; }
  if (fx.tone) halftone(s, r, fx.tone);
  if (fx.border && fx.border.w > 0) {
    const o = T.get('fx'), ox = o.ctx, w = fx.border.w, n = Math.max(12, Math.ceil(w * 2.2));
    ox.save(); ox.beginPath(); ox.rect(r.x, r.y, r.w, r.h); ox.clip(); ox.clearRect(r.x, r.y, r.w, r.h);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; ox.drawImage(sl.canvas, Math.cos(a) * w, Math.sin(a) * w); }
    ox.globalCompositeOperation = 'source-in'; ox.fillStyle = fx.border.color || '#ffffff'; ox.fillRect(r.x, r.y, r.w, r.h);
    ox.restore();
    s.globalCompositeOperation = 'destination-over';
    s.drawImage(o.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    s.globalCompositeOperation = 'source-over';
  }
}
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// 스크린톤: 농도(1-명도)×알파 → 망점
function halftone(s, r, t) {
  const id = s.getImageData(r.x, r.y, r.w, r.h), d = id.data;
  const cell = Math.max(2, D.dpi / Math.max(5, t.lpi || 60));
  const ang = (t.angle ?? 45) * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang), k = Math.PI * 2 / cell;
  const ink = parseHex(t.color || '#000000') || [0, 0, 0], shape = t.shape || 'dot', sharp = cell * .45;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = (y * r.w + x) * 4, a = d[i + 3] / 255;
    if (!a) continue;
    const dens = (1 - (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255) * a;
    const gx = r.x + x, gy = r.y + y, u = (gx * ca + gy * sa) * k, v = (-gx * sa + gy * ca) * k;
    const th = shape === 'line' ? .5 - .5 * Math.cos(v) : shape === 'noise' ? hash2(gx, gy) : .5 - .25 * (Math.cos(u) + Math.cos(v));
    const cov = shape === 'noise' ? (dens > th ? 1 : 0) : clamp((dens - th) * sharp + .5, 0, 1);
    d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = cov * 255;
  }
  s.putImageData(id, r.x, r.y);
}
function blit(tc, src, L, r, opts) {
  const op = typeof Anim !== 'undefined' ? Anim.keyValue(L, 'opacity', frameOf(opts), 1) : 1;
  tc.globalAlpha = clamp(L.opacity * op, 0, 1);
  tc.globalCompositeOperation = L.blend === 'pass' ? 'source-over' : L.blend;
  tc.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over';
}
function applyAdjustLayer(tc, L, r, base, opts) {
  const g = T.get('adj'), gx = g.ctx;
  gx.save(); gx.beginPath(); gx.rect(r.x, r.y, r.w, r.h); gx.clip(); gx.clearRect(r.x, r.y, r.w, r.h);
  gx.drawImage(tc.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  const id = gx.getImageData(r.x, r.y, r.w, r.h);
  adjustFn(L)(id.data);
  gx.putImageData(id, r.x, r.y);
  if (L.mask && L.maskOn) { gx.globalCompositeOperation = 'destination-in'; gx.drawImage(maskSource(L, r), r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); }
  if (L.clip && base) { gx.globalCompositeOperation = 'destination-in'; gx.drawImage(base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); }
  gx.restore();
  const op = typeof Anim !== 'undefined' ? Anim.keyValue(L, 'opacity', frameOf(opts), 1) : 1;
  tc.globalAlpha = clamp(L.opacity * op, 0, 1);
  tc.drawImage(g.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  tc.globalAlpha = 1;
}
function renderLevel(tc, pid, r, opts, depth) {
  let base = null;
  const parent = pid ? findLayer(pid) : null;
  const animMode = parent && parent.type === 'folder' && parent.data.anim && typeof Anim !== 'undefined';
  const f = frameOf(opts);
  const celId = animMode ? Anim.celAt(parent, f) : null;
  const onion = animMode && opts.onion ? Anim.onionCels(parent, f) : null;
  for (const L of kids(pid)) {
    let inc = included(L, opts);
    if (animMode && L.id !== celId) {
      if (inc && onion && onion.has(L.id)) {
        const o = onion.get(L.id), src = layerSource(L, r, opts, 'on' + depth), ox = T.get('onion').ctx;
        ox.save(); ox.beginPath(); ox.rect(r.x, r.y, r.w, r.h); ox.clip(); ox.clearRect(r.x, r.y, r.w, r.h);
        ox.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
        ox.globalCompositeOperation = 'source-in'; ox.fillStyle = o.color; ox.fillRect(r.x, r.y, r.w, r.h); ox.restore();
        tc.globalAlpha = o.alpha; tc.drawImage(T.get('onion').canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); tc.globalAlpha = 1;
      }
      inc = false;
    }
    if (L.type === 'adjust') { if (inc) applyAdjustLayer(tc, L, r, L.clip ? base : null, opts); if (!L.clip) base = null; continue; }
    let src = null;
    if (L.type === 'folder') {
      if (!inc) { if (!L.clip) base = null; continue; }
      const simple = L.blend === 'pass' && L.opacity === 1 && !(L.mask && L.maskOn) && !L.data.frame && !L.clip && !(L.keys && Object.keys(L.keys).length) && !(L.fx && (L.fx.color || L.fx.tone || L.fx.border));
      if (simple) { renderLevel(tc, L.id, r, opts, depth + 1); base = null; continue; }
      const g = T.get('grp' + depth), gx = g.ctx;
      gx.save(); gx.beginPath(); gx.rect(r.x, r.y, r.w, r.h); gx.clip(); gx.clearRect(r.x, r.y, r.w, r.h);
      renderLevel(gx, L.id, r, opts, depth + 1);
      if (L.data.frame && typeof Manga !== 'undefined') Manga.applyFrame(gx, L, r);
      if (L.mask && L.maskOn) { gx.globalCompositeOperation = 'destination-in'; gx.drawImage(maskSource(L, r), r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); gx.globalCompositeOperation = 'source-over'; }
      if (L.data.frame && typeof Manga !== 'undefined') Manga.drawBorders(gx, L);
      if (L.fx && (L.fx.color || L.fx.tone || L.fx.border)) applyLayerFx(g, L, r);
      gx.restore();
      src = g.canvas;
    }
    if (!L.clip) {
      base = inc ? (src || layerSource(L, r, opts, 'bs' + depth)) : null;
      if (base) blit(tc, base, L, r, opts);
    } else if (inc && base) {
      const s2 = src || layerSource(L, r, opts, 'cs' + depth), ct = T.get('clip' + depth), cx = ct.ctx;
      cx.save(); cx.beginPath(); cx.rect(r.x, r.y, r.w, r.h); cx.clip(); cx.clearRect(r.x, r.y, r.w, r.h);
      cx.drawImage(s2, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      cx.globalCompositeOperation = 'destination-in';
      cx.drawImage(base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      cx.restore();
      blit(tc, ct.canvas, L, r, opts);
    }
  }
}
/* opts: raw(미리보기 무시), excludeDraft, onlyRef, excludePaper, export, frame, onion, noFx */
function compositeInto(tc, r, opts = {}) {
  tc.save(); tc.beginPath(); tc.rect(r.x, r.y, r.w, r.h); tc.clip(); tc.clearRect(r.x, r.y, r.w, r.h);
  renderLevel(tc, 0, r, opts, 0);
  tc.restore();
}
function flushComposite() {
  if (!comp.dirty) return;
  compositeInto(comp.ctx, comp.dirty, { onion: typeof Anim !== 'undefined' && Anim.showOnion() });
  comp.dirty = null;
}

/* ================= 뷰포트 ================= */
const vc = $('#view'), vx = vc.getContext('2d');
const V = { zoom: 1, rot: 0, flip: false, cx: 800, cy: 600, w: 800, h: 600, dpr: 1 };
function vm() { return new DOMMatrix().translate(V.w / 2, V.h / 2).rotate(V.rot).scale(V.zoom * (V.flip ? -1 : 1), V.zoom).translate(-V.cx, -V.cy); }
function s2d(x, y) { const p = vm().inverse().transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; }
function d2s(x, y) { const p = vm().transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; }
function viewChanged() { if (typeof NavUI !== 'undefined') NavUI.sync(); if (typeof updateStatus === 'function') updateStatus(); requestRender(); }
function zoomAt(z, sx, sy) {
  if (sx == null) { sx = V.w / 2; sy = V.h / 2; }
  const a = s2d(sx, sy);
  V.zoom = clamp(z, .02, 64);
  const b = s2d(sx, sy);
  V.cx += a.x - b.x; V.cy += a.y - b.y;
  viewChanged();
}
const ZOOM_STEPS = [.02, .03, .05, .0625, .083, .1, .125, .167, .25, .333, .5, .667, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
function zoomStep(dir, sx, sy) {
  const z = dir > 0 ? (ZOOM_STEPS.find(s => s > V.zoom * 1.001) || 64) : ([...ZOOM_STEPS].reverse().find(s => s < V.zoom * .999) || .02);
  zoomAt(z, sx, sy);
}
function fitView() {
  const m = 28;
  V.zoom = clamp(Math.min((V.w - m * 2) / D.w, (V.h - m * 2) / D.h), .02, 64);
  V.cx = D.w / 2; V.cy = D.h / 2;
  viewChanged();
}
function rotateTo(deg) {
  const a = s2d(V.w / 2, V.h / 2);
  V.rot = ((deg + 540) % 360) - 180;
  const b = s2d(V.w / 2, V.h / 2);
  V.cx += a.x - b.x; V.cy += a.y - b.y;
  viewChanged();
}
function resizeView() {
  const r = vc.getBoundingClientRect();
  V.dpr = window.devicePixelRatio || 1;
  V.w = Math.max(1, r.width); V.h = Math.max(1, r.height);
  vc.width = Math.round(V.w * V.dpr); vc.height = Math.round(V.h * V.dpr);
  requestRender();
}
let raf = 0, navDirty = true, lastNav = 0, antPhase = 0, hover = null, drag = null;
const VIEW = { grid: false, gridSize: 100 };
function requestRender() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(t) {
  raf = 0;
  if (!comp.canvas) return;
  flushComposite();
  drawView();
  if (navDirty && t - lastNav > 120) { if (typeof NavUI !== 'undefined') NavUI.draw(); navDirty = false; lastNav = t; }
  else if (navDirty) requestRender();
}
let checker = null;
function checkerPattern() {
  if (!checker) {
    const c = mkCanvas(16, 16), x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 16, 16); x.fillStyle = '#cfcfcf'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    checker = vx.createPattern(c, 'repeat');
  }
  return checker;
}
function drawView() {
  const ctx = vx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#46484d';
  ctx.fillRect(0, 0, vc.width, vc.height);
  ctx.setTransform(new DOMMatrix([V.dpr, 0, 0, V.dpr, 0, 0]).multiply(vm()));
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 16 * V.dpr;
  const pat = checkerPattern();
  pat.setTransform(new DOMMatrix().scale(1 / V.zoom));
  ctx.fillStyle = pat; ctx.fillRect(0, 0, D.w, D.h);
  ctx.restore();
  ctx.imageSmoothingEnabled = V.zoom < 3;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(comp.canvas, 0, 0);
  const px = 1 / V.zoom;
  const L = active();
  if (L && L.maskEdit && L.mask) {
    const m = T.get('masktint'), mx = m.ctx;
    mx.clearRect(0, 0, D.w, D.h); mx.fillStyle = '#7a3cff'; mx.fillRect(0, 0, D.w, D.h);
    mx.globalCompositeOperation = 'destination-out'; mx.drawImage(maskSource(L, Rect.full()), 0, 0); mx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = .35; ctx.drawImage(m.canvas, 0, 0); ctx.globalAlpha = 1;
  }
  if (VIEW.grid) {
    ctx.beginPath();
    for (let x = VIEW.gridSize; x < D.w; x += VIEW.gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, D.h); }
    for (let y = VIEW.gridSize; y < D.h; y += VIEW.gridSize) { ctx.moveTo(0, y); ctx.lineTo(D.w, y); }
    ctx.strokeStyle = 'rgba(70,140,220,.45)'; ctx.lineWidth = px; ctx.stroke();
  }
  for (const f of OVERLAYS.doc) { ctx.save(); try { f(ctx, px); } catch (e) { console.error(e); } ctx.restore(); }
  if (Sel.has && Sel.path && !A.float) {
    ctx.lineWidth = px;
    ctx.strokeStyle = '#ffffff'; ctx.stroke(Sel.path);
    ctx.setLineDash([4 * px, 4 * px]); ctx.lineDashOffset = -antPhase * px;
    ctx.strokeStyle = '#000000'; ctx.stroke(Sel.path); ctx.setLineDash([]);
  }
  if (drag && drag.preview) { ctx.save(); drag.preview(ctx, px); ctx.restore(); }
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  for (const f of OVERLAYS.screen) { ctx.save(); try { f(ctx); } catch (e) { console.error(e); } ctx.restore(); }
  const drawing = drag && drag.kind === 'brush' && drag.stroke;
  if (hover && (!drag || drawing) && typeof effKind === 'function' && ['brush', 'blend', 'linefix'].includes(effKind())) {
    const b = curSub();
    // 그리는 중에는 지금 찍히는 실제 크기를 보여 준다
    const size = drawing && drag.stroke.lastSize ? drag.stroke.lastSize : (b.size || 10);
    const r = Math.max(.5, size / 2 * V.zoom);
    ctx.beginPath(); ctx.arc(hover.x, hover.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    if (!drawing && b.pSize && b.minSize < .95 && r > 4) {
      // 펜 필압이 약할 때의 최소 크기
      ctx.beginPath(); ctx.arc(hover.x, hover.y, Math.max(.5, r * b.minSize), 0, Math.PI * 2);
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.stroke(); ctx.setLineDash([]);
    }
    if (r < 4) { ctx.beginPath(); ctx.moveTo(hover.x - 6, hover.y); ctx.lineTo(hover.x + 6, hover.y); ctx.moveTo(hover.x, hover.y - 6); ctx.lineTo(hover.x, hover.y + 6); ctx.stroke(); }
  }
}
setInterval(() => { if (Sel.has && !A.float) { antPhase = (antPhase + 1) % 8; requestRender(); } }, 110);

/* ================= 작업 내역 ================= */
const H = {
  stack: [], idx: 0, limit: 80,
  push(c) {
    this.stack.length = this.idx; this.stack.push(c);
    if (this.stack.length > this.limit) this.stack.shift();
    this.idx = this.stack.length; afterHistory();
  },
  undo() { if (historyBusy()) return; if (this.idx > 0) { this.stack[--this.idx].undo(); afterHistory(); } },
  redo() { if (historyBusy()) return; if (this.idx < this.stack.length) { this.stack[this.idx++].redo(); afterHistory(); } },
  jump(i) { if (historyBusy()) return; while (this.idx > i) this.stack[--this.idx].undo(); while (this.idx < i) this.stack[this.idx++].redo(); afterHistory(); },
  clear() { this.stack = []; this.idx = 0; afterHistory(true); },
};
let dirtySinceSave = false;
const Busy = { filter: false, text: false };
function historyBusy() {
  if (A.float) { if (typeof cancelFloat === 'function') cancelFloat(); return true; }
  if (Busy.text && typeof Text !== 'undefined') { Text.commitEditor(); }
  return !!drag || Busy.filter;
}
function afterHistory(silent) {
  if (typeof HistUI !== 'undefined') HistUI.render();
  if (typeof updateCmdStates === 'function') updateCmdStates();
  if (!silent) { dirtySinceSave = true; if (typeof Autosave !== 'undefined') Autosave.schedule(); }
}
function pixCmd(label, L, r, before, after, which = 'canvas') {
  const put = c => {
    const target = which === 'mask' ? L.mask : L.canvas;
    if (!target) return;
    const x = target.getContext('2d');
    x.clearRect(r.x, r.y, r.w, r.h); x.drawImage(c, r.x, r.y);
    markDirty(r); queueThumb(L);
  };
  return { label, undo: () => put(before), redo: () => put(after) };
}
const PROPS = ['name', 'type', 'parent', 'opacity', 'blend', 'visible', 'locked', 'alphaLock', 'clip', 'draft', 'ref', 'color', 'maskOn', 'quickmask'];
function snapData(L) {
  if (L.type === 'vector') return { ...L.data, strokes: L.data.strokes.slice() };
  return structuredClone(L.data);
}
function restoreData(L, d) { L.data = L.type === 'vector' ? { ...d, strokes: d.strokes.slice() } : structuredClone(d); }
function snapDoc(pix = []) {
  const animClone = D.anim ? structuredClone(D.anim) : null;
  return {
    order: D.layers.slice(), active: D.activeId,
    layers: new Map(D.layers.map(L => [L, { props: PROPS.map(k => L[k]), fx: structuredClone(L.fx), keys: L.keys ? structuredClone(L.keys) : null, data: snapData(L), rev: L.rev, mask: L.mask }])),
    pix: pix.map(p => { const [L, which] = Array.isArray(p) ? p : [p, 'canvas']; const src = which === 'mask' ? L.mask : L.canvas; return src ? { L, which, c: cloneCanvas(src) } : null; }).filter(Boolean),
    rulers: structuredClone(D.rulers), anim: animClone, comps: structuredClone(D.comps),
  };
}
function applyDoc(s) {
  D.layers = s.order.slice();
  for (const [L, v] of s.layers) {
    PROPS.forEach((k, i) => { L[k] = v.props[i]; });
    L.fx = structuredClone(v.fx); L.keys = v.keys ? structuredClone(v.keys) : null;
    restoreData(L, v.data); L.mask = v.mask; L.rev = v.rev;
    if (!L.mask) L.maskEdit = false;
  }
  for (const p of s.pix) { const t = p.which === 'mask' ? p.L.mask : p.L.canvas; if (t) { const x = t.getContext('2d'); x.clearRect(0, 0, D.w, D.h); x.drawImage(p.c, 0, 0); } queueThumb(p.L); }
  D.rulers = structuredClone(s.rulers); if (s.anim) { const fr = D.anim ? D.anim.frame : 0; D.anim = structuredClone(s.anim); D.anim.frame = fr; } D.comps = structuredClone(s.comps);
  D.activeId = s.active;
  for (const L of D.layers) if (L.renderedRev !== L.rev) refreshLayer(L);
  markDirty();
  if (typeof renderLayers === 'function') renderLayers();
  if (typeof Anim !== 'undefined') Anim.renderTimeline();
}
function structural(label, pix, fn) {
  const b = snapDoc(pix);
  if (fn() === false) return false;
  for (const L of D.layers) if (L.renderedRev !== L.rev) refreshLayer(L);
  const a = snapDoc(pix);
  H.push({ label, undo: () => applyDoc(b), redo: () => applyDoc(a) });
  markDirty();
  if (typeof renderLayers === 'function') renderLayers();
  for (const p of pix) queueThumb(Array.isArray(p) ? p[0] : p);
  return true;
}

/* ================= 썸네일 ================= */
const thumbQ = new Set(); let thumbTimer = 0;
function queueThumb(L) { if (!L) return; thumbQ.add(L); if (!thumbTimer) thumbTimer = setTimeout(flushThumbs, 180); }
function flushThumbs() { thumbTimer = 0; for (const L of thumbQ) drawThumb(L); thumbQ.clear(); }
function drawThumb(L) {
  if (!L.thumb) { L.thumb = mkCanvas(104, 78); L.thumb.className = 'lthumb'; }
  const t = L.thumb, x = t.getContext('2d');
  x.clearRect(0, 0, t.width, t.height);
  const s = Math.min(t.width / D.w, t.height / D.h), w = D.w * s, h = D.h * s, ox = (t.width - w) / 2, oy = (t.height - h) / 2;
  if (L.type === 'folder') {
    const r = Rect.full();
    // 폴더 썸네일은 폴더 내용만
    const tmp = T.get('thumbgrp2'); tmp.ctx.clearRect(0, 0, D.w, D.h); renderLevel(tmp.ctx, L.id, r, { raw: true }, 8);
    x.drawImage(tmp.canvas, ox, oy, w, h);
  } else if (L.type === 'adjust') {
    x.fillStyle = '#3a3d44'; x.fillRect(0, 0, t.width, t.height);
    const g = x.createLinearGradient(0, 0, t.width, 0); g.addColorStop(0, '#222'); g.addColorStop(1, '#eee');
    x.fillStyle = g; x.fillRect(14, 26, t.width - 28, 26);
  } else if (L.canvas) {
    x.imageSmoothingQuality = 'high';
    x.drawImage(L.canvas, ox, oy, w, h);
  }
  if (L.mask) {
    if (!L.mthumb) { L.mthumb = mkCanvas(52, 39); L.mthumb.className = 'lthumb mthumb'; }
    const m = L.mthumb.getContext('2d');
    m.fillStyle = '#000'; m.fillRect(0, 0, 52, 39);
    const ms = Math.min(52 / D.w, 39 / D.h);
    const mt = T.get('mthumb'); mt.ctx.clearRect(0, 0, D.w, D.h); mt.ctx.fillStyle = '#fff'; mt.ctx.fillRect(0, 0, D.w, D.h);
    mt.ctx.globalCompositeOperation = 'destination-in'; mt.ctx.drawImage(L.mask, 0, 0); mt.ctx.globalCompositeOperation = 'source-over';
    m.drawImage(mt.canvas, (52 - D.w * ms) / 2, (39 - D.h * ms) / 2, D.w * ms, D.h * ms);
  }
}
