// Service Worker для Focus Timer PWA
const CACHE_NAME = 'focus-timer-v7';

self.addEventListener('install', event => {
    console.log('🔧 SW installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '.',
                'index.html',
                'style.css',
                'script.js',
                'manifest.json',
                'icons/icon-192x192.png',
                'icons/icon-512x512.png'
            ]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('🔧 SW activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
    console.log('✅ SW activated');
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});

// 🆕 Обработка сообщений от приложения
self.addEventListener('message', event => {
    console.log('📨 SW received:', event.data);
    
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon || 'icons/icon-192x192.png',
            badge: 'icons/icon-192x192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            silent: false,
            tag: 'focus-timer-' + Date.now()
        }).then(() => console.log('✅ Notification shown')).catch(err => console.error('❌ Notification error:', err));
    }
    
    if (event.data.type === 'START_TIMER') {
        console.log('⏰ Timer scheduled:', new Date(event.data.endTime));
    }
    
    if (event.data.type === 'STOP_TIMER') {
        console.log('⏹️ Timer stopped');
    }
});

self.addEventListener('notificationclick', event => {
    console.log('👆 Notification clicked');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url.includes('timer-pomodoro') && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/timer-pomodoro.github.io/');
        })
    );
});
