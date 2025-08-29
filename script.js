// ---- Timer Variables ----
let timer, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0;
let timeLeft; // Will be set by settings

// ---- Settings Variables ----
let workDuration, shortBreakDuration, longBreakDuration;

// ---- Ambient Effect State ----
let snowInterval, rainInterval, sakuraInterval;
let isSnowActive = false, isRainActive = false, isSakuraActive = false;

// ---- Stats, Coins, Profile ----
let sessionsToday = parseInt(localStorage.getItem("sessionsToday")) || 0;
let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastActiveDate = localStorage.getItem("lastActiveDate") || null;
let coins = parseInt(localStorage.getItem("coins")) || 0;
let profileName = localStorage.getItem("profileName") || "Floww User";

// ---- Sound Elements ----
const startSound = document.getElementById("startSound");
const endSound = document.getElementById("endSound");
const coinSound = document.getElementById("coinSound");
const whiteNoise = document.getElementById("whiteNoise");

// ===================================================================================
// CORE TIMER LOGIC
// ===================================================================================

function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    
    document.getElementById("timer").textContent = timeString;
    document.getElementById("focusModeTimer").textContent = timeString;

    const currentDuration = isWorkSession ? workDuration : (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration);
    const progress = timeLeft > 0 ? ((currentDuration - timeLeft) / currentDuration) * 100 : 0;
    document.getElementById("focusModeProgressBar").style.width = `${progress}%`;

    if (isRunning) {
        document.title = `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww`;
    } else {
        document.title = 'YouFloww - Focus Timer & To-Do List';
    }
}

function updateStatus() {
    document.getElementById("status").textContent = isWorkSession ? "Work Session" : "Break Time";
}

function setButtonState(running) {
    document.getElementById("startBtn").disabled = running;
    document.getElementById("pauseBtn").disabled = !running;
    document.getElementById("resetBtn").classList.toggle('hidden', !running);
    document.getElementById("endSessionBtn").classList.toggle('hidden', !running);
}

function startTimer() {
    if (isRunning) return;
    isRunning = true;
    endTime = Date.now() + timeLeft * 1000;
    setButtonState(true);
    document.getElementById("focusModePlayPauseBtn").classList.remove('paused');
    startSound.play();

    timer = setInterval(() => {
        const remaining = endTime - Date.now();
        timeLeft = Math.round(remaining / 1000);

        if (timeLeft <= 0) {
            clearInterval(timer);
            timeLeft = 0;
            updateTimerDisplay();
            isRunning = false;
            endSound.play();
            handleSessionCompletion();
        } else {
            updateTimerDisplay();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    isRunning = false;
    setButtonState(false);
    document.getElementById("focusModePlayPauseBtn").classList.add('paused');
}

function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    isWorkSession = true;
    sessionCount = 0;
    timeLeft = workDuration;
    updateTimerDisplay();
    updateStatus();
    setButtonState(false);
}

function endSession() {
    // Logic for saving partial session can be added here if needed.
    resetTimer();
}

function handleSessionCompletion() {
    if (isWorkSession) {
        sessionCount++;
        isWorkSession = false;
        timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
    } else {
        isWorkSession = true;
        timeLeft = workDuration;
    }
    updateTimerDisplay();
    updateStatus();
    // Reset buttons and prepare for the next manual start
    setButtonState(false);
    // You could auto-start the next session by calling startTimer() here.
}


// ===================================================================================
// SETTINGS
// ===================================================================================

function loadSettings() {
    workDuration = parseInt(localStorage.getItem("workDuration"), 10) || 25 * 60;
    shortBreakDuration = parseInt(localStorage.getItem("shortBreakDuration"), 10) || 5 * 60;
    longBreakDuration = parseInt(localStorage.getItem("longBreakDuration"), 10) || 15 * 60;
    timeLeft = workDuration;

    document.getElementById('work-duration').value = workDuration / 60;
    document.getElementById('short-break-duration').value = shortBreakDuration / 60;
    document.getElementById('long-break-duration').value = longBreakDuration / 60;
}

function saveSettings() {
    const newWork = parseInt(document.getElementById('work-duration').value, 10) * 60;
    const newShort = parseInt(document.getElementById('short-break-duration').value, 10) * 60;
    const newLong = parseInt(document.getElementById('long-break-duration').value, 10) * 60;

    if (newWork && newShort && newLong) {
        localStorage.setItem("workDuration", newWork);
        localStorage.setItem("shortBreakDuration", newShort);
        localStorage.setItem("longBreakDuration", newLong);
        loadSettings();
        resetTimer();
        alert("Settings saved!");
    } else {
        alert("Please enter valid numbers for all durations.");
    }
}


// ===================================================================================
// AMBIENT EFFECTS (Refactored to toggle and handle background tabs)
// ===================================================================================

const ambientContainer = document.getElementById('ambient-container');

function createAmbientElement(className) {
    const el = document.createElement('div');
    el.className = `ambient-effect ${className}`;
    el.style.left = `${Math.random() * 100}vw`;
    ambientContainer.appendChild(el);
    
    // Use animationend event to remove the element, preventing buildup
    el.addEventListener('animationend', () => {
        el.remove();
    });

    return el;
}

function animateAmbientElement(el, minDuration, maxDuration, animationName) {
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    el.style.animation = `${animationName} ${duration}ms linear forwards`;
}

function startSnowInterval() {
    if (snowInterval) return;
    snowInterval = setInterval(() => {
        const snowflake = createAmbientElement('snowflake');
        animateAmbientElement(snowflake, 8000, 15000, 'fall');
    }, 200);
}

function startRainInterval() {
    if (rainInterval) return;
    rainInterval = setInterval(() => {
        const raindrop = createAmbientElement('raindrop');
        animateAmbientElement(raindrop, 400, 800, 'fall');
    }, 50);
}

function startSakuraInterval() {
    if (sakuraInterval) return;
    sakuraInterval = setInterval(() => {
        const petal = createAmbientElement('sakura');
        animateAmbientElement(petal, 15000, 25000, 'spinFall');
    }, 500);
}

function toggleSnow() {
    isSnowActive = !isSnowActive;
    document.getElementById('snowBtn').classList.toggle('active', isSnowActive);
    if (isSnowActive && !document.hidden) {
        startSnowInterval();
    } else {
        clearInterval(snowInterval);
        snowInterval = null;
    }
}

function toggleRain() {
    isRainActive = !isRainActive;
    document.getElementById('rainBtn').classList.toggle('active', isRainActive);
    if (isRainActive && !document.hidden) {
        startRainInterval();
    } else {
        clearInterval(rainInterval);
        rainInterval = null;
    }
}

function toggleSakura() {
    isSakuraActive = !isSakuraActive;
    document.getElementById('sakuraBtn').classList.toggle('active', isSakuraActive);
    if (isSakuraActive && !document.hidden) {
        startSakuraInterval();
    } else {
        clearInterval(sakuraInterval);
        sakuraInterval = null;
    }
}

// FIX: Handle page visibility to prevent element accumulation
function handleVisibilityChange() {
    if (document.hidden) {
        clearInterval(snowInterval); snowInterval = null;
        clearInterval(rainInterval); rainInterval = null;
        clearInterval(sakuraInterval); sakuraInterval = null;
        ambientContainer.innerHTML = ''; // Clear existing elements
    } else {
        if (isSnowActive) startSnowInterval();
        if (isRainActive) startRainInterval();
        if (isSakuraActive) startSakuraInterval();
    }
}

// ===================================================================================
// MODALS, UI, and OTHER HELPERS (Many are unchanged but included for completeness)
// ===================================================================================

function openStats() {
    document.getElementById("statsModal").classList.add('visible');
    // The rest of your stats functions (renderCharts etc.) go here
}

function closeStats() {
    document.getElementById("statsModal").classList.remove('visible');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active');
    document.getElementById(`${tabName}Container`).classList.add('active');
}

function toggleFocusMode() {
    document.body.classList.toggle('focus-mode');
}

function getYoutubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    return url.match(regex)?.[1] || null;
}

function setYoutubeBackground() {
    const url = document.getElementById("youtube-input").value;
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
        document.getElementById("video-background-container").innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0" frameborder="0"></iframe>`;
        localStorage.setItem('youtubeVideoId', videoId);
        document.body.style.backgroundImage = 'none';
    } else {
        alert("Please enter a valid YouTube URL.");
    }
}

// ... your other functions like loadTodos, addTodo, applyStoreItem, charts, etc. would go here ...
// They are omitted for brevity but are needed for the app to be fully functional.


// ===================================================================================
// INITIALIZATION and EVENT LISTENERS
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    loadSettings();
    updateStatus();
    updateTimerDisplay();
    setButtonState(false); // Hide reset/end buttons initially
    // loadTodos(); // Assume you have this function
    // updateCornerWidget(); // Assume you have this function
    // setInterval(updateCornerWidget, 1000);

    // Main Controls
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("resetBtn").addEventListener('click', resetTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    
    // Ambient Controls
    document.getElementById("noiseBtn").addEventListener('click', () => {
        if (whiteNoise.paused) {
            whiteNoise.play();
            document.getElementById("noiseBtn").textContent = "🎧 Stop Noise";
        } else {
            whiteNoise.pause();
            document.getElementById("noiseBtn").textContent = "🎧 Play Noise";
        }
    });

    const ambienceDropdown = document.querySelector('.ambience-dropdown');
    document.getElementById("ambienceBtn").addEventListener('click', (e) => {
        e.stopPropagation();
        ambienceDropdown.classList.toggle('active');
    });
    document.getElementById("snowBtn").addEventListener('click', toggleSnow);
    document.getElementById("rainBtn").addEventListener('click', toggleRain);
    document.getElementById("sakuraBtn").addEventListener('click', toggleSakura);

    // Focus Mode
    document.getElementById("focusModeBtn").addEventListener('click', toggleFocusMode);
    document.getElementById("focusModePlayPauseBtn").addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
    document.getElementById("focusModeExitBtn").addEventListener('click', toggleFocusMode);

    // Settings
    document.getElementById("saveSettingsBtn").addEventListener('click', saveSettings);
    
    // Backgrounds
    document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
    
    // Global Listeners
    window.addEventListener('click', () => {
        ambienceDropdown.classList.remove('active');
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            isRunning ? pauseTimer() : startTimer();
        }
    });
});
