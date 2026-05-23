/* ============================================================
   publish/auth-store.js
   ------------------------------------------------------------
   Owns persistence of GitHub credentials (PAT today, OAuth
   tomorrow) plus the repo target (owner/repo/branch). Wraps
   localStorage with an optional WebCrypto AES-GCM lock keyed on
   the owner password.

   STORAGE SHAPE
     gurman.gh.cfg.v1   →   { owner, repo, branch, mode: 'one-click'|'pr',
                              workflow: 'pages.yml' }
     gurman.gh.auth.v1  →   { kind: 'pat'|'oauth',
                              token: '...',          // plaintext, unless locked
                              locked: false,
                              ciphertext, iv, salt   // when locked
                            }

   The token is plaintext by default — fine-grained PATs scoped
   to one repo with contents:write are revocable; this is the
   pragmatic baseline. Power users can call `lock(password)` to
   wrap the token with PBKDF2 + AES-GCM.
   ============================================================ */

(function () {
  'use strict';

  const CFG_KEY  = 'gurman.gh.cfg.v1';
  const AUTH_KEY = 'gurman.gh.auth.v1';

  const DEFAULT_CFG = {
    owner: '',
    repo: '',
    branch: 'main',
    mode: 'one-click',      // 'one-click' | 'pr'
    publishWorkflow: 'pages.yml',
    dataLayout: 'json',     // 'json' (data/*.json) — fixed for now, but recorded for future migrations
  };

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...fallback };
      return { ...fallback, ...JSON.parse(raw) };
    } catch {
      return { ...fallback };
    }
  }

  function save(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
  }

  /* ---------- WebCrypto helpers (PBKDF2 + AES-GCM) ---------- */

  async function deriveKey(password, salt) {
    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function fromB64(s) {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function encryptString(plain, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
      new TextEncoder().encode(plain));
    return { ciphertext: toB64(ct), iv: toB64(iv), salt: toB64(salt) };
  }

  async function decryptString({ ciphertext, iv, salt }, password) {
    const key = await deriveKey(password, fromB64(salt));
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(iv) },
      key,
      fromB64(ciphertext)
    );
    return new TextDecoder().decode(pt);
  }

  /* ---------- Public store ---------- */

  const AuthStore = {
    /* --- config (repo target, publish mode) --- */
    getCfg() { return load(CFG_KEY, DEFAULT_CFG); },
    setCfg(patch) {
      const next = { ...this.getCfg(), ...patch };
      save(CFG_KEY, next);
      this._notify();
      return next;
    },

    /* --- auth --- */
    getAuthRaw() { return load(AUTH_KEY, { kind: null, token: null, locked: false }); },

    /** Returns the active token. If locked, returns null until unlock() is called. */
    getToken() {
      const a = this.getAuthRaw();
      if (a.locked) return this._unlockedToken || null;
      return a.token || null;
    },

    getKind() { return this.getAuthRaw().kind; },

    isAuthed() { return !!this.getToken(); },
    isLocked() { return !!this.getAuthRaw().locked; },
    isUnlocked() { return this.isLocked() ? !!this._unlockedToken : this.isAuthed(); },

    setToken(token, kind = 'pat') {
      const next = { kind, token, locked: false };
      save(AUTH_KEY, next);
      this._unlockedToken = null;
      this._notify();
    },

    clear() {
      try { localStorage.removeItem(AUTH_KEY); } catch {}
      this._unlockedToken = null;
      this._notify();
    },

    /** Encrypt the current token under a password. Token is then unreadable
        from localStorage alone until unlock(password) is called. */
    async lock(password) {
      const a = this.getAuthRaw();
      if (!a.token) throw new Error('No token to lock');
      const enc = await encryptString(a.token, password);
      const next = { kind: a.kind, locked: true, token: null, ...enc };
      save(AUTH_KEY, next);
      this._unlockedToken = a.token;  // keep usable for this session
      this._notify();
    },

    async unlock(password) {
      const a = this.getAuthRaw();
      if (!a.locked) return true;
      const token = await decryptString(a, password);
      this._unlockedToken = token;
      this._notify();
      return true;
    },

    relock() {
      // forget the in-memory plaintext but keep ciphertext on disk
      this._unlockedToken = null;
      this._notify();
    },

    /** Drop the lock — token returns to plaintext storage. Requires unlock first. */
    async removeLock() {
      const t = this.getToken();
      if (!t) throw new Error('Cannot remove lock: token not currently available');
      const a = this.getAuthRaw();
      save(AUTH_KEY, { kind: a.kind, token: t, locked: false });
      this._notify();
    },

    /* --- listeners (Console UI reflects changes) --- */
    _listeners: new Set(),
    subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
    _notify() {
      try {
        for (const fn of this._listeners) fn(this.summary());
      } catch (e) { console.error('[auth-store]', e); }
    },

    summary() {
      const cfg = this.getCfg();
      const a = this.getAuthRaw();
      return {
        cfg,
        kind: a.kind,
        hasToken: !!(a.token || (a.locked && this._unlockedToken)),
        locked: !!a.locked,
        unlocked: !!this._unlockedToken,
        ready: !!cfg.owner && !!cfg.repo && (!!a.token || !!this._unlockedToken),
      };
    },
  };

  window.AuthStore = AuthStore;
})();
