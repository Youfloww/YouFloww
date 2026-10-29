(function () {
  'use strict';
  var APP = 'https://youfloww.vercel.app';
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('yf:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('yf:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var dayKey = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  /* ---------- wallpaper ---------- */
  var WALLS = ['cafe-interior', 'garden-day', 'cafe-window', 'hall', 'cafe-storefront'];
  var wi = store.get('wall', -1);
  function showWall(i) {
    var el = $('bg'); var url = 'img/' + WALLS[i] + '.webp';
    var img = new Image();
    img.onload = function () { el.style.backgroundImage = 'url(' + url + ')'; el.classList.add('on'); };
    img.src = url;
  }
  wi = (wi + 1) % WALLS.length; // a new picture every new tab
  store.set('wall', wi);
  showWall(wi);
  $('bgBtn').addEventListener('click', function () { wi = (wi + 1) % WALLS.length; store.set('wall', wi); showWall(wi); });

  /* ---------- theme ---------- */
  function isDark() { var t = document.documentElement.getAttribute('data-theme'); return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
  function paintTheme() { $('themeBtn').textContent = isDark() ? '☀️' : '🌙'; }
  $('themeBtn').addEventListener('click', function () {
    var t = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t); store.set('theme', t);
    try { localStorage.setItem('yf:theme', t); } catch (e) {}
    paintTheme();
  });
  paintTheme();

  /* ---------- clock + greeting ---------- */
  var greetEl = $('greet'), clockEl = $('clock'), dateEl = $('date');
  function tick() {
    var d = new Date(), h = d.getHours();
    var use24 = false;
    var hh = use24 ? pad(h) : String(h % 12 || 12);
    clockEl.textContent = hh + ':' + pad(d.getMinutes());
    var part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    var name = store.get('name', '');
    greetEl.textContent = part + (name ? ', ' + name : '');
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    document.title = timer.running ? tText() + ' · focus' : 'New Tab';
  }
  greetEl.addEventListener('dblclick', function () {
    var n = prompt('What should I call you?', store.get('name', '')); if (n !== null) { store.set('name', n.trim().slice(0, 20)); tick(); }
  });
  greetEl.title = 'Double-click to set your name';

  /* ---------- search ---------- */
  $('searchForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('q').value.trim(); if (!q) return;
    if (typeof chrome !== 'undefined' && chrome.search && chrome.search.query) chrome.search.query({ text: q, disposition: 'CURRENT_TAB' });
    else location.href = 'https://www.google.com/search?q=' + encodeURIComponent(q);
  });

  /* ---------- today's intention ---------- */
  var intent = store.get('intent', { day: '', text: '', done: false });
  if (intent.day !== dayKey()) intent = { day: dayKey(), text: '', done: false };
  function paintIntent() {
    $('intent').value = intent.text; $('done').checked = intent.done;
    var box = document.querySelector('.intent');
    box.classList.toggle('has', !!intent.text); box.classList.toggle('done-on', intent.done && !!intent.text);
  }
  $('intent').addEventListener('input', function () { intent.text = this.value; intent.day = dayKey(); store.set('intent', intent); paintIntent(); });
  $('intent').addEventListener('keydown', function (e) { if (e.key === 'Enter') this.blur(); });
  $('done').addEventListener('change', function () { intent.done = this.checked; store.set('intent', intent); paintIntent(); if (intent.done) toast('Nicely done ✨'); });
  paintIntent();

  /* ---------- timer (survives closing the tab: stored as an end time) ---------- */
  var C = 326.7;
  var timer = store.get('timer', { min: 25, endAt: 0, running: false, total: 25 * 60000 });
  var ding;
  function remaining() { return timer.running ? Math.max(0, timer.endAt - Date.now()) : timer.total; }
  function tText() { var s = Math.ceil(remaining() / 1000); return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
  function paintTimer() {
    var rem = remaining();
    $('tTime').textContent = tText();
    $('prg').style.strokeDashoffset = String(C * (timer.running ? 1 - rem / timer.total : 0));
    $('ring').classList.toggle('run', timer.running);
    $('tGo').textContent = timer.running ? 'Give up' : 'Start focus';
    $('tReset').hidden = true;
    document.querySelectorAll('.pill').forEach(function (p) {
      var on = +p.dataset.min === timer.min; p.classList.toggle('on', on); p.setAttribute('aria-checked', on); p.disabled = timer.running;
    });
    $('handoff').href = APP + '/?focus=' + timer.min + (intent.text ? '&label=' + encodeURIComponent(intent.text) : '');
  }
  function beep() {
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      [660, 880, 1100].forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.22;
        o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.55);
      });
      setTimeout(function () { ac.close(); }, 1500);
    } catch (e) {}
  }
  function finish() {
    timer.running = false; store.set('timer', timer);
    var done = store.get('count:' + dayKey(), 0) + 1; store.set('count:' + dayKey(), done);
    beep(); toast('Session complete. ' + done + ' today 🌸'); paintTimer();
  }
  $('tGo').addEventListener('click', function () {
    if (timer.running) { timer.running = false; } else { timer.total = timer.min * 60000; timer.endAt = Date.now() + timer.total; timer.running = true; }
    store.set('timer', timer); paintTimer();
  });
  document.querySelectorAll('.pill').forEach(function (p) {
    p.addEventListener('click', function () { if (timer.running) return; timer.min = +p.dataset.min; timer.total = timer.min * 60000; store.set('timer', timer); paintTimer(); });
  });
  if (timer.running && timer.endAt <= Date.now()) { timer.running = false; store.set('timer', timer); }
  setInterval(function () { if (timer.running) { if (Date.now() >= timer.endAt) finish(); else paintTimer(); } tick(); }, 1000);

  /* ---------- quick links ---------- */
  var DEFAULT_LINKS = [
    { n: 'YouFloww', u: APP }, { n: 'Gmail', u: 'https://mail.google.com' }, { n: 'Calendar', u: 'https://calendar.google.com' },
    { n: 'Drive', u: 'https://drive.google.com' }, { n: 'YouTube', u: 'https://www.youtube.com' }
  ];
  var links = store.get('links', DEFAULT_LINKS);
  var COLORS = ['#ff8e72', '#ff76a9', '#8a5cf6', '#4fa7c8', '#e7a93f', '#5fb88a', '#d9719b'];
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return COLORS[h % COLORS.length]; }
  function paintLinks() {
    var nav = $('links'); nav.textContent = '';
    links.forEach(function (l, i) {
      var a = document.createElement('a'); a.className = 'lk'; a.href = l.u;
      var ic = document.createElement('div'); ic.className = 'ic'; ic.style.background = hue(l.n); ic.textContent = (l.n[0] || '?').toUpperCase();
      var n = document.createElement('span'); n.className = 'n'; n.textContent = l.n;
      var x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Remove ' + l.n);
      x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); links.splice(i, 1); store.set('links', links); paintLinks(); });
      a.append(ic, n, x); nav.append(a);
    });
    if (links.length < 10) {
      var b = document.createElement('button'); b.className = 'lk add'; b.type = 'button';
      b.innerHTML = '<div class="ic">+</div><span class="n">Add</span>';
      b.addEventListener('click', function () { $('lName').value = ''; $('lUrl').value = ''; $('linkDlg').showModal(); $('lName').focus(); });
      nav.append(b);
    }
  }
  $('lCancel').addEventListener('click', function () { $('linkDlg').close(); });
  $('linkForm').addEventListener('submit', function () {
    var u = $('lUrl').value.trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    try { new URL(u); } catch (e) { return; }
    links.push({ n: $('lName').value.trim().slice(0, 18) || new URL(u).hostname, u: u }); store.set('links', links); paintLinks();
  });
  paintLinks();

  /* ---------- toast ---------- */
  var tt;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('show'); }, 3000); }

  paintTimer(); tick();
  document.addEventListener('keydown', function (e) { if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('q').focus(); } });
})();
