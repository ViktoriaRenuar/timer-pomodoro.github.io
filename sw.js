// Service Worker для Focus Timer PWA
const CACHE_NAME = 'focus-timer-v6';

// Функции для работы с IndexedDB в SW
let db = null;

// Открываем базу данных
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('FocusTimerDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('timerState')) {
                db.createObjectStore('timerState', { keyPath: 'id' });
            }
        };
    });
}

// Сохраняем состояние таймера
async function saveTimerState(endTime, mode) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['timerState'], 'readwrite');
        const store = transaction.objectStore('timerState');
        const request = store.put({ id: 'current', endTime, mode });
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

// Загружаем состояние таймера
async function loadTimerState() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['timerState'], 'readonly');
        const store = transaction.objectStore('timerState');
        const request = store.get('current');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Удаляем состояние
async function clearTimerState() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['timerState'], 'readwrite');
        const store = transaction.objectStore('timerState');
        const request = store.delete('current');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

let checkInterval = null;

// Запуск периодической проверки
async function startTimerCheck() {
    if (checkInterval) return;
    
    // Проверяем сохранённое состояние при запуске SW
    const savedState = await loadTimerState();
    if (savedState && savedState.endTime > Date.now()) {
        console.log('Found saved timer:', savedState);
        scheduleNotification(savedState.endTime, savedState.mode);
    }
    
    checkInterval = setInterval(async () => {
        const state = await loadTimerState();
        if (state && state.endTime) {
            const now = Date.now();
            const timeLeft = state.endTime - now;
            
            if (timeLeft <= 0) {
                // Время вышло!
                console.log('Timer expired! Showing notification...');
                
                const isFocusMode = (state.mode === 'focus');
                const title = isFocusMode ? '🍅 Время вышло!' : '☕ Перерыв окончен!';
                const body = isFocusMode 
                    ? 'Отличная работа! Время сделать перерыв!' 
                    : 'Перерыв окончен! Возвращайся к работе!';
                
                await self.registration.showNotification(title, {
                    body: body,
                    icon: 'icons/icon-192x192.png',
                    badge: 'icons/icon-192x192.png',
                    vibrate: [200, 100, 200, 100, 200],
                    requireInteraction: true,
                    tag: 'timer-expired',
                    data: {
                        mode: state.mode,
                        timestamp: Date.now()
                    }
                });
                
                await clearTimerState();
            }
        }
    }, 1000);
}

// Запланировать уведомление
async function scheduleNotification(endTime, mode) {
    const delay = endTime - Date.now();
    console.log(`Scheduling notification in ${Math.floor(delay / 1000)} seconds`);
    
    if (delay <= 0) return;
    
    // Сохраняем в IndexedDB
    await saveTimerState(endTime, mode);
}

// Получение сообщений от приложения
self.addEventListener('message', async (event) => {
    console.log('SW received message:', event.data);
    
    if (event.data.type === 'START_TIMER') {
        // Сохраняем в IndexedDB
        await scheduleNotification(event.data.endTime, event.data.mode);
        await startTimerCheck();
        console.log(`Timer scheduled for ${event.data.mode} until:`, new Date(event.data.endTime));
    }
    
    if (event.data.type === 'STOP_TIMER') {
        await clearTimerState();
        console.log('Timer stopped and cleared');
    }
});

// Установка Service Worker
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

// Активация
self.addEventListener('activate', async (event) => {
    console.log('Service Worker activating...');
    
    // При активации запускаем проверку
    event.waitUntil(
        (async () => {
            // Очищаем старые кеши
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
            
            // Запускаем проверку таймера
            await startTimerCheck();
            self.clients.claim();
        })()
    );
});

// Обработка fetch запросов (офлайн режим)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);
    event.notification.close();
    
    const mode = event.notification.data?.mode;
    const targetUrl = '/timer-pomodoro.github.io/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                for (let client of windowClients) {
                    if (client.url.includes('timer-pomodoro') && 'focus' in client) {
                        client.postMessage({
                            type: 'NOTIFICATION_CLICKED',
                            mode: mode
                        });
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});
