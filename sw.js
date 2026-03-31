// Service Worker äëÿ Focus Timer PWA

const CACHE_NAME = 'focus-timer-v1';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

// Óñòàíîâêà Service Worker è êåøèðîâàíèå ôàéëîâ
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Cache addAll failed:', error);
            })
    );
    self.skipWaiting();
});

// Àêòèâàöèÿ è î÷èñòêà ñòàðûõ êåøåé
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Îáðàáîòêà fetch çàïðîñîâ (îôëàéí ðåæèì)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    response => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    }
                );
            })
    );
});

// Îáðàáîòêà push óâåäîìëåíèé
self.addEventListener('push', event => {
    let data = {
        title: 'Focus Timer',
        body: 'Âðåìÿ âûøëî!',
        icon: '/pwa/icons/icon-192x192.png'
    };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: '/pwa/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/pwa/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Îáðàáîòêà êëèêà ïî óâåäîìëåíèþ
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url === '/' && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Îáðàáîòêà ñîîáùåíèé îò îñíîâíîãî ïîòîêà
self.addEventListener('message', event => {
    console.log('Message received in SW:', event.data);
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: event.data.icon || '/pwa/icons/icon-192x192.png',
            badge: '/pwa/icons/icon-72x72.png',
            vibrate: [200, 100, 200]
        }).catch(error => {
            console.error('Failed to show notification:', error);
        });
    }
});
