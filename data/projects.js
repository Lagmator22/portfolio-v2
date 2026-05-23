/**
 * PROJECTS — add/edit projects here. Nothing else needs to change.
 * Each project picks ONE detail format: 'modal' | 'page' | 'inline'.
 * The flagship project can enable scrollAnimation: true for the Apple-style page.
 *
 * @typedef {Object} Project
 * @property {string} id              - Unique slug, kebab-case. Used in URLs & monster binding.
 * @property {string} title
 * @property {string} subtitle        - One-line pitch
 * @property {string} year
 * @property {string[]} stack         - Tech tags
 * @property {'modal'|'page'|'inline'} detail - How the detail view opens
 * @property {boolean} [flagship]     - Show enlarged on home
 * @property {boolean} [scrollAnimation] - Apple-style scroll page (requires detail:'page')
 * @property {string} monsterId       - Links to data/monsters.js (mascot)
 * @property {string} accent          - Accent key override for this project (optional)
 * @property {string} summary         - Short blurb shown on card
 * @property {Section[]} [sections]   - Long-form blocks for detail view
 * @property {Link[]} [links]
 */

/**
 * @typedef {Object} Section
 * @property {'text'|'code'|'quote'|'stat'|'placeholder'} kind
 * @property {string} [title]
 * @property {string} [body]
 * @property {string} [lang]
 * @property {{label:string, value:string}[]} [stats]
 */

/**
 * @typedef {Object} Link
 * @property {string} label
 * @property {string} url
 */

/** @type {Project[]} */
export const PROJECTS = [
  {
    id: "edgellama",
    title: "EdgeLlama",
    subtitle: "4-bit LLM runtime for ARM edge devices",
    year: "2026",
    stack: ["C++20", "CUDA", "GGML", "ARM NEON"],
    detail: "page",
    flagship: true,
    scrollAnimation: true,
    monsterId: "crystalith",
    accent: "indigo",
    summary:
      "A from-scratch inference engine targeting Jetson, RK3588 and Apple Silicon. 3.4× faster than llama.cpp on Orin Nano at equal perplexity.",
    sections: [
      { kind: "stat", stats: [
        { label: "tok/s on Orin Nano", value: "38.2" },
        { label: "vs llama.cpp",       value: "3.4×" },
        { label: "peak RAM (7B q4)",   value: "4.1 GB" },
        { label: "cold-start",         value: "210 ms" },
      ]},
      { kind: "text", title: "Why another runtime?",
        body: "Existing runtimes optimize for server GPUs. EdgeLlama is built from the ground up for ARM, with hand-tuned NEON kernels, KV-cache paging over eMMC, and a zero-copy tokenizer. Every allocation is accounted for." },
      { kind: "code", lang: "cpp",
        body: "// Fused q4_0 matmul with NEON dot-product\nvoid mm_q4_neon(const Block* A, const float* x, float* y, int N) {\n  for (int i = 0; i < N; i += 4) {\n    float32x4_t acc = vdupq_n_f32(0);\n    // ... unrolled inner loop\n    vst1q_f32(y + i, acc);\n  }\n}" },
      { kind: "text", title: "The hard part",
        body: "Keeping latency predictable under thermal throttling. We implemented a feedback loop that trades precision for stability: under hot conditions, the model transparently downshifts blocks from q4 to q3 and compensates with a learned correction vector." },
    ],
    links: [
      { label: "github", url: "#" },
      { label: "benchmarks", url: "#" },
      { label: "paper", url: "#" },
    ],
  },
  {
    id: "quantforge",
    title: "QuantForge",
    subtitle: "Vectorized options pricing toolkit",
    year: "2026",
    stack: ["C++", "AVX-512", "Python"],
    detail: "modal",
    monsterId: "volt",
    accent: "gold",
    summary:
      "SIMD-accelerated Monte Carlo + FFT pricing. Prices 10M paths in 48ms on a single core.",
    sections: [
      { kind: "text", title: "Core idea",
        body: "Most quant libraries are fast in the hot loop and slow everywhere else. QuantForge is fast everywhere — the data layout, the RNG, the IO, the Python binding. No allocations in the pricing path." },
      { kind: "stat", stats: [
        { label: "paths/sec/core", value: "208M" },
        { label: "greeks",         value: "analytical" },
      ]},
    ],
    links: [{ label: "github", url: "#" }],
  },
  {
    id: "paperhound",
    title: "PaperHound",
    subtitle: "arXiv agent that actually reads papers",
    year: "2025",
    stack: ["Python", "LangGraph", "Claude"],
    detail: "modal",
    monsterId: "moth",
    accent: "purple",
    summary:
      "A research agent that skims 400 papers/day, caches findings in a vector DB, and surfaces only the 2–3 that matter to you.",
    sections: [
      { kind: "text", body: "Built because I was drowning. It reads me, not the arXiv frontpage — weighing novelty against my stated taste. False positive rate is <8% after 3 months of training." },
    ],
    links: [{ label: "github", url: "#" }],
  },
  {
    id: "bytewarden",
    title: "ByteWarden",
    subtitle: "Process-level hardening for Linux daemons",
    year: "2025",
    stack: ["Rust", "eBPF", "seccomp"],
    detail: "inline",
    monsterId: "warden",
    accent: "red",
    summary:
      "A drop-in supervisor that sandboxes legacy daemons with capability-based seccomp profiles generated from runtime traces.",
  },
  {
    id: "glyphsynth",
    title: "GlyphSynth",
    subtitle: "Tiny diffusion model for logos",
    year: "2025",
    stack: ["PyTorch", "JAX"],
    detail: "modal",
    monsterId: "ink",
    accent: "pink",
    summary:
      "A 14M-param diffusion model that draws vector glyphs in <300ms. Trained on a hand-curated set of 40k marks.",
    sections: [
      { kind: "text", body: "Experiment in extreme model compression. Most of the gain came from the tokenizer, not the weights." },
    ],
  },
  {
    id: "lensd",
    title: "lensd",
    subtitle: "Tiny webcam daemon for Linux",
    year: "2024",
    stack: ["C", "V4L2"],
    detail: "inline",
    monsterId: "pip",
    accent: "cyan",
    summary: "600 LOC of C that replaces three bloated webcam apps. Zero config, zero surprises.",
  },
  {
    id: "marketmoth",
    title: "MarketMoth",
    subtitle: "Microstructure dashboard for crypto",
    year: "2024",
    stack: ["Rust", "React", "WebGL"],
    detail: "modal",
    monsterId: "moth2",
    accent: "green",
    summary:
      "Real-time orderbook heatmap + trade flow classifier. Ingests 80k msg/s per venue.",
    sections: [
      { kind: "text", body: "The WebGL heatmap does 60fps with 400k price levels. The trick is treating the orderbook as a texture." },
    ],
  },
  {
    id: "dendrite",
    title: "Dendrite",
    subtitle: "Notes app for thinkers, not note-takers",
    year: "2024",
    stack: ["TypeScript", "SQLite", "Tauri"],
    detail: "modal",
    monsterId: "dend",
    accent: "orange",
    summary: "Bidirectional links, local-first, keyboard-first. 12MB binary.",
    sections: [
      { kind: "text", body: "Built because every notes app is either a database or a toy. Dendrite is a database that feels like a toy." },
    ],
  },
  {
    id: "tinycompile",
    title: "tinycompile",
    subtitle: "Teaching compiler written in 2000 LOC",
    year: "2023",
    stack: ["OCaml"],
    detail: "inline",
    monsterId: "sprout",
    accent: "yellow",
    summary: "A compiler for a subset of C, front-to-back in 2000 lines. Used in my compilers lecture notes.",
  },
  {
    id: "mono",
    title: "mono",
    subtitle: "Monospaced font built for long sessions",
    year: "2023",
    stack: ["Glyphs", "FontTools"],
    detail: "modal",
    monsterId: "blipp",
    accent: "blue",
    summary: "A utilitarian programming font. Slab-less, hook-less, stays out of your way at 3am.",
    sections: [
      { kind: "text", body: "Designed around the character pairs that actually show up in code: 'fn', '=>', '::', '||'." },
    ],
  },
];
