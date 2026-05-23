/**
 * Home page: hero, monster roster, project grid, blog strip.
 */
const { useEffect, useState } = React;
const R = (n) => window[n] || (() => null);

function MonsterCanvas({ id, size = 96, className = "", style }) {
  return (
    <canvas
      data-monster={id}
      data-size={size}
      className={className}
      style={style}
    />
  );
}
window.MonsterCanvas = MonsterCanvas;

function Hero() {
  return (
    <section className="hero shell">
      <div className="hero__grid" />
      <div className="hero__meta">
        <span>◆ PORTFOLIO</span>
        <span>◆ SINCE 2023</span>
        <span>◆ {new Date().getFullYear()}</span>
      </div>
      <h1 className="hero__title">
        I build <em>small</em> systems<br />that do <em>hard</em> things.
      </h1>
      <p className="hero__tag">
        AI engineer and C++ systems engineer. I work on AI inference, edge computing, and local AI — among other things.
        I write about what I find along the way.
      </p>
      <div className="hero__actions">
        <button className="btn btn--primary" onClick={() => window.navigate("projects")}>See the work →</button>
        <button className="btn" onClick={() => window.navigate("blog")}>Read the notes</button>
        <button className="btn btn--ghost" onClick={() => { const ev = new KeyboardEvent("keydown", { key: "k", metaKey: true }); window.dispatchEvent(ev); }}>
          <span className="kbd">⌘K</span><span style={{ color: "var(--ink-3)" }}>to jump anywhere</span>
        </button>
      </div>
    </section>
  );
}

function Roster() {
  const monsters = window.MonsterRenderer.MONSTERS;
  return (
    <section className="shell">
      <div className="roster">
        <div className="roster__label">// THE PARTY — one monster per project</div>
        <div className="roster__grid">
          {monsters.map((m) => (
            <div key={m.id} className="roster__cell" onClick={() => {
              // jump to the project that owns this monster
              const proj = window.__PROJECTS.find(p => p.monsterId === m.id);
              if (proj) openProject(proj);
            }}>
              <MonsterCanvas id={m.id} size={72} />
              <div className="roster__cell__name">{m.name}</div>
              <div className="roster__cell__arche">{m.archetype}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectCard({ project, expanded, onExpand, onOpen }) {
  const isFlagship = project.flagship;
  const accent = window.Theme.accents[project.accent];
  const cardStyle = accent ? { "--p-accent": `oklch(0.72 0.18 ${accent.hue})` } : {};
  const cls = [
    "proj",
    isFlagship ? "proj--flagship" : "",
    project.detail === "inline" ? "proj--inline" : "",
    !isFlagship && project.detail === "modal" && Math.random() > 0.99 ? "proj--wide" : "",
    expanded ? "expanded" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={cls} style={cardStyle} onClick={() => {
      if (project.detail === "inline") onExpand();
      else onOpen(project);
    }}>
      <div className="proj__header">
        <div>
          <div className="proj__meta">
            <span>{project.year}</span>
            <span>·</span>
            <span style={{ color: "var(--p-accent)" }}>{project.detail === "page" ? "CASE STUDY" : project.detail === "modal" ? "DETAIL" : "INLINE"}</span>
          </div>
          <h3 className="proj__title">{project.title}</h3>
          <p className="proj__subtitle">{project.subtitle}</p>
        </div>
        <MonsterCanvas id={project.monsterId} size={isFlagship ? 128 : 72} className="proj__mascot" />
      </div>
      <div className="proj__summary">{project.summary}</div>
      <div className="proj__stack">
        {project.stack.map((s) => <span key={s} className="chip">{s}</span>)}
      </div>
      {project.detail === "inline" && (
        <div className="proj__expand">
          {project.summary} This one lives inline — click again to collapse. Built during a stretch of long nights; the fun was in keeping the binary small.
        </div>
      )}
      <div className="proj__go">
        {project.detail === "page" ? "open case study" : project.detail === "modal" ? "view details" : (expanded ? "collapse" : "expand")}
        <span>→</span>
      </div>
    </article>
  );
}

function Projects({ limit }) {
  const ProjectModal = R("ProjectModal");
  const [expanded, setExpanded] = useState(null);
  const [modalProj, setModalProj] = useState(null);
  const projects = limit ? window.__PROJECTS.slice(0, limit) : window.__PROJECTS;

  // expose modal-open helper globally for Roster etc.
  window.__openProject = (p) => {
    if (p.detail === "page") window.navigate("projects/" + p.id);
    else if (p.detail === "modal") setModalProj(p);
    else setExpanded(p.id);
  };

  return (
    <section className="projects shell">
      <div className="section-hd">
        <div>
          <div className="section-hd__idx">01 / WORK</div>
          <div className="section-hd__title">Projects</div>
        </div>
        <div className="section-hd__caption">Ten things I built. Click a card — each opens differently.</div>
      </div>
      <div className="projects__grid">
        {projects.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            expanded={expanded === p.id}
            onExpand={() => setExpanded(expanded === p.id ? null : p.id)}
            onOpen={(proj) => window.__openProject(proj)}
          />
        ))}
      </div>
      <ProjectModal project={modalProj} onClose={() => setModalProj(null)} />
    </section>
  );
}

function openProject(p) { window.__openProject?.(p); }
window.openProject = openProject;

function BlogStrip() {
  const posts = window.__POSTS.slice(0, 3);
  const CAT = { ai: "AI", quant: "QUANT", research: "RESEARCH", gems: "HIDDEN GEMS" };
  return (
    <section className="shell" style={{ padding: "var(--sp-10) 0" }}>
      <div className="section-hd">
        <div>
          <div className="section-hd__idx">02 / WRITING</div>
          <div className="section-hd__title">Recent notes</div>
        </div>
        <div className="section-hd__caption">
          A filtered newsletter on AI, quant, research, and small useful tools.
          <button className="btn btn--ghost" style={{ marginLeft: 12 }} onClick={() => window.navigate("blog")}>all writing →</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sp-5)" }}>
        {posts.map((p) => (
          <article key={p.id} className="post-card" style={{ "--col-accent": "var(--accent)" }} onClick={() => window.navigate("post/" + p.id)}>
            <div className="post-card__date">{CAT[p.category]} · {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
            <h4 className="post-card__title">{p.title}</h4>
            <p className="post-card__dek">{p.dek}</p>
            <div className="post-card__read">{p.readMin} · read →</div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <div className="shell"><Roster /></div>
      <Projects />
      <BlogStrip />
    </>
  );
}

window.Home = Home;
window.Projects = Projects;
window.ProjectCard = ProjectCard;
