/**
 * Blog: categorized columns (AI / Quant / Research / Gems).
 * PostReader: long-form article with scroll progress + TOC.
 */

const { useEffect, useState, useMemo, useRef } = React;

const CATEGORIES = [
  { id: "ai",       label: "AI",            hue: 275, tagline: "inference · models · systems" },
  { id: "quant",    label: "Quant",         hue: 75,  tagline: "markets · vol · microstructure" },
  { id: "research", label: "Research",      hue: 210, tagline: "papers, read + chewed" },
  { id: "gems",     label: "Hidden gems",   hue: 150, tagline: "tools you haven't tried yet" },
];

function Blog() {
  const posts = window.__POSTS;
  return (
    <div className="blog shell">
      <div className="section-hd">
        <div>
          <div className="section-hd__idx">03 / WRITING</div>
          <div className="section-hd__title">The notebook</div>
        </div>
        <div className="section-hd__caption">A filtered newsletter. No cross-posts, no LinkedIn hot takes.</div>
      </div>
      <div className="blog__columns">
        {CATEGORIES.map((cat) => {
          const items = posts.filter(p => p.category === cat.id);
          return (
            <div key={cat.id} className="blog__col" style={{ "--col-accent": `oklch(0.72 0.18 ${cat.hue})` }}>
              <div className="blog__col__hd">
                <div className="blog__col__title">{cat.label}</div>
                <div className="blog__col__count">{items.length.toString().padStart(2, "0")}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-micro)", color: "var(--ink-4)", marginBottom: "var(--sp-4)", textTransform: "uppercase", letterSpacing: "0.12em" }}>{cat.tagline}</div>
              <div className="blog__col__list">
                {items.map((p) => (
                  <article
                    key={p.id}
                    className={"post-card " + (p.featured ? "post-card--featured" : "")}
                    onClick={() => window.navigate("post/" + p.id)}
                  >
                    <div className="post-card__date">
                      {new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <h4 className="post-card__title">{p.title}</h4>
                    <p className="post-card__dek">{p.dek}</p>
                    <div className="post-card__read">
                      <span>{p.readMin}</span>
                      {p.tags?.length ? <span>·</span> : null}
                      {p.tags?.map((t) => <span key={t}>#{t}</span>)}
                    </div>
                  </article>
                ))}
                {!items.length && (
                  <div style={{ color: "var(--ink-4)", fontSize: "var(--fs-sm)", fontStyle: "italic", padding: "var(--sp-4) 0" }}>
                    nothing here yet. drafts brewing.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderBlock(b, i, onAnchor) {
  switch (b.kind) {
    case "h2": {
      const id = "h-" + i;
      onAnchor && onAnchor(id, b.text);
      return <h2 key={i} id={id}>{b.text}</h2>;
    }
    case "h3": {
      const id = "h-" + i;
      onAnchor && onAnchor(id, b.text, true);
      return <h3 key={i} id={id}>{b.text}</h3>;
    }
    case "lead":  return <p key={i} className="lead" dangerouslySetInnerHTML={{ __html: b.text }} />;
    case "p":     return <p key={i} dangerouslySetInnerHTML={{ __html: b.text }} />;
    case "list":  return <ul key={i}>{b.items.map((it, j) => <li key={j} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>;
    case "quote": return <blockquote key={i} style={{ borderLeft: "2px solid var(--accent)", paddingLeft: "var(--sp-4)", margin: "var(--sp-5) 0", fontStyle: "italic", color: "var(--ink-2)" }}>{b.text}</blockquote>;
    case "pull":  return <span key={i} className="pull">{b.text}</span>;
    case "code":  return <pre key={i} className="code" style={{ margin: "var(--sp-4) 0" }}>{b.text}</pre>;
    case "hr":    return <hr key={i} style={{ border: 0, borderTop: "1px solid var(--line)", margin: "var(--sp-6) 0" }} />;
    default: return null;
  }
}

function PostReader({ id }) {
  const post = window.__POSTS.find(p => p.id === id);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState(null);
  const anchors = useRef([]);
  const bodyRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? window.scrollY / total : 0);

      // active heading
      if (!bodyRef.current) return;
      const hs = bodyRef.current.querySelectorAll("h2, h3");
      let current = null;
      hs.forEach(el => {
        if (el.getBoundingClientRect().top < 140) current = el.id;
      });
      setActiveHeading(current);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [id]);

  if (!post) {
    return <div className="shell" style={{ padding: "var(--sp-10) 0" }}>Post not found. <a className="inline-link" onClick={() => window.navigate("blog")}>back to writing</a></div>;
  }

  const cat = CATEGORIES.find(c => c.id === post.category);
  const style = { "--col-accent": `oklch(0.72 0.18 ${cat.hue})` };

  // pre-collect anchors
  anchors.current = [];
  const collectAnchor = (id, text, sub) => anchors.current.push({ id, text, sub });

  return (
    <div style={style}>
      <div className="progress-bar" style={{ width: `${progress * 100}%` }} />
      <div className="reader">
        <div className="proj-page__back" onClick={() => window.navigate("blog")}>← back to notebook</div>
        <div style={{ height: "var(--sp-5)" }} />
        <div className="reader__cat">{cat.label.toUpperCase()}</div>
        <h1 className="reader__title">{post.title}</h1>
        <p className="reader__dek">{post.dek}</p>
        <div className="reader__byline">
          <span>Gurman S.</span><span>·</span>
          <span>{new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          <span>·</span>
          <span>{post.readMin}</span>
          {post.tags?.length ? <>
            <span>·</span>
            <span>{post.tags.map(t => "#" + t).join(" ")}</span>
          </> : null}
        </div>
        <div className="reader__body" ref={bodyRef}>
          {post.blocks.map((b, i) => renderBlock(b, i, collectAnchor))}
        </div>
      </div>

      {/* TOC */}
      {anchors.current.length > 0 && (
        <aside className="toc">
          <div style={{ color: "var(--ink-4)", fontSize: "var(--fs-micro)", letterSpacing: "0.12em", marginBottom: 8 }}>// CONTENTS</div>
          {anchors.current.map((a) => (
            <div
              key={a.id}
              className={"toc__item " + (activeHeading === a.id ? "active" : "")}
              style={{ paddingLeft: a.sub ? 10 : 0 }}
              onClick={() => document.getElementById(a.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              {a.text}
            </div>
          ))}
        </aside>
      )}
    </div>
  );
}

function About() {
  return (
    <div className="shell" style={{ padding: "var(--sp-10) 0", maxWidth: 720, margin: "0 auto" }}>
      <div className="section-hd">
        <div>
          <div className="section-hd__idx">04 / ABOUT</div>
          <div className="section-hd__title">The short version</div>
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "var(--fs-md)", lineHeight: 1.7, color: "var(--ink-2)" }}>
        <p style={{ fontSize: "var(--fs-lg)", color: "var(--ink)", fontStyle: "italic" }}>
          I'm Gurman — an engineer who likes making software that runs <i>where</i> it should.
        </p>
        <p>
          I spend most of my time on AI inference and C++ systems work — the kind of thing that makes a model run on a phone instead of a server, or a daemon run for a year without a memory leak. On the side, I read too many papers and write about the few that matter.
        </p>
        <p>
          This site is a portfolio, a notebook, and a small bestiary. Every project has a monster. I'm not sure why; it just feels right.
        </p>
        <div style={{ marginTop: "var(--sp-6)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)" }}>
          <div>github · <a className="inline-link" href="https://github.com/Lagmator22">Lagmator22</a></div>
          <div style={{ marginTop: 4 }}>reachable via whatever social network you prefer</div>
        </div>
      </div>
    </div>
  );
}

window.Blog = Blog;
window.PostReader = PostReader;
window.About = About;
