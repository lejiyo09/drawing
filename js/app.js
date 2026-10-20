/* WebPaint Studio — 레이어 기반 웹 드로잉 앱
 * 구조: 문서 모델(D) → 레이어 합성(compositeInto) → 뷰포트(V) 표시.
 * 모든 도구는 활성 레이어 미리보기 상태(A)를 거쳐 레이어에 확정되고, 확정 시 작업 내역(H)에 기록된다. */
(function () {
'use strict';

/* ================= 유틸 ================= */
const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
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
  for (const c of kids.flat()) if (c != null) e.append(c);
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
  full() { return { x: 0, y: 0, w: D.w, h: D.h }; },
};
function toast(msg, err) {
  const t = el('div', { class: 'toast' + (err ? ' err' : ''), text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), err ? 4200 : 2400);
}
const store = {
  get(k, d) { try { const v = localStorage.getItem('webpaint:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('webpaint:' + k, JSON.stringify(v)); } catch { /* 저장 불가 환경 */ } },
};

/* ================= 컬러 ================= */
const hex = c => '#' + c.map(v => (v | 0).toString(16).padStart(2, '0')).join('');
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
  C[C.cur] = rgb.slice();
  if (!fromWheel) { const h = rgb2hsv(rgb); if (h[1] === 0) h[0] = C.hsv[0]; C.hsv = h; }
  store.set(C.cur, C[C.cur]);
  ColorUI.update();
}
function pushColorHistory() {
  if (C.cur === 'trans') return;
  const h = drawHex();
  C.history = [h, ...C.history.filter(x => x !== h)].slice(0, 20);
  store.set('colorhist', C.history);
  ColorUI.renderHistory();
}

/* ================= 도구 정의 ================= */
const ICONS = {
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M10 7v6M7 10h6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-3 7-6.5 7-2.7 0-4.2-1.6-5.8-4.2l-1.3-2.2a1.5 1.5 0 012.5-1.6L8 15"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  select: '<path d="M4 7V4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4"/>',
  wand: '<path d="M4 20L14 10M16 3v3M21 8h-3M19.5 4.5l-2 2M12 6l1.5 1.5"/>',
  eyedropper: '<path d="M14.5 4.5l5 5M17 7l-9.5 9.5L4 20l3.5-3.5M13 6l5 5"/><path d="M16 3.5a2.1 2.1 0 013 3"/>',
  pen: '<path d="M4 20l3.5-1L19 7.5 16.5 5 5 16.5zM14.5 7l2.5 2.5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3M4 20l3-1"/>',
  brush: '<path d="M20 4c-2.5 1-7.5 6-9.5 9l1.5 1.5c3-2 8-7 8-10.5z"/><path d="M10 13.5c-2.5 0-4 1.6-4 3.6 0 1.4-.8 2.1-2 2.4 3.5 1.2 8 .3 8-3.8z"/>',
  airbrush: '<circle cx="6" cy="8" r="1"/><circle cx="10" cy="5" r="1"/><circle cx="9" cy="11" r="1.2"/><circle cx="14" cy="8" r="1"/><circle cx="5" cy="13" r=".8"/><path d="M13 13l7 7M15.5 11.5l1.5-1.5 4 4-1.5 1.5"/>',
  eraser: '<path d="M8 20h12M5.5 14.5l9-9 5 5-9 9H8z M10 10l5 5"/>',
  fill: '<path d="M5 11l6-6 8 8-6 6z M3 13h13"/><path d="M20 16c0 1.5 1 2.5 1 3.5a1 1 0 01-2 0c0-1 1-2 1-3.5z"/>',
  gradient: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M8 4v16M12 4v16M16 4v16" stroke-dasharray="1.5 2"/>',
};
const BR = o => Object.assign({ size: 10, opacity: 1, flow: 1, hardness: 1, spacing: .1, minSize: .2, pSize: true, pFlow: false, stab: 8, taperIn: 0, taperOut: 0, texture: false, tip: 'round', angle: 35, aspect: .3, eraser: false }, o);
const TOOLS = [
  { id: 'zoom', name: '돋보기', key: '/', icon: 'zoom', kind: 'zoom', subs: [{ id: 'zoom-in', name: '돋보기' }] },
  { id: 'hand', name: '손바닥', key: 'H', icon: 'hand', kind: 'hand', subs: [{ id: 'hand', name: '손바닥' }, { id: 'rotate', name: '회전', kind: 'rotate', key: 'R' }] },
  { id: 'move', name: '레이어 이동', key: 'K', icon: 'move', kind: 'move', subs: [{ id: 'move-layer', name: '레이어 이동' }] },
  '-',
  { id: 'select', name: '선택 범위', key: 'M', icon: 'select', kind: 'select', subs: [
    { id: 'sel-rect', name: '직사각형', shape: 'rect', mode: 'new' },
    { id: 'sel-ellipse', name: '타원', shape: 'ellipse', mode: 'new' },
    { id: 'sel-lasso', name: '올가미', shape: 'lasso', mode: 'new' },
  ] },
  { id: 'wand', name: '자동 선택', key: 'W', icon: 'wand', kind: 'wand', subs: [
    { id: 'wand-layer', name: '편집 레이어만 참조 선택', ref: 'layer', tolerance: 10, expand: 0, gap: 0, mode: 'new' },
    { id: 'wand-all', name: '다른 레이어를 참조 선택', ref: 'all', tolerance: 10, expand: 1, gap: 0, mode: 'new' },
  ] },
  { id: 'eyedropper', name: '스포이트', key: 'I', icon: 'eyedropper', kind: 'eyedropper', subs: [
    { id: 'eye-display', name: '표시색 취득', source: 'display' },
    { id: 'eye-layer', name: '레이어에서 색 취득', source: 'layer' },
  ] },
  '-',
  { id: 'pen', name: '펜', key: 'P', icon: 'pen', kind: 'brush', subs: [
    { id: 'gpen', name: 'G펜', ...BR({ size: 6, minSize: .06, spacing: .05, stab: 8, taperIn: 12, taperOut: 18 }) },
    { id: 'maru', name: '둥근 펜', ...BR({ size: 3, minSize: .45, spacing: .05, stab: 10 }) },
    { id: 'milli', name: '밀리펜', ...BR({ size: 4, pSize: false, spacing: .05, stab: 12 }) },
  ] },
  { id: 'pencil', name: '연필', key: 'P', icon: 'pencil', kind: 'brush', subs: [
    { id: 'pencil', name: '연필', ...BR({ size: 5, hardness: .85, flow: .45, pFlow: true, minSize: .6, spacing: .14, texture: true, stab: 4 }) },
    { id: 'sharp', name: '샤프펜슬', ...BR({ size: 2.5, hardness: .95, flow: .7, pFlow: true, minSize: .7, spacing: .1, texture: true, stab: 4 }) },
  ] },
  { id: 'brush', name: '붓', key: 'B', icon: 'brush', kind: 'brush', subs: [
    { id: 'round-brush', name: '둥근 붓', ...BR({ size: 26, hardness: .65, flow: .3, pFlow: true, minSize: .25, spacing: .08, stab: 6 }) },
    { id: 'flat-brush', name: '평붓', ...BR({ size: 30, tip: 'flat', flow: .85, minSize: .5, spacing: .04, stab: 6 }) },
  ] },
  { id: 'airbrush', name: '에어브러시', key: 'B', icon: 'airbrush', kind: 'brush', subs: [
    { id: 'air-soft', name: '부드러움', ...BR({ size: 120, hardness: 0, flow: .06, pFlow: true, pSize: false, spacing: .06, stab: 0 }) },
    { id: 'air-hard', name: '강함', ...BR({ size: 50, hardness: .45, flow: .18, pFlow: true, pSize: false, spacing: .06, stab: 0 }) },
  ] },
  { id: 'eraser', name: '지우개', key: 'E', icon: 'eraser', kind: 'brush', subs: [
    { id: 'eraser-hard', name: '딱딱함', ...BR({ size: 24, eraser: true, minSize: .5, spacing: .05, stab: 2 }) },
    { id: 'eraser-soft', name: '부드러움', ...BR({ size: 80, hardness: 0, flow: .25, pFlow: true, pSize: false, eraser: true, spacing: .06, stab: 0 }) },
  ] },
  '-',
  { id: 'fill', name: '채우기', key: 'G', icon: 'fill', kind: 'fill', subs: [
    { id: 'fill-layer', name: '편집 레이어만 참조', ref: 'layer', tolerance: 10, expand: 0, gap: 0, opacity: 1 },
    { id: 'fill-all', name: '다른 레이어 참조', ref: 'all', tolerance: 10, expand: 2, gap: 0, opacity: 1 },
  ] },
  { id: 'gradient', name: '그라데이션', key: 'G', icon: 'gradient', kind: 'gradient', subs: [
    { id: 'grad-sub', name: '그리기색에서 배경색', to: 'sub', shape: 'linear', opacity: 1 },
    { id: 'grad-trans', name: '그리기색에서 투명색', to: 'trans', shape: 'linear', opacity: 1 },
  ] },
];
const TOOL_LIST = TOOLS.filter(t => t !== '-');
// 사용자 설정 덮어쓰기 복원
const savedSubs = store.get('subs', {});
for (const t of TOOL_LIST) for (const s of t.subs) if (savedSubs[s.id]) Object.assign(s, savedSubs[s.id]);
function saveSubs() {
  const o = {};
  for (const t of TOOL_LIST) for (const s of t.subs) { const c = { ...s }; delete c.id; delete c.name; delete c.kind; o[s.id] = c; }
  store.set('subs', o);
}
const S = {
  toolId: store.get('tool', 'pen'),
  subOf: store.get('subOf', {}),
  temp: null, // 키를 누르고 있는 동안의 임시 도구 종류
  grid: false, sym: false,
  pressureGamma: store.get('pgamma', 1),
};
function curTool() { return TOOL_LIST.find(t => t.id === S.toolId) || TOOL_LIST[0]; }
function curSub() { const t = curTool(); return t.subs.find(s => s.id === S.subOf[t.id]) || t.subs[0]; }
function baseKind() { return curSub().kind || curTool().kind; }
function effKind() { return S.temp || baseKind(); }

/* ================= 문서 ================= */
const D = { w: 1600, h: 1200, dpi: 350, layers: [], activeId: 0, name: '제목 없음', nameSeq: 1 };
let layerSeq = 1;
const T = {}; // 문서 크기 임시 캔버스
const comp = { canvas: null, ctx: null, dirty: null };
const Sel = { canvas: null, ctx: null, has: false, path: null, bbox: null };
const A = { layerId: 0, overlay: null, replace: null, float: null }; // 활성 레이어 미리보기 상태

function newLayer(o = {}) {
  const c = mkCanvas(D.w, D.h);
  const L = Object.assign({
    id: layerSeq++, name: '레이어 ' + D.nameSeq, canvas: c, ctx: c.getContext('2d'),
    opacity: 1, blend: 'source-over', visible: true, locked: false, alphaLock: false, clip: false, draft: false, ref: false, paper: false, color: null,
  }, o);
  if (!o.name) D.nameSeq++;
  if (L.paper) paintPaper(L);
  return L;
}
function paintPaper(L) { L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.fillStyle = L.color || '#ffffff'; L.ctx.fillRect(0, 0, D.w, D.h); }
function active() { return D.layers.find(L => L.id === D.activeId) || D.layers[D.layers.length - 1]; }
function layerIndex(L) { return D.layers.indexOf(L); }

function allocDocCanvases() {
  for (const k of ['scratch', 'tmp', 'clip', 'buffer']) { const c = mkCanvas(D.w, D.h); T[k] = { canvas: c, ctx: c.getContext('2d') }; }
  const r = mkCanvas(D.w, D.h); T.read = { canvas: r, ctx: r.getContext('2d', { willReadFrequently: true }) };
  comp.canvas = mkCanvas(D.w, D.h); comp.ctx = comp.canvas.getContext('2d');
  Sel.canvas = mkCanvas(D.w, D.h); Sel.ctx = Sel.canvas.getContext('2d', { willReadFrequently: true });
  Sel.has = false; Sel.path = null; Sel.bbox = null;
}
function newDocument(w, h, dpi, paperColor, name) {
  D.w = clamp(w | 0, 16, 10000); D.h = clamp(h | 0, 16, 10000); D.dpi = dpi || 350; D.name = name || '제목 없음';
  D.layers = []; D.nameSeq = 1;
  allocDocCanvases();
  A.overlay = A.replace = A.float = null;
  const paper = newLayer({ name: '용지', paper: true, color: paperColor || '#ffffff' });
  D.layers.push(paper);
  if (paperColor === null) paper.visible = false;
  const L = newLayer();
  D.layers.push(L);
  D.activeId = L.id;
  H.clear();
  lastStrokeEnd = null;
  fitView();
  markDirty();
  renderLayers();
}

/* ================= 합성 ================= */
function markDirty(r) {
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
      const a = clamp(.25 + v * 1.0, 0, 1);
      id.data[(y * s + xx) * 4 + 3] = a * 255;
    }
    x.putImageData(id, 0, 0);
    paperTile = c;
  }
  return ctx.createPattern(paperTile, 'repeat');
}
// 오버레이(브러시 버퍼 등)에 색·종이 질감·선택 범위를 적용한 캔버스
function prepOverlay(o, r) {
  const sel = o.useSel && Sel.has;
  if (!o.color && !o.texture && !sel) return o.canvas;
  const t = T.tmp.ctx;
  t.save(); t.beginPath(); t.rect(r.x, r.y, r.w, r.h); t.clip(); t.clearRect(r.x, r.y, r.w, r.h);
  t.drawImage(o.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  if (o.color) { t.globalCompositeOperation = 'source-in'; t.fillStyle = o.color; t.fillRect(r.x, r.y, r.w, r.h); }
  if (o.texture) { t.globalCompositeOperation = 'destination-in'; t.fillStyle = paperPattern(t); t.fillRect(r.x, r.y, r.w, r.h); }
  if (sel) { t.globalCompositeOperation = 'destination-in'; t.drawImage(Sel.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h); }
  t.restore();
  return T.tmp.canvas;
}
function floatMatrix(f) {
  return new DOMMatrix().translate(f.x + f.w / 2 + f.tx, f.y + f.h / 2 + f.ty).rotate(f.rot).scale(f.sx, f.sy).translate(-f.w / 2, -f.h / 2);
}
function layerSource(L, r, opts) {
  if (opts.raw || A.layerId !== L.id || !(A.overlay || A.replace || A.float)) return L.canvas;
  const sc = T.scratch.ctx;
  sc.save(); sc.beginPath(); sc.rect(r.x, r.y, r.w, r.h); sc.clip(); sc.clearRect(r.x, r.y, r.w, r.h);
  sc.drawImage(A.replace || L.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  if (A.overlay) {
    const o = A.overlay, src = prepOverlay(o, r);
    sc.globalAlpha = o.alpha; sc.globalCompositeOperation = o.mode;
    sc.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
  if (A.float) {
    sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
    sc.imageSmoothingQuality = 'high';
    sc.setTransform(floatMatrix(A.float));
    sc.drawImage(A.float.canvas, 0, 0);
  }
  sc.restore();
  return T.scratch.canvas;
}
function blit(tc, src, L, r) {
  tc.globalAlpha = L.opacity; tc.globalCompositeOperation = L.blend;
  tc.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  tc.globalAlpha = 1; tc.globalCompositeOperation = 'source-over';
}
/* opts: excludeDraft, excludeHidden(기본), onlyRef, raw(미리보기 무시) */
function layerIncluded(L, opts) {
  return L.visible && !(opts.excludeDraft && L.draft) && !(opts.onlyRef && !L.ref) && !(opts.excludePaper && L.paper);
}
function compositeInto(tc, r, opts = {}) {
  tc.save(); tc.beginPath(); tc.rect(r.x, r.y, r.w, r.h); tc.clip(); tc.clearRect(r.x, r.y, r.w, r.h);
  let base = null;
  for (const L of D.layers) {
    const inc = layerIncluded(L, opts);
    if (!L.clip) {
      base = inc ? layerSource(L, r, opts) : null;
      if (base) blit(tc, base, L, r);
    } else if (inc && base) {
      // 아래 레이어에서 클리핑: 기준 레이어의 알파 안에서만 표시
      const src = layerSource(L, r, opts), ct = T.clip.ctx;
      ct.save(); ct.beginPath(); ct.rect(r.x, r.y, r.w, r.h); ct.clip(); ct.clearRect(r.x, r.y, r.w, r.h);
      ct.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      ct.globalCompositeOperation = 'destination-in';
      ct.drawImage(base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
      ct.restore();
      blit(tc, T.clip.canvas, L, r);
    }
  }
  tc.restore();
}
function flushComposite() {
  if (!comp.dirty) return;
  compositeInto(comp.ctx, comp.dirty);
  comp.dirty = null;
}

/* ================= 뷰포트 ================= */
const vc = $('#view'), vx = vc.getContext('2d');
const V = { zoom: 1, rot: 0, flip: false, cx: 800, cy: 600, w: 800, h: 600, dpr: 1 };
function vm() { return new DOMMatrix().translate(V.w / 2, V.h / 2).rotate(V.rot).scale(V.zoom * (V.flip ? -1 : 1), V.zoom).translate(-V.cx, -V.cy); }
function s2d(x, y) { const p = vm().inverse().transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; }
function d2s(x, y) { const p = vm().transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; }
function viewChanged() { NavUI.sync(); updateStatus(); requestRender(); }
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
  let z;
  if (dir > 0) z = ZOOM_STEPS.find(s => s > V.zoom * 1.001) || 64;
  else z = [...ZOOM_STEPS].reverse().find(s => s < V.zoom * .999) || .02;
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

let raf = 0, navDirty = true, lastNav = 0, antPhase = 0, hover = null;
function requestRender() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(t) {
  raf = 0;
  if (!comp.canvas) return;
  flushComposite();
  drawView();
  if (navDirty && t - lastNav > 120) { NavUI.draw(); navDirty = false; lastNav = t; }
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
  const M = new DOMMatrix([V.dpr, 0, 0, V.dpr, 0, 0]).multiply(vm());
  ctx.setTransform(M);
  // 그림자 + 투명 격자
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
  if (S.grid) {
    ctx.beginPath();
    const step = 100;
    for (let x = step; x < D.w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, D.h); }
    for (let y = step; y < D.h; y += step) { ctx.moveTo(0, y); ctx.lineTo(D.w, y); }
    ctx.strokeStyle = 'rgba(70,140,220,.45)'; ctx.lineWidth = px; ctx.stroke();
  }
  if (S.sym) {
    ctx.beginPath(); ctx.moveTo(D.w / 2, -20 * px); ctx.lineTo(D.w / 2, D.h + 20 * px);
    ctx.setLineDash([6 * px, 4 * px]); ctx.strokeStyle = 'rgba(227,100,160,.9)'; ctx.lineWidth = 1.5 * px; ctx.stroke(); ctx.setLineDash([]);
  }
  // 선택 범위 경계선(점선)
  if (Sel.has && Sel.path && !A.float) {
    ctx.lineWidth = px;
    ctx.strokeStyle = '#ffffff'; ctx.stroke(Sel.path);
    ctx.setLineDash([4 * px, 4 * px]); ctx.lineDashOffset = -antPhase * px;
    ctx.strokeStyle = '#000000'; ctx.stroke(Sel.path); ctx.setLineDash([]);
  }
  // 도구 미리보기 (문서 좌표)
  if (drag && drag.preview) drag.preview(ctx, px);
  // 화면 좌표 오버레이
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  if (A.float && A.float.kind === 'transform') drawTransformHandles(ctx);
  if (hover && !drag && ['brush'].includes(effKind())) {
    const b = curSub(), r = Math.max(.5, b.size / 2 * V.zoom);
    ctx.beginPath(); ctx.arc(hover.x, hover.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    if (r < 4) {
      ctx.beginPath(); ctx.moveTo(hover.x - 6, hover.y); ctx.lineTo(hover.x + 6, hover.y); ctx.moveTo(hover.x, hover.y - 6); ctx.lineTo(hover.x, hover.y + 6);
      ctx.stroke();
    }
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
function historyBusy() {
  if (A.float) { cancelFloat(); return true; }
  return !!drag || Filter.open;
}
function afterHistory(silent) {
  HistUI.render(); updateCmdStates();
  if (!silent) { dirtySinceSave = true; Autosave.schedule(); }
}
function pixCmd(label, L, r, before, after) {
  const put = c => { L.ctx.clearRect(r.x, r.y, r.w, r.h); L.ctx.drawImage(c, r.x, r.y); markDirty(r); queueThumb(L); };
  return { label, undo: () => put(before), redo: () => put(after) };
}
const PROPS = ['name', 'opacity', 'blend', 'visible', 'locked', 'alphaLock', 'clip', 'draft', 'ref', 'color'];
function snapDoc(pixLayers = [], withSel = false) {
  return {
    order: D.layers.slice(), active: D.activeId,
    props: new Map(D.layers.map(L => [L, PROPS.map(k => L[k])])),
    pix: new Map(pixLayers.map(L => [L, cloneCanvas(L.canvas)])),
    sel: withSel ? selSnapshot() : null,
  };
}
function applyDoc(s) {
  D.layers = s.order.slice();
  for (const [L, v] of s.props) PROPS.forEach((k, i) => { L[k] = v[i]; });
  for (const [L, c] of s.pix) { L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.drawImage(c, 0, 0); queueThumb(L); }
  if (s.sel) selRestore(s.sel);
  D.activeId = s.active;
  markDirty(); renderLayers();
}
function structural(label, pixLayers, fn, withSel) {
  const b = snapDoc(pixLayers, withSel);
  if (fn() === false) return;
  const a = snapDoc(pixLayers, withSel);
  H.push({ label, undo: () => applyDoc(b), redo: () => applyDoc(a) });
  markDirty(); renderLayers();
  for (const L of pixLayers) queueThumb(L);
}

/* ================= 브러시 엔진 ================= */
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
class Stroke {
  constructor(ctx, b, opts = {}) {
    this.ctx = ctx; this.b = b; this.raw = []; this.pts = [];
    this.dist = 0; this.carry = 0; this.bbox = null; this.dirty = null;
    this.sym = !!opts.sym;
    this.win = opts.noStab ? 1 : 1 + Math.round(b.stab * .3);
    this.total = 0;
    ctx.fillStyle = '#000';
  }
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
  put(x, y, size, a) {
    const ctx = this.ctx, b = this.b;
    let r = size / 2;
    if (r < .5) { a *= (r / .5) ** 2; r = .5; }
    ctx.globalAlpha = clamp(a, 0, 1);
    const one = (px) => {
      if (b.tip === 'flat') {
        ctx.save(); ctx.translate(px, y); ctx.rotate(b.angle * Math.PI / 180); ctx.scale(1, b.aspect);
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (b.hardness >= .99) {
        ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.fill();
      } else ctx.drawImage(softTip(b.hardness), px - r, y - r, r * 2, r * 2);
      const rr = { x: px - r - 2, y: y - r - 2, w: r * 2 + 4, h: r * 2 + 4 };
      this.bbox = Rect.union(this.bbox, rr); this.dirty = Rect.union(this.dirty, rr);
    };
    one(x);
    if (this.sym) one(D.w - x);
    ctx.globalAlpha = 1;
  }
  seg(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    let t = this.carry;
    while (t <= len) {
      const f = t / len, p = a.p + (b.p - a.p) * f, d = this.dist + t;
      const sz = this.sizeAt(p, d);
      this.put(a.x + dx * f, a.y + dy * f, sz, this.alphaAt(p));
      t += Math.max(.25, sz * this.b.spacing);
    }
    this.carry = t - len; this.dist += len;
  }
  addPt(pt) {
    this.pts.push(pt);
    const n = this.pts.length;
    if (n === 1) {
      const sz = this.sizeAt(pt.p, 0);
      this.put(pt.x, pt.y, sz, this.alphaAt(pt.p));
      this.carry = Math.max(.25, sz * this.b.spacing);
    } else this.seg(this.pts[n - 2], pt);
  }
  addRaw(x, y, p) {
    this.raw.push({ x, y, p });
    const n = this.raw.length, k = Math.min(this.win, n);
    let sx = 0, sy = 0, sp = 0;
    for (let i = n - k; i < n; i++) { sx += this.raw[i].x; sy += this.raw[i].y; sp += this.raw[i].p; }
    const pt = { x: sx / k, y: sy / k, p: sp / k };
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < .2) { last.p = pt.p; return; }
    this.addPt(pt);
  }
  finish() {
    const last = this.raw[this.raw.length - 1];
    if (last && this.win > 1) for (let i = 1; i < this.win; i++) this.addRaw(last.x, last.y, last.p);
    if (this.b.taperOut > 0 && this.pts.length > 1) this.rerender();
  }
  rerender() {
    let total = 0;
    for (let i = 1; i < this.pts.length; i++) total += Math.hypot(this.pts[i].x - this.pts[i - 1].x, this.pts[i].y - this.pts[i - 1].y);
    if (this.bbox) this.ctx.clearRect(this.bbox.x, this.bbox.y, this.bbox.w, this.bbox.h);
    const pts = this.pts, keep = this.bbox;
    this.pts = []; this.dist = 0; this.carry = 0; this.total = total; this.bbox = null;
    for (const p of pts) this.addPt(p);
    this.bbox = Rect.union(this.bbox, keep); this.dirty = Rect.union(this.dirty, keep);
  }
  takeDirty() { const d = this.dirty; this.dirty = null; return d; }
}
function brushOverlay(b) {
  const L = active();
  const erase = b.eraser || C.cur === 'trans';
  return {
    canvas: T.buffer.canvas, color: erase ? null : drawHex(), texture: b.texture,
    mode: erase ? 'destination-out' : (L.alphaLock ? 'source-atop' : 'source-over'),
    alpha: b.opacity, useSel: true,
  };
}
function commitOverlay(label, bbox, record = true) {
  const L = active(), r = Rect.clip(bbox);
  if (r && A.overlay) {
    const before = record ? cloneCanvas(L.canvas, r) : null;
    const src = prepOverlay(A.overlay, r);
    L.ctx.save();
    L.ctx.globalAlpha = A.overlay.alpha; L.ctx.globalCompositeOperation = A.overlay.mode;
    L.ctx.drawImage(src, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    L.ctx.restore();
    if (record) H.push(pixCmd(label, L, r, before, cloneCanvas(L.canvas, r)));
    queueThumb(L);
  }
  if (r) T.buffer.ctx.clearRect(r.x, r.y, r.w, r.h);
  A.overlay = null;
  markDirty(r);
}
function canPaint(L, quiet) {
  L = L || active();
  let msg = null;
  if (!L) msg = '레이어가 없습니다.';
  else if (L.paper) msg = '용지 레이어에는 그릴 수 없습니다. 새 레이어를 만들어 주세요.';
  else if (L.locked) msg = '잠긴 레이어입니다. 레이어 잠금을 해제해 주세요.';
  else if (!L.visible) msg = '숨긴 레이어에는 그릴 수 없습니다.';
  if (msg && !quiet) toast(msg, true);
  return !msg;
}
let lastStrokeEnd = null;

/* ================= 선택 범위 ================= */
function selSnapshot() { return { c: Sel.has ? cloneCanvas(Sel.canvas) : null }; }
function selRestore(s) {
  Sel.ctx.clearRect(0, 0, D.w, D.h);
  if (s.c) Sel.ctx.drawImage(s.c, 0, 0);
  Sel.has = !!s.c;
  selChanged();
}
function selChanged() {
  if (!Sel.has) { Sel.path = null; Sel.bbox = null; requestRender(); updateCmdStates(); return; }
  const w = D.w, h = D.h, d = Sel.ctx.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (d[(y * w + x) * 4 + 3] >= 128) { m[y * w + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) {
    // 반투명만 남은 경우도 선택 없음으로 취급
    Sel.has = false; Sel.path = null; Sel.bbox = null; Sel.ctx.clearRect(0, 0, w, h); requestRender(); updateCmdStates(); return;
  }
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
  requestRender(); updateCmdStates();
}
function selApply(label, op, draw) {
  const b = selSnapshot();
  const ctx = Sel.ctx;
  if (op === 'new') ctx.clearRect(0, 0, D.w, D.h);
  ctx.save();
  ctx.globalCompositeOperation = op === 'sub' ? 'destination-out' : 'source-over';
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
function selFromLayer(L) {
  const c = cloneCanvas(L.canvas);
  selApply('레이어에서 선택 범위', 'new', x => x.drawImage(c, 0, 0));
}

/* ================= 영역 탐색 (채우기 · 자동 선택) ================= */
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
  const t = T.read.ctx;
  if (ref === 'layer') {
    t.clearRect(0, 0, D.w, D.h); t.drawImage(active().canvas, 0, 0);
  } else {
    compositeInto(t, Rect.full(), { raw: true, excludeDraft: true, onlyRef: ref === 'ref' });
  }
  return t.getImageData(0, 0, D.w, D.h).data;
}
function floodRegion(sx, sy, o) {
  const w = D.w, h = D.h;
  sx = sx | 0; sy = sy | 0;
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const d = refImage(o.ref), n = w * h;
  const i0 = (sy * w + sx) * 4, a0 = d[i0 + 3];
  const r0 = d[i0] * a0, g0 = d[i0 + 1] * a0, b0 = d[i0 + 2] * a0;
  const tol = (o.tolerance / 100) * 255 * 255;
  const match = new Uint8Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const a = d[j + 3];
    const diff = Math.max(Math.abs(d[j] * a - r0), Math.abs(d[j + 1] * a - g0), Math.abs(d[j + 2] * a - b0), Math.abs(a - a0) * 255);
    match[i] = diff <= tol ? 1 : 0;
  }
  let pass = match;
  if (o.gap > 0) {
    // 틈 닫기: 경계를 gap만큼 두껍게 한 뒤 탐색하고, 결과를 다시 경계까지 넓힌다
    const wall = new Uint8Array(n); for (let i = 0; i < n; i++) wall[i] = match[i] ? 0 : 1;
    const wd = dilate(wall, w, h, o.gap);
    pass = new Uint8Array(n); for (let i = 0; i < n; i++) pass[i] = match[i] && !wd[i] ? 1 : 0;
    if (!pass[sy * w + sx]) pass = match;
  }
  const region = new Uint8Array(n), stack = [sx, sy];
  if (!pass[sy * w + sx]) return null;
  while (stack.length) {
    const y = stack.pop(); let x = stack.pop();
    let i = y * w + x;
    while (x > 0 && pass[i - 1] && !region[i - 1]) { x--; i--; }
    let up = false, dn = false;
    for (; x < w && pass[i] && !region[i]; x++, i++) {
      region[i] = 1;
      if (y > 0) { const u = i - w; if (pass[u] && !region[u]) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false; }
      if (y < h - 1) { const v = i + w; if (pass[v] && !region[v]) { if (!dn) { stack.push(x, y + 1); dn = true; } } else dn = false; }
    }
  }
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
function fillAt(x, y, o, label = '채우기', quiet = false) {
  if (!canPaint()) return;
  const m = floodRegion(x, y, o);
  if (!m) return;
  const bb = regionBBox(m);
  if (!bb) return;
  const id = T.buffer.ctx.createImageData(bb.w, bb.h);
  for (let yy = 0; yy < bb.h; yy++) for (let xx = 0; xx < bb.w; xx++) if (m[(bb.y + yy) * D.w + bb.x + xx]) id.data[(yy * bb.w + xx) * 4 + 3] = 255;
  T.buffer.ctx.putImageData(id, bb.x, bb.y);
  const L = active(), erase = C.cur === 'trans';
  A.layerId = L.id;
  A.overlay = { canvas: T.buffer.canvas, color: erase ? null : drawHex(), mode: erase ? 'destination-out' : (L.alphaLock ? 'source-atop' : 'source-over'), alpha: o.opacity ?? 1, useSel: true };
  commitOverlay(label, bb);
  if (!quiet) pushColorHistory();
}

/* ================= 플로팅(이동·변형) ================= */
function contentBBox(canvas) {
  const t = T.read.ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(canvas, 0, 0);
  const d = t.getImageData(0, 0, D.w, D.h).data, w = D.w, h = D.h;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const o = y * w * 4; for (let x = 0; x < w; x++) if (d[o + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function beginFloat(kind) {
  const L = active();
  if (!canPaint(L)) return false;
  const bb = Sel.has ? Sel.bbox : contentBBox(L.canvas);
  if (!bb) { toast('이동할 그림이 없습니다.'); return false; }
  const before = cloneCanvas(L.canvas), selBefore = selSnapshot();
  const fc = cloneCanvas(L.canvas, bb), fx = fc.getContext('2d');
  let mask = null;
  if (Sel.has) {
    fx.globalCompositeOperation = 'destination-in';
    fx.drawImage(Sel.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h);
    L.ctx.save(); L.ctx.globalCompositeOperation = 'destination-out'; L.ctx.drawImage(Sel.canvas, 0, 0); L.ctx.restore();
    mask = cloneCanvas(Sel.canvas, bb);
  } else L.ctx.clearRect(bb.x, bb.y, bb.w, bb.h);
  A.layerId = L.id;
  A.float = { canvas: fc, mask, kind, layer: L, before, selBefore, x: bb.x, y: bb.y, w: bb.w, h: bb.h, tx: 0, ty: 0, sx: 1, sy: 1, rot: 0, last: null };
  floatDirty();
  if (kind === 'transform') { $('#transformbar').hidden = false; }
  return true;
}
function floatBounds(f) {
  const M = floatMatrix(f);
  const pts = [[0, 0], [f.w, 0], [f.w, f.h], [0, f.h]].map(([x, y]) => M.transformPoint(new DOMPoint(x, y)));
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: x - 2, y: y - 2, w: Math.max(...xs) - x + 4, h: Math.max(...ys) - y + 4 };
}
function floatDirty() {
  const f = A.float; if (!f) return;
  const b = floatBounds(f);
  markDirty(Rect.union(f.last || { x: f.x, y: f.y, w: f.w, h: f.h }, b));
  f.last = b;
}
function commitFloat(label) {
  const f = A.float; if (!f) return;
  const L = f.layer;
  L.ctx.save(); L.ctx.imageSmoothingQuality = 'high'; L.ctx.setTransform(floatMatrix(f)); L.ctx.drawImage(f.canvas, 0, 0); L.ctx.restore();
  if (f.mask) {
    Sel.ctx.clearRect(0, 0, D.w, D.h);
    Sel.ctx.save(); Sel.ctx.setTransform(floatMatrix(f)); Sel.ctx.drawImage(f.mask, 0, 0); Sel.ctx.restore();
    Sel.has = true; selChanged();
  }
  const after = cloneCanvas(L.canvas), selAfter = selSnapshot();
  const put = (c, s) => { L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.drawImage(c, 0, 0); selRestore(s); markDirty(); queueThumb(L); };
  const { before, selBefore } = f;
  A.float = null;
  $('#transformbar').hidden = true;
  H.push({ label, undo: () => put(before, selBefore), redo: () => put(after, selAfter) });
  markDirty(); queueThumb(L);
}
function cancelFloat() {
  const f = A.float; if (!f) return;
  f.layer.ctx.clearRect(0, 0, D.w, D.h); f.layer.ctx.drawImage(f.before, 0, 0);
  selRestore(f.selBefore);
  A.float = null;
  $('#transformbar').hidden = true;
  markDirty();
}
function startTransform() {
  if (A.float) return;
  if (drag) return;
  beginFloat('transform');
  requestRender();
}
function tfCorners() {
  const f = A.float, M = vm().multiply(floatMatrix(f));
  return [[0, 0], [f.w / 2, 0], [f.w, 0], [f.w, f.h / 2], [f.w, f.h], [f.w / 2, f.h], [0, f.h], [0, f.h / 2]]
    .map(([x, y]) => { const p = M.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; });
}
const TF_HANDLES = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]];
function drawTransformHandles(ctx) {
  const c = tfCorners();
  ctx.beginPath(); ctx.moveTo(c[0].x, c[0].y); [2, 4, 6].forEach(i => ctx.lineTo(c[i].x, c[i].y)); ctx.closePath();
  ctx.lineWidth = 1; ctx.strokeStyle = '#e3a446'; ctx.stroke();
  for (const p of c) { ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8); ctx.strokeStyle = '#1b1c1f'; ctx.strokeRect(p.x - 4, p.y - 4, 8, 8); }
}
function pointInPoly(p, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) ins = !ins;
  }
  return ins;
}

/* ================= 필터 · 색조 보정 ================= */
const Filter = { open: false };
function premulBlur(src, w, h, radius) {
  const n = w * h, ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { const a = src[i * 4 + 3] / 255; ch[0][i] = src[i * 4] * a; ch[1][i] = src[i * 4 + 1] * a; ch[2][i] = src[i * 4 + 2] * a; ch[3][i] = src[i * 4 + 3]; }
  // 박스 블러 3회 ≈ 가우시안
  const sig = radius, nb = 3, wIdeal = Math.sqrt(12 * sig * sig / nb + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sig * sig - nb * wl * wl - 4 * nb * wl - 3 * nb) / (-4 * wl - 4));
  const sizes = [0, 1, 2].map(i => ((i < m ? wl : wl + 2) - 1) / 2);
  const tmp = new Float32Array(n);
  const boxH = (s, d, r) => {
    const iarr = 1 / (r + r + 1);
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += s[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) {
        d[o + x] = acc * iarr;
        acc += s[o + Math.min(w - 1, x + r + 1)] - s[o + Math.max(0, x - r)];
      }
    }
  };
  const boxV = (s, d, r) => {
    const iarr = 1 / (r + r + 1);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += s[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        d[y * w + x] = acc * iarr;
        acc += s[Math.min(h - 1, y + r + 1) * w + x] - s[Math.max(0, y - r) * w + x];
      }
    }
  };
  for (const c of ch) for (const r of sizes) { if (r < 1) continue; boxH(c, tmp, r | 0); boxV(tmp, c, r | 0); }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const a = ch[3][i]; out[i * 4 + 3] = a;
    if (a > 0) { const k = 255 / a; out[i * 4] = ch[0][i] * k; out[i * 4 + 1] = ch[1][i] * k; out[i * 4 + 2] = ch[2][i] * k; }
  }
  return out;
}
const FILTERS = {
  hsl: {
    label: '색조·채도·명도', params: [['h', '색조', -180, 180, 0], ['s', '채도', -100, 100, 0], ['l', '명도', -100, 100, 0]],
    run(src, out, p) {
      const dh = p.h / 360, ds = p.s / 100, dl = p.l / 100;
      for (let i = 0; i < src.length; i += 4) {
        if (!src[i + 3]) continue;
        let [h, s, l] = rgb2hsl(src[i] / 255, src[i + 1] / 255, src[i + 2] / 255);
        h = (h + dh + 1) % 1;
        s = ds >= 0 ? s + (1 - s) * ds * (s > 0 ? 1 : 0) : s * (1 + ds);
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        const [r, g, b] = hsl2rgb(h, clamp(s, 0, 1), clamp(l, 0, 1));
        out[i] = r * 255; out[i + 1] = g * 255; out[i + 2] = b * 255; out[i + 3] = src[i + 3];
      }
    },
  },
  bc: {
    label: '밝기·대비', params: [['b', '밝기', -100, 100, 0], ['c', '대비', -100, 100, 0]],
    run(src, out, p) {
      const c = p.c * 2.55, f = (259 * (c + 255)) / (255 * (259 - c)), b = p.b * 1.28;
      for (let i = 0; i < src.length; i += 4) {
        for (let k = 0; k < 3; k++) out[i + k] = f * (src[i + k] - 128) + 128 + b;
        out[i + 3] = src[i + 3];
      }
    },
  },
  posterize: {
    label: '포스터화', params: [['n', '계조 수', 2, 20, 4]],
    run(src, out, p) {
      const n = p.n - 1;
      for (let i = 0; i < src.length; i += 4) { for (let k = 0; k < 3; k++) out[i + k] = Math.round(src[i + k] / 255 * n) / n * 255; out[i + 3] = src[i + 3]; }
    },
  },
  blur: {
    label: '가우시안 흐리기', params: [['r', '흐리기 범위', 1, 100, 6]],
    run(src, out, p) { out.set(premulBlur(src, D.w, D.h, p.r)); },
  },
  mosaic: {
    label: '모자이크', params: [['s', '모자이크 크기', 2, 120, 16]],
    run(src, out, p) {
      const s = p.s | 0, w = D.w, h = D.h;
      for (let by = 0; by < h; by += s) for (let bx = 0; bx < w; bx += s) {
        let r = 0, g = 0, b = 0, a = 0, cnt = 0;
        const ey = Math.min(h, by + s), ex = Math.min(w, bx + s);
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4, al = src[i + 3]; r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; cnt++; }
        const R = a ? r / a : 0, G = a ? g / a : 0, B = a ? b / a : 0, Al = a / cnt;
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4; out[i] = R; out[i + 1] = G; out[i + 2] = B; out[i + 3] = Al; }
      }
    },
  },
  invert: {
    label: '계조 반전', params: [],
    run(src, out) { for (let i = 0; i < src.length; i += 4) { out[i] = 255 - src[i]; out[i + 1] = 255 - src[i + 1]; out[i + 2] = 255 - src[i + 2]; out[i + 3] = src[i + 3]; } },
  },
};
function filterJob(key) {
  const L = active();
  if (!canPaint(L)) return null;
  const t = T.read.ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(L.canvas, 0, 0);
  const src = t.getImageData(0, 0, D.w, D.h).data;
  const mask = Sel.has ? Sel.ctx.getImageData(0, 0, D.w, D.h).data : null;
  const out = mkCanvas(D.w, D.h), ox = out.getContext('2d');
  const run = (p) => {
    const id = ox.createImageData(D.w, D.h), o = id.data;
    FILTERS[key].run(src, o, p);
    if (mask) for (let i = 0; i < o.length; i += 4) {
      const m = mask[i + 3] / 255;
      if (m < 1) for (let k = 0; k < 4; k++) o[i + k] = src[i + k] + (o[i + k] - src[i + k]) * m;
    }
    ox.putImageData(id, 0, 0);
    A.layerId = L.id; A.replace = out; markDirty();
  };
  const commit = () => {
    const before = cloneCanvas(L.canvas);
    L.ctx.clearRect(0, 0, D.w, D.h); L.ctx.drawImage(out, 0, 0);
    A.replace = null;
    H.push(pixCmd(FILTERS[key].label, L, Rect.full(), before, cloneCanvas(L.canvas)));
    markDirty(); queueThumb(L);
  };
  const cancel = () => { A.replace = null; markDirty(); };
  return { run, commit, cancel };
}
function openFilter(key) {
  if (A.float) return;
  const f = FILTERS[key], job = filterJob(key);
  if (!job) return;
  if (!f.params.length) { job.run({}); job.commit(); return; }
  const vals = Object.fromEntries(f.params.map(p => [p[0], p[4]]));
  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => job.run(vals), key === 'blur' ? 120 : 30); };
  const rows = f.params.map(([k, label, min, max]) => {
    const num = el('input', { type: 'number', class: 'num', min, max, value: vals[k], style: 'width:70px' });
    const rng = el('input', { type: 'range', min, max, value: vals[k], style: 'flex:1;accent-color:var(--accent)' });
    const set = v => { vals[k] = clamp(+v || 0, min, max); rng.value = vals[k]; num.value = vals[k]; schedule(); };
    rng.addEventListener('input', () => set(rng.value));
    num.addEventListener('change', () => set(num.value));
    return el('div', { class: 'frow' }, el('span', { text: label }), el('div', { class: 'inline', style: 'flex-wrap:nowrap' }, rng, num));
  });
  Filter.open = true;
  job.run(vals);
  Modal.open(f.label, [...rows, Sel.has ? el('p', { class: 'note', text: '선택 범위 안에만 적용됩니다.' }) : null], [
    ['취소', () => { clearTimeout(timer); job.cancel(); Filter.open = false; Modal.close(); }],
    ['적용', () => { clearTimeout(timer); job.run(vals); job.commit(); Filter.open = false; Modal.close(); }, true],
  ], { onDismiss: () => { clearTimeout(timer); job.cancel(); Filter.open = false; } });
}

/* ================= 편집 명령 ================= */
function clearSelected(outside) {
  const L = active();
  if (!canPaint(L)) return;
  const before = cloneCanvas(L.canvas);
  L.ctx.save();
  if (Sel.has) {
    L.ctx.globalCompositeOperation = outside ? 'destination-in' : 'destination-out';
    L.ctx.drawImage(Sel.canvas, 0, 0);
  } else if (!outside) L.ctx.clearRect(0, 0, D.w, D.h);
  L.ctx.restore();
  H.push(pixCmd(outside ? '선택 범위 외 삭제' : '삭제', L, Rect.full(), before, cloneCanvas(L.canvas)));
  markDirty(); queueThumb(L);
}
function fillSelection() {
  const L = active();
  if (!canPaint(L)) return;
  T.buffer.ctx.fillStyle = '#000'; T.buffer.ctx.fillRect(0, 0, D.w, D.h);
  const erase = C.cur === 'trans';
  A.layerId = L.id;
  A.overlay = { canvas: T.buffer.canvas, color: erase ? null : drawHex(), mode: erase ? 'destination-out' : (L.alphaLock ? 'source-atop' : 'source-over'), alpha: 1, useSel: true };
  commitOverlay('채우기', Sel.has ? Sel.bbox : Rect.full());
}
function flipLayer(horizontal) {
  const L = active();
  if (!canPaint(L)) return;
  const before = cloneCanvas(L.canvas);
  const src = cloneCanvas(L.canvas);
  L.ctx.save(); L.ctx.clearRect(0, 0, D.w, D.h);
  if (horizontal) { L.ctx.translate(D.w, 0); L.ctx.scale(-1, 1); } else { L.ctx.translate(0, D.h); L.ctx.scale(1, -1); }
  L.ctx.drawImage(src, 0, 0); L.ctx.restore();
  H.push(pixCmd(horizontal ? '좌우 반전' : '상하 반전', L, Rect.full(), before, cloneCanvas(L.canvas)));
  markDirty(); queueThumb(L);
}
let clipboard = null;
function copySel(cut) {
  const L = active();
  if (L.paper) return;
  const bb = Sel.has ? Sel.bbox : Rect.full();
  const c = cloneCanvas(L.canvas, bb);
  if (Sel.has) { const x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(Sel.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); }
  clipboard = { canvas: c, x: bb.x, y: bb.y };
  try { c.toBlob(b => { if (b && navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); }); } catch { /* 시스템 클립보드 없음 */ }
  if (cut) clearSelected(false);
  else toast('복사했습니다.');
}
function pasteCanvas(c, x, y, name) {
  structural('붙여넣기', [], () => {
    const L = newLayer({ name: name || undefined });
    if (x == null) { const s = Math.min(1, D.w / c.width, D.h / c.height); const w = c.width * s, h = c.height * s; L.ctx.drawImage(c, (D.w - w) / 2, (D.h - h) / 2, w, h); }
    else L.ctx.drawImage(c, x, y);
    D.layers.splice(layerIndex(active()) + 1, 0, L);
    D.activeId = L.id;
  });
}

/* ================= 레이어 명령 ================= */
function addLayer() {
  if (A.float) return;
  structural('신규 래스터 레이어', [], () => {
    const L = newLayer();
    D.layers.splice(layerIndex(active()) + 1, 0, L);
    D.activeId = L.id;
  });
}
function dupLayer() {
  const src = active(); if (!src || A.float) return;
  structural('레이어 복제', [], () => {
    const L = newLayer({ name: src.name + ' 복사', paper: false });
    for (const k of PROPS) if (k !== 'name') L[k] = src[k];
    L.paper = src.paper; L.color = src.color;
    L.ctx.drawImage(src.canvas, 0, 0);
    D.layers.splice(layerIndex(src) + 1, 0, L);
    D.activeId = L.id;
  });
}
function delLayer() {
  const L = active(); if (!L || A.float) return;
  if (D.layers.length <= 1) { toast('마지막 레이어는 삭제할 수 없습니다.', true); return; }
  structural('레이어 삭제', [], () => {
    const i = layerIndex(L);
    D.layers.splice(i, 1);
    D.activeId = (D.layers[i - 1] || D.layers[0]).id;
  });
}
function moveLayer(dir) {
  const L = active(); if (!L || A.float) return;
  const i = layerIndex(L), j = i + dir;
  if (j < 0 || j >= D.layers.length) return;
  structural('레이어 순서 변경', [], () => { D.layers.splice(i, 1); D.layers.splice(j, 0, L); });
}
function reorderLayer(L, toIndex) {
  const i = layerIndex(L);
  if (i < 0 || toIndex === i) return;
  structural('레이어 순서 변경', [], () => { D.layers.splice(i, 1); D.layers.splice(toIndex > i ? toIndex - 1 : toIndex, 0, L); });
}
function mergeDown() {
  const U = active(); if (!U || A.float) return;
  const i = layerIndex(U), Lo = D.layers[i - 1];
  if (!Lo) { toast('아래에 결합할 레이어가 없습니다.', true); return; }
  if (Lo.paper) { toast('용지 레이어와는 결합할 수 없습니다.', true); return; }
  if (Lo.locked) { toast('아래 레이어가 잠겨 있습니다.', true); return; }
  structural('아래 레이어와 결합', [Lo], () => {
    let src = U.canvas;
    if (U.clip) {
      const c = T.clip.ctx; c.clearRect(0, 0, D.w, D.h); c.drawImage(U.canvas, 0, 0);
      c.globalCompositeOperation = 'destination-in'; c.drawImage(Lo.canvas, 0, 0); c.globalCompositeOperation = 'source-over';
      src = T.clip.canvas;
    }
    if (U.visible) {
      // 아래 레이어가 투명한 곳에서도 블렌드 결과가 유지되도록 표준이 아닌 모드는 알파 안쪽만 합성
      Lo.ctx.save(); Lo.ctx.globalAlpha = U.opacity; Lo.ctx.globalCompositeOperation = U.blend; Lo.ctx.drawImage(src, 0, 0); Lo.ctx.restore();
    }
    D.layers.splice(i, 1);
    D.activeId = Lo.id;
  });
}
function mergeVisible() {
  if (A.float) return;
  const vis = D.layers.filter(L => L.visible && !L.paper);
  if (vis.length < 2) { toast('결합할 표시 레이어가 2개 이상 필요합니다.'); return; }
  structural('표시 레이어 결합', [], () => {
    const L = newLayer({ name: '결합된 레이어' });
    compositeInto(L.ctx, Rect.full(), { raw: true, excludePaper: true });
    const top = Math.max(...vis.map(layerIndex));
    D.layers.splice(top + 1, 0, L);
    D.layers = D.layers.filter(x => !vis.includes(x));
    D.activeId = L.id;
  });
}
function setLayerProp(L, key, val, label) {
  if (L[key] === val) return;
  structural(label, L.paper && key === 'color' ? [L] : [], () => { L[key] = val; if (key === 'color') paintPaper(L); });
}
function selectLayer(L) {
  if (A.float || drag) return;
  D.activeId = L.id;
  renderLayers();
}

/* ================= 썸네일 ================= */
const thumbQ = new Set(); let thumbTimer = 0;
function queueThumb(L) { thumbQ.add(L); if (!thumbTimer) thumbTimer = setTimeout(flushThumbs, 160); }
function flushThumbs() {
  thumbTimer = 0;
  for (const L of thumbQ) drawThumb(L);
  thumbQ.clear();
}
function drawThumb(L) {
  if (!L.thumb) { L.thumb = mkCanvas(104, 78); L.thumb.className = 'lthumb'; }
  const t = L.thumb, x = t.getContext('2d');
  x.clearRect(0, 0, t.width, t.height);
  const s = Math.min(t.width / D.w, t.height / D.h), w = D.w * s, h = D.h * s;
  x.imageSmoothingQuality = 'high';
  x.drawImage(L.canvas, (t.width - w) / 2, (t.height - h) / 2, w, h);
}

/* ================= 입출력 ================= */
function exportComposite(opts) {
  // 숨긴 레이어는 항상 제외. 밑그림 레이어는 옵션에 따라 제외.
  const c = mkCanvas(D.w, D.h), x = c.getContext('2d');
  compositeInto(x, Rect.full(), { raw: true, excludeDraft: !opts.includeDraft });
  return c;
}
function scaled(c, scale, bg) {
  const w = Math.max(1, Math.round(c.width * scale)), h = Math.max(1, Math.round(c.height * scale));
  const o = mkCanvas(w, h), x = o.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.imageSmoothingQuality = 'high';
  x.drawImage(c, 0, 0, w, h);
  return o;
}
function buildPSD(opts) {
  const comp = exportComposite(opts), cx = comp.getContext('2d');
  const layers = [];
  let baseShown = false; // 클리핑 기준 레이어가 빠지면 그 위의 클리핑 레이어도 화면에 안 보이므로 함께 뺀다
  for (const L of D.layers) {
    const keep = (L.visible || opts.includeHidden) && !(L.draft && !opts.includeDraft);
    if (!L.clip) baseShown = keep;
    if (!keep || (L.clip && !baseShown)) continue; // 숨긴 레이어는 기본적으로 파일에서 제외
    const t = T.read.ctx;
    t.clearRect(0, 0, D.w, D.h); t.drawImage(L.canvas, 0, 0);
    layers.push({
      name: L.name, rgba: t.getImageData(0, 0, D.w, D.h).data.slice(),
      opacity: L.opacity, blend: L.blend, hidden: !L.visible, clip: L.clip, alphaLock: L.alphaLock,
    });
  }
  // 클리핑 기준 레이어가 빠져 첫 레이어가 클리핑 상태가 되지 않도록 정리
  for (let i = 0; i < layers.length; i++) if (layers[i].clip && (i === 0)) layers[i].clip = false;
  const bytes = PSD.writePSD({ width: D.w, height: D.h, dpi: D.dpi, composite: cx.getImageData(0, 0, D.w, D.h), layers });
  return new Blob([bytes], { type: 'image/vnd.adobe.photoshop' });
}
function canvasBlob(c, type, q) { return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('이미지를 만들 수 없습니다.'))), type, q)); }
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function safeName() { return (D.name || '그림').replace(/[\\/:*?"<>|]+/g, '_'); }

async function serializeProject() {
  const layers = [];
  for (const L of D.layers) {
    layers.push({ ...Object.fromEntries(PROPS.map(k => [k, L[k]])), paper: L.paper, data: L.canvas.toDataURL('image/png') });
  }
  return { format: 'webpaint', version: 1, name: D.name, width: D.w, height: D.h, dpi: D.dpi, active: D.layers.findIndex(L => L.id === D.activeId), layers };
}
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('이미지를 읽을 수 없습니다.')); i.src = src; });
}
async function loadProject(p) {
  if (p.format !== 'webpaint') throw new Error('WebPaint 프로젝트 파일이 아닙니다.');
  newDocument(p.width, p.height, p.dpi, '#ffffff', p.name);
  D.layers = [];
  for (const o of p.layers) {
    const L = newLayer({ name: o.name });
    for (const k of PROPS) if (k in o) L[k] = o[k];
    L.paper = !!o.paper;
    const src = o.data instanceof Blob ? URL.createObjectURL(o.data) : o.data;
    const img = await loadImage(src);
    L.ctx.drawImage(img, 0, 0);
    if (o.data instanceof Blob) URL.revokeObjectURL(src);
    D.layers.push(L);
  }
  D.nameSeq = D.layers.length;
  D.activeId = (D.layers[p.active] || D.layers[D.layers.length - 1]).id;
  H.clear(); markDirty(); renderLayers();
  for (const L of D.layers) queueThumb(L);
}
async function loadPSD(buf, name) {
  const doc = PSD.readPSD(new Uint8Array(buf));
  newDocument(doc.width, doc.height, doc.dpi, null, name);
  D.layers = [];
  const put = (L, rgba, x, y, w, h) => {
    if (!w || !h) return;
    const id = new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h);
    L.ctx.putImageData(id, x, y);
  };
  if (doc.layers.length) {
    for (const o of doc.layers) {
      const L = newLayer({ name: o.name, opacity: o.opacity, blend: o.blend, visible: !o.hidden, clip: o.clip, alphaLock: o.alphaLock });
      put(L, o.rgba, o.x, o.y, o.w, o.h);
      D.layers.push(L);
    }
  } else {
    const L = newLayer({ name: '배경' });
    put(L, doc.composite, 0, 0, doc.width, doc.height);
    D.layers.push(L);
  }
  D.activeId = D.layers[D.layers.length - 1].id;
  H.clear(); markDirty(); renderLayers();
  for (const L of D.layers) queueThumb(L);
}
async function openFile(file, asLayer) {
  try {
    const n = file.name.toLowerCase();
    if (n.endsWith('.psd')) {
      if (asLayer) { toast('PSD는 파일 > 열기로 열어 주세요.', true); return; }
      await loadPSD(await file.arrayBuffer(), file.name.replace(/\.psd$/i, ''));
      toast('PSD를 열었습니다.');
    } else if (n.endsWith('.wpaint') || n.endsWith('.json')) {
      await loadProject(JSON.parse(await file.text()));
      toast('프로젝트를 열었습니다.');
    } else if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = await loadImage(url);
      URL.revokeObjectURL(url);
      if (asLayer) {
        const c = mkCanvas(img.naturalWidth, img.naturalHeight); c.getContext('2d').drawImage(img, 0, 0);
        pasteCanvas(c, null, null, file.name.replace(/\.[^.]+$/, ''));
      } else {
        newDocument(img.naturalWidth, img.naturalHeight, 72, '#ffffff', file.name.replace(/\.[^.]+$/, ''));
        const L = active(); L.name = '배경'; L.ctx.drawImage(img, 0, 0);
        markDirty(); renderLayers(); queueThumb(L);
      }
    } else toast('열 수 없는 파일 형식입니다.', true);
  } catch (e) { console.error(e); toast(e.message || '파일을 열지 못했습니다.', true); }
}

/* ================= 자동 저장 (IndexedDB) ================= */
let dirtySinceSave = false;
const Autosave = {
  timer: 0, db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const q = indexedDB.open('webpaint', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('kv');
      q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
    });
    return this.db;
  },
  async put(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), 2500); },
  async save() {
    if (drag || A.float) { this.schedule(); return; }
    try {
      const layers = [];
      for (const L of D.layers) layers.push({ ...Object.fromEntries(PROPS.map(k => [k, L[k]])), paper: L.paper, data: await canvasBlob(L.canvas, 'image/png') });
      await this.put('current', { format: 'webpaint', version: 1, name: D.name, width: D.w, height: D.h, dpi: D.dpi, active: D.layers.findIndex(L => L.id === D.activeId), layers, savedAt: Date.now() });
      dirtySinceSave = false;
      updateStatus();
    } catch (e) { console.warn('자동 저장 실패', e); }
  },
  async restore() {
    try { const p = await this.get('current'); if (p && p.layers && p.layers.length) { await loadProject(p); return true; } } catch (e) { console.warn(e); }
    return false;
  },
};
document.addEventListener('visibilitychange', () => { if (document.hidden && dirtySinceSave) Autosave.save(); });

/* ================= 포인터 입력 ================= */
let drag = null;
const touches = new Map();
let gesture = null;
function localPos(e) { const r = vc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function pressureOf(e) { return e.pointerType === 'pen' ? (e.pressure || 0) : 1; }

const HANDLERS = {
  brush: {
    down(e, s) {
      const L = active();
      if (!canPaint(L)) return false;
      const b = curSub(), d = s2d(s.x, s.y);
      A.layerId = L.id; A.overlay = brushOverlay(b);
      const st = new Stroke(T.buffer.ctx, b, { sym: S.sym, noStab: e.shiftKey });
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
      for (const ev of (evs.length ? evs : [e])) { const s = localPos(ev), d = s2d(s.x, s.y); drag.stroke.addRaw(d.x, d.y, pressureOf(ev)); }
      markDirty(drag.stroke.takeDirty());
    },
    up() {
      const st = drag.stroke;
      if (!drag.line) st.finish();
      markDirty(st.takeDirty());
      const last = st.pts[st.pts.length - 1];
      if (last) lastStrokeEnd = { layer: active().id, pt: last };
      commitOverlay(curSub().name, st.bbox);
      if (!st.b.eraser) pushColorHistory();
    },
    cancel() { const st = drag.stroke; if (st && st.bbox) { T.buffer.ctx.clearRect(st.bbox.x, st.bbox.y, st.bbox.w, st.bbox.h); markDirty(st.bbox); } A.overlay = null; },
  },
  fill: { down(e, s) { const d = s2d(s.x, s.y); fillAt(d.x, d.y, curSub()); return false; } },
  wand: {
    down(e, s) {
      const d = s2d(s.x, s.y), o = curSub(), m = floodRegion(d.x, d.y, o);
      if (!m) return false;
      const c = maskToCanvas(m, D.w, D.h);
      const op = e.shiftKey ? 'add' : e.altKey ? 'sub' : o.mode;
      selApply('자동 선택', op, x => x.drawImage(c, 0, 0));
      return false;
    },
  },
  eyedropper: {
    down(e, s) { this.pick(s); },
    move(e) { this.pick(localPos(e)); },
    up() { pushColorHistory(); },
    pick(s) {
      const d = s2d(s.x, s.y), x = Math.floor(d.x), y = Math.floor(d.y);
      if (x < 0 || y < 0 || x >= D.w || y >= D.h) return;
      const src = (S.temp ? 'display' : curSub().source) === 'layer' ? active().canvas : comp.canvas;
      const t = T.read.ctx; t.clearRect(0, 0, 1, 1); t.drawImage(src, x, y, 1, 1, 0, 0, 1, 1);
      const p = t.getImageData(0, 0, 1, 1).data;
      if (p[3] === 0) return;
      setCurColor([p[0], p[1], p[2]]);
    },
  },
  gradient: {
    down(e, s) {
      if (!canPaint()) return false;
      drag.a = s2d(s.x, s.y); drag.b = drag.a;
      drag.preview = (ctx, px) => {
        ctx.beginPath(); ctx.moveTo(drag.a.x, drag.a.y); ctx.lineTo(drag.b.x, drag.b.y);
        ctx.lineWidth = 1.5 * px; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([]);
      };
    },
    move(e) { drag.b = s2d(...Object.values(localPos(e))); this.render(e.shiftKey); },
    render(snap) {
      const o = curSub(), a = drag.a; let b = drag.b;
      if (snap) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x), st = Math.PI / 4, len = Math.hypot(b.x - a.x, b.y - a.y), q = Math.round(ang / st) * st;
        b = { x: a.x + Math.cos(q) * len, y: a.y + Math.sin(q) * len }; drag.b = b;
      }
      const ctx = T.buffer.ctx, L = active();
      ctx.clearRect(0, 0, D.w, D.h);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1) { A.overlay = null; markDirty(); return; }
      const g = o.shape === 'radial' ? ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, len) : ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      const from = C.cur === 'sub' ? C.sub : C.main, to = C.cur === 'sub' ? C.main : C.sub;
      g.addColorStop(0, hex(from));
      g.addColorStop(1, o.to === 'trans' ? `rgba(${from.join(',')},0)` : hex(to));
      ctx.fillStyle = g; ctx.fillRect(0, 0, D.w, D.h);
      A.layerId = L.id;
      A.overlay = { canvas: T.buffer.canvas, color: null, mode: L.alphaLock ? 'source-atop' : 'source-over', alpha: o.opacity, useSel: true };
      markDirty();
    },
    up() { if (A.overlay) { commitOverlay('그라데이션', Rect.full()); pushColorHistory(); } },
    cancel() { T.buffer.ctx.clearRect(0, 0, D.w, D.h); A.overlay = null; markDirty(); },
  },
  select: {
    down(e, s) {
      const o = curSub();
      drag.op = e.shiftKey ? 'add' : e.altKey ? 'sub' : o.mode;
      drag.shape = o.shape;
      drag.pts = [s2d(s.x, s.y)];
      drag.preview = (ctx, px) => {
        const p = drag.pts;
        ctx.beginPath();
        if (drag.shape === 'lasso') { ctx.moveTo(p[0].x, p[0].y); for (const q of p) ctx.lineTo(q.x, q.y); }
        else { const r = this.rect(); if (drag.shape === 'rect') ctx.rect(r.x, r.y, r.w, r.h); else ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2); }
        ctx.lineWidth = px; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.setLineDash([4 * px, 4 * px]); ctx.strokeStyle = '#000'; ctx.stroke(); ctx.setLineDash([]);
      };
    },
    rect() {
      const a = drag.pts[0], b = drag.pts[drag.pts.length - 1];
      let w = b.x - a.x, h = b.y - a.y;
      if (drag.square) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
      return { x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h) };
    },
    move(e) {
      const d = s2d(...Object.values(localPos(e)));
      drag.square = e.shiftKey && drag.op !== 'add';
      if (drag.shape === 'lasso') drag.pts.push(d); else drag.pts[1] = d;
      requestRender();
    },
    up() {
      const p = drag.pts;
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
    cancel() { requestRender(); },
  },
  move: {
    down(e, s) {
      if (!beginFloat('move')) return false;
      drag.start = s2d(s.x, s.y);
    },
    move(e) {
      const d = s2d(...Object.values(localPos(e)));
      A.float.tx = Math.round(d.x - drag.start.x); A.float.ty = Math.round(d.y - drag.start.y);
      floatDirty();
    },
    up() { if (A.float.tx || A.float.ty) commitFloat('레이어 이동'); else cancelFloat(); },
    cancel() { cancelFloat(); },
  },
  transform: {
    down(e, s) {
      const f = A.float, c = tfCorners();
      let hit = -1;
      c.forEach((p, i) => { if (Math.hypot(p.x - s.x, p.y - s.y) < 10) hit = i; });
      const poly = [c[0], c[2], c[4], c[6]];
      const d = s2d(s.x, s.y), center = { x: f.x + f.w / 2 + f.tx, y: f.y + f.h / 2 + f.ty };
      drag.f0 = { ...f }; drag.d0 = d; drag.center = center;
      if (hit >= 0) { drag.mode = 'scale'; drag.h = TF_HANDLES[hit]; }
      else if (pointInPoly(s, poly)) drag.mode = 'move';
      else { drag.mode = 'rotate'; drag.a0 = Math.atan2(d.y - center.y, d.x - center.x); }
    },
    move(e) {
      const f = A.float, f0 = drag.f0, d = s2d(...Object.values(localPos(e)));
      if (drag.mode === 'move') { f.tx = f0.tx + d.x - drag.d0.x; f.ty = f0.ty + d.y - drag.d0.y; }
      else if (drag.mode === 'rotate') {
        let r = f0.rot + (Math.atan2(d.y - drag.center.y, d.x - drag.center.x) - drag.a0) * 180 / Math.PI;
        if (e.shiftKey) r = Math.round(r / 15) * 15;
        f.rot = r;
      } else {
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
  },
  hand: {
    down(e, s) { drag.prev = s; },
    move(e) { const s = localPos(e), a = s2d(drag.prev.x, drag.prev.y), b = s2d(s.x, s.y); V.cx += a.x - b.x; V.cy += a.y - b.y; drag.prev = s; viewChanged(); },
  },
  rotate: {
    down(e, s) { drag.a0 = Math.atan2(s.y - V.h / 2, s.x - V.w / 2); drag.r0 = V.rot; },
    move(e) {
      const s = localPos(e);
      let r = drag.r0 + (Math.atan2(s.y - V.h / 2, s.x - V.w / 2) - drag.a0) * 180 / Math.PI;
      if (e.shiftKey) r = Math.round(r / 15) * 15;
      rotateTo(r);
    },
  },
  zoom: {
    down(e, s) { drag.s0 = s; drag.z0 = V.zoom; drag.moved = false; drag.out = e.altKey; },
    move(e) {
      const s = localPos(e), dx = s.x - drag.s0.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      if (drag.moved) zoomAt(drag.z0 * Math.pow(1.01, dx), drag.s0.x, drag.s0.y);
    },
    up() { if (!drag.moved) zoomStep(drag.out ? -1 : 1, drag.s0.x, drag.s0.y); },
  },
};

vc.addEventListener('pointerdown', e => {
  if (Modal.isOpen()) return;
  closeMenus();
  const s = localPos(e);
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, s);
    if (touches.size === 2) { abortDrag(); startGesture(); return; }
    if (touches.size > 2) return;
  }
  if (drag || gesture) return;
  if (e.button === 2) return;
  e.preventDefault();
  vc.setPointerCapture(e.pointerId);
  let kind = e.button === 1 ? 'hand' : (A.float && A.float.kind === 'transform' ? 'transform' : effKind());
  drag = { kind, id: e.pointerId };
  const h = HANDLERS[kind];
  if (!h || h.down(e, s) === false) { drag = null; requestRender(); return; }
  updateStatus(e);
  requestRender();
});
vc.addEventListener('pointermove', e => {
  const s = localPos(e);
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) { touches.set(e.pointerId, s); if (gesture) { moveGesture(); return; } }
  hover = s;
  if (drag && drag.id === e.pointerId) { const h = HANDLERS[drag.kind]; if (h.move) h.move(e); }
  else requestRender();
  updateStatus(e);
});
function endPointer(e, cancelled) {
  if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (gesture) { if (touches.size < 2) gesture = null; return; } }
  if (!drag || drag.id !== e.pointerId) return;
  const h = HANDLERS[drag.kind];
  if (cancelled) { if (h.cancel) h.cancel(); }
  else if (h.up) h.up(e);
  drag = null;
  requestRender();
  updateCursor();
}
vc.addEventListener('pointerup', e => endPointer(e, false));
vc.addEventListener('pointercancel', e => endPointer(e, true));
vc.addEventListener('pointerleave', () => { hover = null; requestRender(); });
vc.addEventListener('contextmenu', e => e.preventDefault());
function abortDrag() {
  if (!drag) return;
  const h = HANDLERS[drag.kind];
  if (h.cancel) h.cancel();
  drag = null; requestRender();
}
function startGesture() {
  const [a, b] = [...touches.values()];
  gesture = { a0: a, b0: b, z0: V.zoom, r0: V.rot, d0: Math.hypot(b.x - a.x, b.y - a.y), ang0: Math.atan2(b.y - a.y, b.x - a.x), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, doc: s2d((a.x + b.x) / 2, (a.y + b.y) / 2) };
}
function moveGesture() {
  const [a, b] = [...touches.values()], g = gesture;
  if (!a || !b) return;
  const d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  V.zoom = clamp(g.z0 * d / Math.max(1, g.d0), .02, 64);
  V.rot = g.r0 + (ang - g.ang0) * 180 / Math.PI;
  const q = s2d(m.x, m.y);
  V.cx += g.doc.x - q.x; V.cy += g.doc.y - q.y;
  viewChanged();
}
vc.addEventListener('wheel', e => {
  e.preventDefault();
  const s = localPos(e);
  if (e.ctrlKey || e.metaKey) zoomAt(V.zoom * Math.exp(-e.deltaY * .01), s.x, s.y);
  else if (e.deltaX !== 0 || (e.deltaMode === 0 && Math.abs(e.deltaY) < 40 && !Number.isInteger(e.deltaY))) {
    const a = s2d(0, 0), b = s2d(e.deltaX, e.deltaY); V.cx += b.x - a.x; V.cy += b.y - a.y; viewChanged();
  } else if (e.shiftKey) { const a = s2d(0, 0), b = s2d(e.deltaY, 0); V.cx += b.x - a.x; V.cy += b.y - a.y; viewChanged(); }
  else zoomStep(e.deltaY < 0 ? 1 : -1, s.x, s.y);
}, { passive: false });

function updateCursor() {
  const k = effKind();
  vc.style.cursor = { hand: drag ? 'grabbing' : 'grab', zoom: 'zoom-in', move: 'move', rotate: 'alias', brush: 'crosshair', eyedropper: 'crosshair', fill: 'crosshair', wand: 'crosshair', select: 'crosshair', gradient: 'crosshair' }[k] || 'default';
  if (A.float && A.float.kind === 'transform') vc.style.cursor = 'default';
}

/* ================= 키보드 ================= */
function keyName(e) {
  let k = e.key;
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (e.code === 'Equal' || e.code === 'NumpadAdd') k = '+';
  else if (e.code === 'Minus' || e.code === 'NumpadSubtract') k = '-';
  else if (e.code === 'BracketLeft') k = '[';
  else if (e.code === 'BracketRight') k = ']';
  else if (e.code === 'Slash') k = '/';
  else if (k.length === 1) k = k.toUpperCase();
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + k;
}
const CMDS = {}; // id → {label, keys, run, enabled}
function cmd(id, label, keys, run, extra = {}) { CMDS[id] = { id, label, keys: keys ? [].concat(keys) : [], run, ...extra }; }
function runCmd(id) { const c = CMDS[id]; if (!c) return; if (c.enabled && !c.enabled()) return; c.run(); }
function setTool(id, subId) {
  if (A.float && A.float.kind === 'transform') return;
  S.toolId = id;
  if (subId) S.subOf[id] = subId;
  store.set('tool', id); store.set('subOf', S.subOf);
  ToolUI.render(); updateCursor(); requestRender();
}
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') { if (e.key === 'Escape') e.target.blur(); return; }
  if (Modal.isOpen()) { if (e.key === 'Escape') Modal.dismiss(); return; }
  const k = keyName(e);
  if (A.float && A.float.kind === 'transform') {
    if (e.key === 'Enter') { e.preventDefault(); commitFloat('확대/축소/회전'); return; }
    if (e.key === 'Escape') { e.preventDefault(); cancelFloat(); return; }
  }
  if (e.key === ' ' && !e.repeat) {
    e.preventDefault();
    S.temp = (e.ctrlKey || e.metaKey) ? 'zoom' : e.shiftKey ? 'rotate' : 'hand';
    updateCursor(); return;
  }
  if (e.key === ' ') { e.preventDefault(); return; }
  if (e.key === 'Alt') {
    e.preventDefault();
    if (['brush', 'fill', 'gradient'].includes(baseKind()) && !drag) { S.temp = 'eyedropper'; updateCursor(); }
    return;
  }
  for (const c of Object.values(CMDS)) {
    if (c.keys.includes(k)) { e.preventDefault(); runCmd(c.id); return; }
  }
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const key = e.shiftKey ? null : k;
    const group = TOOL_LIST.filter(t => t.key === key);
    if (group.length) {
      e.preventDefault();
      const i = group.findIndex(t => t.id === S.toolId);
      setTool(group[(i + 1) % group.length].id);
      return;
    }
    if (k === 'R') { e.preventDefault(); setTool('hand', 'rotate'); return; }
  }
});
window.addEventListener('keyup', e => {
  if (e.key === ' ' || e.key === 'Alt' || e.key === 'Control' || e.key === 'Meta' || e.key === 'Shift') {
    if (e.key === ' ' || (e.key === 'Alt' && S.temp === 'eyedropper')) { S.temp = null; updateCursor(); }
  }
});
window.addEventListener('blur', () => { S.temp = null; updateCursor(); });

function brushSize(mul) {
  const s = curSub();
  if (!('size' in s)) return;
  s.size = clamp(+(s.size * mul).toFixed(1), .5, 1000);
  saveSubs(); PropUI.render(); requestRender();
}

cmd('new', '새로 만들기…', 'Ctrl+N', () => Dialogs.newDoc());
cmd('open', '열기…', 'Ctrl+O', () => $('#file-open').click());
cmd('saveProject', '프로젝트 저장 (.wpaint)', 'Ctrl+S', async () => {
  const p = await serializeProject();
  download(new Blob([JSON.stringify(p)], { type: 'application/json' }), safeName() + '.wpaint');
  Autosave.save();
  toast('프로젝트를 저장했습니다.');
});
cmd('export', '내보내기 (PNG · PSD · JPEG)…', 'Ctrl+Shift+S', () => Dialogs.exportDlg());
cmd('quickPng', 'PNG로 바로 내보내기', 'Ctrl+Shift+E', async () => {
  download(await canvasBlob(exportComposite({}), 'image/png'), safeName() + '.png');
  toast('PNG로 내보냈습니다. 숨긴 레이어와 밑그림 레이어는 제외됩니다.');
});
cmd('quickPsd', 'PSD로 바로 내보내기', null, () => { download(buildPSD({}), safeName() + '.psd'); toast('PSD로 내보냈습니다. 숨긴 레이어는 제외됩니다.'); });
cmd('import', '이미지를 레이어로 가져오기…', null, () => $('#file-import').click());
cmd('pressure', '필압 검출 레벨 조절…', null, () => Dialogs.pressure());
cmd('undo', '실행 취소', 'Ctrl+Z', () => H.undo(), { enabled: () => H.idx > 0 || !!A.float });
cmd('redo', '다시 실행', ['Ctrl+Y', 'Ctrl+Shift+Z'], () => H.redo(), { enabled: () => H.idx < H.stack.length });
cmd('cut', '잘라내기', 'Ctrl+X', () => copySel(true));
cmd('copy', '복사', 'Ctrl+C', () => copySel(false));
cmd('paste', '붙여넣기', null, () => { if (clipboard) pasteCanvas(clipboard.canvas, clipboard.x, clipboard.y); else toast('붙여넣을 내용이 없습니다.'); });
cmd('clear', '삭제', ['Delete', 'Backspace'], () => clearSelected(false));
cmd('clearOutside', '선택 범위 외 삭제', 'Shift+Delete', () => clearSelected(true), { enabled: () => Sel.has });
cmd('fillSel', '채우기', 'Alt+Backspace', () => fillSelection());
cmd('transform', '확대/축소/회전', 'Ctrl+T', () => startTransform());
cmd('flipH', '좌우 반전', null, () => flipLayer(true));
cmd('flipV', '상하 반전', null, () => flipLayer(false));
cmd('hsl', '색조·채도·명도…', 'Ctrl+U', () => openFilter('hsl'));
cmd('bc', '밝기·대비…', null, () => openFilter('bc'));
cmd('invert', '계조 반전', 'Ctrl+I', () => openFilter('invert'));
cmd('posterize', '포스터화…', null, () => openFilter('posterize'));
cmd('blur', '가우시안 흐리기…', null, () => openFilter('blur'));
cmd('mosaic', '모자이크…', null, () => openFilter('mosaic'));
cmd('newLayer', '신규 래스터 레이어', 'Ctrl+Shift+N', addLayer);
cmd('dupLayer', '레이어 복제', null, dupLayer);
cmd('delLayer', '레이어 삭제', null, delLayer);
cmd('mergeDown', '아래 레이어와 결합', 'Ctrl+E', mergeDown);
cmd('mergeVisible', '표시 레이어 결합', 'Ctrl+Shift+Alt+E', mergeVisible);
cmd('layerUp', '레이어 위로', 'Ctrl+]', () => moveLayer(1));
cmd('layerDown', '레이어 아래로', 'Ctrl+[', () => moveLayer(-1));
cmd('clipLayer', '아래 레이어에서 클리핑', 'Ctrl+Alt+G', () => { const L = active(); setLayerProp(L, 'clip', !L.clip, '아래 레이어에서 클리핑'); }, { check: () => active() && active().clip });
cmd('alphaLock', '투명 픽셀 잠금', null, () => { const L = active(); setLayerProp(L, 'alphaLock', !L.alphaLock, '투명 픽셀 잠금'); }, { check: () => active() && active().alphaLock });
cmd('lockLayer', '레이어 잠금', null, () => { const L = active(); setLayerProp(L, 'locked', !L.locked, '레이어 잠금'); }, { check: () => active() && active().locked });
cmd('draftLayer', '밑그림 레이어로 설정', null, () => { const L = active(); setLayerProp(L, 'draft', !L.draft, '밑그림 레이어'); }, { check: () => active() && active().draft });
cmd('refLayer', '참조 레이어로 설정', null, () => { const L = active(); setLayerProp(L, 'ref', !L.ref, '참조 레이어'); }, { check: () => active() && active().ref });
cmd('selFromLayer', '레이어에서 선택 범위 작성', null, () => selFromLayer(active()));
cmd('selectAll', '전체 선택', 'Ctrl+A', selectAll);
cmd('deselect', '선택 해제', 'Ctrl+D', deselect, { enabled: () => Sel.has });
cmd('invertSel', '선택 범위 반전', 'Ctrl+Shift+I', invertSel, { enabled: () => Sel.has });
cmd('growSel', '선택 범위 확장…', null, () => Dialogs.grow(1));
cmd('shrinkSel', '선택 범위 축소…', null, () => Dialogs.grow(-1));
cmd('zoomIn', '확대', ['Ctrl++', 'Ctrl+Shift++'], () => zoomStep(1));
cmd('zoomOut', '축소', 'Ctrl+-', () => zoomStep(-1));
cmd('actual', '100%', 'Ctrl+Alt+0', () => zoomAt(1));
cmd('fit', '피팅', 'Ctrl+0', fitView);
cmd('resetRot', '회전·반전 초기화', null, () => { V.flip = false; rotateTo(0); updateCmdStates(); });
cmd('flipView', '좌우 반전 표시', null, () => { V.flip = !V.flip; viewChanged(); updateCmdStates(); }, { check: () => V.flip });
cmd('grid', '그리드', 'Ctrl+\'', () => { S.grid = !S.grid; requestRender(); }, { check: () => S.grid });
cmd('sym', '대칭 자 (좌우)', null, () => { S.sym = !S.sym; requestRender(); toast(S.sym ? '대칭 자를 켰습니다. 캔버스 중앙선을 기준으로 좌우 대칭으로 그려집니다.' : '대칭 자를 껐습니다.'); }, { check: () => S.sym });
cmd('swapColor', '메인/서브 컬러 전환', 'X', () => { C.cur = C.cur === 'main' ? 'sub' : 'main'; ColorUI.syncHsv(); ColorUI.update(); });
cmd('sizeDown', '브러시 크기 줄이기', '[', () => brushSize(1 / 1.15));
cmd('sizeUp', '브러시 크기 키우기', ']', () => brushSize(1.15));
cmd('shortcuts', '단축키 목록', 'F1', () => Dialogs.shortcuts());
cmd('about', 'WebPaint 정보', null, () => Dialogs.about());

const MENUS = [
  ['파일', ['new', 'open', '-', 'saveProject', 'export', 'quickPng', 'quickPsd', '-', 'import', '-', 'pressure']],
  ['편집', ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'clear', 'clearOutside', 'fillSel', '-', 'transform', 'flipH', 'flipV', '-', 'hsl', 'bc', 'invert', 'posterize']],
  ['레이어', ['newLayer', 'dupLayer', 'delLayer', '-', 'mergeDown', 'mergeVisible', '-', 'layerUp', 'layerDown', '-', 'clipLayer', 'alphaLock', 'lockLayer', 'draftLayer', 'refLayer', '-', 'selFromLayer']],
  ['선택 범위', ['selectAll', 'deselect', 'invertSel', '-', 'growSel', 'shrinkSel']],
  ['표시', ['zoomIn', 'zoomOut', 'actual', 'fit', '-', 'resetRot', 'flipView', '-', 'grid', 'sym']],
  ['필터', ['blur', 'mosaic']],
  ['도움말', ['shortcuts', 'about']],
];

/* ================= 메뉴 UI ================= */
let openMenu = null;
function buildMenus() {
  const nav = $('#menus');
  for (const [name, items] of MENUS) {
    const b = el('button', { class: 'menu-btn', text: name });
    b.addEventListener('pointerdown', e => { e.preventDefault(); openMenu === b ? closeMenus() : showMenu(b, items); });
    b.addEventListener('pointerenter', () => { if (openMenu && openMenu !== b) showMenu(b, items); });
    nav.append(b);
  }
  document.addEventListener('pointerdown', e => { if (openMenu && !e.target.closest('.menupop') && !e.target.closest('.menu-btn')) closeMenus(); });
}
function showMenu(b, items) {
  closeMenus();
  openMenu = b; b.classList.add('open');
  const pop = $('#menupop');
  pop.innerHTML = '';
  for (const id of items) {
    if (id === '-') { pop.append(el('div', { class: 'msep' })); continue; }
    const c = CMDS[id];
    const dis = c.enabled && !c.enabled();
    const it = el('button', { class: 'mi', disabled: dis },
      el('span', { class: 'chk', text: c.check && c.check() ? '✓' : '' }),
      el('span', { class: 'lbl', text: c.label }),
      el('kbd', { text: (c.keys[0] || '').replace('Ctrl+', isMac ? '⌘' : 'Ctrl+') }));
    it.addEventListener('click', () => { closeMenus(); runCmd(id); });
    pop.append(it);
  }
  pop.hidden = false;
  const r = b.getBoundingClientRect();
  pop.style.left = Math.min(r.left, innerWidth - pop.offsetWidth - 8) + 'px';
  pop.style.top = r.bottom + 2 + 'px';
  pop.style.maxHeight = (innerHeight - r.bottom - 12) + 'px';
  pop.style.overflowY = 'auto';
}
function closeMenus() { if (openMenu) openMenu.classList.remove('open'); openMenu = null; $('#menupop').hidden = true; }
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/* ================= 모달 ================= */
const Modal = {
  onDismiss: null,
  isOpen() { return !$('#modal-back').hidden; },
  open(title, body, buttons, opts = {}) {
    const m = $('#modal-back .modal');
    m.className = 'modal' + (opts.wide ? ' wide' : '');
    m.innerHTML = '';
    m.append(el('h3', { text: title }), el('div', { class: 'mb' }, body),
      el('div', { class: 'mf' }, buttons.map(([label, fn, primary]) => el('button', { class: 'cmd' + (primary ? ' accent' : ''), text: label, onclick: fn }))));
    this.onDismiss = opts.onDismiss || null;
    $('#modal-back').hidden = false;
    const f = m.querySelector('input,select'); if (f && !opts.noFocus) f.focus();
  },
  close() { $('#modal-back').hidden = true; this.onDismiss = null; },
  dismiss() { const d = this.onDismiss; this.close(); if (d) d(); },
};
$('#modal-back').addEventListener('pointerdown', e => { if (e.target.id === 'modal-back') Modal.dismiss(); });

const Dialogs = {
  newDoc() {
    const w = el('input', { type: 'number', min: 16, max: 10000, value: 1600 });
    const h = el('input', { type: 'number', min: 16, max: 10000, value: 1200 });
    const dpi = el('input', { type: 'number', min: 72, max: 1200, value: 350 });
    const name = el('input', { type: 'text', value: '제목 없음' });
    const paper = el('input', { type: 'color', value: '#ffffff' });
    const noPaper = el('input', { type: 'checkbox' });
    const presets = [['1600×1200', 1600, 1200, 350], ['일러스트 2000×2000', 2000, 2000, 350], ['FHD 1920×1080', 1920, 1080, 72], ['A4 350dpi', 2894, 4093, 350], ['B5 350dpi', 2508, 3541, 350], ['웹툰 690×5000', 690, 5000, 72]];
    Modal.open('새 캔버스', [
      el('div', { class: 'preset-row' }, presets.map(([l, pw, ph, pd]) => el('button', { class: 'cmd', text: l, onclick: () => { w.value = pw; h.value = ph; dpi.value = pd; } }))),
      el('div', { class: 'frow' }, el('span', { text: '파일명' }), name),
      el('div', { class: 'frow' }, el('span', { text: '폭 × 높이 (px)' }), el('div', { class: 'inline' }, w, el('span', { text: '×' }), h)),
      el('div', { class: 'frow' }, el('span', { text: '해상도 (dpi)' }), dpi),
      el('div', { class: 'frow' }, el('span', { text: '용지 색' }), el('div', { class: 'inline' }, paper, el('label', { class: 'pcheck' }, noPaper, '용지 없음 (투명)'))),
      el('p', { class: 'note', text: '현재 작업은 새 캔버스로 바뀝니다. 필요하면 먼저 저장하세요.' }),
    ], [
      ['취소', () => Modal.close()],
      ['만들기', () => {
        const W = clamp(+w.value || 1600, 16, 10000), Hh = clamp(+h.value || 1200, 16, 10000);
        if (W * Hh > 40e6) { toast('캔버스가 너무 큽니다. 4,000만 픽셀 이하로 지정해 주세요.', true); return; }
        Modal.close();
        newDocument(W, Hh, +dpi.value || 350, noPaper.checked ? null : paper.value, name.value.trim() || '제목 없음');
        Autosave.schedule();
      }, true],
    ]);
  },
  exportDlg() {
    const fmt = el('select', {}, ['PNG', 'PSD', 'JPEG', 'WebP'].map(f => el('option', { value: f, text: f })));
    fmt.value = store.get('exportFmt', 'PNG');
    const scale = el('input', { type: 'number', min: 5, max: 400, value: 100 });
    const quality = el('input', { type: 'number', min: 10, max: 100, value: 92 });
    const incDraft = el('input', { type: 'checkbox' });
    const incHidden = el('input', { type: 'checkbox' });
    const name = el('input', { type: 'text', value: safeName() });
    const img = el('img', { class: 'export-preview', alt: '내보내기 미리보기' });
    const info = el('p', { class: 'note' });
    const hiddenCount = D.layers.filter(L => !L.visible).length;
    const scaleRow = el('div', { class: 'frow' }, el('span', { text: '크기 (%)' }), scale);
    const qRow = el('div', { class: 'frow' }, el('span', { text: '품질' }), quality);
    const hidRow = el('div', { class: 'frow' }, el('span', { text: '숨긴 레이어' }), el('label', { class: 'pcheck' }, incHidden, '숨김 상태로 PSD에 포함'));
    let url = null;
    const refresh = async () => {
      const f = fmt.value;
      scaleRow.hidden = f === 'PSD'; qRow.hidden = !(f === 'JPEG' || f === 'WebP'); hidRow.hidden = f !== 'PSD';
      const c = exportComposite({ includeDraft: incDraft.checked });
      const prev = scaled(c, Math.min(1, 640 / Math.max(c.width, c.height)), f === 'JPEG' ? '#ffffff' : null);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(await canvasBlob(prev, 'image/png'));
      img.src = url;
      const excluded = [hiddenCount && (f === 'PSD' && incHidden.checked ? `숨긴 레이어 ${hiddenCount}개는 숨김 상태로 들어갑니다` : `숨긴 레이어 ${hiddenCount}개는 내보내지 않습니다`),
        !incDraft.checked && D.layers.some(L => L.draft) && '밑그림 레이어는 제외됩니다'].filter(Boolean);
      info.textContent = f === 'PSD'
        ? `레이어 구조(이름·불투명도·합성 모드·클리핑)를 유지한 PSD로 저장합니다. ${excluded.join(' · ')}`
        : `보이는 레이어만 합쳐 한 장의 이미지로 저장합니다. ${excluded.join(' · ')}`;
    };
    [fmt, incDraft, incHidden].forEach(x => x.addEventListener('change', refresh));
    refresh();
    const doExport = async () => {
      const f = fmt.value, base = (name.value.trim() || safeName()).replace(/[\\/:*?"<>|]+/g, '_');
      store.set('exportFmt', f);
      try {
        if (f === 'PSD') {
          download(buildPSD({ includeDraft: incDraft.checked, includeHidden: incHidden.checked }), base + '.psd');
        } else {
          const s = clamp(+scale.value || 100, 5, 400) / 100;
          const c = scaled(exportComposite({ includeDraft: incDraft.checked }), s, f === 'JPEG' ? '#ffffff' : null);
          const type = { PNG: 'image/png', JPEG: 'image/jpeg', WebP: 'image/webp' }[f];
          download(await canvasBlob(c, type, clamp(+quality.value || 92, 10, 100) / 100), base + '.' + (f === 'JPEG' ? 'jpg' : f.toLowerCase()));
        }
        toast(f + ' 파일로 내보냈습니다.');
        Modal.close();
      } catch (e) { console.error(e); toast('내보내기에 실패했습니다: ' + e.message, true); }
    };
    const copyPng = async () => {
      try {
        const b = await canvasBlob(exportComposite({ includeDraft: incDraft.checked }), 'image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
        toast('PNG 이미지를 클립보드에 복사했습니다.');
      } catch { toast('이 환경에서는 클립보드 복사가 허용되지 않습니다. 미리보기를 우클릭하거나 길게 눌러 저장하세요.', true); }
    };
    Modal.open('내보내기', [
      img, info,
      el('div', { class: 'frow' }, el('span', { text: '형식' }), fmt),
      el('div', { class: 'frow' }, el('span', { text: '파일명' }), name),
      scaleRow, qRow,
      el('div', { class: 'frow' }, el('span', { text: '밑그림 레이어' }), el('label', { class: 'pcheck' }, incDraft, '출력에 포함')),
      hidRow,
    ], [['클립보드에 PNG 복사', copyPng], ['닫기', () => Modal.close()], ['내보내기', doExport, true]], { wide: true, noFocus: true });
  },
  grow(sign) {
    const n = el('input', { type: 'number', min: 1, max: 200, value: 4 });
    Modal.open(sign > 0 ? '선택 범위 확장' : '선택 범위 축소', [el('div', { class: 'frow' }, el('span', { text: (sign > 0 ? '확장' : '축소') + ' 폭 (px)' }), n)], [
      ['취소', () => Modal.close()], ['확인', () => { Modal.close(); growSel(sign * clamp(+n.value || 1, 1, 200)); }, true]]);
  },
  pressure() {
    const g = el('input', { type: 'range', min: .3, max: 3, step: .05, value: S.pressureGamma, style: 'width:100%;accent-color:var(--accent)' });
    const graph = mkCanvas(200, 200); graph.style.cssText = 'width:160px;height:160px;justify-self:center;background:var(--bg);border-radius:6px';
    const draw = () => {
      const x = graph.getContext('2d'); x.clearRect(0, 0, 200, 200);
      x.strokeStyle = '#3d4047'; x.strokeRect(.5, .5, 199, 199);
      x.beginPath(); for (let i = 0; i <= 50; i++) { const p = i / 50, v = Math.pow(p, +g.value); x.lineTo(p * 200, 200 - v * 200); }
      x.strokeStyle = '#e3a446'; x.lineWidth = 2; x.stroke();
    };
    g.addEventListener('input', draw); draw();
    Modal.open('필압 검출 레벨 조절', [
      graph,
      el('div', { class: 'frow' }, el('span', { text: '부드럽게 ↔ 딱딱하게' }), g),
      el('p', { class: 'note', text: '왼쪽으로 옮기면 약한 필압에도 굵고 진하게, 오른쪽으로 옮기면 강하게 눌러야 굵어집니다. 마우스와 손가락 입력은 필압 최대값으로 그려집니다.' }),
    ], [['취소', () => Modal.close()], ['확인', () => { S.pressureGamma = +g.value; store.set('pgamma', S.pressureGamma); Modal.close(); }, true]], { noFocus: true });
  },
  shortcuts() {
    const rows = [
      ['펜 / 연필 전환', 'P'], ['붓 / 에어브러시 전환', 'B'], ['지우개', 'E'], ['채우기 / 그라데이션', 'G'], ['선택 범위', 'M'], ['자동 선택', 'W'], ['스포이트', 'I (그리는 중 Alt)'],
      ['레이어 이동', 'K'], ['손바닥', 'H (임시: Space)'], ['회전', 'R (임시: Shift+Space)'], ['돋보기', '/ (임시: Ctrl+Space)'], ['브러시 크기', '[ ]'], ['직선 긋기', '이전 획 끝에서 Shift+클릭'],
      ['선택 범위 추가 / 빼기', 'Shift / Alt + 드래그'], ['변형 확정 / 취소', 'Enter / Esc'], ['메인/서브 컬러 전환', 'X'],
      ...Object.values(CMDS).filter(c => c.keys.length && c.keys[0].includes('Ctrl')).map(c => [c.label.replace('…', ''), c.keys[0]]),
      ['두 손가락', '캔버스 이동·확대·회전'],
    ];
    Modal.open('단축키 목록', el('table', { class: 'kbd-table' }, rows.map(([a, b]) => el('tr', {}, el('td', { text: a }), el('td', { text: b })))), [['닫기', () => Modal.close(), true]], { wide: true, noFocus: true });
  },
  about() {
    Modal.open('WebPaint 정보', [
      el('p', { class: 'note', text: 'CLIP STUDIO PAINT의 작업 방식(보조 도구, 레이어 클리핑, 밑그림·참조 레이어, 컬러 써클)을 참고해 만든 독자적인 웹 드로잉 앱입니다. 클립 스튜디오의 로고·소재·파일 형식은 사용하지 않습니다.' }),
      el('p', { class: 'note', text: '작업은 이 브라우저에 자동 저장됩니다. 다른 기기로 옮기려면 파일 > 프로젝트 저장(.wpaint) 또는 PSD 내보내기를 사용하세요.' }),
    ], [['닫기', () => Modal.close(), true]], { noFocus: true });
  },
};

/* ================= 도구 · 보조 도구 · 도구 속성 UI ================= */
const ToolUI = {
  render() {
    const bar = $('#toolbar');
    bar.innerHTML = '';
    for (const t of TOOLS) {
      if (t === '-') { bar.append(el('div', { class: 'tsep' })); continue; }
      const b = el('button', { class: 'tool' + (t.id === S.toolId ? ' active' : ''), title: `${t.name} (${t.key})`, 'aria-label': t.name, html: `<svg viewBox="0 0 24 24">${ICONS[t.icon]}</svg><span class="key">${t.key}</span>` });
      b.addEventListener('click', () => setTool(t.id));
      bar.append(b);
    }
    const t = curTool(), list = $('#sublist');
    $('#subtool-title').textContent = t.name;
    list.innerHTML = '';
    for (const s of t.subs) {
      const b = el('button', { class: 'subitem' + (s === curSub() ? ' active' : '') }, el('span', { text: s.name }));
      if ((s.kind || t.kind) === 'brush') b.append(subPreview(s));
      b.addEventListener('click', () => setTool(t.id, s.id));
      list.append(b);
    }
    PropUI.render();
  },
};
function subPreview(s) {
  const c = mkCanvas(128, 28); c.className = 'preview';
  const x = c.getContext('2d'), b = { ...s, size: Math.min(s.size, 12) * 1.6, taperIn: 20, taperOut: 20 };
  const st = new Stroke(x, b, { noStab: true });
  st.total = 108;
  for (let i = 0; i <= 40; i++) { const t = i / 40; st.addPt({ x: 10 + t * 108, y: 14 + Math.sin(t * Math.PI * 2) * 6, p: Math.sin(t * Math.PI) }); }
  x.globalCompositeOperation = 'source-in'; x.fillStyle = '#e7e4dd'; x.fillRect(0, 0, 128, 28);
  return c;
}
const PropUI = {
  render() {
    const box = $('#props'), s = curSub(), kind = baseKind();
    $('#prop-title').textContent = s.name;
    box.innerHTML = '';
    const changed = () => { saveSubs(); requestRender(); };
    const slider = (key, label, min, max, step = 1, fmt = v => v, toV = v => v, fromV = v => v, log = false) => {
      const rng = el('input', { type: 'range', min: log ? 0 : min, max: log ? 1000 : max, step: log ? 1 : step });
      const num = el('input', { class: 'num', value: fmt(s[key]) });
      const toSlider = v => (log ? Math.round(Math.log(v / min) / Math.log(max / min) * 1000) : fromV(v));
      const fromSlider = v => (log ? +(min * Math.pow(max / min, v / 1000)).toFixed(1) : toV(+v));
      rng.value = toSlider(s[key]);
      rng.addEventListener('input', () => { s[key] = fromSlider(rng.value); num.value = fmt(s[key]); changed(); });
      num.addEventListener('change', () => { const v = parseFloat(num.value); if (!isNaN(v)) s[key] = clamp(toV(v), log ? min : toV(min), log ? max : toV(max)); num.value = fmt(s[key]); rng.value = toSlider(s[key]); changed(); });
      box.append(el('div', { class: 'prow' }, el('span', { text: label }), rng, num));
    };
    const pct = (key, label, min = 0, max = 100) => slider(key, label, min, max, 1, v => Math.round(v * 100), v => v / 100, v => Math.round(v * 100));
    const check = (key, label) => {
      const c = el('input', { type: 'checkbox' }); c.checked = !!s[key];
      c.addEventListener('change', () => { s[key] = c.checked; changed(); });
      box.append(el('label', { class: 'pcheck' }, c, label));
    };
    const seg = (key, label, opts) => {
      const wrap = el('div', { class: 'seg' });
      for (const [v, t] of opts) {
        const b = el('button', { class: s[key] === v ? 'on' : '', text: t });
        b.addEventListener('click', () => { s[key] = v; changed(); PropUI.render(); });
        wrap.append(b);
      }
      box.append(el('div', { class: 'prow' }, el('span', { text: label }), wrap));
    };
    if (kind === 'brush') {
      slider('size', '브러시 크기', .5, 1000, .1, v => v, v => v, v => v, true);
      pct('opacity', '불투명도');
      pct('flow', '브러시 농도', 1);
      if (s.tip !== 'flat') pct('hardness', '경도');
      slider('stab', '손떨림 보정', 0, 100);
      check('pSize', '필압으로 크기 조절');
      if (s.pSize) pct('minSize', '최소 크기', 1);
      check('pFlow', '필압으로 농도 조절');
      pct('spacing', '간격', 1, 100);
      slider('taperIn', '입력 보정', 0, 300);
      slider('taperOut', '출력 보정', 0, 300);
      if (s.tip === 'flat') { slider('angle', '브러시 각도', -90, 90); pct('aspect', '두께 비율', 5, 100); }
      if (!s.eraser) check('texture', '종이 질감');
      box.append(el('p', { class: 'hint', text: s.eraser ? '획 단위로 지웁니다. 선택 범위가 있으면 그 안만 지워집니다.' : '입력·출력 보정은 획의 시작과 끝을 가늘게 하는 길이(px)입니다. 이전 획 끝에서 Shift+클릭하면 직선이 그어집니다.' }));
    } else if (kind === 'fill' || kind === 'wand') {
      seg('ref', '참조', [['layer', '편집 레이어'], ['all', '모든 레이어'], ['ref', '참조 레이어']]);
      slider('tolerance', '색의 오차', 0, 100);
      slider('expand', '영역 확대', -20, 20);
      slider('gap', '틈 닫기', 0, 20);
      if (kind === 'fill') pct('opacity', '불투명도');
      else seg('mode', '선택 방식', [['new', '신규'], ['add', '추가'], ['sub', '삭제']]);
      box.append(el('p', { class: 'hint', text: kind === 'fill' ? '모든 레이어 참조 시 밑그림 레이어는 무시됩니다. 영역 확대로 선화 아래까지 칠해 빈틈을 없앨 수 있습니다.' : 'Shift를 누르고 클릭하면 추가, Alt를 누르고 클릭하면 삭제합니다.' }));
    } else if (kind === 'gradient') {
      seg('shape', '모양', [['linear', '직선'], ['radial', '원']]);
      pct('opacity', '불투명도');
      box.append(el('p', { class: 'hint', text: '드래그한 방향으로 그라데이션을 그립니다. Shift를 누르면 45° 단위로 고정됩니다.' }));
    } else if (kind === 'select') {
      seg('mode', '선택 방식', [['new', '신규'], ['add', '추가'], ['sub', '삭제']]);
      box.append(el('p', { class: 'hint', text: '드래그 중 Shift: 정사각형·정원. 시작할 때 Shift는 추가, Alt는 삭제입니다. 선택 범위 안을 Del로 지우고 Ctrl+T로 변형할 수 있습니다.' }));
    } else if (kind === 'eyedropper') {
      box.append(el('p', { class: 'hint', text: '클릭한 곳의 색을 현재 컬러로 가져옵니다. 그리기 도구에서는 Alt를 누르는 동안 스포이트가 됩니다.' }));
    } else if (kind === 'move') {
      box.append(el('p', { class: 'hint', text: '드래그하면 편집 레이어를 옮깁니다. 선택 범위가 있으면 선택한 부분만 옮겨집니다. 크기·회전은 Ctrl+T를 사용하세요.' }));
    } else if (kind === 'hand' || kind === 'rotate' || kind === 'zoom') {
      box.append(el('p', { class: 'hint', text: kind === 'zoom' ? '클릭하면 확대, Alt+클릭하면 축소, 좌우로 드래그하면 연속 확대·축소합니다.' : kind === 'rotate' ? '드래그해 화면을 회전합니다. Shift로 15° 단위. 내비게이터에서 초기화할 수 있습니다.' : '드래그해 화면을 이동합니다. 어떤 도구에서든 Space를 누르고 있으면 손바닥이 됩니다.' }));
      const btn = el('button', { class: 'cmd', text: '회전·반전 초기화', onclick: () => runCmd('resetRot') });
      box.append(btn);
    }
  },
};

/* ================= 컬러 UI ================= */
const ColorUI = {
  wheel: $('#wheel'),
  geo() { const s = this.wheel.width, R = s / 2 - 4, r = R - 18, q = r * Math.SQRT1_2 - 4; return { s, c: s / 2, R, r, q }; },
  syncHsv() { if (C.cur !== 'trans') { const h = rgb2hsv(drawColor()); if (h[1] === 0) h[0] = C.hsv[0]; C.hsv = h; } },
  init() {
    const dpr = window.devicePixelRatio || 1;
    this.wheel.width = this.wheel.height = Math.round(200 * dpr);
    this.syncHsv();
    let mode = null;
    const pick = e => {
      const r = this.wheel.getBoundingClientRect(), g = this.geo();
      const x = (e.clientX - r.left) * this.wheel.width / r.width - g.c, y = (e.clientY - r.top) * this.wheel.height / r.height - g.c;
      if (!mode) mode = Math.hypot(x, y) > g.r ? 'hue' : (Math.abs(x) <= g.q + 6 && Math.abs(y) <= g.q + 6 ? 'sv' : null);
      if (mode === 'hue') { C.hsv[0] = (Math.atan2(y, x) * 180 / Math.PI + 360 + 90) % 360; }
      else if (mode === 'sv') { C.hsv[1] = clamp((x + g.q) / (2 * g.q), 0, 1); C.hsv[2] = clamp(1 - (y + g.q) / (2 * g.q), 0, 1); }
      else return;
      setCurColor(hsv2rgb(...C.hsv), true);
    };
    this.wheel.addEventListener('pointerdown', e => { mode = null; this.wheel.setPointerCapture(e.pointerId); pick(e); });
    this.wheel.addEventListener('pointermove', e => { if (mode && e.buttons) pick(e); });
    this.wheel.addEventListener('pointerup', () => { if (mode) pushColorHistory(); mode = null; });
    $('#chip-main').addEventListener('click', () => { C.cur = 'main'; this.syncHsv(); this.update(); });
    $('#chip-sub').addEventListener('click', () => { C.cur = 'sub'; this.syncHsv(); this.update(); });
    $('#chip-trans').addEventListener('click', () => { C.cur = 'trans'; this.update(); });
    $('#chip-swap').addEventListener('click', () => { [C.main, C.sub] = [C.sub, C.main]; store.set('main', C.main); store.set('sub', C.sub); this.syncHsv(); this.update(); });
    $('#hex').addEventListener('change', e => { const c = parseHex(e.target.value); if (c) { setCurColor(c); pushColorHistory(); } else this.update(); });
    const sw = $('#swatches');
    for (const h of SWATCHES) sw.append(el('button', { style: `background:${h}`, title: h.toUpperCase(), 'aria-label': h, onclick: () => setCurColor(parseHex(h)) }));
    this.renderHistory();
    this.update();
  },
  renderHistory() {
    const box = $('#colorhist'); box.innerHTML = '';
    for (const h of C.history) box.append(el('button', { style: `background:${h}`, title: h.toUpperCase(), 'aria-label': h, onclick: () => setCurColor(parseHex(h)) }));
  },
  update() {
    $('#chip-main').style.background = hex(C.main);
    $('#chip-sub').style.background = hex(C.sub);
    $('#chip-main').classList.toggle('active', C.cur === 'main');
    $('#chip-sub').classList.toggle('active', C.cur === 'sub');
    $('#chip-trans').classList.toggle('active', C.cur === 'trans');
    const c = drawColor();
    $('#hex').value = C.cur === 'trans' ? '투명' : hex(c).toUpperCase();
    $('#rgbline').textContent = C.cur === 'trans' ? '투명색: 그리면 지워집니다' : `R ${c[0]}  G ${c[1]}  B ${c[2]}  ·  H ${Math.round(C.hsv[0])}° S ${Math.round(C.hsv[1] * 100)}% V ${Math.round(C.hsv[2] * 100)}%`;
    this.draw();
  },
  draw() {
    const x = this.wheel.getContext('2d'), g = this.geo();
    x.clearRect(0, 0, g.s, g.s);
    if (x.createConicGradient) {
      const cg = x.createConicGradient(-Math.PI / 2, g.c, g.c);
      for (let i = 0; i <= 12; i++) cg.addColorStop(i / 12, hex(hsv2rgb(i * 30 % 360, 1, 1)));
      x.fillStyle = cg;
    } else x.fillStyle = '#888';
    x.beginPath(); x.arc(g.c, g.c, g.R, 0, Math.PI * 2); x.arc(g.c, g.c, g.r, 0, Math.PI * 2, true); x.fill('evenodd');
    const q = g.q, x0 = g.c - q, y0 = g.c - q;
    x.fillStyle = hex(hsv2rgb(C.hsv[0], 1, 1)); x.fillRect(x0, y0, 2 * q, 2 * q);
    let gr = x.createLinearGradient(x0, 0, x0 + 2 * q, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(x0, y0, 2 * q, 2 * q);
    gr = x.createLinearGradient(0, y0, 0, y0 + 2 * q); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000');
    x.fillStyle = gr; x.fillRect(x0, y0, 2 * q, 2 * q);
    const ang = (C.hsv[0] - 90) * Math.PI / 180, mr = (g.R + g.r) / 2;
    x.lineWidth = 2;
    x.strokeStyle = '#fff'; x.beginPath(); x.arc(g.c + Math.cos(ang) * mr, g.c + Math.sin(ang) * mr, 7, 0, Math.PI * 2); x.stroke();
    const sx = x0 + C.hsv[1] * 2 * q, sy = y0 + (1 - C.hsv[2]) * 2 * q;
    x.strokeStyle = C.hsv[2] > .55 ? '#000' : '#fff'; x.beginPath(); x.arc(sx, sy, 6, 0, Math.PI * 2); x.stroke();
  },
};

/* ================= 레이어 UI ================= */
const BLENDS = [['source-over', '표준'], ['darken', '비교(어두움)'], ['multiply', '곱하기'], ['color-burn', '컬러 번'], ['lighten', '비교(밝음)'], ['screen', '스크린'], ['color-dodge', '컬러 닷지'], ['lighter', '더하기'], ['overlay', '오버레이'], ['soft-light', '소프트 라이트'], ['hard-light', '하드 라이트'], ['difference', '차의 절대값'], ['exclusion', '제외'], ['hue', '색상'], ['saturation', '채도'], ['color', '컬러'], ['luminosity', '휘도']];
const blendName = b => (BLENDS.find(x => x[0] === b) || [, '표준'])[1];
const EYE_ON = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2"/></svg>';
let dragLayer = null;
function renderLayers() {
  const list = $('#layers');
  list.innerHTML = '';
  for (let i = D.layers.length - 1; i >= 0; i--) {
    const L = D.layers[i];
    if (!L.thumb) drawThumb(L);
    const badges = [];
    if (L.draft) badges.push(el('span', { class: 'badge draft', text: '밑그림' }));
    if (L.ref) badges.push(el('span', { class: 'badge ref', text: '참조' }));
    if (L.locked) badges.push(el('span', { class: 'badge', text: '잠금' }));
    if (L.alphaLock) badges.push(el('span', { class: 'badge', text: '투명 잠금' }));
    const eye = el('button', { class: 'eye', title: L.visible ? '레이어 숨기기' : '레이어 표시', 'aria-label': L.visible ? '숨기기' : '표시', html: L.visible ? EYE_ON : EYE_OFF });
    eye.addEventListener('click', ev => { ev.stopPropagation(); setLayerProp(L, 'visible', !L.visible, L.visible ? '레이어 숨기기' : '레이어 표시'); });
    const nameEl = el('div', { class: 'lname', text: L.name });
    const row = el('div', { class: 'lrow' + (L.id === D.activeId ? ' active' : '') + (L.clip ? ' clip' : '') + (L.visible ? '' : ' hidden-layer'), draggable: 'true', role: 'option', 'aria-selected': L.id === D.activeId ? 'true' : 'false' },
      eye, L.thumb,
      el('div', { class: 'lmeta' }, nameEl, el('div', { class: 'lsub' }, `${Math.round(L.opacity * 100)}% ${L.paper ? '용지' : blendName(L.blend)}`, badges)));
    row.addEventListener('click', ev => { if (ev.ctrlKey || ev.metaKey) { selFromLayer(L); return; } selectLayer(L); });
    nameEl.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      const inp = el('input', { value: L.name });
      nameEl.innerHTML = ''; nameEl.append(inp); inp.focus(); inp.select();
      const done = ok => { const v = inp.value.trim(); if (ok && v && v !== L.name) setLayerProp(L, 'name', v, '레이어 이름 변경'); else renderLayers(); };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
    row.addEventListener('dragstart', ev => { dragLayer = L; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', L.name); } catch { /* 무시 */ } });
    row.addEventListener('dragover', ev => {
      if (!dragLayer) return; ev.preventDefault();
      const r = row.getBoundingClientRect(), above = ev.clientY < r.top + r.height / 2;
      row.classList.toggle('drop-above', above); row.classList.toggle('drop-below', !above);
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below'));
    row.addEventListener('drop', ev => {
      ev.preventDefault(); row.classList.remove('drop-above', 'drop-below');
      if (!dragLayer || dragLayer === L) return;
      const r = row.getBoundingClientRect(), above = ev.clientY < r.top + r.height / 2;
      reorderLayer(dragLayer, layerIndex(L) + (above ? 1 : 0));
      dragLayer = null;
    });
    row.addEventListener('dragend', () => { dragLayer = null; });
    list.append(row);
  }
  renderLayerProps();
  updateCmdStates();
}
function renderLayerProps() {
  const box = $('#layerprops'), L = active();
  box.innerHTML = '';
  if (!L) return;
  if (L.paper) {
    const c = el('input', { type: 'color', value: L.color || '#ffffff' });
    c.addEventListener('change', () => setLayerProp(L, 'color', c.value, '용지 색 변경'));
    box.append(el('div', { class: 'lp-row' }, el('span', { class: 'hint', text: '용지 색' }), c, el('span', { class: 'hint', text: '용지 레이어에는 그릴 수 없습니다.' })));
    return;
  }
  const sel = el('select', { 'aria-label': '합성 모드' }, BLENDS.map(([v, t]) => el('option', { value: v, text: t })));
  sel.value = L.blend;
  sel.addEventListener('change', () => setLayerProp(L, 'blend', sel.value, '합성 모드 변경'));
  const rng = el('input', { type: 'range', min: 0, max: 100, value: Math.round(L.opacity * 100), 'aria-label': '불투명도' });
  const num = el('input', { class: 'num', value: Math.round(L.opacity * 100) });
  let start = null;
  rng.addEventListener('input', () => { if (start == null) start = L.opacity; L.opacity = rng.value / 100; num.value = rng.value; markDirty(); });
  rng.addEventListener('change', () => { const v = L.opacity; L.opacity = start ?? v; start = null; setLayerProp(L, 'opacity', v, '불투명도 변경'); });
  num.addEventListener('change', () => { const v = clamp(parseInt(num.value) || 0, 0, 100) / 100; setLayerProp(L, 'opacity', v, '불투명도 변경'); });
  const tg = (id, label) => {
    const c = CMDS[id];
    const b = el('button', { class: 'cmd' + (c.check() ? ' on' : ''), text: label, title: c.label, 'aria-pressed': c.check() ? 'true' : 'false' });
    b.addEventListener('click', () => runCmd(id));
    return b;
  };
  box.append(
    el('div', { class: 'lp-row' }, sel),
    el('div', { class: 'lp-row' }, el('span', { class: 'hint', text: '불투명도' }), rng, num),
    el('div', { class: 'lp-toggles' }, tg('clipLayer', '클리핑'), tg('alphaLock', '투명 잠금'), tg('lockLayer', '잠금'), tg('refLayer', '참조'), tg('draftLayer', '밑그림')),
  );
}

/* ================= 내비게이터 ================= */
const NavUI = {
  c: $('#nav'),
  init() {
    const move = e => {
      const r = this.c.getBoundingClientRect(), g = this.geo();
      V.cx = clamp(((e.clientX - r.left) - g.ox) / g.s, 0, D.w);
      V.cy = clamp(((e.clientY - r.top) - g.oy) / g.s, 0, D.h);
      viewChanged();
    };
    this.c.addEventListener('pointerdown', e => { this.c.setPointerCapture(e.pointerId); move(e); });
    this.c.addEventListener('pointermove', e => { if (e.buttons) move(e); });
    const z = $('#nav-zoom'), r = $('#nav-rot');
    z.addEventListener('input', () => zoomAt(.02 * Math.pow(64 / .02, z.value / 1000)));
    r.addEventListener('input', () => rotateTo(+r.value));
  },
  geo() {
    const w = this.c.clientWidth || 260, h = this.c.clientHeight || 150;
    const s = Math.min((w - 12) / D.w, (h - 12) / D.h);
    return { w, h, s, ox: (w - D.w * s) / 2, oy: (h - D.h * s) / 2 };
  },
  draw() {
    const dpr = window.devicePixelRatio || 1, g = this.geo();
    if (this.c.width !== Math.round(g.w * dpr)) { this.c.width = Math.round(g.w * dpr); this.c.height = Math.round(g.h * dpr); }
    const x = this.c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, g.w, g.h);
    x.fillStyle = '#ffffff'; x.fillRect(g.ox, g.oy, D.w * g.s, D.h * g.s);
    x.imageSmoothingQuality = 'high';
    x.drawImage(comp.canvas, g.ox, g.oy, D.w * g.s, D.h * g.s);
    const pts = [[0, 0], [V.w, 0], [V.w, V.h], [0, V.h]].map(([a, b]) => s2d(a, b));
    x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo : x.moveTo).call(x, g.ox + p.x * g.s, g.oy + p.y * g.s)); x.closePath();
    x.strokeStyle = '#e3a446'; x.lineWidth = 1.5; x.stroke();
  },
  sync() {
    $('#nav-zoom').value = Math.round(Math.log(V.zoom / .02) / Math.log(64 / .02) * 1000);
    $('#nav-zoom-v').textContent = (V.zoom * 100).toFixed(V.zoom < .1 ? 1 : 0) + '%';
    $('#nav-rot').value = Math.round(V.rot);
    $('#nav-rot-v').textContent = Math.round(V.rot) + '°';
    navDirty = true;
  },
};

/* ================= 작업 내역 UI ================= */
const HistUI = {
  render() {
    const box = $('#history');
    box.innerHTML = '';
    const mk = (label, i) => {
      const b = el('button', { class: 'hitem' + (i === H.idx ? ' cur' : i > H.idx ? ' future' : ''), text: label });
      b.addEventListener('click', () => H.jump(i));
      return b;
    };
    box.append(mk('처음 상태', 0));
    H.stack.forEach((c, i) => box.append(mk(c.label, i + 1)));
    const cur = box.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  },
};

/* ================= 상태 표시 ================= */
let lastPressure = 0;
function updateStatus(e) {
  if (e && e.pointerType === 'pen') lastPressure = e.pressure;
  const st = $('#status');
  const parts = [`${D.w}×${D.h}px`, `${(V.zoom * 100).toFixed(V.zoom < .1 ? 1 : 0)}%`];
  if (V.rot) parts.push(`${Math.round(V.rot)}°`);
  if (V.flip) parts.push('좌우 반전 표시');
  if (hover) { const d = s2d(hover.x, hover.y); parts.push(`X ${Math.floor(d.x)}  Y ${Math.floor(d.y)}`); }
  if (lastPressure) parts.push(`필압 ${Math.round(lastPressure * 100)}%`);
  if (Sel.has && Sel.bbox) parts.push(`선택 ${Sel.bbox.w}×${Sel.bbox.h}`);
  parts.push(dirtySinceSave ? '저장 대기' : '자동 저장됨');
  st.textContent = parts.join('   ');
}
function updateCmdStates() {
  document.querySelectorAll('[data-cmd]').forEach(b => {
    const c = CMDS[b.dataset.cmd]; if (!c) return;
    b.disabled = !!(c.enabled && !c.enabled());
    if (c.check) b.classList.toggle('on', !!c.check());
  });
}

/* ================= 예시 작품 ================= */
function sampleStroke(L, preset, color, pts, opts = {}) {
  D.activeId = L.id;
  const b = { ...preset, ...opts };
  const st = new Stroke(T.buffer.ctx, b, { noStab: true });
  if (b.taperOut) {
    let t = 0; for (let i = 1; i < pts.length; i++) t += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    st.total = t;
  }
  for (const p of pts) st.addPt(p);
  A.layerId = L.id;
  A.overlay = { canvas: T.buffer.canvas, color, mode: 'source-over', alpha: b.opacity, texture: b.texture, useSel: false };
  commitOverlay(null, st.bbox, false);
}
function findSub(id) { for (const t of TOOL_LIST) for (const s of t.subs) if (s.id === id) return s; return null; }
function buildSample() {
  newDocument(1600, 1200, 350, '#ffffff', '사과 스케치 (예시)');
  D.layers = [D.layers[0]];
  D.nameSeq = 1;
  const add = o => { const L = newLayer(o); D.layers.push(L); return L; };
  const ground = add({ name: '바닥 그림자', blend: 'multiply', opacity: .7 });
  const base = add({ name: '밑색' });
  const shade = add({ name: '그림자', clip: true, blend: 'multiply', opacity: .6 });
  const light = add({ name: '하이라이트', clip: true, blend: 'screen', opacity: .8 });
  const line = add({ name: '선화' });
  const sketch = add({ name: '밑그림', draft: true, opacity: .4 });
  const cx = 800, cy = 650, R = 300;
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const apple = (th, k = 1) => {
    let r = R * (1 - .17 * Math.exp(-(angDiff(th, -Math.PI / 2) ** 2) / .05)) * (1 - .05 * Math.exp(-(angDiff(th, Math.PI / 2) ** 2) / .04));
    r *= k;
    return { x: cx + Math.cos(th) * r * 1.06, y: cy + Math.sin(th) * r * .96 };
  };
  // 밑그림 (참고용, 내보내기에서 제외)
  const pencil = findSub('pencil');
  for (let n = 0; n < 2; n++) {
    const pts = [];
    for (let i = 0; i <= 90; i++) { const th = -Math.PI / 2 + i / 90 * Math.PI * 2.1 + n * .3; const p = apple(th, 1.02 + n * .03); pts.push({ ...p, x: p.x + n * 8, p: .6 + .3 * Math.sin(i / 9) }); }
    sampleStroke(sketch, pencil, '#3a6fd8', pts, { size: 6, stab: 0 });
  }
  sampleStroke(sketch, pencil, '#3a6fd8', [{ x: cx, y: cy - R * 1.1, p: .5 }, { x: cx, y: cy + R * 1.05, p: .5 }], { size: 4 });
  sampleStroke(sketch, pencil, '#3a6fd8', [{ x: cx - R * 1.1, y: cy, p: .5 }, { x: cx + R * 1.1, y: cy, p: .5 }], { size: 4 });
  // 선화
  const gpen = findSub('gpen');
  const outline = [];
  for (let i = 0; i <= 160; i++) { const th = -Math.PI / 2 + .08 + i / 160 * (Math.PI * 2 + .06); outline.push({ ...apple(th), p: .55 + .4 * Math.sin(i / 160 * Math.PI) }); }
  sampleStroke(line, gpen, '#2a2326', outline, { size: 9, taperIn: 0, taperOut: 0 });
  const stemBase = apple(-Math.PI / 2);
  const stem = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; stem.push({ x: stemBase.x + 4 + t * 34 + Math.sin(t * 3) * 6, y: stemBase.y + 18 - t * 120, p: 1 - t * .5 }); }
  sampleStroke(line, gpen, '#2a2326', stem, { size: 11, taperIn: 0, taperOut: 30 });
  const la = { x: stemBase.x + 18, y: stemBase.y - 30 }, lb = { x: stemBase.x + 200, y: stemBase.y - 120 };
  const leaf = side => {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30, mx = la.x + (lb.x - la.x) * t, my = la.y + (lb.y - la.y) * t;
      const nx = -(lb.y - la.y), ny = lb.x - la.x, nl = Math.hypot(nx, ny), off = Math.sin(t * Math.PI) * 52 * side;
      pts.push({ x: mx + nx / nl * off, y: my + ny / nl * off, p: .4 + .5 * Math.sin(t * Math.PI) });
    }
    return pts;
  };
  sampleStroke(line, gpen, '#2a2326', leaf(1), { size: 7, taperIn: 0, taperOut: 0 });
  sampleStroke(line, gpen, '#2a2326', leaf(-1), { size: 7, taperIn: 0, taperOut: 0 });
  sampleStroke(line, gpen, '#2a2326', [la, { x: (la.x * .2 + lb.x * .8), y: (la.y * .2 + lb.y * .8) }].map(p => ({ ...p, p: .4 })), { size: 4, taperIn: 20, taperOut: 40 });
  // 밑색: 선화를 참조해 채우기
  D.activeId = base.id;
  const fillOpts = { ref: 'all', tolerance: 10, expand: 3, gap: 0, opacity: 1 };
  const prevCur = C.cur, prevMain = C.main;
  C.cur = 'main';
  C.main = [216, 70, 58]; fillAt(cx - 60, cy + 40, fillOpts, '채우기', true);
  C.main = [106, 168, 79]; fillAt((la.x + lb.x) / 2 + 10, (la.y + lb.y) / 2 - 8, fillOpts, '채우기', true);
  C.main = prevMain; C.cur = prevCur;
  // 그림자 · 하이라이트 (밑색에 클리핑)
  const air = findSub('air-soft');
  for (let n = 0; n < 3; n++) {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const th = -.9 + i / 30 * 2.6; pts.push({ ...apple(th, .86 - n * .05), p: 1 }); }
    sampleStroke(shade, air, '#7d5fb0', pts, { size: 190, flow: .09 });
  }
  sampleStroke(light, air, '#fff1d6', [{ x: cx - 150, y: cy - 130, p: 1 }, { x: cx - 120, y: cy - 165, p: 1 }], { size: 110, flow: .25 });
  // 바닥 그림자
  for (let n = 0; n < 2; n++) sampleStroke(ground, air, '#77707f', [{ x: cx - 230, y: cy + R * .95, p: 1 }, { x: cx + 260, y: cy + R * .95, p: 1 }], { size: 120 - n * 30, flow: .08 });
  D.activeId = line.id;
  D.nameSeq = 1;
  H.clear();
  markDirty(); renderLayers();
  for (const L of D.layers) queueThumb(L);
}

/* ================= 초기화 ================= */
function bindUI() {
  document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => runCmd(b.dataset.cmd)));
  $('#btn-left').addEventListener('click', () => { $('#workspace').classList.toggle('show-left'); $('#workspace').classList.remove('show-right'); });
  $('#btn-right').addEventListener('click', () => { $('#workspace').classList.toggle('show-right'); $('#workspace').classList.remove('show-left'); });
  $('#tf-ok').addEventListener('click', () => commitFloat('확대/축소/회전'));
  $('#tf-cancel').addEventListener('click', () => cancelFloat());
  $('#tf-fliph').addEventListener('click', () => { if (A.float) { A.float.sx *= -1; floatDirty(); } });
  $('#tf-flipv').addEventListener('click', () => { if (A.float) { A.float.sy *= -1; floatDirty(); } });
  $('#file-open').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f, false); e.target.value = ''; });
  $('#file-import').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f, true); e.target.value = ''; });
  const stage = $('#stage');
  stage.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  stage.addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    const n = f.name.toLowerCase();
    openFile(f, !(n.endsWith('.psd') || n.endsWith('.wpaint') || n.endsWith('.json')));
  });
  window.addEventListener('paste', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const item = [...(e.clipboardData ? e.clipboardData.items : [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); openFile(item.getAsFile(), true); }
    else if (clipboard) { e.preventDefault(); pasteCanvas(clipboard.canvas, clipboard.x, clipboard.y); }
  });
  new ResizeObserver(() => { resizeView(); navDirty = true; }).observe(vc);
  window.addEventListener('beforeunload', () => { if (dirtySinceSave) Autosave.save(); });
}
async function init() {
  buildMenus();
  bindUI();
  resizeView();
  ColorUI.init();
  NavUI.init();
  ToolUI.render();
  updateCursor();
  let restored = false;
  try { restored = await Autosave.restore(); } catch { restored = false; }
  if (restored) { fitView(); toast('지난 작업을 불러왔습니다.'); }
  else buildSample();
  fitView();
  dirtySinceSave = false;
  updateStatus();
  updateCmdStates();
}
// 테스트·디버그용 진입점
window.WebPaint = { D, H, V, Sel, A, runCmd, setTool, exportComposite, buildPSD, newDocument, fitView, s2d, d2s, active, CMDS };
init();
})();
