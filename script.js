document.addEventListener('DOMContentLoaded', () => {

    // ---- GLOBAL STATE & VARIABLES ----
    let timerInterval;
    let isRunning = false;
    let isWorkSession = true;
    let sessionCount = 0;
    let timeLeft; 
    let workDuration, shortBreakDuration, longBreakDuration;
    
    // ---- DOM ELEMENTS ----
    const dom = {
        body: document.body,
        status: document.getElementById('status'),
        timer: document.getElementById('timer'),
        toggleTimerBtn: document.getElementById('toggleTimerBtn'),
        resetBtn: document.getElementById('resetBtn'),
        endSessionBtn: document.getElementById('endSessionBtn'),
        // To-Do
        todoInput: document.getElementById('todo-input'),
        addTodoBtn: document.getElementById('add-todo-btn'),
        todoList: document.getElementById('todo-list'),
        // Dashboard
        dashboardBtn: document.getElementById('dashboardBtn'),
        closeDashboardBtn: document.getElementById('closeDashboardBtn'),
        dashboardModal: document.getElementById('dashboardModal'),
        tabs: document.querySelectorAll('.tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        // Focus Mode
        focusModeBtn: document.getElementById('focusModeBtn'),
        focusModeUI: document.getElementById('focusModeUI'),
        focusModeTimer: document.getElementById('focusModeTimer'),
        focusModeToggleBtn: document.getElementById('focusModeToggleBtn'),
        // Sounds & Backgrounds
        noiseBtn: document.getElementById('noiseBtn'),
        whiteNoise: document.getElementById('whiteNoise'),
        alertSound: document.getElementById('alertSound'),
        startSounds: document.querySelectorAll('.start-sound'),
        goodMemeSounds: document.querySelectorAll('.good-meme'),
        badMemeSounds: document.querySelectorAll('.bad-meme'),
        videoContainer: document.getElementById('video-background-container'),
        // Settings
        workDurationInput: document.getElementById('work-duration'),
        shortBreakInput: document.getElementById('short-break-duration'),
        longBreakInput: document.getElementById('long-break-duration'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn'),
        // Customize
        youtubeInput: document.getElementById('youtube-input'),
        imageInput: document.getElementById('custom-image-input'),
        storeItemsContainer: document.getElementById('storeItems'),
        // Profile
        profileName: document.getElementById('profileName'),
        totalFocusTime: document.getElementById('totalFocusTime'),
        totalSessions: document.getElementById('totalSessions'),
        exportDataBtn: document.getElementById('exportDataBtn'),
        clearDataBtn: document.getElementById('clearDataBtn'),
        // FAB Menu
        fabContainer: document.getElementById('fabContainer'),
    };

    // ---- SVG ICONS ----
    const icons = {
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
    };
    
    // ---- LOCALSTORAGE HELPER ----
    const storage = {
        get: (key, defaultValue) => {
            try {
                const value = localStorage.getItem(key);
                return value ? JSON.parse(value) : defaultValue;
            } catch (e) {
                console.error("Error reading from localStorage", e);
                return defaultValue;
            }
        },
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.error("Error writing to localStorage", e);
            }
        }
    };

    // ===================================================================================
    // CORE TIMER LOGIC
    // ===================================================================================

    function startTimer() {
        if (isRunning) return;
        isRunning = true;
        dom.body.classList.add('is-running');
        updateToggleButtons();

        if (isWorkSession && timeLeft >= workDuration) {
            playRandomSound(dom.startSounds);
        } else {
            dom.alertSound.play();
        }

        const endTime = Date.now() + timeLeft * 1000;
        timerInterval = setInterval(() => {
            timeLeft = Math.round((endTime - Date.now()) / 1000);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timeLeft = 0;
                handleSessionCompletion();
            }
            updateTimerDisplay();
        }, 1000);
    }

    function pauseTimer() {
        if (!isRunning) return;
        clearInterval(timerInterval);
        isRunning = false;
        dom.body.classList.remove('is-running');
        updateToggleButtons();
        dom.alertSound.play();
    }
    
    function toggleTimer() {
        isRunning ? pauseTimer() : startTimer();
    }

    function resetTimer(switchToWork = true) {
        clearInterval(timerInterval);
        isRunning = false;
        isWorkSession = switchToWork;
        if (isWorkSession) {
            timeLeft = workDuration;
            sessionCount = 0;
        } else {
            timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
        }
        updateAllUI();
    }

    function endSession() {
        const timeFocusedSec = workDuration - timeLeft;
        const minutesFocused = Math.floor(timeFocusedSec / 60);

        if (isWorkSession && minutesFocused > 0) {
            handleEndOfWorkSession(minutesFocused, true);
        }
        resetTimer(true);
    }

    function handleSessionCompletion() {
        if (isWorkSession) {
            const minutesFocused = Math.floor(workDuration / 60);
            handleEndOfWorkSession(minutesFocused, false);
            sessionCount++;
            isWorkSession = false;
            timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
        } else {
            isWorkSession = true;
            timeLeft = workDuration;
        }
        
        // Auto-start next session after a short delay
        setTimeout(() => {
            updateAllUI();
            startTimer();
        }, 1500);
    }

    function handleEndOfWorkSession(minutesFocused, endedEarly) {
        // Update stats
        let stats = storage.get('stats', { totalMinutes: 0, totalSessions: 0 });
        stats.totalMinutes += minutesFocused;
        if (!endedEarly) {
            stats.totalSessions++;
        }
        storage.set('stats', stats);

        // Update daily data for charts
        const today = new Date().toISOString().slice(0, 10);
        let dailyData = storage.get('dailyData', {});
        dailyData[today] = (dailyData[today] || 0) + minutesFocused;
        storage.set('dailyData', dailyData);
        
        // Play sound based on duration
        // MODIFIED as per user request
        if (minutesFocused >= 20) {
            playRandomSound(dom.goodMemeSounds);
        } else {
            playRandomSound(dom.badMemeSounds);
        }
        
        updateProfileStats();
    }

    // ===================================================================================
    // UI UPDATE FUNCTIONS
    // ===================================================================================

    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        dom.timer.textContent = timeString;
        dom.focusModeTimer.textContent = timeString;
        document.title = `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww`;
    }

    function updateStatus() {
        dom.status.textContent = isWorkSession ? "Work Session" : "Break Time";
    }
    
    function updateToggleButtons() {
        dom.toggleTimerBtn.innerHTML = isRunning ? icons.pause : icons.play;
        dom.toggleTimerBtn.setAttribute('aria-label', isRunning ? 'Pause Timer' : 'Start Timer');
        dom.focusModeToggleBtn.innerHTML = isRunning ? icons.pause : icons.play;
    }

    function updateAllUI() {
        updateTimerDisplay();
        updateStatus();
        updateToggleButtons();
        dom.body.classList.remove('is-running');
    }

    // ===================================================================================
    // TO-DO LIST LOGIC
    // ===================================================================================

    function loadTodos() {
        const todos = storage.get('todos', []);
        dom.todoList.innerHTML = '';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.classList.toggle('completed', todo.completed);
            li.innerHTML = `
                <input type="checkbox" id="todo-${index}" ${todo.completed ? 'checked' : ''}>
                <label for="todo-${index}">${todo.text}</label>
            `;
            li.addEventListener('click', () => toggleTodo(index));
            dom.todoList.appendChild(li);
        });
    }
    
    function addTodo() {
        const text = dom.todoInput.value.trim();
        if (text) {
            const todos = storage.get('todos', []);
            todos.push({ text, completed: false });
            storage.set('todos', todos);
            dom.todoInput.value = '';
            loadTodos();
        }
    }

    function toggleTodo(index) {
        const todos = storage.get('todos', []);
        if (todos[index]) {
            todos[index].completed = !todos[index].completed;
            storage.set('todos', todos);
            loadTodos();
        }
    }

    // ===================================================================================
    // DASHBOARD & MODAL LOGIC
    // ===================================================================================

    function openDashboard() { dom.dashboardModal.classList.add('visible'); renderCharts(); }
    function closeDashboard() { dom.dashboardModal.classList.remove('visible'); }

    function switchTab(tabName) {
        dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
        dom.tabContents.forEach(c => c.classList.toggle('active', c.id.startsWith(tabName)));
    }

    // ===================================================================================
    // STATS, CHARTS & PROFILE
    // ===================================================================================
    
    function formatMinutes(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h}h ${m}m`;
    }

    function updateProfileStats() {
        const stats = storage.get('stats', { totalMinutes: 0, totalSessions: 0 });
        const profileName = storage.get('profileName', 'Floww User');
        dom.profileName.textContent = profileName;
        dom.totalFocusTime.textContent = formatMinutes(stats.totalMinutes);
        dom.totalSessions.textContent = stats.totalSessions;
    }

    window.changeProfileName = () => {
        const currentName = storage.get('profileName', 'Floww User');
        const newName = prompt("Enter new name:", currentName);
        if (newName && newName.trim()) {
            storage.set("profileName", newName.trim());
            updateProfileStats();
        }
    };

    function renderCharts() {
        renderBarChart();
        renderPieChart();
    }

    function renderBarChart() {
        const dailyData = storage.get('dailyData', {});
        const labels = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        }).reverse();

        const data = Array.from({ length: 7 }, (_, i) => {
             const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            return dailyData[key] || 0;
        }).reverse();

        const ctx = document.getElementById('barChart').getContext('2d');
        if (window.myBarChart) window.myBarChart.destroy();
        window.myBarChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Focus (minutes)', data, backgroundColor: 'rgba(255, 126, 95, 0.8)' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    function renderPieChart() {
        const stats = storage.get('stats', { totalMinutes: 0, totalSessions: 0 });
        const totalBreakMinutes = stats.totalSessions * (shortBreakDuration / 60);
        const ctx = document.getElementById('pieChart').getContext('2d');
        if (window.myPieChart) window.myPieChart.destroy();
        window.myPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Work', 'Break'],
                datasets: [{ data: [stats.totalMinutes, totalBreakMinutes], backgroundColor: [ 'rgba(255, 126, 95, 0.8)', 'rgba(106, 130, 251, 0.8)'] }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    
    // ===================================================================================
    // SETTINGS & CUSTOMIZATION
    // ===================================================================================
    
    function loadSettings() {
        workDuration = storage.get("workDuration", 25 * 60);
        shortBreakDuration = storage.get("shortBreakDuration", 5 * 60);
        longBreakDuration = storage.get("longBreakDuration", 15 * 60);

        dom.workDurationInput.value = workDuration / 60;
        dom.shortBreakInput.value = shortBreakDuration / 60;
        dom.longBreakInput.value = longBreakDuration / 60;
        
        if (!isRunning) {
            timeLeft = workDuration;
            updateTimerDisplay();
        }
    }
    
    function saveSettings() {
        const newWork = parseInt(dom.workDurationInput.value) * 60;
        const newShort = parseInt(dom.shortBreakInput.value) * 60;
        const newLong = parseInt(dom.longBreakInput.value) * 60;

        if (newWork && newShort && newLong) {
            storage.set("workDuration", newWork);
            storage.set("shortBreakDuration", newShort);
            storage.set("longBreakDuration", newLong);
            loadSettings();
            resetTimer(true);
            alert("Settings saved!");
        } else {
            alert("Please enter valid numbers for all durations.");
        }
    }

    function getYoutubeVideoId(url) {
        const regex = /(?:[?&]v=|\/embed\/|youtu\.be\/)([^"&?/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : null;
    }

    function setYoutubeBackground(videoId) {
        if (!videoId) return;
        // MODIFIED as per user request to hide controls and recommendations
        dom.videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&showinfo=0" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
        dom.body.style.backgroundImage = 'none';
        storage.set('background', { type: 'youtube', id: videoId });
    }

    function setImageBackground(imageUrl) {
        dom.body.style.backgroundImage = `url('${imageUrl}')`;
        dom.videoContainer.innerHTML = '';
        storage.set('background', { type: 'image', url: imageUrl });
    }
    
    function applyInitialBackground() {
        const bg = storage.get('background');
        if (!bg) return;
        if (bg.type === 'youtube') setYoutubeBackground(bg.id);
        if (bg.type === 'image') setImageBackground(bg.url);
    }
    
    function populateStore() {
        const items = [
            { type: 'image', name: '🌌 Cosmic View', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2071&auto=format&fit=crop' },
            { type: 'youtube', name: '🎵 Lofi Study Cafe', id: '4wJRkS-M-3s' },
            { type: 'youtube', name: '🌧️ Cozy Rainy Night', id: 'NJuSStkIZBg' },
            { type: 'youtube', name: '🚀 Space Journey', id: 'Dx5qFachdxc' },
        ];
        dom.storeItemsContainer.innerHTML = '';
        items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'store-item';
            itemEl.innerHTML = `<span>${item.name}</span><button>Set</button>`;
            itemEl.querySelector('button').addEventListener('click', () => {
                if (item.type === 'image') setImageBackground(item.url);
                if (item.type === 'youtube') setYoutubeBackground(item.id);
                closeDashboard();
            });
            dom.storeItemsContainer.appendChild(itemEl);
        });
    }
    
    // ===================================================================================
    // UTILITY & HELPER FUNCTIONS
    // ===================================================================================

    function toggleFocusMode() {
        dom.body.classList.toggle('focus-mode');
    }

    function playRandomSound(sounds) {
        if (sounds.length > 0) {
            const sound = sounds[Math.floor(Math.random() * sounds.length)];
            sound.currentTime = 0;
            sound.play();
        }
    }
    
    function exportData() {
        const data = JSON.stringify(localStorage);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `youfloww_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    function clearAllData() {
        if (confirm("Are you sure? This will clear ALL your data, including stats and settings.")) {
            localStorage.clear();
            window.location.reload();
        }
    }

    // ===================================================================================
    // EVENT LISTENERS & INITIALIZATION
    // ===================================================================================

    function init() {
        // Timer controls
        dom.toggleTimerBtn.addEventListener('click', toggleTimer);
        dom.resetBtn.addEventListener('click', () => resetTimer(true));
        dom.endSessionBtn.addEventListener('click', endSession);
        
        // To-Do
        dom.addTodoBtn.addEventListener('click', addTodo);
        dom.todoInput.addEventListener('keydown', (e) => e.key === 'Enter' && addTodo());

        // Dashboard
        dom.dashboardBtn.addEventListener('click', openDashboard);
        dom.closeDashboardBtn.addEventListener('click', closeDashboard);
        dom.tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
        
        // FAB Menu
        dom.dashboardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // If it's already active, open the dashboard. Otherwise, just activate the menu.
            if (dom.fabContainer.classList.contains('active')) {
                openDashboard();
            } else {
                dom.fabContainer.classList.add('active');
            }
        });
        document.addEventListener('click', () => dom.fabContainer.classList.remove('active'));

        // Focus Mode
        dom.focusModeBtn.addEventListener('click', toggleFocusMode);
        dom.focusModeToggleBtn.addEventListener('click', toggleTimer);

        // Sounds & Backgrounds
        dom.noiseBtn.addEventListener('click', () => {
            dom.whiteNoise.paused ? dom.whiteNoise.play() : dom.whiteNoise.pause();
            dom.noiseBtn.style.color = dom.whiteNoise.paused ? 'var(--text-color)' : 'var(--accent-color)';
        });
        dom.youtubeInput.addEventListener('change', () => setYoutubeBackground(getYoutubeVideoId(dom.youtubeInput.value)));
        dom.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => setImageBackground(event.target.result);
                reader.readAsDataURL(file);
            }
        });

        // Settings & Profile
        dom.saveSettingsBtn.addEventListener('click', saveSettings);
        dom.exportDataBtn.addEventListener('click', exportData);
        dom.clearDataBtn.addEventListener('click', clearAllData);
        
        // Refresh warning
        window.addEventListener('beforeunload', (e) => {
            if (isRunning) {
                e.preventDefault();
                e.returnValue = ''; // Required for legacy browsers
                return 'Your timer is running. Are you sure you want to leave?';
            }
        });

        // Initial setup
        loadSettings();
        loadTodos();
        updateAllUI();
        updateProfileStats();
        applyInitialBackground();
        populateStore();
    }

    init();
});
