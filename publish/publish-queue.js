/* ============================================================
   publish/publish-queue.js
   ------------------------------------------------------------
   Offline retry queue. Every publish attempt goes through here:
   if it succeeds, the entry is dropped. If it fails (network,
   rate limit, no token), the entry persists in localStorage and
   is retried automatically on the next page load and whenever
   the network/online event fires.

   STORAGE
     gurman.gh.queue.v1 → [{ id, scope, payload, attempts, lastError, queuedAt }]

   PUBLIC API
     PublishQueue.enqueue({ scope, payload, runner })
     PublishQueue.flush()          // try everything pending
     PublishQueue.list()
     PublishQueue.subscribe(fn)
   ============================================================ */

(function () {
  'use strict';
  const KEY = 'gurman.gh.queue.v1';
  const MAX_ATTEMPTS = 6;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(q) {
    try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
  }

  // Runner registry — populated by publisher.js so we can rehydrate
  // queue entries across reloads.
  const runners = new Map();

  const PublishQueue = {
    /** Register a named runner. Used by publisher.js on init. */
    registerRunner(name, fn) { runners.set(name, fn); },

    list() { return load(); },

    enqueue({ scope, payload, runner }) {
      if (!runners.has(runner)) {
        console.warn('[publish-queue] no runner registered for', runner);
      }
      const entry = {
        id: 'q-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        scope, payload, runner,
        attempts: 0, lastError: null,
        queuedAt: Date.now(),
      };
      const q = load();
      q.push(entry);
      save(q);
      this._notify();
      return entry;
    },

    remove(id) {
      save(load().filter(e => e.id !== id));
      this._notify();
    },

    async flush() {
      const q = load();
      if (!q.length) return { ran: 0, ok: 0, failed: 0 };
      let ok = 0, failed = 0;
      const survivors = [];
      for (const entry of q) {
        const runner = runners.get(entry.runner);
        if (!runner) { survivors.push(entry); continue; }
        try {
          await runner(entry.payload);
          ok++;
        } catch (e) {
          entry.attempts = (entry.attempts || 0) + 1;
          entry.lastError = String(e?.message || e);
          if (entry.attempts < MAX_ATTEMPTS) survivors.push(entry);
          failed++;
        }
      }
      save(survivors);
      this._notify();
      return { ran: q.length, ok, failed };
    },

    clear() { save([]); this._notify(); },

    _listeners: new Set(),
    subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
    _notify() {
      try { for (const fn of this._listeners) fn(this.list()); } catch (e) { console.error(e); }
    },
  };

  // Auto-flush on online + once at boot
  window.addEventListener('online', () => PublishQueue.flush());
  setTimeout(() => PublishQueue.flush(), 2000);

  window.PublishQueue = PublishQueue;
})();
