/* 레이어 명령: 종류별 레이어 작성, 폴더, 레이어 마스크, 결합, 순서, 레이어 컴프, 편집 명령, 필터(파괴적 적용) */
'use strict';

function insertLayer(L) {
  let a = active();
  if (!a) { D.layers.push(L); return; }
  // 애니메이션 폴더 안에는 셀(래스터·벡터)만 넣는다. 다른 종류는 폴더 바로 위에 둔다.
  const af = Anim.animFolderOf(a);
  if (af && !['raster', 'vector'].includes(L.type)) { L.parent = af.parent; const end = descendants(af).pop() || af; D.layers.splice(layerIndex(end) + 1, 0, L); return; }
  if (a.type === 'folder' && a.data.open && !L.parent) {
    L.parent = a.id;
    const ch = descendants(a), last = ch.length ? ch[ch.length - 1] : a;
    D.layers.splice(layerIndex(last) + 1, 0, L);
  } else {
    if (!L.parent) L.parent = a.parent;
    const after = a.type === 'folder' ? (descendants(a).pop() || a) : a;
    D.layers.splice(layerIndex(after) + 1, 0, L);
  }
}
function addLayerOfType(type, o = {}, label) {
  if (A.float) return;
  let L;
  structural(label || ('신규 ' + LAYER_TYPE_NAMES[type] + ' 레이어'), [], () => {
    L = newLayer({ type, ...o });
    insertLayer(L);
    if (o.data) { L.rev = revSeq++; }
    D.activeId = L.id;
  });
  return L;
}
function addLayer() { addLayerOfType('raster', {}, '신규 래스터 레이어'); }
function addAdjustLayer(kind) {
  const L = addLayerOfType('adjust', { data: { kind, params: structuredClone(ADJUST[kind].defaults) }, name: ADJUST[kind].label }, '보정 레이어: ' + ADJUST[kind].label);
  if (L && Sel.has) structural('보정 레이어 마스크', [], () => { L.mask = cloneCanvas(Sel.canvas); });
}
function addFolder(wrapActive) {
  if (A.float) return;
  structural(wrapActive ? '폴더에 넣기' : '신규 폴더', [], () => {
    const a = active();
    const F = newLayer({ type: 'folder' });
    if (wrapActive && a && a.type !== 'paper') {
      F.parent = a.parent;
      D.layers.splice(layerIndex(a), 0, F);
      a.parent = F.id;
    } else insertLayer(F);
    D.activeId = F.id;
  });
}
function dupLayer() {
  const src = active(); if (!src || A.float) return;
  structural('레이어 복제', [], () => {
    const copy = (L, parent) => {
      const n = newLayer({ type: L.type, name: L === src ? L.name + ' 복사' : L.name });
      for (const k of PROPS) if (k !== 'name' && k !== 'type') n[k] = L[k];
      n.parent = parent; n.fx = structuredClone(L.fx); n.keys = L.keys ? structuredClone(L.keys) : null;
      n.data = L.type === 'vector' ? { ...L.data, strokes: L.data.strokes.map(s => ({ ...s, id: uid() })) } : structuredClone(L.data);
      if (n.canvas && L.canvas) { n.ctx.clearRect(0, 0, D.w, D.h); n.ctx.drawImage(L.canvas, 0, 0); }
      if (L.mask) n.mask = cloneCanvas(L.mask);
      n.rev = revSeq++; n.renderedRev = n.rev;
      return n;
    };
    const top = copy(src, src.parent), list = [top];
    if (src.type === 'folder') {
      const map = new Map([[src.id, top.id]]);
      for (const d of descendants(src)) { const n = copy(d, map.get(d.parent)); map.set(d.id, n.id); list.push(n); }
    }
    const after = src.type === 'folder' ? (descendants(src).pop() || src) : src;
    D.layers.splice(layerIndex(after) + 1, 0, ...list);
    D.activeId = top.id;
  });
}
function delLayer() {
  const L = active(); if (!L || A.float) return;
  const gone = new Set([L, ...(L.type === 'folder' ? descendants(L) : [])]);
  if (D.layers.length - gone.size < 1) { toast('마지막 레이어는 삭제할 수 없습니다.', true); return; }
  structural('레이어 삭제', [], () => {
    const i = layerIndex(L);
    D.layers = D.layers.filter(x => !gone.has(x));
    D.activeId = (D.layers[Math.min(i, D.layers.length) - 1] || D.layers[0]).id;
  });
}
// 같은 부모 안에서 한 칸 위·아래로
function moveLayer(dir) {
  const L = active(); if (!L || A.float) return;
  const sib = kids(L.parent), i = sib.indexOf(L), j = i + dir;
  if (j < 0 || j >= sib.length) {
    // 폴더 밖으로 나가기
    if (L.parent && ((dir > 0 && j >= sib.length) || (dir < 0 && j < 0))) {
      const F = findLayer(L.parent);
      structural('레이어 순서 변경', [], () => { L.parent = F.parent; const block = [L, ...(L.type === 'folder' ? descendants(L) : [])]; D.layers = D.layers.filter(x => !block.includes(x)); const at = dir > 0 ? layerIndex(descendants(F).pop() || F) + 1 : layerIndex(F); D.layers.splice(at, 0, ...block); });
    }
    return;
  }
  const other = sib[j];
  structural('레이어 순서 변경', [], () => {
    const blockA = [L, ...(L.type === 'folder' ? descendants(L) : [])];
    D.layers = D.layers.filter(x => !blockA.includes(x));
    const otherEnd = other.type === 'folder' ? (descendants(other).pop() || other) : other;
    const at = dir > 0 ? layerIndex(otherEnd) + 1 : layerIndex(other);
    D.layers.splice(at, 0, ...blockA);
  });
}
// 드래그 앤 드롭: target 위(above) 또는 아래, 혹은 폴더 안(into)
function dropLayer(L, target, where) {
  if (L === target || (L.type === 'folder' && descendants(L).includes(target))) return;
  structural('레이어 순서 변경', [], () => {
    const block = [L, ...(L.type === 'folder' ? descendants(L) : [])];
    D.layers = D.layers.filter(x => !block.includes(x));
    if (where === 'into') { L.parent = target.id; const end = descendants(target).pop() || target; D.layers.splice(layerIndex(end) + 1, 0, ...block); }
    else if (where === 'above') { L.parent = target.parent; const end = target.type === 'folder' ? (descendants(target).pop() || target) : target; D.layers.splice(layerIndex(end) + 1, 0, ...block); }
    else { L.parent = target.parent; D.layers.splice(layerIndex(target), 0, ...block); }
  });
}
function mergeDown() {
  const U = active(); if (!U || A.float) return;
  const sib = kids(U.parent), i = sib.indexOf(U), Lo = sib[i - 1];
  if (!Lo) { toast('아래에 결합할 레이어가 없습니다.', true); return; }
  if (Lo.type !== 'raster') { toast('아래 레이어가 래스터 레이어일 때만 결합할 수 있습니다.', true); return; }
  if (Lo.locked) { toast('아래 레이어가 잠겨 있습니다.', true); return; }
  structural('아래 레이어와 결합', [Lo], () => {
    const tmp = mkCanvas(D.w, D.h), tx = tmp.getContext('2d');
    // 아래 레이어와 위 레이어만 남긴 작은 합성
    const order = D.layers, vis = new Map(D.layers.map(x => [x, x.visible]));
    for (const x of D.layers) x.visible = x === Lo || x === U || (U.type === 'folder' && descendants(U).includes(x)) || ancestors(Lo).includes(x);
    const op = Lo.opacity, bl = Lo.blend, mk = Lo.mask; Lo.opacity = 1; Lo.blend = 'source-over';
    compositeInto(tx, Rect.full(), { raw: true });
    Lo.opacity = op; Lo.blend = bl; void mk;
    for (const [x, v] of vis) x.visible = v;
    void order;
    if (Lo.mask) Lo.mask = null;
    Lo.ctx.clearRect(0, 0, D.w, D.h); Lo.ctx.drawImage(tmp, 0, 0);
    const gone = new Set([U, ...(U.type === 'folder' ? descendants(U) : [])]);
    D.layers = D.layers.filter(x => !gone.has(x));
    D.activeId = Lo.id;
  });
}
function mergeVisible() {
  if (A.float) return;
  const vis = D.layers.filter(L => L.type !== 'paper' && shownInTree(L) && L.type !== 'folder');
  if (vis.length < 2) { toast('결합할 표시 레이어가 2개 이상 필요합니다.'); return; }
  structural('표시 레이어 결합', [], () => {
    const L = newLayer({ name: '결합된 레이어' });
    compositeInto(L.ctx, Rect.full(), { raw: true, excludePaper: true });
    const gone = new Set(D.layers.filter(x => x.type !== 'paper' && shownInTree(x)));
    D.layers = D.layers.filter(x => !gone.has(x));
    D.layers.push(L);
    for (const x of D.layers) if (x.parent && !findLayer(x.parent)) x.parent = 0;
    D.activeId = L.id;
  });
}
function setLayerProp(L, key, val, label) {
  if (L[key] === val) return;
  structural(label, L.type === 'paper' && key === 'color' ? [L] : [], () => { L[key] = val; if (key === 'color' && L.type === 'paper') paintPaper(L); });
}
function setLayerData(L, patch, label) {
  structural(label, [], () => { L.data = { ...L.data, ...patch }; L.rev = revSeq++; });
}
function setLayerFx(L, patch, label) {
  structural(label, [], () => { L.fx = { ...L.fx, ...patch }; });
}
function selectLayer(L) {
  if (A.float || drag) return;
  if (Text.editing) Text.commitEditor();
  D.activeId = L.id;
  Vector.sel.clear(); Text.selId = null;
  renderLayers(); PropUI.render();
  if (Anim.open) Anim.renderTimeline();
}

/* ---------- 레이어 마스크 ---------- */
function addMask(mode) {
  const L = active(); if (!L || L.type === 'paper') return;
  if (L.mask) { toast('이미 레이어 마스크가 있습니다.'); return; }
  structural('레이어 마스크 작성', [], () => {
    const m = mkCanvas(D.w, D.h), x = m.getContext('2d');
    if (mode === 'sel' && Sel.has) x.drawImage(Sel.canvas, 0, 0);
    else if (mode !== 'hide') { x.fillStyle = '#000'; x.fillRect(0, 0, D.w, D.h); }
    L.mask = m; L.maskOn = true; L.maskEdit = true;
  });
  toast('레이어 마스크를 편집 중입니다. 그리면 보이고, 지우면 가려집니다.');
}
function deleteMask(apply) {
  const L = active(); if (!L || !L.mask) return;
  structural(apply ? '마스크 적용' : '마스크 삭제', apply && L.canvas ? [L] : [], () => {
    if (apply && L.canvas) { L.ctx.save(); L.ctx.globalCompositeOperation = 'destination-in'; L.ctx.drawImage(L.mask, 0, 0); L.ctx.restore(); }
    L.mask = null; L.maskEdit = false;
  });
}
function toggleMaskEdit(L, on) { L = L || active(); if (!L.mask) return; L.maskEdit = on ?? !L.maskEdit; renderLayers(); requestRender(); }

/* ---------- 레이어 컴프 ---------- */
function saveComp(name) {
  const states = {}; for (const L of D.layers) states[L.id] = { visible: L.visible, opacity: L.opacity, blend: L.blend };
  structural('레이어 컴프 저장', [], () => { D.comps = D.comps.concat([{ id: uid(), name, states }]); });
}
function applyComp(id) {
  const c = D.comps.find(x => x.id === id); if (!c) return;
  structural('레이어 컴프 적용', [], () => { for (const L of D.layers) { const s = c.states[L.id]; if (s) Object.assign(L, s); } });
}

/* ---------- 편집 명령 ---------- */
function clearSelected(outside) {
  if (Vector.deleteSelected() || Text.deleteSelected()) return;
  const L = active();
  if (L.type === 'vector' && !L.maskEdit) {
    if (!Sel.has) { Vector.setStrokes(L, [], '삭제'); return; }
    const ids = Vector.targetIds(L);
    Vector.setStrokes(L, L.data.strokes.filter(s => (outside ? ids.has(s.id) : !ids.has(s.id))), outside ? '선택 범위 외 삭제' : '삭제');
    return;
  }
  if (!canPaint(L, 'pixel')) return;
  const target = editTarget(L) || L.canvas, tx = target.getContext('2d');
  const isMask = L.maskEdit && L.mask;
  const before = cloneCanvas(target);
  tx.save();
  if (Sel.has) { tx.globalCompositeOperation = outside ? 'destination-in' : 'destination-out'; tx.drawImage(Sel.canvas, 0, 0); }
  else if (!outside) tx.clearRect(0, 0, D.w, D.h);
  tx.restore();
  H.push(pixCmd(outside ? '선택 범위 외 삭제' : '삭제', L, Rect.full(), before, cloneCanvas(target), isMask ? 'mask' : 'canvas'));
  markDirty(); queueThumb(L);
}
function fillSelection() {
  const L = active();
  if (!canPaint(L, 'pixel')) return;
  const buf = T.get('buffer');
  buf.ctx.fillStyle = '#000'; buf.ctx.fillRect(0, 0, D.w, D.h);
  const erase = C.cur === 'trans';
  A.layerId = L.id; A.target = L.maskEdit && L.mask ? 'mask' : 'canvas';
  A.overlay = { canvas: buf.canvas, color: erase ? null : drawHex(), mode: erase ? 'destination-out' : (L.alphaLock && A.target === 'canvas' ? 'source-atop' : 'source-over'), alpha: 1, useSel: true };
  commitOverlay('채우기', Sel.has ? Sel.bbox : Rect.full());
}
function flipLayer(horizontal) {
  const L = active();
  if (L.type === 'vector') { if (!Vector.beginFloat('transform')) return; A.float[horizontal ? 'sx' : 'sy'] = -1; commitFloat(horizontal ? '좌우 반전' : '상하 반전'); return; }
  if (!canPaint(L, 'pixel')) return;
  const before = cloneCanvas(L.canvas), src = cloneCanvas(L.canvas);
  L.ctx.save(); L.ctx.clearRect(0, 0, D.w, D.h);
  if (horizontal) { L.ctx.translate(D.w, 0); L.ctx.scale(-1, 1); } else { L.ctx.translate(0, D.h); L.ctx.scale(1, -1); }
  L.ctx.drawImage(src, 0, 0); L.ctx.restore();
  H.push(pixCmd(horizontal ? '좌우 반전' : '상하 반전', L, Rect.full(), before, cloneCanvas(L.canvas)));
  markDirty(); queueThumb(L);
}
let clipboard = null;
function copySel(cut) {
  const L = active();
  if (!L.canvas || L.type === 'paper') return;
  const bb = Sel.has ? Sel.bbox : Rect.full();
  const c = cloneCanvas(L.canvas, bb);
  if (Sel.has) { const x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(Sel.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); }
  clipboard = { canvas: c, x: bb.x, y: bb.y };
  try { c.toBlob(b => { if (b && navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).catch(() => {}); }); } catch { /* 시스템 클립보드 없음 */ }
  if (cut) clearSelected(false); else toast('복사했습니다.');
}
function pasteCanvas(c, x, y, name) {
  structural('붙여넣기', [], () => {
    const L = newLayer({ name: name || undefined });
    if (x == null) { const s = Math.min(1, D.w / c.width, D.h / c.height); const w = c.width * s, h = c.height * s; L.ctx.drawImage(c, (D.w - w) / 2, (D.h - h) / 2, w, h); }
    else L.ctx.drawImage(c, x, y);
    insertLayer(L);
    D.activeId = L.id;
  });
}

/* ---------- 필터 (픽셀에 바로 적용) ---------- */
function premulBlur(src, w, h, radius) {
  const n = w * h, ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) { const a = src[i * 4 + 3] / 255; ch[0][i] = src[i * 4] * a; ch[1][i] = src[i * 4 + 1] * a; ch[2][i] = src[i * 4 + 2] * a; ch[3][i] = src[i * 4 + 3]; }
  const sig = radius, nb = 3, wIdeal = Math.sqrt(12 * sig * sig / nb + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sig * sig - nb * wl * wl - 4 * nb * wl - 3 * nb) / (-4 * wl - 4));
  const sizes = [0, 1, 2].map(i => ((i < m ? wl : wl + 2) - 1) / 2);
  const tmp = new Float32Array(n);
  const boxH = (s, d, r) => { const ia = 1 / (r + r + 1); for (let y = 0; y < h; y++) { const o = y * w; let acc = 0; for (let x = -r; x <= r; x++) acc += s[o + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { d[o + x] = acc * ia; acc += s[o + Math.min(w - 1, x + r + 1)] - s[o + Math.max(0, x - r)]; } } };
  const boxV = (s, d, r) => { const ia = 1 / (r + r + 1); for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += s[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { d[y * w + x] = acc * ia; acc += s[Math.min(h - 1, y + r + 1) * w + x] - s[Math.max(0, y - r) * w + x]; } } };
  for (const c of ch) for (const r of sizes) { if (r < 1) continue; boxH(c, tmp, r | 0); boxV(tmp, c, r | 0); }
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { const a = ch[3][i]; out[i * 4 + 3] = a; if (a > 0) { const k = 255 / a; out[i * 4] = ch[0][i] * k; out[i * 4 + 1] = ch[1][i] * k; out[i * 4 + 2] = ch[2][i] * k; } }
  return out;
}
const PIXEL_FILTERS = {
  blur: { label: '가우시안 흐리기', params: [['r', '흐리기 범위', 1, 100, 6]], run(src, out, p) { out.set(premulBlur(src, D.w, D.h, p.r)); } },
  sharpen: { label: '언샤프 마스크', params: [['r', '반경', 1, 20, 2], ['a', '강도', 10, 300, 80]],
    run(src, out, p) { const b = premulBlur(src, D.w, D.h, p.r), k = p.a / 100; for (let i = 0; i < src.length; i += 4) { for (let c = 0; c < 3; c++) out[i + c] = src[i + c] + (src[i + c] - b[i + c]) * k; out[i + 3] = src[i + 3]; } } },
  mosaic: { label: '모자이크', params: [['s', '모자이크 크기', 2, 120, 16]],
    run(src, out, p) {
      const s = p.s | 0, w = D.w, h = D.h;
      for (let by = 0; by < h; by += s) for (let bx = 0; bx < w; bx += s) {
        let r = 0, g = 0, b = 0, a = 0, cnt = 0;
        const ey = Math.min(h, by + s), ex = Math.min(w, bx + s);
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4, al = src[i + 3]; r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; cnt++; }
        const R = a ? r / a : 0, G = a ? g / a : 0, B = a ? b / a : 0, Al = a / cnt;
        for (let y = by; y < ey; y++) for (let x = bx; x < ex; x++) { const i = (y * w + x) * 4; out[i] = R; out[i + 1] = G; out[i + 2] = B; out[i + 3] = Al; }
      }
    } },
  noise: { label: '노이즈', params: [['a', '양', 1, 100, 20], ['mono', '흑백 (1=예)', 0, 1, 1]],
    run(src, out, p) { const k = p.a * 2.55; for (let i = 0; i < src.length; i += 4) { const g = (Math.random() - .5) * k; for (let c = 0; c < 3; c++) out[i + c] = src[i + c] + (p.mono ? g : (Math.random() - .5) * k); out[i + 3] = src[i + 3]; } } },
  motion: { label: '이동 흐리기', params: [['d', '거리', 2, 120, 20], ['ang', '각도', -180, 180, 0]],
    run(src, out, p) {
      const w = D.w, h = D.h, n = Math.max(2, Math.round(p.d / 2)), dx = Math.cos(p.ang * Math.PI / 180), dy = Math.sin(p.ang * Math.PI / 180);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let k = 0; k < n; k++) { const t = (k / (n - 1) - .5) * p.d, sx = clamp(Math.round(x + dx * t), 0, w - 1), sy = clamp(Math.round(y + dy * t), 0, h - 1), j = (sy * w + sx) * 4, al = src[j + 3]; r += src[j] * al; g += src[j + 1] * al; b += src[j + 2] * al; a += al; }
        const i = (y * w + x) * 4; out[i] = a ? r / a : 0; out[i + 1] = a ? g / a : 0; out[i + 2] = a ? b / a : 0; out[i + 3] = a / n;
      }
    } },
};
// 보정(ADJUST)도 픽셀에 바로 적용할 수 있다
function filterJob(key) {
  const L = active();
  if (!canPaint(L, 'pixel')) return null;
  const target = editTarget(L) || L.canvas, isMask = L.maskEdit && L.mask;
  const t = T.get('read').ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(target, 0, 0);
  const src = t.getImageData(0, 0, D.w, D.h).data.slice();
  const mask = Sel.has ? Sel.ctx.getImageData(0, 0, D.w, D.h).data : null;
  const out = mkCanvas(D.w, D.h), ox = out.getContext('2d');
  A.layerId = L.id; A.target = isMask ? 'mask' : 'canvas';
  const run = p => {
    const id = ox.createImageData(D.w, D.h), o = id.data;
    if (PIXEL_FILTERS[key]) PIXEL_FILTERS[key].run(src, o, p);
    else { o.set(src); ADJUST[key].make(Object.assign({}, ADJUST[key].defaults, p))(o); }
    if (mask) for (let i = 0; i < o.length; i += 4) { const m = mask[i + 3] / 255; if (m < 1) for (let k = 0; k < 4; k++) o[i + k] = src[i + k] + (o[i + k] - src[i + k]) * m; }
    ox.putImageData(id, 0, 0);
    A.replace = out; markDirty();
  };
  const label = (PIXEL_FILTERS[key] || ADJUST[key]).label;
  const commit = () => {
    const before = cloneCanvas(target), tx = target.getContext('2d');
    tx.clearRect(0, 0, D.w, D.h); tx.drawImage(out, 0, 0);
    A.replace = null; A.target = 'canvas';
    H.push(pixCmd(label, L, Rect.full(), before, cloneCanvas(target), isMask ? 'mask' : 'canvas'));
    markDirty(); queueThumb(L);
  };
  const cancel = () => { A.replace = null; A.target = 'canvas'; markDirty(); };
  return { run, commit, cancel, label };
}
function openFilter(key) {
  if (A.float) return;
  const job = filterJob(key);
  if (!job) return;
  if (key === 'invert') { job.run({}); job.commit(); return; }
  let timer = 0;
  const heavy = ['blur', 'sharpen', 'motion'].includes(key);
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => job.run(vals), heavy ? 150 : 30); };
  let vals, body;
  if (PIXEL_FILTERS[key]) {
    vals = Object.fromEntries(PIXEL_FILTERS[key].params.map(p => [p[0], p[4]]));
    body = PIXEL_FILTERS[key].params.map(([k, label, min, max]) => paramSlider(label, min, max, 1, () => vals[k], v => { vals[k] = v; schedule(); }));
  } else {
    vals = structuredClone(ADJUST[key].defaults);
    body = adjustEditor(key, vals, () => schedule());
  }
  Busy.filter = true;
  job.run(vals);
  Modal.open(job.label, [body, Sel.has ? el('p', { class: 'note', text: '선택 범위 안에만 적용됩니다.' }) : null], [
    ['취소', () => { clearTimeout(timer); job.cancel(); Busy.filter = false; Modal.close(); }],
    ['적용', () => { clearTimeout(timer); job.run(vals); job.commit(); Busy.filter = false; Modal.close(); }, true],
  ], { onDismiss: () => { clearTimeout(timer); job.cancel(); Busy.filter = false; } });
}
