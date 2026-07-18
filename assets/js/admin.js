/* =====================================================================
   AHSAA Football Playoff Brackets — Admin suite
   ---------------------------------------------------------------------
   NOTE: GitHub Pages is static, so this login is a client-side gate only
   (it keeps the editor out of the way, it is not real server security).
   Edits are saved to localStorage; use Export JSON -> commit data/data.json
   to publish.
   ===================================================================== */
(function () {
  'use strict';
  var A = window.AHSAA;

  var ADMIN_EMAIL = 'jl@fluxmedia.org';
  var ADMIN_PASSWORD = 'alpreps2026';
  var SESSION_KEY = 'ahsaa_admin_session';

  var state = {
    data: null,
    classKey: A.CLASS_ORDER[0],
    section: 'standings', // 'standings' | 'bracket'
  };

  /* ---------- Theme (shared behaviour) ---------- */
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

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- Auth ---------- */
  function isAuthed() { return sessionStorage.getItem(SESSION_KEY) === '1'; }
  function showLogin() {
    document.getElementById('loginView').style.display = '';
    document.getElementById('adminView').style.display = 'none';
  }
  function showAdmin() {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('adminView').style.display = '';
    loadAndRender();
  }
  function attemptLogin() {
    var email = document.getElementById('loginEmail').value.trim().toLowerCase();
    var pass = document.getElementById('loginPass').value;
    var err = document.getElementById('loginError');
    if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1');
      err.textContent = '';
      showAdmin();
    } else {
      err.textContent = 'Incorrect email or password.';
    }
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  }

  /* ---------- Data load / save ---------- */
  function loadAndRender() {
    var local = A.loadLocal();
    if (local) { state.data = local; renderAll(); return; }
    A.fetchPublished().then(function (d) { state.data = d; renderAll(); });
  }
  function save(banner) {
    A.saveLocal(state.data);
    if (banner !== false) flash('Saved to this browser. Use Export JSON to publish.');
  }
  function flash(msg) {
    var b = document.getElementById('statusBanner');
    b.textContent = msg;
    b.className = 'status-banner ok show';
    clearTimeout(flash._t);
    flash._t = setTimeout(function () { b.className = 'status-banner'; }, 2600);
  }

  /* ---------- Export / Import ---------- */
  function exportJSON() {
    state.data.meta = state.data.meta || {};
    state.data.meta.updated = new Date().toISOString();
    var blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'data.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flash('Exported data.json — commit it to data/data.json to publish.');
  }
  function copyJSON() {
    var txt = JSON.stringify(state.data, null, 2);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () { flash('Copied JSON to clipboard.'); });
    } else {
      flash('Clipboard unavailable — use Export instead.');
    }
  }
  function importJSON(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        state.data = A.migrate(parsed);
        save(false);
        renderAll();
        flash('Imported data successfully.');
      } catch (e) {
        flash('Import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
  }
  function resetToPublished() {
    if (!confirm('Discard local changes and reload the published data.json?')) return;
    A.clearLocal();
    A.fetchPublished().then(function (d) { state.data = d; renderAll(); flash('Reloaded published data.'); });
  }

  /* ---------- Render: chrome ---------- */
  function renderClassTabs() {
    var host = document.getElementById('adminClassTabs');
    host.innerHTML = '';
    A.CLASS_ORDER.forEach(function (key) {
      var cfg = A.CLASS_CONFIG[key];
      var chip = el('button', 'class-chip' + (key === state.classKey ? ' active' : ''));
      chip.innerHTML = cfg.name.replace('Class ', '') + '<span class="grp">' + cfg.group + '</span>';
      chip.onclick = function () { state.classKey = key; renderBody(); };
      host.appendChild(chip);
    });
  }
  function renderSectionTabs() {
    document.querySelectorAll('.admin-section-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.section === state.section);
    });
  }

  /* ---------- Render: News ---------- */
  function renderNews() {
    var ta = document.getElementById('newsInput');
    ta.value = state.data.newsNote || '';
    ta.oninput = function () { state.data.newsNote = ta.value; save(false); };
    var season = document.getElementById('seasonInput');
    season.value = (state.data.meta && state.data.meta.season) || '';
    season.oninput = function () { state.data.meta = state.data.meta || {}; state.data.meta.season = season.value; save(false); };
  }

  /* ---------- Render: Standings editor ---------- */
  function renderStandings() {
    var host = document.getElementById('adminBody');
    var cfg = A.CLASS_CONFIG[state.classKey];
    var cl = state.data.classifications[state.classKey];

    var intro = el('p', 'hint', 'Drag the ⠿ handle to reorder teams — order = seed (top ' + cfg.playoff + ' qualify and feed the bracket). Edit records and status inline. Add per-region notes at the bottom of each panel.');
    host.appendChild(intro);

    var ids = [];
    for (var i = 1; i <= cfg.regionCount; i++) ids.push(String(i));

    ids.forEach(function (rid) {
      var reg = cl.regions[rid];
      var panel = el('div', 'panel');
      panel.appendChild(el('h3', null, 'Region ' + rid));

      var table = el('table', 'admin-table');
      table.innerHTML =
        '<thead><tr>' +
        '<th></th><th>Seed</th><th>Team</th>' +
        '<th class="col-narrow">Overall</th><th class="col-narrow">Region</th>' +
        '<th class="col-status">Status</th><th></th>' +
        '</tr></thead>';
      var tb = el('tbody');
      tb.dataset.rid = rid;
      reg.teams.forEach(function (t, idx) {
        tb.appendChild(teamRow(reg, t, idx, rid));
      });
      table.appendChild(tb);
      panel.appendChild(table);
      enableRowDrag(tb, reg);

      var addBtn = el('button', 'btn btn-sm', '+ Add team');
      addBtn.style.marginTop = '8px';
      addBtn.onclick = function () {
        reg.teams.push({ id: 'tm_' + Math.random().toString(36).slice(2, 9), name: '', overall: '', region: '', rating: '', status: 'medium' });
        save(false); renderBody();
      };
      panel.appendChild(addBtn);

      var noteField = el('div', 'field');
      noteField.style.marginTop = '14px';
      noteField.appendChild(el('label', null, 'Region picture / notes'));
      var ta = el('textarea');
      ta.value = reg.note || '';
      ta.placeholder = 'Notes about the current region picture, tiebreakers, key games…';
      ta.oninput = function () { reg.note = ta.value; save(false); };
      noteField.appendChild(ta);
      panel.appendChild(noteField);

      host.appendChild(panel);
    });
  }

  function teamRow(reg, t, idx, rid) {
    var tr = el('tr');
    tr.draggable = false;
    tr.dataset.idx = idx;

    var drag = el('td', 'drag-cell', '⠿');
    drag.title = 'Drag to reorder';
    drag.draggable = true;
    tr.appendChild(drag);

    tr.appendChild(el('td', null, String(idx + 1)));

    tr.appendChild(inputCell(t, 'name', 'text', 'Team name'));
    tr.appendChild(inputCell(t, 'overall', 'text', '0-0'));
    tr.appendChild(inputCell(t, 'region', 'text', '0-0'));

    var stTd = el('td');
    var sel = document.createElement('select');
    A.STATUS_OPTIONS.forEach(function (o) {
      var op = document.createElement('option');
      op.value = o.key; op.textContent = o.label;
      if (t.status === o.key) op.selected = true;
      sel.appendChild(op);
    });
    sel.onchange = function () { t.status = sel.value; save(false); };
    stTd.appendChild(sel);
    tr.appendChild(stTd);

    var delTd = el('td', 'col-actions');
    var del = el('button', 'btn btn-sm btn-danger', '✕');
    del.title = 'Remove team';
    del.onclick = function () {
      if (!confirm('Remove ' + (t.name || 'this team') + '?')) return;
      var i = reg.teams.indexOf(t);
      if (i >= 0) reg.teams.splice(i, 1);
      save(false); renderBody();
    };
    delTd.appendChild(del);
    tr.appendChild(delTd);

    // drag handle wiring stored on the row
    drag._row = tr;
    return tr;
  }

  function inputCell(obj, key, type, ph) {
    var td = el('td');
    var inp = document.createElement('input');
    inp.type = type;
    if (type === 'number') inp.step = 'any';
    inp.value = obj[key] != null ? obj[key] : '';
    inp.placeholder = ph || '';
    inp.oninput = function () { obj[key] = inp.value; save(false); };
    td.appendChild(inp);
    return td;
  }

  function enableRowDrag(tbody, reg) {
    var dragIdx = null;
    tbody.querySelectorAll('td.drag-cell').forEach(function (handle) {
      var row = handle.parentNode;
      handle.addEventListener('dragstart', function (e) {
        dragIdx = parseInt(row.dataset.idx, 10);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dragIdx));
      });
      handle.addEventListener('dragend', function () {
        row.classList.remove('dragging');
        tbody.querySelectorAll('tr').forEach(function (r) { r.classList.remove('drag-over'); });
      });
    });
    tbody.querySelectorAll('tr').forEach(function (row) {
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        row.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
      });
      row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        row.classList.remove('drag-over');
        var from = dragIdx;
        var to = parseInt(row.dataset.idx, 10);
        if (from == null || isNaN(to) || from === to) return;
        var moved = reg.teams.splice(from, 1)[0];
        reg.teams.splice(to, 0, moved);
        save(false);
        renderBody();
      });
    });
  }

  /* ---------- Render: Bracket editor (drag seeds + click a game) ------- */
  function renderBracket() {
    var host = document.getElementById('adminBody');
    var cl = state.data.classifications[state.classKey];

    var panel = el('div', 'panel');
    panel.appendChild(el('h3', null, 'Bracket & Results'));
    panel.appendChild(el('p', 'hint', 'Drag a seed (e.g. R4-2) onto another slot to arrange the first round — the team follows your region standings, so if the standings order changes the slot updates too. Click a match-up (anywhere except the seed) to enter score, home/away, date, time and location.'));

    var built = A.buildClassification(state.data, state.classKey);

    var scroll = el('div');
    scroll.style.overflowX = 'auto';
    scroll.style.paddingBottom = '12px';
    var inner = el('div');
    inner.style.display = 'inline-block';

    var titles = el('div', 'bracket-titles');
    built.rounds.forEach(function (rnd, i) {
      titles.appendChild(el('div', 'col-title', A.roundName(i + 1, built.totalRounds)));
    });
    inner.appendChild(titles);

    var bracket = el('div', 'bracket');
    built.rounds.forEach(function (rnd, rIdx) {
      var col = el('div', 'round-col' + (rIdx === 0 ? ' first' : ''));
      rnd.forEach(function (g, gi) { col.appendChild(adminGameEl(built, g, gi, rIdx === 0, cl)); });
      bracket.appendChild(col);
    });
    inner.appendChild(bracket);
    scroll.appendChild(inner);
    panel.appendChild(scroll);
    host.appendChild(panel);

    enableSeedDrag(bracket, cl);
  }

  function adminGameEl(built, g, gi, isFirst, cl) {
    var wrap = el('div', 'game');
    var card = el('div', 'game-card admin-game');
    var top = built.resolveSlot(g.top, false);
    var bot = built.resolveSlot(g.bottom, false);
    var res = cl.bracket.results[g.id] = cl.bracket.results[g.id] || {};
    var winner = built.winnerOf(g.id, false);
    var decided = !!res.winner || bothScores(res);

    card.appendChild(adminSlot(g, 'top', top, winner, decided, isFirst ? 2 * gi : null, res.topScore, res.home === 'top'));
    card.appendChild(adminSlot(g, 'bottom', bot, winner, decided, isFirst ? 2 * gi + 1 : null, res.bottomScore, res.home === 'bottom'));

    card.onclick = function () { openAdminGameModal(g.id); };
    wrap.appendChild(card);
    return wrap;
  }

  function adminSlot(g, side, part, winner, decided, slotIndex, score, isHome) {
    var slot = el('div', 'slot');
    var ref = part && part.ref ? part.ref : null;
    var seedCell = el('div', 'seed', ref ? A.seedLabel(ref) : '');
    if (slotIndex != null) {
      seedCell.classList.add('seed-drag');
      seedCell.draggable = true;
      seedCell.dataset.slot = slotIndex;
      seedCell.title = 'Drag to move this seed';
      seedCell.onclick = function (e) { e.stopPropagation(); };
    }
    slot.appendChild(seedCell);

    var team = el('div', 'team');
    var span = el('span');
    var hasTeam = part && part.team && part.team.name;
    if (part && part.bye) { slot.classList.add('blank'); }
    else if (hasTeam) { span.textContent = part.team.name; }
    else { slot.classList.add('empty'); span.textContent = ref ? '—' : 'TBD'; }
    team.appendChild(span);
    if (isHome && hasTeam) { team.appendChild(el('span', 'home-tag', 'H')); }
    slot.appendChild(team);

    if (decided && winner && part && sameParticipant(winner, part)) slot.classList.add('winner');
    slot.appendChild(el('div', 'score', (score != null && score !== '') ? String(score) : ''));
    return slot;
  }

  function enableSeedDrag(bracket, cl) {
    var fromIdx = null;
    bracket.querySelectorAll('.seed-drag').forEach(function (cell) {
      cell.addEventListener('dragstart', function (e) {
        fromIdx = parseInt(cell.dataset.slot, 10);
        cell.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cell.dataset.slot);
        e.stopPropagation();
      });
      cell.addEventListener('dragend', function () {
        cell.classList.remove('dragging');
        bracket.querySelectorAll('.seed-drag').forEach(function (x) { x.classList.remove('drag-over'); });
      });
      cell.addEventListener('dragover', function (e) { e.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', function () { cell.classList.remove('drag-over'); });
      cell.addEventListener('drop', function (e) {
        e.preventDefault(); e.stopPropagation();
        cell.classList.remove('drag-over');
        var to = parseInt(cell.dataset.slot, 10);
        if (fromIdx == null || fromIdx === to) return;
        var s = cl.bracket.slots;
        var tmp = s[to]; s[to] = s[fromIdx]; s[fromIdx] = tmp;
        save(false);
        renderBody();
      });
    });
  }

  function partLabel(part) {
    if (part && part.bye) return 'BYE';
    if (part && part.team && part.team.name) return part.team.name;
    if (part && part.ref) return A.seedLabel(part.ref);
    return 'TBD';
  }

  /* ---------- Admin game modal (score / home / details) --------------- */
  function openAdminGameModal(gameId) {
    state.adminGameId = gameId;
    document.getElementById('adminModal').classList.add('open');
    renderAdminGameModal();
  }
  function closeAdminGameModal() {
    document.getElementById('adminModal').classList.remove('open');
    state.adminGameId = null;
    renderBody();
  }
  function renderAdminGameModal() {
    var gameId = state.adminGameId;
    if (!gameId) return;
    var cl = state.data.classifications[state.classKey];
    var built = A.buildClassification(state.data, state.classKey);
    var g = built.gamesById[gameId];
    if (!g) return;
    var top = built.resolveSlot(g.top, false);
    var bot = built.resolveSlot(g.bottom, false);
    var res = cl.bracket.results[gameId] = cl.bracket.results[gameId] || {};

    document.getElementById('adminModalTitle').textContent = A.roundName(g.round, built.totalRounds);
    var body = document.getElementById('adminModalBody');
    body.innerHTML = '';

    body.appendChild(el('p', 'hint', 'Check the box next to the home team (shown as "H" on the bracket) — put their stadium in Location.'));
    body.appendChild(teamEditRow(res, 'top', partLabel(top)));
    body.appendChild(teamEditRow(res, 'bottom', partLabel(bot)));

    // winner override
    var wf = el('div', 'field');
    wf.appendChild(el('label', null, 'Winner'));
    var sel = document.createElement('select');
    [['', 'Auto (by score)'], ['top', partLabel(top) + ' wins'], ['bottom', partLabel(bot) + ' wins']]
      .forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
        if ((res.winner || '') === o[0]) op.selected = true;
        sel.appendChild(op);
      });
    sel.onchange = function () { res.winner = sel.value || undefined; save(false); };
    wf.appendChild(sel);
    body.appendChild(wf);

    var grid = el('div', 'modal-grid');
    grid.appendChild(textField(res, 'date', 'Date', 'e.g. Fri, Nov 13'));
    grid.appendChild(textField(res, 'time', 'Time', 'e.g. 7:00 PM'));
    body.appendChild(grid);
    body.appendChild(textField(res, 'location', 'Location (stadium)', 'e.g. Saraland Spartan Stadium'));
    body.appendChild(textField(res, 'note', 'Note (optional)', 'Any extra detail'));
  }

  function teamEditRow(res, side, label) {
    var scoreKey = side === 'top' ? 'topScore' : 'bottomScore';
    var row = el('div', 'ag-team');
    var homeLbl = el('label', 'ag-home');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = res.home === side;
    cb.onchange = function () {
      if (cb.checked) res.home = side;
      else if (res.home === side) res.home = undefined;
      save(false);
      renderAdminGameModal();
    };
    homeLbl.appendChild(cb);
    homeLbl.appendChild(document.createTextNode(' Home'));
    row.appendChild(homeLbl);
    row.appendChild(el('div', 'ag-name', label));
    var sc = document.createElement('input');
    sc.type = 'number'; sc.placeholder = 'Score'; sc.className = 'ag-score';
    sc.value = res[scoreKey] != null ? res[scoreKey] : '';
    sc.oninput = function () { res[scoreKey] = sc.value; save(false); };
    row.appendChild(sc);
    return row;
  }

  function textField(res, key, label, ph) {
    var f = el('div', 'field');
    f.appendChild(el('label', null, label));
    var inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = ph || '';
    inp.value = res[key] != null ? res[key] : '';
    inp.oninput = function () { res[key] = inp.value; save(false); };
    f.appendChild(inp);
    return f;
  }

  /* ---------- Render: Projected bracket editor ---------- */
  function sameParticipant(a, b) {
    if (!a || !b) return false;
    if (a.team && b.team) return a.team === b.team || (a.team.id && a.team.id === b.team.id);
    return a === b;
  }
  function bothScores(res) {
    var ts = parseFloat(res.topScore), bs = parseFloat(res.bottomScore);
    return !isNaN(ts) && !isNaN(bs);
  }

  function renderProjected() {
    var host = document.getElementById('adminBody');
    var cl = state.data.classifications[state.classKey];
    cl.bracket.projected = cl.bracket.projected || {};

    var panel = el('div', 'panel');
    panel.appendChild(el('h3', null, 'Projected Bracket'));
    panel.appendChild(el('p', 'hint', 'Click a team to project them as the winner of a game — they advance to the next round. Games that already have an actual score/result (in "Bracket & Results") are locked to that result. This is exactly what the public "Show projected results" toggle displays.'));

    var toolbar = el('div', 'toolbar');
    toolbar.style.marginBottom = '12px';
    var clearBtn = el('button', 'btn btn-sm btn-danger', 'Clear all projections');
    clearBtn.onclick = function () {
      if (!confirm('Clear all projected picks for this classification?')) return;
      cl.bracket.projected = {};
      save(false); renderBody();
    };
    toolbar.appendChild(clearBtn);
    panel.appendChild(toolbar);

    var built = A.buildClassification(state.data, state.classKey);

    var scroll = el('div');
    scroll.style.overflowX = 'auto';
    scroll.style.paddingBottom = '12px';
    var inner = el('div');
    inner.style.display = 'inline-block';

    var titles = el('div', 'bracket-titles');
    built.rounds.forEach(function (rnd, i) {
      titles.appendChild(el('div', 'col-title', A.roundName(i + 1, built.totalRounds)));
    });
    inner.appendChild(titles);

    var bracket = el('div', 'bracket');
    built.rounds.forEach(function (rnd, rIdx) {
      var col = el('div', 'round-col' + (rIdx === 0 ? ' first' : ''));
      rnd.forEach(function (g) { col.appendChild(projGameEl(built, g, cl)); });
      bracket.appendChild(col);
    });
    inner.appendChild(bracket);
    scroll.appendChild(inner);
    panel.appendChild(scroll);
    host.appendChild(panel);
  }

  function projGameEl(built, g, cl) {
    var wrap = el('div', 'game');
    var card = el('div', 'game-card');
    var top = built.resolveSlot(g.top, true);
    var bot = built.resolveSlot(g.bottom, true);
    var res = (cl.bracket.results || {})[g.id] || {};
    var actualDecided = !!res.winner || bothScores(res);
    var winner = built.winnerOf(g.id, true);
    card.appendChild(projSlot(built, g, 'top', top, winner, actualDecided, cl));
    card.appendChild(projSlot(built, g, 'bottom', bot, winner, actualDecided, cl));
    wrap.appendChild(card);
    return wrap;
  }

  function projSlot(built, g, side, part, winner, actualDecided, cl) {
    var slot = el('div', 'slot');
    var ref = g[side].kind === 'leaf' ? g[side].ref : null;
    slot.appendChild(el('div', 'seed', ref ? A.seedLabel(ref) : ''));
    var team = el('div', 'team');
    var span = el('span');
    var hasTeam = part && part.team && part.team.name;
    span.textContent = hasTeam ? part.team.name : (part && part.bye ? 'BYE' : (ref ? '—' : 'TBD'));
    team.appendChild(span);
    slot.appendChild(team);

    var isWin = winner && part && sameParticipant(winner, part);
    if (isWin) slot.classList.add('winner');

    if (actualDecided) {
      if (!isWin) slot.classList.add('loser');
      slot.title = 'Result is final (set in Bracket & Results)';
    } else if (hasTeam) {
      slot.classList.add('pickable');
      slot.onclick = function () {
        if (cl.bracket.projected[g.id] === side) delete cl.bracket.projected[g.id];
        else cl.bracket.projected[g.id] = side;
        save(false); renderBody();
      };
    }
    return slot;
  }

  /* ---------- Body render ---------- */
  function renderBody() {
    renderClassTabs();
    renderSectionTabs();
    var host = document.getElementById('adminBody');
    host.innerHTML = '';
    if (state.section === 'standings') renderStandings();
    else if (state.section === 'projected') renderProjected();
    else renderBracket();
  }
  function renderAll() {
    renderNews();
    renderBody();
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    document.getElementById('themeBtn').onclick = toggleTheme;

    document.getElementById('loginBtn').onclick = attemptLogin;
    document.getElementById('loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') attemptLogin(); });
    document.getElementById('loginEmail').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('loginPass').focus(); });
    document.getElementById('logoutBtn').onclick = logout;

    document.getElementById('exportBtn').onclick = exportJSON;
    document.getElementById('copyBtn').onclick = copyJSON;
    document.getElementById('resetBtn').onclick = resetToPublished;
    document.getElementById('importInput').onchange = function (e) {
      if (e.target.files && e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = '';
    };

    document.querySelectorAll('.admin-section-tab').forEach(function (t) {
      t.onclick = function () { state.section = t.dataset.section; renderBody(); };
    });

    document.getElementById('adminModalClose').onclick = closeAdminGameModal;
    document.getElementById('adminModal').onclick = function (e) {
      if (e.target.id === 'adminModal') closeAdminGameModal();
    };
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.getElementById('adminModal').classList.contains('open')) closeAdminGameModal();
    });

    if (isAuthed()) showAdmin();
    else showLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
