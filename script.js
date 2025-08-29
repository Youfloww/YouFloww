// ---- Timer Variables ----
let timer, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0;
let timeLeft; // Will be set by settings

// ---- NEW: Settings Variables ----
let workDuration, shortBreakDuration, longBreakDuration;

// ---- NEW: Ambient Effect State ----
let snowInterval, rainInterval, sakuraInterval;

// ---- Stats, Coins, Profile (mostly unchanged) ----
let sessionsToday = parseInt(localStorage.getItem("sessionsToday")) || 0;
let totalFocusMinutes = parseInt(localStorage.getItem("totalFocusMinutes")) || 0;
let streak = parseInt(localStorage.getItem("streak")) || 0;
let lastActiveDate = localStorage.getItem("lastActiveDate") || null;
let coins = parseInt(localStorage.getItem("coins")) || 0;
let profileName = localStorage.getItem("profileName") || "Floww User";

const startSound = document.getElementById("startSound");
const endSound = document.getElementById("endSound");
const coinSound = document.getElementById("coinSound");
const whiteNoise = document.getElementById("whiteNoise");


// ---- Timer Functions ----
function updateTimerDisplay(){
  const minutes=Math.floor(timeLeft/60);
  const seconds=timeLeft%60;
  const timeString = `${minutes}:${seconds<10?'0':''}${seconds}`;
  document.getElementById("timer").textContent = timeString;
  document.getElementById("focusModeTimer").textContent = timeString;
  
  const currentDuration = isWorkSession ? workDuration : (sessionCount % 4 === 0 ? longBreakDuration : shortBreakDuration);
  const progress = timeLeft > 0 ? ((currentDuration - timeLeft) / currentDuration) * 100 : 0;
  document.getElementById("focusModeProgressBar").style.width = `${progress}%`;

  if(isRunning) {
    document.title = `${timeString} - ${isWorkSession ? 'Work' : 'Break'} | YouFloww`;
  } else {
    document.title = 'YouFloww - Focus Timer & To-Do List';
  }
}

function updateStatus(){ 
    document.getElementById("status").textContent = isWorkSession ? "Work Session" : "Break Time"; 
}

// NEW: Control button visibility based on timer state
function setButtonState(running) {
    document.getElementById("startBtn").disabled = running;
    document.getElementById("pauseBtn").disabled = !running;
    document.getElementById("resetBtn").classList.toggle('hidden', !running);
    document.getElementById("endSessionBtn").classList.toggle('hidden', !running);
}

function startTimer() {
    if (!isRunning) {
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
                setButtonState(false);
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
    setButtonState(false);
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
    setButtonState(false);
}

function endSession(){
    clearInterval(timer);
    isRunning = false;
    const minutesFocused = Math.floor((workDuration - timeLeft) / 60);
    if(isWorkSession && minutesFocused >= 1){
        // Logic for saving partial session can be added here if needed
    }
    resetTimer();
}

function handleSessionCompletion(){
  if(isWorkSession){
    sessionCount++;
    isWorkSession=false;
    if(sessionCount % 4 === 0) timeLeft = longBreakDuration;
    else timeLeft = shortBreakDuration;
  }else{
    isWorkSession=true;
    timeLeft = workDuration;
  }
  updateTimerDisplay();
  updateStatus();
  setTimeout(startTimer, 1000); // Auto-start next session
}

// ---- Settings ----
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

// ---- Ambient Effects (Refactored for simultaneous playback) ----
const ambientContainer = document.getElementById('ambient-container');
function createAmbientElement(className) {
    const el = document.createElement('div');
    el.className = `ambient-effect ${className}`;
    el.style.left = `${Math.random() * 100}vw`;
    ambientContainer.appendChild(el);
    return el;
}

function animateAmbientElement(el, minDuration, maxDuration, animationName) {
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    el.style.animation = `${animationName} ${duration}ms linear infinite`;
    el.style.animationDelay = `-${Math.random() * duration}ms`;
}

function toggleSnow() {
    const btn = document.getElementById('snowBtn');
    btn.classList.toggle('active');
    if (snowInterval) {
        clearInterval(snowInterval);
        snowInterval = null;
        // Optional: remove existing snowflakes
    } else {
        snowInterval = setInterval(() => {
            const snowflake = createAmbientElement('snowflake');
            animateAmbientElement(snowflake, 8000, 15000, 'fall');
        }, 200);
    }
}

function toggleRain() {
    const btn = document.getElementById('rainBtn');
    btn.classList.toggle('active');
    if (rainInterval) {
        clearInterval(rainInterval);
        rainInterval = null;
    } else {
        rainInterval = setInterval(() => {
            const raindrop = createAmbientElement('raindrop');
            animateAmbientElement(raindrop, 400, 800, 'fall');
        }, 50);
    }
}

function toggleSakura() {
    const btn = document.getElementById('sakuraBtn');
    btn.classList.toggle('active');
    if (sakuraInterval) {
        clearInterval(sakuraInterval);
        sakuraInterval = null;
    } else {
        sakuraInterval = setInterval(() => {
            const petal = createAmbientElement('sakura');
            animateAmbientElement(petal, 15000, 25000, 'spinFall');
        }, 500);
    }
}

// ---- All other functions (To-Do, Stats, Store, etc.) ----
// The rest of the JS code (modals, charts, to-do edit, etc.)
// can remain largely the same as the previous version.
// For brevity, only the setup and event listeners are shown below.

// ---- Event Listeners and Initial Load ----
document.addEventListener('DOMContentLoaded', () => {
    // Initial Setup
    loadSettings();
    updateStatus();
    updateTimerDisplay();
    setButtonState(false); // Hide reset/end buttons initially
    
    // Main Controls
    document.getElementById("startBtn").addEventListener('click', startTimer);
    document.getElementById("pauseBtn").addEventListener('click', pauseTimer);
    document.getElementById("resetBtn").addEventListener('click', resetTimer);
    document.getElementById("endSessionBtn").addEventListener('click', endSession);
    
    // Ambient Controls
    document.getElementById("noiseBtn").addEventListener('click', () => {
        if (whiteNoise.paused) { whiteNoise.play(); document.getElementById("noiseBtn").textContent = "🎧 Stop Noise"; } 
        else { whiteNoise.pause(); document.getElementById("noiseBtn").textContent = "🎧 Play Noise"; }
    });
    const ambienceDropdown = document.querySelector('.ambience-dropdown');
    document.getElementById("ambienceBtn").addEventListener('click', () => {
        ambienceDropdown.classList.toggle('active');
    });
    document.getElementById("snowBtn").addEventListener('click', toggleSnow);
    document.getElementById("rainBtn").addEventListener('click', toggleRain);
    document.getElementById("sakuraBtn").addEventListener('click', toggleSakura);

    // Close dropdown when clicking outside
    window.addEventListener('click', (e) => {
        if (!ambienceDropdown.contains(e.target)) {
            ambienceDropdown.classList.remove('active');
        }
    });

    // Other listeners (To-Do, Backgrounds, Focus Mode, Settings) from the previous version should be here...
    // To keep this response clean, I am assuming the previous, functional listeners for these are present.
    // For example:
    document.getElementById("add-todo-btn").addEventListener('click', addTodo);
    document.getElementById("saveSettingsBtn").addEventListener('click', saveSettings);
    // ...etc.

    // Keyboard Shortcut
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            isRunning ? pauseTimer() : startTimer();
        }
    });

    // Load initial data
    loadTodos();
    // ... etc. for stats and backgrounds.
});
