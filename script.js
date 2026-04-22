// Focus Timer PWA - Основной скрипт (работающие уведомления на ПК и телефоне)

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
        await this.registerServiceWorker();
        this.checkInstallPrompt();
        this.updateDisplay();
        this.renderHistory();
        this.initAudio();
        await this.syncTimerOnOpen();
        this.startSyncInterval();
    }
    
    startSyncInterval() {
        setInterval(() => {
            if (this.isRunning && this.timerEndTime) {
                const now = Date.now();
                const remaining = Math.max(0, Math.floor((this.timerEndTime - now) / 1000));
                
                if (Math.abs(remaining - this.timeLeft) > 1) {
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
        
        // Отправляем в Service Worker (через ready)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'START_TIMER',
                        endTime: this.timerEndTime,
                        mode: this.currentMode
                    });
                    console.log('✅ START_TIMER sent to SW');
                }
            });
        }
        
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
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                if (registration.active) {
                    registration.active.postMessage({ type: 'STOP_TIMER' });
                    console.log('✅ STOP_TIMER sent to SW');
                }
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
        
        // 🔔 ОТПРАВКА УВЕДОМЛЕНИЯ (работает на ПК и телефоне)
        if (this.notificationsEnabled) {
            const title = isFocusMode ? '🍅 Время вышло!' : '☕ Перерыв окончен!';
            const body = isFocusMode 
                ? 'Отличная работа! Время сделать перерыв 🎉' 
                : 'Пора возвращаться к работе! 💪';
            
            // Способ 1: Через Service Worker
            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.ready;
                if (registration.active) {
                    registration.active.postMessage({
                        type: 'SHOW_NOTIFICATION',
                        title: title,
                        body: body,
                        icon: 'icons/icon-192x192.png'
                    });
                    console.log('✅ Notification sent to SW');
                } else {
                    console.log('⚠️ SW not active, using fallback');
                    this.showFallbackNotification(title, body);
                }
            } 
            // Способ 2: Запасной вариант
            else {
                this.showFallbackNotification(title, body);
            }
        }
        
        if (this.soundEnabled) {
            await this.playSoundEnhanced();
        }
        
        this.saveData();
        
        localStorage.removeItem('timerEndTime');
        localStorage.removeItem('timerMode');
        
        if (isFocusMode) {
            this.switchMode('shortBreak');
        } else {
            this.switchMode('focus');
        }
    }
    
    showFallbackNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { 
                body: body, 
                icon: 'icons/icon-192x192.png'
            });
            console.log('✅ Fallback notification shown');
        }
    }
    
    async playSoundEnhanced() {
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
                oscillator.frequency.value = [880, 1046.5, 1318.5][i % 3];
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;
                const startTime = now + i * 0.25;
                oscillator.start(startTime);
                gainNode.gain.exponentialRampToValueAtTime(0.00001, startTime + 0.2);
                oscillator.stop(startTime + 0.2);
            }
            console.log('✅ Sound played');
        } catch (error) {
            console.log('Sound failed:', error);
        }
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
            console.log('Notification permission:', permission);
            this.notificationsEnabled = (permission === 'granted');
            if (this.notificationsCheckbox) {
                this.notificationsCheckbox.checked = this.notificationsEnabled;
            }
        }
    }
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('sw.js', { scope: '.' });
                console.log('✅ Service Worker registered');
                
                // Ждём активации
                if (!navigator.serviceWorker.controller) {
                    await new Promise(resolve => {
                        const checkInterval = setInterval(() => {
                            if (navigator.serviceWorker.controller) {
                                clearInterval(checkInterval);
                                resolve();
                            }
                        }, 100);
                    });
                    console.log('✅ SW now active');
                }
            } catch (error) {
                console.error('❌ SW registration failed:', error);
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
            
            if (this.notificationsCheckbox) this.notificationsCheckbox.checked = this.notificationsEnabled;
            if (this.soundCheckbox) this.soundCheckbox.checked = this.soundEnabled;
        }
        this.updateStats();
    }
    
    saveData() {
        localStorage.setItem('focusTimer', JSON.stringify({
            sessionsCompleted: this.sessionsCompleted,
            totalFocusMinutes: this.totalFocusMinutes,
            history: this.history,
            notificationsEnabled: this.notificationsEnabled,
            soundEnabled: this.soundEnabled
        }));
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
                    await deferredPrompt.userChoice;
                    deferredPrompt = null;
                });
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new FocusTimer();
});
