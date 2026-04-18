// Focus Timer PWA - Основной скрипт (с работающими локальными уведомлениями)

class FocusTimer {
    constructor() {
        this.timer = null;
        this.timeLeft = 25 * 60;
        this.isRunning = false;
        this.currentMode = 'focus';
        this.sessionsCompleted = 0;
        this.totalFocusMinutes = 0;
        this.history = [];
        this.timerEndTime = null;
        
        this.notificationsEnabled = true;
        this.soundEnabled = true;
        this.audioContext = null;
        
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
        this.initAudio();
        await this.syncTimerOnOpen();
        
        // Запускаем синхронизацию каждую секунду
        this.startSyncInterval();
    }
    
    // Синхронизация времени каждую секунду
    startSyncInterval() {
        setInterval(() => {
            if (this.isRunning && this.timerEndTime) {
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((this.timerEndTime - now) / 1000));
                
                if (Math.abs(remaining - this.timeLeft) > 1) {
                    console.log(`Sync: was ${this.timeLeft}s, now ${remaining}s`);
                    this.timeLeft = remaining;
                    this.updateDisplay();
                    
                    if (this.timeLeft <= 0) {
                        this.timeUp();
                    }
                }
            }
        }, 1000);
    }
    
    async syncTimerOnOpen() {
        const savedEndTime = localStorage.getItem('timerEndTime');
        const savedMode = localStorage.getItem('timerMode');
        
        if (savedEndTime && savedMode) {
            const now = Date.now();
            const endTime = parseInt(savedEndTime);
            const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
            
            if (timeLeft > 0 && timeLeft <= this.modes[savedMode].time) {
                this.currentMode = savedMode;
                this.timeLeft = timeLeft;
                this.timerEndTime = endTime;
                this.updateDisplay();
                
                document.querySelectorAll('.mode-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.dataset.mode === savedMode) {
                        btn.classList.add('active');
                    }
                });
                
                if (!this.isRunning) {
                    this.start();
                }
            } else if (timeLeft <= 0) {
                localStorage.removeItem('timerEndTime');
                localStorage.removeItem('timerMode');
                
                if (savedMode === 'focus') {
                    this.switchMode('shortBreak');
                } else {
                    this.switchMode('focus');
                }
            }
        }
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
        
        const testSoundBtn = document.getElementById('testSoundBtn');
        if (testSoundBtn) {
            testSoundBtn.addEventListener('click', () => {
                this.playSoundEnhanced();
            });
        }
    }
    
    initAudio() {
        const initAudioContext = () => {
            if (!this.audioContext && window.AudioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('AudioContext initialized');
                
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
        
        document.addEventListener('click', initAudioContext);
        document.addEventListener('touchstart', initAudioContext);
    }
    
    switchMode(mode) {
        if (this.isRunning) {
            this.pause();
        }
        
        this.currentMode = mode;
        this.timeLeft = this.modes[mode].time;
        
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
        
        this.timerEndTime = Date.now() + (this.timeLeft * 1000);
        
        localStorage.setItem('timerEndTime', this.timerEndTime);
        localStorage.setItem('timerMode', this.currentMode);
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'START_TIMER',
                endTime: this.timerEndTime,
                mode: this.currentMode
            });
        }
        
        // Локальный таймер для обновления интерфейса
        this.timer = setInterval(() => {
            if (this.timerEndTime) {
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((this.timerEndTime - now) / 1000));
                
                if (remaining !== this.timeLeft) {
                    this.timeLeft = remaining;
                    this.updateDisplay();
                }
                
                if (remaining <= 0) {
                    this.timeUp();
                }
            }
        }, 100);
    }
    
    pause() {
        if (!this.isRunning) return;
        
        clearInterval(this.timer);
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.pauseBtn.disabled = true;
        
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'STOP_TIMER'
            });
        }
        
        localStorage.removeItem('timerEndTime');
        localStorage.removeItem('timerMode');
    }
    
    reset() {
        this.pause();
        this.timeLeft = this.modes[this.currentMode].time;
        this.timerEndTime = null;
        this.updateDisplay();
        this.saveData();
    }
    
    async timeUp() {
        this.pause();
        
        const isFocusMode = (this.currentMode === 'focus');
        
        // Сохраняем завершенную сессию (только для фокуса)
        if (isFocusMode) {
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
        
        // 🔔 ЛОКАЛЬНОЕ УВЕДОМЛЕНИЕ — ВОТ ЭТОТ КОД ВОЗВРАЩАЕМ!
        if (this.notificationsEnabled) {
            const title = isFocusMode ? '🍅 Время вышло!' : '☕ Перерыв окончен!';
            const body = isFocusMode 
                ? 'Отличная работа! Время сделать перерыв 🎉' 
                : 'Пора возвращаться к работе! 💪';
            
            // Показываем уведомление через Service Worker (лучше работает)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: title,
                    body: body,
                    icon: 'icons/icon-192x192.png'
                });
            } 
            // Запасной вариант — обычное уведомление
            else if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, { 
                    body: body, 
                    icon: 'icons/icon-192x192.png' 
                });
            }
        }
        
        // Воспроизводим звук
        if (this.soundEnabled) {
            await this.playSoundEnhanced();
        }
        
        this.saveData();
        
        localStorage.removeItem('timerEndTime');
        localStorage.removeItem('timerMode');
        
        // Автоматически переключаем на следующий режим
        if (isFocusMode) {
            this.switchMode('shortBreak');
        } else {
            this.switchMode('focus');
        }
    }
    
    async playSoundEnhanced() {
        const webAudioSuccess = await this.playWebAudioBeep();
        if (webAudioSuccess) {
            console.log('Sound played via Web Audio API');
            return;
        }
        
        const htmlAudioSuccess = await this.playHtmlAudio();
        if (htmlAudioSuccess) {
            console.log('Sound played via HTML5 Audio');
            return;
        }
    }
    
    async playWebAudioBeep() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const now = this.audioContext.currentTime;
            
            for (let i = 0; i < 3; i++) {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                const frequencies = [880, 1046.5, 1318.5];
                oscillator.frequency.value = frequencies[i % frequencies.length];
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;
                
                const startTime = now + i * 0.25;
                oscillator.start(startTime);
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
            'https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3',
            'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c8c8f0f6c4.mp3'
        ];
        
        for (const url of audioUrls) {
            try {
                const audio = new Audio();
                audio.src = url;
                audio.volume = 0.5;
                audio.load();
                
                await new Promise((resolve, reject) => {
                    audio.addEventListener('canplaythrough', () => {
                        audio.play().then(resolve).catch(reject);
                    }, { once: true });
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
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        this.modeLabel.textContent = this.modes[this.currentMode].label;
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
    
    async requestNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Notification permission granted');
            } else {
                console.warn('❌ Notification permission denied');
            }
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js', {
                    scope: '.'
                });
                console.log('✅ Service Worker registered:', registration);
            } catch (error) {
                console.error('❌ Service Worker registration failed:', error);
            }
        }
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

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FocusTimer();
});
