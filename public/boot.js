// Paint the right theme before React boots: no flash. (A file, not inline, so the CSP needs no 'unsafe-inline'.)
(function () {
  try {
    var p = JSON.parse(localStorage.getItem('floww:prefs') || '{}');
    var t = (p.state && p.state.theme) || 'peach';
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
