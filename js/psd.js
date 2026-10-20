/* PSD 읽기/쓰기 (8비트 RGB): 레이어, 폴더(그룹), 레이어 마스크, 일부 보정 레이어, 한글 레이어 이름(luni).
 * 쓰기 입력 records(아래→위 순서):
 *   { kind:'layer', name, rgba(W*H*4), opacity, blend, hidden, clip, alphaLock, mask?(Uint8Array W*H) }
 *   { kind:'adjust', name, key, payload(Uint8Array), opacity, hidden, clip, mask? }
 *   { kind:'groupStart' }  …자식…  { kind:'groupEnd', name, opacity, blend, hidden, open, mask? } */
(function (global) {
  'use strict';

  const BLEND_TO_PSD = {
    'source-over': 'norm', 'darken': 'dark', 'multiply': 'mul ', 'color-burn': 'idiv',
    'lighten': 'lite', 'screen': 'scrn', 'color-dodge': 'div ', 'lighter': 'lddg',
    'overlay': 'over', 'soft-light': 'sLit', 'hard-light': 'hLit', 'difference': 'diff',
    'exclusion': 'smud', 'hue': 'hue ', 'saturation': 'sat ', 'color': 'colr', 'luminosity': 'lum ', 'pass': 'pass',
  };
  const PSD_TO_BLEND = Object.fromEntries(Object.entries(BLEND_TO_PSD).map(([k, v]) => [v, k]));

  class Writer {
    constructor(size = 1 << 20) { this.buf = new Uint8Array(size); this.pos = 0; }
    ensure(n) {
      if (this.pos + n <= this.buf.length) return;
      let s = this.buf.length * 2;
      while (s < this.pos + n) s *= 2;
      const b = new Uint8Array(s); b.set(this.buf.subarray(0, this.pos)); this.buf = b;
    }
    u8(v) { this.ensure(1); this.buf[this.pos++] = v & 255; }
    u16(v) { this.ensure(2); this.buf[this.pos++] = (v >> 8) & 255; this.buf[this.pos++] = v & 255; }
    i16(v) { this.u16(v < 0 ? v + 65536 : v); }
    u32(v) { this.ensure(4); const b = this.buf, p = this.pos; b[p] = (v >>> 24) & 255; b[p + 1] = (v >>> 16) & 255; b[p + 2] = (v >>> 8) & 255; b[p + 3] = v & 255; this.pos += 4; }
    i32(v) { this.u32(v >>> 0); }
    ascii(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
    bytes(a) { this.ensure(a.length); this.buf.set(a, this.pos); this.pos += a.length; }
    zeros(n) { this.ensure(n); this.buf.fill(0, this.pos, this.pos + n); this.pos += n; }
    beginLen() { const at = this.pos; this.u32(0); return at; }
    endLen(at, pad = 1) {
      while ((this.pos - at - 4) % pad) this.u8(0);
      const len = this.pos - at - 4, b = this.buf;
      b[at] = (len >>> 24) & 255; b[at + 1] = (len >>> 16) & 255; b[at + 2] = (len >>> 8) & 255; b[at + 3] = len & 255;
    }
    result() { return this.buf.slice(0, this.pos); }
  }

  function packRow(src, start, len, out) {
    let i = 0;
    while (i < len) {
      let run = 1;
      while (i + run < len && run < 128 && src[start + i + run] === src[start + i]) run++;
      if (run >= 3 || (run === 2 && i + 2 >= len)) { out.push(257 - run, src[start + i]); i += run; continue; }
      let j = i;
      const lit = [];
      while (j < len && lit.length < 128) {
        if (j + 2 < len && src[start + j] === src[start + j + 1] && src[start + j] === src[start + j + 2]) break;
        lit.push(src[start + j]); j++;
      }
      out.push(lit.length - 1);
      for (const v of lit) out.push(v);
      i = j;
    }
  }
  function rleChannel(plane, w, h) {
    const counts = new Uint16Array(h), parts = [];
    let total = 0;
    for (let y = 0; y < h; y++) { const row = []; packRow(plane, y * w, w, row); counts[y] = row.length; total += row.length; parts.push(row); }
    const data = new Uint8Array(total);
    let p = 0;
    for (const r of parts) { data.set(r, p); p += r.length; }
    return { counts, data };
  }
  function planes(rgba, n) {
    const r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), a = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) { r[i] = rgba[j]; g[i] = rgba[j + 1]; b[i] = rgba[j + 2]; a[i] = rgba[j + 3]; }
    return { r, g, b, a };
  }
  function contentBounds(rgba, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) { const o = y * w * 4; for (let x = 0; x < w; x++) if (rgba[o + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  function crop(rgba, w, r) {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) out.set(rgba.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), y * r.w * 4);
    return out;
  }
  const asciiName = s => Array.from(s).map(c => (c.charCodeAt(0) < 128 ? c : '_')).join('').slice(0, 255);
  const EMPTY = () => ({ counts: new Uint16Array(0), data: new Uint8Array(0) });

  function writePSD(doc) {
    const { width: W, height: H } = doc, N = W * H;
    const w = new Writer(N * 2 + 4096);
    w.ascii('8BPS'); w.u16(1); w.zeros(6); w.u16(4); w.u32(H); w.u32(W); w.u16(8); w.u16(3);
    w.u32(0);
    const res = w.beginLen();
    w.ascii('8BIM'); w.u16(0x03ED); w.u16(0); w.u32(16);
    const dpi = Math.round((doc.dpi || 72) * 65536);
    w.u32(dpi); w.u16(1); w.u16(1); w.u32(dpi); w.u16(1); w.u16(1);
    w.endLen(res);

    const lmi = w.beginLen();
    const li = w.beginLen();
    const recs = doc.records.map(R => {
      const out = { R, b: { x: 0, y: 0, w: 0, h: 0 }, ch: [] };
      if (R.kind === 'layer') {
        const b = contentBounds(R.rgba, W, H);
        if (b) {
          const p = planes(crop(R.rgba, W, b), b.w * b.h);
          out.b = b;
          out.ch = [[-1, p.a], [0, p.r], [1, p.g], [2, p.b]].map(([id, pl]) => ({ id, ...rleChannel(pl, b.w, b.h) }));
        }
      }
      if (!out.ch.length) out.ch = [-1, 0, 1, 2].map(id => ({ id, ...EMPTY() }));
      if (R.mask) out.ch.push({ id: -2, ...rleChannel(R.mask, W, H) });
      return out;
    });
    w.i16(recs.length);
    for (const { R, b, ch } of recs) {
      w.i32(b.y); w.i32(b.x); w.i32(b.y + b.h); w.i32(b.x + b.w);
      w.u16(ch.length);
      for (const c of ch) { w.i16(c.id); w.u32(2 + c.counts.length * 2 + c.data.length); }
      const blend = R.kind === 'groupStart' ? 'norm' : (BLEND_TO_PSD[R.blend] || 'norm');
      w.ascii('8BIM'); w.ascii(R.kind === 'groupEnd' && blend === 'pass' ? 'norm' : blend);
      w.u8(Math.round(Math.max(0, Math.min(1, R.opacity ?? 1)) * 255));
      w.u8(R.clip ? 1 : 0);
      let flags = 8;
      if (R.alphaLock) flags |= 1;
      if (R.hidden) flags |= 2;
      if (R.kind === 'groupStart' || R.kind === 'groupEnd') flags |= 16;
      w.u8(flags); w.u8(0);
      const extra = w.beginLen();
      if (R.mask) { w.u32(20); w.i32(0); w.i32(0); w.i32(H); w.i32(W); w.u8(0); w.u8(0); w.u16(0); }
      else w.u32(0);
      w.u32(0);
      const name = R.kind === 'groupStart' ? '</Layer group>' : (R.name || '');
      const nm = asciiName(name), nmStart = w.pos;
      w.u8(nm.length); w.ascii(nm);
      while ((w.pos - nmStart) % 4) w.u8(0);
      w.ascii('8BIM'); w.ascii('luni');
      const lu = w.beginLen();
      w.u32(name.length); for (let i = 0; i < name.length; i++) w.u16(name.charCodeAt(i));
      w.endLen(lu, 4);
      if (R.kind === 'groupStart' || R.kind === 'groupEnd') {
        w.ascii('8BIM'); w.ascii('lsct');
        const ls = w.beginLen();
        w.u32(R.kind === 'groupStart' ? 3 : (R.open === false ? 2 : 1));
        if (R.kind === 'groupEnd') { w.ascii('8BIM'); w.ascii(BLEND_TO_PSD[R.blend] || 'pass'); }
        w.endLen(ls, 4);
      }
      if (R.kind === 'adjust') {
        w.ascii('8BIM'); w.ascii(R.key);
        const ad = w.beginLen();
        w.bytes(R.payload);
        w.endLen(ad, 4);
      }
      w.endLen(extra);
    }
    for (const { ch } of recs) for (const c of ch) { w.u16(1); for (let i = 0; i < c.counts.length; i++) w.u16(c.counts[i]); w.bytes(c.data); }
    w.endLen(li, 2);
    w.u32(0);
    w.endLen(lmi);

    const p = planes(doc.composite.data, N);
    const merged = [p.r, p.g, p.b, p.a].map(pl => rleChannel(pl, W, H));
    w.u16(1);
    for (const c of merged) for (let i = 0; i < c.counts.length; i++) w.u16(c.counts[i]);
    for (const c of merged) w.bytes(c.data);
    return w.result();
  }

  /* ---------- 보정 레이어 페이로드 ---------- */
  function bytes(fn) { const w = new Writer(512); fn(w); return w.result(); }
  const ADJ = {
    invert: () => ({ key: 'nvrt', payload: new Uint8Array(0) }),
    posterize: p => ({ key: 'post', payload: bytes(w => { w.u16(p.n); w.u16(0); }) }),
    binarize: p => ({ key: 'thrs', payload: bytes(w => { w.u16(p.t); w.u16(0); }) }),
    bc: p => ({ key: 'brit', payload: bytes(w => { w.i16(Math.round(p.b * 1.5)); w.i16(Math.round(p.c)); w.i16(127); w.u8(0); w.u8(0); }) }),
    hsl: p => ({ key: 'hue2', payload: bytes(w => {
      w.u16(2); w.u8(0); w.u8(0); w.i16(0); w.i16(25); w.i16(0);
      w.i16(Math.round(p.h)); w.i16(Math.round(p.s)); w.i16(Math.round(p.l));
      for (const r of [[315, 345, 15, 45], [15, 45, 75, 105], [75, 105, 135, 165], [135, 165, 195, 225], [195, 225, 255, 285], [255, 285, 315, 345]]) { for (const v of r) w.i16(v); w.i16(0); w.i16(0); w.i16(0); }
    }) }),
    levels: p => ({ key: 'levl', payload: bytes(w => {
      w.u16(2);
      for (let i = 0; i < 29; i++) {
        if (i === 0) { w.u16(p.inB); w.u16(p.inW); w.u16(p.outB); w.u16(p.outW); w.u16(Math.round(p.gamma * 100)); }
        else { w.u16(0); w.u16(255); w.u16(0); w.u16(255); w.u16(100); }
      }
    }) }),
    curve: p => ({ key: 'curv', payload: bytes(w => {
      const pts = p.pts.slice().sort((a, b) => a[0] - b[0]).slice(0, 19);
      w.u8(0); w.u16(1); w.u32(1); w.u16(pts.length);
      for (const [x, y] of pts) { w.u16(Math.round(y)); w.u16(Math.round(x)); }
    }) }),
    balance: p => ({ key: 'blnc', payload: bytes(w => { for (const g of [p.sh, p.mid, p.hi]) for (const v of g) w.i16(Math.round(v)); w.u8(p.keepLum ? 1 : 0); }) }),
  };
  function adjustPayload(kind, params) { return ADJ[kind] ? ADJ[kind](params) : null; }

  /* ---------- 읽기 ---------- */
  class Reader {
    constructor(buf) { this.b = buf; this.p = 0; this.dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); }
    u8() { return this.b[this.p++]; }
    u16() { const v = this.dv.getUint16(this.p); this.p += 2; return v; }
    i16() { const v = this.dv.getInt16(this.p); this.p += 2; return v; }
    u32() { const v = this.dv.getUint32(this.p); this.p += 4; return v; }
    i32() { const v = this.dv.getInt32(this.p); this.p += 4; return v; }
    ascii(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.b[this.p++]); return s; }
    skip(n) { this.p += n; }
  }
  function unpackBits(r, len, out, off, need) {
    const end = r.p + len;
    let o = off;
    while (r.p < end && o < off + need) {
      let n = r.b[r.p++];
      if (n > 127) n -= 256;
      if (n >= 0) { for (let i = 0; i <= n; i++) out[o++] = r.b[r.p++]; }
      else if (n !== -128) { const v = r.b[r.p++]; for (let i = 0; i < 1 - n; i++) out[o++] = v; }
    }
    r.p = end;
  }
  function readChannel(r, w, h, byteLen) {
    const start = r.p, out = new Uint8Array(Math.max(0, w * h));
    const comp = r.u16();
    if (w > 0 && h > 0) {
      if (comp === 0) out.set(r.b.subarray(r.p, r.p + w * h));
      else if (comp === 1) { const counts = []; for (let y = 0; y < h; y++) counts.push(r.u16()); for (let y = 0; y < h; y++) unpackBits(r, counts[y], out, y * w, w); }
      else throw new Error('ZIP 압축된 PSD 레이어는 지원하지 않습니다. 포토샵에서 "최대 호환성"으로 저장해 주세요.');
    }
    r.p = start + byteLen;
    return out;
  }
  function parseAdjust(key, r, len) {
    const at = r.p;
    try {
      if (key === 'nvrt') return { kind: 'invert', params: {} };
      if (key === 'post') return { kind: 'posterize', params: { n: r.u16() } };
      if (key === 'thrs') return { kind: 'binarize', params: { t: r.u16() } };
      if (key === 'brit') { const b = r.i16(), c = r.i16(); return { kind: 'bc', params: { b: Math.round(b / 1.5), c } }; }
      if (key === 'hue2') { r.u16(); r.u8(); r.u8(); r.skip(6); return { kind: 'hsl', params: { h: r.i16(), s: r.i16(), l: r.i16() } }; }
      if (key === 'levl') { r.u16(); return { kind: 'levels', params: { inB: r.u16(), inW: r.u16(), outB: r.u16(), outW: r.u16(), gamma: r.u16() / 100 } }; }
      if (key === 'curv') { r.u8(); r.u16(); const bits = r.u32(); if (!(bits & 1)) return null; const n = r.u16(), pts = []; for (let i = 0; i < n; i++) { const y = r.u16(), x = r.u16(); pts.push([x, y]); } return { kind: 'curve', params: { pts } }; }
      if (key === 'blnc') { const g = () => [r.i16(), r.i16(), r.i16()]; const sh = g(), mid = g(), hi = g(); return { kind: 'balance', params: { sh, mid, hi, keepLum: !!r.u8() } }; }
    } catch { /* 형식 불일치 */ } finally { r.p = at + len; }
    return null;
  }
  // 반환: { width, height, dpi, nodes:[{kind:'layer'|'folder'|'adjust', ..., children?}], composite }
  function readPSD(buf) {
    const r = new Reader(buf);
    if (r.ascii(4) !== '8BPS') throw new Error('PSD 파일이 아닙니다.');
    if (r.u16() !== 1) throw new Error('PSB(대형 문서)는 지원하지 않습니다.');
    r.skip(6);
    const nch = r.u16(), H = r.u32(), W = r.u32(), depth = r.u16(), mode = r.u16();
    if (depth !== 8 || mode !== 3) throw new Error('8비트 RGB PSD만 열 수 있습니다.');
    r.skip(r.u32());
    let dpi = 72;
    const resLen = r.u32(), resEnd = r.p + resLen;
    while (r.p < resEnd) {
      if (r.ascii(4) !== '8BIM') break;
      const id = r.u16(); const nl = r.u8(); r.skip(nl + ((nl + 1) % 2));
      const sz = r.u32(), at = r.p;
      if (id === 0x03ED) dpi = Math.round(r.u32() / 65536);
      r.p = at + sz + (sz % 2);
    }
    r.p = resEnd;
    const lmiLen = r.u32(), lmiEnd = r.p + lmiLen;
    const root = [], stack = [root];
    let any = false;
    if (lmiLen > 0) {
      const liLen = r.u32();
      if (liLen > 0) {
        const count = Math.abs(r.i16()), recs = [];
        for (let i = 0; i < count; i++) {
          const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
          const nc = r.u16(), chans = [];
          for (let c = 0; c < nc; c++) chans.push({ id: r.i16(), len: r.u32() });
          r.skip(4); const key = r.ascii(4);
          const opacity = r.u8() / 255, clip = r.u8() === 1, flags = r.u8(); r.skip(1);
          const exLen = r.u32(), exEnd = r.p + exLen;
          const mLen = r.u32(), mEnd = r.p + mLen;
          let mask = null;
          if (mLen >= 20) { const mt = r.i32(), ml = r.i32(), mb = r.i32(), mr = r.i32(), def = r.u8(), mf = r.u8(); mask = { top: mt, left: ml, bottom: mb, right: mr, def, disabled: !!(mf & 2) }; }
          r.p = mEnd;
          r.skip(r.u32());
          const nl = r.u8(); let name = r.ascii(nl); r.p += (4 - ((nl + 1) % 4)) % 4;
          let section = 0, sectionBlend = null, adjust = null;
          while (r.p + 12 <= exEnd) {
            const sig = r.ascii(4); if (sig !== '8BIM' && sig !== '8B64') break;
            const k = r.ascii(4), len = r.u32(), at = r.p;
            if (k === 'luni') { const n = r.u32(); let s = ''; for (let j = 0; j < n; j++) s += String.fromCharCode(r.u16()); name = s.replace(/\u0000+$/, ''); }
            else if (k === 'lsct' || k === 'lsdk') { section = r.u32(); if (len >= 12) { r.skip(4); sectionBlend = r.ascii(4); } }
            else if (!adjust) adjust = parseAdjust(k, r, len);
            r.p = at + len;
          }
          r.p = exEnd;
          recs.push({ top, left, bottom, right, chans, key, opacity, clip, hidden: !!(flags & 2), alphaLock: !!(flags & 1), name, section, sectionBlend, mask, adjust });
        }
        for (const rec of recs) {
          const w = rec.right - rec.left, h = rec.bottom - rec.top, data = {};
          for (const c of rec.chans) {
            if (c.id === -2 && rec.mask) data[-2] = readChannel(r, rec.mask.right - rec.mask.left, rec.mask.bottom - rec.mask.top, c.len);
            else if (c.id === -3) r.p += c.len;
            else data[c.id] = readChannel(r, w, h, c.len);
          }
          rec.data = data; rec.w = w; rec.h = h;
        }
        // 기록은 아래→위. 구분선(3)에서 그룹을 열고 폴더 기록(1·2)에서 닫는다.
        for (const rec of recs) {
          const cur = stack[stack.length - 1];
          let maskOut = null;
          if (rec.mask && rec.data[-2]) {
            const m = rec.mask, mw = m.right - m.left, mh = m.bottom - m.top, full = new Uint8Array(W * H).fill(m.def);
            for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) { const X = m.left + x, Y = m.top + y; if (X >= 0 && Y >= 0 && X < W && Y < H) full[Y * W + X] = rec.data[-2][y * mw + x]; }
            maskOut = full;
          }
          if (rec.section === 3) { const g = []; stack.push(g); continue; }
          if (rec.section === 1 || rec.section === 2) {
            const children = stack.length > 1 ? stack.pop() : [];
            stack[stack.length - 1].push({ kind: 'folder', name: rec.name, opacity: rec.opacity, blend: PSD_TO_BLEND[rec.sectionBlend || rec.key] || 'pass', hidden: rec.hidden, open: rec.section === 1, mask: maskOut, children });
            any = true; continue;
          }
          if (rec.adjust) { cur.push({ kind: 'adjust', name: rec.name, opacity: rec.opacity, hidden: rec.hidden, clip: rec.clip, mask: maskOut, adjust: rec.adjust }); any = true; continue; }
          const rgba = new Uint8ClampedArray(Math.max(0, rec.w * rec.h) * 4);
          for (let i = 0, n = rec.w * rec.h; i < n; i++) {
            rgba[i * 4] = rec.data[0] ? rec.data[0][i] : 0; rgba[i * 4 + 1] = rec.data[1] ? rec.data[1][i] : 0; rgba[i * 4 + 2] = rec.data[2] ? rec.data[2][i] : 0;
            rgba[i * 4 + 3] = rec.data[-1] ? rec.data[-1][i] : 255;
          }
          cur.push({ kind: 'layer', name: rec.name || '레이어', x: rec.left, y: rec.top, w: rec.w, h: rec.h, rgba, opacity: rec.opacity, blend: PSD_TO_BLEND[rec.key] || 'source-over', hidden: rec.hidden, clip: rec.clip, alphaLock: rec.alphaLock, mask: maskOut });
          any = true;
        }
        while (stack.length > 1) { const g = stack.pop(); stack[stack.length - 1].push(...g); }
      }
    }
    r.p = lmiEnd;
    let composite = null;
    if (!any) {
      const comp = r.u16(), n = W * H, chs = [];
      if (comp === 1) {
        const counts = []; for (let i = 0; i < nch * H; i++) counts.push(r.u16());
        for (let c = 0; c < nch; c++) { const out = new Uint8Array(n); for (let y = 0; y < H; y++) unpackBits(r, counts[c * H + y], out, y * W, W); chs.push(out); }
      } else if (comp === 0) { for (let c = 0; c < nch; c++) { chs.push(buf.slice(r.p, r.p + n)); r.p += n; } }
      else throw new Error('지원하지 않는 PSD 압축 방식입니다.');
      composite = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i++) { composite[i * 4] = chs[0][i]; composite[i * 4 + 1] = chs[1][i]; composite[i * 4 + 2] = chs[2][i]; composite[i * 4 + 3] = chs[3] ? chs[3][i] : 255; }
    }
    return { width: W, height: H, dpi, nodes: root, composite };
  }

  global.PSD = { writePSD, readPSD, adjustPayload, BLEND_TO_PSD };
})(typeof window !== 'undefined' ? window : globalThis);
