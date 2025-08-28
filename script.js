// ---- Timer Variables ----
let timer, timeLeft = 25*60, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0; // <-- ADDED for accurate background timing
const pomodoroDuration = 25 * 60;
let startTime = Date.now();
// ---- Stats ----
let sessionsToday = parseInt(localStorage.getItem("sessionsToday")) || 0;
let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
let totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
let totalCoinsEarned = parseInt(localStorage.getItem("totalCoinsEarned")) || 0;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastActiveDate = localStorage.getItem("lastActiveDate") || null;
// ---- Coins ----
let coins = parseInt(localStorage.getItem("coins")) || 0;
let sessionCoinsToday = parseInt(localStorage.getItem("sessionCoinsToday")) || 0;
document.getElementById("coinCount").textContent = coins;
const startSound = document.getElementById("startSound");
const endSound = document.getElementById("endSound");
const coinSound = document.getElementById("coinSound");
const whiteNoise = document.getElementById("whiteNoise");
const noiseBtn = document.getElementById("noiseBtn");
// New: Profile Variables
let profileName = localStorage.getItem("profileName") || "Floww User";
document.getElementById("profileName").textContent = profileName;
// Initialize weekly stats if not exists
if (!localStorage.getItem("weeklyStats")) {
    localStorage.setItem("weeklyStats", JSON.stringify([]));
}
// ---- Timer Functions ----
function updateTimerDisplay(){
  const minutes=Math.floor(timeLeft/60);
  const seconds=timeLeft%60;
  const timeString = `${minutes}:${seconds<10?'0':''}${seconds}`;
  document.getElementById("timer").textContent = timeString;
  document.getElementById("focusModeTimer").textContent = timeString;
  const progress = ((pomodoroDuration - timeLeft) / pomodoroDuration) * 100;
  document.getElementById("focusModeProgressBar").style.width = `${progress}%`;
}
function updateStatus(){ document.getElementById("status").textContent=isWorkSession?"Work Session":"Break Time"; }

// THIS IS THE CORRECTED, ACCURATE startTimer FUNCTION
function startTimer() {
    if (!isRunning) {
        isRunning = true;
        // Calculate the exact time in the future when the timer should end
        endTime = Date.now() + timeLeft * 1000;

        document.getElementById("startBtn").disabled = true;
        document.getElementById("pauseBtn").disabled = false;
        document.getElementById("focusModePlayPauseBtn").classList.remove('paused');
        startSound.play();

        timer = setInterval(() => {
            // Calculate remaining time on every tick
            const remaining = endTime - Date.now();
            timeLeft = Math.round(remaining / 1000);

            if (timeLeft <= 0) {
                clearInterval(timer);
                timeLeft = 0; // Ensure timer display is clean
                updateTimerDisplay();
                isRunning = false;
                document.getElementById("startBtn").disabled = false;
                document.getElementById("pauseBtn").disabled = true;
                endSound.play();
                handleSessionCompletion();
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }
}

function endSession(){
    clearInterval(timer);
    isRunning = false;
    if(timeLeft < 25*60 && timeLeft > 60){
        savePartialSession();
    }
    timeLeft = 25*60;
    isWorkSession = true;
    sessionCount = 0;
    updateTimerDisplay();
    updateStatus();
    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
}
function savePartialSession(){
    const minutesFocused = Math.floor((pomodoroDuration - timeLeft)/60);
    if(minutesFocused >= 1){
        sessionsToday++;
        localStorage.setItem("sessionsToday", sessionsToday);
        checkStreak();
        addFocusMinutes(minutesFocused);
        const coinsThisSession = Math.floor(minutesFocused/5) + sessionCoinsToday*5;
        coins += coinsThisSession;
        sessionCoinsToday++;
        localStorage.setItem("coins", coins);
        localStorage.setItem("sessionCoinsToday", sessionCoinsToday);
        document.getElementById("coinCount").textContent = coins;
        const popup = document.getElementById("coinPopup");
        document.getElementById("coinEarned").textContent = coinsThisSession;
        popup.style.display = "block";
        coinSound.play();
        setTimeout(()=>{popup.style.display="none";},2000);
    }
}
function pauseTimer(){
    clearInterval(timer);
    isRunning = false;
    document.getElementById("startBtn").disabled = false;
    document.getElementById("pauseBtn").disabled = true;
    document.getElementById("focusModePlayPauseBtn").classList.add('paused');
}
function resetTimer(){
    clearInterval(timer);
    isRunning=false;
    if(timeLeft < pomodoroDuration && timeLeft > 25){
        savePartialSession();
    }
    isWorkSession=true;
    sessionCount=0;
    timeLeft=pomodoroDuration;
    updateTimerDisplay();
    updateStatus();
    document.getElementById("startBtn").disabled=false;
    document.getElementById("pauseBtn").disabled=true;
}
// ---- Session Completion ----
function handleSessionCompletion(){
  if(isWorkSession){
    sessionCount++;
    sessionsToday++;
    localStorage.setItem("sessionsToday", sessionsToday);
    checkStreak();
    addFocusMinutes(pomodoroDuration / 60);
    rewardCoins();
    if(sessionCount%4===0) timeLeft=15*60;
    else timeLeft=5*60;
    isWorkSession=false;
  }else{
    timeLeft=pomodoroDuration;
    isWorkSession=true;
  }
  updateTimerDisplay();
  updateStatus();
}
function checkStreak(){
  const today = new Date().toDateString();
  if(lastActiveDate !== today){
    if(lastActiveDate){
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if(lastActiveDate === yesterday.toDateString()){
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
// ---- Enhanced Weekly Focus Tracking ----
function addFocusMinutes(minutes){
  const today = new Date().toISOString().slice(0,10);
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
  const todayStr = today.toISOString().slice(0,10);
  if (weekData.lastUpdated !== todayStr) {
    weekData.daysActive = weekData.daysActive ? weekData.daysActive + 1 : 1;
    weekData.lastUpdated = todayStr;
  }
  localStorage.setItem("weeklyStats", JSON.stringify(weeklyStats));
}
function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
}
function getWeeklyFocus(){
  const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
  const today = new Date();
  let totalMinutes = 0;
  for(let i=0; i<7; i++){
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = day.toISOString().slice(0,10);
    if(weeklyData[key]) totalMinutes += weeklyData[key];
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {hours, minutes};
}
// ---- Stats Modal ----
function openStats(){
  const modal = document.getElementById("statsModal");
  modal.style.display = "flex";
  updateStatsModal();
  renderCharts();
  updateHistoryTable();
  modal.onclick = function(e){
    if(e.target === modal) closeStats();
  }
}
function closeStats(){
  document.getElementById("statsModal").style.display = "none";
}
function updateStatsModal(){
  document.getElementById("streak").textContent = `🔥 Streak: ${streak} days`;
  document.getElementById("sessionsToday").textContent = `📊 Sessions today: ${sessionsToday}`;
  const weeklyFocus = getWeeklyFocus();
  document.getElementById("weeklyFocus").textContent = `⏳ Focused this week: ${weeklyFocus.hours}h ${weeklyFocus.minutes}m`;
}
// ---- Chart Functions ----
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
                backgroundColor: '#f7a047',
                borderColor: '#d1822e',
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
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}
function renderPieChart() {
    const totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes") || 0);
    const totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
    const totalBreakMinutes = totalSessions * 5;
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
                data: [totalFocusMinutes, totalBreakMinutes],
                backgroundColor: ['#f7a047', '#6c63ff'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}
function updateHistoryTable() {
    const weeklyStats = JSON.parse(localStorage.getItem("weeklyStats") || "[]");
    const tableBody = document.getElementById("historyTableBody");
    tableBody.innerHTML = "";
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
        tableBody.appendChild(row);
    });
    if (weeklyStats.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4">No data available yet</td></tr>`;
    }
}
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active');
    document.getElementById(`${tabName}Container`).classList.add('active');
    if (tabName === 'profile') {
        updateProfile();
    }
    if (tabName === 'store') {
        updateStoreUI();
    }
    if (tabName === 'stats' || tabName === 'history') {
        renderCharts();
        updateHistoryTable();
    }
}
// ---- Data Management Functions ----
function exportData() {
  const allData = { ...localStorage };
  const dataStr = JSON.stringify(allData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  const exportFileDefaultName = `youfloww-data-${new Date().toISOString().slice(0,10)}.json`;
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}
function clearAllData() {
    if (confirm("Are you sure you want to clear all data? This cannot be undone!")) {
        localStorage.clear();
        location.reload(); 
    }
}
// ---- Coin System ----
function rewardCoins(){
  const coinsThisSession = 5 + sessionCoinsToday*5;
  coins += coinsThisSession;
  totalCoinsEarned += coinsThisSession;
  sessionCoinsToday++;
  localStorage.setItem("coins", coins);
  localStorage.setItem("totalCoinsEarned", totalCoinsEarned);
  localStorage.setItem("sessionCoinsToday", sessionCoinsToday);
  document.getElementById("coinCount").textContent = coins;
  const popup = document.getElementById("coinPopup");
  document.getElementById("coinEarned").textContent = coinsThisSession;
  popup.style.display = "block";
  coinSound.play();
  setTimeout(() => { popup.style.display = "none"; }, 2000);
}
// ---- White Noise Function ----
function toggleWhiteNoise() {
    if (whiteNoise.paused) {
        whiteNoise.play();
        noiseBtn.textContent = "🎧 Stop Noise";
    } else {
        whiteNoise.pause();
        noiseBtn.textContent = "🎧 Play Noise";
    }
}
// ---- To-Do List Functions ----
function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos')) || [];
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.textContent = todo.text;
        li.className = 'todo-item';
        if (todo.completed) {
            li.classList.add('completed');
        }
        li.onclick = () => toggleTodo(todo.text);
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
document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);

function clearTodos() {
    if (confirm("Are you sure you want to clear all tasks?")) {
        localStorage.removeItem('todos');
        loadTodos();
    }
}
// ---- Corner Widget: Time + Progress ----
function updateCornerWidget(){
  const now = new Date();
  const hours = now.getHours().toString().padStart(2,'0');
  const minutes = now.getMinutes().toString().padStart(2,'0');
  const seconds = now.getSeconds().toString().padStart(2,'0');
  document.getElementById("liveTime").textContent = `${hours}:${minutes}:${seconds} ${now.toDateString()}`;
  const dayPercent = ((now.getHours()*60 + now.getMinutes()) / (24*60)) * 100;
  document.getElementById("dayProgressBar").style.width = dayPercent + "%";
  const totalDays = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const monthPercent = (now.getDate() / totalDays) * 100;
  document.getElementById("monthProgressBar").style.width = monthPercent + "%";
  const startYear = new Date(now.getFullYear(), 0, 1);
  const endYear = new Date(now.getFullYear() + 1, 0, 1);
  const yearPercent = ((now - startYear) / (endYear - startYear)) * 100;
  document.getElementById("yearProgressBar").style.width = yearPercent + "%";
}
// New: Ambient Effects Variables
const ambientContainer = document.getElementById('ambient-container');
let ambientInterval;
// New: Function to start snow animation
function startSnow() {
    stopAmbientEffects();
    ambientContainer.className = 'snow';
    ambientInterval = setInterval(() => {
        const snowflake = createAmbientElement('snowflake');
        animateAmbientElement(snowflake, 8000, 15000, 'fall');
    }, 100);
}
// New: Function to start rain animation
function startRain() {
    stopAmbientEffects();
    ambientContainer.className = 'rain';
    ambientInterval = setInterval(() => {
        const raindrop = createAmbientElement('raindrop');
        animateAmbientElement(raindrop, 400, 800, 'fall');
    }, 50);
}
// New: Function to start sakura animation
function startSakura() {
    stopAmbientEffects();
    ambientContainer.className = 'sakura';
    ambientInterval = setInterval(() => {
        const petal = createAmbientElement('sakura');
        animateAmbientElement(petal, 15000, 25000, 'spinFall');
    }, 250);
}
// New: Helper function to create the elements
function createAmbientElement(className) {
    const el = document.createElement('div');
    el.className = `ambient-effect ${className}`;
    el.style.left = `${Math.random() * 100}vw`;
    ambientContainer.appendChild(el);
    return el;
}
// New: Helper function to animate the elements
function animateAmbientElement(el, minDuration, maxDuration, animationName) {
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    el.style.animation = `${animationName} ${duration}ms linear forwards`;
    el.style.animationDelay = `-${Math.random() * duration}ms`;
    el.style.transform = `translateY(-20vh)`;
    el.addEventListener('animationend', () => {
        el.remove();
    });
}
// New: Function to stop all ambient effects
function stopAmbientEffects() {
    clearInterval(ambientInterval);
    ambientContainer.innerHTML = '';
}
// New: Profile and Store Logic
function updateProfile() {
    let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
    let totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
    let totalCoinsEarned = parseInt(localStorage.getItem("totalCoinsEarned")) || 0;
    const hours = Math.floor(totalFocusMinutes / 60);
    const minutes = totalFocusMinutes % 60;
    document.getElementById("profileName").textContent = profileName;
    document.getElementById("totalFocusTime").textContent = `${hours}h ${minutes}m`;
    document.getElementById("totalSessions").textContent = totalSessions;
    document.getElementById("totalCoinsEarned").textContent = totalCoinsEarned;
    updateStoreUI();
}
function changeProfileName() {
    let newName = prompt("Enter your new name:");
    if (newName && newName.trim() !== "") {
        profileName = newName;
        localStorage.setItem("profileName", profileName);
        document.getElementById("profileName").textContent = profileName;
    }
}
function purchaseItem(buttonElement) {
    const item = buttonElement.closest('.store-item');
    const price = parseInt(item.dataset.price);
    const feature = item.dataset.feature;
    if (coins >= price) {
        coins -= price;
        localStorage.setItem("coins", coins);
        document.getElementById("coinCount").textContent = coins;
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
            if (feature.startsWith("background-theme")) {
                button.textContent = "Select";
                button.onclick = () => applyBackgroundTheme(item.dataset.path);
                button.disabled = false;
            } else {
                button.textContent = "Unlocked";
                button.disabled = true;
            }
        } else {
            button.textContent = `Buy (${price} 💰)`;
            button.onclick = () => purchaseItem(button);
            button.disabled = coins < price;
        }
    });
}
function applyBackgroundTheme(path) {
    document.body.style.backgroundImage = `url('${path}')`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    localStorage.setItem("currentBackgroundPath", path);
    localStorage.removeItem('youtubeVideoId');
    localStorage.removeItem('customBackground');
    document.getElementById("video-background-container").innerHTML = '';
}
function setYoutubeBackground() {
    const youtubeInput = document.getElementById("youtube-input");
    const url = youtubeInput.value;
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
        const container = document.getElementById("video-background-container");
        container.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0"
                frameborder="0"
                allow="autoplay; encrypted-media"
                allowfullscreen
            ></iframe>
        `;
        localStorage.setItem('youtubeVideoId', videoId);
        localStorage.removeItem('customBackground');
        localStorage.removeItem("currentBackgroundPath");
        document.body.style.backgroundImage = 'none';
        alert("YouTube background set!");
    } else {
        alert("Please enter a valid YouTube URL.");
    }
}
function removeYoutubeBackground() {
    const container = document.getElementById("video-background-container");
    container.innerHTML = '';
    localStorage.removeItem('youtubeVideoId');
    alert("YouTube video removed.");
}
function setCustomBackground() {
    const fileInput = document.getElementById('custom-image-input');
    const file = fileInput.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            document.body.style.backgroundImage = `url('${dataUrl}')`;
            localStorage.setItem('customBackground', dataUrl);
            localStorage.removeItem('youtubeVideoId');
            localStorage.removeItem("currentBackgroundPath");
            document.getElementById("video-background-container").innerHTML = '';
        };
        reader.readAsDataURL(file);
    }
}
function removeCustomBackground() {
    document.body.style.backgroundImage = 'none';
    localStorage.removeItem('customBackground');
    alert("Custom background removed.");
}
function getYoutubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}
function toggleFocusMode() {
    const body = document.body;
    body.classList.toggle('focus-mode');
}
// Attach event listeners after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("focusModeBtn").addEventListener('click', toggleFocusMode);
    document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
    document.getElementById("removeYoutubeBtn").addEventListener('click', removeYoutubeBackground);
    document.getElementById("focusModePlayPauseBtn").addEventListener('click', () => {
        if(isRunning){
            pauseTimer();
        } else {
            startTimer();
        }
    });
    document.getElementById("focusModeExitBtn").addEventListener('click', () => {
        toggleFocusMode();
    });
    document.getElementById("custom-image-input").addEventListener('change', setCustomBackground);
    document.getElementById("removeCustomBgBtn").addEventListener('click', removeCustomBackground);
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    document.getElementById("add-todo-btn").addEventListener('click', addTodo);
    
    // Initial load check for backgrounds
    const savedYoutubeId = localStorage.getItem('youtubeVideoId');
    const savedCustomBg = localStorage.getItem('customBackground');
    const savedBackgroundPath = localStorage.getItem('currentBackgroundPath');

    if (savedYoutubeId) {
        const youtubeInput = document.getElementById("youtube-input");
        youtubeInput.value = `https://www.youtube.com/watch?v=${savedYoutubeId}`;
        setYoutubeBackground(); 
    } else if (savedCustomBg) {
        document.body.style.backgroundImage = `url('${savedCustomBg}')`;
    } else if (savedBackgroundPath) {
        applyBackgroundTheme(savedBackgroundPath);
    }
});
setInterval(updateCornerWidget, 1000);
updateTimerDisplay();
updateStatus();
updateCornerWidget();
loadTodos();
window.addEventListener("beforeunload", function (e) {
    if(isRunning && timeLeft < pomodoroDuration && timeLeft > 0){
        savePartialSession();
    }
});

document.getElementById('todo-input').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTodo();
    }
});
