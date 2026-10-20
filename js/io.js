/* 입출력: 프로젝트(.wpaint) 저장·열기, 자동 저장(IndexedDB), PNG·JPEG·WebP·PSD·PDF·ZIP 내보내기,
 * PSD 열기, 애니메이션 GIF·WebM·PNG 연번 내보내기 */
'use strict';

function canvasBlob(c, type, q) { return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('이미지를 만들 수 없습니다.'))), type, q)); }
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function safeName(n) { return (n || D.name || '그림').replace(/[\\/:*?"<>|]+/g, '_'); }
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
async function dataToBitmap(src) {
  if (!src) return null;
  const blob = src instanceof Blob ? src : await (await fetch(src)).blob();
  return createImageBitmap(blob);
}

/* ---------- 합성 내보내기 ---------- */
function exportArea(area) {
  if (area === 'trim' && D.manga) return D.manga.trim;
  if (area === 'bleed' && D.manga) { const t = D.manga.trim, b = D.manga.bleed; return { x: t.x - b, y: t.y - b, w: t.w + 2 * b, h: t.h + 2 * b }; }
  return Rect.full();
}
// 숨긴 레이어는 항상 제외. 밑그림 레이어는 옵션.
function exportComposite(opts = {}) {
  const c = mkCanvas(D.w, D.h), x = c.getContext('2d');
  compositeInto(x, Rect.full(), { raw: true, export: true, excludeDraft: !opts.includeDraft });
  const a = exportArea(opts.area);
  if (a.x === 0 && a.y === 0 && a.w === D.w && a.h === D.h) return c;
  return cloneCanvas(c, { x: Math.round(a.x), y: Math.round(a.y), w: Math.round(a.w), h: Math.round(a.h) });
}
function scaled(c, scale, bg) {
  const w = Math.max(1, Math.round(c.width * scale)), h = Math.max(1, Math.round(c.height * scale));
  const o = mkCanvas(w, h), x = o.getContext('2d');
  if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.imageSmoothingQuality = 'high';
  x.drawImage(c, 0, 0, w, h);
  return o;
}
function layerPixels(L) {
  // 레이어 효과(레이어 컬러·경계 효과·톤)는 픽셀에 굽고, 마스크는 따로 내보낸다
  const t = T.get('read').ctx;
  t.clearRect(0, 0, D.w, D.h);
  if (L.fx && (L.fx.color || L.fx.border || L.fx.tone)) {
    const m = L.mask; L.mask = null;
    t.drawImage(layerSource(L, Rect.full(), { raw: true, frame: D.anim.frame }, 'exp'), 0, 0);
    L.mask = m;
  } else if (L.canvas) t.drawImage(L.canvas, 0, 0);
  return t.getImageData(0, 0, D.w, D.h).data.slice();
}
function maskAlpha(L) {
  const t = T.get('read').ctx;
  t.clearRect(0, 0, D.w, D.h); t.drawImage(L.mask, 0, 0);
  const d = t.getImageData(0, 0, D.w, D.h).data, m = new Uint8Array(D.w * D.h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3];
  return m;
}
function buildPSD(opts = {}) {
  const records = [], notes = new Set();
  const keep = L => (L.visible || opts.includeHidden) && !(L.draft && !opts.includeDraft) && !L.quickmask;
  const walk = pid => {
    let baseKept = false;
    for (const L of kids(pid)) {
      const k = keep(L);
      if (!L.clip) baseKept = k;
      if (!k || (L.clip && !baseKept)) continue;
      const common = { name: L.name, opacity: L.opacity, hidden: !L.visible, clip: L.clip && records.length > 0, mask: L.mask && L.maskOn ? maskAlpha(L) : null };
      if (L.type === 'folder') {
        records.push({ kind: 'groupStart' });
        walk(L.id);
        if (L.data.frame) {
          // 컷 테두리: 테두리 선을 폴더 맨 위 레이어로 굽고, 컷 밖을 가리는 마스크를 단다
          const c = mkCanvas(D.w, D.h), x = c.getContext('2d'); Manga.drawBorders(x, L);
          records.push({ kind: 'layer', name: L.name + ' 테두리', rgba: x.getImageData(0, 0, D.w, D.h).data, opacity: 1, blend: 'source-over' });
          const mc = mkCanvas(D.w, D.h), mx = mc.getContext('2d'); mx.fillStyle = '#fff'; mx.fillRect(0, 0, D.w, D.h); Manga.applyFrame(mx, L);
          const md = mx.getImageData(0, 0, D.w, D.h).data, m = new Uint8Array(D.w * D.h); for (let i = 0; i < m.length; i++) m[i] = md[i * 4 + 3];
          common.mask = m;
        }
        records.push({ kind: 'groupEnd', ...common, blend: L.blend, open: L.data.open });
      } else if (L.type === 'adjust') {
        const p = PSD.adjustPayload(L.data.kind, Object.assign({}, ADJUST[L.data.kind].defaults, L.data.params));
        if (p) records.push({ kind: 'adjust', ...common, ...p });
        else notes.add(ADJUST[L.data.kind].label);
      } else records.push({ kind: 'layer', ...common, rgba: layerPixels(L), blend: L.blend, alphaLock: L.alphaLock });
    }
  };
  walk(0);
  const comp = mkCanvas(D.w, D.h), cx = comp.getContext('2d');
  compositeInto(cx, Rect.full(), { raw: true, export: true, excludeDraft: !opts.includeDraft });
  const bytes = PSD.writePSD({ width: D.w, height: D.h, dpi: D.dpi, composite: cx.getImageData(0, 0, D.w, D.h), records });
  if (notes.size) toast(`PSD에 직접 넣을 수 없는 보정 레이어(${[...notes].join(', ')})는 병합 이미지에만 반영했습니다.`);
  return new Blob([bytes], { type: 'image/vnd.adobe.photoshop' });
}

/* ---------- ZIP (무압축) ---------- */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function buildZip(files /* [{name, blob}] */) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const data = new Uint8Array(await f.blob.arrayBuffer()), name = enc.encode(f.name), crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((s, b) => s + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/zip' });
}

/* ---------- PDF (JPEG 페이지) ---------- */
async function buildPDF(pages /* [{canvas, wPt, hPt}] */) {
  const enc = new TextEncoder(), parts = [], offs = [];
  let off = 0;
  const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); off += b.length; };
  push('%PDF-1.4\n%âãÏÓ\n');
  const n = pages.length, total = 2 + n * 3;
  const obj = (num, fn) => { offs[num] = off; push(`${num} 0 obj\n`); fn(); push('\nendobj\n'); };
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${n} >>`));
  for (let i = 0; i < n; i++) {
    const p = pages[i], pn = 3 + i * 3, im = pn + 1, ct = pn + 2;
    const jpeg = new Uint8Array(await (await canvasBlob(scaled(p.canvas, 1, '#ffffff'), 'image/jpeg', .92)).arrayBuffer());
    obj(pn, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.wPt.toFixed(2)} ${p.hPt.toFixed(2)}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`));
    obj(im, () => { push(`<< /Type /XObject /Subtype /Image /Width ${p.canvas.width} /Height ${p.canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
    const content = `q ${p.wPt.toFixed(2)} 0 0 ${p.hPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
    obj(ct, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  }
  const xref = off;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= total; i++) push(`${String(offs[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}
// 모든 페이지를 순회하며 fn(pageIndex)을 실행한 뒤 원래 페이지로 돌아온다
async function eachPage(fn) {
  const cur = P.index;
  Pages.store(cur);
  const out = [];
  for (let i = 0; i < P.pages.length; i++) {
    Pages.load(i, true);
    if (!comp.canvas || comp.canvas.width !== D.w) allocDocCanvases();
    for (const L of D.layers) if (L.renderedRev !== L.rev) { const r = RENDERERS[L.type]; if (r && L.type !== 'raster') r(L); L.renderedRev = L.rev; }
    out.push(await fn(i));
    Pages.store(i);
  }
  Pages.load(cur);
  return out;
}

/* ---------- GIF ---------- */
function medianCut(samples, k) {
  let boxes = [samples];
  while (boxes.length < k) {
    let bi = -1, br = -1, bc = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) { let mn = 255, mx = 0; for (const p of b) { if (p[c] < mn) mn = p[c]; if (p[c] > mx) mx = p[c]; } if (mx - mn > br) { br = mx - mn; bi = i; bc = c; } }
    });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[bc] - q[bc]), m = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map(b => { const s = [0, 0, 0]; for (const p of b) for (let c = 0; c < 3; c++) s[c] += p[c]; return s.map(v => Math.round(v / Math.max(1, b.length))); });
}
function lzw(indices, minCode) {
  const out = []; let cur = 0, bits = 0;
  const emit = (code, size) => { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  const clear = 1 << minCode, eoi = clear + 1;
  let size = minCode + 1, next = eoi + 1, dict = new Map();
  emit(clear, size);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i], key = prefix * 4096 + k;
    if (dict.has(key)) { prefix = dict.get(key); continue; }
    emit(prefix, size);
    if (next < 4096) { dict.set(key, next++); if (next > (1 << size) && size < 12) size++; }
    else { emit(clear, size); dict = new Map(); size = minCode + 1; next = eoi + 1; }
    prefix = k;
  }
  emit(prefix, size); emit(eoi, size);
  if (bits > 0) out.push(cur & 255);
  return out;
}
function encodeGIF(frames /* ImageData[] */, w, h, delayCs) {
  const samples = [];
  for (const f of frames) { const d = f.data, step = Math.max(1, Math.floor(d.length / 4 / 6000)); for (let i = 0; i < d.length; i += 4 * step) if (d[i + 3] >= 128) samples.push([d[i], d[i + 1], d[i + 2]]); }
  const pal = samples.length ? medianCut(samples, 255) : [[0, 0, 0]];
  while (pal.length < 255) pal.push([0, 0, 0]);
  const TR = 255, cache = new Map();
  const nearest = (r, g, b) => {
    const key = (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
    let v = cache.get(key);
    if (v === undefined) { let bd = 1e9; v = 0; for (let i = 0; i < 255; i++) { const p = pal[i], dd = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (dd < bd) { bd = dd; v = i; } } cache.set(key, v); }
    return v;
  };
  const out = [];
  const u16 = v => out.push(v & 255, (v >> 8) & 255);
  for (const c of 'GIF89a') out.push(c.charCodeAt(0));
  u16(w); u16(h); out.push(0xF7, 0, 0);
  for (let i = 0; i < 256; i++) { const p = pal[i] || [0, 0, 0]; out.push(p[0], p[1], p[2]); }
  out.push(0x21, 0xFF, 11); for (const c of 'NETSCAPE2.0') out.push(c.charCodeAt(0)); out.push(3, 1, 0, 0, 0);
  for (const f of frames) {
    out.push(0x21, 0xF9, 4, (2 << 2) | 1); u16(delayCs); out.push(TR, 0);
    out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0);
    const d = f.data, idx = new Uint8Array(w * h);
    for (let i = 0; i < idx.length; i++) { const j = i * 4; idx[i] = d[j + 3] < 128 ? TR : nearest(d[j], d[j + 1], d[j + 2]); }
    out.push(8);
    const data = lzw(idx, 8);
    for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); out.push(n); for (let k = 0; k < n; k++) out.push(data[i + k]); }
    out.push(0);
  }
  out.push(0x3B);
  return new Blob([new Uint8Array(out)], { type: 'image/gif' });
}
const AnimExport = {
  frameCanvas(scale) { return mkCanvas(Math.round(D.w * scale), Math.round(D.h * scale)); },
  async gif(scale, from, to, progress) {
    const c = this.frameCanvas(scale), x = c.getContext('2d'), frames = [];
    for (let f = from; f <= to; f++) { Anim.renderFrame(f, c, scale); frames.push(x.getImageData(0, 0, c.width, c.height)); progress((f - from + 1) / (to - from + 1) * .5); await new Promise(r => setTimeout(r)); }
    progress(.75);
    return encodeGIF(frames, c.width, c.height, Math.max(2, Math.round(100 / D.anim.fps)));
  },
  async png(scale, from, to, progress) {
    const c = this.frameCanvas(scale), files = [];
    for (let f = from; f <= to; f++) { Anim.renderFrame(f, c, scale); files.push({ name: `${safeName()}_${String(f + 1).padStart(4, '0')}.png`, blob: await canvasBlob(c, 'image/png') }); progress((f - from + 1) / (to - from + 1)); }
    return buildZip(files);
  },
  async video(scale, from, to, progress) {
    if (!window.MediaRecorder) throw new Error('이 브라우저는 동영상 녹화를 지원하지 않습니다.');
    const c = this.frameCanvas(scale), fps = D.anim.fps;
    const type = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error('지원하는 동영상 형식이 없습니다.');
    const stream = c.captureStream(fps);
    let actx = null;
    if (D.audio && D.audio.blob) {
      try {
        actx = new AudioContext();
        const buf = await actx.decodeAudioData(await D.audio.blob.arrayBuffer());
        const src = actx.createBufferSource(); src.buffer = buf;
        const dst = actx.createMediaStreamDestination(); src.connect(dst);
        dst.stream.getAudioTracks().forEach(t => stream.addTrack(t));
        src.start(0, from / fps + (D.audio.offset || 0));
      } catch (e) { console.warn('오디오를 넣지 못했습니다', e); }
    }
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 }), chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    Anim.renderFrame(from, c, scale);
    rec.start();
    const t0 = performance.now();
    for (let f = from; f <= to; f++) {
      Anim.renderFrame(f, c, scale);
      progress((f - from + 1) / (to - from + 1));
      const wait = t0 + (f - from + 1) * 1000 / fps - performance.now();
      await new Promise(r => setTimeout(r, Math.max(0, wait)));
    }
    rec.stop(); await done;
    if (actx) actx.close();
    return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
  },
};

/* ---------- 프로젝트 저장 ---------- */
const LAYER_SAVE_KEYS = ['id', 'type', 'name', 'parent', 'opacity', 'blend', 'visible', 'locked', 'alphaLock', 'clip', 'draft', 'ref', 'color', 'maskOn', 'quickmask', 'fx', 'keys', 'data'];
async function serializeProject(asBlob) {
  Pages.store();
  const img = async c => (c ? (asBlob ? canvasBlob(c, 'image/png') : blobToDataURL(await canvasBlob(c, 'image/png'))) : null);
  const pages = [];
  for (const pg of P.pages) {
    const layers = [];
    for (const L of pg.layers) {
      const o = {}; for (const k of LAYER_SAVE_KEYS) o[k] = L[k] === undefined ? null : structuredClone(L[k]);
      o.canvas = await img(L.canvas); o.mask = await img(L.mask);
      layers.push(o);
    }
    const anim = structuredClone(pg.anim || defaultAnim());
    const audio = pg.audio && pg.audio.blob ? { name: pg.audio.name, offset: pg.audio.offset || 0, data: asBlob ? pg.audio.blob : await blobToDataURL(pg.audio.blob) } : null;
    const selSaved = [];
    for (const s of pg.selSaved || []) selSaved.push({ id: s.id, name: s.name, data: await img(s.canvas) });
    pages.push({ w: pg.w, h: pg.h, dpi: pg.dpi, name: pg.name, manga: pg.manga, anim, rulers: pg.rulers, comps: pg.comps, activeId: pg.activeId, nameSeq: pg.nameSeq, audio, selSaved, layers });
  }
  return { format: 'webpaint', version: 2, name: P.name || D.name, index: P.index, pages };
}
async function loadProject(p) {
  if (!p || p.format !== 'webpaint') throw new Error('WebPaint 프로젝트 파일이 아닙니다.');
  if (p.version === 1 || !p.pages) {
    p = { format: 'webpaint', version: 2, name: p.name, index: 0, pages: [{ w: p.width, h: p.height, dpi: p.dpi, name: p.name, activeId: null, nameSeq: p.layers.length + 1, layers: p.layers.map((o, i) => ({ ...o, id: i + 1, type: o.paper ? 'paper' : 'raster', parent: 0, canvas: o.data, data: {} })), active: p.active }] };
    const pg = p.pages[0]; pg.activeId = (pg.layers[p.pages[0].active ?? pg.layers.length - 1] || pg.layers[pg.layers.length - 1]).id;
  }
  if (A.float) cancelFloat();
  if (Text.editing) Text.closeEditorSilently();
  P.pages = []; P.name = p.name || '제목 없음';
  let maxId = 0;
  for (const pp of p.pages) for (const L of pp.layers) maxId = Math.max(maxId, L.id || 0);
  layerSeq = maxId + 1;
  for (let i = 0; i < p.pages.length; i++) {
    const pp = p.pages[i];
    const pg = Pages.blank({ w: pp.w, h: pp.h, dpi: pp.dpi || 350, name: pp.name || P.name, manga: pp.manga || null });
    pg.anim = Object.assign(defaultAnim(), pp.anim || {}); pg.anim.frame = 0;
    pg.rulers = pp.rulers || []; pg.comps = pp.comps || []; pg.nameSeq = pp.nameSeq || 1;
    P.pages.push(pg);
    Pages.load(i, true);
    for (const o of pp.layers) {
      const L = newLayer({ type: o.type || 'raster', name: o.name || '레이어', id: o.id });
      for (const k of LAYER_SAVE_KEYS) if (k !== 'id' && k !== 'type' && o[k] !== undefined && o[k] !== null) L[k] = o[k];
      L.fx = Object.assign({ color: null, border: null, tone: null }, o.fx || {});
      if (o.data) L.data = Object.assign(defaultData(L.type), o.data);
      if (L.canvas) { const b = await dataToBitmap(o.canvas); L.ctx.clearRect(0, 0, D.w, D.h); if (b) L.ctx.drawImage(b, 0, 0); }
      if (o.mask) { const b = await dataToBitmap(o.mask); L.mask = mkCanvas(D.w, D.h); if (b) L.mask.getContext('2d').drawImage(b, 0, 0); }
      L.rev = revSeq++;
      // 저장된 캐시 이미지를 그대로 쓰고, 텍스트·3D만 글꼴·엔진이 준비되면 다시 그린다
      L.renderedRev = (L.type === 'text' || L.type === '3d') && !o.canvas ? 0 : L.rev;
      D.layers.push(L);
    }
    if (pp.audio && pp.audio.data) { const blob = pp.audio.data instanceof Blob ? pp.audio.data : await (await fetch(pp.audio.data)).blob(); D.audio = { name: pp.audio.name, offset: pp.audio.offset || 0, blob }; }
    D.selSaved = [];
    for (const s of pp.selSaved || []) { const b = await dataToBitmap(s.data), c = mkCanvas(D.w, D.h); if (b) c.getContext('2d').drawImage(b, 0, 0); D.selSaved.push({ id: s.id, name: s.name, canvas: c }); }
    D.activeId = findLayer(pp.activeId) ? pp.activeId : (D.layers[D.layers.length - 1] || {}).id;
    Pages.store(i);
  }
  P.index = clamp(p.index || 0, 0, P.pages.length - 1);
  allocDocCanvases();
  Pages.load(P.index);
  for (const L of D.layers) { if (L.type === 'text') setTimeout(() => bumpLayer(L), 300); }
  fitView();
  Pages.render();
}
async function loadPSD(buf, name) {
  const doc = PSD.readPSD(new Uint8Array(buf));
  newDocument({ w: doc.width, h: doc.height, dpi: doc.dpi, paper: null, name });
  D.layers = [];
  const put = (L, rgba, x, y, w, h) => { if (!w || !h) return; L.ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, w * h * 4), w, h), x, y); };
  const toMask = m => { const c = mkCanvas(D.w, D.h), x = c.getContext('2d'), id = x.createImageData(D.w, D.h); for (let i = 0; i < m.length; i++) id.data[i * 4 + 3] = m[i]; x.putImageData(id, 0, 0); return c; };
  const add = (nodes, parent) => {
    for (const n of nodes) {
      let L;
      if (n.kind === 'folder') { L = newLayer({ type: 'folder', name: n.name, parent, opacity: n.opacity, blend: n.blend, visible: !n.hidden, data: { open: n.open, anim: false, frame: null } }); D.layers.push(L); add(n.children, L.id); }
      else if (n.kind === 'adjust') { L = newLayer({ type: 'adjust', name: n.name, parent, opacity: n.opacity, visible: !n.hidden, clip: n.clip, data: { kind: n.adjust.kind, params: n.adjust.params } }); D.layers.push(L); }
      else { L = newLayer({ name: n.name, parent, opacity: n.opacity, blend: n.blend, visible: !n.hidden, clip: n.clip, alphaLock: n.alphaLock }); put(L, n.rgba, n.x, n.y, n.w, n.h); D.layers.push(L); }
      if (n.mask) L.mask = toMask(n.mask);
    }
  };
  if (doc.nodes.length) add(doc.nodes, 0);
  else { const L = newLayer({ name: '배경' }); put(L, doc.composite, 0, 0, doc.width, doc.height); D.layers.push(L); }
  D.activeId = D.layers[D.layers.length - 1].id;
  H.clear(); markDirty(); renderLayers(); Pages.store();
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
      const bmp = await createImageBitmap(file);
      if (asLayer) { const c = mkCanvas(bmp.width, bmp.height); c.getContext('2d').drawImage(bmp, 0, 0); pasteCanvas(c, null, null, file.name.replace(/\.[^.]+$/, '')); }
      else {
        newDocument({ w: bmp.width, h: bmp.height, dpi: 72, paper: '#ffffff', name: file.name.replace(/\.[^.]+$/, '') });
        const L = active(); L.name = '배경'; L.ctx.drawImage(bmp, 0, 0);
        markDirty(); renderLayers(); queueThumb(L);
      }
    } else if (file.type.startsWith('audio/')) await Anim.loadAudio(file);
    else toast('열 수 없는 파일 형식입니다.', true);
  } catch (e) { console.error(e); toast(e.message || '파일을 열지 못했습니다.', true); }
}

/* ---------- 자동 저장 ---------- */
const Autosave = {
  timer: 0, db: null, saving: false,
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
  schedule() { clearTimeout(this.timer); this.timer = setTimeout(() => this.save(), 3000); },
  async save() {
    if (drag || A.float || Anim.playing || this.saving) { this.schedule(); return; }
    this.saving = true;
    try {
      const p = await serializeProject(true);
      p.savedAt = Date.now();
      await this.put('current', p);
      dirtySinceSave = false;
      updateStatus();
    } catch (e) { console.warn('자동 저장 실패', e); if (e && e.name === 'QuotaExceededError') toast('브라우저 저장 공간이 부족해 자동 저장하지 못했습니다. 프로젝트 파일로 저장해 주세요.', true); }
    this.saving = false;
  },
  async restore() {
    try { const p = await this.get('current'); if (p && (p.pages || p.layers)) { await loadProject(p); return true; } } catch (e) { console.warn(e); }
    return false;
  },
};
document.addEventListener('visibilitychange', () => { if (document.hidden && dirtySinceSave) Autosave.save(); });

/* ---------- 새 문서 ---------- */
function newDocument(o) {
  if (A.float) cancelFloat();
  if (Text.editing) Text.closeEditorSilently();
  if (Anim.playing) Anim.stop();
  P.pages = []; P.name = o.name || '제목 없음';
  const n = Math.max(1, o.pages || 1);
  for (let i = 0; i < n; i++) {
    P.pages.push(Pages.blank({ w: clamp(o.w | 0, 16, 10000), h: clamp(o.h | 0, 16, 10000), dpi: o.dpi || 350, name: P.name, manga: o.manga }));
    Pages.load(i, true);
    if (o.anim) { D.anim.fps = o.anim.fps; D.anim.length = o.anim.length; }
    Pages.populate(o.paper === undefined ? '#ffffff' : o.paper);
    Pages.store(i);
  }
  allocDocCanvases();
  Pages.load(0);
  lastStrokeEnd = null;
  fitView();
  Pages.render();
  dirtySinceSave = true; Autosave.schedule();
}
