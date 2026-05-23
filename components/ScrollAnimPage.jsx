/**
 * Apple-style scroll page. Uses a 500vh pinned scroll scene:
 *   segment 0: title + monster enter
 *   segment 1: monster scales up, stats reveal
 *   segment 2: benchmark callout
 *   segment 3: code/architecture
 *   segment 4: closing CTA
 *
 * No external libs — raw scroll math + IntersectionObserver for reveals.
 */

const { useEffect, useRef, useState } = React;

function useScrollProgress(ref) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const total = rect.height - window.innerHeight;
        const scrolled = -rect.top;
        setP(Math.max(0, Math.min(1, scrolled / total)));
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);
  return p;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function seg(p, a, b) { return clamp01((p - a) / (b - a)); }

function ScrollAnimPage({ project }) {
  const sceneRef = useRef(null);
  const p = useScrollProgress(sceneRef);
  const accent = window.Theme.accents[project.accent];
  const style = accent ? { "--accent-h": accent.hue } : {};

  // Segment timeline
  const s0 = seg(p, 0.00, 0.18); // title in
  const s1 = seg(p, 0.18, 0.38); // monster huge, title out
  const s2 = seg(p, 0.38, 0.58); // stats slam in
  const s3 = seg(p, 0.58, 0.78); // code
  const s4 = seg(p, 0.78, 1.00); // cta

  const monsterScale = lerp(1, 3.2, clamp01(p * 1.8));
  const monsterOpacity = p < 0.82 ? 1 : lerp(1, 0, (p - 0.82) / 0.18);
  const monsterY = lerp(0, -120, s3);

  return (
    <div style={style}>
      <div className="shell" style={{ padding: "var(--sp-5) 0" }}>
        <div className="proj-page__back" onClick={() => window.navigate("projects")}>← all projects</div>
      </div>

      <div ref={sceneRef} className="scroll-scene">
        <div className="scroll-pin">
          <div className="scroll-stage">
            {/* Monster — persistent throughout */}
            <canvas
              data-monster={project.monsterId}
              data-size={256}
              className="scroll-monster"
              style={{
                transform: `translateY(${monsterY}px) scale(${monsterScale})`,
                opacity: monsterOpacity,
                transition: "none",
              }}
            />

            {/* Segment 0: title */}
            <h1
              className="scroll-title"
              style={{
                opacity: 1 - s1,
                transform: `translateY(${lerp(40, 0, s0)}px) translateY(${-s1 * 80}px)`,
              }}
            >
              {project.title} <em>/</em> <br />
              {project.subtitle}
            </h1>

            {/* Segment 2: stats */}
            {project.sections?.find(s => s.kind === "stat") && (
              <div
                className="scroll-stats"
                style={{
                  opacity: s2 * (1 - s3),
                  transform: `translateY(${lerp(80, 0, s2)}px) scale(${lerp(0.9, 1, s2)})`,
                  position: "absolute",
                  bottom: "8%",
                }}
              >
                {project.sections.find(s => s.kind === "stat").stats.map((st, i) => (
                  <div key={i} className="stat" style={{ transform: `translateY(${lerp(60, 0, seg(p, 0.40 + i * 0.02, 0.52 + i * 0.02))}px)` }}>
                    <div className="stat__label">{st.label}</div>
                    <div className="stat__value">{st.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Segment 3: code block */}
            {project.sections?.find(s => s.kind === "code") && (
              <div
                className="scroll-section"
                style={{
                  opacity: s3 * (1 - s4),
                  transform: `translateY(${lerp(60, 0, s3)}px)`,
                  position: "absolute",
                  maxWidth: 720,
                }}
              >
                <h3>The hot loop</h3>
                <pre className="code" style={{ textAlign: "left" }}>{project.sections.find(s => s.kind === "code").body}</pre>
              </div>
            )}

            {/* Segment 4: closing pitch */}
            <div
              className="scroll-section"
              style={{
                opacity: s4,
                transform: `translateY(${lerp(40, 0, s4)}px)`,
                position: "absolute",
              }}
            >
              <h3>Built for the edge.<br />Not the datacenter.</h3>
              <p>{project.sections?.find(s => s.kind === "text" && s.title)?.body || project.summary}</p>
              <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "center", marginTop: "var(--sp-5)" }}>
                {(project.links || []).map((l, i) => (
                  <a key={i} className="btn btn--primary" href={l.url}>→ {l.label}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress indicator for the scroll scene */}
      <div style={{
        position: "fixed",
        left: "var(--sp-5)",
        top: "50%",
        transform: "translateY(-50%)",
        width: 2,
        height: 160,
        background: "var(--line)",
        borderRadius: 2,
        zIndex: 10,
      }}>
        <div style={{
          position: "absolute",
          top: 0, left: 0,
          width: "100%",
          height: `${p * 100}%`,
          background: "var(--accent)",
          boxShadow: "0 0 12px var(--accent-glow)",
          borderRadius: 2,
          transition: "none",
        }} />
      </div>

      {/* After the pinned scene, show the full writeup for completeness */}
      <div className="proj-page shell" style={{ paddingTop: "var(--sp-12)" }}>
        <div className="section-hd">
          <div>
            <div className="section-hd__idx">FULL WRITEUP</div>
            <div className="section-hd__title">The whole thing, in prose.</div>
          </div>
        </div>
        <div style={{ maxWidth: 720 }}>
          {(project.sections || []).map((s, i) => {
            if (s.kind === "text") {
              return (
                <div key={i} className="modal__section">
                  {s.title && <h3>{s.title}</h3>}
                  <p>{s.body}</p>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

window.ScrollAnimPage = ScrollAnimPage;
