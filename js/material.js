/* 소재: 이미지·패턴, 스크린톤, 브러시 끝 모양, 보조 도구 프리셋, 3D 소재, 사용자 소재(IndexedDB 저장) */
'use strict';

const Materials = {
  user: [], // { id, name, kind: 'image'|'tip'|'brush', blob?, preset? , toolId? }
  tab: 'image',
  patterns() {
    const mk = (name, s, draw) => { const c = mkCanvas(s, s), x = c.getContext('2d'); draw(x, s); return { id: 'pat-' + name, name, canvas: c, tile: true }; };
    return [
      mk('물방울 무늬', 64, (x, s) => { x.fillStyle = '#f7d9e3'; x.fillRect(0, 0, s, s); x.fillStyle = '#e8577a'; for (const [cx, cy] of [[16, 16], [48, 48]]) { x.beginPath(); x.arc(cx, cy, 9, 0, Math.PI * 2); x.fill(); } }),
      mk('체크무늬', 64, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); x.fillStyle = '#2e3a59'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); }),
      mk('깅엄 체크', 48, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(74,134,200,.45)'; x.fillRect(0, 0, 24, s); x.fillRect(0, 0, s, 24); }),
      mk('줄무늬', 32, (x, s) => { x.fillStyle = '#fff4c9'; x.fillRect(0, 0, s, s); x.fillStyle = '#ef7d4c'; x.fillRect(0, 0, s, 12); }),
      mk('사선', 32, (x, s) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, s, s); x.strokeStyle = '#3b4fa0'; x.lineWidth = 6; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(k * s, s); x.lineTo(k * s + s, 0); x.stroke(); } }),
      mk('벽돌', 96, (x, s) => { x.fillStyle = '#b5553d'; x.fillRect(0, 0, s, s); x.strokeStyle = '#e9d8c4'; x.lineWidth = 4; for (let r = 0; r < 4; r++) { const y = r * 24; x.beginPath(); x.moveTo(0, y); x.lineTo(s, y); x.stroke(); for (let c = 0; c < 2; c++) { const xx = c * 48 + (r % 2 ? 24 : 0); x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 24); x.stroke(); } } }),
      mk('타일', 64, (x, s) => { x.fillStyle = '#cbe6c5'; x.fillRect(0, 0, s, s); x.strokeStyle = '#7da98a'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, s - 3, s - 3); }),
      mk('별 무늬', 80, (x, s) => { x.fillStyle = '#2e3a59'; x.fillRect(0, 0, s, s); x.drawImage(TIPS.get('star').orig, 8, 8, 28, 28); x.drawImage(TIPS.get('star').orig, 48, 46, 22, 22); }),
      mk('하트 무늬', 64, (x, s) => { x.fillStyle = '#fff0f4'; x.fillRect(0, 0, s, s); x.drawImage(TIPS.get('heart').orig, 6, 6, 22, 22); x.drawImage(TIPS.get('heart').orig, 38, 38, 22, 22); }),
      mk('꽃무늬', 96, (x, s) => { x.fillStyle = '#fdf6e9'; x.fillRect(0, 0, s, s); x.drawImage(TIPS.get('flower').orig, 6, 6, 40, 40); x.drawImage(TIPS.get('flower').orig, 54, 50, 34, 34); x.drawImage(TIPS.get('leaf').orig, 52, 8, 26, 26); }),
      mk('나뭇결', 128, (x, s) => { x.fillStyle = '#c99a63'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(110,70,35,.45)'; for (let i = 0; i < 18; i++) { x.lineWidth = 1 + (i % 3); x.beginPath(); for (let px = 0; px <= s; px += 8) x.lineTo(px, i * 7 + Math.sin(px / 18 + i) * 3); x.stroke(); } }),
      mk('콘크리트', 128, (x, s) => { x.fillStyle = '#a8a4a5'; x.fillRect(0, 0, s, s); for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '40,40,40'},${Math.random() * .25})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } }),
    ];
  },
  tones() {
    const out = [];
    for (const lpi of [50, 60, 80]) for (const dens of [10, 20, 30, 50]) out.push({ id: `tone-${lpi}-${dens}`, name: `${lpi}선 ${dens}%`, tone: { lpi, density: dens, angle: 45, shape: 'dot' } });
    out.push({ id: 'tone-line', name: '라인 톤 60선 30%', tone: { lpi: 60, density: 30, angle: 45, shape: 'line' } });
    out.push({ id: 'tone-noise', name: '노이즈 톤 20%', tone: { lpi: 60, density: 20, angle: 0, shape: 'noise' } });
    return out;
  },
  threeItems() {
    return [['figure', '데생 인형'], ['cube', '정육면체'], ['sphere', '구'], ['cylinder', '원기둥'], ['cone', '원뿔'], ['torus', '토러스'], ['plane', '바닥']].map(([k, n]) => ({ id: '3d-' + k, name: n, kind3d: k }));
  },
  async init() {
    try {
      const list = (await Autosave.get('materials')) || [];
      this.user = list;
      for (const m of list) if (m.kind === 'tip' && m.blob) {
        const bmp = await createImageBitmap(m.blob), c = mkCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0);
        TIPS.add(m.id, m.name, c, m.lum);
      } else if (m.kind === 'brush' && m.preset) this.installBrush(m, true);
    } catch (e) { console.warn('소재를 불러오지 못했습니다', e); }
  },
  async persist() { try { await Autosave.put('materials', this.user); } catch (e) { toast('소재를 저장하지 못했습니다: ' + e.message, true); } },
  installBrush(m, quiet) {
    const t = TOOL_LIST.find(x => x.id === m.toolId) || TOOL_LIST.find(x => x.id === 'deco');
    if (!t.subs.some(s => s.id === m.preset.id)) t.subs.push({ ...m.preset });
    if (!quiet) { setTool(t.id, m.preset.id); toast(`"${m.name}"을(를) ${t.name} 보조 도구로 추가했습니다.`); }
  },
  installTip(id, name) {
    const deco = TOOL_LIST.find(x => x.id === 'deco');
    const sid = 'deco-' + id;
    if (!deco.subs.some(s => s.id === sid)) deco.subs.push({ id: sid, name, ...BR({ size: 40, tip: 'image', tipId: id, tipColor: 'tint', spacing: 1.1, pSize: true, minSize: .4, stab: 0, sizeJ: .3, angleJ: 30, scatter: .2, angleMode: 'fixed', angle: 0 }) });
    setTool('deco', sid);
    toast(`"${name}" 브러시를 데코레이션에 추가했습니다.`);
  },
  /* ---------- 적용 ---------- */
  applyImage(canvas, name, tile) {
    if (!tile) { pasteCanvas(canvas, null, null, name); return; }
    structural('소재 붙이기', [], () => {
      const L = newLayer({ name });
      L.ctx.fillStyle = L.ctx.createPattern(canvas, 'repeat'); L.ctx.fillRect(0, 0, D.w, D.h);
      if (Sel.has) { L.mask = cloneCanvas(Sel.canvas); }
      insertLayer(L);
      D.activeId = L.id;
    });
    toast(Sel.has ? '선택 범위에 패턴을 붙였습니다 (레이어 마스크).' : '패턴을 새 레이어에 붙였습니다.');
  },
  apply3D(kind) {
    const L = active();
    const go = () => {
      if (L && L.type === '3d') { Three3D.update(d => { const o = Three3D.makeObj(kind); d.objects.push(o); Three3D.selId = o.id; }, '3D 소재 추가'); setTool('object'); }
      else Three3D.ensure().then(() => {
        let NL;
        structural('3D 레이어', [], () => {
          NL = newLayer({ type: '3d', name: '3D', data: { objects: [Three3D.makeObj('plane'), Three3D.makeObj(kind)], camera: Three3D.defaultCamera(), mode: 'line', lightAz: 40, lightEl: 50, outline: 2.2 } });
          insertLayer(NL); D.activeId = NL.id;
        });
        bumpLayer(NL); setTool('object');
      });
    };
    Three3D.ensure().then(go).catch(() => toast('3D 엔진을 불러오지 못했습니다.', true));
  },
  /* ---------- 등록 ---------- */
  cropActive() {
    const L = active();
    if (!L.canvas) { toast('이 레이어는 소재로 등록할 수 없습니다.', true); return null; }
    const bb = Sel.has ? Sel.bbox : contentBBox(L.canvas);
    if (!bb) { toast('레이어가 비어 있습니다.', true); return null; }
    const c = cloneCanvas(L.canvas, bb);
    if (Sel.has) { const x = c.getContext('2d'); x.globalCompositeOperation = 'destination-in'; x.drawImage(Sel.canvas, bb.x, bb.y, bb.w, bb.h, 0, 0, bb.w, bb.h); }
    return c;
  },
  async registerImage(name) {
    const c = this.cropActive(); if (!c) return;
    this.user.push({ id: 'u' + uid(), name, kind: 'image', blob: await canvasBlob(c, 'image/png') });
    await this.persist(); toast(`이미지 소재 "${name}"를 등록했습니다.`); this.renderGrid();
  },
  async registerTip(name) {
    const c = this.cropActive(); if (!c) return;
    // 배경이 불투명하면 명도로, 투명하면 알파로 브러시 끝을 만든다
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let transparent = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) transparent++;
    const lum = transparent < d.length / 40;
    const id = 'u' + uid();
    TIPS.add(id, name, c, lum);
    this.user.push({ id, name, kind: 'tip', blob: await canvasBlob(c, 'image/png'), lum });
    await this.persist();
    this.installTip(id, name);
    this.renderGrid();
  },
  async registerBrush(name) {
    const t = curTool(), s = curSub();
    if (!['brush', 'blend'].includes(s.kind || t.kind)) { toast('그리기 도구를 선택한 상태에서 등록해 주세요.', true); return; }
    const preset = { ...structuredClone(s), id: 'u' + uid(), name };
    this.user.push({ id: preset.id, name, kind: 'brush', toolId: t.id, preset });
    await this.persist();
    this.installBrush(this.user[this.user.length - 1]);
    this.renderGrid();
  },
  async importFile(file) {
    const blob = file;
    this.user.push({ id: 'u' + uid(), name: file.name.replace(/\.[^.]+$/, ''), kind: 'image', blob });
    await this.persist(); this.renderGrid(); toast('이미지 소재를 가져왔습니다.');
  },
  async remove(id) {
    this.user = this.user.filter(m => m.id !== id);
    for (const t of TOOL_LIST) t.subs = t.subs.filter(s => s.id !== id && s.id !== 'deco-' + id);
    await this.persist(); this.renderGrid(); ToolUI.render();
  },
  /* ---------- UI ---------- */
  open() {
    const tabs = [['image', '이미지·패턴'], ['tone', '톤'], ['tip', '브러시 끝'], ['3d', '3D'], ['user', '내 소재']];
    const tabBar = el('div', { class: 'seg mat-tabs' }, tabs.map(([k, l]) => el('button', { class: this.tab === k ? 'on' : '', text: l, onclick: e => { this.tab = k; for (const b of tabBar.children) b.classList.remove('on'); e.target.classList.add('on'); this.renderGrid(); } })));
    const search = el('input', { type: 'text', placeholder: '소재 검색', class: 'mat-search', 'aria-label': '소재 검색' });
    search.addEventListener('input', () => { this.query = search.value.trim(); this.renderGrid(); });
    const tile = el('input', { type: 'checkbox', id: 'mat-tile', checked: true });
    this.grid = el('div', { class: 'mat-grid' });
    const reg = el('div', { class: 'preset-row' },
      el('button', { class: 'cmd', text: '선택 범위를 이미지 소재로', onclick: () => Dialogs.prompt('이미지 소재 이름', '내 소재', v => this.registerImage(v)) }),
      el('button', { class: 'cmd', text: '브러시 끝 모양으로 등록', onclick: () => Dialogs.prompt('브러시 끝 이름', '내 브러시 끝', v => this.registerTip(v)) }),
      el('button', { class: 'cmd', text: '현재 보조 도구 등록', onclick: () => Dialogs.prompt('보조 도구 이름', curSub().name + ' (내 설정)', v => this.registerBrush(v)) }),
      el('button', { class: 'cmd', text: '이미지 파일 가져오기', onclick: () => $('#file-material').click() }));
    Modal.open('소재', [el('div', { class: 'mat-head' }, tabBar, search), el('label', { class: 'pcheck' }, tile, '패턴은 반복해서 붙이기'), this.grid, el('p', { class: 'note', text: '내 소재는 이 브라우저에 저장됩니다. 등록은 편집 중인 레이어(선택 범위가 있으면 그 부분)를 사용합니다.' }), reg], [['닫기', () => Modal.close(), true]], { wide: true, noFocus: true });
    this.renderGrid();
  },
  item(name, preview, onClick, onDelete) {
    const b = el('button', { class: 'mat-item', title: name, onclick: onClick }, preview, el('span', { text: name }));
    if (onDelete) { const x = el('span', { class: 'mat-del', text: '×', title: '삭제', role: 'button' }); x.addEventListener('click', e => { e.stopPropagation(); onDelete(); }); b.append(x); }
    return b;
  },
  previewCanvas(draw) { const c = mkCanvas(96, 96); c.className = 'mat-prev'; const x = c.getContext('2d'); x.fillStyle = '#f4f2ee'; x.fillRect(0, 0, 96, 96); draw(x); return c; },
  renderGrid() {
    if (!this.grid) return;
    const g = this.grid, q = (this.query || '').toLowerCase(), ok = n => !q || n.toLowerCase().includes(q);
    g.innerHTML = '';
    const close = () => Modal.close();
    const tileOn = () => { const t = $('#mat-tile'); return !t || t.checked; };
    if (this.tab === 'image') for (const p of this.patterns()) if (ok(p.name)) g.append(this.item(p.name, this.previewCanvas(x => { x.fillStyle = x.createPattern(p.canvas, 'repeat'); x.fillRect(0, 0, 96, 96); }), () => { close(); this.applyImage(p.canvas, p.name, tileOn()); }));
    if (this.tab === 'tone') for (const t of this.tones()) if (ok(t.name)) {
      g.append(this.item(t.name, this.previewCanvas(x => { const id = x.getImageData(0, 0, 96, 96); const tmp = mkCanvas(96, 96), tx = tmp.getContext('2d'); const gv = Math.round(255 * (1 - t.tone.density / 100)); tx.fillStyle = hex([gv, gv, gv]); tx.fillRect(0, 0, 96, 96); halftone(tx, { x: 0, y: 0, w: 96, h: 96 }, { ...t.tone, lpi: t.tone.lpi * D.dpi / 350 * 2.2 }); x.drawImage(tmp, 0, 0); void id; }), () => { close(); Manga.newTone(t.tone); }));
    }
    if (this.tab === 'tip') for (const [id, t] of TIPS.map) if (ok(t.name)) g.append(this.item(t.name, this.previewCanvas(x => x.drawImage(t.orig, 8, 8, 80, 80)), () => { close(); this.installTip(id, t.name); }));
    if (this.tab === '3d') for (const it of this.threeItems()) if (ok(it.name)) g.append(this.item(it.name, this.previewCanvas(x => { x.fillStyle = '#6e6a6c'; x.font = '42px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.kind3d === 'figure' ? '人' : '◆', 48, 50); }), () => { close(); this.apply3D(it.kind3d); }));
    if (this.tab === 'user') {
      if (!this.user.length) g.append(el('p', { class: 'note', text: '아직 등록한 소재가 없습니다. 아래 버튼으로 레이어나 선택 범위를 소재로 등록하세요.' }));
      for (const m of this.user) if (ok(m.name)) {
        const prev = this.previewCanvas(x => { x.fillStyle = '#6e6a6c'; x.font = '13px sans-serif'; x.fillText(m.kind === 'brush' ? '보조 도구' : '', 8, 50); });
        if (m.blob) createImageBitmap(m.blob).then(b => { const x = prev.getContext('2d'), s = Math.min(80 / b.width, 80 / b.height); x.drawImage(b, 48 - b.width * s / 2, 48 - b.height * s / 2, b.width * s, b.height * s); }).catch(() => {});
        g.append(this.item(m.name, prev, async () => {
          close();
          if (m.kind === 'image') { const b = await createImageBitmap(m.blob), c = mkCanvas(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0); this.applyImage(c, m.name, false); }
          else if (m.kind === 'tip') this.installTip(m.id, m.name);
          else this.installBrush(m);
        }, () => this.remove(m.id)));
      }
    }
  },
};
