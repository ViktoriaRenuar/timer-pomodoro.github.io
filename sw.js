// Service Worker для Focus Timer PWA
const CACHE_NAME = 'focus-timer-v5';

// Хранилище для времени окончания таймера
let timerEndTime = null;
let currentMode = null;
let checkInterval = null;

// Получение сообщений от приложения
self.addEventListener('message', event => {
    console.log('SW received message:', event.data);
    
    if (event.data.type === 'START_TIMER') {
        // Сохраняем время окончания и режим
        timerEndTime = event.data.endTime;
        currentMode = event.data.mode;
        console.log(`Timer set for ${currentMode} until:`, new Date(timerEndTime));
        
        // Запускаем проверку если ещё не запущена
        if (!checkInterval) {
            startTimerCheck();
        }
    }
    
    if (event.data.type === 'STOP_TIMER') {
        timerEndTime = null;
        currentMode = null;
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
        console.log('Timer stopped');
    }
});

// Запуск периодической проверки
function startTimerCheck() {
    checkInterval = setInterval(() => {
        if (timerEndTime) {
            const now = Date.now();
            const timeLeft = timerEndTime - now;
            
            if (timeLeft <= 0) {
                // Время вышло!
                console.log('Timer expired! Showing notification...');
                
                const isFocusMode = (currentMode === 'focus');
                const title = isFocusMode ? '🍅 Время вышло!' : '☕ Перерыв окончен!';
                const body = isFocusMode 
                    ? 'Отличная работа! Время сделать перерыв!' 
                    : 'Перерыв окончен! Возвращайся к работе!';
                
                // Показываем уведомление
                self.registration.showNotification(title, {
                    body: body,
                    icon: 'icons/icon-192x192.png',
                    badge: 'icons/icon-192x192.png',
                    vibrate: [200, 100, 200, 100, 200],
                    requireInteraction: true,
                    tag: 'timer-expired',
                    data: {
                        mode: currentMode,
                        timestamp: Date.now()
                    }
                });
                
                timerEndTime = null;
                currentMode = null;
                clearInterval(checkInterval);
                checkInterval = null;
            } else if (timeLeft <= 5000 && timeLeft > 0) {
                // За 5 секунд до окончания отправляем предупреждение
                console.log('Warning: 5 seconds left');
                self.registration.showNotification('⏰ Скоро закончится!', {
                    body: `Осталось ${Math.ceil(timeLeft / 1000)} секунд`,
                    icon: 'icons/icon-192x192.png',
                    badge: 'icons/icon-192x192.png',
                    vibrate: [100],
                    tag: 'timer-warning'
                });
            }
        }
    }, 1000);
}

// Установка Service Worker и кеширование файлов
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Opened cache');
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

// Активация и очистка старых кешей
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

// Обработка fetch запросов (офлайн режим)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    response => {
                        if (!response || response.status !== 200) {
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

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();
    
    const mode = event.notification.data?.mode;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                const targetUrl = '/timer-pomodoro.github.io/';
                
                // Если окно уже открыто, фокусируем его
                for (let client of windowClients) {
                    if (client.url.includes('timer-pomodoro') && 'focus' in client) {
                        // Отправляем информацию о том, какой режим был
                        client.postMessage({
                            type: 'NOTIFICATION_CLICKED',
                            mode: mode
                        });
                        return client.focus();
                    }
                }
                // Иначе открываем новое окно
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});
