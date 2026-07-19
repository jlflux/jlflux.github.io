/* =====================================================================
   AHSAA Football Playoff Brackets — Public site
   ===================================================================== */
(function () {
  'use strict';
  var A = window.AHSAA;

  var state = {
    data: null,
    view: 'brackets',        // 'brackets' | 'standings'
    classKey: A.CLASS_ORDER[0],
    projected: {},           // classKey -> bool
    fit: null,               // current scale-to-fit refs
  };

  /* ---------- Theme ---------- */
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

  /* ---------- Helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function teamName(t) { return t && t.name ? t.name : ''; }

  /* ---------- Render: top-level chrome ---------- */
  function renderNews() {
    var box = document.getElementById('newsBox');
    var note = (state.data.newsNote || '').trim();
    if (!note) { box.className = 'news-box empty'; box.innerHTML = ''; return; }
    box.className = 'news-box';
    box.innerHTML = '';
    box.appendChild(el('h3', null, 'Notes & Tiebreakers'));
    box.appendChild(el('div', 'news-body', note));
  }

  function renderClassNav() {
    var nav = document.getElementById('classNav');
    nav.innerHTML = '';
    A.CLASS_ORDER.forEach(function (key) {
      var cfg = A.CLASS_CONFIG[key];
      var chip = el('button', 'class-chip' + (key === state.classKey ? ' active' : ''));
      chip.innerHTML = cfg.name.replace('Class ', '') + '<span class="grp">' + cfg.group + '</span>';
      chip.title = cfg.name + ' (' + cfg.group + ')';
      chip.onclick = function () { state.classKey = key; render(); };
      nav.appendChild(chip);
    });
  }

  /* ---------- Render: bracket ---------- */
  // The seed shown is the seed of whoever actually occupies the slot, so it
  // travels with the team as it advances. A bye's empty side renders blank.
  function slotEl(part, projected, isWinner, isLoser, score, isHome) {
    var slot = el('div', 'slot');
    if (isWinner) slot.classList.add('winner');
    if (isLoser) slot.classList.add('loser');

    var ref = part && part.ref ? part.ref : null;
    slot.appendChild(el('div', 'seed', ref ? A.seedLabel(ref) : ''));

    var team = el('div', 'team');
    var span = el('span');
    var hasTeam = part && part.team && part.team.name;
    if (part && part.bye) {
      slot.classList.add('blank'); // bye: nothing next to the seeded team
    } else if (hasTeam) {
      span.textContent = part.team.name;
      if (projected) slot.classList.add('projected');
    } else {
      slot.classList.add('empty');
      span.textContent = ref ? '—' : 'TBD';
    }
    team.appendChild(span);
    if (isHome && hasTeam) { var h = el('span', 'home-tag', 'H'); h.title = 'Home'; team.appendChild(h); }
    slot.appendChild(team);

    var sc = el('div', 'score', (score != null && score !== '') ? String(score) : '');
    slot.appendChild(sc);
    return slot;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';

  function renderBracket() {
    var host = document.getElementById('view');
    host.innerHTML = '';
    state.fit = null;

    // header w/ projection toggle
    var head = el('div', 'section-head');
    var cfg = A.CLASS_CONFIG[state.classKey];
    head.appendChild(el('h2', null, cfg.name + ' Playoff Bracket'));
    var lbl = el('label', 'toggle');
    var inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!state.projected[state.classKey];
    inp.onchange = function () { state.projected[state.classKey] = inp.checked; renderBracket(); };
    lbl.appendChild(inp);
    lbl.appendChild(el('span', 'track'));
    lbl.appendChild(el('span', null, 'Show projected results'));
    head.appendChild(lbl);
    host.appendChild(head);

    var projected = !!state.projected[state.classKey];
    var built = A.buildClassification(state.data, state.classKey);

    var outer = el('div', 'bracket-fit');
    var inner = el('div', 'bracket-fit-inner');

    // Round titles across the top, one per column (plus Champion).
    var titles = el('div', 'bracket-titles');
    built.rounds.forEach(function (rnd, i) {
      titles.appendChild(el('div', 'col-title', A.roundName(i + 1, built.totalRounds)));
    });
    inner.appendChild(titles);

    var bracket = el('div', 'bracket');
    var cardMap = {};
    built.rounds.forEach(function (rnd, rIdx) {
      var col = el('div', 'round-col' + (rIdx === 0 ? ' first' : ''));
      rnd.forEach(function (g) {
        var ge = gameEl(built, g, projected);
        cardMap[g.id] = ge; // wrapper; offsetParent is .bracket
        col.appendChild(ge);
      });
      bracket.appendChild(col);
    });

    inner.appendChild(bracket);
    outer.appendChild(inner);
    host.appendChild(outer);
    host.appendChild(legend());

    // Connectors are measured in natural (pre-scale) coordinates.
    drawConnectors(bracket, built, cardMap);

    state.fit = { outer: outer, inner: inner };
    applyFit();
  }

  function drawConnectors(bracketEl, built, cardMap) {
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'bracket-conn');
    svg.setAttribute('width', bracketEl.scrollWidth);
    svg.setAttribute('height', bracketEl.scrollHeight);

    function line(x1, y1, x2, y2) {
      var midX = (x1 + x2) / 2;
      var p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', 'M' + x1 + ' ' + y1 + ' H' + midX + ' V' + y2 + ' H' + x2);
      p.setAttribute('class', 'conn-path');
      svg.appendChild(p);
    }
    function rightMid(elm) { return [elm.offsetLeft + elm.offsetWidth, elm.offsetTop + elm.offsetHeight / 2]; }
    function leftMid(elm) { return [elm.offsetLeft, elm.offsetTop + elm.offsetHeight / 2]; }

    built.rounds.forEach(function (rnd, ri) {
      if (ri === 0) return; // first-round slots are seeds, no incoming line
      rnd.forEach(function (g) {
        [g.top, g.bottom].forEach(function (slot) {
          if (slot.kind !== 'game') return;
          var child = cardMap[slot.ref], parent = cardMap[g.id];
          if (!child || !parent) return;
          var a = rightMid(child), b = leftMid(parent);
          line(a[0], a[1], b[0], b[1]);
        });
      });
    });

    bracketEl.insertBefore(svg, bracketEl.firstChild);
  }

  function applyFit() {
    if (!state.fit) return;
    var inner = state.fit.inner, outer = state.fit.outer;
    inner.style.transform = 'none';
    var naturalW = inner.offsetWidth;
    var naturalH = inner.offsetHeight;
    if (!naturalW) return;
    var scale = Math.min(1, outer.clientWidth / naturalW);
    inner.style.transform = 'scale(' + scale + ')';
    outer.style.height = Math.ceil(naturalH * scale) + 'px';
  }


  function gameEl(built, g, projected) {
    var wrap = el('div', 'game');
    var card = el('div', 'game-card');

    var top = built.resolveSlot(g.top, projected);
    var bot = built.resolveSlot(g.bottom, projected);
    var res = built.results[g.id] || {};
    var winner = built.winnerOf(g.id, projected);

    var topIsWin = winner && top && sameParticipant(winner, top);
    var botIsWin = winner && bot && sameParticipant(winner, bot);
    var decided = !!winner && !(top && top.bye) && !(bot && bot.bye);

    var topProjected = projected && top && top.team && top.team.name && !res.winner && !hasScores(res);
    var botProjected = projected && bot && bot.team && bot.team.name && !res.winner && !hasScores(res);

    card.appendChild(slotEl(top, topProjected, topIsWin && decided, decided && botIsWin, res.topScore, res.home === 'top'));
    card.appendChild(slotEl(bot, botProjected, botIsWin && decided, decided && topIsWin, res.bottomScore, res.home === 'bottom'));

    card.onclick = function () { openGameModal(built, g, top, bot, projected); };
    wrap.appendChild(card);
    return wrap;
  }

  function hasScores(res) {
    var ts = parseFloat(res.topScore), bs = parseFloat(res.bottomScore);
    return !isNaN(ts) && !isNaN(bs);
  }
  function sameParticipant(a, b) {
    if (!a || !b) return false;
    if (a.team && b.team) return a.team === b.team || (a.team.id && a.team.id === b.team.id);
    return a === b;
  }

  function legend() {
    var l = el('div', 'hint');
    l.style.marginTop = '12px';
    l.textContent = 'Seeds are shown on the left of each first-round slot (e.g. R4-2 = 2nd place in Region 4). Click any game for date, location and team records. Toggle "Show projected results" to see the projected bracket.';
    return l;
  }

  /* ---------- Game modal ---------- */
  function openGameModal(built, g, top, bot, projected) {
    var overlay = document.getElementById('modal');
    var body = document.getElementById('modalBody');
    var title = document.getElementById('modalTitle');
    title.textContent = A.roundName(g.round, built.totalRounds);
    body.innerHTML = '';

    var res = built.results[g.id] || {};

    var meta = el('div', 'game-meta');
    meta.appendChild(metaItem('Date', res.date || 'TBD'));
    meta.appendChild(metaItem('Time', res.time || 'TBD'));
    meta.appendChild(metaItem('Location', res.location || 'TBD'));
    body.appendChild(meta);
    if (res.note) {
      var n = el('div', 'hint', res.note);
      n.style.marginBottom = '10px';
      body.appendChild(n);
    }

    var winner = built.winnerOf(g.id, projected);
    body.appendChild(teamRow(top, res.topScore, winner && sameParticipant(winner, top), res.home === 'top'));
    body.appendChild(teamRow(bot, res.bottomScore, winner && sameParticipant(winner, bot), res.home === 'bottom'));

    overlay.classList.add('open');
  }
  function metaItem(k, v) {
    var d = el('div');
    d.appendChild(el('span', 'k', k));
    d.appendChild(document.createTextNode(v));
    return d;
  }
  function teamRow(part, score, isWin, isHome) {
    var row = el('div', 'matchup-team' + (isWin ? ' win' : ''));
    var name = el('div', 'mt-name');
    if (part && part.bye) name.textContent = '—';
    else if (part && part.team && part.team.name) name.textContent = part.team.name + (isHome ? ' (H)' : '');
    else name.textContent = 'TBD';
    row.appendChild(name);

    var sc = el('div', 'mt-score', (score != null && score !== '') ? String(score) : '');
    row.appendChild(sc);

    var ref = part && part.ref ? part.ref : null;
    var seed = el('div', 'mt-seed', ref ? 'Seed ' + A.seedLabel(ref) : '');
    row.appendChild(seed);

    var stats = el('div', 'mt-stats');
    var t = part && part.team;
    stats.innerHTML =
      'Overall: <b>' + (t && t.overall ? t.overall : '—') + '</b>' +
      '&nbsp; Region: <b>' + (t && t.region ? t.region : '—') + '</b>';
    row.appendChild(stats);
    return row;
  }

  /* ---------- Standings ---------- */
  function renderStandings() {
    var host = document.getElementById('view');
    host.innerHTML = '';
    var cfg = A.CLASS_CONFIG[state.classKey];
    var head = el('div', 'section-head');
    head.appendChild(el('h2', null, cfg.name + ' Region Standings'));
    host.appendChild(head);

    var cl = state.data.classifications[state.classKey];
    var grid = el('div', 'standings-grid');

    var ids = [];
    for (var i = 1; i <= cfg.regionCount; i++) ids.push(String(i));

    ids.forEach(function (rid) {
      var reg = cl.regions[rid];
      var card = el('div', 'region-card');
      card.appendChild(el('h3', null, 'Region ' + rid));

      var table = el('table', 'standings-table');
      table.innerHTML =
        '<thead><tr>' +
        '<th></th><th>Team</th><th class="center">Overall</th>' +
        '<th class="center">Region</th>' +
        '<th class="center">Status</th></tr></thead>';
      var tb = el('tbody');
      reg.teams.forEach(function (t, idx) {
        var tr = el('tr');
        if (idx < cfg.playoff) tr.className = 'qualifies';
        tr.appendChild(el('td', 'seed-cell', String(idx + 1)));
        tr.appendChild(el('td', 'name-cell', t.name || '—'));
        tr.appendChild(el('td', 'center', t.overall || '—'));
        tr.appendChild(el('td', 'center', t.region || '—'));
        var stTd = el('td', 'center');
        var opt = A.STATUS_OPTIONS.filter(function (o) { return o.key === t.status; })[0];
        if (opt) {
          var pill = el('span', 'status-pill status-' + opt.key, opt.label);
          stTd.appendChild(pill);
        }
        tr.appendChild(stTd);
        tb.appendChild(tr);
      });
      if (!reg.teams.length) {
        var tr0 = el('tr');
        var td0 = el('td', 'center');
        td0.colSpan = 5; td0.textContent = 'No teams entered yet.'; td0.style.color = 'var(--text-muted)';
        tr0.appendChild(td0); tb.appendChild(tr0);
      }
      table.appendChild(tb);
      card.appendChild(table);

      if (reg.note && reg.note.trim()) {
        var note = el('div', 'region-note');
        note.appendChild(el('span', 'lbl', 'Region picture'));
        note.appendChild(document.createTextNode(reg.note));
        card.appendChild(note);
      }
      grid.appendChild(card);
    });

    host.appendChild(grid);
    var hint = el('div', 'hint');
    hint.style.marginTop = '14px';
    hint.textContent = 'Highlighted rows are in current playoff position (top ' + cfg.playoff + ' per region). Top ' + cfg.playoff + ' seeds feed directly into the bracket.';
    host.appendChild(hint);
  }

  /* ---------- Master render ---------- */
  function render() {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.view === state.view);
    });
    renderNews();
    renderClassNav();
    if (state.view === 'brackets') renderBracket();
    else renderStandings();
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    document.getElementById('themeBtn').onclick = toggleTheme;
    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () { state.view = t.dataset.view; render(); };
    });
    document.getElementById('modalClose').onclick = closeModal;
    document.getElementById('modal').onclick = function (e) {
      if (e.target.id === 'modal') closeModal();
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(function () { if (state.view === 'brackets') applyFit(); }, 120);
    });

    A.loadPublic().then(function (data) {
      state.data = data;
      var season = (data.meta && data.meta.season) || '';
      var sEl = document.getElementById('season');
      if (sEl) sEl.textContent = 'AHSAA Football Playoffs' + (season ? ' · ' + season : '');
      render();
    });
  }
  function closeModal() { document.getElementById('modal').classList.remove('open'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
