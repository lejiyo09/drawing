/* WebPaint 서비스 워커: 앱 파일을 설치 시 저장해 오프라인에서도 실행한다.
 * 앱 파일을 고치면 VERSION을 올려야 사용자에게 새 버전이 전달된다. */
const VERSION = 'webpaint-v2.0.1';
const FONT_CACHE = 'webpaint-fonts';
const APP_FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/psd.js', 'js/core.js', 'js/brush.js', 'js/selection.js', 'js/transform.js', 'js/vector.js', 'js/ruler.js',
  'js/text.js', 'js/manga.js', 'js/anim.js', 'js/three3d.js', 'js/material.js', 'js/io.js', 'js/layers.js', 'js/ui.js', 'js/main.js',
  'vendor/three.min.js', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONT_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 구글 폰트: 저장본을 먼저 쓰고 뒤에서 갱신
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // 앱 파일: 캐시 우선, 없으면 네트워크 후 저장. 페이지 이동은 오프라인일 때 index.html로.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return r;
  }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
