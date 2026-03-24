self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.error('[Service Worker] Push data parsing failed:', e);
    data = {
      title: '새로운 알림',
      body: '알림 데이터를 해독하는 데 실패했습니다. (암호화 오류 가능성)',
      url: '/'
    };
  }

  const options = {
    body: data.body || '내용이 없습니다.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '알림', options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
