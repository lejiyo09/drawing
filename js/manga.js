/* 만화: 다중 페이지 관리, 만화 원고 가이드(재단선·도련·기본 테두리), 컷 테두리 폴더·컷 나누기, 스크린톤 */
'use strict';

const mm2px = (mm, dpi = D.dpi) => Math.round(mm / 25.4 * dpi);

/* ---------- 페이지 ---------- */
const Pages = {
  store(i = P.index) {
    const pg = P.pages[i]; if (!pg) return;
    for (const k of PAGE_FIELDS) pg[k] = D[k];
    pg.hist = { stack: H.stack, idx: H.idx };
  },
  load(i, quiet) {
    P.index = i;
    const pg = P.pages[i];
    for (const k of PAGE_FIELDS) D[k] = pg[k];
    if (!D.anim) D.anim = defaultAnim();
    H.stack = pg.hist ? pg.hist.stack : []; H.idx = pg.hist ? pg.hist.idx : 0;
    if (quiet) return;
    if (!comp.canvas || comp.canvas.width !== D.w || comp.canvas.height !== D.h) allocDocCanvases();
    Sel.ctx.clearRect(0, 0, D.w, D.h); Sel.has = false; selChanged();
    A.overlay = A.replace = A.float = null; A.target = 'canvas';
    Vector.sel.clear(); Text.selId = null;
    for (const L of D.layers) if (L.renderedRev !== L.rev) refreshLayer(L);
    markDirty(); renderLayers(); HistUI.render(); Anim.renderTimeline(); this.render(); updateCmdStates();
  },
  blank(o) {
    return { w: o.w, h: o.h, dpi: o.dpi, layers: [], activeId: 0, nameSeq: 1, name: o.name, manga: o.manga ? structuredClone(o.manga) : null, anim: defaultAnim(), rulers: [], comps: [], selSaved: [], audio: null, hist: { stack: [], idx: 0 } };
  },
  // 페이지 데이터를 D에 올린 상태에서 기본 레이어를 만든다
  populate(paper) {
    const pp = newLayer({ type: 'paper', name: '용지', color: paper || '#ffffff' });
    if (paper === null) pp.visible = false;
    D.layers.push(pp);
    const L = newLayer();
    D.layers.push(L);
    D.activeId = L.id;
  },
  switchTo(i) {
    if (i === P.index || i < 0 || i >= P.pages.length) return;
    if (Text.editing) Text.commitEditor();
    if (A.float) cancelFloat();
    if (Anim.playing) Anim.stop();
    this.store(); this.thumb(P.index);
    this.load(i);
    toast(`${i + 1}페이지`);
  },
  add(dup) {
    if (A.float) cancelFloat();
    this.store(); this.thumb(P.index);
    const src = P.pages[P.index];
    const pg = this.blank({ w: D.w, h: D.h, dpi: D.dpi, name: D.name, manga: D.manga });
    P.pages.splice(P.index + 1, 0, pg);
    const from = P.index;
    this.load(P.index + 1, true);
    if (dup) {
      const map = new Map();
      for (const L of src.layers) {
        const n = newLayer({ type: L.type, name: L.name });
        for (const k of PROPS) if (k !== 'type') n[k] = L[k];
        n.fx = structuredClone(L.fx); n.data = snapData(L); n.data = L.type === 'vector' ? n.data : structuredClone(L.data);
        if (n.canvas && L.canvas) n.ctx.drawImage(L.canvas, 0, 0);
        if (L.mask) n.mask = cloneCanvas(L.mask);
        map.set(L.id, n.id); D.layers.push(n);
      }
      for (const L of D.layers) L.parent = map.get(L.parent) || 0;
      D.activeId = map.get(src.activeId) || D.layers[D.layers.length - 1].id;
      D.rulers = structuredClone(src.rulers);
    } else this.populate(src.layers.find(L => L.type === 'paper')?.color || '#ffffff');
    void from;
    this.load(P.index);
    this.store();
  },
  remove() {
    if (P.pages.length <= 1) { toast('마지막 페이지는 삭제할 수 없습니다.', true); return; }
    P.pages.splice(P.index, 1);
    this.load(Math.min(P.index, P.pages.length - 1));
    Autosave.schedule();
  },
  move(dir) {
    const i = P.index, j = i + dir;
    if (j < 0 || j >= P.pages.length) return;
    this.store();
    [P.pages[i], P.pages[j]] = [P.pages[j], P.pages[i]];
    P.index = j; this.render(); Autosave.schedule();
  },
  thumb(i) {
    const pg = P.pages[i]; if (!pg) return;
    if (i === P.index) flushComposite();
    const c = pg.thumb || (pg.thumb = mkCanvas(90, 120)), x = c.getContext('2d');
    x.fillStyle = '#2d2f34'; x.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / D.w, c.height / D.h);
    if (i === P.index && comp.canvas) x.drawImage(comp.canvas, (c.width - D.w * s) / 2, (c.height - D.h * s) / 2, D.w * s, D.h * s);
  },
  render() {
    const box = $('#pages'); if (!box) return;
    this.thumb(P.index);
    box.innerHTML = '';
    P.pages.forEach((pg, i) => {
      if (!pg.thumb) this.thumb(i);
      const b = el('button', { class: 'page-item' + (i === P.index ? ' active' : ''), title: `${i + 1}페이지`, 'aria-label': `${i + 1}페이지` }, pg.thumb, el('span', { text: String(i + 1) }));
      b.addEventListener('click', () => this.switchTo(i));
      box.append(b);
    });
    $('#page-count').textContent = `${P.index + 1} / ${P.pages.length}`;
  },
};

/* ---------- 만화 원고 가이드 ---------- */
const PAPERS = { B5: [182, 257], A4: [210, 297], A5: [148, 210], B4: [257, 364], '웹 (세로)': null };
const Manga = {
  makeGuides(trimMM, bleedMM, innerMM, marginMM, dpi) {
    const tw = mm2px(trimMM[0], dpi), th = mm2px(trimMM[1], dpi), bl = mm2px(bleedMM, dpi), mg = mm2px(marginMM, dpi);
    const W = tw + 2 * (bl + mg), Hh = th + 2 * (bl + mg);
    const trim = { x: bl + mg, y: bl + mg, w: tw, h: th };
    const iw = mm2px(innerMM[0], dpi), ih = mm2px(innerMM[1], dpi);
    const inner = { x: trim.x + (tw - iw) / 2, y: trim.y + (th - ih) / 2, w: iw, h: ih };
    return { W, H: Hh, guides: { trim, bleed: bl, inner } };
  },
  scaleGuides(g, s, map) {
    const m = r => { const p = map(r.x, r.y); return { x: p.x, y: p.y, w: r.w * s, h: r.h * s }; };
    return { trim: m(g.trim), bleed: g.bleed * s, inner: m(g.inner) };
  },
  drawGuides(ctx, px) {
    const g = D.manga; if (!g || !Manga.showGuides) return;
    const t = g.trim, b = g.bleed, i = g.inner;
    ctx.lineWidth = px;
    ctx.strokeStyle = 'rgba(60,140,230,.85)'; ctx.strokeRect(t.x - b, t.y - b, t.w + 2 * b, t.h + 2 * b);
    ctx.strokeStyle = 'rgba(230,60,60,.85)'; ctx.strokeRect(t.x, t.y, t.w, t.h);
    ctx.setLineDash([6 * px, 4 * px]); ctx.strokeStyle = 'rgba(60,140,230,.85)'; ctx.strokeRect(i.x, i.y, i.w, i.h); ctx.setLineDash([]);
    // 돈보(재단 표시)
    ctx.strokeStyle = 'rgba(40,40,40,.9)'; ctx.beginPath();
    const L = Math.max(20, b * 2.5);
    for (const [x, y, sx, sy] of [[t.x, t.y, -1, -1], [t.x + t.w, t.y, 1, -1], [t.x, t.y + t.h, -1, 1], [t.x + t.w, t.y + t.h, 1, 1]]) {
      ctx.moveTo(x, y + sy * b); ctx.lineTo(x + sx * L, y + sy * b); ctx.moveTo(x + sx * b, y); ctx.lineTo(x + sx * b, y + sy * L);
      ctx.moveTo(x, y + sy * b); ctx.lineTo(x, y + sy * (b + L * .6)); ctx.moveTo(x + sx * b, y); ctx.lineTo(x + sx * (b + L * .6), y);
    }
    ctx.stroke();
  },
  showGuides: true,
  /* ---------- 컷 테두리 ---------- */
  defaultFrameRect() {
    if (D.manga) return { ...D.manga.inner };
    const m = Math.round(Math.min(D.w, D.h) * .06);
    return { x: m, y: m, w: D.w - 2 * m, h: D.h - 2 * m };
  },
  rectPoly(r) { return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]; },
  createFrameFolder(rect, label = '컷 테두리 폴더') {
    let F;
    const bw = Math.max(2, Math.round(D.dpi / 25.4 * .5));
    structural(label, [], () => {
      const n = D.layers.filter(L => L.type === 'folder' && L.data.frame).length + 1;
      F = newLayer({ type: 'folder', name: '컷 ' + n, data: { open: true, anim: false, frame: { polys: [this.rectPoly(rect)], w: bw, color: '#000000' } } });
      const inner = newLayer({ parent: F.id });
      const a = active(), idx = a ? layerIndex(a) + 1 : D.layers.length;
      const top = a && a.parent ? ancestors(a).pop() : null;
      const at = top ? layerIndex(top) + 1 : idx;
      D.layers.splice(at, 0, F, inner);
      D.activeId = inner.id;
    });
    return F;
  },
  frameFolderOf(L) {
    if (!L) return null;
    if (L.type === 'folder' && L.data.frame) return L;
    return ancestors(L).find(f => f.data.frame) || null;
  },
  applyFrame(gx, F) {
    const polys = F.data.frame.polys;
    gx.save(); gx.globalCompositeOperation = 'destination-in'; gx.beginPath();
    for (const p of polys) { p.forEach((q, i) => (i ? gx.lineTo(q.x, q.y) : gx.moveTo(q.x, q.y))); gx.closePath(); }
    gx.fillStyle = '#000'; gx.fill(); gx.restore();
  },
  drawBorders(gx, F) {
    const f = F.data.frame; if (!f.w) return;
    gx.save(); gx.globalCompositeOperation = 'source-over'; gx.lineJoin = 'miter'; gx.lineWidth = f.w; gx.strokeStyle = f.color || '#000';
    for (const p of f.polys) { gx.beginPath(); p.forEach((q, i) => (i ? gx.lineTo(q.x, q.y) : gx.moveTo(q.x, q.y))); gx.closePath(); gx.stroke(); }
    gx.restore();
  },
  clipHalf(poly, nx, ny, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P0 = poly[i], Q = poly[(i + 1) % poly.length], dp = nx * P0.x + ny * P0.y - c, dq = nx * Q.x + ny * Q.y - c;
      if (dp >= 0) out.push(P0);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push({ x: lerp(P0.x, Q.x, t), y: lerp(P0.y, Q.y, t) }); }
    }
    return out;
  },
  segHitsPoly(a, b, poly) {
    if (pointInPoly(a, poly) || pointInPoly(b, poly)) return true;
    for (let i = 0; i < poly.length; i++) if (Vector.segIntersect([a.x, a.y], [b.x, b.y], [poly[i].x, poly[i].y], [poly[(i + 1) % poly.length].x, poly[(i + 1) % poly.length].y]) != null) return true;
    return false;
  },
  split(a, b, o) {
    const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
    if (l < 4) return;
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux, c = nx * a.x + ny * a.y;
    const gap = Math.abs(ux) > Math.abs(uy) ? o.gapY : o.gapX;
    // 선이 지나가는 모든 컷을 나눈다
    const targets = D.layers.filter(L => L.type === 'folder' && L.data.frame && shownInTree(L) && L.data.frame.polys.some(poly => this.segHitsPoly(a, b, poly)));
    let did = false;
    structural('컷 나누기', [], () => {
      for (const F of targets) {
        const keep = [], made = [];
        for (const poly of F.data.frame.polys) {
          if (!this.segHitsPoly(a, b, poly)) { keep.push(poly); continue; }
          const p1 = this.clipHalf(poly, nx, ny, c + gap / 2), p2 = this.clipHalf(poly, -nx, -ny, -c + gap / 2);
          if (p1.length < 3 || p2.length < 3) { keep.push(poly); continue; }
          did = true;
          if (o.splitMode === 'border') keep.push(p1, p2);
          else { keep.push(p1); made.push(p2); }
        }
        F.data.frame.polys = keep;
        F.rev = revSeq++;
        for (const poly of made) {
          // 나뉜 컷은 새 컷 테두리 폴더가 된다
          const n = D.layers.filter(L => L.type === 'folder' && L.data.frame).length + 1;
          const NF = newLayer({ type: 'folder', name: '컷 ' + n, parent: F.parent, data: { open: true, anim: false, frame: { polys: [poly], w: F.data.frame.w, color: F.data.frame.color } } });
          const inner = newLayer({ parent: NF.id });
          const at = layerIndex(F) + 1;
          D.layers.splice(at, 0, NF, inner);
        }
      }
      if (!did) return false;
    });
    if (!did) toast('나눌 컷이 없습니다. 컷 테두리를 가로지르도록 선을 그어 주세요.');
  },
  drawFrameHandles(ctx, px) {
    const k = typeof effKind === 'function' ? effKind() : '';
    if (k !== 'object' && k !== 'frame') return;
    const F = Manga.frameFolderOf(active()); if (!F) return;
    ctx.strokeStyle = 'rgba(64,170,255,.9)'; ctx.lineWidth = 1.5 * px;
    for (const p of F.data.frame.polys) {
      ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke();
      if (k === 'object') for (const q of p) { ctx.fillStyle = '#fff'; ctx.fillRect(q.x - 4 * px, q.y - 4 * px, 8 * px, 8 * px); ctx.strokeRect(q.x - 4 * px, q.y - 4 * px, 8 * px, 8 * px); }
    }
  },
  /* ---------- 스크린톤 ---------- */
  newTone(o) {
    const g = Math.round(255 * (1 - o.density / 100));
    structural('톤', [], () => {
      const L = newLayer({ type: 'fill', name: `톤 ${o.lpi}선 ${o.density}%`, data: { color: hex([g, g, g]) }, fx: { color: null, border: null, tone: { lpi: o.lpi, angle: o.angle, shape: o.shape, color: '#000000' } } });
      if (Sel.has) { L.mask = cloneCanvas(Sel.canvas); }
      insertLayer(L);
      D.activeId = L.id;
    });
    if (Sel.has) toast('선택 범위에 톤을 붙였습니다. 레이어 마스크로 범위를 고칠 수 있습니다.');
  },
};
OVERLAYS.doc.push((ctx, px) => Manga.drawGuides(ctx, px));
OVERLAYS.doc.push((ctx, px) => Manga.drawFrameHandles(ctx, px));

HANDLERS.frame = {
  down(e, s) {
    const o = curSub(), d = s2d(s.x, s.y);
    drag.a = d; drag.b = d;
    drag.preview = (ctx, px) => {
      ctx.lineWidth = 2 * px; ctx.strokeStyle = 'rgba(227,164,70,.95)'; ctx.beginPath();
      if (o.fk === 'rect') { const r = Rect.ofPoints([drag.a, drag.b]); ctx.rect(r.x, r.y, r.w, r.h); }
      else { ctx.moveTo(drag.a.x, drag.a.y); ctx.lineTo(drag.b.x, drag.b.y); }
      ctx.stroke();
    };
  },
  move(e) {
    let d = s2d(...Object.values(localPos(e)));
    if (e.shiftKey && curSub().fk === 'split') { const a = drag.a, ang = Math.round(Math.atan2(d.y - a.y, d.x - a.x) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(d.x - a.x, d.y - a.y); d = { x: a.x + Math.cos(ang) * l, y: a.y + Math.sin(ang) * l }; }
    drag.b = d; requestRender();
  },
  up() {
    const o = curSub();
    if (o.fk === 'rect') { const r = Rect.ofPoints([drag.a, drag.b]); if (r.w > 8 && r.h > 8) Manga.createFrameFolder(r, '직사각형 컷'); }
    else Manga.split(drag.a, drag.b, o);
  },
};
// 오브젝트 도구 (컷 테두리 폴더): 꼭짓점·컷 이동
Manga.objectHandler = {
  down(e, s) {
    const F = Manga.frameFolderOf(active()), d = s2d(s.x, s.y), tol = 8 / V.zoom;
    drag.F = F; drag.before = structuredClone(F.data.frame); drag.start = d;
    for (let pi = 0; pi < F.data.frame.polys.length; pi++) {
      const poly = F.data.frame.polys[pi];
      const vi = poly.findIndex(q => Math.hypot(q.x - d.x, q.y - d.y) < tol);
      if (vi >= 0) { drag.pi = pi; drag.vi = vi; return; }
      if (pointInPoly(d, poly)) { drag.pi = pi; drag.vi = -1; return; }
    }
    return false;
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e))), dx = d.x - drag.start.x, dy = d.y - drag.start.y, F = drag.F;
    F.data.frame = structuredClone(drag.before);
    const poly = F.data.frame.polys[drag.pi];
    if (drag.vi >= 0) { poly[drag.vi].x += dx; poly[drag.vi].y += dy; }
    else poly.forEach(q => { q.x += dx; q.y += dy; });
    markDirty(); drag.moved = true;
  },
  up() {
    if (!drag.moved) return;
    const F = drag.F, b = drag.before, a = structuredClone(F.data.frame);
    H.push({ label: '컷 테두리 편집', undo: () => { F.data.frame = structuredClone(b); markDirty(); }, redo: () => { F.data.frame = structuredClone(a); markDirty(); } });
  },
  cancel() { drag.F.data.frame = drag.before; markDirty(); },
};
