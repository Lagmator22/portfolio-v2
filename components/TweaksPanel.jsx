/**
 * Tweaks panel. Covers: accent, mode, monsters on/off, blog font,
 * motion intensity, density, sfx on/off, cursor trail on/off.
 */

const { useEffect, useState } = React;

function TweaksPanel({ open, onClose }) {
  const [t, setT] = useState(window.Theme?.get() || {});
  useEffect(() => {
    const unsub = window.Theme?.subscribe((s) => setT({ ...s }));
    return () => unsub && unsub();
  }, []);

  const set = (patch) => window.Theme?.set(patch);

  if (!open) return null;

  const accents = window.Theme.accents;

  return (
    <aside className={"tweaks open"} onClick={(e) => e.stopPropagation()}>
      <div className="tweaks__hd">
        <h4>Tweaks</h4>
        <button className="nav__tool" onClick={onClose} style={{ padding: "4px 8px" }}>close</button>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">ACCENT COLOR</div>
        <div className="tweaks__swatches">
          {Object.entries(accents).map(([k, v]) => (
            <div
              key={k}
              className={"tweaks__swatch " + (t.accent === k ? "active" : "")}
              style={{ background: `oklch(0.72 0.18 ${v.hue})` }}
              title={v.label}
              onClick={() => set({ accent: k })}
            />
          ))}
        </div>
        <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-4)", marginTop: 8, textAlign: "center" }}>
          {accents[t.accent]?.label}
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">MODE</div>
        <div className="tweaks__row">
          <span>theme</span>
          <select value={t.mode} onChange={(e) => set({ mode: e.target.value })}>
            <option value="dark">dark</option>
            <option value="light">light</option>
            <option value="system">system</option>
          </select>
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">MONSTERS</div>
        <div className="tweaks__row">
          <span>show monsters</span>
          <div className="tweaks__toggle" aria-checked={t.monsters} role="switch"
            onClick={() => set({ monsters: !t.monsters })} />
        </div>
        <div style={{ fontSize: "var(--fs-micro)", color: "var(--ink-4)", marginTop: 4 }}>
          {t.monsters ? "pixel creatures visible on cards" : "work-only mode (monsters hidden)"}
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">TYPOGRAPHY</div>
        <div className="tweaks__row">
          <span>blog font</span>
          <select value={t.blogFont} onChange={(e) => set({ blogFont: e.target.value })}>
            <option value="source-serif">Source Serif</option>
            <option value="georgia">Georgia</option>
            <option value="garamond">EB Garamond</option>
            <option value="times">Times New Roman</option>
          </select>
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">MOTION</div>
        <div className="tweaks__row">
          <span>animation intensity</span>
          <select value={t.motion} onChange={(e) => set({ motion: e.target.value })}>
            <option value="none">none</option>
            <option value="subtle">subtle</option>
            <option value="full">full</option>
          </select>
        </div>
        <div className="tweaks__row">
          <span>cursor trail</span>
          <div className="tweaks__toggle" aria-checked={t.cursorTrail} role="switch"
            onClick={() => set({ cursorTrail: !t.cursorTrail })} />
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">LAYOUT</div>
        <div className="tweaks__row">
          <span>density</span>
          <select value={t.density} onChange={(e) => set({ density: e.target.value })}>
            <option value="compact">compact</option>
            <option value="comfortable">comfortable</option>
            <option value="roomy">roomy</option>
          </select>
        </div>
      </div>

      <div className="tweaks__section">
        <div className="tweaks__label">SOUND</div>
        <div className="tweaks__row">
          <span>click sfx</span>
          <div className="tweaks__toggle" aria-checked={t.sfx} role="switch"
            onClick={() => {
              const next = !t.sfx;
              set({ sfx: next });
              document.documentElement.setAttribute("data-sfx", next ? "on" : "off");
            }} />
        </div>
      </div>

      <div className="tweaks__section" style={{ color: "var(--ink-4)", fontSize: "var(--fs-micro)" }}>
        <div className="tweaks__label">SHORTCUTS</div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>command palette</span><span className="kbd">⌘K</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>quick search</span><span className="kbd">/</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span>close overlay</span><span className="kbd">esc</span></div>
      </div>
    </aside>
  );
}

window.TweaksPanel = TweaksPanel;
