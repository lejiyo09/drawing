/* UI: 도구 정의, 보조 도구·도구 속성, 컬러 써클, 레이어 패널, 내비게이터, 작업 내역, 메뉴, 대화상자, 키보드·포인터 입력 */
'use strict';

/* ================= 도구 ================= */
const ICONS = {
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M10 7v6M7 10h6"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11M11 11V4a1.5 1.5 0 013 0v7M14 11V5.5a1.5 1.5 0 013 0V14c0 4-3 7-6.5 7-2.7 0-4.2-1.6-5.8-4.2l-1.3-2.2a1.5 1.5 0 012.5-1.6L8 15"/>',
  object: '<path d="M5 3l12 8-5 1.5L15 19l-2.5 1.2-3-6.3L5 18z"/>',
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  select: '<path d="M4 7V4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4"/>',
  wand: '<path d="M4 20L14 10M16 3v3M21 8h-3M19.5 4.5l-2 2M12 6l1.5 1.5"/>',
  eyedropper: '<path d="M14.5 4.5l5 5M17 7l-9.5 9.5L4 20l3.5-3.5M13 6l5 5"/><path d="M16 3.5a2.1 2.1 0 013 3"/>',
  pen: '<path d="M4 20l3.5-1L19 7.5 16.5 5 5 16.5zM14.5 7l2.5 2.5"/>',
  pencil: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3M4 20l3-1"/>',
  brush: '<path d="M20 4c-2.5 1-7.5 6-9.5 9l1.5 1.5c3-2 8-7 8-10.5z"/><path d="M10 13.5c-2.5 0-4 1.6-4 3.6 0 1.4-.8 2.1-2 2.4 3.5 1.2 8 .3 8-3.8z"/>',
  airbrush: '<circle cx="6" cy="8" r="1"/><circle cx="10" cy="5" r="1"/><circle cx="9" cy="11" r="1.2"/><circle cx="14" cy="8" r="1"/><circle cx="5" cy="13" r=".8"/><path d="M13 13l7 7M15.5 11.5l1.5-1.5 4 4-1.5 1.5"/>',
  deco: '<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8 9.6 8z"/>',
  eraser: '<path d="M8 20h12M5.5 14.5l9-9 5 5-9 9H8z M10 10l5 5"/>',
  blend: '<path d="M7 20c-2 0-3-1.5-3-3s1.5-3 3-3 2-2 2-4 2-6 5-6c2 0 3 1.5 3 3.5S15 11 13 12s-3 3-3 5-1 3-3 3z"/>',
  fill: '<path d="M5 11l6-6 8 8-6 6z M3 13h13"/><path d="M20 16c0 1.5 1 2.5 1 3.5a1 1 0 01-2 0c0-1 1-2 1-3.5z"/>',
  gradient: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M8 4v16M12 4v16M16 4v16" stroke-dasharray="1.5 2"/>',
  figure: '<rect x="3" y="11" width="9" height="9"/><circle cx="16" cy="8" r="5"/>',
  frame: '<rect x="3" y="3" width="18" height="18"/><path d="M3 11h9M12 3v18"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  text: '<path d="M5 5h14M12 5v15M9 20h6"/>',
  balloon: '<path d="M12 4c5 0 9 3 9 7s-4 7-9 7c-1 0-2 0-3-.3L5 20l1-3.5C4 15 3 13 3 11c0-4 4-7 9-7z"/>',
  linefix: '<path d="M4 18c4-8 8 4 16-8"/><rect x="9" y="10" width="4" height="4" fill="currentColor"/>',
};
const BR = o => Object.assign({ size: 10, opacity: 1, flow: 1, hardness: 1, spacing: .1, minSize: .2, pSize: true, pFlow: false, stab: 8, taperIn: 0, taperOut: 0, texture: false, tip: 'round', angle: 35, aspect: .3, angleMode: 'fixed', eraser: false, mix: 0, stretch: 0, wetEdge: 0 }, o);
const DECO = (id, name, o = {}) => ({ id: 'deco-' + id, name, ...BR({ size: 40, tip: 'image', tipId: id, tipColor: 'original', spacing: 1.1, pSize: true, minSize: .4, stab: 0, sizeJ: .35, angleJ: 40, scatter: .3, angle: 0, ...o }) });
const TOOLS = [
  { id: 'zoom', name: '돋보기', key: '/', icon: 'zoom', kind: 'zoom', subs: [{ id: 'zoom-in', name: '돋보기' }] },
  { id: 'hand', name: '손바닥', key: 'H', icon: 'hand', kind: 'hand', subs: [{ id: 'hand', name: '손바닥' }, { id: 'rotate', name: '회전', kind: 'rotate' }] },
  { id: 'object', name: '조작', key: 'O', icon: 'object', kind: 'object', subs: [{ id: 'object', name: '오브젝트' }] },
  { id: 'move', name: '레이어 이동', key: 'K', icon: 'move', kind: 'move', subs: [{ id: 'move-layer', name: '레이어 이동' }] },
  '-',
  { id: 'select', name: '선택 범위', key: 'M', icon: 'select', kind: 'select', subs: [
    { id: 'sel-rect', name: '직사각형', shape: 'rect', mode: 'new' },
    { id: 'sel-ellipse', name: '타원', shape: 'ellipse', mode: 'new' },
    { id: 'sel-lasso', name: '올가미', shape: 'lasso', mode: 'new' },
    { id: 'sel-poly', name: '꺾은선', kind: 'polysel', mode: 'new' },
    { id: 'sel-pen', name: '선택 펜', shape: 'pen', size: 30, mode: 'add' },
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
    { id: 'gouache', name: '불투명 수채', ...BR({ size: 30, hardness: .7, flow: .55, pFlow: true, minSize: .35, spacing: .06, stab: 6, mix: .45, stretch: .55 }) },
    { id: 'watercolor', name: '투명 수채', ...BR({ size: 40, hardness: .45, flow: .22, pFlow: true, minSize: .4, spacing: .06, stab: 6, mix: .3, stretch: .3, wetEdge: .7, opacity: .8 }) },
    { id: 'oil', name: '유채', ...BR({ size: 34, tip: 'flat', aspect: .45, angleMode: 'dir', angle: 90, flow: .9, minSize: .5, spacing: .04, stab: 6, mix: .7, stretch: .8 }) },
    { id: 'round-brush', name: '둥근 붓', ...BR({ size: 26, hardness: .65, flow: .3, pFlow: true, minSize: .25, spacing: .08, stab: 6 }) },
    { id: 'flat-brush', name: '평붓', ...BR({ size: 30, tip: 'flat', flow: .85, minSize: .5, spacing: .04, stab: 6 }) },
  ] },
  { id: 'airbrush', name: '에어브러시', key: 'B', icon: 'airbrush', kind: 'brush', subs: [
    { id: 'air-soft', name: '부드러움', ...BR({ size: 120, hardness: 0, flow: .06, pFlow: true, pSize: false, spacing: .06, stab: 0 }) },
    { id: 'air-hard', name: '강함', ...BR({ size: 50, hardness: .45, flow: .18, pFlow: true, pSize: false, spacing: .06, stab: 0 }) },
    { id: 'air-spray', name: '스프레이', ...BR({ size: 60, tip: 'image', tipId: 'chalk', tipColor: 'tint', flow: .5, pFlow: true, pSize: false, spacing: .12, stab: 0, angleJ: 180, scatter: .2 }) },
  ] },
  { id: 'deco', name: '데코레이션', key: 'B', icon: 'deco', kind: 'brush', subs: [
    DECO('star', '별'), DECO('heart', '하트'), DECO('flower', '꽃', { size: 50 }), DECO('leaf', '잎', { angleMode: 'dir', angle: -45, angleJ: 20 }),
    DECO('sparkle', '반짝임', { size: 30, spacing: 1.6 }), DECO('snow', '눈송이'), DECO('grass', '풀', { size: 60, spacing: .5, angleJ: 8, scatter: .05 }),
    DECO('dot', '물방울', { tipColor: 'tint', size: 30 }),
  ] },
  { id: 'eraser', name: '지우개', key: 'E', icon: 'eraser', kind: 'brush', subs: [
    { id: 'eraser-hard', name: '딱딱함', ...BR({ size: 24, eraser: true, minSize: .5, spacing: .05, stab: 2, vmode: 'touch' }) },
    { id: 'eraser-soft', name: '부드러움', ...BR({ size: 80, hardness: 0, flow: .25, pFlow: true, pSize: false, eraser: true, spacing: .06, stab: 0, vmode: 'touch' }) },
    { id: 'eraser-vec', name: '벡터용', ...BR({ size: 14, eraser: true, pSize: false, spacing: .05, stab: 0, vmode: 'intersect' }) },
  ] },
  { id: 'blend', name: '색 혼합', key: 'J', icon: 'blend', kind: 'blend', subs: [
    { id: 'smudge', name: '색 혼합', mode: 'smudge', size: 40, strength: .6, hardness: .3 },
    { id: 'blur', name: '흐리기', mode: 'blur', size: 60, strength: .5, hardness: .2 },
    { id: 'liquify', name: '유동화', mode: 'liquify', size: 120, strength: .5, lmode: 'push' },
  ] },
  '-',
  { id: 'fill', name: '채우기', key: 'G', icon: 'fill', kind: 'fill', subs: [
    { id: 'fill-layer', name: '편집 레이어만 참조', ref: 'layer', tolerance: 10, expand: 0, gap: 0, opacity: 1 },
    { id: 'fill-all', name: '다른 레이어 참조', ref: 'all', tolerance: 10, expand: 2, gap: 0, opacity: 1 },
    { id: 'fill-lasso', name: '에워싸고 칠하기', ref: 'all', fmode: 'lasso', tolerance: 20, expand: 1, gap: 0, opacity: 1 },
    { id: 'fill-paint', name: '안 칠한 부분 칠하기', ref: 'all', fmode: 'paint', tolerance: 10, expand: 2, gap: 0, opacity: 1 },
  ] },
  { id: 'gradient', name: '그라데이션', key: 'G', icon: 'gradient', kind: 'gradient', subs: [
    { id: 'grad-sub', name: '그리기색에서 배경색', to: 'sub', shape: 'linear', opacity: 1 },
    { id: 'grad-trans', name: '그리기색에서 투명색', to: 'trans', shape: 'linear', opacity: 1 },
  ] },
  '-',
  { id: 'figure', name: '도형', key: 'U', icon: 'figure', kind: 'figure', subs: [
    { id: 'fig-line', name: '직선', shape: 'line', size: 4, opacity: 1, style: 'line' },
    { id: 'fig-rect', name: '직사각형', shape: 'rect', size: 4, opacity: 1, style: 'line' },
    { id: 'fig-ellipse', name: '타원', shape: 'ellipse', size: 4, opacity: 1, style: 'line' },
    { id: 'fig-poly', name: '다각형', shape: 'polygon', sides: 6, size: 4, opacity: 1, style: 'line' },
    { id: 'fig-polyline', name: '꺾은선', shape: 'polyline', size: 4, opacity: 1, style: 'line' },
    { id: 'fig-focus', name: '집중선', shape: 'focus', size: 3, opacity: 1, count: 160, jitter: .35 },
    { id: 'fig-speed', name: '유선', shape: 'speed', size: 3, opacity: 1, count: 70, lengthRatio: .55 },
  ] },
  { id: 'frame', name: '컷 테두리', key: 'U', icon: 'frame', kind: 'frame', subs: [
    { id: 'frame-rect', name: '직사각형 컷', fk: 'rect' },
    { id: 'frame-split', name: '컷 나누기', fk: 'split', gapX: 30, gapY: 60, splitMode: 'folder' },
  ] },
  { id: 'ruler', name: '자', key: 'U', icon: 'ruler', kind: 'ruler', subs: [
    { id: 'ruler-line', name: '직선 자', rk: 'line' },
    { id: 'ruler-parallel', name: '평행선', rk: 'parallel' },
    { id: 'ruler-concentric', name: '동심원', rk: 'concentric' },
    { id: 'ruler-radial', name: '방사선', rk: 'radial' },
    { id: 'ruler-persp', name: '퍼스 자', rk: 'persp', points: 2 },
    { id: 'ruler-sym', name: '대칭 자', rk: 'symmetry', count: 2, mirror: true },
    { id: 'ruler-guide', name: '가이드', rk: 'guide', axis: 'h' },
  ] },
  { id: 'text', name: '텍스트', key: 'T', icon: 'text', kind: 'text', subs: [
    { id: 'text-h', name: '가로쓰기', font: 'IBM Plex Sans KR', fsize: 48, align: 'left', lh: 1.3, vertical: false, bold: false, strokeW: 0 },
    { id: 'text-v', name: '세로쓰기', font: 'Noto Serif KR', fsize: 48, align: 'left', lh: 1.4, vertical: true, bold: false, strokeW: 0 },
  ] },
  { id: 'balloon', name: '말풍선', key: 'T', icon: 'balloon', kind: 'balloon', subs: [
    { id: 'bal-ellipse', name: '타원 말풍선', shape: 'ellipse', lw: 3, autoText: true },
    { id: 'bal-round', name: '둥근 사각 말풍선', shape: 'round', lw: 3, autoText: true },
    { id: 'bal-rect', name: '사각 말풍선', shape: 'rect', lw: 3, autoText: true },
    { id: 'bal-cloud', name: '구름 말풍선', shape: 'cloud', lw: 3, autoText: true },
    { id: 'bal-flash', name: '번쩍 말풍선', shape: 'flash', lw: 3, autoText: true },
    { id: 'bal-tail', name: '말풍선 꼬리', shape: 'tail' },
  ] },
  { id: 'linefix', name: '선 수정', key: 'Y', icon: 'linefix', kind: 'linefix', subs: [
    { id: 'fix-ctrl', name: '제어점', fix: 'ctrl', size: 20 },
    { id: 'fix-pinch', name: '선 집기', fix: 'pinch', size: 40 },
    { id: 'fix-width', name: '선 폭 수정', fix: 'width', size: 30, amount: .5, thicken: true },
    { id: 'fix-simplify', name: '선 단순화', fix: 'simplify', size: 40, amount: .4 },
  ] },
];
const TOOL_LIST = TOOLS.filter(t => t !== '-');
const DEFAULT_SUBS = new Map(TOOL_LIST.flatMap(t => t.subs.map(s => [s.id, structuredClone(s)])));
const savedSubs = store.get('subs2', {});
for (const t of TOOL_LIST) for (const s of t.subs) if (savedSubs[s.id]) Object.assign(s, savedSubs[s.id]);
function saveSubs() {
  const o = {};
  for (const t of TOOL_LIST) for (const s of t.subs) { if (String(s.id).startsWith('u')) continue; const c = { ...s }; delete c.id; delete c.name; delete c.kind; o[s.id] = c; }
  store.set('subs2', o);
}
function resetSub() { const s = curSub(), d = DEFAULT_SUBS.get(s.id); if (!d) return; for (const k of Object.keys(s)) if (!(k in d)) delete s[k]; Object.assign(s, structuredClone(d)); saveSubs(); PropUI.render(); ToolUI.render(); toast('보조 도구를 초기 설정으로 되돌렸습니다.'); }
const S = {
  toolId: store.get('tool', 'pen'),
  subOf: store.get('subOf', {}),
  temp: null,
  pressureGamma: store.get('pgamma', 1),
};
function curTool() { return TOOL_LIST.find(t => t.id === S.toolId) || TOOL_LIST[0]; }
function curSub() { const t = curTool(); return t.subs.find(s => s.id === S.subOf[t.id]) || t.subs[0]; }
function baseKind() { return curSub().kind || curTool().kind; }
function effKind() { return S.temp || baseKind(); }
function setTool(id, subId) {
  if (A.float && A.float.kind === 'transform') return;
  if (Text.editing) Text.commitEditor();
  if (PolySel.pts) PolySel.cancel();
  if (Polyline.pts) Polyline.cancel();
  S.toolId = id;
  if (subId) S.subOf[id] = subId;
  store.set('tool', id); store.set('subOf', S.subOf);
  ToolUI.render(); updateCursor(); requestRender();
}
function onColorChanged() { if (baseKind() === 'object') PropUI.render(); }

/* ================= 공용 입력 위젯 ================= */
function paramSlider(label, min, max, step, get, set, opts = {}) {
  const rng = el('input', { type: 'range', min: opts.log ? 0 : min, max: opts.log ? 1000 : max, step: opts.log ? 1 : step, 'aria-label': label });
  const fmt = opts.fmt || (v => +(+v).toFixed(step < 1 ? 2 : 0));
  const toV = opts.toV || (v => v), fromV = opts.fromV || (v => v);
  const num = el('input', { class: 'num', value: fmt(fromV(get())), 'aria-label': label });
  const toS = v => (opts.log ? Math.round(Math.log(v / min) / Math.log(max / min) * 1000) : fromV(v));
  const fromS = v => (opts.log ? +(min * Math.pow(max / min, v / 1000)).toFixed(1) : toV(+v));
  rng.value = toS(get());
  rng.addEventListener('input', () => { set(fromS(rng.value)); num.value = fmt(fromV(get())); });
  if (opts.onCommit) rng.addEventListener('change', () => opts.onCommit());
  num.addEventListener('change', () => { const v = parseFloat(num.value); if (!isNaN(v)) set(clamp(toV(v), opts.log ? min : toV(min), opts.log ? max : toV(max))); num.value = fmt(fromV(get())); rng.value = toS(get()); if (opts.onCommit) opts.onCommit(); });
  return el('div', { class: 'prow' }, el('span', { text: label }), rng, num);
}
function segControl(label, opts, get, set) {
  const wrap = el('div', { class: 'seg' });
  for (const [v, t] of opts) {
    const b = el('button', { class: get() === v ? 'on' : '', text: t, type: 'button' });
    b.addEventListener('click', () => { set(v); for (const x of wrap.children) x.classList.remove('on'); b.classList.add('on'); });
    wrap.append(b);
  }
  return el('div', { class: 'prow' }, el('span', { text: label }), wrap);
}
function checkRow(label, get, set) {
  const c = el('input', { type: 'checkbox' }); c.checked = !!get();
  c.addEventListener('change', () => set(c.checked));
  return el('label', { class: 'pcheck' }, c, label);
}
function colorRow(label, get, set) {
  const c = el('input', { type: 'color', value: get() || '#000000', 'aria-label': label });
  c.addEventListener('change', () => set(c.value));
  return el('div', { class: 'prow' }, el('span', { text: label }), el('div', { class: 'inline-row' }, c, el('button', { class: 'cmd mini-cmd', text: '현재 색', type: 'button', onclick: () => { c.value = drawHex(); set(c.value); } })));
}
function selectRow(label, opts, get, set) {
  const s = el('select', { 'aria-label': label }, opts.map(([v, t]) => el('option', { value: v, text: t })));
  s.value = get(); s.addEventListener('change', () => set(s.value));
  return el('div', { class: 'prow' }, el('span', { text: label }), s);
}
// 보정 파라미터 편집기 (보정 레이어와 필터 대화상자에서 공용)
function adjustEditor(kind, p, onChange) {
  const box = el('div', { class: 'adj-editor' });
  const sl = (k, label, min, max, step = 1) => box.append(paramSlider(label, min, max, step, () => p[k], v => { p[k] = v; onChange(); }, { onCommit: () => onChange(true) }));
  if (kind === 'bc') { sl('b', '밝기', -100, 100); sl('c', '대비', -100, 100); }
  else if (kind === 'hsl') { sl('h', '색조', -180, 180); sl('s', '채도', -100, 100); sl('l', '명도', -100, 100); }
  else if (kind === 'levels') { sl('inB', '입력 검정', 0, 254); sl('inW', '입력 흰색', 1, 255); sl('gamma', '감마', .1, 4, .01); sl('outB', '출력 검정', 0, 255); sl('outW', '출력 흰색', 0, 255); }
  else if (kind === 'posterize') sl('n', '계조 수', 2, 32);
  else if (kind === 'binarize') sl('t', '경계', 1, 254);
  else if (kind === 'balance') {
    const names = [['sh', '그림자'], ['mid', '중간'], ['hi', '하이라이트']];
    let tone = 'mid';
    const rows = el('div', { class: 'adj-editor' });
    const draw = () => {
      rows.innerHTML = '';
      [['시안 ↔ 빨강', 0], ['마젠타 ↔ 초록', 1], ['노랑 ↔ 파랑', 2]].forEach(([l, i]) => rows.append(paramSlider(l, -100, 100, 1, () => p[tone][i], v => { p[tone] = p[tone].slice(); p[tone][i] = v; onChange(); }, { onCommit: () => onChange(true) })));
    };
    box.append(segControl('범위', names, () => tone, v => { tone = v; draw(); }), rows, checkRow('명도 유지', () => p.keepLum, v => { p.keepLum = v; onChange(true); }));
    draw();
  } else if (kind === 'curve') box.append(curveEditor(p, onChange));
  else if (kind === 'gradmap') box.append(gradStopsEditor(p, onChange));
  else if (kind === 'invert') box.append(el('p', { class: 'hint', text: '설정할 값이 없습니다.' }));
  return box;
}
function curveEditor(p, onChange) {
  const S0 = 200, c = mkCanvas(S0, S0); c.className = 'curve-ed'; c.setAttribute('aria-label', '톤 커브');
  const draw = () => {
    const x = c.getContext('2d'); x.fillStyle = '#1b1c1f'; x.fillRect(0, 0, S0, S0);
    x.strokeStyle = '#3d4047'; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(i * S0 / 4, 0); x.lineTo(i * S0 / 4, S0); x.moveTo(0, i * S0 / 4); x.lineTo(S0, i * S0 / 4); } x.stroke();
    const lut = curveLUT(p.pts); x.strokeStyle = '#e3a446'; x.lineWidth = 2; x.beginPath(); for (let i = 0; i < 256; i++) { const X = i / 255 * S0, Y = S0 - lut[i] / 255 * S0; i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke();
    for (const [a, b] of p.pts) { x.fillStyle = '#fff'; x.fillRect(a / 255 * S0 - 4, S0 - b / 255 * S0 - 4, 8, 8); }
  };
  let di = -1;
  const pos = e => { const r = c.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * 255, 0, 255), clamp(255 - (e.clientY - r.top) / r.height * 255, 0, 255)]; };
  c.addEventListener('pointerdown', e => {
    c.setPointerCapture(e.pointerId);
    const [a, b] = pos(e);
    di = p.pts.findIndex(q => Math.hypot(q[0] - a, q[1] - b) < 12);
    if (di >= 0 && (e.altKey || e.button === 2) && p.pts.length > 2) { p.pts.splice(di, 1); di = -1; draw(); onChange(true); return; }
    if (di < 0) { p.pts.push([a, b]); p.pts.sort((u, v) => u[0] - v[0]); di = p.pts.findIndex(q => q[0] === a && q[1] === b); }
    draw(); onChange();
  });
  c.addEventListener('pointermove', e => { if (di < 0 || !e.buttons) return; const [a, b] = pos(e); p.pts[di] = [a, b]; p.pts.sort((u, v) => u[0] - v[0]); di = p.pts.findIndex(q => q[0] === a && q[1] === b); draw(); onChange(); });
  c.addEventListener('pointerup', () => { di = -1; onChange(true); });
  c.addEventListener('contextmenu', e => e.preventDefault());
  draw();
  return el('div', { class: 'curve-wrap' }, c, el('p', { class: 'hint', text: '클릭해 점을 추가하고 끌어서 움직입니다. Alt+클릭으로 점을 지웁니다.' }));
}
function gradStopsEditor(p, onChange) {
  const box = el('div', { class: 'adj-editor' });
  const draw = () => {
    box.innerHTML = '';
    const bar = mkCanvas(200, 16); bar.className = 'grad-bar'; const x = bar.getContext('2d'), g = x.createLinearGradient(0, 0, 200, 0);
    for (const [t, c] of p.stops.slice().sort((a, b) => a[0] - b[0])) g.addColorStop(t, c);
    x.fillStyle = g; x.fillRect(0, 0, 200, 16);
    box.append(bar);
    p.stops.forEach((s, i) => {
      const col = el('input', { type: 'color', value: s[1], 'aria-label': '색' });
      col.addEventListener('input', () => { p.stops[i] = [p.stops[i][0], col.value]; onChange(); });
      col.addEventListener('change', () => { draw(); onChange(true); });
      const pos = el('input', { type: 'range', min: 0, max: 100, value: Math.round(s[0] * 100), 'aria-label': '위치' });
      pos.addEventListener('input', () => { p.stops[i] = [pos.value / 100, p.stops[i][1]]; onChange(); });
      pos.addEventListener('change', () => { draw(); onChange(true); });
      const del = el('button', { class: 'cmd mini-cmd', text: '삭제', type: 'button', onclick: () => { if (p.stops.length > 2) { p.stops.splice(i, 1); draw(); onChange(true); } } });
      box.append(el('div', { class: 'inline-row' }, col, pos, del));
    });
    box.append(el('button', { class: 'cmd mini-cmd', text: '색 추가', type: 'button', onclick: () => { p.stops.push([.5, drawHex()]); draw(); onChange(true); } }));
  };
  draw();
  return box;
}

/* ================= 보조 도구 · 도구 속성 ================= */
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
  const x = c.getContext('2d'), b = { ...s, size: Math.min(s.size, s.tip === 'image' ? 22 : 12) * 1.6, taperIn: 20, taperOut: 20, spacing: s.tip === 'image' ? Math.max(.6, s.spacing) : s.spacing, mix: 0, stretch: 0 };
  const orig = s.tip === 'image' && s.tipColor === 'original';
  const st = new Stroke(x, b, { noStab: true, colored: orig });
  st.total = 108;
  for (let i = 0; i <= 40; i++) { const t = i / 40; st.addPt({ x: 10 + t * 108, y: 14 + Math.sin(t * Math.PI * 2) * 6, p: Math.sin(t * Math.PI) }); }
  if (!orig) { x.globalCompositeOperation = 'source-in'; x.fillStyle = '#e7e4dd'; x.fillRect(0, 0, 128, 28); }
  return c;
}
const PropUI = {
  render() {
    const box = $('#props'), s = curSub(), kind = baseKind();
    $('#prop-title').textContent = s.name;
    box.innerHTML = '';
    const changed = () => { saveSubs(); requestRender(); };
    const add = (...n) => box.append(...n);
    const sl = (key, label, min, max, step = 1, o = {}) => add(paramSlider(label, min, max, step, () => s[key], v => { s[key] = v; changed(); }, o));
    const pct = (key, label, min = 0, max = 100) => sl(key, label, min, max, 1, { fmt: v => Math.round(v), toV: v => v / 100, fromV: v => v * 100 });
    const chk = (key, label) => add(checkRow(label, () => s[key], v => { s[key] = v; changed(); PropUI.render(); }));
    const seg = (key, label, opts) => add(segControl(label, opts, () => s[key], v => { s[key] = v; changed(); PropUI.render(); }));
    const hint = t => add(el('p', { class: 'hint', text: t }));
    const btn = (t, fn) => el('button', { class: 'cmd', text: t, type: 'button', onclick: fn });
    if (kind === 'brush') {
      sl('size', '브러시 크기', .5, 1000, .1, { log: true, fmt: v => v });
      pct('opacity', '불투명도');
      pct('flow', '브러시 농도', 1);
      if (s.tip !== 'flat' && s.tip !== 'image') pct('hardness', '경도');
      sl('stab', '손떨림 보정', 0, 100);
      chk('pSize', '필압으로 크기 조절');
      if (s.pSize) pct('minSize', '최소 크기', 1);
      chk('pFlow', '필압으로 농도 조절');
      pct('spacing', '간격', 1, s.tip === 'image' ? 300 : 100);
      sl('taperIn', '입력 보정', 0, 300);
      sl('taperOut', '출력 보정', 0, 300);
      if (!s.eraser) {
        add(el('div', { class: 'psub', text: '물감' }));
        pct('mix', '물감 혼색');
        pct('stretch', '색 늘이기');
        pct('wetEdge', '수채 경계');
        chk('texture', '종이 질감');
      }
      if (s.tip === 'flat' || s.tip === 'image') {
        add(el('div', { class: 'psub', text: '브러시 끝' }));
        add(segControl('방향', [['fixed', '고정'], ['dir', '진행 방향'], ['tilt', '펜 기울기']], () => s.angleMode || 'fixed', v => { s.angleMode = v; changed(); }));
        sl('angle', '각도', -180, 180);
        if (s.tip === 'flat') pct('aspect', '두께 비율', 5, 100);
      }
      if (s.tip === 'image') {
        add(selectRow('모양', [...TIPS.map].map(([id, t]) => [id, t.name]), () => s.tipId, v => { s.tipId = v; changed(); ToolUI.render(); }));
        seg('tipColor', '색', [['original', '원래 색'], ['tint', '그리기색']]);
        pct('sizeJ', '크기 흔들림'); sl('angleJ', '각도 흔들림', 0, 180); pct('scatter', '흩뿌리기', 0, 300);
      }
      if (s.eraser) { seg('vmode', '벡터 지우기', [['touch', '닿은 부분'], ['intersect', '교점까지'], ['line', '선 전체']]); hint('벡터 레이어에서는 선을 데이터째 지웁니다. "교점까지"는 다른 선과 만나는 곳까지 지웁니다.'); }
      else hint('이전 획 끝에서 Shift+클릭하면 직선입니다. 자(퍼스·평행선 등)가 있으면 스냅됩니다. 벡터 레이어에 그리면 선이 벡터로 저장됩니다.');
      add(el('div', { class: 'inline-row' }, btn('초기 설정으로', resetSub), btn('소재로 등록', () => Dialogs.prompt('보조 도구 이름', s.name + ' (내 설정)', v => Materials.registerBrush(v)))));
    } else if (kind === 'blend') {
      sl('size', '브러시 크기', 2, 1000, 1, { log: true, fmt: v => v });
      pct('strength', '강도', 1);
      if (s.mode !== 'liquify') pct('hardness', '경도');
      else seg('lmode', '방식', [['push', '밀기'], ['bloat', '확대'], ['pinch', '축소'], ['twirlL', '왼쪽 비틀기'], ['twirlR', '오른쪽 비틀기']]);
      hint(s.mode === 'liquify' ? '유동화: 드래그해 그림을 밀거나, 누르고 있으면 부풀리기·오므리기·비틀기가 계속 적용됩니다.' : s.mode === 'blur' ? '문지른 곳을 흐리게 합니다.' : '문지른 방향으로 색을 끌어 섞습니다.');
    } else if (kind === 'fill' || kind === 'wand') {
      seg('ref', '참조', [['layer', '편집 레이어'], ['all', '모든 레이어'], ['ref', '참조 레이어']]);
      sl('tolerance', '색의 오차', 0, 100);
      sl('expand', '영역 확대', -20, 20);
      if (!s.fmode) sl('gap', '틈 닫기', 0, 20);
      if (kind === 'fill') pct('opacity', '불투명도'); else seg('mode', '선택 방식', [['new', '신규'], ['add', '추가'], ['sub', '삭제']]);
      hint(s.fmode === 'lasso' ? '칠할 곳을 올가미로 둘러싸면 선이 아닌 부분이 칠해집니다.' : s.fmode === 'paint' ? '빈 틈을 문지르면 닿은 작은 영역들이 칠해집니다.' : kind === 'fill' ? '모든 레이어 참조 시 밑그림 레이어는 무시됩니다. 영역 확대로 선화 아래까지 칠해 빈틈을 없앱니다.' : 'Shift+클릭 추가, Alt+클릭 삭제.');
    } else if (kind === 'gradient') {
      seg('shape', '모양', [['linear', '직선'], ['radial', '원']]);
      pct('opacity', '불투명도');
      chk('asLayer', '그라데이션 레이어로 작성 (나중에 수정 가능)');
      hint('Shift를 누르면 45° 단위로 고정됩니다.');
    } else if (kind === 'select' || kind === 'polysel') {
      seg('mode', '선택 방식', [['new', '신규'], ['add', '추가'], ['sub', '삭제']]);
      if (s.shape === 'pen') sl('size', '펜 크기', 1, 400, 1);
      hint(kind === 'polysel' ? '클릭해 꼭짓점을 찍고 시작점을 클릭하거나 Enter로 닫습니다.' : '드래그 중 Shift: 정사각형·정원. 시작할 때 Shift는 추가, Alt는 삭제. Ctrl+T로 변형, Ctrl+M으로 퀵 마스크.');
    } else if (kind === 'eyedropper') hint('클릭한 곳의 색을 가져옵니다. 그리기 도구에서는 Alt를 누르는 동안 스포이트가 됩니다.');
    else if (kind === 'move') hint('드래그하면 편집 레이어를 옮깁니다. 선택 범위가 있으면 그 부분만 옮깁니다. 벡터·텍스트 레이어도 옮길 수 있습니다.');
    else if (kind === 'hand' || kind === 'rotate' || kind === 'zoom') {
      hint(kind === 'zoom' ? '클릭하면 확대, Alt+클릭 축소, 좌우 드래그로 연속 확대·축소.' : kind === 'rotate' ? '드래그해 화면을 회전합니다. Shift로 15° 단위.' : '드래그해 화면을 이동합니다. 어떤 도구에서든 Space를 누르면 손바닥이 됩니다.');
      add(btn('회전·반전 초기화', () => runCmd('resetRot')));
    } else if (kind === 'object') this.objectProps(add, hint, btn);
    else if (kind === 'figure') {
      if (s.shape !== 'focus' && s.shape !== 'speed') { seg('style', '그리기', [['line', '선'], ['fill', '채우기']]); }
      sl('size', '선 굵기', .5, 200, .5, { log: true, fmt: v => v });
      pct('opacity', '불투명도');
      if (s.shape === 'polygon') sl('sides', '꼭짓점 수', 3, 24);
      if (s.shape === 'focus') { sl('count', '선 수', 20, 600); pct('jitter', '길이 흔들림'); hint('중심에서 끌어 집중선이 모일 타원을 정합니다. 선택 범위가 있으면 그 안에만 그려집니다.'); }
      else if (s.shape === 'speed') { sl('count', '선 수', 10, 400); pct('lengthRatio', '선 길이', 5, 100); hint('선이 흐를 방향으로 드래그합니다. 선택 범위 안에만 그려집니다.'); }
      else hint(s.shape === 'polyline' ? '클릭으로 점을 찍고 더블클릭으로 끝냅니다. 시작점을 클릭하면 닫힙니다.' : 'Shift: 정방형·45° 고정. 벡터 레이어에 그리면 벡터 선이 됩니다.');
    } else if (kind === 'frame') {
      if (s.fk === 'split') { sl('gapX', '좌우 간격', 0, 300); sl('gapY', '상하 간격', 0, 300); seg('splitMode', '나누기', [['folder', '폴더 분할'], ['border', '테두리만 분할']]); hint('컷을 가로지르게 드래그하면 간격을 두고 나뉩니다. Shift로 45° 고정.'); }
      else hint('드래그한 크기로 새 컷 테두리 폴더를 만듭니다. 폴더 안 그림은 컷 밖으로 나가지 않습니다.');
      add(btn('기본 테두리로 컷 만들기', () => Manga.createFrameFolder(Manga.defaultFrameRect())));
    } else if (kind === 'ruler') this.rulerProps(s, add, hint, btn, changed);
    else if (kind === 'text') {
      add(selectRow('글꼴', FONTS.map(f => [f, f]), () => s.font, v => { s.font = v; changed(); }));
      sl('fsize', '크기', 6, 600, 1, { log: true, fmt: v => Math.round(v) });
      add(segControl('정렬', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], () => s.align, v => { s.align = v; changed(); }));
      chk('bold', '굵게');
      chk('vertical', '세로쓰기');
      sl('strokeW', '테두리', 0, 30);
      hint('캔버스를 클릭해 입력합니다. 말풍선 안을 클릭하면 말풍선에 글자가 들어갑니다. Esc 또는 Ctrl+Enter로 끝냅니다.');
      if (Text.selId && active().type === 'text') this.textObjProps(add, btn);
    } else if (kind === 'balloon') {
      if (s.shape !== 'tail') { sl('lw', '선 굵기', 0, 30); chk('autoText', '만든 뒤 바로 글자 입력'); hint('드래그해 말풍선을 만듭니다. 겹친 말풍선은 하나로 이어집니다.'); }
      else hint('말풍선 안에서 말하는 사람 쪽으로 끌어 꼬리를 답니다.');
    } else if (kind === 'linefix') {
      sl('size', '범위', 2, 400, 1);
      if (s.fix === 'width') { pct('amount', '세기', 1); chk('thicken', '굵게 (해제하면 가늘게)'); }
      if (s.fix === 'simplify') pct('amount', '세기', 1);
      hint({ ctrl: '벡터 선의 제어점을 끌어 옮깁니다.', pinch: '선을 집어 부드럽게 당깁니다.', width: '문지른 부분의 선 폭을 바꿉니다.', simplify: '문지른 선의 제어점을 줄여 매끄럽게 합니다.' }[s.fix] + ' 벡터 레이어에서 사용합니다.');
    }
  },
  objectProps(add, hint, btn) {
    const L = active();
    if (!L) return;
    if (L.type === 'vector') {
      const n = Vector.sel.size;
      add(el('p', { class: 'hint', text: n ? `벡터 선 ${n}개 선택` : '선을 클릭해 선택합니다. Shift로 추가, 빈 곳을 드래그하면 범위 선택.' }));
      if (n) {
        const first = L.data.strokes.find(s => Vector.sel.has(s.id));
        let w = first && first.b ? first.b.size : 5;
        add(paramSlider('선 폭', .5, 200, .5, () => w, v => { w = v; }, { log: true, fmt: v => v, onCommit: () => Vector.applyToSelected(s => (s.b ? { ...s, b: { ...s.b, size: w } } : s), '선 폭 변경') }));
        add(el('div', { class: 'inline-row' }, btn('현재 색 적용', () => Vector.applyToSelected(s => ({ ...s, color: drawHex() }), '선 색 변경')), btn('삭제', () => Vector.deleteSelected()), btn('단순화', () => Vector.simplifyAll())));
      }
      add(btn('벡터 레이어 래스터화', () => Vector.rasterize()));
    } else if (L.type === 'text') {
      if (Text.selId) this.textObjProps(add, btn); else hint('텍스트나 말풍선을 클릭해 선택합니다. 더블클릭하면 글자를 고칩니다. 오른쪽 아래 핸들로 크기를 바꿉니다.');
      add(btn('텍스트 레이어 래스터화', () => Vector.rasterize()));
    } else if (L.type === '3d') this.threeProps(L, add, hint, btn);
    else if (Manga.frameFolderOf(L)) {
      const F = Manga.frameFolderOf(L), f = F.data.frame;
      hint(`${F.name}: 꼭짓점을 끌거나 컷 안을 끌어 옮깁니다.`);
      add(paramSlider('테두리 굵기', 0, 60, .5, () => f.w, v => { f.w = v; markDirty(); }, { onCommit: () => setLayerData(F, { frame: { ...f } }, '컷 테두리 굵기') }));
      add(colorRow('테두리 색', () => f.color, v => setLayerData(F, { frame: { ...f, color: v } }, '컷 테두리 색')));
    } else if (L.type === 'gradient') hint('그라데이션 레이어: 시작점·끝점을 끌어 고칩니다. 색은 레이어 속성에서 바꿉니다.');
    else hint('조작 도구는 벡터 선, 텍스트·말풍선, 3D, 컷 테두리, 그라데이션 레이어를 편집합니다.');
  },
  textObjProps(add, btn) {
    const L = active(), o = L.data.objs.find(x => x.id === Text.selId); if (!o) return;
    add(el('div', { class: 'psub', text: o.kind === 'text' ? '선택한 텍스트' : '선택한 말풍선' }));
    if (o.kind === 'text') {
      add(selectRow('글꼴', FONTS.map(f => [f, f]), () => o.font, v => Text.updateSelected({ font: v })));
      let size = o.size;
      add(paramSlider('크기', 4, 800, 1, () => size, v => { size = v; }, { log: true, fmt: v => Math.round(v), onCommit: () => Text.updateSelected({ size }) }));
      add(segControl('정렬', [['left', '왼쪽'], ['center', '가운데'], ['right', '오른쪽']], () => o.align || 'left', v => Text.updateSelected({ align: v })));
      add(checkRow('굵게', () => o.bold, v => Text.updateSelected({ bold: v })));
      add(checkRow('세로쓰기', () => o.vertical, v => Text.updateSelected({ vertical: v })));
      let sw = o.stroke ? o.stroke.w : 0;
      add(paramSlider('테두리', 0, 40, .5, () => sw, v => { sw = v; }, { onCommit: () => Text.updateSelected({ stroke: sw ? { w: sw, color: (o.stroke && o.stroke.color) || '#ffffff' } : null }) }));
      add(colorRow('글자 색', () => o.color, v => Text.updateSelected({ color: v })));
      add(btn('글자 고치기', () => Text.openEditor(L, o, false)));
    } else {
      add(selectRow('모양', [['ellipse', '타원'], ['round', '둥근 사각'], ['rect', '사각'], ['cloud', '구름'], ['flash', '번쩍']], () => o.shape, v => Text.updateSelected({ shape: v }, '말풍선 모양')));
      let lw = o.lw;
      add(paramSlider('선 굵기', 0, 40, .5, () => lw, v => { lw = v; }, { onCommit: () => Text.updateSelected({ lw }, '말풍선 선') }));
      add(colorRow('칠', () => o.fill, v => Text.updateSelected({ fill: v }, '말풍선 칠')));
      add(colorRow('선 색', () => o.line, v => Text.updateSelected({ line: v }, '말풍선 선 색')));
      if (o.tails && o.tails.length) add(btn('꼬리 모두 지우기', () => Text.updateSelected({ tails: [] }, '말풍선 꼬리 삭제')));
    }
    add(btn('삭제', () => Text.deleteSelected()));
  },
  threeProps(L, add, hint, btn) {
    const d = L.data;
    add(segControl('조작', [['camera', '카메라'], ['move', '이동'], ['rotate', '회전'], ['scale', '크기'], ['joint', '관절']], () => Three3D.mode, v => { Three3D.mode = v; PropUI.render(); }));
    hint({ camera: '드래그: 회전 · Shift+드래그: 이동 · Ctrl/Alt+드래그: 거리', move: '오브젝트를 바닥면 위로 옮깁니다. Shift+드래그는 위아래.', rotate: '좌우 드래그로 돌립니다. Shift는 앞뒤 기울기.', scale: '위아래 드래그로 크기를 바꿉니다.', joint: '데생 인형의 팔·다리를 잡고 끌어 관절을 굽힙니다. Shift는 비틀기.' }[Three3D.mode]);
    add(segControl('표현', [['line', '선화'], ['toon', '툰'], ['shade', '음영']], () => d.mode, v => Three3D.update(x => { x.mode = v; }, '3D 표현')));
    let ol = d.outline ?? 2;
    add(paramSlider('윤곽선', 0, 8, .1, () => ol, v => { ol = v; }, { onCommit: () => Three3D.update(x => { x.outline = ol; }, '3D 윤곽선') }));
    let az = d.lightAz ?? 40, elv = d.lightEl ?? 50;
    add(paramSlider('빛 방향', -180, 180, 1, () => az, v => { az = v; }, { onCommit: () => Three3D.update(x => { x.lightAz = az; }, '3D 빛') }));
    add(paramSlider('빛 높이', 0, 90, 1, () => elv, v => { elv = v; }, { onCommit: () => Three3D.update(x => { x.lightEl = elv; }, '3D 빛') }));
    add(el('div', { class: 'psub', text: '오브젝트 추가' }));
    add(el('div', { class: 'inline-row wrap' }, [['figure', '데생 인형'], ['cube', '정육면체'], ['sphere', '구'], ['cylinder', '원기둥'], ['cone', '원뿔'], ['torus', '토러스'], ['plane', '바닥']].map(([k, n]) => btn(n, () => Three3D.update(x => { const o = Three3D.makeObj(k); x.objects.push(o); Three3D.selId = o.id; }, '3D 오브젝트 추가')))));
    const o = Three3D.selObj(L);
    if (o) {
      add(el('div', { class: 'psub', text: '선택한 오브젝트' + (Three3D.part ? ` · ${JOINT_NAMES[Three3D.part] || ''}` : '') }));
      if (o.kind === 'figure') add(selectRow('포즈', [['', '포즈 선택…'], ...Object.keys(POSES).map(k => [k, k])], () => '', v => v && Three3D.update(() => { o.pose = structuredClone(POSES[v]); }, '포즈: ' + v)));
      add(el('div', { class: 'inline-row wrap' }, btn('현재 색 적용', () => Three3D.update(() => { o.color = drawHex(); }, '3D 색')), btn('삭제', () => Three3D.update(x => { x.objects = x.objects.filter(q => q.id !== o.id); Three3D.selId = null; }, '3D 오브젝트 삭제'))));
    }
    add(el('div', { class: 'inline-row wrap' }, btn('카메라 초기화', () => Three3D.update(x => { x.camera = Three3D.defaultCamera(); }, '3D 카메라')), btn('카메라로 퍼스 자 작성', () => Three3D.cameraFromVP()), btn('래스터화', () => Vector.rasterize())));
  },
  rulerProps(s, add, hint, btn, changed) {
    if (s.rk === 'persp') add(segControl('소실점', [[1, '1점'], [2, '2점'], [3, '3점']], () => s.points, v => { s.points = v; changed(); }));
    if (s.rk === 'symmetry') { add(paramSlider('선 수', 1, 24, 1, () => s.count, v => { s.count = v; changed(); })); add(checkRow('선대칭', () => s.mirror, v => { s.mirror = v; changed(); })); }
    if (s.rk === 'guide') add(segControl('방향', [['h', '가로'], ['v', '세로']], () => s.axis, v => { s.axis = v; changed(); }));
    hint({ line: '드래그해 직선 자를 만듭니다.', parallel: '드래그한 방향의 평행선 자를 만듭니다.', concentric: '중심에서 드래그해 동심원 자를 만듭니다.', radial: '클릭한 곳이 방사선 자의 중심이 됩니다.', persp: '클릭하면 퍼스 자가 생깁니다. 보라색 점(소실점)을 끌어 맞춥니다.', symmetry: '클릭한 곳을 중심으로 대칭 자를 만듭니다. 손잡이를 끌어 축을 돌립니다.', guide: '클릭한 위치에 가이드를 만듭니다.' }[s.rk] + ' 기존 자의 점을 끌어 고치고, Alt+클릭으로 지웁니다.');
    add(checkRow('자에 스냅 (Ctrl+1)', () => Rulers.snap.ruler, v => { Rulers.snap.ruler = v; store.set('snapRuler', v); updateCmdStates(); }));
    add(checkRow('특수 자에 스냅 (Ctrl+2)', () => Rulers.snap.special, v => { Rulers.snap.special = v; store.set('snapSpecial', v); updateCmdStates(); }));
    add(checkRow('그리드에 스냅 (Ctrl+3)', () => Rulers.snap.grid, v => { Rulers.snap.grid = v; store.set('snapGrid', v); updateCmdStates(); }));
    if (D.rulers.length) {
      add(el('div', { class: 'psub', text: '이 페이지의 자' }));
      const names = { line: '직선 자', parallel: '평행선', concentric: '동심원', radial: '방사선', persp: '퍼스 자', symmetry: '대칭 자', guide: '가이드' };
      for (const r of D.rulers) {
        const row = el('div', { class: 'inline-row' },
          checkRow(names[r.kind] + (r.kind === 'persp' ? ` (${r.vps.length}점)` : ''), () => r.visible, v => { structural('자 표시', [], () => { D.rulers = D.rulers.map(x => (x.id === r.id ? { ...x, visible: v } : x)); }); }),
          btn('삭제', () => Rulers.remove(r.id)));
        add(row);
      }
    }
  },
};

/* ================= 컬러 ================= */
const ColorUI = {
  wheel: $('#wheel'),
  geo() { const s = this.wheel.width, R = s / 2 - 4, r = R - 18 * (s / 200), q = r * Math.SQRT1_2 - 4; return { s, c: s / 2, R, r, q }; },
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
      if (mode === 'hue') C.hsv[0] = (Math.atan2(y, x) * 180 / Math.PI + 360 + 90) % 360;
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
    const ang = (C.hsv[0] - 90) * Math.PI / 180, mr = (g.R + g.r) / 2, k = g.s / 200;
    x.lineWidth = 2 * k;
    x.strokeStyle = '#fff'; x.beginPath(); x.arc(g.c + Math.cos(ang) * mr, g.c + Math.sin(ang) * mr, 7 * k, 0, Math.PI * 2); x.stroke();
    const sx = x0 + C.hsv[1] * 2 * q, sy = y0 + (1 - C.hsv[2]) * 2 * q;
    x.strokeStyle = C.hsv[2] > .55 ? '#000' : '#fff'; x.beginPath(); x.arc(sx, sy, 6 * k, 0, Math.PI * 2); x.stroke();
  },
};

/* ================= 레이어 패널 ================= */
const BLENDS = [['source-over', '표준'], ['darken', '비교(어두움)'], ['multiply', '곱하기'], ['color-burn', '컬러 번'], ['lighten', '비교(밝음)'], ['screen', '스크린'], ['color-dodge', '컬러 닷지'], ['lighter', '더하기'], ['overlay', '오버레이'], ['soft-light', '소프트 라이트'], ['hard-light', '하드 라이트'], ['difference', '차의 절대값'], ['exclusion', '제외'], ['hue', '색상'], ['saturation', '채도'], ['color', '컬러'], ['luminosity', '휘도']];
const blendName = b => (b === 'pass' ? '통과' : (BLENDS.find(x => x[0] === b) || [, '표준'])[1]);
const EYE_ON = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.5 4.5-1.2"/></svg>';
const TYPE_BADGE = { vector: '벡터', text: '텍스트', adjust: '보정', fill: '채우기', gradient: '그라데이션', '3d': '3D' };
let dragLayer = null;
function renderLayers() {
  const list = $('#layers');
  list.innerHTML = '';
  for (const { L, depth } of treeOrder()) {
    if (!L.thumb) drawThumb(L);
    const badges = [];
    if (TYPE_BADGE[L.type]) badges.push(el('span', { class: 'badge type', text: L.type === 'adjust' ? (ADJUST[L.data.kind] || {}).label || '보정' : TYPE_BADGE[L.type] }));
    if (L.type === 'folder' && L.data.anim) badges.push(el('span', { class: 'badge anim', text: '애니메이션' }));
    if (L.type === 'folder' && L.data.frame) badges.push(el('span', { class: 'badge frame', text: '컷' }));
    if (L.draft) badges.push(el('span', { class: 'badge draft', text: '밑그림' }));
    if (L.ref) badges.push(el('span', { class: 'badge ref', text: '참조' }));
    if (L.locked) badges.push(el('span', { class: 'badge', text: '잠금' }));
    if (L.alphaLock) badges.push(el('span', { class: 'badge', text: '투명 잠금' }));
    if (L.fx && L.fx.tone) badges.push(el('span', { class: 'badge', text: '톤' }));
    if (Anim.hasKeys(L)) badges.push(el('span', { class: 'badge anim', text: '◆' }));
    const eye = el('button', { class: 'eye', title: L.visible ? '레이어 숨기기' : '레이어 표시', 'aria-label': L.visible ? '숨기기' : '표시', html: L.visible ? EYE_ON : EYE_OFF });
    eye.addEventListener('click', ev => { ev.stopPropagation(); setLayerProp(L, 'visible', !L.visible, L.visible ? '레이어 숨기기' : '레이어 표시'); });
    const nameEl = el('div', { class: 'lname', text: L.name });
    const parts = [eye];
    if (L.type === 'folder') {
      const tg = el('button', { class: 'ftoggle', text: L.data.open ? '▾' : '▸', 'aria-label': L.data.open ? '폴더 접기' : '폴더 펼치기' });
      tg.addEventListener('click', ev => { ev.stopPropagation(); L.data.open = !L.data.open; renderLayers(); });
      parts.push(tg);
    }
    parts.push(L.thumb);
    if (L.mask) {
      if (!L.mthumb) drawThumb(L);
      L.mthumb.classList.toggle('editing', !!L.maskEdit);
      L.mthumb.classList.toggle('off', !L.maskOn);
      L.mthumb.title = '레이어 마스크: 클릭하면 마스크 편집, Shift+클릭하면 마스크 끄기/켜기';
      L.mthumb.onclick = ev => { ev.stopPropagation(); if (ev.shiftKey) setLayerProp(L, 'maskOn', !L.maskOn, '마스크 사용'); else { selectLayer(L); toggleMaskEdit(L); } };
      parts.push(L.mthumb);
    }
    const row = el('div', { class: 'lrow' + (L.id === D.activeId ? ' active' : '') + (L.clip ? ' clip' : '') + (shownInTree(L) ? '' : ' hidden-layer') + (L.type === 'folder' ? ' folder' : ''), draggable: 'true', role: 'option', 'aria-selected': L.id === D.activeId ? 'true' : 'false', style: `--depth:${depth}` },
      ...parts, el('div', { class: 'lmeta' }, nameEl, el('div', { class: 'lsub' }, `${Math.round(L.opacity * 100)}% ${L.type === 'paper' ? '용지' : blendName(L.blend)}`, badges)));
    row.addEventListener('click', ev => { if ((ev.ctrlKey || ev.metaKey) && L.canvas) { selFromLayer(L); return; } selectLayer(L); });
    nameEl.addEventListener('dblclick', ev => {
      ev.stopPropagation();
      const inp = el('input', { value: L.name, 'aria-label': '레이어 이름' });
      nameEl.innerHTML = ''; nameEl.append(inp); inp.focus(); inp.select();
      let done = false;
      const finish = ok => { if (done) return; done = true; const v = inp.value.trim(); if (ok && v && v !== L.name) setLayerProp(L, 'name', v, '레이어 이름 변경'); else renderLayers(); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
      inp.addEventListener('blur', () => finish(true));
    });
    row.addEventListener('dragstart', ev => { dragLayer = L; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', L.name); } catch { /* 무시 */ } });
    const zone = ev => { const r = row.getBoundingClientRect(), t = (ev.clientY - r.top) / r.height; return L.type === 'folder' && t > .3 && t < .7 ? 'into' : t < .5 ? 'above' : 'below'; };
    row.addEventListener('dragover', ev => {
      if (!dragLayer) return; ev.preventDefault();
      const z = zone(ev);
      row.classList.toggle('drop-above', z === 'above'); row.classList.toggle('drop-below', z === 'below'); row.classList.toggle('drop-into', z === 'into');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below', 'drop-into'));
    row.addEventListener('drop', ev => {
      ev.preventDefault(); const z = zone(ev); row.classList.remove('drop-above', 'drop-below', 'drop-into');
      if (dragLayer && dragLayer !== L) dropLayer(dragLayer, L, z);
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
  if (L.type === 'paper') {
    box.append(colorRow('용지 색', () => L.color || '#ffffff', v => setLayerProp(L, 'color', v, '용지 색 변경')), el('p', { class: 'hint', text: '용지 레이어에는 그릴 수 없습니다.' }));
    return;
  }
  const blends = L.type === 'folder' ? [['pass', '통과'], ...BLENDS] : BLENDS;
  const sel = el('select', { 'aria-label': '합성 모드' }, blends.map(([v, t]) => el('option', { value: v, text: t })));
  sel.value = L.blend; sel.disabled = L.type === 'adjust';
  sel.addEventListener('change', () => setLayerProp(L, 'blend', sel.value, '합성 모드 변경'));
  const rng = el('input', { type: 'range', min: 0, max: 100, value: Math.round(L.opacity * 100), 'aria-label': '불투명도' });
  const num = el('input', { class: 'num', value: Math.round(L.opacity * 100), 'aria-label': '불투명도 값' });
  let start = null;
  rng.addEventListener('input', () => { if (start == null) start = L.opacity; L.opacity = rng.value / 100; num.value = rng.value; markDirty(); });
  rng.addEventListener('change', () => { const v = L.opacity; L.opacity = start ?? v; start = null; setLayerProp(L, 'opacity', v, '불투명도 변경'); });
  num.addEventListener('change', () => setLayerProp(L, 'opacity', clamp(parseInt(num.value) || 0, 0, 100) / 100, '불투명도 변경'));
  const tg = (id, label) => { const c = CMDS[id], on = !!c.check(); const b = el('button', { class: 'cmd' + (on ? ' on' : ''), text: label, title: c.label, 'aria-pressed': on ? 'true' : 'false', type: 'button' }); b.addEventListener('click', () => runCmd(id)); return b; };
  box.append(el('div', { class: 'lp-row' }, sel), el('div', { class: 'lp-row' }, el('span', { class: 'hint', text: '불투명도' }), rng, num),
    el('div', { class: 'lp-toggles' }, tg('clipLayer', '클리핑'), L.canvas ? tg('alphaLock', '투명 잠금') : null, tg('lockLayer', '잠금'), tg('refLayer', '참조'), tg('draftLayer', '밑그림')));
}
// 레이어 속성 패널: 효과·종류별 설정
const LayerPropUI = {
  render() {
    const box = $('#lprops'); if (!box) return;
    box.innerHTML = '';
    const L = active(); if (!L || L.type === 'paper') { box.append(el('p', { class: 'hint', text: '용지 레이어에는 속성이 없습니다.' })); return; }
    const btn = (t, fn) => el('button', { class: 'cmd', text: t, type: 'button', onclick: fn });
    const add = (...n) => box.append(...n);
    if (L.type === 'adjust') {
      const p = Object.assign({}, ADJUST[L.data.kind].defaults, structuredClone(L.data.params));
      let before = null;
      add(el('div', { class: 'psub', text: ADJUST[L.data.kind].label }));
      add(adjustEditor(L.data.kind, p, commit => {
        if (!before) before = snapDoc();
        L.data = { ...L.data, params: structuredClone(p) };
        markDirty();
        if (commit) { const b = before, a = snapDoc(); before = null; H.push({ label: '보정 레이어 설정', undo: () => applyDoc(b), redo: () => applyDoc(a) }); }
      }));
    }
    if (L.type === 'fill') add(colorRow('채우기 색', () => L.data.color, v => setLayerData(L, { color: v }, '채우기 색')));
    if (L.type === 'gradient') {
      add(colorRow('시작 색', () => L.data.from, v => setLayerData(L, { from: v }, '그라데이션 색')));
      add(colorRow('끝 색', () => L.data.to, v => setLayerData(L, { to: v }, '그라데이션 색')));
      add(checkRow('끝을 투명하게', () => L.data.toTrans, v => setLayerData(L, { toTrans: v }, '그라데이션 투명')));
      add(segControl('모양', [['linear', '직선'], ['radial', '원']], () => L.data.shape, v => setLayerData(L, { shape: v }, '그라데이션 모양')));
    }
    if (L.type === 'folder') {
      add(checkRow('애니메이션 폴더 (셀 전환)', () => L.data.anim, v => { setLayerData(L, { anim: v }, '애니메이션 폴더'); if (v && !Anim.tracks(L).length) { const first = kids(L.id)[0]; if (first) Anim.setSpec(L, 0, first.id); } Anim.show(true); }));
      if (L.data.frame) { const f = L.data.frame; add(paramSlider('컷 테두리', 0, 60, .5, () => f.w, v => { f.w = v; markDirty(); }, { onCommit: () => setLayerData(L, { frame: { ...f } }, '컷 테두리 굵기') })); }
    }
    // 레이어 마스크
    add(el('div', { class: 'psub', text: '레이어 마스크' }));
    if (!L.mask) add(el('div', { class: 'inline-row wrap' }, btn(Sel.has ? '선택 범위로 마스크' : '마스크 작성', () => addMask(Sel.has ? 'sel' : 'show')), btn('전체 가린 마스크', () => addMask('hide'))));
    else add(el('div', { class: 'inline-row wrap' }, btn(L.maskEdit ? '마스크 편집 끝' : '마스크 편집', () => toggleMaskEdit(L)), btn(L.maskOn ? '마스크 끄기' : '마스크 켜기', () => setLayerProp(L, 'maskOn', !L.maskOn, '마스크 사용')), L.canvas ? btn('마스크 적용', () => deleteMask(true)) : null, btn('마스크 삭제', () => deleteMask(false))));
    // 레이어 효과
    if (L.type !== 'adjust') {
      add(el('div', { class: 'psub', text: '효과' }));
      const fx = L.fx;
      add(checkRow('경계 효과 (테두리)', () => !!fx.border, v => setLayerFx(L, { border: v ? { w: 4, color: '#ffffff' } : null }, '경계 효과')));
      if (fx.border) {
        const b = { ...fx.border };
        add(paramSlider('굵기', .5, 40, .5, () => b.w, v => { b.w = v; L.fx.border = { ...b }; markDirty(); }, { onCommit: () => setLayerFx(L, { border: { ...b } }, '경계 효과 굵기') }));
        add(colorRow('색', () => b.color, v => setLayerFx(L, { border: { ...b, color: v } }, '경계 효과 색')));
      }
      add(checkRow('레이어 컬러', () => !!fx.color, v => setLayerFx(L, { color: v ? '#3a6fd8' : null }, '레이어 컬러')));
      if (fx.color) add(colorRow('색', () => fx.color, v => setLayerFx(L, { color: v }, '레이어 컬러')));
      add(checkRow('톤 (스크린톤)', () => !!fx.tone, v => setLayerFx(L, { tone: v ? { lpi: 60, angle: 45, shape: 'dot', color: '#000000' } : null }, '톤')));
      if (fx.tone) {
        const t = { ...fx.tone };
        add(paramSlider('선 수', 10, 150, 1, () => t.lpi, v => { t.lpi = v; L.fx.tone = { ...t }; markDirty(); }, { onCommit: () => setLayerFx(L, { tone: { ...t } }, '톤 선 수') }));
        add(paramSlider('각도', -90, 90, 1, () => t.angle, v => { t.angle = v; L.fx.tone = { ...t }; markDirty(); }, { onCommit: () => setLayerFx(L, { tone: { ...t } }, '톤 각도') }));
        add(segControl('망점', [['dot', '원'], ['line', '선'], ['noise', '노이즈']], () => t.shape, v => setLayerFx(L, { tone: { ...t, shape: v } }, '톤 망점')));
        add(el('p', { class: 'hint', text: '밝기(명도)에 따라 망점 크기가 정해집니다. 회색으로 칠하면 그 농도의 톤이 됩니다.' }));
      }
    }
  },
};

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
    $('#nav-zoom').addEventListener('input', e => zoomAt(.02 * Math.pow(64 / .02, e.target.value / 1000)));
    $('#nav-rot').addEventListener('input', e => rotateTo(+e.target.value));
  },
  geo() {
    const w = this.c.clientWidth || 260, h = this.c.clientHeight || 150;
    const s = Math.min((w - 12) / D.w, (h - 12) / D.h);
    return { w, h, s, ox: (w - D.w * s) / 2, oy: (h - D.h * s) / 2 };
  },
  draw() {
    if (!this.c.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, g = this.geo();
    if (this.c.width !== Math.round(g.w * dpr)) { this.c.width = Math.round(g.w * dpr); this.c.height = Math.round(g.h * dpr); }
    const x = this.c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, g.w, g.h);
    x.fillStyle = '#ffffff'; x.fillRect(g.ox, g.oy, D.w * g.s, D.h * g.s);
    x.imageSmoothingQuality = 'high';
    x.drawImage(comp.canvas, g.ox, g.oy, D.w * g.s, D.h * g.s);
    const pts = [[0, 0], [V.w, 0], [V.w, V.h], [0, V.h]].map(([a, b]) => s2d(a, b));
    x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(g.ox + p.x * g.s, g.oy + p.y * g.s) : x.moveTo(g.ox + p.x * g.s, g.oy + p.y * g.s))); x.closePath();
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
const HistUI = {
  render() {
    const box = $('#history');
    box.innerHTML = '';
    const mk = (label, i) => { const b = el('button', { class: 'hitem' + (i === H.idx ? ' cur' : i > H.idx ? ' future' : ''), text: label }); b.addEventListener('click', () => H.jump(i)); return b; };
    box.append(mk('처음 상태', 0));
    H.stack.forEach((c, i) => box.append(mk(c.label, i + 1)));
    const cur = box.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  },
};

/* ================= 상태 표시 ================= */
let lastPressure = 0;
function updateStatus(e) {
  if (e && e.pointerType === 'pen') lastPressure = e.pressure;
  const parts = [];
  if (P.pages.length > 1) parts.push(`${P.index + 1}/${P.pages.length}쪽`);
  parts.push(`${D.w}×${D.h}px ${D.dpi}dpi`, `${(V.zoom * 100).toFixed(V.zoom < .1 ? 1 : 0)}%`);
  if (V.rot) parts.push(`${Math.round(V.rot)}°`);
  if (V.flip) parts.push('좌우 반전 표시');
  if (Anim.open && D.anim) parts.push(`${D.anim.frame + 1}/${D.anim.length}프레임`);
  if (hover) { const d = s2d(hover.x, hover.y); parts.push(`X ${Math.floor(d.x)}  Y ${Math.floor(d.y)}`); }
  if (lastPressure) parts.push(`필압 ${Math.round(lastPressure * 100)}%`);
  if (Sel.has && Sel.bbox) parts.push(`선택 ${Sel.bbox.w}×${Sel.bbox.h}`);
  const L = active(); if (L && L.maskEdit) parts.push('마스크 편집 중');
  parts.push(dirtySinceSave ? '저장 대기' : '자동 저장됨');
  if (!navigator.onLine) parts.push('오프라인');
  $('#status').textContent = parts.join('   ');
}
function updateCmdStates() {
  document.querySelectorAll('[data-cmd]').forEach(b => {
    const c = CMDS[b.dataset.cmd]; if (!c) return;
    b.disabled = !!(c.enabled && !c.enabled());
    if (c.check) b.classList.toggle('on', !!c.check());
  });
  LayerPropUI.render();
}
function updateCursor() {
  const k = effKind();
  vc.style.cursor = { hand: drag ? 'grabbing' : 'grab', zoom: 'zoom-in', move: 'move', rotate: 'alias', text: 'text', object: 'default' }[k] || 'crosshair';
  if (A.float && A.float.kind === 'transform') vc.style.cursor = 'default';
}

/* ================= 명령 ================= */
function brushSize(mul) {
  const s = curSub();
  if (!('size' in s)) return;
  s.size = clamp(+(s.size * mul).toFixed(1), .5, 1000);
  saveSubs(); PropUI.render(); requestRender();
}
const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const layerCheck = k => () => { const L = active(); return !!(L && L[k]); };
const layerToggle = (k, label) => () => { const L = active(); if (L) setLayerProp(L, k, !L[k], label); };
cmd('new', '새로 만들기…', 'Ctrl+N', () => Dialogs.newDoc());
cmd('open', '열기…', 'Ctrl+O', () => $('#file-open').click());
cmd('saveProject', '프로젝트 저장 (.wpaint)', 'Ctrl+S', async () => {
  const p = await serializeProject(false);
  download(new Blob([JSON.stringify(p)], { type: 'application/json' }), safeName(P.name) + '.wpaint');
  Autosave.save();
  toast('프로젝트를 저장했습니다.');
});
cmd('export', '이미지 내보내기 (PNG · PSD · JPEG · PDF)…', 'Ctrl+Shift+S', () => Dialogs.exportDlg());
cmd('quickPng', 'PNG로 바로 내보내기', 'Ctrl+Shift+E', async () => { download(await canvasBlob(exportComposite({}), 'image/png'), safeName() + '.png'); toast('PNG로 내보냈습니다. 숨긴 레이어와 밑그림 레이어는 빠집니다.'); });
cmd('quickPsd', 'PSD로 바로 내보내기', null, () => { download(buildPSD({}), safeName() + '.psd'); toast('PSD로 내보냈습니다. 숨긴 레이어는 빠집니다.'); });
cmd('animExport', '애니메이션 내보내기 (GIF · 동영상)…', null, () => Dialogs.animExport());
cmd('import', '이미지를 레이어로 가져오기…', null, () => $('#file-import').click());
cmd('canvasSize', '캔버스 크기 변경…', null, () => Dialogs.canvasSize());
cmd('resolution', '해상도 변경…', null, () => Dialogs.resolution());
cmd('rotCW', '캔버스 90° 회전 (시계 방향)', null, () => rotateCanvasDoc('cw'));
cmd('rotCCW', '캔버스 90° 회전 (반시계 방향)', null, () => rotateCanvasDoc('ccw'));
cmd('rot180', '캔버스 180° 회전', null, () => rotateCanvasDoc('180'));
cmd('canvasFlipH', '캔버스 좌우 반전', null, () => rotateCanvasDoc('fh'));
cmd('pressure', '필압 검출 레벨 조절…', null, () => Dialogs.pressure());
cmd('undo', '실행 취소', 'Ctrl+Z', () => H.undo(), { enabled: () => H.idx > 0 || !!A.float });
cmd('redo', '다시 실행', ['Ctrl+Y', 'Ctrl+Shift+Z'], () => H.redo(), { enabled: () => H.idx < H.stack.length });
cmd('cut', '잘라내기', 'Ctrl+X', () => copySel(true));
cmd('copy', '복사', 'Ctrl+C', () => copySel(false));
cmd('paste', '붙여넣기', null, () => { if (clipboard) pasteCanvas(clipboard.canvas, clipboard.x, clipboard.y); else toast('붙여넣을 내용이 없습니다.'); });
cmd('clear', '삭제', ['Delete', 'Backspace'], () => clearSelected(false));
cmd('clearOutside', '선택 범위 외 삭제', 'Shift+Delete', () => clearSelected(true), { enabled: () => Sel.has });
cmd('fillSel', '채우기', 'Alt+Backspace', () => fillSelection());
cmd('transform', '확대/축소/회전', 'Ctrl+T', () => startTransform('affine'));
cmd('freeTransform', '자유 변형', 'Ctrl+Shift+T', () => startTransform('free'));
cmd('meshTransform', '메쉬 변형', null, () => startTransform('mesh'));
cmd('puppet', '퍼펫 워프', null, () => startTransform('puppet'));
cmd('flipH', '좌우 반전', null, () => flipLayer(true));
cmd('flipV', '상하 반전', null, () => flipLayer(false));
for (const k of Object.keys(ADJUST)) cmd('f-' + k, ADJUST[k].label + (k === 'invert' ? '' : '…'), { hsl: 'Ctrl+U', invert: 'Ctrl+I', levels: 'Ctrl+L', curve: 'Ctrl+M2' }[k] || null, () => openFilter(k));
for (const k of Object.keys(PIXEL_FILTERS)) cmd('f-' + k, PIXEL_FILTERS[k].label + '…', null, () => openFilter(k));
for (const k of Object.keys(ADJUST)) cmd('adj-' + k, ADJUST[k].label, null, () => addAdjustLayer(k));
cmd('newLayer', '신규 래스터 레이어', 'Ctrl+Shift+N', addLayer);
cmd('newVector', '신규 벡터 레이어', null, () => addLayerOfType('vector', {}, '신규 벡터 레이어'));
cmd('newFolder', '신규 레이어 폴더', null, () => addFolder(false));
cmd('wrapFolder', '레이어 폴더를 작성하여 넣기', 'Ctrl+G', () => addFolder(true));
cmd('newFill', '신규 채우기 레이어', null, () => addLayerOfType('fill', { data: { color: drawHex() } }, '채우기 레이어'));
cmd('newGradient', '신규 그라데이션 레이어', null, () => addLayerOfType('gradient', { data: { a: { x: 0, y: 0 }, b: { x: D.w, y: D.h }, shape: 'linear', from: hex(C.main), to: hex(C.sub), toTrans: false } }, '그라데이션 레이어'));
cmd('new3d', '신규 3D 레이어', null, () => Three3D.newLayer());
cmd('newTone', '톤 (스크린톤) 붙이기…', null, () => Dialogs.tone());
cmd('newAnim', '애니메이션 폴더', null, () => Anim.newAnimFolder());
cmd('newCel', '신규 애니메이션 셀', null, () => Anim.newCel());
cmd('newFrame', '컷 테두리 폴더 작성', null, () => Manga.createFrameFolder(Manga.defaultFrameRect()));
cmd('dupLayer', '레이어 복제', null, dupLayer);
cmd('delLayer', '레이어 삭제', null, delLayer);
cmd('mergeDown', '아래 레이어와 결합', 'Ctrl+E', mergeDown);
cmd('mergeVisible', '표시 레이어 결합', 'Ctrl+Shift+Alt+E', mergeVisible);
cmd('rasterize', '래스터화', null, () => Vector.rasterize());
cmd('layerUp', '레이어 위로', 'Ctrl+]', () => moveLayer(1));
cmd('layerDown', '레이어 아래로', 'Ctrl+[', () => moveLayer(-1));
cmd('clipLayer', '아래 레이어에서 클리핑', 'Ctrl+Alt+G', layerToggle('clip', '아래 레이어에서 클리핑'), { check: layerCheck('clip') });
cmd('alphaLock', '투명 픽셀 잠금', null, layerToggle('alphaLock', '투명 픽셀 잠금'), { check: layerCheck('alphaLock') });
cmd('lockLayer', '레이어 잠금', null, layerToggle('locked', '레이어 잠금'), { check: layerCheck('locked') });
cmd('draftLayer', '밑그림 레이어로 설정', null, layerToggle('draft', '밑그림 레이어'), { check: layerCheck('draft') });
cmd('refLayer', '참조 레이어로 설정', null, layerToggle('ref', '참조 레이어'), { check: layerCheck('ref') });
cmd('maskNew', '레이어 마스크 작성', null, () => addMask(Sel.has ? 'sel' : 'show'));
cmd('maskEdit', '마스크 편집', null, () => toggleMaskEdit(), { check: layerCheck('maskEdit'), enabled: () => !!(active() && active().mask) });
cmd('maskApply', '마스크를 레이어에 적용', null, () => deleteMask(true), { enabled: () => !!(active() && active().mask) });
cmd('maskDelete', '레이어 마스크 삭제', null, () => deleteMask(false), { enabled: () => !!(active() && active().mask) });
cmd('comps', '레이어 컴프…', null, () => Dialogs.comps());
cmd('selFromLayer', '레이어에서 선택 범위 작성', null, () => selFromLayer(active()));
cmd('selectAll', '전체 선택', 'Ctrl+A', selectAll);
cmd('deselect', '선택 해제', 'Ctrl+D', deselect, { enabled: () => Sel.has });
cmd('invertSel', '선택 범위 반전', 'Ctrl+Shift+I', invertSel, { enabled: () => Sel.has });
cmd('growSel', '선택 범위 확장…', null, () => Dialogs.number('선택 범위 확장', '확장 폭 (px)', 4, v => growSel(v)));
cmd('shrinkSel', '선택 범위 축소…', null, () => Dialogs.number('선택 범위 축소', '축소 폭 (px)', 4, v => growSel(-v)));
cmd('featherSel', '경계 흐리기…', null, () => Dialogs.number('경계 흐리기', '흐리기 폭 (px)', 6, v => featherSel(v)));
cmd('quickMask', '퀵 마스크', 'Ctrl+M', toggleQuickMask, { check: () => D.layers.some(L => L.quickmask) });
cmd('selStore', '선택 범위 저장·불러오기…', null, () => Dialogs.selections());
cmd('zoomIn', '확대', ['Ctrl++', 'Ctrl+Shift++'], () => zoomStep(1));
cmd('zoomOut', '축소', 'Ctrl+-', () => zoomStep(-1));
cmd('actual', '100%', 'Ctrl+Alt+0', () => zoomAt(1));
cmd('fit', '피팅', 'Ctrl+0', fitView);
cmd('resetRot', '회전·반전 초기화', null, () => { V.flip = false; rotateTo(0); updateCmdStates(); });
cmd('flipView', '좌우 반전 표시', null, () => { V.flip = !V.flip; viewChanged(); updateCmdStates(); }, { check: () => V.flip });
cmd('grid', '그리드', 'Ctrl+\'', () => { VIEW.grid = !VIEW.grid; requestRender(); updateCmdStates(); }, { check: () => VIEW.grid });
cmd('rulersShow', '자 표시', 'Ctrl+R', () => { Rulers.show = !Rulers.show; requestRender(); updateCmdStates(); }, { check: () => Rulers.show });
cmd('snapRuler', '자에 스냅', 'Ctrl+1', () => { Rulers.snap.ruler = !Rulers.snap.ruler; store.set('snapRuler', Rulers.snap.ruler); PropUI.render(); updateCmdStates(); }, { check: () => Rulers.snap.ruler });
cmd('snapSpecial', '특수 자에 스냅', 'Ctrl+2', () => { Rulers.snap.special = !Rulers.snap.special; store.set('snapSpecial', Rulers.snap.special); PropUI.render(); updateCmdStates(); }, { check: () => Rulers.snap.special });
cmd('snapGrid', '그리드에 스냅', 'Ctrl+3', () => { Rulers.snap.grid = !Rulers.snap.grid; store.set('snapGrid', Rulers.snap.grid); PropUI.render(); updateCmdStates(); }, { check: () => Rulers.snap.grid });
cmd('symRuler', '대칭 자 (좌우)', null, () => { const r = D.rulers.find(x => x.kind === 'symmetry'); if (r) Rulers.remove(r.id); else Rulers.add({ kind: 'symmetry', c: { x: D.w / 2, y: D.h / 2 }, angle: 90, count: 2, mirror: true }, '대칭 자'); updateCmdStates(); }, { check: () => D.rulers.some(x => x.kind === 'symmetry') });
cmd('perspRuler', '퍼스 자 작성 (2점)', null, () => Rulers.add({ kind: 'persp', vps: Rulers.defaultPersp(2) }, '퍼스 자'));
cmd('mangaGuides', '재단선·기본 테두리 표시', null, () => { Manga.showGuides = !Manga.showGuides; requestRender(); updateCmdStates(); }, { check: () => Manga.showGuides, enabled: () => !!D.manga });
cmd('swapColor', '메인/서브 컬러 전환', 'X', () => { C.cur = C.cur === 'main' ? 'sub' : 'main'; ColorUI.syncHsv(); ColorUI.update(); });
cmd('sizeDown', '브러시 크기 줄이기', '[', () => brushSize(1 / 1.15));
cmd('sizeUp', '브러시 크기 키우기', ']', () => brushSize(1.15));
cmd('timeline', '타임라인', null, () => Anim.show(), { check: () => Anim.open });
cmd('play', '재생 / 정지', null, () => Anim.play());
cmd('frameNext', '다음 프레임', '.', () => Anim.setFrame(D.anim.frame + 1));
cmd('framePrev', '이전 프레임', ',', () => Anim.setFrame(D.anim.frame - 1));
cmd('pageAdd', '페이지 추가', null, () => Pages.add(false));
cmd('pageDup', '페이지 복제', null, () => Pages.add(true));
cmd('pageDel', '페이지 삭제', null, () => Pages.remove(), { enabled: () => P.pages.length > 1 });
cmd('pagePrev', '이전 페이지', 'Alt+PageUp', () => Pages.switchTo(P.index - 1));
cmd('pageNext', '다음 페이지', 'Alt+PageDown', () => Pages.switchTo(P.index + 1));
cmd('materials', '소재…', 'F7', () => Materials.open());
cmd('panelsReset', '패널 배치 초기화', null, () => { store.set('collapsed', {}); document.querySelectorAll('.panel.collapsed').forEach(p => p.classList.remove('collapsed')); });
cmd('shortcuts', '단축키 목록', 'F1', () => Dialogs.shortcuts());
cmd('about', 'WebPaint 정보', null, () => Dialogs.about());
cmd('install', '앱으로 설치 (오프라인 사용)', null, () => PWA.install(), { enabled: () => !!PWA.prompt });

const MENUS = [
  ['파일', ['new', 'open', '-', 'saveProject', 'export', 'quickPng', 'quickPsd', 'animExport', '-', 'import', '-', 'pressure', 'install']],
  ['편집', ['undo', 'redo', '-', 'cut', 'copy', 'paste', 'clear', 'clearOutside', 'fillSel', '-', 'transform', 'freeTransform', 'meshTransform', 'puppet', 'flipH', 'flipV', '-', 'canvasSize', 'resolution', 'rotCW', 'rotCCW', 'rot180', 'canvasFlipH', '-', ...Object.keys(ADJUST).map(k => 'f-' + k)]],
  ['레이어', ['newLayer', 'newVector', 'newFolder', 'wrapFolder', 'newFill', 'newGradient', 'new3d', 'newTone', '-', ...Object.keys(ADJUST).map(k => 'adj-' + k), '-', 'dupLayer', 'delLayer', 'mergeDown', 'mergeVisible', 'rasterize', '-', 'layerUp', 'layerDown', '-', 'clipLayer', 'alphaLock', 'lockLayer', 'draftLayer', 'refLayer', '-', 'maskNew', 'maskEdit', 'maskApply', 'maskDelete', '-', 'comps', 'selFromLayer']],
  ['선택 범위', ['selectAll', 'deselect', 'invertSel', '-', 'growSel', 'shrinkSel', 'featherSel', '-', 'quickMask', 'selStore']],
  ['표시', ['zoomIn', 'zoomOut', 'actual', 'fit', '-', 'resetRot', 'flipView', '-', 'grid', 'rulersShow', 'snapRuler', 'snapSpecial', 'snapGrid', 'symRuler', 'perspRuler', 'mangaGuides']],
  ['필터', Object.keys(PIXEL_FILTERS).map(k => 'f-' + k)],
  ['만화', ['newFrame', 'newTone', '-', 'pageAdd', 'pageDup', 'pageDel', 'pagePrev', 'pageNext']],
  ['애니메이션', ['timeline', 'newAnim', 'newCel', '-', 'play', 'framePrev', 'frameNext', '-', 'animExport']],
  ['창', ['materials', 'timeline', '-', 'panelsReset']],
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
function keyLabel(k) { return (k || '').replace('Ctrl+M2', '').replace('Ctrl+', isMac ? '⌘' : 'Ctrl+'); }
function showMenu(b, items) {
  closeMenus();
  openMenu = b; b.classList.add('open');
  const pop = $('#menupop');
  pop.innerHTML = '';
  for (const id of items) {
    if (id === '-') { pop.append(el('div', { class: 'msep' })); continue; }
    const c = CMDS[id]; if (!c) continue;
    const dis = c.enabled && !c.enabled();
    const it = el('button', { class: 'mi', disabled: dis },
      el('span', { class: 'chk', text: c.check && c.check() ? '✓' : '' }),
      el('span', { class: 'lbl', text: c.label }),
      el('kbd', { text: keyLabel(c.keys[0]) }));
    it.addEventListener('click', () => { closeMenus(); runCmd(id); });
    pop.append(it);
  }
  pop.hidden = false;
  const r = b.getBoundingClientRect();
  pop.style.left = Math.max(4, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = r.bottom + 2 + 'px';
  pop.style.maxHeight = (innerHeight - r.bottom - 12) + 'px';
}
function closeMenus() { if (openMenu) openMenu.classList.remove('open'); openMenu = null; $('#menupop').hidden = true; }
function newLayerMenu(anchor) {
  closeMenus();
  const pop = $('#menupop'); pop.innerHTML = '';
  const items = ['newLayer', 'newVector', 'newFolder', 'newFill', 'newGradient', 'new3d', 'newTone', 'newAnim', 'newFrame', '-', ...Object.keys(ADJUST).map(k => 'adj-' + k)];
  for (const id of items) {
    if (id === '-') { pop.append(el('div', { class: 'msep' }, )); pop.append(el('div', { class: 'mhead', text: '보정 레이어' })); continue; }
    const it = el('button', { class: 'mi' }, el('span', { class: 'chk' }), el('span', { class: 'lbl', text: CMDS[id].label }));
    it.addEventListener('click', () => { pop.hidden = true; runCmd(id); });
    pop.append(it);
  }
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(4, Math.min(r.left, innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = Math.max(4, r.top - pop.offsetHeight - 4) + 'px';
  pop.style.maxHeight = (innerHeight - 20) + 'px';
  openMenu = anchor;
}

/* ================= 모달 · 대화상자 ================= */
const Modal = {
  onDismiss: null,
  isOpen() { return !$('#modal-back').hidden; },
  open(title, body, buttons, opts = {}) {
    const m = $('#modal-back .modal');
    m.className = 'modal' + (opts.wide ? ' wide' : '');
    m.innerHTML = '';
    m.append(el('h3', { text: title }), el('div', { class: 'mb' }, body),
      el('div', { class: 'mf' }, buttons.map(([label, fn, primary]) => el('button', { class: 'cmd' + (primary ? ' accent' : ''), text: label, type: 'button', onclick: fn }))));
    this.onDismiss = opts.onDismiss || null;
    $('#modal-back').hidden = false;
    const f = m.querySelector('input:not([type=checkbox]):not([type=range]),select'); if (f && !opts.noFocus) f.focus();
  },
  close() { $('#modal-back').hidden = true; this.onDismiss = null; },
  dismiss() { const d = this.onDismiss; this.close(); if (d) d(); },
};
$('#modal-back').addEventListener('pointerdown', e => { if (e.target.id === 'modal-back') Modal.dismiss(); });
const frow = (label, ...ctl) => el('div', { class: 'frow' }, el('span', { text: label }), ...ctl);
const Dialogs = {
  prompt(title, def, cb) {
    const inp = el('input', { type: 'text', value: def });
    const ok = () => { const v = inp.value.trim(); if (!v) return; Modal.close(); cb(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    Modal.open(title, [frow('이름', inp)], [['취소', () => Modal.close()], ['확인', ok, true]]);
  },
  number(title, label, def, cb) {
    const n = el('input', { type: 'number', min: 1, max: 500, value: def });
    Modal.open(title, [frow(label, n)], [['취소', () => Modal.close()], ['확인', () => { Modal.close(); cb(clamp(+n.value || def, 1, 500)); }, true]]);
  },
  newDoc() {
    let kind = 'illust';
    const w = el('input', { type: 'number', min: 16, max: 10000, value: 1600 });
    const h = el('input', { type: 'number', min: 16, max: 10000, value: 1200 });
    const dpi = el('input', { type: 'number', min: 72, max: 1200, value: 350 });
    const name = el('input', { type: 'text', value: '제목 없음' });
    const paper = el('input', { type: 'color', value: '#ffffff' });
    const noPaper = el('input', { type: 'checkbox' });
    const pages = el('input', { type: 'number', min: 1, max: 200, value: 1 });
    const paperSel = el('select', {}, Object.keys(PAPERS).filter(k => PAPERS[k]).map(k => el('option', { value: k, text: k + ` (${PAPERS[k][0]}×${PAPERS[k][1]}mm)` })));
    const inner = el('input', { type: 'text', value: '150×220' });
    const bleed = el('input', { type: 'number', min: 0, max: 20, value: 3 });
    const fps = el('input', { type: 'number', min: 1, max: 60, value: 12 });
    const len = el('input', { type: 'number', min: 1, max: 3000, value: 24 });
    const sizeRows = el('div', { class: 'adj-editor' }, frow('폭 × 높이 (px)', el('div', { class: 'inline' }, w, el('span', { text: '×' }), h)));
    const mangaRows = el('div', { class: 'adj-editor' }, frow('원고 크기', paperSel), frow('기본 테두리 (mm)', inner), frow('재단 여백 (mm)', bleed), frow('페이지 수', pages));
    const animRows = el('div', { class: 'adj-editor' }, frow('프레임 레이트', fps), frow('재생 길이 (프레임)', len));
    const presets = el('div', { class: 'preset-row' });
    const setKind = k => {
      kind = k;
      for (const b of tabs.children) b.classList.toggle('on', b.dataset.k === k);
      sizeRows.hidden = k === 'manga'; mangaRows.hidden = k !== 'manga'; animRows.hidden = k !== 'anim';
      if (k === 'anim') { w.value = 1280; h.value = 720; dpi.value = 72; }
      if (k === 'manga') { dpi.value = 600; }
      presets.innerHTML = '';
      const list = k === 'illust' ? [['1600×1200', 1600, 1200, 350], ['일러스트 2000×2000', 2000, 2000, 350], ['FHD 1920×1080', 1920, 1080, 72], ['A4 350dpi', 2894, 4093, 350], ['B5 350dpi', 2508, 3541, 350], ['웹툰 690×5000', 690, 5000, 72]]
        : k === 'anim' ? [['HD 1280×720', 1280, 720, 72], ['FHD 1920×1080', 1920, 1080, 72], ['정사각 1080', 1080, 1080, 72], ['세로 1080×1920', 1080, 1920, 72]] : [];
      for (const [l, pw, ph, pd] of list) presets.append(el('button', { class: 'cmd', text: l, type: 'button', onclick: () => { w.value = pw; h.value = ph; dpi.value = pd; } }));
    };
    const tabs = el('div', { class: 'seg' }, [['illust', '일러스트'], ['manga', '만화'], ['anim', '애니메이션']].map(([k, t]) => { const b = el('button', { text: t, type: 'button', 'data-k': k }); b.addEventListener('click', () => setKind(k)); return b; }));
    Modal.open('새 캔버스', [
      tabs, presets,
      frow('파일명', name), sizeRows, mangaRows, animRows,
      frow('해상도 (dpi)', dpi),
      frow('용지 색', el('div', { class: 'inline' }, paper, el('label', { class: 'pcheck' }, noPaper, '용지 없음 (투명)'))),
      el('p', { class: 'note', text: '현재 작업은 새 캔버스로 바뀝니다. 필요하면 먼저 저장하세요.' }),
    ], [
      ['취소', () => Modal.close()],
      ['만들기', () => {
        const pd = +dpi.value || 350, nm = name.value.trim() || '제목 없음', pc = noPaper.checked ? null : paper.value;
        if (kind === 'manga') {
          const [iw, ih] = inner.value.split(/[×x*, ]+/).map(Number);
          const g = Manga.makeGuides(PAPERS[paperSel.value], +bleed.value || 0, [iw || 150, ih || 220], 5, pd);
          if (g.W * g.H > 40e6) { toast('원고가 너무 큽니다. 해상도를 낮춰 주세요.', true); return; }
          Modal.close();
          newDocument({ w: g.W, h: g.H, dpi: pd, paper: pc, name: nm, pages: clamp(+pages.value || 1, 1, 200), manga: g.guides });
          toast('만화 원고를 만들었습니다. 빨간 선이 재단선, 파란 점선이 기본 테두리입니다.');
        } else {
          const W = clamp(+w.value || 1600, 16, 10000), Hh = clamp(+h.value || 1200, 16, 10000);
          if (W * Hh > 40e6) { toast('캔버스가 너무 큽니다. 4,000만 픽셀 이하로 지정해 주세요.', true); return; }
          Modal.close();
          newDocument({ w: W, h: Hh, dpi: pd, paper: pc, name: nm, anim: kind === 'anim' ? { fps: clamp(+fps.value || 12, 1, 60), length: clamp(+len.value || 24, 1, 3000) } : null });
          if (kind === 'anim') { Anim.newAnimFolder(); H.clear(); }
        }
        Autosave.schedule();
      }, true],
    ]);
    setKind('illust');
  },
  exportDlg() {
    const fmt = el('select', {}, [['PNG', 'PNG'], ['PSD', 'PSD (레이어 유지)'], ['JPEG', 'JPEG'], ['WebP', 'WebP'], ['PDF', 'PDF (모든 페이지)'], ['ZIP', 'PNG 묶음 ZIP (모든 페이지)']].map(([v, t]) => el('option', { value: v, text: t })));
    fmt.value = store.get('exportFmt', 'PNG');
    const scale = el('input', { type: 'number', min: 5, max: 400, value: 100 });
    const quality = el('input', { type: 'number', min: 10, max: 100, value: 92 });
    const area = el('select', {}, [['canvas', '캔버스 전체'], ['trim', '재단선 안'], ['bleed', '재단 여백 포함']].map(([v, t]) => el('option', { value: v, text: t })));
    area.disabled = !D.manga; area.value = D.manga ? 'trim' : 'canvas';
    const incDraft = el('input', { type: 'checkbox' }), incHidden = el('input', { type: 'checkbox' });
    const name = el('input', { type: 'text', value: safeName(P.name) });
    const img = el('img', { class: 'export-preview', alt: '내보내기 미리보기' });
    const info = el('p', { class: 'note' });
    const hiddenCount = D.layers.filter(L => !L.visible).length;
    const scaleRow = frow('크기 (%)', scale), qRow = frow('품질', quality), areaRow = frow('범위', area), hidRow = frow('숨긴 레이어', el('label', { class: 'pcheck' }, incHidden, '숨김 상태로 PSD에 포함'));
    let url = null;
    const refresh = async () => {
      const f = fmt.value;
      scaleRow.hidden = f === 'PSD'; qRow.hidden = !(f === 'JPEG' || f === 'WebP' || f === 'PDF'); hidRow.hidden = f !== 'PSD'; areaRow.hidden = f === 'PSD' || !D.manga;
      const c = exportComposite({ includeDraft: incDraft.checked, area: area.value });
      const prev = scaled(c, Math.min(1, 640 / Math.max(c.width, c.height)), f === 'JPEG' || f === 'PDF' ? '#ffffff' : null);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(await canvasBlob(prev, 'image/png'));
      img.src = url;
      const ex = [hiddenCount && (f === 'PSD' && incHidden.checked ? `숨긴 레이어 ${hiddenCount}개는 숨김 상태로 들어갑니다` : `숨긴 레이어 ${hiddenCount}개는 내보내지 않습니다`), !incDraft.checked && D.layers.some(L => L.draft) && '밑그림 레이어는 빠집니다'].filter(Boolean);
      info.textContent = ({ PSD: '레이어·폴더·마스크·합성 모드·클리핑·보정 레이어를 유지한 PSD로 저장합니다.', PDF: `모든 페이지(${P.pages.length}쪽)를 한 PDF로 저장합니다.`, ZIP: `모든 페이지(${P.pages.length}쪽)를 PNG로 묶어 저장합니다.` }[f] || '보이는 레이어만 합쳐 한 장으로 저장합니다.') + ' ' + ex.join(' · ');
    };
    [fmt, incDraft, incHidden, area].forEach(x => x.addEventListener('change', refresh));
    refresh();
    const doExport = async () => {
      const f = fmt.value, base = (name.value.trim() || safeName()).replace(/[\\/:*?"<>|]+/g, '_'), s = clamp(+scale.value || 100, 5, 400) / 100, q = clamp(+quality.value || 92, 10, 100) / 100;
      store.set('exportFmt', f);
      const o = { includeDraft: incDraft.checked, includeHidden: incHidden.checked, area: area.value };
      try {
        if (f === 'PSD') download(buildPSD(o), base + '.psd');
        else if (f === 'PDF') {
          toast('PDF를 만드는 중…');
          const pages = await eachPage(() => { const c = scaled(exportComposite(o), s, '#ffffff'); const a = exportArea(o.area); return { canvas: c, wPt: a.w / D.dpi * 72, hPt: a.h / D.dpi * 72 }; });
          download(await buildPDF(pages), base + '.pdf');
        } else if (f === 'ZIP') {
          const files = await eachPage(async i => ({ name: `${base}_${String(i + 1).padStart(3, '0')}.png`, blob: await canvasBlob(scaled(exportComposite(o), s), 'image/png') }));
          download(await buildZip(files), base + '.zip');
        } else {
          const c = scaled(exportComposite(o), s, f === 'JPEG' ? '#ffffff' : null);
          const type = { PNG: 'image/png', JPEG: 'image/jpeg', WebP: 'image/webp' }[f];
          download(await canvasBlob(c, type, q), base + '.' + (f === 'JPEG' ? 'jpg' : f.toLowerCase()));
        }
        toast(f + ' 파일로 내보냈습니다.');
        Modal.close();
      } catch (e) { console.error(e); toast('내보내기에 실패했습니다: ' + e.message, true); }
    };
    const copyPng = async () => {
      try { const b = await canvasBlob(exportComposite({ includeDraft: incDraft.checked, area: area.value }), 'image/png'); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('PNG 이미지를 클립보드에 복사했습니다.'); }
      catch { toast('이 환경에서는 클립보드 복사가 허용되지 않습니다. 미리보기를 우클릭하거나 길게 눌러 저장하세요.', true); }
    };
    Modal.open('내보내기', [img, info, frow('형식', fmt), frow('파일명', name), areaRow, scaleRow, qRow, frow('밑그림 레이어', el('label', { class: 'pcheck' }, incDraft, '출력에 포함')), hidRow],
      [['클립보드에 PNG 복사', copyPng], ['닫기', () => Modal.close()], ['내보내기', doExport, true]], { wide: true, noFocus: true });
  },
  animExport() {
    const fmt = el('select', {}, [['gif', 'GIF 애니메이션'], ['video', '동영상 (WebM/MP4, 오디오 포함)'], ['png', 'PNG 연번 ZIP']].map(([v, t]) => el('option', { value: v, text: t })));
    const scale = el('input', { type: 'number', min: 5, max: 200, value: D.w * D.h > 2e6 ? 50 : 100 });
    const from = el('input', { type: 'number', min: 1, max: D.anim.length, value: 1 }), to = el('input', { type: 'number', min: 1, max: D.anim.length, value: D.anim.length });
    const bar = el('progress', { max: 1, value: 0, class: 'progress' });
    let busy = false;
    const go = async () => {
      if (busy) return; busy = true;
      const s = clamp(+scale.value || 100, 5, 200) / 100, a = clamp(+from.value - 1, 0, D.anim.length - 1), b = clamp(+to.value - 1, a, D.anim.length - 1);
      try {
        if (Anim.playing) Anim.stop();
        if (fmt.value === 'gif') download(await AnimExport.gif(s, a, b, v => { bar.value = v; }), safeName() + '.gif');
        else if (fmt.value === 'png') download(await AnimExport.png(s, a, b, v => { bar.value = v; }), safeName() + '_frames.zip');
        else { const r = await AnimExport.video(s, a, b, v => { bar.value = v; }); download(r.blob, safeName() + '.' + r.ext); }
        toast('애니메이션을 내보냈습니다.'); Modal.close();
      } catch (e) { console.error(e); toast('내보내기에 실패했습니다: ' + e.message, true); }
      busy = false;
    };
    Modal.open('애니메이션 내보내기', [frow('형식', fmt), frow('크기 (%)', scale), frow('범위 (프레임)', el('div', { class: 'inline' }, from, el('span', { text: '~' }), to)), bar,
      el('p', { class: 'note', text: `${D.anim.fps}fps · 숨긴 레이어와 밑그림 레이어는 빠집니다. 카메라가 켜져 있으면 카메라 화면으로 출력합니다. 동영상은 실제 재생 시간만큼 녹화합니다.` })],
    [['닫기', () => Modal.close()], ['내보내기', go, true]], { noFocus: true });
  },
  canvasSize() {
    const w = el('input', { type: 'number', min: 16, max: 10000, value: D.w }), h = el('input', { type: 'number', min: 16, max: 10000, value: D.h });
    let ax = .5, ay = .5;
    const grid = el('div', { class: 'anchor-grid' });
    const draw = () => { grid.innerHTML = ''; for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const b = el('button', { type: 'button', class: ax === i / 2 && ay === j / 2 ? 'on' : '', 'aria-label': '기준점' }); b.addEventListener('click', () => { ax = i / 2; ay = j / 2; draw(); }); grid.append(b); } };
    draw();
    Modal.open('캔버스 크기 변경', [frow('폭 × 높이 (px)', el('div', { class: 'inline' }, w, el('span', { text: '×' }), h)), frow('기준 위치', grid), el('p', { class: 'note', text: '그림은 늘이지 않고 캔버스만 넓히거나 자릅니다. 모든 페이지에 적용되며 실행 취소 내역이 초기화됩니다.' })],
      [['취소', () => Modal.close()], ['확인', () => { const W = clamp(+w.value || D.w, 16, 10000), Hh = clamp(+h.value || D.h, 16, 10000); Modal.close(); resizeCanvasDoc(W, Hh, ax, ay); }, true]]);
  },
  resolution() {
    const pct = el('input', { type: 'number', min: 5, max: 400, value: 100 }), out = el('span', { class: 'hint' });
    const upd = () => { const s = (+pct.value || 100) / 100; out.textContent = `→ ${Math.round(D.w * s)}×${Math.round(D.h * s)}px, ${Math.round(D.dpi * s)}dpi`; };
    pct.addEventListener('input', upd); upd();
    Modal.open('해상도 변경', [frow('배율 (%)', el('div', { class: 'inline' }, pct, out)), el('p', { class: 'note', text: '그림을 확대·축소합니다. 벡터 선과 텍스트는 다시 그려져 선명하게 유지됩니다. 실행 취소 내역이 초기화됩니다.' })],
      [['취소', () => Modal.close()], ['확인', () => { Modal.close(); resampleDoc(clamp(+pct.value || 100, 5, 400) / 100); }, true]]);
  },
  tone() {
    const o = { density: 30, lpi: 60, angle: 45, shape: 'dot' };
    Modal.open('톤 붙이기', [
      paramSlider('농도 (%)', 1, 100, 1, () => o.density, v => { o.density = v; }),
      paramSlider('선 수 (lpi)', 10, 150, 1, () => o.lpi, v => { o.lpi = v; }),
      paramSlider('각도', -90, 90, 1, () => o.angle, v => { o.angle = v; }),
      segControl('망점', [['dot', '원'], ['line', '선'], ['noise', '노이즈']], () => o.shape, v => { o.shape = v; }),
      el('p', { class: 'note', text: Sel.has ? '선택 범위에 톤 레이어를 만듭니다.' : '선택 범위가 없으면 캔버스 전체에 붙습니다. 먼저 자동 선택으로 범위를 잡으면 편합니다.' }),
    ], [['취소', () => Modal.close()], ['붙이기', () => { Modal.close(); Manga.newTone(o); }, true]], { noFocus: true });
  },
  comps() {
    const list = el('div', { class: 'adj-editor' });
    const draw = () => {
      list.innerHTML = '';
      if (!D.comps.length) list.append(el('p', { class: 'note', text: '저장한 레이어 컴프가 없습니다. 지금의 레이어 표시 상태를 이름 붙여 저장해 두고 언제든 되돌릴 수 있습니다.' }));
      for (const c of D.comps) list.append(el('div', { class: 'inline-row' }, el('span', { class: 'grow', text: c.name }), el('button', { class: 'cmd', text: '적용', type: 'button', onclick: () => applyComp(c.id) }), el('button', { class: 'cmd', text: '삭제', type: 'button', onclick: () => { structural('레이어 컴프 삭제', [], () => { D.comps = D.comps.filter(x => x.id !== c.id); }); draw(); } })));
    };
    draw();
    Modal.open('레이어 컴프', [list], [['현재 상태 저장', () => Dialogs.prompt('레이어 컴프 이름', `컴프 ${D.comps.length + 1}`, v => { saveComp(v); Dialogs.comps(); })], ['닫기', () => Modal.close(), true]], { noFocus: true });
  },
  selections() {
    const list = el('div', { class: 'adj-editor' });
    for (const s of D.selSaved) list.append(el('div', { class: 'inline-row' }, el('span', { class: 'grow', text: s.name }), el('button', { class: 'cmd', text: '불러오기', type: 'button', onclick: () => { Modal.close(); loadSelection(s.id); } }), el('button', { class: 'cmd', text: '추가', type: 'button', onclick: () => { Modal.close(); loadSelection(s.id, 'add'); } })));
    if (!D.selSaved.length) list.append(el('p', { class: 'note', text: '저장한 선택 범위가 없습니다.' }));
    Modal.open('선택 범위 저장·불러오기', [list], [['현재 선택 범위 저장', () => { if (!Sel.has) { toast('선택 범위가 없습니다.'); return; } Dialogs.prompt('선택 범위 이름', `선택 범위 ${D.selSaved.length + 1}`, v => saveSelection(v)); }], ['닫기', () => Modal.close(), true]], { noFocus: true });
  },
  pressure() {
    const g = el('input', { type: 'range', min: .3, max: 3, step: .05, value: S.pressureGamma, style: 'width:100%;accent-color:var(--accent)' });
    const graph = mkCanvas(200, 200); graph.style.cssText = 'width:160px;height:160px;justify-self:center;background:var(--bg);border-radius:6px';
    const pad = mkCanvas(400, 120); pad.className = 'pressure-pad';
    const draw = () => {
      const x = graph.getContext('2d'); x.clearRect(0, 0, 200, 200);
      x.strokeStyle = '#3d4047'; x.strokeRect(.5, .5, 199, 199);
      x.beginPath(); for (let i = 0; i <= 50; i++) { const p = i / 50, v = Math.pow(p, +g.value); x.lineTo(p * 200, 200 - v * 200); }
      x.strokeStyle = '#e3a446'; x.lineWidth = 2; x.stroke();
    };
    g.addEventListener('input', () => { S.pressureGamma = +g.value; draw(); });
    let last = null;
    const px = pad.getContext('2d'); px.fillStyle = '#fff'; px.fillRect(0, 0, 400, 120);
    pad.addEventListener('pointerdown', e => { pad.setPointerCapture(e.pointerId); last = null; });
    pad.addEventListener('pointermove', e => {
      if (!e.buttons) return;
      const r = pad.getBoundingClientRect(), x = (e.clientX - r.left) * 400 / r.width, y = (e.clientY - r.top) * 120 / r.height, p = Math.pow(pressureOf(e), +g.value);
      if (last) { px.strokeStyle = '#222'; px.lineCap = 'round'; px.lineWidth = .5 + p * 10; px.beginPath(); px.moveTo(last.x, last.y); px.lineTo(x, y); px.stroke(); }
      last = { x, y };
    });
    const old = S.pressureGamma;
    draw();
    Modal.open('필압 검출 레벨 조절', [graph, frow('부드럽게 ↔ 딱딱하게', g), pad, el('p', { class: 'note', text: '흰 칸에 펜으로 그려 보며 맞추세요. 왼쪽은 약한 필압에도 굵고 진하게, 오른쪽은 강하게 눌러야 굵어집니다. 마우스와 손가락은 필압 최대로 그립니다.' })],
      [['취소', () => { S.pressureGamma = old; Modal.close(); }], ['확인', () => { S.pressureGamma = +g.value; store.set('pgamma', S.pressureGamma); Modal.close(); }, true]], { noFocus: true, onDismiss: () => { S.pressureGamma = old; } });
  },
  shortcuts() {
    const rows = [
      ['펜/연필', 'P'], ['붓/에어브러시/데코레이션', 'B'], ['지우개', 'E'], ['색 혼합·흐리기·유동화', 'J'], ['채우기/그라데이션', 'G'], ['도형/컷 테두리/자', 'U'], ['텍스트/말풍선', 'T'], ['선 수정', 'Y'], ['조작(오브젝트)', 'O'],
      ['선택 범위', 'M'], ['자동 선택', 'W'], ['스포이트', 'I (그리는 중 Alt)'], ['레이어 이동', 'K'], ['손바닥', 'H (임시: Space)'], ['회전', 'R (임시: Shift+Space)'], ['돋보기', '/ (임시: Ctrl+Space)'],
      ['브러시 크기', '[ ]'], ['직선 긋기', '이전 획 끝에서 Shift+클릭'], ['선택 범위 추가/빼기', 'Shift/Alt + 드래그'], ['변형 확정/취소', 'Enter / Esc'], ['메인/서브 컬러 전환', 'X'], ['이전/다음 프레임', ', / .'], ['재생/정지 (타임라인)', 'Enter'],
      ...Object.values(CMDS).filter(c => c.keys.length && /Ctrl|Alt|F\d/.test(c.keys[0]) && !c.keys[0].includes('M2')).map(c => [c.label.replace('…', ''), keyLabel(c.keys[0])]),
      ['두 손가락', '캔버스 이동·확대·회전'],
    ];
    Modal.open('단축키 목록', el('table', { class: 'kbd-table' }, rows.map(([a, b]) => el('tr', {}, el('td', { text: a }), el('td', { text: b })))), [['닫기', () => Modal.close(), true]], { wide: true, noFocus: true });
  },
  about() {
    Modal.open('WebPaint 정보', [
      el('p', { class: 'note', text: 'CLIP STUDIO PAINT의 작업 방식(보조 도구, 레이어 클리핑·마스크, 밑그림·참조 레이어, 벡터 레이어, 자, 컷 테두리, 말풍선, 애니메이션 셀, 3D 데생 인형)을 참고해 만든 독자적인 웹 드로잉 앱입니다. 클립 스튜디오의 로고·소재·.clip 형식은 사용하지 않습니다.' }),
      el('p', { class: 'note', text: '작업은 이 브라우저에 자동 저장되고, 앱으로 설치하면 인터넷 없이도 실행됩니다. 다른 기기로 옮기려면 프로젝트 저장(.wpaint) 또는 PSD 내보내기를 사용하세요.' }),
    ], [['닫기', () => Modal.close(), true]], { noFocus: true });
  },
};

/* ================= 포인터 입력 ================= */
const touches = new Map();
let gesture = null;
function localPos(e) { const r = vc.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
const GradObj = {
  down(e, s) {
    const L = active(), d = s2d(s.x, s.y), tol = 12 / V.zoom;
    drag.L = L; drag.before = structuredClone(L.data);
    drag.k = Math.hypot(L.data.a.x - d.x, L.data.a.y - d.y) < tol ? 'a' : Math.hypot(L.data.b.x - d.x, L.data.b.y - d.y) < tol ? 'b' : null;
    if (!drag.k) { toast('시작점·끝점(표시된 원)을 끌어 주세요.'); return false; }
  },
  move(e) { const d = s2d(...Object.values(localPos(e))); drag.L.data = { ...drag.L.data, [drag.k]: d }; bumpLayer(drag.L); },
  up() { const L = drag.L, b = drag.before, a = structuredClone(L.data); H.push({ label: '그라데이션 편집', undo: () => { L.data = structuredClone(b); bumpLayer(L); }, redo: () => { L.data = structuredClone(a); bumpLayer(L); } }); },
  cancel() { drag.L.data = drag.before; bumpLayer(drag.L); },
};
OVERLAYS.screen.push(ctx => {
  const L = active();
  if (!L || L.type !== 'gradient' || effKind() !== 'object') return;
  const a = d2s(L.data.a.x, L.data.a.y), b = d2s(L.data.b.x, L.data.b.y);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = '#40aaff'; ctx.lineWidth = 1.5; ctx.stroke();
  handleBox(ctx, a, true); handleBox(ctx, b, true);
});
HANDLERS.object = {
  down(e, s) {
    const L = active();
    const route = L.type === 'vector' ? Vector.objectHandler : L.type === 'text' ? Text.objectHandler : L.type === '3d' ? Three3D.objectHandler : Manga.frameFolderOf(L) ? Manga.objectHandler : L.type === 'gradient' ? GradObj : null;
    if (!route) { toast('조작 도구는 벡터·텍스트·3D·컷 테두리·그라데이션 레이어에서 사용합니다.'); return false; }
    if (L.locked) { toast('잠긴 레이어입니다.', true); return false; }
    drag.route = route;
    return route.down.call(route, e, s);
  },
  move(e) { if (drag.route.move) drag.route.move.call(drag.route, e); },
  up(e) { if (drag.route.up) drag.route.up.call(drag.route, e); },
  cancel() { if (drag.route && drag.route.cancel) drag.route.cancel.call(drag.route); },
};
HANDLERS.hand = {
  down(e, s) { drag.prev = s; updateCursor(); },
  move(e) { const s = localPos(e), a = s2d(drag.prev.x, drag.prev.y), b = s2d(s.x, s.y); V.cx += a.x - b.x; V.cy += a.y - b.y; drag.prev = s; viewChanged(); },
};
HANDLERS.rotate = {
  down(e, s) { drag.a0 = Math.atan2(s.y - V.h / 2, s.x - V.w / 2); drag.r0 = V.rot; },
  move(e) { const s = localPos(e); let r = drag.r0 + (Math.atan2(s.y - V.h / 2, s.x - V.w / 2) - drag.a0) * 180 / Math.PI; if (e.shiftKey) r = Math.round(r / 15) * 15; rotateTo(r); },
};
HANDLERS.zoom = {
  down(e, s) { drag.s0 = s; drag.z0 = V.zoom; drag.moved = false; drag.out = e.altKey; },
  move(e) { const s = localPos(e), dx = s.x - drag.s0.x; if (Math.abs(dx) > 3) drag.moved = true; if (drag.moved) zoomAt(drag.z0 * Math.pow(1.01, dx), drag.s0.x, drag.s0.y); },
  up() { if (!drag.moved) zoomStep(drag.out ? -1 : 1, drag.s0.x, drag.s0.y); },
};
vc.addEventListener('pointerdown', e => {
  if (Modal.isOpen()) return;
  closeMenus();
  if (Text.editing && e.target === vc) { /* 편집기 밖 클릭: 텍스트 도구가 처리 */ }
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
  const kind = e.button === 1 ? 'hand' : (A.float && A.float.kind === 'transform' ? 'transform' : effKind());
  drag = { kind, id: e.pointerId };
  const h = HANDLERS[kind];
  try {
    if (!h || h.down.call(h, e, s) === false) { drag = null; requestRender(); return; }
  } catch (err) { console.error(err); drag = null; toast(err.message, true); return; }
  updateStatus(e);
  requestRender();
});
vc.addEventListener('pointermove', e => {
  const s = localPos(e);
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) { touches.set(e.pointerId, s); if (gesture) { moveGesture(); return; } }
  hover = s;
  if (drag && drag.id === e.pointerId) { const h = HANDLERS[drag.kind]; if (h.move) { try { h.move.call(h, e); } catch (err) { console.error(err); } } }
  else requestRender();
  updateStatus(e);
});
function endPointer(e, cancelled) {
  if (e.pointerType === 'touch') { touches.delete(e.pointerId); if (gesture) { if (touches.size < 2) gesture = null; return; } }
  if (!drag || drag.id !== e.pointerId) return;
  const h = HANDLERS[drag.kind];
  try { if (cancelled) { if (h.cancel) h.cancel.call(h); } else if (h.up) h.up.call(h, e); }
  catch (err) { console.error(err); toast(err.message, true); }
  drag = null;
  requestRender(); updateCursor();
}
vc.addEventListener('pointerup', e => endPointer(e, false));
vc.addEventListener('pointercancel', e => endPointer(e, true));
vc.addEventListener('pointerleave', () => { hover = null; requestRender(); });
vc.addEventListener('contextmenu', e => e.preventDefault());
vc.addEventListener('dblclick', () => { if (Polyline.pts) Polyline.finish(false); if (PolySel.pts) PolySel.close(); });
function abortDrag() { if (!drag) return; const h = HANDLERS[drag.kind]; if (h.cancel) h.cancel.call(h); drag = null; requestRender(); }
function startGesture() {
  const [a, b] = [...touches.values()];
  gesture = { z0: V.zoom, r0: V.rot, d0: Math.hypot(b.x - a.x, b.y - a.y), ang0: Math.atan2(b.y - a.y, b.x - a.x), doc: s2d((a.x + b.x) / 2, (a.y + b.y) / 2) };
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
  else if (e.deltaX !== 0 || (e.deltaMode === 0 && Math.abs(e.deltaY) < 40 && !Number.isInteger(e.deltaY))) { const a = s2d(0, 0), b = s2d(e.deltaX, e.deltaY); V.cx += b.x - a.x; V.cy += b.y - a.y; viewChanged(); }
  else if (e.shiftKey) { const a = s2d(0, 0), b = s2d(e.deltaY, 0); V.cx += b.x - a.x; V.cy += b.y - a.y; viewChanged(); }
  else zoomStep(e.deltaY < 0 ? 1 : -1, s.x, s.y);
}, { passive: false });

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
  else if (e.code === 'Comma') k = ',';
  else if (e.code === 'Period') k = '.';
  else if (k.length === 1) k = k.toUpperCase();
  return (e.ctrlKey || e.metaKey ? 'Ctrl+' : '') + (e.shiftKey ? 'Shift+' : '') + (e.altKey ? 'Alt+' : '') + k;
}
window.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') { if (e.key === 'Escape') e.target.blur(); return; }
  if (Modal.isOpen()) { if (e.key === 'Escape') Modal.dismiss(); return; }
  const k = keyName(e);
  if (A.float && A.float.kind === 'transform') {
    if (e.key === 'Enter') { e.preventDefault(); commitFloat('변형'); return; }
    if (e.key === 'Escape') { e.preventDefault(); cancelFloat(); return; }
  }
  if (PolySel.pts && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.key === 'Enter' ? PolySel.close() : PolySel.cancel(); return; }
  if (Polyline.pts && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.key === 'Enter' ? Polyline.finish(false) : Polyline.cancel(); return; }
  if (e.key === 'Enter' && Anim.open && !e.repeat) { e.preventDefault(); Anim.play(); return; }
  if (e.key === ' ' && !e.repeat) { e.preventDefault(); S.temp = (e.ctrlKey || e.metaKey) ? 'zoom' : e.shiftKey ? 'rotate' : 'hand'; updateCursor(); return; }
  if (e.key === ' ') { e.preventDefault(); return; }
  if (e.key === 'Alt') { e.preventDefault(); if (['brush', 'fill', 'gradient', 'figure'].includes(baseKind()) && !drag) { S.temp = 'eyedropper'; updateCursor(); } return; }
  for (const c of Object.values(CMDS)) if (c.keys.includes(k)) { e.preventDefault(); runCmd(c.id); return; }
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    const group = TOOL_LIST.filter(t => t.key === k);
    if (group.length) { e.preventDefault(); const i = group.findIndex(t => t.id === S.toolId); setTool(group[(i + 1) % group.length].id); return; }
    if (k === 'R') { e.preventDefault(); setTool('hand', 'rotate'); }
  }
});
window.addEventListener('keyup', e => { if (e.key === ' ' || (e.key === 'Alt' && S.temp === 'eyedropper')) { S.temp = null; updateCursor(); } });
window.addEventListener('blur', () => { S.temp = null; updateCursor(); });

/* ================= PWA ================= */
const PWA = {
  prompt: null,
  init() {
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.prompt = e; updateCmdStates(); $('#btn-install').hidden = false; });
    window.addEventListener('appinstalled', () => { this.prompt = null; $('#btn-install').hidden = true; toast('앱으로 설치했습니다. 이제 인터넷 없이도 실행됩니다.'); });
    window.addEventListener('online', () => updateStatus()); window.addEventListener('offline', () => { updateStatus(); toast('오프라인입니다. 작업은 계속할 수 있고 브라우저에 자동 저장됩니다.'); });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('새 버전이 준비되었습니다. 새로고침하면 적용됩니다.'); });
        });
      }).catch(err => console.warn('서비스 워커 등록 실패', err));
    }
  },
  async install() { if (!this.prompt) return; this.prompt.prompt(); await this.prompt.userChoice; this.prompt = null; $('#btn-install').hidden = true; updateCmdStates(); },
};

/* ================= 바인딩 ================= */
function bindUI() {
  document.querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => runCmd(b.dataset.cmd)));
  $('#btn-left').addEventListener('click', () => { $('#workspace').classList.toggle('show-left'); $('#workspace').classList.remove('show-right'); });
  $('#btn-right').addEventListener('click', () => { $('#workspace').classList.toggle('show-right'); $('#workspace').classList.remove('show-left'); });
  $('#btn-newlayer-menu').addEventListener('click', e => newLayerMenu(e.currentTarget));
  $('#btn-install').addEventListener('click', () => PWA.install());
  $('#tf-ok').addEventListener('click', () => commitFloat('변형'));
  $('#tf-cancel').addEventListener('click', () => cancelFloat());
  $('#tf-mode').addEventListener('change', e => setFloatMode(e.target.value));
  $('#tf-fliph').addEventListener('click', () => { if (A.float && A.float.mode === 'affine') { A.float.sx *= -1; floatDirty(); } });
  $('#tf-flipv').addEventListener('click', () => { if (A.float && A.float.mode === 'affine') { A.float.sy *= -1; floatDirty(); } });
  $('#file-open').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f, false); e.target.value = ''; });
  $('#file-import').addEventListener('change', e => { const f = e.target.files[0]; if (f) openFile(f, true); e.target.value = ''; });
  $('#file-material').addEventListener('change', e => { const f = e.target.files[0]; if (f) Materials.importFile(f); e.target.value = ''; });
  $('#page-prev').addEventListener('click', () => Pages.switchTo(P.index - 1));
  $('#page-next').addEventListener('click', () => Pages.switchTo(P.index + 1));
  $('#page-add').addEventListener('click', () => Pages.add(false));
  $('#page-dup').addEventListener('click', () => Pages.add(true));
  $('#page-del').addEventListener('click', () => Pages.remove());
  $('#page-left').addEventListener('click', () => Pages.move(-1));
  $('#page-right').addEventListener('click', () => Pages.move(1));
  // 패널 접기
  const collapsed = store.get('collapsed', {});
  document.querySelectorAll('.panel[data-panel]').forEach(p => {
    const id = p.dataset.panel;
    if (collapsed[id]) p.classList.add('collapsed');
    p.querySelector('.ph').addEventListener('click', ev => {
      if (ev.target.closest('button,input,select')) return;
      p.classList.toggle('collapsed');
      const c = store.get('collapsed', {}); c[id] = p.classList.contains('collapsed'); store.set('collapsed', c);
      navDirty = true; requestRender();
    });
  });
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
