/* ============================================================
   publish/publish-button.jsx
   ------------------------------------------------------------
   Drop-in publish control. Lives next to existing "save" buttons
   inside editors. Shows current target, mode, and a progress
   line during the actual commit. Falls back to "copy patch" if
   no token / no repo target is set.

   USAGE
     <PublishButton scope="posts" item={post} update={!!post.id} onDone={(r) => …} />

   PROPS
     scope    'posts' | 'projects' | 'study'
     item     the object to publish (must have/get an `id`)
     update   bool — set true if editing an existing item
     label    optional override (default: 'publish')
     onDone   callback(result)
   ============================================================ */

(function () {
  const { useState, useEffect, useRef } = React;

  function PublishButton({ scope, item, update, label, onDone, small }) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const wrapRef = useRef();

    useEffect(() => {
      const onDoc = (e) => {
        if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
      };
      if (open) document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const summary = window.AuthStore.summary();
    const ready = summary.ready;
    const mode = summary.cfg.mode;
    const fn = scope === 'posts' ? 'publishPost'
             : scope === 'projects' ? 'publishProject'
             : scope === 'study' ? 'publishStudy'
             : null;

    const run = async (overrideMode) => {
      if (!ready) { setOpen(true); return; }
      if (!fn) return;
      setBusy(true); setError(null); setResult(null); setProgress({ stage: 'start' });
      try {
        const payload = { ...item, ...(update ? { _update: true } : {}) };
        const r = await window.Publisher[fn](payload, {
          mode: overrideMode,
          onProgress: setProgress,
        });
        setResult(r);
        if (onDone) onDone(r);
        if (r.queued) {
          // queued — keep popover open with the bad news
        } else {
          setTimeout(() => setOpen(false), r.ok ? 2200 : 8000);
        }
      } catch (e) {
        setError({ code: e.code, msg: e.message });
      } finally {
        setBusy(false); setProgress(null);
      }
    };

    const copyPatch = () => {
      try {
        const r = window.Publisher.copyPatch(scope, { ...item, ...(update ? { _update: true } : {}) });
        setResult({ ok: true, mode: 'clipboard', path: r.path });
      } catch (e) { setError({ msg: e.message }); }
    };

    const btnLabel = busy
      ? (<><span className="oc-spin" />{progress?.stage || 'working'}</>)
      : (label || (update ? 'publish update' : 'publish'));

    const btnCls = 'btn ' + (small ? 'btn--sm ' : '') + (ready ? 'btn--primary' : '');

    return (
      <span className="pb-wrap" ref={wrapRef}>
        <button
          type="button"
          className={btnCls}
          disabled={busy}
          onClick={() => { if (ready) run(); else setOpen(o => !o); }}
          onContextMenu={(e) => { e.preventDefault(); setOpen(o => !o); }}
          title={ready ? `${mode} → ${summary.cfg.owner}/${summary.cfg.repo}` : 'click to configure publishing'}
        >
          {btnLabel}
        </button>
        <button
          type="button"
          className={'btn ' + (small ? 'btn--sm ' : '') + 'btn--ghost'}
          aria-label="publish options"
          onClick={() => setOpen(o => !o)}
          style={{ marginLeft: 4, minWidth: 'auto', padding: '0 8px' }}
        >▾</button>

        {open && (
          <div className="pb-popover" role="dialog" aria-label="publish options">
            <div className="pb-popover__hd">publish target</div>
            {ready ? (
              <>
                <div className="pb-popover__row">
                  <span>repo</span>
                  <span className="oc-pill oc-pill--ok">{summary.cfg.owner}/{summary.cfg.repo}</span>
                </div>
                <div className="pb-popover__row">
                  <span>branch</span>
                  <code className="oc-sha">{summary.cfg.branch}</code>
                </div>
                <div className="pb-popover__row">
                  <span>mode</span>
                  <span className="oc-pill">{mode === 'pr' ? 'staged PR' : 'one-click'}</span>
                </div>
                {result && result.ok && (
                  <div className="pb-popover__msg pb-popover__msg--ok">
                    {result.mode === 'committed' && <>✓ committed <code className="oc-sha">{result.commit.sha?.slice(0,7)}</code>{result.commit.url && <> · <a href={result.commit.url} target="_blank" rel="noopener noreferrer">view</a></>}</>}
                    {result.mode === 'pr' && <>✓ PR <a href={result.pr.url} target="_blank" rel="noopener noreferrer">#{result.pr.number}</a> opened on <code>{result.pr.branch}</code></>}
                    {result.mode === 'clipboard' && <>✓ patch copied. Paste into <code>{result.path}</code> on github and commit.</>}
                  </div>
                )}
                {result && result.queued && (
                  <div className="pb-popover__msg pb-popover__msg--err">
                    Queued for retry — {result.error}. Will auto-retry on next online event.
                  </div>
                )}
                {error && (
                  <div className="pb-popover__msg pb-popover__msg--err">
                    <strong>{error.code || 'error'}</strong> — {error.msg}
                  </div>
                )}
                <div className="pb-popover__actions">
                  <button className="btn btn--sm btn--primary" disabled={busy} onClick={() => run('one-click')}>commit to {summary.cfg.branch}</button>
                  <button className="btn btn--sm" disabled={busy} onClick={() => run('pr')}>open PR</button>
                  <button className="btn btn--sm btn--ghost" disabled={busy} onClick={copyPatch}>copy patch</button>
                </div>
              </>
            ) : (
              <>
                <div className="pb-popover__msg pb-popover__msg--err">
                  Publishing isn't wired up yet. Configure your repo + token in the Owner Console.
                </div>
                <div className="pb-popover__actions">
                  <a className="btn btn--sm btn--primary" href="#/console" onClick={() => setOpen(false)}>open console</a>
                  <button className="btn btn--sm" onClick={copyPatch}>copy patch instead</button>
                </div>
                {result && result.mode === 'clipboard' && (
                  <div className="pb-popover__msg pb-popover__msg--ok" style={{ marginTop: 10 }}>
                    ✓ patch on clipboard. Paste into <code>{result.path}</code>.
                  </div>
                )}
                {error && <div className="pb-popover__msg pb-popover__msg--err">{error.msg}</div>}
              </>
            )}
          </div>
        )}
      </span>
    );
  }

  window.PublishButton = PublishButton;
})();
