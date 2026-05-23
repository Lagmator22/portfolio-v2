/* ============================================================
   publish/data-store.js
   ------------------------------------------------------------
   Source-of-truth loader for posts / projects / study items.

   STRATEGY: JSON-first, inline fallback.

     1. On page load, look for data/{posts,projects,study}.json
        siblings of the HTML file (relative fetch).
     2. If they exist and parse cleanly → use them. Set
        window.__POSTS etc. before the React app reads them.
     3. If a JSON file is missing or invalid → fall back to the
        inline `window.__POSTS = […]` literal already in the HTML.
        The site works with NO repo wiring, NO publishing layer.

   This means the site can ship in three states, in order of
   freshness:
     a) raw HTML opened from disk            → inline data
     b) static site on GH Pages, no JSON     → inline data
     c) published JSON files in data/        → JSON data (canonical)

   PUBLIC API
     await DataStore.hydrate();   // call once, before App renders
     DataStore.get('posts')       // → latest in-memory array
     DataStore.replace('posts', arr)  // bump local state; called by publisher
     DataStore.source('posts')    // → 'json' | 'inline'
   ============================================================ */

(function () {
  'use strict';

  const FILES = {
    posts:    'data/posts.json',
    projects: 'data/projects.json',
    study:    'data/study.json',
  };

  // Lift the inline arrays into Data Store state so the rest of
  // the React app doesn't care where they came from.
  function fallback(scope) {
    if (scope === 'posts')    return Array.isArray(window.__POSTS)    ? window.__POSTS    : [];
    if (scope === 'projects') return Array.isArray(window.__PROJECTS) ? window.__PROJECTS : [];
    if (scope === 'study')    return Array.isArray(window.__STUDY_DEFAULTS) ? window.__STUDY_DEFAULTS : [];
    return [];
  }

  const state = {
    posts:    { data: null, source: 'inline', loadedAt: null, sha: null },
    projects: { data: null, source: 'inline', loadedAt: null, sha: null },
    study:    { data: null, source: 'inline', loadedAt: null, sha: null },
  };

  async function fetchJSON(path) {
    // Bypass cache on hydrate so a fresh publish reflects on reload.
    try {
      const r = await fetch(path + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  }

  const DataStore = {
    async hydrate() {
      const [posts, projects, study] = await Promise.all([
        fetchJSON(FILES.posts),
        fetchJSON(FILES.projects),
        fetchJSON(FILES.study),
      ]);
      for (const [k, json] of [['posts', posts], ['projects', projects], ['study', study]]) {
        if (Array.isArray(json) && json.length) {
          state[k] = { data: json, source: 'json', loadedAt: Date.now(), sha: null };
          // Mirror to window so legacy code paths still work
          if (k === 'posts')    window.__POSTS    = json;
          if (k === 'projects') window.__PROJECTS = json;
          if (k === 'study')    window.__STUDY_DEFAULTS = json;
        } else {
          state[k] = { data: fallback(k), source: 'inline', loadedAt: Date.now(), sha: null };
        }
      }
      this._notify();
      return this;
    },

    get(scope) {
      const s = state[scope];
      return s?.data || fallback(scope);
    },

    source(scope) { return state[scope]?.source || 'inline'; },

    /** Called by publisher after a successful commit. */
    replace(scope, data, { source = 'json', sha = null } = {}) {
      state[scope] = { data, source, loadedAt: Date.now(), sha };
      if (scope === 'posts')    window.__POSTS    = data;
      if (scope === 'projects') window.__PROJECTS = data;
      if (scope === 'study')    window.__STUDY_DEFAULTS = data;
      this._notify();
    },

    path(scope) { return FILES[scope]; },

    _listeners: new Set(),
    subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
    _notify() {
      try { for (const fn of this._listeners) fn(); } catch (e) { console.error(e); }
    },
  };

  // Mirror inline STUDY_DEFAULTS into window so DataStore can read it.
  // The HTML's StudyLab references the const directly; we re-publish it
  // to window in the HTML so the fallback path here works.

  window.DataStore = DataStore;
})();
