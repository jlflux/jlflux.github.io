/* =====================================================================
   ALPreps Bracketology — About page
   ===================================================================== */
(function () {
  'use strict';
  var A = window.AHSAA;

  function initTheme() {
    var saved = localStorage.getItem('ahsaa_theme');
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeBtn(theme);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ahsaa_theme', next);
    updateThemeBtn(next);
  }
  function updateThemeBtn(theme) {
    var btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }

  function init() {
    initTheme();
    document.getElementById('themeBtn').onclick = toggleTheme;

    A.loadPublic().then(function (data) {
      var season = (data.meta && data.meta.season) || '';
      var sEl = document.getElementById('season');
      if (sEl) sEl.textContent = 'AHSAA Football Playoffs' + (season ? ' · ' + season : '');

      var host = document.getElementById('aboutBody');
      var html = A.richTextToHtml(data.aboutHtml || '');
      if (!html.replace(/<br\s*\/?>|\s/gi, '')) {
        host.innerHTML = '';
        host.appendChild(Object.assign(document.createElement('p'), {
          className: 'empty-state',
          textContent: 'Nothing has been written here yet.',
        }));
        return;
      }
      host.innerHTML = html;
      document.title = 'About · ALPreps Bracketology';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
