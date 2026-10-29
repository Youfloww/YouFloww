// Runs before first paint so the page never flashes the wrong theme.
try {
  var t = localStorage.getItem('yf:theme');
  if (t) document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
