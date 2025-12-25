// Norwegian 4x4 Timer App

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    // Play a beep sound
    playBeep(frequency = 440, duration = 0.15, type = 'sine') {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }

    // Start countdown ticks - accelerating beeps for last 10 seconds
    startCountdownTicks(secondsRemaining) {
        this.stopCountdownTicks();

        if (secondsRemaining <= 0 || secondsRemaining > 10) return;

        // Calculate interval: starts slow (500ms) and gets faster as time runs out
        // At 10s: 500ms, at 5s: 300ms, at 2s: 150ms
        const getInterval = (secs) => {
            if (secs <= 2) return 150;
            if (secs <= 5) return 300;
            return 500;
        };

        const tick = () => {
            if (!this.countdownActive) return;

            // Pitch increases as time decreases (600Hz at 10s, up to 900Hz at 1s)
            const pitch = 600 + (10 - secondsRemaining) * 30;
            this.playBeep(pitch, 0.06, 'sine');
        };

        this.countdownActive = true;
        this.countdownSecondsRemaining = secondsRemaining;
        tick(); // Play immediately

        this.countdownIntervalId = setInterval(() => {
            if (!this.countdownActive) {
                this.stopCountdownTicks();
                return;
            }
            tick();
        }, getInterval(secondsRemaining));
    }

    // Update the tick rate as seconds decrease
    updateCountdownTicks(secondsRemaining) {
        if (!this.countdownActive || secondsRemaining <= 0) {
            this.stopCountdownTicks();
            return;
        }

        // Only restart interval if seconds changed
        if (secondsRemaining !== this.countdownSecondsRemaining) {
            this.countdownSecondsRemaining = secondsRemaining;
            this.startCountdownTicks(secondsRemaining);
        }
    }

    stopCountdownTicks() {
        this.countdownActive = false;
        if (this.countdownIntervalId) {
            clearInterval(this.countdownIntervalId);
            this.countdownIntervalId = null;
        }
    }

    // Countdown beeps - last 3 seconds (now handled by tick system)
    playCountdownBeep() {
        this.playBeep(880, 0.08, 'sine');
    }

    // Phase change - different sounds for high intensity vs recovery
    playPhaseChange(isHighIntensity) {
        if (!this.audioContext) return;

        if (isHighIntensity) {
            // Energetic ascending tone for high intensity
            this.playBeep(523, 0.15, 'square'); // C5
            setTimeout(() => this.playBeep(659, 0.15, 'square'), 150); // E5
            setTimeout(() => this.playBeep(784, 0.2, 'square'), 300); // G5
        } else {
            // Calming descending tone for recovery/cooldown
            this.playBeep(784, 0.15, 'sine'); // G5
            setTimeout(() => this.playBeep(659, 0.15, 'sine'), 150); // E5
            setTimeout(() => this.playBeep(523, 0.2, 'sine'), 300); // C5
        }
    }

    // Workout complete celebration
    playComplete() {
        if (!this.audioContext) return;

        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playBeep(freq, 0.2, 'sine'), i * 150);
        });
    }
}

class Timer {
    constructor() {
        this.STORAGE_KEY = 'norwegian-4x4-settings';

        // Default settings (in minutes for display)
        this.defaultSettings = {
            warmup: 5,
            highIntensity: 4,
            recovery: 3,
            cooldown: 5,
            intervals: 4
        };

        this.phases = [];
        this.currentPhaseIndex = 0;
        this.phaseTimeRemaining = 0;
        this.totalElapsed = 0;
        this.totalDuration = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.intervalId = null;
        this.lastTickTime = null;

        this.audio = new AudioManager();
        this.countdownStarted = false;

        this.initElements();
        this.loadSettings();
        this.initEventListeners();
        this.updateTotalTime();
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                const settings = JSON.parse(saved);
                this.warmupInput.value = settings.warmup ?? this.defaultSettings.warmup;
                this.highIntensityInput.value = settings.highIntensity ?? this.defaultSettings.highIntensity;
                this.recoveryInput.value = settings.recovery ?? this.defaultSettings.recovery;
                this.cooldownInput.value = settings.cooldown ?? this.defaultSettings.cooldown;
                this.intervalsInput.value = settings.intervals ?? this.defaultSettings.intervals;
            }
        } catch (e) {
            console.warn('Failed to load settings:', e);
        }
    }

    saveSettings() {
        try {
            const settings = {
                warmup: parseFloat(this.warmupInput.value),
                highIntensity: parseFloat(this.highIntensityInput.value),
                recovery: parseFloat(this.recoveryInput.value),
                cooldown: parseFloat(this.cooldownInput.value),
                intervals: parseInt(this.intervalsInput.value)
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.warn('Failed to save settings:', e);
        }
    }

    initElements() {
        // Settings panel
        this.settingsPanel = document.getElementById('settings-panel');
        this.timerPanel = document.getElementById('timer-panel');
        this.completePanel = document.getElementById('complete-panel');

        // Input elements
        this.warmupInput = document.getElementById('warmup-duration');
        this.highIntensityInput = document.getElementById('high-intensity-duration');
        this.recoveryInput = document.getElementById('recovery-duration');
        this.cooldownInput = document.getElementById('cooldown-duration');
        this.intervalsInput = document.getElementById('intervals');
        this.totalTimeDisplay = document.getElementById('total-time');

        // Timer display elements
        this.phaseIndicator = document.getElementById('phase-indicator');
        this.phaseName = document.getElementById('phase-name');
        this.intervalCounter = document.getElementById('interval-counter');
        this.phaseTimeDisplay = document.getElementById('phase-time');
        this.phaseProgress = document.getElementById('phase-progress');
        this.totalElapsedDisplay = document.getElementById('total-elapsed');
        this.totalRemainingDisplay = document.getElementById('total-remaining');
        this.nextPhaseDisplay = document.getElementById('next-phase');

        // Buttons
        this.startBtn = document.getElementById('start-btn');
        this.pauseBtn = document.getElementById('pause-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.restartBtn = document.getElementById('restart-btn');

        // Complete panel
        this.finalTimeDisplay = document.getElementById('final-time');
    }

    initEventListeners() {
        // Start button
        this.startBtn.addEventListener('click', () => this.start());

        // Pause button
        this.pauseBtn.addEventListener('click', () => this.togglePause());

        // Stop button
        this.stopBtn.addEventListener('click', () => this.stop());

        // Restart button
        this.restartBtn.addEventListener('click', () => this.restart());

        // Adjustment buttons
        document.querySelectorAll('.btn-adjust').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                const delta = parseInt(e.currentTarget.dataset.delta);
                this.adjustValue(targetId, delta);
            });
        });

        // Input changes
        [this.warmupInput, this.highIntensityInput, this.recoveryInput,
         this.cooldownInput, this.intervalsInput].forEach(input => {
            input.addEventListener('change', () => {
                this.updateTotalTime();
                this.saveSettings();
            });
        });

        // Prevent screen from sleeping during workout (where supported)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isRunning && !this.isPaused) {
                // Resync timer when app becomes visible
                this.lastTickTime = Date.now();
            }
        });
    }

    adjustValue(targetId, delta) {
        const select = document.getElementById(targetId);
        const currentIndex = select.selectedIndex;
        const newIndex = Math.max(0, Math.min(select.options.length - 1, currentIndex + (delta > 0 ? 1 : -1)));

        if (newIndex !== currentIndex) {
            select.selectedIndex = newIndex;
            this.updateTotalTime();
            this.saveSettings();
        }
    }

    updateTotalTime() {
        const warmup = parseFloat(this.warmupInput.value) * 60;
        const highIntensity = parseFloat(this.highIntensityInput.value) * 60;
        const recovery = parseFloat(this.recoveryInput.value) * 60;
        const cooldown = parseFloat(this.cooldownInput.value) * 60;
        const intervals = parseInt(this.intervalsInput.value);

        // Recovery only happens between intervals, not after the last one
        const total = warmup + (highIntensity * intervals) + (recovery * (intervals - 1)) + cooldown;
        this.totalTimeDisplay.textContent = this.formatTime(total);
    }

    buildPhases() {
        this.phases = [];

        // Warmup
        const warmup = parseFloat(this.warmupInput.value) * 60;
        if (warmup > 0) {
            this.phases.push({
                type: 'warmup',
                name: 'Warmup',
                duration: warmup,
                isHighIntensity: false
            });
        }

        // Intervals
        const highIntensity = parseFloat(this.highIntensityInput.value) * 60;
        const recovery = parseFloat(this.recoveryInput.value) * 60;
        const intervals = parseInt(this.intervalsInput.value);

        for (let i = 0; i < intervals; i++) {
            this.phases.push({
                type: 'high-intensity',
                name: 'Run',
                interval: i + 1,
                totalIntervals: intervals,
                duration: highIntensity,
                isHighIntensity: true
            });

            // Don't add recovery after last interval
            if (i < intervals - 1) {
                this.phases.push({
                    type: 'recovery',
                    name: 'Walk',
                    interval: i + 1,
                    totalIntervals: intervals - 1,
                    duration: recovery,
                    isHighIntensity: false
                });
            }
        }

        // Cooldown
        const cooldown = parseFloat(this.cooldownInput.value) * 60;
        if (cooldown > 0) {
            this.phases.push({
                type: 'cooldown',
                name: 'Cooldown',
                duration: cooldown,
                isHighIntensity: false
            });
        }

        // Calculate total duration
        this.totalDuration = this.phases.reduce((sum, phase) => sum + phase.duration, 0);
    }

    start() {
        // Initialize audio on user interaction
        this.audio.init();

        this.buildPhases();

        if (this.phases.length === 0) {
            alert('Please set at least one phase duration');
            return;
        }

        this.currentPhaseIndex = 0;
        this.phaseTimeRemaining = this.phases[0].duration;
        this.totalElapsed = 0;
        this.isRunning = true;
        this.isPaused = false;
        this.countdownStarted = false;

        this.showPanel('timer');
        this.updateDisplay();
        this.lastTickTime = Date.now();
        this.intervalId = setInterval(() => this.tick(), 100);

        // Request wake lock if available
        this.requestWakeLock();
    }

    async requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                this.wakeLock = await navigator.wakeLock.request('screen');
            } catch (e) {
                console.log('Wake lock not available:', e);
            }
        }
    }

    releaseWakeLock() {
        if (this.wakeLock) {
            this.wakeLock.release();
            this.wakeLock = null;
        }
    }

    tick() {
        if (!this.isRunning || this.isPaused) return;

        const now = Date.now();
        const delta = (now - this.lastTickTime) / 1000;
        this.lastTickTime = now;

        this.phaseTimeRemaining -= delta;
        this.totalElapsed += delta;

        // Check for audio cues
        this.checkAudioCues();

        // Check if phase is complete
        if (this.phaseTimeRemaining <= 0) {
            this.nextPhase();
        }

        this.updateDisplay();
    }

    checkAudioCues() {
        const timeRemaining = Math.ceil(this.phaseTimeRemaining);

        // Start countdown ticks at 10 seconds
        if (timeRemaining <= 10 && timeRemaining > 0) {
            if (!this.countdownStarted) {
                this.countdownStarted = true;
                this.phaseTimeDisplay.classList.add('warning');
                this.audio.startCountdownTicks(timeRemaining);
            } else {
                // Update tick rate as time decreases
                this.audio.updateCountdownTicks(timeRemaining);
            }
        }
    }

    nextPhase() {
        this.currentPhaseIndex++;
        this.countdownStarted = false;
        this.audio.stopCountdownTicks();
        this.phaseTimeDisplay.classList.remove('warning');

        if (this.currentPhaseIndex >= this.phases.length) {
            this.complete();
            return;
        }

        const newPhase = this.phases[this.currentPhaseIndex];
        this.phaseTimeRemaining = newPhase.duration;

        // Play phase change sound
        this.audio.playPhaseChange(newPhase.isHighIntensity);
    }

    togglePause() {
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            this.pauseBtn.innerHTML = '<span class="icon">▶</span><span>Resume</span>';
        } else {
            this.pauseBtn.innerHTML = '<span class="icon">⏸</span><span>Pause</span>';
            this.lastTickTime = Date.now();
        }
    }

    stop() {
        if (confirm('Are you sure you want to stop the workout?')) {
            this.cleanup();
            this.showPanel('settings');
        }
    }

    complete() {
        this.cleanup();
        this.finalTimeDisplay.textContent = this.formatTime(this.totalElapsed);
        this.audio.playComplete();
        this.showPanel('complete');
    }

    cleanup() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.audio.stopCountdownTicks();
        this.releaseWakeLock();
    }

    restart() {
        this.showPanel('settings');
    }

    showPanel(panel) {
        this.settingsPanel.classList.add('hidden');
        this.timerPanel.classList.add('hidden');
        this.completePanel.classList.add('hidden');

        switch (panel) {
            case 'settings':
                this.settingsPanel.classList.remove('hidden');
                break;
            case 'timer':
                this.timerPanel.classList.remove('hidden');
                break;
            case 'complete':
                this.completePanel.classList.remove('hidden');
                break;
        }
    }

    updateDisplay() {
        const currentPhase = this.phases[this.currentPhaseIndex];

        // Update phase indicator
        this.phaseIndicator.className = `phase-indicator ${currentPhase.type}`;
        this.phaseName.textContent = currentPhase.name.toUpperCase();

        // Update interval counter if applicable
        if (currentPhase.interval) {
            this.intervalCounter.textContent = `${currentPhase.interval} of ${currentPhase.totalIntervals}`;
        } else {
            this.intervalCounter.textContent = '';
        }

        // Update phase time
        this.phaseTimeDisplay.textContent = this.formatTime(Math.max(0, this.phaseTimeRemaining));

        // Update progress bar
        const progress = ((currentPhase.duration - this.phaseTimeRemaining) / currentPhase.duration) * 100;
        this.phaseProgress.style.width = `${Math.min(100, progress)}%`;
        this.phaseProgress.style.backgroundColor = this.getPhaseColor(currentPhase.type);

        // Update total times
        this.totalElapsedDisplay.textContent = this.formatTime(this.totalElapsed);
        this.totalRemainingDisplay.textContent = this.formatTime(Math.max(0, this.totalDuration - this.totalElapsed));

        // Update next phase
        if (this.currentPhaseIndex < this.phases.length - 1) {
            const nextPhase = this.phases[this.currentPhaseIndex + 1];
            const action = nextPhase.isHighIntensity ? 'Run' : (nextPhase.type === 'recovery' ? 'Walk' : nextPhase.name);
            this.nextPhaseDisplay.textContent = `Next: ${action}`;
            this.nextPhaseDisplay.style.display = 'block';
        } else {
            this.nextPhaseDisplay.textContent = 'Final phase!';
        }
    }

    getPhaseColor(type) {
        const colors = {
            'warmup': '#3498db',
            'high-intensity': '#e74c3c',
            'recovery': '#2ecc71',
            'cooldown': '#9b59b6'
        };
        return colors[type] || '#3498db';
    }

    formatTime(seconds) {
        const mins = Math.floor(Math.abs(seconds) / 60);
        const secs = Math.floor(Math.abs(seconds) % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new Timer();
});
