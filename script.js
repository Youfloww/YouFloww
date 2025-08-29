// ---- Global Variables ----
let timer, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0;
let timeLeft;
let workDuration, shortBreakDuration, longBreakDuration;
let snowInterval, rainInterval, sakuraInterval;
let isSnowActive = false, isRainActive = false, isSakuraActive = false;
let sessionsToday = parseInt(localStorage.getItem("sessionsToday")) || 0;
let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
let totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
let profileName = localStorage.getItem("profileName") || "Floww User";

// ---- DOM Elements and Sounds ----
const whiteNoise = document.getElementById("whiteNoise");
const ambientContainer = document.getElementById('ambient-container');
const startSounds = document.querySelectorAll('.start-sound');
const goodMemeSounds = document.querySelectorAll('.good-meme');
const badMemeSounds = document.querySelectorAll('.bad-meme');
const pauseAlertSound = document.getElementById("pauseAlertSound");
const resumeAlertSound = document.getElementById("resumeAlertSound");

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

    document.title = isRunning ? `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww` : 'YouFloww - Focus Timer & To-Do List';
}

function updateStatus() { document.getElementById("status").textContent = isWorkSession ? "Work Session" : "Break Time"; }

function setButtonState(running) {
    document.getElementById("startBtn").disabled = running;
    document.getElementById("pauseBtn").disabled = !running;
    document.getElementById("resetBtn").classList.toggle('hidden', !running);
    document.getElementById("endSessionBtn").classList.toggle('hidden', !running);
}

function playRandomSound(sounds) {
    if (sounds.length > 0) {
        const randomIndex = Math.floor(Math.random() * sounds.length);
        sounds[randomIndex].play();
    }
}

function startTimer() {
    if (isRunning) return;
    
    // Play start or resume sound
    if (timeLeft === workDuration) { // It's a brand new session
        playRandomSound(startSounds);
    } else { // It's a resumed session
        resumeAlertSound.play();
    }

    isRunning = true;
    endTime = Date.now() + timeLeft * 1000;
    setButtonState(true);
    document.getElementById("focusModePlayPauseBtn").classList.remove('paused');
    
    timer = setInterval(() => {
        timeLeft = Math.round((endTime - Date.now()) / 1000);
        if (timeLeft <= 0) {
            clearInterval(timer);
            timeLeft = 0;
            updateTimerDisplay();
            isRunning = false;
            handleSessionCompletion();
        } else {
            updateTimerDisplay();
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(timer);
    isRunning = false;
    pauseAlertSound.play();
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
    const timeFocusedSec = workDuration - timeLeft;
    const minutesFocused = Math.floor(timeFocusedSec / 60);

    if (isWorkSession && minutesFocused > 0) {
        handleEndOfWorkSession(minutesFocused);
    }
    resetTimer();
}

function handleSessionCompletion() {
    if (isWorkSession) {
        const minutesFocused = Math.floor(workDuration / 60);
        handleEndOfWorkSession(minutesFocused);
        sessionCount++;
        isWorkSession = false;
        timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
    } else {
        isWorkSession = true;
        timeLeft = workDuration;
    }
    updateTimerDisplay();
    updateStatus();
    setButtonState(false);
}

function handleEndOfWorkSession(minutesFocused) {
    totalFocusMinutes += minutesFocused;
    totalSessions++;
    localStorage.setItem("totalFocusMinutes", Math.round(totalFocusMinutes));
    localStorage.setItem("totalSessions", totalSessions);
    
    // Add to daily log for bar chart
    const today = new Date().toISOString().slice(0, 10);
    let weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    weeklyData[today] = (weeklyData[today] || 0) + minutesFocused;
    localStorage.setItem("weeklyFocus", JSON.stringify(weeklyData));

    if (minutesFocused >= 25) {
        playRandomSound(goodMemeSounds);
    } else {
        playRandomSound(badMemeSounds);
    }
}

// ===================================================================================
// SETTINGS
// ===================================================================================

function loadSettings() {
    workDuration = parseInt(localStorage.getItem("workDuration"), 10) || 25 * 60;
    shortBreakDuration = parseInt(localStorage.getItem("shortBreakDuration"), 10) || 5 * 60;
    longBreakDuration = parseInt(localStorage.getItem("longBreakDuration"), 10) || 15 * 60;
    if (!isRunning) { timeLeft = workDuration; }
    document.getElementById('work-duration').value = workDuration / 60;
    document.getElementById('short-break-duration').value = shortBreakDuration / 60;
    document.getElementById('long-break-duration').value = longBreakDuration / 60;
}

function saveSettings() {
    // Save settings logic... (same as before)
}

// ===================================================================================
// AMBIENT EFFECTS
// ===================================================================================

function createAmbientElement(className) { const el = document.createElement('div'); el.className = `ambient-effect ${className}`; el.style.left = `${Math.random() * 100}vw`; ambientContainer.appendChild(el); el.addEventListener('animationend', () => el.remove()); return el; }
function animateAmbientElement(el, min, max, name) { const duration = Math.random() * (max - min) + min; el.style.animation = `${name} ${duration}ms linear forwards`; }
function startSnowInterval() { if (snowInterval || document.hidden) return; snowInterval = setInterval(() => animateAmbientElement(createAmbientElement('snowflake'), 8000, 15000, 'fall'), 200); }
function startRainInterval() { if (rainInterval || document.hidden) return; rainInterval = setInterval(() => animateAmbientElement(createAmbientElement('raindrop'), 400, 800, 'fall'), 50); }
function startSakuraInterval() { if (sakuraInterval || document.hidden) return; sakuraInterval = setInterval(() => animateAmbientElement(createAmbientElement('sakura'), 15000, 25000, 'spinFall'), 500); }
function toggleSnow() { isSnowActive = !isSnowActive; document.getElementById('snowBtn').classList.toggle('active', isSnowActive); if (isSnowActive) startSnowInterval(); else { clearInterval(snowInterval); snowInterval = null; } }
function toggleRain() { isRainActive = !isRainActive; document.getElementById('rainBtn').classList.toggle('active', isRainActive); if (isRainActive) startRainInterval(); else { clearInterval(rainInterval); rainInterval = null; } }
function toggleSakura() { isSakuraActive = !isSakuraActive; document.getElementById('sakuraBtn').classList.toggle('active', isSakuraActive); if (isSakuraActive) startSakuraInterval(); else { clearInterval(sakuraInterval); sakuraInterval = null; } }

function handleVisibilityChange() {
    if (document.hidden) {
        clearInterval(snowInterval); snowInterval = null;
        clearInterval(rainInterval); rainInterval = null;
        clearInterval(sakuraInterval); sakuraInterval = null;
        ambientContainer.innerHTML = '';
    } else {
        if (isSnowActive) startSnowInterval();
        if (isRainActive) startRainInterval();
        if (isSakuraActive) startSakuraInterval();
    }
}

// ===================================================================================
// STATS, CHARTS, AND MODALS
// ===================================================================================

function openStats() { document.getElementById("statsModal").classList.add('visible'); renderCharts(); }
function closeStats() { document.getElementById("statsModal").classList.remove('visible'); }
function switchTab(tabName) { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active'); document.getElementById(`${tabName}Container`).classList.add('active'); }

function renderCharts() {
    renderBarChart();
    renderPieChart();
}

function renderBarChart() {
    const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    const today = new Date();
    const labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });
    const data = labels.map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const key = d.toISOString().slice(0, 10);
        return (weeklyData[key] || 0) / 60; // Convert minutes to hours
    });

    const ctx = document.getElementById('barChart').getContext('2d');
    if (window.myBarChart) window.myBarChart.destroy();
    window.myBarChart = new Chart(ctx, { type: 'bar', data: { labels, datasets: [{ label: 'Daily Focus (hours)', data, backgroundColor: '#f7a047' }] } });
}

function renderPieChart() {
    const totalBreakMinutes = totalSessions * (shortBreakDuration / 60);
    const ctx = document.getElementById('pieChart').getContext('2d');
    if(window.myPieChart) window.myPieChart.destroy();
    window.myPieChart = new Chart(ctx, {type: 'pie', data: { labels: ['Work', 'Break'], datasets: [{ data: [totalFocusMinutes, totalBreakMinutes], backgroundColor: ['#f7a047', '#6c63ff'] }]}});
}

// ===================================================================================
// TO-DO LIST
// ===================================================================================

function loadTodos() { /* ... same as before ... */ }
function addTodo() { /* ... same as before ... */ }
function toggleTodo(index) { /* ... same as before ... */ }
function editTodo(index) { /* ... same as before ... */ }
function clearTodos() { /* ... same as before ... */ }

// ===================================================================================
// CORNER WIDGET AND OTHER HELPERS
// ===================================================================================

function updateCornerWidget(){
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayProgress = ((now - startOfDay) / 86400000) * 100;
    document.getElementById("dayProgressBar").style.width = `${dayProgress}%`;
    document.getElementById("dayProgressPercent").textContent = `${Math.floor(dayProgress)}%`;

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthProgress = ((now - startOfMonth) / (endOfMonth - startOfMonth)) * 100;
    document.getElementById("monthProgressBar").style.width = `${monthProgress}%`;
    document.getElementById("monthProgressPercent").textContent = `${Math.floor(monthProgress)}%`;

    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const yearProgress = ((now - startOfYear) / (endOfYear - startOfYear)) * 100;
    document.getElementById("yearProgressBar").style.width = `${yearProgress}%`;
    document.getElementById("yearProgressPercent").textContent = `${Math.floor(yearProgress)}%`;
}

function toggleFocusMode() { document.body.classList.toggle('focus-mode'); }
function changeProfileName() { /* ... same as before ... */ }
function clearAllData() { if (confirm("Are you sure?")) { localStorage.clear(); window.location.reload(); } }
function exportData() { /* ... same as before ... */ }
function getYoutubeVideoId(url) { return url.match(/(?:[?&]v=|\/embed\/|youtu\.be\/)([^"&?/\s]{11})/) ?.[1] || null; }
function setYoutubeBackground() { /* ... same as before ... */ }
function applyStoreItem(element) { /* ... same as before ... */ }


// ===================================================================================
// INITIALIZATION
// ===================================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateStatus();
    updateTimerDisplay();
    setButtonState(false);
    loadTodos();
    updateCornerWidget();
    setInterval(updateCornerWidget, 1000);

    // Event Listeners are the same as the previous complete version
    // ...
});
