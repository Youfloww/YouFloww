// ============ Disk Player Feature ============
let diskPlayerEnabled = true;
let diskPlayerAudio = null;
let diskPlayerMusicUrl = 'assets/sounds/diskmusic.mp3'; // fixed path
let diskPlayerPlaying = false;
function showDiskPlayerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal visible';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <span class="close-btn" style="position:absolute;top:10px;right:18px;font-size:2rem;cursor:pointer;">&times;</span>
            <h2>Disk Player</h2>
            <div style="margin:1.5em 0;">
                <label style="font-size:1.1em;">Enable Disk Player?</label><br>
                <button id="enableDiskPlayerBtn" style="margin:1em 0 0.5em 0;">Enable</button>
                <button id="disableDiskPlayerBtn" style="margin:0.5em 0;">Disable</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').onclick = () => modal.remove();
    modal.querySelector('#enableDiskPlayerBtn').onclick = () => {
        diskPlayerEnabled = true;
        updateDiskPlayerUI();
        modal.remove();
        if (!diskPlayerMusicUrl) {
            showDiskMusicUploadModal();
        }
    };
    modal.querySelector('#disableDiskPlayerBtn').onclick = () => {
        diskPlayerEnabled = false;
        updateDiskPlayerUI();
        modal.remove();
    };
}
function showDiskMusicUploadModal() {
    const modal = document.createElement('div');
    modal.className = 'modal visible';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:400px;text-align:center;">
            <span class="close-btn" style="position:absolute;top:10px;right:18px;font-size:2rem;cursor:pointer;">&times;</span>
            <h2>Upload Music</h2>
            <input type="file" id="diskMusicUploadModalInput" accept="audio/*" style="margin:1.5em 0;" />
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.close-btn').onclick = () => modal.remove();
    modal.querySelector('#diskMusicUploadModalInput').onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            diskPlayerMusicUrl = URL.createObjectURL(file);
            updateDiskPlayerUI();
            modal.remove();
        }
    };
}
function updateDiskPlayerUI() {
    const container = document.getElementById('diskPlayerContainer');
    if (diskPlayerEnabled) {
        container.classList.remove('hidden');
        if (diskPlayerMusicUrl) {
            document.getElementById('diskChangeMusicBtn').classList.remove('hidden');
        } else {
            document.getElementById('diskChangeMusicBtn').classList.add('hidden');
        }
    } else {
        container.classList.add('hidden');
    }
}
function handleDiskPlayerClick() {
    if (!diskPlayerMusicUrl) {
        showDiskMusicUploadModal();
        return;
    }
    if (!diskPlayerAudio) {
        diskPlayerAudio = new Audio(diskPlayerMusicUrl);
        diskPlayerAudio.loop = true;
    }
    const disk = document.getElementById('diskPlayer');
    if (diskPlayerPlaying) {
        disk.classList.remove('rotating');
        diskPlayerAudio.pause();
        diskPlayerPlaying = false;
    } else {
        disk.classList.add('rotating');
        diskPlayerAudio.src = diskPlayerMusicUrl;
        diskPlayerAudio.play();
        diskPlayerPlaying = true;
    }
}
function handleDiskChangeMusic() {
    document.getElementById('diskMusicUpload').click();
}
function handleDiskMusicUpload(e) {
    const file = e.target.files[0];
    if (file) {
        diskPlayerMusicUrl = URL.createObjectURL(file);
        if (diskPlayerAudio) {
            diskPlayerAudio.pause();
            diskPlayerAudio = null;
            diskPlayerPlaying = false;
            document.getElementById('diskPlayer').classList.remove('rotating');
        }
        updateDiskPlayerUI();
    }
}
// Show disk player above timer in focus mode
function updateDiskPlayerFocusMode() {
    const container = document.getElementById('diskPlayerContainer');
    if (diskPlayerEnabled) {
        if (document.body.classList.contains('focus-mode')) {
            container.classList.remove('hidden');
        } else {
            updateDiskPlayerUI();
        }
    }
}
document.addEventListener('DOMContentLoaded', function() {
    // Disk player dock option
    const dockDisk = document.querySelector('.dock-item[data-section="diskplayer"]');
    if (dockDisk) {
        dockDisk.addEventListener('click', showDiskPlayerModal);
    }
    // Disk player click
    document.getElementById('diskPlayer').addEventListener('click', handleDiskPlayerClick);
    document.getElementById('diskChangeMusicBtn').addEventListener('click', handleDiskChangeMusic);
    document.getElementById('diskMusicUpload').addEventListener('change', handleDiskMusicUpload);
    // Show disk player above timer in focus mode
    const observer = new MutationObserver(updateDiskPlayerFocusMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
});
// ============ Glow Pill Button Logic & Teaser ============
document.addEventListener('DOMContentLoaded', function() {
    const glowBtn = document.getElementById('glowPillBtn');
    if (glowBtn) {
        glowBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            glowBtn.classList.toggle('glow');
            // Launch teaser slightly after the glow toggle so the effect is visible
            setTimeout(() => showTeaserOverlay(), 120);
        });
    }
});

function showTeaserOverlay(opts = {}) {
    let overlay = document.getElementById('teaserOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'teaserOverlay';
        overlay.className = '';
        overlay.innerHTML = `
          <div class="teaser-wrap">
            <button class="teaser-close" aria-label="Close">✕</button>
            <video id="teaserVideo" playsinline preload="auto"></video>
          </div>
        `;
        document.body.appendChild(overlay);
        const closeBtn = overlay.querySelector('.teaser-close');
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); hideTeaserOverlay(); });
        // Outside click/Esc: gated by flags set per mode
        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'teaserOverlay' && overlay.dataset.allowOutside === 'true') {
                hideTeaserOverlay();
            }
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.dataset.allowEscape === 'true') hideTeaserOverlay();
        });
    }

    // Resolve options
    const mode = opts.mode || 'teaser';
    const fullscreen = !!opts.fullscreen;
    // Default sound behavior: teaser keeps previous behavior, intro should be with sound
    const shouldMute = (opts && Object.prototype.hasOwnProperty.call(opts, 'muted')) ? !!opts.muted : (mode === 'intro' ? false : false);
    const showClose = (opts && Object.prototype.hasOwnProperty.call(opts, 'showClose')) ? !!opts.showClose : (mode !== 'intro');
    const showSkip = !!opts.showSkip;
    const showSound = !!opts.showSound;
    // Interaction gating
    overlay.dataset.allowOutside = (mode === 'teaser') ? 'true' : 'false';
    overlay.dataset.allowEscape = (mode === 'teaser') ? 'true' : 'false';

    // Apply container styles based on mode
    const wrap = overlay.querySelector('.teaser-wrap');
    if (fullscreen) wrap.classList.add('fullscreen'); else wrap.classList.remove('fullscreen');

    // Toggle close button
    const closeBtn = overlay.querySelector('.teaser-close');
    if (closeBtn) closeBtn.style.display = showClose ? 'inline-flex' : 'none';

    // Ensure skip button exists when needed
    let skipBtn = overlay.querySelector('.teaser-skip');
    if (showSkip) {
        if (!skipBtn) {
            skipBtn = document.createElement('button');
            skipBtn.className = 'teaser-skip';
            skipBtn.textContent = 'Skip';
            skipBtn.addEventListener('click', (e) => { e.stopPropagation(); hideTeaserOverlay(); });
            wrap.appendChild(skipBtn);
        } else {
            skipBtn.style.display = 'inline-block';
        }
    } else if (skipBtn) {
        skipBtn.style.display = 'none';
    }

    // Intro logo above Skip button
    if (mode === 'intro') {
        let logo = overlay.querySelector('.teaser-logo');
        if (!logo) {
            logo = document.createElement('img');
            logo.className = 'teaser-logo';
            logo.src = 'assets/images/disk.png';
            logo.alt = 'YouFloww Logo';
            wrap.appendChild(logo);
        } else {
            logo.style.display = 'block';
        }
    } else {
        const logo = overlay.querySelector('.teaser-logo');
        if (logo) logo.style.display = 'none';
    }

    // Ensure sound toggle exists when needed (for intro mode)
    let soundBtn = overlay.querySelector('.teaser-sound');
    if (showSound) {
        if (!soundBtn) {
            soundBtn = document.createElement('button');
            soundBtn.className = 'teaser-sound';
            soundBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            wrap.appendChild(soundBtn);
        } else {
            soundBtn.style.display = 'inline-flex';
        }
    } else if (soundBtn) {
        soundBtn.style.display = 'none';
    }

    const video = document.getElementById('teaserVideo');
    if (soundBtn && video) {
        const updateIcon = () => {
            soundBtn.innerHTML = video.muted ? '<i class="fas fa-volume-mute"></i>' : '<i class="fas fa-volume-up"></i>';
            soundBtn.title = video.muted ? 'Sound off' : 'Sound on';
        };
        updateIcon();
        soundBtn.onclick = (e) => {
            e.stopPropagation();
            // Unmute/mute; click is a user gesture so audio should play
            video.muted = !video.muted;
            updateIcon();
            // If unmuting and video is paused (unlikely on muted autoplay), try play again
            if (!video.muted && video.paused) {
                video.play().catch(() => {
                    // Fallback: show controls
                    video.setAttribute('controls', 'controls');
                });
            }
        };
    }

    if (video) {
        // Source is assets/images/video.mp4
        video.src = 'assets/images/video.mp4';
        // Apply slight zoom only for intro mode to crop watermark
        if (mode === 'intro') video.classList.add('intro-zoom'); else video.classList.remove('intro-zoom');
        video.muted = shouldMute;
        video.currentTime = 0;
        video.onended = () => hideTeaserOverlay();
        overlay.classList.remove('hidden');
        // Attempt to play with sound if requested
        const tryPlay = () => video.play().catch((err) => {
            // If autoplay with sound is blocked, show a tiny overlay control to start
            if (!video.muted) {
                video.removeAttribute('controls');
                // Create tap-to-play overlay button if not present
                let tapBtn = overlay.querySelector('#teaserTapToPlay');
                if (!tapBtn) {
                    tapBtn = document.createElement('button');
                    tapBtn.id = 'teaserTapToPlay';
                    tapBtn.textContent = 'Tap to Play';
                    tapBtn.style.position = 'absolute';
                    tapBtn.style.left = '50%';
                    tapBtn.style.top = '50%';
                    tapBtn.style.transform = 'translate(-50%, -50%)';
                    tapBtn.style.padding = '10px 16px';
                    tapBtn.style.borderRadius = '10px';
                    tapBtn.style.border = '1px solid rgba(255,255,255,0.25)';
                    tapBtn.style.background = 'rgba(0,0,0,0.6)';
                    tapBtn.style.color = '#fff';
                    tapBtn.style.zIndex = '6';
                    tapBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        tapBtn.remove();
                        video.play().catch(() => {
                            // As a fallback, reveal controls
                            video.setAttribute('controls', 'controls');
                        });
                    });
                    wrap.appendChild(tapBtn);
                }
            } else {
                // If muted and still fails, show controls
                video.setAttribute('controls', 'controls');
            }
        });
        tryPlay();

        // Intro mode: clicking anywhere on the video area enables sound (no separate button)
        if (mode === 'intro') {
            const onTapEnableSound = (e) => {
                // Avoid hijacking Skip button clicks
                if (e.target && (e.target.classList && (e.target.classList.contains('teaser-skip') || e.target.classList.contains('teaser-close')))) return;
                // Only act if currently muted
                if (video.muted) {
                    video.muted = false;
                    video.play().catch(() => {
                        // As a fallback, reveal native controls
                        video.setAttribute('controls', 'controls');
                    });
                }
            };
            if (!wrap.dataset.soundHandlerAttached) {
                wrap.addEventListener('click', onTapEnableSound);
                wrap.dataset.soundHandlerAttached = 'true';
            }
        }
    }
}
function hideTeaserOverlay() {
    const overlay = document.getElementById('teaserOverlay');
    const video = document.getElementById('teaserVideo');
    if (video) { try { video.pause(); } catch {} }
    if (overlay) overlay.classList.add('hidden');
}
// FIREBASE SDKs - Imported from index.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";

// ============ Minimalist Animated Intro Logic ============
function playMinimalistIntro() {
    const overlay = document.getElementById('introOverlay');
    if (!overlay) return; // Guard if this overlay isn't present
    const sparkle = overlay.querySelector('.sparkle');
    for (let i = 0; i < 12; i++) {
        const dot = document.createElement('div');
        dot.className = 'sparkle-dot';
        dot.style.left = `${60 + Math.random()*90}px`;
        dot.style.top = `${80 + Math.random()*60}px`;
        dot.style.animationDelay = `${Math.random()*2.2}s`;
        dot.style.background = `linear-gradient(135deg,#f7a047 0%,#6c63ff 100%)`;
        sparkle.appendChild(dot);
    }
    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => { overlay.style.display = 'none'; }, 1200);
    }, 3400);
}
window.addEventListener('DOMContentLoaded', playMinimalistIntro);

// For testing: show full-screen teaser video (muted autoplay) with click-to-unmute and centered Skip; hide gravity loader overlay
document.addEventListener('DOMContentLoaded', () => {
    try {
        showTeaserOverlay({ mode: 'intro', muted: true, fullscreen: true, showClose: false, showSkip: true, showSound: false });
    } catch {}
    const grav = document.getElementById('gravity-loader-overlay');
    if (grav) {
        grav.style.opacity = '0';
        grav.style.pointerEvents = 'none';
        grav.style.display = 'none';
    }
});

// ============ NEW: Guest Mode State ============
let isGuestMode = false;

// ============ NEW: Guest Mode Handler ============
document.addEventListener('DOMContentLoaded', () => {
    const guestBtn = document.getElementById("continueWithoutSignupBtn");
    const guestWarning = document.getElementById("guestWarning");
    if (guestBtn) {
        guestBtn.addEventListener('click', () => {
            isGuestMode = true;
            DOMElements.appContainer.classList.remove('hidden');
            DOMElements.authModal.classList.remove('visible');
            guestWarning.classList.remove('hidden');
            currentUserData = loadGuestData() || getDefaultUserData();
            initializeAppState();
        });
    }
});

function getDefaultUserData() {
    return {
        profileName: "Floww User",
        totalFocusMinutes: 0,
        totalFocusSeconds: 0,
        totalSessions: 0,
        streakCount: 0,
        bestStreak: 0,
        lastStreakDate: null,
        longestSession: 0,
        todaySessions: 0,
        lastSessionDate: null,
        weeklyFocus: {},
        weeklyFocusSeconds: {},
        todos: [],
        journalEntries: {},
        timetable: {},
        settings: {
            workDuration: 25 * 60,
            shortBreakDuration: 5 * 60,
            longBreakDuration: 15 * 60,
            soundProfile: "indian",
            isAccountabilityOn: false,
        },
        theme: { backgroundPath: null, youtubeVideoId: null }
    };
}

// ===================================================================================
// FIREBASE INITIALIZATION
// ===================================================================================
const firebaseConfig = {
    apiKey: "AIzaSyBCi5Ea0r2c9tdgk_6RnpSuqDV5CE3nGbo",
    authDomain: "youfloww2.firebaseapp.com",
    projectId: "youfloww2",
    storageBucket: "youfloww2.firbasestorage.app",
    messagingSenderId: "816836186464",
    appId: "1:816836186464:web:e1f816020e6798f9b3ce05",
    measurementId: "G-TBY81E0BC4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
let currentUserData = {};
let userDataRef = null;

// ===================================================================================
// LEADERBOARD HELPERS (Public Users projection)
// ===================================================================================
function getTodayKey() {
    // Use local date key (not UTC) so day boundaries match the user's timezone
    return getLocalDateKey();
}

// Local date helpers for robust day-boundary handling
function dateKeyToLocalDate(key) {
    // key format: YYYY-MM-DD
    if (!key || typeof key !== 'string') return new Date();
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}
function diffLocalDateKeysDays(a, b) {
    // Positive if b is after a (in days)
    const da = dateKeyToLocalDate(a);
    const db = dateKeyToLocalDate(b);
    const msPerDay = 24 * 60 * 60 * 1000;
    // Normalize to local midnight by constructing Date(y,m,d)
    const diff = Math.round((db - da) / msPerDay);
    return diff;
}

// Track local day to detect rollovers while the app is open
let lastLocalDayKey = null;
let _dayWatcherInterval = null;
function ensureDailyRollovers() {
    try {
        const today = getLocalDateKey();
        if (!lastLocalDayKey) lastLocalDayKey = today;
        // Reset "today" counters in UI when calendar day changes (even before first session)
        if (currentUserData && currentUserData.lastSessionDate !== today) {
            currentUserData.todaySessions = 0;
            // Do not overwrite lastSessionDate here; it will update on first session of the new day
            saveUserData();
        }
        // Make sure leaderboard projection points to today (so boards show up-to-date day)
        updatePublicUserDoc();
        // Update charts and stats displays to reflect the new day baseline
        try { updateStatsDisplay(); } catch {}
        try { renderCharts(); } catch {}
    } catch (e) { console.warn('ensureDailyRollovers failed', e); }
}
function onNewLocalDay() {
    // Called when local date boundary is crossed while app is open
    lastLocalDayKey = getLocalDateKey();
    ensureDailyRollovers();
    // Refresh leaderboard immediately
    try { refreshLeaderboard(); } catch {}
    // Refresh daily quote cache
    try { fetchQuoteOfTheDay(); } catch {}
}
function startDayBoundaryWatcher() {
    if (_dayWatcherInterval) clearInterval(_dayWatcherInterval);
    lastLocalDayKey = getLocalDateKey();
    _dayWatcherInterval = setInterval(() => {
        const nowKey = getLocalDateKey();
        if (nowKey !== lastLocalDayKey) {
            onNewLocalDay();
        }
    }, 30000); // check every 30s to catch midnight reliably
}

async function updatePublicUserDoc() {
    try {
        if (isGuestMode || !auth.currentUser) return;
        const today = getTodayKey();
        const sec = (currentUserData.weeklyFocusSeconds && currentUserData.weeklyFocusSeconds[today]) || (((currentUserData.weeklyFocus && currentUserData.weeklyFocus[today]) || 0) * 60);
        const minutesFloat = sec / 60;
        const profileName = currentUserData.profileName || "Floww User";
        const ref = doc(db, 'publicUsers', auth.currentUser.uid);
        await setDoc(ref, {
            profileName,
            todayFocusMinutes: parseFloat(minutesFloat.toFixed(2)),
            date: today
        }, { merge: true });
        // Instantly refresh leaderboard after successful write
        await refreshLeaderboard();
    } catch (e) {
        console.error('Error updating public user doc:', e);
    }
}

let leaderboardInterval = null;
async function refreshLeaderboard() {
    try {
        const listEl = document.getElementById('leaderboard-list');
        if (!listEl) return;
        const today = getTodayKey();
        // Query only today's docs; sort and limit client-side to avoid composite index requirements
        const q = query(
            collection(db, 'publicUsers'),
            where('date', '==', today)
        );
        const snap = await getDocs(q);
        let entries = [];
        snap.forEach(docSnap => {
            const d = docSnap.data() || {};
            const minutesRaw = d.todayFocusMinutes;
            const minutes = typeof minutesRaw === 'number' && isFinite(minutesRaw) ? Math.max(0, minutesRaw) : 0;
            entries.push({
                name: d.profileName || 'Floww User',
                minutes
            });
        });
        // Sort desc by minutes and take top 10
        entries.sort((a, b) => b.minutes - a.minutes);
        entries = entries.slice(0, 10);

        listEl.innerHTML = '';
        entries.forEach((e, idx) => {
            const li = document.createElement('li');
            const hours = e.minutes / 60;
            let medal = '';
            if (idx === 0) medal = '🥇';
            else if (idx === 1) medal = '🥈';
            else if (idx === 2) medal = '🥉';
            li.innerHTML = `<span class="rank">${idx + 1} ${medal}</span><span class="name">${e.name}</span><span class="value">${hours.toFixed(2)}h</span>`;
            listEl.appendChild(li);
        });
        // Fill up to 10 with placeholders if needed
        for (let i = entries.length; i < 10; i++) {
            const li = document.createElement('li');
            li.classList.add('placeholder');
            li.innerHTML = `<span class="rank">${i + 1}</span><span class="name">—</span><span class="value">0.00h</span>`;
            listEl.appendChild(li);
        }
    } catch (e) {
        console.error('Failed to refresh leaderboard:', e);
    }
}

function startLeaderboard() {
    refreshLeaderboard();
    if (leaderboardInterval) clearInterval(leaderboardInterval);
    leaderboardInterval = setInterval(refreshLeaderboard, 180000); // every 3 minutes
}

function stopLeaderboard() {
    if (leaderboardInterval) clearInterval(leaderboardInterval);
    leaderboardInterval = null;
    const listEl = document.getElementById('leaderboard-list');
    if (listEl) listEl.innerHTML = '';
}

// ===================================================================================
// GLOBAL STATE & VARIABLES
// ===================================================================================
let timerInterval, isRunning = false, isWorkSession = true, sessionCount = 0;
let endTime = 0, timeLeft;
let workDuration, shortBreakDuration, longBreakDuration;
let baseWorkDuration = null; // store settings-based work session length for restore when no task focus
let sessionStartTime = null;
let totalAwayTime = 0;
let lastPauseTimestamp = null;
let pauseWasManual = true;
let animationFrameId = null;
let isSnowActive = false, isRainActive = false, isSakuraActive = false;
let lastSnowSpawn = 0, lastRainSpawn = 0, lastSakuraSpawn = 0;
const SNOW_INTERVAL = 200, RAIN_INTERVAL = 50, SAKURA_INTERVAL = 500;

// Task-specific session focus
let activeTaskIndex = null; // index in currentUserData.todos; null means no task-specific focus

// Warn user before leaving if a timer is running (close, reload, or back nav)
let leaveWarningEnabled = false;
function handleBeforeUnload(e) {
    if (!isRunning) return;
    e.preventDefault();
    // Most modern browsers ignore custom text; setting returnValue triggers the generic prompt
    e.returnValue = '';
    return '';
}
function enableLeaveWarning() {
    if (leaveWarningEnabled) return;
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Some browsers rely on onbeforeunload to trigger the prompt reliably
    window.onbeforeunload = handleBeforeUnload;
    leaveWarningEnabled = true;
}
function disableLeaveWarning() {
    if (!leaveWarningEnabled) return;
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.onbeforeunload = null;
    leaveWarningEnabled = false;
}

// ACCOUNTABILITY AI STATE
const faceapi = window.faceapi;
let faceApiInterval = null;
window.faceApiInterval = faceApiInterval; // Make interval global for debugging
let isAccountabilityOn = false;
window.isAccountabilityOn = isAccountabilityOn; // Debug global
let awayTimerStart = null;
let modelsLoaded = false; // Flag to check if face-api models are loaded
let poseDetector = null;
let poseDetectionInterval = null;

// YOUTUBE PLAYER STATE
let youtubePlayer = null;
let isPipDragging = false;
let pipDragOffset = { x: 0, y: 0 };

// ===================================================================================
// DOM ELEMENTS CACHE
// ===================================================================================
const DOMElements = {
    video: document.getElementById("video"),
    poseCanvas: document.getElementById("pose-canvas"),
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
    ambientContainer: document.getElementById("ambient-container"),
    faceStatusPrompt: document.getElementById('face-detection-status'),
    focusMode: {
        ui: document.getElementById("focusModeUI"),
        timer: document.getElementById("focusModeTimer"),
        progressBar: document.getElementById("focusModeProgressBar"),
        playPauseBtn: document.getElementById("focusModePlayPauseBtn"),
        exitBtn: document.getElementById("focusModeExitBtn"),
    },
    modals: {
        stats: document.getElementById("statsModal"),
        completion: document.getElementById("completionModal"),
        review: document.getElementById("reviewModal"),
        totalFocusTime: document.getElementById("totalFocusTime"),
        totalSessionsCount: document.getElementById("totalSessionsCount"),
        currentStreak: document.getElementById("currentStreak"),
        bestStreak: document.getElementById("bestStreak"),
        longestSession: document.getElementById("longestSession"),
        todaySessions: document.getElementById("todaySessions")
    },
    profile: {
        nameDisplay: document.getElementById("profileNameDisplay"),
    },
    streak: {
        count: document.getElementById("streak-count"),
    },
    settings: {
        soundEffects: document.getElementById('sound-effects-select'),
        accountabilityToggle: document.getElementById('accountability-toggle'),
    },
    sounds: {
        whiteNoise: document.getElementById("whiteNoise"),
        pauseAlert: document.getElementById("pauseAlertSound"),
        resumeAlert: document.getElementById("resumeAlertSound"),
        indian: {
            start: document.querySelectorAll('.start-sound-indian'),
            good: document.querySelectorAll('.good-meme-indian'),
            bad: document.querySelectorAll('.bad-meme-indian'),
        },
        nonIndian: {
            start: document.querySelectorAll('.start-sound-non-indian'),
            good: document.querySelectorAll('.good-meme-non-indian'),
            bad: document.querySelectorAll('.bad-meme-non-indian'),
        }
    },
    // New elements for enhanced features
    journal: {
        section: document.getElementById("journal-section"),
        entry: document.getElementById("journal-entry"),
        charCount: document.getElementById("journal-char-count"),
        saveStatus: document.getElementById("journal-save-status"),
        imageUpload: document.getElementById("journal-image-upload"),
        imagePreview: document.getElementById("journal-image-preview"),
        entriesList: document.getElementById("journal-entries-list"),
        currentDate: document.getElementById("journal-current-date"),
        saveBtn: document.getElementById("save-journal-btn")
    },
    timetable: {
        section: document.getElementById("timetable-section"),
        timeslotsList: document.getElementById("timeslots-list"),
        days: document.querySelectorAll(".day-tab"),
        addSlotBtn: document.getElementById("add-timeslot-btn"),
        addFirstSlotBtn: document.getElementById("add-first-slot"),
        clearBtn: document.getElementById("clear-timetable-btn"),
        addModal: document.getElementById("add-timeslot-modal"),
        form: document.getElementById("timeslot-form"),
        currentDayName: document.getElementById("current-day-name")
    },
    macDock: document.getElementById("mac-dock"),
    dockItems: document.querySelectorAll(".dock-item"),
    pipPlayer: {
        container: document.getElementById("pip-player-container"),
        header: document.getElementById("pip-player-header"),
        content: document.getElementById("pip-player-content"),
        closeBtn: document.getElementById("pip-close-btn"),
        youtubeInput: document.getElementById("pip-youtube-input"),
        setBtn: document.getElementById("pip-set-btn"),
        resizeHandle: document.getElementById("pip-resize-handle")
    }
};

// ===================================================================================
// FIREBASE AUTH & DATA
// ===================================================================================
onAuthStateChanged(auth, user => {
    if (user) {
        isGuestMode = false;
        DOMElements.appContainer.classList.remove('hidden');
        DOMElements.authModal.classList.remove('visible');
        userDataRef = doc(db, "users", user.uid);
        loadUserData();
        startLeaderboard();
    } else if (!isGuestMode) {
        DOMElements.appContainer.classList.add('hidden');
        DOMElements.authModal.classList.add('visible');
        if (timerInterval) clearInterval(timerInterval);
        isRunning = false;
        stopLeaderboard();
    }
});

function saveUserData() {
    if (isGuestMode) {
        localStorage.setItem('youfloww_guest', JSON.stringify(currentUserData));
    } else if (userDataRef) {
        setDoc(userDataRef, currentUserData, { merge: true }).catch(error => console.error("Error saving user data: ", error));
    }
}
function loadUserData() {
    if (isGuestMode) {
        currentUserData = loadGuestData() || getDefaultUserData();
        initializeAppState();
    } else if (userDataRef) {
        getDoc(userDataRef).then(docSnap => {
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                // Initialize missing properties for backward compatibility
                if (currentUserData.bestStreak === undefined) currentUserData.bestStreak = 0;
                if (currentUserData.longestSession === undefined) currentUserData.longestSession = 0;
                if (currentUserData.todaySessions === undefined) currentUserData.todaySessions = 0;
            }
            initializeAppState();
            updatePublicUserDoc();
        });
    }
}
function loadGuestData() {
    try { return JSON.parse(localStorage.getItem('youfloww_guest')); } catch { return null; }
}

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
    // Glow states for status when running
    DOMElements.statusDisplay.classList.toggle('glow-work', isRunning && isWorkSession);
    DOMElements.statusDisplay.classList.toggle('glow-break', isRunning && !isWorkSession);

    DOMElements.playIcon.classList.toggle('hidden', isRunning);
    DOMElements.pauseIcon.classList.toggle('hidden', !isRunning);
    DOMElements.playPauseBtn.setAttribute('aria-label', isRunning ? 'Pause Timer' : 'Start Timer');
    DOMElements.resetBtn.disabled = isRunning;
    DOMElements.endSessionBtn.disabled = !isRunning;
    DOMElements.focusMode.playPauseBtn.classList.toggle('paused', !isRunning);
}

function playRandomSound(type) {
    const soundProfile = currentUserData.settings?.soundProfile;
    if (soundProfile === 'off') return;
    let soundSet = (soundProfile === 'indian') ? DOMElements.sounds.indian[type] : DOMElements.sounds.nonIndian[type];
    if (soundSet && soundSet.length > 0) {
        const sound = soundSet[Math.floor(Math.random() * soundSet.length)];
        sound.currentTime = 0;
        sound.play().catch(e => console.error("Audio play failed:", e));
    }
}

function startTimer(isResume = false) {
    if (isRunning) return;
    isRunning = true;
    enableLeaveWarning();
    if (isWorkSession) {
        if (isResume) {
            DOMElements.sounds.resumeAlert.play();
        } else if (!sessionStartTime) {
            // Play start sound only on fresh work session start (not resume)
            playRandomSound('start');
        }
    }
    if (!sessionStartTime) sessionStartTime = Date.now();
    if (lastPauseTimestamp) {
        totalAwayTime += Date.now() - lastPauseTimestamp;
        lastPauseTimestamp = null;
    }
    endTime = Date.now() + timeLeft * 1000;
    updateUIState();
    if (isAccountabilityOn) {
        startFaceDetection();
        startPoseDetection();
    }
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

    if (isAccountabilityOn && !DOMElements.video.srcObject) {
        startVideo();
    }
}

function pauseTimer(isAuto = false) {
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    disableLeaveWarning();
    if (!isAuto) {
        pauseWasManual = true;
        DOMElements.sounds.pauseAlert.play();
        stopFaceDetection();
        stopPoseDetection();
    } else {
        pauseWasManual = false;
    }
    lastPauseTimestamp = Date.now();
    updateUIState();
}

function resetTimer() {
    clearInterval(timerInterval);
    stopFaceDetection();
    stopPoseDetection();
    isRunning = false;
    disableLeaveWarning();
    isWorkSession = true;
    sessionCount = 0;
    timeLeft = workDuration;
    sessionStartTime = null;
    totalAwayTime = 0;
    updateTimerDisplay();
    updateUIState();
    updateFocusedTaskIndicator();
    // Re-render todos so their controls are re-enabled and focus state is correct
    loadTodos();
}

function endSession() {
    const sessionSeconds = Math.max(0, Math.round(workDuration - timeLeft));
    handleEndOfWorkSession(sessionSeconds, false);
    // Only play bad meme on early end of a WORK session
    if (isWorkSession) playRandomSound('bad');
    // Always show session review after any manual end
    showSessionReview();
    resetTimer();
}

function handleSessionCompletion() {
    if (isWorkSession) {
        // Work session finished
        const sessionSeconds = Math.max(0, Math.round(workDuration - timeLeft));
        handleEndOfWorkSession(sessionSeconds, true);
        // Only play good meme for work completion
        playRandomSound('good');
        showCompletionPopup();
        // Always show session review after an auto-completed work session
        showSessionReview();
        sessionCount++;
        isWorkSession = false;
        timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
        sessionStartTime = null;
        totalAwayTime = 0;
        updateTimerDisplay();
        updateUIState();
        startTimer();
    } else {
        // Break finished — switch back to work without memes or stats
        isWorkSession = true;
        sessionStartTime = null;
        totalAwayTime = 0;
        // Use remaining estimate if a task is selected; otherwise default work duration
        const remainingSec = getFocusedTaskRemainingSeconds();
        if (remainingSec && remainingSec > 0) {
            timeLeft = remainingSec;
        } else {
            timeLeft = workDuration;
        }
        updateTimerDisplay();
        updateUIState();
        startTimer();
    }
}

function handleEndOfWorkSession(sessionSeconds, sessionCompleted) {
    stopFaceDetection();
    stopPoseDetection();
    stopVideo();

    // If a task is focused, attribute this session's time (in seconds) to it as well
    if (activeTaskIndex !== null && currentUserData.todos && currentUserData.todos[activeTaskIndex] && !currentUserData.todos[activeTaskIndex].completed) {
        const t = currentUserData.todos[activeTaskIndex];
        if (!Number.isFinite(t.loggedSeconds)) t.loggedSeconds = 0;
        t.loggedSeconds += Math.max(0, Math.round(sessionSeconds));
        // Auto-complete task if estimate is met or exceeded
        const estSec = (Number.isFinite(t.estimateMinutes) ? t.estimateMinutes : 0) * 60;
        if (estSec > 0 && t.loggedSeconds >= estSec) {
            t.loggedSeconds = estSec; // cap to estimate
            t.completed = true;
            // Clear focus when task is completed
            activeTaskIndex = null;
            // Celebrate auto-complete just like manual completion
            try { playCompleteSound(); } catch {}
            try { showConfetti(); } catch {}
        }
        
        // Persist and refresh UI/progress for task logging updates
        saveUserData();
        loadTodos();
        updateFocusedTaskIndicator();
    }

    // New behavior: when a session is manually ended (not auto-completed),
    // clear the focused task and restore default timer settings for the next session.
    if (!sessionCompleted) {
        activeTaskIndex = null;
        // Restore defaults immediately to avoid showing leftover remaining time
        if (typeof baseWorkDuration === 'number' && baseWorkDuration > 0) {
            workDuration = baseWorkDuration;
            if (isWorkSession) {
                timeLeft = workDuration;
                updateTimerDisplay();
            }
        }
        updateFocusedTaskIndicator();
        saveUserData();
    }

    const secondsFocused = Math.max(0, Math.round(sessionSeconds));
    const minutesFocused = Math.floor(secondsFocused / 60);
    if (secondsFocused > 0) {
        currentUserData.totalFocusSeconds = (currentUserData.totalFocusSeconds || 0) + secondsFocused;
        currentUserData.totalFocusMinutes = Math.floor((currentUserData.totalFocusSeconds || 0) / 60);
        currentUserData.totalSessions = (currentUserData.totalSessions || 0) + 1;
        
        // Update today's sessions count
        const today = getLocalDateKey();
        if (!currentUserData.weeklyFocusSeconds) currentUserData.weeklyFocusSeconds = {};
        currentUserData.weeklyFocusSeconds[today] = (currentUserData.weeklyFocusSeconds[today] || 0) + secondsFocused;
        if (!currentUserData.weeklyFocus) currentUserData.weeklyFocus = {};
        currentUserData.weeklyFocus[today] = Math.floor((currentUserData.weeklyFocusSeconds[today] || 0) / 60);

        if (currentUserData.lastSessionDate !== today) {
            currentUserData.todaySessions = 1;
            currentUserData.lastSessionDate = today;
        } else {
            currentUserData.todaySessions = (currentUserData.todaySessions || 0) + 1;
        }
        
        // Update longest session (in minutes)
        if (minutesFocused > currentUserData.longestSession) {
            currentUserData.longestSession = minutesFocused;
        }
        
        // Update streak and animate changes
        const streakChange = updateStreak();
        if (streakChange && streakChange.change === 'inc') {
            try { DOMElements.sounds.resumeAlert.play(); } catch {}
            showStreakAnimation('increase', streakChange.newCount);
        } else if (streakChange && streakChange.change === 'reset') {
            showStreakAnimation('reset', 0);
        }
    }
    // Note: Sounds are handled at call sites (natural completion -> good, early end -> bad)
    saveUserData();
    // Update public projection used by leaderboard
    updatePublicUserDoc();
}

// Update streak logic (local-day aware)
function updateStreak() {
    const today = getLocalDateKey();
    const prevCount = currentUserData.streakCount || 0;
    const lastStreakDate = currentUserData.lastStreakDate;
    let change = 'none';

    if (!lastStreakDate) {
        currentUserData.streakCount = 1;
        currentUserData.lastStreakDate = today;
        change = 'inc';
    } else {
        const diffDays = diffLocalDateKeysDays(lastStreakDate, today);
        if (diffDays === 1) {
            currentUserData.streakCount = (currentUserData.streakCount || 0) + 1;
            currentUserData.lastStreakDate = today;
            change = 'inc';
        } else if (diffDays > 1) {
            currentUserData.streakCount = 1; // reset to 1 since a session completed today after a gap
            currentUserData.lastStreakDate = today;
            change = 'reset';
        }
        // If same day (diffDays === 0), do nothing
    }
    if (currentUserData.streakCount > currentUserData.bestStreak) {
        currentUserData.bestStreak = currentUserData.streakCount;
    }
    DOMElements.streak.count.textContent = currentUserData.streakCount || 0;
    return { change, newCount: currentUserData.streakCount, prevCount };
}

// ===================================================================================
// ACCOUNTABILITY AI (FACE-API.JS & POSE DETECTION)
// ===================================================================================
async function loadFaceApiModels() {
    if (modelsLoaded) return;
    const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
    } catch (error) {
        console.error("Could not load face-api models:", error);
    }
}

async function setupPoseDetection() {
    try {
        const detectorConfig = {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
            enableSmoothing: true
        };
        poseDetector = await poseDetection.createDetector(
            poseDetection.SupportedModels.MoveNet,
            detectorConfig
        );
    } catch (error) {
        console.error("Could not load pose detection model:", error);
    }
}

async function startVideo() {
    try {
        if (DOMElements.video.srcObject) return;
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        });
        DOMElements.video.srcObject = stream;
        DOMElements.poseCanvas.width = DOMElements.video.videoWidth;
        DOMElements.poseCanvas.height = DOMElements.video.videoHeight;
    } catch (err) {
        console.error("Camera access error:", err);
        alert("Camera access is required for Accountability features. Please allow access and refresh.");
        DOMElements.settings.accountabilityToggle.checked = false;
        isAccountabilityOn = false;
        window.isAccountabilityOn = isAccountabilityOn;
        saveSettingsToData();
    }
}

function stopVideo() {
    if (DOMElements.video.srcObject) {
        DOMElements.video.srcObject.getTracks().forEach(track => track.stop());
        DOMElements.video.srcObject = null;
    }
}

function startFaceDetection() {
    if (!faceApiInterval && isAccountabilityOn) {
        faceApiInterval = setInterval(handleFaceDetection, 1000);
        window.faceApiInterval = faceApiInterval;
    }
}

function stopFaceDetection() {
    clearInterval(faceApiInterval);
    faceApiInterval = null;
    window.faceApiInterval = faceApiInterval;
    hideFaceStatusPrompt();
    awayTimerStart = null;
}

function startPoseDetection() {
    if (!poseDetectionInterval && isAccountabilityOn && poseDetector) {
        poseDetectionInterval = setInterval(handlePoseDetection, 1000);
    }
}

function stopPoseDetection() {
    clearInterval(poseDetectionInterval);
    poseDetectionInterval = null;
}

async function handleFaceDetection() {
    if (!modelsLoaded || !isRunning || DOMElements.video.paused || DOMElements.video.ended || !DOMElements.video.srcObject) return;
    
    try {
        const detections = await faceapi.detectAllFaces(
            DOMElements.video, 
            new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 })
        ).withFaceLandmarks(true);

        const faceDetected = detections.length > 0;
        handlePresenceDetection(faceDetected);
    } catch (error) {
        console.error("Face detection error:", error);
    }
}

async function handlePoseDetection() {
    if (!poseDetector || !isRunning || DOMElements.video.paused || DOMElements.video.ended || !DOMElements.video.srcObject) return;
    
    try {
        const poses = await poseDetector.estimatePoses(DOMElements.video);
        const personDetected = poses.length > 0 && poses[0].keypoints.some(kp => kp.score > 0.4);
        
        // If pose detection finds a person, use that instead of face detection
        if (personDetected) {
            handlePresenceDetection(true);
        }
    } catch (error) {
        console.error("Pose detection error:", error);
    }
}

function handlePresenceDetection(presenceDetected) {
    if (isAccountabilityOn) {
        if (!presenceDetected) {
            if (!awayTimerStart) {
                awayTimerStart = Date.now();
                showFaceStatusPrompt("No face detected. Pausing in 15s...");
            } else if (Date.now() - awayTimerStart > 15000) { // 15 seconds
                pauseTimer(true);
                showFaceStatusPrompt("Timer paused. Come back to resume.");
            }
        } else {
            if (awayTimerStart) {
                awayTimerStart = null;
                hideFaceStatusPrompt();
                if (!isRunning && !pauseWasManual) startTimer(true);
            }
        }
    }
}

function showFaceStatusPrompt(message) {
    DOMElements.faceStatusPrompt.textContent = message;
    DOMElements.faceStatusPrompt.classList.add('visible');
}

function hideFaceStatusPrompt() {
    DOMElements.faceStatusPrompt.classList.remove('visible');
}

// ===================================================================================
// YOUTUBE PIP PLAYER FUNCTIONALITY
// ===================================================================================
function initYoutubePlayer() {
    // Default video for YouTube player
    const defaultVideoId = 'gUbNlN_SqpE';
    // Load YouTube IFrame API
    if (typeof YT !== 'undefined' && YT.Player) {
        createYoutubePlayer(defaultVideoId);
    } else {
        // Wait for YouTube API to load
        window.onYouTubeIframeAPIReady = function() {
            createYoutubePlayer(defaultVideoId);
        };
    }
    // Set up PiP player event listeners
    setupPipPlayer();
}

function createYoutubePlayer(playlistId) {
    youtubePlayer = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: playlistId,
        playerVars: {
            'autoplay': 0,
            'controls': 1,
            'rel': 0,
            'modestbranding': 1,
            'playsinline': 1
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

function onPlayerReady(event) {
    console.log("YouTube player ready");
}

function onPlayerStateChange(event) {
    // Handle player state changes if needed
}

function setupPipPlayer() {
    // Toggle PiP player visibility
    document.getElementById('pipYoutubeBtn').addEventListener('click', () => {
        DOMElements.pipPlayer.container.classList.toggle('hidden');
        if (!DOMElements.pipPlayer.container.classList.contains('hidden') && youtubePlayer) {
            youtubePlayer.playVideo();
        } else if (youtubePlayer) {
            youtubePlayer.pauseVideo();
        }
    });
    
    // Close PiP player
    DOMElements.pipPlayer.closeBtn.addEventListener('click', () => {
        DOMElements.pipPlayer.container.classList.add('hidden');
        if (youtubePlayer) {
            youtubePlayer.pauseVideo();
        }
    });
    
    // Set new YouTube URL
    DOMElements.pipPlayer.setBtn.addEventListener('click', () => {
        const url = DOMElements.pipPlayer.youtubeInput.value;
        const videoId = getYoutubeVideoId(url);
        if (videoId && youtubePlayer) {
            youtubePlayer.loadVideoById(videoId);
            DOMElements.pipPlayer.youtubeInput.value = '';
        } else if (url) {
            alert("Please enter a valid YouTube URL.");
        }
    });
    
    // Make PiP player draggable
    DOMElements.pipPlayer.header.addEventListener('mousedown', startDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('mousemove', drag);
    
    // Make PiP player resizable
    DOMElements.pipPlayer.resizeHandle.addEventListener('mousedown', startResize);
    document.addEventListener('mouseup', stopResize);
    document.addEventListener('mousemove', resize);
}

function startDrag(e) {
    isPipDragging = true;
    const rect = DOMElements.pipPlayer.container.getBoundingClientRect();
    pipDragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    e.preventDefault();
}

function stopDrag() {
    isPipDragging = false;
}

function drag(e) {
    if (!isPipDragging) return;
    
    DOMElements.pipPlayer.container.style.left = (e.clientX - pipDragOffset.x) + 'px';
    DOMElements.pipPlayer.container.style.top = (e.clientY - pipDragOffset.y) + 'px';
    DOMElements.pipPlayer.container.style.right = 'auto';
    DOMElements.pipPlayer.container.style.bottom = 'auto';
}

let isResizing = false;
let startWidth, startHeight, startX, startY;

function startResize(e) {
    isResizing = true;
    startWidth = parseInt(getComputedStyle(DOMElements.pipPlayer.container).width, 10);
    startHeight = parseInt(getComputedStyle(DOMElements.pipPlayer.container).height, 10);
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
}

function stopResize() {
    isResizing = false;
}

function resize(e) {
    if (!isResizing) return;
    
    const width = startWidth + (e.clientX - startX);
    const height = startHeight + (e.clientY - startY);
    
    // Set minimum size
    if (width > 300 && height > 200) {
        DOMElements.pipPlayer.container.style.width = width + 'px';
        DOMElements.pipPlayer.container.style.height = height + 'px';
    }
}

// ===================================================================================
// INITIALIZATION & UI LOGIC
// ===================================================================================
async function initializeAppState() {
    loadSettingsFromData();
    updateTimerDisplay();
    updateUIState();
    normalizeFocusAccounting();
    normalizeTodos();
    loadTodos();
    ensureFocusedTaskIndicator();
    updateFocusedTaskIndicator();
    updateCornerWidget();
    DOMElements.profile.nameDisplay.textContent = currentUserData.profileName || "Floww User";
    loadTheme();
    await loadFaceApiModels();
    await setupPoseDetection();
    
    // Initialize new features
    initJournal();
    initTimetable();
    initMacDock();
    initYoutubePlayer();

    // If no theme set, default to Chill background video
    if (!currentUserData.theme || (!currentUserData.theme.backgroundPath && !currentUserData.theme.youtubeVideoId)) {
        applyTheme('youtube', 'ZHMxuoUaWxM'); // Chill
    }
    
    // Update streak display
    DOMElements.streak.count.textContent = currentUserData.streakCount || 0;

    // Ensure daily rollovers on load and start day boundary watcher
    ensureDailyRollovers();
    startDayBoundaryWatcher();
}

function loadSettingsFromData() {
    const settings = currentUserData.settings || {};
    workDuration = settings.workDuration || 25 * 60;
    baseWorkDuration = workDuration;
    shortBreakDuration = settings.shortBreakDuration || 5 * 60;
    longBreakDuration = settings.longBreakDuration || 15 * 60;
    if (!isRunning && !isWorkSession) {
         timeLeft = (sessionCount % 4 === 0) ? longBreakDuration : shortBreakDuration;
    } else if (!isRunning) {
        timeLeft = workDuration;
    }

    document.getElementById('work-duration').value = workDuration / 60;
    document.getElementById('short-break-duration').value = shortBreakDuration / 60;
    document.getElementById('long-break-duration').value = longBreakDuration / 60;
    DOMElements.settings.soundEffects.value = settings.soundProfile || 'indian';
    // Accountability partner is coming-soon: keep switched off and UI disabled
    DOMElements.settings.accountabilityToggle.checked = false;
    DOMElements.settings.accountabilityToggle.disabled = true;

    isAccountabilityOn = false;
    window.isAccountabilityOn = isAccountabilityOn;
}

function saveSettingsToData() {
    const newWork = parseInt(document.getElementById('work-duration').value, 10) * 60;
    const newShort = parseInt(document.getElementById('short-break-duration').value, 10) * 60;
    const newLong = parseInt(document.getElementById('long-break-duration').value, 10) * 60;

    if (newWork && newShort && newLong) {
        currentUserData.settings = currentUserData.settings || {};
        currentUserData.settings.workDuration = newWork;
        currentUserData.settings.shortBreakDuration = newShort;
        currentUserData.settings.longBreakDuration = newLong;
        currentUserData.settings.soundProfile = DOMElements.settings.soundEffects.value;
        // Accountability partner is coming-soon: always off
        currentUserData.settings.isAccountabilityOn = false;

        isAccountabilityOn = false;
        window.isAccountabilityOn = isAccountabilityOn;

        // Ensure camera/detection off
        stopFaceDetection();
        stopPoseDetection();
        stopVideo();

        saveUserData();
        loadSettingsFromData();
        if (!isRunning) resetTimer();
        alert("Settings saved!");
    } else {
        alert("Please enter valid numbers for all durations.");
    }
}

function showCompletionPopup() { DOMElements.modals.completion.classList.add('visible'); }
function openStats() { 
    DOMElements.modals.stats.classList.add('visible'); 
    renderCharts(); 
    updateStatsDisplay(); 
}
function closeStats() { DOMElements.modals.stats.classList.remove('visible'); }
function updateStatsDisplay() {
    const totalSec = (typeof currentUserData.totalFocusSeconds === 'number' ? currentUserData.totalFocusSeconds : (currentUserData.totalFocusMinutes || 0) * 60);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    DOMElements.modals.totalFocusTime.textContent = `${hours}h ${minutes}m`;
    DOMElements.modals.totalSessionsCount.textContent = currentUserData.totalSessions || 0;
    DOMElements.modals.currentStreak.textContent = `${currentUserData.streakCount || 0} days`;
    DOMElements.modals.bestStreak.textContent = `${currentUserData.bestStreak || 0} days`;
    DOMElements.modals.longestSession.textContent = `${currentUserData.longestSession || 0}m`;
    DOMElements.modals.todaySessions.textContent = currentUserData.todaySessions || 0;
}
function showSessionReview() {
    if (!sessionStartTime || !isWorkSession) return;
    const totalDurationMs = Date.now() - sessionStartTime;
    const currentPauseDuration = lastPauseTimestamp ? Date.now() - lastPauseTimestamp : 0;
    const awayTimeMs = totalAwayTime + currentPauseDuration;
    const focusTimeMs = totalDurationMs - awayTimeMs;
    const formatMs = (ms) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    };

    document.getElementById('reviewFocusTime').textContent = formatMs(focusTimeMs);
    document.getElementById('reviewAwayTime').textContent = formatMs(awayTimeMs);
    document.getElementById('reviewTotalDuration').textContent = formatMs(totalDurationMs);
    DOMElements.modals.review.classList.add('visible');
}

// ===================================================================================
// ENHANCED TODO LIST FUNCTIONALITY
// ===================================================================================

// --- Confetti Animation ---
function showConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    const confettiCount = 80;
    for (let i = 0; i < confettiCount; i++) {
        const conf = document.createElement('div');
        conf.className = 'confetti-piece';
        conf.style.position = 'absolute';
        conf.style.left = Math.random() * 100 + '%';
        conf.style.top = '-20px';
        conf.style.width = '8px';
        conf.style.height = '16px';
        conf.style.background = `hsl(${Math.random()*360},80%,70%)`;
        conf.style.opacity = 0.8;
        conf.style.borderRadius = '3px';
        conf.style.transform = `rotate(${Math.random()*360}deg)`;
        conf.style.transition = 'top 1.2s cubic-bezier(.5,1.8,.5,1), opacity 1.2s';
        canvas.appendChild(conf);
        setTimeout(() => {
            conf.style.top = (60 + Math.random()*30) + '%';
            conf.style.opacity = 0;
        }, 50);
    }
    setTimeout(() => { canvas.innerHTML = ''; }, 1400);
}

// --- Joy Sound ---
function playCompleteSound() {
    const audio = document.getElementById('completeSound');
    if (audio) {
        audio.currentTime = 0;
        audio.play();
    }
}

// Focus/time accounting normalization
function normalizeFocusAccounting() {
    if (!currentUserData) return;
    if (typeof currentUserData.totalFocusSeconds !== 'number') {
        const m = Number(currentUserData.totalFocusMinutes) || 0;
        currentUserData.totalFocusSeconds = m * 60;
    }
    if (!currentUserData.weeklyFocusSeconds) {
        currentUserData.weeklyFocusSeconds = {};
        const wf = currentUserData.weeklyFocus || {};
        Object.keys(wf).forEach(k => {
            currentUserData.weeklyFocusSeconds[k] = (Number(wf[k]) || 0) * 60;
        });
    }
}

// --- Enhanced To-Do List ---
function normalizeTodos() {
    if (!currentUserData.todos) return;
    currentUserData.todos = currentUserData.todos.map(t => {
        const estimateMinutes = Number.isFinite(t.estimateMinutes) ? t.estimateMinutes : 0;
        let loggedSeconds = Number.isFinite(t.loggedSeconds) ? t.loggedSeconds : 0;
        if (loggedSeconds === 0 && Number.isFinite(t.loggedMinutes) && t.loggedMinutes > 0) {
            loggedSeconds = t.loggedMinutes * 60; // migrate old minutes to seconds
        }
        // Auto-complete if logged meets/exceeds estimate
        const estSec = estimateMinutes * 60;
        const completed = (!!t.completed) || (estSec > 0 && loggedSeconds >= estSec);
        if (completed && estSec > 0 && loggedSeconds > estSec) loggedSeconds = estSec;
        return {
            text: t.text,
            completed,
            subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
            estimateMinutes,
            loggedSeconds,
            createdAt: t.createdAt || Date.now()
        };
    });
}

function loadTodos() {
    const todoList = currentUserData.todos || [];
    const listEl = document.getElementById('todo-list');
    listEl.innerHTML = '';
    todoList.forEach((todo, idx) => {
        listEl.appendChild(createTodoElement(todo, idx));
    });
    makeTodoListSortable();
}

function createTodoElement(todo, index) {
    const item = document.createElement('li');
    item.className = 'todo-item' + (todo.completed ? ' completed' : '');
    if (index === activeTaskIndex) item.classList.add('focused');

    // Main row
    const mainRow = document.createElement('div');
    mainRow.className = 'todo-main-row';
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = !!todo.completed;
checkbox.addEventListener('change', () => {
        if (isRunning && activeTaskIndex === index) {
            alert('Complete the ongoing session first.');
            loadTodos();
            return;
        }
        toggleTodo(index);
    });
    // Label
    const label = document.createElement('span');
    label.className = 'todo-label';
    label.textContent = todo.text;
    // Actions
    const actions = document.createElement('div');
    actions.className = 'todo-actions';

    // Focus button (toggle task-specific session focus)
    const focusBtn = document.createElement('button');
    focusBtn.className = 'task-focus-btn';
    const isFocused = index === activeTaskIndex;
    focusBtn.innerHTML = '<i class="fas fa-bullseye"></i>';
    focusBtn.setAttribute('aria-label', isFocused ? 'Focused' : 'Focus');
    if (isFocused) focusBtn.classList.add('active');
    // Disable focusing completed tasks or during active sessions
    if (todo.completed) {
        focusBtn.disabled = true;
        focusBtn.title = 'Completed task';
    } else if (isRunning || sessionStartTime !== null) {
        focusBtn.disabled = true;
        focusBtn.title = 'Cannot change task focus during active session';
    } else {
        focusBtn.title = isFocused ? 'Unfocus this task' : 'Focus this task for the next session';
    }
    focusBtn.addEventListener('click', () => {
        // Prevent ANY task selection/deselection during active sessions (running OR paused)
        if (isRunning || sessionStartTime !== null) {
            alert('You cannot select or change tasks during an active session. Please complete or end the current session first.');
            return;
        }
        // Block focusing completed tasks
        if (todo.completed) {
            alert('This task is completed. Please select another task.');
            return;
        }
        if (activeTaskIndex === index) {
            activeTaskIndex = null;
        } else {
            activeTaskIndex = index;
        }
        loadTodos();
        updateFocusedTaskIndicator();
    });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'todo-delete-btn';
    delBtn.innerHTML = '<i class=\"fas fa-trash\"></i>';
delBtn.addEventListener('click', () => {
        if (isRunning && activeTaskIndex === index) {
            alert('Complete the ongoing session first.');
            return;
        }
        deleteTodo(index);
    });

    actions.appendChild(focusBtn);
    actions.appendChild(delBtn);

    mainRow.appendChild(checkbox);
    mainRow.appendChild(label);
    mainRow.appendChild(actions);
// Disable actions while running if this is the active task
    if (isRunning && index === activeTaskIndex) {
        checkbox.disabled = true;
        delBtn.disabled = true;
    }

    item.appendChild(mainRow);

    // Task meta and progress
    const meta = document.createElement('div');
    meta.className = 'task-meta';
const estMin = Number.isFinite(todo.estimateMinutes) ? todo.estimateMinutes : 0;
    const estSec = estMin * 60;
    const spentSec = Number.isFinite(todo.loggedSeconds) ? todo.loggedSeconds : 0;
    const percent = estSec > 0 ? Math.min(100, Math.round((spentSec / estSec) * 100)) : 0;

    const estSpan = document.createElement('span');
    estSpan.className = 'task-estimate';
    estSpan.innerHTML = `⏱ Est: ${formatDurationPretty(estSec)}`;

    const spentSpan = document.createElement('span');
    spentSpan.className = 'task-spent';
    spentSpan.innerHTML = `🔥 Spent: ${formatDurationPretty(spentSec)}${estSec>0 ? ` • ${percent}%` : ''}`;

    meta.appendChild(estSpan);
    meta.appendChild(spentSpan);
    item.appendChild(meta);

    const prog = document.createElement('div');
    prog.className = 'task-progress';
    const bar = document.createElement('div');
    bar.className = 'task-progress-bar';
bar.style.width = estSec > 0 ? `${percent}%` : '0%';
    prog.appendChild(bar);
    item.appendChild(prog);

    // Subtasks
    if (todo.subtasks && todo.subtasks.length > 0) {
        item.appendChild(renderSubtasks(todo.subtasks, index));
    }
    return item;
}

function renderSubtasks(subtasks, todoIndex) {
    const ul = document.createElement('ul');
    ul.className = 'subtasks-list';
    subtasks.forEach((sub, subIdx) => {
        const li = document.createElement('li');
        li.className = 'subtask-item' + (sub.completed ? ' completed' : '');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'subtask-checkbox';
        checkbox.checked = !!sub.completed;
        checkbox.addEventListener('change', () => {
            toggleSubtask(todoIndex, subIdx);
        });
        const label = document.createElement('span');
        label.className = 'subtask-label';
        label.textContent = sub.text;
        const delBtn = document.createElement('button');
        delBtn.className = 'subtask-delete-btn';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.addEventListener('click', () => {
            deleteSubtask(todoIndex, subIdx);
        });
        li.appendChild(checkbox);
        li.appendChild(label);
        li.appendChild(delBtn);
        ul.appendChild(li);
    });
    return ul;
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    // Prompt once for estimated minutes (optional, hidden input not shown)
    let estVal = 0;
    try {
        const ans = prompt('Estimated minutes for this task (optional):', '');
        if (ans !== null && ans.trim() !== '') {
            const parsed = parseInt(ans.trim(), 10);
            if (Number.isFinite(parsed) && parsed > 0) estVal = parsed;
        }
    } catch { /* ignore */ }
    if (!currentUserData.todos) currentUserData.todos = [];
    currentUserData.todos.push({ 
        text, 
        completed: false, 
        subtasks: [],
        estimateMinutes: estVal,
        loggedMinutes: 0,
        createdAt: Date.now()
    });
    input.value = '';
    saveUserData();
    loadTodos();
    updateFocusedTaskIndicator();
}

function toggleTodo(index) {
    if (isRunning && activeTaskIndex === index) {
        alert('Complete the ongoing session first.');
        // Re-render to reset checkbox state
        loadTodos();
        return;
    }
    const todo = currentUserData.todos[index];
    const wasCompleted = todo.completed;
    todo.completed = !todo.completed;
    
    // When marking as completed or uncompleted, clear focus if this task was focused
    if (activeTaskIndex === index) {
        activeTaskIndex = null;
    }
    
    // If task is being marked as completed, preserve its logged progress.
    // We keep loggedSeconds as-is to reflect actual time spent, and the task will show as completed.
    // Overall stats are accounted for via session logging.
    if (todo.completed && !wasCompleted) {
        // Optionally cap to estimate visually (do not inflate):
        const estSec = (Number.isFinite(todo.estimateMinutes) ? todo.estimateMinutes : 0) * 60;
        if (estSec > 0 && Number.isFinite(todo.loggedSeconds)) {
            todo.loggedSeconds = Math.min(todo.loggedSeconds, estSec);
        }
    }
    
    saveUserData();
    loadTodos();
    updateFocusedTaskIndicator();
    if (todo.completed && !wasCompleted) {
        playCompleteSound();
        showConfetti();
    }
}

function deleteTodo(index) {
    if (isRunning && activeTaskIndex === index) {
        alert('Complete the ongoing session first.');
        return;
    }
    
    // The time spent on this task has already been added to overall stats during sessions
    // So we can safely delete the task without affecting total focus time
    currentUserData.todos.splice(index, 1);
    
    if (activeTaskIndex === index) activeTaskIndex = null;
    else if (activeTaskIndex !== null && activeTaskIndex > index) activeTaskIndex -= 1;
    
    saveUserData();
    loadTodos();
    updateFocusedTaskIndicator();
}

function clearTodos() {
    currentUserData.todos = [];
    saveUserData();
    loadTodos();
}

function makeTodoListSortable() {
    // Drag and drop logic (unchanged)
}

document.getElementById('todo-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        addTodo();
    }
});
document.getElementById('add-todo-btn').addEventListener('click', addTodo);
document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);

function toggleSubtask(todoIndex, subtaskIndex) {
    const sub = currentUserData.todos[todoIndex].subtasks[subtaskIndex];
    sub.completed = !sub.completed;
    saveUserData();
    loadTodos();
    if (sub.completed) {
        playCompleteSound();
        showConfetti();
    }
}

function deleteSubtask(todoIndex, subtaskIndex) {
    currentUserData.todos[todoIndex].subtasks.splice(subtaskIndex, 1);
    saveUserData();
    loadTodos();
}

// ===================================================================================
// JOURNAL FUNCTIONALITY
// ===================================================================================
function initJournal() {
    // Set current date
    const today = new Date();
    DOMElements.journal.currentDate.textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    // Load today's entry if it exists
    const todayKey = today.toISOString().slice(0, 10);
    if (currentUserData.journalEntries && currentUserData.journalEntries[todayKey]) {
        const entry = currentUserData.journalEntries[todayKey];
        DOMElements.journal.entry.value = entry.text;
        updateCharCount();
        if (entry.image) {
            const img = document.createElement('img');
            img.src = entry.image;
            DOMElements.journal.imagePreview.innerHTML = '';
            DOMElements.journal.imagePreview.appendChild(img);
            DOMElements.journal.imagePreview.classList.remove('hidden');
        }
    } else {
        DOMElements.journal.entry.value = '';
        DOMElements.journal.imagePreview.innerHTML = '';
        DOMElements.journal.imagePreview.classList.add('hidden');
    }
    // Load previous entries
    loadPreviousJournalEntries();
    // Remove and re-add add photo feature
    if (DOMElements.journal.imageUpload) {
        DOMElements.journal.imageUpload.value = '';
        DOMElements.journal.imageUpload.removeEventListener('change', handleImageUpload);
        DOMElements.journal.imageUpload.addEventListener('change', handleImageUpload);
    }
}

function updateCharCount() {
    const text = DOMElements.journal.entry.value;
    const count = text.length;
    DOMElements.journal.charCount.textContent = `${count}/1024`;
    if (count > 1000) {
        DOMElements.journal.charCount.style.color = 'var(--danger-color)';
    } else if (count > 800) {
        DOMElements.journal.charCount.style.color = 'var(--primary-color)';
    } else {
        DOMElements.journal.charCount.style.color = 'var(--text-color)';
    }
    // Auto-save journal entry on type
    autoSaveJournalEntry();
    
    function autoSaveJournalEntry() {
        const text = DOMElements.journal.entry.value;
        if (text.length > 1024) return;
        const today = new Date();
        const todayKey = today.toISOString().slice(0, 10);
        if (!currentUserData.journalEntries) currentUserData.journalEntries = {};
        if (!currentUserData.journalEntries[todayKey] || currentUserData.journalEntries[todayKey].text !== text) {
            currentUserData.journalEntries[todayKey] = {
                text: text,
                date: todayKey,
                image: DOMElements.journal.imagePreview.querySelector('img')?.src || null
            };
            saveUserData();
            loadPreviousJournalEntries();
        }
    }
}

function saveJournalEntry() {
    const text = DOMElements.journal.entry.value;
    if (text.length > 1024) {
        alert("Journal entry exceeds 1024 characters. Please shorten it.");
        return;
    }
    
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10);
    
    if (!currentUserData.journalEntries) currentUserData.journalEntries = {};
    
    currentUserData.journalEntries[todayKey] = {
        text: text,
        date: todayKey,
        image: DOMElements.journal.imagePreview.querySelector('img')?.src || null
    };
    
    saveUserData();
    
    // Show save confirmation
    DOMElements.journal.saveStatus.textContent = 'Saved!';
    setTimeout(() => {
        DOMElements.journal.saveStatus.textContent = '';
    }, 2000);
    
    // Update previous entries list
    loadPreviousJournalEntries();
}

function loadPreviousJournalEntries() {
    const entriesContainer = DOMElements.journal.entriesList;
    entriesContainer.innerHTML = '';
    
    if (!currentUserData.journalEntries || Object.keys(currentUserData.journalEntries).length === 0) {
        entriesContainer.innerHTML = '<p>No previous entries yet.</p>';
        return;
    }
    
    // Sort entries by date (newest first)
    const sortedEntries = Object.entries(currentUserData.journalEntries)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .slice(0, 5); // Show only the 5 most recent
    
    sortedEntries.forEach(([date, entry]) => {
        const entryEl = document.createElement('div');
        entryEl.className = 'journal-entry-item';
        
        const entryDate = new Date(date);
        const formattedDate = entryDate.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let content = `
            <div class="journal-entry-date">
                <i class="fas fa-calendar"></i>${formattedDate}
            </div>
            <div class="journal-entry-content">${entry.text}</div>
        `;
        
        if (entry.image) {
            content += `<img src="${entry.image}" class="journal-entry-image" alt="Journal image">`;
        }
        
        entryEl.innerHTML = content;
        entriesContainer.appendChild(entryEl);
    });
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        alert('Please select an image file.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = document.createElement('img');
        img.src = event.target.result;
        DOMElements.journal.imagePreview.innerHTML = '';
        DOMElements.journal.imagePreview.appendChild(img);
        DOMElements.journal.imagePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// ===================================================================================
// TIMETABLE FUNCTIONALITY
// ===================================================================================
function initTimetable() {
    // Set current day
    updateCurrentDay();
    
    // Load saved timetable if exists
    if (currentUserData.timetable) {
        loadTimetableData();
    }
    
    // Set up day selection
    DOMElements.timetable.days.forEach(day => {
        day.addEventListener('click', () => {
            DOMElements.timetable.days.forEach(d => d.classList.remove('active'));
            day.classList.add('active');
            loadTimetableForDay(day.dataset.day);
        });
    });
    
    // Activate current day by default
    const currentDay = getCurrentDay();
    document.querySelector(`.day-tab[data-day="${currentDay}"]`).classList.add('active');
    loadTimetableForDay(currentDay);
    
    // Set up event listeners
    setupTimetableEvents();
}

function updateCurrentDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().getDay();
    const currentDayName = days[today].charAt(0).toUpperCase() + days[today].slice(1);
    DOMElements.timetable.currentDayName.textContent = `Today is ${currentDayName}`;
}

function getCurrentDay() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
}

function setupTimetableEvents() {
    // Add time slot button
    DOMElements.timetable.addSlotBtn.addEventListener('click', () => {
        openAddTimeSlotModal();
    });
    
    // Add first slot button
    DOMElements.timetable.addFirstSlotBtn.addEventListener('click', () => {
        openAddTimeSlotModal();
    });
    
    // Clear timetable button
    DOMElements.timetable.clearBtn.addEventListener('click', () => {
        clearTimetable();
    });
    
    // Close modal button
    document.querySelector('.close-modal').addEventListener('click', () => {
        DOMElements.timetable.addModal.classList.remove('visible');
    });
    
    // Timeslot form submission
    DOMElements.timetable.form.addEventListener('submit', (e) => {
        e.preventDefault();
        addTimeSlot();
    });
}

function openAddTimeSlotModal() {
    // Set the selected day in the modal
    const activeDay = document.querySelector('.day-tab.active');
    if (activeDay) {
        document.getElementById('timeslot-day').value = activeDay.dataset.day;
    }
    
    DOMElements.timetable.addModal.classList.add('visible');
}

function addTimeSlot() {
    const day = document.getElementById('timeslot-day').value;
    const start = document.getElementById('timeslot-start').value;
    const end = document.getElementById('timeslot-end').value;
    const activity = document.getElementById('timeslot-activity').value;
    
    if (!start || !end || !activity) {
        alert('Please fill all fields');
        return;
    }
    
    if (start >= end) {
        alert('End time must be after start time');
        return;
    }
    
    const timeslotId = `${day}-${start}-${end}`;
    
    if (!currentUserData.timetable) currentUserData.timetable = {};
    
    currentUserData.timetable[timeslotId] = {
        day: day,
        start: start,
        end: end,
        activity: activity,
        completed: false
    };
    
    saveUserData();
    DOMElements.timetable.addModal.classList.remove('visible');
    DOMElements.timetable.form.reset();
    
    // Reload the timetable for the current day
    const activeDay = document.querySelector('.day-tab.active');
    if (activeDay) {
        loadTimetableForDay(activeDay.dataset.day);
    }
}

function loadTimetableForDay(day) {
    const timeslotsList = DOMElements.timetable.timeslotsList;
    timeslotsList.innerHTML = '';
    
    if (!currentUserData.timetable || Object.keys(currentUserData.timetable).length === 0) {
        timeslotsList.innerHTML = `
            <div class="no-slots-message">
                <i class="fas fa-calendar-plus"></i>
                <p>No time slots added for this day yet.</p>
                <button id="add-first-slot" class="timetable-btn primary">Add your first time slot</button>
            </div>
        `;
        
        // Reattach event listener
        document.getElementById('add-first-slot').addEventListener('click', () => {
            openAddTimeSlotModal();
        });
        
        return;
    }
    
    // Filter timeslots for the selected day
    const dayTimeslots = Object.entries(currentUserData.timetable)
        .filter(([id, slot]) => slot.day === day)
        .sort((a, b) => a[1].start.localeCompare(b[1].start));
    
    if (dayTimeslots.length === 0) {
        timeslotsList.innerHTML = `
            <div class="no-slots-message">
                <i class="fas fa-calendar-plus"></i>
                <p>No time slots added for this day yet.</p>
                <button id="add-first-slot" class="timetable-btn primary">Add your first time slot</button>
            </div>
        `;
        
        // Reattach event listener
        document.getElementById('add-first-slot').addEventListener('click', () => {
            openAddTimeSlotModal();
        });
        
        return;
    }
    
    // Add timeslots to the list
    dayTimeslots.forEach(([id, slot]) => {
        const timeslotElement = createTimeslotElement(id, slot);
        timeslotsList.appendChild(timeslotElement);
    });
}

function createTimeslotElement(id, slot) {
    const element = document.createElement('div');
    element.className = 'timeslot-item';
    element.dataset.id = id;
    
    // Check if this is the current timeslot
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;
    const currentDay = getCurrentDay();
    
    if (currentDay === slot.day && currentTime >= slot.start && currentTime <= slot.end) {
        element.classList.add('current');
    }
    
    element.innerHTML = `
        <div class="timeslot-time">${formatTime(slot.start)} - ${formatTime(slot.end)}</div>
        <div class="timeslot-activity">${slot.activity}</div>
        <div class="timeslot-actions">
            <div class="timeslot-check ${slot.completed ? 'checked' : ''}"></div>
            <button class="timeslot-delete"><i class="fas fa-trash"></i></button>
        </div>
    `;
    
    // Add event listeners
    const checkBtn = element.querySelector('.timeslot-check');
    checkBtn.addEventListener('click', () => {
        toggleTimeslotCompletion(id);
    });
    
    const deleteBtn = element.querySelector('.timeslot-delete');
    deleteBtn.addEventListener('click', () => {
        deleteTimeslot(id);
    });
    
    return element;
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
}

function toggleTimeslotCompletion(id) {
    if (currentUserData.timetable && currentUserData.timetable[id]) {
        currentUserData.timetable[id].completed = !currentUserData.timetable[id].completed;
        saveUserData();
        
        // Update UI
        const element = document.querySelector(`.timeslot-item[data-id="${id}"]`);
        if (element) {
            const checkBtn = element.querySelector('.timeslot-check');
            checkBtn.classList.toggle('checked');
        }
    }
}

function deleteTimeslot(id) {
    if (confirm('Delete this time slot?')) {
        if (currentUserData.timetable && currentUserData.timetable[id]) {
            delete currentUserData.timetable[id];
            saveUserData();
            
            // Reload the timetable for the current day
            const activeDay = document.querySelector('.day-tab.active');
            if (activeDay) {
                loadTimetableForDay(activeDay.dataset.day);
            }
        }
    }
}

function clearTimetable() {
    if (confirm("Clear entire timetable? This cannot be undone.")) {
        currentUserData.timetable = {};
        saveUserData();
        
        // Reload the timetable for the current day
        const activeDay = document.querySelector('.day-tab.active');
        if (activeDay) {
            loadTimetableForDay(activeDay.dataset.day);
        }
    }
}

function loadTimetableData() {
    // This will be called when initializing to load any existing timetable data
    const activeDay = document.querySelector('.day-tab.active');
    if (activeDay) {
        loadTimetableForDay(activeDay.dataset.day);
    }
}

// ===================================================================================
// MOTIVATIONAL QUOTE OF THE DAY FUNCTIONALITY
// ===================================================================================
function getLocalDateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`; // local timezone date key
}

function fetchQuoteOfTheDay() {
    const quoteTextEl = document.getElementById('daily-quote');
    const quoteAuthorEl = document.getElementById('quote-author');
    if (!quoteTextEl || !quoteAuthorEl) return;
    // Cache by LOCAL date so it updates at local midnight (not UTC)
    const today = getLocalDateKey();
    const cached = JSON.parse(localStorage.getItem('quoteOfTheDay') || '{}');
    if (cached.date === today && cached.text && (cached.author !== undefined)) {
        quoteTextEl.textContent = cached.text;
        quoteAuthorEl.textContent = cached.author ? `— ${cached.author}` : '';
        return;
    }
    // Add a cache-buster tied to local day to avoid any stale intermediary caching
    fetch(`https://api.quotable.io/random?tags=motivational|inspirational&ts=${today}`)
        .then(res => res.json())
        .then(data => {
            const text = data?.content || 'Stay motivated and keep flowing!';
            const author = data?.author || '';
            quoteTextEl.textContent = text;
            quoteAuthorEl.textContent = author ? `— ${author}` : '';
            localStorage.setItem('quoteOfTheDay', JSON.stringify({
                date: today,
                text,
                author
            }));
        })
        .catch(() => {
            quoteTextEl.textContent = 'Stay motivated and keep flowing!';
            quoteAuthorEl.textContent = '';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchQuoteOfTheDay();
    // Professional interactive motion for quote text
    const quoteTextEl = document.getElementById('daily-quote');
    if (quoteTextEl) {
        let tiltTimeout;
        quoteTextEl.addEventListener('mousemove', (e) => {
            const rect = quoteTextEl.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * 8;
            const rotateY = ((x - centerX) / centerX) * -8;
            quoteTextEl.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
            quoteTextEl.classList.add('tilted');
            clearTimeout(tiltTimeout);
        });
        quoteTextEl.addEventListener('mouseleave', () => {
            quoteTextEl.style.transform = '';
            quoteTextEl.classList.remove('tilted');
        });
        quoteTextEl.addEventListener('click', () => {
            // Fall down animation
            quoteTextEl.classList.add('fall');
            // Remove from view after animation
            setTimeout(() => {
                quoteTextEl.style.visibility = 'hidden';
                quoteTextEl.classList.remove('fall');
                quoteTextEl.style.transform = '';
                quoteTextEl.classList.remove('tilted');
                // Restore after delay
                setTimeout(() => {
                    quoteTextEl.style.visibility = 'visible';
                }, 1200);
            }, 700);
        });
    }
});
// macOS DOCK FUNCTIONALITY
// ===================================================================================
// ===================================================================================
function initMacDock() {
    DOMElements.dockItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            navigateToSection(section);
            
            // Add active class for visual feedback
            DOMElements.dockItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

function navigateToSection(section) {
    // First, close any open modals
    closeStats();
    DOMElements.modals.completion.classList.remove('visible');
    DOMElements.modals.review.classList.remove('visible');
    
    // Hide all sections first
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));

    // Controlled visibility per destination
    const show = id => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); };
    const hide = id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); };

    switch(section) {
        case 'timer':
            show('timer-section');
            show('features-section');
            show('leaderboard-section');
            show('quote-section');
            break;
        case 'todo':
            show('timer-section');
            show('features-section');
            show('leaderboard-section');
            show('quote-section');
            setTimeout(() => {
                document.getElementById('todo-container').scrollIntoView({ behavior: 'smooth' });
            }, 100);
            break;
        case 'journal':
            show('journal-section');
            hide('leaderboard-section');
            break;
        case 'timetable':
            show('timetable-section');
            hide('leaderboard-section');
            break;
        case 'stats':
            openStats();
            setTimeout(() => switchTab('stats'), 100);
            break;
        case 'settings':
            openStats();
            setTimeout(() => switchTab('settings'), 100);
            break;
    }
}

// ===================================================================================
// EVENT LISTENERS SETUP
// ===================================================================================
function setupEventListeners() {
    // Timer controls
    DOMElements.playPauseBtn.addEventListener('click', () => { isRunning ? pauseTimer(false) : startTimer(false); });
    DOMElements.resetBtn.addEventListener('click', resetTimer);
    DOMElements.endSessionBtn.addEventListener('click', endSession);
    DOMElements.focusMode.playPauseBtn.addEventListener('click', () => { isRunning ? pauseTimer(false) : startTimer(false); });
    DOMElements.focusMode.exitBtn.addEventListener('click', () => { document.body.classList.remove('focus-mode'); });
    
    // Auth forms
    document.getElementById('signup-form').addEventListener('submit', handleSignUp);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); showLoginForm(); });
    document.getElementById('show-signup').addEventListener('click', (e) => { e.preventDefault(); showSignupForm(); });
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    
    // Modal controls
    document.getElementById('statsBtn').addEventListener('click', openStats);
    document.getElementById('closeCompletionModalBtn').addEventListener('click', () => { DOMElements.modals.completion.classList.remove('visible'); });
    document.getElementById('closeReviewModalBtn').addEventListener('click', () => { DOMElements.modals.review.classList.remove('visible'); });
    document.querySelector('.close-btn').addEventListener('click', closeStats);
    
    // Settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettingsToData);
    document.getElementById('clearDataBtn').addEventListener('click', () => {
        if (confirm("This will permanently delete ALL your data. Are you sure?")) {
            currentUserData = getDefaultUserData();
            if (isGuestMode) {
                localStorage.removeItem('youfloww_guest');
            } else if (userDataRef) {
                setDoc(userDataRef, currentUserData);
            }
            resetTimer();
            loadTodos();
            alert("All data has been cleared.");
        }
    });
    
    // Theme store
    document.querySelectorAll('.store-item button').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.parentElement;
            const type = item.dataset.type;
            const path = item.dataset.path || item.dataset.id;
            applyTheme(type, path);
        });
    });
    
    // YouTube background
    document.getElementById('setYoutubeBtn').addEventListener('click', () => {
        const url = document.getElementById('youtube-input').value;
        const videoId = getYoutubeVideoId(url);
        if (videoId) applyTheme('youtube', videoId);
        else alert("Please enter a valid YouTube URL.");
    });
    
    // Image background
    document.getElementById('uploadImageBtn').addEventListener('click', () => {
        document.getElementById('image-upload-input').click();
    });
    document.getElementById('image-upload-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.match('image.*')) {
            const reader = new FileReader();
            reader.onload = (event) => applyTheme('image', event.target.result);
            reader.readAsDataURL(file);
        }
    });
    document.getElementById('clearImageBtn').addEventListener('click', () => {
        document.body.style.backgroundImage = '';
        if (currentUserData.theme) currentUserData.theme.backgroundPath = null;
        saveUserData();
    });
    
    // Ambient effects
    document.getElementById('snowBtn').addEventListener('click', () => { toggleAmbientEffect('snow'); });
    document.getElementById('rainBtn').addEventListener('click', () => { toggleAmbientEffect('rain'); });
    document.getElementById('sakuraBtn').addEventListener('click', () => { toggleAmbientEffect('sakura'); });
    
    // Focus mode
    document.getElementById('focusModeBtn').addEventListener('click', () => {
        document.body.classList.add('focus-mode');
        DOMElements.focusMode.timer.textContent = DOMElements.timerDisplay.textContent;
    });
    
    // Ambient noise picker
    setupNoisePicker();
    document.getElementById('noiseBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNoiseOverlay();
    });
    // Close overlay on outside click
    window.addEventListener('click', (e) => {
        const ov = document.getElementById('noiseOverlay');
        if (!ov) return;
        if (!ov.contains(e.target) && e.target.id !== 'noiseBtn') hideNoiseOverlay();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideNoiseOverlay(); });
    
    // Tabs in stats modal
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });
    
    // To-Do List
    document.getElementById('add-todo-btn').addEventListener('click', addTodo);
    document.getElementById('todo-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    document.querySelector('.clear-todos-btn').addEventListener('click', clearTodos);
    
    // Journal
    DOMElements.journal.entry.addEventListener('input', updateCharCount);
    DOMElements.journal.saveBtn.addEventListener('click', saveJournalEntry);
    if (DOMElements.journal.imageUpload) {
        DOMElements.journal.imageUpload.removeEventListener('change', handleImageUpload);
        DOMElements.journal.imageUpload.addEventListener('change', handleImageUpload);
    }
    const uploadBtn = document.getElementById('upload-image-btn');
    if (uploadBtn) {
        uploadBtn.onclick = () => DOMElements.journal.imageUpload.click();
    }
    
    // Close modals when clicking outside (do not close auth modal)
    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            if (e.target.id !== 'authModal') {
                e.target.classList.remove('visible');
            }
        }
    });
    
    // Change name button
    const changeNameBtn = document.getElementById('changeNameBtn');
    if (changeNameBtn) {
        changeNameBtn.onclick = () => {
            const newName = prompt("Enter your name:", currentUserData.profileName || "Floww User");
            if (newName && newName.trim()) {
                currentUserData.profileName = newName.trim();
                DOMElements.profile.nameDisplay.textContent = newName.trim();
                saveUserData();
                updatePublicUserDoc();
            }
        };
    }
    
    // Progress widget
    updateCornerWidget();
    setInterval(updateCornerWidget, 60000);
}

// ===================================================================================
// HELPER FUNCTIONS
// ===================================================================================
let ambientAudio = null;
const ambientCache = {};
let currentAmbientKey = null; // 'sea_waves' | 'fireplace' | 'cafe' | 'nature' | 'thunderstorm' | 'crickets'

function stopAmbientSound() {
    try { if (ambientAudio) ambientAudio.pause(); } catch {}
    ambientAudio = null;
    currentAmbientKey = null;
    const btn = document.getElementById('noiseBtn');
    if (btn) btn.textContent = '🎧 Play Noise';
}

function playAmbientSound(key) {
    // Map keys to files (sea_waves uses existing whiteNoise element)
    const map = {
        sea_waves: { type: 'element', el: DOMElements.sounds.whiteNoise },
        fireplace: { file: 'fireplace.mp3' },
        cafe: { file: 'cafe.mp3' },
        nature: { file: 'nature.mp3' },
        thunderstorm: { file: 'thunderstorm.mp3' },
        crickets: { file: 'crickets.mp3' },
    };
    const btn = document.getElementById('noiseBtn');
    const cfg = map[key];
    if (!cfg) return;

    // Stop current
    stopAmbientSound();

    if (cfg.type === 'element' && cfg.el) {
        ambientAudio = cfg.el;
    } else if (cfg.file) {
        if (!ambientCache[cfg.file]) {
            const a = new Audio(`assets/sounds/${cfg.file}`);
            a.loop = true;
            ambientCache[cfg.file] = a;
        }
        ambientAudio = ambientCache[cfg.file];
    }
    currentAmbientKey = key;
    if (ambientAudio) {
        ambientAudio.currentTime = 0;
        ambientAudio.loop = true;
        ambientAudio.volume = 1.0;
        ambientAudio.play().catch(e => console.error('Ambient play failed:', e));
        if (btn) btn.textContent = '🔇 Stop Noise';
    }
}

function setupNoisePicker() {
    if (document.getElementById('noiseOverlay')) return;
    const ov = document.createElement('div');
    ov.id = 'noiseOverlay';
    ov.className = 'noise-overlay hidden';
    ov.innerHTML = `
      <div class="noise-card">
        <div class="noise-title">Pick a sound</div>
        <div class="noise-grid">
          <button class="noise-option" data-key="sea_waves">🌊 Sea Waves</button>
          <button class="noise-option" data-key="fireplace">🔥 Fireplace</button>
          <button class="noise-option" data-key="cafe">☕ Cafe</button>
          <button class="noise-option" data-key="nature">🌿 Nature</button>
          <button class="noise-option" data-key="thunderstorm">⛈️ Thunderstorm</button>
          <button class="noise-option" data-key="crickets">🦗 Crickets</button>
        </div>
        <div class="noise-actions">
          <button id="noiseStopBtn" class="noise-stop">🔇 Stop</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelectorAll('.noise-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const key = e.currentTarget.getAttribute('data-key');
            playAmbientSound(key);
            hideNoiseOverlay();
        });
    });
    const stopBtn = ov.querySelector('#noiseStopBtn');
    if (stopBtn) stopBtn.addEventListener('click', () => { stopAmbientSound(); hideNoiseOverlay(); });
}

function toggleNoiseOverlay() {
    const ov = document.getElementById('noiseOverlay');
    if (!ov) return;
    positionNoiseOverlay(ov);
    ov.classList.toggle('hidden');
}
function showNoiseOverlay() { const ov = document.getElementById('noiseOverlay'); if (ov) { positionNoiseOverlay(ov); ov.classList.remove('hidden'); } }
function hideNoiseOverlay() { const ov = document.getElementById('noiseOverlay'); if (ov) ov.classList.add('hidden'); }

function positionNoiseOverlay(ov) {
    const anchor = document.getElementById('noiseBtn');
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    ov.style.position = 'fixed';
    ov.style.left = `${Math.max(12, r.left)}px`;
    ov.style.top = `${Math.max(12, r.top - 140)}px`;
}
function handleSignUp(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const location = document.getElementById('signup-location').value;
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            currentUserData = { ...getDefaultUserData(), settings: { ...getDefaultUserData().settings, soundProfile: location } };
            saveUserData();
        })
        .catch((error) => {
            DOMElements.authError.textContent = error.message;
        });
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => {
            DOMElements.authError.textContent = error.message;
        });
}

function handleLogout() {
    signOut(auth).catch((error) => {
        console.error("Logout error:", error);
    });
}

function showLoginForm() {
    document.getElementById('signup-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

function showSignupForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('signup-form').classList.remove('hidden');
}

function updateCornerWidget() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 0);
    
    const dayProgress = (now - startOfDay) / (endOfDay - startOfDay) * 100;
    const monthProgress = (now - startOfMonth) / (endOfMonth - startOfMonth) * 100;
    const yearProgress = (now - startOfYear) / (endOfYear - startOfYear) * 100;
    
    document.getElementById('dayProgressBar').style.width = `${dayProgress}%`;
    document.getElementById('monthProgressBar').style.width = `${monthProgress}%`;
    document.getElementById('yearProgressBar').style.width = `${yearProgress}%`;
    
    document.getElementById('dayProgressPercent').textContent = `${Math.round(dayProgress)}%`;
    document.getElementById('monthProgressPercent').textContent = `${Math.round(monthProgress)}%`;
    document.getElementById('yearProgressPercent').textContent = `${Math.round(yearProgress)}%`;
}

function getYoutubeVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : false;
}

function applyTheme(type, path) {
    const container = document.getElementById('video-background-container');
    if (type === 'image') {
        // Clear any previous YouTube background so the image is visible
        if (container) container.innerHTML = '';
        document.body.style.backgroundImage = `url(${path})`;
        currentUserData.theme = { backgroundPath: path, youtubeVideoId: null };
    } else if (type === 'youtube') {
        document.body.style.backgroundImage = '';
        if (container) {
            container.innerHTML = `<iframe src="https://www.youtube.com/embed/${path}?autoplay=1&mute=1&loop=1&playlist=${path}&controls=0&modestbranding=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
        currentUserData.theme = { backgroundPath: null, youtubeVideoId: path };
    }
    saveUserData();
}

function loadTheme() {
    if (currentUserData.theme) {
        const container = document.getElementById('video-background-container');
        if (currentUserData.theme.backgroundPath) {
            // Ensure any previous YouTube iframe is removed
            if (container) container.innerHTML = '';
            document.body.style.backgroundImage = `url(${currentUserData.theme.backgroundPath})`;
        } else if (currentUserData.theme.youtubeVideoId) {
            if (container) {
                container.innerHTML = `<iframe src="https://www.youtube.com/embed/${currentUserData.theme.youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${currentUserData.theme.youtubeVideoId}&controls=0&modestbranding=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            }
        }
    }
}

function toggleAmbientEffect(effect) {
    const snowBtn = document.getElementById('snowBtn');
    const rainBtn = document.getElementById('rainBtn');
    const sakuraBtn = document.getElementById('sakuraBtn');

    // Toggle individual effect on/off (multi-mode)
    if (effect === 'snow') {
        isSnowActive = !isSnowActive;
        if (snowBtn) snowBtn.classList.toggle('active', isSnowActive);
        if (!isSnowActive && DOMElements.ambientContainer) {
            DOMElements.ambientContainer.querySelectorAll('.ambient-effect.snowflake').forEach(el => el.remove());
        }
    } else if (effect === 'rain') {
        isRainActive = !isRainActive;
        if (rainBtn) rainBtn.classList.toggle('active', isRainActive);
        if (!isRainActive && DOMElements.ambientContainer) {
            DOMElements.ambientContainer.querySelectorAll('.ambient-effect.raindrop, .splash-effect').forEach(el => el.remove());
        }
    } else if (effect === 'sakura') {
        isSakuraActive = !isSakuraActive;
        if (sakuraBtn) sakuraBtn.classList.toggle('active', isSakuraActive);
        if (!isSakuraActive && DOMElements.ambientContainer) {
            DOMElements.ambientContainer.querySelectorAll('.ambient-effect.sakura').forEach(el => el.remove());
        }
    }

    const anyActive = isSnowActive || isRainActive || isSakuraActive;
    if (anyActive) {
        // Start loop if not running
        if (!animationFrameId) spawnAmbientParticles('multi');
    } else {
        // Nothing active: stop loop and clear all nodes
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        if (DOMElements.ambientContainer) {
            DOMElements.ambientContainer.querySelectorAll('.ambient-effect, .splash-effect').forEach(el => el.remove());
        }
    }
}

function spawnAmbientParticles(effect) {
    // Start a unified physics loop that respects all active effects
    if (animationFrameId) return; // loop already running

    const W = window.innerWidth;
    const H = window.innerHeight;
    const particles = [];
    let lastSpawnSnow = 0, lastSpawnRain = 0, lastSpawnSakura = 0;

    function makeParticle(kind) {
        const el = document.createElement('div');
        el.className = `ambient-effect ${kind}`;
        el.style.position = 'absolute';
        el.style.willChange = 'transform, opacity';
        el.style.left = '0';
        el.style.top = '0';

        const p = { el, kind, x: Math.random() * W, y: -20, vx: 0, vy: 0, rot: 0, vr: 0, life: 0, maxLife: 10000 };
        if (kind === 'snowflake') {
            const size = 6 + Math.random() * 8;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.borderRadius = '50%';
            el.style.background = 'rgba(255,255,255,0.9)';
            p.vy = 30 + Math.random() * 25; // px/s
            p.vx = -20 + Math.random() * 40; // gentle drift
            p.vr = (-0.3 + Math.random() * 0.6);
            p.maxLife = 20000;
        } else if (kind === 'raindrop') {
            const h = 18 + Math.random() * 22;
            el.style.width = `2px`;
            el.style.height = `${h}px`;
            el.style.background = 'linear-gradient(to bottom, rgba(166,192,232,0.8), rgba(166,192,232,0.3))';
            p.vy = 400 + Math.random() * 300; // fast
            p.vx = -40 + Math.random() * 80; // wind
            p.maxLife = 4000;
        } else if (kind === 'sakura') {
            const size = 12 + Math.random() * 12;
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
            el.style.backgroundImage = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 50 50\"><path fill=\"%23FFC0CB\" d=\"M25 38.2c-1-5.1-4.7-9.3-9.5-12.2 4.9-2.9 8.6-7.1 9.5-12.2 1 5.1 4.7 9.3 9.5 12.2-4.9 2.9-8.6 7.1-9.5 12.2z\"/></svg>')";
            el.style.backgroundSize = 'contain';
            el.style.backgroundRepeat = 'no-repeat';
            p.vy = 35 + Math.random() * 25;
            p.vx = -30 + Math.random() * 60;
            p.vr = (-1 + Math.random() * 2);
            p.maxLife = 16000;
        }
        DOMElements.ambientContainer.appendChild(el);
        particles.push(p);
        return p;
    }

    function update(dt) {
        const wind = Math.sin(Date.now() * 0.0005) * 20; // px/s wind drift
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            // Remove instantly if effect was turned off
            if ((p.kind === 'snowflake' && !isSnowActive) ||
                (p.kind === 'raindrop' && !isRainActive) ||
                (p.kind === 'sakura' && !isSakuraActive)) {
                if (p.el && p.el.parentNode) p.el.parentNode.removeChild(p.el);
                particles.splice(i, 1);
                continue;
            }
            // Physics
            const g = p.kind === 'raindrop' ? 900 : 50; // gravity px/s^2
            p.vy += g * dt;
            p.vx += wind * dt * (p.kind === 'snowflake' ? 0.05 : 0.02);
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.rot += p.vr * dt * 60;

            // Render
            p.el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) rotate(${p.rot}deg)`;

            // Bounds & splash for rain
            if (p.y > H + 40 || p.x < -60 || p.x > W + 60) {
                // Splash for rain
                if (p.kind === 'raindrop') {
                    const splash = document.createElement('div');
                    splash.className = 'splash-effect';
                    splash.style.position = 'absolute';
                    splash.style.left = `${p.x}px`;
                    splash.style.top = `${H-6}px`;
                    splash.style.width = '10px';
                    splash.style.height = '10px';
                    splash.style.border = '2px solid rgba(166,192,232,0.6)';
                    splash.style.borderRadius = '50%';
                    splash.style.opacity = '0.8';
                    splash.style.transform = 'translate(-50%, -50%)';
                    DOMElements.ambientContainer.appendChild(splash);
                    setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 180);
                }
                // Remove particle
                if (p.el.parentNode) p.el.parentNode.removeChild(p.el);
                particles.splice(i, 1);
            }
        }
    }

    let last = performance.now();
    function loop(ts) {
        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;

        // Spawn per active effect
        const now = ts;
        if (isSnowActive && now - lastSpawnSnow > 50) { // more visible snow
            lastSpawnSnow = now;
            makeParticle('snowflake');
        }
        if (isRainActive && now - lastSpawnRain > 25) { // denser rain
            lastSpawnRain = now;
            makeParticle('raindrop');
        }
        if (isSakuraActive && now - lastSpawnSakura > 120) {
            lastSpawnSakura = now;
            makeParticle('sakura');
        }

        update(dt);

        if (isSnowActive || isRainActive || isSakuraActive) {
            animationFrameId = requestAnimationFrame(loop);
        } else {
            // Cleanup when nothing active
            particles.forEach(p => { if (p.el.parentNode) p.el.parentNode.removeChild(p.el); });
            particles.length = 0;
            animationFrameId = null;
        }
    }

    animationFrameId = requestAnimationFrame(loop);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Container`).classList.add('active');
}

function formatMinutesPretty(totalMinutes) {
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0m';
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
}

function formatDurationPretty(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 && h === 0) parts.push(`${s}s`); // hide seconds when hours present for brevity
    return parts.join(' ');
}

function ensureFocusedTaskIndicator() {
    if (document.getElementById('focusedTaskIndicator')) return;
    const indicator = document.createElement('div');
    indicator.id = 'focusedTaskIndicator';
    indicator.className = 'focused-task-indicator hidden';
    const statusEl = document.getElementById('status');
    if (statusEl && statusEl.parentElement) {
        statusEl.insertAdjacentElement('afterend', indicator);
    } else {
        // Fallback: append to timer section
        const ts = document.getElementById('timer-section');
        if (ts) ts.prepend(indicator);
    }
}

function updateFocusedTaskIndicator() {
    const el = document.getElementById('focusedTaskIndicator');
    if (!el) return;
    if (activeTaskIndex === null || !currentUserData.todos || !currentUserData.todos[activeTaskIndex]) {
        el.classList.add('hidden');
        el.textContent = '';
        applyTaskTimerOverride();
        return;
    }
    const name = currentUserData.todos[activeTaskIndex].text || 'Selected Task';
    el.textContent = `Currently focusing on: ${name}`;
    el.classList.remove('hidden');
    applyTaskTimerOverride();
}

function getFocusedTaskRemainingSeconds() {
    if (activeTaskIndex === null || !currentUserData.todos) return null;
    const t = currentUserData.todos[activeTaskIndex];
    if (!t || t.completed) return null;
    const estMin = Number.isFinite(t.estimateMinutes) ? t.estimateMinutes : 0;
    const estSec = estMin * 60;
    const spentSec = Number.isFinite(t.loggedSeconds) ? t.loggedSeconds : 0;
    const remainingSec = Math.max(0, estSec - spentSec);
    return remainingSec;
}

function applyTaskTimerOverride() {
    // Only apply timer override when no session is active (not running AND not paused)
    if (isRunning || sessionStartTime !== null) {
        return; // Don't change timer during active sessions
    }
    
    const remainingSec = getFocusedTaskRemainingSeconds();
    if (remainingSec && remainingSec > 0) {
        // Override work session to remaining time only when no session is active
        workDuration = remainingSec;
        isWorkSession = true;
        timeLeft = remainingSec;
        updateTimerDisplay();
    } else {
        // Restore defaults when no focus or nothing remaining
        if (baseWorkDuration) workDuration = baseWorkDuration;
        if (isWorkSession) {
            timeLeft = workDuration;
            updateTimerDisplay();
        }
    }
}

function showStreakAnimation(type, count) {
    // Create overlay lazily
    let overlay = document.getElementById('streakOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'streakOverlay';
        overlay.className = 'streak-overlay hidden';
        document.body.appendChild(overlay);
    }
    overlay.className = 'streak-overlay ' + (type === 'increase' ? 'streak-up' : 'streak-reset');
    overlay.innerHTML = type === 'increase'
        ? `<div class="streak-anim">🔥 Streak Up! <span>${count}</span> day${count===1?'':'s'}</div>`
        : `<div class="streak-anim">💧 Streak Reset</div>`;
    // Auto hide
    setTimeout(() => { if (overlay) overlay.classList.add('hidden'); }, 1800);
}

function renderCharts() {
    // Weekly focus chart (in hours)
    const weeklyData = currentUserData.weeklyFocus || {};
    // Build last 7 local-day keys in chronological order
    const last7Days = [...Array(7)].map((_, idx) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - idx));
        return getLocalDateKey(d);
    });
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (window.barChartInstance) window.barChartInstance.destroy();
    // Convert minutes to hours (rounded to 2 decimals)
    const hoursArr = last7Days.map(k => ((weeklyData[k] || 0) / 60).toFixed(2));
    window.barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
labels: last7Days.map(k => dateKeyToLocalDate(k).toLocaleDateString('en-US', { weekday: 'short' })),
            datasets: [{
                label: 'Focus Hours',
                data: hoursArr,
                backgroundColor: {
                    type: 'linear',
                    x0: 0,
                    y0: 0,
                    x1: 0,
                    y1: 400,
                    colorStops: {
                        0: '#6c63ff',
                        1: '#f7a047'
                    }
                },
                borderRadius: 10,
                borderColor: 'rgba(108, 99, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 1200,
                easing: 'easeOutQuart'
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#e0e0e0',
                        callback: function(value) { return value + 'h'; }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                x: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} hours`
                    }
                }
            }
        }
    });

    // Session distribution chart (animated, improved pie)
    const sessionData = currentUserData.todos ? currentUserData.todos.reduce((acc, todo) => {
        if (todo.completed) acc.completed++;
        else acc.pending++;
        return acc;
    }, { completed: 0, pending: 0 }) : { completed: 0, pending: 0 };
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (window.pieChartInstance) window.pieChartInstance.destroy();
    window.pieChartInstance = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending'],
            datasets: [{
                data: [sessionData.completed, sessionData.pending],
                backgroundColor: [
                    'rgba(76, 175, 80, 0.92)',
                    'rgba(244, 67, 54, 0.92)'
                ],
                borderColor: [
                    'rgba(76, 175, 80, 1)',
                    'rgba(244, 67, 54, 1)'
                ],
                borderWidth: 3,
                hoverOffset: 18,
                hoverBorderColor: '#fff',
                hoverBorderWidth: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1200,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#e0e0e0', font: { weight: 'bold', size: 14 }, padding: 18 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${ctx.parsed}`
                    },
                    backgroundColor: '#222',
                    titleColor: '#4caf50',
                    bodyColor: '#fff',
                    borderColor: '#4caf50',
                    borderWidth: 2
                }
            }
        }
    });
}

// ===================================================================================
// INITIALIZATION
// ===================================================================================
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    // Initialize the app state after DOM is loaded
    if (isGuestMode) {
        initializeAppState();
    }
    // Render journal and timetable in Customize modal when opened
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            renderJournalTabEntries();
            renderTimetableTabEntries();
        });
    }
});

// Render all journal entries in the Customize modal's Journal tab
function renderJournalTabEntries() {
    const container = document.getElementById('journal-tab-entries');
    container.innerHTML = '';
    if (!currentUserData.journalEntries || Object.keys(currentUserData.journalEntries).length === 0) {
        container.innerHTML = '<p>No journal entries yet.</p>';
        // Also update main journal/history if open
        if (window.DOMElements && DOMElements.journal && DOMElements.journal.entriesList) {
            DOMElements.journal.entriesList.innerHTML = '<p>No previous entries yet.</p>';
        }
        return;
    }
    // Sort by date (newest first)
    const sorted = Object.entries(currentUserData.journalEntries)
        .sort(([a], [b]) => new Date(b) - new Date(a));
    sorted.forEach(([date, entry]) => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'journal-entry-item';
        const entryDate = new Date(date);
        const formattedDate = entryDate.toLocaleDateString('en-US', {
            weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
        });
        let html = `<div class="journal-entry-date"><i class="fas fa-calendar"></i>${formattedDate}</div>`;
        html += `<div class="journal-entry-content">${entry.text}</div>`;
        if (entry.image) {
            html += `<img src="${entry.image}" class="journal-entry-image" alt="Journal image">`;
            html += `<button class="delete-journal-image-btn" data-date="${date}"><i class="fas fa-trash"></i> Delete Image</button>`;
        }
        html += `<button class="delete-journal-entry-btn" data-date="${date}"><i class="fas fa-trash"></i> Delete Entry</button>`;
        entryDiv.innerHTML = html;
        container.appendChild(entryDiv);
    });
    // Add delete event listeners
    container.querySelectorAll('.delete-journal-entry-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = btn.getAttribute('data-date');
            if (confirm('Delete this journal entry?')) {
                delete currentUserData.journalEntries[date];
                saveUserData();
                renderJournalTabEntries();
                // Also update main journal/history if open
                if (typeof loadPreviousJournalEntries === 'function') loadPreviousJournalEntries();
            }
        });
    });
    container.querySelectorAll('.delete-journal-image-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const date = btn.getAttribute('data-date');
            if (currentUserData.journalEntries[date]) {
                currentUserData.journalEntries[date].image = null;
                saveUserData();
                renderJournalTabEntries();
                // Also update main journal/history if open
                if (typeof loadPreviousJournalEntries === 'function') loadPreviousJournalEntries();
            }
        });
    });
}

// Render all timetable slots in the Customize modal's Timetable tab
function renderTimetableTabEntries() {
    const container = document.querySelector('#timetableContainer .timetable-tab-content');
    if (!container) return;
    let html = '';
    if (!currentUserData.timetable || Object.keys(currentUserData.timetable).length === 0) {
        html = '<p>No timetable slots added yet.</p>';
    } else {
        // Group by day
        const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        days.forEach(day => {
            const slots = Object.entries(currentUserData.timetable).filter(([id, slot]) => slot.day === day);
            if (slots.length > 0) {
                html += `<div class="timetable-day-group"><h4>${day.charAt(0).toUpperCase() + day.slice(1)}</h4>`;
                slots.sort((a, b) => a[1].start.localeCompare(b[1].start)).forEach(([id, slot]) => {
                    html += `<div class="timetable-slot-item">`;
                    html += `<span class="timetable-slot-time">${slot.start} - ${slot.end}</span> `;
                    html += `<span class="timetable-slot-activity">${slot.activity}</span> `;
                    html += `<button class="delete-timetable-slot-btn" data-id="${id}"><i class="fas fa-trash"></i></button>`;
                    html += `</div>`;
                });
                html += `</div>`;
            }
        });
    }
    container.innerHTML = html;
    // Add delete event listeners
    container.querySelectorAll('.delete-timetable-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            if (confirm('Delete this time slot?')) {
                if (currentUserData.timetable && currentUserData.timetable[id]) {
                    delete currentUserData.timetable[id];
                    saveUserData();
                    renderTimetableTabEntries();
                }
            }
        });
    });
}
