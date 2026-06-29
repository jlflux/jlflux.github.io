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
  function slotEl(part, ref, projected, isWinner, isLoser, score) {
    var slot = el('div', 'slot');
    if (isWinner) slot.classList.add('winner');
    if (isLoser) slot.classList.add('loser');

    var seed = el('div', 'seed', ref ? A.seedLabel(ref) : '');
    slot.appendChild(seed);

    var team = el('div', 'team');
    var span = el('span');
    if (part && part.bye) {
      slot.classList.add('bye');
      span.textContent = 'BYE';
    } else if (part && part.team && part.team.name) {
      span.textContent = part.team.name;
      if (projected) slot.classList.add('projected');
    } else {
      slot.classList.add('empty');
      span.textContent = ref ? '—' : 'TBD';
    }
    team.appendChild(span);
    slot.appendChild(team);

    var sc = el('div', 'score', (score != null && score !== '') ? String(score) : '');
    slot.appendChild(sc);
    return slot;
  }

  function renderBracket() {
    var host = document.getElementById('view');
    host.innerHTML = '';

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

    var scroll = el('div', 'bracket-scroll');
    var bracket = el('div', 'bracket');

    built.rounds.forEach(function (rnd, rIdx) {
      var col = el('div', 'round-col');
      col.appendChild(el('div', 'round-title', A.roundName(rIdx + 1, built.totalRounds)));
      rnd.forEach(function (g) {
        bracket; // noop
        col.appendChild(gameEl(built, g, projected));
      });
      bracket.appendChild(col);
    });

    // Champion column
    if (built.rounds.length) {
      var finalGame = built.rounds[built.rounds.length - 1][0];
      var champCol = el('div', 'round-col champion-col');
      champCol.appendChild(el('div', 'round-title', 'Champion'));
      var champ = built.winnerOf(finalGame.id, projected);
      var box = el('div', 'champion-box');
      box.appendChild(el('div', 'lbl', 'State Champion'));
      box.appendChild(el('div', 'name', (champ && champ.team && champ.team.name) ? champ.team.name + (projected && !isDecidedFinal(built) ? ' (proj)' : '') : '—'));
      champCol.appendChild(box);
      bracket.appendChild(champCol);
    }

    scroll.appendChild(bracket);
    host.appendChild(scroll);

    host.appendChild(legend());
  }

  function isDecidedFinal(built) {
    var f = built.rounds[built.rounds.length - 1][0];
    var r = built.results[f.id] || {};
    if (r.winner) return true;
    var ts = parseFloat(r.topScore), bs = parseFloat(r.bottomScore);
    return !isNaN(ts) && !isNaN(bs) && ts !== bs;
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

    var topRef = g.top.kind === 'leaf' ? g.top.ref : null;
    var botRef = g.bottom.kind === 'leaf' ? g.bottom.ref : null;

    var topProjected = projected && top && top.team && top.team.name && !res.winner && !hasScores(res);
    var botProjected = projected && bot && bot.team && bot.team.name && !res.winner && !hasScores(res);

    card.appendChild(slotEl(top, topRef, topProjected, topIsWin && decided, decided && botIsWin, res.topScore));
    card.appendChild(slotEl(bot, botRef, botProjected, botIsWin && decided, decided && topIsWin, res.bottomScore));

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
    l.textContent = 'Seeds are shown on the left of each first-round slot (e.g. R4-2 = 2nd place in Region 4). Click any game for date, location, records and ratings. Toggle "Show projected results" to fill the bracket from the ratings index.';
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
    body.appendChild(teamRow(top, g.top, res.topScore, winner && sameParticipant(winner, top)));
    body.appendChild(teamRow(bot, g.bottom, res.bottomScore, winner && sameParticipant(winner, bot)));

    overlay.classList.add('open');
  }
  function metaItem(k, v) {
    var d = el('div');
    d.appendChild(el('span', 'k', k));
    d.appendChild(document.createTextNode(v));
    return d;
  }
  function teamRow(part, slot, score, isWin) {
    var row = el('div', 'matchup-team' + (isWin ? ' win' : ''));
    var name = el('div', 'mt-name');
    if (part && part.bye) name.textContent = 'BYE';
    else if (part && part.team && part.team.name) name.textContent = part.team.name;
    else name.textContent = 'TBD';
    row.appendChild(name);

    var sc = el('div', 'mt-score', (score != null && score !== '') ? String(score) : '');
    row.appendChild(sc);

    var ref = slot.kind === 'leaf' ? slot.ref : null;
    var seed = el('div', 'mt-seed', ref ? 'Seed ' + A.seedLabel(ref) : '');
    row.appendChild(seed);

    var stats = el('div', 'mt-stats');
    var t = part && part.team;
    stats.innerHTML =
      'Overall: <b>' + (t && t.overall ? t.overall : '—') + '</b>' +
      '&nbsp; Region: <b>' + (t && t.region ? t.region : '—') + '</b>' +
      '&nbsp; Rating: <b>' + (t && t.rating !== '' && t.rating != null ? t.rating : '—') + '</b>';
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
        '<th class="center">Region</th><th class="center hide-sm">Rating</th>' +
        '<th class="center">Status</th></tr></thead>';
      var tb = el('tbody');
      reg.teams.forEach(function (t, idx) {
        var tr = el('tr');
        if (idx < cfg.playoff) tr.className = 'qualifies';
        tr.appendChild(el('td', 'seed-cell', String(idx + 1)));
        tr.appendChild(el('td', 'name-cell', t.name || '—'));
        tr.appendChild(el('td', 'center', t.overall || '—'));
        tr.appendChild(el('td', 'center', t.region || '—'));
        tr.appendChild(el('td', 'center hide-sm', (t.rating !== '' && t.rating != null) ? t.rating : '—'));
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
        td0.colSpan = 6; td0.textContent = 'No teams entered yet.'; td0.style.color = 'var(--text-muted)';
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

    A.loadPublic().then(function (data) {
      state.data = data;
      var season = (data.meta && data.meta.season) || '';
      var sEl = document.getElementById('season');
      if (sEl && season) sEl.textContent = season + ' Season';
      render();
    });
  }
  function closeModal() { document.getElementById('modal').classList.remove('open'); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
