/* 팔레트 배치: 제목줄을 끌어 왼쪽·오른쪽 팔레트 독 사이로 옮기거나 순서를 바꾸고,
 * 독 밖에 놓으면 떠 있는 팔레트가 된다. 접기·숨기기·독 너비 조절, 배치는 이 브라우저에 기억된다. */
'use strict';

const PANEL_NAMES = { sub: '보조 도구', prop: '도구 속성', color: '컬러 써클', nav: '내비게이터', pages: '페이지 관리', lprops: '레이어 속성', layers: '레이어', history: '작업 내역' };
const Panels = {
  defaults: null,
  layout: null,
  el(id) { return document.querySelector(`.panel[data-panel="${id}"]`); },
  all() { return [...document.querySelectorAll('.panel[data-panel]')]; },
  docks() { return { left: $('#leftdock'), right: $('#rightdock') }; },
  /* ---------- 저장 · 복원 ---------- */
  capture() {
    const d = this.docks(), ids = el => [...el.querySelectorAll(':scope > .panel[data-panel]')].map(p => p.dataset.panel);
    const float = {};
    for (const p of document.querySelectorAll('#floating > .panel[data-panel]')) float[p.dataset.panel] = { x: parseInt(p.style.left) || 0, y: parseInt(p.style.top) || 0, w: p.offsetWidth, h: p.style.height ? parseInt(p.style.height) : 0 };
    const ws = $('#workspace');
    return {
      left: ids(d.left), right: ids(d.right), float,
      collapsed: this.all().filter(p => p.classList.contains('collapsed')).map(p => p.dataset.panel),
      hidden: this.all().filter(p => p.hidden).map(p => p.dataset.panel),
      lw: parseInt(ws.style.getPropertyValue('--lw')) || 240, rw: parseInt(ws.style.getPropertyValue('--rw')) || 284,
    };
  },
  save() { this.layout = this.capture(); store.set('panelLayout', this.layout); },
  apply(l) {
    const d = this.docks(), fl = $('#floating');
    const known = new Set(this.all().map(p => p.dataset.panel));
    const placed = new Set();
    for (const [side, list] of [['left', l.left], ['right', l.right]]) for (const id of list || []) { const p = this.el(id); if (p && !placed.has(id)) { d[side].append(p); placed.add(id); this.dockStyle(p); } }
    for (const [id, f] of Object.entries(l.float || {})) { const p = this.el(id); if (p && !placed.has(id)) { fl.append(p); placed.add(id); this.floatStyle(p, f); } }
    // 저장된 배치에 없는 팔레트(새로 생긴 팔레트)는 기본 위치로
    for (const id of known) if (!placed.has(id)) { const side = this.defaults.left.includes(id) ? 'left' : 'right'; d[side].append(this.el(id)); this.dockStyle(this.el(id)); }
    for (const p of this.all()) { p.classList.toggle('collapsed', (l.collapsed || []).includes(p.dataset.panel)); p.hidden = (l.hidden || []).includes(p.dataset.panel); }
    const ws = $('#workspace');
    ws.style.setProperty('--lw', clamp(l.lw || 240, 160, 520) + 'px');
    ws.style.setProperty('--rw', clamp(l.rw || 284, 180, 560) + 'px');
    this.refresh();
  },
  reset() {
    this.apply(structuredClone(this.defaults));
    this.save();
    toast('팔레트 배치를 처음 상태로 되돌렸습니다.');
  },
  // 빈 독은 접고, 캔버스 크기를 다시 맞춘다
  refresh() {
    const d = this.docks(), ws = $('#workspace');
    const has = el => [...el.children].some(p => p.classList.contains('panel') && !p.hidden);
    ws.classList.toggle('left-empty', !has(d.left));
    ws.classList.toggle('right-empty', !has(d.right));
    for (const p of this.all()) { const b = p.querySelector('.ph-float'); if (b) { const fl = p.parentElement.id === 'floating'; b.title = fl ? '독에 붙이기' : '떼어서 띄우기'; b.textContent = fl ? '⇲' : '⧉'; } }
    navDirty = true;
    setTimeout(() => { resizeView(); requestRender(); }, 0);
    if (typeof updateCmdStates === 'function') updateCmdStates();
  },
  dockStyle(p) { p.classList.remove('floating'); p.style.left = p.style.top = p.style.width = p.style.height = ''; },
  floatStyle(p, f) {
    p.classList.add('floating');
    const w = clamp(f.w || 270, 200, Math.max(220, innerWidth - 20));
    p.style.width = w + 'px';
    p.style.left = clamp(f.x, 0, Math.max(0, innerWidth - 80)) + 'px';
    p.style.top = clamp(f.y, 0, Math.max(0, innerHeight - 40)) + 'px';
    p.style.height = f.h ? clamp(f.h, 80, innerHeight - 20) + 'px' : '';
  },
  /* ---------- 동작 ---------- */
  toggleCollapse(p) { p.classList.toggle('collapsed'); this.save(); this.refresh(); },
  setHidden(id, hidden) { const p = this.el(id); if (!p) return; p.hidden = hidden; this.save(); this.refresh(); },
  toggleFloat(p) {
    if (p.parentElement.id === 'floating') {
      const side = this.defaults.left.includes(p.dataset.panel) ? 'left' : 'right';
      this.docks()[side].append(p); this.dockStyle(p);
    } else {
      const r = p.getBoundingClientRect();
      $('#floating').append(p); this.floatStyle(p, { x: r.left - 30, y: r.top + 20, w: r.width });
      this.bringFront(p);
    }
    this.save(); this.refresh();
  },
  // 떠 있는 팔레트를 맨 앞으로 (DOM을 옮기면 클릭이 취소되므로 z-index만 올린다)
  z: 1,
  bringFront(p) { if (p.parentElement.id === 'floating') p.style.zIndex = ++this.z; },
  /* ---------- 제목줄 끌기 ---------- */
  startDrag(p, e) {
    const r = p.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    const x0 = e.clientX, y0 = e.clientY;
    const ind = $('#dock-indicator');
    let moving = false, target = null;
    const ghost = el('div', { class: 'panel-ghost', text: PANEL_NAMES[p.dataset.panel] || '' });
    const findTarget = (x, y) => {
      for (const [side, dock] of Object.entries(this.docks())) {
        const dr = dock.getBoundingClientRect();
        // 비어 접힌 독은 화면 가장자리 띠에 놓으면 다시 붙는다
        const empty = $('#workspace').classList.contains(side + '-empty');
        const hit = empty ? (side === 'left' ? x < dr.left + 60 && x > dr.left - 10 : x > dr.right - 60) && y > dr.top && y < dr.bottom
          : x >= dr.left && x <= dr.right && y >= dr.top && y <= dr.bottom && dock.offsetParent;
        if (!hit) continue;
        const items = [...dock.children].filter(c => c.classList.contains('panel') && !c.hidden && c !== p);
        let before = null;
        for (const it of items) { const ir = it.getBoundingClientRect(); if (y < ir.top + ir.height / 2) { before = it; break; } }
        const ref = before ? before.getBoundingClientRect() : (items.length ? items[items.length - 1].getBoundingClientRect() : null);
        const lineY = before ? ref.top : ref ? ref.bottom : dr.top + 2;
        return { kind: 'dock', dock, before, line: { left: dr.left, width: empty ? 60 : dr.width, top: lineY } };
      }
      return { kind: 'float' };
    };
    const move = ev => {
      if (!moving) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        moving = true; document.body.append(ghost); document.body.classList.add('panel-dragging');
        p.classList.add('dragging');
      }
      ghost.style.left = ev.clientX - ox + 'px'; ghost.style.top = ev.clientY - oy + 'px'; ghost.style.width = Math.min(r.width, 300) + 'px';
      target = findTarget(ev.clientX, ev.clientY);
      if (target.kind === 'dock') { ind.hidden = false; Object.assign(ind.style, { left: target.line.left + 'px', width: target.line.width + 'px', top: target.line.top - 2 + 'px' }); }
      else ind.hidden = true;
    };
    const up = ev => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      ind.hidden = true; ghost.remove(); document.body.classList.remove('panel-dragging'); p.classList.remove('dragging');
      if (!moving) { if (ev.type === 'pointerup' && !ev.target.closest('button,input,select')) this.toggleCollapse(p); return; }
      if (ev.type === 'pointercancel') return;
      if (target && target.kind === 'dock') { target.dock.insertBefore(p, target.before); this.dockStyle(p); }
      else { $('#floating').append(p); this.floatStyle(p, { x: ev.clientX - ox, y: ev.clientY - oy, w: p.classList.contains('floating') ? p.offsetWidth : Math.max(240, r.width) }); }
      this.save(); this.refresh();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  },
  // 독 안쪽 가장자리를 끌어 너비 조절
  bindResizer(handle, side) {
    handle.addEventListener('pointerdown', e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const ws = $('#workspace'), x0 = e.clientX, w0 = side === 'left' ? $('#leftdock').offsetWidth : $('#rightdock').offsetWidth;
      const mv = ev => { const w = side === 'left' ? w0 + ev.clientX - x0 : w0 - (ev.clientX - x0); ws.style.setProperty(side === 'left' ? '--lw' : '--rw', clamp(w, side === 'left' ? 160 : 180, 560) + 'px'); resizeView(); navDirty = true; };
      const end = () => { handle.removeEventListener('pointermove', mv); handle.removeEventListener('pointerup', end); this.save(); this.refresh(); };
      handle.addEventListener('pointermove', mv); handle.addEventListener('pointerup', end);
    });
    handle.addEventListener('dblclick', () => { $('#workspace').style.setProperty(side === 'left' ? '--lw' : '--rw', (side === 'left' ? 240 : 284) + 'px'); this.save(); this.refresh(); });
  },
  init() {
    const d = this.docks();
    const ids = el => [...el.querySelectorAll(':scope > .panel[data-panel]')].map(p => p.dataset.panel);
    this.defaults = { left: ids(d.left), right: ids(d.right), float: {}, collapsed: [], hidden: [], lw: 240, rw: 284 };
    for (const p of this.all()) {
      const ph = p.querySelector('.ph');
      ph.setAttribute('title', '끌어서 옮기기 · 클릭해서 접기/펴기');
      const tools = el('span', { class: 'ph-tools' },
        el('button', { class: 'ph-btn ph-float', type: 'button', title: '떼어서 띄우기', 'aria-label': '팔레트 떼어내기/붙이기', text: '⧉', onclick: ev => { ev.stopPropagation(); this.toggleFloat(p); } }),
        el('button', { class: 'ph-btn', type: 'button', title: '팔레트 숨기기 (창 메뉴에서 다시 표시)', 'aria-label': '팔레트 숨기기', text: '×', onclick: ev => { ev.stopPropagation(); this.setHidden(p.dataset.panel, true); toast(`"${PANEL_NAMES[p.dataset.panel]}" 팔레트를 숨겼습니다. 창 메뉴에서 다시 표시할 수 있습니다.`); } }));
      ph.append(tools);
      ph.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('button,input,select')) return; e.preventDefault(); this.bringFront(p); this.startDrag(p, e); });
      p.addEventListener('pointerdown', () => this.bringFront(p));
    }
    // 떠 있는 팔레트 크기를 바꾸면 기억
    const ro = new ResizeObserver(() => { clearTimeout(this._rt); this._rt = setTimeout(() => { if (this.layout) this.save(); navDirty = true; requestRender(); }, 300); });
    for (const p of this.all()) ro.observe(p);
    this.bindResizer($('#leftdock-resizer'), 'left');
    this.bindResizer($('#rightdock-resizer'), 'right');
    window.addEventListener('resize', () => { for (const p of document.querySelectorAll('#floating > .panel')) this.floatStyle(p, { x: parseInt(p.style.left), y: parseInt(p.style.top), w: p.offsetWidth, h: p.style.height ? parseInt(p.style.height) : 0 }); });
    // 예전 버전의 접힘 상태를 이어받는다
    const saved = store.get('panelLayout', null);
    if (saved) this.apply(saved);
    else { const old = store.get('collapsed', {}); this.apply({ ...structuredClone(this.defaults), collapsed: Object.keys(old).filter(k => old[k]) }); }
    this.layout = this.capture();
  },
};

/* ---------- 창 메뉴 ---------- */
for (const [id, name] of Object.entries(PANEL_NAMES)) {
  cmd('panel-' + id, name, null, () => {
    const p = Panels.el(id);
    if (p.hidden) { Panels.setHidden(id, false); if (p.classList.contains('collapsed')) Panels.toggleCollapse(p); }
    else Panels.setHidden(id, true);
  }, { check: () => { const p = Panels.el(id); return !!p && !p.hidden; } });
}
cmd('panelsReset', '팔레트 배치 초기화', null, () => Panels.reset());
cmd('panelsCollapseAll', '모든 팔레트 접기', null, () => { for (const p of Panels.all()) p.classList.add('collapsed'); Panels.save(); Panels.refresh(); });
cmd('panelsExpandAll', '모든 팔레트 펴기', null, () => { for (const p of Panels.all()) p.classList.remove('collapsed'); Panels.save(); Panels.refresh(); });
{
  const win = MENUS.find(m => m[0] === '창');
  win[1] = ['materials', 'timeline', '-', ...Object.keys(PANEL_NAMES).map(id => 'panel-' + id), '-', 'panelsCollapseAll', 'panelsExpandAll', 'panelsReset'];
}
