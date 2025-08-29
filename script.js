// ---- Timer Variables ----
let timer, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0;
let timeLeft; // Will be set by settings

// ---- NEW: Settings Variables ----
let workDuration, shortBreakDuration, longBreakDuration;

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

// ---- Profile Variables ----
let profileName = localStorage.getItem("profileName") || "Floww User";
document.getElementById("profileName").textContent = profileName;

// ---- Initialize weekly stats if not exists ----
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
  
  const currentDuration = isWorkSession ? workDuration : (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration);
  const progress = ((currentDuration - timeLeft) / currentDuration) * 100;
  document.getElementById("focusModeProgressBar").style.width = `${progress}%`;

  // NEW: Dynamic Page Title
  if(isRunning) {
    document.title = `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww`;
  } else {
    document.title = 'YouFloww - Focus Timer & To-Do List';
  }
}

function updateStatus(){ 
    document.getElementById("status").textContent = isWorkSession ? "Work Session" : "Break Time"; 
    document.body.style.backgroundColor = isWorkSession ? 'var(--background-dark)' : '#2E4053';
    document.getElementById('timer').style.color = isWorkSession ? 'var(--primary-color)' : '#AED6F1';
}

function startTimer() {
    if (!isRunning) {
        isRunning = true;
        endTime = Date.now() + timeLeft * 1000;

        document.getElementById("startBtn").disabled = true;
        document.getElementById("pauseBtn").disabled = false;
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
    isWorkSession=true;
    sessionCount=0;
    timeLeft = workDuration;
    updateTimerDisplay();
    updateStatus();
    document.getElementById("startBtn").disabled=false;
    document.getElementById("pauseBtn").disabled=true;
}

function endSession(){
    clearInterval(timer);
    isRunning = false;
    const minutesFocused = Math.floor((workDuration - timeLeft) / 60);
    if(isWorkSession && minutesFocused >= 1){
        savePartialSession(minutesFocused);
    }
    resetTimer();
}

function savePartialSession(minutesFocused){
    sessionsToday++;
    localStorage.setItem("sessionsToday", sessionsToday);
    checkStreak();
    addFocusMinutes(minutesFocused);
    const coinsThisSession = Math.floor(minutesFocused / 5) + sessionCoinsToday * 5;
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
    setTimeout(()=>{popup.style.display="none";},2000);
}

// ---- Session Completion ----
function handleSessionCompletion(){
  if(isWorkSession){
    sessionCount++;
    sessionsToday++;
    localStorage.setItem("sessionsToday", sessionsToday);
    checkStreak();
    addFocusMinutes(workDuration / 60);
    rewardCoins();
    isWorkSession=false;
    if(sessionCount % 4 === 0) timeLeft = longBreakDuration;
    else timeLeft = shortBreakDuration;
  }else{
    isWorkSession=true;
    timeLeft = workDuration;
  }
  updateTimerDisplay();
  updateStatus();
  // Auto-start next timer
  setTimeout(startTimer, 1000);
}

// ---- NEW: Settings ----
function loadSettings() {
    workDuration = parseInt(localStorage.getItem("workDuration")) || 25 * 60;
    shortBreakDuration = parseInt(localStorage.getItem("shortBreakDuration")) || 5 * 60;
    longBreakDuration = parseInt(localStorage.getItem("longBreakDuration")) || 15 * 60;
    timeLeft = workDuration;

    document.getElementById('work-duration').value = workDuration / 60;
    document.getElementById('short-break-duration').value = shortBreakDuration / 60;
    document.getElementById('long-break-duration').value = longBreakDuration / 60;
}

function saveSettings() {
    const newWork = parseInt(document.getElementById('work-duration').value) * 60;
    const newShort = parseInt(document.getElementById('short-break-duration').value) * 60;
    const newLong = parseInt(document.getElementById('long-break-duration').value) * 60;

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

// ---- Stats and Data ----
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
function addFocusMinutes(minutes){
    totalFocusMinutes += Math.round(minutes);
    localStorage.setItem("totalFocusMinutes", totalFocusMinutes);
}

// ---- Modal and UI ----
function openStats(){
    const modal = document.getElementById("statsModal");
    modal.classList.add('visible');
    updateStatsModal();
    renderCharts();
    updateHistoryTable();
    modal.onclick = function(e){
        if(e.target === modal) closeStats();
    }
}

function closeStats(){
    const modal = document.getElementById("statsModal");
    modal.classList.remove('visible');
}

function switchTab(tabName) {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    document.querySelector(`.tab[onclick*="'${tabName}'"]`).classList.add('active');
    document.getElementById(`${tabName}Container`).classList.add('active');
}

// ---- To-Do List Functions (with EDIT functionality) ----
function loadTodos() {
    const todos = JSON.parse(localStorage.getItem('todos')) || [];
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    todos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.index = index;

        const textSpan = document.createElement('span');
        textSpan.textContent = todo.text;
        textSpan.onclick = () => toggleTodo(index);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'actions';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.onclick = (e) => {
            e.stopPropagation();
            editTodo(index);
        };
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
    todos[index].completed = !todos[index].completed;
    localStorage.setItem('todos', JSON.stringify(todos));
    loadTodos();
}

function editTodo(index) {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    const newText = prompt("Edit your task:", todos[index].text);
    if (newText && newText.trim() !== "") {
        todos[index].text = newText.trim();
        localStorage.setItem('todos', JSON.stringify(todos));
        loadTodos();
    }
}

function clearTodos() {
    if (confirm("Are you sure you want to clear all tasks?")) {
        localStorage.removeItem('todos');
        loadTodos();
    }
}

// ---- Store and Backgrounds ----
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
        container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        localStorage.setItem('youtubeVideoId', videoId);
        localStorage.removeItem('customBackground');
        localStorage.removeItem("currentBackgroundPath");
        document.body.style.backgroundImage = 'none';
    } else {
        alert("Please enter a valid YouTube URL.");
    }
}

// ---- Remaining Helper Functions ----
// (These are mostly unchanged, placed here for completeness)
function getYoutubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}
function toggleFocusMode() { document.body.classList.toggle('focus-mode'); }
function toggleWhiteNoise() {
    if (whiteNoise.paused) { whiteNoise.play(); noiseBtn.textContent = "🎧 Stop Noise"; } 
    else { whiteNoise.pause(); noiseBtn.textContent = "🎧 Play Noise"; }
}
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
// Other functions like renderCharts, updateProfile, etc., remain the same but are not shown here for brevity as they are not part of the core polishing. They will still work.

// ---- Event Listeners and Initial Load ----
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateStatus();
    updateTimerDisplay();
    loadTodos();
    updateCornerWidget();
    setInterval(updateCornerWidget, 1000);

    // Main Controls
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    
    // To-Do
    document.getElementById("add-todo-btn").addEventListener('click', addTodo);
    document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);
    document.getElementById('todo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

    // Backgrounds
    document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
    document.getElementById("removeYoutubeBtn").addEventListener('click', () => { document.getElementById("video-background-container").innerHTML = ''; localStorage.removeItem('youtubeVideoId'); });
    document.getElementById("custom-image-input").addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => applyBackgroundTheme(event.target.result);
        reader.readAsDataURL(file);
    });
    document.getElementById("removeCustomBgBtn").addEventListener('click', () => { document.body.style.backgroundImage = 'none'; localStorage.removeItem('customBackground'); });
    
    // Focus Mode
    document.getElementById("focusModeBtn").addEventListener('click', toggleFocusMode);
    document.getElementById("focusModePlayPauseBtn").addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
    document.getElementById("focusModeExitBtn").addEventListener('click', toggleFocusMode);

    // Settings
    document.getElementById("saveSettingsBtn").addEventListener('click', saveSettings);

    // Store Item Clicks
    document.getElementById('storeItems').addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            applyStoreItem(e.target);
        }
    });

    // Initial background load
    const savedYoutubeId = localStorage.getItem('youtubeVideoId');
    const savedCustomBg = localStorage.getItem('customBackground');
    const savedBackgroundPath = localStorage.getItem('currentBackgroundPath');

    if (savedYoutubeId) {
        document.getElementById('youtube-input').value = `https://www.youtube.com/watch?v=${savedYoutubeId}`;
        setYoutubeBackground(); 
    } else if (savedCustomBg) {
        applyBackgroundTheme(savedCustomBg);
    } else if (savedBackgroundPath) {
        applyBackgroundTheme(savedBackgroundPath);
    }
});

// NEW: Keyboard Shortcut
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        isRunning ? pauseTimer() : startTimer();
    }
});
