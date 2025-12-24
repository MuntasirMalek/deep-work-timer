// ===== State Management =====
let timerState = {
    isRunning: false,
    isStudying: true,
    studyMinutes: 0,
    breakMinutes: 0,
    cycle: 1,
    sessionStudySeconds: 0,
    intervalId: null,
    wakeLock: null,
    // Time-based tracking for background support
    phaseStartTime: null,      // When current phase (study/break) started
    phaseDuration: 0,          // Duration of current phase in ms
    sessionStartTime: null,    // When the session started (for total study time)
    // Delay tracking
    isInDelay: false,          // Whether currently in a delay period
    delayType: null,           // 'post-study' (1 min) or 'post-break' (5 min alarm)
    alarmIntervalId: null      // For looping alarm during post-break delay
};

// ===== DOM Elements =====
const homeScreen = document.getElementById('home-screen');
const timerScreen = document.getElementById('timer-screen');
const timerDisplay = document.getElementById('timer-display');
const timerStatus = document.getElementById('timer-status');
const cycleInfo = document.getElementById('cycle-info');
const progressCircle = document.getElementById('progress-circle');
const sessionModal = document.getElementById('session-modal');
const totalStudyTimeEl = document.getElementById('total-study-time');
const sessionTimeEl = document.getElementById('session-time');
const modalTotalTimeEl = document.getElementById('modal-total-time');
const timeStudiedValueEl = document.getElementById('time-studied-value');

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => {
    loadTotalStudyTime();
    registerServiceWorker();
    requestNotificationPermission();

    // Check if there's a saved session (for browser refresh recovery)
    recoverSession();
});

// ===== Service Worker Registration =====
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
}

// ===== Notification Permission =====
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        // Will request when user starts first session
    }
}

async function ensureNotificationPermission() {
    if ('Notification' in window) {
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return Notification.permission === 'granted';
    }
    return false;
}

// ===== Send Notification =====
function sendNotification(title, body, tag) {
    // Clear old notifications first
    clearAllNotifications();

    // NO SOUND - sound is played separately with delays

    if ('Notification' in window && Notification.permission === 'granted') {
        // Try service worker notification first (works better on Android)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
                    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
                    tag: tag,
                    requireInteraction: true,
                    vibrate: [200, 100, 200, 100, 200],
                    silent: true // We're playing our own sound
                });
            });
        } else {
            // Fallback to regular notification
            new Notification(title, {
                body: body,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
                tag: tag,
                requireInteraction: true,
                silent: true
            });
        }

        // Also vibrate for extra attention
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 200]);
        }
    }
}

// ===== Play Delay & Alarm Tones =====
let delayToneAudio = null;
let alarmToneAudio = null;

function playDelayTone() {
    try {
        // Create audio element if not exists
        if (!delayToneAudio) {
            delayToneAudio = new Audio('delay_tone.mp3'); // Google Pixel ringtone 20 sec
            delayToneAudio.preload = 'auto';
        }

        // Reset and play once (no loop)
        delayToneAudio.currentTime = 0;
        delayToneAudio.loop = false;
        delayToneAudio.play().catch(err => {
            console.log('Delay tone play failed:', err);
        });
    } catch (err) {
        console.log('Delay tone error:', err);
    }
}

function playAlarmTone() {
    try {
        // Create audio element if not exists
        if (!alarmToneAudio) {
            alarmToneAudio = new Audio('alarm_tone.mp3'); // Nokia Tune 40 sec
            alarmToneAudio.preload = 'auto';
        }

        // Reset and play with loop
        alarmToneAudio.currentTime = 0;
        alarmToneAudio.loop = true;
        alarmToneAudio.play().catch(err => {
            console.log('Alarm tone play failed:', err);
        });
    } catch (err) {
        console.log('Alarm tone error:', err);
    }
}

function stopAlarmTone() {
    if (alarmToneAudio) {
        alarmToneAudio.pause();
        alarmToneAudio.currentTime = 0;
        alarmToneAudio.loop = false;
    }
}

// ===== Clear All Notifications =====
function clearAllNotifications() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.getNotifications().then(notifications => {
                notifications.forEach(notification => notification.close());
            });
        });
    }
}

// ===== Wake Lock (Keep Screen Awake) =====
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            timerState.wakeLock = await navigator.wakeLock.request('screen');
            timerScreen.classList.add('screen-lock-active');
            console.log('Wake Lock active');

            timerState.wakeLock.addEventListener('release', () => {
                console.log('Wake Lock released');
                timerScreen.classList.remove('screen-lock-active');
            });
        } catch (err) {
            console.log('Wake Lock error:', err);
        }
    }
}

function releaseWakeLock() {
    if (timerState.wakeLock) {
        timerState.wakeLock.release();
        timerState.wakeLock = null;
    }
}

// ===== Session Persistence =====
function saveSession() {
    const session = {
        isRunning: timerState.isRunning,
        isStudying: timerState.isStudying,
        studyMinutes: timerState.studyMinutes,
        breakMinutes: timerState.breakMinutes,
        cycle: timerState.cycle,
        phaseStartTime: timerState.phaseStartTime,
        phaseDuration: timerState.phaseDuration,
        sessionStartTime: timerState.sessionStartTime,
        sessionStudySeconds: timerState.sessionStudySeconds
    };
    localStorage.setItem('studyTimer_activeSession', JSON.stringify(session));
}

function clearSession() {
    localStorage.removeItem('studyTimer_activeSession');
}

function recoverSession() {
    const saved = localStorage.getItem('studyTimer_activeSession');
    if (!saved) return;

    try {
        const session = JSON.parse(saved);
        if (!session.isRunning) {
            clearSession();
            return;
        }

        // Restore state
        timerState.isRunning = true;
        timerState.isStudying = session.isStudying;
        timerState.studyMinutes = session.studyMinutes;
        timerState.breakMinutes = session.breakMinutes;
        timerState.cycle = session.cycle;
        timerState.phaseStartTime = session.phaseStartTime;
        timerState.phaseDuration = session.phaseDuration;
        timerState.sessionStartTime = session.sessionStartTime;
        timerState.sessionStudySeconds = session.sessionStudySeconds;

        // Switch to timer screen
        homeScreen.classList.remove('active');
        timerScreen.classList.add('active');
        timerScreen.classList.toggle('studying', timerState.isStudying);
        timerScreen.classList.toggle('on-break', !timerState.isStudying);

        // Resume timer
        timerState.intervalId = setInterval(tick, 1000);
        tick(); // Immediate update

        // Re-request wake lock
        requestWakeLock();

        console.log('Session recovered!');
    } catch (e) {
        console.log('Failed to recover session:', e);
        clearSession();
    }
}

// ===== Start Study Session =====
async function startStudy(studyMins, breakMins) {
    // Request notification permission on first start
    await ensureNotificationPermission();

    // Request wake lock to keep screen on
    await requestWakeLock();

    timerState.studyMinutes = studyMins;
    timerState.breakMinutes = breakMins;
    timerState.isRunning = true;
    timerState.isStudying = true;
    timerState.cycle = 1;
    timerState.sessionStudySeconds = 0;

    // Time-based tracking
    timerState.phaseStartTime = Date.now();
    timerState.phaseDuration = studyMins * 60 * 1000;
    timerState.sessionStartTime = Date.now();

    // Switch screens
    homeScreen.classList.remove('active');
    timerScreen.classList.add('active');
    timerScreen.classList.add('studying');
    timerScreen.classList.remove('on-break');

    updateFromTime();
    updateStatus();
    saveSession();

    // Show persistent notification with end time
    showPhaseNotification();

    // Start the timer
    timerState.intervalId = setInterval(tick, 1000);
    tick(); // Immediate first tick for mobile browsers
}

// ===== Show Persistent Phase Notification =====
function showPhaseNotification() {
    if ('Notification' in window && Notification.permission === 'granted') {
        const endTime = new Date(timerState.phaseStartTime + timerState.phaseDuration);
        const endTimeStr = endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const duration = Math.round(timerState.phaseDuration / 60000);

        const title = timerState.isStudying ? '📚 Study Mode Active' : '☕ Break Time Active';
        const body = timerState.isStudying
            ? `Studying until ${endTimeStr} (${duration} min) - Cycle ${timerState.cycle}`
            : `Break until ${endTimeStr} (${duration} min)`;

        // Show persistent notification
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📚</text></svg>',
                    tag: 'study-timer-active', // Same tag = replaces previous
                    requireInteraction: false,
                    silent: true,
                    ongoing: true // Tries to make it persistent (Android)
                });
            });
        } else {
            new Notification(title, {
                body: body,
                tag: 'study-timer-active',
                silent: true
            });
        }
    }
}

// ===== Timer Tick =====
function tick() {
    if (!timerState.isRunning) return;

    const now = Date.now();

    // Process all phase transitions that should have happened
    let loopCount = 0;
    const maxLoops = 100; // Safety limit

    while (loopCount < maxLoops) {
        const elapsed = now - timerState.phaseStartTime;
        const remaining = timerState.phaseDuration - elapsed;

        if (remaining > 0) {
            // Current phase still active, just update display
            break;
        }

        // Phase has ended - handle transition based on current state
        const phaseEndTime = timerState.phaseStartTime + timerState.phaseDuration;

        if (timerState.isInDelay) {
            // Delay ended - start the next phase
            if (timerState.delayType === 'post-study') {
                // Start break after 1-min delay
                timerState.isInDelay = false;
                timerState.delayType = null;
                timerState.isStudying = false;
                timerState.phaseStartTime = phaseEndTime;
                timerState.phaseDuration = timerState.breakMinutes * 60 * 1000;

                timerScreen.classList.remove('studying', 'in-delay');
                timerScreen.classList.add('on-break');
                hideSkipButton();
            } else if (timerState.delayType === 'post-break') {
                // Start new study cycle after 5-min alarm delay
                stopAlarmLoop();
                timerState.isInDelay = false;
                timerState.delayType = null;
                timerState.cycle++;
                timerState.isStudying = true;
                timerState.phaseStartTime = phaseEndTime;
                timerState.phaseDuration = timerState.studyMinutes * 60 * 1000;

                timerScreen.classList.remove('on-break', 'in-delay');
                timerScreen.classList.add('studying');
                hideSkipButton();
            }
        } else if (timerState.isStudying) {
            // Study period ended - start 1-min delay
            sendNotification(
                '☕ Break Time Soon!',
                `Great deep work! 1 minute until break starts.`,
                'break-notification'
            );

            // Play delay tone (Google Pixel - 20 sec, no loop)
            playDelayTone();

            timerState.isInDelay = true;
            timerState.delayType = 'post-study';
            timerState.phaseStartTime = phaseEndTime;
            timerState.phaseDuration = 1 * 60 * 1000; // 1 minute

            timerScreen.classList.add('in-delay');
            showSkipButton();
        } else {
            // Break ended - start 5-min alarm delay
            sendNotification(
                '📚 Deep Work Time Soon!',
                `Break is over. 5 minute alarm before next deep work cycle.`,
                'study-notification'
            );

            timerState.isInDelay = true;
            timerState.delayType = 'post-break';
            timerState.phaseStartTime = phaseEndTime;
            timerState.phaseDuration = 5 * 60 * 1000; // 5 minutes

            timerScreen.classList.add('in-delay');
            showSkipButton();
            startAlarmLoop(); // Start looping alarm
        }

        updateStatus();
        saveSession();
        showPhaseNotification();
        loopCount++;
    }

    // Update session study time
    updateStudyTime();
    updateFromTime();
    updateTimeStudied();
}

// ===== Calculate Total Study Time in Session =====
function updateStudyTime() {
    const studyDuration = timerState.studyMinutes * 60 * 1000;

    // Completed cycles = full study periods done
    const completedStudyPeriods = timerState.cycle - 1;
    let totalStudyMs = completedStudyPeriods * studyDuration;

    // Add current cycle study time if we're actively studying (not on break, not in delay)
    if (timerState.isStudying && !timerState.isInDelay) {
        const now = Date.now();
        const currentStudyTime = Math.min(now - timerState.phaseStartTime, timerState.phaseDuration);
        totalStudyMs += currentStudyTime;
    }
    // If we're past the study phase in current cycle (in delay, break, or post-break delay)
    else if (!timerState.isStudying || timerState.isInDelay) {
        // We completed the current cycle's study, so add full study duration
        if (timerState.cycle > completedStudyPeriods) {
            totalStudyMs += studyDuration;
        }
    }

    timerState.sessionStudySeconds = Math.floor(totalStudyMs / 1000);
}

// ===== Update Display from Time =====
function updateFromTime() {
    const now = Date.now();
    const elapsed = now - timerState.phaseStartTime;
    const remainingMs = Math.max(0, timerState.phaseDuration - elapsed);
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    // Update timer display
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Update progress ring
    const totalSeconds = timerState.phaseDuration / 1000;
    const progress = remainingSeconds / totalSeconds;
    const circumference = 2 * Math.PI * 90;
    const offset = circumference * (1 - progress);
    progressCircle.style.strokeDashoffset = offset;
}

// ===== Update Status Text =====
function updateStatus() {
    if (timerState.isInDelay) {
        if (timerState.delayType === 'post-study') {
            timerStatus.textContent = 'DELAY - BREAK SOON';
        } else if (timerState.delayType === 'post-break') {
            timerStatus.textContent = 'ALARM - WAKE UP!';
        }
    } else {
        timerStatus.textContent = timerState.isStudying ? 'DEEP WORKING' : 'BREAK TIME';
    }
    cycleInfo.textContent = `Cycle ${timerState.cycle}`;
}

// ===== Alarm Loop Functions =====
function startAlarmLoop() {
    // Start looping Nokia Tune (40 sec, loops automatically)
    playAlarmTone();
}

function stopAlarmLoop() {
    // Stop the looping alarm tone
    stopAlarmTone();

    // Also clear any interval (though we don't use interval anymore since audio loops itself)
    if (timerState.alarmIntervalId) {
        clearInterval(timerState.alarmIntervalId);
        timerState.alarmIntervalId = null;
    }
}

// ===== Skip Button Functions =====
function showSkipButton() {
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.style.display = 'flex';
}

function hideSkipButton() {
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) skipBtn.style.display = 'none';
}

function skipDelay() {
    if (!timerState.isInDelay) return;

    // Stop alarm if playing
    stopAlarmLoop();

    // Force end the delay by setting phaseStartTime to the past
    timerState.phaseStartTime = Date.now() - timerState.phaseDuration - 1000;

    // Let tick() handle the transition
    tick();
}

// ===== Update Time Studied Display =====
function updateTimeStudied() {
    const hours = Math.floor(timerState.sessionStudySeconds / 3600);
    const minutes = Math.floor((timerState.sessionStudySeconds % 3600) / 60);
    const seconds = timerState.sessionStudySeconds % 60;

    if (hours > 0) {
        timeStudiedValueEl.textContent = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        timeStudiedValueEl.textContent = `${minutes}m ${seconds}s`;
    } else {
        timeStudiedValueEl.textContent = `${seconds}s`;
    }
}

// ===== Stop Study Session =====
function stopStudy() {
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    clearSession();

    // Stop alarm if playing
    stopAlarmLoop();
    hideSkipButton();

    // Release wake lock
    releaseWakeLock();

    // Calculate session time
    const sessionMinutes = Math.floor(timerState.sessionStudySeconds / 60);
    const sessionSeconds = timerState.sessionStudySeconds % 60;

    // Update total study time
    const totalMinutes = getTotalStudyMinutes() + sessionMinutes + (sessionSeconds >= 30 ? 1 : 0);
    saveTotalStudyTime(totalMinutes);

    // Show modal with stats
    sessionTimeEl.textContent = formatTime(timerState.sessionStudySeconds);
    modalTotalTimeEl.textContent = formatTimeFromMinutes(totalMinutes);

    // Switch to modal
    timerScreen.classList.remove('active', 'studying', 'on-break');
    sessionModal.classList.add('active');
}

// ===== Close Modal =====
function closeModal() {
    sessionModal.classList.remove('active');
    homeScreen.classList.add('active');
    loadTotalStudyTime();
}

// ===== Time Formatting =====
function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

function formatTimeFromMinutes(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
}

// ===== LocalStorage Functions with Daily Reset =====
function getTodayDate() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function getTotalStudyMinutes() {
    const stored = localStorage.getItem('studyTimer_totalMinutes');
    const storedDate = localStorage.getItem('studyTimer_date');
    const today = getTodayDate();

    // Reset if it's a new day
    if (storedDate !== today) {
        localStorage.setItem('studyTimer_date', today);
        localStorage.setItem('studyTimer_totalMinutes', '0');
        return 0;
    }

    return stored ? parseInt(stored, 10) : 0;
}

function saveTotalStudyTime(minutes) {
    localStorage.setItem('studyTimer_totalMinutes', minutes.toString());
    localStorage.setItem('studyTimer_date', getTodayDate());
}

function loadTotalStudyTime() {
    const totalMinutes = getTotalStudyMinutes();
    totalStudyTimeEl.textContent = formatTimeFromMinutes(totalMinutes);
}

// ===== Handle Visibility Change (for reliable background) =====
document.addEventListener('visibilitychange', async () => {
    if (timerState.isRunning) {
        if (document.visibilityState === 'visible') {
            // Re-request wake lock and update immediately
            await requestWakeLock();
            tick(); // Catch up on any missed time
        } else {
            // Save session when going to background
            saveSession();
        }
    }
});

// ===== Handle Page Unload =====
window.addEventListener('beforeunload', (e) => {
    if (timerState.isRunning) {
        saveSession();
        e.preventDefault();
        e.returnValue = 'You have an active study session. Are you sure you want to leave?';
        return e.returnValue;
    }
});

// ===== Handle Page Show (for bfcache) =====
window.addEventListener('pageshow', (e) => {
    if (e.persisted && timerState.isRunning) {
        tick(); // Catch up on any missed time
    }
});
