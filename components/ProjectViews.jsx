/**
 * Project detail views: Modal (lightweight), Page (dedicated route),
 * and ProjectsIndex (all-projects grid). Inline is handled in Home.jsx.
 */

const { useEffect, useRef, useState } = React;

function renderSection(s, i) {
  if (s.kind === "text") {
    return (
      <div key={i} className="modal__section">
        {s.title && <h3>{s.title}</h3>}
        <p>{s.body}</p>
      </div>
    );
  }
  if (s.kind === "stat") {
    return (
      <div key={i} className="modal__section">
        <div className="modal__stats">
          {s.stats.map((st, j) => (
            <div key={j} className="stat">
              <div className="stat__label">{st.label}</div>
              <div className="stat__value">{st.value}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (s.kind === "code") {
    return (
      <div key={i} className="modal__section">
        <pre className="code">{s.body}</pre>
      </div>
    );
  }
  if (s.kind === "quote") {
    return (
      <div key={i} className="modal__section">
        <blockquote style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "var(--fs-lg)", borderLeft: "2px solid var(--accent)", paddingLeft: "var(--sp-4)", margin: 0, color: "var(--ink-2)" }}>
          {s.body}
        </blockquote>
      </div>
    );
  }
  return null;
}

function ProjectModal({ project, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    if (project) {
      window.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [project, onClose]);

  useEffect(() => {
    if (project) setTimeout(() => window.MonsterRenderer?.mountAll(document), 50);
  }, [project]);

  if (!project) return null;
  const accent = window.Theme.accents[project.accent];
  const cardStyle = accent ? { "--accent-h": accent.hue } : {};

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal" style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <canvas data-monster={project.monsterId} data-size={96} style={{ imageRendering: "pixelated", filter: "drop-shadow(0 4px 16px var(--accent-glow))" }} />
          <div style={{ flex: 1 }}>
            <div className="proj__meta" style={{ marginBottom: 6 }}>
              <span>{project.year}</span><span>·</span>
              <span style={{ color: "var(--accent)" }}>{project.stack.join(" / ")}</span>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-2xl)", fontWeight: 600, letterSpacing: "-0.025em", margin: "0 0 6px", lineHeight: 1 }}>{project.title}</h2>
            <div style={{ color: "var(--ink-3)", fontSize: "var(--fs-md)" }}>{project.subtitle}</div>
          </div>
          <button className="modal__close" onClick={onClose}>close · esc</button>
        </div>
        <div className="modal__body">
          <p style={{ fontSize: "var(--fs-md)", color: "var(--ink-2)", lineHeight: 1.6, marginTop: 0, maxWidth: "68ch" }}>{project.summary}</p>
          {(project.sections || []).map(renderSection)}
          {project.links && (
            <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-5)", flexWrap: "wrap" }}>
              {project.links.map((l, i) => (
                <a key={i} className="btn" href={l.url}>→ {l.label}</a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectPage({ id }) {
  const project = window.__PROJECTS.find(p => p.id === id);
  if (!project) {
    return <div className="shell" style={{ padding: "var(--sp-10) 0" }}>Not found. <a className="inline-link" onClick={() => window.navigate("projects")}>back</a></div>;
  }
  const ScrollAnimPage = window.ScrollAnimPage;
  if (project.scrollAnimation && ScrollAnimPage) return <ScrollAnimPage project={project} />;
  return <SimpleProjectPage project={project} />;
}

function SimpleProjectPage({ project }) {
  const accent = window.Theme.accents[project.accent];
  const style = accent ? { "--accent-h": accent.hue } : {};
  return (
    <div className="proj-page shell" style={style}>
      <div className="proj-page__back" onClick={() => window.navigate("projects")}>← all projects</div>
      <div style={{ display: "flex", gap: "var(--sp-6)", alignItems: "flex-start", marginBottom: "var(--sp-8)" }}>
        <canvas data-monster={project.monsterId} data-size={160} style={{ imageRendering: "pixelated", filter: "drop-shadow(0 8px 32px var(--accent-glow))" }} />
        <div>
          <div className="proj__meta"><span>{project.year}</span><span>·</span><span style={{ color: "var(--accent)" }}>{project.stack.join(" / ")}</span></div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-3xl)", fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1, margin: "8px 0 12px" }}>{project.title}</h1>
          <p style={{ fontSize: "var(--fs-lg)", color: "var(--ink-2)", maxWidth: "60ch", lineHeight: 1.4 }}>{project.subtitle}</p>
        </div>
      </div>
      <div className="rule" />
      <div style={{ maxWidth: "720px" }}>
        {(project.sections || []).map(renderSection)}
      </div>
    </div>
  );
}

function ProjectsIndex() {
  const Projects = window.Projects || (() => null);
  return <Projects />;
}

window.ProjectModal = ProjectModal;
window.ProjectPage = ProjectPage;
window.ProjectsIndex = ProjectsIndex;
