/* ============================================================
   publish/github-api.js
   ------------------------------------------------------------
   Octokit-lite. Talks to the GitHub REST API using either a
   fine-grained Personal Access Token (today) or a future OAuth
   access token (tomorrow). Same interface for both — call
   `setAuth({kind, token})` once, then use the verbs.

   Designed to be tree-shakable into oblivion: zero deps, plain
   ES module exporting a single GithubAPI factory.

   NOTHING in here writes to localStorage. The Auth Store (in
   auth-store.js) handles persistence, locking, etc.
   ============================================================ */

(function () {
  'use strict';

  const API = 'https://api.github.com';

  /**
   * Decode base64 → utf-8 string. Handles GitHub's potential
   * \n-wrapped base64 payloads.
   */
  function b64decode(s) {
    const clean = s.replace(/\s+/g, '');
    const bin = atob(clean);
    // Convert binary string to UTF-8 properly:
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  /**
   * Encode utf-8 string → base64. GitHub wants plain base64,
   * no line breaks for short payloads.
   */
  function b64encode(s) {
    const bytes = new TextEncoder().encode(s);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  /**
   * Construct a GithubAPI client bound to {owner, repo, branch}.
   * Call `setAuth` to attach credentials.
   */
  function GithubAPI({ owner, repo, branch = 'main' } = {}) {
    let auth = null; // { kind: 'pat' | 'oauth', token: '...' }

    async function req(path, opts = {}) {
      if (!auth?.token && !opts.anonymous) {
        throw new GHError('no_auth', 'No GitHub token set. Open the Owner Console to add one.');
      }
      const headers = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(opts.headers || {}),
      };
      if (auth?.token && !opts.anonymous) {
        headers.Authorization = 'Bearer ' + auth.token;
      }
      if (opts.body && typeof opts.body !== 'string') {
        headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(opts.body);
      }
      let res;
      try {
        res = await fetch(API + path, { ...opts, headers });
      } catch (e) {
        throw new GHError('network', 'Network unreachable. ' + e.message, { cause: e });
      }
      const rate = {
        limit: +res.headers.get('x-ratelimit-limit') || null,
        remaining: +res.headers.get('x-ratelimit-remaining') || null,
        reset: +res.headers.get('x-ratelimit-reset') || null,
      };
      if (res.status === 204) return { ok: true, rate };
      let json = null;
      const txt = await res.text();
      try { json = txt ? JSON.parse(txt) : null; } catch {}
      if (!res.ok) {
        const msg = (json && json.message) || res.statusText || 'request failed';
        const code = res.status === 401 ? 'unauthorized'
                   : res.status === 403 && rate.remaining === 0 ? 'rate_limited'
                   : res.status === 403 ? 'forbidden'
                   : res.status === 404 ? 'not_found'
                   : res.status === 409 ? 'conflict'
                   : res.status === 422 ? 'invalid'
                   : 'http_' + res.status;
        throw new GHError(code, msg, { status: res.status, body: json, rate });
      }
      return { ...json, _rate: rate };
    }

    return {
      get owner() { return owner; },
      get repo() { return repo; },
      get branch() { return branch; },
      get authed() { return !!auth?.token; },

      setRepo({ owner: o, repo: r, branch: b }) {
        if (o) owner = o; if (r) repo = r; if (b) branch = b;
      },
      setAuth(next) { auth = next; },
      clearAuth() { auth = null; },

      /* ------------ user + repo introspection ------------ */
      async whoami() {
        return req('/user');
      },
      async getRepo() {
        return req(`/repos/${owner}/${repo}`);
      },
      async getRateLimit() {
        return req('/rate_limit');
      },
      async listCommits({ path, per_page = 10 } = {}) {
        const q = new URLSearchParams({ sha: branch, per_page: String(per_page) });
        if (path) q.set('path', path);
        return req(`/repos/${owner}/${repo}/commits?${q}`);
      },

      /* ------------ contents API (single-file ops) ------------ */
      /**
       * GET a file. Returns { sha, decoded, raw } or null if not found.
       */
      async getFile(path, { ref = branch } = {}) {
        try {
          const r = await req(`/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(ref)}`);
          return {
            sha: r.sha,
            size: r.size,
            decoded: r.encoding === 'base64' ? b64decode(r.content) : r.content,
            raw: r,
          };
        } catch (e) {
          if (e.code === 'not_found') return null;
          throw e;
        }
      },

      /**
       * PUT a file. Pass sha when updating; omit when creating.
       * Returns { commit, content }.
       */
      async putFile(path, content, { sha, message, br = branch, committer } = {}) {
        const body = {
          message: message || `update ${path}`,
          content: b64encode(typeof content === 'string' ? content : JSON.stringify(content, null, 2)),
          branch: br,
        };
        if (sha) body.sha = sha;
        if (committer) body.committer = committer;
        return req(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
          method: 'PUT', body,
        });
      },

      /**
       * DELETE a file. Returns { commit, content }.
       */
      async deleteFile(path, { sha, message, br = branch } = {}) {
        if (!sha) {
          const existing = await this.getFile(path, { ref: br });
          if (!existing) return null;
          sha = existing.sha;
        }
        return req(`/repos/${owner}/${repo}/contents/${encodeURI(path)}`, {
          method: 'DELETE',
          body: { message: message || `delete ${path}`, sha, branch: br },
        });
      },

      /* ------------ branches + PRs ------------ */
      async getRef(refName) {
        return req(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(refName)}`);
      },
      async createBranch(name, fromRef = branch) {
        const src = await this.getRef(fromRef);
        return req(`/repos/${owner}/${repo}/git/refs`, {
          method: 'POST',
          body: { ref: `refs/heads/${name}`, sha: src.object.sha },
        });
      },
      async openPR({ title, head, base = branch, body = '' }) {
        return req(`/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          body: { title, head, base, body },
        });
      },

      /* ------------ workflow dispatch (CI nudges) ------------ */
      async dispatchWorkflow(workflowFile, { ref = branch, inputs = {} } = {}) {
        return req(`/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
          method: 'POST',
          body: { ref, inputs },
        });
      },

      /* ------------ tree commit (atomic multi-file) ------------ */
      /**
       * Commit multiple files in one commit. files = [{path, content}]
       * Returns the new commit object.
       */
      async commitTree(files, { message, br = branch } = {}) {
        const ref = await this.getRef(br);
        const baseCommit = await req(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
        const blobs = await Promise.all(files.map(async (f) => {
          const blob = await req(`/repos/${owner}/${repo}/git/blobs`, {
            method: 'POST',
            body: { content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2), encoding: 'utf-8' },
          });
          return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
        }));
        const tree = await req(`/repos/${owner}/${repo}/git/trees`, {
          method: 'POST',
          body: { base_tree: baseCommit.tree.sha, tree: blobs },
        });
        const commit = await req(`/repos/${owner}/${repo}/git/commits`, {
          method: 'POST',
          body: { message: message || `update ${files.length} files`, tree: tree.sha, parents: [ref.object.sha] },
        });
        await req(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(br)}`, {
          method: 'PATCH',
          body: { sha: commit.sha },
        });
        return commit;
      },
    };
  }

  /**
   * Strongly-typed-ish error for catch-side dispatch.
   * codes: no_auth | network | unauthorized | rate_limited | forbidden
   *      | not_found | conflict | invalid | http_NNN
   */
  class GHError extends Error {
    constructor(code, message, extra = {}) {
      super(message);
      this.name = 'GHError';
      this.code = code;
      Object.assign(this, extra);
    }
  }

  /* expose */
  window.GithubAPI = GithubAPI;
  window.GHError = GHError;
})();
