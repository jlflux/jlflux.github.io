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
    'AA': { name: 'Class AA',  group: 'Private', template: '8',  regionCount: 2, playoff: 4 },
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
          alignment: alignment, // ordered region ids -> bracket region slots
          results: {},          // gameId -> { topScore, bottomScore, winner, date, time, location, note }
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
      cl.bracket = cl.bracket || { alignment: [], results: {} };
      cl.bracket.results = cl.bracket.results || {};
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

  // Public site load order: localStorage working copy (if any) -> published.
  function loadPublic() {
    const local = loadLocal();
    if (local) return Promise.resolve(local);
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

  function numericRating(team) {
    if (!team) return null;
    const v = parseFloat(team.rating);
    return isNaN(v) ? null : v;
  }

  // Build everything needed to render a classification bracket.
  // Returns { rounds, gamesById, totalRounds, resolve(slot, projected) }
  function buildClassification(data, classKey) {
    const cfg = CLASS_CONFIG[classKey];
    const cl = data.classifications[classKey];
    const tmpl = TEMPLATES[cfg.template];
    const alignment = cl.bracket.alignment.slice(0, tmpl.regionSlots);
    const leaves = tmpl.leaves(alignment);
    const rounds = buildBracket(leaves);
    const totalRounds = rounds.length;
    const gamesById = {};
    rounds.forEach((rnd) => rnd.forEach((g) => { gamesById[g.id] = g; }));
    const results = cl.bracket.results || {};

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

      // projected: prefer actual result if decided, else higher rating
      if (res.winner === 'top') { memo[cacheKey] = top; return top; }
      if (res.winner === 'bottom') { memo[cacheKey] = bot; return bot; }
      const ts = parseFloat(res.topScore);
      const bs = parseFloat(res.bottomScore);
      if (!isNaN(ts) && !isNaN(bs) && ts !== bs) {
        const w = ts > bs ? top : bot; memo[cacheKey] = w; return w;
      }
      const tr = top ? numericRating(top.team) : null;
      const br = bot ? numericRating(bot.team) : null;
      if (tr == null && br == null) { memo[cacheKey] = null; return null; }
      if (tr == null) { memo[cacheKey] = bot; return bot; }
      if (br == null) { memo[cacheKey] = top; return top; }
      const w = tr >= br ? top : bot;
      memo[cacheKey] = w; return w;
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
    buildBracket: buildBracket,
    buildClassification: buildClassification,
    roundName: roundName,
    teamForSeed: teamForSeed,
    seedLabel: seedLabel,
    getClassConfig: getClassConfig,
    makeRegion: makeRegion,
  };
})(window);
