// Service Worker для Focus Timer PWA
const CACHE_NAME = 'focus-timer-v6';

// Установка Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
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

// Активация
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Обработка fetch для офлайн-режима
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// 🆕 Обработка сообщений от приложения (для уведомлений)
self.addEventListener('message', event => {
    console.log('SW received message:', event.data);
    
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon || 'icons/icon-192x192.png',
            badge: 'icons/icon-192x192.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: 'focus-timer'
        });
    }
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                const targetUrl = '/timer-pomodoro.github.io/';
                
                for (let client of windowClients) {
                    if (client.url.includes('timer-pomodoro') && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});
