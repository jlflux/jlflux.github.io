/* =====================================================================
   AHSAA Football Playoff Brackets — Data Engine (shared)
   ---------------------------------------------------------------------
   This file holds the data model, default seed data, bracket templates,
   the bracket-tree builder, and resolution helpers used by both the
   public site and the admin suite.

   PERSISTENCE NOTE
   ----------------
   GitHub Pages is a STATIC host (no server / database). The published,
   canonical data lives in `data/data.json` (committed to the repo).
   The admin suite edits a working copy in localStorage and lets you
   Export the JSON, which you then commit as data/data.json to publish.
   ===================================================================== */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'ahsaa_brackets_data_v1';
  const SCHEMA_VERSION = 1;

  /* ---------- Classification configuration ---------------------------- */
  // template: which bracket shape to use
  // regionCount: number of regions
  // playoff: how many teams per region qualify (informational + helpers)
  const CLASS_CONFIG = {
    '6A': { name: 'Class 6A',  group: 'Public',  template: '6A', regionCount: 4, playoff: 6 },
    '5A': { name: 'Class 5A',  group: 'Public',  template: '32', regionCount: 8, playoff: 4 },
    '4A': { name: 'Class 4A',  group: 'Public',  template: '32', regionCount: 8, playoff: 4 },
    '3A': { name: 'Class 3A',  group: 'Public',  template: '32', regionCount: 8, playoff: 4 },
    '2A': { name: 'Class 2A',  group: 'Public',  template: '32', regionCount: 8, playoff: 4 },
    '1A': { name: 'Class 1A',  group: 'Public',  template: '32', regionCount: 8, playoff: 4 },
    // AA takes every team from both regions (16 total) as of 2026.
    'AA': { name: 'Class AA',  group: 'Private', template: '16x2', regionCount: 2, playoff: 8 },
    'A':  { name: 'Class A',   group: 'Private', template: '16', regionCount: 4, playoff: 4 },
  };
  const CLASS_ORDER = ['6A', '5A', '4A', '3A', '2A', '1A', 'AA', 'A'];

  const STATUS_OPTIONS = [
    { key: 'clinched', label: 'Clinched' },
    { key: 'high',     label: 'High' },
    { key: 'medium',   label: 'Medium' },
    { key: 'low',      label: 'Low' },
    { key: 'out',      label: 'Out' },
  ];

  /* ---------- Bracket leaf generators --------------------------------- */
  // A "leaf" is a first-round slot: {region: regionId, place: n} or null (BYE).

  // Standard 8-team two-region pod (regions a & b cross-seeded).
  function podLeaves(a, b) {
    return [
      { region: a, place: 1 }, { region: b, place: 4 },
      { region: a, place: 3 }, { region: b, place: 2 },
      { region: a, place: 2 }, { region: b, place: 3 },
      { region: a, place: 4 }, { region: b, place: 1 },
    ];
  }

  // 16-team bracket built from just TWO regions of 8 (every team qualifies).
  // Cross-seeded aK vs b(9-K) and laid out in standard bracket order, so the
  // two region champions can only meet in the final.
  function bigPodLeaves(a, b) {
    const A = (p) => ({ region: a, place: p });
    const B = (p) => ({ region: b, place: p });
    return [
      A(1), B(8),   B(4), A(5),   A(3), B(6),   B(2), A(7),   // top half
      A(2), B(7),   B(3), A(6),   A(4), B(5),   B(1), A(8),   // bottom half
    ];
  }

  // 6A region block: 6 teams, top 2 seeds bye into round 2 (8 slots, 2 byes).
  function region6Block(r) {
    return [
      { region: r, place: 1 }, null,
      { region: r, place: 4 }, { region: r, place: 5 },
      { region: r, place: 2 }, null,
      { region: r, place: 3 }, { region: r, place: 6 },
    ];
  }

  const TEMPLATES = {
    '6A': {
      regionSlots: 4,
      leaves: (al) => [].concat(
        region6Block(al[0]), region6Block(al[1]),
        region6Block(al[2]), region6Block(al[3])
      ),
    },
    '32': {
      regionSlots: 8,
      leaves: (al) => [].concat(
        podLeaves(al[0], al[1]), podLeaves(al[2], al[3]),
        podLeaves(al[4], al[5]), podLeaves(al[6], al[7])
      ),
    },
    '16': {
      regionSlots: 4,
      leaves: (al) => [].concat(
        podLeaves(al[0], al[1]), podLeaves(al[2], al[3])
      ),
    },
    '16x2': {
      regionSlots: 2,
      leaves: (al) => bigPodLeaves(al[0], al[1]),
    },
    '8': {
      regionSlots: 2,
      leaves: (al) => podLeaves(al[0], al[1]),
    },
  };

  /* ---------- Bracket tree builder ------------------------------------ */
  // Build rounds (array of arrays of game nodes) from an ordered leaf list.
  function buildBracket(leaves) {
    const rounds = [];
    let nodes = [];
    for (let i = 0; i < leaves.length; i += 2) {
      nodes.push({
        id: 'r1g' + (i / 2),
        round: 1,
        top: { kind: 'leaf', ref: leaves[i] },
        bottom: { kind: 'leaf', ref: leaves[i + 1] },
      });
    }
    rounds.push(nodes);
    let r = 2;
    while (nodes.length > 1) {
      const next = [];
      for (let i = 0; i < nodes.length; i += 2) {
        next.push({
          id: 'r' + r + 'g' + (i / 2),
          round: r,
          top: { kind: 'game', ref: nodes[i].id },
          bottom: { kind: 'game', ref: nodes[i + 1].id },
        });
      }
      rounds.push(next);
      nodes = next;
      r++;
    }
    return rounds;
  }

  function roundName(round, totalRounds) {
    if (round === totalRounds) return 'Championship';
    if (round === totalRounds - 1) return 'Semifinals';
    if (round === totalRounds - 2) return 'Quarterfinals';
    if (round === 1) return 'First Round';
    if (round === 2) return 'Second Round';
    return 'Round ' + round;
  }

  /* ---------- Default data -------------------------------------------- */
  function makeRegion(name, teamCount) {
    const teams = [];
    for (let i = 0; i < teamCount; i++) {
      teams.push({
        id: 'tm_' + Math.random().toString(36).slice(2, 9),
        name: '',
        overall: '',
        region: '',
        rating: '',
        status: 'medium',
      });
    }
    return { name: name, note: '', teams: teams };
  }

  function defaultData() {
    const classifications = {};
    CLASS_ORDER.forEach((key) => {
      const cfg = CLASS_CONFIG[key];
      const regions = {};
      const alignment = [];
      for (let i = 1; i <= cfg.regionCount; i++) {
        const rid = String(i);
        // seed each region with the number of playoff slots as empty rows
        regions[rid] = makeRegion('Region ' + i, cfg.playoff);
        alignment.push(rid);
      }
      classifications[key] = {
        regions: regions,
        bracket: {
          alignment: alignment,                              // default region order (used to seed `slots`)
          slots: TEMPLATES[cfg.template].leaves(alignment),  // first-round slot refs, freely re-arranged in admin
          results: {},          // gameId -> { topScore, bottomScore, winner, home, date, time, location, note }
          projected: {},        // gameId -> 'top' | 'bottom' (manual projected winner)
        },
      };
    });

    return {
      schema: SCHEMA_VERSION,
      meta: {
        season: '2026',
        updated: new Date().toISOString(),
      },
      newsNote: '',
      classifications: classifications,
    };
  }

  /* ---------- Load / save / migrate ----------------------------------- */
  function migrate(data) {
    if (!data || typeof data !== 'object') return defaultData();
    if (!data.classifications) return defaultData();
    // ensure every classification / region exists with correct counts
    const base = defaultData();
    data.schema = SCHEMA_VERSION;
    data.meta = data.meta || base.meta;
    if (typeof data.newsNote !== 'string') data.newsNote = '';
    CLASS_ORDER.forEach((key) => {
      const cfg = CLASS_CONFIG[key];
      if (!data.classifications[key]) {
        data.classifications[key] = base.classifications[key];
        return;
      }
      const cl = data.classifications[key];
      cl.regions = cl.regions || {};
      cl.bracket = cl.bracket || { alignment: [], results: {}, projected: {} };
      cl.bracket.results = cl.bracket.results || {};
      cl.bracket.projected = cl.bracket.projected || {};
      for (let i = 1; i <= cfg.regionCount; i++) {
        const rid = String(i);
        if (!cl.regions[rid]) cl.regions[rid] = makeRegion('Region ' + i, cfg.playoff);
        const reg = cl.regions[rid];
        reg.teams = reg.teams || [];
        if (typeof reg.note !== 'string') reg.note = '';
        reg.teams.forEach((t) => {
          if (!t.id) t.id = 'tm_' + Math.random().toString(36).slice(2, 9);
          if (typeof t.name !== 'string') t.name = '';
          if (typeof t.overall !== 'string') t.overall = '';
          if (typeof t.region !== 'string') t.region = '';
          if (t.rating == null) t.rating = '';
          if (!t.status) t.status = 'medium';
        });
      }
      // alignment must contain exactly the region ids
      const ids = [];
      for (let i = 1; i <= cfg.regionCount; i++) ids.push(String(i));
      const al = Array.isArray(cl.bracket.alignment) ? cl.bracket.alignment.filter((x) => ids.indexOf(x) >= 0) : [];
      ids.forEach((id) => { if (al.indexOf(id) < 0) al.push(id); });
      cl.bracket.alignment = al.slice(0, cfg.regionCount);

      // First-round slots: the editable seed layout. Seed from the template
      // the first time; afterwards keep whatever the admin has arranged.
      const tmpl = TEMPLATES[cfg.template];
      const defLeaves = tmpl.leaves(cl.bracket.alignment.slice(0, tmpl.regionSlots));
      if (!Array.isArray(cl.bracket.slots) || cl.bracket.slots.length !== defLeaves.length) {
        // The bracket changed shape (e.g. the AA field grew to 16 teams), so
        // game ids no longer refer to the same match-ups. Reset the layout and
        // drop results/projections that would land on the wrong games.
        cl.bracket.slots = defLeaves;
        cl.bracket.results = {};
        cl.bracket.projected = {};
      } else {
        cl.bracket.slots = cl.bracket.slots.map(function (s) {
          if (s && s.region != null && s.place != null) return { region: String(s.region), place: s.place };
          return null;
        });
      }
    });
    return data;
  }

  function loadLocal() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return migrate(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function saveLocal(data) {
    data.meta = data.meta || {};
    data.meta.updated = new Date().toISOString();
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearLocal() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
  }

  // Fetch published data.json; fall back to embedded defaults.
  function fetchPublished() {
    return fetch('data/data.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('no data.json'); return r.json(); })
      .then((j) => migrate(j))
      .catch(() => defaultData());
  }

  const STALE_BACKUP_KEY = STORAGE_KEY + '_stale_backup';

  // Compare two data sets ignoring the auto-touched timestamp.
  function contentSignature(d) {
    if (!d) return '';
    const copy = JSON.parse(JSON.stringify(d));
    if (copy.meta) delete copy.meta.updated;
    return JSON.stringify(copy);
  }
  function updatedAt(d) {
    const t = d && d.meta && d.meta.updated ? Date.parse(d.meta.updated) : 0;
    return isNaN(t) ? 0 : t;
  }

  // What the ADMIN should open, reconciling this browser's local draft with
  // what is actually published. Prevents a stale draft on one machine from
  // silently shadowing (and later clobbering) newer published work.
  //
  // -> { data, source, draftAt, publishedAt }
  //    source: 'published'        nothing local, or local matches published
  //            'draft'            local draft has newer unpublished edits
  //            'published-newer'  local draft was stale; published data won
  function loadAdmin() {
    return fetchPublished().then((pub) => {
      const local = loadLocal();
      if (!local) return { data: pub, source: 'published', publishedAt: pub.meta && pub.meta.updated };

      if (contentSignature(local) === contentSignature(pub)) {
        saveLocal(pub);
        return { data: pub, source: 'published', publishedAt: pub.meta && pub.meta.updated };
      }

      const lt = updatedAt(local);
      const pt = updatedAt(pub);
      if (lt > pt) {
        return { data: local, source: 'draft', draftAt: local.meta && local.meta.updated, publishedAt: pub.meta && pub.meta.updated };
      }

      // Published data is newer than this browser's draft: the draft is stale
      // (edited elsewhere since). Keep a recoverable backup, then use published.
      try { global.localStorage.setItem(STALE_BACKUP_KEY, JSON.stringify(local)); } catch (e) { /* noop */ }
      saveLocal(pub);
      return {
        data: pub,
        source: 'published-newer',
        draftAt: local.meta && local.meta.updated,
        publishedAt: pub.meta && pub.meta.updated,
      };
    });
  }

  function restoreStaleBackup() {
    try {
      const raw = global.localStorage.getItem(STALE_BACKUP_KEY);
      return raw ? migrate(JSON.parse(raw)) : null;
    } catch (e) { return null; }
  }
  function hasStaleBackup() {
    try { return !!global.localStorage.getItem(STALE_BACKUP_KEY); } catch (e) { return false; }
  }
  function clearStaleBackup() {
    try { global.localStorage.removeItem(STALE_BACKUP_KEY); } catch (e) { /* noop */ }
  }

  // The public site always shows the PUBLISHED data, never a local draft, so
  // what you see here is exactly what every visitor sees. (Add ?preview=1 to
  // preview an unpublished local working copy.)
  function loadPublic() {
    const wantPreview = /[?&]preview=1\b/.test(global.location ? global.location.search : '');
    if (wantPreview) {
      const local = loadLocal();
      if (local) return Promise.resolve(local);
    }
    return fetchPublished();
  }

  /* ---------- Resolution: teams, winners, projections ----------------- */
  function getClassConfig(classKey) { return CLASS_CONFIG[classKey]; }

  function teamForSeed(data, classKey, ref) {
    if (!ref) return null;
    const cl = data.classifications[classKey];
    const reg = cl && cl.regions[String(ref.region)];
    if (!reg) return null;
    const team = reg.teams[ref.place - 1];
    return team || null;
  }

  function seedLabel(ref) {
    if (!ref) return '';
    return 'R' + ref.region + '-' + ref.place;
  }


  // Build everything needed to render a classification bracket.
  // Returns { rounds, gamesById, totalRounds, resolve(slot, projected) }
  function buildClassification(data, classKey) {
    const cfg = CLASS_CONFIG[classKey];
    const cl = data.classifications[classKey];
    const tmpl = TEMPLATES[cfg.template];
    const alignment = (cl.bracket.alignment || []).slice(0, tmpl.regionSlots);
    let leaves = cl.bracket.slots;
    if (!Array.isArray(leaves) || !leaves.length) leaves = tmpl.leaves(alignment);
    const rounds = buildBracket(leaves);
    const totalRounds = rounds.length;
    const gamesById = {};
    rounds.forEach((rnd) => rnd.forEach((g) => { gamesById[g.id] = g; }));
    const results = cl.bracket.results || {};
    const projPicks = cl.bracket.projected || {};

    const memo = {};

    // Resolve a slot into a participant:
    //  -> { bye:true } | { team, ref } | null (undecided)
    function resolveSlot(slot, projected) {
      if (slot.kind === 'leaf') {
        if (slot.ref === null) return { bye: true };
        const team = teamForSeed(data, classKey, slot.ref);
        return { team: team, ref: slot.ref };
      }
      // game slot -> winner of that game
      return winnerOf(slot.ref, projected);
    }

    function winnerOf(gameId, projected) {
      const cacheKey = gameId + (projected ? ':p' : ':a');
      if (memo[cacheKey] !== undefined) return memo[cacheKey];
      memo[cacheKey] = null; // guard against cycles
      const g = gamesById[gameId];
      const top = resolveSlot(g.top, projected);
      const bot = resolveSlot(g.bottom, projected);

      // BYE handling
      if (top && top.bye && (!bot || bot.bye)) { memo[cacheKey] = null; return null; }
      if (top && top.bye) { memo[cacheKey] = bot; return bot; }
      if (bot && bot.bye) { memo[cacheKey] = top; return top; }

      const res = results[gameId] || {};

      if (!projected) {
        // explicit winner override
        if (res.winner === 'top') { memo[cacheKey] = top; return top; }
        if (res.winner === 'bottom') { memo[cacheKey] = bot; return bot; }
        // decide by score if both present and not tied
        const ts = parseFloat(res.topScore);
        const bs = parseFloat(res.bottomScore);
        if (!isNaN(ts) && !isNaN(bs) && ts !== bs) {
          const w = ts > bs ? top : bot;
          memo[cacheKey] = w; return w;
        }
        memo[cacheKey] = null; return null; // undecided
      }

      // projected: prefer an actual result if decided, otherwise use the
      // manually-set projected pick (edited in the admin projected bracket).
      if (res.winner === 'top') { memo[cacheKey] = top; return top; }
      if (res.winner === 'bottom') { memo[cacheKey] = bot; return bot; }
      const ts = parseFloat(res.topScore);
      const bs = parseFloat(res.bottomScore);
      if (!isNaN(ts) && !isNaN(bs) && ts !== bs) {
        const w = ts > bs ? top : bot; memo[cacheKey] = w; return w;
      }
      if (projPicks[gameId] === 'top') { memo[cacheKey] = top; return top; }
      if (projPicks[gameId] === 'bottom') { memo[cacheKey] = bot; return bot; }
      memo[cacheKey] = null; return null; // no projection set yet
    }

    return {
      classKey: classKey,
      config: cfg,
      rounds: rounds,
      gamesById: gamesById,
      totalRounds: totalRounds,
      alignment: alignment,
      results: results,
      resolveSlot: resolveSlot,
      winnerOf: winnerOf,
    };
  }

  /* ---------- Export to namespace ------------------------------------- */
  global.AHSAA = {
    STORAGE_KEY: STORAGE_KEY,
    CLASS_CONFIG: CLASS_CONFIG,
    CLASS_ORDER: CLASS_ORDER,
    STATUS_OPTIONS: STATUS_OPTIONS,
    TEMPLATES: TEMPLATES,
    defaultData: defaultData,
    migrate: migrate,
    loadLocal: loadLocal,
    saveLocal: saveLocal,
    clearLocal: clearLocal,
    fetchPublished: fetchPublished,
    loadPublic: loadPublic,
    loadAdmin: loadAdmin,
    contentSignature: contentSignature,
    restoreStaleBackup: restoreStaleBackup,
    hasStaleBackup: hasStaleBackup,
    clearStaleBackup: clearStaleBackup,
    buildBracket: buildBracket,
    buildClassification: buildClassification,
    roundName: roundName,
    teamForSeed: teamForSeed,
    seedLabel: seedLabel,
    getClassConfig: getClassConfig,
    makeRegion: makeRegion,
  };
})(window);
