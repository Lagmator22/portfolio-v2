/**
 * App shell: nav, route state, theme/fx bootstrap, mounts pages.
 * Routes are hash-based (#/home, #/projects/edgellama, #/blog, #/post/<id>) so
 * refresh preserves location without a server.
 */

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Cross-file component resolution — each Babel script gets its own scope.
// We deref lazily at render time from window so load order doesn't matter.
const R = (name) => window[name] || (() => <div style={{padding:20,color:'#f55',fontFamily:'monospace'}}>missing: {name}</div>);

// -- parse hash route --
function parseHash() {
  const h = window.location.hash.replace(/^#\/?/, "") || "home";
  const [seg, ...rest] = h.split("/");
  return { name: seg, arg: rest.join("/") || null };
}

function useRoute() {
  const [route, setRoute] = useState(parseHash());
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function navigate(to) { window.location.hash = "#/" + to; }
window.navigate = navigate;

function Nav({ route, onOpenCmdk, onOpenTweaks }) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <a className="nav__logo" href="#/home" onClick={(e) => { e.preventDefault(); navigate("home"); }}>
          <span className="dot" />
          <span>Gurman S<span style={{ color: "var(--ink-3)", fontWeight: 400 }}>.dev</span></span>
        </a>
        <nav className="nav__links">
          <a className="nav__link" aria-current={route.name === "home"} onClick={() => navigate("home")}>index</a>
          <a className="nav__link" aria-current={route.name === "projects"} onClick={() => navigate("projects")}>projects</a>
          <a className="nav__link" aria-current={route.name === "blog" || route.name === "post"} onClick={() => navigate("blog")}>writing</a>
          <a className="nav__link" aria-current={route.name === "about"} onClick={() => navigate("about")}>about</a>
        </nav>
        <div className="nav__spacer" />
        <button className="nav__tool" onClick={onOpenCmdk} title="Command palette">
          <span>⌘</span><span>K</span>
        </button>
        <button className="nav__tool" onClick={onOpenTweaks} title="Tweaks">
          <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--accent)", borderRadius: 2, boxShadow: "0 0 8px var(--accent-glow)" }} />
          <span>theme</span>
        </button>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer shell">
      <div>
        <div className="footer__mark">Gurman S.</div>
        <div style={{ marginTop: 4 }}>AI engineer · C++ systems · edge inference</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div>github.com/Lagmator22</div>
        <div style={{ marginTop: 4 }}>© 2026 · built with monsters</div>
      </div>
    </footer>
  );
}

function App() {
  const route = useRoute();
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  // Bootstrap theme + fx once
  useEffect(() => {
    window.Theme?.init();
    window.initCursorFx?.();
  }, []);

  // ⌘K binding
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdkOpen(false); setTweaksOpen(false);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(document.activeElement?.tagName || "")) {
        e.preventDefault(); setCmdkOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mount any newly-rendered monsters after each route change
  useEffect(() => {
    const t = setTimeout(() => window.MonsterRenderer?.mountAll(document), 30);
    return () => clearTimeout(t);
  }, [route.name, route.arg]);

  // Tweaks toolbar integration (host-side)
  useEffect(() => {
    const handler = (ev) => {
      if (ev.data?.type === "__activate_edit_mode") setTweaksOpen(true);
      else if (ev.data?.type === "__deactivate_edit_mode") setTweaksOpen(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  const Home = R("Home"), ProjectsIndex = R("ProjectsIndex"), ProjectPage = R("ProjectPage");
  const Blog = R("Blog"), PostReader = R("PostReader"), About = R("About");
  const CommandPalette = R("CommandPalette"), TweaksPanel = R("TweaksPanel");

  let page;
  if (route.name === "home") page = <Home />;
  else if (route.name === "projects") page = !route.arg ? <ProjectsIndex /> : <ProjectPage id={route.arg} />;
  else if (route.name === "blog") page = <Blog />;
  else if (route.name === "post") page = <PostReader id={route.arg} />;
  else if (route.name === "about") page = <About />;
  else page = <Home />;

  return (
    <>
      <div className="noise" />
      <canvas id="cursor-trail" />
      <Nav route={route} onOpenCmdk={() => setCmdkOpen(true)} onOpenTweaks={() => setTweaksOpen((v) => !v)} />
      <main className="page" key={route.name + (route.arg || "")} data-screen-label={route.name}>{page}</main>
      <Footer />
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </>
  );
}

window.App = App;
