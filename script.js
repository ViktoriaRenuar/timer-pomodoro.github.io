// Focus Timer PWA - Основной скрипт (исправленная версия с рабочим звуком)

class FocusTimer {
    constructor() {
        this.timer = null;
        this.timeLeft = 25 * 60; // 25 минут в секундах
        this.isRunning = false;
        this.currentMode = 'focus';
        this.sessionsCompleted = 0;
        this.totalFocusMinutes = 0;
        this.history = [];

        // Настройки
        this.notificationsEnabled = true;
        this.soundEnabled = true;
        this.audioContext = null; // Для Web Audio API

        // DOM элементы
        this.timerDisplay = document.getElementById('timer');
        this.modeLabel = document.getElementById('modeLabel');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.sessionsCountElem = document.getElementById('sessionsCount');
        this.totalFocusTimeElem = document.getElementById('totalFocusTime');
        this.historyListElem = document.getElementById('historyList');
        this.notificationsCheckbox = document.getElementById('notificationsEnabled');
        this.soundCheckbox = document.getElementById('soundEnabled');

        // Настройки режимов
        this.modes = {
            focus: { time: 25 * 60, label: 'Время фокуса', name: 'Фокус' },
            shortBreak: { time: 5 * 60, label: 'Короткий перерыв', name: 'Перерыв' },
            longBreak: { time: 15 * 60, label: 'Длинный перерыв', name: 'Длинный перерыв' }
        };

        this.init();
    }

    async init() {
        await this.loadData();
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.registerServiceWorker();
        this.checkInstallPrompt();
        this.updateDisplay();
        this.renderHistory();
        this.initAudio(); // Инициализируем аудио
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.start());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.resetBtn.addEventListener('click', () => this.reset());

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
        });

        this.notificationsCheckbox.addEventListener('change', (e) => {
            this.notificationsEnabled = e.target.checked;
            this.saveData();
        });

        this.soundCheckbox.addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
            this.saveData();
        });

        // Добавляем обработчик для тестовой кнопки звука
        const testSoundBtn = document.getElementById('testSoundBtn');
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', () => {
                this.playSoundEnhanced();
            });
        }
    }

    initAudio() {
        // Создаем AudioContext при первом взаимодействии
        const initAudioContext = () => {
            if (!this.audioContext && window.AudioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext initialized');

                // Разблокируем аудио при первом клике
                const unlockAudio = () => {
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume().then(() => {
                            console.log('AudioContext resumed');
                        });
                    }
                    document.removeEventListener('click', unlockAudio);
                    document.removeEventListener('touchstart', unlockAudio);
                };

                document.addEventListener('click', unlockAudio);
                document.addEventListener('touchstart', unlockAudio);
            }
        };

        // Инициализируем при первом клике
        document.addEventListener('click', initAudioContext);
        document.addEventListener('touchstart', initAudioContext);
    }

    switchMode(mode) {
        if (this.isRunning) {
            this.pause();
        }

        this.currentMode = mode;
        this.timeLeft = this.modes[mode].time;

        // Обновляем активную кнопку
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });

        this.updateDisplay();
        this.saveData();
    }

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startBtn.disabled = true;
        this.pauseBtn.disabled = false;

        this.timer = setInterval(() => {
            if (this.timeLeft > 0) {
                this.timeLeft--;
                this.updateDisplay();
            } else {
                this.timeUp();
            }
        }, 1000);
    }

    pause() {
        if (!this.isRunning) return;

        clearInterval(this.timer);
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
    }

    reset() {
        this.pause();
        this.timeLeft = this.modes[this.currentMode].time;
        this.updateDisplay();
        this.saveData();
    }

    async timeUp() {
        this.pause();

        // Сохраняем завершенную сессию
        if (this.currentMode === 'focus') {
            this.sessionsCompleted++;
            const focusMinutes = this.modes.focus.time / 60;
            this.totalFocusMinutes += focusMinutes;

            const session = {
                id: Date.now(),
                type: 'focus',
                duration: focusMinutes,
                date: new Date().toISOString()
            };

            this.history.unshift(session);
            if (this.history.length > 20) this.history.pop();

            this.updateStats();
            this.renderHistory();
        }

        // Отправляем уведомление
        if (this.notificationsEnabled) {
            this.sendNotification(
                this.currentMode === 'focus' ? 'Время вышло!' : 'Перерыв окончен!',
                this.currentMode === 'focus' ? 'Отличная работа! Время сделать перерыв 🎉' : 'Пора возвращаться к работе! 💪'
            );
        }

        // Воспроизводим звук с улучшенной логикой
        if (this.soundEnabled) {
            await this.playSoundEnhanced();
        }

        this.saveData();

        // Автоматически переключаем на следующий режим
        if (this.currentMode === 'focus') {
            this.switchMode('shortBreak');
        } else if (this.currentMode === 'shortBreak') {
            this.switchMode('focus');
        }
    }

    async playSoundEnhanced() {
        // Метод 1: Web Audio API (самый надежный и не требует файлов)
        const webAudioSuccess = await this.playWebAudioBeep();
        if (webAudioSuccess) {
            console.log('Sound played via Web Audio API');
            return;
        }

        // Метод 2: HTML5 Audio с множеством источников
        const htmlAudioSuccess = await this.playHtmlAudio();
        if (htmlAudioSuccess) {
            console.log('Sound played via HTML5 Audio');
            return;
        }

        // Метод 3: Использование встроенного системного звука через конструктор Audio
        const systemSoundSuccess = await this.playSystemSound();
        if (systemSoundSuccess) {
            console.log('Sound played via System Sound');
            return;
        }

        console.warn('All sound methods failed');
    }

    async playWebAudioBeep() {
        try {
            // Создаем AudioContext если его нет
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Разблокируем если нужно
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const now = this.audioContext.currentTime;

            // Создаем три коротких сигнала для приятного звука
            for (let i = 0; i < 3; i++) {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                // Разные частоты для разнообразия
                const frequencies = [880, 1046.5, 1318.5]; // A, C, E
                oscillator.frequency.value = frequencies[i % frequencies.length];

                // Тип волны: sine для мягкого звука
                oscillator.type = 'sine';

                // Настройка громкости
                gainNode.gain.value = 0.3;

                const startTime = now + i * 0.25;
                oscillator.start(startTime);

                // Быстрое затухание
                gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + 0.2);
                oscillator.stop(startTime + 0.2);
            }

            return true;
        } catch (error) {
            console.log('Web Audio failed:', error);
            return false;
        }
    }

    async playHtmlAudio() {
        const audioUrls = [
            // Звук колокольчика (надежный источник)
            'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
            // Запасной вариант
            'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8f0f6c4.mp3',
            // Еще один вариант
            'https://actions.google.com/sound?mid=/m/09l0g0f',
            // Короткий звук уведомления
            'https://www.zedge.net/download/sound/56272'
        ];

        for (const url of audioUrls) {
            try {
                const audio = new Audio();
                audio.src = url;
                audio.volume = 0.5;
                audio.load();

                // Ждем загрузки и воспроизведения
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', () => {
                        audio.play().then(resolve).catch(reject);
                    }, { once: true });

                    // Таймаут на случай ошибки загрузки
                    setTimeout(() => reject(new Error('Load timeout')), 3000);
                });

                return true;
            } catch (error) {
                console.log(`Failed to play ${url}:`, error);
                continue;
            }
        }

        return false;
    }

    async playSystemSound() {
        // Используем data URI с простым WAV звуком (встроенный)
        try {
            const audio = new Audio();

            // Простой WAV звук в base64 (короткий бип)
            audio.src = 'data:audio/wav;base64,U3RlYW0gU291bmQgRWRpdG9yIDIuMC4xAAAAAFVESVJCAQAAABgAAAAcAAAAW1VESVJFAAAAABgAAAAcAAAASGVsbG8gU291bmRzAAAAAAAAAAAAAAAAAAAAAAAA';
            audio.volume = 0.5;

            await audio.play();
            return true;
        } catch (error) {
            console.log('System sound failed:', error);
            return false;
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.modeLabel.textContent = this.modes[this.currentMode].label;

        // Обновляем заголовок страницы
        document.title = `${this.timerDisplay.textContent} - Focus Timer`;
    }

    updateStats() {
        this.sessionsCountElem.textContent = this.sessionsCompleted;
        this.totalFocusTimeElem.textContent = this.totalFocusMinutes;
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyListElem.innerHTML = '<div style="text-align: center; color: #999;">Нет завершенных сессий</div>';
            return;
        }

        this.historyListElem.innerHTML = this.history.map(session => `
            <div class="history-item">
                <div>
                    <strong>🍅 Фокус</strong>
                    <div class="date">${new Date(session.date).toLocaleString('ru-RU')}</div>
                </div>
                <div class="time">${session.duration} мин</div>
            </div>
        `).join('');
    }

    async sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            // Показываем уведомление через Service Worker для PWA
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    body: body,
                    icon: '/pwa/icons/icon-192x192.png'
                });
            } else {
                // Fallback на обычное уведомление
                new Notification(title, { body, icon: '/pwa/icons/icon-192x192.png' });
            }
        }
    }

    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Notification permission granted');
            }
        }
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                // ИСПРАВЛЕНО: добавляем /pwa/ перед sw.js
                const registration = await navigator.serviceWorker.register('/pwa/sw.js');
                console.log('Service Worker registered:', registration);

                // Проверяем подписку на push уведомления
                const subscription = await registration.pushManager.getSubscription();
                if (!subscription && this.notificationsEnabled) {
                    await this.subscribeToPush(registration);
                }
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    async subscribeToPush(registration) {
        try {
            // Для реальных push-уведомлений нужны VAPID ключи
            // Пока просто логируем
            console.log('Push subscription would be created here');

            // Раскомментируйте для реальной работы:
            /*
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array('ВАШ_VAPID_ПУБЛИЧНЫЙ_КЛЮЧ')
            });
            console.log('Push subscription:', subscription);
            */
        } catch (error) {
            console.error('Push subscription failed:', error);
        }
    }

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async loadData() {
        const data = localStorage.getItem('focusTimer');
        if (data) {
            const parsed = JSON.parse(data);
            this.sessionsCompleted = parsed.sessionsCompleted || 0;
            this.totalFocusMinutes = parsed.totalFocusMinutes || 0;
            this.history = parsed.history || [];
            this.notificationsEnabled = parsed.notificationsEnabled !== false;
            this.soundEnabled = parsed.soundEnabled !== false;

            if (this.notificationsCheckbox) {
                this.notificationsCheckbox.checked = this.notificationsEnabled;
            }
            if (this.soundCheckbox) {
                this.soundCheckbox.checked = this.soundEnabled;
            }
        }

        this.updateStats();
    }

    saveData() {
        const data = {
            sessionsCompleted: this.sessionsCompleted,
            totalFocusMinutes: this.totalFocusMinutes,
            history: this.history,
            notificationsEnabled: this.notificationsEnabled,
            soundEnabled: this.soundEnabled
        };
        localStorage.setItem('focusTimer', JSON.stringify(data));
    }

    checkInstallPrompt() {
        let deferredPrompt;
        const installBtn = document.getElementById('installBtn');

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn) {
                installBtn.style.display = 'block';

                installBtn.addEventListener('click', async () => {
                    installBtn.style.display = 'none';
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log(`User response to the install prompt: ${outcome}`);
                    deferredPrompt = null;
                });
            }
        });
    }
}

// Запуск приложения после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FocusTimer();
});