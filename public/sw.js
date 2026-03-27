const CACHE_NAME = 'scparking-v1';
const STATIC_EXTENSIONS = ['.js', '.css', '.woff2', '.woff', '.ttf', '.png', '.jpg', '.svg', '.ico'];

// 정적 자산 캐시 (cache-first)
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);
  const isStatic = STATIC_EXTENSIONS.some(ext => url.pathname.endsWith(ext))
    || url.pathname.startsWith('/_next/static/');

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});

self.addEventListener('push', function(event) {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    data = { title: '새로운 알림', body: '알림이 도착했습니다.', url: '/' };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '알림', {
      body: data.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // 이미 열린 창이 있으면 해당 URL로 이동 후 포커스
      for (const client of clientList) {
        if ('navigate' in client) {
          return client.navigate(targetUrl).then(c => c && c.focus());
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
