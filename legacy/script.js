// ============ Loading Screen Logic ============
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.classList.add('fade-out');
        // Remove loading screen from DOM after animation completes
        setTimeout(() => {
            loadingScreen.remove();
        }, 500); // Match the CSS transition duration
    }
}

// Show loading screen for 2 seconds when page loads
document.addEventListener('DOMContentLoaded', function () {
    // Hide the loading screen after 2 seconds
    setTimeout(() => {
        hideLoadingScreen();
    }, 2000); // 2 seconds
});

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
document.addEventListener('DOMContentLoaded', function () {
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
document.addEventListener('DOMContentLoaded', function () {
    const glowBtn = document.getElementById('glowPillBtn');
    if (glowBtn) {
        glowBtn.addEventListener('click', function (e) {
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
    if (video) { try { video.pause(); } catch { } }
    if (overlay) overlay.classList.add('hidden');
}
// FIREBASE SDKs - Imported from index.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInAnonymously, linkWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-analytics.js";



// ============ GUEST MODE SYSTEM ============
let isGuestMode = false;
// Legacy guest presence variables removed - using unified presence system now

// Store guest event listeners for proper cleanup
const guestEventListeners = new Map();

// Initialize guest mode state from localStorage on page load
function initializeGuestMode() {
    let guestData = null;
    let guestModeFlag = null;

    try {
        guestData = localStorage.getItem('youfloww_guest');
        guestModeFlag = localStorage.getItem('youfloww_guest_mode');
    } catch (error) {
        console.warn('localStorage not available:', error);
        return false;
    }

    // Check if user was previously in guest mode
    if (guestModeFlag === 'true' || guestData) {
        // Restoring guest mode from previous session
        isGuestMode = true;

        // Hide auth modal and show app
        if (DOMElements.authModal) {
            DOMElements.authModal.classList.remove('visible');
        }
        if (DOMElements.appContainer) {
            DOMElements.appContainer.classList.remove('hidden');
        }

        // Load guest data
        currentUserData = loadGuestData() || getDefaultUserData();

        // Apply guest restrictions immediately
        setTimeout(() => {
            applyGuestRestrictions();
            updateHeaderForGuest();
            initializeAppState();
            // Guest mode restored successfully
        }, 100);

        return true;
    }

    return false;
}

// Save guest mode state to localStorage
function saveGuestModeState() {
    try {
        if (isGuestMode) {
            localStorage.setItem('youfloww_guest_mode', 'true');
        } else {
            localStorage.removeItem('youfloww_guest_mode');
        }
    } catch (error) {
        console.warn('Failed to save guest mode state:', error);
    }
}

// Features that require login for guests
// regularTasks removed from guest restrictions - guests should be able to create and manage regular tasks
const RESTRICTED_FEATURES = {
    stats: ['statsBtn', 'shareStatsBtn'],
    achievements: ['achievementsBtn'], // Lock badge/achievement viewing for guests
    // leaderboards removed - guests can VIEW leaderboards but not participate
    journal: ['journal-section', 'upload-image-btn', 'save-journal-btn'],
    timetable: ['timetable-section', 'add-timeslot-btn'],
    profile: ['changeNameBtn', 'clearDataBtn']
};

// Generate temporary guest ID
function generateGuestId() {
    return 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Show login prompt for restricted features
function showLoginPrompt(featureName) {
    // Remove any existing guest prompts first
    const existingPrompts = document.querySelectorAll('.guest-login-prompt');
    existingPrompts.forEach(prompt => prompt.remove());

    const modal = document.createElement('div');
    modal.className = 'modal visible guest-login-prompt';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center;">
            <h3>🔒 Sign In Required</h3>
            <p>Please sign in to use <strong>${featureName}</strong> and save your progress.</p>
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                <button class="guest-signin-btn header-btn" style="flex: 1;">Sign In</button>
                <button class="guest-cancel-btn btn-danger" style="flex: 1;">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Use event delegation for immediate response
    const signInBtn = modal.querySelector('.guest-signin-btn');
    const cancelBtn = modal.querySelector('.guest-cancel-btn');

    signInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Guest sign in clicked
        modal.remove();
        showAuthModal();
    });

    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Guest cancel clicked
        modal.remove();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Focus the sign in button for better UX
    setTimeout(() => signInBtn.focus(), 100);
}

// Show auth modal
function showAuthModal() {
    // Showing auth modal

    // Ensure auth modal exists and is shown
    if (DOMElements.authModal) {
        DOMElements.authModal.classList.add('visible');

        // Show signup form by default
        setTimeout(() => {
            const signupForm = document.getElementById('signup-form');
            const loginForm = document.getElementById('login-form');

            if (signupForm && loginForm) {
                // Show login form by default
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                // Auth modal forms configured
            } else {
                // Auth forms not found - this is expected in some cases
            }
        }, 50);
    } else {
        // Auth modal not found in DOMElements

        // Fallback: try to find it directly
        const authModal = document.getElementById('authModal');
        if (authModal) {
            authModal.classList.add('visible');
            // Auth modal found via fallback
        } else {
            // Auth modal not found anywhere in DOM
        }
    }
}

// Legacy guest presence functions removed - now using unified presence system

// Add guest mode restrictions to UI elements - BULLETPROOF VERSION
function applyGuestRestrictions() {
    if (!isGuestMode) {
        // Not in guest mode, skipping restrictions
        return;
    }

    // Applying guest restrictions

    // Add guest mode indicator to body
    document.body.classList.add('guest-mode');

    // Clear any existing guest event listeners first
    clearAllGuestEventListeners();

    let totalProcessed = 0;
    let totalLocked = 0;

    Object.entries(RESTRICTED_FEATURES).forEach(([featureType, elementIds]) => {
        // Processing feature: ${featureType}

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            totalProcessed++;

            if (element) {
                // Found element: ${id}

                // Skip leaderboards - viewable by guests
                if (featureType === 'leaderboards') {
                    // Skipping ${id} - viewable by guests
                    return;
                }

                // FORCE CLEAN SLATE - Remove all existing restrictions
                removeElementRestrictions(element, id);

                // Apply new restrictions
                applyElementRestrictions(element, id, featureType);
                totalLocked++;

            } else {
                // Element not found: ${id}
            }
        });
    });

    // Hide completely restricted sections
    hideRestrictedSections();

    // Update header
    updateHeaderForGuest();

    // Restriction summary: ${totalLocked}/${totalProcessed} elements locked

    // Verify restrictions were applied
    setTimeout(() => {
        verifyGuestRestrictions();
    }, 100);
}

// Remove all restrictions from a specific element
function removeElementRestrictions(element, id) {
    // Remove restriction marker
    element.dataset.guestRestricted = 'false';

    // Remove all lock icons
    const lockIcons = element.querySelectorAll('.guest-lock-icon');
    lockIcons.forEach(icon => {
        icon.remove();
        // Removed lock icon from ${id}
    });

    // Remove guest event listeners
    const listenerId = `guest_${id}`;
    if (guestEventListeners.has(listenerId)) {
        const { handler, options } = guestEventListeners.get(listenerId);
        element.removeEventListener('click', handler, options);
        guestEventListeners.delete(listenerId);
        console.log(`🗑️ Removed guest event listener from ${id}`);
    }

    // Reset element styles
    element.style.pointerEvents = '';
    element.style.opacity = '';
    element.style.cursor = '';
}

// Apply restrictions to a specific element
function applyElementRestrictions(element, id, featureType) {
    // Mark as restricted
    element.dataset.guestRestricted = 'true';

    // Create and store event listener
    const handler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        console.log(`🚫 Guest restriction triggered: ${featureType}`);
        showLoginPrompt(featureType.charAt(0).toUpperCase() + featureType.slice(1));
        return false;
    };

    const options = { capture: true, passive: false };
    const listenerId = `guest_${id}`;

    // Store listener for later removal
    guestEventListeners.set(listenerId, { handler, options });

    // Add event listener
    element.addEventListener('click', handler, options);

    // Add visual lock indicator
    element.style.position = 'relative';
    const lockIcon = document.createElement('span');
    lockIcon.className = 'guest-lock-icon';
    lockIcon.innerHTML = '🔒';
    lockIcon.style.cssText = `
        position: absolute;
        top: -5px;
        right: -5px;
        font-size: 14px;
        z-index: 1000;
        pointer-events: none;
        background: rgba(0,0,0,0.8);
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
    `;
    element.appendChild(lockIcon);

    console.log(`🔐 Applied restrictions to ${id}`);
}

// Clear all guest event listeners
function clearAllGuestEventListeners() {
    console.log(`🧹 Clearing ${guestEventListeners.size} guest event listeners`);

    guestEventListeners.forEach((listenerData, listenerId) => {
        const elementId = listenerId.replace('guest_', '');
        const element = document.getElementById(elementId);

        if (element) {
            const { handler, options } = listenerData;
            element.removeEventListener('click', handler, options);
            console.log(`✅ Cleared listener for ${elementId}`);
        }
    });

    guestEventListeners.clear();
}

// Hide sections that are completely restricted
function hideRestrictedSections() {
    const restrictedSections = ['achievements-section'];
    restrictedSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = 'none';
            console.log(`🙈 Hidden section: ${sectionId}`);
        }
    });
}

// Verify guest restrictions are properly applied
function verifyGuestRestrictions() {
    const restrictedElements = document.querySelectorAll('[data-guest-restricted="true"]');
    const lockIcons = document.querySelectorAll('.guest-lock-icon');
    const activeListeners = guestEventListeners.size;

    console.log('🔍 VERIFICATION RESULTS:');
    console.log(`   Restricted elements: ${restrictedElements.length}`);
    console.log(`   Lock icons: ${lockIcons.length}`);
    console.log(`   Active listeners: ${activeListeners}`);
    console.log(`   Guest mode class: ${document.body.classList.contains('guest-mode')}`);

    if (restrictedElements.length === 0 && isGuestMode) {
        console.error('❌ CRITICAL: No restricted elements found in guest mode!');
        // Retry application
        setTimeout(() => {
            console.log('🔄 Retrying guest restrictions...');
            applyGuestRestrictions();
        }, 500);
    } else if (isGuestMode) {
        console.log('✅ Guest restrictions verified successfully');
    }
}

// BULLETPROOF RESTRICTION REMOVAL SYSTEM
function removeAllGuestRestrictions() {
    console.log('🔓 REMOVING ALL GUEST RESTRICTIONS - BULLETPROOF VERSION');

    // Step 1: Remove guest mode class
    document.body.classList.remove('guest-mode');
    console.log('✅ Removed guest-mode class from body');

    // Step 2: Clear ALL tracked guest event listeners
    clearAllGuestEventListeners();

    // Step 3: Process all restricted elements
    let totalProcessed = 0;
    let totalUnlocked = 0;

    Object.entries(RESTRICTED_FEATURES).forEach(([featureType, elementIds]) => {
        console.log(`🔓 Unlocking feature: ${featureType}`);

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            totalProcessed++;

            if (element) {
                const wasRestricted = element.dataset.guestRestricted === 'true';

                if (wasRestricted) {
                    // Completely remove all restrictions
                    removeElementRestrictions(element, id);
                    totalUnlocked++;
                    console.log(`✅ Unlocked: ${id}`);
                } else {
                    // Ensure element is clean anyway
                    element.dataset.guestRestricted = 'false';
                    console.log(`🧼 Ensured clean: ${id}`);
                }
            } else {
                // Element not found: ${id}
            }
        });
    });

    // Step 4: Re-enable hidden sections
    showRestrictedSections();

    // Step 5: Update header
    updateHeaderForGuest();

    console.log(`📊 UNLOCK SUMMARY: ${totalUnlocked}/${totalProcessed} elements unlocked`);

    // Step 6: Comprehensive verification
    setTimeout(() => {
        verifyRestrictionRemoval();
    }, 100);

    // Step 7: Final cleanup pass
    setTimeout(() => {
        performFinalCleanup();
    }, 200);

    console.log('✅ BULLETPROOF RESTRICTION REMOVAL COMPLETED');
}

// Show sections that were hidden for guests
function showRestrictedSections() {
    const restrictedSections = ['achievements-section'];
    restrictedSections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) {
            section.style.display = '';
            section.style.pointerEvents = '';
            section.style.opacity = '';
            section.classList.remove('guest-hidden');
            console.log(`👁️ Restored section: ${sectionId}`);
        }
    });
}

// Verify all restrictions have been removed
function verifyRestrictionRemoval() {
    const remainingRestricted = document.querySelectorAll('[data-guest-restricted="true"]');
    const remainingLocks = document.querySelectorAll('.guest-lock-icon');
    const remainingListeners = guestEventListeners.size;

    console.log('🔍 RESTRICTION REMOVAL VERIFICATION:');
    console.log(`   Remaining restricted elements: ${remainingRestricted.length}`);
    console.log(`   Remaining lock icons: ${remainingLocks.length}`);
    console.log(`   Remaining guest listeners: ${remainingListeners}`);
    console.log(`   Guest mode class removed: ${!document.body.classList.contains('guest-mode')}`);

    if (remainingRestricted.length > 0 || remainingLocks.length > 0 || remainingListeners > 0) {
        console.error('❌ CRITICAL: Some restrictions still present!');

        // Force clean remaining elements
        remainingRestricted.forEach(el => {
            el.dataset.guestRestricted = 'false';
            console.log('🔥 Force cleaned restricted element');
        });

        remainingLocks.forEach(lock => {
            lock.remove();
            console.log('🔥 Force removed lock icon');
        });

        guestEventListeners.clear();
        console.log('🔥 Force cleared remaining listeners');
    } else {
        console.log('✅ ALL RESTRICTIONS SUCCESSFULLY REMOVED!');
    }
}

// Perform final cleanup to ensure everything is working
function performFinalCleanup() {
    console.log('🧹 Performing final cleanup...');

    // Test key restricted elements
    const testElements = ['statsBtn', 'achievementsBtn'];

    testElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const hasRestriction = element.dataset.guestRestricted === 'true';
            const hasLock = element.querySelector('.guest-lock-icon');
            const isClickable = !element.style.pointerEvents || element.style.pointerEvents !== 'none';

            console.log(`🔍 Testing ${id}:`);
            console.log(`   Has restriction: ${hasRestriction}`);
            console.log(`   Has lock: ${!!hasLock}`);
            console.log(`   Is clickable: ${isClickable}`);

            if (hasRestriction || hasLock || !isClickable) {
                console.error(`❌ ${id} still has issues!`);
                // Force fix
                element.dataset.guestRestricted = 'false';
                if (hasLock) hasLock.remove();
                element.style.pointerEvents = '';
                console.log(`🔥 Force fixed ${id}`);
            } else {
                console.log(`✅ ${id} is fully functional`);
            }
        }
    });

    console.log('\u2705 Final cleanup completed');
}

// DEBUG FUNCTIONS - Can be called manually in console
window.debugGuestRestrictions = () => {
    // Debug: Current Guest Restriction Status
    console.log('   isGuestMode:', isGuestMode);
    console.log('   Body has guest-mode class:', document.body.classList.contains('guest-mode'));
    console.log('   Guest event listeners count:', guestEventListeners.size);

    const restrictedElements = document.querySelectorAll('[data-guest-restricted="true"]');
    const lockIcons = document.querySelectorAll('.guest-lock-icon');

    console.log('   Restricted elements found:', restrictedElements.length);
    console.log('   Lock icons found:', lockIcons.length);

    // Test each restricted feature
    Object.entries(RESTRICTED_FEATURES).forEach(([featureType, elementIds]) => {
        console.log(`\ud83d\udcc2 ${featureType}:`);
        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                const isRestricted = element.dataset.guestRestricted === 'true';
                const hasLock = !!element.querySelector('.guest-lock-icon');
                console.log(`   ${id}: restricted=${isRestricted}, hasLock=${hasLock}`);
            } else {
                console.log(`   ${id}: NOT FOUND`);
            }
        });
    });
};

window.forceRemoveAllRestrictions = () => {
    console.log('\ud83d\udd25 FORCE REMOVING ALL RESTRICTIONS');

    // Force clear everything
    isGuestMode = false;
    document.body.classList.remove('guest-mode');
    guestEventListeners.clear();

    // Remove all restriction markers and lock icons
    const allRestricted = document.querySelectorAll('[data-guest-restricted]');
    const allLocks = document.querySelectorAll('.guest-lock-icon');

    allRestricted.forEach(el => {
        el.dataset.guestRestricted = 'false';
        el.style.pointerEvents = '';
        el.style.opacity = '';
        el.style.cursor = '';
    });

    allLocks.forEach(lock => lock.remove());

    // Show all sections
    document.querySelectorAll('section').forEach(section => {
        section.style.display = '';
        section.style.pointerEvents = '';
        section.style.opacity = '';
    });

    console.log('\u2705 FORCE REMOVAL COMPLETED');
    console.log('   Removed', allRestricted.length, 'restriction markers');
    console.log('   Removed', allLocks.length, 'lock icons');
};

window.testFeatureAccess = (elementId) => {
    console.log(`\ud83e\uddea Testing feature access: ${elementId}`);

    const element = document.getElementById(elementId);
    if (!element) {
        console.error('Element not found!');
        return;
    }

    console.log('   Element found:', !!element);
    console.log('   Is restricted:', element.dataset.guestRestricted === 'true');
    console.log('   Has lock icon:', !!element.querySelector('.guest-lock-icon'));
    console.log('   Pointer events:', element.style.pointerEvents || 'auto');
    console.log('   Opacity:', element.style.opacity || '1');

    // Try clicking it
    try {
        element.click();
        console.log('\u2705 Click test successful');
    } catch (e) {
        console.error('\u274c Click test failed:', e);
    }
};

console.log('\ud83d\udd27 Debug functions available:');
console.log('   debugGuestRestrictions() - Show current status');
console.log('   forceRemoveAllRestrictions() - Nuclear option');
console.log('   testFeatureAccess("elementId") - Test specific element');

// Update header buttons based on user status
function updateHeaderForGuest() {
    const logoutBtn = document.getElementById('logoutBtn');

    if (isGuestMode) {
        // Replace logout button with sign in button for guests
        if (logoutBtn) {
            logoutBtn.textContent = 'Sign In';
            logoutBtn.className = 'header-btn btn-primary';
            logoutBtn.style.backgroundColor = '#2196F3';
            logoutBtn.style.color = 'white';
            logoutBtn.style.border = '1px solid #1976D2';
            logoutBtn.style.borderRadius = '6px';
            logoutBtn.style.padding = '8px 16px';
            logoutBtn.style.fontSize = '14px';
            logoutBtn.style.fontWeight = '500';
            logoutBtn.style.cursor = 'pointer';
            logoutBtn.style.transition = 'all 0.2s ease';

            // Remove existing event listeners by cloning the button
            const newBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);

            // Add hover effects
            newBtn.addEventListener('mouseenter', () => {
                newBtn.style.backgroundColor = '#1976D2';
                newBtn.style.transform = 'translateY(-1px)';
            });

            newBtn.addEventListener('mouseleave', () => {
                newBtn.style.backgroundColor = '#2196F3';
                newBtn.style.transform = 'translateY(0)';
            });

            // Add sign in functionality
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Guest sign in button clicked');
                showAuthModal();
            });

            console.log('Header updated for guest mode - showing Sign In button');
        }
    } else {
        // Restore logout button for logged-in users
        if (logoutBtn) {
            logoutBtn.textContent = 'Logout';
            logoutBtn.className = 'header-btn btn-danger';
            logoutBtn.style.backgroundColor = '#f44336';
            logoutBtn.style.color = 'white';
            logoutBtn.style.border = '1px solid #d32f2f';
            logoutBtn.style.borderRadius = '6px';
            logoutBtn.style.padding = '8px 16px';
            logoutBtn.style.fontSize = '14px';
            logoutBtn.style.fontWeight = '500';
            logoutBtn.style.cursor = 'pointer';
            logoutBtn.style.transition = 'all 0.2s ease';

            // Remove existing event listeners by cloning the button
            const newBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);

            // Add hover effects
            newBtn.addEventListener('mouseenter', () => {
                newBtn.style.backgroundColor = '#d32f2f';
                newBtn.style.transform = 'translateY(-1px)';
            });

            newBtn.addEventListener('mouseleave', () => {
                newBtn.style.backgroundColor = '#f44336';
                newBtn.style.transform = 'translateY(0)';
            });

            // Add logout functionality
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Logout button clicked');
                if (confirm('Are you sure you want to logout?')) {
                    signOut(auth);
                }
            });

            console.log('Header updated for logged-in user - showing Logout button');
        }
    }
}

// Guest Mode Handler
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize guest mode state from previous session
    const wasGuestRestored = initializeGuestMode();


    const guestBtn = document.getElementById("continueWithoutSignupBtn");
    const guestWarning = document.getElementById("guestWarning");

    if (guestBtn) {
        guestBtn.addEventListener('click', async () => {
            console.log('Entering guest mode...');

            // Set guest mode flag FIRST
            isGuestMode = true;

            // Save guest mode state for persistence
            saveGuestModeState();

            // Clear any residual restriction states from previous sessions
            console.log('\ud83e\uddfc Clearing any previous restriction states...');
            Object.entries(RESTRICTED_FEATURES).forEach(([featureType, elementIds]) => {
                elementIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        // Reset restriction state completely
                        element.dataset.guestRestricted = null;
                        // Remove any existing lock icons
                        const existingLock = element.querySelector('.guest-lock-icon');
                        if (existingLock) {
                            existingLock.remove();
                        }
                    }
                });
            });

            // Ensure app is visible and auth modal hidden
            DOMElements.appContainer.classList.remove('hidden');
            DOMElements.authModal.classList.remove('visible');

            if (guestWarning) {
                guestWarning.classList.remove('hidden');
            }

            // Load guest data (only in localStorage, never Firestore)
            currentUserData = loadGuestData() || getDefaultUserData();

            // CRITICAL: Apply guest restrictions with force refresh
            console.log('\ud83d\udd12 Force applying guest restrictions after logout...');
            applyGuestRestrictions();

            // Apply restrictions multiple times to ensure they stick
            setTimeout(() => {
                console.log('\ud83d\udd04 Re-applying guest restrictions (delay 1)...');
                applyGuestRestrictions();
            }, 100);

            setTimeout(() => {
                console.log('\ud83d\udd04 Re-applying guest restrictions (delay 2)...');
                applyGuestRestrictions();
            }, 500);

            // Initialize app with restricted features
            initializeAppState();
            updateLeaderboardCTA();

            // Start presence system for live count (guest will be counted)
            console.log('\ud83d\udc40 Starting presence system for guest...');
            startPresence();

            // Apply default nature theme for all users (guest and new)
            console.log('\ud83c\udf3f Applying default nature theme...');
            if (currentUserData.theme && currentUserData.theme.youtubeVideoId) {
                // Use the default nature video background
                applyTheme('youtube', currentUserData.theme.youtubeVideoId);
                console.log('\u2705 Default nature theme applied:', currentUserData.theme.youtubeVideoId);
            }

            // Final verification
            setTimeout(() => {
                console.log('\ud83d\udd0d Final guest restrictions verification...');
                const restrictedElements = document.querySelectorAll('[data-guest-restricted="true"]');
                const lockIcons = document.querySelectorAll('.guest-lock-icon');
                console.log('\ud83d\udcca Restriction status:', {
                    restrictedElements: restrictedElements.length,
                    lockIcons: lockIcons.length,
                    isGuestMode,
                    bodyHasGuestClass: document.body.classList.contains('guest-mode')
                });

                if (restrictedElements.length === 0 || lockIcons.length === 0) {
                    console.error('\u274c Restrictions not applied properly, forcing reapplication...');
                    applyGuestRestrictions();
                }
            }, 1000);

            console.log('\u2705 Guest mode fully activated with verified restrictions');
        });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanupGuestPresence);
    window.addEventListener('pagehide', cleanupGuestPresence);
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
        // Rolling 7-day aggregates (pruned to last 7 days)
        weeklyFocus: {},
        weeklyFocusSeconds: {},
        weeklySessions: {},
        weeklyCompletedSessions: {},
        weeklyEarlyEndedSessions: {},
        weeklyAnonymousSeconds: {},
        weeklyAnonymousSessions: {},
        // Per-day task seconds to build weekly task breakdown without storing full sessions
        weeklyTaskSecondsByDate: {}, // { YYYY-MM-DD: { taskLabel: seconds } }
        weeklyCategorySecondsByDate: {}, // { YYYY-MM-DD: { categoryId: seconds } }
        weeklyCategoryCompletionsByDate: {}, // { YYYY-MM-DD: { categoryId: count } }
        // User-managed canonical task list
        regularTasks: [], // [{ id, name }]
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
        theme: { backgroundPath: null, youtubeVideoId: "6KL2QZ91kAM" } // Default to nature YouTube background
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
        // If user missed a day (gap > 1), reset streak to 0 so leaderboard reflects reality
        try {
            if (currentUserData && currentUserData.lastStreakDate) {
                const gap = diffLocalDateKeysDays(currentUserData.lastStreakDate, today);
                if (gap > 1 && (currentUserData.streakCount || 0) > 0) {
                    currentUserData.streakCount = 0;
                    DOMElements.streak.count.textContent = 0;
                    saveUserData();
                }
            }
        } catch (e) { /* ignore */ }
        // Make sure leaderboard projection points to today (so boards show up-to-date day)
        updatePublicUserDoc();
        // Update charts and stats displays to reflect the new day baseline
        try { updateStatsDisplay(); } catch { }
        try { renderCharts(); } catch { }
    } catch (e) { console.warn('ensureDailyRollovers failed', e); }
}
function onNewLocalDay() {
    // Called when local date boundary is crossed while app is open
    lastLocalDayKey = getLocalDateKey();
    ensureDailyRollovers();
    // Refresh both leaderboards immediately
    try { refreshLeaderboard(); } catch { }
    try { refreshStreakLeaderboard(); } catch { }
    // Refresh daily quote cache
    try { fetchQuoteOfTheDay(); } catch { }
    // Maybe show weekly report if Sunday
    try { maybeShowWeeklyReportPopup(); } catch { }
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
        // Explicitly exclude guest users from leaderboards
        if (isGuestMode || !auth.currentUser) {
            console.log('🚫 Guest user excluded from leaderboards:', { isGuestMode, hasAuth: !!auth.currentUser });
            return;
        }

        console.log('🏆 Updating leaderboard data for logged-in user');
        const today = getTodayKey();
        const sec = (currentUserData.weeklyFocusSeconds && currentUserData.weeklyFocusSeconds[today]) || (((currentUserData.weeklyFocus && currentUserData.weeklyFocus[today]) || 0) * 60);
        const minutesFloat = sec / 60;
        const profileName = currentUserData.profileName || "Floww User";
        const currentStreak = currentUserData.streakCount || 0;

        const ref = doc(db, 'publicUsers', auth.currentUser.uid);
        const leaderboardData = {
            profileName,
            todayFocusMinutes: parseFloat(minutesFloat.toFixed(2)),
            currentStreak: currentStreak,
            lastStreakUpdate: today,
            date: today,
            isGuest: false // Explicitly mark as non-guest
        };

        await setDoc(ref, leaderboardData, { merge: true });
        console.log('🏆 Leaderboard data updated:', leaderboardData);

        // Instantly refresh both leaderboards after successful write
        await refreshLeaderboard();
        await refreshStreakLeaderboard();
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
        const userMap = new Map(); // Use Map to ensure unique users only

        snap.forEach(docSnap => {
            const d = docSnap.data() || {};
            const uid = docSnap.id; // Document ID is the user's UID
            const minutesRaw = d.todayFocusMinutes;
            const minutes = typeof minutesRaw === 'number' && isFinite(minutesRaw) ? Math.max(0, minutesRaw) : 0;

            // Only keep the highest score for each unique user (in case of duplicates)
            if (!userMap.has(uid) || userMap.get(uid).minutes < minutes) {
                userMap.set(uid, {
                    uid: uid,
                    name: d.profileName || 'Floww User',
                    minutes: minutes
                });
            }
        });

        // Convert Map to array for sorting
        entries = Array.from(userMap.values());
        console.log('🏆 Focus leaderboard entries (unique users):', entries.length);
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

let streakLeaderboardInterval = null;
async function refreshStreakLeaderboard() {
    try {
        const listEl = document.getElementById('streak-leaderboard-list');
        if (!listEl) return;

        // Query all users with streak data, no date filter needed for streaks
        const q = query(
            collection(db, 'publicUsers'),
            where('currentStreak', '>', 0)
        );
        const snap = await getDocs(q);
        let entries = [];
        const userMap = new Map(); // Use Map to ensure unique users only

        snap.forEach(docSnap => {
            const d = docSnap.data() || {};
            const uid = docSnap.id; // Document ID is the user's UID
            const streak = typeof d.currentStreak === 'number' && isFinite(d.currentStreak) ? Math.max(0, d.currentStreak) : 0;

            if (streak > 0) {
                // Only keep the highest streak for each unique user (in case of duplicates)
                if (!userMap.has(uid) || userMap.get(uid).streak < streak) {
                    userMap.set(uid, {
                        uid: uid,
                        name: d.profileName || 'Floww User',
                        streak: streak
                    });
                }
            }
        });

        // Convert Map to array for sorting
        entries = Array.from(userMap.values());
        console.log('🔥 Streak leaderboard entries (unique users):', entries.length);

        // Sort desc by streak and take top 10
        entries.sort((a, b) => b.streak - a.streak);
        entries = entries.slice(0, 10);

        listEl.innerHTML = '';
        entries.forEach((e, idx) => {
            const li = document.createElement('li');
            let medal = '';
            if (idx === 0) medal = '🥇';
            else if (idx === 1) medal = '🥈';
            else if (idx === 2) medal = '🥉';

            // Add fire emojis for longer streaks
            let fireEmojis = '🔥';
            if (e.streak >= 30) fireEmojis = '🔥🔥🔥';
            else if (e.streak >= 14) fireEmojis = '🔥🔥';

            li.innerHTML = `<span class="rank">${idx + 1} ${medal}</span><span class="name">${e.name}</span><span class="value">${e.streak} ${fireEmojis}</span>`;
            listEl.appendChild(li);
        });

        // Fill up to 10 with placeholders if needed
        for (let i = entries.length; i < 10; i++) {
            const li = document.createElement('li');
            li.classList.add('placeholder');
            li.innerHTML = `<span class="rank">${i + 1}</span><span class="name">—</span><span class="value">0 🔥</span>`;
            listEl.appendChild(li);
        }
    } catch (e) {
        console.error('Failed to refresh streak leaderboard:', e);
    }
}

function startLeaderboard() {
    refreshLeaderboard();
    refreshStreakLeaderboard();
    if (leaderboardInterval) clearInterval(leaderboardInterval);
    if (streakLeaderboardInterval) clearInterval(streakLeaderboardInterval);

    // Focus hours leaderboard updates every 3 minutes
    leaderboardInterval = setInterval(refreshLeaderboard, 180000);

    // Streak leaderboard updates every hour (less frequent since streaks change daily)
    streakLeaderboardInterval = setInterval(refreshStreakLeaderboard, 3600000);
}

function stopLeaderboard() {
    if (leaderboardInterval) clearInterval(leaderboardInterval);
    if (streakLeaderboardInterval) clearInterval(streakLeaderboardInterval);
    leaderboardInterval = null;
    streakLeaderboardInterval = null;

    const focusListEl = document.getElementById('leaderboard-list');
    const streakListEl = document.getElementById('streak-leaderboard-list');
    if (focusListEl) focusListEl.innerHTML = '';
    if (streakListEl) streakListEl.innerHTML = '';
}

function switchLeaderboardTab(boardType) {
    // Update tab buttons
    document.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.board === boardType) {
            tab.classList.add('active');
        }
    });

    // Update content visibility
    document.querySelectorAll('.leaderboard-content').forEach(content => {
        content.classList.remove('active');
    });

    if (boardType === 'focus') {
        document.getElementById('focus-leaderboard').classList.add('active');
    } else if (boardType === 'streak') {
        document.getElementById('streak-leaderboard').classList.add('active');
    }
}

// ===================================================================================
// UNIFIED PRESENCE SYSTEM (Flowwies Live)
// ===================================================================================
let presenceSessionId = null;
let presenceDocRef = null;
let presenceHeartbeatInterval = null;
let presenceUnsub = null;
let lastLiveCount = 0;

// Generate unique session ID
function generateSessionId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate unique identifier for presence tracking
function getPresenceUserId() {
    if (!isGuestMode && auth.currentUser) {
        // Authenticated user: use their UID
        return auth.currentUser.uid;
    } else {
        // Guest user: use or generate a persistent browser-specific ID
        let guestId = null;
        try {
            guestId = localStorage.getItem('youfloww_guest_id');
            if (!guestId) {
                guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('youfloww_guest_id', guestId);
            }
        } catch (error) {
            console.warn('localStorage not available for guest ID:', error);
            guestId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            // Generated new guest ID
        }
        return guestId;
    }
}

function getIsFocusing() {
    return !!(isRunning && isWorkSession);
}

async function startPresence() {
    try {
        console.log('Starting presence system...', {
            isGuestMode,
            hasAuth: !!auth.currentUser,
            authUid: auth.currentUser?.uid
        });

        // Stop any existing presence first
        await stopPresence();

        // For guest users or when no signed-in user, skip presence entirely (no auto auth)
        if (isGuestMode || !auth.currentUser) {
            console.log('Skipping presence: guest mode or no signed-in user.');
            return;
        }

        // Use the existing signed-in user only
        const authUser = auth.currentUser;

        // Generate session ID and create document reference
        const sessionId = generateSessionId();
        presenceSessionId = sessionId;
        presenceDocRef = doc(db, 'presence', sessionId);

        // Create presence document following your strict field validation
        const presenceData = {
            uid: authUser.uid, // Required and must match auth.uid
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
            lastActiveMs: Date.now(), // Required as int
            isFocusing: getIsFocusing(), // Required as bool
            userAgent: navigator.userAgent || 'unknown' // Required field
        };

        console.log('\ud83d\udcc4 Creating secure presence document:', presenceData);

        try {
            await setDoc(presenceDocRef, presenceData);
            console.log('\u2705 Secure presence document created successfully!');

            // Verify creation after a moment
            setTimeout(async () => {
                try {
                    const verification = await getDoc(presenceDocRef);
                    if (verification.exists()) {
                        console.log('\u2705 Presence document verified:', verification.data());
                    } else {
                        console.error('\u274c Presence document missing after creation!');
                    }
                } catch (e) {
                    console.error('\u274c Presence verification failed:', e);
                }
            }, 1500);

        } catch (e) {
            console.error('\u274c Failed to create secure presence document:', e);
            console.error('\u274c Error details:', e.message);
            throw e;
        }

        // Store authUser reference for closures
        const currentAuthUser = authUser;

        // Start heartbeat system (every 20 seconds)
        console.log('\ud83d\udc93 Starting secure presence heartbeat...');
        if (presenceHeartbeatInterval) clearInterval(presenceHeartbeatInterval);
        presenceHeartbeatInterval = setInterval(async () => {
            try {
                if (!presenceDocRef || !currentAuthUser) {
                    console.warn('\u26a0\ufe0f No presence ref or auth user for heartbeat');
                    return;
                }

                // Update with only the allowed fields per your secure rules
                const heartbeatData = {
                    uid: currentAuthUser.uid, // Must include uid and match auth
                    createdAt: serverTimestamp(), // Keep original creation time
                    lastActive: serverTimestamp(),
                    lastActiveMs: Date.now(),
                    isFocusing: getIsFocusing(),
                    userAgent: navigator.userAgent || 'unknown'
                };

                // Use setDoc with merge to ensure all required fields are present
                await setDoc(presenceDocRef, heartbeatData, { merge: true });
                console.log('\ud83d\udc97 Secure heartbeat successful');
            } catch (e) {
                console.warn('\ud83d\udc94 Heartbeat failed:', e.message);
                // Try to recreate presence if heartbeat fails
                if (e.code === 'not-found' || e.message.includes('permission-denied')) {
                    console.log('\ud83d\udd04 Presence document missing or denied, recreating...');
                    setTimeout(() => startPresence(), 2000); // Recreate after delay
                }
            }
        }, 20000); // 20 second intervals

        // Start live count watcher with user deduplication
        console.log('\ud83d\udc40 Starting live count watcher with deduplication...');
        const collRef = collection(db, 'presence');

        try {
            presenceUnsub = onSnapshot(collRef,
                (snapshot) => {
                    console.log('\ud83d\udcc8 Processing presence snapshot...');
                    const now = Date.now();
                    const activeThreshold = 90000; // 90 seconds (more generous than heartbeat)

                    // Use Map to deduplicate by userId (one count per unique user)
                    const uniqueActiveUsers = new Map();
                    let totalSessions = 0;

                    snapshot.forEach(docSnap => {
                        totalSessions++;
                        const data = docSnap.data() || {};
                        const sessionId = docSnap.id;
                        const userId = data.uid; // Use uid field as per secure rules
                        const lastActiveMs = data.lastActiveMs || 0;
                        const timeSinceActive = now - lastActiveMs;
                        const isActive = typeof lastActiveMs === 'number' && timeSinceActive <= activeThreshold;

                        // Determine if this is a guest based on anonymous auth pattern
                        const isGuest = userId && userId.length === 28; // Anonymous UIDs are 28 chars

                        console.log(`\ud83d\udc64 Session ${sessionId}:`, {
                            uid: userId,
                            isGuest: isGuest,
                            lastActive: new Date(lastActiveMs).toLocaleTimeString(),
                            timeSinceActive: Math.round(timeSinceActive / 1000) + 's',
                            isActive: isActive,
                            userAgent: data.userAgent ? data.userAgent.substring(0, 20) + '...' : 'unknown'
                        });

                        if (isActive && userId) {
                            // Only count each unique user once (deduplication by uid)
                            if (!uniqueActiveUsers.has(userId) ||
                                uniqueActiveUsers.get(userId).lastActiveMs < lastActiveMs) {
                                uniqueActiveUsers.set(userId, {
                                    userId: userId,
                                    sessionId: sessionId,
                                    isGuest: isGuest,
                                    lastActiveMs: lastActiveMs,
                                    profileName: isGuest ? 'Guest User' : 'Floww User',
                                    timeSinceActive: Math.round(timeSinceActive / 1000)
                                });
                            }
                        }
                    });

                    const uniqueUserCount = uniqueActiveUsers.size;
                    const activeUsersList = Array.from(uniqueActiveUsers.values());

                    console.log(`\ud83d\udcc8 Live presence summary:`);
                    console.log(`   Total sessions: ${totalSessions}`);
                    console.log(`   Unique active users: ${uniqueUserCount}`);
                    console.log(`   Active users:`, activeUsersList.map(u => ({
                        profile: u.profileName,
                        type: u.isGuest ? 'guest' : 'user',
                        lastActive: u.timeSinceActive + 's ago'
                    })));

                    updateLiveCount(uniqueUserCount);
                },
                (error) => {
                    console.error('\u274c Presence watcher error:', error);
                    // Auto-restart after errors
                    setTimeout(() => {
                        console.log('\ud83d\udd04 Auto-restarting presence after error...');
                        startPresence();
                    }, 3000);
                }
            );

            console.log('\u2705 Live count watcher started with deduplication!');
        } catch (e) {
            console.error('\u274c Failed to start live count watcher:', e);
            throw e;
        }

        // Setup cleanup handlers  
        const handleBeforeUnload = () => {
            if (presenceDocRef) {
                // Use sendBeacon for reliable cleanup
                navigator.sendBeacon && navigator.sendBeacon('/cleanup-presence', JSON.stringify({ sessionId: presenceSessionId }));
                // Also try immediate cleanup
                deleteDoc(presenceDocRef).catch(() => { });
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Handle tab visibility changes
        document.addEventListener('visibilitychange', async () => {
            if (!presenceDocRef || !currentAuthUser) return;

            try {
                // Update with all required fields per secure rules (no extra fields like tabVisible)
                const visibilityData = {
                    uid: currentAuthUser.uid,
                    createdAt: serverTimestamp(),
                    lastActive: serverTimestamp(),
                    lastActiveMs: Date.now(),
                    isFocusing: getIsFocusing(),
                    userAgent: navigator.userAgent || 'unknown'
                };

                console.log(`\ud83d\udc41\ufe0f Tab ${document.hidden ? 'hidden' : 'visible'} - updating presence`);
                await setDoc(presenceDocRef, visibilityData, { merge: true });
            } catch (e) {
                console.warn('\ud83d\udc41\ufe0f Visibility update failed:', e.message);
            }
        });

        console.log('\ud83c\udf89 Unified presence system fully initialized!');

    } catch (error) {
        console.error('\ud83d\udca5 Presence system failed to start:', error);
        // Do not attempt any automatic authentication fallbacks. Presence is optional.
    }
}

function updateLiveCount(n) {
    const el = document.getElementById('liveCount');
    if (!el) {
        console.warn('liveCount element not found in DOM');
        return;
    }

    console.log(`Updating live count: ${lastLiveCount} -> ${n}`);

    if (n !== lastLiveCount) {
        el.textContent = String(n);
        el.classList.remove('flip');
        // force reflow for animation restart
        void el.offsetWidth;
        el.classList.add('flip');
        lastLiveCount = n;
        console.log(`Live count display updated to: ${n}`);
    } else {
        console.log('Live count unchanged, no update needed');
    }
}

async function stopPresence() {
    try {
        console.log('\ud83d\uded1 Stopping presence system and cleaning up...');

        // Clear heartbeat interval immediately
        if (presenceHeartbeatInterval) {
            clearInterval(presenceHeartbeatInterval);
            presenceHeartbeatInterval = null;
            console.log('\ud83d\udc94 Heartbeat stopped');
        }

        // Unsubscribe from live count watcher
        if (presenceUnsub) {
            try {
                presenceUnsub();
                console.log('\ud83d\udc40 Live count watcher stopped');
            } catch (e) {
                console.warn('\u26a0\ufe0f Error stopping watcher:', e.message);
            }
            presenceUnsub = null;
        }

        // Priority cleanup: Remove current presence document immediately
        if (presenceDocRef && presenceSessionId) {
            try {
                console.log('\ud83e\uddfc Deleting presence document:', presenceSessionId);
                await deleteDoc(presenceDocRef);
                console.log('\u2705 Presence document deleted successfully');
            } catch (e) {
                console.warn('\u26a0\ufe0f Failed to delete presence document:', e.message);

                // Try alternative cleanup approach
                try {
                    await setDoc(presenceDocRef, {
                        deleted: true,
                        lastActiveMs: 0,
                        uid: 'deleted',
                        userAgent: 'cleanup'
                    });
                    console.log('\ud83e\uddfc Marked presence document as deleted');
                } catch (markError) {
                    console.error('\u274c Even marking as deleted failed:', markError.message);
                }
            }
        }

        // Additional cleanup: Remove any stale anonymous presence documents
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            try {
                console.log('\ud83e\uddfc Cleaning up anonymous user presence documents...');
                const collRef = collection(db, 'presence');
                const staleQuery = query(collRef, where('uid', '==', auth.currentUser.uid));
                const staleSnap = await getDocs(staleQuery);

                const deletePromises = [];
                staleSnap.forEach(doc => {
                    deletePromises.push(deleteDoc(doc.ref));
                    console.log('\ud83e\uddfc Queued deletion of stale doc:', doc.id);
                });

                if (deletePromises.length > 0) {
                    await Promise.allSettled(deletePromises);
                    console.log(`\u2705 Cleaned up ${deletePromises.length} stale presence documents`);
                }
            } catch (cleanupError) {
                console.warn('\u26a0\ufe0f Stale document cleanup failed:', cleanupError.message);
            }
        }

        // Reset all state
        presenceSessionId = null;
        presenceDocRef = null;

        console.log('\u2705 Presence system completely stopped and cleaned');
    } catch (error) {
        console.error('\u274c Error in stopPresence:', error);

        // Emergency cleanup - reset state even if cleanup failed
        presenceSessionId = null;
        presenceDocRef = null;
        presenceHeartbeatInterval = null;
        presenceUnsub = null;
    }
}

// cleanupPresenceOnce function removed - cleanup now handled in stopPresence()

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
let accountabilityClickToResume = null; // Handler for click-to-resume when paused by accountability
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
let lastYouTubeVideoId = 'lTRiuFIWV54'; // Lofi hip hop - beats to study/relax
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
        todaySessions: document.getElementById("todaySessions"),
        weeklyFocusHours: document.getElementById("weeklyFocusHours"),
        weeklySessionsCount: document.getElementById("weeklySessionsCount"),
        avgSessionLength: document.getElementById("avgSessionLength")
    },
    profile: {
        nameDisplay: document.getElementById("profileNameDisplay"),
    },
    streak: {
        count: document.getElementById("streak-count"),
    },
    leaderboard: {
        cta: document.getElementById("leaderboard-cta"),
        ctaBtn: document.getElementById("leaderboard-cta-btn")
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
    console.log('\ud83d\udd04 Auth state changed:', { user: !!user, uid: user?.uid, currentGuestMode: isGuestMode, isAnonymous: !!user?.isAnonymous });

    // Never treat anonymous auth as a real sign-in. Enforce guest or sign-out.
    if (user && user.isAnonymous) {
        console.warn('Anonymous auth detected; signing out to prevent unintended auto login.');
        try { signOut(auth); } catch { }
        return;
    }

    if (user) {
        const wasGuestMode = isGuestMode;
        isGuestMode = false;

        // Clear guest mode persistence
        saveGuestModeState();

        console.log('User signed in:', { uid: user.uid, wasGuest: wasGuestMode });

        // Remove guest mode styling and restrictions immediately
        document.body.classList.remove('guest-mode');
        DOMElements.appContainer.classList.remove('hidden');
        DOMElements.authModal.classList.remove('visible');

        // CRITICAL: Use bulletproof restriction removal system
        if (wasGuestMode) {
            console.log('🔥 USER SIGNED IN FROM GUEST MODE - REMOVING ALL RESTRICTIONS');
            removeAllGuestRestrictions();
        }

        // Update header immediately to show logout button
        updateHeaderForGuest();

        // Force refresh the app state and UI
        setTimeout(() => {
            // Re-initialize all app features for the signed-in user
            initializeAppState();

            // Force update all sections to ensure they're accessible
            const allSections = document.querySelectorAll('section');
            allSections.forEach(section => {
                section.style.pointerEvents = '';
                section.style.opacity = '';
            });

            // Update any remaining UI elements
            updateLeaderboardCTA();

            console.log('App state refreshed for signed-in user');
        }, 100);

        userDataRef = doc(db, "users", user.uid);
        loadUserData();
        startLeaderboard();
        updateLeaderboardCTA();
        // Start presence system for logged-in users
        startPresence();

    } else {
        // User signed out - reset everything and prepare for guest or new login
        console.log('\ud83d\udeaa User signed out - resetting application state');

        // Force stop all systems immediately
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;

        // Stop all services
        stopLeaderboard();
        stopPresence();

        // Reset application state completely
        currentUserData = getDefaultUserData();
        userDataRef = null;

        // If not transitioning to guest mode, show auth modal
        if (!isGuestMode) {
            console.log('\ud83d\udd10 Showing auth modal for re-authentication');
            DOMElements.appContainer.classList.add('hidden');
            DOMElements.authModal.classList.add('visible');
        } else {
            console.log('\ud83d\udc64 Staying in guest mode after logout');
            // Keep app container visible for guest mode
            DOMElements.appContainer.classList.remove('hidden');
            DOMElements.authModal.classList.remove('visible');

            // CRITICAL: Reapply guest restrictions after logout with delay
            console.log('\ud83d\udd12 Reapplying guest restrictions after logout...');
            setTimeout(() => {
                applyGuestRestrictions();
                console.log('\u2705 Guest restrictions reapplied after logout');
            }, 200);
        }

        // Update UI elements
        updateLeaderboardCTA();
        updateHeaderForGuest();

        console.log('\u2705 Application state reset complete');
    }
});

function saveUserData() {
    // Guest mode: Only save to localStorage, never to Firestore
    if (isGuestMode) {
        console.log('💾 Saving guest data to localStorage only');

        // Prune weekly maps to last 7 days for memory efficiency
        try { pruneWeeklyData(); } catch { }

        // For guests, save ALL data to localStorage including streaks
        // but never save to Firestore to preserve storage
        const guestData = {
            ...currentUserData,
            // Keep streak data for guests (they should see their progress)
            streakCount: currentUserData.streakCount || 0,
            bestStreak: currentUserData.bestStreak || 0,
            lastStreakDate: currentUserData.lastStreakDate || null,
            // Keep basic stats for UI display but don't sync to leaderboards
            totalFocusMinutes: currentUserData.totalFocusMinutes || 0,
            totalFocusSeconds: currentUserData.totalFocusSeconds || 0,
            totalSessions: currentUserData.totalSessions || 0,
            longestSession: currentUserData.longestSession || 0,
            todaySessions: currentUserData.todaySessions || 0,
            lastSessionDate: currentUserData.lastSessionDate || null,
            // Keep todos and settings
            todos: currentUserData.todos || [],
            settings: currentUserData.settings || {},
            theme: currentUserData.theme || { backgroundPath: null, youtubeVideoId: "6KL2QZ91kAM" },
            // Keep minimal weekly data for UI (but not for leaderboards)
            weeklyFocus: currentUserData.weeklyFocus || {},
            weeklyFocusSeconds: currentUserData.weeklyFocusSeconds || {},
            weeklySessions: currentUserData.weeklySessions || {},
            // Mark as guest data
            isGuestData: true,
            lastSaved: Date.now()
        };

        localStorage.setItem('youfloww_guest', JSON.stringify(guestData));
        console.log('💾 Guest data saved to localStorage only:', {
            streak: guestData.streakCount,
            sessions: guestData.totalSessions,
            todos: guestData.todos.length,
            profileName: guestData.profileName,
            totalFocusMinutes: guestData.totalFocusMinutes
        });
        console.log('🚫 Guest excluded from Firestore and leaderboards - maintaining data privacy');
        return; // Don't save to Firestore for guests
    }

    // Regular user: Save to Firestore
    if (userDataRef) {
        // Prune weekly maps to last 7 days for memory efficiency before saving
        try { pruneWeeklyData(); } catch { }

        // Validate and clean data before saving
        currentUserData = validateUserData(currentUserData);

        // Run suspicious activity detection (logs warnings but doesn't block)
        detectSuspiciousActivity(currentUserData);

        setDoc(userDataRef, currentUserData, { merge: true }).catch(error => console.error("Error saving user data: ", error));
    }
}
function loadUserData() {
    if (isGuestMode) {
        const rawData = loadGuestData() || getDefaultUserData();
        currentUserData = validateUserData(rawData);
        // Initialize streak tracking
        initializeStreakTracking(currentUserData);
        initializeAppState();
    } else if (userDataRef) {
        getDoc(userDataRef).then(docSnap => {
            if (docSnap.exists()) {
                // Merge with defaults to ensure required keys exist
                const rawData = { ...getDefaultUserData(), ...docSnap.data() };
                currentUserData = validateUserData(rawData);
            } else {
                // New account: start clean for this user, not with prior user's data
                currentUserData = validateUserData(getDefaultUserData());
                // Add account creation timestamp for validation purposes
                currentUserData.createdAt = Date.now();
                setDoc(userDataRef, currentUserData).catch(e => console.error('Failed to init user doc:', e));
            }
            // Initialize streak tracking
            initializeStreakTracking(currentUserData);
            initializeAppState();
            updatePublicUserDoc();
        });
    }
}
function loadGuestData() {
    try {
        const rawData = JSON.parse(localStorage.getItem('youfloww_guest'));
        return rawData ? validateUserData(rawData) : null;
    } catch {
        return null;
    }
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

    // Robustly toggle main play/pause icons (class + inline style fallback)
    DOMElements.playIcon.classList.toggle('hidden', isRunning);
    DOMElements.pauseIcon.classList.toggle('hidden', !isRunning);
    DOMElements.playIcon.style.display = isRunning ? 'none' : 'block';
    DOMElements.pauseIcon.style.display = isRunning ? 'block' : 'none';
    DOMElements.playPauseBtn.setAttribute('aria-label', isRunning ? 'Pause Timer' : 'Start Timer');
    // Also reflect paused state on the button (for accessibility/themes)
    DOMElements.playPauseBtn.classList.toggle('paused', !isRunning);

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
    // Update presence focusing status immediately (secure rules compliant)
    try {
        if (presenceDocRef && auth.currentUser) {
            const focusUpdate = {
                uid: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
                lastActiveMs: Date.now(),
                isFocusing: getIsFocusing(),
                userAgent: navigator.userAgent || 'unknown'
            };
            setDoc(presenceDocRef, focusUpdate, { merge: true });
        }
    } catch (e) { console.warn('Focus presence update failed:', e.message); }
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
        window.accountabilityPartner.startSession(
            () => { // On Gone
                pauseTimer(false);
                const overlay = document.getElementById('accountabilityOverlay');
                if (overlay) overlay.classList.remove('hidden');

                // Add click-to-resume functionality
                if (!accountabilityClickToResume) {
                    accountabilityClickToResume = function () {
                        if (!isRunning && !pauseWasManual && isAccountabilityOn) {
                            // Remove the listener after first click
                            document.removeEventListener('click', accountabilityClickToResume);
                            accountabilityClickToResume = null;

                            // Reset accountability state - person is back!
                            if (window.accountabilityPartner) {
                                window.accountabilityPartner.lastPersonDetectedTime = Date.now();
                                window.accountabilityPartner.isPersonGone = false;
                                console.log('Accountability: Manual resume - person marked as present');
                            }

                            // Hide overlay and resume timer
                            const overlay = document.getElementById('accountabilityOverlay');
                            if (overlay) overlay.classList.add('hidden');
                            startTimer(true);
                        }
                    };
                    document.addEventListener('click', accountabilityClickToResume);
                }
            },
            () => { // On Back
                const overlay = document.getElementById('accountabilityOverlay');
                if (overlay) overlay.classList.add('hidden');

                // Remove click-to-resume listener if it exists
                if (accountabilityClickToResume) {
                    document.removeEventListener('click', accountabilityClickToResume);
                    accountabilityClickToResume = null;
                }

                if (!isRunning && !pauseWasManual) startTimer(true);
            }
        );
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

}


function pauseTimer(userInitiated = true) {
    // Update presence focusing status immediately when pausing (secure rules compliant)
    try {
        if (presenceDocRef && auth.currentUser) {
            const pauseUpdate = {
                uid: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
                lastActiveMs: Date.now(),
                isFocusing: false,
                userAgent: navigator.userAgent || 'unknown'
            };
            setDoc(presenceDocRef, pauseUpdate, { merge: true });
        }
    } catch (e) { console.warn('Pause presence update failed:', e.message); }
    if (!isRunning) return;
    clearInterval(timerInterval);
    isRunning = false;
    disableLeaveWarning();
    if (userInitiated) {
        pauseWasManual = true;
        DOMElements.sounds.pauseAlert.play();
        window.accountabilityPartner.stopSession();
        // Clean up click-to-resume listener
        if (accountabilityClickToResume) {
            document.removeEventListener('click', accountabilityClickToResume);
            accountabilityClickToResume = null;
        }
    } else {
        pauseWasManual = false;
    }
    lastPauseTimestamp = Date.now();
    updateUIState();
}

function resetTimer() {
    clearInterval(timerInterval);
    window.accountabilityPartner.stopSession();
    // Clean up click-to-resume listener
    if (accountabilityClickToResume) {
        document.removeEventListener('click', accountabilityClickToResume);
        accountabilityClickToResume = null;
    }
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
    // Presence focusing off at end (secure rules compliant)
    try {
        if (presenceDocRef && auth.currentUser) {
            const endUpdate = {
                uid: auth.currentUser.uid,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
                lastActiveMs: Date.now(),
                isFocusing: false,
                userAgent: navigator.userAgent || 'unknown'
            };
            setDoc(presenceDocRef, endUpdate, { merge: true });
        }
    } catch (e) { console.warn('End session presence update failed:', e.message); }

    if (isWorkSession) {
        // Manual end of a WORK session → log stats and show review
        let sessionSeconds = Math.max(0, Math.round(workDuration - timeLeft));
        // Validate session before processing
        sessionSeconds = validateSessionData(sessionSeconds, sessionStartTime);
        handleEndOfWorkSession(sessionSeconds, false);
        // Only play bad meme on early end of a WORK session
        playRandomSound('bad');
        // Show review for work sessions only
        showSessionReview();
        resetTimer();
    } else {
        // Manual end of a BREAK → do NOT record stats or play memes
        clearInterval(timerInterval);
        isRunning = false;
        disableLeaveWarning();
        window.accountabilityPartner.stopSession();
        // Switch back to work
        isWorkSession = true;
        sessionStartTime = null;
        totalAwayTime = 0;
        const remainingSec = getFocusedTaskRemainingSeconds();
        timeLeft = (remainingSec && remainingSec > 0) ? remainingSec : workDuration;
        updateTimerDisplay();
        updateUIState();
    }
}

function handleSessionCompletion() {
    if (isWorkSession) {
        // Work session finished
        let sessionSeconds = Math.max(0, Math.round(workDuration - timeLeft));
        // Validate session before processing
        sessionSeconds = validateSessionData(sessionSeconds, sessionStartTime);
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
    window.accountabilityPartner.stopSession();
    stopVideo();

    // Validate session data before processing
    const validatedSessionSeconds = validateSessionData(sessionSeconds, sessionStartTime);
    if (validatedSessionSeconds !== sessionSeconds) {
        console.warn('Session validation: Adjusted session duration', {
            original: sessionSeconds,
            validated: validatedSessionSeconds
        });
    }
    sessionSeconds = validatedSessionSeconds;

    // If a task is focused, attribute this session's time (in seconds) to it as well
    if (activeTaskIndex !== null && currentUserData.todos && currentUserData.todos[activeTaskIndex] && !currentUserData.todos[activeTaskIndex].completed) {
        const t = currentUserData.todos[activeTaskIndex];
        if (!Number.isFinite(t.loggedSeconds)) t.loggedSeconds = 0;
        t.loggedSeconds += Math.max(0, Math.round(sessionSeconds));
        // Auto-complete task if estimate is met or exceeded
        const estSec = (Number.isFinite(t.estimateMinutes) ? t.estimateMinutes : 0) * 60;
        if (estSec > 0 && t.loggedSeconds >= estSec) {
            t.loggedSeconds = estSec; // cap to estimate
            if (!t.completed) {
                t.completed = true;
                // Increment weekly completion for canonical tasks on auto-complete
                const today = getLocalDateKey();
                if (t.canonicalId) {
                    if (!currentUserData.weeklyCategoryCompletionsByDate) currentUserData.weeklyCategoryCompletionsByDate = {};
                    if (!currentUserData.weeklyCategoryCompletionsByDate[today]) currentUserData.weeklyCategoryCompletionsByDate[today] = {};
                    const cid = String(t.canonicalId);
                    currentUserData.weeklyCategoryCompletionsByDate[today][cid] = (currentUserData.weeklyCategoryCompletionsByDate[today][cid] || 0) + 1;
                }
            }
            // Clear focus when task is completed
            activeTaskIndex = null;
            // Celebrate auto-complete just like manual completion
            try { playCompleteSound(); } catch { }
            try { showConfetti(); } catch { }
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
        // Track weekly sessions by day for 7d stats
        if (!currentUserData.weeklySessions) currentUserData.weeklySessions = {};
        currentUserData.weeklySessions[today] = (currentUserData.weeklySessions[today] || 0) + 1;

        // Track completion vs early end for discipline
        if (!currentUserData.weeklyCompletedSessions) currentUserData.weeklyCompletedSessions = {};
        if (!currentUserData.weeklyEarlyEndedSessions) currentUserData.weeklyEarlyEndedSessions = {};
        if (sessionCompleted) {
            currentUserData.weeklyCompletedSessions[today] = (currentUserData.weeklyCompletedSessions[today] || 0) + 1;
        } else {
            currentUserData.weeklyEarlyEndedSessions[today] = (currentUserData.weeklyEarlyEndedSessions[today] || 0) + 1;
        }

        // Attribute time to task vs anonymous (7d rolling, per-day buckets)
        if (!currentUserData.weeklyTaskSecondsByDate) currentUserData.weeklyTaskSecondsByDate = {};
        if (!currentUserData.weeklyTaskSecondsByDate[today]) currentUserData.weeklyTaskSecondsByDate[today] = {};
        if (!currentUserData.weeklyCategorySecondsByDate) currentUserData.weeklyCategorySecondsByDate = {};
        if (!currentUserData.weeklyCategorySecondsByDate[today]) currentUserData.weeklyCategorySecondsByDate[today] = {};
        if (activeTaskIndex !== null && currentUserData.todos && currentUserData.todos[activeTaskIndex] && !currentUserData.todos[activeTaskIndex].completed) {
            const t = currentUserData.todos[activeTaskIndex];
            if (t.canonicalId) {
                const cid = String(t.canonicalId);
                currentUserData.weeklyCategorySecondsByDate[today][cid] = (currentUserData.weeklyCategorySecondsByDate[today][cid] || 0) + secondsFocused;
            } else {
                // Treat focused sessions on non-regular (free-text) tasks as anonymous
                if (!currentUserData.weeklyAnonymousSeconds) currentUserData.weeklyAnonymousSeconds = {};
                if (!currentUserData.weeklyAnonymousSessions) currentUserData.weeklyAnonymousSessions = {};
                currentUserData.weeklyAnonymousSeconds[today] = (currentUserData.weeklyAnonymousSeconds[today] || 0) + secondsFocused;
                currentUserData.weeklyAnonymousSessions[today] = (currentUserData.weeklyAnonymousSessions[today] || 0) + 1;
            }
        } else {
            if (!currentUserData.weeklyAnonymousSeconds) currentUserData.weeklyAnonymousSeconds = {};
            if (!currentUserData.weeklyAnonymousSessions) currentUserData.weeklyAnonymousSessions = {};
            currentUserData.weeklyAnonymousSeconds[today] = (currentUserData.weeklyAnonymousSeconds[today] || 0) + secondsFocused;
            currentUserData.weeklyAnonymousSessions[today] = (currentUserData.weeklyAnonymousSessions[today] || 0) + 1;
        }

        // Update longest session (in minutes)
        if (minutesFocused > currentUserData.longestSession) {
            currentUserData.longestSession = minutesFocused;
        }

        // Update streak and animate changes
        const streakChange = updateStreak();
        if (streakChange && streakChange.change === 'inc') {
            try { DOMElements.sounds.resumeAlert.play(); } catch { }
            showStreakAnimation('increase', streakChange.newCount);
        } else if (streakChange && streakChange.change === 'reset') {
            showStreakAnimation('reset', 0);
        }
    }
    // Trigger achievement checks based on updated stats
    try {
        if (typeof achievementSystem !== 'undefined' && achievementSystem && typeof achievementSystem.checkAchievements === 'function') {
            const userStatsForAchievements = {
                totalSessions: currentUserData.totalSessions || 0,
                currentStreak: currentUserData.streakCount || 0,
                totalFocusMinutes: currentUserData.totalFocusMinutes || 0,
                longestSession: currentUserData.longestSession || 0,
                maxSessionsPerDay: currentUserData.todaySessions || 0,
                earlyMorningSessions: 0,
                lateNightSessions: 0,
                consecutiveWeekends: 0,
                uniqueTasks: Array.isArray(currentUserData.regularTasks) ? currentUserData.regularTasks.length : 0,
                perfectSessions: 0
            };
            achievementSystem.checkAchievements(userStatsForAchievements);
        }
    } catch (e) { console.warn('Achievement check failed:', e); }
    // Note: Sounds are handled at call sites (natural completion -> good, early end -> bad)
    saveUserData();
    // Update public projection used by leaderboard
    updatePublicUserDoc();
}

// Update streak logic - only called when a work session is completed (both full completion and early end)
function updateStreak() {
    const today = getLocalDateKey();
    const prevCount = currentUserData.streakCount || 0;
    const lastStreakDate = currentUserData.lastStreakDate;
    let change = 'none';

    console.log('🔥 Updating streak:', { today, lastStreakDate, prevCount, isGuest: isGuestMode });

    // Check if user already completed a session today
    if (lastStreakDate === today) {
        console.log('⚡ Session already completed today, no streak change');
        return { change: 'none', newCount: currentUserData.streakCount, prevCount };
    }

    if (!lastStreakDate) {
        // First ever session
        currentUserData.streakCount = 1;
        currentUserData.lastStreakDate = today;
        change = 'inc';
        console.log('🌟 First session streak started!');
    } else {
        const diffDays = diffLocalDateKeysDays(lastStreakDate, today);
        if (diffDays === 1) {
            // Consecutive day - increase streak
            currentUserData.streakCount = (currentUserData.streakCount || 0) + 1;
            currentUserData.lastStreakDate = today;
            change = 'inc';
            console.log(`📈 Streak increased to ${currentUserData.streakCount}`);
        } else if (diffDays > 1) {
            // Missed days - reset to 1 since a session completed today after a gap
            const oldStreak = currentUserData.streakCount;
            currentUserData.streakCount = 1;
            currentUserData.lastStreakDate = today;
            change = 'reset';
            console.log(`💔 Streak reset from ${oldStreak} to 1 (missed ${diffDays - 1} days)`);
        }
        // If same day (diffDays === 0), do nothing - already handled above
    }

    // Update best streak
    if (currentUserData.streakCount > (currentUserData.bestStreak || 0)) {
        currentUserData.bestStreak = currentUserData.streakCount;
        console.log(`🏆 New best streak: ${currentUserData.bestStreak}`);
    }

    // Update UI
    if (DOMElements.streak && DOMElements.streak.count) {
        DOMElements.streak.count.textContent = currentUserData.streakCount || 0;
    }

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
let youtubePlayerReady = false;
let youtubeAPILoaded = false;

function initYoutubePlayer() {
    console.log('🎬 Setting up YouTube Player...');
    setupPipPlayer();
}

function createYoutubePlayer(videoId) {
    if (!videoId) videoId = 'lTRiuFIWV54';
    lastYouTubeVideoId = videoId;

    console.log('🎥 Creating YouTube player with video:', videoId);

    // Destroy existing player if any
    if (youtubePlayer && typeof youtubePlayer.destroy === 'function') {
        try { youtubePlayer.destroy(); } catch (e) { }
    }

    // Show placeholder
    const placeholder = document.getElementById('player-placeholder');
    if (placeholder) placeholder.style.display = 'block';

    try {
        youtubePlayer = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'controls': 1,
                'rel': 0,
                'modestbranding': 1,
                'playsinline': 1,
                'mute': 0,
                'loop': 1,
                'playlist': videoId
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
        console.error('❌ Error creating YouTube player:', error);
    }
}

function onPlayerReady(event) {
    console.log('✅ YouTube player ready!');
    youtubePlayerReady = true;

    // Hide placeholder
    const placeholder = document.getElementById('player-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    try {
        if (youtubePlayer.unMute) youtubePlayer.unMute();
        if (youtubePlayer.setVolume) youtubePlayer.setVolume(100);
        if (youtubePlayer.playVideo) youtubePlayer.playVideo();
    } catch (error) {
        console.warn('⚠️ Autoplay error:', error);
    }
}

function onPlayerError(event) {
    console.error('❌ YouTube Player Error:', event.data);
}

function onPlayerStateChange(event) {
    // Optional: handle state changes
}

function setupPipPlayer() {
    const container = document.getElementById('pip-player-container');
    const pipBtn = document.getElementById('pipYoutubeBtn');

    if (pipBtn && container) {
        pipBtn.addEventListener('click', () => {
            const isHidden = container.classList.contains('hidden');

            if (isHidden) {
                // SHOW PLAYER
                container.classList.remove('hidden');
                container.style.display = 'flex'; // Force display

                // Load API if needed
                if (!window.YT || !window.YT.Player) {
                    console.log('📦 Loading YouTube API...');
                    const tag = document.createElement('script');
                    tag.src = 'https://www.youtube.com/iframe_api';
                    const firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

                    window.onYouTubeIframeAPIReady = function () {
                        createYoutubePlayer('lTRiuFIWV54');
                    };
                } else if (!youtubePlayerReady) {
                    createYoutubePlayer('lTRiuFIWV54');
                } else {
                    if (youtubePlayer && youtubePlayer.playVideo) youtubePlayer.playVideo();
                }
            } else {
                // HIDE PLAYER
                container.classList.add('hidden');
                if (youtubePlayer && youtubePlayer.pauseVideo) youtubePlayer.pauseVideo();
            }
        });
    }

    // CONTROLS
    const closeBtn = document.getElementById('pip-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            container.classList.add('hidden');
            if (youtubePlayer && youtubePlayer.stopVideo) youtubePlayer.stopVideo();
        });
    }

    const minimizeBtn = document.getElementById('pip-minimize-btn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            container.classList.add('hidden');
            // Don't stop video, just hide
        });
    }

    // SET URL
    const setBtn = document.getElementById('pip-set-btn');
    const input = document.getElementById('pip-youtube-input');

    if (setBtn && input) {
        const loadUrl = () => {
            const url = input.value.trim();
            if (!url) return;
            const videoId = getYoutubeVideoId(url);
            if (videoId) {
                createYoutubePlayer(videoId);
                input.value = '';
            } else {
                alert('Invalid YouTube URL');
            }
        };
        setBtn.addEventListener('click', loadUrl);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadUrl();
        });
    }

    // DRAG FUNCTIONALITY
    const header = document.getElementById('pip-player-header');
    if (header) {
        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('mousemove', drag);
    }

    // RESIZE FUNCTIONALITY
    const resizeHandle = document.getElementById('pip-resize-handle');
    if (resizeHandle) {
        resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('mousemove', resize);
    }
}

// DRAG LOGIC
isPipDragging = false;
pipDragOffset = { x: 0, y: 0 };

function startDrag(e) {
    const container = document.getElementById('pip-player-container');
    if (!container) return;

    isPipDragging = true;
    const rect = container.getBoundingClientRect();
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
    const container = document.getElementById('pip-player-container');
    if (!container) return;

    container.style.left = (e.clientX - pipDragOffset.x) + 'px';
    container.style.top = (e.clientY - pipDragOffset.y) + 'px';
    container.style.right = 'auto';
    container.style.bottom = 'auto';
}

// RESIZE LOGIC
let isResizing = false;
let startWidth, startHeight, startX, startY;

function startResize(e) {
    const container = document.getElementById('pip-player-container');
    if (!container) return;

    isResizing = true;
    startWidth = parseInt(getComputedStyle(container).width, 10);
    startHeight = parseInt(getComputedStyle(container).height, 10);
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
}

function stopResize() {
    isResizing = false;
}

function resize(e) {
    if (!isResizing) return;
    const container = document.getElementById('pip-player-container');
    if (!container) return;

    const width = startWidth + (e.clientX - startX);
    const height = startHeight + (e.clientY - startY);

    if (width > 300 && height > 250) {
        container.style.width = width + 'px';
        container.style.height = height + 'px';
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

    // Regular tasks UI
    renderRegularTasksList();
    populateRegularTaskSelect();

    // If no theme set, default to Nature Walk background video
    if (!currentUserData.theme || (!currentUserData.theme.backgroundPath && !currentUserData.theme.youtubeVideoId)) {
        console.log('\ud83c\udf3f No theme set, applying default Nature Walk theme...');
        applyTheme('youtube', '6KL2QZ91kAM'); // Nature Walk
        console.log('\u2705 Default Nature Walk theme applied successfully');
    }

    // Update streak display
    DOMElements.streak.count.textContent = currentUserData.streakCount || 0;

    // Ensure daily rollovers on load and start day boundary watcher
    ensureDailyRollovers();
    startDayBoundaryWatcher();

    // On initial load, if Sunday and not shown yet, show weekly report
    try { maybeShowWeeklyReportPopup(); } catch { }

    // Start live presence once app UI is ready
    try { startPresence(); } catch (e) { console.warn('Presence init failed', e); }

    // Start leaderboards for both authenticated and guest users so they are never blank
    try { startLeaderboard(); } catch (e) { console.warn('Leaderboard init failed', e); }

    // Show or hide the guest CTA based on auth state
    updateLeaderboardCTA();

    // Refresh achievements new indicator on load
    try { if (typeof achievementSystem !== 'undefined' && achievementSystem.updateNewIndicator) achievementSystem.updateNewIndicator(); } catch { }
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

    // Accountability partner settings
    isAccountabilityOn = settings.isAccountabilityOn || false;
    window.isAccountabilityOn = isAccountabilityOn;

    if (DOMElements.settings.accountabilityToggle) {
        DOMElements.settings.accountabilityToggle.checked = isAccountabilityOn;
        DOMElements.settings.accountabilityToggle.disabled = false;
    }

    if (isAccountabilityOn) {
        window.accountabilityPartner.init();
    }
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

        // Accountability partner settings
        const accEnabled = DOMElements.settings.accountabilityToggle.checked;
        currentUserData.settings.isAccountabilityOn = accEnabled;
        isAccountabilityOn = accEnabled;
        window.isAccountabilityOn = isAccountabilityOn;

        if (isAccountabilityOn) {
            // Initialize the model but don't request camera yet - it will be requested when session starts
            window.accountabilityPartner.init();
        } else {
            window.accountabilityPartner.stopSession();
        }

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
    try { renderWeeklyReport(); } catch { }
}
function closeStats() { DOMElements.modals.stats.classList.remove('visible'); }
function openBmcModal() { const m = document.getElementById('bmcModal'); if (m) m.classList.add('visible'); }
function closeBmcModal() { const m = document.getElementById('bmcModal'); if (m) m.classList.remove('visible'); }
function openSupportQRModal() { const m = document.getElementById('supportQRModal'); if (m) m.classList.add('visible'); }
function closeSupportQRModal() { const m = document.getElementById('supportQRModal'); if (m) m.classList.remove('visible'); }
function updateStatsDisplay() {
    const totalSec = (typeof currentUserData.totalFocusSeconds === 'number' ? currentUserData.totalFocusSeconds : (currentUserData.totalFocusMinutes || 0) * 60);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    DOMElements.modals.totalFocusTime.textContent = `${hours}h ${minutes}m`;
    DOMElements.modals.totalSessionsCount.textContent = currentUserData.totalSessions || 0;
    DOMElements.modals.currentStreak.textContent = `${currentUserData.streakCount || 0} days`;

    // Weekly totals (7d) from weeklyFocusSeconds and weeklySessions
    const wk = currentUserData.weeklyFocusSeconds || {};
    const ws = currentUserData.weeklySessions || {};
    const keys = [];
    const today = getLocalDateKey();
    const baseDate = dateKeyToLocalDate(today);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
        keys.push(getLocalDateKey(d));
    }
    let weeklySec = 0;
    let weeklySessions = 0;
    keys.forEach(k => {
        weeklySec += Math.max(0, wk[k] || 0);
        weeklySessions += Math.max(0, ws[k] || 0);
    });
    const weeklyMinutes = Math.floor(weeklySec / 60);
    if (DOMElements.modals.weeklyFocusHours) DOMElements.modals.weeklyFocusHours.textContent = formatMinutesPretty(weeklyMinutes);
    if (DOMElements.modals.weeklySessionsCount) DOMElements.modals.weeklySessionsCount.textContent = weeklySessions;

    // Average session length (lifetime)
    const totalSessions = currentUserData.totalSessions || 0;
    const avgMinutes = totalSessions > 0 ? Math.round((totalSec / 60) / totalSessions) : 0;
    if (DOMElements.modals.avgSessionLength) DOMElements.modals.avgSessionLength.textContent = formatMinutesPretty(avgMinutes);
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
        conf.style.background = `hsl(${Math.random() * 360},80%,70%)`;
        conf.style.opacity = 0.8;
        conf.style.borderRadius = '3px';
        conf.style.transform = `rotate(${Math.random() * 360}deg)`;
        conf.style.transition = 'top 1.2s cubic-bezier(.5,1.8,.5,1), opacity 1.2s';
        canvas.appendChild(conf);
        setTimeout(() => {
            conf.style.top = (60 + Math.random() * 30) + '%';
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
    // Canonical badge
    if (todo.canonicalId) {
        const badge = document.createElement('span');
        badge.className = 'todo-category-badge';
        const cname = getRegularTaskName(todo.canonicalId);
        if (cname) {
            badge.textContent = ` · ${cname}`;
            label.appendChild(badge);
        }
    }
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
    spentSpan.innerHTML = `🔥 Spent: ${formatDurationPretty(spentSec)}${estSec > 0 ? ` • ${percent}%` : ''}`;

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
    const select = document.getElementById('regularTaskSelect');
    const selectedId = select && select.value ? select.value : '';
    let text = input.value.trim();
    // If user chose a regular task and left text blank, use the regular task name as text
    if (!text && selectedId) {
        const name = getRegularTaskName(selectedId) || '';
        if (name) text = name;
    }
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
    const canonicalId = selectedId || null;
    currentUserData.todos.push({
        text,
        completed: false,
        subtasks: [],
        estimateMinutes: estVal,
        loggedMinutes: 0,
        createdAt: Date.now(),
        canonicalId
    });
    input.value = '';
    if (select) select.value = '';
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
        // Increment weekly completion for canonical tasks
        const today = getLocalDateKey();
        if (todo.canonicalId) {
            if (!currentUserData.weeklyCategoryCompletionsByDate) currentUserData.weeklyCategoryCompletionsByDate = {};
            if (!currentUserData.weeklyCategoryCompletionsByDate[today]) currentUserData.weeklyCategoryCompletionsByDate[today] = {};
            const cid = String(todo.canonicalId);
            currentUserData.weeklyCategoryCompletionsByDate[today][cid] = (currentUserData.weeklyCategoryCompletionsByDate[today][cid] || 0) + 1;
        }
    } else if (!todo.completed && wasCompleted) {
        // Decrement if user un-completes a task (floor at 0)
        const today = getLocalDateKey();
        if (todo.canonicalId && currentUserData.weeklyCategoryCompletionsByDate && currentUserData.weeklyCategoryCompletionsByDate[today]) {
            const cid = String(todo.canonicalId);
            const val = currentUserData.weeklyCategoryCompletionsByDate[today][cid] || 0;
            currentUserData.weeklyCategoryCompletionsByDate[today][cid] = Math.max(0, val - 1);
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

document.getElementById('todo-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        addTodo();
    }
});
document.getElementById('add-todo-btn').addEventListener('click', addTodo);
{ const btn = document.querySelector('.clear-todos-btn'); if (btn) btn.addEventListener('click', clearTodos); }

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

// Regular Tasks Helpers
function getRegularTaskName(id) {
    const arr = currentUserData.regularTasks || [];
    const item = arr.find(r => String(r.id) === String(id));
    return item ? item.name : null;
}
function addRegularTask(name) {
    if (!currentUserData.regularTasks) currentUserData.regularTasks = [];
    // Avoid exact duplicate names (case-insensitive)
    const exists = currentUserData.regularTasks.some(rt => (rt.name || '').toLowerCase() === name.toLowerCase());
    if (exists) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    currentUserData.regularTasks.push({ id, name });
    saveUserData();
    renderRegularTasksList();
    populateRegularTaskSelect();
}
function deleteRegularTask(id) {
    if (!currentUserData.regularTasks) return;
    currentUserData.regularTasks = currentUserData.regularTasks.filter(rt => String(rt.id) !== String(id));
    saveUserData();
    renderRegularTasksList();
    populateRegularTaskSelect();
}
function renameRegularTask(id, newName) {
    if (!currentUserData.regularTasks) return;
    const item = currentUserData.regularTasks.find(rt => String(rt.id) === String(id));
    if (!item) return;
    item.name = newName;
    saveUserData();
    renderRegularTasksList();
    populateRegularTaskSelect();
}
function renderRegularTasksList() {
    const ul = document.getElementById('regularTasksList');
    if (!ul) return;
    ul.innerHTML = '';
    const arr = currentUserData.regularTasks || [];
    if (arr.length === 0) {
        ul.innerHTML = '<li class="placeholder">No regular tasks yet</li>';
        return;
    }
    arr.forEach(rt => {
        const li = document.createElement('li');
        li.className = 'regular-task-item';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'regular-task-name';
        nameSpan.textContent = rt.name;
        const editBtn = document.createElement('button');
        editBtn.className = 'icon-btn regular-task-edit';
        editBtn.innerHTML = '<i class="fas fa-pen"></i>';
        editBtn.title = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit');
        editBtn.addEventListener('click', () => {
            const ans = prompt('Rename task', rt.name);
            if (ans !== null) {
                const n = ans.trim();
                if (n) renameRegularTask(rt.id, n);
            }
        });
        const delBtn = document.createElement('button');
        delBtn.className = 'icon-btn danger regular-task-delete';
        delBtn.innerHTML = '<i class="fas fa-trash"></i>';
        delBtn.title = 'Delete';
        delBtn.setAttribute('aria-label', 'Delete');
        delBtn.addEventListener('click', () => deleteRegularTask(rt.id));
        li.appendChild(nameSpan);
        li.appendChild(editBtn);
        li.appendChild(delBtn);
        ul.appendChild(li);
    });
}
function populateRegularTaskSelect() {
    const sel = document.getElementById('regularTaskSelect');
    if (!sel) return;
    const arr = currentUserData.regularTasks || [];
    const value = sel.value || '';
    sel.innerHTML = '<option value="">Choose regular task (optional)</option>';
    arr.forEach(rt => {
        const opt = document.createElement('option');
        opt.value = rt.id;
        opt.textContent = rt.name;
        sel.appendChild(opt);
    });
    // Try to preserve previous selection
    if ([...sel.options].some(o => o.value === value)) sel.value = value;
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
    if (DOMElements.timetable.form) {
        DOMElements.timetable.form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            addTimeSlot();
        });
    }
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

    // Get time values from dropdowns
    const startHour = document.getElementById('timeslot-start-hour').value;
    const startMinute = document.getElementById('timeslot-start-minute').value;
    const startAMPM = document.getElementById('timeslot-start-ampm').value;

    const endHour = document.getElementById('timeslot-end-hour').value;
    const endMinute = document.getElementById('timeslot-end-minute').value;
    const endAMPM = document.getElementById('timeslot-end-ampm').value;

    const activity = document.getElementById('timeslot-activity').value.trim();

    // Debug logging
    console.log('Form values:', {
        day, startHour, startMinute, startAMPM,
        endHour, endMinute, endAMPM, activity
    });

    // Simple validation - check if any field is empty string
    if (!day || !startHour || !startMinute || !startAMPM || !endHour || !endMinute || !endAMPM || !activity) {
        // Find which field is empty for better error message
        if (!day) alert('Please select a day');
        else if (!startHour) alert('Please select start hour');
        else if (!startMinute) alert('Please select start minute');
        else if (!startAMPM) alert('Please select AM/PM for start time');
        else if (!endHour) alert('Please select end hour');
        else if (!endMinute) alert('Please select end minute');
        else if (!endAMPM) alert('Please select AM/PM for end time');
        else if (!activity) alert('Please enter an activity');
        return;
    }

    // Convert 12-hour format to 24-hour format for storage
    const start = convertTo24Hour(startHour, startMinute, startAMPM);
    const end = convertTo24Hour(endHour, endMinute, endAMPM);

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

function convertTo24Hour(hour, minute, ampm) {
    let hour24 = parseInt(hour);

    if (ampm === 'AM') {
        if (hour24 === 12) hour24 = 0;
    } else { // PM
        if (hour24 !== 12) hour24 += 12;
    }

    return `${hour24.toString().padStart(2, '0')}:${minute}`;
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
function getCuratedQuotes() {
    return [
        { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
        { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
        { text: 'Quality is not an act, it is a habit.', author: 'Aristotle' },
        { text: 'We are what we repeatedly do. Excellence, then, is not an act but a habit.', author: 'Will Durant' },
        { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
        { text: 'Don’t watch the clock; do what it does. Keep going.', author: 'Sam Levenson' },
        { text: 'If you can dream it, you can do it.', author: 'Walt Disney' },
        { text: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe' },
        { text: 'Action is the foundational key to all success.', author: 'Pablo Picasso' },
        { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
        { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
        { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
        { text: 'Dream big. Start small. Act now.', author: '' },
        { text: 'Discipline is choosing what you want most over what you want now.', author: '' },
        { text: 'Push yourself, because no one else is going to do it for you.', author: '' },
    ];
}
function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return h;
}
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
            // Offline or API failed: pick a deterministic quote from curated list based on local date
            const curated = getCuratedQuotes();
            const idx = Math.abs(hashString(today)) % curated.length;
            const { text, author } = curated[idx];
            quoteTextEl.textContent = text;
            quoteAuthorEl.textContent = author ? `— ${author}` : '';
            localStorage.setItem('quoteOfTheDay', JSON.stringify({ date: today, text, author }));
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
// ===================================================================================
// STATS CARD SHARE (SVG -> PNG)
// ===================================================================================
function buildStatsSvgTemplate(opts) {
    const width = 1080, height = 1350; // portrait for better share reach
    const {
        name = 'Floww User',
        weeklyMinutes = 0,
        avgMinutes = 0,
        streak = 0,
        series = [],
        dateStr = ''
    } = opts || {};
    const weeklyHoursStr = `${(weeklyMinutes / 60).toFixed(2)}h`;
    const avgStr = (avgMinutes && avgMinutes > 0) ? `${avgMinutes}m` : '0m';
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#0b1223"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <style>
      .title { font: 900 64px 'Inter', system-ui, -apple-system; fill: #e5e7eb; }
      .tagline { font: 900 44px 'Inter', system-ui; letter-spacing: 0.02em; fill: #a7f3d0; }
      .sub   { font: 700 34px 'Inter', system-ui; fill: #cbd5e1; }
      .stat  { font: 800 112px 'Inter', system-ui; fill: #ffffff; }
      .label { font: 700 28px 'Inter', system-ui; fill: #a7f3d0; }
      .chip  { font: 700 28px 'Inter', system-ui; fill: #0b0b0b; }
    </style>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" fill="url(#bg)"/>

  <!-- Tagline and date -->
  <text x="${width / 2}" y="120" class="tagline" text-anchor="middle">This Week's FlowwStats</text>
  <text x="${width - 80}" y="170" class="sub" text-anchor="end">${dateStr}</text>

  <!-- Name chip -->
  <g transform="translate(80,200)">
    <rect x="0" y="0" rx="18" ry="18" width="520" height="56" fill="#a7f3d0"/>
    <text x="24" y="38" class="chip">👤 ${name}</text>
  </g>

  <!-- Left column -->
  <text x="80" y="340" class="label">Total hours focused this week</text>
  <text x="80" y="440" class="stat">${weeklyHoursStr}</text>

  <text x="80" y="540" class="label">Average Session Length</text>
  <text x="80" y="620" class="sub">${avgStr}</text>

  <!-- Right column -->
  <text x="${width / 2 + 40}" y="340" class="label">Current Streak</text>
  <text x="${width / 2 + 40}" y="440" class="stat" style="font-size:96px">${streak} days</text>

  <!-- Chart label (bars are drawn in canvas overlay for fidelity) -->
  <text x="${width / 2 + 40}" y="540" class="label">Weekly mini chart</text>
</svg>`;
}

async function svgStringToPngBlob(svgString, scale = 2) {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale; canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    return new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.95));
}

async function generateAndDownloadStatsCard(cfg = {}) {
    const dateStr = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
    const name = currentUserData.profileName || 'Floww User';
    const totalMinutes = typeof currentUserData.totalFocusSeconds === 'number'
        ? currentUserData.totalFocusSeconds / 60
        : (currentUserData.totalFocusMinutes || 0);
    const weekly = computeWeeklyRollups();
    const totalSec = (typeof currentUserData.totalFocusSeconds === 'number' ? currentUserData.totalFocusSeconds : (currentUserData.totalFocusMinutes || 0) * 60);
    const totalSessions = currentUserData.totalSessions || 0;
    const avgMinutes = totalSessions > 0 ? Math.round((totalSec / 60) / totalSessions) : 0;
    const opts = {
        name,
        weeklyMinutes: weekly.minutes,
        avgMinutes,
        streak: currentUserData.streakCount || 0,
        series: weekly.series,
        dateStr
    };
    // Build card using fixed template

    const svg = buildStatsSvgTemplate(opts);
    // Render SVG to canvas then overlay logo and optional weekly graph
    let outBlob = null;
    try {
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const baseImg = new Image();
        baseImg.src = svgUrl;
        await new Promise((resolve, reject) => { baseImg.onload = resolve; baseImg.onerror = reject; });
        const w = baseImg.naturalWidth, h = baseImg.naturalHeight;
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = w * scale; canvas.height = h * scale;
        const ctx = canvas.getContext('2d');
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        ctx.drawImage(baseImg, 0, 0);
        URL.revokeObjectURL(svgUrl);

        // Always draw weekly mini graph for the card
        try { drawWeeklyMiniGraph(ctx, w, h, weekly.series); } catch { }
        // Overlay YouFloww logo (card.png) top-left
        try { await drawLogoOverlay(ctx, w, h); } catch { }

        outBlob = await new Promise(res => canvas.toBlob(b => res(b), 'image/png', 0.95));
    } catch (e) {
        console.error('PNG render failed, falling back to SVG download:', e);
    }

    if (outBlob) {
        const file = new File([outBlob], 'youfloww-stats.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], title: 'YouFloww Stats' }); return; } catch { }
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(outBlob);
        a.download = 'youfloww-stats.png';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    } else {
        // Fallback: offer SVG for download so the user still gets a card
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(svgBlob);
        a.download = 'youfloww-stats.svg';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    }
}

function computeWeeklyRollups() {
    const wk = currentUserData.weeklyFocusSeconds || {};
    const ws = currentUserData.weeklySessions || {};
    const keys = [];
    const today = getLocalDateKey();
    const baseDate = dateKeyToLocalDate(today);
    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - i);
        keys.push(getLocalDateKey(d));
    }
    let totalSec = 0, sessions = 0;
    const series = [];
    keys.forEach(k => {
        const sec = Math.max(0, wk[k] || 0);
        totalSec += sec;
        series.push(Math.floor(sec / 60));
        sessions += Math.max(0, ws[k] || 0);
    });
    // Fallback estimate if needed will be handled by caller
    return { minutes: Math.floor(totalSec / 60), sessions, series };
}

async function drawLogoOverlay(ctx, w, h) {
    return new Promise((resolve) => {
        const logo = new Image();
        logo.onload = () => {
            const size = 180; // px
            const pad = 40;
            ctx.globalAlpha = 0.95;
            ctx.drawImage(logo, w - size - pad, pad, size, size);
            ctx.globalAlpha = 1;
            resolve();
        };
        logo.onerror = () => resolve();
        logo.src = 'assets/images/card.png';
    });
}

function drawWeeklyMiniGraph(ctx, w, h, series) {
    // Draw in bottom area
    const gx = 80, gy = h - 220, gw = w - 160, gh = 140;
    // background box
    ctx.fillStyle = 'rgba(34,197,94,0.08)';
    roundRect(ctx, gx - 10, gy - 10, gw + 20, gh + 20, 14, true, false);
    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { const y = gy + gh * (i / 4); ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke(); }
    // bars
    const n = 7; const gap = 20; const barW = (gw - gap * (n - 1)) / n;
    const max = Math.max(30, ...series); // ensure some scale
    for (let i = 0; i < n; i++) {
        const val = series[i] || 0;
        const hpx = (val / max) * gh;
        const x = gx + i * (barW + gap);
        const y = gy + gh - hpx;
        const grad = ctx.createLinearGradient(0, y, 0, y + hpx);
        grad.addColorStop(0, '#22c55e'); grad.addColorStop(1, '#16a34a');
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, barW, hpx, 8, true, false);
    }
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill(); if (stroke) ctx.stroke();
}

// ===================================================================================
// FLOWWWRAP IMAGE (9:16) GENERATOR
// ===================================================================================
async function generateFlowwWrapImage() {
    const W = 1080, H = 1920; // 9:16 portrait
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background: stronger diagonal gradient + bright halo under logo + subtle vignette
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#101a33');
    grad.addColorStop(0.55, '#0b1327');
    grad.addColorStop(1, '#070d1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // Bright halo to improve readability of transparent logo with black text
    const halo = ctx.createRadialGradient(W / 2, 140, 20, W / 2, 140, 360);
    halo.addColorStop(0, 'rgba(255,255,255,0.28)');
    halo.addColorStop(0.45, 'rgba(167,243,208,0.16)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(W / 2, 140, 360, 0, Math.PI * 2); ctx.fill();
    // Subtle edge vignette
    const vignette = ctx.createRadialGradient(W / 2, H * 0.6, H * 0.1, W / 2, H * 0.6, H * 0.9);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);

    // Data
    const name = currentUserData.profileName || 'Floww User';
    const weekly = computeWeeklyRollups();
    const weeklyHoursStr = (weekly.minutes / 60).toFixed(2) + 'h';
    const totalSec = (typeof currentUserData.totalFocusSeconds === 'number' ? currentUserData.totalFocusSeconds : (currentUserData.totalFocusMinutes || 0) * 60);
    const totalSessions = currentUserData.totalSessions || 0;
    const avgMinutes = totalSessions > 0 ? Math.round((totalSec / 60) / totalSessions) : 0;
    const streak = currentUserData.streakCount || 0;
    const longest = currentUserData.longestSession || 0;
    const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' });

    // Logo top, then title
    await drawLogoTopCenter(ctx, W, H, { size: 180, y: 40 });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#a7f3d0'; ctx.font = '900 58px Inter, system-ui, -apple-system';
    ctx.fillText("Week's FlowwWrap", W / 2, 260);

    // Name chip (left) and Date chip (right) in same row
    ctx.textAlign = 'left';
    drawRounded(ctx, 60, 300, 520, 56, 18, '#a7f3d0');
    ctx.fillStyle = '#0b0b0b'; ctx.font = '700 28px Inter, system-ui';
    ctx.fillText(`👤 ${name}`, 84, 338);
    // Date chip right-aligned
    ctx.font = '700 26px Inter, system-ui';
    const tW = ctx.measureText(dateStr).width;
    const chipPadX = 16; const chipW = Math.ceil(tW) + chipPadX * 2; const chipH = 48;
    const chipX = W - 60 - chipW; const chipY = 304;
    ctx.fillStyle = 'rgba(148,163,184,0.18)'; ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, chipX, chipY, chipW, chipH, 14, true, true);
    ctx.fillStyle = '#cbd5e1'; ctx.textAlign = 'left'; ctx.fillText(dateStr, chipX + chipPadX, chipY + 32);

    // Stat cards: 2 columns x 2 rows (remove Weekly Sessions & Best Streak)
    const gapX = 40, gapY = 30;
    const startX = 60, startY = 380;
    const cardW = Math.floor((W - startX * 2 - gapX) / 2);
    const cardH = 220;
    const cards = [
        { title: 'Weekly Focus', value: weeklyHoursStr, sub: 'Total hours (7d)' },
        { title: 'Avg Session', value: (avgMinutes || 0) + 'm', sub: 'Lifetime avg' },
        { title: 'Current Streak', value: `${streak}d`, sub: 'Keep it going!' },
        { title: 'Longest Session', value: (longest || 0) + 'm', sub: 'Deepest focus' },
    ];
    for (let i = 0; i < cards.length; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        drawStatCard(ctx, x, y, cardW, cardH, cards[i]);
    }

    // Weekly bar chart with axes & labels
    const chartY = startY + 2 * (cardH + gapY) + 50;
    drawWeeklyBarChartWithAxes(ctx, 60, chartY, W - 120, 360, weekly.series);

    // Download
    await downloadCanvasAsPNG(canvas, 'youfloww-wrap.png');
}

function drawRounded(ctx, x, y, w, h, r, fillColor) {
    ctx.fillStyle = fillColor;
    if (w < 2 * r) r = w / 2; if (h < 2 * r) r = h / 2;
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
}

function drawStatCard(ctx, x, y, w, h, { title, value, sub }) {
    // Card bg
    ctx.fillStyle = '#2a2a2a'; drawRounded(ctx, x, y, w, h, 12, '#2a2a2a');
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // Top gradient bar
    const g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, '#6c63ff'); g.addColorStop(1, '#f7a047');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, 6);
    // Texts
    ctx.fillStyle = '#a7f3d0'; ctx.font = '700 24px Inter, system-ui'; ctx.textAlign = 'left';
    ctx.fillText(title, x + 16, y + 40);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 48px Inter, system-ui';
    ctx.fillText(value, x + 16, y + 100);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '700 18px Inter, system-ui';
    ctx.fillText(sub, x + 16, y + 140);
}

function drawMiniGraphWide(ctx, x, y, w, h, series) {
    // Deprecated by drawWeeklyBarChartWithAxes, kept for backward-compat
    ctx.fillStyle = 'rgba(34,197,94,0.08)'; drawRounded(ctx, x, y, w, h, 14, 'rgba(34,197,94,0.08)');
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { const yy = y + h * (i / 4); ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    const n = 7, gap = 20, barW = (w - gap * (n - 1)) / n, max = Math.max(30, ...(series || []));
    for (let i = 0; i < n; i++) {
        const val = Math.max(0, (series || [])[i] || 0);
        const hpx = (val / max) * (h - 20);
        const xx = x + i * (barW + gap);
        const yy = y + h - hpx - 10;
        const g = ctx.createLinearGradient(0, yy, 0, yy + hpx);
        g.addColorStop(0, '#22c55e'); g.addColorStop(1, '#16a34a');
        ctx.fillStyle = g; drawRounded(ctx, xx, yy, barW, hpx, 8, g);
    }
}

// New: weekly bar chart with axes, day labels and nicer spacing
function drawWeeklyBarChartWithAxes(ctx, x, y, w, h, series = []) {
    // Layout paddings
    const padTop = 20, padRight = 18, padBottom = 46, padLeft = 76; // reserve space for y-axis labels
    // Container
    const containerFill = ctx.createLinearGradient(x, y, x, y + h);
    containerFill.addColorStop(0, 'rgba(34,197,94,0.06)');
    containerFill.addColorStop(1, 'rgba(34,197,94,0.03)');
    drawRounded(ctx, x, y, w, h, 16, containerFill);

    const cx = x + padLeft, cy = y + padTop, cw = w - padLeft - padRight, ch = h - padTop - padBottom;

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.25;
    // y-axis
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + ch); ctx.stroke();
    // x-axis
    ctx.beginPath(); ctx.moveTo(cx, cy + ch); ctx.lineTo(cx + cw, cy + ch); ctx.stroke();

    // Grid and Y labels in hours
    const minutesMax = Math.max(30, ...series);
    const hoursMax = Math.max(1, Math.ceil(minutesMax / 60));
    const stepHours = Math.max(1, Math.ceil(hoursMax / 4));
    const ticks = [];
    for (let v = 0; v <= stepHours * 4; v += stepHours) ticks.push(v);

    ctx.fillStyle = '#a7f3d0';
    ctx.font = '700 24px Inter, system-ui';
    ctx.textAlign = 'right';

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ticks.forEach(t => {
        const ty = cy + ch - (t * 60 / minutesMax) * ch * (minutesMax > 0 ? 1 : 0);
        ctx.beginPath(); ctx.moveTo(cx, ty); ctx.lineTo(cx + cw, ty); ctx.stroke();
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${t}h`, cx - 10, ty + 6);
    });

    // Bars
    const n = 7; const dayGap = 20; // tighter spacing
    const barW = Math.min(44, (cw - dayGap * (n - 1) - 8) / n);
    const leftOffset = 8; // keep first bar close to y-axis
    const totalBarsWidth = barW * n + dayGap * (n - 1);
    const offset = Math.max(0, Math.min(leftOffset, cw - totalBarsWidth)); // respect bounds
    const barGradient = (yy, hh) => {
        const g = ctx.createLinearGradient(0, yy, 0, yy + hh);
        g.addColorStop(0, '#34d399');
        g.addColorStop(1, '#059669');
        return g;
    };

    // X labels (last 7 days)
    const dayNames = (() => {
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const out = [];
        const base = new Date();
        for (let i = 6; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i); out.push(names[d.getDay()]); }
        return out;
    })();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 20px Inter, system-ui';

    const max = Math.max(1, minutesMax);
    for (let i = 0; i < n; i++) {
        const val = Math.max(0, series[i] || 0);
        const hh = (val / max) * (ch - 6);
        const xx = cx + offset + i * (barW + dayGap);
        const yy = cy + ch - hh;
        ctx.fillStyle = barGradient(yy, hh);
        drawRounded(ctx, xx, yy, barW, hh, 10, ctx.fillStyle);
        // x label
        ctx.fillStyle = '#8ea0b5';
        ctx.fillText(dayNames[i], xx + barW / 2, cy + ch + 28);
    }
}

async function drawLogoTopCenter(ctx, W, H, opts = {}) {
    const { size = 160, y = 20 } = opts;
    // Try multiple candidate paths to avoid path mismatches across builds
    // Bust in-memory cache so we re-evaluate on each card creation
    try { window.__flowwCardLogo = null; window.__flowwCardLogoSrc = null; } catch { }
    const withV = (p) => `${p}?v=${encodeURIComponent(FLOWW_ASSET_VERSION)}`;
    const candidates = [
        withV('assets/images/card.png'),
        withV('images/card.png'),
        withV('/assets/images/card.png'),
        withV('/images/card.png')
    ];
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        let idx = 0;
        const tryNext = () => {
            if (idx >= candidates.length) { resolve(); return; }
            img.src = candidates[idx++];
        };
        const drawIt = () => {
            try { window.__flowwCardLogo = img; window.__flowwCardLogoSrc = img.src; } catch { }
            ctx.globalAlpha = 0.98;
            ctx.drawImage(img, (W - size) / 2, y, size, size);
            ctx.globalAlpha = 1;
            resolve();
        };
        img.onload = drawIt;
        img.onerror = tryNext;
        tryNext();
    });
}

// Version used for cache-busting assets like the share-card logo
const FLOWW_ASSET_VERSION = (() => {
    try {
        // Change this value on deploys to invalidate caches
        return (window.__flowwAssetVersion) || (new Date().toISOString().slice(0, 10));
    } catch { return 'v1'; }
})();

async function downloadCanvasAsPNG(canvas, filename) {
    return new Promise((resolve) => {
        canvas.toBlob((b) => { const a = document.createElement('a'); const url = URL.createObjectURL(b); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); resolve(); }, 'image/png', 0.95);
    });
}

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

    switch (section) {
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
    // Initialize YouTube player controls immediately
    try { initYoutubePlayer(); } catch (e) { console.warn('YouTube init failed:', e); }

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

    const googleBtn = document.getElementById('googleSignInBtn');
    if (googleBtn) googleBtn.addEventListener('click', handleGoogleSignIn);

    // Modal controls
    document.getElementById('statsBtn').addEventListener('click', openStats);

    const shareBtn = document.getElementById('shareStatsBtn');
    if (shareBtn) shareBtn.addEventListener('click', async () => {
        try { await generateFlowwWrapImage(); } catch (e) { console.error('Share failed:', e); alert('Could not generate image.'); }
    });

    // Render weekly report when switching to Weekly tab
    const weeklyTab = document.querySelector('.tab[data-tab="weekly"]');
    if (weeklyTab) weeklyTab.addEventListener('click', () => { try { renderWeeklyReport(); } catch { } });

    // Buy Me a Coffee in-app modal
    const bmcSticky = document.getElementById('openBmcSticky');
    if (bmcSticky) bmcSticky.addEventListener('click', (e) => { e.preventDefault(); openBmcModal(); });
    const bmcClose = document.getElementById('closeBmcModalBtn');
    if (bmcClose) bmcClose.addEventListener('click', closeBmcModal);

    const qrBtn = document.getElementById('openSupportQRBtn');
    if (qrBtn) qrBtn.addEventListener('click', (e) => { e.preventDefault(); openSupportQRModal(); });
    const qrClose = document.getElementById('closeSupportQRBtn');
    if (qrClose) qrClose.addEventListener('click', closeSupportQRModal);
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
            if (tabName === 'timetable') { try { renderTimetableTabEntries(); } catch { } }
            if (tabName === 'journal') { try { renderJournalTabEntries(); } catch { } }
        });
    });

    // To-Do List
    document.getElementById('add-todo-btn').addEventListener('click', addTodo);

    // Regular tasks (Settings)
    const addRT = document.getElementById('addRegularTaskBtn');
    if (addRT) addRT.addEventListener('click', () => {
        const input = document.getElementById('regularTaskInput');
        const name = (input.value || '').trim();
        if (!name) return;
        addRegularTask(name);
        input.value = '';
    });

    // Add Enter key support for regular tasks input
    const regularTaskInput = document.getElementById('regularTaskInput');
    if (regularTaskInput) {
        regularTaskInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const name = (regularTaskInput.value || '').trim();
                if (name) {
                    addRegularTask(name);
                    regularTaskInput.value = '';
                }
            }
        });
    }
    document.getElementById('todo-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });
    { const btn = document.querySelector('.clear-todos-btn'); if (btn) btn.addEventListener('click', clearTodos); }

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

    // Leaderboard tabs
    document.querySelectorAll('.leaderboard-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const boardType = tab.dataset.board;
            switchLeaderboardTab(boardType);
        });
    });

    // Leaderboard CTA (guest prompt)
    if (DOMElements.leaderboard && DOMElements.leaderboard.ctaBtn) {
        DOMElements.leaderboard.ctaBtn.addEventListener('click', () => {
            try {
                if (DOMElements.authModal) DOMElements.authModal.classList.add('visible');
                if (typeof showSignupForm === 'function') {
                    showSignupForm();
                }
            } catch (e) { /* ignore */ }
        });
    }

    // Progress widget
    updateCornerWidget();
    setInterval(updateCornerWidget, 60000);
}

function updateLeaderboardCTA() {
    try {
        const cta = DOMElements.leaderboard && DOMElements.leaderboard.cta;
        if (!cta) return;
        const shouldShow = !auth.currentUser;
        cta.classList.toggle('hidden', !shouldShow);
    } catch (e) { /* ignore */ }
}

// ===================================================================================
// DATA VALIDATION & SECURITY
// ===================================================================================

// Validation constants
const VALIDATION_LIMITS = {
    MAX_SESSION_MINUTES: 480,     // 8 hours max per session
    MAX_DAILY_MINUTES: 1440,      // 24 hours max per day
    MAX_DAILY_SESSIONS: 48,       // Max 48 sessions per day (30min each)
    MAX_STREAK_DAYS: 365,         // 1 year max reasonable streak
    MAX_TOTAL_HOURS: 10000,       // Max lifetime hours (realistic limit)
    MAX_SESSION_COUNT: 100000,    // Max lifetime sessions
    MIN_SESSION_SECONDS: 30,      // Minimum 30 seconds for valid session
};

function validateUserData(data) {
    if (!data || typeof data !== 'object') return data;

    const validated = { ...data };
    const limits = VALIDATION_LIMITS;

    // Validate and cap numeric values to reasonable limits
    if (typeof validated.longestSession === 'number') {
        validated.longestSession = Math.min(Math.max(0, validated.longestSession), limits.MAX_SESSION_MINUTES);
    }

    if (typeof validated.streakCount === 'number') {
        validated.streakCount = Math.min(Math.max(0, validated.streakCount), limits.MAX_STREAK_DAYS);
    }

    if (typeof validated.bestStreak === 'number') {
        validated.bestStreak = Math.min(Math.max(0, validated.bestStreak), limits.MAX_STREAK_DAYS);
    }

    if (typeof validated.totalFocusMinutes === 'number') {
        validated.totalFocusMinutes = Math.min(Math.max(0, validated.totalFocusMinutes), limits.MAX_TOTAL_HOURS * 60);
    }

    if (typeof validated.totalFocusSeconds === 'number') {
        validated.totalFocusSeconds = Math.min(Math.max(0, validated.totalFocusSeconds), limits.MAX_TOTAL_HOURS * 3600);
    }

    if (typeof validated.totalSessions === 'number') {
        validated.totalSessions = Math.min(Math.max(0, validated.totalSessions), limits.MAX_SESSION_COUNT);
    }

    if (typeof validated.todaySessions === 'number') {
        validated.todaySessions = Math.min(Math.max(0, validated.todaySessions), limits.MAX_DAILY_SESSIONS);
    }

    // Validate weekly focus data
    if (validated.weeklyFocusSeconds && typeof validated.weeklyFocusSeconds === 'object') {
        Object.keys(validated.weeklyFocusSeconds).forEach(date => {
            const daySeconds = validated.weeklyFocusSeconds[date];
            if (typeof daySeconds === 'number') {
                validated.weeklyFocusSeconds[date] = Math.min(Math.max(0, daySeconds), limits.MAX_DAILY_MINUTES * 60);
            }
        });
    }

    if (validated.weeklyFocus && typeof validated.weeklyFocus === 'object') {
        Object.keys(validated.weeklyFocus).forEach(date => {
            const dayMinutes = validated.weeklyFocus[date];
            if (typeof dayMinutes === 'number') {
                validated.weeklyFocus[date] = Math.min(Math.max(0, dayMinutes), limits.MAX_DAILY_MINUTES);
            }
        });
    }

    // Validate weekly sessions data
    if (validated.weeklySessions && typeof validated.weeklySessions === 'object') {
        Object.keys(validated.weeklySessions).forEach(date => {
            const daySessions = validated.weeklySessions[date];
            if (typeof daySessions === 'number') {
                validated.weeklySessions[date] = Math.min(Math.max(0, daySessions), limits.MAX_DAILY_SESSIONS);
            }
        });
    }

    // Ensure data consistency
    if (validated.bestStreak < validated.streakCount) {
        validated.bestStreak = validated.streakCount;
    }

    // Additional streak reality check: prevent extreme values that bypass other checks
    if (typeof validated.streakCount === 'number' && validated.streakCount > 50) {
        // For streaks above 50 days, require they make sense relative to account activity
        const todaySessions = validated.todaySessions || 0;
        const totalSessions = validated.totalSessions || 0;

        // If claiming high streak but very few sessions, it's suspicious
        if (totalSessions < validated.streakCount / 2) {
            console.warn('Streak validation: High streak with low session count', {
                streak: validated.streakCount,
                totalSessions: totalSessions
            });
            // Cap to reasonable value based on session count
            validated.streakCount = Math.min(validated.streakCount, Math.max(1, totalSessions));
            validated.bestStreak = Math.max(validated.bestStreak, validated.streakCount);
        }
    }

    // Sync focus minutes and seconds for consistency
    if (typeof validated.totalFocusSeconds === 'number' && typeof validated.totalFocusMinutes === 'number') {
        const calculatedMinutes = Math.floor(validated.totalFocusSeconds / 60);
        if (Math.abs(calculatedMinutes - validated.totalFocusMinutes) > 1) {
            // If there's a significant discrepancy, use seconds as source of truth
            validated.totalFocusMinutes = calculatedMinutes;
        }
    }

    return validated;
}

// Keep only last 7 local-date keys in weekly maps to minimize storage
function pruneWeeklyData() {
    try {
        const today = getLocalDateKey();
        const base = dateKeyToLocalDate(today);
        const keep = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
            keep.push(getLocalDateKey(d));
        }
        const keepSet = new Set(keep);
        const pruneObjKeys = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            Object.keys(obj).forEach(k => { if (!keepSet.has(k)) delete obj[k]; });
        };
        pruneObjKeys(currentUserData.weeklyFocusSeconds);
        pruneObjKeys(currentUserData.weeklyFocus);
        pruneObjKeys(currentUserData.weeklySessions);
        pruneObjKeys(currentUserData.weeklyCompletedSessions);
        pruneObjKeys(currentUserData.weeklyEarlyEndedSessions);
        pruneObjKeys(currentUserData.weeklyAnonymousSeconds);
        pruneObjKeys(currentUserData.weeklyAnonymousSessions);
        // weeklyTaskSecondsByDate is nested: prune top-level dates
        if (currentUserData.weeklyTaskSecondsByDate && typeof currentUserData.weeklyTaskSecondsByDate === 'object') {
            Object.keys(currentUserData.weeklyTaskSecondsByDate).forEach(dateKey => {
                if (!keepSet.has(dateKey)) delete currentUserData.weeklyTaskSecondsByDate[dateKey];
            });
        }
        // weeklyCategorySecondsByDate is nested: prune top-level dates
        if (currentUserData.weeklyCategorySecondsByDate && typeof currentUserData.weeklyCategorySecondsByDate === 'object') {
            Object.keys(currentUserData.weeklyCategorySecondsByDate).forEach(dateKey => {
                if (!keepSet.has(dateKey)) delete currentUserData.weeklyCategorySecondsByDate[dateKey];
            });
        }
        // weeklyCategoryCompletionsByDate is nested: prune top-level dates
        if (currentUserData.weeklyCategoryCompletionsByDate && typeof currentUserData.weeklyCategoryCompletionsByDate === 'object') {
            Object.keys(currentUserData.weeklyCategoryCompletionsByDate).forEach(dateKey => {
                if (!keepSet.has(dateKey)) delete currentUserData.weeklyCategoryCompletionsByDate[dateKey];
            });
        }
    } catch (e) {
        // ignore
    }
}

function validateSessionData(sessionSeconds, sessionStartTime = null) {
    const limits = VALIDATION_LIMITS;

    // Basic session duration validation
    if (typeof sessionSeconds !== 'number' || sessionSeconds < limits.MIN_SESSION_SECONDS) {
        console.warn('Session validation: Duration too short', sessionSeconds);
        return Math.max(limits.MIN_SESSION_SECONDS, sessionSeconds || 0);
    }

    if (sessionSeconds > limits.MAX_SESSION_MINUTES * 60) {
        console.warn('Session validation: Duration too long', sessionSeconds);
        return limits.MAX_SESSION_MINUTES * 60;
    }

    // Timestamp validation if provided
    if (sessionStartTime && typeof sessionStartTime === 'number') {
        const now = Date.now();
        const actualDuration = Math.floor((now - sessionStartTime) / 1000);
        const reportedDuration = Math.floor(sessionSeconds);

        // Allow 10% tolerance for timing differences and pauses
        const tolerance = Math.max(60, actualDuration * 0.1); // At least 1 minute tolerance

        if (Math.abs(actualDuration - reportedDuration) > tolerance) {
            console.warn('Session validation: Time mismatch detected', {
                actual: actualDuration,
                reported: reportedDuration,
                diff: Math.abs(actualDuration - reportedDuration)
            });
            // Use the smaller of the two values to be conservative
            return Math.min(actualDuration, reportedDuration, limits.MAX_SESSION_MINUTES * 60);
        }
    }

    return Math.floor(sessionSeconds);
}

function detectSuspiciousActivity(userData) {
    if (!userData || typeof userData !== 'object') return [];

    const warnings = [];
    const limits = VALIDATION_LIMITS;

    // Check for impossible daily activity
    if (typeof userData.todaySessions === 'number' && userData.todaySessions > limits.MAX_DAILY_SESSIONS) {
        warnings.push(`Excessive daily sessions: ${userData.todaySessions}`);
    }

    // Check daily focus time
    const today = getLocalDateKey();
    if (userData.weeklyFocusSeconds && userData.weeklyFocusSeconds[today]) {
        const todayMinutes = userData.weeklyFocusSeconds[today] / 60;
        if (todayMinutes > limits.MAX_DAILY_MINUTES) {
            warnings.push(`Excessive daily focus time: ${todayMinutes.toFixed(1)} minutes`);
        }
    }

    // Check streak vs account existence (if we have creation date)
    if (userData.createdAt && typeof userData.streakCount === 'number') {
        const accountAgeMs = Date.now() - userData.createdAt;
        const accountAgeDays = Math.floor(accountAgeMs / (24 * 60 * 60 * 1000));

        if (userData.streakCount > accountAgeDays + 1) { // +1 for today
            warnings.push(`Streak longer than account age: ${userData.streakCount} days vs ${accountAgeDays} account age`);
        }
    }

    // Check for unrealistic session lengths
    if (typeof userData.longestSession === 'number' && userData.longestSession > limits.MAX_SESSION_MINUTES) {
        warnings.push(`Unrealistic longest session: ${userData.longestSession} minutes`);
    }

    // Check total focus time vs session count ratio
    if (typeof userData.totalFocusMinutes === 'number' && typeof userData.totalSessions === 'number') {
        if (userData.totalSessions > 0) {
            const avgSessionMinutes = userData.totalFocusMinutes / userData.totalSessions;
            if (avgSessionMinutes > limits.MAX_SESSION_MINUTES) {
                warnings.push(`Unrealistic average session length: ${avgSessionMinutes.toFixed(1)} minutes`);
            }
        }
    }

    // Check for suspicious streak progression
    const streakJump = detectSuspiciousStreakProgression(userData);
    if (streakJump.isSuspicious) {
        warnings.push(`Suspicious streak progression: ${streakJump.reason}`);
    }

    // Log warnings for monitoring (but don't break functionality)
    if (warnings.length > 0) {
        console.warn('Suspicious activity detected:', warnings);
    }

    return warnings;
}

// Track previous streak values for progression validation
let streakHistory = {
    lastKnownStreak: null,
    lastValidationDate: null,
    streakChangeLog: [] // Keep last 10 changes for pattern analysis
};

function detectSuspiciousStreakProgression(userData) {
    const result = { isSuspicious: false, reason: '', action: 'none' };

    if (!userData || typeof userData.streakCount !== 'number') {
        return result;
    }

    const currentStreak = userData.streakCount;
    const today = getLocalDateKey();

    // Initialize streak tracking if first time
    if (streakHistory.lastKnownStreak === null) {
        streakHistory.lastKnownStreak = currentStreak;
        streakHistory.lastValidationDate = today;
        return result;
    }

    // Skip if same day (avoid multiple validations per day)
    if (streakHistory.lastValidationDate === today) {
        return result;
    }

    const previousStreak = streakHistory.lastKnownStreak;
    const streakChange = currentStreak - previousStreak;
    const daysSinceLastCheck = diffLocalDateKeysDays(streakHistory.lastValidationDate, today);

    // Normal progression: streak can only increase by 1 per day maximum
    const maxPossibleIncrease = Math.max(1, daysSinceLastCheck); // Allow catch-up for offline days

    // Detect suspicious jumps
    if (streakChange > maxPossibleIncrease) {
        result.isSuspicious = true;
        result.reason = `Streak jumped from ${previousStreak} to ${currentStreak} in ${daysSinceLastCheck} day(s)`;
        result.action = 'cap_to_realistic';

        // Auto-correct: Set streak to maximum realistic value
        const correctedStreak = previousStreak + maxPossibleIncrease;
        userData.streakCount = correctedStreak;
        userData.bestStreak = Math.max(userData.bestStreak || 0, correctedStreak);

        result.reason += ` - corrected to ${correctedStreak}`;

        console.warn('🚨 Streak manipulation detected and corrected:', {
            previous: previousStreak,
            attempted: currentStreak,
            corrected: correctedStreak,
            daysElapsed: daysSinceLastCheck
        });
    }

    // Check for impossible negative jumps (streak should never decrease unless reset)
    else if (streakChange < -1 && currentStreak > 0) {
        // Streaks can reset to 1, but shouldn't randomly decrease to middle values
        if (currentStreak > 1 && currentStreak < previousStreak - 1) {
            result.isSuspicious = true;
            result.reason = `Unusual streak decrease from ${previousStreak} to ${currentStreak}`;
        }
    }

    // Log streak change for pattern analysis
    streakHistory.streakChangeLog.push({
        date: today,
        from: previousStreak,
        to: currentStreak,
        change: streakChange,
        daysElapsed: daysSinceLastCheck
    });

    // Keep only last 10 changes
    if (streakHistory.streakChangeLog.length > 10) {
        streakHistory.streakChangeLog = streakHistory.streakChangeLog.slice(-10);
    }

    // Detect patterns of manipulation
    if (streakHistory.streakChangeLog.length >= 3) {
        const recentChanges = streakHistory.streakChangeLog.slice(-3);
        const suspiciousJumps = recentChanges.filter(change => change.change > change.daysElapsed).length;

        if (suspiciousJumps >= 2) {
            result.isSuspicious = true;
            result.reason += ' - Pattern of suspicious increases detected';
        }
    }

    // Update tracking
    streakHistory.lastKnownStreak = userData.streakCount; // Use corrected value
    streakHistory.lastValidationDate = today;

    return result;
}

function initializeStreakTracking(userData) {
    if (userData && typeof userData.streakCount === 'number') {
        streakHistory.lastKnownStreak = userData.streakCount;
        streakHistory.lastValidationDate = getLocalDateKey();
        streakHistory.streakChangeLog = [];

        console.log('Streak tracking initialized:', {
            currentStreak: userData.streakCount,
            date: getLocalDateKey()
        });
    }
}

// ===================================================================================
// HELPER FUNCTIONS
// ===================================================================================
let ambientAudio = null;
const ambientCache = {};
let currentAmbientKey = null; // 'sea_waves' | 'fireplace' | 'cafe' | 'nature' | 'thunderstorm' | 'crickets'

function stopAmbientSound() {
    try { if (ambientAudio) ambientAudio.pause(); } catch { }
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
        // Use the existing white noise HTML audio element
        ambientAudio = cfg.el;
        currentAmbientKey = key;
        if (ambientAudio) {
            ambientAudio.currentTime = 0;
            ambientAudio.loop = true;
            ambientAudio.volume = 0.7;
            ambientAudio.play().catch(e => console.error('Ambient play failed:', e));
            if (btn) btn.textContent = '🔇 Stop Noise';
        }
    } else if (cfg.file) {
        // Create or reuse cached Audio objects for specific sound files
        if (!ambientCache[cfg.file]) {
            const a = new Audio(`assets/sounds/${cfg.file}`);
            a.loop = true;
            a.volume = 0.7;
            ambientCache[cfg.file] = a;
        }
        ambientAudio = ambientCache[cfg.file];
        currentAmbientKey = key;

        if (ambientAudio) {
            ambientAudio.currentTime = 0;
            // Play the specific sound file
            ambientAudio.play().then(() => {
                if (btn) btn.textContent = '🔇 Stop Noise';
                console.log(`Playing ${cfg.file}`);
            }).catch(e => {
                console.error(`Failed to play ${cfg.file}:`, e);
                if (btn) btn.textContent = '🎧 Play Noise';
            });
        }
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

async function handleLogout() {
    console.log('\ud83d\udeaa Starting complete logout process...');

    try {
        // Stop all timers and sessions immediately
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        isRunning = false;

        // Stop presence and clean up documents
        console.log('\ud83d\uded1 Stopping presence and cleaning up...');
        await stopPresence();

        // Stop all other services
        stopLeaderboard();

        // Clear all authentication state completely
        console.log('\ud83e\uddfc Clearing all authentication state...');

        // Sign out from Firebase (this will trigger onAuthStateChanged)
        await signOut(auth);

        // Force clear any cached auth state
        localStorage.removeItem('firebase:authUser:[DEFAULT]');
        localStorage.removeItem('firebase:persistence:[DEFAULT]');

        // Clear any anonymous auth tokens that might persist
        const authKeys = Object.keys(localStorage).filter(key => key.includes('firebase') || key.includes('auth'));
        authKeys.forEach(key => {
            console.log('\ud83e\uddfc Clearing auth key:', key);
            localStorage.removeItem(key);
        });

        // Reset application state completely
        currentUserData = getDefaultUserData();
        userDataRef = null;

        console.log('\u2705 Complete logout successful - ready for fresh start');

    } catch (error) {
        console.error('\u274c Logout error:', error);

        // Force logout even if there are errors
        try {
            await signOut(auth);
            localStorage.clear(); // Nuclear option if there are persistent issues
            console.log('\u26a0\ufe0f Forced logout completed with localStorage clear');
        } catch (forceError) {
            console.error('\u274c Even forced logout failed:', forceError);
        }
    }
}

let __googleInProgress = false;
async function handleGoogleSignIn() {
    if (__googleInProgress) return;
    __googleInProgress = true;
    const btn = document.getElementById('googleSignInBtn');
    if (btn) btn.disabled = true;
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });

        // If we already have an anonymous session (started for presence), upgrade it with a POPUP
        if (auth.currentUser && auth.currentUser.isAnonymous) {
            await linkWithPopup(auth.currentUser, provider);
            console.log('Anonymous account upgraded with Google via popup');
        } else {
            // No current user: normal Google sign-in with popup
            await signInWithPopup(auth, provider);
        }
        // onAuthStateChanged will load/merge user data
    } catch (e) {
        console.error('Google sign-in failed:', e);
        if (DOMElements.authError) {
            const map = {
                'auth/unauthorized-domain': 'This domain is not authorized for Google sign-in. Please add it in Firebase console.',
                'auth/popup-blocked': 'Popup was blocked by your browser. Please allow popups for this site and try again.',
                'auth/cancelled-popup-request': 'Another sign-in attempt was in progress. Please try again.',
                'auth/popup-closed-by-user': 'Popup was closed before completing sign-in. Please try again.',
                'auth/operation-not-supported-in-this-environment': 'Popup flow not supported in this environment. Please open in a regular browser window.',
            };
            DOMElements.authError.textContent = map[e.code] || (e && e.message) || 'Google sign-in failed. Please try again.';
        }
    } finally {
        __googleInProgress = false;
        if (btn) btn.disabled = false;
    }
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

    // Start boundaries (local time)
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // End boundaries are exclusive (start of next period) to avoid >100%
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);

    const clamp01 = (v) => Math.max(0, Math.min(1, v));

    const dayP = clamp01((now - startOfDay) / (endOfDay - startOfDay)) * 100;
    const monthP = clamp01((now - startOfMonth) / (endOfMonth - startOfMonth)) * 100;
    const yearP = clamp01((now - startOfYear) / (endOfYear - startOfYear)) * 100;

    // Apply widths (cap at 100%)
    document.getElementById('dayProgressBar').style.width = `${dayP}%`;
    document.getElementById('monthProgressBar').style.width = `${monthP}%`;
    document.getElementById('yearProgressBar').style.width = `${yearP}%`;

    // Display whole percentages
    document.getElementById('dayProgressPercent').textContent = `${Math.round(dayP)}%`;
    document.getElementById('monthProgressPercent').textContent = `${Math.round(monthP)}%`;
    document.getElementById('yearProgressPercent').textContent = `${Math.round(yearP)}%`;
}

function getYoutubeVideoId(url) {
    if (!url) return false;

    // Clean the URL
    url = url.trim();

    // If it's just an ID (11 characters), return it
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        return url;
    }

    // Try multiple regex patterns to support all YouTube URL formats
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    // Fallback: try to extract any 11-character alphanumeric string
    const fallback = url.match(/([a-zA-Z0-9_-]{11})/);
    return fallback ? fallback[1] : false;
}

// Show modal for video player close options
function showVideoCloseOptionsModal() {
    // Remove any existing modal first
    const existingModal = document.querySelector('.video-close-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'modal visible video-close-modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 420px; text-align: center;">
            <h3>🎬 Close Video Player</h3>
            <p>What would you like to do with the video?</p>
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem;">
                <button class="video-option-btn" id="keepAudioBtn" style="
                    background: #4caf50; 
                    color: white; 
                    border: none; 
                    padding: 12px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                ">
                    🎵 Keep Audio Playing (Hide Video)
                </button>
                <button class="video-option-btn" id="stopVideoBtn" style="
                    background: #f44336; 
                    color: white; 
                    border: none; 
                    padding: 12px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                ">
                    ⏹️ Stop Video Completely
                </button>
                <button class="video-option-btn" id="cancelCloseBtn" style="
                    background: #757575; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 400;
                    transition: all 0.2s ease;
                ">
                    Cancel
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add hover effects
    const buttons = modal.querySelectorAll('.video-option-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'translateY(-2px)';
            btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
        });
    });

    // Keep audio playing (hide video player but continue audio)
    document.getElementById('keepAudioBtn').addEventListener('click', () => {
        DOMElements.pipPlayer.container.classList.add('hidden');
        // Keep video playing for audio, don't pause
        console.log('Video hidden, audio continues playing in background');

        // Show a small indicator that audio is playing
        showBackgroundAudioIndicator();

        modal.remove();
    });

    // Stop video completely
    document.getElementById('stopVideoBtn').addEventListener('click', () => {
        DOMElements.pipPlayer.container.classList.add('hidden');
        stopYoutubeAudioSafely();
        hideBackgroundAudioIndicator();
        console.log('Video stopped completely');
        modal.remove();
    });

    // Cancel - keep video player open
    document.getElementById('cancelCloseBtn').addEventListener('click', () => {
        modal.remove();
    });

    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Show background audio indicator (compact tray controls)
function showBackgroundAudioIndicator() {
    // Remove existing indicator first
    hideBackgroundAudioIndicator();

    const indicator = document.createElement('div');
    indicator.id = 'backgroundAudioIndicator';

    // Compute a bottom offset so it sits ABOVE the corner widget (day/month/year bars)
    let bottomOffset = 20; // default fallback
    try {
        const cw = document.getElementById('cornerWidget');
        if (cw) {
            const rect = cw.getBoundingClientRect();
            if (rect.height > 0) bottomOffset = Math.max(20, Math.round(rect.height) + 28);
        }
    } catch { }

    // Determine initial state
    let isPlaying = false;
    try {
        if (youtubePlayer && typeof youtubePlayer.getPlayerState === 'function') {
            isPlaying = youtubePlayer.getPlayerState() === 1; // 1 = playing
        }
    } catch { }

    indicator.innerHTML = `
        <div style="
            position: fixed;
            bottom: ${bottomOffset}px;
            right: 20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px 15px;
            border-radius: 25px;
            display: flex;
            align-items: center;
            gap: 8px;
            z-index: 1000;
            font-size: 14px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
            cursor: pointer;
            transition: all 0.3s ease;
        ">
            <span id="audioEmoji" style="animation: pulse 2s infinite;">🎵</span>
            <span id="audioStatusText">${isPlaying ? 'Audio Playing' : 'Audio Paused'}</span>
            <button id="showVideoBtn" style="
                background: #4caf50;
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                cursor: pointer;
                margin-left: 8px;
            ">Show</button>
            <button id="stopAudioBtn" style="
                background: #f44336;
                border: none;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                cursor: pointer;
            ">Stop</button>
        </div>
    `;

    document.body.appendChild(indicator);

    // Add CSS animation for pulse effect
    if (!document.getElementById('audioIndicatorStyles')) {
        const style = document.createElement('style');
        style.id = 'audioIndicatorStyles';
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.7; transform: scale(1.1); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    const statusTextEl = indicator.querySelector('#audioStatusText');
    const stopBtn = indicator.querySelector('#stopAudioBtn');

    // Show video player button
    indicator.querySelector('#showVideoBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        DOMElements.pipPlayer.container.classList.remove('hidden');
        hideBackgroundAudioIndicator();
    });

    // Stop audio button
    stopBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        try {
            stopYoutubeAudioSafely();
        } catch (err) {
            console.warn('Stop audio failed:', err);
        }
        hideBackgroundAudioIndicator();
    });

    // Click indicator background to show video
    indicator.addEventListener('click', () => {
        DOMElements.pipPlayer.container.classList.remove('hidden');
        hideBackgroundAudioIndicator();
    });
}

// Hide background audio indicator
function hideBackgroundAudioIndicator() {
    const indicator = document.getElementById('backgroundAudioIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Robustly stop the YouTube PiP audio even if player state is quirky
function stopYoutubeAudioSafely() {
    try {
        if (youtubePlayer && typeof youtubePlayer.stopVideo === 'function') {
            youtubePlayer.stopVideo(); // Hard stop
            return;
        }
        if (youtubePlayer && typeof youtubePlayer.pauseVideo === 'function') {
            youtubePlayer.pauseVideo();
            return;
        }
        // Fallback: send postMessage to iframe to pause
        const iframe = document.getElementById('player');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        }
    } catch (e) {
        console.warn('Failed to stop YouTube audio safely:', e);
    }
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
            // Updated parameters to hide suggestions and controls
            container.innerHTML = `<iframe 
src="https://www.youtube.com/embed/${path}?autoplay=1&mute=1&loop=1&playlist=${path}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0&playsinline=1" 
frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
        currentUserData.theme = { backgroundPath: null, youtubeVideoId: path };
    }
    saveUserData();
}

// Wallpaper Gallery Logic
const wallpaperCategories = {
    cars: ['1.jpg'],
    landscapes: ['1.jpg'],
    animals: ['1.jpg'],
    anime: ['1.jpg'],
    cosmic: ['1.jpg']
};

function renderWallpaperGallery(category = 'all') {
    const grid = document.getElementById('wallpaperGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const wallpapers = [];
    if (category === 'all') {
        Object.entries(wallpaperCategories).forEach(([cat, images]) => {
            images.forEach(img => wallpapers.push({ category: cat, file: img }));
        });
    } else if (wallpaperCategories[category]) {
        wallpaperCategories[category].forEach(img => wallpapers.push({ category: category, file: img }));
    }

    wallpapers.forEach(wp => {
        const path = `assets/wallpapers/${wp.category}/${wp.file}`;
        const item = document.createElement('div');
        item.className = 'wallpaper-item';
        if (currentUserData.theme && currentUserData.theme.backgroundPath === path) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <img src="${path}" loading="lazy" alt="${wp.category} wallpaper">
            <div class="check-icon">✓</div>
        `;

        item.addEventListener('click', () => {
            document.querySelectorAll('.wallpaper-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            applyTheme('image', path);
        });

        grid.appendChild(item);
    });
}

function initWallpaperGallery() {
    const tabs = document.querySelectorAll('.gallery-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderWallpaperGallery(tab.dataset.category);
        });
    });
    renderWallpaperGallery('all');
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
                // Updated parameters to hide suggestions and controls
                container.innerHTML = `<iframe src="https://www.youtube.com/embed/${currentUserData.theme.youtubeVideoId}?autoplay=1&mute=1&loop=1&playlist=${currentUserData.theme.youtubeVideoId}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0&playsinline=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            }
        }
    } else {
        // Default to static wallpaper if no theme set
        applyTheme('image', 'assets/wallpapers/default.jpg');
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
        // Toggle canvas visibility for raindrop.js effect
        const rainCanvas = document.getElementById('bg-canvas');
        if (rainCanvas) {
            rainCanvas.style.display = isRainActive ? 'block' : 'none';
        }
        // Rain is now handled entirely by canvas/raindrop.js, no DOM elements needed
    } else if (effect === 'sakura') {
        isSakuraActive = !isSakuraActive;
        if (sakuraBtn) sakuraBtn.classList.toggle('active', isSakuraActive);
        if (!isSakuraActive && DOMElements.ambientContainer) {
            DOMElements.ambientContainer.querySelectorAll('.ambient-effect.sakura').forEach(el => el.remove());
        }
    }

    const anyActive = isSnowActive || isSakuraActive; // Rain doesn't use the DOM loop anymore
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
            el.style.backgroundImage = "url('assets/images/petal.png')";
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
                    splash.style.top = `${H - 6}px`;
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

    // Scroll detection to pause animations
    let isScrolling = false;
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        isScrolling = true;
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 100);
    }, { passive: true });

    let last = performance.now();
    function loop(ts) {
        // Pause animation logic during scroll to prevent jank
        if (isScrolling) {
            last = ts; // Reset last time to avoid huge dt jump
            animationFrameId = requestAnimationFrame(loop);
            return;
        }

        const dt = Math.min(0.05, (ts - last) / 1000);
        last = ts;

        // Spawn per active effect
        const now = ts;
        if (isSnowActive && now - lastSpawnSnow > 200) { // Reduced density (50 -> 200ms)
            lastSpawnSnow = now;
            makeParticle('snowflake');
        }
        // Rain is handled by canvas now

        if (isSakuraActive && now - lastSpawnSakura > 400) { // Reduced density (120 -> 400ms)
            lastSpawnSakura = now;
            makeParticle('sakura');
        }

        update(dt);

        if (isSnowActive || isSakuraActive) {
            animationFrameId = requestAnimationFrame(loop);
        } else {
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
    if (tabName === 'weekly') { try { renderWeeklyReport(); } catch { } }
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

// Weekly time formatting for task analysis
function formatWeeklyTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0m';
    if (totalSeconds >= 3600) {
        const hours = (totalSeconds / 3600);
        return `${hours.toFixed(2)}h`;
    } else if (totalSeconds >= 60) {
        const minutes = Math.round(totalSeconds / 60);
        return `${minutes}m`;
    } else {
        return `${Math.round(totalSeconds)}s`;
    }
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

// ========================= Weekly Report =========================
let __lastWeeklyReport = null;
function buildWeeklyReport() {
    const today = getLocalDateKey();
    const base = dateKeyToLocalDate(today);
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
        days.push(getLocalDateKey(d));
    }
    const gs = (o, k) => (o && typeof o[k] === 'number') ? o[k] : 0;
    const gi = (o, k) => (o && typeof o[k] === 'number') ? o[k] : 0;

    let weeklySec = 0;
    let sessions = 0;
    let completed = 0;
    let early = 0;
    let anonSec = 0;
    let anonSessions = 0;

    days.forEach(k => {
        weeklySec += Math.max(0, gs(currentUserData.weeklyFocusSeconds || {}, k));
        sessions += Math.max(0, gi(currentUserData.weeklySessions || {}, k));
        completed += Math.max(0, gi(currentUserData.weeklyCompletedSessions || {}, k));
        early += Math.max(0, gi(currentUserData.weeklyEarlyEndedSessions || {}, k));
        anonSec += Math.max(0, gs(currentUserData.weeklyAnonymousSeconds || {}, k));
        anonSessions += Math.max(0, gi(currentUserData.weeklyAnonymousSessions || {}, k));
    });

    // Aggregate category seconds and completions across last 7 days
    const categoryTotalsSec = {};
    const catByDate = currentUserData.weeklyCategorySecondsByDate || {};
    days.forEach(k => {
        const m = catByDate[k] || {};
        Object.keys(m).forEach(cid => {
            const sec = Math.max(0, m[cid] || 0);
            categoryTotalsSec[cid] = (categoryTotalsSec[cid] || 0) + sec;
        });
    });
    const categoryTotalsCompletions = {};
    const compByDate = currentUserData.weeklyCategoryCompletionsByDate || {};
    days.forEach(k => {
        const m = compByDate[k] || {};
        Object.keys(m).forEach(cid => {
            const c = Math.max(0, m[cid] || 0);
            categoryTotalsCompletions[cid] = (categoryTotalsCompletions[cid] || 0) + c;
        });
    });

    const regularList = (currentUserData.regularTasks || []).filter(rt => rt && rt.id);
    const dayLabels = days.map(k => {
        const d = dateKeyToLocalDate(k);
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return names[d.getDay()];
    });
    const tasksAll = regularList
        .map(rt => {
            const cid = String(rt.id);
            const totalSec = Math.max(0, Math.round(categoryTotalsSec[cid] || 0));
            const daily = days.map(k => Math.max(0, (catByDate[k] || {})[cid] || 0));
            return {
                id: cid,
                name: rt.name || 'Task',
                seconds: totalSec,
                completions: categoryTotalsCompletions[cid] || 0,
                daily
            };
        });
    // Order: active first, then inactive
    const active = tasksAll.filter(t => (t.completions > 0 || t.seconds > 0))
        .sort((a, b) => (b.completions - a.completions) || (b.seconds - a.seconds));
    const inactive = tasksAll.filter(t => !(t.completions > 0 || t.seconds > 0))
        .sort((a, b) => a.name.localeCompare(b.name));
    const tasks = [...active, ...inactive];

    const avgSessionMin = sessions > 0 ? Math.round((weeklySec / 60) / sessions) : 0;
    const compRate = (completed + early) > 0 ? completed / (completed + early) : 0;
    const disciplineScore = Math.round(compRate * 100);
    let disciplineLabel = '—';
    if ((completed + early) > 0) {
        if (disciplineScore >= 90) disciplineLabel = 'Excellent';
        else if (disciplineScore >= 75) disciplineLabel = 'Strong';
        else if (disciplineScore >= 60) disciplineLabel = 'Moderate';
        else if (disciplineScore >= 40) disciplineLabel = 'Needs Consistency';
        else disciplineLabel = 'Work in Progress';
    }

    return {
        focusMinutes: Math.round(weeklySec / 60),
        sessions,
        avgSessionMinutes: avgSessionMin,
        completionRatePct: Math.round(compRate * 100),
        disciplineScore,
        disciplineLabel,
        tasks,
        dayLabels,
        anonymous: { minutes: Math.round(anonSec / 60), sessions: anonSessions }
    };
}

function renderWeeklyReport() {
    const r = buildWeeklyReport();
    __lastWeeklyReport = r;
    const setText = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    setText('wrFocusTime', formatMinutesPretty(r.focusMinutes));
    setText('wrSessions', String(r.sessions));
    setText('wrAvgSession', formatMinutesPretty(r.avgSessionMinutes));
    setText('wrCompletionRate', `${r.completionRatePct}%`);
    setText('wrDiscipline', `${r.disciplineScore}`);
    setText('wrDisciplineLabel', r.disciplineLabel);

    const list = document.getElementById('weeklyTaskAnalysisList');
    if (list) {
        list.innerHTML = '';
        if (r.tasks.length === 0) {
            const li = document.createElement('li');
            li.classList.add('placeholder');
            li.innerHTML = '<span class="name">No regular tasks added</span><span class="value">Add tasks in Settings</span>';
            list.appendChild(li);
        } else {
            const maxSec = Math.max(1, ...r.tasks.map(t => t.seconds || 0));
            // Determine split between active and inactive
            const hasActive = r.tasks.some(t => (t.completions > 0 || t.seconds > 0));
            r.tasks.forEach((t, idx) => {
                const li = document.createElement('li');
                if (t.completions === 0 && t.seconds === 0) li.classList.add('inactive');
                const timeStr = formatWeeklyTime(t.seconds);
                li.innerHTML = `<span class=\"rank\">${idx + 1}</span><span class=\"name\">${t.name}</span><span class=\"value\">${t.completions} (${timeStr})</span>`;
                // caret for dropdown
                const nameEl = li.querySelector('.name');
                if (nameEl) {
                    const caret = document.createElement('i');
                    caret.className = 'fas fa-chevron-down caret';
                    nameEl.appendChild(caret);
                }
                // mini progress bar
                const bar = document.createElement('div');
                bar.className = 'mini-bar';
                const inner = document.createElement('span');
                const pct = Math.max(0, Math.min(100, (t.seconds / maxSec) * 100));
                inner.style.width = pct + '%';
                bar.appendChild(inner);
                li.appendChild(bar);
                // click to toggle inline dropdown (ignore clicks inside dropdown)
                li.dataset.taskIndex = String(idx);
                li.addEventListener('click', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.weekly-task-dropdown')) return;
                    toggleWeeklyTaskDropdown(idx, li);
                });
                list.appendChild(li);
            });
        }
    }

    const anon = document.getElementById('weeklyAnonymousSummary');
    if (anon) {
        anon.textContent = `${formatMinutesPretty(r.anonymous.minutes)} across ${r.anonymous.sessions} session(s)`;
    }
}

function openWeeklyTaskDrilldown(taskIndex) {
    try {
        const modal = document.getElementById('weeklyTaskDrilldownModal');
        const title = document.getElementById('weeklyDrilldownTitle');
        const list = document.getElementById('weeklyDrilldownDailyList');
        if (!modal || !title || !list) return;
        const r = __lastWeeklyReport;
        if (!r) return;
        const t = r.tasks[taskIndex];
        if (!t) return;
        title.textContent = `${t.name} — weekly breakdown`;
        list.innerHTML = '';
        const days = r.dayLabels || [];
        const d = t.daily || [];
        for (let i = 0; i < days.length; i++) {
            const li = document.createElement('li');
            const timeStr = formatWeeklyTime(d[i] || 0);
            li.innerHTML = `<span class=\"rank\">${i + 1}</span><span class=\"name\">${days[i]}</span><span class=\"value\">${timeStr}</span>`;
            list.appendChild(li);
        }
        // prevent background scroll and show modal
        document.body.classList.add('modal-open');
        modal.classList.add('visible');
    } catch { }
}

// close modal
(function () {
    const btn = document.getElementById('closeWeeklyDrilldownBtn');
    if (btn) btn.addEventListener('click', () => {
        const modal = document.getElementById('weeklyTaskDrilldownModal');
        if (modal) modal.classList.remove('visible');
        document.body.classList.remove('modal-open');
    });
    const overlay = document.getElementById('weeklyTaskDrilldownModal');
    if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('visible');
            document.body.classList.remove('modal-open');
        }
    });
})();

function toggleWeeklyTaskDropdown(taskIndex, liEl) {
    try {
        const r = __lastWeeklyReport; if (!r) return;
        const t = r.tasks[taskIndex]; if (!t) return;
        const container = document.getElementById('weeklyTaskAnalysisList'); if (!container) return;

        // If this one is already open, close it and return
        const existing = liEl.querySelector('.weekly-task-dropdown');
        if (existing) { existing.remove(); liEl.classList.remove('open'); return; }

        // Close others first
        container.querySelectorAll('.weekly-task-dropdown').forEach(dd => { const parent = dd.parentElement; if (parent) parent.classList.remove('open'); dd.remove(); });

        // Build dropdown (no bars, just days and time)
        const dd = document.createElement('div');
        dd.className = 'weekly-task-dropdown';
        const days = r.dayLabels || [];
        const daily = t.daily || [];
        for (let i = 0; i < days.length; i++) {
            const row = document.createElement('div'); row.className = 'day-row';
            const dn = document.createElement('div'); dn.className = 'day-name'; dn.textContent = days[i];
            const spacer = document.createElement('div'); spacer.style.height = '6px'; // visual spacer replacing bar
            const time = document.createElement('div'); time.className = 'day-time'; time.textContent = formatWeeklyTime(daily[i] || 0);
            row.appendChild(dn); row.appendChild(spacer); row.appendChild(time);
            dd.appendChild(row);
        }
        liEl.appendChild(dd);
        // small async to trigger transition
        requestAnimationFrame(() => { dd.classList.add('open'); liEl.classList.add('open'); });
    } catch { }
}

function maybeShowWeeklyReportPopup() {
    try {
        const now = new Date();
        // Sunday in local time
        const isSunday = now.getDay() === 0;
        const key = getLocalDateKey(now);
        const shownKey = localStorage.getItem('youfloww_weekly_popup_shown');
        if (isSunday && shownKey !== key) {
            openStats();
            switchTab('weekly');
            localStorage.setItem('youfloww_weekly_popup_shown', key);
        }
    } catch { }
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
        ? `<div class="streak-anim">🔥 Streak Up! <span>${count}</span> day${count === 1 ? '' : 's'}</div>`
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
                        callback: function (value) { return value + 'h'; }
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

    // Start presence system for everyone (will be properly initialized based on user type)
    console.log('🌟 DOM loaded - starting presence system immediately');

    // Try to start presence multiple times to ensure it works
    const startPresenceWithRetry = (attempt = 1) => {
        console.log(`🔄 Presence start attempt ${attempt}`);

        if (!presenceDocRef) {
            startPresence().then(() => {
                console.log(`✅ Presence started successfully on attempt ${attempt}`);
            }).catch((e) => {
                console.error(`❌ Presence failed on attempt ${attempt}:`, e);
                if (attempt < 3) {
                    setTimeout(() => startPresenceWithRetry(attempt + 1), 2000 * attempt);
                }
            });
        } else {
            console.log('✅ Presence already active');
        }
    };

    // Start immediately
    startPresenceWithRetry(1);

    // Pre-load Accountability Partner model
    if (window.accountabilityPartner) {
        console.log('🚀 Pre-loading Accountability Partner model...');
        window.accountabilityPartner.init().then(() => {
            console.log('✅ Accountability Partner model pre-loaded.');
        }).catch(err => {
            console.warn('⚠️ Accountability Partner model pre-load failed:', err);
        });
    }

    // Also try after a delay in case something wasn't ready
    setTimeout(() => {
        if (!presenceDocRef) {
            console.log('⚡ Retry: Starting presence after delay...');
            startPresenceWithRetry(2);
        }
    }, 3000);

    // Render journal and timetable in Customize modal when opened
    const statsBtn = document.getElementById('statsBtn');
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            renderJournalTabEntries();
            renderTimetableTabEntries();
            initWallpaperGallery(); // Initialize gallery when modal opens
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
        btn.addEventListener('click', async () => {
            const date = btn.getAttribute('data-date');
            if (!confirm('Delete this journal entry?')) return;
            try {
                if (isGuestMode) {
                    if (currentUserData.journalEntries) delete currentUserData.journalEntries[date];
                    saveUserData();
                } else if (userDataRef) {
                    const next = { ...(currentUserData.journalEntries || {}) };
                    delete next[date];
                    await updateDoc(userDataRef, { journalEntries: next });
                    currentUserData.journalEntries = next;
                }
            } catch (e) { console.error('Failed to delete journal entry:', e); }
            renderJournalTabEntries();
            if (typeof loadPreviousJournalEntries === 'function') loadPreviousJournalEntries();
        });
    });
    container.querySelectorAll('.delete-journal-image-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const date = btn.getAttribute('data-date');
            try {
                if (isGuestMode) {
                    if (currentUserData.journalEntries[date]) currentUserData.journalEntries[date].image = null;
                    saveUserData();
                } else if (userDataRef) {
                    const next = { ...(currentUserData.journalEntries || {}) };
                    if (next[date]) next[date] = { ...(next[date]), image: null };
                    await updateDoc(userDataRef, { journalEntries: next });
                    currentUserData.journalEntries = next;
                }
            } catch (e) { console.error('Failed to delete journal image:', e); }
            renderJournalTabEntries();
            if (typeof loadPreviousJournalEntries === 'function') loadPreviousJournalEntries();
        });
    });
}

// Render all timetable slots in the Customize modal's Timetable tab
function renderTimetableTabEntries() {
    const container = document.getElementById('customize-timetable-list');
    if (!container) return;
    let html = '';
    if (!currentUserData.timetable || Object.keys(currentUserData.timetable).length === 0) {
        html = '<p class="timetable-note">No timetable slots added yet.</p>';
    } else {
        // Group by day
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        days.forEach(day => {
            const slots = Object.entries(currentUserData.timetable).filter(([id, slot]) => slot.day === day);
            if (slots.length > 0) {
                html += `<div class=\"timetable-day-group\"><h4>${day.charAt(0).toUpperCase() + day.slice(1)}</h4>`;
                slots.sort((a, b) => a[1].start.localeCompare(b[1].start)).forEach(([id, slot]) => {
                    html += `<div class=\"timetable-slot-item\">`;
                    html += `<span class=\"timetable-slot-time\">${slot.start} - ${slot.end}</span>`;
                    html += `<span class=\"timetable-slot-activity\">${slot.activity}</span>`;
                    html += `<button class=\"delete-timetable-slot-btn\" data-id=\"${id}\"><i class=\"fas fa-trash\"></i></button>`;
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
                    const activeDay = document.querySelector('.day-tab.active');
                    if (activeDay && typeof loadTimetableForDay === 'function') {
                        loadTimetableForDay(activeDay.dataset.day);
                    }
                }
            }
        });
    });
}
