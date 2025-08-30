document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // GLOBAL STATE & VARIABLES
    // ===================================================================================
    let timerInterval, isRunning = false, isWorkSession = true, sessionCount = 0;
    let endTime = 0, timeLeft;
    let workDuration, shortBreakDuration, longBreakDuration;
    let snowInterval, rainInterval, sakuraInterval;
    let isSnowActive = false, isRainActive = false, isSakuraActive = false;
    let profileName = localStorage.getItem("profileName") || "Floww User";

    // ===================================================================================
    // DOM ELEMENTS CACHE
    // ===================================================================================
    const DOMElements = {
        timerDisplay: document.getElementById("timer"),
        statusDisplay: document.getElementById("status"),
        playPauseBtn: document.getElementById("playPauseBtn"),
        playIcon: document.getElementById("playIcon"),
        pauseIcon: document.getElementById("pauseIcon"),
        resetBtn: document.getElementById("resetBtn"),
        endSessionBtn: document.getElementById("endSessionBtn"),
        focusMode: {
            timer: document.getElementById("focusModeTimer"),
            progressBar: document.getElementById("focusModeProgressBar"),
            playPauseBtn: document.getElementById("focusModePlayPauseBtn"),
        },
        modals: {
            stats: document.getElementById("statsModal"),
            completion: document.getElementById("completionModal"),
            totalFocusTime: document.getElementById("totalFocusTime"),
            totalSessionsCount: document.getElementById("totalSessionsCount"),
        },
        profile: {
            nameDisplay: document.getElementById("profileNameDisplay"),
        },
        streak: {
            count: document.getElementById("streak-count"),
        },
        sounds: {
            whiteNoise: document.getElementById("whiteNoise"),
            start: document.querySelectorAll('.start-sound'),
            goodMeme: document.querySelectorAll('.good-meme'),
            badMeme: document.querySelectorAll('.bad-meme'),
            pauseAlert: document.getElementById("pauseAlertSound"),
            resumeAlert: document.getElementById("resumeAlertSound"),
        }
    };

    // ===================================================================================
    // CORE TIMER LOGIC
    // ===================================================================================
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        DOMElements.timerDisplay.textContent = timeString; 
        DOMElements.focusMode.timer.textContent = timeString;

        const currentDuration = isWorkSession ? workDuration : (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration);
        const progress = timeLeft > 0 ? ((currentDuration - timeLeft) / currentDuration) * 100 : 0;
        DOMElements.focusMode.progressBar.style.width = `${progress}%`;

        document.title = isRunning ? `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww` : 'YouFloww';
    }

    function updateUIState() {
        DOMElements.statusDisplay.textContent = isWorkSession ? "Work Session" : "Break Time";
        DOMElements.playIcon.classList.toggle('hidden', isRunning);
        DOMElements.pauseIcon.classList.toggle('hidden', !isRunning);
        DOMElements.playPauseBtn.setAttribute('aria-label', isRunning ? 'Pause Timer' : 'Start Timer');
        DOMElements.resetBtn.disabled = isRunning;
        DOMElements.endSessionBtn.disabled = !isRunning;
        DOMElements.focusMode.playPauseBtn.classList.toggle('paused', !isRunning);
    }

    function playRandomSound(sounds) {
        if (sounds.length > 0) {
            const sound = sounds[Math.floor(Math.random() * sounds.length)];
            sound.currentTime = 0;
            sound.play().catch(e => console.error("Audio play failed:", e));
        }
    }

    function startTimer() {
        if (isRunning) return;
        
        if (isWorkSession) {
            (timeLeft >= workDuration) ? playRandomSound(DOMElements.sounds.start) : DOMElements.sounds.resumeAlert.play();
        }

        isRunning = true;
        endTime = Date.now() + timeLeft * 1000;
        updateUIState();
        
        timerInterval = setInterval(() => {
            timeLeft = Math.round((endTime - Date.now()) / 1000);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
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
        if (!isRunning) return;
        clearInterval(timerInterval);
        isRunning = false;
        DOMElements.sounds.pauseAlert.play();
        updateUIState();
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        isWorkSession = true;
        sessionCount = 0;
        timeLeft = workDuration;
        updateTimerDisplay();
        updateUIState();
    }

    function endSession() {
        const timeFocusedSec = workDuration - timeLeft;
        const minutesFocused = Math.floor(timeFocusedSec / 60);

        if (timeFocusedSec > 0) handleEndOfWorkSession(minutesFocused, false);
        resetTimer();
    }

    function handleSessionCompletion() {
        if (isWorkSession) {
            const minutesFocused = Math.floor(workDuration / 60);
            handleEndOfWorkSession(minutesFocused, true);
            showCompletionPopup();
            sessionCount++;
            isWorkSession = false;
            timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
        } else {
            isWorkSession = true;
            timeLeft = workDuration;
        }
        updateTimerDisplay();
        updateUIState();
        startTimer(); // Auto-start next session
    }

    function handleEndOfWorkSession(minutesFocused, sessionCompleted) {
        if (minutesFocused <= 0 && !sessionCompleted) return;

        let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
        let totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
        
        totalFocusMinutes += minutesFocused;
        totalSessions++;
        localStorage.setItem("totalFocusMinutes", totalFocusMinutes.toString());
        localStorage.setItem("totalSessions", totalSessions.toString());
        
        const today = new Date().toISOString().slice(0, 10);
        let weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
        weeklyData[today] = (weeklyData[today] || 0) + minutesFocused;
        localStorage.setItem("weeklyFocus", JSON.stringify(weeklyData));

        if (minutesFocused >= 20) {
            playRandomSound(DOMElements.sounds.goodMeme);
        } else {
            playRandomSound(DOMElements.sounds.badMeme);
        }

        // Streak logic only triggers on completed sessions
        if (sessionCompleted && minutesFocused >= 25) {
            updateStreak();
        }
    }

    // ===================================================================================
    // STREAK LOGIC
    // ===================================================================================
    function getFormattedDate(date) {
        return date.toISOString().slice(0, 10);
    }

    function checkStreak() {
        const today = getFormattedDate(new Date());
        const yesterday = getFormattedDate(new Date(Date.now() - 86400000));
        const lastStreakDate = localStorage.getItem('lastStreakDate');
        let streakCount = parseInt(localStorage.getItem('streakCount')) || 0;

        if (lastStreakDate && lastStreakDate !== today && lastStreakDate !== yesterday) {
            streakCount = 0; // Streak is broken
        }
        localStorage.setItem('streakCount', streakCount.toString());
        updateStreakDisplay(streakCount);
    }

    function updateStreak() {
        const today = getFormattedDate(new Date());
        const yesterday = getFormattedDate(new Date(Date.now() - 86400000));
        const lastStreakDate = localStorage.getItem('lastStreakDate');
        let streakCount = parseInt(localStorage.getItem('streakCount')) || 0;

        if (lastStreakDate !== today) { // Only update streak once per day
            if (lastStreakDate === yesterday) {
                streakCount++; // Continue streak
            } else {
                streakCount = 1; // Start a new streak
            }
            localStorage.setItem('lastStreakDate', today);
            localStorage.setItem('streakCount', streakCount.toString());
            updateStreakDisplay(streakCount);
        }
    }
    
    function updateStreakDisplay(count) {
        const streakCount = count !== undefined ? count : (parseInt(localStorage.getItem('streakCount')) || 0);
        DOMElements.streak.count.textContent = streakCount;
    }

    // ===================================================================================
    // POPUP & MODAL LOGIC
    // ===================================================================================
    function showCompletionPopup() {
        const messages = [
            "Fantastic focus! Keep it up.",
            "Great session! You're on a roll.",
            "Awesome work! Take a well-deserved break.",
            "You crushed it! What's next?",
            "Momentum is building. Well done!"
        ];
        document.getElementById('completion-message').textContent = messages[Math.floor(Math.random() * messages.length)];
        DOMElements.modals.completion.classList.add('visible');
    }

    function closeCompletionPopup() {
        DOMElements.modals.completion.classList.remove('visible');
    }

    function openStats() { DOMElements.modals.stats.classList.add('visible'); renderCharts(); updateStatsDisplay(); }
    function closeStats() { DOMElements.modals.stats.classList.remove('visible'); }

    function switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}Container`).classList.add('active');
    }

    function updateStatsDisplay() {
        const totalMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
        DOMElements.modals.totalFocusTime.textContent = `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
        DOMElements.modals.totalSessionsCount.textContent = localStorage.getItem("totalSessions") || 0;
    }

    function renderCharts() {
        // Bar Chart
        const weeklyData = JSON.parse(localStorage.getItem("weeklyFocus") || "{}");
        const today = new Date();
        const labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (6 - i)); return d.toLocaleDateString('en-US', { weekday: 'short' }); });
        const data = labels.map((_, i) => { const d = new Date(today); d.setDate(today.getDate() - (6 - i)); const key = d.toISOString().slice(0, 10); return (weeklyData[key] || 0) / 60; });
        const barCtx = document.getElementById('barChart').getContext('2d');
        if (window.myBarChart) window.myBarChart.destroy();
        window.myBarChart = new Chart(barCtx, { type: 'bar', data: { labels, datasets: [{ label: 'Daily Focus (hours)', data, backgroundColor: '#f7a047' }] }, options: { maintainAspectRatio: false } });

        // Pie Chart
        const totalFocus = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
        const totalSessions = parseInt(localStorage.getItem("totalSessions")) || 0;
        const totalBreak = totalSessions * (shortBreakDuration / 60); // Approximate
        const pieCtx = document.getElementById('pieChart').getContext('2d');
        if(window.myPieChart) window.myPieChart.destroy();
        window.myPieChart = new Chart(pieCtx, {type: 'pie', data: { labels: ['Work', 'Break'], datasets: [{ data: [totalFocus, totalBreak], backgroundColor: ['#f7a047', '#6c63ff'] }] }, options: { maintainAspectRatio: false }});
    }

    // ===================================================================================
    // TO-DO LIST
    // ===================================================================================
    function loadTodos() { const todos = JSON.parse(localStorage.getItem('todos')) || []; const todoList = document.getElementById('todo-list'); todoList.innerHTML = ''; todos.forEach((todo, index) => { const li = document.createElement('li'); li.className = 'todo-item'; li.innerHTML = `<input type="checkbox" id="todo-${index}" ${todo.completed ? 'checked' : ''}> <label for="todo-${index}">${todo.text}</label> <div class="actions"><button class="btn-icon" aria-label="Edit Task">✏️</button></div>`; li.querySelector('input').onchange = () => toggleTodo(index); li.querySelector('button').onclick = () => editTodo(index); todoList.appendChild(li); }); }
    function addTodo() { const input = document.getElementById('todo-input'); if (input.value.trim()) { let todos = JSON.parse(localStorage.getItem('todos')) || []; todos.push({ text: input.value.trim(), completed: false }); localStorage.setItem('todos', JSON.stringify(todos)); input.value = ''; loadTodos(); } }
    function toggleTodo(index) { let todos = JSON.parse(localStorage.getItem('todos')) || []; if (todos[index]) { todos[index].completed = !todos[index].completed; localStorage.setItem('todos', JSON.stringify(todos)); loadTodos(); } }
    function editTodo(index) { let todos = JSON.parse(localStorage.getItem('todos')) || []; if (todos[index]) { const newText = prompt("Edit your task:", todos[index].text); if (newText && newText.trim()) { todos[index].text = newText.trim(); localStorage.setItem('todos', JSON.stringify(todos)); loadTodos(); } } }
    function clearTodos() { if (confirm("Clear all tasks?")) { localStorage.removeItem('todos'); loadTodos(); } }
    
    // ===================================================================================
    // UI, THEMES & HELPERS
    // ===================================================================================
    function updateCornerWidget() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayProgress = ((now - startOfDay) / 86400000) * 100;
        document.getElementById("dayProgressBar").style.width = `${dayProgress}%`;
        document.getElementById("dayProgressPercent").textContent = `${Math.floor(dayProgress)}%`;
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthProgress = (now.getDate() / endOfMonth.getDate()) * 100;
        document.getElementById("monthProgressBar").style.width = `${monthProgress}%`;
        document.getElementById("monthProgressPercent").textContent = `${Math.floor(monthProgress)}%`;
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const isLeap = new Date(now.getFullYear(), 1, 29).getMonth() === 1;
        const totalDaysInYear = isLeap ? 366 : 365;
        const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
        const yearProgress = (dayOfYear / totalDaysInYear) * 100;
        document.getElementById("yearProgressBar").style.width = `${yearProgress}%`;
        document.getElementById("yearProgressPercent").textContent = `${Math.floor(yearProgress)}%`;
    }

    function toggleFocusMode() { document.body.classList.toggle('focus-mode'); }
    function changeProfileName() { const newName = prompt("Enter new name:", profileName); if (newName && newName.trim()) { profileName = newName.trim(); localStorage.setItem("profileName", profileName); DOMElements.profile.nameDisplay.textContent = profileName; } }
    function clearAllData() { if (confirm("DANGER: This will clear ALL settings and stats permanently.")) { localStorage.clear(); window.location.reload(); } }
    function exportData() { const data = JSON.stringify(localStorage); const blob = new Blob([data], {type: "application/json"}); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `youfloww_backup_${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); }
    
    // --- Ambient Effects ---
    const ambientContainer = document.getElementById('ambient-container');
    function createAmbientElement(className) { const el = document.createElement('div'); el.className = `ambient-effect ${className}`; el.style.left = `${Math.random() * 100}vw`; ambientContainer.appendChild(el); el.addEventListener('animationend', () => el.remove()); return el; }
    function animateAmbientElement(el, min, max, name) { el.style.animation = `${name} ${Math.random() * (max - min) + min}s forwards`; }
    function startSnow() { if (!snowInterval) snowInterval = setInterval(() => animateAmbientElement(createAmbientElement('snowflake'), 8, 15, 'fall'), 200); }
    function startRain() { if (!rainInterval) rainInterval = setInterval(() => animateAmbientElement(createAmbientElement('raindrop'), 0.4, 0.8, 'fall'), 50); }
    function startSakura() { if (!sakuraInterval) sakuraInterval = setInterval(() => animateAmbientElement(createAmbientElement('sakura'), 15, 25, 'spinFall'), 500); }
    function toggleSnow() { isSnowActive = !isSnowActive; document.getElementById('snowBtn').classList.toggle('active', isSnowActive); isSnowActive ? startSnow() : clearInterval(snowInterval, snowInterval = null); }
    function toggleRain() { isRainActive = !isRainActive; document.getElementById('rainBtn').classList.toggle('active', isRainActive); isRainActive ? startRain() : clearInterval(rainInterval, rainInterval = null); }
    function toggleSakura() { isSakuraActive = !isSakuraActive; document.getElementById('sakuraBtn').classList.toggle('active', isSakuraActive); isSakuraActive ? startSakura() : clearInterval(sakuraInterval, sakuraInterval = null); }
    
    // --- Backgrounds ---
    function getYoutubeVideoId(url) { return url.match(/(?:[?&]v=|\/embed\/|youtu\.be\/)([^"&?/\s]{11})/) ?.[1] || null; }
    function setYoutubeBackground() { const url = document.getElementById("youtube-input").value; const videoId = getYoutubeVideoId(url); if (videoId) { document.getElementById("video-background-container").innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3" frameborder="0" allow="autoplay"></iframe>`; localStorage.setItem('youtubeVideoId', videoId); document.body.style.backgroundImage = 'none'; } else if (url) { alert("Please enter a valid YouTube URL."); } }
    function applyBackgroundTheme(path) { document.body.style.backgroundImage = `url('${path}')`; localStorage.setItem("currentBackgroundPath", path); localStorage.removeItem('youtubeVideoId'); document.getElementById("video-background-container").innerHTML = ''; }
    function applyStoreItem(element) { const item = element.closest('.store-item'); if (item.dataset.type === 'image') applyBackgroundTheme(item.dataset.path); else if (item.dataset.type === 'youtube') { document.getElementById('youtube-input').value = `https://www.youtube.com/watch?v=${item.dataset.id}`; setYoutubeBackground(); } closeStats(); }

    // ===================================================================================
    // INITIALIZATION & EVENT LISTENERS
    // ===================================================================================
    function init() {
        loadSettings();
        updateTimerDisplay();
        updateUIState();
        loadTodos();
        updateCornerWidget();
        setInterval(updateCornerWidget, 30000);
        DOMElements.profile.nameDisplay.textContent = profileName;

        checkStreak();

        // Load saved theme
        const savedBg = localStorage.getItem("currentBackgroundPath");
        const savedYt = localStorage.getItem("youtubeVideoId");
        if (savedBg) applyBackgroundTheme(savedBg);
        if (savedYt) { document.getElementById('youtube-input').value = `https://www.youtube.com/watch?v=${savedYt}`; setYoutubeBackground(); }

        // --- Attach Event Listeners ---
        DOMElements.playPauseBtn.addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
        DOMElements.resetBtn.addEventListener('click', resetTimer);
        DOMElements.endSessionBtn.addEventListener('click', endSession);
        document.getElementById('changeNameBtn').addEventListener('click', changeProfileName);
        document.getElementById('statsBtn').addEventListener('click', openStats);
        document.querySelector('.close-btn').addEventListener('click', closeStats);
        document.getElementById('closeCompletionModalBtn').addEventListener('click', closeCompletionPopup);
        
        document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
        
        document.getElementById("noiseBtn").addEventListener('click', (e) => { const noise = DOMElements.sounds.whiteNoise; noise.paused ? noise.play() : noise.pause(); e.target.textContent = noise.paused ? "🎧 Play Noise" : "🎧 Stop Noise"; });
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
        document.getElementById('storeItems').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') applyStoreItem(e.target); });
        document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
        
        document.getElementById("exportDataBtn").addEventListener('click', exportData);
        document.getElementById("clearDataBtn").addEventListener('click', clearAllData);
        
        // Global Keyboard & Window Listeners
        window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); isRunning ? pauseTimer() : startTimer(); } });
        
        window.addEventListener('beforeunload', (e) => {
            if (isRunning) {
                e.preventDefault();
                e.returnValue = 'Your timer is still running! Are you sure you want to leave?';
                return e.returnValue;
            }
        });
    }

    init();
});

