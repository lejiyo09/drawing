/* 자: 직선 자, 평행선, 동심원, 방사선, 퍼스 자(1·2·3점), 대칭 자, 가이드. 펜 입력을 자에 스냅한다. */
'use strict';

const Rulers = {
  snap: { ruler: store.get('snapRuler', true), special: store.get('snapSpecial', true), grid: store.get('snapGrid', false) },
  show: true,
  color: 'rgba(168,92,230,.75)',
  add(r, label = '자 작성') { structural(label, [], () => { D.rulers = D.rulers.concat([{ id: uid(), visible: true, ...r }]); }); PropUI.render(); },
  remove(id) { structural('자 삭제', [], () => { D.rulers = D.rulers.filter(r => r.id !== id); }); PropUI.render(); },
  visible() { return this.show ? D.rulers.filter(r => r.visible) : []; },
  transformRuler(r, map, s) {
    const m = p => (p ? map(p.x, p.y) : p);
    const o = { ...r };
    for (const k of ['a', 'b', 'c']) if (o[k]) o[k] = m(o[k]);
    if (o.vps) o.vps = o.vps.map(m);
    if (o.rx) { o.rx *= s; o.ry *= s; }
    if (o.kind === 'guide') { const p = o.axis === 'h' ? map(0, o.pos) : map(o.pos, 0); o.pos = o.axis === 'h' ? p.y : p.x; }
    return o;
  },
  gridSnap(d) {
    if (!this.snap.grid) return d;
    const g = VIEW.gridSize / 4;
    return { x: Math.round(d.x / g) * g, y: Math.round(d.y / g) * g };
  },
  /* ---------- 대칭 ---------- */
  symTransforms() {
    const r = this.visible().find(q => q.kind === 'symmetry');
    if (!r) return null;
    const n = Math.max(1, r.count | 0), rot = r.mirror ? Math.max(1, Math.floor(n / 2)) : n;
    const out = [];
    const reflect = new DOMMatrix().translate(r.c.x, r.c.y).rotate(r.angle).scale(1, -1).rotate(-r.angle).translate(-r.c.x, -r.c.y);
    for (let k = 0; k < rot; k++) {
      const R = new DOMMatrix().translate(r.c.x, r.c.y).rotate(360 * k / rot).translate(-r.c.x, -r.c.y);
      out.push(R);
      if (r.mirror) out.push(R.multiply(reflect));
    }
    return out;
  },
  /* ---------- 스냅 ---------- */
  lineProj(p0, u) { return (x, y) => { const t = (x - p0.x) * u.x + (y - p0.y) * u.y; return { x: p0.x + u.x * t, y: p0.y + u.y * t }; }; },
  unit(dx, dy) { const l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; },
  candidates(s) {
    const lines = [], special = [];
    const near = 24 / V.zoom;
    for (const r of this.visible()) {
      if (this.snap.ruler && (r.kind === 'line' || r.kind === 'guide')) {
        let a, b;
        if (r.kind === 'guide') { a = r.axis === 'h' ? { x: 0, y: r.pos } : { x: r.pos, y: 0 }; b = r.axis === 'h' ? { x: D.w, y: r.pos } : { x: r.pos, y: D.h }; }
        else { a = r.a; b = r.b; }
        const u = this.unit(b.x - a.x, b.y - a.y), proj = this.lineProj(a, u), q = proj(s.x, s.y);
        if (Math.hypot(q.x - s.x, q.y - s.y) < near) lines.push({ fn: proj, dir: u });
      }
      if (!this.snap.special) continue;
      if (r.kind === 'parallel') { const u = this.unit(r.b.x - r.a.x, r.b.y - r.a.y); special.push({ fn: this.lineProj(s, u), dir: u }); }
      else if (r.kind === 'radial') { const u = this.unit(s.x - r.c.x, s.y - r.c.y); special.push({ fn: this.lineProj(s, u), dir: u }); }
      else if (r.kind === 'concentric') {
        const rot = (r.rot || 0) * Math.PI / 180, cr = Math.cos(rot), sr = Math.sin(rot);
        const loc = (x, y) => { const dx = x - r.c.x, dy = y - r.c.y; return { x: dx * cr + dy * sr, y: -dx * sr + dy * cr }; };
        const ls = loc(s.x, s.y), k = Math.hypot(ls.x / r.rx, ls.y / r.ry) || 1, ax = r.rx * k, ay = r.ry * k;
        const fn = (x, y) => { const l = loc(x, y), th = Math.atan2(l.y / ay, l.x / ax), px = ax * Math.cos(th), py = ay * Math.sin(th); return { x: r.c.x + px * cr - py * sr, y: r.c.y + px * sr + py * cr }; };
        const th0 = Math.atan2(ls.y / ay, ls.x / ax), tx = -ax * Math.sin(th0), ty = ay * Math.cos(th0);
        special.push({ fn, dir: this.unit(tx * cr - ty * sr, tx * sr + ty * cr), curve: true });
      } else if (r.kind === 'persp') {
        for (const vp of r.vps) { const u = this.unit(s.x - vp.x, s.y - vp.y); special.push({ fn: this.lineProj(s, u), dir: u }); }
        if (r.vps.length <= 2) special.push({ fn: this.lineProj(s, { x: 0, y: 1 }), dir: { x: 0, y: 1 } });
        if (r.vps.length === 1) special.push({ fn: this.lineProj(s, { x: 1, y: 0 }), dir: { x: 1, y: 0 } });
      }
    }
    return { lines, special };
  },
  makeConstraint(start) {
    const { lines, special } = this.candidates(start);
    if (lines.length) { const fn = lines[0].fn; return (x, y) => fn(x, y); }
    if (!special.length) return null;
    if (special.length === 1) { const fn = special[0].fn; return (x, y) => fn(x, y); }
    let chosen = null;
    return (x, y, stroke) => {
      if (chosen) return chosen(x, y);
      const dx = x - start.x, dy = y - start.y;
      if (Math.hypot(dx, dy) * V.zoom < 8) return null;
      const u = this.unit(dx, dy);
      let best = null, bd = -1;
      for (const c of special) { const d = Math.abs(u.x * c.dir.x + u.y * c.dir.y); if (d > bd) { bd = d; best = c; } }
      chosen = best.fn;
      const pend = stroke.raw.filter(r => r.pending);
      stroke.raw = stroke.raw.filter(r => !r.pending);
      for (const r of pend) stroke.addRaw(r.x, r.y, r.p);
      return chosen(x, y);
    };
  },
  /* ---------- 표시 ---------- */
  draw(ctx, px) {
    const list = Rulers.visible();
    if (!list.length) return;
    const showHandles = typeof effKind === 'function' && effKind() === 'ruler';
    ctx.lineWidth = 1.2 * px;
    for (const r of list) {
      ctx.strokeStyle = r.kind === 'guide' ? 'rgba(40,200,220,.85)' : Rulers.color;
      ctx.beginPath();
      if (r.kind === 'line') { ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); }
      else if (r.kind === 'guide') { if (r.axis === 'h') { ctx.moveTo(-1e5, r.pos); ctx.lineTo(1e5, r.pos); } else { ctx.moveTo(r.pos, -1e5); ctx.lineTo(r.pos, 1e5); } }
      else if (r.kind === 'parallel') {
        const u = Rulers.unit(r.b.x - r.a.x, r.b.y - r.a.y), n = { x: -u.y, y: u.x }, step = Math.max(40, Math.hypot(D.w, D.h) / 18), R = Math.hypot(D.w, D.h);
        for (let k = -20; k <= 20; k++) { const o = { x: r.a.x + n.x * k * step, y: r.a.y + n.y * k * step }; ctx.moveTo(o.x - u.x * R, o.y - u.y * R); ctx.lineTo(o.x + u.x * R, o.y + u.y * R); }
        ctx.stroke(); ctx.beginPath(); ctx.lineWidth = 2.5 * px; ctx.moveTo(r.a.x, r.a.y); ctx.lineTo(r.b.x, r.b.y); ctx.stroke(); ctx.lineWidth = 1.2 * px; ctx.beginPath();
      } else if (r.kind === 'concentric') {
        for (let k = 1; k <= 6; k++) ctx.ellipse(r.c.x, r.c.y, r.rx * k / 3, r.ry * k / 3, (r.rot || 0) * Math.PI / 180, 0, Math.PI * 2);
      } else if (r.kind === 'radial') {
        const R = Math.hypot(D.w, D.h) * 2;
        for (let k = 0; k < 36; k++) { const a = k / 36 * Math.PI * 2; ctx.moveTo(r.c.x, r.c.y); ctx.lineTo(r.c.x + Math.cos(a) * R, r.c.y + Math.sin(a) * R); }
      } else if (r.kind === 'persp') {
        const R = Math.hypot(D.w, D.h) * 3;
        for (const vp of r.vps) {
          const a0 = Math.atan2(D.h / 2 - vp.y, D.w / 2 - vp.x);
          for (let k = -12; k <= 12; k++) { const a = a0 + k * .07; ctx.moveTo(vp.x, vp.y); ctx.lineTo(vp.x + Math.cos(a) * R, vp.y + Math.sin(a) * R); }
        }
        ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = 'rgba(40,200,220,.9)'; ctx.lineWidth = 1.6 * px;
        const h0 = r.vps[0], h1 = r.vps[1] || { x: h0.x + 1, y: h0.y }, u = Rulers.unit(h1.x - h0.x, h1.y - h0.y);
        ctx.moveTo(h0.x - u.x * 1e5, h0.y - u.y * 1e5); ctx.lineTo(h0.x + u.x * 1e5, h0.y + u.y * 1e5);
      } else if (r.kind === 'symmetry') {
        const ms = Rulers.symTransforms() || [], R = Math.hypot(D.w, D.h) * 2;
        const n = Math.max(1, r.count | 0);
        for (let k = 0; k < (r.mirror ? n : n); k++) {
          const a = (r.angle * Math.PI / 180) + k * Math.PI * 2 / n / (r.mirror ? 1 : 1);
          ctx.moveTo(r.c.x, r.c.y); ctx.lineTo(r.c.x + Math.cos(a) * R, r.c.y + Math.sin(a) * R);
          if (n <= 2 && r.mirror) { ctx.moveTo(r.c.x, r.c.y); ctx.lineTo(r.c.x - Math.cos(a) * R, r.c.y - Math.sin(a) * R); }
        }
        void ms;
        ctx.strokeStyle = 'rgba(227,100,160,.9)'; ctx.setLineDash([6 * px, 4 * px]);
      }
      ctx.stroke(); ctx.setLineDash([]);
      if (showHandles) for (const h of Rulers.handles(r)) { ctx.beginPath(); ctx.arc(h.p.x, h.p.y, 5 * px, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#7a3cd0'; ctx.lineWidth = 1.5 * px; ctx.stroke(); }
    }
  },
  handles(r) {
    const hs = [];
    if (r.kind === 'line' || r.kind === 'parallel') hs.push({ k: 'a', p: r.a }, { k: 'b', p: r.b });
    if (r.kind === 'radial') hs.push({ k: 'c', p: r.c });
    if (r.kind === 'concentric') { const a = (r.rot || 0) * Math.PI / 180; hs.push({ k: 'c', p: r.c }, { k: 'rx', p: { x: r.c.x + Math.cos(a) * r.rx, y: r.c.y + Math.sin(a) * r.rx } }, { k: 'ry', p: { x: r.c.x - Math.sin(a) * r.ry, y: r.c.y + Math.cos(a) * r.ry } }); }
    if (r.kind === 'persp') r.vps.forEach((p, i) => hs.push({ k: 'vp' + i, p }));
    if (r.kind === 'symmetry') { const a = r.angle * Math.PI / 180; hs.push({ k: 'c', p: r.c }, { k: 'ang', p: { x: r.c.x + Math.cos(a) * 120, y: r.c.y + Math.sin(a) * 120 } }); }
    if (r.kind === 'guide') hs.push({ k: 'pos', p: r.axis === 'h' ? { x: V.cx, y: r.pos } : { x: r.pos, y: V.cy } });
    return hs;
  },
  hitHandle(d) {
    const tol = 10 / V.zoom;
    for (const r of [...this.visible()].reverse()) for (const h of this.handles(r)) if (Math.hypot(h.p.x - d.x, h.p.y - d.y) < tol) return { r, h };
    return null;
  },
  setHandle(r, k, d, e) {
    if (k === 'a' || k === 'b' || k === 'c') {
      if (k === 'c' && r.kind !== 'line' && r.kind !== 'parallel') { r.c = d; return; }
      if ((r.kind === 'line' || r.kind === 'parallel') && e && e.shiftKey) { const o = k === 'a' ? r.b : r.a, ang = Math.round(Math.atan2(d.y - o.y, d.x - o.x) / (Math.PI / 12)) * Math.PI / 12, l = Math.hypot(d.x - o.x, d.y - o.y); d = { x: o.x + Math.cos(ang) * l, y: o.y + Math.sin(ang) * l }; }
      r[k] = d; return;
    }
    if (k === 'rx' || k === 'ry') { const dx = d.x - r.c.x, dy = d.y - r.c.y; if (k === 'rx') { r.rx = Math.max(2, Math.hypot(dx, dy)); r.rot = Math.atan2(dy, dx) * 180 / Math.PI; } else r.ry = Math.max(2, Math.hypot(dx, dy)); return; }
    if (k.startsWith('vp')) { r.vps[+k.slice(2)] = d; if (r.vps.length >= 2 && e && e.shiftKey) { const o = r.vps[+k.slice(2) ? 0 : 1]; r.vps[+k.slice(2)] = { x: d.x, y: o.y }; } return; }
    if (k === 'ang') { let a = Math.atan2(d.y - r.c.y, d.x - r.c.x) * 180 / Math.PI; if (e && e.shiftKey) a = Math.round(a / 15) * 15; r.angle = a; return; }
    if (k === 'pos') r.pos = r.axis === 'h' ? d.y : d.x;
  },
  defaultPersp(n) {
    const hy = D.h * .42;
    if (n === 1) return [{ x: D.w / 2, y: hy }];
    if (n === 2) return [{ x: -D.w * .25, y: hy }, { x: D.w * 1.25, y: hy }];
    return [{ x: -D.w * .25, y: hy }, { x: D.w * 1.25, y: hy }, { x: D.w / 2, y: D.h * 2.4 }];
  },
};
OVERLAYS.doc.push((ctx, px) => Rulers.draw(ctx, px));

HANDLERS.ruler = {
  down(e, s) {
    const d = s2d(s.x, s.y), o = curSub();
    const hit = Rulers.hitHandle(d);
    if (hit) {
      if (e.altKey) { Rulers.remove(hit.r.id); return false; }
      drag.before = structuredClone(D.rulers); drag.hit = hit; return;
    }
    if (o.rk === 'radial') { Rulers.add({ kind: 'radial', c: d }, '방사선 자'); return false; }
    if (o.rk === 'symmetry') { Rulers.add({ kind: 'symmetry', c: d, angle: 90, count: o.count || 2, mirror: o.mirror !== false }, '대칭 자'); return false; }
    if (o.rk === 'guide') { Rulers.add({ kind: 'guide', axis: o.axis || 'h', pos: o.axis === 'v' ? d.x : d.y }, '가이드'); return false; }
    if (o.rk === 'persp') { Rulers.add({ kind: 'persp', vps: Rulers.defaultPersp(o.points || 2) }, '퍼스 자'); toast('보라색 점(소실점)을 드래그해 퍼스를 맞추세요. Shift를 누르면 아이레벨을 수평으로 유지합니다.'); return false; }
    drag.a = d; drag.b = d;
    drag.preview = (ctx, px) => {
      ctx.strokeStyle = Rulers.color; ctx.lineWidth = 1.5 * px; ctx.beginPath();
      if (o.rk === 'concentric') ctx.ellipse(drag.a.x, drag.a.y, Math.max(1, Math.abs(drag.b.x - drag.a.x)), Math.max(1, Math.abs(drag.b.y - drag.a.y)), 0, 0, Math.PI * 2);
      else { ctx.moveTo(drag.a.x, drag.a.y); ctx.lineTo(drag.b.x, drag.b.y); }
      ctx.stroke();
    };
  },
  move(e) {
    const d = s2d(...Object.values(localPos(e)));
    if (drag.hit) {
      const r = D.rulers.find(x => x.id === drag.hit.r.id);
      if (r) Rulers.setHandle(r, drag.hit.h.k, d, e);
      requestRender(); return;
    }
    drag.b = d;
    if (e.shiftKey && curSub().rk !== 'concentric') { const a = drag.a, ang = Math.round(Math.atan2(d.y - a.y, d.x - a.x) / (Math.PI / 12)) * Math.PI / 12, l = Math.hypot(d.x - a.x, d.y - a.y); drag.b = { x: a.x + Math.cos(ang) * l, y: a.y + Math.sin(ang) * l }; }
    requestRender();
  },
  up() {
    if (drag.hit) {
      const b = drag.before, a = structuredClone(D.rulers);
      H.push({ label: '자 편집', undo: () => { D.rulers = structuredClone(b); requestRender(); }, redo: () => { D.rulers = structuredClone(a); requestRender(); } });
      return;
    }
    const o = curSub(), a = drag.a, b = drag.b;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 3) return;
    if (o.rk === 'concentric') Rulers.add({ kind: 'concentric', c: a, rx: Math.max(2, Math.abs(b.x - a.x)), ry: Math.max(2, Math.abs(b.y - a.y)), rot: 0 }, '동심원 자');
    else Rulers.add({ kind: o.rk === 'parallel' ? 'parallel' : 'line', a, b }, o.rk === 'parallel' ? '평행선 자' : '직선 자');
  },
  cancel() { if (drag.before) D.rulers = drag.before; requestRender(); },
};
