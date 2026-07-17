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

    var intro = el('p', 'hint', 'Drag the ⠿ handle to reorder teams — order = seed (top ' + cfg.playoff + ' qualify and feed the bracket). Edit records, rating and status inline. Add per-region notes at the bottom of each panel.');
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
        '<th class="col-rating">Rating</th><th class="col-status">Status</th><th></th>' +
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
    tr.appendChild(inputCell(t, 'rating', 'number', '0.0'));

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

  /* ---------- Render: Bracket editor ---------- */
  function renderBracket() {
    var host = document.getElementById('adminBody');
    var cfg = A.CLASS_CONFIG[state.classKey];
    var cl = state.data.classifications[state.classKey];

    // --- Region alignment ---
    var alignPanel = el('div', 'panel');
    alignPanel.appendChild(el('h3', null, 'Region Alignment'));
    alignPanel.appendChild(el('p', 'hint', alignmentHelp(cfg.template)));
    var list = el('div', 'align-list');
    renderAlignList(list, cl, cfg);
    alignPanel.appendChild(list);
    host.appendChild(alignPanel);

    // --- Results / game info ---
    var built = A.buildClassification(state.data, state.classKey);
    var resPanel = el('div', 'panel');
    resPanel.appendChild(el('h3', null, 'Scores & Game Details'));
    resPanel.appendChild(el('p', 'hint', 'Enter scores to advance winners automatically. For ties or undecided games, pick a winner manually. Add date, time and location for the game pop-up.'));

    built.rounds.forEach(function (rnd, rIdx) {
      resPanel.appendChild(el('h4', null, A.roundName(rIdx + 1, built.totalRounds)));
      var grid = el('div', 'results-grid');
      rnd.forEach(function (g) { grid.appendChild(resultCard(built, g)); });
      resPanel.appendChild(grid);
    });
    host.appendChild(resPanel);
  }

  function alignmentHelp(tmpl) {
    if (tmpl === '6A') return 'Each region runs its own block (top 2 seeds bye to round 2); the 4 region champions meet in the semifinals. Drag to set which region block sits where in the bracket.';
    if (tmpl === '8') return 'The two regions are cross-seeded into one 8-team pod. Drag to swap which region is A vs B.';
    return 'Adjacent pairs of regions share a pod (positions 1&2, 3&4, …). Drag regions to set the pairings and bracket placement.';
  }

  function renderAlignList(list, cl, cfg) {
    list.innerHTML = '';
    var dragIdx = null;
    cl.bracket.alignment.forEach(function (rid, idx) {
      var item = el('div', 'align-item');
      item.draggable = true;
      item.dataset.idx = idx;
      item.appendChild(el('span', 'pos', 'Slot ' + (idx + 1)));
      item.appendChild(el('span', null, 'Region ' + rid));
      item.addEventListener('dragstart', function (e) {
        dragIdx = idx; item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
      });
      item.addEventListener('dragend', function () {
        item.classList.remove('dragging');
        list.querySelectorAll('.align-item').forEach(function (x) { x.classList.remove('drag-over'); });
      });
      item.addEventListener('dragover', function (e) { e.preventDefault(); item.classList.add('drag-over'); });
      item.addEventListener('dragleave', function () { item.classList.remove('drag-over'); });
      item.addEventListener('drop', function (e) {
        e.preventDefault();
        var to = parseInt(item.dataset.idx, 10);
        if (dragIdx == null || dragIdx === to) return;
        var arr = cl.bracket.alignment;
        var moved = arr.splice(dragIdx, 1)[0];
        arr.splice(to, 0, moved);
        save(false);
        renderBody();
      });
      list.appendChild(item);
    });
  }

  function resultCard(built, g) {
    var card = el('div', 'result-card');
    var top = built.resolveSlot(g.top, false);
    var bot = built.resolveSlot(g.bottom, false);
    var res = built.results[g.id] = built.results[g.id] || {};
    // make sure stored on data
    state.data.classifications[state.classKey].bracket.results[g.id] = res;

    card.appendChild(el('div', 'rc-head', partLabel(top, g.top) + '  vs  ' + partLabel(bot, g.bottom)));

    card.appendChild(scoreRow(partLabel(top, g.top), res, 'topScore'));
    card.appendChild(scoreRow(partLabel(bot, g.bottom), res, 'bottomScore'));

    // winner override
    var wrap = el('div', 'field');
    wrap.style.margin = '6px 0';
    var sel = document.createElement('select');
    [['', 'Winner: auto (by score)'], ['top', 'Winner: ' + partLabel(top, g.top)], ['bottom', 'Winner: ' + partLabel(bot, g.bottom)]]
      .forEach(function (o) {
        var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
        if ((res.winner || '') === o[0]) op.selected = true;
        sel.appendChild(op);
      });
    sel.onchange = function () { res.winner = sel.value; save(false); renderBody(); };
    wrap.appendChild(sel);
    card.appendChild(wrap);

    var meta = el('div', 'rc-meta');
    meta.appendChild(metaInput(res, 'date', 'Date (e.g. Fri Nov 13)'));
    meta.appendChild(metaInput(res, 'time', 'Time (e.g. 7:00 PM)'));
    var locWrap = el('div'); locWrap.style.gridColumn = '1 / -1';
    locWrap.appendChild(metaInputRaw(res, 'location', 'Location'));
    meta.appendChild(locWrap);
    var noteWrap = el('div'); noteWrap.style.gridColumn = '1 / -1';
    noteWrap.appendChild(metaInputRaw(res, 'note', 'Note (optional)'));
    meta.appendChild(noteWrap);
    card.appendChild(meta);

    return card;
  }

  function partLabel(part, slot) {
    if (part && part.bye) return 'BYE';
    if (part && part.team && part.team.name) return part.team.name;
    if (slot.kind === 'leaf' && slot.ref) return A.seedLabel(slot.ref);
    return 'TBD';
  }
  function scoreRow(name, res, key) {
    var row = el('div', 'rc-row');
    row.appendChild(el('span', 'nm', name));
    var inp = document.createElement('input');
    inp.type = 'number'; inp.placeholder = '–';
    inp.value = res[key] != null ? res[key] : '';
    inp.oninput = function () { res[key] = inp.value; save(false); };
    inp.onchange = function () { renderBody(); };
    row.appendChild(inp);
    return row;
  }
  function metaInput(res, key, ph) {
    var d = el('div');
    d.appendChild(metaInputRaw(res, key, ph));
    return d;
  }
  function metaInputRaw(res, key, ph) {
    var inp = document.createElement('input');
    inp.type = 'text'; inp.placeholder = ph;
    inp.value = res[key] != null ? res[key] : '';
    inp.oninput = function () { res[key] = inp.value; save(false); };
    return inp;
  }

  /* ---------- Body render ---------- */
  function renderBody() {
    renderClassTabs();
    renderSectionTabs();
    var host = document.getElementById('adminBody');
    host.innerHTML = '';
    if (state.section === 'standings') renderStandings();
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

    if (isAuthed()) showAdmin();
    else showLogin();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
