/**
 * Command palette (⌘K): jump to any page, project, or post; switch theme accent.
 */

const { useEffect, useMemo, useRef, useState } = React;

function buildCommands() {
  const cmds = [
    { id: "goto:home",     label: "Go: Home",     cat: "nav", run: () => window.navigate("home") },
    { id: "goto:projects", label: "Go: Projects", cat: "nav", run: () => window.navigate("projects") },
    { id: "goto:blog",     label: "Go: Writing",  cat: "nav", run: () => window.navigate("blog") },
    { id: "goto:about",    label: "Go: About",    cat: "nav", run: () => window.navigate("about") },
  ];
  for (const p of window.__PROJECTS) cmds.push({ id: "proj:" + p.id, label: "Project: " + p.title, cat: "project", run: () => {
    if (p.detail === "page") window.navigate("projects/" + p.id);
    else { window.navigate("projects"); setTimeout(() => window.__openProject?.(p), 200); }
  }});
  for (const p of window.__POSTS) cmds.push({ id: "post:" + p.id, label: "Post: " + p.title, cat: "writing", run: () => window.navigate("post/" + p.id) });
  for (const [key, v] of Object.entries(window.Theme.accents)) cmds.push({
    id: "accent:" + key, label: "Accent: " + v.label, cat: "theme",
    run: () => window.Theme.set({ accent: key }),
  });
  cmds.push({ id: "mode:dark",  label: "Mode: Dark",  cat: "theme", run: () => window.Theme.set({ mode: "dark" }) });
  cmds.push({ id: "mode:light", label: "Mode: Light", cat: "theme", run: () => window.Theme.set({ mode: "light" }) });
  return cmds;
}

function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const all = useMemo(() => buildCommands(), [open]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.slice(0, 14);
    return all.filter(c => c.label.toLowerCase().includes(s) || c.cat.includes(s)).slice(0, 20);
  }, [q, all]);

  useEffect(() => {
    if (open) {
      setQ(""); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const choose = (c) => { c.run(); onClose(); };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtered[idx]) choose(filtered[idx]); }
    else if (e.key === "Escape") onClose();
  };

  if (!open) return null;
  return (
    <div className="cmdk-backdrop open" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} className="cmdk__input" placeholder="jump to…  (try 'blog', 'edge', 'gold')"
          value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} />
        <div className="cmdk__results">
          {filtered.length === 0 && <div className="cmdk__empty">nothing matches. ESC to close.</div>}
          {filtered.map((c, i) => (
            <div key={c.id} className="cmdk__item" aria-selected={i === idx}
              onMouseEnter={() => setIdx(i)} onClick={() => choose(c)}>
              <span>{c.label}</span>
              <span className="cmdk__cat">{c.cat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.CommandPalette = CommandPalette;
