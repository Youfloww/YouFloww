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
const endSound = document.getElementById("endSound");
const whiteNoise = document.getElementById("whiteNoise");
const ambientContainer = document.getElementById('ambient-container');
const startSounds = document.querySelectorAll('.start-sound');
const goodMemeSounds = document.querySelectorAll('.good-meme');
const badMemeSounds = document.querySelectorAll('.bad-meme');

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

function updateStatus() {
    document.getElementById("status").textContent = isWorkSession ? "Work Session" : "Break Time";
}

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
    if (isWorkSession) {
        playRandomSound(startSounds);
    }
    isRunning = true;
    endTime = Date.now() + timeLeft * 1000;
    setButtonState(true);
    document.getElementById("focusModePlayPauseBtn").classList.remove('paused');
    
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
    const minutesFocused = Math.floor((workDuration - timeLeft) / 60);
    if (isWorkSession && minutesFocused > 0) {
        handleEndOfWorkSession(minutesFocused);
    }
    resetTimer();
}

function handleSessionCompletion() {
    if (isWorkSession) {
        handleEndOfWorkSession(workDuration / 60); // A full session is the total work duration
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

// NEW: Centralized function to handle stats and sounds correctly
function handleEndOfWorkSession(minutesFocused) {
    totalFocusMinutes += minutesFocused;
    totalSessions++;
    localStorage.setItem("totalFocusMinutes", totalFocusMinutes);
    localStorage.setItem("totalSessions", totalSessions);

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
    if (!isRunning) {
        timeLeft = workDuration;
    }
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
// AMBIENT EFFECTS
// ===================================================================================

function createAmbientElement(className) {
    const el = document.createElement('div');
    el.className = `ambient-effect ${className}`;
    el.style.left = `${Math.random() * 100}vw`;
    ambientContainer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    return el;
}

function animateAmbientElement(el, minDuration, maxDuration, animationName) {
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    el.style.animation = `${animationName} ${duration}ms linear forwards`;
}

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

function openStats() { document.getElementById("statsModal").classList.add('visible'); updateStatsModal(); renderCharts(); }
function closeStats() { document.getElementById("statsModal").classList.remove('visible'); }
function updateStatsModal() { /* Add stats updates here */ }
function switchTab(tabName) { document.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active'); document.getElementById(`${tabName}Container`).classList.add('active'); }
function renderCharts() { renderBarChart(); renderPieChart(); }
function renderBarChart() { const ctx = document.getElementById('barChart').getContext('2d'); if (window.myBarChart) window.myBarChart.destroy(); window.myBarChart = new Chart(ctx, { type: 'bar', data: { labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], datasets: [{ label: 'Hours', data: [1,2,3,2,4,3,1], backgroundColor: '#f7a047' }] } }); }
function renderPieChart() { const ctx = document.getElementById('pieChart').getContext('2d'); if(window.myPieChart) window.myPieChart.destroy(); window.myPieChart = new Chart(ctx, {type: 'pie', data: { labels: ['Work', 'Break'], datasets: [{ data: [totalFocusMinutes, totalSessions * (shortBreakDuration/60)], backgroundColor: ['#f7a047', '#6c63ff'] }]}}); }

// ===================================================================================
// TO-DO LIST
// ===================================================================================

function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos')) || [];
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `todo-${index}`;
        checkbox.checked = todo.completed;
        checkbox.onchange = () => toggleTodo(index);
        const label = document.createElement('label');
        label.htmlFor = `todo-${index}`;
        label.textContent = todo.text;
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.onclick = () => editTodo(index);
        actionsDiv.appendChild(editBtn);
        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(actionsDiv);
        todoList.appendChild(li);
    });
}

function addTodo() { const todoInput = document.getElementById('todo-input'); const text = todoInput.value.trim(); if (text) { let todos = JSON.parse(localStorage.getItem('todos')) || []; todos.push({ text, completed: false }); localStorage.setItem('todos', JSON.stringify(todos)); todoInput.value = ''; loadTodos(); } }
function toggleTodo(index) { let todos = JSON.parse(localStorage.getItem('todos')) || []; if (todos[index]) { todos[index].completed = !todos[index].completed; localStorage.setItem('todos', JSON.stringify(todos)); loadTodos(); } }
function editTodo(index) { let todos = JSON.parse(localStorage.getItem('todos')) || []; if (todos[index]) { const newText = prompt("Edit your task:", todos[index].text); if (newText && newText.trim() !== "") { todos[index].text = newText.trim(); localStorage.setItem('todos', JSON.stringify(todos)); loadTodos(); } } }
function clearTodos() { if (confirm("Clear all tasks?")) { localStorage.removeItem('todos'); loadTodos(); } }

// ===================================================================================
// CORNER WIDGET and OTHER HELPERS
// ===================================================================================

function updateCornerWidget(){
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayProgress = ((now - startOfDay) / 86400000) * 100; // 24 * 60 * 60 * 1000
    document.getElementById("dayProgressBar").style.width = `${dayProgress}%`;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthProgress = ((now - startOfMonth) / (endOfMonth - startOfMonth)) * 100;
    document.getElementById("monthProgressBar").style.width = `${monthProgress}%`;
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfYear = new Date(now.getFullYear(), 11, 31);
    const yearProgress = ((now - startOfYear) / (endOfYear - startOfYear)) * 100;
    document.getElementById("yearProgressBar").style.width = `${yearProgress}%`;
}
function toggleFocusMode() { document.body.classList.toggle('focus-mode'); }
function changeProfileName() { const newName = prompt("Enter new name:", profileName); if (newName && newName.trim()) { profileName = newName.trim(); localStorage.setItem("profileName", profileName); document.getElementById("profileName").textContent = profileName; } }
function clearAllData() { if (confirm("Are you sure? This will clear all data.")) { localStorage.clear(); window.location.reload(); } }
function exportData() { const data = JSON.stringify(localStorage); const blob = new Blob([data], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `youfloww_backup.json`; a.click(); URL.revokeObjectURL(url); }

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

    // Event Listeners
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("resetBtn").addEventListener('click', resetTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    document.getElementById("noiseBtn").addEventListener('click', () => { whiteNoise.paused ? whiteNoise.play() : whiteNoise.pause(); document.getElementById("noiseBtn").textContent = whiteNoise.paused ? "🎧 Play Noise" : "🎧 Stop Noise"; });
    const ambienceDropdown = document.querySelector('.ambience-dropdown');
    document.getElementById("ambienceBtn").addEventListener('click', (e) => { e.stopPropagation(); ambienceDropdown.classList.toggle('active'); });
    document.getElementById("snowBtn").addEventListener('click', toggleSnow);
    document.getElementById("rainBtn").addEventListener('click', toggleRain);
    document.getElementById("sakuraBtn").addEventListener('click', toggleSakura);
    document.getElementById("focusModeBtn").addEventListener('click', toggleFocusMode);
    document.getElementById("focusModePlayPauseBtn").addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
    document.getElementById("focusModeExitBtn").addEventListener('click', toggleFocusMode);
    document.getElementById("add-todo-btn").addEventListener('click', addTodo);
    document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);
    document.getElementById('todo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });
    document.getElementById("saveSettingsBtn").addEventListener('click', saveSettings);
    
    window.addEventListener('click', () => ambienceDropdown.classList.remove('active'));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            isRunning ? pauseTimer() : startTimer();
        }
    });
});
