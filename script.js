// ---- Variables ----
let timer, timeLeft = 25 * 60, isRunning = false, isWorkSession = true, sessionCount = 0;
let sessionsToday = parseInt(localStorage.getItem("sessionsToday")) || 0;
let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
let totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
let totalCoinsEarned = parseInt(localStorage.getItem("totalCoinsEarned")) || 0;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastActiveDate = localStorage.getItem("lastActiveDate") || null;
let coins = parseInt(localStorage.getItem("coins")) || 0;
let sessionCoinsToday = parseInt(localStorage.getItem("sessionCoinsToday")) || 0;
let profileName = localStorage.getItem("profileName") || "Floww User";

const startSound = document.getElementById("startSound");
const endSound = document.getElementById("endSound");
const coinSound = document.getElementById("coinSound");
const whiteNoise = document.getElementById("whiteNoise");

const timerDisplay = document.getElementById("timer");
const statusDisplay = document.getElementById("status");
const coinCountDisplay = document.getElementById("coinCount");
const statsModal = document.getElementById("statsModal");
const coinPopup = document.getElementById("coinPopup");
const streakDisplay = document.getElementById("streak");
const sessionsTodayDisplay = document.getElementById("sessionsToday");
const weeklyFocusDisplay = document.getElementById("weeklyFocus");
const profileNameDisplay = document.getElementById("profileName");
const totalFocusTimeDisplay = document.getElementById("totalFocusTime");
const totalSessionsDisplay = document.getElementById("totalSessions");
const totalCoinsEarnedDisplay = document.getElementById("totalCoinsEarned");
const historyTableBody = document.getElementById("historyTableBody");
const todoInput = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const endSessionBtn = document.getElementById("endSessionBtn");
const noiseBtn = document.getElementById("noiseBtn");
const viewStatsBtn = document.getElementById("viewStatsBtn");
const closeModalBtn = document.querySelector(".close-btn");
const uploadBgBtn = document.getElementById("uploadBgBtn");
const exportDataBtn = document.getElementById("exportDataBtn");
const clearDataBtn = document.getElementById("clearDataBtn");
const addTodoBtn = document.getElementById("add-todo-btn");
const clearTodosBtn = document.querySelector(".clear-todos-btn");
const changeProfileNameBtn = document.getElementById("changeProfileNameBtn");
const snowBtn = document.getElementById("snowBtn");
const rainBtn = document.getElementById("rainBtn");
const stopAmbientBtn = document.getElementById("stopAmbientBtn");
const storeItemsContainer = document.getElementById("storeItems");
const tabs = document.querySelectorAll(".tabs .tab");

// New: Ambient Effects Variables
const ambientContainer = document.getElementById('ambient-container');
let ambientInterval;

// ---- Event Listeners ----
startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
resetBtn.addEventListener("click", resetTimer);
endSessionBtn.addEventListener("click", endSession);
noiseBtn.addEventListener("click", toggleWhiteNoise);
viewStatsBtn.addEventListener("click", openStats);
closeModalBtn.addEventListener("click", closeStats);
uploadBgBtn.addEventListener("click", uploadStatsBackground);
exportDataBtn.addEventListener("click", exportData);
clearDataBtn.addEventListener("click", clearAllData);
addTodoBtn.addEventListener("click", addTodo);
clearTodosBtn.addEventListener("click", clearTodos);
changeProfileNameBtn.addEventListener("click", changeProfileName);
snowBtn.addEventListener("click", startSnow);
rainBtn.addEventListener("click", startRain);
stopAmbientBtn.addEventListener("click", stopAmbientEffects);
todoInput.addEventListener("keydown", (e) => {
    if (e.key === 'Enter') addTodo();
});
statsModal.addEventListener("click", (e) => {
    if (e.target === statsModal) closeStats();
});
tabs.forEach(tab => tab.addEventListener("click", (e) => {
    const tabName = e.target.dataset.tab;
    switchTab(tabName);
}));
storeItemsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("purchase-btn")) {
        purchaseItem(e.target.closest(".store-item"));
    }
});


// ---- Timer Functions ----
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

function updateStatus() {
    statusDisplay.textContent = isWorkSession ? "Work Session" : "Break Time";
}

function startTimer() {
    if (!isRunning) {
        startSound.play();
        isRunning = true;
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        timer = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timer);
                isRunning = false;
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                endSound.play();
                handleSessionCompletion();
            }
        }, 1000);
    }
}

function pauseTimer() {
    clearInterval(timer);
    isRunning = false;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

function resetTimer() {
    clearInterval(timer);
    isRunning = false;
    if (timeLeft < 25 * 60 && timeLeft > 25) {
        savePartialSession();
    }
    isWorkSession = true;
    sessionCount = 0;
    timeLeft = 25 * 60;
    updateTimerDisplay();
    updateStatus();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

function endSession() {
    clearInterval(timer);
    isRunning = false;
    if (timeLeft < 25 * 60 && timeLeft > 60) {
        savePartialSession();
    }
    timeLeft = 25 * 60;
    isWorkSession = true;
    sessionCount = 0;
    updateTimerDisplay();
    updateStatus();
    startBtn.disabled = false;
    pauseBtn.disabled = true;
}

// ---- Session Completion & Data Logic ----
function savePartialSession() {
    const minutesFocused = Math.floor((25 * 60 - timeLeft) / 60);
    if (minutesFocused >= 1) {
        sessionsToday++;
        localStorage.setItem("sessionsToday", sessionsToday);
        checkStreak();
        addFocusMinutes(minutesFocused);
        const coinsThisSession = Math.floor(minutesFocused / 5) + sessionCoinsToday * 5;
        coins += coinsThisSession;
        sessionCoinsToday++;
        localStorage.setItem("coins", coins);
        localStorage.setItem("sessionCoinsToday", sessionCoinsToday);
        coinCountDisplay.textContent = coins;
        showCoinPopup(coinsThisSession);
    }
}

function handleSessionCompletion() {
    if (isWorkSession) {
        sessionCount++;
        sessionsToday++;
        localStorage.setItem("sessionsToday", sessionsToday);
        checkStreak();
        addFocusMinutes(25);
        rewardCoins();
        if (sessionCount % 4 === 0) timeLeft = 15 * 60;
        else timeLeft = 5 * 60;
        isWorkSession = false;
    } else {
        timeLeft = 25 * 60;
        isWorkSession = true;
    }
    updateTimerDisplay();
    updateStatus();
    startTimer();
}

function checkStreak() {
    const today = new Date().toDateString();
    if (lastActiveDate !== today) {
        if (lastActiveDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastActiveDate === yesterday.toDateString()) {
                streak++;
            } else {
                streak = 1;
            }
        } else {
            streak = 1;
        }
        lastActiveDate = today;
        localStorage.setItem("streak", streak);
        localStorage.setItem("lastActiveDate", lastActiveDate);
        sessionCoinsToday = 0;
        localStorage.setItem("sessionCoinsToday", sessionCoinsToday);
    }
}

function addFocusMinutes(minutes) {
    const today = new Date().toISOString().slice(0, 10);
    let weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    weeklyData[today] = (weeklyData[today] || 0) + minutes;
    localStorage.setItem("weeklyFocus", JSON.stringify(weeklyData));

    updateWeeklyStats(minutes);

    totalFocusMinutes += minutes;
    totalSessions++;
    localStorage.setItem("totalFocusMinutes", totalFocusMinutes);
    localStorage.setItem("totalSessions", totalSessions);
}

function updateWeeklyStats(minutes) {
    const today = new Date();
    const weekStart = getWeekStartDate(today);
    const weekKey = weekStart.toISOString().slice(0, 10);

    let weeklyStats = JSON.parse(localStorage.getItem("weeklyStats") || "[]");
    let weekData = weeklyStats.find(w => w.weekStart === weekKey);

    if (!weekData) {
        weekData = {
            weekStart: weekKey,
            totalMinutes: 0,
            sessions: 0,
            daysActive: 0,
            lastUpdated: today.toISOString().slice(0, 10)
        };
        weeklyStats.push(weekData);
    }

    weekData.totalMinutes += minutes;
    weekData.sessions += 1;

    if (weekData.lastUpdated !== today.toISOString().slice(0, 10)) {
        weekData.daysActive += 1;
        weekData.lastUpdated = today.toISOString().slice(0, 10);
    }

    localStorage.setItem("weeklyStats", JSON.stringify(weeklyStats));
}

function getWeekStartDate(date) {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
}

function getWeeklyFocus() {
    const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    const today = new Date();
    let totalMinutes = 0;
    for (let i = 0; i < 7; i++) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const key = day.toISOString().slice(0, 10);
        if (weeklyData[key]) totalMinutes += weeklyData[key];
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return { hours, minutes };
}

// ---- Stats Modal & Data Management ----
function openStats() {
    statsModal.style.display = "flex";
    updateStatsModal();
    applySavedStatsBackground();
    renderCharts();
    updateHistoryTable();
    switchTab('stats');
}

function closeStats() {
    statsModal.style.display = "none";
}

function updateStatsModal() {
    streakDisplay.textContent = `🔥 Streak: ${streak} days`;
    sessionsTodayDisplay.textContent = `📊 Sessions today: ${sessionsToday}`;
    const weeklyFocus = getWeeklyFocus();
    weeklyFocusDisplay.textContent = `⏳ Focused this week: ${weeklyFocus.hours}h ${weeklyFocus.minutes}m`;
}

function uploadStatsBackground() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            const modalContent = document.getElementById("statsContent");
            modalContent.style.backgroundImage = `url(${reader.result})`;
            localStorage.setItem("statsBackground", reader.result);
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function applySavedStatsBackground() {
    const savedBg = localStorage.getItem("statsBackground");
    if (savedBg) {
        document.getElementById("statsContent").style.backgroundImage = `url(${savedBg})`;
    }
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
    
    document.querySelector(`.tab[data-tab='${tabName}']`).classList.add('active');
    document.getElementById(`${tabName}Tab`).style.display = 'block';

    if (tabName === 'stats') {
      document.getElementById('barChartContainer').style.display = 'block';
    }
    if (tabName === 'profile') updateProfile();
    if (tabName === 'store') updateStoreUI();
}

function exportData() {
    const weeklyFocus = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    const weeklyStats = JSON.parse(localStorage.getItem("weeklyStats") || "[]");
    const data = {
        exportDate: new Date().toISOString(),
        weeklyFocus,
        weeklyStats,
        streak: localStorage.getItem("streak"),
        coins: localStorage.getItem("coins"),
        profileName: localStorage.getItem("profileName")
    };
    const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(data, null, 2));
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataStr);
    linkElement.setAttribute('download', `youfloww-data-${new Date().toISOString().slice(0, 10)}.json`);
    linkElement.click();
}

function clearAllData() {
    if (confirm("Are you sure you want to clear all data? This cannot be undone!")) {
        localStorage.clear();
        window.location.reload(); // Simplest way to reset all state
    }
}

// ---- Charts ----
function renderCharts() {
    renderBarChart();
    renderPieChart();
}

function renderBarChart() {
    const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    const today = new Date();
    const labels = [];
    const data = [];

    for (let i = 6; i >= 0; i--) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const key = day.toISOString().slice(0, 10);
        const dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
        labels.push(dayName);
        data.push((weeklyData[key] || 0) / 60);
    }
    
    const canvas = document.getElementById('barChart');
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart instance if it exists
    if (window.myBarChart) {
      window.myBarChart.destroy();
    }
    
    window.myBarChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Focus (hours)',
          data: data,
          backgroundColor: '#4CAF50',
          borderColor: '#45a049',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Hours'
            }
          }
        }
      }
    });
}

function renderPieChart() {
    const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
    const today = new Date();
    const sessionTypes = {
      'Work': 0,
      'Break': 0,
    };
    
    let totalMinutes = 0;
    
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today);
      day.setDate(today.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      const minutes = weeklyData[key] || 0;
      totalMinutes += minutes;
      
      // Simplified: Assume all sessions are work sessions.
      // A more complex system would track break times separately.
      sessionTypes['Work'] += minutes;
    }
    
    const canvas = document.getElementById('pieChart');
    const ctx = canvas.getContext('2d');
    
    if (window.myPieChart) {
      window.myPieChart.destroy();
    }
    
    window.myPieChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: ['Work Sessions', 'Break Sessions'],
        datasets: [{
          data: [totalFocusMinutes, totalSessions * 5], // Example. A more robust solution would track break time.
          backgroundColor: ['#4CAF50', '#2196F3'],
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      }
    });
}

function updateHistoryTable() {
    const weeklyStats = JSON.parse(localStorage.getItem("weeklyStats") || "[]");
    historyTableBody.innerHTML = "";
    weeklyStats.sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
    weeklyStats.forEach(week => {
        const hours = (week.totalMinutes / 60).toFixed(1);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${formatDate(week.weekStart)}</td>
            <td>${hours}h</td>
            <td>${week.sessions}</td>
            <td>${week.daysActive}</td>
        `;
        historyTableBody.appendChild(row);
    });
    if (weeklyStats.length === 0) {
        historyTableBody.innerHTML = `<tr><td colspan="4">No data available yet</td></tr>`;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---- Coin System ----
function rewardCoins() {
    const coinsThisSession = 5 + sessionCoinsToday * 5;
    coins += coinsThisSession;
    totalCoinsEarned += coinsThisSession;
    localStorage.setItem("coins", coins);
    localStorage.setItem("totalCoinsEarned", totalCoinsEarned);
    sessionCoinsToday++;
    localStorage.setItem("sessionCoinsToday", sessionCoinsToday);
    coinCountDisplay.textContent = coins;
    showCoinPopup(coinsThisSession);
}

function showCoinPopup(earned) {
    document.getElementById("coinEarned").textContent = earned;
    coinPopup.style.display = "block";
    coinSound.play();
    setTimeout(() => {
        coinPopup.style.display = "none";
    }, 2000);
}

// ---- White Noise ----
function toggleWhiteNoise() {
    if (whiteNoise.paused) {
        whiteNoise.play();
        noiseBtn.textContent = "🎧 Stop Noise";
    } else {
        whiteNoise.pause();
        noiseBtn.textContent = "🎧 Play Noise";
    }
}

// ---- To-Do List ----
function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos')) || [];
    todoList.innerHTML = '';
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.textContent = todo.text;
        li.className = 'todo-item';
        if (todo.completed) {
            li.classList.add('completed');
        }
        li.addEventListener("click", () => toggleTodo(todo.text));
        todoList.appendChild(li);
    });
}

function addTodo() {
    const text = todoInput.value.trim();
    if (text) {
        let todos = JSON.parse(localStorage.getItem('todos')) || [];
        todos.push({ text, completed: false });
        localStorage.setItem('todos', JSON.stringify(todos));
        todoInput.value = '';
        loadTodos();
    }
}

function toggleTodo(text) {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    todos = todos.map(todo => {
        if (todo.text === text) {
            todo.completed = !todo.completed;
        }
        return todo;
    });
    localStorage.setItem('todos', JSON.stringify(todos));
    loadTodos();
}

function clearTodos() {
    if (confirm("Are you sure you want to clear all tasks?")) {
        localStorage.removeItem('todos');
        loadTodos();
    }
}

// ---- Corner Widget ----
function updateCornerWidget() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    document.getElementById("liveTime").textContent = `${hours}:${minutes}:${seconds} ${now.toDateString()}`;
    const dayPercent = ((now.getHours() * 60 + now.getMinutes()) / (24 * 60)) * 100;
    document.getElementById("dayProgressBar").style.width = dayPercent + "%";
    const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPercent = (now.getDate() / totalDays) * 100;
    document.getElementById("monthProgressBar").style.width = monthPercent + "%";
    const startYear = new Date(now.getFullYear(), 0, 1);
    const endYear = new Date(now.getFullYear() + 1, 0, 1);
    const yearPercent = ((now - startYear) / (endYear - startYear)) * 100;
    document.getElementById("yearProgressBar").style.width = yearPercent + "%";
}

// ---- Ambient Effects ----
function createAmbientElement(className) {
    const el = document.createElement('div');
    el.className = `ambient-effect ${className}`;
    el.style.left = `${Math.random() * 100}vw`;
    ambientContainer.appendChild(el);
    return el;
}

function animateAmbientElement(el, minDuration, maxDuration) {
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    el.style.animation = `fall ${duration}ms linear forwards`;
    el.style.animationDelay = `-${Math.random() * duration}ms`;
    el.style.transform = `translateY(-20vh)`;
    el.addEventListener('animationend', () => {
        el.remove();
    });
}

function startSnow() {
    stopAmbientEffects();
    ambientContainer.className = 'snow';
    ambientInterval = setInterval(() => {
        const snowflake = createAmbientElement('snowflake');
        animateAmbientElement(snowflake, 8000, 15000);
    }, 100);
}

function startRain() {
    stopAmbientEffects();
    ambientContainer.className = 'rain';
    ambientInterval = setInterval(() => {
        const raindrop = createAmbientElement('raindrop');
        animateAmbientElement(raindrop, 400, 800);
    }, 50);
}

function stopAmbientEffects() {
    clearInterval(ambientInterval);
    ambientContainer.innerHTML = '';
}

// ---- Profile and Store ----
function updateProfile() {
    const hours = Math.floor(totalFocusMinutes / 60);
    const minutes = totalFocusMinutes % 60;
    profileNameDisplay.textContent = profileName;
    totalFocusTimeDisplay.textContent = `${hours}h ${minutes}m`;
    totalSessionsDisplay.textContent = totalSessions;
    totalCoinsEarnedDisplay.textContent = totalCoinsEarned;
    updateStoreUI();
}

function changeProfileName() {
    const newName = prompt("Enter your new name:");
    if (newName && newName.trim() !== "") {
        profileName = newName;
        localStorage.setItem("profileName", profileName);
        profileNameDisplay.textContent = profileName;
    }
}

function purchaseItem(item) {
    const price = parseInt(item.dataset.price);
    const feature = item.dataset.feature;
    if (coins >= price) {
        coins -= price;
        localStorage.setItem("coins", coins);
        coinCountDisplay.textContent = coins;
        let unlockedFeatures = JSON.parse(localStorage.getItem("unlockedFeatures")) || [];
        unlockedFeatures.push(feature);
        localStorage.setItem("unlockedFeatures", JSON.stringify(unlockedFeatures));
        alert(`You have purchased a new feature! (${feature})`);
        updateStoreUI();
    } else {
        alert("Not enough coins!");
    }
}

function updateStoreUI() {
    const unlockedFeatures = JSON.parse(localStorage.getItem("unlockedFeatures")) || [];
    const storeItems = document.querySelectorAll(".store-item");
    storeItems.forEach(item => {
        const feature = item.dataset.feature;
        const price = parseInt(item.dataset.price);
        const button = item.querySelector("button");
        if (unlockedFeatures.includes(feature)) {
            button.textContent = "Unlocked";
            button.disabled = true;
        } else {
            button.textContent = `Buy (${price} 💰)`;
            button.disabled = coins < price;
        }
    });
}

function applyBackgroundTheme(path) {
    document.body.style.backgroundImage = `url('${path}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    localStorage.setItem("currentBackgroundPath", path);
}

// ---- Initialization ----
document.addEventListener("DOMContentLoaded", () => {
    updateTimerDisplay();
    updateStatus();
    updateCornerWidget();
    loadTodos();
    coinCountDisplay.textContent = coins;
    const savedBackground = localStorage.getItem("currentBackgroundPath");
    if (savedBackground) {
        applyBackgroundTheme(savedBackground);
    }
});

setInterval(updateCornerWidget, 1000);

window.addEventListener("beforeunload", () => {
    if (timeLeft < 25 * 60 && timeLeft > 60) {
        savePartialSession();
    }
});
