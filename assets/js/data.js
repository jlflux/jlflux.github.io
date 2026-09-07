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

  /* ---------- About page content -------------------------------------- */
  const DEFAULT_BANNER_TEXT = 'New to bracketology? Learn how these brackets, seeds and projections work.';

  const DEFAULT_ABOUT = [
    '<h2>What is bracketology?</h2>',
    'Bracketology is the practice of projecting a postseason field before it is actually set. Instead of waiting for the AHSAA to release the official brackets, we take what we know right now — region standings, results so far, and who still has to play whom — and build the bracket that <i>would</i> happen if the season ended today.',
    '',
    'It is part math, part judgment, and it changes every week. That is the fun of it.',
    '',
    '<h2>How the AHSAA playoff field works</h2>',
    'Alabama does not use one big statewide seeding. Every classification is split into regions, and teams qualify out of their own region. Where you finish in your region is the only thing that matters — a 7-3 team can make the playoffs while an 8-2 team in a tougher region misses.',
    '',
    'The field is different in each classification:',
    '',
    '<b>Class 6A</b> — 4 regions, top 6 from each region qualify (24 teams). The top 2 seeds in each region get a first-round bye straight into the second round.',
    '<b>Classes 1A–5A</b> — 8 regions each, top 4 from each region qualify (32 teams).',
    '<b>Class AA (private)</b> — 2 regions, and as of this season the whole field qualifies (16 teams).',
    '<b>Class A (private)</b> — 4 regions, top 4 from each region qualify (16 teams).',
    '',
    '<h2>How to read the bracket</h2>',
    'Every team on the bracket carries a seed tag on the left, written like <b>R4-2</b>. That means <i>the second-place team out of Region 4</i>. The tag travels with the team as it advances, so you can always see where somebody came from.',
    '',
    'A few other things worth knowing:',
    '',
    'The team name sits on the left of each slot and the score on the right.',
    'An <b>H</b> next to a team means they are the home team for that game.',
    'A blank slot next to a team means they have a <b>bye</b> — nobody to play that round, and they advance automatically.',
    '<b>Click any game</b> to see the date, time, location, and both teams’ records.',
    '',
    '<h2>Region standings and status colors</h2>',
    'The Region Standings tab shows every team in playoff order, with their overall record and their region record. Region record is what actually decides seeding.',
    '',
    'Each team also carries a status showing how safe their playoff position is:',
    '',
    '<b>Clinched</b> — mathematically in, regardless of what happens next.',
    '<b>High</b> — in good shape, would need real help to miss.',
    '<b>Medium</b> — genuinely in the balance.',
    '<b>Low</b> — needs results to go their way.',
    '<b>Out</b> — eliminated from playoff contention.',
    '',
    '<h2>About the projections</h2>',
    'Flip on <b>Show projected results</b> on any bracket to see it filled out the rest of the way — who advances, and who ends up playing for a state title.',
    '',
    'These projections are hand-made, not spit out by a formula. They lean on records, head-to-head results, region strength, injuries, and plain old judgment. Games that have actually been played are locked to their real result; everything after that is a projection.',
    '',
    'They will be wrong sometimes. That is the nature of it — and half the reason it is worth arguing about.',
    '',
    '<h2>A note on accuracy</h2>',
    'This is an independent project and is not affiliated with the AHSAA. Brackets here are projections until the AHSAA releases the official pairings. Standings and results are updated by hand, so if you spot something wrong, let us know.',
  ].join('\n');

  /* ---------- Rich text: simple HTML + Enter for line breaks ---------- */
  // Inline/basic tags the admin may use. Anything else is unwrapped (its text
  // is kept) or, if dangerous, removed outright.
  const ALLOWED_TAGS = {
    B: 1, STRONG: 1, I: 1, EM: 1, U: 1, S: 1, SPAN: 1, A: 1, BR: 1, P: 1,
    H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1,
    BLOCKQUOTE: 1, CODE: 1, PRE: 1, HR: 1, SMALL: 1, SUP: 1, SUB: 1, DIV: 1, MARK: 1,
  };
  const DROP_ENTIRELY = {
    SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, LINK: 1, META: 1,
    FORM: 1, INPUT: 1, BUTTON: 1, TEXTAREA: 1, SELECT: 1, BASE: 1, SVG: 1,
  };
  const ALLOWED_STYLE_PROPS = {
    'color': 1, 'background-color': 1, 'font-size': 1, 'font-weight': 1,
    'font-style': 1, 'text-align': 1, 'text-decoration': 1, 'font-family': 1,
  };

  function safeStyle(value) {
    return String(value || '')
      .split(';')
      .map((decl) => decl.trim())
      .filter((decl) => {
        if (!decl) return false;
        const prop = decl.split(':')[0].trim().toLowerCase();
        if (!ALLOWED_STYLE_PROPS[prop]) return false;
        return !/url\s*\(|expression|javascript:/i.test(decl);
      })
      .join('; ');
  }

  function safeHref(value) {
    const v = String(value || '').trim();
    if (/^(https?:|mailto:)/i.test(v)) return v;
    if (/^[/#]/.test(v)) return v;
    return null; // block javascript:, data:, everything else
  }

  // Strip anything that isn't plain formatting. Runs in the browser.
  function sanitizeHtml(html) {
    if (typeof DOMParser === 'undefined') return String(html || '');
    const doc = new DOMParser().parseFromString('<div id="__r">' + html + '</div>', 'text/html');
    const root = doc.getElementById('__r');

    (function walk(node) {
      const children = Array.prototype.slice.call(node.childNodes);
      children.forEach((child) => {
        if (child.nodeType === 3) return;               // text: keep
        if (child.nodeType !== 1) { child.remove(); return; } // comments etc.

        const tag = child.tagName.toUpperCase();
        if (DROP_ENTIRELY[tag]) { child.remove(); return; }

        walk(child);

        if (!ALLOWED_TAGS[tag]) {
          // Unknown but harmless: keep the text, drop the wrapper.
          while (child.firstChild) node.insertBefore(child.firstChild, child);
          child.remove();
          return;
        }

        Array.prototype.slice.call(child.attributes).forEach((attr) => {
          const name = attr.name.toLowerCase();
          if (name === 'style') {
            const cleaned = safeStyle(attr.value);
            if (cleaned) child.setAttribute('style', cleaned);
            else child.removeAttribute('style');
            return;
          }
          if (tag === 'A' && name === 'href') {
            const href = safeHref(attr.value);
            if (href) {
              child.setAttribute('href', href);
              if (/^https?:/i.test(href)) {
                child.setAttribute('target', '_blank');
                child.setAttribute('rel', 'noopener noreferrer');
              }
            } else {
              child.removeAttribute('href');
            }
            return;
          }
          if (name === 'target' || name === 'rel') return; // set above
          child.removeAttribute(attr.name);                // incl. all on* handlers
        });
      });
    })(root);

    return root.innerHTML;
  }

  // Turn what the admin typed into display HTML: their formatting tags are
  // kept, and a plain Enter becomes a line break (no need to type <br>).
  function richTextToHtml(src) {
    let s = String(src == null ? '' : src).replace(/\r\n?/g, '\n');
    s = s.replace(/\n/g, '<br>');
    // A break straight after a block element would double the gap.
    s = s.replace(/(<\/(?:p|h[1-6]|ul|ol|li|div|blockquote|pre)>)\s*<br\s*\/?>/gi, '$1');
    s = s.replace(/(<(?:ul|ol|hr)\s*[^>]*>)\s*<br\s*\/?>/gi, '$1');
    return sanitizeHtml(s);
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
      // When false the public bracket hides the "Show projected results"
      // toggle entirely, so projections can be built privately in the admin.
      showProjections: false,
      aboutHtml: DEFAULT_ABOUT,
      aboutBanner: { enabled: true, text: DEFAULT_BANNER_TEXT },
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
    // Opt-in: projections stay private unless explicitly published.
    data.showProjections = data.showProjections === true;
    if (typeof data.aboutHtml !== 'string') data.aboutHtml = DEFAULT_ABOUT;
    if (!data.aboutBanner || typeof data.aboutBanner !== 'object') {
      data.aboutBanner = { enabled: true, text: DEFAULT_BANNER_TEXT };
    } else {
      if (typeof data.aboutBanner.text !== 'string' || !data.aboutBanner.text.trim()) {
        data.aboutBanner.text = DEFAULT_BANNER_TEXT;
      }
      data.aboutBanner.enabled = data.aboutBanner.enabled !== false;
    }
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
    richTextToHtml: richTextToHtml,
    sanitizeHtml: sanitizeHtml,
    DEFAULT_ABOUT: DEFAULT_ABOUT,
    DEFAULT_BANNER_TEXT: DEFAULT_BANNER_TEXT,
    teamForSeed: teamForSeed,
    seedLabel: seedLabel,
    getClassConfig: getClassConfig,
    makeRegion: makeRegion,
  };
})(window);
