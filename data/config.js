/**
 * SITE CONFIG — edit here to change identity, palette, or defaults.
 * Safe to edit by hand or by an AI agent. Validated at runtime (see core/validate.js).
 *
 * @typedef {Object} SiteConfig
 * @property {string} owner       - Display name shown in hero + meta
 * @property {string} handle      - GitHub / social handle
 * @property {string} tagline     - One-line descriptor
 * @property {string} email       - Contact (optional)
 * @property {Record<string, AccentTheme>} accents - Switchable accent hues
 * @property {string} defaultAccent - Key into accents
 * @property {'dark'|'light'|'system'} defaultMode
 */

/**
 * @typedef {Object} AccentTheme
 * @property {string} label - Human label
 * @property {string} hue   - OKLCH hue angle, e.g. "275"
 * @property {string} solid - Fallback solid hex for very old browsers (optional)
 */

/** @type {SiteConfig} */
export const CONFIG = {
  owner: "Gurman S",
  handle: "Lagmator22",
  tagline:
    "AI engineer and C++ systems engineer. I work on AI inference, edge computing, and local AI — among other things.",
  email: "",

  // All accents share the same chroma + lightness; only hue varies.
  // See core/theme.js — we compute --accent from hue at runtime.
  accents: {
    indigo:  { label: "Indigo",  hue: "275" },
    purple:  { label: "Purple",  hue: "310" },
    blue:    { label: "Blue",    hue: "245" },
    cyan:    { label: "Cyan",    hue: "210" },
    green:   { label: "Green",   hue: "150" },
    yellow:  { label: "Yellow",  hue: "95"  },
    gold:    { label: "Gold",    hue: "75"  },
    orange:  { label: "Orange",  hue: "50"  },
    red:     { label: "Red",     hue: "25"  },
    pink:    { label: "Pink",    hue: "355" },
  },

  defaultAccent: "indigo",
  defaultMode: "dark",
};
