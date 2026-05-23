/**
 * THEME ENGINE
 * Reads config + persisted state, injects CSS custom properties,
 * handles accent/mode/density/motion/monster/font/sfx switching.
 *
 * Public API:
 *   Theme.init(config) -> loads persisted or defaults, applies to document
 *   Theme.get()        -> current state
 *   Theme.set(partial) -> merge, apply, persist, broadcast 'themechange'
 *   Theme.subscribe(fn)
 *
 * Events dispatched on window:
 *   'themechange' — detail: { ...state, changed: string[] }
 */

import { CONFIG } from "../data/config.js";

const LS_KEY = "gurman.site.theme.v1";

const DEFAULTS = {
  accent: CONFIG.defaultAccent,
  mode: CONFIG.defaultMode,          // 'dark' | 'light' | 'system'
  monsters: true,                    // show monsters
  blogFont: "source-serif",          // 'source-serif' | 'georgia' | 'garamond' | 'times'
  motion: "full",                    // 'none' | 'subtle' | 'full'
  density: "comfortable",            // 'compact' | 'comfortable' | 'roomy'
  sfx: false,                        // sound effects on click
  cursorTrail: true,
};

const FONT_STACKS = {
  "source-serif": "'Source Serif 4','Source Serif Pro',Georgia,serif",
  "georgia":      "Georgia,'Source Serif 4',serif",
  "garamond":     "'EB Garamond',Georgia,serif",
  "times":        "'Times New Roman',Times,Georgia,serif",
};

const MOTION_MULT = { none: 0, subtle: 0.5, full: 1 };
const DENSITY_MULT = { compact: 0.85, comfortable: 1, roomy: 1.15 };

let state = { ...DEFAULTS };
const subs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
}
function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

function resolveMode(mode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return mode;
}

function apply() {
  const root = document.documentElement;
  const accent = CONFIG.accents[state.accent] || CONFIG.accents[CONFIG.defaultAccent];
  root.style.setProperty("--accent-h", accent.hue);
  root.setAttribute("data-mode", resolveMode(state.mode));
  root.setAttribute("data-accent", state.accent);
  root.style.setProperty("--font-serif", FONT_STACKS[state.blogFont] || FONT_STACKS["source-serif"]);
  root.style.setProperty("--motion", String(MOTION_MULT[state.motion] ?? 1));
  root.style.setProperty("--density", String(DENSITY_MULT[state.density] ?? 1));
  root.setAttribute("data-monsters", state.monsters ? "on" : "off");
  root.setAttribute("data-cursor-trail", state.cursorTrail ? "on" : "off");
}

export const Theme = {
  init() {
    load();
    apply();
    // react to system theme if mode=system
    try {
      window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        if (state.mode === "system") apply();
      });
    } catch (e) {}
    return state;
  },
  get() { return { ...state }; },
  set(partial) {
    const changed = Object.keys(partial).filter(k => state[k] !== partial[k]);
    if (!changed.length) return;
    state = { ...state, ...partial };
    apply();
    persist();
    const detail = { ...state, changed };
    subs.forEach(fn => { try { fn(detail); } catch (e) { console.error(e); } });
    window.dispatchEvent(new CustomEvent("themechange", { detail }));
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  accents: CONFIG.accents,
  config: CONFIG,
};

// Expose to window for non-module consumers (e.g. Babel-transpiled React scripts)
window.Theme = Theme;
