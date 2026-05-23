/* ============================================================
   publish/publisher.js
   ------------------------------------------------------------
   Domain-level publishing. This is the only module the React UI
   should talk to. It composes:

     AuthStore  → who am I, where am I publishing
     GithubAPI  → low-level REST
     DataStore  → in-memory canonical state
     PublishQueue → offline retry

   PUBLIC API
     Publisher.connect()                     // build client from AuthStore
     Publisher.publishPost(post, opts)
     Publisher.publishProject(project, opts)
     Publisher.publishStudy(item, opts)
     Publisher.deletePost(id, opts)
     Publisher.deleteProject(id, opts)
     Publisher.deleteStudy(id, opts)
     Publisher.statusAsync()                 // last-publish state, rate limit, recent commits
     Publisher.copyPatch(scope, item)        // fallback: clipboard

   OPTS
     { mode: 'one-click' | 'pr',           // override default
       message: 'commit subject',
       onProgress: fn(stage)
     }

   RETURN SHAPE
     { ok: true, mode: 'committed' | 'pr',
       commit?: { sha, url, message },
       pr?: { number, url, branch },
       scope, action: 'create'|'update'|'delete' }
     // or rejected with GHError. Caller decides whether to queue.
   ============================================================ */

(function () {
  'use strict';

  let gh = null;             // current GithubAPI client
  let lastStatus = null;     // cached for the Console
  let listeners = new Set();

  function notify(evt) {
    for (const fn of listeners) { try { fn(evt); } catch (e) { console.error(e); } }
  }

  function connect() {
    const a = window.AuthStore;
    const summary = a.summary();
    const { owner, repo, branch } = summary.cfg;
    if (!owner || !repo) throw new window.GHError('no_auth', 'Set repo target in the Owner Console first.');
    gh = window.GithubAPI({ owner, repo, branch });
    const token = a.getToken();
    if (token) gh.setAuth({ kind: a.getKind() || 'pat', token });
    // tiny reach-around so storage adapters can find it
    window.__gh = gh;
    return gh;
  }

  function client() {
    if (!gh) connect();
    return gh;
  }

  /* ---------- helpers ---------- */

  function defaultMode() {
    return (window.AuthStore?.getCfg()?.mode) || 'one-click';
  }

  function targetPath(scope) {
    const p = window.DataStore.path(scope);
    if (!p) throw new Error('unknown scope: ' + scope);
    return p;
  }

  function nextId(title, scope) {
    const slug = (title || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
    return slug || (scope[0] + '-' + Date.now());
  }

  /**
   * Merge an item into a list by id, prepending if new.
   * If item._deleted, drops it instead.
   */
  function mergeItem(list, item) {
    const idx = list.findIndex(x => x.id === item.id);
    if (item._deleted) {
      if (idx === -1) return list;
      const next = list.slice();
      next.splice(idx, 1);
      return next;
    }
    const clean = { ...item }; delete clean._deleted;
    if (idx === -1) return [clean, ...list];
    const next = list.slice();
    next[idx] = { ...next[idx], ...clean };
    return next;
  }

  async function commit({ scope, mutate, message, mode, onProgress }) {
    mode = mode || defaultMode();
    onProgress?.({ stage: 'connect' });
    const g = client();
    const path = targetPath(scope);

    onProgress?.({ stage: 'fetch' });
    const remote = await g.getFile(path);
    let current = [];
    if (remote && remote.decoded) {
      try { current = JSON.parse(remote.decoded); } catch { current = []; }
    } else {
      // Seed from in-memory state (handles bootstrap into an empty repo).
      current = window.DataStore.get(scope) || [];
    }

    const next = mutate(current);
    const content = JSON.stringify(next, null, 2) + '\n';

    let result;
    if (mode === 'pr') {
      const branchName = 'publish/' + scope + '-' + Date.now().toString(36);
      onProgress?.({ stage: 'branch', branch: branchName });
      await g.createBranch(branchName);
      onProgress?.({ stage: 'commit' });
      const put = await g.putFile(path, content, {
        sha: remote?.sha,
        message,
        br: branchName,
      });
      onProgress?.({ stage: 'pr' });
      const pr = await g.openPR({
        title: message,
        head: branchName,
        base: g.branch,
        body: 'Automated publish from the Owner Console.',
      });
      result = {
        ok: true, mode: 'pr',
        commit: { sha: put.commit?.sha, url: put.commit?.html_url, message },
        pr: { number: pr.number, url: pr.html_url, branch: branchName },
      };
    } else {
      onProgress?.({ stage: 'commit' });
      const put = await g.putFile(path, content, {
        sha: remote?.sha,
        message,
      });
      result = {
        ok: true, mode: 'committed',
        commit: { sha: put.commit?.sha, url: put.commit?.html_url, message },
      };
      // Update in-memory data immediately so the UI reflects the publish.
      window.DataStore.replace(scope, next, { source: 'json' });
    }

    notify({ type: 'publish:success', scope, ...result });
    return { ...result, scope };
  }

  /* ---------- domain ops ---------- */

  const Publisher = {
    connect,
    client,
    statusGetter() { return lastStatus; },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /** Light async status snapshot for the Console screen. */
    async statusAsync() {
      try {
        const g = client();
        const [user, repo, rate, recentCommits] = await Promise.all([
          g.whoami().catch(() => null),
          g.getRepo().catch(() => null),
          g.getRateLimit().catch(() => null),
          g.listCommits({ per_page: 8 }).catch(() => []),
        ]);
        lastStatus = {
          ok: true, ts: Date.now(),
          user: user && { login: user.login, avatar: user.avatar_url, name: user.name, url: user.html_url },
          repo: repo && { full: repo.full_name, url: repo.html_url, default: repo.default_branch, private: repo.private, pages: !!repo.has_pages },
          rate: rate?.rate,
          commits: Array.isArray(recentCommits) ? recentCommits.map(c => ({
            sha: c.sha, msg: c.commit?.message?.split('\n')[0] || '', author: c.commit?.author?.name, date: c.commit?.author?.date, url: c.html_url,
          })) : [],
        };
        return lastStatus;
      } catch (e) {
        lastStatus = { ok: false, ts: Date.now(), error: e.message, code: e.code };
        return lastStatus;
      }
    },

    /* ---- posts ---- */
    async publishPost(post, opts = {}) {
      const p = { ...post };
      if (!p.id) p.id = nextId(p.title, 'posts');
      const msg = opts.message || (post._deleted
        ? `[posts] delete ${p.id}`
        : `[posts] ${post._update ? 'update' : 'publish'} ${p.title || p.id}`);
      const action = post._deleted ? 'delete' : (post._update ? 'update' : 'create');
      return commit({
        scope: 'posts',
        mutate: list => mergeItem(list, p),
        message: msg,
        mode: opts.mode,
        onProgress: opts.onProgress,
      }).then(r => ({ ...r, action }));
    },
    async deletePost(id, opts = {}) {
      return this.publishPost({ id, _deleted: true }, opts);
    },

    /* ---- projects ---- */
    async publishProject(project, opts = {}) {
      const p = { ...project };
      if (!p.id) p.id = nextId(p.title, 'projects');
      const msg = opts.message || (project._deleted
        ? `[projects] delete ${p.id}`
        : `[projects] ${project._update ? 'update' : 'publish'} ${p.title || p.id}`);
      const action = project._deleted ? 'delete' : (project._update ? 'update' : 'create');
      return commit({
        scope: 'projects',
        mutate: list => mergeItem(list, p),
        message: msg,
        mode: opts.mode,
        onProgress: opts.onProgress,
      }).then(r => ({ ...r, action }));
    },
    async deleteProject(id, opts = {}) {
      return this.publishProject({ id, _deleted: true }, opts);
    },

    /* ---- study lab ---- */
    async publishStudy(item, opts = {}) {
      const p = { ...item };
      if (!p.id) p.id = 's-' + Date.now();
      if (p.url && /^data:|^blob:/.test(p.url)) {
        throw new Error('Cannot publish a local file (data:/blob: URL). Paste a public URL or wire up a storage adapter in the Owner Console.');
      }
      const msg = opts.message || (item._deleted
        ? `[study] delete ${p.id}`
        : `[study] ${item._update ? 'update' : 'publish'} ${p.title || p.id}`);
      const action = item._deleted ? 'delete' : (item._update ? 'update' : 'create');
      return commit({
        scope: 'study',
        mutate: list => mergeItem(list, p),
        message: msg,
        mode: opts.mode,
        onProgress: opts.onProgress,
      }).then(r => ({ ...r, action }));
    },
    async deleteStudy(id, opts = {}) {
      return this.publishStudy({ id, _deleted: true }, opts);
    },

    /* ---- fallback: copy a patch to the clipboard ---- */
    copyPatch(scope, item) {
      const current = window.DataStore.get(scope) || [];
      const next = mergeItem(current, item);
      const text = JSON.stringify(item._deleted
        ? { action: 'delete', scope, id: item.id }
        : { action: item._update ? 'update' : 'create', scope, item }, null, 2);
      const fileText = JSON.stringify(next, null, 2);
      try {
        navigator.clipboard.writeText(text);
      } catch {}
      return { patch: text, fullFile: fileText, path: targetPath(scope) };
    },
  };

  /* ---- register runners for the offline queue ---- */
  function registerRunners() {
    if (!window.PublishQueue) return;
    window.PublishQueue.registerRunner('posts',    p => Publisher.publishPost(p, { mode: p._mode }));
    window.PublishQueue.registerRunner('projects', p => Publisher.publishProject(p, { mode: p._mode }));
    window.PublishQueue.registerRunner('study',    p => Publisher.publishStudy(p, { mode: p._mode }));
  }

  /* ---- wrap each public op so failures auto-queue ---- */
  function withQueueFallback(scope, fn) {
    return async function (item, opts = {}) {
      try {
        return await fn(item, opts);
      } catch (e) {
        if (opts.noQueue) throw e;
        // Network / rate / 5xx? Queue. Auth/validation errors → throw.
        const qable = ['network', 'rate_limited'].includes(e.code) || (e.code && /^http_5/.test(e.code));
        if (qable && window.PublishQueue) {
          window.PublishQueue.enqueue({ scope, payload: { ...item, _mode: opts.mode }, runner: scope });
          return { ok: false, queued: true, error: e.message, code: e.code, scope };
        }
        throw e;
      }
    };
  }

  Publisher.publishPost    = withQueueFallback('posts',    Publisher.publishPost.bind(Publisher));
  Publisher.publishProject = withQueueFallback('projects', Publisher.publishProject.bind(Publisher));
  Publisher.publishStudy   = withQueueFallback('study',    Publisher.publishStudy.bind(Publisher));

  // Re-register on next tick (after queue module loads)
  setTimeout(registerRunners, 0);

  window.Publisher = Publisher;
})();
