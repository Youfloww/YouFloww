// FIREBASE SDKs - These are now imported from index.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// ===================================================================================
// FIREBASE INITIALIZATION
// ===================================================================================


const firebaseConfig = {
    apiKey: "AIzaSyDG1vbcNcWrgFJmYfjpXTBiLQyurT0dbmw",
    authDomain: "youfloww.firebaseapp.com",
    projectId: "youfloww",
    storageBucket: "youfloww.firebasestorage.app",
    messagingSenderId: "905093243857",
    appId: "1:905093243857:web:0419862992ab35d26ab6f0",
    measurementId: "G-V3CLSWYVTF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global reference to the current user's data
let currentUserData = {};
let userDataRef = null;


document.addEventListener('DOMContentLoaded', () => {

    // ===================================================================================
    // GLOBAL STATE & VARIABLES
    // ===================================================================================
    let timerInterval, isRunning = false, isWorkSession = true, sessionCount = 0;
    let endTime = 0, timeLeft;
    let workDuration, shortBreakDuration, longBreakDuration;
    let snowInterval, rainInterval, sakuraInterval;
    let isSnowActive = false, isRainActive = false, isSakuraActive = false;
    
    // NOTE: profileName and other stats are now managed by currentUserData

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
        appContainer: document.getElementById("app-container"),
        authModal: document.getElementById("authModal"),
        authError: document.getElementById("auth-error"),
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
    // FIREBASE AUTHENTICATION & DATA HANDLING
    // ===================================================================================

    onAuthStateChanged(auth, user => {
        if (user) {
            // User is signed in
            DOMElements.appContainer.classList.remove('hidden');
            DOMElements.authModal.classList.remove('visible');
            userDataRef = doc(db, "users", user.uid);
            loadUserData();
        } else {
            // User is signed out
            DOMElements.appContainer.classList.add('hidden');
            DOMElements.authModal.classList.add('visible');
            currentUserData = {};
            userDataRef = null;
        }
    });
    
    async function loadUserData() {
        if (!userDataRef) return;
        const docSnap = await getDoc(userDataRef);

        if (docSnap.exists()) {
            currentUserData = docSnap.data();
        } else {
            // Create a new user profile with default values
            currentUserData = {
                profileName: "Floww User",
                totalFocusMinutes: 0,
                totalSessions: 0,
                streakCount: 0,
                lastStreakDate: null,
                weeklyFocus: {},
                todos: [],
                settings: {
                    workDuration: 25 * 60,
                    shortBreakDuration: 5 * 60,
                    longBreakDuration: 15 * 60,
                }
            };
            await saveUserData();
        }
        // Once data is loaded, initialize the app state
        initializeAppState();
    }
    
    async function saveUserData() {
        if (userDataRef) {
            try {
                await setDoc(userDataRef, currentUserData, { merge: true });
            } catch (error) {
                console.error("Error saving user data: ", error);
            }
        }
    }

    // ===================================================================================
    // CORE TIMER LOGIC (Unchanged, uses global state)
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
        if (sounds && sounds.length > 0) {
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

        handleEndOfWorkSession(minutesFocused, false);
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
        startTimer();
    }

    function handleEndOfWorkSession(minutesFocused, sessionCompleted) {
        if (minutesFocused > 0) {
            currentUserData.totalFocusMinutes += minutesFocused;
            currentUserData.totalSessions++;
            const today = new Date().toISOString().slice(0, 10);
            currentUserData.weeklyFocus[today] = (currentUserData.weeklyFocus[today] || 0) + minutesFocused;
            saveUserData();
        }
        
        if (sessionCompleted && workDuration / 60 >= 25) {
            updateStreak();
        }
        
        if (workDuration - timeLeft > 5) {
            if (minutesFocused >= 20) {
                playRandomSound(DOMElements.sounds.goodMeme);
            } else {
                playRandomSound(DOMElements.sounds.badMeme);
            }
        }
    }

    // ===================================================================================
    // STREAK LOGIC
    // ===================================================================================
    function getFormattedDate(date) { return date.toISOString().slice(0, 10); }

    function checkStreak() {
        const today = getFormattedDate(new Date());
        const yesterday = getFormattedDate(new Date(Date.now() - 86400000));
        const lastStreakDate = currentUserData.lastStreakDate;
        
        if (lastStreakDate && lastStreakDate !== today && lastStreakDate !== yesterday) {
            currentUserData.streakCount = 0;
            saveUserData();
        }
        updateStreakDisplay();
    }

    function updateStreak() {
        const today = getFormattedDate(new Date());
        if (currentUserData.lastStreakDate !== today) {
            const yesterday = getFormattedDate(new Date(Date.now() - 86400000));
            if (currentUserData.lastStreakDate === yesterday) {
                currentUserData.streakCount++;
            } else {
                currentUserData.streakCount = 1;
            }
            currentUserData.lastStreakDate = today;
            saveUserData();
            updateStreakDisplay();
        }
    }
    
    function updateStreakDisplay() {
        DOMElements.streak.count.textContent = currentUserData.streakCount || 0;
    }

    // ===================================================================================
    // POPUP & MODAL LOGIC (Unchanged)
    // ===================================================================================
    function showCompletionPopup() {
        const messages = ["Fantastic focus!", "Great session!", "Awesome work!", "You crushed it!", "Momentum is building."];
        document.getElementById('completion-message').textContent = messages[Math.floor(Math.random() * messages.length)];
        DOMElements.modals.completion.classList.add('visible');
    }
    function closeCompletionPopup() { DOMElements.modals.completion.classList.remove('visible'); }
    function openStats() { DOMElements.modals.stats.classList.add('visible'); renderCharts(); updateStatsDisplay(); }
    function closeStats() { DOMElements.modals.stats.classList.remove('visible'); }

    // ===================================================================================
    // TO-DO LIST (Now syncs with Firestore)
    // ===================================================================================
    function loadTodos() {
        const todos = currentUserData.todos || [];
        const todoList = document.getElementById('todo-list');
        todoList.innerHTML = '';
        todos.forEach((todo, index) => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            li.innerHTML = `<input type="checkbox" id="todo-${index}" ${todo.completed ? 'checked' : ''}> <label for="todo-${index}">${todo.text}</label> <div class="actions"><button class="btn-icon" aria-label="Edit Task">✏️</button></div>`;
            li.querySelector('input').onchange = () => toggleTodo(index);
            li.querySelector('button').onclick = () => editTodo(index);
            todoList.appendChild(li);
        });
    }

    function addTodo() {
        const input = document.getElementById('todo-input');
        if (input.value.trim()) {
            currentUserData.todos.push({ text: input.value.trim(), completed: false });
            saveUserData();
            input.value = '';
            loadTodos();
        }
    }

    function toggleTodo(index) {
        if (currentUserData.todos[index]) {
            currentUserData.todos[index].completed = !currentUserData.todos[index].completed;
            saveUserData();
            loadTodos();
        }
    }

    function editTodo(index) {
        if (currentUserData.todos[index]) {
            const newText = prompt("Edit your task:", currentUserData.todos[index].text);
            if (newText && newText.trim()) {
                currentUserData.todos[index].text = newText.trim();
                saveUserData();
                loadTodos();
            }
        }
    }

    function clearTodos() {
        if (confirm("Clear all tasks?")) {
            currentUserData.todos = [];
            saveUserData();
            loadTodos();
        }
    }

    // ===================================================================================
    // INITIALIZATION & MAIN APP LOGIC
    
    // ===================================================================================

    // This function runs once the user is logged in and their data is loaded
    function initializeAppState() {
        loadSettingsFromData();
        updateTimerDisplay();
        updateUIState();
        loadTodos();
        updateCornerWidget();
        DOMElements.profile.nameDisplay.textContent = currentUserData.profileName;
        checkStreak();
        // Any other initial UI updates go here
    }

    function loadSettingsFromData() {
        const settings = currentUserData.settings || {};
        workDuration = settings.workDuration || 25 * 60;
        shortBreakDuration = settings.shortBreakDuration || 5 * 60;
        longBreakDuration = settings.longBreakDuration || 15 * 60;
        if (!isRunning) { timeLeft = workDuration; }
        document.getElementById('work-duration').value = workDuration / 60;
        document.getElementById('short-break-duration').value = shortBreakDuration / 60;
        document.getElementById('long-break-duration').value = longBreakDuration / 60;
    }

    function saveSettingsToData() {
        const newWork = parseInt(document.getElementById('work-duration').value, 10) * 60;
        const newShort = parseInt(document.getElementById('short-break-duration').value, 10) * 60;
        const newLong = parseInt(document.getElementById('long-break-duration').value, 10) * 60;
        if (newWork && newShort && newLong) {
            currentUserData.settings = {
                workDuration: newWork,
                shortBreakDuration: newShort,
                longBreakDuration: newLong
            };
            saveUserData();
            loadSettingsFromData();
            if (!isRunning) resetTimer();
            alert("Settings saved!");
        } else {
            alert("Please enter valid numbers for all durations.");
        }
    }
    
    // --- Event Listeners for Firebase ---
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            // onAuthStateChanged will handle the rest
        } catch (error) {
            DOMElements.authError.textContent = error.message;
        }
    });

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
             // onAuthStateChanged will handle the rest
        } catch (error) {
            DOMElements.authError.textContent = error.message;
        }
    });
    
    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth);
    });

    // --- Form switching ---
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
        DOMElements.authError.textContent = '';
    });
    
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        DOMElements.authError.textContent = '';
    });

    // Attach other event listeners
    attachMainAppEventListeners();
    
    function attachMainAppEventListeners() {
        DOMElements.playPauseBtn.addEventListener('click', () => isRunning ? pauseTimer() : startTimer());
        DOMElements.resetBtn.addEventListener('click', resetTimer);
        DOMElements.endSessionBtn.addEventListener('click', endSession);
        document.getElementById('changeNameBtn').addEventListener('click', () => {
             const newName = prompt("Enter new name:", currentUserData.profileName);
             if (newName && newName.trim()) {
                currentUserData.profileName = newName.trim();
                saveUserData();
                DOMElements.profile.nameDisplay.textContent = newName.trim();
             }
        });
        document.getElementById('statsBtn').addEventListener('click', openStats);
        document.querySelector('.close-btn').addEventListener('click', closeStats);
        document.getElementById('closeCompletionModalBtn').addEventListener('click', closeCompletionPopup);
        document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));
        document.getElementById("saveSettingsBtn").addEventListener('click', saveSettingsToData);

        // ... all other non-auth event listeners from your original file ...
        // I've kept them separate to show they are part of the main app logic
        
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
        document.getElementById('storeItems').addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON') applyStoreItem(e.target); });
        document.getElementById("setYoutubeBtn").addEventListener('click', setYoutubeBackground);
        document.getElementById("exportDataBtn").addEventListener('click', exportData); // This would now export local (not synced) data
        document.getElementById("clearDataBtn").addEventListener('click', clearAllData); // This would need to be re-thought for Firestore
        
        window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); isRunning ? pauseTimer() : startTimer(); } });
        window.addEventListener('beforeunload', (e) => {
            if (isRunning) {
                e.preventDefault();
                e.returnValue = 'Your timer is still running! Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        setInterval(updateCornerWidget, 30000);
    }
});
