/* 파일 오브젝트 레이어: 이미지 파일을 원본 그대로 레이어로 붙여 두고, 이동·확대·회전·반전을 몇 번 해도
 * 원본에서 다시 그려 화질이 떨어지지 않는다. 원본 다시 읽기·원본 바꾸기·래스터화를 지원한다.
 * 그리고 레이어를 각각 PNG 파일로 내보내는 기능. */
'use strict';

const FileObj = {
  // srcId → { blob, name, bmp, loading, handle }
  map: new Map(),
  register(srcId, blob, name, handle) {
    const e = this.map.get(srcId) || {};
    Object.assign(e, { blob, name: name || e.name || '이미지', bmp: null, loading: null });
    if (handle) e.handle = handle;
    this.map.set(srcId, e);
    return e;
  },
  bitmap(srcId) {
    const e = this.map.get(srcId);
    if (!e) return Promise.reject(new Error('원본 이미지가 없습니다.'));
    if (e.bmp) return Promise.resolve(e.bmp);
    if (!e.loading) e.loading = createImageBitmap(e.blob).then(b => (e.bmp = b));
    return e.loading;
  },
  matrix(d) { return new DOMMatrix().translate(d.x, d.y).rotate(d.rot || 0).scale(d.s * (d.fx || 1), d.s * (d.fy || 1)).translate(-d.w / 2, -d.h / 2); },
  render(L) {
    const x = L.ctx, d = L.data;
    x.clearRect(0, 0, D.w, D.h);
    const e = this.map.get(d.srcId);
    if (!e) return;
    if (!e.bmp) { this.bitmap(d.srcId).then(() => bumpLayer(L)).catch(err => console.warn(err)); return; }
    x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.setTransform(this.matrix(d)); x.drawImage(e.bmp, 0, 0); x.restore();
  },
  fit(w, h) { const s = Math.min(1, D.w / w, D.h / h); return { s, x: D.w / 2, y: D.h / 2 }; },
  /* ---------- 만들기 ---------- */
  async pick() {
    if (window.showOpenFilePicker) {
      try {
        const hs = await window.showOpenFilePicker({ multiple: true, types: [{ description: '이미지', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'] } }] });
        const items = [];
        for (const h of hs) items.push({ file: await h.getFile(), handle: h });
        await this.create(items);
      } catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
      return;
    }
    $('#file-fileobj').click();
  },
  async create(items) {
    const ok = [];
    for (const { file, handle } of items) {
      if (!file.type.startsWith('image/')) continue;
      const srcId = 'f' + uid();
      this.register(srcId, file, file.name, handle);
      try { const b = await this.bitmap(srcId); ok.push({ srcId, name: file.name.replace(/\.[^.]+$/, ''), w: b.width, h: b.height, handle }); }
      catch { toast(`${file.name}: 이미지를 읽을 수 없습니다.`, true); this.map.delete(srcId); }
    }
    if (!ok.length) return;
    if (A.float) cancelFloat();
    structural(ok.length > 1 ? `파일 오브젝트 ${ok.length}개` : '파일 오브젝트', [], () => {
      for (const o of ok) {
        const f = this.fit(o.w, o.h);
        const L = newLayer({ type: 'file', name: o.name, data: { srcId: o.srcId, file: o.name, w: o.w, h: o.h, x: f.x, y: f.y, s: f.s, rot: 0, fx: 1, fy: 1 } });
        insertLayer(L); D.activeId = L.id;
        this.render(L); L.renderedRev = L.rev;
      }
    });
    for (const o of ok) if (o.handle) this.saveHandle(o.srcId, o.handle);
    setTool('object');
    toast(`파일 오브젝트 ${ok.length}개를 붙였습니다. 조작 도구로 크기·위치·회전을 바꿔도 화질이 유지됩니다.`);
  },
  async saveHandle(srcId, h) { try { await Autosave.put('fh:' + srcId, h); } catch { /* 저장 불가 브라우저 */ } },
  /* ---------- 편집 ---------- */
  update(fn, label) {
    const L = active(); if (!L || L.type !== 'file') return;
    const before = structuredClone(L.data);
    fn(L.data);
    bumpLayer(L);
    this.push(L, before, label);
    PropUI.render();
  },
  push(L, before, label) {
    const after = structuredClone(L.data);
    H.push({ label, undo: () => { L.data = structuredClone(before); bumpLayer(L); PropUI.render(); }, redo: () => { L.data = structuredClone(after); bumpLayer(L); PropUI.render(); } });
  },
  async reread() {
    const L = active(); if (!L || L.type !== 'file') return;
    const e = this.map.get(L.data.srcId) || {};
    let h = e.handle;
    if (!h) { try { h = await Autosave.get('fh:' + L.data.srcId); } catch { h = null; } }
    if (!h || !h.getFile) { toast('이 브라우저에서는 원본 파일 위치를 기억하지 못했습니다. "원본 바꾸기"로 수정한 파일을 다시 골라 주세요.', true); return; }
    try {
      if (h.queryPermission && (await h.queryPermission({ mode: 'read' })) !== 'granted') await h.requestPermission({ mode: 'read' });
      const file = await h.getFile();
      await this.replaceWith(L, file, h, '원본 다시 읽기');
      toast('원본 파일을 다시 읽었습니다.');
    } catch (err) { toast('원본 파일을 읽지 못했습니다: ' + err.message, true); }
  },
  async replaceWith(L, file, handle, label = '원본 바꾸기') {
    const srcId = 'f' + uid();
    this.register(srcId, file, file.name, handle);
    let b;
    try { b = await this.bitmap(srcId); } catch { toast('이미지를 읽을 수 없습니다.', true); return; }
    const before = structuredClone(L.data);
    // 보이는 폭을 유지한다
    const shownW = L.data.w * L.data.s;
    L.data = { ...L.data, srcId, file: file.name, w: b.width, h: b.height, s: shownW / b.width };
    bumpLayer(L); this.push(L, before, label); PropUI.render();
    if (handle) this.saveHandle(srcId, handle);
  },
  async replace() {
    const L = active(); if (!L || L.type !== 'file') return;
    if (window.showOpenFilePicker) {
      try { const [h] = await window.showOpenFilePicker({ types: [{ description: '이미지', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'] } }] }); await this.replaceWith(L, await h.getFile(), h); }
      catch (e) { if (e.name !== 'AbortError') toast(e.message, true); }
      return;
    }
    this.replaceTarget = L.id;
    $('#file-fileobj-replace').click();
  },
  corners(d) {
    const M = vm().multiply(this.matrix(d));
    return [[0, 0], [d.w, 0], [d.w, d.h], [0, d.h]].map(([x, y]) => { const p = M.transformPoint(new DOMPoint(x, y)); return { x: p.x, y: p.y }; });
  },
  rotHandle(c) {
    const mx = (c[0].x + c[1].x) / 2, my = (c[0].y + c[1].y) / 2, cx = (c[0].x + c[2].x) / 2, cy = (c[0].y + c[2].y) / 2;
    const dx = mx - cx, dy = my - cy, l = Math.hypot(dx, dy) || 1;
    return { x: mx + dx / l * 26, y: my + dy / l * 26, base: { x: mx, y: my } };
  },
};
RENDERERS.file = L => FileObj.render(L);

FileObj.objectHandler = {
  down(e, s, forceMove) {
    const L = active(), d = L.data, c = FileObj.corners(d), rh = FileObj.rotHandle(c);
    drag.L = L; drag.before = structuredClone(d); drag.d0 = s2d(s.x, s.y);
    if (forceMove) drag.mode = 'move';
    else if (Math.hypot(rh.x - s.x, rh.y - s.y) < 11) { drag.mode = 'rotate'; drag.a0 = Math.atan2(drag.d0.y - d.y, drag.d0.x - d.x); }
    else if (c.some(p => Math.hypot(p.x - s.x, p.y - s.y) < 11)) { drag.mode = 'scale'; drag.r0 = Math.hypot(drag.d0.x - d.x, drag.d0.y - d.y) || 1; }
    else if (pointInPoly(s, c)) drag.mode = 'move';
    else { toast('그림 안을 끌면 이동, 모서리 점은 크기, 위쪽 둥근 손잡이는 회전입니다.'); return false; }
  },
  move(e) {
    const L = drag.L, b = drag.before, p = s2d(...Object.values(localPos(e)));
    const d = { ...b };
    if (drag.mode === 'move') { d.x = b.x + p.x - drag.d0.x; d.y = b.y + p.y - drag.d0.y; if (e.shiftKey) { if (Math.abs(p.x - drag.d0.x) > Math.abs(p.y - drag.d0.y)) d.y = b.y; else d.x = b.x; } }
    else if (drag.mode === 'scale') d.s = clamp(b.s * Math.hypot(p.x - b.x, p.y - b.y) / drag.r0, .005, 40);
    else { let r = (b.rot || 0) + (Math.atan2(p.y - b.y, p.x - b.x) - drag.a0) * 180 / Math.PI; if (e.shiftKey) r = Math.round(r / 15) * 15; d.rot = ((r + 540) % 360) - 180; }
    L.data = d; bumpLayer(L); drag.moved = true;
  },
  up() { if (drag.moved) { FileObj.push(drag.L, drag.before, { move: '파일 오브젝트 이동', scale: '파일 오브젝트 크기', rotate: '파일 오브젝트 회전' }[drag.mode]); PropUI.render(); } },
  cancel() { drag.L.data = drag.before; bumpLayer(drag.L); },
};
// 레이어 이동 도구(K)로도 파일 오브젝트를 옮긴다
{
  const base = HANDLERS.move;
  HANDLERS.move = {
    down(e, s) { if (active().type === 'file') { drag.fileMove = true; return FileObj.objectHandler.down(e, s, true); } return base.down.call(base, e, s); },
    move(e) { return drag.fileMove ? FileObj.objectHandler.move(e) : base.move.call(base, e); },
    up(e) { return drag.fileMove ? FileObj.objectHandler.up(e) : base.up.call(base, e); },
    cancel() { return drag.fileMove ? FileObj.objectHandler.cancel() : base.cancel && base.cancel.call(base); },
  };
}
OVERLAYS.screen.push(ctx => {
  const L = active();
  if (!L || L.type !== 'file' || !['object', 'move'].includes(effKind())) return;
  const c = FileObj.corners(L.data), rh = FileObj.rotHandle(c);
  ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.lineWidth = 1; ctx.setLineDash([5, 3]); ctx.strokeStyle = '#40aaff'; ctx.stroke(); ctx.setLineDash([]);
  if (effKind() !== 'object') return;
  for (const p of c) handleBox(ctx, p);
  ctx.beginPath(); ctx.moveTo(rh.base.x, rh.base.y); ctx.lineTo(rh.x, rh.y); ctx.strokeStyle = '#40aaff'; ctx.stroke();
  handleBox(ctx, rh, true);
});
FileObj.props = (add, hint, btn) => {
  const L = active(), d = L.data;
  add(el('p', { class: 'hint', text: `원본: ${d.file || L.name} · ${d.w}×${d.h}px · 지금 ${Math.round(d.s * 100)}%` }));
  const s0 = d.s, r0 = d.rot || 0;
  let s = Math.round(s0 * 1000) / 10, r = Math.round(r0);
  add(paramSlider('배율 (%)', .5, 1000, .1, () => s, v => { s = v; L.data.s = v / 100; bumpLayer(L); }, { log: true, fmt: v => Math.round(v * 10) / 10, onCommit: () => { const v = s / 100; L.data.s = s0; FileObj.update(x => { x.s = v; }, '파일 오브젝트 크기'); } }));
  add(paramSlider('회전', -180, 180, 1, () => r, v => { r = v; L.data.rot = v; bumpLayer(L); }, { onCommit: () => { const v = r; L.data.rot = r0; FileObj.update(x => { x.rot = v; }, '파일 오브젝트 회전'); } }));
  add(el('div', { class: 'inline-row wrap' },
    btn('좌우 반전', () => FileObj.update(x => { x.fx = -(x.fx || 1); }, '파일 오브젝트 좌우 반전')),
    btn('상하 반전', () => FileObj.update(x => { x.fy = -(x.fy || 1); }, '파일 오브젝트 상하 반전')),
    btn('원래 크기', () => FileObj.update(x => { x.s = 1; x.rot = 0; }, '파일 오브젝트 원래 크기')),
    btn('캔버스에 맞춤', () => FileObj.update(x => { Object.assign(x, FileObj.fit(x.w, x.h), { rot: 0 }); x.s = Math.min(D.w / x.w, D.h / x.h); }, '파일 오브젝트 맞춤')),
    btn('가운데로', () => FileObj.update(x => { x.x = D.w / 2; x.y = D.h / 2; }, '파일 오브젝트 가운데'))));
  add(el('div', { class: 'inline-row wrap' },
    btn('원본 다시 읽기', () => FileObj.reread()),
    btn('원본 바꾸기', () => FileObj.replace()),
    btn('래스터화', () => Vector.rasterize())));
  hint('그림 안을 끌면 이동, 모서리 점은 크기, 위쪽 둥근 손잡이는 회전(Shift: 15°). 원본 파일을 다른 프로그램에서 고쳤다면 "원본 다시 읽기"로 반영합니다. 그 위에 그리려면 새 레이어를 만들거나 래스터화하세요.');
};

/* ---------- 레이어를 각각 파일로 내보내기 ---------- */
const LayerExport = {
  // 레이어 하나를 화면에 보이는 모습(마스크·효과·불투명도·클리핑 포함, 합성 모드 제외)으로
  pixels(L) {
    const c = mkCanvas(D.w, D.h), x = c.getContext('2d'), r = Rect.full();
    if (L.type === 'folder') {
      // 폴더는 안의 레이어를 합친 모습으로
      const saved = new Map(D.layers.map(l => [l, l.visible]));
      const keep = new Set([L, ...descendants(L), ...ancestors(L)]);
      for (const l of D.layers) l.visible = keep.has(l) ? (l === L || ancestors(L).includes(l) ? true : l.visible) : false;
      const op = L.opacity; L.opacity = 1;
      compositeInto(x, r, { raw: true, export: true });
      L.opacity = op;
      for (const [l, v] of saved) l.visible = v;
    } else {
      drawSrcFull(x, layerSource(L, r, { raw: true, export: true }, 'lexp'));
      if (L.clip) {
        const sib = kids(L.parent), i = sib.indexOf(L);
        let b = null; for (let k = i - 1; k >= 0; k--) if (!sib[k].clip) { b = sib[k]; break; }
        if (b && b._hasCanvas) { x.globalCompositeOperation = 'destination-in'; drawSrcFull(x, layerSource(b, r, { raw: true }, 'lexp2')); x.globalCompositeOperation = 'source-over'; }
      }
    }
    const out = mkCanvas(D.w, D.h), ox = out.getContext('2d');
    ox.globalAlpha = L.opacity;
    ox.drawImage(c, 0, 0);
    return out;
  },
  targets(o) {
    const list = [];
    const walk = pid => {
      for (const L of kids(pid)) {
        if (!o.hidden && !L.visible) continue;
        if (L.quickmask || L.type === 'adjust') continue;
        if (L.type === 'paper' && !o.paper) continue;
        if (L.type === 'folder' && !o.mergeFolders) { walk(L.id); continue; }
        list.push(L);
      }
    };
    walk(0);
    return list;
  },
  async run(o) {
    const list = o.onlyActive ? [active()] : this.targets(o);
    if (!list.length) { toast('내보낼 레이어가 없습니다.', true); return; }
    const files = [], used = new Set();
    let n = 0;
    for (const L of list) {
      let c = this.pixels(L);
      if (o.crop) { const bb = contentBBox(c); if (!bb) continue; c = cloneCanvas(c, bb); }
      n++;
      let nm = `${String(n).padStart(2, '0')}_${(L.name || '레이어').replace(/[\\/:*?"<>|]+/g, '_')}`;
      while (used.has(nm)) nm += '_';
      used.add(nm);
      files.push({ name: nm + '.png', blob: await canvasBlob(c, 'image/png') });
    }
    if (!files.length) { toast('그림이 있는 레이어가 없습니다.', true); return; }
    if (files.length === 1) download(files[0].blob, safeName() + '_' + files[0].name.replace(/^\d+_/, ''));
    else download(await buildZip(files), safeName() + '_레이어.zip');
    toast(`레이어 ${files.length}개를 PNG로 내보냈습니다.`);
  },
  dialog() {
    const o = { hidden: false, paper: false, mergeFolders: false, crop: false, onlyActive: false };
    const count = el('p', { class: 'note' });
    const upd = () => { const k = o.onlyActive ? 1 : this.targets(o).length; count.textContent = `PNG ${k}장${k > 1 ? '을 ZIP 하나로 묶어' : '을'} 저장합니다. 파일 이름 앞 번호는 아래 레이어부터 매깁니다. 합성 모드는 파일에 담기지 않습니다.`; };
    const chk = (label, k) => checkRow(label, () => o[k], v => { o[k] = v; upd(); });
    Modal.open('레이어를 각각 파일로 내보내기', [
      chk('지금 선택한 레이어만', 'onlyActive'),
      chk('숨긴 레이어도 포함', 'hidden'),
      chk('용지 레이어도 포함', 'paper'),
      chk('폴더는 하나로 합쳐서 내보내기', 'mergeFolders'),
      chk('그림이 있는 부분만 잘라내기 (끄면 캔버스 크기 그대로)', 'crop'),
      count,
    ], [['취소', () => Modal.close()], ['내보내기', async () => { Modal.close(); try { await this.run(o); } catch (e) { console.error(e); toast('내보내기에 실패했습니다: ' + e.message, true); } }, true]], { noFocus: true });
    upd();
  },
};

/* ---------- 명령 · 메뉴 ---------- */
cmd('newFileObj', '파일 오브젝트로 불러오기…', null, () => FileObj.pick());
cmd('fileObjReread', '파일 오브젝트 원본 다시 읽기', null, () => FileObj.reread(), { enabled: () => !!(active() && active().type === 'file') });
cmd('exportLayers', '레이어를 각각 파일로 내보내기 (PNG)…', null, () => LayerExport.dialog());
cmd('exportActiveLayer', '선택한 레이어만 PNG로 내보내기', null, () => LayerExport.run({ onlyActive: true, crop: false }));
{
  const file = MENUS.find(m => m[0] === '파일')[1];
  file.splice(file.indexOf('animExport') + 1, 0, 'exportLayers', 'exportActiveLayer');
  file.splice(file.indexOf('import') + 1, 0, 'newFileObj');
  const layer = MENUS.find(m => m[0] === '레이어')[1];
  layer.splice(layer.indexOf('new3d') + 1, 0, 'newFileObj');
  layer.splice(layer.indexOf('rasterize') + 1, 0, 'fileObjReread');
}
