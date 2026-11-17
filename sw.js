/*
 * 2026 중국 출장 매니저 — 오프라인 실행용 서비스 워커 (선택)
 *
 * 사용법: HTML 파일을 웹(https)에 올릴 때 이 sw.js를 "같은 폴더"에 함께 올리세요.
 *  - 한 번 열면 앱 화면이 휴대폰에 저장되어, 비행기 모드·중국 현지 접속 지연 시에도 홈 화면 아이콘으로 바로 열립니다.
 *  - 저장된 화면을 먼저 보여주고, 인터넷이 될 때 뒤에서 새 버전을 받아 다음 실행 때 반영합니다.
 *  - 환율·지도 등 외부 주소 요청은 건드리지 않습니다.
 *  - HTML 파일만 단독으로 쓸 때는 필요 없습니다.
 */
const CACHE = 'china-trip-2026-v1';
const PAGES = ['./', './index.html', './china_trip_manager_2026.html', './china_trip_manager_2026_galaxy.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(PAGES.map((url) =>
        fetch(url, { cache: 'reload' })
          .then((res) => (res.ok ? cache.put(url, res) : null))
          .catch(() => null)
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 페이지가 자기 주소를 알려주면 바로 저장 (처음 연 화면도 오프라인 대비)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'CACHE_PAGE' || !data.url) return;
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => fetch(data.url, { cache: 'reload' }).then((res) => (res.ok ? cache.put(data.url, res) : null)))
      .catch(() => null)
  );
});

const OFFLINE_HTML = '<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<body style="font-family:-apple-system,sans-serif;padding:32px;color:#0f172a"><h2>오프라인 상태입니다</h2>' +
  '<p>처음 한 번은 인터넷이 연결된 상태에서 열어 주세요.</p></body>';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 저장본 먼저 → 뒤에서 최신본 갱신 (만리방화벽·느린 로밍에서도 즉시 열림)
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  event.waitUntil(network.then(() => undefined));

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return network.then((res) => res || (req.mode === 'navigate'
        ? new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
        : Response.error()));
    })
  );
});
