/* ============================================================
   publish/owner-console.jsx
   ------------------------------------------------------------
   Full-page owner-only Settings screen.

   PANELS
     · Connection   — token paste, repo target, fine-grained PAT walkthrough
     · Status       — authed user, repo, GitHub rate limit
     · Publish      — last publish, mode (one-click / PR), workflow toggles
     · Recent       — last 8 commits with author / message / SHA / link
     · Queue        — offline retry queue, manual flush
     · Storage      — pluggable media adapter picker (none / R2 / B2 / gh-release)
     · Security     — optional password-lock for the stored token

   Reads from AuthStore + Publisher + PublishQueue + StorageAdapter.
   Mutates via AuthStore.setCfg / Publisher.publishX / etc.

   Exposed as `window.OwnerConsole` for the host HTML to mount on
   the `/console` hash route.
   ============================================================ */

(function () {
  const { useState, useEffect, useMemo, useCallback } = React;

  /* ---------- shared bits ---------- */

  function Field({ label, hint, children }) {
    return (
      <div className="ocf">
        <label className="ocf__label">{label}</label>
        {children}
        {hint && <p className="ocf__hint">{hint}</p>}
      </div>
    );
  }

  function Card({ title, kicker, right, children, accent }) {
    return (
      <section className="oc-card" style={accent ? { '--card-accent': accent } : null}>
        <header className="oc-card__hd">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            <h3 className="oc-card__title">{title}</h3>
          </div>
          {right && <div className="oc-card__right">{right}</div>}
        </header>
        <div className="oc-card__bd">{children}</div>
      </section>
    );
  }

  function Pill({ ok, warn, error, children }) {
    const cls = error ? 'oc-pill oc-pill--err' : warn ? 'oc-pill oc-pill--warn' : ok ? 'oc-pill oc-pill--ok' : 'oc-pill';
    return <span className={cls}>{children}</span>;
  }

  function ShortSha({ sha }) {
    if (!sha) return null;
    return <code className="oc-sha">{sha.slice(0, 7)}</code>;
  }

  function Spinner() {
    return <span className="oc-spin" aria-hidden="true" />;
  }

  function timeAgo(iso) {
    if (!iso) return '';
    const t = typeof iso === 'number' ? iso : new Date(iso).getTime();
    if (!t) return '';
    const d = Date.now() - t;
    if (d < 60_000) return Math.max(1, Math.round(d / 1000)) + 's ago';
    if (d < 3_600_000) return Math.round(d / 60_000) + 'm ago';
    if (d < 86_400_000) return Math.round(d / 3_600_000) + 'h ago';
    return Math.round(d / 86_400_000) + 'd ago';
  }

  /* ---------- connection panel ---------- */

  function ConnectionPanel({ summary, refresh }) {
    const [cfg, setCfg] = useState(summary.cfg);
    const [token, setToken] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => { setCfg(summary.cfg); }, [summary.cfg.owner, summary.cfg.repo, summary.cfg.branch, summary.cfg.mode]);

    const saveCfg = () => {
      window.AuthStore.setCfg(cfg);
      setMsg({ ok: true, text: 'Saved repo target.' });
    };

    const saveToken = async () => {
      if (!token) return;
      setBusy(true); setMsg(null);
      window.AuthStore.setToken(token.trim(), 'pat');
      setToken('');
      try {
        const status = await window.Publisher.statusAsync();
        setMsg(status.ok
          ? { ok: true, text: 'Token verified. Signed in as @' + (status.user?.login || '?') + '.' }
          : { ok: false, text: 'Saved, but verification failed: ' + status.error });
      } catch (e) {
        setMsg({ ok: false, text: e.message });
      } finally {
        setBusy(false);
        refresh();
      }
    };

    const clearToken = () => {
      if (!confirm('Forget the GitHub token from this device?')) return;
      window.AuthStore.clear();
      refresh();
    };

    return (
      <Card title="Connection" kicker="01 / GITHUB TOKEN">
        <Field label="repo owner" hint="Your GitHub username or org. e.g. Lagmator22">
          <input className="oc-input" value={cfg.owner} onChange={e => setCfg({ ...cfg, owner: e.target.value })} placeholder="Lagmator22" />
        </Field>
        <Field label="repo name">
          <input className="oc-input" value={cfg.repo} onChange={e => setCfg({ ...cfg, repo: e.target.value })} placeholder="Portfolio" />
        </Field>
        <div className="oc-row">
          <Field label="branch">
            <input className="oc-input" value={cfg.branch} onChange={e => setCfg({ ...cfg, branch: e.target.value })} placeholder="main" />
          </Field>
          <Field label="publish mode">
            <select className="oc-input" value={cfg.mode} onChange={e => setCfg({ ...cfg, mode: e.target.value })}>
              <option value="one-click">one-click — commit straight to branch</option>
              <option value="pr">staged — open a PR</option>
            </select>
          </Field>
        </div>
        <div className="oc-actions">
          <button className="btn btn--sm" onClick={saveCfg}>save target</button>
        </div>

        <hr className="oc-hr" />

        <Field
          label="fine-grained personal access token"
          hint={<>Create at <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">github.com/settings/personal-access-tokens/new</a>. Scope: <em>this single repo</em>. Permissions: <code>Contents · Read &amp; Write</code>, <code>Pull requests · Read &amp; Write</code>, <code>Workflows · Read &amp; Write</code> (optional). Expires in 1y is fine — you'll get reminded.</>}>
          <div className="oc-tokenrow">
            <input
              className="oc-input"
              type={show ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={summary.hasToken ? '•••••••• (token already saved — paste to replace)' : 'github_pat_…'}
              autoComplete="off"
              spellCheck="false"
            />
            <button className="btn btn--sm" type="button" onClick={() => setShow(s => !s)}>{show ? 'hide' : 'show'}</button>
          </div>
        </Field>
        <div className="oc-actions">
          <button className="btn btn--primary btn--sm" disabled={!token || busy} onClick={saveToken}>
            {busy ? <><Spinner /> verifying</> : (summary.hasToken ? 'replace token' : 'save & verify')}
          </button>
          {summary.hasToken && <button className="btn btn--sm" onClick={clearToken}>forget token</button>}
          <button className="btn btn--sm" disabled={!summary.hasToken || busy} onClick={async () => {
            setBusy(true);
            const r = await window.Publisher.statusAsync();
            setMsg(r.ok ? { ok: true, text: 'Verified. ' + (r.user?.login || '') } : { ok: false, text: r.error });
            setBusy(false);
            refresh();
          }}>verify</button>
        </div>
        {msg && <p className={msg.ok ? 'oc-msg oc-msg--ok' : 'oc-msg oc-msg--err'}>{msg.text}</p>}

        <details className="oc-details">
          <summary>OAuth (later) — wire up sign-in via Cloudflare Worker</summary>
          <p>The token flow above is PAT-based, which lives in your browser's localStorage. To upgrade to a real "sign in with GitHub" flow without paying for a backend, deploy the Cloudflare Worker template at <code>_github/cloudflare/oauth-worker</code> (free tier, 100k req/day). The worker exchanges OAuth codes for tokens; this Console will auto-detect it and replace the PAT field with a Sign-In button. The <code>AuthStore</code> already supports a <code>kind: 'oauth'</code> token — no other changes needed.</p>
        </details>
      </Card>
    );
  }

  /* ---------- status / repo / rate-limit ---------- */

  function StatusPanel({ summary, status, busy, refresh }) {
    if (!summary.cfg.owner || !summary.cfg.repo) {
      return <Card title="Status" kicker="02 / SIGNAL">
        <p className="oc-empty">Set a repo target above to see status.</p>
      </Card>;
    }
    if (busy && !status) return <Card title="Status" kicker="02 / SIGNAL"><p className="oc-empty"><Spinner /> checking…</p></Card>;
    if (!status) return <Card title="Status" kicker="02 / SIGNAL"><p className="oc-empty">No status yet.</p></Card>;

    if (!status.ok) {
      return (
        <Card title="Status" kicker="02 / SIGNAL" right={<button className="btn btn--sm" onClick={refresh}>retry</button>}>
          <p className="oc-msg oc-msg--err">
            <strong>{status.code || 'error'}</strong> — {status.error}
          </p>
          {status.code === 'no_auth' && <p className="oc-empty">Paste a token in the Connection panel above.</p>}
          {status.code === 'unauthorized' && <p className="oc-empty">Token rejected. It may be expired or scoped wrong.</p>}
          {status.code === 'not_found' && <p className="oc-empty">Repo not found, or the token can't see it.</p>}
        </Card>
      );
    }

    const rate = status.rate || {};
    const ratePct = rate.limit ? Math.round((rate.remaining / rate.limit) * 100) : null;
    const resetIn = rate.reset ? Math.max(0, rate.reset * 1000 - Date.now()) : 0;

    return (
      <Card title="Status" kicker="02 / SIGNAL" right={<button className="btn btn--sm" disabled={busy} onClick={refresh}>{busy ? <Spinner /> : 'refresh'}</button>}>
        <div className="oc-stats">
          <div className="oc-stat">
            <div className="oc-stat__k">signed in as</div>
            <div className="oc-stat__v">
              {status.user
                ? <a href={status.user.url} target="_blank" rel="noopener noreferrer">@{status.user.login}</a>
                : <Pill warn>anonymous</Pill>}
            </div>
          </div>
          <div className="oc-stat">
            <div className="oc-stat__k">repo</div>
            <div className="oc-stat__v">
              {status.repo
                ? <><a href={status.repo.url} target="_blank" rel="noopener noreferrer">{status.repo.full}</a>{' '}
                    <Pill ok={status.repo.pages}>{status.repo.pages ? 'pages on' : 'pages off'}</Pill>
                    {status.repo.private && <Pill>private</Pill>}
                  </>
                : <Pill error>not found</Pill>}
            </div>
          </div>
          <div className="oc-stat">
            <div className="oc-stat__k">api rate</div>
            <div className="oc-stat__v">
              <Pill ok={ratePct === null || ratePct > 30} warn={ratePct !== null && ratePct <= 30} error={ratePct !== null && ratePct < 5}>
                {rate.remaining ?? '–'} / {rate.limit ?? '–'} {ratePct !== null && `(${ratePct}%)`}
              </Pill>
              {resetIn > 0 && <span className="oc-stat__sub">resets in {Math.ceil(resetIn / 60000)}m</span>}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  /* ---------- recent commits ---------- */

  function RecentPanel({ status, busy }) {
    if (!status?.ok) return null;
    const commits = status.commits || [];
    return (
      <Card title="Recent commits" kicker="03 / HISTORY">
        {commits.length === 0 ? (
          <p className="oc-empty">{busy ? <><Spinner /> loading…</> : 'No commits yet.'}</p>
        ) : (
          <ol className="oc-commits">
            {commits.map(c => (
              <li key={c.sha} className="oc-commit">
                <a className="oc-commit__msg" href={c.url} target="_blank" rel="noopener noreferrer">{c.msg}</a>
                <div className="oc-commit__meta">
                  <ShortSha sha={c.sha} />
                  <span>{c.author}</span>
                  <span>·</span>
                  <span>{timeAgo(c.date)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    );
  }

  /* ---------- offline queue ---------- */

  function QueuePanel() {
    const [list, setList] = useState(() => window.PublishQueue?.list() || []);
    const [flushing, setFlushing] = useState(false);
    useEffect(() => window.PublishQueue?.subscribe(setList), []);
    const flush = async () => {
      setFlushing(true);
      try {
        const r = await window.PublishQueue.flush();
        if (r.failed) alert(`Flushed ${r.ok} ok, ${r.failed} failed.`);
      } finally { setFlushing(false); }
    };
    return (
      <Card title="Offline queue" kicker="04 / RETRY"
        right={list.length > 0 && (
          <div className="oc-actions">
            <button className="btn btn--sm" disabled={flushing} onClick={flush}>
              {flushing ? <><Spinner /> retrying</> : 'retry now'}
            </button>
            <button className="btn btn--sm" onClick={() => { if (confirm('Drop all pending publishes?')) window.PublishQueue.clear(); }}>clear</button>
          </div>
        )}>
        {list.length === 0
          ? <p className="oc-empty">Empty. Publishes that fail (network, rate-limit, 5xx) appear here for retry.</p>
          : <ol className="oc-queue">
              {list.map(e => (
                <li key={e.id} className="oc-queue__item">
                  <span className="oc-queue__scope">[{e.scope}]</span>
                  <span className="oc-queue__title">{e.payload.title || e.payload.id || '?'}</span>
                  <span className="oc-queue__meta">
                    {e.attempts}× · {timeAgo(e.queuedAt)}
                    {e.lastError && <em className="oc-msg--err"> · {e.lastError}</em>}
                  </span>
                </li>
              ))}
            </ol>}
      </Card>
    );
  }

  /* ---------- storage adapter ---------- */

  function StoragePanel() {
    const [kind, setKind] = useState(() => window.StorageAdapter.currentKey());
    const [config, setConfig] = useState(() => window.StorageAdapter.currentConfig());
    const list = window.StorageAdapter.list();
    const def = list.find(a => a.key === kind);
    const save = () => {
      window.StorageAdapter.configure(kind, config);
      alert('Saved. New uploads will use ' + (def?.label || kind) + '.');
    };
    return (
      <Card title="Media storage" kicker="05 / UPLOADS">
        <p className="oc-empty" style={{ marginTop: 0 }}>
          The portfolio publishes links by default — every Study Lab resource points at a URL on a host you control. Wire up free object storage to drop files in directly. None of this costs money under normal hobby load.
        </p>
        <Field label="adapter">
          <select className="oc-input" value={kind} onChange={e => { setKind(e.target.value); setConfig({}); }}>
            {list.map(a => (
              <option key={a.key} value={a.key}>{a.label}{a.stub ? ' (stub)' : ''}</option>
            ))}
          </select>
        </Field>
        {def?.description && <p className="oc-msg">{def.description}</p>}
        {(def?.configSchema || []).map(f => (
          <Field key={f.key} label={f.label}>
            <input className="oc-input" value={config[f.key] || ''} onChange={e => setConfig({ ...config, [f.key]: e.target.value })} placeholder={f.default || ''} />
          </Field>
        ))}
        <div className="oc-actions">
          <button className="btn btn--primary btn--sm" onClick={save}>save adapter</button>
        </div>
      </Card>
    );
  }

  /* ---------- security: lock token under password ---------- */

  function SecurityPanel({ summary, refresh }) {
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const onLock = async () => {
      if (!pw || pw.length < 8) { setMsg({ ok: false, text: 'Use 8+ characters.' }); return; }
      if (pw !== pw2) { setMsg({ ok: false, text: 'Passwords don\'t match.' }); return; }
      setBusy(true);
      try {
        await window.AuthStore.lock(pw);
        setMsg({ ok: true, text: 'Locked. Token re-encrypted with AES-GCM (PBKDF2, 250k iterations).' });
        setPw(''); setPw2('');
      } catch (e) { setMsg({ ok: false, text: e.message }); }
      finally { setBusy(false); refresh(); }
    };
    const onUnlock = async () => {
      setBusy(true);
      try {
        await window.AuthStore.unlock(pw);
        setMsg({ ok: true, text: 'Unlocked for this session.' });
        setPw('');
      } catch (e) { setMsg({ ok: false, text: 'Wrong password.' }); }
      finally { setBusy(false); refresh(); }
    };
    const onRemoveLock = async () => {
      setBusy(true);
      try {
        await window.AuthStore.removeLock();
        setMsg({ ok: true, text: 'Removed lock — token is now plaintext in localStorage.' });
      } catch (e) { setMsg({ ok: false, text: e.message }); }
      finally { setBusy(false); refresh(); }
    };

    if (!summary.hasToken) {
      return (
        <Card title="Security" kicker="06 / LOCK">
          <p className="oc-empty">Save a token first to enable locking.</p>
        </Card>
      );
    }

    if (summary.locked) {
      return (
        <Card title="Security" kicker="06 / LOCK">
          <p className="oc-msg">
            Token is <Pill ok>encrypted at rest</Pill>{summary.unlocked && <> · <Pill>session unlocked</Pill></>}. The plaintext only exists in memory while you're signed in this session.
          </p>
          {!summary.unlocked && (
            <>
              <Field label="lock password">
                <input className="oc-input" type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && onUnlock()} />
              </Field>
              <div className="oc-actions">
                <button className="btn btn--primary btn--sm" disabled={busy || !pw} onClick={onUnlock}>{busy ? <Spinner /> : 'unlock for this session'}</button>
              </div>
            </>
          )}
          <div className="oc-actions" style={{ marginTop: 16 }}>
            {summary.unlocked && <button className="btn btn--sm" onClick={() => { window.AuthStore.relock(); refresh(); }}>relock now</button>}
            <button className="btn btn--sm" disabled={!summary.unlocked} onClick={onRemoveLock}>remove lock</button>
          </div>
          {msg && <p className={msg.ok ? 'oc-msg oc-msg--ok' : 'oc-msg oc-msg--err'}>{msg.text}</p>}
        </Card>
      );
    }

    return (
      <Card title="Security" kicker="06 / LOCK">
        <p className="oc-msg">
          Token is <Pill warn>stored plaintext</Pill> in localStorage. Acceptable for a single-repo fine-grained PAT, but you can encrypt it with a passphrase. WebCrypto AES-GCM + PBKDF2 (250k iter, SHA-256). You'll be prompted for the passphrase once per session.
        </p>
        <div className="oc-row">
          <Field label="passphrase"><input className="oc-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="8+ chars" /></Field>
          <Field label="confirm"><input className="oc-input" type="password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
        </div>
        <div className="oc-actions">
          <button className="btn btn--primary btn--sm" disabled={busy || !pw} onClick={onLock}>{busy ? <Spinner /> : 'lock token'}</button>
        </div>
        {msg && <p className={msg.ok ? 'oc-msg oc-msg--ok' : 'oc-msg oc-msg--err'}>{msg.text}</p>}
      </Card>
    );
  }

  /* ---------- data sources panel ---------- */

  function DataSourcesPanel() {
    const scopes = ['posts', 'projects', 'study'];
    const sources = scopes.map(s => ({
      scope: s,
      path: window.DataStore.path(s),
      source: window.DataStore.source(s),
      count: (window.DataStore.get(s) || []).length,
    }));
    return (
      <Card title="Data sources" kicker="07 / WHERE CONTENT LIVES">
        <p className="oc-empty" style={{ marginTop: 0 }}>
          The site loads each surface from <code>data/*.json</code> if present, otherwise from inline arrays in the HTML. Publishing writes the JSON file. Either source works — empty repo, no problem.
        </p>
        <table className="oc-table">
          <thead><tr><th>scope</th><th>path</th><th>source</th><th>items</th></tr></thead>
          <tbody>
            {sources.map(s => (
              <tr key={s.scope}>
                <td>{s.scope}</td>
                <td><code>{s.path}</code></td>
                <td><Pill ok={s.source === 'json'}>{s.source}</Pill></td>
                <td>{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  /* ---------- dev notes panel ----------
     Aggregates the inline code comments and the private-notes/ docs into a
     tabbed reference that only renders inside the Owner Console (i.e. only
     after the SHA-256 unlock). Recruiters never see it.
  ----------------------------------------- */
  function DevNotesPanel() {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('arch');

    const TABS = [
      { id: 'arch',     label: 'Architecture' },
      { id: 'owner',    label: 'Owner / Password' },
      { id: 'posts',    label: 'Posts' },
      { id: 'projects', label: 'Projects' },
      { id: 'study',    label: 'Study Lab' },
      { id: 'monsters', label: 'Monsters' },
      { id: 'contact',  label: 'Contact form' },
      { id: 'storage',  label: 'Media storage' },
      { id: 'csp',      label: 'CSP / security' },
    ];

    const codeStyle = { display:'block', whiteSpace:'pre-wrap', background:'var(--bg-sunken)', padding:'12px 14px', borderRadius:8, fontSize:12, lineHeight:1.55, fontFamily:'var(--font-mono)', color:'var(--ink-2)', overflowX:'auto' };
    const H = ({ children }) => <h4 style={{ fontFamily:'var(--font-display)', fontSize:16, fontWeight:600, letterSpacing:'-0.01em', margin:'18px 0 8px', color:'var(--ink)' }}>{children}</h4>;
    const P = ({ children }) => <p style={{ margin:'0 0 10px', color:'var(--ink-2)' }}>{children}</p>;

    const content = {
      arch: (<>
        <P>Single-file vanilla HTML + React (in-browser Babel). No build step. The git repo on disk is at <code>portfolioV2ori/project/</code> (origin = <code>Lagmator22/Portfolio</code>). The bundle root <code>portfolioV2ori/</code> is NOT a git repo and contains <code>private-notes/</code>, a git-ignored folder with full versions of every doc that used to live in the repo.</P>
        <H>File map</H>
        <pre style={codeStyle}>{`index.html              Whole site — head, data arrays, cursor FX,
                        React app (Home / Projects / Blog / Study /
                        About / Contact / Console).
data/
  posts.json            Published posts (overrides inline __POSTS).
  projects.json         Published projects (overrides inline).
  study.json            Published study items (overrides inline).
publish/
  auth-store.js         PAT persistence + optional AES-GCM lock.
  github-api.js         REST client.
  data-store.js         JSON-first loader, inline fallback.
  publish-queue.js      Offline retry queue.
  storage-adapter.js    Pluggable media uploaders.
  publisher.js          High-level publish ops.
  owner-console.jsx     This screen.
  publish-button.jsx    Reusable publish control.
.github/workflows/
  pages.yml             GitHub Pages deploy on push to main.
  site-hooks.yml        Regenerates sitemap.xml + og.png on data
                        changes (commits with [skip ci]).
private-notes/          Git-ignored. Full owner setup guide,
                        storage adapters, oauth-worker template,
                        architecture overview.`}</pre>
        <H>How runtime data flows</H>
        <P>Boot: <code>DataStore.hydrate()</code> fetches <code>data/*.json</code> in parallel; if present + non-empty, it overwrites <code>window.__POSTS</code> / <code>__PROJECTS</code> / <code>__STUDY_DEFAULTS</code>. React reads from window. So editing the inline arrays in <code>index.html</code> changes the defaults; the JSON files are the canonical "published" state.</P>
      </>),

      owner: (<>
        <P>Unlocking the owner UI is gated by a SHA-256 hash of the password — the literal password never lives in the source. Unlocking only reveals the editor UI in <em>your</em> browser; it does NOT grant write access to GitHub. Real publishing also requires a PAT in this Console.</P>
        <H>Rotate the password</H>
        <pre style={codeStyle}>{`# In a terminal:
echo -n "your-new-strong-password" | shasum -a 256

# Copy the 64-char hex it prints. In index.html (top of <head>):
const TWEAK_DEFAULTS = {
  ...
  "ownerHash": "<paste hex here>"
};

# Commit + push. Old password stops working on next reload.
# Never commit the plaintext password anywhere.`}</pre>
        <H>If you forget the password</H>
        <P>No recovery flow — there's no server. Run the recipe with a new password and paste the new hash over the old one. Push. Done.</P>
        <H>Owner-only UI surfaces</H>
        <P>Editor buttons on posts / projects / study tiles. "console" nav link. Owner badge in bottom-left. Locally drafted edits persist in <code>localStorage</code> until you click <strong>publish</strong>.</P>
      </>),

      posts: (<>
        <P>Posts live in <code>data/posts.json</code> (canonical) and <code>window.__POSTS</code> (inline defaults). Sign in → <code>/dispatch</code> → "+ new post" to use the editor. Or push directly into <code>window.__POSTS</code>.</P>
        <H>Item shape</H>
        <pre style={codeStyle}>{`{
  id:        "edge-inference-2026",         // slug-style, unique
  category:  "ai" | "quant" | "research" | "gems",
  title:     "The quiet revolution in edge inference",
  dek:       "Subtitle line.",
  date:      "2026-04-12",                  // YYYY-MM-DD
  readMin:   "9 min",
  featured:  true,                          // optional, big card on home
  tags:      ["inference", "edge", "arm"],
  body:      \`...markdown...\`              // see subset below
}`}</pre>
        <H>Markdown subset</H>
        <pre style={codeStyle}>{`LEAD: italic intro line at the top.
## section heading
### subheading
> pull quote
- bullet one
- bullet two
\`\`\`code block\`\`\`
**bold**  *italic*  \`inline code\`  [link text](https://example)
Anything else renders as a paragraph. HTML is escaped — even as owner.`}</pre>
      </>),

      projects: (<>
        <P>Projects live in <code>data/projects.json</code> and <code>window.__PROJECTS</code>. Sign in → open a project page → "edit project". Or push another entry into the array.</P>
        <H>Item shape</H>
        <pre style={codeStyle}>{`{
  id:        "ovasearch",
  title:     "OvaSearch",
  subtitle:  "Native C++ multimodal RAG engine",
  year:      "2026",
  stack:     ["C++", "OpenVINO", "USearch", "HNSW"],
  flagship:  true,           // makes it bigger on the projects grid
  monsterId: "crystalith",   // a window.__MONSTERS id
  accent:    "indigo",       // one of the accent keys (see below)
  repo:      "https://github.com/Lagmator22/OvaSearch",
  summary:   "One-paragraph version shown on the card.",
  body:      \`Long form. \\n\\n— SECTION —\\n...\`
}`}</pre>
        <H>Available monster IDs</H>
        <P><code>crystalith</code> · <code>volt</code> · <code>moth</code> · <code>warden</code> · <code>ink</code> · <code>pip</code> · plus four more (see window.__MONSTERS list in index.html).</P>
        <H>Accent colors</H>
        <P><code>indigo</code> · <code>purple</code> · <code>blue</code> · <code>cyan</code> · <code>green</code> · <code>yellow</code> · <code>gold</code> · <code>orange</code> · <code>red</code> · <code>pink</code></P>
      </>),

      study: (<>
        <P>Study lab items live in <code>data/study.json</code> and <code>STUDY_DEFAULTS</code> (inline). The site loader prefers a non-empty localStorage cache → remote JSON → inline defaults. An empty cache falls through, so old caches can't get stuck.</P>
        <H>Item shape</H>
        <pre style={codeStyle}>{`{
  id:     "s-1",
  kind:   "drive",            // see kinds below
  title:  "CS-310 OS notes",
  course: "cs-310",           // optional
  tags:   ["os", "notes"],
  url:    "https://drive.google.com/...",
  note:   "",                 // one-line description, optional
  added:  "2026-05-26"        // YYYY-MM-DD
}`}</pre>
        <H>Kinds (STUDY_KINDS)</H>
        <pre style={codeStyle}>{`video   YouTube / Drive / Vimeo link, or small uploaded file.
drive   Google Drive folder/file. Share = "anyone with link · viewer".
code    Repo, gist, raw file, or playground (replit, stackblitz, godbolt).
blog    Article link, including posts on this site (#/post/<id>).
github  Full repo link. Add a course tag to group.
slides  Google Slides / Slideshare / Figma deck.
notes   Notion / HackMD / etc.
link    Generic catch-all.`}</pre>
        <P>To add a new kind: append <code>{`{ key: { label, glyph, hue } }`}</code> to <code>STUDY_KINDS</code> in index.html. The filter pills and tile color update automatically.</P>
      </>),

      monsters: (<>
        <P>10 pixel familiars defined in <code>window.__MONSTERS</code>. Each is a 16×16 grid of characters. The renderer (<code>MonsterRenderer</code>) reads the grid and draws cel-shaded pixels frame-by-frame on a canvas.</P>
        <H>Grid character codes</H>
        <pre style={codeStyle}>{`.   transparent (no draw)
L   outline / line (palette.L)
B   body fill   (palette.B)  + auto-cel-shading
S   shade       (palette.S)  + scale stripe
H   highlight   (palette.H)  + top spark
E   eye         (palette.E)  + bright glint + blink
A   accent      (palette.A)  + pulsing ember`}</pre>
        <H>Monster shape</H>
        <pre style={codeStyle}>{`{
  id:        "crystalith",
  name:      "Crystalith",
  archetype: "Prism wyvern",
  element:   "prism",
  idle:      "hover" | "flutter" | "stomp" | "drift" | "blink" | "march",
  speed:     170,    // frame interval (ms-ish)
  glow:      0.42,   // 0..1 — radial halo intensity
  palette:   { L, B, S, H, E, A },   // hex colors
  pixels:    [ "16-char row", ... 16 rows ],
  zones:     [ ...lZ([14,15]), ...tZ([12,13],3) ]   // animated regions
}`}</pre>
        <H>Zone helpers</H>
        <P><code>lZ(rows)</code> = legs (walk cycle). <code>wZ(rows)</code> = wings. <code>tZ(rows,xMax)</code> = tail. <code>eZ(rows)</code> = eye blink. Each zone defines per-frame <code>dx/dy</code> offsets that the renderer applies to matching cells.</P>
      </>),

      contact: (<>
        <P>The form posts to FormSubmit (no signup, no backend) which forwards to the inbox owner. Email never appears literally in DOM — it's reconstructed at runtime from <code>INBOX_PARTS</code>.</P>
        <H>Change the receiving email</H>
        <pre style={codeStyle}>{`// In index.html, inside the Contact section:
const INBOX_PARTS = ['gsingh16', '_be24', '@', 'thapar', '.edu'];

// Just split your real address into 3+ chunks of any size:
const INBOX_PARTS = ['new', 'address', '@', 'gmail', '.com'];

// First submission from a new email triggers a confirmation
// link from FormSubmit. Click it ONCE to activate; messages
// flow from then on.`}</pre>
        <H>How validation works</H>
        <P>Strict regex catches malformed addresses. Cloudflare DNS-over-HTTPS (<code>cloudflare-dns.com/dns-query</code>) checks the domain has MX records. No MX → block. Cloudflare itself fails → let through (don't punish users for our flaky DNS).</P>
        <H>Rotate to an opaque hashed endpoint</H>
        <P>After confirming once, FormSubmit emails an <code>/ajax/&lt;hash&gt;</code> alias. Swap that into <code>CONTACT_ENDPOINT</code> and your email address is no longer reverse-engineerable from the JS source.</P>
      </>),

      storage: (<>
        <P>Study Lab file uploads route through the active storage adapter. Default is <code>none</code> — uploads become inline data URLs that vanish on reload. To actually persist files, switch the adapter in the Media storage card above.</P>
        <pre style={codeStyle}>{`none          No upload. Paste URLs only.
gh-release    Uploads as Release assets on a "media" Release in
              this repo. Free, 2 GB / file, public URLs forever.
              Works immediately — no extra setup.
r2            Cloudflare R2. 10 GB free, zero egress fees.
              Needs a signing worker (template in
              private-notes/oauth-worker.md).
b2            Backblaze B2. Same shape as R2. Stub for now.`}</pre>
        <P>For PDFs, lecture notes, course files → <code>gh-release</code> is the right choice. For long-form video, host on YouTube or Drive and paste the link instead.</P>
        <H>Adapter contract (for adding a new one)</H>
        <pre style={codeStyle}>{`// publish/storage-adapter.js
adapters.myService = {
  label:       'My Service',
  description: 'What this is, free tier, caveats.',
  async upload(file, opts, ctx) {
    // Use ctx.gh (GithubAPI client) and ctx.token if needed.
    // Return { url, bytes, name }.
  }
}`}</pre>
      </>),

      csp: (<>
        <P>Content Security Policy is delivered via a <code>&lt;meta http-equiv&gt;</code> tag at the top of <code>index.html</code>. It restricts what the page can connect to / load.</P>
        <H>Current connect-src allowlist</H>
        <pre style={codeStyle}>{`'self'                       Same origin (data/*.json fetches)
https://hn.algolia.com       HN news feed (for the Dispatch tab)
https://api.github.com       Owner Console + Publisher
https://formsubmit.co        Contact form submissions
https://cloudflare-dns.com   Email MX validation`}</pre>
        <H>Adding a new external service</H>
        <P>If you add an integration (analytics, comments, search index, etc.) you must add its origin to <code>connect-src</code> or the browser will silently block <code>fetch</code> calls. Symptom: <em>"Refused to connect because it violates the document's Content Security Policy"</em> in DevTools console.</P>
        <H>Frame protection</H>
        <P>The <code>frame-ancestors 'self'</code> directive prevents the site from being embedded in iframes on other domains. Browsers print a console warning that this directive is ignored in <code>&lt;meta&gt;</code> form (it works only in HTTP headers) — leave it anyway as defense-in-depth.</P>
      </>),
    };

    return (
      <Card
        title="Dev notes"
        kicker="REFERENCE · owner-only"
        right={<button className="btn btn--sm" onClick={() => setOpen(o => !o)}>{open ? 'hide' : 'show'}</button>}
      >
        {!open ? (
          <p style={{ margin: 0, color: 'var(--ink-3)', fontSize: 14, lineHeight: 1.6 }}>
            All the architecture, schema, password rotation, FormSubmit, storage, and CSP notes that used to live in the public repo and rendered copy. Click <strong>show</strong> to reveal — visible only to you.
          </p>
        ) : (<>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
            {TABS.map(t => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)} aria-pressed={tab === t.id}
                className={'oc-pill' + (tab === t.id ? ' oc-pill--ok' : '')}
                style={{ cursor: 'pointer', fontFamily: 'var(--font-mono)', letterSpacing: '.04em' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.65, color: 'var(--ink-2)' }}>
            {content[tab]}
          </div>
        </>)}
      </Card>
    );
  }

  /* ---------- main console ---------- */

  function OwnerConsole({ onExit }) {
    const [summary, setSummary] = useState(() => window.AuthStore.summary());
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
      setSummary(window.AuthStore.summary());
    }, []);

    const refreshStatus = useCallback(async () => {
      if (!window.AuthStore.summary().ready) { setStatus(null); return; }
      setBusy(true);
      const r = await window.Publisher.statusAsync();
      setStatus(r);
      setBusy(false);
    }, []);

    useEffect(() => window.AuthStore.subscribe(refresh), [refresh]);
    useEffect(() => { refreshStatus(); }, [summary.hasToken, summary.cfg.owner, summary.cfg.repo, summary.cfg.branch, refreshStatus]);
    // The hero uses `.reveal` for an entrance animation (opacity:0 until the
    // IntersectionObserver flips it to .in). Without this call, the hero stays
    // invisible on the /#/console route and the page renders a huge top gap.
    useEffect(() => { window.__observeReveal?.(); }, []);

    const setupPct = (() => {
      let n = 0;
      if (summary.cfg.owner && summary.cfg.repo) n += 33;
      if (summary.hasToken) n += 34;
      if (status?.ok && status?.repo) n += 33;
      return n;
    })();

    return (
      <main className="section oc-page">
        <div className="shell">

          <div className="oc-hero reveal">
            <div>
              <div className="kicker">OWNER CONSOLE · publish to github</div>
              <h1 className="oc-hero__title">Plumbing.</h1>
              <p className="oc-hero__copy">
                Every "publish" button in this site commits to your repo via the GitHub API. No backend, no DB, content stays in git. Configure once below and forget about it.
              </p>
            </div>
            <div className="oc-progress">
              <div className="oc-progress__ring" style={{ '--p': setupPct }}>
                <span>{setupPct}%</span>
              </div>
              <div className="oc-progress__lbl">setup</div>
              {onExit && <button className="btn btn--sm" onClick={onExit} style={{ marginTop: 14 }}>← back</button>}
            </div>
          </div>

          <div className="oc-grid">
            <ConnectionPanel summary={summary} refresh={refresh} />
            <StatusPanel summary={summary} status={status} busy={busy} refresh={refreshStatus} />
            <RecentPanel status={status} busy={busy} />
            <QueuePanel />
            <DataSourcesPanel />
            <StoragePanel />
            <SecurityPanel summary={summary} refresh={refresh} />
            <DevNotesPanel />
          </div>

        </div>
      </main>
    );
  }

  window.OwnerConsole = OwnerConsole;
})();
