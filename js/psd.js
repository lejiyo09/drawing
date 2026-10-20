/* PSD 읽기/쓰기 (8비트 RGB, 레이어 포함).
 * 쓰기: 레이어 레코드 + PackBits(RLE) 채널 + 병합 이미지.
 * 읽기: 래스터 레이어만 가져오고 그룹 구분선은 건너뛴다. */
(function (global) {
  'use strict';

  // 앱 블렌드 모드(캔버스 globalCompositeOperation) ↔ PSD 블렌드 키
  const BLEND_TO_PSD = {
    'source-over': 'norm', 'darken': 'dark', 'multiply': 'mul ', 'color-burn': 'idiv',
    'lighten': 'lite', 'screen': 'scrn', 'color-dodge': 'div ', 'lighter': 'lddg',
    'overlay': 'over', 'soft-light': 'sLit', 'hard-light': 'hLit', 'difference': 'diff',
    'exclusion': 'smud', 'hue': 'hue ', 'saturation': 'sat ', 'color': 'colr', 'luminosity': 'lum ',
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
    // 길이 필드를 나중에 채우는 구간
    beginLen() { const at = this.pos; this.u32(0); return at; }
    endLen(at, pad = 1) {
      while ((this.pos - at - 4) % pad) this.u8(0);
      const len = this.pos - at - 4, b = this.buf;
      b[at] = (len >>> 24) & 255; b[at + 1] = (len >>> 16) & 255; b[at + 2] = (len >>> 8) & 255; b[at + 3] = len & 255;
    }
    result() { return this.buf.slice(0, this.pos); }
  }

  // PackBits 한 줄 압축
  function packRow(src, start, len, out) {
    let i = 0;
    while (i < len) {
      let run = 1;
      while (i + run < len && run < 128 && src[start + i + run] === src[start + i]) run++;
      if (run >= 3 || (run === 2 && i + 2 >= len)) {
        out.push(257 - run, src[start + i]); i += run; continue;
      }
      let j = i, lit = [];
      while (j < len && lit.length < 128) {
        if (j + 2 < len && src[start + j] === src[start + j + 1] && src[start + j] === src[start + j + 2]) break;
        lit.push(src[start + j]); j++;
      }
      out.push(lit.length - 1, ...lit); i = j;
    }
  }

  // 채널 하나를 RLE로 압축해 { counts:Uint16Array, data:Uint8Array } 반환
  function rleChannel(plane, w, h) {
    const counts = new Uint16Array(h), parts = [];
    let total = 0;
    for (let y = 0; y < h; y++) {
      const row = [];
      packRow(plane, y * w, w, row);
      counts[y] = row.length; total += row.length; parts.push(row);
    }
    const data = new Uint8Array(total);
    let p = 0;
    for (const r of parts) { data.set(r, p); p += r.length; }
    return { counts, data };
  }

  function planes(rgba, w, h) {
    const n = w * h, r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n), a = new Uint8Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) { r[i] = rgba[j]; g[i] = rgba[j + 1]; b[i] = rgba[j + 2]; a[i] = rgba[j + 3]; }
    return { r, g, b, a };
  }

  function contentBounds(rgba, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      const o = y * w * 4;
      for (let x = 0; x < w; x++) {
        if (rgba[o + x * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  function crop(rgba, w, r) {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) out.set(rgba.subarray(((r.y + y) * w + r.x) * 4, ((r.y + y) * w + r.x + r.w) * 4), y * r.w * 4);
    return out;
  }

  function pascalName(s) {
    // 레거시 이름 필드는 ASCII만. 한글 이름은 luni 블록으로 저장한다.
    const ascii = Array.from(s).map(c => (c.charCodeAt(0) < 128 ? c : '_')).join('').slice(0, 255);
    return ascii;
  }

  /**
   * doc: { width, height, dpi, composite: ImageData-like {data}, layers:[{name, rgba(Uint8ClampedArray w*h*4), opacity 0..1,
   *        blend, hidden, clip, alphaLock}] }  레이어는 아래에서 위 순서.
   */
  function writePSD(doc) {
    const { width: W, height: H } = doc;
    const w = new Writer(W * H * 2 + 4096);
    // 헤더
    w.ascii('8BPS'); w.u16(1); w.zeros(6); w.u16(4); w.u32(H); w.u32(W); w.u16(8); w.u16(3);
    // 컬러 모드 데이터
    w.u32(0);
    // 이미지 리소스: 해상도(0x03ED)
    const res = w.beginLen();
    w.ascii('8BIM'); w.u16(0x03ED); w.u16(0); w.u32(16);
    const dpi = Math.round((doc.dpi || 72) * 65536);
    w.u32(dpi); w.u16(1); w.u16(1); w.u32(dpi); w.u16(1); w.u16(1);
    w.endLen(res);

    // 레이어와 마스크 정보
    const lmi = w.beginLen();
    const li = w.beginLen();
    const layers = doc.layers.map(L => {
      const b = contentBounds(L.rgba, W, H) || { x: 0, y: 0, w: 0, h: 0 };
      let ch;
      if (b.w && b.h) {
        const p = planes(crop(L.rgba, W, b), b.w, b.h);
        ch = [[-1, p.a], [0, p.r], [1, p.g], [2, p.b]].map(([id, pl]) => ({ id, ...rleChannel(pl, b.w, b.h) }));
      } else {
        ch = [-1, 0, 1, 2].map(id => ({ id, counts: new Uint16Array(0), data: new Uint8Array(0) }));
      }
      return { L, b, ch };
    });
    w.i16(layers.length);
    for (const { L, b, ch } of layers) {
      w.i32(b.y); w.i32(b.x); w.i32(b.y + b.h); w.i32(b.x + b.w);
      w.u16(ch.length);
      for (const c of ch) { w.i16(c.id); w.u32(2 + c.counts.length * 2 + c.data.length); }
      w.ascii('8BIM'); w.ascii(BLEND_TO_PSD[L.blend] || 'norm');
      w.u8(Math.round(Math.max(0, Math.min(1, L.opacity)) * 255));
      w.u8(L.clip ? 1 : 0);
      let flags = 8; // bit3: 포토샵 5.0 이상
      if (L.alphaLock) flags |= 1;
      if (L.hidden) flags |= 2;
      w.u8(flags); w.u8(0);
      const extra = w.beginLen();
      w.u32(0); // 레이어 마스크
      w.u32(0); // 블렌딩 범위
      const nm = pascalName(L.name);
      const nmStart = w.pos;
      w.u8(nm.length); w.ascii(nm);
      while ((w.pos - nmStart) % 4) w.u8(0);
      // 유니코드 이름
      w.ascii('8BIM'); w.ascii('luni');
      const lu = w.beginLen();
      w.u32(L.name.length);
      for (let i = 0; i < L.name.length; i++) w.u16(L.name.charCodeAt(i));
      w.endLen(lu, 4);
      w.endLen(extra);
    }
    for (const { ch } of layers) {
      for (const c of ch) {
        w.u16(1);
        for (let i = 0; i < c.counts.length; i++) w.u16(c.counts[i]);
        w.bytes(c.data);
      }
    }
    w.endLen(li, 2);
    w.u32(0); // 전역 레이어 마스크
    w.endLen(lmi);

    // 병합 이미지 (RLE, R G B A)
    const p = planes(doc.composite.data, W, H);
    const merged = [p.r, p.g, p.b, p.a].map(pl => rleChannel(pl, W, H));
    w.u16(1);
    for (const c of merged) for (let i = 0; i < c.counts.length; i++) w.u16(c.counts[i]);
    for (const c of merged) w.bytes(c.data);
    return w.result();
  }

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
    const start = r.p, out = new Uint8Array(w * h);
    const comp = r.u16();
    if (w && h) {
      if (comp === 0) { out.set(r.b.subarray(r.p, r.p + w * h)); }
      else if (comp === 1) {
        const counts = []; for (let y = 0; y < h; y++) counts.push(r.u16());
        for (let y = 0; y < h; y++) unpackBits(r, counts[y], out, y * w, w);
      } else throw new Error('지원하지 않는 PSD 압축 방식입니다 (ZIP).');
    }
    r.p = start + byteLen;
    return out;
  }

  function readPSD(buf) {
    const r = new Reader(buf);
    if (r.ascii(4) !== '8BPS') throw new Error('PSD 파일이 아닙니다.');
    const ver = r.u16();
    if (ver !== 1) throw new Error('PSB(대형 문서)는 지원하지 않습니다.');
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
    const layers = [];
    if (lmiLen > 0) {
      const liLen = r.u32();
      if (liLen > 0) {
        let count = Math.abs(r.i16());
        const recs = [];
        for (let i = 0; i < count; i++) {
          const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
          const nc = r.u16(), chans = [];
          for (let c = 0; c < nc; c++) chans.push({ id: r.i16(), len: r.u32() });
          r.skip(4); const key = r.ascii(4);
          const opacity = r.u8() / 255, clip = r.u8() === 1, flags = r.u8(); r.skip(1);
          const exLen = r.u32(), exEnd = r.p + exLen;
          const mLen = r.u32(); r.skip(mLen);
          const bLen = r.u32(); r.skip(bLen);
          const nl = r.u8(); let name = r.ascii(nl); r.p += (4 - ((nl + 1) % 4)) % 4;
          let section = 0;
          while (r.p + 12 <= exEnd) {
            const sig = r.ascii(4); if (sig !== '8BIM' && sig !== '8B64') break;
            const k = r.ascii(4), len = r.u32(), at = r.p;
            if (k === 'luni') {
              const n = r.u32(); let s = ''; for (let j = 0; j < n; j++) s += String.fromCharCode(r.u16());
              name = s.replace(/\u0000+$/, '');
            } else if (k === 'lsct' || k === 'lsdk') section = r.u32();
            r.p = at + len;
          }
          r.p = exEnd;
          recs.push({ top, left, bottom, right, chans, key, opacity, clip, hidden: !!(flags & 2), alphaLock: !!(flags & 1), name, section });
        }
        for (const rec of recs) {
          const w = rec.right - rec.left, h = rec.bottom - rec.top;
          const data = {};
          for (const c of rec.chans) data[c.id] = readChannel(r, w, h, c.len);
          if (rec.section === 1 || rec.section === 2 || rec.section === 3) continue; // 그룹 구분선
          const rgba = new Uint8ClampedArray(Math.max(0, w * h) * 4);
          for (let i = 0, n = w * h; i < n; i++) {
            rgba[i * 4] = data[0] ? data[0][i] : 0;
            rgba[i * 4 + 1] = data[1] ? data[1][i] : 0;
            rgba[i * 4 + 2] = data[2] ? data[2][i] : 0;
            rgba[i * 4 + 3] = data[-1] ? data[-1][i] : 255;
          }
          layers.push({
            name: rec.name || '레이어', x: rec.left, y: rec.top, w, h, rgba,
            opacity: rec.opacity, blend: PSD_TO_BLEND[rec.key] || 'source-over',
            hidden: rec.hidden, clip: rec.clip, alphaLock: rec.alphaLock,
          });
        }
      }
    }
    r.p = lmiEnd;
    let composite = null;
    if (!layers.length) {
      // 레이어 없는 PSD: 병합 이미지를 읽는다
      const comp = r.u16(), n = W * H, chs = [];
      if (comp === 1) {
        const counts = []; for (let i = 0; i < nch * H; i++) counts.push(r.u16());
        for (let c = 0; c < nch; c++) { const out = new Uint8Array(n); for (let y = 0; y < H; y++) unpackBits(r, counts[c * H + y], out, y * W, W); chs.push(out); }
      } else if (comp === 0) {
        for (let c = 0; c < nch; c++) { chs.push(buf.slice(r.p, r.p + n)); r.p += n; }
      } else throw new Error('지원하지 않는 PSD 압축 방식입니다.');
      composite = new Uint8ClampedArray(n * 4);
      for (let i = 0; i < n; i++) {
        composite[i * 4] = chs[0][i]; composite[i * 4 + 1] = chs[1][i]; composite[i * 4 + 2] = chs[2][i];
        composite[i * 4 + 3] = chs[3] ? chs[3][i] : 255;
      }
    }
    return { width: W, height: H, dpi, layers, composite };
  }

  global.PSD = { writePSD, readPSD, BLEND_TO_PSD };
})(typeof window !== 'undefined' ? window : globalThis);
