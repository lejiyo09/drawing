/* 애니메이션: 애니메이션 폴더와 셀, 타임라인(셀 지정), 어니언 스킨, 레이어 키프레임(위치·배율·회전·불투명도),
 * 2D 카메라, 오디오, 재생과 내보내기(GIF · WebM · PNG 연번) */
'use strict';

const KEY_PROPS = [['x', 'X', 0], ['y', 'Y', 0], ['scale', '배율', 1], ['rot', '회전', 0], ['opacity', '불투명도', 1]];
const CAM_PROPS = [['x', 'X', null], ['y', 'Y', null], ['scale', '배율', 1], ['rot', '회전', 0]];
const Anim = {
  open: store.get('tlOpen', false),
  playing: false,
  selRow: null, // { type: 'track'|'keys'|'camera', id }
  audioEl: null, audioURL: null,
  fw: 18, rh: 24,
  /* ---------- 데이터 ---------- */
  tracks(F) { return (D.anim.tracks[F.id] || []); },
  celAt(F, f) {
    const t = this.tracks(F);
    let cel = null;
    for (const s of t) { if (s.f <= f) cel = s.cel; else break; }
    return cel;
  },
  setSpec(F, f, cel, label = '셀 지정') {
    structural(label, [], () => {
      const t = this.tracks(F).filter(s => s.f !== f);
      if (cel !== undefined) t.push({ f, cel });
      D.anim.tracks = { ...D.anim.tracks, [F.id]: t.sort((a, b) => a.f - b.f) };
    });
    this.renderTimeline();
  },
  animFolders() { return D.layers.filter(L => L.type === 'folder' && L.data.anim); },
  animFolderOf(L) { if (!L) return null; if (L.type === 'folder' && L.data.anim) return L; const p = findLayer(L.parent); return p && p.type === 'folder' && p.data.anim ? p : null; },
  showOnion() { return this.open && !this.playing && D.anim && D.anim.onion.on; },
  onionCels(F, f) {
    if (!D.anim.onion.on) return null;
    const out = new Map(), cur = this.celAt(F, f);
    const walk = (dir, n, color) => {
      let last = cur, k = 0;
      for (let g = f + dir; g >= 0 && g < D.anim.length && k < n; g += dir) {
        const c = this.celAt(F, g);
        if (c != null && c !== last && c !== cur && !out.has(c)) { out.set(c, { color, alpha: .38 * (1 - k / (n + 1)) }); k++; }
        last = c;
      }
    };
    walk(-1, D.anim.onion.before, '#3a6fd8');
    walk(1, D.anim.onion.after, '#2fa35a');
    return out;
  },
  keyValue(L, prop, f, def) {
    const ks = L.keys && L.keys[prop];
    if (!ks || !ks.length) return def;
    if (f <= ks[0].f) return ks[0].v;
    if (f >= ks[ks.length - 1].f) return ks[ks.length - 1].v;
    let i = 0; while (i < ks.length - 1 && ks[i + 1].f <= f) i++;
    const a = ks[i], b = ks[i + 1];
    let t = (f - a.f) / (b.f - a.f);
    if (a.ease === 'smooth') t = t * t * (3 - 2 * t);
    else if (a.ease === 'hold') t = 0;
    return lerp(a.v, b.v, t);
  },
  hasKeys(L) { return L.keys && Object.values(L.keys).some(k => k && k.length); },
  layerXform(L, f) {
    if (!L.keys || !this.hasKeys(L)) return null;
    const x = this.keyValue(L, 'x', f, 0), y = this.keyValue(L, 'y', f, 0), s = this.keyValue(L, 'scale', f, 1), r = this.keyValue(L, 'rot', f, 0);
    if (!x && !y && s === 1 && !r) return null;
    const cx = D.w / 2, cy = D.h / 2;
    return new DOMMatrix().translate(cx + x, cy + y).rotate(r).scale(s).translate(-cx, -cy);
  },
  setKey(target, prop, f, v) {
    const keys = { ...(target.keys || {}) };
    const arr = (keys[prop] || []).filter(k => k.f !== f);
    arr.push({ f, v, ease: 'linear' });
    keys[prop] = arr.sort((a, b) => a.f - b.f);
    target.keys = keys;
  },
  camTarget() { return D.anim.camera; },
  camValue(prop, f) {
    const c = D.anim.camera, def = { x: D.w / 2, y: D.h / 2, scale: 1, rot: 0 }[prop];
    return this.keyValue(c, prop, f, def);
  },
  cameraMatrix(f) {
    const x = this.camValue('x', f), y = this.camValue('y', f), s = this.camValue('scale', f), r = this.camValue('rot', f);
    return new DOMMatrix().translate(D.w / 2, D.h / 2).scale(s).rotate(-r).translate(-x, -y);
  },
  /* ---------- 렌더 ---------- */
  renderFrame(f, out, scale = 1) {
    const t = T.get('animframe');
    compositeInto(t.ctx, Rect.full(), { raw: true, export: true, excludeDraft: true, frame: f });
    const x = out.getContext('2d');
    x.save(); x.clearRect(0, 0, out.width, out.height);
    x.scale(scale, scale);
    if (D.anim.camera.on) x.setTransform(new DOMMatrix().scale(scale).multiply(this.cameraMatrix(f)));
    x.imageSmoothingQuality = 'high';
    x.drawImage(t.canvas, 0, 0);
    x.restore();
    return out;
  },
  setFrame(f) {
    D.anim.frame = clamp(f | 0, 0, Math.max(0, D.anim.length - 1));
    markDirty(); this.renderTimeline(); this.syncFields();
  },
  /* ---------- 재생 ---------- */
  play() {
    if (this.playing) { this.stop(); return; }
    if (!D.anim.length) return;
    this.playing = true;
    const fps = D.anim.fps, startF = D.anim.frame, t0 = performance.now();
    if (D.audio && D.audio.blob) {
      if (!this.audioEl) this.audioEl = new Audio();
      if (this.audioURL !== D.audio.url) { this.audioURL = D.audio.url = D.audio.url || URL.createObjectURL(D.audio.blob); this.audioEl.src = this.audioURL; }
      this.audioEl.currentTime = startF / fps + (D.audio.offset || 0);
      this.audioEl.play().catch(() => {});
    }
    const tick = now => {
      if (!this.playing) return;
      const f = (startF + Math.floor((now - t0) / 1000 * fps)) % D.anim.length;
      if (f !== D.anim.frame) {
        if (f < D.anim.frame && this.audioEl && D.audio) { this.audioEl.currentTime = (D.audio.offset || 0); }
        D.anim.frame = f; markDirty(); this.drawGrid();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    this.renderTimeline();
  },
  stop() { this.playing = false; if (this.audioEl) this.audioEl.pause(); markDirty(); this.renderTimeline(); },
  /* ---------- 명령 ---------- */
  newAnimFolder() {
    structural('애니메이션 폴더', [], () => {
      const n = this.animFolders().length + 1;
      const F = newLayer({ type: 'folder', name: '애니메이션 ' + n, data: { open: true, anim: true, frame: null } });
      const cel = newLayer({ name: '1', parent: F.id });
      const a = active(), at = a ? layerIndex(a) + 1 : D.layers.length;
      D.layers.splice(at, 0, F, cel);
      D.anim.tracks = { ...D.anim.tracks, [F.id]: [{ f: 0, cel: cel.id }] };
      D.activeId = cel.id;
    });
    this.show(true);
  },
  newCel() {
    const F = this.animFolderOf(active()) || (this.selRow && this.selRow.type === 'track' && findLayer(this.selRow.id)) || this.animFolders()[0];
    if (!F) { toast('먼저 애니메이션 폴더를 만들어 주세요.', true); return; }
    structural('신규 애니메이션 셀', [], () => {
      const used = kids(F.id).map(L => parseInt(L.name, 10)).filter(n => !isNaN(n));
      const cel = newLayer({ name: String((used.length ? Math.max(...used) : 0) + 1), parent: F.id });
      const ch = kids(F.id), last = ch[ch.length - 1];
      D.layers.splice(last ? layerIndex(last) + 1 : layerIndex(F) + 1, 0, cel);
      const t = this.tracks(F).filter(s => s.f !== D.anim.frame);
      t.push({ f: D.anim.frame, cel: cel.id });
      D.anim.tracks = { ...D.anim.tracks, [F.id]: t.sort((a, b) => a.f - b.f) };
      D.activeId = cel.id;
    });
    this.renderTimeline();
  },
  assignActive() {
    const L = active(), F = this.animFolderOf(L);
    if (!F || L === F) { toast('애니메이션 폴더 안의 셀(레이어)을 선택해 주세요.', true); return; }
    this.setSpec(F, D.anim.frame, L.id);
  },
  clearSpec() {
    const F = this.animFolderOf(active()) || (this.selRow && this.selRow.type === 'track' && findLayer(this.selRow.id));
    if (!F) return;
    const has = this.tracks(F).some(s => s.f === D.anim.frame);
    this.setSpec(F, D.anim.frame, has ? undefined : null, has ? '셀 지정 삭제' : '빈 셀 지정');
  },
  toggleKey() {
    const camSel = this.selRow && this.selRow.type === 'camera';
    const target = camSel ? D.anim.camera : active();
    if (!target) return;
    const f = D.anim.frame, props = camSel ? CAM_PROPS : KEY_PROPS;
    const has = target.keys && props.some(([p]) => (target.keys[p] || []).some(k => k.f === f));
    structural(has ? '키프레임 삭제' : '키프레임 추가', [], () => {
      for (const [p, , def] of props) {
        if (has) { if (target.keys && target.keys[p]) target.keys = { ...target.keys, [p]: target.keys[p].filter(k => k.f !== f) }; }
        else {
          const cur = camSel ? this.camValue(p, f) : this.keyValue(target, p, f, def);
          this.setKey(target, p, f, cur);
        }
      }
    });
    this.renderTimeline(); this.syncFields();
  },
  editField(prop, v) {
    const camSel = this.selRow && this.selRow.type === 'camera';
    const target = camSel ? D.anim.camera : active();
    if (!target) return;
    structural('키프레임 값', [], () => { this.setKey(target, prop, D.anim.frame, v); if (!camSel) target.rev = revSeq++; });
    markDirty(); this.renderTimeline();
  },
  async loadAudio(file) {
    structural('오디오 불러오기', [], () => { D.audio = { blob: file, name: file.name, offset: 0, url: URL.createObjectURL(file) }; });
    this.renderTimeline();
    toast(`오디오 "${file.name}"를 타임라인에 넣었습니다.`);
  },
  /* ---------- UI ---------- */
  show(on) {
    this.open = on ?? !this.open;
    store.set('tlOpen', this.open);
    $('#timeline').hidden = !this.open;
    markDirty(); this.renderTimeline();
    setTimeout(resizeView, 0);
  },
  rows() {
    const rows = [];
    for (const F of this.animFolders()) rows.push({ type: 'track', id: F.id, label: F.name });
    for (const L of D.layers) if (this.hasKeys(L)) rows.push({ type: 'keys', id: L.id, label: L.name + ' ◆' });
    const a = active();
    if (a && !this.hasKeys(a) && a.type !== 'paper') rows.push({ type: 'keys', id: a.id, label: a.name + ' (키프레임)', ghost: true });
    if (D.anim.camera.on) rows.push({ type: 'camera', id: 'cam', label: '카메라' });
    if (D.audio) rows.push({ type: 'audio', id: 'audio', label: '♪ ' + (D.audio.name || '오디오') });
    return rows;
  },
  renderTimeline() {
    if (!this.open || !D.anim) return;
    const a = D.anim;
    $('#tl-frame').value = a.frame + 1;
    $('#tl-fps').value = a.fps;
    $('#tl-len').value = a.length;
    $('#tl-onion').classList.toggle('on', a.onion.on);
    $('#tl-cam').classList.toggle('on', a.camera.on);
    $('#tl-play').textContent = this.playing ? '■' : '▶';
    const lab = $('#tl-labels'); lab.innerHTML = '';
    for (const r of this.rows()) {
      const b = el('button', { class: 'tl-label' + (this.selRow && this.selRow.id === r.id ? ' sel' : '') + (r.ghost ? ' ghost' : ''), text: r.label, title: r.label });
      b.addEventListener('click', () => { this.selRow = r; if (r.type === 'track' || r.type === 'keys') { const L = findLayer(r.id); if (L && r.type === 'keys') { D.activeId = L.id; renderLayers(); } } this.renderTimeline(); this.syncFields(); });
      lab.append(b);
    }
    this.drawGrid();
    this.syncFields();
  },
  drawGrid() {
    if (!this.open) return;
    const c = $('#tl-grid'), rows = this.rows(), a = D.anim, fw = this.fw, rh = this.rh;
    const W = Math.max(a.length * fw + 2, 10), Hh = Math.max(rows.length, 1) * rh + 20;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(Hh * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); c.style.width = W + 'px'; c.style.height = Hh + 'px'; }
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#1f2023'; x.fillRect(0, 0, W, Hh);
    x.font = '10px "IBM Plex Mono", monospace'; x.textBaseline = 'middle';
    for (let f = 0; f < a.length; f++) {
      x.fillStyle = f % a.fps === 0 ? '#3a3d44' : '#2a2c31'; x.fillRect(f * fw, 0, fw - 1, 19);
      if (f % 5 === 0 || f === a.length - 1) { x.fillStyle = '#9c988f'; x.fillText(String(f + 1), f * fw + 2, 10); }
    }
    rows.forEach((r, ri) => {
      const y = 20 + ri * rh;
      x.fillStyle = ri % 2 ? '#26282c' : '#2a2c30'; x.fillRect(0, y, W, rh - 1);
      if (r.type === 'track') {
        const F = findLayer(r.id), spec = this.tracks(F);
        let cur = null, start = 0;
        const flush = end => {
          if (cur == null) return;
          const L = findLayer(cur); const nm = L ? L.name : '?';
          x.fillStyle = '#4a3d26'; x.fillRect(start * fw + 1, y + 3, (end - start) * fw - 2, rh - 7);
          x.fillStyle = '#e3a446'; x.fillRect(start * fw + 1, y + 3, 2, rh - 7);
          x.fillStyle = '#e7e4dd'; x.fillText(nm, start * fw + 5, y + rh / 2);
        };
        for (let f = 0; f <= a.length; f++) {
          const s = spec.find(q => q.f === f);
          if (f === a.length || s) { flush(f); if (s) { cur = s.cel; start = f; if (s.cel == null) { x.fillStyle = '#9c988f'; x.fillText('×', f * fw + 5, y + rh / 2); } } }
        }
      } else if (r.type === 'keys' || r.type === 'camera') {
        const target = r.type === 'camera' ? a.camera : findLayer(r.id);
        const fs = new Set(); if (target && target.keys) for (const k of Object.values(target.keys)) for (const q of k || []) fs.add(q.f);
        for (const f of fs) { const cx = f * fw + fw / 2, cy = y + rh / 2; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 6, cy); x.lineTo(cx, cy + 6); x.lineTo(cx - 6, cy); x.closePath(); x.fillStyle = '#e3a446'; x.fill(); }
      } else if (r.type === 'audio') { x.fillStyle = '#2f4a6e'; x.fillRect(0, y + 5, W, rh - 11); }
    });
    x.fillStyle = 'rgba(227,164,70,.25)'; x.fillRect(a.frame * fw, 0, fw, Hh);
    x.fillStyle = '#e3a446'; x.fillRect(a.frame * fw + fw / 2 - 1, 0, 2, Hh);
    const wrap = $('#tl-scroll'), px = a.frame * fw;
    if (px < wrap.scrollLeft || px > wrap.scrollLeft + wrap.clientWidth - fw) wrap.scrollLeft = px - wrap.clientWidth / 2;
    $('#tl-frame').value = a.frame + 1;
  },
  syncFields() {
    if (!this.open) return;
    const box = $('#tl-fields'); box.innerHTML = '';
    const camSel = this.selRow && this.selRow.type === 'camera';
    const target = camSel ? D.anim.camera : active();
    if (!target || (!camSel && target.type === 'paper')) return;
    const props = camSel ? CAM_PROPS : KEY_PROPS, f = D.anim.frame;
    box.append(el('span', { class: 'hint', text: camSel ? '카메라' : target.name }));
    for (const [p, label, def] of props) {
      const v = camSel ? this.camValue(p, f) : this.keyValue(target, p, f, def);
      const disp = p === 'opacity' ? Math.round(v * 100) : p === 'scale' ? Math.round(v * 100) : Math.round(v * 10) / 10;
      const inp = el('input', { class: 'num', value: disp, 'aria-label': label, title: label + (p === 'opacity' || p === 'scale' ? ' (%)' : '') });
      inp.addEventListener('change', () => { let n = parseFloat(inp.value); if (isNaN(n)) return; if (p === 'opacity' || p === 'scale') n /= 100; this.editField(p, n); });
      box.append(el('label', { class: 'tl-field' }, el('span', { text: label }), inp));
    }
  },
  init() {
    const tl = $('#timeline');
    tl.hidden = !this.open;
    $('#tl-play').addEventListener('click', () => this.play());
    $('#tl-first').addEventListener('click', () => this.setFrame(0));
    $('#tl-prev').addEventListener('click', () => this.setFrame(D.anim.frame - 1));
    $('#tl-next').addEventListener('click', () => this.setFrame(D.anim.frame + 1));
    $('#tl-last').addEventListener('click', () => this.setFrame(D.anim.length - 1));
    $('#tl-frame').addEventListener('change', e => this.setFrame((+e.target.value || 1) - 1));
    $('#tl-fps').addEventListener('change', e => { const v = clamp(+e.target.value || 12, 1, 60); structural('프레임 레이트', [], () => { D.anim.fps = v; }); this.renderTimeline(); });
    $('#tl-len').addEventListener('change', e => { const v = clamp(+e.target.value || 24, 1, 3000); structural('재생 길이', [], () => { D.anim.length = v; }); this.setFrame(D.anim.frame); });
    $('#tl-onion').addEventListener('click', () => { D.anim.onion.on = !D.anim.onion.on; markDirty(); this.renderTimeline(); });
    $('#tl-cam').addEventListener('click', () => { structural('카메라', [], () => { D.anim.camera = { ...D.anim.camera, on: !D.anim.camera.on }; }); markDirty(); this.renderTimeline(); });
    $('#tl-newcel').addEventListener('click', () => this.newCel());
    $('#tl-assign').addEventListener('click', () => this.assignActive());
    $('#tl-clear').addEventListener('click', () => this.clearSpec());
    $('#tl-key').addEventListener('click', () => this.toggleKey());
    $('#tl-audio').addEventListener('click', () => $('#file-audio').click());
    $('#file-audio').addEventListener('change', e => { const f = e.target.files[0]; if (f) this.loadAudio(f); e.target.value = ''; });
    $('#tl-export').addEventListener('click', () => Dialogs.animExport());
    $('#tl-close').addEventListener('click', () => this.show(false));
    const grid = $('#tl-grid');
    let down = false;
    const pick = e => {
      const r = grid.getBoundingClientRect(), f = Math.floor((e.clientX - r.left) / this.fw), ri = Math.floor((e.clientY - r.top - 20) / this.rh);
      const rows = this.rows();
      if (ri >= 0 && ri < rows.length) this.selRow = rows[ri];
      this.setFrame(f);
      return rows[ri];
    };
    grid.addEventListener('pointerdown', e => { down = true; grid.setPointerCapture(e.pointerId); pick(e); });
    grid.addEventListener('pointermove', e => { if (down) pick(e); });
    grid.addEventListener('pointerup', () => { down = false; this.renderTimeline(); });
    grid.addEventListener('dblclick', e => {
      const r = pick(e);
      if (r && r.type === 'track') { const L = active(), F = findLayer(r.id); if (L && L.parent === F.id) this.setSpec(F, D.anim.frame, L.id); else toast('지정할 셀(레이어)을 먼저 선택해 주세요.'); }
      else if (r && (r.type === 'keys' || r.type === 'camera')) this.toggleKey();
    });
  },
  drawCameraFrame(ctx, px) {
    if (!Anim.open || !D.anim || !D.anim.camera.on) return;
    const M = Anim.cameraMatrix(D.anim.frame).inverse();
    const pts = [[0, 0], [D.w, 0], [D.w, D.h], [0, D.h]].map(([x, y]) => M.transformPoint(new DOMPoint(x, y)));
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
    ctx.lineWidth = 2 * px; ctx.strokeStyle = 'rgba(255,90,90,.9)'; ctx.setLineDash([10 * px, 6 * px]); ctx.stroke(); ctx.setLineDash([]);
  },
};
OVERLAYS.doc.push((ctx, px) => Anim.drawCameraFrame(ctx, px));
