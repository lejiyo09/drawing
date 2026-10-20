/* 텍스트 레이어: 가로·세로쓰기 텍스트, 말풍선(타원·사각·둥근 사각·구름·번쩍) + 말풍선 꼬리, 오브젝트 편집 */
'use strict';

const FONTS = ['IBM Plex Sans KR', 'Noto Sans KR', 'Noto Serif KR', 'Gothic A1', 'Nanum Myeongjo', 'Nanum Pen Script', 'Black Han Sans', 'Do Hyeon', 'Jua', 'sans-serif', 'serif'];
const Text = {
  selId: null,
  editing: null, // { L, id, created, layerCreated, before }
  fontStack(f) { return /serif|sans-serif|monospace/.test(f) && !f.includes(' ') ? f : `"${f}", "IBM Plex Sans KR", sans-serif`; },
  fontStr(o) { return `${o.italic ? 'italic ' : ''}${o.bold ? '700' : '400'} ${o.size}px ${this.fontStack(o.font)}`; },
  /* ---------- 말풍선 모양 ---------- */
  balloonPath(ctx, b) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2, ry = b.h / 2;
    if (b.shape === 'rect') ctx.rect(b.x, b.y, b.w, b.h);
    else if (b.shape === 'round') { const r = Math.min(b.w, b.h) * .28; ctx.roundRect ? ctx.roundRect(b.x, b.y, b.w, b.h, r) : ctx.rect(b.x, b.y, b.w, b.h); }
    else if (b.shape === 'cloud') {
      const n = Math.min(64, Math.max(8, Math.round((Math.PI * (rx + ry)) / (Math.max(1, Math.min(rx, ry)) * .55)) || 8));
      const pts = Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2; return { x: cx + Math.cos(a) * rx * .9, y: cy + Math.sin(a) * ry * .9, a }; });
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n], am = p.a + Math.PI / n;
        ctx.quadraticCurveTo(cx + Math.cos(am) * rx * 1.18, cy + Math.sin(am) * ry * 1.18, q.x, q.y);
      }
      ctx.closePath();
    } else if (b.shape === 'flash') {
      const n = b.spikes || 22;
      for (let i = 0; i < n * 2; i++) {
        const a = i / (n * 2) * Math.PI * 2, k = i % 2 ? .78 : 1.12 + ((i * 7919) % 5) / 30;
        const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    } else ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
  },
  tailPath(ctx, b, t) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, ang = Math.atan2(t.y - cy, t.x - cx);
    const half = (t.base || Math.min(b.w, b.h) * .13) / 2;
    const ex = cx + Math.cos(ang) * b.w * .38, ey = cy + Math.sin(ang) * b.h * .38;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    const bend = t.bend || .25, mx = lerp(ex, t.x, .5) + nx * half * bend * 4, my = lerp(ey, t.y, .5) + ny * half * bend * 4;
    ctx.moveTo(ex + nx * half, ey + ny * half);
    ctx.quadraticCurveTo(mx + nx * half * .3, my + ny * half * .3, t.x, t.y);
    ctx.quadraticCurveTo(mx - nx * half * .3, my - ny * half * .3, ex - nx * half, ey - ny * half);
    ctx.closePath();
  },
  /* ---------- 텍스트 배치 ---------- */
  layout(ctx, o) {
    ctx.font = this.fontStr(o);
    const lines = String(o.text || '').split('\n'), ls = o.ls || 0, lh = o.size * (o.lh || 1.3);
    const glyphs = [];
    let w = 0, h = 0;
    if (o.vertical) {
      const step = o.size * 1.06 + ls;
      lines.forEach((line, li) => {
        const x = -li * lh - o.size / 2;
        [...line].forEach((ch, ci) => {
          const punct = '、。，．'.includes(ch);
          glyphs.push({ ch, x: x + (punct ? o.size * .32 : 0), y: ci * step + o.size * (punct ? .08 : .5), rot: '─—ー〜~…()（）「」『』[]'.includes(ch) });
        });
        h = Math.max(h, [...line].length * step);
      });
      w = lines.length * lh;
      return { glyphs, w, h, vertical: true };
    }
    lines.forEach((line, li) => {
      const chars = [...line];
      let lw = 0;
      const widths = chars.map(c => ctx.measureText(c).width + ls);
      lw = widths.reduce((a, b) => a + b, 0) - (chars.length ? ls : 0);
      w = Math.max(w, lw);
      let x = 0;
      chars.forEach((ch, ci) => { glyphs.push({ ch, x, y: li * lh + o.size * .5, line: li, lw }); x += widths[ci]; });
      glyphs.push({ ch: '', x, y: li * lh, line: li, lw, eol: true });
    });
    h = lines.length * lh;
    for (const g of glyphs) { const off = o.align === 'center' ? (w - g.lw) / 2 : o.align === 'right' ? w - g.lw : 0; g.x += off; }
    return { glyphs: glyphs.filter(g => !g.eol), w, h };
  },
  bbox(o) {
    if (o.kind === 'balloon') {
      let r = { x: o.x, y: o.y, w: o.w, h: o.h };
      for (const t of o.tails || []) r = Rect.union(r, { x: t.x - 2, y: t.y - 2, w: 4, h: 4 });
      return r;
    }
    const ctx = T.get('read').ctx, l = this.layout(ctx, o);
    return l.vertical ? { x: o.x - l.w, y: o.y, w: l.w, h: l.h } : { x: o.x, y: o.y, w: Math.max(o.size * .5, l.w), h: l.h };
  },
  drawText(ctx, o) {
    const l = this.layout(ctx, o);
    ctx.save();
    if (o.rot) { const b = this.bbox(o), cx = b.x + b.w / 2, cy = b.y + b.h / 2; ctx.translate(cx, cy); ctx.rotate(o.rot * Math.PI / 180); ctx.translate(-cx, -cy); }
    ctx.font = this.fontStr(o); ctx.textBaseline = 'middle'; ctx.textAlign = l.vertical ? 'center' : 'left';
    const each = fn => { for (const g of l.glyphs) { if (g.rot) { ctx.save(); ctx.translate(o.x + g.x, o.y + g.y); ctx.rotate(Math.PI / 2); fn(g.ch, 0, 0); ctx.restore(); } else fn(g.ch, o.x + g.x, o.y + g.y); } };
    if (o.stroke && o.stroke.w > 0) {
      ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeStyle = o.stroke.color || '#ffffff'; ctx.lineWidth = o.stroke.w * 2;
      each((c, x, y) => ctx.strokeText(c, x, y));
    }
    ctx.fillStyle = o.color || '#000';
    each((c, x, y) => ctx.fillText(c, x, y));
    ctx.restore();
  },
  render(L) {
    const ctx = L.ctx;
    ctx.clearRect(0, 0, D.w, D.h);
    const balloons = L.data.objs.filter(o => o.kind === 'balloon');
    // 선을 먼저 모두 그리고 채움을 덮으면 겹친 말풍선과 꼬리가 하나로 이어진다
    for (const pass of ['line', 'fill']) for (const b of balloons) {
      ctx.save(); ctx.beginPath(); this.balloonPath(ctx, b); for (const t of b.tails || []) this.tailPath(ctx, b, t);
      if (pass === 'line') { if (b.lw > 0) { ctx.lineWidth = b.lw * 2; ctx.lineJoin = 'round'; ctx.strokeStyle = b.line || '#000'; ctx.stroke(); } }
      else { ctx.fillStyle = b.fill || '#fff'; ctx.fill(); }
      ctx.restore();
    }
    for (const o of L.data.objs) if (o.kind === 'text') {
      if (!document.fonts.check(this.fontStr(o))) document.fonts.load(this.fontStr(o)).then(() => { if (L.data.objs.includes(o)) bumpLayer(L); }).catch(() => {});
      this.drawText(ctx, o);
    }
  },
  hitObj(L, d) {
    const tol = 4 / V.zoom;
    for (let i = L.data.objs.length - 1; i >= 0; i--) { const o = L.data.objs[i]; if (o.kind !== 'text') continue; const b = this.bbox(o); if (d.x >= b.x - tol && d.y >= b.y - tol && d.x <= b.x + b.w + tol && d.y <= b.y + b.h + tol) return o; }
    for (let i = L.data.objs.length - 1; i >= 0; i--) { const o = L.data.objs[i]; if (o.kind !== 'balloon') continue; const c = T.get('read').ctx; c.beginPath(); this.balloonPath(c, o); if (c.isPointInPath(d.x, d.y)) return o; }
    return null;
  },
  hitBalloon(L, d) {
    const c = T.get('read').ctx;
    for (let i = L.data.objs.length - 1; i >= 0; i--) { const o = L.data.objs[i]; if (o.kind !== 'balloon') continue; c.beginPath(); this.balloonPath(c, o); if (c.isPointInPath(d.x, d.y)) return o; }
    return null;
  },
  textLayers() { return D.layers.filter(L => L.type === 'text' && shownInTree(L)); },
  push(L, before, label) {
    const after = structuredClone(L.data.objs);
    H.push({ label, undo: () => { L.data.objs = structuredClone(before); bumpLayer(L); }, redo: () => { L.data.objs = structuredClone(after); bumpLayer(L); } });
    if (typeof renderLayers === 'function') renderLayers();
  },
  newTextLayer(name) {
    let L;
    structural('텍스트 레이어', [], () => {
      L = newLayer({ type: 'text', name: name || '텍스트' });
      insertLayer(L);
      D.activeId = L.id;
    });
    return L;
  },
  defaults() {
    const s = TOOL_LIST.find(t => t.id === 'text').subs.find(x => x.id === (S.subOf.text || 'text-h')) || {};
    return { font: s.font || 'IBM Plex Sans KR', size: s.fsize || 48, bold: !!s.bold, italic: false, align: s.align || 'left', lh: s.lh || 1.3, ls: 0, vertical: !!s.vertical, stroke: s.strokeW ? { w: s.strokeW, color: '#ffffff' } : null };
  },
  /* ---------- 편집기 ---------- */
  openEditor(L, o, created) {
    this.closeEditorSilently();
    const ta = el('textarea', { class: 'text-editor', spellcheck: 'false', 'aria-label': '텍스트 입력' });
    ta.value = o.text || '';
    $('#stage').append(ta);
    this.editing = { L, id: o.id, created, before: created ? null : structuredClone(L.data.objs), ta };
    Busy.text = true;
    this.selId = o.id;
    const place = () => {
      const ob = L.data.objs.find(x => x.id === o.id); if (!ob) return;
      const b = this.bbox(ob), p = d2s(ob.vertical ? b.x : ob.x, ob.y);
      ta.style.left = p.x + 'px'; ta.style.top = p.y + 'px';
      ta.style.font = this.fontStr({ ...ob, size: ob.size * V.zoom });
      ta.style.lineHeight = (ob.lh || 1.3);
      ta.style.writingMode = ob.vertical ? 'vertical-rl' : 'horizontal-tb';
      ta.style.width = Math.max(40, b.w * V.zoom + ob.size * V.zoom) + 'px';
      ta.style.height = Math.max(ob.size * V.zoom * 1.4, b.h * V.zoom + ob.size * V.zoom * .4) + 'px';
      ta.style.textAlign = ob.align || 'left';
    };
    ta.addEventListener('input', () => { const ob = L.data.objs.find(x => x.id === o.id); if (ob) { ob.text = ta.value; bumpLayer(L); place(); } });
    ta.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); this.commitEditor(); }
    });
    ta.addEventListener('blur', () => setTimeout(() => { if (this.editing && this.editing.ta === ta) this.commitEditor(); }, 0));
    place();
    this.place = place;
    ta.focus();
    setTimeout(() => { if (document.activeElement !== ta) ta.focus(); }, 0);
  },
  closeEditorSilently() { if (this.editing) { this.editing.ta.remove(); this.editing = null; Busy.text = false; } },
  commitEditor() {
    const ed = this.editing; if (!ed) return;
    this.editing = null; Busy.text = false;
    ed.ta.remove();
    const L = ed.L, o = L.data.objs.find(x => x.id === ed.id);
    const empty = !o || !String(o.text).trim();
    if (empty) L.data.objs = L.data.objs.filter(x => x.id !== ed.id);
    if (empty && !L.data.objs.length && ed.layerCreated) {
      D.layers = D.layers.filter(x => x !== L); D.activeId = (D.layers[D.layers.length - 1]).id; markDirty(); renderLayers(); return;
    }
    bumpLayer(L);
    if (!empty && L.name.startsWith('텍스트') && o) L.name = o.text.split('\n')[0].slice(0, 24) || L.name;
    this.push(L, ed.before || L.data.objs.filter(x => x.id !== ed.id), ed.created ? '텍스트' : '텍스트 편집');
    requestRender();
  },
  /* ---------- 이동 · 변환 ---------- */
  offsetAll(L, objs0, dx, dy) { L.data.objs = objs0.map(o => this.moveObj(o, dx, dy)); bumpLayer(L); },
  commitOffset(L, objs0) { this.push(L, objs0, '레이어 이동'); },
  moveObj(o, dx, dy) { const n = { ...o, x: o.x + dx, y: o.y + dy }; if (o.tails) n.tails = o.tails.map(t => ({ ...t, x: t.x + dx, y: t.y + dy })); return n; },
  transformObj(o, map, s) {
    const p = map(o.x, o.y), n = { ...o, x: p.x, y: p.y };
    if (o.kind === 'text') { n.size = o.size * s; if (o.stroke) n.stroke = { ...o.stroke, w: o.stroke.w * s }; }
    else { n.w = o.w * s; n.h = o.h * s; n.lw = o.lw * s; n.tails = (o.tails || []).map(t => ({ ...t, ...map(t.x, t.y), base: t.base ? t.base * s : t.base })); }
    return n;
  },
};
RENDERERS.text = L => Text.render(L);

OVERLAYS.screen.push(ctx => {
  const L = active();
  if (!L || L.type !== 'text' || !Text.selId) return;
  const o = L.data.objs.find(x => x.id === Text.selId); if (!o) return;
  const k = typeof effKind === 'function' ? effKind() : '';
  if (!['object', 'text', 'balloon'].includes(k)) return;
  const b = o.kind === 'balloon' ? { x: o.x, y: o.y, w: o.w, h: o.h } : Text.bbox(o);
  const p0 = d2s(b.x, b.y), p1 = d2s(b.x + b.w, b.y), p2 = d2s(b.x + b.w, b.y + b.h), p3 = d2s(b.x, b.y + b.h);
  ctx.beginPath(); [p0, p1, p2, p3].forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.setLineDash([4, 3]); ctx.strokeStyle = '#40aaff'; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
  if (o.kind === 'balloon') { handleBox(ctx, p2); for (const t of o.tails || []) handleBox(ctx, d2s(t.x, t.y), true); }
  else handleBox(ctx, p2);
});

HANDLERS.text = {
  down(e, s) {
    if (Text.editing) { Text.commitEditor(); return false; }
    const d = s2d(s.x, s.y), A0 = active();
    // 기존 텍스트 위를 클릭하면 편집
    for (const L of [A0, ...Text.textLayers().reverse()]) {
      if (!L || L.type !== 'text' || L.locked) continue;
      const o = Text.hitObj(L, d);
      if (o && o.kind === 'text') { D.activeId = L.id; renderLayers(); Text.openEditor(L, o, false); return false; }
      if (o && o.kind === 'balloon') {
        D.activeId = L.id; renderLayers();
        const t = { id: uid(), kind: 'text', ...Text.defaults(), color: drawHex(), text: '', align: 'center' };
        t.x = o.x + o.w / 2 - t.size * (t.vertical ? -.5 : 1); t.y = o.y + o.h / 2 - t.size * .65;
        if (t.vertical) { t.x = o.x + o.w / 2 + t.size / 2; t.y = o.y + o.h * .2; }
        L.data.objs = L.data.objs.concat([t]); bumpLayer(L);
        Text.openEditor(L, t, true);
        return false;
      }
    }
    const L = Text.newTextLayer('텍스트');
    const t = { id: uid(), kind: 'text', ...Text.defaults(), color: drawHex(), text: '', x: d.x, y: d.y };
    L.data.objs = [t]; bumpLayer(L);
    Text.openEditor(L, t, true);
    Text.editing.layerCreated = true;
    return false;
  },
};
HANDLERS.balloon = {
  down(e, s) {
    const o = curSub(), d = s2d(s.x, s.y);
    if (o.shape === 'tail') {
      for (const L of [active(), ...Text.textLayers().reverse()]) {
        if (!L || L.type !== 'text') continue;
        const b = Text.hitBalloon(L, d);
        if (b) { D.activeId = L.id; renderLayers(); drag.L = L; drag.b = b; drag.before = structuredClone(L.data.objs); drag.tail = { x: d.x, y: d.y, base: Math.min(b.w, b.h) * .16, bend: .25 }; drag.preview = null; return; }
      }
      toast('말풍선 안에서 꼬리를 끌어 주세요.'); return false;
    }
    drag.a = d; drag.b = d;
    drag.preview = (ctx, px) => { const r = Rect.ofPoints([drag.a, drag.b]); ctx.beginPath(); Text.balloonPath(ctx, { ...r, shape: o.shape }); ctx.lineWidth = Math.max(px, (o.lw || 3)); ctx.strokeStyle = 'rgba(227,164,70,.9)'; ctx.stroke(); };
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e)));
    if (drag.tail) {
      drag.tail.x = d.x; drag.tail.y = d.y;
      const L = drag.L;
      L.data.objs = drag.before.map(o => (o.id === drag.b.id ? { ...o, tails: (o.tails || []).concat([drag.tail]) } : o)); bumpLayer(L);
      return;
    }
    drag.b = d; requestRender();
  },
  up() {
    if (drag.tail) { Text.push(drag.L, drag.before, '말풍선 꼬리'); return; }
    const o = curSub(), r = Rect.ofPoints([drag.a, drag.b]);
    if (r.w < 6 || r.h < 6) return;
    let L = active();
    if (L.type !== 'text' || L.locked) L = Text.newTextLayer('말풍선');
    const before = structuredClone(L.data.objs);
    const b = { id: uid(), kind: 'balloon', shape: o.shape, ...r, fill: '#ffffff', line: '#000000', lw: o.lw ?? 3, tails: [] };
    L.data.objs = L.data.objs.concat([b]);
    // 말풍선은 텍스트보다 아래에 그린다
    bumpLayer(L);
    Text.push(L, before, '말풍선');
    Text.selId = b.id;
    if (o.autoText) {
      const t = { id: uid(), kind: 'text', ...Text.defaults(), color: '#000000', text: '', align: 'center' };
      t.x = b.x + b.w / 2 - t.size; t.y = b.y + b.h / 2 - t.size * .65;
      if (t.vertical) { t.x = b.x + b.w / 2 + t.size / 2; t.y = b.y + b.h * .2; }
      L.data.objs = L.data.objs.concat([t]); bumpLayer(L);
      Text.openEditor(L, t, true);
    }
  },
  cancel() { if (drag.tail) { drag.L.data.objs = drag.before; bumpLayer(drag.L); } requestRender(); },
};
// 오브젝트 도구 (텍스트 레이어)
Text.objectHandler = {
  down(e, s) {
    const L = active(), d = s2d(s.x, s.y);
    const sel = L.data.objs.find(x => x.id === Text.selId);
    drag.L = L; drag.before = structuredClone(L.data.objs); drag.start = d;
    if (sel) {
      const b = sel.kind === 'balloon' ? { x: sel.x, y: sel.y, w: sel.w, h: sel.h } : Text.bbox(sel), corner = d2s(b.x + b.w, b.y + b.h);
      if (Math.hypot(corner.x - s.x, corner.y - s.y) < 10) { drag.mode = 'resize'; drag.obj = sel; drag.b0 = b; return; }
      const ti = (sel.tails || []).findIndex(t => { const q = d2s(t.x, t.y); return Math.hypot(q.x - s.x, q.y - s.y) < 10; });
      if (ti >= 0) { drag.mode = 'tail'; drag.obj = sel; drag.ti = ti; return; }
    }
    const o = Text.hitObj(L, d);
    Text.selId = o ? o.id : null;
    PropUI.render(); requestRender();
    if (!o) return false;
    if (e.detail >= 2 && o.kind === 'text') { Text.openEditor(L, o, false); return false; }
    drag.mode = 'move'; drag.obj = o;
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e))), dx = d.x - drag.start.x, dy = d.y - drag.start.y, L = drag.L, id = drag.obj.id;
    L.data.objs = drag.before.map(o => {
      if (o.id !== id) return o;
      if (drag.mode === 'move') return Text.moveObj(o, dx, dy);
      if (drag.mode === 'tail') return { ...o, tails: o.tails.map((t, i) => (i === drag.ti ? { ...t, x: t.x + dx, y: t.y + dy } : t)) };
      if (o.kind === 'balloon') return { ...o, w: Math.max(10, drag.b0.w + dx), h: Math.max(10, drag.b0.h + dy) };
      return { ...o, size: clamp(o.size * (1 + dx / Math.max(20, drag.b0.w)), 4, 2000) };
    });
    bumpLayer(L); drag.moved = true;
  },
  up() { if (drag.moved) Text.push(drag.L, drag.before, drag.mode === 'move' ? '오브젝트 이동' : '오브젝트 변형'); },
  cancel() { drag.L.data.objs = drag.before; bumpLayer(drag.L); },
};
Text.deleteSelected = () => {
  const L = active();
  if (L.type !== 'text' || !Text.selId) return false;
  const before = structuredClone(L.data.objs);
  L.data.objs = L.data.objs.filter(o => o.id !== Text.selId); Text.selId = null; bumpLayer(L);
  Text.push(L, before, '오브젝트 삭제'); PropUI.render();
  return true;
};
Text.updateSelected = (patch, label = '텍스트 속성') => {
  const L = active(); if (L.type !== 'text' || !Text.selId) return;
  const before = structuredClone(L.data.objs);
  L.data.objs = L.data.objs.map(o => (o.id === Text.selId ? { ...o, ...patch } : o)); bumpLayer(L);
  Text.push(L, before, label);
  if (Text.editing && Text.place) Text.place();
};
