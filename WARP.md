# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview

YouFloww V2 is a static, client-side web app (no build system) that serves a Pomodoro-focused productivity experience with optional account sync. It runs entirely in the browser and loads dependencies via CDNs. Key features include:
- Timer with work/break cycles, streaks, and stats
- To-do list (with subtasks, confetti), journal, timetable
- Accountability AI using face-api.js and MoveNet pose detection (camera access required)
- YouTube PiP player and ambient effects
- Optional “disk player” for background music
- Firebase-powered auth, Firestore persistence, public leaderboard projection, and Analytics
- PWA manifest and assets for installable experience

Common commands

Local development (no build required)
- Serve the directory over HTTP (required for camera, modules, and PWA behaviors):
  - macOS with Python (preinstalled):
    - python3 -m http.server 8080
    - Then open http://localhost:8080/index.html
  - Optional Node.js alternative (if Node is installed):
    - npx serve -l 8080
    - Then open http://localhost:8080/index.html

Notes
- file:// will break getUserMedia, module imports, and some PWA functionality. Always use http://localhost.
- Camera features (Accountability AI) require granting camera permissions in the browser.
- There is no build, lint, or test tooling configured in this repo.

High-level architecture

Entry points and assets
- index.html: Single-page UI layout, links to style.css and loads script.js as an ES module. Also includes:
  - PWA manifest (manifest.json) and favicon
  - Google Analytics tag
  - Structured data for SEO
  - CDN scripts: Chart.js, face-api.js, TensorFlow.js, @tensorflow-models/pose-detection, YouTube IFrame API
- script.js: All app logic (modularized via sections within one file)
- style.css: Global styling and component styles
- assets/: Images (e.g., assets/images/disk.png) and audio (sound effects and ambience)
- sitemap.xml: Basic sitemap for SEO

State and data flow
- Auth/persistence
  - Firebase Auth: Email/password sign up and login
  - Firestore: Per-user document under users/{uid}; public leaderboard documents under publicUsers/{uid}
  - Analytics: Firebase Analytics initialized on load
  - Guest mode: Uses localStorage key youfloww_guest for persistence when not logged in
- App state
  - currentUserData holds user-facing state: totals, streaks, longest session, today’s sessions, weeklyFocus map, todos (with subtasks), journalEntries, timetable, and settings
  - settings include timer durations, sound profile selection, and Accountability AI toggle
  - State is read/written to Firestore if authenticated, otherwise to localStorage in guest mode
  - On session end, code updates both per-user doc and the publicUsers projection for the leaderboard

Timer lifecycle
- startTimer/pauseTimer/resetTimer manage the countdown and UI state
- handleSessionCompletion and handleEndOfWorkSession record focus minutes, update totals/streaks, and queue sounds
- Break logic alternates short/long breaks based on sessionCount
- Title updates reflect timer status; progress bars update from elapsed time

Accountability AI pipeline
- Face detection: face-api.js tiny face detector (models loaded from CDN)
- Pose detection: MoveNet via @tensorflow-models/pose-detection
- Camera access via getUserMedia; detection runs on intervals during work sessions when enabled
- If no presence detected for 30s, timer auto-pauses and UI displays a prompt; presence resumes the timer if last pause wasn’t manual

UI composition
- index.html defines major sections:
  - Auth modal (signup/login/guest mode)
  - Main app container with Timer, To-Do, Ambience controls, Quote of the day, Leaderboard
  - Modal-based secondary areas: Stats (with Chart.js charts), Store (themes/backgrounds), Settings (durations, sound, accountability), Profile, Journal, Timetable
  - PiP YouTube player (draggable/resizable) and ambient/canvas effects (gravity particles, star trails, loader overlay)
  - macOS-style dock for navigation between sections

External dependencies (loaded at runtime)
- Firebase app/auth/firestore/analytics (versioned ES modules from https://www.gstatic.com)
- Chart.js via CDN
- face-api.js via CDN (models hosted on jsDelivr)
- TensorFlow.js and @tensorflow-models/pose-detection via CDN
- YouTube IFrame API
- Google Analytics tag

Where to modify things
- UI markup: index.html
- Behavior/state: script.js (look for section headers like CORE TIMER LOGIC, FIREBASE AUTH & DATA, ACCOUNTABILITY AI)
- Styles/themes: style.css and assets (images/audio)
- PWA metadata/icons: manifest.json, assets/images

Repository docs and rules
- README.md: minimal placeholder; no additional operational guidance
- No CLAUDE, Cursor, or Copilot rule files found
