/* ============================================================
   publish/storage-adapter.js
   ------------------------------------------------------------
   Pluggable media-storage interface. The portfolio publishes
   "links only" today — every Study Lab resource has to point at
   a real URL on a host you control. This module exists so that
   when you wire up free object storage (Cloudflare R2 free tier,
   Backblaze B2 10GB free, GitHub Releases, etc) the rest of the
   app doesn't have to change.

   USAGE
     const adapter = StorageAdapter.current();
     const { url } = await adapter.upload(file, { hint: 'study-lab' });
     // → returns a public URL or throws if the adapter is `none`.

   ADAPTERS SHIPPED
     none          — refuses uploads, instructs user to paste a URL.
     r2 (stub)     — placeholder for Cloudflare R2 via presigned URL.
     b2 (stub)     — placeholder for Backblaze B2 via presigned URL.
     gh-release    — uploads as an asset on a 'media' GitHub Release.
                     Works for files <2GB. Free, no extra signup, but
                     not optimized for hotlinking large media.

   To enable an adapter:
     StorageAdapter.configure('gh-release', { tag: 'media' });
     localStorage gurman.gh.storage.v1
   ============================================================ */

(function () {
  'use strict';
  const KEY = 'gurman.gh.storage.v1';

  /* ---------- adapter implementations ---------- */

  const adapters = {
    none: {
      label: 'none — paste a URL',
      description: 'No upload. You paste a link to Drive / YouTube / etc. Best default until you wire up storage.',
      configurable: false,
      async upload() {
        throw new Error('No storage adapter configured. Paste a URL instead, or wire up a free adapter in the Owner Console.');
      },
    },

    'gh-release': {
      label: 'GitHub Release assets',
      description: 'Free. Uploads files as assets on a sentinel GitHub release (default tag: "media"). Best for medium files (<2GB each). Public read.',
      configurable: true,
      configSchema: [
        { key: 'tag', label: 'release tag', default: 'media' },
      ],
      async upload(file, opts = {}, ctx = {}) {
        const { gh, cfg } = ctx;
        if (!gh) throw new Error('GitHub client unavailable. Connect a token first.');
        const tag = (opts.tag || cfg.tag || 'media');
        // Ensure release exists
        let release;
        try {
          release = await gh._raw(`/repos/${gh.owner}/${gh.repo}/releases/tags/${encodeURIComponent(tag)}`, { method: 'GET' });
        } catch (e) {
          if (e.code !== 'not_found') throw e;
          release = await gh._raw(`/repos/${gh.owner}/${gh.repo}/releases`, {
            method: 'POST',
            body: { tag_name: tag, name: 'media', body: 'Media assets uploaded from the Owner Console.', draft: false, prerelease: false },
          });
        }
        // Upload asset (uses the releases upload host)
        const uploadUrl = release.upload_url.replace('{?name,label}', '?name=' + encodeURIComponent(file.name));
        const buf = await file.arrayBuffer();
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + ctx.token,
            'Content-Type': file.type || 'application/octet-stream',
            Accept: 'application/vnd.github+json',
          },
          body: buf,
        });
        if (!res.ok) throw new Error('Asset upload failed: ' + res.status);
        const asset = await res.json();
        return { url: asset.browser_download_url, bytes: asset.size, name: asset.name };
      },
    },

    'r2': {
      label: 'Cloudflare R2 (stub)',
      description: 'Cloudflare R2 free tier: 10GB storage, 1M Class A ops/mo. Requires a worker that signs upload URLs (see _github/scripts/r2-worker.md).',
      configurable: true,
      stub: true,
      configSchema: [
        { key: 'workerUrl', label: 'signing-worker url' },
        { key: 'bucket', label: 'bucket name' },
      ],
      async upload() {
        throw new Error('R2 adapter is a stub. See _github/storage-adapters.md to deploy the signing worker.');
      },
    },

    'b2': {
      label: 'Backblaze B2 (stub)',
      description: 'Backblaze B2 free tier: 10GB storage, 1GB/day download. Requires a signing endpoint.',
      configurable: true,
      stub: true,
      configSchema: [
        { key: 'signerUrl', label: 'signing endpoint' },
        { key: 'bucket', label: 'bucket name' },
      ],
      async upload() {
        throw new Error('B2 adapter is a stub. See _github/storage-adapters.md.');
      },
    },
  };

  /* ---------- store ---------- */

  function loadCfg() {
    try {
      const r = JSON.parse(localStorage.getItem(KEY));
      if (r && r.kind) return r;
    } catch {}
    return { kind: 'none', config: {} };
  }

  function saveCfg(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
  }

  const StorageAdapter = {
    list() { return Object.entries(adapters).map(([k, v]) => ({ key: k, ...v })); },
    get(key) { return adapters[key] || null; },
    currentKey() { return loadCfg().kind; },
    currentConfig() { return loadCfg().config || {}; },
    configure(key, config = {}) {
      if (!adapters[key]) throw new Error('Unknown adapter: ' + key);
      saveCfg({ kind: key, config });
    },
    current() {
      const { kind, config } = loadCfg();
      const adapter = adapters[kind] || adapters.none;
      const ctx = () => ({
        gh: window.__gh,
        token: window.AuthStore?.getToken(),
        cfg: config,
      });
      return {
        kind,
        label: adapter.label,
        async upload(file, opts = {}) {
          return adapter.upload(file, { ...config, ...opts }, ctx());
        },
      };
    },
  };

  window.StorageAdapter = StorageAdapter;
})();
