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
let totalCoinsEarned = parseInt(localStorage.getItem("totalCoinsEarned")) || 0;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastActiveDate = localStorage.getItem("lastActiveDate") || null;
let coins = parseInt(localStorage.getItem("coins")) || 0;
let profileName = localStorage.getItem("profileName") || "Floww User";

// ---- DOM Elements and Sounds ----
const startSound = document.getElementById("startSound");
const endSound = document.getElementById("endSound");
const coinSound = document.getElementById("coinSound");
const whiteNoise = document.getElementById("whiteNoise");
const ambientContainer = document.getElementById('ambient-container');

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
    setButtonState(false);
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
// AMBIENT EFFECTS (with Visibility Fix)
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

function startSnowInterval() {
    if (snowInterval || document.hidden) return;
    snowInterval = setInterval(() => {
        animateAmbientElement(createAmbientElement('snowflake'), 8000, 15000, 'fall');
    }, 200);
}

function startRainInterval() {
    if (rainInterval || document.hidden) return;
    rainInterval = setInterval(() => {
        animateAmbientElement(createAmbientElement('raindrop'), 400, 800, 'fall');
    }, 50);
}

function startSakuraInterval() {
    if (sakuraInterval || document.hidden) return;
    sakuraInterval = setInterval(() => {
        animateAmbientElement(createAmbientElement('sakura'), 15000, 25000, 'spinFall');
    }, 500);
}

function toggleSnow() {
    isSnowActive = !isSnowActive;
    document.getElementById('snowBtn').classList.toggle('active', isSnowActive);
    if (isSnowActive) startSnowInterval();
    else { clearInterval(snowInterval); snowInterval = null; }
}

function toggleRain() {
    isRainActive = !isRainActive;
    document.getElementById('rainBtn').classList.toggle('active', isRainActive);
    if (isRainActive) startRainInterval();
    else { clearInterval(rainInterval); rainInterval = null; }
}

function toggleSakura() {
    isSakuraActive = !isSakuraActive;
    document.getElementById('sakuraBtn').classList.toggle('active', isSakuraActive);
    if (isSakuraActive) startSakuraInterval();
    else { clearInterval(sakuraInterval); sakuraInterval = null; }
}

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
// STATS, CHARTS, and MODALS
// ===================================================================================

function openStats() {
    document.getElementById("statsModal").classList.add('visible');
    updateStatsModal();
    renderCharts();
}

function closeStats() {
    document.getElementById("statsModal").classList.remove('visible');
}

function updateStatsModal() {
    // This is a placeholder. You can expand it with more stats.
    document.getElementById("streak").textContent = `🔥 Streak: ${streak} days`;
    document.getElementById("sessionsToday").textContent = `📊 Sessions today: ${sessionsToday}`;
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active');
    document.getElementById(`${tabName}Container`).classList.add('active');
}

function renderCharts() {
    renderBarChart();
    renderPieChart();
}

function renderBarChart() {
    const ctx = document.getElementById('barChart').getContext('2d');
    if (window.myBarChart) window.myBarChart.destroy();
    window.myBarChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'], datasets: [{ label: 'Hours', data: [1,2,3,2,4,3,1], backgroundColor: '#f7a047' }] }
    });
}

function renderPieChart() {
    const ctx = document.getElementById('pieChart').getContext('2d');
    if (window.myPieChart) window.myPieChart.destroy();
    window.myPieChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: ['Work', 'Break'], datasets: [{ data: [totalFocusMinutes, totalSessions * 5], backgroundColor: ['#f7a047', '#6c63ff'] }] }
    });
}

// ===================================================================================
// TO-DO LIST
// ===================================================================================

function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos')) || [];
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        const textSpan = document.createElement('span');
        textSpan.textContent = todo.text;
        textSpan.onclick = () => toggleTodo(index);
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.onclick = (e) => { e.stopPropagation(); editTodo(index); };
        actionsDiv.appendChild(editBtn);
        li.appendChild(textSpan);
        li.appendChild(actionsDiv);
        todoList.appendChild(li);
    });
}

function addTodo() {
    const todoInput = document.getElementById('todo-input');
    const text = todoInput.value.trim();
    if (text) {
        let todos = JSON.parse(localStorage.getItem('todos')) || [];
        todos.push({ text, completed: false });
        localStorage.setItem('todos', JSON.stringify(todos));
        todoInput.value = '';
        loadTodos();
    }
}

function toggleTodo(index) {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    if (todos[index]) {
        todos[index].completed = !todos[index].completed;
        localStorage.setItem('todos', JSON.stringify(todos));
        loadTodos();
    }
}

function editTodo(index) {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    if (todos[index]) {
        const newText = prompt("Edit your task:", todos[index].text);
        if (newText && newText.trim() !== "") {
            todos[index].text = newText.trim();
            localStorage.setItem('todos', JSON.stringify(todos));
            loadTodos();
        }
    }
}

function clearTodos() {
    if (confirm("Are you sure you want to clear all tasks?")) {
        localStorage.removeItem('todos');
        loadTodos();
    }
}

// ===================================================================================
// BACKGROUNDS AND STORE
// ===================================================================================

function applyStoreItem(element) {
    const item = element.closest('.store-item');
    const type = item.dataset.type;
    if (type === 'image') {
        applyBackgroundTheme(item.dataset.path);
    } else if (type === 'youtube') {
        const videoUrl = `https://www.youtube.com/watch?v=${item.dataset.id}`;
        document.getElementById('youtube-input').value = videoUrl;
        setYoutubeBackground();
    }
    closeStats();
}

function applyBackgroundTheme(path) {
    document.body.style.backgroundImage = `url('${path}')`;
    localStorage.setItem("currentBackgroundPath", path);
    localStorage.removeItem('youtubeVideoId');
    document.getElementById("video-background-container").innerHTML = '';
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
        localStorage.removeItem("currentBackgroundPath");
        document.body.style.backgroundImage = 'none';
    } else if (url) {
        alert("Please enter a valid YouTube URL.");
    }
}

// ===================================================================================
// OTHER HELPERS and INITIALIZATION
// ===================================================================================
function changeProfileName() {
    const newName = prompt("Enter your new name:", profileName);
    if(newName && newName.trim() !== "") {
        profileName = newName.trim();
        localStorage.setItem("profileName", profileName);
        document.getElementById("profileName").textContent = profileName;
    }
}

function clearAllData() {
    if(confirm("Are you sure? This will clear all stats, settings, and tasks.")) {
        localStorage.clear();
        window.location.reload();
    }
}

function exportData() {
    // A simple export of all localStorage data
    const data = JSON.stringify(localStorage);
    const blob = new Blob([data], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youfloww_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleFocusMode() {
    document.body.classList.toggle('focus-mode');
}

document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    loadSettings();
    updateStatus();
    updateTimerDisplay();
    setButtonState(false);
    loadTodos();

    // Main Controls
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("resetBtn").addEventListener('click', resetTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    
    // Ambient Controls
    document.getElementById("noiseBtn").addEventListener('click', () => {
        whiteNoise.paused ? whiteNoise.play() : whiteNoise.pause();
        document.getElementById("noiseBtn").textContent = whiteNoise.paused ? "🎧 Play Noise" : "🎧 Stop Noise";
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

    // To-Do
    document.getElementById("add-todo-btn").addEventListener('click', addTodo);
    document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);
    document.getElementById('todo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

    // Settings
    document.getElementById("saveSettingsBtn").addEventListener('click', saveSettings);

    // Store Item Clicks
    document.getElementById('storeItems').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            applyStoreItem(e.target);
        }
    });
    
    // Backgrounds
    document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
    
    // Global Listeners
    window.addEventListener('click', () => {
        ambienceDropdown.classList.remove('active');
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            e.preventDefault();
            isRunning ? pauseTimer() : startTimer();
        }
    });
});
